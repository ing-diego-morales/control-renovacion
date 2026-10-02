import { Router } from 'express';
import { pool } from './db.js';

const REASONS = ['down', 'changed', 'stolen', 'other'];

// Alquiler + cliente + cuenta + servicio, con estado y días restantes
export const RENTAL_SELECT = `
  SELECT rt.*, c.name AS customer_name, c.phone AS customer_phone,
         a.email AS account_email, p.name AS product_name,
         DATEDIFF(rt.end_date, CURDATE()) AS days_left,
         CASE
           WHEN rt.status = 'cancelled' THEN 'cancelled'
           WHEN rt.end_date < CURDATE() THEN 'expired'
           WHEN rt.end_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 'expiring'
           ELSE 'active'
         END AS state
  FROM rentals rt
  JOIN customers c ON c.id = rt.customer_id
  JOIN accounts a ON a.id = rt.account_id
  JOIN products p ON p.id = a.product_id`;

const router = Router();

// ---------- Aviso de vencidos sin cortar (agrupado por cliente) ----------
router.get('/alerts', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT customer_id, customer_name, COUNT(*) AS accounts, MIN(days_left) AS worst_days
       FROM (${RENTAL_SELECT}) x
       WHERE status = 'active' AND days_left < 0
       GROUP BY customer_id, customer_name
       ORDER BY worst_days ASC`);
    const count = rows.reduce((s, r) => s + Number(r.accounts), 0);
    res.json({ count, customers: rows.length, items: rows.slice(0, 6) });
  } catch (e) { next(e); }
});

// ---------- Lista paginada: ?state=expired&q=ana&page=1&limit=25 ----------
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 25);
    const where = [];
    const params = [];
    if (req.query.state) { where.push('state = ?'); params.push(req.query.state); }
    if (req.query.q) {
      where.push('(customer_name LIKE ? OR account_email LIKE ? OR product_name LIKE ?)');
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    const base = `FROM (${RENTAL_SELECT}) x ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, params);
    const [data] = await pool.query(
      `SELECT * ${base} ORDER BY end_date ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    res.json({ data, total, page, limit });
  } catch (e) { next(e); }
});

// ---------- Crear: cliente + servicio + cantidad (asigna cuentas libres solas) ----------
router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { customer_id, product_id, quantity = 1, price = 0, end_date = null, days = 30 } = req.body;
    const qty = Math.floor(Number(quantity));
    if (!customer_id || !product_id)
      return res.status(400).json({ error: 'Elige el cliente y el servicio' });
    if (!qty || qty < 1 || qty > 500)
      return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 500' });

    await conn.beginTransaction();

    // Toma las cuentas libres más antiguas y las bloquea para que nadie las asigne dos veces
    const [free] = await conn.query(
      `SELECT a.id FROM accounts a
       WHERE a.product_id = ? AND a.deleted_at IS NULL AND a.is_down = 0
         AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.account_id = a.id AND r.status = 'active')
       ORDER BY a.id LIMIT ? FOR UPDATE`,
      [product_id, qty]
    );
    if (free.length < qty) {
      await conn.rollback();
      return res.status(409).json({
        error: `Solo hay ${free.length} ${free.length === 1 ? 'cuenta libre' : 'cuentas libres'} de este servicio y pediste ${qty}`,
      });
    }

    const [[d]] = await conn.query(
      'SELECT CURDATE() AS today, COALESCE(?, DATE_ADD(CURDATE(), INTERVAL ? DAY)) AS end_date',
      [end_date, Number(days) || 30]
    );
    const rows = free.map((a) => [customer_id, a.id, Number(price) || 0, d.today, d.end_date]);
    await conn.query(
      'INSERT INTO rentals (customer_id, account_id, price, start_date, end_date) VALUES ?', [rows]);

    await conn.commit();
    res.status(201).json({ created: qty });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

// ---------- Renovar uno o varios: { ids, days } o { ids, end_date } ----------
router.post('/renew', async (req, res, next) => {
  try {
    const { ids = [], days = 30, end_date = null } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No hay alquileres seleccionados' });
    // Con días: suma desde el vencimiento (o desde hoy si ya venció). Con fecha: usa esa fecha exacta
    const [r] = await pool.query(
      `UPDATE rentals
       SET end_date = COALESCE(?, DATE_ADD(GREATEST(end_date, CURDATE()), INTERVAL ? DAY))
       WHERE id IN (?) AND status = 'active'`,
      [end_date, Number(days) || 30, ids]
    );
    res.json({ renewed: r.affectedRows });
  } catch (e) { next(e); }
});

// ---------- Cortar uno o varios: { ids, account_action: 'free' | 'down' | 'trash', reason } ----------
router.post('/cancel', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { ids = [], account_action = 'free', reason = 'other' } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No hay alquileres seleccionados' });
    if (account_action === 'trash' && !REASONS.includes(reason))
      return res.status(400).json({ error: 'Motivo no válido' });

    await conn.beginTransaction();
    const [rentals] = await conn.query(
      "SELECT id, account_id FROM rentals WHERE id IN (?) AND status = 'active' FOR UPDATE", [ids]);
    if (!rentals.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Esos alquileres no existen o ya estaban cancelados' });
    }
    await conn.query("UPDATE rentals SET status = 'cancelled' WHERE id IN (?)", [rentals.map((r) => r.id)]);

    const accountIds = rentals.map((r) => r.account_id);
    if (account_action === 'trash')
      await conn.query(
        'UPDATE accounts SET deleted_at = NOW(), delete_reason = ? WHERE id IN (?) AND deleted_at IS NULL',
        [reason, accountIds]);
    else if (account_action === 'down')
      await conn.query('UPDATE accounts SET is_down = 1 WHERE id IN (?)', [accountIds]);

    await conn.commit();
    res.json({ cancelled: rentals.length });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

// ---------- Corregir un alquiler (precio y vencimiento) ----------
router.put('/:id', async (req, res, next) => {
  try {
    const { price, end_date } = req.body;
    if (!end_date) return res.status(400).json({ error: 'La fecha de vencimiento es obligatoria' });
    const [r] = await pool.query(
      'UPDATE rentals SET price = ?, end_date = ? WHERE id = ?',
      [Number(price) || 0, end_date, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Alquiler no encontrado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
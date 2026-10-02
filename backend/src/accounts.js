import { Router } from "express";
import { pool } from "./db.js";

const REASONS = ["down", "changed", "stolen", "other"];
const router = Router();

// Cuenta + servicio + categoría + (si está alquilada) cliente y vencimiento.
// Estado: caída > asignada > libre
const BASE = `
  SELECT a.id, a.product_id, a.email, a.password, a.cost, a.is_down, a.notes, a.created_at,
         p.name AS product_name,
         COALESCE(cat.name, 'Sin categoría') AS category_name,
         r.id AS rental_id, r.end_date AS rental_end, c.name AS customer_name,
         DATEDIFF(r.end_date, CURDATE()) AS days_left,
         CASE WHEN a.is_down = 1 THEN 'down'
              WHEN r.id IS NOT NULL THEN 'assigned'
              ELSE 'free' END AS state
  FROM accounts a
  JOIN products p ON p.id = a.product_id
  LEFT JOIN categories cat ON cat.id = p.category_id
  LEFT JOIN rentals r ON r.account_id = a.id AND r.status = 'active'
  LEFT JOIN customers c ON c.id = r.customer_id
  WHERE a.deleted_at IS NULL`;

async function isDuplicate(productId, email, excludeId = 0) {
  const [rows] = await pool.query(
    `SELECT id FROM accounts
     WHERE product_id = ? AND LOWER(email) = LOWER(?) AND deleted_at IS NULL AND id <> ? LIMIT 1`,
    [productId, email, excludeId],
  );
  return rows.length > 0;
}

// Borra definitivamente las cuentas de la papelera (solo si no tienen alquiler activo)
export async function purgeTrash({ onlyExpired = true } = {}) {
  const [rows] = await pool.query(
    `SELECT id FROM accounts
     WHERE deleted_at IS NOT NULL
       ${onlyExpired ? "AND deleted_at < NOW() - INTERVAL 30 DAY" : ""}
       AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.account_id = accounts.id AND r.status = 'active')`,
  );
  if (!rows.length) return 0;
  const ids = rows.map((r) => r.id);
  await pool.query("DELETE FROM rentals WHERE account_id IN (?)", [ids]);
  const [res] = await pool.query("DELETE FROM accounts WHERE id IN (?)", [ids]);
  return res.affectedRows;
}

// ---------- Lista (paginada, con filtros y conteos por estado) ----------
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 25);
    const ORDER = {
      recent: "id DESC",
      days_asc: "days_left IS NULL, days_left ASC, id DESC",
      days_desc: "days_left IS NULL, days_left DESC, id DESC",
    };
    const order = ORDER[req.query.sort] || ORDER.recent;
    const where = [];
    const params = [];
    if (req.query.state) {
      where.push("state = ?");
      params.push(req.query.state);
    }
    if (req.query.product_id) {
      where.push("product_id = ?");
      params.push(Number(req.query.product_id));
    }
    if (req.query.q) {
      const like = `%${req.query.q}%`;
      where.push(
        "(email LIKE ? OR product_name LIKE ? OR customer_name LIKE ?)",
      );
      params.push(like, like, like);
    }
    const from = `FROM (${BASE}) x ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${from}`,
      params,
    );
    const [data] = await pool.query(
      `SELECT * ${from} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    const [cnt] = await pool.query(
      `SELECT state, COUNT(*) AS n FROM (${BASE}) x GROUP BY state`,
    );
    const counts = { free: 0, assigned: 0, down: 0 };
    cnt.forEach((c) => {
      counts[c.state] = Number(c.n);
    });

    res.json({ data, total, page, limit, counts });
  } catch (e) {
    next(e);
  }
});

// ---------- Papelera: lista ----------
router.get("/trash", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 25);
    const where = ["a.deleted_at IS NOT NULL"];
    const params = [];
    if (REASONS.includes(req.query.reason)) {
      where.push("a.delete_reason = ?");
      params.push(req.query.reason);
    }
    if (req.query.q) {
      where.push("(a.email LIKE ? OR p.name LIKE ?)");
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    const from = `FROM accounts a JOIN products p ON p.id = a.product_id WHERE ${where.join(" AND ")}`;
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${from}`,
      params,
    );
    const [data] = await pool.query(
      `SELECT a.id, a.email, a.password, a.deleted_at, a.delete_reason, p.name AS product_name,
              GREATEST(0, 30 - DATEDIFF(CURDATE(), DATE(a.deleted_at))) AS days_left
       ${from} ORDER BY a.deleted_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ data, total, page, limit });
  } catch (e) {
    next(e);
  }
});

// ---------- Crear una cuenta (siempre entra como libre) ----------
router.post("/", async (req, res, next) => {
  try {
    const {
      product_id,
      email = "",
      password = "",
      cost = 0,
      notes = null,
    } = req.body;
    if (!product_id || !email.trim())
      return res
        .status(400)
        .json({ error: "El servicio y el correo son obligatorios" });
    if (await isDuplicate(product_id, email.trim()))
      return res
        .status(409)
        .json({
          error: "Ya existe una cuenta con ese correo en este servicio",
        });
    const [r] = await pool.query(
      "INSERT INTO accounts (product_id, email, password, cost, notes) VALUES (?, ?, ?, ?, ?)",
      [product_id, email.trim(), password, Number(cost) || 0, notes || null],
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    next(e);
  }
});

// ---------- Carga masiva ----------
router.post("/bulk", async (req, res, next) => {
  try {
    const { product_id, cost = 0, items = [] } = req.body;
    if (!product_id)
      return res.status(400).json({ error: "Elige el servicio" });
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: "No hay cuentas para subir" });
    if (items.length > 2000)
      return res.status(400).json({ error: "Máximo 2000 cuentas por carga" });

    const [[prod]] = await pool.query("SELECT id FROM products WHERE id = ?", [
      product_id,
    ]);
    if (!prod) return res.status(400).json({ error: "Servicio no encontrado" });

    const [existing] = await pool.query(
      "SELECT LOWER(email) AS email FROM accounts WHERE product_id = ? AND deleted_at IS NULL",
      [product_id],
    );
    const seen = new Set(existing.map((r) => r.email));

    const rows = [];
    const duplicates = [];
    for (const it of items) {
      const email = String(it.email || "").trim();
      const password = String(it.password || "").trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) {
        duplicates.push(email);
        continue;
      }
      seen.add(key);
      rows.push([product_id, email, password, Number(cost) || 0]);
    }
    if (rows.length)
      await pool.query(
        "INSERT INTO accounts (product_id, email, password, cost) VALUES ?",
        [rows],
      );

    res.status(201).json({
      created: rows.length,
      duplicates: duplicates.length,
      duplicate_list: duplicates.slice(0, 20),
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Enviar a la papelera (una o varias) ----------
router.post("/trash-many", async (req, res, next) => {
  try {
    const { ids = [], reason } = req.body;
    if (!REASONS.includes(reason))
      return res.status(400).json({ error: "Motivo no válido" });
    if (!Array.isArray(ids) || !ids.length)
      return res.status(400).json({ error: "No hay cuentas seleccionadas" });
    // Las que están asignadas a un cliente no se mueven
    const [r] = await pool.query(
      `UPDATE accounts SET deleted_at = NOW(), delete_reason = ?
       WHERE id IN (?) AND deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.account_id = accounts.id AND r.status = 'active')`,
      [reason, ids],
    );
    res.json({ trashed: r.affectedRows, skipped: ids.length - r.affectedRows });
  } catch (e) {
    next(e);
  }
});

// ---------- Vaciar papelera ----------
router.delete("/trash", async (req, res, next) => {
  try {
    res.json({ deleted: await purgeTrash({ onlyExpired: false }) });
  } catch (e) {
    next(e);
  }
});

// ---------- Editar ----------
router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      product_id,
      email = "",
      password = "",
      cost = 0,
      notes = null,
    } = req.body;
    if (!product_id || !email.trim())
      return res
        .status(400)
        .json({ error: "El servicio y el correo son obligatorios" });
    if (await isDuplicate(product_id, email.trim(), id))
      return res
        .status(409)
        .json({
          error: "Ya existe otra cuenta con ese correo en este servicio",
        });
    const [r] = await pool.query(
      `UPDATE accounts SET product_id = ?, email = ?, password = ?, cost = ?, notes = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        product_id,
        email.trim(),
        password,
        Number(cost) || 0,
        notes || null,
        id,
      ],
    );
    if (!r.affectedRows)
      return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Marcar / quitar "caída" ----------
router.post("/:id/down", async (req, res, next) => {
  try {
    const [r] = await pool.query(
      "UPDATE accounts SET is_down = ? WHERE id = ? AND deleted_at IS NULL",
      [req.body.down ? 1 : 0, req.params.id],
    );
    if (!r.affectedRows)
      return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Restaurar desde la papelera ----------
router.post("/:id/restore", async (req, res, next) => {
  try {
    const [r] = await pool.query(
      `UPDATE accounts SET deleted_at = NULL, delete_reason = NULL, is_down = 0
       WHERE id = ? AND deleted_at IS NOT NULL`,
      [req.params.id],
    );
    if (!r.affectedRows)
      return res.status(404).json({ error: "No está en la papelera" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Eliminar definitivamente una cuenta de la papelera ----------
router.delete("/:id/purge", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[acc]] = await pool.query(
      "SELECT id FROM accounts WHERE id = ? AND deleted_at IS NOT NULL",
      [id],
    );
    if (!acc) return res.status(404).json({ error: "No está en la papelera" });
    const [[busy]] = await pool.query(
      "SELECT id FROM rentals WHERE account_id = ? AND status = 'active' LIMIT 1",
      [id],
    );
    if (busy)
      return res
        .status(409)
        .json({ error: "Esa cuenta aún tiene un alquiler activo" });
    await pool.query("DELETE FROM rentals WHERE account_id = ?", [id]);
    await pool.query("DELETE FROM accounts WHERE id = ?", [id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;

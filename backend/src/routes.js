import { Router } from "express";
import { crudRouter } from "./crud.js";
import rentals, { RENTAL_SELECT } from "./rentals.js";
import { pool } from "./db.js";
import { authRouter, requireAuth } from './auth.js';
import accounts from './accounts.js';

const api = Router();

api.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});


api.use('/auth', authRouter);
api.use(requireAuth);


api.get('/dashboard', async (req, res, next) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS accounts,
        (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL AND is_down = 1) AS down_accounts,
        (SELECT COUNT(*) FROM rentals WHERE status = 'active' AND end_date >= CURDATE()) AS active_rentals,
        (SELECT COUNT(*) FROM rentals WHERE status = 'active' AND end_date < CURDATE()) AS expired,
        (SELECT COUNT(*) FROM rentals WHERE status = 'active'
           AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)) AS expiring,
        (SELECT COALESCE(SUM(price), 0) FROM rentals WHERE status = 'active') AS monthly_income`);

    const [due] = await pool.query(
      `SELECT * FROM (${RENTAL_SELECT}) x
       WHERE status = 'active' AND days_left <= 7
       ORDER BY end_date ASC LIMIT 50`);

    // Cuentas libres: sin alquiler activo, no caídas y fuera de la papelera
    const [free] = await pool.query(`
      SELECT COALESCE(c.name, 'Sin categoría') AS category_name,
             p.id AS product_id, p.name AS product_name, COUNT(*) AS total
      FROM accounts a
      JOIN products p ON p.id = a.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE a.deleted_at IS NULL AND a.is_down = 0
        AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.account_id = a.id AND r.status = 'active')
      GROUP BY c.name, p.id, p.name
      ORDER BY category_name, product_name`);

    res.json({ stats, due, free });
  } catch (e) { next(e); }
});

api.use("/rentals", rentals);

api.use(
  "/categories",
  crudRouter({
    table: "categories",
    fields: ["name"],
    searchFields: ["name"],
    required: ["name"],
  }),
);

api.use(
  "/products",
  crudRouter({
    table: "products",
    fields: ["category_id", "name", "price", "duration_days"],
    searchFields: ["products.name", "categories.name"],
    required: ["name"],
    select: `SELECT products.*, categories.name AS category_name
           FROM products LEFT JOIN categories ON categories.id = products.category_id`,
  }),
);

api.use('/accounts', accounts);

api.use('/customers', crudRouter({
  table: 'customers',
  fields: ['name', 'phone', 'email', 'notes'],
  searchFields: ['name', 'phone', 'email'],
  required: ['name', 'phone', 'email'],
}));

export default api;

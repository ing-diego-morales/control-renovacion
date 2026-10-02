import { Router } from 'express';
import { pool } from './db.js';

export function crudRouter({ table, fields, searchFields = [], required = [], select }) {
  const router = Router();

  const pick = (body) =>
    Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

  router.get('/', async (req, res, next) => {
    try {
      const q = (req.query.q || '').trim();
      let sql = select || `SELECT * FROM ${table}`;
      const params = [];
      if (q && searchFields.length) {
        sql += ' WHERE ' + searchFields.map((f) => `${f} LIKE ?`).join(' OR ');
        searchFields.forEach(() => params.push(`%${q}%`));
      }
      sql += ` ORDER BY ${table}.id DESC LIMIT 500`;
      const [rows] = await pool.query(sql, params);
      res.json(rows);
    } catch (e) { next(e); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const data = pick(req.body);
      for (const f of required) {
        if (data[f] === undefined || String(data[f]).trim() === '')
          return res.status(400).json({ error: `El campo "${f}" es obligatorio` });
      }
      const cols = Object.keys(data);
      const [r] = await pool.query(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        Object.values(data)
      );
      const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [r.insertId]);
      res.status(201).json(row);
    } catch (e) { next(e); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const data = pick(req.body);
      const cols = Object.keys(data);
      if (!cols.length) return res.status(400).json({ error: 'Nada que actualizar' });
      const [r] = await pool.query(
        `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`,
        [...Object.values(data), req.params.id]
      );
      if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
      const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json(row);
    } catch (e) { next(e); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const [r] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  return router;
}
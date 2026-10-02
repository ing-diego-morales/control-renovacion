import 'dotenv/config';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('Falta JWT_SECRET en backend/.env');
  process.exit(1);
}

// Protege las rutas: exige un token válido
export const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada. Inicia sesión de nuevo.' });
  }
};

// Límite simple: 10 intentos de login cada 15 minutos por IP
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const now = Date.now();
    const recent = (attempts.get(req.ip) || []).filter((t) => now - t < WINDOW);
    if (recent.length >= 10)
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    attempts.set(req.ip, [...recent, now]);

    const { email = '', password = '' } = req.body;
    const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    attempts.delete(req.ip);
    const payload = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
    res.json({ token, user: payload });
  } catch (e) { next(e); }
});

authRouter.get('/me', requireAuth, (req, res) =>
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } }));
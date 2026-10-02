import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.log('Uso: node src/create-user.js "Nombre" correo@ejemplo.com "contraseña"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
await pool.query(
  `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)`,
  [name, email.trim().toLowerCase(), hash]
);
console.log('Usuario listo:', email);
process.exit(0);
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import api from './routes.js';
import { pool } from './db.js';
import { purgeTrash } from './accounts.js';

const app = express();
const isDev = process.env.NODE_ENV !== 'production';

const allowed = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) =>
    !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error('Origen no permitido por CORS')),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use('/api', api);

app.use((req, res) =>
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }));

app.use((err, req, res, next) => {
  console.error(`✖ ${req.method} ${req.originalUrl} → ${err.code || ''} ${err.sqlMessage || err.message}`);
  if (process.env.DEBUG) console.error(err);

  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Los datos enviados no son un JSON válido' });
  if (err.message === 'Origen no permitido por CORS')
    return res.status(403).json({ error: 'Origen no permitido por CORS: agrégalo en CORS_ORIGINS de backend/.env' });
  if (err.code === 'ER_DUP_ENTRY')
    return res.status(409).json({ error: 'Ya existe un registro con ese valor (nombre o dato repetido)' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2')
    return res.status(409).json({ error: 'No se puede eliminar: tiene registros relacionados (por ejemplo alquileres o cuentas)' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2')
    return res.status(409).json({ error: 'El cliente, servicio o cuenta indicado ya no existe' });

  res.status(500).json({
    error: 'Error interno del servidor',
    detail: isDev ? err.sqlMessage || err.message : undefined,
  });
});

process.on('unhandledRejection', (e) => console.error('✖ Error no controlado:', e?.message || e));

app.listen(process.env.PORT, () => {
  console.log(`✔ API en http://localhost:${process.env.PORT}`);

  pool.query('SELECT 1')
    .then(() => console.log('✔ MySQL conectado'))
    .catch((e) => console.error(
      `✖ No se pudo conectar a MySQL (${e.code}): ${e.message}\n` +
      `  → Inicia MySQL en XAMPP y revisa DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en backend/.env`
    ));

  // Papelera: borra sola las cuentas con más de 30 días (al arrancar y cada 6 horas)
  const runPurge = () =>
    purgeTrash()
      .then((n) => n && console.log(`Papelera: ${n} cuentas eliminadas por superar 30 días`))
      .catch((e) => console.error('✖ Error limpiando la papelera:', e.message));
  runPurge();
  setInterval(runPurge, 6 * 60 * 60 * 1000);
});
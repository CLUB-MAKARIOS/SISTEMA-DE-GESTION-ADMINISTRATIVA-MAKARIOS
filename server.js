const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const PW = process.env.APP_PASSWORD;
if (!PW) { console.error('Falta la variable APP_PASSWORD'); process.exit(1); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS: permite que la página en GitHub Pages llame a esta API
const ORIGIN = process.env.CORS_ORIGIN; // ej: https://usuario.github.io
app.use((req, res, next) => {
  if (ORIGIN) {
    res.set({ 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// Acceso protegido con contraseña (Basic Auth). Usuario: cualquiera.
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
app.use((req, res, next) => {
  const h = req.headers.authorization || '';
  const given = Buffer.from(h.split(' ')[1] || '', 'base64').toString().split(':').slice(1).join(':');
  if (crypto.timingSafeEqual(sha(given), sha(PW))) return next();
  if (!req.path.startsWith('/api')) res.set('WWW-Authenticate', 'Basic realm="Club Makarios"');
  res.status(401).send('Acceso restringido');
});

app.get('/api/state', async (_req, res) => {
  const r = await pool.query("SELECT data FROM app_state WHERE id='club'");
  res.json(r.rows[0]?.data || {});
});

app.put('/api/state', async (req, res) => {
  await pool.query(
    `INSERT INTO app_state (id, data) VALUES ('club', $1)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [req.body]
  );
  res.json({ ok: true });
});

app.use(express.static('docs'));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'error interno' }); });

(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (
    id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('Escuchando en puerto ' + port));
})();

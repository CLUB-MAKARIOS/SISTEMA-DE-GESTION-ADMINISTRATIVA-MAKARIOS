/* Club Makarios · Servidor (Node.js + PostgreSQL)
 * - Sirve la aplicación (carpeta public/)
 * - Guarda los datos en PostgreSQL
 * - Valida inicio de sesión y contraseñas en el servidor: los hashes nunca se envían al navegador */
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');
const Core = require('./public/auth-core.js');

const PORT = process.env.PORT || 3000;
const SESSION_HOURS = +(process.env.SESSION_HOURS || 8);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ---------- Base de datos ---------- */
async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (
    id         integer PRIMARY KEY,
    data       jsonb   NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}
async function loadState() {
  const r = await pool.query('SELECT data FROM app_state WHERE id = 1');
  return Core.ensure(r.rows[0] ? r.rows[0].data : {});
}
async function saveState(S) {
  await pool.query(`INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [S]);
}
/* Las escrituras se hacen una a la vez para no pisar datos */
let queue = Promise.resolve();
const locked = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };

/* ---------- Sesiones (en memoria; al reiniciar el servidor hay que volver a entrar) ---------- */
const sessions = new Map();
function newSession(userId, temp) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, temp: !!temp, exp: Date.now() + SESSION_HOURS * 3600e3 });
  return token;
}
function getSession(req) {
  const m = /^Bearer (\w+)$/.exec(req.get('Authorization') || '');
  const s = m && sessions.get(m[1]);
  if (!s) return null;
  if (Date.now() > s.exp) { sessions.delete(m[1]); return null; }
  return Object.assign(s, { token: m[1] });
}
setInterval(() => { const n = Date.now(); for (const [k, s] of sessions) if (n > s.exp) sessions.delete(k); }, 600e3).unref();

/* ---------- Seguridad de los datos enviados al navegador ---------- */
const SECRET = ['salt', 'hash', 'rsalt', 'rhash', 'temp', 'preg'];
function strip(S) {
  return Object.assign({}, S, {
    users: S.users.map(u => {
      const c = Object.assign({}, u);
      delete c.salt; delete c.rsalt;
      c.hash = !!u.hash; c.rhash = !!u.rhash; // el navegador solo sabe si existe, no el valor
      return c;
    })
  });
}
function mergeLog(a, b) {
  const seen = new Set(), out = [];
  for (const l of [...(a || []), ...(b || [])]) {
    const k = (l.ts || '') + '|' + l.f + '|' + l.t;
    if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  return out.sort((x, y) => (y.ts || 0) - (x.ts || 0)).slice(0, 500);
}
/* Qué permiso hace falta para modificar cada sección */
const SECTION_PERM = { socios: 'socios_edit', obl: 'cargos_crear', pagos: 'pagos', cats: 'admin' };
function mergeIncoming(db, inc, perms) {
  const isAdmin = !!perms.admin, out = Object.assign({}, db);
  for (const [sec, p] of Object.entries(SECTION_PERM)) if (Array.isArray(inc[sec]) && (isAdmin || perms[p])) out[sec] = inc[sec];
  const byId = Object.fromEntries(db.users.map(u => [u.id, u]));
  if (isAdmin && Array.isArray(inc.users)) {
    out.users = inc.users.map(u => {
      const r = Object.assign({}, u), d = byId[u.id] || {};
      for (const k of SECRET) { if (d[k] !== undefined) r[k] = d[k]; else delete r[k]; }
      return r;
    });
    if (!out.users.some(u => u.perms && u.perms.admin && u.hash)) out.users = db.users; // nunca quedarse sin administrador
  } else {
    out.users = db.users; // solo un administrador puede cambiar usuarios y permisos
  }
  out.log = mergeLog(db.log, inc.log);
  return out;
}

/* ---------- Aplicación web ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
if (process.env.CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/:action', (req, res) => locked(async () => {
  const action = req.params.action, sess = getSession(req);
  if (['password', 'question', 'adminTemp'].includes(action) && (!sess || sess.temp)) return res.status(401).json({ ok: false, err: 'Sesión no válida.', back: true });
  if (action === 'changeTemp' && !sess) return res.status(401).json({ ok: false, err: 'Sesión no válida.', back: true });
  const S = await loadState();
  const r = Core.handle(S, action, req.body || {}, sess && sess.userId);
  if (r.dirty) await saveState(S);
  const out = Object.assign({}, r); delete out.dirty;
  if (r.ok && action === 'login') out.token = newSession(r.userId, r.temp);
  if (r.ok && action === 'setup') out.token = newSession(r.userId, false);
  if (r.ok && action === 'changeTemp') sess.temp = false;
  if (action === 'logout' && sess) sessions.delete(sess.token);
  res.json(out);
}).catch(e => { console.error(e); res.status(500).json({ ok: false, err: 'Error del servidor.' }); }));

function auth(req, res, next) {
  const s = getSession(req);
  if (!s || s.temp) return res.status(401).json({ error: 'no autorizado' });
  req.sess = s; next();
}

app.get('/api/state', auth, (req, res) => locked(async () => {
  const S = await loadState();
  const u = S.users.find(x => x.id === req.sess.userId);
  if (!u || !u.hash) { sessions.delete(req.sess.token); return res.status(401).json({ error: 'no autorizado' }); }
  res.json({ userId: u.id, state: strip(S) });
}).catch(e => { console.error(e); res.status(500).json({ error: 'error' }); }));

app.put('/api/state', auth, (req, res) => locked(async () => {
  const db = await loadState();
  const u = db.users.find(x => x.id === req.sess.userId);
  if (!u) { sessions.delete(req.sess.token); return res.status(401).json({ error: 'no autorizado' }); }
  const S = mergeIncoming(db, req.body || {}, u.perms || {});
  await saveState(Core.ensure(S));
  res.json({ ok: true });
}).catch(e => { console.error(e); res.status(500).json({ error: 'error' }); }));

initDb()
  .then(() => app.listen(PORT, () => console.log(`Club Makarios funcionando en http://localhost:${PORT}`)))
  .catch(e => {
    console.error('No se pudo conectar a PostgreSQL. Revisa DATABASE_URL en el archivo .env');
    console.error(e.message);
    process.exit(1);
  });

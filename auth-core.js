/* Club Makarios · Núcleo de autenticación
 * Se usa en el navegador (modo local) y en el servidor Node (modo PostgreSQL),
 * así las reglas de contraseñas son exactamente las mismas en ambos casos. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AuthCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CR = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues)
    ? globalThis.crypto : require('crypto').webcrypto;

  const PREGUNTAS = ['¿Nombre de tu primera mascota?', '¿Ciudad donde naciste?', '¿Nombre de tu escuela primaria?',
    '¿Tu apodo de infancia?', '¿Segundo nombre de tu madre?', '¿Tu comida favorita?'];
  const PL = { tablero: 'Ver tablero', socios_ver: 'Ver socios', socios_edit: 'Crear/editar socios', cartera_ver: 'Ver cuentas por cobrar',
    cargos_crear: 'Crear cargos', pagos: 'Registrar pagos', alertas: 'Ver alertas', bitacora: 'Ver bitácora', admin: 'Administrar usuarios y categorías' };
  const P = l => Object.fromEntries(Object.keys(PL).map(k => [k, l.includes(k)]));
  const ROLES = { 'Administrador': P(Object.keys(PL)), 'Tesorería': P(['tablero', 'socios_ver', 'cartera_ver', 'cargos_crear', 'pagos']),
    'Cobranza': P(['tablero', 'socios_ver', 'cartera_ver', 'alertas']), 'Secretaría deportiva': P(['socios_ver', 'socios_edit']),
    'Directiva': P(['tablero', 'socios_ver', 'cartera_ver', 'alertas', 'bitacora']) };

  /* SHA-256 (UTF-8) en JavaScript puro: funciona igual en navegador y en Node */
  function sha256(s) {
    s = unescape(encodeURIComponent(s));
    const K = [], H = []; let n = 2, c = 0;
    const pr = x => { for (let f = 2; f * f <= x; f++) if (x % f === 0) return false; return true; };
    const fr = x => (x - Math.floor(x)) * 4294967296 | 0;
    while (c < 64) { if (pr(n)) { if (c < 8) H[c] = fr(Math.pow(n, 1 / 2)); K[c] = fr(Math.pow(n, 1 / 3)); c++; } n++; }
    const r = (x, y) => x >>> y | x << (32 - y), L = s.length * 8;
    s += '\x80'; while (s.length % 64 !== 56) s += '\x00';
    const W = []; for (let i = 0; i < s.length; i++) W[i >> 2] |= s.charCodeAt(i) << ((3 - i % 4) * 8);
    W.push(Math.floor(L / 4294967296), L | 0);
    for (let j = 0; j < W.length; j += 16) {
      const w = W.slice(j, j + 16); let [a, b, cc, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        if (i >= 16) { const x = w[i - 15], y = w[i - 2]; w[i] = (w[i - 16] + (r(x, 7) ^ r(x, 18) ^ x >>> 3) + w[i - 7] + (r(y, 17) ^ r(y, 19) ^ y >>> 10)) | 0; }
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, cc, d, e, f, g, h].forEach((v, i) => H[i] = (H[i] + v) | 0);
    }
    return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const rnd = (n, abc) => { const a = new Uint32Array(n); CR.getRandomValues(a); return Array.from(a, v => abc[v % abc.length]).join(''); };
  const newSalt = () => rnd(16, 'abcdefghijklmnopqrstuvwxyz0123456789');
  function hashPw(pw, salt) { let h = salt + '|' + pw; for (let i = 0; i < 1500; i++) h = sha256(salt + h); return h; }
  const normA = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  const tempPw = () => rnd(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ') + rnd(3, '23456789') + rnd(1, 'abcdefghjkmnpqrstuvwxyz');
  function setPw(u, pw, temp) { u.salt = newSalt(); u.hash = hashPw(pw, u.salt); u.temp = !!temp; }
  const checkPw = (u, pw) => typeof u.hash === 'string' && hashPw(String(pw || ''), u.salt) === u.hash;
  function setRec(u, preg, resp) { u.preg = preg; u.rsalt = newSalt(); u.rhash = hashPw(normA(resp), u.rsalt); }
  const checkRec = (u, resp) => typeof u.rhash === 'string' && hashPw(normA(resp), u.rsalt) === u.rhash;
  function pwRule(pw, c) {
    pw = String(pw || '');
    if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw) || !/\d/.test(pw)) return 'La contraseña debe incluir letras y números.';
    if (pw !== c) return 'Las contraseñas no coinciden.';
    return '';
  }
  const slug = s => normA(s).replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'usuario';

  function ensure(S) {
    S.socios = S.socios || []; S.obl = S.obl || []; S.pagos = S.pagos || []; S.log = S.log || [];
    if (!S.cats || !S.cats.length) S.cats = ['Adulto', 'Juvenil', 'Infantil'];
    if (!S.users || !S.users.length) S.users = [{ id: 'u0', nombre: 'Administrador', usuario: 'admin', rol: 'Administrador', perms: { ...ROLES['Administrador'] } }];
    S.users.forEach(u => {
      u.perms = u.perms || {};
      if (!u.usuario) { const b = slug(u.nombre); let s = b, i = 2; while (S.users.some(x => x !== u && x.usuario === s)) s = b + i++; u.usuario = s; }
    });
    return S;
  }
  const needSetup = S => !S.users.some(u => u.hash && u.perms && u.perms.admin);
  const findUser = (S, x) => { x = normA(x); return x ? S.users.find(u => normA(u.usuario) === x || (u.email && normA(u.email) === x)) : null; };
  function addLog(S, who, t) {
    S.log = S.log || [];
    S.log.unshift({ ts: Date.now(), f: new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }), t: '[' + who + '] ' + t });
    S.log = S.log.slice(0, 500);
  }

  /* Bloqueo por intentos fallidos (en memoria) */
  const fails = {};
  const waitSec = k => { const x = fails[k]; return x && Date.now() < x.until ? Math.ceil((x.until - Date.now()) / 1000) : 0; };
  function fail(k, max, ms) { const x = fails[k] = fails[k] || { n: 0, until: 0 }; x.n++; if (x.n >= max) { x.until = Date.now() + ms; x.n = 0; return true; } return false; }

  /* Todas las acciones de autenticación.
   * S: estado completo · a: acción · b: datos del formulario · uid: usuario de la sesión */
  function handle(S, a, b, uid) {
    b = b || {}; ensure(S);
    const E = (t, extra) => Object.assign({ ok: false, err: t }, extra || {});
    const me = S.users.find(u => u.id === uid);
    switch (a) {
      case 'status': return { ok: true, setup: needSetup(S) };

      case 'login': {
        const k = 'l:' + normA(b.u), w = waitSec(k);
        if (w) return E(`Demasiados intentos. Espera ${w} segundos.`);
        const u = findUser(S, b.u);
        if (u && !u.hash) return E('Este usuario aún no tiene contraseña. Pide al administrador una contraseña temporal.', { k: 'wa' });
        if (!u || !checkPw(u, b.p)) { fail(k, 5, 60000); return E('Usuario o contraseña incorrectos.'); }
        delete fails[k];
        if (!u.temp) addLog(S, u.nombre, 'Inicio de sesión');
        return { ok: true, userId: u.id, temp: !!u.temp, nombre: u.nombre, preg: u.preg || '', dirty: !u.temp };
      }

      case 'changeTemp': {
        if (!me || !me.temp) return E('La sesión no es válida. Vuelve a iniciar sesión.', { back: true });
        const er = pwRule(b.p, b.c); if (er) return E(er);
        if (checkPw(me, b.p)) return E('La nueva contraseña debe ser distinta a la temporal.');
        if (!PREGUNTAS.includes(b.pq) || !String(b.pr || '').trim()) return E('Elige una pregunta y escribe una respuesta de seguridad.');
        setPw(me, b.p, false); setRec(me, b.pq, b.pr);
        addLog(S, me.nombre, 'Creó su contraseña personal'); addLog(S, me.nombre, 'Inicio de sesión');
        return { ok: true, userId: me.id, dirty: true };
      }

      case 'forgot': {
        const u = findUser(S, b.u);
        if (!u || !u.rhash) return E('No hay una pregunta de seguridad registrada para ese usuario. Pide al administrador que te asigne una contraseña temporal.', { k: 'wa' });
        return { ok: true, preg: u.preg };
      }

      case 'reset': {
        const u = findUser(S, b.u);
        if (!u || !u.rhash) return E('No se puede recuperar la contraseña de ese usuario.', { back: true });
        const k = 'r:' + u.id, w = waitSec(k);
        if (w) return E(`Recuperación bloqueada por seguridad. Intenta en ${Math.ceil(w / 60)} minuto(s) o pide ayuda al administrador.`, { back: true });
        if (!checkRec(u, b.r)) {
          if (fail(k, 3, 15 * 60000)) {
            addLog(S, u.nombre, 'Recuperación de contraseña bloqueada por respuestas incorrectas');
            return E('Respuesta incorrecta varias veces. La recuperación se bloqueó 15 minutos; puedes pedir ayuda al administrador.', { back: true, dirty: true });
          }
          return E('La respuesta no coincide.');
        }
        const er = pwRule(b.p, b.c); if (er) return E(er);
        delete fails[k]; setPw(u, b.p, false);
        addLog(S, u.nombre, 'Recuperó su contraseña con la pregunta de seguridad');
        return { ok: true, dirty: true };
      }

      case 'setup': {
        if (!needSetup(S)) return E('El administrador ya está configurado. Inicia sesión.', { back: true });
        const ad = S.users.find(u => u.perms && u.perms.admin) || S.users[0], us = String(b.u || '').trim();
        const er = pwRule(b.p, b.c); if (er) return E(er);
        if (!us || S.users.some(x => x !== ad && normA(x.usuario) === normA(us))) return E('Usuario vacío o ya existe.');
        if (!PREGUNTAS.includes(b.pq) || !String(b.pr || '').trim()) return E('Elige una pregunta y escribe una respuesta de seguridad.');
        ad.nombre = String(b.n || '').trim() || ad.nombre; ad.usuario = us; ad.perms = { ...ROLES['Administrador'] }; ad.rol = 'Administrador';
        setPw(ad, b.p, false); setRec(ad, b.pq, b.pr);
        addLog(S, ad.nombre, 'Acceso de administrador configurado');
        return { ok: true, userId: ad.id, dirty: true };
      }

      case 'password': {
        if (!me || me.temp) return E('La sesión no es válida.', { back: true });
        if (!checkPw(me, b.a)) return E('La contraseña actual no es correcta.');
        const er = pwRule(b.p, b.c); if (er) return E(er);
        setPw(me, b.p, false); addLog(S, me.nombre, 'Cambió su contraseña');
        return { ok: true, dirty: true };
      }

      case 'question': {
        if (!me || me.temp) return E('La sesión no es válida.', { back: true });
        if (!checkPw(me, b.a)) return E('La contraseña actual no es correcta.');
        if (!PREGUNTAS.includes(b.pq) || !String(b.pr || '').trim()) return E('Elige una pregunta y escribe una respuesta.');
        setRec(me, b.pq, b.pr); addLog(S, me.nombre, 'Actualizó su pregunta de seguridad');
        return { ok: true, dirty: true };
      }

      case 'adminTemp': {
        if (!me || me.temp || !me.perms.admin) return E('No tienes permiso para hacer esto.');
        const u = S.users.find(x => x.id === b.id);
        if (!u) return E('Usuario no encontrado.');
        if (u.id === me.id) return E('Usa «Mi cuenta» para cambiar tu propia contraseña.');
        const pw = String(b.pw || '').trim();
        if (pw.length < 6) return E('La contraseña temporal debe tener al menos 6 caracteres.');
        setPw(u, pw, true); addLog(S, me.nombre, 'Contraseña temporal asignada a ' + u.nombre);
        return { ok: true, dirty: true };
      }

      case 'logout': {
        if (me && !me.temp) addLog(S, me.nombre, 'Cierre de sesión');
        return { ok: true, dirty: !!me };
      }
    }
    return E('Acción no válida.');
  }

  return { PREGUNTAS, PL, ROLES, sha256, normA, tempPw, ensure, needSetup, findUser, addLog, handle };
});

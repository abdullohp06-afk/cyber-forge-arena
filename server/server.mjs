// Кибер-Кузня server: serves the built game and keeps accounts + cloud saves in SQLite.
// No npm dependencies: Node ≥ 22.13 (node:sqlite, node:crypto scrypt). Built for a 1 GB Orange Pi.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {scrypt, randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {mkdirSync} from 'node:fs';
import {join, resolve, extname, dirname, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

const scryptAsync = promisify(scrypt);
const HERE = dirname(fileURLToPath(import.meta.url));
const SESSION_MS = 60 * 24 * 3600 * 1000;               // stay logged in for 60 days
const MAX_BODY = 256 * 1024;                            // a full save is ~20 KB
const NAME_RE = /^[\p{L}\p{N}_-]{3,24}$/u;              // letters (any script), digits, _ and -
const AUTH_LIMIT = {windowMs: 15 * 60 * 1000, max: 20}; // login + register attempts per IP
const COOKIE = 'cf_session';
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'",
};

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true});
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE, salt BLOB NOT NULL, hash BLOB NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS saves (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL, saved_at INTEGER NOT NULL, updated INTEGER NOT NULL);`);
  return db;
}

const hashPassword = (pw, salt) => scryptAsync(pw.normalize('NFKC'), salt, 64);
const sha256 = s => createHash('sha256').update(s).digest('hex');
const nameKey = name => name.normalize('NFKC').toLowerCase();   // SQLite NOCASE folds only ASCII: «Абдулло» = «абдулло» needs this
const DUMMY_SALT = randomBytes(16);                      // unknown user: still spend the scrypt time, so timing doesn't leak names

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export function createApp({dbPath = ':memory:', staticDir = resolve(HERE, '../dist-server'), cookieSecure = false, trustProxy = false} = {}) {
  const db = openDb(dbPath), root = resolve(staticDir), attempts = new Map();
  const q = {
    userByName: db.prepare('SELECT id, name, salt, hash FROM users WHERE name_key = ?'),
    addUser: db.prepare('INSERT INTO users (name, name_key, salt, hash, created) VALUES (?, ?, ?, ?, ?)'),
    addSession: db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    dropExpired: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    getSave: db.prepare('SELECT data, saved_at FROM saves WHERE user_id = ?'),
    putSave: db.prepare(`INSERT INTO saves (user_id, data, saved_at, updated) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, updated = excluded.updated`),
  };

  const ipOf = req => (trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  function limited(req) {                                  // fixed window per IP; the map is pruned when it grows
    const ip = ipOf(req), now = Date.now(), a = attempts.get(ip);
    if (attempts.size > 5000) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
    if (!a || a.reset < now) { attempts.set(ip, {n: 1, reset: now + AUTH_LIMIT.windowMs}); return false; }
    return ++a.n > AUTH_LIMIT.max;
  }
  const tokenOf = req => {
    for (const part of String(req.headers.cookie ?? '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === COOKIE) return v.join('=');
    }
    return null;
  };
  const cookie = (token, maxAgeSec) => `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${cookieSecure ? '; Secure' : ''}`;
  const userOf = req => { const t = tokenOf(req); return t ? q.session.get(sha256(t), Date.now()) ?? null : null; };
  function startSession(res, userId) {
    const token = randomBytes(32).toString('base64url');
    q.addSession.run(sha256(token), userId, Date.now() + SESSION_MS);
    res.setHeader('Set-Cookie', cookie(token, SESSION_MS / 1000));
  }

  async function body(req) {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'Нужен JSON');
    const chunks = []; let size = 0;
    for await (const c of req) { if ((size += c.length) > MAX_BODY) throw new HttpError(413, 'Слишком большой запрос'); chunks.push(c); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Неверный JSON'); }
  }
  function credentials(b) {
    const name = typeof b?.name === 'string' ? b.name.trim() : '', password = b?.password;
    if (!NAME_RE.test(name)) throw new HttpError(400, 'Имя: 3–24 символа, буквы, цифры, _ или -');
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw new HttpError(400, 'Пароль: от 6 до 128 символов');
    return {name, password};
  }

  const routes = {
    'GET /api/health': () => [200, {ok: true}],
    'POST /api/register': async (req, res) => {
      if (limited(req)) throw new HttpError(429, 'Слишком много попыток. Подожди 15 минут');
      const {name, password} = credentials(await body(req));
      if (q.userByName.get(nameKey(name))) throw new HttpError(409, 'Это имя уже занято');
      const salt = randomBytes(16), hash = await hashPassword(password, salt);
      let id;
      try { id = Number(q.addUser.run(name, nameKey(name), salt, hash, Date.now()).lastInsertRowid); }
      catch { throw new HttpError(409, 'Это имя уже занято'); }      // two registrations racing for one name
      startSession(res, id);
      return [201, {name}];
    },
    'POST /api/login': async (req, res) => {
      if (limited(req)) throw new HttpError(429, 'Слишком много попыток. Подожди 15 минут');
      const b = await body(req), name = typeof b?.name === 'string' ? b.name.trim() : '', password = typeof b?.password === 'string' ? b.password : '';
      const u = name && name.length <= 24 ? q.userByName.get(nameKey(name)) : null;
      const hash = await hashPassword(password.slice(0, 128), u ? u.salt : DUMMY_SALT);
      if (!u || !timingSafeEqual(hash, Buffer.from(u.hash))) throw new HttpError(401, 'Неверное имя или пароль');
      startSession(res, u.id);
      return [200, {name: u.name}];
    },
    'POST /api/logout': (req, res) => {
      const t = tokenOf(req);
      if (t) q.dropSession.run(sha256(t));
      res.setHeader('Set-Cookie', cookie('', 0));
      return [200, {ok: true}];
    },
    'GET /api/me': req => [200, {name: userOf(req)?.name ?? null}],                                // a guest is not an error (no red line in the console)
    'GET /api/save': req => {
      const u = userOf(req); if (!u) throw new HttpError(401, 'Не выполнен вход');
      const row = q.getSave.get(u.id);
      return [200, row ? {data: JSON.parse(row.data), savedAt: row.saved_at} : {data: null, savedAt: 0}];
    },
    'PUT /api/save': async req => {
      const u = userOf(req); if (!u) throw new HttpError(401, 'Не выполнен вход');
      const data = (await body(req))?.data;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isFinite(data.v)) throw new HttpError(400, 'Это не сохранение игры');
      const savedAt = Number.isFinite(data.savedAt) ? Math.floor(data.savedAt) : 0, row = q.getSave.get(u.id);
      if (row && row.saved_at > savedAt) return [409, {error: 'На сервере прогресс новее', savedAt: row.saved_at}];   // a stale tab never overwrites newer progress
      q.putSave.run(u.id, JSON.stringify(data), savedAt, Date.now());
      return [200, {savedAt}];
    },
  };

  async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, {error: 'Метод не поддерживается'});
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, {error: 'Неверный адрес'}); }
    let file = resolve(root, '.' + (rel.endsWith('/') ? rel + 'index.html' : rel));
    if (file !== root && !file.startsWith(root + sep)) return send(res, 403, {error: 'Запрещено'});   // no ../ escapes
    let st = await stat(file).catch(() => null);
    if (st?.isDirectory()) { file = join(file, 'index.html'); st = await stat(file).catch(() => null); }
    if (!st?.isFile()) {
      if (extname(rel)) return send(res, 404, {error: 'Не найдено'});
      file = join(root, 'index.html'); st = await stat(file).catch(() => null);                  // unknown page → the game
      if (!st) return send(res, 404, {error: 'Игра не собрана: нет dist-server/index.html (npm run build:server)'});
    }
    const immutable = file.includes(`${sep}assets${sep}`);                                         // Vite file names carry a content hash
    res.writeHead(200, {...SECURITY_HEADERS, 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  }

  function send(res, status, obj) {
    if (res.headersSent) return res.end();
    const text = JSON.stringify(obj);
    res.writeHead(status, {...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text)});
    res.end(text);
  }

  const server = createServer(async (req, res) => {
    const {pathname} = new URL(req.url, 'http://x');
    try {
      if (!pathname.startsWith('/api/')) return await serveStatic(req, res, pathname);
      const route = routes[`${req.method} ${pathname}`];
      if (!route) return send(res, 404, {error: 'Нет такого API'});
      const [status, obj] = await route(req, res);
      send(res, status, obj);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, {error: e.message});
      console.error('[cyberforge]', req.method, pathname, e?.message);                            // never logs bodies or passwords
      send(res, 500, {error: 'Ошибка сервера'});
    }
  });
  const sweep = setInterval(() => q.dropExpired.run(Date.now()), 6 * 3600 * 1000);
  sweep.unref();
  q.dropExpired.run(Date.now());
  server.on('close', () => { clearInterval(sweep); try { db.close(); } catch { /* already closed */ } });
  return {server, db};
}

// `node server/server.mjs` — settings come from the environment (see server/README-ru.md).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const env = process.env, port = Number(env.PORT) || 8080, host = env.HOST || '0.0.0.0';
  const {server} = createApp({
    dbPath: env.DB_PATH || resolve(HERE, '../data/cyberforge.db'),
    staticDir: env.STATIC_DIR || resolve(HERE, '../dist-server'),
    cookieSecure: env.COOKIE_SECURE === '1', trustProxy: env.TRUST_PROXY === '1',
  });
  server.listen(port, host, () => console.log(`[cyberforge] http://${host}:${port}`));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
}

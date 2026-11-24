// Online layer for the Vercel deployment: profile sync, a global Top-50 and async PvP matchmaking.
// Storage: Upstash Redis / Vercel KV over REST when KV_REST_API_URL + KV_REST_API_TOKEN are set, otherwise memory
// (shortcut: the memory store lives per serverless instance, so it is only for local runs and previews).
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

const PID_RE = /^[A-Za-z0-9-]{8,64}$/;
const NAME_RE = /^[\p{L}\p{N}_ -]{3,24}$/u;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

export function cleanName(name) {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!NAME_RE.test(n)) throw new HttpError(400, 'Ник: 3–24 символа, буквы, цифры, пробел, _ или -');
  return n;
}
const item = v => v && str(v.n, 32) && int(v.r, 1, 5) ? {n: v.n, r: v.r} : null;
function cleanArt(a) {
  if (!a || typeof a !== 'object') return null;
  const el = item(a.el), wp = item(a.wp), pk = item(a.pk);
  if (!el || !wp || !pk || !/^\d{3}$/.test(a.idx ?? '') || !str(a.loc, 12)) return null;
  return {loc: a.loc, el, wp, pk, idx: a.idx, tier: int(a.tier, 0, 5) ? a.tier : 0, power: int(a.power, 0, 1e9) ? a.power : 0};
}

/** Validates a client profile. Everything is bounded: a broken or hostile client cannot store junk. */
export function cleanProfile(b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Пустой профиль');
  if (!PID_RE.test(b.pid ?? '')) throw new HttpError(400, 'Неверный id игрока');
  if (!int(b.trophies, 0, 100000)) throw new HttpError(400, 'Неверные кубки');
  if (!int(b.power, 0, 1e9)) throw new HttpError(400, 'Неверная мощь');
  const squad = (Array.isArray(b.squad) ? b.squad.slice(0, 10) : []).map(cleanArt).filter(Boolean).slice(0, 3);   // bounded work, up to 3 valid
  return {pid: b.pid, name: cleanName(b.name), trophies: b.trophies, power: b.power, strike: int(b.strike, 0, 50) ? b.strike : 0, squad, at: Date.now()};
}

/* ---------- stores ---------- */

export function memoryStore() {
  const kv = new Map(), z = new Map();
  const zs = key => [...(z.get(key) ?? new Map())].map(([member, score]) => ({member, score}));
  return {
    async get(k) { return kv.get(k) ?? null; },
    async set(k, v) { kv.set(k, v); },
    async mget(keys) { return keys.map(k => kv.get(k) ?? null); },
    async zadd(k, score, member) { if (!z.has(k)) z.set(k, new Map()); z.get(k).set(member, score); },
    async ztop(k, n) { return zs(k).sort((a, b) => b.score - a.score).slice(0, n); },
    async zrange(k, lo, hi, n) { return zs(k).filter(x => x.score >= lo && x.score <= hi).sort((a, b) => a.score - b.score).slice(0, n); },
  };
}

export function redisStore(url, token) {
  const cmd = async (...args) => {
    const r = await fetch(url, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(args)});
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error ?? `redis ${r.status}`);
    return j.result;
  };
  const pairs = flat => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push({member: flat[i], score: Number(flat[i + 1])}); return out; };
  return {
    async get(k) { const v = await cmd('GET', k); return v == null ? null : JSON.parse(v); },
    async set(k, v) { await cmd('SET', k, JSON.stringify(v)); },
    async mget(keys) { return keys.length ? (await cmd('MGET', ...keys)).map(v => v == null ? null : JSON.parse(v)) : []; },
    async zadd(k, score, member) { await cmd('ZADD', k, score, member); },
    async ztop(k, n) { return pairs(await cmd('ZRANGE', k, 0, n - 1, 'REV', 'WITHSCORES')); },
    async zrange(k, lo, hi, n) { return pairs(await cmd('ZRANGE', k, lo, hi, 'BYSCORE', 'LIMIT', 0, n, 'WITHSCORES')); },
  };
}

let cached = null;
export function storeFromEnv(env = process.env) {
  if (cached) return cached;
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL, token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  cached = url && token ? redisStore(url, token) : memoryStore();
  cached.kind = url && token ? 'redis' : 'memory';
  return cached;
}

/* ---------- handlers ---------- */

export async function sync(store, body) {
  const p = cleanProfile(body), old = await store.get(`p:${p.pid}`);
  await store.set(`p:${p.pid}`, {...p, name: old?.name ?? p.name});     // a nickname changed via /leaderboard wins over the client copy
  await store.zadd('lb', p.trophies, p.pid);
  return {ok: true};
}

export async function top(store, n = 50) {
  const rows = await store.ztop('lb', n), profiles = await store.mget(rows.map(r => `p:${r.member}`));
  return {top: rows.map((r, i) => ({rank: i + 1, pid: r.member.slice(0, 8), name: profiles[i]?.name ?? '—', trophies: r.score}))};
}

export async function rename(store, body) {
  if (!PID_RE.test(body?.pid ?? '')) throw new HttpError(400, 'Неверный id игрока');
  const name = cleanName(body.name), p = await store.get(`p:${body.pid}`);
  if (!p) throw new HttpError(404, 'Сначала сыграй хотя бы одну ковку');
  await store.set(`p:${body.pid}`, {...p, name});
  return {ok: true, name};
}

/** A real player near your rating, with a squad; null when nobody fits (the client falls back to its bots). */
export async function findOpponent(store, {pid, trophies}, rng = Math.random) {
  const t = Number(trophies);
  if (!PID_RE.test(pid ?? '') || !Number.isFinite(t) || t < 0) throw new HttpError(400, 'Нужны pid и trophies');
  for (const span of [150, 400, 1200]) {
    const near = (await store.zrange('lb', Math.max(0, t - span), t + span, 40)).filter(r => r.member !== pid);
    if (!near.length) continue;
    const pick = near[Math.floor(rng() * near.length)], p = await store.get(`p:${pick.member}`);
    if (p && p.power > 0) return {opponent: {name: p.name, trophies: p.trophies, power: p.power, strike: p.strike, squad: p.squad}};
  }
  return {opponent: null};
}

/** Shared wrapper for the three Vercel functions: CORS for the Yandex Games iframe, JSON in and out, errors as JSON. */
export function handler(routes) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');                // no cookies: the player id travels in the body
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).end();
    const route = routes[req.method];
    if (!route) return res.status(405).json({error: 'Метод не поддерживается'});
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      res.status(200).json(await route(storeFromEnv(), {body, query: req.query ?? {}}));
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({error: e.message});
      if (e instanceof SyntaxError) return res.status(400).json({error: 'Неверный JSON'});
      console.error('[api]', e?.message);
      res.status(500).json({error: 'Ошибка сервера'});
    }
  };
}

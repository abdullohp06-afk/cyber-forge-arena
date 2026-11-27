// Online features of the Vercel build (VITE_ONLINE=on): profile sync, global Top-50, real PvP opponents.
// Every call has a short timeout and returns null on any failure, so the game always falls back to its bots offline.
import {squad, squadPower} from '../engine/arena.js';

export const ONLINE = import.meta.env?.VITE_ONLINE === 'on';
const BASE = import.meta.env?.VITE_API_BASE ?? '';        // empty = same origin (Vercel); set for the Yandex build to reach Vercel
const store = {get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } }};

export function playerId() {
  let id = store.get('cf_pid');
  if (!id) { id = crypto.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; store.set('cf_pid', id); }
  return id;
}
export const nickname = () => store.get('cf_nick') || `Кузнец-${playerId().slice(0, 4).toUpperCase()}`;

async function call(path, {method = 'GET', body} = {}) {
  if (!ONLINE || !/^https?:$/.test(location.protocol)) return null;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3500);
  try {
    const r = await fetch(BASE + path, {method, signal: ctl.signal, headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    const j = await r.json().catch(() => null);
    return r.ok ? j : {error: j?.error ?? `Ошибка ${r.status}`};
  } catch { return null; } finally { clearTimeout(timer); }
}

const artOut = a => ({loc: a.loc, el: a.el, wp: a.wp, pk: a.pk, idx: a.idx, tier: a.tier, power: a.power});
let timer = 0, lastSent = '';
/** Debounced profile upload after saves; skipped when nothing that matters online has changed. */
export function syncProfile(S) {
  if (!ONLINE) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const body = {pid: playerId(), name: nickname(), trophies: S.trophies, power: squadPower(S.arsenal), strike: S.up.strike, squad: squad(S.arsenal).map(artOut)};
    const key = JSON.stringify([body.trophies, body.power, body.name]);
    if (key === lastSent || !body.power) return;
    lastSent = key;
    call('/api/sync', {method: 'POST', body});
  }, 4000);
}

export const fetchTop = () => call('/api/leaderboard');
export const fetchOpponent = trophies => call(`/api/arena?pid=${encodeURIComponent(playerId())}&trophies=${trophies}`);
export async function renameOnline(name) {
  const r = await call('/api/leaderboard', {method: 'POST', body: {pid: playerId(), name}});
  if (r?.ok) { store.set('cf_nick', r.name); lastSent = ''; }
  return r;
}

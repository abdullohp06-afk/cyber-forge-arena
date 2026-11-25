// Save game: one JSON blob in localStorage, versioned so future updates can migrate old saves.
import {SAVE_KEY, SAVE_VERSION, CONTRACTS} from '../config/gameData.js';
import {sanitizeDex} from '../engine/collection.js';
import {sanitizeAch} from '../engine/achievements.js';

export const fresh = () => ({
  v: SAVE_VERSION, credits: 0, trophies: 0, streak: 0, season: 1,
  loc: 'neo', unlocked: ['neo'],
  up: {mult: 0, luck: 0, reactor: 0, auto: 0, strike: 0},
  arsenal: [], nextId: 1, contracts: [],
  bots: null, botsLeague: -1, smugglerAt: 0, muted: false,
  gyro: {spins: 0, wagered: 0, returned: 0, best: 0, hits3: 0, hits5: 0},   // Гиро-Реактор spin stats (prizes pay out at once, nothing is held)
  dex: {}, dexFilled: false,                                           // Каталог находок: "loc:slot:name" → best rank; filled once from old saves
  ach: {claimed: [], seen: []},                                        // Достижения: claimed rewards, and the ones already announced
  boxes: {standard: 0, military: 0, titanium: 0},                      // free containers won from achievements
  tut: 0,                                                              // onboarding step (99 = done)
  stats: {forges: 0, rerolls: 0, overdrives: 0, duels: 0, wins: 0, losses: 0, credits: 0,
          tiers: [0, 0, 0, 0, 0, 0], tags: {}, best: null, maxCombo: 0, tempers: 0, temperStreak: 0, temperBest: 0, maxStreak: 0},
});
const count = v => Number.isInteger(v) && v >= 0 ? v : 0;

// MIGRATIONS[n] turns a version-n save into version n+1. Add one here whenever SAVE_VERSION goes up.
const MIGRATIONS = {};

export function load(storage = globalThis.localStorage) {
  try {
    let s = JSON.parse(storage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      for (let v = s.v ?? 0; v < SAVE_VERSION; v++) s = {...(MIGRATIONS[v]?.(s) ?? s), v: v + 1};
      const f = fresh();
      const g = {...f.gyro, ...(s.gyro && typeof s.gyro === 'object' ? s.gyro : {})};   // saves from before the Гиро-Реактор have none
      for (const k of ['spins', 'wagered', 'returned', 'best', 'hits3', 'hits5']) if (!Number.isFinite(g[k]) || g[k] < 0) g[k] = 0;
      delete g.charge;                                                   // prizes used to wait for the next forge; they are paid on the spot now
      const b = s.boxes && typeof s.boxes === 'object' ? s.boxes : {};
      return {...f, ...s, up: {...f.up, ...s.up}, stats: {...f.stats, ...s.stats}, gyro: g,
              dex: sanitizeDex(s.dex), dexFilled: s.dexFilled === true, ach: sanitizeAch(s.ach),
              boxes: {standard: count(b.standard), military: count(b.military), titanium: count(b.titanium)},
              tut: Number.isInteger(s.tut) ? s.tut : (s.stats?.forges > 0 ? 99 : 0)};   // players from before onboarding skip it
    }
  } catch { /* private mode or a broken save: start over rather than crash */ }
  return fresh();
}

export function save(state, storage = globalThis.localStorage) {
  state.savedAt = Date.now();                                          // cloud sync: the newer copy wins across devices
  try { storage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep playing */ }
}

export function newContract(exclude, rng = Math.random) {
  const pool = CONTRACTS.filter(c => !exclude.includes(c.k));
  const c = pool[Math.floor(rng() * pool.length)], n = c.n[Math.floor(rng() * c.n.length)];
  return {k: c.k, n, p: 0, reward: c.r(n)};
}

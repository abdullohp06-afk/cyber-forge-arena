// Достижения: progress, claiming and the permanent bonuses they grant. Pure functions over the save, no DOM.
import {ACHIEVEMENTS, DEX_BONUS} from '../config/achievements.js';
import {dexProgress, indexProgress} from './collection.js';

const IDS = new Set(ACHIEVEMENTS.map(a => a.id));
const extra = S => { const d = dexProgress(S.dex); return {dex: d.found, dexTotal: d.total, idx: indexProgress(S.stats.tags).found}; };

/** Every achievement with its current value, whether it's ready to claim and whether it's already claimed. */
export function achStatus(S) {
  const x = extra(S), claimed = new Set(S.ach.claimed);
  return ACHIEVEMENTS.map(a => {
    const value = a.v(S, x);
    return {...a, value, ready: value >= a.goal, claimed: claimed.has(a.id), pct: Math.min(1, value / a.goal)};
  });
}
export const readyToClaim = S => achStatus(S).filter(a => a.ready && !a.claimed);

/** Marks one ready achievement as claimed and returns its reward (the caller pays credits and boxes). */
export function claimAch(S, id) {
  const a = achStatus(S).find(x => x.id === id);
  if (!a || !a.ready || a.claimed) return null;
  S.ach.claimed.push(id);
  return a.reward;
}

/** Permanent bonuses: claimed rewards plus +5% craft power per 10 Каталог finds. */
export function bonuses(S) {
  const claimed = new Set(S.ach.claimed);
  let craft = Math.floor(extra(S).dex / DEX_BONUS.per) * DEX_BONUS.craft, arena = 0;
  for (const a of ACHIEVEMENTS) if (claimed.has(a.id)) { craft += a.reward.craft ?? 0; arena += a.reward.arena ?? 0; }
  return {craft: Math.round(craft * 1000) / 1000, arena: Math.round(arena * 1000) / 1000};
}

/** Saves keep only known, unique ids. */
export function sanitizeAch(a) {
  const ids = v => Array.isArray(v) ? [...new Set(v.filter(id => IDS.has(id)))] : [];
  return {claimed: ids(a?.claimed), seen: ids(a?.seen)};
}

// Forge: 4 slots [Element] + [Weapon] + [Perk] + [Index 001–999] → score, rarity, power. Pure functions, no DOM.
import {RANK_WEIGHTS, MYTHIC_CHANCE, LOCATIONS, TIERS, ROMAN, CREDIT_RATE, OVERDRIVE, REROLL} from '../config/gameData.js';

export const SLOTS = ['el', 'wp', 'pk', 'idx'];
export const SLOT_NAMES = {el: 'Стихия', wp: 'Оружие', pk: 'Перк', idx: 'Индекс'};
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
export const locById = id => LOCATIONS.find(l => l.id === id);

function rollRank(rng) {
  let x = rng() * 100;
  for (let i = 0; i < RANK_WEIGHTS.length; i++) if ((x -= RANK_WEIGHTS[i]) < 0) return i + 1;
  return RANK_WEIGHTS.length;
}

export function rollSlot(slot, loc, rng = Math.random) {
  if (slot === 'idx') return String(1 + Math.floor(rng() * 999)).padStart(3, '0');   // 000 is never issued
  if (slot === 'pk' && rng() < MYTHIC_CHANCE) return {n: pick(loc.mythic, rng), r: 5};
  const pool = slot === 'el' ? loc.elements : slot === 'wp' ? loc.weapons : loc.perks;
  return {n: pick(pool, rng), r: rollRank(rng)};
}

/** New artifact. With `locks` and `prev`, locked slots are copied from `prev` (LOCK + RE-ROLL). */
export function forge(locId, rng = Math.random, locks = null, prev = null) {
  const loc = locById(prev ? prev.loc : locId), a = {loc: loc.id};
  for (const s of SLOTS) a[s] = locks?.[s] && prev ? prev[s] : rollSlot(s, loc, rng);
  return a;
}

export function evaluate(a) {
  const tags = [], tag = (id, label) => tags.push({id, label});
  const ranks = [a.el.r, a.wp.r, a.pk.r];
  const items = ranks.reduce((t, r) => t + (r === 5 ? 30 : r * r), 0);

  let res = 0;                                   // rank resonance between the three item slots
  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) { res = 10 * ranks[0]; tag('res3', `Резонанс ранга ${ROMAN[ranks[0]]}`); }
  else {
    const pair = ranks.find((r, i) => ranks.indexOf(r) !== i);
    if (pair) { res = 2 * pair; tag('res2', 'Пара рангов'); }
  }
  if (a.pk.r === 5) tag('mythic', 'Мифический перк');

  const d = a.idx, [x, y, z] = d.split('').map(Number);
  let ip = 0, jackpot = false;
  if (d === '777') { ip = 150; jackpot = true; tag('j777', 'Джекпот 777'); }
  else if (d === '001') { ip = 120; jackpot = true; tag('j001', 'Джекпот 001'); }
  else if (d === '999') { ip = 120; jackpot = true; tag('j999', 'Джекпот 999'); }
  else if (x === y && y === z) { ip = 60; tag('triple', 'Тройка'); }
  else if (x === 0 && y === 0) { ip = 45; tag('first10', 'Первая десятка'); }
  else if ((y - x === 1 && z - y === 1) || (x - y === 1 && y - z === 1)) { ip = 20; tag('ladder', 'Лесенка'); }
  else if (y === 0 && z === 0) { ip = 15; tag('round', 'Круглый'); }
  else if (x === z) { ip = 6; tag('mirror', 'Зеркало'); }
  else if (x === y || y === z) { ip = 3; tag('pair', 'Пара цифр'); }

  let score = items + res + ip;
  // Double overpower: a top index together with a mythic perk or a rank III+ resonance.
  if ((jackpot || ip >= 60) && (a.pk.r === 5 || res >= 30)) { score *= 2; tag('super', 'Двойная сверхмощь ×2'); }
  const tier = TIERS.reduce((t, x, i) => score >= x.min ? i : t, 0);
  return {score, tier, tags, power: Math.round(score * locById(a.loc).mult)};
}

/** Luck: forge `n` variants (same locks) and keep the best one. */
export function bestOf(locId, n, rng = Math.random, locks = null, prev = null) {
  let best = null;
  for (let i = 0; i < Math.max(1, n); i++) {
    const a = forge(locId, rng, locks, prev), e = evaluate(a);
    if (!best || e.score > best.e.score) best = {a, e};
  }
  return best;
}

export function forgeCredits(score, {locMult = 1, multLvl = 0, combo = 1, overdrive = false} = {}) {
  return Math.max(1, Math.round(score * CREDIT_RATE * locMult * (1 + 0.3 * multLvl) * combo * (overdrive ? OVERDRIVE.credits : 1)));
}
export const rerollCost = (locMult, lockCount) => Math.round(REROLL.base * locMult * (1 + REROLL.perLock * lockCount));
export const comboMult = (streak, cfg) => 1 + Math.min(streak, cfg.maxStreak) * cfg.step;
export const upgradeCost = (u, lvl) => Math.round(u.base * u.k ** lvl);
export const sellPrice = art => Math.max(1, Math.round(art.power * 2));
export const slotLabel = v => typeof v === 'string' ? '#' + v : `${v.n} ${ROMAN[v.r]}`;

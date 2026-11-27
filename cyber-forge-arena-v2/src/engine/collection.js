// Каталог находок: every named element / weapon / perk the player has forged, with the best rank seen. Pure functions, no DOM.
import {LOCATIONS, INDEX_TAGS} from '../config/gameData.js';

export const dexKey = (loc, slot, name) => `${loc}:${slot}:${name}`;
const DEX_SLOTS = ['el', 'wp', 'pk'];

/** Per location: 6 elements, 6 weapons, 6 perks and 3 mythic perks. Names come straight from LOCATIONS. */
export function catalog(locs = LOCATIONS) {
  return locs.map(l => ({
    loc: l.id, name: l.name, hue: l.hue,
    groups: [
      {slot: 'el', title: 'Стихии', items: l.elements.map(n => ({n, key: dexKey(l.id, 'el', n)}))},
      {slot: 'wp', title: 'Оружие', items: l.weapons.map(n => ({n, key: dexKey(l.id, 'wp', n)}))},
      {slot: 'pk', title: 'Перки', items: [...l.perks.map(n => ({n, key: dexKey(l.id, 'pk', n)})),
                                           ...l.mythic.map(n => ({n, key: dexKey(l.id, 'pk', n), mythic: true}))]},
    ],
  }));
}
const allKeys = (cat = catalog()) => cat.flatMap(l => l.groups.flatMap(g => g.items.map(i => i.key)));

/** Writes an artifact's three named slots into `dex`. Returns what changed: fresh = first time ever, else a better rank. */
export function record(dex, art) {
  const changes = [];
  for (const slot of DEX_SLOTS) {
    const item = art?.[slot];
    if (!item || typeof item !== 'object') continue;
    const key = dexKey(art.loc, slot, item.n), prev = dex[key] ?? 0;
    if (item.r > prev) { dex[key] = item.r; changes.push({key, n: item.n, fresh: prev === 0, rank: item.r}); }
  }
  return changes;
}

/** found / total for one location, or for the whole game when `locId` is omitted. */
export function dexProgress(dex, locId = null) {
  const cat = catalog().filter(l => !locId || l.loc === locId), keys = allKeys(cat);
  return {found: keys.filter(k => dex[k]).length, total: keys.length};
}

/** How many of the 13 index patterns / resonances the player has ever hit (from stats.tags, which old saves already have). */
export function indexProgress(tags) {
  return {found: INDEX_TAGS.filter(([id]) => tags?.[id] > 0).length, total: INDEX_TAGS.length};
}

/** One-off for saves from before the catalog: fill it from the Arsenal and the best artifact. Idempotent. */
export function backfill(S) {
  for (const a of S.arsenal) record(S.dex, a);
  if (S.stats.best) record(S.dex, S.stats.best);
  S.dexFilled = true;
}

/** A catalog loaded from a save keeps only well-formed entries: string key, integer rank 1–5. */
export function sanitizeDex(d) {
  const out = {};
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    for (const [k, v] of Object.entries(d)) if (Number.isInteger(v) && v >= 1 && v <= 5) out[k] = v;
  }
  return out;
}

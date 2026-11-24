import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCATIONS, INDEX_TAGS} from '../src/config/gameData.js';
import {catalog, dexKey, record, dexProgress, indexProgress, backfill, sanitizeDex} from '../src/engine/collection.js';
import {evaluate} from '../src/engine/forge.js';
import {load, save, fresh} from '../src/ui/state.js';

const it = (n, r) => ({n, r});
const TOTAL = LOCATIONS.length * 21;
const art = (loc, el, wp, pk, idx = '148') => ({loc, el, wp, pk, idx});

test('catalog is built from LOCATIONS: 21 names per location, 84 in total, keys unique', () => {
  const cat = catalog();
  assert.equal(cat.length, LOCATIONS.length);
  for (const l of cat) assert.equal(l.groups.reduce((t, g) => t + g.items.length, 0), 21, l.loc);
  const keys = cat.flatMap(l => l.groups.flatMap(g => g.items.map(i => i.key)));
  assert.equal(keys.length, TOTAL);
  assert.equal(new Set(keys).size, TOTAL);
  assert.equal(cat[0].groups[2].items.filter(i => i.mythic).length, 3);
});

test('record: first time is fresh, a better rank is not, a worse one changes nothing', () => {
  const dex = {};
  const a = art('neo', it('Неон', 2), it('Катана', 1), it('Взлом', 3));
  assert.deepEqual(record(dex, a).map(c => [c.n, c.fresh]), [['Неон', true], ['Катана', true], ['Взлом', true]]);
  assert.equal(dex[dexKey('neo', 'el', 'Неон')], 2);
  assert.deepEqual(record(dex, a), []);                                         // same artifact again
  const better = record(dex, art('neo', it('Неон', 4), it('Катана', 1), it('Взлом', 3)));
  assert.deepEqual(better.map(c => [c.n, c.fresh, c.rank]), [['Неон', false, 4]]);
  assert.deepEqual(record(dex, art('neo', it('Неон', 1), it('Катана', 1), it('Взлом', 1))), []);
  assert.equal(dex[dexKey('neo', 'el', 'Неон')], 4);                            // best rank is kept
  assert.deepEqual(record(dex, {loc: 'neo', idx: '1'}), []);                    // an artifact without items is harmless
});

test('progress counts only names that exist in the catalog', () => {
  const dex = {[dexKey('neo', 'el', 'Неон')]: 1, [dexKey('neo', 'pk', 'Код Сёгуна')]: 5, 'neo:el:Выдумка': 3};
  assert.deepEqual(dexProgress(dex), {found: 2, total: TOTAL});
  assert.deepEqual(dexProgress(dex, 'neo'), {found: 2, total: 21});
  assert.deepEqual(dexProgress(dex, 'abyss'), {found: 0, total: 21});
  assert.deepEqual(indexProgress({j777: 2, mirror: 5, nonsense: 9}), {found: 2, total: INDEX_TAGS.length});
});

test('every catalog index tag is a tag that evaluate() can really produce', () => {
  const made = new Set();
  const idxs = ['777', '001', '999', '444', '007', '345', '300', '525', '552'];
  const ranks = [[1, 2, 3], [2, 2, 1], [3, 3, 3], [1, 1, 5]];
  for (const idx of idxs) for (const r of ranks) evaluate(art('neo', it('a', r[0]), it('b', r[1]), it('c', r[2]), idx)).tags.forEach(t => made.add(t.id));
  for (const [id] of INDEX_TAGS) assert.ok(made.has(id), id);
});

test('backfill fills an old save from the Arsenal and the best artifact, once', () => {
  const s = fresh();
  s.arsenal = [{...art('neo', it('Ток', 3), it('Шокер', 2), it('Эхо', 2)), id: 1}];
  s.stats.best = {...art('abyss', it('Тень', 4), it('Коса', 3), it('Страх', 5)), score: 99};
  backfill(s);
  assert.equal(s.dexFilled, true);
  assert.deepEqual(dexProgress(s.dex), {found: 6, total: TOTAL});
  const before = JSON.stringify(s.dex);
  backfill(s);
  assert.equal(JSON.stringify(s.dex), before);                                  // idempotent
});

test('save: old saves get an empty catalog, broken entries are dropped, a real one survives a round trip', () => {
  const mem = new Map(), store = {getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v)};
  mem.set('cyberforge_v1', JSON.stringify({v: 1, credits: 9}));                  // from before the catalog
  assert.deepEqual([load(store).dex, load(store).dexFilled], [{}, false]);
  mem.set('cyberforge_v1', JSON.stringify({v: 1, dex: {'neo:el:Неон': 9, 'neo:wp:Катана': 2, x: 'y', z: 1.5}, dexFilled: 'yes'}));
  assert.deepEqual([load(store).dex, load(store).dexFilled], [{'neo:wp:Катана': 2}, false]);
  mem.set('cyberforge_v1', JSON.stringify({v: 1, dex: [1, 2, 3]}));
  assert.deepEqual(load(store).dex, {});
  const s = fresh(); record(s.dex, art('neo', it('Неон', 2), it('Катана', 1), it('Взлом', 3))); s.dexFilled = true;
  save(s, store);
  const back = load(store);
  assert.equal(back.dexFilled, true);
  assert.deepEqual(dexProgress(back.dex), {found: 3, total: TOTAL});
  assert.deepEqual(sanitizeDex(null), {});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS, ACH_CATS} from '../src/config/achievements.js';
import {achStatus, readyToClaim, claimAch, bonuses, sanitizeAch} from '../src/engine/achievements.js';
import {dexKey} from '../src/engine/collection.js';
import {fresh, load} from '../src/ui/state.js';

test('35+ achievements, unique ids, every category used, every reward is credits, a box or a bonus', () => {
  assert.ok(ACHIEVEMENTS.length >= 35, String(ACHIEVEMENTS.length));
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length);
  for (const c of ACH_CATS) assert.ok(ACHIEVEMENTS.some(a => a.cat === c.id), c.id);
  for (const a of ACHIEVEMENTS) {
    const r = a.reward, kinds = ['credits', 'box', 'craft', 'arena'].filter(k => k in r);
    assert.equal(kinds.length, 1, a.id);
    if (r.box) assert.ok(['standard', 'military', 'titanium'].includes(r.box), a.id);
    assert.ok(Number.isFinite(a.goal) && a.goal > 0, a.id);
  }
});

test('a fresh save has nothing to claim and evaluates without errors', () => {
  const s = fresh();
  assert.equal(achStatus(s).length, ACHIEVEMENTS.length);
  assert.deepEqual(readyToClaim(s), []);
  assert.deepEqual(bonuses(s), {craft: 0, arena: 0});
});

test('progress makes achievements ready; claiming pays once', () => {
  const s = fresh();
  s.stats.forges = 120; s.stats.wins = 10; s.stats.tags.j777 = 1;
  const ready = readyToClaim(s).map(a => a.id);
  for (const id of ['f10', 'f100', 'a1', 'a10', 'r_777']) assert.ok(ready.includes(id), id);
  assert.deepEqual(claimAch(s, 'f100'), {credits: 400});
  assert.equal(claimAch(s, 'f100'), null);                  // no double claim
  assert.equal(claimAch(s, 'f500'), null);                  // not reached yet
  assert.equal(claimAch(s, 'nope'), null);
  claimAch(s, 'a10');
  assert.deepEqual(bonuses(s), {craft: 0, arena: 0.05});
});

test('every 10 Каталог finds add +5% craft power', () => {
  const s = fresh(), names = ['Неон', 'Ток', 'Дождь', 'Хром', 'Пульс', 'Глитч', 'Катана', 'Шокер', 'Дрон', 'Хлыст', 'Рельса'];
  names.forEach((n, i) => { s.dex[dexKey('neo', i < 6 ? 'el' : 'wp', n)] = 1; });
  assert.equal(bonuses(s).craft, 0.05);
});

test('old saves load with empty achievements, a sane onboarding step and free-box counters', () => {
  const mem = new Map(), store = {getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v)};
  mem.set('cyberforge_v1', JSON.stringify({v: 1, stats: {forges: 40}}));
  const old = load(store);
  assert.deepEqual([old.ach, old.tut, old.boxes], [{claimed: [], seen: []}, 99, {standard: 0, military: 0, titanium: 0}]);
  mem.set('cyberforge_v1', JSON.stringify({v: 1, ach: {claimed: ['f10', 'f10', 'hack'], seen: 'x'}, boxes: {standard: -2, military: 3}, tut: 2}));
  const b = load(store);
  assert.deepEqual([b.ach, b.boxes, b.tut], [{claimed: ['f10'], seen: []}, {standard: 0, military: 3, titanium: 0}, 2]);
  assert.deepEqual(sanitizeAch(null), {claimed: [], seen: []});
});

test('«Забрать всё»: the bulk loop pays every ready award exactly once and empties the queue', () => {
  const s = fresh();
  s.stats.forges = 500; s.stats.rerolls = 60; s.gyro.spins = 40;        // enough progress for a batch of awards
  const ready = readyToClaim(s);
  assert.ok(ready.length >= 3, `expected a batch, got ${ready.length}`);

  let credits = 0, boxes = 0;                                          // the same loop ACTIONS.claimAll runs
  for (const a of ready) {
    const r = claimAch(s, a.id);
    assert.ok(r, `${a.id} should pay out`);
    credits += r.credits ?? 0;
    if (r.box) boxes++;
  }
  assert.ok(credits > 0 || boxes > 0);
  assert.equal(readyToClaim(s).length, 0);                             // nothing is left to claim
  assert.equal(new Set(s.ach.claimed).size, s.ach.claimed.length);      // and nothing was claimed twice
  for (const a of ready) assert.equal(claimAch(s, a.id), null);         // a second pass pays nothing
});

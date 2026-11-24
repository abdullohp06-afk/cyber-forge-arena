import test from 'node:test';
import assert from 'node:assert/strict';
import {GYRO} from '../src/config/gameData.js';
import {minBet, betFor, spinIndex, sectorOf, makeCharge, applyCharge, chargeSplit, odds, expectedReturn, sanitizeCharge} from '../src/engine/gyro.js';
import {load, save, fresh} from '../src/ui/state.js';
import {mulberry32} from './rng.js';

test('stake: share of credits, never below the minimum, 0 when the minimum is out of reach', () => {
  assert.equal(minBet(1), 20);
  assert.equal(minBet(2.5), 50);
  assert.equal(betFor(1000, 0.25), 250);
  assert.equal(betFor(100, 0.1), 20);             // 10 → raised to the minimum
  assert.equal(betFor(19, 0.5), 0);               // can't afford the minimum
  assert.equal(betFor(40, 0.5, 2.5), 0);          // the minimum scales with the location
  for (const c of [20, 37, 999, 123456]) for (const s of GYRO.shares) assert.ok(betFor(c, s) <= c, `${c} × ${s}`);
});

test('wheel odds match the design and the expected payout stays just under the stake', () => {
  assert.equal(GYRO.wheel.reduce((t, x) => t + x.w, 0), 100);
  assert.deepEqual(odds().map(o => Math.round(o.p)), [64, 24, 8, 3, 1]);
  const ev = expectedReturn();
  assert.ok(ev > 0.95 && ev < 1, `EV ${ev}`);     // no credit printer, but not a trap either
});

test('weighted spin lands sectors at their odds', () => {
  const rng = mulberry32(7), n = 200000, hits = GYRO.sectors.map(() => 0);
  for (let i = 0; i < n; i++) hits[GYRO.wheel[spinIndex(rng)].s]++;
  odds().forEach((o, s) => assert.ok(Math.abs(hits[s] / n * 100 - o.p) < 0.4, `${o.n}: ${hits[s] / n * 100} vs ${o.p}`));
  assert.equal(spinIndex(() => 0), 0);
  assert.equal(spinIndex(() => 0.999999), GYRO.wheel.length - 1);
  assert.equal(sectorOf(GYRO.wheel.length - 1).m, 5);
});

test('charge on the next forge: payout returns, ×2+ also multiplies the forge credits', () => {
  assert.deepEqual(makeCharge(100, 0.5), {m: 0.5, stake: 100, payout: 50});
  assert.equal(applyCharge(10, makeCharge(100, 0.5)), 10 + 50);
  assert.equal(applyCharge(10, makeCharge(100, 1.5)), 10 + 150);
  assert.equal(applyCharge(10, makeCharge(100, 2)), 20 + 200);
  assert.equal(applyCharge(10, makeCharge(100, 5)), 50 + 500);
  for (const m of [0.5, 1.5, 2, 3, 5]) for (const g of [1, 7, 33]) {               // one calculation: the split always adds up to the total
    const ch = makeCharge(137, m), s = chargeSplit(g, ch);
    assert.equal(s.earned + s.payout, applyCharge(g, ch), `${m} ${g}`);
    assert.equal(s.payout, ch.payout);
  }
});

test('save: old saves get Гиро defaults, broken charges are dropped, a valid charge survives', () => {
  const mem = new Map(), store = {getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v)};
  mem.set('cyberforge_v1', JSON.stringify({v: 1, credits: 500}));                 // a save from before the feature
  assert.deepEqual(load(store).gyro, {charge: null, spins: 0, wagered: 0, returned: 0, best: 0, hits3: 0, hits5: 0});
  mem.set('cyberforge_v1', JSON.stringify({v: 1, gyro: {charge: {m: 7, stake: 1, payout: 1}, spins: -3, wagered: 'x'}}));
  assert.deepEqual(load(store).gyro, {charge: null, spins: 0, wagered: 0, returned: 0, best: 0, hits3: 0, hits5: 0});
  const s = fresh(); s.gyro.charge = {...makeCharge(240, 3), respun: false}; s.gyro.spins = 4;
  save(s, store);
  assert.deepEqual(load(store).gyro, {charge: {m: 3, stake: 240, payout: 720, respun: false}, spins: 4, wagered: 0, returned: 0, best: 0, hits3: 0, hits5: 0});
  assert.equal(sanitizeCharge({m: 2, stake: NaN, payout: 3}), null);
});

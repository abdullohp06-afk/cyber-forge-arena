import test from 'node:test';
import assert from 'node:assert/strict';
import {GYRO} from '../src/config/gameData.js';
import {minBet, betFor, spinIndex, sectorOf, prizeOf, odds, expectedReturn} from '../src/engine/gyro.js';
import {load, save, fresh} from '../src/ui/state.js';
import {mulberry32} from './rng.js';

const GYRO_STATS = {spins: 0, wagered: 0, returned: 0, best: 0, hits3: 0, hits5: 0};

test('stake: share of credits, never below the minimum, 0 when the minimum is out of reach', () => {
  assert.equal(minBet(1), 20);
  assert.equal(minBet(2.5), 50);
  assert.equal(betFor(1000, 0.25), 250);
  assert.equal(betFor(100, 0.1), 20);             // 10 → raised to the minimum
  assert.equal(betFor(19, 0.5), 0);               // can't afford the minimum
  assert.equal(betFor(40, 0.5, 2.5), 0);          // the minimum scales with the location
  for (const c of [20, 37, 999, 123456]) for (const s of GYRO.shares) assert.ok(betFor(c, s) <= c, `${c} × ${s}`);
});

test('wheel odds match the design and the credit payout stays just under the stake', () => {
  assert.equal(GYRO.wheel.reduce((t, x) => t + x.w, 0), 100);
  assert.deepEqual(odds().map(o => Math.round(o.p)), [48, 28, 10, 7, 6, 1]);
  const ev = expectedReturn();
  assert.ok(ev > 0.95 && ev < 1, `EV ${ev}`);     // no credit printer, but not a trap either
});

test('weighted spin lands sectors at their odds', () => {
  const rng = mulberry32(7), n = 200000, hits = GYRO.sectors.map(() => 0);
  for (let i = 0; i < n; i++) hits[GYRO.wheel[spinIndex(rng)].s]++;
  odds().forEach((o, s) => assert.ok(Math.abs(hits[s] / n * 100 - o.p) < 0.4, `${o.n}: ${hits[s] / n * 100} vs ${o.p}`));
  assert.equal(spinIndex(() => 0), 0);
  assert.equal(spinIndex(() => 0.999999), GYRO.wheel.length - 1);
  assert.equal(sectorOf(GYRO.wheel.length - 1).m, 7);                     // the jackpot is the last segment
});

test('prizes settle at once: credits scale with the stake, кейс and OVERDRIVE pay in kind', () => {
  const [cash, x15, x25, box, od, jack] = GYRO.sectors;
  assert.equal(prizeOf(cash, 100).credits, 50);
  assert.equal(prizeOf(x15, 100).credits, 150);
  assert.equal(prizeOf(x25, 100).credits, 250);
  assert.equal(prizeOf(jack, 100).credits, 700);
  const big = prizeOf(box, 5000);
  assert.deepEqual([big.kind, big.box, big.credits], ['box', 'standard', 0]);
  const over = prizeOf(od, 5000);
  assert.deepEqual([over.kind, over.od, over.credits], ['od', true, 0]);
  assert.equal(prizeOf(x25, 100).heat, GYRO.heat[2.5]);
  assert.equal(prizeOf(jack, 100).heat, GYRO.heat[7]);
  assert.equal(prizeOf(cash, 100).heat, 0);
});

test('a кейс won on a token stake pays credits instead, so min-bet spam cannot farm containers', () => {
  const box = GYRO.sectors.find(s => s.kind === 'box'), floor = minBet(1) * GYRO.boxMinStake;
  const small = prizeOf(box, floor - 1);
  assert.deepEqual([small.kind, small.box, small.credits], ['credits', null, (floor - 1) * 2]);
  assert.equal(prizeOf(box, floor).kind, 'box');                          // exactly at the floor the container is real
  const scaled = prizeOf(box, minBet(2.5) * GYRO.boxMinStake - 1, 2.5);   // the floor rises with the location
  assert.equal(scaled.kind, 'credits');
});

test('save: old saves get Гиро defaults, a stale pending charge is dropped', () => {
  const mem = new Map(), store = {getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v)};
  mem.set('cyberforge_v1', JSON.stringify({v: 1, credits: 500}));                 // a save from before the feature
  assert.deepEqual(load(store).gyro, GYRO_STATS);
  mem.set('cyberforge_v1', JSON.stringify({v: 1, gyro: {charge: {m: 7, stake: 1, payout: 1}, spins: -3, wagered: 'x'}}));
  assert.deepEqual(load(store).gyro, GYRO_STATS);                                 // the charge mechanic is gone, the key with it
  const s = fresh(); s.gyro.spins = 4; s.gyro.best = 7;
  save(s, store);
  assert.deepEqual(load(store).gyro, {...GYRO_STATS, spins: 4, best: 7});
});

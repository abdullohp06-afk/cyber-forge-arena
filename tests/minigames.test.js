import test from 'node:test';
import assert from 'node:assert/strict';
import {MINI, miniFee, miniPrize, rivalSkill, rivalReactionMs, reactWin, rivalTaps, tugPos, tugWin, aimScore, rivalAim, aimPos} from '../src/engine/minigames.js';
import {nearJackpot} from '../src/ui/gyroWheel.js';
import {GYRO} from '../src/config/gameData.js';

test('three mini-games, fee below prize, both scale with the location', () => {
  assert.equal(MINI.length, 3);
  assert.ok(miniFee(1) < miniPrize(1));
  assert.equal(miniPrize(40), miniPrize(1) * 40);
});

test('rival skill grows with trophies and stays in range', () => {
  const mid = () => 0.5;
  assert.ok(rivalSkill(3000, mid) > rivalSkill(0, mid));
  for (const t of [0, 100000]) for (const r of [() => 0, () => 0.999]) { const s = rivalSkill(t, r); assert.ok(s >= 0.1 && s <= 0.95); }
});

test('reaction: early tap loses, faster than the rival wins', () => {
  assert.equal(reactWin(null, 400), false);
  assert.equal(reactWin(250, 300), true);
  assert.equal(reactWin(320, 300), false);
  assert.ok(rivalReactionMs(0.9, () => 0) < rivalReactionMs(0.1, () => 0));
});

test('tug of war: position clamps, ties go to the rival', () => {
  assert.equal(tugPos(100, 0), 1);
  assert.equal(tugPos(0, 100), -1);
  assert.equal(tugWin(10, 10), false);
  assert.equal(tugWin(11, 10), true);
  assert.ok(rivalTaps(0.9, 6000, () => 0.5) > rivalTaps(0.1, 6000, () => 0.5));
});

test('aim: bullseye is 100, edges 0, marker stays on the track', () => {
  assert.equal(aimScore(0.5), 100);
  assert.equal(aimScore(0), 0);
  assert.equal(aimScore(1), 0);
  for (let t = 0; t < 5; t += 0.37) { const p = aimPos(t, 2); assert.ok(p >= 0 && p <= 1); }
  assert.ok(rivalAim(0.95, () => 0.999) <= 100);
});

test('gyro near-miss segments are the two neighbours of the ×5 sector', () => {
  const j = GYRO.wheel.findIndex(x => x.s === GYRO.sectors.length - 1), n = GYRO.wheel.length;
  const near = GYRO.wheel.map((_, i) => i).filter(nearJackpot);
  assert.deepEqual(near.sort(), [(j + 1) % n, (j - 1 + n) % n].sort());
});

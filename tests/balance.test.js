// Simulated active player → checks the pacing targets from the design brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bestOf, forgeCredits, comboMult, upgradeCost} from '../src/engine/forge.js';
import {squadPower, makeOpponent, tapPower} from '../src/engine/arena.js';
import {UPGRADES, COMBO, HEAT, OVERDRIVE, LOCATIONS, KEEP_TIER} from '../src/config/gameData.js';

import {mulberry32} from './rng.js';

// Active play: ~2 forges/s, a 2-second breather every 15 s, a duel attempt every 20 s once the squad exists.
function simulate(seed) {
  const rng = mulberry32(seed), dt = 0.5, up = {mult: 0, luck: 0, reactor: 0, auto: 0, strike: 0};
  let credits = 0, streak = 0, heat = 0, odUntil = -1, arsenal = [], firstUp = null, firstWin = null, loc2 = null;
  for (let step = 0; step * dt <= 600 && loc2 === null; step++) {
    const t = step * dt;
    if (t % 15 >= 13) { streak = 0; heat = Math.max(0, heat - HEAT.decayPerSec * dt); continue; }
    streak++;
    const od = t < odUntil, combo = comboMult(streak, COMBO);
    const r = bestOf('neo', 1 + up.luck + (od ? OVERDRIVE.luck : 0), rng);
    credits += forgeCredits(r.e.score, {multLvl: up.mult, combo, overdrive: od});
    if (r.e.tier >= KEEP_TIER) arsenal.push({power: r.e.power});
    if (!od && (heat += HEAT.perForge * (1 + 0.25 * up.reactor) * combo) >= HEAT.max) { heat = 0; odUntil = t + OVERDRIVE.ms / 1000; }
    // Spend on cheap upgrades early, then save for the next location.
    for (const id of ['mult', 'luck']) {
      const c = upgradeCost(UPGRADES[id], up[id]);
      if (c <= credits && c <= LOCATIONS[1].cost * 0.2) { credits -= c; up[id]++; firstUp ??= t; }
    }
    if (firstWin === null && step % 40 === 0 && arsenal.length) {
      const opp = makeOpponent(0, [], rng);
      if (squadPower(arsenal) + 50 * tapPower(up.strike) > opp.total) firstWin = t;   // ~5 taps/s for 10 s
    }
    if (credits >= LOCATIONS[1].cost) loc2 = t;
  }
  return {firstUp, firstWin, loc2};
}

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test('pacing: first upgrade 30–40 s, first arena win ~1.5 min, second location 3–4 min', () => {
  const runs = Array.from({length: 41}, (_, i) => simulate(i + 1));
  const m = {firstUp: median(runs.map(r => r.firstUp)), firstWin: median(runs.map(r => r.firstWin ?? 999)), loc2: median(runs.map(r => r.loc2 ?? 999))};
  console.log('median seconds', m);
  assert.ok(m.firstUp >= 30 && m.firstUp <= 40, `first upgrade at ${m.firstUp}s`);
  assert.ok(m.firstWin >= 75 && m.firstWin <= 110, `first win at ${m.firstWin}s`);
  assert.ok(m.loc2 >= 180 && m.loc2 <= 240, `second location at ${m.loc2}s`);
});

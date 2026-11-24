// Гиро-Реактор: credit stake → weighted wheel → a charge for the next manual forge. Pure functions, no DOM.
import {GYRO} from '../config/gameData.js';

export const minBet = locMult => Math.round(GYRO.minBet * locMult);

/** Stake for a share of the credits; never below the minimum, 0 when the player can't afford the minimum. */
export function betFor(credits, share, locMult = 1) {
  const min = minBet(locMult);
  return credits < min ? 0 : Math.max(min, Math.floor(credits * share));
}

/** Index into GYRO.wheel, chosen with the segment weights. */
export function spinIndex(rng = Math.random) {
  const total = GYRO.wheel.reduce((t, x) => t + x.w, 0);
  let x = rng() * total;
  for (let i = 0; i < GYRO.wheel.length; i++) if ((x -= GYRO.wheel[i].w) < 0) return i;
  return GYRO.wheel.length - 1;
}

export const sectorOf = i => GYRO.sectors[GYRO.wheel[i].s];
export const makeCharge = (stake, m) => ({m, stake, payout: Math.round(stake * m)});

/** Credits for the charged forge: ×2 and up also multiply the forge's own credits; the payout always comes back. */
export const applyCharge = (gain, ch) => { const s = chargeSplit(gain, ch); return s.earned + s.payout; };

/** The same credits split in two: `earned` counts for stats and contracts, `payout` is the stake coming back. */
export const chargeSplit = (gain, ch) => ({earned: Math.round(gain * (ch.m >= 2 ? ch.m : 1)), payout: ch.payout});

/** Sector odds in % (for the legend) and the expected payout per staked credit. */
export function odds() {
  const total = GYRO.wheel.reduce((t, x) => t + x.w, 0);
  return GYRO.sectors.map((s, i) => ({...s, p: GYRO.wheel.filter(x => x.s === i).reduce((t, x) => t + x.w, 0) / total * 100}));
}
export const expectedReturn = () => odds().reduce((t, s) => t + s.p / 100 * s.m, 0);

/** A charge loaded from a save is trusted only if it is well-formed. */
export function sanitizeCharge(c) {
  if (!c || typeof c !== 'object') return null;
  const ok = GYRO.sectors.some(s => s.m === c.m) && [c.stake, c.payout].every(n => Number.isFinite(n) && n >= 0);
  return ok ? {m: c.m, stake: Math.floor(c.stake), payout: Math.floor(c.payout), respun: c.respun === true} : null;   // respun: the one ad re-spin is used
}

// Гиро-Реактор: credit stake → weighted wheel → the prize is paid out at once. Pure functions, no DOM.
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

/**
 * What the spin actually hands over, settled immediately.
 * credits: paid into the balance · box: a free container id · od: start OVERDRIVE · heat: extra reactor %.
 * A кейс won on a token stake pays ×2 credits instead, so repeat min-bet spins can't farm containers.
 */
export function prizeOf(sector, stake, locMult = 1) {
  const kind = sector.kind ?? 'credits';
  if (kind === 'box' && stake < minBet(locMult) * GYRO.boxMinStake) {
    return {kind: 'credits', n: '×2 Кредиты', c: sector.c, m: 2, credits: stake * 2, box: null, od: false, heat: 0};
  }
  return {
    kind, n: sector.n, c: sector.c, m: sector.m,
    credits: Math.round(stake * sector.m),
    box: kind === 'box' ? sector.box : null,
    od: kind === 'od',
    heat: GYRO.heat[sector.m] ?? 0,
  };
}

/** Sector odds in % (for the legend) and the expected credit payout per staked credit. */
export function odds() {
  const total = GYRO.wheel.reduce((t, x) => t + x.w, 0);
  return GYRO.sectors.map((s, i) => ({...s, p: GYRO.wheel.filter(x => x.s === i).reduce((t, x) => t + x.w, 0) / total * 100}));
}
export const expectedReturn = () => odds().reduce((t, s) => t + s.p / 100 * s.m, 0);

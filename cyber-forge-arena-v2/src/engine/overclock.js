// Overclock Casino (+1..+10): escalating power with melt risk from +4 and Cryo-Shield insurance.
export const OVERCLOCK_TABLE = [
  {level: 1,  chance: 1.00, mult: 1.12, costMult: 0.45, risk: false},
  {level: 2,  chance: 1.00, mult: 1.26, costMult: 0.75, risk: false},
  {level: 3,  chance: 1.00, mult: 1.44, costMult: 1.20, risk: false},
  {level: 4,  chance: 0.84, mult: 1.70, costMult: 1.90, risk: true},
  {level: 5,  chance: 0.75, mult: 2.05, costMult: 2.90, risk: true},
  {level: 6,  chance: 0.66, mult: 2.50, costMult: 4.40, risk: true},
  {level: 7,  chance: 0.56, mult: 3.10, costMult: 6.80, risk: true},
  {level: 8,  chance: 0.45, mult: 3.90, costMult: 10.5, risk: true},
  {level: 9,  chance: 0.34, mult: 5.00, costMult: 16.0, risk: true},
  {level: 10, chance: 0.22, mult: 6.50, costMult: 25.0, risk: true},
];

export function nextOverclockInfo(item, factionBonus = 0) {
  const cur = item.oc || 0;
  if (cur >= 10) return null;
  const step = OVERCLOCK_TABLE[cur];
  const chance = Math.min(0.98, step.chance + factionBonus);
  const base = item.basePower || item.power || 50;
  return {
    cur,
    next: step.level,
    chance,
    chancePct: Math.round(chance * 100),
    meltPct: Math.round((1 - chance) * 100),
    cost: Math.max(40, Math.round(base * 2.2 * step.costMult)),
    cryoCost: Math.max(70, Math.round(base * 3.8 * step.costMult)),
    nextPower: Math.round(base * step.mult),
    risk: step.risk,
  };
}

export function attemptOverclock(item, state, {useCryo = false, freeCryo = false, factionBonus = 0} = {}) {
  const info = nextOverclockInfo(item, factionBonus);
  if (!info) return {status: 'MAX'};
  const totalCost = info.cost + (useCryo && !freeCryo && info.risk ? info.cryoCost : 0);
  if (state.credits < totalCost) return {status: 'NO_CREDITS', needed: totalCost};

  state.credits -= totalCost;
  if (!item.basePower) item.basePower = item.power;

  if (Math.random() <= info.chance) {
    item.oc = info.next;
    item.power = info.nextPower + (item.runeBonus || 0);
    state.stats.overclocks = (state.stats.overclocks || 0) + 1;
    return {status: 'SUCCESS', level: item.oc, power: item.power};
  }

  if (useCryo || !info.risk) {
    return {status: 'SAVED', level: item.oc || 0};
  }

  const scrap = Math.max(25, Math.round(item.power * 1.35));
  state.credits += scrap;
  state.arsenal = state.arsenal.filter(x => x.id !== item.id);
  return {status: 'MELTED', scrap};
}

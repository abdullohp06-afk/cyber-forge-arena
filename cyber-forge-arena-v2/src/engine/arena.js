// Arena: Top-3 squad, 10-second blitz duels, trophies, streaks, leagues and a local season leaderboard. Pure functions.
import {ARENA, LEAGUES, BOT_NAMES} from '../config/gameData.js';

export const leagueOf = trophies => LEAGUES.reduce((l, x, i) => trophies >= x.min ? i : l, 0);
export const squad = arsenal => [...arsenal].sort((a, b) => b.power - a.power).slice(0, 3);
export const squadPower = arsenal => squad(arsenal).reduce((t, a) => t + a.power, 0);
export const tapPower = strikeLvl => ARENA.tapBase + strikeLvl;

export function makeOpponent(trophies, bots, rng = Math.random) {
  const total = Math.round((ARENA.oppBase + ARENA.oppPerTrophy * trophies) * (1 + (rng() * 2 - 1) * ARENA.oppSpread));
  const bot = bots.length ? bots[Math.floor(rng() * bots.length)] : {name: 'Bot', t: trophies};
  return {name: bot.name, trophies: bot.t, total, start: Math.round(total * ARENA.oppStartShare), seed: rng() * 100};
}

/** A real player from the online base as a duel opponent: their squad power plus ~10 s of their taps. Same shape as a bot. */
export function opponentFromPlayer(p, rng = Math.random) {
  const total = Math.round(p.power + 55 * tapPower(p.strike ?? 0));
  return {name: p.name, trophies: p.trophies, total, start: Math.round(total * ARENA.oppStartShare), seed: rng() * 100, real: true};
}

/** Opponent bar at progress p∈[0,1]: starts at `start`, ends exactly at `total`, with bursts so it feels alive. */
export function opponentAt(opp, p) {
  p = Math.min(1, Math.max(0, p));
  const wobble = p < 1 ? 0.05 * Math.sin(p * 19 + opp.seed) * Math.sin(p * Math.PI) : 0;
  return Math.round(opp.start + (opp.total - opp.start) * Math.min(1, Math.max(0, p + wobble)));
}

/** Trophies, credits and streak after a finished duel. */
export function duelOutcome(playerTotal, opp, {trophies, streak, locMult = 1}) {
  const win = playerTotal > opp.total;
  if (win) {
    const bonus = Math.min(streak, ARENA.win.maxStreakBonus) * ARENA.win.perStreak;
    return {win, dTrophies: ARENA.win.trophies + bonus, streak: streak + 1,
            credits: Math.round((ARENA.win.credits + trophies * ARENA.win.creditsPerTrophy) * locMult)};
  }
  return {win, dTrophies: -Math.min(trophies, ARENA.loss.trophies), streak: 0, credits: Math.round(ARENA.loss.credits * locMult)};
}

/** 14 "live" rivals spread across the player's league band. */
export function makeBots(trophies, rng = Math.random) {
  const li = leagueOf(trophies), lo = LEAGUES[li].min, hi = LEAGUES[li + 1]?.min ?? lo + 1500;
  const names = [...BOT_NAMES].sort(() => rng() - 0.5).slice(0, 14);
  return names.map(name => ({name, t: Math.round(lo + rng() * (hi - lo) * 0.9)}));
}

/** Rivals keep playing between your duels: mostly small gains, sometimes a loss. */
export function tickBots(bots, rng = Math.random) {
  return bots.map(b => ({...b, t: Math.max(0, b.t + Math.round(rng() * 26 - 8))}));
}

export function leaderboard(bots, trophies, me = 'Ты') {
  return [...bots.map(b => ({name: b.name, t: b.t, me: false})), {name: me, t: trophies, me: true}]
    .sort((a, b) => b.t - a.t || (a.me ? -1 : 1))
    .slice(0, 15)
    .map((r, i) => ({...r, rank: i + 1}));
}

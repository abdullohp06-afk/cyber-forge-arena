import test from 'node:test';
import assert from 'node:assert/strict';
import {forge, evaluate, bestOf, rerollCost, forgeCredits} from '../src/engine/forge.js';
import {duelOutcome, opponentAt, leaderboard, leagueOf, squadPower, makeBots} from '../src/engine/arena.js';
import {load, save, fresh} from '../src/ui/state.js';
import {mulberry32} from './rng.js';

const item = (r, n = 'X') => ({n, r});
const art = (idx, ranks = [1, 2, 3], loc = 'neo') => ({loc, el: item(ranks[0]), wp: item(ranks[1]), pk: item(ranks[2]), idx});

test('index patterns score as designed', () => {
  const cases = [['777', 150, 'j777'], ['001', 120, 'j001'], ['999', 120, 'j999'], ['444', 60, 'triple'], ['007', 45, 'first10'],
                 ['345', 20, 'ladder'], ['876', 20, 'ladder'], ['300', 15, 'round'], ['525', 6, 'mirror'], ['552', 3, 'pair'], ['148', 0, null]];
  for (const [idx, ip, tag] of cases) {
    const e = evaluate(art(idx));                       // ranks 1,2,3 → items 1+4+9 = 14, no resonance
    assert.equal(e.score, 14 + ip, idx);
    if (tag) assert.ok(e.tags.some(t => t.id === tag), `${idx} → ${tag}`);
  }
});

test('rank resonance and double overpower', () => {
  assert.equal(evaluate(art('148', [3, 3, 3])).score, 27 + 30);                 // 9×3 + resonance III
  assert.equal(evaluate(art('148', [2, 2, 1])).score, 4 + 4 + 1 + 4);            // pair of rank II
  const jackpotMythic = art('777', [1, 1, 5]);                                   // mythic perk: 1+1+30, pair of I: +2
  assert.equal(evaluate(jackpotMythic).score, (32 + 2 + 150) * 2);
  assert.ok(evaluate(jackpotMythic).tags.some(t => t.id === 'super'));
  assert.equal(evaluate(art('777', [4, 4, 4])).tier, 5);                         // Мифический
  assert.equal(evaluate(art('148', [1, 2, 3], 'abyss')).power, Math.round(14 * 2.5));
});

test('LOCK + RE-ROLL keeps locked slots and rerolls the rest', () => {
  const rng = mulberry32(7), prev = art('777', [1, 1, 4]);
  for (let i = 0; i < 50; i++) {
    const next = forge('neo', rng, {idx: true, pk: true}, prev);
    assert.equal(next.idx, '777'); assert.deepEqual(next.pk, prev.pk);
  }
  const changed = Array.from({length: 50}, () => forge('neo', rng, {idx: true}, prev)).some(a => a.el.n !== prev.el.n || a.el.r !== prev.el.r);
  assert.ok(changed, 'unlocked slots must change');
  assert.equal(bestOf('neo', 20, rng, {idx: true}, prev).a.idx, '777');
  assert.ok(rerollCost(1, 2) > rerollCost(1, 1) && rerollCost(2.5, 1) > rerollCost(1, 1));
});

test('credits scale with combo, overdrive and location', () => {
  const base = forgeCredits(40);
  assert.ok(forgeCredits(40, {combo: 2}) >= base * 2 - 1);
  assert.ok(forgeCredits(40, {overdrive: true}) >= base * 3 - 1);
  assert.ok(forgeCredits(40, {locMult: 15}) > forgeCredits(40, {locMult: 2.5}));
  assert.equal(forgeCredits(0), 1);
});

test('duel outcome: trophies, streak bonus, no negative trophies', () => {
  const opp = {total: 300, start: 150, seed: 1};
  const win = duelOutcome(301, opp, {trophies: 100, streak: 3});
  assert.deepEqual([win.win, win.dTrophies, win.streak], [true, 28 + 12, 4]);
  const loss = duelOutcome(300, opp, {trophies: 5, streak: 3});
  assert.deepEqual([loss.win, loss.dTrophies, loss.streak], [false, -5, 0]);
  assert.equal(opponentAt(opp, 0), 150);
  assert.equal(opponentAt(opp, 1), 300);
});

test('leaderboard always holds the player and ranks by trophies', () => {
  const bots = makeBots(420, mulberry32(3));
  assert.equal(bots.length, 14);
  assert.ok(bots.every(b => b.t >= 400 && b.t < 800), 'bots live in the Silver band');
  const board = leaderboard(bots, 99999);
  assert.equal(board.length, 15);
  assert.deepEqual([board[0].me, board[0].rank], [true, 1]);
  assert.equal(leaderboard(bots, 0).at(-1).me, true);
  assert.equal(leagueOf(3200), 6);
  assert.equal(squadPower([{power: 5}, {power: 50}, {power: 30}, {power: 20}]), 100);
});

test('save is versioned and survives broken storage', () => {
  const mem = new Map(), store = {getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v)};
  const s = fresh(); s.credits = 123; s.up.luck = 2;
  save(s, store);
  const back = load(store);
  assert.deepEqual([back.credits, back.up.luck, back.v], [123, 2, 1]);
  mem.set('cyberforge_v1', '{not json');
  assert.equal(load(store).credits, 0);
  mem.set('cyberforge_v1', JSON.stringify({credits: 5}));     // a save without a version still loads
  assert.deepEqual([load(store).credits, load(store).up.mult], [5, 0]);
});

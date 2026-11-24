import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryStore, sync, top, rename, findOpponent, cleanProfile, handler, HttpError} from '../api/_lib/core.js';
import leaderboardRoute from '../api/leaderboard.js';
import {opponentFromPlayer} from '../src/engine/arena.js';

const art = (n = 'Неон') => ({loc: 'neo', el: {n, r: 3}, wp: {n: 'Катана', r: 3}, pk: {n: 'Взлом', r: 3}, idx: '148', tier: 2, power: 57});
const prof = (pid, trophies, extra = {}) => ({pid, name: `Игрок ${pid.slice(0, 4)}`, trophies, power: 300 + trophies, strike: 2, squad: [art()], ...extra});
const PID = n => `pid-${String(n).padStart(8, '0')}`;

test('profile validation bounds everything a client can send', () => {
  assert.equal(cleanProfile(prof(PID(1), 10)).squad.length, 1);
  for (const bad of [null, {}, prof('short', 1), prof(PID(1), -1), prof(PID(1), 1.5), prof(PID(1), 1, {power: 2e9}), prof(PID(1), 1, {name: 'x'}), prof(PID(1), 1, {name: '<b>hack</b>'})])
    assert.throws(() => cleanProfile(bad), HttpError);
  const junk = cleanProfile(prof(PID(1), 5, {squad: [art(), {el: 'x'}, {...art(), idx: '12'}, art(), art(), art()], strike: 999}));
  assert.deepEqual([junk.squad.length, junk.strike], [3, 0]);          // broken entries dropped, at most 3 valid kept, strike reset
});

test('sync + Top-50: ordered by trophies, nicknames survive later syncs', async () => {
  const s = memoryStore();
  for (let i = 1; i <= 60; i++) await sync(s, prof(PID(i), i * 10));
  const t = (await top(s)).top;
  assert.equal(t.length, 50);
  assert.deepEqual([t[0].trophies, t[0].rank, t[49].trophies], [600, 1, 110]);
  assert.deepEqual(await rename(s, {pid: PID(60), name: 'Кузнец Абдулло'}), {ok: true, name: 'Кузнец Абдулло'});
  await sync(s, prof(PID(60), 650));                                     // the client still sends its old name
  assert.equal((await top(s)).top[0].name, 'Кузнец Абдулло');
  await assert.rejects(rename(s, {pid: PID(999), name: 'Новичок'}), /ковку/);
  await assert.rejects(rename(s, {pid: PID(1), name: 'a'}), HttpError);
});

test('arena: a real opponent near the rating, never yourself; null on an empty base', async () => {
  const s = memoryStore();
  assert.deepEqual(await findOpponent(s, {pid: PID(1), trophies: 100}), {opponent: null});
  await sync(s, prof(PID(1), 100));
  assert.deepEqual(await findOpponent(s, {pid: PID(1), trophies: 100}), {opponent: null});   // only me
  await sync(s, prof(PID(2), 180)); await sync(s, prof(PID(3), 3000));
  const {opponent} = await findOpponent(s, {pid: PID(1), trophies: 100}, () => 0);
  assert.deepEqual([opponent.name, opponent.trophies], ['Игрок pid-', 180]);
  await assert.rejects(findOpponent(s, {pid: 'bad', trophies: 1}), HttpError);
});

test('a real player becomes a duel opponent with the same shape as a bot', () => {
  const o = opponentFromPlayer({name: 'Rival', trophies: 400, power: 900, strike: 3, squad: [art()]}, () => 0.5);
  assert.equal(o.name, 'Rival');
  assert.ok(o.total > 900 && o.start === Math.round(o.total * 0.5) && Number.isFinite(o.seed), JSON.stringify(o));
  assert.equal(o.real, true);
});

test('route wrapper: CORS, methods, JSON errors', async () => {
  const call = async (method, body) => {
    const out = {headers: {}};
    const res = {setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; }, end() { return this; }};
    await leaderboardRoute({method, body, query: {}}, res);
    return out;
  };
  const get = await call('GET');
  assert.deepEqual([get.status, Array.isArray(get.json.top), get.headers['Access-Control-Allow-Origin']], [200, true, '*']);
  assert.equal((await call('OPTIONS')).status, 204);
  assert.equal((await call('DELETE')).status, 405);
  assert.equal((await call('POST', '{oops')).status, 400);
  const bad = await call('POST', {pid: 'x', name: 'ok name'});
  assert.deepEqual([bad.status, typeof bad.json.error], [400, 'string']);
  const guard = handler({GET: () => { throw new Error('boom'); }}), r = {setHeader() {}, status(c) { this.c = c; return this; }, json(j) { this.j = j; return this; }};
  const orig = console.error; console.error = () => {};
  await guard({method: 'GET'}, r); console.error = orig;
  assert.deepEqual([r.c, r.j.error], [500, 'Ошибка сервера']);       // no stack trace leaks to the client
});

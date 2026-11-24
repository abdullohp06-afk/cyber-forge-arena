import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/server.mjs';

/** A server on a random port with an in-memory DB and a tiny static folder. */
async function boot() {
  const dir = mkdtempSync(join(tmpdir(), 'cf-')), stat = join(dir, 'dist');
  mkdirSync(join(stat, 'assets'), {recursive: true});
  writeFileSync(join(stat, 'index.html'), '<!doctype html><title>game</title>');
  writeFileSync(join(stat, 'assets', 'a-123.js'), 'console.log(1)');
  writeFileSync(join(dir, 'secret.txt'), 'top secret');
  const {server} = createApp({dbPath: ':memory:', staticDir: stat});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise(r => server.close(() => { rmSync(dir, {recursive: true, force: true}); r(); }));
  return {base, close};
}

/** A tiny cookie-keeping client, like one browser tab. */
function client(base) {
  let jar = '';
  return async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, {method, headers: {...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...(jar ? {cookie: jar} : {}), ...headers},
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)});
    const set = r.headers.get('set-cookie');
    if (set) jar = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let data = null; try { data = await r.json(); } catch { /* not JSON */ }
    return {status: r.status, data, headers: r.headers};
  };
}

test('register → me → save round trip → logout → login restores the save', async () => {
  const {base, close} = await boot();
  try {
    const a = client(base);
    assert.deepEqual((await a('GET', '/api/me')).data, {name: null});
    const reg = await a('POST', '/api/register', {name: 'Абдулло_1', password: 'secret12'});
    assert.equal(reg.status, 201);
    assert.match(reg.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
    assert.deepEqual((await a('GET', '/api/me')).data, {name: 'Абдулло_1'});
    assert.deepEqual((await a('GET', '/api/save')).data, {data: null, savedAt: 0});
    const save = {v: 1, credits: 777, savedAt: 1000};
    assert.equal((await a('PUT', '/api/save', {data: save})).status, 200);
    assert.deepEqual((await a('GET', '/api/save')).data, {data: save, savedAt: 1000});
    assert.equal((await a('POST', '/api/logout', {})).status, 200);
    assert.equal((await a('GET', '/api/save')).status, 401);
    const b = client(base);                                          // another device
    assert.equal((await b('POST', '/api/login', {name: 'абдулло_1', password: 'secret12'})).status, 200);   // names are case-insensitive
    assert.equal((await b('GET', '/api/save')).data.data.credits, 777);
  } finally { await close(); }
});

test('bad credentials, duplicate names and weak input are refused', async () => {
  const {base, close} = await boot();
  try {
    const a = client(base);
    assert.equal((await a('POST', '/api/register', {name: 'Kuznec', password: 'secret12'})).status, 201);
    assert.equal((await client(base)('POST', '/api/register', {name: 'kuznec', password: 'other123'})).status, 409);
    const wrong = await client(base)('POST', '/api/login', {name: 'Kuznec', password: 'nope-nope'});
    assert.deepEqual([wrong.status, wrong.data.error], [401, 'Неверное имя или пароль']);
    assert.equal((await client(base)('POST', '/api/login', {name: 'Nobody', password: 'secret12'})).status, 401);   // same answer for an unknown name
    for (const [name, password] of [['ab', 'secret12'], ['x'.repeat(25), 'secret12'], ['bad name', 'secret12'], ['<script>', 'secret12'], ['Okname', '12345'], ['Okname', 7]])
      assert.equal((await client(base)('POST', '/api/register', {name, password})).status, 400, `${name}/${password}`);
    assert.equal((await client(base)('POST', '/api/login', 'name=a&password=b', {'Content-Type': 'application/x-www-form-urlencoded'})).status, 415);   // no form posts from other sites
    assert.equal((await client(base)('POST', '/api/login', '{not json')).status, 400);
  } finally { await close(); }
});

test('saves: auth required, must look like a game save, a stale save never overwrites a newer one, size is capped', async () => {
  const {base, close} = await boot();
  try {
    const anon = client(base);
    assert.equal((await anon('PUT', '/api/save', {data: {v: 1}})).status, 401);
    const a = client(base);
    await a('POST', '/api/register', {name: 'Saver', password: 'secret12'});
    for (const bad of [null, [], 'str', {credits: 5}]) assert.equal((await a('PUT', '/api/save', {data: bad})).status, 400, JSON.stringify(bad));
    assert.equal((await a('PUT', '/api/save', {data: {v: 1, credits: 2, savedAt: 2000}})).status, 200);
    const stale = await a('PUT', '/api/save', {data: {v: 1, credits: 1, savedAt: 1000}});
    assert.deepEqual([stale.status, stale.data.savedAt], [409, 2000]);
    assert.equal((await a('GET', '/api/save')).data.data.credits, 2);
    assert.equal((await a('PUT', '/api/save', {data: {v: 1, pad: 'x'.repeat(300 * 1024)}})).status, 413);
    const other = client(base);                                       // one account can't read another's save
    await other('POST', '/api/register', {name: 'Other', password: 'secret12'});
    assert.deepEqual((await other('GET', '/api/save')).data, {data: null, savedAt: 0});
    assert.equal((await client(base)('GET', '/api/save', undefined, {cookie: 'cf_session=forged-token'})).status, 401);
  } finally { await close(); }
});

test('login attempts are rate-limited per IP', async () => {
  const {base, close} = await boot();
  try {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await client(base)('POST', '/api/login', {name: 'Brute', password: 'guess' + i})).status;
    assert.equal(last, 429);
  } finally { await close(); }
});

test('static files: the game, hashed assets cached, no path escape, security headers', async () => {
  const {base, close} = await boot();
  try {
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<title>game/);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.match((await fetch(base + '/assets/a-123.js')).headers.get('cache-control'), /immutable/);
    assert.equal((await fetch(base + '/some/page')).status, 200);                     // unknown pages fall back to the game
    assert.equal((await fetch(base + '/missing.png')).status, 404);
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt']) {
      const text = await (await fetch(base + p)).text();
      assert.ok(!text.includes('top secret'), p);
    }
    assert.equal((await fetch(base + '/api/nope')).status, 404);
    assert.equal((await fetch(base + '/index.html', {method: 'POST'})).status, 405);
  } finally { await close(); }
});

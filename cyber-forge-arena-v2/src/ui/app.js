// Screens and game flow. Rules live in engine/, numbers in config/, ads in services/, juice in fx/.
import {LOCATIONS, TIERS, KEEP_TIER, ARSENAL_MAX, COMBO, HEAT, OVERDRIVE, MAX_LOCKS, UPGRADES, CONTAINERS, LEAGUES, ARENA, CONTRACTS, ROMAN, GYRO} from '../config/gameData.js';
import {minBet, betFor, spinIndex, sectorOf, prizeOf, odds} from '../engine/gyro.js';
import {createGyroWheel, nearJackpot} from './gyroWheel.js';
import {MINI, MINI_CFG, miniFee, miniPrize, rivalSkill, rivalReactionMs, reactWin, rivalTaps, tugPos, tugWin, aimScore, rivalAim, aimPos} from '../engine/minigames.js';
import {bgUrl, preloadBackdrops} from './locationArt.js';
import {record, dexProgress, backfill} from '../engine/collection.js';
import {showcaseHtml} from './showcase.js';
import {ACH_CATS} from '../config/achievements.js';
import {achStatus, readyToClaim, claimAch, bonuses} from '../engine/achievements.js';
import {CLOUD, currentUser, cloudPush, flush as cloudFlush, isFrozen, onCloudNotice} from '../services/cloud.js';
import {openAuth, doLogout} from './auth.js';
import {SLOTS, SLOT_NAMES, forge, evaluate, bestOf, rollSlot, forgeCredits, rerollCost, comboMult, upgradeCost, sellPrice, locById} from '../engine/forge.js';
import {leagueOf, squad, squadPower, tapPower, makeOpponent, opponentFromPlayer, opponentAt, duelOutcome, makeBots, tickBots, leaderboard} from '../engine/arena.js';
import {showRewarded, showInterstitial, PLACEMENTS, log as adLog, setTestDuration, onAdPause, initPlatform, pushPlatformSave} from '../services/adBridge.js';
import {ONLINE, syncProfile, fetchTop, fetchOpponent, renameOnline, nickname} from '../services/online.js';
import {sfx, setMuted, setPaused} from '../fx/audio.js';
import {initParticles, burst, shake, vibrate, floatNum, screenSlice} from '../fx/particles.js';
import {load, save, newContract, fresh} from './state.js';
import {icon} from './icons.js';
import {createForgeStage, stageLevel, inZone, IMPACT_DELAY} from './forgeStage.js';
import {createDuelStage} from './duelStage.js';
import {playCaseOpen} from './caseOpen.js';
import {weaponThumb} from './weaponArt.js';
import {initTelegram, shareDuelLink, tgHaptic} from '../services/telegram.js';
import {factionBonuses, strikeRaidBoss, socketRune, doPrestige} from '../engine/rpg.js';
import {applyVisualSettings, openSettingsModal, initFixerDrone, downloadWeaponCard} from '../fx/neonExtras.js';
import {openOverclockModal, openTradeModal, syndicateArenaHtml, runesSubtabHtml} from './v2Modals.js';

const $ = (s, root = document) => root.querySelector(s);
const fmt = n => Math.floor(n).toLocaleString('ru-RU');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TABS = [['forge', 'Кузня', 'hammer'], ['arena', 'Арена', 'swords'], ['arsenal', 'Арсенал', 'box'], ['shop', 'Магазин', 'cart'], ['quests', 'Квесты', 'target']];

let S;                                                               // loaded in start(): after the cloud sync may have replaced the save
const rt = {tab: 'forge', spin: null, lastTap: 0, lastManual: 0, streak: 0, heat: 0, odUntil: 0, cur: null, locks: {}, duel: null, lastFrame: performance.now(), auto: null,
            stage: null, duelStage: null, temper: null, forceNext: null, wheel: null, gyroShare: GYRO.shares[0], gyroAdBusy: false, forceGyro: null, arsTab: 'stock', qTab: 'contracts', sideTab: 'ach'};
const isOD = () => performance.now() < rt.odUntil;
const curLoc = () => locById(S.loc);
const persist = () => { if (isFrozen()) return; announceAch(); save(S); cloudPush(S); syncProfile(S); pushPlatformSave(S); };   // frozen: a login/logout is swapping the save

/** A metal plate slides down when an achievement becomes ready (once per achievement). */
function announceAch() {
  const fresh = readyToClaim(S).filter(a => !S.ach.seen.includes(a.id));
  if (!fresh.length) return;
  S.ach.seen.push(...fresh.map(a => a.id));
  const el = document.createElement('div');
  el.className = 'ach-plate'; el.setAttribute('role', 'status');
  el.innerHTML = `${icon('medal')}<div><small>Достижение готово</small><b></b></div>`;
  el.querySelector('b').textContent = fresh.length === 1 ? fresh[0].n : `${fresh[0].n} и ещё ${fresh.length - 1}`;
  $('#plates')?.append(el); setTimeout(() => el.remove(), 3400);
  sfx.fanfare(5); vibrate([30, 40, 30]);
}
const lockCount = () => Object.keys(rt.locks).length;
const upgradeSum = () => Object.values(S.up).reduce((a, b) => a + b, 0);
const sceneOpts = () => ({level: stageLevel(upgradeSum()), hue: curLoc().hue, loc: S.loc, auto: S.up.auto, od: isOD()});
/** The whole UI takes the location's colour (--h) and the scene its scenery. */
function applyTheme() {
  document.documentElement.style.setProperty('--h', curLoc().hue);
  document.body.dataset.loc = S.loc;
}

/* ---------- shared helpers ---------- */

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  $('#toasts').append(el); setTimeout(() => el.remove(), 2600);
}
function hud() {
  $('#credits').textContent = S.credits >= 1e7 ? `${(S.credits / 1e6).toLocaleString('ru-RU', {maximumFractionDigits: 1})} млн` : fmt(S.credits);
  $('#trophies').textContent = fmt(S.trophies);
  $('#mute').innerHTML = icon(S.muted ? 'mute' : 'sound');
  $('#mute').setAttribute('aria-label', S.muted ? 'Включить звук' : 'Выключить звук');
  $('[data-tab="quests"]').classList.toggle('has-dot', S.contracts.some(c => c.p >= c.n) || readyToClaim(S).length > 0);
}
function addCredits(n) { const v = n > 0 ? Math.round(n * factionBonuses(S).creditMult) : n; S.credits = Math.max(0, S.credits + v); if (v > 0) { S.stats.credits += v; progress('credits', v); } }
/** Pays one achievement reward into the save. The permanent perks live in S.ach.claimed, so bonuses() picks them up. */
function payReward(r) {
  if (r.credits) addCredits(r.credits);
  if (r.box) S.boxes[r.box]++;
}
function progress(k, add, isMax = false) {
  for (const c of S.contracts) if (c.k === k && c.p < c.n) c.p = Math.min(c.n, isMax ? Math.max(c.p, add) : c.p + add);
}
/** Каталог находок: records the artifact's names; a first-ever name gets a toast and a coin chime (never for the auto-hammer). */
function discover(a, loud) {
  const fresh = record(S.dex, a).filter(c => c.fresh);
  if (!fresh.length || !loud) return;
  toast(fresh.length === 1 ? `Новая находка: ${fresh[0].n}` : `Новые находки: ${fresh.length}`);
  sfx.coin();
}
function fillContracts() { while (S.contracts.length < 3) S.contracts.push(newContract(S.contracts.map(c => c.k))); }
function ensureBots() {
  const li = leagueOf(S.trophies);
  if (!S.bots || S.botsLeague !== li) { S.bots = makeBots(S.trophies); S.botsLeague = li; }
}

/** Arsenal insert / replace. Full arsenal: the weakest artifact is sold to make room. Returns the id or null. */
function storeArtifact(a, e, replaceId = null) {
  const art = {...a, id: replaceId ?? S.nextId++, score: e.score, tier: e.tier, power: Math.round(e.power * (1 + bonuses(S).craft)), t: Date.now()};   // craft bonus from achievements + Каталог
  if (replaceId != null) {
    const i = S.arsenal.findIndex(x => x.id === replaceId);
    if (i >= 0) { S.arsenal[i] = art; return art.id; }
  }
  if (S.arsenal.length >= ARSENAL_MAX) {
    const low = S.arsenal.reduce((m, x) => x.power < m.power ? x : m);
    if (low.power >= art.power) { addCredits(sellPrice(art)); toast('Арсенал полон — артефакт продан'); return null; }
    S.arsenal = S.arsenal.filter(x => x !== low); addCredits(sellPrice(low));
  }
  S.arsenal.push(art);
  return art.id;
}

function artCard(a) {
  const t = TIERS[a.tier];
  return `<div class="art${a.tempered ? ' tempered' : ''}" style="--tc:${t.c}"><img class="wthumb" src="${weaponThumb(a)}" alt="" width="120" height="48">
    <div class="art-tier">${t.n}${a.tempered ? ' · ★' : ''}${a.oc ? `<span class="art-oc">+${a.oc}</span>` : ''}${a.rune ? `<span class="art-rune">${a.rune.name}</span>` : ''}</div>
    <div class="art-name">${a.el.n} · ${a.wp.n}</div>
    <div class="art-sub">${a.pk.n} ${ROMAN[a.pk.r]} · <span class="num">#${a.idx}</span></div>
    <div class="art-pow">${icon('bolt')}<b class="num">${fmt(a.power)}</b></div></div>`;
}

/* ---------- shell & navigation ---------- */

function shell() {
  $('#app').innerHTML = `<header class="hud">
      <div class="logo">КИБЕР-КУЗНЯ</div>
      <div class="hud-center" id="hudCenter"></div>
      <div class="pill" title="Кредиты">${icon('coin')}<b id="credits" class="num">0</b></div>
      <div class="pill gold" title="Кубки">${icon('trophy')}<b id="trophies" class="num">0</b></div>
      <button class="iconbtn" id="mute"></button>
      <button class="iconbtn" id="settingsBtn" aria-label="Настройки">${icon('gear')}</button>
    </header>
    <main id="screen"></main>
    <div id="plates" aria-live="polite"></div>
    <nav class="tabs" aria-label="Разделы">${TABS.map(([id, n, ic]) =>
      `<button data-tab="${id}">${icon(ic)}<span>${n}</span></button>`).join('')}</nav>`;
}

function show(tab) {
  if (rt.duel && !rt.duel.done) return;                 // a running duel can't be left
  if (rt.duel?.done && tab !== 'arena') { duelDone(tab); return; }
  if (rt.mini) miniStop();
  if (rt.spin) rt.spin.finish();
  if (rt.temper) endTemper(null, true);
  rt.wheel?.finish(); rt.wheel = null;                  // leaving mid-spin lands the wheel at once: the stake is never lost
  rt.stage?.stop(); rt.stage = null;
  rt.tab = tab;
  document.body.dataset.tab = tab;
  if (tab === 'arena' && S.tut === 3) { S.tut = 99; persist(); $('[data-tab="arena"]')?.classList.remove('tut-pulse'); }
  document.querySelectorAll('.tabs button').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  ({forge: renderForge, arena: renderArena, arsenal: renderArsenal, shop: renderShop, quests: renderQuests})[tab]();
  renderHudCenter();
  scrollTo(0, 0);
}

/* ---------- forge ---------- */

const SLOT_ICONS = {el: 'bolt', wp: 'swords', pk: 'target', idx: 'medal'};

function renderHudCenter() {
  const el = $('#hudCenter');
  if (!el) return;
  // The location plate and strip belong to the forge. Off that tab the HUD is only the logo, the two
  // counters and mute, which is what lets it fit the 520 px column without the plate riding over the pills.
  if (rt.tab !== 'forge') { el.innerHTML = ''; return; }
  const L = curLoc(), strip = `<div class="locs" role="group" aria-label="Локации">${LOCATIONS.filter(l => S.unlocked.includes(l.id) || l === LOCATIONS.find(x => !S.unlocked.includes(x.id))).map(l => S.unlocked.includes(l.id)
      ? `<button class="chip ${l.id === S.loc ? 'on' : ''}" style="--h:${l.hue}" data-act="loc" data-id="${l.id}" aria-pressed="${l.id === S.loc}">${l.name} <small class="num">×${l.mult}</small></button>`
      : `<button class="chip locked" data-act="tab" data-id="shop">${icon('lock')}${l.name} <small class="num">${fmt(l.cost)}</small></button>`).join('')}</div>`;
  el.innerHTML = `<div class="plate"><small>CYBER FORGE: ARENA</small><b>${L.name}</b></div>${strip}`;
  const bar = el.querySelector('.locs'), on = bar?.querySelector('.on');
  if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;   // the current location sits in the middle
}

function renderForge() {
  const L = curLoc();
  rt.wheel?.finish();                                   // a location switch re-renders the forge mid-spin
  $('#screen').innerHTML = `<section class="view forge">
    <div class="forge-grid">
    <aside class="side side-l" id="sideL" aria-label="Достижения"></aside>
    <div class="forge-main">
    <div class="stage-wrap"><canvas id="forgeStage" class="forge-stage" aria-hidden="true"></canvas>
      <div class="temper" id="temper" hidden><div class="temper-bar"><i class="zone"></i><i class="marker"></i></div><span id="temperTxt">Жми в золотой зоне!</span></div></div>
    <div class="anvil" id="anvil" style="--h:${L.hue}">
      ${SLOTS.map(s => `<div class="slot slot-${s}" data-slot="${s}">
          <div class="slot-top">${icon(SLOT_ICONS[s])}<span class="slot-name">${SLOT_NAMES[s]}</span></div>
          <div class="slot-val" id="sv-${s}">—</div><div class="slot-rank" id="sr-${s}"></div>
          <button class="lockbtn" data-act="lock" data-id="${s}" aria-label="Замок: ${SLOT_NAMES[s]}" aria-pressed="false">${icon('unlock')}</button></div>`).join('')}
    </div>
    <div class="verdict" id="verdict" aria-live="polite"><span class="hint">${tutHint()}</span></div>
    <div class="console">
      <div class="lever" title="Реактор: быстрые тапы греют, на 100% — OVERDRIVE">
        <div class="lever-glass"><i id="heatFill"></i></div>
        <span id="heatTxt" class="num"></span>
      </div>
      <div class="console-mid">
        <div class="forge-dock"><button class="forgebtn ${S.tut === 0 ? 'tut-pulse' : ''}" id="forgeBtn">КОВАТЬ</button></div>
        <div class="meter combo"><i id="comboFill"></i><span id="comboTxt" class="num"></span></div>
      </div>
    </div>
    <div class="row2">
      <button class="btn ghost" id="rerollBtn" data-act="reroll"></button>
      <button class="btn ad" id="rerollAdBtn" data-act="rerollAd">${icon('play')}Перековать бесплатно</button>
    </div>
    <nav class="tools" aria-label="Механики кузни">
      <button class="tool" id="gyroOpen" data-act="gyroOpen" aria-haspopup="dialog">${icon('target')}<span>Гиро</span><b class="num" id="gyroMini"></b></button>
      <button class="tool" id="dexLink" data-act="openDex"></button>
      <button class="tool ad" id="odAdBtn" data-act="odAd">${icon('bolt')}<span>Overdrive</span><small>реклама</small></button>
    </nav>
    </div>
    <aside class="side side-r" id="sideR" aria-label="Улучшения и Арена"></aside>
    </div>
  </section>
  <div class="drawer" id="gyroDrawer" hidden>
    <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="gyroTitle">
      <div class="drawer-head"><span class="lamp"></span><b id="gyroTitle">ГИРО-РЕАКТОР</b>
        <button class="iconbtn" data-act="gyroClose" aria-label="Закрыть">${icon('close')}</button></div>
      <section class="gyro" id="gyro" aria-label="Гиро-Реактор">
        <canvas id="gyroWheel" class="gyro-wheel" role="img" aria-label="Колесо множителей: размер сектора равен шансу"></canvas>
        <div class="gyro-body" id="gyroBody" aria-live="polite"></div>
        <ul class="gyro-odds">${GYRO_ODDS.map(o => `<li><i style="background:${o.c}"></i>${o.n} <span class="num">${o.p}%</span></li>`).join('')}</ul>
      </section>
    </div>
  </div>`;
  applyTheme(); renderHudCenter();
  const btn = $('#forgeBtn');
  btn.addEventListener('pointerdown', e => { e.preventDefault(); forgeTap('tap'); });   // no 300 ms click delay
  btn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); forgeTap('tap'); } });
  $('#forgeStage').addEventListener('pointerdown', pokeWeapon);         // easter egg: the artifact on the anvil answers a tap
  rt.stage?.stop();
  rt.stage = createForgeStage($('#forgeStage'), {onImpact: p => sfx.impact(p)});
  rt.stage.setScene(sceneOpts());
  rt.stage.setArtifact(rt.cur ? artLook(rt.cur) : null);
  rt.stage.start();
  rt.wheel = createGyroWheel($('#gyroWheel'), {onTick: () => sfx.tick()});
  if (rt.cur) { SLOTS.forEach(s => paintSlot(s, rt.cur.a[s], false)); announce(rt.cur.e, null, rt.cur.id, 'quiet'); }
  updateForgeControls();
}

/** Easter egg: a tap straight on the artifact rings it, spins it and throws sparks. Never during a reveal or the quench. */
function pokeWeapon() {
  if (!rt.cur || rt.spin || rt.temper || !rt.stage) return;
  rt.stage.poke();
  sfx.tick(); sfx.fanfare(1); vibrate(12);
  burst($('#forgeStage'), 18, [TIERS[rt.cur.e.tier].c, '#ffffff']);
}

function paintSlot(s, v, spinning) {
  const val = $('#sv-' + s), rank = $('#sr-' + s), card = val?.closest('.slot');
  if (!val) return;
  const item = typeof v !== 'string';
  val.textContent = item ? v.n : v;
  rank.textContent = item ? (v.r === 5 ? 'МИФ Ω' : 'РАНГ ' + ROMAN[v.r]) : '';
  card.dataset.rank = item ? v.r : '';
  card.classList.toggle('spin', spinning);
}

/** Slots spin, then stop one by one left to right. Locked slots stand still. */
function spinSlots(a, slots, dur, done, {stops, riser = false, locked = false} = {}) {
  const L = locById(a.loc);
  if (!$('#anvil') || dur <= 0) { slots.forEach(s => paintSlot(s, a[s], false)); rt.spin = null; done(); return; }
  const t0 = performance.now(), stopped = new Set();
  let raf = 0, lastTick = 0, over = false;
  const land = (s, i) => {
    stopped.add(s); paintSlot(s, a[s], false);
    const card = $(`.slot[data-slot="${s}"]`);
    card?.classList.remove('land'); void card?.offsetWidth; card?.classList.add('land');
    sfx.slotStop(i);
  };
  const finish = () => {
    if (over) return; over = true; cancelAnimationFrame(raf);
    slots.forEach((s, i) => { if (!stopped.has(s)) land(s, i); });
    rt.spin = null; done();
  };
  const step = now => {
    const el = now - t0;
    slots.forEach((s, i) => {
      if (stopped.has(s)) return;
      if (el < dur * (stops?.[i] ?? 0.35 + 0.65 * (i + 1) / slots.length)) paintSlot(s, rollSlot(s, L), true); else land(s, i);
    });
    if (now - lastTick > 60) { riser ? sfx.riser(el / dur) : sfx.tick(); lastTick = now; }
    if (el < dur) raf = requestAnimationFrame(step); else finish();
  };
  rt.spin = {finish, locked};
  raf = requestAnimationFrame(step);
}

/** kind: 'tap' | 'auto' | a container object. The animation is directed by the rarity that is about to land. */
function forgeTap(kind = 'tap') {
  if (rt.duel || $('.ad-modal')) return;
  const now = performance.now();
  if (rt.temper) {                                                   // during tempering the forge button tempers
    if (kind !== 'tap') return;
    if (now < rt.temper.guardUntil) { rt.lastTap = now; return; }     // inertia from combo tapping must not throw the quench away
    endTemper(temperPos());
    return;
  }
  if (rt.spin) {
    if (kind !== 'tap') return;
    if (rt.spin.locked) { rt.lastTap = now; return; }                // big reveals play out; taps keep the combo alive
    rt.spin.finish(); return;                                         // a tap mid-spin lands every slot now
  }
  if (kind === 'auto' && (lockCount() || rt.cur?.canRetry)) return;  // the auto-hammer never wipes locks or an open re-temper offer
  const container = typeof kind === 'object' ? kind : null;
  if (kind === 'tap') {
    rt.streak = now - rt.lastTap < COMBO.window ? rt.streak + 1 : 0;
    rt.lastTap = rt.lastManual = now;
    S.stats.maxCombo = Math.max(S.stats.maxCombo, rt.streak);
  }
  const od = isOD();
  const forced = !!rt.forceNext;
  const r = rt.forceNext ?? bestOf(S.loc, container ? container.tries : 1 + S.up.luck + (od ? OVERDRIVE.luck : 0));
  rt.forceNext = null;
  if (!forced && kind === 'tap' && S.tut < 2 && S.stats.forges === 2) Object.assign(r, tutRare());   // onboarding: the 3rd strike is always «Редкий»
  if (kind !== 'auto') rt.locks = {};                                // a manual forge or a container starts a new artifact
  $('#anvil')?.classList.toggle('container', !!container);
  const plan = forgePlan(r.e.tier, kind, od), st = rt.stage;
  if (st) {
    st.setArtifact(null);
    if (plan.cocoon) st.cocoon(TIERS[r.e.tier].c);
    plan.strikes.forEach((at, i) => st.strike({delay: Math.max(0, at - IMPACT_DELAY), power: plan.power[i] ?? 1, hitstop: plan.hitstop, drone: kind === 'auto'}));
  }
  spinSlots(r.a, SLOTS, plan.dur, () => onForged(r, kind, od), plan);
  updateForgeControls();
}

/* ---------- onboarding: strike → guaranteed «Редкий» on the 3rd forge → tempering → the Arena ---------- */

function tutHint() {
  if (S.tut === 0) return 'Ударь по раскалённой заготовке — жми КОВАТЬ';
  if (S.tut === 1) return 'Ещё пара ударов — и выпадет первый «Редкий» артефакт';
  return 'Жми КОВАТЬ. Быстрые тапы разгоняют комбо и реактор.';
}
function tutRare() {
  const a = forge(S.loc);
  a.el = {...a.el, r: 3}; a.wp = {...a.wp, r: 3}; if (a.pk.r !== 5) a.pk = {...a.pk, r: 3};   // rank III resonance = «Редкий»
  return {a, e: evaluate(a)};
}

/* ---------- side panels (wide screens): achievements · forge upgrades · PvP card ---------- */

const SIDE_UPS = ['auto', 'mult', 'reactor'];
function renderSides() {
  const l = $('#sideL'), r = $('#sideR');
  if (!l || !r) return;
  const all = achStatus(S), done = all.filter(a => a.claimed).length, ready = all.filter(a => a.ready && !a.claimed);
  const next = [...ready, ...all.filter(a => !a.ready).sort((a, b) => b.pct - a.pct)].slice(0, 3);
  const tab = rt.sideTab, cDone = S.contracts.filter(c => c.p >= c.n).length;
  const tabs = `<div class="side-tabs" role="group" aria-label="Раздел">${[['ach', 'Достижения', ready.length], ['contracts', 'Контракты', cDone]].map(([id, n, k]) =>
    `<button class="chip ${tab === id ? 'on' : ''}" data-act="sideTab" data-id="${id}" aria-pressed="${tab === id}">${n}${k ? `<span class="count num">${k}</span>` : ''}</button>`).join('')}</div>`;
  l.innerHTML = tab === 'ach' ? `<div class="panel">${tabs}<div class="panel-head">${icon('trophy')}<b>Достижения</b><span class="num">${done}/${all.length}</span></div>
    ${next.map(a => `<div class="mini-ach ${a.ready ? 'ready' : ''}"><div class="mini-ach-n">${a.n}</div>
      <div class="prog"><i style="width:${Math.round(a.pct * 100)}%"></i></div></div>`).join('')}
    <button class="btn ${ready.length ? '' : 'ghost'} wide" data-act="openAch">${ready.length ? `Забрать награды · ${ready.length}` : 'Все достижения'}</button></div>`
    : `<div class="panel">${tabs}<div class="panel-head">${icon('target')}<b>Контракты</b></div>
    ${S.contracts.map((c, i) => { const t = CONTRACTS.find(x => x.k === c.k), ok = c.p >= c.n;
      return `<div class="mini-ach ${ok ? 'ready' : ''}"><div class="mini-ach-n">${t.t(c.n)}</div><div class="small num">${fmt(Math.min(c.p, c.n))} / ${fmt(c.n)} · +${fmt(c.reward)}</div>
        <div class="prog"><i style="width:${Math.min(100, c.p / c.n * 100)}%"></i></div>${ok ? `<button class="btn small wide" data-act="claim" data-id="${i}">Забрать +${fmt(c.reward)}</button>` : ''}</div>`; }).join('')}</div>`;
  const li = leagueOf(S.trophies);
  r.innerHTML = `<div class="panel"><div class="panel-head">${icon('hammer')}<b>Улучшения кузни</b></div>
    ${SIDE_UPS.map(id => {
      const u = UPGRADES[id], max = S.up[id] >= u.max, c = upgradeCost(u, S.up[id]);
      return `<div class="mini-up"><div><b>${u.n}</b><small class="num">ур. ${S.up[id]}/${u.max}</small></div>
        <button class="btn small" data-act="up" data-id="${id}" ${max || S.credits < c ? 'disabled' : ''}>${max ? 'МАКС' : `<span class="num">${fmt(c)}</span>`}</button></div>`;
    }).join('')}</div>
    <div class="panel"><div class="panel-head">${icon('swords')}<b>PvP-Арена</b></div>
      <div class="mini-row"><span>Лига</span><b>${LEAGUES[li].n}</b></div>
      <div class="mini-row"><span>Кубки</span><b class="num">${fmt(S.trophies)}</b></div>
      <button class="btn wide" data-act="tab" data-id="arena">В бой</button></div>`;
}

/* ---------- Достижения screen (a sub-tab of «Квесты») ---------- */

function achHtml() {
  const all = achStatus(S), b = bonuses(S), reward = a => a.reward.credits ? `<span class="num">+${fmt(a.reward.credits)}</span>`
    : a.reward.box ? `Контейнер «${CONTAINERS.find(c => c.id === a.reward.box).n}»`
    : a.reward.craft ? `+${Math.round(a.reward.craft * 100)}% мощь крафта` : `+${Math.round(a.reward.arena * 100)}% награды Арены`;
  const ready = all.filter(a => a.ready && !a.claimed), pot = ready.reduce((t, a) => t + (a.reward.credits ?? 0), 0);
  return `${ready.length ? `<button class="btn claim-all" data-act="claimAll">Забрать всё${pot ? ` (+${fmt(pot)} ⚡)` : ''} · ${ready.length}</button>` : ''}
    <div class="card bonus-card"><div class="row"><div class="grow"><div class="label">Мощь крафта</div><b class="num big">+${Math.round(b.craft * 100)}%</b></div>
      <div class="grow"><div class="label">Награды Арены</div><b class="num big">+${Math.round(b.arena * 100)}%</b></div></div>
      <p class="small">Каждые 10 находок в Витрине дают +5% к мощи новых артефактов.</p></div>
    ${ACH_CATS.map(c => `<h2>${c.n}</h2><div class="ach-list">${all.filter(a => a.cat === c.id).map(a => `
      <div class="ach ${a.claimed ? 'claimed' : a.ready ? 'ready' : ''}">
        <div class="ach-ic">${icon('medal')}</div>
        <div class="grow"><b>${a.n}</b><div class="small">${a.d}</div>
          <div class="prog"><i style="width:${Math.round(a.pct * 100)}%"></i></div>
          <div class="small ach-rw">Награда: ${reward(a)}</div></div>
        ${a.claimed ? '<span class="badge">ПОЛУЧЕНО</span>' : `<button class="btn small" data-act="claimAch" data-id="${a.id}" ${a.ready ? '' : 'disabled'}>Забрать</button>`}
      </div>`).join('')}</div>`).join('')}`;
}

/** Timeline per rarity: spin length, when each slot stops, when the hammer lands (ms from the start). */
function forgePlan(tier, kind, od) {
  if (REDUCED) return {dur: 0, strikes: [0], power: [1]};
  if (typeof kind === 'object') return {dur: 1500, stops: [0.3, 0.5, 0.75, 1], strikes: [450, 1000, 1500], power: [1, 1, 2], locked: true};
  if (kind === 'auto') return {dur: 320, strikes: [320], power: [0.6]};
  if (tier >= 4) return {dur: 1750, stops: [0.25, 0.5, 0.78, 1], strikes: [440, 980, 1750], power: [1.2, 1.5, 2.5],
                         hitstop: true, cocoon: true, riser: true, locked: true};
  if (tier >= KEEP_TIER) return {dur: 1150, stops: [0.2, 0.35, 0.68, 1], strikes: [1150], power: [1.6], riser: true, locked: true};
  const dur = od || rt.streak > 4 ? 280 : 340;
  return {dur, strikes: [dur], power: [1]};
}

function onForged({a, e}, kind, od) {
  const container = typeof kind === 'object', combo = kind === 'tap' ? comboMult(rt.streak, COMBO) : 1;
  S.stats.forges++; S.stats.tiers[e.tier]++;
  if (kind === 'tap' && S.tut < 2) {
    S.tut = e.tier >= KEEP_TIER ? 2 : 1;
    $('#forgeBtn')?.classList.remove('tut-pulse');
  }
  discover(a, kind !== 'auto');
  e.tags.forEach(t => { S.stats.tags[t.id] = (S.stats.tags[t.id] || 0) + 1; });
  progress('forges', 1);
  if (e.tier >= KEEP_TIER) progress('rare', 1);
  if (e.tags.some(t => t.id === 'mirror')) progress('mirror', 1);
  let gain = 0;
  if (!container) {
    gain = forgeCredits(e.score, {locMult: locById(a.loc).mult, multLvl: S.up.mult, combo, overdrive: od});
    addCredits(gain);                                                 // counts for stats and the «Заработай» contract
  }
  const id = container || e.tier >= KEEP_TIER ? storeArtifact(a, e) : null;
  rt.cur = {a, e, id};
  if (!S.stats.best || e.score > S.stats.best.score) S.stats.best = {...a, score: e.score, tier: e.tier, power: e.power};
  if (!od && !container && (rt.heat += HEAT.perForge * (1 + 0.25 * S.up.reactor) * combo) >= HEAT.max) startOverdrive();
  if (kind === 'tap' && e.tier >= KEEP_TIER) rt.lastTap = performance.now();   // a long reveal must not break the combo
  announce(e, gain, id, kind === 'auto' ? 'auto' : 'loud');
  stageReveal(rt.cur, kind);
  if (gain && kind !== 'auto') floatNum($('#anvil'), `+${fmt(gain)} ⚡`, combo >= 1.5 ? 'crit' : '');
  persist(); hud(); updateForgeControls();
  if (kind !== 'auto' && id != null && e.tier >= KEEP_TIER) startTemper();
}

const artLook = cur => ({...cur.a, tempered: !!cur.tempered, power: cur.e.power, tier: cur.e.tier});   // power for the stage call-out, tier for rarity add-ons

/** The scene when the slots land: the weapon appears; rare+ sends a shockwave; legendary+ a light pillar and a shattered cocoon. */
function stageReveal(cur, kind) {
  const st = rt.stage;
  if (!st) return;
  st.setArtifact(artLook(cur));
  if (kind === 'auto') return;
  const c = TIERS[cur.e.tier].c;
  if (cur.e.tier >= KEEP_TIER) st.shockwave(c);
  if (cur.e.tier >= 4) { st.pillar(c); st.shatter(c); sfx.crack(); }
  // Мифический or a 777 index is the rarest thing the forge can produce: cut the screen and stretch the moment.
  if (cur.e.tier >= 5 || cur.e.tags.some(x => x.id === 'j777')) { screenSlice(c); st.slowmo(360, 0.25); sfx.crack(); }
}

function announce(e, gain, id, mode) {
  const t = TIERS[e.tier], anvil = $('#anvil'), v = $('#verdict');
  if (!v) return;
  anvil.style.setProperty('--tc', t.c);
  anvil.dataset.tier = e.tier;
  v.innerHTML = `<div class="tier" style="color:${t.c}">${t.n}</div>
    <div class="meta num">Очки ${e.score} · мощь ${fmt(S.arsenal.find(x => x.id === id)?.power ?? e.power)}${id != null ? ' · в Арсенале' : ''}</div>
    <div class="tags">${e.tags.map(x => `<span class="tag">${x.label}</span>`).join('')}</div>
    ${gain ? `<div class="gain num">+${fmt(gain)}</div>` : ''}
    ${rt.cur?.tempered ? '<div class="tempered-note">★ Закалён · мощь +25%</div>' : ''}
    ${rt.cur?.canRetry ? `<button class="btn ad" data-act="temperAd">${icon('play')}Перезакалить (реклама)</button>` : ''}`;
  if (mode === 'quiet' || (mode === 'auto' && e.tier < KEEP_TIER)) return;
  v.querySelector('.tier').classList.add('pop');
  if (e.tier >= 1) sfx.fanfare(e.tier);
  if (e.tier >= 3) vibrate(e.tier >= 4 ? [60, 40, 140] : 35);
  if (e.tier >= 4) burst(anvil, 35 * e.tier, [t.c, '#ffffff', '#ffcc33', '#00f0ff']);   // page-wide confetti only for the top tiers; the scene covers the rest
  if (e.tier >= 4) shake($('#screen'), e.tier >= 5);   // not <body>: a transformed body would drag the fixed tab bar along
}

function updateForgeControls() {
  const rb = $('#rerollBtn');
  if (!rb) return;
  const n = lockCount(), cost = rt.cur ? rerollCost(locById(rt.cur.a.loc).mult, n) : 0, can = rt.cur && n > 0 && !rt.spin && !rt.temper;
  rb.innerHTML = `${icon('lock')}Перековать <span class="num">· ${fmt(cost)}</span>`;
  rb.disabled = !can || S.credits < cost;
  $('#rerollAdBtn').disabled = !can;
  $('#odAdBtn').disabled = isOD();
  document.querySelectorAll('.lockbtn').forEach(b => {
    const on = !!rt.locks[b.dataset.id];
    b.setAttribute('aria-pressed', on); b.classList.toggle('on', on);
    b.innerHTML = icon(on ? 'lock' : 'unlock');
    b.disabled = !rt.cur || !!rt.spin;
  });
  renderGyro(); renderDexLink(); renderSides();
}

function renderDexLink() {
  const b = $('#dexLink');
  if (!b) return;
  const p = dexProgress(S.dex);
  b.innerHTML = `${icon('box')}<span>Витрина</span><b class="num">${p.found}/${p.total}</b>`;
  b.setAttribute('aria-label', `Каталог находок: ${p.found} из ${p.total}`);
  const mini = $('#gyroMini');
  if (mini) mini.textContent = rt.wheel?.spinning ? '…' : '';
}

/* ---------- Гиро-Реактор: stake credits, spin the wheel, the prize is paid out inside the drawer ---------- */

const GYRO_ODDS = odds().map(o => ({...o, p: Math.round(o.p)}));

/** The prize card shown in the drawer the moment the arrow stops. */
function prizeCard(p) {
  const gain = p.credits ? `<b class="num">+${fmt(p.credits)}</b>`
    : p.box ? `<b>Контейнер «${CONTAINERS.find(c => c.id === p.box).n}»</b>`
    : p.od ? '<b>12 секунд ×3</b>' : '<b>—</b>';
  return `<div class="gyro-prize ${p.kind}" style="--gc:${p.c}" role="status">
      <div class="gyro-prize-n">${p.n}</div>${gain}
      ${p.heat ? `<small>Реактор +${p.heat}%</small>` : ''}
      ${p.doubled ? '<small>Удвоено рекламой ✓</small>' : ''}
    </div>`;
}

function renderGyro() {
  const body = $('#gyroBody');
  if (!body) return;
  const p = rt.gyroPrize, spinning = !!rt.wheel?.spinning, mult = curLoc().mult, stake = betFor(S.credits, rt.gyroShare, mult);
  let action;
  if (spinning) action = '<div class="gyro-status">Реактор раскручивается…</div>';
  else if (p) action = `${prizeCard(p)}
      <div class="gyro-again">
        ${stake ? `<button class="btn" data-act="gyroSpin">Крутить ещё · <span class="num">${fmt(stake)}</span></button>`
                : `<button class="btn ad" data-act="gyroAd" ${rt.gyroAdBusy ? 'disabled' : ''}>${icon('play')}Крутить ещё (реклама)</button>`}
        ${p.credits && !p.doubled ? `<button class="btn ad" data-act="gyroDouble" ${rt.gyroAdBusy ? 'disabled' : ''}>${icon('play')}×2 за рекламу</button>` : ''}
      </div>`;
  else if (!stake) action = `<div class="gyro-status">Ставка от <b class="num">${fmt(minBet(mult))}</b> кредитов. Куй дальше или запусти спин за рекламу.</div>
      <button class="btn ad" data-act="gyroAd" ${rt.gyroAdBusy ? 'disabled' : ''}>${icon('play')}Аварийный спин (реклама)</button>`;
  else action = `<button class="btn" data-act="gyroSpin">Спин · <span class="num">${fmt(stake)}</span></button>`;
  body.innerHTML = `<div class="gyro-bets" role="group" aria-label="Размер ставки">${GYRO.shares.map(s =>
      `<button class="chip ${s === rt.gyroShare ? 'on' : ''}" data-act="gyroBet" data-id="${s}" aria-pressed="${s === rt.gyroShare}" ${spinning ? 'disabled' : ''}>${s * 100}%</button>`).join('')}</div>
    ${action}`;
}

/** Everything the spin won lands in the balance right here, before the player closes the drawer. */
function settlePrize(p, stake) {
  if (p.credits) { S.credits += p.credits; S.gyro.returned += p.credits; }   // the stake coming back is not "earned"
  if (p.box) S.boxes[p.box]++;
  if (p.heat && !isOD()) rt.heat = Math.min(HEAT.max, rt.heat + p.heat);
  S.gyro.best = Math.max(S.gyro.best, p.m);
  if (p.m >= 2.5) S.gyro.hits3++;
  if (p.m >= 7) S.gyro.hits5++;
  rt.gyroPrize = {...p, stake};
  persist(); hud();
  const el = $('#gyroWheel');
  if (p.credits) floatNum(el, `+${fmt(p.credits)} ⚡`, p.m >= 7 ? 'crit' : '');
  if (p.od) startOverdrive();                                              // persists and refreshes the controls itself
  if (p.kind === 'credits' && p.m < 1) { sfx.temperFail(); burst(el, 16, ['#6b7a99', '#00f0ff', '#ffffff']); }
  else { sfx.fanfare(Math.min(5, Math.round(p.m) + 2)); vibrate(p.m >= 2.5 ? [40, 30, 90] : 25); }
  if (p.kind === 'jackpot') { burst(el, 140, ['#ff3366', '#ffcc33', '#ffffff', '#00f0ff']); $('#gyro')?.classList.add('flash'); shake($('#screen'), true); screenSlice('#ff3366'); }
  else if (p.m >= 2.5 || p.box) burst(el, 50, [p.c, '#ffffff']);
  if (p.box) toast(`Бесплатный кейс «${CONTAINERS.find(c => c.id === p.box).n}» — открой его в Магазине`);
}

/** paid = false: the spin was funded by an ad (the rescue spin, or «крутить ещё» without credits). */
function gyroSpin(stake, paid = true) {
  if (!rt.wheel || rt.wheel.spinning || rt.duel || !stake) return;
  if (paid) {
    if (S.credits < stake) { toast('Не хватает кредитов'); return; }
    S.credits -= stake; S.gyro.wagered += stake;
  }
  S.gyro.spins++;
  rt.gyroPrize = null;
  const i = rt.forceGyro ?? spinIndex(), sec = sectorOf(i);
  rt.forceGyro = null;
  persist(); hud();
  $('#gyro')?.classList.remove('flash');
  rt.wheel.spinTo(i, REDUCED ? 0 : GYRO.spinMs, () => {            // also runs at once if the player leaves the forge mid-spin
    settlePrize(prizeOf(sec, stake, curLoc().mult), stake);
    if (sec.kind !== 'jackpot' && nearJackpot(i)) toast('Чуть-чуть до ДЖЕКПОТА ×7!');
    renderGyro();
  });
  renderGyro();
}

/** The ad button: a rescue spin for a player who can't afford a stake. */
async function gyroAd() {
  if (rt.gyroAdBusy || !rt.wheel || rt.wheel.spinning || rt.duel) return;
  if (betFor(S.credits, rt.gyroShare, curLoc().mult)) return;           // only for a player who can't afford a stake
  rt.gyroAdBusy = true; renderGyro();
  let ok = false;
  try { ok = await showRewarded(PLACEMENTS.GYRO); }                   // never throws; false on close, error or a busy ad layer
  finally { rt.gyroAdBusy = false; }
  if (!ok) { toast('Реклама не досмотрена: спина нет'); renderGyro(); return; }
  gyroSpin(minBet(curLoc().mult), false);
}

/** ×2 on the credits just won, funded by an ad. Once per prize. */
async function gyroDouble() {
  const p = rt.gyroPrize;
  if (rt.gyroAdBusy || !p?.credits || p.doubled || rt.wheel?.spinning) return;
  rt.gyroAdBusy = true; renderGyro();
  let ok = false;
  try { ok = await showRewarded(PLACEMENTS.GYRO); }
  finally { rt.gyroAdBusy = false; }
  if (!ok) { toast('Реклама не досмотрена: награда не удвоена'); renderGyro(); return; }
  if (rt.gyroPrize !== p) { renderGyro(); return; }                   // the player span again while the ad played
  S.credits += p.credits; S.gyro.returned += p.credits;
  rt.gyroPrize = {...p, doubled: true};
  sfx.coin(); floatNum($('#gyroWheel'), `+${fmt(p.credits)} ⚡`);
  toast('Награда удвоена!'); persist(); hud(); renderGyro();
}

function toggleLock(s) {
  if (!rt.cur || rt.spin) return;
  if (rt.locks[s]) delete rt.locks[s];
  else if (lockCount() >= MAX_LOCKS) return toast(`Можно закрыть максимум ${MAX_LOCKS} слота`);
  else rt.locks[s] = true;
  sfx.lock(); vibrate(10); updateForgeControls();
}

function reroll(free) {
  if (!rt.cur || rt.spin || rt.temper || rt.duel) return;
  const n = lockCount();
  if (!n) { toast('Закрой замком 1–2 удачных слота — остальные перекуются'); return; }
  const prev = rt.cur, cost = rerollCost(locById(prev.a.loc).mult, n);
  // The Arsenal copy this re-forge may upgrade: the shown artifact itself, or the one a weaker re-forge stayed bound to.
  const bindId = prev.id ?? prev.bind ?? null, bound = bindId != null ? S.arsenal.find(x => x.id === bindId) : null;
  if (!free) {
    if (S.credits < cost) { toast('Не хватает кредитов'); return; }
    S.credits -= cost; hud();
  }
  const od = isOD();
  const r = bestOf(prev.a.loc, 1 + S.up.luck + (od ? OVERDRIVE.luck : 0), Math.random, rt.locks, prev.a);
  rt.stage?.setArtifact(null);
  rt.stage?.strike({delay: REDUCED ? 0 : 600 - IMPACT_DELAY, power: 1.3});
  spinSlots(r.a, SLOTS.filter(s => !rt.locks[s]), REDUCED ? 0 : 600, () => {
    S.stats.rerolls++; progress('reroll', 1); discover(r.a, true);
    if (r.e.tier >= KEEP_TIER) progress('rare', 1);
    let id = null, bind = null;
    if (bound && r.e.score >= bound.score) id = storeArtifact(r.a, r.e, bound.id);                  // upgrade in place
    else if (bound) { bind = bound.id; toast('Вышло слабее — прежний артефакт остался в Арсенале'); } // stay bound: the next re-forge compares with it again
    else if (r.e.tier >= KEEP_TIER) id = storeArtifact(r.a, r.e);
    rt.cur = {...r, id, bind};
    if (!S.stats.best || r.e.score > S.stats.best.score) S.stats.best = {...r.a, score: r.e.score, tier: r.e.tier, power: r.e.power};
    announce(r.e, 0, id, 'loud');
    stageReveal(rt.cur, 'reroll');
    persist(); hud(); updateForgeControls();
    if (id != null && r.e.tier >= KEEP_TIER) startTemper();
  });
  updateForgeControls();
}

function startOverdrive() {
  rt.odUntil = performance.now() + OVERDRIVE.ms; rt.heat = 0;
  S.stats.overdrives++; progress('overdrive', 1);
  document.body.classList.add('od');
  sfx.siren(); vibrate([80, 40, 80]);
  toast('OVERDRIVE! 12 секунд: кредиты ×3, удача +2');
  persist(); updateForgeControls();
}

/* ---------- Perfect Temper mini-game: Rare+ only, 1.4 s, hit the gold zone for +25% power ---------- */

const TEMPER_MS = 1400;
// The bar appears mid-combo, so the first 320 ms are a telegraph: a gold flash plays, the marker holds at 0
// and taps are swallowed (they still feed the combo). Without it fast tapping always skipped the quench.
const TEMPER_LEAD = 320;
function startTemper() {
  const el = $('#temper');
  if (!el || !rt.cur || rt.cur.id == null || rt.cur.tempered) return;
  const zone = {from: 0.38 + Math.random() * 0.34, width: 0.16};
  const lead = REDUCED ? 0 : TEMPER_LEAD, now = performance.now();
  rt.temper = {t0: now + lead, guardUntil: now + lead, zone};
  rt.cur.canRetry = false;
  el.hidden = false;
  el.querySelector('.zone').style.cssText = `left:${zone.from * 100}%;width:${zone.width * 100}%`;
  el.classList.remove('lead'); void el.offsetWidth;
  if (lead) { el.classList.add('lead'); setTimeout(() => el.classList.remove('lead'), lead); }
  const b = $('#forgeBtn'); b.textContent = 'ЗАКАЛИТЬ!'; b.classList.add('temper-mode');
  $('#temperTxt').textContent = S.tut === 2 ? 'Жми ЗАКАЛИТЬ, когда белая черта в золотой зоне: +25% мощи' : 'Жми в золотой зоне!';
  if (lead) sfx.riser(0.5);
  updateForgeControls();                                              // re-forge buttons are off while tempering
}
const temperPos = () => Math.min(1, Math.max(0, (performance.now() - rt.temper.t0) / TEMPER_MS));

/** pos: marker position when pressed, or null when time ran out. quiet: the player left the forge. */
function endTemper(pos, quiet = false) {
  const tp = rt.temper, cur = rt.cur;
  rt.temper = null;
  const el = $('#temper'); if (el) el.hidden = true;
  const b = $('#forgeBtn'); if (b) { b.textContent = 'КОВАТЬ'; b.classList.remove('temper-mode'); }
  updateForgeControls();
  if (!tp || !cur) return;
  const ok = pos !== null && inZone(pos, tp.zone);
  if (ok) {
    const art = S.arsenal.find(x => x.id === cur.id);
    if (art && !art.tempered) { art.tempered = true; art.power = Math.round(art.power * 1.25); }
    cur.tempered = true; cur.canRetry = false;
    S.stats.tempers++; S.stats.temperStreak++; S.stats.temperBest = Math.max(S.stats.temperBest, S.stats.temperStreak);
    persist();
  } else {
    cur.canRetry = !cur.retried;                                       // one ad-funded retry per artifact
    if (!quiet) S.stats.temperStreak = 0;
  }
  if (!quiet && S.tut === 2) { S.tut = 3; persist(); toast('Отряд готов! Испытай его на Арене'); $('[data-tab="arena"]')?.classList.add('tut-pulse'); }
  if (quiet) return;
  if (ok) { sfx.temperOk(); vibrate([30, 30, 60]); toast('★ Идеальная закалка! Мощь +25%'); } else sfx.temperFail();
  rt.stage?.quench(ok); rt.stage?.setArtifact(artLook(cur));
  announce(cur.e, null, cur.id, 'quiet');
}

/* ---------- arena ---------- */

function renderArena() {
  ensureBots();
  if (rt.duel) return rt.duel.done ? renderResult() : renderDuel();
  const sq = squad(S.arsenal), power = squadPower(S.arsenal), li = leagueOf(S.trophies), lg = LEAGUES[li], next = LEAGUES[li + 1];
  $('#screen').innerHTML = `<section class="view arena">
    <div class="card league arena-hero" style="--art:url('${bgUrl('arena')}');--lc:${LEAGUE_COLORS[li]}">
      <div class="row">${emblem(li)}<div class="grow"><div class="label">Лига</div><div class="league-name">${lg.n}</div></div>
        <div class="big num">${icon('trophy')}${fmt(S.trophies)}</div></div>
      ${next ? `<div class="prog"><i style="width:${(S.trophies - lg.min) / (next.min - lg.min) * 100}%"></i></div>
                <div class="small">До лиги «${next.n}»: <span class="num">${fmt(next.min - S.trophies)}</span> кубков</div>` : '<div class="small">Высшая лига — держи позицию!</div>'}
      ${S.streak > 1 ? `<div class="streak">Серия побед: <b class="num">${S.streak}</b></div>` : ''}
    </div>
    <h2>Боевой отряд <span class="squad-total">Общая мощь <b class="num accent">${fmt(power)}</b></span></h2>
    <div class="pedestals">${[0, 1, 2].map(i => pedestal(sq[i], i)).join('')}</div>
    <p class="small">Сила тапа в бою: <b class="num">${tapPower(S.up.strike)}</b> · соперники твоего рейтинга: ~<span class="num">${fmt(ARENA.oppBase + ARENA.oppPerTrophy * S.trophies)}</span> мощи</p>
    <button class="forgebtn fight" data-act="duel">${icon('swords')}В БОЙ · 10 сек</button>
    <h2>Мини-игры 1×1</h2>
    <div class="minis">${MINI.map(m => `<button class="mini-card" data-act="mini" data-id="${m.id}">${icon(m.icon)}<b>${m.n}</b><small>${m.d}</small>
      <span class="mini-stake num">${icon('coin')}${fmt(miniFee(curLoc().mult))} → +${fmt(miniPrize(curLoc().mult))}</span></button>`).join('')}</div>
    <h2>Сезон ${S.season} · ${lg.n}</h2>
    <ol class="board">${leaderboard(S.bots, S.trophies).map(r =>
      `<li class="${r.me ? 'me' : ''}"><span class="num">${r.rank}</span><span class="grow">${r.name}</span><b class="num">${fmt(r.t)}</b></li>`).join('')}</ol>
    ${ONLINE ? `<h2>Глобальный топ-50</h2>
      <div class="card"><label class="small" for="nickInput">Твой ник в рейтинге</label>
        <div class="row nick-row"><input id="nickInput" class="nick-input" maxlength="24" autocomplete="nickname" spellcheck="false"><button class="btn" data-act="rename">Сохранить</button></div></div>
      <ol class="board" id="globalTop"><li class="small">Загрузка…</li></ol>` : ''}
    ${syndicateArenaHtml(S, sq)}
  </section>`;
  if (!ONLINE) return;
  $('#nickInput').value = nickname();
  fetchOpponent(S.trophies).then(r => { rt.nextOpp = r?.opponent ? {p: r.opponent, at: Date.now()} : null; });   // the next duel meets a real player
  fetchTop().then(r => {
    const list = $('#globalTop');
    if (!list) return;
    list.innerHTML = '';
    const rows = r?.top ?? [];
    if (!rows.length) { list.innerHTML = `<li class="small">${r ? 'Пока пусто — стань первым!' : 'Нет связи с сервером: играем с ботами'}</li>`; return; }
    for (const row of rows) {                                           // names come from other players: text only
      const li = document.createElement('li');
      li.innerHTML = '<span class="num"></span><span class="grow"></span><b class="num"></b>';
      li.children[0].textContent = row.rank; li.children[1].textContent = row.name; li.children[2].textContent = fmt(row.trophies);
      list.append(li);
    }
  });
}

function startDuel() {
  if (rt.spin) rt.spin.finish();
  ensureBots();
  const real = rt.nextOpp && Date.now() - rt.nextOpp.at < 120000 ? rt.nextOpp.p : null;   // a real player from /api/arena, else a bot
  rt.nextOpp = null;
  rt.duel = {opp: real ? opponentFromPlayer(real) : makeOpponent(S.trophies, S.bots), player: squadPower(S.arsenal), done: false, result: null, doubled: false,
             mine: squad(S.arsenal)[0] ?? forge(S.loc), theirs: real?.squad?.[0] ?? forge(S.loc),
             el: 0, lastReal: 0, speed: rt.duelSpeed ?? 1, exchanged: 0, oppRaw: null, oppOffset: 0, shieldUntil: -1, reflected: 0, reflectAcc: 0,
             cd: Object.fromEntries(ARENA.abilities.map(a => [a.id, 0]))};
  renderDuel();
}

function renderDuel() {
  const d = rt.duel;
  $('#screen').innerHTML = `<section class="view duel">
    <div class="duel-top">
      <div class="fighter me"><div class="f-head"><span>Ты</span><b class="num" id="dMe">0</b></div><div class="bar"><i id="barMe"></i></div></div>
      <div class="duel-timer num" id="dTimer">10.0</div>
      <div class="fighter opp"><div class="f-head"><b class="num" id="dOpp">0</b><span id="oppName"></span></div><div class="bar"><i id="barOpp"></i></div></div>
    </div>
    <canvas id="duelScene" class="duel-scene" aria-hidden="true"></canvas>
    <div class="duel-bar">
      <div class="duel-abilities" role="group" aria-label="Умения">${ARENA.abilities.map((a, i) =>
        `<button class="ability" id="ab-${a.id}" data-act="duelAbility" data-id="${i}" style="--cd:0">
           <span class="ability-ic" aria-hidden="true">${a.ic}</span><b>${a.n}</b><small class="num" id="cd-${a.id}">ГОТОВО</small></button>`).join('')}</div>
      <div class="duel-speed" role="group" aria-label="Скорость боя">${ARENA.speeds.map(s =>
        `<button class="chip ${s === d.speed ? 'on' : ''}" data-act="duelSpeed" data-id="${s}" aria-pressed="${s === d.speed}">×${s}</button>`).join('')}</div>
    </div>
    <p class="small center">Клинки бьются сами. Твоё дело — умения: ⚡ урон, 🛡️ отражает атаку, 🔥 ульта.</p>
  </section>`;
  rt.duelStage?.stop();
  $('#oppName').textContent = d.opp.real ? `${d.opp.name} · игрок` : d.opp.name;   // another player's nickname: text only
  rt.duelStage = createDuelStage($('#duelScene'), d.mine, d.theirs);
  rt.duelStage.start();
}

/** Cooldown rings and labels. Called every frame: touches style only, never re-renders the duel. */
function duelControls() {
  const d = rt.duel;
  for (const a of ARENA.abilities) {
    const b = $('#ab-' + a.id), lab = $('#cd-' + a.id);
    if (!b) continue;
    const left = Math.max(0, d.cd[a.id] - d.el), ready = left <= 0;
    b.style.setProperty('--cd', (left / a.cd).toFixed(3));
    b.classList.toggle('ready', ready);
    b.classList.toggle('active', a.id === 'shield' && d.el < d.shieldUntil);
    if (lab) lab.textContent = ready ? 'ГОТОВО' : `${(left / 1000).toFixed(1)} с`;
  }
}

function duelFrame(now) {
  const d = rt.duel;
  const real = d.lastReal ? Math.min(100, now - d.lastReal) : 0;        // a backgrounded tab must not dump seconds into one frame
  d.lastReal = now;
  d.el = Math.min(ARENA.duelMs, d.el + real * d.speed);
  const p = d.el / ARENA.duelMs;

  const step = 1000 / ARENA.autoPerSec, tp = tapPower(S.up.strike);     // the blades trade blows on their own
  while ((d.exchanged + 1) * step <= d.el) {
    d.exchanged++;
    d.player += tp;
    rt.duelStage?.hit(d.exchanged % 3 === 2 && d.el >= d.shieldUntil ? -1 : 1);   // every third blow is the rival's, unless the shield is up
    sfx.hit();
  }

  const raw = opponentAt(d.opp, p), gain = Math.max(0, raw - (d.oppRaw ?? raw));
  d.oppRaw = raw;
  if (d.el < d.shieldUntil && gain > 0) {                               // the shield eats the rival's advance and throws part of it back
    d.oppOffset += gain;
    // The fraction is carried between frames: rounding each frame's sliver on its own would round
    // a 0.6 share up to a full point every time and quietly make the shield a 100% reflect.
    d.reflectAcc += gain * ARENA.abilities.find(a => a.id === 'shield').reflect;
    const whole = Math.floor(d.reflectAcc);
    if (whole > 0) { d.reflectAcc -= whole; d.player += whole; d.reflected += whole; }
  }
  const opp = Math.max(0, raw - d.oppOffset);

  const bar = $('#barMe');
  if (bar) {
    const scale = Math.max(d.opp.total * 1.15, d.player, opp);
    bar.style.width = `${d.player / scale * 100}%`;
    $('#barOpp').style.width = `${opp / scale * 100}%`;
    $('#dMe').textContent = fmt(d.player); $('#dOpp').textContent = fmt(opp);
    $('#dTimer').textContent = ((1 - p) * ARENA.duelMs / 1000).toFixed(1);
    $('.fighter.me').classList.toggle('lead', d.player >= opp);
    $('.view.duel')?.classList.toggle('shielded', d.el < d.shieldUntil);
    rt.duelStage?.setRatio(d.player / (d.player + opp || 1));
    duelControls();
  }
  if (p >= 1) finishDuel();
}

/** One of the three tactical abilities. Cooldowns run on duel time, so ×2 speed cools them down twice as fast too. */
function duelAbility(idx) {
  const d = rt.duel, ab = ARENA.abilities[+idx];
  if (!d || d.done || !ab || d.el < d.cd[ab.id]) return;
  d.cd[ab.id] = d.el + ab.cd;
  const scene = $('#duelScene');
  if (ab.id === 'shield') {
    d.shieldUntil = d.el + ab.ms;
    rt.duelStage?.guard(ab.ms / d.speed);
    sfx.lock(); floatNum(scene, 'ЩИТ'); vibrate(18);
  } else {
    const dmg = tapPower(S.up.strike) * ab.mult, ult = ab.id === 'ult';
    d.player += dmg;
    rt.duelStage?.hit(1, ult ? 2.4 : 1.4);
    floatNum(scene, `${fmt(dmg)}${ult ? ' КРИТ!' : ''}`, ult ? 'crit' : '');
    if (ult) { sfx.siren(); shake($('#screen'), true); burst(scene, 90, ['#ff3366', '#ffcc33', '#ffffff']); screenSlice('#ff3366'); vibrate([60, 40, 120]); }
    else { sfx.impact(1.4); vibrate(22); }
  }
  const b = $('#ab-' + ab.id);
  b?.classList.remove('punch'); void b?.offsetWidth; b?.classList.add('punch');
  duelControls();
}

function finishDuel() {
  const d = rt.duel;
  d.done = true;
  rt.duelStage?.stop(); rt.duelStage = null;
  const out = d.result = duelOutcome(d.player, d.opp, {trophies: S.trophies, streak: S.streak, locMult: curLoc().mult});
  out.credits = Math.round(out.credits * (1 + bonuses(S).arena));     // Arena bonus from achievements
  S.trophies = Math.max(0, S.trophies + out.dTrophies); S.streak = out.streak;
  S.stats.maxStreak = Math.max(S.stats.maxStreak ?? 0, S.streak);
  S.stats.duels++; out.win ? S.stats.wins++ : S.stats.losses++;
  if (out.win) progress('wins', 1);
  addCredits(out.credits);
  S.bots = tickBots(S.bots);
  persist(); hud(); renderResult();
  if (out.win) { sfx.victory(); burst($('.res-title'), 160, ['#ffcc33', '#00f0ff', '#ffffff']); vibrate([50, 30, 50, 30, 120]); }
  else { sfx.defeat(); vibrate(200); }
}

function renderResult() {
  const d = rt.duel, o = d.result;
  $('#screen').innerHTML = `<section class="view duel result ${o.win ? 'win' : 'lose'}">
    <div class="res-title">${o.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</div>
    <div class="res-score num">${fmt(d.player)} : ${fmt(d.opp.total)}</div>
    <div class="res-rows card">
      <div class="row"><span class="grow">Кубки</span><b class="num">${o.dTrophies >= 0 ? '+' : ''}${o.dTrophies}</b></div>
      <div class="row"><span class="grow">Кредиты</span><b class="num">+${fmt(o.credits)}</b></div>
      ${o.win && S.streak > 1 ? `<div class="row"><span class="grow">Серия побед</span><b class="num">${S.streak}</b></div>` : ''}
      ${d.reflected ? `<div class="row"><span class="grow">Отражено щитом</span><b class="num">${fmt(d.reflected)}</b></div>` : ''}
    </div>
    ${o.win && !d.doubled ? `<button class="btn ad wide" data-act="double">${icon('play')}×2 кредиты и +${ARENA.adBonusTrophies} кубков</button>` : ''}
    ${d.doubled ? '<p class="small center">Награда удвоена ✓</p>' : ''}
    ${!o.win ? '<p class="small center">Совет: закрой замком сильный индекс и перекуй остальное — отряд станет мощнее.</p>' : ''}
    <button class="forgebtn" data-act="duelDone">ПРОДОЛЖИТЬ</button>
  </section>`;
}

async function doubleReward() {
  const d = rt.duel;
  if (!d?.result?.win || d.doubled) return;
  if (await showRewarded(PLACEMENTS.DOUBLE)) {
    d.doubled = true; addCredits(d.result.credits); S.trophies += ARENA.adBonusTrophies;
    sfx.coin(); toast('Награда удвоена!'); persist(); hud();
  }
  if (rt.duel === d) renderResult();
}

/** Interstitial goes here and only here: after every 3rd finished duel, never during forging. */
async function duelDone(nextTab = 'arena') {
  if (!rt.duel?.done) return;
  rt.duel = null;
  if (S.stats.duels % ARENA.interstitialEvery === 0) await showInterstitial(PLACEMENTS.INTERSTITIAL);
  show(nextTab);
}

/* ---------- league emblem & squad pedestals ---------- */

const LEAGUE_COLORS = ['#8b97ad', '#cd7f32', '#c9d3e6', '#ffcc33', '#7fe3ff', '#b06bff', '#ff3366'];
function emblem(li) {                                   // hexagon crest, one more star per league
  const c = LEAGUE_COLORS[li], n = Math.min(li, 6), stars = Array.from({length: n}, (_, i) =>
    `<circle cx="${32 + (i - (n - 1) / 2) * 8}" cy="56" r="2.2" fill="${c}"/>`).join('');
  return `<svg class="emblem" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="emb${li}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0b0f1a"/></linearGradient></defs>
    <path d="M32 3l25 14v28L32 61 7 45V17z" fill="url(#emb${li})" stroke="${c}" stroke-width="2"/>
    <path d="M32 11l18 10v20L32 51 14 41V21z" fill="#0b0f1a" stroke="${c}" stroke-opacity=".6"/>
    <text x="32" y="38" text-anchor="middle" font-family="Orbitron, monospace" font-weight="900" font-size="15" fill="${c}">${LEAGUES[li].n[0]}</text>${stars}</svg>`;
}
function pedestal(a, i) {                               // best weapon in the middle, raised
  if (!a) return `<div class="pedestal empty p${i}"><div class="ped-art">${icon('lock')}</div><small>Выкуй «Редкий»+</small><div class="ped-base"></div></div>`;
  const t = TIERS[a.tier], rank = Math.min(5, Math.max(a.wp.r, a.el.r));
  return `<div class="pedestal p${i}" style="--tc:${t.c}">
    <div class="ped-art"><img src="${weaponThumb(a)}" alt="${a.el.n} · ${a.wp.n}" width="120" height="48"></div>
    <div class="ped-rank"><b>${rank >= 5 ? 'Ω' : ROMAN[rank] || 'I'}</b> ${t.n}</div>
    <div class="ped-pow num">${icon('bolt')}${fmt(a.power)}</div>
    <div class="ped-base"></div></div>`;
}

/* ---------- mini-games 1×1: a rival from the arena pool, its play simulated from its rating ---------- */

function startMini(id) {
  if (rt.duel || rt.mini || !MINI.some(m => m.id === id)) return;
  const fee = miniFee(curLoc().mult);
  if (S.credits < fee) { toast('Не хватает кредитов'); return; }
  ensureBots();
  S.credits -= fee; persist(); hud();
  const real = rt.nextOpp && Date.now() - rt.nextOpp.at < 120000 ? rt.nextOpp.p : null;
  rt.nextOpp = null;
  const bot = makeOpponent(S.trophies, S.bots), opp = real ? {name: real.name, trophies: real.trophies, real: true} : {name: bot.name, trophies: bot.trophies};
  rt.mini = {id, opp, skill: rivalSkill(opp.trophies), noise: Math.random(), phase: 'intro', mine: 0, round: 0, scores: [], raf: 0, timer: 0, res: null};
  if (id === 'aim') rt.mini.rival = Array.from({length: MINI_CFG.aimRounds}, () => rivalAim(rt.mini.skill));
  renderMini();
}

function miniStop() {
  const m = rt.mini;
  if (!m) return;
  cancelAnimationFrame(m.raf); clearTimeout(m.timer);
  rt.mini = null;
}

const MINI_AREA = {
  react: () => '<div class="react-lamp" id="reactLamp"><span>ЖДИ</span></div>',
  tug: () => `<div class="tug"><i class="tug-cable"></i><i class="tug-zone me"></i><i class="tug-zone opp"></i><i class="tug-knot" id="tugKnot"></i></div>
    <div class="tug-score num"><span id="tugMe">0</span><span id="tugOpp">0</span></div>`,
  aim: () => `<div class="aim"><i class="aim-zone"></i><i class="aim-marker" id="aimMarker"></i></div><div class="aim-scores num" id="aimScores"></div>`,
};

function renderMini() {
  const m = rt.mini, def = MINI.find(x => x.id === m.id);
  $('#screen').innerHTML = `<section class="view mini mini-${m.id}" style="--art:url('${bgUrl('arena')}')">
    <div class="mini-head"><span class="me">Ты</span><b>VS</b><span class="opp" id="miniOpp"></span></div>
    <div class="mini-title">${icon(def.icon)}${def.n}</div>
    <div class="mini-area" id="miniArea">${MINI_AREA[m.id]()}</div>
    <div class="mini-msg" id="miniMsg" aria-live="polite"></div>
    <div class="mini-ctrl" id="miniCtrl"><button class="forgebtn fight" id="miniBtn" disabled>ГОТОВЬСЯ</button></div>
  </section>`;
  $('#miniOpp').textContent = m.opp.real ? `${m.opp.name} · игрок` : m.opp.name;            // another player's nickname: text only
  $('#miniBtn').addEventListener('pointerdown', e => { e.preventDefault(); miniTap(); });
  let n = 3;
  const count = () => {
    if (rt.mini !== m) return;
    if (n) { $('#miniMsg').textContent = n--; sfx.tick(); m.timer = setTimeout(count, 550); }
    else miniGo();
  };
  count();
}

function miniGo() {
  const m = rt.mini, btn = $('#miniBtn'), msg = $('#miniMsg');
  btn.disabled = false;
  if (m.id === 'react') {
    m.phase = 'wait'; msg.textContent = 'Жди сигнала…'; btn.textContent = 'ЖДИ…';
    m.timer = setTimeout(() => {
      if (rt.mini !== m) return;
      m.phase = 'go'; m.goAt = performance.now();
      $('#reactLamp').classList.add('go'); $('#reactLamp span').textContent = 'ЖМИ!';
      msg.textContent = 'СЕЙЧАС!'; btn.textContent = 'ЖМИ!'; sfx.impact(1); vibrate(20);
      m.timer = setTimeout(() => miniEnd(false, 'Слишком медленно'), MINI_CFG.reactTimeoutMs);
    }, 1200 + Math.random() * 2200);
    return;
  }
  m.phase = 'play'; m.t0 = performance.now();
  btn.textContent = m.id === 'tug' ? 'ТЯНИ!' : 'УДАР!';
  msg.textContent = m.id === 'tug' ? 'Тапай быстрее соперника!' : `Удар 1 из ${MINI_CFG.aimRounds}: останови метку в центре`;
  const loop = now => {
    if (rt.mini !== m || m.phase !== 'play') return;
    const el = now - m.t0;
    if (m.id === 'tug') {
      const theirs = rivalTaps(m.skill, el, () => m.noise), pos = tugPos(m.mine, theirs);
      $('#tugKnot').style.left = `${50 - pos * 42}%`;
      $('#tugMe').textContent = m.mine; $('#tugOpp').textContent = theirs;
      if (Math.abs(pos) >= 1 || el >= MINI_CFG.tugMs) return miniEnd(tugWin(m.mine, theirs), `Ты: ${m.mine} тапов · соперник: ${theirs}`);
    } else {
      m.pos = aimPos(el / 1000, m.round);
      $('#aimMarker').style.left = `${m.pos * 100}%`;
    }
    m.raf = requestAnimationFrame(loop);
  };
  m.raf = requestAnimationFrame(loop);
}

function miniTap() {
  const m = rt.mini;
  if (!m || m.res) return;
  if (m.id === 'react') {
    if (m.phase === 'wait') { clearTimeout(m.timer); miniEnd(false, 'Фальстарт: нажал до сигнала'); }
    else if (m.phase === 'go') {
      clearTimeout(m.timer);
      const ms = Math.round(performance.now() - m.goAt), rv = rivalReactionMs(m.skill);
      miniEnd(reactWin(ms, rv), `Ты: ${ms} мс · соперник: ${rv} мс`);
    }
    return;
  }
  if (m.phase !== 'play') return;
  if (m.id === 'tug') { m.mine++; sfx.hit(); vibrate(5); const b = $('#miniBtn'); b.classList.remove('punch'); void b.offsetWidth; b.classList.add('punch'); return; }
  const sc = aimScore(m.pos ?? 0);                                     // aim
  m.scores.push(sc); m.round++;
  sfx.impact(sc / 50); vibrate(sc >= 80 ? [20, 20, 40] : 15);
  burst($('#aimMarker'), sc >= 80 ? 30 : 8, sc >= 80 ? ['#ffcc33', '#ffffff'] : ['#8b97ad']);
  $('#aimScores').textContent = m.scores.map((x, i) => `${x}:${m.rival[i]}`).join('  ·  ');
  if (m.round >= MINI_CFG.aimRounds) {
    const a = m.scores.reduce((x, y) => x + y, 0), b = m.rival.reduce((x, y) => x + y, 0);
    miniEnd(a > b, `Ты: ${a} очков · соперник: ${b}`);
  } else $('#miniMsg').textContent = `Удар ${m.round + 1} из ${MINI_CFG.aimRounds}: метка ускоряется!`;
}

function miniEnd(win, detail) {
  const m = rt.mini;
  if (!m || m.res) return;
  cancelAnimationFrame(m.raf); clearTimeout(m.timer);
  m.phase = 'done'; m.res = {win};
  const prize = miniPrize(curLoc().mult);
  if (win) { addCredits(prize); persist(); hud(); sfx.victory(); burst($('#miniArea'), 110, ['#ffcc33', '#00f0ff', '#ffffff']); vibrate([40, 30, 90]); }
  else { sfx.defeat(); vibrate(120); }
  const msg = $('#miniMsg');
  msg.innerHTML = `<b class="${win ? 'win' : 'lose'}">${win ? `ПОБЕДА +${fmt(prize)}` : 'ПОРАЖЕНИЕ'}</b><small></small>`;
  msg.querySelector('small').textContent = detail;
  $('#miniCtrl').innerHTML = `<div class="row2"><button class="btn" data-act="miniAgain">Ещё раз · <span class="num">${fmt(miniFee(curLoc().mult))}</span></button>
    <button class="btn ghost" data-act="miniExit">К арене</button></div>`;
}

/* ---------- arsenal ---------- */

const arsNav = () => `<div class="subtabs" role="group" aria-label="Раздел">${[['stock', 'Склад'], ['runes', 'Руны'], ['dex', 'Витрина']].map(([id, n]) =>
  `<button class="chip ${rt.arsTab === id ? 'on' : ''}" data-act="arsTab" data-id="${id}" aria-pressed="${rt.arsTab === id}">${n}</button>`).join('')}
  <button class="chip" data-act="openTrade">🤝 Трейд P2P</button></div>`;

function renderArsenal() {
  if (rt.arsTab === 'dex') { $('#screen').innerHTML = `<section class="view">${arsNav()}${showcaseHtml(S)}</section>`; return; }
  if (rt.arsTab === 'runes') { $('#screen').innerHTML = `<section class="view">${arsNav()}${runesSubtabHtml(S)}</section>`; return; }
  const inSquad = new Set(squad(S.arsenal).map(a => a.id)), list = [...S.arsenal].sort((a, b) => b.power - a.power);
  $('#screen').innerHTML = `<section class="view">
    ${arsNav()}
    <h2>Арсенал <span class="num">${S.arsenal.length}/${ARSENAL_MAX}</span></h2>
    <p class="small">Топ-3 по мощи сами встают в боевой отряд. Разгоняй клинки в Оверклоке или меняйся в P2P-трейде.</p>
    <div class="v2-row2" style="margin-bottom:10px;">
      <button class="btn ghost" data-act="sellRare">Продать «Редкие»</button>
      <button class="btn oc-btn" data-act="openTrade">🤝 Чёрный рынок (Трейд)</button>
    </div>
    <div class="arsenal">${list.length ? list.map(a => `<div class="arsrow">${artCard(a)}
        <div class="ars-actions">${inSquad.has(a.id) ? '<span class="badge">В ОТРЯДЕ</span>' : ''}
          <button class="btn small oc-btn" data-act="openOc" data-id="${a.id}">🔥 ${a.oc ? `+${a.oc}` : 'Разгон'}</button>
          <button class="btn small share-btn" data-act="shareCard" data-id="${a.id}" title="Карточка для Telegram">📸</button>
          <button class="btn small" data-act="sell" data-id="${a.id}">Продать <span class="num">${fmt(sellPrice(a))}</span></button></div></div>`).join('')
      : '<div class="card small">Пусто. Артефакты «Редкий» и выше попадают сюда сами.</div>'}</div>
  </section>`;
}

/* ---------- shop ---------- */

function smugglerLeft() { return Math.max(0, S.smugglerAt + CONTAINERS[0].cooldownMs - Date.now()); }
const mmss = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function renderShop() {
  const pips = (id, max) => `<div class="pips">${Array.from({length: max}, (_, i) => `<i class="${i < S.up[id] ? 'on' : ''}"></i>`).join('')}</div>`;
  $('#screen').innerHTML = `<section class="view">
    <h2>Апгрейды</h2>
    ${Object.entries(UPGRADES).map(([id, u]) => {
      const max = S.up[id] >= u.max, c = upgradeCost(u, S.up[id]);
      return `<div class="card row"><div class="grow"><b>${u.n}</b><div class="small">${u.d}</div>${pips(id, u.max)}</div>
        <button class="btn" data-act="up" data-id="${id}" ${max || S.credits < c ? 'disabled' : ''}>${max ? 'МАКС' : `<span class="num">${fmt(c)}</span>`}</button></div>`;
    }).join('')}
    <h2>Контейнеры</h2>
    ${CONTAINERS.map(c => {
      const left = c.ad ? smugglerLeft() : 0;
      return `<div class="card row"><div class="grow"><b>${c.n}</b><div class="small">${c.d}. Артефакт сразу в Арсенал.</div></div>
        ${c.ad ? `<button class="btn ad" id="smugBtn" data-act="container" data-id="${c.id}" ${left ? 'disabled' : ''}>${left ? `<span class="num">${mmss(left)}</span>` : `${icon('play')}Открыть`}</button>`
               : S.boxes[c.id] > 0 ? `<button class="btn" data-act="container" data-id="${c.id}">Бесплатно <span class="num">×${S.boxes[c.id]}</span></button>`
               : `<button class="btn" data-act="container" data-id="${c.id}" ${S.credits < c.cost ? 'disabled' : ''}><span class="num">${fmt(c.cost)}</span></button>`}</div>`;
    }).join('')}
    <h2>Локации</h2>
    ${LOCATIONS.map(l => `<div class="card row" style="--h:${l.hue}"><div class="grow"><b class="loc-name">${l.name}</b><div class="small">Кредиты и мощь ×${l.mult}</div></div>
      ${S.unlocked.includes(l.id) ? '<span class="small">Открыто ✓</span>'
        : `<button class="btn" data-act="unlock" data-id="${l.id}" ${S.credits < l.cost ? 'disabled' : ''}><span class="num">${fmt(l.cost)}</span></button>`}</div>`).join('')}
  </section>`;
}

async function openContainer(id) {
  const c = CONTAINERS.find(x => x.id === id);
  if (!c || rt.spin || rt.duel || rt.caseBusy) return;
  if (c.ad) {
    if (smugglerLeft()) return;
    if (!(await showRewarded(PLACEMENTS.CONTAINER))) return;
    S.smugglerAt = Date.now();
  } else if (S.boxes[c.id] > 0) S.boxes[c.id]--;                  // a free container won from an achievement
  else {
    if (S.credits < c.cost) { toast('Не хватает кредитов'); return; }
    S.credits -= c.cost;
  }
  persist(); hud();
  // The artifact is rolled up front so the opening show can light itself in the right rarity colour;
  // forgeTap then reveals exactly that roll through rt.forceNext.
  const r = bestOf(S.loc, c.tries);
  rt.caseBusy = true;
  try {
    sfx.riser(0.3);
    await playCaseOpen({color: TIERS[r.e.tier].c, name: c.n.toUpperCase(), onSpark: () => { sfx.crack(); vibrate(14); }});
  } finally { rt.caseBusy = false; }
  rt.forceNext = r;
  show('forge'); forgeTap(c);
}

/* ---------- quests ---------- */

function renderQuests() {
  const st = S.stats, n = readyToClaim(S).length;
  const nav = `<div class="subtabs" role="group" aria-label="Раздел">${[['contracts', 'Контракты', ''], ['ach', 'Достижения', n ? `<span class="count num">${n}</span>` : '']].map(([id, t, extra]) =>
    `<button class="chip ${rt.qTab === id ? 'on' : ''}" data-act="qTab" data-id="${id}" aria-pressed="${rt.qTab === id}">${t}${extra}</button>`).join('')}</div>`;
  if (rt.qTab === 'ach') { $('#screen').innerHTML = `<section class="view">${nav}${achHtml()}</section>`; return; }
  $('#screen').innerHTML = `<section class="view">
    ${nav}
    <h2>Контракты</h2>
    ${S.contracts.map((c, i) => {
      const t = CONTRACTS.find(x => x.k === c.k), done = c.p >= c.n;
      return `<div class="card"><div class="row"><div class="grow"><b>${t.t(c.n)}</b>
        <div class="small num">${fmt(c.p)} / ${fmt(c.n)} · награда ${fmt(c.reward)}</div></div>
        <button class="btn" data-act="claim" data-id="${i}" ${done ? '' : 'disabled'}>Забрать</button></div>
        <div class="prog"><i style="width:${Math.min(100, c.p / c.n * 100)}%"></i></div></div>`;
    }).join('')}
    <h2>Статистика</h2>
    <div class="card stats num">
      <span>Ковок</span><b>${fmt(st.forges)}</b><span>Перековок</span><b>${fmt(st.rerolls)}</b>
      <span>OVERDRIVE</span><b>${fmt(st.overdrives)}</b><span>Дуэлей / побед</span><b>${fmt(st.duels)} / ${fmt(st.wins)}</b>
      <span>Лучшее комбо</span><b>×${comboMult(st.maxCombo, COMBO).toFixed(2)}</b><span>Заработано</span><b>${fmt(st.credits)}</b>
      <span>Гиро-спинов</span><b>${fmt(S.gyro.spins)}</b><span>Гиро: ставки / возврат</span><b>${fmt(S.gyro.wagered)} / ${fmt(S.gyro.returned)}</b>
    </div>
    ${st.best ? `<h2>Лучший артефакт</h2>${artCard(st.best)}` : ''}
    <div class="card tiers">${TIERS.map((t, i) => `<span style="color:${t.c}">${t.n}</span><b class="num">${fmt(st.tiers[i])}</b>`).join('')}</div>
    ${CLOUD ? `<h2>Аккаунт</h2><div class="card row"><div class="grow">${currentUser()
        ? `<b class="acc-name"></b><div class="small">Прогресс сохраняется на сервере</div>`
        : '<b>Без входа</b><div class="small">Прогресс хранится только на этом устройстве</div>'}</div>
      ${currentUser() ? '<button class="btn ghost" data-act="logout">Выйти</button>' : '<button class="btn" data-act="auth">Войти</button>'}</div>` : ''}
    <button class="btn ghost wide" data-act="reset">Сбросить прогресс</button>
  </section>`;
  const acc = $('.acc-name');
  if (acc) acc.textContent = currentUser();                          // text, never HTML
}

/* ---------- actions ---------- */

const ACTIONS = {
  tab: id => show(id),
  loc: id => { S.loc = id; rt.cur = null; rt.locks = {}; persist(); renderForge(); },
  lock: id => toggleLock(id),
  reroll: () => reroll(false),
  rerollAd: async () => { if (rt.cur && lockCount() && !rt.spin && !rt.temper && await showRewarded(PLACEMENTS.REROLL)) reroll(true); },
  odAd: async () => { if (!isOD() && await showRewarded(PLACEMENTS.OVERDRIVE)) startOverdrive(); },
  temperAd: async () => {
    const cur = rt.cur;
    if (!cur?.canRetry || rt.temper || rt.spin) return;
    if (await showRewarded(PLACEMENTS.TEMPER) && rt.cur === cur) {
      cur.retried = true; cur.canRetry = false;
      announce(cur.e, null, cur.id, 'quiet'); startTemper();
    }
  },
  gyroOpen: () => { const d = $('#gyroDrawer'); if (!d) return; d.hidden = false; rt.wheel?.resize(); renderGyro(); d.querySelector('[data-act="gyroClose"]')?.focus(); },
  gyroClose: () => { const d = $('#gyroDrawer'); if (d) d.hidden = true; $('#gyroOpen')?.focus(); },
  gyroBet: id => { if (rt.wheel?.spinning) return; rt.gyroShare = +id; sfx.lock(); renderGyro(); },
  gyroSpin: () => gyroSpin(betFor(S.credits, rt.gyroShare, curLoc().mult)),
  gyroAd: () => gyroAd(),
  gyroDouble: () => gyroDouble(),
  arsTab: id => { rt.arsTab = id; renderArsenal(); scrollTo(0, 0); },
  sideTab: id => { rt.sideTab = id === 'contracts' ? 'contracts' : 'ach'; renderSides(); },
  openDex: () => { rt.arsTab = 'dex'; show('arsenal'); },
  openOc: id => openOverclockModal(+id, S, {persist, hud, toast, onDone: () => { if (rt.tab === 'arsenal') renderArsenal(); }}),
  openTrade: code => openTradeModal(S, {user: rt.tgUser, persist, hud, toast, onDone: () => { if (rt.tab === 'arsenal') renderArsenal(); }}, code || null),
  shareCard: id => {
    const a = S.arsenal.find(x => x.id === +id);
    if (!a) return;
    downloadWeaponCard(a, rt.tgUser?.name || nickname() || 'Кибер-Мастер');
    toast('📸 Карточка оружия сохранена! Кидай в Telegram-чат.');
  },
  bossStrike: () => {
    const sq = squad(S.arsenal);
    if (!sq.length) { toast('Сначала выкуй хотя бы 1 артефакт в Арсенал!'); return; }
    const r = strikeRaidBoss(S, sq, false);
    sfx.impact(1); tgHaptic('impact', 'medium', S.settings?.haptics !== false);
    if (r.killed) {
      sfx.victory(); burst(innerWidth / 2, innerHeight / 2, '#f59e0b', 34);
      toast(`🏆 Босс повержен! +${fmt(r.reward)} ⚡ и Чип-Руна «${r.runeDrop.name}»!`);
    } else toast(`⚔️ Урон по боссу: ${fmt(r.dmg)}${r.weakHit ? ' (УЯЗВИМОСТЬ ×1.6!)' : ''}`);
    persist(); hud(); renderArena();
  },
  bossFlux: () => {
    const sq = squad(S.arsenal);
    if (!sq.length || (S.flux || 0) <= 0) return;
    const r = strikeRaidBoss(S, sq, true);
    sfx.temperOk(); tgHaptic('impact', 'heavy', S.settings?.haptics !== false);
    if (r.killed) {
      sfx.victory(); burst(innerWidth / 2, innerHeight / 2, '#00ff9d', 38);
      toast(`🏆 Флюс-удар добил босса! +${fmt(r.reward)} ⚡ и Руна «${r.runeDrop.name}»!`);
    } else toast(`🧪 Флюс-удар ×1.45! Урон: ${fmt(r.dmg)}`);
    persist(); hud(); renderArena();
  },
  pickFaction: id => {
    S.faction = id; sfx.coin(); tgHaptic('select', 'light', S.settings?.haptics !== false);
    toast('Синдикат выбран! Бонус активен.'); persist(); renderArena();
  },
  clanCreate: () => {
    const name = prompt('Введи название твоего Клана (например: NEON SQUAD):');
    if (!name || !name.trim()) return;
    const tag = name.trim().slice(0, 3).toUpperCase();
    S.clan = {name: name.trim().slice(0, 18), tag, lv: 1};
    sfx.victory(); toast(`🛡️ Клан [${tag}] создан!`); persist(); renderArena();
  },
  clanUpgrade: () => {
    if (!S.clan) return;
    const cost = S.clan.lv * 800;
    if (S.credits < cost) { toast(`Нужно ${fmt(cost)} ⚡ для прокачки Наковальни`); return; }
    S.credits -= cost; S.clan.lv++; sfx.temperOk();
    toast(`🔥 Клан-Наковальня Ур.${S.clan.lv}!`); persist(); hud(); renderArena();
  },
  shareDuel: () => {
    shareDuelLink(rt.tgUser?.id || 'master', squadPower(S.arsenal));
    toast('✈️ Ссылка-вызов готова для Telegram!');
  },
  prestige: () => {
    if (!confirm('Сбросить Ядро ради вечного +25% к мощи? Топ-3 оружия, кубки, руны и клан сохранятся!')) return;
    if (doPrestige(S)) {
      sfx.victory(); burst(innerWidth / 2, innerHeight / 2, '#c084fc', 44);
      toast(`✨ Сброс Ядра! Престиж Ур.${S.prestige}`); persist(); hud(); show('forge');
    }
  },
  socketRune: uid => {
    const top = [...S.arsenal].sort((a, b) => b.power - a.power)[0];
    if (!top) return;
    const r = socketRune(S, top.id, uid);
    if (r.ok) { sfx.temperOk(); toast(`💎 Руна «${r.rune.name}» впаяна в ${top.el.n}·${top.wp.n}!`); persist(); renderArsenal(); }
  },
  duel: () => startDuel(),
  duelAbility: id => duelAbility(id),
  duelSpeed: id => {
    const d = rt.duel;
    rt.duelSpeed = +id;                                               // remembered for the next duel too
    if (!d || d.done) return;
    d.speed = +id; sfx.lock();
    document.querySelectorAll('.duel-speed .chip').forEach(b => {
      const on = +b.dataset.id === d.speed;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
  },
  mini: id => startMini(id),
  miniAgain: () => { const id = rt.mini?.id; miniStop(); startMini(id); },
  miniExit: () => show('arena'),
  rename: async () => {
    const r = await renameOnline($('#nickInput')?.value ?? '');
    toast(r?.ok ? `Ник сохранён: ${r.name}` : r?.error ?? 'Нет связи с сервером');
    if (r?.ok && rt.tab === 'arena') renderArena();
  },
  double: () => doubleReward(),
  duelDone: () => duelDone('arena'),
  up: id => {
    const u = UPGRADES[id], c = upgradeCost(u, S.up[id]);
    if (S.up[id] >= u.max || S.credits < c) return;
    S.credits -= c; S.up[id]++; sfx.coin(); toast(`${u.n}: уровень ${S.up[id]}`);
    if (id === 'auto') setAuto();
    persist(); hud(); rt.tab === 'shop' ? renderShop() : renderSides();   // also bought from the side panel of the forge
  },
  unlock: id => {
    const l = LOCATIONS.find(x => x.id === id);
    if (S.unlocked.includes(id) || S.credits < l.cost) return;
    S.credits -= l.cost; S.unlocked.push(id); S.loc = id; rt.cur = null;
    sfx.fanfare(4); toast(`Открыта локация: ${l.name}`); persist(); hud(); show('forge');
  },
  container: id => openContainer(id),
  sell: id => {
    const a = S.arsenal.find(x => x.id === +id);
    if (!a) return;
    S.arsenal = S.arsenal.filter(x => x !== a); addCredits(sellPrice(a));
    if (rt.cur?.id === a.id) rt.cur.id = null;
    sfx.coin(); persist(); hud(); renderArsenal();
  },
  sellRare: () => {
    const keep = new Set(squad(S.arsenal).map(a => a.id)), out = S.arsenal.filter(a => a.tier === KEEP_TIER && !keep.has(a.id));
    if (!out.length) return toast('Нечего продавать');
    const sum = out.reduce((t, a) => t + sellPrice(a), 0);
    S.arsenal = S.arsenal.filter(a => !out.includes(a)); addCredits(sum);
    if (out.some(a => a.id === rt.cur?.id)) rt.cur.id = null;
    toast(`Продано ${out.length} шт. · +${fmt(sum)}`); sfx.coin(); persist(); hud(); renderArsenal();
  },
  qTab: id => { rt.qTab = id; renderQuests(); scrollTo(0, 0); },
  openAch: () => { rt.qTab = 'ach'; show('quests'); },
  claimAch: id => {
    const r = claimAch(S, id);
    if (!r) return;
    payReward(r);
    const what = r.credits ? `+${fmt(r.credits)} кредитов` : r.box ? `контейнер «${CONTAINERS.find(c => c.id === r.box).n}» в Магазине`
      : r.craft ? `+${Math.round(r.craft * 100)}% к мощи крафта навсегда` : `+${Math.round(r.arena * 100)}% к наградам Арены навсегда`;
    sfx.fanfare(4); toast(`Награда: ${what}`);
    persist(); hud(); renderQuests();
  },
  claimAll: () => {
    const ready = readyToClaim(S);
    if (!ready.length) return;
    let credits = 0, boxes = 0, perks = 0;
    for (const a of ready) {
      const r = claimAch(S, a.id);
      if (!r) continue;
      payReward(r);
      if (r.credits) credits += r.credits;
      if (r.box) boxes++;
      if (r.craft || r.arena) perks++;
    }
    const parts = [credits ? `+${fmt(credits)} кредитов` : '', boxes ? `контейнеров: ${boxes}` : '', perks ? `бонусов: ${perks}` : ''].filter(Boolean);
    toast(`Забрано ${ready.length}: ${parts.join(' · ')}`);
    ready.forEach((_, i) => setTimeout(() => sfx.fanfare(Math.min(5, 2 + i % 3)), i * 110));   // the cascade chime, one per award
    if (credits) floatNum($('.claim-all') ?? $('#credits'), `+${fmt(credits)} ⚡`, 'crit');
    burst($('#credits'), 120, ['#ffcc33', '#fff3b0', '#ffffff', '#00f0ff']);
    vibrate([40, 30, 40, 30, 90]);
    persist(); hud(); renderQuests();
  },
  claim: i => {
    const c = S.contracts[+i];
    if (!c || c.p < c.n) return;
    addCredits(c.reward); sfx.fanfare(3); toast(`Контракт выполнен: +${fmt(c.reward)}`);
    S.contracts.splice(+i, 1); fillContracts(); persist(); hud(); rt.tab === 'quests' ? renderQuests() : renderSides();
  },
  auth: () => openAuth(() => { toast(`Вход выполнен: ${currentUser()}`); if (rt.tab === 'quests') renderQuests(); }),
  logout: () => { if (confirm('Выйти из аккаунта? Прогресс останется на сервере, а с этого устройства сотрётся.')) doLogout(); },
  reset: () => {
    if (!confirm('Стереть весь прогресс? Это нельзя отменить.')) return;
    S = fresh(); fillContracts(); ensureBots(); rt.cur = null; rt.locks = {}; rt.heat = 0; rt.odUntil = 0;
    setAuto(); persist(); hud(); show('forge');
  },
};

function setAuto() {
  clearInterval(rt.auto);
  if (!S.up.auto) return;
  rt.auto = setInterval(() => {
    const idle = performance.now() - rt.lastManual > 1200;
    if (rt.tab === 'forge' && idle && !rt.spin && !rt.temper && !rt.duel && !document.hidden && !$('.ad-modal')) forgeTap('auto');
  }, Math.max(1500, 4500 - 400 * S.up.auto));
}

/* ---------- frame loop: meters, overdrive timer, duel ---------- */

function frame(now) {
  const dt = (now - rt.lastFrame) / 1000;
  rt.lastFrame = now;
  const left = Math.max(0, 1 - (now - rt.lastTap) / COMBO.window);
  if (!left && rt.streak) rt.streak = 0;
  const od = isOD();
  if (!od && now - rt.lastTap > COMBO.window) rt.heat = Math.max(0, rt.heat - HEAT.decayPerSec * dt);
  const cf = $('#comboFill');
  if (cf) {
    cf.style.width = `${rt.streak ? left * 100 : 0}%`;
    $('#comboTxt').textContent = `КОМБО ×${comboMult(rt.streak, COMBO).toFixed(2)}`;
    $('#heatFill').style.width = `${od ? (rt.odUntil - now) / OVERDRIVE.ms * 100 : rt.heat}%`;
    $('#heatTxt').textContent = od ? `OVERDRIVE ${((rt.odUntil - now) / 1000).toFixed(1)} с` : `РЕАКТОР ${Math.floor(rt.heat)}%`;
  }
  if (!od && document.body.classList.contains('od')) { document.body.classList.remove('od'); updateForgeControls(); }
  rt.stage?.setScene({combo: Math.min(rt.streak, COMBO.maxStreak) / COMBO.maxStreak, od});
  if (rt.temper) {
    const p = temperPos(), m = $('#temper .marker');
    if (m) m.style.left = `${p * 100}%`;
    if (p >= 1) endTemper(null);
  }
  if (rt.duel && !rt.duel.done) duelFrame(now);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */

export function start() {
  preloadBackdrops();
  S = load();
  if (!S.dexFilled) { backfill(S); persist(); }   // saves from before the catalog: fill it from the Arsenal once
  fillContracts(); ensureBots(); setMuted(S.muted);
  shell(); initParticles($('#fx')); hud(); show('forge'); setAuto();
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act], [data-tab]');
    if (!t || t.disabled) return;
    if (t.dataset.tab) show(t.dataset.tab); else ACTIONS[t.dataset.act]?.(t.dataset.id);
  });
  $('#mute').addEventListener('click', () => { S.muted = !S.muted; setMuted(S.muted); persist(); hud(); });
  const tgInfo = initTelegram();
  rt.tgUser = tgInfo.user;
  applyVisualSettings(S);
  $('#settingsBtn')?.addEventListener('click', () => openSettingsModal(S, {
    persist, hud, squadPow: squadPower(S.arsenal), userId: rt.tgUser?.id,
    onReset: () => { S = fresh(); fillContracts(); ensureBots(); persist(); hud(); show('forge'); toast('Прогресс сброшен!'); }
  }));
  initFixerDrone({
    getState: () => S, toast,
    onReward: (delta, msg) => { addCredits(delta); persist(); hud(); toast(msg); }
  });
  if (tgInfo.startParam?.startsWith('trade_')) {
    const code = tgInfo.startParam.slice(6).toUpperCase();
    setTimeout(() => ACTIONS.openTrade(code), 600);
  } else if (tgInfo.startParam?.startsWith('duel_')) {
    setTimeout(() => show('arena'), 500);
  }
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || $('.ad-modal') || $('.auth-modal')) return;   // typing a password must not forge
    if (!(e.target === document.body || e.target.id === 'forgeBtn' || e.target.id === 'duelBtn')) return;
    e.preventDefault();
    if (rt.duel && !rt.duel.done) duelAbility('0'); else if (rt.tab === 'forge') forgeTap('tap');   // the temper guard window covers the accidental press
  });
  setInterval(() => {
    const b = $('#smugBtn');
    if (!b || rt.tab !== 'shop') return;
    const l = smugglerLeft();
    if (!l && b.disabled) renderShop(); else if (l) b.innerHTML = `<span class="num">${mmss(l)}</span>`;
  }, 1000);
  requestAnimationFrame(frame);
  addEventListener('resize', () => { rt.stage?.resize(); rt.duelStage?.resize(); rt.wheel?.resize(); });
  onAdPause(on => setPaused(on || document.hidden));
  document.addEventListener('visibilitychange', () => { setPaused(document.hidden); if (document.hidden) cloudFlush(true); });
  addEventListener('pagehide', () => cloudFlush(true));             // closing the tab: the last progress still reaches the server
  onCloudNotice(toast);
  initPlatform().then(p => { rt.platform = p; });   // Yandex: LoadingAPI.ready() once the forge is on screen
  window.__cf = {state: () => S, rt, adLog, setTestDuration, force: a => { rt.forceNext = {a, e: evaluate(a)}; },
                forceGyro: i => { rt.forceGyro = i; }};   // test hooks for Playwright
}

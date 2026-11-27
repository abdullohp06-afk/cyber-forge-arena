// Isolated monetization layer. The game only calls showRewarded / showInterstitial with a placement id
// and never knows which network (test modal, AdMob in the Android app, Yandex Games on the web) answered.

// Test modal everywhere except store builds: `--mode yandex` sets VITE_ADS=live (see .env.yandex).
const LIVE = import.meta.env?.VITE_ADS === 'live';
export const TEST_MODE = !LIVE;

export const PLACEMENTS = {
  REROLL: 'reroll_free',               // Rewarded: free re-roll of the unlocked slots
  DOUBLE: 'arena_double',              // Rewarded: ×2 credits + bonus trophies after an Arena win
  OVERDRIVE: 'overdrive_instant',      // Rewarded: start OVERDRIVE right now
  CONTAINER: 'smuggler_container',     // Rewarded: free Smuggler container (cooldown in gameData)
  INTERSTITIAL: 'arena_every_3rd',     // Interstitial: only after every 3rd finished duel, never in the Forge
  TEMPER: 'temper_retry',              // Rewarded: one more try at the Perfect Temper mini-game
  GYRO: 'gyro_respin',                 // Rewarded: re-spin the Гиро-Реактор after Сбой, or a rescue spin when credits are too low
};

// Google's public test unit ids. Replace with your own ids from the AdMob console before release.
const ADMOB_IDS = {rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712'};

export const log = [];   // every request and its outcome; read by tests and handy for debugging
let busy = false;
let pauseHook = () => {};
/** The game mutes and freezes itself while an ad is on screen (a Yandex moderation rule, and good manners everywhere). */
export const onAdPause = fn => { pauseHook = fn; };
const gameplay = on => { try { yandexProvider.sdk?.features?.GameplayAPI?.[on ? 'start' : 'stop']?.(); } catch { /* older SDK */ } };
function pause(on) { pauseHook(on); gameplay(!on); }

/** Tell the platform the game is ready. Returns 'yandex' | 'native' | 'web'. */
export async function initPlatform() {
  if (LIVE && window.YaGames) {
    try {
      const sdk = await yandexProvider.init();
      sdk.features?.LoadingAPI?.ready();
      gameplay(true);
      sdk.on?.('game_api_pause', () => pauseHook(true));               // the platform's own pauses (its menus, ads)
      sdk.on?.('game_api_resume', () => pauseHook(false));
      return 'yandex';
    } catch (e) { log.push({type: 'init', provider: 'yandex', error: String(e)}); }
  }
  return window.Capacitor?.isNativePlatform?.() ? 'native' : 'web';
}

/* ---------- providers ---------- */

const testProvider = {
  name: 'test',
  durationMs: 5000,
  rewarded(placement) { return testModal(placement, true, this.durationMs); },
  interstitial(placement) { return testModal(placement, false, Math.min(3000, this.durationMs)).then(() => false); },
};

// Android app: npm i @capacitor-community/admob && npx cap sync. Capacitor exposes native plugins on window.Capacitor.Plugins.
const admobProvider = {
  name: 'admob',
  ready: null,
  plugin: () => window.Capacitor?.Plugins?.AdMob,
  init() { return (this.ready ??= this.plugin().initialize({initializeForTesting: TEST_MODE})); },
  async rewarded() {
    await this.init();
    await this.plugin().prepareRewardVideoAd({adId: ADMOB_IDS.rewarded, isTesting: TEST_MODE});
    const reward = await this.plugin().showRewardVideoAd();   // resolves with the reward item when watched to the end
    return Boolean(reward);
  },
  async interstitial() {
    await this.init();
    await this.plugin().prepareInterstitial({adId: ADMOB_IDS.interstitial, isTesting: TEST_MODE});
    await this.plugin().showInterstitial();
    return false;
  },
};

// Yandex Games: the platform page loads /sdk.js, which defines window.YaGames.
const yandexProvider = {
  name: 'yandex',
  sdk: null,
  async init() { return (this.sdk ??= await window.YaGames.init()); },
  async rewarded() {
    const sdk = await this.init();
    return new Promise(resolve => {
      let got = false;
      sdk.adv.showRewardedVideo({callbacks: {onRewarded: () => { got = true; }, onClose: () => resolve(got), onError: () => resolve(false)}});
    });
  },
  async interstitial() {
    const sdk = await this.init();
    return new Promise(resolve => sdk.adv.showFullscreenAdv({callbacks: {onClose: () => resolve(false), onError: () => resolve(false)}}));
  },
};

/* ---------- Yandex cloud saves (player.getData / setData): progress follows the player's Yandex account ---------- */

let player = null, saveTimer = 0, pendingSave = null;
async function yaPlayer() {
  if (!(LIVE && window.YaGames)) return null;
  try { const sdk = await yandexProvider.init(); return (player ??= await sdk.getPlayer({scopes: false})); } catch { return null; }
}
/** The save kept in the Yandex account, or null (not on Yandex, offline, nothing saved). Gives up after 3 s. */
export async function loadPlatformSave() {
  const p = await Promise.race([yaPlayer(), new Promise(r => setTimeout(() => r(null), 3000))]);
  if (!p) return null;
  try { const d = await p.getData(['save']); return d?.save && typeof d.save === 'object' ? d.save : null; } catch { return null; }
}
/** Uploads the save at most every 10 s: the platform rate-limits setData. */
export function pushPlatformSave(state) {
  if (!(LIVE && window.YaGames)) return;
  pendingSave = state;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = 0;
    const p = await yaPlayer(), data = pendingSave && JSON.parse(JSON.stringify(pendingSave));
    pendingSave = null;
    if (p && data) try { await p.setData({save: data}, false); } catch (e) { log.push({type: 'cloud', provider: 'yandex', error: String(e)}); }
  }, 10000);
}

export function provider() {
  const native = window.Capacitor?.isNativePlatform?.();
  if (native && admobProvider.plugin()) return admobProvider;
  if (LIVE && window.YaGames) return yandexProvider;
  return testProvider;
}

/* ---------- public API ---------- */

/** Resolves true only when the player watched the ad to the end. Never throws: a failed ad = no reward. */
export async function showRewarded(placement) {
  if (busy) return false;
  busy = true;
  const p = provider();
  pause(true);
  try {
    const rewarded = await p.rewarded(placement);
    log.push({type: 'rewarded', placement, provider: p.name, rewarded});
    return rewarded;
  } catch (e) {
    log.push({type: 'rewarded', placement, provider: p.name, rewarded: false, error: String(e)});
    return false;
  } finally { busy = false; pause(false); }
}

export async function showInterstitial(placement) {
  if (busy) return;
  busy = true;
  const p = provider();
  pause(true);
  try { await p.interstitial(placement); log.push({type: 'interstitial', placement, provider: p.name}); }
  catch (e) { log.push({type: 'interstitial', placement, provider: p.name, error: String(e)}); }
  finally { busy = false; pause(false); }
}

export const setTestDuration = ms => { testProvider.durationMs = ms; };

/* ---------- test modal ---------- */

const TITLES = {
  [PLACEMENTS.REROLL]: 'Бесплатная перековка',
  [PLACEMENTS.DOUBLE]: '×2 награда за победу',
  [PLACEMENTS.OVERDRIVE]: 'Мгновенный OVERDRIVE',
  [PLACEMENTS.CONTAINER]: 'Контрабандный контейнер',
  [PLACEMENTS.INTERSTITIAL]: 'Перерыв между дуэлями',
  [PLACEMENTS.TEMPER]: 'Ещё одна закалка',
  [PLACEMENTS.GYRO]: 'Спин Гиро-Реактора',
};

function testModal(placement, rewarded, ms) {
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const el = document.createElement('div');
    el.className = 'ad-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Тестовая реклама');
    el.innerHTML = `<div class="ad-box" data-placement="${placement}">
        <div class="ad-badge">ТЕСТОВАЯ РЕКЛАМА</div>
        <div class="ad-title">${TITLES[placement] ?? placement}</div>
        <div class="ad-sec">${Math.ceil(ms / 1000)}</div>
        <div class="ad-bar"><i></i></div>
        <p class="ad-note">${rewarded ? 'Досмотри до конца, чтобы получить награду.' : 'Реклама закроется по кнопке через пару секунд.'}</p>
        <div class="ad-actions">
          ${rewarded ? '<button class="btn ghost ad-close">Закрыть без награды</button><button class="btn ad-claim" disabled>Получить награду</button>'
                     : '<button class="btn ad-skip" disabled>Продолжить</button>'}
        </div></div>`;
    document.body.append(el);
    const bar = el.querySelector('.ad-bar i'), sec = el.querySelector('.ad-sec'), t0 = performance.now();
    const done = value => { clearInterval(timer); el.remove(); prevFocus?.focus?.(); resolve(value); };
    const timer = setInterval(() => {
      const left = Math.max(0, ms - (performance.now() - t0));
      bar.style.width = `${100 - left / ms * 100}%`;
      sec.textContent = Math.ceil(left / 1000);
      if (left > 0) return;
      clearInterval(timer);
      const ready = el.querySelector('.ad-claim, .ad-skip');
      ready.disabled = false;
      ready.focus();
    }, 100);
    el.querySelector('.ad-close')?.addEventListener('click', () => done(false));
    el.querySelector('.ad-claim')?.addEventListener('click', () => done(true));
    el.querySelector('.ad-skip')?.addEventListener('click', () => done(false));
    (el.querySelector('.ad-close') ?? el.querySelector('.ad-skip')).focus();
  });
}

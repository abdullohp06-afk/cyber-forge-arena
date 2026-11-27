// NEON FIX extras: CRT scanlines, Settings modal, VIP Fixer Drone (risky shadow contracts), and Mythic Share Card.
import {sfx, setMuted} from './audio.js';
import {tgHaptic, shareDuelLink} from '../services/telegram.js';
import {TIERS} from '../config/gameData.js';
import {weaponThumb} from '../ui/weaponArt.js';

export function applyVisualSettings(S) {
  const crt = S.settings?.crt !== false;
  document.body.classList.toggle('no-crt', !crt);
  if (!document.querySelector('.cf-crt')) {
    const el = document.createElement('div');
    el.className = 'cf-crt';
    document.body.appendChild(el);
  }
}

export function openSettingsModal(S, {persist, hud, onReset, squadPow, userId}) {
  let back = document.getElementById('cfSettingsModal');
  if (!back) {
    back = document.createElement('div');
    back.id = 'cfSettingsModal';
    back.className = 'v2-backdrop';
    document.body.appendChild(back);
  }
  const st = S.settings || (S.settings = {crt: true, haptics: true});
  const render = () => {
    back.innerHTML = `
      <div class="v2-modal v2-settings" role="dialog" aria-modal="true">
        <div class="v2-head">
          <span class="v2-lamp"></span>
          <b>НАСТРОЙКИ КУЗНИ</b>
          <button class="v2-x" data-close>✕</button>
        </div>
        <div class="v2-set-list">
          <div class="v2-set-row">
            <div><b>Звуки (Web Audio)</b><small>Удары, закалка, арена, дрон</small></div>
            <button class="v2-tog ${!S.muted ? 'on' : ''}" data-set="sound">${!S.muted ? 'ВКЛ' : 'ВЫКЛ'}</button>
          </div>
          <div class="v2-set-row">
            <div><b>Вибрация (Haptics)</b><small>Отклик в Telegram и на телефоне</small></div>
            <button class="v2-tog ${st.haptics !== false ? 'on' : ''}" data-set="haptics">${st.haptics !== false ? 'ВКЛ' : 'ВЫКЛ'}</button>
          </div>
          <div class="v2-set-row">
            <div><b>Неон и CRT-сканлайны</b><small>Киберпанк-фильтр экрана</small></div>
            <button class="v2-tog ${st.crt !== false ? 'on' : ''}" data-set="crt">${st.crt !== false ? 'ВКЛ' : 'ВЫКЛ'}</button>
          </div>
          <button class="v2-btn v2-cyan wide" data-set="shareDuel">⚔️ Вызвать друга на дуэль в Telegram</button>
          <div class="v2-danger-box">
            <button class="v2-btn v2-danger wide" data-set="resetAsk">Сбросить прогресс</button>
            <div class="v2-confirm" id="v2ResetConfirm" hidden>
              <p>Точно удалить сохранение и начать заново?</p>
              <div class="v2-row2">
                <button class="v2-btn v2-danger" data-set="resetYes">Да, сбросить</button>
                <button class="v2-btn v2-ghost" data-set="resetNo">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  };
  render();
  back.classList.add('open');

  back.onclick = e => {
    if (e.target === back || e.target.closest('[data-close]')) {
      back.classList.remove('open');
      return;
    }
    const btn = e.target.closest('[data-set]');
    if (!btn) return;
    const act = btn.dataset.set;
    if (act === 'sound') {
      S.muted = !S.muted; setMuted(S.muted); persist(); hud(); render();
    } else if (act === 'haptics') {
      st.haptics = !(st.haptics !== false); tgHaptic('impact', 'light', st.haptics); persist(); render();
    } else if (act === 'crt') {
      st.crt = !(st.crt !== false); applyVisualSettings(S); persist(); render();
    } else if (act === 'shareDuel') {
      shareDuelLink(userId || 'master', squadPow || 100);
    } else if (act === 'resetAsk') {
      const box = document.getElementById('v2ResetConfirm');
      if (box) box.hidden = false;
    } else if (act === 'resetNo') {
      const box = document.getElementById('v2ResetConfirm');
      if (box) box.hidden = true;
    } else if (act === 'resetYes') {
      back.classList.remove('open');
      onReset?.();
    }
  };
}

/** VIP Fixer Drone from NEON FIX: flies in periodically with a risky shadow contract (safe vs x2.5 risk). */
export function initFixerDrone({getState, onReward, toast}) {
  if (document.getElementById('cfVipDrone')) return;
  const wrap = document.createElement('div');
  wrap.id = 'cfVipDrone';
  wrap.className = 'cf-drone';
  wrap.innerHTML = `
    <button class="cf-drone-fab" id="cfDroneFab" title="Теневой контракт от Фиксера">
      <svg width="58" height="38" viewBox="0 0 160 105" fill="none">
        <ellipse cx="32" cy="54" rx="10" ry="16" fill="#00f0ff" opacity="0.4"/>
        <ellipse cx="128" cy="54" rx="10" ry="16" fill="#00f0ff" opacity="0.4"/>
        <rect x="14" y="26" width="36" height="14" rx="5" fill="#1e293b" stroke="#00f0ff" stroke-width="2.5"/>
        <rect x="110" y="26" width="36" height="14" rx="5" fill="#1e293b" stroke="#00f0ff" stroke-width="2.5"/>
        <path d="M56 20 H104 L112 44 L98 56 H62 L48 44 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
        <rect x="64" y="30" width="32" height="9" rx="4" fill="#ff1e56"/>
      </svg>
      <span class="cf-drone-tag" id="cfDroneBadge">VIP +500</span>
    </button>
    <div class="cf-drone-pop" id="cfDronePop" hidden>
      <div class="cf-drone-head"><span>🛸 ФИКСЕР // ТЕНЕВОЙ КОНТРАКТ</span><button id="cfDroneX">✕</button></div>
      <p id="cfDroneText">Синдикату нужен срочный клинок. Впаяешь нелегальный чип-разгон ради двойного куша?</p>
      <div class="cf-drone-btns">
        <button class="v2-btn v2-hazard" id="cfDroneRisk">РИСКНУТЬ (72% · ×2.5)</button>
        <button class="v2-btn v2-cyan" id="cfDroneSafe">БЕЗОПАСНО (100%)</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  let baseReward = 400;
  const fab = wrap.querySelector('#cfDroneFab');
  const pop = wrap.querySelector('#cfDronePop');
  const hide = () => { wrap.classList.remove('arrived'); pop.hidden = true; };

  fab.onclick = () => { pop.hidden = !pop.hidden; sfx.lock(); };
  wrap.querySelector('#cfDroneX').onclick = hide;

  wrap.querySelector('#cfDroneSafe').onclick = () => {
    sfx.coin();
    tgHaptic('notify', 'success', getState().settings?.haptics !== false);
    onReward(baseReward, `Контракт выполнен: +${baseReward.toLocaleString('ru-RU')} ⚡`);
    hide();
  };

  wrap.querySelector('#cfDroneRisk').onclick = () => {
    const S = getState();
    const chance = S.faction === 'abyss' ? 0.78 : 0.72;
    if (Math.random() <= chance) {
      const win = Math.round(baseReward * 2.5);
      sfx.temperOk();
      tgHaptic('notify', 'success', S.settings?.haptics !== false);
      onReward(win, `🔥 Сделка века! Фиксер перевёл +${win.toLocaleString('ru-RU')} ⚡`);
    } else {
      const fine = Math.round(baseReward * 0.35);
      sfx.temperFail();
      tgHaptic('notify', 'error', S.settings?.haptics !== false);
      onReward(-fine, `⚠️ Сканер перехватил чип! Штраф -${fine.toLocaleString('ru-RU')} ⚡`);
    }
    hide();
  };

  const spawn = () => {
    const S = getState();
    if (!S) return;
    const mult = Math.max(1, S.unlocked?.length || 1);
    baseReward = Math.round((350 + (S.credits * 0.04)) * mult);
    baseReward = Math.min(Math.max(baseReward, 300), 25000);
    wrap.querySelector('#cfDroneBadge').textContent = `VIP +${Math.round(baseReward * 2.5).toLocaleString('ru-RU')}`;
    wrap.querySelector('#cfDroneSafe').textContent = `БЕЗОПАСНО (+${baseReward.toLocaleString('ru-RU')})`;
    wrap.querySelector('#cfDroneRisk').textContent = `РИСК (×2.5 · +${Math.round(baseReward * 2.5).toLocaleString('ru-RU')})`;
    wrap.classList.add('arrived');
    toast?.('🛸 Прилетел VIP-дрон Фиксера с теневым контрактом!');
  };

  setTimeout(spawn, 18000);
  setInterval(spawn, 85000);
}

/** Generate and download a Mythic / Overclock Share Card PNG for Telegram chats & stories. */
export function downloadWeaponCard(art, userName = 'Кибер-Мастер') {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 360;
  const ctx = c.getContext('2d');
  const tier = TIERS[art.tier] || TIERS[0];

  // Dark cyber background
  const bg = ctx.createLinearGradient(0, 0, 640, 360);
  bg.addColorStop(0, '#070b14'); bg.addColorStop(1, '#11192b');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 640, 360);

  // Accent glow
  const glow = ctx.createRadialGradient(320, 155, 20, 320, 155, 240);
  glow.addColorStop(0, tier.c + '55'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 640, 360);

  // Border frame
  ctx.strokeStyle = tier.c; ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 612, 332);

  // Header
  ctx.fillStyle = '#94a3b8'; ctx.font = '700 16px monospace';
  ctx.fillText('CYBER-FORGE: ARENA // TELEGRAM MINI APP', 32, 46);
  ctx.fillStyle = tier.c; ctx.font = '900 22px sans-serif';
  ctx.fillText(`${tier.n.toUpperCase()}${art.oc ? `  +${art.oc} OVERCLOCK` : ''}${art.tempered ? '  ★ ЗАКАЛЁН' : ''}`, 32, 82);

  // Weapon image
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 140, 96, 360, 144);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 28px sans-serif';
    ctx.fillText(`${art.el.n} · ${art.wp.n}`, 32, 276);
    ctx.fillStyle = '#fbbf24'; ctx.font = '800 26px monospace';
    ctx.fillText(`⚡ МОЩЬ: ${Math.floor(art.power).toLocaleString('ru-RU')}`, 32, 316);
    ctx.fillStyle = '#94a3b8'; ctx.font = '600 15px monospace';
    ctx.fillText(`Владелец: ${userName}${art.rune ? ` · Руна: ${art.rune.name}` : ''}`, 320, 316);

    const a = document.createElement('a');
    a.download = `cyber-forge-${art.el.n}-${art.wp.n}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  };
  img.src = weaponThumb(art);
}

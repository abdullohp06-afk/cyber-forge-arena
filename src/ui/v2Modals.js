// v2.0 Modals & Views: Overclock Casino, P2P Black Market Trade Terminal, Factions, Clan & Raid Boss.
import {TIERS, ROMAN} from '../config/gameData.js';
import {nextOverclockInfo, attemptOverclock} from '../engine/overclock.js';
import {FACTIONS, BLUEPRINTS, currentBoss, strikeRaidBoss, socketRune, canPrestige, doPrestige, factionBonuses} from '../engine/rpg.js';
import {createTradeSession, toggleTradeItem, setTradeCredits, connectBroker, canFinalize, finalizeTradeLocal, syncTradeRemote} from '../engine/trade.js';
import {weaponThumb} from './weaponArt.js';
import {sfx} from '../fx/audio.js';
import {burst, shake} from '../fx/particles.js';
import {tgHaptic, shareTradeLink, shareDuelLink} from '../services/telegram.js';
import {showRewarded, PLACEMENTS} from '../services/adBridge.js';

const fmt = n => Math.floor(n).toLocaleString('ru-RU');

/* ================= OVERCLOCK CASINO MODAL ================= */
export function openOverclockModal(itemId, S, {persist, hud, toast, onDone}) {
  let back = document.getElementById('cfOcModal');
  if (!back) {
    back = document.createElement('div');
    back.id = 'cfOcModal';
    back.className = 'v2-backdrop';
    document.body.appendChild(back);
  }
  let useCryo = false;
  let lastMsg = '';
  let lastTone = '';

  const render = () => {
    const item = S.arsenal.find(x => x.id === itemId);
    if (!item) {
      back.innerHTML = `
        <div class="v2-modal v2-oc">
          <div class="v2-head"><span class="v2-lamp red"></span><b>КЛИНОК РАСПЛАВЛЕН</b><button class="v2-x" data-close>✕</button></div>
          <div class="v2-oc-melted">
            <div class="v2-melt-icon">💥</div>
            <p>${lastMsg || 'Перегрев ядра! Оружие сгорело в лом.'}</p>
            <button class="v2-btn v2-cyan wide" data-close>ВЕРНУТЬСЯ В АРСЕНАЛ</button>
          </div>
        </div>`;
      return;
    }

    const fb = factionBonuses(S);
    const info = nextOverclockInfo(item, fb.ocBonus);
    const t = TIERS[item.tier] || TIERS[0];
    const totalCost = info ? (info.cost + (useCryo && info.risk ? info.cryoCost : 0)) : 0;

    back.innerHTML = `
      <div class="v2-modal v2-oc" role="dialog" aria-modal="true">
        <div class="v2-head">
          <span class="v2-lamp"></span>
          <b>ОВЕРКЛОК ЯДРА ${item.oc ? `+${item.oc}` : ''}</b>
          <button class="v2-x" data-close>✕</button>
        </div>

        <div class="v2-oc-stage" style="--tc:${t.c}">
          <div class="v2-oc-badge">+${item.oc || 0} OVERCLOCK</div>
          <img class="v2-oc-img" src="${weaponThumb(item)}" alt="">
          <div class="v2-oc-name">${item.el.n} · ${item.wp.n}</div>
          <div class="v2-oc-pow num">⚡ ${fmt(item.power)} ${info ? `→ <b>${fmt(info.nextPower)}</b>` : '(МАКС +10)'}</div>
        </div>

        ${lastMsg ? `<div class="v2-oc-msg ${lastTone}">${lastMsg}</div>` : ''}

        ${info ? `
          <div class="v2-gauge-box">
            <div class="v2-gauge-bar">
              <div class="v2-gauge-ok" style="width:${info.chancePct}%"></div>
              <div class="v2-gauge-risk" style="width:${info.meltPct}%"></div>
            </div>
            <div class="v2-gauge-nums">
              <span class="ok"><b>${info.chancePct}%</b> УСПЕХ</span>
              <span class="risk"><b>${info.meltPct}%</b> ${info.risk ? 'РИСК ПЛАВЛЕНИЯ' : 'БЕЗОПАСНО'}</span>
            </div>
          </div>

          ${info.risk ? `
            <div class="v2-cryo-row">
              <div>
                <b>❄️ Крио-страховка</b>
                <small>Спасёт клинок при неудаче (+${fmt(info.cryoCost)} ⚡)</small>
              </div>
              <button class="v2-tog ${useCryo ? 'on' : ''}" data-oc="cryo">${useCryo ? 'ВКЛ' : 'ВЫКЛ'}</button>
            </div>
          ` : '<div class="v2-safe-note">До +3 разгон полностью безопасен (100%)</div>'}

          <div class="v2-oc-actions">
            <button class="v2-btn v2-hazard wide" data-oc="roll" ${S.credits < totalCost ? 'disabled' : ''}>
              РАЗОГНАТЬ +${info.next} · ${fmt(totalCost)} ⚡
            </button>
            ${info.risk ? `<button class="v2-btn v2-ad wide" data-oc="adCryo">▶ Разогнать со страховкой (реклама)</button>` : ''}
            <button class="v2-btn v2-cyan wide" data-close>ЗАБРАТЬ КЛИНОК</button>
          </div>
        ` : `<button class="v2-btn v2-cyan wide" data-close>МАКСИМАЛЬНЫЙ РАЗГОН +10! ЗАБРАТЬ</button>`}
      </div>`;
  };

  render();
  back.classList.add('open');

  back.onclick = async e => {
    if (e.target === back || e.target.closest('[data-close]')) {
      back.classList.remove('open');
      onDone?.();
      return;
    }
    const btn = e.target.closest('[data-oc]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.oc;
    const item = S.arsenal.find(x => x.id === itemId);
    if (!item) return;

    if (act === 'cryo') {
      useCryo = !useCryo; sfx.lock(); render(); return;
    }

    let freeCryo = false;
    if (act === 'adCryo') {
      const ok = await showRewarded(PLACEMENTS.TEMPER);
      if (!ok) return;
      freeCryo = true;
    }

    const fb = factionBonuses(S);
    const res = attemptOverclock(item, S, {useCryo: useCryo || freeCryo, freeCryo, factionBonus: fb.ocBonus});
    if (res.status === 'NO_CREDITS') { toast('Не хватает кредитов!'); return; }

    if (res.status === 'SUCCESS') {
      sfx.temperOk();
      tgHaptic('notify', 'success', S.settings?.haptics !== false);
      burst(back.querySelector('.v2-oc-stage') || back, 36, ['#f59e0b', '#ffffff', '#ffcc33']);
      lastMsg = `🔥 УСПЕХ! Клинок разогнан до +${res.level} (Мощь ${fmt(res.power)})`;
      lastTone = 'ok';
    } else if (res.status === 'SAVED') {
      sfx.lock();
      tgHaptic('notify', 'warning', S.settings?.haptics !== false);
      lastMsg = `❄️ Сбой перегрева, но Крио-страховка спасла клинок!`;
      lastTone = 'warn';
    } else if (res.status === 'MELTED') {
      sfx.temperFail();
      shake(document.getElementById('screen'), true);
      tgHaptic('notify', 'error', S.settings?.haptics !== false);
      lastMsg = `💥 ПЕРЕГРЕВ! Оружие расплавилось в лом (+${fmt(res.scrap)} ⚡ возврат)`;
      lastTone = 'err';
    }
    persist(); hud(); render();
  };
}

/* ================= P2P BLACK MARKET TRADE TERMINAL ================= */
let activeTrade = null;
let tradePoll = null;

export function openTradeModal(S, {user, persist, hud, toast, onDone}, initialCode = null) {
  let back = document.getElementById('cfTradeModal');
  if (!back) {
    back = document.createElement('div');
    back.id = 'cfTradeModal';
    back.className = 'v2-backdrop';
    document.body.appendChild(back);
  }
  activeTrade = createTradeSession(user, initialCode);

  const renderSlot = (it, removable = false) => {
    const t = TIERS[it.tier] || TIERS[0];
    return `<div class="v2-tslot" style="--tc:${t.c}" ${removable ? `data-tact="toggle" data-id="${it.id}"` : ''}>
      <img src="${weaponThumb(it)}" alt="">
      <div class="v2-tslot-t">${t.n}${it.oc ? ` +${it.oc}` : ''}</div>
      <div class="v2-tslot-n">${it.el.n} · ${it.wp.n}</div>
      <div class="v2-tslot-p num">⚡ ${fmt(it.power)}</div>
    </div>`;
  };

  const render = () => {
    const s = activeTrade;
    const ready = canFinalize(s);
    const chosenIds = new Set(s.me.items.map(x => x.id));
    const stock = [...S.arsenal].sort((a, b) => b.power - a.power).slice(0, 12);

    back.innerHTML = `
      <div class="v2-modal v2-trade" role="dialog" aria-modal="true">
        <div class="v2-head">
          <span class="v2-lamp"></span>
          <b>ЧЁРНЫЙ РЫНОК // ТРЕЙД #${s.code}</b>
          <button class="v2-x" data-close>✕</button>
        </div>

        <div class="v2-trade-top-bar">
          <button class="v2-btn v2-cyan sm" data-tact="share">✈️ Трейд-ссылка (ТГ)</button>
          <button class="v2-btn v2-ghost sm" data-tact="join">🔑 Ввести код</button>
          <button class="v2-btn v2-hazard sm" data-tact="broker">🤖 Брокер (Тест)</button>
        </div>

        <div class="v2-trade-grid">
          <!-- ТВОЁ ПРЕДЛОЖЕНИЕ -->
          <div class="v2-tpanel me">
            <div class="v2-tpanel-h">
              <b>ТВОЁ ПРЕДЛОЖЕНИЕ (${s.me.name})</b>
              <span class="v2-lock-pill ${s.me.locked ? 'ok' : ''}">${s.me.locked ? '✓ ГОТОВ' : 'ВЫБОР'}</span>
            </div>
            <div class="v2-tslots">
              ${s.me.items.map(x => renderSlot(x, true)).join('')}
              ${Array.from({length: 3 - s.me.items.length}, () => '<div class="v2-tslot empty">Слот пуст</div>').join('')}
            </div>
            <div class="v2-tcred">
              <span>Кредиты:</span>
              <input type="number" id="v2TradeCred" min="0" max="${Math.floor(S.credits)}" value="${s.me.credits}" step="100">
              <button class="v2-btn ${s.me.locked ? 'v2-ghost' : 'v2-cyan'} sm" data-tact="lock">${s.me.locked ? 'Снять блок' : '✓ Готов'}</button>
            </div>
          </div>

          <!-- ПРЕДЛОЖЕНИЕ ПАРТНЁРА -->
          <div class="v2-tpanel partner">
            <div class="v2-tpanel-h">
              <b>ПАРТНЁР: ${s.partner.name}</b>
              <span class="v2-lock-pill ${s.partner.locked ? 'ok' : ''}">${s.partner.locked ? '✓ ГОТОВ' : 'ЖДЁМ'}</span>
            </div>
            <div class="v2-tslots">
              ${s.partner.items.map(x => renderSlot(x, false)).join('')}
              ${Array.from({length: Math.max(0, 3 - s.partner.items.length)}, () => '<div class="v2-tslot empty">Ожидание...</div>').join('')}
            </div>
            <div class="v2-tcred">
              <span>Кредиты партнёра:</span>
              <b class="num">⚡ ${fmt(s.partner.credits)}</b>
              <small>Комиссия 5%</small>
            </div>
          </div>
        </div>

        <div class="v2-trade-confirm">
          <div class="v2-dual-checks">
            <span class="${s.me.locked ? 'ok' : ''}">${s.me.locked ? '✓' : '○'} Ты подтвердил</span>
            <span class="${s.partner.locked ? 'ok' : ''}">${s.partner.locked ? '✓' : '○'} Партнёр подтвердил</span>
          </div>
          <button class="v2-btn v2-hazard wide" data-tact="finalize" ${ready ? '' : 'disabled'}>
            🔒 ПОДТВЕРДИТЬ ТРЕЙД
          </button>
        </div>

        <div class="v2-picker">
          <div class="v2-picker-h">Выбери оружие из Арсенала (до 3 шт):</div>
          <div class="v2-picker-list">
            ${stock.length ? stock.map(a => {
              const t = TIERS[a.tier] || TIERS[0];
              return `<button class="v2-pick ${chosenIds.has(a.id) ? 'on' : ''}" style="--tc:${t.c}" data-tact="toggle" data-id="${a.id}">
                <span>${a.el.n}·${a.wp.n}${a.oc ? ` +${a.oc}` : ''}</span>
                <b class="num">${fmt(a.power)}</b>
              </button>`;
            }).join('') : '<small>Арсенал пуст — выкуй оружие в Кузне!</small>'}
          </div>
        </div>
      </div>`;

    const inp = back.querySelector('#v2TradeCred');
    if (inp) {
      inp.onchange = () => {
        setTradeCredits(activeTrade, +inp.value, S.credits);
        syncTradeRemote(activeTrade);
        render();
      };
    }
  };

  render();
  back.classList.add('open');

  clearInterval(tradePoll);
  tradePoll = setInterval(async () => {
    if (!back.classList.contains('open') || !activeTrade || activeTrade.mode !== 'P2P') return;
    await syncTradeRemote(activeTrade);
    render();
  }, 3000);

  back.onclick = async e => {
    if (e.target === back || e.target.closest('[data-close]')) {
      back.classList.remove('open');
      clearInterval(tradePoll);
      onDone?.();
      return;
    }
    const btn = e.target.closest('[data-tact]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.tact;

    if (act === 'toggle') {
      const it = S.arsenal.find(x => x.id === +btn.dataset.id);
      if (it) { toggleTradeItem(activeTrade, it); sfx.lock(); syncTradeRemote(activeTrade); render(); }
    } else if (act === 'lock') {
      activeTrade.me.locked = !activeTrade.me.locked;
      sfx.lock();
      await syncTradeRemote(activeTrade);
      render();
    } else if (act === 'share') {
      const summary = activeTrade.me.items.map(x => `${x.el.n} ${x.wp.n}`).join(', ') || `${fmt(activeTrade.me.credits)} кредитов`;
      shareTradeLink(activeTrade.code, summary);
      toast(`Ссылка на трейд #${activeTrade.code} готова!`);
    } else if (act === 'join') {
      const code = prompt('Введи 5-значный код комнаты трейда:');
      if (code && code.trim()) {
        activeTrade = createTradeSession(user, code.trim().toUpperCase());
        await syncTradeRemote(activeTrade);
        toast(`Подключено к комнате #${activeTrade.code}`);
        render();
      }
    } else if (act === 'broker') {
      connectBroker(activeTrade, S.loc);
      sfx.coin();
      toast('🤖 Подключился Брокер Чёрного Рынка! Выбери свои предметы.');
      render();
    } else if (act === 'finalize') {
      const r = finalizeTradeLocal(activeTrade, S);
      if (!r.ok) { toast('Оба игрока должны нажать «Готов»'); return; }
      sfx.victory();
      tgHaptic('notify', 'success', S.settings?.haptics !== false);
      burst(back.querySelector('.v2-trade-confirm') || back, 34, ['#00ff9d', '#00f0ff', '#ffffff']);
      persist(); hud();
      toast(`✅ Трейд завершён! Получено предметов: ${r.received}`);
      back.classList.remove('open');
      clearInterval(tradePoll);
      onDone?.();
    }
  };
}

/* ================= SYNDICATE, CLAN & RAID BOSS HTML (FOR ARENA TAB) ================= */
export function syndicateArenaHtml(S, squadItems) {
  const b = currentBoss(S);
  const pct = Math.max(0, Math.min(100, Math.round((b.hp / b.maxHp) * 100)));
  const fb = factionBonuses(S);
  const curFac = FACTIONS.find(x => x.id === S.faction);
  const weakReady = squadItems.some(w => w.el?.n === b.weak);

  return `
    <section class="v2-syndicate">
      <div class="v2-card v2-boss-card">
        <div class="v2-boss-top">
          <div>
            <span class="v2-tag rose">РЕЙД-БОСС УР.${b.lv}</span>
            <h3>${b.name}</h3>
          </div>
          <span class="v2-tag cyan">НАГРАДА: ${fmt(b.reward)} ⚡ + РУНА</span>
        </div>
        <p class="v2-boss-desc">${b.desc} ${weakReady ? '<b class="ok">✓ У тебя есть уязвимая стихия!</b>' : ''}</p>
        <div class="v2-hpbar"><i style="width:${pct}%"></i><span class="num">${fmt(b.hp)} / ${fmt(b.maxHp)} HP</span></div>
        <div class="v2-row2">
          <button class="v2-btn v2-hazard" data-act="bossStrike">⚔️ Удар по Боссу</button>
          <button class="v2-btn v2-cyan" data-act="bossFlux" ${(S.flux || 0) <= 0 ? 'disabled' : ''}>🧪 Флюс-удар ×1.45 (${S.flux || 0})</button>
        </div>
      </div>

      <div class="v2-grid2">
        <div class="v2-card">
          <div class="v2-card-h"><b>Синдикат (Фракция)</b> ${curFac ? `<span class="v2-tag" style="color:${curFac.color}">${curFac.name}</span>` : ''}</div>
          <div class="small" style="margin-bottom:6px;">Война Синдикатов · твой вклад: <b class="num">${fmt(S.warPts || 0)}</b> очков</div>
          <div class="v2-fac-list">
            ${FACTIONS.map(f => `
              <button class="v2-fac ${S.faction === f.id ? 'on' : ''}" style="--fc:${f.color}" data-act="pickFaction" data-id="${f.id}">
                <b>${f.name}</b><small>${f.perk}</small>
              </button>`).join('')}
          </div>
        </div>

        <div class="v2-card">
          <div class="v2-card-h"><b>Клан & Престиж</b> <span class="v2-tag amber">Множитель ×${(fb.prestigeMult * fb.clanMult).toFixed(2)}</span></div>
          ${S.clan ? `
            <div class="v2-clan-info">
              <div><b>[${S.clan.tag}] ${S.clan.name}</b> · Ур.${S.clan.lv}</div>
              <small>Клан-Наковальня: +${(S.clan.lv - 1) * 6}% к мощи отряда</small>
              <button class="v2-btn v2-cyan wide sm" data-act="clanUpgrade">Прокачать Наковальню (${fmt(S.clan.lv * 800)} ⚡)</button>
            </div>` : `
            <div class="v2-clan-info">
              <small>Вступи в клан друзей или создай свой отряд ради бонуса Наковальни.</small>
              <button class="v2-btn v2-cyan wide sm" data-act="clanCreate">🛡️ Создать / Войти в Клан</button>
            </div>`}
          <div class="v2-prestige-row">
            <button class="v2-btn v2-ghost sm" data-act="shareDuel">✈️ Вызвать друга (ТГ)</button>
            <button class="v2-btn ${canPrestige(S) ? 'v2-hazard' : 'v2-ghost'} sm" data-act="prestige" ${canPrestige(S) ? '' : 'disabled'}>
              ✨ Престиж (${S.prestige || 0})
            </button>
          </div>
        </div>
      </div>
    </section>`;
}

/* ================= RUNES SUBTAB HTML (FOR ARSENAL) ================= */
export function runesSubtabHtml(S) {
  const runes = S.runes || [];
  const items = [...S.arsenal].sort((a, b) => b.power - a.power);
  const scrap = S.scrap || 0;
  return `
    <div class="v2-runes-wrap">
      <h2>Чертежи (Лом: <span class="num accent">${scrap}</span>)</h2>
      <p class="small">Лом падает с Рейд-Боссов (+2) и при плавлении в Оверклоке (+3).</p>
      <div class="v2-grid2" style="margin-bottom:14px;">
        ${BLUEPRINTS.map(bp => `
          <div class="v2-card">
            <b>${bp.name}</b>
            <div class="small" style="margin:4px 0 8px;">${bp.desc}</div>
            <button class="v2-btn v2-hazard sm wide" data-act="craftBp" data-id="${bp.id}" ${scrap < bp.scrapCost ? 'disabled' : ''}>
              Собрать (${bp.scrapCost} лома)
            </button>
          </div>`).join('')}
      </div>
      <h2>Чипы-Руны <span class="num">${runes.length}</span></h2>
      <p class="small">Руны падают с Рейд-Боссов на Арене. Вставь руну в лучшее оружие, чтобы навсегда усилить его мощь!</p>
      <div class="v2-rune-grid">
        ${runes.length ? runes.map(r => `
          <div class="v2-rune-card" style="--rc:${r.color}">
            <div class="v2-rune-top"><b>${r.name}</b><span>${r.tier}</span></div>
            <div class="v2-rune-stat">${r.stat}</div>
            ${items.length ? `<button class="v2-btn v2-cyan sm wide" data-act="socketRune" data-id="${r.uid}">Вставить в Топ-оружие</button>` : '<small>Нет оружия в Арсенале</small>'}
          </div>`).join('')
        : '<div class="card small">Пока нет рун. Добей Рейд-Босса на вкладке «Арена», чтобы выбить первый Чип-Руну!</div>'}
      </div>
    </div>`;
}

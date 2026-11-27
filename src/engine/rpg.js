// RPG layer: Factions (Syndicates), Clans & Boss Raids (Witcher Bestiary + Flux oils), Rune Chips & Prestige.

export const FACTIONS = [
  {id: 'yakuza', name: 'Нео-Якудза', color: '#ff3b6b', perk: '+12% к мощи на Арене и рейдах', tag: 'КРИТ'},
  {id: 'corps',  name: 'Техно-Корпы', color: '#38bdf8', perk: '+18% кредитов за ковку и контракты', tag: 'ДОХОД'},
  {id: 'abyss',  name: 'Дети Бездны', color: '#c084fc', perk: '+8% к шансу успеха в Оверклоке', tag: 'РИСК'},
];

export const RUNE_POOL = [
  {id: 'vamp',  name: 'Чип Вампира',   stat: '+14% мощи',  mult: 0.14, color: '#fb7185', tier: 'Эпик'},
  {id: 'pierce',name: 'Пробитие IV',   stat: '+18% мощи',  mult: 0.18, color: '#38bdf8', tier: 'Эпик'},
  {id: 'crit',  name: 'Ядро Крита',    stat: '+24% мощи',  mult: 0.24, color: '#f59e0b', tier: 'Легенд.'},
  {id: 'void',  name: 'Руна Бездны',   stat: '+35% мощи',  mult: 0.35, color: '#e879f9', tier: 'Мифик'},
];

export const RAID_BOSSES = [
  {id: 'b1', name: 'ХРОМ-МАНТИКОРА',   weak: 'Ток',    resist: 'Магма', hp: 8000,   reward: 1800, desc: 'Уязвима к Току (×1.6 урона). Броня режет Магму.'},
  {id: 'b2', name: 'АРАСАКА-ЛЕВИАФАН', weak: 'Неон',   resist: 'Тень',  hp: 22000,  reward: 4200, desc: 'Уязвим к Неону (×1.6 урона). Тень почти не берёт.'},
  {id: 'b3', name: 'ТИТАН-ОМЕГА',      weak: 'Плазма', resist: 'Ток',   hp: 55000,  reward: 9500, desc: 'Уязвим к Плазме (×1.6 урона). Заземлён от Тока.'},
  {id: 'b4', name: 'ПРИЗРАК ЯДРА',     weak: 'Кварк',  resist: 'Неон',  hp: 130000, reward: 22000, desc: 'Уязвим к Кварку (×1.6 урона). Поглощает Неон.'},
  {id: 'b5', name: 'СОЛНЕЧНЫЙ СТРАЖ',  weak: 'Корона', resist: 'Сталь', hp: 280000, reward: 50000, desc: 'Уязвим к Короне (×1.6 урона). Сталь бесполезна.'},
];

export const BLUEPRINTS = [
  {id: 'bp_epic', name: 'Чертёж: Эпический клинок', scrapCost: 5, tries: 35, desc: 'Гарантированный мощный крафт (лучший из 35).'},
  {id: 'bp_leg',  name: 'Чертёж: Легендарное ядро', scrapCost: 15, tries: 180, desc: 'Топовый крафт (лучший из 180 вариантов).'},
];

export function factionBonuses(S) {
  const f = S.faction;
  return {
    arenaMult: f === 'yakuza' ? 1.12 : 1,
    creditMult: f === 'corps' ? 1.18 : 1,
    ocBonus: f === 'abyss' ? 0.08 : 0,
    prestigeMult: 1 + (S.prestige || 0) * 0.25,
    clanMult: S.clan ? 1 + (S.clan.lv - 1) * 0.06 : 1,
  };
}

export function currentBoss(S) {
  const lv = S.boss?.lv || 1;
  const tpl = RAID_BOSSES[(lv - 1) % RAID_BOSSES.length];
  const scale = Math.pow(1.45, Math.floor((lv - 1) / RAID_BOSSES.length));
  const maxHp = Math.round(tpl.hp * scale);
  const hp = S.boss?.hp != null ? Math.min(S.boss.hp, maxHp) : maxHp;
  return {...tpl, lv, maxHp, hp, reward: Math.round(tpl.reward * scale)};
}

export function strikeRaidBoss(S, squadItems, useFlux = false) {
  const b = currentBoss(S);
  const fb = factionBonuses(S);
  let dmg = 0;
  let weakHit = false;
  for (const w of squadItems) {
    let p = w.power * fb.arenaMult * fb.prestigeMult * fb.clanMult;
    if (w.el?.n === b.weak) { p *= 1.6; weakHit = true; }
    else if (w.el?.n === b.resist) p *= 0.65;
    dmg += p;
  }
  dmg = Math.max(120, Math.round(dmg * (0.9 + Math.random() * 0.25)));
  if (useFlux && (S.flux || 0) > 0) {
    S.flux--;
    dmg = Math.round(dmg * 1.45);
  }
  const left = Math.max(0, b.hp - dmg);
  let killed = false, runeDrop = null;
  if (left <= 0) {
    killed = true;
    S.credits += b.reward;
    S.flux = (S.flux || 0) + 1;
    S.scrap = (S.scrap || 0) + 2;
    S.warPts = (S.warPts || 0) + 150;
    // Drop a random rune chip
    const r = RUNE_POOL[Math.floor(Math.random() * RUNE_POOL.length)];
    runeDrop = {...r, uid: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 999)};
    S.runes = S.runes || [];
    S.runes.push(runeDrop);
    const nextLv = b.lv + 1;
    const nextTpl = RAID_BOSSES[(nextLv - 1) % RAID_BOSSES.length];
    const nextScale = Math.pow(1.45, Math.floor((nextLv - 1) / RAID_BOSSES.length));
    S.boss = {lv: nextLv, hp: Math.round(nextTpl.hp * nextScale)};
  } else {
    S.boss = {lv: b.lv, hp: left};
  }
  return {dmg, weakHit, killed, reward: killed ? b.reward : 0, runeDrop, boss: currentBoss(S)};
}

export function socketRune(S, itemId, runeUid) {
  const item = S.arsenal.find(x => x.id === itemId);
  const idx = (S.runes || []).findIndex(r => r.uid === runeUid);
  if (!item || idx < 0) return {ok: false};
  const rune = S.runes[idx];
  S.runes.splice(idx, 1);
  if (item.rune) S.runes.push(item.rune); // return old rune to bag
  if (!item.basePower) item.basePower = item.power;
  item.rune = rune;
  item.runeBonus = Math.round(item.basePower * rune.mult);
  const ocStep = item.oc ? (item.power - (item.runeBonus || 0)) : item.basePower;
  item.power = Math.max(item.basePower, ocStep) + item.runeBonus;
  return {ok: true, item, rune};
}

export function canPrestige(S) {
  return S.unlocked.length >= 5;
}

export function doPrestige(S) {
  if (!canPrestige(S)) return false;
  S.prestige = (S.prestige || 0) + 1;
  S.credits = 500 * S.prestige;
  S.loc = 'neo';
  S.unlocked = ['neo'];
  S.up = {mult: 0, luck: 0, reactor: 0, auto: 0, strike: 0};
  S.flux = (S.flux || 0) + 3;
  // Keep trophies, arsenal top-3, faction, clan, runes, achievements, dex!
  S.arsenal = [...S.arsenal].sort((a, b) => b.power - a.power).slice(0, 3);
  return true;
}

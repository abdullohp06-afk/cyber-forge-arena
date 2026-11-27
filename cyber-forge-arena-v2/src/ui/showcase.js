// Витрина: markup for the catalog screen. Read-only view of S.dex and S.stats.tags; no game rules here.
import {ROMAN, INDEX_TAGS} from '../config/gameData.js';
import {catalog, dexProgress, indexProgress} from '../engine/collection.js';
import {icon} from './icons.js';

const pct = ({found, total}) => Math.round(found / total * 100);

function item(dex, it) {
  const r = dex[it.key];
  if (!r) return '<li class="unk" aria-label="Не найдено"><b>?</b></li>';
  return `<li class="found r${r}${it.mythic ? ' myth' : ''}"><b>${it.n}</b><small>${r === 5 ? 'Ω' : ROMAN[r]}</small></li>`;
}

export function showcaseHtml(S) {
  const all = dexProgress(S.dex), idx = indexProgress(S.stats.tags);
  const locs = catalog().map(l => {
    if (!S.unlocked.includes(l.loc)) {
      return `<section class="dex-loc locked" style="--h:${l.hue}"><h3>${icon('lock')}${l.name}</h3><p class="small">Откроется вместе с локацией — в Магазине.</p></section>`;
    }
    const p = dexProgress(S.dex, l.loc);
    return `<section class="dex-loc" style="--h:${l.hue}">
      <h3>${l.name} <span class="num">${p.found}/${p.total}</span></h3>
      <div class="prog"><i style="width:${pct(p)}%"></i></div>
      ${l.groups.map(g => `<h4>${g.title}</h4><ul class="dex-grid">${g.items.map(it => item(S.dex, it)).join('')}</ul>`).join('')}
    </section>`;
  }).join('');
  const tags = INDEX_TAGS.map(([id, n]) => {
    const c = S.stats.tags?.[id] ?? 0;
    return `<li class="${c ? 'found' : 'unk'}"><b>${c ? n : '?'}</b>${c ? `<small class="num">×${c}</small>` : ''}</li>`;
  }).join('');
  return `<div class="dex-sum card"><div class="row"><div class="grow"><div class="label">Каталог находок</div>
      <div class="big num">${all.found}<small>/${all.total}</small></div></div>
      <div class="grow"><div class="label">Индексы</div><div class="big num">${idx.found}<small>/${idx.total}</small></div></div></div>
    <p class="small">Находка записывается при первом выпадении. Лучший ранг запоминается.</p></div>
    ${locs}
    <section class="dex-loc"><h3>Индексы и резонансы</h3><ul class="dex-grid wide">${tags}</ul></section>`;
}

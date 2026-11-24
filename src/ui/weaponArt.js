// Procedural weapons on canvas: the silhouette comes from the weapon slot, the energy veins from the element,
// rank runes are engraved on the blade. Pure geometry in a 200×80 local box centred on (0,0).
import {ROMAN} from '../config/gameData.js';

const ARCH = [
  [/катан|клинок|резак/i, 'blade'], [/кос|жнец/i, 'scythe'], [/молот|кулак|кастет/i, 'hammer'],
  [/рельс|рейлган|пушк|фазер|шокер/i, 'rail'], [/дрон/i, 'drone'], [/сфер|сингуляр|призм|матриц|орбит/i, 'orb'],
  [/хлыст|цеп/i, 'whip'], [/гарпун|вектор|бур|копь/i, 'spear'], [/лук/i, 'bow'],
];
export const archetype = name => ARCH.find(([re]) => re.test(name))?.[1] ?? 'blade';

const ELEMENTS = [
  [/неон|ток|пульс|дождь|глитч|хром/i, {a: '#00f0ff', b: '#e6fdff', fx: 'bolt'}],
  [/магм|термит|ядро|плазм/i, {a: '#ff5a1a', b: '#ffd36b', fx: 'lava'}],
  [/стал|вольфрам/i, {a: '#a9c1e0', b: '#ffffff', fx: 'plain'}],
  [/пустот|тень|скверн|мгл|разлом|шёпот/i, {a: '#a259ff', b: '#f3e3ff', fx: 'void'}],
  [/кварк|фотон|тахион|струн|спин|энтроп/i, {a: '#ff3366', b: '#ffffff', fx: 'prism'}],
  [/корон|вспышк|нова|аврор|квазар|звездопад/i, {a: '#ffe066', b: '#fffbe6', fx: 'bolt'}],
];
export const elementStyle = name => ELEMENTS.find(([re]) => re.test(name))?.[1] ?? {a: '#00f0ff', b: '#ffffff', fx: 'bolt'};

const EDGE = '#0a0e1a', GRIP = '#161d31';
function metal(ctx, y0 = -24, y1 = 24) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#eef4ff'); g.addColorStop(0.45, '#9aabc8'); g.addColorStop(1, '#3a4660');
  return g;
}
function paint(ctx, fill, line = 2) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = line; ctx.strokeStyle = EDGE; ctx.stroke(); }
function grip(ctx, x, w, h = 10) {
  ctx.beginPath(); ctx.rect(x, -h / 2, w, h); paint(ctx, GRIP);
  ctx.strokeStyle = '#2c3756'; ctx.lineWidth = 2;
  for (let i = x + 4; i < x + w - 2; i += 7) { ctx.beginPath(); ctx.moveTo(i, -h / 2); ctx.lineTo(i + 4, h / 2); ctx.stroke(); }
}

// Each shape draws its body and returns the vein polyline and the rune position.
const SHAPES = {
  blade(ctx) {
    grip(ctx, -96, 46);
    ctx.beginPath(); ctx.rect(-50, -15, 7, 30); paint(ctx, '#2a3350');
    ctx.beginPath(); ctx.moveTo(-43, -7); ctx.quadraticCurveTo(30, -13, 98, -3); ctx.lineTo(90, 6); ctx.quadraticCurveTo(25, 4, -43, 7); ctx.closePath();
    paint(ctx, metal(ctx, -12, 8));
    return {v: [[-38, 0], [0, -2], [44, -3], [86, -1]], rune: [-24, -1]};
  },
  scythe(ctx) {
    grip(ctx, -96, 150, 7);
    ctx.beginPath(); ctx.moveTo(52, -3); ctx.quadraticCurveTo(78, -46, -24, -40); ctx.quadraticCurveTo(42, -30, 64, 4); ctx.closePath();
    paint(ctx, metal(ctx, -42, 4));
    return {v: [[58, -6], [48, -24], [20, -34], [-14, -38]], rune: [34, -30]};
  },
  hammer(ctx) {
    grip(ctx, -96, 136, 8);
    ctx.beginPath(); ctx.roundRect(38, -30, 48, 60, 6); paint(ctx, metal(ctx, -30, 30));
    ctx.beginPath(); ctx.rect(30, -12, 10, 24); paint(ctx, '#2a3350');
    return {v: [[46, -22], [62, 0], [46, 22], [78, 22], [62, 0], [78, -22]], rune: [-40, 0]};
  },
  rail(ctx) {
    ctx.beginPath(); ctx.rect(-46, 8, 15, 26); paint(ctx, GRIP);
    ctx.beginPath(); ctx.roundRect(-82, -14, 152, 24, 5); paint(ctx, metal(ctx, -14, 10));
    ctx.beginPath(); ctx.rect(70, -6, 28, 9); paint(ctx, '#2a3350');
    for (let x = -50; x <= 46; x += 24) { ctx.beginPath(); ctx.rect(x, -18, 9, 4); paint(ctx, '#2a3350', 1); }
    return {v: [[-76, -2], [-20, -2], [34, -2], [96, -2]], rune: [-62, -2]};
  },
  drone(ctx, t) {
    ctx.strokeStyle = '#3a4660'; ctx.lineWidth = 5;
    for (const [x, y] of [[-48, -24], [48, -24], [-48, 24], [48, 24]]) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, 2 + 16 * Math.abs(Math.sin(t * 30 + x)), 4, 0, 0, Math.PI * 2); paint(ctx, '#9aabc866', 1);
    }
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); paint(ctx, metal(ctx, -20, 20));
    return {v: [[-48, -24], [0, 0], [48, 24], [0, 0], [48, -24], [0, 0], [-48, 24]], rune: [0, 1]};
  },
  orb(ctx, t) {
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-10, -10, 4, 0, 0, 30); g.addColorStop(0, '#eef4ff'); g.addColorStop(1, '#2a3350');
    paint(ctx, g);
    ctx.lineWidth = 2; ctx.strokeStyle = '#9aabc8';
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 12, t * 0.8, 0, Math.PI * 2); ctx.stroke();
    const v = Array.from({length: 9}, (_, i) => [Math.cos(i / 8 * Math.PI * 2 + t) * 22, Math.sin(i / 8 * Math.PI * 2 + t) * 22]);
    return {v, rune: [0, 2]};
  },
  whip(ctx, t) {
    grip(ctx, -96, 36, 12);
    const pts = [];
    for (let x = -60; x <= 96; x += 6) pts.push([x, Math.sin(x / 26 + t * 4) * 9 * (x + 60) / 156]);
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]);
      ctx.lineWidth = 9 - 6 * i / pts.length; ctx.strokeStyle = i % 2 ? '#9aabc8' : '#6b7a96'; ctx.stroke();
    }
    return {v: pts.filter((_, i) => i % 3 === 0), rune: [-78, 0]};
  },
  spear(ctx) {
    grip(ctx, -96, 152, 7);
    ctx.beginPath(); ctx.moveTo(54, -14); ctx.lineTo(98, 0); ctx.lineTo(54, 14); ctx.lineTo(62, 0); ctx.closePath(); paint(ctx, metal(ctx, -14, 14));
    ctx.beginPath(); ctx.moveTo(48, -10); ctx.lineTo(56, 0); ctx.lineTo(48, 10); paint(ctx, '#2a3350', 1.5);
    return {v: [[-80, 0], [0, 0], [60, 0], [92, 0]], rune: [-30, 0]};
  },
  bow(ctx) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, -38); ctx.quadraticCurveTo(48, 0, -20, 38); ctx.lineWidth = 8; ctx.strokeStyle = '#9aabc8'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, -38); ctx.lineTo(-20, 38); ctx.lineWidth = 1.5; ctx.strokeStyle = '#e6f1ff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-74, 0); ctx.lineTo(74, 0); ctx.lineWidth = 3; ctx.strokeStyle = '#6b7a96'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(74, -7); ctx.lineTo(92, 0); ctx.lineTo(74, 7); ctx.closePath(); paint(ctx, metal(ctx, -7, 7), 1.5);
    return {v: [[-20, -38], [6, -18], [14, 0], [6, 18], [-20, 38]], rune: [-34, -14]};
  },
};

function veins(ctx, pts, st, t, rank) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = st.a; ctx.shadowBlur = 6 + rank * 3;
  if (st.fx === 'prism') {
    const g = ctx.createLinearGradient(-90, 0, 90, 0);
    ['#ff3366', '#ffcc33', '#4ade80', '#00f0ff', '#b06bff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    ctx.strokeStyle = g;
  } else ctx.strokeStyle = st.a;
  const w = 1.2 + rank * 0.55;
  ctx.lineWidth = w;
  ctx.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const dy = st.fx === 'bolt' ? (k % 2 ? 1 : -1) * 2.2 * Math.sin(t * 22 + i * 3 + k)
        : st.fx === 'lava' ? Math.sin(x * 0.35 + i) * 2.4
        : st.fx === 'void' ? Math.sin(x * 0.15 + t * 5) * 3 : 0;
      i || k ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy);
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = st.b; ctx.lineWidth = w * 0.4; ctx.stroke();      // white-hot core
  if (st.fx === 'lava') {                                                                  // branching cracks
    ctx.strokeStyle = st.a; ctx.lineWidth = 1;
    pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + (i % 2 ? 6 : -6)); ctx.stroke(); });
  }
  ctx.restore();
}

/** Draw `art` centred at (x, y), `size` px wide. heat 0..1 = incandescent glow after a hammer hit. */
export function drawWeapon(ctx, art, x, y, size, {t = 0, heat = 0, flip = false, aura = true} = {}) {
  const st = elementStyle(art.el.n), rank = Math.min(5, Math.max(art.wp.r, art.el.r, art.pk.r === 5 ? 5 : 0));
  ctx.save();
  ctx.translate(x, y);
  const s = size / 200;
  ctx.scale(flip ? -s : s, s);
  if (aura) {
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    g.addColorStop(0, (art.pk.r === 5 ? '#ff3366' : st.a) + (art.tempered ? '66' : '33')); g.addColorStop(1, '#00000000');
    ctx.fillStyle = g; ctx.fillRect(-110, -60, 220, 120);
  }
  const shape = SHAPES[archetype(art.wp.n)](ctx, t);
  veins(ctx, shape.v, st, t, rank);
  ctx.save();                                                                              // runes read correctly when mirrored
  ctx.translate(...shape.rune); if (flip) ctx.scale(-1, 1);
  ctx.font = '800 12px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = art.pk.r === 5 ? '#ff3366' : st.b; ctx.shadowColor = st.a; ctx.shadowBlur = 6;
  ctx.fillText(ROMAN[rank] || 'I', 0, 0);
  ctx.restore();
  if (art.tempered) { ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 1.5; ctx.shadowColor = '#ffcc33'; ctx.shadowBlur = 12; ctx.strokeRect(-100, -44, 200, 88); }
  if (heat > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 100);
    g.addColorStop(0, `rgba(255,255,240,${0.9 * heat})`); g.addColorStop(0.5, `rgba(255,190,60,${0.5 * heat})`); g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-100, -50, 200, 100);
  }
  ctx.restore();
}

const thumbs = new Map();
/** PNG data-URL preview for cards, cached per look. */
export function weaponThumb(art) {
  const key = [art.wp.n, art.el.n, art.wp.r, art.el.r, art.pk.r, art.tempered ? 1 : 0].join('|');
  if (!thumbs.has(key)) {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 96;
    drawWeapon(c.getContext('2d'), art, 120, 48, 220, {t: 0.3});
    thumbs.set(key, c.toDataURL('image/png'));
  }
  return thumbs.get(key);
}

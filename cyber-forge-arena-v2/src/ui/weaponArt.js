// Procedural weapons on canvas, drawn in layers: element aura → bevelled steel body with a carbon grip → plasma
// tubes → animated element effect → rarity add-ons (energy wings, floating shards, particle crown) → rank rune.
// Pure geometry in a 200×80 local box centred on (0,0).
import {ROMAN, TIERS} from '../config/gameData.js';

const TAU = Math.PI * 2;
const rnd = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

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
  [/корон|вспышк|нова|аврор|квазар|звездопад|звезд|свет/i, {a: '#ffe066', b: '#fffbe6', fx: 'sun'}],
];
export const elementStyle = name => ELEMENTS.find(([re]) => re.test(name))?.[1] ?? {a: '#00f0ff', b: '#ffffff', fx: 'bolt'};

const EDGE = '#0f172a';
function metal(ctx, y0 = -24, y1 = 24) {                 // polished steel: bright bevel → mid steel → dark underside
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#cbd5e1'); g.addColorStop(0.2, '#f8fafc'); g.addColorStop(0.32, '#e2e8f0');
  g.addColorStop(0.58, '#94a3b8'); g.addColorStop(1, '#1e293b');
  return g;
}
// No cartoon outline: a hairline of the steel's own dark tone keeps the silhouette crisp on any backdrop.
function paint(ctx, fill, line = 2) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = Math.min(line, 1) * 0.8; ctx.strokeStyle = '#1e293bb3'; ctx.stroke(); }
function grip(ctx, x, w, h = 10) {                       // carbon weave wrap + pommel cap
  ctx.save();
  ctx.beginPath(); ctx.rect(x, -h / 2, w, h); paint(ctx, '#0e121c');
  ctx.clip();
  ctx.fillStyle = '#242c42';
  for (let i = 0; i * 4 < w; i++) for (let j = 0; j * 4 < h + 4; j++) if ((i + j) % 2) ctx.fillRect(x + i * 4, -h / 2 + j * 4 - 2, 3, 3);
  ctx.fillStyle = '#ffffff18'; ctx.fillRect(x, -h / 2 + 1, w, 2);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(x - 6, -h / 2 - 2, 7, h + 4, 2); paint(ctx, metal(ctx, -h / 2 - 2, h / 2 + 2), 1.5);
}

// Each shape draws its body and returns the plasma-tube polyline (v), the rune spot and the guard point (g) for wings.
const SHAPES = {
  blade(ctx) {
    grip(ctx, -94, 44);
    ctx.beginPath(); ctx.moveTo(-50, -16); ctx.lineTo(-42, -12); ctx.lineTo(-42, 12); ctx.lineTo(-50, 16); ctx.closePath(); paint(ctx, '#2a3350');  // tsuba
    ctx.beginPath(); ctx.moveTo(-43, -7); ctx.quadraticCurveTo(30, -13, 98, -3); ctx.lineTo(90, 6); ctx.quadraticCurveTo(25, 4, -43, 7); ctx.closePath();
    paint(ctx, metal(ctx, -12, 8));
    ctx.beginPath(); ctx.moveTo(-43, 3); ctx.quadraticCurveTo(25, 1, 92, 4); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffffcc'; ctx.stroke();   // honed edge
    return {v: [[-38, -1], [0, -3], [44, -4], [84, -2]], rune: [-24, -1], g: [-46, 0]};
  },
  scythe(ctx) {
    grip(ctx, -94, 148, 7);
    ctx.beginPath(); ctx.moveTo(52, -3); ctx.quadraticCurveTo(78, -46, -24, -40); ctx.quadraticCurveTo(42, -30, 64, 4); ctx.closePath();
    paint(ctx, metal(ctx, -42, 4));
    ctx.beginPath(); ctx.moveTo(-20, -39); ctx.quadraticCurveTo(44, -31, 63, 2); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffffcc'; ctx.stroke();
    ctx.beginPath(); ctx.rect(44, -8, 14, 16); paint(ctx, '#2a3350', 1.5);
    return {v: [[58, -6], [48, -24], [20, -34], [-14, -38]], rune: [34, -30], g: [50, 0]};
  },
  hammer(ctx) {
    grip(ctx, -94, 134, 8);
    ctx.beginPath(); ctx.roundRect(38, -30, 48, 60, 6); paint(ctx, metal(ctx, -30, 30));
    ctx.beginPath(); ctx.roundRect(84, -24, 8, 48, 3); paint(ctx, '#2a3350', 1.5);                // striking plate
    ctx.beginPath(); ctx.rect(30, -12, 10, 24); paint(ctx, '#2a3350');
    ctx.fillStyle = '#c9d3e6'; for (const [x, y] of [[43, -25], [81, -25], [43, 25], [81, 25]]) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
    return {v: [[46, -20], [62, 0], [46, 20], [78, 20], [62, 0], [78, -20]], rune: [-40, 0], g: [32, 0]};
  },
  rail(ctx) {
    ctx.beginPath(); ctx.rect(-46, 8, 15, 26); paint(ctx, '#0e121c');
    ctx.beginPath(); ctx.roundRect(-82, -14, 152, 24, 5); paint(ctx, metal(ctx, -14, 10));
    ctx.beginPath(); ctx.rect(70, -6, 28, 9); paint(ctx, '#2a3350');
    for (let x = -50; x <= 46; x += 24) { ctx.beginPath(); ctx.rect(x, -18, 9, 4); paint(ctx, '#2a3350', 1); }
    ctx.beginPath(); ctx.rect(-80, 4, 148, 4); ctx.fillStyle = '#0e121c'; ctx.fill();                     // carbon underside
    return {v: [[-76, -3], [-20, -3], [34, -3], [96, -2]], rune: [-62, -3], g: [-40, 8]};
  },
  drone(ctx, t) {
    ctx.strokeStyle = '#3a4660'; ctx.lineWidth = 5;
    for (const [x, y] of [[-48, -24], [48, -24], [-48, 24], [48, 24]]) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, 2 + 16 * Math.abs(Math.sin(t * 30 + x)), 4, 0, 0, TAU); paint(ctx, '#9aabc866', 1);
    }
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); paint(ctx, metal(ctx, -20, 20));
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); paint(ctx, '#0e121c', 1.5);
    return {v: [[-48, -24], [0, 0], [48, 24], [0, 0], [48, -24], [0, 0], [-48, 24]], rune: [0, 1], g: [0, 0]};
  },
  orb(ctx, t) {
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU);
    const g = ctx.createRadialGradient(-10, -10, 4, 0, 0, 30); g.addColorStop(0, '#f4f8ff'); g.addColorStop(0.5, '#7d8ca8'); g.addColorStop(1, '#1c2336');
    paint(ctx, g);
    ctx.lineWidth = 3; ctx.strokeStyle = '#9aabc8';
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 12, t * 0.8, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#5d6b86'; ctx.beginPath(); ctx.ellipse(0, 0, 38, 30, -t * 0.5, 0, TAU); ctx.stroke();
    const v = Array.from({length: 9}, (_, i) => [Math.cos(i / 8 * TAU + t) * 22, Math.sin(i / 8 * TAU + t) * 22]);
    return {v, rune: [0, 2], g: [0, 0]};
  },
  whip(ctx, t) {
    grip(ctx, -94, 34, 12);
    const pts = [];
    for (let x = -60; x <= 96; x += 6) pts.push([x, Math.sin(x / 26 + t * 4) * 9 * (x + 60) / 156]);
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]);
      ctx.lineWidth = 9 - 6 * i / pts.length; ctx.strokeStyle = i % 2 ? '#c3cfe2' : '#5d6b86'; ctx.stroke();
    }
    return {v: pts.filter((_, i) => i % 3 === 0), rune: [-78, 0], g: [-60, 0]};
  },
  spear(ctx) {
    grip(ctx, -94, 150, 7);
    ctx.beginPath(); ctx.moveTo(54, -14); ctx.lineTo(98, 0); ctx.lineTo(54, 14); ctx.lineTo(62, 0); ctx.closePath(); paint(ctx, metal(ctx, -14, 14));
    ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(98, 0); ctx.lineWidth = 1; ctx.strokeStyle = '#ffffffaa'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(48, -10); ctx.lineTo(56, 0); ctx.lineTo(48, 10); paint(ctx, '#2a3350', 1.5);
    return {v: [[-80, 0], [0, 0], [60, 0], [92, 0]], rune: [-30, 0], g: [46, 0]};
  },
  bow(ctx) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, -38); ctx.quadraticCurveTo(48, 0, -20, 38); ctx.lineWidth = 9; ctx.strokeStyle = EDGE; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#c3cfe2'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, -38); ctx.lineTo(-20, 38); ctx.lineWidth = 1.5; ctx.strokeStyle = '#e6f1ff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-74, 0); ctx.lineTo(74, 0); ctx.lineWidth = 3; ctx.strokeStyle = '#6b7a96'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(74, -7); ctx.lineTo(92, 0); ctx.lineTo(74, 7); ctx.closePath(); paint(ctx, metal(ctx, -7, 7), 1.5);
    return {v: [[-20, -38], [6, -18], [14, 0], [6, 18], [-20, 38]], rune: [-34, -14], g: [14, 0]};
  },
};

function tubeColor(ctx, st, t) {
  if (st.fx !== 'prism') return st.a;
  const g = ctx.createLinearGradient(-90, 0, 90, 0);                 // the rainbow drifts along the tube
  for (let i = 0; i < 5; i++) g.addColorStop(i / 4, `hsl(${(t * 120 + i * 72) % 360},100%,62%)`);
  return g;
}

function pointAt(pts, f) {                                           // position at share f of a polyline's length
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const k = d / (seg[i] || 1); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

function tubes(ctx, pts, st, t, rank) {                              // dark casing, glowing plasma, white-hot core, a travelling pulse
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const w = 1.4 + rank * 0.55;
  ctx.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const dy = st.fx === 'bolt' ? (k % 2 ? 1 : -1) * 2 * Math.sin(t * 22 + i * 3 + k)
        : st.fx === 'lava' ? Math.sin(x * 0.35 + i) * 2.2
        : st.fx === 'void' ? Math.sin(x * 0.15 + t * 5) * 2.6 : 0;
      i || k ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy);
    }
  }
  ctx.lineWidth = w + 1.6; ctx.strokeStyle = EDGE; ctx.globalAlpha = 0.85; ctx.stroke();       // the channel cut into the steel
  ctx.globalCompositeOperation = 'lighter';                                                     // plasma adds light, never paints over
  ctx.shadowColor = st.a; ctx.shadowBlur = 6 + rank * 3;
  ctx.lineWidth = w; ctx.strokeStyle = tubeColor(ctx, st, t);
  ctx.globalAlpha = st.fx === 'lava' ? 0.75 + 0.25 * Math.sin(t * 5) : 1;                       // magma breathes
  ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.strokeStyle = st.b; ctx.lineWidth = w * 0.4; ctx.stroke();
  const [px, py] = pointAt(pts, (t * 0.7) % 1), g = ctx.createRadialGradient(px, py, 0, px, py, 7 + rank);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, st.a); g.addColorStop(1, st.a + '00');
  ctx.fillStyle = g; ctx.fillRect(px - 10 - rank, py - 10 - rank, 20 + rank * 2, 20 + rank * 2);
  ctx.restore();
}

function backFx(ctx, st, t) {                                         // effects behind the body
  if (st.fx === 'void') {                                            // a wobbling dark aura that bends the air
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(0, 0, 96 + Math.sin(t * 3 + i * 2) * 8, 30 + Math.cos(t * 2.3 + i) * 7, Math.sin(t + i) * 0.12, 0, TAU);
      ctx.fillStyle = '#1a0830' + (i ? '33' : '55'); ctx.fill();
      ctx.strokeStyle = '#a259ff40'; ctx.lineWidth = 1; ctx.stroke();
    }
  } else if (st.fx === 'sun') {                                      // turning sun rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 0.4);
    ctx.strokeStyle = '#ffe06655'; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = 40 + 14 * Math.sin(t * 3 + i); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a) * (22 + r), Math.sin(a) * (22 + r) * 0.6); ctx.stroke(); }
    ctx.restore();
  }
}

function frontFx(ctx, st, pts, t, still) {                            // effects on top of the body; still = card thumbnail, no moving sheen
  if (st.fx === 'bolt') {                                            // arcs jump off the plasma tube
    ctx.save(); ctx.strokeStyle = st.b; ctx.shadowColor = st.a; ctx.shadowBlur = 8; ctx.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) {
      const seed = Math.floor(t * 14) * 3 + k * 7, [x0, y0] = pointAt(pts, rnd(seed));
      let x = x0, y = y0; const dir = rnd(seed + 1) > 0.5 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (rnd(seed + s + 2) - 0.5) * 16; y += dir * (5 + rnd(seed + s + 5) * 6); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  } else if (st.fx === 'lava') {                                     // smoke curls off the hot cracks
    for (let i = 0; i < 4; i++) {
      const cyc = (t * 0.45 + i / 4) % 1, [x, y] = pointAt(pts, (i + 0.5) / 4);
      ctx.fillStyle = `rgba(90,78,74,${0.3 * (1 - cyc)})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + i) * 6, y - 8 - cyc * 40, 4 + cyc * 10, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = st.a; ctx.lineWidth = 1;
    pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + (i % 2 ? 6 : -6)); ctx.stroke(); });
  } else if (st.fx === 'prism' && !still) {                          // a rainbow sheen sweeps across
    const x = ((t * 90) % 260) - 130, g = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    g.addColorStop(0, '#ffffff00'); g.addColorStop(0.5, `hsla(${(t * 200) % 360},100%,75%,0.45)`); g.addColorStop(1, '#ffffff00');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - 20, -44, 40, 88); ctx.restore();
  }
}

function rarityFx(ctx, tier, gp, t, color) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const [gx, gy] = gp;
  ctx.shadowColor = color; ctx.shadowBlur = 6;                       // guard diodes: one lit per tier step
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < Math.ceil((tier + 1) / 2) ? color : '#334155';
    ctx.beginPath(); ctx.arc(gx - 2, gy - 6 + i * 6, 1.6, 0, TAU); ctx.fill();
  }
  if (tier >= 3) {                                                   // Эпический+: slim energy fins sweeping back from the guard
    const flap = 1 + 0.08 * Math.sin(t * 3), g = ctx.createLinearGradient(gx, 0, gx - 40, 0);
    g.addColorStop(0, color + 'cc'); g.addColorStop(1, color + '00');
    ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.shadowBlur = 8;
    for (const s of [-1, 1]) for (const k of [0, 1]) {
      ctx.beginPath(); ctx.moveTo(gx - 3, gy + s * 4);
      ctx.quadraticCurveTo(gx - 14 - k * 6, gy + s * (16 + k * 6) * flap, gx - 36 - k * 8, gy + s * (20 + k * 8) * flap); ctx.stroke();
    }
  }
  if (tier >= 4) {                                                   // Легендарный+: a rune ring and shards orbiting the blade
    ctx.shadowBlur = 8;
    runeRing(ctx, t, color, tier);
    const shards = tier >= 5 ? 5 : 3;
    for (let i = 0; i < shards; i++) {
      const a = t * 0.9 + i * TAU / shards, x = Math.cos(a) * 104, y = Math.sin(a) * 40, r = 4 + 2 * rnd(i);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.6); ctx.lineTo(x - r, y); ctx.fill();
    }
  }
  if (tier >= 5) {                                                   // Мифический: a crown of particles over the blade
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i + 1) / 10 * Math.PI;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + i));
      ctx.fillStyle = i % 2 ? '#ffffff' : color;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 40, -24 + Math.sin(a) * 26, 2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
/** A slowly turning ring of runes behind the blade. Mythic gets a second, counter-rotating ring. */
function runeRing(ctx, t, color, tier) {
  ctx.save();
  ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [spin, rx, ry, n] of tier >= 5 ? [[0.22, 92, 34, 12], [-0.15, 66, 24, 8]] : [[0.22, 92, 34, 10]]) {
    for (let i = 0; i < n; i++) {
      const a = t * spin + i * TAU / n;
      ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(a));                // the far side of the ring fades
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.fillText(RUNES[i % RUNES.length], Math.cos(a) * rx, Math.sin(a) * ry);
    }
  }
  ctx.restore();
}

/** Draw `art` centred at (x, y), `size` px wide. heat 0..1 = incandescent glow after a hammer hit. */
export function drawWeapon(ctx, art, x, y, size, {t = 0, heat = 0, flip = false, aura = true, still = false} = {}) {
  const st = elementStyle(art.el.n), rank = Math.min(5, Math.max(art.wp.r, art.el.r, art.pk.r === 5 ? 5 : 0));
  const tier = Number.isInteger(art.tier) ? art.tier : Math.max(0, rank - 1), tc = TIERS[tier]?.c ?? st.a;
  ctx.save();
  ctx.translate(x, y);
  const s = size / 200;
  ctx.scale(flip ? -s : s, s);
  if (aura) {
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    g.addColorStop(0, (art.pk.r === 5 ? '#ff3366' : tier >= 4 ? tc : st.a) + (art.tempered ? '66' : '33')); g.addColorStop(1, '#00000000');
    ctx.fillStyle = g; ctx.fillRect(-110, -60, 220, 120);
  }
  backFx(ctx, st, t);
  const shape = SHAPES[archetype(art.wp.n)](ctx, t);
  tubes(ctx, shape.v, st, t, rank);
  frontFx(ctx, st, shape.v, t, still);
  rarityFx(ctx, tier, shape.g, t, tc);
  ctx.save();                                                                              // runes read correctly when mirrored
  ctx.translate(...shape.rune); if (flip) ctx.scale(-1, 1);
  ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 3); ctx.fillStyle = '#05070ccc'; ctx.fill(); ctx.strokeStyle = tc; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '800 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = art.pk.r === 5 ? '#ff3366' : st.b; ctx.shadowColor = st.a; ctx.shadowBlur = 6;
  ctx.fillText(rank >= 5 ? 'Ω' : ROMAN[rank] || 'I', 0, 0.5);
  ctx.restore();
  if (art.tempered) temperedFrame(ctx, t, still);
  if (heat > 0) coolDown(ctx, heat, st.a);
  ctx.restore();
}

/** ★ ЗАКАЛЁН: a gold frame with two lightning bolts running around it in opposite directions. */
function temperedFrame(ctx, t, still) {
  const w = 200, h = 88, per = 2 * (w + h);                                   // perimeter of the frame, walked by the bolts
  const at = d => {                                                          // distance along the perimeter → point on the frame
    let k = ((d % per) + per) % per;
    if (k < w) return [-100 + k, -44];
    if ((k -= w) < h) return [100, -44 + k];
    if ((k -= h) < w) return [100 - k, 44];
    return [-100, 44 - (k - w)];
  };
  ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 1.5; ctx.shadowColor = '#ffcc33'; ctx.shadowBlur = 12;
  ctx.strokeRect(-100, -44, w, h);
  if (!still) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.shadowBlur = 16;
    for (const dir of [1, -1]) {
      const head = dir * t * 300 + (dir < 0 ? per / 2 : 0);
      ctx.strokeStyle = '#fff3b0'; ctx.beginPath();
      for (let k = 0; k <= 9; k++) { const [px, py] = at(head - dir * k * 5); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.globalAlpha = 0.9; ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.shadowBlur = 0;
}

/**
 * The 0.8 s cool-down after a hammer blow: white hot → orange → cherry red → gone, letting the
 * element colour underneath take back over. heat runs 1 → 0 over the 800 ms the stage gives it.
 */
function coolDown(ctx, heat, elColor) {
  const stops = [[255, 255, 245], [255, 190, 60], [190, 30, 40]];             // white · orange · cherry
  const k = (1 - heat) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(k)), f = k - i;
  const mix = stops[i].map((v, n) => Math.round(v + (stops[i + 1][n] - v) * f));
  const core = `rgba(${mix.join(',')},${0.95 * heat})`;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 100);
  g.addColorStop(0, core);
  g.addColorStop(0.45, `rgba(${mix.join(',')},${0.45 * heat})`);
  g.addColorStop(0.8, elColor + Math.round(0x33 * heat).toString(16).padStart(2, '0'));   // the last of the glow bleeds into the element
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-100, -50, 200, 100);
}

const thumbs = new Map();
/** PNG data-URL preview for cards, cached per look. */
export function weaponThumb(art) {
  const key = [art.wp.n, art.el.n, art.wp.r, art.el.r, art.pk.r, art.tier, art.tempered ? 1 : 0].join('|');
  if (!thumbs.has(key)) {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 96;
    drawWeapon(c.getContext('2d'), art, 120, 48, 200, {t: 0.3, still: true});
    thumbs.set(key, c.toDataURL('image/png'));
  }
  return thumbs.get(key);
}

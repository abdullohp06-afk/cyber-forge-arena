// Per-location scenery for the forge stage: backdrop, anvil, striker, ambient particles and impact extras.
// Ambient particles are computed from time (no arrays), so the scene stays cheap at 60 FPS on phones.
const TAU = Math.PI * 2;
const rnd = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };   // stable per-index noise

export const LOC_FX = {
  neo:     {sparks: ['#00f0ff', '#ff9a3c', '#ffffff'], bg: ['#0a1426', '#04070f']},
  abyss:   {sparks: ['#b06bff', '#e3c8ff', '#ffffff'], bg: ['#140b28', '#050309']},
  titan:   {sparks: ['#ff7a1a', '#ffcc33', '#ff3d00'], bg: ['#220c04', '#070302']},
  quantum: {sparks: ['#ff3366', '#00f0ff', '#ffe066', '#7cff6b', '#b06bff'], bg: ['#0c0619', '#020108']},
  astral:  {sparks: ['#ffe066', '#fff6c8', '#ffffff'], bg: ['#1c1505', '#05040a']},
};
export const fxOf = loc => LOC_FX[loc] ?? LOC_FX.neo;

/* ---------- backdrops ---------- */

/** Big still gradients are painted once per size into an offscreen canvas and then only stamped: fills of the whole
 *  stage with radial gradients every frame were the main cost on large desktop stages. */
const layers = new Map();
function still(ctx, key, W, H, paint) {
  const k = `${key}:${Math.round(W)}x${Math.round(H)}`;
  let c = layers.get(k);
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H));
    paint(c.getContext('2d'));
    layers.set(k, c);
    if (layers.size > 16) layers.delete(layers.keys().next().value);
  }
  ctx.drawImage(c, 0, 0, W, H);
}

function fan(ctx, x, y, r, a, hue) {
  ctx.strokeStyle = '#2a3654'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#1a2238';
  for (let k = 0; k < 4; k++) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + k * TAU / 4);
    ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.45, r * 0.16, 0.3, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = hue; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
}

function gear(ctx, x, y, r, a, teeth, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const rr = i % 2 ? r : r * 1.18, ang = i / (teeth * 2) * TAU;
    ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0a0503'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, TAU); ctx.fill();
  ctx.restore();
}

const BACK = {
  neo(ctx, g) {                                                            // garage: corrugated wall, vent fans, rain behind the glass
    const {W, H, ay, t, hue} = g;
    ctx.fillStyle = '#0e1830';
    for (let x = 0; x < W; x += 14) ctx.fillRect(x, 0, 1, ay + 14);
    ctx.fillStyle = '#0b1428'; ctx.fillRect(W * 0.3, 10, W * 0.4, 44);                       // window
    ctx.strokeStyle = '#22304f'; ctx.lineWidth = 2; ctx.strokeRect(W * 0.3, 10, W * 0.4, 44);
    ctx.save(); ctx.beginPath(); ctx.rect(W * 0.3, 10, W * 0.4, 44); ctx.clip();
    ctx.strokeStyle = '#7fb8ff55'; ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = W * 0.3 + rnd(i) * W * 0.4, y = ((t * 220 + rnd(i + 50) * 60) % 64) + 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke();
    }
    ctx.restore();
    fan(ctx, W * 0.11, H * 0.3, Math.min(24, W * 0.06), t * 7, hue);
    fan(ctx, W * 0.89, H * 0.3, Math.min(24, W * 0.06), -t * 6, hue);
    ctx.fillStyle = '#111a30'; ctx.fillRect(0, ay + 14, W, H - ay - 14);                     // floor
    ctx.fillStyle = '#ffcc3333';
    for (let x = -20; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 11, ay + 14); ctx.lineTo(x + 19, ay + 14); ctx.lineTo(x + 8, H); ctx.fill(); }
  },
  abyss(ctx, g) {                                                          // void with a rift glow and drifting rock islands
    const {W, H, cx, ay, t} = g;
    still(ctx, 'abyss', W, H, c => {
      const glow = c.createRadialGradient(cx, ay - 20, 10, cx, ay - 20, W * 0.6);
      glow.addColorStop(0, '#b06bff33'); glow.addColorStop(1, 'transparent');
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
    });
    ctx.fillStyle = '#1d1233';
    for (let i = 0; i < 5; i++) {
      const x = rnd(i + 3) * W, y = 20 + rnd(i + 9) * 50 + Math.sin(t * 0.7 + i) * 3, s = 10 + rnd(i) * 16;
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.3, y + s * 1.2); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#d9b8ff';
    for (let i = 0; i < 18; i++) {                                         // ether shards rising
      const x = rnd(i) * W, y = H - ((t * 26 + rnd(i + 30) * H) % (H + 20)), r = 1 + rnd(i + 7) * 1.6;
      ctx.globalAlpha = 0.25 + 0.5 * rnd(i + 11);
      ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r, y); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  titan(ctx, g) {                                                          // foundry: magma falls, gears, rising embers
    const {W, H, ay, t} = g;
    gear(ctx, W * 0.24, H * 0.32, Math.min(30, W * 0.07), t * 0.6, 12, '#2b1408');
    gear(ctx, W * 0.76, H * 0.22, Math.min(20, W * 0.05), -t * 0.9, 9, '#2b1408');
    const off = (t * 120) % 40;
    for (const x of [W * 0.07, W * 0.93]) {
      ctx.fillStyle = '#ff5a1a33'; ctx.fillRect(x - 14, 0, 28, ay + 14);
      ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 14;
      for (let y = off - 40; y < ay + 14; y += 40) {                     // moving bands = flowing magma
        const fall = ctx.createLinearGradient(0, y, 0, y + 40);
        fall.addColorStop(0, '#ff5a1a'); fall.addColorStop(0.5, '#ffcc33'); fall.addColorStop(1, '#ff5a1a');
        ctx.fillStyle = fall; ctx.fillRect(x - 6, Math.max(0, y), 12, Math.min(40, ay + 14 - Math.max(0, y)));
      }
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#ffb347';
    for (let i = 0; i < 20; i++) {
      const x = rnd(i) * W + Math.sin(t * 2 + i) * 6, y = H - ((t * 40 + rnd(i + 21) * H) % (H + 10));
      ctx.globalAlpha = 0.3 + 0.6 * rnd(i + 5); ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#160904'; ctx.fillRect(0, ay + 14, W, H - ay - 14);
  },
  quantum(ctx, g) {                                                        // orbital lab: stars, a planet limb, holo floor
    const {W, H, ay, t} = g;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillRect(rnd(i) * W, rnd(i + 99) * ay, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
    still(ctx, 'quantum', W, H, c => {
      const planet = c.createRadialGradient(W * 0.1, H * 1.6, H * 0.6, W * 0.1, H * 1.6, H * 1.25);
      planet.addColorStop(0, '#2a1050'); planet.addColorStop(0.92, '#ff336655'); planet.addColorStop(1, 'transparent');
      c.fillStyle = planet; c.fillRect(0, 0, W, H);
    });
    ctx.strokeStyle = '#ff336622'; ctx.lineWidth = 1;
    for (let x = (t * 12) % 24; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, ay + 14); ctx.lineTo(g.cx + (x - g.cx) * 2.2, H); ctx.stroke(); }
  },
  astral(ctx, g) {                                                         // orbit of a star: sun glow, golden columns, star dust
    const {W, H, cx, ay, t} = g;
    still(ctx, 'astral', W, H, c => {
      const sun = c.createRadialGradient(cx, -H * 0.25, 6, cx, -H * 0.25, H * 1.1);
      sun.addColorStop(0, '#fff6c8'); sun.addColorStop(0.25, '#ffe06688'); sun.addColorStop(1, 'transparent');
      c.fillStyle = sun; c.fillRect(0, 0, W, H);
      for (const x of [W * 0.1, W * 0.9]) {
        const col = c.createLinearGradient(x - 10, 0, x + 10, 0);
        col.addColorStop(0, '#6b5212'); col.addColorStop(0.5, '#ffe066'); col.addColorStop(1, '#6b5212');
        c.fillStyle = col; c.fillRect(x - 9, 18, 18, ay - 4);
        c.fillRect(x - 14, 12, 28, 8); c.fillRect(x - 14, ay + 8, 28, 6);
      }
    });
    ctx.fillStyle = '#fff1a8';
    for (let i = 0; i < 30; i++) {
      const x = rnd(i) * W + Math.sin(t + i) * 4, y = (t * 14 + rnd(i + 40) * H) % H;
      ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * 3 + i)); ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  },
};

/* ---------- anvils ---------- */

function anvilShape(ctx, cx, ay, aw, H) {
  ctx.beginPath();
  ctx.moveTo(cx - aw / 2, ay); ctx.lineTo(cx + aw / 2, ay); ctx.lineTo(cx + aw / 2 - 14, ay + 14);
  ctx.lineTo(cx + aw * 0.22, ay + 14); ctx.lineTo(cx + aw * 0.3, H); ctx.lineTo(cx - aw * 0.3, H);
  ctx.lineTo(cx - aw * 0.22, ay + 14); ctx.lineTo(cx - aw / 2 + 14, ay + 14); ctx.closePath();
}
function edge(ctx, cx, ay, aw, color, blur) {
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.moveTo(cx - aw / 2, ay); ctx.lineTo(cx + aw / 2, ay); ctx.stroke(); ctx.shadowBlur = 0;
}

const ANVIL = {
  neo(ctx, g) {
    const {cx, ay, aw, H, level, od, hue} = g, gr = ctx.createLinearGradient(0, ay, 0, H);
    gr.addColorStop(0, '#3b4866'); gr.addColorStop(1, '#111829');
    ctx.fillStyle = gr; anvilShape(ctx, cx, ay, aw, H); ctx.fill();
    edge(ctx, cx, ay, aw, level >= 2 ? (od ? '#ffcc33' : hue) : '#5b6a8a', level >= 2 ? 12 : 0);
  },
  abyss(ctx, g) {                                                          // floating obsidian slab over a rune circle
    const {cx, ay, aw, t, od} = g, bob = Math.sin(t * 1.6) * 3;
    ctx.save(); ctx.translate(cx, ay + 30); ctx.scale(1, 0.28); ctx.rotate(t * 0.4);
    ctx.strokeStyle = od ? '#ffcc33' : '#b06bff'; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, aw * 0.62, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.arc(0, 0, aw * 0.52, a, a + 0.22); ctx.stroke(); }
    ctx.restore(); ctx.shadowBlur = 0;
    const y = ay + bob, gr = ctx.createLinearGradient(0, y, 0, y + 24);
    gr.addColorStop(0, '#2c1a48'); gr.addColorStop(1, '#0a0614');
    ctx.fillStyle = gr; ctx.beginPath();
    ctx.moveTo(cx - aw / 2, y); ctx.lineTo(cx + aw / 2, y); ctx.lineTo(cx + aw * 0.28, y + 24); ctx.lineTo(cx - aw * 0.28, y + 24); ctx.closePath(); ctx.fill();
    edge(ctx, cx, y, aw, od ? '#ffcc33' : '#c99bff', 14);
  },
  titan(ctx, g) {                                                          // heavy riveted block with a hot edge
    const {cx, ay, aw, H, od} = g, w = aw * 1.08, gr = ctx.createLinearGradient(0, ay, 0, H);
    gr.addColorStop(0, '#4a3326'); gr.addColorStop(1, '#140a05');
    ctx.fillStyle = gr; ctx.fillRect(cx - w / 2, ay, w, H - ay);
    ctx.fillStyle = '#8a6a50';
    for (const dx of [-w / 2 + 8, w / 2 - 8]) for (const dy of [8, 22]) { ctx.beginPath(); ctx.arc(cx + dx, ay + dy, 2.2, 0, TAU); ctx.fill(); }
    edge(ctx, cx, ay, w, od ? '#ffcc33' : '#ff7a1a', 16);
  },
  quantum(ctx, g) {                                                        // holographic prism
    const {cx, ay, aw, H, t, od} = g;
    const gr = ctx.createLinearGradient(cx - aw / 2, 0, cx + aw / 2, 0);
    ['#ff336655', '#ffe06644', '#00f0ff55', '#b06bff55'].forEach((c, i) => gr.addColorStop(i / 3, c));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(cx - aw / 2, ay); ctx.lineTo(cx + aw / 2, ay); ctx.lineTo(cx, H - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = od ? '#ffcc33' : '#ff3366'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6); ctx.stroke();
    ctx.globalAlpha = 1;
    edge(ctx, cx, ay, aw, od ? '#ffcc33' : '#ffffff', 12);
  },
  astral(ctx, g) {                                                         // stepped golden altar
    const {cx, ay, aw, H, od} = g;
    const gr = ctx.createLinearGradient(0, ay, 0, H);
    gr.addColorStop(0, '#8a6a1c'); gr.addColorStop(1, '#2a1f07');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - aw / 2, ay, aw, 12);
    ctx.fillRect(cx - aw * 0.38, ay + 12, aw * 0.76, 12);
    ctx.fillRect(cx - aw * 0.26, ay + 24, aw * 0.52, H - ay - 24);
    edge(ctx, cx, ay, aw, od ? '#ffffff' : '#ffe066', 18);
  },
};

/* ---------- strikers: what hits the blank ---------- */

/* ---------- strikers: detailed machines that drop onto the blade ---------- */

const bob = (g, ms, amp) => g.reduced ? 0 : Math.sin(g.clock / ms) * amp;
function chrome(ctx, x0, x1) {
  const gr = ctx.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, '#2a3246'); gr.addColorStop(0.35, '#eef4ff'); gr.addColorStop(0.6, '#8995ad'); gr.addColorStop(1, '#1c2232');
  return gr;
}
function steel(ctx, x, y, w, h, light, dark) {
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, light); gr.addColorStop(0.55, dark); gr.addColorStop(1, '#0b0f18');
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff2a'; ctx.fillRect(x, y, w, 2);                              // top bevel catches the light
  ctx.strokeStyle = '#05070c'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
}
function rivets(ctx, x, y, w, h) {
  ctx.fillStyle = '#c9d3e6';
  for (const [px, py] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) { ctx.beginPath(); ctx.arc(px, py, 1.6, 0, TAU); ctx.fill(); }
}
function hazard(ctx, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#111';
  for (let i = -h; i < w; i += 10) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + 5, y + h); ctx.lineTo(x + i + 5 + h, y); ctx.lineTo(x + i + h, y); ctx.fill(); }
  ctx.restore();
}
function glowBar(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillRect(x, y, w, h); ctx.shadowBlur = 0; }

const STRIKER = {
  neo(ctx, g, ph) {                                                        // pneumatic cyber-hammer: chrome rod, hazard band, neon face
    const {cx, wy, level, od, hue} = g, rest = -18, hit = wy - 50;
    const y = ph === null ? rest + bob(g, 400, 2) : rest + (hit - rest) * ph;
    const hw = level >= 5 ? 84 : 70, c = od ? '#ffcc33' : level >= 5 ? '#ff3366' : hue;
    ctx.fillStyle = chrome(ctx, cx - 6, cx + 6); ctx.fillRect(cx - 6, -10, 12, y + 4);
    steel(ctx, cx - 14, y - 8, 28, 12, '#55617a', '#232b42');
    steel(ctx, cx - hw / 2, y + 4, hw, 26, '#7a879f', '#262f47'); rivets(ctx, cx - hw / 2, y + 4, hw, 26);
    hazard(ctx, cx - hw / 2 + 9, y + 10, hw - 18, 7);
    glowBar(ctx, cx - hw / 2, y + 30, hw, 4, c);
    steel(ctx, cx - hw / 2 + 6, y + 34, hw - 12, 8, '#b5c0d4', '#3a4458');
  },
  abyss(ctx, g, ph) {                                                      // gravity monolith: obsidian wedge with a rune crack and orbiting shards
    const {cx, wy, od, t} = g, rest = -30, hit = wy - 86, c = od ? '#ffcc33' : '#c99bff';
    const y = ph === null ? rest + bob(g, 500, 4) : rest + (hit - rest) * ph;
    ctx.fillStyle = '#b06bff1f'; ctx.beginPath(); ctx.ellipse(cx, y + 40, 42, 54, 0, 0, TAU); ctx.fill();
    const gr = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0);
    gr.addColorStop(0, '#0b0614'); gr.addColorStop(0.45, '#2b1a48'); gr.addColorStop(1, '#07040d');
    ctx.fillStyle = gr; ctx.beginPath();
    ctx.moveTo(cx - 16, y); ctx.lineTo(cx + 16, y); ctx.lineTo(cx + 22, y + 58); ctx.lineTo(cx, y + 78); ctx.lineTo(cx - 22, y + 58); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4b2d80'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, y + 8); ctx.lineTo(cx - 6, y + 24); ctx.lineTo(cx + 4, y + 34); ctx.lineTo(cx - 3, y + 52); ctx.lineTo(cx, y + 70);
    ctx.moveTo(cx - 6, y + 24); ctx.lineTo(cx - 14, y + 31); ctx.moveTo(cx + 4, y + 34); ctx.lineTo(cx + 13, y + 41); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#3b2266';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.4 + i * TAU / 3, sx = cx + Math.cos(a) * 32, sy = y + 36 + Math.sin(a) * 10;
      ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 4, sy); ctx.fill();
    }
  },
  titan(ctx, g, ph) {                                                      // twin titanium hydraulic press on a riveted crossbeam
    const {cx, wy, od} = g, rest = -14, hit = wy - 50, c = od ? '#ffcc33' : '#ff7a1a';
    const y = ph === null ? rest : rest + (hit - rest) * ph;
    steel(ctx, cx - 64, -6, 128, 14, '#8f7a68', '#2e2018'); rivets(ctx, cx - 64, -6, 128, 14);
    for (const dx of [-30, 30]) {
      ctx.fillStyle = chrome(ctx, cx + dx - 5, cx + dx + 5); ctx.fillRect(cx + dx - 5, 8, 10, y);
      steel(ctx, cx + dx - 24, y + 6, 48, 28, '#a08a76', '#3a2a20'); rivets(ctx, cx + dx - 24, y + 6, 48, 28);
      ctx.fillStyle = '#000a'; ctx.fillRect(cx + dx - 15, y + 15, 30, 3); ctx.fillRect(cx + dx - 15, y + 22, 30, 3);
      glowBar(ctx, cx + dx - 24, y + 34, 48, 5, c);
    }
  },
  quantum(ctx, g, ph) {                                                    // ceiling emitter: hex housing, spinning rings, laser on the strike
    const {cx, wy, clock, od, t} = g, c = od ? '#ffcc33' : '#ff3366', top = 16;
    ctx.fillStyle = '#1b1030'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(cx + Math.cos(a) * 22, top + Math.sin(a) * 12); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#5b3a8a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4 + k); ctx.beginPath(); ctx.ellipse(cx, top + 12 + k * 5, 16 + k * 6, 3 + k * 1.5, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(cx, top + 4, 4 + Math.sin(clock / 150), 0, TAU); ctx.fill();
    const len = wy - top - 14;
    if (ph !== null) {
      ctx.globalAlpha = 0.35 + 0.65 * ph; ctx.lineWidth = 4 + ph * 10; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(cx, top + 10); ctx.lineTo(cx, wy - 6); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const yy = top + 14 + ((clock / 2 + i * len / 3) % len); ctx.beginPath(); ctx.ellipse(cx, yy, 8 + ph * 8, 2.5, 0, 0, TAU); ctx.stroke(); }
    } else { ctx.globalAlpha = 0.28; ctx.lineWidth = 1; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(cx, top + 10); ctx.lineTo(cx, wy - 6); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  },
  astral(ctx, g, ph) {                                                     // solar lens: twin golden rings, turning rays, a beam from the sky
    const {cx, wy, clock, od, t} = g;
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(cx, 14, 32, 8, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, 14, 24, 5, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff6c84d'; ctx.fill();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) { const a = t * 0.6 + i * TAU / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 34, 14 + Math.sin(a) * 9); ctx.lineTo(cx + Math.cos(a) * 44, 14 + Math.sin(a) * 12); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (ph !== null) {
      const w = 6 + ph * 18, beam = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
      beam.addColorStop(0, 'transparent'); beam.addColorStop(0.5, od ? '#ffffff' : '#fff6c8'); beam.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.3 + 0.7 * ph; ctx.fillStyle = beam; ctx.fillRect(cx - w, 20, w * 2, wy - 20); ctx.globalAlpha = 1;
    } else { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(clock / 300); ctx.fillStyle = '#ffe066'; ctx.fillRect(cx - 2, 20, 4, wy - 30); ctx.globalAlpha = 1; }
    ctx.shadowBlur = 0;
  },
};

/* ---------- painted 2D backdrops (public/bg) ---------- */

// x, y: the anvil face centre as a share of the picture; w: anvil face width share. Measured on the art itself.
const PHOTO = {
  neo:     {src: 'bg/neo.jpg', x: 0.498, y: 0.565, w: 0.25},
  abyss:   {src: 'bg/abyss.jpg', x: 0.494, y: 0.497, w: 0.27},
  titan:   {src: 'bg/titan.webp', x: 0.5, y: 0.54, w: 0.26},
  quantum: {src: 'bg/quantum.jpg', x: 0.5, y: 0.62, w: 0.19},
  astral:  {src: 'bg/astral.jpg', x: 0.493, y: 0.622, w: 0.2},
  arena:   {src: 'bg/arena.jpg', x: 0.5, y: 0.73, w: 0.42},
};
const imgs = {};
// Absolute: the URL also lands in CSS custom properties, which would otherwise resolve against /assets/.
export const bgUrl = key => new URL((import.meta.env?.BASE_URL ?? './') + PHOTO[key].src, document.baseURI).href;
/** The picture once it is decoded; null before that (or when missing), so callers fall back to the procedural scene.
 *  Decoding off the main thread keeps the first strike in a new location from dropping frames. */
export function bgImage(key) {
  if (!PHOTO[key] || typeof Image === 'undefined') return null;
  let im = imgs[key];
  if (!im) {
    im = imgs[key] = new Image(); im.decoding = 'async'; im.src = bgUrl(key);
    if (im.decode) im.decode().then(() => { im.ready = true; }, () => {});
  }
  return (im.decode ? im.ready : im.complete) && im.naturalWidth ? im : null;
}
/** Start fetching and decoding every backdrop at boot. */
export const preloadBackdrops = () => Object.keys(PHOTO).forEach(bgImage);
/** Cover-crop without distortion; the anvil lands at (W/2, H·focusY) as far as the crop allows. */
export function photoLayout(key, W, H, focusY = 0.7) {
  const im = bgImage(key);
  if (!im || !W || !H) return null;
  const p = PHOTO[key], k = Math.max(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
  const fit = (v, lo) => Math.min(0, Math.max(lo, v));
  const dx = fit(W / 2 - p.x * dw, W - dw), dy = fit(H * focusY - p.y * dh, H - dh);
  return {im, dx, dy, dw, dh, ax: dx + p.x * dw, ay: dy + p.y * dh, aw: p.w * dw};
}

const alpha = (c, a) => c + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
/** The picture plus a breathing layer: anvil glow, drifting motes, per-location flicker and a vignette. */
export function drawPhotoScene(ctx, loc, g, L) {
  const {W, H, t, reduced, cx, ay} = g, fx = fxOf(loc), c = fx.sparks[0];
  ctx.drawImage(L.im, L.dx, L.dy, L.dw, L.dh);
  const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.2);
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(cx, ay, 2, cx, ay, L.aw * 0.9);
  gl.addColorStop(0, alpha(c, 0.22 + 0.16 * pulse)); gl.addColorStop(1, alpha(c, 0));
  ctx.fillStyle = gl; ctx.fillRect(cx - L.aw, ay - L.aw, L.aw * 2, L.aw * 2);
  if (!reduced) {
    const rise = loc === 'titan' || loc === 'astral' || loc === 'abyss';
    for (let i = 0; i < 26; i++) {
      const sp = 0.25 + rnd(i + 9) * 0.6, cyc = (t * sp * 0.25 + rnd(i + 3)) % 1;
      const x = rnd(i) * W + Math.sin(t * 0.7 + i) * 14, y = rise ? H + 6 - cyc * (H + 12) : -6 + cyc * (H + 12);
      ctx.globalAlpha = 0.35 + 0.5 * Math.sin(cyc * Math.PI); ctx.fillStyle = fx.sparks[i % fx.sparks.length];
      ctx.fillRect(x, y, 1.6 + rnd(i + 5) * 1.6, 1.6 + rnd(i + 5) * 1.6);
    }
    const tick = Math.floor(t * 6);
    if (loc === 'neo' && rnd(tick) > 0.9) { ctx.globalAlpha = 0.07; ctx.fillStyle = '#00f0ff'; ctx.fillRect(0, 0, W, H); }      // neon tube flicker
    if (loc === 'abyss' && rnd(tick + 1) > 0.95) { ctx.globalAlpha = 0.1; ctx.fillStyle = '#b06bff'; ctx.fillRect(0, 0, W, H); } // far lightning
    if (loc === 'quantum') { const sy = (t * 60) % H; ctx.globalAlpha = 0.18; ctx.fillStyle = '#00f0ff'; ctx.fillRect(0, sy, W, 1.5); }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  still(ctx, 'vignette', W, H, v => {
    const r = v.createRadialGradient(W / 2, H * 0.6, Math.min(W, H) * 0.35, W / 2, H * 0.6, Math.max(W, H) * 0.75);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.7)');
    v.fillStyle = r; v.fillRect(0, 0, W, H);
  });
}

export const drawBackdrop = (ctx, loc, g) => (BACK[loc] ?? BACK.neo)(ctx, g);
export const drawAnvilFor = (ctx, loc, g) => (ANVIL[loc] ?? ANVIL.neo)(ctx, g);
export const drawStriker = (ctx, loc, g, ph) => (STRIKER[loc] ?? STRIKER.neo)(ctx, g, ph);

/** Location-specific flourish on the moment of contact. */
export function impactExtra(loc, spray, s, {cx, wy}) {
  if (loc === 'titan') spray(cx, wy - 18, 18, ['#e6edf6', '#9aa7bd'], {up: true, speed: 3});   // steam vents from the press
  if (loc === 'abyss') s.flash = 1;                                                                // a violet lightning crack
  if (loc === 'quantum') s.glitch = 1;
  if (loc === 'astral') s.flash = 0.7;
}

/** After-effects drawn on top: lightning (abyss), sun flare (astral), glitch slices (quantum). */
export function drawOverlay(ctx, loc, g, s, canvas, dpr) {
  if (s.flash > 0.02) {
    if (loc === 'abyss') {
      ctx.strokeStyle = '#e3c8ff'; ctx.lineWidth = 2; ctx.globalAlpha = s.flash; ctx.shadowColor = '#b06bff'; ctx.shadowBlur = 16;
      let x = g.cx + (rnd(Math.floor(g.clock / 90)) - 0.5) * g.W * 0.6, y = 0;
      ctx.beginPath(); ctx.moveTo(x, y);
      while (y < g.wy) { y += 14; x += (rnd(y + Math.floor(g.clock / 90)) - 0.5) * 24; ctx.lineTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    } else {
      ctx.globalAlpha = s.flash * 0.45; ctx.fillStyle = loc === 'astral' ? '#fff6c8' : '#ffffff'; ctx.fillRect(0, 0, g.W, g.H);
    }
    ctx.globalAlpha = 1;
  }
  if (s.glitch > 0.05 && !g.reduced) {                     // RGB-split bars: no canvas self-copy (a GPU read-back stalls phones)
    const k = Math.floor(g.clock / 40);
    for (let i = 0; i < 4; i++) {
      const y = rnd(i + k) * g.H, h = 3 + rnd(i + 7) * 8, dx = (rnd(i + 3 + k) - 0.5) * 20 * s.glitch;
      ctx.globalAlpha = 0.35 * s.glitch; ctx.fillStyle = i % 2 ? '#00f0ff' : '#ff3366';
      ctx.fillRect(dx, y, g.W, h);
    }
    ctx.globalAlpha = 1;
  }
}

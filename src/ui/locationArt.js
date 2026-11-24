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
    const glow = ctx.createRadialGradient(cx, ay - 20, 10, cx, ay - 20, W * 0.6);
    glow.addColorStop(0, '#b06bff33'); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
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
    const planet = ctx.createRadialGradient(W * 0.1, H * 1.6, H * 0.6, W * 0.1, H * 1.6, H * 1.25);
    planet.addColorStop(0, '#2a1050'); planet.addColorStop(0.92, '#ff336655'); planet.addColorStop(1, 'transparent');
    ctx.fillStyle = planet; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ff336622'; ctx.lineWidth = 1;
    for (let x = (t * 12) % 24; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, ay + 14); ctx.lineTo(g.cx + (x - g.cx) * 2.2, H); ctx.stroke(); }
  },
  astral(ctx, g) {                                                         // orbit of a star: sun glow, golden columns, star dust
    const {W, H, cx, ay, t} = g;
    const sun = ctx.createRadialGradient(cx, -H * 0.25, 6, cx, -H * 0.25, H * 1.1);
    sun.addColorStop(0, '#fff6c8'); sun.addColorStop(0.25, '#ffe06688'); sun.addColorStop(1, 'transparent');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    for (const x of [W * 0.1, W * 0.9]) {
      const col = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
      col.addColorStop(0, '#6b5212'); col.addColorStop(0.5, '#ffe066'); col.addColorStop(1, '#6b5212');
      ctx.fillStyle = col; ctx.fillRect(x - 9, 18, 18, ay - 4);
      ctx.fillRect(x - 14, 12, 28, 8); ctx.fillRect(x - 14, ay + 8, 28, 6);
    }
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

function slabHammer(ctx, cx, y, w, h, top, bottom, band) {
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  ctx.fillStyle = gr; ctx.fillRect(cx - w / 2, y, w, h);
  if (band) { ctx.fillStyle = band; ctx.shadowColor = band; ctx.shadowBlur = 10; ctx.fillRect(cx - w / 2, y + h - 4, w, 4); ctx.shadowBlur = 0; }
}

const STRIKER = {
  neo(ctx, g, ph) {                                                        // pneumatic hammer with hazard stripes
    const {cx, wy, level, od, hue, clock, reduced} = g, rest = -20, hit = wy - 44;
    const y = ph === null ? rest + (reduced ? 0 : Math.sin(clock / 400) * 2) : rest + (hit - rest) * ph;
    ctx.fillStyle = '#2a3350'; ctx.fillRect(cx - 5, -10, 10, y + 10);
    const hw = level >= 5 ? 76 : 64;
    slabHammer(ctx, cx, y, hw, 30, '#6b7a96', '#232b42', null);
    if (level === 1) { ctx.fillStyle = '#ffcc33'; for (let x = -hw / 2 + 4; x < hw / 2 - 6; x += 14) ctx.fillRect(cx + x, y + 24, 7, 4); }
    else { const c = od ? '#ffcc33' : level >= 5 ? '#ff3366' : hue; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.fillRect(cx - hw / 2, y + 26, hw, 4); ctx.shadowBlur = 0; }
  },
  abyss(ctx, g, ph) {                                                      // a dark monolith falls onto the slab
    const {cx, wy, clock, reduced, od} = g, rest = -24, hit = wy - 78;
    const y = ph === null ? rest + (reduced ? 0 : Math.sin(clock / 500) * 3) : rest + (hit - rest) * ph;
    ctx.fillStyle = '#120a20'; ctx.fillRect(cx - 18, y, 36, 70);
    ctx.strokeStyle = '#3b2266'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 18, y, 36, 70);
    const c = od ? '#ffcc33' : '#c99bff';
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 16; ctx.fillRect(cx - 2, y + 10, 4, 50); ctx.shadowBlur = 0;
  },
  titan(ctx, g, ph) {                                                      // twin titanium press
    const {cx, wy, od} = g, rest = -12, hit = wy - 44, y = ph === null ? rest : rest + (hit - rest) * ph;
    for (const dx of [-30, 30]) {
      ctx.fillStyle = '#3a2a20'; ctx.fillRect(cx + dx - 4, -10, 8, y + 10);
      slabHammer(ctx, cx + dx, y, 44, 30, '#8f7a68', '#2e2018', od ? '#ffcc33' : '#ff7a1a');
    }
  },
  quantum(ctx, g, ph) {                                                    // emitter + a gravity beam that pulses on the strike
    const {cx, wy, clock, od} = g, c = od ? '#ffcc33' : '#ff3366';
    ctx.fillStyle = '#1b1030'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(cx + Math.cos(a) * 16, 12 + Math.sin(a) * 9); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(cx, 14, 4 + Math.sin(clock / 150), 0, TAU); ctx.fill();
    if (ph !== null) {
      ctx.globalAlpha = 0.35 + 0.65 * ph; ctx.lineWidth = 3 + ph * 6; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, wy - 8); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, wy - 8); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
  },
  astral(ctx, g, ph) {                                                     // a solar lens focuses a beam from the sky
    const {cx, wy, clock, od} = g;
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(cx, 14, 30, 7, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff6c855'; ctx.fill();
    if (ph !== null) {
      const w = 6 + ph * 18, beam = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
      beam.addColorStop(0, 'transparent'); beam.addColorStop(0.5, od ? '#ffffff' : '#fff6c8'); beam.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.3 + 0.7 * ph; ctx.fillStyle = beam; ctx.fillRect(cx - w, 20, w * 2, wy - 20); ctx.globalAlpha = 1;
    } else { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(clock / 300); ctx.fillStyle = '#ffe066'; ctx.fillRect(cx - 2, 20, 4, wy - 30); ctx.globalAlpha = 1; }
    ctx.shadowBlur = 0;
  },
};

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
  if (s.glitch > 0.05 && !g.reduced) {
    for (let i = 0; i < 4; i++) {
      const y = rnd(i + Math.floor(g.clock / 40)) * g.H, h = 4 + rnd(i + 7) * 10, dx = (rnd(i + 3 + Math.floor(g.clock / 40)) - 0.5) * 18 * s.glitch;
      ctx.drawImage(canvas, 0, y * dpr, g.W * dpr, h * dpr, dx, y, g.W, h);
    }
  }
}

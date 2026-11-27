// The forge scene above the slots: hammer strikes, sparks that bounce off the anvil, hit-stop, rarity effects
// and 5 evolution levels driven by the total upgrade level. One canvas, one requestAnimationFrame loop.
import {drawWeapon} from './weaponArt.js';
import {fxOf, drawBackdrop, drawAnvilFor, drawStriker, impactExtra, drawOverlay, photoLayout, drawPhotoScene} from './locationArt.js';

export const STAGE_LEVELS = [0, 5, 12, 21, 32];          // total upgrade levels where the forge evolves
export const stageLevel = sum => STAGE_LEVELS.reduce((lvl, min, i) => (sum >= min ? i + 1 : lvl), 1);
export const inZone = (pos, zone) => pos >= zone.from && pos <= zone.from + zone.width;

const STRIKE_MS = 260, IMPACT_AT = 0.6;
export const IMPACT_DELAY = STRIKE_MS * IMPACT_AT;      // ms from strike start to anvil contact

export function createForgeStage(canvas, {onImpact} = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, running = false, last = 0, clock = 0, dpr = 1, ro = null;
  const s = {level: 1, hue: '#00f0ff', loc: 'neo', combo: 0, od: false, auto: 0, art: null, heat: 0, shake: 0, freezeUntil: 0,
             strikes: [], sparks: [], waves: [], pillar: null, cocoon: null, ring: 0, impacts: 0, fx: {}, flash: 0, glitch: 0,
             bump: -1e9, poke: -1e9, slowUntil: 0, rate: 1, artClock: 0};
  // One damped spring drives both halves of a hammer blow: the anvil dips, the weapon hops. Full swing at
  // contact, two overshoots, settled inside ~450 ms.
  const SPRING_MS = 300;
  const springAt = age => (age < 0 || age > 900 ? 0 : Math.exp(-age / 150) * Math.cos(Math.PI * 2 * age / SPRING_MS));
  const anvilDip = () => springAt(clock - s.bump) * 5;
  const weaponHop = () => springAt(clock - s.bump) * 7;
  const count = k => { s.fx[k] = (s.fx[k] || 0) + 1; };

  function resize() {
    const r = canvas.getBoundingClientRect(), d = dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  const geo = () => {
    const L = s.photo;                                    // painted backdrop: the weapon lies on the anvil of the picture
    if (L) return {cx: L.ax, ay: L.ay, aw: L.aw, wy: L.ay - 8, ws: Math.min(W * 0.56, 230)};
    const cx = W / 2, ay = H - 40, aw = Math.min(W * 0.5, 240);
    return {cx, ay, aw, wy: ay - 22, ws: Math.min(W * 0.58, 230)};
  };
  const sparkColors = () => s.od ? ['#ffcc33', '#fff3b0', '#ffffff'] : fxOf(s.loc).sparks;

  function spray(x, y, n, colors, {up = false, speed = 7} = {}) {
    if (reduced) n = Math.min(n, 8);
    for (let i = 0; i < n && s.sparks.length < 260; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.8 : -Math.PI * Math.random();
      const v = speed * (0.4 + Math.random());
      s.sparks.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 40 + Math.random() * 40, c: colors[i % colors.length]});
    }
  }

  function impact(st) {
    const {cx, wy} = geo();
    s.heat = 1; s.impacts++; s.bump = clock;
    if (!reduced) { s.shake = 3 + 2 * st.power; if (st.hitstop) s.freezeUntil = performance.now() + 55; }
    spray(st.drone ? cx + 18 : cx, wy - 6, 14 + 10 * st.power, sparkColors());
    if (!reduced) impactExtra(s.loc, spray, s, {cx, wy});
    onImpact?.(st.power);
  }

  function update(dt) {
    const f = dt / 16.7, {cx, ay, aw} = geo();
    // The scenery runs on its own warped clock: fans, wire pulses, furnace fire and rain all speed up with the
    // combo (and again in OVERDRIVE). Accumulating instead of scaling `clock` keeps every loop continuous,
    // so changing combo never makes an animation jump.
    s.artClock += dt * (1 + s.combo * 0.9 + (s.od ? 0.6 : 0));
    s.heat = Math.max(0, s.heat - dt / 800);                            // 0.8 s from white hot back to the element colour
    s.shake *= Math.pow(0.82, f);
    s.flash *= Math.pow(0.86, f); s.glitch *= Math.pow(0.88, f);
    if (!reduced) s.ring += (0.012 + s.combo * 0.1) * f;
    for (const st of s.strikes) if (!st.hit && clock >= st.t0 + st.dur * IMPACT_AT) { st.hit = true; impact(st); }
    s.strikes = s.strikes.filter(st => clock < st.t0 + st.dur);
    for (const p of s.sparks) {
      p.vy += 0.38 * f; p.x += p.vx * f; p.y += p.vy * f; p.life -= f;
      if (p.vy > 0 && p.y > ay && p.y < ay + 14 && Math.abs(p.x - cx) < aw / 2) { p.y = ay; p.vy *= -0.42; p.vx *= 0.75; }  // bounce off the anvil face
    }
    s.sparks = s.sparks.filter(p => p.life > 0 && p.y < H + 10);
    for (const w of s.waves) { w.r += 5 * f; w.life -= 0.03 * f; }
    s.waves = s.waves.filter(w => w.life > 0);
    if (s.pillar && (s.pillar.life -= dt / 900) <= 0) s.pillar = null;
  }

  /* ---------- drawing ---------- */

  function strikePhase(drone) {
    const st = s.strikes.find(x => !!x.drone === drone && clock >= x.t0);
    if (!st) return null;
    const p = (clock - st.t0) / st.dur;
    return p < IMPACT_AT ? (p / IMPACT_AT) ** 2 : 1 - (1 - (1 - (p - IMPACT_AT) / (1 - IMPACT_AT)) ** 2);   // accelerate down, ease back up
  }

  function drawGrid(t) {
    ctx.strokeStyle = s.hue + '14'; ctx.lineWidth = 1;
    for (let y = 8; y < H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const sy = (t * 70) % H;
    ctx.strokeStyle = s.hue + '55'; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }

  function drawRing(cx, cy, ws, half) {
    const rx = ws * 0.62, ry = 14;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.strokeStyle = s.od ? '#ffcc33' : s.hue;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
    for (let i = 0; i < 24; i++) {
      const a = s.ring + i * Math.PI / 12, front = Math.sin(a + 0.08) >= 0;
      if ((half === 'front') !== front) continue;
      ctx.globalAlpha = front ? 0.9 : 0.35;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, a, a + 0.16); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function drawEmitters(cx, ay, aw, wy, ws, t) {
    for (const side of [-1, 1]) {
      const ex = cx + side * (aw / 2 + 24), ey = ay - 36;
      ctx.fillStyle = '#1b2440'; ctx.fillRect(ex - 7, ey - 11, 14, 22);
      ctx.fillStyle = s.hue; ctx.fillRect(ex - 3, ey - 3, 6, 6);
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 13 + side);
      ctx.strokeStyle = s.hue; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(cx + side * ws * 0.28, wy); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Holographic call-outs in the top corners with leader lines to the blade: state on the left, power on the right.
  function drawCallouts(cx, wy, ws) {
    if (W < 260 || s.cocoon) return;
    const left = s.heat > 0.15 ? '[ РАСКАЛЁННАЯ СТАЛЬ ]' : `[ ${s.art.el.n.toUpperCase()} · ${s.art.wp.n.toUpperCase()} ]`;
    const right = Number.isFinite(s.art.power) ? `[ МОЩЬ: ${Math.round(s.art.power).toLocaleString('ru-RU')} ]` : null;
    const c = s.od ? '#ffcc33' : s.hue;
    ctx.save();
    ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
    ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.shadowColor = c; ctx.shadowBlur = 6;
    const tag = (text, x, align, tx) => {
      const w = ctx.measureText(text).width, x0 = align === 'left' ? x : x - w;
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#05070c'; ctx.fillRect(x0 - 4, 14, w + 8, 16);
      ctx.globalAlpha = 0.95; ctx.fillStyle = c; ctx.textAlign = align; ctx.fillText(text, x, 22);
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(align === 'left' ? x0 + w / 2 : x0 + w / 2, 30); ctx.lineTo(tx, wy - 10); ctx.lineTo(tx, wy - 4); ctx.stroke();
    };
    tag(left, 14, 'left', cx - ws * 0.3);
    if (right) tag(right, W - 14, 'right', cx + ws * 0.3);
    ctx.restore();
  }

  function drawIngot(cx, wy, t) {
    const w = 120, g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    const pulse = 0.75 + 0.25 * Math.sin(t * 8);
    g.addColorStop(0, '#ff5a1a'); g.addColorStop(0.5, `rgba(255,230,150,${pulse})`); g.addColorStop(1, '#ff5a1a');
    ctx.fillStyle = g; ctx.shadowColor = '#ff8a3c'; ctx.shadowBlur = 18;
    ctx.fillRect(cx - w / 2, wy - 7, w, 14);
    ctx.shadowBlur = 0;
  }

  function drawDrones(cx, wy, ws, t) {
    const ph = strikePhase(true);
    for (let k = 0; k < 2; k++) {
      let x = cx + Math.cos(t * 1.3 + k * Math.PI) * ws * 0.62, y = 34 + Math.sin(t * 2.6 + k) * 8;
      if (k === 0 && ph !== null) { x += (cx + 18 - x) * ph; y += (wy - 20 - y) * ph; }   // dive onto the blank
      ctx.strokeStyle = '#5b6a8a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.stroke();
      ctx.fillStyle = '#9aabc8aa';
      for (const dx of [-14, 14]) { ctx.beginPath(); ctx.ellipse(x + dx, y - 3, 7 * Math.abs(Math.sin(t * 40 + dx)) + 1, 2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1b2440'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.auto ? s.hue : '#5b6a8a'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSingularity(cx, t) {
    const cy = 30, c = s.od ? '#ffcc33' : s.hue;
    ctx.shadowColor = c; ctx.shadowBlur = 20; ctx.strokeStyle = c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, 46, 9, Math.sin(t) * 0.08, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    const crystals = [0, 1, 2, 3].map(i => [cx + Math.cos(t * 0.8 + i * Math.PI / 2) * 74, 40 + Math.sin(t * 1.6 + i) * 10]);
    for (const [x, y] of crystals) {
      ctx.fillStyle = c; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (Math.random() < (s.od ? 0.5 : 0.18)) {                           // arc discharge crystal → core
      const [x, y] = crystals[Math.floor(Math.random() * 4)];
      ctx.strokeStyle = s.od ? '#fff3b0' : '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 1; k <= 5; k++) ctx.lineTo(x + (cx - x) * k / 5 + (Math.random() - 0.5) * 10, y + (cy - y) * k / 5 + (Math.random() - 0.5) * 10);
      ctx.stroke();
    }
  }

  function draw() {
    s.photo = photoLayout(s.loc, W, H);
    const {cx, ay, aw, wy, ws} = geo(), t = reduced ? 0 : s.artClock / 1000;   // reduced motion: decor holds still, strikes still play
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (s.shake > 0.2) ctx.translate((Math.random() - 0.5) * s.shake * 2, (Math.random() - 0.5) * s.shake * 2);   // camera recoil
    const g = {W, H, cx, ay, aw, wy, ws, t, clock, reduced, hue: s.hue, od: s.od, level: s.level, combo: s.combo};
    if (s.photo) {
      ctx.fillStyle = '#000'; ctx.fillRect(-10, -10, W + 20, H + 20);   // shake edges
      drawPhotoScene(ctx, s.loc, g, s.photo);
      if (s.od) { ctx.fillStyle = '#ffcc3318'; ctx.fillRect(0, 0, W, H); }
    } else {
      const [top, bottom] = fxOf(s.loc).bg, bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, s.od ? '#2b1f05' : top); bg.addColorStop(1, bottom);
      ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
      drawBackdrop(ctx, s.loc, g);
      if (s.level >= 2 && (s.loc === 'neo' || s.loc === 'quantum')) drawGrid(t);
      if (s.level >= 5 && s.loc === 'neo') drawSingularity(cx, t);     // other locations have their own sky-borne striker
    }
    if (s.level >= 3) drawRing(cx, wy - 6, ws, 'back');
    if (!s.photo) {
      if (s.level >= 2) drawEmitters(cx, ay, aw, wy, ws, t);
      ctx.save(); ctx.translate(0, anvilDip()); drawAnvilFor(ctx, s.loc, g); ctx.restore();   // the anvil springs down under the blow
    }
    if (s.pillar) {
      const g = ctx.createLinearGradient(cx - 40, 0, cx + 40, 0);
      g.addColorStop(0, 'transparent'); g.addColorStop(0.5, s.pillar.color); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = s.pillar.life; ctx.fillStyle = g; ctx.fillRect(cx - 40, 0, 80, ay); ctx.globalAlpha = 1;
    }
    const shadow = ctx.createRadialGradient(cx, ay + 2, 2, cx, ay + 2, ws * 0.5);           // soft contact shadow on the anvil
    shadow.addColorStop(0, 'rgba(0,0,0,0.55)'); shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(cx, ay + 2); ctx.scale(1, 0.18); ctx.translate(-cx, -(ay + 2));
    ctx.fillStyle = shadow; ctx.fillRect(cx - ws * 0.5, ay + 2 - ws * 0.5, ws, ws); ctx.restore();
    const hop = wy - weaponHop(), pokeAge = clock - s.poke;                       // tapping the weapon sets it spinning
    const spin = pokeAge >= 0 && pokeAge < 650 && !reduced ? (1 - pokeAge / 650) ** 2 * Math.PI * 2 : 0;
    if (s.art) {
      if (spin) { ctx.save(); ctx.translate(cx, hop); ctx.rotate(spin); ctx.translate(-cx, -hop); }
      drawWeapon(ctx, s.art, cx, hop, ws, {t, heat: s.heat});
      if (spin) ctx.restore();
      drawCallouts(cx, hop, ws);
    } else drawIngot(cx, hop, t);
    if (s.cocoon) {
      ctx.strokeStyle = s.cocoon.color; ctx.lineWidth = 2; ctx.shadowColor = s.cocoon.color; ctx.shadowBlur = 16;
      ctx.fillStyle = s.cocoon.color + '22';
      ctx.beginPath(); ctx.ellipse(cx, wy, ws * 0.5, 30 + Math.sin(t * 9) * 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let i = 0; i < s.cocoon.cracks; i++) {                        // cracks spread with every strike
        ctx.beginPath(); ctx.moveTo(cx, wy);
        ctx.lineTo(cx + Math.cos(i * 2.1) * ws * 0.45, wy + Math.sin(i * 2.1) * 26); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    if (s.level >= 3) drawRing(cx, wy - 6, ws, 'front');
    for (const w of s.waves) {
      ctx.globalAlpha = w.life; ctx.strokeStyle = w.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, ay, w.r * 2.2, w.r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawStriker(ctx, s.loc, g, strikePhase(false));
    if (s.level >= 4) drawDrones(cx, wy, ws, t);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const p of s.sparks) {
      ctx.globalAlpha = Math.min(1, p.life / 25); ctx.strokeStyle = p.c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    drawOverlay(ctx, s.loc, g, s, canvas, dpr);
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    if (!canvas.isConnected) { running = false; return; }
    const real = (now - last) * (now < s.slowUntil ? s.rate : 1); last = now;
    // Strikes run on real time so the hammer lands with the slots even on slow first frames; physics steps stay capped.
    if (now >= s.freezeUntil) { clock += real; update(Math.min(50, real)); }   // hit-stop: the world holds still for a beat
    draw();
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame);
      ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;   // the desktop stage is a flexible grid row
      ro?.observe(canvas);
    },
    stop() { running = false; cancelAnimationFrame(raf); ro?.disconnect(); ro = null; },
    resize,
    setScene(o) { Object.assign(s, o); },
    setArtifact(art) { s.art = art; },
    strike({delay = 0, power = 1, hitstop = false, drone = false} = {}) {
      drone = drone && s.level >= 4;
      s.strikes.push({t0: clock + delay, dur: drone ? STRIKE_MS * 1.5 : STRIKE_MS, power, hitstop, drone, hit: false});
      if (s.cocoon) s.cocoon.cracks++;
    },
    shockwave(color) { count('wave'); s.waves.push({r: 10, life: 1, color}); },
    pillar(color) { count('pillar'); s.pillar = {color, life: 1}; },
    cocoon(color) { count('cocoon'); s.cocoon = {color, cracks: 0}; },
    shatter(color) {                                                       // the cocoon breaks, fireworks fly
      count('shatter');
      const {cx, wy} = geo();
      s.cocoon = null;
      spray(cx, wy, 70, [color, '#ffffff'], {speed: 9});
      spray(cx, wy - 10, 110, [color, '#ffffff', '#ffcc33'], {up: true, speed: 12});
    },
    /** Micro slow-motion for the biggest reveals: the scene runs at `rate` for `ms` of real time. */
    slowmo(ms = 320, rate = 0.25) { count('slowmo'); s.slowUntil = performance.now() + ms; s.rate = rate; },
    /** Easter egg: the player tapped the weapon itself. It rings, spins and throws sparks. */
    poke() {
      count('poke');
      const {cx, wy} = geo();
      s.poke = clock; s.bump = clock; s.heat = Math.max(s.heat, 0.45);
      spray(cx, wy - 6, 26, s.art ? ['#ffffff', ...sparkColors()] : sparkColors(), {up: true, speed: 8});
      s.waves.push({r: 6, life: 0.7, color: s.od ? '#ffcc33' : s.hue});
    },
    quench(ok) {                                                           // tempering result: gold flash or grey puff
      count(ok ? 'quenchOk' : 'quenchFail');
      const {cx, wy} = geo();
      s.waves.push({r: 8, life: 1, color: ok ? '#ffcc33' : '#8b97ad'});
      spray(cx, wy, ok ? 50 : 14, ok ? ['#ffcc33', '#fff3b0', '#ffffff'] : ['#8b97ad', '#cfd8e6'], {up: true, speed: ok ? 9 : 4});
    },
    debug: () => ({level: s.level, impacts: s.impacts, sparks: s.sparks.length, running, fx: {...s.fx}}),
  };
}

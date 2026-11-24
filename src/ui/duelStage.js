// Arena clash over the painted arena (public/bg/arena.jpg; a procedural cyber-colosseum until it loads).
// The player's weapon (left) and the rival's (right) meet above the platform; the clash point slides toward
// whoever is losing, every tap is a lunge that shoves the rival's blade back, with sparks and a shock ring.
import {drawWeapon, elementStyle} from './weaponArt.js';
import {photoLayout} from './locationArt.js';

export function createDuelStage(canvas, mine, theirs) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let fit = null, W = 0, H = 0, raf = 0, running = false, last = 0, t = 0, target = 0.5, shown = 0.5, push = 0, shake = 0, cy = 0, sparks = [], rings = [], hits = 0;

  function resize() {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cy = H / 2;
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  const clashX = () => W * (0.28 + 0.44 * shown);                          // the clash never leaves 28%..72% of the scene

  function colosseum() {                                   // fallback: dark bowl, stands, two spotlights, laser ropes
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1036'); g.addColorStop(0.6, '#0b0a1c'); g.addColorStop(1, '#05040c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#2b2350'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(W / 2, H * 0.95, W * (0.4 + i * 0.12), H * (0.28 + i * 0.09), 0, Math.PI, 2 * Math.PI); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, c] of [[0.1, '#00f0ff22'], [0.9, '#ff336622']]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(W * x, 0); ctx.lineTo(W / 2 - 60, H); ctx.lineTo(W / 2 + 60, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const [y, c] of [[0.78, '#00f0ff'], [0.86, '#ff3366']]) { ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke(); }
    return H * 0.82;
  }

  function frame(now) {
    if (!running) return;
    if (!canvas.isConnected) { running = false; return; }
    const dt = Math.min(50, now - last), f = dt / 16.7;
    last = now; t += dt / 1000;
    shown += (target - shown) * Math.min(1, 0.12 * f);
    push *= Math.pow(0.82, f); shake *= Math.pow(0.8, f);
    for (const p of sparks) { p.vy += 0.3 * f; p.x += p.vx * f; p.y += p.vy * f; p.life -= f; }
    sparks = sparks.filter(p => p.life > 0);
    for (const r of rings) { r.r += 4 * f; r.life -= 0.05 * f; }
    rings = rings.filter(r => r.life > 0);

    ctx.save();
    if (shake > 0.3 && !reduced) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = '#000'; ctx.fillRect(-10, -10, W + 20, H + 20);
    const L = photoLayout('arena', W, H, 0.86);
    let floor;
    if (L) { ctx.drawImage(L.im, L.dx, L.dy, L.dw, L.dh); floor = L.ay; } else floor = colosseum();
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    cy = Math.min(floor - 34, H * 0.5);
    const cx = clashX(), base = Math.min(W * 0.5, 230), lunge = push * 10, bob = reduced ? 0 : Math.sin(t * 3) * 2;
    // Each blade reaches 0.85 of its size behind the clash: sized to the room left on its side, both stay fully on screen.
    const sizeMe = Math.min(base, (cx - 10) / 0.9), sizeOpp = Math.min(base, (W - cx - 10 - lunge) / 0.9);
    fit = {left: cx - 4 - sizeMe * 0.85, right: cx + 4 + lunge + sizeOpp * 0.85, W};
    ctx.save(); ctx.translate(cx - 4 + lunge * 0.4, cy + bob); ctx.rotate(-0.14 - push * 0.12);      // my blade drives forward
    drawWeapon(ctx, mine, -sizeMe * 0.35, 0, sizeMe, {t, heat: push * 0.7}); ctx.restore();
    ctx.save(); ctx.translate(cx + 4 + lunge, cy - bob); ctx.rotate(0.14 + push * 0.18);             // the rival's blade is shoved back
    drawWeapon(ctx, theirs, sizeOpp * 0.35, 0, sizeOpp, {t, flip: true}); ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30 + push * 30);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(0.4, elementStyle(mine.el.n).a + '88'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - 70, cy - 70, 140, 140);
    if (!reduced && Math.random() < 0.35) {                                // idle crackle where the blades grind
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) ctx.lineTo(cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 30);
      ctx.stroke();
    }
    for (const r of rings) { ctx.globalAlpha = r.life; ctx.strokeStyle = r.c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (const p of sparks) {
      ctx.globalAlpha = Math.min(1, p.life / 20); ctx.strokeStyle = p.c;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  return {
    start() { if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize,
    setRatio(r) { target = Math.min(1, Math.max(0, r)); },               // player share of the total power
    hit() {
      hits++; push = 1; shake = 5;
      const c = elementStyle(mine.el.n).a, n = reduced ? 3 : 14, x = clashX() + 10, y = cy;
      rings.push({x, y, r: 6, life: 1, c});
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.3) * 2.4, v = 3 + Math.random() * 7;
        sparks.push({x, y, vx: Math.cos(a) * v + 3, vy: Math.sin(a) * v, life: 25 + Math.random() * 20, c: i % 3 ? c : '#ffffff'});
      }
      if (sparks.length > 220) sparks.splice(0, sparks.length - 220);
    },
    debug: () => ({shown, hits, sparks: sparks.length, running, fit}),
  };
}

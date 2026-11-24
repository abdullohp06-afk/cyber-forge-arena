// Arena clash: the player's weapon (left) and the rival's (right) meet in the middle; the clash point slides
// toward whoever is losing, and every tap pushes with sparks.
import {drawWeapon, elementStyle} from './weaponArt.js';

export function createDuelStage(canvas, mine, theirs) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, running = false, last = 0, t = 0, target = 0.5, shown = 0.5, push = 0, sparks = [], hits = 0;

  function resize() {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  const clashX = () => W * (0.2 + 0.6 * shown);

  function frame(now) {
    if (!running) return;
    if (!canvas.isConnected) { running = false; return; }
    const dt = Math.min(50, now - last), f = dt / 16.7;
    last = now; t += dt / 1000;
    shown += (target - shown) * Math.min(1, 0.12 * f);
    push *= Math.pow(0.85, f);
    for (const p of sparks) { p.vy += 0.3 * f; p.x += p.vx * f; p.y += p.vy * f; p.life -= f; }
    sparks = sparks.filter(p => p.life > 0);

    const cx = clashX(), cy = H / 2, size = Math.min(W * 0.62, 240);
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(cx - 5 * push, cy); ctx.rotate(-0.14);
    drawWeapon(ctx, mine, -size * 0.43, 0, size, {t, heat: push * 0.7}); ctx.restore();
    ctx.save(); ctx.translate(cx + 5 * push, cy); ctx.rotate(0.14);
    drawWeapon(ctx, theirs, size * 0.43, 0, size, {t, flip: true}); ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28 + push * 22);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 60, cy - 60, 120, 120);
    ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (const p of sparks) {
      ctx.globalAlpha = Math.min(1, p.life / 20); ctx.strokeStyle = p.c;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  }

  return {
    start() { if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize,
    setRatio(r) { target = Math.min(1, Math.max(0, r)); },               // player share of the total power
    hit() {
      hits++; push = 1;
      const c = elementStyle(mine.el.n).a, n = reduced ? 3 : 12, x = clashX(), y = H / 2;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.3) * 2.4, v = 3 + Math.random() * 6;
        sparks.push({x, y, vx: Math.cos(a) * v + 2, vy: Math.sin(a) * v, life: 25 + Math.random() * 20, c: i % 3 ? c : '#ffffff'});
      }
    },
    debug: () => ({shown, hits, sparks: sparks.length, running}),
  };
}

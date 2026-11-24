// Canvas sparks, screen shake and haptics. All of it is skipped under prefers-reduced-motion.
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cv, cx, parts = [], running = false;

function fit() {
  const r = devicePixelRatio || 1;
  cv.width = innerWidth * r; cv.height = innerHeight * r;
  cx.setTransform(r, 0, 0, r, 0, 0);
}

export function initParticles(canvas) {
  cv = canvas; cx = cv.getContext('2d');
  fit(); addEventListener('resize', fit);
}

function loop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life-- > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.99; p.a += p.spin;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a);
    cx.globalAlpha = Math.min(1, p.life / 25); cx.fillStyle = p.c;
    cx.shadowColor = p.c; cx.shadowBlur = 8;
    cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    cx.restore();
  }
  if (parts.length) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
}

/** Burst of neon sparks from the centre of an element. */
export function burst(el, count, colors) {
  if (REDUCED || !cv || !el) return;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < Math.min(count, 260); i++) {
    const ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 10;
    parts.push({x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 4, life: 40 + Math.random() * 45,
                c: colors[i % colors.length], s: 4 + Math.random() * 7, a: Math.random() * 6, spin: (Math.random() - 0.5) * 0.4});
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export function shake(el, strong = false) {
  if (REDUCED || !el) return;
  el.classList.remove('shake', 'shake-hard'); void el.offsetWidth; el.classList.add(strong ? 'shake-hard' : 'shake');
}

export const vibrate = pattern => {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // browsers refuse (and log an error) before the first tap
    navigator.vibrate?.(pattern);
  } catch { /* not supported */ }
};

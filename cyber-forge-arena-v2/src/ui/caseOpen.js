// The container opening show: a full-screen armoured crate drops in, a laser burns the seam, three locks
// snap open, a pillar of light in the artifact's rarity colour bursts out and the cocoon cracks apart.
// One canvas, one requestAnimationFrame loop, always skippable. Resolves when the show is over.
const TAU = Math.PI * 2;

// Phase boundaries in ms. The whole show is 3.2 s; `skip` jumps straight past the end.
const DROP = 620, BURN = 1450, LOCKS = 2060, PILLAR = 2520, TOTAL = 3200;

/**
 * Plays the show over the page. `color` is the rarity colour of the artifact about to appear.
 * Returns a promise that resolves once the crate is open (or the player skipped).
 * Under prefers-reduced-motion it resolves at once without building anything.
 */
export function playCaseOpen({color = '#00f0ff', name = 'КОНТЕЙНЕР', onSpark} = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return Promise.resolve();

  const host = document.createElement('div');
  host.className = 'case-open';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-label', 'Открытие контейнера');
  host.innerHTML = `<canvas class="case-canvas" aria-hidden="true"></canvas>
    <div class="case-name"></div>
    <button class="btn ghost case-skip" type="button">Пропустить</button>`;
  host.querySelector('.case-name').textContent = name;                 // text, never HTML
  document.body.append(host);

  const canvas = host.querySelector('.case-canvas'), ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, t0 = 0, sparks = [], done = false, resolve;
  const out = new Promise(r => { resolve = r; });

  function resize() {
    const r = host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    host.classList.add('out');
    setTimeout(() => host.remove(), 260);
    resolve();
  }

  function spray(x, y, n, colors, speed = 7) {
    for (let i = 0; i < n && sparks.length < 240; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = speed * (0.4 + Math.random());
      sparks.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 30 + Math.random() * 30, c: colors[i % colors.length]});
    }
  }

  /** The crate body: bevelled steel plates, rivets and a hazard stripe along the lid. */
  function crate(cx, cy, w, h, split) {
    const half = h / 2;
    for (const [dir, label] of [[-1, 'lid'], [1, 'base']]) {
      const oy = cy + dir * split * half * 1.1;
      ctx.save();
      ctx.translate(cx, oy);
      ctx.beginPath();                                                 // chamfered corners, like the rest of the UI
      const b = 14, x0 = -w / 2, y0 = dir < 0 ? -half : 0, y1 = dir < 0 ? 0 : half;
      ctx.moveTo(x0 + b, y0); ctx.lineTo(w / 2 - b, y0); ctx.lineTo(w / 2, y0 + b * Math.sign(y1 - y0));
      ctx.lineTo(w / 2, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y0 + b * Math.sign(y1 - y0)); ctx.closePath();
      const g = ctx.createLinearGradient(x0, 0, w / 2, 0);
      g.addColorStop(0, '#1d2433'); g.addColorStop(0.3, '#495468'); g.addColorStop(0.5, '#5d6a80');
      g.addColorStop(0.72, '#3a4455'); g.addColorStop(1, '#171d28');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#0d1219'; ctx.lineWidth = 2; ctx.stroke();
      if (label === 'lid') {                                           // hazard stripes on the lid
        ctx.save(); ctx.clip();
        ctx.lineWidth = 7;
        for (let x = x0 - half; x < w / 2 + half; x += 18) {
          ctx.strokeStyle = (x / 18 | 0) % 2 ? '#15171c' : '#ffc41a66';
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + half, y1); ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = '#8c9ab3';                                       // rivets
      for (let i = 0; i < 6; i++) {
        const rx = x0 + 12 + i * (w - 24) / 5, ry = dir < 0 ? y0 + 10 : y1 - 10;
        ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  function draw(now) {
    const el = now - t0;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.52, w = Math.min(W * 0.62, 330), h = w * 0.58;

    // 1. the crate comes down from above and lands hard
    const dropP = Math.min(1, el / DROP);
    const drop = (1 - (1 - dropP) ** 3) * 1;
    const land = el > DROP && el < DROP + 240 ? Math.exp(-(el - DROP) / 80) * Math.sin((el - DROP) / 26) * 7 : 0;
    const y = cy - (1 - drop) * H * 0.75 + land;
    if (dropP >= 1 && el < DROP + 40) { spray(cx - w / 2, y + h / 2, 20, ['#8c9ab3', '#ffffff']); onSpark?.(); }

    // 4. the pillar of light erupts before the lid is fully clear
    const pil = el > PILLAR ? Math.min(1, (el - PILLAR) / 320) : 0;
    if (pil) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pw = 54 * pil, g = ctx.createLinearGradient(cx - pw, 0, cx + pw, 0);
      g.addColorStop(0, 'transparent'); g.addColorStop(0.5, color); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.85 * pil; ctx.fillStyle = g;
      ctx.fillRect(cx - pw, 0, pw * 2, y + h / 2);
      ctx.restore();
    }

    // the lid parts once the locks are off
    const split = el > LOCKS ? Math.min(1, (el - LOCKS) / 420) ** 2 : 0;
    crate(cx, y, w, h, split);

    // 2. the laser burns across the seam
    if (el > DROP && el < BURN + 120) {
      const p = Math.min(1, (el - DROP) / (BURN - DROP)), bx = cx - w / 2 + w * p;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff3b1a'; ctx.lineWidth = 3; ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(bx, y); ctx.stroke();        // the glowing cut left behind
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(bx, y, 5 + Math.random() * 2, 0, TAU); ctx.fill();
      ctx.restore();
      if (p < 1) spray(bx, y, 3, ['#ff7a1a', '#fff3b0', '#ffffff'], 5);
    } else if (el >= BURN + 120 && split < 1) {
      ctx.strokeStyle = '#ff5a1a88'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
    }

    // 3. three locks snap open, one after another
    for (let i = 0; i < 3; i++) {
      const at = BURN + i * ((LOCKS - BURN) / 3), open = el > at ? Math.min(1, (el - at) / 180) : 0;
      const lx = cx - w / 2 + (i + 1) * w / 4, ly = y + open * 26 + split * h * 0.5;
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(open * 1.1);
      ctx.fillStyle = open >= 1 ? '#4ade80' : '#ffc41a';
      ctx.strokeStyle = '#0d1219'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-9, -7, 18, 14, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#0d1219'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -7, 5, Math.PI, TAU - open * 1.6); ctx.stroke();        // the shackle swings out
      ctx.restore();
      if (open > 0 && open < 0.25) { spray(lx, ly, 8, ['#ffc41a', '#ffffff'], 5); onSpark?.(); }
    }

    // 5. the cocoon over the opening cracks and bursts
    if (el > PILLAR + 160) {
      const p = Math.min(1, (el - PILLAR - 160) / (TOTAL - PILLAR - 160));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color; ctx.lineWidth = 2 + 2 * (1 - p); ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.globalAlpha = 1 - p * 0.7;
      ctx.beginPath(); ctx.ellipse(cx, y, w * 0.3 * (1 + p * 0.9), h * 0.42 * (1 + p * 0.9), 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 7; i++) {                                                      // cracks spread out of the centre
        const a = i * TAU / 7 + p, r = (0.3 + p * 0.8) * w * 0.3;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r * 0.6); ctx.stroke();
      }
      ctx.restore();
      if (el > TOTAL - 420 && !sparks.burst) { sparks.burst = true; spray(cx, y, 90, [color, '#ffffff', '#ffc41a'], 11); onSpark?.(); }
    }

    // sparks on top of everything
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (const p of sparks) {
      p.vy += 0.34; p.x += p.vx; p.y += p.vy; p.life--;
      ctx.globalAlpha = Math.min(1, p.life / 25); ctx.strokeStyle = p.c;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
    }
    ctx.restore();
    sparks = sparks.filter(p => p.life > 0 && p.y < H + 20);

    if (el >= TOTAL) { finish(); return; }
    raf = requestAnimationFrame(draw);
  }

  host.querySelector('.case-skip').addEventListener('click', finish);
  addEventListener('resize', resize);
  resize();
  t0 = performance.now();
  raf = requestAnimationFrame(draw);
  return out;
}

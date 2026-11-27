// Гиро-Реактор wheel on a canvas. Every segment is drawn to the scale of its real odds; the pointer sits on top.
import {GYRO} from '../config/gameData.js';

const TAU = Math.PI * 2;
const easeOut = t => 1 - (1 - t) ** 4;   // fast start, long smooth braking

/** Arcs of GYRO.wheel in wheel radians, measured clockwise from the top. */
export function segmentArcs(wheel = GYRO.wheel) {
  const total = wheel.reduce((t, x) => t + x.w, 0);
  let a = 0;
  return wheel.map(x => { const from = a; a += x.w / total * TAU; return {from, to: a}; });
}

/** Rotation that puts wheel angle `phi` under the top pointer, at least `turns` full turns after `from`. */
export function rotationFor(phi, from, turns) {
  const want = ((-phi % TAU) + TAU) % TAU, cur = ((from % TAU) + TAU) % TAU;
  return from + turns * TAU + ((want - cur + TAU) % TAU);
}

const JACKPOT = GYRO.wheel.findIndex(x => x.s === GYRO.sectors.length - 1);
/** Segment right next to the top prize: the wheel stops at its very edge, the result itself is unchanged. */
export const nearJackpot = i => i === (JACKPOT + 1) % GYRO.wheel.length || i === (JACKPOT - 1 + GYRO.wheel.length) % GYRO.wheel.length;
const OVERSHOOT = 0.09;                  // rad the wheel rolls past the stop before it settles back

export function createGyroWheel(canvas, {onTick = () => {}} = {}) {
  const cx = canvas.getContext('2d'), arcs = segmentArcs();
  let rot = 0, hi = -1, raf = 0, anim = null, size = 0, kick = 0, idle = 0;

  const under = () => {                                   // segment under the pointer for the current rotation
    const phi = ((-rot % TAU) + TAU) % TAU;
    return arcs.findIndex(a => phi >= a.from && phi < a.to);
  };

  function fit() {
    const r = devicePixelRatio || 1;
    size = canvas.clientWidth || 104;
    canvas.width = canvas.height = Math.round(size * r);
    cx.setTransform(r, 0, 0, r, 0, 0);
    draw();
  }

  function draw() {
    const c = size / 2, R = c - 7;
    cx.clearRect(0, 0, size, size);
    cx.save(); cx.translate(c, c + 3);
    cx.shadowColor = '#00f0ff'; cx.shadowBlur = 12;          // neon rim
    cx.beginPath(); cx.arc(0, 0, R + 2, 0, TAU); cx.strokeStyle = '#00f0ff88'; cx.lineWidth = 2; cx.stroke();
    cx.shadowBlur = 0;
    cx.rotate(rot);
    arcs.forEach((a, i) => {
      const col = GYRO.sectors[GYRO.wheel[i].s].c, lit = i === hi;
      cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, R, a.from - Math.PI / 2, a.to - Math.PI / 2); cx.closePath();
      cx.globalAlpha = hi < 0 || lit ? 1 : 0.45;
      cx.fillStyle = col; cx.fill();
      cx.globalAlpha = 1; cx.strokeStyle = '#060913'; cx.lineWidth = 1.5; cx.stroke();
      if (lit) { cx.shadowColor = col; cx.shadowBlur = 16; cx.strokeStyle = '#ffffff'; cx.lineWidth = 2; cx.stroke(); cx.shadowBlur = 0; }
    });
    cx.restore();
    cx.save(); cx.translate(c, c + 3);                         // hub
    cx.beginPath(); cx.arc(0, 0, R * 0.34, 0, TAU); cx.fillStyle = '#0b1226'; cx.fill();
    cx.strokeStyle = '#1e2a4a'; cx.lineWidth = 2; cx.stroke();
    cx.fillStyle = '#00f0ff'; cx.font = `900 ${Math.round(R * 0.26)}px Orbitron, monospace`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(hi >= 0 ? `×${GYRO.sectors[GYRO.wheel[hi].s].m}` : 'G', 0, 1);
    cx.restore();
    const lamps = 20, big = hi >= 0 && GYRO.sectors[GYRO.wheel[hi].s].m >= 3;   // rim lamps: chase while spinning, flash on a big win
    for (let i = 0; i < lamps; i++) {
      const a = i / lamps * TAU, on = anim ? (i + Math.floor(rot * 3)) % 4 === 0 : big ? (idle + i) % 2 === 0 : (i + idle) % 5 === 0;
      cx.beginPath(); cx.arc(c + Math.cos(a) * (R + 4), c + 3 + Math.sin(a) * (R + 4), 1.8, 0, TAU);
      cx.fillStyle = on ? (big ? '#ffcc33' : '#ffffff') : '#2a3654'; cx.fill();
    }
    cx.save(); cx.translate(c, 1); cx.rotate(-kick * 0.6);                    // pointer flicks back on every peg
    cx.beginPath(); cx.moveTo(-7, 0); cx.lineTo(7, 0); cx.lineTo(0, 14); cx.closePath();
    cx.fillStyle = '#ffcc33'; cx.shadowColor = '#ffcc33'; cx.shadowBlur = 10; cx.fill(); cx.shadowBlur = 0;
    cx.restore();
  }

  function step(now) {
    const p = Math.min(1, (now - anim.t0) / anim.ms), last = under();
    const roll = easeOut(Math.min(1, p / 0.88)), settle = p > 0.88 ? (1 - Math.cos((p - 0.88) / 0.12 * Math.PI)) / 2 : 0;
    rot = anim.from + (anim.to + OVERSHOOT - anim.from) * roll - OVERSHOOT * settle;   // roll a little past, then creep back
    kick *= 0.8;
    if (under() !== last) { onTick(); kick = 1; }
    draw();
    if (p < 1) raf = requestAnimationFrame(step); else finish();
  }
  const blink = setInterval(() => { if (!canvas.isConnected) return clearInterval(blink); if (!anim) { idle++; draw(); } }, 450);

  /** Spin so that segment `i` lands under the pointer; ms = 0 lands at once (reduced motion). */
  function spinTo(i, ms, done) {
    finish();
    hi = -1;
    // Next to the jackpot the stop hugs the shared edge, so the overshoot shows ×5 for a moment before settling back.
    const at = i === (JACKPOT + 1) % arcs.length ? 0.05 : i === (JACKPOT - 1 + arcs.length) % arcs.length ? 0.97 : 0.2 + Math.random() * 0.6;
    const a = arcs[i], phi = a.from + (a.to - a.from) * at;
    anim = {t0: performance.now(), ms, from: rot, to: rotationFor(phi, rot, ms ? 5 : 0), done, i};
    if (!ms) return finish();
    raf = requestAnimationFrame(step);
  }

  function finish() {
    if (!anim) return;
    cancelAnimationFrame(raf);
    const {to, done, i} = anim;
    anim = null; rot = to % TAU; hi = i; draw();
    done?.();
  }

  fit();
  return {spinTo, finish, resize: fit, get spinning() { return !!anim; }, reset() { hi = -1; draw(); }};
}

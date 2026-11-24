// Procedural sound on the Web Audio API: no audio files, works offline in the APK.
let ctx = null, muted = false, paused = false;
export const setMuted = v => { muted = v; };
/** Silence everything while an ad plays or the tab is hidden; resume afterwards. */
export const setPaused = v => {
  paused = v;
  if (ctx) (v ? ctx.suspend() : ctx.resume()).catch(() => {});
};

function ac() {
  if (muted || paused) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'square', vol = 0.04, when = 0, slideTo = null) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

const NOTES = [523, 659, 784, 1047, 1319, 1568];
export const sfx = {
  tick: () => tone(420 + Math.random() * 500, 0.025, 'square', 0.014),
  slotStop: i => tone(260 + i * 90, 0.07, 'triangle', 0.05),
  lock: () => { tone(160, 0.05, 'square', 0.05); tone(90, 0.09, 'triangle', 0.06, 0.03); },
  fanfare: tier => NOTES.slice(0, tier + 1).forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.07)),
  siren: () => { for (let i = 0; i < 3; i++) tone(380, 0.25, 'sawtooth', 0.035, i * 0.25, 1150); },
  victory: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.9, 'sine', 0.05, i * 0.04)),
  defeat: () => { tone(330, 0.35, 'triangle', 0.05, 0, 220); tone(220, 0.5, 'triangle', 0.05, 0.3, 150); },
  coin: () => { tone(1320, 0.06, 'triangle', 0.04); tone(1760, 0.09, 'triangle', 0.04, 0.05); },
  hit: () => tone(170 + Math.random() * 90, 0.045, 'square', 0.03),
  impact: power => { tone(95, 0.12 + 0.05 * power, 'triangle', 0.08); tone(55, 0.2, 'sine', 0.07, 0.01); tone(2600 + Math.random() * 900, 0.03, 'square', 0.015); },
  riser: p => tone(260 + p * 900, 0.05, 'sawtooth', 0.02),                // suspense: pitch climbs while the last slots spin
  crack: () => { for (let i = 0; i < 4; i++) tone(1900 - i * 320, 0.05, 'square', 0.03, i * 0.03); },
  temperOk: () => [784, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, i * 0.05)),
  temperFail: () => tone(150, 0.28, 'sawtooth', 0.04, 0, 90),
};

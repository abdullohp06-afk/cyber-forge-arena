// Three 1×1 arena mini-games against a rival from the arena pool (a real player's profile online, a bot offline).
// The player's play is real input; the rival's is simulated from its rating. Pure functions, no DOM.
export const MINI = [
  {id: 'react', n: 'Реакция', d: 'Сигнал — и кто быстрее нажмёт', icon: 'bolt'},
  {id: 'tug', n: 'Перетяжка кабеля', d: '6 секунд тапов: тяни кабель к себе', icon: 'swords'},
  {id: 'aim', n: 'Точный удар', d: '3 удара в центр мишени', icon: 'target'},
];
export const MINI_CFG = {fee: 12, prize: 36, tugMs: 6000, tugSpan: 25, aimRounds: 3, reactTimeoutMs: 1500};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const miniFee = locMult => Math.round(MINI_CFG.fee * locMult);
export const miniPrize = locMult => Math.round(MINI_CFG.prize * locMult);

/** Rival skill 0.1..0.95 grows with its trophies, plus a little luck. */
export const rivalSkill = (trophies, rng = Math.random) => clamp(0.3 + trophies / 5000 + (rng() - 0.5) * 0.2, 0.1, 0.95);

/* Реакция */
export const rivalReactionMs = (skill, rng = Math.random) => Math.round(430 - 200 * skill + rng() * 80);
/** ms = null: tapped before the signal (or never) — a loss. */
export const reactWin = (ms, rivalMs) => ms !== null && ms >= 0 && ms < rivalMs;

/* Перетяжка кабеля */
export const rivalTaps = (skill, ms, rng = Math.random) => Math.floor((4 + 5 * skill + (rng() - 0.5) * 0.4) * ms / 1000);
/** Cable position −1..1, positive = pulled to the player; ±1 ends the round early. */
export const tugPos = (mine, theirs) => clamp((mine - theirs) / MINI_CFG.tugSpan, -1, 1);
export const tugWin = (mine, theirs) => tugPos(mine, theirs) > 0;

/* Точный удар */
/** Score 0..100 for stopping the marker at pos 0..1; the bullseye is 0.5. */
export const aimScore = pos => Math.max(0, Math.round(100 - Math.abs(pos - 0.5) * 240));
export const rivalAim = (skill, rng = Math.random) => clamp(Math.round(35 + 55 * skill + (rng() - 0.5) * 30), 0, 100);
/** Marker position for round r at time t (s): faster every round. */
export const aimPos = (t, round) => (Math.sin(t * (2.4 + round * 0.9)) + 1) / 2;

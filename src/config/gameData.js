// All tunable game content and numbers live here. Engine and UI only read this file.

export const RANK_WEIGHTS = [55, 28, 13, 4];        // ranks I..IV, % chance per slot
export const MYTHIC_CHANCE = 0.015;                  // perk slot becomes a mythic perk
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'Ω'];

export const LOCATIONS = [
  {
    id: 'neo', name: 'Нео-Токио', mult: 1, cost: 0, hue: '#00f0ff',
    elements: ['Неон', 'Ток', 'Дождь', 'Хром', 'Пульс', 'Глитч'],
    weapons: ['Катана', 'Шокер', 'Дрон', 'Хлыст', 'Рельса', 'Кастет'],
    perks: ['Рикошет', 'Перегрев', 'Взлом', 'Стелс', 'Эхо', 'Импульс'],
    mythic: ['Сердце Мегаполиса', 'Код Сёгуна', 'Неоновый Феникс'],
  },
  {
    id: 'abyss', name: 'Разлом Бездны', mult: 2.5, cost: 2300, hue: '#b06bff',
    elements: ['Пустота', 'Тень', 'Скверна', 'Мгла', 'Разлом', 'Шёпот'],
    weapons: ['Коса', 'Жнец-ПК', 'Гарпун', 'Клинок тьмы', 'Цепь', 'Сфера'],
    perks: ['Поглощение', 'Страх', 'Фаза', 'Проклятие', 'Вакуум', 'Ужас'],
    mythic: ['Глаз Бездны', 'Корона Пустоты', 'Нулевой Предел'],
  },
  {
    id: 'titan', name: 'Ядро Титана', mult: 6, cost: 26000, hue: '#ff7a1a',
    elements: ['Магма', 'Сталь', 'Плазма', 'Термит', 'Ядро', 'Вольфрам'],
    weapons: ['Молот', 'Пушка', 'Бур', 'Мех-кулак', 'Рейлган', 'Резак'],
    perks: ['Броня', 'Ударная волна', 'Расплав', 'Тяжесть', 'Каскад', 'Таран'],
    mythic: ['Сердце Титана', 'Кузня Богов', 'Вечный Реактор'],
  },
  {
    id: 'quantum', name: 'Квантовый Синдикат', mult: 15, cost: 240000, hue: '#ff3366',
    elements: ['Кварк', 'Фотон', 'Тахион', 'Струна', 'Спин', 'Энтропия'],
    weapons: ['Сингулярность', 'Фазер', 'Квант-лук', 'Матрица', 'Призма', 'Вектор'],
    perks: ['Суперпозиция', 'Телепорт', 'Петля', 'Парадокс', 'Туннель', 'Запутанность'],
    mythic: ['Абсолютный Ноль', 'Око Наблюдателя', 'Конец Времени'],
  },
  {
    id: 'astral', name: 'Звёздная Цитадель', mult: 40, cost: 2200000, hue: '#ffe066',
    elements: ['Корона', 'Вспышка', 'Нова', 'Аврора', 'Квазар', 'Звездопад'],
    weapons: ['Солнечный клинок', 'Копьё света', 'Звёздный молот', 'Луч-пушка', 'Орбита', 'Кометный хлыст'],
    perks: ['Сияние', 'Гравитация', 'Затмение', 'Солнечный ветер', 'Протуберанец', 'Синтез'],
    mythic: ['Сердце Звезды', 'Венец Солнца', 'Последний Рассвет'],
  },
];

// Score thresholds per rarity; colours are the neon accents of the UI.
export const TIERS = [
  {n: 'Базовый', min: 0, c: '#8b97ad'},
  {n: 'Закалённый', min: 22, c: '#4ade80'},
  {n: 'Редкий', min: 34, c: '#00f0ff'},
  {n: 'Эпический', min: 60, c: '#b06bff'},
  {n: 'Легендарный', min: 110, c: '#ffcc33'},
  {n: 'Мифический', min: 200, c: '#ff3366'},
];
export const KEEP_TIER = 2;              // Редкий+ goes to the Arsenal by itself
export const ARSENAL_MAX = 80;

// Economy. Credits per forge = score * CREDIT_RATE * location mult * boosts.
export const CREDIT_RATE = 0.1;
export const COMBO = {window: 1100, step: 0.05, maxStreak: 20};           // ×1.0 → ×2.0
export const HEAT = {perForge: 0.9, decayPerSec: 4, max: 100};
export const OVERDRIVE = {ms: 12000, credits: 3, luck: 2};
export const REROLL = {base: 6, perLock: 0.6};                           // × location mult
export const MAX_LOCKS = 2;

// Гиро-Реактор: stake credits, spin, and the prize is paid out at once inside the drawer.
// Weights are real odds in %, and the wheel draws every segment to that scale.
// Credit payout averages 0.98 × stake; the two non-credit sectors (кейс, OVERDRIVE) ride on top of that.
export const GYRO = {
  shares: [0.1, 0.25, 0.5],
  minBet: 20,                                  // × location mult; below it only the ad-funded rescue spin is offered
  spinMs: 2600,
  boxMinStake: 10,                             // × minBet: under it the кейс sector pays credits instead, so min-bet spam can't farm containers
  sectors: [
    {m: 0.5, n: '×0.5 Кэшбэк', c: '#6b7a99'},
    {m: 1.5, n: '×1.5 Кредиты', c: '#00f0ff'},
    {m: 2.5, n: '×2.5 Кредиты', c: '#4ade80'},
    {m: 0, kind: 'box', box: 'standard', n: 'Бесплатный Кейс', c: '#b06bff'},
    {m: 0, kind: 'od', n: 'OVERDRIVE', c: '#ff7a1a'},
    {m: 7, kind: 'jackpot', n: 'ДЖЕКПОТ ×7', c: '#ff3366'},
  ],
  // Segments around the wheel (s = sector index, w = % of the wheel).
  // Кэшбэк 48, ×1.5 28, ×2.5 10, кейс 7, OVERDRIVE 6, джекпот 1 → credit EV = 0.98.
  wheel: [{s: 0, w: 16}, {s: 1, w: 14}, {s: 0, w: 16}, {s: 2, w: 10}, {s: 3, w: 7}, {s: 0, w: 16}, {s: 1, w: 14}, {s: 4, w: 6}, {s: 5, w: 1}],
  heat: {2.5: 30, 7: 70},                      // extra reactor heat the big credit prizes also hand over
};

// Каталог индексов: the evaluate() tags worth collecting, [tag id, label]. Counts live in S.stats.tags.
export const INDEX_TAGS = [
  ['j777', 'Джекпот 777'], ['j001', 'Джекпот 001'], ['j999', 'Джекпот 999'], ['triple', 'Тройка'], ['first10', 'Первая десятка'],
  ['ladder', 'Лесенка'], ['round', 'Круглый'], ['mirror', 'Зеркало'], ['pair', 'Пара цифр'],
  ['res3', 'Резонанс ранга'], ['res2', 'Пара рангов'], ['mythic', 'Мифический перк'], ['super', 'Двойная сверхмощь'],
];

export const UPGRADES = {
  mult:    {n: 'Усилитель кредитов', d: '+30% кредитов за ковку', base: 170, k: 1.75, max: 12},
  luck:    {n: 'Квантовая удача', d: 'Каждая ковка — лучший из нескольких вариантов', base: 320, k: 2.1, max: 6},
  reactor: {n: 'Реактор', d: 'Перегрев набирается на 25% быстрее', base: 220, k: 1.9, max: 6},
  auto:    {n: 'Авто-молот', d: 'Куёт сам, пока ты отдыхаешь', base: 300, k: 1.8, max: 8},
  strike:  {n: 'Боевой разгон', d: '+1 к силе тапа на Арене', base: 240, k: 1.7, max: 8},
};

export const CONTAINERS = [
  {id: 'smuggler', n: 'Контрабандный', tries: 12, cost: 0, ad: true, cooldownMs: 4 * 60 * 1000, d: 'Бесплатно за рекламу, раз в 4 минуты'},
  {id: 'standard', n: 'Стандартный', tries: 8, cost: 450, d: 'Лучший из 8 вариантов'},
  {id: 'military', n: 'Военный', tries: 40, cost: 2400, d: 'Лучший из 40 вариантов'},
  {id: 'titanium', n: 'Титановый', tries: 200, cost: 12000, d: 'Лучший из 200 — почти всегда эпик+'},
];

export const LEAGUES = [
  {n: 'Новичок', min: 0}, {n: 'Бронза', min: 150}, {n: 'Серебро', min: 400}, {n: 'Золото', min: 800},
  {n: 'Платина', min: 1400}, {n: 'Алмаз', min: 2200}, {n: 'Кибер-Бог', min: 3200},
];
export const ARENA = {
  duelMs: 10000,
  oppBase: 350, oppPerTrophy: 1.4,     // opponent total power at your rating
  oppSpread: 0.12,                     // ±12% randomness
  oppStartShare: 0.5,                  // part of the opponent's total it has at second 0
  tapBase: 2,                          // power per exchange and the unit every ability is priced in; + strike level
  // The duel fights itself: blades trade blows at this rate, and the player spends the time on the three abilities.
  // The auto rate alone roughly matches what hammering the old tap button delivered, so abilities are the upside.
  autoPerSec: 5,
  speeds: [1, 2],                      // ×1 / ×2 clock: the duel is the same length in game time, shorter in real time
  abilities: [
    {id: 'strike', n: 'Удар стихии', ic: '⚡', cd: 2200, mult: 8},
    {id: 'shield', n: 'Энергощит', ic: '🛡️', cd: 4200, ms: 1200, reflect: 0.6},   // blocks the rival's growth and returns part of it
    {id: 'ult', n: 'Перегрузка', ic: '🔥', cd: 6500, mult: 25},
  ],
  win: {trophies: 28, perStreak: 4, maxStreakBonus: 5, credits: 60, creditsPerTrophy: 0.5},
  loss: {trophies: 14, credits: 15},
  adBonusTrophies: 10,
  interstitialEvery: 3,
};
export const BOT_NAMES = ['NeonRonin', 'ByteWitch', 'Zer0Day', 'KatanaKid', 'VoidJester', 'ChromeLynx', 'Glitchling',
  'RustSamurai', 'PixelHex', 'QuarkQueen', 'Overclock', 'NullPointer', 'SynthViper', 'Tashkent2077', 'MechaMango',
  'DataDruid', 'IonStorm', 'CyberSultan', 'LaserLotus', 'HexHound'];

export const CONTRACTS = [
  {k: 'forges', t: n => `Выкуй ${n} артефактов`, n: [40, 80, 150], r: n => n * 4},
  {k: 'rare', t: n => `Получи ${n} артефакта «Редкий» или выше`, n: [3, 5, 8], r: n => n * 80},
  {k: 'reroll', t: n => `Сделай ${n} перековки с замком`, n: [2, 4], r: n => n * 70},
  {k: 'overdrive', t: n => `Запусти OVERDRIVE ${n} раз`, n: [1, 2], r: n => n * 250},
  {k: 'wins', t: n => `Победи на Арене ${n} раз`, n: [1, 3, 5], r: n => n * 150},
  {k: 'credits', t: n => `Заработай ${n} кредитов`, n: [500, 1500, 4000], r: n => Math.round(n * 0.35)},
  {k: 'mirror', t: n => `Выкуй ${n} зеркальных индекса (121, 505…)`, n: [3, 5], r: n => n * 45},
];

export const SAVE_KEY = 'cyberforge_v1';
export const SAVE_VERSION = 1;

// Достижения: what each one measures, its goal and its reward. Read by engine/achievements.js.
// v(S, x) returns the current value of the measured quantity; the achievement is ready when v >= goal.
// Rewards: credits, a free container ({box: 'standard'|'military'|'titanium'}) or a permanent bonus
// ({craft: 0.02} = +2% power of newly forged artifacts, {arena: 0.05} = +5% Arena credits).

const tiersAtLeast = (S, t) => S.stats.tiers.slice(t).reduce((a, b) => a + b, 0);
const tag = (S, id) => S.stats.tags?.[id] ?? 0;
const ups = S => Object.values(S.up).reduce((a, b) => a + b, 0);

export const ACH_CATS = [
  {id: 'forge', n: 'Мастер ковки'}, {id: 'rare', n: 'Охотник за редкостями'}, {id: 'temper', n: 'Идеальный закальщик'},
  {id: 'risk', n: 'Риск и азарт'}, {id: 'arena', n: 'Чемпион Арены'}, {id: 'dex', n: 'Коллекционер'}, {id: 'grow', n: 'Магнат кузни'},
];

const forge = (n, reward) => ({cat: 'forge', n: `Удар №${n.toLocaleString('ru-RU')}`, d: `Выкуй ${n.toLocaleString('ru-RU')} артефактов`, v: S => S.stats.forges, goal: n, reward});

export const ACHIEVEMENTS = [
  {id: 'f10', ...forge(10, {credits: 60})},
  {id: 'f100', ...forge(100, {credits: 400})},
  {id: 'f500', ...forge(500, {box: 'standard'})},
  {id: 'f2500', ...forge(2500, {craft: 0.02})},
  {id: 'f10000', ...forge(10000, {craft: 0.03})},

  {id: 'r_rare', cat: 'rare', n: 'Первый редкий', d: 'Получи артефакт «Редкий» или выше', v: S => tiersAtLeast(S, 2), goal: 1, reward: {credits: 80}},
  {id: 'r_epic', cat: 'rare', n: 'Эпическая находка', d: 'Получи «Эпический» артефакт', v: S => tiersAtLeast(S, 3), goal: 1, reward: {credits: 250}},
  {id: 'r_epic10', cat: 'rare', n: 'Склад эпиков', d: 'Получи 10 «Эпических» или выше', v: S => tiersAtLeast(S, 3), goal: 10, reward: {box: 'standard'}},
  {id: 'r_leg', cat: 'rare', n: 'Легенда кузни', d: 'Получи «Легендарный» артефакт', v: S => tiersAtLeast(S, 4), goal: 1, reward: {box: 'military'}},
  {id: 'r_myth', cat: 'rare', n: 'Миф во плоти', d: 'Получи «Мифический» артефакт', v: S => tiersAtLeast(S, 5), goal: 1, reward: {craft: 0.02}},
  {id: 'r_777', cat: 'rare', n: 'Три семёрки', d: 'Выбей джекпот 777', v: S => tag(S, 'j777'), goal: 1, reward: {box: 'military'}},
  {id: 'r_001', cat: 'rare', n: 'Номер один', d: 'Выбей индекс 001', v: S => tag(S, 'j001'), goal: 1, reward: {credits: 1500}},
  {id: 'r_super', cat: 'rare', n: 'Двойная сверхмощь', d: 'Получи тег «Двойная сверхмощь ×2»', v: S => tag(S, 'super'), goal: 1, reward: {craft: 0.02}},

  {id: 't1', cat: 'temper', n: 'Точный удар', d: 'Попади в золотую зону закалки', v: S => S.stats.tempers ?? 0, goal: 1, reward: {credits: 100}},
  {id: 't10', cat: 'temper', n: 'Рука мастера', d: '10 идеальных закалок', v: S => S.stats.tempers ?? 0, goal: 10, reward: {box: 'standard'}},
  {id: 't50', cat: 'temper', n: 'Закалённый в огне', d: '50 идеальных закалок', v: S => S.stats.tempers ?? 0, goal: 50, reward: {craft: 0.02}},
  {id: 'ts3', cat: 'temper', n: 'Серия ×3', d: '3 идеальные закалки подряд', v: S => S.stats.temperBest ?? 0, goal: 3, reward: {credits: 600}},
  {id: 'ts5', cat: 'temper', n: 'Серия ×5', d: '5 идеальных закалок подряд', v: S => S.stats.temperBest ?? 0, goal: 5, reward: {box: 'military'}},

  {id: 'g1', cat: 'risk', n: 'Первый оборот', d: 'Раскрути Гиро-Реактор', v: S => S.gyro.spins, goal: 1, reward: {credits: 50}},
  {id: 'g25', cat: 'risk', n: 'Завсегдатай реактора', d: '25 спинов Гиро-Реактора', v: S => S.gyro.spins, goal: 25, reward: {credits: 1200}},
  {id: 'g3', cat: 'risk', n: 'Крупный куш', d: 'Выбей ×2.5 в Гиро-Реакторе', v: S => S.gyro.hits3 ?? 0, goal: 1, reward: {credits: 500}},
  {id: 'g5', cat: 'risk', n: 'Джекпот', d: 'Выбей ДЖЕКПОТ ×7 в Гиро-Реакторе', v: S => S.gyro.hits5 ?? 0, goal: 1, reward: {box: 'military'}},

  {id: 'a1', cat: 'arena', n: 'Первая кровь', d: 'Победи на Арене', v: S => S.stats.wins, goal: 1, reward: {credits: 150}},
  {id: 'a10', cat: 'arena', n: 'Гладиатор', d: '10 побед на Арене', v: S => S.stats.wins, goal: 10, reward: {arena: 0.05}},
  {id: 'a50', cat: 'arena', n: 'Ветеран', d: '50 побед на Арене', v: S => S.stats.wins, goal: 50, reward: {box: 'military'}},
  {id: 'a200', cat: 'arena', n: 'Непобедимый', d: '200 побед на Арене', v: S => S.stats.wins, goal: 200, reward: {arena: 0.1}},
  {id: 'as3', cat: 'arena', n: 'На волне', d: 'Серия из 3 побед', v: S => S.stats.maxStreak ?? 0, goal: 3, reward: {credits: 400}},
  {id: 'as7', cat: 'arena', n: 'Неудержимый', d: 'Серия из 7 побед', v: S => S.stats.maxStreak ?? 0, goal: 7, reward: {arena: 0.05}},
  {id: 'l_silver', cat: 'arena', n: 'Серебряная лига', d: 'Набери 400 кубков', v: S => S.trophies, goal: 400, reward: {credits: 800}},
  {id: 'l_gold', cat: 'arena', n: 'Золотая лига', d: 'Набери 800 кубков', v: S => S.trophies, goal: 800, reward: {box: 'military'}},
  {id: 'l_diamond', cat: 'arena', n: 'Алмазная лига', d: 'Набери 2 200 кубков', v: S => S.trophies, goal: 2200, reward: {arena: 0.1}},
  {id: 'l_god', cat: 'arena', n: 'Кибер-Бог', d: 'Набери 3 200 кубков', v: S => S.trophies, goal: 3200, reward: {box: 'titanium'}},

  {id: 'd10', cat: 'dex', n: 'Коллекционер', d: 'Открой 10 находок в Каталоге', v: (S, x) => x.dex, goal: 10, reward: {credits: 200}},
  {id: 'd25', cat: 'dex', n: 'Знаток', d: 'Открой 25 находок', v: (S, x) => x.dex, goal: 25, reward: {box: 'standard'}},
  {id: 'd50', cat: 'dex', n: 'Архивариус', d: 'Открой 50 находок', v: (S, x) => x.dex, goal: 50, reward: {craft: 0.02}},
  {id: 'dall', cat: 'dex', n: 'Полный каталог', d: 'Открой все находки всех локаций', v: (S, x) => x.dex / x.dexTotal, goal: 1, reward: {craft: 0.05}},
  {id: 'i5', cat: 'dex', n: 'Нумеролог', d: 'Собери 5 типов индексов и резонансов', v: (S, x) => x.idx, goal: 5, reward: {credits: 600}},
  {id: 'iall', cat: 'dex', n: 'Повелитель чисел', d: 'Собери все 13 типов индексов', v: (S, x) => x.idx, goal: 13, reward: {box: 'titanium'}},

  {id: 'loc2', cat: 'grow', n: 'В Бездну', d: 'Открой Разлом Бездны', v: S => S.unlocked.length, goal: 2, reward: {credits: 300}},
  {id: 'loc3', cat: 'grow', n: 'Сердце Титана', d: 'Открой Ядро Титана', v: S => S.unlocked.length, goal: 3, reward: {box: 'military'}},
  {id: 'loc4', cat: 'grow', n: 'Квантовый скачок', d: 'Открой Квантовый Синдикат', v: S => S.unlocked.length, goal: 4, reward: {craft: 0.03}},
  {id: 'loc5', cat: 'grow', n: 'К звёздам', d: 'Открой Звёздную Цитадель', v: S => S.unlocked.length, goal: 5, reward: {box: 'titanium'}},
  {id: 'od1', cat: 'grow', n: 'Перегрев', d: 'Запусти OVERDRIVE', v: S => S.stats.overdrives, goal: 1, reward: {credits: 120}},
  {id: 'od25', cat: 'grow', n: 'Реакторщик', d: 'Запусти OVERDRIVE 25 раз', v: S => S.stats.overdrives, goal: 25, reward: {craft: 0.02}},
  {id: 'rr10', cat: 'grow', n: 'Перфекционист', d: 'Сделай 10 перековок с замком', v: S => S.stats.rerolls, goal: 10, reward: {credits: 500}},
  {id: 'up10', cat: 'grow', n: 'Модернизация', d: 'Купи 10 уровней улучшений', v: S => ups(S), goal: 10, reward: {box: 'standard'}},
  {id: 'up30', cat: 'grow', n: 'Цех будущего', d: 'Купи 30 уровней улучшений', v: S => ups(S), goal: 30, reward: {arena: 0.05}},
];

/** Every 10 finds in the Каталог give +5% to the power of newly forged artifacts. */
export const DEX_BONUS = {per: 10, craft: 0.05};

import test from 'node:test';
import assert from 'node:assert/strict';
import {archetype, elementStyle} from '../src/ui/weaponArt.js';
import {stageLevel, inZone} from '../src/ui/forgeStage.js';
import {LOCATIONS} from '../src/config/gameData.js';

test('every weapon in the game gets the silhouette it is named after', () => {
  const expected = {
    'Катана': 'blade', 'Шокер': 'rail', 'Дрон': 'drone', 'Хлыст': 'whip', 'Рельса': 'rail', 'Кастет': 'hammer',
    'Коса': 'scythe', 'Жнец-ПК': 'scythe', 'Гарпун': 'spear', 'Клинок тьмы': 'blade', 'Цепь': 'whip', 'Сфера': 'orb',
    'Молот': 'hammer', 'Пушка': 'rail', 'Бур': 'spear', 'Мех-кулак': 'hammer', 'Рейлган': 'rail', 'Резак': 'blade',
    'Сингулярность': 'orb', 'Фазер': 'rail', 'Квант-лук': 'bow', 'Матрица': 'orb', 'Призма': 'orb', 'Вектор': 'spear',
    'Солнечный клинок': 'blade', 'Копьё света': 'spear', 'Звёздный молот': 'hammer', 'Луч-пушка': 'rail', 'Орбита': 'orb', 'Кометный хлыст': 'whip',
  };
  const all = LOCATIONS.flatMap(l => l.weapons);
  assert.deepEqual(all.filter(w => !(w in expected)), [], 'a new weapon needs an entry here');
  for (const w of all) assert.equal(archetype(w), expected[w], w);
});

test('elements drive the vein style', () => {
  const fx = n => elementStyle(n).fx;
  assert.deepEqual(['Неон', 'Магма', 'Пустота', 'Кварк', 'Сталь'].map(fx), ['bolt', 'lava', 'void', 'prism', 'plain']);
  for (const l of LOCATIONS) for (const e of l.elements) assert.ok(elementStyle(e).a.startsWith('#'), e);
});

test('forge evolves at 5 / 12 / 21 / 32 total upgrade levels', () => {
  const at = [0, 4, 5, 11, 12, 20, 21, 31, 32, 40].map(stageLevel);
  assert.deepEqual(at, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('perfect temper zone is inclusive at both edges', () => {
  const zone = {from: 0.5, width: 0.16};
  assert.deepEqual([0.49, 0.5, 0.6, 0.66, 0.67].map(p => inZone(p, zone)), [false, true, true, true, false]);
});

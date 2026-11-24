# Кибер-Кузня: Арена (Cyber-Forge: Arena)

Мобильный кликер-коллекционер: куёшь артефакты из 4 слотов `[Стихия] + [Оружие] + [Перк] + [Индекс 001–999]`,
ловишь джекпоты `777 / 001 / 999`, закрываешь удачные слоты замком и перековываешь остальное,
разгоняешь реактор до **OVERDRIVE** и сражаешься в 10-секундных дуэлях на Арене.
Vite + чистый JS (ES-модули), без фреймворков. Готово к упаковке в Android APK через Capacitor и к рекламе AdMob / Yandex Games.

## Запуск

```bash
npm install          # один раз
npm run dev          # dev-сервер: http://localhost:5173 (и адрес в локальной сети — открой с телефона)
npm test             # тесты движка + симуляция баланса
npm run build        # продакшен-сборка в dist/
npm run preview      # посмотреть собранную версию
```

## Яндекс Игры

```bash
npm run build:yandex   # → cyber-forge-yandex.zip (index.html в корне архива, SDK подключён, реклама через Яндекс)
```

Архив загружается в консоль разработчика Яндекс Игр. Сборка вызывает `LoadingAPI.ready()` после загрузки,
`GameplayAPI.start/stop` вокруг рекламы, глушит звук во время рекламы и при скрытой вкладке.
Обычная `npm run build` по-прежнему показывает тестовую рекламу.

## Android (APK)

Одной командой собрать игру и создать/обновить Android-проект:

```bash
npm run android      # = vite build + npx cap add android + npx cap sync android
```

Дальше: `npx cap open android` → в Android Studio **Build → Build APK(s)**. Нужны Android Studio и JDK 17+.
После изменений в коде достаточно `npm run android:sync`.

### Реклама
`src/services/adBridge.js`, флаг `TEST_MODE = true` — вместо рекламы красивая тестовая модалка с таймером.
- **AdMob (APK):** `npm i @capacitor-community/admob && npx cap sync android`, в `AndroidManifest.xml` добавить
  `com.google.android.gms.ads.APPLICATION_ID`, в `adBridge.js` заменить тестовые id блоков на свои и поставить `TEST_MODE = false`.
- **Yandex Games (web):** подключить `/sdk.js` в `index.html` по инструкции Яндекса — мост сам найдёт `window.YaGames`.

Пять мест показа (больше нигде): бесплатная перековка, ×2 награда после победы, мгновенный OVERDRIVE,
Контрабандный контейнер (раз в 4 мин), межстраничная — только после каждой 3-й дуэли, никогда во время ковки.

## Устройство

```
src/config/gameData.js   все числа и контент: локации, пулы, редкости, экономика, апгрейды, лиги, контракты
src/engine/forge.js      генерация слотов, синергии, редкость, кредиты (чистые функции)
src/engine/arena.js      отряд Топ-3, соперники, исход дуэли, лиги, лидерборд с ботами
src/services/adBridge.js монетизация: тест / AdMob / Yandex Games
src/fx/                  звук (Web Audio) и частицы/тряска/вибрация
src/ui/                  экраны, анимации, сохранение (localStorage, ключ cyberforge_v1, с версией и миграциями)
tests/                   юнит-тесты и симуляция баланса (node --test)
```

## Баланс (проверяется `npm test`, медиана 41 симуляции активной игры)
- первый апгрейд — ~35 с, первая победа на Арене — ~1.5 мин, вторая локация — ~3 мин 50 с.
Чтобы менять темп, правь `CREDIT_RATE`, цены в `UPGRADES`/`LOCATIONS` и `ARENA.oppBase` в `gameData.js`, затем `npm test`.

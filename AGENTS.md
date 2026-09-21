# AGENTS.md — правила работы нейросети с сайтом и игрой «Летописи Руси» (ChroniclesRuthenia)

Канон формата: https://agents.md/ — этот файл читает ИИ-агент перед началом работы.
Репозиторий = сайт **https://sosnowda.github.io/** (GitHub Pages, user-site) + браузерная игра в папке `game/`.
Любой пуш в `main` = автоматический деплой на прод (сборка GitHub Pages занимает 1–3 минуты).

---

## 1. Обзор проекта

- **Сайт-лендинг**: `index.html` (RU) + `en/index.html` (EN) — витрина с описанием, скриншотами и ссылками на игру; стили `styles.css`, клиент `main.js`, иконки `icons.svg`, манифест PWA `manifest.json`.
- **Игра**: Phaser 3.88.2 (WebGL/Web Audio), точка входа `game/index.html`, исходники `game/src/`.
- **Жанр**: диалоговая RPG-детектив по мотивам БРП (Chaosium BRP d100): кража иконы в деревне XV века, погоня за вором по локациям околицы, бои, репутация, церковный календарь.

## 2. Структура репозитория (только то, что нужно чаще всего)

```
/                     ← корень = сайт (index.html, styles.css, sw.js, en/, assets/screenshots/)
game/index.html       ← запуск игры (подключает сцены, ScreenshotDirector)
game/src/scenes/      ← сцены Phaser (Title, CharacterSelection, Village, Interior, Location, Forest, Apiary, Fork, Combat, Character, End, Loading, Boot)
game/src/systems/     ← движковые подсистемы (i18n, RusTime, TimeSystem, Weather, WaterBounds, NpcWander, VirtualControls, SaveManager…)
game/src/data/        ← данные/логика мира (interiors, world, thief, npcPresence, herd, housesFX, mapLocations…)
game/src/tools/       ← ScreenshotDirector.js (?shot=… сценарии скриншотов)
game/assets/          ← PNG/JPG ассеты (cache-first через SW! меняются только с бампом версии)
game/tools/           ← генераторы ассетов (python) и юнит-тесты (node .mjs)
game/docs/            ← QA-отчёты раундов + рабочие кадры
worklog.md            ← ЖУРНАЛ РАБОТ — обновляется при КАЖДОМ пуше (см. §7)
CHANGES.md            ← пользовательский changelog патчей (сверху новая секция)
```

## 3. Команды

```bash
# Локальный стенд (обязателен перед пушем; из корня репо):
python3 -m http.server 8090          # → http://localhost:8090/game/  и http://localhost:8090/

# Юнит-тесты (все четыре должны быть зелёными):
node game/tools/test_round64.mjs     # 40 проверок
node game/tools/test_round65.mjs     # 64
node game/tools/test_round66.mjs     # 48
node game/tools/test_round67.mjs     # 42
node game/tools/test_round68.mjs     # вода/деревья (раунд 66.5)
node game/tools/test_round69.mjs     # звук/погода/сезоны/слухи/сайт (раунд 66.6) — новые раунды добавляют свои

# Синтаксис правленых файлов:
node --check game/src/…/*.js

# Git (пуш = деплой):
git add -A && git commit -m "патч 66.N: …" && git push origin main
```

## 4. Золотые правила разработки

1. **Языки.** Все игровые тексты — ТОЛЬКО русский. Глубокий английский перевод — отдельная разрешённая линия: любые видимые строки через `t()`/`tf()` из `systems/i18n.js`; после правок пополнять EN-словарь (блок «Патч 66.N») и запускать аудит `t()`-ключей (входит в test_round67: 0 пропусков).
2. **Имена собственные** (Гаврила, Баэнор, названия деревень, месяцы народного календаря) в EN — **транслитерацией** (Gavrila, Rakovaya sloboda, Lipen, Studen), не переводом и не кириллицей.
3. **Ассеты** `game/assets/` кешируются Service Worker'ом cache-first (`GAME_ASSETS_CACHE` в `sw.js`). Добавил/изменил ассет → **бампни версию** `game-assets-vNN` ИЛИ `CACHE_NAME`. Код `game/src/` отдаётся network-first — бамп не нужен.
4. **Никогда не ломать сейвы**: id зданий/предметов/квестов стабильны (`tavern` остаётся `tavern` несмотря на «Постоялый двор»).
5. **Деревня**: карта генерируется `world.buildMap()`; дома — `BUILDINGS` (зазор ≥1 тайл, дверь в центре нижней стены + песчаная дорожка к улице); деревья ставит `validateTreePlacement` (крона не накрывает дверной тайл, зазор ≥1 тайл между деревьями, коридор у ворот свободен). НПЦ ходят только по проходимым тайлам (`NpcWander.PASSABLE`).
6. **Вода (раунд 66.5)**: на «Реке» и «Озере» ни персонаж, ни НПЦ, ни стадо, ни следы не могут оказаться в воде — все точки прогоняются через `systems/WaterBounds.js: clampOutOfWater()`. Геометрия: река — полоса `y∈[0.45h, 0.45h+120]` с мостом `x=w/2±40`; озеро — круг `(w/2, h/2+30)` радиуса `min(w,h)/3.5`. Меняешь отрисовку воды в `LocationScene.drawLocation()` — синхронизируй WaterBounds и test_round68.
7. **Интерьеры**: 18 домов; фон `game/assets/interiors/int_bg_<id>.jpg` (запечён) + живой огонь/свет поверх. Новый дом = новый int_bg + запись в `data/interiors.js` (INTERIORS + BUILDINGS).
8. **Звук WebAudio (раунд 66.6)**: река/озеро — процедурный шум `systems/RiverAmbience.js` (без ассетов, громкость через `RIVER_VOLUME_BY_LOCATION`, подчиняется SFX-настройкам), колокол — `systems/ChurchBells.js`; реальные SFX — файлы `assets/audio/sfx/` + `AudioManager._playRealSfx` (приоритет файла над процедурой). Новый аудио-файл = бамп `game-assets-vNN`.
9. **Сезоны (раунд 66.6)**: поле дышит по `systems/SeasonalWork.js` (месяц 0 = сентябрь!): пахота(7)/посев(8)/сенокос(9)/жатва(10–11)/жнивьё(0–1)/залежь(2,6)/снег(3–5). Меняешь календарь — синхронизируй SeasonalWork и test_round69. Слухи таверны — `data/rumors.js` (до 3/день, registry-ключ `rumorsDay`).
10. **Стилистика кода**: ES-модули, `const`/`let`, комментарии на русском с номером раунда («// Раунд 68 (п.5): …»), никаких тестов в рантайме игры.

## 5. Инструменты и скрипты для агента

- **Скриншоты сайта (10 → сейчас 9 кадров)**: `game/src/tools/ScreenshotDirector.js` — открой `http://localhost:8090/game/?shot=<id>`, id: `menu, select, custom, village, map, interior, priest, thief, combat` (плюс служебный `blacksmith`). Кадр 1280×720 → webp q85 → `assets/screenshots/NN-name.webp` → карточка в `index.html`/`en/index.html`. Снял — обнови alt-тексты под реальное содержимое кадра.
- **Генераторы ассетов** (`game/tools/*.py`, нужны PIL): `make_assets_r66.py` (деревья Medieval_Expansion), `make_houses_r64/r65.py` (фасады fb_*/hp_*), `probe_fb_r65*.py` (снятие координат окон/труб → `data/housesFX.js`), `make_thief_sprite.py`.
- **Боевой/погонный симуляторы**: `game/tools/battle-sim.mjs`, `chase-sim.mjs` (балансные прогоны в node).
- **QA-браузер**: `agent-browser` (Chromium headless). Тактики для этой игры (Phaser-canvas):
  - игровой клик = `mouse move/down/up` по координатам; DOM-кликов почти нет;
  - состояние игры — через `eval`: `window.game.scene.getScene('Village')`, `window.game.registry`;
  - сцены: ключи `'Title'`, `'Village'`, `'Interior'`, `'Location'`, `'Fork'`, `'Combat'` (НЕ *Scene);
  - перейти в интерьер: `eval game.scene.getScene('Village')…` или `game.scene.start('Interior', {interiorId:'tavern'})`;
  - **среда капризная**: холодный заход на прод может висеть на загрузке (троттлинг песочницы, НЕ баг игры) — прогрей 90 c и сделай `reload` В ТОЙ ЖЕ сессии (SW-кеш живёт в сессии) → сцена готова за ~5 c; после нескольких навигаций headless деградирует (не рисует fullscreen-заливки, подвешивает delayedCall) — ОДИН кадр/проверка на сессию, `agent-browser close` между проверками; странный симптом → свежая сессия, прежде чем считать это багом.
- **Время/погода для кадра**: через `eval` поставить `registry.gameTime` (hour=22 — ночь; month=10, перебор day 1..28 — ясное лето), как делает ScreenshotDirector.

## 6. Деплой и проверка прода

1. Пуш в `main` → GitHub Pages строит сам. Проверка: `curl -s https://sosnowda.github.io/game/ -o /dev/null -w "%{http_code}"`.
2. Сверяй хэши прод ↔ локально для правленых файлов (`sha256sum`), для скриншотов — байт-в-байт.
3. `game/src/` — network-first (видно сразу); `game/assets/` и сайт — кеш: `max-age=600` у GitHub + SW-кеш → при изменении ассетов/сайта бампь версии SW.
4. Инцидент «404 Site not found» при `build=built` — сбой serving-слоя GitHub (самовосстанавливается), контент не виноват: не откатывай патч, проверь через 15–30 минут. Адреса-двойники: `sosnowda.github.io` — наш сайт; `sosnewda.github.io` — ОПЕЧАТКА (несуществующий пользователь).

## 7. Worklog — ОБЯЗАТЕЛЬНО (приказ владельца, раунд 66.5)

- Журнал работ живёт **в репозитории**: `worklog.md` в корне. Каждая рабочая сессия ДОБАВЛЯЕТ секцию (не перезаписывает):

```markdown
---
Task ID: <N | N-a, N-b>
Agent: <имя агента>
Task: <что поручено>

Work Log:
- <конкретные шаги>

Stage Summary:
- <результаты/решения/артефакты>
```

- **Каждый пуш включает обновлённый `worklog.md`** (и `CHANGES.md` для видимых изменений) — это часть определения готовности патча, как и зелёные тесты.
- Формат отчёта раунда: `game/docs/QA_ROUND<N>_<slug>.md`.

## 8. Чек-лист перед пушем

- [ ] `node --check` всех правленых .js
- [ ] все 4+ юнит-набора зелёные (`node game/tools/test_round6*.mjs`)
- [ ] стенд :8090 — ключевые сцены глазами/agent-browser, консоль без ошибок, сеть без 404
- [ ] новые видимые строки — в EN-словаре (аудит 0 пропусков)
- [ ] ассеты менялись? → бамп SW-версии
- [ ] `worklog.md` дополнен секцией раунда; `CHANGES.md` — секция патча
- [ ] пуш → прод-пинг → хэш-сверка правленых файлов → кадр на проде

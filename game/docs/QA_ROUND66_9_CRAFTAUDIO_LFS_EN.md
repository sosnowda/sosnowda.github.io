# QA-отчёт — Раунд 66.9: звуки ремёсел (CraftAudio), Git LFS для видео, аудит EN-глубины

**Коммиты:** 53e86e6 (патч 66.9) + 43558e2 (патч 66.9-LFS)
**База:** 844d71f (docs: PROMPT_PROMO_VIDEO.md — коммит владельца)
**Дата:** 22.09.2026
**Задача:** бэклог (утраченный сеанс + отчёты 66.5/66.7): «CraftSounds — молот/прялка/таверна», «Git LFS для mp4», «EN-глубина». Приказов владельца не поступало; cron-задача webDevReview — cron-инструмент недоступен в сессии (создать при первой возможности).

---

## 1. П.1 — ЗВУКИ РЕМЁСЕЛ (CraftAudio.js)

Новый `game/src/systems/CraftAudio.js` (325 строк) — процедурный WebAudio по канону RiverAmbience (66.6)/WeatherAudio (66.7): ассетов НЕ добавлено, поэтому **SW v67 и game-assets-v21 не бампились** (game/src — network-first).

| Голос | Интерьер | Синтез |
|---|---|---|
| 🔨 МОЛОТ | blacksmith | серии ударов по наковальне: негармоничные обертоны 1720/2610/4180 Гц (detune ±6%), шумовой щелчок bandpass 3 кГц; автомат «серия 3–6 ударов (0.38–0.6 с) ↔ передышка 2.2–5.2 с» на такте 120 мс; 30% серий — шип закалки (highpass 2600, 0.9 с) |
| 🧵 ПРЯЛКА | weaver_house, villager_house_2 | жужжание веретена bandpass 850 Гц + LFO-дыхание 0.5 Гц; щелчок колеса за оборот ~1.1 с (треск 1650 Гц + стук 210→140 Гц) |
| 🍺 ТАВЕРНА | tavern | гул голосов — band 420/750 Гц поверх `ambient_tavern.ogg`, приливы-«реплики» на такте 2 с; стук кружки 340→170 Гц (14%/такт) |

Ключевые решения:
- **Пустая кузница молчит**: InteriorScene-хук передаёт `volume: 0`, когда `getSmithNpcId(registry) = null` (мастер и ученик погибли — канон «тишины» р.46). Живой мастер или ученик — звук.
- Громкости `CRAFT_VOLUME_BY_INTERIOR`: кузница 0.5 > прялка 0.35 > таверна 0.3 (фон поверх трека).
- Мьют SFX (`settings.audio.sfxMuted`) и masterVolumeNode уважаются; SHUTDOWN — затухание 0.6 с, снятие таймеров, disconnect.
- Хук стоит сразу после `this.interior = interior` — учитывает смерть хозяина/вдову/ученика.

## 2. П.2 — GIT LFS ДЛЯ ВИДЕО

- `.gitattributes`: `assets/video/*.mp4`, `*.webm` → `filter=lfs diff=lfs merge=lfs -text`.
- git-lfs 3.7.0 (linux amd64) развернут в среде агента; `git lfs install --local` + `git add --renormalize assets/video`.
- 4 файла переведены в LFS: promo.mp4 7.31 МБ, intro.mp4 4.11 МБ, promo.webm 0.39 МБ, intro.webm 0.53 МБ (суммарно 12.3 МБ).
- **История НЕ переписывалась** (без `git lfs migrate import --everything`, без force-push) — старые коммиты с обычными blob'ами не тронуты, деплой ничем не рисковал.
- Выделен в ОТДЕЛЬНЫЙ коммит 43558e2 (изоляция риска: если бы LFS-раздача не сработала — откат одного коммита).

## 3. П.3 — EN-ГЛУБИНА (аудит закрывает бэклог)

Три аудит-прохода (зонд: копия i18n.js + `export { EN, EN_KEYS }`):
1. **«Тощие» переводы** (en < 0.6×ru при ru ≥ 45 симв): **0** из 1540 записей.
2. **Мягкий порог** (en < 0.75×ru при ru ≥ 50 симв): **0**.
3. **Полное покрытие литералов t()/tf()** с конкатенациями и decode `\u{...}`-эскейпов: **1431/1431**, tk() 4/4.
   - Найдена и закрыта **слепая зона аудита test_round67**: его regex `\bt\(` не проверял tf()-паттерны (а tf() внутри вызывает t()!). Усиленный аудит включён в test_round72 как регрессия (1423 ключа после whitelist).
   - Whitelist: `' ('`, `')'`, `' 🔒'` (канон 67), `'NPC: {0}'` (идентичная метка, i18n.js:381), уже-EN литералы rumors.js (двуязычные слухи проходят t() намеренно).
4. **Качество**: выборочная сверка 14 описаний интерьеров — полноценный художественный EN («It is dim inside; a loom stands by the window…», «Arina's spinning wheel under the bench», «The chamber smells of leather and tar…»).
5. **Лендинг RU/EN**: 816/816 строк, 43/43 секции — структурная идентичность.

Вывод: EN-глубина уже достигнута предыдущими раундами (раунды 57/66.3/66.6/66.7 пополняли словарь); бэклог закрывается АУДИТОМ С ДОКАЗАТЕЛЬСТВАМИ + регрессионным тестом, без правок ради правок.

## 4. Юнит-тесты

- **Новый test_round72.mjs — 34/34**: таблица громкостей/баланс; моки-сцены (null без ctx / locked / volume 0; кузница-автомат в «rest»; прялка 1 слой + 1 таймер; таверна 2 слоя; church → null; SHUTDOWN dead-флаг); source-канон (без импорта Phaser, masterVolumeNode, sfxMuted, SHUTDOWN); хук InteriorScene + getSmithNpcId-гвардия + позиция после `this.interior`; EN-аудит 1423/1423; SW v67.
- Регрессии: 40+64+48+42+54+105+78+70 = **501**. **Итого 535 зелёных.**
- `node --check`: CraftAudio.js, InteriorScene.js, test_round72.mjs — 0 ошибок.

## 5. Прод-верификация

**Хэш-сверка ПРОД ↔ ЛОКАЛ (после 53e86e6 + 43558e2):**

| Файл | Результат |
|---|---|
| game/src/systems/CraftAudio.js | MATCH |
| game/src/scenes/InteriorScene.js | MATCH |
| game/tools/test_round72.mjs | MATCH |
| AGENTS.md / CHANGES.md / worklog.md | MATCH ×3 |
| sw.js / game/index.html / index.html | MATCH ×3 |
| .gitattributes | 404 — Pages не раздаёт dotfiles (норма, файл инфраструктурный) |

**LFS-видео на проде (проверка прокси media.githubusercontent.com):**

| Файл | HTTP | Content-Type | Сверка |
|---|---|---|---|
| assets/video/promo.mp4 | 200 | video/mp4 | sha256 прод `c1827f1304…` = локал = LFS-OID — байт-в-байт |
| assets/video/intro.mp4 | 200 | video/mp4 | ✓ |
| assets/video/promo.webm | 200 | video/webm | ✓ |
| assets/video/intro.webm | 200 | video/webm | ✓ |

**Прод-браузер (agent-browser):** холодный заход висел на загрузке (~12% → 55% при прогреве — задокументированный троттлинг песочницы, НЕ баг); после reload в сессии — Title → Village: деревня рисуется полностью (дома, частокол, дорожки, НПЦ, виджет мини-карты «Городец на Волге», статус-бар с «План/Обзор/Задания»); eval `start('Interior',{interiorId:'blacksmith'})` → `blacksmith:Кузнец Данила` — хук CraftAudio отработал без ошибок. Кадр: /tmp/prod-village-669d.png.

## 6. Риски и бэклог

- **Риски:** LFS-квоты GitHub Free (1 ГБ storage/1 ГБ bandwidth/мес) — видео 12.3 МБ, запас есть; если bandwidth исчерпается — видео перестанет отдаваться до 1-го числа (мониторить в будущих QA). `.gitattributes` не раздаётся Pages (dotfile) — некритично.
- **Cron:** webDevReview «ChroniclesRuthenia webDevReview 15m» — cron-инструмент недоступен в текущей сессии; создать при первой возможности (после первого пуша, по приказу владельца).
- **Бэклог далее:** баня/овин (§3.1 interiors.js), сундуки/тайники, погодные переходы сцена→сцена (предложения 66.5), трактовая разбойничья встреча.

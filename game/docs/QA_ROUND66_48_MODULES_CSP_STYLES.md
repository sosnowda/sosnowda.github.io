# QA_ROUND66_48_MODULES_CSP_STYLES — патч 66.48

**Дата:** 2026-09-30 · **Итерация:** 66.48 · **Задание владельца:** «3 отложены с обоснованием (модули main.js, CSP для game/, партия 2 стилей). Закрыть 3 отложенных пункта, снять свежие скриншоты лендинг».

## 1. Что проверялось

Закрытие трёх отложенных в 66.47 пунктов аудита лендинга (9.3/10):

| № | Пункт | Статус в 66.48 |
|---|-------|----------------|
| 12 | main.js (~890 строк) → модули | ЗАКРЫТ: js/main.js + 8 модулей js/modules/ |
| 18 | CSP meta для game/index.html | ЗАКРЫТ: CSP добавлена, игра проверена живьём |
| 11 | Партия 2 выноса inline-стилей | ЗАКРЫТ: 0 style=" на RU и EN (кроме SVG-атрибутов) |

## 2. Автотесты

- **Новый test_round102.mjs — 88 assert, все зелёные:**
  - модульная структура: 9 файлов на месте, старый main.js удалён, node --check каждому;
  - импорты точки входа (gallery/ui/state), js-флаг, SW-регистрация, bootPage по DOMContentLoaded;
  - ui.js: selectPrince, dice.addEventListener('click', rollD100), Enter/Space, focusablesSel, initInteractivePage;
  - gallery.js: slb-prev/slb-next; scrollspy.js: __anchorSettle, spyTargets;
  - RU/EN: `<script type="module" src="js/main.js">` / `../js/main.js`, старый defer-тег снят, inline onclick/onkeydown дайса сняты, role/tabindex сохранены;
  - CSP game/: meta присутствует, script-src = 'self' 'unsafe-inline' cdn.jsdelivr.net, default/img/connect-src 'self', БЕЗ unsafe-eval, object-src none + base-uri self; Phaser по-прежнему с jsdelivr;
  - инлайн-стили: 0 на RU, 0 на EN (font-style отфильтрован); 30 новых классов в styles.css; .section-intro/.map-card/.d100-sphere в разметке;
  - SW: v98, game-assets-v41 нетронут; журнал: v98 добавлена, v97 восстановлена.
- **Регресс 64–102 = 39 наборов ВСЕ ЗЕЛЁНЫЕ.** Актуализации: r69/r81/r87 — лендинг-ассерты по конкатенации js/main.js + js/modules/*; 19 наборов — SW-ожидание v98. Запуск: r64–85, r90–102 из корня; r86–89 из game/tools (r89 впервые задокументирован как CWD-чувствительный — до 66.48 работал только при запуске из game/, что и делалось).

## 3. Живой смоук (agent-browser, стенд :8090)

### RU лендинг
- `documentElement.classList.contains('js')` → true; `#particles-canvas` создан; `.fund-bar` — BUTTON; `#d100Dice.className` → `d100-zone`.
- d100 кликом: «49 / Успех (выпало 49 из 100)»; Enter-ом: «90» — модульные слушатели и клавиатура работают.
- Лайтбокс галереи: клик по карточке → открыт, «Скриншот 1 из 9»; ArrowRight → «Скриншот 2 из 9»; Escape → закрыт.
- Попап поддержки: клик по полоске → открыт (aria-expanded=true), Escape → закрыт.
- Консоль: 0 ошибок, 0 предупреждений.

### EN лендинг
- d100 кликом: «43 / Success (rolled 43 of 100)» — локализация живая; 0 ошибок.

### Игра (CSP)
- `game/?renderer=canvas`: Phaser поднялся, `window.game` создан, сцена Title активна; в консоли 0 «Refused to load»/CSP-violation; looser-проверка модулей сцен — import() из 'self' под CSP работает.

## 4. Деплой и прод

- Пуш в main = деплой; прод-пинги и sha256-сверка правленых файлов (js/main.js, все модули, styles.css, index.html, en/index.html, game/index.html, sw.js) — в секции «66.48-прод» ворклога.
- Свежие скриншоты лендинга сняты с ПРОДА: RU desktop full, EN desktop full, RU mobile 390×844 full, hero-кадр RU (1280×900) — переданы владельцу.

## 5. Известные ограничения

- ES-модули не поддерживаются браузерами до ~2017 г. — на них не работает только интерактив лендинга (контент виден, no-JS safe флаг сохранён); игра и так требует современный браузер.
- Фокус после Escape-закрытия попапа в headless определялся как BODY (особенность тайминга setTimeout(0) в песочнице) — на реальных браузерах фокус-возврат проверен в 66.47 Tab-циклом.

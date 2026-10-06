// test_round103.mjs — 66.50: приказы владельца 1–2.
// 1) СЛОВАРЬ ЛЕНДИНГА: js/modules/l10n.js — единый словарь строк клиента RU/EN;
//    таймлайн князей (подсказка + досье) в словаре, ui.js без inline-тернарников строк.
// 2) РЕЛИЗ: JSON-LD softwareVersion 0.3.0-alpha (RU+EN) под релиз v0.3.0-alpha.
// 3) SW: в 66.50 — site-cache v100, запись v100 в журнале
//    (ассерты ниже отслеживают АКТУАЛЬНУЮ версию: после 66.59 — v104).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v44 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round103.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const l10n = read('js/modules/l10n.js');
const ui = read('js/modules/ui.js');
const ru = read('index.html');
const en = read('en/index.html');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');

console.log('--- 1. Словарь js/modules/l10n.js (приказ 1: таймлайн в EN-словаре) ---');
let syntax = true;
try { execSync('node --check js/modules/l10n.js', { stdio: 'pipe' }); } catch (e) { syntax = false; }
ok(syntax, 'l10n.js: синтаксис валиден (node --check)');
ok(l10n.includes('export const UI_DICT'), 'l10n.js: экспортирует UI_DICT');
ok(l10n.includes('export const STR'), 'l10n.js: экспортирует активную локаль STR');
ok(l10n.includes('ru: {') && l10n.includes('en: {'), 'l10n.js: обе локали ru/en на месте');
ok(l10n.includes('timeline: {'), 'l10n.js: секция timeline в словаре');
// EN-строки таймлайна — приказ «таймлайн в EN-словаре»
ok(l10n.includes('Vasily I Dmitriyevich') && l10n.includes('Vasily II the Dark') && l10n.includes('Ivan III the Great'), 'l10n.js: EN-досье трёх князей');
ok(l10n.includes('Grand Prince 1389–1425') && l10n.includes('Grand Prince 1462–1505'), 'l10n.js: EN-годы княжений');
ok(l10n.includes('Stand on the Ugra, 1480'), 'l10n.js: EN-досье Ивана III (Угра)');
ok(l10n.includes('Select a prince on the ribbon'), 'l10n.js: EN-подсказка таймлайна');
ok(l10n.includes('1 chronicle event highlighted'), 'l10n.js: EN-eventsHit');
ok(l10n.includes('Василий I Дмитриевич') && l10n.includes('Иван III «Великий»'), 'l10n.js: RU-досье на месте');
ok(l10n.includes('d100: {') && l10n.includes('popup: {') && l10n.includes('toast: {'), 'l10n.js: d100/popup/toast тоже в словаре');

console.log('--- 2. ui.js на словаре ---');
ok(ui.includes("import { STR } from './l10n.js'"), "ui.js: импорт STR из './l10n.js'");
ok(ui.includes('const T = STR.timeline') && ui.includes('const DOSIER = T.dosier'), 'ui.js: таймлайн берёт строки из словаря');
ok(ui.includes('const D100_I18N = STR.d100'), 'ui.js: d100 берёт строки из словаря');
ok(!ui.includes('Василий I Дмитриевич') && !ui.includes('Vasily I Dmitriyevich'), 'ui.js: inline-досье удалены');
ok(!ui.includes('Бросаем…') && !ui.includes('Rolling…'), 'ui.js: inline-строки d100 удалены');
ok(ui.includes('function selectPrince'), 'ui.js: selectPrince остался в ui.js');
ok(ui.includes("dice.addEventListener('click', rollD100)"), 'ui.js: d100 слушатели на месте');

console.log('--- 3. Разметка и модульная сборка ---');
ok(ru.includes('id="princesTimeline"') && en.includes('id="princesTimeline"'), 'RU/EN: блок таймлайна на месте');
ok(ru.includes("softwareVersion\":\"0.3.0-alpha"), 'RU: JSON-LD softwareVersion 0.3.0-alpha');
ok(en.includes("softwareVersion\":\"0.3.0-alpha"), 'EN: JSON-LD softwareVersion 0.3.0-alpha');

console.log('--- 4. SW v101 и журнал ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v122';"), 'SW: site-cache v122 (актуализация 66.88) (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; ассерт актуализирован из v111)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'SW: game-assets-v45 не менялся');
ok(swlog.includes('- v101 — итерация 66.53'), 'SW-журнал: запись v101 добавлена');
ok(swlog.includes('- v99 — итерация 66.49'), 'SW-журнал: запись v99 на месте');

console.log('--- 5. CSP игры (66.50: img-src + blob: — прогон 66.50 поймал блокировку текстур) ---');
const gameHtml = read('game/index.html');
ok(gameHtml.includes("img-src 'self' data: blob:"), 'game: CSP img-src допускает blob: (Phaser 3.88 грузит картинки через createObjectURL)');
ok(!gameHtml.includes("img-src 'self' data:;"), 'game: старый img-src без blob: убран');
ok(gameHtml.includes("media-src 'self' blob:"), 'game: media-src blob: на месте (аудио)');
ok(gameHtml.includes("script-src 'self' 'unsafe-inline'"), 'game: script-src без CDN (актуализация 66.64 — P3-4: Phaser самохостится, внешний CDN из CSP убран)');
ok(!gameHtml.includes('cdn.jsdelivr.net'), 'game: jsdelivr не упоминается (актуализация 66.64 — P3-4)');

console.log('\nИтог: ' + pass + ' проверок пройдено, ' + fail + ' провалено');
process.exit(fail ? 1 : 0);

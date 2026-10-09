// test_round104.mjs — 66.52: приказы владельца 1–2.
// 1) СВЕЖИЙ АУДИТ 66.51+ (приказ 1): отчёт docs/AUDIT_R66_52.md в репо —
//    зелёная зона + P2-1..3 / P3-1..4 с рекомендациями.
// 2) EN-ЛОКАЛИЗАЦИЯ ТИТУЛЬНОГО ЭКРАНА (приказ 2, аудит P2-3): бренд-титул
//    «ЛЕТОПИСИ РУСИ» → 'THE CHRONICLES OF RUTHENIA' через словарь i18n
//    (t()), формулы размера под EN-длину в TitleScene и PreloadScene.
//    Меню (Инструкция/Настройки/Об игре/выбор персонажа) уже были
//    локализованы — проверено живыми скриншотами ?lang=en.
// 3) SW: в 66.52 БЕЗ повышения версии — правки только в /game/src/, который
//    SW пропускает напрямую (св. sw.js:70 «сцены обновляются часто»);
//    ассерты ниже отслеживают АКТУАЛЬНУЮ версию: после 66.57 (P3-3 —
//    фолбэк только для navigate) site-cache v104 (актуализация 66.59 — мобильный кегль полосы сбора), game-assets v41.
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v44 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round104.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const i18n = read('game/src/systems/i18n.js');
const title = read('game/src/scenes/TitleScene.js');
const preload = read('game/src/scenes/PreloadScene.js');
const sw = read('sw.js');
const audit = read('docs/AUDIT_R66_52.md');

console.log('--- 1. Словарь i18n: бренд-титул EN (приказ 2) ---');
let syntax = true;
try { execSync('node --check game/src/systems/i18n.js', { stdio: 'pipe' }); } catch (e) { syntax = false; }
ok(syntax, 'i18n.js: синтаксис валиден (node --check)');
ok(i18n.includes("'ЛЕТОПИСИ РУСИ': 'THE CHRONICLES OF RUTHENIA'"), "i18n.js: ключ 'ЛЕТОПИСИ РУСИ' → 'THE CHRONICLES OF RUTHENIA'");
ok(/--- Title ---[\s\S]*'ЛЕТОПИСИ РУСИ'/.test(i18n), 'i18n.js: ключ в секции Title словаря');
ok(i18n.includes("'XV век · Поход за утраченной иконой': '15th century · The quest for the stolen icon'"), 'i18n.js: EN-подзаголовок титула на месте');

console.log('--- 2. TitleScene: бренд через t() + EN-формула размера ---');
syntax = true;
try { execSync('node --check game/src/scenes/TitleScene.js', { stdio: 'pipe' }); } catch (e) { syntax = false; }
ok(syntax, 'TitleScene.js: синтаксис валиден (node --check)');
ok(title.includes("t('ЛЕТОПИСИ РУСИ')"), "TitleScene: бренд через t('ЛЕТОПИСИ РУСИ')");
ok(!title.includes("'ЛЕТОПИСИ РУСИ', {"), 'TitleScene: прямая отрисовка RU-бренда убрана');
ok(title.includes('width / 17'), 'TitleScene: EN-формула размера width/17');
ok(title.includes('Math.max(20, Math.min(52,'), 'TitleScene: EN-кламп [20,52] (без переполнения 320–720px)');
ok(title.includes('Math.max(30, Math.min(66, Math.round(width / 12)))'), 'TitleScene: RU-формула width/12 [30,66] сохранена');

console.log('--- 3. PreloadScene: бренд через t() + EN-формула размера ---');
syntax = true;
try { execSync('node --check game/src/scenes/PreloadScene.js', { stdio: 'pipe' }); } catch (e) { syntax = false; }
ok(syntax, 'PreloadScene.js: синтаксис валиден (node --check)');
ok(preload.includes("import { isEn, t } from '../systems/i18n.js'"), 'PreloadScene: импорт t добавлен');
ok(preload.includes("t('ЛЕТОПИСИ РУСИ')"), "PreloadScene: бренд через t('ЛЕТОПИСИ РУСИ')");
ok(preload.includes('width / 17') && preload.includes('Math.min(48,'), 'PreloadScene: EN-формула width/17, кламп [20,48]');
ok(preload.includes('Math.max(26, Math.min(58, Math.round(width / 13)))'), 'PreloadScene: RU-формула width/13 [26,58] сохранена');

console.log('--- 4. Свежий аудит: отчёт в репо (приказ 1) ---');
ok(audit.includes('# Свежий аудит сайта — состояние 66.51+'), 'AUDIT_R66_52.md: отчёт присутствует');
ok(audit.includes('### P2-1.') && audit.includes('### P2-2.') && audit.includes('### P2-3.'), 'AUDIT: находки P2-1..P2-3 зафиксированы');
ok(audit.includes('### P3-1.') && audit.includes('### P3-4.'), 'AUDIT: находки P3-1..P3-4 зафиксированы');
ok(audit.includes('ВНЕДРЕНО в патче 66.52'), 'AUDIT: пометка о внедрении P2-3 в 66.52');
ok(audit.includes('Находок не несёт') || audit.includes('## Проверено и БЕЗ замечаний'), 'AUDIT: зелёная зона описана');

console.log('--- 5. SW без повышения (правки только /game/src/) ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v126';"), 'sw.js: site-cache v126 (актуализация 66.93) (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 (актуализация 66.87)');
ok(sw.includes("url.pathname.startsWith('/game/src/')"), 'sw.js: /game/src/ пропускается напрямую — сцены всегда свежие');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

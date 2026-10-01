// test_round108.mjs — 66.57: закрытие 4×P3 аудита 66.56 (docs/AUDIT_R66_56.md).
// 1) P3-1 — мёртвый hover бренд-бара: обычный .fund-bar:hover (styles.css:658)
//    всегда перебивался background !important тематического блока (important
//    бьёт обычное объявление независимо от специфичности). Рецепт аудита:
//    парный hover с !important в тематическом блоке, ПОСЛЕ базового (каскад:
//    при равной специфичности+важности побеждает позднее правило).
// 2) P3-2 — CSP на 404-страницах: meta CSP лендингов скопирован в 404.html и
//    en/404.html (защита одинакова на всех обслуживаемых HTML; 'unsafe-inline'
//    сохраняет работу inline-локале-детекта 66.53).
// 3) P3-3 — офлайн-фолбэк SW только для навигаций: catch-ветка network-first
//    отвечает HTML-фолбэком лишь при request.mode === 'navigate'; прочие
//    субресурсы при офлайн-промахе получают честный сетевой отказ
//    (return cached === undefined → естественный reject). Бамп v101→v102.
// 4) P3-4 — процесс lastmod: game/tools/bump_lastmod.py (lastmod = дата
//    последнего коммита, реально трогавшего файлы секции; game/tools и
//    game/docs контентом не считаются, sw.js вне маппинга) + чек-лист пуша
//    в АГЕНТ.md §5; здесь же автоматическая сверка --check.
// Запуск из корня репозитория: node game/tools/test_round108.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const ru404 = read('404.html');
const en404 = read('en/404.html');
const landing = read('index.html');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const audit = read('docs/AUDIT_R66_56.md');
const changes = read('CHANGES.md');
const agent = read('АГЕНТ.md');
const sitemap = read('sitemap.xml');

console.log('--- 1. P3-1: живой hover бренд-бара ---');
// актуализация 66.58: консолидация блоков 657+786 — остался ОДИН hover
// (детали структуры — в r109; рендер бит-в-бит, см. CHANGES 66.58)
// актуализация 66.59: SW-ожидание v103→v104 (мобильный кегль полосы — переезд
// media-правила .fund-bar после канонического блока; детали — в r110)
// актуализация 66.62: hover-стоп #B53925→#A23417 (контраст полоски, P3-1 аудита 66.61 — детали в r112)
const hoverImportant = 'linear-gradient(90deg,#A23417,#8B2C1A) !important';
ok(styles.includes(hoverImportant), 'styles.css: парный hover с !important (#A23417,#8B2C1A — актуализация 66.62) присутствует');
ok((styles.match(/\.fund-bar:hover/g) || []).length === 1, 'styles.css: один .fund-bar:hover (консолидация 66.58: мёртвый 658 снят, остался working-hover)');
const themeBase = styles.indexOf('/* Плашка альфа-версии — выгравированный камень */');
const themeHover = styles.indexOf('.fund-bar:hover{\n  background:linear-gradient(90deg,#A23417,#8B2C1A) !important;');
ok(themeBase !== -1 && themeHover > themeBase, 'styles.css: парный hover ПОСЛЕ тематического блока (каскад: позднее правило побеждает)');
ok(styles.includes('background:linear-gradient(90deg, #6B1F15, #8B2C1A, #6B1F15) !important;'), 'styles.css: базовый фон темы с !important не тронут');
ok(!styles.includes('.fund-bar:hover{background:linear-gradient(90deg,#A23417,#8B2C1A)}') && !styles.includes('.fund-bar:hover{background:linear-gradient(90deg,#B53925,#8B2C1A)}') && (styles.match(/^\.fund-bar\{/gm) || []).length === 1, 'styles.css: консолидация 66.58 — один канонический .fund-bar, мёртвого hover-однострочника нет (66.62 + исторические значения)');

console.log('--- 2. P3-2: CSP на 404-страницах ---');
const cspRe = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/;
const cspLanding = (landing.match(cspRe) || [])[1];
const cspRu404 = (ru404.match(cspRe) || [])[1];
const cspEn404 = (en404.match(cspRe) || [])[1];
ok(!!cspLanding, 'index.html: CSP лендинга извлечён (эталон существует)');
ok(cspRu404 === cspLanding, '404.html: CSP ПОБАЙТОВО равен лендинговому');
ok(cspEn404 === cspLanding, 'en/404.html: CSP ПОБАЙТОВО равен лендинговому');
ok(cspRu404 && cspRu404.includes("script-src 'self' 'unsafe-inline'"), 'CSP: script-src unsafe-inline — inline-детект 66.53 продолжает работать');
ok(cspRu404 && cspRu404.includes("object-src 'none'") && cspRu404.includes("base-uri 'self'"), 'CSP: hardening-директивы (object-src/base-uri) на месте');
ok(ru404.indexOf('Content-Security-Policy') < ru404.indexOf('<style>'), '404.html: CSP объявлен до контента (в head)');
ok(ru404.includes('<meta name="robots" content="noindex">') && en404.includes('<meta name="robots" content="noindex">'), '404-страницы: noindex сохранён на обеих');

console.log('--- 3. P3-3: офлайн-фолбэк только для navigate ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v106';"), 'sw.js: site-cache v106 (актуализация 66.62 — контраст полоски P3-1)');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v41';"), 'sw.js: game-assets остаётся v41 (игровые ассеты не менялись)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: субресурсы при офлайн-промахе — честный отказ (без HTML-фолбэка)');
ok(sw.indexOf("event.request.mode !== 'navigate'") < sw.indexOf("var fb ="), 'sw.js: гейт navigate стоит ПЕРЕД фолбэк-цепочкой');
ok(sw.includes("var fb = url.pathname.indexOf('/game/') === 0 ? '/game/'"), 'sw.js: фолбэк /game/… → кэш /game/ сохранён (66.53)');
ok(sw.includes(": url.pathname.indexOf('/en/') === 0 ? '/en/' : '/index.html';"), 'sw.js: фолбэк /en/… → кэш /en/, остальное → /index.html сохранён');
ok(sw.includes("return cached || caches.match(fb).then(function (m) {"), 'sw.js: цепочка .then (Promise через || не чейнится) сохранена');
ok(sw.includes("return m || caches.match('/');"), "sw.js: второй эшелон '/' сохранён");
ok(sw.includes("url.pathname.startsWith('/game/src/')"), 'sw.js: /game/src/ по-прежнему идёт в обход SW');
ok(sw.includes("url.pathname.startsWith('/game/assets/')"), 'sw.js: /game/assets/ cache-first не тронут');

console.log('--- 4. P3-4: процесс lastmod ---');
ok(fs.existsSync('game/tools/bump_lastmod.py'), 'game/tools/bump_lastmod.py существует');
const gen = read('game/tools/bump_lastmod.py');
ok(gen.includes("'--check'") && gen.includes('SECTIONS'), 'bump_lastmod.py: режимы БАМП/СВЕРКА + маппинг секций');
ok(gen.includes('НЕ считается') && gen.includes('sw.js сознательно вне маппинга'), 'bump_lastmod.py: game/tools/game/docs контентом не считаются, sw.js вне маппинга');
ok(agent.includes('bump_lastmod.py') && agent.includes('ЧЕК-ЛИСТ ПУША'), 'АГЕНТ.md §5: чек-лист пуша с бампом lastmod добавлен');
let checkOk = true, checkOut = '';
try {
    checkOut = execSync('python3 game/tools/bump_lastmod.py --check', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
    checkOk = false;
    checkOut = (e.stdout || '') + (e.stderr || '');
}
ok(checkOk, 'bump_lastmod.py --check: sitemap синхронен фактам git (дрейфа нет)' + (checkOk ? '' : '\n' + checkOut));
ok((sitemap.match(/<url>/g) || []).length === 3 && (sitemap.match(/hreflang=/g) || []).length === 6, 'sitemap: структура цела (3 URL, hreflang 3×2)');

console.log('--- 5. Документация патча ---');
ok(swlog.includes('- v102 — итерация 66.57'), 'SW_CHANGELOG: запись v102 добавлена');
ok(swlog.includes('ТОЛЬКО ДЛЯ НАВИГАЦИЙ') || swlog.includes('navigate'), 'SW_CHANGELOG: описание navigate-гейта');
ok((audit.match(/ВНЕДРЕНО в патче 66\.57/g) || []).length === 4, 'AUDIT_R66_56.md: все 4 находки помечены ВНЕДРЕНО в 66.57');
ok(changes.includes('## Патч 66.57'), 'CHANGES.md: секция «Патч 66.57» добавлена');
ok(changes.includes('P3-1') && changes.includes('P3-2') && changes.includes('P3-3') && changes.includes('P3-4'), 'CHANGES.md: все 4 пункта описаны');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

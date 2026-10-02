// test_round117.mjs — 66.69: ОСТАТОК РЕЕСТРА §9/66.66 — 9×P4 одной итерацией
// (приказ владельца: «1\ остаток реестра — 9×P4 (clip-path в .sr-only, <main>
// на /game/, aria-label логотипа, preload hero и др.)»).
// Состав (по AUDIT_S9_6666.md §8, таблица P4):
//   P4-1 .sr-only: clip deprecated → добавлен компаньон clip-path: inset(50%)
//        (канон W3C/HTML5BP); блок styles.css БИТ-В-БИТ с инлайн-копией
//        game/index.html (инвариант 66.63).
//   P4-2 sw.js: var→const ×5 (L11,12,35,81,96) — no-var §9.2; код SW менялся
//        → бамп v110→v111 по §4 (HTML лендингов/игры + styles.css тоже менялись).
//   P4-3 no-unused-vars: 69→0 по game/src (19 файлов; ESLint v10 flat-config
//        вне репо) — чистые чтения удалены, заводские вызовы Phaser, создающие
//        ВИДИМЫЕ объекты (add.text/add.rectangle ×15), переведены на bare-выражения
//        (рендер бит-в-бит), импорты почищены по именам; каскад: ui.js потерял
//        createRoundRectangle + импорт ROUND_RECTANGLE_DEFAULTS.
//   P4-4 a.logo aria-label (label-content-name-mismatch): RU «Летописи Руси XV
//        века — на главную», EN «Chronicles of Ruthenia — to the main page» —
//        видимый текст логотипа теперь входит в aria-label.
//   P4-5 <main> на /game/: канвас-хост div → main id="game-container" (landmark
//        Lighthouse a11y 94→цель 100; CSS на #game-container не меняется).
//   P4-6 sourcemap phaser.min.js — ПРИНЯТО (решение задокументировано): в pinned
//        файле 0 ссылок sourceMappingURL, официальный npm-дистрибутив карту не
//        поставляет (jsdelivr 404), присоединение потребовало бы правки pinned
//        файла и сломало бы sha256-пин 66.64 (r114) ради DevTools-единственной
//        выгоды. Здесь закреплено: sourceMappingURL в vendor нет.
//   P4-7 third-party cookies Метрики — ПРИНЯТО (информационное; свойство
//        сторонней аналитики, продуктовое решение вне рамок P4).
//   P4-8 REPO в test_98_pixel_probe.py — закрыт ЕЩЁ В 66.67 (Path(__file__),
//        комментарий в файле); здесь пин отсутствия зашитого абсолютного пути.
//   P4-9 preload hero — УЖЕ реализовано (0a73af50, 14.09.2026), рекомендация
//        АУДИТ.md §3 старее прелоада; здесь пин: preload RU/EN цели ровно в
//        первичный кандидат <picture><source srcset=…title.webp> (fetchpriority
//        high), fallback <img src=…title.jpg> цел.
// Здесь закреплена статика всех 9 позиций + SW/доки + живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round117.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const indexRu = read('index.html');
const indexEn = read('en/index.html');
const gameHtml = read('game/index.html');

console.log('--- 1. P4-1: .sr-only — clip-path компаньон, блоки бит-в-бит (инвариант 66.63) ---');
const srBody = src => (src.match(/\.sr-only \{([^}]*)\}/) || [])[1]?.replace(/\s+/g, ' ').trim();
const srCss = srBody(styles);
const srGame = srBody(gameHtml);
ok(!!srCss && !!srGame, '.sr-only найден и в styles.css, и в инлайн-стиле game/index.html');
ok(srCss === srGame, 'тела правил .sr-only БИТ-В-БИТ (styles.css ↔ game/index.html)');
ok(srCss.includes('clip: rect(0, 0, 0, 0)') && srCss.includes('clip-path: inset(50%)'),
    'классический clip сохранён + clip-path: inset(50%) добавлен (канон W3C/HTML5BP)');
ok(styles.indexOf('clip-path: inset(50%)') > styles.indexOf('.sr-only {') &&
   styles.indexOf('clip-path: inset(50%)') < styles.indexOf('/* Скриншоты-галерея'),
    'styles.css: clip-path стоит внутри блока .sr-only');

console.log('--- 2. P4-2: sw.js — var→const ×5, v111, механика не тронута ---');
ok((sw.match(/\bvar\s+[A-Za-z_$]/gm) || []).length === 0, 'sw.js: объявлений var — ноль (no-var §9.2)');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v111';"), 'sw.js: const CACHE_NAME v111 (HTML/CSS менялись → бамп §4)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v42';"), 'sw.js: const GAME_ASSETS_CACHE v42 (ассеты/vendor не тронуты)');
ok(sw.includes("const url = new URL(event.request.url);") &&
   sw.includes("const clone = response.clone();") &&
   sw.includes("const fb = url.pathname.indexOf('/game/') === 0 ? '/game/'"),
    'sw.js: все 5 var переведены на const (L11,12,35,81,96 аудита)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел');
ok(sw.includes("url.pathname.startsWith('/game/assets/') || url.pathname.startsWith('/game/vendor/')"),
    'sw.js: cache-first ветка /game/assets/ + /game/vendor/ (66.64) цел');

console.log('--- 3. P4-3: unused-vars — мёртвые имена не вернулись, синтаксис 19 файлов ---');
ok(!read('game/src/utils/ui.js').includes('function createRoundRectangle'), 'ui.js: createRoundRectangle удалён (потребителей нет)');
ok(!read('game/src/utils/ui.js').includes('ROUND_RECTANGLE_DEFAULTS'), 'ui.js: импорт ROUND_RECTANGLE_DEFAULTS убран (каскад P4-3)');
ok(!read('game/src/scenes/EndScene.js').includes('endType') && !read('game/src/scenes/EndScene.js').includes('getHuntState'),
    'EndScene.js: мёртвый endType (8 присваиваний) и его импорт getHuntState удалены');
ok(!read('game/src/systems/CharacterAppearance.js').includes('LPC_SHEET_COLS') &&
   !read('game/src/systems/CharacterAppearance.js').includes('WALK_FRAMES'),
    'CharacterAppearance.js: неиспользуемые константы LPC-листа удалены (FRAME_SIZE/IDLE_FRAME_IDX живут)');
ok(!read('game/src/scenes/InteriorScene.js').includes('npcSchedules.js') &&
   !read('game/src/scenes/VillageScene.js').includes('npcSchedules.js'),
    'InteriorScene+VillageScene: импорты npcSchedules.js убраны целиком (модуль чистых экспортов, без побочных эффектов)');
ok(read('game/src/systems/WeatherOmens.js').includes("import { getTime, getSeason, MONTHS } from './TimeSystem.js';") &&
   !read('game/src/systems/WeatherOmens.js').includes("from './i18n.js'"),
    'WeatherOmens.js: мёртвый импорт i18n (t, tf) удалён, остальные импорты целы');
const EDITED_19 = [
    'game/src/data/characters.js', 'game/src/data/dialogue.js', 'game/src/data/npcSchedules.js',
    'game/src/data/reputation.js', 'game/src/scenes/LocationScene.js', 'game/src/scenes/InteriorScene.js',
    'game/src/scenes/VillageScene.js', 'game/src/systems/DialogueRunner.js', 'game/src/systems/WeatherOmens.js',
    'game/src/scenes/EndScene.js', 'game/src/main.js', 'game/src/scenes/CharacterScene.js',
    'game/src/scenes/CombatScene.js', 'game/src/scenes/ForestScene.js', 'game/src/scenes/ApiaryScene.js',
    'game/src/systems/CharacterAppearance.js', 'game/src/utils/ui.js', 'game/src/systems/MiniMap.js',
    'game/src/scenes/TitleScene.js',
];
let synOk = true;
for (const f of [...EDITED_19, 'sw.js']) {
    try { execSync('node --check ' + f, { stdio: 'pipe' }); } catch { synOk = false; console.log('    node --check FAIL: ' + f); }
}
ok(synOk, 'node --check: 19 правленых файлов P4-3 + sw.js — синтаксис цел');
ok(read('game/src/main.js').includes('DL.prototype.shutdown = function () {') &&
   !read('game/src/main.js').includes('const origShutdown'),
    'main.js: перехват DisplayList.shutdown работает как прежде (мёртвый origShutdown убран — вызов так и не осуществлялся)');

console.log('--- 4. P4-4: aria-label логотипа содержит видимый текст (обе локали) ---');
ok((indexRu.match(/<a href="#" class="logo" aria-label="([^"]+)">/) || [])[1] === 'Летописи Руси XV века — на главную',
    'RU: aria-label логотипа «Летописи Руси XV века — на главную» (содержит видимый текст)');
ok((indexEn.match(/<a href="#" class="logo" aria-label="([^"]+)">/) || [])[1] === 'Chronicles of Ruthenia — to the main page',
    'EN: aria-label «Chronicles of Ruthenia — to the main page» (содержит видимый текст)');
ok((indexRu.match(/class="logo"/g) || []).length === 1 && (indexEn.match(/class="logo"/g) || []).length === 1,
    'RU+EN: логотип по-прежнему один, href="#" не тронут (поведение не менялось)');

console.log('--- 5. P4-5: <main id="game-container"> — landmark канвас-хоста ---');
ok((gameHtml.match(/<main id="game-container">/g) || []).length === 1, 'game/index.html: ровно один <main id="game-container">');
ok(!gameHtml.includes('<div id="game-container">'), 'game/index.html: прежнего <div id="game-container"> больше нет');
ok(gameHtml.trimEnd().includes('</main>'), 'game/index.html: закрывающий </main> на месте');
const iH1 = gameHtml.indexOf('<h1 class="sr-only">'), iMain = gameHtml.indexOf('<main id="game-container">'), iBody = gameHtml.indexOf('<body>');
ok(iBody > -1 && iH1 > iBody && iH1 < iMain, 'игра: H1 — первый элемент body, до #game-container (инвариант r113 цел)');
ok(read('game/src/main.js').includes("parent: 'game-container'"), "Phaser parent: 'game-container' не менялся (id-пин)");

console.log('--- 6. P4-6/P4-8: vendor без sourcemap-ссылок; r98 без зашитого пути ---');
ok(!read('game/vendor/phaser.min.js').includes('sourceMappingURL'), 'vendor/phaser.min.js: ссылок на sourcemap нет (решение P4-6 «принято» закреплено)');
ok(!read('game/tools/test_98_pixel_probe.py').includes('/home/z/'), 'test_98_pixel_probe.py: зашитых абсолютных путей нет (P4-8, закрыт в 66.67, Path(__file__))');

console.log('--- 7. P4-9: preload hero — цели ровно в первичный кандидат <picture> ---');
for (const [html, locale, pre, preLow] of [
    [indexRu, 'RU', '<link rel="preload" href="assets/images/title.webp" as="image" fetchpriority="high">', '<link rel="preload" href="assets/screenshots/01-title.webp" as="image" fetchpriority="low">'],
    [indexEn, 'EN', '<link rel="preload" href="../assets/images/title.webp" as="image" fetchpriority="high">', '<link rel="preload" href="../assets/screenshots/01-title.webp" as="image" fetchpriority="low">'],
]) {
    ok(html.includes(pre), `${locale}: preload hero (title.webp, fetchpriority=high) на месте`);
    ok(html.includes(preLow), `${locale}: low-приоритетный preload карточки меню на месте (не спорит с hero)`);
    const srcset = (html.match(/<source srcset="([^"]+)" type="image\/webp">/) || [])[1];
    const href = (html.match(/rel="preload" href="([^"]+)" as="image" fetchpriority="high">/) || [])[1];
    ok(!!srcset && srcset === href, `${locale}: preload href === первичный кандидат <source srcset> («${href}») — двойной загрузки нет`);
    ok(html.includes(`class="hero-image" width="1920" height="1097" fetchpriority="high">`) && html.includes(`.jpg" alt=`),
        `${locale}: fallback <img> (title.jpg, размеры-инвариант CLS=0) цел`);
}

console.log('--- 8. SW/доки/lastmod (§4/§7/§8) ---');
ok(swlog.includes('- v111 — итерация 66.69'), 'SW_CHANGELOG: запись v111 добавлена');
ok(changes.includes('66.69'), 'CHANGES.md: секция патча 66.69 добавлена');
let lastmodSync = false;
try { execSync('python3 game/tools/bump_lastmod.py --check', { stdio: 'pipe' }); lastmodSync = true; } catch {}
ok(lastmodSync, 'bump_lastmod --check: git ↔ sitemap СИНХРОН (живой прогон)');

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

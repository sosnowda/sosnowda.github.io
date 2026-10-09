// test_round133.mjs — 66.91: P3-хвост внешнего аудита лендинга (правки сразу в main).
// Состав патча:
//   1) МЁРТВЫЕ АССЕТЫ УДАЛЕНЫ: assets/images/maps/{herberstein_1550,vida_lyatsky_1542}.avif
//      (854 КБ; AVIF-варианты исторических карт пережили свой <source> — ссылок в
//      разметке/JS/тестах нет) + assets/images/title.jpg (2 МБ, JPEG-фолбэк героя).
//      ПОПРАВКА К АУДИТУ: og-demo.jpg — НЕ мёртвый (og:image игры) — пин-щит здесь.
//   2) JPEG-ФОЛБЭК ГЕРОЯ: новый assets/images/title-1280.jpg (1280×731 q82, ~137 КБ)
//      — фолбэк <img> в <picture> RU+EN; width/height 1920×1097 не тронуты (CLS=0);
//      webp-srcset/preload 66.90 не тронуты.
//   3) JSON-LD RU: + "inLanguage":["ru","en"] (EN/игра уже имели).
//   4) CSS2-ЛИНК RU+EN: курсивный PT Serif (1,400) снят — курсив лендинга рендерит
//      системный шрифт; PT Serif 400/700 цел, PT Sans 66.64 цел.
//   5) ARIA-HIDDEN EMOJI: декоративные emoji RU+EN (fund-bar, альфа-баннер,
//      feature-icon ×9, 🏗️ в h3, кнопки запуска/поддержки/копирования/беты)
//      обёрнуты в <span aria-hidden="true"> — скринридер не озвучивает глифы.
//   6) ARIA-LABEL БУРГЕРА: синхронизация с aria-expanded «Открыть меню»↔«Закрыть
//      меню» (ui.js syncMenuAria + словарь l10n.js menu.open/close RU/EN).
//   7) SW v123→v124 (HTML RU+EN + js/modules; сайт network-first, прекеша нет);
//      game-assets-v45 цел; доки (CHANGES/SW_CHANGELOG/worklog) + bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round133.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const read = p => fs.readFileSync(p, 'utf-8');
const exists = p => fs.existsSync(p);
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const indexRu = read('index.html');
const indexEn = read('en/index.html');
const gameHtml = read('game/index.html');
const l10n = read('js/modules/l10n.js');
const ui = read('js/modules/ui.js');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');

console.log('--- 1. Мёртвые ассеты удалены; og-demo.jpg жив (поправка к аудиту) ---');
ok(!exists('assets/images/maps/herberstein_1550.avif'), 'assets/images/maps/herberstein_1550.avif удалён (854 КБ пара AVIF)');
ok(!exists('assets/images/maps/vida_lyatsky_1542.avif'), 'assets/images/maps/vida_lyatsky_1542.avif удалён');
ok(!exists('assets/images/title.jpg'), 'assets/images/title.jpg (2 МБ) удалён — фолбэк полегчал');
const avifRefs = [indexRu, indexEn, gameHtml].filter(h => h.includes('.avif')).length;
ok(avifRefs === 0, 'RU+EN+game HTML: ссылок на .avif ноль');
const jsDir = 'js/modules';
const jsRefs = [read('js/main.js'), ...fs.readdirSync(jsDir).map(f => read(path.join(jsDir, f)))]
    .filter(s => s.includes('.avif')).length;
ok(jsRefs === 0, 'js/main.js + js/modules: ссылок на .avif ноль');
ok(exists('assets/images/og-demo.jpg'), 'og-demo.jpg цел — ПОПРАВКА К АУДИТУ: живой og:image игры, не мёртвый');
ok(gameHtml.includes('og:image" content="https://sosnowda.github.io/assets/images/og-demo.jpg"') &&
   gameHtml.includes('twitter:image" content="https://sosnowda.github.io/assets/images/og-demo.jpg"'),
   'game/index.html: og:image/twitter:image → og-demo.jpg (пин-щит от будущих «чисток»)');

console.log('--- 2. JPEG-фолбэк героя title-1280.jpg (RU+EN), CLS=0 цел ---');
ok(exists('assets/images/title-1280.jpg'), 'assets/images/title-1280.jpg существует');
const jpeg = fs.readFileSync('assets/images/title-1280.jpg');
ok(jpeg[0] === 0xFF && jpeg[1] === 0xD8 && jpeg[2] === 0xFF, 'title-1280.jpg — JPEG-сигнатура (FFD8FF)');
ok(jpeg.length > 50 * 1024 && jpeg.length < 300 * 1024,
   `title-1280.jpg вес ${Math.round(jpeg.length / 1024)} КиБ в рамке 50–300 (было 2000)`);
for (const [html, locale, base] of [[indexRu, 'RU', 'assets/images'], [indexEn, 'EN', '../assets/images']]) {
    ok(html.includes(`src="${base}/title-1280.jpg" alt=`), `${locale}: фолбэк <img> src → title-1280.jpg`);
    ok(!html.includes('title.jpg"'), `${locale}: прямых ссылок на title.jpg больше нет`);
    ok(html.includes('class="hero-image" width="1920" height="1097" fetchpriority="high">'),
        `${locale}: размеры-инвариант 1920×1097 + fetchpriority не тронуты (CLS=0)`);
}
ok(indexRu.includes('title-480.webp 480w') && indexEn.includes('../assets/images/title-480.webp 480w') &&
   indexRu.includes('imagesrcset=') && indexEn.includes('imagesrcset='),
   'RU+EN: webp-srcset/imagesrcset 66.90 не тронуты (современные UA не затронуты)');

console.log('--- 3. JSON-LD inLanguage (RU добавлен, EN/игра целы) ---');
ok(indexRu.includes('"inLanguage":["ru","en"]'), 'RU: JSON-LD + inLanguage ["ru","en"]');
ok(indexEn.includes('"inLanguage":["en","ru"]'), 'EN: JSON-LD inLanguage ["en","ru"] цел');
ok(gameHtml.includes('"inLanguage":["ru","en"]'), 'game: JSON-LD inLanguage цел');

console.log('--- 4. CSS2-линк без курсивного PT Serif (RU+EN) ---');
for (const [html, locale] of [[indexRu, 'RU'], [indexEn, 'EN']]) {
    ok(!html.includes('PT+Serif:ital'), `${locale}: ital-ось PT Serif снята с css2-линка`);
    ok(html.includes('family=PT+Serif:wght@400;700'), `${locale}: PT Serif 400/700 цел`);
    ok(html.includes('family=PT+Sans:wght@400;700'), `${locale}: PT Sans 66.64 цел (регресса нет)`);
}
ok(read('styles.css').includes("font-family:'PT Serif',serif"), 'styles.css: потребители PT Serif на месте');

console.log('--- 5. Декоративные emoji под aria-hidden (RU+EN ×2 локали) ---');
for (const [html, locale, texts] of [
    [indexRu, 'RU', { fund: '<span aria-hidden="true">💰</span> Сбор средств', alpha: '<span aria-hidden="true">⚔️</span> Игра находится',
        h3: '<h3><span aria-hidden="true">🏗️</span> Архитектура', start: '<span aria-hidden="true">⚔️</span> Запустить игру',
        boosty: '<span aria-hidden="true">🚀</span> Boosty', yoomoney: '<span aria-hidden="true">💰</span> ЮMoney',
        vk: '<span aria-hidden="true">👥</span> ВКонтакте', copy: '<span aria-hidden="true">📋</span> Копировать',
        beta: '<span aria-hidden="true">🔒</span> Код закрыт' }],
    [indexEn, 'EN', { fund: '<span aria-hidden="true">💰</span> Fundraising', alpha: '<span aria-hidden="true">⚔️</span> The game is in Alpha',
        h3: '<h3><span aria-hidden="true">🏗️</span> Project architecture', start: '<span aria-hidden="true">⚔️</span> Launch the game',
        boosty: '<span aria-hidden="true">🚀</span> Boosty', yoomoney: '<span aria-hidden="true">💰</span> YuMoney',
        vk: '<span aria-hidden="true">👥</span> VKontakte', copy: '<span aria-hidden="true">📋</span> Copy',
        beta: '<span aria-hidden="true">🔒</span> Closed code' }],
]) {
    ok(html.includes(texts.fund), `${locale}: 💰 полоски сбора под aria-hidden`);
    ok(html.includes(texts.alpha), `${locale}: ⚔️ альфа-баннера под aria-hidden`);
    ok((html.match(/class="feature-icon">/g) || []).length === 0, `${locale}: feature-icon без aria-hidden — ноль`);
    ok((html.match(/class="feature-icon" aria-hidden="true">/g) || []).length === 9, `${locale}: feature-icon ×9 под aria-hidden`);
    ok(html.includes(texts.h3), `${locale}: 🏗️ в h3 под aria-hidden`);
    ok(html.includes(texts.start), `${locale}: ⚔️ кнопки запуска под aria-hidden`);
    ok(html.includes(texts.boosty) && html.includes(texts.yoomoney) && html.includes(texts.vk),
        `${locale}: 🚀/💰/👥 кнопок поддержки под aria-hidden`);
    ok(html.includes(texts.copy) && html.includes(texts.beta), `${locale}: 📋/🔒 копирования и беты под aria-hidden`);
}

console.log('--- 6. aria-label бургера живёт в такт aria-expanded ---');
ok(l10n.includes("menu: { open: 'Открыть меню', close: 'Закрыть меню' }"), 'l10n.js RU: menu.open/close в словаре');
ok(l10n.includes("menu: { open: 'Open menu', close: 'Close menu' }"), 'l10n.js EN: menu.open/close в словаре');
ok(ui.includes('const syncMenuAria') && ui.includes('STR.menu.close') && ui.includes('STR.menu.open'),
   'ui.js: syncMenuAria синхронизирует label со STR.menu');
ok((ui.match(/syncMenuAria\(\);/g) || []).length === 3, 'ui.js: syncMenuAria вызывается на старте, клике и закрытии ×3');
ok(indexRu.includes('aria-label="Открыть меню"') && indexEn.includes('aria-label="Open menu"'),
   'RU+EN: статичная разметка-фолбэк целa (no-JS)');

console.log('--- 7. SW v124 + доки + sitemap ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v127';"), 'sw.js: site-cache v127 (66.94 актуализация)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 цел (ассеты игры не тронуты)');
ok(swlog.includes('- v124 —'), 'SW_CHANGELOG: запись v124 добавлена');
ok(changes.includes('## Патч 66.91'), 'CHANGES.md: секция патча 66.91 добавлена');
ok(worklog.includes('Task ID: 66.91'), 'worklog: запись 66.91 добавлена');
let lastmodSync = false;
try { execSync('python3 game/tools/bump_lastmod.py --check', { stdio: 'pipe' }); lastmodSync = true; } catch {}
ok(lastmodSync, 'bump_lastmod --check: git ↔ sitemap СИНХРОН (живой прогон)');

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

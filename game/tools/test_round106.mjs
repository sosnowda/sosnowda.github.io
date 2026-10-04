// test_round106.mjs — 66.54: приказы владельца 1–2 (остатки аудита 66.52).
// 1) P3-1 — sitemap lastmod обновлён: / и /en/ → 2026-10-01 (правки лендингов),
//    /game/ → 2026-09-30 (66.52 — последние правки игровых сцен).
// 2) P3-2 — ленмарк <main id="main-content"> на RU+EN. БОНУС-ФИКС: skip-link
//    указывал на #main-content, но такого id на странице НЕ БЫЛО (цель якоря
//    отсутствовала) — теперь <main> несёт id, skip-link работает.
// 3) P3-3 — EN-манифест: en/manifest.json (name/short_name/description EN,
//    lang=en, start_url /en/, scope /, иконки АБСОЛЮТНЫЕ — относительные
//    резолвились бы от /en/manifest.json и 404) + link в en/index.html;
//    в RU-манифест явно добавлен scope "/" (дефолт совпадает, теперь явно).
// 4) В 66.54 SW БЫЛ без бампа (правки лендингов при неизменном sw.js);
//    актуализация 66.59: site-cache v104 (мобильный кегль полосы; в 66.58 был v103 — консолидация styles.css).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v43 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round106.mjs
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const ru = read('index.html');
const en = read('en/index.html');
const sitemap = read('sitemap.xml');
const sw = read('sw.js');
let manRu = {}, manEn = {};
try { manRu = JSON.parse(read('manifest.json')); manOkRu = true; } catch (e) { var manOkRu = false; }
try { manEn = JSON.parse(read('en/manifest.json')); manOkEn = true; } catch (e) { var manOkEn = false; }

console.log('--- 1. P3-2: ленмарк <main> на обеих версиях ---');
for (const [name, html] of [['RU', ru], ['EN', en]]) {
    ok((html.match(/<main id="main-content">/g) || []).length === 1, `${name}: ровно один <main id="main-content">`);
    ok((html.match(/<\/main>/g) || []).length === 1, `${name}: ровно один </main>`);
    ok(html.indexOf('<main id="main-content">') > html.indexOf('</header>'), `${name}: main открывается после </header>`);
    ok(html.indexOf('</main>') < html.indexOf('<footer class="footer">'), `${name}: main закрывается до <footer>`);
    ok(html.includes('href="#main-content"'), `${name}: skip-link на месте`);
    ok(html.includes('id="main-content"'), `${name}: цель skip-link теперь СУЩЕСТВУЕТ (была битая ссылка)`);
    ok(html.indexOf('<main id="main-content">') < html.indexOf('<section class="hero">'), `${name}: hero внутри main`);
}

console.log('--- 2. P3-3: EN-манифест ---');
ok(manOkRu && manOkEn, 'manifest.json и en/manifest.json — валидный JSON');
ok(manEn.lang === 'en', 'en/manifest: lang="en"');
ok(/^[A-Za-z0-9 '’—-]+$/.test(manEn.name) && manEn.name.includes('The Chronicles of Ruthenia'), 'en/manifest: name EN без кириллицы');
ok(/^[A-Za-z0-9 '’-]+$/.test(manEn.short_name), 'en/manifest: short_name EN');
ok(!manEn.description.includes('про историческую'), 'en/manifest: description переведён');
ok(manEn.start_url === '/en/' && manEn.scope === '/', 'en/manifest: start_url /en/ + scope /');
ok(manEn.icons.every(i => i.src.startsWith('/')), 'en/manifest: иконки АБСОЛЮТНЫЕ (относительные резолвились бы от /en/ и 404)');
ok(manRu.lang === 'ru' && manRu.start_url === '/' && manRu.scope === '/', 'RU-манифест: контент не тронут + явный scope "/"');
ok(en.includes('<link rel="manifest" href="/en/manifest.json">'), 'en/index.html: link на EN-манифест');
ok(ru.includes('<link rel="manifest" href="manifest.json">'), 'index.html: link на RU-манифест сохранён');
ok(manRu.icons.every(i => !i.src.startsWith('/') && !i.src.startsWith('.')), 'RU-манифест: относительные иконки сохранены (резолв от /manifest.json — корректно)');

console.log('--- 3. P3-1: sitemap lastmod ---');
// актуализация 66.64: пины абсолютных дат (2×10-01 + 09-30) устаревали на КАЖДОЙ
// итерации с бампом lastmod — 66.63 прошла регресс ДО amend с bump_lastmod и
// оставила эти ассерты устаревшими незаметно. Теперь здесь инварианты (3 lastmod,
// ISO-формат, пол 2026-10-01), а синхронность git-фактов ↔ sitemap живьём проверяет
// bump_lastmod --check (r108/r114) — единственный источник истины по датам.
ok((sitemap.match(/<url>/g) || []).length === 3, 'sitemap: 3 URL (/, /en/, /game/)');
ok(sitemap.includes('<loc>https://sosnowda.github.io/</loc>') && sitemap.includes('<loc>https://sosnowda.github.io/en/</loc>'), 'sitemap: оба лендинга в списке');
{
    const mods = sitemap.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g) || [];
    ok(mods.length === 3, `sitemap: 3 lastmod (фактически ${mods.length})`);
    ok(mods.every(m => m >= '<lastmod>2026-10-01'), 'sitemap: каждая lastmod не старше пола 2026-10-01 (эпоха аудита 66.56+)');
}
ok((sitemap.match(/hreflang=/g) || []).length === 6, 'sitemap: hreflang-альтернаты целы (3×2)');
ok(!sitemap.includes('2026-09-27'), 'sitemap: устаревшая дата 2026-09-27 исчезла');

console.log('--- 4. SW без бампа ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v119';"), 'sw.js: site-cache v112 (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v43';"), 'sw.js: game-assets-v43 (сообщение ассерта актуализировано 66.64)');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

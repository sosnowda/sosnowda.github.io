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
// 4) SW БЕЗ бампа: sw.js не менялся (v101), network-first подхватывает новые
//    файлы сам; en/manifest.json кэшируется при первом визите.
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
ok((sitemap.match(/<url>/g) || []).length === 3, 'sitemap: 3 URL (/, /en/, /game/)');
ok(sitemap.includes('<loc>https://sosnowda.github.io/</loc>') && sitemap.includes('<loc>https://sosnowda.github.io/en/</loc>'), 'sitemap: оба лендинга в списке');
ok((sitemap.match(/<lastmod>2026-10-01<\/lastmod>/g) || []).length === 2, 'sitemap: лендинги lastmod 2026-10-01 (правки 66.54)');
ok(sitemap.includes('<lastmod>2026-09-30</lastmod>'), 'sitemap: /game/ lastmod 2026-09-30 (66.52 — сцены)');
ok((sitemap.match(/hreflang=/g) || []).length === 6, 'sitemap: hreflang-альтернаты целы (3×2)');
ok(!sitemap.includes('2026-09-27'), 'sitemap: устаревшая дата 2026-09-27 исчезла');

console.log('--- 4. SW без бампа ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v101';"), 'sw.js: v101 сохранён (код SW не менялся)');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v41';"), 'sw.js: game-assets v41');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

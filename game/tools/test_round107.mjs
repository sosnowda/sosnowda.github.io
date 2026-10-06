// test_round107.mjs — 66.55: косметика P3-4 (аудит 66.52) — пустые src у
// img-заготовок. Два места: шаблон лайтбокса исторических карт
// (js/modules/lightbox.js) и шаблон лайтбокса скриншотов (js/modules/gallery.js).
// Фикс по рецепту аудита: img больше не сидит в innerHTML-шаблоне с пустым
// src — создаётся через createElement (БЕЗ атрибута src вовсе), реальный
// src/alt выставляют функции открытия (openLightbox / slbShow). Порядок DOM
// и поведение лайтбоксов не изменены (img — первым ребёнком контейнера /
// перед figcaption; инлайн-стили перенесены как были).
// SW бампнут в 66.57 (P3-3 — фолбэк только navigate): site-cache v101→v102;
// здесь секция 4 актуализирована под v104 (66.59 — мобильный кегль полосы; запись журнала — см. r109).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v44 без изменений (детали в r115)
// актуализация 66.68: SW-ожидания v109→v110; P3 аудита §9/66.66 — дубли i18n ×18 (i18n.js), покадровые Vector2 ×3 сцены, W3C-кодирование URL ×3 (HTML страниц → бамп), game-assets-v44 без изменений (детали в r116)
// Запуск из корня репозитория: node game/tools/test_round107.mjs
import fs from 'fs';
import path from 'path';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const lb = read('js/modules/lightbox.js');
const gl = read('js/modules/gallery.js');
const sw = read('sw.js');
const swLog = read('docs/SW_CHANGELOG.md');
const audit = read('docs/AUDIT_R66_52.md');
const changes = read('CHANGES.md');

console.log('--- 1. P3-4: лайтбокс карт (lightbox.js) ---');
ok(!lb.includes('src=""') && !lb.includes("src=''"), 'lightbox.js: ни одного пустого src в файле');
ok(!/<img\s/.test(lb), 'lightbox.js: в innerHTML-шаблоне нет img вовсе');
ok(lb.includes("document.createElement('img')"), 'lightbox.js: img создаётся программно');
ok(lb.includes('lightbox.insertBefore(lbImg, lightbox.firstChild)'), 'lightbox.js: img — первым ребёнком контейнера (порядок DOM прежний)');
ok(lb.includes("lbImg.style.cssText = 'max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);'"), 'lightbox.js: инлайн-стили img перенесены без изменений');
ok(/function openLightbox\(src, alt\)/.test(lb) && lb.includes('lbImg.src = src;') && lb.includes('lbImg.alt = alt;'), 'lightbox.js: src/alt выставляет openLightbox() (рецепт аудита)');
ok(lb.includes("lbClose = lightbox.querySelector('.mlb-close')"), 'lightbox.js: кнопка закрытия ищется как прежде');
ok(lb.includes('66.55'), 'lightbox.js: шапка-комментарий 66.55 на месте');

console.log('--- 2. P3-4: лайтбокс скриншотов (gallery.js) ---');
ok(!gl.includes('src=""') && !gl.includes("src=''"), 'gallery.js: ни одного пустого src в файле');
ok(!/<img\s/.test(gl), 'gallery.js: в innerHTML-шаблоне нет img вовсе');
ok(gl.includes("document.createElement('img')"), 'gallery.js: img создаётся программно');
ok(gl.includes("slb.querySelector('.slb-figure').insertBefore(slbImg, slb.querySelector('.slb-caption'))"), 'gallery.js: img вставлен перед подписью (порядок DOM прежний)');
ok(/slbImg\.src = card\.getAttribute\('data-src'\)/.test(gl), 'gallery.js: src выставляет slbShow() из data-src карточки (рецепт аудита)');
ok(gl.includes("slbImg.alt = (card.querySelector('img') && card.querySelector('img').alt) || '';"), 'gallery.js: alt берётся из карточки как прежде');
ok(gl.includes('<figcaption class="slb-caption"></figcaption>') && gl.includes('class="slb-counter"'), 'gallery.js: остальные части шаблона (figcaption/counter/кнопки) целы');
ok(gl.includes('66.55'), 'gallery.js: шапка-комментарий 66.55 на месте');

console.log('--- 3. Чистота репо: img-заготовок с пустым src больше нет ---');
let dirty = [];
for (const f of ['index.html', 'en/index.html', '404.html', 'en/404.html', 'game/index.html']) {
    if (read(f).includes('src=""')) dirty.push(f);
}
for (const f of fs.readdirSync('js/modules')) {
    if (f.endsWith('.js') && read(path.join('js/modules', f)).includes('src=""')) dirty.push('js/modules/' + f);
}
ok(dirty.length === 0, 'лендинги и все js/modules: пустых src нет' + (dirty.length ? ' (нарушители: ' + dirty.join(', ') + ')' : ''));
ok(lb.includes('export function initMapLightbox') && gl.includes('export function initGallery'), 'обе init-функции экспортируются как прежде');
const mainJs = read('js/main.js');
ok(mainJs.includes('initMapLightbox') && mainJs.includes('initGallery'), 'main.js: импорты и вызовы обоих модулей сохранены');

console.log('--- 4. SW v103 (бамп 66.58 — консолидация styles.css; в 66.57 был v102 под P3-3) ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v122';"), 'sw.js: v122 (актуализация 66.88 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets v45');
// 66.57 (актуализация: в 66.55 ассерты запрещали запись v102 — теперь она ожидаема)
ok(swLog.includes('- v102 — итерация 66.57'), 'SW_CHANGELOG: запись v102 добавлена (66.57)');
ok(swLog.includes('- v101'), 'SW_CHANGELOG: историческая запись v101 на месте');

console.log('--- 5. Документация ---');
ok(audit.includes('ВНЕДРЕНО в патче 66.55'), 'AUDIT_R66_52.md: P3-4 помечен ВНЕДРЕНО в 66.55');
ok(changes.includes('Патч 66.55') && changes.includes('P3-4'), 'CHANGES.md: запись о патче 66.55 с описанием P3-4');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

// test_round105.mjs — 66.53: приказы владельца 1–2 (закрытие находок аудита 66.52).
// 1) P2-1 — ОФЛАЙН-ФОЛБЭК SW ПО РАЗДЕЛАМ: network-first catch более не отдаёт
//    всем '/index.html' — /game/… → кэш '/game/', /en/… → кэш '/en/', остальное
//    → '/index.html' + второй эшелон '/'. Бамп site-cache v100→v101.
// 2) P2-2 — EN-404: en/404.html переведён полностью (титул/заголовок/текст/
//    кнопки); корневой 404.html получил локале-детект /^\/en(\/|$)/ — GitHub
//    Pages отдаёт корневой файл на ЛЮБОЙ отсутствующий путь, включая /en/…
//    (проверено curl'ом прода), поэтому EN-тексты подменяются на лету.
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v44 без изменений (детали в r115)
// актуализация 66.68: SW-ожидания v109→v110; P3 аудита §9/66.66 — дубли i18n ×18 (i18n.js), покадровые Vector2 ×3 сцены, W3C-кодирование URL ×3 (HTML страниц → бамп), game-assets-v44 без изменений (детали в r116)
// актуализация 66.69: SW-ожидания v110→v111; P4 аудита §9/66.66 — остаток реестра ×9 (sr-only clip-path, var→const sw.js, unused-vars ×21 файл, aria-label логотипа, <main> на /game/, sourcemap/preload-решения; детали в r117)
// Запуск из корня репозитория: node game/tools/test_round105.mjs
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const sw = read('sw.js');
const en404 = read('en/404.html');
const ru404 = read('404.html');
const swlog = read('docs/SW_CHANGELOG.md');
const audit = read('docs/AUDIT_R66_52.md');

console.log('--- 1. P2-1: офлайн-фолбэк по разделам ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v128';"), 'sw.js: site-cache v128 (актуализация 66.95) (актуализация 66.70 — аудит владельца 66.70: onclick/keywords/fetchpriority сняты, webvitals.js; ассерт актуализирован из v111)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 (актуализация 66.87) (игровые ассеты не менялись)');
ok(sw.includes("const fb = url.pathname.indexOf('/game/') === 0 ? '/game/'"), 'sw.js: фолбэк /game/… → кэш /game/');
ok(sw.includes(": url.pathname.indexOf('/en/') === 0 ? '/en/' : '/index.html';"), 'sw.js: фолбэк /en/… → кэш /en/, остальное → /index.html');
ok(sw.includes("return cached || caches.match(fb).then(function (m) {"), 'sw.js: фолбэк-цепочка через .then (Promise нельзя чейнить через || — ловлено живым офлайн-тестом)');
ok(sw.includes("return m || caches.match('/');"), "sw.js: второй эшелон '/' (ключ /index.html возникает редко)");
// 66.57 (актуализация: в sw.js добавлен navigate-гейт P3-3 ПЕРЕД фолбэком —
//    event.request.mode теперь стоит раньше комментария фолбэка; привязка
//    к network-first-ветке проверяется относительно метки 'network-first')
ok(sw.indexOf('Офлайн-фолбэк по разделам') !== -1 && sw.indexOf('Офлайн-фолбэк по разделам') > sw.indexOf('network-first'), 'sw.js: фолбэк внутри network-first ветки catch');
ok(!/catch[\s\S]*?return cached \|\| caches\.match\('\/index\.html'\);\s*\}\);?\s*\}\)\s*\);?\s*\}\);/.test(sw.slice(sw.lastIndexOf('network-first'))), 'sw.js: старый безусловный фолбэк /index.html удалён');

console.log('--- 2. P2-2: EN-404 (en/404.html) ---');
ok(en404.includes('<html lang="en">'), 'en/404.html: lang="en"');
ok(en404.includes('<title>404 — The scroll is lost | The Chronicles of Ruthenia</title>'), 'en/404.html: EN-титул');
ok(en404.includes('<h1>The scroll is lost</h1>'), 'en/404.html: EN-заголовок');
ok(en404.includes('has vanished from the chronicles'), 'en/404.html: EN-текст свитка');
ok(en404.includes('← Back to the front page'), 'en/404.html: EN-кнопка «на главную»');
ok(en404.includes('Play the demo'), 'en/404.html: EN-кнопка демо');
ok(!en404.includes('Свиток утерян') && !en404.includes('На главную'), 'en/404.html: русских строк не осталось');

console.log('--- 3. P2-2: локале-детект в корневом 404.html ---');
ok(ru404.includes('<html lang="ru">'), '404.html: RU по умолчанию');
ok(ru404.includes("<h1>Свиток утерян</h1>") && ru404.includes('← На главную'), '404.html: RU-тексты сохранены для корня');
ok(ru404.includes("/^\\/en(\\/|$)/.test(location.pathname)"), '404.html: детект /en и /en/… (без ложных срабатываний на /english-…)');
ok(ru404.includes("document.documentElement.lang = 'en';"), '404.html: подмена lang (скринридеры)');
ok(ru404.includes("document.title = '404 — The scroll is lost | The Chronicles of Ruthenia';"), '404.html: подмена титула');
ok(ru404.includes("'The scroll is lost'") && ru404.includes('has vanished from the chronicles'), '404.html: EN-заголовок и текст в скрипте подмены');
ok(ru404.includes("'← Back to the front page'") && ru404.includes("'Play the demo"), '404.html: EN-обе кнопки в скрипте подмены');
ok(ru404.includes('<meta name="robots" content="noindex">'), '404.html: noindex сохранён');

console.log('--- 4. Журнал SW и отчёт аудита ---');
ok(swlog.includes('- v101 — итерация 66.53'), 'SW_CHANGELOG: запись v101 добавлена');
ok(swlog.includes('ОФЛАЙН-ФОЛБЭК ПО РАЗДЕЛАМ'), 'SW_CHANGELOG: описание фолбэка по разделам');
ok(audit.includes('ВНЕДРЕНО в патче 66.53 (приказ владельца №1'), 'AUDIT: P2-1 помечен внедрённым в 66.53');
ok(audit.includes('ВНЕДРЕНО в патче 66.53 (приказ владельца №2'), 'AUDIT: P2-2 помечен внедрённым в 66.53');
ok(audit.includes('GitHub Pages отдаёт\nна /en/…-пути корневой 404.html'), 'AUDIT: уточнение про отдачу корневого 404 зафиксировано');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

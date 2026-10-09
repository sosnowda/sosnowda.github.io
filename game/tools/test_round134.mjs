// test_round134.mjs — 66.92: реестр аудита 66.88 (PF-1 + PF-4 + находка замера Lighthouse).
// Состав патча:
//   1) PF-1 (P2): game/index.html — регистрация '/sw.js' (guard + catch) — прямые
//      посетители игры получают SW; маршруты /game/assets/+/game/vendor/ (cache-first,
//      game-assets-v45) готовы с 66.64; повторный визит игры из кэша (было ~21–38 МиБ,
//      замер 66.88: визит 2 = снова 1407 запросов).
//   2) Находка замера Lighthouse до/после: постер промо-видео был title.webp 1920px
//      (188 КиБ) — двойная загрузка героя поверх srcset 66.90; теперь
//      title-1280.webp (82 КиБ) RU+EN: desktop — URL совпадает с героем 1280w,
//      mobile −106 КиБ. title.webp цел как кандидат srcset 1920w.
//   3) PF-4 (P3): reveal.js — два прохода «чтения → записи» (layout thrashing,
//      длинная задача ~234 мс, устранён); поведение анимации прежнее.
//   4) PF-5 (P4): минификация принята как стиль проекта «читаемый исходник»
//      (пин-щит: styles.css/js-модули не минифицируются).
//   5) SW v124→v125; game-assets-v45 цел; инварианты 66.90/66.91 целы (sticky,
//      контраст, srcset, CLS=0, og-demo, aria); доки + bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round134.mjs
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
const reveal = read('js/modules/reveal.js');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');
const styles = read('styles.css');

console.log('--- 1. PF-1: регистрация SW для прямых посетителей игры ---');
ok(gameHtml.includes("if ('serviceWorker' in navigator) {"), "game/index.html: регистрация под guard 'serviceWorker' in navigator");
ok(gameHtml.includes("navigator.serviceWorker.register('/sw.js').catch"), "game/index.html: register('/sw.js') с catch-тишиной (не блокирует Phaser)");
ok(sw.includes("url.pathname.startsWith('/game/assets/') || url.pathname.startsWith('/game/vendor/')"), 'sw.js: маршруты cache-first /game/assets/ + /game/vendor/ целы (66.64)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: бакет game-assets-v45 цел');
ok(sw.includes("const fb = url.pathname.indexOf('/game/') === 0 ? '/game/'"), 'sw.js: офлайн-фолбэк /game/ цел (66.53/66.56)');
const regIdx = gameHtml.indexOf("navigator.serviceWorker.register");
const phaserIdx = gameHtml.indexOf('vendor/phaser.min.js');
ok(regIdx > -1 && phaserIdx > -1 && regIdx > phaserIdx, 'регистрация в инлайн-блоке после подключения Phaser (асинхронна, не в критическом пути игры)');

console.log('--- 2. Постер видео: title-1280.webp, двойная загрузка героя устранена ---');
ok(indexRu.includes('poster="assets/images/title-1280.webp"'), 'index.html: poster → title-1280.webp (82 КиБ вместо 188.6)');
ok(indexEn.includes('poster="../assets/images/title-1280.webp"'), 'en/index.html: poster → title-1280.webp');
ok(!indexRu.includes('poster="assets/images/title.webp"') && !indexEn.includes('poster="../assets/images/title.webp"'), 'RU+EN: старого poster=title.webp (1920px) нет');
ok(exists('assets/images/title.webp'), 'title.webp цел — законный кандидат srcset 1920w (не удалять)');
const w1280 = fs.readFileSync('assets/images/title-1280.webp');
ok(w1280[0] === 0x52 && w1280[1] === 0x49 && w1280[2] === 0x46 && w1280[3] === 0x46, 'title-1280.webp — RIFF-сигнатура');
ok(w1280[8] === 0x57 && w1280[9] === 0x45 && w1280[10] === 0x42 && w1280[11] === 0x50, 'title-1280.webp — WEBP-маркер');
ok(w1280.length > 40 * 1024 && w1280.length < 150 * 1024, `title-1280.webp вес ${Math.round(w1280.length / 1024)} КиБ в рамке 40–150 (постер, не 1920px-оригинал)`);

console.log('--- 3. PF-4: reveal.js два прохода чтение→запись ---');
const readIdx = reveal.indexOf('getBoundingClientRect');
const writeIdx = reveal.indexOf("el.style.opacity = '0'");
ok(readIdx > -1 && writeIdx > -1 && readIdx < writeIdx, 'все чтения rect ДО первой записи стилей (один reflow вместо ~35 форсированных)');
const revealCode = reveal.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok((revealCode.match(/getBoundingClientRect/g) || []).length === 1, 'getBoundingClientRect ровно один в коде (живёт в проходе чтения)');
ok(reveal.includes('const targets = [];') && reveal.includes('targets.push(el);'), 'проход чтения собирает targets, проход записи применяет');
ok(reveal.includes("rootMargin: '0px 0px -50px 0px'") && reveal.includes('threshold: 0.1'), 'observer: пороги и rootMargin 66.48 целы');
ok(reveal.includes('rect.top < window.innerHeight && rect.bottom > 0'), 'инвариант «первый экран всегда виден» цел');
ok(reveal.includes("transition = 'opacity 0.6s ease, transform 0.6s ease'"), 'переход 0.6s прежний (визуальное поведение не менялось)');

console.log('--- 4. PF-5: пин-щит «читаемого исходника» ---');
ok(exists('styles.css') && !exists('styles.min.css'), 'styles.css без минификации (стиль проекта «читаемый исходник», решение 66.92)');
ok(exists('js/modules/reveal.js') && read('js/main.js').includes('import'), 'js-модули — читаемые ES-модули (не бандл)');

console.log('--- 5. Инварианты 66.90/66.91 целы ---');
ok(styles.includes('overflow-x: clip'), 'styles.css: body overflow-x: clip (P1 sticky 66.90)');
ok(styles.includes('--text-muted: #94836a') && styles.includes('--gold-dim: #a8862a'), 'styles.css: контраст-цвета AA 66.90');
ok(indexRu.includes('imagesrcset=') && indexEn.includes('imagesrcset='), 'RU+EN: preload imagesrcset героя 66.90 цел');
ok(indexRu.includes('src="assets/images/title-1280.jpg"') && indexEn.includes('src="../assets/images/title-1280.jpg"'), 'RU+EN: JPEG-фолбэк title-1280.jpg 66.91 цел');
ok(indexRu.includes('"inLanguage"') && indexEn.includes('"inLanguage"'), 'JSON-LD inLanguage 66.91 цел');
ok(exists('assets/images/og-demo.jpg'), 'og-demo.jpg цел (og:image игры — щит r133)');

console.log('--- 6. SW v125 + доки + sitemap ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v127';"), 'sw.js: site-cache v127');
ok(swlog.includes('- v125 —'), 'SW_CHANGELOG: запись v125 добавлена');
ok(changes.includes('## Патч 66.92'), 'CHANGES.md: секция патча 66.92 добавлена');
ok(worklog.includes('Task ID: 66.92'), 'worklog: запись 66.92 добавлена');
let lastmodSync = false;
try { execSync('python3 game/tools/bump_lastmod.py --check', { stdio: 'pipe' }); lastmodSync = true; } catch {}
ok(lastmodSync, 'bump_lastmod --check: git ↔ sitemap СИНХРОН (живой прогон)');

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

// test_round114.mjs — 66.64: P3-4 + P3-5 аудита 66.61 одной итерацией (приказ
// владельца — «затем P3-4 (самохостинг Phaser) и P3-5 (PT Sans в стеке)»).
// ПРИЧИНА (P3-4): Phaser 3.88.2 был единственной внешней зависимостью игры
// (cdn.jsdelivr.net) — недоступность CDN = игра без движка; при этом
// разрешённый в script-src внешний origin сужал CSP.
// ПРИЧИНА (P3-5): 'PT Sans' объявлялся в font-family (.fund-bar/.btn-share/
// .copy-toast), но вебшрифтом не загружался — расхождение стека и рендера
// (задокументировано в 66.60): полоска рендерилась локальным sans-serif.
// РЕЦЕПТ: phaser.min.js 3.88.2 (1193491 байт) самохостится в game/vendor/,
// бит-в-бит с jsdelivr и npm-тарболом (sha256 397fc65b…); CSP script-src без
// CDN; с лендингов сняты мёртвые preconnect/dns-prefetch к jsdelivr;
// css2-линк лендингов +family=PT+Sans:wght@400;700. SW: /game/vendor/ добавлен
// в cache-first ветку ассетов (неизменяемая библиотека), v110 + game-assets-v42 (66.68: site-cache бамп v109→v110).
// Живые доказательства (вне этого файла): scripts/baseline_66_64_before/after.json,
// смоук smoke_66_64.mjs (FontFaceSet, ширина текста, ноль внешних запросов игры).
// Здесь закреплена СТАТИКА: vendor-файл, game/index.html, CSP, лендинги,
// styles.css, sw.js v110/v42, документация, живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round114.mjs
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const ru = read('index.html');
const en = read('en/index.html');
const game = read('game/index.html');
const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');

console.log('--- 1. P3-4: vendor-файл Phaser ---');
ok(fs.existsSync('game/vendor/phaser.min.js'), 'game/vendor/phaser.min.js существует');
const vendor = fs.readFileSync('game/vendor/phaser.min.js');
ok(vendor.length === 1193491, `vendor: размер 1193491 байт (пин 3.88.2), фактический ${vendor.length}`);
const vendorStr = vendor.toString('utf-8');
ok(vendorStr.includes('3.88.2'), 'vendor: внутри версия 3.88.2');
ok(!vendor.subarray(0, 64).toString().includes('<'), 'vendor: начало файла — JS, не HTML-страница ошибки');
const sha = createHash('sha256').update(vendor).digest('hex');
ok(sha === '397fc65bb751b2549b59c64647edf70300d604b742cd6be03d8298b8f35ca9d6',
    `vendor: sha256 бит-в-бит с jsdelivr/npm (397fc65b…), фактический ${sha.slice(0, 8)}…`);

console.log('--- 2. P3-4: game/index.html и CSP ---');
ok(game.includes('<script src="vendor/phaser.min.js">'), 'game/index.html: script src="vendor/phaser.min.js" (относительный путь)');
ok(!game.includes('cdn.jsdelivr.net'), 'game/index.html: jsdelivr не упоминается нигде');
const cspMatch = game.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
ok(!!cspMatch, 'game/index.html: CSP meta присутствует');
if (cspMatch) {
    const csp = cspMatch[1];
    ok(csp.includes("script-src 'self' 'unsafe-inline';") || csp.includes("script-src 'self' 'unsafe-inline'\"") === false && csp.includes("script-src 'self' 'unsafe-inline'"), 'CSP: script-src self + inline (без внешних origin)');
    ok(!csp.includes('jsdelivr'), 'CSP: внешний CDN убран из script-src (66.64 — P3-4)');
    ok(csp.includes("img-src 'self' data: blob:"), 'CSP: img-src blob: цел (66.50 — конвейер текстур Phaser)');
    ok(csp.includes("media-src 'self' blob:"), 'CSP: media-src blob: цел (аудио)');
    ok(!csp.includes('unsafe-eval'), 'CSP: unsafe-eval по-прежнему отсутствует');
    ok(csp.includes("object-src 'none'") && csp.includes("base-uri 'self'"), 'CSP: object-src none + base-uri self целы');
}
ok(!/<script[^>]+src="https?:\/\//.test(game), 'game/index.html: внешних <script src> вообще нет');
ok(game.includes('sha256 397fc65bb751b2549b59c64647edf70300d604b742cd6be03d8298b8f35ca9d6') || game.includes('397fc65b'), 'game/index.html: док-комментарий 66.64 с пином sha256');

console.log('--- 3. P3-4: лендинги без мёртвых хинтов на CDN ---');
ok(!ru.includes('cdn.jsdelivr.net'), 'index.html: jsdelivr не упоминается (preconnect/dns-prefetch сняты)');
ok(!en.includes('cdn.jsdelivr.net'), 'en/index.html: jsdelivr не упоминается (preconnect/dns-prefetch сняты)');
ok(ru.includes('preconnect" href="https://fonts.googleapis.com') && ru.includes('preconnect" href="https://fonts.gstatic.com" crossorigin'), 'index.html: шрифтовые preconnect целы (снято только лишнее)');

console.log('--- 4. P3-5: PT Sans в css2-линке и styles.css ---');
const ruFont = ru.match(/href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+"/) || [''];
const enFont = en.match(/href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+"/) || [''];
ok(ruFont[0].includes('family=PT+Sans:wght@400;700'), 'index.html: css2-линк несёт PT+Sans:wght@400;700');
ok(enFont[0].includes('family=PT+Sans:wght@400;700'), 'en/index.html: css2-линк несёт PT+Sans:wght@400;700');
ok(ruFont[0].includes('family=Prata') && ruFont[0].includes('family=PT+Serif'), 'index.html: Prata и PT Serif в линке не потеряны');
ok((styles.match(/'PT Sans',sans-serif/g) || []).length === 3, 'styles.css: стек с PT Sans в 3 селекторах (.fund-bar/.btn-share/.copy-toast) не менялся');
ok(styles.includes('66.64 (аудит 66.61, P3-5)'), 'styles.css: док-заметка 66.64 о загрузке PT Sans');
ok(styles.includes("'PT Sans' вебфонтом НЕ загружен") || styles.includes("'PT Sans' вебфонтом не загружен"), 'styles.css: историческая справка 66.60 сохранена (причина line-height:1.2)');
// инвариант высоты 66.60: line-height:1.2 в каноническом блоке — после P3-5 высоты не сдвинулись (37.47/29.19)
const canonBlock = styles.slice(styles.indexOf('.fund-bar {') >= 0 ? styles.indexOf('.fund-bar {') : styles.indexOf('.fund-bar{'), styles.indexOf('.fund-bar:hover'));
ok(canonBlock.includes('line-height:1.2'), 'styles.css: инвариант 66.60 line-height:1.2 в каноническом блоке цел');

console.log('--- 5. SW: vendor в cache-first, v110 + game-assets-v42 ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v110';"), 'sw.js: site-cache v110 (актуализация 66.68 — P3 аудита §9/66.66: дубли i18n ×18 / покадровые Vector2 ×3 сцены / W3C-кодирование URL ×3, HTML страниц → бамп)');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v42';"), 'sw.js: game-assets-v42 (новый бакет под новую ветку маршрута /game/vendor/)');
ok(sw.includes("url.pathname.startsWith('/game/assets/') || url.pathname.startsWith('/game/vendor/')"), 'sw.js: /game/vendor/ в cache-first ветке ассетов (неизменяемая библиотека — как /game/assets/)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт офлайн-фолбэка цел (66.57 P3-3)');
ok(sw.includes('/game/vendor/ — с 66.64'), 'sw.js: шапка отражает vendor-маршрут');
ok(swlog.includes('- v108 — итерация 66.64'), 'SW_CHANGELOG: запись v108 добавлена');
ok(swlog.includes('- v107 — итерация 66.63'), 'SW_CHANGELOG: история v107 сохранена');
ok(changes.includes('Патч 66.64') || changes.includes('## 66.64'), 'CHANGES.md: секция 66.64');
for (const f of ['test_round102.mjs', 'test_round108.mjs', 'test_round113.mjs']) {
    // актуализация 66.67: честные шапки соседей обновлены на 66.67 (SW-ожидания v108→v109,
    // P2 аудита §9/66.66 — контраст футерных кнопок); проверяем ПОСЛЕДНЮЮ шапку —
    // историческая 66.64 остаётся допустимой тоже (шапки копятся, не заменяются без следа)
    ok(read(`game/tools/${f}`).includes('// актуализация 66.67:'), `честная шапка 66.67 в ${f}`);
}

console.log('--- 6. bump_lastmod живым прогоном ---');
let checkOut = '', checkOk = true;
try {
    checkOut = execSync('python3 game/tools/bump_lastmod.py --check', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
    checkOk = false;
    checkOut = (e.stdout || '') + (e.stderr || '');
}
ok(checkOk, 'bump_lastmod --check: sitemap синхронен с git-фактами' + (checkOk ? '' : ` — ${checkOut.slice(0, 200)}`));

console.log(`\nИтог r114: ${pass} проверок пройдено, ${fail} провалено`);
process.exit(fail ? 1 : 0);

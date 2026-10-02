// test_round118.mjs — 66.70: аудит владельца (PWA EN-версии + чистка лендингов
// + Web Vitals). Состав патча:
//   1) INLINE ONCLICK СНЯТЫ с лендингов RU+EN (fund-bar / фон .fund-popup /
//      кнопка ×) — поведение живёт ТОЛЬКО в js/modules/ui.js (initFundPopup:
//      открытие + keydown + aria-expanded, закрытие по ×, клик мимо окна, Esc,
//      фокус-трап); CSP не тронута ('unsafe-inline' — счётчик Метрики + JSON-LD).
//   2) META KEYWORDS снят (RU+EN) — устаревший тег; description/OG не тронуты.
//   3) FETCHPRIORITY="LOW" снят с preload первого скриншота (противоречивая
//      комбинация; preload сохранён); hero preload остаётся fetchpriority="high".
//   4) НОВЫЙ js/modules/webvitals.js — LCP/FID/CLS → цели Метрики
//      (webvitals_lcp/webvitals_fid/webvitals_cls), нативные PerformanceObserver,
//      buffered:true, без внешних зависимостей (CSP 'self'); вызов из main.js
//      досрочно (до bootPage).
//   5) Критический пункт аудита «битый /en/manifest.json» — закрыт ЕЩЁ В 66.54;
//      здесь пин: файл валиден, поля EN, start_url /en/, link в en/index.html.
//   6) SW v111→v112 (HTML RU+EN лендингов + webvitals.js в CACHE_NAME),
//      game-assets-v42 цел; доки + живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round118.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const indexRu = read('index.html');
const indexEn = read('en/index.html');
const ui = read('js/modules/ui.js');
const mainJs = read('js/main.js');
const wv = read('js/modules/webvitals.js');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');

console.log('--- 1. Inline onclick сняты ×3 элемента ×2 локали, разметка цела ---');
for (const [html, locale] of [[indexRu, 'RU'], [indexEn, 'EN']]) {
    ok(!/\sonclick\s*=/i.test(html), `${locale}: onclick-атрибутов на странице ноль`);
    ok(/<button type="button" class="fund-bar" aria-haspopup="dialog" aria-controls="fundPopup">/.test(html),
        `${locale}: .fund-bar — нативный <button> без onclick (66.47/66.70)`);
    ok(/<div class="fund-popup" id="fundPopup" role="dialog" aria-modal="true" aria-labelledby="fundPopupTitle">/.test(html),
        `${locale}: фон .fund-popup без onclick (закрытие — в ui.js)`);
    ok(html.includes('<button class="fund-popup-close"') && !html.includes('this.closest'),
        `${locale}: кнопка × без onclick (закрытие — в ui.js)`);
}
ok(ui.includes("bar.addEventListener('click', function () { openPopup(); syncExpanded(true); })"),
    'ui.js: открытие попапа по клику на .fund-bar (+ aria-expanded) — единственный источник');
ok(ui.includes("bar.addEventListener('keydown'") && ui.includes("e.key === 'Enter' || e.key === ' '"),
    'ui.js: keydown Enter/Space на .fund-bar (клавиатура цела)');
ok(ui.includes("closeBtn.addEventListener('click'"),
    'ui.js: закрытие по кнопке × — closeBtn.addEventListener (66.48, дубликат снят)');
ok(ui.includes('if (e.target === popup)'),
    'ui.js: закрытие кликом мимо окна (фон попапа) — слушатель жив');
ok(ui.includes("e.key === 'Escape'") && ui.includes('ФОКУС-ТРАП'),
    'ui.js: Esc + фокус-трап не тронуты (66.48)');
ok(ui.includes('66.70 (аудит владельца): inline onclick сняты с разметки'),
    'ui.js: коммент-шапка initFundPopup актуализирована (66.70)');
ok(!indexRu.includes('name="keywords"') && !indexEn.includes('name="keywords"'),
    '2. meta keywords снят с RU+EN');
ok(indexRu.includes('<meta name="description"') && indexEn.includes('<meta name="description"'),
    'description RU+EN целы (SEO не пострадал)');

console.log('--- 3. preload первого скриншота: fetchpriority="low" снят, preload цел ---');
ok(indexRu.includes('<link rel="preload" href="assets/screenshots/01-title.webp" as="image">'),
    'RU: preload 01-title.webp БЕЗ fetchpriority (противоречивая комбинация снята)');
ok(indexEn.includes('<link rel="preload" href="../assets/screenshots/01-title.webp" as="image">'),
    'EN: preload 01-title.webp БЕЗ fetchpriority');
ok(!/rel="preload"[^>]*fetchpriority="low"/.test(indexRu) && !/rel="preload"[^>]*fetchpriority="low"/.test(indexEn),
    'RU+EN: ни одного preload с fetchpriority="low" больше нет');
ok(indexRu.includes('<link rel="preload" href="assets/images/title.webp" as="image" fetchpriority="high">') &&
   indexEn.includes('<link rel="preload" href="../assets/images/title.webp" as="image" fetchpriority="high">'),
    'RU+EN: hero preload сохранён с fetchpriority="high" (не тронут, прецедент 66.69/P4-9)');

console.log('--- 4. webvitals.js: Web Vitals → Метрика, CSP-чисто, досрочный вызов ---');
ok(wv.includes('export function initWebVitals'), 'webvitals.js: экспорт initWebVitals');
ok(wv.includes('112435792'), 'webvitals.js: ID счётчика Метрики 112435792 (как в analytics.js)');
ok(wv.includes("'webvitals_' + name") && wv.includes("sendMetric('lcp'") && wv.includes("sendMetric('fid'") && wv.includes("sendMetric('cls'"),
    'webvitals.js: три метрики → цели webvitals_lcp / webvitals_fid / webvitals_cls');
ok(wv.includes('buffered: true'), 'webvitals.js: PerformanceObserver с buffered:true (события до регистрации)');
ok(wv.includes("largest-contentful-paint") && wv.includes("'first-input'") && wv.includes("'layout-shift'"),
    'webvitals.js: LCP + FID + CLS — типы наблюдателей web.dev');
ok(wv.includes('hadRecentInput') && wv.includes('1000') && wv.includes('5000'),
    'webvitals.js: CLS — сессионные окна (сдвиги от ввода мимо, gap 1s / окно 5s)');
ok(wv.includes("document.visibilityState === 'hidden'") && wv.includes("'pagehide'"),
    'webvitals.js: финализация LCP/CLS на скрытии вкладки + pagehide-эшелон');
ok(wv.includes("typeof ym !== 'function'"), 'webvitals.js: guard Метрики (стенд/офлайн — тихий выход)');
ok(!wv.includes('https://') && !wv.includes('http://'),
    'webvitals.js: НЕТ внешних URL (CSP \u0027self\u0027, новых origin ноль — §9.5/66.64)');
ok(mainJs.includes("import { initWebVitals } from './modules/webvitals.js';"),
    'main.js: модуль импортирован');
ok(mainJs.indexOf('initWebVitals();') > -1 && mainJs.indexOf('initWebVitals();') < mainJs.indexOf('function bootPage'),
    'main.js: initWebVitals() вызывается ДОСРОЧНО (до bootPage — точнее LCP)');
ok(indexRu.includes("script-src 'self' 'unsafe-inline' https://mc.yandex.ru") &&
   indexEn.includes("script-src 'self' 'unsafe-inline' https://mc.yandex.ru"),
    'CSP RU+EN не менялась (модуль самохостится под \u0027self\u0027; Метрика под своим origin)');

console.log('--- 5. Критический пункт аудита: /en/manifest.json (закрыт в 66.54, пин) ---');
let enManifest = null;
try { enManifest = JSON.parse(read('en/manifest.json')); } catch (e) { /* ниже ассерты поймают */ }
ok(!!enManifest, 'en/manifest.json существует и валидный JSON');
ok(enManifest && enManifest.lang === 'en' && enManifest.start_url === '/en/' && enManifest.display === 'standalone',
    'en/manifest.json: lang=en, start_url=/en/, display=standalone');
ok(enManifest && typeof enManifest.name === 'string' && enManifest.name.includes('Ruthenia') &&
   Array.isArray(enManifest.icons) && enManifest.icons.length >= 2,
    'en/manifest.json: EN-имя + иконки ≥2');
ok(indexEn.includes('<link rel="manifest" href="/en/manifest.json">'),
    'en/index.html: link rel="manifest" ведёт на существующий /en/manifest.json (404 невозможен)');

console.log('--- 6. SW: v112, v42 цел, механика не тронута ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v112';"),
    'sw.js: const CACHE_NAME v112 (HTML RU+EN лендингов + webvitals.js → бамп §4)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v42';"),
    'sw.js: const GAME_ASSETS_CACHE v42 (ассеты/vendor не тронуты)');
ok((sw.match(/\bvar\s+[A-Za-z_$]/gm) || []).length === 0, 'sw.js: объявлений var — ноль (no-var §9.2)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел');
ok(sw.includes("url.pathname.startsWith('/game/assets/') || url.pathname.startsWith('/game/vendor/')"),
    'sw.js: cache-first ветка /game/assets/ + /game/vendor/ (66.64) цел');

console.log('--- 7. Доки/синтаксис/lastmod (§4/§7/§8) ---');
ok(swlog.includes('- v112 — итерация 66.70'), 'SW_CHANGELOG: запись v112 добавлена');
ok(changes.includes('## Патч 66.70'), 'CHANGES.md: секция патча 66.70 добавлена');
ok(worklog.includes('Task ID: 66.70'), 'worklog.md: секция 66.70 добавлена');
let synOk = true;
for (const f of ['js/modules/webvitals.js', 'js/main.js', 'js/modules/ui.js', 'sw.js']) {
    try { execSync('node --check ' + f, { stdio: 'pipe' }); } catch { synOk = false; console.log('    node --check FAIL: ' + f); }
}
ok(synOk, 'node --check: webvitals.js, main.js, ui.js, sw.js — синтаксис цел');
let lastmodSync = false;
try { execSync('python3 game/tools/bump_lastmod.py --check', { stdio: 'pipe' }); lastmodSync = true; } catch {}
ok(lastmodSync, 'bump_lastmod --check: git ↔ sitemap СИНХРОН (живой прогон)');

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

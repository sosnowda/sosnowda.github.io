// test_round102.mjs — итерация 66.48 (закрытие трёх отложенных пунктов аудита).
//   №12  main.js → ES-модули: js/main.js + js/modules/* (9 файлов, синтаксис
//        каждого проверяется node --check), <script type="module"> на RU+EN,
//        дайс d100 без inline onclick/onkeydown, старый main.js удалён;
//   №18  CSP meta в game/index.html: Phaser CDN разрешён точечно, инлайн-лоадер
//        работает ('unsafe-inline'), 'unsafe-eval' НЕ нужен и отсутствует;
//   №11  партия 2: index.html и en/index.html свободны от инлайн-стилей
//        (ложное срабатывание SVG font-style отфильтровывается), новые классы
//        на месте в styles.css;
//   SW   site-cache v104 (66.59 мобильный кегль полосы сбора; история актуализаций — см. r108), журнал версий в docs/SW_CHANGELOG.md (v97 и v98).
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const MODULES = ['js/main.js', 'js/modules/state.js', 'js/modules/l10n.js', 'js/modules/reveal.js',
    'js/modules/scrollspy.js', 'js/modules/lightbox.js', 'js/modules/gallery.js',
    'js/modules/particles.js', 'js/modules/ui.js', 'js/modules/analytics.js'];

console.log('--- 1. Аудит №12: модульная структура ---');
for (const m of MODULES) {
    ok(existsSync(join(ROOT, m)), 'файл на месте: ' + m);
}
ok(!existsSync(join(ROOT, 'main.js')), 'старый монолит main.js удалён из корня');
for (const m of MODULES) {
    const r = spawnSync(process.execPath, ['--check', join(ROOT, m)], { encoding: 'utf8' });
    ok(r.status === 0, 'node --check: ' + m + (r.status !== 0 ? ' → ' + r.stderr : ''));
}
const entry = read('js/main.js');
ok(entry.includes("import { initGallery } from './modules/gallery.js'"), 'точка входа импортирует gallery');
ok(entry.includes("import { initInteractivePage } from './modules/ui.js'"), 'точка входа импортирует ui');
ok(entry.includes("document.documentElement.classList.add('js')"), 'флаг js ставится в точке входа (no-JS safe)');
ok(entry.includes("navigator.serviceWorker.register('/sw.js')"), 'регистрация SW в точке входа');
ok(entry.includes('DOMContentLoaded'), 'запуск по DOMContentLoaded (или сразу, если DOM готов)');
const state = read('js/modules/state.js');
ok(state.includes('export const REDUCED_MOTION'), 'state.js: REDUCED_MOTION экспортируется');
ok(state.includes('export const IS_EN_PAGE'), 'state.js: IS_EN_PAGE экспортируется');
const ui = read('js/modules/ui.js');
ok(ui.includes('function selectPrince'), 'ui.js: таймлайн князей переехал');
ok(ui.includes("dice.addEventListener('click', rollD100)"), 'ui.js: d100 слушает клик вместо inline onclick');
ok(ui.includes("e.key === 'Enter' || e.key === ' '"), 'ui.js: d100 работает с клавиатуры Enter/Space');
ok(ui.includes('focusablesSel'), 'ui.js: фокус-трап попапа на месте');
ok(ui.includes('initInteractivePage'), 'ui.js: интерактив работает и при reduced-motion');
const gallery = read('js/modules/gallery.js');
ok(gallery.includes('slb-prev') && gallery.includes('slb-next'), 'gallery.js: стрелки лайтбокса');
const spy = read('js/modules/scrollspy.js');
ok(spy.includes('__anchorSettle'), 'scrollspy.js: коррекция якорей content-visibility-safe');
ok(spy.includes('spyTargets'), 'scrollspy.js: подсветка активного раздела');
ok(!/\bvar\s+[A-Za-z_$]/.test(MODULES.map(read).join('\n').replace(/^\s*\/\/.*$/gm, '')), 'модули: var больше нет (const/let)');

console.log('--- 2. Аудит №12: подключение на страницах ---');
const ru = read('index.html');
const en = read('en/index.html');
ok(ru.includes('<script type="module" src="js/main.js"></script>'), 'RU: <script type="module" src="js/main.js">');
ok(en.includes('<script type="module" src="../js/main.js"></script>'), 'EN: <script type="module" src="../js/main.js">');
ok(!ru.includes('src="main.js" defer') && !en.includes('src="../main.js" defer'), 'RU/EN: старый тег main.js defer снят');
ok(!ru.includes('onclick="rollD100()"') && !en.includes('onclick="rollD100()"'), 'RU/EN: inline onclick дайса снят');
ok(!ru.includes('onkeydown="if(event.key') && !en.includes('onkeydown="if(event.key'), 'RU/EN: inline onkeydown дайса снят');
ok(ru.includes('id="d100Dice" role="button" tabindex="0"') && en.includes('id="d100Dice" role="button" tabindex="0"'), 'RU/EN: d100 сохранил role/tabindex (a11y)');

console.log('--- 3. Аудит №18: CSP страницы игры ---');
const gameHtml = read('game/index.html');
const cspMatch = gameHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
ok(!!cspMatch, 'game/index.html: CSP meta присутствует');
if (cspMatch) {
    const csp = cspMatch[1];
    ok(csp.includes("script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"), 'CSP: Phaser CDN + инлайн-лоадер разрешены точечно');
    ok(csp.includes("default-src 'self'"), 'CSP: default-src self');
    ok(csp.includes("img-src 'self' data:"), 'CSP: img-src self + data: (favicon)');
    ok(csp.includes("connect-src 'self'"), 'CSP: connect-src self (XHR ассетов Phaser)');
    ok(!csp.includes('unsafe-eval'), 'CSP: unsafe-eval отсутствует (Phaser его не требует)');
    ok(csp.includes("object-src 'none'") && csp.includes("base-uri 'self'"), 'CSP: object-src none + base-uri self');
}
ok(gameHtml.includes('https://cdn.jsdelivr.net/npm/phaser@3.88.2'), 'game/index.html: Phaser по-прежнему с jsdelivr (совпадает с CSP)');

console.log('--- 4. Аудит №11 (партия 2): инлайн-стили сняты ---');
const countInlines = (html) => (html.replace(/font-style="[^"]*"/g, '').match(/style="[^"]*"/g) || []).length;
ok(countInlines(ru) === 0, 'RU: инлайн-стилей не осталось');
ok(countInlines(en) === 0, 'EN: инлайн-стилей не осталось');
const styles = read('styles.css');
for (const cls of ['.section-intro', '.section-intro--muted', '.section-intro--small',
    '.maps-section', '.maps-grid', '.map-card-body', '.map-card-title', '.map-card-date', '.map-card-desc',
    '.d100-block', '.d100-zone', '.d100-sphere', '.d100-result', '.d100-degree',
    '.brand-link', '.brand-name', '.brand-godot', '.lead-block', '.alpha-banner',
    '.tech-cards-grid', '.models-list', '.game-start-wrap', '.footer-meta', '.footer-engine',
    '.history-note', '.cta-meta', '.metric-pixel', '.gold-bright', '.container--maps']) {
    ok(styles.includes(cls), 'styles.css: ' + cls);
}
ok(ru.includes('class="section-intro"') && en.includes('class="section-intro"'), 'RU/EN: подводки секций на .section-intro');
ok(ru.includes('class="map-card">') && en.includes('class="map-card">'), 'RU/EN: карточки карт без дублей инлайн-рамки');
ok(ru.includes('class="d100-sphere"') && en.includes('class="d100-sphere"'), 'RU/EN: сфера d100 на классе');
ok(styles.includes('.sr-only'), 'styles.css: .sr-only существует (скрытый h1 переиспользует)');

console.log('--- 5. Service Worker v99 и журнал ---');
const sw = read('sw.js');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v106';"), 'SW: site-cache v106 (ассерт актуализирован из v101)');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v41';"), 'SW: game-assets-v41 не менялся (ассеты не трогали)');
const swlog = read('docs/SW_CHANGELOG.md');
ok(swlog.includes('- v99 — итерация 66.49'), 'SW-журнал: запись v99 добавлена');
ok(swlog.includes('- v98 — итерация 66.48'), 'SW-журнал: запись v98 добавлена');
ok(swlog.includes('- v97 — итерация 66.47'), 'SW-журнал: пропущенная запись v97 восстановлена');

console.log('\nИтог: ' + pass + ' проверок пройдено, ' + fail + ' провалено');
process.exit(fail ? 1 : 0);

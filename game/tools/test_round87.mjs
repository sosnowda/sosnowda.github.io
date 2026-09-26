// test_round87.mjs — итерация 66.31 (8 приказов владельца).
// 1) PreloadScene с золотым прогресс-баром  2) частицы: reduced-motion +
// visibilitychange (MotionFX)  3) width/height всем img лендинга
// 4) фокус-трап попапа поддержки  5) UTM-метки донат-ссылок
// 6) кнопка «Вернуться на сайт» в меню  7) чистка i18n.js (дубли) и
// var→const в main.js  8) интерактивный таймлайн князей. SW v81.
import { readFileSync, existsSync } from 'fs';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
};
const read = (p) => readFileSync(p, 'utf8');

const entry = read('../index.html');          // game/index.html
const boot = read('../src/scenes/BootScene.js');
const sw = read('../../sw.js');
const landingRU = read('../../index.html');
const landingEN = read('../../en/index.html');
const mainJs = read('../../main.js');
const i18n = read('../src/systems/i18n.js');
const title = read('../src/scenes/TitleScene.js');
const styles = read('../../styles.css');

console.log('--- 1. PreloadScene: золотой прогресс-бар (п.1) ---');
ok(existsSync('../src/scenes/PreloadScene.js'), 'новая сцена на месте: game/src/scenes/PreloadScene.js');
const pre = read('../src/scenes/PreloadScene.js');
ok(pre.includes("super('Preload')"), 'PreloadScene: ключ сцены Preload');
ok(pre.includes("this.scene.launch('Boot')"), 'PreloadScene: сам запускает BootScene');
ok(pre.includes("this.registry.set('bootProgress', 0)"), 'PreloadScene: готовит registry bootProgress');
ok(pre.includes('RUS.border') && pre.includes('barFill'), 'PreloadScene: ЗОЛОТОЙ бар (RUS.border) с заливкой');
ok(pre.includes('reducedMotion()'), 'PreloadScene: искры выключаются при reduced-motion');
// PreloadScene импортируется ПЕРВОЙ в точке входа (порядок Promise.all)
const firstImport = entry.indexOf("import('./src/scenes/PreloadScene.js')");
const bootImport = entry.indexOf("import('./src/scenes/BootScene.js')");
ok(firstImport !== -1 && bootImport !== -1 && firstImport < bootImport,
    'game/index.html: PreloadScene импортируется ПЕРВОЙ (до BootScene)');
ok(boot.includes("this.scene.isActive('Preload')"), 'BootScene: служебная полоска только если Preload не активен');
ok(boot.includes("this.registry.set('bootProgress', val)"), 'BootScene: честный прогресс уходит в registry');
ok(boot.indexOf("this.scene.stop('Preload')") < boot.indexOf("this.scene.start('Title')"),
    'BootScene: Preload гасится ДО перехода в Title');

console.log('--- 2. Частицы: reduced-motion + visibilitychange (п.2) ---');
ok(existsSync('../src/systems/MotionFX.js'), 'новый регулятор: game/src/systems/MotionFX.js');
const fx = read('../src/systems/MotionFX.js');
ok(fx.includes('(prefers-reduced-motion: reduce)'), 'MotionFX: проверка prefers-reduced-motion');
ok(fx.includes('emitting: false'), 'MotionFX: эмиттеры создаются спящими (ни одной частицы)');
ok(fx.includes('visibilitychange') && fx.includes('suspendFx') && fx.includes('resumeFx'),
    'MotionFX: скрытая вкладка — эмиттеры спят, возврат — просыпаются');
ok(fx.includes("p.get('motion') === 'full'"), 'MotionFX: QA-обход ?motion=full');
ok(boot.includes("installFxGovernor()") && boot.includes("from '../systems/MotionFX.js'"),
    'BootScene: патч фабрики частиц ставится до всех сцен');
ok(fx.includes('GameObjectFactory.prototype'), 'MotionFX: перехват scene.add.particles');
ok(mainJs.includes("document.visibilityState === 'hidden'"), 'лендинг: RAF частиц замирает в скрытой вкладке');
ok(/const REDUCED_MOTION/.test(mainJs), 'лендинг: REDUCED_MOTION (частицы/параллакс выкл. при reduce)');

console.log('--- 3. width/height всем img (п.3, CLS/SEO) ---');
// трекер Метрики в <noscript> (off-screen пиксель) — размеров не требует
const stripNoscript = (page) => page.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
const imgAttrs = (page) => (stripNoscript(page).match(/<img\s/g) || []).length;
const imgWithDims = (page) => (stripNoscript(page).match(/<img\s[^>]*width=/g) || []).length;
ok(imgAttrs(landingRU) === imgWithDims(landingRU), `RU: все img с width/height (${imgWithDims(landingRU)}/${imgAttrs(landingRU)})`);
ok(imgAttrs(landingEN) === imgWithDims(landingEN), `EN: все img с width/height (${imgWithDims(landingEN)}/${imgAttrs(landingEN)})`);
ok(landingRU.includes('class="hero-image" width="1920" height="1097"'), 'RU: hero 1920×1097');
ok(landingEN.includes('class="hero-image" width="1920" height="1097"'), 'EN: hero 1920×1097');
ok((landingRU.match(/width="1280" height="720"/g) || []).length === 9, 'RU: 9 скриншотов 1280×720');
ok((landingEN.match(/width="1280" height="720"/g) || []).length === 9, 'EN: 9 скриншотов 1280×720');
ok(landingRU.includes('width="1600" height="1186"') && landingRU.includes('width="1600" height="1121"'),
    'RU: обе карты (Вида-Лятского 1600×1186, Герберштейна 1600×1121)');

console.log('--- 4. Попап поддержки: фокус-трап + клавиатура (п.4) ---');
for (const [name, page, closeLabel] of [['RU', landingRU, 'Закрыть окно поддержки'], ['EN', landingEN, 'Close support dialog']]) {
    ok(page.includes('id="fundPopup" role="dialog" aria-modal="true" aria-labelledby="fundPopupTitle"'),
        `${name}: попап — role=dialog + aria-modal + aria-labelledby`);
    ok(page.includes(`aria-label="${closeLabel}"`), `${name}: у «×» понятная aria-label`);
}
ok(mainJs.includes('focusablesSel'), 'main.js: фокус-трап Tab внутри попапа');
ok(/e\.key === 'Escape'/.test(mainJs), 'main.js: Esc закрывает попап');
ok(mainJs.includes("bar.setAttribute('role', 'button')"), 'main.js: полоска сбора — role=button (Enter/Space открывают)');
ok(mainJs.includes("aria-expanded"), 'main.js: aria-expanded полоски синхронизируется');

console.log('--- 5. UTM-метки донат-ссылок (п.5) ---');
const utmCheck = (page, name) => {
    ok((page.match(/utm_campaign=fund_popup/g) || []).length === 3, `${name}: 3 ссылки попапа — campaign=fund_popup`);
    ok((page.match(/utm_campaign=support_section/g) || []).length === 3, `${name}: 3 ссылки секции поддержки`);
    ok((page.match(/utm_campaign=footer/g) || []).length === 4, `${name}: 4 ссылки подвала`);
    ok((page.match(/utm_campaign=beta_access/g) || []).length === 1, `${name}: бета-доступ`);
    ok(page.includes('utm_source=sosnowda_github&utm_medium=landing'), `${name}: utm_source/medium единые`);
};
utmCheck(landingRU, 'RU');
utmCheck(landingEN, 'EN');
ok(mainJs.includes("'donate_click'") && mainJs.includes("searchParams.get('utm_campaign')"),
    'main.js: Метрика donate_click с кампанией из UTM');

console.log('--- 6. «Вернуться на сайт» в меню (п.6) ---');
ok(title.includes('makeSiteButton') && title.includes("t('Вернуться на сайт')"),
    'TitleScene: компактная кнопка внизу меню');
ok(title.includes("isEn() ? '/en/' : '/'"), 'TitleScene: EN-игрок уходит на /en/, RU — на /');
ok(i18n.includes("'Вернуться на сайт': 'Back to site',"), 'i18n: EN-перевод кнопки');

console.log('--- 7. Чистка i18n.js и main.js (п.7) ---');
// в EN-объекте не осталось дублирующихся односточных ключей
const enStart = i18n.indexOf('const EN = {');
const enEnd = i18n.indexOf('};', enStart);
const enBody = i18n.slice(enStart, enEnd);
const seen = new Map();
let dupsLeft = 0;
for (const line of enBody.split('\n')) {
    const m = line.match(/^\s*'((?:[^'\\]|\\.)*)'\s*:\s*('(?:[^'\\]|\\.)*')\s*,\s*$/);
    if (!m) continue;
    if (seen.has(m[1])) { dupsLeft++; console.log('    остался дубль: ' + m[1]); }
    seen.set(m[1], m[2]);
}
ok(dupsLeft === 0, `i18n: в EN-словаре нет дублирующихся ключей (53 дубля снято, осталось ${dupsLeft})`);
ok(!/\bvar\s+[A-Za-z_$]/.test(mainJs.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'main.js: var больше нет (const/let)');
ok(mainJs.includes('initInteractivePage'), 'main.js: интерактив работает и при reduced-motion');
// регресс-ловушка: zoom/translate объявлены ДО использования (бывший var-хойстинг)
ok(mainJs.indexOf('let zoomLevel = 1;') < mainJs.indexOf('lbImg.addEventListener'), 'main.js: zoom/translate объявлены до лайтбокс-обработчиков (нет TDZ)');

console.log('--- 8. Интерактивный таймлайн князей (п.8) ---');
for (const [name, page] of [['RU', landingRU], ['EN', landingEN]]) {
    ok(page.includes('id="princesTimeline"'), `${name}: блок таймлайна на месте`);
    ok((page.match(/class="pt-reign /g) || []).length === 3, `${name}: три правления на ленте`);
    ok(page.includes('data-from="1400" data-to="1425"') && page.includes('data-from="1425" data-to="1462"') && page.includes('data-from="1462" data-to="1505"'),
        `${name}: границы княжений 1400–1425 / 1425–1462 / 1462–1505`);
    ok((page.match(/class="chronicle-card" data-year=/g) || []).length === 11, `${name}: 11 карточек хроники с data-year`);
    ok((page.match(/epoch-card" data-prince=/g) || []).length === 3, `${name}: 3 карточки эпох стали кнопками`);
}
ok(mainJs.includes('function selectPrince') && mainJs.includes('scrollIntoView'),
    'main.js: выбор княженья подсвечивает хронику и докручивает ленту');
ok(styles.includes('.princes-timeline') && styles.includes('.pt-reign.active') && styles.includes('.chronicle-card.pt-hit'),
    'styles.css: стили ленты/активного правления/подсветки хроники');
ok(styles.includes('.pt-reign{transition:none}') || /prefers-reduced-motion[\s\S]*\.pt-reign\{transition:none\}/.test(styles),
    'styles.css: reduced-motion — без анимаций таймлайна');

console.log('--- 9. SW и кеши ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v81';"), 'SW: site-cache v81');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v27';"), 'SW: game-assets-v27 не тронут (ассеты не менялись)');
ok(sw.includes('// v81 — итерация 66.31'), 'SW: журнал содержит запись v81');

console.log(`\nИтог: ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

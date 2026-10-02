// test_round115.mjs — 66.67: контраст 5 футерных кнопок поддержки (P2 аудита §9/66.66,
// приказ владельца — «патч P2 (каскад .btn-support + тест-раунд с пересчётом контраста
// по паттерну r112) — он самый маленький и самый ценный»).
// ПРИЧИНА: .footer a{color:var(--gold-dim)=#8a6d1f} (styles.css:536, специфичность
// 0,1,1) перебивал .btn-support{color:#fff} (0,1,0) и цветовые модификаторы —
// независимо от порядка в каскаде все 5 кнопок поддержки в футере RU+EN рендерились
// тёмным золотом на фирменных ярких фонах: живой замер аудита 66.66 на проде —
// Boosty 2.07, ЮMoney 1.02, ВК 1.18, Автор ВК 1.03, Бета 2.57 — FAIL WCAG AA
// (0.9rem/400 → порог 4.5:1), ×10 кнопок; Lighthouse color-contrast совпал.
// РЕЦЕПТ (по аудиту, вариант «специфичность»): селекторы переведены на a.btn-support*
// (0,1,1) — победа по порядку следования (блок ниже .footer a в файле); разметка не
// тронута (все .btn-support — <a>, 22 шт. RU+EN), hover-механика (.footer a:hover) не
// тронута. Пересчёт контраста прямо в тесте (паттерн r112): 7.93/4.99/5.80/4.72/5.61 —
// PASS AA; контрольные дефектные пары дают 1.02–2.58 (сходится с замером «до»).
// Здесь закреплена СТАТИКА (структура styles.css + разметка футера + SW + документация)
// и WCAG-математика (пересчёт контраста прямо в тесте — значения не смогут откатиться
// ниже AA незаметно).
// Запуск из корня репозитория: node game/tools/test_round115.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const sitemap = read('sitemap.xml');
const indexRu = read('index.html');
const indexEn = read('en/index.html');

console.log('--- 1. Канонический блок: ровно 8 правил a.btn-support*, ноль непрефиксованных ---');
const rules = styles.match(/^a\.btn-support[a-z-]*\{[^}]*\}/gm) || [];
ok(rules.length === 8, `styles.css: ровно 8 правил a.btn-support* (найдено ${rules.length})`);
ok((styles.match(/^\s*\.btn-support[a-z-]*\{/gm) || []).length === 0,
    'styles.css: непрефиксованных правил .btn-support* больше нет (упоминания в док-комментарии не в счёт — проверка по началу строки)');
ok(/^a\.btn-support\{[^}]*color:#fff/m.test(styles), 'a.btn-support: база держит color:#fff (побеждает .footer a в футере)');
ok(/^a\.btn-support--boosty\{background:#ff8a00;color:#1a1005\}$/m.test(styles), 'a.btn-support--boosty: фон #ff8a00, текст #1a1005');
ok(/^a\.btn-support--yoomoney\{background:#8b3dff\}$/m.test(styles) &&
   /^a\.btn-support--vk\{background:#0062cc\}$/m.test(styles) &&
   /^a\.btn-support--vkauthor\{background:#4a76a8\}$/m.test(styles), 'модификаторы yoomoney/vk/vkauthor: фирменные фоны не тронуты');
ok(/^a\.btn-support--beta\{background:#333;color:#C9A961;border:1px solid #C9A961\}$/m.test(styles), 'a.btn-support--beta: #333/#C9A961/рамка целы');
ok(/^a\.btn-support--block\{display:block;padding:0\.8rem\}$/m.test(styles) &&
   /^a\.btn-support--footer\{padding:0\.6rem 1\.5rem;font-size:0\.9rem\}$/m.test(styles), 'геометрия --block/--footer не тронута');
const comment = styles.slice(styles.lastIndexOf('/*', styles.indexOf('a.btn-support{')), styles.indexOf('a.btn-support{'));
ok(comment.includes('66.67') && comment.includes('P2 аудита §9/66.66') && comment.includes('7.93') && comment.includes('4.99'),
    'док-комментарий 66.67 над блоком: причина (специфичность .footer a) + пересчёт');

console.log('--- 2. Порядок каскада: блок ниже .footer a; .footer a и hover не тронуты ---');
const footerA = styles.indexOf('.footer a {');
const supportBlock = styles.indexOf('a.btn-support{');
ok(footerA > -1 && supportBlock > footerA, `порядок: .footer a (индекс ${footerA}) ВЫШЕ a.btn-support (индекс ${supportBlock}) — равная специфичность 0,1,1, побеждает поздняя`);
ok((styles.match(/^        \.footer a \{/gm) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН .footer a { (ссылки футера без фона живут им)');
ok(styles.includes('.footer a:hover {\n            color: var(--gold-bright);'), 'hover-механика .footer a:hover не тронута (вне находки P2)');

console.log('--- 3. Разметка футера RU+EN: 5 кнопок с классами на месте (HTML не менялся) ---');
for (const [html, locale] of [[indexRu, 'RU'], [indexEn, 'EN']]) {
    const footerPart = html.slice(html.indexOf('<!-- ПОДВАЛ') > -1 ? html.indexOf('<!-- ПОДВАЛ') : html.lastIndexOf('<footer'));
    ok(/btn-support btn-support--footer btn-support--boosty/.test(footerPart) &&
       /btn-support btn-support--footer btn-support--yoomoney/.test(footerPart) &&
       /btn-support btn-support--footer btn-support--vk["\s]/.test(footerPart) &&
       /btn-support btn-support--footer btn-support--vkauthor/.test(footerPart) &&
       /btn-support btn-support--footer btn-support--beta/.test(footerPart),
       `${locale}: все 5 футерных кнопок с прежними классами (разметка не тронута)`);
}
ok((indexRu.match(/class="btn-support/g) || []).length === 11 && (indexEn.match(/class="btn-support/g) || []).length === 11,
    'RU+EN: по 11 использований .btn-support (3 секция + 5 футер + 3 попап) — все <a>');

console.log('--- 4. WCAG-математика: пересчёт контраста прямо в тесте (regress-guard) ---');
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const ratio = (f, b) => { const a = lum(f), c = lum(b); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
const after = [
    ['#1a1005', '#ff8a00', 7.93, 'Boosty: #1a1005 на #ff8a00'],
    ['#ffffff', '#8b3dff', 4.99, 'ЮMoney: #fff на #8b3dff'],
    ['#ffffff', '#0062cc', 5.80, 'ВК игры: #fff на #0062cc'],
    ['#ffffff', '#4a76a8', 4.72, 'Автор ВК: #fff на #4a76a8'],
    ['#C9A961', '#333333', 5.61, 'Бета: #C9A961 на #333'],
];
for (const [fg, bg, expect, name] of after) {
    const r = ratio(fg, bg);
    ok(r >= 4.5 && Math.abs(r - expect) < 0.01, `${name} = ${r.toFixed(2)}:1 (AA PASS, эталон ${expect})`);
}
const before = [
    ['#8a6d1f', '#ff8a00', 2.07, 'контроль Boosty'],
    ['#8a6d1f', '#8b3dff', 1.02, 'контроль ЮMoney'],
    ['#8a6d1f', '#0062cc', 1.18, 'контроль ВК игры'],
    ['#8a6d1f', '#4a76a8', 1.04, 'контроль Автор ВК (замер аудита 1.03 — округление)'],
    ['#8a6d1f', '#333333', 2.58, 'контроль Бета (замер аудита 2.57 — округление)'],
];
for (const [fg, bg, expect, name] of before) {
    const r = ratio(fg, bg);
    ok(r < 4.5 && Math.abs(r - expect) < 0.02, `${name}: прежний #8a6d1f даёт ${r.toFixed(2)}:1 (FAIL AA — методика сходится с замером «до»)`);
}

console.log('--- 5. SW: бамп по §4 (styles.css изменён), механика не тронута ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v109';"), 'sw.js: site-cache v109 (актуализация 66.67 — P2 аудита §9/66.66: контраст футерных кнопок поддержки, каскад a.btn-support*; изменение styles.css → бамп)');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v42';"), 'sw.js: game-assets-v42 без изменений (ассеты не тронуты)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел (правка цвета не трогала SW-логику)');
ok(swlog.includes('- v109 — итерация 66.67'), 'SW_CHANGELOG: запись v109 добавлена');

console.log('--- 6. Документация патча ---');
ok(changes.includes('## Патч 66.67') && changes.includes('a.btn-support*') && changes.includes('7.93') && changes.includes('2.57'),
    'CHANGES.md: секция «Патч 66.67» с рецептом и пересчётом');
ok(changes.includes('P2 аудита §9/66.66'), 'CHANGES.md: привязка к находке P2 аудита §9/66.66');
ok((sitemap.match(/<url>/g) || []).length === 3 && (sitemap.match(/hreflang=/g) || []).length === 6, 'sitemap: структура цела (3 URL, hreflang 3×2)');

let checkOk = true, checkOut = '';
try {
    checkOut = execSync('python3 game/tools/bump_lastmod.py --check', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
    checkOk = false;
    checkOut = (e.stdout || '') + (e.stderr || '');
}
ok(checkOk, 'bump_lastmod.py --check: sitemap синхронен фактам git (дрейфа нет)' + (checkOk ? '' : '\n' + checkOut));

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

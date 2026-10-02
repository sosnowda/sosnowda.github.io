// test_round112.mjs — 66.62: контраст текста полосы сбора (P3-1 аудита 66.61,
// приказ владельца — первая из 5 находок аудита, единственная заметная).
// ПРИЧИНА: текст полоски — обычный кегль (0.9rem/0.72rem, вес 400) — по WCAG AA
// обязан держать 4.5:1, но #C9A961 давал 5.09 на тёмных краях базы, 3.77 в
// центре градиента и 2.61–3.77 на hover (живой замер scripts/contrast_fundbar_66_62.mjs).
// РЕЦЕПТ (по аудиту с пересчётом): color #C9A961→#E8D5A3 (рецепт аудита) +
// светлый стоп hover #B53925→#A23417 — осветление одного лишь текста давало на
// прежнем стопе только 4.05. Итог: база 7.90/5.85/7.90, hover 4.76/5.85 —
// минимум 4.76:1, запас над AA 5.8 процента. computed-сверка до/после — ровно
// 6 изменений (color и hover-градиент × 3 вьюпорта), остальное бит-в-бит
// (baseline_66_62_before/after.json).
// Здесь закреплена СТАТИКА (структура styles.css + SW + документация) и
// WCAG-математика (пересчёт контраста прямо в тесте — значения не смогут
// откатиться ниже AA незаметно).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v42 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round112.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const r111 = read('game/tools/test_round111.mjs');
const sitemap = read('sitemap.xml');

console.log('--- 1. Канонический блок: color #E8D5A3 (рецепт аудита P3-1) ---');
const canon = styles.indexOf('\n.fund-bar{');
const canonEnd = styles.indexOf('\n}', canon);
const block = styles.slice(canon, canonEnd + 3);
ok(block.includes('  color:#E8D5A3;'), 'канонический блок: color #E8D5A3 применён');
ok(!block.includes('color:#C9A961'), 'канонический блок: прежний color #C9A961 как ЗНАЧЕНИЯ больше нет (упоминание в док-комментарии не в счёт)');
ok(block.includes('66.62 (P3-1 аудита 66.61'), 'канонический блок: док-комментарий 66.62 с причиной (порог AA, замер до правки)');
ok(block.includes('#E8D5A3') && block.includes('#A23417') && block.includes('4.05') && block.includes('4.76'), 'док-комментарий: пересчёт зафиксирован (осветление одного текста на hover давало лишь 4.05 → стоп затемнён до #A23417, минимум 4.76)');
// базовые свойства 66.58–66.60 не тронуты:
ok(block.includes('background:linear-gradient(90deg, #6B1F15, #8B2C1A, #6B1F15) !important;'), 'канонический блок: базовый градиент не тронут');
ok(block.includes('  line-height:1.2;') && block.includes('font-size:0.9rem') && block.includes('padding:0.6rem'), 'канонический блок: line-height 66.60 и кегль/паддинг 66.58 целы');

console.log('--- 2. Hover: стоп #A23417, important и правый стоп целы ---');
ok(styles.includes('.fund-bar:hover{\n  background:linear-gradient(90deg,#A23417,#8B2C1A) !important;'), 'hover: linear-gradient(90deg,#A23417,#8B2C1A) !important (актуализированное значение 66.62)');
ok(!styles.includes('#B53925,#8B2C1A'), 'hover: прежняя пара стопов #B53925,#8B2C1A как ЗНАЧЕНИЙ больше нет (упоминание #B53925 осталось только в док-комментариях)');
ok((styles.match(/\.fund-bar:hover\{/g) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН .fund-bar:hover{');
const hoverIdx = styles.indexOf('.fund-bar:hover{');
const hoverComment = styles.slice(Math.max(0, styles.lastIndexOf('/*', hoverIdx)), hoverIdx);
ok(hoverComment.includes('66.62') && hoverComment.includes('#B53925→#A23417'), 'hover: док-комментарий 66.62 над правилом (important/правый стоп — из 66.56/66.58)');
ok(hoverIdx > canon, 'структура 66.58/66.59 цела (hover после канонического блока)');

console.log('--- 3. WCAG-математика: пересчёт контраста прямо в тесте (regress-guard) ---');
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const ratio = (f, b) => { const a = lum(f), c = lum(b); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
const pairs = [
    ['#E8D5A3', '#6B1F15', 7.90, 'база, тёмный край'],
    ['#E8D5A3', '#8B2C1A', 5.85, 'база, центр градиента'],
    ['#E8D5A3', '#A23417', 4.76, 'hover, левый стоп'],
];
for (const [fg, bg, expect, name] of pairs) {
    const r = ratio(fg, bg);
    ok(r >= 4.5 && Math.abs(r - expect) < 0.01, `${name}: ${fg} на ${bg} = ${r.toFixed(2)}:1 (AA PASS, эталон ${expect})`);
}
ok(ratio('#C9A961', '#8B2C1A').toFixed(2) === '3.77' && ratio('#C9A961', '#B53925').toFixed(2) === '2.61', 'контрольная сверка методики: прежние дефектные значения дают 3.77/2.61 (совпадает с замером «до» — формула верна)');

console.log('--- 4. Соседи не тронуты (66.58/66.59/66.60) ---');
ok((styles.match(/^\.fund-bar\{/gm) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН верхнеуровневый .fund-bar{');
const mob = styles.indexOf('@media (max-width: 480px){\n  .fund-bar{');
ok(mob > hoverIdx, 'media-блок 66.59 по-прежнему ПОСЛЕ hover (мобильный override жив)');
ok(styles.includes('/* (66.59) .fund-bar переехал'), 'комментарий-указатель 66.59 на месте');
ok(styles.includes('button.fund-bar{display:block;width:100%;border:none;appearance:none;-webkit-appearance:none}'), 'button.fund-bar — сброс браузерного оформления не тронут');
ok(styles.includes('.fund-bar:focus-visible{outline:2px solid #C9A961;outline-offset:2px}'), '.fund-bar:focus-visible не тронут (outline — не текст полоски, вне находки P3-1)');
ok(block.includes('text-shadow:0 1px 1px rgba(0,0,0,0.5) !important;'), 'text-shadow полоски сохранён (поддержка читаемости)');

console.log('--- 5. SW: бамп по §4 (styles.css изменён), механика не тронута ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v112';"), 'sw.js: site-cache v112 (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v42';"), 'sw.js: game-assets-v42 без изменений (ассеты не тронуты)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел (правка цвета не трогала SW-логику)');
ok(swlog.includes('- v106 — итерация 66.62'), 'SW_CHANGELOG: запись v106 добавлена');

console.log('--- 6. Документация патча ---');
ok(changes.includes('## Патч 66.62') && changes.includes('#E8D5A3') && changes.includes('#A23417'), 'CHANGES.md: секция «Патч 66.62» с рецептом и пересчётом');
ok(changes.includes('P3-1 полного аудита 66.61'), 'CHANGES.md: привязка к находке P3-1 аудита 66.61');
ok(r111.includes('актуализация 66.62'), 'test_round111.mjs: актуализирован с комментарием причины (§6)');
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

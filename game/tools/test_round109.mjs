// test_round109.mjs — 66.58: консолидация блоков .fund-bar (657+786) —
// отложенная опция аудита 66.56 (P3-1), паттерн консолидации 66.49.
// Бывшие блоки: базовый 657 (.fund-bar{…#8B2C1A,#5A1A0E…}) и тематический
// 786 «выгравированный камень» (background/border-bottom/text-shadow с
// !important) слиты в ОДИН канонический; значения = ИТОГ прежнего каскада.
// Мёртвый hover-однострочник 658 снят — остался единственный working-hover
// (важный: important-фон базы иначе его перебил бы — первопричина 66.56).
// Рендер бит-в-бит: computed-стили 24 свойства × 3 вьюпорта (RU desktop,
// RU mobile 390, EN desktop) + hover-градиент сверены живым смоуком до/после
// (diff пуст) — см. CHANGES.md «Патч 66.58» и scripts/smoke_66_58.mjs.
// Здесь закреплена СТАТИКА (структура styles.css + SW + документация).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v43 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round109.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const audit = read('docs/AUDIT_R66_56.md');
const r108 = read('game/tools/test_round108.mjs');
const sitemap = read('sitemap.xml');

console.log('--- 1. Консолидация: единственный канонический блок ---');
ok((styles.match(/^\.fund-bar\{/gm) || []).length === 1, 'styles.css: ровно ОДИН верхнеуровневый .fund-bar{ (657+786 слиты)');
ok((styles.match(/\.fund-bar:hover\{/g) || []).length === 1, 'styles.css: ровно ОДИН .fund-bar:hover{ (мёртвый 658 снят)');

console.log('--- 2. Значения = итог прежнего каскада (рендер бит-в-бит) ---');
const base = styles.indexOf('\n.fund-bar{'); // с начала строки — иначе попадёт упоминание button.fund-bar{…} в комментарии выше
const hover = styles.indexOf('.fund-bar:hover{');
ok(base !== -1 && hover > base, 'styles.css: hover ПОСЛЕ канонического блока');
const block = styles.slice(base, styles.indexOf('}', base) + 1);
ok(block.includes('background:linear-gradient(90deg, #6B1F15, #8B2C1A, #6B1F15) !important;'), 'канонический блок: тематический фон «выгравированный камень» (!important — как у победителя каскада)');
ok(block.includes('border-bottom:1px solid rgba(201,169,97,0.2) !important;'), 'канонический блок: border-bottom с !important (иначе button.fund-bar{border:none} (0,1,1) его перебьёт)');
ok(block.includes('text-shadow:0 1px 1px rgba(0,0,0,0.5) !important;'), 'канонический блок: text-shadow с !important (как у победителя каскада)');
// актуализация 66.62: color #C9A961→#E8D5A3 (контраст полоски, P3-1 аудита 66.61 — детали в r112)
ok(block.includes("color:#E8D5A3") && block.includes('font-family:\'PT Sans\',sans-serif'), 'канонический блок: color 66.62 (#E8D5A3) и font-family из 657 сохранены');
ok(block.includes('text-align:center') && block.includes('padding:0.6rem') && block.includes('font-size:0.9rem'), 'канонический блок: text-align/padding/font-size из 657 сохранены');
ok(block.includes('cursor:pointer') && block.includes('position:sticky') && block.includes('top:0') && block.includes('z-index:1000'), 'канонический блок: cursor/sticky/top/z-index из 657 сохранены');
ok(styles.includes('.fund-bar:hover{\n  background:linear-gradient(90deg,#A23417,#8B2C1A) !important;'), 'styles.css: working-hover (#A23417,#8B2C1A — актуализация 66.62) с !important (важный — первопричина 66.56 учтена)');

console.log('--- 3. Легаси снят насовсем, соседи не тронуты ---');
ok(!styles.includes('.fund-bar:hover{background:linear-gradient(90deg,#A23417,#8B2C1A)}') && !styles.includes('.fund-bar:hover{background:linear-gradient(90deg,#B53925,#8B2C1A)}'), 'мёртвый hover-однострочник 658 удалён (проверка по актуальным 66.62 и историческим значениям)');
ok(!styles.includes('linear-gradient(90deg,#8B2C1A,#5A1A0E)'), 'старый базовый градиент 657 (#8B2C1A,#5A1A0E) удалён');
ok(!styles.includes('выгравированный камень */\n.fund-bar{'), 'старого автономного тематического блока 786 больше нет');
ok(styles.includes('/* Плашка альфа-версии — выгравированный камень */'), 'тематическое имя сохранено в шапке канонического блока');
ok(styles.includes('Консолидация 66.58') && styles.includes('button.fund-bar{border:none}'), 'комментарий канонического блока документирует консолидацию и конкурента button.fund-bar');
ok(styles.includes('font-size:0.72rem') && styles.includes('text-overflow: ellipsis'), 'media query 480px (однострочность на узких экранах) не тронут');
ok(styles.includes('button.fund-bar{display:block;width:100%;border:none;appearance:none;-webkit-appearance:none}'), 'button.fund-bar — сброс браузерного оформления не тронут (аудит №20)');
ok(styles.includes('.fund-bar:focus-visible{outline:2px solid #C9A961;outline-offset:2px}'), '.fund-bar:focus-visible не тронут');

console.log('--- 4. SW: бамп по §4 (styles.css изменён), механика не тронута ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v117';"), 'sw.js: site-cache v112 (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v43';"), 'sw.js: game-assets-v43 без изменений (ассеты не тронуты)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел (консолидация CSS не трогала SW-логику)');
ok(swlog.includes('- v103 — итерация 66.58'), 'SW_CHANGELOG: запись v103 добавлена');

console.log('--- 5. Документация патча ---');
ok(changes.includes('## Патч 66.58') && changes.includes('Консолидация'), 'CHANGES.md: секция «Патч 66.58» с описанием консолидации');
ok(audit.includes('ВНЕДРЕНА в патче 66.58'), 'AUDIT_R66_56.md: отложенная консолидация помечена ВНЕДРЕНА в 66.58');
ok(r108.includes('актуализация 66.58'), 'test_round108.mjs: актуализирован с комментарием причины (§6)');
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

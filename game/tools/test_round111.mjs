// test_round111.mjs — 66.60: высота полоски сбора по контенту (приказ владельца,
// продолжение линии 66.59 «выровнять мобильный вид полоски»).
// ПРИЧИНА: UA-стиль button{font:…} сбрасывает наследуемый line-height в normal,
// и высота .fund-bar зависела от метрик РЕАЛЬНОГО шрифта устройства:
// 'PT Sans' вебфонтом не загружен (link несёт только Prata/PT Serif) — рендерит
// локальный sans-serif (Segoe UI/Roboto/DejaVu…) со своими normal-метриками.
// Замер 6 шрифтов: разброс высоты 1.00px при normal (Carlito 38.19 против
// 37.19) → 0.00px при 1.2 (все ровно 37.47px desktop / 29.19px mobile).
// Вклад emoji/текста = 0.00px (проба с/без 💰 и ASCII-only — scripts/).
// РЕЦЕПТ: явный line-height:1.2 в каноническом блоке — высота = 1.2×кегль +
// паддинг на любом устройстве; mobile наследует (media-блок 480px переопределяет
// только кегль/паддинг — 66.59 цел). 24 базовых computed-свойства и hover —
// бит-в-бит (baseline_66_60_before/after.json, diff пуст).
// Здесь закреплена СТАТИКА (структура styles.css + SW + документация).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v44 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round111.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const r110 = read('game/tools/test_round110.mjs');
const sitemap = read('sitemap.xml');

console.log('--- 1. Канонический блок: явный line-height:1.2 (высота по контенту) ---');
const canon = styles.indexOf('\n.fund-bar{');
const canonEnd = styles.indexOf('\n}', canon);
const block = styles.slice(canon, canonEnd + 3);
ok(block.includes('  line-height:1.2;'), 'канонический блок: явный line-height:1.2 (пин высоты к контенту)');
ok(block.includes('66.60 (приказ владельца'), 'канонический блок: док-комментарий 66.60 с причиной (button{font:…} → normal, фолбэк-метрики)');
ok(block.includes("'PT Sans' вебфонтом НЕ загружен") || block.includes("'PT Sans' вебфонтом не загружен"), 'док-комментарий: задокументировано отсутствие PT Sans в вебфонтах (фолбэк-метрики устройств)');
ok(block.includes('0.00px при 1.2'), 'док-комментарий: замер 6 шрифтов (1.00px разброс при normal → 0.00px при 1.2) зафиксирован');
ok(canon !== -1 && canon < styles.indexOf('.fund-bar:hover{'), 'структура 66.58/66.59 цела (канонический блок перед hover)');

console.log('--- 2. Соседи не тронуты: кегль/паддинг/hover/media-блок 66.59 ---');
ok(block.includes('font-size:0.9rem') && block.includes('padding:0.6rem'), 'канонический блок: десктопные кегль/паддинг не тронуты');
ok((styles.match(/^\.fund-bar\{/gm) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН верхнеуровневый .fund-bar{');
ok((styles.match(/\.fund-bar:hover\{/g) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН .fund-bar:hover{');
// актуализация 66.62: hover-стоп #B53925→#A23417 (контраст полоски, P3-1 аудита 66.61 — детали в r112)
ok(styles.includes('.fund-bar:hover{\n  background:linear-gradient(90deg,#A23417,#8B2C1A) !important;'), 'working-hover с !important не тронут (66.56/66.58, значение 66.62)');
const mob = styles.indexOf('@media (max-width: 480px){\n  .fund-bar{');
ok(mob > styles.indexOf('.fund-bar:hover{'), 'media-блок 66.59 по-прежнему ПОСЛЕ hover (мобильный override жив)');
const mobBlock = styles.slice(mob, styles.indexOf('}', styles.indexOf('{', mob)) + 1);
ok(!mobBlock.includes('line-height'), 'media-блок 480px БЕЗ собственного line-height (наследует 1.2 от базы — по дизайну 66.60)');
ok(mobBlock.includes('font-size:0.72rem;') && mobBlock.includes('padding:0.45rem 10px;'), 'media-блок 66.59: мобильный кегль 0.72rem / паддинг 0.45rem 10px целы');
ok(styles.includes('/* (66.59) .fund-bar переехал'), 'комментарий-указатель 66.59 на месте');

console.log('--- 3. SW: бамп по §4 (styles.css изменён), механика не тронута ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v124';"), 'sw.js: site-cache v124 (актуализация 66.91) (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 без изменений (ассеты не тронуты)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел (правка CSS не трогала SW-логику)');
ok(swlog.includes('- v105 — итерация 66.60'), 'SW_CHANGELOG: запись v105 добавлена');

console.log('--- 4. Документация патча ---');
ok(changes.includes('## Патч 66.60') && changes.includes('line-height:1.2'), 'CHANGES.md: секция «Патч 66.60» с описанием пина высоты');
ok(r110.includes('актуализация 66.60'), 'test_round110.mjs: актуализирован с комментарием причины (§6)');
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

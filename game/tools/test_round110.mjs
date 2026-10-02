// test_round110.mjs — 66.59: мобильный кегль полосы сбора (приказ владельца,
// решение отложенного наблюдения консолидации 66.58: «базовые 0.9rem/0.6rem
// перебивают media-кегль 0.72rem на мобильных»).
// ПРИЧИНА: правило .fund-bar из @media (max-width: 480px) стояло в файле ДО
// канонического блока 66.58; при равной специфичности (0,1,0) побеждает
// позднее правило — базовые font-size:0.9rem/padding:0.6rem перебивали
// мобильные 0.72rem / 0.45rem 10px (white-space/overflow/text-overflow
// применялись — база их не объявляет). РЕЦЕПТ: правило перенесено в новый
// media-блок сразу ПОСЛЕ .fund-bar:hover — override теперь побеждает по
// порядку следования. Значения прежние; десктоп (>480px) не менялся.
// Рендер-доказательство: computed-сверка baseline_fundbar_66_58.mjs до/после —
// ровно 5 изменений на ru_mobile (fontSize 14.4→11.52px, padding 9.6→7.2/10px),
// десктоп RU/EN и hover бит-в-бит (см. smoke_66_59 и CHANGES «Патч 66.59»).
// актуализация 66.60: SW-ожидание v104→v105 (высота полоски по контенту —
// явный line-height:1.2 в каноническом блоке; детали — в r111).
// Здесь закреплена СТАТИКА (структура styles.css + SW + документация).
// актуализация 66.63: SW-ожидание v106→v107; P3-3 порядок заголовков (попап после h1, h4→h3 ×22) + P3-2 canonical/sr-only h1 игры (аудит 66.61 — детали в r113)
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v42 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round110.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const styles = read('styles.css');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const r109 = read('game/tools/test_round109.mjs');
const sitemap = read('sitemap.xml');

console.log('--- 1. Переезд media-правила: override ПОСЛЕ канонического блока ---');
const canon = styles.indexOf('\n.fund-bar{');                 // канонический блок 66.58 (с начала строки)
const hover = styles.indexOf('.fund-bar:hover{');
const mob = styles.indexOf('@media (max-width: 480px){\n  .fund-bar{'); // новый media-блок 66.59
ok(canon !== -1 && hover !== -1 && mob !== -1, 'styles.css: канонический блок, hover и новый media-блок 66.59 найдены');
ok(hover > canon, 'styles.css: hover по-прежнему после канонического блока (66.58 цел)');
ok(mob > hover, 'styles.css: media-блок 66.59 стоит ПОСЛЕ hover канонического блока (порядок следования = победа override)');

console.log('--- 2. Значения прежние: мобильный кегль 0.72rem применяемый ---');
const mobBlock = styles.slice(mob, styles.indexOf('}', styles.indexOf('{', mob)) + 1);
ok(mobBlock.includes('font-size:0.72rem;'), 'media 66.59: font-size:0.72rem (кегль, перебивавшийся базой)');
ok(mobBlock.includes('padding:0.45rem 10px;'), 'media 66.59: padding:0.45rem 10px (паддинг, перебивавшийся базой)');
ok(mobBlock.includes('white-space:nowrap;') && mobBlock.includes('overflow:hidden;') && mobBlock.includes('text-overflow: ellipsis;'), 'media 66.59: nowrap/hidden/ellipsis — однострочность прежняя');
ok(mobBlock.includes('.fund-bar{'), 'media 66.59: селектор .fund-bar');
// База (десктоп) не менялась:
const baseBlock = styles.slice(canon, styles.indexOf('}', canon) + 1);
ok(baseBlock.includes('font-size:0.9rem') && baseBlock.includes('padding:0.6rem'), 'канонический блок: базовые 0.9rem/0.6rem для десктопа НЕ тронуты');
ok((styles.match(/^\.fund-bar\{/gm) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН верхнеуровневый .fund-bar{');
ok((styles.match(/\.fund-bar:hover\{/g) || []).length === 1, 'styles.css: по-прежнему ровно ОДИН .fund-bar:hover{');

console.log('--- 3. Старое место чисто, соседи не тронуты ---');
const oldMediaStart = styles.indexOf('@media (max-width: 480px) {');
ok(oldMediaStart !== -1 && oldMediaStart < canon, 'старый media-блок 480px на прежнем месте (до канонического блока)');
const oldMediaEnd = styles.indexOf('}', styles.indexOf('/* (66.59) .fund-bar переехал', oldMediaStart));
const oldMedia = styles.slice(oldMediaStart, oldMediaEnd + 1);
ok(!/\.fund-bar\s*\{/.test(oldMedia), 'старый media-блок: ПРАВИЛА .fund-bar больше нет (упоминание в комментарии-указателе не в счёт, дубля нет)');
ok(styles.includes('/* (66.59) .fund-bar переехал'), 'старое место: комментарий-указатель 66.59 оставлен');
ok(styles.includes('/* Однострочная полоса сбора средств на узких экранах (66.59): правило'), 'новое место: док-комментарий 66.59 (причина переезда) присутствует');
ok(styles.includes('Однострочная полоса сбора средств на узких экранах'), 'историческое имя правила сохранено в комментарии');
ok(styles.includes('button.fund-bar{display:block;width:100%;border:none;appearance:none;-webkit-appearance:none}'), 'button.fund-bar — сброс браузерного оформления не тронут (аудит №20)');
ok(styles.includes('.fund-bar:focus-visible{outline:2px solid #C9A961;outline-offset:2px}'), '.fund-bar:focus-visible не тронут');
// актуализация 66.62: hover-стоп #B53925→#A23417 (контраст полоски, P3-1 аудита 66.61 — детали в r112)
ok(styles.includes('.fund-bar:hover{\n  background:linear-gradient(90deg,#A23417,#8B2C1A) !important;'), 'working-hover с !important не тронут (66.56/66.58, значение 66.62)');

console.log('--- 4. SW: бамп по §4 (styles.css изменён), механика не тронута ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v112';"), 'sw.js: site-cache v112 (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v42';"), 'sw.js: game-assets-v42 без изменений (ассеты не тронуты)');
ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел (переезд CSS-правила не трогал SW-логику)');
ok(swlog.includes('- v104 — итерация 66.59'), 'SW_CHANGELOG: запись v104 добавлена');

console.log('--- 5. Документация патча ---');
ok(changes.includes('## Патч 66.59') && changes.includes('0.72rem'), 'CHANGES.md: секция «Патч 66.59» с описанием переезда');
ok(r109.includes('актуализация 66.58'), 'r109: строка актуализации 66.58 сохранена (r109:64 проверяет её)');
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

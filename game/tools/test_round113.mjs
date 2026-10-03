// test_round113.mjs — 66.63: P3-2 + P3-3 аудита 66.61 одной итерацией (приказ
// владельца — «аудит рекомендует их одной итерацией 66.63»).
// ПРИЧИНА (P3-3): на лендингах h3 попапа сбора стоял в DOM до sr-only h1
// (первый заголовок документа — h3), плюс три группы пропусков h2→h4
// (20×.detailed-item, .pt-detail-name, .share-block). ПРИЧИНА (P3-2): у
// game/index.html не было canonical и H1.
// РЕЦЕПТ: .fund-popup перенесён в конец body (после </footer>) — position:fixed,
// открытие по id, привязок CSS/JS к месту нет; тег h3 у попапа сохранён (ui.js);
// 22×h4→h3 с паритетом computed (text-shadow:none !important против глобального
// h1,h2,h3-правила 777, font-size:1rem у .share-block h3 против UA h4=1em);
// игре — canonical + sr-only H1 («видимый» из рецепта-кандидата перекрывал бы
// канвас — отклонение задокументировано в CHANGES.md).
// Здесь закреплена СТАТИКА: разметка RU/EN/игры, селекторы styles.css,
// порядок заголовков (статический разбор), SW v107, документация.
// актуализация 66.67: SW-ожидания v108→v109; P2 аудита §9/66.66 — контраст 5 футерных кнопок поддержки (каскад a.btn-support*, styles.css → бамп), game-assets-v43 без изменений (детали в r115)
// Запуск из корня репозитория: node game/tools/test_round113.mjs
import { execSync } from 'child_process';
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

// Статический разбор порядка заголовков: первый — h1, скачков >+1 нет
const outlineOrder = (page) => {
    const tags = [...page.matchAll(/<h([1-6])[\s>]/g)].map(m => +m[1]);
    let prev = 0;
    for (const lvl of tags) {
        if (prev === 0) { if (lvl !== 1) return false; }
        else if (lvl > prev + 1) return false;
        prev = lvl;
    }
    return true;
};

console.log('--- 1. P3-3: попап после </footer>, до h1 — больше нет ---');
for (const [name, page] of [['RU', ru], ['EN', en]]) {
    const iPopup = page.indexOf('id="fundPopup"');
    const iFooter = page.lastIndexOf('</footer>');
    const iH1 = page.indexOf('<h1 class="sr-only"');
    ok(iPopup > iFooter, `${name}: .fund-popup в DOM ПОСЛЕ </footer> (хвост body)`);
    ok(iPopup > iH1, `${name}: .fund-popup в DOM ПОСЛЕ sr-only h1`);
    const pointer = name === 'RU' ? '66.63 (аудит 66.61, P3-3): .fund-popup переехал в конец body' : '66.63 (audit 66.61, P3-3): .fund-popup moved to the end of <body>';
    ok(page.includes(pointer), `${name}: указатель-комментарий 66.63 на старом месте попапа`);
    const tail = name === 'RU' ? 'попап поддержки — теперь в конце body, ПОСЛЕ' : 'support popup now lives at the end of <body>';
    ok(page.includes(tail), `${name}: док-комментарий 66.63 у нового места попапа`);
    ok(page.includes('id="fundPopup" role="dialog" aria-modal="true" aria-labelledby="fundPopupTitle"'), `${name}: атрибуты диалога попапа целы (r87-набор)`);
    ok(page.includes('<h3 id="fundPopupTitle">'), `${name}: заголовок попапа — h3 СОХРАНЁН (семантика диалога, ui.js querySelector('h3') цел)`);
    ok(page.includes('class="fund-popup-content"') && (page.match(/fund_popup/g) || []).length === 3, `${name}: разметка попапа и 3 utm-ссылки переехали вместе`);
}

console.log('--- 2. P3-3: h4→h3 ×22, порядок без пропусков ---');
for (const [name, page] of [['RU', ru], ['EN', en]]) {
    ok(!page.includes('<h4') && !page.includes('</h4'), `${name}: тегов h4 на странице больше нет`);
    ok((page.match(/<h3>/g) || []).length >= 21, `${name}: карточки особенностей — <h3> (>=21 на странице)`);
    const items = page.split('<div class="detailed-item">').slice(1);
    ok(items.length === 20 && items.every(it => it.includes('<h3>')), `${name}: все 20 .detailed-item содержат h3`);
    ok(page.includes('<h3 class="pt-detail-name">') && !page.includes('<h4 class="pt-detail-name">'), `${name}: .pt-detail-name — h3`);
    ok(/class="share-block">\s*<h3>/.test(page), `${name}: .share-block — h3`);
    ok(outlineOrder(page), `${name}: статический порядок h1-h6 без пропусков, первый — h1`);
    const h1text = (page.match(/<h1 class="sr-only">([^<]+)<\/h1>/) || [])[1];
    ok(!!h1text, `${name}: sr-only h1 на месте («${h1text ? h1text.slice(0, 40) + '…' : 'НЕТ'}»)`);
}

console.log('--- 3. styles.css: селекторы и паритет ---');
ok(styles.includes('.detailed-item h3 {') && !styles.includes('.detailed-item h4'), 'styles: .detailed-item h4 → h3');
ok(/\.detailed-item h3 \{[^}]*text-shadow:\s*none !important;/s.test(styles), 'styles: .detailed-item h3 — паритет text-shadow:none !important (против правила 777)');
ok(styles.includes('.share-block h3{') && !styles.includes('.share-block h4'), 'styles: .share-block h4 → h3');
ok(/\.share-block h3\{[^}]*font-size:1rem;[^}]*text-shadow:none !important\}/.test(styles), 'styles: .share-block h3 — font-size:1rem (UA h4=1em) + паритет тени');
ok(/\.pt-detail-name\{[^}]*text-shadow:none !important\}/.test(styles), 'styles: .pt-detail-name — паритет тени');
ok(styles.includes("h1, h2, h3{\n  text-shadow:0 1px 0 rgba(0,0,0,0.5), 0 0 8px rgba(201,169,97,0.15) !important;\n}"), 'styles: глобальное правило 777 (гравированная тень h1-h3) не тронуто');
ok(styles.includes('.fund-popup-content h3{'), 'styles: стиль заголовка попапа (.fund-popup-content h3) не тронут');
ok(styles.includes('font-size:0.9rem') && styles.includes('line-height:1.2') && styles.includes('#E8D5A3'), 'регресс 66.58-66.62: канонический .fund-bar цел (0.9rem/1.2/#E8D5A3)');

console.log('--- 4. P3-2: game/index.html — canonical + sr-only H1 ---');
ok(game.includes('<link rel="canonical" href="https://sosnowda.github.io/game/">'), 'игра: link rel=canonical на /game/');
ok(game.includes('og:url" content="https://sosnowda.github.io/game/"'), 'игра: og:url совпадает с canonical (перекрёстная сверка)');
ok(game.includes('<h1 class="sr-only">Летописи Руси XV века — Браузерное демо</h1>'), 'игра: sr-only H1 с текстом og:title');
const bodyStart = game.indexOf('<body>');
const iH1 = game.indexOf('<h1 class="sr-only"');
const iContainer = game.indexOf('<main id="game-container">');
ok(bodyStart !== -1 && iH1 > bodyStart && iH1 < iContainer, 'игра: H1 — первый элемент body (до #game-container)');
ok(game.includes('.sr-only {') && game.includes('clip: rect(0, 0, 0, 0);') && game.includes('width: 1px; height: 1px;'), 'игра: .sr-only определён в инлайн-стилях (бит-в-бит из styles.css)');
ok(game.includes("errorEl.innerHTML = '<h2 style=\"color:#c9a961;margin-bottom:1rem;\">Игра не загрузилась</h2>"), 'игра: обработчик ошибки по-прежнему h2 (порядок h1→h2 стал корректным)');
ok(game.includes('<meta http-equiv="Content-Security-Policy"'), 'регресс 66.48: CSP игровой страницы цел');
ok(game.includes('<title>Летописи Руси — Браузерное демо</title>'), 'регресс: title игры не тронут');

console.log('--- 5. SW v107 + документация ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v117';"), 'sw.js: site-cache v112 (актуализация 66.70 — аудит владельца 66.70: onclick сняты, keywords снят, fetchpriority="low" снят, webvitals.js; HTML/CSS → бамп)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v43';"), 'sw.js: game-assets-v43 без изменений');
ok(sw.includes("event.request.mode !== 'navigate'") && sw.includes('return cached;'), 'регресс 66.57: navigate-гейт цел');
ok(swlog.includes('- v107 — итерация 66.63'), 'SW_CHANGELOG: запись v107 добавлена');
ok(swlog.includes('- v106 — итерация 66.62'), 'SW_CHANGELOG: запись v106 (история) сохранена');
ok(changes.includes('## Патч 66.63') && changes.includes('Порядок заголовков') && changes.includes('canonical/H1'), 'CHANGES.md: секция «Патч 66.63» на месте');
ok(changes.includes('НЕОЖИДАННЫХ (computed/геометрия) = 0'), 'CHANGES.md: зафиксирован паритет computed (0 неожиданных изменений)');
for (let n = 102; n <= 112; n++) {
    ok(read(`game/tools/test_round${n}.mjs`).includes('актуализация 66.63'), `r${n}: честная шапка актуализации 66.63`);
}

console.log('--- 6. bump_lastmod живым прогоном ---');
let checkOut = '', checkOk = true;
try {
    checkOut = execSync('python3 game/tools/bump_lastmod.py --check', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
    checkOk = false;
    checkOut = (e.stdout || '') + (e.stderr || '');
}
ok(checkOk, 'bump_lastmod.py --check: sitemap синхронен фактам git (дрейфа нет)' + (checkOk ? '' : '\n' + checkOut));

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
if (fail > 0) process.exit(1);

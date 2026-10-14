// test_round142.mjs — 66.105: фикс К2/К3/К4 frontier-аудита 66.104 (лендинги RU/EN).
//   К2а — мёртвая зона первого экрана: legacy-правило styles.css задавало
//         .hero-image-wrap{height:900px} (декоративный слой с content:''),
//         блок-консолидация :759 переопределяла width/position, но НЕ height
//         → computed 900px при картинке ~223px @390w = ~677px мёртвой зоны.
//         Фикс: height:auto в консолидированном правиле (последнее в файле —
//         перекрывает legacy по порядку каскада). left:50%+translateX —
//         механика центрирования, НЕ трогается.
//   К2б — первый экран не продавал продукт (claim и CTA вне вьюпорта
//         1440×900 И 390×844, кнопка игры на 87% глубины): value proposition
//         + кнопка демо ВЫШЕ арта (.hero-claim) + кнопка в sticky-шапке (.nav-cta).
//   К3  — «ФИНАЛЬНЫЙ CTA» не имел ни одной ссылки/кнопки (замер аудита: 0
//         элементов действия) → кнопка запуска демо в секции.
//   К4  — фактическая ошибка «Иван III родился в год падения Византии» при 1440:
//         Константинополь пал в 1453; в 1439 — Флорентийская уния церквей
//         (которую Русь отвергла → 1448 автокефалия, соседняя карточка).
//   К6а — противоречие «preload + loading=lazy»: ранний преплоад первого
//         скриншота галереи (lazy, низ страницы) конкурировал с LCP-героем.
// Запуск из корня репозитория: node game/tools/test_round142.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };
const CYR = /[\u0400-\u04FF]/;

const css = read('styles.css');
const ru = read('index.html');
const en = read('en/index.html');
// видимый контент без HTML-комментариев (комментарии-документация истории
// фикса НЕ считаются контентом страницы)
const ruBody = ru.replace(/<!--[\s\S]*?-->/g, '');
const enBody = en.replace(/<!--[\s\S]*?-->/g, '');

// ============================================================
// 1. К2а: каскад height:900px перекрыт
// ============================================================
console.log('--- 1. К2а: height:900px перекрыт height:auto ---');
{
    const legacy = css.match(/\.hero-image-wrap\s*\{[^}]*height:\s*900px[^}]*\}/);
    ok(!!legacy, 'legacy-правило с height:900px существует (история каскада)');
    const consolidated = css.match(/\.hero-image-wrap\{[^}]*\}/g) || [];
    const real = consolidated.find(m => m.includes('max-width:1180px'));
    ok(!!real, 'консолидированное правило :759 найдено');
    ok(!!real && real.includes('height:auto'), 'консолидированное правило задаёт height:auto (мёртвая зона устранена)');
    ok(!!real && real.indexOf('.hero-image-wrap{') === 0 && css.indexOf(real) > css.indexOf(legacy[0]),
        'консолидированное правило ПОЗЖЕ legacy в файле (побеждает по каскаду)');
    ok(!!real && !real.includes('transform:none'), 'центрирование left:50%+translateX не тронуто');
}

// ============================================================
// 2. К2б: value proposition + CTA выше фолда (RU и EN)
// ============================================================
console.log('--- 2. К2б: .hero-claim и .nav-cta (RU+EN) ---');
{
    for (const [lang, html] of [['RU', ru], ['EN', en]]) {
        const hero = html.indexOf('hero-claim');
        const wrap = html.indexOf('hero-image-wrap');
        ok(hero > -1 && hero < wrap, `${lang}: .hero-claim существует и стоит ВЫШЕ арта`);
        ok(html.includes('hero-claim-text') && html.includes('hero-claim .btn-game-start') === false
            && /hero-claim[\s\S]{0,400}?btn-game-start/.test(html), `${lang}: внутри claim — кнопка запуска`);
        ok(html.includes('class="nav-cta"'), `${lang}: кнопка игры в шапке (.nav-cta)`);
        const nav = html.indexOf('nav-cta');
        const langItem = html.indexOf('lang-item');
        ok(nav > -1 && nav < langItem, `${lang}: .nav-cta в меню до переключателя языка`);
    }
    // EN-claim — латиница; RU-claim — кириллица (каждый на своём языке)
    ok(!CYR.test((en.match(/hero-claim-text">([^<]+)</) || [])[1] || 'x'), 'EN: EN-claim без кириллицы');
    ok(CYR.test((ru.match(/hero-claim-text">([^<]+)</) || [])[1] || ''), 'RU: RU-claim на русском');
    ok(ru.includes('Играть в браузере'), 'RU: текст кнопки «Играть в браузере»');
    ok(en.includes('Play in browser'), 'EN: текст кнопки «Play in browser»');
    ok(en.includes('../game/index.html?lang=en'), 'EN: кнопка передаёт ?lang=en');
    // CSS блоков
    ok(/\.hero-claim\{/.test(css) && /\.hero-claim-text\{/.test(css), 'CSS: .hero-claim и .hero-claim-text оформлены');
    ok(/\.nav-links a\.nav-cta\{/.test(css), 'CSS: .nav-cta оформлен');
    ok(/@media \(max-width:768px\)\{\s*\.hero-claim\{/.test(css.replace(/\n/g, '')) || css.includes('.hero-claim{padding:1.25rem 16px 1rem}'), 'CSS: мобильная адаптация .hero-claim');
}

// ============================================================
// 3. К3: финальный CTA с элементом действия
// ============================================================
console.log('--- 3. К3: ФИНАЛЬНЫЙ CTA содержит кнопку ---');
{
    for (const [lang, html] of [['RU', ru], ['EN', en]]) {
        const m = html.match(/<section class="cta-section">([\s\S]*?)<\/section>/);
        ok(!!m, `${lang}: секция cta-section найдена`);
        const body = m ? m[1] : '';
        const hasAction = /<a\s[^>]*href="[^"]*game\/index\.html[^"]*"[^>]*class="btn-game-start"/.test(body);
        ok(hasAction, `${lang}: в секции есть ссылка-кнопка запуска игры`);
        ok(hasAction && /target="_blank" rel="noopener noreferrer"/.test(body), `${lang}: семантика кнопки — как у кнопки «Демо» (отдельное окно, noopener)`);
    }
}

// ============================================================
// 4. К4: ошибка «1440 = падение Византии» исправлена
// ============================================================
console.log('--- 4. К4: Иван III и 1440 (Флорентийская уния) ---');
{
    ok(!ruBody.includes('падения Византийских'), 'RU: «падения Византийских» убрано (в видимом контенте)');
    ok(!enBody.includes('Byzantine emperors fall'), 'EN: "Byzantine emperors fall" убрано (в видимом контенте)');
    ok(ru.includes('Флорентийской унии'), 'RU: 1440 = Флорентийская уния');
    ok(en.includes('Union of Florence'), 'EN: 1440 = Union of Florence');
    // карточка 1448 (автокефалия) осталась соседней — связка сюжета
    ok(ru.includes('data-year="1448"') && ru.includes('Автокефалия'), 'RU: карточка 1448 (автокефалия) на месте');
    ok(en.includes('data-year="1448"') && en.includes('Autocephaly'), 'EN: карточка 1448 на месте');
}

// ============================================================
// 5. К6а: противоречие preload+lazy снято, герой-преплоад цел
// ============================================================
console.log('--- 5. К6а: преплоады ---');
{
    ok(!ru.includes('rel="preload" href="assets/screenshots/01-title.webp"'), 'RU: преплоад ленивого скриншота удалён');
    ok(!en.includes('rel="preload" href="../assets/screenshots/01-title.webp"'), 'EN: преплоад ленивого скриншота удалён');
    ok(/rel="preload"[^>]*imagesrcset=/.test(ru), 'RU: отзывчивый преплоад героя (imagesrcset) цел');
    ok(/rel="preload"[^>]*imagesrcset=/.test(en), 'EN: отзывчивый преплоад героя цел');
    ok(/loading="lazy"[^>]*assets\/screenshots\/01-title/.test(ru.replace(/\n/g, ' ')) || (ru.includes('assets/screenshots/01-title.webp') && ru.includes('loading="lazy"')), 'RU: скриншот галереи остаётся lazy (внизу страницы)');
}

console.log(`\n=== test_round142 (К2/К3/К4/К6а): ${pass} ✓ / ${fail} ✗ ===`);
process.exit(fail > 0 ? 1 : 0);

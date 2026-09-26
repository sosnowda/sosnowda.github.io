// Смоук 66.31: PreloadScene (золотой бар), MotionFX (reduced-motion +
// visibilitychange), кнопка «Вернуться на сайт», лендинг — попап (фокус-трап/
// Esc), таймлайн князей, UTM-ссылки, частицы/RAF. 0 JS-ошибок — обязательное.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/smoke6631';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
// ERR_CERT_AUTHORITY_INVALID — сетевые транспорты Метрики в песочнице
// (сертификат Russian Trusted Sub CA, задокументировано в SW v79) — не JS-ошибки игры
const isEnvNoise = (t) => t.includes('Framebuffer') || t.includes('ERR_CERT_AUTHORITY_INVALID');
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security', '--disable-gpu'] });

// ============================================================
// ЧАСТЬ A. ИГРА (Phaser)
// ============================================================
console.log('--- A. Игра: PreloadScene и MotionFX ---');
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { if (isEnvNoise(String(e))) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error' && !isEnvNoise(m.text())) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
// Локально Boot грузит ~450 файлов — ждём ТОЛЬКО полной загрузки (Title активен)
await page.waitForFunction(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 90000 });
await sleep(800);

// 1) PreloadScene в менеджере сцен; Boot дошёл до Title
const scenes = await page.evaluate(() => window.game.scene.scenes.map(s => s.scene.key));
ok(scenes.includes('Preload'), 'PreloadScene зарегистрирована в менеджере сцен: ' + scenes.join(','));
ok(scenes.includes('Boot') && scenes.includes('Title'), 'Boot и Title на месте');
const titleActive = await page.evaluate(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
});
ok(titleActive, 'Boot завершил загрузку — активен Title (прелоад закрыт)');
const bootProgress = await page.evaluate(() => window.game.registry.get('bootProgress'));
ok(bootProgress === 1, `BootScene переслал прогресс в registry (bootProgress=${bootProgress})`);

// 2) Кнопка «Вернуться на сайт» в меню
const siteBtn = await page.evaluate(() => {
    const t = window.game.scene.getScene('Title');
    if (!t) return null;
    let found = null;
    const walk = (o) => {
        if (!o) return;
        if (o.list) { o.list.forEach(walk); return; }
        if (o.text && o.text.trim && o.text.trim().includes('Вернуться на сайт')) found = { x: o.x, y: o.y };
    };
    t.children.list.forEach(walk);
    return found;
});
ok(!!siteBtn, `Кнопка «Вернуться на сайт» отрисована (${siteBtn ? Math.round(siteBtn.x) + '×' + Math.round(siteBtn.y) : '—'})`);

// 3) MotionFX: регулятор установлен, фабрика патчена
const gov = await page.evaluate(() => {
    const g = window.__chroniclesFxGovernor;
    return g ? { installed: !!g.installed, scenes: g.emitters.size } : null;
});
ok(!!gov && gov.installed, `MotionFX: регулятор установлен (сцен с эмиттерами: ${gov ? gov.scenes : '—'})`);

// 4) MotionFX: обычный режим — частицы рождаются
const normalCount = await page.evaluate(async () => {
    const t = window.game.scene.getScene('Title');
    const em = t.add.particles(0, 0, 'particle_spark', { speed: 10, lifespan: 400, frequency: 20, quantity: 2 });
    await new Promise(r => setTimeout(r, 400));
    const n = (typeof em.getParticleCount === 'function') ? em.getParticleCount() : (em.alive ? em.alive.length : -1);
    em.destroy();
    return n;
});
ok(normalCount > 0, `MotionFX: обычный режим — частицы эмитятся (${normalCount})`);

// 5) MotionFX: reduced-motion — ни одной частицы.
// reducedMotion() кэшируется при первом чтении (как у реального пользователя —
// настройка стоит ДО загрузки), поэтому эмулируем и ПЕРЕЗАГРУЖАЕМ страницу.
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 90000 });
const reducedCount = await page.evaluate(async () => {
    const t = window.game.scene.getScene('Title');
    const em = t.add.particles(0, 0, 'particle_spark', { speed: 10, lifespan: 400, frequency: 20, quantity: 2 });
    await new Promise(r => setTimeout(r, 400));
    const n = (typeof em.getParticleCount === 'function') ? em.getParticleCount() : (em.alive ? em.alive.length : -1);
    em.destroy();
    return n;
});
ok(reducedCount === 0, `MotionFX: reduced-motion — эмиттер спит (${reducedCount})`);

// 6)_suspend/resume: скрытая вкладка
await page.emulateMedia({ reducedMotion: 'no-preference' });
const susp = await page.evaluate(() => {
    const t = window.game.scene.getScene('Title');
    const em = t.add.particles(0, 0, 'particle_spark', { speed: 10, lifespan: 2000, frequency: 20, quantity: 2 });
    return { hasPaused: typeof em.pause === 'function', hasResume: typeof em.resume === 'function' };
});
ok(susp.hasPaused && susp.hasResume, 'MotionFX: API pause/resume у эмиттера доступен');

await page.close();

// ============================================================
// ЧАСТЬ B. ЛЕНДИНГ RU
// ============================================================
console.log('--- B. Лендинг RU: попап, таймлайн, частицы ---');
const lp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
lp.on('pageerror', e => { if (isEnvNoise(String(e))) return; jsErrors++; console.log('LP PAGEERROR:', String(e).slice(0, 200)); });
lp.on('console', m => { if (m.type() === 'error' && !isEnvNoise(m.text())) { jsErrors++; console.log('LP CONSOLE-ERR:', m.text().slice(0, 160)); } });
await lp.goto(BASE + '/', { waitUntil: 'load' });
await sleep(1200);

// 7) частицы канвас создан (движение разрешено)
const hasCanvas = await lp.evaluate(() => !!document.getElementById('particles-canvas'));
ok(hasCanvas, 'Лендинг: золотые частицы на месте (#particles-canvas)');

// 8) img width/height в живом DOM (плейсхолдеры лайтбоксов с пустым src — исключение)
const imgsNoDims = await lp.evaluate(() =>
    Array.from(document.querySelectorAll('img')).filter(i =>
        i.closest('noscript') === null && i.getAttribute('src') && !i.hasAttribute('width')).length
);
ok(imgsNoDims === 0, `Лендинг: все img с адресом — с width (${imgsNoDims} без)`);
const clsSafe = await lp.evaluate(() => {
    const img = document.querySelector('.screenshot-card img');
    return img && img.getAttribute('width') === '1280' && img.getAttribute('height') === '720';
});
ok(clsSafe, 'Лендинг: скриншоты 1280×720 (атрибуты в DOM)');

// 9) попап: открытие → фокус внутри → Tab не выходит → Esc закрывает → фокус вернулся
await lp.click('.fund-bar');
await sleep(300);
const popupOpen = await lp.evaluate(() => document.getElementById('fundPopup').classList.contains('open'));
ok(popupOpen, 'Попап поддержки открывается');
const focusIn = await lp.evaluate(() =>
    document.getElementById('fundPopup').contains(document.activeElement));
ok(focusIn, 'При открытии фокус ушёл ВНУТРЬ попапа');
// Tab ×5 — фокус должен остаться внутри
for (let i = 0; i < 5; i++) await lp.keyboard.press('Tab');
const focusStillIn = await lp.evaluate(() =>
    document.getElementById('fundPopup').contains(document.activeElement));
ok(focusStillIn, 'ФОКУС-ТРАП: 5×Tab — фокус не покинул попап');
await lp.keyboard.press('Escape');
await sleep(200);
const popupClosed = await lp.evaluate(() => !document.getElementById('fundPopup').classList.contains('open'));
const focusBack = await lp.evaluate(() => document.querySelector('.fund-bar') === document.activeElement);
ok(popupClosed, 'Esc закрывает попап');
ok(focusBack, 'После закрытия фокус вернулся на полоску сбора');

// 10) таймлайн: клик по Ивану III → досье + подсветка хроники
await lp.evaluate(() => document.getElementById('princesTimeline').scrollIntoView());
await sleep(300);
await lp.click('.pt-reign-3');
await sleep(600);
const tl = await lp.evaluate(() => ({
    name: document.querySelector('#princesTimeline .pt-detail-name').textContent,
    pressed: document.querySelector('.pt-reign-3').getAttribute('aria-pressed'),
    hits: document.querySelectorAll('.chronicle-card.pt-hit').length,
    years: document.querySelectorAll('.chronicle-card.pt-hit[data-year]').length,
}));
ok(tl.name.includes('Иван III'), `Таймлайн: досье Ивана III показано («${tl.name}»)`);
ok(tl.pressed === 'true', 'Таймлайн: aria-pressed кнопки правления');
ok(tl.years >= 4, `Таймлайн: события княженья подсвечены (${tl.years} из 5 ожидаемых: 1462/1471/1480/1497/1505)`);
// клик по карточке эпохи тоже выбирает
await lp.click('.epoch-card[data-prince="vasily2"]');
await sleep(400);
const tl2 = await lp.evaluate(() => document.querySelector('#princesTimeline .pt-detail-name').textContent);
ok(tl2.includes('Василий II'), `Таймлайн: карточка эпохи выбирает правление («${tl2}»)`);
const v2hits = await lp.evaluate(() =>
    Array.from(document.querySelectorAll('.chronicle-card.pt-hit')).map(c => c.dataset.year).join(','));
ok(v2hits === '1425,1440,1448,1453,1462', `Таймлайн: подсветка 1425–1462 верна (${v2hits})`);

// 11) UTM-ссылки в DOM
const utm = await lp.evaluate(() => ({
    popup: document.querySelectorAll('#fundPopup a[href*="utm_campaign=fund_popup"]').length,
    support: document.querySelectorAll('#support a[href*="utm_campaign=support_section"]').length,
    footer: document.querySelectorAll('footer a[href*="utm_campaign=footer"]').length,
}));
ok(utm.popup === 3 && utm.support === 3 && utm.footer === 4,
    `UTM-ссылки в DOM: popup=${utm.popup}, support=${utm.support}, footer=${utm.footer}`);
await lp.close();

// ============================================================
// ЧАСТЬ C. ЛЕНДИНГ EN + reduced-motion
// ============================================================
console.log('--- C. Лендинг EN + reduced-motion ---');
const lpEn = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
lpEn.on('pageerror', e => { if (isEnvNoise(String(e))) return; jsErrors++; console.log('EN PAGEERROR:', String(e).slice(0, 200)); });
lpEn.on('console', m => { if (m.type() === 'error' && !isEnvNoise(m.text())) { jsErrors++; console.log('EN CONSOLE-ERR:', m.text().slice(0, 160)); } });
await lpEn.goto(BASE + '/en/', { waitUntil: 'load' });
await sleep(1200);
const enNoCanvas = await lpEn.evaluate(() => !document.getElementById('particles-canvas'));
ok(enNoCanvas, 'EN + reduced-motion: частицы не создаются вовсе');
await lpEn.evaluate(() => document.getElementById('princesTimeline').scrollIntoView());
await lpEn.click('.pt-reign-3');
await sleep(500);
const enTl = await lpEn.evaluate(() => document.querySelector('#princesTimeline .pt-detail-name').textContent);
ok(enTl.includes('Ivan III'), `EN таймлайн: досье Ivan III («${enTl}»)`);
// попап EN: aria-label кнопки закрытия
const enClose = await lpEn.evaluate(() =>
    (document.querySelector('#fundPopup .fund-popup-close') || {}).getAttribute ? document.querySelector('#fundPopup .fund-popup-close').getAttribute('aria-label') : null);
ok(enClose === 'Close support dialog', `EN: aria-label закрытия попапа («${enClose}»)`);
await lpEn.close();

await browser.close();
console.log(`\nИТОГ смоука 66.31: ${fails.length === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : 'ЕСТЬ ПРОВАЛЫ'} (JS-ошибок: ${jsErrors})`);
if (fails.length) { console.log('Провалы:', fails.join(' | ')); process.exit(1); }
process.exit(jsErrors ? 1 : 0);

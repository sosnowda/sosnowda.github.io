// Прод-верификация 66.31 против https://sosnowda.github.io
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'https://sosnowda.github.io';
let jsErrors = 0, fails = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fails++; };
const isNoise = t => t.includes('Framebuffer') || t.includes('ERR_CERT_AUTHORITY_INVALID') || t.includes('hdrc') || t.includes('mc.yandex');

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { if (!isNoise(String(e))) { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); } });
page.on('console', m => { if (m.type() === 'error' && !isNoise(m.text())) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 120)); } });

console.log('--- ПРОД: игра ---');
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
const scenesEarly = await page.evaluate(() => window.game.scene.scenes.map(s => s.scene.key));
ok(scenesEarly.includes('Preload'), 'прод: PreloadScene в менеджере сцен');
await page.waitForFunction(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 120000 });
const prog = await page.evaluate(() => window.game.registry.get('bootProgress'));
ok(prog === 1, `прод: загрузка завершена, bootProgress=${prog}`);
const btn = await page.evaluate(() => {
    const t = window.game.scene.getScene('Title');
    let found = null;
    const walk = o => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim && o.text.trim().includes('Вернуться на сайт')) found = true; };
    t.children.list.forEach(walk);
    return found;
});
ok(btn, 'прод: кнопка «Вернуться на сайт» в меню');
const pixelArt = await page.evaluate(() => window.game.config.pixelArt === true);
ok(pixelArt, 'прод: pixelArt:true не регрессировал (66.30 на месте)');
await page.close();

console.log('--- ПРОД: лендинг ---');
const lp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
lp.on('pageerror', e => { if (!isNoise(String(e))) { jsErrors++; console.log('LP PAGEERROR:', String(e).slice(0, 160)); } });
lp.on('console', m => { if (m.type() === 'error' && !isNoise(m.text())) { jsErrors++; console.log('LP CONSOLE-ERR:', m.text().slice(0, 120)); } });
await lp.goto(BASE + '/', { waitUntil: 'load' });
await sleep(1000);
await lp.click('.fund-bar');
await sleep(250);
const popupOk = await lp.evaluate(() => document.getElementById('fundPopup').classList.contains('open') && document.getElementById('fundPopup').contains(document.activeElement));
ok(popupOk, 'прод: попап открывается, фокус внутри');
await lp.keyboard.press('Escape');
const escOk = await lp.evaluate(() => !document.getElementById('fundPopup').classList.contains('open'));
ok(escOk, 'прод: Esc закрывает');
await lp.evaluate(() => document.getElementById('princesTimeline').scrollIntoView({ block: 'center' }));
await lp.click('.pt-reign-1');
await sleep(600);
const tlOk = await lp.evaluate(() => {
    const name = document.querySelector('#princesTimeline .pt-detail-name').textContent;
    const hits = Array.from(document.querySelectorAll('.chronicle-card.pt-hit')).map(c => c.dataset.year).join(',');
    return name.includes('Василий I') && hits === '1408,1410,1425'; // data-to=1425 включительно
});
ok(tlOk, 'прод: таймлайн — Василий I, подсветка 1408/1410/1425');
const canvasOk = await lp.evaluate(() => !!document.getElementById('particles-canvas'));
ok(canvasOk, 'прод: золотые частицы лендинга живы');
await lp.close();
await browser.close();

console.log(`\nПРОД-ВЕРИФИКАЦИЯ 66.31: ${fails === 0 && jsErrors === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : 'ЕСТЬ ПРОБЛЕМЫ'} (JS-ошибок: ${jsErrors}, провалов: ${fails})`);
process.exit(fails || jsErrors ? 1 : 0);

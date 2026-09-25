// Пробник: карта местности в 844×390 — клик по кнопке + прямой showMap().
// Рендер в headless флеймится («Target crashed») — до 3 попыток на этап.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ARGS = ['--mute-audio', '--disable-web-security', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'];

async function freshPage(browser) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
    await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
    await sleep(4200);
    return page;
}

async function clickText(page, txt, timeout = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate((txt) => {
            const g = window.game;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                    if (obj.text && obj.text.trim && obj.text.trim().includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                };
                for (const top of s.children.list) { const r = walk(top, 0, 0); if (r) return r; }
            }
            return null;
        }, txt);
        if (pos) { await page.mouse.click(pos.x, pos.y); await sleep(400); return pos; }
        await sleep(250);
    }
    return null;
}

async function startAtFork(browser) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const page = await freshPage(browser);
            await clickText(page, 'Новая игра');
            await sleep(1400);
            await page.mouse.click(236, 164); await sleep(1100);
            await clickText(page, 'Начать игру');
            await sleep(5200);
            await page.evaluate(() => {
                for (const s of window.game.scene.scenes) {
                    if (s && s.tutorial && s.tutorial.activeOverlays) {
                        s.tutorial.activeOverlays.forEach(o => {
                            try { o.closeTimer.remove(false); } catch (e) { /* */ }
                            try { o.container.destroy(); } catch (e) { /* */ }
                        });
                        s.tutorial.activeOverlays = [];
                    }
                }
                const v = window.game.scene.getScene('Village');
                if (v) {
                    const q = v.registry.get('quest');
                    if (q) { q.tutorialStep = 3; v.registry.set('quest', q); }
                }
            });
            await sleep(2000);
            await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
            await sleep(2200);
            return page;
        } catch (e) {
            console.log(`попытка ${attempt}: ${String(e).slice(0, 90)} — пересоздаю страницу`);
            try { await browser.close(); } catch (e2) { /* */ }
            browser = await chromium.launch({ headless: true, args: ARGS });
        }
    }
    return null;
}

let browser = await chromium.launch({ headless: true, args: ARGS });
const page = await startAtFork(browser);
if (!page) { console.log('НЕ УДАЛОСЬ ДОБРАТЬСЯ ДО ОКОЛИЦЫ'); process.exit(1); }

const btn = await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    const out = [];
    const walk = (obj, dx, dy) => {
        if (!obj) return;
        if (obj.list) { obj.list.forEach(c => walk(c, dx + (obj.x || 0), dy + (obj.y || 0))); return; }
        if (obj.text && obj.text.includes('Карта')) out.push({ x: Math.round(dx + (obj.x || 0)), y: Math.round(dy + (obj.y || 0)) });
    };
    s.children.list.forEach(o => walk(o, 0, 0));
    return out;
});
console.log('Кнопка «Карта»:', JSON.stringify(btn));
await page.mouse.click(btn[0].x, btn[0].y);
await sleep(1500);
let st = await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    const ov = s.children.list.filter(c => c.depth >= 200);
    return { overlay: ov.length, texts: ov.filter(c => c.text).map(c => c.text.trim()).slice(0, 6) };
});
console.log('после КЛИКА:', JSON.stringify(st));
if (st.overlay === 0) {
    console.log('клик не открыл карту — пробую прямой showMap()');
    await page.evaluate(() => { window.game.scene.getScene('Fork').showMap(); });
    await sleep(1200);
    st = await page.evaluate(() => {
        const s = window.game.scene.getScene('Fork');
        const ov = s.children.list.filter(c => c.depth >= 200);
        return { overlay: ov.length, texts: ov.filter(c => c.text).map(c => c.text.trim()).slice(0, 10) };
    });
    console.log('после showMap():', JSON.stringify(st).slice(0, 400));
}
await page.screenshot({ path: '/tmp/mobile6627/probe_map.png' });
await browser.close();

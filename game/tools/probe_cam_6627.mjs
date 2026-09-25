// Пробник камеры деревни: 844×390 — zoom, scroll, позиция игрока, _fitMode.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 160)));
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4000);
async function clickText(txt, timeout = 8000) {
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
                    return null;
                };
                for (const top of s.children.list) { const r = walk(top, 0, 0); if (r) return r; }
            }
            return null;
        }, txt);
        if (pos) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}
await clickText('Новая игра');
await sleep(1400);
await page.mouse.click(236, 164);
await sleep(1100);
await clickText('Начать игру');
await sleep(5200);
const st = await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const cam = v.cameras.main;
    return {
        scaleW: v.scale.width, scaleH: v.scale.height,
        fitMode: !!v._fitMode, overview: !!v._overviewMode,
        zoom: cam.zoom, sx: cam.scrollX, sy: cam.scrollY,
        player: v.playerObj ? { x: Math.round(v.playerObj.x), y: Math.round(v.playerObj.y) } : null,
        world: { w: v.worldW, h: v.worldH },
    };
});
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: '/tmp/mobile6627/probe_landscape.png' });
await browser.close();

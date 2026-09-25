// Проверка 66.25: ротация домов (угол без лавки) + новые ворота r67.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/diag6625';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error') { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

async function clickText(txt, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate((txt) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) {
                        for (const c of obj.list) {
                            const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0));
                            if (r) return r;
                        }
                        return null;
                    }
                    if (obj.text && obj.text.trim && obj.text.trim() === txt) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) {
                        const cam = s.cameras ? s.cameras.main : null;
                        const zoom = cam ? (cam.zoom || 1) : 1;
                        return { x: Math.round((r.x - (cam ? (cam.scrollX || 0) : 0)) / zoom), y: Math.round((r.y - (cam ? (cam.scrollY || 0) : 0)) / zoom) };
                    }
                }
            }
            return null;
        }, txt);
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}

await clickText('Новая игра');
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await clickText('Начать игру');
await sleep(5000);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    if (s.tutorial && s.tutorial.activeOverlays) {
        s.tutorial.activeOverlays.forEach(o => {
            try { o.closeTimer.remove(false); } catch (e) { /* снят */ }
            try { o.container.destroy(); } catch (e) { /* уничтожен */ }
        });
        s.tutorial.activeOverlays = [];
    }
    const q = s.registry.get('quest');
    if (q) { q.tutorialStep = 3; s.registry.set('quest', q); }
});
await sleep(800);

// День — вся деревня
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const reg = s.registry;
    const gt = reg.get('gameTime');
    if (gt) { gt.day = 10; gt.hour = 12; reg.set('gameTime', gt); }
});
await sleep(1200);
await page.screenshot({ path: `${OUT}/r6625_village_day.png` });
console.log('SHOT r6625_village_day');

// Кроп: ворота и правый верхний угол
const shots = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const ts = s.tileSize || 48;
    // проверка: игрок проходит через ворота на восток (клик по G)
    return { gate: s.textures.exists('village_gate_r67_north') && s.textures.exists('village_gate_r67_south') };
});
console.log('gate textures loaded:', JSON.stringify(shots));

// Ночь — фонарь должен светиться
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const reg = s.registry;
    const gt = reg.get('gameTime');
    if (gt) { gt.hour = 23; reg.set('gameTime', gt); }
});
await sleep(1200);
await page.screenshot({ path: `${OUT}/r6625_village_night.png` });
console.log('SHOT r6625_village_night');

// Выход через ворота: телепорт к воротам и клик
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const reg = s.registry;
    const gt = reg.get('gameTime');
    if (gt) { gt.hour = 12; reg.set('gameTime', gt); }
    const ts = s.tileSize || 48;
    s.player.x = 23 * ts + ts / 2; s.player.y = 5 * ts + ts / 2;
    if (s.cameras && s.cameras.main) s.cameras.main.centerOn(s.player.x, s.player.y);
});
await sleep(1000);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const ts = s.tileSize || 48;
    // эмулируем клик по тайлу ворот (25,5)
    const wx = 25 * ts + ts / 2, wy = 5 * ts + ts / 2;
    if (s.handleGateClick) { s.handleGateClick(); return 'handleGateClick'; }
    // fallback: прямая смена сцены не эмулирует клик — проверим isGate
    return 'no handler';
});
await sleep(800);
const sceneNow = await page.evaluate(() => window.game.scene.isActive('Fork') ? 'Fork' : (window.game.scene.isActive('Village') ? 'Village' : '?'));
console.log('after gate click scene:', sceneNow);

console.log('JS errors:', jsErrors);
await browser.close();

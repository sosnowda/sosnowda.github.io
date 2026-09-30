// probe_scene_trace_6650.mjs — перехват ScenePlugin.start/launch: кто какую сцену стартует.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
    window.__sceneLog = [];
    const patch = () => {
        if (!window.Phaser || !window.Phaser.Scenes || !window.Phaser.Scenes.ScenePlugin) { setTimeout(patch, 50); return; }
        const SP = window.Phaser.Scenes.ScenePlugin.prototype;
        for (const m of ['start', 'launch', 'run']) {
            const orig = SP[m];
            SP[m] = function (key, data) {
                const from = this.scene ? this.scene.scene.key : '?';
                window.__sceneLog.push(`${m}: ${from} -> ${key} @${Math.round(performance.now())}ms\n    ${new Error().stack.split('\n').slice(2, 5).join('\n    ')}`);
                return orig.call(this, key, data);
            };
        }
    };
    patch();
});

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
await sleep(4500);

const clickText = (txt) => page.evaluate((txt) => {
    const g = window.game;
    const walk = (obj) => {
        if (!obj) return null;
        if (obj.list) { for (const c of obj.list) { const r = walk(c); if (r) return r; } }
        if (obj.text && obj.text.trim && obj.text.trim().includes(txt)) {
            const b = obj.getBounds(); return b ? { gx: b.centerX, gy: b.centerY } : null;
        }
        return null;
    };
    for (const s of g.scene.scenes) {
        if (!s || !s.children) continue;
        const hit = walk(s.children.list);
        if (hit) { s.input.emit('pointerdown', { x: hit.gx, y: hit.gy }); s.input.emit('pointerup', { x: hit.gx, y: hit.gy }); return s.scene.key; }
    }
    return null;
}, txt);

console.log('Новая игра:', await clickText('Новая игра'));
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
console.log('Начать игру:', await clickText('Начать игру'));
await sleep(5000);
await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
await sleep(2500);
// в пасеку (как walkthrough)
await page.evaluate(() => { const f = window.game.scene.getScene('Fork'); f.scene.start('Location', { locationId: 'apiary', from: 'Fork' }); });
await sleep(4000);
// клик «◀ К ОКОЛИЦЕ» (как walkthrough)
console.log('К ОКОЛИЦЕ:', await clickText('К ОКОЛИЦЕ'));
await sleep(3500);

const log = await page.evaluate(() => window.__sceneLog);
console.log('=== СЦЕНОВЫЙ ЖУРНАЛ (последние 25) ===');
log.slice(-25).forEach(l => console.log(l, '\n---'));
await browser.close();

// probe2_settings_6675.mjs — deeper: canvas scale, interactive objects, hit test
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 180)));
page.on('console', m => console.log('CONSOLE:', m.text().slice(0, 200)));
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

const boot = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    const sc = window.game.scale;
    return {
        titleActive: s.scene.isActive(),
        hasAM: !!s.audioManager,
        scenes: window.game.scene.scenes.map(x => x.scene.key + (x.scene.isActive() ? '*' : '')),
        canvasBounds: { x: sc.canvasBounds.x, y: sc.canvasBounds.y, w: sc.canvasBounds.width },
        displaySize: { w: sc.displaySize.width, h: sc.displaySize.height },
        gameSize: { w: sc.gameSize.width, h: sc.gameSize.height },
        amKeys: s.audioManager ? Object.keys(s.audioManager) : null,
    };
});
console.log('boot:', JSON.stringify(boot, null, 1));

// Клик по кнопке «⚙ Настройки» как игрок
const btnPos = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    for (const o of s.children.list) {
        if (o.text && o.text.includes('⚙ Настройки')) return { x: o.x, y: o.y };
    }
    return null;
});
await page.mouse.click(btnPos.x, btnPos.y);
await sleep(800);

const panel = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    const deep = s.children.list.filter(c => c.depth >= 250 && c.depth <= 255);
    return {
        n: deep.length,
        widgets: deep.map(c => ({ d: c.depth, x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width || 0), i: !!c.input, txt: (c.text || '').slice(0, 24) })).slice(0, 14),
        hasAM: !!s.audioManager,
        amOffs: s.audioManager && s.audioManager._registryOffs ? s.audioManager._registryOffs.length : null,
    };
});
console.log('panel:', JSON.stringify(panel, null, 1));
await browser.close();

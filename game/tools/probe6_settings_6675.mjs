// probe6_settings_6675.mjs — секция 1 QA с консольным логом
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 180)));
page.on('console', m => { if (m.text().includes('[DBG')) console.log('PAGE:', m.text()); });
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => {
    if (!window.game || !window.game.scene) return false;
    const s = window.game.scene.getScene('Title');
    return s && s.scene && s.scene.isActive() && !!s.audioManager;
}, { timeout: 40000 });
await sleep(800);
const btn = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    for (const o of s.children.list) if (o.text && o.text.includes('⚙ Настройки')) return { x: o.x, y: o.y };
    return null;
});
await page.mouse.click(btn.x, btn.y);
await sleep(700);
const mus = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    for (const o of s.children.list) if (o.text && o.text.includes('Музыка:')) return { x: o.x, y: o.y };
    return null;
});
await page.mouse.click(mus.x, mus.y);
await sleep(800);
const after = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    return {
        reg: window.game.registry.get('settings.audio.musicMuted'),
        am: s.audioManager.musicMuted,
    };
});
console.log('AFTER:', JSON.stringify(after));
await browser.close();

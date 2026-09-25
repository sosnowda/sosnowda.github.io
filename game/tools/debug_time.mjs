// Измерение скорости игрового времени (реальное vs игровое)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(6000);
await page.mouse.click(640, 270);
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await page.mouse.click(519, 608);
await sleep(4000);
await page.evaluate(() => {
    const g = window.game;
    const v = g.scene.getScene('Village');
    if (v && v.scene.isActive()) g.scene.stop('Village');
    g.scene.start('Fork');
});
await sleep(3000);
for (let i = 0; i < 6; i++) {
    const t = await page.evaluate(() => {
        for (const key of ['Fork', 'Village', 'Title']) {
            const s = window.game.scene.getScene(key);
            if (s && s.scene.isActive() && s.registry) {
                const gt = s.registry.get('gameTime');
                return gt ? `${key}: ${gt.hour}ч ${gt.minute}м (day ${gt.day}, tick ${gt.tickCount})` : `${key}: no gameTime`;
            }
        }
        return 'no active scene with registry';
    });
    console.log(`t=${i * 3}s: ${t}`);
    await sleep(3000);
}
await browser.close();

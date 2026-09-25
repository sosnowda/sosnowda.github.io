// Отладка туториала: когда подсказки реально исчезают
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(5000);
await page.mouse.click(640, 270);
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await page.mouse.click(519, 608); // Начать игру
const t0 = Date.now();
// Каждые 2 секунды — статус подсказок
for (let i = 0; i < 15; i++) {
    await sleep(2000);
    const st = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        if (!s) return 'no Village';
        const texts = [];
        const walk = (obj) => {
            if (!obj) return;
            if (obj.list) { for (const c of obj.list) walk(c); return; }
            if (obj.text) texts.push(String(obj.text).slice(0, 30));
        };
        for (const top of s.children.list) walk(top);
        const hint = texts.filter(t => ['Беженец', 'Движение', 'Действие', 'Цель'].some(h => t.includes(h)));
        const q = s.registry.get('quest') || {};
        return `step=${q.tutorialStep} hint=[${hint.join('|')}] alpha=${s.tutorial && s.tutorial.activeOverlays ? s.tutorial.activeOverlays.map(o => o.container.alpha.toFixed(2)).join(',') : '?'}`;
    });
    console.log(`${Math.round((Date.now() - t0) / 1000)}s: ${st}`);
}
await browser.close();

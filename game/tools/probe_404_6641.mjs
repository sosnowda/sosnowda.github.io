// 66.41: диагностика 404-ресурсов при живой загрузке игры
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ args: ['--mute-audio', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const bad = [];
page.on('response', r => { if (r.status() === 404) bad.push(r.url()); });
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForTimeout(9000);
await page.evaluate(() => window.game && window.game.scene.getScene('Village'));
await page.waitForTimeout(2000);
console.log('404 URL-ы:', JSON.stringify([...new Set(bad)], null, 1));
await browser.close();

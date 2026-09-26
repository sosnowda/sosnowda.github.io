// Кадр PreloadScene (золотой бар) для docs + проверка видимости
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
// Preload активен (Boot ещё качает) — снимаем золотой бар
await page.screenshot({ path: '/home/z/my-project/sosnowda-site/game/docs/r6631_preload_golden_bar.webp', type: 'webp', quality: 90 });
const state = await page.evaluate(() => {
    const p = window.game.scene.getScene('Preload');
    const b = window.game.scene.getScene('Boot');
    return { preloadActive: p && p.scene.isActive(), progress: window.game.registry.get('bootProgress') };
});
console.log('preload shot:', JSON.stringify(state));
// прогресс >0 — бар живой; дождёмся 50% и снимем второй кадр
await page.waitForFunction(() => (window.game.registry.get('bootProgress') || 0) >= 0.5, { timeout: 90000 });
await page.screenshot({ path: '/home/z/my-project/sosnowda-site/game/docs/r6631_preload_half.webp', type: 'webp', quality: 90 });
console.log('half shot done');
await browser.close();

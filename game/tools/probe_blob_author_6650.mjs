// probe_blob_author_6650.mjs — кто создаёт blob:URL изображений (хук на createObjectURL).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:8765';

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
    window.__blobStacks = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
        const u = orig(obj);
        try {
            if (obj && obj.type && obj.type.indexOf('image') === 0) {
                window.__blobStacks.push({ type: obj.type, size: obj.size, stack: new Error().stack.split('\n').slice(1, 6).join(' | ') });
            }
        } catch (e) {}
        return u;
    };
});
page.on('console', m => { if (m.type() === 'error') console.log('ERR:', m.text().slice(0, 160)); });
await page.goto(BASE + '/game/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
await new Promise(r => setTimeout(r, 6000));
const res = await page.evaluate(() => ({ n: window.__blobStacks.length, first: window.__blobStacks.slice(0, 4) }));
console.log('Всего image-blob:', res.n);
res.first.forEach((b, i) => console.log(`\n#${i} type=${b.type} size=${b.size}\n  stack: ${b.stack}`));
await browser.close();

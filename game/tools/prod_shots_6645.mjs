// Живые кадры с ПРОДА: бой с вором + карта местности (густой лес)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'https://sosnowda.github.io';
const browser = await chromium.launch({ args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });

// бой
{
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(BASE + '/game/?shot=combat', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 150000, polling: 250 });
    await page.screenshot({ path: '/tmp/prod_battle_6645.png' });
    console.log('prod battle shot OK');
    await page.close();
}
// карта
{
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(BASE + '/game/?shot=map', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 150000, polling: 250 });
    await page.screenshot({ path: '/tmp/prod_map_6645.png' });
    console.log('prod map shot OK');
    await page.close();
}
await browser.close();

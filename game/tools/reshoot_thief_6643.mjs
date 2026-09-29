// Пересъёмка ОДНОГО кадра (thief) с длинным ожиданием тайпрайтера.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--mute-audio','--disable-gpu','--no-zygote','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let errs = 0;
page.on('pageerror', e => { if (!String(e).includes('Framebuffer')) { errs++; console.log('PAGEERROR:', String(e).slice(0,140)); } });
await page.goto('http://localhost:8090/game/?shot=thief', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__shotReady === true || !!window.__shotError, null, { timeout: 200000, polling: 300 });
const err = await page.evaluate(() => window.__shotError);
if (err) { console.log('shotError:', err); process.exit(1); }
await sleep(600);
await page.screenshot({ path: '/tmp/shots6643/09-thief-encounter.png' });
console.log('thief reshot OK, errors:', errs);
await page.close(); await browser.close();

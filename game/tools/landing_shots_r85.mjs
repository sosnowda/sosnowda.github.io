// Раунд 66.85 (приказ 1): ПЕРЕСЪЁМКА ВСЕХ СКРИНШОТОВ ЛЕНДИНГА + НОВЫЙ кадр
// тракта. Игра на локальном стенде; для каждого кадра — свой ?shot=<id>,
// ждём window.__shotReady (сценарий осел) и снимаем 1280×720.
// Кадры: /tmp/shots_r85/*.png → PIL → webp q85 → assets/screenshots/.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const OUT = '/tmp/shots_r85';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';

const SHOTS = [
    ['menu', '01-title'],
    ['select', '02-character-select'],
    ['custom', '03-character-custom'],
    ['village', '04-village'],
    ['map', '05-map'],
    ['interior', '06-elder-interior'],
    ['priest', '07-priest-dialogue'],
    ['combat', '08-combat'],
    ['thief', '09-thief-encounter'],
    // 66.86: 10-й кадр «Тракт» УДАЛЁН по приказу владельца — снова 9 кадров
];

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });

for (const [id, name] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    try {
        await page.goto(`${BASE}/game/?shot=${id}`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000, polling: 300 });
        await new Promise(r => setTimeout(r, 1200)); // финальное оседание анимаций
        await page.screenshot({ path: `${OUT}/${name}.png` });
        console.log('OK', name, errs.length ? `JS-ошибки: ${errs.length}` : '');
    } catch (e) {
        console.log('FAIL', id, String(e).slice(0, 120));
    }
    await page.close();
}
await browser.close();
console.log('DONE');

// take_shots_6643.mjs — ПАТЧ 66.43 (приказы 2+3): ПЕРЕСЪЁМКА ВСЕХ 9
// СКРИНШОТОВ лендинга.
// Отличия от прежнего конвейера (landing_shots → update_shots):
//   * кадр снимается ТОЛЬКО после window.__shotReady — флага Screenshot-
//     Director'а «сценарий выполнен, сцена осела» (п.3 приказа: первый кадр
//     сайта = ГЛАВНОЕ МЕНЮ, а не полоса загрузки);
//   * каждый кадр — СВЕЖАЯ страница (чистые registry/сейвы, средовые
//     деградации headless не накапливаются — урок АГЕНТ.md §5);
//   * PNG → webp q85 делает convert-шаг (scripts/convert_shots_6643.py, PIL).
// Запуск: node game/tools/take_shots_6643.mjs  (стенд: python3 -m http.server 8090)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const OUT = '/tmp/shots6643';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
];

let jsErrors = 0;
const browser = await chromium.launch({
    args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'],
});

for (const [id, file] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => {
        if (String(e).includes('Framebuffer')) return;
        jsErrors++;
        console.log(`  PAGEERROR[${id}]:`, String(e).slice(0, 160));
    });
    page.on('console', m => {
        if (m.type() === 'error' && !m.text().includes('Framebuffer')) {
            jsErrors++;
            console.log(`  CONSOLE-ERR[${id}]:`, m.text().slice(0, 140));
        }
    });
    try {
        await page.goto(`${BASE}/game/?shot=${id}`, { waitUntil: 'load', timeout: 60000 });
        // 66.43: ждём готовность кадра ДО 150 c — сценарий thief включает
        // ожидание конца тайпрайтера диалога, а в headless первые кадры
        // тормозят (дельта ограничена minFps 5 → игра идёт ~0.2× wall-времени).
        await page.waitForFunction(() => window.__shotReady === true && true, null, { timeout: 150000, polling: 250 });
        if (await page.evaluate(() => window.__shotError)) {
            throw new Error('shotError: ' + await page.evaluate(() => window.__shotError));
        }
        await sleep(600); // добор анимаций кадра
        await page.screenshot({ path: `${OUT}/${file}.png` });
        console.log(`✓ ${file}.png (${id})`);
    } catch (e) {
        jsErrors++;
        console.log(`✗ ${id}: ${String(e).slice(0, 200)}`);
    }
    await page.close();
}
await browser.close();
console.log(jsErrors === 0 ? 'СЪЁМКА ЧИСТАЯ, 0 JS-ошибок' : `съёмка с ошибками: ${jsErrors}`);
process.exit(jsErrors === 0 ? 0 : 1);

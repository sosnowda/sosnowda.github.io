// Отладка presentThiefEncounter
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 250)); });

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(5000);
await page.mouse.click(640, 270); // Новая игра
await sleep(1500);
await page.mouse.click(360, 300); // первая карточка
await sleep(1200);
// Начать игру — координаты кнопки: (519,608) по кадру 03
await page.mouse.click(519, 608);
await sleep(5000);
const st1 = await page.evaluate(() => window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(','));
console.log('AFTER START:', st1);
// На погост
await page.evaluate(() => {
    const g = window.game;
    g.scene.stop('Village');
    g.scene.start('Location', { locationId: 'pogost', from: 'Fork' });
});
await sleep(3000);
const res = await page.evaluate(async () => {
    const out = {};
    try {
        const mod = await import('/game/src/data/thief.js');
        out.imported = Object.keys(mod).length + ' exports';
        const s = window.game.scene.getScene('Location');
        out.scene = s ? s.scene.key : 'NONE';
        out.busy = s && s.busyDialog;
        try { mod.initThiefHunt(s.registry); out.init = 'ok'; } catch (e) { out.init = 'ERR:' + e.message; }
        const st = mod.getHuntState(s.registry);
        out.state = JSON.stringify(st).slice(0, 200);
        try {
            mod.presentThiefEncounter(s, 'pogost');
            out.present = 'called';
        } catch (e) { out.present = 'ERR:' + e.message; }
        out.busyAfter = s.busyDialog;
        // есть ли диалоговые объекты на сцене?
        out.children = s.children.list.length;
    } catch (e) {
        out.fatal = e.message;
    }
    return out;
});
console.log('THIEF:', JSON.stringify(res, null, 1));
await sleep(2500);
await page.screenshot({ path: '/tmp/shots/debug_thief.png' });
await browser.close();
console.log('DONE');

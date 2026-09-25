// Отладка: почему presentThiefEncounter не рисует диалог
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 250)); });

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(5000);
// Заглянуть внутрь кнопки «Новая игра»: координаты и обработчики
const btn = await page.evaluate(() => {
    const g = window.game;
    const found = [];
    for (const s of g.scene.scenes) {
        if (!s || !s.children) continue;
        const walk = (obj, dx, dy) => {
            if (!obj) return;
            if (obj.list) { for (const c of obj.list) walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); return; }
            if (obj.text && String(obj.text).includes('Новая игра')) {
                found.push({
                    scene: s.scene.key, x: dx + obj.x, y: dy + obj.y,
                    interactive: !!(obj.input && obj.input.enabled),
                    handlers: obj.eventNames ? obj.eventNames().join(',') : '',
                    parentInt: obj.parentContainer && obj.parentContainer.input ? 'parent-int' : '',
                });
            }
        };
        for (const top of s.children.list) walk(top, 0, 0);
    }
    return found;
});
console.log('BTN:', JSON.stringify(btn));
await page.mouse.click(640, 270);
await sleep(2000);
const sceneKeys = await page.evaluate(() => window.game.scene.scenes.map(s => s.scene.key + ':' + (s.scene.isActive() ? 'act' : 'idle')).join(' '));
console.log('SCENES:', sceneKeys);
await browser.close();

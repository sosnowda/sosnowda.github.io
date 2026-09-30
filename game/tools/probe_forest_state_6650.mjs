// probe_forest_state_6650.mjs — почему canvas показывает пасеку при активном Forest.
// Полный путь walkthrough →Forest, потом детальный дамп состояний сцен.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', e => logs.push('[PAGEERROR] ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' || /гард|Летописи/.test(m.text())) logs.push(`[${m.type()}] ` + m.text().slice(0, 250)); });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

const clickText = async (txt) => page.evaluate((txt) => {
    const g = window.game;
    const walk = (obj, dx, dy) => {
        if (!obj) return null;
        if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } }
        if (obj.text && typeof obj.text === 'string' && obj.text.includes(txt)) {
            const b = obj.getBounds();
            return b ? { x: dx + (obj.x || 0) + b.centerX - (obj.x || 0), y: dy + (obj.y || 0) + b.centerY - (obj.y || 0), gx: b.centerX, gy: b.centerY } : null;
        }
        return null;
    };
    for (const s of g.scene.scenes) {
        if (!s || !s.children) continue;
        const hit = walk(s.children.list, s.x || 0, s.y || 0);
        if (hit) { s.input.emit('pointerdown', { x: hit.gx, y: hit.gy }); s.input.emit('pointerup', { x: hit.gx, y: hit.gy }); return { scene: s.scene.key, txt }; }
    }
    return null;
}, txt);

console.log('start:', JSON.stringify(await clickText('Начать игру')));
await sleep(5000);

// Деревня → околица → локации как в walkthrough → лес
await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
await sleep(2200);
for (const loc of ['forest_edge', 'lake', 'apiary']) {
    await page.evaluate((loc) => {
        const f = window.game.scene.getScene('Fork') || window.game.scene.getScene('Location');
        (f || window.game.scene.getScene('Village')).scene.start('Location', { locationId: loc, from: 'Fork' });
    }, loc);
    await sleep(2600);
    console.log('visited:', loc);
}
// Переход на Forest из активной сцены (как делает walkthrough)
await page.evaluate(() => {
    const s = window.game.scene.scenes.find(s => s.scene.isActive());
    console.log('from scene:', s ? s.scene.key : 'none');
    if (s) s.scene.start('Forest', { from: 'Fork' });
});
await sleep(6000);

const dump = await page.evaluate(() => {
    const g = window.game;
    const scenes = g.scene.scenes.map(s => ({
        key: s.scene.key,
        status: s.scene.status,
        active: s.scene.isActive(),
        sleeping: s.scene.isSleeping(),
        visible: s.scene.isVisible(),
        children: s.children ? s.children.list.length : -1,
    }));
    const canvas = document.querySelector('canvas');
    return { scenes, renderOK: !!g.renderer, canvasW: canvas && canvas.width };
});
console.log('DUMP:', JSON.stringify(dump, null, 1));
console.log('=== ЛОГИ ===');
logs.slice(0, 20).forEach(l => console.log(l));
console.log('всего логов:', logs.length);
await browser.close();

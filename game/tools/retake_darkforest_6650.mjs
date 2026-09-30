// retake_darkforest_6650.mjs (v4) — Тёмный лес через UI карты; хелпер клика —
// точная копия clickText из walkthrough_6627 (page.mouse.click + камера).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/walk6627';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', e => logs.push('[PAGEERROR] ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') logs.push('[ERR] ' + m.text().slice(0, 200)); });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

async function clickText(txt, exact = true, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt, exact }) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) {
                        for (const c of obj.list) {
                            const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0));
                            if (r) return r;
                        }
                        return null;
                    }
                    if (obj.text && obj.text.trim) {
                        const tt = obj.text.trim();
                        const hit = exact ? tt === txt : tt.includes(txt);
                        if (hit) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    }
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) {
                        const cam = s.cameras ? s.cameras.main : null;
                        const zoom = cam ? (cam.zoom || 1) : 1;
                        return { x: Math.round((r.x - (cam ? (cam.scrollX || 0) : 0)) / zoom), y: Math.round((r.y - (cam ? (cam.scrollY || 0) : 0)) / zoom) };
                    }
                }
            }
            return null;
        }, { txt, exact });
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}

console.log('1) Новая игра:', await clickText('Новая игра'));
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
console.log('2) Начать игру:', await clickText('Начать игру'));
await sleep(5000);
// пропускаем туториал-оверлеи и ставим день/час (как walkthrough)
await page.evaluate(() => {
    for (const s of window.game.scene.scenes) {
        if (s && s.tutorial && s.tutorial.activeOverlays) {
            s.tutorial.activeOverlays.forEach(o => { try { o.container.destroy(); } catch (e) {} });
            s.tutorial.activeOverlays = [];
        }
        const v = window.game.scene.getScene('Village');
        if (v) {
            const q = v.registry.get('quest');
            if (q) { q.tutorialStep = 3; v.registry.set('quest', q); }
            const gt = v.registry.get('gameTime');
            if (gt) { gt.day = 10; gt.hour = 9; v.registry.set('gameTime', gt); }
        }
    }
});
await sleep(1500);

// Деревня → околица (программный переход безопасен: Village останавливается сам)
await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
await sleep(2500);
console.log('4) Кнопка Тёмного леса:', await clickText('Тёмный лес — прогулка', false));
await sleep(6000);

const state = await page.evaluate(() => {
    const g = window.game;
    return {
        active: g.scene.scenes.filter(s => s && s.scene.isActive()).map(s => s.scene.key),
        forestChildren: (g.scene.getScene('Forest') || { children: { list: [] } }).children.list.length,
    };
});
console.log('состояние:', JSON.stringify(state));
await page.screenshot({ path: `${OUT}/loc_darkforest.png` });
await sleep(2500);
await page.screenshot({ path: `${OUT}/loc_darkforest.png` });
console.log('логи:', logs.length ? '\n' + logs.slice(0, 8).join('\n') : 'чисто');
await browser.close();

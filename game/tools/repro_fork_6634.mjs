// Минимальный репро: деревня глотается → старт Fork. Лог этапов.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FLAGS = (process.env.CHROME_FLAGS || '--mute-audio --disable-gpu --no-zygote --no-sandbox').split(' ').filter(Boolean);
console.log('chrome flags:', FLAGS.join(' '));
const browser = await chromium.launch({ headless: true, args: FLAGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => {
    const t = window.game && window.game.scene && window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 60000, polling: 200 });
console.log('boot ok');
await sleep(500);
await page.evaluate(() => {
    const SM = Phaser.Scenes.SceneManager.prototype;
    if (!SM.__sw) { SM.__sw = true; const o = SM.start; SM.start = function (k, d) { if (k === 'Village' || k === 'Location' || k === 'Apiary') return; return o.call(this, k, d); }; }
}, { noZones: process.env.NOZONES === '1' });
// БИСЕКТ: NOZONES=1 — строить Fork без клик-зон
if (process.env.NOZONES === '1') await page.evaluate(() => window.game.registry.set('__qaNoZones', true));
await page.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    window.game.scene.start('CharacterSelection');
});
await sleep(1000);
// БИСЕКТ: клик «Новая игра» кнопкой (как в QA) перед выбором героя
const clickBtn = async (txt) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
        const pos = await page.evaluate((txt) => {
            const g = window.game;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                    if (obj.text && obj.text.trim && obj.text.trim().includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    return null;
                };
                for (const top of s.children.list) { const r = walk(top, 0, 0); if (r) return r; }
            }
            return null;
        }, txt);
        if (pos) { await page.mouse.click(pos.x, pos.y); await sleep(500); return true; }
        await sleep(250);
    }
    return false;
};
console.log('click Новая игра:', await clickBtn('Новая игра'));
await page.evaluate(() => {
    // создаём героя напрямую
    const cs = window.game.scene.getScene('CharacterSelection');
    const hero = cs && cs._previewHero;
    console.log('previewHero:', !!hero);
});
// старт через выбор Добрыни (как в QA)
const t0 = Date.now();
let clicked = false;
while (Date.now() - t0 < 8000 && !clicked) {
    clicked = await page.evaluate(() => {
        const g = window.game;
        for (const s of g.scene.scenes) {
            if (!s || !s.children || !s.children.list) continue;
            const walk = (obj, dx, dy) => {
                if (!obj) return null;
                if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                if (obj.text && obj.text.trim && obj.text.trim().includes('Добрыня')) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                return null;
            };
            for (const top of s.children.list) { const r = walk(top, 0, 0); if (r) return r; }
        }
        return null;
    });
    if (clicked) { await page.mouse.click(clicked.x, clicked.y); await sleep(600); }
    else await sleep(250);
}
console.log('click Добрыня:', clicked);
await page.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    if (cs && cs._previewHero) cs.startGameWithHero(cs._previewHero);
});
console.log('hero started');
await sleep(1200);
console.log('starting Fork...');
await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
console.log('Fork start issued');
for (let i = 0; i < 4; i++) {
    await sleep(1000);
    const st = await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork');
        return { alive: !!f, active: f && f.scene.isActive(), view: !!(f && f.__mapView) };
    }).catch(e => ({ evalErr: String(e).slice(0, 80) }));
    console.log(`t+${i + 1}s:`, JSON.stringify(st));
}
console.log('restarting Fork...');
await page.evaluate(() => window.game.scene.getScene('Fork').scene.restart());
for (let i = 0; i < 4; i++) {
    await sleep(1000);
    const st = await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork');
        return { alive: !!f, active: f && f.scene.isActive(), view: !!(f && f.__mapView) };
    }).catch(e => ({ evalErr: String(e).slice(0, 80) }));
    console.log(`restart+${i + 1}s:`, JSON.stringify(st));
}
await page.screenshot({ path: '/tmp/shots6634/repro_fork.png' }).catch(() => console.log('screenshot failed (crashed)'));
await browser.close();
console.log('done');

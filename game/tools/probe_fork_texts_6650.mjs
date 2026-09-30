// probe_fork_texts_6650.mjs — все тексты сцены Fork (точная надпись кнопки Тёмного леса).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
await sleep(4500);

// старт
await page.evaluate(() => {
    const g = window.game;
    const walk = (obj) => {
        if (!obj) return null;
        if (obj.list) { for (const c of obj.list) { const r = walk(c); if (r) return r; } }
        if (obj.text && obj.text.trim && obj.text.trim() === 'Новая игра') {
            const b = obj.getBounds(); return b ? { gx: b.centerX, gy: b.centerY } : null;
        }
        return null;
    };
    for (const s of g.scene.scenes) {
        if (!s || !s.children) continue;
        const hit = walk(s.children.list);
        if (hit) { s.input.emit('pointerdown', { x: hit.gx, y: hit.gy }); s.input.emit('pointerup', { x: hit.gx, y: hit.gy }); break; }
    }
});
await sleep(2000);
await page.mouse.click(360, 300);
await sleep(1500);
await page.evaluate(() => {
    const g = window.game;
    const walk = (obj) => {
        if (!obj) return null;
        if (obj.list) { for (const c of obj.list) { const r = walk(c); if (r) return r; } }
        if (obj.text && obj.text.trim && obj.text.trim() === 'Начать игру') {
            const b = obj.getBounds(); return b ? { gx: b.centerX, gy: b.centerY } : null;
        }
        return null;
    };
    for (const s of g.scene.scenes) {
        if (!s || !s.children) continue;
        const hit = walk(s.children.list);
        if (hit) { s.input.emit('pointerdown', { x: hit.gx, y: hit.gy }); s.input.emit('pointerup', { x: hit.gx, y: hit.gy }); break; }
    }
});
await sleep(5000);
await page.evaluate(() => window.game.scene.getScene('Village') && window.game.scene.getScene('Village').scene.start('Fork'));
await sleep(3000);

const texts = await page.evaluate(() => {
    const f = window.game.scene.getScene('Fork');
    if (!f || !f.children) return { err: 'no Fork' };
    const out = [];
    const walk = (obj, d) => {
        if (!obj || d > 6) return;
        if (obj.list) { for (const c of obj.list) walk(c, d + 1); return; }
        if (obj.text && obj.text.trim) out.push(obj.text.trim().slice(0, 60));
    };
    walk(f.children.list, 0);
    return { n: out.length, texts: out.filter(t => t.length > 0).slice(0, 60) };
});
console.log(JSON.stringify(texts, null, 1));
await browser.close();

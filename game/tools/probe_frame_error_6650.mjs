// probe_frame_error_6650.mjs — диагностика TypeError "reading 'frame'" в SceneManager.update.
// Зонд: грузит игру, стартует, перехватывает console/ pageerror с ПОЛНОЙ трассировкой,
// определяет активную сцену в момент исключения, проверяет webgl/canvas.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/probe6650';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', m => {
    const t = m.type() === 'error' || m.type() === 'warning' || /Летописи:гард|guard/.test(m.text());
    if (t) logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', e => logs.push('[pageerror] ' + String(e)));

await page.goto(BASE + '/game/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
await sleep(5000);

// Кто активен и что за объекты без фрейма — прямо в контексте игры
const diag = await page.evaluate(() => {
    const g = window.game;
    const active = g.scene.scenes.filter(s => s && s.scene && s.scene.isActive()).map(s => s.scene.key);
    // Поиск спрайтов с битой анимацией
    const broken = [];
    for (const s of g.scene.scenes) {
        if (!s || !s.children || !s.children.list) continue;
        const walk = (obj, path) => {
            if (!obj || !obj.list) return;
            for (const c of obj.list) {
                if (c && c.anims && c.anims.currentAnim && !c.anims.currentFrame) {
                    broken.push(path + '/' + (c.name || c.texture && c.texture.key || '?'));
                }
                if (c && c.list) walk(c, path + '/' + (c.constructor.name || '?'));
            }
        };
        walk(s.children, s.scene.key);
    }
    return { active, broken: broken.slice(0, 10), renderer: g.renderer.type === 2 ? 'WEBGL' : 'CANVAS' };
});

await page.screenshot({ path: `${OUT}/probe_title_or_game.png` });

// Попытка дойти до игры: кликаем по кнопке старта текстовым поиском
const clicked = await page.evaluate(() => {
    const g = window.game;
    for (const s of g.scene.scenes) {
        if (!s || !s.children || !s.children.list) continue;
        const walk = obj => {
            if (!obj) return null;
            if (obj.list) { for (const c of obj.list) { const r = walk(c); if (r) return r; } }
            if (obj.text && typeof obj.text === 'string' && /Начать|Start/i.test(obj.text)) {
                const b = obj.getBounds ? obj.getBounds() : null;
                if (b) { const ev = { x: b.centerX, y: b.centerY }; return { scene: s.scene.key, text: obj.text.slice(0, 30), x: ev.x, y: ev.y }; }
            }
            return null;
        };
        const hit = walk(s.children);
        if (hit) { s.input && s.input.emit && s.input.emit('pointerdown', { x: hit.x, y: hit.y, width: 1, height: 1 }); return hit; }
    }
    return null;
});
await sleep(6000);

const diag2 = await page.evaluate(() => {
    const g = window.game;
    const active = g.scene.scenes.filter(s => s && s.scene && s.scene.isActive()).map(s => s.scene.key);
    return { active };
});
await page.screenshot({ path: `${OUT}/probe_after_start.png` });

console.log('=== ДИАГНОСТИКА ДО СТАРТА ===');
console.log(JSON.stringify(diag, null, 2));
console.log('=== КЛИК ПО СТАРТУ ===');
console.log(JSON.stringify(clicked));
console.log('=== АКТИВНЫЕ СЦЕНЫ ПОСЛЕ СТАРТА ===');
console.log(JSON.stringify(diag2));
console.log('=== ЛОГИ (первые 25, полная трассировка) ===');
logs.slice(0, 25).forEach(l => console.log(l.slice(0, 500)));
console.log('=== ВСЕГО ЛОГОВ ===', logs.length);
fs.writeFileSync(`${OUT}/logs.txt`, logs.join('\n'));
await browser.close();

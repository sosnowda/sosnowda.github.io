// 66.34 п.11: сравнение СПОСОБОВ фикса качества — NEAREST 2.5 (как есть) vs
// LINEAR-фильтр 2.5 vs целочисленный 2.0 NEAREST. Снимает три кадра таверны.
// Запуск: node game/tools/quality_variants_6634.mjs  (сервер на 8765)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/shots6634';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let jsErrors = 0;
page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => {
    const t = window.game && window.game.scene && window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 60000, polling: 200 });
await sleep(800);
await page.evaluate(() => {
    const SM = Phaser.Scenes.SceneManager.prototype;
    if (!SM.__swallow6634) {
        SM.__swallow6634 = true;
        const orig = SM.start;
        SM.start = function (key, data) { if (key === 'Village') return; return orig.call(this, key, data); };
    }
});

const clickText = async (txt, timeout = 9000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt }) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) {
                        for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; }
                        return null;
                    }
                    if (obj.text && obj.text.trim && obj.text.trim().includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        }, { txt });
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(350); return true; }
        await sleep(250);
    }
    return false;
};

ok(await clickText('Новая игра'), 'Новая игра');
await sleep(1200);
ok(await clickText('Добрыня', 8000), 'Добрыня');
await page.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    cs.startGameWithHero(cs._previewHero);
});
await sleep(1200);
await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Interior', { interiorId: 'tavern', from: 'Village' }));
await sleep(2000);

// ВАРИАНТ A: как есть (NEAREST 2.5)
await page.screenshot({ path: `${OUT}/variant_a_nearest25.png` });
console.log('  ✓ variant_a_nearest25.png');

// ВАРИАНТ B: LINEAR-фильтр на текстурах персонажей (масштаб тот же 2.5)
const bInfo = await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    const keys = new Set();
    if (s.playerSprite) keys.add(s.playerSprite.texture.key);
    if (s.npcSprite) keys.add(s.npcSprite.texture.key);
    const applied = [];
    keys.forEach(k => {
        if (s.textures.exists(k)) {
            s.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
            applied.push(k);
        }
    });
    return applied;
});
console.log('  LINEAR применён к: ' + JSON.stringify(bInfo));
await sleep(400);
await page.screenshot({ path: `${OUT}/variant_b_linear25.png` });
console.log('  ✓ variant_b_linear25.png');

// ВАРИАНТ C: целочисленный 2.0 NEAREST (фильтр вернуть обратно)
const cInfo = await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    [s.playerSprite, s.npcSprite].forEach(sp => { if (sp) { sp.texture.setFilter(Phaser.Textures.FilterMode.NEAREST); sp.setScale(2.0); } });
    // подписи имени/подсказки привязаны к y+80/y-80 — не трогаем, только масштабы фигур
    return true;
});
await sleep(400);
await page.screenshot({ path: `${OUT}/variant_c_int20.png` });
console.log('  ✓ variant_c_int20.png (' + cInfo + ')');

// ВАРИАНТ D: гибрид — запечь билинейное увеличение ×2.5 в текстуру и показать в 1.0
// (быстрая прикидка: canvas-клон на лету)
const dInfo = await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    const src = s.playerSprite;
    const tex = s.textures.get(src.texture.key);
    const frame = tex.get(0);
    const W = frame.width, H = frame.height, F = 2.5;
    const cw = Math.round(W * F), ch = Math.round(H * F);
    if (s.textures.exists('qa_smooth_probe')) s.textures.remove('qa_smooth_probe');
    const ct = s.textures.createCanvas('qa_smooth_probe', cw, ch);
    const cctx = ct.getContext();
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(frame.source.image, frame.cutX, frame.cutY, W, H, 0, 0, cw, ch);
    ct.refresh();
    src.setTexture('qa_smooth_probe');
    src.setScale(1.0);
    return { cw, ch };
});
console.log('  гибрид-клон: ' + JSON.stringify(dInfo));
await sleep(400);
await page.screenshot({ path: `${OUT}/variant_d_baked25.png` });
console.log('  ✓ variant_d_baked25.png');

console.log('JS-ошибок: ' + jsErrors);
await browser.close();

function ok(cond, name) { console.log((cond ? '  ✓ ' : '  ✗ ') + name); }

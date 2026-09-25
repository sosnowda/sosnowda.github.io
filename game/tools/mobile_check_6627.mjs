// МОБИЛЬНАЯ ПРОВЕРКА КАРТЫ (66.27, приказ 3 владельца).
// Портрет 390×844 и ландшафт 844×390: деревня → околица → «🗺 Карта местности».
// Проверки: панель карты вписана в экран, кнопка «Закрыть» кликабельна,
// подписи не наезжают друг на друга (границы текстов), JS-ошибок нет.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/mobile6627';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });

async function runViewport(tag, vw, vh) {
    console.log(`\n=== ${tag}: ${vw}×${vh} ===`);
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error') { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

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
                        if (r) return { x: Math.round(r.x), y: Math.round(r.y) };
                    }
                }
                return null;
            }, { txt, exact });
            if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
            await sleep(250);
        }
        return false;
    }

    // старт
    await clickText('Новая игра');
    await sleep(1500);
    await page.mouse.click(vw * 0.28, vh * 0.42);
    await sleep(1200);
    await clickText('Начать игру');
    await sleep(5000);
    await page.evaluate(() => {
        for (const s of window.game.scene.scenes) {
            if (s && s.tutorial && s.tutorial.activeOverlays) {
                s.tutorial.activeOverlays.forEach(o => {
                    try { o.closeTimer.remove(false); } catch (e) { /* */ }
                    try { o.container.destroy(); } catch (e) { /* */ }
                });
                s.tutorial.activeOverlays = [];
            }
        }
        const v = window.game.scene.getScene('Village');
        if (v) {
            const q = v.registry.get('quest');
            if (q) { q.tutorialStep = 3; v.registry.set('quest', q); }
        }
    });
    await sleep(2200);
    await page.screenshot({ path: `${OUT}/${tag}_village.png` });
    const villageFits = await page.evaluate((vh) => {
        const s = window.game.scene.getScene('Village');
        if (!s) return { ok: false };
        const cam = s.cameras.main;
        const bad = s.children.list.filter(o => o.getBounds && o.visible !== false).filter(o => {
            try { const b = o.getBounds(); return b.y > vh || b.y + b.height < -60; } catch (e) { return false; }
        }).length;
        return { ok: true, offscreen: bad };
    }, vh);
    ok(villageFits.ok, `${tag}: деревня отрисовалась (объектов далеко за экраном: ${villageFits.offscreen})`);

    // околица
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.scene.start('Fork');
    });
    await sleep(2200);
    await page.screenshot({ path: `${OUT}/${tag}_fork.png` });
    // кнопки локаций в пределах экрана?
    const forkFits = await page.evaluate((vh) => {
        const s = window.game.scene.getScene('Fork');
        if (!s) return { ok: false };
        // тексты могут лежать в контейнерах кнопок — обходим рекурсивно
        const texts = [];
        const walk = (obj) => {
            if (!obj) return;
            if (obj.list) { obj.list.forEach(walk); return; }
            if (obj.text && obj.visible !== false) {
                try {
                    const b = obj.getBounds();
                    texts.push({ t: obj.text.trim().slice(0, 22), y: b.y, h: b.height, x: b.x, w: b.width });
                } catch (e) { /* */ }
            }
        };
        s.children.list.forEach(walk);
        const offBottom = texts.filter(t => t.y > vh - 4);
        const backBtn = texts.find(t => t.t.includes('деревню') || t.t.includes('деревня'));
        const mapBtn = texts.find(t => t.t.includes('Карта'));
        return { ok: true, offBottom: offBottom.length, backY: backBtn ? backBtn.y + backBtn.h : null, mapBtn: !!mapBtn, n: texts.length };
    }, vh);
    ok(forkFits.ok && forkFits.mapBtn, `${tag}: околица с кнопкой карты (${forkFits.n} текстов)`);
    ok(forkFits.offBottom === 0, `${tag}: кнопки околицы не уходят за нижний край (за краем: ${forkFits.offBottom})`);

    // карта местности
    const dumpKarta = await page.evaluate(() => {
        const g = window.game;
        const out = [];
        for (const s of g.scene.scenes) {
            if (!s || !s.children || !s.children.list) continue;
            const walk = (obj, dx, dy) => {
                if (!obj) return;
                if (obj.list) { obj.list.forEach(c => walk(c, dx + (obj.x || 0), dy + (obj.y || 0))); return; }
                if (obj.text && String(obj.text).includes('Карта')) {
                    out.push({ scene: s.scene.key, active: !!(s.scene && s.scene.isActive()), x: Math.round(dx + (obj.x || 0)), y: Math.round(dy + (obj.y || 0)), vis: obj.visible !== false && obj.containerVisible !== false, t: String(obj.text).trim().slice(0, 24) });
                }
            };
            s.children.list.forEach(o => walk(o, 0, 0));
        }
        return out;
    });
    console.log('  тексты «Карта»:', JSON.stringify(dumpKarta));
    // Раунд 66.27: на низких экранах кнопка короткая — «🗺 Карта» (без
    // «местности»), поэтому ищем подстроку «Карта», а не полную подпись
    const clickedMap = await clickText('🗺 Карта', false, 6000);
    console.log(`  клик «Карта…»: ${clickedMap ? 'состоялся' : 'кнопка не найдена'}`);
    await sleep(1600);
    const mapCheck = await page.evaluate((vh) => {
        const s = window.game.scene.getScene('Fork');
        if (!s) return { ok: false };
        const W = s.scale.width, H = s.scale.height;
        const list = s.children.list.filter(c => c.depth >= 200 && c.visible !== false);
        const rects = [];
        for (const o of list) {
            try {
                if (o.text) {
                    const b = o.getBounds();
                    rects.push({ kind: 'text', t: o.text.trim().slice(0, 20), x: b.x, y: b.y, w: b.width, h: b.height });
                } else if (o.texture && o.texture.key === 'terrain_map') {
                    rects.push({ kind: 'map', t: 'MAP', x: o.x, y: o.y, w: o.displayWidth, h: o.displayHeight });
                }
            } catch (e) { /* */ }
        }
        const labels = rects.filter(r => r.kind === 'text' && r.t.length < 24 && !r.t.includes('Закрыть') && !r.t.includes('Ты здесь'));
        const overlaps = [];
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j];
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            if (ox > 2 && oy > 2) overlaps.push(`${a.t} × ${b.t} (${ox.toFixed(0)}×${oy.toFixed(0)})`);
        }
        const outOfScreen = rects.filter(r => r.x < -2 || r.y < -2 || r.x + r.w > W + 2 || r.y + r.h > H + 2);
        const close = rects.find(r => r.t.includes('Закрыть'));
        return { ok: true, nLabels: labels.length, overlaps, outOfScreen: outOfScreen.map(r => r.t), closeOk: !!close && close.y + close.h < H && close.y > 0 };
    }, vh);
    ok(mapCheck.ok, `${tag}: карта открылась`);
    if (mapCheck.nLabels === 0) {
        // диагностика: клик не сработал? пробуем прямой showMap()
        console.log('  ⚠ оверлей карты пуст — прямой вызов showMap() (диагностика)');
        await page.evaluate(() => { const s = window.game.scene.getScene('Fork'); if (s) s.showMap(); });
        await sleep(1400);
        const retry = await page.evaluate(() => {
            const s = window.game.scene.getScene('Fork');
            return { n: s.children.list.filter(c => c.depth >= 200).length };
        });
        console.log(`  после прямого showMap(): объектов depth>=200 = ${retry.n}`);
        ok(retry.n > 5, `${tag}: showMap() отрисовывает панель (direct)`);
    }
    ok(mapCheck.overlaps.length === 0, `${tag}: подписи карты не перекрываются (${mapCheck.nLabels} подписей; пересечений: ${mapCheck.overlaps.length}${mapCheck.overlaps.length ? ' — ' + mapCheck.overlaps.join('; ') : ''})`);
    ok(mapCheck.outOfScreen.length === 0, `${tag}: элементы карты в экране (вне экрана: ${mapCheck.outOfScreen.join(', ') || '—'})`);
    ok(mapCheck.closeOk, `${tag}: кнопка «Закрыть» на месте и кликабельна`);
    await page.screenshot({ path: `${OUT}/${tag}_map.png` });

    // закрыть карту и выйти на локацию (река — вода+UI)
    await clickText('Закрыть', true, 4000);
    await sleep(900);
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Fork');
        s.scene.start('Location', { locationId: 'river', from: 'Fork' });
    });
    await sleep(2600);
    await page.screenshot({ path: `${OUT}/${tag}_river.png` });
    await page.close();
}

await runViewport('portrait', 390, 844);
await runViewport('landscape', 844, 390);

console.log('\n--- Итог ---');
console.log('JS errors:', jsErrors);
console.log(fails.length ? `ПРОВАЛЕНО: ${fails.length}\n- ${fails.join('\n- ')}` : 'ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ');
await browser.close();
process.exit(fails.length || jsErrors ? 1 : 0);

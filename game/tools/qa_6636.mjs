// QA 66.36 — деревня из восстановленных листов пака: новые фасады целиком,
// поп-апы на шатре/крышах, ночное свечение по новым housesFX, дым из труб.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = process.env.OUT_DIR || '/tmp/qa6636';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newBrowser() {
    return chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
}
async function trackErrors(page) {
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0, 220)));
    page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
    return errs;
}
async function clickText(page, txt, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate((txt) => {
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
                    if (obj.text && obj.text.trim && obj.text.trim() === txt) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        }, txt);
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(300); return true; }
        await sleep(200);
    }
    return false;
}

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + msg); if (!cond) failed++; };

// ============ Секция 1: деревня днём, поп-апы, новые фасады ============
{
    const browser = await newBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = await trackErrors(page);
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
    await sleep(2000);
    await clickText(page, 'Новая игра');
    await sleep(1000);
    await page.mouse.click(360, 300);
    await sleep(800);
    await clickText(page, 'Начать игру');
    await page.waitForFunction(() => {
        const g = window.game;
        return g && g.scene && g.scene.isActive && g.scene.isActive('Village');
    }, { timeout: 15000 });
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const reg = s.registry;
        const gt = reg.get('gameTime');
        if (gt) { gt.hour = 12; gt.minute = 0; reg.set('gameTime', gt); }
        if (s.tutorial && s.tutorial.activeOverlays) {
            s.tutorial.activeOverlays.forEach(o => {
                try { o.closeTimer.remove(false); } catch (e) {}
                try { o.container.destroy(); } catch (e) {}
            });
            s.tutorial.activeOverlays = [];
        }
    });
    await sleep(900);
    await page.screenshot({ path: `${OUT}/village_day.png` });

    // хит-зоны: 18 домов; шатёр церкви над отпечатком
    const day = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const churchRect = (s.houseHitRects || []).find(r => r.b && r.b.interiorId === 'church');
        if (!churchRect) return { rects: (s.houseHitRects || []).length };
        const topY = Math.round(churchRect.y0);
        const probe = s.buildingAt(Math.round((churchRect.x0 + churchRect.x1) / 2) + 16, topY + 10);
        const probeFoot = s.buildingAt(Math.round((churchRect.x0 + churchRect.x1) / 2) + 16, Math.round(churchRect.y1) - 6);
        const tex = (k) => { const t = window.game.textures.get(k); const f = t.getSourceImage(); return f ? `${f.width}x${f.height}` : null; };
        return {
            rects: (s.houseHitRects || []).length,
            tower: probe ? probe.interiorId : null,
            foot: probeFoot ? probeFoot.interiorId : null,
            topY,
            churchTex: tex('fb_church'), innTex: tex('fb_inn'), elderTex: tex('fb_elder'),
        };
    });
    ok(day.rects === 18, `houseHitRects для 18 домов (${day.rects})`);
    ok(day.tower === 'church', `поп-ап зона: ШАТЁР церкви распознаётся в точке y=${day.topY} (${day.tower})`);
    ok(day.foot === 'church', 'поп-ап зона: отпечаток церкви работает');
    ok(day.churchTex === '270x412' && day.innTex === '398x409' && day.elderTex === '406x303',
       `новые текстуры в менеджере: church=${day.churchTex} inn=${day.innTex} elder=${day.elderTex}`);

    // живое наведение на шатёр
    const pt = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const r = (s.houseHitRects || []).find(r => r.b && r.b.interiorId === 'church');
        const cam = s.cameras.main;
        return { x: Math.round(((r.x0 + r.x1) / 2 - cam.scrollX) * (cam.zoom || 1)), y: Math.round((r.y0 + 8 - cam.scrollY) * (cam.zoom || 1)) };
    });
    await page.mouse.move(pt.x, pt.y, { steps: 3 });
    await sleep(500);
    const tip = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        return { vis: s.buildingTooltip ? s.buildingTooltip.visible : false,
                 txt: s.buildingTooltipText ? s.buildingTooltipText.text.slice(0, 30) : '' };
    });
    ok(tip.vis && tip.txt.includes('Церковь'), `тултип при наведении на шатёр: "${tip.txt}"`);
    await page.screenshot({ path: `${OUT}/tooltip_spire.png` });

    // наведение на крышу таверны
    const tip2 = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const r = (s.houseHitRects || []).find(r => r.b && r.b.interiorId === 'tavern');
        const cam = s.cameras.main;
        return { x: Math.round(((r.x0 + r.x1) / 2 - cam.scrollX) * (cam.zoom || 1)), y: Math.round((r.y0 + 10 - cam.scrollY) * (cam.zoom || 1)) };
    });
    await page.mouse.move(tip2.x, tip2.y, { steps: 3 });
    await sleep(400);
    const tip2vis = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        return s.buildingTooltip ? s.buildingTooltip.visible : false;
    });
    ok(tip2vis, 'тултип при наведении на крышу постоялого двора');

    // зеркальные дома и полнота фасадов: нет спрайтов, вылезающих за восточный частокол
    const edge = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const ts = 48;
        let worst = 0;
        for (const r of s.houseHitRects) worst = Math.max(worst, r.x1 / ts);
        return Math.round(worst * 10) / 10;
    });
    ok(edge <= 24.9, `видимые фасады не переходят частокол (правая кромка col ${edge} ≤ 24.9)`);

    ok(errs.length === 0, `секция деревня: 0 JS-ошибок (${errs.length ? errs[0] : 'чисто'})`);
    await browser.close();
}

// ============ Секция 2: ночь — свечение окон по новым housesFX ============
{
    const browser = await newBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = await trackErrors(page);
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
    await sleep(2000);
    await clickText(page, 'Новая игра');
    await sleep(1000);
    await page.mouse.click(360, 300);
    await sleep(800);
    await clickText(page, 'Начать игру');
    await page.waitForFunction(() => {
        const g = window.game;
        return g && g.scene && g.scene.isActive && g.scene.isActive('Village');
    }, { timeout: 15000 });
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const reg = s.registry;
        const gt = reg.get('gameTime');
        if (gt) { gt.hour = 23; gt.minute = 0; reg.set('gameTime', gt); }
        if (s.tutorial && s.tutorial.activeOverlays) {
            s.tutorial.activeOverlays.forEach(o => {
                try { o.closeTimer.remove(false); } catch (e) {}
                try { o.container.destroy(); } catch (e) {}
            });
            s.tutorial.activeOverlays = [];
        }
    });
    await sleep(1200);
    const night = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        return { glows: (s.windowGlows || []).length,
                 lit: (s.windowGlows || []).filter(g => g.alpha > 0.05).length };
    });
    ok(night.glows >= 60, `ночных свечений собрано (${night.glows})`);
    ok(night.lit >= 20, `окон светится ночью (${night.lit})`);
    await page.screenshot({ path: `${OUT}/village_night.png` });
    ok(errs.length === 0, `секция ночи: 0 JS-ошибок (${errs.length ? errs[0] : 'чисто'})`);
    await browser.close();
}

console.log(failed === 0 ? '\n=== QA 66.36: ВСЁ ЗЕЛЁНОЕ ===' : `\n=== QA 66.36: красных ${failed} ===`);
process.exit(failed ? 1 : 0);

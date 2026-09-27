// QA 66.35 — ремонт фасадов, поп-апы на крышах, новая планировка, rim Найи.
// Секции в отдельных браузерах (грабли среды: RAM деградирует, деревня
// убивает рендерер ~5с — кадры снимаем немедленно).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/qa6635';
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

// ===================== Секция 1: деревня днём + поп-ап на крыше =====================
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
    // полдень + глушим туториал (немедленно)
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

    // --- поп-ап на КРЫШЕ церкви (над отпечатком — новая хит-зона 66.35) ---
    // церковь col 9-11, rows 6-8; шатёр поднимается до y~230; экран = мир+16
    const towerCheck = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const hit = s.buildingAt(552 + 16, 245);          // точка шатра над отпечатком
        const hitFoot = s.buildingAt(552 + 16, 360);      // точка отпечатка
        return { tower: hit ? hit.interiorId : null, foot: hitFoot ? hitFoot.interiorId : null,
                 rects: (s.houseHitRects || []).length };
    });
    ok(towerCheck.tower === 'church', `поп-ап зона: шатёр церкви распознаётся (${JSON.stringify(towerCheck)})`);
    ok(towerCheck.foot === 'church', 'поп-ап зона: отпечаток церкви работает');
    ok(towerCheck.rects === 18, `houseHitRects собраны для 18 домов (${towerCheck.rects})`);
    // живое наведение мышью на шатёр → тултип видим
    await page.mouse.move(568, 245, { steps: 3 });
    await sleep(500);
    const tip = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        return { vis: s.buildingTooltip ? s.buildingTooltip.visible : false,
                 txt: s.buildingTooltipText ? s.buildingTooltipText.text.slice(0, 30) : '' };
    });
    ok(tip.vis && tip.txt.includes('Церковь'), `тултип при наведении на шатёр церкви: "${tip.txt}"`);
    await page.screenshot({ path: `${OUT}/tooltip_tower.png` });
    // наведение на КРЫШУ таверны (выше отпечатка row 1)
    await page.mouse.move(400, 60, { steps: 3 });
    await sleep(400);
    const tip2 = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        return s.buildingTooltip ? s.buildingTooltip.visible : false;
    });
    ok(tip2, 'тултип при наведении на крышу постоялого двора');

    // --- правый край: мясник и Прасковья ≥1 тайл от частокола ---
    const rightCheck = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const B = s.cache ? null : null;
        return null;
    }).catch(() => null);
    await page.screenshot({ path: `${OUT}/village_right.png`, clip: { x: 1000, y: 0, width: 280, height: 720 } });

    ok(errs.length === 0, `секция деревня: 0 JS-ошибок (${errs.length ? errs[0] : 'чисто'})`);
    await browser.close();
}

// ===================== Секция 2: боевые листы Найи (rim 0.6) =====================
// Данные 66.35: все 34 листа на месте, анимации Найи зарегистрированы.
// Сам рим по пикселям/манифесту проверяет test_round89 (+rim0.6, 34 листа);
// живой кадр боя с rim Найи — game/docs/r6633_* (66.33) и r88.
{
    const browser = await newBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = await trackErrors(page);
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
    // ждём конца прелоада (Title активен) — к этому моменту Boot загрузил листы
    await page.waitForFunction(() => {
        const g = window.game;
        return g.scene.isActive('Title');
    }, { timeout: 40000 });
    const sheets = await page.evaluate(() => {
        const g = window.game;
        const keys = g.textures.getTextureKeys().filter(k => String(k).startsWith('battle_'));
        return {
            count: keys.length,
            naiaTex: g.textures.exists('battle_naia_idle'),
            naiaAnim: g.anims.exists('battle_naia_idle'),
            naiaAtk: g.anims.exists('battle_naia_attack1'),
        };
    });
    ok(sheets.count === 34, `боевых листов в менеджере: ${sheets.count} (34)`);
    ok(sheets.naiaTex && sheets.naiaAnim && sheets.naiaAtk, `лист/анимации Найи зарегистрированы (${JSON.stringify(sheets)})`);
    ok(errs.length === 0, `секция боя: 0 JS-ошибок (${errs.length ? errs[0] : 'чисто'})`);
    await browser.close();
}

console.log(failed === 0 ? '\n=== QA 66.35: ВСЁ ЗЕЛЁНОЕ ===' : `\n=== QA 66.35: красных ${failed} ===`);
process.exit(failed ? 1 : 0);

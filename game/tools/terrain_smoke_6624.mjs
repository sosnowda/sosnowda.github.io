// Раунд 66.24: живой смоук Playwright (1280×720, локальный сервер :8765).
// Приказ 2: Тракт разделён на Южный и Северный, у каждого указатель на
// деревню, Южный упирается в Реку (вода + мост в нижнем крае локации).
// Приказ 3: карта местности — полноценная (TerrainMap), метка игрока,
// 14 подписей. Кадры: /tmp/shots6624/*.png → game/docs/r6624_*.webp.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const OUT = '/tmp/shots6624';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error') { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

async function shot(name) { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('SHOT', name); }

// Клик по текстовой кнопке Phaser (обход контейнеров, экранные координаты)
async function clickText(txt, timeout = 9000) {
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
                    if (obj.text && obj.text.trim && obj.text.trim() === txt) {
                        return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        }, txt);
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}

const sceneTextExists = (sceneKey, txt) => page.evaluate(([k, t]) => {
    const s = window.game.scene.getScene(k);
    if (!s || !s.children) return false;
    const walk = (obj) => {
        if (!obj) return false;
        if (obj.list) return obj.list.some(walk);
        return !!(obj.text && obj.text.trim && obj.text.trim() === t);
    };
    return s.children.list.some(walk);
}, [sceneKey, txt]);

// ---- Старт игры: титул → новый герой → деревня → околица ----
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);
ok(await clickText('Новая игра'), 'меню: «Новая игра» открыла выбор героя');
await sleep(1500);
await page.mouse.click(360, 300); // карточка первого героя (как в landing_shots)
await sleep(1200);
ok(await clickText('Начать игру'), 'выбор героя: «Начать игру» стартовала деревню');
await sleep(4500);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    if (!s) return;
    if (s.tutorial && s.tutorial.activeOverlays) {
        s.tutorial.activeOverlays.forEach(o => {
            try { o.closeTimer.remove(false); } catch (e) { /* снят */ }
            try { o.container.destroy(); } catch (e) { /* уничтожен */ }
        });
        s.tutorial.activeOverlays = [];
    }
    const q = s.registry.get('quest');
    if (q) { q.tutorialStep = 3; s.registry.set('quest', q); }
});
await sleep(800);
await page.evaluate(() => { const g = window.game; g.scene.stop('Village'); g.scene.start('Fork'); });
await sleep(3000);

// ---- Приказ 2: на околице 10 кнопок, оба тракта ----
const locMod = await page.evaluate(async () => {
    const m = await import('/game/src/data/mapLocations.js');
    return m.getForkLocations().map(l => l.id);
});
ok(locMod.length === 10 && locMod.includes('road_south') && locMod.includes('road_north'),
    `развилка: ${locMod.length} локаций, оба тракта в списке`);
ok(await sceneTextExists('Fork', '🛤 Южный Тракт'), 'кнопка «🛤 Южный Тракт» на околице');
ok(await sceneTextExists('Fork', '🛤 Северный Тракт'), 'кнопка «🛤 Северный Тракт» на околице');

// ---- Приказ 3: полноценная карта местности ----
ok(await clickText('🗺 Карта местности'), 'кнопка «🗺 Карта местности» открыла карту');
await sleep(1200);
const mapState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    if (!s) return null;
    const hasTex = s.textures.exists('terrain_map');
    const tex = hasTex ? s.textures.get('terrain_map') : null;
    let labels = 0, youHere = 0;
    s.children.list.forEach(c => {
        if (c.type === 'Text' && c.depth === 204) labels++;
        if (c.type === 'Text' && String(c.text).includes('Ты здесь')) youHere++;
    });
    return { hasTex, w: tex ? tex.width : 0, h: tex ? tex.height : 0, labels, youHere };
});
ok(!!mapState && mapState.hasTex, 'карта: canvas-текстура terrain_map создана');
ok(!!mapState && mapState.w === 680 && mapState.h === 540, `карта: полотно ${mapState && mapState.w}×${mapState && mapState.h}`);
ok(!!mapState && mapState.labels >= 14, `карта: подписей локаций ${mapState && mapState.labels} (≥14)`);
ok(!!mapState && mapState.youHere === 1, 'карта: метка «Ты здесь» у деревни');
await shot('r6624_terrain_map');
ok(await clickText('Закрыть'), 'карта закрылась');

// ---- Южный Тракт: указатель «Деревня» + река с мостом в нижнем крае ----
ok(await clickText('🛤 Южный Тракт'), 'переход на Южный Тракт');
await sleep(3200);
const southState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Location');
    if (!s) return null;
    let signpost = false, waterGfx = false, bridgeGfx = false;
    s.children.list.forEach(c => {
        if (c.type === 'Text' && c.text === 'Деревня') signpost = true;
        if (c.type === 'Graphics' && Math.abs(c.depth - 3.5) < 0.01) waterGfx = true;
        if (c.type === 'Graphics' && Math.abs(c.depth - 3.7) < 0.01) bridgeGfx = true;
    });
    return { locId: s.locationId, signpost, waterGfx, bridgeGfx };
});
ok(!!southState && southState.locId === 'road_south', 'сцена: Южный Тракт (road_south)');
ok(!!southState && southState.signpost, 'Южный Тракт: указатель с надписью «Деревня» стоит');
ok(!!southState && southState.waterGfx, 'Южный Тракт: лента реки в нижнем крае локации');
ok(!!southState && southState.bridgeGfx, 'Южный Тракт: деревянный мост через реку');
await shot('r6624_road_south');
ok(await clickText('🚪 Выход'), 'выход с Южного Тракта на околицу');
await sleep(1500);

// ---- Северный Тракт: тот же вид, указатель, БЕЗ реки ----
ok(await clickText('🛤 Северный Тракт'), 'переход на Северный Тракт');
await sleep(3200);
const northState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Location');
    if (!s) return null;
    let signpost = false, waterGfx = false;
    s.children.list.forEach(c => {
        if (c.type === 'Text' && c.text === 'Деревня') signpost = true;
        if (c.type === 'Graphics' && Math.abs(c.depth - 3.5) < 0.01) waterGfx = true;
    });
    return { locId: s.locationId, signpost, waterGfx };
});
ok(!!northState && northState.locId === 'road_north', 'сцена: Северный Тракт (road_north)');
ok(!!northState && northState.signpost, 'Северный Тракт: указатель с надписью «Деревня» стоит');
ok(!!northState && !northState.waterGfx, 'Северный Тракт: реки в локации нет (уходит за горизонт)');
await shot('r6624_road_north');
ok(await clickText('🚪 Выход'), 'выход с Северного Тракта на околицу');
await sleep(1500);

// ---- Река: мост тракта (контекст приказа 2) ----
ok(await clickText('🌊 Река Кистерма'), 'переход на Реку');
await sleep(3200);
const riverOk = await page.evaluate(() => {
    const s = window.game.scene.getScene('Location');
    return s ? s.locationId === 'river' : false;
});
ok(riverOk, 'сцена: Река (мост через реку в центре)');
await shot('r6624_river_bridge');

// ---- Итог ----
ok(jsErrors === 0, `JS-ошибок за прогон: ${jsErrors}`);
await browser.close();
console.log(`\nСМОУК 66.24: ${pass} зелёных, ${fail} красных, JS-ошибок ${jsErrors}`);
process.exit(fail || jsErrors ? 1 : 0);

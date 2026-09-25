// 66.25 (п.10): проход «глазами игрока» по НОВОЙ разметке трактов и карты.
// Маршрут: титул → герой → деревня → выход на околицу → КАРТА МЕСТНОСТИ
// (новая компоновка: слева выпас/пасека/поле, справа леса, ветка к мельнице
// и погосту, дорожки ко всем локациям) → СЕВЕРНЫЙ ТРАКТ (указатель, конец
// локации) → назад → ЮЖНЫЙ ТРАКТ (река и мост в дальнем крае) → назад.
// Кадры → /tmp/shots6625/*.png; assert-журнал; 0 JS-ошибок — обязательно.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const OUT = '/tmp/shots6625';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error') { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };
async function shot(name) { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('SHOT', name); }

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
        }, txt);
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}

// ---- Старт ----
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);
await clickText('Новая игра');
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await clickText('Начать игру');
await sleep(4500);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
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
await sleep(600);

// ---- 1. Выход из деревни кликом по воротам (глаза игрока) ----
const clickPos = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const wx = 25 * 48 + 24, wy = 5 * 48 + 24;
    return { sx: wx, sy: wy };
});
await page.mouse.click(clickPos.sx, clickPos.sy);
await sleep(1500);
ok(await page.evaluate(() => window.game.scene.isActive('Fork')), 'выход через ворота: игрок на околице');
await shot('01-fork');

// ---- 2. КАРТА МЕСТНОСТИ: новая компоновка ----
await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    if (s && s.showMap) s.showMap();
});
await sleep(1200);
await shot('02-terrain-map');
const mapState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    const tex = s.textures.get('terrain_map');
    const labels = [];
    if (s.children) {
        const walk = (o) => {
            if (!o) return;
            if (o.list) { o.list.forEach(walk); return; }
            if (o.text && o.text.trim) labels.push(o.text.trim());
        };
        s.children.list.forEach(walk);
    }
    return {
        hasMap: !!(tex && tex.key === 'terrain_map'),
        labels,
    };
});
ok(mapState.hasMap, 'карта местности отрисована (terrain_map)');
for (const t of ['Деревня', 'Северный Тракт', 'Южный Тракт', 'Река', 'Мост', 'Озеро', 'Мельница', 'Погост',
    'Выпас', 'Пасека', 'Поле', 'Опушка', 'Лесная поляна', 'Густой лес']) {
    ok(mapState.labels.includes(t), `на карте подписана локация «${t}»`);
}
// Новая разметка (импорт модуля прямо в странице)
const layout = await page.evaluate(async () => {
    const mod = await import('./src/systems/TerrainMap.js');
    const T = mod.TERRAIN;
    return {
        pastureLeft: T.pasture.x + T.pasture.rx < T.village.x - T.village.w / 2 + 8,
        apiaryLeft: T.apiary.x + T.apiary.rx < T.village.x - T.village.w / 2 + 8,
        fieldLeft: T.field.x + T.field.rx < T.village.x - T.village.w / 2 + 8,
        forestRight: T.forestEdge.x > T.tractX && T.forestGlade.x > T.tractX && T.forestDeep.x > T.tractX,
        millRight: T.mill.x > T.tractX && T.mill.pathY < T.village.y - T.village.h / 2,
        pogostRight: T.pogost.x > T.tractX,
        paths: mod.TERRAIN_PATHS.length,
    };
});
ok(layout.pastureLeft && layout.apiaryLeft && layout.fieldLeft, 'п.5: выпас/пасека/поле — СЛЕВА от деревни');
ok(layout.forestRight, 'п.6: леса — справа от Южного Тракта');
ok(layout.millRight, 'п.7: ветка к мельнице вправо от Северного Тракта');
ok(layout.pogostRight, 'п.7: погост — справа от Северного Тракта');
ok(layout.paths >= 9, `п.9: дорожки ко всем локациям (${layout.paths} сегментов)`);
// Закрыть карту
await clickText('Закрыть');
await sleep(600);

// ---- 3. СЕВЕРНЫЙ ТРАКТ «глазами игрока» ----
await clickText('Северный Тракт');
await sleep(3500);
ok(await page.evaluate(() => window.game.scene.isActive('Location')), 'переход на Северный Тракт (сцена локации)');
const north = await page.evaluate(() => {
    const s = window.game.scene.getScene('Location');
    return { id: s.locationId, hasSignpost: !!s.locationId };
});
ok(north.id === 'road_north', 'локация — road_north (Северный Тракт)');
await shot('03-road-north');
// Пройтись по локации: клавиши влево/вправо — игрок идёт по тракту
await page.keyboard.down('ArrowRight');
await sleep(1200);
await page.keyboard.up('ArrowRight');
await sleep(300);
await shot('04-road-north-walk');
await clickText('Выход');
await sleep(1500);
ok(await page.evaluate(() => window.game.scene.isActive('Fork')), 'выход с тракта на околицу');

// ---- 4. ЮЖНЫЙ ТРАКТ: река и мост в дальнем крае ----
await clickText('Южный Тракт');
await sleep(3500);
const south = await page.evaluate(() => window.game.scene.getScene('Location')?.locationId);
ok(south === 'road_south', 'локация — road_south (Южный Тракт)');
await page.keyboard.down('ArrowRight');
await sleep(1400);
await page.keyboard.up('ArrowRight');
await sleep(300);
await shot('05-road-south-walk');
await clickText('Выход');
await sleep(1500);
ok(await page.evaluate(() => window.game.scene.isActive('Fork')), 'возврат на околицу');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗ | JS ошибок: ${jsErrors}`);
await browser.close();
process.exit(fail || jsErrors ? 1 : 0);

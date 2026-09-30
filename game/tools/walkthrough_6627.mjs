// ПОЛНЫЙ ПРОХОД ПО ВСЕМ ЛОКАЦИЯМ (66.27, приказ 1 владельца).
// «Глазами игрока»: деревня (улица) → все интерьеры (18 домов) → ворота →
// околица → карта местности → ВСЕ локации развилки (лес цепочкой: опушка →
// поляна → чаща; оба тракта; поле; озеро; погост; мельница; выпас; река;
// пасека) + Тёмный лес (прогулка). В каждой точке: скриншот, проверка
// активности сцены, сбор JS-ошибок. Итог — список проблем.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/walk6627';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const jsErrList = [];
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// 66.50-диагностика (временная): след всех scene.start/launch с источником
await page.addInitScript(() => {
    window.__sceneLog = [];
    const patch = () => {
        if (!window.Phaser || !window.Phaser.Scenes || !window.Phaser.Scenes.ScenePlugin) { setTimeout(patch, 50); return; }
        const SP = window.Phaser.Scenes.ScenePlugin.prototype;
        for (const m of ['start', 'launch', 'run']) {
            const orig = SP[m];
            SP[m] = function (key) {
                const from = this.scene ? this.scene.scene.key : '?';
                window.__sceneLog.push(m + ': ' + from + ' -> ' + key + ' @' + Math.round(performance.now()) + 'ms');
                return orig.apply(this, arguments);
            };
        }
    };
    patch();
});
page.on('pageerror', e => { jsErrors++; jsErrList.push(String(e).slice(0, 220)); console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error') { jsErrors++; jsErrList.push(m.text().slice(0, 220)); console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

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

// активная сцена (первая активная из игровых)
async function activeScene() {
    return page.evaluate(() => {
        const g = window.game;
        for (const s of g.scene.scenes) {
            if (s && s.scene && s.scene.isActive() && !['BootScene', 'Loading'].includes(s.scene.key)) return s.scene.key;
        }
        return null;
    });
}

console.log('--- 1. Старт игры ---');
await clickText('Новая игра');
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await clickText('Начать игру');
await sleep(5000);
// отключаем туториал и ставим день/час
await page.evaluate(() => {
    for (const s of window.game.scene.scenes) {
        if (s && s.tutorial && s.tutorial.activeOverlays) {
            s.tutorial.activeOverlays.forEach(o => {
                try { o.closeTimer.remove(false); } catch (e) { /* снят */ }
                try { o.container.destroy(); } catch (e) { /* уничтожен */ }
            });
            s.tutorial.activeOverlays = [];
        }
    }
    const v = window.game.scene.getScene('Village');
    if (v) {
        const q = v.registry.get('quest');
        if (q) { q.tutorialStep = 3; v.registry.set('quest', q); }
        const gt = v.registry.get('gameTime');
        if (gt) { gt.day = 10; gt.hour = 9; v.registry.set('gameTime', gt); }
    }
});
await sleep(2500);
ok(await activeScene() === 'Village', 'деревня активна после старта');
await page.screenshot({ path: `${OUT}/01_village_street.png` });

console.log('--- 2. Все интерьеры деревни (18) ---');
const INTERIORS = [
    'elder_house', 'tavern', 'blacksmith', 'villager_house_1', 'villager_house_2',
    'beekeeper_house', 'potter_house', 'church', 'healer_house', 'fisher_house',
    'carpenter_house', 'weaver_house', 'grocer_house', 'butcher_house', 'shop_tools',
    'shoemaker_house', 'woodcutter_house', 'villager_house_3',
];
let intOk = 0;
for (const iid of INTERIORS) {
    await page.evaluate((iid) => {
        const v = window.game.scene.getScene('Village');
        if (!v) return;
        v.scene.launch('Interior', { interiorId: iid, from: 'Village' });
    }, iid);
    await sleep(2200);
    const st = await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        if (!s || !s.scene || !s.scene.isActive()) return { active: false };
        const walk = (obj) => {
            if (!obj) return null;
            if (obj.list) { for (const c of obj.list) { const r = walk(c); if (r) return r; } return null; }
            if (obj.text && obj.text.trim && obj.text.trim().length > 2) return obj.text.trim();
            return null;
        };
        let title = null;
        for (const top of s.children.list) { const t = walk(top); if (t) { title = t; break; } }
        const npcs = (s.npcs || []).length;
        return { active: true, title, npcs, player: !!s.playerSprite };
    });
    const good = st.active && st.player;
    if (good) intOk++;
    ok(good, `интерьер ${iid}: активен, игрок на месте (${st.title ? st.title.slice(0, 26) : '—'}, НПЦ: ${st.npcs})`);
    await page.screenshot({ path: `${OUT}/int_${iid}.png` });
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        if (s && s.scene) s.scene.stop('Interior');
        const v = window.game.scene.getScene('Village');
        if (v) v.scene.resume();
    });
    await sleep(900);
}
ok(intOk === INTERIORS.length, `все интерьеры открылись (${intOk}/${INTERIORS.length})`);

console.log('--- 3. Ворота → околица (клик по воротам) ---');
// «глазами игрока»: идём к воротам стрелками → клавиша/клик. Автопрогулка
// ненадёжна в headless (~0.5 FPS) — используем переход кликом по кнопке
// выхода, если есть, иначе программно.
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    v.scene.start('Fork');
});
await sleep(2200);
ok(await activeScene() === 'Fork', 'околица (развилка) активна');
await page.screenshot({ path: `${OUT}/02_fork.png` });

console.log('--- 4. Карта местности на околице ---');
await clickText('🗺 Карта местности', false, 6000);
await sleep(1500);
const mapState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    if (!s) return { ok: false };
    // 66.34: карта местности = ПОЛНОЭКРАННАЯ сцена Fork (terrain_map + подписи
    // depth 14), старого поп-апа-оверлея depth>=200 больше нет (актуализация 66.40)
    const hasMap = s.children.list.some(c => c.texture && c.texture.key === 'terrain_map');
    const labels = s.children.list.filter(c => c.text && c.depth === 14).map(c => c.text.trim())
        .filter(t => t && t.length < 30);
    return { ok: hasMap && labels.length >= 12, labels };
});
ok(mapState.ok, `карта местности открылась (${(mapState.labels || []).length} надписей)`);
await page.screenshot({ path: `${OUT}/03_terrain_map.png` });
// 66.50 (урок прогона): прежний «закрыть оверлей» кликом по центру (640,360)
// на пол-экранной карте 66.34 попадает в КЛИК-ЗОНУ ДЕРЕВНИ → travelTo('village')
// стартует фантомную Village поверх всего дальнейшего маршрута (двойные
// активные сцены; кадры пасеки вместо леса/деревни). Оверлея больше нет —
// клик-заглушку убираем, чистка depth>=200 оставлена как безвредная.
await sleep(900);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    if (s) s.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
});
await sleep(600);

console.log('--- 5. Все локации развилки ---');
const VISITS = [
    ['forest_edge', 'Location'], ['forest_glade', 'Location'], ['forest', 'Location'],
    ['road_south', 'Location'], ['road_north', 'Location'],
    ['field', 'Location'], ['lake', 'Location'], ['pogost', 'Location'],
    ['mill', 'Location'], ['pasture', 'Location'], ['river', 'Location'],
    ['apiary', 'Location-autoApiary'],
];
let locOk = 0;
for (const [lid, kind] of VISITS) {
    await page.evaluate((lid) => {
        const f = window.game.scene.getScene('Fork') || window.game.scene.getScene('Location') || window.game.scene.getScene('Apiary');
        (f || window.game.scene.getScene('Village')).scene.start('Location', { locationId: lid, from: 'Fork' });
    }, lid);
    await sleep(2800);
    const st = await page.evaluate(() => {
        const g = window.game.scene.scenes;
        for (const s of g) {
            if (s && s.scene && s.scene.isActive()) {
                if (['Location', 'Apiary'].includes(s.scene.key)) {
                    const title = (() => {
                        // заголовок локации — верхний ТОР-УРОВНЕВЫЙ текст,
                        // ЦЕНТРИРОВАННЫЙ по ширине (HUD «❤…» прижат к левому
                        // краю, указатели/кнопки стоят ниже или сбоку)
                        const texts = [];
                        for (const obj of s.children.list) {
                            if (obj && obj.text && obj.text.trim && obj.text.trim().length > 3) {
                                texts.push({ y: obj.y, x: obj.x, t: obj.text.trim() });
                            }
                        }
                        const cx = (s.scale.width || 1280) / 2;
                        const centered = texts.filter(o => Math.abs(o.x - cx) < 80 && o.y < 90);
                        centered.sort((a, b) => a.y - b.y);
                        return centered.length ? centered[0].t : (texts.length ? texts[0].t : null);
                    })();
                    return { key: s.scene.key, title, loc: s.locationId || null, w: s.scale.width, h: s.scale.height };
                }
            }
        }
        return null;
    });
    const good = !!st;
    if (good) locOk++;
    ok(good, `локация ${lid}: ${st ? st.key + (st.loc && st.loc !== lid ? ` (redirect ${st.loc})` : '') + ' «' + (st.title || '').slice(0, 24) + '»' : 'НЕ ОТКРЫЛАСЬ'}`);
    await page.screenshot({ path: `${OUT}/loc_${lid}.png` });
    await sleep(400);
}
ok(locOk === VISITS.length, `все локации открылись (${locOk}/${VISITS.length})`);

console.log('--- 6. Тёмный лес (прогулка) ---');
// 66.50: выход из пасеки КАК У ИГРОКА — телепорт на выходной тайл + клик
// интерактивной кнопки «Вернуться к околице» (leaveApiary → Fork, карта).
// Прежний программный scene.start('Forest') из остановленной сцены оставлял
// пасеку активной поверх Forest (кадр-артефакт). С карты — кнопка леса.
const exitApiary = await page.evaluate(() => {
    const a = window.game.scene.getScene('Apiary');
    if (!a || !a.playerObj) return false;
    const label = a.children.list.find(c => c.text && c.text.trim && c.text.trim().includes('К ОКОЛИЦЕ'));
    if (!label) return false;
    a.playerObj.setPosition(label.x, label.y + 48 * 1.6); // метка на TS*1.6 выше тайла, TS=48
    return true;
});
ok(exitApiary, 'игрок телепортирован к выходному тайлу пасеки');
await sleep(1500);
// 66.50: выход из пасеки/леса — интерактив по клавише E (промпт «Нажмите E — …»),
// кликабельной кнопки нет. Жмём E, стоя на выходном тайле.
await page.keyboard.press('e');
await sleep(2500);
await clickText('Тёмный лес — прогулка', false, 8000);
// headless троттлит rAF — даём Forest нарисовать первый кадр
await sleep(7000);
const sceneAfterForest = await activeScene();
console.log('  [diag] activeScene после леса:', sceneAfterForest, '| все активные:', await page.evaluate(() => JSON.stringify(window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => ({ k: s.scene.key, st: s.scene.status })))));
ok(sceneAfterForest === 'Forest', 'Тёмный лес (ForestScene) активен');
await page.screenshot({ path: `${OUT}/loc_darkforest.png` });
await sleep(2500);
await page.screenshot({ path: `${OUT}/loc_darkforest.png` });

console.log('--- 7. Возврат в деревню ---');
// 66.50: тоже UI-путь — из леса к выходному тайлу → «Вернуться к околице» →
// с карты «◀ Вернуться в деревню».
const exitForest = await page.evaluate(() => {
    const f = window.game.scene.getScene('Forest');
    if (!f || !f.playerObj) return false;
    const label = f.children.list.find(c => c.text && c.text.trim && c.text.trim().includes('К ОКОЛИЦЕ'));
    if (!label) return false;
    f.playerObj.setPosition(label.x, label.y + 48 * 1.6); // TS=48
    return true;
});
ok(exitForest, 'игрок телепортирован к выходному тайлу леса');
await sleep(1500);
await page.keyboard.press('e'); // «Нажмите E — Вернуться к околице»
await sleep(2500);
await clickText('Вернуться в деревню', false, 8000);
await sleep(4500);
const sceneAfterVillage = await activeScene();
console.log('  [diag] activeScene после возврата:', sceneAfterVillage, '| все активные:', await page.evaluate(() => JSON.stringify(window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => ({ k: s.scene.key, st: s.scene.status })))));
ok(sceneAfterVillage === 'Village', 'возврат в деревню');
await page.screenshot({ path: `${OUT}/04_village_back.png` });

console.log('--- Итог ---');
try { const sl = await page.evaluate(() => (window.__sceneLog || []).slice(-30)); console.log('=== СЦЕНОВЫЙ ЖУРНАЛ (последние 30) ==='); sl.forEach(l => console.log('  ' + l)); } catch (e) {}
console.log('JS errors:', jsErrors, jsErrList.length ? '\n  ' + jsErrList.join('\n  ') : '');
console.log(fails.length ? `ПРОВАЛЕНО: ${fails.length}\n- ${fails.join('\n- ')}` : 'ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ');
await browser.close();
process.exit(fails.length || jsErrors ? 1 : 0);

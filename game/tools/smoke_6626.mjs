// Смоук 66.26: иконостас (окно свободно, без дублей), спавн в церкви на полу,
// уникальные точки НПЦ на улице, ответ про вора БЕЗ повтора, уникальные точки на локации.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/smoke6626';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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

async function dumpTexts(sceneKey = null) {
    return page.evaluate((sceneKey) => {
        const g = window.game;
        const out = [];
        for (const s of g.scene.scenes) {
            if (!s || !s.scene || !s.scene.isActive()) continue;
            if (sceneKey && s.scene.key !== sceneKey) continue;
            const walk = (obj) => {
                if (!obj) return;
                if (obj.list) { obj.list.forEach(walk); return; }
                if (obj.text && obj.text.trim && obj.text.trim()) out.push(obj.text.trim());
            };
            s.children.list.forEach(walk);
        }
        return out;
    }, sceneKey);
}

// ждём окончания эффекта печатной машинки: тексты сцены перестают меняться
async function waitTextsStable(sceneKey = null, idleMs = 700, timeout = 15000) {
    const t0 = Date.now();
    let prev = JSON.stringify(await dumpTexts(sceneKey));
    let lastChange = Date.now();
    while (Date.now() - t0 < timeout) {
        await sleep(250);
        const cur = JSON.stringify(await dumpTexts(sceneKey));
        if (cur !== prev) { prev = cur; lastChange = Date.now(); continue; }
        if (Date.now() - lastChange >= idleMs) return true;
    }
    return false;
}

// выбор диалога: первый клик пропускает машинку, второй запускает действие
// (см. ui.js wrappedCallback: typingActive → skipTyping → return).
// Кликаем, пока сам текст выбора НЕ ИСЧЕЗНЕТ с экрана (навигация состоялась).
async function clickChoice(txt, timeout = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate((txt) => {
            const g = window.game;
            for (const s of g.scene.scenes) {
                if (!s || !s.scene || !s.scene.isActive()) continue;
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
                    if (r) return r;
                }
            }
            return null;
        }, txt);
        if (!pos) return true;              // выбор исчез — навигация прошла
        await page.mouse.click(pos.x, pos.y);
        await sleep(800);
    }
    return !(await page.evaluate((txt) => {
        const g = window.game;
        for (const s of g.scene.scenes) {
            if (!s || !s.scene || !s.scene.isActive()) continue;
            const walk = (obj) => {
                if (!obj) return false;
                if (obj.list) return obj.list.some(walk);
                return !!(obj.text && obj.text.trim && obj.text.trim().includes(txt));
            };
            if (s.children.list.some(walk)) return true;
        }
        return false;
    }, txt));
}

console.log('--- 1. Старт игры ---');
await clickText('Новая игра');
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await clickText('Начать игру');
await sleep(5000);
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
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const reg = s.registry;
    const gt = reg.get('gameTime');
    if (gt) { gt.day = 10; gt.hour = 9; reg.set('gameTime', gt); }
});
await sleep(2500);

console.log('--- 2. Улица: уникальные точки НПЦ ---');
const street = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    return (s.streetNpcs || []).map(n => ({ id: n.id, x: n.spr.x, y: n.spr.y }));
});
console.log('  на улице:', street.map(n => n.id).join(', ') || '(никого)');
const seen = new Map();
let dupStreet = 0;
street.forEach(p => {
    const k = Math.round(p.x) + ',' + Math.round(p.y);
    if (seen.has(k)) dupStreet++;
    seen.set(k, p.id);
});
ok(dupStreet === 0, `улица: ни двух НПЦ в одной точке (совпадений: ${dupStreet})`);
ok(street.length >= 4, `улица: в 9:00 народу достаточно (${street.length})`);
await page.screenshot({ path: `${OUT}/6626_street.png` });

console.log('--- 3. Церковь: окно свободно, спавн на полу ---');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    s.scene.launch('Interior', { interiorId: 'church', from: 'Village' });
});
await sleep(2500);
const church = await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    const { width, height } = s.scale;
    const py = s.playerSprite ? s.playerSprite.y : null;
    // ищем иконы иконостаса (изображения int_deco_icon_*)
    const icons = [];
    const walk = (obj) => {
        if (!obj) return;
        if (obj.list) { obj.list.forEach(walk); return; }
        if (obj.texture && obj.texture.key && String(obj.texture.key).startsWith('int_deco_icon_') && obj.visible !== false) {
            icons.push({ key: obj.texture.key, x: Math.round(obj.x), y: Math.round(obj.y), w: Math.round(obj.displayWidth), h: Math.round(obj.displayHeight) });
        }
    };
    s.children.list.forEach(walk);
    // рама иконостаса: ищем graphics нельзя — но по комментариям x0=0.17W
    return { py, floorY: height * 0.64, icons, W: width, H: height };
});
console.log('  икон на экране:', JSON.stringify(church.icons.map(i => i.key.replace('int_deco_icon_', '') + '@' + i.x + ',' + i.y)));
ok(church.py !== null && Math.abs(church.py - church.floorY) < 6, `церковь: игрок на полу (y=${church.py && church.py.toFixed(0)}, ожидалось ~${church.floorY.toFixed(0)})`);
const keys = church.icons.map(i => i.key);
const uniq = new Set(keys);
ok(uniq.size === keys.length, `церковь: ни одной повторной иконы (${keys.length} шт, уникальных ${uniq.size})`);
ok(keys.filter(k => k === 'int_deco_icon_annunciation').length === 1, 'церковь: Благовещение ровно одно (врата; на аналое — другая икона)');
// в иконостасе ровно 6 икон; 7-я (int_deco_icon_wall) — на аналое, другая
const icost = keys.filter(k => k !== 'int_deco_icon_wall');
ok(new Set(icost).size === 6 && icost.length === 6, `церковь: в иконостасе ровно 6 уникальных икон (${icost.length})`);
// иконостас не накрывает окно: рама от 0.17W, иконы левее 0.17W отсутствуют
const leftIcons = church.icons.filter(i => i.x - i.w / 2 < church.W * 0.16);
ok(leftIcons.length === 0, `церковь: иконы не заходят на окно левой стены (налезающих: ${leftIcons.length})`);
await page.screenshot({ path: `${OUT}/6626_church.png` });
await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    s.scene.stop('Interior');
    const v = window.game.scene.getScene('Village');
    v.scene.resume();
});
await sleep(1200);

console.log('--- 4. Диалог про вора: без повтора ответа ---');
const talkId = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const cand = (s.streetNpcs || []).find(n => n.id !== 'elder');
    if (!cand) return null;
    s.talkToStreetNpc(cand.id);
    return cand.id;
});
await sleep(2200);
console.log('  говорим с:', talkId);
await sleep(1500);
// печатная машинка в headless (~0.5 FPS) почти не движется — пропускаем её
// кликом по блокеру (blocker pointerup → skipTyping в ui.js)
const skipTyping = async () => { await page.mouse.click(640, 60); await sleep(600); };
await skipTyping();
const screen1 = await dumpTexts('Village');
const hadAsk = await clickChoice('Спросить про вора');
ok(hadAsk, 'опция «Спросить про вора» сработала');
await skipTyping();
const screen2 = await dumpTexts('Village');
// ответ = самый длинный НОВЫЙ текст, появившийся после клика (реплика в кавычках)
const prevSet = new Set(screen1);
const newTexts = screen2.filter(t => !prevSet.has(t) && t.length > 40);
const answer = newTexts.sort((a, b) => b.length - a.length)[0] || null;
console.log('  ответ(экран2):', answer ? answer.slice(0, 80) : '(не найден)');
if (!answer) console.log('  новые тексты экрана2:', JSON.stringify(screen2.filter(t => !prevSet.has(t)).map(t => t.slice(0, 60))));
ok(!!answer, 'ответ о воре показан (экран 2)');
await page.screenshot({ path: `${OUT}/6626_ask.png` });
await clickChoice('(продолжить)');
await skipTyping();
await sleep(1500);
const screen3 = await dumpTexts('Village');
const repeatCount = answer ? screen3.filter(t => t === answer).length : -1;
console.log('  экран3, вхождений ответа:', repeatCount);
ok(repeatCount === 0, 'ответ НЕ повторяется вторым экраном (66.26)');
await page.screenshot({ path: `${OUT}/6626_result.png` });
// закрыть, если осталось открытым
await clickText('Понятно, спасибо.', true, 2500);
await clickText('Продолжить', true, 2000);
await clickText('Спасибо, я пойду.', true, 2000);
await sleep(800);

console.log('--- 5. Локация: уникальные точки (Выпас) ---');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    // выходим на околицу и открываем развилку напрямую
    s.scene.start('Fork');
});
await sleep(1800);
const forkButtons = await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    return { ok: !!s, keys: Object.keys(s).length };
});
console.log('  Fork активна:', JSON.stringify(forkButtons));
await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    // переходим на выпас программно (метод перехода может отличаться) — пробуем scene.start('Location', ...)
    s.scene.start('Location', { locationId: 'pasture' });
});
await sleep(2200);
const locNpcs = await page.evaluate(() => {
    const s = window.game.scene.getScene('Location');
    if (!s || !s.scene || !s.scene.isActive()) return null;
    const { width, height } = s.scale;
    const npcs = [];
    const walk = (obj) => {
        if (!obj) return;
        if (obj.list) { obj.list.forEach(walk); return; }
        if (obj.texture && obj.texture.key && String(obj.texture.key).startsWith('npc_') && obj.visible !== false) {
            npcs.push({ key: obj.texture.key, x: Math.round(obj.x), y: Math.round(obj.y) });
        }
    };
    s.children.list.forEach(walk);
    return { loc: s.locationId, npcs };
});
if (locNpcs) {
    console.log('  НПЦ на локации:', JSON.stringify(locNpcs.npcs));
    const seen2 = new Map();
    let dupLoc = 0;
    locNpcs.npcs.forEach(p => {
        const k = p.x + ',' + p.y;
        if (seen2.has(k)) dupLoc++;
        seen2.set(k, p.key);
    });
    ok(dupLoc === 0, `локация ${locNpcs.loc}: НПЦ не стоят в одной точке (совпадений: ${dupLoc})`);
    // разнос: минимум 60px между любыми двумя
    let minDist = Infinity;
    for (let i = 0; i < locNpcs.npcs.length; i++) for (let j = i + 1; j < locNpcs.npcs.length; j++) {
        const a = locNpcs.npcs[i], b = locNpcs.npcs[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < minDist) minDist = d;
    }
    ok(locNpcs.npcs.length < 2 || minDist >= 60, `локация: минимальный зазор между НПЦ ≥60px (${minDist === Infinity ? '—' : minDist.toFixed(0)})`);
    await page.screenshot({ path: `${OUT}/6626_pasture.png` });
} else {
    ok(false, 'локация не открылась (переход не сработал)');
}

console.log('--- Итог ---');
console.log('JS errors:', jsErrors);
console.log(fails.length ? `ПРОВАЛЕНО: ${fails.length}\n- ${fails.join('\n- ')}` : 'ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ');
await browser.close();
process.exit(fails.length || jsErrors ? 1 : 0);

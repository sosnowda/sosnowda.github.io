// Смоук 66.28: честные кнопки боя (Удар оружием/Удар кулаком/Стрельба из лука),
// панель «Смена оружия» (ход), колчан/пустой колчан поп-ап, трата стрелы,
// пачка стрел у кузнеца, колчан в меню персонажа, наводка стражника (п.14).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/smoke6628';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Framebuffer')) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4000);

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

const has = async (txt, sceneKey = null) => (await dumpTexts(sceneKey)).some(t => t.includes(txt));

console.log('--- 1. Старт: ВОИН (меч) ---');
await clickText('Новая игра');
await sleep(1500);
// выбираем преген воина: кликаем по тексту «Добрыня» (или первый пресет мышкой)
if (!await clickText('Добрыня', true, 6000)) {
    await clickText('Воин', false, 6000);
}
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
// контроль: у героя меч
const wId = await page.evaluate(() => window.game.scene.getScene('Village').registry.get('player').weaponId);
ok(wId === 'sword', `воин экипирован мечом (${wId})`);

console.log('--- 2. Бой с разбойником: кнопки по оружию в руках ---');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    s.scene.start('Combat', { enemyKeys: ['bandit'] });
});
await sleep(2500);
const combatBtns = await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    const out = [];
    const walk = (obj, ax, ay) => {
        if (!obj) return;
        const cx = ax + (obj.x || 0), cy = ay + (obj.y || 0);
        if (obj.list) { obj.list.forEach(c => walk(c, cx, cy)); return; }
        if (obj.text && obj.text.trim && obj.text.trim()) out.push({ t: obj.text.trim(), x: Math.round(cx), y: Math.round(cy) });
    };
    s.children.list.forEach(top => walk(top, 0, 0));
    return out.filter(b => /Уклон|Трава|Исследование|Смена|Бежать|Удар|Стрельба|В руках/.test(b.t));
});
const hasBtn = (frag) => combatBtns.some(b => b.t.includes(frag));
ok(hasBtn('Удар оружием'), 'п.1: кнопка «Удар оружием» (в руках меч)');
ok(hasBtn('Удар кулаком'), 'п.3: резерв «Удар кулаком»');
ok(hasBtn('Смена оружия'), 'п.4: кнопка «Смена оружия»');
ok(hasBtn('Стрельба из лука') === false, 'без лука кнопки «Стрельба из лука» нет');
ok(combatBtns.some(b => b.t.includes('В руках: Меч')), 'статусная строка: «В руках: Меч»');
const actionYs = [...new Set(combatBtns.filter(b => /Уклон|Трава|Исследование|Смена|Бежать|Удар/.test(b.t)).map(b => b.y))];
ok(actionYs.length === 1 && combatBtns.every(b => b.x > 0 && b.x < 1280),
    `на 1280 все боевые кнопки в одном ряду и внутри экрана (${actionYs.join(',')})`);
await page.screenshot({ path: `${OUT}/6628_combat_sword.png` });

console.log('--- 3. Смена оружия → кулаки: ход тратится ---');
await clickText('Смена оружия', false);
await sleep(800);
ok(await has('Смена оружия в руках — один ход'), 'панель смены оружия открыта');
ok(await has('Готово (без хода)'), 'в панели есть бесплатное закрытие');
await clickText('Кулаки (1-3+0)', false);
await sleep(1800);
const afterSwap = await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    return { weaponId: s.registry.get('player').weaponId, log: s.logLines.join(' | ') };
});
ok(afterSwap.weaponId === 'fists', 'кулаки экипированы из боя');
ok(afterSwap.log.includes('Потрачен ход'), 'в журнале боя: «Потрачен ход»');
await sleep(1500);
const enemyAnswered = await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    return s.logLines.join(' ').includes('Твой ход');
});
ok(enemyAnswered, 'противник ответил после смены оружия (ход потрачен)');

console.log('--- 4. Лук в руки: «Стрельба из лука», колчан, поп-ап пустого колчана ---');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    const p = s.registry.get('player');
    // выдаём лук в узел и экипируем, стрел в колчане нет
    p.inventory.push({ id: 'bow', name: 'Лук', count: 1, type: 'weapon' });
    p.weaponId = 'bow';
    p.weapon = { id: 'bow', name: 'Лук', skill: 'bow', dice: { min: 1, max: 6 }, bonus: 1 };
    p.quiver = 0;
    s.registry.set('player', p);
    s.createActions();
    s.updateGearStatus();
});
await sleep(800);
ok(await has('Стрельба из лука', 'Combat'), 'п.2: кнопка «Стрельба из лука» при луке в руках');
await clickText('Стрельба из лука', false);
await sleep(1000);
ok(await has('Колчан пуст!'), 'п.8: поп-ап предупреждения о пустом колчане');
ok(await has('Пачку стрел (10 шт.) продают кузнец Данила и ремесленник Аверьян'), 'в поп-апе — где купить стрелы');
await page.screenshot({ path: `${OUT}/6628_empty_quiver.png` });
const busyState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    return { busy: s.busy, quiver: s.registry.get('player').quiver || 0 };
});
ok(busyState.busy === false && busyState.quiver === 0, 'выстрела не было: ход НЕ потрачен, колчан 0');
await clickText('Понятно');
await sleep(600);

console.log('--- 5. Наложение стрел в колчан (ход) и выстрел тратит стрелу ---');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    const p = s.registry.get('player');
    p.inventory.push({ id: 'arrows', name: 'Стрелы', count: 10, type: 'ammo', emoji: '🪶' });
    s.registry.set('player', p);
});
await clickText('Смена оружия', false);
await sleep(800);
ok(await has('В узле: 10'), 'в панели видно стрелы в узле');
await clickText('Наложить стрелы в колчан (ход)', false);
await sleep(1800);
const afterLoad = await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    return { quiver: s.registry.get('player').quiver, inv: (s.registry.get('player').inventory.filter(i => i.id === 'arrows').reduce((a, i) => a + i.count, 0)), log: s.logLines.join(' | ') };
});
ok(afterLoad.quiver === 10, `колчан наложен: 10 (${afterLoad.quiver})`);
ok(afterLoad.inv === 0, 'узел со стрелами пуст');
ok(afterLoad.log.includes('наложил стрелы в колчан'), 'журнал: наложение стрел за ход');
await sleep(1200);
// выстрел: колчан 10 → 9
await clickText('Стрельба из лука', false);
await sleep(2500);
const afterShot = await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    return { quiver: s.registry.get('player').quiver || 0, log: s.logLines.join(' | ') };
});
ok(afterShot.quiver === 9, `выстрел потратил стрелу: колчан 9 (${afterShot.quiver})`);
ok(afterShot.log.includes('Лук') && (afterShot.log.includes('попадание') || afterShot.log.includes('промах') || afterShot.log.includes('уклонился')), 'результат выстрела в журнале боя');
await page.screenshot({ path: `${OUT}/6628_bow_shot.png` });

console.log('--- 6. Кузница: пачка стрел (10 шт.) в продаже ---');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Combat');
    // выходим из боя в деревню (без честного боя — прямым стартом сцены)
    s.scene.stop('Combat');
    window.game.scene.start('Village');
});
await sleep(2000);
await page.evaluate(() => {
    window.game.scene.stop('Village');
    window.game.scene.start('Interior', { interiorId: 'blacksmith', from: 'Village' });
});
await sleep(2500);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    if (s && s.showBlacksmithShop) s.showBlacksmithShop('weapon');
});
await sleep(1000);
ok(await has('Пачка стрел (10 шт.) — 5'), 'у кузнеца: «Пачка стрел (10 шт.) — 5 д.»');
ok(await has('Стрелы — пачками по 10'), 'подсказка кузницы про пачки по 10');
const dengasBefore = await page.evaluate(() => window.game.scene.getScene('Interior').registry.get('player').dengas);
await clickText('Пачка стрел (10 шт.) — 5', false);
await sleep(1200);
const buy = await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    const p = s.registry.get('player');
    return { dengas: p.dengas, inv: (p.inventory.filter(i => i.id === 'arrows').reduce((a, i) => a + i.count, 0)) };
});
ok(buy.dengas === dengasBefore - 5, `списано 5 д. (${dengasBefore}→${buy.dengas})`);
ok(buy.inv === 10, `пачка легла в узел: 10 стрел (${buy.inv})`);
await clickText('Закрыть');
await sleep(600);

console.log('--- 7. Персонаж: колчан отдельным слотом ---');
await page.evaluate(() => {
    window.game.scene.stop('Interior');
    window.game.scene.start('Character', { from: 'Village', tab: 'inventory' });
});
await sleep(2000);
const charTexts = await dumpTexts('Character');
ok(charTexts.some(t => t.includes('Колчан') && t.includes('/10')), 'карточка «Колчан: N/10» в снаряжении (п.6)');
ok(charTexts.some(t => t.includes('×10')) && charTexts.some(t => t.includes('Стрелы')),
    'стрелы в узле — отдельный слот ×10 (п.11)');
ok(charTexts.some(t => t.includes('В руках') && t.includes('Лук')), 'экипировка: лук в руках');
await page.screenshot({ path: `${OUT}/6628_character_quiver.png` });
// клик по СЛОТУ колчана в сетке (третья ячейка снаряжения — зона 64×64 №3)
await page.evaluate(() => {
    const s = window.game.scene.getScene('Character');
    const zones = s.children.list.filter(z => z.type === 'Zone' && z.width === 64 && z.height === 64 && z.input && z.input.enabled);
    window.__quiverZone = zones[2] ? { x: Math.round(zones[2].x), y: Math.round(zones[2].y) } : null;
});
const qz = await page.evaluate(() => window.__quiverZone);
ok(!!qz, `третья ячейка-зона сетки найдена (${qz && qz.x},${qz && qz.y})`);
if (qz) { await page.mouse.click(qz.x, qz.y); await sleep(800); }
ok(await has('⤓ Высыпать стрелы в узел', 'Character'), 'карточка колчана открыта кликом по слоту');
await clickText('⤓ Высыпать стрелы в узел', false);
await sleep(1200);
const quiverState = await page.evaluate(() => {
    const p = window.game.scene.getScene('Character').registry.get('player');
    return { quiver: p.quiver || 0, inv: p.inventory.filter(i => i.id === 'arrows').reduce((a, i) => a + i.count, 0) };
});
ok(quiverState.quiver === 0 && quiverState.inv >= 10, `высыпал стрелы в узел (колчан ${quiverState.quiver}, в узле ${quiverState.inv})`);
// карточка СТРЕЛ узла — наложение обратно (прямой вызов карточки,
// сам слот кликается так же, как съестное — паттерн foodDef)
const loadedBack = await page.evaluate(() => {
    const s = window.game.scene.getScene('Character');
    const p = s.registry.get('player');
    const it = p.inventory.find(i => i.id === 'arrows');
    if (!it) return null;
    s.showArrowsCard(it);
    return p.quiver || 0;
});
await sleep(800);
ok(loadedBack === 0, 'карточка стрел узла открыта');
await clickText('Наложить стрелы в колчан', false);
await sleep(1000);
const quiverAfterLoad = await page.evaluate(() => window.game.scene.getScene('Character').registry.get('player').quiver);
ok(quiverAfterLoad === 10, `колчан снова 10/10 (${quiverAfterLoad})`);

console.log('--- 8. Стражник: наводка на вора (п.14), не нападает (п.15) ---');
await page.evaluate(() => {
    window.game.scene.stop('Character');
    const v = window.game.scene.getScene('Village');
    window.game.scene.start('Village');
    const reg = window.game.registry;
    // вор «сидит» на Ржаном поле, следующий шаг — Святого озера
    const q = reg.get('quest') || {};
    q.chase = {
        route: ['field', 'lake', 'river'], phase: 'stay', stop: 0,
        ticksLeft: 5, stays: [5, 5, 5], minutesAccum: 0, traces: {}, gender: 'male',
    };
    q.thiefEscaped = false; q.thiefDefeated = null;
    reg.set('quest', q);
    // 07:00 — пахарь на поле, стражник обходит пашню: одна локация с ворам
    const gt = reg.get('gameTime');
    gt.day = 10; gt.hour = 7; gt.minute = 0;
    reg.set('gameTime', gt);
});
await sleep(1200);
await page.evaluate(() => {
    // тик погони: внутри вызывается refreshGuardThiefTip
    const s = window.game.scene.getScene('Village');
    s.registry.get('chaseTickHook')(s.registry, 60);
});
await sleep(600);
const tipState = await page.evaluate(() => {
    const q = window.game.registry.get('quest');
    return q.guardThiefTip || null;
});
ok(!!tipState && tipState.fromLocId === 'field' && tipState.nextLocId === 'lake',
    'стражник на пашне с ворам — наводка field→lake получена');
// 15:30 — стражник всё ещё на пашне (noon): наводка освежается;
// 17:00 — он уже патрулирует деревню и может поделиться свежей наводкой
await page.evaluate(() => {
    const reg = window.game.registry;
    const gt = reg.get('gameTime');
    gt.hour = 15; gt.minute = 30;
    reg.set('gameTime', gt);
    const s = window.game.scene.getScene('Village');
    s.registry.get('chaseTickHook')(s.registry, 60);
});
await sleep(600);
await page.evaluate(() => {
    const reg = window.game.registry;
    const gt = reg.get('gameTime');
    gt.hour = 17; gt.minute = 0;
    reg.set('gameTime', gt);
});
await sleep(2500);
const guardOnStreet = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    return (s.streetNpcs || []).some(n => n.id === 'guard');
});
ok(guardOnStreet, 'вечером стражник патрулирует деревню (виден на улице)');
if (guardOnStreet) {
    // ставим героя рядом со стражником и открываем беседу (💬 Поговорить)
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const guard = (s.streetNpcs || []).find(n => n.id === 'guard');
        s.playerObj.x = guard.spr.x - 40;
        s.playerObj.y = guard.spr.y;
    });
    await sleep(400);
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const guard = (s.streetNpcs || []).find(n => n.id === 'guard');
        const cam = s.cameras.main;
        window.__guardPos = { x: Math.round(guard.spr.x - (cam.scrollX || 0)), y: Math.round(guard.spr.y - (cam.scrollY || 0)) };
    });
    const gp = await page.evaluate(() => window.__guardPos);
    await page.mouse.click(gp.x, gp.y);
    await sleep(900);
    await clickText('💬 Поговорить', false, 4000);
    await sleep(900);
    await clickText('Спросить про вора', false);
    await sleep(1000);
    const tipLine = await has('видел тут вора');
    ok(tipLine, 'п.14: стражник рассказал: «только что видел тут вора…»');
    const lineTexts = await dumpTexts();
    ok(lineTexts.some(t => t.includes('видел тут вора') && (t.includes('Ржаного поля') || t.includes('Святому озеру'))),
        'в наводке названы обе локации (где видел → куда убежал)');
    await page.screenshot({ path: `${OUT}/6628_guard_tip.png` });
    const fightStarted = await page.evaluate(() => !!window.game.scene.getScene('Combat') && window.game.scene.getScene('Combat').scene.isActive());
    ok(!fightStarted, 'п.15: стражник НЕ нападает на вора — боя нет');
}

console.log('--- 9. Мобильный бой: кнопки помещаются (портрет 390×844) ---');
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
mob.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('MOB PAGEERROR:', String(e).slice(0, 160)); });
await mob.goto(BASE + '/game/', { waitUntil: 'load' });
await mob.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4000);
// честный старт: новая игра → воин → в бой
const clickMob = async (txt) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
        const pos = await mob.evaluate((txt) => {
            const g = window.game;
            for (const s of g.scene.scenes) {
                if (!s || !s.scene || !s.scene.isActive()) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                    if (obj.text && obj.text.trim && obj.text.trim().includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) {
                        const cam = s.cameras ? s.cameras.main : null;
                        return { x: Math.round((r.x - (cam ? cam.scrollX || 0 : 0))), y: Math.round((r.y - (cam ? cam.scrollY || 0 : 0))) };
                    }
                }
            }
            return null;
        }, txt);
        if (pos && pos.x > 0 && pos.y > 0) { await mob.mouse.click(pos.x, pos.y); await sleep(500); return true; }
        await sleep(250);
    }
    return false;
};
// детерминированный старт боя на телефоне (раскладка кнопок — цель шага;
// полный игровой флоу уже проверен на десктопе выше)
await mob.evaluate(() => {
    const reg = window.game.registry;
    const p = Object.assign(reg.get('player') || {}, {
        name: 'Добрыня', archetype: 'Воин', gender: 'male', age: 25,
        weaponId: 'sword', weapon: { id: 'sword', name: 'Меч', skill: 'sword', dice: { min: 1, max: 8 }, bonus: 1 },
        armorId: 'chain', armor: { id: 'chain', name: 'Кольчуга', def: 4 },
        skills: { sword: 80, brawl: 75, dodge: 55, bow: 35 },
        STR: 80, CON: 75, SIZ: 70, DEX: 55, INT: 40, POW: 50, CHA: 35, APP: 50,
        HP: 14, HPmax: 14, MP: 10, MPmax: 10, DB: { text: '+1d4', min: 1, max: 4 },
        dengas: 15, inventory: [], quiver: 0,
    });
    reg.set('player', p);
    window.game.scene.stop('Title');
    window.game.scene.start('Combat', { enemyKeys: ['bandit'] });
});
await mob.waitForFunction(() => {
    const c = window.game.scene.getScene('Combat');
    return c && c.scene.isActive() && c.children && c.children.list.length > 10;
}, { timeout: 20000 });
await sleep(1200);
const mobBtns = await mob.evaluate(() => {
    const g = window.game;
    const s = g.scene.getScene('Combat');
    const out = [];
    const walk = (obj, ax, ay) => {
        if (!obj) return;
        const cx = ax + (obj.x || 0), cy = ay + (obj.y || 0);
        if (obj.list) { obj.list.forEach(c => walk(c, cx, cy)); return; }
        if (obj.text && obj.text.trim && /Уклон|Трава|Исследование|Смена|Бежать|Удар|Стрельба/.test(obj.text.trim())) {
            out.push({ t: obj.text.trim().slice(0, 22), x: Math.round(cx), y: Math.round(cy) });
        }
    };
    s.children.list.forEach(top => walk(top, 0, 0));
    return { w: g.scale.gameSize.width, h: g.scale.gameSize.height, btns: out };
});
const allInside = mobBtns.btns.every(b => b.y < mobBtns.h - 4 && b.x > 20 && b.x < mobBtns.w - 20);
const mobRows = new Set(mobBtns.btns.map(b => Math.round(b.y / 10) * 10));
ok(mobBtns.btns.length >= 6, `на телефоне все боевые кнопки на месте (${mobBtns.btns.length})`);
ok(allInside, 'все кнопки внутри экрана 390×844 и не слиплись в угол');
ok(mobRows.size >= 2, `кнопки раскладываются в ${mobRows.size} ряда`);
await mob.screenshot({ path: `${OUT}/6628_mobile_combat.png` });

console.log('--- Итог ---');
console.log(`JS-ошибок: ${jsErrors}`);
ok(jsErrors === 0, '0 JS-ошибок за весь смоук');
await browser.close();
if (fails.length) { console.log('ПРОВАЛЫ:', fails.join(' ; ')); process.exit(1); }
console.log('SMOKE 66.28: ВСЁ ЗЕЛЁНОЕ');

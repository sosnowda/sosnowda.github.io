// qa_battle_thief_6642.mjs — ЖИВОЙ QA патча 66.42, приказ 1 владельца:
// «проверить модели игрока и вора в бою».
// 5 пресетов героя (Добрыня/Гаврила/Милуша/Рогнеда/Ярополк) × бой с вором;
// пол вора чередуется (m/f — оба листа enemy_thief_m/f).
// Проверки: боевая текстура игрока (через менеджер текстур — дети ненадёжны,
// см. АГЕНТ.md), лист вора по полу, анимации idle обеих сторон, кадры idle/атаки.
// Деревня глотается (swallowVillage, обход средового OOM — battle_shots_6633).
// Запуск: node game/tools/qa_battle_thief_6642.mjs (сервер на :8765)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/qa6642battle';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };
const FLAGS = ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'];

async function newPage(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Framebuffer')) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene.getScene('Title') && window.game.scene.getScene('Title').scene.isActive(), { timeout: 60000, polling: 200 });
    await sleep(700);
    return page;
}

async function clickText(pg, txt, exact = true, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await pg.evaluate(({ txt, exact }) => {
            const g = window.game; if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                    if (obj.text && obj.text.trim) { const tt = obj.text.trim(); if ((exact ? tt === txt : tt.includes(txt))) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) }; }
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) { const cam = s.cameras ? s.cameras.main : null; const zoom = cam ? (cam.zoom || 1) : 1;
                        return { x: Math.round((r.x - (cam ? (cam.scrollX || 0) : 0)) / zoom), y: Math.round((r.y - (cam ? (cam.scrollY || 0) : 0)) / zoom) }; }
                }
            } return null;
        }, { txt, exact });
        if (pos && pos.x > 0 && pos.y > 0) { await pg.mouse.click(pos.x, pos.y); await sleep(350); return true; }
        await sleep(250);
    }
    return false;
}

async function swallowVillage(pg) {
    await pg.evaluate(() => {
        const SM = Phaser.Scenes.SceneManager.prototype;
        if (!SM.__swallow6642) {
            SM.__swallow6642 = true;
            const orig = SM.start;
            SM.start = function (key, data) {
                if (key === 'Village') return;
                return orig.call(this, key, data);
            };
        }
    });
}

const RUNS = [
    { preset: 'Добрыня', look: 'baenor', gender: 'male' },
    { preset: 'Гаврила', look: 'gaerron', gender: 'female' },
    { preset: 'Милуша', look: 'naia', gender: 'male' },
    { preset: 'Рогнеда', look: 'huntress', gender: 'female' },
    { preset: 'Ярополк', look: 'paul', gender: 'male' },
];

let idx = 0;
for (const run of RUNS) {
    idx++;
    console.log(`=== Прогон ${idx}: ${run.preset} vs вор (${run.gender === 'female' ? 'воровка' : 'вор'}) ===`);
    const browser = await chromium.launch({ headless: true, args: FLAGS });
    let page = null;
    for (let attempt = 1; attempt <= 2 && !page; attempt++) {
        try {
            page = await newPage(browser);
        } catch (e) {
            console.log(`  попытка ${attempt} не поднялась: ${String(e).slice(0, 120)}`);
            if (page) { await page.close().catch(() => {}); page = null; }
            await sleep(1500);
        }
    }
    if (!page) { fails.push(`${run.preset}: страница не поднялась`); await browser.close(); continue; }

    await swallowVillage(page);
    await clickText(page, 'Новая игра');
    await sleep(1000);
    await clickText(page, run.preset, false, 8000);
    await sleep(600);
    await clickText(page, 'Начать игру', true, 8000);
    await sleep(1500);

    // пол вора — в реестр ДО старта боя (getThiefGender читает quest.chase.gender)
    await page.evaluate((g) => {
        const reg = window.game.registry;
        reg.set('quest', Object.assign({}, reg.get('quest') || {}, { chase: { gender: g } }));
    }, run.gender);

    // бой с вором напрямую (деревня проглочена — поднимаем из CharacterSelection)
    await page.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        cs.scene.start('Combat', { enemyKeys: ['thief'] });
    });
    await sleep(1800);

    const st = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        if (!c || !c.scene.isActive()) return { active: false };
        const tm = window.game.textures;
        const am = window.game.anims;
        const enemies = (c.enemies || []).map(e => ({
            key: e.spriteKey, name: e.name, hp: e.HP, isThief: !!e.isThief,
            texExists: tm.exists(e.spriteKey),
            idleLeft: am.exists(`${e.spriteKey}_idle_left`),
            sheetW: tm.exists(e.spriteKey) ? tm.get(e.spriteKey).getSourceImage().width : 0,
            sheetH: tm.exists(e.spriteKey) ? tm.get(e.spriteKey).getSourceImage().height : 0,
        }));
        // боевая текстура игрока: battle_<look>_* лист или hero_*
        const look = c.player && c.player.battleLookKey ? c.player.battleLookKey : (c.playerLook || null);
        const playerSprites = c.children.list
            .filter(o => o.texture && /battle_|hero_|player_composite/.test(o.texture.key))
            .map(o => ({ key: o.texture.key, x: Math.round(o.x), y: Math.round(o.y), frame: o.frame ? o.frame.name : null }));
        return {
            active: true,
            enemies,
            look,
            playerSprites,
            playerAnims: ['attack1', 'attack2', 'shoot', 'idle'].map(a => `${look ? 'battle_' + look + '_' + a : a}`).filter(a => am.exists(a)),
        };
    });

    ok(st && st.active, `${run.preset}: бой активен`);
    if (st && st.active) {
        const thief = st.enemies[0];
        ok(thief && thief.isThief, `  враг — вор (isThief) [${thief && thief.name}]`);
        ok(thief && thief.texExists, `  текстура вора существует [${thief && thief.key}]`);
        ok(thief && thief.key === (run.gender === 'female' ? 'enemy_thief_f' : 'enemy_thief_m'),
            `  лист вора по полу: ${thief && thief.key} (ожидался ${run.gender === 'female' ? 'enemy_thief_f' : 'enemy_thief_m'})`);
        ok(thief && thief.sheetW === 256 && thief.sheetH === 256, `  лист вора 256×256 4×4@64 [${thief && thief.sheetW}×${thief && thief.sheetH}]`);
        ok(thief && thief.idleLeft, `  анимация ${thief && thief.key}_idle_left существует`);
        ok(st.playerSprites.length > 0, `  боевая модель игрока на сцене: ${st.playerSprites.map(s => s.key).join(', ') || 'НЕТ'}`);
        const expectedLook = run.look;
        ok(st.playerSprites.some(s => s.key.includes('battle_' + expectedLook)) || (st.look === expectedLook),
            `  боевой облик = ${expectedLook} [look=${st.look}]`);
        ok(st.playerAnims.length > 0, `  боевые анимации игрока: ${st.playerAnims.join(', ')}`);

        await page.screenshot({ path: `${OUT}/${idx}_${run.preset}_idle_${run.gender === 'female' ? 'f' : 'm'}.png` });

        // удар: ищем кнопку атаки ПО ПОДСТРОКЕ (на кнопках эмодзи-префикс:
        // «⚔ Удар оружием» / «🏹 Стрельба из лука» / «🤜 Удар кулаком»)
        const attackBtn = await clickText(page, 'Удар оружием', false, 2500)
            ? 'Удар оружием'
            : (await clickText(page, 'Стрельба из лука', false, 2500) ? 'Стрельба из лука'
                : (await clickText(page, 'Удар кулаком', false, 2500) ? 'Удар кулаком' : null));
        if (attackBtn) {
            await sleep(320); // середина взмаха
            await page.screenshot({ path: `${OUT}/${idx}_${run.preset}_attack.png` });
            ok(true, `  атака («${attackBtn}») выполнена, кадр снят`);
            // ждём ответный ход вора — снимем и его атаку/стойку после хода
            await sleep(1500);
        } else {
            ok(false, '  кнопка атаки не найдена');
        }
    }
    await page.close().catch(() => {});
    await browser.close();
}

console.log(jsErrors === 0 ? '0 JS-ошибок' : `JS-ОШИБКИ: ${jsErrors}`);
console.log(fails.length === 0 ? 'ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ' : `ПРОВАЛЫ: ${fails.length}\n` + fails.map(f => '  - ' + f).join('\n'));
process.exit(fails.length === 0 && jsErrors === 0 ? 0 : 1);

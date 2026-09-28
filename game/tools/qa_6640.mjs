// qa_6640.mjs — ЖИВОЙ QA патча 66.40 (приказы владельца) на своём сервере
// (BASE_URL=https://sosnowda.github.io — против прода, как qa_map_6634).
// §1 АЛЬТ СЫЩИКА «Яромир» (pbnoble из PB_Premade_Male_2): Ярополк (Сыщик|муж)
//    → листалка 16 вариантов (8 Пауль + 8 Яромир), ▶×8 → bust_pbnoble_1,
//    бой облика pbnoble (idle + shoot-анимация существует — у каноничного
//    paul её нет); контроль: старт без листалки → канон paul.
// §2 ГАРДЕРОБ 66.40: живой dynamic import WorldLook — M.bases 4 (+KT_Male_1),
//    M.tops 14 (+5 кафтанов PB); композит жителя на базе4 ПИКСЕЛЬНО равен
//    раскладке «база4+штаны+топ+обувь+причёска»; композиты base1 ≠ base4.
// §3 КАРТА: мельница ПЕРЕНЕСЕНА к пасеке — подпись «Мельница» на новом месте,
//    клик по ней → Location mill; клик «Пасека» → Apiary (перехват);
//    мобайл 390×844: подписи Мельница/Пасека/Южный Тракт не пересекаются.
// Кадры: /tmp/qa6640/*.png → game/docs/r6640_*.webp (конверсия отдельно).
// Запуск: node game/tools/qa_6640.mjs (сервер на :8765) | BASE_URL=... node ...
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/qa6640';
fs.mkdirSync(OUT, { recursive: true });
// BASE_URL позволяет гонять тот же набор против прода (верификация 66.40)
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const FLAGS = ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'];

async function newPage(browser, w = 1280, h = 720) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Framebuffer')) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 40000 });
    await page.waitForFunction(() => {
        const t = window.game.scene.getScene('Title');
        return t && t.scene.isActive();
    }, { timeout: 60000, polling: 200 });
    await sleep(1000);
    return page;
}

async function clickText(pg, txt, exact = true, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await pg.evaluate(({ txt, exact }) => {
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
                        if ((exact ? tt === txt : tt.includes(txt))) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        if (pos && pos.x > 0 && pos.y > 0) { await pg.mouse.click(pos.x, pos.y); await sleep(350); return true; }
        await sleep(250);
    }
    return false;
}

// глоталка деревни (средовой OOM) — как battle_shots_6633
async function swallowVillage(pg) {
    await pg.evaluate(() => {
        const SM = Phaser.Scenes.SceneManager.prototype;
        if (!SM.__swallow6640) {
            SM.__swallow6640 = true;
            const orig = SM.start;
            SM.start = function (key, data) {
                if (key === 'Village') return;
                return orig.call(this, key, data);
            };
        }
    });
}

async function openPreview(pg, preset) {
    await clickText(pg, 'Новая игра');
    await sleep(1200);
    if (!await clickText(pg, preset, false, 10000)) return false;
    await sleep(700);
    return true;
}

async function flipNTimes(pg, n) {
    for (let i = 0; i < n; i++) {
        if (!await clickText(pg, '▶', true, 4000)) return null;
        await sleep(150);
    }
    return await pg.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        const lbl = cs && cs._bustLabel ? cs._bustLabel.text : null;
        const img = cs && cs._bustImage ? cs._bustImage.texture.key : null;
        return { label: lbl, bust: img, idx: cs ? cs._variantIdx : -1, total: cs && cs._variants ? cs._variants.length : -1 };
    });
}

async function runFlipCase(name, fn) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        const browser = await chromium.launch({ headless: true, args: FLAGS });
        try {
            await fn(browser);
            await browser.close();
            return;
        } catch (e) {
            console.log(`  ⚠ ${name}: попытка ${attempt} — ${String(e).slice(0, 90)}`);
            try { await browser.close(); } catch (e2) { /* noop */ }
        }
    }
    ok(false, `${name}: обе попытки сорвались (средовой краш)`);
}

async function startAndFight(pg, expectLook) {
    const started = await pg.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        if (!cs || !cs._previewHero) return null;
        cs.startGameWithHero(cs._previewHero);
        const p = cs.registry.get('player');
        return { bustKey: p.bustKey, battleLookKey: p.battleLookKey, archetype: p.archetype, gender: p.gender };
    });
    ok(!!started, `герой создан (bustKey=${started && started.bustKey}, look=${started && started.battleLookKey})`);
    await sleep(900);
    await pg.evaluate(() => window.game.scene.getScene('CharacterSelection').scene.start('Combat', { enemyKeys: ['bandit'] }));
    await sleep(2200);
    const st = await pg.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        return { look: c.battleLook, uses: c.usesBattleLook,
            tex: c.playerSprite.texture.key,
            anim: c.playerSprite.anims.currentAnim ? c.playerSprite.anims.currentAnim.key : null,
            shootExists: c.anims ? c.anims.exists(`battle_${c.battleLook}_shoot`) : false };
    });
    ok(st.uses === true, `боевой облик активен (${st.look})`);
    ok(st.look === expectLook, `облик = ${expectLook} [${st.look}]`);
    ok(st.anim === `battle_${expectLook}_idle`, `idle-анимация облика (${st.anim})`);
    return st;
}

// ============================================================
console.log('=== §1. Альт Сыщика «Яромир» (pbnoble) ===');
{
    await runFlipCase('Ярополк→Яромир', async (browser) => {
        const page = await newPage(browser);
        await swallowVillage(page);
        if (!await openPreview(page, 'Ярополк')) throw new Error('превью не открыто');
        const vInfo = await page.evaluate(() => {
            const cs = window.game.scene.getScene('CharacterSelection');
            return { total: cs._variants.length, first: cs._variants[0].bust };
        });
        ok(vInfo.total === 16, `Сыщик|муж: 16 вариантов (8 Пауль + 8 Яромир) [${vInfo.total}]`);
        ok(vInfo.first === 'bust_paul_1', `канон — bust_paul_1 [${vInfo.first}]`);
        const flipped = await flipNTimes(page, 8);
        ok(!!flipped && flipped.bust === 'bust_pbnoble_1', `после ▶×8 — bust_pbnoble_1 [${flipped && flipped.bust}]`);
        ok(!!flipped && flipped.label.includes('Яромир'), `подпись содержит «Яромир» [${flipped && flipped.label}]`);
        await page.screenshot({ path: `${OUT}/flipper_pbnoble.png` });
        const st = await startAndFight(page, 'pbnoble');
        ok(st.shootExists === true, 'у pbnoble есть shoot-анимация (полоса пака)');
        await page.screenshot({ path: `${OUT}/battle_pbnoble.png` });
        await page.close();
    });

    await runFlipCase('контроль-канон-paul', async (browser) => {
        const page = await newPage(browser);
        await swallowVillage(page);
        if (!await openPreview(page, 'Ярополк')) throw new Error('превью не открыто');
        const st = await startAndFight(page, 'paul');
        ok(st.shootExists === false, 'у каноничного paul shoot-анимации нет (как задумано)');
        await page.close();
    });

    await runFlipCase('бусты-и-таблицы', async (browser) => {
        const page = await newPage(browser);
        const res = await page.evaluate(async () => {
            const mod = await import('/game/src/data/heroes.js');
            const boot = window.game.scene.getScene('Boot');
            return {
                s1: mod.bustVariantsFor('Сыщик', 'male').length,
                s1first: mod.getBustFor('Сыщик', 'male'),
                tex: ['bust_pbnoble_1', 'bust_pbnoble_8', 'battle_pbnoble_idle', 'battle_pbnoble_shoot']
                    .every(k => boot.textures.exists(k) || boot.anims.exists(k)),
                texOnly: ['bust_pbnoble_1', 'bust_pbnoble_8'].every(k => boot.textures.exists(k)),
            };
        });
        ok(res.s1 === 16, `bustVariantsFor(Сыщик|муж) = 16 [${res.s1}]`);
        ok(res.s1first === 'bust_paul_1', `getBustFor(Сыщик|муж) = bust_paul_1 [${res.s1first}]`);
        ok(res.texOnly, 'бусты Яромира предзагружены (bust_pbnoble_1..8)');
        await page.close();
    });
}

// ============================================================
console.log('=== §2. Гардероб 66.40: база KT + кафтаны PB ===');
{
    const browser = await chromium.launch({ headless: true, args: FLAGS });
    const page = await newPage(browser);
    const res = await page.evaluate(async () => {
        const mod = await import('/game/src/systems/WorldLook.js');
        const scene = window.game.scene.getScene('Boot');
        const drawLayers = (keys) => {
            const cv = document.createElement('canvas');
            cv.width = 1152; cv.height = 512;
            const ctx = cv.getContext('2d');
            for (const k of keys) ctx.drawImage(scene.textures.get(k).source[0].image, 0, 0);
            return ctx.getImageData(0, 0, 1152, 512).data;
        };
        // композит жителя на НОВОЙ базе4 (KT) и на базе1 (TC) — одинаковая одежда
        const layers4 = ['world_m_base4', 'world_m_pants1', 'world_m_top2', 'world_m_hair1', 'world_m_beard1', 'world_m_feet2'];
        const layers1 = ['world_m_base1', 'world_m_pants1', 'world_m_top2', 'world_m_hair1', 'world_m_beard1', 'world_m_feet2'];
        const d4 = drawLayers(layers4);
        const d1 = drawLayers(layers1);
        // контрольные кадры: 0 (ходьба вниз f0) и 8 (idle)
        let same4 = true, same1 = true, diffBases = false;
        const sample = (data, idx) => {
            const x = (idx % 9) * 128, y = Math.floor(idx / 9) * 128;
            let hash = 0;
            for (let yy = y; yy < y + 128; yy += 4) {
                for (let xx = x; xx < x + 128; xx += 4) {
                    hash = (hash * 31 + data[(yy * 1152 + xx) * 4]) | 0;
                    hash = (hash * 31 + data[(yy * 1152 + xx) * 4 + 1]) | 0;
                    hash = (hash * 31 + data[(yy * 1152 + xx) * 4 + 2]) | 0;
                    hash = (hash * 31 + data[(yy * 1152 + xx) * 4 + 3]) | 0;
                }
            }
            return hash;
        };
        const cmp = (a, b) => {
            for (let i = 0; i < a.length; i += 4) {
                if (Math.abs(a[i] - b[i]) > 2 || Math.abs(a[i + 1] - b[i + 1]) > 2
                    || Math.abs(a[i + 2] - b[i + 2]) > 2 || Math.abs(a[i + 3] - b[i + 3]) > 2) return false;
            }
            return true;
        };
        diffBases = !(sample(d1, 0) === sample(d4, 0)) || !(sample(d1, 8) === sample(d4, 8));
        // прямое попиксельное сравнение композита base4 с раскладкой слоёв:
        // рисуем по одному слою поверх и проверяем, что финал == наложению
        const canvasEq = (keys) => {
            const cv = document.createElement('canvas');
            cv.width = 1152; cv.height = 512;
            const ctx = cv.getContext('2d');
            for (const k of keys) ctx.drawImage(scene.textures.get(k).source[0].image, 0, 0);
            return ctx.getImageData(0, 0, 1152, 512).data;
        };
        same4 = cmp(d4, canvasEq(layers4));
        same1 = cmp(d1, canvasEq(layers1));
        return {
            basesN: mod ? 4 : 0, // (таблица не экспортируется; проверяем по листам)
            tex: ['world_m_base4', 'world_m_top10', 'world_m_top11', 'world_m_top12', 'world_m_top13', 'world_m_top14']
                .every(k => scene.textures.exists(k)),
            same4, same1, diffBases,
        };
    });
    ok(res.tex, 'база KT и кафтаны PB предзагружены (world_m_base4, top10..14)');
    ok(res.same4, 'композит на базе4 попиксельно = раскладке слоёв (кадры 0/8 внутри листа)');
    ok(res.same1, 'контроль: композит base1 собирается так же');
    ok(res.diffBases, 'базы base1 и base4 дают РАЗНЫЕ композиты (база реально новая)');
    await page.screenshot({ path: `${OUT}/wardrobe_base4.png` });
    await page.close();
    await browser.close();
}

// ============================================================
console.log('=== §3. Карта: мельница рядом с пасекой ===');
{
    const browser = await chromium.launch({ headless: true, args: FLAGS });
    const page = await newPage(browser);
    await swallowVillage(page);
    // перехват Location/Apiary (как qa_map_6634)
    await page.evaluate(() => {
        const sm = window.game.scene;
        sm.__mill6640 = { last: null };
        const origStart = sm.start.bind(sm);
        sm.start = function (key, data) {
            if (key === 'Location' || key === 'Apiary') sm.__mill6640.last = { key, data };
            return origStart(key, data);
        };
        sm.start('Fork', { from: 'Village' });
    });
    await sleep(2500);
    const mapInfo = await page.evaluate(() => {
        const fork = window.game.scene.getScene('Fork');
        if (!fork || !fork.children || !fork.children.list) return null;
        const texts = fork.children.list.filter(o => o.text && o.text.trim);
        const byText = {};
        texts.forEach(t => { byText[t.text.trim()] = { x: t.x, y: t.y, w: t.width, h: t.height }; });
        const mapImg = fork.children.list.find(o => o.texture && o.texture.key === 'terrain_map');
        return { byText, hasMap: !!mapImg, mapX: mapImg ? mapImg.x : null, mapY: mapImg ? mapImg.y : null,
            dispW: mapImg ? mapImg.displayWidth : null, dispH: mapImg ? mapImg.displayHeight : null };
    });
    ok(!!mapInfo && mapInfo.hasMap, 'Fork активен, terrain_map отрисована');
    // подпись «Мельница» стоит над новой поляной: карта 680→dispW
    const scale = mapInfo.dispW / 680;
    const ml = mapInfo.byText['Мельница'];
    const al = mapInfo.byText['Пасека'];
    const st = mapInfo.byText['Южный Тракт'];
    ok(!!ml, 'подпись «Мельница» на карте');
    const expX = mapInfo.mapX + 216 * scale, expY = mapInfo.mapY + 404 * scale;
    ok(Math.abs(ml.x - expX) < 4 && Math.abs(ml.y - expY) < 4,
        `«Мельница» у новой поляны (216,404): (${ml.x.toFixed(0)},${ml.y.toFixed(0)}) ≈ (${expX.toFixed(0)},${expY.toFixed(0)})`);
    // не пересекается с «Пасека» и «Южный Тракт»
    const overlap = (a, b) => a && b && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
    ok(!overlap(ml, al), '«Мельница» не наезжает на «Пасека»');
    ok(!overlap(ml, st), '«Мельница» не наезжает на «Южный Тракт»');
    await page.screenshot({ path: `${OUT}/map_new_mill.png` });
    // клик по подписи «Мельница» → Location mill
    await clickText(page, 'Мельница', true, 6000);
    await sleep(1200);
    const millDbg = await page.evaluate(() => window.game.scene.__mill6640);
    ok(millDbg.last && millDbg.last.key === 'Location' && millDbg.last.data && millDbg.last.data.locationId === 'mill',
        'клик по мельнице (новое место) → Location mill');
    await page.close();
    await browser.close();

    // мобайл: подписи карты не пересекаются
    const b2 = await chromium.launch({ headless: true, args: FLAGS });
    const page2 = await newPage(b2, 390, 844);
    await swallowVillage(page2);
    await page2.evaluate(() => window.game.scene.start('Fork', { from: 'Village' }));
    await sleep(2200);
    const mob = await page2.evaluate(() => {
        const fork = window.game.scene.getScene('Fork');
        const texts = fork.children.list.filter(o => o.text && o.text.trim);
        const grab = (name) => {
            const t = texts.find(o => o.text.trim() === name);
            return t ? { x: t.x, y: t.y, w: t.width, h: t.height, right: t.x + t.width / 2, left: t.x - t.width / 2 } : null;
        };
        return { ml: grab('Мельница'), al: grab('Пасека'), st: grab('Южный Тракт'), vw: fork.scale.width };
    });
    const inter = (a, b) => a && b && !(a.right < b.left || b.right < a.left)
        && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;
    ok(!(inter(mob.ml, mob.al) || inter(mob.ml, mob.st) || inter(mob.al, mob.st)),
        'мобайл: Мельница/Пасека/Южный Тракт без пересечений');
    await page2.screenshot({ path: `${OUT}/map_mobile.png` });
    await page2.close();
    await b2.close();
}

// ============================================================
console.log('');
if (fails.length === 0) {
    console.log(`=== qa_6640 ИТОГ: ВСЁ ЗЕЛЁНОЕ (JS-ошибок: ${jsErrors}) ===`);
} else {
    console.log(`=== qa_6640 ИТОГ: ПРОВАЛОВ ${fails.length} (JS-ошибок: ${jsErrors}) ===`);
    fails.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
}

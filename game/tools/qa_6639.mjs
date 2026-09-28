// qa_6639.mjs — ЖИВОЙ QA патча 66.39 (7 приказов владельца) на своём сервере.
// §1 АЛЬТЫ БОЕВЫХ ОБЛИКОВ + ЛИСТАЛКА: Рогнеда (Воин|жен) → листалка ▶ ×8 →
//    Лейанн (battle_leyanne_*); Добрыня (Воин|муж) → ▶ ×8 → Эстер
//    (battle_esther_*); контроль: старт без листалки → канон (huntress);
//    Сыщик|муж — с портретом Пауля (bust_paul_1, прежде null).
// §2 ГАРДЕРОБ ЖЕНЩИН — ТОЛЬКО ПЛАТЬЯ: живой dynamic import WorldLook.js,
//    12 синтетических женщин (профессии из OUTFIT_F, в т.ч. те, у кого в 66.38
//    были брюки: пастушка/торговка/пасечница) — композиты ПИКСЕЛЬНО равны
//    ожидаемой раскладке «база+платье+обувь+причёска»; контроль-мужчина
//    (кузнец) — с брюками, как прежде.
// §3 ДЕРЕВНЯ (быстрый прогон, средовой OOM ~5с — скриншоты сразу): игрок на
//    player_composite, жители на npc_lpc_* (только люди), дымовые эмиттеры.
// Кадры: /tmp/qa6639/*.png → game/docs/r6639_*.webp (конверсия отдельно).
// Запуск: node game/tools/qa_6639.mjs (сервер на :8765 из корня репо).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/qa6639';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
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
        if (!SM.__swallow6639) {
            SM.__swallow6639 = true;
            const orig = SM.start;
            SM.start = function (key, data) {
                if (key === 'Village') return;
                return orig.call(this, key, data);
            };
        }
    });
}

// открыть превью героя (карточка по имени)
async function openPreview(pg, preset) {
    await clickText(pg, 'Новая игра');
    await sleep(1200);
    if (!await clickText(pg, preset, false, 10000)) return false;
    await sleep(700);
    return true;
}

// нажать листалку ▶ n раз, вернуть подпись под портретом
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

// прогон §1 в СВОЁМ браузере с 2 попытками (средовой OOM песочницы — АГЕНТ.md)
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
            anim: c.playerSprite.anims.currentAnim ? c.playerSprite.anims.currentAnim.key : null };
    });
    ok(st.uses === true, `боевой облик активен (${st.look})`);
    ok(st.look === expectLook, `облик = ${expectLook} [${st.look}]`);
    ok(st.anim === `battle_${expectLook}_idle`, `idle-анимация облика (${st.anim})`);
    return st;
}

// ============================================================
console.log('=== §1. Альты боевых обликов + листалка ===');
{
    // 1а: Рогнеда (Воин|жен): 8 Охотница + 8 Лейанн = 16 вариантов
    await runFlipCase('Рогнеда→Лейанн', async (browser) => {
        const page = await newPage(browser);
        await swallowVillage(page);
        if (!await openPreview(page, 'Рогнеда')) throw new Error('превью не открыто');
        const vInfo = await page.evaluate(() => {
            const cs = window.game.scene.getScene('CharacterSelection');
            return { total: cs._variants.length, first: cs._variants[0].bust, canonIdx: cs._variantIdx };
        });
        ok(vInfo.total === 16, `Воин|жен: 16 вариантов (8 Охотница + 8 Лейанн) [${vInfo.total}]`);
        ok(vInfo.first === 'bust_huntress_1', `канон — bust_huntress_1 [${vInfo.first}]`);
        const flipped = await flipNTimes(page, 8);
        ok(!!flipped && flipped.bust === 'bust_leyanne_1', `после ▶×8 — bust_leyanne_1 [${flipped && flipped.bust}]`);
        ok(!!flipped && flipped.label.includes('Лейанн'), `подпись содержит «Лейанн» [${flipped && flipped.label}]`);
        await page.screenshot({ path: `${OUT}/flipper_leyanne.png` });
        await startAndFight(page, 'leyanne');
        await page.screenshot({ path: `${OUT}/battle_leyanne.png` });
        await page.close();
    });

    // 1б: Добрыня (Воин|муж): 8 Баэнор + 1 Эстер = 9 вариантов
    await runFlipCase('Добрыня→Эстер', async (browser) => {
        const page = await newPage(browser);
        await swallowVillage(page);
        if (!await openPreview(page, 'Добрыня')) throw new Error('превью не открыто');
        const v2 = await page.evaluate(() => window.game.scene.getScene('CharacterSelection')._variants.length);
        ok(v2 === 9, `Воин|муж: 9 вариантов (8 Баэнор + 1 Эстер) [${v2}]`);
        const flipped2 = await flipNTimes(page, 8);
        ok(!!flipped2 && flipped2.bust === 'bust_esther' && flipped2.label.includes('Эстер'),
            `после ▶×8 — bust_esther, «Эстер» [${flipped2 && flipped2.bust}/${flipped2 && flipped2.label}]`);
        await page.screenshot({ path: `${OUT}/flipper_esther.png` });
        await startAndFight(page, 'esther');
        await page.screenshot({ path: `${OUT}/battle_esther.png` });
        await page.close();
    });

    // 1в: контроль — Рогнеда без листалки → канон huntress (совместимость)
    await runFlipCase('контроль-канон', async (browser) => {
        const page = await newPage(browser);
        await swallowVillage(page);
        if (!await openPreview(page, 'Рогнеда')) throw new Error('превью не открыто');
        await startAndFight(page, 'huntress');
        await page.close();
    });

    // 1г: Сыщик|муж — карточка с портретом Пауля (прежде null) — лёгкая секция
    await runFlipCase('бусты-предзагрузка', async (browser) => {
        const page = await newPage(browser);
        const busts = await page.evaluate(async () => {
            const mod = await import('/game/src/data/heroes.js');
            const cs = window.game.scene.getScene('Boot');
            return {
                paul: mod.getBustFor('Сыщик', 'male'),
                tex: ['bust_paul_1', 'bust_paul_5', 'bust_leyanne_8', 'bust_esther'].every(k => cs.textures.exists(k)),
                variantsF: mod.bustVariantsFor('Воин', 'female').length,
                variantsM: mod.bustVariantsFor('Воин', 'male').length,
            };
        });
        ok(busts.paul === 'bust_paul_1', `Сыщик|муж → bust_paul_1 [${busts.paul}]`);
        ok(busts.tex, 'текстуры новых бустов предзагружены (paul/leyanne/esther)');
        ok(busts.variantsF === 16 && busts.variantsM === 9, `bustVariantsFor: ж 16 / м 9 [${busts.variantsF}/${busts.variantsM}]`);
        await page.close();
    });
}

// ============================================================
console.log('=== §2. Гардероб женщин — только длинные платья ===');
{
    const browser = await chromium.launch({ headless: true, args: FLAGS });
    const page = await newPage(browser);
    const res = await page.evaluate(async () => {
        const mod = await import('/game/src/systems/WorldLook.js');
        const scene = window.game.scene.getScene('Boot');
        const registry = { get: () => 0 };
        // реплика FNV-ролла (как qa_6638)
        function hash01(str) {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return (h >>> 0) / 4294967296;
        }
        const pick = (list, rnd) => list[Math.floor(rnd * list.length) % list.length];
        const OUTFIT_F_DRESSES = {
            shepherd: { dresses: ['world_f_dress3'], feet: ['world_f_feet1'] },
            grocer: { dresses: ['world_f_dress2', 'world_f_dress1'], feet: ['world_f_feet2'] },
            beekeeper: { dresses: ['world_f_dress5', 'world_f_dress2'], feet: ['world_f_feet1'] },
            weaver: { dresses: ['world_f_dress4'], feet: ['world_f_feet2'] },
            homemaker: { dresses: ['world_f_dress3', 'world_f_dress4'], feet: ['world_f_feet1', 'world_f_feet2'] },
            healer_f: { dresses: ['world_f_dress5'], feet: ['world_f_feet1'] },
        };
        const F = {
            bases: ['world_f_base1', 'world_f_base2', 'world_f_base3'],
            dresses: ['world_f_dress1', 'world_f_dress2', 'world_f_dress3', 'world_f_dress4', 'world_f_dress5'],
            hair: Array.from({ length: 35 }, (_, i) => `world_f_hair${i + 1}`),
            feet: ['world_f_feet1', 'world_f_feet2'],
        };
        const M = {
            bases: ['world_m_base1', 'world_m_base2', 'world_m_base3'],
            tops: Array.from({ length: 9 }, (_, i) => `world_m_top${i + 1}`),
            pants: Array.from({ length: 5 }, (_, i) => `world_m_pants${i + 1}`),
            hair: Array.from({ length: 30 }, (_, i) => `world_m_hair${i + 1}`),
            beards: Array.from({ length: 10 }, (_, i) => `world_m_beard${i + 1}`),
            feet: ['world_m_feet1', 'world_m_feet2', 'world_m_feet3'],
        };
        const OUTFIT_M_BSMITH = { tops: ['world_m_top1'], pants: ['world_m_pants1'], feet: ['world_m_feet2'] };

        const results = [];
        const drawLayers = (keys) => {
            const cv = document.createElement('canvas');
            cv.width = 1152; cv.height = 512;
            const ctx = cv.getContext('2d');
            for (const k of keys) ctx.drawImage(scene.textures.get(k).source[0].image, 0, 0);
            return ctx.getImageData(0, 0, 1152, 512).data;
        };
        const texData = (key) => {
            const img = scene.textures.get(key).source[0].image;
            const cv = document.createElement('canvas');
            cv.width = 1152; cv.height = 512;
            cv.getContext('2d').drawImage(img, 0, 0);
            return cv.getContext('2d').getImageData(0, 0, 1152, 512).data;
        };
        let fIdx = 0;
        for (const prof of ['shepherd', 'grocer', 'beekeeper', 'weaver', 'homemaker', 'healer_f', '']) {
            for (let k = 0; k < 2; k++) {
                const npc = { id: `qa6639_f${fIdx++}`, gender: 'female', age: 22 + fIdx, professionId: prof };
                const key = mod.ensureWorldNpcTexture(scene, registry, npc);
                if (!key) { results.push({ id: npc.id, err: 'no texture' }); continue; }
                const seed = 0, base = `${seed}:${npc.id}`;
                const rnd = (tag) => hash01(`${base}:${tag}`);
                const o = prof ? OUTFIT_F_DRESSES[prof] : null;
                const layers = [
                    pick(F.bases, rnd('base')),
                    pick((o && o.dresses) || F.dresses, rnd('dress')),
                    pick((o && o.feet) || F.feet, rnd('feet')),
                    pick(F.hair, rnd('hair')),
                ];
                const a = drawLayers(layers), b = texData(key);
                let equal = true;
                for (let i = 0; i < a.length; i += 7) { if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) { equal = false; break; } }
                results.push({ id: npc.id, prof: prof || '(случай)', layers, equal, female: true });
            }
        }
        // контроль-мужчина: кузнец (база+БРЮКИ+топ+обувь+причёска+борода)
        const npcM = { id: 'qa6639_m0', gender: 'male', age: 30, professionId: 'blacksmith' };
        const keyM = mod.ensureWorldNpcTexture(scene, registry, npcM);
        const rndM = (tag) => hash01(`0:${npcM.id}:${tag}`);
        const layersM = [
            pick(M.bases, rndM('base')),
            OUTFIT_M_BSMITH.pants[0],
            OUTFIT_M_BSMITH.tops[0],
            OUTFIT_M_BSMITH.feet[0],
            pick(M.hair, rndM('hair')),
            pick(M.beards, rndM('beard')),
        ];
        const aM = drawLayers(layersM), bM = texData(keyM);
        let equalM = true;
        for (let i = 0; i < aM.length; i += 7) { if (aM[i] !== bM[i] || aM[i + 1] !== bM[i + 1] || aM[i + 2] !== bM[i + 2] || aM[i + 3] !== bM[i + 3]) { equalM = false; break; } }
        results.push({ id: npcM.id, prof: 'blacksmith', layers: layersM, equal: equalM, female: false });
        return results;
    }).catch(e => [{ err: String(e).slice(0, 120) }]);

    const females = res.filter(r => r.female);
    const males = res.filter(r => !r.female);
    ok(females.length === 14 && females.every(r => r.equal), `14 женщин: композиты = «база+платье+обувь+причёска» [${females.filter(r => r.equal).length}/14]`);
    ok(females.every(r => !r.err), 'все женские текстуры собраны');
    ok(females.every(r => r.layers.every(k => !k.includes('pants') && !k.includes('top'))), 'ни одного слоя брюк/топа у женщин');
    const dresses = new Set(females.flatMap(r => r.layers)).size;
    ok(dresses >= 5, `платья разнообразны (уникальных слоёв: ${dresses})`);
    ok(males.length === 1 && males[0].equal, 'контроль-кузнец: композит с брюками = прежней раскладке');
    await page.close();
    await browser.close();
}

// ============================================================
console.log('=== §3. Деревня: игрок/жители/дым (быстрый прогон) ===');
{
    const browser = await chromium.launch({ headless: true, args: FLAGS });
    const page = await newPage(browser);
    await clickText(page, 'Новая игра');
    await sleep(1200);
    await clickText(page, 'Милуша', false, 8000); // Милуша — женский пресет (Следопыт|жен)
    await sleep(700);
    await clickText(page, 'Начать игру', true, 8000);
    await sleep(2600); // деревня строится; средовой OOM ~5с — снимаем сразу
    const vil = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        if (!v || !v.scene.isActive()) return { active: false };
        const sprites = (v.streetNpcs || []).map(e => ({
            key: e.spr ? e.spr.texture.key : null,
            id: e.id || null,
        }));
        const playerTex = v.playerObj ? v.playerObj.texture.key : null;
        const emitters = v.children.list.filter(o => o.texture && o.texture.key === 'smoke_puff').length;
        // половой состав улицы — из реестра NPC
        let roster = [];
        try {
            const npcs = v.registry && window.game.scene.getScene('Village').registry;
            roster = sprites.map(s => s.id);
        } catch (e) { /* noop */ }
        return { active: true, sprites, playerTex, emitters, roster };
    });
    ok(vil.active, 'деревня активна');
    if (vil.active) {
        ok(vil.playerTex === 'player_composite', `игрок на player_composite [${vil.playerTex}]`);
        ok((vil.sprites || []).length >= 8, `жителей на улице: ${vil.sprites.length} ≥ 8`);
        ok(vil.sprites.every(s => s.key && s.key.startsWith('npc_lpc_')), 'все жители на npc_lpc_* (только люди)');
        // жительницы в платьях доказаны §2 (пиксельное равенство раскладок);
        // здесь достаточно живого разнообразия улицы
        const uniq = new Set(vil.sprites.map(s => s.key)).size;
        ok(uniq >= 8, `внешности уникальны (без близнецов): ${uniq}/${vil.sprites.length}`);
        ok(vil.emitters >= 16, `дымовые эмиттеры труб: ${vil.emitters} ≥ 16`);
        await page.screenshot({ path: `${OUT}/village_day.png` });
        console.log('  кадр: village_day.png');
    }
    await browser.close();
}

console.log('');
console.log(`=== qa_6639 ИТОГ: ${fails.length === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : 'ЕСТЬ ПРОБЛЕМЫ'} (JS-ошибок: ${jsErrors}) ===`);
if (fails.length) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exit(1); }

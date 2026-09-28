// QA 66.38 — гардероб жителей из новых частей Drive-паков (причёски ×5 цветов,
// бороды ×5, шлемы 10, женский брючный костюм) + пересборка всех листов из
// новой библиотеки Google Drive. Секции изолированы (свежий браузер) + ретраи
// против средового OOM (док. 66.33/66.34; --no-zygote --no-sandbox, QA_LIGHT).
//
// §1 деревня — регресс 66.37 (player_composite/масштабы/LINEAR/дым)
// §2 прелоад — все 145 мировых листов в живой игре, жители на npc_lpc_*
// §3 гардероб 66.38 — живой вызов ensureWorldNpcTexture (dynamic import):
//    реплика ролла → слои существуют; композиты пиксельно равны ожидаемым;
//    брючные костюмы/альты волос/бород реально выпадают
// §4 разнообразие улицы — композиты не близнецы
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { readdirSync } from 'fs';
const OUT = process.env.OUT_DIR || '/tmp/qa6638';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WORLD_DIR = new URL('../assets/sprites/world/', import.meta.url).pathname;
const ALL_WORLD_SHEETS = readdirSync(WORLD_DIR).filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''));

async function newBrowser() {
    return chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
}
function trackErrors(page) {
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0, 220)));
    page.on('console', m => {
        if (m.type() === 'error') {
            const txt = m.text();
            if (txt.includes('Framebuffer')) return;
            if (txt.includes('/assets/lpc/') || txt.includes('lpc_') || txt.includes('net::ERR_FAILED')) return;
            errs.push('CONSOLE: ' + txt.slice(0, 200));
        }
    });
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
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(300); return true; }
        await sleep(200);
    }
    return false;
}

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + msg); if (!cond) failed++; };

async function startGame(page) {
    if (process.env.QA_LIGHT !== '0') {
        await page.route('**/assets/lpc/**', route => route.abort());
    }
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
    await sleep(1500);
    await clickText(page, 'Новая игра');
    await sleep(800);
    await clickText(page, 'Добрыня', 8000).catch(() => {});
    await page.waitForFunction(() => {
        const cs = window.game && window.game.scene && window.game.scene.getScene('CharacterSelection');
        return cs && !!cs._previewHero;
    }, { timeout: 8000, polling: 200 }).catch(() => {});
    await page.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        if (cs && cs._previewHero) cs.startGameWithHero(cs._previewHero);
    });
    await page.waitForFunction(() => {
        const g = window.game;
        return g && g.scene && g.scene.isActive && g.scene.isActive('Village');
    }, { timeout: 15000 });
    await sleep(500);
}

async function runSection(name, body, attempts = 3, onEnvSkip = null) {
    for (let a = 1; a <= attempts; a++) {
        const browser = await newBrowser();
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const errs = trackErrors(page);
        try {
            await body(page, errs);
            const bad = errs.length;
            ok(bad === 0, `${name}: 0 JS-ошибок (${bad ? errs[0] : 'чисто'})`);
            await browser.close();
            return;
        } catch (e) {
            const msg = String(e).slice(0, 90).replace(/\n/g, ' ');
            console.log(`  ↻ ${name}: попытка ${a}/${attempts} сорвана (${msg})`);
            try { await browser.close(); } catch (_) { /* уже мёртв */ }
            await sleep(1500);
        }
    }
    if (onEnvSkip) {
        onEnvSkip(attempts);
        console.log(`  ⚠ ENV-SKIP: ${name} — все ${attempts} попыток сорваны средовым OOM (не код)`);
        return;
    }
    ok(false, `${name}: все ${attempts} попыток сорваны средовым крашем`);
}

const ONLY = process.env.ONLY_SECT || '';

// ============ §1: деревня — регресс 66.37 ============
if (ONLY === '' || ONLY === '1') await runSection('§1 деревня', async (page, errs) => {
    await startGame(page);
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
    const village = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const scaleMode = (t) => (t && t.source && t.source[0] && t.source[0].scaleMode !== undefined) ? t.source[0].scaleMode : null;
        let smoke = 0;
        for (const c of s.children.list) {
            if (c.particleTexture === 'smoke_puff' || (c.texture && c.texture.key === 'smoke_puff') ||
                (c.emitting !== undefined && c.texture && c.texture.key === 'smoke_puff')) smoke++;
        }
        const player = s.playerObj;
        const plTex = window.game.textures.get(player.texture.key);
        const plFrame = plTex.get(player.frame.name);
        const npcEntry = (s.streetNpcs || [])[0] || {};
        const npcSpr = npcEntry.spr;
        const npcTex = npcSpr ? window.game.textures.get(npcSpr.texture.key) : null;
        const npcFrameSize = npcTex && npcTex.get('0') ? `${npcTex.get('0').width}x${npcTex.get('0').height}` : null;
        const npcId = npcEntry.id;
        const npcData = npcId ? (window.game.registry.get('npcs') || []).find(n => n.id === npcId) : null;
        const age = (npcData && npcData.age) || 30;
        const ageK = age <= 12 ? 0.7 : age <= 17 ? 0.85 : 1;
        return {
            playerKey: player.texture.key,
            playerFrame: plFrame ? `${plFrame.width}x${plFrame.height}` : null,
            playerScale: Math.round(player.scaleY * 10000) / 10000,
            npcKey: npcSpr ? npcSpr.texture.key : null,
            npcFrameSize,
            npcScale: npcSpr ? Math.round(npcSpr.scaleY * 10000) / 10000 : null,
            npcAge: age,
            npcExpected: Math.round(1.125 * (31 / 88) * ageK * 100000) / 100000,
            npcLinear: scaleMode(npcTex) === 0,
            playerLinear: scaleMode(plTex) === 0,
            smoke,
            bodyW: player.body ? player.body.width : null,
            bodyH: player.body ? player.body.height : null,
        };
    });
    ok(village.playerKey === 'player_composite', `игрок на композите (${village.playerKey})`);
    ok(village.playerFrame === '128x128', `кадр игрока 128px (${village.playerFrame})`);
    ok(Math.abs(village.playerScale - 1.125 * 31 / 88) < 0.001,
       `масштаб игрока = 1.125×K (${village.playerScale})`);
    ok(village.bodyW <= 28 && village.bodyW >= 25 && village.bodyH <= 28 && village.bodyH >= 25,
       `мировой размер физтела ~27px, как раньше (${village.bodyW}x${village.bodyH})`);
    ok(village.npcKey && village.npcKey.startsWith('npc_lpc_'), `житель на мировом композите (${village.npcKey})`);
    ok(village.npcFrameSize === '128x128', `кадр жителя 128px (${village.npcFrameSize})`);
    ok(Math.abs(village.npcScale - village.npcExpected) < 0.001,
       `масштаб жителя = 1.125×K×возраст (${village.npcScale} ≈ ${village.npcExpected})`);
    ok(village.playerLinear === true && village.npcLinear === true, 'LINEAR-фильтр на персонажах');
    ok(village.smoke >= 12, `дымовых эмиттеров в деревне ≥12 (${village.smoke})`);
    await page.screenshot({ path: `${OUT}/village_day.png` });
});

// ============ §2: прелоад 145 мировых листов + SW v88 ============
if (ONLY === '' || ONLY === '2') await runSection('§2 прелоад', async (page, errs) => {
    await startGame(page);
    const sheets = JSON.stringify(ALL_WORLD_SHEETS);
    const live = await page.evaluate(async (sheetsJson) => {
        const sheets = JSON.parse(sheetsJson);
        const missing = sheets.filter(k => !window.game.textures.exists(k));
        const swTxt = await fetch('/sw.js').then(r => r.text()).catch(() => '');
        return {
            total: sheets.length,
            missing: missing.slice(0, 5),
            sw88: swTxt.includes("CACHE_NAME = 'chronicles-ruthenia-v88'"),
            sw33: swTxt.includes("GAME_ASSETS_CACHE = 'game-assets-v33'"),
        };
    }, sheets);
    ok(live.total === 145, `в паке 145 листов (${live.total})`);
    ok(live.missing.length === 0, `все мировые листы предзагружены [нет: ${live.missing}]`);
    ok(live.sw88 && live.sw33, 'живой sw.js — v88/v33');
});

// ============ §3: гардероб 66.38 — живой прогон WorldLook ============
if (ONLY === '' || ONLY === '3') await runSection('§3 гардероб 66.38', async (page, errs) => {
    await startGame(page);
    const res = await page.evaluate(async () => {
        // WorldLook — ES-модуль игры; динамический импорт даёт живой доступ
        const WL = await import('/game/src/systems/WorldLook.js');
        const scene = window.game.scene.getScene('Village');
        const reg = { get: () => 777 };   // npcSeed для детерминированности

        // реплика ролла WorldLook (FNV-1a, таблицы 66.38) — для ОЖИДАЕМЫХ слоёв
        const hash01 = (str) => {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
            return (h >>> 0) / 4294967296;
        };
        const pick = (list, rnd) => list[Math.floor(rnd * list.length) % list.length];
        const arr = (n, pre) => Array.from({ length: n }, (_, i) => `${pre}${i + 1}`);
        const M = { bases: arr(3, 'world_m_base'), pants: arr(5, 'world_m_pants'), tops: arr(9, 'world_m_top'),
                    hair: arr(30, 'world_m_hair'), beards: arr(10, 'world_m_beard'),
                    feet: ['world_m_feet1', 'world_m_feet2', 'world_m_feet3'] };
        const F = { bases: arr(3, 'world_f_base'), dresses: arr(5, 'world_f_dress'), pants: arr(3, 'world_f_pants'),
                    tops: arr(5, 'world_f_top'), hair: arr(35, 'world_f_hair'), feet: ['world_f_feet1', 'world_f_feet2'] };
        const W = { base: 'world_w_base1', tops: arr(7, 'world_w_top'), bottoms: arr(4, 'world_w_bottom'),
                    feet: ['world_w_feet1', 'world_w_feet2'], helms: arr(10, 'world_w_helm') };

        const expectLayers = (npc) => {
            const base = `777:${npc.id}`;
            const rnd = (tag) => hash01(`${base}:${tag}`);
            if ((npc.age || 30) <= 13) return [pick(arr(6, 'world_child'), rnd('kid'))];
            if (npc.gender === 'female') {
                // OUTFIT_F.grocer: feet ['world_f_feet2'], trousers:true
                if (npc.professionId === 'grocer' && rnd('outfit') < 0.4) {
                    return [pick(F.bases, rnd('base')), pick(F.pants, rnd('fpants')), pick(F.tops, rnd('ftop')),
                            'world_f_feet2', pick(F.hair, rnd('hair'))];
                }
                const dresses = npc.professionId === 'grocer' ? ['world_f_dress2', 'world_f_dress1'] : F.dresses;
                return [pick(F.bases, rnd('base')), pick(dresses, rnd('dress')),
                        npc.professionId === 'grocer' ? 'world_f_feet2' : pick(F.feet, rnd('feet')),
                        pick(F.hair, rnd('hair'))];
            }
            if (npc.professionId === 'guard') {
                return [W.base, pick(W.bottoms, rnd('wbottom')), pick(W.tops, rnd('wtop')),
                        pick(W.feet, rnd('wfeet')), pick(W.helms, rnd('whelm'))];
            }
            const layers = [pick(M.bases, rnd('base')), pick(M.pants, rnd('pants')), pick(M.tops, rnd('top')),
                            pick(M.feet, rnd('feet')), pick(M.hair, rnd('hair'))];
            if ((npc.age || 30) >= 25) layers.push(pick(M.beards, rnd('beard')));
            return layers;
        };

        // 33 жителя: мужчины 25+ (бороды), женщины-торговки (брюки/платья), стражник, ребёнок
        const npcs = [];
        for (let i = 0; i < 7; i++) npcs.push({ id: `qa_m${i}`, gender: 'male', age: 34, professionId: '' });
        for (let i = 0; i < 24; i++) npcs.push({ id: `qa_f${i}`, gender: 'female', age: 30, professionId: 'grocer' });
        npcs.push({ id: 'qa_g0', gender: 'male', age: 30, professionId: 'guard' });
        npcs.push({ id: 'qa_c0', gender: 'female', age: 9, professionId: 'child' });

        const built = [];
        for (const npc of npcs) {
            const key = WL.ensureWorldNpcTexture(scene, reg, npc);
            const expected = expectLayers(npc);
            const layersExist = expected.every(k => window.game.textures.exists(k));
            if (!key || !layersExist) { built.push({ id: npc.id, key, layersExist, match: false }); continue; }
            // пиксельная сверка: реальный композит == ожидаемая раскладка слоёв
            const real = window.game.textures.get(key).source[0].image;
            const c1 = document.createElement('canvas'); c1.width = 1152; c1.height = 512;
            const ctx1 = c1.getContext('2d'); ctx1.imageSmoothingEnabled = false;
            for (const k of expected) ctx1.drawImage(window.game.textures.get(k).source[0].image, 0, 0);
            const c2 = document.createElement('canvas'); c2.width = 1152; c2.height = 512;
            const ctx2 = c2.getContext('2d'); ctx2.imageSmoothingEnabled = false;
            ctx2.drawImage(real, 0, 0);
            const d1 = ctx1.getImageData(0, 0, 1152, 512).data;
            const d2 = ctx2.getImageData(0, 0, 1152, 512).data;
            let same = d1.length === d2.length;
            for (let i = 0; i < d1.length && same; i += 7) if (d1[i] !== d2[i]) same = false;
            built.push({ id: npc.id, key, layersExist, match: same, layers: expected });
            window.game.textures.remove(key);   // не копим GPU-память
        }

        // факты нового гардероба среди роллов
        const males = built.filter(b => b.id.startsWith('qa_m'));
        const females = built.filter(b => b.id.startsWith('qa_f'));
        const guard = built.find(b => b.id === 'qa_g0');
        const hairAlt = males.some(b => b.layers && b.layers.some(k => /world_m_hair(7|8|9|1\d|2\d|30)$/.test(k)));
        const beardAlt = males.some(b => b.layers && b.layers.some(k => /world_m_beard([3-9]|10)$/.test(k)));
        const trouser = females.filter(b => b.layers && b.layers.some(k => k.startsWith('world_f_pants')));
        const helmW = guard && guard.layers && guard.layers.some(k => k.startsWith('world_w_helm'));
        return {
            allBuilt: built.every(b => b.key && b.layersExist),
            allMatch: built.every(b => b.match),
            hairAlt, beardAlt,
            trousers: trouser.length,
            dresses: females.length - trouser.length,
            helmW,
        };
    });
    ok(res.allBuilt, 'все 33 тестовых жителя собрались, слои существуют');
    ok(res.allMatch, 'композиты пиксельно равны ожидаемым раскладкам (реплика ролла)');
    ok(res.hairAlt, 'альты волос (индексы 7+) реально выпадают у мужчин');
    ok(res.beardAlt, 'альты бород (индексы 3+) реально выпадают у мужчин');
    ok(res.trousers >= 4, `брючные костюмы выпадают у женщин (${res.trousers} из 24 торговок)`);
    ok(res.dresses >= 4, `платья остаются у женщин (${res.dresses} из 24)`);
    ok(res.helmW, 'стражник использует шлем Warfare (набор из 10)');

    // витрина: крупные кадры 8 жителей (текстуры пересоздаются — в цикле они сняты)
    const strip = await page.evaluate(async () => {
        const WL = await import('/game/src/systems/WorldLook.js');
        const scene = window.game.scene.getScene('Village');
        const reg = { get: () => 777 };
        const demo = [
            { id: 'qa_m0', gender: 'male', age: 34, professionId: '' },
            { id: 'qa_m1', gender: 'male', age: 34, professionId: '' },
            { id: 'qa_m2', gender: 'male', age: 34, professionId: '' },
            { id: 'qa_f0', gender: 'female', age: 30, professionId: 'grocer' },
            { id: 'qa_f1', gender: 'female', age: 30, professionId: 'grocer' },
            { id: 'qa_f2', gender: 'female', age: 30, professionId: 'grocer' },
            { id: 'qa_g0', gender: 'male', age: 30, professionId: 'guard' },
            { id: 'qa_c0', gender: 'female', age: 9, professionId: 'child' },
        ];
        for (const npc of demo) WL.ensureWorldNpcTexture(scene, reg, npc);
        const c = document.createElement('canvas');
        c.width = 128 * 8; c.height = 156;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#464650'; ctx.fillRect(0, 0, c.width, c.height);
        let i = 0;
        for (const npc of demo) {
            const key = 'npc_lpc_' + npc.id;
            if (!window.game.textures.exists(key)) { i++; continue; }
            const img = window.game.textures.get(key).source[0].image;
            ctx.drawImage(img, 0, 0, 128, 128, i * 128, 26, 128, 128);
            i++;
        }
        return c.toDataURL('image/png');
    });
    await page.evaluate((dataUrl) => new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#464650;width:1024px';
        img.onload = resolve;
        document.body.appendChild(img);
    }), strip);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/wardrobe_6638.png` });
});

// ============ §4: разнообразие улицы ============
if (ONLY === '' || ONLY === '4') await runSection('§4 разнообразие', async (page, errs) => {
    await startGame(page);
    const variety = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        const hashes = new Set();
        for (const e of (s.streetNpcs || [])) {
            if (!e.spr) continue;
            const tex = window.game.textures.get(e.spr.texture.key);
            const src = tex.source && tex.source[0];
            if (src && src.image && src.image.tagName === 'CANVAS') {
                try {
                    const ctx = src.image.getContext('2d');
                    const d = ctx.getImageData(0, 0, src.image.width, src.image.height).data;
                    let h = 0;
                    for (let i = 0; i < d.length; i += 404) h = (h * 31 + d[i]) | 0;
                    hashes.add(h);
                } catch (err) {}
            }
        }
        return { count: (s.streetNpcs || []).length, unique: hashes.size };
    });
    ok(variety.count >= 6, `жителей на улице (${variety.count})`);
    ok(variety.unique >= Math.min(variety.count, 5),
       `внешности жителей различаются (${variety.unique} уникальных из ${variety.count})`);
});

console.log(failed ? `\n=== QA FAIL: ${failed} ===` : '\n=== QA ВСЁ ЗЕЛЁНОЕ ===');
process.exit(failed ? 1 : 0);

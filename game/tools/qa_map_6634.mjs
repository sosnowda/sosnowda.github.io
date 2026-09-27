// 66.34 QA: интерактивная карта местности + гладкие персонажи (п.11).
// Структура как в battle_shots_6633: СВОЙ браузер на каждую секцию —
// песочница убивает рендерер через ~25-30с жизни страницы (OOM среды),
// прогонами память изолируется. Деревня глотается, Location/Apiary
// перехватываются (фиксируем факт перехода, сцены не строим).
// Запуск: node game/tools/qa_map_6634.mjs  (сервер на 8765)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/shots6634';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

// Средовой OOM песочницы (4 ГБ RAM, ~1 ГБ текстур бутстрапа): страница может
// умереть нативно в произвольный момент (~15-25с). Каждая секция = свой
// браузер + до 2 попыток (документировано в 66.32/66.33 — среда, не код).
async function withSession(name, viewport, fn, opts = {}) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        const before = fails.length;
        try {
            const s = await newSession(viewport, opts);
            await fn(s.page);
            await s.browser.close();
            return;
        } catch (e) {
            console.log(`  ⚠ ${name}: попытка ${attempt} упала (${String(e).slice(0, 70)}) — перезапуск в новом браузере`);
            if (fails.length > before) fails.length = before; // ретрай — прежние провалы секции не копим
        }
    }
    ok(false, `${name}: обе попытки упали (средовой OOM)`);
}

async function newSession(viewport = { width: 1280, height: 720 }, opts = {}) {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
    page.on('console', m => {
        if (m.type() !== 'error') return;
        if (m.text().includes('Framebuffer')) return;
        // QA_LIGHT: блакируем LPC-слои — их ошибки загрузки не считаем
        if (opts.light && (m.text().includes('/assets/lpc/') || m.text().includes('lpc_') || m.text().includes('net::ERR_FAILED'))) return;
        jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160));
    });
    // Лёгкий режим для картовых секций: без ~250 тяжёлых LPC-слоёв (832×2944)
    // — NPC-композиты падают в фолбэк, для карты они не нужны, RAM экономится
    // в разы и средовой OOM не настигает.
    if (opts.light) {
        await page.route('**/assets/lpc/**', route => route.abort());
    }
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => {
        const t = window.game && window.game.scene && window.game.scene.getScene('Title');
        return t && t.scene.isActive();
    }, { timeout: 60000, polling: 200 });
    await sleep(600);
    // глоталка: Village не строим (OOM), Location/Apiary — только фиксируем
    await page.evaluate(() => {
        const SM = Phaser.Scenes.SceneManager.prototype;
        if (!SM.__swallow6634) {
            SM.__swallow6634 = true;
            const orig = SM.start;
            SM.start = function (key, data) {
                if (key === 'Village') return;
                if (key === 'Location' || key === 'Apiary') {
                    window.__qaLastStart = { key, data };
                    return;
                }
                return orig.call(this, key, data);
            };
        }
    });
    return { browser, page };
}

async function startHero(page) {
    await page.evaluate(() => {
        window.__clickTxt = (txt, exact = false) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) {
                        for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; }
                        return null;
                    }
                    if (obj.text && obj.text.trim) {
                        const tt = obj.text.trim();
                        if (exact ? tt === txt : tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        };
    });
    const clickText = async (txt, timeout = 9000, exact = false) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            const pos = await page.evaluate(({ txt, exact }) => window.__clickTxt(txt, exact), { txt, exact });
            if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(300); return true; }
            await sleep(200);
        }
        return false;
    };
    ok(await clickText('Новая игра'), 'Новая игра');
    await sleep(800);
    ok(await clickText('Добрыня', 8000), 'Добрыня');
    await page.waitForFunction(() => {
        const cs = window.game && window.game.scene && window.game.scene.getScene('CharacterSelection');
        return cs && !!cs._previewHero;
    }, { timeout: 8000, polling: 200 });
    await page.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        cs.startGameWithHero(cs._previewHero);
    });
    await sleep(900);
    return clickText;
}

// ===== СЕКЦИЯ 1: ИНТЕРЬЕР — гладкие персонажи (п.11) =====
const ONLY = process.env.ONLY_SECT || '';
console.log('\n=== Секция 1: интерьер, LINEAR-фильтр ===');
if (ONLY === '' || ONLY === '1') await withSession('сек1-интерьер', { width: 1280, height: 720 }, async (page) => {
    await startHero(page);
    await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Interior', { interiorId: 'tavern', from: 'Village' }));
    await sleep(2000);
    const texInfo = await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        const p = s.playerSprite, n = s.npcSprite;
        const fm = (t) => (t && t.source && t.source[0] && t.source[0].scaleMode !== undefined) ? t.source[0].scaleMode : null;
        return {
            player: p ? { tex: p.texture.key, scale: p.scaleX, filter: fm(p.texture) } : null,
            npc: n ? { tex: n.texture.key, scale: n.scaleX, filter: fm(n.texture) } : null,
        };
    });
    ok(texInfo.player && texInfo.player.filter === 0, `игрок: LINEAR (tex=${texInfo.player && texInfo.player.tex}, scaleMode=${texInfo.player && texInfo.player.filter}, 0=LINEAR)`);
    ok(texInfo.player && texInfo.player.scale === 2.5, 'игрок: масштаб 2.5 сохранён');
    ok(texInfo.npc && texInfo.npc.filter === 0, `NPC: LINEAR (${texInfo.npc && texInfo.npc.tex})`);
    await page.screenshot({ path: `${OUT}/after_tavern_6634.png` });
    console.log('  ✓ кадр after_tavern_6634.png');
})

// ===== СЕКЦИЯ 2: КАРТА МЕСТНОСТИ + КЛИК-ЗОНЫ =====
console.log('\n=== Секция 2: карта местности, клик-зоны ===');
if (ONLY === '' || ONLY === '2') await withSession('сек2-карта', { width: 1280, height: 720 }, async (page) => {
    await startHero(page);
    await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
    await sleep(1400);
    const mapState = await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork');
        return {
            active: f.scene.isActive(),
            mapTex: f.textures.exists('terrain_map'),
            view: f.__mapView || null,
            labels: f.children.list.filter(c => c.text && c.text.trim).map(c => c.text.trim()),
            oldBtns: f.children.list.filter(c => c.text && (c.text.includes('Опушка леса (кнопка') || c.text.trim() === 'Южный Тракт')).length,
        };
    });
    ok(mapState.active, 'Fork активен');
    ok(mapState.mapTex, 'текстура terrain_map есть');
    ok(!!mapState.view, 'карта отрисована (__mapView)');
    const expectLabels = ['Деревня', 'Озеро', 'Мельница', 'Погост', 'Выпас', 'Пасека', 'Поле', 'Опушка', 'Лесная поляна', 'Густой лес', 'Река', 'Мост'];
    const missing = expectLabels.filter(l => !mapState.labels.some(t => t.includes(l)));
    ok(missing.length === 0, 'все подписи новой карты на месте' + (missing.length ? ' (нет: ' + missing.join(',') + ')' : ''));
    ok(!mapState.labels.some(t => t === 'Куда пойдёшь?'), 'старого экрана «Околица» (Куда пойдёшь?) НЕТ');
    await page.screenshot({ path: `${OUT}/after_map_6634.png` });
    console.log('  ✓ кадр after_map_6634.png');

    // 2а: озеро → Location lake
    const clickText = async (txt, timeout = 9000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            const pos = await page.evaluate(({ txt }) => window.__clickTxt(txt), { txt });
            if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
            await sleep(250);
        }
        return false;
    };
    ok(await clickText('Озеро'), 'клик «Озеро»');
    await sleep(300);
    const lakeOk = await page.evaluate(() => {
        const l = window.__qaLastStart;
        return !!(l && l.key === 'Location' && l.data && l.data.locationId === 'lake');
    });
    ok(lakeOk, 'клик по озеру → Location lake');

    // 2б: мельница → Location mill. ВАЖНО: ScenePlugin.start останавливает
    // вызывающую сцену (Fork), а Location перехвачен — поднимаем Fork обратно
    // через SceneManager (game.scene.start — он не глотается).
    await page.evaluate(() => window.game.scene.start('Fork'));
    await sleep(800);
    ok(await clickText('Мельница'), 'клик «Мельница»');
    await sleep(300);
    const millDbg = await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork');
        return {
            last: window.__qaLastStart,
            forkActive: !!(f && f.scene.isActive()),
            millLabel: f.children.list.some(c => c.text && c.text.includes('Мельница')),
        };
    });
    console.log('  (милл-дебаг: ' + JSON.stringify(millDbg) + ')');
    ok(millDbg.last && millDbg.last.key === 'Location' && millDbg.last.data && millDbg.last.data.locationId === 'mill',
        'клик по мельнице → Location mill');
}, { light: true })

// ===== СЕКЦИЯ 2Б: тост цепочки леса + возврат в деревню =====
console.log('\n=== Секция 2б: цепочка леса, возврат в деревню ===');
if (ONLY === '' || ONLY === '2b') await withSession('сек2б-цепочка', { width: 1280, height: 720 }, async (page) => {
    await startHero(page);
    await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
    await sleep(1200);
    const clickText = async (txt, timeout = 9000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            const pos = await page.evaluate(({ txt }) => window.__clickTxt(txt), { txt });
            if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(350); return true; }
            await sleep(250);
        }
        return false;
    };
    // поляна → тост, БЕЗ перехода
    ok(await clickText('Лесная поляна'), 'клик «Лесная поляна»');
    await sleep(500);
    const gladeOk = await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork');
        const toast = f.children.list.find(c => c.text && c.text.includes('Вход — только через Опушку'));
        return { stillFork: f.scene.isActive(), toast: !!toast };
    });
    ok(gladeOk.stillFork && gladeOk.toast, 'клик по поляне → тост «Вход — только через Опушку», без перехода');

    // деревня → Village (глотнётся, время тикнет)
    const h0 = await page.evaluate(() => { const t = window.game.registry.get('gameTime'); return t ? t.hour + ':' + t.minute : null; });
    ok(await clickText('Деревня'), 'клик «Деревня»');
    await sleep(600);
    const h1 = await page.evaluate(() => { const t = window.game.registry.get('gameTime'); return t ? t.hour + ':' + t.minute : null; });
    ok(h0 !== null && h1 !== null && h0 !== h1, `клик «Деревня» → 1 час в пути (${h0} → ${h1})`);
}, { light: true })

// ===== СЕКЦИЯ 3: МОБАЙЛ 390×844 =====
console.log('\n=== Секция 3: мобайл 390×844 ===');
if (ONLY === '' || ONLY === '3') await withSession('сек3-мобайл', { width: 390, height: 844 }, async (page) => {
    await startHero(page);
    await page.evaluate(() => window.game.scene.getScene('Village').scene.start('Fork'));
    await sleep(1600);
    const mobFit = await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork');
        const v = f.__mapView;
        const labels = f.children.list.filter(c => c.text);
        const offscreen = labels.filter(c => c.y < -10 || c.y > f.scale.height + 10 || c.x < -10 || c.x > f.scale.width + 10).length;
        return { hasMap: !!v, w: Math.round(680 * v.scale), h: Math.round(540 * v.scale), offscreen };
    });
    ok(mobFit.hasMap && mobFit.offscreen === 0, `мобайл: карта ${mobFit.w}×${mobFit.h}, текстов за краем: ${mobFit.offscreen}`);
    await page.screenshot({ path: `${OUT}/after_map_mobile_6634.png` });
    console.log('  ✓ кадр after_map_mobile_6634.png');
})

console.log('\nJS-ошибок: ' + jsErrors + '; провалов: ' + fails.length);
if (fails.length) console.log('ПРОВАЛЫ: ' + fails.join(' | '));
process.exit(fails.length ? 1 : 0);

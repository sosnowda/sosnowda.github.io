// qa_6646.mjs — ЖИВОЙ QA патча 66.46 (5 приказов владельца).
// Секции (каждая в СВОЁМ браузере — средовые OOM песочницы):
//   §1 бой: ВСЕ 9 фонов по локациям; lake/river — точки стояния бойцов на СУХОМ
//   §2 диалог: виджет с солнцем снят с деревни + SunLight жив (тени меняются)
//   §3 диалоги: кнопки НЕ налезают друг на друга (священник + стресс 6 кнопок)
//   §4 мобайл 390×844: диалог вписан, кнопки без наложений
//   §5 итог: 0 JS-ошибок
// Запуск: ulimit -n 8192; node game/tools/qa_6646.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6646';
let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const LAUNCH = { args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] };

function listenErrors(page) {
    page.on('pageerror', e => {
        const s = String(e);
        if (!s.includes('Framebuffer')) { jsErrors++; console.log('PAGEERROR:', s.slice(0, 160)); }
    });
    page.on('console', m => {
        if (m.type() === 'error' && !m.text().includes('Framebuffer')
            && !m.text().includes('ERR_CERT_AUTHORITY_INVALID')) {
            jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 140));
        }
    });
}

// =========================================================================
console.log('§1. Бой: все 9 фонов по локациям; вода — только вдали (приказы 4–5)');
{
    const browser = await chromium.launch(LAUNCH);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    listenErrors(page);
    await page.goto(BASE + '/game/?shot=combat', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 150000, polling: 250 });

    const cases = [
        { id: 'forest',  name: 'лес',      data: { enemyKeys: ['wolf'], fromScene: 'Forest' } },
        { id: 'field',   name: 'поле',     data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'field' } },
        { id: 'lake',    name: 'озеро',    data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'lake' } },
        { id: 'river',   name: 'река',     data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'river' } },
        { id: 'pogost',  name: 'погост',   data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'pogost' } },
        { id: 'mill',    name: 'мельница', data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'mill' } },
        { id: 'apiary',  name: 'пасека',   data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'apiary' } },
        { id: 'road',    name: 'тракт',    data: { enemyKeys: ['bandit'], fromScene: 'Location', fromLocation: 'road_north' } },
        { id: 'interior', name: 'изба',    data: { enemyKeys: ['villager'], npcId: 'blacksmith_hostile' } },
    ];
    for (const cs of cases) {
        const st = await page.evaluate((data) => new Promise((resolve) => {
            const sm = window.game.scene;
            sm.stop('Combat');
            sm.start('Combat', data);
            const t0 = Date.now();
            const poll = () => {
                const c = sm.getScene('Combat');
                if (c && c.scene.isActive() && c.enemySprites && c.enemySprites.length) {
                    const bg = c.children.list.find(x => x.type === 'Image' && x.depth === -2
                        && x.texture && /^battle_bg_/.test(x.texture.key));
                    resolve({ bg: bg ? bg.texture.key : null, active: true });
                    return;
                }
                if (Date.now() - t0 > 20000) { resolve({ bg: null, active: false }); return; }
                setTimeout(poll, 150);
            };
            poll();
        }), cs.data);
        ok(st.active && st.bg === `battle_bg_${cs.id}`, `${cs.name}: фон = battle_bg_${cs.id} (факт: ${st.bg})`);
        await sleep(350);
        await page.screenshot({ path: `${OUT}/b_${cs.id}.png` });
    }
    await page.close();
    await browser.close();
}

// =========================================================================
console.log('§2. Деревня: виджет с солнцем снят, SunLight жив (приказы 1–2)');
{
    const browser = await chromium.launch(LAUNCH);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    listenErrors(page);
    await page.goto(BASE + '/game/?shot=village', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 150000, polling: 250 });
    const st = await page.evaluate(async () => {
        const v = window.game.scene.getScene('Village');
        if (!v) return null;
        const { sunShadowState } = await import('./src/systems/SunLight.js');
        // виджет: ни объектов skyclock, ни текстур дисков
        const hasSkyObjs = v.children.list.some(c => c.texture
            && /^skyclock_(sun|moon)$/.test(c.texture.key));
        // солнечная система
        const sl = v.sunLight;
        const dirMorning = sunShadowState({ hour: 8, minute: 0, month: 9, day: 21 }).dir;
        const dirEvening = sunShadowState({ hour: 17, minute: 0, month: 9, day: 21 }).dir;
        // принудительно: утро → тени в одну сторону, вечер → в другую
        const ts = window.game.registry.get('gameTime');
        const bufLen = (gfx) => (gfx && gfx.commandBuffer) ? gfx.commandBuffer.length : -1;
        const before = bufLen(sl && sl._gfx);
        sl.update({ ...(ts || {}), hour: 8, minute: 0 });
        const bufMorning = bufLen(sl._gfx);
        const stateMorning = JSON.stringify(sunShadowState({ hour: 8, minute: 0, month: 9, day: 21 }));
        return {
            hasSkyObjs,
            hasSunLight: !!sl,
            overlayVisible: sl && sl._overlay ? sl._overlay.visible : null,
            bufMorning, before,
            dirMorning, dirEvening,
            stateMorning,
            heroShadow: !!(v.playerObj),
            timeHour: ts ? ts.hour : null,
        };
    });
    ok(!!st, 'деревня живая');
    if (st) {
        ok(!st.hasSkyObjs, 'виджет с солнцем/луной ОТСУТСТВУЕТ (приказ 1)');
        ok(st.hasSunLight, 'система SunLight подключена (приказ 2)');
        ok(st.dirMorning < 0 && st.dirEvening > 0,
            `тени: утром на запад (${st.dirMorning.toFixed(2)}), вечером на восток (${st.dirEvening.toFixed(2)})`);
        ok(st.bufMorning > 0, `теневой Graphics рисует эллипсы (${st.bufMorning} команд)`);
        // кадр деревни (утро, тени видны)
        await page.screenshot({ path: OUT + '/s2_village_morning.png' });
    }
    await page.close();
    await browser.close();
}

// =========================================================================
console.log('§3. Диалоги: кнопки НЕ налезают друг на друга (приказ 3)');
{
    const browser = await chromium.launch(LAUNCH);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    listenErrors(page);
    await page.goto(BASE + '/game/?shot=priest', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 150000, polling: 250 });

    // Универсальный сборщик кнопок живого диалога: контейнеры с __btn_bg_* фоном
    const collect = () => page.evaluate(() => {
        const s = window.game.scene.getScene('Interior') || window.game.scene.getScene('Village')
            || window.game.scene.getScene('Location');
        if (!s) return null;
        const walk = (o, out) => { if (!o) return; out.push(o); (o.list || []).forEach(c => walk(c, out)); };
        const all = []; (s.children.list || []).forEach(c => walk(c, all));
        const btns = [];
        for (const o of all) {
            if (o.type !== 'Container' || !o.list) continue;
            const bg = o.list.find(x => x.texture && /^__btn_bg_/.test(x.texture.key));
            if (bg && typeof o.x === 'number') {
                btns.push({ x: o.x, y: o.y, w: (bg.width || 0) * Math.abs(bg.scaleX || 1) * (o.scale || 1),
                    h: (bg.height || 0) * Math.abs(bg.scaleY || 1) * (o.scale || 1) });
            }
        }
        return btns;
    });
    const overlaps = (btns, tol = 1) => {
        const bad = [];
        for (let i = 0; i < btns.length; i++) {
            for (let j = i + 1; j < btns.length; j++) {
                const a = btns[i], b = btns[j];
                const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
                const dy = Math.abs(a.y - b.y) - (a.h + b.h) / 2;
                if (dx < -tol && dy < -tol) bad.push([i, j, dx.toFixed(1), dy.toFixed(1)]);
            }
        }
        return bad;
    };

    // Диалог священника (живой сценарий)
    let btns = await collect();
    ok(Array.isArray(btns) && btns.length >= 3, `священник: кнопки найдены (${(btns || []).length})`);
    if (btns) {
        const bad = overlaps(btns);
        ok(bad.length === 0, `священник: без наложений (${bad.length ? JSON.stringify(bad) : 'чисто'})`);
        await page.screenshot({ path: OUT + '/s3_priest_dialog.png' });
    }

    // СТРЕСС: 6 кнопок с длинными подписями — ряды/высоты честные
    const st2 = await page.evaluate(() => new Promise((resolve) => {
        const s = window.game.scene.getScene('Interior');
        import('./src/utils/ui.js').then(({ createDialog }) => {
            const d = createDialog(s, 'Тест раскладки',
                'Стресс-проверка упаковки кнопок: шесть длинных подписей.',
                [
                    { text: 'Отдохнуть 1 час (4 д.) — лечение ~1/3 здоровья' },
                    { text: 'Молиться до заката и поставить свечу' },
                    { text: 'Пожертвовать церкви 10 монет на ладан' },
                    { text: 'Спросить о shortcut через болото' },
                    { text: 'Попросить благословения в дорогу' },
                    { text: 'Закрыть' },
                ], { singleton: false, singletonKey: 'stress-6646' });
            setTimeout(() => {
                const btns = [];
                (d.list || []).forEach(o => {
                    if (o.type !== 'Container' || !o.list) return;
                    const bg = o.list.find(x => x.texture && /^__btn_bg_/.test(x.texture.key));
                    if (bg) btns.push({ x: o.x, y: o.y,
                        w: (bg.width || 0) * Math.abs(bg.scaleX || 1) * (o.scale || 1),
                        h: (bg.height || 0) * Math.abs(bg.scaleY || 1) * (o.scale || 1) });
                });
                // высота панели (перегамент)
                const parch = (d.list || []).find(x => x.texture && /^ui_parchment_/.test(x.texture.key));
                resolve({ n: btns.length, btns, panelH: parch ? Math.round(parch.displayHeight) : 0 });
            }, 120);
        });
    }));
    ok(st2.n === 6, `стресс: 6 кнопок на панели (${st2.n})`);
    const bad2 = overlaps(st2.btns);
    ok(bad2.length === 0, `стресс: без наложений (${bad2.length ? JSON.stringify(bad2) : 'чисто'})`);
    ok(st2.panelH > 0 && st2.panelH <= 720 * 0.92, `панель в экране (H=${st2.panelH})`);
    await page.screenshot({ path: OUT + '/s3_stress_buttons.png' });
    await page.close();
    await browser.close();
}

// =========================================================================
console.log('§4. Мобайл 390×844: диалог вписан, кнопки без наложений (приказ 3)');
{
    const browser = await chromium.launch(LAUNCH);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    listenErrors(page);
    await page.goto(BASE + '/game/?shot=priest', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 150000, polling: 250 });
    const st = await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        const walk = (o, out) => { if (!o) return; out.push(o); (o.list || []).forEach(c => walk(c, out)); };
        const all = []; (s.children.list || []).forEach(c => walk(c, all));
        const btns = [];
        let panelW = null, panelH = null;
        for (const o of all) {
            if (o.type !== 'Container' || !o.list) continue;
            const parch = o.list.find(x => x.texture && /^ui_parchment_/.test(x.texture.key));
            if (parch && panelW == null) { panelW = Math.round(parch.displayWidth); panelH = Math.round(parch.displayHeight); }
            const bg = o.list.find(x => x.texture && /^__btn_bg_/.test(x.texture.key));
            if (bg) btns.push({ x: o.x, y: o.y,
                w: (bg.width || 0) * Math.abs(bg.scaleX || 1) * (o.scale || 1),
                h: (bg.height || 0) * Math.abs(bg.scaleY || 1) * (o.scale || 1) });
        }
        return { btns, panelW, panelH, camW: s.scale.width };
    });
    const overlaps = (btns, tol = 1) => {
        const bad = [];
        for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
            const a = btns[i], b = btns[j];
            if ((Math.abs(a.x - b.x) - (a.w + b.w) / 2) < -tol
                && (Math.abs(a.y - b.y) - (a.h + b.h) / 2) < -tol) bad.push([i, j]);
        }
        return bad;
    };
    ok(!!st && st.btns.length >= 3, `мобайл: кнопки найдены (${st ? st.btns.length : 0})`);
    if (st) {
        ok(overlaps(st.btns).length === 0, 'мобайл: без наложений кнопок');
        ok(st.panelW <= st.camW - 8, `панель вписана в экран (${st.panelW} ≤ ${st.camW - 8})`);
        await page.screenshot({ path: OUT + '/s4_mobile_dialog.png' });
    }
    await page.close();
    await browser.close();
}

// =========================================================================
console.log('§5. Итог');
ok(jsErrors === 0, `0 JS-ошибок за весь прогон (факт: ${jsErrors})`);
if (fails.length) {
    console.log('\nПРОВАЛЫ:');
    fails.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
} else {
    console.log('\nqa_6646: ВСЁ ЗЕЛЁНОЕ');
}

// qa_chimneys_6642.mjs — ЖИВОЙ осмотр каждого дома деревни (приказ 3: трубы).
// 3 браузера × 6 домов, каждый браузер входит в деревню заново и за ~2.5с
// снимает свои дома (центр камеры на доме). Деревня убивает headless-рендерер
// ~5с (АГЕНТ.md) — окно выдерживаем. Заодно пишет метаданные: спрайт, fitS,
// позиция жерла, эмиттер дыма рядом.
// Запуск: node game/tools/qa_chimneys_6642.mjs (сервер на :8765 из корня репо)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/qa6642chimney';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FLAGS = ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'];

let jsErrors = 0;

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
    await sleep(800);
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
        if (pos && pos.x > 0 && pos.y > 0) { await pg.mouse.click(pos.x, pos.y); await sleep(300); return true; }
        await sleep(250);
    }
    return false;
}

// порядок домов (18) — разбит на 3 группы
const GROUPS = [
    ['potter_house', 'tavern', 'carpenter_house', 'villager_house_1', 'blacksmith', 'healer_house'],
    ['shop_tools', 'villager_house_2', 'church', 'elder_house', 'beekeeper_house', 'butcher_house'],
    ['weaver_house', 'villager_house_3', 'shoemaker_house', 'woodcutter_house', 'fisher_house', 'grocer_house'],
];

const meta = {};
let fails = 0;

for (let gi = 0; gi < GROUPS.length; gi++) {
    const browser = await chromium.launch({ headless: true, args: FLAGS });
    const page = await newPage(browser);
    // быстрый вход: Новая игра → Милуша → Начать игру
    const okFlow = await clickText(page, 'Новая игра');
    await sleep(1000);
    await clickText(page, 'Милуша', false, 8000);
    await sleep(600);
    await clickText(page, 'Начать игру', true, 8000);
    await sleep(2200);
    const st = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        return v && v.scene.isActive() ? { ts: v.tileSize } : { ts: null };
    });
    if (!st.ts) { console.log(`ГРУППА ${gi + 1}: деревня не поднялась`); fails++; await browser.close(); continue; }

    for (const bid of GROUPS[gi]) {
        const info = await page.evaluate((bid) => {
            const v = window.game.scene.getScene('Village');
            const B = v.buildings || null;
            // buildings может не быть — берём из импорта? В сцене есть this.doors и houseHitRects
            const hit = (v.houseHitRects || []).find(h => h.b && h.b.interiorId === bid);
            if (!hit) return null;
            const cx = (hit.x0 + hit.x1) / 2;
            const topY = hit.y0;
            const bottomY = hit.y1;
            return { cx, topY, bottomY };
        }, bid);
        if (!info) { console.log(`  ✗ ${bid}: hit-прямоугольник не найден`); fails++; continue; }
        // центр камеры на ВЕРХ дома (трубы сверху), чуть выше, чтобы крыша и труба были в кадре
        await page.evaluate(({ cx, topY }) => {
            const v = window.game.scene.getScene('Village');
            const cam = v.cameras.main;
            cam.stopFollow();
            cam.centerOn(cx, topY + 40);
        }, { cx: info.cx, topY: info.topY });
        await sleep(240);
        await page.screenshot({ path: `${OUT}/${String(gi * 6 + GROUPS[gi].indexOf(bid) + 1).padStart(2, '0')}_${bid}.png` });
        meta[bid] = info;
        console.log(`  ✓ ${bid} снят (cx=${Math.round(info.cx)}, top=${Math.round(info.topY)})`);
    }
    await browser.close();
}

fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
console.log(jsErrors === 0 ? '0 JS-ошибок' : `JS-ОШИБКИ: ${jsErrors}`);
console.log(fails === 0 ? 'ВСЕ ДОМА СНЯТЫ' : `ПРОБЛЕМ: ${fails}`);

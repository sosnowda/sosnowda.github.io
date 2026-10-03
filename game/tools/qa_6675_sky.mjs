// qa_6675_sky.mjs — ЖИВОЙ QA 66.75 (приказы 3–4 владельца: «проверить как
// работает смена дня и ночи со снимками скринов экрана» + «проверить как
// работает смена погоды и времён года»):
//   §1 СУТКИ (июль, деревня): рассвет 5 ч → утро 9 ч → полдень 12 ч →
//      вечер 17 ч → сумерки 20 ч → ночь 23 ч; оверлей неба и свечение окон
//      по AccessHours; скриншот каждой фазы;
//   §2 ПОГОДА: ясно/пасмурно/дождь/гроза (летом) и снег/ясно (зимой) —
//      форс через registry 'weatherForecast' (приметы, тот же канал, что и
//      игра); перекраска сцены ~1.6 с crossfade (66.6); скриншот каждого типа;
//   §3 СЕЗОНЫ: весна (апрель)/лето (июль)/осень (октябрь)/зима (январь),
//      полдень — скриншот каждого сезона.
// Кадры: /tmp/qa6675/sky_*.png. Запуск: node game/tools/qa_6675_sky.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6675';
import fs from 'fs';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LAUNCH_FLAGS = ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'];

const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let jsErrors = 0;
page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });

async function clickText(txt, exact = false, timeout = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt, exact }) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                if (!s.scene || !s.scene.isActive()) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) {
                        for (const c of obj.list) {
                            const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0));
                            if (r) return r;
                        }
                        return null;
                    }
                    if (obj.text && obj.text.trim && !obj.input?.disabled) {
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
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(500); return true; }
        await sleep(250);
    }
    return false;
}

async function startGameToVillage(month, day) {
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
    await sleep(4500);
    await clickText('Новая игра', true);
    await sleep(1500);
    await page.mouse.click(360, 300);
    await sleep(1200);
    await clickText('Начать игру', true);
    await sleep(5000);
    await page.evaluate(({ month, day }) => {
        for (const s of window.game.scene.scenes) {
            if (s && s.tutorial && s.tutorial.activeOverlays) {
                s.tutorial.activeOverlays.forEach(o => {
                    try { o.closeTimer.remove(false); } catch (e) {}
                    try { o.container.destroy(); } catch (e) {}
                });
                s.tutorial.activeOverlays = [];
            }
        }
        const v = window.game.scene.getScene('Village');
        if (v) {
            const q = v.registry.get('quest');
            if (q) { q.tutorialStep = 3; v.registry.set('quest', q); }
            const gt = v.registry.get('gameTime');
            if (gt) { gt.month = month; gt.day = day; gt.hour = 12; gt.minute = 0; v.registry.set('gameTime', gt); }
        }
    }, { month, day });
    await sleep(1200);
    ok(await page.evaluate(() => window.game.scene.getScene('Village').scene.isActive()), `деревня активна (${month}/${day})`);
}

// ============================================================
console.log('===== §1. СУТКИ: день/ночь (июль) =====');
await startGameToVillage(10, 15);   // месяц 10 = июль
const PHASES = [
    { name: ' рассвет 5 ч ', hour: 5, nightAlpha: false },
    { name: ' утро 9 ч ', hour: 9, nightAlpha: false },
    { name: ' полдень 12 ч ', hour: 12, nightAlpha: false },
    { name: ' вечер 17 ч ', hour: 17, nightAlpha: false },
    { name: ' сумерки 20 ч ', hour: 20, nightAlpha: true },
    { name: ' ночь 23 ч ', hour: 23, nightAlpha: true },
];
for (const ph of PHASES) {
    await page.evaluate((hour) => {
        const v = window.game.scene.getScene('Village');
        const gt = v.registry.get('gameTime');
        gt.hour = hour; gt.minute = 0;
        v.registry.set('gameTime', gt);
    }, ph.hour);
    await sleep(1800);   // updateHUD (таймер 1 с) перекрашивает небо/окна
    const sky = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        return {
            alpha: v.dayNightOverlay ? Math.round((v.dayNightOverlay.fillAlpha ?? 0) * 100) / 100 : null,
            glow: v.windowGlows ? Math.round(v.windowGlows.reduce((a, g) => a + (g.alpha || 0), 0) * 100) / 100 : null,
        };
    });
    if (ph.nightAlpha) ok(sky.alpha >= 0.3, `${ph.name}: небо затемнено (α=${sky.alpha})`);
    else ok(sky.alpha <= 0.2, `${ph.name}: небо светлое (α=${sky.alpha})`);
    await page.screenshot({ path: `${OUT}/sky_day_${String(ph.hour).padStart(2, '0')}.png` });
}
const nightGlow = await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const gt = v.registry.get('gameTime');
    gt.hour = 23; v.registry.set('gameTime', gt);
    return new Promise(res => setTimeout(() => res(Math.round(v.windowGlows.reduce((a, g) => a + (g.alpha || 0), 0) * 100) / 100), 1600));
});
ok(nightGlow > 0, `ночь: окна светятся (сумма α=${nightGlow})`);

// ============================================================
console.log('===== §2. ПОГОДА (лето + зима) =====');
// Погода дня ДЕТЕРМИНИРОВАНА ДАТОЙ (66.6): примета-форкаст читается при
// наступлении нового дня — поэтому каждому типу своя дата (день меняется →
// монитор каждые 4 с видит новый dayKey → crossfade по примете)
const WEATHERS = [
    { type: 'clear',  name: 'ясно',     month: 10, day: 11 },
    { type: 'cloudy', name: 'пасмурно', month: 10, day: 12 },
    { type: 'rain',   name: 'дождь',    month: 10, day: 13 },
    { type: 'storm',  name: 'гроза',    month: 10, day: 14 },
    { type: 'snow',   name: 'снег',     month: 4,  day: 15 },
];
for (const w of WEATHERS) {
    await page.evaluate(({ type, month, day }) => {
        const v = window.game.scene.getScene('Village');
        const gt = v.registry.get('gameTime');
        gt.month = month; gt.day = day; gt.hour = 12; gt.minute = 0;
        v.registry.set('gameTime', gt);
        v.registry.set('weatherForecast', { type, dayKey: `${gt.yearFromChrist}-${gt.month}-${gt.day}` });
    }, w);
    await sleep(5200);   // монитор погоды опрашивает раз в 4 с + crossfade ~1.6 с
    const wNow = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        return { id: v.weather ? v.weather.id : null, icon: v.weather ? v.weather.icon : '' };
    });
    ok(wNow.id === w.type, `погода «${w.name}» применена (${wNow.icon})`);
    await page.screenshot({ path: `${OUT}/sky_weather_${w.type}.png` });
}

// ============================================================
console.log('===== §3. СЕЗОНЫ (полдень) =====');
const SEASONS = [
    { month: 7,  name: 'весна (апрель)' },
    { month: 10, name: 'лето (июль)' },
    { month: 1,  name: 'осень (октябрь)' },
    { month: 4,  name: 'зима (январь)' },
];
for (const s of SEASONS) {
    await page.evaluate((month) => {
        const v = window.game.scene.getScene('Village');
        v.registry.set('weatherForecast', null);
        const gt = v.registry.get('gameTime');
        gt.month = month; gt.hour = 12; gt.minute = 0;
        v.registry.set('gameTime', gt);
    }, s.month);
    await sleep(2600);
    const status = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        return v.statusText ? v.statusText.text : '';
    });
    ok(status.includes('📅'), `${s.name}: статус-бар жив`);
    await page.screenshot({ path: `${OUT}/sky_season_${s.month}.png` });
}

ok(jsErrors === 0, `0 JS-ошибок (${jsErrors})`);
console.log(`\nSKY6675 ИТОГ: ${pass} PASS, ${fail} FAIL`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);

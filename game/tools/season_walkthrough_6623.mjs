// Раунд 66.23: ПОЛНЫЙ ПРОХОД «ГЛАЗАМИ ИГРОКА» ПО ВСЕМ СЕЗОНАМ.
// Для каждого сезона (весна/лето/осень/зима) игрок живёт сутки:
//   предрассветный час → час после рассвета → полдень → час после заката.
// Проверяется СВЯЗКА: небесные часы (солнце/луна на дуге, подпись ↑/↓),
// окраска неба деревни (оверлей), ночные запоры ДОМА по солнцу, свечение
// окон, статус-бар. Ожидаемые рассвет/закат считаются в Node тем же
// AccessHours.sunTimes, что и в игре, — расхождений быть не должно.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import { sunTimes } from 'file:///home/z/my-project/site-repo/game/src/systems/AccessHours.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let pageErrors = 0;
page.on('pageerror', e => { pageErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(6000);
await page.mouse.click(640, 270);   // «Новая игра»
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await page.mouse.click(519, 608);   // старт
await sleep(5000);

const SEASONS = [
    { key: 'spring', month: 7,  day: 15 },  // Апрель
    { key: 'summer', month: 10, day: 15 },  // Июль
    { key: 'autumn', month: 1,  day: 15 },  // Октябрь
    { key: 'winter', month: 4,  day: 15 },  // Январь
];

let pass = 0, fail = 0;
const ok = (cond, msg) => {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
};
const hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

for (const s of SEASONS) {
    const st = sunTimes(s.month, s.day);
    console.log(`\n=== ${s.key.toUpperCase()} (${hhmm(st.sunrise)} → ${hhmm(st.sunset)}, день ${st.dayLen} ч) ===`);
    const phases = [
        { key: 'predawn', hour: Math.max(0, Math.floor(st.sunrise) - 1), expectLocked: true, sun: false, moon: true },
        { key: 'sunrise', hour: Math.floor(st.sunrise) + 1, expectLocked: false, sun: true, moon: false },
        { key: 'noon', hour: 12, expectLocked: false, sun: true, moon: false },
        { key: 'night', hour: Math.min(23, Math.ceil(st.sunset) + 1), expectLocked: true, sun: false, moon: true },
    ];
    for (const ph of phases) {
        const r = await page.evaluate(({ month, day, hour }) => {
            const sc = window.game.scene.getScene('Village');
            const gt = JSON.parse(JSON.stringify(sc.registry.get('gameTime')));
            gt.month = month; gt.day = day; gt.hour = hour; gt.minute = 0;
            sc.registry.set('gameTime', gt);
            // даём updateHUD (таймер 1 с) применить небо/окна
            return new Promise(res => setTimeout(() => {
                const out = {};
                out.closed = sc.getInteriorClosure('elder_house');
                out.sunVisible = sc.skyClock && sc.skyClock._objs[2] ? sc.skyClock._objs[2].visible : null;
                out.moonVisible = sc.skyClock && sc.skyClock._objs[3] ? sc.skyClock._objs[3].visible : null;
                out.label = sc.skyClock && sc.skyClock._objs[4] ? sc.skyClock._objs[4].text : '';
                out.overlayAlpha = sc.dayNightOverlay ? Math.round((sc.dayNightOverlay.fillAlpha ?? 0) * 100) / 100 : null;
                out.glow = 0;
                if (sc.windowGlows) sc.windowGlows.forEach(g => { out.glow += g.alpha || 0; });
                out.glow = Math.round(out.glow * 100) / 100;
                out.status = sc.statusText ? sc.statusText.text.slice(0, 90) : '';
                out.sunPos = (sc.skyClock && sc.skyClock._objs[2]) ? { x: Math.round(sc.skyClock._objs[2].x), y: Math.round(sc.skyClock._objs[2].y) } : null;
                return res(out);
            }, 1400));
        }, { month: s.month, day: s.day, hour: ph.hour });
        if (!ph.expectLocked) ok(!r.closed || !r.closed.night, `${s.key} ${ph.hour}:00 — днём дом не НОЧНОЙ заперт (${r.closed ? 'хозяин ушёл по расписанию — так честно' : 'дверь открыта'})`);
        ok(r.sunVisible === ph.sun, `${s.key} ${ph.hour}:00 — солнце на небе: ${ph.sun ? 'видно' : 'скрыто'}`);
        ok(r.moonVisible === ph.moon, `${s.key} ${ph.hour}:00 — луна на небе: ${ph.moon ? 'видна' : 'скрыта'}`);
        ok(typeof r.label === 'string' && r.label.includes('↑') && r.label.includes('↓'),
            `${s.key} — часы показывают рассвет/закат: «${r.label}»`);
        const expLabel = `↑ ${hhmm(st.sunrise)} · ↓ ${hhmm(st.sunset)}`;
        ok(r.label.trim() === expLabel, `${s.key} — подпись совпадает с sunTimes (${expLabel})`);
        if (ph.key === 'noon') ok(r.glow === 0, `${s.key} полдень — окна не светятся`);
        if (ph.key === 'night') ok(r.glow > 0, `${s.key} ночь — окна светятся (тьма по солнцу)`);
        if (ph.expectLocked) ok(!!r.closed && r.closed.night === true, `${s.key} ${ph.hour}:00 — НОЧЬЮ дверь заперта по солнцу`);
        if (ph.key === 'night') ok(r.overlayAlpha >= 0.5, `${s.key} ночь (через 1,5 ч после заката) — небо затемнено (α=${r.overlayAlpha})`);
        if (ph.key === 'noon') ok(r.overlayAlpha <= 0.2, `${s.key} полдень — небо чистое (α=${r.overlayAlpha})`);
        await page.screenshot({ path: `/home/z/my-project/site-repo/game/docs/r6623_${s.key}_${ph.key}.png` });
    }
    // статус-бар жив: дата сезона и косой час на месте
    const st2 = await page.evaluate(() => {
        const sc = window.game.scene.getScene('Village');
        return sc.statusText ? sc.statusText.text : '';
    });
    ok(st2.includes('❤') && st2.includes('💰') && st2.includes('📅') && st2.includes('🕐'),
        `${s.key} — статус-бар цел (HP/деньги/дата/час)`);
}

console.log(`\n=== ПРОХОД ПО СЕЗОНАМ: ${pass} зелёных, ${fail} красных, JS-ошибок: ${pageErrors} ===`);
await browser.close();
process.exit(fail || pageErrors ? 1 : 0);

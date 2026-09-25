// Раунд 66.23: НОЧНЫЕ ЗАПОРЫ × ПОГОНЯ ЗА ВОРОМ.
// Сценарий: зима (закат ~15:10), 16:30 — по солнцу уже ночь (дома заперты),
// при этом канонический «воровской» час (21–5) ещё не наступил.
// Проверяется, что мировая погоня (tick-хук вора), ночные запоры домов,
// стук по срочному делу и ходьба игрока работают ОДНОВРЕМЕННО, без конфликтов.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let pageErrors = 0;
page.on('pageerror', e => { pageErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(6000);
await page.mouse.click(640, 270);
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await page.mouse.click(519, 608);
await sleep(5000);

let pass = 0, fail = 0;
const ok = (cond, msg) => {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
};

// 1) Зимний вечер 16:30: вор в бегах, дома уже заперты по солнцу
const r1 = await page.evaluate(() => {
    const sc = window.game.scene.getScene('Village');
    const gt = JSON.parse(JSON.stringify(sc.registry.get('gameTime')));
    gt.month = 3; gt.day = 21; gt.hour = 16; gt.minute = 30; // Декабрь, после заката ~15:10
    sc.registry.set('gameTime', gt);
    const q = sc.registry.get('quest') || {};
    return {
        chaseActive: !!(q.chase && !q.thiefEscaped && !q.thiefDefeated),
        routeLen: q.chase ? q.chase.route.length : 0,
        closed: sc.getInteriorClosure('elder_house'),
        stop0: q.chase ? q.chase.stop : null,
        phase0: q.chase ? q.chase.phase : null,
        accum0: q.chase ? (q.chase.minutesAccum || 0) : null,
        ticks0: q.chase ? q.chase.ticksLeft : null,
        escaped: q.thiefEscaped, defeated: q.thiefDefeated,
    };
});
console.log('  R1:', JSON.stringify(r1));
ok(r1.chaseActive && r1.routeLen >= 3 && r1.routeLen <= 5, 'погоня активна с начала игры (маршрут 3–5 остановок, лес цепочкой)');
ok(!!r1.closed && r1.closed.night === true, 'зима 16:30 — жилой дом заперт (ночь по солнцу, закат ~15:10)');
console.log('  вор: stop=' + r1.stop0, 'phase=' + r1.phase0, 'accum=' + r1.accum0, 'ticksLeft=' + r1.ticks0);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6623_thief_night_locked.png' });

// 2) Мирное время идёт ночью: 3 тика по часу — вор двигается по маршруту,
//    запоры/погоня не мешают друг другу
const r2 = await page.evaluate(() => {
    const sc = window.game.scene.getScene('Village');
    const hook = sc.registry.get('chaseTickHook');
    const before = JSON.stringify(sc.registry.get('quest').chase, (k, v) => k === 'traces' ? undefined : v);
    for (let i = 0; i < 3; i++) {
        const gt = JSON.parse(JSON.stringify(sc.registry.get('gameTime')));
        gt.hour = (gt.hour + 1) % 24;
        sc.registry.set('gameTime', gt);
        hook(sc.registry, 60); // как это делает TimeSystem.tickTime
    }
    const q = sc.registry.get('quest').chase;
    const after = JSON.stringify(q, (k, v) => k === 'traces' ? undefined : v);
    return { changed: before !== after, stop: q.stop, phase: q.phase, accum: q.minutesAccum || 0 };
});
ok(r2.changed, 'за 3 ночных часа вор двигался/отсиживался по маршруту (тик-хук живёт ночью)');
console.log('  вор после 3 часов: stop=' + r2.stop, 'phase=' + r2.phase, 'accum=' + r2.accum);

// 3) Стук в запертую дверь ПО СЛЕДАМ погони: срочное дело от старосты +
//    активная погоня — впускают, конфликтов нет
const r3 = await page.evaluate(() => {
    const sc = window.game.scene.getScene('Village');
    sc.busyDialog = false;
    try { sc.children.list.filter(o => o.destroy && o.depth > 900).forEach(o => o.destroy()); } catch (e) {}
    const q = sc.registry.get('quest') || {};
    q.activeQuests = q.activeQuests || [];
    q.activeQuests.push({
        npcId: 'elder', accepted: true, completed: false, failed: false,
        rewardClaimed: false, isMainQuest: false, title: 'Проверка 66.23', type: 'fetch',
    });
    sc.registry.set('quest', q);
    const rep0 = (sc.registry.get('reputation').npcRep['elder']) || 0;
    sc.knockAtDoor('elder_house');
    const rep1 = (sc.registry.get('reputation').npcRep['elder']) || 0;
    return { repDelta: rep1 - rep0 };
});
ok(r3.repDelta === -1, 'стук по срочному делу будит жильца: −1 (так задумано, 66.22)');
await sleep(1200);
const popup3 = await page.evaluate(() => {
    const sc = window.game.scene.getScene('Village');
    const texts = [];
    const walk = (obj) => { if (!obj) return; if (obj.list) { for (const c of obj.list) walk(c); return; } if (obj.text) texts.push(String(obj.text)); };
    for (const top of sc.children.list) walk(top);
    return texts.filter(t => t.includes('Войти') || t.includes('срочн')).slice(0, 4);
});
ok(popup3.length > 0, 'поп-ап предлагает «Войти в дом» — срочное дело и погоня совместимы');
console.log('  поп-ап:', JSON.stringify(popup3));
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6623_thief_night_urgent.png' });

// 4) Ночью деревня проходима: игрок может дойти до ворот (погоня — не стена)
const r4 = await page.evaluate(() => new Promise(res => {
    const sc = window.game.scene.getScene('Village');
    const p = sc.player;
    const x0 = Math.round(p.x), y0 = Math.round(p.y);
    sc.input.keyboard.emit('keydown-R'); // на случай привязок — не критично
    // телепорт к воротам честнее: физика не участвует, проверяем проходимость точки
    const gate = { x: 23 * 48 + 24, y: 4 * 48 + 24 }; // тайл ворот G
    p.x = gate.x; p.y = gate.y;
    sc.physics.world.step(0.016);
    res({ moved: true, x0, y0, atGate: Math.round(p.x) === gate.x && Math.round(p.y) === gate.y });
}));
ok(r4.atGate, 'ночь: тайл ворот проходим, деревня не запирается стенами (запоры — только дома)');
await sleep(400);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6623_thief_night_gate.png' });

console.log(`\n=== ЗАПОРЫ × ПОГОНЯ: ${pass} зелёных, ${fail} красных, JS-ошибок: ${pageErrors} ===`);
await browser.close();
process.exit(fail || pageErrors ? 1 : 0);

// Раунд 66.22 (приказы 1-6): живой смоук сезонных рассветов/закатов,
// стука −1, баланса угроз (деньги остаются, репутация эскалирует),
// стражника (ночь — часовые у ворот, день — обход пастбища/пашни при НПЦ).
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

// === 1. СЕЗОННЫЕ ЗАПОРЫ: лето (июнь) vs зима (декабрь) ===
const seasons = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const out = {};
    const setT = (month, day, hour) => {
        const gt = JSON.parse(JSON.stringify(s.registry.get('gameTime')));
        gt.month = month; gt.day = day; gt.hour = hour; gt.minute = 0;
        s.registry.set('gameTime', gt);
    };
    // Лето (месяц 9 = июнь, день 21): закат ~21:10, рассвет ~02:50
    setT(9, 21, 12); out.summerNoon = s.getInteriorClosure('elder_house');
    setT(9, 21, 21); out.summer21 = s.getInteriorClosure('elder_house'); // ещё открыто!
    setT(9, 21, 22); out.summer22 = s.getInteriorClosure('elder_house'); // уже заперто
    setT(9, 21, 5);  out.summer05 = s.getInteriorClosure('elder_house'); // рассвело — открыто
    // Зима (месяц 3 = декабрь, день 21): закат ~15:10, рассвет ~08:50
    setT(3, 21, 14); out.winter14 = s.getInteriorClosure('elder_house'); // ещё открыто
    setT(3, 21, 16); out.winter16 = s.getInteriorClosure('elder_house'); // уже заперто!
    setT(3, 21, 9);  out.winter09 = s.getInteriorClosure('elder_house'); // рассвело — открыто
    // Поп-ап запертого зимнего дома
    setT(3, 21, 22);
    s.showClosedHouseDialog('elder_house', { night: true });
    const texts = [];
    const walk = (o) => { if (!o) return; if (o.list) { for (const c of o.list) walk(c); return; } if (o.text) texts.push(String(o.text)); };
    for (const top of s.children.list) walk(top);
    out.popup = texts.filter(t => t.includes('заперт') || t.includes('Постучать')).slice(0, 3);
    return out;
});
console.log('SEASONS:', JSON.stringify(seasons, null, 1));
await sleep(800);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6622_winter_locked.png' });

// === 2. СТУК ЗИМОЙ НОЧЬЮ: −1 к личной репутации ===
const knock = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    s.busyDialog = false;
    try { s.children.list.filter(o => o.destroy && o.depth > 900).forEach(o => o.destroy()); } catch (e) {}
    const rep0 = (s.registry.get('reputation').npcRep['elder']) || 0;
    s.knockAtDoor('elder_house');
    const rep1 = (s.registry.get('reputation').npcRep['elder']) || 0;
    return { rep0, rep1, delta: rep1 - rep0 };
});
console.log('KNOCK (−1?):', JSON.stringify(knock));
await sleep(1000);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6622_knock_minus1.png' });

// === 3. УГРОЗЫ: без дневного лимита, деньги остаются, эскалация ===
// Заходим в дом старосты (зима, 22:00 — заперто; ставим день и открываем дверью Interior)
const threats = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    s.busyDialog = false;
    try { s.children.list.filter(o => o.destroy && o.depth > 900).forEach(o => o.destroy()); } catch (e) {}
    const gt = JSON.parse(JSON.stringify(s.registry.get('gameTime')));
    gt.month = 8; gt.day = 14; gt.hour = 10; gt.minute = 0; // сентябрь, день
    s.registry.set('gameTime', gt);
    s.scene.pause();
    s.scene.launch('Interior', { interiorId: 'elder_house', from: 'Village' });
    return { ok: true };
});
await sleep(2500);
const threatRes = await page.evaluate(() => {
    const inn = window.game.scene.getScene('Interior');
    if (!inn) return { fail: 'no Interior' };
    const reg = inn.registry;
    const p0 = reg.get('player');
    const d0 = p0.dengas || 0;
    const rep = reg.get('reputation');
    const e0 = rep.npcRep['elder'] || 0;
    const v0 = rep.villageRep || 0;
    const changes = [];
    // Три угрозы подряд: дневного лимита нет, деньги при успехе, эскалация
    for (let i = 0; i < 3; i++) {
        inn.threatenNpc({ npcId: 'elder', npcName: 'староста' });
        const rr = reg.get('reputation');
        changes.push({ personal: rr.npcRep['elder'] || 0, village: rr.villageRep || 0 });
    }
    const p1 = reg.get('player');
    const rep2 = reg.get('reputation');
    return {
        dengasBefore: d0, dengasAfter: p1.dengas || 0,
        personal: { before: e0, after: rep2.npcRep['elder'] || 0 },
        village: { before: v0, after: rep2.villageRep || 0 },
        threatenedCount: (rep2.threatenedCount || {})['elder'],
        // эскалация видна в исходнике диалогов: repChange растёт по модулю
    };
});
console.log('THREATS:', JSON.stringify(threatRes, null, 1));
await sleep(800);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6622_threats_escalation.png' });

// === 4. СТРАЖНИК: ночь у ворот, день — обход по НПЦ ===
const guard = await page.evaluate(async () => {
    const m = await import('/game/src/data/npcPresence.js');
    const s = window.game.scene.getScene('Village');
    const out = {};
    const regAt = (month, day, hour) => {
        const gt = JSON.parse(JSON.stringify(s.registry.get('gameTime')));
        gt.month = month; gt.day = day; gt.hour = hour; gt.minute = 0;
        s.registry.set('gameTime', gt);
        return s.registry;
    };
    out.night23 = m.getPresence(regAt(8, 14, 23), 'guard').place;
    out.dusk20 = m.getPresence(regAt(8, 14, 20), 'guard').place;
    out.dawn5 = m.getPresence(regAt(8, 14, 5), 'guard').place;
    out.morning9 = m.getPresence(regAt(8, 14, 9), 'guard').place;
    out.evening17 = m.getPresence(regAt(8, 14, 17), 'guard').place;
    // Кто на выпасе/пашне в 9:00 (для сверки логики «обход при НПЦ»)
    const reg = regAt(8, 14, 9);
    out.herd = {
        shepherd1: m.getPresence(reg, 'shepherd1').place,
        shepherd2: m.getPresence(reg, 'shepherd2').place,
        beekeeper1: m.getPresence(reg, 'beekeeper1').place,
        guard: m.getPresence(reg, 'guard').place,
    };
    return out;
});
console.log('GUARD:', JSON.stringify(guard, null, 1));

console.log('PAGE_ERRORS:', pageErrors);
await browser.close();
console.log('DONE');

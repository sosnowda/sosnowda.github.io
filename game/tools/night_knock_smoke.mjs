// Раунд 66.21 (приказы 9-10): живой смоук ночных запоров и стука в дверь.
// Сценарий: новая игра → ночь 22:00 → дверь жилого дома заперта →
// поп-ап с кнопкой стука → стук = −2 к личной репутации → без срочного дела
// не впускают; с активным поручением от хозяина — впускают.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 250)));

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(6000);
await page.mouse.click(640, 270);
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await page.mouse.click(519, 608);
await sleep(5000);

const res = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    if (!s) return { fail: 'no Village' };
    const out = {};
    // Ночь 22:00 (настройка стенда — как «дождаться ночи»)
    const gt = JSON.parse(JSON.stringify(s.registry.get('gameTime')));
    gt.hour = 22; gt.minute = 0;
    s.registry.set('gameTime', gt);
    // 1) Днём (10:00) дом открыт, ночью — заперт (приказ 9)
    const gtDay = JSON.parse(JSON.stringify(s.registry.get('gameTime')));
    gtDay.hour = 10;
    s.registry.set('gameTime', gtDay);
    out.dayClosed = s.getInteriorClosure('elder_house');
    gtDay.hour = 22;
    s.registry.set('gameTime', gtDay);
    out.nightClosed = s.getInteriorClosure('elder_house');
    // 2) Поп-ап запертого дома (тот же метод, что вызывает клик по двери)
    s.showClosedHouseDialog('elder_house', out.nightClosed);
    const texts = [];
    const walk = (obj) => { if (!obj) return; if (obj.list) { for (const c of obj.list) walk(c); return; } if (obj.text) texts.push(String(obj.text)); };
    for (const top of s.children.list) walk(top);
    out.popupTexts = texts.filter(t => t.includes('заперт') || t.includes('Постучать') || t.includes('Уйти')).slice(0, 6);
    return out;
});
console.log('NIGHT SMOKE 1:', JSON.stringify(res, null, 1));
await sleep(1000);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6621_night_locked.png' });

// 3) Стук: без срочного дела — злость и −2 репутации, не впускают
const knock1 = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const rep0 = (s.registry.get('reputation').npcRep['elder']) || 0;
    s.knockAtDoor('elder_house');
    const rep1 = (s.registry.get('reputation').npcRep['elder']) || 0;
    return { rep0, rep1, delta: rep1 - rep0 };
});
console.log('KNOCK (без дела):', JSON.stringify(knock1));
await sleep(1200);
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6621_night_knock_angry.png' });

// 4) Стук со СРОЧНЫМ делом (активное поручение от старосты) — впускают
const knock2 = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    // закрыть предыдущий поп-ап
    s.busyDialog = false;
    try { s.children.list.filter(o => o.destroy && o.depth > 900).forEach(o => o.destroy()); } catch (e) {}
    const q = s.registry.get('quest') || {};
    q.activeQuests = q.activeQuests || [];
    q.activeQuests.push({
        npcId: 'elder', accepted: true, completed: false, failed: false,
        rewardClaimed: false, isMainQuest: false, title: 'Проверка', type: 'fetch',
    });
    s.registry.set('quest', q);
    s.knockAtDoor('elder_house');
    return { opened: null };
});
console.log('KNOCK (с делом): выполнен — проверяем, что поп-ап предлагает ВОЙТИ');
await sleep(1200);
const popup2 = await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    const texts = [];
    const walk = (obj) => { if (!obj) return; if (obj.list) { for (const c of obj.list) walk(c); return; } if (obj.text) texts.push(String(obj.text)); };
    for (const top of s.children.list) walk(top);
    return texts.filter(t => t.includes('Войти') || t.includes('срочн')).slice(0, 5);
});
console.log('POPUP2:', JSON.stringify(popup2));
await page.screenshot({ path: '/home/z/my-project/site-repo/game/docs/r6621_night_knock_urgent.png' });
await browser.close();
console.log('DONE');

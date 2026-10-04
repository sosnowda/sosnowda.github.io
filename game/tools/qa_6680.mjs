// ЖИВОЙ QA 66.80: ОДОБРЕННЫЙ БАЛАНС РЕПУТАЦИИ И ОПЛАТЫ (порт 8765).
// Секции:
//  A) п.11-в: HUD-статус «(подозрительный)» при репутации −25; лёгкий осмотр
//     у ворот — краденое изымается, БЕЗ виры/поимки/списания репутации;
//  B) п.11-г: епитимья в церкви — кнопка при молве < 0, 50 д., −7 → −2,
//     раз в месяц (кнопка исчезает до следующего месяца);
//  C) п.12-в: «О слове» у гончара — кнопка, уговоры 10 минут, множитель дня,
//     после торга кнопки нет;
//  D) п.11-в: HUD «(свой)» при репутации +30; п.11-а: недельный тик
//     (забывание −5 → −4 при прыжке на неделю) — через живой registry.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/home/z/my-project/download/qa_6680_live';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const jsErrs = [];
page.on('pageerror', e => jsErrs.push(String(e).slice(0, 160)));

const clickText = async (txt, exact = false, timeout = 9000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt, exact }) => {
            const g = window.game; if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                    if (obj.text && obj.text.trim && !obj.input?.disabled) {
                        const tt = obj.text.trim();
                        if (exact ? tt === txt : tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    }
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) { const cam = s.cameras?.main; const z = cam?.zoom || 1; return { x: Math.round((r.x - (cam?.scrollX || 0)) / z), y: Math.round((r.y - (cam?.scrollY || 0)) / z) }; }
                }
            }
            return null;
        }, { txt, exact });
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(420); return true; }
        await sleep(220);
    }
    return false;
};
const texts = async (sceneName = null) => page.evaluate((sceneName) => {
    const g = window.game; if (!g) return null;
    const out = [];
    const scenes = sceneName ? [g.scene.getScene(sceneName)].filter(Boolean) : g.scene.scenes;
    for (const s of scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const walk = (o) => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim) out.push(o.text.trim()); };
        s.children.list.forEach(walk);
    }
    return out;
}, sceneName);
const state = async () => page.evaluate(() => {
    const s = window.game.scene.scenes.find(x => x.registry && x.registry.get('player'));
    const r = s.registry;
    const p = r.get('player'); const rep = r.get('reputation') || {}; const gt = r.get('gameTime');
    return {
        dengas: p?.dengas || 0, villageRep: rep.villageRep || 0,
        inv: (p?.inventory || []).map(i => ({ id: i.id, count: i.count, stolen: !!i.stolen })),
        caughtCount: r.get('justiceState')?.caughtCount || 0,
        wageDeal: r.get('wageDealState') || null,
        absolutionMonth: r.get('absolutionMonthKey') || null,
        time: gt ? `${gt.day}д ${gt.hour}:${String(gt.minute).padStart(2, '0')}` : null,
        log: ((r.get('actionLog')?.entries) || []).slice(-8).map(e => String(e.action || '')),
    };
});
const setReg = async (code) => page.evaluate(new Function(`
    for (const s of window.game.scene.scenes) {
        if (!s || !s.registry) continue;
        const r = s.registry;
        ${code}
    }
`));
const setTime = async (h, minute = 0) => setReg(`{ const gt = r.get('gameTime'); if (gt) { gt.hour = ${h}; gt.minute = ${minute}; r.set('gameTime', gt); } }`);
const setRep = async (v) => setReg(`{ const rep = r.get('reputation'); if (rep) { rep.villageRep = ${v}; r.set('reputation', rep); } }`);
const enter = async (iid) => page.evaluate((iid) => {
    const v = window.game.scene.getScene('Village');
    v.scene.launch('Interior', { interiorId: iid, from: 'Village' });
}, iid);
const exitInt = async () => page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    if (s && s.scene.isActive()) s.scene.stop();
    const v = window.game.scene.getScene('Village');
    if (v && !v.scene.isActive()) v.scene.start('Village');
});
const gateExit = async () => page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    if (v && v.scene.isActive()) v.exitVillageThroughGate();
});
const backToVillage = async () => page.evaluate(() => {
    // из развилки (Fork) назад в деревню без часа дороги — QA-вызов сцены
    for (const s of window.game.scene.scenes) {
        if (s && s.scene.isActive() && s.scene.key === 'Fork') s.scene.start('Village');
    }
});
const shot = (n) => page.screenshot({ path: `${OUT}/${n}` });

// ===== СТАРТ =====
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);
ok(await clickText('Новая игра', true), '«Новая игра»');
await sleep(1000);
ok(await clickText('Ярополк', false, 9000), 'Герой Ярополк');
await sleep(1000);
ok(await clickText('Начать игру', true), '«Начать игру»');
await sleep(5000);
await setReg(`
    const p = r.get('player');
    if (p) { p.skills = p.skills || {}; p.skills.persuade = 95; p.skills.stealth = 95; p.skills.lockpicking = 95; p.dengas = 100; r.set('player', p); }
    const q = r.get('quest'); if (q) { q.tutorialStep = 3; r.set('quest', q); }
    const gt = r.get('gameTime'); if (gt) { gt.hour = 12; gt.minute = 0; r.set('gameTime', gt); }
`);
await setTime(12);

// ===== A) HUD «(подозрительный)» + ЛЁГКИЙ ОСМОТР У ВОРОТ =====
console.log('\n=== A) п.11-в: лестница статусов и лёгкий осмотр ===');
await setRep(-25);
await page.evaluate(() => { const v = window.game.scene.getScene('Village'); if (v && v.scene.isActive()) v.updateHUD(); });
await sleep(600);
let hud = await texts('Village');
ok(hud && hud.some(t => t.includes('Деревня') && t.includes('(подозрительный)')), 'HUD: «⭐Деревня: −25 (подозрительный)»');
await shot('qa80_a1_hud_suspicious.png');

// краденая вещь в узел (живой registry) и выход через ворота
await setReg(`
    const p = r.get('player');
    p.inventory = [
        { id: 'ubrus', name: 'Убрус холщовый', count: 1, stolen: true, from: 'weaver_house', type: 'loot' },
        { id: 'fish_dried', name: 'Рыба сушёная', count: 1, stolen: false, type: 'food' },
    ];
    r.set('player', p);
`);
const beforeGate = await state();
await gateExit();
await sleep(1200);
let tx = await texts();
ok(tx && tx.some(t => t.includes('Осмотр у ворот')), 'Ворота: стражник остановил «подозрительного» на осмотр');
ok(tx && tx.some(t => t.includes('Убрус')), 'Список чужого добра в поп-апе');
await shot('qa80_a2_light_search.png');
await clickText('Отойти от ворот');
await sleep(900);
const afterGate = await state();
ok(afterGate.inv.some(i => i.stolen) === false, 'Краденое изъято осмотром');
ok(afterGate.inv.some(i => !i.stolen), 'Честное имущество не тронуто');
ok(afterGate.dengas === beforeGate.dengas, `Денег НЕ взяли (${beforeGate.dengas} → ${afterGate.dengas})`);
ok(afterGate.caughtCount === 0, 'Это НЕ поимка: caughtCount = 0');
ok(afterGate.villageRep === -25, 'Репутация не списана (−25)');
ok(afterGate.log.some(l => l.includes('отобрал краденое')), 'Летопись: «Стражник… отобрал краденое»');
await backToVillage();
await sleep(1200);

// ===== B) ЕПИТИМЬЯ В ЦЕРКВИ =====
console.log('\n=== B) п.11-г: замолить грехи (50 д., раз в месяц) ===');
await setRep(-7);
await setTime(10); // утром священник в церкви (обед 12–13 — в корчме)
await enter('church');
await sleep(2400);
tx = await texts();
ok(tx && tx.some(t => t.includes('Замолить грехи (50 д.)')), 'Церковь: кнопка «Замолить грехи (50 д.)» видна при молве < 0');
await shot('qa80_b1_absolution_button.png');
await clickText('Замолить грехи (50 д.)');
await sleep(1200);
tx = await texts();
ok(tx && tx.some(t => t.includes('Грехи замолены')), 'Поп-ап: «Грехи замолены»');
await shot('qa80_b2_absolution_done.png');
await clickText('Низко поклониться');
await sleep(700);
let stB = await state();
ok(stB.villageRep === -2, `Репутация −7 → −2 (факт: ${stB.villageRep})`);
ok(stB.dengas === beforeGate.dengas - 50, `Епитимья списала 50 д. (факт: ${stB.dengas})`);
ok(stB.absolutionMonth !== null, 'Месяц епитимьи запомнен');
await exitInt();
await sleep(1200);
// кнопка исчезла до следующего месяца
await enter('church');
await sleep(2200);
tx = await texts();
ok(tx && !tx.some(t => t.includes('Замолить грехи')), 'Повторно в этом месяце кнопки НЕТ');
await exitInt();
await sleep(1200);

// ===== C) «О СЛОВЕ» У ГОНЧАРА =====
console.log('\n=== C) п.12-в: торг о ставке «О слове» ===');
await setTime(14);
await enter('potter_house');
await sleep(2400);
tx = await texts();
ok(tx && tx.some(t => t.includes('О слове (Убеждение)')), 'Мастерская гончара: кнопка «О слове (Убеждение)» есть');
const timeBeforeC = (await state()).time;
await shot('qa80_c1_wage_deal_button.png');
ok(await clickText('О слове (Убеждение)'), 'Клик: уговоры о ставке');
await sleep(1200);
tx = await texts();
ok(tx && tx.some(t => t.includes('О слове') && (t.includes('Убеждение') || t.includes('ставка'))), 'Поп-ап торга с встречной проверкой');
await shot('qa80_c2_wage_deal_result.png');
await clickText('Договорились');
await sleep(700);
const stC = await state();
ok(stC.wageDeal && stC.wageDeal.npcId === 'potter1', `Торг записан за гончаром (${stC.wageDeal?.npcId})`);
ok(stC.wageDeal && [1, 1.25, 1.5].includes(stC.wageDeal.mult), `Множитель дня корректен (×${stC.wageDeal?.mult})`);
ok(stC.time !== timeBeforeC, `Уговоры списали 10 минут (${timeBeforeC} → ${stC.time})`);
await exitInt();
await sleep(1200);
await enter('potter_house');
await sleep(2200);
tx = await texts();
ok(tx && !tx.some(t => t.includes('О слове (Убеждение)')), 'После торга кнопки «О слове» НЕТ (раз в сутки)');
await exitInt();
await sleep(1200);

// ===== D) HUD «(свой)» + НЕДЕЛЬНОЕ ЗАБЫВАНИЕ (живой registry) =====
console.log('\n=== D) п.11-в/а: статус «свой» + недельный тик ===');
await setRep(30);
await page.evaluate(() => { const v = window.game.scene.getScene('Village'); if (v && v.scene.isActive()) v.updateHUD(); });
await sleep(600);
hud = await texts('Village');
ok(hud && hud.some(t => t.includes('Деревня') && t.includes('(свой)')), 'HUD: «⭐Деревня: +30 (свой)»');
await shot('qa80_d1_hud_own.png');
await setRep(-5);
await page.evaluate(() => {
    //.registry глобальный — применяем ОДИН раз (не в цикле по сценам)
    const r = window.game.scene.getScene('Village').registry;
    const gt = r.get('gameTime');
    const abs = (gt.yearFromChrist * 372) + (gt.month * 31) + gt.day;
    r.set('repForgetState', { weekKey: Math.floor(abs / 7) });
});
await page.evaluate(() => {
    const r = window.game.scene.getScene('Village').registry;
    const gt = r.get('gameTime');
    gt.day += 8; r.set('gameTime', gt); // ровно +1 неделя и 1 день
});
await enter('potter_house'); // вход в сцену = create() = ленивый недельный тик
await sleep(2200);
await exitInt();
await sleep(1200);
const stD = await state();
ok(stD.villageRep === -4, `Молва забывает мелкие обиды: −5 → −4 (факт: ${stD.villageRep})`);
ok(stD.log.some(l => l.includes('забывает мелкие обиды')), 'Летопись: «деревня помаленьку забывает мелкие обиды»');
await shot('qa80_d2_weekly_forget.png');

// ===== ИТОГ =====
console.log('\n=== Итог ===');
ok(jsErrs.length === 0, `0 JS-ошибок (${jsErrs.length})`);
if (jsErrs.length) console.log(jsErrs.slice(0, 5));
const result = { pass, fail, jsErrs, timestamp: new Date().toISOString() };
fs.writeFileSync(`${OUT}/qa80_result.json`, JSON.stringify(result, null, 2));
console.log(`\n=== QA 66.80: ${pass} ✓ / ${fail} ✗ ===`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);

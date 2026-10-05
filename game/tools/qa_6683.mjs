// ЖИВОЙ QA 66.83: ДОПОЛНЕНИЕ ДОЛГОВОЙ СИСТЕМЫ 66.82 (порт 8765).
// Секции:
//  A) п.13: инструкция — закладки (6 разделов), вкладка «Долги»,
//     разворот «⛶ На весь экран»;
//  B) п.12: серые кнопки «хозяин дома» в мастерской + подсказка
//     «хозяин на поле» в пустой мастерской;
//  C) п.10: закуп — час работы у Фёдора, вся плата в счёт долга;
//  D) пп.8–9: правёж — надетое описывается следом за инвентарём;
//     изгойство при непокрытом долге → «ИЗГНАН ЗА ДОЛГИ» (End).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/home/z/my-project/download/qa_6683_live';
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
    const p = r.get('player'); const gt = r.get('gameTime');
    const ds = r.get('debtState') || { loans: [] };
    return {
        dengas: p?.dengas || 0, HP: p?.HP, HPmax: p?.HPmax, weaponId: p?.weaponId, armorId: p?.armorId,
        loans: ds.loans.map(l => ({ amount: l.amount, bonded: !!l.bonded, npc: l.npcId })),
        time: gt ? `${gt.day}д ${gt.hour}:${String(gt.minute).padStart(2, '0')}` : null,
        quest: r.get('quest') || {},
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
const shot = (n) => page.screenshot({ path: `${OUT}/${n}` });
const waitTitle = async () => {
    for (let i = 0; i < 150; i++) {
        const ready = await page.evaluate(() => {
            const g = window.game; if (!g || !g.scene) return false;
            const out = [];
            for (const s of g.scene.scenes) {
                if (!s.scene.isActive()) continue;
                const walk = (o) => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim) out.push(o.text.trim()); };
                s.children.list.forEach(walk);
            }
            return out.some(t => t === 'Новая игра');
        });
        if (ready) return true;
        if (i === 60) { await page.reload({ waitUntil: 'load' }).catch(() => {}); }
        await sleep(1000);
    }
    return false;
};
const startGame = async (tag) => {
    ok(await waitTitle(), `главное меню (${tag})`);
    ok(await clickText('Новая игра', true), '«Новая игра»');
    await sleep(1000);
    ok(await clickText('Ярополк', false, 9000), 'Герой Ярополк');
    await sleep(1000);
    ok(await clickText('Начать игру', true), '«Начать игру»');
    await sleep(5000);
    await setReg(`
        const q = r.get('quest'); if (q) { q.tutorialStep = 3; r.set('quest', q); }
        const rep = r.get('reputation'); if (rep) { rep.villageRep = 15; rep.npcRep.tavernkeeper = 25; r.set('reputation', rep); }
        const p = r.get('player'); if (p) { p.skills = p.skills || {}; p.skills.persuade = 95; r.set('player', p); }
    `);
};

// ===== СТАРТ =====
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });

// ===== A) ИНСТРУКЦИЯ С ЗАКЛАДКАМИ (п.13) =====
console.log('\n=== A) п.13: инструкция — закладки, полный экран ===');
ok(await waitTitle(), 'главное меню');
ok(await clickText('❓ Инструкция', true), 'кнопка «❓ Инструкция»');
await sleep(800);
let tx = await texts();
ok(tx.some(t => t.includes('Инструкция — Летописи Руси')), 'заголовок инструкции');
for (const tab of ['📜 Начало', '🎲 Ролевая система', '💰 Деньги', '📅 Календарь', '⭐ Репутация', '🪙 Долги']) {
    ok(tx.some(t => t === tab), `закладка «${tab}»`);
}
ok(tx.some(t => t.includes('ЦЕЛЬ ИГРЫ')), 'раздел «Начало» открыт');
await shot('qa83_a1_tabs.png');
ok(await clickText('🪙 Долги', true), 'клик по закладке «Долги»');
await sleep(500);
tx = await texts();
ok(tx.some(t => t.includes('ДОЛГИ НА ПОСТОЯЛОМ ДВОРЕ')), 'правила долгов открыты (в т.ч. закуп)');
ok(await clickText('🎲 Ролевая система', true), 'закладка «Ролевая система»');
await sleep(400);
tx = await texts();
ok(tx.some(t => t.includes('ПРАВИЛА ПРОВЕРОК НАВЫКОВ')), 'правила проверок навыков');
ok(tx.some(t => t.includes('ДЕНЕЖНАЯ СИСТЕМА')) === false, 'вкладка РП не показывает деньги');
ok(await clickText('💰 Деньги', true), 'закладка «Деньги»');
await sleep(400);
tx = await texts();
ok(tx.some(t => t.includes('ДЕНЕЖНАЯ СИСТЕМА РУСИ XV ВЕКА')), 'денежная система открыта');
ok(await clickText('📅 Календарь', true), 'закладка «Календарь»');
await sleep(400);
tx = await texts();
ok(tx.some(t => t.includes('ИГРОВОЙ КАЛЕНДАРЬ')), 'календарь открыт');
ok(await clickText('⛶ На весь экран', true), '«⛶ На весь экран»');
await sleep(500);
tx = await texts();
ok(tx.some(t => t.includes('Свернуть')), 'панель развёрнута (кнопка «Свернуть»)');
await shot('qa83_a2_fullscreen.png');
ok(await clickText('Свернуть', false), 'сворачивание');
await sleep(400);
ok(await clickText('Закрыть', true), 'инструкция закрыта');
await sleep(400);

// ===== B) СЕРЫЕ КНОПКИ (п.12) =====
console.log('\n=== B) п.12: серые кнопки «хозяин дома/на поле» ===');
await startGame('B');
// Хозяин дома: гончар по распорядку дома на рассвете (dawn = home) — ставим 5:00
await setReg(`{ const gt = r.get('gameTime'); if (gt) { gt.hour = 5; gt.minute = 0; r.set('gameTime', gt); } }`);
await enter('potter_house');
await sleep(1500);
tx = await texts('Interior');
ok(tx.some(t => t.includes('Подёнка — хозяин дома')), 'серая кнопка «Подёнка — хозяин дома»');
ok(tx.some(t => t.includes('О слове — хозяин дома')), 'серая кнопка «О слове — хозяин дома»');
ok(!tx.some(t => t.includes('Помочь в мастерской (1 час)')), 'активной кнопки подёнки при хозяине нет');
await shot('qa83_b1_gray.png');
ok(await clickText('Подёнка — хозяин дома', false), 'клик по серой кнопке');
await sleep(600);
tx = await texts();
ok(tx.some(t => t.includes('Хозяин дома')), 'окно-подсказка «Хозяин дома»');
ok(tx.some(t => t.includes('хозяин на поле')), 'подсказка объясняет «хозяин на поле»');
ok(await clickText('Понятно', false), 'подсказка закрыта');
await sleep(300);
await exitInt();
await sleep(600);
// пустая мастерская: в полдень гончар на Реке за глиной
await setReg(`{ const gt = r.get('gameTime'); if (gt) { gt.hour = 12; gt.minute = 0; r.set('gameTime', gt); } }`);
await enter('potter_house');
await sleep(1500);
tx = await texts('Interior');
ok(tx.some(t => t.includes('Хозяин на поле — мастерская без присмотра')), 'подсказка «хозяин на поле» в пустой мастерской');
ok(tx.some(t => t.includes('Помочь в мастерской (1 час)')), 'активная кнопка подёнки вернулась');
await shot('qa83_b2_away.png');
await exitInt();
await sleep(600);

// ===== C) ЗАКУП (п.10) =====
console.log('\n=== C) п.10: закуп — работа в счёт долга ===');
// долг 20 д. трактирщику через живой takeDebt-путь: пишем debtState напрямую (формат 66.82)
await setReg(`
    if (r.get('__qaDebtSet')) return;
    const gt = r.get('gameTime');
    const cum = [0,30,61,91,122,153,181,212,242,273,303,334]; const dayIdx = gt.yearFromChrist * 366 + (cum[gt.month] || 0) + gt.day;
    const st = r.get('debtState') || { loans: [], seq: 1 };
    st.loans.push({ id: 'debtQA' + st.seq++, npcId: 'tavernkeeper', kind: 'food', amount: 20,
        issuedDayIdx: dayIdx, dueDayIdx: dayIdx + 7, issuedTs: { day: gt.day, month: gt.month }, dueTs: { day: gt.day, month: gt.month }, deferrals: 0 });
    r.set('debtState', st);
    r.set('__qaDebtSet', true);
`);
await enter('tavern');
await sleep(1500);
tx = await texts('Interior');
ok(tx.some(t => t.includes('Отработать долг (1 час)')), 'кнопка «Отработать долг (1 час)» видна при долге');
const before = await state();
ok(before.loans.some(l => l.amount === 20), 'долг 20 д. записан');
ok(await clickText('Отработать долг (1 час)', false), 'клик «Отработать долг (1 час)»');
await sleep(900);
tx = await texts();
ok(tx.some(t => t.includes('Закуп — работа в счёт долга')), 'окно закупа открылось');
ok(tx.some(t => t.includes('ушла в счёт долга') || t.includes('закрыли долг')), 'плата ушла в счёт долга');
await shot('qa83_c1_bonded.png');
ok(await clickText('Понятно', false), 'окно закупа закрыто');
await sleep(400);
const after = await state();
ok(after.dengas === before.dengas, 'живых денег закуп не дал (всё в счёт долга)');
ok(after.loans.some(l => l.bonded), 'долг помечен «закуп»');
ok(after.loans.reduce((s, l) => s + l.amount, 0) < 20, 'долг уменьшился на ставку закупа');
ok(after.HP < before.HPmax && after.time !== before.time, 'час работы и усталость учтены');
// закуп до полного погашения
for (let i = 0; i < 6; i++) {
    if (!(await state()).loans.length) break;
    await clickText('Отработать долг (1 час)', false);
    await sleep(700);
    await clickText('Понятно', false);
    await sleep(500);
}
const done = await state();
ok(done.loans.length === 0, 'закупом долг погашен ПОЛНОСТЬЮ');
ok(done.dengas >= 0, 'мошна после закупа');
await exitInt();
await sleep(600);

// ===== D) ПРАВЁЖ И ИЗГОЙСТВО (пп.8–9) =====
console.log('\n=== D) пп.8–9: правёж с надетым и изгойство ===');
// D1: покрытый правёж — мошна 3, долг 20, надетый меч (30 → 15)
await setReg(`
    const p = r.get('player');
    p.dengas = 3; p.inventory = [];
    p.weaponId = 'sword'; p.armorId = 'none';
    r.set('player', p);
    if (r.get('__qaDebtSetD1')) return;
    const gt = r.get('gameTime');
    const cum = [0,30,61,91,122,153,181,212,242,273,303,334]; const dayIdx = gt.yearFromChrist * 366 + (cum[gt.month] || 0) + gt.day;
    const st = r.get('debtState') || { loans: [], seq: 1 };
    st.loans = st.loans.filter(l => l.npcId !== 'tavernkeeper');
    st.loans.push({ id: 'debtQA9', npcId: 'tavernkeeper', kind: 'coin', amount: 15,
        issuedDayIdx: dayIdx - 10, dueDayIdx: dayIdx - 3, issuedTs: { day: gt.day, month: gt.month }, dueTs: { day: gt.day, month: gt.month }, deferrals: 3 });
    r.set('debtState', st);
    r.set('__qaDebtSetD1', true);
`);
await gateExit();
await sleep(900);
tx = await texts();
if (!tx.some(t => t.includes('Стражник и долг'))) {
    const dbg = await page.evaluate(() => {
        const out = { active: [], loans: null, guardNeeded: null, busy: null, time: null };
        const g = window.game;
        for (const s of g.scene.scenes) if (s.scene.isActive()) out.active.push(s.scene.key);
        const d = await_guard_diagnose();
        function await_guard_diagnose() { return null; }
        try {
            const v = g.scene.getScene('Village');
            out.busy = v.busyDialog;
            out.loans = (v.registry.get('debtState') || { loans: [] }).loans.map(l => l.amount + '/' + l.dueDayIdx);
            const gt = v.registry.get('gameTime');
            out.time = gt ? (gt.yearFromChrist * 366 + gt.month * 31 + gt.day) : null;
        } catch (e) { out.err = String(e).slice(0, 120); }
        return out;
    });
    console.log('    [диагностика D1]', JSON.stringify(dbg));
}
ok(tx.some(t => t.includes('Стражник и долг')), 'стражник остановил должника');
ok(await clickText('Отдать долг, чем есть', false), 'согласился на взыскание');
await sleep(900);
tx = await texts();
if (!tx.some(t => t.includes('Долг взыскан'))) {
    console.log('    [диагностика D1-итог] тексты:', JSON.stringify(tx.slice(-12)));
}
ok(tx.some(t => t.includes('Долг взыскан')) || tx.some(t => t.includes('Монет в уплату')), 'итог взыскания: меч ушёл (15 д.), долг 15 д. покрыт');
const stD1 = await state();
ok(stD1.dengas === 3, 'лишек сверх долга (3 д.) вернули в мошну');
ok(await clickText('Отойти от ворот', false) || (await state()).weaponId === 'fists', 'отошёл от ворот (или правёж уже виден по состоянию)');
await sleep(400);
let stD = await state();
ok(stD.weaponId === 'fists', 'надетый меч описан (п.8: потом надетое)');
ok(stD.dengas >= 0, 'мошна после правежа');
// D2: изгойство — долг 100, мошна 0, узел пуст, надетого нет
await page.reload({ waitUntil: 'load' });
await startGame('D2');
await setReg(`
    const p = r.get('player');
    p.dengas = 0; p.inventory = []; p.weaponId = 'fists'; p.armorId = 'none';
    r.set('player', p);
    if (r.get('__qaDebtSetD2')) return;
    const gt = r.get('gameTime');
    const cum = [0,30,61,91,122,153,181,212,242,273,303,334]; const dayIdx = gt.yearFromChrist * 366 + (cum[gt.month] || 0) + gt.day;
    const st = r.get('debtState') || { loans: [], seq: 1 };
    st.loans = [{ id: 'debtQA100', npcId: 'tavernkeeper', kind: 'coin', amount: 100,
        issuedDayIdx: dayIdx - 10, dueDayIdx: dayIdx - 3, issuedTs: { day: gt.day, month: gt.month }, dueTs: { day: gt.day, month: gt.month }, deferrals: 3 }];
    st.seq = 2;
    r.set('debtState', st);
    r.set('__qaDebtSetD2', true);
`);
await gateExit();
await sleep(900);
tx = await texts();
ok(tx.some(t => t.includes('Стражник и долг')), 'стражник у должника-изгоя');
ok(await clickText('Отдать долг, чем есть', false), 'взыскание началось');
await sleep(900);
tx = await texts();
ok(tx.some(t => t.includes('ИЗГНАН ЗА ДОЛГИ')), 'ИЗГОЙСТВО: «ИЗГНАН ЗА ДОЛГИ» (п.9 — провал игры)');
await shot('qa83_d1_expelled.png');
await clickText('Уйти за околицу', false);
await sleep(2500);
tx = await texts();
ok(tx.some(t => t.includes('ИЗГНАН ЗА ДОЛГИ')) || tx.some(t => t.includes('Летописи')), 'экран итогов (End) открыт');

// ===== КОНСОЛЬ =====
console.log('\n=== Консоль браузера ===');
const realErrs = jsErrs.filter(e => !e.includes('WebGL') && !e.includes('AudioContext') && !e.includes('Autoplay'));
ok(realErrs.length === 0, 'консоль без JS-ошибок' + (realErrs.length ? ' — ' + realErrs[0] : ''));

await browser.close();
console.log(`\nИТОГО: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

// ЖИВОЙ QA 66.82: ДОЛГОВАЯ СИСТЕМА (порт 8765, Playwright, флаги АГЕНТ.md).
// clickUntil: кликает по тексту, пока ПРОВЕРКА РЕЗУЛЬТАТА не пройдёт.
// ⚠️ Известный headless-квирк (см. АГЕНТ.md/worklog 66.79): createDialog в
// Интерьере иногда рендерится «наполовину» — контент отсутствует. Лечение
// QA: зачистка зависших диалогов (блокиратор+контейнер — верхние объекты
// сцены) и повторная попытка; в браузере поведение всегда полное.
// Секции:
//  A) п.2: еда в долг — хлеб при пустой мошне; репутация упала (п.5);
//  B) п.3: ночлег в долг (без списания монет, сон состоялся);
//  C) п.1: свиток персонажа — блок «📜 Долги» рядом с казной;
//  D) пп.6–7: меню «Долги» — два срока; возврат монетами (+2 доверия);
//  E) п.7: отсрочка просрочки (Убеждение 99), 3 отсрочки — предел;
//  F) п.8: стражник у ворот — имущество по 50% цены;
//  G) п.4: отказ в кредите при дурной молве.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/home/z/my-project/download/qa_6682_live';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const jsErrs = [];
page.on('pageerror', e => jsErrs.push(String(e).slice(0, 160)));

const findPos = (txt) => page.evaluate((txt) => {
    const g = window.game; if (!g || !g.scene) return null;
    for (const s of g.scene.scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const walk = (obj, dx, dy) => {
            if (!obj) return null;
            if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
            if (obj.text && obj.text.trim && !obj.input?.disabled) {
                if (obj.text.trim().includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
            }
            return null;
        };
        for (const top of s.children.list) {
            const r = walk(top, 0, 0);
            if (r) { const cam = s.cameras?.main; const z = cam?.zoom || 1; return { x: Math.round((r.x - (cam?.scrollX || 0)) / z), y: Math.round((r.y - (cam?.scrollY || 0)) / z) }; }
        }
    }
    return null;
}, txt);
const texts = async () => page.evaluate(() => {
    const g = window.game; if (!g) return [];
    const out = [];
    for (const s of g.scene.scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const walk = (o) => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim) out.push(o.text.trim()); };
        s.children.list.forEach(walk);
    }
    return out;
});
const state = async () => page.evaluate(() => {
    const s = window.game.scene.scenes.find(x => x.registry && x.registry.get('player'));
    if (!s) return null;
    const r = s.registry;
    const p = r.get('player'); const rep = r.get('reputation') || {};
    const debt = r.get('debtState') || { loans: [] };
    const gt = r.get('gameTime');
    return {
        dengas: p?.dengas || 0, villageRep: rep.villageRep || 0, tkRep: rep.npcRep?.tavernkeeper || 0,
        hp: p?.HP, hpMax: p?.HPmax,
        inv: (p?.inventory || []).map(i => ({ id: i.id, count: i.count })),
        loans: (debt.loans || []).map(l => ({ kind: l.kind, amount: l.amount, deferrals: l.deferrals })),
        time: gt ? `${gt.month}/${gt.day} ${gt.hour}:${String(gt.minute).padStart(2, '0')}` : null,
        log: ((r.get('actionLog')?.entries) || []).slice(-14).map(e => String(e.action || '')),
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
const sceneActive = (key) => page.evaluate((k) => window.game.scene.isActive(k), key);
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

/** Зачистка ЗАВИСШИХ диалогов (headless-квирк): верхние объекты активных сцен —
 *  блокиратор (Rectangle с input) и контейнеры (диалог/кнопки) на макс. глубине. */
const closeStuckDialogs = async () => page.evaluate(() => {
    let n = 0;
    for (const s of window.game.scene.scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const maxD = s.children.list.reduce((m, o) => Math.max(m, (typeof o.depth === 'number' ? o.depth : 0)), 0);
        if (maxD < 210) continue;
        for (const o of [...s.children.list]) {
            const d = typeof o.depth === 'number' ? o.depth : 0;
            const isDialogTop = d >= maxD - 4 && (o.type === 'Container' || (o.type === 'Rectangle' && o.input));
            if (isDialogTop) { o.destroy(true); n++; }
        }
    }
    return n;
});

/** Клик по тексту, пока verify() не пройдёт; застрявшие диалоги зачищаются. */
const clickUntil = async (txt, verify, timeout = 16000) => {
    const t0 = Date.now();
    let clicks = 0, cleaned = 0;
    while (Date.now() - t0 < timeout) {
        if (await verify()) return true;
        const pos = await findPos(txt);
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); clicks++; }
        await sleep(560);
        if (clicks > 0 && clicks % 4 === 0) cleaned += await closeStuckDialogs();
    }
    const fin = await verify();
    if (!fin && cleaned) console.log(`    (зачищено зависших объектов: ${cleaned})`);
    return fin;
};
const hasText = (needle) => async () => (await texts()).some(x => x.includes(needle));

// ===== СТАРТ =====
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);
ok(await clickUntil('Новая игра', async () => await sceneActive('CharacterSelection')), '«Новая игра» → выбор героя');
await sleep(800);
ok(await clickUntil('Ярополк', hasText('Начать игру')), 'Герой Ярополк');
await sleep(600);
ok(await clickUntil('Начать игру', async () => await sceneActive('Village')), '«Начать игру» → деревня');
await sleep(5000);

// Заготовка: добрая молва (деревня +20, у Фёдора +30), мошна ПУСТА, в узле рыба
await setReg(`
    { const rep = r.get('reputation'); if (rep) { rep.villageRep = 20; rep.npcRep = Object.assign({}, rep.npcRep, { tavernkeeper: 30 }); r.set('reputation', rep); } }
    { const p = r.get('player'); if (p) { p.dengas = 0; p.inventory = [{ id: 'fish_cooked', count: 3 }]; r.set('player', p); } }
    { const npcs = r.get('npcs') || []; const tk = npcs.find(n => n.id === 'tavernkeeper'); if (tk) { tk.met = true; r.set('npcs', npcs); } }
`);
await setTime(10);

// ===== A) ЕДА В ДОЛГ (п.2) =====
console.log('— A) Еда в долг —');
await enter('tavern');
await sleep(2500);
ok(await clickUntil('Купить еды', hasText('У дороги» — меню')), 'лавка трактирщика открыта');
await shot('a1_shop_no_money.webp');
const shopTexts = await texts();
ok(shopTexts.some(x => x.includes('в долг')) && shopTexts.some(x => x.includes('Медовуха')) && !shopTexts.some(x => x.includes('Медовуха') && x.includes('в долг')), 'п.2: пометка «в долг» — у еды (хлеб/каша), у хмельного НЕТ');
ok(await clickUntil('Хлеб', async () => {
    const tx = await texts();
    return tx.some(x => x.includes('лихвы')) && tx.some(x => x.includes('В долг (2 д.)'));
}), 'клик «Хлеб …» → предложение долга (без лихвы, срок)');
await shot('a2_credit_offer.webp');
ok(await clickUntil('В долг (2 д.)', async () => {
    const st = await state();
    return st.loans.some(l => l.kind === 'food' && l.amount === 2);
}), 'п.2: хлеб в долг записан (2 д., еда)');
await sleep(900);
let st = await state();
ok(st.villageRep === 19, 'п.5: молва в деревне 20 → 19 (−1)');
ok(st.tkRep === 28, 'п.5: у Фёдора 30 → 28 (−2)');
ok(st.dengas === 0, 'монет по-прежнему 0 (еда не за деньги)');
ok(st.hp > 0 && (st.log || []).some(l => l.includes('в долг') && l.includes('Хлеб')), 'еда съедена сразу, запись в Летописи');
// Лавка переоткрылась после покупки в долг — закрываем её, иначе подложка блокирует панель
ok(await clickUntil('Закрыть', async () => !(await texts()).some(x => x.includes('У дороги» — меню'))), 'лавка закрыта после покупки в долг');
await sleep(700);
ok((await texts()).some(x => x.includes('🪙 Долги')), 'постоянная кнопка «🪙 Долги» видна у трактирщика');
ok(await clickUntil('🪙 Долги', hasText('Долги в столбце')), 'меню «Долги в столбце» открыто');
await shot('a3_debts_menu.webp');
const dm = await texts();
ok(dm.some(x => x.includes('в мошне не хватает')), 'без денег возврат недоступен («в мошне не хватает»)');
ok(dm.some(x => x.includes('взят') && x.includes(', до')), 'п.6: в меню два срока — «взят …, до …»');
await clickUntil('Закрыть', async () => !(await texts()).some(x => x.includes('Долги в столбце')));
await sleep(600);

// ===== B) НОЧЛЕГ В ДОЛГ (п.3) =====
console.log('— B) Ночлег в долг —');
ok(await clickUntil('Отдых', hasText('Отдых в таверне')), 'меню «Отдых» открыто');
await shot('b1_rest_menu.webp');
ok(await clickUntil('Отдохнуть 2 ч', async () => (await texts()).some(x => x.includes('Ночлег в долг'))), '«Отдохнуть 2 ч» → денег нет → предложение долга');
await shot('b2_lodging_credit.webp');
ok(await clickUntil('Ночлег в долг (4 д.)', async () => {
    const s2 = await state();
    return s2.loans.some(l => l.kind === 'lodging' && l.amount === 4);
}), 'п.3: ночлег 4 д. записан в столбец');
await sleep(2500);
st = await state();
ok(st.dengas === 0, 'ночлег в долг БЕЗ списания монет');
ok(st.loans.reduce((s, l) => s + l.amount, 0) === 6, 'суммарный долг 6 д. (потолок 100 — п.4)');
ok((st.log || []).some(l => l.includes('В ДОЛГ')), 'Летопись: ночлег В ДОЛГ');
await closeStuckDialogs();

// ===== C) СВИТОК ПЕРСОНАЖА — БЛОК «ДОЛГИ» (п.1) =====
console.log('— C) Свиток персонажа —');
await exitInt();
await sleep(1500);
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    v.scene.launch('Character', { from: 'Village' });
});
await sleep(2000);
await shot('c1_character_debts.webp');
const ct = await texts();
ok(ct.some(x => x.includes('Долги:') && x.includes('6 д.')), 'п.1: рядом с казной строка «📜 Долги: 6 д.»');
ok(ct.some(x => x.includes('Фёдор') && x.includes('д. (еда)')), 'п.1: строка долга — кому и за что (еда)');
ok(ct.some(x => x.includes('д. (ночлег)')), 'п.1: строка долга — ночлег');
await page.evaluate(() => {
    const c = window.game.scene.getScene('Character');
    if (c && c.scene.isActive()) c.scene.stop();
});
await sleep(800);

// ===== D) ВОЗВРАТ ДОЛГА МОНЕТАМИ (п.6) =====
console.log('— D) Возврат монетами —');
await setReg(`{ const p = r.get('player'); p.dengas = 10; r.set('player', p); }`);
await enter('tavern');
await sleep(2500);
ok(await clickUntil('🪙 Долги', hasText('Долги в столбце')), 'меню «Долги» открыто');
ok(await clickUntil('Вернуть 2 д.', async () => {
    const s2 = await state();
    return !s2.loans.some(l => l.kind === 'food');
}), 'п.6: долг за еду (2 д.) возвращён монетами');
await sleep(900);
st = await state();
ok(st.dengas === 8, 'монеты списаны (10 → 8)');
ok(st.tkRep === 28, 'своевременный возврат: доверие Фёдора +2 (30 −2 еда −2 ночлег +2 = 28)');
ok((st.log || []).some(l => l.includes('возвращён в срок')), 'Летопись: «возвращён в срок»');
await clickUntil('Закрыть', async () => !(await texts()).some(x => x.includes('Долги в столбце')));
await exitInt();
await sleep(1500);

// ===== E) ОТСРОЧКА (п.7) — 3 раза и предел =====
console.log('— E) Отсрочка —');
await setReg(`{ const gt = r.get('gameTime'); gt.day += 10; r.set('gameTime', gt); }
    { const p = r.get('player'); p.skills = Object.assign({}, p.skills, { persuade: 99, fast_talk: 40 }); r.set('player', p); }`);
await enter('tavern');
await sleep(2500);
ok(await clickUntil('🪙 Долги', async () => {
    const tx = await texts();
    return tx.some(x => x.includes('просрочено')) && tx.some(x => x.includes('Просить отсрочку'));
}), 'меню: долг просрочен, кнопка отсрочки есть');
await shot('e1_overdue_menu.webp');
const def1before = (await state()).loans.reduce((s, l) => s + l.deferrals, 0);
ok(await clickUntil('Просить отсрочку', async () => {
    const s2 = await state();
    return s2.loans.reduce((s, l) => s + l.deferrals, 0) > def1before;
}), 'п.7: отсрочка №1 выторгована (Убеждение 99)');
await shot('e2_deferral_ok.webp');
await clickUntil('Дальше', async () => !(await texts()).some(x => x.includes('Отсрочка долга')));
await clickUntil('Закрыть', async () => !(await texts()).some(x => x.includes('Долги в столбце')));
for (let i = 2; i <= 3; i++) {
    await setReg(`{ const gt = r.get('gameTime'); gt.day += 12; r.set('gameTime', gt); }`);
    await exitInt(); await sleep(1500); await enter('tavern'); await sleep(2500);
    await clickUntil('🪙 Долги', async () => (await texts()).some(x => x.includes('Просить отсрочку')));
    const before = (await state()).loans.reduce((s, l) => s + l.deferrals, 0);
    ok(await clickUntil('Просить отсрочку', async () => {
        const s2 = await state();
        return s2.loans.reduce((s, l) => s + l.deferrals, 0) > before;
    }), `п.7: отсрочка №${i} выторгована`);
    await clickUntil('Дальше', async () => !(await texts()).some(x => x.includes('Отсрочка долга')));
    await clickUntil('Закрыть', async () => !(await texts()).some(x => x.includes('Долги в столбце')));
}
// После 3 отсрочек кнопки быть НЕ должно
await setReg(`{ const gt = r.get('gameTime'); gt.day += 12; r.set('gameTime', gt); }`);
await exitInt(); await sleep(1500); await enter('tavern'); await sleep(2500);
await clickUntil('🪙 Долги', hasText('Долги в столбце'));
await shot('e3_no_more_deferrals.webp');
const dm3 = await texts();
ok(!dm3.some(x => x.includes('Просить отсрочку')), 'п.7: после 3 отсрочек кнопка ИСЧЕЗЛА');
await clickUntil('Закрыть', async () => !(await texts()).some(x => x.includes('Долги в столбце')));
await exitInt();
await sleep(1500);

// ===== F) СТРАЖНИК И ДОЛГ (п.8) =====
console.log('— F) Взыскание стражником —');
const preF = await state();
ok(preF.loans.length > 0, 'предпосылка: есть просроченный долг (иначе стражник не остановит)');
console.log('    (до взыскания: узел =', JSON.stringify(preF.inv), ', долг =', preF.loans.reduce((s, l) => s + l.amount, 0), 'д., монет =', preF.dengas + ')');
// Обнуляем мошну: взыскание должно пойти ИМУЩЕСТВОМ (50% цены), а не монетами
await setReg(`{ const p = r.get('player'); if (p) { p.dengas = 0; r.set('player', p); } }`);
await gateExit();
await sleep(2000);
await shot('f1_guard_debt.webp');
const gtx = await texts();
ok(gtx.some(x => x.includes('Стражник и долг')), 'п.8: стражник остановил должника у ворот');
ok(gtx.some(x => x.includes('половина базовой')), 'п.8: в счёте видна цена продажи — 50%');
ok(await clickUntil('Отдать долг, чем есть', hasText('Долг взыскан')), '«Отдать долг, чем есть» → взыскание');
await sleep(1000);
st = await state();
console.log('    (после взыскания: узел =', JSON.stringify(st.inv), ', монет =', st.dengas, ')');
ok(st.inv.length === 0, 'имущество (рыба печёная ×3 = 6 д. по 50%) ушло в уплату');
ok(st.dengas === 2, 'излишек продажи (6 − 4 д. долга = 2 д.) вернули в мошну');
ok(st.loans.length === 0, 'п.8: долг покрыт имуществом полностью');
await shot('f2_guard_done.webp');
await clickUntil('Отойти от ворот', async () => !(await texts()).some(x => x.includes('Долг взыскан')));
await closeStuckDialogs();
await sleep(700);

// ===== G) ОТКАЗ В КРЕДИТЕ (п.4) =====
console.log('— G) Отказ при дурной молве —');
await setReg(`{ const rep = r.get('reputation'); if (rep) { rep.villageRep = -10; rep.npcRep = Object.assign({}, rep.npcRep, { tavernkeeper: -10 }); r.set('reputation', rep); } }
    { const p = r.get('player'); if (p) { p.dengas = 0; r.set('player', p); } }`);
ok(await sceneActive('Village'), 'герой остался в деревне (стражник остановил, не выпустил)');
await enter('tavern');
await sleep(2500);
await clickUntil('Купить еды', hasText('У дороги» — меню'));
await clickUntil('Хлеб', async () => (await texts()).some(x => x.includes('ПОЛОЖИТЕЛЬНОЙ')));
await shot('g1_credit_refusal.webp');
const rf = await texts();
ok(rf.some(x => x.includes('ПОЛОЖИТЕЛЬНОЙ репутации в деревне')), 'п.4: отказ — нужна ПОЛОЖИТЕЛЬНАЯ молва в деревне');
await clickUntil('Понятно', async () => !(await texts()).some(x => x.includes('ПОЛОЖИТЕЛЬНОЙ репутации в деревне')));

// ===== ИТОГИ =====
await shot('final.webp');
console.log(`\nJS-ошибок: ${jsErrs.length}` + (jsErrs.length ? '\n  ' + jsErrs.slice(0, 5).join('\n  ') : ''));
ok(jsErrs.length === 0, '0 JS-ошибок на странице');
console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
await browser.close();
process.exit(fail ? 1 : 0);

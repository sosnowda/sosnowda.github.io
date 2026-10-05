// test_round130.mjs — 66.83: ДОПОЛНЕНИЕ ДОЛГОВОЙ СИСТЕМЫ 66.82
// (приказы владельца 9, 10, 12, 13).
//
//  п.9  ИЗГОЙСТВО: имуществом не покрыл просроченные долги —
//       q.expelledForDebts → checkGameEnd 'defeat_expelled_debts' →
//       финал «🚪 ИЗГНАН ЗА ДОЛГИ» = провал игры;
//  п.8  (дословно) правёж «ВНАЧАЛЕ ИЗ ИНВЕНТАРЯ, ПОТОМ НАДЕТОЕ»:
//       wornItems в счёте, weaponId → fists, armorId → none;
//  п.10 ЗАКУП: workOffDebt — час работы, вся плата в счёт долга
//       по старшинству, лишек в мошну, bonded, «отказаться нельзя»;
//  п.12 СЕРЫЕ КНОПКИ «хозяин дома/на поле» (пины InteriorScene);
//  п.13 ИНСТРУКЦИЯ: 6 закладок, полный экран (пины TitleScene).
//
// Запуск из корня репозитория: node game/tools/test_round130.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const realRandom = Math.random;
function rollSeq(seq) { let i = 0; Math.random = () => (i < seq.length ? seq[i++] : 0.5); }
function restoreRandom() { Math.random = realRandom; }

function makeRegistry({ month = 6, day = 14, villageRep = 10, dengas = 0 } = {}) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month, day, hour: 12, minute: 0 });
    reg.set('player', {
        HP: 12, HPmax: 12, skills: { persuade: 60, fast_talk: 40 },
        inventory: [], dengas, weaponId: 'fists', armorId: 'none',
    });
    reg.set('reputation', { villageRep, npcRep: { tavernkeeper: 20 } });
    reg.set('quest', {});
    return reg;
}
// их кумулятив дней (MONTHS TimeSystem): сент..авг
const CUM = [0, 30, 61, 91, 122, 153, 181, 212, 242, 273, 303, 334];
const dayIdxOf = (reg) => {
    const gt = reg.get('gameTime');
    return gt.yearFromChrist * 366 + CUM[gt.month] + gt.day;
};
function addLoan(reg, { amount, overdueDays = 0, npcId = 'tavernkeeper', id = 'L' + Math.random().toString(36).slice(2, 7) } = {}) {
    const st = reg.get('debtState') || { loans: [], seq: 1 };
    const today = dayIdxOf(reg);
    st.loans.push({
        id, npcId, kind: 'coin', amount,
        issuedDayIdx: today - 14, dueDayIdx: today - overdueDays,
        issuedTs: { day: 1, month: 0 }, dueTs: { day: 1, month: 0 }, deferrals: 3,
    });
    st.seq++;
    reg.set('debtState', st);
    return id;
}

const debts = await import(join(ROOT, 'game/src/systems/debts.js'));
const thiefMod = await import(join(ROOT, 'game/src/data/thief.js'));
const i18n = await import(join(ROOT, 'game/src/systems/i18n.js'));
const { workOffDebt, isBondedTo, debtGuardBill, debtGuardCollect, guardDebtNeeded, totalDebtOf, loansOf } = debts;

console.log('--- П.10: закуп — работа в счёт долга ---');
{
    const reg = makeRegistry({ dengas: 100 });
    addLoan(reg, { amount: 3 });
    rollSeq([0.999]); // ставка 5 д.
    const res = workOffDebt(reg, 'tavernkeeper');
    restoreRandom();
    ok(res.wage === 5 && res.applied === 3, 'ставка закупа 5 д., в долг ушло 3');
    ok(res.debtLeft === 0, 'долг закрыт закупом');
    ok(res.surplus === 2 && reg.get('player').dengas === 102, 'лишек 2 д. вернулся в мошну');
    ok(loansOf(reg).length === 0, 'запись долга снята');
    ok(res.applied > 0 && res.surplus >= 0, 'п.10: плата целиком в счёт долга');
}
{
    const reg = makeRegistry({});
    // старший срок (due раньше) — гасится первым; равные сроки не используем
    addLoan(reg, { amount: 10, overdueDays: 0, id: 'L2' });   // due = сегодня (младший)
    addLoan(reg, { amount: 10, overdueDays: 3, id: 'L1' });   // due = сегодня−3 (старший)
    rollSeq([0.0, 0.99]); // два закупа: 3 д. и 5 д.
    const r1 = workOffDebt(reg, 'tavernkeeper');
    const r2 = workOffDebt(reg, 'tavernkeeper');
    restoreRandom();
    ok(r1.applied === 3 && r2.applied === 5, 'закупы: 3 + 5 д. в счёт долга');
    const st = reg.get('debtState');
    const l1 = st.loans.find(l => l.id === 'L1');
    const l2 = st.loans.find(l => l.id === 'L2');
    ok(l1.amount === 2 && l1.bonded === true, 'старший долг гасится первым (10 → 2, bonded)');
    ok(l2.amount === 10 && !l2.bonded, 'младший долг не тронут, пока жив старший');
    ok(isBondedTo(reg, 'tavernkeeper') === true, 'isBondedTo — истина');
    ok(totalDebtOf(reg) === 12, 'остаток долга 12 д.');
    ok(reg.get('player').dengas === 0, 'закуп не дал живых денег');
}
{
    const reg = makeRegistry({});
    const res0 = workOffDebt(reg, 'tavernkeeper');
    ok(res0.wage === 0 && res0.debtLeft === 0, 'без долгов закуп невозможен');
}

console.log('--- П.8+9: правёж — надетое следом за инвентарём, изгойство ---');
{
    // покрытый правёж с надетым: мошна 3 + инвентарь 0 + меч (15) ≥ долг 15
    const reg = makeRegistry({ dengas: 3 });
    const p = reg.get('player');
    p.weaponId = 'sword'; // 30 д. база → 15 д. продажи
    addLoan(reg, { amount: 15, overdueDays: 3 });
    ok(guardDebtNeeded(reg) === true, 'просрочка — стражнику есть дело');
    const bill = debtGuardBill(reg);
    ok(bill.wornItems.length === 1 && bill.wornItems[0].id === 'sword' && bill.wornItems[0].sale50 === 15, 'счёт: надетое оружие в wornItems (50% цены)');
    const res = debtGuardCollect(reg);
    ok(res.expelled === false && res.stillOwed === 0, 'правёж покрыл долг (мошна + надетое)');
    ok(p.weaponId === 'fists', 'оружие в руках описано → кулаки (п.8 дословно)');
    ok(res.surplus === 3 && p.dengas === 3, 'лишек 3 д. вернулся в мошну');
}
{
    // изгойство: долг 100, мошна 0, узел пуст, надетого нет → провал игры
    const reg = makeRegistry({ dengas: 0 });
    const p = reg.get('player');
    addLoan(reg, { amount: 100, overdueDays: 3 });
    const res = debtGuardCollect(reg);
    ok(res.expelled === true && res.stillOwed > 0, 'имуществом не покрыл — ИЗГОЙСТВО (п.9)');
    ok(reg.get('quest').expelledForDebts === true, 'флаг q.expelledForDebts установлен');
    ok(reg.get('player').dengas === 0 && reg.get('player').inventory.length === 0, 'мошна и узел в ноль');
    ok(thiefMod.checkGameEnd(reg) === 'defeat_expelled_debts', "checkGameEnd → 'defeat_expelled_debts'");
    // вира/молва не задействованы — только долговое изгойство
    ok(res.takenItems.length === 0 && res.takenWorn.length === 0, 'описывать было нечего');
}
{
    // изгойство после надетого: инвентарь скуп + надетое не хватило
    const reg = makeRegistry({ dengas: 0 });
    const p = reg.get('player');
    p.weaponId = 'club'; p.armorId = 'padded'; // 1 + 5 = 6 д.
    p.inventory = [{ id: 'fish_raw', count: 1 }]; // 1 д.
    addLoan(reg, { amount: 10, overdueDays: 3 });
    const res = debtGuardCollect(reg);
    ok(res.expelled === true, 'инвентарь (1) + надетое (6) = 7 д. < 10 д. — изгойство');
    ok(p.weaponId === 'fists' && p.armorId === 'none', 'надетое всё равно ушло до изгойства');
    ok(thiefMod.checkGameEnd(reg) === 'defeat_expelled_debts', "исход 'defeat_expelled_debts'");
}

console.log('--- Пины проводок сцен (пп.9, 10, 12, 13) ---');
{
    const vs = read('game/src/scenes/VillageScene.js');
    ok(vs.includes('ИЗГНАН ЗА ДОЛГИ') && vs.includes('res.expelled'), 'VillageScene: изгойство-ветка правежа');
    const is = read('game/src/scenes/InteriorScene.js');
    ok(is.includes('workOffDebtAtTavern') && is.includes('Отработать долг (1 час)'), 'InteriorScene: кнопка закупа');
    ok(is.includes('Отработать час в закупах'), 'меню долгов: пункт закупа');
    ok(is.includes('Подёнка — хозяин дома') && is.includes('Станок — хозяин дома') && is.includes('О слове — хозяин дома'), 'серые кнопки в мастерских (п.12)');
    ok(is.includes('Хозяин на поле — мастерская без присмотра'), 'подсказка «хозяин на поле» в пустой мастерской');
    ok(is.includes('showOwnerHomeHint'), 'обработчик серых кнопок');
    const ts = read('game/src/scenes/TitleScene.js');
    ok(ts.includes('helpSections') && ts.includes('helpTabs'), 'инструкция: разделы и закладки (п.13)');
    ok(ts.includes('На весь экран') && ts.includes('Свернуть'), 'полноэкранный режим инструкции');
    ok(ts.includes('ДЕНЕЖНАЯ СИСТЕМА РУСИ XV ВЕКА') && ts.includes('ИГРОВОЙ КАЛЕНДАРЬ') && ts.includes('ДОЛГИ НА ПОСТОЯЛОМ ДВОРЕ'), 'разделы деньги/календарь/долги');
    const es = read('game/src/scenes/EndScene.js');
    ok(es.includes('expelledForDebts'), 'EndScene: титул изгойства');
    const tj = read('game/src/data/thief.js');
    ok(tj.includes("defeat_expelled_debts"), 'checkGameEnd: новый исход');
}

console.log('--- EN-подмножество новых строк ---');
{
    i18n.setLang('en');
    const samples = [
        '🚪 ИЗГНАН ЗА ДОЛГИ', '⚒ Отработать долг (1 час)', '⚒ Отработать час в закупах',
        '⚒ Закуп — работа в счёт долга', '🧶 Станок — хозяин дома', '🤝 О слове — хозяин дома',
        '⚒ Хозяин дома', '⛶ На весь экран', 'hwnd Свернуть'.replace('hwnd', '🗗'),
        '📜 Начало', '🎲 Ролевая система', '💰 Деньги', '📅 Календарь', '⭐ Репутация',
        'хозяин', 'Долги не выплачены: имущество продано, из деревни изгнан.',
    ];
    let enOk = true;
    samples.forEach((k) => { if (i18n.t(k) === k) { enOk = false; console.log('    нет EN: ' + k); } });
    ok(enOk, 'ключевые строки 66.83 переведены (EN)');
    i18n.setLang('ru');
    ok(i18n.t('🚪 ИЗГНАН ЗА ДОЛГИ') === '🚪 ИЗГНАН ЗА ДОЛГИ', 'RU-режим возвращает исходные строки');
}

restoreRandom();
console.log(`\nИТОГО: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

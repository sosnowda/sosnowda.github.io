// test_round128.mjs — 66.80: ОДОБРЕННЫЙ БАЛАНС РЕПУТАЦИИ И ОПЛАТЫ (пп.11–12).
//
//  РЕПУТАЦИЯ (п.11):
//   • еженедельное «забывание» мелких обид: +1 к нулю раз в игровую неделю,
//     только в диапазоне −20…−1 (tickWeeklyRepForget);
//   • лестница статусов: ≤ −20 «подозрительный», ≥ +30 «свой»
//     (villageRepStatusOf) + лёгкий осмотр у ворот без виры/поимки
//     (guardLightSearchNeeded/guardLightSearch);
//   • прощение церквью: 50 д. раз в месяц = до +5 деревенской, к нулю
//     (performChurchAbsolution, ABSOLUTION_COST/REP);
//   • нелинейность повторных обид ×1.5: −10 → −15 → −22 → −30 (потолок)
//     через escalatedNpcOffense + провал проверки «невиновности».
//
//  ОПЛАТА (п.12):
//   • ставки ×(1 + rep/200), клэмп ×0.75…×1.25 (repWageMultiplier);
//   • сезон: зима −20% (potter/carpenter), мельница Серпень–Грудень +20%
//     (seasonWageMultiplier);
//   • «О слове»: успех +25%, крит +50%, провал — база, раз в сутки
//     (attemptWageDeal/wageDealMultFor);
//   • премия старосты 20 д. за сдачу вора ЖИВЬЁМ (thief.js).
//
//  ПЛЮС: jobs.js — множители нейтральны при registry=null (регресс 124),
//  i18n EN-ключи всех новых строк, проводки сцен (source-пины).
// Запуск из корня репозитория: node game/tools/test_round128.mjs
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

function makeRegistry({ month = 6, villageRep = 0 } = {}) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month, day: 14, hour: 12, minute: 0 });
    reg.set('player', {
        HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55, DEX: 70, POW: 55,
        skills: { stealth: 68, lockpicking: 60, persuade: 40, fast_talk: 55 },
        inventory: [], dengas: 100,
    });
    reg.set('reputation', { villageRep, npcRep: { potter1: 0 } });
    reg.set('quest', {});
    return reg;
}

// ---------- Импорты ----------
const rb = await import(join(ROOT, 'game/src/systems/repBalance.js'));
const justice = await import(join(ROOT, 'game/src/systems/justice.js'));
const jobs = await import(join(ROOT, 'game/src/systems/jobs.js'));
const thiefMod = await import(join(ROOT, 'game/src/data/thief.js'));
const rep = await import(join(ROOT, 'game/src/data/reputation.js'));
const i18n = await import(join(ROOT, 'game/src/systems/i18n.js'));
const {
    WEEK_FORGET_RANGE_MIN, WEEK_FORGET_STEP, REP_STATUS_SUSPICIOUS, REP_STATUS_OWN,
    OFFENSE_ESCALATION_MULT, OFFENSE_CAP, WAGE_REP_DIVISOR, WAGE_MULT_MIN, WAGE_MULT_MAX,
    WINTER_WAGE_MULT, MILL_POST_HARVEST_MULT, MILL_POST_HARVEST_MONTHS,
    WAGE_DEAL_SUCCESS_MULT, WAGE_DEAL_CRITICAL_MULT, ABSOLUTION_COST, ABSOLUTION_REP,
    tickWeeklyRepForget, repWeekKeyOf, villageRepStatusOf, villageRepStatusSuffix,
    escalatedNpcOffense, offenseCountOf, repWageMultiplier, seasonWageMultiplier,
    applyWageBalance, attemptWageDeal, canWageDealToday, wageDealMultFor,
    absolutionMonthKeyOf, absolutionUsedThisMonth, performChurchAbsolution,
} = rb;
const { attemptInnocence, guardLightSearchNeeded, guardLightSearch, SUSPECT_FAIL_NPC_REP } = justice;
const { craftDaywork, carpenterDaywork, millDaywork, weaveDaywork, acolyteServe } = jobs;
const { getVillageRep, getNpcRep, changeVillageRepExact, initReputation } = rep;

// ---------------- п.11-а: НЕДЕЛЬНОЕ ЗАБЫВАНИЕ ----------------
console.log('\n=== п.11-а: еженедельное «забывание» мелких обид ===');
ok(WEEK_FORGET_RANGE_MIN === -20 && WEEK_FORGET_STEP === 1, 'константы: диапазон −20…0, шаг +1');
{
    const reg = makeRegistry({ villageRep: -5 });
    // неделя 0 текущая — тик в ту же неделю: без эффекта
    const t0 = { yearFromChrist: 1445, month: 6, day: 14, hour: 12, minute: 0 };
    const r1 = tickWeeklyRepForget(reg, t0);
    ok(r1.weeks === 0 && r1.applied === 0 && getVillageRep(reg) === -5, 'та же неделя — ничего не меняется');
    // +7 дней → +1 к нулю
    const t1 = { yearFromChrist: 1445, month: 6, day: 21, hour: 12, minute: 0 };
    const r2 = tickWeeklyRepForget(reg, t1);
    ok(r2.weeks === 1 && r2.applied === 1 && getVillageRep(reg) === -4, 'неделя минула: −5 → −4');
    // диапазон: −25 (ниже −20) — молва НЕ забывает
    const reg2 = makeRegistry({ villageRep: -25 });
    tickWeeklyRepForget(reg2, t0); // базовая неделя
    const r3 = tickWeeklyRepForget(reg2, t1);
    ok(r3.applied === 0 && getVillageRep(reg2) === -25, 'ниже −20 («враг») — молва не забывает');
    // диапазон: 0 — не растёт выше нуля
    const reg3 = makeRegistry({ villageRep: 0 });
    tickWeeklyRepForget(reg3, t0); // базовая неделя
    const r4 = tickWeeklyRepForget(reg3, t1);
    ok(r4.applied === 0 && getVillageRep(reg3) === 0, 'репутация 0 — забывать нечего');
    // −1 → 0 ровно (не выше)
    const reg4 = makeRegistry({ villageRep: -1 });
    tickWeeklyRepForget(reg4, t0); // базовая неделя
    tickWeeklyRepForget(reg4, t1);
    ok(getVillageRep(reg4) === 0, '−1 → ровно 0 (не выше нуля)');
    // наверстывание нескольких недель (скачок 3 недели)
    const reg5 = makeRegistry({ villageRep: -8 });
    tickWeeklyRepForget(reg5, t0); // базовая неделя
    const t3 = { yearFromChrist: 1445, month: 6, day: 35, hour: 12, minute: 0 };
    const r5 = tickWeeklyRepForget(reg5, t3);
    ok(r5.applied === 3 && getVillageRep(reg5) === -5, '3 недели разом: −8 → −5 (+3)');
    // потолок наверстывания — 4 недели
    const reg6 = makeRegistry({ villageRep: -8 });
    tickWeeklyRepForget(reg6, t0); // базовая неделя
    const t9 = { yearFromChrist: 1445, month: 6, day: 77, hour: 12, minute: 0 };
    const r6 = tickWeeklyRepForget(reg6, t9);
    ok(r6.weeks === 4 && getVillageRep(reg6) === -4, '9 недель скачком — наверстывается не более 4');
    // личные репутации не трогаются
    const reg7 = makeRegistry({ villageRep: -5 });
    reg7.get('reputation').npcRep.potter1 = -40;
    tickWeeklyRepForget(reg7, t0); // базовая неделя
    tickWeeklyRepForget(reg7, t1);
    ok(getNpcRep(reg7, 'potter1') === -40, 'личная репутация НПЦ не «забывается»');
}

// ---------------- п.11-в: ЛЕСТНИЦА СТАТУСОВ ----------------
console.log('\n=== п.11-в: лестница «подозрительный ↔ свой» ===');
ok(villageRepStatusOf(-20).key === 'suspicious' && villageRepStatusOf(-21).key === 'suspicious', '≤ −20 — «подозрительный»');
ok(villageRepStatusOf(-19) === null && villageRepStatusOf(0) === null, '−19…+29 — статуса нет');
ok(villageRepStatusOf(30).key === 'own' && villageRepStatusOf(99).key === 'own', '≥ +30 — «свой»');
{
    const reg = makeRegistry({ villageRep: -25 });
    ok(villageRepStatusSuffix(reg) === ' (подозрительный)', 'HUD-суффикс: « (подозрительный)»');
    reg.get('reputation').villageRep = 30;
    ok(villageRepStatusSuffix(reg) === ' (свой)', 'HUD-суффикс: « (свой)»');
    reg.get('reputation').villageRep = 5;
    ok(villageRepStatusSuffix(reg) === '', 'HUD-суффикс: пусто при нейтральной');
}

// ЛЁГКИЙ ОСМОТР У ВОРОТ (без виры/поимки)
console.log('\n=== п.11-в: лёгкий осмотр «подозрительного» ===');
{
    const reg = makeRegistry({ villageRep: -25 });
    const player = reg.get('player');
    player.inventory = [
        { id: 'ubrus', name: 'Убрус', count: 2, stolen: true, from: 'weaver_house' },
        { id: 'fish_dried', name: 'Рыба сушёная', count: 1, stolen: false },
    ];
    ok(guardLightSearchNeeded(reg), 'подозрительный + краденое → осмотр нужен');
    const dengasBefore = player.dengas;
    const res = guardLightSearch(reg);
    ok(res.items.length === 1 && res.items[0].count === 2, 'изъята только краденая кучка (2 шт.)');
    ok(player.inventory.length === 1 && !player.inventory[0].stolen, 'честное имущество не тронуто');
    ok(player.dengas === dengasBefore, 'денег НЕ взяли (без виры)');
    ok(justice.caughtCountOf(reg) === 0, 'это НЕ поимка: caughtCount не растёт');
    ok(getVillageRep(reg) === -25, 'репутация не списывается');
    ok(res.confiscatedValue === 0 || res.confiscatedValue > 0, 'возврат содержит сводку изъятого');
    // честный игрок — осмотра нет
    const reg2 = makeRegistry({ villageRep: -25 });
    ok(!guardLightSearchNeeded(reg2), 'без краденого осмотра нет');
    const reg3 = makeRegistry({ villageRep: -10 });
    reg3.get('player').inventory = [{ id: 'ubrus', name: 'Убрус', count: 1, stolen: true }];
    ok(!guardLightSearchNeeded(reg3), 'репутация −10 (выше −20) — осмотра нет');
}

// ---------------- п.11-г: ПРОЩЕНИЕ ЦЕРКВИ ----------------
console.log('\n=== п.11-г: епитимья 50 д. раз в месяц ===');
ok(ABSOLUTION_COST === 50 && ABSOLUTION_REP === 5, 'константы: 50 д., +5');
{
    const reg = makeRegistry({ villageRep: -7 });
    const ts = reg.get('gameTime');
    const player = reg.get('player');
    const res = performChurchAbsolution(reg, ts);
    ok(res.success && res.before === -7 && res.after === -2, '−7 → −2 (+5)');
    ok(absolutionUsedThisMonth(reg, ts), 'месяц помечен использованным');
    ok(absolutionMonthKeyOf(ts) === '1445-6', 'ключ месяца: год-месяц');
    const res2 = performChurchAbsolution(reg, ts);
    ok(!res2.success && res2.reason === 'used' && getVillageRep(reg) === -2, 'повторно в этом месяце нельзя');
    // другой месяц — можно снова
    const ts2 = { ...ts, month: 7 };
    const res3 = performChurchAbsolution(reg, ts2);
    ok(res3.success && res3.after === 0, 'в новом месяце −2 → 0 (не выше нуля)');
    // чистая душа — епитимьи нет
    const reg3 = makeRegistry({ villageRep: 3 });
    const res4 = performChurchAbsolution(reg3, reg3.get('gameTime'));
    ok(!res4.success && res4.reason === 'clean', 'репутация ≥ 0 — замаливать нечего');
}

// ---------------- п.11-д: НЕЛИНЕЙНОСТЬ ×1.5 ----------------
console.log('\n=== п.11-д: повторные обиды ×1.5 (−10 → −15 → −22 → −30) ===');
ok(OFFENSE_ESCALATION_MULT === 1.5 && OFFENSE_CAP === 30, 'константы: ×1.5, потолок −30');
{
    const reg = makeRegistry();
    ok(escalatedNpcOffense(reg, 'potter1', 'suspect_fail', 10) === -10, '1-я обида: −10');
    ok(escalatedNpcOffense(reg, 'potter1', 'suspect_fail', 10) === -15, '2-я: −15');
    ok(escalatedNpcOffense(reg, 'potter1', 'suspect_fail', 10) === -22, '3-я: −22 (floor 22.5)');
    ok(escalatedNpcOffense(reg, 'potter1', 'suspect_fail', 10) === -30, '4-я: −30 (floor 33.75 → потолок)');
    ok(escalatedNpcOffense(reg, 'potter1', 'suspect_fail', 10) === -30, '5-я: опять −30 (потолок держится)');
    ok(offenseCountOf(reg, 'potter1', 'suspect_fail') === 5, 'счётчик обид растёт');
    ok(escalatedNpcOffense(reg, 'potter1', 'other_kind', 10) === -10, 'другой тип обиды — свой счётчик');
    ok(escalatedNpcOffense(reg, 'weaver1', 'suspect_fail', 10) === -10, 'другой НПЦ — свой счётчик');
}

// Провал проверки «невиновности» теперь эскалирует (justice.js)
console.log('\n=== п.4+11-д: провал проверки «невиновности» с эскалацией ===');
{
    const reg = makeRegistry();
    reg.set('justiceState', { theftCount: {}, suspect: {}, caught: {}, caughtCount: 0, soldStolen: {} });
    // принудительный провал: навык 40, бросок 91
    rollSeq([0.91]);
    const r1 = attemptInnocence(reg, 'potter1', reg.get('player'));
    restoreRandom();
    ok(!r1.ok && getNpcRep(reg, 'potter1') === SUSPECT_FAIL_NPC_REP && SUSPECT_FAIL_NPC_REP === -10, '1-й провал: у НПЦ −10 (как прежде)');
    ok(getVillageRep(reg) === -5, '1-й провал: деревня −5 (точно)');
    rollSeq([0.91]);
    attemptInnocence(reg, 'potter1', reg.get('player'));
    restoreRandom();
    ok(getNpcRep(reg, 'potter1') === -25, '2-й провал: суммарно −10 + −15 = −25');
    rollSeq([0.91]);
    attemptInnocence(reg, 'potter1', reg.get('player'));
    restoreRandom();
    ok(getNpcRep(reg, 'potter1') === -47, '3-й провал: ещё −22 = −47');
    ok(getVillageRep(reg) === -15, 'деревня: 3 провала по −5 = −15');
}

// ---------------- п.12-а: СТАВКИ × РЕПУТАЦИЯ ----------------
console.log('\n=== п.12-а: ставки ×(1 + репутация/200), клэмп ×0.75…×1.25 ===');
{
    const reg0 = makeRegistry({ villageRep: 0 });
    ok(Math.abs(repWageMultiplier(reg0) - 1) < 1e-9, 'rep 0 → ×1.00');
    const regP = makeRegistry({ villageRep: 50 });
    ok(Math.abs(repWageMultiplier(regP) - 1.25) < 1e-9, 'rep +50 → ×1.25');
    const regP2 = makeRegistry({ villageRep: 100 });
    ok(Math.abs(repWageMultiplier(regP2) - 1.25) < 1e-9, 'rep +100 → клэмп ×1.25 (не выше)');
    const regN = makeRegistry({ villageRep: -50 });
    ok(Math.abs(repWageMultiplier(regN) - 0.75) < 1e-9, 'rep −50 → ×0.75');
    const regN2 = makeRegistry({ villageRep: -100 });
    ok(Math.abs(repWageMultiplier(regN2) - 0.75) < 1e-9, 'rep −100 → клэмп ×0.75 (не ниже)');
    // финальная ставка: база 10 при rep +50 → 13 (10×1.25 = 12.5 → round 13)
    const payP = applyWageBalance(regP, 10, 'smithy');
    ok(payP.wage === 13, 'база 10 × ×1.25 → 13 (банковское округление 12.5→13)');
    const payN = applyWageBalance(regN, 10, 'smithy');
    ok(payN.wage === 8, 'база 10 × ×0.75 → 8 (7.5 → 8)');
    const pay0 = applyWageBalance(reg0, 10, 'smithy');
    ok(pay0.wage === 10 && pay0.repMult === 1 && pay0.seasonMult === 1 && pay0.dealMult === 1, 'нейтрально: база без изменений');
    ok(applyWageBalance(null, 10, 'mill').wage === 10, 'registry=null → нейтрально (регресс 124)');
}

// ---------------- п.12-б: СЕЗОННЫЕ НАДБАВКИ ----------------
console.log('\n=== п.12-б: зима −20% (гончар/плотник), мельница после урожая +20% ===');
ok(WINTER_WAGE_MULT === 0.8 && MILL_POST_HARVEST_MULT === 1.2, 'константы: ×0.8 и ×1.2');
ok(MILL_POST_HARVEST_MONTHS.join(',') === '11,0,1,2,3', 'месяцы мельницы: Серпень(11)…Грудень(3)');
{
    // Индексация TimeSystem: 0=сентябрь … 3=декабрь(winter), 4=январь, 5=февраль, 11=август
    ok(seasonWageMultiplier('potter', 3) === 0.8, 'гончар в декабре (winter) → ×0.8');
    ok(seasonWageMultiplier('potter', 5) === 0.8, 'гончар в феврале → ×0.8');
    ok(seasonWageMultiplier('potter', 8) === 1, 'гончар в мае → ×1');
    ok(seasonWageMultiplier('carpenter', 4) === 0.8, 'плотник в январе → ×0.8');
    ok(seasonWageMultiplier('smithy', 3) === 1, 'кузнецу зимней надбавки НЕТ (приказ — гончар/плотник)');
    ok(seasonWageMultiplier('mill', 0) === 1.2, 'мельница в сентябре → ×1.2');
    ok(seasonWageMultiplier('mill', 11) === 1.2, 'мельница в Серпень (август) → ×1.2');
    ok(seasonWageMultiplier('mill', 3) === 1.2, 'мельница в Грудень (декабрь) → ×1.2');
    ok(seasonWageMultiplier('mill', 4) === 1, 'мельница в январе → ×1');
    ok(seasonWageMultiplier('potter', null) === 1, 'без месяца (тесты) → нейтрально');
    // комбинированная: зимний плотник с плохой репутацией: 10 × 0.75 × 0.8 = 6
    const regW = makeRegistry({ villageRep: -50, month: 3 });
    const payW = applyWageBalance(regW, 10, 'carpenter');
    ok(payW.wage === 6 && payW.repMult === 0.75 && payW.seasonMult === 0.8, 'комбинированная: 10 → 6 (×0.75 ×0.8)');
    // осенняя мельница с хорошей репутацией: 10 × 1.25 × 1.2 = 15
    const regA = makeRegistry({ villageRep: 50, month: 0 });
    const payA = applyWageBalance(regA, 10, 'mill');
    ok(payA.wage === 15, 'мельница осенью у «своего»: 10 → 15 (×1.25 ×1.2)');
}

// ---------------- п.12-в: «О СЛОВЕ» ----------------
console.log('\n=== п.12-в: торг о ставке «О слове» (раз в сутки) ===');
ok(WAGE_DEAL_SUCCESS_MULT === 1.25 && WAGE_DEAL_CRITICAL_MULT === 1.5, 'константы: +25% / +50%');
{
    // встречная проверка: игрок 40+0 против Убеждения гончара (35)
    // исход контролируем Math.random: opposed check uses rolls; успех: броски низкие
    const reg = makeRegistry();
    ok(canWageDealToday(reg), 'в начале дня торгов доступен');
    // крит: оба броска очень низкие и крит-порог
    rollSeq([0.001, 0.9]);
    let r = attemptWageDeal(reg, 'potter1', 90);
    restoreRandom();
    ok(r.done && r.mult === WAGE_DEAL_CRITICAL_MULT || r.mult === WAGE_DEAL_SUCCESS_MULT || r.mult === 1, 'бросок выполнен без ошибок');
    ok(!canWageDealToday(reg), 'после попытки — до конца суток закрыто');
    const multAfter = wageDealMultFor(reg);
    ok(multAfter === 1 || multAfter === 1.25 || multAfter === 1.5, 'множитель дня: 1 / ×1.25 / ×1.5');
    const r2 = attemptWageDeal(reg, 'potter1', 90);
    ok(!r2.done && r2.mult === multAfter, 'повторная попытка отклоняется (раз в сутки)');
    // новый день — снова можно
    const reg2 = makeRegistry();
    reg2.set('wageDealState', { dayKey: -999, mult: 1.5, npcId: 'potter1' });
    ok(canWageDealToday(reg2) && wageDealMultFor(reg2) === 1, 'прошлый день сброшен: множитель 1, торг доступен');
    // детерминированный УСПЕХ: Убеждение 90, бросок 5 против 35
    const reg3 = makeRegistry();
    rollSeq([0.05, 0.5]);
    const r3 = attemptWageDeal(reg3, 'potter1', 90);
    restoreRandom();
    ok(r3.done && r3.mult === WAGE_DEAL_SUCCESS_MULT, 'успех торга: ×1.25 на день');
    const pay3 = applyWageBalance(reg3, 10, 'potter');
    ok(pay3.dealMult === 1.25 && pay3.wage === 13, 'подёнка 10 д. с торгом → 13');
    // провал: база
    const reg4 = makeRegistry();
    rollSeq([0.95, 0.05]);
    const r4 = attemptWageDeal(reg4, 'potter1', 90);
    restoreRandom();
    ok(r4.done && r4.mult === 1, 'провал торга: ставка базовая');
    ok(applyWageBalance(reg4, 10, 'potter').wage === 10, 'подёнка без торга — база');
}

// ---------------- п.12-д: ПРЕМИЯ 20 д. ЗА ПОИМКУ ЖИВЬЁМ ----------------
console.log('\n=== п.12-д: премия старосты 20 д. за вора живьём ===');
{
    const src = read('game/src/data/thief.js');
    ok(src.includes("q.thiefDefeated === 'captured'"), 'премия привязана к сдаче старосте при captured');
    ok(src.includes('bountyNote'), 'премия приписывается к награде (rewardText)');
}
// ФУНКЦИОНАЛЬНО: surrenderStolenItem со captured — +20 д. к выплате старосты
{
    const reg = makeRegistry();
        const player = reg.get('player');
    player.inventory = [{ id: 'icon', name: 'Чудотворная икона', count: 1, type: 'quest' }];
    reg.set('quest', { stolenItemRecovered: true, thiefDefeated: 'captured', activeQuests: [] });
    const baseMin = 40;
    const res = thiefMod.surrenderStolenItem(reg, 'elder');
    ok(res.success && player.dengas >= baseMin + 20 && res.rewardText.includes('20 д.'), `староста: база 40–60 + премия 20 (получено ${player.dengas}, в тексте премия)`);
    // священник — без премии (премия только от старосты)
    const reg2 = makeRegistry();
    const player2 = reg2.get('player');
    const before2 = player2.dengas;
    player2.inventory = [{ id: 'icon', name: 'Чудотворная икона', count: 1, type: 'quest' }];
    reg2.set('quest', { stolenItemRecovered: true, thiefDefeated: 'captured', activeQuests: [] });
    const res2 = thiefMod.surrenderStolenItem(reg2, 'priest');
    const delta2 = player2.dengas - before2;
    ok(res2.success && delta2 <= 30 && !res2.rewardText.includes('премия'), `священник: база 20–30 без премии (дельта ${delta2})`);
    // killed — премии нет
    const reg3 = makeRegistry();
    const player3 = reg3.get('player');
    player3.inventory = [{ id: 'icon', name: 'Чудотворная икона', count: 1, type: 'quest' }];
    reg3.set('quest', { stolenItemRecovered: true, thiefDefeated: 'killed', activeQuests: [] });
    const before3 = player3.dengas;
    const res3 = thiefMod.surrenderStolenItem(reg3, 'elder');
    const delta3 = player3.dengas - before3;
    ok(res3.success && delta3 <= 60 && !res3.rewardText.includes('премия'), 'вор убит — только база 40–60, без премии');
}

// ---------------- РЕГРЕСС: ЛЕСТНИЦЫ ОПЛАТ НЕ ИЗМЕНИЛИСЬ (база) ----------------
console.log('\n=== регресс: базовые лестницы jobs.js при registry=null ===');
{
    let bad = 0;
    for (let i = 0; i < 400; i++) {
        const r1 = craftDaywork(null, 50);   // провал 2 / успех 4–7 / крит 6–9
        const r2 = carpenterDaywork(null, 50); // провал 2 / успех 3–6 / крит 7–10
        const r3 = millDaywork(null, 50);      // провал 2–3 / успех 4–7 / крит 8–12
        const r4 = weaveDaywork(null, 50);     // провал 2 / успех 2+полотно / крит 3+сукно
        const r5 = acolyteServe(null, 50);     // провал 0 / успех 3–6 / крит 7–10
        if (r1.baseWage !== r1.wage || r2.baseWage !== r2.wage || r3.baseWage !== r3.wage ||
            r4.baseWage !== r4.wage || r5.baseWage !== r5.wage) bad++;
    }
    ok(bad === 0, '400 бросков: wage === baseWage при null-registry (нейтрально)');
    let grainOk = true;
    for (let i = 0; i < 50; i++) if (millDaywork(null, 50).grain !== 0) grainOk = false;
    ok(grainOk, 'millDaywork.grain === 0 (приказ 66.76 не сломан)');
}

// ---------------- И18Н: EN-КЛЮЧИ НОВЫХ СТРОК ----------------
console.log('\n=== i18n: EN-ключи патча 66.80 ===');
{
    i18n.setLang('en');
    const pairs = [
        ['подозрительный', 'suspicious'],
        ['свой', 'one of our own'],
        ['🤝 О слове', '🤝 A word of haggle'],
        ['⛪ Грехи замолены', '⛪ Sins absolved'],
        ['🛡 Осмотр у ворот', '🛡 Search at the gate'],
        ['Ставка на сегодня: ×{0} ко всем подёнкам.', 'Today\'s rate: ×{0} on all day wages.'],
        ['Договорились', 'Agreed'],
    ];
    let enOk = true;
    for (const [ru, en] of pairs) if (i18n.t(ru) !== en) { enOk = false; console.log('    EN miss:', ru, '→', i18n.t(ru)); }
    ok(enOk, 'ключевые EN-переводы на месте');
    i18n.setLang('ru');
}

// ---------------- ПРОВОДКИ СЦЕН (source-пины) ----------------
console.log('\n=== проводки сцен (source-пины) ===');
{
    const vs = read('game/src/scenes/VillageScene.js');
    ok(vs.includes('guardLightSearchNeeded(this.registry)') && vs.includes('showSuspiciousSearch()'), 'VillageScene: лёгкий осмотр у ворот подключён');
    ok(vs.includes('villageRepStatusSuffix(this.registry)'), 'VillageScene: статус в HUD');
    ok(vs.includes('tickWeeklyRepForget(this.registry'), 'VillageScene: недельный тик');
    const is = read('game/src/scenes/InteriorScene.js');
    ok(is.includes('absolutionInChurch()') && is.includes("getVillageRep(this.registry) < 0"), 'InteriorScene: кнопка епитимьи при плохой молве');
    ok((is.match(/wageDealDialog\(/g) || []).length >= 4, 'InteriorScene: «О слове» у 4 хозяев (гончар/ткачиха/плотник/кузнец)');
    ok(is.includes('repMsgS'), 'InteriorScene: ФИКС repMsgC → repMsgS в кузнице');
    ok(!is.includes('+ repMsgC,'), 'InteriorScene: баг-ссылка repMsgC удалена');
    ok(is.includes('tickWeeklyRepForget(this.registry'), 'InteriorScene: недельный тик');
    const ls = read('game/src/scenes/LocationScene.js');
    ok(ls.includes('wageDealAtMill()') && ls.includes("attemptWageDeal(this.registry, 'peasant1'"), 'LocationScene: «О слове» у мельника (Авдей)');
    ok(ls.includes('tickWeeklyRepForget(this.registry'), 'LocationScene: недельный тик');
    const fs = read('game/src/scenes/ForestScene.js');
    const asx = read('game/src/scenes/ApiaryScene.js');
    ok(fs.includes('villageRepStatusSuffix') && asx.includes('villageRepStatusSuffix'), 'Forest/Apiary: статус в HUD');
    const jb = read('game/src/systems/jobs.js');
    ok(jb.includes("applyWageBalance(registry, base, 'potter')") && jb.includes("applyWageBalance(registry, base, 'carpenter')") && jb.includes("applyWageBalance(registry, base, 'mill')"), 'jobs.js: множители во всех подёнках');
    ok(jb.includes("{ noSeason: true, noDeal: true })"), 'jobs.js: служка — без сезона и торга');
    const ju = read('game/src/systems/justice.js');
    ok(ju.includes("escalatedNpcOffense(registry, npcId, 'suspect_fail'"), 'justice.js: провал проверки бьёт ×1.5');
    const ts2 = read('game/src/scenes/TitleScene.js');
    ok(ts2.includes('Молва живёт') && ts2.includes('ОПЛАТА'), 'TitleScene: справка обновлена (молва+оплата)');
}

console.log(`\n=== ИТОГ: ${pass} ✓ / ${fail} ✗ ===`);
if (fail > 0) process.exit(1);

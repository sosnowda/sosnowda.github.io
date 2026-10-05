// ============================================================
// ПАТЧ 66.82 (приказы владельца 1–9): ДОЛГОВАЯ СИСТЕМА —
// ЕДА И НОЧЛЕГ В ДОЛГ У ТРАКТИРЩИКА, УЧЁТ ДОЛГОВ, ОТСРОЧКА,
// ВЗЫСКАНИЕ ИМУЩЕСТВА СТРАЖНИКОМ.
//
// ПАТЧ 66.83 (приказы владельца 9, 10 — дополнение к 66.82):
//  • п.8 (дословно): имущество описывается «ВНАЧАЛЕ ИЗ ИНВЕНТАРЯ,
//    ПОТОМ НАДЕТОЕ» — надетое оружие и доспех уходят СЛЕД за узлом;
//  • п.9: имуществом не покрыл просроченные долги — ИЗГОЙСТВО:
//    q.expelledForDebts → checkGameEnd 'defeat_expelled_debts' →
//    финал «🚪 ИЗГНАН ЗА ДОЛГИ» = ПРОВАЛ ИГРЫ;
//  • п.10: ЗАКУП — hour работы у кредитора, вся плата идёт в счёт
//    долга; отказаться нельзя, пока весь долг не выплачен
//    (Русская Правда, ст. 56–62: закуп работает на купу).
//
//  1\ В меню персонажа рядом с казной — блок «ДОЛГИ»: строка на
//     каждый долг (кому, сколько, за что и когда возвращать).
//  2\ Еда в долг у трактирщика — ТОЛЬКО хлеб и каша (хмельного
//     в долг не дают: «пропьёшь»).
//  3\ Ночлег в долг у трактирщика — при нехватке денег.
//  4\ Долг дают ТОЛЬКО при положительной репутации: в деревне
//     И у трактирщика. Суммарный долг НЕ БОЛЬШЕ 100 д.
//     Просрочившему (есть неоплаченный долг мимо срока) нового
//     не дают — «сперва старый отдай».
//  5\ С КАЖДЫМ взятым долгом репутация ПАДАЕТ по сумме:
//     деревня −(1..4), трактирщик −(2..8) — чем больше долг.
//  6\ У каждого долга ДВА срока: выдачи и возврата. Срок —
//     неделя («до седьмого дня»).
//  7\ Просрочка: отсрочка через ПРОВЕРКУ РАЗГОВОРНОГО НАВЫКА
//     (Убеждение/Болтовня — лучший), НЕ БОЛЕЕ 3 РАЗ.
//  8\ Неуплата: СТРАЖНИК у ворот останавливает должника —
//     монеты идут в уплату первым взносом, затем описывается
//     имущество (не надетое) и продаётся ПО 50% БАЗОВОЙ ЦЕНЫ
//     в счёт долга; излишек возвращается должнику.
//  9\ ИСТОРИЧЕСКАЯ РАМКА (Русь XV века, проверка п.9):
//      • ссуда «под честное слово» БЕЗ ЛИХВЫ — Церковь лихоимство
//        не велит (учители осуждали «резы» ещё по Русской Правде);
//      • срок «до недели» — краткосрочные ссуды «до срока»
//        (неделя, ярмарка) — обыденная практика посада;
//      • отсрочка честному должнику — по образцу Судебника 1497,
//        ст. 55 «О заемех» (потерявшему не по своей вине — отсрочка);
//      • продажа движимого добра должника в счёт уплаты — обычная
//        судебная практика (правёж/продажа имущества); надетое и
//        оружие в руках не отбирают — «на человеке и последней
//        рубахи не берут»;
//      • в долг дают «своим» — кредит держится на доброй молве
//        и личном доверии (репутация в деревне и у заимодавца).
//
// Модуль registry-only — тестируется в Node (test_round129).
// ============================================================

import { t, tf, isEn, EN_MONTHS } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { skillCheck } from './BRPEngine.js';
import { getNpcRep, getVillageRep, changeNpcRepExact, changeVillageRepExact } from '../data/reputation.js';
import { getNpcDisplayName } from '../data/npcNames.js';
import { getLootDef } from './loot.js';
import { WEAPONS, ARMORS } from './Character.js';
import { MONTHS, getTime } from './TimeSystem.js';

// ---------------- КОНСТАНТЫ БАЛАНСА (точные значения приказов) ----------------

/** П.6: срок долга — неделя («до седьмого дня»). */
export const DEBT_TERM_DAYS = 7;
/** П.7: отсрочка тоже на неделю (Судебник 1497, ст. 55 — «о заемех»). */
export const DEFERRAL_TERM_DAYS = 7;
/** П.4: суммарный долг не может быть больше 100 монет. */
export const DEBT_MAX_TOTAL = 100;
/** П.7: отсрочек не более 3. */
export const DEBT_MAX_DEFERRALS = 3;
/** П.8: имущество должника продаётся по 50% базовой стоимости. */
export const CONFISCATION_PRICE_FACTOR = 0.5;
/** П.5: деревенская репутация за взятый долг — max(1, round(сумма/25)) → 1..4. */
export const DEBT_VILLAGE_REP_DIV = 25;
/** П.5: репутация у трактирщика за взятый долг — max(2, round(сумма/12)) → 2..8. */
export const DEBT_NPC_REP_DIV = 12;
/** Своевременный полный возврат: доверие заимодавца подрастает (+2). */
export const REPAY_ON_TIME_NPC_BONUS = 2;
/** П.7: провал просьбы об отсрочке — заимодавец не верит (репутация −3). */
export const DEFERRAL_FAIL_NPC_REP = -3;

/** П.2: в долг дают только еду — хлеб и кашу (хмельного в долг не дают). */
export const CREDIT_FOOD_IDS = ['bread', 'kasha'];

// ---------------- УТИЛИТЫ ВРЕМЕНИ ----------------

function cumDaysBefore(monthIdx) {
    let s = 0;
    for (let i = 0; i < Math.min(monthIdx, MONTHS.length); i++) s += MONTHS[i].days;
    return s;
}

/**
 * Абсолютный индекс игрового дня (монотонный через месяц и год).
 * 366 > 365 — годовой шаг гарантирует порядок через границу года.
 */
export function debtDayIndex(timeState) {
    if (!timeState) return 0;
    return timeState.yearFromChrist * 366 + cumDaysBefore(timeState.month) + timeState.day;
}

// ---------------- СОСТОЯНИЕ ----------------

function debtsStateOf(registry) {
    return (registry && registry.get('debtState')) || {
        loans: [],  // { id, npcId, kind, amount, issuedDayIdx, dueDayIdx, issuedTs:{day,month}, dueTs:{day,month}, deferrals }
        seq: 1,
    };
}

function saveDebtsState(registry, st) {
    if (registry) registry.set('debtState', st);
}

/** Все живые долги (погашенные удаляются). */
export function loansOf(registry) {
    return debtsStateOf(registry).loans;
}

/** Суммарный долг (п.4: не более 100). */
export function totalDebtOf(registry) {
    return loansOf(registry).reduce((s, l) => s + (l.amount || 0), 0);
}

/** Долг просрочен? (текущий день СТРОГО больше срока возврата) */
export function loanIsOverdue(loan, dayIdx) {
    return !loan || dayIdx > loan.dueDayIdx;
}

/** Просроченные долги (п.7/п.8 — отсрочка и стражник). */
export function overdueLoansOf(registry) {
    const now = debtDayIndex(getTime(registry));
    return loansOf(registry).filter(l => loanIsOverdue(l, now));
}

// ---------------- П.4: КТО МОЖЕТ ВЗЯТЬ ДОЛГ ----------------

/**
 * П.4: eligibility нового долга.
 *  • деревенская репутация > 0 И репутация у трактирщика > 0;
 *  • суммарный долг + новая сумма ≤ 100;
 *  • нет просрочки («сперва старый отдай»);
 *  • сумма ≥ 1.
 * @returns {{ ok:boolean, reason:string, totalDebt:number }}
 */
export function canTakeDebt(registry, amount) {
    const totalDebt = totalDebtOf(registry);
    const amt = Math.round(Number(amount) || 0);
    if (amt < 1) return { ok: false, reason: 'amount', totalDebt };
    if (overdueLoansOf(registry).length > 0) return { ok: false, reason: 'overdue', totalDebt };
    if (getVillageRep(registry) <= 0) return { ok: false, reason: 'rep_village', totalDebt };
    if (getNpcRep(registry, 'tavernkeeper') <= 0) return { ok: false, reason: 'rep_npc', totalDebt };
    if (totalDebt + amt > DEBT_MAX_TOTAL) return { ok: false, reason: 'cap', totalDebt };
    return { ok: true, reason: '', totalDebt };
}

// ---------------- П.5: ПАДЕНИЕ РЕПУТАЦИИ ПО СУММЕ ----------------

/** П.5: деревня — max(1, round(сумма/25)): 20 д. → −1, 50 → −2, 100 → −4. */
export function villageRepLossFor(amount) {
    return Math.max(1, Math.round((Number(amount) || 0) / DEBT_VILLAGE_REP_DIV));
}

/** П.5: трактирщик — max(2, round(сумма/12)): 20 д. → −2, 50 → −4, 100 → −8. */
export function npcRepLossFor(amount) {
    return Math.max(2, Math.round((Number(amount) || 0) / DEBT_NPC_REP_DIV));
}

// ---------------- ВЗЯТИЕ ДОЛГА (пп.2,3,5,6) ----------------

/**
 * Пп.2,3,5,6: взять в долг у трактирщика.
 * Долг создаётся с ДВУМЯ сроками (выдача и возврат, неделя),
 * репутация (деревня и трактирщик) падает по сумме.
 * @param {{ npcId?:string, kind:'food'|'lodging', amount:number }} opts
 * @returns {{ ok:boolean, reason?:string, loan?:object, villageLoss?:number, npcLoss?:number }}
 */
export function takeDebt(registry, opts) {
    const npcId = (opts && opts.npcId) || 'tavernkeeper';
    const kind = (opts && opts.kind) || 'food';
    const amount = Math.round(Number(opts && opts.amount) || 0);
    const chk = canTakeDebt(registry, amount);
    if (!chk.ok) return { ok: false, reason: chk.reason, totalDebt: chk.totalDebt };

    const ts = getTime(registry) || {};
    const nowIdx = debtDayIndex(ts);
    const dueIdx = nowIdx + DEBT_TERM_DAYS;
    const dueMonthShift = monthsAfterDays(ts, DEBT_TERM_DAYS);
    const st = debtsStateOf(registry);
    const loan = {
        id: 'debt' + (st.seq++),
        npcId, kind,
        amount,
        issuedDayIdx: nowIdx,
        dueDayIdx: dueIdx,
        issuedTs: { day: ts.day, month: ts.month },
        dueTs: dueMonthShift,
        deferrals: 0,
    };
    st.loans.push(loan);
    saveDebtsState(registry, st);

    // П.5: репутация падает по сумме — деревня и заимодавец
    const villageLoss = villageRepLossFor(amount);
    const npcLoss = npcRepLossFor(amount);
    changeVillageRepExact(registry, -villageLoss);
    const npcRepNow = changeNpcRepExact(registry, npcId, -npcLoss);
    const name = creditorNameOf(registry, npcId);
    ActionLog.add(registry, tf(t('Взял в долг у {0}: {1} — {2} д. (без лихвы, вернуть до {3}). Молва: деревня −{4}, у {0} −{5} (осталось {6}).'),
        name, debtKindName(kind), amount, debtDueLabelOf(loan), villageLoss, npcLoss, npcRepNow));
    return { ok: true, loan, villageLoss, npcLoss, npcRepNow };
}

function monthsAfterDays(ts, days) {
    // Сдвиг даты на N дней вперёд (календарь игры — MONTHS)
    let d = ts.day + days, m = ts.month;
    while (d > MONTHS[m].days) {
        d -= MONTHS[m].days;
        m++;
        if (m >= 12) m = 0;
    }
    return { day: d, month: m };
}

/** Название причины долга («еда» / «ночлег»). */
export function debtKindName(kind) {
    return kind === 'lodging' ? t('ночлег') : t('еда');
}

// ---------------- ВОЗВРАТ ДОЛГА (п.6) ----------------

/**
 * Вернуть долг (кнопка у трактирщика). Своевременный полный возврат
 * поднимает доверие заимодавца (+2, п.5-обратная логика); просроченный —
 * нет: молва помнит запоздание.
 * @returns {{ ok:boolean, paid?:number, onTime?:boolean, npcRepNow?:number, reason?:string }}
 */
export function repayLoan(registry, loanId) {
    const st = debtsStateOf(registry);
    const idx = st.loans.findIndex(l => l.id === loanId);
    if (idx < 0) return { ok: false, reason: 'no_loan' };
    const loan = st.loans[idx];
    const player = registry.get('player');
    if (!player || (player.dengas || 0) < loan.amount) return { ok: false, reason: 'poor', amount: loan.amount };

    player.dengas -= loan.amount;
    registry.set('player', player);
    const nowIdx = debtDayIndex(getTime(registry));
    const onTime = !loanIsOverdue(loan, nowIdx);
    st.loans.splice(idx, 1);
    saveDebtsState(registry, st);

    const name = creditorNameOf(registry, loan.npcId);
    let npcRepNow = getNpcRep(registry, loan.npcId);
    if (onTime) {
        npcRepNow = changeNpcRepExact(registry, loan.npcId, REPAY_ON_TIME_NPC_BONUS);
        ActionLog.add(registry, tf(t('Долг перед {0} возвращён в срок ({1} д.). Доверие подросло (репутация у {0} +{2}).'),
            name, loan.amount, REPAY_ON_TIME_NPC_BONUS));
    } else {
        ActionLog.add(registry, tf(t('Долг перед {0} возвращён с запозданием ({1} д.). {0} молчит, но помнит.'), name, loan.amount));
    }
    return { ok: true, paid: loan.amount, onTime, npcRepNow };
}

// ---------------- П.7: ОТСРОЧКА (разговорный навык, ≤3 раз) ----------------

/** Навык проверки — ЛУЧШИЙ из разговорных (Убеждение/Болтовня). */
function talkSkillOf(player) {
    const skills = (player && player.skills) || {};
    return Math.max(Number(skills.persuade) || 0, Number(skills.fast_talk) || 0, 1);
}

/**
 * П.7: просить отсрочку по ПРОСРОЧЕННОМУ долгу — проверка разговорного
 * навыка (по образцу Судебника 1497, ст. 55 «О заемех»: честному должнику
 * отсрочка). Успех — срок сдвигается на неделю, отсрочки ≤ 3 на долг.
 * Провал — заимодавец не верит (репутация у него −3), долг остаётся
 * просроченным.
 * @returns {{ ok?:boolean, reason?:string, roll?:number, skill?:number, deferrals?:number }}
 */
export function attemptDeferral(registry, loanId, player, { rng = Math.random } = {}) {
    const st = debtsStateOf(registry);
    const loan = st.loans.find(l => l.id === loanId);
    if (!loan) return { reason: 'no_loan' };
    if (loan.deferrals >= DEBT_MAX_DEFERRALS) return { reason: 'max_deferrals', deferrals: loan.deferrals };
    const nowIdx = debtDayIndex(getTime(registry));
    if (!loanIsOverdue(loan, nowIdx)) return { reason: 'not_overdue', deferrals: loan.deferrals };

    const raw = talkSkillOf(player);
    const res = skillCheck(raw);
    const ok = res.result === 'critical' || res.result === 'success';
    const name = creditorNameOf(registry, loan.npcId);
    if (ok) {
        loan.deferrals++;
        loan.dueDayIdx = nowIdx + DEFERRAL_TERM_DAYS;
        loan.dueTs = monthsAfterDays(getTime(registry), DEFERRAL_TERM_DAYS);
        saveDebtsState(registry, st);
        ActionLog.add(registry, tf(t('{0} согласился подождать до {1} (проверка {2}%: бросок {3}). Отсрочка №{4} — больше трёх не будет.'),
            name, debtDueLabelOf(loan), raw, res.roll, loan.deferrals));
        return { ok: true, roll: res.roll, skill: raw, deferrals: loan.deferrals };
    }
    changeNpcRepExact(registry, loan.npcId, DEFERRAL_FAIL_NPC_REP);
    ActionLog.add(registry, tf(t('{0} не поверил обещаниям (проверка {1}%: бросок {2}). «Слов у тебя много, долгу — ни полушки». Репутация у него −{3}.'),
        name, raw, res.roll, Math.abs(DEFERRAL_FAIL_NPC_REP)));
    return { ok: false, roll: res.roll, skill: raw, deferrals: loan.deferrals };
}

// ---------------- П.8: ВЗЫСКАНИЕ СТРАЖНИКОМ У ВОРОТ ----------------

/** Базовая стоимость предмета узла (лут → цена сбыта; оружие/броня → цена). */
function baseValueOf(entry) {
    const def = getLootDef(entry && entry.id);
    if (def) return def.sell || 0;
    const w = WEAPONS[entry && entry.id];
    if (w) return w.price || 0;
    const a = ARMORS[entry && entry.id];
    if (a) return a.price || 0;
    return 0;
}

/** Есть ли у стражника долговое дело (просроченный долг, п.8). */
export function guardDebtNeeded(registry) {
    return overdueLoansOf(registry).length > 0;
}

/**
 * П.8 (превью, без списаний): счёт взыскания — монеты, опись имущества
 * (не надетое) с ценой продажи по 50% базовой стоимости.
 */
export function debtGuardBill(registry) {
    const player = registry.get('player');
    const loans = overdueLoansOf(registry);
    const totalDebt = loans.reduce((s, l) => s + (l.amount || 0), 0);
    const coins = Math.min(player ? (player.dengas || 0) : 0, totalDebt);
    const items = [];
    const wornItems = [];
    let saleTotal = 0;
    ((player && player.inventory) || []).forEach((entry, index) => {
        if (!entry || !entry.id) return;
        // Надетое (оружие/доспех) описывается СЛЕДОМ за инвентарём (п.8),
        // поэтому в первую опись не попадает
        if (player.weaponId && entry.id === player.weaponId) return;
        if (player.armorId && entry.id === player.armorId) return;
        const base = baseValueOf(entry);
        if (base <= 0) return;
        const def = getLootDef(entry.id);
        const unit50 = Math.max(1, Math.floor(base * CONFISCATION_PRICE_FACTOR));
        const count = entry.count || 1;
        const sale50 = unit50 * count;
        saleTotal += sale50;
        items.push({
            index, id: entry.id,
            name: def ? def.name : entry.id,
            emoji: def ? def.emoji : '📦',
            count, unit50, sale50,
        });
    });
    // ПАТЧ 66.83 (п.8 дословно): «потом НАДЕТОЕ» — оружие в руках,
    // затем доспех; продаются по той же цене 50% базовой стоимости.
    [['weaponId', WEAPONS, '⚔'], ['armorId', ARMORS, '🛡']].forEach(([slot, REG, emoji]) => {
        const id = player[slot];
        if (!id || id === 'fists' || id === 'none') return;
        const def = REG[id];
        if (!def || !def.price) return;
        const sale50 = Math.max(1, Math.floor(def.price * CONFISCATION_PRICE_FACTOR));
        wornItems.push({ slot, id, name: def.name, emoji, count: 1, sale50 });
    });
    const saleAll = saleTotal + wornItems.reduce((s, w) => s + w.sale50, 0);
    return { loans, totalDebt, coins, items, wornItems, saleTotal, saleAll, covered: coins + saleAll >= totalDebt };
}

/**
 * П.8: ВЗЫСКАНИЕ по долгам (списания). Монеты — первый взнос; затем
 * описывается имущество (от дешёвого к дорогому) и продаётся по 50%
 * базовой цены; излишек возвращается должнику. Долги гасятся от
 * старшего срока к младшему; недопогашенное остаётся долгом.
 * @returns {{ coinsTaken:number, takenItems:Array, collected:number, surplus:number, settled:Array, stillOwed:number }}
 */
export function debtGuardCollect(registry) {
    const player = registry.get('player');
    const bill = debtGuardBill(registry);
    let owed = bill.totalDebt;

    // 1) Монеты — первый взнос
    const coinsTaken = Math.min(player.dengas || 0, owed);
    player.dengas = (player.dengas || 0) - coinsTaken;
    owed -= coinsTaken;

    // 2) Имущество — от дешёвого к дорогому, пока долг не покрыт
    const takenItems = [];
    let collected = coinsTaken;
    const sorted = [...bill.items].sort((a, b) => a.sale50 - b.sale50);
    for (const item of sorted) {
        if (owed <= 0) break;
        const entry = (player.inventory || [])[item.index];
        if (!entry || entry.id !== item.id) continue; // страховка рассинхрона
        player.inventory.splice(item.index, 1);
        // индексы сдвинулись — пересчитать (строка ниже защищает от повторных сплайсов)
        sorted.forEach(x => { if (x.index > item.index) x.index--; });
        takenItems.push(item);
        collected += item.sale50;
        owed -= item.sale50;
    }

    // 2б) ПАТЧ 66.83 (п.8 дословно): «потом НАДЕТОЕ» — оружие в руках,
    // затем доспех, пока долг не покрыт.
    const takenWorn = [];
    bill.wornItems.forEach((w) => {
        if (owed <= 0) return;
        if (w.slot === 'weaponId' && player.weaponId === w.id) {
            player.weaponId = 'fists';
        } else if (w.slot === 'armorId' && player.armorId === w.id) {
            player.armorId = 'none';
        } else {
            return;
        }
        takenWorn.push(w);
        takenItems.push(w);
        collected += w.sale50;
        owed -= w.sale50;
    });

    // 3) Излишек продажи — должнику (продали лишнего — вернули остаток)
    const surplus = Math.max(0, -owed);
    if (surplus > 0) {
        player.dengas += surplus;
        owed = 0;
    }
    registry.set('player', player);

    // 4) Долги гасятся от старшего срока к младшему
    const st = debtsStateOf(registry);
    let pool = collected - surplus;
    const settled = [];
    st.loans
        .filter(l => bill.loans.some(b => b.id === l.id))
        .sort((a, b) => a.dueDayIdx - b.dueDayIdx)
        .forEach(loan => {
            if (pool <= 0) return;
            const part = Math.min(pool, loan.amount);
            loan.amount -= part;
            pool -= part;
            if (loan.amount <= 0) {
                st.loans = st.loans.filter(l => l.id !== loan.id);
            }
            settled.push({ id: loan.id, paid: part, cleared: loan.amount <= 0 });
        });
    saveDebtsState(registry, st);

    const stillOwed = totalDebtOf(registry);
    const name = creditorNameOf(registry, 'tavernkeeper');

    // ПАТЧ 66.83 (п.9): ИЗГОЙСТВО — всего имущества (мошна, узел, надетое)
    // не хватило на просроченные долги: должника изгоняют, ПРОВАЛ ИГРЫ.
    let expelled = false;
    if (stillOwed > 0) {
        expelled = true;
        player.inventory = [];
        player.dengas = 0;
        registry.set('player', player);
        const q = registry.get('quest') || {};
        q.expelledForDebts = true; // → checkGameEnd 'defeat_expelled_debts'
        q.currentObjective = t('Долги не выплачены: имущество продано, из деревни изгнан.');
        registry.set('quest', q);
        ActionLog.add(registry, tf(t('ПРАВЁЖ доверху: мошна и всё добро должника ушли на уплату ({0} д.), а долг цел — ещё {1} д. ИЗГОЙСТВО: из деревни изгнан!'),
            collected, stillOwed));
    } else {
        ActionLog.add(registry, tf(t('Стражник у ворот описал добро должника: монет {0} д., имущество продано за {1} д. (50% цены) — в счёт долга перед {2}. {3}'),
            coinsTaken, collected - coinsTaken - surplus, name, t('Долг покрыт.')));
    }
    return { coinsTaken, takenItems, takenWorn, collected, surplus, settled, stillOwed, expelled };
}

// ---------------- ПАТЧ 66.83 (п.10): ЗАКУП — ОТРАБОТКА ДОЛГА ----------------

/** Ставка закупа за час (без лихвы и без торга — работа в счёт долга). */
export const DEBT_WORK_WAGE = () => 3 + Math.floor(Math.random() * 3); // 3..5 д.

/**
 * П.10: ЗАКУП — час работы у кредитора (дрова, вода, чаны), и ВСЯ плата
 * идёт в погашение долга (по старшинству срока). Отказаться от закупа
 * нельзя, пока весь долг не выплачен: любой час, отработанный у кредитора,
 * оплачивается только в счёт долга (Русская Правда, ст. 56–62).
 * Час времени, усталость и здоровье ведёт сцена.
 * @returns {{ wage:number, applied:number, surplus:number, debtLeft:number }}
 */
export function workOffDebt(registry, npcId) {
    const player = registry.get('player');
    const st = debtsStateOf(registry);
    const mine = st.loans.filter(l => l.npcId === npcId);
    if (!mine.length) return { wage: 0, applied: 0, surplus: 0, debtLeft: 0 };
    const wage = DEBT_WORK_WAGE();
    let left = wage;
    const appliedLoans = mine.sort((a, b) => a.dueDayIdx - b.dueDayIdx);
    appliedLoans.forEach((loan) => {
        if (left <= 0) return;
        const part = Math.min(loan.amount, left);
        loan.amount -= part;
        left -= part;
        loan.bonded = true; // закуп подтверждён работой
    });
    st.loans = st.loans.filter(l => l.amount > 0);
    // Лишек (плата перекрыла остаток долга) — обратно в мошну деньгами
    if (left > 0) {
        player.dengas = (player.dengas || 0) + left;
    }
    registry.set('player', player);
    saveDebtsState(registry, st);
    const applied = wage - left;
    const debtLeft = totalDebtOf(registry);
    ActionLog.add(registry, debtLeft > 0
        ? tf(t('Отработал закупом час у {0}: {1} д. платы ушло в счёт долга (осталось {2} д.).'), creditorNameOf(registry, npcId), applied, debtLeft)
        : tf(t('Отработал закупом час у {0}: {1} д. платы закрыли долг ПОЛНОСТЬЮ — закуп кончился!'), creditorNameOf(registry, npcId), applied));
    return { wage, applied, surplus: left, debtLeft };
}

/** В закупах ли игрок у этого кредитора (п.10 — «отказаться нельзя»). */
export function isBondedTo(registry, npcId) {
    return loansOf(registry).some(l => l.npcId === npcId && l.bonded);
}

// ---------------- ИМЕНА И СТРОКИ ДЛЯ UI (пп.1, 6) ----------------

/** Имя заимодавца («Фёдор, трактирщик»); без знакомства — «трактирщик». */
export function creditorNameOf(registry, npcId) {
    const name = getNpcDisplayName(registry, npcId);
    if (!name || name === t('незнакомец')) return t('трактирщик');
    return name;
}

/** Дата славянским календарём: «до 21 сентября» / «due 21 September». */
export function debtDateLabel(ts) {
    if (!ts) return '—';
    const m = ts.month || 0;
    if (isEn()) return `due ${ts.day} ${EN_MONTHS[m]}`;
    return `до ${ts.day} ${MONTHS[m] ? MONTHS[m].name : ''}`;
}

/** Причина отказа в кредите — словами заимодавца (для диалогов). */
export function debtRefusalLine(reason) {
    switch (reason) {
        case 'rep_village':
            return t('«Ты мне незнаком, доброго о тебе не слыхал. В долг дают своим — поди заслужи молву добрую».\n\n(Долг дают только при ПОЛОЖИТЕЛЬНОЙ репутации в деревне.)');
        case 'rep_npc':
            return t('«Ты мне пока не по сердцу. Поди заслужи доверие — помоги чем, слово доброе скажи, тогда и в долг дам».\n\n(Долг дают только при ПОЛОЖИТЕЛЬНОЙ репутации у трактирщика.)');
        case 'overdue':
            return t('«Сперва старый долг отдай — потом о новом заговорим. А стражник у ворот про твою просрочку уже знает».\n\n(Есть просроченный долг — сперва отдай его или выпроси отсрочку.)');
        case 'cap':
            return t('«Сотни долгов на тебе не наживу. Отдай, что есть, — тогда и подойди».\n\n(Суммарный долг не может быть больше 100 д.)');
        default:
            return t('«Не выйдет. Приходи, когда дело поправится».');
    }
}

/** Превью срока возврата (для текста ДО взятия долга): «до 21 сентября». */
export function previewDueLabelOf(registry, termDays = DEBT_TERM_DAYS) {
    const ts = getTime(registry) || { day: 1, month: 0 };
    return debtDateLabel(monthsAfterDays(ts, termDays));
}

/** Дата возврата долга: «до 21 сентября» / «due 21 September». */
export function debtDueLabelOf(loan) {
    return loan ? debtDateLabel(loan.dueTs) : '—';
}

/** Дата выдачи долга: «взят 14 сентября» / «taken 14 September». */
export function debtIssuedLabelOf(loan) {
    if (!loan || !loan.issuedTs) return '—';
    if (isEn()) return `taken ${loan.issuedTs.day} ${EN_MONTHS[loan.issuedTs.month || 0]}`;
    return `взят ${loan.issuedTs.day} ${MONTHS[loan.issuedTs.month || 0] ? MONTHS[loan.issuedTs.month].name : ''}`;
}

/** Короткая строка долга для свитка персонажа (п.1): кому, сколько, за что, срок. */
export function debtShortLineOf(registry, loan) {
    const nowIdx = debtDayIndex(getTime(registry));
    const overdue = loanIsOverdue(loan, nowIdx);
    const tail = overdue ? t(' — ПРОСРОЧЕНО!') : '';
    return tf(t('{0} — {1} д. ({2}), {3}{4}'),
        creditorNameOf(registry, loan.npcId), loan.amount, debtKindName(loan.kind), debtDueLabelOf(loan), tail);
}

/** Полная строка долга для меню у трактирщика (п.6): ДВА срока — «взят …, до …». */
export function debtFullLineOf(registry, loan) {
    const nowIdx = debtDayIndex(getTime(registry));
    const overdue = loanIsOverdue(loan, nowIdx);
    return tf(t('{0}: {1} д. ({2}) — {3}, {4}{5}'),
        creditorNameOf(registry, loan.npcId), loan.amount, debtKindName(loan.kind),
        debtIssuedLabelOf(loan), debtDueLabelOf(loan),
        overdue ? t(' ⚠ ПРОСРОЧЕНО') : '');
}

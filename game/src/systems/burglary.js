// ============================================================
// ПАТЧ 66.74 (приказы владельца 13–18): ВЗЛОМ И СУНДУКИ.
//
// «13\ Добавить новый Навык: "Взлом". Чтобы можно было взламывать
//      закрытые дома и красть ценные предметы у жильцов.
//  14\ добавить в каждый дом: Сундук. в котором должно находится добро,
//      который можно добыть из сундука с помощью Навыка: Взлом.
//  15\ Лут в сундуке должен быть случайный (1-5 штук), но в зависимости
//      от дома и его хозяев, но всё должно быть исторично и логично
//      Руси 15 века.
//  16\ взлом Сундука можно производить, только если в доме никого нету!
//      взломать Сундук и получить лут, можно не чаще раза в месяц.
//  17\ взламывать дом можно только если рядом нету НПЦ.
//  18\ Любой Взлом, может вызвать падение Репутации в Деревне, если
//      не пройдёт проверка Навыка: Скрадывание.»
//
// (Раунд 66.10 сундуки удалялись по приказу «СУНДУКИ/ТАЙНИКИ НЕ НУЖНО» —
//  настоящий патч по ПРЯМОМУ приказу владельца возвращает их с честной
//  механикой взлома; решение 66.10 отменено.)
//
// Правила (модуль registry-only, тестируется в Node):
//  • сундуки стоят в ЖИЛЫХ домах (постоялый двор и церковь — общественные,
//    всегда на глазах — там сундука нет);
//  • попытка (дверь ИЛИ сундук) = СНАЧАЛА Скрадывание (приказ 18): провал —
//    молва крепчает ГЕОМЕТРИЧЕСКИ: −2/−4/−8/−16/−32 к репутации деревни
//    (патч 66.78 п.1, systems/crime.js), попытка сорвана;
//  • ВО ВРЕМЯ воровства хозяева МОГУТ ВЕРНУТЬСЯ: застукали — репутация у
//    хозяев −30, в деревне −20; могут и НАПАСТЬ (мужчины — 40%, женщины
//    — 10%) — патч 66.78 пп.2–3 (rollOwnersReturn из crime.js);
//  • затем Взлом: дверь — успех открывает пустой дом; сундук — успех даёт
//    ЛУТ 1–5 штук по таблице дома (крит — все 5, «вытряс до донышка»);
//  • сундук обчищается ОДИН РАЗ В ИГРОВОЙ МЕСЯЦЬ (приказ 16);
//  • попытка — ФИКСИРОВАННО 10 минут времени (патч 66.78 п.8; тратит
//    сцена), усталость — тоже сцена.
//
// Патч 66.79 (пп.9–10): opts.deferOwners — бросок хозяев выполняется,
// но ПОСЛЕДСТВИЯ (−30/−20, нападение) НЕ применяются: сцена сначала
// показывает красный поп-ап «к дому идут хозяева» с возможностью
// сбежать (Ловкость/Скрадывание); застукали только при провале побега
// (crime.applyOwnersCaught). Без deferOwners — прежнее поведение.
// ============================================================

import { t, tf } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { skillCheck } from './BRPEngine.js';
import { getBlessedSkill } from '../data/questGenerator.js';
// Патч 66.78 (пп.1–3): геометрическая молва + хозяева вернулись/напали
import { noteStealthFail, rollOwnersReturn } from './crime.js';

/**
 * Сундуки жилых домов. loot — взвешенная таблица добра:
 *   { id, w }          — предмет узла (loot.js, идёт в инвентарь);
 *   { dengas:[min,max], w } — деньги из шкатулки (сразу в кошель).
 * Историческая логика: у старосты и торговцев — деньги, сукно, воск;
 * у крестьян — зерно, сало, горшки; у бортника — мёд; у гончара — горшки;
 * у знахарки — травы; у мясника — сало и мясо; у сапожника — кожа.
 */
export const CHEST_HOUSES = {
    elder_house: { label: t('сундук старосты'), loot: [
        { dengas: [6, 18], w: 3 }, { id: 'sukon', w: 2 }, { id: 'wax', w: 2 },
        { id: 'honey', w: 2 }, { id: 'amber', w: 1 }, { id: 'polotno', w: 1 }, { id: 'clay_pot', w: 1 },
    ] },
    blacksmith: { label: t('сундук кузницы'), loot: [
        { id: 'iron', w: 3 }, { dengas: [3, 10], w: 3 }, { id: 'salo', w: 1 }, { id: 'polotno', w: 1 },
    ] },
    villager_house_1: { label: t('сундук Авдея'), loot: [
        { id: 'grain', w: 3 }, { id: 'salo', w: 2 }, { id: 'clay_pot', w: 2 },
        { dengas: [1, 5], w: 2 }, { id: 'polotno', w: 1 }, { id: 'ubrus', w: 1 },
    ] },
    villager_house_2: { label: t('сундук Марфы'), loot: [
        { id: 'polotno', w: 2 }, { id: 'ubrus', w: 2 }, { id: 'herb', w: 2 },
        { dengas: [1, 4], w: 2 }, { id: 'grain', w: 1 },
    ] },
    beekeeper_house: { label: t('сундук Тараса'), loot: [
        { id: 'honey', w: 3 }, { id: 'wax', w: 3 }, { dengas: [2, 7], w: 2 },
        { id: 'grain', w: 1 }, { id: 'polotno', w: 1 },
    ] },
    potter_house: { label: t('сундук гончара'), loot: [
        { id: 'clay_pot', w: 4 }, { id: 'master_pot', w: 1 }, { dengas: [2, 6], w: 2 },
        { id: 'polotno', w: 1 }, { id: 'grain', w: 1 },
    ] },
    healer_house: { label: t('сундук знахарки'), loot: [
        { id: 'herb', w: 3 }, { id: 'honey', w: 2 }, { dengas: [3, 8], w: 2 },
        { id: 'ubrus', w: 1 }, { id: 'wax', w: 1 },
    ] },
    fisher_house: { label: t('сундук рыбака'), loot: [
        { id: 'fish_raw', w: 3 }, { id: 'polotno', w: 2 }, { dengas: [1, 5], w: 2 },
        { id: 'salo', w: 1 }, { id: 'clay_pot', w: 1 },
    ] },
    carpenter_house: { label: t('сундук плотника'), loot: [
        { id: 'iron', w: 2 }, { dengas: [2, 7], w: 2 }, { id: 'polotno', w: 1 },
        { id: 'grain', w: 1 }, { id: 'salo', w: 1 }, { id: 'clay_pot', w: 1 },
    ] },
    weaver_house: { label: t('сундук ткачихи'), loot: [
        { id: 'polotno', w: 3 }, { id: 'sukon', w: 2 }, { id: 'ubrus', w: 2 }, { dengas: [2, 6], w: 2 },
    ] },
    grocer_house: { label: t('сундук Прасковьи'), loot: [
        { dengas: [5, 15], w: 3 }, { id: 'grain', w: 2 }, { id: 'salo', w: 2 },
        { id: 'honey', w: 1 }, { id: 'sukon', w: 1 }, { id: 'wax', w: 1 },
    ] },
    butcher_house: { label: t('сундук Потапа'), loot: [
        { id: 'salo', w: 3 }, { id: 'meat_raw', w: 3 }, { dengas: [3, 10], w: 2 }, { id: 'iron', w: 1 },
    ] },
    shop_tools: { label: t('сундук Аверьяна'), loot: [
        { dengas: [5, 12], w: 3 }, { id: 'iron', w: 2 }, { id: 'amber', w: 1 },
        { id: 'polotno', w: 1 }, { id: 'wax', w: 1 }, { id: 'sukon', w: 1 },
    ] },
    shoemaker_house: { label: t('сундук сапожника'), loot: [
        { id: 'skin', w: 3 }, { dengas: [2, 6], w: 2 }, { id: 'polotno', w: 1 },
        { id: 'salo', w: 1 }, { id: 'iron', w: 1 },
    ] },
    woodcutter_house: { label: t('сундук дровосека'), loot: [
        { id: 'grain', w: 2 }, { id: 'salo', w: 2 }, { dengas: [1, 4], w: 2 },
        { id: 'iron', w: 1 }, { id: 'polotno', w: 1 },
    ] },
    villager_house_3: { label: t('сундук Степана'), loot: [
        { id: 'grain', w: 3 }, { id: 'salo', w: 2 }, { id: 'clay_pot', w: 2 },
        { dengas: [1, 5], w: 2 }, { id: 'polotno', w: 1 },
    ] },
};

/** Есть ли сундук в этом интерьере (жилые дома — да; общественные — нет). */
export function hasChest(interiorId) {
    return !!CHEST_HOUSES[interiorId];
}

/** Ключ игрового месяца (раз в месяц — приказ 16; месяц 0 = сентябрь). */
export function monthKeyOf(timeState) {
    return timeState ? `${timeState.yearFromChrist}-${timeState.month}` : null;
}

function chestStateOf(registry) {
    const st = registry && registry.get('chestState');
    return (st && st.houses) ? st : { houses: {} };
}

/** Можно ли обчищать сундук в этом доме в текущем месяце. */
export function canPickChest(registry, interiorId, timeState) {
    const mk = monthKeyOf(timeState);
    if (!mk || !CHEST_HOUSES[interiorId]) return false;
    const st = chestStateOf(registry);
    return st.houses[interiorId] !== mk;
}

/** Отметить сундук обчищенным до конца месяца. */
export function markChestPicked(registry, interiorId, timeState) {
    const mk = monthKeyOf(timeState);
    if (!mk || !registry) return;
    const st = chestStateOf(registry);
    st.houses[interiorId] = mk;
    registry.set('chestState', st);
}

/**
 * Проверка Скрадывания перед ЛЮБЫМ взломом (приказ 18).
 * Провал — «заметили»: репутация деревни падает ГЕОМЕТРИЧЕСКИ от числа
 * провалов (патч 66.78 п.1): −2, −4, −8, −16, −32 (потолок −32).
 * @returns {{ ok:boolean, roll:number, skill:number, penalty:number }}
 */
export function stealthForBurglary(registry, stealthSkill) {
    const skill = getBlessedSkill(registry, Math.max(1, Number(stealthSkill) || 1));
    const res = skillCheck(skill);
    let penalty = 0;
    if (res.result === 'fail' || res.result === 'fumble') {
        penalty = noteStealthFail(registry).penalty; // геометрическая молва (66.78 п.1)
    }
    return { ok: res.result === 'critical' || res.result === 'success', roll: res.roll, skill, penalty };
}

/**
 * Попытка ВЗЛОМА ДВЕРИ закрытого дома (приказы 13, 17 — «рядом нет НПЦ»
 * проверяет сцена ДО вызова). Скрадывание → Взлом.
 * @returns {{ stealthFailed:boolean, lockFailed:boolean, done:boolean,
 *             stealthRoll:number, lockRoll:number, stealthSkill:number, lockSkill:number, stealthPenalty:number }}
 */
export function attemptBreakIn(registry, player, { stealth: stealthSkill, lock: lockSkill } = {}) {
    const st = stealthForBurglary(registry, stealthSkill);
    if (!st.ok) {
        return { stealthFailed: true, lockFailed: false, done: false, stealthRoll: st.roll, stealthSkill: st.skill, stealthPenalty: st.penalty, lockRoll: 0, lockSkill: 0 };
    }
    const lock = getBlessedSkill(registry, Math.max(1, Number(lockSkill) || 1));
    const res = skillCheck(lock);
    const done = res.result === 'critical' || res.result === 'success';
    return { stealthFailed: false, lockFailed: !done, done, stealthRoll: st.roll, stealthSkill: st.skill, stealthPenalty: st.penalty, lockRoll: res.roll, lockSkill: lock };
}

/** Взвешенный бросок по таблице дома. Внутренняя функция. */
function rollOne(table, rng) {
    const total = table.reduce((s, e) => s + e.w, 0);
    let r = rng() * total;
    for (const e of table) {
        r -= e.w;
        if (r <= 0) return e;
    }
    return table[table.length - 1];
}

/**
 * Попытка ВЗЛОМА СУНДУКА (приказы 14–16). Скрадывание → ХОЗЯЕВА (66.78
 * пп.2–3: могут вернуться и застукать; могут напасть) → Взлом → лут.
 * Сундук помечается обчищенным ТОЛЬКО при удаче; провал замка можно
 * повторить (пока дом пуст) — каждая попытка это время и риск Скрадывания.
 * @param {Object} opts — { stealth, lock, rng, hostNpcId, deferOwners } (hostNpcId —
 *   личная репутация хозяев падает при застукивании, приказ 2; deferOwners —
 *   66.79 пп.9–10: застукавшие НЕ карают сразу — сцена даёт шанс побега).
 * @returns {{ blocked:'month'|null, stealthFailed:boolean, lockFailed:boolean,
 *             done:boolean, items:Array<{id:string,count:number}>, dengas:number,
 *             crit:boolean, roll:number, skill:number, stealthRoll:number,
 *             stealthSkill:number, stealthPenalty:number,
 *             ownersCame:boolean, hostAttacks:boolean }}
 */
export function attemptChestPick(registry, player, interiorId, timeState, { stealth: stealthSkill, lock: lockSkill, rng = Math.random, hostNpcId = null, deferOwners = false } = {}) {
    const cfg = CHEST_HOUSES[interiorId];
    if (!cfg) return { blocked: 'no_chest', stealthFailed: false, lockFailed: false, done: false, items: [], dengas: 0, crit: false, roll: 0, skill: 0, stealthRoll: 0, stealthSkill: 0, stealthPenalty: 0, ownersCame: false, hostAttacks: false };
    if (!canPickChest(registry, interiorId, timeState)) {
        return { blocked: 'month', stealthFailed: false, lockFailed: false, done: false, items: [], dengas: 0, crit: false, roll: 0, skill: 0, stealthRoll: 0, stealthSkill: 0, stealthPenalty: 0, ownersCame: false, hostAttacks: false };
    }
    const st = stealthForBurglary(registry, stealthSkill);
    if (!st.ok) {
        return { blocked: null, stealthFailed: true, lockFailed: false, done: false, items: [], dengas: 0, crit: false, roll: 0, skill: 0, stealthRoll: st.roll, stealthSkill: st.skill, stealthPenalty: st.penalty, ownersCame: false, hostAttacks: false };
    }
    // ПАТЧ 66.78 (пп.2–3): во время воровства хозяева могут вернуться домой.
    // Застукали — репутация у хозяев −30, деревенская −20 (внутри rollOwnersReturn);
    // попытка сорвана, сундук НЕ помечается — добро при хозяевах.
    // ПАТЧ 66.79 (пп.9–10): deferOwners — без списаний: сцена даёт
    // игроку шанс СБЕЖАТЬ (Ловкость/Скрадывание) до прихода хозяев.
    const owners = rollOwnersReturn(registry, {
        hostNpcId,
        interiorId,
        hour: timeState ? timeState.hour : 12,
        rng,
        defer: deferOwners,
    });
    if (owners.came) {
        return { blocked: null, stealthFailed: false, lockFailed: false, done: false, items: [], dengas: 0, crit: false, roll: 0, skill: 0, stealthRoll: st.roll, stealthSkill: st.skill, stealthPenalty: st.penalty, ownersCame: true, hostAttacks: owners.attack, ownersDeferred: deferOwners };
    }
    const lock = getBlessedSkill(registry, Math.max(1, Number(lockSkill) || 1));
    const res = skillCheck(lock);
    const failed = res.result === 'fail' || res.result === 'fumble';
    if (failed) {
        return { blocked: null, stealthFailed: false, lockFailed: true, done: false, items: [], dengas: 0, crit: false, roll: res.roll, skill: lock, stealthRoll: st.roll, stealthSkill: st.skill, stealthPenalty: st.penalty, ownersCame: false, hostAttacks: false };
    }
    // ЛУТ: приказ 15 — случайный 1–5 штук; крит — все 5 («вытряс до донышка»).
    const crit = res.result === 'critical';
    const n = crit ? 5 : 1 + Math.floor(rng() * 5);
    const items = [];
    const byId = {};
    let dengas = 0;
    for (let i = 0; i < n; i++) {
        const e = rollOne(cfg.loot, rng);
        if (e.dengas) {
            const [min, max] = e.dengas;
            dengas += min + Math.floor(rng() * (max - min + 1));
        } else if (e.id) {
            byId[e.id] = (byId[e.id] || 0) + 1;
        }
    }
    Object.keys(byId).forEach(id => items.push({ id, count: byId[id] }));
    markChestPicked(registry, interiorId, timeState);
    return { blocked: null, stealthFailed: false, lockFailed: false, done: true, items, dengas, crit, roll: res.roll, skill: lock, stealthRoll: st.roll, stealthSkill: st.skill, stealthPenalty: st.penalty, ownersCame: false, hostAttacks: false };
}

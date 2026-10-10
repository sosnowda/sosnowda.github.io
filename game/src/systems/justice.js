// ============================================================
// ПАТЧ 66.79 (приказы владельца 1–13): ПРАВОСУДИЕ — ПОДОЗРЕНИЯ,
// СТРАЖНИК У ВОРОТ, ВИРА ПО СУДЕБНИКУ, ПРИМИРЕНИЕ, ИЗГНАНИЕ.
//
//  1\ Обворованные НПЦ ВСЕГДА подозревают игрока: нужна проверка
//     разговорного навыка (Убеждение/Болтовня — берём лучший),
//     чтобы отвести подозрение в воровстве и взломе.
//  2\ Удачная проверка — НПЦ перестаёт подозревать ДО СЛЕДУЮЩЕЙ кражи.
//  3\ Повторная кража у ОДНОГО И ТОГО ЖЕ НПЦ — сложность проверки
//     «невиновности» растёт (−15% за каждую прежнюю кражу у него).
//  4\ Неудачная проверка: репутация у этого НПЦ −10 (точно),
//     деревенская репутация −5 (точно).
//  5\ Уличённого в воровстве у ВОРОТ останавливает СТРАЖНИК:
//     осмотр узла (инвентаря), краденое ИЗЫМАЕТСЯ (возвращается
//     хозяевам), вира по Судебнику 1497 (продажа 24 д. = 12 кун по 2 д.;
//     66.97 §12.3 п.5: прежнее «12 гривен» противоречило лору денег —
//     гривна в Character.CURRENCY = 100 д., второй гривны в лоре нет),
//     + урок за ПРОДАННОЕ краденое по полной стоимости), репутация
//     в деревне сильно падает (−15 × множитель).
//  6\ ПРИМИРЕНИЕ с обкраденным НПЦ: вернуть всё украденное (вещами)
//     или компенсировать деньгами по полной стоимости (если продано
//     Скупщику) + вира за кражу (24 д.). После мира подозрение снято,
//     стражнику за этот дом причины нет.
//  7\ Повторная ПОИМКА: вира и падение репутации ×3.
//  8\ Третья поимка: у игрока отбирают ВСЁ имущество и ИЗГОНЯЮТ из
//     деревни — ПРОВАЛ И ОКОНЧАНИЕ ИГРЫ (флаг expelledFromVillage).
//
// Историческая рамка (проверка п.13): Судебник 1497 «о татбе»
// (ст. 10–13, 52, 55): за татьбу — «продажа» казначею (в игре —
// старосте) и «урок» потерпевшему по цене похищенного; повторная
// татьба каралась жёстче («торговая казнь», выдача головою), за
// третью — «поток и разграбление» (Русская Правда, ст. 7) — в игре
// изгнание. Вира как термин идёт от Русской Правды; в разговорах
// жителей слово «вирá» уже закреплено раундом 45 (примирение).
//
// Модуль registry-only — тестируется в Node (test_round127).
// ============================================================

import { t, tf } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { skillCheck } from './BRPEngine.js';
import { getBlessedSkill } from '../data/questGenerator.js';
import { getNpcRep, getVillageRep, changeNpcRepExact, changeVillageRepExact } from '../data/reputation.js';
import { getNpcDisplayName } from '../data/npcNames.js';
import { getLootDef } from './loot.js';
// Патч 66.80 (п.11-д): повторная однотипная обида бьёт ×1.5 (−10 → −15 → −22…)
import { escalatedNpcOffense, offenseCountOf, REP_STATUS_SUSPICIOUS } from './repBalance.js';

// ---------------- КОНСТАНТЫ БАЛАНСА (точные значения приказов) ----------------

/** П.3: сколько % снимается с проверки «невиновности» за каждую ПРЕЖНЮЮ кражу у того же НПЦ. */
export const SUSPECT_PENALTY_PER_RETHEFT = 15;
/** П.4: репутация у НПЦ при провале проверки «невиновности» (точно). */
export const SUSPECT_FAIL_NPC_REP = -10;
/** П.4: деревенская репутация при провале проверки «невиновности» (точно). */
export const SUSPECT_FAIL_VILLAGE_REP = -5;
/** П.5/6: вира-«продажа» за татьбу — 24 д. = 12 кун по 2 д. (Судебник 1497, о татбе).
 *  66.97 (§12.3 аудита 66.92, п.5): прежний комментарий «12 гривен по 2 д.» создавал
 *  ВТОРУЮ гривну в лоре: канон Character.CURRENCY — гривна = 100 д., куна = 2 д.
 *  Значение НЕ менялось (баланс и сейвы целы) — исправлена только формулировка. */
export const THEFT_VIRA_SALE = 24;
/** П.5: падение деревенской репутации при поимке стражником (×множитель). */
export const GUARD_VILLAGE_REP = -15;
/** П.7: множитель виры и репутации при повторной поимке (×3). */
export const REPEAT_MULT = 3;
/** П.8: третья поимка — изгнание (провал, конец игры). */
export const CATCHES_EXPULSION = 3;

// ---------------- СОСТОЯНИЕ ----------------

function justiceStateOf(registry) {
    return (registry && registry.get('justiceState')) || {
        theftCount: {},   // npcId → сколько раз обокраден (растёт — эскалация п.3)
        suspect: {},      // npcId → true (подозревает игрока сейчас)
        caught: {},       // npcId → interiorId (застукал за воровством — стражник вправе осмотреть)
        caughtCount: 0,   // поимок стражником (3-я — изгнание, п.8)
        soldStolen: {},   // interiorId → полная стоимость ПРОДАННОГО краденого этого дома
    };
}

function saveJusticeState(registry, st) {
    if (registry) registry.set('justiceState', st);
}

/** Сколько раз этого НПЦ уже обкрадывали (для UI/тестов). */
export function theftCountOf(registry, npcId) {
    const st = justiceStateOf(registry);
    return st.theftCount[npcId] || 0;
}

/** Подозревает ли НПЦ игрока в краже сейчас (п.1). */
export function isSuspecting(registry, npcId) {
    return !!justiceStateOf(registry).suspect[npcId];
}

/** Застукали ли игрока у ЭТОГО НПЦ без мира (стражник вправе осмотреть узел). */
export function isCaughtByHost(registry, npcId) {
    return !!justiceStateOf(registry).caught[npcId];
}

/** Дома, по которым есть неотработанная поимка (interiorId). */
export function caughtHouseIds(registry) {
    const st = justiceStateOf(registry);
    return [...new Set(Object.values(st.caught).filter(Boolean))];
}

/** Есть ли у стражника причина останавливать игрока у ворот (п.5). */
export function hasGuardBusiness(registry) {
    const st = justiceStateOf(registry);
    return Object.keys(st.caught).some(id => st.caught[id]);
}

/** Сколько раз игрока уже поимал стражник (п.7–8). */
export function caughtCountOf(registry) {
    return justiceStateOf(registry).caughtCount || 0;
}

/**
 * П.1: после успешной кражи (сундук обчищен) хозяин ВСЕГДА подозревает.
 * Счётчик краж у этого НПЦ растёт — следующая проверка «невиновности»
 * будет сложнее (п.3). Подозрение держится до удачной проверки (п.2)
 * или до примирения (п.6).
 */
export function noteTheftDone(registry, hostNpcId) {
    if (!registry || !hostNpcId) return { theftCount: 0 };
    const st = justiceStateOf(registry);
    st.theftCount[hostNpcId] = (st.theftCount[hostNpcId] || 0) + 1;
    st.suspect[hostNpcId] = true;
    saveJusticeState(registry, st);
    return { theftCount: st.theftCount[hostNpcId] };
}

/**
 * П.1/3: навык проверки «невиновности» — ЛУЧШИЙ из разговорных
 * (Убеждение или Болтовня), минус −15% за каждую прежнюю кражу
 * у ЭТОГО НПЦ (п.3), но не ниже 5%.
 */
export function suspectCheckSkill(registry, npcId, player) {
    const skills = (player && player.skills) || {};
    const raw = Math.max(Number(skills.persuade) || 0, Number(skills.fast_talk) || 0, 1);
    const thefts = theftCountOf(registry, npcId);
    const penalty = Math.max(0, thefts - 1) * SUSPECT_PENALTY_PER_RETHEFT;
    return {
        skill: raw,
        penalty,
        effective: Math.max(5, raw - penalty),
        thefts,
    };
}

/**
 * Пп.1–4: попытка отвести подозрение в краже (разговорный навык).
 * Успех — подозрение снято ДО следующей кражи (п.2). Провал —
 * репутация у НПЦ −10 и в деревне −5 (п.4).
 * Патч 66.80 (п.11-д): повторные провалы проверки у ТОГО ЖЕ НПЦ бьют
 * сильнее — ×1.5 за каждый прежний провал: −10 → −15 → −22 → −30 (потолок).
 * @returns {{ ok:boolean, roll:number, skill:number, effective:number, thefts:number, penalty:number }}
 */
export function attemptInnocence(registry, npcId, player, { rng = Math.random } = {}) {
    const npcName = getNpcDisplayName(registry, npcId);
    const chk = suspectCheckSkill(registry, npcId, player);
    const blessed = getBlessedSkill(registry, chk.effective);
    const res = skillCheck(blessed);
    const ok = res.result === 'critical' || res.result === 'success';
    const st = justiceStateOf(registry);
    if (ok) {
        delete st.suspect[npcId]; // п.2: перестал подозревать (до следующей кражи)
        saveJusticeState(registry, st);
        ActionLog.add(registry, tf(t('Слово вышло гладко: {0} больше не косится на тебя (проверка {1}%: бросок {2}).'),
            npcName, blessed, res.roll));
    } else {
        // п.4: −5 в деревне точно; у НПЦ — с эскалацией повторных обид
        // (патч 66.80, п.11-д: −10 → −15 → −22 → −30, потолок −30)
        const npcLoss = escalatedNpcOffense(registry, npcId, 'suspect_fail', Math.abs(SUSPECT_FAIL_NPC_REP));
        changeNpcRepExact(registry, npcId, npcLoss);
        changeVillageRepExact(registry, SUSPECT_FAIL_VILLAGE_REP);
        const npcRep = getNpcRep(registry, npcId);
        ActionLog.add(registry, tf(t('Не сумел отвести подозрения: {0} смотрит волком (репутация у него {1}), по деревне шепчутся (репутация в деревне −{2}).'),
            npcName, npcRep, Math.abs(SUSPECT_FAIL_VILLAGE_REP)));
    }
    return { ok, roll: res.roll, skill: chk.skill, effective: blessed, thefts: chk.thefts, penalty: chk.penalty, offenseTimes: offenseCountOf(registry, npcId, 'suspect_fail') };
}



/**
 * П.5 (маркер): хозяева застукали игрока за воровством — стражник у ворот
 * вправе остановить героя, когда он соберётся выйти из деревни.
 * (Сами −30/−20 списывает crime.js applyOwnersCaught — тут только маркер.)
 */
export function markCaughtRedhanded(registry, hostNpcId, interiorId) {
    if (!registry || !hostNpcId) return;
    const st = justiceStateOf(registry);
    st.caught[hostNpcId] = interiorId || (st.caught[hostNpcId] || true);
    saveJusticeState(registry, st);
}

// ---------------- СБЫТ КРАДЕННОГО (для урока по полной стоимости) ----------------

/**
 * Отметить ПРОДАЖУ краденого (Скупщику): накапливаем ПОЛНУЮ стоимость
 * (def.sell × n) по дому-происхождению — за неё придётся платить урок
 * при поимке (п.5) или примирении (п.6). Записи без происхождения
 * (старые сейвы) атрибутировать нельзя — они только изымаются.
 */
export function noteSoldStolen(registry, interiorId, fullValue) {
    if (!registry || !interiorId || !fullValue) return;
    const st = justiceStateOf(registry);
    st.soldStolen[interiorId] = (st.soldStolen[interiorId] || 0) + Math.max(0, Math.round(fullValue));
    saveJusticeState(registry, st);
}

/** Полная стоимость проданного краденого дома (для счёта стражника/мира). */
export function soldStolenValueOf(registry, interiorId) {
    return justiceStateOf(registry).soldStolen[interiorId] || 0;
}

// ---------------- СТРАЖНИК У ВОРОТ (п.5, 7, 8) ----------------

/**
 * Счёт стражника (превью — без списаний): что изымется, что придётся платить.
 *  • изымается ВСЁ краденое из узла (возвращается хозяевам в вещах);
 *  • урок за ПРОДАННОЕ краденое пойманных домов — по полной стоимости;
 *  • продажа (вира Судебника) — 24 д.;
 *  • всё ×3 при повторной поимке (п.7).
 */
export function guardBill(registry, player) {
    const st = justiceStateOf(registry);
    const mult = Math.pow(REPEAT_MULT, st.caughtCount || 0);
    const items = [];
    let confiscatedValue = 0;
    ((player && player.inventory) || []).forEach(entry => {
        if (!entry || !entry.id || !entry.stolen) return;
        const def = getLootDef(entry.id);
        const count = entry.count || 1;
        if (def) confiscatedValue += (def.sell || 0) * count;
        items.push({ id: entry.id, name: def ? def.name : entry.id, emoji: def ? def.emoji : '📦', count });
    });
    const caughtHouses = caughtHouseIds(registry); // interiorId поиманных домов
    const soldValue = caughtHouses.reduce((sum, hid) => sum + (st.soldStolen[hid] || 0), 0);
    const vira = THEFT_VIRA_SALE * mult;
    const soldBill = soldValue * mult;
    return {
        items, confiscatedValue, caughtHouses, mult,
        vira, soldBill, total: vira + soldBill,
        villageRep: GUARD_VILLAGE_REP * mult,
        caughtCount: st.caughtCount || 0,
    };
}

/**
 * Пп.5,7,8: ОСМОТР УЗЛА СТРАЖНИКОМ (списания).
 *  • всё краденое изымается (возвращается хозяевам — мир по этому дому);
 *  • уплачен счёт (вира + урок за проданное) — стражник отпускает;
 *  • не хватает денег — выгребает ВСЮ мошну (по Судебнику неуплату
 *    «выдаю головою» истцу заменяем изъятием всего серебра);
 *  • деревенская репутация −15 × множитель (повторная поимка ×3, п.7);
 *  • ТРЕТЬЯ поимка: отбирают ВСЁ имущество и изгоняют — ПРОВАЛ (п.8,
 *    флаг q.expelledFromVillage → EndScene «🚪 ИЗГНАН ИЗ ДЕРЕВНИ»).
 */
export function guardInspection(registry) {
    const player = registry.get('player');
    const st = justiceStateOf(registry);
    const bill = guardBill(registry, player);
    const caughtHouses = caughtHouseIds(registry); // дома поимки (interiorId)

    // 1) ИЗЪЯТИЕ краденого (всё, из любых домов)
    if (Array.isArray(player.inventory)) {
        player.inventory = player.inventory.filter(e => !(e && e.stolen));
    }

    // 2) Платёж (не хватает — вся мошна)
    const have = player.dengas || 0;
    const lostDengas = Math.min(have, bill.total);
    player.dengas = have - lostDengas;
    const paidShort = lostDengas < bill.total;
    registry.set('player', player);

    // 3) Репутация деревни −15 × множитель (п.5, п.7 ×3)
    const rep = registry.get('reputation');
    if (rep) {
        rep.villageRep = Math.max(-100, Math.min(100, rep.villageRep + GUARD_VILLAGE_REP * bill.mult));
        registry.set('reputation', rep);
    }
    ActionLog.add(registry, tf(t('Стражник у ворот изъял краденое ({0} шт.) и взял виры {1} д. (Судебник: продажа {2} д. + урок за сбытое {3} д., множитель ×{4}).'),
        bill.items.reduce((s, i) => s + i.count, 0), lostDengas, bill.vira, bill.soldBill, bill.mult));

    // 4) Мир с застукавшими хозяевами: вещи вернулись, серебро уплачено
    Object.keys(st.caught).forEach(npcId => delete st.caught[npcId]);
    caughtHouses.forEach(hid => { st.soldStolen[hid] = 0; });
    st.caughtCount = (st.caughtCount || 0) + 1;
    const expelled = st.caughtCount >= CATCHES_EXPULSION; // п.8
    saveJusticeState(registry, st);

    // 5) П.8: третья поимка — всё имущество и изгнание (ПРОВАЛ)
    if (expelled) {
        player.inventory = [];
        player.dengas = 0;
        registry.set('player', player);
        const q = registry.get('quest') || {};
        q.expelledFromVillage = true; // → checkGameEnd 'defeat_expelled'
        q.currentObjective = t('Уличён в краже трижды: имущество отобрано, из деревни изгнан.');
        registry.set('quest', q);
        ActionLog.add(registry, t('ПОРАЖЕНИЕ: пойман за кражей в третий раз! По Судебнику — поток и разграбление: всё имущество отобрано, герой изгнан из деревни.'));
    }
    return { ...bill, lostDengas, paidShort, caughtCount: st.caughtCount, expelled };
}

// ---------------- П.11-в: ЛЁГКИЙ ОСМОТР «ПОДОЗРИТЕЛЬНОГО» У ВОРОТ ----------------

/**
 * Патч 66.80 (п.11-в): нужен ли «лёгкий» осмотр у ворот — игрок
 * «подозрительный» (репутация деревни ≤ −20) и несёт краденое.
 * Это НЕ поимка: изымается только краденое, БЕЗ виры, БЕЗ падения
 * репутации и БЕЗ счётчика caughtCount (тот — за застукивание, п.5).
 */
export function guardLightSearchNeeded(registry) {
    if (!registry) return false;
    const player = registry.get('player');
    const hasStolen = Array.isArray(player && player.inventory) &&
        player.inventory.some(e => e && e.stolen);
    return hasStolen && getVillageRep(registry) <= REP_STATUS_SUSPICIOUS;
}

/**
 * Патч 66.80 (п.11-в): ЛЁГКИЙ ОСМОТР узла у ворот для «подозрительного».
 * Краденое изымается и возвращается хозяевам; денег не берут, репутацию
 * не списывают, поимкой не считают — но краденое при тебе больше не идёт.
 * @returns {{ items:Array, confiscatedValue:number }}
 */
export function guardLightSearch(registry) {
    const player = registry.get('player');
    const bill = guardBill(registry, player);
    if (Array.isArray(player.inventory)) {
        player.inventory = player.inventory.filter(e => !(e && e.stolen));
    }
    registry.set('player', player);
    ActionLog.add(registry, tf(t('Стражник у ворот отобрал краденое ({0} шт.) и вернул по домам. «Подозрительный ты человек — не нравишься деревне. Ступай, пока по-хорошему».'),
        bill.items.reduce((s, i) => s + i.count, 0)));
    return { items: bill.items, confiscatedValue: bill.confiscatedValue };
}

// ---------------- ПРИМИРЕНИЕ С ОБКРАДЕННЫМ НПЦ (п.6) ----------------

/**
 * П.6 (превью): что нужно для мира с хозяином дома.
 *  • вернуть украденные вещи этого дома (те, что ещё в узле);
 *  • компенсировать ПРОДАННОЕ деньгами по полной стоимости;
 *  • вира за кражу — 24 д. (Судебник 1497, о татбе).
 */
export function reconcileNeeds(registry, player, interiorId) {
    const entries = [];
    let returnCount = 0;
    ((player && player.inventory) || []).forEach(entry => {
        if (!entry || !entry.id || !entry.stolen || entry.from !== interiorId) return;
        const def = getLootDef(entry.id);
        const count = entry.count || 1;
        returnCount += count;
        entries.push({ id: entry.id, name: def ? def.name : entry.id, emoji: def ? def.emoji : '📦', count });
    });
    const soldValue = soldStolenValueOf(registry, interiorId);
    const total = THEFT_VIRA_SALE + soldValue;
    return { entries, returnCount, soldValue, vira: THEFT_VIRA_SALE, total };
}

/**
 * П.6: ПРИМИРЕНИЕ с обкраденным НПЦ (списания).
 * Вещи возвращаются, сбыт компенсируется деньгами, вира уплачена:
 * подозрение снято, обида смыта (репутация НПЦ поднимается до 0,
 * если была ниже), стражнику за этот дом причины больше нет.
 * @returns {{ success:boolean, returnedCount:number, soldPaid:number, vira:number, npcRepNow:number }}
 */
export function reconcileWithHost(registry, npcId, interiorId) {
    const npcName = getNpcDisplayName(registry, npcId);
    const player = registry.get('player');
    const needs = reconcileNeeds(registry, player, interiorId);
    if ((player.dengas || 0) < needs.total) {
        return { success: false, reason: 'poor', ...needs, npcRepNow: getNpcRep(registry, npcId) };
    }
    // 1) Возврат вещей этого дома
    let returnedCount = 0;
    if (Array.isArray(player.inventory)) {
        player.inventory.forEach(entry => {
            if (entry && entry.stolen && entry.from === interiorId) returnedCount += entry.count || 1;
        });
        player.inventory = player.inventory.filter(e => !(e && e.stolen && e.from === interiorId));
    }
    // 2) Компенсация за проданное + вира
    player.dengas -= needs.total;
    registry.set('player', player);
    // 3) Мир: подозрение и «поимка» сняты, обида смыта
    const st = justiceStateOf(registry);
    delete st.suspect[npcId];
    delete st.caught[npcId];
    st.soldStolen[interiorId] = 0;
    saveJusticeState(registry, st);
    const rep = registry.get('reputation');
    let npcRepNow = 0;
    if (rep) {
        npcRepNow = Math.max(0, rep.npcRep[npcId] || 0); // обида смыта серебром
        rep.npcRep[npcId] = npcRepNow;
        registry.set('reputation', rep);
    }
    ActionLog.add(registry, tf(t('Мир с {0} свершён: украденное возвращено ({1} шт.), за сбытое уплачено {2} д., вира {3} д. (Судебник). Обида смыта.'),
        npcName, returnedCount, needs.soldValue, needs.vira));
    return { success: true, returnedCount, soldPaid: needs.soldValue, vira: needs.vira, npcRepNow };
}

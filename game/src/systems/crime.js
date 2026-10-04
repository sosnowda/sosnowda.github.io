// ============================================================
// ПАТЧ 66.78 (приказы владельца 1–9): ПРЕСТУПНОСТЬ — МОЛВА,
// ХОЗЯЕВА ЗАСТУКАЛИ, НАПАДЕНИЕ, СКУПЩИК, ПРЕДУПРЕЖДЕНИЯ.
//
//  1\ Провал Скрадывания при воровстве/взломе: репутация в деревне
//     падает ГЕОМЕТРИЧЕСКИ — чем больше провалов, тем сильнее удар:
//     −2, −4, −8, −16, −32 (потолок −32, дальше не растёт).
//  2\ ВО ВРЕМЯ воровства (вскрытия сундука в пустом доме) хозяева
//     МОГУТ ВЕРНУТЬСЯ ДОМОЙ и застукать вора: личная репутация у
//     хозяев −30, репутация в деревне −20 (точные значения).
//  3\ Застуканные хозяева могут НАПАСТЬ на вора (бой): у мужчин
//     шансы высокие (40%), у женщин низкие (10%).
//  4\ По НОЧАМ на первом этаже постоялого двора появляется СКУПЩИК —
//     покупает ТОЛЬКО краденое.
//  5\ Продать краденое можно ТОЛЬКО по ночам и ТОЛЬКО Скупщику;
//     появляется случайно, но НЕ РЕЖЕ 3 РАЗ В НЕДЕЛЮ (3–5 ночей
//     каждой недели, выбор ночей случаен).
//  6\ Каждая продажа краденого Скупщику — репутация в деревне −1
//     (точное значение); при ПЕРВОЙ продаже — однократное поп-ап
//     предупреждение о противозаконности (показывает сцена).
//  7\ При ПЕРВОЙ попытке Кражи/Взлома — однократное КРАСНОЕ поп-ап
//     предупреждение (текст приказа; показывает сцена, флаг здесь).
//
// Модуль registry-only — тестируется в Node (test_round126).
// Патч 66.79 (пп.9–10): ПОБЕГ ОТ ХОЗЯЕВ — по приказу rollOwnersReturn
// может вернуть { came, defer:true } БЕЗ списаний (сцена сначала показывает
// красный поп-ап «к дому идут хозяева» с проверкой Ловкости/Скрадывания;
// застукали только после провала побега — тогда applyOwnersCaught).
// ============================================================

import { t, tf } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { changeVillageRepExact, changeNpcRepExact } from '../data/reputation.js';
// Патч 66.79 (п.5): застукали — стражник у ворот вправе осмотреть узел
import { markCaughtRedhanded } from './justice.js';

// ---------------- п.1: ГЕОМЕТРИЧЕСКАЯ МОЛВА ----------------

/** Базовое падение репутации за ПЕРВЫЙ провал Скрадывания. */
export const STEALTH_FAIL_BASE_REP = 2;
/** Потолок удара: дальше молва не растёт (играбельность). */
export const STEALTH_FAIL_CAP_REP = 32;

/**
 * Удар по репутации за провал Скрадывания с порядковым номером n
 * (геометрическая прогрессия со знаменателем 2: 2, 4, 8, 16, 32…).
 * @param {number} streak — номер провала (1, 2, 3…)
 * @returns {number} положительное число очков падения
 */
export function stealthRepPenalty(streak) {
    const n = Math.max(1, Math.floor(Number(streak) || 1));
    const raw = STEALTH_FAIL_BASE_REP * Math.pow(2, n - 1);
    return Math.min(STEALTH_FAIL_CAP_REP, Math.round(raw));
}

function crimeStateOf(registry) {
    return (registry && registry.get('crimeState')) || { stealthFails: 0 };
}

/** Сколько провалов Скрадывания уже накоплено (для UI/тестов). */
export function stealthFailCount(registry) {
    return crimeStateOf(registry).stealthFails || 0;
}

/**
 * Отметить провал Скрадывания (п.1): счётчик +1, репутация падает
 * геометрически (ТОЧНОЕ значение — без смягчающих множителей).
 * @returns {{ streak:number, penalty:number }}
 */
export function noteStealthFail(registry) {
    const st = crimeStateOf(registry);
    st.stealthFails = (st.stealthFails || 0) + 1;
    registry.set('crimeState', st);
    const penalty = stealthRepPenalty(st.stealthFails);
    changeVillageRepExact(registry, -penalty);
    ActionLog.add(registry, tf(t('Скрадывание не удалось: тебя приметили у чужого дому — дурная молва крепчает (−{0} к репутации, провалов: {1}).'), penalty, st.stealthFails));
    return { streak: st.stealthFails, penalty };
}

// ---------------- пп.2–3: ХОЗЯЕВА ВЕРНУЛИСЬ / НАПАДЕНИЕ ----------------

/** Репутация у хозяев при застукивании (точное значение, приказ 2). */
export const CATCH_HOST_REP = -30;
/** Репутация в деревне при застукивании (точное значение, приказ 2). */
export const CATCH_VILLAGE_REP = -20;
/** Шанс, что хозяева вернутся домой во время воровства (день, 6–20 ч). */
export const OWNER_RETURN_CHANCE_DAY = 0.2;
/** Шанс возврата хозяев ночью (21–5 ч) — дома тихо, но кто-то может нагрянуть. */
export const OWNER_RETURN_CHANCE_NIGHT = 0.08;
/** Шанс нападения застукавших хозяев: МУЖЧИНЫ — высокие (приказ 3). */
export const OWNER_ATTACK_CHANCE_MALE = 0.4;
/** Шанс нападения застукавших хозяек. */
export const OWNER_ATTACK_CHANCE_FEMALE = 0.1;

/** Пол хозяина дома (по id интерьера; основные хозяева из npcNames). */
export const HOST_GENDERS = {
    elder_house: 'male', blacksmith: 'male', villager_house_1: 'male', villager_house_2: 'female',
    beekeeper_house: 'male', potter_house: 'male', healer_house: 'female', fisher_house: 'male',
    carpenter_house: 'male', weaver_house: 'female', grocer_house: 'female', butcher_house: 'male',
    shop_tools: 'male', shoemaker_house: 'male', woodcutter_house: 'male', villager_house_3: 'male',
};

/** Пол хозяина дома по интерьеру (по умолчанию — мужчина). */
export function hostGenderOf(interiorId) {
    return HOST_GENDERS[interiorId] || 'male';
}

/** Шанс возврата хозяев по часу суток. */
export function ownerReturnChance(hour) {
    const h = ((Number(hour) || 0) % 24 + 24) % 24;
    return (h >= 6 && h < 21) ? OWNER_RETURN_CHANCE_DAY : OWNER_RETURN_CHANCE_NIGHT;
}

/** Шанс нападения хозяев по полу (мужчины — высокие, приказ 3). */
export function ownerAttackChance(gender) {
    return gender === 'female' ? OWNER_ATTACK_CHANCE_FEMALE : OWNER_ATTACK_CHANCE_MALE;
}

/**
 * ПАТЧ 66.79 (пп.5,9): застукали — ПОСЛЕДСТВИЯ (списания + маркер правосудия).
 * Вызывается из rollOwnersReturn (старый путь — сразу) и из сцены
 * InteriorScene (новый путь — после провала побега, пп.9–10).
 *  • репутация у хозяев −30 (точно), в деревне −20 (точно);
 *  • justiceState.caught[host] = true — стражник у ворот вправе
 *    остановить героя при выходе из деревни (justice.js);
 *  • бросок НАПАДЕНИЯ: мужчины 40%, женщины 10% (приказ 3).
 * @param {Object} registry
 * @param {{ hostNpcId?:string, interiorId?:string, rng?:Function }} opts
 * @returns {{ attack:boolean, hostGender:string }}
 */
export function applyOwnersCaught(registry, opts = {}) {
    const rng = opts.rng || Math.random;
    const hostGender = hostGenderOf(opts.interiorId);
    // ЗАСТУКАЛИ (приказ 2): точные −30 у хозяев и −20 в деревне.
    if (opts.hostNpcId && registry) {
        changeNpcRepExact(registry, opts.hostNpcId, CATCH_HOST_REP);
        ActionLog.add(registry, tf(t('Хозяева вернулись и застукали тебя за воровством! Репутация у хозяев {0}.'), CATCH_HOST_REP));
    }
    if (registry) {
        changeVillageRepExact(registry, CATCH_VILLAGE_REP);
        ActionLog.add(registry, tf(t('Воровство раскрыто: по деревне пошла злая молва (репутация в деревне {0}).'), CATCH_VILLAGE_REP));
    }
    // Правосудие 66.79 (п.5): уличили — стражник у ворот осмотрит узел
    // (за дома, откуда краденое, придётся отвечать уроком по полной цене)
    markCaughtRedhanded(registry, opts.hostNpcId, opts.interiorId);
    // НАПАДЕНИЕ (приказ 3): мужчины нападают охотно.
    const attack = rng() < ownerAttackChance(hostGender);
    return { attack, hostGender };
}

/**
 * Бросок «хозяева вернулись» (п.2) — на КАЖДУЮ попытку воровства, когда
 * Скрадывание уже пройден. По умолчанию (без opts.defer) ЗАСТУКАЛИ —
 * репутация у хозяев −30 и в деревне −20 + запись в летопись.
 * С opts.defer — ТОЛЬКО бросок (списания делает applyOwnersCaught после
 * провала побега — патч 66.79 пп.9–10).
 * @param {Object} registry
 * @param {{ hostNpcId:string, interiorId:string, hour:number, rng?:Function, defer?:boolean }} opts
 * @returns {{ came:boolean, attack:boolean, hostGender:string, deferred?:boolean }}
 */
export function rollOwnersReturn(registry, opts = {}) {
    const rng = opts.rng || Math.random;
    const hostGender = hostGenderOf(opts.interiorId);
    if (rng() >= ownerReturnChance(opts.hour)) {
        return { came: false, attack: false, hostGender };
    }
    if (opts.defer) {
        return { came: true, attack: false, hostGender, deferred: true };
    }
    const res = applyOwnersCaught(registry, opts);
    return { came: true, hostGender, ...res };
}

// ---------------- пп.4–5: СКУПЩИК — НОЧИ ПОЯВЛЕНИЯ ----------------

/** Минимум ночей Скупщика в неделю (приказ 5). */
export const FENCE_MIN_NIGHTS = 3;
/** Максимум ночей Скупщика в неделю (случайно из 3..5). */
export const FENCE_MAX_NIGHTS = 5;

/** Ночные часы (приказы 4–5): 21:00–03:59. */
export function isNightHour(hour) {
    const h = Math.floor(((Number(hour) || 0) % 24 + 24) % 24);
    return h >= 21 || h < 4;
}

/** Абсолютный игровой день (та же формула, что в meal.js/haggle). */
export function absDayOf(timeState) {
    if (!timeState) return 0;
    return (timeState.yearFromChrist * 372) + (timeState.month * 31) + timeState.day;
}

/** Ключ недели (неделя = 7 игровых дней от старта мира). */
export function weekKeyOf(timeState) {
    return Math.floor(absDayOf(timeState) / 7);
}

function fenceStateOf(registry) {
    return (registry && registry.get('fenceState')) || { weekKey: null, nights: [] };
}

/**
 * Гарантировать расписание ночей Скупщика на ТЕКУЩУЮ неделю (п.5):
 * при первом обращении к неделе случайно выбирается 3–5 ночей из 7.
 * Расписание хранится в registry — не «перегениривается» при каждом входе.
 * @returns {{ weekKey:number, nights:number[] }}
 */
export function ensureFenceWeek(registry, timeState, rng = Math.random) {
    const wk = weekKeyOf(timeState);
    let st = fenceStateOf(registry);
    if (st.weekKey === wk && Array.isArray(st.nights)) return st;
    const count = FENCE_MIN_NIGHTS + Math.floor(rng() * (FENCE_MAX_NIGHTS - FENCE_MIN_NIGHTS + 1));
    const days = [0, 1, 2, 3, 4, 5, 6];
    // Фишер–Йетс на 7 элементах, берём первые count
    for (let i = days.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [days[i], days[j]] = [days[j], days[i]];
    }
    const base = wk * 7;
    st = { weekKey: wk, nights: days.slice(0, count).map(d => base + d) };
    registry.set('fenceState', st);
    return st;
}

/**
 * На постоялом дворе сейчас Скупщик? Ночь + его ночь недели.
 * @param {Object} registry
 * @param {Object} timeState — gameTime
 * @param {Function} [rng] — только для генерации расписания новой недели
 */
export function isFenceInTown(registry, timeState, rng = Math.random) {
    if (!timeState) return false;
    if (!isNightHour(timeState.hour)) return false; // только по ночам (приказы 4–5)
    const st = ensureFenceWeek(registry, timeState, rng);
    return st.nights.includes(absDayOf(timeState));
}

// ---------------- пп.6–7: ПРЕДУПРЕЖДЕНИЯ И ПОСЛЕДСТВИЯ СБЫТА ----------------

/** Каждая продажа краденого Скупщику — репутация в деревне −1 (приказ 6). */
export const FENCE_SALE_VILLAGE_REP = -1;

/**
 * Отметить продажу краденого Скупщику (п.6): деревенская репутация −1
 * (точное значение) + запись в летопись.
 * @returns {number} новая деревенская репутация
 */
export function noteFenceSale(registry, itemName, total) {
    changeVillageRepExact(registry, FENCE_SALE_VILLAGE_REP);
    ActionLog.add(registry, tf(t('Сбыл Скупщику краденое «{0}» за {1} д. — противозаконное дело: молва в деревне хуже на 1 (репутация падает с каждой продажи).'), t(itemName), total));
    return changeVillageRepExact(registry, 0);
}

/** Однократное красное предупреждение о преступлении (п.7) уже показано? */
export function crimeWarnedOnce(registry) {
    return !!(registry && registry.get('crimeWarned'));
}

/** Запомнить, что красное предупреждение (п.7) показано. */
export function markCrimeWarned(registry) {
    if (registry) registry.set('crimeWarned', true);
}

/** Однократное предупреждение о сбыте краденого (п.6) уже показано? */
export function fenceWarnedOnce(registry) {
    return !!(registry && registry.get('fenceWarned'));
}

/** Запомнить, что предупреждение о сбыте (п.6) показано. */
export function markFenceWarned(registry) {
    if (registry) registry.set('fenceWarned', true);
}

/** Текст красного предупреждения приказа 7 (один для обеих сцен). */
export function CRIME_WARNING_TEXT() {
    return t('Вы хотите совершить противозаконное действие и за это может быть наказание и падение репутации.');
}

// ============================================================
// ЕДИНЫЙ ИГРОВОЙ КАЛЕНДАРЬ (§12.3 аудита 66.92, эшелон 3, 66.96).
// ============================================================
// Аудит (P3, «Единый игровой календарь»): «Модуль gameCalendar с
// absDay(ts)/absMinute(ts) и одной таблицей MONTH_DAYS; заменить пять
// копий счётчика дней — устранит целый класс рассинхронов кулдаунов».
//
// Фактически на момент рефакторинга формула
//     (yearFromChrist * 372) + (month * 31) + day
// была скопирована в 11 файлов (crime/meal/hunger/trade/repBalance×2/
// ChurchBells/questGenerator×3/thief×2/reputation×2/herd/npcPresence),
// строковый ключ дня `${y}-${m}-${d}` — ещё в шести (daily/dialogue/
// rumors×2/Weather/ChurchDonation/WeatherOmens/InteriorScene.dayKey),
// а длины месяцев дублировались двумя таблицами (AccessHours.MONTH_DAYS
// и TimeSystem.MONTHS[].days).
//
// ИСТОРИЧЕСКИЙ КАНОН ФОРМУЛ (менять НЕЛЬЗЯ — значения хранятся в сейвах:
// blessingState.lastAbsMin, hungerState.dayKey, haggleState.dayKey,
// wageDealState.dayKey, repActionsDay.day, npcQuestOffered.day,
// chase.traces[].leftAt, quest.chestsOpened[].day и т.д.):
//   • Числовой день:   yearFromChrist*372 + month*31 + day
//     (месяц «31 день» фиктивен, раунд 27 — важно только монотонное
//     возрастание счётчика; рассинхрона внутри одной формулы нет).
//   • Абсолютная минута: (день*1440) + час*60 + минута.
//   • Строковый ключ дня: `${yearFromChrist}-${month}-${day}`
//     (без ведущих нулей — как лежит в сейвах с раунда 66.10).
//
// Чистые функции без Phaser/импортов из сцен — покрываются юнит-тестами
// (test_round138: канон-значения + эквивалентность со старыми копиями).

/**
 * Число дней в месяцах игрового календаря (месяц 0 = сентябрь,
 * сентябрьский стиль). ЕДИНСТВЕННАЯ таблица: AccessHours.dayOfYear и
 * TimeSystem.MONTHS[].days берут длины отсюда.
 */
export const MONTH_DAYS = [30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31];

/**
 * Абсолютный игровой день (монотонный счётчик от условной эпохи).
 * Канон всех числовых копий: crime.absDayOf, meal.worldAbsMinutes (день),
 * hunger.hungerDayKey, trade.haggleDayKey, repBalance.wageDealDayKey,
 * questGenerator.absMinutes (день), thief.worldMinutesOf (день),
 * reputation.repActionAllowedToday, herd.dayKeyOf, npcPresence.dayKeyOf.
 * @param {{ yearFromChrist?: number, month?: number, day?: number }|null} timeState
 * @returns {number} 0 для пустого входа (канон прежних копий)
 */
export function absDay(timeState) {
    if (!timeState) return 0;
    return (timeState.yearFromChrist * 372) + (timeState.month * 31) + timeState.day;
}

/**
 * Абсолютная игровая минута (для кулдаунов в минутах: благословение,
 * трапезы, следы вора). Канон: meal.worldAbsMinutes, questGenerator.absMinutes,
 * thief.worldMinutesOf.
 * @param {{ yearFromChrist?: number, month?: number, day?: number,
 *           hour?: number, minute?: number }|null} timeState
 * @returns {number} 0 для пустого входа
 */
export function absMinute(timeState) {
    if (!timeState) return 0;
    return (absDay(timeState) * 1440) + ((timeState.hour || 0) * 60) + (timeState.minute || 0);
}

/**
 * Строковый ключ игрового дня — канон data/daily.js dayKeyOf
 * (формат сейвов с раунда 66.10, НЕ менять).
 * @param {{ yearFromChrist?: number, month?: number, day?: number }|null} timeState
 * @returns {string} 'unknown' для пустого входа
 */
export function dayKey(timeState) {
    return timeState
        ? `${timeState.yearFromChrist}-${timeState.month}-${timeState.day}`
        : 'unknown';
}

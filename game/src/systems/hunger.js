// ============================================================
// Раунд 66.70 (приказы владельца 1–2): СИСТЕМА ГОЛОДА.
//
//  • п.1: проверить/ввести систему Голода в браузерной игре —
//    в игре была ТОЛЬКО еда (meal.js: +HP, кулдаун 4 ч), голод
//    не отслеживался. Теперь отслеживается.
//  • п.2: «Персонажу игрока требуется есть не реже двух раз в
//    сутки, примерно: днём в полдень и вечером».
//
// Канон механики:
//  1. Каждый приём еды (registerMeal в meal.js) инкрементирует
//     суточный счётчик сытости. Счётчик сбрасывается при смене
//     игрового дня (ключ дня: (год*372 + месяц*31 + день)).
//  2. Норма — МЕАЛС_REQUIRED (2 приёма) за игровые сутки.
//     Ориентиры-окна владельца: полдень (10–14 ч) и вечер
//     (17–21 ч) — окна информативны (подсказка в HUD/диалогах),
//     на механику штрафа влияет только СУТОЧНЫЙ итог.
//  3. Ролловер дня (ловится в TimeSystem.tickTime): если за
//     прошедшие сутки съедено МЕНЬШЕ нормы — герой ГОЛОДАЛ:
//     −1 Здоровья за каждый пропущенный приём (максимум −2),
//     запись в летопись. HP не опускается ниже 1 от голода
//     (голод изнуряет, но не убивает — исторично: крестьянин
//     худал, но доживал до урожая).
//  4. Модуль без зависимостей от TimeSystem/meal (registry-only),
//     чтобы не плодить циклы импортов: meal.js и tickTime
//     вызывают его, он читает только registry.get('gameTime').
// ============================================================

import { t } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';

/** Норма приёмов пищи за игровые сутки (приказ 2). */
export const MEALS_REQUIRED_PER_DAY = 2;

/** Ориентир-окна трапез (подсказка игроку; на штраф не влияют). */
export const NOON_WINDOW = [10, 14];   // «днём в полдень»
export const EVENING_WINDOW = [17, 21]; // «и вечером»

/** Ключ игрового дня по state времени (та же формула, что в meal.js). */
export function hungerDayKey(timeState) {
    if (!timeState) return 0;
    const day = (timeState.yearFromChrist * 372) + (timeState.month * 31) + timeState.day;
    return day;
}

function hungerRaw(registry) {
    return (registry && registry.get('hungerState')) || { dayKey: null, meals: 0 };
}

function saveHunger(registry, state) {
    if (registry) registry.set('hungerState', state);
}

/**
 * Счётчик приёмов пищи за ТЕКУЩИЙ день (с ленивым сбросом при смене дня).
 * Возвращает { dayKey, meals, required, fed } — fed: норма выполнена.
 */
export function hungerStatus(registry) {
    const time = registry ? registry.get('gameTime') : null;
    const today = hungerDayKey(time);
    let st = hungerRaw(registry);
    if (st.dayKey !== today) st = { dayKey: today, meals: 0 };
    return {
        dayKey: today,
        meals: st.meals,
        required: MEALS_REQUIRED_PER_DAY,
        fed: st.meals >= MEALS_REQUIRED_PER_DAY,
    };
}

/** Отметить приём пищи (вызывается из meal.js registerMeal). Возвращает meals. */
export function noteHungerMeal(registry) {
    if (!registry) return 0;
    const st = hungerStatus(registry);
    st.meals += 1;
    saveHunger(registry, { dayKey: st.dayKey, meals: st.meals });
    return st.meals;
}

/** Короткая строка для HUD-статуса: «🍽1/2» (сыт) / «🍽1/2 ⚠» (голодает). */
export function hungerStatusLine(registry) {
    const st = hungerStatus(registry);
    const warn = st.meals < MEALS_REQUIRED_PER_DAY ? ' ⚠' : '';
    return `🍽${st.meals}/${MEALS_REQUIRED_PER_DAY}${warn}`;
}

/**
 * Ролловер-проверка суточной нормы (вызывается из tickTime ПОСЛЕ
 * продвижения времени). Если день сменился:
 *  • за ушедшие сутки недоедено → штраф −1 HP за каждый пропуск (макс −2),
 *    HP ≥ 1, летопись, флаг 'hungerPenaltyPending' для поп-апа сцены;
 *  • счётчик переносится на новый день (сбрасывается в 0).
 * Возвращает { dayChanged, missed, penalty, healed } | null (нет смены дня).
 */
export function hungerRolloverCheck(registry) {
    if (!registry) return null;
    const time = registry.get('gameTime');
    if (!time) return null;
    const today = hungerDayKey(time);
    const st = hungerRaw(registry);

    if (st.dayKey === null) {
        // Первая инициализация — штрафов нет, просто стартуем счётчик.
        saveHunger(registry, { dayKey: today, meals: 0 });
        return { dayChanged: false, missed: 0, penalty: 0, healed: 0 };
    }
    if (st.dayKey === today) return null; // день не сменился — ничего

    // День сменился: оцениваем ВЧЕРАШНИЙ счётчик (st.meals).
    const missed = Math.max(0, MEALS_REQUIRED_PER_DAY - st.meals);
    const penalty = Math.min(2, missed); // −1 HP за пропуск, максимум −2
    let healed = 0;
    if (penalty > 0) {
        const player = registry.get('player');
        if (player && typeof player.HP === 'number') {
            const before = player.HP;
            player.HP = Math.max(1, player.HP - penalty); // голод не убивает
            healed = before - player.HP;
            registry.set('player', player);
        }
        ActionLog.add(registry, t('Голодал прошедшие сутки (менее двух трапез) — силы тают.'));
        registry.set('hungerPenaltyPending', { missed, penalty: healed });
    }
    // Новый день: счётчик с нуля.
    saveHunger(registry, { dayKey: today, meals: 0 });
    return { dayChanged: true, missed, penalty, healed };
}

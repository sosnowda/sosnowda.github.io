// ============================================================
// Раунд 66.16 (приказы владельца 1–4): ЕДИНЫЕ ПРАВИЛА ЕДЫ И СНА.
//
// 1\ Еда ВСЕГДА занимает 1 час игрового времени.
// 2\ Любая еда восстанавливает РОВНО 1 очко Здоровья (MP едой
//    не восстанавливается — Воля только молитвой/отдыхом).
//    РАУНД 66.17 (уточнение приказа): «+1 HP» — про ПРОСТУЮ еду
//    (яблоко, мёд, грибы, ягоды, рацион). ПОЛНОЦЕННАЯ еда в
//    трактире постоялого двора лечит 2–3 HP (каша 3, хлеб 2),
//    жаркое из дичи 3, печёная рыба 2 (см. systems/loot.js).
// 3\ Кулдаун на следующий приём еды — 4 часа (240 игровых минут).
//    Попытка поесть во время отката → поп-ап «герой сытый».
// 4\ Кулдаун сна — 12 часов. Попытка поспать во время отката →
//    поп-ап «герой не хочет спать», отдых отменяется.
//    РАУНД 66.17 (уточнение приказа): отдых 8+ часов восстанавливает
//    здоровье ПОЛНОСТЬЮ; меньше 8 часов — ПРОПОРЦИОНАЛЬНО (8 ч = 100%),
//    а сам сон не может быть короче 2 часов (SLEEP_MIN_MIN).
//
// Реализация состояния — registry-ключи 'mealState'/'sleepState'
// с абсолютной игровой минутой (формула та же, что у мёда Марфы:
// (год*372 + месяц*31 + день) * 1440 + час*60 + минута).
// Сейвы: SaveManager — заглушка, всё живёт в registry сессии,
// поэтому новые ключи ничего не ломают.
// ============================================================

import { t } from './i18n.js';
import { createDialog } from '../utils/ui.js';

/** Сколько лечит ПРОСТАЯ еда (очков Здоровья) — яблоко, мёд, грибы, рацион. */
export const MEAL_HEAL_HP = 1;
/** Сколько минут игрового времени занимает любой приём еды. */
export const MEAL_DURATION_MIN = 60;
/** Кулдаун между приёмами еды (игровых минут) — 4 часа. */
export const MEAL_COOLDOWN_MIN = 240;
/** Кулдаун сна (игровых минут) — 12 часов. */
export const SLEEP_COOLDOWN_MIN = 720;

// ----- Раунд 66.17: пропорциональный отдых и минимальный сон -----
/** Отдых, дающий 100% восстановления (игровых минут) — 8 часов. */
export const REST_FULL_HEAL_MIN = 480;
/** Минимальная длительность сна (игровых минут) — 2 часа (приказ 3). */
export const SLEEP_MIN_MIN = 120;

/**
 * Доля восстановления за отдых: 8 часов = 100%, меньше — пропорционально
 * (2 ч = 25%, 4 ч = 50%, 6 ч = 75%); больше 8 часов — тоже 100% (полностью).
 */
export function restHealPct(minutes) {
    const m = Math.max(0, Number(minutes) || 0);
    return Math.min(1, m / REST_FULL_HEAL_MIN);
}

/**
 * Абсолютная игровая минута времени (монотонный счётчик от старта мира).
 * Формула согласована с узлом 'honey' диалогов (раунд 27): месяц=31 день
 * фиктивно — важно только, чтобы счётчик рос.
 */
export function worldAbsMinutes(registry) {
    const time = registry ? registry.get('gameTime') : null;
    if (!time) return 0;
    const day = (time.yearFromChrist * 372) + (time.month * 31) + time.day;
    return (day * 1440) + ((time.hour || 0) * 60) + (time.minute || 0);
}

// ---------------- ЕДА ----------------

function mealState(registry) {
    return (registry && registry.get('mealState')) || { lastAbsMin: -999999 };
}

/** Сколько минут осталось до конца отката еды (0 — есть можно). */
export function mealCooldownLeftMin(registry) {
    const left = (mealState(registry).lastAbsMin + MEAL_COOLDOWN_MIN) - worldAbsMinutes(registry);
    return left > 0 ? left : 0;
}

/** Можно ли сейчас есть: { ok, minutesLeft }. */
export function canEat(registry) {
    const minutesLeft = mealCooldownLeftMin(registry);
    return { ok: minutesLeft <= 0, minutesLeft };
}

/** Отметить приём еды (ставит точку отсчёта кулдауна 4 часа). */
export function registerMeal(registry) {
    if (!registry) return;
    registry.set('mealState', { lastAbsMin: worldAbsMinutes(registry) });
}

/**
 * Поп-ап «герой сытый» (приказ 3). Возвращает false — для удобства
 * раннего выхода из обработчиков: if (!canEat(...).ok) return showMealBlockedPopup(scene);
 */
export function showMealBlockedPopup(scene) {
    if (scene && scene.add) {
        createDialog(scene, t('🥣 Герой сыт'),
            t('Герой сыт и больше не может есть — съеденное ещё не переварилось. Следующий приём еды будет позже.'),
            [{ text: t('Понятно'), callback: () => {} }],
            { singleton: false });
    }
    return false;
}

// ---------------- СОН ----------------

function sleepState(registry) {
    return (registry && registry.get('sleepState')) || { lastAbsMin: -999999 };
}

/** Сколько минут осталось до конца отката сна (0 — спать можно). */
export function sleepCooldownLeftMin(registry) {
    const left = (sleepState(registry).lastAbsMin + SLEEP_COOLDOWN_MIN) - worldAbsMinutes(registry);
    return left > 0 ? left : 0;
}

/** Можно ли сейчас спать: { ok, minutesLeft }. */
export function canSleep(registry) {
    const minutesLeft = sleepCooldownLeftMin(registry);
    return { ok: minutesLeft <= 0, minutesLeft };
}

/** Отметить сон (ставит точку отсчёта кулдауна 12 часов). */
export function registerSleep(registry) {
    if (!registry) return;
    registry.set('sleepState', { lastAbsMin: worldAbsMinutes(registry) });
}

/**
 * Поп-ап «герой не хочет спать» (приказ 4). Отдых отменяется:
 * время не идёт, деньги не списываются, лечения нет.
 */
export function showSleepBlockedPopup(scene) {
    if (scene && scene.add) {
        createDialog(scene, t('😴 Герой не хочет спать'),
            t('Герой не хочет спать — он только недавно встал. Отдых отменён.'),
            [{ text: t('Понятно'), callback: () => {} }],
            { singleton: false });
    }
    return false;
}

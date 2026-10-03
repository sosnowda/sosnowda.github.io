// ============================================================
// Раунд 66.70 (приказ владельца 11): МОЛИТВА В ЦЕРКВИ.
//
//  • «при Молитве в Церкви повышаются все Навыки на 5% но только
//    для однократной проверки Навыка» — молитва даёт БЛАГОСЛОВЕНИЕ:
//    +5 к значению ЛЮБОГО одного навыка при СЛЕДУЮЩЕЙ проверке
//    (сбор Выживанием, готовка, Знахарство, Слух и т.д.). Бонус
//    списывается первой же проверкой (consumePrayerBless);
//  • «Молитва работает с откатом в 8 часов» — повторная молитва
//    ранее 8 игровых часов НЕ даёт ничего;
//  • «Если откат Молитвы ещё не закончился, то должно появляться
//    поп-ап сообщение: "Молитва не услышана!"» — текст приказа;
//  • прибавка Воли (MP) сохранена как была (Interiorscene, +3..8)
//    — приказ 11 её не отменяет.
//
// Модуль registry-only (без Phaser) — тестируется в Node.
// ============================================================

import { worldAbsMinutes } from './meal.js';

/** Откат молитвы — 8 игровых часов (приказ 11). */
export const PRAYER_COOLDOWN_MIN = 480;
/** Прибавка ко всем навыкам на одну проверку (5%). */
export const PRAYER_SKILL_BONUS = 5;

function questOf(registry) {
    return (registry && registry.get('quest')) || {};
}

/**
 * Можно ли молиться: { ok, minutesLeft }.
 * Откат хранится в quest.prayerAbsMin (абсолютная игровая минута).
 */
export function canPray(registry) {
    const q = questOf(registry);
    const last = Number(q.prayerAbsMin) || 0;
    const now = worldAbsMinutes(registry);
    const left = (last + PRAYER_COOLDOWN_MIN) - now;
    return { ok: left <= 0, minutesLeft: left > 0 ? left : 0 };
}

/**
 * Зарегистрировать молитву: точка отката 8 часов + благословение
 * (+5 к одной проверке навыка) в quest.prayerBless.
 * Патч 66.73 (приказ 9): благословение ЖИВЁТ ТОЛЬКО 8 ЧАСОВ — если
 * за это время проверки навыка не случилось, бонус сгорает.
 */
export function registerPrayer(registry) {
    if (!registry) return;
    const q = questOf(registry);
    q.prayerAbsMin = worldAbsMinutes(registry);
    q.prayerBless = true;
    q.prayerBlessAt = q.prayerAbsMin; // патч 66.73: точка истечения бонуса
    registry.set('quest', q);
}

/** Срок жизни благословения молитвы — 8 игровых часов (приказ 9). */
export const PRAYER_BLESS_DURATION_MIN = 480;

/**
 * Списать благословение первой проверкой навыка.
 * Возвращает PRAYER_SKILL_BONUS (5), если blessing активен, иначе 0.
 * Патч 66.73 (приказ 9): бонус работает ВСЕГО 8 ЧАСОВ — просроченное
 * благословение молча сгорает (никаких «+5» из прошлого дня).
 * Вызывается ВСЕГДА внутри мировых проверок (сбор/готовка/травы/слух)
 * ПОСЛЕ решения, что проверка состоялась.
 */
export function consumePrayerBless(registry) {
    if (!registry) return 0;
    const q = questOf(registry);
    if (q.prayerBless) {
        // Патч 66.73: истёкшие 8 часов — бонус сгорает без списания
        const at = Number(q.prayerBlessAt) || 0;
        if (at > 0 && (worldAbsMinutes(registry) - at) > PRAYER_BLESS_DURATION_MIN) {
            delete q.prayerBless;
            delete q.prayerBlessAt;
            registry.set('quest', q);
            return 0;
        }
        delete q.prayerBless;
        delete q.prayerBlessAt;
        registry.set('quest', q);
        return PRAYER_SKILL_BONUS;
    }
    return 0;
}

/**
 * Патч 66.73: действует ли ещё благословение молитвы (не съеденное
 * и не просроченное) — для подсказок в интерфейсе.
 */
export function isPrayerBlessActive(registry) {
    if (!registry) return false;
    const q = questOf(registry);
    if (!q.prayerBless) return false;
    const at = Number(q.prayerBlessAt) || 0;
    return at <= 0 || (worldAbsMinutes(registry) - at) <= PRAYER_BLESS_DURATION_MIN;
}

/** Осталось минут до конца отката (для подсказки в диалоге). */
export function prayCooldownLeftMin(registry) {
    return canPray(registry).minutesLeft;
}

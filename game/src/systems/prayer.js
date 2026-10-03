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
 */
export function registerPrayer(registry) {
    if (!registry) return;
    const q = questOf(registry);
    q.prayerAbsMin = worldAbsMinutes(registry);
    q.prayerBless = true;
    registry.set('quest', q);
}

/**
 * Списать благословение первой проверкой навыка.
 * Возвращает PRAYER_SKILL_BONUS (5), если blessing активен, иначе 0.
 * Вызывается ВСЕГДА внутри мировых проверок (сбор/готовка/травы/слух)
 * ПОСЛЕ решения, что проверка состоялась.
 */
export function consumePrayerBless(registry) {
    if (!registry) return 0;
    const q = questOf(registry);
    if (q.prayerBless) {
        delete q.prayerBless;
        registry.set('quest', q);
        return PRAYER_SKILL_BONUS;
    }
    return 0;
}

/** Осталось минут до конца отката (для подсказки в диалоге). */
export function prayCooldownLeftMin(registry) {
    return canPray(registry).minutesLeft;
}

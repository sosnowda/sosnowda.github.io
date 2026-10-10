// ============================================================
// Раунды 66.70/66.72 (приказы владельца): СИСТЕМА ГОЛОДА.
// Патч 66.73 (приказы 3,4,6,7): ГОЛОД КАК НЕПРЕРЫВНЫЙ ЧАСОВНИК.
//
// Канон механики (66.70 — сохранён):
//  1. Каждый приём еды (registerMeal в meal.js) инкрементирует
//     суточный счётчик сытости. Норма — 2 трапезы за игровые сутки
//     (полдень 10–14, вечер 17–21 — окна информативны).
//  2. Ролловер дня (TimeSystem.tickTime): недоел за сутки —
//     −1 Здоровья за пропуск (максимум −2); HP не ниже 1
//     (голод изнуряет, но не убивает).
//
// Канон 66.73 — ЧАСЫ ГОЛОДА (весовые минуты без еды):
//  3. (п.3) Во сне голод накапливается МЕДЛЕННЕЕ (вес ×0.4):
//     спящий тратит мало сил.
//  4. (п.4) При активностях голод растёт БЫСТРЕЕ обычного,
//     по степени нагрузки: перемещения ×1.5, тяжёлая работа ×1.75,
//     охота ×2, бой ×2.5 (см. HUNGER_RATES).
//  5. (п.6) Голод дольше 24 часов: −1 Здоровья за каждые
//     очередные 24 часа голода (накапливается); HP не ниже 1 —
//     голод изнуряет, но не убивает.
//  6. (п.7) Голод дольше 48 часов: параметры ВСЕХ навыков −1%
//     (процентный пункт) за каждые 24 часа голода; после еды
//     навыки восстанавливаются сами (штраф вычисляется, не хранится).
//
// Модуль без зависимостей от TimeSystem/meal (registry-only),
// чтобы не плодить циклы импортов: meal.js и tickTime вызывают
// его, он читает только registry.get('gameTime').
// ============================================================

import { t } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
// §12.3 (66.96): единый игровой календарь — одна формула дня на всю игру
import { absDay } from './gameCalendar.js';

/** Норма приёмов пищи за игровые сутки (приказ 2). */
export const MEALS_REQUIRED_PER_DAY = 2;

/** Ориентир-окна трапез (подсказка игроку; на штраф не влияют). */
export const NOON_WINDOW = [10, 14];   // «днём в полдень»
export const EVENING_WINDOW = [17, 21]; // «и вечером»

// ----- Патч 66.73: весовые коэффициенты накопления голода -----
// «Во время сна — медленнее, при активностях — быстрее обычного,
// в зависимости от степени активности и трудности задач» (пп.3,4).
export const HUNGER_RATES = {
    sleep: 0.4,   // сон — самый медленный набор голода (п.3)
    rest: 0.6,    // отдых у костра/в таверне без сна
    idle: 1,      // быт: разговоры, молитва, торговля (норма)
    walk: 1.5,    // перемещения: шаг за тайлом, переходы по карте
    work: 1.75,   // тяжёлая работа: сбор, готовка, ремесло, рыбалка
    hunt: 2,      // охота: выслеживание, выстрел, обдир туши
    combat: 2.5,  // бой — самая трудная задача (п.4 «тем более»)
};

/** Сколько игровых минут голода «стоит» 1 игровая минута активности. */
export function hungerRateOf(activity) {
    return HUNGER_RATES[activity] != null ? HUNGER_RATES[activity] : HUNGER_RATES.idle;
}

/** Границы штрафов (игровых часов голода). */
export const HUNGER_HP_AFTER_H = 24;   // п.6: −1 HP за очередные 24 ч
export const HUNGER_SKILL_AFTER_H = 48; // п.7: −1% навыков за 24 ч

/** Ключ игрового дня по state времени — канон gameCalendar.absDay (§12.3). */
export function hungerDayKey(timeState) {
    return absDay(timeState);
}

function hungerRaw(registry) {
    return (registry && registry.get('hungerState'))
        || { dayKey: null, meals: 0, clockMin: 0, hpBlocks: 0 };
}

function saveHunger(registry, state) {
    if (registry) registry.set('hungerState', state);
}

/** Нормализовать состояние (после загрузки старых сейвов без новых полей). */
function hungerStateFull(registry) {
    const time = registry ? registry.get('gameTime') : null;
    const today = hungerDayKey(time);
    let st = hungerRaw(registry);
    if (st.dayKey !== today) st = { dayKey: today, meals: 0, clockMin: st.clockMin || 0, hpBlocks: st.hpBlocks || 0 };
    if (typeof st.clockMin !== 'number') st.clockMin = 0;
    if (typeof st.hpBlocks !== 'number') st.hpBlocks = 0;
    return st;
}

/**
 * Часы голода: сколько ВЕСОВЫХ минут герой не ел (патч 66.73).
 * Возвращает дробные часы голода (clockMin / 60).
 */
export function hungerHours(registry) {
    return ((hungerRaw(registry).clockMin || 0)) / 60;
}

/**
 * Патч 66.73 (п.7): штраф ко ВСЕМ навыкам от долгого голода.
 * Голод ≥ 48 ч: −1 процентный пункт за каждые полные 24 часа голода
 * (48 ч → −1, 72 ч → −2, 96 ч → −3…). Вычисляется на лету: поел —
 * и навыки сами вернулись. Применяется в getBlessedSkill и loot.js.
 */
export function hungerSkillPenalty(registry) {
    const h = hungerHours(registry);
    if (h < HUNGER_SKILL_AFTER_H) return 0;
    return Math.min(20, Math.floor((h - HUNGER_SKILL_AFTER_H) / 24) + 1);
}

/**
 * Патч 66.73 (пп.3,4): накопить голод за прошедший отрезок времени.
 * Вызывается ИЗ TimeSystem.tickTime с подсказкой активности ('sleep',
 * 'walk', 'work', 'hunt', 'combat', 'rest'…; по умолчанию 'idle').
 * Заодно (п.6) применяет штраф HP за очередные полные 24 часа голода.
 */
export function noteHungerTick(registry, minutes, activity) {
    if (!registry || !(minutes > 0)) return null;
    const st = hungerStateFull(registry);
    st.clockMin += minutes * hungerRateOf(activity);
    saveHunger(registry, st);
    return applyHungerHPPenalty(registry);
}

/**
 * Патч 66.73 (п.6): −1 HP за каждую ПОЛНУЮ сутки голода (накапливается).
 * HP не опускается ниже 1 — голод изнуряет, но не убивает.
 * Возвращает { blocks, applied, healed } | null (нет нового штрафа).
 */
export function applyHungerHPPenalty(registry) {
    if (!registry) return null;
    const st = hungerStateFull(registry);
    const blocks = Math.floor((st.clockMin / 1440)); // полные 24 часа голода
    if (blocks <= st.hpBlocks) return null;
    const newBlocks = blocks - st.hpBlocks;
    st.hpBlocks = blocks;
    let healed = 0;
    const player = registry.get('player');
    if (player && typeof player.HP === 'number') {
        const before = player.HP;
        player.HP = Math.max(1, player.HP - newBlocks); // голод не убивает
        healed = before - player.HP;
        registry.set('player', player);
    }
    saveHunger(registry, st);
    if (healed > 0) {
        ActionLog.add(registry, t('Голод томит не первый день — Здоровье тает (−1 за каждые сутки без еды).'));
        registry.set('hungerPenaltyPending', { missed: 0, penalty: healed, fromClock: true });
    }
    return { blocks, applied: newBlocks, healed };
}

/**
 * Счётчик приёмов пищи за ТЕКУЩИЙ день (с ленивым сбросом при смене дня).
 * Возвращает { dayKey, meals, required, fed } — fed: норма выполнена.
 */
export function hungerStatus(registry) {
    const time = registry ? registry.get('gameTime') : null;
    const today = hungerDayKey(time);
    let st = hungerRaw(registry);
    if (st.dayKey !== today) st = { dayKey: today, meals: 0, clockMin: st.clockMin || 0, hpBlocks: st.hpBlocks || 0 };
    return {
        dayKey: today,
        meals: st.meals,
        required: MEALS_REQUIRED_PER_DAY,
        fed: st.meals >= MEALS_REQUIRED_PER_DAY,
    };
}

/** Отметить приём пищи (вызывается из meal.js registerMeal). Возвращает meals.
 *  Патч 66.73: еда СБРАСЫВАЕТ часы голода (clockMin/hpBlocks — с нуля). */
export function noteHungerMeal(registry) {
    if (!registry) return 0;
    const st = hungerStatus(registry);
    st.meals += 1;
    saveHunger(registry, { dayKey: st.dayKey, meals: st.meals, clockMin: 0, hpBlocks: 0 });
    return st.meals;
}

/**
 * Короткая строка для HUD: «🍽1/2» (сыт) / «🍽1/2 ⚠» (голодает).
 * Патч 66.73: при накопленных часах голода добавляются «⏳Nч»,
 * после суток — «❤↓» (здоровье тает), после двух суток — «📉» (навыки).
 * Пока часы голода не копились (clockMin = 0) — формат прежний (тесты r120).
 */
export function hungerStatusLine(registry) {
    const st = hungerStatus(registry);
    const warn = st.meals < MEALS_REQUIRED_PER_DAY ? ' ⚠' : '';
    let line = `🍽${st.meals}/${MEALS_REQUIRED_PER_DAY}${warn}`;
    const h = hungerHours(registry);
    if (h >= 1) {
        line += ` · ⏳${Math.floor(h)}ч`;
        if (h >= HUNGER_HP_AFTER_H) line += ' ❤↓';
        if (h >= HUNGER_SKILL_AFTER_H) line += ' 📉';
    }
    return line;
}

/**
 * Ролловер-проверка суточной нормы (вызывается из tickTime ПОСЛЕ
 * продвижения времени). Если день сменился:
 *  • за ушедшие сутки недоедено → штраф −1 HP за каждый пропуск (макс −2),
 *    HP ≥ 1, летопись, флаг 'hungerPenaltyPending' для поп-апа сцены;
 *  • счётчик переносится на новый день (сбрасывается в 0);
 *    часы голода (clockMin/hpBlocks) при ролловере НЕ сбрасываются —
 *    их сбрасывает только ЕДА (патч 66.73, пп.6–7).
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
        saveHunger(registry, { dayKey: today, meals: 0, clockMin: 0, hpBlocks: 0 });
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
    // Новый день: счётчик трапез с нуля; часы голода НЕ трогаем.
    saveHunger(registry, {
        dayKey: today, meals: 0,
        clockMin: st.clockMin || 0, hpBlocks: st.hpBlocks || 0,
    });
    return { dayChanged: true, missed, penalty, healed };
}

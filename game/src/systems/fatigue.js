// ============================================================
// Патч 66.73 (приказ владельца 14): СИСТЕМА УСТАЛОСТИ.
//
// Источник — BRP Universal Game Engine SRD (rules/ru/0200_Characters.md
// «Очки усталости и очки здравомыслия (Опция)» и 0500_System.md):
//  • «Очки усталости (ОУ) измеряют выносливость… Максимальное количество
//    очков усталости вашего персонажа равно его СИЛ + ТЕЛ»;
//  • «Ваш персонаж тратит 1 очко усталости за каждый боевой раунд
//    напряжённой деятельности (ближний бой, плавание, бег трусцой,
//    лазание и т.д.). Спринт или тяжелый физический труд стоят 1 очко
//    усталости за ход. Форсированные марши стоят 1 очко усталости в час»;
//  • «Когда показатель очков усталости опускается ниже 0, он получает
//    штраф −1% к каждой единице отрицательной усталости ко всем проверкам
//    навыков, характеристик и сопротивлений»;
//  • при −(СИЛ+ТЕЛ) — недееспособность от истощения;
//  • «Ваш персонаж восстанавливает 1 очко усталости каждую минуту…
//    в течение которой он не тратит очки усталости» (полное восстановление
//    ~20 минут бездеятельности); отдых/медленная ходьба — бесплатно.
//
// АДАПТАЦИЯ к браузерной игре (игровые часы вместо раундов):
//  • максимум ОУ = СИЛ + ТЕЛ героя (player.fatigueMax кэшируется);
//  • −1 ОУ: боевой раунд (CombatScene, каждый удар/выстрел игрока);
//  • −1 ОУ: переход по карте (форсированный марш на 1 игровой час);
//  • −1 ОУ: тяжёлая работа/охота — выстрел, обдир туши, сбор, рыбалка;
//  • восстановление: +60 ОУ за час бездеятельности (сон, отдых у костра,
//    «Провести время») — канон «1 ОУ за минуту»; любой час отдыха
//    полностью снимает усталость дня;
//  • штраф проверкам: −1 пункт за каждый отрицательный ОУ — применяется
//    в getBlessedSkill (все проверки) и loot.js (Выживание/Готовка/Знахарство);
//  • ИЗНЕМОЖЕНИЕ (ОУ ≤ −максимум): вне боя охота/сбор/рыбалка недоступны
//    («Герой изнеможён!»); В БОЮ — мягкая адаптация: удар с дополнительным
//    штрафом −20 (иначе бой невозобновляем — смерть без выбора);
//  • НПЦ усталость не тратят (упрощение демо).
//
// Состояние — player.fatigue (сохраняется в registry 'player');
// для старых сейвов/прегенов лениво инициализируется полным запасом.
// Модуль registry-only (без Phaser) — тестируется в Node.
// ============================================================

import { t } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { noteHungerTick } from './hunger.js';
// Поп-ап изнеможения (ui.js — чистый Phaser-код, Node-совместим: loot.js
// импортирует его тем же образом)
import { createDialog } from '../utils/ui.js';

/** Восстановление ОУ за час бездеятельности (канон BRP: 1 ОУ/мин). */
export const FATIGUE_RECOVER_PER_HOUR = 60;
/** Дополнительный боевой штраф при изнеможении (адаптация, см. шапку). */
export const FATIGUE_EXHAUSTED_COMBAT_PENALTY = 20;

/** Максимум ОУ по BRP SRD: СИЛ + ТЕЛ. */
export function fatigueMaxOf(player) {
    if (!player) return 100;
    return Math.max(10, (Number(player.STR) || 50) + (Number(player.CON) || 50));
}

/** Текущие ОУ героя (ленивая инициализация полным запасом — старые сейвы). */
export function fatigueOf(registry) {
    const player = registry ? registry.get('player') : null;
    if (!player) return { value: 0, max: 100, player: null };
    if (typeof player.fatigue !== 'number') player.fatigue = fatigueMaxOf(player);
    return { value: player.fatigue, max: fatigueMaxOf(player), player };
}

function saveFatigue(registry, player) {
    if (registry && player) registry.set('player', player);
}

/** Потратить n ОУ (пол: −максимум — глубже истощение не растёт). */
export function spendFatigue(registry, n = 1) {
    const { value, max, player } = fatigueOf(registry);
    if (!player) return value;
    const floor = -max;
    const next = Math.max(floor, value - Math.max(1, Number(n) || 1));
    player.fatigue = next;
    saveFatigue(registry, player);
    // Событийная летопись: впервые ушёл в минус / впервые изнемог
    if (value >= 0 && next < 0) {
        ActionLog.add(registry, t('Герой выбился из сил: усталость бьёт по всем проверкам (−1% за пункт).'));
    }
    if (value > -max && next <= -max) {
        ActionLog.add(registry, t('Герой ИЗНЕМОЖЁН: нужен отдых, охота и работа не по силам.'));
        registry.set('fatigueExhaustedPending', true);
    }
    return next;
}

/** Восстановить ОУ за минуты бездеятельности (канон: 1 ОУ/мин). */
export function recoverFatigueMinutes(registry, minutes) {
    const { value, max, player } = fatigueOf(registry);
    if (!player || !(minutes > 0) || value >= max) return value;
    player.fatigue = Math.min(max, value + Math.round(minutes));
    saveFatigue(registry, player);
    return player.fatigue;
}

/**
 * Отдых/сон: бездеятельность восстанавливает усталость ПОЛНОСТЬЮ
 * (канон BRP: полное восстановление за ~20 минут покоя). Вызывается
 * сцентрализованно из сцен (сон, час у костра, «Провести время»).
 */
export function restFatigueFull(registry) {
    const { max, player } = fatigueOf(registry);
    if (!player) return max;
    player.fatigue = max;
    saveFatigue(registry, player);
    return max;
}

/** Штраф проверкам: −1 пункт за каждый отрицательный ОУ (BRP SRD). */
export function fatigueSkillMod(registry) {
    const { value } = fatigueOf(registry);
    return Math.min(0, value);
}

/** Изнеможение: ОУ упали до −(СИЛ+ТЕЛ) — недееспособен (BRP SRD). */
export function isExhausted(registry) {
    const { value, max } = fatigueOf(registry);
    return value <= -max;
}

/**
 * Боевой штраф изнеможения (мягкая адаптация: в бою удар возможен,
 * но с дополнительным −20, см. шапку).
 */
export function combatExhaustionPenalty(registry) {
    return isExhausted(registry) ? FATIGUE_EXHAUSTED_COMBAT_PENALTY : 0;
}

/**
 * Патч 66.73: голод копится и ВНЕ тика мирового времени —
 * боевые раунды CombatScene не двигают часы, но напряжение тратит силы.
 * minutes — «эквивалентные игровые минуты» раунда (см. CombatScene).
 */
export function noteHungerActivity(registry, minutes, activity) {
    return noteHungerTick(registry, minutes, activity);
}

/** Значение навыка с усталостным штрафом (для loot.js; пол 1). */
export function fatigueAdjustedSkill(registry, value) {
    return Math.max(1, Math.round(Number(value) || 1) + fatigueSkillMod(registry));
}

/** Короткая строка для HUD: «⚡85/100» / «😫 −5/100» / «💀 изнемог». */
export function fatigueStatusLine(registry) {
    const { value, max } = fatigueOf(registry);
    if (value <= -max) return `💀0/${max}`;
    const icon = value < 0 ? '😫' : (value <= max * 0.25 ? '😩' : '⚡');
    return `${icon}${value}/${max}`;
}

/**
 * Гард изнеможения для охоты/сбора/рыбалки (вне боя): если герой
 * изнеможён (ОУ ≤ −(СИЛ+ТЕЛ)) — поп-ап «Герой изнеможён!» и запрет действия.
 * @returns {boolean} true — действие ЗАПРЕЩЕНО (поп-ап уже показан).
 */
export function exhaustedGuardPopup(scene, registry) {
    if (!isExhausted(registry)) return false;
    if (scene && scene.add) {
        createDialog(scene, t('💀 Герой изнеможён!'),
            t('Герой выбился из сил совсем — охота, сбор и рыбалка не по силам. Отдохни: сон на постоялом дворе, час у костра или бездельное время вернут силы.'),
            [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
    }
    return true;
}

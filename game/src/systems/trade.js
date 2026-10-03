// ============================================================
// Патч 66.73 (приказ владельца 5): ТОРГ В МЕНЮ ПРОДАЖИ.
//
// «реализация продажи через меню торговли с торгом за цену».
//
// Правила торга (встречная проверка BRP — Убеждение игрока против
// Убеждения торговца; торговец без навыка — Харизма против Харизмы):
//  • успех    — торговец поддаётся: цены продажи +25% до конца дня;
//  • крит     — торговец расщедрился: +50% до конца дня;
//  • провал   — упрямится: цены без изменений (попытка за день потрачена);
//  • fumble   — торговец обиделся: −10% до конца дня.
// Одна попытка на торговца в игровые сутки (registry 'haggleState');
// множитель сбрасывается на следующий день. Если беседа с торговцем
// открыта — к броску добавляется обаяние беседы (systems/charisma.js).
//
// Модуль registry-only — тестируется в Node.
// ============================================================

import { t, tf } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { opposedSkillCheck, formatOpposedCheck } from './BRPEngine.js';
import { getNpcOpposition } from '../data/npcStats.js';
import { getChaEdgeMod, clearChaEdge } from './charisma.js';

export const HAGGLE_SUCCESS_MULT = 1.25;
export const HAGGLE_CRITICAL_MULT = 1.5;
export const HAGGLE_FUMBLE_MULT = 0.9;

// Патч 66.74 (приказ 6): подсказка в меню продажи упоминает ОБА пути торга
export const HAGGLE_HINT_COMMERCE = t('Сметка знает цену — торговаться можно и ею.');

/** Ключ игрового дня (та же формула, что в hunger.js/meal.js). */
function haggleDayKey(registry) {
    const time = registry ? registry.get('gameTime') : null;
    if (!time) return 0;
    return (time.yearFromChrist * 372) + (time.month * 31) + time.day;
}

function haggleStateOf(registry) {
    const today = haggleDayKey(registry);
    let st = (registry && registry.get('haggleState')) || null;
    if (!st || st.dayKey !== today) st = { dayKey: today, traders: {} };
    return st;
}

function saveHaggleState(registry, st) {
    if (registry) registry.set('haggleState', st);
}

/** Действующий множитель цен торговца (1 — торговал без торга). */
export function haggleMultFor(registry, npcId) {
    if (!registry || !npcId) return 1;
    const st = haggleStateOf(registry);
    const rec = st.traders[npcId];
    return rec ? (Number(rec.mult) || 1) : 1;
}

/** Можно ли торговаться с этим торговцем сегодня (одна попытка в сутки). */
export function canHaggleToday(registry, npcId) {
    if (!registry || !npcId) return false;
    const st = haggleStateOf(registry);
    return !st.traders[npcId];
}

/** Описание текущей цены (для шапки меню продажи). */
export function haggleHintLine(registry, npcId) {
    const mult = haggleMultFor(registry, npcId);
    if (mult > 1) return tf(t('🤝 Торг удался: цены +{0}% до конца дня.'), Math.round((mult - 1) * 100));
    if (mult < 1) return t('🤝 Торговец обиделся: цены −10% до конца дня.');
    if (!canHaggleToday(registry, npcId)) return t('🤝 Сегодня торговец уже наслушался тебя — торговаться больше не станет.');
    return t('🤝 Можно поторговаться (Убеждение; одна попытка в день).');
}

/**
 * Попытка торга (одна на торговца в сутки).
 * ПАТЧ 66.74 (приказ 6): СМЕТКА — синергия с торгом: вместо Убеждения
 * можно торговаться ЗНАНИЕМ ЦЕН (кнопка «Сметить товар») — общий дневной
 * лимит один: слово ИЛИ сметка, что раньше удастся.
 * @param {Object} registry — игровой registry
 * @param {string} npcId — id торговца ('tavernkeeper' | 'butcher')
 * @param {number} skillValue — навык игрока (Убеждение ИЛИ Сметка)
 * @param {object} [opts] — { skillLabel: подпись проверки ('Убеждение'|'Сметка') }
 * @returns {{ done:boolean, mult:number, message:string, checkLine:string|null }}
 */
export function attemptHaggle(registry, npcId, skillValue, opts = {}) {
    const label = opts.skillLabel || 'Убеждение';
    if (!canHaggleToday(registry, npcId)) {
        return { done: false, mult: haggleMultFor(registry, npcId),
            message: t('Торговец отмахивается: «Нынче у меня цены твёрдые, не приставай!»'), checkLine: null };
    }
    const opp = getNpcOpposition({ id: npcId }, 'persuade');
    const edge = getChaEdgeMod(registry);
    const res = opposedSkillCheck((Number(skillValue) || 1) + edge, opp.value, 0);
    const checkLine = formatOpposedCheck(res, label + (edge ? (edge > 0 ? ` (+${edge} обаяние)` : ` (${edge} обаяние)`) : ''),
        `${opp.ruNameGen} торговца`);

    let mult = 1;
    let message;
    if (res.won && res.critical) {
        mult = HAGGLE_CRITICAL_MULT;
        message = t('Торговец ахает от твоей прыти: «Эк, какой юркий! Ладно, последняя цена — и то из уважения к дару слова!»');
        ActionLog.add(registry, tf(t('Торг (крит Убеждения): цены продажи +{0}% на сутки.'), Math.round((mult - 1) * 100)));
    } else if (res.won) {
        mult = HAGGLE_SUCCESS_MULT;
        message = t('Торговец крякает и нехотя поддаётся: «Уж больно слово у тебя липкое. Ладно, накину по малой части». Цены +25% до конца дня.');
        ActionLog.add(registry, tf(t('Торг удался (Убеждение): цены продажи +{0}% на сутки.'), Math.round((mult - 1) * 100)));
    } else if (res.result === 'fumble') {
        mult = HAGGLE_FUMBLE_MULT;
        message = t('Торговец осерчал: «Мне тут не хами! Платят у меня и так сполна — а ежели не люб, так и по дешёвке возьму». Цены −10% до конца дня.');
        ActionLog.add(registry, t('Торг провалился (fumble): торговец обиделся — цены −10% на сутки.'));
    } else {
        message = t('Торговец стоит как стена: «Не гни свою линию, путник. Цены у меня честные — бери, что дают». Попытка за день потрачена.');
        ActionLog.add(registry, t('Торг не удался (Убеждение): торговец не поддался.'));
    }
    const st = haggleStateOf(registry);
    st.traders[npcId] = { done: true, mult };
    saveHaggleState(registry, st);
    // Обаяние беседы сработало один раз — на день торга его хватало
    if (registry.get('chaEdge')) clearChaEdge(registry);
    return { done: true, mult, message, checkLine };
}

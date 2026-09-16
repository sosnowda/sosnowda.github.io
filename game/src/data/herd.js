// СТАДО И ВОДОПОЙ (раунд 31, п.2 спецификации владельца):
// «Пастухи водят коров и лошадей на водопой, с локации ВЫПАС,
//  на локацию РЕКА или ОЗЕРО, УТРОМ и ВЕЧЕРОМ».
//
// Расписание стада на игровой день (детерминировано по дню и seed):
//  - УТРОМ (6–10) и ВЕЧЕРОМ (16–20) — стадо у воды: на Реке или у Озера
//    (куда именно водят — чередуется ото дня к дню);
//  - днём (10–16) и на рассвете (5–6) — пасётся на ВЫПАСЕ;
//  - НОЧЬЮ (20–5) — скот загнан в хлев (п.3: ночью на локациях никого,
//    только вор может бродить).
//
// Модуль чистый (без Phaser) — работает в headless-тестах.

import { getTime } from '../systems/TimeSystem.js';

// Окна водопоя (УТРОМ И ВЕЧЕРОМ — п.2)
export const HERD_WINDOWS = {
    morning: { from: 6, to: 10 },
    evening: { from: 16, to: 20 },
};

// ---- Детерминированный псевдорандом (FNV-1a → [0..1)) ----
function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

function dayKeyOf(time) {
    if (!time) return 0;
    return time.yearFromChrist * 372 + time.month * 31 + time.day;
}

/**
 * Где стадо сейчас.
 * @returns {{ place: 'pasture'|'river'|'lake'|'barn', window: 'morning'|'evening'|null,
 *             drinking: boolean, waterPlace: 'river'|'lake' }}
 */
export function getHerdState(registry) {
    const time = getTime(registry);
    const hour = time ? (time.hour ?? 12) : 12;
    const dk = dayKeyOf(time);
    const seed = registry.get('npcSeed') || 0;
    // Куда водят на водопой — решается на день (то Река, то Озеро)
    const waterPlace = hash01(`${seed}:herd:${dk}:place`) < 0.5 ? 'river' : 'lake';

    if (hour >= HERD_WINDOWS.morning.from && hour < HERD_WINDOWS.morning.to) {
        return { place: waterPlace, window: 'morning', drinking: true, waterPlace };
    }
    if (hour >= HERD_WINDOWS.evening.from && hour < HERD_WINDOWS.evening.to) {
        return { place: waterPlace, window: 'evening', drinking: true, waterPlace };
    }
    // Ночь: скот в хлеву (и на выпасе, и у воды ночью его нет — п.3)
    if (hour >= 20 || hour < 5) {
        return { place: 'barn', window: null, drinking: false, waterPlace };
    }
    // День — на выпасе
    return { place: 'pasture', window: null, drinking: false, waterPlace };
}

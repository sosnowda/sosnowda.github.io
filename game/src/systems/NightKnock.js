// Раунд 66.21 (приказы владельца 9–10): СТУК В ЗАПЕРТУЮ ДВЕРЬ НОЧЬЮ.
// Жилые дома на ночь запираются, но постучать можно: хозяев это злит
// (−1 к личной репутации отвечающего — смягчено раундом 66.22, приказ 5),
// сдача срочного поручения (активного или выполненного-неоплаченного)
// от любого жильца дома — впускают и заводят разговор.
//
// Чистая логика без Phaser: реестр (registry) передаётся параметром,
// юнит-тест test_round82 гоняет её в Node.

import { getPresence } from '../data/npcPresence.js';
import { findNpc, getNpcShortName } from '../data/npcNames.js';
import { changeNpcRep } from '../data/reputation.js';
import { dayKeyOf } from '../data/daily.js';
import { getTime } from './TimeSystem.js';

/** Штраф к личной репутации за ночной стук (раунд 66.22, приказ 5: было −2). */
export const KNOCK_REP_PENALTY = -1;

/** Сколько раз за ночь в один дом будут открывать (дальше — не отвечают). */
export const KNOCKS_PER_NIGHT = 2;

/** Сколько стуков в этот дом уже было этой ночью. */
export function knocksTonight(registry, interiorId) {
    const time = getTime(registry);
    const log = registry.get('knockLog');
    if (!log || log.day !== dayKeyOf(time)) return 0;
    return log.counts[interiorId] || 0;
}

function countKnock(registry, interiorId) {
    const time = getTime(registry);
    const day = dayKeyOf(time);
    const log = registry.get('knockLog') || { day, counts: {} };
    if (log.day !== day) { log.day = day; log.counts = {}; }
    log.counts[interiorId] = (log.counts[interiorId] || 0) + 1;
    registry.set('knockLog', log);
}

/**
 * Кто отвечает на стук: хозяин (жив и дома), иначе вторая фигура (жена),
 * иначе null (в доме никого — стучать некому).
 * @returns {{ id: string, npc: object }|null}
 */
export function doorResponder(registry, interior) {
    const candidates = [interior.npcId, interior.secondaryNpcId].filter(Boolean);
    for (const id of candidates) {
        const pres = getPresence(registry, id);
        const here = pres.place === 'home' || pres.place === interior.id;
        if (!here) continue;
        const npc = findNpc(registry, id);
        return { id, npc };
    }
    return null;
}

/**
 * Есть ли у героя СРОЧНОЕ дело к жильцам дома: активное поручение от них
 * или выполненное, но не оплаченное (сдача не может ждать до утра).
 * @returns {boolean}
 */
export function hasUrgentQuestBusiness(registry, interior) {
    const residents = [interior.npcId, interior.secondaryNpcId].filter(Boolean);
    const q = registry.get('quest') || {};
    const list = q.activeQuests || [];
    return list.some(aq => {
        if (!aq.accepted || aq.failed || !residents.includes(aq.npcId)) return false;
        if (aq.isMainQuest) return true; // главное дело — всегда срочно
        // активное (несделанное) ИЛИ выполненное-неоплаченное (сдача)
        return !aq.completed || !aq.rewardClaimed;
    });
}

/**
 * Постучать в запертую дверь.
 * Применяет штраф к личной репутации отвечающего (−2) и решает, впустят ли.
 * @returns {{ opened: boolean, responder: {id, npc}|null, urgent: boolean,
 *             penalty: number, knocksBefore: number, refused: boolean }}
 *   opened      — дверь откроют (внутрь можно войти);
 *   refused     — слишком много стуков за ночь, не отвечают;
 *   urgent      — дело срочное (сдача/активное поручение);
 *   penalty     — фактическая ДЕЛЬТА репутации (отрицательная).
 */
export function knockAtDoor(registry, interior) {
    const knocksBefore = knocksTonight(registry, interior.id);
    countKnock(registry, interior.id);
    const responder = doorResponder(registry, interior);
    if (!responder) {
        return { opened: false, responder: null, urgent: false, penalty: 0, knocksBefore, refused: false };
    }
    // Стук злит жильца — всегда (даже при впуске по важному делу).
    const before = (() => { const rep = registry.get('reputation'); return (rep && rep.npcRep && rep.npcRep[responder.id]) || 0; })();
    const after = changeNpcRep(registry, responder.id, KNOCK_REP_PENALTY, 'разбужен стуком в дверь');
    const penalty = Math.min(0, after - before) || KNOCK_REP_PENALTY;
    if (knocksBefore + 1 > KNOCKS_PER_NIGHT) {
        return { opened: false, responder, urgent: false, penalty, knocksBefore, refused: true };
    }
    const urgent = hasUrgentQuestBusiness(registry, interior);
    return { opened: urgent, responder, urgent, penalty, knocksBefore, refused: false };
}

/** Короткое имя отвечающего (для реплики в поп-апе). */
export function responderName(registry, responder) {
    if (!responder || !responder.id) return '';
    return getNpcShortName(registry, responder.id);
}

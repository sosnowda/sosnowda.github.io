// ============================================================
// Патч 66.73 (приказ владельца 16): ХАРИЗМА ПРИ ДИАЛОГАХ.
//
// «добавить новую механику проверки и сравнения Харизмы, у игрока и
// НПЦ, при всех диалогах, чтобы получить бонус\пенальти к проверкам
// разговорных навыков».
//
// Правило (встречная проверка BRP — обе стороны бросают d100):
//  • игрок бросает против своей ХАР, НПЦ — против своей ХАР
//    (канонические параметры жителя с возрастом, npcStats.js);
//  • степени успеха сравниваются (крит > особый > успех > провал),
//    при равных — точность броска (меньший d100);
//  • ИТОГ БЕСЕДЫ (модификатор разговорных проверок):
//      крит    — «впечатляющее обаяние»  → разговорные проверки +10;
//      успех   — «благоприятное впеч.»   → разговорные проверки +5;
//      провал  — «неприязнь»             → разговорные проверки −5;
//      fumble  — «антипатия»             → разговорные проверки −10.
//
// Модификатор применяется КО ВСЕМ разговорным проверкам беседы:
// Убеждение, Болтовня, Запугивание (похвала/угроза/уговоры/торг словом).
// Действует до конца беседы: DialogueRunner.run() бросает кости,
// DialogueRunner._finish() снимает (registry-ключ 'chaEdge').
//
// Модуль registry-only — тестируется в Node.
// ============================================================

import { t, tf } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { opposedSkillCheck } from './BRPEngine.js';
import { getNpcResolvedStats } from '../data/npcStats.js';

export const CHA_EDGE_MAX = 10;
export const CHA_EDGE_SUCCESS = 5;
export const CHA_EDGE_FAIL = -5;
export const CHA_EDGE_FUMBLE = -10;

/** Текущий модификатор обаяния беседы (0 — вне диалога/не бросалось). */
export function getChaEdgeMod(registry) {
    const st = registry && registry.get('chaEdge');
    return st ? (Number(st.mod) || 0) : 0;
}

/** Строка-подсказка для окна беседы (или null). */
export function getChaEdgeLine(registry) {
    const st = registry && registry.get('chaEdge');
    return st ? (st.line || null) : null;
}

/** Снять модификатор беседы (вызывает DialogueRunner._finish). */
export function clearChaEdge(registry) {
    if (registry) registry.set('chaEdge', null);
}

/**
 * Бросок Харизмы при начале беседы (п.16: «при всех диалогах»).
 * @param {Object} registry — игровой registry
 * @param {string|null} npcId — id НПЦ (null/незнакомец — проверка не ведётся)
 * @param {Object} [player] — герой (по умолчанию registry 'player')
 * @returns {{ mod:number, line:string|null, result:string, roll:number, npcRoll:number }|null}
 */
export function rollCharismaEdge(registry, npcId, player) {
    clearChaEdge(registry);
    const p = player || (registry && registry.get('player'));
    if (!registry || !p || !npcId) return null;
    const npcStats = getNpcResolvedStats({ id: npcId });
    if (!npcStats || !Number.isFinite(npcStats.CHA)) return null; // незнакомец — канона нет
    const playerCha = Number(p.CHA) || 50;
    const res = opposedSkillCheck(playerCha, npcStats.CHA, 0);
    let mod = 0;
    let verdict;
    if (res.won && res.critical) { mod = CHA_EDGE_MAX; verdict = t('впечатляющее обаяние'); }
    else if (res.won) { mod = CHA_EDGE_SUCCESS; verdict = t('благоприятное впечатление'); }
    else if (res.result === 'fumble') { mod = CHA_EDGE_FUMBLE; verdict = t('антипатия'); }
    else { mod = CHA_EDGE_FAIL; verdict = t('неприязнь'); }
    const line = tf(t('✨ Обаяние {0} против {1} (броски {2}/{3}): {4} — разговорные проверки {5}{6}.'),
        playerCha, npcStats.CHA, res.roll, res.npcRoll, verdict,
        mod > 0 ? '+' : '', mod);
    registry.set('chaEdge', { mod, line, npcId });
    ActionLog.add(registry, line);
    return { mod, line, result: res.result, roll: res.roll, npcRoll: res.npcRoll };
}

/**
 * Значение разговорного навыка с учётом обаяния беседы (пол 1).
 * Применяется в похвале/угрозе/уговорах/торге: skill + getChaEdgeMod(registry).
 */
export function chaAdjustedTalkSkill(registry, skillValue) {
    return Math.max(1, Math.round(Number(skillValue) || 1) + getChaEdgeMod(registry));
}

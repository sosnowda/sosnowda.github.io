// Система репутации для «Летописи Руси».
// 
// Два уровня репутации:
// 1. Деревенская репутация (villageRep): -100..+100 — общее мнение деревни об игроке.
// 2. Личная репутация у каждого NPC (npcRep[npcId]): -100..+100.
//
// Пороги:
//   +50..+100  — друг деревни, бонусы (скидки, подарки, особые задания)
//   +10..+49   — уважаемый человек
//    0..+9     — нейтральный
//   -1..-29    — нелюбимый
//   -30..-59   — нежеланный человек (NPC отказываются говорить/торговать)
//   -60..-100  — враг (NPC может напасть, староста выгоняет из деревни)

import { ActionLog } from './actionLog.js';
import { getNpcs } from './npcNames.js';
import { getTimeOfDay } from '../systems/TimeSystem.js';
import { skillCheck } from '../systems/BRPEngine.js';

const VILLAGE_REP_MIN = -100;
const VILLAGE_REP_MAX = 100;
const NPC_REP_MIN = -100;
const NPC_REP_MAX = 100;

const EXPULSION_THRESHOLD = -60;  // ниже этого — изгнание
const ATTACK_THRESHOLD = -60;     // ниже этого — NPC может напасть
const REFUSE_TALK_THRESHOLD = -30; // ниже этого — NPC отказывается говорить/торговать

// === ИНИЦИАЛИЗАЦИЯ ===

export function initReputation(registry) {
    const rep = {
        villageRep: 0,  // нейтральный старт
        npcRep: {},     // { npcId: 0 }
        beggingCount: {}, // { npcId: 0 } — сколько раз просил у этого NPC
    };
    const npcs = getNpcs(registry);
    npcs.forEach(npc => {
        rep.npcRep[npc.id] = 0;  // нейтральный старт
        rep.beggingCount[npc.id] = 0;
    });
    registry.set('reputation', rep);
    return rep;
}

export function getReputation(registry) {
    return registry.get('reputation') || initReputation(registry);
}

// === ПОЛУЧЕНИЕ ЗНАЧЕНИЙ ===

export function getVillageRep(registry) {
    return getReputation(registry).villageRep || 0;
}

export function getNpcRep(registry, npcId) {
    const rep = getReputation(registry);
    return rep.npcRep[npcId] || 0;
}

export function getReputationLevel(rep) {
    if (rep >= 50) return { level: 'friend', name: 'друг деревни', color: '#60ff60' };
    if (rep >= 10) return { level: 'respected', name: 'уважаемый', color: '#a0e060' };
    if (rep >= 0) return { level: 'neutral', name: 'нейтральный', color: '#c0c0c0' };
    if (rep >= -29) return { level: 'disliked', name: 'нелюбимый', color: '#ffa040' };
    if (rep >= -59) return { level: 'unwanted', name: 'нежеланный', color: '#ff6040' };
    return { level: 'enemy', name: 'враг', color: '#ff2020' };
}

// === ИЗМЕНЕНИЕ РЕПУТАЦИИ ===

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function changeVillageRep(registry, delta, reason) {
    const rep = getReputation(registry);
    rep.villageRep = clamp(rep.villageRep + delta, VILLAGE_REP_MIN, VILLAGE_REP_MAX);
    registry.set('reputation', rep);
    if (reason) {
        ActionLog.add(registry, `Репутация в деревне ${delta > 0 ? '+' : ''}${delta} (${reason}). Итого: ${rep.villageRep}.`);
    }
    return rep.villageRep;
}

export function changeNpcRep(registry, npcId, delta, reason) {
    const rep = getReputation(registry);
    if (!rep.npcRep[npcId]) rep.npcRep[npcId] = 0;
    rep.npcRep[npcId] = clamp(rep.npcRep[npcId] + delta, NPC_REP_MIN, NPC_REP_MAX);
    registry.set('reputation', rep);
    // Личная репутация влияет на деревенскую (на 20% от изменения)
    if (delta !== 0) {
        rep.villageRep = clamp(rep.villageRep + Math.round(delta * 0.2), VILLAGE_REP_MIN, VILLAGE_REP_MAX);
        registry.set('reputation', rep);
    }
    return rep.npcRep[npcId];
}

// === ПРОВЕРКИ ПОВЕДЕНИЯ NPC ===

/**
 * Проверить, хочет ли NPC говорить с игроком.
 * Учитывает: время суток, занятость, репутацию, исключения.
 * 
 * Возвращает { canTalk, reason, message }
 */
export function checkNpcWillingToTalk(registry, npcId, options = {}) {
    const npcRep = getNpcRep(registry, npcId);
    const timeState = registry.get('gameTime');
    const hour = timeState ? timeState.hour : 12;
    const tod = getTimeOfDay(hour);
    
    // Пункт 4: При крайней вражде — NPC может напасть
    if (npcRep <= ATTACK_THRESHOLD) {
        return {
            canTalk: false,
            willAttack: true,
            reason: 'enemy',
            message: 'NPC в ярости и готов напасть на тебя!',
        };
    }
    
    // Пункт 3: При низкой репутации — отказ говорить/торговать
    if (npcRep <= REFUSE_TALK_THRESHOLD) {
        return {
            canTalk: false,
            reason: 'low_rep',
            message: '«Не желаю с тобой говорить! Уходи!»',
        };
    }
    
    // Пункт 2: Ночью люди не любят, когда их будят
    if (tod.id === 'night' || tod.id === 'dusk') {
        // Исключения (п.5):
        // 1. Новый незнакомый человек — NPC ещё не знает игрока
        const npcs = getNpcs(registry);
        const npc = npcs.find(n => n.id === npcId);
        const isNew = npc && !npc.met;
        
        // 2. Срочные/важные дела, опасность
        const isUrgent = options.urgent === true;
        
        // 3. Предупреждение об опасности
        const isDanger = options.danger === true;
        
        // 4. Подарок
        const isGift = options.gift === true;
        
        // 5. Личное поручение от другого NPC
        const isErrand = options.errand === true;
        
        // 6. Выполненное задание
        const isQuestComplete = options.questComplete === true;
        
        if (!isNew && !isUrgent && !isDanger && !isGift && !isErrand && !isQuestComplete) {
            // Падение репутации за беспокойство ночью
            changeNpcRep(registry, npcId, -3, 'разбужен ночью');
            return {
                canTalk: false,
                reason: 'night',
                message: '«Какого ляда ты меня будишь среди ночи?! Спать мешаешь! Уходи, завтра поговорим!»',
            };
        }
    }
    
    // Пункт 5: Занятые люди не любят болтовню (исключения те же)
    // Занятость определяется по расписанию NPC
    if (options.npcBusy && !options.urgent && !options.danger && !options.gift && 
        !options.errand && !options.questComplete) {
        const npcs = getNpcs(registry);
        const npc = npcs.find(n => n.id === npcId);
        const isNew = npc && !npc.met;
        
        if (!isNew) {
            return {
                canTalk: false,
                reason: 'busy',
                message: '«Не видишь — я занят! Потом приходи.»',
            };
        }
    }
    
    return { canTalk: true };
}

/**
 * Пункт 6: Штраф за попрошайничество.
 * Чем больше просишь и чем чаще — тем больше падение.
 */
export function applyBeggingPenalty(registry, npcId) {
    const rep = getReputation(registry);
    if (!rep.beggingCount[npcId]) rep.beggingCount[npcId] = 0;
    rep.beggingCount[npcId]++;
    const count = rep.beggingCount[npcId];
    
    // Каждое последующее попрошайничество даёт больший штраф
    let penalty = -3 - count * 2; // -5, -7, -9, ...
    
    // Пункт 13.5: Высокая репутация → меньше падение
    const npcRep = rep.npcRep[npcId] || 0;
    if (npcRep >= 50) penalty = Math.round(penalty * 0.3);
    else if (npcRep >= 30) penalty = Math.round(penalty * 0.5);
    else if (npcRep >= 10) penalty = Math.round(penalty * 0.8);
    
    changeNpcRep(registry, npcId, penalty, 'попрошайничество');
    changeVillageRep(registry, Math.round(penalty * 0.5), 'попрошайничество');
    
    return penalty;
}

/**
 * Пункт 8: Бонус за выполнение задания.
 */
export function applyQuestCompleteBonus(registry, npcId, questDifficulty) {
    const bonus = questDifficulty === 'hard' ? 15 : (questDifficulty === 'medium' ? 10 : 5);
    changeNpcRep(registry, npcId, bonus, 'выполнено задание');
    changeVillageRep(registry, Math.round(bonus * 0.7), 'выполнено задание');
    return bonus;
}

/**
 * Пункт 9: Бонус за выпивку всем в таверне.
 */
export function applyTreatEveryoneBonus(registry) {
    const npcs = getNpcs(registry);
    let totalBonus = 0;
    npcs.forEach(npc => {
        changeNpcRep(registry, npc.id, 3, 'угостил выпивкой');
        totalBonus += 3;
    });
    changeVillageRep(registry, 5, 'угостил всех в таверне');
    return totalBonus;
}

/**
 * Пункт 10: Подарок NPC — шанс повышения репутации.
 */
export function applyGiftBonus(registry, npcId, giftValue) {
    // Чем ценнее подарок, тем больше шанс и размер бонуса
    const baseBonus = Math.min(15, Math.max(2, Math.floor(giftValue / 5)));
    // Шанс успеха зависит от текущей репутации (чем хуже — тем сложнее задобрить)
    const npcRep = getNpcRep(registry, npcId);
    const successChance = Math.max(20, 80 + npcRep / 2); // 20..80%
    const roll = 1 + Math.floor(Math.random() * 100);
    
    if (roll <= successChance) {
        changeNpcRep(registry, npcId, baseBonus, 'подарок принят');
        return { success: true, bonus: baseBonus };
    } else {
        // Неудача — небольшой штраф (думает, что подлизаешься)
        changeNpcRep(registry, npcId, -1, 'подарок отвергнут');
        return { success: false, bonus: -1 };
    }
}

/**
 * Пункт 11: Похвала NPC через навык Oratory.
 */
export function applyCompliment(registry, npcId, oratorySkill) {
    const res = skillCheck(oratorySkill);
    
    if (res.result === 'critical') {
        changeNpcRep(registry, npcId, 8, 'удачная похвала (крит)');
        return { success: true, bonus: 8, message: '«Ох, спасибо на добром слове!»', roll: res.roll };
    } else if (res.result === 'success') {
        changeNpcRep(registry, npcId, 3, 'удачная похвала');
        return { success: true, bonus: 3, message: '«Благодарю за доброе слово.»', roll: res.roll };
    } else if (res.result === 'fumble') {
        changeNpcRep(registry, npcId, -5, 'неудачная лесть (fumble)');
        return { success: false, bonus: -5, message: '«Не льсти мне, не люблю я это!»', roll: res.roll };
    } else {
        changeNpcRep(registry, npcId, -2, 'неудачная лесть');
        return { success: false, bonus: -2, message: '«Хватит пустые слова говорить.»', roll: res.roll };
    }
}

/**
 * Пункт 7: Штраф за неадекватное/агрессивное поведение.
 */
export function applyAggressiveBehaviorPenalty(registry, npcId, severity) {
    const penalty = severity === 'severe' ? -15 : (severity === 'moderate' ? -8 : -3);
    changeNpcRep(registry, npcId, penalty, 'агрессивное поведение');
    changeVillageRep(registry, Math.round(penalty * 0.7), 'агрессивное поведение');
    return penalty;
}

// === ПРОВЕРКА ИЗГНАНИЯ (п.12) ===

/**
 * Проверить, не пора ли выгнать игрока из деревни.
 */
export function checkExpulsion(registry) {
    const villageRep = getVillageRep(registry);
    if (villageRep <= EXPULSION_THRESHOLD) {
        return {
            expelled: true,
            message: `Староста собрал сходку: «Ты позоришь нашу деревню! Уходи и не возвращайся!» ` +
                     `Игрок изгнан из деревни с репутацией ${villageRep}.`,
        };
    }
    return { expelled: false };
}

// === БОНУСЫ ВЫСОКОЙ РЕПУТАЦИИ (п.13) ===

/**
 * Получить модификатор цены при торговле (п.13.2).
 * Высокая репутация → скидка 1-20%.
 */
export function getPriceModifier(registry, npcId) {
    const npcRep = getNpcRep(registry, npcId);
    if (npcRep >= 50) return 0.80; // 20% скидка
    if (npcRep >= 30) return 0.90; // 10% скидка
    if (npcRep >= 10) return 0.95; // 5% скидка
    if (npcRep <= -30) return 1.20; // 20% наценка
    if (npcRep <= -10) return 1.10; // 10% наценка
    return 1.0; // без модификатора
}

/**
 * Получить модификатор награды за задание (п.13.3).
 */
export function getRewardModifier(registry, npcId) {
    const npcRep = getNpcRep(registry, npcId);
    if (npcRep >= 50) return 1.3; // +30% к награде
    if (npcRep >= 30) return 1.15; // +15%
    if (npcRep >= 10) return 1.05; // +5%
    return 1.0;
}

/**
 * Проверить, доступен ли заказ оружия у кузнеца (п.13.7).
 */
export function canOrderCustomWeapon(registry, npcId) {
    return getNpcRep(registry, npcId) >= 40;
}

/**
 * Проверить, доступны ли особые/деликатные задания (п.13.4).
 */
export function canGetSpecialQuests(registry, npcId) {
    return getNpcRep(registry, npcId) >= 30;
}

/**
 * Проверить, может ли NPC подарить что-то игроку в диалоге (п.13.1).
 */
export function canNpcGiftPlayer(registry, npcId) {
    return getNpcRep(registry, npcId) >= 40;
}

/**
 * Получить модификатор падения репутации при просьбах (п.13.5).
 * Высокая репутация → меньше падение.
 */
export function getBeggingPenaltyModifier(registry, npcId) {
    const npcRep = getNpcRep(registry, npcId);
    if (npcRep >= 50) return 0.3; // -70% к штрафу
    if (npcRep >= 30) return 0.5; // -50%
    if (npcRep >= 10) return 0.8; // -20%
    return 1.0;
}

/**
 * Проверить, будет ли NPC нападать на игрока (п.4).
 */
export function willNpcAttack(registry, npcId) {
    return getNpcRep(registry, npcId) <= ATTACK_THRESHOLD;
}

/**
 * Проверить, откажется ли NPC торговать (п.3).
 */
export function willNpcRefuseTrade(registry, npcId) {
    return getNpcRep(registry, npcId) <= REFUSE_TALK_THRESHOLD;
}

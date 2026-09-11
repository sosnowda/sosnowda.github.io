// Система репутации для «Летописи Руси».
// 
// Два уровня репутации:
// 1. Деревенская репутация (villageRep): -100..+100 — общее мнение деревни об игроке.
// 2. Личная репутация у каждого NPC (npcRep[npcId]): -100..+100.
//
// Пороги:
//   +100       — принят как свой → ВЫИГРЫШ
//   +50..+99   — друг деревни, бонусы (скидки, подарки, особые задания)
//   +10..+49   — уважаемый человек
//    0..+9     — нейтральный
//   -1..-29    — нелюбимый
//   -30..-49   — NPC отказывается говорить
//   -50..-79   — NPC отказывается торговать
//   -80..-100  — враг (NPC имеет ШАНС напасть, староста выгоняет из деревни)
//
// Балансировка (п.12): повышение репутации — сложное и медленное,
// понижение — быстрое и лёгкое.

import { ActionLog } from './actionLog.js';
import { getNpcs } from './npcNames.js';
import { getTimeOfDay } from '../systems/TimeSystem.js';
import { skillCheck } from '../systems/BRPEngine.js';

const VILLAGE_REP_MIN = -100;
const VILLAGE_REP_MAX = 100;
const NPC_REP_MIN = -100;
const NPC_REP_MAX = 100;

const WIN_THRESHOLD = 100;          // +100 = выигрыш (п.13)
const EXPULSION_THRESHOLD = -80;    // ниже этого — изгнание (п.12)
const ATTACK_THRESHOLD = -80;       // ниже этого — ШАНС нападения (п.2)
const REFUSE_TRADE_THRESHOLD = -50; // ниже этого — отказ торговать (п.1)
const REFUSE_TALK_THRESHOLD = -30;  // ниже этого — отказ говорить (п.1)

// === ИНИЦИАЛИЗАЦИЯ ===

export function initReputation(registry) {
    const rep = {
        villageRep: 0,
        npcRep: {},
        beggingCount: {},
        threatenedCount: {}, // сколько раз угрожал каждому NPC
    };
    const npcs = getNpcs(registry);
    npcs.forEach(npc => {
        rep.npcRep[npc.id] = 0;
        rep.beggingCount[npc.id] = 0;
        rep.threatenedCount[npc.id] = 0;
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
    if (rep >= 100) return { level: 'kin', name: 'свой человек', color: '#40ff40' };
    if (rep >= 50) return { level: 'friend', name: 'друг деревни', color: '#60ff60' };
    if (rep >= 10) return { level: 'respected', name: 'уважаемый', color: '#a0e060' };
    if (rep >= 0) return { level: 'neutral', name: 'нейтральный', color: '#c0c0c0' };
    if (rep >= -29) return { level: 'disliked', name: 'нелюбимый', color: '#ffa040' };
    if (rep >= -49) return { level: 'unwanted', name: 'нежеланный', color: '#ff8040' };
    if (rep >= -79) return { level: 'shunned', name: 'отверженный', color: '#ff6040' };
    return { level: 'enemy', name: 'враг', color: '#ff2020' };
}

// === ИЗМЕНЕНИЕ РЕПУТАЦИИ (п.12: повышение медленное, понижение быстрое) ===

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function changeVillageRep(registry, delta, reason) {
    const rep = getReputation(registry);
    // Положительные изменения уменьшаются на 30% (сложно повысить)
    // Отрицательные изменения увеличиваются на 20% (легко понизить)
    let actualDelta = delta;
    if (delta > 0) actualDelta = Math.round(delta * 0.7);
    else if (delta < 0) actualDelta = Math.round(delta * 1.2);
    
    rep.villageRep = clamp(rep.villageRep + actualDelta, VILLAGE_REP_MIN, VILLAGE_REP_MAX);
    registry.set('reputation', rep);
    if (reason) {
        ActionLog.add(registry, `Репутация в деревне ${actualDelta > 0 ? '+' : ''}${actualDelta} (${reason}). Итого: ${rep.villageRep}.`);
    }
    return rep.villageRep;
}

export function changeNpcRep(registry, npcId, delta, reason) {
    const rep = getReputation(registry);
    if (!rep.npcRep[npcId]) rep.npcRep[npcId] = 0;
    // Тот же балансировочный множитель
    let actualDelta = delta;
    if (delta > 0) actualDelta = Math.round(delta * 0.7);
    else if (delta < 0) actualDelta = Math.round(delta * 1.2);
    
    rep.npcRep[npcId] = clamp(rep.npcRep[npcId] + actualDelta, NPC_REP_MIN, NPC_REP_MAX);
    registry.set('reputation', rep);
    // Личная репутация влияет на деревенскую (на 15% от изменения)
    if (actualDelta !== 0) {
        rep.villageRep = clamp(rep.villageRep + Math.round(actualDelta * 0.15), VILLAGE_REP_MIN, VILLAGE_REP_MAX);
        registry.set('reputation', rep);
    }
    return rep.npcRep[npcId];
}

// === ПРОВЕРКИ ПОВЕДЕНИЯ NPC ===

/**
 * Проверить, хочет ли NPC говорить с игроком.
 * Учитывает: время суток, занятость, репутацию, исключения.
 */
export function checkNpcWillingToTalk(registry, npcId, options = {}) {
    const npcRep = getNpcRep(registry, npcId);
    const timeState = registry.get('gameTime');
    const hour = timeState ? timeState.hour : 12;
    const tod = getTimeOfDay(hour);
    
    // П.2: При крайней вражде (−80..−100) — лишь ШАНС нападения
    if (npcRep <= ATTACK_THRESHOLD) {
        // Шанс нападения зависит от того, насколько низка репутация
        // −80: 10%, −90: 30%, −100: 50%
        const attackChance = Math.max(10, (Math.abs(npcRep) - 70) * 5);
        const roll = 1 + Math.floor(Math.random() * 100);
        if (roll <= attackChance) {
            return {
                canTalk: false,
                willAttack: true,
                reason: 'enemy',
                message: 'NPC в ярости и бросается на тебя!',
            };
        } else {
            // Не напал, но говорить не будет
            return {
                canTalk: false,
                reason: 'enemy',
                message: '«Не смей ко мне подходить! Уходи, пока цел!»',
            };
        }
    }
    
    // П.1: При −50..−30 — отказ торговать
    // При −30..−1 — отказ говорить (но торговать может? нет — п.1: ≤−30 говорить, ≤−50 торговать)
    // Исправление: ≤−30 отказ говорить, ≤−50 отказ торговать
    // Но отказ торговать не означает отказ говорить — проверяем отдельно
    if (npcRep <= REFUSE_TALK_THRESHOLD && npcRep > ATTACK_THRESHOLD) {
        return {
            canTalk: false,
            reason: 'low_rep',
            message: '«Не желаю с тобой говорить! Уходи!»',
        };
    }
    
    // П.3: Ночью люди не любят, когда их будят
    // ИСПРАВЛЕНО (п.3): убраны из ночных исключений: новый человек, подарок, поручение
    if (tod.id === 'night' || tod.id === 'dusk') {
        // Оставшиеся исключения:
        // 2. Срочные/важные дела, опасность
        const isUrgent = options.urgent === true;
        // 3. Предупреждение об опасности
        const isDanger = options.danger === true;
        // 6. Выполненное задание
        const isQuestComplete = options.questComplete === true;
        
        // Убраны: isNew, isGift, isErrand (п.3)
        if (!isUrgent && !isDanger && !isQuestComplete) {
            changeNpcRep(registry, npcId, -3, 'разбужен ночью');
            return {
                canTalk: false,
                reason: 'night',
                message: '«Какого ляда ты меня будишь среди ночи?! Спать мешаешь! Уходи, завтра поговорим!»',
            };
        }
    }
    
    // П.5: Занятые люди не любят болтовню
    if (options.npcBusy) {
        const npcs = getNpcs(registry);
        const npc = npcs.find(n => n.id === npcId);
        const isNew = npc && !npc.met;
        // Исключения для занятых (днём): новый человек, срочное, опасность, подарок, поручение, задание
        const isUrgent = options.urgent === true;
        const isDanger = options.danger === true;
        const isGift = options.gift === true;
        const isErrand = options.errand === true;
        const isQuestComplete = options.questComplete === true;
        
        if (!isNew && !isUrgent && !isDanger && !isGift && !isErrand && !isQuestComplete) {
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
 * П.4: Штраф за попрошайничество.
 * Первые 2 раза — −1, потом по экспоненте.
 */
export function applyBeggingPenalty(registry, npcId) {
    const rep = getReputation(registry);
    if (!rep.beggingCount[npcId]) rep.beggingCount[npcId] = 0;
    rep.beggingCount[npcId]++;
    const count = rep.beggingCount[npcId];
    
    // Первые 2 раза — −1 (п.4)
    // Потом экспоненциальный рост: −2, −4, −8, −16...
    let penalty;
    if (count <= 2) {
        penalty = -1;
    } else {
        // Экспонента: при count=3 → −2, count=4 → −4, count=5 → −8...
        penalty = -Math.pow(2, count - 2);
        // Ограничиваем максимум −20 за один раз
        penalty = Math.max(-20, penalty);
    }
    
    // П.12: Высокая репутация → меньше падение
    const npcRep = rep.npcRep[npcId] || 0;
    if (npcRep >= 50) penalty = Math.round(penalty * 0.3);
    else if (npcRep >= 30) penalty = Math.round(penalty * 0.5);
    else if (npcRep >= 10) penalty = Math.round(penalty * 0.8);
    
    changeNpcRep(registry, npcId, penalty, 'попрошайничество');
    changeVillageRep(registry, Math.round(penalty * 0.5), 'попрошайничество');
    
    return penalty;
}

/**
 * П.8: Бонус за выполнение задания.
 */
export function applyQuestCompleteBonus(registry, npcId, questDifficulty) {
    // П.12: Повышение сложное — уменьшаем бонусы
    const bonus = questDifficulty === 'hard' ? 10 : (questDifficulty === 'medium' ? 7 : 4);
    changeNpcRep(registry, npcId, bonus, 'выполнено задание');
    changeVillageRep(registry, Math.round(bonus * 0.5), 'выполнено задание');
    return bonus;
}

/**
 * П.9: Бонус за выпивку всем в таверне.
 */
export function applyTreatEveryoneBonus(registry) {
    const npcs = getNpcs(registry);
    let totalBonus = 0;
    npcs.forEach(npc => {
        changeNpcRep(registry, npc.id, 2, 'угостил выпивкой');
        totalBonus += 2;
    });
    changeVillageRep(registry, 3, 'угостил всех в таверне');
    return totalBonus;
}

/**
 * П.10: Подарок NPC — шанс повышения репутации.
 * Ценность предмета = его цена × 0.5 (п.6).
 */
export function applyGiftBonus(registry, npcId, giftValue) {
    // giftValue уже пересчитан (цена × 0.5)
    const baseBonus = Math.min(10, Math.max(1, Math.floor(giftValue / 5)));
    const npcRep = getNpcRep(registry, npcId);
    // Шанс успеха: чем выше репутация — тем выше шанс
    const successChance = Math.max(20, 70 + npcRep / 3);
    const roll = 1 + Math.floor(Math.random() * 100);
    
    if (roll <= successChance) {
        changeNpcRep(registry, npcId, baseBonus, 'подарок принят');
        return { success: true, bonus: baseBonus };
    } else {
        changeNpcRep(registry, npcId, -1, 'подарок отвергнут');
        return { success: false, bonus: -1 };
    }
}

/**
 * П.11: Похвала NPC через навык Oratory.
 */
export function applyCompliment(registry, npcId, oratorySkill) {
    const res = skillCheck(oratorySkill);
    
    if (res.result === 'critical') {
        changeNpcRep(registry, npcId, 5, 'удачная похвала (крит)');
        return { success: true, bonus: 5, message: '«Ох, спасибо на добром слове!»', roll: res.roll };
    } else if (res.result === 'success') {
        changeNpcRep(registry, npcId, 2, 'удачная похвала');
        return { success: true, bonus: 2, message: '«Благодарю за доброе слово.»', roll: res.roll };
    } else if (res.result === 'fumble') {
        changeNpcRep(registry, npcId, -4, 'неудачная лесть (fumble)');
        return { success: false, bonus: -4, message: '«Не льсти мне, не люблю я это!»', roll: res.roll };
    } else {
        changeNpcRep(registry, npcId, -1, 'неудачная лесть');
        return { success: false, bonus: -1, message: '«Хватит пустые слова говорить.»', roll: res.roll };
    }
}

/**
 * П.7-10: Угроза NPC.
 * Игрок использует навык Intimidate.
 * Реакция NPC зависит от его пола, характера и репутации игрока.
 */
export function applyThreat(registry, npcId, intimidateSkill, playerGender) {
    const rep = getReputation(registry);
    if (!rep.threatenedCount[npcId]) rep.threatenedCount[npcId] = 0;
    rep.threatenedCount[npcId]++;
    
    const npcs = getNpcs(registry);
    const npc = npcs.find(n => n.id === npcId);
    if (!npc) return { success: false, message: 'NPC не найден.' };
    
    const npcGender = npc.gender;
    const npcRep = getNpcRep(registry, npcId);
    const res = skillCheck(intimidateSkill);
    
    // П.10: Модификаторы в зависимости от пола
    // Мужчина чаще нападает на мужчину, чем на женщину
    // Мужчина сильнее реагирует на угрозы от женщины
    let modifier = 0;
    let canAttack = false;
    let attackChance = 0;
    
    if (npcGender === 'male') {
        if (playerGender === 'male') {
            // Мужчина → Мужчина: высокая вероятность отпора
            modifier = -10;
            canAttack = true;
            attackChance = 30;
        } else {
            // Женщина → Мужчина: мужчина сильнее реагирует
            modifier = -15;
            canAttack = true;
            attackChance = 15; // мужчина реже нападает на женщину
        }
    } else {
        // NPC — женщина
        if (playerGender === 'male') {
            // Мужчина → Женщина: женщина скорее уступит
            modifier = 10;
            canAttack = false;
            attackChance = 0;
        } else {
            // Женщина → Женщина: женщина может напасть на женщину
            modifier = -5;
            canAttack = true;
            attackChance = 20;
        }
    }
    
    // Чем больше угрожал — тем меньше эффект (NPC привыкает или злится)
    modifier -= rep.threatenedCount[npcId] * 3;
    
    // Пересчёт с модификатором
    const effectiveSkill = Math.max(1, intimidateSkill + modifier);
    const effectiveRes = skillCheck(effectiveSkill);
    
    let result = {
        success: false,
        message: '',
        willAttack: false,
        roll: effectiveRes.roll,
        repChange: 0,
    };
    
    if (effectiveRes.result === 'critical') {
        // Критический успех — NPC полностью уступает
        result.success = true;
        result.message = `${npc.name}: «Ладно, ладно! Не надо злиться! Вот, возьми.»`;
        result.repChange = -3; // небольшое падение — NPC обижен, но уступил
        changeNpcRep(registry, npcId, -3, 'угроза (успех)');
    } else if (effectiveRes.result === 'success') {
        // Успех — NPC уступает неохотно
        result.success = true;
        result.message = `${npc.name}: «Ну... ладно. Только не злись. Возьми и уходи.»`;
        result.repChange = -5;
        changeNpcRep(registry, npcId, -5, 'угроза (успех)');
    } else if (effectiveRes.result === 'fumble') {
        // Fumble — NPC отвечает угрозой или нападает
        result.message = `${npc.name}: «Ты мне угрожаешь?! Да я тебя на куски порву!»`;
        result.repChange = -10;
        changeNpcRep(registry, npcId, -10, 'угроза (fumble)');
        // Шанс нападения при fumble
        if (canAttack) {
            const attackRoll = 1 + Math.floor(Math.random() * 100);
            if (attackRoll <= attackChance + 20) { // +20% к шансу при fumble
                result.willAttack = true;
            }
        }
    } else {
        // Провал — NPC отказывается и злится
        result.message = `${npc.name}: «Пошёл прочь со своими угрозами! Ничего не получишь!»`;
        result.repChange = -6;
        changeNpcRep(registry, npcId, -6, 'угроза (провал)');
        // Шанс нападения при провале
        if (canAttack) {
            const attackRoll = 1 + Math.floor(Math.random() * 100);
            if (attackRoll <= attackChance) {
                result.willAttack = true;
                result.message += ` ${npc.name} хватает оружие!`;
            }
        }
    }
    
    return result;
}

/**
 * П.7: Штраф за неадекватное/агрессивное поведение.
 */
export function applyAggressiveBehaviorPenalty(registry, npcId, severity) {
    const penalty = severity === 'severe' ? -12 : (severity === 'moderate' ? -6 : -3);
    changeNpcRep(registry, npcId, penalty, 'агрессивное поведение');
    changeVillageRep(registry, Math.round(penalty * 0.7), 'агрессивное поведение');
    return penalty;
}

// === ПРОВЕРКА ИЗГНАНИЯ (п.12) ===

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

// === ПРОВЕРКА ВЫИГРЫША (п.13) ===

export function checkVictory(registry) {
    const villageRep = getVillageRep(registry);
    if (villageRep >= WIN_THRESHOLD) {
        return {
            victory: true,
            message: `Староста собрал всю деревню: «Ты показал себя честным и добрым человеком. ` +
                     `Отныне ты — один из нас!» Жители радостно приветствуют тебя.`,
        };
    }
    return { victory: false };
}

// === БОНУСЫ ВЫСОКОЙ РЕПУТАЦИИ (п.13) ===

export function getPriceModifier(registry, npcId) {
    const npcRep = getNpcRep(registry, npcId);
    if (npcRep >= 50) return 0.80;
    if (npcRep >= 30) return 0.90;
    if (npcRep >= 10) return 0.95;
    if (npcRep <= -50) return 1.20;
    if (npcRep <= -30) return 1.10;
    return 1.0;
}

export function getRewardModifier(registry, npcId) {
    const npcRep = getNpcRep(registry, npcId);
    if (npcRep >= 50) return 1.25;
    if (npcRep >= 30) return 1.12;
    if (npcRep >= 10) return 1.05;
    return 1.0;
}

export function canOrderCustomWeapon(registry, npcId) {
    return getNpcRep(registry, npcId) >= 40;
}

export function canGetSpecialQuests(registry, npcId) {
    return getNpcRep(registry, npcId) >= 30;
}

export function canNpcGiftPlayer(registry, npcId) {
    return getNpcRep(registry, npcId) >= 40;
}

export function getBeggingPenaltyModifier(registry, npcId) {
    const npcRep = getNpcRep(registry, npcId);
    if (npcRep >= 50) return 0.3;
    if (npcRep >= 30) return 0.5;
    if (npcRep >= 10) return 0.8;
    return 1.0;
}

export function willNpcAttack(registry, npcId) {
    return getNpcRep(registry, npcId) <= ATTACK_THRESHOLD;
}

export function willNpcRefuseTrade(registry, npcId) {
    return getNpcRep(registry, npcId) <= REFUSE_TRADE_THRESHOLD;
}

export function willNpcRefuseTalk(registry, npcId) {
    return getNpcRep(registry, npcId) <= REFUSE_TALK_THRESHOLD;
}

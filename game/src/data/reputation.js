// Система репутации для «Летописи Руси».
//
// Раунд 15: названия уровней репутации локализованы (i18n).
import { t } from '../systems/i18n.js';
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
//   -80..-99   — враг (NPC имеет ШАНС напасть; мирится только за виру)
//   -100       — КРОВНАЯ ВРАЖДА: изгнание из деревни (раунд 45, п.2 заявки:
//                Проигрыш по репутации — ТОЛЬКО на самом дне, −100)
//
// Балансировка (п.12): повышение репутации — сложное и медленное,
// понижение — быстрое и лёгкое.

import { ActionLog } from './actionLog.js';
// Раунд 46 (п.1): ученик кузнеца встаёт к горну после гибели кузнеца
import { getNpcs, findNpc, spawnBlacksmithApprentice, BLACKSMITH_APPRENTICE_ID } from './npcNames.js';
import { getTimeOfDay, getTime } from '../systems/TimeSystem.js';
import { skillCheck } from '../systems/BRPEngine.js';

const VILLAGE_REP_MIN = -100;
const VILLAGE_REP_MAX = 100;
const NPC_REP_MIN = -100;
const NPC_REP_MAX = 100;

const WIN_THRESHOLD = 100;          // +100 = выигрыш (п.13)
const MARRIAGE_NPC_REP = 90;        // +90 личная репутация у NPC для брака (п.1)
const MARRIAGE_VILLAGE_REP = 50;    // +50 деревенская репутация для брака (п.1)
const MARRIAGE_COST = 200;          // 200 денег на свадебное торжество (п.1)
// Раунд 43 (п.13 заявки): венчаются только совершеннолетние.
// У НПЦ возраст известен всегда; у игрока поле age отсутствует
// (все играбельные персонажи — взрослые), но проверка оставлена
// на случай будущих юных пресетов.
const AGE_OF_MAJORITY = 18;
// Раунд 45 (п.2 заявки): изгнание с Проигрышем — ТОЛЬКО при репутации −100.
// Раньше порог был −80: игрока выгоняли, хотя у НПЦ-врагов ещё был шанс
// не напасть. Теперь весь диапазон −80..−99 — «вражда» (шанс нападения,
// примирение за виру у старосты), а сходка старосты изгоняет лишь на дне.
const EXPULSION_THRESHOLD = -100;   // изгнание — ровно на дне (п.2 раунда 45)
const ATTACK_THRESHOLD = -80;       // ниже этого — ШАНС нападения (п.2)

// Раунд 45 (п.3 заявки): последствия УБИЙСТВА НПЦ игроком.
// Деревня и все жители −50 (прямая запись, без множителей), а родня
// убитого (супруга/дети в том же доме) проклинает героя — репутация
// падает ДО −100.
const MURDER_VILLAGE_PENALTY = 50;
const MURDER_NPC_PENALTY = 50;
const KIN_REP_SET = -100;           // родне — ровно до дна
const REFUSE_TRADE_THRESHOLD = -50; // ниже этого — отказ торговать (п.1)
const REFUSE_TALK_THRESHOLD = -30;  // ниже этого — отказ говорить (п.1)

// Раунд 46 (п.7 заявки): грустные эпитафии для могил на погосте —
// каждый убитый житель получает свою надпись (случайную на момент гибели).
const GRAVE_EPITAPHS = [
    'Спи, добрая душа. Земля тебе пухом, а небо — тихим светом.',
    'Погас огонёк в окне, но не погасла память о тебе.',
    'Помяни, Господи, душу усопшего во Царствии Своём.',
    'Не гремит более его молот — тишина легла на двор его.',
    'Трава над тобой взойдёт, и колокол отпоет твою душу.',
    'Светлая душа покинула село — и село осиротело.',
    'Не кручинься, путник: всяк приидет в час свой.',
];

// === ИНИЦИАЛИЗАЦИЯ ===

export function initReputation(registry) {
    const rep = {
        villageRep: 0,
        npcRep: {},
        beggingCount: {},
        threatenedCount: {}, // сколько раз угрожал каждому NPC
        // Раунд 45 (п.4): перемирье после побега из боя — абсолютные минуты,
        // до которых НПЦ НЕ нападает повторно (сразу после побега).
        npcTruceUntil: {},
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
    const rep = registry.get('reputation');
    if (rep) {
        // Старые сохранения без npcTruceUntil — досоздаём defensively
        if (!rep.npcTruceUntil) rep.npcTruceUntil = {};
        return rep;
    }
    return initReputation(registry);
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
    if (rep >= 100) return { level: 'kin', name: t('свой человек'), color: '#40ff40' };
    if (rep >= 50) return { level: 'friend', name: t('друг деревни'), color: '#60ff60' };
    if (rep >= 10) return { level: 'respected', name: t('уважаемый'), color: '#a0e060' };
    if (rep >= 0) return { level: 'neutral', name: t('нейтральный'), color: '#c0c0c0' };
    if (rep >= -29) return { level: 'disliked', name: t('нелюбимый'), color: '#ffa040' };
    if (rep >= -49) return { level: 'unwanted', name: t('нежеланный'), color: '#ff8040' };
    if (rep >= -79) return { level: 'shunned', name: t('отверженный'), color: '#ff6040' };
    return { level: 'enemy', name: t('враг'), color: '#ff2020' };
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

// Раунд 39 (п.11 заявки): NPC, которые НИКОГДА не отказываются от разговора
// и не ругаются на ночной разговор (всегда на ногах по роду службы).
// Тавернщик Фёдор живёт на постоялом дворе и всегда рад гостю.
const ALWAYS_AWAKE_NPCS = new Set(['tavernkeeper']);

/**
 * Проверить, хочет ли NPC говорить с игроком.
 * Учитывает: время суток, занятость, репутацию, исключения.
 */
export function checkNpcWillingToTalk(registry, npcId, options = {}) {
    const npcRep = getNpcRep(registry, npcId);
    const timeState = registry.get('gameTime');
    const hour = timeState ? timeState.hour : 12;
    const tod = getTimeOfDay(hour);
    
    // Раунд 46 (п.3 заявки): СТАРОСТА ВСЕГДА РАЗГОВАРИВАЕТ с игроком —
    // не зависимо от его личной репутации к герою (должностное лицо:
    // судит, мирит за виру, принимает икону). Он и в ярости не нападает —
    // долг выше гнева. Остальные пороги (ночь/занятость) его тоже не трогают.
    if (npcId === 'elder') {
        return { canTalk: true };
    }

    // П.2: При крайней вражде (−80..−100) — лишь ШАНС нападения
    if (npcRep <= ATTACK_THRESHOLD) {
        // Раунд 45 (п.4 заявки): перемирье после побега игрока из боя —
        // НПЦ НЕ нападает повторно сразу, пока перемирье не истекло.
        if (isNpcTruceActive(registry, npcId)) {
            return {
                canTalk: false,
                reason: 'enemy',
                willAttack: false,
                message: '«Уходи! Я тебя ненавижу... но староста велел крови сегодня не проливать.»',
            };
        }
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
        // Раунд 39 (п.11 заявки): тавернщик — ХОЗЯИН ПОСТОЯЛОГО ДВОРА.
        // Он всегда на ногах, всегда готов поговорить (круглосуточно) и
        // НИКОГДА не ругается на ночной разговор — это его работа.
        const alwaysAwake = ALWAYS_AWAKE_NPCS.has(npcId);
        // Оставшиеся исключения:
        // 2. Срочные/важные дела, опасность
        const isUrgent = options.urgent === true;
        // 3. Предупреждение об опасности
        const isDanger = options.danger === true;
        // 6. Выполненное задание
        const isQuestComplete = options.questComplete === true;

        if (!alwaysAwake && !isUrgent && !isDanger && !isQuestComplete) {
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
 * Раунд 43: Штраф за ПРОСРОЧЕННОЕ поручение — ровно −3/−8/−15 (как обещает
 * журнал заданий). Применяется НАПРЯМУЮ, без балансировочного множителя ×1.2,
 * иначе фактический штраф (−4/−10/−18) расходился бы с обещанным.
 */
export function applyQuestFailurePenalty(registry, npcId, questDifficulty) {
    const penalty = questDifficulty === 'hard' ? -15 : (questDifficulty === 'medium' ? -8 : -3);
    const rep = getReputation(registry);
    if (!rep.npcRep[npcId]) rep.npcRep[npcId] = 0;
    rep.npcRep[npcId] = clamp(rep.npcRep[npcId] + penalty, NPC_REP_MIN, NPC_REP_MAX);
    registry.set('reputation', rep);
    return penalty;
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
    // Раунд 35 (QA-фикс P2): бросок «res» здесь был мёртвым — ниже бросается
    // effectiveRes с учётом модификаторов (страдал двойной расход RNG,
    // но на результат он не влиял). Убран.

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

// ============================================================
// РАУНД 45: перемирье, убийство НПЦ, вира по Судебнику,
// сословные рамки на воинское снаряжение.
// ============================================================

// П.4 заявки: после побега игрока из боя НПЦ не нападает повторно сразу.
// Перемирье держится 12 игровых часов.
const NPC_TRUCE_HOURS = 12;

function absoluteMinutes(registry) {
    const ts = getTime(registry);
    if (!ts) return 0;
    return ts.day * 1440 + ts.hour * 60 + (ts.minute || 0);
}

/**
 * П.4: выставить НПЦ перемирье — он НЕ нападает на игрока
 * в течение указанных часов (после успешного побега из боя).
 */
export function setNpcTruce(registry, npcId, hours = NPC_TRUCE_HOURS) {
    const rep = getReputation(registry);
    rep.npcTruceUntil[npcId] = absoluteMinutes(registry) + hours * 60;
    registry.set('reputation', rep);
    return rep.npcTruceUntil[npcId];
}

export function isNpcTruceActive(registry, npcId) {
    const rep = getReputation(registry);
    const until = rep.npcTruceUntil && rep.npcTruceUntil[npcId];
    return typeof until === 'number' && until > absoluteMinutes(registry);
}

/**
 * Раунд 45: убит ли НПЦ героем (флаг ставится в applyNpcMurderConsequences).
 */
export function isNpcKilled(registry, npcId) {
    const q = registry.get('quest') || {};
    return !!(q.npcKilled && q.npcKilled[npcId]);
}

/**
 * П.3 заявки: последствия УБИЙСТВА НПЦ героем.
 *   • репутация в деревне −50 (прямая запись, честно как сказано);
 *   • репутация у ВСЕХ НПЦ −50 (прямая запись);
 *   • у родни убитого (супруга и дети из того же дома) — репутация
 *     к игроку падает ДО −100 (кровная вражда);
 *   • сам убитый помечается q.npcKilled (больше не разговаривает,
 *     с улицы деревни и из домов его убирает сцена).
 */
export function applyNpcMurderConsequences(registry, victimNpcId) {
    const rep = getReputation(registry);
    const npcs = getNpcs(registry);
    const victim = npcs.find(n => n.id === victimNpcId);
    const victimName = victim ? (victim.name || victimNpcId) : victimNpcId;
    // Раунд 46 (п.2 заявки): убийство СТАРОСТЫ — особый случай
    const isElder = (victimNpcId === 'elder');
    const player = registry.get('player');

    // 1) Все живые НПЦ −50 (прямая запись — без балансировочных множителей)
    npcs.forEach(n => {
        if (n.id === victimNpcId) return;
        rep.npcRep[n.id] = clamp((rep.npcRep[n.id] || 0) - MURDER_NPC_PENALTY, NPC_REP_MIN, NPC_REP_MAX);
    });

    // 2) Деревня −50 (прямая запись).
    //    Раунд 46 (п.2): за убийство старосты репутация падает сразу ДО −100 —
    //    игра немедленно заканчивается Проигрышем (см. CombatScene/EndScene).
    rep.villageRep = isElder
        ? VILLAGE_REP_MIN
        : clamp(rep.villageRep - MURDER_VILLAGE_PENALTY, VILLAGE_REP_MIN, VILLAGE_REP_MAX);

    // 3) Родня убитого — до дна (−100). Родня = все, кто живёт с убитым
    //    в одном доме (супруга married:true и дети professionId:'child');
    //    если убит ребёнок — до дна падают его родители.
    const kinNames = [];
    if (victim && victim.interiorId) {
        npcs.forEach(n => {
            if (n.id === victimNpcId) return;
            if (n.interiorId === victim.interiorId) {
                rep.npcRep[n.id] = KIN_REP_SET;
                kinNames.push(n.name || n.id);
            }
        });
    }
    // Сам убитый — тоже до дна (ему уже не важно, но пусть система честна)
    rep.npcRep[victimNpcId] = NPC_REP_MIN;
    registry.set('reputation', rep);

    // 3б) Раунд 46 (п.5 заявки): если у убитого была супруга/супруг —
    //      второй получает статус ВДОВЦА/ВДОВЫ (и может потом вступить
    //      в новый брак — п.6, canMarry пропускает не замужних).
    let widowedName = null;
    if (victim && victim.interiorId && (victim.married || victim.spousePlayerName)) {
        const spouse = npcs.find(n => n.id !== victimNpcId
            && n.interiorId === victim.interiorId
            && n.married
            && (n.age || 0) >= AGE_OF_MAJORITY
            && (!n.profession || n.profession.id !== 'child'));
        if (spouse) {
            spouse.married = false;
            spouse.widowed = true;
            spouse.widowedOf = victimName;
            widowedName = spouse.name || spouse.id;
        }
    }
    // Если убитый был супругом самого ИГРОКА — игрок овдовел
    let playerWidowed = false;
    if (player && player.married && player.spouseNpcId === victimNpcId) {
        player.married = false;
        player.widowed = true;
        registry.set('player', player);
        playerWidowed = true;
    }
    if (widowedName) registry.set('npcs', npcs);

    // 4) Флаг смерти + данные могилы (сцены убирают убитого с улицы и из домов).
    //    Раунд 46 (п.7): на погосте появляется МОГИЛА убитого — с поп-апом:
    //    кто убил, по какой причине и грустная эпитафия.
    const q = registry.get('quest') || {};
    if (!q.npcKilled) q.npcKilled = {};
    const ts = getTime(registry);
    q.npcKilled[victimNpcId] = {
        by: (player && player.name) || 'Герой',
        reason: 'npc_attacked', // житель сам напал на героя и пал в честной схватке
        day: ts ? ts.day : 1,
        hour: ts ? ts.hour : 12,
        epitaph: GRAVE_EPITAPHS[Math.floor(Math.random() * GRAVE_EPITAPHS.length)],
    };
    // Раунд 46 (п.2): флаг немедленного Проигрыша за убийство старосты
    if (isElder) q.elderMurdered = true;
    registry.set('quest', q);

    // 5) Раунд 46 (п.1 заявки): на место убитого КУЗНЕЦА встаёт УЧЕНИК —
    //    делает всё то же самое (кузница, торговля, наводки), но моложе и слабее.
    let apprenticeName = null;
    if (victimNpcId === 'blacksmith') {
        const app = spawnBlacksmithApprentice(registry);
        if (app) apprenticeName = app.name;
    }

    ActionLog.add(registry, `☠ Кровная вина: герой убил ${victimName}. Деревня и все жители −${MURDER_VILLAGE_PENALTY} репутации.`);
    if (kinNames.length > 0) {
        ActionLog.add(registry, `Родня убитого (${kinNames.join(', ')}) проклинает героя: их репутация до −100.`);
    }
    if (widowedName) {
        ActionLog.add(registry, `${widowedName} оплакивает ${victimName}: теперь он(а) ${victim && victim.gender === 'female' ? 'вдовец' : 'вдова'}.`);
    }
    if (playerWidowed) {
        ActionLog.add(registry, `Ты овдовел(а): твой(я) супруг(а) ${victimName} мёртв(а).`);
    }
    if (apprenticeName) {
        ActionLog.add(registry, `К горну встал ${apprenticeName}, ученик кузнеца: моложе мастера, но работа кузницы не встанет.`);
    }
    if (isElder) {
        ActionLog.add(registry, 'ПОРАЖЕНИЕ: староста мёртв от твоей руки. Деревня проклинает убийцу — репутация до −100. Проигрыш.');
    }

    return {
        affected: npcs.length - 1, kinNames, victimName, villageRep: rep.villageRep,
        widowedName, playerWidowed, apprenticeName,
        elderMurdered: isElder,
        graveInfo: q.npcKilled[victimNpcId],
    };
}

/**
 * Раунд 46 (п.1 заявки): кто сейчас трудится в кузнице.
 *   'blacksmith'  — живой кузнец;
 *   'apprentice'  — ученик (кузнец убит, ученик встал к горну);
 *   null          — кузница пуста и мертва (убиты оба).
 */
export function getSmithNpcId(registry) {
    if (!isNpcKilled(registry, 'blacksmith')) return 'blacksmith';
    const app = findNpc(registry, BLACKSMITH_APPRENTICE_ID);
    return (app && !isNpcKilled(registry, 'apprentice')) ? 'apprentice' : null;
}

/**
 * П.5 заявки (раунд 45) + п.4 (раунд 46): полный список тех, с кем староста
 * может примирить игрока за виру.
 *   • все НПЦ в ярости (репутация ≤ −80), кроме убитых;
 *   • Раунд 46 (п.4): СО СТАРОСТОЙ ВСЕГДА можно помириться — он берёт виру
 *     и за собственную обиду, даже если ярости ещё нет (репутация < +30).
 */
export function getViraCandidates(registry) {
    const list = getHostileNpcs(registry);
    const elderRep = getNpcRep(registry, 'elder');
    if (!isNpcKilled(registry, 'elder') && elderRep < 30 && !list.some(h => h.id === 'elder')) {
        list.unshift({
            id: 'elder',
            name: t('сам староста'),
            gender: 'male',
            age: null,
            rep: elderRep,
            vira: calculateVira(registry, 'elder').total,
            isElder: true,
        });
    }
    return list;
}

/**
 * П.5 заявки: список НПЦ, враждебных игроку (репутация ≤ −80),
 * с расчётом виры по каждому. Убитые примирению не подлежат.
 */
export function getHostileNpcs(registry) {
    const rep = getReputation(registry);
    return getNpcs(registry)
        .filter(n => (rep.npcRep[n.id] || 0) <= ATTACK_THRESHOLD && !isNpcKilled(registry, n.id))
        .map(n => ({
            id: n.id,
            name: n.name || n.id,
            gender: n.gender,
            age: n.age,
            rep: rep.npcRep[n.id] || 0,
            vira: calculateVira(registry, n.id).total,
        }));
}

/**
 * П.5 заявки: РАСЧЁТ ВИРЫ ПО СУДЕБНИКУ (Русская Правда + Судебник 1497).
 *
 *   • Вира за «обиду кровью» свободному мужу — 40 гривен;
 *     за свободную женщину или отрока (до 18) — полувирье, 20 гривен
 *     (Пространная редакция Русской Правды, ст. ст. 1, 25).
 *   • Продажа — судебный штраф старосте-судье за самовольную ссору —
 *     10 гривен (Судебник 1497, ст. о «продаже» за обиду).
 *   • «Судебная гривна» деревни — 2 деньги: вира = 80 д. (муж.) / 40 д. (жен./отрок).
 *   • Разбой «без всякие свады» (репутация −100, крайняя вражда) —
 *     двойная вира, как за разбойное дело (ст. о разбое).
 *
 * Итог: муж 100 д. (или 200 д. при −100), женщина/отрок 60 д. (или 120 д.).
 */
export function calculateVira(registry, npcId) {
    const rep = getReputation(registry);
    const npc = getNpcs(registry).find(n => n.id === npcId);
    const npcRep = (rep.npcRep[npcId] || 0);
    // Полувирье — за женщину ИЛИ за отрока/отроковицу (до 18 лет)
    const halfWergild = !!npc && (npc.gender === 'female' || (npc.age != null && npc.age < 18));
    const wergild = halfWergild ? 40 : 80; // вира / полувирье (в судебных гривнах × 2 д.)
    const sale = 20;                    // «продажа» старосте за суд
    const doubleWergild = npcRep <= -100; // разбой без всякой свады
    const total = (wergild + sale) * (doubleWergild ? 2 : 1);
    return {
        wergild, sale, doubleWergild, total,
        breakdown: doubleWergild
            ? `вира ${wergild} д. + продажа ${sale} д., за разбой без свады — вдвое`
            : `вира ${wergild} д. + продажа ${sale} д.`,
    };
}

/**
 * П.5+6 заявки: примирение у старосты за виру.
 * Деньги уходят старосте, репутация разозлённого НПЦ к игроку
 * УЛУЧШАЕТСЯ ДО +30 пунктов (прямая запись), перемирье снимается.
 */
export function payViraToElder(registry, npcId) {
    const player = registry.get('player');
    const npc = getNpcs(registry).find(n => n.id === npcId);
    const npcName = npc ? (npc.name || npcId) : npcId;
    if (isNpcKilled(registry, npcId)) {
        return { success: false, message: `Староста крестится: «${npcName} — мёртв(а). Судебник мёртвых не судит. Кровная вина на тебе до конца дней.»` };
    }
    const vira = calculateVira(registry, npcId);
    if (!player) return { success: false, message: 'Ошибка: игрок не найден.' };
    if ((player.dengas || 0) < vira.total) {
        return {
            success: false,
            message: `Староста листает Судебник: «Вира за твою обиду — ${vira.total} д. (${vira.breakdown}). А в мошне у тебя лишь ${player.dengas || 0} д. Не будет мира — будет суд.»`,
            vira,
        };
    }
    player.dengas -= vira.total;
    registry.set('player', player);

    const rep = getReputation(registry);
    // П.6: репутация УЛУЧШАЕТСЯ ДО 30 пунктов (прямая запись, ровно +30)
    rep.npcRep[npcId] = 30;
    rep.npcTruceUntil[npcId] = 0; // перемирье больше не нужно — вражда снята
    registry.set('reputation', rep);
    ActionLog.add(registry, `🤝 Примирение у старосты: выплачена вира ${vira.total} д. за ${npcName} (${vira.breakdown}). Репутация ${npcName} теперь +30.`);

    return {
        success: true,
        vira,
        message: `Староста принимает виру — ${vira.total} д. (${vira.breakdown}) — и жмёт руку ${npcName}: «Обида смыта серебром, по Судебнику быть миру!»\n\nРепутация ${npcName} к тебе теперь +30.`,
    };
}

// === СОСЛОВНЫЕ РАМКИ НА СНАРЯЖЕНИЕ (п.7э заявки, раунд 45) ===
// По уложениям Судебника о вооружении вольных людей:
//   • «посошное» снаряжение (охотничье и самооборонное) — вольно всякому
//     совершеннолетнему свободному человеку;
//   • «воинское» снаряжение (сабля, стальной меч, кольчуга, зерцальный
//     доспех) — кузнец продаёт ТОЛЬКО совершеннолетним (18+) с доброй
//     славой: деревенская репутация не ниже 0. Молодняку и людям дурной
//     славы воинская снаряга не продаётся.
export const MILITARY_GEAR_IDS = new Set(['sabre', 'steel_sword', 'chain', 'plate']);

export function canBuyMilitaryGear(registry, player) {
    const age = player && player.age;
    const adult = (age == null) || age >= AGE_OF_MAJORITY;
    const trusted = getVillageRep(registry) >= 0;
    if (!adult) {
        return { ok: false, reason: `По уложению Судебника воинское снаряжение не продаётся несовершеннолетним (с ${AGE_OF_MAJORITY} лет)` };
    }
    if (!trusted) {
        return { ok: false, reason: 'По уложению Судебника воинское снаряжение не продаётся людям дурной славы (репутация деревни ниже 0)' };
    }
    return { ok: true };
}

// === ПРОВЕРКА ВЫИГРЫША (п.13) ===
// Раунд 36: репутационная победа — ОТДЕЛЬНАЯ ветка финала (не «вор повержен»!)
// и доступна ТОЛЬКО после прохождения «обучалки» (вор пойман, икона возвращена
// → mainQuestDone) и ТОЛЬКО если игрок выбрал «🏆 Продолжить игру» в диалоге
// старосты/батюшки (флаг q.repVictoryArmed ставит узел victory_continue).
// Раньше rep ≥ +100 молча ставил q.thiefDefeated — погоня умирала, а итоги
// показывали «ВОР ПОВЕРЖЕН» даже без иконы.

export function checkVictory(registry) {
    const villageRep = getVillageRep(registry);
    if (villageRep >= WIN_THRESHOLD) {
        const q = registry.get('quest') || {};
        if (!q.repVictoryArmed) {
            // Порог взят, но «обучалка» не пройдена / игрок не выбрал
            // продолжение — победа ещё не засчитывается (одноразовая
            // подсказка выдаётся в VillageScene.update).
            return { victory: false, thresholdReached: true };
        }
        return {
            victory: true,
            reputation: true,
            message: t('Староста собрал всю деревню: «Ты добрыми делами снискал нашу любовь. Отныне ты — не гость, а свой!» Жители чествуют тебя хлебом-солью.'),
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

// === СИСТЕМА БРАКА (п.1) ===

/**
 * Проверить, может ли игрок вступить в брак с NPC.
 * Условия (п.1):
 * - Личная репутация у NPC ≥ +90
 * - Деревенская репутация ≥ +50
 * - NPC противоположного пола
 * - У игрока достаточно денег (200 д. на свадебное торжество)
 * - NPC не состоит в браке
 */
export function canMarry(registry, npcId, player) {
    const npcRep = getNpcRep(registry, npcId);
    const villageRep = getVillageRep(registry);
    const npcs = getNpcs(registry);
    const npc = npcs.find(n => n.id === npcId);
    
    if (!npc || !player) return { canMarry: false, reason: 'NPC не найден' };
    
    // Проверка пола
    if (npc.gender === player.gender) {
        return { canMarry: false, reason: 'Традиции не позволяют брак с человеком того же пола' };
    }

    // Раунд 43 (п.13 заявки): НПЦ должен быть совершеннолетним.
    // Дети (kid1–kid9, 5–12 лет) и подросток Ивашка (14) браку не подлежат.
    if ((npc.age || 0) < AGE_OF_MAJORITY) {
        return { canMarry: false, reason: `${npc.name} ещё несовершеннолетний(няя) — венчают только с ${AGE_OF_MAJORITY} лет` };
    }

    // Раунд 43 (п.13): игрок тоже должен быть совершеннолетним
    // (сейчас age у игрока нет = взрослый; проверка на будущее).
    if (player.age != null && player.age < AGE_OF_MAJORITY) {
        return { canMarry: false, reason: `Ты ещё несовершеннолетний(яя) — венчают только с ${AGE_OF_MAJORITY} лет` };
    }

    // Проверка личной репутации
    if (npcRep < MARRIAGE_NPC_REP) {
        return { canMarry: false, reason: `Недостаточно личной репутации (нужно +${MARRIAGE_NPC_REP}, у вас ${npcRep})` };
    }
    
    // Проверка деревенской репутации
    if (villageRep < MARRIAGE_VILLAGE_REP) {
        return { canMarry: false, reason: `Недостаточно деревенской репутации (нужно +${MARRIAGE_VILLAGE_REP}, у вас ${villageRep})` };
    }
    
    // Проверка денег
    if ((player.dengas || 0) < MARRIAGE_COST) {
        return { canMarry: false, reason: `Недостаточно денег на свадебное торжество (нужно ${MARRIAGE_COST} д., у вас ${player.dengas || 0} д.)` };
    }
    
    // Проверка, не состоит ли NPC в браке.
    // Раунд 46 (пп.5,6 заявки): ВДОВА/ВДОВЕЦ может вступить в новый брак —
    // после гибели супруга canMarry выставляет married=false + widowed=true,
    // поэтому проверка проходит честно. isNpcKilled добавлен для ясности:
    // мёртвого не венчают.
    if (npc.married) {
        return { canMarry: false, reason: `${npc.name} уже состоит в браке` };
    }
    if (isNpcKilled(registry, npcId)) {
        return { canMarry: false, reason: `${npc.name} покинул(а) мир живых — над ним(ей) уже отпели` };
    }
    
    return { canMarry: true };
}

/**
 * Выполнить брак.
 * Снимает деньги, отмечает NPC и игрока как состоящих в браке.
 * Повышает деревенскую репутацию.
 * Возвращает true при успехе — это означает ВЫИГРЫШ.
 */
export function marry(registry, npcId, player) {
    const check = canMarry(registry, npcId, player);
    if (!check.canMarry) return { success: false, reason: check.reason };
    
    const npcs = getNpcs(registry);
    const npc = npcs.find(n => n.id === npcId);
    
    // Снимаем деньги за свадебное торжество
    player.dengas = (player.dengas || 0) - MARRIAGE_COST;
    player.married = true;
    player.spouseNpcId = npcId;
    registry.set('player', player);
    
    // Отмечаем NPC как состоящего в браке
    npc.married = true;
    npc.spousePlayerName = player.name;
    registry.set('npcs', npcs);
    
    // Свадьба повышает деревенскую репутацию
    changeVillageRep(registry, 20, 'свадьба с жителем деревни');
    changeNpcRep(registry, npcId, 10, 'брак');
    
    // Раунд 44: гендерно-согласованная формулировка летописи свадьбы
    const marriedVerb = player.gender === 'female' ? 'вышла замуж за' : 'женился на';
    ActionLog.add(registry, 
        `СВАДЬБА: ${player.name} ${marriedVerb} ${npc.name} (${npc.profession.name}). ` +
        `Свадебное торжество обошлось в ${MARRIAGE_COST} д. ` +
        `Деревенская репутация выросла.`
    );
    
    return { success: true, npcName: npc.name };
}

/**
 * Получить стоимость свадебного торжества.
 */
export function getMarriageCost() {
    return MARRIAGE_COST;
}

/**
 * Получить минимальную личную репутацию для брака.
 */
export function getMarriageNpcRepThreshold() {
    return MARRIAGE_NPC_REP;
}

/**
 * Получить минимальную деревенскую репутацию для брака.
 */
export function getMarriageVillageRepThreshold() {
    return MARRIAGE_VILLAGE_REP;
}

/**
 * Раунд 43 (п.13): возраст совершеннолетия для брака.
 */
export function getAgeOfMajority() {
    return AGE_OF_MAJORITY;
}

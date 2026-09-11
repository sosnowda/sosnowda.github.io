// Система охоты за вором.
// Состояние: вор случайно выбирает локацию (лес/тракт/река/поле),
// игрок ищет следы через BRP-проверки или расспрашивает жителей.
// Лимит «времени» — 12 ходов (поисков/бесед). После 12 — вор сбегает.

import { skillCheck } from '../systems/BRPEngine.js';
import { ActionLog } from './actionLog.js';
import { applyBeggingPenalty } from './reputation.js';

// Локации, куда может бежать вор
export const THIEF_LOCATIONS = [
    { id: 'forest', name: 'Лес', icon: '🌲', description: 'густую чащу за рекой' },
    { id: 'road', name: 'Тракт', icon: '🛤', description: 'торный тракт на юг' },
    { id: 'river', name: 'Река', icon: '🌊', description: 'брод вниз по течению' },
    { id: 'field', name: 'Поле', icon: '🌾', description: 'рожковое поле на восток' },
];

// Лимит ходов до побега вора
export const TURN_LIMIT = 12;

/**
 * Инициализировать состояние охоты за вором.
 * Вызывается при начале новой игры.
 */
export function initThiefHunt(registry) {
    const quest = registry.get('quest') || {};
    // Случайная локация вора
    const thiefLoc = THIEF_LOCATIONS[Math.floor(Math.random() * THIEF_LOCATIONS.length)];
    quest.thiefLocationId = thiefLoc.id;
    quest.thiefLocationName = thiefLoc.name;
    quest.thiefFound = false;
    quest.thiefEscaped = false;
    quest.thiefDefeated = false;
    quest.turnsUsed = 0;
    quest.turnLimit = TURN_LIMIT;
    quest.cluesGathered = []; // подсказки, собранные у жителей
    quest.locationsSearched = []; // локации, где уже искали
    quest.currentObjective = 'Вор украл икону! Найди его следы или расспроси жителей';
    registry.set('quest', quest);

    ActionLog.init(registry);
    ActionLog.add(registry, `Игра началась. Вор украл чудотворную икону и бежал в неизвестном направлении.`);

    return quest;
}

/**
 * Получить текущее состояние охоты.
 */
export function getHuntState(registry) {
    const q = registry.get('quest') || {};
    return {
        thiefLocationId: q.thiefLocationId,
        thiefLocationName: q.thiefLocationName,
        thiefFound: !!q.thiefFound,
        thiefEscaped: !!q.thiefEscaped,
        thiefDefeated: !!q.thiefDefeated,
        turnsUsed: q.turnsUsed || 0,
        turnLimit: q.turnLimit || TURN_LIMIT,
        turnsLeft: (q.turnLimit || TURN_LIMIT) - (q.turnsUsed || 0),
        cluesGathered: q.cluesGathered || [],
        locationsSearched: q.locationsSearched || [],
    };
}

/**
 * Увеличить счётчик ходов. Если достигнут лимит — вор сбегает.
 */
export function spendTurn(registry, action) {
    const q = registry.get('quest');
    q.turnsUsed = (q.turnsUsed || 0) + 1;
    const left = (q.turnLimit || TURN_LIMIT) - q.turnsUsed;
    ActionLog.add(registry, action + ` (ходов осталось: ${left})`);
    registry.set('quest', q);
    return left;
}

/**
 * Попытка найти следы вора в локации через проверку "Внимательность".
 * Возвращает { found, result, message, turnsLeft }.
 */
export function searchLocation(registry, locationId) {
    const q = registry.get('quest');
    const player = registry.get('player');

    // Если уже искали здесь — вернуть "уже обыскано"
    if (q.locationsSearched && q.locationsSearched.includes(locationId)) {
        return {
            found: false,
            alreadySearched: true,
            message: 'Ты уже обыскивал эту местность. Новых следов не найти.',
            turnsLeft: getHuntState(registry).turnsLeft,
        };
    }

    // Тратим ход
    const loc = THIEF_LOCATIONS.find(l => l.id === locationId);
    const locName = loc ? loc.name : locationId;
    const turnsLeft = spendTurn(registry, `Поиск следов в локации «${locName}»`);

    // Отмечаем, что обыскали
    if (!q.locationsSearched) q.locationsSearched = [];
    q.locationsSearched.push(locationId);

    // Проверка навыка spot
    const spotSkill = player.skills.spot || 25;
    const res = skillCheck(spotSkill);
    const isThiefHere = q.thiefLocationId === locationId;

    let found = false;
    let message = '';

    if (res.result === 'critical' || res.result === 'success') {
        if (isThiefHere) {
            // Следы найдены в правильной локации
            found = true;
            q.thiefFound = true;
            q.currentObjective = `Ты нашёл следы вора в локации «${loc.name}»! Пора догнать его!`;
            message = `Удача! Ты обнаружил свежие следы, ведущие в ${loc.description}. Вор здесь!`;
            ActionLog.add(registry, `НАЙДЕН: следы вора в локации «${loc.name}» (бросок ${res.roll}, успех).`);
        } else {
            message = `Ты тщательно обыскал местность, но следов вора здесь нет. Видимо, он пошёл в другую сторону.`;
            ActionLog.add(registry, `Поиск в «${loc.name}» — следов нет (бросок ${res.roll}, успех, но не та локация).`);
        }
    } else {
        // Провал — не нашли следов (даже если они есть)
        if (isThiefHere) {
            message = `Ты долго бродил по местности, но следы ускользнули от твоего взгляда. Возможно, стоит попробовать снова или спросить у жителей.`;
            ActionLog.add(registry, `Поиск в «${loc.name}» — провал (бросок ${res.roll}, следы были, но не замечены).`);
        } else {
            message = `Ты осмотрел местность, но никаких следов вора не нашёл.`;
            ActionLog.add(registry, `Поиск в «${loc.name}» — провал (бросок ${res.roll}, следов нет).`);
        }
    }

    registry.set('quest', q);

    // Проверка на побег вора
    if (turnsLeft <= 0 && !q.thiefFound) {
        q.thiefEscaped = true;
        q.currentObjective = 'Вор успел скрыться! Игра проиграна.';
        registry.set('quest', q);
        ActionLog.add(registry, 'ПОРАЖЕНИЕ: вор успел сбежать, пока ты искал следы.');
        return {
            found, result: res, message, turnsLeft: 0,
            thiefEscaped: true,
        };
    }

    return {
        found, result: res, message, turnsLeft,
        thiefEscaped: false,
    };
}

/**
 * Расспросить жителя о воре.
 * Возвращает { gotClue, message, turnsLeft }.
 * Житель может дать подсказку, если проходит проверку Красноречия (oratory).
 */
export function askNPC(registry, npcId, npcName) {
    const q = registry.get('quest');
    const player = registry.get('player');

    // Тратим ход
    const turnsLeft = spendTurn(registry, `Расспрос ${npcName} о воре`);

    // Проверка навыка oratory
    const oratorySkill = player.skills.oratory || 15;
    const res = skillCheck(oratorySkill);

    let gotClue = false;
    let message = '';

    if (res.result === 'critical' || res.result === 'success') {
        // Успех — даём подсказку (исключаем одну локацию)
        gotClue = true;
        // Если вор в лесу — житель скажет, что видел воришку бегущим НЕ к реке (например)
        const wrongLocations = THIEF_LOCATIONS.filter(l => l.id !== q.thiefLocationId);
        // Выбираем случайную "неверную" локацию и говорим, что вор туда НЕ пошёл
        const eliminated = wrongLocations[Math.floor(Math.random() * wrongLocations.length)];
        if (!q.cluesGathered) q.cluesGathered = [];
        const clue = `Видел, как воришка бежал. Точно не в сторону «${eliminated.name}» — там бы его заметили.`;
        q.cluesGathered.push({ npcId, npcName, clue, eliminated: eliminated.id });
        message = `${npcName}: «${clue}»`;
        ActionLog.add(registry, `Спросил ${npcName} — подсказка: ${clue} (бросок ${res.roll}, успех).`);
    } else {
        message = `${npcName}: «Не видел я никакого вора. Спроси кого другого, путник.»`;
        ActionLog.add(registry, `Спросил ${npcName} — ничего не знает (бросок ${res.roll}, провал).`);
    }

    registry.set('quest', q);

    // Проверка на побег вора
    if (turnsLeft <= 0 && !q.thiefFound) {
        q.thiefEscaped = true;
        q.currentObjective = 'Вор успел скрыться! Игра проиграна.';
        registry.set('quest', q);
        ActionLog.add(registry, 'ПОРАЖЕНИЕ: вор успел сбежать, пока ты расспрашивал жителей.');
        return { gotClue, message, turnsLeft: 0, thiefEscaped: true };
    }

    return { gotClue, message, turnsLeft, thiefEscaped: false };
}

/**
 * Проверить, не пора ли закончить игру.
 * Возвращает 'victory' / 'defeat_thief_escaped' / 'defeat_hero_dead' / null.
 */
export function checkGameEnd(registry) {
    const q = registry.get('quest');
    if (q.thiefDefeated) return 'victory';
    if (q.thiefEscaped) return 'defeat_thief_escaped';
    if (q.heroDead) return 'defeat_hero_dead';
    return null;
}

/**
 * Завершить игру победой.
 */
export function winGame(registry) {
    const q = registry.get('quest');
    q.thiefDefeated = true;
    q.currentObjective = 'Победа! Икона возвращена!';
    registry.set('quest', q);
    ActionLog.add(registry, 'ПОБЕДА: вор повержен, икона возвращена в деревню!');
}

/**
 * Завершить игру проигрышем (герой погиб).
 */
export function loseHeroDead(registry) {
    const q = registry.get('quest');
    q.heroDead = true;
    q.currentObjective = 'Герой пал в бою. Игра окончена.';
    registry.set('quest', q);
    ActionLog.add(registry, 'ПОРАЖЕНИЕ: герой пал в бою с вором.');
}

/**
 * Попросить денег у NPC. Одноразовое действие для каждого NPC.
 * Шанс успеха и сумма зависят от навыка Persuade и кто просит.
 * Возвращает { success, amount, message, turnsLeft }.
 */
export function askMoneyForHelp(registry, npcId, npcName) {
    const q = registry.get('quest');
    const player = registry.get('player');

    // Инициализируем список, у кого уже просили деньги
    if (!q.moneyAskedFrom) q.moneyAskedFrom = [];
    if (q.moneyAskedFrom.includes(npcId)) {
        return {
            success: false,
            alreadyAsked: true,
            message: `${npcName}: «Я уже помог тебе, чем мог. Больше не дам.»`,
            turnsLeft: getHuntState(registry).turnsLeft,
        };
    }
    q.moneyAskedFrom.push(npcId);

    // Тратим ход
    const turnsLeft = spendTurn(registry, `Просил денег у ${npcName}`);

    // Модификатор в зависимости от NPC
    // Староста — больше всего даст, купец/тавернщик — средне, крестьяне — мало
    const npcGenerosity = {
        elder: 1.5, priest: 0.7, blacksmith: 0.8, tavernkeeper: 1.0,
        peasant1: 0.4, widow: 0.3,
    }[npcId] || 0.5;

    // Проверка навыка Persuade
    const persuadeSkill = player.skills.persuade || 20;
    const res = skillCheck(persuadeSkill);

    let success = false;
    let amount = 0;
    let message = '';

    if (res.result === 'critical') {
        // Крит — двойная сумма
        amount = Math.round((15 + Math.floor(Math.random() * 15)) * npcGenerosity * 2);
        success = true;
        message = `${npcName}: «Возьми, путник, чем богат. Помоги тебе Господь!» (+${amount} д.)`;
        ActionLog.add(registry, `Просил денег у ${npcName} — КРИТИЧЕСКИЙ успех, получено ${amount} д. (бросок ${res.roll}).`);
    } else if (res.result === 'success') {
        amount = Math.round((5 + Math.floor(Math.random() * 15)) * npcGenerosity);
        success = true;
        message = `${npcName}: «Вот тебе немного денег на дорогу.» (+${amount} д.)`;
        ActionLog.add(registry, `Просил денег у ${npcName} — успех, получено ${amount} д. (бросок ${res.roll}).`);
    } else if (res.result === 'fumble') {
        // Fumble — NPC обижен, теперь вообще ничего не даст
        message = `${npcName}: «Попрошайка! Уходи, не позорься!» (${npcName} больше не даст денег.)`;
        ActionLog.add(registry, `Просил денег у ${npcName} — FUMBLE, ничего не получено (бросок ${res.roll}).`);
    } else {
        message = `${npcName}: «Нет у меня лишних денег, сам перебиваюсь.»`;
        ActionLog.add(registry, `Просил денег у ${npcName} — провал, ничего не получено (бросок ${res.roll}).`);
    }

    if (success) {
        player.dengas = (player.dengas || 0) + amount;
        registry.set('player', player);
    }
    
    // Пункт 6: Штраф за попрошайничество (падение репутации)
    // applyBeggingPenalty уже учитывает модификатор высокой репутации внутри
    const repPenalty = applyBeggingPenalty(registry, npcId);
    if (repPenalty < 0) {
        message += ` (репутация упала на ${Math.abs(repPenalty)})`;
    }
    
    registry.set('quest', q);

    // Проверка на побег вора
    if (turnsLeft <= 0 && !q.thiefFound) {
        q.thiefEscaped = true;
        q.currentObjective = 'Вор успел скрыться! Игра проиграна.';
        registry.set('quest', q);
        ActionLog.add(registry, 'ПОРАЖЕНИЕ: вор успел сбежать, пока ты клянчил деньги.');
        return { success, amount, message, turnsLeft: 0, thiefEscaped: true };
    }

    return { success, amount, message, turnsLeft, thiefEscaped: false };
}

/**
 * Попросить задаток у старосты. Одноразовое.
 * Больший шанс и сумма, чем у обычных NPC, т.к. староста заинтересован в поимке вора.
 */
export function askElderAdvance(registry) {
    return askMoneyForHelp(registry, 'elder', 'Староста Мирослав');
}

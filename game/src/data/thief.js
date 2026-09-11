// Система охоты за вором.
// Состояние: вор случайно выбирает локацию (лес/тракт/река/поле),
// игрок ищет следы через BRP-проверки или расспрашивает жителей.
// Лимит «времени» — 12 ходов (поисков/бесед). После 12 — вор сбегает.

import { skillCheck } from '../systems/BRPEngine.js';
import { ActionLog } from './actionLog.js';

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
    const turnsLeft = spendTurn(registry, `Поиск следов в локации «${loc.name}»`);

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

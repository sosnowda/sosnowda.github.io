// Процедурный генератор заданий для деревни Руси XV века.
// Задания генерируются с учётом:
// - личности выдающего NPC (староста, священник, тавернщик, кузнец, крестьянин, вдова)
// - его реальных возможностей (какую награду может дать)
// - исторической достоверности (Русь 15 века)
// - реалистичного времени на выполнение (подготовка + дорога + выполнение)

import { ActionLog } from './actionLog.js';
import { ARMORS, WEAPONS } from '../systems/Character.js';

// === ТИПЫ ЗАДАНИЙ (исторически достоверные для Руси XV века) ===
export const QUEST_TYPES = {
    // Боевые задания
    BANDIT: 'bandit',           // Избить разбойников на тракте
    WOLF: 'wolf',               // Убить волка, задравшего скот
    THIEF_CATCH: 'thief_catch', // Поймать вора (главный квест)
    GUARD: 'guard',             // Постоять на страже ночью

    // Курьерские задания
    DELIVER: 'deliver',         // Доставить послание/грамоту
    FETCH: 'fetch',             // Принести предмет (травы, рыбу, дрова)

    // Ремесленные задания
    GATHER_HERBS: 'gather_herbs', // Собрать лекарственные травы
    FETCH_WOOD: 'fetch_wood',     // Принести дров на зиму
    FETCH_FISH: 'fetch_fish',     // Принести рыбы с реки

    // Социальные задания
    FIND_PERSON: 'find_person',   // Найти пропавшего человека
    ESCORT: 'escort',             // Сопроводить путника по тракту
    MEDIATE: 'mediate',           // Помирить соседей

    // Религиозные задания (только священник)
    ICON_RETURN: 'icon_return',   // Вернуть украденную икону (главный квест)
    CANDLE_FETCH: 'candle_fetch', // Принести воск для свечей
    PRAYER: 'prayer',             // Помолиться за больного
};

// === ШАБЛОНЫ ЗАДАНИЙ ПО NPC ===
// Каждый NPC может выдавать только те задания, которые соответствуют его роли
export const NPC_QUEST_POOLS = {
    elder: {
        // Староста — административные и охранные задания
        quests: [QUEST_TYPES.BANDIT, QUEST_TYPES.DELIVER, QUEST_TYPES.GUARD, QUEST_TYPES.MEDIATE, QUEST_TYPES.FIND_PERSON],
        // Награды: деньги + возможно ночлег в таверне
        rewardTypes: ['money', 'lodging', 'herb'],
        rewardScale: 1.5, // староста богаче
        description: 'староста',
    },
    priest: {
        // Священник — религиозные и моральные задания + ГЛАВНЫЙ квест
        quests: [QUEST_TYPES.ICON_RETURN, QUEST_TYPES.CANDLE_FETCH, QUEST_TYPES.PRAYER, QUEST_TYPES.FIND_PERSON, QUEST_TYPES.MEDIATE],
        rewardTypes: ['blessing', 'herb', 'icon', 'lodging'],
        rewardScale: 0.8, // священник беднее деньгами, но даёт духовные награды
        description: 'батюшка',
    },
    tavernkeeper: {
        // Тавернщик — курьерские и информационные
        quests: [QUEST_TYPES.DELIVER, QUEST_TYPES.FETCH, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['food', 'drink', 'lodging', 'money'],
        rewardScale: 1.0,
        description: 'тавернщик',
    },
    blacksmith: {
        // Кузнец — ремесленные и боевые
        quests: [QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.BANDIT, QUEST_TYPES.GUARD, QUEST_TYPES.WOLF],
        rewardTypes: ['weapon', 'armor', 'money'],
        rewardScale: 1.2, // кузнец может выковать оружие
        description: 'кузнец',
    },
    peasant1: {
        // Крестьянин — простые бытовые задания
        quests: [QUEST_TYPES.WOLF, QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.ESCORT],
        rewardTypes: ['food', 'herb', 'money'],
        rewardScale: 0.4, // крестьянин бедный
        description: 'крестьянин',
    },
    widow: {
        // Вдова — духовные и бытовые
        quests: [QUEST_TYPES.PRAYER, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['herb', 'food', 'blessing'],
        rewardScale: 0.3, // вдова очень бедная
        description: 'вдова',
    },
};

// === ОПИСАНИЯ ЗАДАНИЙ (исторически достоверные) ===
const QUEST_TEMPLATES = {
    [QUEST_TYPES.BANDIT]: {
        title: 'Разбойники на тракте',
        descriptions: [
            'На большом тракте засели разбойники, грабят купцов. Прогони их, путник!',
            'Лихие люди обложили дорогу данью. Купцы боятся возить товар. Разберись с ними!',
            'Разбойничья шайка облюбовала лес у тракта. Уже три воза разграбили. Избей их!',
        ],
        objective: 'Избить разбойников на тракте',
        location: 'road',
        combat: true,
        enemyKeys: ['bandit'],
        baseTime: 4, // 4 хода на выполнение (подготовка + дорога + бой)
        difficulty: 'medium',
    },
    [QUEST_TYPES.WOLF]: {
        title: 'Волк задрал скот',
        descriptions: [
            'Волк-людоед завёлся в лесу, задрал уже двух телят. Убей его, пока не добрался до детей!',
            'Серый хищник таскает кур и ягнят. Крестьяне боятся в поле выходить. Избавь нас от него!',
            'Стая волков обнаглела — ходят у самых дворов. Прогони их с тракта и из леса!',
        ],
        objective: 'Убить волка в лесу',
        location: 'forest',
        combat: true,
        enemyKeys: ['wolf'],
        baseTime: 3,
        difficulty: 'easy',
    },
    [QUEST_TYPES.THIEF_CATCH]: {
        title: 'Поймать вора-иконокрада',
        descriptions: [
            'Вор украл чудотворную икону из церкви! Найди его следы и верни святыню.',
        ],
        objective: 'Найти и поймать вора',
        location: 'any',
        combat: true,
        enemyKeys: ['thief'],
        baseTime: 12, // главный квест — больше времени
        difficulty: 'hard',
        isMainQuest: true,
    },
    [QUEST_TYPES.GUARD]: {
        title: 'Стоять на страже',
        descriptions: [
            'Ночью у ворот неспокойно. Постой на страже, присмотри за околицей.',
            'Разведка доносит: татары могут напасть. Встань на стражу у ворот до утра.',
        ],
        objective: 'Отстоять на страже у ворот',
        location: 'gate',
        combat: false,
        baseTime: 2,
        difficulty: 'easy',
    },
    [QUEST_TYPES.DELIVER]: {
        title: 'Доставить послание',
        descriptions: [
            'Отнеси грамоту старосте соседнего села. Срочно нужно передать весточку!',
            'Передай свёрток кузнецу в соседнюю деревню. Там его ждут.',
            'Снеси письмо отцу Савватию — пусть отслужит молебен о здравии.',
        ],
        objective: 'Доставить послание адресату',
        location: 'road',
        combat: false,
        baseTime: 3,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FETCH]: {
        title: 'Принести нужное',
        descriptions: [
            'Принеси мне с реки свежей рыбы — угощу чем бог послал.',
            'Сходи в лес за грибами, да побольше — зима длинная будет!',
            'Принеси дров из лесу — печь топить нечем стало.',
        ],
        objective: 'Принести требуемое',
        location: 'forest',
        combat: false,
        baseTime: 2,
        difficulty: 'easy',
    },
    [QUEST_TYPES.GATHER_HERBS]: {
        title: 'Собрать лекарственные травы',
        descriptions: [
            'Знахарке нужны травы: череда, зверобой, полынь. Собери их в лесу и на лугу.',
            'Больная у меня корова — нужны лечебные травы. Поищи у реки и в лесу.',
            'На зиму травы запасти нужно. Помоги собрать полынь и ромашку.',
        ],
        objective: 'Собрать лекарственные травы',
        location: 'field',
        combat: false,
        baseTime: 2,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FETCH_WOOD]: {
        title: 'Заготовить дрова',
        descriptions: [
            'Зима близко, а дров мало. Наруби в лесу сухих дров и принеси.',
            'Кузнице нужны дрова для горна. Сходи в лес, набери сухостоя.',
        ],
        objective: 'Заготовить дрова в лесу',
        location: 'forest',
        combat: false,
        baseTime: 3,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FETCH_FISH]: {
        title: 'Наловить рыбы',
        descriptions: [
            'К столу нужна рыба. Порыбачь на реке — щуку или карасей.',
            'Постный день скоро, а рыбы нет. Налови на реке, да побольше.',
        ],
        objective: 'Наловить рыбы на реке',
        location: 'river',
        combat: false,
        baseTime: 2,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FIND_PERSON]: {
        title: 'Найти пропавшего',
        descriptions: [
            'Сын мой ушёл утром в лес и не вернулся. Найди его, прошу!',
            'Муж пошёл за дровами и пропал. Поищи его в лесу и на тракте.',
            'Подросток пропал — видели его последний раз у реки. Найди его!',
        ],
        objective: 'Найти пропавшего человека',
        location: 'any',
        combat: false,
        baseTime: 4,
        difficulty: 'medium',
    },
    [QUEST_TYPES.ESCORT]: {
        title: 'Сопроводить путника',
        descriptions: [
            'Купцу нужно дойти до соседнего села. Проводи его по тракту, там неспокойно.',
            'Старушка идёт в монастырь, боится одна. Проводи её по тракту.',
        ],
        objective: 'Сопроводить путника по тракту',
        location: 'road',
        combat: false,
        baseTime: 4,
        difficulty: 'medium',
    },
    [QUEST_TYPES.MEDIATE]: {
        title: 'Помирить соседей',
        descriptions: [
            'Два соседа судятся из-за межи. Поговори с обоими — помири их, чтоб не довели до суда.',
            'Крестьяне поругались из-за покоса. Уговори их поделить луг по-братски.',
        ],
        objective: 'Помирить поссорившихся соседей',
        location: 'village',
        combat: false,
        baseTime: 2,
        difficulty: 'easy',
    },
    [QUEST_TYPES.ICON_RETURN]: {
        title: 'Вернуть украденную икону',
        descriptions: [
            'Ночью вор забрался в церковь и украл чудотворную икону Богородицы. Это наша главная святыня! Найди вора и верни икону.',
        ],
        objective: 'Найти вора и вернуть икону',
        location: 'any',
        combat: true,
        enemyKeys: ['thief'],
        baseTime: 12,
        difficulty: 'hard',
        isMainQuest: true,
    },
    [QUEST_TYPES.CANDLE_FETCH]: {
        title: 'Принести воск для свечей',
        descriptions: [
            'Свечи в церкви заканчиваются. Принеси воск с пасеки — пчеловод живёт за рекой.',
            'Для всенощной нужно много свечей. Сходи на пасеку, попроси воска.',
        ],
        objective: 'Принести воск для церковных свечей',
        location: 'field',
        combat: false,
        baseTime: 2,
        difficulty: 'easy',
    },
    [QUEST_TYPES.PRAYER]: {
        title: 'Помолиться за больного',
        descriptions: [
            'Дитя занемогло. Пойди в церковь, поставь свечу за здравие раба Божьего.',
            'Муж болеет тяжко. Помолись за него в церкви, испроси у Господа исцеления.',
        ],
        objective: 'Помолиться в церкви за больного',
        location: 'church',
        combat: false,
        baseTime: 1,
        difficulty: 'easy',
    },
};

// === НАГРАДЫ (зависят от NPC и типа задания) ===
// Возвращает массив наград: [{ type, id, name, count, ... }]
function generateRewards(npcId, questType, scale) {
    const pool = NPC_QUEST_POOLS[npcId];
    if (!pool) return [];
    
    const rewards = [];
    const rewardTypes = pool.rewardTypes;
    const difficulty = QUEST_TEMPLATES[questType]?.difficulty || 'easy';
    const difficultyMult = difficulty === 'hard' ? 2.5 : (difficulty === 'medium' ? 1.5 : 1.0);

    // Деньги (если NPC может давать деньги)
    if (rewardTypes.includes('money')) {
        const baseAmount = Math.round((5 + Math.floor(Math.random() * 15)) * scale * difficultyMult);
        rewards.push({ type: 'money', amount: baseAmount });
    }

    // Еда (хлеб, каша)
    if (rewardTypes.includes('food')) {
        rewards.push({ type: 'item', id: 'bread', name: 'Хлеб', count: 1 + Math.floor(Math.random() * 2), consumable: true, heal: 2 });
    }

    // Питьё (медовуха, квас)
    if (rewardTypes.includes('drink') && Math.random() < 0.5) {
        rewards.push({ type: 'item', id: 'mead', name: 'Медовуха', count: 1, consumable: true, mpHeal: 2 });
    }

    // Ночлег (бесплатный отдых в таверне)
    if (rewardTypes.includes('lodging') && Math.random() < 0.4) {
        rewards.push({ type: 'lodging', name: 'Бесплатный ночлег в таверне' });
    }

    // Лечебная трава
    if (rewardTypes.includes('herb') && Math.random() < 0.6) {
        rewards.push({ type: 'item', id: 'herb', name: 'Целебная трава', count: 1 + Math.floor(Math.random() * 2), consumable: true });
    }

    // Благословение (восстановление HP/MP)
    if (rewardTypes.includes('blessing')) {
        rewards.push({ type: 'blessing', name: 'Благословение батюшки (полное восстановление)' });
    }

    // Икона (только за главный квест)
    if (rewardTypes.includes('icon') && questType === QUEST_TYPES.ICON_RETURN) {
        rewards.push({ type: 'item', id: 'icon', name: 'Чудотворная икона', count: 1, quest: true });
    }

    // Оружие (кузнец может выковать)
    if (rewardTypes.includes('weapon')) {
        const weaponPool = ['sword', 'spear', 'axe', 'sabre'];
        const weaponId = weaponPool[Math.floor(Math.random() * weaponPool.length)];
        const weapon = WEAPONS[weaponId];
        if (weapon) {
            rewards.push({ type: 'item', id: weaponId, name: weapon.name, count: 1, weapon: true });
        }
    }

    // Доспех (кузнец может выковать)
    if (rewardTypes.includes('armor') && Math.random() < 0.5) {
        const armorPool = ['padded', 'leather'];
        const armorId = armorPool[Math.floor(Math.random() * armorPool.length)];
        const armor = ARMORS[armorId];
        if (armor) {
            rewards.push({ type: 'item', id: armorId, name: armor.name, count: 1, armor: true });
        }
    }

    return rewards;
}

// === ГЕНЕРАЦИЯ ЗАДАНИЯ ===
/**
 * Сгенерировать случайное задание для NPC.
 * @param {string} npcId — ID NPC (elder, priest, tavernkeeper, blacksmith, peasant1, widow)
 * @param {Object} registry — Phaser registry
 * @returns {Object} — объект задания { id, type, title, description, objective, npcId, npcName, location, combat, enemyKeys, timeLimit, turnsUsed, rewards, completed, accepted }
 */
export function generateQuest(npcId, registry) {
    const pool = NPC_QUEST_POOLS[npcId];
    if (!pool) return null;

    // Проверяем, не выдан ли уже главный квест
    const q = registry.get('quest') || {};
    const activeQuests = q.activeQuests || [];
    
    // Выбираем случайный тип задания из пула NPC
    let questType;
    // Если у NPC есть главный квест (ICON_RETURN) и он ещё не выдан — шанс 30% выдать его
    if (pool.quests.includes(QUEST_TYPES.ICON_RETURN) && !q.mainQuestGiven && Math.random() < 0.3) {
        questType = QUEST_TYPES.ICON_RETURN;
        q.mainQuestGiven = true;
        registry.set('quest', q);
    } else {
        // Фильтруем задания, которые уже есть у игрока (не выдаем дубликаты)
        const availableTypes = pool.quests.filter(t => {
            if (t === QUEST_TYPES.ICON_RETURN && q.mainQuestGiven) return false;
            return !activeQuests.some(aq => aq.type === t && !aq.completed);
        });
        if (availableTypes.length === 0) return null; // нет доступных заданий
        questType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }

    const template = QUEST_TEMPLATES[questType];
    if (!template) return null;

    // Случайное описание
    const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];

    // Награды
    const rewards = generateRewards(npcId, questType, pool.rewardScale);

    // Время на выполнение: baseTime + случайная добавка
    // Учитывает: подготовку (0-1 ход), дорогу (1-2 хода), выполнение (baseTime)
    const prepTime = Math.floor(Math.random() * 2);
    const travelTime = 1 + Math.floor(Math.random() * 2);
    const timeLimit = template.baseTime + prepTime + travelTime;

    const quest = {
        id: 'quest_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        type: questType,
        title: template.title,
        description: description,
        objective: template.objective,
        npcId: npcId,
        npcName: pool.description,
        location: template.location,
        combat: template.combat || false,
        enemyKeys: template.enemyKeys || null,
        timeLimit: timeLimit,
        turnsUsed: 0,
        rewards: rewards,
        completed: false,
        accepted: false,
        isMainQuest: template.isMainQuest || false,
        difficulty: template.difficulty,
    };

    return quest;
}

/**
 * Принять задание.
 */
export function acceptQuest(registry, quest) {
    const q = registry.get('quest') || {};
    if (!q.activeQuests) q.activeQuests = [];
    quest.accepted = true;
    q.activeQuests.push(quest);
    q.currentObjective = quest.objective + ` (ходов: ${quest.timeLimit})`;
    registry.set('quest', q);
    ActionLog.add(registry, `Принял задание: ${quest.title} от ${quest.npcName}. Время: ${quest.timeLimit} ходов.`);
    return quest;
}

/**
 * Проверить, выполнено ли задание.
 * Вызывается при победе в бою (для боевых) или при возврате в локацию (для небоевых).
 */
export function checkQuestCompletion(registry, quest, context = {}) {
    if (!quest || quest.completed) return false;

    const template = QUEST_TEMPLATES[quest.type];
    if (!template) return false;

    // Для боевых заданий — проверяем, что бой с нужным врагом выигран
    if (quest.combat && context.combatWon) {
        quest.completed = true;
        return true;
    }

    // Для небоевых заданий — проверяем, что игрок был в нужной локации
    if (!quest.combat && context.locationVisited === quest.location) {
        quest.completed = true;
        return true;
    }

    // Для заданий "в деревне" (mediate, prayer) — проверяем, что игрок вернулся в деревню
    if (quest.location === 'village' && context.returnedToVillage) {
        quest.completed = true;
        return true;
    }
    if (quest.location === 'church' && context.visitedChurch) {
        quest.completed = true;
        return true;
    }

    return false;
}

/**
 * Выдать награды за выполненное задание.
 */
export function grantQuestRewards(registry, quest) {
    if (!quest || !quest.rewards) return [];
    
    const player = registry.get('player');
    const grantedRewards = [];

    quest.rewards.forEach(reward => {
        if (reward.type === 'money') {
            player.dengas = (player.dengas || 0) + reward.amount;
            grantedRewards.push(`${formatMoney(reward.amount)}`);
        } else if (reward.type === 'item') {
            if (!player.inventory) player.inventory = [];
            const existing = player.inventory.find(i => i.id === reward.id);
            if (existing) {
                existing.count += reward.count;
            } else {
                player.inventory.push({
                    id: reward.id,
                    name: reward.name,
                    count: reward.count,
                    type: reward.weapon ? 'weapon' : (reward.armor ? 'armor' : 'consumable'),
                    heal: reward.heal,
                    mpHeal: reward.mpHeal,
                });
            }
            grantedRewards.push(`${reward.name} ×${reward.count}`);
        } else if (reward.type === 'lodging') {
            // Полное восстановление HP/MP
            player.HP = player.HPmax;
            player.MP = player.MPmax;
            grantedRewards.push('Бесплатный ночлег (полное восстановление)');
        } else if (reward.type === 'blessing') {
            player.HP = player.HPmax;
            player.MP = player.MPmax;
            grantedRewards.push('Благословение (полное восстановление)');
        }
    });

    registry.set('player', player);
    ActionLog.add(registry, `Награда за «${quest.title}»: ${grantedRewards.join(', ')}.`);
    return grantedRewards;
}

/**
 * Получить список активных (не выполненных) заданий.
 */
export function getActiveQuests(registry) {
    const q = registry.get('quest') || {};
    return (q.activeQuests || []).filter(q => q.accepted && !q.completed);
}

/**
 * Получить список выполненных заданий.
 */
export function getCompletedQuests(registry) {
    const q = registry.get('quest') || {};
    return (q.activeQuests || []).filter(q => q.completed);
}

// Импортируем formatMoney из Character.js
import { formatMoney } from '../systems/Character.js';

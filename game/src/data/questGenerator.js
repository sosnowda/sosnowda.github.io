// Процедурный генератор заданий для деревни Руси XV века.
// Задания генерируются с учётом:
// - личности выдающего NPC (староста, священник, тавернщик, кузнец, крестьянин, вдова)
// - его реальных возможностей (какую награду может дать)
// - исторической достоверности (Русь 15 века)
// - реалистичного времени на выполнение (подготовка + дорога + выполнение)

import { ActionLog } from './actionLog.js';
import { ARMORS, WEAPONS } from '../systems/Character.js';
import { t, tf } from '../systems/i18n.js';

// ============================================================
// БЛАГОСЛОВЕНИЕ (раунд 22, п.11)
// Священник в церкви даёт благословение: следующая проверка навыка
// (любая: поиск следов, расспрос, убеждение, оглушение, атака) проходит
// с +10 к шансу — но только ОДНА проверка.
// ============================================================

/** Есть ли у героя неиспользованное благословение. */
export function hasBlessing(registry) {
    const q = registry.get('quest') || {};
    return !!q.blessing;
}

/**
 * Применить благословение к проверке навыка. Если благословение есть —
 * оно расходуется и навык увеличивается на +10 (один раз!).
 * @returns {number} значение навыка для skillCheck
 */
export function consumeBlessing(registry, skillValue) {
    const q = registry.get('quest');
    if (q && q.blessing) {
        q.blessing = false;
        registry.set('quest', q);
        ActionLog.add(registry, t('✨ Благословение батюшки окрыляет: +10 к шансу этой проверки (единственный раз).'));
        return Math.min(95, (skillValue || 0) + 10);
    }
    return skillValue || 0;
}

// ============================================================
// СРОКИ ПОРУЧЕНИЙ (раунд 22, п.15)
// Время поручений течёт вместе с мировым временем: каждый тик (15 минут)
// приближает срок. Просроченное поручение проваливается.
// Главный квест (погоня за вором) живёт по своим правилам и не сгорает.
// ============================================================

/**
 * Вызывается из TimeSystem.tickTime на каждое изменение времени.
 * @param {Object} registry — Phaser registry
 * @param {number} minutes — сколько игровых минут прошло
 */
export function tickQuestTime(registry, minutes) {
    const q = registry.get('quest');
    if (!q || !q.activeQuests || q.activeQuests.length === 0) return;
    let changed = false;
    q.activeQuests.forEach(quest => {
        if (quest.completed || quest.failed || quest.rewardClaimed || quest.isMainQuest) return;
        quest.minutesDone = (quest.minutesDone || 0) + (minutes || 0);
        changed = true;
        const limitMinutes = (quest.timeLimit || 10) * 15;
        if (quest.minutesDone > limitMinutes) {
            quest.failed = true;
            ActionLog.add(registry, tf(t('⌛ Поручение «{0}» просрочено! Срок вышел, а дело не сделано.'), quest.title));
        }
    });
    if (changed) registry.set('quest', q);
}

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
        // Крестьянин — простые бытовые задания.
        // Раунд 22: награда поднята (0.4 → 0.9) — боевые задания за 3 деньги
        // были нелогичны.
        quests: [QUEST_TYPES.WOLF, QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.ESCORT],
        rewardTypes: ['food', 'herb', 'money'],
        rewardScale: 0.9,
        description: 'крестьянин',
    },
    widow: {
        // Вдова — духовные и бытовые. Раунд 22: 0.3 → 0.7 (та же причина).
        quests: [QUEST_TYPES.PRAYER, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['herb', 'food', 'blessing'],
        rewardScale: 0.7,
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
        // Раунд 22: 'gate' не был достижим (поручение было НЕВЫПОЛНИМО) —
        // стража у ворот = дело деревенское, как и помирить соседей.
        location: 'village',
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
            'Сходи в лес за грибами, да побольше — зима длинная будет!',
            'Принеси дров из лесу — печь топить нечем стало.',
            'Нужны сухие ветки да хворост. Загляни в лес, пока не стемнело.',
        ],
        objective: 'Принести требуемое из леса',
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
            'Свечи в церкви заканчиваются. Принеси воск с пасеки — там держат ульи.',
            'Для всенощной нужно много свечей. Сходи на пасеку, попроси воска.',
        ],
        objective: 'Принести воск для церковных свечей',
        // Раунд 22: воск берут на ПАСЕКЕ (было 'field' — описание не совпадало
        // с целью, и поручение путало игрока).
        location: 'apiary',
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
    // Фильтруем задания, которые уже есть у игрока (не выдаем дубликаты).
    // Раунд 22: просроченные поручения тоже освобождают слот.
    const availableTypes = pool.quests.filter(t => {
            if (t === QUEST_TYPES.ICON_RETURN && q.mainQuestGiven) return false;
            return !activeQuests.some(aq => aq.type === t && !aq.completed && !aq.failed);
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

    // Время на выполнение: раунд 22, сверка проходимости (п.15).
    // Реальный путь: дорога к развилке (1) + до цели (1-2) + обратно (1)
    // + вход в дом (1) + разговоры. Старые лимиты (3-7 действий) были
    // НЕПРОХОДИМЫ для дальних целей — поручения сгорали на обратном пути.
    const FAR_LOCATIONS = ['lake', 'pogost', 'mill', 'apiary', 'pasture', 'road'];
    const travelExtra = FAR_LOCATIONS.includes(template.location) ? 2 : 0;
    const timeLimit = template.baseTime + 6 + travelExtra;

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
    q.currentObjective = quest.objective + ` (${tf(t('{0} действий'), quest.timeLimit)})`;
    registry.set('quest', q);
    ActionLog.add(registry, tf(t('Принял задание: {0} от {1}. Время: {2}.'), quest.title, quest.npcName, tf(t('{0} действий'), quest.timeLimit)));
    return quest;
}

// Соответствие локации поручения посещённой локации.
// 'road' (легаси-имя) считается совпадающим с 'road_south';
// 'any' — любая загородная локация.
function matchesLocation(questLoc, visited) {
    if (!questLoc || !visited) return false;
    if (questLoc === visited) return true;
    if (questLoc === 'road' && visited === 'road_south') return true;
    if (questLoc === 'any') {
        return ['forest', 'road_south', 'field', 'river', 'lake', 'pogost', 'mill', 'apiary', 'pasture'].includes(visited);
    }
    return false;
}

/**
 * Раунд 21: отметить выполненными НЕБОЕВЫЕ поручения, подходящие по локации.
 * Вызывается при посещении деревни/лесов/пасеки/развилки/церкви.
 * Награда выдаётся при разговоре с заказчиком (claimCompletedQuests).
 * @returns {Array} список завершённых поручений
 */
export function onLocationVisited(registry, locationId) {
    const completed = [];
    getActiveQuests(registry).forEach(quest => {
        if (quest.combat || quest.completed) return;
        if (matchesLocation(quest.location, locationId)) {
            quest.completed = true;
            completed.push(quest);
            ActionLog.add(registry, tf(t('Поручение «{0}» выполнено! Загляни к {1} за наградой.'), quest.title, quest.npcName));
        }
    });
    return completed;
}

/**
 * Проверить, выполнено ли задание.
 * Вызывается при победе в бою (для боевых) или при возврате в локацию (для небоевых).
 */
export function checkQuestCompletion(registry, quest, context = {}) {
    if (!quest || quest.completed) return false;

    const template = QUEST_TEMPLATES[quest.type];
    if (!template) return false;

    // Для боевых заданий — проверяем, что бой с НУЖНЫМ типом врага выигран
    if (quest.combat && context.combatWon) {
        const enemyMatched = !context.enemyKey || !quest.enemyKeys || quest.enemyKeys.includes(context.enemyKey);
        if (enemyMatched) {
            quest.completed = true;
            return true;
        }
    }

    // Для небоевых заданий — проверяем, что игрок был в нужной локации
    if (!quest.combat && matchesLocation(quest.location, context.locationVisited)) {
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
    const q = registry.get('quest') || {};
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
            // Раунд 22: ночлег теперь ваучер — им можно воспользоваться,
            // отдохнув в таверне (8 часов, бесплатно).
            q.freeLodging = (q.freeLodging || 0) + 1;
            grantedRewards.push('Ваучер: бесплатный ночлег в таверне (8 часов)');
        } else if (reward.type === 'blessing') {
            player.HP = player.HPmax;
            player.MP = player.MPmax;
            grantedRewards.push('Благословение (полное восстановление)');
        }
    });

    registry.set('player', player);
    registry.set('quest', q); // ваучеры ночлега хранятся в quest
    ActionLog.add(registry, `Награда за «${quest.title}»: ${grantedRewards.join(', ')}.`);
    return grantedRewards;
}

/**
 * Получить список активных (не выполненных и не просроченных) заданий.
 */
export function getActiveQuests(registry) {
    const q = registry.get('quest') || {};
    return (q.activeQuests || []).filter(q => q.accepted && !q.completed && !q.failed);
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

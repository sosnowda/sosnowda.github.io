// Расширенная система NPC с расписанием дня по профессиям.
// Каждый NPC имеет:
// - профессию (крестьянин, кузнец, тавернщик, священник, староста, и т.д.)
// - расписание активности по времени суток
// - местоположение в зависимости от времени (дома / в поле / в церкви / и т.д.)

import { TIME_OF_DAY, getTimeOfDay } from '../systems/TimeSystem.js';

// Профессии NPC Руси XV века
export const PROFESSIONS = {
    ELDER: 'elder',           // Староста
    PRIEST: 'priest',         // Священник
    TAVERNKEEPER: 'tavernkeeper', // Тавернщик
    BLACKSMITH: 'blacksmith', // Кузнец
    PEASANT: 'peasant',       // Крестьянин
    WIDOW: 'widow',           // Вдова
    HEALER: 'healer',         // Знахарка
    HUNTER: 'hunter',         // Охотник
    MERCHANT: 'merchant',     // Купец
    GUARD: 'guard',           // Стражник
    MILLER: 'miller',         // Мельник
    BEEKEEPER: 'beekeeper',   // Пасечник
    FISHERMAN: 'fisherman',   // Рыбак
    MONK: 'monk',             // Монах
};

// Расписания по времени суток для каждой профессии
// Возвращает: { activity, location, available (можно ли говорить) }
export const PROFESSION_SCHEDULES = {
    [PROFESSIONS.ELDER]: {
        dawn:      { activity: 'молится дома', location: 'home', available: false },
        morning:   { activity: 'решает дела в горнице', location: 'home', available: true },
        noon:      { activity: 'обедает', location: 'home', available: false },
        evening:   { activity: 'обходит деревню', location: 'village', available: true },
        dusk:      { activity: 'возвращается домой', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.PRIEST]: {
        dawn:      { activity: 'совершает утреню', location: 'church', available: false },
        morning:   { activity: 'служит обедню', location: 'church', available: true },
        noon:      { activity: 'трапезничает', location: 'church', available: false },
        evening:   { activity: 'совершает вечерню', location: 'church', available: true },
        dusk:      { activity: 'запирает церковь', location: 'church', available: true },
        night:     { activity: 'молится в келье', location: 'church', available: false },
    },
    [PROFESSIONS.TAVERNKEEPER]: {
        dawn:      { activity: 'спит', location: 'tavern', available: false },
        morning:   { activity: 'готовит еду', location: 'tavern', available: true },
        noon:      { activity: 'обслуживает гостей', location: 'tavern', available: true },
        evening:   { activity: 'обслуживает гостей', location: 'tavern', available: true },
        dusk:      { activity: 'обслуживает гостей', location: 'tavern', available: true },
        night:     { activity: 'убирает зал', location: 'tavern', available: false },
    },
    [PROFESSIONS.BLACKSMITH]: {
        dawn:      { activity: 'растапливает горн', location: 'blacksmith', available: true },
        morning:   { activity: 'куёт оружие и орудия', location: 'blacksmith', available: true },
        noon:      { activity: 'обедает', location: 'blacksmith', available: false },
        evening:   { activity: 'подковывает лошадей', location: 'blacksmith', available: true },
        dusk:      { activity: 'гасит горн', location: 'blacksmith', available: true },
        night:     { activity: 'спит', location: 'blacksmith', available: false },
    },
    [PROFESSIONS.PEASANT]: {
        dawn:      { activity: 'выгоняет скот', location: 'field', available: false },
        morning:   { activity: 'работает в поле', location: 'field', available: false },
        noon:      { activity: 'обедает в поле', location: 'field', available: true },
        evening:   { activity: 'возвращается с поля', location: 'home', available: true },
        dusk:      { activity: 'ужинает дома', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.WIDOW]: {
        dawn:      { activity: 'молится дома', location: 'home', available: true },
        morning:   { activity: 'прядёт пряжу', location: 'home', available: true },
        noon:      { activity: 'ходит к колодцу', location: 'village', available: true },
        evening:   { activity: 'в церкви на вечерне', location: 'church', available: true },
        dusk:      { activity: 'дома', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.HEALER]: {
        dawn:      { activity: 'собирает травы на росе', location: 'field', available: false },
        morning:   { activity: 'сушит травы дома', location: 'home', available: true },
        noon:      { activity: 'лечит больных', location: 'home', available: true },
        evening:   { activity: 'готовит снадобья', location: 'home', available: true },
        dusk:      { activity: 'дома', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.HUNTER]: {
        dawn:      { activity: 'уходил на охоту', location: 'forest', available: false },
        morning:   { activity: 'на охоте в лесу', location: 'forest', available: false },
        noon:      { activity: 'на охоте в лесу', location: 'forest', available: false },
        evening:   { activity: 'возвращается с добычей', location: 'home', available: true },
        dusk:      { activity: 'разделывает дичь', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.MERCHANT]: {
        dawn:      { activity: 'спит', location: 'tavern', available: false },
        morning:   { activity: 'выкладывает товар', location: 'village', available: true },
        noon:      { activity: 'торгует на площади', location: 'village', available: true },
        evening:   { activity: 'в таверне, пьёт медовуху', location: 'tavern', available: true },
        dusk:      { activity: 'в таверне', location: 'tavern', available: true },
        night:     { activity: 'спит в таверне', location: 'tavern', available: false },
    },
    [PROFESSIONS.GUARD]: {
        dawn:      { activity: 'сменяется со стражи', location: 'gate', available: true },
        morning:   { activity: 'спит', location: 'home', available: false },
        noon:      { activity: 'патрулирует деревню', location: 'village', available: true },
        evening:   { activity: 'встаёт на стражу', location: 'gate', available: true },
        dusk:      { activity: 'на страже у ворот', location: 'gate', available: true },
        night:     { activity: 'на страже у ворот', location: 'gate', available: true },
    },
    [PROFESSIONS.MILLER]: {
        dawn:      { activity: 'проверяет жернова', location: 'mill', available: true },
        morning:   { activity: 'мелет зерно', location: 'mill', available: true },
        noon:      { activity: 'обедает у мельницы', location: 'mill', available: true },
        evening:   { activity: 'дома', location: 'home', available: true },
        dusk:      { activity: 'дома', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.BEEKEEPER]: {
        dawn:      { activity: 'на пасеке', location: 'apiary', available: false },
        morning:   { activity: 'ухаживает за пчёлами', location: 'apiary', available: true },
        noon:      { activity: 'собирает мёд', location: 'apiary', available: true },
        evening:   { activity: 'возвращается домой', location: 'home', available: true },
        dusk:      { activity: 'дома', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.FISHERMAN]: {
        dawn:      { activity: 'проверяет сети', location: 'river', available: false },
        morning:   { activity: 'ловит рыбу', location: 'river', available: false },
        noon:      { activity: ' чинит сети на берегу', location: 'river', available: true },
        evening:   { activity: 'возвращается с уловом', location: 'home', available: true },
        dusk:      { activity: 'коптит рыбу', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.MONK]: {
        dawn:      { activity: 'на утренней молитве', location: 'church', available: false },
        morning:   { activity: 'переписывает книги', location: 'church', available: true },
        noon:      { activity: 'на трапезе', location: 'church', available: false },
        evening:   { activity: 'на вечерней молитве', location: 'church', available: true },
        dusk:      { activity: 'молится', location: 'church', available: true },
        night:     { activity: 'спит в келье', location: 'church', available: false },
    },
};

// Расширенный список NPC деревни
export const VILLAGE_NPCS = [
    {
        id: 'elder',
        name: 'Староста Мирослав',
        profession: PROFESSIONS.ELDER,
        gender: 'male',
        sprite: 'npc_elder',
        portrait: 'portrait_elder',
        age: 58,
        bio: 'Староста деревни, избранный общиной. Решает споры, собирает подати.',
        interiorId: 'elder_house',
    },
    {
        id: 'priest',
        name: 'Отец Савватий',
        profession: PROFESSIONS.PRIEST,
        gender: 'male',
        sprite: 'npc_elder',
        portrait: 'portrait_elder',
        age: 62,
        bio: 'Священник местной церкви. Совершает требы, учит грамоте.',
        interiorId: 'church',
    },
    {
        id: 'tavernkeeper',
        name: 'Тавернщик Фёдор',
        profession: PROFESSIONS.TAVERNKEEPER,
        gender: 'male',
        sprite: 'npc_merchant',
        portrait: 'portrait_merchant',
        age: 45,
        bio: 'Держит таверну «У дороги». Знает все новости и слухи.',
        interiorId: 'tavern',
    },
    {
        id: 'blacksmith',
        name: 'Кузнец Данила',
        profession: PROFESSIONS.BLACKSMITH,
        gender: 'male',
        sprite: 'npc_soldier',
        portrait: 'portrait_soldier',
        age: 40,
        bio: 'Мастер-кузнец. Кует оружие, орудия труда, подковывает лошадей.',
        interiorId: 'blacksmith',
    },
    {
        id: 'peasant1',
        name: 'Крестьянин Авдей',
        profession: PROFESSIONS.PEASANT,
        gender: 'male',
        sprite: 'npc_merchant',
        portrait: 'portrait_narrator',
        age: 35,
        bio: 'Крестьянин-общинник. Пашет землю, содержит скот.',
        interiorId: 'villager_house_1',
    },
    {
        id: 'widow',
        name: 'Вдова Марфа',
        profession: PROFESSIONS.WIDOW,
        gender: 'female',
        sprite: 'npc_elder',
        portrait: 'portrait_narrator',
        age: 55,
        bio: 'Вдова погибшего воина. Прядёт пряжу, помогает больным.',
        interiorId: 'villager_house_2',
    },
    {
        id: 'healer',
        name: 'Знахарка Лукерья',
        profession: PROFESSIONS.HEALER,
        gender: 'female',
        sprite: 'npc_elder',
        portrait: 'portrait_narrator',
        age: 68,
        bio: 'Старая знахарка. Лечит травами, знает заговоры.',
        interiorId: 'healer_house',
    },
    {
        id: 'hunter',
        name: 'Охотник Гаврила',
        profession: PROFESSIONS.HUNTER,
        gender: 'male',
        sprite: 'npc_soldier',
        portrait: 'portrait_soldier',
        age: 32,
        bio: 'Охотник и следопыт. Знает лес лучше всех в деревне.',
        interiorId: 'hunter_house',
    },
    {
        id: 'guard',
        name: 'Стражник Илья',
        profession: PROFESSIONS.GUARD,
        gender: 'male',
        sprite: 'npc_soldier',
        portrait: 'portrait_soldier',
        age: 28,
        bio: 'Деревенский стражник. Охраняет ворота и следит за порядком.',
        interiorId: 'guard_house',
    },
    {
        id: 'fisherman',
        name: 'Рыбак Клим',
        profession: PROFESSIONS.FISHERMAN,
        gender: 'male',
        sprite: 'npc_merchant',
        portrait: 'portrait_narrator',
        age: 42,
        bio: 'Рыбак с многолетним опытом. Знает все рыбные места на реке.',
        interiorId: 'fisherman_house',
    },
];

/**
 * Получить текущее расписание NPC по времени суток.
 */
export function getNpcSchedule(npc, hour) {
    const tod = getTimeOfDay(hour);
    const schedule = PROFESSION_SCHEDULES[npc.profession];
    if (!schedule) return { activity: 'занят', location: 'home', available: false };
    return schedule[tod.id] || schedule.morning;
}

/**
 * Проверить, доступен ли NPC для разговора в данное время.
 */
export function isNpcAvailable(npc, hour) {
    const schedule = getNpcSchedule(npc, hour);
    return schedule.available;
}

/**
 * Получить местоположение NPC в данное время.
 */
export function getNpcLocation(npc, hour) {
    const schedule = getNpcSchedule(npc, hour);
    return schedule.location;
}

/**
 * Получить описание деятельности NPC.
 */
export function getNpcActivity(npc, hour) {
    const schedule = getNpcSchedule(npc, hour);
    return schedule.activity;
}

/**
 * Найти NPC по ID.
 */
export function findNpcById(npcId) {
    return VILLAGE_NPCS.find(n => n.id === npcId);
}

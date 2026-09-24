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
    PLOUGHMAN: 'ploughman',   // Пахарь (раунд 28: Тарас — глава дома на месте часовни)
    CHILD: 'child',           // Ребёнок (раунд 28: семеро детей пахаря)
    BEEKEEPER: 'beekeeper',   // Пасечник
    FISHERMAN: 'fisherman',   // Рыбак
    MONK: 'monk',             // Монах
    HOMEMAKER: 'homemaker',   // Хозяйка дома (раунд 27: жёны старосты и пасечника)
    // Раунд 51 (п.11 заявки): восточная слобода — лавки и ремёсла
    GROCER: 'grocer',         // Снедница (Прасковья, дом с хлебной печью)
    BUTCHER: 'butcher',       // Мясник (Потап, дом со столешней)
    PEDDLER: 'peddler',       // Торгарь (Аверьян, лавка ремесленника)
    SHOEMAKER: 'shoemaker',   // Сапожник (Нефёд)
    WOODCUTTER: 'woodcutter', // Дровосек (Горазд)
};

// Расписания по времени суток для каждой профессии
// Возвращает: { activity, location, available (можно ли говорить) }
export const PROFESSION_SCHEDULES = {
    // Раунд 27 (п.10): староста НЕ сидит в доме целый день — днём обходит деревню
    [PROFESSIONS.ELDER]: {
        dawn:      { activity: 'молится дома', location: 'home', available: false },
        morning:   { activity: 'решает дела в горнице', location: 'home', available: true },
        noon:      { activity: 'обходит деревню', location: 'village', available: true },
        evening:   { activity: 'обходит деревню', location: 'village', available: true },
        dusk:      { activity: 'возвращается домой', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.PRIEST]: {
        dawn:      { activity: 'совершает утреню', location: 'church', available: false },
        morning:   { activity: 'служит обедню', location: 'church', available: true },
        // Раунд 66.21 (приказ 12): обед — 1 час (12:00–13:00) в корчме
        // (точный час ведёт npcPresence; здесь — сегмент целиком)
        noon:      { activity: 'обедает в корчме', location: 'tavern', available: false },
        evening:   { activity: 'совершает вечерню', location: 'church', available: true },
        dusk:      { activity: 'ужинает в корчме да возвращается в церковь', location: 'church', available: true },
        night:     { activity: 'спит в келье', location: 'church', available: false },
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
        evening:   { activity: 'на постоялом дворе, пьёт медовуху', location: 'tavern', available: true },
        dusk:      { activity: 'на постоялом дворе', location: 'tavern', available: true },
        night:     { activity: 'спит на постоялом дворе', location: 'tavern', available: false },
    },
    // === РАУНД 51/53: СЛОБОДА. ЛАВКИ СНЕДИ И МЯСНАЯ УДАЛЕНЫ (дома нужнее) ===
    // Прасковья и Потап живут в своих домах: днём работают при доме
    // (снедница печёт, мясник рубит) и принимают гостей с крыльца.
    [PROFESSIONS.GROCER]: {
        dawn:      { activity: 'печёт караваи', location: 'home', available: false },
        morning:   { activity: 'печёт снедь да торгует с крыльца', location: 'home', available: true },
        noon:      { activity: 'принимает гостей за столом', location: 'home', available: true },
        evening:   { activity: 'допродаёт пироги с крыльца', location: 'home', available: true },
        dusk:      { activity: 'запирает двор', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.BUTCHER]: {
        dawn:      { activity: 'колет тушу', location: 'home', available: false },
        morning:   { activity: 'рубит тушу в столешне', location: 'home', available: true },
        noon:      { activity: 'коптит окорока', location: 'home', available: true },
        evening:   { activity: 'допродаёт мясо с крыльца', location: 'home', available: true },
        dusk:      { activity: 'точит тесак', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.PEDDLER]: {
        dawn:      { activity: 'пересчитывает товар', location: 'home', available: false },
        morning:   { activity: 'торгует мелочью', location: 'shop_tools', available: true },
        noon:      { activity: 'торгует мелочью', location: 'shop_tools', available: true },
        evening:   { activity: 'допродаёт свечи', location: 'shop_tools', available: true },
        dusk:      { activity: 'запирает лавку', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.SHOEMAKER]: {
        dawn:      { activity: 'спит', location: 'home', available: false },
        morning:   { activity: 'шьёт сапоги', location: 'home', available: true },
        noon:      { activity: 'носит заказы по деревне', location: 'village', available: true },
        evening:   { activity: 'шьёт сапоги', location: 'home', available: true },
        dusk:      { activity: 'ужинает с семьёй', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.WOODCUTTER]: {
        dawn:      { activity: 'точит топор', location: 'home', available: false },
        morning:   { activity: 'рубит лес за околицей', location: 'forest', available: false },
        noon:      { activity: 'рубит лес за околицей', location: 'forest', available: false },
        evening:   { activity: 'возвращается с дровами', location: 'home', available: true },
        dusk:      { activity: 'колет дрова во дворе', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
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
    [PROFESSIONS.PLOUGHMAN]: {
        dawn:      { activity: 'вышел с сохой на поле', location: 'field', available: false },
        morning:   { activity: 'пашет и боронит', location: 'field', available: false },
        noon:      { activity: 'обедает у межи', location: 'field', available: true },
        evening:   { activity: 'возвращается с поля', location: 'home', available: true },
        dusk:      { activity: 'чинит соху во дворе', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    // Раунд 28 (п.1): дети днём — выпас/рыбалка/грибы/деревня (точное место
    // решает npcPresence.js детерминированно на день)
    [PROFESSIONS.CHILD]: {
        dawn:      { activity: 'проснулся с петухами', location: 'home', available: true },
        morning:   { activity: 'по детским делам', location: 'village', available: true },
        noon:      { activity: 'по детским делам', location: 'village', available: true },
        evening:   { activity: 'бегает по деревне', location: 'village', available: true },
        dusk:      { activity: 'ужинает дома', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
    },
    [PROFESSIONS.BEEKEEPER]: {
        dawn:      { activity: 'на пасеке', location: 'apiary', available: false },
        morning:   { activity: 'ухаживает за пчёлами', location: 'apiary', available: true },
        noon:      { activity: 'проверяет ульи', location: 'apiary', available: true },
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
    // Раунд 27 (пп.6,9): хозяйки — жёны старосты и пасечника.
    // Утром по хозяйству во дворе/у колодца, днём дома.
    [PROFESSIONS.HOMEMAKER]: {
        dawn:      { activity: 'топит печь', location: 'home', available: true },
        morning:   { activity: 'у колодца, по хозяйству', location: 'village', available: true },
        noon:      { activity: 'хозяйствует по дому', location: 'home', available: true },
        evening:   { activity: 'готовит ужин', location: 'home', available: true },
        dusk:      { activity: 'дома, за рукоделием', location: 'home', available: true },
        night:     { activity: 'спит', location: 'home', available: false },
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
        portrait: 'portrait_priest',
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
        portrait: 'portrait_tavernkeeper',
        age: 45,
        bio: 'Держит постоялый двор «У дороги». Знает все новости и слухи.',
        interiorId: 'tavern',
    },
    {
        id: 'blacksmith',
        name: 'Кузнец Данила',
        profession: PROFESSIONS.BLACKSMITH,
        gender: 'male',
        sprite: 'npc_soldier',
        portrait: 'portrait_blacksmith',
        age: 40,
        bio: 'Мастер-кузнец. Кует оружие, орудия труда, подковывает лошадей.',
        interiorId: 'blacksmith',
    },
    {
        id: 'peasant1',
        name: 'Мельник Авдей',
        profession: PROFESSIONS.MILLER,
        gender: 'male',
        sprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        age: 35,
        bio: 'Мельник. Мелет зерно на ветряной мельнице, берёт мукой за помол.',
        interiorId: 'villager_house_1',
    },
    {
        id: 'widow',
        name: 'Пасечница Марфа',
        profession: PROFESSIONS.BEEKEEPER,
        gender: 'female',
        sprite: 'npc_elder',
        // Раунд 66.21 (приказ 8): портрет по возрасту
        portrait: 'portrait_healer',
        age: 55,
        bio: 'Вдова погибшего воина, пасечница. Держит пасеку, прядёт пряжу, помогает больным.',
        interiorId: 'villager_house_2',
    },
    {
        id: 'healer',
        name: 'Знахарка Февронья',
        profession: PROFESSIONS.HEALER,
        gender: 'female',
        sprite: 'npc_elder',
        portrait: 'portrait_healer',
        age: 70,
        bio: 'Старая знахарка. Лечит травами, знает заговоры.',
        interiorId: 'healer_house',
    },
    {
        id: 'hunter',
        name: 'Охотник Гаврила',
        profession: PROFESSIONS.HUNTER,
        gender: 'male',
        sprite: 'npc_soldier',
        portrait: 'portrait_hunter',
        age: 32,
        bio: 'Охотник и следопыт. Знает лес лучше всех в деревне.',
        interiorId: 'villager_house_1',
    },
    {
        id: 'guard',
        name: 'Стражник Илья',
        profession: PROFESSIONS.GUARD,
        gender: 'male',
        sprite: 'npc_soldier',
        portrait: 'portrait_guard',
        age: 28,
        bio: 'Деревенский стражник. Охраняет ворота и следит за порядком.',
        interiorId: 'villager_house_1',
    },
    {
        id: 'fisherman',
        name: 'Рыбак Ерёма',
        profession: PROFESSIONS.FISHERMAN,
        gender: 'male',
        sprite: 'npc_merchant',
        // Раунд 66.21 (приказ 8): портрет по возрасту
        portrait: 'portrait_tavernkeeper',
        age: 42,
        bio: 'Рыбак с многолетним опытом. Знает все рыбные места на реке.',
        interiorId: 'fisher_house',
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

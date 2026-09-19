// Исторические имена Руси XV века для случайной генерации NPC.
// Разделены по полу, исключены современные имена.
// Раунд 34: описания NPC локализованы (EN-обёртки t()/isEn()).

import { isEn, t } from '../systems/i18n.js';

export const HISTORICAL_MALE_NAMES = [
    // Княжеские и боярские
    'Мирослав', 'Ярополк', 'Святополк', 'Вячеслав', 'Ростислав',
    'Ярослав', 'Всеволод', 'Святослав', 'Изяслав', 'Мстислав',
    'Глеб', 'Борис', 'Давыд', 'Роман', 'Василько',
    // Простонародные
    'Добрыня', 'Ратибор', 'Гаврила', 'Данило',
    'Степан', 'Фёдор', 'Иван', 'Михайло', 'Григорий',
    'Кузьма', 'Клим', 'Авдей', 'Тихон', 'Лука',
    'Матвей', 'Прохор', 'Сила', 'Творимир', 'Боян',
    'Ставр', 'Ждан', 'Милонег', 'Гостомысл', 'Турай',
    'Вышата', 'Янь', 'Чюдин', 'Миронег', 'Гюрята',
    // Церковные
    'Савватий', 'Сергий', 'Варлаам', 'Зосима', 'Савва',
    'Иларион', 'Никита', 'Кирилл', 'Алексий', 'Пимен',
    // Ремесленные
    'Кузьма', 'Демид', 'Прокоп', 'Ермил', 'Фрол',
    'Нестор', 'Ларион', 'Назар', 'Тарас', 'Фока',
];

export const HISTORICAL_FEMALE_NAMES = [
    // Княжеские и боярские
    'Предслава', 'Рогнеда', 'Забава', 'Любава', 'Неслава',
    'Горислава', 'Вера', 'Надежда', 'Любовь', 'Малуша',
    'Годислава', 'Жизномира', 'Настасья', 'Милонега',
    // Простонародные
    'Марфа', 'Лукерья', 'Матрёна', 'Акулина', 'Василиса',
    'Фёкла', 'Прасковья', 'Ульяна', 'Евдокия', 'Анна',
    'Мария', 'Ирина', 'Агафья', 'Феодосия', 'Пелагея',
    'Домна', 'Мавра', 'Ксения', 'Агафья', 'Татьяна',
    // Ремесленные
    'Овдотья', 'Олимпиада', 'Анфиса', 'Капитолина', 'Ефросинья',
    'Стефанида', 'Мелания', 'Варвара', 'Александра', 'Сосипатра',
];

// Возрастные группы (п.2)
export const AGE_GROUPS = {
    INFANT:  { id: 'infant',  name: 'младенец',    minAge: 0,  maxAge: 3,  gender: 'neutral' },
    BOY:     { id: 'boy',     name: 'мальчик',     minAge: 4,  maxAge: 12, gender: 'male' },
    GIRL:    { id: 'girl',    name: 'девочка',     minAge: 4,  maxAge: 12, gender: 'female' },
    YOUTH_M: { id: 'youth_m', name: 'парень',      minAge: 13, maxAge: 20, gender: 'male' },
    YOUTH_F: { id: 'youth_f', name: 'девушка',     minAge: 13, maxAge: 20, gender: 'female' },
    MAN:     { id: 'man',     name: 'мужчина',     minAge: 21, maxAge: 50, gender: 'male' },
    WOMAN:   { id: 'woman',   name: 'женщина',     minAge: 21, maxAge: 50, gender: 'female' },
    ELDER_M: { id: 'elder_m', name: 'старик',      minAge: 51, maxAge: 90, gender: 'male' },
    ELDER_F: { id: 'elder_f', name: 'старуха',     minAge: 51, maxAge: 90, gender: 'female' },
};

// Исторические сельские профессии Руси XV века (п.3)
export const PROFESSIONS_BY_GENDER = {
    male: [
        { id: 'peasant',    name: 'селянин',    femaleName: 'селянка' },
        { id: 'blacksmith', name: 'кузнец',     femaleName: null },
        // Раунд 46 (п.1 заявки): ученик кузнеца — встаёт к горну, если кузнец убит
        { id: 'apprentice', name: 'ученик кузнеца', femaleName: null },
        { id: 'priest',     name: 'священник',  femaleName: null },
        { id: 'elder',      name: 'староста',   femaleName: null },
        { id: 'hunter',     name: 'охотник',    femaleName: null },
        { id: 'healer_m',   name: 'травник',    femaleName: 'травница' },
        { id: 'shepherd',   name: 'пастух',     femaleName: 'пастушка' },
        { id: 'tavernkeeper', name: 'тавернщик', femaleName: 'тавернщица' },
        { id: 'fisherman',  name: 'рыбак',      femaleName: null },
        { id: 'miller',     name: 'мельник',    femaleName: null },
        { id: 'ploughman',  name: 'пахарь',     femaleName: null },  // раунд 28 (п.1): Тарас
        { id: 'beekeeper',  name: 'пасечник',   femaleName: null },
        { id: 'carpenter',  name: 'плотник',    femaleName: null },
        { id: 'guard',      name: 'стражник',   femaleName: null },
        { id: 'monk',       name: 'инок',       femaleName: null },
        { id: 'merchant',   name: 'торгарь',    femaleName: 'торгарка' },
        // Раунд 51 (п.11 заявки): восточная слобода — лавки и ремёсла
        { id: 'grocer',     name: 'снедник',    femaleName: 'снедница' },
        { id: 'butcher',    name: 'мясник',     femaleName: 'мясница' },
        { id: 'shoemaker',  name: 'сапожник',   femaleName: 'сапожница' },
        { id: 'woodcutter', name: 'дровосек',   femaleName: null },
    ],
    female: [
        { id: 'peasant',    name: 'селянка',    maleName: 'селянин' },
        { id: 'healer_f',   name: 'травница',   maleName: 'травник' },
        { id: 'shepherd',   name: 'пастушка',   maleName: 'пастух' },
        { id: 'tavernkeeper', name: 'тавернщица', maleName: 'тавернщик' },
        { id: 'weaver',     name: 'ткачиха',    maleName: null },
        { id: 'merchant',   name: 'торгарка',   maleName: 'торгарь' },
        { id: 'midwife',    name: 'повитуха',   maleName: null },
        { id: 'widow',      name: 'вдова',      maleName: null },
        { id: 'beekeeper',  name: 'пасечница',  maleName: 'пасечник' },  // раунд 27 (п.8)
        { id: 'homemaker',  name: 'хозяйка',    maleName: null },        // раунд 27 (пп.6,9)
        // Раунд 51 (п.11 заявки): восточная слобода — женские ипостаси профессий
        { id: 'grocer',     name: 'снедница',   maleName: 'снедник' },
        { id: 'butcher',    name: 'мясница',    maleName: 'мясник' },
        { id: 'peddler',    name: 'торгарка',   maleName: 'торгарь' },
        { id: 'shoemaker',  name: 'сапожница',  maleName: 'сапожник' },
        { id: 'woodcutter', name: 'дровосечка', maleName: 'дровосек' },
    ],
};

/**
 * Получить случайное мужское имя.
 */
export function getRandomMaleName() {
    return HISTORICAL_MALE_NAMES[Math.floor(Math.random() * HISTORICAL_MALE_NAMES.length)];
}

/**
 * Получить случайное женское имя.
 */
export function getRandomFemaleName() {
    return HISTORICAL_FEMALE_NAMES[Math.floor(Math.random() * HISTORICAL_FEMALE_NAMES.length)];
}

/**
 * Получить случайное имя по полу.
 */
export function getRandomName(gender) {
    return gender === 'female' ? getRandomFemaleName() : getRandomMaleName();
}

/**
 * Определить возрастную группу по возрасту и полу (п.2).
 */
export function getAgeGroup(age, gender) {
    if (age <= 3) return AGE_GROUPS.INFANT;
    if (age <= 12) return gender === 'female' ? AGE_GROUPS.GIRL : AGE_GROUPS.BOY;
    if (age <= 20) return gender === 'female' ? AGE_GROUPS.YOUTH_F : AGE_GROUPS.YOUTH_M;
    if (age <= 50) return gender === 'female' ? AGE_GROUPS.WOMAN : AGE_GROUPS.MAN;
    return gender === 'female' ? AGE_GROUPS.ELDER_F : AGE_GROUPS.ELDER_M;
}

/**
 * Получить случайную профессию по полу (п.3).
 */
export function getRandomProfession(gender) {
    const pool = PROFESSIONS_BY_GENDER[gender] || PROFESSIONS_BY_GENDER.male;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Сгенерировать полное описание незнакомого NPC (п.2,4).
 * Формат: «старик священник», «женщина селянка», «парень пастух».
 */
export function getStrangerDescription(age, gender, profession) {
    const ageGroup = getAgeGroup(age, gender);
    const profName = gender === 'female' ? profession.femaleName || profession.name : profession.name;

    // Для младенца — без профессии
    if (ageGroup.id === 'infant') {
        return t(ageGroup.name);
    }

    // Раунд 28: дети — возрастная группа уже говорит всё («мальчик»/«девочка»),
    // профессия-ребёнок не дублируется
    if (profession.id === 'child') {
        return t(ageGroup.name);
    }

    // Комбинируем: возрастная группа + профессия (раунд 34: EN-обёртка)
    if (isEn()) return `${t(ageGroup.name)} ${t(profName)}`;
    return `${ageGroup.name} ${profName}`;
}

/**
 * Сгенерировать полное описание знакомого NPC (п.5).
 * Формат: «Отец Савватий (священник)», «Марфа (вдова)».
 */
export function getKnownDescription(name, profession, gender) {
    const profName = gender === 'female' ? profession.femaleName || profession.name : profession.name;

    // Для священников добавляем «Отец»
    if (profession.id === 'priest') {
        return isEn() ? `Father ${name} (${t(profName)})` : `Отец ${name} (${profName})`;
    }
    // Для иноков — «Брат»
    if (profession.id === 'monk') {
        return isEn() ? `Brother ${name} (${t(profName)})` : `Брат ${name} (${profName})`;
    }

    return isEn() ? `${name} (${t(profName)})` : `${name} (${profName})`;
}

/**
 * Сгенерировать случайного NPC с полным набором данных.
 */
export function generateRandomNpc(npcId, spriteKey, portraitKey, interiorId) {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const age = 18 + Math.floor(Math.random() * 53); // 18..70 — раунд 44: диапазон НПЦ 6..70 (незнакомцы — только взрослые)
    const name = getRandomName(gender);
    const profession = getRandomProfession(gender);
    const strangerDesc = getStrangerDescription(age, gender, profession);
    const knownDesc = getKnownDescription(name, profession, gender);
    
    return {
        id: npcId,
        name: name,
        gender: gender,
        age: age,
        ageGroup: getAgeGroup(age, gender),
        profession: profession,
        sprite: spriteKey,
        portrait: portraitKey,
        interiorId: interiorId,
        strangerDescription: strangerDesc,  // до знакомства
        knownDescription: knownDesc,         // после знакомства
        met: false,  // познакомился ли игрок
    };
}

/**
 * Инициализировать NPC с случайными именами (п.6).
 * Вызывается при старте новой игры.
 */
export function initNpcNames(registry) {
    // Используем фиксированные ID для соответствия интерьерам.
    // Раунд 27: имя можно задать жёстко (name) — владельцу важны Авдей и
    // Марфа по именам; у остальных — случайные имена на каждую игру.
    // Раунд 27 (пп.6,7,8,9): Авдей — мельник, Марфа — пасечница,
    // новые жители: семья пасечника (Тарас + Фёкла) и жена старосты.
    const npcConfigs = [
        { id: 'elder',        gender: 'male',   age: 58, professionId: 'elder',      sprite: 'npc_elder',    portrait: 'portrait_elder',      interiorId: 'elder_house', married: true }, // женат на Любаве
        { id: 'priest',       gender: 'male',   age: 62, professionId: 'priest',     sprite: 'npc_elder',    portrait: 'portrait_priest',     interiorId: 'church' },
        { id: 'tavernkeeper', gender: 'male',   age: 45, professionId: 'tavernkeeper', sprite: 'npc_merchant', portrait: 'portrait_tavernkeeper', interiorId: 'tavern' },
        { id: 'blacksmith',   gender: 'male',   age: 40, professionId: 'blacksmith', sprite: 'npc_soldier',  portrait: 'portrait_blacksmith', interiorId: 'blacksmith' },
        { id: 'peasant1',     gender: 'male',   age: 35, professionId: 'miller',     sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'villager_house_1', name: 'Авдей' },
        { id: 'widow',        gender: 'female', age: 55, professionId: 'beekeeper',  sprite: 'npc_elder',    portrait: 'portrait_widow',      interiorId: 'villager_house_2', name: 'Марфа' },
        // Раунд 37: у знахарки и рыбака — СОБСТВЕННЫЕ дома (вариант Б: вторая улица)
        { id: 'healer',       gender: 'female', age: 70, professionId: 'healer_f',   sprite: 'npc_elder',    portrait: 'portrait_healer',     interiorId: 'healer_house', name: 'Февронья' },
        { id: 'hunter',       gender: 'male',   age: 32, professionId: 'hunter',     sprite: 'npc_soldier',  portrait: 'portrait_hunter',     interiorId: 'villager_house_1' },
        { id: 'guard',        gender: 'male',   age: 28, professionId: 'guard',      sprite: 'npc_soldier',  portrait: 'portrait_guard',      interiorId: 'villager_house_1' },
        { id: 'fisherman',    gender: 'male',   age: 42, professionId: 'fisherman',  sprite: 'npc_merchant', portrait: 'portrait_fisherman',  interiorId: 'fisher_house', name: 'Ерёма', married: true }, // женат на Домне
        // Раунд 27 (п.6), уточнено раундом 28 (п.1): дом на месте часовни —
        // ДОМ ПАХАРЯ (не пасечника!): Тарас днём на ПОЛЕ, жена Фёкла,
        // семеро детей (видимые НПЦ — см. npcPresence.KIDS).
        { id: 'beekeeper1',   gender: 'male',   age: 38, professionId: 'ploughman',  sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'beekeeper_house', name: 'Тарас', married: true }, // женат на Фёкле
        { id: 'beekeeper_wife', gender: 'female', age: 34, professionId: 'homemaker', sprite: 'npc_elder',  portrait: 'portrait_villager_f', interiorId: 'beekeeper_house', name: 'Фёкла', married: true },
        // Раунд 28 (п.1): семеро детей пахаря — имена случайные на каждую игру.
        // Раунд 34: детские портреты (мальчик/девочка) вместо взрослой «селянки».
        { id: 'kid1', gender: 'male',   age: 12, professionId: 'child', sprite: 'npc_merchant', portrait: 'portrait_boy',  interiorId: 'beekeeper_house' },
        { id: 'kid2', gender: 'female', age: 11, professionId: 'child', sprite: 'npc_elder',    portrait: 'portrait_girl', interiorId: 'beekeeper_house' },
        { id: 'kid3', gender: 'male',   age: 9,  professionId: 'child', sprite: 'npc_merchant', portrait: 'portrait_boy',  interiorId: 'beekeeper_house' },
        { id: 'kid4', gender: 'female', age: 8,  professionId: 'child', sprite: 'npc_elder',    portrait: 'portrait_girl', interiorId: 'beekeeper_house' },
        { id: 'kid5', gender: 'male',   age: 7,  professionId: 'child', sprite: 'npc_merchant', portrait: 'portrait_boy',  interiorId: 'beekeeper_house' },
        { id: 'kid6', gender: 'female', age: 6,  professionId: 'child', sprite: 'npc_elder',    portrait: 'portrait_girl', interiorId: 'beekeeper_house' },
        { id: 'kid7', gender: 'male',   age: 6,  professionId: 'child', sprite: 'npc_merchant', portrait: 'portrait_boy',  interiorId: 'beekeeper_house' },
        // Раунд 27 (п.9): жена старосты. Раунд 35: собственный портрет седой старухи
        // (был villager_f — молодой женщине, из-за чего «старуха» выглядела 20-летней)
        { id: 'elder_wife',   gender: 'female', age: 54, professionId: 'homemaker',  sprite: 'npc_elder',    portrait: 'portrait_elder_wife', interiorId: 'elder_house',     name: 'Любава', married: true },
        // Раунд 31 (п.2): пастухи — водят коров и лошадей на водопой
        // (утром и вечером: Выпас → Река/Озеро), днём на выпасе, ночью дома
        { id: 'shepherd1',    gender: 'male',   age: 34, professionId: 'shepherd',   sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'villager_house_1', name: 'Сила' },
        { id: 'shepherd2',    gender: 'female', age: 24, professionId: 'shepherd',   sprite: 'npc_elder',    portrait: 'portrait_villager_f', interiorId: 'villager_house_1', name: 'Настасья' },
        // Раунд 37 (вариант Б): жители новой улицы — плотник, гончар, ткачиха,
        // жена рыбака, пастушок-подросток и дети. Все — со своими домами и семьями.
        { id: 'carpenter1',   gender: 'male',   age: 41, professionId: 'carpenter',  sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'carpenter_house', name: 'Микула', married: true }, // женат на Матрёне
        { id: 'carpenter_wife', gender: 'female', age: 38, professionId: 'homemaker', sprite: 'npc_elder',   portrait: 'portrait_villager_f', interiorId: 'carpenter_house', name: 'Матрёна', married: true },
        { id: 'potter1',      gender: 'male',   age: 36, professionId: 'potter',     sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'potter_house', name: 'Игнат', married: true }, // женат на Анне
        { id: 'potter_wife',  gender: 'female', age: 33, professionId: 'homemaker',  sprite: 'npc_elder',    portrait: 'portrait_villager_f', interiorId: 'potter_house', name: 'Анна', married: true },
        { id: 'kid8',         gender: 'female', age: 9,  professionId: 'child',      sprite: 'npc_elder',    portrait: 'portrait_girl',       interiorId: 'potter_house', name: 'Дунька' },
        { id: 'weaver1',      gender: 'female', age: 47, professionId: 'weaver',     sprite: 'npc_elder',    portrait: 'portrait_villager_f', interiorId: 'weaver_house', name: 'Пелагея' },
        { id: 'shepherd_boy', gender: 'male',   age: 14, professionId: 'shepherd',   sprite: 'npc_merchant', portrait: 'portrait_boy',        interiorId: 'weaver_house', name: 'Ивашка' },
        { id: 'fisher_wife',  gender: 'female', age: 39, professionId: 'homemaker',  sprite: 'npc_elder',    portrait: 'portrait_villager_f', interiorId: 'fisher_house', name: 'Домна', married: true },
        { id: 'kid9',         gender: 'female', age: 11, professionId: 'child',      sprite: 'npc_elder',    portrait: 'portrait_girl',       interiorId: 'healer_house', name: 'Ульяна' },
        // Раунд 51 (п.11 заявки): ВОСТОЧНАЯ СЛОБОДА — торговцы рыночного ряда
        // и жители двух новых деревянных домов. Имена закреплены (торговые
        // лавки узнаваемы от игры к игре).
        { id: 'grocer',       gender: 'female', age: 44, professionId: 'grocer',   sprite: 'npc_elder',    portrait: 'portrait_villager_f', interiorId: 'grocer_house', name: 'Прасковья' },
        { id: 'butcher',      gender: 'male',   age: 48, professionId: 'butcher',   sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'butcher_house', name: 'Потап' },
        { id: 'peddler',      gender: 'male',   age: 37, professionId: 'merchant',   sprite: 'npc_merchant', portrait: 'portrait_tavernkeeper', interiorId: 'shop_tools', name: 'Аверьян' },
        { id: 'shoemaker',    gender: 'male',   age: 43, professionId: 'shoemaker',  sprite: 'npc_merchant', portrait: 'portrait_peasant',    interiorId: 'shoemaker_house', name: 'Нефёд', married: true }, // женат на Агафье
        { id: 'shoemaker_wife', gender: 'female', age: 39, professionId: 'homemaker', sprite: 'npc_elder',   portrait: 'portrait_villager_f', interiorId: 'shoemaker_house', name: 'Агафья', married: true },
        { id: 'woodcutter',   gender: 'male',   age: 31, professionId: 'woodcutter', sprite: 'npc_soldier',  portrait: 'portrait_peasant',    interiorId: 'woodcutter_house', name: 'Горазд' },
    ];

    // Раунд 27: зерно для детерминированной системы присутствия (npcPresence.js)
    registry.set('npcSeed', Math.floor(Math.random() * 1000000));

    // Раунд 43 (п.11/13 заявки): жёны (Фёкла, Любава, Матрёна, Анна, Домна)
    // состоят в браке — «Свататься» к ним нельзя (canMarry отвергнет:
    // «уже состоит в браке»). Вдова Марфа — НЕ замужем (профессия «вдова»).

    const npcs = npcConfigs.map(cfg => {
        const name = cfg.name || getRandomName(cfg.gender);
        const professionPool = PROFESSIONS_BY_GENDER[cfg.gender];
        // Раунд 28: у детей своя «профессия» — возрастная группа (вне общего
        // пула, чтобы случайные взрослые незнакомцы не становились детьми)
        const profession = professionPool.find(p => p.id === cfg.professionId)
            || (cfg.professionId === 'child'
                ? { id: 'child', name: cfg.gender === 'female' ? 'девочка' : 'мальчик' }
                : professionPool[0]);
        const ageGroup = getAgeGroup(cfg.age, cfg.gender);

        return {
            ...cfg,
            name: name,
            ageGroup: ageGroup,
            profession: profession,
            strangerDescription: getStrangerDescription(cfg.age, cfg.gender, profession),
            knownDescription: getKnownDescription(name, profession, cfg.gender),
            look: rollNpcLook(cfg.sprite),
            met: false,
        };
    });

    registry.set('npcs', npcs);
    return npcs;
}

/**
 * Раунд 23 (п.4): случайная внешность NPC на ЭТУ игру.
 * Сдвиг цвета одежды (hue), насыщенность, яркость и рост.
 * NPCs с одним базовым спрайтом получают РАЗНЫЕ сдвиги (по очереди
 * из перетасованного списка), чтобы никто не был копией другого.
 * Вызывается при каждом старте новой игры — облик деревни каждый раз иной.
 */
const NPC_HUE_STEPS = [45, 90, 135, 180, 225, 270, 315, 20];
const hueShuffles = {};
function rollNpcLook(baseSprite) {
    // Перетасованный порядок сдвигов на каждый базовый спрайт
    if (!hueShuffles[baseSprite]) {
        hueShuffles[baseSprite] = [...NPC_HUE_STEPS];
        for (let i = hueShuffles[baseSprite].length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [hueShuffles[baseSprite][i], hueShuffles[baseSprite][j]] =
                [hueShuffles[baseSprite][j], hueShuffles[baseSprite][i]];
        }
    }
    const hue = hueShuffles[baseSprite].pop()
        ?? Math.floor(Math.random() * 360);
    return {
        hue,                                          // сдвиг цвета одежды 0..360
        satMul: 0.85 + Math.random() * 0.45,          // насыщенность ×0.85..1.3
        valMul: 0.9 + Math.random() * 0.25,           // яркость ×0.9..1.15
        scale: 0.93 + Math.random() * 0.14,           // рост ×0.93..1.07
    };
}

/**
 * Раунд 46 (п.1 заявки): УЧЕНИК КУЗНЕЦА.
 * При убийстве кузнеца игроком его место у горна занимает ученик —
 * он делает ТО ЖЕ САМОЕ, что и кузнец (торговля, разговоры, наводки),
 * но он МОЛОЖЕ мастера (19 лет против 40) и СЛАБЕЕ по характеристикам
 * (см. VILLAGER_COMBAT в characters.js).
 * Добавляется в registry 'npcs' только после гибели кузнеца.
 */
export const BLACKSMITH_APPRENTICE_ID = 'apprentice';

export function spawnBlacksmithApprentice(registry) {
    const npcs = getNpcs(registry);
    const existing = npcs.find(n => n.id === BLACKSMITH_APPRENTICE_ID);
    if (existing) return existing;
    const gender = 'male';
    const age = 19; // моложе кузнеца Данилы (40 лет)
    const name = getRandomMaleName();
    const profession = PROFESSIONS_BY_GENDER.male.find(p => p.id === 'apprentice')
        || { id: 'apprentice', name: 'ученик кузнеца' };
    const cfg = {
        id: BLACKSMITH_APPRENTICE_ID, gender, age,
        professionId: 'apprentice',
        sprite: 'npc_merchant', portrait: 'portrait_peasant',
        interiorId: 'blacksmith',
    };
    const npc = {
        ...cfg,
        name,
        ageGroup: getAgeGroup(age, gender),
        profession,
        strangerDescription: getStrangerDescription(age, gender, profession),
        knownDescription: getKnownDescription(name, profession, gender),
        look: rollNpcLook(cfg.sprite),
        met: false,
    };
    npcs.push(npc);
    registry.set('npcs', npcs);
    return npc;
}

/**
 * Раунд 56: русское имя по ID для НПЦ, у которых ещё НЕТ объекта в registry.
 * Пример: ученик кузнеца (apprentice) участвует в расписаниях с самого начала
 * (в обед ходит в таверну вместе с мастером — роль blacksmith), но объект
 * NPC создаётся только после гибели кузнеца. Раньше плашка такого
 * «гостя» показывала сырой идентификатор («apprentice»).
 */
export function getNpcFallbackName(npcId) {
    const profs = [
        ...(PROFESSIONS_BY_GENDER.male || []),
        ...(PROFESSIONS_BY_GENDER.female || []),
    ];
    const p = profs.find(x => x.id === npcId);
    return p ? p.name : npcId;
}

/**
 * Получить NPC из registry.
 */
export function getNpcs(registry) {
    return registry.get('npcs') || [];
}

/**
 * Найти NPC по ID.
 */
export function findNpc(registry, npcId) {
    return getNpcs(registry).find(n => n.id === npcId);
}

/**
 * Отметить, что игрок познакомился с NPC (п.5).
 */
export function meetNpc(registry, npcId) {
    const npcs = getNpcs(registry);
    const npc = npcs.find(n => n.id === npcId);
    if (npc && !npc.met) {
        npc.met = true;
        registry.set('npcs', npcs);
        return true;
    }
    return false;
}

/**
 * Получить отображаемое имя NPC (зависит от того, познакомился ли игрок).
 */
export function getNpcDisplayName(registry, npcId) {
    const npc = findNpc(registry, npcId);
    if (!npc) return t('незнакомец');
    // Раунд 46 (п.5): вдовец/вдова — статус виден в имени после гибели супруга
    const widowed = npc.widowed ? (npc.gender === 'female' ? ', вдова' : ', вдовец') : '';
    return npc.met ? (npc.knownDescription + widowed) : npc.strangerDescription;
}

/**
 * Получить отображаемое имя NPC (короткая версия — только имя или только описание).
 */
export function getNpcShortName(registry, npcId) {
    const npc = findNpc(registry, npcId);
    if (!npc) return t('незнакомец');
    if (npc.met) {
        // Раунд 46 (п.5): у вдовы/вдовца статус виден и в коротком имени
        return npc.widowed
            ? `${npc.name} (${npc.gender === 'female' ? 'вдова' : 'вдовец'})`
            : npc.name;
    }
    return npc.strangerDescription;
}

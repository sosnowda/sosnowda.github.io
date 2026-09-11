// Исторические имена Руси XV века для случайной генерации NPC.
// Разделены по полу, исключены современные имена.

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
    'Предслава', 'Радмира', 'Забава', 'Любава', 'Неслава',
    'Горислава', 'Вера', 'Надежда', 'Любовь', 'Снежана',
    'Власта', 'Беляна', 'Зоряна', 'Милонега',
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
        { id: 'priest',     name: 'священник',  femaleName: null },
        { id: 'elder',      name: 'староста',   femaleName: null },
        { id: 'hunter',     name: 'охотник',    femaleName: null },
        { id: 'healer_m',   name: 'травник',    femaleName: 'травница' },
        { id: 'shepherd',   name: 'пастух',     femaleName: 'пастушка' },
        { id: 'tavernkeeper', name: 'тавернщик', femaleName: 'тавернщица' },
        { id: 'fisherman',  name: 'рыбак',      femaleName: null },
        { id: 'miller',     name: 'мельник',    femaleName: null },
        { id: 'beekeeper',  name: 'пасечник',   femaleName: null },
        { id: 'carpenter',  name: 'плотник',    femaleName: null },
        { id: 'guard',      name: 'стражник',   femaleName: null },
        { id: 'monk',       name: 'инок',       femaleName: null },
        { id: 'merchant',   name: 'торгарь',    femaleName: 'торгарка' },
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
        return ageGroup.name;
    }
    
    // Комбинируем: возрастная группа + профессия
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
        return `Отец ${name} (${profName})`;
    }
    // Для иноков — «Брат»
    if (profession.id === 'monk') {
        return `Брат ${name} (${profName})`;
    }
    
    return `${name} (${profName})`;
}

/**
 * Сгенерировать случайного NPC с полным набором данных.
 */
export function generateRandomNpc(npcId, spriteKey, portraitKey, interiorId) {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const age = 18 + Math.floor(Math.random() * 60); // 18..78
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
    // Используем фиксированные ID для соответствия интерьерам, но случайные имена
    const npcConfigs = [
        { id: 'elder',        gender: 'male',   age: 58, professionId: 'elder',        sprite: 'npc_elder',    portrait: 'portrait_elder',    interiorId: 'elder_house' },
        { id: 'priest',       gender: 'male',   age: 62, professionId: 'priest',       sprite: 'npc_elder',    portrait: 'portrait_elder',    interiorId: 'church' },
        { id: 'tavernkeeper', gender: 'male',   age: 45, professionId: 'tavernkeeper', sprite: 'npc_merchant', portrait: 'portrait_merchant', interiorId: 'tavern' },
        { id: 'blacksmith',   gender: 'male',   age: 40, professionId: 'blacksmith',   sprite: 'npc_soldier',  portrait: 'portrait_soldier',  interiorId: 'blacksmith' },
        { id: 'peasant1',     gender: 'male',   age: 35, professionId: 'peasant',      sprite: 'npc_merchant', portrait: 'portrait_narrator', interiorId: 'villager_house_1' },
        { id: 'widow',        gender: 'female', age: 55, professionId: 'widow',        sprite: 'npc_elder',    portrait: 'portrait_narrator', interiorId: 'villager_house_2' },
        { id: 'healer',       gender: 'female', age: 68, professionId: 'healer_f',     sprite: 'npc_elder',    portrait: 'portrait_narrator', interiorId: 'villager_house_2' },
        { id: 'hunter',       gender: 'male',   age: 32, professionId: 'hunter',       sprite: 'npc_soldier',  portrait: 'portrait_soldier',  interiorId: 'villager_house_1' },
        { id: 'guard',        gender: 'male',   age: 28, professionId: 'guard',        sprite: 'npc_soldier',  portrait: 'portrait_soldier',  interiorId: 'villager_house_1' },
        { id: 'fisherman',    gender: 'male',   age: 42, professionId: 'fisherman',    sprite: 'npc_merchant', portrait: 'portrait_narrator', interiorId: 'villager_house_1' },
    ];

    const npcs = npcConfigs.map(cfg => {
        const name = getRandomName(cfg.gender);
        const professionPool = PROFESSIONS_BY_GENDER[cfg.gender];
        const profession = professionPool.find(p => p.id === cfg.professionId) || professionPool[0];
        const ageGroup = getAgeGroup(cfg.age, cfg.gender);
        
        return {
            ...cfg,
            name: name,
            ageGroup: ageGroup,
            profession: profession,
            strangerDescription: getStrangerDescription(cfg.age, cfg.gender, profession),
            knownDescription: getKnownDescription(name, profession, cfg.gender),
            met: false,
        };
    });

    registry.set('npcs', npcs);
    return npcs;
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
    if (!npc) return 'незнакомец';
    return npc.met ? npc.knownDescription : npc.strangerDescription;
}

/**
 * Получить отображаемое имя NPC (короткая версия — только имя или только описание).
 */
export function getNpcShortName(registry, npcId) {
    const npc = findNpc(registry, npcId);
    if (!npc) return 'незнакомец';
    if (npc.met) {
        return npc.name;
    }
    return npc.strangerDescription;
}

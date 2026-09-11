// Модель персонажа по BRP (Basic Roleplaying Universal Game Engine SRD).
//
// Соответствие BRP SRD:
// - 7 характеристик: STR/CON/SIZ/DEX/INT/POW/CHA (3d6×5, диапазон 15..90)
// - HP = (CON + SIZ) / 10, MP = POW / 5
// - Damage Bonus (DB) по таблице STR+SIZ
// - Сила урона (Build) и Движение (MOV) — добавлены для полноты BRP
// - Навыки: base + (char × factor) + 1d10 (personal bonus)
// - Категории навыков: Combat / Communication / Knowledge / Manipulation / Perception / Stealth
//
// The Chronicles of Ruthenia (CR) — расширения BRP для сеттинга Руси XV века:
// - Денежная система: рубли, полтины, гривны, куны, мордки, резаны
// - Доспехи и оружие из реестра CR
// - Навык "Знахарство" (Medicine) для лечения травами
// - Навык "Выживание" (Survival) для следопытства

import { rollCharacteristic, damageBonus } from './BRPEngine.js';

// === ХАРАКТЕРИСТИКИ BRP ===
export const CHARACTER_KEYS = [
    { key: 'STR', name: 'Сила', desc: 'Физическая мощь' },
    { key: 'CON', name: 'Телосложение', desc: 'Здоровье и выносливость' },
    { key: 'SIZ', name: 'Размер', desc: 'Габариты тела' },
    { key: 'DEX', name: 'Ловкость', desc: 'Скорость и координация' },
    { key: 'INT', name: 'Интеллект', desc: 'Ум и сообразительность' },
    { key: 'POW', name: 'Сила воли', desc: 'Магическая и духовная мощь' },
    { key: 'CHA', name: 'Обаяние', desc: 'Социальная привлекательность' },
    { key: 'APP', name: 'Внешность', desc: 'Физическая привлекательность' },  // BRP опциональная 8-я
];

// === НАВЫКИ BRP (по категориям SRD) ===
export const SKILL_CATEGORIES = {
    combat: { name: 'Боевые', color: '#c0492f' },
    communication: { name: 'Общение', color: '#c9a14a' },
    knowledge: { name: 'Знания', color: '#4a7a4a' },
    manipulation: { name: 'Манипуляции', color: '#4a6a8a' },
    perception: { name: 'Восприятие', color: '#8a6a4a' },
    stealth: { name: 'Скрытность', color: '#4a4a5a' },
};

export const SKILLS = [
    // Боевые
    { key: 'sword', name: 'Владение мечом', base: 20, attr: 'DEX', factor: 2, category: 'combat' },
    { key: 'bow', name: 'Стрельба из лука', base: 15, attr: 'DEX', factor: 2, category: 'combat' },
    { key: 'spear', name: 'Владение копьём', base: 20, attr: 'STR', factor: 1.5, category: 'combat' },
    { key: 'brawl', name: 'Рукопашная', base: 25, attr: 'STR', factor: 2, category: 'combat' },
    { key: 'dodge', name: 'Уклонение', base: 0, attr: 'DEX', factor: 0.5, derived: true, category: 'combat' },
    // Общение
    { key: 'oratory', name: 'Красноречие', base: 15, attr: 'CHA', factor: 2, category: 'communication' },
    { key: 'persuade', name: 'Убеждение', base: 20, attr: 'CHA', factor: 1.5, category: 'communication' },
    { key: 'fast_talk', name: 'Болтовня', base: 10, attr: 'CHA', factor: 1.5, category: 'communication' },
    { key: 'intimidate', name: 'Запугивание', base: 15, attr: 'STR', factor: 1.5, category: 'communication' },
    // Знания
    { key: 'medicine', name: 'Знахарство', base: 5, attr: 'INT', factor: 2, category: 'knowledge' },
    { key: 'survival', name: 'Выживание', base: 20, attr: 'CON', factor: 1, category: 'knowledge' },
    { key: 'ride', name: 'Верховая езда', base: 10, attr: 'DEX', factor: 1, category: 'knowledge' },
    // Восприятие
    { key: 'spot', name: 'Внимательность', base: 25, attr: 'INT', factor: 1, category: 'perception' },
    { key: 'track', name: 'Следопытство', base: 10, attr: 'INT', factor: 1.5, category: 'perception' },
    { key: 'listen', name: 'Слух', base: 25, attr: 'CON', factor: 0.5, category: 'perception' },
];

// === ДОСПЕХИ И ОРУЖИЕ (Chronicles of Ruthenia) ===
export const ARMORS = {
    none:    { id: 'none',    name: 'Без доспеха',    def: 0,  weight: 0,  price: 0 },
    padded:  { id: 'padded',  name: 'Тегиляй',       def: 1,  weight: 2,  price: 10 },  // стёганка
    leather: { id: 'leather', name: 'Кожаная броня',  def: 2,  weight: 3,  price: 25 },
    chain:   { id: 'chain',   name: 'Кольчуга',       def: 4,  weight: 6,  price: 80 },
    plate:   { id: 'plate',   name: 'Зерцальный доспех', def: 6,  weight: 10, price: 200 },
};

export const WEAPONS = {
    fists:   { id: 'fists',   name: 'Кулаки',         skill: 'brawl', dice: { min: 1, max: 3 }, bonus: 0, price: 0 },
    club:    { id: 'club',    name: 'Дубина',          skill: 'brawl', dice: { min: 1, max: 6 }, bonus: 0, price: 2 },
    knife:   { id: 'knife',   name: 'Нож',             skill: 'brawl', dice: { min: 1, max: 4 }, bonus: 1, price: 3 },
    spear:   { id: 'spear',   name: 'Копьё',           skill: 'spear', dice: { min: 1, max: 8 }, bonus: 0, price: 8 },
    sword:   { id: 'sword',   name: 'Меч',             skill: 'sword', dice: { min: 1, max: 8 }, bonus: 1, price: 30 },
    axe:     { id: 'axe',     name: 'Боевой топор',    skill: 'brawl', dice: { min: 1, max: 8 }, bonus: 1, price: 25 },
    bow:     { id: 'bow',     name: 'Лук',             skill: 'bow',   dice: { min: 1, max: 6 }, bonus: 1, price: 20 },
    sabre:   { id: 'sabre',   name: 'Сабля',           skill: 'sword', dice: { min: 1, max: 8 }, bonus: 2, price: 60 },
    steel_sword: { id: 'steel_sword', name: 'Стальной меч', skill: 'sword', dice: { min: 1, max: 10 }, bonus: 3, price: 100 },
};

// === ДЕНЕЖНАЯ СИСТЕМА РУСИ XV ВЕКА ===
// Реальные номиналы: 1 рубль = 2 полтины = 10 гривен = 50 ногат = 100 кун = 200 резан = 600 векшей
export const CURRENCY = {
    denga:   { name: 'деньга',   short: 'д.',   value: 1 },     // 1 деньга — базовая медная
    kuna:    { name: 'куна',     short: 'к.',   value: 2 },     // 2 деньги (серебро)
    grivna:  { name: 'гривна',   short: 'гр.',  value: 100 },   // 100 денег (серебряный слиток)
    poltina: { name: 'полтина',  short: 'пол.', value: 50 },    // полгривны
    rubl:    { name: 'рубль',    short: 'руб.', value: 200 },   // 2 гривны (основная)
};

// Форматирование суммы денег (в денгах) в читаемую форму
export function formatMoney(dengas) {
    if (dengas <= 0) return '0 д.';
    const rubles = Math.floor(dengas / 200);
    const afterRubl = dengas % 200;
    const grivnas = Math.floor(afterRubl / 100);
    const afterGrivna = afterRubl % 100;
    const dengasOnly = afterGrivna;
    
    const parts = [];
    if (rubles > 0) parts.push(`${rubles} руб.`);
    if (grivnas > 0) parts.push(`${grivnas} гр.`);
    if (dengasOnly > 0) parts.push(`${dengasOnly} д.`);
    return parts.length > 0 ? parts.join(' ') : '0 д.';
}

// === ПРЕДУСТАНОВЛЕННЫЕ ГЕРОИ ===
// 8 архетипов: 4 архетипа × 2 пола (мужчина и женщина)
export const PRESET_HEROES = [
    // === СЛЕДОПЫТ ===
    {
        id: 'ranger_m',
        name: 'Олекса',
        archetype: 'Следопыт',
        gender: 'male',
        sprite: 'player',
        description: 'Хорошие навыки разведки и чтения следов, средние боевые, слабое общение.',
        stats: { STR: 45, CON: 60, SIZ: 45, DEX: 70, INT: 70, POW: 55, CHA: 35, APP: 45 },
        skillOverrides: {
            spot: 70, track: 75, survival: 70, listen: 65,
            sword: 45, bow: 55, brawl: 40, dodge: 50,
            oratory: 25, persuade: 30, fast_talk: 20, intimidate: 35,
            medicine: 35, ride: 50,
        },
        startWeapon: 'bow',
        startArmor: 'leather',
        startDengas: 35,
    },
    {
        id: 'ranger_f',
        name: 'Забава',
        archetype: 'Следопыт',
        gender: 'female',
        sprite: 'npc_merchant',
        description: 'Хорошие навыки разведки и чтения следов, средние боевые, слабое общение.',
        stats: { STR: 40, CON: 55, SIZ: 40, DEX: 75, INT: 70, POW: 55, CHA: 35, APP: 50 },
        skillOverrides: {
            spot: 72, track: 78, survival: 72, listen: 68,
            sword: 42, bow: 60, brawl: 38, dodge: 55,
            oratory: 28, persuade: 32, fast_talk: 22, intimidate: 30,
            medicine: 38, ride: 48,
        },
        startWeapon: 'bow',
        startArmor: 'leather',
        startDengas: 35,
    },
    // === ВОИН ===
    {
        id: 'warrior_m',
        name: 'Добрыня',
        archetype: 'Воин',
        gender: 'male',
        sprite: 'player',
        description: 'Слабые навыки розыска и общения, но отличные боевые навыки.',
        stats: { STR: 80, CON: 75, SIZ: 70, DEX: 55, INT: 40, POW: 50, CHA: 35, APP: 50 },
        skillOverrides: {
            sword: 80, brawl: 75, spear: 70, dodge: 55, bow: 35,
            spot: 30, track: 20, survival: 35, listen: 30,
            oratory: 20, persuade: 25, fast_talk: 15, intimidate: 60,
            medicine: 15, ride: 50,
        },
        startWeapon: 'sword',
        startArmor: 'chain',
        startDengas: 15,
    },
    {
        id: 'warrior_f',
        name: 'Радмира',
        archetype: 'Воин',
        gender: 'female',
        sprite: 'npc_merchant',
        description: 'Слабые навыки розыска и общения, но отличные боевые навыки.',
        stats: { STR: 70, CON: 70, SIZ: 55, DEX: 65, INT: 45, POW: 50, CHA: 40, APP: 55 },
        skillOverrides: {
            sword: 78, brawl: 70, spear: 68, dodge: 60, bow: 40,
            spot: 35, track: 25, survival: 38, listen: 32,
            oratory: 22, persuade: 28, fast_talk: 18, intimidate: 55,
            medicine: 18, ride: 52,
        },
        startWeapon: 'sword',
        startArmor: 'chain',
        startDengas: 15,
    },
    // === СЫЩИК ===
    {
        id: 'detective_m',
        name: 'Ярополк',
        archetype: 'Сыщик',
        gender: 'male',
        sprite: 'player',
        description: 'Хорошие навыки общения и поиска улик в разговорах, средние боевые.',
        stats: { STR: 45, CON: 50, SIZ: 45, DEX: 55, INT: 80, POW: 60, CHA: 70, APP: 55 },
        skillOverrides: {
            oratory: 72, persuade: 78, fast_talk: 62, intimidate: 38,
            spot: 68, track: 52, listen: 72,
            sword: 42, brawl: 38, dodge: 52, bow: 28,
            survival: 48, medicine: 42, ride: 32,
        },
        startWeapon: 'knife',
        startArmor: 'padded',
        startDengas: 60,
    },
    {
        id: 'detective_f',
        name: 'Бирута',
        archetype: 'Сыщик',
        gender: 'female',
        sprite: 'npc_merchant',
        description: 'Хорошие навыки общения и поиска улик в разговорах, средние боевые.',
        stats: { STR: 40, CON: 50, SIZ: 40, DEX: 60, INT: 80, POW: 60, CHA: 75, APP: 65 },
        skillOverrides: {
            oratory: 75, persuade: 80, fast_talk: 65, intimidate: 40,
            spot: 70, track: 55, listen: 75,
            sword: 45, brawl: 40, dodge: 55, bow: 30,
            survival: 50, medicine: 45, ride: 35,
        },
        startWeapon: 'knife',
        startArmor: 'padded',
        startDengas: 60,
    },
    // === ПРИКЛЮЧЕНЕЦ ===
    {
        id: 'adventurer_m',
        name: 'Ратибор',
        archetype: 'Приключенец',
        gender: 'male',
        sprite: 'player',
        description: 'Все навыки среднего уровня — универсал.',
        stats: { STR: 55, CON: 55, SIZ: 50, DEX: 60, INT: 60, POW: 60, CHA: 60, APP: 55 },
        skillOverrides: {
            sword: 55, bow: 50, brawl: 50, spear: 50, dodge: 50,
            oratory: 55, persuade: 55, fast_talk: 50, intimidate: 45,
            spot: 55, track: 50, listen: 55,
            survival: 55, medicine: 50, ride: 50,
        },
        startWeapon: 'sword',
        startArmor: 'leather',
        startDengas: 40,
    },
    {
        id: 'adventurer_f',
        name: 'Милонега',
        archetype: 'Приключенец',
        gender: 'female',
        sprite: 'npc_merchant',
        description: 'Все навыки среднего уровня — универсал.',
        stats: { STR: 50, CON: 55, SIZ: 45, DEX: 62, INT: 60, POW: 60, CHA: 62, APP: 58 },
        skillOverrides: {
            sword: 55, bow: 52, brawl: 48, spear: 50, dodge: 52,
            oratory: 56, persuade: 56, fast_talk: 51, intimidate: 44,
            spot: 55, track: 50, listen: 56,
            survival: 55, medicine: 51, ride: 50,
        },
        startWeapon: 'sword',
        startArmor: 'leather',
        startDengas: 40,
    },
];

// Паттерны процедурной генерации
export const GENERATION_PATTERNS = [
    { id: 'balanced', name: 'Сбалансированный', desc: 'Все характеристики средние (40..60)' },
    { id: 'combat',   name: 'Боевой',           desc: 'Высокие STR/CON/SIZ, низкие CHA/INT' },
    { id: 'scholar',  name: 'Учёный',           desc: 'Высокие INT/POW, низкие физические' },
    { id: 'social',   name: 'Социальный',       desc: 'Высокие CHA/APP, средние остальные' },
    { id: 'agile',    name: 'Ловкий',           desc: 'Высокие DEX/INT, низкие SIZ/STR' },
];

function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function rollStat(pattern) {
    // Базовый бросок 3d6×5 даёт 15..90 (среднее ~52)
    const base = rollCharacteristic();
    if (!pattern) return base;
    
    // Корректировка по паттерну
    switch (pattern.id) {
        case 'balanced': return randInt(40, 60);
        case 'combat':   return randInt(55, 85);
        case 'scholar':  return randInt(30, 55);
        case 'social':   return randInt(35, 60);
        case 'agile':    return randInt(35, 60);
        default: return base;
    }
}

function rollSpecificStat(pattern, statKey) {
    const base = rollStat(null);
    if (!pattern) return base;
    
    // В зависимости от паттерна и характеристики — корректируем
    const high = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA', 'APP'];
    
    if (pattern.id === 'combat') {
        if (['STR', 'CON', 'SIZ'].includes(statKey)) return randInt(60, 85);
        if (['DEX'].includes(statKey)) return randInt(50, 70);
        if (['CHA', 'APP'].includes(statKey)) return randInt(20, 40);
        return randInt(35, 55); // INT/POW
    }
    if (pattern.id === 'scholar') {
        if (['INT', 'POW'].includes(statKey)) return randInt(65, 90);
        if (['CHA', 'APP'].includes(statKey)) return randInt(30, 55);
        return randInt(35, 55); // физические
    }
    if (pattern.id === 'social') {
        if (['CHA', 'APP'].includes(statKey)) return randInt(65, 90);
        if (['INT', 'POW'].includes(statKey)) return randInt(45, 65);
        return randInt(35, 60);
    }
    if (pattern.id === 'agile') {
        if (['DEX', 'INT'].includes(statKey)) return randInt(65, 90);
        if (['SIZ', 'STR'].includes(statKey)) return randInt(30, 50);
        return randInt(45, 65);
    }
    // balanced
    return randInt(40, 60);
}

// Создание персонажа. Можно передать готовые характеристики в opts.
export function createCharacter(name, opts = {}) {
    const chr = {};
    CHARACTER_KEYS.forEach(c => {
        chr[c.key] = (opts && opts[c.key] != null) ? opts[c.key] : rollCharacteristic();
    });
    chr.name = name || 'Путник';
    chr.gender = opts.gender || (Math.random() < 0.5 ? 'male' : 'female');
    chr.archetype = opts.archetype || 'Случайный';
    chr.sprite = opts.sprite || 'player';
    
    // BRP производные
    chr.HPmax = Math.ceil((chr.CON + chr.SIZ) / 10);
    chr.HP = chr.HPmax;
    chr.MPmax = Math.floor(chr.POW / 5);
    chr.MP = chr.MPmax;
    chr.DB = damageBonus(chr.STR, chr.SIZ); // {text, min, max}
    chr.Build = chr.SIZ >= 65 ? 1 : (chr.SIZ <= 35 ? -1 : 0);
    chr.MOV = 10 + (chr.DEX >= 60 ? 1 : 0) - (chr.SIZ >= 70 ? 1 : 0);
    
    // Доспех и оружие
    chr.armorId = opts.armorId || 'none';
    chr.weaponId = opts.weaponId || 'fists';
    chr.armor = ARMORS[chr.armorId];
    chr.weapon = WEAPONS[chr.weaponId];
    
    // Деньги (в денгах — базовая медная монета)
    chr.dengas = opts.dengas != null ? opts.dengas : randInt(10, 50);
    
    chr.skills = {};
    SKILLS.forEach(s => {
        if (opts.skillOverrides && opts.skillOverrides[s.key] != null) {
            chr.skills[s.key] = opts.skillOverrides[s.key];
        } else if (s.derived) {
            chr.skills[s.key] = Math.max(1, Math.floor(chr[s.attr] * s.factor));
        } else {
            const rnd = 1 + Math.floor(Math.random() * 10);
            chr.skills[s.key] = Math.max(1, Math.round(s.base + chr[s.attr] * s.factor + rnd));
        }
    });
    
    // Инвентарь
    chr.inventory = opts.inventory || [];
    
    return chr;
}

// Создать предустановленного героя
export function createPresetHero(presetId, customName) {
    const preset = PRESET_HEROES.find(h => h.id === presetId);
    if (!preset) return null;
    return createCharacter(customName || preset.name, {
        ...preset.stats,
        archetype: preset.archetype,
        gender: preset.gender,
        sprite: preset.sprite,
        skillOverrides: preset.skillOverrides,
        armorId: preset.startArmor,
        weaponId: preset.startWeapon,
        dengas: preset.startDengas + randInt(-5, 10),
        inventory: [
            { id: 'herb', name: 'Целебная трава', count: 1, type: 'consumable' },
        ],
    });
}

// Создать случайно сгенерированного героя по паттерну
export function createRandomHero(patternId, customName) {
    const pattern = GENERATION_PATTERNS.find(p => p.id === patternId) || GENERATION_PATTERNS[0];
    const stats = {};
    CHARACTER_KEYS.forEach(c => {
        stats[c.key] = rollSpecificStat(pattern, c.key);
    });
    
    // Случайное имя по полу
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const maleNames = ['Олекса', 'Добрыня', 'Ярополк', 'Ратибор', 'Боян', 'Ставр', 'Мирослав', 'Творимир'];
    const femaleNames = ['Бирута', 'Милонега', 'Забава', 'Радмира', 'Предслава', 'Любава', 'Неслава', 'Горислава'];
    const name = customName || (gender === 'male' ? maleNames[randInt(0, maleNames.length - 1)] : femaleNames[randInt(0, femaleNames.length - 1)]);
    
    // Случайное стартовое оружие и доспех
    const weaponPool = ['sword', 'spear', 'axe', 'bow'];
    const armorPool = ['padded', 'leather', 'none'];
    const weaponId = weaponPool[randInt(0, weaponPool.length - 1)];
    const armorId = armorPool[randInt(0, armorPool.length - 1)];
    
    return createCharacter(name, {
        ...stats,
        archetype: pattern.name,
        gender,
        sprite: gender === 'male' ? 'player' : 'npc_merchant',
        armorId,
        weaponId,
        dengas: randInt(15, 50),
        inventory: [
            { id: 'herb', name: 'Целебная трава', count: 1, type: 'consumable' },
        ],
    });
}

// Экипировать оружие
export function equipWeapon(character, weaponId) {
    if (!WEAPONS[weaponId]) return false;
    character.weaponId = weaponId;
    character.weapon = WEAPONS[weaponId];
    return true;
}

// Экипировать доспех
export function equipArmor(character, armorId) {
    if (!ARMORS[armorId]) return false;
    character.armorId = armorId;
    character.armor = ARMORS[armorId];
    // Пересчёт HPmax с учётом доспеха (в BRP доспех поглощает урон, не добавляет HP)
    return true;
}

// Сериализация/десериализация
export function serializeCharacter(c) {
    return JSON.parse(JSON.stringify(c));
}
export function deserializeCharacter(obj) {
    return obj;
}

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
import { AGE_DEFAULT, AGE_MIN, AGE_MAX, applyAgeModifiers, applyAgeSkillModifiers } from './AgeRules.js';

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
    // Раунд 48 (п.2 заявки): «Исследование» — только в бою успешная проверка
    // этого навыка раскрывает параметры противника (параметры НПЦ игроку
    // больше не показываются просто так).
    { key: 'investigate', name: 'Исследование', base: 15, attr: 'INT', factor: 1, category: 'perception' },
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
// Раунд 35 (QA-фикс, история): старый комментарий смешивал домонгольские
// единицы (ногата/резана/векша) с поздними и противоречил собственным
// значениям. Для XV века счёт идёт на ДЕНЬГИ (серебро; массовый медный чекан
// появится лишь после 1654 г.). Внутренний счёт игры: 1 рубль = 2 гривны
// = 200 денег; полтина (как «полгривны») = 50; куна = 2 деньги.
export const CURRENCY = {
    denga:   { name: 'деньга',   short: 'д.',   value: 1 },     // 1 деньга — базовая серебряная
    kuna:    { name: 'куна',     short: 'к.',   value: 2 },     // 2 деньги (серебро)
    grivna:  { name: 'гривна',   short: 'гр.',  value: 100 },   // 100 денег (серебряный слиток)
    poltina: { name: 'полтина',  short: 'пол.', value: 50 },    // полгривны
    rubl:    { name: 'рубль',    short: 'руб.', value: 200 },   // 2 гривны (основная)
};

// Форматирование суммы денег (в денгах) в читаемую форму
// Раунд 15: короткие обозначения номиналов локализованы (д./гр./руб.)
import { t } from './i18n.js';
export function formatMoney(dengas) {
    if (dengas <= 0) return t('0 д.');
    const rubles = Math.floor(dengas / 200);
    const afterRubl = dengas % 200;
    const grivnas = Math.floor(afterRubl / 100);
    const afterGrivna = afterRubl % 100;
    const dengasOnly = afterGrivna;
    
    const parts = [];
    if (rubles > 0) parts.push(`${rubles} ${t('руб.')}`);
    if (grivnas > 0) parts.push(`${grivnas} ${t('гр.')}`);
    if (dengasOnly > 0) parts.push(`${dengasOnly} ${t('д.')}`);
    return parts.length > 0 ? parts.join(' ') : t('0 д.');
}

// === ПРЕДУСТАНОВЛЕННЫЕ ГЕРОИ ===
// 8 архетипов: 4 архетипа × 2 пола (мужчина и женщина)
//
// === РАУНД 32 (п.8 владельца): ЭКИПИРОВКА ВСЕХ ГОТОВЫХ ПЕРСОНАЖЕЙ ===
// (startWeapon/startArmor в каждом пресете — итог продуманного набора;
//  деньги: startDengas ± 1d10-5 при создании)
//
//  СЛЕДОПЫТ (Гаврила/Милуша): ЛУК (1d6+1, навык 55-60) + КОЖАНАЯ БРОНЯ (def 2),
//      35 д. — охотничий набор: бьёт издали точнее других, но слабый урон.
//  ВОИН (Добрыня/Рогнеда): МЕЧ (1d8+1, навык 78-80) + КОЛЬЧУГА (def 4),
//      15 д. — профессиональный ратник: против вора решает за 2-3 удара,
//      кольчуга почти не пропускает кинжальные уколы (самый лёгкий бой).
//  СЫЩИК (Ярополк/Предслава): НОЖ (1d4+1, Рукопашная 45) + ТЕГИЛЯЙ (def 1),
//      60 д. — городской дознаватель: оружием не избалован, зато красноречив
//      (Убеждение 78-80) — с вором чаще договорится, чем зарежет; самый
//      трудный бой из всех, но проходимый (см. отчёт симуляции раунда 32).
//  ПРИКЛЮЧЕНЕЦ (Ратибор/Милонега): МЕЧ (1d8+1, навык 55) + КОЖАНАЯ БРОНЯ
//      (def 2), 40 д. — универсал на прожиточном минимуме: середина во всём.
//  ВОР (враг): КРИВОЙ КИНЖАЛ (1d6+1, атака 50%, уклонение 35) + КОЖАНАЯ
//      БРОНЯ (def 2) — см. ENEMY_TEMPLATES в data/characters.js.
export const PRESET_HEROES = [
    // === СЛЕДОПЫТ ===
    {
        id: 'ranger_m',
        name: 'Гаврила',
        archetype: 'Следопыт',
        gender: 'male',
        age: 30,
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
        name: 'Милуша',
        archetype: 'Следопыт',
        gender: 'female',
        age: 22,
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
        age: 25,
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
        name: 'Рогнеда',
        archetype: 'Воин',
        gender: 'female',
        age: 24,
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
    // Раунд 22 (п.14): сыщик — «средние боевые», но с ножом против вора он
    // почти гарантированно гибли (бой 38% против уклонения вора).
    // Подравнены: CON/SIZ чуть выше (HP 11 вместо 10), Рукопашная 45.
    {
        id: 'detective_m',
        name: 'Ярополк',
        archetype: 'Сыщик',
        gender: 'male',
        age: 35,
        sprite: 'player',
        description: 'Хорошие навыки общения и поиска улик в разговорах, средние боевые.',
        stats: { STR: 45, CON: 55, SIZ: 50, DEX: 55, INT: 80, POW: 60, CHA: 70, APP: 55 },
        skillOverrides: {
            oratory: 72, persuade: 78, fast_talk: 62, intimidate: 38,
            spot: 68, track: 52, listen: 72,
            sword: 42, brawl: 45, dodge: 52, bow: 28,
            survival: 48, medicine: 42, ride: 32,
        },
        startWeapon: 'knife',
        startArmor: 'padded',
        startDengas: 60,
    },
    {
        id: 'detective_f',
        name: 'Предслава',
        archetype: 'Сыщик',
        gender: 'female',
        age: 27,
        sprite: 'npc_merchant',
        description: 'Хорошие навыки общения и поиска улик в разговорах, средние боевые.',
        stats: { STR: 40, CON: 55, SIZ: 50, DEX: 60, INT: 80, POW: 60, CHA: 75, APP: 65 },
        skillOverrides: {
            oratory: 75, persuade: 80, fast_talk: 65, intimidate: 40,
            spot: 70, track: 55, listen: 75,
            sword: 45, brawl: 45, dodge: 55, bow: 30,
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
        age: 30,
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
        age: 20,
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

// ============================================================
// РАУНД 61 (п.2 приказа владельца): паттерны случайной генерации —
// АНАЛОГИ ЧЕТЫРЁХ ГОТОВЫХ ГЕРОЕВ (Следопыт/Воин/Сыщик/Приключенец).
// Вариант «Учёный» УДАЛЕН (не по-крестьянски для Руси XV века и ломал
// строй из четырёх архетипов). Каждый паттерн берёт за основу готового
// героя того же архетипа и ДРЕЙФУЕТ все параметры в небольших пределах:
//   • характеристики ±3..12 от базовых;
//   • навыки ±2..7 от базовых;
//   • возраст — от возраста базового паттерна (±2..6 лет, 15..50);
//   • снаряжение то же, деньги ±(5..10) от базовых;
//   • имя — случайное историческое по полу (можно переименовать в превью).
// ============================================================
export const GENERATION_PATTERNS = [
    { id: 'ranger',     name: 'Следопыт',    desc: 'Разведка, следы и лук — разброс от базы', basePresetId: ['ranger_m', 'ranger_f'] },
    { id: 'warrior',    name: 'Воин',        desc: 'Меч и кольчуга — разброс от базы',       basePresetId: ['warrior_m', 'warrior_f'] },
    { id: 'detective',  name: 'Сыщик',       desc: 'Слово и дознание — разброс от базы',     basePresetId: ['detective_m', 'detective_f'] },
    { id: 'adventurer', name: 'Приключенец', desc: 'Всё в меру — разброс от базы',           basePresetId: ['adventurer_m', 'adventurer_f'] },
];

function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

// Раунд 61: old pattern-based stat rollers removed — the random hero now
// drifts from a READY PRESET (see createRandomHero below).

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

    // Возраст (раунд 44): 15..50, выбирается в генераторе персонажа.
    // Возрастные модификаторы BRP SRD применяются к характеристикам, затем
    // пересчитываются производные (HP/MP/DB/Build/MOV) — внутри функции.
    chr.age = (opts.age != null) ? opts.age : AGE_DEFAULT;
    chr.ageApplied = applyAgeModifiers(chr);

    // BRP производные (fallback для прямых вызовов без возраста):
    // applyAgeModifiers уже выставил их; здесь только страховка.
    if (chr.HPmax == null) {
        chr.HPmax = Math.ceil((chr.CON + chr.SIZ) / 10);
        chr.HP = chr.HPmax;
        chr.MPmax = Math.floor(chr.POW / 5);
        chr.MP = chr.MPmax;
        chr.DB = damageBonus(chr.STR, chr.SIZ); // {text, min, max}
        chr.Build = chr.SIZ >= 65 ? 1 : (chr.SIZ <= 35 ? -1 : 0);
        chr.MOV = 10 + (chr.DEX >= 60 ? 1 : 0) - (chr.SIZ >= 70 ? 1 : 0);
    }
    
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

    // Навыковые проценты возраста (боевые −, уклонение юнцам +, опыт зрелым +)
    chr.ageSkillApplied = applyAgeSkillModifiers(chr);

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
        age: preset.age, // все прегены — в расцвете (20–39): без возрастных штрафов
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

// ============================================================
// Создать случайно сгенерированного героя по паттерну (РАУНД 61, п.2).
// Паттерн = аналог одного из ЧЕТЫРЁХ готовых героев; все параметры
// берутся от базового прегена и дрейфуют в небольших пределах.
// ============================================================
export function createRandomHero(patternId, customName) {
    const pattern = GENERATION_PATTERNS.find(p => p.id === patternId) || GENERATION_PATTERNS[0];

    // Пол выбирается случайно; базовый преген — соответствующего пола.
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const baseId = pattern.basePresetId[gender === 'female' ? 1 : 0];
    const base = PRESET_HEROES.find(h => h.id === baseId) || PRESET_HEROES[0];

    const drift = (v, lo, hi) => Math.max(lo, Math.min(hi, v + randInt(-1, 1) * randInt(3, 12)));

    // Характеристики: базовые ±3..12 (BRP-диапазон 15..90)
    const stats = {};
    CHARACTER_KEYS.forEach(c => {
        stats[c.key] = drift(base.stats[c.key] != null ? base.stats[c.key] : 50, 15, 90);
    });

    // Навыки: базовые ±2..7 (1..95)
    const skillOverrides = {};
    Object.entries(base.skillOverrides).forEach(([key, val]) => {
        skillOverrides[key] = Math.max(1, Math.min(95, val + randInt(-1, 1) * randInt(2, 7)));
    });

    // Возраст — ОТ БАЗОВОГО ПАТТЕРНА: возраст прегена ±2..6 лет (15..50)
    const age = Math.max(AGE_MIN, Math.min(AGE_MAX, base.age + randInt(-1, 1) * randInt(2, 6)));

    // Случайное историческое имя по полу (в превью можно переименовать)
    const maleNames = ['Добрыня', 'Ярополк', 'Ратибор', 'Боян', 'Ставр', 'Мирослав', 'Твердислав', 'Гаврила'];
    const femaleNames = ['Милонега', 'Милуша', 'Рогнеда', 'Предслава', 'Любава', 'Неслава', 'Горислава', 'Вера'];
    const name = customName || (gender === 'male'
        ? maleNames[randInt(0, maleNames.length - 1)]
        : femaleNames[randInt(0, femaleNames.length - 1)]);

    return createCharacter(name, {
        ...stats,
        age,
        archetype: pattern.name,
        gender,
        sprite: gender === 'male' ? 'player' : 'npc_merchant', // РАУНД 61: старая модель, без кастомизации
        skillOverrides,
        armorId: base.startArmor,
        weaponId: base.startWeapon,
        dengas: Math.max(0, base.startDengas + randInt(-5, 10)),
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

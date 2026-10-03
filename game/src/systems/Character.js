// Модель персонажа по BRP (Basic Roleplaying Universal Game Engine SRD).
//
// РАУНД 66.71 (приказы 7, 15 владельца): ПЯТЬ характеристик — по быстрому
// старту BRP SRD (rules/ru/0200_Characters.md, «Бросьте 3D6 для
// характеристик Сила (СИЛ), Телосложение (ТЕЛ), Мощь (МОЩ), Ловкость (ЛОВ)
// и Харизма (ХАР)»): STR/CON/POW/DEX/CHA. Опциональные РАЗ/ИНТ/ВНШ ИЗЪЯТЫ,
// параметр МР (очки мощи) удалён из игры приказом 7.
// Соответствие BRP SRD:
// - 5 характеристик: STR/CON/POW/DEX/CHA (3d6×5, диапазон 15..90)
// - HP: канон (ТЕЛ+РАЗ)/2 → без РАЗ адаптировано как (CON + STR) / 10
//   (СИЛ — физический аналог массы при отсутствии РАЗ)
// - Damage Bonus (DB): канон СИЛ+РАЗ → адаптировано СИЛ+ТЕЛ (таблица та же;
//   ступени для прегенов близки к прежним, слабые герои чуть усилены)
// - Очки мощи (MP) УДАЛЕНЫ приказом 7 («удалить параметр Воля и МР»)
// - Build/MOV: Build от ТЕЛ (аналог массы), MOV без надбавки РАЗ
// - Навыки: base + (char × factor) + 1d10 (personal bonus)
// - Категории навыков: Combat / Communication / Knowledge / Manipulation / Perception / Stealth
//
// The Chronicles of Ruthenia (CR) — расширения BRP для сеттинга Руси XV века:
// - Денежная система: рубли, полтины, гривны, куны, мордки, резаны
// - Доспехи и оружие из реестра CR
// - Навык "Знахарство" (Medicine) для лечения травами
// - Навык "Выживание" (Survival) для лесных дел
//
// РАУНД 66.71 (приказы 9–14 владельца): НАВЫКИ приведены к приказу:
//   • УДАЛЕНЫ: «Верховая езда» (ride), «Исследование» (investigate),
//     «Следопытство» (track — вместо него «Внимательность»/spot),
//     «Красноречие» (oratory — вместо него «Болтовня»/fast_talk);
//   • ДОБАВЛЕН: «Ударное оружие» (blunt) — булавы, кистени, дубины, палицы.

import { rollCharacteristic, damageBonus } from './BRPEngine.js';
import { AGE_DEFAULT, AGE_MIN, AGE_MAX, applyAgeModifiers, applyAgeSkillModifiers } from './AgeRules.js';
// Раунд 66.28 (пп.5,10): стартовый колчан стрел у героев с луком
import { QUIVER_CAP } from './ammo.js';

// === ХАРАКТЕРИСТИКИ BRP (раунд 66.71: 5 штук по SRD) ===
export const CHARACTER_KEYS = [
    { key: 'STR', name: 'Сила', desc: 'Физическая мощь и сырая мышечная сила' },
    { key: 'CON', name: 'Телосложение', desc: 'Здоровье, бодрость и жизнеспособность' },
    { key: 'POW', name: 'Мощь', desc: 'Сила воли, интуиция и духовное развитие' },
    { key: 'DEX', name: 'Ловкость', desc: 'Скорость, проворство и координация' },
    { key: 'CHA', name: 'Харизма', desc: 'Первое впечатление и привлекательность' },
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
    // Раунд 66.71 (п.14): «Ударное оружие» — булавы, кистени, дубины, палицы
    // (дробящее оружие SRD; база по специализации — берём 20, от ЛОВ)
    { key: 'blunt', name: 'Ударное оружие', base: 20, attr: 'DEX', factor: 1.5, category: 'combat' },
    { key: 'dodge', name: 'Уклонение', base: 0, attr: 'DEX', factor: 0.5, derived: true, category: 'combat' },
    // Общение
    // Раунд 66.71 (п.10): «Красноречие» удалено — социальный навык похвалы
    // теперь «Болтовня» (fast_talk; SRD: Fast Talk, база 05%, Коммуникация).
    { key: 'persuade', name: 'Убеждение', base: 20, attr: 'CHA', factor: 1.5, category: 'communication' },
    { key: 'fast_talk', name: 'Болтовня', base: 10, attr: 'CHA', factor: 1.5, category: 'communication' },
    { key: 'intimidate', name: 'Запугивание', base: 15, attr: 'STR', factor: 1.5, category: 'communication' },
    // Знания
    { key: 'medicine', name: 'Знахарство', base: 5, attr: 'POW', factor: 2, category: 'knowledge' },
    { key: 'survival', name: 'Выживание', base: 20, attr: 'CON', factor: 1, category: 'knowledge' },
    // Восприятие (ИНТ изъят — интуиция идёт от МОЩИ)
    { key: 'spot', name: 'Внимательность', base: 25, attr: 'POW', factor: 1, category: 'perception' },
    // Раунд 66.71 (п.13): «Следопытство» удалено — следы ищет
    // «Внимательность» (spot; SRD: Spot, база 25%, Восприятие).
    { key: 'listen', name: 'Слух', base: 25, attr: 'CON', factor: 0.5, category: 'perception' },
    // Раунд 66.71 (п.11): «Исследование» удалено (кнопка снята ещё в 66.44).
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
    // Раунд 66.71 (п.14): ДУБИНА переведена на навык «Ударное оружие»; к ней
    // добавлены палица, булава и кистень — всё дробящее (blunt).
    club:    { id: 'club',    name: 'Дубина',          skill: 'blunt', dice: { min: 1, max: 6 }, bonus: 0, price: 2 },
    palitsa: { id: 'palitsa', name: 'Палица',          skill: 'blunt', dice: { min: 1, max: 8 }, bonus: 0, price: 6 },
    mace:    { id: 'mace',    name: 'Булава',          skill: 'blunt', dice: { min: 1, max: 6 }, bonus: 1, price: 15 },
    flail:   { id: 'flail',   name: 'Кистень',         skill: 'blunt', dice: { min: 1, max: 8 }, bonus: 1, price: 20 },
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
        stats: { STR: 45, CON: 60, POW: 55, DEX: 70, CHA: 35 },
        skillOverrides: {
            // Раунд 66.71: spot = max(старый spot, track 75); fast_talk = max(20, oratory 25)
            spot: 75, survival: 70, listen: 65,
            sword: 45, bow: 55, brawl: 40, dodge: 50,
            persuade: 30, fast_talk: 25, intimidate: 35,
            medicine: 35,
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
        stats: { STR: 40, CON: 55, POW: 55, DEX: 75, CHA: 35 },
        skillOverrides: {
            spot: 78, survival: 72, listen: 68,
            sword: 42, bow: 60, brawl: 38, dodge: 55,
            persuade: 32, fast_talk: 28, intimidate: 30,
            medicine: 38,
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
        stats: { STR: 80, CON: 75, POW: 50, DEX: 55, CHA: 35 },
        skillOverrides: {
            sword: 80, brawl: 75, spear: 70, dodge: 55, bow: 35,
            spot: 30, survival: 35, listen: 30,
            persuade: 25, fast_talk: 20, intimidate: 60,
            medicine: 15,
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
        stats: { STR: 70, CON: 70, POW: 50, DEX: 65, CHA: 40 },
        skillOverrides: {
            sword: 78, brawl: 70, spear: 68, dodge: 60, bow: 40,
            spot: 35, survival: 38, listen: 32,
            persuade: 28, fast_talk: 22, intimidate: 55,
            medicine: 18,
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
        stats: { STR: 45, CON: 55, POW: 60, DEX: 55, CHA: 70 },
        skillOverrides: {
            // Раунд 66.71: fast_talk = max(62, oratory 72); spot = max(68, track 52)
            persuade: 78, fast_talk: 72, intimidate: 38,
            spot: 68, listen: 72,
            sword: 42, brawl: 45, dodge: 52, bow: 28,
            survival: 48, medicine: 42,
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
        stats: { STR: 40, CON: 55, POW: 60, DEX: 60, CHA: 75 },
        skillOverrides: {
            persuade: 80, fast_talk: 75, intimidate: 40,
            spot: 70, listen: 75,
            sword: 45, brawl: 45, dodge: 55, bow: 30,
            survival: 50, medicine: 45,
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
        stats: { STR: 55, CON: 55, POW: 60, DEX: 60, CHA: 60 },
        skillOverrides: {
            sword: 55, bow: 50, brawl: 50, spear: 50, dodge: 50,
            persuade: 55, fast_talk: 55, intimidate: 45,
            spot: 55, listen: 55,
            survival: 55, medicine: 50,
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
        stats: { STR: 50, CON: 55, POW: 60, DEX: 62, CHA: 62 },
        skillOverrides: {
            sword: 55, bow: 52, brawl: 48, spear: 50, dodge: 52,
            persuade: 56, fast_talk: 56, intimidate: 44,
            spot: 55, listen: 56,
            survival: 55, medicine: 51,
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
    // 66.44 (приказ 9): id прегена — ключ уникального облика в WorldLook.HERO_WORLD_LOOKS
    chr.presetId = opts.presetId || null;

    // Возраст (раунд 44): 15..50, выбирается в генераторе персонажа.
    // Возрастные модификаторы BRP SRD применяются к характеристикам, затем
    // пересчитываются производные (HP/DB/Build/MOV) — внутри функции.
    chr.age = (opts.age != null) ? opts.age : AGE_DEFAULT;
    chr.ageApplied = applyAgeModifiers(chr);

    // BRP производные (fallback для прямых вызовов без возраста):
    // applyAgeModifiers уже выставил их; здесь только страховка.
    // Раунд 66.71: канон (CON+SIZ)/10 → (CON+STR)/10; очки мощи (MP)
    // УДАЛЕНЫ приказом 7; DB — СИЛ+ТЕЛ; Build — от ТЕЛ; MOV без РАЗ.
    if (chr.HPmax == null) {
        chr.HPmax = Math.ceil((chr.CON + chr.STR) / 10);
        chr.HP = chr.HPmax;
        chr.DB = damageBonus(chr.STR, chr.CON); // {text, min, max}
        chr.Build = chr.CON >= 65 ? 1 : (chr.CON <= 35 ? -1 : 0);
        chr.MOV = 10 + (chr.DEX >= 60 ? 1 : 0);
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
    // Раунд 66.28 (пп.5,10): колчан стрел (0..10); герой со стартовым луком
    // получает ПОЛНЫЙ колчан, остальные — пустой (стрелы продают пачками по 10)
    chr.quiver = (opts.quiver != null) ? opts.quiver
        : (chr.weaponId === 'bow' ? QUIVER_CAP : 0);
    
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
        presetId: preset.id, // 66.44 (п.9): уникальный облик каждого прегена
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

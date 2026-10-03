// ============================================================
// Раунд 47 (пп.3,5 заявки): БАЗА ДАННЫХ ПАРАМЕТРОВ ЖИТЕЛЕЙ.
//
// Раунд 66.71 (приказы 7,15 владельца): У КАЖДОГО жителя — те же 5
// характеристик, что и у героя (BRP SRD: СИЛ/ТЕЛ/МОЩ/ЛОВ/ХАР);
// РАЗ/ИНТ/ВНШ изъяты, МР удалён из игры вовсе.
// НАВЫКИ по-прежнему упрощены: житель умеет только то, чем живёт (п.3
// заявки: «удалив у НПЦ параметры, которые они не могут использовать»).
//
// Соответствие базе данных игры:
//  - характеристики — те же ключи, что в systems/Character.js
//    (CHARACTER_KEYS: STR/CON/POW/DEX/CHA);
//  - навыки — ТОЛЬКО ключи из SKILLS (systems/Character.js):
//    sword/bow/spear/brawl/blunt/persuade/fast_talk/intimidate/
//    medicine/survival/spot/listen (66.71: oratory/ride/track/investigate удалены);
//  - HP жителя = (CON + STR) / 10 — адаптация BRP без РАЗ (как у героя).
//
// Аудит (п.5 заявки) проверяет: полноту характеристик, диапазоны,
// соответствие формулам BRP, а также то, что VILLAGER_COMBAT берёт
// параметры ОТСЮДА (единый источник правды — см. characters.js).
//
// Раунд 48 (пп.1,2 заявки):
//  - возрастные изменения ХАРАКТЕРИСТИК применяются СРАЗУ после определения
//    возраста (applyAgingToStats) — канонические параметры жителя = база +
//    возрастная строка; эти же значения видны при успешном «Исследовании»
//    в бою (formatNpcStatsLine) и используются в боевой единице;
//  - ИГРОКУ параметры жителей больше не показываются (строка параметров
//    в домах удалена — осталась только одежда/оружие, см. characters.js);
//  - добавлено ИССЛЕДОВАНИЕ (проверка в бою, раскрывающая параметры).
// ============================================================

import { createCharacter, SKILLS } from '../systems/Character.js';
import { applyAgingToStats, getAgeRow, COMBAT_SKILLS, WISDOM_SKILLS } from '../systems/AgeRules.js';

// --- Характеристики: [СИЛ, ТЕЛ, МОЩ, ЛОВ, ХАР] (раунд 66.71: 5 штук по SRD) ---
const S = (STR, CON, POW, DEX, CHA) =>
    ({ STR, CON, POW, DEX, CHA });

// --- Навыки: только используемые жителем (ключ → значение, %) ---
// Кузнец: рука от молота (Рукопашная 45 = его attackSkill в бою).
const SMITH_SKILLS = { brawl: 45, intimidate: 40, spot: 35, listen: 35 };
// Ученик — МОЛОЖЕ и СЛАБЕЕ мастера (Рукопашная 30 против 45 у мастера).
const APPRENTICE_SKILLS = { brawl: 30, dodge: 30, spot: 35, listen: 35 };
// Ребёночек: кулачки слабые, но глаза и уши острые, увернуться мастак.
const kidSkills = (brawl) => ({ brawl, dodge: 45, spot: 40, listen: 40 });
// Хозяйка дома: язык подвешен, за порядком следит.
const homemakerSkills = (persuade) => ({ persuade, spot: 35, listen: 40 });

export const NPC_STAT_BLOCKS = {
    // === ЗНАТНЫЕ ЖИТЕЛИ ===
    elder: {
        name: 'Староста Мирослав',
        stats: S(50, 50, 65, 40, 60),
        skills: { fast_talk: 55, persuade: 50, intimidate: 45, brawl: 35, spot: 40, listen: 45 },
    },
    priest: {
        name: 'Отец Савватий',
        stats: S(40, 45, 75, 40, 65),
        skills: { fast_talk: 60, persuade: 55, medicine: 45, spot: 40, listen: 45 },
    },
    elder_wife: {
        name: 'Любава',
        stats: S(30, 40, 60, 35, 50),
        skills: homemakerSkills(45),
    },

    // === РЕМЕСЛЕННИКИ ===
    blacksmith: {
        name: 'Кузнец Данила',
        stats: S(65, 60, 50, 45, 40),
        skills: SMITH_SKILLS,
    },
    apprentice: {
        name: 'Ученик кузнеца',
        stats: S(40, 45, 45, 50, 45),
        skills: APPRENTICE_SKILLS,
    },
    peasant1: {
        name: 'Мельник Авдей',
        stats: S(55, 55, 50, 50, 45),
        skills: { brawl: 40, persuade: 35, survival: 40, spot: 40, listen: 40 },
    },
    carpenter1: {
        name: 'Плотник Микула',
        stats: S(60, 55, 45, 50, 40),
        skills: { brawl: 45, intimidate: 35, spot: 35, listen: 35 },
    },
    potter1: {
        name: 'Гончар Игнат',
        stats: S(55, 50, 45, 55, 40),
        skills: { brawl: 40, persuade: 35, spot: 35, listen: 35 },
    },
    weaver1: {
        name: 'Ткачиха Пелагея',
        stats: S(35, 45, 55, 45, 45),
        skills: homemakerSkills(40),
    },

    // === ПРОМЫСЛОВИКИ ===
    hunter: {
        name: 'Охотник',
        stats: S(55, 55, 50, 60, 40),
        // Раунд 66.71: track слит в spot (max(55, 60) = 60)
        skills: { bow: 55, survival: 55, spot: 60, listen: 50, brawl: 35 },
    },
    fisherman: {
        name: 'Рыбак Ерёма',
        stats: S(50, 55, 45, 50, 40),
        skills: { survival: 45, spot: 50, listen: 45, brawl: 35 },
    },
    beekeeper1: {
        name: 'Пахарь Тарас',
        stats: S(60, 60, 45, 45, 40),
        skills: { brawl: 45, survival: 40, intimidate: 35, spot: 35, listen: 35 },
    },
    shepherd1: {
        name: 'Пастух Сила',
        stats: S(50, 55, 45, 50, 40),
        skills: { survival: 45, spot: 40, listen: 40, brawl: 35 },
    },
    shepherd2: {
        name: 'Пастушка Настасья',
        stats: S(40, 50, 50, 50, 45),
        skills: { survival: 40, spot: 40, listen: 40 },
    },
    shepherd_boy: {
        name: 'Пастушок Ивашка',
        stats: S(40, 45, 45, 60, 40),
        skills: { brawl: 25, dodge: 40, survival: 35, spot: 40, listen: 40 },
    },
    widow: {
        name: 'Пасечница Марфа',
        stats: S(35, 45, 60, 40, 50),
        skills: { persuade: 40, medicine: 30, survival: 45, spot: 40, listen: 40 },
    },

    // === ЛЕКАРЬ И СЛУГИ ПОРЯДКА ===
    healer: {
        name: 'Знахарка Февронья',
        stats: S(25, 35, 80, 30, 55),
        skills: { medicine: 70, persuade: 45, spot: 45, listen: 45 },
    },
    guard: {
        name: 'Стражник',
        stats: S(60, 60, 45, 55, 40),
        skills: { spear: 45, brawl: 40, dodge: 35, intimidate: 40, spot: 40 },
    },

    // === ХОЗЯЕВА И ХОЗЯЙКИ ===
    tavernkeeper: {
        name: 'Тавернщик',
        stats: S(55, 55, 50, 45, 55),
        skills: { persuade: 45, fast_talk: 40, brawl: 40, spot: 35, listen: 35 },
    },
    beekeeper_wife: {
        name: 'Фёкла',
        stats: S(40, 50, 50, 45, 45),
        skills: { persuade: 35, survival: 40, spot: 35, listen: 40 },
    },
    carpenter_wife: {
        name: 'Матрёна',
        stats: S(40, 50, 50, 45, 45),
        skills: homemakerSkills(35),
    },
    potter_wife: {
        name: 'Анна',
        stats: S(35, 45, 50, 50, 50),
        skills: homemakerSkills(40),
    },
    fisher_wife: {
        name: 'Домна',
        stats: S(35, 50, 50, 45, 45),
        skills: { persuade: 35, survival: 35, spot: 35, listen: 40 },
    },

    // === РАУНД 51 (п.11 заявки): ВОСТОЧНАЯ СЛОБОДА — лавки и новые дома ===
    // Снедница Прасковья: за прилавком всю жизнь — вес и цена на глаз.
    grocer: {
        name: 'Прасковья',
        stats: S(35, 50, 55, 45, 60),
        skills: { persuade: 45, fast_talk: 40, spot: 40, listen: 40 },
    },
    // Мясник Потап: рука от тесака, спина от туш.
    butcher: {
        name: 'Потап',
        stats: S(65, 60, 50, 40, 40),
        skills: { brawl: 50, intimidate: 40, spot: 30, listen: 30 },
    },
    // Торгарь Аверьян: знает цену всякой вещи, язык подвешен ловко.
    peddler: {
        name: 'Аверьян',
        stats: S(45, 45, 50, 50, 60),
        skills: { persuade: 50, fast_talk: 45, brawl: 30, spot: 40, listen: 40 },
    },
    // Сапожник Нефёд: руки в шиле и дёгте, в драку не лезет.
    shoemaker: {
        name: 'Нефёд',
        stats: S(45, 50, 50, 55, 45),
        skills: { brawl: 30, dodge: 30, spot: 40, listen: 40 },
    },
    // Агафья, жена сапожника: хозяйка при лавке.
    shoemaker_wife: {
        name: 'Агафья',
        stats: S(40, 50, 55, 45, 50),
        skills: homemakerSkills(40),
    },
    // Дровосек Горазд: топор за поясом, слух лесника.
    woodcutter: {
        name: 'Горазд',
        stats: S(70, 60, 45, 50, 35),
        skills: { brawl: 55, intimidate: 40, survival: 45, spot: 40, listen: 45 },
    },
    // Раунд 63 (п.1): Степан — крестьянин нового дома на месте овчарни.
    peasant2: {
        name: 'Степан',
        stats: S(60, 60, 50, 45, 45),
        skills: { brawl: 40, persuade: 35, survival: 45, spot: 35, listen: 40 },
    },
    // Арина, жена Степана: хозяйка при скотине и огороде.
    peasant2_wife: {
        name: 'Арина',
        stats: S(40, 50, 55, 45, 50),
        skills: homemakerSkills(40),
    },

    // === ДЕТИ (п.6 заявки раунда 44: с 6 лет) — слабые, но верткие ===
    kid1: { stats: S(30, 35, 50, 55, 45), skills: kidSkills(20) },
    kid2: { stats: S(25, 35, 55, 55, 45), skills: kidSkills(18) },
    kid3: { stats: S(25, 30, 50, 55, 45), skills: kidSkills(16) },
    kid4: { stats: S(20, 30, 50, 50, 45), skills: kidSkills(15) },
    kid5: { stats: S(20, 30, 50, 50, 45), skills: kidSkills(15) },
    kid6: { stats: S(15, 30, 50, 50, 45), skills: kidSkills(15) },
    kid7: { stats: S(20, 30, 45, 50, 45), skills: kidSkills(15) },
    kid8: { stats: S(20, 30, 50, 55, 45), skills: kidSkills(18) },
    kid9: { stats: S(25, 35, 55, 55, 45), skills: kidSkills(15) },
};

// Ключи навыков по категориям — для проверки «навык против навыка»
// (п.4 заявки раунда 48): если житель не владеет навыком, проверка идёт
// «характеристика против характеристики» (замена «сопротивлений»).
const RESISTANCE_BY_SKILL = {
    // Боевые — от Ловкости (увернуться/сопротивляться физически);
    // blunt («Ударное оружие») — тоже от Ловкости
    sword: 'DEX', bow: 'DEX', spear: 'DEX', brawl: 'STR', blunt: 'DEX', dodge: 'DEX',
    // Общение — от Харизмы (запугивание — ещё и от Силы)
    persuade: 'CHA', fast_talk: 'CHA', intimidate: 'STR',
    // Знания и восприятие — от Мощи (ИНТ изъят в 66.71; интуиция от МОЩИ)
    medicine: 'POW', survival: 'POW', spot: 'POW', listen: 'POW',
};

/** Возраст жителя (у случайных незнакомцев — расцвет сил). */
function npcAgeOf(npc) {
    const a = Number(npc && npc.age);
    return Number.isFinite(a) && a > 0 ? a : 30;
}

/**
 * Раунд 48 (п.1 заявки): КАНОНИЧЕСКИЕ параметры жителя — база данных
 * СРАЗУ с возрастными изменениями характеристик (как у героя: модификаторы
 * BRP применяются сразу после определения возраста, а не «к бою»).
 */
export function getNpcResolvedStats(npc) {
    const block = NPC_STAT_BLOCKS[npc && npc.id] || null;
    if (!block) return null;
    return applyAgingToStats(block.stats, npcAgeOf(npc));
}

/**
 * Возрастные проценты НАВЫКА жителя (боевые/уклонение/знания — как у героя).
 */
function ageSkillMod(skillKey, age) {
    const row = getAgeRow(age);
    if (skillKey === 'dodge') return row.dodgeMod;
    if (COMBAT_SKILLS.includes(skillKey)) return row.combatMod;
    if (WISDOM_SKILLS.includes(skillKey)) return row.wisdomMod;
    return 0;
}

/** Блок жителя (или null — НПЦ вне базы, например случайный незнакомец). */
export function getNpcStatBlock(npcId) {
    return NPC_STAT_BLOCKS[npcId] || null;
}

/**
 * Значение того же параметра жителя для встречной проверки (п.4):
 * «навык против навыка», а если житель не владеет навыком —
 * «характеристика против характеристики» (боевые от Ловкости/Силы,
 * общение от Обаяния, знания от Интеллекта). Возраст уже запечён.
 * Возвращает { value, ruName, isSkill }.
 */
export function getNpcOpposition(npc, skillKey) {
    if (!npc) return { value: 50, ruName: 'Упорство', ruNameGen: 'Упорства', isSkill: false };
    const block = NPC_STAT_BLOCKS[npc.id] || null;
    const age = npcAgeOf(npc);
    const direct = block && block.skills && block.skills[skillKey];
    if (typeof direct === 'number') {
        const ruName = ruSkillName(skillKey);
        return {
            value: Math.max(10, Math.min(70, direct + ageSkillMod(skillKey, age))),
            ruName,
            ruNameGen: ruGenitive(ruName),
            isSkill: true,
        };
    }
    // Навыка нет — проверка «характеристика против характеристики»
    const attrKey = RESISTANCE_BY_SKILL[skillKey] || 'INT';
    const stats = getNpcResolvedStats(npc) || {};
    const val = stats[attrKey] || 50;
    const ruName = RU_STAT_FULL[attrKey] || attrKey;
    return { value: Math.max(10, Math.min(70, val)), ruName, ruNameGen: ruGenitive(ruName), isSkill: false };
}

/** Совместимость (раунд 47): то же, что getNpcOpposition().value. */
export function getNpcSkillResistance(npc, skillKey) {
    return getNpcOpposition(npc, skillKey).value;
}

/**
 * Боевая единица жителя из ЕГО базы параметров (п.3 заявки).
 * Полный набор характеристик как у героя; навыки — только используемые.
 * (Раунд 66.71: МР удалён из игры — параметра больше нет ни у кого.)
 */
export function createNpcCharacter(npc) {
    const block = (npc && NPC_STAT_BLOCKS[npc.id]) || null;
    // Раунд 66.71: 5 характеристик (fallback для случайных незнакомцев)
    const stats = block ? block.stats : { STR: 50, CON: 50, POW: 50, DEX: 50, CHA: 45 };
    const usable = block ? Object.keys(block.skills) : ['brawl', 'dodge', 'spot', 'listen'];
    // Детерминированные значения навыков — только из блока жителя
    const overrides = {};
    SKILLS.forEach(def => {
        const v = block && block.skills[def.key];
        if (typeof v === 'number') overrides[def.key] = v;
    });
    const c = createCharacter((npc && npc.name) || 'Житель', {
        ...stats,
        age: (npc && npc.age) || 30,
        gender: (npc && npc.gender) || 'male',
        skillOverrides: overrides,
    });
    // УПРОЩЕНИЕ (п.3 заявки): удаляем у НПЦ навыки, которые они не используют
    Object.keys(c.skills).forEach(k => {
        if (!usable.includes(k)) delete c.skills[k];
    });
    c.isVillager = true;
    return c;
}

/**
 * Строка параметров жителя для показа в игре (п.3 заявки: параметры
 * как у игрока — видны тем же способом, что и у героя).
 * Раунд 66.71: 5 характеристик (МОЩ вместо ВОЛ).
 * Пример: «СИЛ 65 · ТЕЛ 60 · МОЩ 50 · ЛОВ 45 · ХАР 40»
 *         «Навыки: Рукопашная 45, Запугивание 40, Внимательность 35, Слух 35»
 */
const STAT_SHORT = {
    STR: 'СИЛ', CON: 'ТЕЛ', POW: 'МОЩ', DEX: 'ЛОВ', CHA: 'ХАР',
};
const SKILL_RU = {
    sword: 'Владение мечом', bow: 'Лук', spear: 'Копьё', brawl: 'Рукопашная', blunt: 'Ударное оружие', dodge: 'Уклонение',
    persuade: 'Убеждение', fast_talk: 'Болтовня', intimidate: 'Запугивание',
    medicine: 'Знахарство', survival: 'Выживание',
    spot: 'Внимательность', listen: 'Слух',
    // Патч 66.74: новая волна навыков (встречные проверки/подписи)
    stealth: 'Скрадывание', fishing: 'Рыболовство', beekeeping: 'Бортничество',
    literacy: 'Грамота', track: 'Следопытство', commerce: 'Сметка',
    performance: 'Скоморошество', craft: 'Ремесло', smithing: 'Кузнечное дело', lockpicking: 'Взлом',
    // Патч 66.76: самострел, мельница, ткачество, плотницкое
    crossbow: 'Стрельба из самострела', milling: 'Мельничное дело',
    weaving: 'Ткачество', carpentry: 'Плотницкое дело',
};
const RU_STAT_FULL = {
    STR: 'Сила', CON: 'Телосложение', POW: 'Мощь', DEX: 'Ловкость', CHA: 'Харизма',
};

/** Русское название навыка (для бою: «Рукопашная — 40»). */
export function ruSkillName(key) { return SKILL_RU[key] || key; }

// Родительный падеж для подписей проверок: «против Обаяния жителя»,
// «против Рукопашной вора» (без склонения подпись звучит безграмотно).
const RU_GENITIVE = {
    'Владение мечом': 'Владения мечом', 'Лук': 'Лука', 'Копьё': 'Копья',
    'Рукопашная': 'Рукопашной', 'Ударное оружие': 'Ударного оружия', 'Уклонение': 'Уклонения',
    'Убеждение': 'Убеждения', 'Болтовня': 'Болтовни',
    'Запугивание': 'Запугивания', 'Знахарство': 'Знахарства', 'Выживание': 'Выживания',
    'Внимательность': 'Внимательности', 'Слух': 'Слуха',
    'Сила': 'Силы', 'Телосложение': 'Телосложения', 'Мощь': 'Мощи',
    'Ловкость': 'Ловкости', 'Харизма': 'Харизмы', 'Упорство': 'Упорства',
    // Патч 66.74: родительный падеж новых навыков (подписи проверок)
    'Скрадывание': 'Скрадывания', 'Рыболовство': 'Рыболовства', 'Бортничество': 'Бортничества',
    'Грамота': 'Грамоты', 'Следопытство': 'Следопытства', 'Сметка': 'Сметки',
    'Скоморошество': 'Скоморошества', 'Ремесло': 'Ремесла', 'Кузнечное дело': 'Кузнечного дела', 'Взлом': 'Взлома',
};
export function ruGenitive(ruName) { return RU_GENITIVE[ruName] || ruName; }

/**
 * Строка параметров жителя — раскрывается ТОЛЬКО успешной проверкой
 * «Исследование» в бою (раунд 48, пп.2,3: игрок больше НЕ видит параметры
 * жителей просто так — в домах видна лишь одежда и оружие в руках).
 * Параметры — канонические (база + возраст, п.1 заявки раунда 48).
 * Пример: «СИЛ 62 · ТЕЛ 57 · … / Навыки: Рукопашная 40, …»
 */
export function formatNpcStatsLine(npc) {
    const block = (npc && NPC_STAT_BLOCKS[npc.id]) || null;
    if (!block) return '';
    const stats = getNpcResolvedStats(npc);
    const statsText = Object.keys(STAT_SHORT)
        .map(k => `${STAT_SHORT[k]} ${stats[k]}`)
        .join(' · ');
    const age = npcAgeOf(npc);
    const skills = Object.entries(block.skills)
        .map(([k, v]) => `${SKILL_RU[k] || k} ${Math.max(1, Math.min(99, v + ageSkillMod(k, age)))}`)
        .join(', ');
    const hp = Math.ceil((stats.CON + stats.STR) / 10);
    return `❤${hp} ${statsText}\nНавыки: ${skills}`;
}

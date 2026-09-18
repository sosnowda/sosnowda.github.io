// ============================================================
// Раунд 47 (пп.3,5 заявки): БАЗА ДАННЫХ ПАРАМЕТРОВ ЖИТЕЛЕЙ.
//
// У КАЖДОГО жителя деревни — те же характеристики, что и у героя
// (BRP SRD: СИЛ/ТЕЛ/РАЗ/ЛОВ/ИНТ/ВОЛ/ОБА/ВНШ — 8 штук, диапазон 15..90),
// но НАВЫКИ упрощены: житель умеет только то, чем живёт (п.3 заявки:
// «удалив у НПЦ параметры, которые они не могут использовать»).
//
// Соответствие базе данных игры:
//  - характеристики — те же ключи, что в systems/Character.js
//    (CHARACTER_KEYS: STR/CON/SIZ/DEX/INT/POW/CHA/APP);
//  - навыки — ТОЛЬКО ключи из SKILLS (systems/Character.js):
//    sword/bow/spear/brawl/dodge/oratory/persuade/fast_talk/intimidate/
//    medicine/survival/ride/spot/track/listen;
//  - HP жителя = (CON + SIZ) / 10 — та же формула BRP, что у героя;
//  - МАГИИ у жителей нет: MP = 0 (параметр, который они не могут
//    использовать, — удалён, см. getNpcCharacter).
//
// Аудит (п.5 заявки) проверяет: полноту характеристик, диапазоны,
// соответствие формулам BRP, а также то, что VILLAGER_COMBAT берёт
// параметры ОТСЮДА (единый источник правды — см. characters.js).
// ============================================================

import { createCharacter, SKILLS } from '../systems/Character.js';

// --- Характеристики: [СИЛ, ТЕЛ, РАЗ, ЛОВ, ИНТ, ВОЛ, ОБА, ВНШ] ---
const S = (STR, CON, SIZ, DEX, INT, POW, CHA, APP) =>
    ({ STR, CON, SIZ, DEX, INT, POW, CHA, APP });

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
        stats: S(50, 50, 60, 40, 60, 65, 60, 45),
        skills: { oratory: 55, persuade: 50, intimidate: 45, brawl: 35, spot: 40, listen: 45 },
    },
    priest: {
        name: 'Отец Савватий',
        stats: S(40, 45, 50, 40, 70, 75, 65, 50),
        skills: { oratory: 60, persuade: 55, medicine: 45, spot: 40, listen: 45 },
    },
    elder_wife: {
        name: 'Любава',
        stats: S(30, 40, 45, 35, 55, 60, 50, 40),
        skills: homemakerSkills(45),
    },

    // === РЕМЕСЛЕННИКИ ===
    blacksmith: {
        name: 'Кузнец Данила',
        stats: S(65, 60, 70, 45, 50, 50, 40, 40),
        skills: SMITH_SKILLS,
    },
    apprentice: {
        name: 'Ученик кузнеца',
        stats: S(40, 45, 40, 50, 45, 45, 45, 50),
        skills: APPRENTICE_SKILLS,
    },
    peasant1: {
        name: 'Мельник Авдей',
        stats: S(55, 55, 55, 50, 55, 50, 45, 40),
        skills: { brawl: 40, persuade: 35, survival: 40, spot: 40, listen: 40 },
    },
    carpenter1: {
        name: 'Плотник Микула',
        stats: S(60, 55, 55, 50, 50, 45, 40, 40),
        skills: { brawl: 45, intimidate: 35, spot: 35, listen: 35 },
    },
    potter1: {
        name: 'Гончар Игнат',
        stats: S(55, 50, 50, 55, 55, 45, 40, 40),
        skills: { brawl: 40, persuade: 35, spot: 35, listen: 35 },
    },
    weaver1: {
        name: 'Ткачиха Пелагея',
        stats: S(35, 45, 45, 45, 55, 55, 45, 45),
        skills: homemakerSkills(40),
    },

    // === ПРОМЫСЛОВИКИ ===
    hunter: {
        name: 'Охотник',
        stats: S(55, 55, 50, 60, 60, 50, 40, 40),
        skills: { bow: 55, track: 60, survival: 55, spot: 55, listen: 50, brawl: 35 },
    },
    fisherman: {
        name: 'Рыбак Ерёма',
        stats: S(50, 55, 50, 50, 50, 45, 40, 40),
        skills: { survival: 45, spot: 50, listen: 45, brawl: 35 },
    },
    beekeeper1: {
        name: 'Пахарь Тарас',
        stats: S(60, 60, 65, 45, 45, 45, 40, 35),
        skills: { brawl: 45, survival: 40, intimidate: 35, spot: 35, listen: 35 },
    },
    shepherd1: {
        name: 'Пастух Сила',
        stats: S(50, 55, 50, 50, 45, 45, 40, 40),
        skills: { survival: 45, ride: 40, spot: 40, listen: 40, brawl: 35 },
    },
    shepherd2: {
        name: 'Пастушка Настасья',
        stats: S(40, 50, 45, 50, 45, 50, 45, 45),
        skills: { survival: 40, ride: 40, spot: 40, listen: 40 },
    },
    shepherd_boy: {
        name: 'Пастушок Ивашка',
        stats: S(40, 45, 35, 60, 50, 45, 40, 45),
        skills: { brawl: 25, dodge: 40, survival: 35, spot: 40, listen: 40 },
    },
    widow: {
        name: 'Пасечница Марфа',
        stats: S(35, 45, 45, 40, 60, 60, 50, 40),
        skills: { persuade: 40, medicine: 30, survival: 45, spot: 40, listen: 40 },
    },

    // === ЛЕКАРЬ И СЛУГИ ПОРЯДКА ===
    healer: {
        name: 'Знахарка Февронья',
        stats: S(25, 35, 40, 30, 75, 80, 55, 40),
        skills: { medicine: 70, persuade: 45, spot: 45, listen: 45 },
    },
    guard: {
        name: 'Стражник',
        stats: S(60, 60, 60, 55, 45, 45, 40, 45),
        skills: { spear: 45, brawl: 40, dodge: 35, intimidate: 40, spot: 40 },
    },

    // === ХОЗЯЕВА И ХОЗЯЙКИ ===
    tavernkeeper: {
        name: 'Тавернщик',
        stats: S(55, 55, 60, 45, 50, 50, 55, 45),
        skills: { persuade: 45, fast_talk: 40, brawl: 40, spot: 35, listen: 35 },
    },
    beekeeper_wife: {
        name: 'Фёкла',
        stats: S(40, 50, 45, 45, 50, 50, 45, 45),
        skills: { persuade: 35, survival: 40, spot: 35, listen: 40 },
    },
    carpenter_wife: {
        name: 'Матрёна',
        stats: S(40, 50, 45, 45, 50, 50, 45, 45),
        skills: homemakerSkills(35),
    },
    potter_wife: {
        name: 'Анна',
        stats: S(35, 45, 40, 50, 50, 50, 50, 50),
        skills: homemakerSkills(40),
    },
    fisher_wife: {
        name: 'Домна',
        stats: S(35, 50, 45, 45, 50, 50, 45, 45),
        skills: { persuade: 35, survival: 35, spot: 35, listen: 40 },
    },

    // === ДЕТИ (п.6 заявки раунда 44: с 6 лет) — слабые, но верткие ===
    kid1: { stats: S(30, 35, 30, 55, 50, 50, 45, 50), skills: kidSkills(20) },
    kid2: { stats: S(25, 35, 30, 55, 50, 55, 45, 50), skills: kidSkills(18) },
    kid3: { stats: S(25, 30, 25, 55, 45, 50, 45, 50), skills: kidSkills(16) },
    kid4: { stats: S(20, 30, 25, 50, 45, 50, 45, 50), skills: kidSkills(15) },
    kid5: { stats: S(20, 30, 25, 50, 40, 50, 45, 45), skills: kidSkills(15) },
    kid6: { stats: S(15, 30, 20, 50, 40, 50, 45, 50), skills: kidSkills(15) },
    kid7: { stats: S(20, 30, 20, 50, 40, 45, 45, 45), skills: kidSkills(15) },
    kid8: { stats: S(20, 30, 25, 55, 45, 50, 45, 50), skills: kidSkills(18) },
    kid9: { stats: S(25, 35, 25, 55, 50, 55, 45, 55), skills: kidSkills(15) },
};

// Ключи навыков по категориям — для сопротивления НПЦ «тем же параметром»
// (п.4 заявки): если житель не владеет навыком, сопротивление считается
// от ЕГО характеристик (замена того же параметра — честная упрощёнка).
const RESISTANCE_BY_SKILL = {
    // Боевые — от Ловкости (увернуться/сопротивляться физически)
    sword: 'DEX', bow: 'DEX', spear: 'DEX', brawl: 'STR', dodge: 'DEX',
    // Общение — от Обаяния (запугивание — ещё и от Силы)
    oratory: 'CHA', persuade: 'CHA', fast_talk: 'CHA', intimidate: 'STR',
    // Знания и восприятие — от Интеллекта
    medicine: 'INT', survival: 'INT', ride: 'DEX', spot: 'INT', track: 'INT', listen: 'INT',
};

/** Блок жителя (или null — НПЦ вне базы, например случайный незнакомец). */
export function getNpcStatBlock(npcId) {
    return NPC_STAT_BLOCKS[npcId] || null;
}

/**
 * Значение навыка жителя (п.4 заявки: «такой же параметр НПЦ»).
 * Если житель не владеет навыком — сопротивление от характеристики:
 * боевые от Ловкости/Силы, общение от Обаяния, знания от Интеллекта.
 * Возвращает значение в процентах (10..70).
 */
export function getNpcSkillResistance(npc, skillKey) {
    if (!npc) return 50;
    const block = NPC_STAT_BLOCKS[npc.id] || NPC_STAT_BLOCKS[npcIdOf(npc)];
    const direct = block && block.skills && block.skills[skillKey];
    if (typeof direct === 'number') return Math.max(10, Math.min(70, direct));
    // Навыка нет — сопротивляемся «тем же параметром» от характеристики
    const attrKey = RESISTANCE_BY_SKILL[skillKey] || 'INT';
    const val = (block && block.stats ? block.stats[attrKey] : 50) || 50;
    return Math.max(10, Math.min(70, Math.round(val / 5) * 5));
}

function npcIdOf(npc) { return npc && npc.id; }

/**
 * Боевая единица жителя из ЕГО базы параметров (п.3 заявки).
 * Полный набор характеристик как у героя; навыки — только используемые;
 * MP = 0 (жители магией не владеют — параметр удалён).
 */
export function createNpcCharacter(npc) {
    const block = (npc && NPC_STAT_BLOCKS[npc.id]) || null;
    const stats = block ? block.stats : { STR: 50, CON: 50, SIZ: 50, DEX: 50, INT: 50, POW: 50, CHA: 45, APP: 45 };
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
    // Магии у жителей нет: MP — параметр, который они не могут использовать
    c.MP = 0;
    c.MPmax = 0;
    c.isVillager = true;
    return c;
}

/**
 * Строка параметров жителя для показа в игре (п.3 заявки: параметры
 * как у игрока — видны тем же способом, что и у героя).
 * Пример: «СИЛ 65 · ТЕЛ 60 · РАЗ 70 · ЛОВ 45 · ИНТ 50 · ВОЛ 50 · ОБА 40 · ВНШ 40»
 *         «Навыки: Рукопашная 45, Запугивание 40, Внимательность 35, Слух 35»
 */
const STAT_SHORT = {
    STR: 'СИЛ', CON: 'ТЕЛ', SIZ: 'РАЗ', DEX: 'ЛОВ',
    INT: 'ИНТ', POW: 'ВОЛ', CHA: 'ОБА', APP: 'ВНШ',
};
const SKILL_RU = {
    sword: 'Меч', bow: 'Лук', spear: 'Копьё', brawl: 'Рукопашная', dodge: 'Уклонение',
    oratory: 'Красноречие', persuade: 'Убеждение', fast_talk: 'Болтовня', intimidate: 'Запугивание',
    medicine: 'Знахарство', survival: 'Выживание', ride: 'Верховая езда',
    spot: 'Внимательность', track: 'Следопытство', listen: 'Слух',
};

export function formatNpcStatsLine(npc) {
    const block = (npc && NPC_STAT_BLOCKS[npc.id]) || null;
    if (!block) return '';
    const stats = Object.keys(STAT_SHORT)
        .map(k => `${STAT_SHORT[k]} ${block.stats[k]}`)
        .join(' · ');
    const skills = Object.entries(block.skills)
        .map(([k, v]) => `${SKILL_RU[k] || k} ${v}`)
        .join(', ');
    const hp = Math.ceil((block.stats.CON + block.stats.SIZ) / 10);
    return `❤${hp} ${stats}\nНавыки: ${skills}`;
}

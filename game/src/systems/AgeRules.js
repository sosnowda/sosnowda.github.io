// Возрастные правила персонажа — по опциональному правилу старения BRP SRD
// (Basic Roleplaying Universal Game Engine, «Aging»), на которое опирается
// ролевая система ChroniclesRuthenia (docs/BRP_QUICKSTART_RU.md:
// «возраст и статус раздельно», список опциональных правил SRD — старение).
//
// Требования владельца (раунд 44):
// - возраст игрока: 15..50 лет, выбирается при генерации персонажа;
// - чем старее персонаж — тем больше штрафы;
// - данные модификаторов — из ролевой системы (BRP SRD aging table).
//
// Соответствие BRP SRD:
//  - 15–19: тело ещё растёт — СИЛ −5, РАЗМ −5 (юноша слабее и мельче взрослого);
//    ЛОВ +5 — природная проворство юности (SRD допускает +5 DEX молодым);
//  - 20–39: расцвет сил — без модификаторов;
//  - 40–49: СИЛ/КОН/ЛОВ −3..−4 за полдекады (SRD: 40-м −3, 50-м −6, 60-м −9…),
//    опыт компенсирует: категории «Общение» и «Знания» +5 (в SRD растёт
//    образовательный блок);
//  - 50 и старше: СИЛ/КОН/ЛОВ −5 и далее −1 за полдекады (SRD: −5 к 50-м,
//    −6 к 55-м, −7 к 60-м…), боевые −10% и далее −2% за полдекады, опыт +10% и далее.
//
// Раунд 48 (п.1 заявки): возрастные изменения применяются СРАЗУ после
// генерации персонажа, после определения возраста — и у героя, и у НПЦ.
// Жители живут до 70 лет (раунд 44), поэтому таблица расширена с 50 до 70:
// раньше возрасты 51+ ошибочно попадали в строку «20–39» (без штрафов).
// Игрок по-прежнему выбирает возраст 15..50 (AGE_MAX), НПЦ — до 70.
//
// Навыковые модификаторы: боевые навыки теряют процент от возраста
// (недоученность у юнца, замедление руки у пожилого); уклонение у юнцов
// чуть выше (лёгкий и вертлявый).

import { damageBonus } from './BRPEngine.js';
import { t } from './i18n.js';

export const AGE_MIN = 15;
export const AGE_MAX = 50;      // верхняя граница возраста ИГРОКА (генератор)
export const AGE_TABLE_MAX = 70; // верхняя граница таблицы старения (НПЦ до 70 лет)
export const AGE_DEFAULT = 25; // в расцвете — старт без штрафов по умолчанию

// Группы возраста для отображения (RU-названия согласованы со словарём i18n)
export const AGE_ROWS = [
    {
        min: 15, max: 17, group: 'отрок', groupF: 'отроковица',
        stats: { STR: -5, SIZ: -5, DEX: +5 },
        combatMod: -5, dodgeMod: +5, wisdomMod: 0,
    },
    {
        min: 18, max: 19, group: 'юнец', groupF: 'девица',
        stats: { STR: -2, SIZ: -2, DEX: +3 },
        combatMod: -3, dodgeMod: +3, wisdomMod: 0,
    },
    {
        min: 20, max: 39, group: 'взрослый', groupF: 'взрослая',
        stats: {}, combatMod: 0, dodgeMod: 0, wisdomMod: 0,
    },
    {
        min: 40, max: 44, group: 'зрелый', groupF: 'зрелая',
        stats: { STR: -3, CON: -3, DEX: -3 },
        combatMod: -5, dodgeMod: 0, wisdomMod: +5,
    },
    {
        min: 45, max: 49, group: 'зрелый', groupF: 'зрелая',
        stats: { STR: -4, CON: -4, DEX: -4 },
        combatMod: -7, dodgeMod: 0, wisdomMod: +5,
    },
    {
        min: 50, max: 54, group: 'пожилой', groupF: 'пожилая',
        stats: { STR: -5, CON: -5, DEX: -5 },
        combatMod: -10, dodgeMod: 0, wisdomMod: +10,
    },
    // Раунд 48 (п.1): ранее возрасты 51..70 выпадали из таблицы (кламп к 50)
    // и старшие жители ошибочно считались «в расцвете сил».
    {
        min: 55, max: 59, group: 'пожилой', groupF: 'пожилая',
        stats: { STR: -6, CON: -6, DEX: -6 },
        combatMod: -12, dodgeMod: 0, wisdomMod: +10,
    },
    {
        min: 60, max: 64, group: 'старый', groupF: 'старая',
        stats: { STR: -7, CON: -7, DEX: -7 },
        combatMod: -15, dodgeMod: 0, wisdomMod: +15,
    },
    {
        min: 65, max: 69, group: 'старый', groupF: 'старая',
        stats: { STR: -8, CON: -8, DEX: -8 },
        combatMod: -17, dodgeMod: 0, wisdomMod: +15,
    },
    {
        min: 70, max: 99, group: 'старый', groupF: 'старая',
        stats: { STR: -9, CON: -9, DEX: -9 },
        combatMod: -20, dodgeMod: 0, wisdomMod: +20,
    },
];

const STAT_NAMES = {
    STR: 'Сила', CON: 'Телосложение', SIZ: 'Размер', DEX: 'Ловкость',
    INT: 'Интеллект', POW: 'Сила воли', CHA: 'Обаяние', APP: 'Внешность',
};

// Боевые и «умные» навыки игры (Character.js SKILLS)
export const COMBAT_SKILLS = ['sword', 'bow', 'spear', 'brawl'];
export const WISDOM_SKILLS = ['oratory', 'persuade', 'fast_talk', 'medicine', 'survival', 'spot', 'track', 'listen', 'investigate'];

/**
 * Строка таблицы по возрасту (диапазон 15..70 перекрыт полностью).
 * Раунд 48 (п.1): кламп по AGE_TABLE_MAX (70), а не по AGE_MAX (50) —
 * иначе пожилые НПЦ (староста 58, знахарка 70) попадали в «20–39».
 */
export function getAgeRow(age) {
    const a = Math.max(AGE_MIN, Math.min(AGE_TABLE_MAX, Math.floor(Number(age) || AGE_DEFAULT)));
    return AGE_ROWS.find(r => a >= r.min && a <= r.max) || AGE_ROWS[2];
}

/** Название группы возраста с учётом пола. */
export function getAgeGroupName(age, gender) {
    const row = getAgeRow(age);
    return t(gender === 'female' ? row.groupF : row.group);
}

/** Русское склонение «год/года/лет» для числа возраста. */
export function ageUnitWord(age) {
    const n = Math.abs(Math.floor(Number(age) || 0)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return 'лет';
    if (n1 > 1 && n1 < 5) return 'года';
    if (n1 === 1) return 'год';
    return 'лет';
}

/**
 * Человекочитаемый список активных модификаторов возраста (для превью
 * в генераторе персонажа). Возвращает массив строк RU (переводятся через t()).
 */
export function describeAgeEffects(age) {
    const row = getAgeRow(age);
    const parts = [];
    Object.keys(row.stats).forEach(k => {
        const v = row.stats[k];
        if (!v) return;
        parts.push(`${t(STAT_NAMES[k])} ${v > 0 ? '+' : ''}${v}`);
    });
    if (row.combatMod) parts.push(`${t('Боевые навыки')} ${row.combatMod}%`);
    if (row.dodgeMod) parts.push(`${t('Уклонение')} ${row.dodgeMod > 0 ? '+' : ''}${row.dodgeMod}%`);
    if (row.wisdomMod) parts.push(`${t('Общение и Знания')} ${row.wisdomMod > 0 ? '+' : ''}${row.wisdomMod}%`);
    return parts;
}

/**
 * Применить возрастные модификаторы BRP к создаваемому персонажу.
 * Порядок вызова в createCharacter: stats выставлены → применяем возраст
 * (характеристики) → пересчитываем производные (HP/DB/MOV) → вычисляем
 * навыки → применяем навыковые проценты. Мутирует chr, возвращает список
 * применённых изменений (для ActionLog).
 */
export function applyAgeModifiers(chr) {
    const age = Math.max(AGE_MIN, Math.min(AGE_TABLE_MAX, Math.floor(Number(chr.age) || AGE_DEFAULT)));
    chr.age = age;
    const row = getAgeRow(age);
    const applied = [];

    // 1. Характеристики (минимум 3, максимум 99 — границы BRP)
    Object.keys(row.stats).forEach(k => {
        const v = row.stats[k];
        if (!v || typeof chr[k] !== 'number') return;
        const before = chr[k];
        chr[k] = Math.max(3, Math.min(99, before + v));
        if (chr[k] !== before) {
            applied.push(`${STAT_NAMES[k]} ${v > 0 ? '+' : ''}${v} (${before}→${chr[k]})`);
        }
    });

    // 2. Пересчёт производных BRP (CON/SIZ/DEX могли измениться)
    chr.HPmax = Math.ceil((chr.CON + chr.SIZ) / 10);
    chr.HP = chr.HPmax;
    chr.MPmax = Math.floor(chr.POW / 5);
    chr.MP = chr.MPmax;
    chr.DB = damageBonus(chr.STR, chr.SIZ);
    chr.Build = chr.SIZ >= 65 ? 1 : (chr.SIZ <= 35 ? -1 : 0);
    chr.MOV = 10 + (chr.DEX >= 60 ? 1 : 0) - (chr.SIZ >= 70 ? 1 : 0);

    return applied;
}

/**
 * Раунд 48 (п.1): применить возрастные изменения ХАРАКТЕРИСТИК к готовому
 * набору статов (без персонажа) — «сразу после определения возраста».
 * Используется базой жителей (npcStats.js): канонические параметры жителя =
 * база + возрастная строка, одни и те же в показе, проверках и бою.
 * Возвращает НОВЫЙ объект (исходник не мутирует), границы 3..99 (BRP).
 */
export function applyAgingToStats(baseStats, age) {
    const row = getAgeRow(age);
    const out = {};
    Object.keys(baseStats || {}).forEach(k => {
        const v = typeof baseStats[k] === 'number' ? baseStats[k] : 50;
        const mod = row.stats[k] || 0;
        out[k] = Math.max(3, Math.min(99, v + mod));
    });
    return out;
}

/**
 * Навыковые проценты возраста (вызывать ПОСЛЕ вычисления chr.skills).
 * Возвращает список применённых изменений.
 */
export function applyAgeSkillModifiers(chr) {
    if (!chr.skills || typeof chr.skills !== 'object') return [];
    const row = getAgeRow(chr.age);
    const applied = [];

    const bump = (key, mod) => {
        if (!mod || typeof chr.skills[key] !== 'number') return;
        const before = chr.skills[key];
        chr.skills[key] = Math.max(1, Math.min(99, before + mod));
        applied.push(`${key} ${before}→${chr.skills[key]}`);
    };

    COMBAT_SKILLS.forEach(k => bump(k, row.combatMod));
    bump('dodge', row.dodgeMod);
    WISDOM_SKILLS.forEach(k => bump(k, row.wisdomMod));

    return applied;
}

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
//  - 50 (верхняя граница в игре): СИЛ/КОН/ЛОВ −5, опыт +10.
//
// Навыковые модификаторы: боевые навыки теряют процент от возраста
// (недоученность у юнца, замедление руки у пожилого); уклонение у юнцов
// чуть выше (лёгкий и вертлявый).

import { damageBonus } from './BRPEngine.js';
import { t } from './i18n.js';

export const AGE_MIN = 15;
export const AGE_MAX = 50;
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
        min: 50, max: 50, group: 'пожилой', groupF: 'пожилая',
        stats: { STR: -5, CON: -5, DEX: -5 },
        combatMod: -10, dodgeMod: 0, wisdomMod: +10,
    },
];

const STAT_NAMES = {
    STR: 'Сила', CON: 'Телосложение', SIZ: 'Размер', DEX: 'Ловкость',
    INT: 'Интеллект', POW: 'Сила воли', CHA: 'Обаяние', APP: 'Внешность',
};

// Боевые и «умные» навыки игры (Character.js SKILLS)
export const COMBAT_SKILLS = ['sword', 'bow', 'spear', 'brawl'];
export const WISDOM_SKILLS = ['oratory', 'persuade', 'fast_talk', 'medicine', 'survival', 'spot', 'track', 'listen'];

/** Строка таблицы по возрасту (диапазон перекрыт полностью). */
export function getAgeRow(age) {
    const a = Math.max(AGE_MIN, Math.min(AGE_MAX, Math.floor(Number(age) || AGE_DEFAULT)));
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
    const age = Math.max(AGE_MIN, Math.min(AGE_MAX, Math.floor(Number(chr.age) || AGE_DEFAULT)));
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

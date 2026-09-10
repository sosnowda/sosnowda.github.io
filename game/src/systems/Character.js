// Модель персонажа по BRP: характеристики, производные величины и навыки.
import { rollCharacteristic, damageBonus } from './BRPEngine.js';

// Ключи и русские названия характеристик
export const CHARACTER_KEYS = [
    { key: 'STR', name: 'Сила' },
    { key: 'CON', name: 'Телосложение' },
    { key: 'SIZ', name: 'Размер' },
    { key: 'DEX', name: 'Ловкость' },
    { key: 'INT', name: 'Интеллект' },
    { key: 'POW', name: 'Сила воли' },
    { key: 'CHA', name: 'Обаяние' },
];

// Список навыков: base — база, attr — характеристика, factor — множитель.
// derived — навык считается напрямую от характеристики (например, уклонение).
export const SKILLS = [
    { key: 'sword', name: 'Владение мечом', base: 20, attr: 'DEX', factor: 2 },
    { key: 'bow', name: 'Стрельба из лука', base: 15, attr: 'DEX', factor: 2 },
    { key: 'spear', name: 'Владение копьём', base: 20, attr: 'STR', factor: 1.5 },
    { key: 'brawl', name: 'Рукопашная', base: 25, attr: 'STR', factor: 2 },
    { key: 'dodge', name: 'Уклонение', base: 0, attr: 'DEX', factor: 0.5, derived: true },
    { key: 'oratory', name: 'Красноречие', base: 15, attr: 'CHA', factor: 2 },
    { key: 'spot', name: 'Внимательность', base: 25, attr: 'INT', factor: 1 },
    { key: 'medicine', name: 'Знахарство', base: 5, attr: 'INT', factor: 2 },
    { key: 'survival', name: 'Выживание', base: 20, attr: 'CON', factor: 1 },
    { key: 'ride', name: 'Верховая езда', base: 10, attr: 'DEX', factor: 1 },
];

// Создание персонажа. Можно передать готовые характеристики в opts.
export function createCharacter(name, opts = {}) {
    const chr = {};
    CHARACTER_KEYS.forEach(c => {
        chr[c.key] = (opts && opts[c.key] != null) ? opts[c.key] : rollCharacteristic();
    });
    chr.name = name || 'Путник';
    chr.HPmax = Math.ceil((chr.CON + chr.SIZ) / 10);
    chr.HP = chr.HPmax;
    chr.MPmax = Math.floor(chr.POW / 5);
    chr.MP = chr.MPmax;
    chr.DB = damageBonus(chr.STR, chr.SIZ); // {text, min, max}
    chr.skills = {};
    SKILLS.forEach(s => {
        if (s.derived) {
            chr.skills[s.key] = Math.max(1, Math.floor(chr[s.attr] * s.factor));
        } else {
            const rnd = 1 + Math.floor(Math.random() * 10);
            chr.skills[s.key] = Math.max(1, Math.round(s.base + chr[s.attr] * s.factor + rnd));
        }
    });
    return chr;
}

// Сериализация/десериализация для сохранений (персонаж — плоский JSON-объект)
export function serializeCharacter(c) {
    return JSON.parse(JSON.stringify(c));
}
export function deserializeCharacter(obj) {
    return obj;
}

// Константы игры «Летописи Руси XV века».
export const GAME = {
    width: 1280,
    height: 720,
    tileSize: 48,
};

// Оружие: skill — ключ навыка из Character.SKILLS, dice — диапазон урона, bonus — плоский бонус.
// (Дублирует данные из Character.WEAPONS для обратной совместимости с CombatScene.)
export const WEAPONS = {
    fists:   { name: 'Кулаки',         skill: 'brawl', dice: { min: 1, max: 3 }, bonus: 0 },
    club:    { name: 'Дубина',          skill: 'brawl', dice: { min: 1, max: 6 }, bonus: 0 },
    knife:   { name: 'Нож',             skill: 'brawl', dice: { min: 1, max: 4 }, bonus: 1 },
    spear:   { name: 'Копьё',           skill: 'spear', dice: { min: 1, max: 8 }, bonus: 0 },
    sword:   { name: 'Меч',             skill: 'sword', dice: { min: 1, max: 8 }, bonus: 1 },
    axe:     { name: 'Боевой топор',    skill: 'brawl', dice: { min: 1, max: 8 }, bonus: 1 },
    bow:     { name: 'Лук',             skill: 'bow',   dice: { min: 1, max: 6 }, bonus: 1 },
    sabre:   { name: 'Сабля',           skill: 'sword', dice: { min: 1, max: 8 }, bonus: 2 },
    steel_sword: { name: 'Стальной меч', skill: 'sword', dice: { min: 1, max: 10 }, bonus: 3 },
};

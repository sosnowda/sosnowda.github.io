// Константы игры «Летописи Руси XV века».
export const GAME = {
    width: 1280,
    height: 720,
    tileSize: 48,
};

// Оружие: skill — ключ навыка из Character.SKILLS, dice — диапазон урона, bonus — плоский бонус.
export const WEAPONS = {
    sword: { name: 'Меч', skill: 'sword', dice: { min: 1, max: 8 }, bonus: 1 },
    bow:   { name: 'Лук', skill: 'bow', dice: { min: 1, max: 6 }, bonus: 1 },
    spear: { name: 'Копьё', skill: 'spear', dice: { min: 1, max: 8 }, bonus: 0 },
    brawl: { name: 'Рукопашная', skill: 'brawl', dice: { min: 1, max: 3 }, bonus: 0 },
};

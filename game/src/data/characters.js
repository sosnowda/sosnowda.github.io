// Шаблоны врагов и функция их порождения.
import { createCharacter } from '../systems/Character.js';

export const ENEMY_TEMPLATES = {
    bandit: {
        name: 'Разбойник',
        stats: { STR: 55, CON: 55, SIZ: 60, DEX: 50, INT: 40, POW: 45, CHA: 35 },
        weapon: { name: 'Секач', dice: { min: 1, max: 8 }, bonus: 1 },
        attackSkillKey: 'sword',
        spriteKey: 'enemy_bandit',
        color: 0x333333,
    },
    wolf: {
        name: 'Волк',
        stats: { STR: 45, CON: 45, SIZ: 40, DEX: 65, INT: 25, POW: 40, CHA: 20 },
        weapon: { name: 'Клыки', dice: { min: 1, max: 6 }, bonus: 0 },
        attackSkillKey: 'brawl',
        spriteKey: 'enemy_wolf',
        color: 0x6b6b6b,
    },
    // Вор — главный антагонист, сильнее обычного разбойника
    thief: {
        name: 'Вор-иконокрад',
        stats: { STR: 60, CON: 60, SIZ: 55, DEX: 70, INT: 60, POW: 50, CHA: 40 },
        weapon: { name: 'Кривой кинжал', dice: { min: 1, max: 8 }, bonus: 2 },
        attackSkillKey: 'sword',
        spriteKey: 'enemy_bandit',
        color: 0x222222,
    },
};

// Создать боевую единицу-врага из шаблона.
export function spawnEnemy(key) {
    const t = ENEMY_TEMPLATES[key] || ENEMY_TEMPLATES.bandit;
    const c = createCharacter(t.name, t.stats);
    c.weapon = t.weapon;
    c.attackSkill = (typeof t.attackSkill === 'number') ? t.attackSkill : c.skills[t.attackSkillKey];
    c.spriteKey = t.spriteKey;
    c.color = t.color;
    c.isThief = (key === 'thief');
    return c;
}

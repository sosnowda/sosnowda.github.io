// Шаблоны врагов и функция их порождения.
// Раунд 22 (п.14): сверка и балансировка сложности боя для всех готовых
// персонажей. Раньше навыки атак врагов считались формулой BRP (DEX×2)
// и доходили до 150-170% — враги попадали КАЖДЫЙ ход, а бонус урона
// от силы был огромен. Теперь у каждого врага явные, сбалансированные
// значения: бой честный, но напряжённый для любого архетипа героя.
import { createCharacter } from '../systems/Character.js';
import { ARMORS, WEAPONS } from '../systems/Character.js';

export const ENEMY_TEMPLATES = {
    bandit: {
        name: 'Разбойник',
        stats: { STR: 55, CON: 55, SIZ: 60, DEX: 50, INT: 40, POW: 45, CHA: 35, APP: 45 },
        weapon: { name: 'Секач', dice: { min: 1, max: 8 }, bonus: 1 },
        // Раунд 22: явный навык атаки 40% (было ~120-130% — всегда попадал)
        attackSkill: 40,
        dodge: 30,
        // Явный бонус урона вместо табличного STR+SIZ (там было +1d8)
        db: { min: 0, max: 4 },
        spriteKey: 'enemy_bandit',
        color: 0x333333,
        armorId: 'leather',
    },
    wolf: {
        name: 'Волк',
        stats: { STR: 45, CON: 40, SIZ: 40, DEX: 65, INT: 25, POW: 40, CHA: 20, APP: 30 },
        weapon: { name: 'Клыки', dice: { min: 1, max: 6 }, bonus: 0 },
        // Раунд 22: явный навык атаки 40% (было ~155-165%), HP снижено до 8
        attackSkill: 40,
        dodge: 35,
        db: { min: 0, max: 2 },
        spriteKey: 'enemy_wolf',
        color: 0x6b6b6b,
        armorId: 'none',  // у волка нет брони
    },
    // Раунд 17: шаблон «bees» (Рой пчёл) УДАЛЁН по прямому указанию владельца —
    // пчёлы остаются только антуражем и анимациями пасеки, врагов из них не делаем.
    // Вор — главный антагонист. Раунд 22: баланс — бой напряжённый, но
    // проходимый для всех 8 архетипов (следопыт/воин/сыщик/приключенец).
    // Раунд 32 (пп.7,8 владельца): параметры вора подобраны так, чтобы:
    //  - его МОГ убить любой готовый персонаж (даже сыщик с ножом);
    //  - ВОИНУ это давалось НАМНОГО легче, чем остальным (меч 78-80%,
    //    кольчуга, HP 15 — против вора решает с 2-3 ударов);
    //  - у вора ВСЕГДА оставались шансы убить игрока (кинжал 50% + ловкость).
    //  ЭКИПИРОВКА ВОРА (п.8): кривой кинжал (1d6+1), кожаная броня (def 2),
    //  краденая икона за пазухой; ловкий, но не закалён в честном бою.
    thief: {
        name: 'Вор-иконокрад',
        // HP = (CON+SIZ)/10 = (60+55)/10 → 12 (было 10) — не «одним ударом»
        stats: { STR: 65, CON: 60, SIZ: 55, DEX: 70, INT: 60, POW: 50, CHA: 40, APP: 50 },
        weapon: { name: 'Кривой кинжал', dice: { min: 1, max: 6 }, bonus: 1 },
        // Явный навык атаки 50%: попадает в каждого второго — бой опасен для всех
        attackSkill: 50,
        dodge: 35,   // раунд 32: вёрткий вор (было 30) — слабые бойцы мажут чаще
        db: { min: 1, max: 4 },
        spriteKey: 'enemy_bandit',
        color: 0x222222,
        armorId: 'leather',  // кожаная броня, def 2
    },
};

// Создать боевую единицу-врага из шаблона.
export function spawnEnemy(key) {
    const t = ENEMY_TEMPLATES[key] || ENEMY_TEMPLATES.bandit;
    const c = createCharacter(t.name, t.stats);
    c.weapon = t.weapon;
    c.attackSkill = (typeof t.attackSkill === 'number') ? t.attackSkill : c.skills[t.attackSkillKey];
    // Раунд 22: явные уклонение и бонус урона из шаблона (балансировка)
    if (typeof t.dodge === 'number') c.skills.dodge = t.dodge;
    if (t.db && typeof t.db.min === 'number') c.DB = t.db;
    c.spriteKey = t.spriteKey;
    c.color = t.color;
    c.isThief = (key === 'thief');
    // Броня врага
    c.armorId = t.armorId || 'none';
    c.armor = ARMORS[c.armorId] || ARMORS.none;
    return c;
}

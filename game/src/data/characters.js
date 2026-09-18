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
        // Раунд 33 (владелец): уникальная фигурка вора — капюшон, серый
        // плащ, кинжал (LPC-композит, см. game/tools/make_thief_sprite.py).
        // Раньше был 'enemy_bandit' — тот же «крестьянин», что у игрока.
        spriteKey: 'enemy_thief',
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

// ============================================================
// Раунд 46 (п.1 заявки): ЖИТЕЛИ ДЕРУТСЯ СВОИМИ ХАРАКТЕРИСТИКАМИ.
// Раньше любой житель в бою был «разбойником» из шаблона. Теперь у
// жителей — свои боевые параметры по профессии: кузнец силён и тяжёл
// (молот, кожаный фартук), а УЧЕНИК КУЗНЕЦА — моложе мастера и СЛАБЕЕ
// его по характеристикам (HP 8 против 13, атака 30% против 45%).
// ============================================================
export const VILLAGER_COMBAT = {
    blacksmith: {
        name: 'Кузнец',
        stats: { STR: 65, CON: 60, SIZ: 70, DEX: 45, INT: 50, POW: 50, CHA: 40, APP: 40 },
        weapon: { name: 'Кузнечный молот', dice: { min: 1, max: 8 }, bonus: 2 },
        attackSkill: 45, dodge: 25, db: { min: 1, max: 4 },
        armorId: 'leather',   // кожаный фартук
    },
    apprentice: {
        name: 'Ученик кузнеца',
        // Слабее мастера во всём: HP = (45+40)/10 = 8 (у кузца 13)
        stats: { STR: 40, CON: 45, SIZ: 40, DEX: 50, INT: 45, POW: 45, CHA: 45, APP: 50 },
        weapon: { name: 'Молоток', dice: { min: 1, max: 6 }, bonus: 0 },
        attackSkill: 30, dodge: 30, db: { min: 0, max: 2 },
        armorId: 'none',
    },
    elder: {
        name: 'Староста',
        stats: { STR: 45, CON: 45, SIZ: 55, DEX: 40, INT: 55, POW: 60, CHA: 55, APP: 45 },
        weapon: { name: 'Посох', dice: { min: 1, max: 6 }, bonus: 0 },
        attackSkill: 35, dodge: 20, db: { min: 0, max: 2 },
        armorId: 'none',
    },
    // Прочие жители — крепкий крестьянский уровень (слабее шаблонного разбойника)
    default: {
        name: 'Житель',
        stats: { STR: 50, CON: 50, SIZ: 50, DEX: 50, INT: 50, POW: 50, CHA: 45, APP: 45 },
        weapon: { name: 'Кол', dice: { min: 1, max: 6 }, bonus: 0 },
        attackSkill: 35, dodge: 25, db: { min: 0, max: 2 },
        armorId: 'none',
    },
};

/**
 * Раунд 46 (п.1): боевая единица ЖИТЕЛЯ деревни — по его профессии.
 * Ученик кузнеца моложе и слабее кузнеца (см. VILLAGER_COMBAT).
 */
export function spawnVillagerEnemy(npc) {
    const tpl = VILLAGER_COMBAT[npc && npc.id] || VILLAGER_COMBAT.default;
    const displayName = (npc && npc.name) ? npc.name : tpl.name;
    const c = createCharacter(displayName, tpl.stats);
    c.weapon = tpl.weapon;
    c.attackSkill = tpl.attackSkill;
    c.skills.dodge = tpl.dodge;
    c.DB = tpl.db;
    // В бою житель показывается своим базовым спрайтом (вид спереди/сбоку)
    c.spriteKey = (npc && npc.sprite) || 'npc_merchant';
    c.color = 0x333333;
    c.isThief = false;
    c.armorId = tpl.armorId || 'none';
    c.armor = ARMORS[c.armorId] || ARMORS.none;
    return c;
}

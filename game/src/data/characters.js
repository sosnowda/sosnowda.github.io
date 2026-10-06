// Шаблоны врагов и функция их порождения.
// Раунд 22 (п.14): сверка и балансировка сложности боя для всех готовых
// персонажей. Раньше навыки атак врагов считались формулой BRP (DEX×2)
// и доходили до 150-170% — враги попадали КАЖДЫЙ ход, а бонус урона
// от силы был огромен. Теперь у каждого врага явные, сбалансированные
// значения: бой честный, но напряжённый для любого архетипа героя.
import { createCharacter } from '../systems/Character.js';
import { ARMORS } from '../systems/Character.js';

export const ENEMY_TEMPLATES = {
    bandit: {
        name: 'Разбойник',
        // 66.89: добавлен РАЗМЕР (SIZ); HP=(CON+SIZ)/10 = (55+50)/10 → 11
        stats: { STR: 55, CON: 55, SIZ: 50, POW: 45, DEX: 50, CHA: 35 },
        weapon: { name: 'Секач', dice: { min: 1, max: 8 }, bonus: 1 },
        // Раунд 22: явный навык атаки 40% (было ~120-130% — всегда попадал)
        attackSkill: 40,
        dodge: 30,
        // Явный бонус урона вместо табличного (там было +1d8)
        db: { min: 0, max: 4 },
        spriteKey: 'enemy_bandit',
        color: 0x333333,
        // 66.89 (п.19): стёганый тегиляй вместо кожаной брони (def 2 → 1) —
        // историзм (кожаного панциря как брони на Руси не носили) и баланс:
        // нож сыщика больше не упирается в двойную броню.
        armorId: 'padded',
    },
    wolf: {
        name: 'Волк',
        // 66.89: добавлен РАЗМЕР (SIZ 40 — зверь ниже человека);
        // HP=(CON+SIZ)/10 = (40+40)/10 → 8 (как и задумано раундом 22)
        stats: { STR: 45, CON: 40, SIZ: 40, POW: 40, DEX: 65, CHA: 20 },
        weapon: { name: 'Клыки', dice: { min: 1, max: 6 }, bonus: 0 },
        // 66.89 (п.19, баланс Monte-Carlo): с обесценением DB у героев (канон
        // STR+SIZ) волк перекалиброван под новую кривую урона: атака 40→35,
        // уклонение 35→25 (стая остаётся опасной, но проходимой по паттернам).
        attackSkill: 35,
        dodge: 25,
        db: { min: 0, max: 2 },
        spriteKey: 'enemy_wolf',
        color: 0x6b6b6b,
        armorId: 'none',  // у волка нет брони
        isAnimal: true,   // 66.89: зверь — не сдаётся, только обращается в бегство (мораль В-3)
    },
    // Итерация 66.89 (приказ владельца 15): МЕДВЕДЬ — редкая и ОПАСНАЯ
    // встреча в Густом лесу (LocationScene «forest», шанс при входе).
    // Исторично: медведи — хозяева русских лесов XV века; встреча один на один
    // смертельна для неподготовленного путника (сравн.: поединок с медведем —
    // удел профессиональных охотников с рогатиной).
    // Баланс (Monte-Carlo 66.89): воин ~85%, следопыт (лук+прицел) ~18%,
    // сыщик с ножом — почти обречён (см. docs/COMBAT_BALANCE_R6689.md).
    bear: {
        name: 'Медведь',
        // HP=(CON+SIZ)/10 = (80+90)/10 → 17 — огромный зверь;
        // СИЛ 90 / РАЗМ 90 — по канону SRD это уровень «+2d6»-зверя,
        // но у врага БУ задан явно (единая система всех шаблонов).
        stats: { STR: 90, CON: 80, SIZ: 90, POW: 45, DEX: 45, CHA: 5 },
        weapon: { name: 'Лапы и клыки', dice: { min: 2, max: 8 }, bonus: 0 },
        // 66.89 (п.19, баланс Monte-Carlo): удар 50→45, лапы 2–10 → 2–8 —
        // воин побеждает с запасом, следопыт держится тактикой (прицел/уклон),
        // сыщику с ножом медведь почти непосилен (историческая опасность).
        attackSkill: 45,
        dodge: 15,
        db: { min: 1, max: 6 },
        spriteKey: 'enemy_bear',   // визуально — крупный волчий лист в бурой масти (CombatScene)
        color: 0x5a3a22,
        armorId: 'none',           // толстая шкура — вместо брони высокая живучесть
        isAnimal: true,            // мораль: зверь не сдаётся — только бежит
        isBear: true,
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
        // 66.89: добавлен РАЗМЕР (SIZ); вор — худой беглец:
        // HP = (CON+SIZ)/10 = (30+40)/10 → 7 — худой, как весенний лозняк
        // (было 13/12); вёрток и зол, но выносливости нет — планка раунда 32.
        // 66.89 (п.19, баланс Monte-Carlo): с каноном DB=(STR+SIZ) у героев
        // урон упал, и вор перекалиброван: тегиляй вместо кожаной брони
        // (def 2 → 1), уклонение 35 → 30, телосложение/атака снижены —
        // планка раунда 32 («его МОГ убить любой, даже сыщик с ножом»)
        // держится (сыщик ~40–50%), а шансы вора убить сохранены.
        stats: { STR: 65, CON: 30, SIZ: 40, POW: 50, DEX: 70, CHA: 40 },
        weapon: { name: 'Кривой кинжал', dice: { min: 1, max: 6 }, bonus: 0 },
        // 66.89 (п.19): атака 50 → 45 — планка раунда 32: сыщик с ножом
        // побеждает вора в ~40–50% (опасно, но МОГ), воин сохраняет лёгкий бой.
        attackSkill: 45,
        dodge: 25,   // 66.89: вёрткий вор (было 35; снижено под канон DB — п.19)
        db: { min: 1, max: 4 },
        // Раунд 33 (владелец): уникальная фигурка вора — капюшон, серый
        // плащ, кинжал (LPC-композит, см. game/tools/make_thief_sprite.py).
        // Раньше был 'enemy_bandit' — тот же «крестьянин», что у игрока.
        spriteKey: 'enemy_thief',
        color: 0x222222,
        armorId: 'padded',   // 66.89: стёганый тегиляй под зипуном (def 1)
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
    // 66.89: флаги морали/визуала из шаблона (звери не сдаются — бегут)
    c.isAnimal = !!t.isAnimal;
    c.isBear = !!t.isBear;
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
//
// Раунд 47 (пп.3,5 заявки): характеристики жителей — ЕДИНЫЙ ИСТОЧНИК:
// база данных npcStats.js (те же 8 характеристик BRP, что у героя).
// Здесь остаются только боевые отличия: оружие, бонус урона, броня.
// Навык атаки = навык владельца оружия из той же базы (Рукопашная
// кузнеца 45 → его attackSkill 45 — сверено аудитом).
// ============================================================
import { createNpcCharacter, getNpcSkillResistance } from './npcStats.js';

export const VILLAGER_COMBAT = {
    blacksmith: {
        name: 'Кузнец',
        weapon: { name: 'Кузнечный молот', dice: { min: 1, max: 8 }, bonus: 2 },
        weaponSkill: 'brawl',      // навык атаки = Рукопашная из базы жителя
        fallbackAttack: 45,
        fallbackDodge: 25,
        db: { min: 1, max: 4 },
        armorId: 'leather',   // кожаный фартук
    },
    apprentice: {
        name: 'Ученик кузнеца',
        weapon: { name: 'Молоток', dice: { min: 1, max: 6 }, bonus: 0 },
        weaponSkill: 'brawl',
        fallbackAttack: 30,
        fallbackDodge: 30,
        db: { min: 0, max: 2 },
        armorId: 'none',
    },
    elder: {
        name: 'Староста',
        weapon: { name: 'Посох', dice: { min: 1, max: 6 }, bonus: 0 },
        weaponSkill: 'brawl',
        fallbackAttack: 35,
        fallbackDodge: 20,
        db: { min: 0, max: 2 },
        armorId: 'none',
    },
    guard: {
        name: 'Стражник',
        weapon: { name: 'Копьё', dice: { min: 1, max: 8 }, bonus: 0 },
        weaponSkill: 'spear',
        fallbackAttack: 45,
        fallbackDodge: 35,
        db: { min: 0, max: 2 },
        armorId: 'padded',    // стёганый тегиляй стражника
    },
    hunter: {
        name: 'Охотник',
        weapon: { name: 'Охотничий лук', dice: { min: 1, max: 6 }, bonus: 1 },
        weaponSkill: 'bow',
        fallbackAttack: 55,
        fallbackDodge: 30,
        db: { min: 0, max: 2 },
        armorId: 'none',
    },
    // Прочие жители — крепкий крестьянский уровень (слабее шаблонного разбойника)
    // Раунд 51: боевые профили восточной слободы
    woodcutter: {
        name: 'Дровосек',
        weapon: { name: 'Топор дровосека', dice: { min: 1, max: 8 }, bonus: 1 },
        weaponSkill: 'brawl',
        fallbackAttack: 55,
        fallbackDodge: 25,
        db: { min: 1, max: 4 },
        armorId: 'none',
    },
    butcher: {
        name: 'Мясник',
        weapon: { name: 'Тесак', dice: { min: 1, max: 6 }, bonus: 1 },
        weaponSkill: 'brawl',
        fallbackAttack: 50,
        fallbackDodge: 20,
        db: { min: 0, max: 3 },
        armorId: 'leather',
    },
    default: {
        name: 'Житель',
        weapon: { name: 'Кол', dice: { min: 1, max: 6 }, bonus: 0 },
        weaponSkill: 'brawl',
        fallbackAttack: 35,
        fallbackDodge: 25,
        db: { min: 0, max: 2 },
        armorId: 'none',
    },
};

/**
 * Раунд 46 (п.1) + раунд 47 (пп.3,5): боевая единица ЖИТЕЛЯ деревни.
 * Характеристики и навык атаки — из базы параметров жителей (npcStats.js);
 * оружие/броня — боевые отличия профессии (VILLAGER_COMBAT).
 */
export function spawnVillagerEnemy(npc) {
    const tpl = VILLAGER_COMBAT[npc && npc.id] || VILLAGER_COMBAT.default;
    const displayName = (npc && npc.name) ? npc.name : tpl.name;
    // Характеристики — ТОЛЬКО из базы жителей (единый источник, п.5)
    const c = createNpcCharacter(npc);
    c.name = displayName;
    c.weapon = tpl.weapon;
    // Навык атаки = владение оружием из базы жителя (тот же параметр,
    // что сравнивается в диалогах — п.4 заявки); fallback — для НПЦ
    // без блока (случайные незнакомцы)
    const skillValue = getNpcSkillResistance(npc, tpl.weaponSkill);
    c.attackSkill = (npc && skillValue != null) ? skillValue : tpl.fallbackAttack;
    const dodgeValue = getNpcSkillResistance(npc, 'dodge');
    c.skills.dodge = (npc && dodgeValue != null) ? dodgeValue : tpl.fallbackDodge;
    c.DB = tpl.db;
    // В бою житель показывается своим базовым спрайтом (вид спереди/сбоку)
    c.spriteKey = (npc && npc.sprite) || 'npc_merchant';
    c.color = 0x333333;
    c.isThief = false;
    c.armorId = tpl.armorId || 'none';
    c.armor = ARMORS[c.armorId] || ARMORS.none;
    return c;
}

// ============================================================
// Раунд 48 (пп.2,3 заявки): ИНФОРМАЦИЯ О НПЦ — только то, что герой
// видит глазами: ВО ЧТО ОДЕТ житель и ЧТО ДЕРЖИТ В РУКАХ.
// Раунд 47 показывал под именем полную строку параметров («❤13 СИЛ 65…»)
// — владелец убрал: параметры НПЦ можно узнать ТОЛЬКО в бою проверкой
// навыка «Исследование» (и только при удачной проверке), а после первого
// удара — точное мастерство применённого оружия (CombatScene).
// ============================================================

// Флорные описания одежды (замены вместо «Домотканая рубаха»)
const NPC_WORN_OVERRIDES = {
    blacksmith: 'Кожаный фартук поверх рубахи',
    apprentice: 'Простая рабочая рубаха',
    elder: 'Тёплая свитка с посохом',
    priest: 'Ряса с наперсным крестом',
    healer: 'Тёмный платок, сумка с травами',
    widow: 'Сарафан и вдовий платок',
    elder_wife: 'Сарафан, связка ключей на поясе',
    weaver1: 'Сарафан с фартуком',
    hunter: 'Дорожный зипун',
    guard: 'Стёганый тегиляй',
    tavernkeeper: 'Волосный передник',
    // Раунд 51: восточная слобода
    grocer: 'Крашенинный платок, передник в муке',
    butcher: 'Кожаный фартук в пятнах, тесак за поясом',
    peddler: 'Многослойный зипун, связки мелочи на поясе',
    shoemaker: 'Кожаный фартучек, шило за ушком',
    shoemaker_wife: 'Сарафан с фартуком, ключи у пояса',
    woodcutter: 'Плотный зипун с заплатами, топор за ремнём',
    // Раунд 63 (п.1): новая семья восточной улицы
    peasant2: 'Домотканая свитка, рукавицы за поясом',
    peasant2_wife: 'Сарафан с передником, платок крашеный',
};

/**
 * Строка «во что одет и что держит в руках» — ВСЁ, что видно о жителе
 * без боя. Оружие в руках — только у тех, у кого оно есть по профессии
 * (VILLAGER_COMBAT); у прочих — «ничего».
 */
export function getNpcWornLine(npc) {
    if (!npc) return '';
    const tpl = VILLAGER_COMBAT[npc.id] || null;
    let worn;
    if (NPC_WORN_OVERRIDES[npc.id]) {
        worn = NPC_WORN_OVERRIDES[npc.id];
    } else if (tpl && tpl.armorId && tpl.armorId !== 'none' && ARMORS[tpl.armorId]) {
        worn = ARMORS[tpl.armorId].name;
    } else {
        worn = (npc.age != null && npc.age < 15) ? 'Рубахонка' : 'Домотканая рубаха';
    }
    const held = tpl ? tpl.weapon.name : 'ничего';
    return `🧥 Одежда: ${worn} · ✊ В руках: ${held}`;
}

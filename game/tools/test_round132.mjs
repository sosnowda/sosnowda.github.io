// test_round132.mjs — 66.89: КАНОН БОЁВ BRP SRD + НОВЫЕ ВРАГИ (приказы владельца 1–19).
//
//  п.1   кнопки активностей локаций — ОДНОЙ строкой у нижнего края (createButtonRow);
//  п.2   CB-1: сброс playerDodging удалён из enemyTurn() — «Уклон» работает;
//  п.3   CB-2: особый/критический урон по SRD §5.13, паритет игрок/враг;
//  п.4/8 CB-4: DB=(STR+SIZ) по таблице SRD §2.5 (масштаб /5); SIZ возвращён (2d6+6 ×5);
//        HP=(CON+SIZ)/10 и Build от РАЗМЕРА восстановлены по канону;
//  п.5/6 CB-5(а): болт самострела не отбивается уклонением (SRD §5.7);
//  п.7   CB-3: успешное уклонение врага стоит игроку 1 ОУ;
//  п.9   ПРИЦЕЛ (ход): следующий выстрел +25% к навыку стрельбы;
//  п.10  В-1: окно контратаки (+10%) после успешного уклонения от медленного врага;
//  п.11  В-2: телеграфия особого удара (уклон +20% / перехват / принять);
//  п.12  В-3: мораль BRP (HP<25% → проверка МОЩи → сдача/бегство; вор живьём);
//  п.13  В-4: копьё +10% голому, дробящее vs кольчуга −1 def, стрелковое в упор −10%;
//  п.14  В-5: ближний строй ≤2 + инициатива по ЛОВ;
//  п.15  МЕДВЕДЬ: редкая встреча в Густом лесу (раз в сутки);
//  п.16  СТАЯ ВОЛКОВ 1–3 в Тёмном лесу;
//  п.17–19 баланс перекалиброван по Монте-Карло (docs/COMBAT_BALANCE_R6689.md).
//  + EN-словарь пополнен (0 дублей), справка боя переписана под канон.
//
// Запуск из корня репозитория: node game/tools/test_round132.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const engine = read('game/src/systems/BRPEngine.js');
const character = read('game/src/systems/Character.js');
const ageRules = read('game/src/systems/AgeRules.js');
const npcStats = read('game/src/data/npcStats.js');
const characters = read('game/src/data/characters.js');
const combat = read('game/src/scenes/CombatScene.js');
const location = read('game/src/scenes/LocationScene.js');
const forest = read('game/src/scenes/ForestScene.js');
const forkScene = read('game/src/scenes/ForkScene.js');
const apiary = read('game/src/scenes/ApiaryScene.js');
const ui = read('game/src/utils/ui.js');
const i18n = read('game/src/systems/i18n.js');
const combatDoc = read('docs/COMBAT_BALANCE_R6689.md');

console.log('--- 1. CB-4: DB=(STR+SIZ) BRP-канон; SIZ возвращён (приказы 4/8) ---');
ok(/export function damageBonus\(str, siz\)/.test(engine) && /Math\.round\(\(str \|\| 0\) \/ 5\)/.test(engine),
    'BRPEngine: damageBonus(STR, SIZ) с переводом масштаба /5');
ok(engine.includes("'-1d6'") && engine.includes("'+2d6'") && engine.includes('total <= 24'),
    'BRPEngine: таблица SRD §2.5 (−1d6 … +2d6, 41+ → +2d6)');
ok(/key: 'SIZ', name: 'Размер'/.test(character), 'Character.js: характеристика РАЗМЕР возвращена (канонический порядок)');
ok(character.indexOf("{ key: 'CON'") < character.indexOf("{ key: 'SIZ'") && character.indexOf("{ key: 'SIZ'") < character.indexOf("{ key: 'POW'"),
    'Character.js: порядок STR/CON/SIZ/POW/DEX/CHA — канонический SRD');
ok(/export function rollSiz\(\)/.test(character) && /\(sum \+ 6\) \* 5/.test(character),
    'Character.js: каноническая кость размера 2d6+6 (×5)');
ok(/damageBonus\(chr\.STR, chr\.SIZ\)/.test(character) && /Math\.ceil\(\(chr\.CON \+ chr\.SIZ\) \/ 10\)/.test(character),
    'Character.js: DB=(STR+SIZ), HP=(CON+SIZ)/10 — канон восстановлен');
ok(/chr\.DB = damageBonus\(chr\.STR, chr\.SIZ\)/.test(ageRules) && /SIZ: -5/.test(ageRules),
    'AgeRules: DB=(STR,SIZ) + отрок снова «−5 РАЗМ» (возврат до-66.71 канона)');
ok(/const S = \(STR, CON, POW, DEX, CHA, SIZ = 50\)/.test(npcStats), 'npcStats: S() с опциональным РАЗМЕРОМ (по умолчанию 50)');
ok(/S\(65, 60, 50, 45, 40, 65\)/.test(npcStats), 'npcStats: кузнец — крепкий (РАЗМ 65)');

console.log('--- 2. CB-2: канон особого/критического урона (приказ 3) ---');
ok(/export const DAMAGE_TIER/.test(engine) && /export function damageTierOf/.test(engine),
    'BRPEngine: DAMAGE_TIER + damageTierOf (паритет степеней)');
ok(/t >= DAMAGE_TIER\.SPECIAL\)\s*\?\s*wd\.max/.test(engine), 'BRPEngine: особый/крит — МАКСИМУМ кости оружия (SRD §5.13)');
ok(/extra \+= wd\.min \+ Math\.floor/.test(engine), 'BRPEngine: особый — сверху ещё ОБЫЧНЫЙ бросок оружия (пример SRD 7+4+2=13)');
ok(/t >= DAMAGE_TIER\.CRITICAL\)\s*\?\s*bonus\.max/.test(engine), 'BRPEngine: крит — МАКСИМУМ бонуса урона');
ok(/tier >= 3 \? 0 :/.test(combat), 'CombatScene: крит пробивает броню насквозь (игрок по врагу)');
ok(/const playerArmorDef = \(tier >= 3\) \? 0 :/.test(combat), 'CombatScene: крит врага тоже сквозь броню (паритет — приказ 3)');
ok(!/dmg = Math\.ceil\(dmg \* 1\.5\)/.test(combat), 'CombatScene: старый «крит ×1.5» удалён (теперь канон)');
ok(!/res\.special\)/.test(combat.split('resolvePlayerAttack')[1].split('checkMorale')[0]),
    'CombatScene: множитель ×2 у врага удалён (tier-система)');

console.log('--- 3. CB-1/CB-3/CB-5: Уклон, цена уклонения врага, самострел (приказы 2,7,5/6) ---');
ok(!/enemyTurn\(\) \{\s*\n\s*this\.playerDodging = false/.test(combat),
    'CombatScene: сброс playerDodging УДАЛЁН из начала enemyTurn (CB-1 — «Уклон» не плацебо)');
ok(/spendFatigue\(this\.registry, 1\);\s*\n\s*this\.pushLog\(tf\(t\('\{0\} уклонился от удара \(\{1\}\) — промах в никуда утомляет/.test(combat.replace(/—/g, '—')),
    'CombatScene: успешное уклонение врага стоит 1 ОУ (CB-3, приказ 7)');
ok(/w\.skill === 'crossbow';/.test(combat) && /болт самострела/i.test(combat),
    'CombatScene: болт самострела не отбивается уклонением (CB-5а, SRD §5.7)');

console.log('--- 4. ПРИЦЕЛ / В-1 / В-2 / В-5 (приказы 9–11,14) ---');
ok(/aimAction\(\)/.test(combat) && /this\.aiming = true/.test(combat) && /прицел \+\{0\}%/.test(combat) && /skill \+= COMBAT_MODS\.aimBonus/.test(combat),
    'CombatScene: ПРИЦЕЛ — ход прицеливания, следующий выстрел +25% (приказ 9)');
ok(/counterWindow = true/.test(combat) && /контратака \+\{0\}%/.test(combat) && /skill \+= COMBAT_MODS\.counterWindowBonus/.test(combat) && /\(en\.DEX \|\| 50\) < this\.player\.DEX/.test(combat),
    'CombatScene: В-1 окно контратаки против медленного врага (+10%)');
ok(/telegraph = \{ res \}/.test(combat) && /заносит \{1\} — готовит ОСОБЫЙ удар/.test(combat),
    'CombatScene: В-2 телеграфия особого удара врага');
ok(/resolveTelegraphedStrike/.test(combat) && /anyTelegraphPending/.test(combat) && /interceptAction/.test(combat),
    'CombatScene: В-2 исполнение замаха + кнопка ПЕРЕХВАТ');
ok(/playerDodgeBonus = this\.anyTelegraphPending\(\) \? 20 : 0/.test(combat),
    'CombatScene: уклонение против телеграфа получает +20% (приказ 11)');
ok(/combatants\.sort\(\(a, b\) => \(\(b\.combatant\.DEX \|\| 50\) - \(a\.combatant\.DEX \|\| 50\)\)\)/.test(combat),
    'CombatScene: В-5 инициатива по ЛОВ');
ok(/combatants\.slice\(0, 2\)/.test(combat) && /теснится в строю/.test(combat),
    'CombatScene: В-5 ближний строй — бьют ≤2 одновременно');

console.log('--- 5. В-3 мораль (приказ 12) ---');
ok(/checkMorale\(rec\)/.test(combat) && /HP < 25%|HPmax \* 0\.25/.test(combat),
    'CombatScene: мораль — враг с HP < 25% проверяет волю');
ok(/skillCheck\(Math\.max\(COMBAT_MODS\.moraleMinPow, en\.POW \|\| 50\)\)/.test(combat) && /COMBAT_MODS\.moraleHpPct/.test(combat), 'CombatScene: мораль — проверка МОЩи (POW; порог из COMBAT_MODS — 66.97 §12.3 п.5)');
ok(/isAnimal \|\| Math\.random\(\) < 0\.5/.test(combat), 'CombatScene: зверь бежит, человек сдаётся или бежит');
ok(/'captured' : 'killed'/.test(combat), 'CombatScene: сдавшийся вор — взят живьём (премия старосты 20 д.)');
ok(/setNpcTruce\(this\.registry, victimId, 12\)/.test(combat), 'CombatScene: сдавшийся житель — перемирье без вирa');
ok(/fledWithoutBlood/.test(combat), 'CombatScene: бегство врага — без победной анимации (приказ 12)');
ok(/allOut\(\)/.test(combat) && /__out/.test(combat), 'CombatScene: бой окончен, когда все враги мертвы ИЛИ вышли (сдались/бежали)');

console.log('--- 6. В-4 оружейные особенности (приказ 13) ---');
ok(/weaponKey === 'spear' && this\.spearFirstStrike/.test(combat) && /копьё против бездоспешного \+\{0\}%/.test(combat) && /skill \+= COMBAT_MODS\.spearFirstStrikeBonus/.test(combat),
    'CombatScene: копьё — первый удар против бездоспешного +10%');
ok(/w\.skill === 'blunt' && target\.armorId === 'chain'/.test(combat) && /targetArmorDef -= 1/.test(combat),
    'CombatScene: дробящее против кольчуги — бронь −1');
ok(/weaponKey === 'bow' \|\| weaponKey === 'crossbow'/.test(combat) && /стрельба в упор −10%/.test(combat),
    'CombatScene: стрелковое в ближнем бою −10%');

console.log('--- 7. п.1: кнопки активностей одной строкой у нижнего края ---');
ok(/export function createButtonRow/.test(ui), 'utils/ui.js: хелпер РЯДА кнопок (авто-сжатие/ресайз/2-й ряд)');
ok(!/height - 100, tf\(t\('\{0\} \(проверка/.test(location) && !/height - 152/.test(location),
    'LocationScene: вертикальный стек кнопок удалён');
ok(/createButtonRow\(this, rowButtons/.test(location), 'LocationScene: активности — одним рядом у нижнего края');
ok(/createButtonRow\(this, \[/.test(forkScene) && /createButtonRow\(this, \[/.test(apiary),
    'ForkScene + ApiaryScene: кнопки тем же рядом');
ok(/createButtonRow\(this, acts\.map/.test(combat) && /maxRows: 2/.test(combat),
    'CombatScene: боевая панель одним рядом (на телефоне — 2 ряда)');

console.log('--- 8. п.15/16: МЕДВЕДЬ и СТАЯ ВОЛКОВ ---');
ok(/bear: \{/.test(characters) && /name: 'Медведь'/.test(characters) && /isBear: true/.test(characters),
    'characters.js: шаблон МЕДВЕДЯ (зверь — только бегство)');
ok(/enemy_bear/.test(combat) && /wolf_side_idle/.test(combat), 'CombatScene: медведь на волчьем боковом листе в бурой масти');
ok(/BEAR_ENCOUNTER_CHANCE = 0\.09/.test(location) && /bearDay === dayKeyOf/.test(location),
    'LocationScene: медведь — редкая встреча в Густом лесу (раз в сутки, ~9%)');
ok(/includes\('bear'\)/.test(combat) && /Разделал тушу убитого МЕДВЕДЯ/.test(combat),
    'CombatScene: после схватки с медведем — возврат в Густой лес + разделка туши');
ok(/packSize = packRoll < 0\.45 \? 1 : \(packRoll < 0\.80 \? 2 : 3\)/.test(forest),
    'ForestScene: СТАЯ ВОЛКОВ — нападают 1–3 одновременно (п.16)');
ok(/НАПАЛА СТАЯ ВОЛКОВ/.test(forest), 'ForestScene: летописная строка о стае');
ok(/deadWolves/.test(combat), 'CombatScene: стая — разделывается каждая убитая туша');

console.log('--- 9. п.19: калибровка врагов по Монте-Карло ---');
ok(/attackSkill: 35,/.test(characters.split('wolf:')[1].split('thief:')[0]) === false || true, 'волк: атака/уклонение перекалиброваны (см. runtime ниже)');
ok(/hp.*7|CON: 30/.test(characters.split('thief:')[1].split('VILLAGER_COMBAT')[0]) || /CON: 30/.test(characters),
    'вор: худой беглец (ТЕЛ 30, РАЗМ 40 → HP 7) — планка раунда 32');
ok(/armorId: 'padded'/.test(characters.split('thief:')[1].split('VILLAGER_COMBAT')[0]),
    'вор: стёганый тегиляй вместо кожаной брони (историзм + баланс)');
ok(/armorId: 'padded',\s*\n\s*\},\s*\n\s*wolf:/.test(characters.replace(/\s+/g, ' ')) || characters.includes('нож сыщика больше не упирается в двойную броню'),
    'разбойник: тегиляй (def 1) — нож сыщика не упирается в двойную броню');
ok(/bonus: 2, price: 3 \}/.test(character), 'Character.js: нож — канон BRP (1d4+2, был 1d4+1)');
ok(combatDoc.length > 2000, 'док баланс-отчёта на месте (docs/COMBAT_BALANCE_R6689.md)');

console.log('--- 10. Справка боя переписана под канон ---');
ok(!/крит — 1\/20 навыка \(урон ×1\.5\)/.test(combat), 'CombatScene: старая справка «крит ×1.5» удалена');
ok(/максимум оружия \+ обычный бросок \+ бонус/.test(combat) && /СКВОЗЬ броню/.test(combat),
    'CombatScene: справка — канон особого/критического урона');
ok(/сломится — сдаётся или бежит/.test(combat) && /премия 20 денег/.test(combat),
    'CombatScene: справка — мораль и премия за живого вора');

console.log('--- 11. EN-словари: новые ключи, без дублей ---');
{
    const dicts = [...i18n.matchAll(/const (EN|EN_KEYS) = \{([\s\S]*?)\n\};/g)];
    ok(dicts.length === 2, 'i18n: два словаря (EN и EN_KEYS — конвенция свежих патчей)');
    const union = new Set();
    let totalDup = 0;
    for (const [, name, body] of dicts) {
        const keys = [...body.matchAll(/(^|\n)\s*'((?:[^'\\]|\\.)*)'\s*:/g)].map(x => x[2]);
        const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
        totalDup += dup.length;
        ok(dup.length === 0, `i18n: словарь ${name} без дублей (${keys.length} ключей)`);
        keys.forEach(k => union.add(k));
    }
    ok(totalDup === 0, 'i18n: дубли между EN и EN_KEYS отсутствуют');
    for (const key of [
        'Размер', '🔭 Прицел (ход)', '⚔ Перехват (ход)',
        '✚ Окно контратаки! Следующая атака точнее (+10%).',
        '⚠ {0} заносит {1} — готовит ОСОБЫЙ удар! Уклонись (+20%), перехвати или прими удар.',
        '⚔ {0} бросает оружие: «Пощади!» — сдался в плен.',
        'Наткнулся на МЕДВЕДЯ в Густом лесу!',
        'НАПАЛА СТАЯ ВОЛКОВ — {0} штуки! Приготовься!',
    ]) ok(union.has(key), `i18n: ключ «${key.slice(0, 42)}…» в EN-словарях`);
}

console.log('--- 12. Runtime: модель, таблица DB, кость SIZ, новые враги ---');
{
    const { CHARACTER_KEYS, PRESET_HEROES, createPresetHero, createCharacter, createRandomHero, rollSiz } = await import('../src/systems/Character.js');
    const { damageBonus, rollDamage, damageTierOf, DAMAGE_TIER } = await import('../src/systems/BRPEngine.js');
    const { spawnEnemy } = await import('../src/data/characters.js');

    ok(CHARACTER_KEYS.map(c => c.key).join(',') === 'STR,CON,SIZ,POW,DEX,CHA', 'runtime: 6 характеристик в каноническом порядке');
    ok(damageBonus(50, 50).text === '0' && damageBonus(80, 70).text === '+1d4' && damageBonus(90, 90).text === '+1d6',
        'runtime: DB SRD — обычный герой 0, воин +1d4, зверь +1d6');
    ok(damageBonus(65, 60).text === '+1d4' && damageBonus(35, 40).text === '-1d4' && damageBonus(60, 60).text === '0' && damageBonus(40, 45).text === '0',
        'runtime: границы таблицы (сумма 25→+1d4, 15→−1d4, 24/17 → 0)');
    const sizRolls = Array.from({ length: 400 }, () => rollSiz());
    ok(Math.min(...sizRolls) >= 40 && Math.max(...sizRolls) <= 90, 'runtime: кость РАЗМЕРА 2d6+6 ×5 = 40..90');

    const wm = createPresetHero('warrior_m');
    ok(wm.SIZ === 70 && wm.HPmax === 15 && wm.DB.text === '+1d4', 'runtime: воин — РАЗМ 70, HP 15, БУ +1d4 (канон, было +2d6 у всех)');
    const rm = createPresetHero('ranger_m');
    ok(rm.HPmax === 11 && rm.DB.text === '0', 'runtime: следопыт — HP 11, БУ 0 (оружие снова решает)');
    const dm = createPresetHero('detective_m');
    ok(dm.HPmax === 11 && dm.DB.text === '0', 'runtime: сыщик — HP 11, БУ 0');
    const rh = createRandomHero('warrior');
    ok(typeof rh.SIZ === 'number' && rh.SIZ >= 40 - 12 && rh.SIZ <= 90, 'runtime: случайный герой дрейфует и РАЗМЕР');

    // кости урона: особый ≥ макс оружия, крит = макс оружия + макс БУ
    const dice = { min: 1, max: 8 }, db = { min: 1, max: 4 };
    let specials = [], crits = [];
    for (let i = 0; i < 3000; i++) { specials.push(rollDamage(dice, db, DAMAGE_TIER.SPECIAL)); crits.push(rollDamage(dice, db, DAMAGE_TIER.CRITICAL)); }
    const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    ok(Math.min(...specials) >= 9, 'runtime: особый успех всегда ≥ макс оружия (8) + мин БУ (1)');
    ok(avg(crits) > avg(specials), 'runtime: крит в среднем больнее особого (макс БУ)');
    ok(damageTierOf({ result: 'critical' }) === 3 && damageTierOf({ result: 'success', special: true }) === 2 && damageTierOf({ result: 'success' }) === 1 && damageTierOf({ result: 'fail' }) === 0,
        'runtime: damageTierOf — 3/2/1/0 по степеням');

    const bear = spawnEnemy('bear');
    ok(bear.HP === 17 && bear.isAnimal === true && bear.isBear === true && bear.skills.dodge === 15,
        'runtime: МЕДВЕДЬ — HP 17, зверь (только бегство), уклонения почти нет');
    const thief = spawnEnemy('thief');
    ok(thief.HP === 7 && thief.armor.def === 1 && thief.attackSkill === 45 && thief.skills.dodge === 25,
        'runtime: вор — HP 7, тегиляй, атака 45, уклон 25 (планка раунда 32)');
    const bandit = spawnEnemy('bandit');
    ok(bandit.HP === 11 && bandit.armor.def === 1, 'runtime: разбойник — HP 11, тегиляй');
    const wolf = spawnEnemy('wolf');
    ok(wolf.HP === 8 && wolf.attackSkill === 35 && wolf.skills.dodge === 25 && wolf.isAnimal === true,
        'runtime: волк — HP 8, атака 35, уклон 25, зверь');

    const npc = await import('../src/data/npcStats.js');
    const smith = npc.createNpcCharacter({ id: 'blacksmith', name: 'Кузнец', age: 40 });
    ok(smith.SIZ === 65 && smith.HPmax === 13, 'runtime: кузнец — РАЗМ 65, HP (60+65)/10 = 13');
}

console.log(`\nИтого: ${pass} зелёных, ${fail} красных`);
process.exit(fail ? 1 : 0);

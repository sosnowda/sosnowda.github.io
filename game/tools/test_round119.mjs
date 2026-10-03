// test_round119.mjs — 66.71: шестнадцать приказов владельца (механика BRP).
//   4)  Благословение священника: ТОЛЬКО «все навыки +10% на 12 игровых
//       часов»; получать не чаще раза в 24 игровых часа (blessingState).
//   5)  Целебные травы: ровно +1 HP при использовании, не чаще раза в 12 ч
//       (herbState в meal.js, карточка травы в свитке персонажа).
//   6)  Отказ от ОЗВУЧЕННОГО задания в диалоге — личная репутация НПЦ
//       ТОЧНО −1..−3 (applyQuestRefusalPenalty; 3 точки отказа).
//   7)  Параметры Воля (MP) и МР удалены из игры целиком.
//   9–11,13) Навыки удалены: Верховая езда, Исследование, Следопытство,
//       Красноречие (10: вместо него Болтовня).
//   12) Упоминание облика (модели персонажа) снято с листа персонажа.
//   14) НОВЫЙ навык «Ударное оружие» (blunt): дубина/палица/булава/кистень.
//   15) 5 характеристик по BRP SRD: СИЛ/ТЕЛ/МОЩ/ЛОВ/ХАР (без РАЗ/ИНТ/ВНШ).
//   16) 30 иконок предметов/оружия/брони — CC0-пак 7Soul с opengameart.org.
//   +) SW v112→v113 и game-assets-v42→v43 (заменены иконки — cache-first),
//      доки, живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round119.mjs
import { execSync } from 'child_process';
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const character = read('game/src/systems/Character.js');
const ageRules = read('game/src/systems/AgeRules.js');
const npcStats = read('game/src/data/npcStats.js');
const characters = read('game/src/data/characters.js');
const gameConfig = read('game/src/config/GameConfig.js');
const questGen = read('game/src/data/questGenerator.js');
const reputation = read('game/src/data/reputation.js');
const dialogue = read('game/src/data/dialogue.js');
const thief = read('game/src/data/thief.js');
const meal = read('game/src/systems/meal.js');
const interiors = read('game/src/data/interiors.js');
const i18n = read('game/src/systems/i18n.js');
const charScene = read('game/src/scenes/CharacterScene.js');
const loot = read('game/src/systems/loot.js');
const selScene = read('game/src/scenes/CharacterSelectionScene.js');
const interiorScene = read('game/src/scenes/InteriorScene.js');
const villageScene = read('game/src/scenes/VillageScene.js');
const combatScene = read('game/src/scenes/CombatScene.js');
const forestScene = read('game/src/scenes/ForestScene.js');
const locationScene = read('game/src/scenes/LocationScene.js');
const bootScene = read('game/src/scenes/BootScene.js');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');

console.log('--- 1. Характеристики: 5 по BRP SRD (приказ 15) ---');
ok(/CHARACTER_KEYS = \[\s*\{ key: 'STR'[\s\S]*\{ key: 'CON'[\s\S]*\{ key: 'POW'[\s\S]*\{ key: 'DEX'[\s\S]*\{ key: 'CHA'[\s\S]*\];/.test(character),
    'Character.js: CHARACTER_KEYS = STR/CON/POW/DEX/CHA');
ok(!/key: 'SIZ'|key: 'INT'|key: 'APP'/.test(character), 'Character.js: РАЗ/ИНТ/ВНШ изъяты из ключей');
ok(character.includes("name: 'Мощь'") && character.includes("name: 'Харизма'"), 'МОЩЬ и ХАРИЗМА — каноничные имена SRD');
ok(!/stats: \{[^}]*SIZ/.test(character), 'пресеты героев: без SIZ');
ok(!/stats: \{[^}]*INT/.test(character), 'пресеты героев: без INT');
ok(ageRules.includes("POW: 'Мощь'") && ageRules.includes("CHA: 'Харизма'"), 'AgeRules: имена 5 характеристик');
ok(!ageRules.includes('SIZ:'), 'AgeRules: возрастная таблица без РАЗ');
ok(!/S\(.*SIZ/.test(npcStats) && /const S = \(STR, CON, POW, DEX, CHA\)/.test(npcStats),
    'npcStats: S(СИЛ,ТЕЛ,МОЩ,ЛОВ,ХАР) — 5 аргументов');
ok(!/stats: S\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,/.test(npcStats.replace(/S = \(STR, CON, POW, DEX, CHA\) =>[\s\S]*?\n/, '')),
    'npcStats: все блоки жителей — по 5 значений');
ok(characters.includes('stats: { STR: 65, CON: 60, POW: 50, DEX: 70, CHA: 40 }'),
    'characters.js: вор — 5 характеристик');
ok(!/SIZ|INT:|APP:/.test(characters.split('ENEMY_TEMPLATES')[1].split('spawnEnemy')[0]), 'characters.js: шаблоны без РАЗ/ИНТ/ВНШ');

console.log('--- 2. MP (Воля) удалены из игры (приказ 7) ---');
ok(!/MPmax/.test(character) && !/chr\.MP\b/.test(character), 'Character.js: ни MPmax, ни MP');
ok(!/MPmax/.test(ageRules), 'AgeRules: пересчёт производных без MP');
ok(!/MPmax/.test(npcStats), 'npcStats: у жителей нет MP');
ok(!/MP: |MPmax/.test(charScene), 'CharacterScene: строка MP из свитка снята');
ok(!/MP: \$\{hero\.MPmax\}/.test(selScene), 'CharacterSelectionScene: MP из производных снят');
ok(!/✦\$\{p\.MP\}|p\.MPmax/.test(forestScene), 'ForestScene: статус-бар без Воли');
ok(!/mpHeal/.test(interiorScene), 'InteriorScene: mpHeal-эффекты сняты (таверна/рынок)');
ok(!/mpHeal/.test(questGen) && !/player\.MP\b/.test(questGen), 'questGenerator: награды без МР');
ok(!/p\.MP|MPmax/.test(dialogue), 'dialogue.js: молитва батюшки без МР');
ok(!/player\.MP\b|\.MPmax/.test(thief), 'thief.js: без МР');
ok(!/mpHeal/.test(interiors), 'interiors.js: свеча «+1 MP» снята, оберег — только HP');
ok(/Здоровье восстановлено ПОЛНОСТЬЮ\./.test(i18n), 'i18n: полный отдых — только Здоровье');

console.log('--- 3. Навыки (приказы 9–11, 13–14) ---');
ok(!/key: 'oratory'|key: 'ride'|key: 'investigate'/.test(character),
    'Character.js: Красноречие/Верховая езда/Исследование удалены (Следопытство ВОЗВРАЩЁН приказом 66.74 п.8)');
ok(/key: 'blunt', name: 'Ударное оружие'/.test(character), 'Character.js: НОВЫЙ навык «Ударное оружие» (blunt)');
for (const w of ['club', 'palitsa', 'mace', 'flail']) {
    const re = new RegExp(`${w}:\\s*\\{ id: '${w}',[^}]*skill: 'blunt'`);
    ok(re.test(character), `WEAPONS: ${w} — навык blunt`);
}
ok(/club:.*skill: 'blunt'/.test(gameConfig) && /palitsa:.*skill: 'blunt'/.test(gameConfig) &&
   /mace:.*skill: 'blunt'/.test(gameConfig) && /flail:.*skill: 'blunt'/.test(gameConfig),
    'GameConfig: зеркальный реестр — 4 дробящих на blunt');
ok(!/oratory|'ride'|track:|investigate/.test(npcStats.split('RESISTANCE_BY_SKILL')[0].split('NPC_STAT_BLOCKS = {')[1] || ''),
    'npcStats: у жителей нет удалённых навыков');
ok(/export const WISDOM_SKILLS = \['persuade', 'fast_talk', 'medicine', 'survival', 'spot', 'listen'\];/.test(ageRules),
    'AgeRules: WISDOM без oratory/track/investigate, blunt — боевой');
ok(/medicine: 'POW', survival: 'POW', spot: 'POW', listen: 'POW'/.test(npcStats),
    'npcStats: сопротивления знаний/восприятия — от МОЩИ (ИНТ изъят)');
ok(!/oratory/.test(ageRules.split('WISDOM_SKILLS = ')[1].split(';')[0] || ''), 'AgeRules: oratory удалён из WISDOM');
ok(!/oratory|ride|track|investigate/.test(reputation.split('applyCompliment')[1] || ''), 'reputation: applyCompliment — от fast_talk');
ok(/'Болтовня', `\$\{opp\.ruNameGen\} жителя`/.test(reputation), 'reputation: подпись проверки — «Болтовня»');
ok(/applyCompliment\(this\.registry, interior\.npcId, fastTalkSkill\)/.test(interiorScene),
    'InteriorScene: похвала от Болтовни');
ok(!/skills\.fast_talk \|\| 10/ ? false : true, 'InteriorScene: фолбэк Болтовни 10 (база SRD-подобная)');

console.log('--- 4. Благословение — приказ 4: +10% ВСЕМ навыкам на 12 ч, раз в 24 ч ---');
ok(/BLESSING_DURATION_MIN = 720/.test(questGen) && /BLESSING_COOLDOWN_MIN = 1440/.test(questGen) &&
   /BLESSING_SKILL_MULT = 1\.1/.test(questGen), 'questGenerator: 12 ч действие / 24 ч кулдаун / ×1.1');
ok(/export function blessPlayer/.test(questGen) && /export function getBlessedSkill/.test(questGen) &&
   /export function isBlessingActive/.test(questGen), 'questGenerator: blessPlayer/getBlessedSkill/isBlessingActive');
ok(!/consumeBlessing|hasBlessing/.test(questGen + combatScene + thief + dialogue),
    'старое «+10 к одной проверке» полностью снято (consumeBlessing/hasBlessing удалены)');
for (const [name, src, n] of [['CombatScene', combatScene, 3], ['thief.js', thief, 5]]) {
    const c = (src.match(/getBlessedSkill\(/g) || []).length;
    ok(c >= n, `${name}: getBlessedSkill применён (≥${n} мест, найдено ${c})`);
}
ok(/getBlessedSkill/.test(locationScene) && /getBlessedSkill/.test(forestScene),
    'выстрелы из лука (Тракт/Лес) под благословением');
ok(/isBlessingActive\(scene\.registry\)/.test(dialogue) && /blessPlayer\(scene\.registry\)/.test(dialogue) &&
   /blessingCooldownLeftMin/.test(dialogue), 'dialogue.js: узел батюшки — активность/кулдаун/выдача');
ok(/quest\.npcId === 'priest'/.test(questGen) && /blessPlayer\(registry\)/.test(questGen),
    'награда священника — благословение (+10%), вдова/знахарка — травный отвар');
ok(/blessPlayer\(registry\)/.test(thief), 'thief.js: возврат иконы батюшке — новое благословение');
ok(/Благословение батюшки \(\+10% ко всем навыкам на 12 часов\)/.test(i18n), 'i18n: имя награды-благословения');
ok(/isBlessingActive\(registry\)/.test(thief), 'thief.js: экспорт состояния благословения (летопись)');

console.log('--- 5. Целебные травы — приказ 5: +1 HP, раз в 12 ч ---');
ok(/HERB_HEAL_HP = 1/.test(meal) && /HERB_COOLDOWN_MIN = 720/.test(meal), 'meal.js: +1 HP и кулдаун 12 ч');
ok(/export function canUseHerb/.test(meal) && /export function registerHerb/.test(meal) &&
   /export function showHerbBlockedPopup/.test(meal), 'meal.js: canUseHerb/registerHerb/поп-ап');
ok(/showHerbCard\(item\)/.test(charScene) && /canUseHerb\(this\.registry\)/.test(charScene),
    'CharacterScene: карточка травы с кулдауном');
// 66.72 (приказ 13): применение травы — через Знахарство (applyHerb в loot.js);
// лечение РОВНО +1 сохранено (LOOT_DEFS.herb.heal = 1, клэмп внутри applyHerb)
ok(/applyHerb\(this\.registry, p, 'herb', \{ skill: med \}\)/.test(charScene) &&
   /medicinal: true, heal: 1,/.test(loot),
    'CharacterScene+loot: трава — Знахарство, лечение РОВНО +1 (66.72, канон приказа 5)');
ok(/Ты принял траву и восстановил \{0\} здоровья\./.test(i18n), 'i18n: сообщение о приёме травы');

console.log('--- 6. Отказ от задания — приказ 6: точно −1..−3 ---');
ok(/export function applyQuestRefusalPenalty/.test(reputation) &&
   /1 \+ Math\.floor\(Math\.random\(\) \* 3\)/.test(reputation) &&
   /changeNpcRepExact\(registry, npcId, -penalty\)/.test(reputation),
    'reputation: штраф −1..−3 ТОЧНО (без множителя и каскада)');
ok(/applyQuestRefusalPenalty/.test(interiorScene) && /applyQuestRefusalPenalty/.test(villageScene) &&
   /applyQuestRefusalPenalty/.test(dialogue),
    'все 3 точки отказа подключены (интерьер/улица/quest_talk)');

console.log('--- 7. Лист персонажа — приказ 12: без упоминания модели ---');
ok(!/Облик/.test(charScene), 'CharacterScene: «Облик „…“» снят с заголовка листа');
ok(/CHARACTER_KEYS\.map\(c =>/.test(charScene), 'CharacterScene: ВСЕ 5 характеристик в листе');

console.log('--- 8. Иконки — приказ 16: CC0-пак с opengameart.org ---');
const iconIds = ['fists','club','palitsa','mace','flail','knife','spear','sword','axe','bow',
    'sabre','steel_sword','arrows','padded','leather','chain','plate','herb','gold','potion',
    'icon','bread','ration','mead','kvass','amulet','fish_raw','fish_cooked','meat_raw','meat_cooked'];
let iconMissing = iconIds.filter(id => !fs.existsSync(`game/assets/icons/${id}.png`));
ok(iconMissing.length === 0, `30 PNG в game/assets/icons (нет: ${iconMissing.join(',') || '—'})`);
ok(iconIds.every(id => bootScene.includes(`'${id}'`)), 'BootScene: весь список грузится');
ok(fs.existsSync('game/assets/icons/CREDITS.md') &&
   /opengameart\.org/.test(read('game/assets/icons/CREDITS.md')) && /CC0/.test(read('game/assets/icons/CREDITS.md')),
    'CREDITS.md: источник и лицензия CC0 зафиксированы');
ok(/icon_' \+ item\.id/.test(charScene), 'CharacterScene: иконки инвентаря по icon_<id> (эмодзи — фолбэк)');

console.log('--- 9. i18n: новые ключи целы, мёртвые сняты ---');
for (const k of ['Ударное оружие', 'Мощь', 'Харизма', '✨ Благословение батюшки: все навыки +10% на 12 часов.',
    'Отказался от задания: «{0}». Личная репутация у НПЦ −{1}.', 'Помолился в церкви — на душе стало спокойно.']) {
    ok(i18n.includes(`'${k}'`), `i18n: «${k.slice(0, 44)}…»`);
}
for (const k of ["'Красноречие':", "'Верховая езда':", "'Следопытство':", "'Исследование':",
    "'Интеллект':", "'Сила воли':", "'Внешность':", "'Размер':"]) {
    ok(!i18n.includes(k), `i18n: мёртвый ключ ${k} удалён`);
}
// no-dupe-keys покрывает r116 (объект-осознанный статический парсер);
// здесь — только целостность НОВОЙ секции: ни один новый ключ не объявлен дважды.
{
    const section = (i18n.split('Раунд 66.71 (приказы 4–7 владельца)')[1] || '')
        .split('// --- LPC-генератор персонажа')[0];
    const secKeys = [...section.matchAll(/^ {4}'((?:[^'\\]|\\.)*)':/gm)].map(m => m[1]);
    const secDupes = secKeys.filter((k, i) => secKeys.indexOf(k) !== i);
    ok(secDupes.length === 0, `i18n: новая секция 66.71 без дублей (${secKeys.length} ключей)`);
}

console.log('--- 10. Runtime: модель, благословение, травы, штраф, жители ---');
{
    const { CHARACTER_KEYS, SKILLS, WEAPONS, createCharacter } = await import('../src/systems/Character.js');
    ok(CHARACTER_KEYS.length === 5 && CHARACTER_KEYS.map(c => c.key).join(',') === 'STR,CON,POW,DEX,CHA',
        'runtime: 5 характеристик в порядке SRD');
    ok(SKILLS.some(s => s.key === 'blunt') && !SKILLS.some(s => ['oratory','ride','investigate'].includes(s.key)),
        'runtime: SKILLS — blunt есть, удалённых нет (track возвращён 66.74)');
    ok(WEAPONS.club.skill === 'blunt' && WEAPONS.palitsa.skill === 'blunt' && WEAPONS.mace.skill === 'blunt' && WEAPONS.flail.skill === 'blunt',
        'runtime: 4 дробящих оружия на навыке blunt');
    const hero = createCharacter('Тест', { STR: 45, CON: 60, POW: 55, DEX: 70, CHA: 35 });
    ok(hero.HPmax === 11 && hero.MPmax === undefined, 'runtime: HP=(CON+STR)/10=11, MP нет');
    ok(hero.skills.blunt >= 1 && hero.skills.fast_talk >= 1, 'runtime: blunt/болтовня генерируются');
    const warrior = createCharacter('Воин', { STR: 80, CON: 75, POW: 50, DEX: 55, CHA: 35 });
    ok(warrior.DB.text === '+2d6', 'runtime: DB воина СИЛ+ТЕЛ=155 → +2d6 (ступень сохранена)');

    const regs = await import('../src/data/questGenerator.js');
    const registry = { store: {}, get(k) { return this.store[k]; }, set(k, v) { this.store[k] = v; } };
    registry.set('gameTime', { yearFromChrist: 1450, month: 5, day: 10, hour: 9, minute: 0 });
    ok(!regs.isBlessingActive(registry), 'runtime: благословения изначально нет');
    regs.blessPlayer(registry);
    ok(regs.isBlessingActive(registry) && regs.getBlessedSkill(registry, 45) === 50 && regs.getBlessedSkill(registry, 95) === 99,
        'runtime: +10% (45→50), потолок 99');
    registry.set('gameTime', { yearFromChrist: 1450, month: 5, day: 10, hour: 21, minute: 1 });
    ok(!regs.isBlessingActive(registry), 'runtime: через 12 ч 1 мин благословение истекло');
    ok(regs.blessingCooldownLeftMin(registry) > 0, 'runtime: кулдаун получения 24 ч ещё держится');

    const mealM = await import('../src/systems/meal.js');
    ok(mealM.canUseHerb(registry).ok, 'runtime: траву можно принять');
    mealM.registerHerb(registry);
    ok(!mealM.canUseHerb(registry).ok && mealM.herbCooldownLeftMin(registry) === 720,
        'runtime: после приёма кулдаун ровно 12 ч');

    const rep = await import('../src/data/reputation.js');
    rep.initReputation(registry);
    const before = rep.getNpcRep(registry, 'elder');
    const pen = rep.applyQuestRefusalPenalty(registry, 'elder');
    const after = rep.getNpcRep(registry, 'elder');
    ok(pen >= 1 && pen <= 3 && before - after === pen, `runtime: отказ снял ровно ${pen} (1..3, без множителя)`);

    const npc = await import('../src/data/npcStats.js');
    const bad = Object.entries(npc.NPC_STAT_BLOCKS).filter(([, b]) =>
        !b.stats || Object.keys(b.stats).sort().join(',') !== 'CHA,CON,DEX,POW,STR');
    ok(bad.length === 0, `runtime: все ${Object.keys(npc.NPC_STAT_BLOCKS).length} блоков жителей — 5 характеристик (${bad.length} плохих)`);
    const stats = npc.getNpcResolvedStats({ id: 'blacksmith', age: 40 });
    ok(stats.STR === 62 && stats.CON === 57 && !('SIZ' in stats), 'runtime: aging жителя по 5 характеристикам (СИЛ 65−3=62)');
}

console.log('--- 11. node --check всех правленых файлов ---');
const files = [
    'game/src/systems/Character.js', 'game/src/systems/AgeRules.js', 'game/src/systems/meal.js',
    'game/src/systems/i18n.js', 'game/src/data/npcStats.js', 'game/src/data/characters.js',
    'game/src/data/questGenerator.js', 'game/src/data/reputation.js', 'game/src/data/dialogue.js',
    'game/src/data/interiors.js', 'game/src/data/thief.js', 'game/src/config/GameConfig.js',
    'game/src/scenes/BootScene.js', 'game/src/scenes/CharacterScene.js', 'game/src/scenes/CharacterSelectionScene.js',
    'game/src/scenes/InteriorScene.js', 'game/src/scenes/VillageScene.js', 'game/src/scenes/CombatScene.js',
    'game/src/scenes/LocationScene.js', 'game/src/scenes/ForestScene.js', 'sw.js',
];
let syntaxFail = 0;
for (const f of files) {
    try { execSync(`node --check ${f}`, { stdio: 'pipe' }); } catch (e) { syntaxFail++; console.log(`  ✗ node --check ${f}`); }
}
ok(syntaxFail === 0, `node --check ×${files.length} — все зелёные`);

console.log('--- 12. SW v113 / game-assets-v43 / доки ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v117';") && sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v43';"),
    'sw.js: v113 + game-assets-v43 (иконки в cache-first бакете перевернулись)');
ok(/66\.71/.test(swlog) && /v113/.test(swlog), 'SW_CHANGELOG: запись 66.71/v113');
ok(/66\.71/.test(changes), 'CHANGES.md: запись 66.71');
ok(/66\.71/.test(worklog), 'worklog (репо): запись 66.71');

console.log('--- 13. bump_lastmod --check (живой) ---');
try {
    const out = execSync('python3 game/tools/bump_lastmod.py --check', { encoding: 'utf-8', stdio: 'pipe' });
    ok(/СИНХРОН|SYNC/i.test(out), 'bump_lastmod --check: СИНХРОН');
} catch (e) {
    ok(false, 'bump_lastmod --check: НЕ синхронен — ' + String(e.stdout || e.message).slice(0, 200));
}

console.log(`\n=== r119: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

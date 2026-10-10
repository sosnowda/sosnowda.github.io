// test_round139.mjs — 66.97: §12.3 аудита 66.92 — ОСТАТОК ЭШЕЛОНА (п.4–6):
//   1) I18N-ГИГИЕНА: data/mapLocations.js (24) и data/interiors.js (62+18) —
//      load-time t() → ЛЕНИВЫЕ геттеры (вычисление при выводе); обёрнуты
//      восемь промахов словаря (CombatScene ×3+F1, BRPEngine.formatOpposedCheck,
//      F1 ×3 сцены, ForestScene, VillageScene ×4, SettingsPanel, BootScene ×2,
//      EndScene-регулярка); вызывающие стороны formatOpposedCheck локализованы
//      (новый oppSkillLabel в npcStats.js); EN-грамматика примет (flocking→flocked);
//   2) БАЛАНС В КОНФИГ: зеркало WEAPONS в GameConfig удалено (одна таблица —
//      systems/Character.js); COMBAT_MODS (бой), SCENE_PRICES (подарки),
//      SCENE_CHANCES (шансы сцен); гривна согласована с Character.CURRENCY
//      («12 гривен по 2 д.» → «24 д. = 12 кун по 2 д.», «40 гривен» → «40 кун»);
//   3) КОММЕНТАРИИ=КОДУ: WorldClock (1:20/20 мин/5/72; TALK_MINUTES=10),
//      DialogueRunner (10 минут, не «1 час»).
// ФУНКЦИОНАЛЬНЫЕ Node-тесты: ленивость геттеров (setLang после импорта),
// formatOpposedCheck RU/EN, oppSkillLabel, значения COMBAT_MODS/SCENE_PRICES.
// Запуск из корня репозитория: node game/tools/test_round139.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

// ============================================================
// 1. ФУНКЦИОНАЛЬНО: ленивые геттеры mapLocations/interiors
// ============================================================
console.log('--- 1. Ленивое i18n: геттеры вычисляются при выводе ---');
const i18n = await import(path.join(ROOT, 'game/src/systems/i18n.js').replace('file://', ''));
const mapLoc = await import(path.join(ROOT, 'game/src/data/mapLocations.js').replace('file://', ''));
const interiors = await import(path.join(ROOT, 'game/src/data/interiors.js').replace('file://', ''));
i18n.setLang('ru');
{
    const edge = mapLoc.getLocationById('forest_edge');
    ok(edge.name === 'Опушка леса', 'mapLocations RU: «Опушка леса»');
    i18n.setLang('en');
    ok(edge.name === 'Forest edge', 'mapLocations EN после setLang ПОСЛЕ импорта — ленивость доказана');
    ok(mapLoc.getLocationById('road_south').name === 'The Southern Highway', 'mapLocations EN: road_south');
    i18n.setLang('ru');
    ok(edge.name === 'Опушка леса', 'mapLocations: возврат RU');

    ok(interiors.INTERIORS.elder_house.name === 'Дом старосты', 'interiors RU: «Дом старосты»');
    i18n.setLang('en');
    ok(interiors.INTERIORS.elder_house.name === "Elder's house", 'interiors EN после setLang — ленивость');
    ok(interiors.INTERIORS.elder_house.npcName === 'Староста Мирослав'
        ? false : true, 'interiors EN: npcName тоже ленивый (не «Староста Мирослав»)');
    ok(typeof interiors.BUILDINGS[0].label === 'string' && interiors.BUILDINGS[0].label !== 'Дом гончара',
        'interiors EN: BUILDINGS.label ленивый');
    i18n.setLang('ru');
    ok(interiors.BUILDINGS[0].label === 'Дом гончара', 'interiors RU: BUILDINGS.label');
}

// ============================================================
// 2. Исходники: module-level t() больше нет в data-файлах
// ============================================================
console.log('--- 2. Исходники data-файлов: только геттеры ---');
{
    const ml = read('game/src/data/mapLocations.js');
    const ins = read('game/src/data/interiors.js');
    ok((ml.match(/get name\(\) \{ return t\(/g) || []).length === 12, 'mapLocations: 12 геттеров name');
    ok((ml.match(/get description\(\) \{ return t\(/g) || []).length === 12, 'mapLocations: 12 геттеров description');
    ok(!/\bname:\s*t\('/.test(ml) && !/\bdescription:\s*t\('/.test(ml), 'mapLocations: load-time t() отсутствует');
    const insFields = (ins.match(/get (name|npcName|secondaryNpcName|description)\(\) \{ return t\(/g) || []).length;
    ok(insFields === 62, `interiors: 62 полевых геттера (факт ${insFields})`);
    ok((ins.match(/get label\(\) \{ return t\(/g) || []).length === 19, 'interiors: 19 меток (BUILDINGS + VILLAGE_GATE) геттерами');
    ok(!/^\s*(name|npcName|secondaryNpcName|description):\s*t\('/m.test(ins), 'interiors: полевых load-time t() нет');
    ok(!/\blabel:\s*t\('/.test(ins), 'interiors: BUILDINGS и VILLAGE_GATE label без load-time t()');
}

// ============================================================
// 3. Восемь промахов словаря — обёрнуты
// ============================================================
console.log('--- 3. Восемь i18n-промахов (таблица 5 аудита) ---');
{
    const cs = read('game/src/scenes/CombatScene.js');
    const fs2 = read('game/src/scenes/ForestScene.js');
    const vs = read('game/src/scenes/VillageScene.js');
    const sp = read('game/src/systems/SettingsPanel.js');
    const bs = read('game/src/scenes/BootScene.js');
    const es = read('game/src/scenes/EndScene.js');
    const is2 = read('game/src/scenes/InteriorScene.js');
    const ls = read('game/src/scenes/LocationScene.js');

    ok(cs.includes("tf(t('Ты успешно бежал с поля боя (бросок {0})!')"), 'CombatScene: побег успех — tf(t(…))');
    ok(cs.includes("tf(t('Не удалось сбежать (бросок {0})! Враг атакует.')"), 'CombatScene: побег провал');
    ok(cs.includes("tf(t('⚔ Первый удар открыл мастерство противника: {0} — {1}.')"), 'CombatScene: первый удар');
    ok(!/tf\(\s*(['"`])[^'"`]*[\u0410-\u044f]/.test(cs), 'CombatScene: нет tf с сырой русской строкой');
    ok(cs.includes("createDialog(this, t('❓ Информация по игре')"), 'CombatScene: F1-заголовок локализован');
    ok(is2.includes("createDialog(this, t('❓ Информация по игре')"), 'InteriorScene: F1-заголовок');
    ok(ls.includes("createDialog(this, t('❓ Информация по игре')"), 'LocationScene: F1-заголовок');
    ok(fs2.includes("t('Уже собрано')"), 'ForestScene: «Уже собрано» обёрнуто');
    ok(vs.includes("q.currentObjective = t('Изгнан из деревни за дурную славу.')"), 'VillageScene: изгнание');
    ok(vs.includes("tf(t('Сейчас: {0}'), activity)"), 'VillageScene: тултип «Сейчас»');
    ok(vs.includes("tf(t('✨ Новолетие! Весенний год пошёл: лето {0}-е от Сотворения мира'), era)")
        && vs.includes("tf(t('✨ Новолетие! Настало лето {0}-е от Сотворения мира'), era)"),
        'VillageScene: анонс Новолетия ×2 — tf(t(…))');
    ok(sp.includes("tf(t('🌐 Язык: {0} → {1}')"), 'SettingsPanel: тумблер языка tf(t(…))');
    ok(bs.includes("createCharacter(t('Путник'))"), 'BootScene: дефолтное имя t(«Путник»)');
    ok(bs.includes("currentObjective: t('Поговори со старейшиной')"), 'BootScene: цель квеста t(…)');
    ok(/Путница\|Путник\(ка\)\?\|Wanderess\|Wanderer/.test(es), 'EndScene: регулярка знает EN-формы');
}

// ============================================================
// 4. BRPEngine.formatOpposedCheck — ФУНКЦИОНАЛЬНО RU/EN
// ============================================================
console.log('--- 4. formatOpposedCheck: RU/EN ---');
{
    const brp = await import(path.join(ROOT, 'game/src/systems/BRPEngine.js').replace('file://', ''));
    const res = { roll: 22, difficulty: 10, playerSkill: 45, npcValue: 40, npcRoll: 55, result: 'critical' };
    i18n.setLang('ru');
    const ru = brp.formatOpposedCheck(res, 'Убеждение', 'Убеждения жителя');
    ok(ru === 'бросок 22 при сложности +10: Убеждение 45 против Убеждения жителя 40 (бросок НПЦ 55) — ОСОБЫЙ УСПЕХ',
        'RU: канонический формат сохранён бит в бит');
    i18n.setLang('en');
    const en = brp.formatOpposedCheck(res, 'Persuade', "villager's Persuade");
    ok(en === 'roll 22 at difficulty +10: Persuade 45 vs villager\'s Persuade 40 (NPC roll 55) — SPECIAL SUCCESS',
        'EN: полностью английская строка');
    const enFail = brp.formatOpposedCheck({ ...res, result: 'fumble' }, 'Persuade', "villager's Persuade");
    ok(enFail.endsWith('— fumble'), 'EN: вердикт fumble');
    const enNoDiff = brp.formatOpposedCheck({ ...res, difficulty: 0 }, 'Persuade', "villager's Persuade");
    ok(enNoDiff.startsWith('roll 22:'), 'EN: без сложности — фрагмент опущен');
    ok(brp.formatOpposedCheck(null, 'X', 'Y') === '', 'гвард: res=null → пустая строка');
    i18n.setLang('ru');
}

// ============================================================
// 5. oppSkillLabel + вызывающие стороны
// ============================================================
console.log('--- 5. oppSkillLabel и локализация вызывающих сторон ---');
{
    const ns = await import(path.join(ROOT, 'game/src/data/npcStats.js').replace('file://', ''));
    const opp = { ruName: 'Убеждение', ruNameGen: 'Убеждения' };
    ok(ns.oppSkillLabel(opp, 'жителя') === 'Убеждения жителя', 'RU: родительный + принадлежность');
    i18n.setLang('en');
    ok(ns.oppSkillLabel(opp, 'жителя') === "villager's Persuade", 'EN: притяжательная форма');
    i18n.setLang('ru');

    const th = read('game/src/data/thief.js');
    const rp = read('game/src/data/reputation.js');
    const tr = read('game/src/systems/trade.js');
    const rb = read('game/src/systems/repBalance.js');
    ok((th.match(/oppSkillLabel\(opp, 'жителя'\)/g) || []).length === 1, 'thief: oppSkillLabel (житель)');
    ok(th.includes("t('Болтовни вора')") && th.includes("t('Рукопашной вора')") && th.includes("t('Внимательности вора')"),
        'thief: воровские подписи t(…)');
    ok(th.includes("t('Скрадывание')") && th.includes("t('Рукопашная')") && th.includes("t('Убеждение')"),
        'thief: имена навыков t(…)');
    ok((rp.match(/oppSkillLabel\(opp, 'жителя'\)/g) || []).length === 2, 'reputation: oppSkillLabel ×2');
    ok(tr.includes("oppSkillLabel(opp, 'торговца')") && tr.includes("tf(t(' (+{0} обаяние)'), edge)"),
        'trade: торговец + обаяние');
    ok(rb.includes("oppSkillLabel(opp, 'хозяина')") && rb.includes("tf(t(' ({0} обаяние)'), edge)"),
        'repBalance: хозяин + обаяние');
    ok(!/`\(\+\$\{edge\} обаяние\)`/.test(tr) && !/обаяние\)`/.test(rb), 'тамбл-обаяние: сырых шаблонов нет');
}

// ============================================================
// 6. Словарь: новые ключи есть, устаревших фиксированных нет
// ============================================================
console.log('--- 6. Словарь EN: 26 новых, 7 устаревших удалены ---');
{
    const src = read('game/src/systems/i18n.js');
    const newKeys = [
        "'❓ Информация по игре'", "'Уже собрано'", "'Изгнан из деревни за дурную славу.'",
        "'Поговори со старейшиной'", "'Ты успешно бежал с поля боя (бросок {0})!'",
        "'Не удалось сбежать (бросок {0})! Враг атакует.'", "'⚔ Первый удар открыл мастерство противника: {0} — {1}.'",
        "'ОСОБЫЙ УСПЕХ'", "'провал (fumble)'", "' при сложности {0}'",
        "'бросок {0}{1}: {2} {3} против {4} {5} (бросок НПЦ {6}) — {7}'",
        "' (+{0} обаяние)'", "' ({0} обаяние)'", "'Скрадывание'", "'Упорство'",
        "'Болтовни вора'", "'Рукопашной вора'", "'Внимательности вора'",
        "'✨ Новолетие! Весенний год пошёл: лето {0}-е от Сотворения мира'",
        "'✨ Новолетие! Настало лето {0}-е от Сотворения мира'",
        "'💸 Подарить {0} денег'", "'⛪ Замолить грехи ({0} д.)'",
        "'контратака +{0}%'", "'стрельба в упор −{0}%'", "'прицел +{0}%'",
        "'копьё против бездоспешного +{0}%'",
    ];
    let missing = newKeys.filter(k => !src.includes(k));
    ok(missing.length === 0, `новые ключи: 26/26${missing.length ? ', нет: ' + missing.join(', ') : ''}`);
    const oldKeys = ["'контратака +10%'", "'стрельба в упор −10%'", "'прицел +25%'",
        "'копьё против бездоспешного +10%'", "'⛪ Замолить грехи (50 д.)'",
        "'💸 Подарить 10 денег'", "'💸 Подарить 50 денег'"];
    let stale = oldKeys.filter(k => src.includes(k));
    ok(stale.length === 0, `устаревшие удалены: 7/7${stale.length ? ', остались: ' + stale.join(', ') : ''}`);
    // грамматика примет
    const wo = read('game/src/systems/WeatherOmens.js');
    ok(wo.includes('have flocked off the roofs') && !wo.includes('have flocking'), 'WeatherOmens EN: have flocked');
    // гривна-пара диалога
    ok(src.includes('Вира за кровь свободного мужа — 40 кун (80 д.)')
        && src.includes('40 kunas (80 d.)'), 'словарь: пара гривна→куны обновлена');
}

// ============================================================
// 7. ФУНКЦИОНАЛЬНО: runtime t() новых ключей
// ============================================================
console.log('--- 7. Runtime t(): новые ключи ---');
{
    i18n.setLang('en');
    ok(i18n.t('❓ Информация по игре') === '❓ Game Information', 'F1-заголовок EN');
    ok(i18n.t('Уже собрано') === 'Already gathered', '«Уже собрано» EN');
    ok(i18n.t('Поговори со старейшиной') === 'Talk to the elder', 'цель квеста EN');
    ok(i18n.tf(i18n.t('✨ Новолетие! Настало лето {0}-е от Сотворения мира'), 7534)
        .includes('7534'), 'Новолетие EN с числом');
    ok(i18n.tf(i18n.t('💸 Подарить {0} денег'), 10) === '💸 Gift 10 dengas', 'подарок EN');
    ok(i18n.t('Скрадывание') === 'Sneak' && i18n.t('Упорство') === 'Persistence', 'навыки EN');
    i18n.setLang('ru');
    ok(i18n.t('❓ Информация по игре') === '❓ Информация по игре', 'RU: фолбэк = исходная строка');
}

// ============================================================
// 8. Баланс в конфиг: WEAPONS одна таблица, COMBAT_MODS/SCENE_PRICES/SCENE_CHANCES
// ============================================================
console.log('--- 8. GameConfig: именованный баланс ---');
{
    const gc = await import(path.join(ROOT, 'game/src/config/GameConfig.js').replace('file://', ''));
    const src = read('game/src/config/GameConfig.js');
    const cs = read('game/src/scenes/CombatScene.js');

    ok(gc.WEAPONS === undefined, 'GameConfig: зеркала WEAPONS больше нет');
    ok(!/export const WEAPONS/.test(src), 'GameConfig: нет export const WEAPONS');
    const ch = await import(path.join(ROOT, 'game/src/systems/Character.js').replace('file://', ''));
    ok(ch.WEAPONS.crossbow && ch.WEAPONS.crossbow.price === 120, 'Character.WEAPONS: канон с crossbow (120 д.)');

    ok(gc.COMBAT_MODS.counterWindowBonus === 10 && gc.COMBAT_MODS.pointBlankPenalty === 10
        && gc.COMBAT_MODS.aimBonus === 25 && gc.COMBAT_MODS.spearFirstStrikeBonus === 10,
        'COMBAT_MODS: 10/10/25/10 — значения не менялись');
    ok(gc.COMBAT_MODS.moraleHpPct === 0.25 && gc.COMBAT_MODS.moraleMinPow === 5,
        'COMBAT_MODS: мораль 0.25 / мин.МОЩ 5');
    ok(gc.SCENE_PRICES.giftSmall.cost === 10 && gc.SCENE_PRICES.giftSmall.value === 5
        && gc.SCENE_PRICES.giftLarge.cost === 50 && gc.SCENE_PRICES.giftLarge.value === 25,
        'SCENE_PRICES: подарки 10/5 и 50/25');
    ok(gc.SCENE_CHANCES.potterCoinFind === 0.15 && gc.SCENE_CHANCES.potterCoinMin === 2
        && gc.SCENE_CHANCES.potterCoinMax === 4 && gc.SCENE_CHANCES.driedAppleFind === 0.2
        && gc.SCENE_CHANCES.roadAmbush === 0.6, 'SCENE_CHANCES: 0.15/2/4, 0.2, 0.6');

    ok(cs.includes('skill += COMBAT_MODS.counterWindowBonus'), 'CombatScene: контратака из конфига');
    ok(cs.includes('skill -= COMBAT_MODS.pointBlankPenalty'), 'CombatScene: в упор из конфига');
    ok(cs.includes('skill += COMBAT_MODS.aimBonus'), 'CombatScene: прицел из конфига');
    ok(cs.includes('skill += COMBAT_MODS.spearFirstStrikeBonus'), 'CombatScene: копьё из конфига');
    ok(cs.includes('COMBAT_MODS.moraleHpPct') && cs.includes('COMBAT_MODS.moraleMinPow'),
        'CombatScene: порог морали из конфига');
    ok(!/skill \+= 10;/.test(cs) && !/skill \+= 25;/.test(cs) && !/skill -= 10;/.test(cs),
        'CombatScene: магических чисел модификаторов больше нет');
    ok(cs.includes("tf(t('контратака +{0}%')"), 'CombatScene: метка контратаки — динамический шаблон');
    ok(!cs.includes("'контратака +10%'"), 'CombatScene: фиксированной метки нет');
    ok(cs.includes("import { WEAPONS, equipWeapon } from '../systems/Character.js';")
        && !cs.includes('CR_WEAPONS'), 'CombatScene: WEAPONS прямо из Character (без CR_WEAPONS)');

    const is2 = read('game/src/scenes/InteriorScene.js');
    const ls = read('game/src/scenes/LocationScene.js');
    ok(is2.includes('SCENE_PRICES.giftSmall.cost') && is2.includes('SCENE_PRICES.giftLarge.value'),
        'InteriorScene: цены подарков из конфига');
    ok(is2.includes('SCENE_CHANCES.potterCoinFind') && is2.includes('SCENE_CHANCES.driedAppleFind'),
        'InteriorScene: шансы гончара/яблок из конфига');
    ok(is2.includes("tf(t('⛪ Замолить грехи ({0} д.)'), ABSOLUTION_COST)"),
        'InteriorScene: панель епитимьи от ABSOLUTION_COST');
    ok(ls.includes('SCENE_CHANCES.roadAmbush'), 'LocationScene: засада из конфига');
}

// ============================================================
// 9. Гривна: согласована с лором денег (CURRENCY)
// ============================================================
console.log('--- 9. Гривна: вторая гривна изъята ---');
{
    const ju = read('game/src/systems/justice.js');
    const vs = read('game/src/scenes/VillageScene.js');
    const rp = read('game/src/data/reputation.js');
    const dl = read('game/src/data/dialogue.js');
    const ch = read('game/src/systems/Character.js');

    ok(/grivna:\s*\{ name: 'гривна',\s*short: 'гр.',\s*value: 100 \}/.test(ch), 'CURRENCY: гривна = 100 д. (канон цел)');
    ok(ju.includes('THEFT_VIRA_SALE = 24'), 'justice: THEFT_VIRA_SALE = 24 (баланс цел)');
    ok(ju.includes('24 д. = 12 кун по 2 д.') && !ju.includes('вира-«продажа» за татьбу — 12 гривен'), 'justice: комментарий в кунах');
    ok(vs.includes('24 д. = 12 кун по 2 д.') && !vs.includes('24 д. (12 гривен по 2 д.)'), 'VillageScene: комментарий в кунах');
    ok(!rp.includes('«Судебная гривна»') && rp.includes('40 кун'), 'reputation: «судебной гривны» больше нет');
    ok(dl.includes('40 кун (80 д.)') && !dl.includes('Вира за кровь свободного мужа — 40 гривен'), 'dialogue: вира в кунам');
}

// ============================================================
// 10. Комментарии = коду (модуль времени)
// ============================================================
console.log('--- 10. WorldClock/DialogueRunner: комментарии = коду ---');
{
    const wc = read('game/src/systems/WorldClock.js');
    const dr = read('game/src/systems/DialogueRunner.js');

    ok(/СООТНОШЕНИЕ РЕАЛЬНОГО И ИГРОВОГО ВРЕМЕНИ = 1:20/.test(wc), 'WorldClock: шапка 1:20');
    ok(!/= 1:30:/.test(wc), 'WorldClock: «= 1:30» удалено (историческое упоминание — с пометкой «было»)');
    ok(/20 ИГРОВЫХ минут/.test(wc) && !/30 ИГРОВЫХ минут/.test(wc), 'WorldClock: 20 игровых минут');
    ok(/проходит 20 минут игрового/.test(wc) && wc.includes('72 реальные минуты'), 'WorldClock: сутки = 72 реальные');
    ok(/TALK_MINUTES минут на беседу/.test(wc) && !/ровно 1 час на беседу/.test(wc),
        'WorldClock: беседа = TALK_MINUTES (10 мин)');
    ok(/не списывает время второй раз/.test(wc) && !/не списывает второй час/.test(wc),
        'WorldClock: дедупликация без «часа»');
    ok(/\(20 × 15 \/ 60\)/.test(wc) && /GAME_MINUTES_PER_REAL_MINUTE \* stepSec\) \/ 60; \/\/ 5/.test(wc), 'WorldClock: шаг = 5 (20×15/60)');
    ok(!/\/\/ 7\.5/.test(wc), 'WorldClock: 7.5 удалено');
    ok(/ровно 20 игровых минут \(1:20\)/.test(wc) && !/ровно 30 игровых минут/.test(wc),
        'WorldClock: за 60 с — ровно 20 игровых минут');
    ok(wc.includes('export const GAME_MINUTES_PER_REAL_MINUTE = 20;'), 'WorldClock: константа 20 целая');
    ok(wc.includes('export const TALK_MINUTES = 10;'), 'WorldClock: TALK_MINUTES = 10 целое');

    ok(!/ВСЕГДА 1 час/.test(dr), 'DialogueRunner: «ВСЕГДА 1 час» удалено');
    ok(/TALK_MINUTES \(10 минут\)/.test(dr), 'DialogueRunner: 10 минут по раунду 58');
    ok(dr.includes('chargeTalkTime(this.scene.registry, TALK_MINUTES, null)'), 'DialogueRunner: вызов цел');
}

// ============================================================
// 11. Связки: прошлые раунды целы (выборка смежных пинов)
// ============================================================
console.log('--- 11. Смежные инварианты ---');
{
    ok(read('game/src/scenes/CombatScene.js').includes('createDialog(this, t(\'❓ Информация по игре\')'),
        'F1: три сцены единообразны (t-обёртка)');
    const i18nSrc = read('game/src/systems/i18n.js');
    ok(i18nSrc.includes("'🌐 Язык: {0} → {1}': '🌐 Language: {0} → {1}'"), 'словарь: тумблер языка цел');
    ok(i18nSrc.includes("'Сейчас: {0}': 'Right now: {0}'"), 'словарь: «Сейчас» цел');
    ok(i18nSrc.includes("'Убеждение': 'Persuade'"), 'словарь: имя навыка цел');
    ok(!read('game/src/data/mapLocations.js').includes('name: t(') , 'mapLocations: чисто');
}

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail > 0 ? 1 : 0);

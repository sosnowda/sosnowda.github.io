#!/usr/bin/env node
/**
 * Юнит-проверки раунда 66.11 (приказы владельца):
 *  1. «НЕ ДОЛЖНО БЫТЬ НИКАКОГО РАЗБОЙНИЧЬЕГО ТАЙНИКА ИЛИ ЛОГОВА!» —
 *     разбойничий тайник 'S' (лут + засада) вырезан насовсем из леса;
 *     кострище осталось ТОЛЬКО как нейтральное место отдыха (р.65/66).
 *     Квест-погоня продолжает работать по правилам: вор бежит по локациям,
 *     оставляя следы, БЕЗ всякого логова (финал погони — локация вора).
 *  2. «ЕСЛИ НА ЛОКАЦИИ ГДЕ ПРОБЕГАЛ ВОР, БЫЛИ ИИ НПЦ, ТО ОНИ ОБЯЗАТЕЛЬНО
 *     ПРИ ДИАЛОГЕ И РАСПРОСАХ О ВОРЕ ДАДУТ НАВОДКУ НА ЛОКАЦИЮ, КУДА
 *     ПОБЕЖАЛ ВОР» — очевидцы-НПЦ (getPresence) — гарантированные свидетели.
 *  3. ЖЕНИТЬБА — ВЫИГРЫШ И КОНЕЦ ИГРЫ (наравне с +100 репутации);
 *     −100 репутации — по-прежнему Проигрыш (изгнание).
 * Запуск: node tools/test_round74.mjs (из папки game/).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FOREST_MAP, FOREST_SOLID, validateForestMap, campfirePos } from '../src/data/forest.js';
import {
    checkGameEnd, askNPC, isThiefEyewitnessPlace, isThiefAt, getChase,
} from '../src/data/thief.js';
import { marry, checkVictory, checkExpulsion, getVillageRep } from '../src/data/reputation.js';
import { ActionLog } from '../src/data/actionLog.js';
import { getLocationById } from '../src/data/mapLocations.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(root, p), 'utf8');

// Мини-реестр Phaser-стиля: get/set по ключам
function mockRegistry(init = {}) {
    const store = new Map(Object.entries(init));
    return {
        get: (k) => store.get(k),
        set: (k, v) => { store.set(k, v); },
    };
}

console.log('— П.1: разбойничий тайник удалён насовсем —');
ok(!FOREST_MAP.some(line => line.includes('S')), "лес: буква 'S' (тайник) вырезана из карты");
ok(!FOREST_SOLID.has('S'), "лес: 'S' убрана из непроходимых тайлов");
ok(FOREST_SOLID.has('C'), "лес: кострище 'C' осталось (отдых р.65/66)");
ok(validateForestMap().problems.length === 0, 'лес: валидатор карты без проблем (проверка тайника снята)');
const forestSrc = read('src/data/forest.js');
ok(!forestSrc.includes('FOREST_STASH'), 'forest.js: FOREST_STASH (лут/засада) удалён');
ok(!forestSrc.includes('stashPos'), 'forest.js: stashPos() удалён');
ok(!forestSrc.includes('разбойнич') && !forestSrc.includes('разбойник'), 'forest.js: слово «разбойник» вычищено');
const forestScene = read('src/scenes/ForestScene.js');
ok(!forestScene.includes('openStash'), 'ForestScene: openStash() удалён');
ok(!forestScene.includes('stashPos') && !forestScene.includes('FOREST_STASH'), 'ForestScene: импорты/вызовы тайника вычищены');
ok(!forestScene.includes('тайник'), 'ForestScene: слово «тайник» вычищено (справка F1 тоже)');
ok(forestScene.includes('restAtCampfire()') && forestScene.includes('spawnCampfire()'), 'ForestScene: отдых у костра сохранён');
const bootSrc = read('src/scenes/BootScene.js');
ok(!bootSrc.includes('deco_stash_mound'), 'BootScene: текстура тайника deco_stash_mound удалена');
const i18nSrc = read('src/systems/i18n.js');
ok(!i18nSrc.includes("Обыскать тайник разбойников"), 'i18n: EN-ключ «Обыскать тайник разбойников» удалён');
ok(!i18nSrc.includes("разбойничий тайник") && !i18nSrc.includes("Засада у тайника"), 'i18n: EN-ключи лута/засады тайника удалены');
ok(!i18nSrc.includes("bandits' stash") && !i18nSrc.includes("robbers' stash"), "i18n: EN-строки 'bandits' stash' удалены");
ok(campfirePos().col === 4 && campfirePos().row === 4, 'лес: кострище на прежнем месте (4,4)');

console.log('— П.2 (требование подтверждено): погоня БЕЗ логова — вор бежит по локациям —');
const thiefSrc = read('src/data/thief.js');
ok(thiefSrc.includes('After последней локации') || thiefSrc.includes('После последней локации вор сбегает'), 'thief.js: после последней локации вор сбегает (поражение) — без какого-либо логова');
ok(!thiefSrc.includes('логов') && !thiefSrc.includes('логово'), 'thief.js: в коде погони нет никакого логова/тайника');
ok(thiefSrc.includes("import { getPresence } from './npcPresence.js'"), 'thief.js: getPresence подключён для очевидцев');

console.log('— П.2: НПЦ на локации вора — ОБЯЗАТЕЛЬНАЯ наводка —');
const noon = { yearFromChrist: 1471, month: 5, day: 10, hour: 12, minute: 0 };
const basePlayer = { name: 'Добрыня', gender: 'male', skills: { spot: 30, persuade: 30, brawl: 30 }, dengas: 10, inventory: [], HP: 10, HPmax: 20, MP: 5, MPmax: 10 };
function chaseRegistry(over = {}) {
    const chase = {
        route: ['river', 'mill', 'field'], phase: 'stay', stop: 1,
        stays: [3, 3, 3], ticksLeft: 2, minutesAccum: 0,
        traces: { river: { wentTo: 'mill', side: 'before', leftAt: 0, life: 99999 } },
        gender: 'male', ...over,
    };
    const q = {
        chase, thiefWitnesses: ['widow'], thiefAskedFrom: [], cluesGathered: [],
        currentObjective: 'Найди и поймай вора!', ...over.quest,
    };
    return mockRegistry({ gameTime: noon, player: { ...basePlayer }, quest: q, reputation: { villageRep: 10, npcRep: {} } });
}
// Рыбак в полдень стоит на Реке (getPresence: fisherman noon → 'river'),
// вор пробегал Реку (остановка позади, следы живы) — наводка ОБЯЗАТЕЛЬНА
let reg = chaseRegistry();
let r = askNPC(reg, 'fisherman', 'Рыбак Елисей');
ok(r.gotClue === true, 'рыбак на Реке (вор пробегал) — наводка ГАРАНТИРОВАНА');
// Раунд 66.21 (грамматика наводок): имя локации склоняется —
// «прячется где-то у Ветряной мельницы» (родительный), а не «у „Ветряная мельница“».
ok(r.message.includes('Ветряной мельницы'), 'наводка ведёт на текущую локацию вора («у Ветряной мельницы», склонение 66.21)');
ok((reg.get('quest').npcHint || {}).locId === 'mill', 'наводка «прибила» вора (npcHint + срок 5 ч)');
ok(reg.get('quest').cluesGathered.length === 1 && reg.get('quest').cluesGathered[0].whereClue === true, 'улика попала в панель «Улики от жителей»');
// Очевидец — даже НЕ из случайного списка свидетелей (widow в списке, рыбак — нет)
ok(!reg.get('quest').thiefWitnesses.includes('fisherman'), 'рыбак не в случайном списке свидетелей р.30 — наводка именно по месту');
// Вор прячется НА локации НПЦ прямо сейчас — тоже обязательный очевидец
reg = chaseRegistry({ phase: 'stay', stop: 0, traces: {} });
ok(isThiefAt(reg, 'river') === true, 'вор сейчас на Реке');
r = askNPC(reg, 'fisherman', 'Рыбак Елисей');
ok(r.gotClue === true, 'НПЦ на локации, где вор ПРЯЧЕТСЯ СЕЙЧАС, даёт наводку');
// Будущая остановка: вор на Реку ещё НЕ добегал — честное «не видел»
reg = chaseRegistry({ phase: 'travel', stop: 0, traces: {} });
reg.get('quest').chase.route = ['field', 'river', 'mill'];
r = askNPC(reg, 'fisherman', 'Рыбак Елисей');
ok(r.gotClue === false, 'НПЦ на локации, куда вор ещё НЕ добежал, наводки не даёт');
// Контроль: тавернщик (место 'tavern' — вне погони), не свидетель → без наводки
reg = chaseRegistry();
r = askNPC(reg, 'tavernkeeper', 'Тавернщик');
ok(r.gotClue === false, 'НПЦ вне локаций погони (таверна) работает по старым правилам');
// Хелпер напрямую
reg = chaseRegistry();
ok(isThiefEyewitnessPlace(reg, 'fisherman') === true, 'isThiefEyewitnessPlace: пройденная локация → очевидец');
reg = chaseRegistry({ phase: 'travel', stop: 0, traces: {} });
reg.get('quest').chase.route = ['field', 'river', 'mill'];
ok(isThiefEyewitnessPlace(reg, 'fisherman') === false, 'isThiefEyewitnessPlace: будущая локация → не очевидец');

console.log('— П.3: ЖЕНИТЬБА — ВЫИГРЫШ И КОНЕЦ ИГРЫ —');
reg = mockRegistry({
    reputation: { villageRep: 60, npcRep: { widow: 95 } },
    npcs: [{ id: 'widow', name: 'Вдова Марфа', gender: 'female', age: 30, married: false, profession: { name: 'вдова-травница' } }],
    player: { ...basePlayer, dengas: 300 },
});
const mr = marry(reg, 'widow', reg.get('player'));
ok(mr.success === true, 'свадьба состоялась (условия р.44 выполнены)');
ok(reg.get('quest').marriageVictory === true, 'marry() поставила флаг q.marriageVictory');
ok(checkGameEnd(reg) === 'victory_marriage', "checkGameEnd → 'victory_marriage' (ВЫИГРЫШ и конец игры)");
// Проигрыши перебивают свадьбу (как и должно)
reg.set('quest', { ...reg.get('quest'), thiefEscaped: true });
ok(checkGameEnd(reg) === 'defeat_thief_escaped', 'побег вора приоритетнее свадьбы (поражение)');
reg.set('quest', { ...reg.get('quest'), thiefEscaped: false, expelledFromVillage: true });
ok(checkGameEnd(reg) === 'defeat_expelled', 'изгнание (−100 репутации) приоритетнее свадьбы (поражение)');
const interiorSrc = read('src/scenes/InteriorScene.js');
ok(interiorSrc.includes('СВАДЬБА — ПОБЕДА!') && interiorSrc.includes("scene.start('End')"), 'InteriorScene: окно свадьбы уводит в финал EndScene');
const endSrc = read('src/scenes/EndScene.js');
ok(endSrc.includes('💍 ПОБЕДА! СВАДЬБА СЫГРАНА'), 'EndScene: титул «💍 ПОБЕДА! СВАДЬБА СЫГРАНА»');
ok(endSrc.includes('victory_marriage') && endSrc.includes('quest.marriageVictory'), 'EndScene: исход victory_marriage подключён');

console.log('— П.3: ±100 репутации — старые победы/поражения живы —');
reg = mockRegistry({ reputation: { villageRep: 100, npcRep: {} }, quest: { repVictoryArmed: true } });
ok(checkVictory(reg).victory === true, '+100 репутации (с «продолжить игру») → победа');
ok(getVillageRep(reg) === 100, 'getVillageRep читается');
reg = mockRegistry({ reputation: { villageRep: -100, npcRep: {} } });
ok(checkExpulsion(reg).expelled === true, '−100 репутации → изгнание (проигрыш)');
ActionLog.init(reg);
const rating = ActionLog.get(reg).getRating('victory_marriage');
ok(rating.stars >= 3 && rating.title === 'Свадебный венец', 'оценка свадебного финала: «Свадебный венец»');
ok(rating.stats.victory === true, 'оценка свадебного финала: победа зачтена');

console.log(`\nИТОГО: ${pass} зелёных, ${fail} красных`);
process.exit(fail ? 1 : 0);

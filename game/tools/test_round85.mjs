// test_round85.mjs — РАУНД 66.28 (15 приказов владельца: БОЙ/ОРУЖИЕ/СТРЕЛЫ):
//   пп.1–4  честные надписи атаки по оружию в руках («Удар оружием» /
//           «Удар кулаком» / «Стрельба из лука») + «Смена оружия» (1 ход);
//   пп.5–12 стрелы: колчан отдельным слотом (макс 10), учёт при стрельбе,
//           поп-ап о пустом колчане, продажа пачками по 10, слот узла ≤10;
//   п.13    дичь крупнее — мяса больше (лестница размера);
//   пп.14–15 стражник: наводка «куда убежал вор» + НЕ нападает на вора.
// Запуск: node tools/test_round85.mjs
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    QUIVER_CAP, ARROW_SLOT_CAP, ARROW_PACK_SIZE, ARROW_PACK_PRICE,
    getQuiver, setQuiver, hasBowEquipped, countInventoryArrows,
    addArrowsToInventory, loadQuiver, unloadQuiver, spendArrow, quiverWord,
} from '../src/systems/ammo.js';
import { createCharacter, createPresetHero } from '../src/systems/Character.js';
import { GAME_ANIMALS } from '../src/data/forest.js';
import { INTERIORS } from '../src/data/interiors.js';
import {
    refreshGuardThiefTip, getFreshGuardThiefTip, guardThiefHintLine,
    isThiefAt,
} from '../src/data/thief.js';
import { ActionLog } from '../src/data/actionLog.js';

const GAME = dirname(fileURLToPath(import.meta.url));
const root = join(GAME, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };
const read = (p) => readFileSync(join(root, p), 'utf8');

const combatSrc = read('src/scenes/CombatScene.js');
const forestSrc = read('src/scenes/ForestScene.js');
const locationSrc = read('src/scenes/LocationScene.js');
const characterSrc = read('src/scenes/CharacterScene.js');
const interiorSrc = read('src/scenes/InteriorScene.js');
const villageSrc = read('src/scenes/VillageScene.js');
const thiefSrc = read('src/data/thief.js');
const i18nSrc = read('src/systems/i18n.js');
const ammoSrc = read('src/systems/ammo.js');

// ----- [1] Система стрел/колчана (пп.5,10,11) -----
console.log('\n[1] Стрелы и колчан: вместимость 10, слот узла ≤10, пачки по 10');
ok(QUIVER_CAP === 10, 'QUIVER_CAP = 10 (п.10)');
ok(ARROW_SLOT_CAP === 10, 'ARROW_SLOT_CAP = 10 (п.11: в слоте инвентаря до 10 стрел)');
ok(ARROW_PACK_SIZE === 10 && ARROW_PACK_PRICE === 5, 'пачка = 10 стрел за 5 д. (пп.9,12)');

const p1 = { inventory: [] };
ok(addArrowsToInventory(p1, 10) === 10, 'пачка 10 стрел ложится в узел');
ok(p1.inventory.length === 1 && p1.inventory[0].count === 10, 'один слот, count=10 (не более 10 в слоте)');
ok(addArrowsToInventory(p1, 10) === 10, 'вторая пачка — ещё 10');
ok(p1.inventory.length === 2 && p1.inventory.every(i => i.count === 10),
    'две пачки — ДВА слота по 10 (п.11: в одном слоте не более 10)');
ok(addArrowsToInventory(p1, 25) === 25 && p1.inventory.every(i => (i.count || 0) <= 10),
    '25 штук — ни один слот не превышает 10');
ok(countInventoryArrows(p1) === 45, `в узле суммарно 45 (${countInventoryArrows(p1)})`);

// Колчан: наложение/трата/высыпание
const p2 = { inventory: [] };
addArrowsToInventory(p2, 15);
ok(loadQuiver(p2) === 10 && getQuiver(p2) === 10, 'наложил в колчан 10 (вместимость, п.10)');
ok(loadQuiver(p2) === 0 && getQuiver(p2) === 10, 'повторное наложение — 0 (колчан полон)');
ok(countInventoryArrows(p2) === 5, 'в узле осталось 5');
ok(spendArrow(p2) === true && getQuiver(p2) === 9, 'выстрел тратит стрелу из колчана');
ok(unloadQuiver(p2) === 9 && getQuiver(p2) === 0 && countInventoryArrows(p2) === 14,
    'высыпал 9 стрел в узел — 14 в узле, колчан пуст');
ok(spendArrow(p2) === false, 'пустой колчан — spendArrow = false');
ok(setQuiver(p2, 99) === 10 && setQuiver(p2, -5) === 0, 'клэмп колчана 0..10');
// quiverWord: 1 стрела, 2..4 стрелы, 5.. стрел, 0 — нет стрел
ok(quiverWord(1) === 'стрела' && quiverWord(3) === 'стрелы' && quiverWord(10) === 'стрел' && quiverWord(0) === 'нет стрел',
    'quiverWord: 1 стрела / 3 стрелы / 10 стрел / 0 — нет стрел');

// ----- [2] Стартовый колчан героев (пп.5,10) -----
console.log('\n[2] Герои: следопыт с луком получает полный колчан');
const ranger = createPresetHero('ranger_m');
ok(ranger.weaponId === 'bow' && getQuiver(ranger) === 10, `следопыт: лук + колчан 10 (${getQuiver(ranger)})`);
const warrior = createPresetHero('warrior_m');
ok(warrior.weaponId === 'sword' && getQuiver(warrior) === 0, 'воин: меч, колчан пуст');
const bare = createCharacter('Тест', { weaponId: 'knife' });
ok(getQuiver(bare) === 0 && hasBowEquipped(bare) === false, 'без лука — колчан 0, hasBowEquipped=false');

// ----- [3] Боевые кнопки по оружию в руках (пп.1–4) -----
console.log('\n[3] Бой: честные надписи атаки + смена оружия за ход');
ok(combatSrc.includes("t('Удар оружием')"), 'кнопка «Удар оружием» (п.1: в руках не лук)');
ok(combatSrc.includes("t('Стрельба из лука')"), 'кнопка «Стрельба из лука» (п.2: переименование «Лука»)');
ok(combatSrc.includes("t('Удар кулаком')"), 'кнопка «Удар кулаком» (п.3: оружия нет)');
ok(combatSrc.includes("t('🎒 Смена оружия')") && combatSrc.includes('openWeaponSwapPanel'),
    'кнопка «Смена оружия» открывает панель инвентаря (п.4)');
ok(combatSrc.includes('equipWeapon(p, w.id)') && combatSrc.includes('enemyTurn()') && combatSrc.includes('Потрачен ход'),
    'смена оружия экипирует и тратит ход (п.4)');
ok(combatSrc.includes('loadQuiver(p)') && combatSrc.includes('Наложил стрелы в колчан'),
    'наложение стрел в колчан из боевой панели (ход)');
ok(combatSrc.includes('perRow') && combatSrc.includes("height - 50 - row * 52"),
    'кнопки боя переносятся на второй ряд на узких экранах');
ok(combatSrc.includes('spendArrow(this.player)') && combatSrc.includes("t('Колчан пуст!')"),
    'стрельба тратит стрелу; пустой колчан — поп-ап (пп.7,8)');
ok(combatSrc.includes('playBowShot') && combatSrc.includes('resolvePlayerAttack'),
    'стрельба из лука — полёт стрелы (без выпада)');
ok(/Between\(5,\s*9\)/.test(combatSrc), 'волк (крупный зверь) даёт 5–9 мяса (п.13)');

// ----- [4] Охота учитывает колчан (пп.7,8) -----
console.log('\n[4] Охота: выстрел требует стрелу в колчане');
ok(forestSrc.includes("from '../systems/ammo.js'") && forestSrc.includes('getQuiver(player) <= 0'),
    'лес: пустой колчан — поп-ап, время не тратится');
ok(forestSrc.includes('spendArrow(player)'), 'лес: стрела уходит из колчана при выстреле');
ok(locationSrc.includes("from '../systems/ammo.js'") && locationSrc.includes('getQuiver(player) <= 0'),
    'поляна: пустой колчан — поп-ап');
ok(locationSrc.includes('spendArrow(player)'), 'поляна: стрела уходит при выстреле');

// ----- [5] Меню персонажа: колчан отдельным слотом (пп.6,10,11) -----
console.log('\n[5] Персонаж: колчан — отдельный слот меню');
ok(characterSrc.includes("id: 'equipped_quiver'"), 'третья карточка снаряжения — колчан (п.6)');
ok(characterSrc.includes('showQuiverCard') && characterSrc.includes('showArrowsCard'),
    'карточки колчана и стрел (наложение/высыпание)');
ok(characterSrc.includes('loadQuiver(p)') && characterSrc.includes('unloadQuiver(p)'),
    'наложение и высыпание стрел на экране персонажа');
ok(characterSrc.includes("getQuiver(p)}/${QUIVER_CAP}"), 'строка снаряжения показывает Колчан: N/10');

// ----- [6] Продажа стрел пачками (пп.9,12) -----
console.log('\n[6] Лавки: пачка стрел (10 шт.) у кузнеца и у ремесленника');
const shopTools = INTERIORS.shop_tools;
const packItem = (shopTools.market && shopTools.market.items || []).find(i => i.id === 'arrows_pack');
ok(!!packItem && packItem.kind === 'ammo' && packItem.price === 5, 'Аверьян: «Пачка стрел (10 шт.)» за 5 д., kind=ammo');
ok(interiorSrc.includes("kind === 'ammo'") && interiorSrc.includes('addArrowsToInventory(player, ARROW_PACK_SIZE)'),
    'рынок: покупка ammo кладёт ровно пачку 10 в узел (п.12)');
ok(interiorSrc.includes('ARROW_PACK_SIZE') && interiorSrc.includes('Купил пачку стрел'),
    'кузнец: строка «Пачка стрел» с покупкой пачки (п.9)');
ok(interiorSrc.includes('Стрелы — пачками по 10'), 'подсказка кузницы упоминает пачки по 10');

// ----- [7] Лестница мяса по размеру дичи (п.13) -----
console.log('\n[7] Дичь: чем крупнее — тем больше мяса');
const hare = GAME_ANIMALS.hare.meat, bird = GAME_ANIMALS.bird.meat, roe = GAME_ANIMALS.roe.meat;
ok(hare[1] <= bird[0] && bird[1] < roe[0],
    `заяц ${hare}<глухарь ${bird}<косуля ${roe} (строго по размеру)`);
ok(roe[0] >= 4 && roe[1] >= 5, `косуля много мяса: ${roe}`);

// ----- [8] Стражник: наводка на вора (пп.14,15) -----
console.log('\n[8] Стражник: наводка «куда убежал вор», НЕ нападает');
// Минимальный registry-двойник (как в chase-симуляциях)
function mkRegistry() {
    const store = new Map();
    return {
        get: (k) => store.get(k),
        set: (k, v) => { store.set(k, v); return v; },
    };
}
const reg = mkRegistry();
// 07:00 утра: стадо ещё на водопое (окно 6..10), пастухи при нём,
// пахарь Тарас НА ПОЛЕ → стражник обходит ПАШНЮ (guardPatrolPlace)
reg.set('gameTime', { yearFromChrist: 1500, month: 0, day: 1, hour: 7, minute: 0 });
reg.set('npcSeed', 7);
ActionLog.init(reg);
const quest = {
    chase: {
        route: ['field', 'lake', 'river'],
        phase: 'stay', stop: 0, ticksLeft: 5, stays: [5, 5, 5],
        minutesAccum: 0, traces: {}, gender: 'male',
    },
    cluesGathered: [],
};
reg.set('quest', quest);
ok(isThiefAt(reg, 'field'), 'вор сидит на Ржаном поле');
// Утром пахарь на поле → стражник обходит ПАШНЮ — одна локация с ворам
const tip = refreshGuardThiefTip(reg);
ok(!!tip, 'стражник на одной локации с ворам — наводка получена (п.14)');
ok(tip && tip.fromLocId === 'field' && tip.nextLocId === 'lake',
    `наводка: видел у Ржаного поля, бежит к Святому озеру (${tip && tip.fromLocId}→${tip && tip.nextLocId})`);
const line = guardThiefHintLine(reg, 'Стражник Илья');
ok(!!line && line.includes('видел тут вора') && line.includes('Святому озеру'),
    'реплика стражника: «только что видел тут вора… убежал к Святому озеру»');
ok((quest.cluesGathered || []).length === 1 && quest.cluesGathered[0].npcId === 'guard',
    'улика стражника добавлена в панель улик (один раз на наблюдение)');
const line2 = guardThiefHintLine(reg, 'Стражник Илья');
ok(!!line2 && quest.cluesGathered.length === 1, 'повторный вопрос — улика не дублируется');
// Пока стражник ВИДИТ вора — наводка освежается: 13:00 (noon) он снова на пашне
reg.get('gameTime').hour = 13; reg.get('gameTime').minute = 0;
const tip2 = refreshGuardThiefTip(reg);
ok(!!tip2 && tip2.issuedAtMin > tip.issuedAtMin, 'в полдень стражник опять при ворам — наводка освежена');
// 21:00 (dusk) стражник заступает на вахту у ворот — вора не видит;
// с полудня прошло 8 ч > 5 ч — наводка истекла
reg.get('gameTime').hour = 21;
ok(getFreshGuardThiefTip(reg) === null, 'вечером наводка истекла (5 ч, как у НПЦ)');
// Вор не на локации стражника — наводки нет
reg.get('gameTime').hour = 7; reg.get('gameTime').minute = 0;
quest.chase.route = ['lake', 'field', 'river'];
ok(refreshGuardThiefTip(reg) === null, 'стражник на пашне, вор у озера — наводки нет');
// п.15: стражник не нападает — механики схватки нет и не заводится
ok(!thiefSrc.includes('guardAttack') && !/guard[^\n]{0,40}(attack|fight|нападaeт|нападает)/i.test(thiefSrc),
    'п.15: в thief.js нет механики атаки стражником вора');
ok(thiefSrc.includes('СТРАЖНИК НЕ НАПАДАЕТ НА ВОРА'), 'п.15: правило задокументировано в коде');
// Кнопка диалога у стражника (деревня + локация)
ok(villageSrc.includes("npcId === 'guard' && isChaseActive") && villageSrc.includes('guardThiefHintLine'),
    'деревня: у стражника кнопка «Спросить про вора»');
ok(locationSrc.includes('isGuard') && locationSrc.includes('guardThiefHintLine'),
    'локация: у стражника своя ветка наводки (без лимита «один раз»)');

// ----- [9] EN-словарь не сломан, ключи на месте -----
console.log('\n[9] Локализация');
for (const key of ["'Удар оружием'", "'Стрельба из лука'", "'Удар кулаком'", "'🎒 Смена оружия'", "'Колчан пуст!'", "'Пачка стрел (10 шт.)'", "'🧭 Спросить про вора'"]) {
    ok(i18nSrc.includes(key + ':') || new RegExp(`\\n    ${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`).test(i18nSrc),
        `EN-словарь содержит ${key}`);
}
ok(ammoSrc.includes("t('стрелы')") && ammoSrc.includes("t('нет стрел')"), 'quiverWord использует t() (EN)');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

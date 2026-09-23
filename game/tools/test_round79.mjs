// ТЕСТ РАУНДА 66.17 — 13 ПРИКАЗОВ ВЛАДЕЛЬЦА (добыча/еда/сна/охота):
//  1\ простая еда (+1 HP: яблоко/мёд) vs ПОЛНОЦЕННАЯ в трактире (каша 3, хлеб 2);
//  2\ отдых 8+ часов — здоровье ПОЛНОСТЬЮ;
//  3\ отдых меньше 8 часов — ПРОПОРЦИОНАЛЬНО (8 ч = 100%), сон не менее 2 часов;
//  4\ кнопка «Съесть» для инвентаря (CharacterScene.showFoodCard + tryEatFood);
//  5\ продажа добычи (трактирщик/мясник, showSellLootMenu + sellableLoot);
//  6\ ставка подёнки — минимум +1 к репутации в сутки (workInPotter);
//  7\ сырую рыбу нельзя есть — только продать или приготовить;
//  8\ готовка рыбы/мяса на костре (лес + выпас, cookAtCampfire);
//  9\ дичь: зайцы/глухари на поляне и в лесу, косуля — редко и только в чаще;
// 10\ стрельба из лука по дичи (шанс = база вида + навык/2, лук экипирован);
// 11\ мясо с туши дичи и убитого волка (случайно, по размеру зверя);
// 12\ удочка — товар Аверьяна (магазин);
// 13\ рыбалка: своя удочка ИЛИ чужая уда на броду (Ерёмина, ~60% дней).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

// ---------- Мок-registry ----------
function makeRegistry(hour = 9, minute = 30) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour, minute });
    return reg;
}

const {
    MEAL_HEAL_HP, REST_FULL_HEAL_MIN, SLEEP_MIN_MIN, restHealPct,
    canEat, registerMeal, MEAL_COOLDOWN_MIN, MEAL_DURATION_MIN,
} = await import(join(ROOT, 'game/src/systems/meal.js'));

const {
    LOOT_DEFS, SIMPLE_FOOD_DEFS, getLootDef,
    addItem, removeItem, countOf, sellableLoot,
    shotChance, fishingCatchCount, tryEatFood,
} = await import(join(ROOT, 'game/src/systems/loot.js'));

const { GAME_ANIMALS, planForestAnimals, validateForestMap } =
    await import(join(ROOT, 'game/src/data/forest.js'));

const { INTERIORS } = await import(join(ROOT, 'game/src/data/interiors.js'));

// ============================================================
// 1. Проработка приказа 1: простая еда vs полноценная (трактир)
// ============================================================
console.log('— п.1: простая еда (+1) vs полноценная в трактире (2–3) —');
{
    ok(MEAL_HEAL_HP === 1, 'простая еда (яблоко/мёд/грибы/рацион) лечит ровно +1 HP');
    const src = read('game/src/scenes/InteriorScene.js');
    ok(/id: 'kasha'.*heal: 3/.test(src), 'трактир: каша — полноценная еда, +3 HP');
    ok(/id: 'bread'.*heal: 2/.test(src), 'трактир: хлеб — полноценная еда, +2 HP');
    ok(/id: 'mead'.*heal: 1/.test(src) && /id: 'kvass'.*heal: 1/.test(src), 'медовуха/квас — питьё, +1 HP');
    ok(LOOT_DEFS.fish_cooked.heal === 2 && LOOT_DEFS.fish_cooked.edible, 'печёная рыба — полноценная, +2 HP, съедобна');
    ok(LOOT_DEFS.meat_cooked.heal === 3 && LOOT_DEFS.meat_cooked.edible, 'жаркое из дичи — полноценное, +3 HP, съедобно');
    ok(SIMPLE_FOOD_DEFS.ration.heal === 1, 'рацион — простая еда, +1 HP');
    ok(MEAL_DURATION_MIN === 60, 'любая еда — по-прежнему ровно 1 час');
    ok(MEAL_COOLDOWN_MIN === 240, 'кулдаун еды общий — 4 часа');
}

// ============================================================
// 2–3. Отдых: 8+ ч = 100%, меньше — пропорция, минимум 2 часа
// ============================================================
console.log('— пп.2-3: пропорциональный отдых, сон ≥ 2 часов —');
{
    ok(REST_FULL_HEAL_MIN === 480, '100% восстановления = 8 часов (480 мин)');
    ok(restHealPct(480) === 1, '8 часов → 100%');
    ok(restHealPct(600) === 1 && restHealPct(720) === 1, '9–12 часов → тоже 100% (полное)');
    ok(Math.abs(restHealPct(120) - 0.25) < 1e-9, '2 часа → 25%');
    ok(Math.abs(restHealPct(240) - 0.5) < 1e-9, '4 часа → 50%');
    ok(Math.abs(restHealPct(360) - 0.75) < 1e-9, '6 часов → 75%');
    ok(restHealPct(0) === 0 && restHealPct(-50) === 0, '0/отрицательное → 0%');
    ok(SLEEP_MIN_MIN === 120, 'минимальный сон — 2 часа (120 мин)');

    const src = read('game/src/scenes/InteriorScene.js');
    ok(src.includes('[2, 3, 4, 6, 8, 12]'), 'меню отдыха: пункт «1 час» снят (минимум 2 ч)');
    ok(src.includes("if (mins < SLEEP_MIN_MIN) return null;"), '«до X» с сном < 2 ч не предлагается');
    ok(src.includes('sleepMinutes < SLEEP_MIN_MIN'), 'restInTavern: страховка — сон < 2 ч отменяется');
    ok(src.includes('restHealPct(sleepMinutes)'), 'лечение в таверне — по доле restHealPct');
    ok(!src.includes('(player.HPmax || 10) * 0.34'), 'старое «~1/3 лечения» (коэффициент 0.34) удалено');
}

// ============================================================
// 4. «Съесть» в инвентаре
// ============================================================
console.log('— п.4: кнопка «Съесть» для инвентаря —');
{
    const src = read('game/src/scenes/CharacterScene.js');
    ok(src.includes('showFoodCard'), 'CharacterScene: карточка еды showFoodCard()');
    ok(src.includes("'🍽 Съесть'") || src.includes('t(\'🍽 Съесть\')'), 'кнопка «Съесть» в карточке предмета');
    ok(src.includes('tryEatFood'), 'еда из узла идёт через единый tryEatFood (правила meal.js)');
    ok(src.includes('getLootDef(item.id)'), 'съестное помечается в сетке инвентаря');

    // Юнит-прогон tryEatFood через мок-сцену (без Phaser-рисования: add = null,
    // поп-апы не рисуются — проверяем коды исхода и состояние узла/времени)
    const reg = makeRegistry();
    const player = { HP: 5, HPmax: 10, MP: 2, MPmax: 4, dengas: 10, inventory: [] };
    reg.set('player', player);
    const scene = { registry: reg, add: null };
    addItem(player, 'fish_cooked', 2);
    const res = tryEatFood(scene, player, 'fish_cooked');
    ok(res.ok === true && res.heal === 2, 'съел печёную рыбу: +2 HP');
    ok(player.HP === 7, 'HP 5 → 7');
    ok(countOf(player, 'fish_cooked') === 1, 'из узла ушла 1 штука');
    ok(canEat(reg).ok === false, 'после еды кулдаун 4 часа активен');
    const res2 = tryEatFood(scene, player, 'fish_cooked');
    ok(res2.ok === false && res2.reason === 'cooldown', 'вторая попытка — «герой сытый» (cooldown)');
    ok(countOf(player, 'fish_cooked') === 1, 'кукдаун: штука НЕ потрачена');
    const loot = read('game/src/systems/loot.js');
    ok(loot.includes('Сырым это не едят: приготовь на костре'), 'поп-ап «сырым не едят» с советом готовить/продавать');
    ok(loot.includes('showMealBlockedPopup(scene)'), 'поп-ап «герой сытый» — общий с meal.js');
}

// ============================================================
// 5. Продажа добычи
// ============================================================
console.log('— п.5: продажа добычи —');
{
    ok(LOOT_DEFS.fish_raw.sell === 2 && LOOT_DEFS.fish_cooked.sell === 4, 'рыба: сырая 2 д., печёная 4 д.');
    ok(LOOT_DEFS.meat_raw.sell === 3 && LOOT_DEFS.meat_cooked.sell === 5, 'мясо: сырое 3 д., жаркое 5 д.');
    const src = read('game/src/scenes/InteriorScene.js');
    ok(src.includes('showSellLootMenu'), 'панель продажи добычи showSellLootMenu()');
    ok(src.includes("'\\u{1F4B0} Продать добычу'"), 'кнопка «Продать добычу»');
    ok(/id === 'tavern'[\s\S]{0,900}Продать добычу/.test(src), 'продажа у трактирщика (Фёдор, кухня)');
    ok(/butcher_house'[\s\S]{0,300}Продать добычу/.test(src), 'продажа у мясника (Потап, столешня)');
    ok(src.includes('willNpcRefuseTrade'), 'дурная слава блокирует и скупку добычи');

    const player = { HP: 5, HPmax: 10, inventory: [] };
    addItem(player, 'fish_raw', 3);
    addItem(player, 'meat_cooked', 2);
    const rows = sellableLoot(player);
    ok(rows.length === 2, 'sellableLoot: 2 позиции');
    const fishRow = rows.find(r => r.def.id === 'fish_raw');
    ok(fishRow.count === 3 && fishRow.price === 2, 'рыба ×3 по 2 д.');
    ok(removeItem(player, 'fish_raw', 2) === 2 && countOf(player, 'fish_raw') === 1, 'removeItem: снято 2 из 3');
    ok(removeItem(player, 'fish_raw', 5) === 1 && countOf(player, 'fish_raw') === 0, 'пересъём: не больше остатка');
    ok(!player.inventory.some(i => i.id === 'fish_raw'), 'пустая позиция удалена из узла');
}

// ============================================================
// 6. Ставка подёнки: +1 репутации в сутки
// ============================================================
console.log('— п.6: ставка подёнки (+1 реп/сутки) —');
{
    const src = read('game/src/scenes/InteriorScene.js');
    ok(src.includes("q66.dayworkRepDay !== today66"), 'подёнка: слава +1 не чаще раза в сутки');
    ok(src.includes("changeVillageRep(this.registry, 1, 'подённая работа')"), 'начисление +1 к славе деревни');
    ok(src.includes('dayKeyOf(getTime(this.registry))'), 'сутки считаются по игровому дню');
}

// ============================================================
// 7. Сырая рыба: есть нельзя
// ============================================================
console.log('— п.7: сырую рыбу нельзя есть —');
{
    ok(LOOT_DEFS.fish_raw.edible === false, 'fish_raw: edible = false');
    ok(LOOT_DEFS.meat_raw.edible === false, 'meat_raw: edible = false (готовить на костре)');

    const reg = makeRegistry();
    const player = { HP: 5, HPmax: 10, inventory: [] };
    reg.set('player', player);
    const scene = { registry: reg, add: null };
    addItem(player, 'fish_raw', 1);
    const res = tryEatFood(scene, player, 'fish_raw');
    ok(res.ok === false && res.reason === 'not_edible', 'сырую рыбу съесть нельзя — «сырым не едят»');
    ok(countOf(player, 'fish_raw') === 1, 'сырая рыба осталась в узле');
    ok(canEat(reg).ok === true, 'попытка съесть сырое НЕ ставит кулдаун еды');
}

// ============================================================
// 8. Готовка на костре (лес + выпас)
// ============================================================
console.log('— п.8: готовка рыбы/мяса на костре —');
{
    ok(LOOT_DEFS.fish_raw.cookTo === 'fish_cooked' && LOOT_DEFS.fish_raw.cookMinutes === 30, 'рыба → печёная за 30 мин');
    ok(LOOT_DEFS.meat_raw.cookTo === 'meat_cooked' && LOOT_DEFS.meat_raw.cookMinutes === 30, 'мясо → жаркое за 30 мин');
    const forest = read('game/src/scenes/ForestScene.js');
    ok(forest.includes("cookAtCampfire('fish_raw')") && forest.includes("cookAtCampfire('meat_raw')"), 'лес: кострище готовит рыбу и мясо');
    ok(forest.includes('Приготовить рыбу'), 'лес: пункт «Приготовить рыбу» в меню костра');
    const loc = read('game/src/scenes/LocationScene.js');
    ok(loc.includes("cookAtCampfire('fish_raw')") && loc.includes("cookAtCampfire('meat_raw')"), 'выпас: костёр пастухов тоже готовит');
    ok(forest.includes('getLootDef(rawId)') && loc.includes('getLootDef(rawId)'), 'готовка конвертирует 1 сырую → 1 готовую');
}

// ============================================================
// 9. Дичь: зайцы/глухари, косуля — редко и только в чаще
// ============================================================
console.log('— п.9: дичь на поляне и в лесу —');
{
    ok(GAME_ANIMALS.hare && GAME_ANIMALS.bird && GAME_ANIMALS.roe, 'три вида дичи: заяц, глухарь, косуля');
    ok(GAME_ANIMALS.roe.rare === true && GAME_ANIMALS.roe.maxRow === 7, 'косуля: редко (25%) и только в чаще (ряды 0..7)');
    ok(GAME_ANIMALS.bird.flying === true, 'глухарь — крупная летающая птица (спугнул — упорхнула)');
    ok(GAME_ANIMALS.hare.meat[1] === 2 && GAME_ANIMALS.roe.meat[1] === 5, 'мясо по размеру: заяц ≤2, косуля до 5');

    // Спавн-план: только проходимые тайлы, косуля — только север
    for (let i = 0; i < 30; i++) {
        const plan = planForestAnimals();
        for (const a of plan) {
            if (a.kind === 'roe') ok(a.row <= 7, `косуля в чаще (ряд ${a.row} ≤ 7)`);
            if (a.row < 0 || a.row > 21 || a.col < 0 || a.col > 29) ok(false, 'спавн вне карты!');
        }
    }
    ok(true, '30 прогонов спавна: тайлы в границах, косуля — на севере');
    const glade = read('game/src/scenes/LocationScene.js');
    ok(glade.includes('spawnGladeAnimals') && glade.includes("locationId === 'forest_glade'"), 'поляна: дичь появляется (кликабельная)');
    ok(!glade.includes("kind: 'roe'"), 'на поляне косули НЕТ (только в чаще)');
    ok(validateForestMap().problems.length === 0, 'карта леса после добавлений по-прежнему валидна');
}

// ============================================================
// 10. Стрельба из лука (лук в узле и экипирован)
// ============================================================
console.log('— п.10: стрельба из лука по дичи —');
{
    ok(shotChance(45, 0) === 45, 'шанс = база вида при навыке 0');
    ok(shotChance(45, 55) === 73, 'заяц (45) + навык 55/2 = 73%');
    ok(shotChance(30, 60) === 60, 'глухарь (30) + навык 60/2 = 60%');
    ok(shotChance(55, 90) === 90, 'клэмп сверху: не выше 90%');
    ok(shotChance(45, -10) === 45, 'отрицательный навык обрезается до 0 (шанс = база)');
    const forest = read('game/src/scenes/ForestScene.js');
    ok(forest.includes("player.weaponId !== 'bow'"), 'без экипированного лука выстрел невозможен');
    ok(forest.includes('Стрелять из лука ({0})'), 'подсказка «Стрелять из лука (зверь)» по E');
    ok(forest.includes('shotChance(animal.cfg.base'), 'шанс = база вида + навык стрельбы');
    const loc = read('game/src/scenes/LocationScene.js');
    ok(loc.includes("player.weaponId !== 'bow'"), 'поляна: без лука — только подсказка');
    ok(loc.includes('shotChance(cfg.base'), 'поляна: шанс по той же формуле');
}

// ============================================================
// 11. Мясо с туши дичи и волка
// ============================================================
console.log('— п.11: мясо с туши дичи/волка —');
{
    ok(LOOT_DEFS.meat_raw.edible === false && LOOT_DEFS.meat_cooked.edible === true, 'мясо сырое не едят, жаркое — едят');
    const forest = read('game/src/scenes/ForestScene.js');
    ok(forest.includes('lootAnimalCorpse'), 'лес: обдир туши lootAnimalCorpse()');
    ok(forest.includes("addItem(player, 'meat_raw', n)"), 'мясо сыром падает в узел');
    ok(forest.includes('Phaser.Math.Between(minM, maxM)'), 'количество мяса случайно (meat: [мин,макс])');
    const combat = read('game/src/scenes/CombatScene.js');
    ok(combat.includes("this.enemyKeys.includes('wolf')"), 'волк: мясо начисляется после победы');
    ok(combat.includes("addItem(this.player, 'meat_raw', meatN)"), 'волк: 2–4 сырое мясо в узел');
    ok(combat.includes('Phaser.Math.Between(2, 4)'), 'волк — зверь крупнее зайца: 2–4 шт.');
}

// ============================================================
// 12. Удочка в магазине
// ============================================================
console.log('— п.12: удочка — товар —');
{
    const market = INTERIORS.shop_tools.market.items.find(i => i.id === 'rod');
    ok(!!market, 'у Аверьяна (Дом ремесленника) продается УДОЧКА');
    ok(market && market.kind === 'gear' && market.price === 12, 'удочка: 12 д., снаряжение «в узел»');
    const src = read('game/src/scenes/InteriorScene.js');
    ok(src.includes("item.kind === 'gear'"), 'market: kind «gear» кладёт товар в узел (а не съедается)');
}

// ============================================================
// 13. Рыбалка: своя удочка ИЛИ чужая уда на броду
// ============================================================
console.log('— п.13: рыбалка с удочкой / чужой уды —');
{
    ok(fishingCatchCount({ seasonId: 'normal', raining: false, winter: false, ownRod: true }) === 1, 'своей удочкой, обычный день: 1 рыба');
    ok(fishingCatchCount({ seasonId: 'autumn_feed', raining: true, winter: false, ownRod: true }) === 3, 'жор + дождь: 3 рыбы');
    ok(fishingCatchCount({ seasonId: 'normal', raining: true, winter: false, ownRod: true }) === 2, 'дождь: +1 рыба');
    ok(fishingCatchCount({ seasonId: 'autumn_feed', raining: false, winter: false, ownRod: true }) === 2, 'осенний жор: +1 рыба');
    ok(fishingCatchCount({ seasonId: 'normal', raining: false, winter: true, ownRod: true }) === 1, 'зима (налим из лунки): 1 рыба');
    ok(fishingCatchCount({ seasonId: 'autumn_feed', raining: true, winter: false, ownRod: false }) === 2, 'чужая уда: −1 (доля хозяину), но не меньше 1');
    ok(fishingCatchCount({ seasonId: 'normal', raining: false, winter: false, ownRod: false }) === 1, 'чужой удой в обычный день: 1 рыба');

    const loc = read('game/src/scenes/LocationScene.js');
    ok(loc.includes("countOf(player, 'rod') > 0"), 'рыбалка: проверка СВОЕЙ удочки в узле');
    ok(loc.includes('strangersRodPresent'), 'чужая уда на броду (детерминировано по дню)');
    ok(loc.includes('hash % 100 < 60'), 'Ерёмина уда стоит ~60% дней');
    ok(loc.includes("addItem(player, 'fish_raw', catchN)"), 'улов — сырая рыба В УЗЕЛ');
    ok(!loc.includes('canEat'), 'рыбалка больше НЕ еда: проверки кулдауна еды сняты');
    ok(!loc.includes('registerMeal'), 'рыбалка больше НЕ ставит кулдаун еды');
}

// ============================================================
// i18n: новые ключи имеют EN-переводы
// ============================================================
console.log('— i18n: EN-покрытие новых строк —');
{
    const src = read('game/src/systems/i18n.js');
    const keys = [
        '— вернёт ~{0}% здоровья',
        '— сон {0} ({1} д.), ~{2}% здоровья',
        '💰 Продать добычу',
        'Ставка подёнки: +1 к славе в деревне за отработанный день.',
        'Сырую рыбу не едят: приготовь на костре или продай трактирщику/мяснику.',
        '🔥 Приготовить рыбу ({0} мин)',
        'Стрелять из лука ({0})',
        'Обобрать дичь ({0})',
        'Обобрал тушу убитого волка: +{0} сырое мясо (приготовить на костре или продать).',
        '🍽 Съесть',
        'Удочка',
        'Рыба (сырая)',
        'Жаркое из дичи',
        'Костёр: отдых и готовка',
        'Подстрелил {0} на поляне из лука и обобрал тушу: +{1} сырое мясо (приготовить или продать).',
    ];
    let missing = 0;
    for (const k of keys) {
        const found = src.includes(`'${k}':`) || src.includes(`'${k}'`);
        if (!found) { missing++; console.log('    отсутствует EN-ключ: ' + k); }
    }
    ok(missing === 0, 'все новые ключи 66.17 есть в i18n (15 проверено)');
    // сироты старых рыбалочных строк сняты
    ok(!src.includes("'Порыбачил через лунку — налим к ужину"), 'сирота «налим к ужину (+{0} ❤)» удалена');
    ok(!src.includes("'— лечение ~1/3'"), 'сирота «— лечение ~1/3» удалена');
    ok(!src.includes("'Отдохнуть у костра (1 час)'"), 'сирота «Отдохнуть у костра (1 час)» удалена');
}

// ============================================================
// Ассеты: процедурные текстуры дичи/удочки
// ============================================================
console.log('— BootScene: текстуры дичи и удочки —');
{
    const boot = read('game/src/scenes/BootScene.js');
    for (const tex of ['game_hare', 'game_hare_dead', 'game_bird', 'game_bird_dead', 'game_roe', 'game_roe_dead', 'deco_fishing_rod']) {
        ok(boot.includes(`generateTexture('${tex}'`), `текстура ${tex} генерируется процедурно`);
    }
}

// ============================================================
// Итог
// ============================================================
console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail > 0 ? 1 : 0);

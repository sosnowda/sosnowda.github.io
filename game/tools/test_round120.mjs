// test_round120.mjs — 66.72: ПРИКАЗЫ ВЛАДЕЛЬЦА (голод, еда, навыки, молитва, слух):
//  1\ Система Голода: норма 2 трапезы/сутки (полдень/вечер), счётчик в HUD,
//     ролловер суток — штраф −1 HP за пропуск (макс −2, HP ≥ 1), летопись;
//  2\ Ягоды — еда сразу (из узла), сырые грибы есть НЕЛЬЗЯ — только костёр
//     (жареные грибы); грибы и ягоды ПРОДАЮТСЯ на постоялом дворе;
//  3\ Полное Здоровье + трава → «Вы полностью здоровы. Трава осталась в узле»;
//  4\ Выживание — ПРОВЕРЯЕМЫЙ: сбор трав/грибов/ягод, снятие шкур, мясо дичи;
//     сбор ягод: провал — ничего, успех — горсть (2), крит — ×2 (4);
//  5\ Новый навык Готовка: провал — продукты пропали; крит — качество +1;
//  6\ Молитва: откат 8 часов, «Молитва не услышана!», благословение +5 к
//     ОДНОЙ проверке навыка (списывается первой);
//  7\ Знахарство — ПРОВЕРЯЕМЫЙ: применение лекарственных трав (не еда);
//  8\ Слух — игровое применение: «Подслушать молву» на постоялом дворе.
// Запуск из корня репозитория: node game/tools/test_round118.mjs
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
function setTime(reg, hour, minute, day = 14) {
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day, hour, minute });
}

// ---------- Детерминированный d100 (подмена Math.random) ----------
const realRandom = Math.random;
function rollOnce(randValue) { // randValue 0..1 → d100 = 1+floor(rand*100)
    Math.random = () => randValue;
}
function restoreRandom() { Math.random = realRandom; }

// ---------- Импорты модулей ----------
const {
    MEALS_REQUIRED_PER_DAY, hungerStatus, noteHungerMeal, hungerRolloverCheck,
    hungerStatusLine, NOON_WINDOW, EVENING_WINDOW,
} = await import(join(ROOT, 'game/src/systems/hunger.js'));

const { registerMeal, MEAL_COOLDOWN_MIN, canUseHerb } =
    await import(join(ROOT, 'game/src/systems/meal.js'));

const {
    LOOT_DEFS, getLootDef, addItem, removeItem, countOf, sellableLoot,
    tryEatFood, cookAtFire, applyHerb, survivalGather, survivalButcher,
    GATHER_SUCCESS_AMOUNT, gatherItemId,
} = await import(join(ROOT, 'game/src/systems/loot.js'));

const {
    PRAYER_COOLDOWN_MIN, PRAYER_SKILL_BONUS, canPray, registerPrayer, consumePrayerBless,
} = await import(join(ROOT, 'game/src/systems/prayer.js'));

const { overheardRumorLine } = await import(join(ROOT, 'game/src/data/rumors.js'));
const { forestGatherSpots } = await import(join(ROOT, 'game/src/data/forest.js'));

// ============================================================
console.log('— 1. ГОЛОД: норма 2 трапезы/сутки (приказы 1–2) —');
{
    ok(MEALS_REQUIRED_PER_DAY === 2, 'норма — ровно 2 трапезы за игровые сутки');
    ok(NOON_WINDOW[0] === 10 && NOON_WINDOW[1] === 14, 'окно полудня 10–14 ч (ориентир «днём в полдень»)');
    ok(EVENING_WINDOW[0] === 17 && EVENING_WINDOW[1] === 21, 'окно вечера 17–21 ч (ориентир «и вечером»)');

    const reg = makeRegistry(11, 0);
    let st = hungerStatus(reg);
    ok(st.meals === 0 && st.required === 2 && !st.fed, 'начало дня: 0/2, норма не выполнена');

    noteHungerMeal(reg);
    st = hungerStatus(reg);
    ok(st.meals === 1, 'первая трапеза: счётчик 1');
    ok(hungerStatusLine(reg) === '🍽1/2 ⚠', 'HUD-строка «🍽1/2 ⚠» пока голодает');

    noteHungerMeal(reg);
    st = hungerStatus(reg);
    ok(st.meals === 2 && st.fed, 'вторая трапеза: 2/2, норма выполнена');
    ok(hungerStatusLine(reg) === '🍽2/2', 'HUD-строка «🍽2/2» без предупреждения');

    // Ролловер: день сменился, вчера съедено 2 → штрафа нет
    setTime(reg, 8, 0, 15);
    let ev = hungerRolloverCheck(reg);
    ok(ev && ev.dayChanged && ev.missed === 0 && ev.penalty === 0, 'ролловер при 2/2 — штрафов нет, счётчик обнулён');
    ok(hungerStatus(reg).meals === 0, 'новый день: счётчик с нуля');

    // Ролловер: вчера 0 трапез → пропущено 2 → штраф −2 (но HP ≥ 1).
    // Первый вызов в день 14 инициализирует счётчик (как первый tickTime в игре).
    const reg2 = makeRegistry(23, 0);
    reg2.set('player', { HP: 10, HPmax: 12 });
    hungerRolloverCheck(reg2); // первый тик: инициализация счётчика на текущий день
    setTime(reg2, 6, 0, 15);
    ev = hungerRolloverCheck(reg2);
    ok(ev && ev.missed === 2 && ev.penalty === 2 && ev.healed === 2, 'голод (0 трапез): штраф −2 HP');
    ok(reg2.get('player').HP === 8, 'HP 10 → 8 после голодного ролловера');
    ok(!!reg2.get('hungerPenaltyPending'), 'флаг hungerPenaltyPending для поп-апа сцены');

    // Голод не убивает: HP 2 → 1 (не ниже 1)
    const reg3 = makeRegistry(23, 0);
    reg3.set('player', { HP: 2, HPmax: 12 });
    hungerRolloverCheck(reg3);
    setTime(reg3, 6, 0, 15);
    ev = hungerRolloverCheck(reg3);
    ok(ev.healed === 1 && reg3.get('player').HP === 1, 'голод НЕ убивает: HP держится на 1');

    // Ролловер: вчера 1 трапеза → штраф −1
    const reg4 = makeRegistry(23, 0);
    reg4.set('player', { HP: 9, HPmax: 12 });
    hungerRolloverCheck(reg4); // инициализация на день 14
    noteHungerMeal(reg4);
    setTime(reg4, 6, 0, 15);
    ev = hungerRolloverCheck(reg4);
    ok(ev.missed === 1 && ev.healed === 1 && reg4.get('player').HP === 8, '1 трапеза за сутки → −1 HP');

    // Еда (registerMeal) кормит голод автоматически
    const reg5 = makeRegistry(12, 0);
    registerMeal(reg5);
    ok(hungerStatus(reg5).meals === 1, 'registerMeal = +1 к суточному счётчику голода');
    ok(MEAL_COOLDOWN_MIN === 240, 'кулдаун еды 4 ч не изменён');

    // tickTime вызывает ролловер-проверку (статика)
    const ts = read('game/src/systems/TimeSystem.js');
    ok(ts.includes("import { hungerRolloverCheck } from './hunger.js'") && ts.includes('hungerRolloverCheck(registry);'),
        'TimeSystem.tickTime вызывает hungerRolloverCheck при каждом тике');
    const mealSrc = read('game/src/systems/meal.js');
    ok(mealSrc.includes('noteHungerMeal(registry)'), 'meal.js registerMeal отмечает трапезу в системе голода');
}

// ============================================================
console.log('— 2. ЯГОДЫ/ГРИБЫ: еда, костёр, продажа (приказы 3–4) —');
{
    ok(LOOT_DEFS.berry && LOOT_DEFS.berry.edible && LOOT_DEFS.berry.heal === 1 && LOOT_DEFS.berry.sell === 1,
        'ягоды лесные: едят сразу (+1 HP), цена продажи 1 д.');
    ok(LOOT_DEFS.mushroom_raw && !LOOT_DEFS.mushroom_raw.edible && LOOT_DEFS.mushroom_raw.cookTo === 'mushroom_fried',
        'сырые грибы НЕ едятся — только готовить (cookTo: жареные)');
    ok(LOOT_DEFS.mushroom_fried && LOOT_DEFS.mushroom_fried.edible && LOOT_DEFS.mushroom_fried.heal === 2,
        'жареные грибы — готовая еда (+2 HP)');
    ok(LOOT_DEFS.skin && !LOOT_DEFS.skin.edible && LOOT_DEFS.skin.sell === 4, 'шкура — товар (4 д.), не еда');
    ok(LOOT_DEFS.herb && LOOT_DEFS.herb.medicinal && LOOT_DEFS.herb.heal === 1 && !LOOT_DEFS.herb.edible,
        'зверобой — лекарственная трава (+1, канон 66.71), не еда');

    // Продажа на постоялом дворе: sellableLoot перечисляет всё (LOOT_DEFS)
    const p = { HP: 5, HPmax: 12, inventory: [] };
    addItem(p, 'berry', 3); addItem(p, 'mushroom_raw', 2); addItem(p, 'mushroom_fried', 1); addItem(p, 'skin', 1);
    const rows = sellableLoot(p).map(r => r.def.id);
    ok(['berry', 'mushroom_raw', 'mushroom_fried', 'skin'].every(id => rows.includes(id)),
        'трактирщик/мясник принимают ягоды, сырые и жареные грибы, шкуры');

    // Ягоды едят из узла (простая еда, meal.js)
    const reg = makeRegistry(9, 0);
    const p2 = { HP: 5, HPmax: 12, inventory: [] };
    addItem(p2, 'berry', 2);
    const scene = { registry: reg, add: null };
    const res = tryEatFood(scene, p2, 'berry');
    ok(res.ok && res.heal === 1 && countOf(p2, 'berry') === 1, '«Съесть» из узла: ягода +1 HP, списана 1 шт.');

    // Бонусное блюдо (крит Готовки) — отдельный def «удалось на славу» (heal+1)
    const p3 = { HP: 5, HPmax: 12, inventory: [] };
    addItem(p3, 'mushroom_fried', 2);
    addItem(p3, 'mushroom_fried_tasty', 1);
    ok(countOf(p3, 'mushroom_fried') === 2 && countOf(p3, 'mushroom_fried_tasty') === 1,
        'обычные и «удавшиеся на славу» грибы — отдельные кучки по id');
    const res3 = tryEatFood({ registry: makeRegistry(13, 0), add: null }, p3, 'mushroom_fried_tasty');
    ok(res3.ok && res3.heal === 3, 'блюдо «удалось на славу» сытнее: +3 HP (было бы +2)');
    ok(LOOT_DEFS.fish_cooked_tasty.heal === 3 && LOOT_DEFS.meat_cooked_tasty.heal === 4
        && LOOT_DEFS.fish_cooked_tasty.sell > LOOT_DEFS.fish_cooked.sell,
        'все *_tasty: лечение +1 к базовому, продаются дороже');
}

// ============================================================
console.log('— 3. ГОТОВКА: провал — продукты пропали, крит — +1 (приказ 9) —');
{
    const srcLoot = read('game/src/systems/loot.js');
    ok(srcLoot.includes('export function cookAtFire'), 'loot.js: единая cookAtFire (проверка Готовки)');
    ok(srcLoot.includes("consumePrayerBless(registry)"), 'готовка списывает благословение молитвы');

    // НЕУДАЧА: сырьё пропало
    const reg = makeRegistry(10, 0);
    const p = { HP: 5, HPmax: 12, skills: { cooking: 40 }, inventory: [] };
    addItem(p, 'fish_raw', 1);
    rollOnce(0.99); // d100=100 → fumble при навыке < 50
    const r1 = cookAtFire(reg, p, 'fish_raw', { skill: 40 });
    restoreRandom();
    ok(r1.lost === true && r1.ok === false, 'провал Готовки → продукты ПРОПАЛИ');
    ok(countOf(p, 'fish_raw') === 0 && countOf(p, 'fish_cooked') === 0, 'сырьё сгорело, блюда нет');
    ok(reg.get('gameTime').minute === 30, 'время у костра потрачено (30 мин) даже при провале');

    // КРИТ: блюдо «удалось на славу»
    const p2 = { HP: 5, HPmax: 12, skills: { cooking: 40 }, inventory: [] };
    addItem(p2, 'fish_raw', 1);
    rollOnce(0.0); // d100=1 → крит
    const r2 = cookAtFire(reg, p2, 'fish_raw', { skill: 40 });
    restoreRandom();
    ok(r2.ok && r2.crit && r2.producedId === 'fish_cooked_tasty' && countOf(p2, 'fish_cooked_tasty') === 1,
        'крит Готовки → блюдо «удалось на славу» (+1 к качеству)');
    ok(countOf(p2, 'fish_cooked') === 0, 'обычного блюда при крите не производится');

    // УСПЕХ: обычное блюдо
    const p3 = { HP: 5, HPmax: 12, skills: { cooking: 40 }, inventory: [] };
    addItem(p3, 'fish_raw', 1);
    rollOnce(0.5); // d100=51 ≤ 40? нет… возьмём 0.2 → d100=21 ≤ 40 успех
    const r3 = cookAtFire(reg, p3, 'fish_raw', { skill: 40 });
    restoreRandom();
    // 0.5*100=51 > 40 → провал; проверим честно оба варианта по порогу:
    ok(r3.ok === (Math.floor(0.5 * 100) + 1 <= 40), 'результат согласован с броском d100');
    // точный успех:
    const p4 = { HP: 5, HPmax: 12, skills: { cooking: 40 }, inventory: [] };
    addItem(p4, 'fish_raw', 1);
    rollOnce(0.2); // d100=21 → успех (не крит: порог крита floor(40/20)=2)
    const r4 = cookAtFire(reg, p4, 'fish_raw', { skill: 40 });
    restoreRandom();
    ok(r4.ok && !r4.crit && r4.bonusHeal === 0 && countOf(p4, 'fish_cooked') === 1, 'обычный успех: 1 сырое → 1 готовое, без бонуса');

    ok(cookAtFire(reg, p4, 'meat_cooked').reason === 'not_cookable', 'готовое блюдо приготовить нельзя');
    ok(cookAtFire(reg, p4, 'meat_raw').reason === 'no_item', 'нет сырья — готовка не начинается');

    // Сцены ведут готовку через навык
    const forestSrc = read('game/src/scenes/ForestScene.js');
    const locSrc = read('game/src/scenes/LocationScene.js');
    ok(forestSrc.includes("cookAtFire(this.registry, player, rawId, { skill: player.skills.cooking })"),
        'ForestScene: костёр — проверка Готовки игрока');
    ok(locSrc.includes("cookAtFire(this.registry, player, rawId, { skill: player.skills.cooking })"),
        'LocationScene: пастуший костёр — проверка Готовки игрока');
    ok(forestSrc.includes("cookAtCampfire('mushroom_raw')") && locSrc.includes("cookAtCampfire('mushroom_raw')"),
        'в меню обоих костров есть «Жарить грибы»');
}

// ============================================================
console.log('— 4. ВЫЖИВАНИЕ: сбор (провал/горсть/×2) и обдир (приказы 8, 10) —');
{
    ok(GATHER_SUCCESS_AMOUNT.berry === 2 && GATHER_SUCCESS_AMOUNT.mushroom === 2 && GATHER_SUCCESS_AMOUNT.herb === 1,
        'лестница сбора: горсть = 2 (ягоды/грибы), зверобой = 1');
    ok(gatherItemId('berry') === 'berry' && gatherItemId('mushroom') === 'mushroom_raw' && gatherItemId('herb') === 'herb',
        'вид точки → id предмета узла');

    // НЕУДАЧА — ничего не собрал
    const reg = makeRegistry(10, 0);
    const p = { HP: 5, HPmax: 12, skills: { survival: 30 }, inventory: [] };
    rollOnce(0.99); // d100=100 → fumble
    const r1 = survivalGather(reg, p, 'berry');
    restoreRandom();
    ok(r1.gathered === 0 && r1.ok === false && !p.inventory.length, 'неудача Выживания: НИЧЕГО не собрал, узел пуст');

    // УСПЕХ — горсть (2 ягоды)
    rollOnce(0.2); // d100=21 ≤ 30, не крит (порог 1)
    const r2 = survivalGather(reg, p, 'berry');
    restoreRandom();
    ok(r2.ok && r2.gathered === 2 && countOf(p, 'berry') === 2, 'успех: горсть = 2 ягоды в узел');

    // КРИТ — ×2 (4 ягоды)
    rollOnce(0.0); // d100=1 → крит
    const r3 = survivalGather(reg, p, 'berry');
    restoreRandom();
    ok(r3.crit && r3.gathered === 4 && countOf(p, 'berry') === 6, 'крит: количество ×2 → +4 ягоды');

    // Грибы сырые идут в узел (не жареные!), зверобой — 1/2
    rollOnce(0.2); const r4 = survivalGather(reg, p, 'mushroom'); restoreRandom();
    ok(r4.itemId === 'mushroom_raw' && r4.gathered === 2, 'грибы собираются СЫРЫМИ (mushroom_raw)');
    rollOnce(0.2); const r5 = survivalGather(reg, p, 'herb'); restoreRandom();
    ok(r5.gathered === 1 && countOf(p, 'herb') === 1, 'зверобой: успех = 1 трава');
    rollOnce(0.0); const r6 = survivalGather(reg, p, 'herb'); restoreRandom();
    ok(r6.gathered === 2, 'зверобой: крит = 2 травы');

    // Обдир туши: успех — мясо + шкура; неудача — половина без шкуры; крит — ×2
    const p2 = { HP: 5, HPmax: 12, skills: { survival: 40 }, inventory: [] };
    rollOnce(0.2); // d100=21 успех
    const b1 = survivalButcher(reg, p2, [5, 9], true);
    restoreRandom();
    ok(b1.ok && b1.meat >= 5 && b1.meat <= 9 && b1.skin === 1, 'обдир: успех — мясо по размеру зверя + шкура');
    const p3 = { HP: 5, HPmax: 12, skills: { survival: 40 }, inventory: [] };
    rollOnce(0.99); // fumble
    const b2 = survivalButcher(reg, p3, [5, 9], true);
    restoreRandom();
    ok(b2.skin === 0 && b2.meat >= 1 && b2.meat <= 4, 'обдир: неудача — неловкий обдир (половина мяса, шкура порвана)');
    const p4 = { HP: 5, HPmax: 12, skills: { survival: 40 }, inventory: [] };
    rollOnce(0.0); // крит
    const b3 = survivalButcher(reg, p4, [5, 9], true);
    restoreRandom();
    ok(b3.crit && b3.skin === 1 && b3.meat >= 10 && b3.meat <= 18, 'обдир: крит — мясо ×2 и шкура');
    const p5 = { HP: 5, HPmax: 12, skills: { survival: 40 }, inventory: [] };
    rollOnce(0.2);
    const b4 = survivalButcher(reg, p5, [2, 3], false); // глухарь
    restoreRandom();
    ok(b4.ok && b4.skin === 0, 'у глухаря шкуры нет');

    // Статика сцен: шкуры/обдир через Выживание
    const combatSrc = read('game/src/scenes/CombatScene.js');
    ok(combatSrc.includes('survivalButcher(this.registry, this.player, [5, 9], true)'),
        'CombatScene: волчья туша — проверка Выживания (5–9, шкура)');
    const locSrc = read('game/src/scenes/LocationScene.js');
    ok(locSrc.includes("survivalButcher(this.registry, player, cfg.meat, cfg.id !== 'bird')"),
        'LocationScene: обдир на поляне — Выживание (глухарь без шкуры)');
    const forestSrc = read('game/src/scenes/ForestScene.js');
    ok(forestSrc.includes('survivalGather(this.registry, this.player, entry.kind)'),
        'ForestScene: сбор в лесу — проверка Выживания');
    const spots = forestGatherSpots();
    ok(spots.length > 0 && spots.every(s => /Выживание/.test(s.prompt)),
        'все точки сбора подписаны как проверка Выживания');
    ok(spots.every(s => !/\+1 ❤/.test(s.prompt)), 'подсказки «съедено на месте» убраны из подписей');
}

// ============================================================
console.log('— 5. ЗНАХАРСТВО: травы лечат по проверке, полное HP — трава в узле (приказы 7, 13) —');
{
    // Приказ 7: полное Здоровье — трава ОСТАЁТСЯ в узле
    const reg = makeRegistry(10, 0);
    const p = { HP: 12, HPmax: 12, skills: { medicine: 40 }, inventory: [] };
    addItem(p, 'herb', 2);
    const r0 = applyHerb(reg, p, 'herb', { skill: 40 });
    ok(r0.reason === 'full_hp' && countOf(p, 'herb') === 2 && p.HP === 12,
        'при полном Здоровье трава не тратится — осталась в узле');
    const charSrc = read('game/src/scenes/CharacterScene.js');
    ok(charSrc.includes("t('Вы полностью здоровы. Трава осталась в узле.')"),
        'CharacterScene показывает формулировку приказа дословно');

    // Успех: +1 (особый — ×2). Свой registry: у травы 12-часовой кулдаун.
    const regB = makeRegistry(10, 0);
    const p2 = { HP: 6, HPmax: 12, skills: { medicine: 40 }, inventory: [] };
    addItem(p2, 'herb', 1);
    rollOnce(0.0); // d100=1 → крит (и особый: порог особого floor(40/5)=8)
    const r1 = applyHerb(regB, p2, 'herb', { skill: 40 });
    restoreRandom();
    ok(r1.ok && r1.crit && r1.heal === 2 && p2.HP === 8, 'особый успех Знахарства: лечение ×2 (трава +1 → +2)');

    // Обычный успех
    const regC = makeRegistry(10, 0);
    const p3 = { HP: 6, HPmax: 12, skills: { medicine: 40 }, inventory: [] };
    addItem(p3, 'herb', 1);
    rollOnce(0.2); // d100=21 успех, не особый (>8), не крит
    const r2 = applyHerb(regC, p3, 'herb', { skill: 40 });
    restoreRandom();
    ok(r2.ok && !r2.crit && r2.heal === 1 && countOf(p3, 'herb') === 0, 'успех Знахарства: трава +1 HP (канон 66.71), потрачена');

    // Провал: трава впустую
    const regD = makeRegistry(10, 0);
    const p4 = { HP: 6, HPmax: 12, skills: { medicine: 40 }, inventory: [] };
    addItem(p4, 'herb', 1);
    rollOnce(0.99);
    const r3 = applyHerb(regD, p4, 'herb', { skill: 40 });
    restoreRandom();
    ok(!r3.ok && r3.reason === 'failed' && p4.HP === 6 && countOf(p4, 'herb') === 0,
        'провал Знахарства: лечения нет, трава испорчена впустую');

    // Кулдаун трав 12 ч (канон 66.71): сразу второй приём — herb_cooldown
    const p5 = { HP: 6, HPmax: 12, skills: { medicine: 40 }, inventory: [] };
    addItem(p5, 'herb', 1);
    const r4 = applyHerb(regD, p5, 'herb', { skill: 40 }); // regD: провал выше уже ставил откат
    ok(!r4.ok && r4.reason === 'herb_cooldown' && countOf(p5, 'herb') === 1,
        'кулдаун трав 12 ч: повторное применение блокировано, трава осталась');
    // fumble-провал выше ТОЖЕ зарегистрировал откат (трава потрачена) — проверяем,
    // что кулдаун ставится даже при провале (registerHerb внутри applyHerb)
    ok(!canUseHerb(regD).ok, 'registerHerb ставит точку отката даже при провале Знахарства');
}

// ============================================================
console.log('— 6. МОЛИТВА: откат 8 ч, «не услышана», +5 к одной проверке (приказ 11) —');
{
    ok(PRAYER_COOLDOWN_MIN === 480, 'откат Молитвы — 8 игровых часов');
    ok(PRAYER_SKILL_BONUS === 5, 'благословение — +5 ко всем навыкам на ОДНУ проверку');

    const reg = makeRegistry(8, 0);
    ok(canPray(reg).ok, 'до молитвы откат пуст');
    registerPrayer(reg);
    ok(!canPray(reg).ok && canPray(reg).minutesLeft === 480, 'сразу после молитвы: откат 480 мин');
    ok(consumePrayerBless(reg) === 5, 'благословение даёт +5 первой проверке');
    ok(consumePrayerBless(reg) === 0, 'благословение списывается ОДНОКРАТНО (вторая проверка без бонуса)');

    setTime(reg, 16, 1); // +8 ч 1 мин → откат истёк
    ok(canPray(reg).ok, 'через 8+ часов молиться можно снова');

    const intSrc = read('game/src/scenes/InteriorScene.js');
    ok(intSrc.includes('Молитва не услышана!'), 'поп-ап при неистёкшем откате: «Молитва не услышана!»');
    ok(intSrc.includes('canPray(this.registry)') && intSrc.includes('registerPrayer(this.registry)'),
        'prayInChurch проверяет откат и регистрирует молитву через prayer.js');
    ok(!intSrc.includes('q.prayerDay === today'), 'старый лимит «раз в игровой день» снят');
}

// ============================================================
console.log('— 7. СЛУХ: «Подслушать молву» на постоялом дворе (приказ 14) —');
{
    const intSrc = read('game/src/scenes/InteriorScene.js');
    ok(intSrc.includes('Подслушать (Слух)'), 'кнопка «👂 Подслушать (Слух)» в меню трактирщика');
    ok(intSrc.includes('eavesdropTavern') && intSrc.includes('skills.listen'),
        'проверка Слуха (player.skills.listen) в eavesdropTavern');
    ok(intSrc.includes('consumePrayerBless(this.registry)'), 'благословение молитвы работает и на Слух');

    const rumSrc = read('game/src/data/rumors.js');
    ok(rumSrc.includes('export function overheardRumorLine'), 'rumors.js: молва для подслушивания');
    ok(rumSrc.includes('постоялый двор — средоточие молвы'), 'историческое обоснование зафиксировано в коде');

    // Молва выдаётся, пока лента не иссякла
    const reg = makeRegistry(12, 0);
    let got = 0, exhausted = false;
    for (let i = 0; i < 300; i++) {
        const line = overheardRumorLine(reg);
        if (line) got++; else { exhausted = true; break; }
    }
    ok(got > 0, 'успешный Слух даёт молву из ленты');
    ok(exhausted, 'лента молвы иссякает (без бесконечных повторов)');
}

// ============================================================
console.log('— 8. НАВЫК ГОТОВКА в системе персонажа; HUD-счётчик сытости —');
{
    const chrSrc = read('game/src/systems/Character.js');
    ok(/key: 'cooking', name: 'Готовка', base: 15, attr: 'POW'/.test(chrSrc),
        'SKILLS: новый навык Готовка (МОЩ — канон 66.71, категория знаний)');
    const { SKILLS } = await import(join(ROOT, 'game/src/systems/Character.js'));
    const cook = SKILLS.find(s => s.key === 'cooking');
    ok(!!cook && cook.category === 'knowledge', 'Готовка импортируется и в категории «Знания»');

    const forestSrc = read('game/src/scenes/ForestScene.js');
    const villageSrc = read('game/src/scenes/VillageScene.js');
    const intSrc = read('game/src/scenes/InteriorScene.js');
    ok(forestSrc.includes('hungerStatusLine(this.registry)'), 'HUD леса показывает 🍽-счётчик');
    ok(villageSrc.includes('hungerStatusLine(this.registry)'), 'HUD деревни показывает 🍽-счётчик');
    ok(intSrc.includes('hungerStatusLine(this.registry)'), 'HUD постоялого двора показывает 🍽-счётчик');
}

// ============================================================
console.log('— 9. i18n: EN-переводы новых строк, дубли ключей —');
{
    const i18nSrc = read('game/src/systems/i18n.js');
    const mustEn = [
        ['Ягоды лесные', 'Forest berries'],
        ['Грибы жареные', 'Fried mushrooms'],
        ['Шкура (зверя)', 'Beast hide'],
        ['Вы полностью здоровы. Трава осталась в узле.', 'You are fully healthy. The herb remains in the sack.'],
        ['👂 Подслушать (Слух)', '👂 Listen in (Listen)'],
        ['Молитва не услышана! Сердце ещё не отошло от прошлой молитвы — небо молчит. Вернись позже (откат: ещё около {0} ч).', 'The prayer went unheard!'],
    ];
    for (const [ru, enPart] of mustEn) {
        const idx = i18nSrc.indexOf(`'${ru}'`);
        ok(idx >= 0, `ключ EN присутствует: ${ru.slice(0, 32)}…`);
        if (idx >= 0) ok(i18nSrc.slice(idx, idx + 400).includes(enPart), `перевод EN: «${enPart}»`);
    }
    // дубли ключей (правило §8)
    const start = i18nSrc.indexOf('const EN = {');
    const end = i18nSrc.indexOf('\n};', start);
    const block = i18nSrc.slice(start, end);
    const keys = [];
    const re = /(?:^|\n)\s*'((?:[^'\\]|\\.)*)'\s*:/g;
    let m; while ((m = re.exec(block))) keys.push(m[1]);
    const seen = new Set(); const dupes = [];
    keys.forEach(k => { if (seen.has(k)) dupes.push(k); seen.add(k); });
    ok(dupes.length === 0, `дубли ключей EN: 0 (всего ${keys.length})`);
}

// ============================================================
console.log('— 10. Синтаксис затронутых файлов —');
{
    const files = [
        'game/src/systems/hunger.js', 'game/src/systems/prayer.js', 'game/src/systems/loot.js',
        'game/src/systems/meal.js', 'game/src/systems/TimeSystem.js', 'game/src/systems/Character.js',
        'game/src/systems/i18n.js', 'game/src/data/forest.js', 'game/src/data/rumors.js',
        'game/src/scenes/ForestScene.js', 'game/src/scenes/LocationScene.js', 'game/src/scenes/CombatScene.js',
        'game/src/scenes/CharacterScene.js', 'game/src/scenes/InteriorScene.js', 'game/src/scenes/VillageScene.js',
    ];
    const { execSync } = await import('child_process');
    let synOk = true;
    files.forEach(f => {
        try { execSync('node --check ' + join(ROOT, f), { stdio: 'pipe' }); } catch { synOk = false; console.log('    node --check FAIL: ' + f); }
    });
    ok(synOk, `node --check: ${files.length}/${files.length} файлов`);
}

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

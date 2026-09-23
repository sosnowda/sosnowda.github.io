// ТЕСТ РАУНДА 66.16 — 7 ПРИКАЗОВ ВЛАДЕЛЬЦА:
//  1\ еда всегда занимает 1 час;
//  2\ сон на постоялом дворе занимает время по выбору: 1..12 часов ИЛИ
//     фиксированное «до утра / до полудня / до вечера / до полуночи»;
//  3\ любая еда лечит ровно +1 HP, кулдаун следующего приёма — 4 часа,
//     при попытке поесть во время отката — поп-ап «герой сытый»;
//  4\ кулдаун сна 12 часов, при попытке поспать во время отката —
//     поп-ап «герой не хочет спать», отдых отменяется;
//  5\ гард р.41: очередь переходов сцен больше не застревает
//     (processQueue: дедуп + дренаж + кап; End-защёлки в 5 сценах);
//  6\ женский портрет воровки (getThiefPortraitKey + portrait_thief_f);
//  7\ пункт «Переночевать» в меню тавернщика.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

// ---------- Мок-registry ----------
function makeRegistry() {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    // Фиксированное время: 1445 год, месяц 6 (март), день 14, 9:30
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 9, minute: 30 });
    return reg;
}
// ((1445*372 + 6*31 + 14)*24 + 9)*60 + 30
const TS_MIN = ((1445 * 372 + 6 * 31 + 14) * 24 + 9) * 60 + 30;

const {
    MEAL_HEAL_HP, MEAL_DURATION_MIN, MEAL_COOLDOWN_MIN, SLEEP_COOLDOWN_MIN,
    worldAbsMinutes, canEat, registerMeal, mealCooldownLeftMin,
    canSleep, registerSleep, sleepCooldownLeftMin,
} = await import(join(ROOT, 'game/src/systems/meal.js'));

const { getThiefPortraitKey } = await import(join(ROOT, 'game/src/data/thief.js'));

// ============================================================
// 1. Ядро meal.js: константы и абсолютная минута
// ============================================================
console.log('— ядро: константы еды/сна —');
{
    ok(MEAL_HEAL_HP === 1, 'приказ 2: любая еда лечит ровно +1 HP');
    ok(MEAL_DURATION_MIN === 60, 'приказ 1: еда всегда занимает 1 час (60 мин)');
    ok(MEAL_COOLDOWN_MIN === 240, 'приказ 3: кулдаун еды 4 часа (240 мин)');
    ok(SLEEP_COOLDOWN_MIN === 720, 'приказ 4: кулдаун сна 12 часов (720 мин)');

    const reg = makeRegistry();
    ok(worldAbsMinutes(reg) === TS_MIN, 'worldAbsMinutes: формула согласована с мёдом (r.27)');
    const noTime = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    ok(worldAbsMinutes(noTime) === 0, 'worldAbsMinutes: без gameTime → 0 (не падает)');

    const e0 = canEat(reg);
    ok(e0.ok === true && e0.minutesLeft === 0, 'в начале игры есть можно');
    const s0 = canSleep(reg);
    ok(s0.ok === true && s0.minutesLeft === 0, 'в начале игры спать можно');
}

// ============================================================
// 2. Кулдаун еды 4 часа (приказ 3)
// ============================================================
console.log('— кулдаун еды 4 часа —');
{
    const reg = makeRegistry();
    registerMeal(reg);
    ok(reg.get('mealState').lastAbsMin === TS_MIN, 'registerMeal ставит текущую абсолютную минуту');
    const e1 = canEat(reg);
    ok(e1.ok === false, 'сразу после еды есть нельзя');
    ok(e1.minutesLeft === 240, 'остаток кулдауна ровно 240 мин');
    ok(mealCooldownLeftMin(reg) === 240, 'mealCooldownLeftMin = 240');

    // +239 минут — ещё нельзя; +240 — можно
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 13, minute: 29 });
    ok(canEat(reg).ok === false, 'через 239 мин есть нельзя');
    ok(canEat(reg).minutesLeft === 1, 'через 239 мин остаток 1 мин');
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 13, minute: 30 });
    ok(canEat(reg).ok === true, 'через 240 мин (4 часа) есть можно');

    // Переход суток: ели в 23:00, сейчас 3:00 следующего дня = 4 ч
    const reg2 = makeRegistry();
    reg2.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 23, minute: 0 });
    registerMeal(reg2);
    reg2.set('gameTime', { yearFromChrist: 1445, month: 6, day: 15, hour: 3, minute: 0 });
    ok(canEat(reg2).ok === true, 'кулдаун корректен через полночь');
    // Смена месяца/года — счётчик монотонен
    const reg3 = makeRegistry();
    reg3.set('gameTime', { yearFromChrist: 1445, month: 11, day: 30, hour: 23, minute: 0 });
    registerMeal(reg3);
    reg3.set('gameTime', { yearFromChrist: 1446, month: 0, day: 1, hour: 3, minute: 0 });
    ok(canEat(reg3).ok === true, 'кулдаун корректен через месяц/год (монотонность формулы 372/31)');
}

// ============================================================
// 3. Кулдаун сна 12 часов (приказ 4)
// ============================================================
console.log('— кулдаун сна 12 часов —');
{
    const reg = makeRegistry();
    registerSleep(reg);
    ok(reg.get('sleepState').lastAbsMin === TS_MIN, 'registerSleep ставит текущую абсолютную минуту');
    const s1 = canSleep(reg);
    ok(s1.ok === false, 'сразу после сна спать нельзя');
    ok(s1.minutesLeft === 720, 'остаток кулдауна сна ровно 720 мин (12 ч)');
    ok(sleepCooldownLeftMin(reg) === 720, 'sleepCooldownLeftMin = 720');

    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 21, minute: 29 });
    ok(canSleep(reg).ok === false, 'через 11 ч 59 мин спать нельзя');
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 21, minute: 30 });
    ok(canSleep(reg).ok === true, 'через 12 часов спать можно');
}

// ============================================================
// 4. Приказы 1–3 в точках еды:InteriorScene/dialogue/Forest/Location
// ============================================================
console.log('— приказы 1–3 во всех точках еды —');
{
    const isr = read('game/src/scenes/InteriorScene.js');
    // Лавка тавернщика: +1 HP всем товарам, кулдаун, час
    ok(/id: 'bread'[\s\S]{0,90}heal: MEAL_HEAL_HP/.test(isr), 'лавка: хлеб = MEAL_HEAL_HP');
    ok(/id: 'kasha'[\s\S]{0,90}heal: MEAL_HEAL_HP/.test(isr), 'лавка: каша = MEAL_HEAL_HP');
    ok(/id: 'mead'[\s\S]{0,90}heal: MEAL_HEAL_HP/.test(isr), 'лавка: медовуха = MEAL_HEAL_HP (приказ «любая еда»)');
    ok(/id: 'kvass'[\s\S]{0,90}heal: MEAL_HEAL_HP/.test(isr), 'лавка: квас = MEAL_HEAL_HP');
    ok(/if \(!canEat\(this\.registry\)\.ok\) \{[\s\S]{0,120}showMealBlockedPopup\(this\)/.test(isr),
        'лавка: кулдаун еды → поп-ап «герой сытый» (деньги не списываются)');
    ok(isr.includes('registerMeal(this.registry); // приказ 3: кулдаун 4 часа'), 'лавка: registerMeal после покупки');
    ok(isr.includes('tickTime(this.registry, MEAL_DURATION_MIN);'), 'приказ 1: еда в лавке занимает 1 час (tickTime 60)');
    ok(!/mpHeal: 2/.test(isr.split('const items = [')[1]?.split(']')[0] || ''), 'Воля едой больше не восстанавливается (mpHeal: 0)');
    // Яблоки в мастерской
    ok(isr.includes('Перекус занял час: +1 здоровья'), 'мастерская: сушёные яблоки = +1 HP, час');
    ok(/canEat\(this\.registry\)\.ok && \(player\.HP \|\| 0\)/.test(isr), 'мастерская: сытый герой яблок не находит');

    const dlg = read('game/src/data/dialogue.js');
    ok((dlg.match(/Герой сыт и больше не может есть/g) || []).length >= 3,
        'диалоги: «сытый»-текст в трапезе/мёде/рыбе (3 вхождения)');
    ok(dlg.includes("t('Трапеза заняла ровно один час игрового времени.')"), 'трапеза: сообщение про час');
    ok(dlg.includes('const heal = MEAL_HEAL_HP;'), 'трапеза/мёд: heal = MEAL_HEAL_HP (ровно 1)');
    ok(!dlg.includes('1 + Math.floor(Math.random() * 3)'), 'трапеза: случайные 1..3 HP убраны');
    ok(!dlg.includes('st.uses >= 3'), 'мёд: лимит «3 в сутки» снят (единый кулдаун)');
    ok(!dlg.includes("registry.get('honey')"), "мёд: состояние 'honey' больше не ведётся");
    ok(dlg.includes('🛏 Переночевать (за деньги)'), 'приказ 7: пункт «Переночевать» в меню тавернщика');
    ok(dlg.includes('scene.showTavernRestMenu(scene.interior)'), 'приказ 7: «Переночевать» открывает меню отдыха');
    ok(!dlg.includes('2 + Math.floor(Math.random() * 2)'), 'рыба: случайные 2..3 HP убраны');
    ok(dlg.includes("'Купил копчёной рыбы у Ерёмы: −2 д., +1 HP, час времени.'"), 'рыба: +1 HP, час в журнале');

    const forest = read('game/src/data/forest.js');
    ok(forest.includes('hp: 1, label: t(\'Грибы\')'), 'лес: грибы = 1 HP');
    ok(forest.includes('Собрал и съел грибов в лесу (час времени).'), 'лес: журнал грибы — час времени');
    ok(!forest.includes('Сорвать грибы (+2 ❤)'), 'лес: старый prompt «+2 ❤» убран');

    const fsScene = read('game/src/scenes/ForestScene.js');
    ok(fsScene.includes("const isFood = entry.kind === 'mushroom' || entry.kind === 'berry';"), 'лес: грибы/ягоды = еда');
    ok(fsScene.includes('if (isFood && !canEat(this.registry).ok)'), 'лес: сытый герой не ест');
    ok(fsScene.includes('if (isFood) registerMeal(this.registry);'), 'лес: кулдаун еды после сбора');
    ok(fsScene.includes('tickTime(this.registry, isFood ? MEAL_DURATION_MIN : 8);'), 'лес: еда = 60 мин, трава = 8 мин');
    ok(fsScene.includes("entry.kind === 'herb'") || read('game/src/data/forest.js').includes("kind: 'herb'"),
        'лес: зверобой — не еда (без кулдауна)');

    const loc = read('game/src/scenes/LocationScene.js');
    ok(/if \(!canEat\(this\.registry\)\.ok\) \{[\s\S]{0,120}showMealBlockedPopup\(this\)/.test(loc),
        'рыбалка: сытый герой не рыбачит (поп-ап)');
    ok(loc.includes('const heal = MEAL_HEAL_HP;'), 'рыбалка: улов = ровно +1 HP');
    ok(loc.includes('registerMeal(this.registry); // приказ 3: кулдаун еды 4 часа'), 'рыбалка: кулдаун еды');
    ok(!loc.includes('season.bonus || 0'), 'рыбалка: сезонный буст лечения снят');
    ok(!loc.includes('raining ? 4 : 3'), 'рыбалка: погодный буст лечения снят');
    ok(loc.includes('const raining = weather && isRainy(weather);'), 'рыбалка: погода осталась в текстах улова');
}

// ============================================================
// 5. Приказ 2+4: меню отдыха и исполнение сна (InteriorScene)
// ============================================================
console.log('— приказы 2+4: меню отдыха, кулдаун сна —');
{
    const isr = read('game/src/scenes/InteriorScene.js');
    ok(isr.includes('[1, 2, 3, 4, 6, 8, 12]'), 'приказ 2: варианты сна 1..12 часов');
    ok(isr.includes("{ hour: 6,  key: '🌅 До утра (в 6:00)' }"), 'приказ 2: «до утра» (6:00)');
    ok(isr.includes("{ hour: 12, key: '☀️ До полудня (в 12:00)' }"), 'приказ 2: «до полудня» (12:00)');
    ok(isr.includes("{ hour: 16, key: '🌇 До вечера (в 16:00)' }"), 'приказ 2: «до вечера» (16:00)');
    ok(isr.includes("{ hour: 0,  key: '🌙 До полуночи (в 0:00)' }"), 'приказ 2: «до полуночи» (0:00)');
    ok(isr.includes('this.minutesUntilHour(f.hour)'), 'приказ 2: фиксированное время — минутами до цели');
    ok(isr.includes('restInTavern(interior, o.hours, o.minutes)'), 'приказ 2: точная длительность передаётся в restInTavern');
    ok(isr.includes('const sleepMinutes = (minutesOverride && minutesOverride > 0) ? minutesOverride : hours * 60;'),
        'приказ 2: restInTavern спит точное число минут');
    ok(/if \(!canSleep\(this\.registry\)\.ok\) \{[\s\S]{0,120}showSleepBlockedPopup\(this\)/.test(isr),
        'приказ 4: кулдаун сна → поп-ап «не хочет спать» (в меню и в исполнении)');
    ok(isr.includes('registerSleep(this.registry);'), 'приказ 4: после сна ставится кулдаун 12 ч');
    ok(isr.includes('const cost = Math.min(12, Math.max(4, hours * 2));'), 'цены сна: 2 д./час, минимум 4 д., кап 12 д.');
    ok(isr.includes('if (hours >= 8) {'), '<8 ч — ~1/3, 8+ ч — полное восстановление (сохранено)');
}

// ============================================================
// 6. Приказ 5: гард р.41 — очередь переходов сцен
// ============================================================
console.log('— приказ 5: хардендинг очереди переходов —');
{
    const boot = read('game/src/scenes/BootScene.js');
    ok(boot.includes('SM.prototype.processQueue = function ()'), 'гард: обёртка processQueue в живом IIFE BootScene');
    ok(boot.includes('this._queue.shift(); // критично: запись уходит ДАЖЕ при ошибке'),
        'гард: упавшая запись выбрасывается из очереди (дренаж)');
    ok(boot.includes('prev.op === entry.op && prev.keyA === entry.keyA'),
        'гард: дедуп подряд идущих дублей-опов');
    ok(boot.includes('budget-- > 0'), 'гард: кап 64 op за кадр против пинг-понга');
    ok(boot.includes('this.isProcessing = false; // критично: не оставить цикл замороженным'),
        'гард: isProcessing сбрасывается при ошибке op');

    // End-защёлки (per-frame шторм scene.start('End') из update())
    const latchCore = 'this.__endQueued = true; this.scene.start(\'End\');';
    ok(read('game/src/scenes/VillageScene.js').split(latchCore).length - 1 === 3,
        'гард: VillageScene — 3 End-ветки с защёлкой');
    for (const [f, n] of [['ForkScene.js', 'Fork'], ['LocationScene.js', 'Location'], ['ForestScene.js', 'Forest'], ['ApiaryScene.js', 'Apiary']]) {
        ok(read('game/src/scenes/' + f).includes(latchCore), 'гард: ' + n + 'Scene — End-защёлка');
    }
}

// ============================================================
// 7. Приказ 6: женский портрет воровки
// ============================================================
console.log('— приказ 6: женский портрет воровки —');
{
    ok(typeof getThiefPortraitKey === 'function', 'thief.js: getThiefPortraitKey экспортирован');
    const regM = makeRegistry();
    regM.data.set('quest', { chase: { gender: 'male' } });
    const regF = makeRegistry();
    regF.data.set('quest', { chase: { gender: 'female' } });
    ok(getThiefPortraitKey(regM) === 'portrait_thief', 'вор-мужчина → portrait_thief');
    ok(getThiefPortraitKey(regF) === 'portrait_thief_f', 'воровка → portrait_thief_f');

    const thief = read('game/src/data/thief.js');
    ok(!/portraitKey:\s*'portrait_thief'/.test(thief), 'thief.js: хардкод portraitKey: portrait_thief полностью снят');
    ok((thief.match(/getThiefPortraitKey\(registry\)/g) || []).length >= 3,
        'thief.js: портрет по полу в 3 поп-апах (скрылся/вырвался/встреча)');

    const boot = read('game/src/scenes/BootScene.js');
    ok(boot.includes("'thief', 'thief_f', 'narrator'"), 'BootScene: портрет thief_f загружается');

    // Ассет существует и > 50 KB (не заглушка)
    const stat = readFileSync(join(ROOT, 'game/assets/sprites/portraits/portrait_thief_f.webp'));
    ok(stat && stat.length > 50000, 'ассет portrait_thief_f.webp существует (' + Math.round(stat.length / 1024) + ' KB)');

    // EN: старые ключи-сироты удалены, новые добавлены
    const i18n = read('game/src/systems/i18n.js');
    for (const orphan of ['Отдохнуть 1 час (4 д.) — лечение ~1/3', 'Ночлег 8 часов (12 д.) — полное восстановление',
        'Марфа качает головой', 'Трапеза пройдёт в тот час', '(Осенний жор: +2 ❤ к улову.)',
        'Сорвать грибы (+2 ❤)', 'Подкрепился сушёными яблоками в мастерской: +2 HP.']) {
        ok(!i18n.includes(orphan), 'i18n: сирота удалена — ' + orphan.slice(0, 42) + '…');
    }
    for (const k of ['🥣 Герой сыт', '😴 Герой не хочет спать', 'Герой не хочет спать — он только недавно встал. Отдых отменён.',
        '🛏 Переночевать (за деньги)', '🌙 До полуночи (в 0:00)', 'Трапеза заняла ровно один час игрового времени.',
        '— сон {0} ({1} д.)', 'Ночлег {0} ч ({1} д.) {2}', 'час времени']) {
        ok(i18n.includes("'" + k + "'"), 'i18n: EN-ключ на месте — ' + k.slice(0, 44));
    }
}

console.log(`\n=== test_round78: ${pass} OK, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

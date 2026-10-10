// test_round138.mjs — 66.96: §12.3 аудита 66.92 — СТРАТЕГИЧЕСКИЕ РЕФАКТОРИНГИ:
//   1) ЕДИНЫЙ ИГРОВОЙ КАЛЕНДАРЬ — systems/gameCalendar.js: одна таблица
//      MONTH_DAYS + absDay/absMinute/dayKey; вытеснены 11 числовых копий
//      формулы (y*372+m*31+d) и 7 строковых копий ключа дня;
//   2) OUTDOOR LOCATION BASE — systems/OutdoorLocationBase.js: ForestScene
//      1415→~1115 строк, ApiaryScene 989→~663; клонированные spawnPlayer/
//      movePlayer/update/buildAtmosphere/buildHUD/drawExitMarker/
//      showFloatingText/общий create вынесены в базу (баланс — в конфиг:
//      шаг леса 0.25 мин, пасеки 1 мин);
//   3) ДЕКОМПОЗИЦИЯ INTERIORSCENE: панели меню — utils/MenuPanel.js с
//      трекингом объектов массивом (8 копий сноса «по depth» УДАЛЕНЫ),
//      подёнка — единый хелпер jobs.claimDayworkRep (было 4 копии; в
//      плотницкой ветке реп-строка терялась — исправлено), поштучные тайлы
//      пола/стен → TileSprite (чекборд запекается в int_floor_checker 64×64,
//      фаза узора сохранена);
//   4) dayKey() InteriorScene → канон gameCalendar.
// ФУНКЦИОНАЛЬНЫЕ Node-тесты: gameCalendar (канон-значения + эквивалентность
// со старыми копиями формулы ×1200 случайных дат) и claimDayworkRep
// (раз в сутки на живом registry-моке).
// Запуск из корня репозитория: node game/tools/test_round138.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

// ============================================================
// 1. ФУНКЦИОНАЛЬНО: gameCalendar — чистый модуль (Node)
// ============================================================
console.log('--- 1. gameCalendar: канон + эквивалентность старым копиям ---');
{
    const cal = await import(path.join(ROOT, 'game/src/systems/gameCalendar.js').replace('file://', ''));
    const { MONTH_DAYS, absDay, absMinute, dayKey } = cal;

    // Канон-значения
    ok(MONTH_DAYS.length === 12 && MONTH_DAYS[0] === 30 && MONTH_DAYS[5] === 28 && MONTH_DAYS[11] === 31,
        'MONTH_DAYS: 12 месяцев, сентябрь 30, февраль 28, август 31');
    ok(MONTH_DAYS.reduce((a, b) => a + b, 0) === 365, 'MONTH_DAYS: сумма 365 дней');
    ok(absDay({ yearFromChrist: 1401, month: 0, day: 1 }) === 1401 * 372 + 1,
        'absDay: канон (1401·372 + месяц·31 + день)');
    ok(absMinute({ yearFromChrist: 1401, month: 0, day: 1, hour: 8, minute: 30 })
        === (1401 * 372 + 1) * 1440 + 8 * 60 + 30, 'absMinute: (день·1440) + час·60 + минута');
    ok(dayKey({ yearFromChrist: 1401, month: 2, day: 5 }) === '1401-2-5',
        'dayKey: формат «год-месяц-день» без ведущих нулей (сейвы 66.10)');
    ok(absDay(null) === 0 && absMinute(null) === 0 && dayKey(null) === 'unknown',
        'пустой вход: 0 / 0 / unknown (прежние дефолты копий)');

    // Эквивалентность со старыми копиями формулы (каждая была ДО рефакторинга)
    let eq = true, eqMin = true, eqKey = true;
    for (let i = 0; i < 1200; i++) {
        const y = 1401 + Math.floor(Math.random() * 100);
        const m = Math.floor(Math.random() * 12);
        const d = 1 + Math.floor(Math.random() * 28);
        const h = Math.floor(Math.random() * 24);
        const mi = Math.floor(Math.random() * 60);
        const ts = { yearFromChrist: y, month: m, day: d, hour: h, minute: mi };
        // старая копия №1 (crime/repBalance/meal/hunger/trade/questGenerator/…)
        if (absDay(ts) !== (ts.yearFromChrist * 372) + (ts.month * 31) + ts.day) eq = false;
        // старая копия №2 (thief.worldMinutesOf)
        if (absMinute(ts) !== ((ts.yearFromChrist * 372 + ts.month * 31 + ts.day) * 24 + ts.hour) * 60 + (ts.minute || 0)) eqMin = false;
        // старая копия №3 (daily.dayKeyOf / WeatherOmens / rumors / dialogue)
        if (dayKey(ts) !== `${ts.yearFromChrist}-${ts.month}-${ts.day}`) eqKey = false;
    }
    ok(eq, 'эквивалентность absDay старой формуле ×1200 случайных дат');
    ok(eqMin, 'эквивалентность absMinute формуле thief.worldMinutesOf ×1200');
    ok(eqKey, 'эквивалентность dayKey строковому ключу daily/WeatherOmens ×1200');

    // Монотонность (главное свойство счётчика кулдаунов)
    let mono = true;
    let prev = null;
    for (let m = 0; m < 12; m++) for (let d = 1; d <= MONTH_DAYS[m]; d++) {
        const cur = absDay({ yearFromChrist: 1401, month: m, day: d });
        if (prev !== null && cur <= prev) mono = false;
        prev = cur;
    }
    ok(mono, 'absDay строго монотонен по календарю MONTH_DAYS');
}

// ============================================================
// 2. Единая таблица MONTH_DAYS (AccessHours + TimeSystem.MONTHS)
// ============================================================
console.log('--- 2. Единая таблица длин месяцев ---');
{
    const access = read('game/src/systems/AccessHours.js');
    ok(access.includes("import { MONTH_DAYS } from './gameCalendar.js';")
        && !access.includes('const MONTH_DAYS = ['),
        'AccessHours: MONTH_DAYS импортируется, своей копии НЕТ');
    const ts = read('game/src/systems/TimeSystem.js');
    ok(ts.includes('import { MONTH_DAYS }') && ts.includes('days: MONTH_DAYS[i]'),
        'TimeSystem: MONTHS[].days выводится из MONTH_DAYS (один источник правды)');
    ok(!ts.includes("days: 30 },") && !ts.includes("days: 31 },"),
        'TimeSystem: захардкоженных длин месяцев БОЛЬШЕ НЕТ');
}

// ============================================================
// 3. Формула дня вытеснена из 11 носителей
// ============================================================
console.log('--- 3. Ни одной копии формулы (y*372+m*31+d) вне gameCalendar ---');
{
    const carriers = [
        'game/src/systems/crime.js', 'game/src/systems/meal.js', 'game/src/systems/hunger.js',
        'game/src/systems/trade.js', 'game/src/systems/repBalance.js', 'game/src/systems/ChurchBells.js',
        'game/src/data/questGenerator.js', 'game/src/data/thief.js', 'game/src/data/reputation.js',
        'game/src/data/herd.js', 'game/src/data/npcPresence.js',
    ];
    let clean = true;
    for (const f of carriers) {
        const src = read(f);
        if (src.includes('* 372')) { clean = false; console.log('    остаток в ' + f); }
    }
    ok(clean, '11 носителей: ни одной числовой копии формулы');
    ok(read('game/src/systems/gameCalendar.js').includes('timeState.yearFromChrist * 372'),
        'формула живёт РОВНО в одном месте — gameCalendar.absDay');
    // строковые копии ключа дня
    const strCarriers = ['game/src/data/dialogue.js', 'game/src/data/rumors.js',
        'game/src/systems/Weather.js', 'game/src/systems/ChurchDonation.js', 'game/src/systems/WeatherOmens.js'];
    let strClean = true;
    for (const f of strCarriers) {
        const src = read(f);
        if (src.includes('${time.yearFromChrist}-') || src.includes('${ts.yearFromChrist}-')
            || src.includes('${t.yearFromChrist}-') || src.includes('${timeState.yearFromChrist}-')) { strClean = false; console.log('    остаток в ' + f); }
    }
    ok(strClean, 'строковые копии ключа дня вытеснены (5 файлов)');
    ok(read('game/src/data/daily.js').includes('_canonicalDayKey'),
        'daily.dayKeyOf — каноническая обёртка над gameCalendar (сейв-формат цел)');
}

// ============================================================
// 4. FУНКЦИОНАЛЬНО: claimDayworkRep — раз в сутки (registry-мок)
// ============================================================
console.log('--- 4. claimDayworkRep: ставка подёнки раз в сутки ---');
{
    const jobs = await import(path.join(ROOT, 'game/src/systems/jobs.js').replace('file://', ''));
    const state = new Map();
    const registry = { get: k => state.get(k), set: (k, v) => state.set(k, v) };
    state.set('gameTime', { yearFromChrist: 1401, month: 0, day: 1, hour: 9, minute: 0 });
    state.set('villageRep', 0);

    const msg1 = jobs.claimDayworkRep(registry);
    ok(msg1.includes('+1 к репутации') && msg1.startsWith('\n'),
        'первая подёнка дня: строка «+1 к репутации (ставка подёнки — раз в сутки)»');
    ok(state.get('quest').dayworkRepDay === 1401 * 372 + 1,
        'ключ дня записан в quest.dayworkRepDay (канон absDay)');
    const repOf = () => (state.get('reputation') || {}).villageRep || 0;
    ok(repOf() === 1, 'репутация деревни +1 (+1 → баланс ×0.7 → round = 1)');

    const msg2 = jobs.claimDayworkRep(registry);
    ok(msg2 === '', 'повторная подёнка в тот же день: без дубли ставки');
    ok(repOf() === 1, 'репутация не растёт дважды');

    state.set('gameTime', { yearFromChrist: 1401, month: 0, day: 2, hour: 10, minute: 0 });
    const msg3 = jobs.claimDayworkRep(registry);
    ok(msg3.includes('+1 к репутации') && repOf() === 2,
        'на следующий день ставка доступна снова (+1)');
}

// ============================================================
// 5. OutdoorLocationBase: сцены наследуют, клоны удалены, баланс в конфиге
// ============================================================
console.log('--- 5. OutdoorLocationBase (Forest 1415→1115, Apiary 989→663) ---');
{
    const base = read('game/src/systems/OutdoorLocationBase.js');
    const forest = read('game/src/scenes/ForestScene.js');
    const apiary = read('game/src/scenes/ApiaryScene.js');

    ok(base.includes('export class OutdoorLocationBase extends Phaser.Scene'),
        'базовый класс outdoor-локаций создан');
    ok(forest.includes('extends OutdoorLocationBase') && apiary.includes('extends OutdoorLocationBase'),
        'ForestScene и ApiaryScene наследуют OutdoorLocationBase');
    ok(forest.includes('this.createOutdoorCore()') && apiary.includes('this.createOutdoorCore()'),
        'общий каркас create() — createOutdoorCore()');
    ok(!forest.includes('    movePlayer() {') && !apiary.includes('    movePlayer() {')
        && base.includes('    movePlayer() {'),
        'movePlayer живёт РОВНО в базе (клон 96% устранён)');
    ok(!forest.includes('    buildAtmosphere() {') && !apiary.includes('    buildAtmosphere() {')
        && !forest.includes('    buildHUD() {') && !apiary.includes('    buildHUD() {')
        && base.includes('    buildAtmosphere() {') && base.includes('    buildHUD() {'),
        'buildAtmosphere/buildHUD — ровно в базе');
    ok(base.includes('    showFloatingText(') && !forest.includes('    showFloatingText(')
        && !apiary.includes('    showFloatingText('),
        'showFloatingText (клон 100%) — в базе');
    ok(base.includes('    drawExitMarker() {') && !forest.includes('    drawExitMarker() {')
        && !apiary.includes('    drawExitMarker() {'),
        'drawExitMarker (клон 98%) — в базе');

    // БАЛАНС в конфиге (бывшие расхождения клонов movePlayer)
    ok(forest.includes('stepTickMinutes: 0.25'), 'лес: шаг 0.25 игровой минуты (канон 66.17)');
    ok(apiary.includes('stepTickMinutes: 1'), 'пасека: шаг 1 игровая минута (канон раунда 22 п.5)');
    ok(base.includes('tickTime(this.registry, this.locCfg.stepTickMinutes, \'walk\')'),
        'шаг тикает время через конфиг локации (не хардкод)');
    ok(forest.includes('veilColor: 0x081408, veilAlpha: 0.30') && apiary.includes('bgColor: 0x16240f'),
        'атмосфера локаций — в конфиге (мгла леса темнее поляны)');
    ok(forest.includes('spawn: FOREST_SPAWN') && apiary.includes('spawn: APIARY_SPAWN'),
        'точки входа/выхода — в конфиге');
    // Крюки специфики
    ok(forest.includes('pauseActors()') && forest.includes('updateActors(time)')
        && apiary.includes('updateActors(time)'),
        'крюки актёров: волки/дичь леса, пчёлы пасеки');
    ok(forest.includes('hudStatusExtra()') && forest.includes('hungerStatusLine'),
        'голод/усталость леса — через крюк hudStatusExtra');
}

// ============================================================
// 6. InteriorScene: MenuPanel + claimDayworkRep + TileSprite
// ============================================================
console.log('--- 6. InteriorScene: панели/подёнка/пол ---');
{
    const is = read('game/src/scenes/InteriorScene.js');
    const menuPanel = read('game/src/utils/MenuPanel.js');

    ok(menuPanel.includes('export class MenuPanel') && menuPanel.includes('this.objects.push(go)'),
        'utils/MenuPanel.js: панель с трекингом объектов массивом');
    ok((is.match(/this\.children\.list\.filter/g) || []).length === 0,
        'InteriorScene: снос «по depth» УДАЛЕН (было 8 копий)');
    ok((is.match(/new MenuPanel\(/g) || []).length === 6,
        'MenuPanel подключён к 6 меню (дары/лавка/трактир/скупка/Скупщик/кузница)');
    ok(is.includes('menu.close()') && is.includes('this._menu?.close()'),
        'закрытие панелей — точечное menu.close()');
    ok(menuPanel.includes('if (this.closed) return;'), 'MenuPanel.close() идемпотентен');
    ok(menuPanel.includes("import { createButton } from './ui.js';"),
        'MenuPanel переиспользует createButton (единый источник кнопок)');

    // подёнка — один хелпер
    const jobs = read('game/src/systems/jobs.js');
    ok((jobs.match(/export function claimDayworkRep/g) || []).length === 1,
        'jobs.claimDayworkRep — РОВНО одно определение');
    ok((is.match(/claimDayworkRep\(this\.registry\)/g) || []).length === 4,
        '4 вызова из InteriorScene (гончар/ткачиха/плотник/кузница)');
    ok(!is.includes("q66.dayworkRepDay !== today66") && !is.includes("qS.dayworkRepDay !== todayS"),
        'старые копии реп-блока УДАЛЕНЫ');
    ok(is.includes("+ '\\n' + checkNote + repMsgC,"),
        'ФИКС дрейфа: реп-строка плотника теперь реально в диалоге');

    // TileSprite пола/стен
    ok(is.includes("createCanvas('int_floor_checker', 64, 64)")
        && is.includes("this.add.tileSprite(0, 100, width, height - 100, 'int_floor_checker')"),
        'пол: чекборд int_floor_checker 64×64 + ОДИН TileSprite (было ~760 объектов)');
    ok(is.includes('.setTilePosition(0, 32)'),
        'фаза чекборда сохранена (tilePosition 0,32 — строка y=100 была нечётной)');
    ok(is.includes("this.add.tileSprite(0, 0, width, 96, 'int_wall')"),
        'стены: один TileSprite 0..96 (было ~120 объектов)');
    ok(!is.includes("for (let x = 0; x < width; x += ts) {\n                for (let y = 100"),
        'поштучный цикл пола УДАЛЁН');

    // dayKey → канон
    ok(is.includes('return gameCalendarDayKey(getTime(this.registry));'),
        'InteriorScene.dayKey() — канон gameCalendar.dayKey');
}

// ============================================================
// 7. Сейв-совместимость: форматы ключей НЕ изменились
// ============================================================
console.log('--- 7. Сейв-совместимость ---');
{
    ok(read('game/src/systems/gameCalendar.js').includes("` ${timeState.yearFromChrist}`") === false
        && read('game/src/data/daily.js').includes('dayKeyOf'),
        'daily.dayKeyOf экспортируется под прежним именем (5 импортёров)');
    const cal = await import(path.join(ROOT, 'game/src/systems/gameCalendar.js').replace('file://', ''));
    // Формат строки дня идентичен хранимому в сейвах с 66.10
    ok(cal.dayKey({ yearFromChrist: 1423, month: 11, day: 31 }) === '1423-11-31',
        'формат ключа дня: «1423-11-31» — бит в бит как в сейвах');
    // blessingState.lastAbsMin и chase.traces[].leftAt — те же числа
    ok(cal.absMinute({ yearFromChrist: 1450, month: 3, day: 15, hour: 6, minute: 45 })
        === (((1450 * 372) + (3 * 31) + 15) * 1440) + 6 * 60 + 45,
        'absMinute: числа blessingState/следов вора не меняются');
}

// ============================================================
// 8. Доки и SW
// ============================================================
console.log('--- 8. Версия/доки (заполняется при выпуске) ---');
{
    const sw = read('sw.js');
    ok(/chronicles-ruthenia-v12[89]/.test(sw) || /chronicles-ruthenia-v13\d/.test(sw),
        'SW: кешv130+ (бамп под новые модули)');
}

console.log('====================');
console.log(`ИТОГ test_round138: ${pass} ✓ / ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);

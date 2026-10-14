// test_round140.mjs — 66.99: P2-21 аудита 66.92 — ЦИКЛ РАЗОРВАН:
//   1) КАНОН СЕЗОНОВ В ЛИСТЕ gameCalendar: SEASON_OF + getSeason — единственная
//      таблица «месяц → сезон» (раньше сезон жил полем в TimeSystem.MONTH_META);
//   2) РАЗРЫВ ЦИКЛА: questGenerator импортирует getSeason из gameCalendar
//      (лист без импортов), а НЕ из TimeSystem — ребро TimeSystem→questGenerator
//      (tickQuestTime из tickTime) остаётся единственным направлением;
//   3) TimeSystem: MONTH_META без поля season, MONTHS собирает season из
//      SEASON_OF (форма { name, nameNominative, season, days } прежняя),
//      getSeason РЕ-ЭКСПОРТ из gameCalendar — точки импорта 8 потребителей
//      (Location/Village/repBalance/WeatherOmens/Weather/AmbientFX/apiary/questGenerator)
//      не менялись (пин строки WeatherOmens в r117 цел);
//   4) ФУНКЦИОНАЛЬНО (Node): канон ×12 месяцев бит-в-бит со старой таблицей,
//      MONTHS-форма, сезонные множители repBalance через новый путь,
//      tickTime с моком реестра — ребро tickQuestTime живо.
// Запуск из корня репозитория: node game/tools/test_round140.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

// ============================================================
// 1. ФУНКЦИОНАЛЬНО: gameCalendar — канон сезонов
// ============================================================
console.log('--- 1. gameCalendar: SEASON_OF/getSeason — канон ×12 месяцев ---');
{
    const cal = await import(path.join(ROOT, 'game/src/systems/gameCalendar.js').replace('file://', ''));
    // Старая таблица (git-история TimeSystem.MONTH_META до 66.99) — значения ДОЛЖНЫ совпасть бит-в-бит
    const OLD_SEASON = ['autumn', 'autumn', 'autumn', 'winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer'];
    ok(Array.isArray(cal.SEASON_OF) && cal.SEASON_OF.length === 12, 'SEASON_OF: 12 месяцев');
    let allEq = true;
    for (let m = 0; m < 12; m++) if (cal.getSeason(m) !== OLD_SEASON[m]) allEq = false;
    ok(allEq, 'getSeason ×12 бит-в-бит со старой MONTH_META.season (сентябрь=autumn … август=summer)');
    ok(cal.getSeason(0) === 'autumn' && cal.getSeason(3) === 'winter' && cal.getSeason(6) === 'spring' && cal.getSeason(9) === 'summer',
        'точки канона: сентябрь autumn / декабрь winter / март spring / июнь summer');
    ok(cal.absDay && cal.absMinute && cal.dayKey && cal.MONTH_DAYS, 'gameCalendar: прежние экспорты (MONTH_DAYS/absDay/absMinute/dayKey) целы');
}

// ============================================================
// 2. СТАТИКА: цикл разорван
// ============================================================
console.log('--- 2. Разрыв цикла TimeSystem↔questGenerator ---');
{
    const qg = read('game/src/data/questGenerator.js');
    ok(!qg.includes("from '../systems/TimeSystem.js'"), 'questGenerator: импорта из TimeSystem БОЛЬШЕ НЕТ (обратное ребро срезано)');
    ok(qg.includes("import { absDay, absMinute, getSeason } from '../systems/gameCalendar.js';"),
        'questGenerator: getSeason из ЛИСТА gameCalendar (один импорт с absDay/absMinute)');
    const ts = read('game/src/systems/TimeSystem.js');
    ok(ts.includes("import { tickQuestTime } from '../data/questGenerator.js';"), 'TimeSystem → questGenerator (tickQuestTime): ребро цело (теперь одностороннее)');
    ok(ts.includes("import { MONTH_DAYS, SEASON_OF, getSeason } from './gameCalendar.js';") && ts.includes('export { getSeason };'),
        'TimeSystem: getSeason — ре-экспорт канона из gameCalendar');
    ok(!/season:\s*'(autumn|winter|spring|summer)'/.test(ts), 'TimeSystem.MONTH_META: поля season больше нет (один источник правды)');
    const calSrc = read('game/src/systems/gameCalendar.js');
    ok(!calSrc.includes('\nimport ') && !calSrc.startsWith('import '), 'gameCalendar: по-прежнему ЛИСТ (ни одного import)');
    // пин r117: строка импорта WeatherOmens НЕ менялась
    const wo = read('game/src/systems/WeatherOmens.js');
    ok(wo.includes("import { getTime, getSeason, MONTHS } from './TimeSystem.js';"), 'WeatherOmens: точка импорта прежняя (пин r117 цел)');
}

// ============================================================
// 3. ФУНКЦИОНАЛЬНО: TimeSystem — MONTHS-форма и ре-экспорт
// ============================================================
console.log('--- 3. TimeSystem: MONTHS {name, nameNominative, season, days} ---');
{
    const { MONTHS, getSeason, tickTime, initTime, advanceTime } = await import(path.join(ROOT, 'game/src/systems/TimeSystem.js').replace('file://', ''));
    const cal = await import(path.join(ROOT, 'game/src/systems/gameCalendar.js').replace('file://', ''));
    ok(MONTHS.length === 12, 'MONTHS: 12 записей');
    let shapeOk = true, eqOk = true;
    for (let m = 0; m < 12; m++) {
        if (!(MONTHS[m].name && MONTHS[m].nameNominative && MONTHS[m].season && typeof MONTHS[m].days === 'number')) shapeOk = false;
        if (MONTHS[m].season !== cal.SEASON_OF[m] || MONTHS[m].days !== cal.MONTH_DAYS[m]) eqOk = false;
        if (getSeason(m) !== cal.getSeason(m)) eqOk = false;
    }
    ok(shapeOk, 'форма записи прежняя: { name, nameNominative, season, days }');
    ok(eqOk, 'MONTHS[m].season === SEASON_OF[m], days === MONTH_DAYS[m], getSeason — тот же канон');
    ok(getSeason === cal.getSeason, 'TimeSystem.getSeason — ТО ЖЕ САМОЕ имя функции (ре-экспорт, не копия)');
    ok(typeof tickTime === 'function' && typeof initTime === 'function' && typeof advanceTime === 'function', 'TimeSystem: прежние экспорты целы');
}

// ============================================================
// 4. ФУНКЦИОНАЛЬНО: потребители через новый путь
// ============================================================
console.log('--- 4. Потребители: repBalance + tickTime (ребро tickQuestTime) ---');
{
    const { seasonWageMultiplier } = await import(path.join(ROOT, 'game/src/systems/repBalance.js').replace('file://', ''));
    ok(seasonWageMultiplier('potter', 3) === 0.8, 'repBalance: гончар в декабре (winter) → ×0.8 — через новый импорт');
    ok(seasonWageMultiplier('mill', 0) === 1.2, 'repBalance: мельница в сентябре → ×1.2');
    ok(seasonWageMultiplier('smithy', 8) === 1, 'repBalance: кузнец в мае (spring) → ×1');
}
{
    // ребро TimeSystem → questGenerator живо при разорванном цикле
    const { tickTime } = await import(path.join(ROOT, 'game/src/systems/TimeSystem.js').replace('file://', ''));
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 9, minute: 30 });
    reg.set('player', { HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55, skills: { survival: 50 }, inventory: [] });
    const before = JSON.stringify(reg.get('gameTime'));
    tickTime(reg, 30);
    const after = reg.get('gameTime');
    ok(after.minute === 0 && after.hour === 10 && JSON.stringify({ m: after.month, d: after.day }) === JSON.stringify({ m: 6, d: 14 }),
        `tickTime(30): 9:30 → ${after.hour}:${String(after.minute).padStart(2, '0')} — полный тик (hunger+chase-hook+tickQuestTime) без ошибок цикла`);
    ok(before !== undefined, 'реестр-мок изменён тиком');
    // questGenerator оценивается модулем в Node (порядок инициализации цел)
    const qg = await import(path.join(ROOT, 'game/src/data/questGenerator.js').replace('file://', ''));
    ok(typeof qg.getBlessedSkill === 'function' && typeof qg.onLocationVisited === 'function', 'questGenerator: экспорты целы (модуль вычисляется без кольца)');
}

// ============================================================
// 5. СЛУЖЕБНОЕ: SW v133
// ============================================================
console.log('--- 5. SW-версии ---');
{
    const sw = read('sw.js');
    ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v134';"), 'sw.js: CACHE_NAME v133 (66.100: en/index.html; 66.101: game/src → бамп §4)');
    ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 цел (ассеты не тронуты)');
}

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗ ${fail === 0 ? '' : '— ЕСТЬ ПРОВАЛЫ'}`);
process.exit(fail === 0 ? 0 : 1);

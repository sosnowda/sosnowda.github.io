// test_round126.mjs — 66.78: ДЕСЯТЬ ПРИКАЗОВ ВЛАДЕЛЬЦА (преступность):
//  1\ Провал Скрадывания — репутация в деревне падает ГЕОМЕТРИЧЕСКИ:
//     −2/−4/−8/−16/−32 (потолок −32) — noteStealthFail/stealthRepPenalty,
//     и через attemptChestPick/attemptBreakIn;
//  2\ Хозяева вернулись во время воровства и застукали (шанс 20% днём /
//     8% ночью): репутация у хозяев −30 (точно), в деревне −20 (точно);
//     сундук НЕ помечается, лута нет;
//  3\ Застукавшие хозяева могут НАПАСТЬ (бой): мужчины 40%, женщины 10%;
//  4\ СКУПЩИК — по ночам на первом этаже постоялого двора, покупает
//     ТОЛЬКО краденое (isFenceInTown/isNightHour/drawFenceInterior);
//  5\ Появляется случайно, но НЕ РЕЖЕ 3 РАЗ В НЕДЕЛЮ (3–5 ночей недели,
//     расписание недели хранится в registry); продажа краденого — только
//     ночью и только Скупщику (честная скупка краденое НЕ показывает);
//  6\ Каждая продажа Скупщику — репутация деревни −1 (точно) +
//     однократное предупреждение о противозаконности (флаг fenceWarned);
//  7\ Первая попытка Кражи/Взлома — однократное КРАСНОЕ предупреждение
//     (флаг crimeWarned; текст приказа в CRIME_WARNING_TEXT);
//  8\ Взлом и Кража — ФИКСИРОВАННО 10 минут (source-проверки сцен);
//  9\ Любая торговля — 30 минут (TRADE_MINUTES/chargeTradeTime), счётчик
//     реального времени на время панели стоит (pauseWorldClock);
// 10\ «СЛАВА» в статовых строках заменена на «репутацию» (source-проверки;
//     «дурная/добрая слава» в поговорках остаётся).
// Запуск из корня репозитория: node game/tools/test_round126.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const realRandom = Math.random;
function rollSeq(seq) { // подмена Math.random: по очереди из seq, потом 0.5
    let i = 0;
    Math.random = () => (i < seq.length ? seq[i++] : 0.5);
}
function restoreRandom() { Math.random = realRandom; }

function makeRegistry(hour = 12) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour, minute: 0 });
    reg.set('player', {
        HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55, DEX: 70, POW: 55,
        skills: { stealth: 68, lockpicking: 60 },
        inventory: [], dengas: 0,
    });
    return reg;
}

// ---------- Импорты ----------
const crime = await import(join(ROOT, 'game/src/systems/crime.js'));
const burglary = await import(join(ROOT, 'game/src/systems/burglary.js'));
const rep = await import(join(ROOT, 'game/src/data/reputation.js'));
const trade = await import(join(ROOT, 'game/src/systems/trade.js'));
const i18n = await import(join(ROOT, 'game/src/systems/i18n.js'));
const {
    stealthRepPenalty, noteStealthFail, stealthFailCount,
    rollOwnersReturn, ownerReturnChance, ownerAttackChance, hostGenderOf,
    CATCH_HOST_REP, CATCH_VILLAGE_REP,
    isNightHour, ensureFenceWeek, isFenceInTown, weekKeyOf, absDayOf,
    FENCE_MIN_NIGHTS, FENCE_MAX_NIGHTS,
    noteFenceSale, crimeWarnedOnce, markCrimeWarned, fenceWarnedOnce, markFenceWarned,
    CRIME_WARNING_TEXT, FENCE_SALE_VILLAGE_REP,
} = crime;
const { attemptChestPick, attemptBreakIn, canPickChest } = burglary;
const { getVillageRep, getNpcRep, changeNpcRepExact } = rep;
const { TRADE_MINUTES, chargeTradeTime } = trade;

console.log('--- 1. Геометрическая молва (приказ 1) ---');
ok(stealthRepPenalty(1) === 2 && stealthRepPenalty(2) === 4 && stealthRepPenalty(3) === 8
    && stealthRepPenalty(4) === 16 && stealthRepPenalty(5) === 32, 'лестница: 2, 4, 8, 16, 32 (геометрия ×2)');
ok(stealthRepPenalty(6) === 32 && stealthRepPenalty(20) === 32, 'потолок −32 (дальше не растёт)');

const reg1 = makeRegistry();
for (let i = 1; i <= 6; i++) {
    const r = noteStealthFail(reg1);
    const expect = stealthRepPenalty(i);
    ok(r.penalty === expect && stealthFailCount(reg1) === i, `провал №${i}: штраф −${expect}, счётчик ${i}`);
}
ok(getVillageRep(reg1) === -(2 + 4 + 8 + 16 + 32 + 32), `сумма ударов: −94 (факт ${getVillageRep(reg1)})`);

// Через attemptChestPick: первый провал Скрадывания = −2 (канон 122 сохранён)
const reg1b = makeRegistry();
rollSeq([0.985]); // бросок 99 — провал Скрадывания (68)
const f1 = attemptChestPick(reg1b, reg1b.get('player'), 'potter_house', reg1b.get('gameTime'), { stealth: 68, lock: 60, rng: Math.random });
restoreRandom();
ok(f1.stealthFailed && getVillageRep(reg1b) === -2, 'первый провал через attemptChestPick: −2');
rollSeq([0.985]);
const f2 = attemptChestPick(reg1b, reg1b.get('player'), 'potter_house', reg1b.get('gameTime'), { stealth: 68, lock: 60, rng: Math.random });
restoreRandom();
ok(f2.stealthFailed && getVillageRep(reg1b) === -6 && f2.stealthPenalty === 4, 'второй провал: ещё −4 (итого −6, геометрия)');

// Дверь: attemptBreakIn тоже эскалирует
const reg1c = makeRegistry();
rollSeq([0.985]);
attemptBreakIn(reg1c, reg1c.get('player'), { stealth: 68, lock: 60 });
restoreRandom();
ok(getVillageRep(reg1c) === -2, 'дверь: провал Скрадывания −2');

console.log('--- 2. Хозяева вернулись и застукали (приказ 2) ---');
ok(CATCH_HOST_REP === -30 && CATCH_VILLAGE_REP === -20, 'константы: −30 у хозяев / −20 в деревне');
ok(ownerReturnChance(12) === 0.2 && ownerReturnChance(6) === 0.2, 'день (6–20 ч): шанс 20%');
ok(ownerReturnChance(23) === 0.08 && ownerReturnChance(2) === 0.08, 'ночь: шанс 8%');

const reg2 = makeRegistry(12);
reg2.set('reputation', { villageRep: 0, npcRep: { potter1: 0 } });
rollSeq([0.05]); // < 0.2 — хозяева пришли; атака: следующий 0.5 → нет
const came = rollOwnersReturn(reg2, { hostNpcId: 'potter1', interiorId: 'potter_house', hour: 12, rng: Math.random });
restoreRandom();
ok(came.came === true && came.attack === false, 'бросок 5% — хозяева вернулись, не напали');
ok(getNpcRep(reg2, 'potter1') === -30, `репутация у хозяев −30 точно (факт ${getNpcRep(reg2, 'potter1')})`);
ok(getVillageRep(reg2) === -20, `репутация деревни −20 точно (факт ${getVillageRep(reg2)})`);

const reg2b = makeRegistry(23);
rollSeq([0.5]); // ≥ 0.08 ночью — никто не пришёл
const nocame = rollOwnersReturn(reg2b, { hostNpcId: 'potter1', interiorId: 'potter_house', hour: 23, rng: Math.random });
restoreRandom();
ok(nocame.came === false && getNpcRep(reg2b, 'potter1') === 0 && getVillageRep(reg2b) === 0, 'ночью 50% — никто не пришёл, репутация цела');

// Через attemptChestPick: хозяева пришли ДО броска Взлома
const reg2c = makeRegistry(12);
rollSeq([0.10, 0.00, 0.30]); // Скрадывание 10 (успех) → хозяева 0 → атака 30% (мужчина: 0.3 < 0.4 — ДА)
const res2c = attemptChestPick(reg2c, reg2c.get('player'), 'potter_house', reg2c.get('gameTime'), { stealth: 68, lock: 60, rng: Math.random, hostNpcId: 'potter1' });
restoreRandom();
ok(res2c.ownersCame === true && res2c.hostAttacks === true, 'сундук: хозяева вернулись и НАПАЛИ (мужчина, 30%<40%)');
ok(res2c.done === false && res2c.items.length === 0, 'попытка сорвана: лута нет');
ok(canPickChest(reg2c, 'potter_house', reg2c.get('gameTime')), 'сундук НЕ помечен обчищенным (добро при хозяевах)');
ok(getNpcRep(reg2c, 'potter1') === -30 && getVillageRep(reg2c) === -20, 'репутации: −30 у хозяев, −20 в деревне');

console.log('--- 3. Нападение хозяев (приказ 3) ---');
ok(ownerAttackChance('male') === 0.4, 'мужчины: шанс нападения 40% (высокий)');
ok(ownerAttackChance('female') === 0.1, 'женщины: шанс нападения 10%');
ok(hostGenderOf('villager_house_1') === 'male' && hostGenderOf('weaver_house') === 'female'
    && hostGenderOf('healer_house') === 'female' && hostGenderOf('elder_house') === 'male', 'пол хозяина по дому');

console.log('--- 4. СКУПЩИК: ночные появления (приказы 4–5) ---');
ok(FENCE_MIN_NIGHTS === 3 && FENCE_MAX_NIGHTS === 5, 'норма: не реже 3 раз в неделю (3–5 ночей)');
ok(isNightHour(21) && isNightHour(23) && isNightHour(0) && isNightHour(3), 'ночь: 21, 23, 0, 3 ч');
ok(!isNightHour(4) && !isNightHour(12) && !isNightHour(20), 'не ночь: 4, 12, 20 ч');

const reg4 = makeRegistry(23);
const ts4 = reg4.get('gameTime');
const st4 = ensureFenceWeek(reg4, ts4, () => 0.0); // детерминированный rng: count=3, дни 0,1,2
ok(st4.nights.length === 3, 'детерминированный rng: ровно 3 ночи в неделе');
const st4b = ensureFenceWeek(reg4, ts4, Math.random);
ok(st4b.nights.length === 3 && st4b.weekKey === st4.weekKey, 'расписание недели ХРАНИТСЯ (не перегениривается)');
ok(new Set(st4b.nights.map(n => n - st4b.weekKey * 7)).size === st4b.nights.length, 'ночи недели без повторов');
const minN = Math.min(...st4b.nights.map(n => n - st4b.weekKey * 7));
const maxN = Math.max(...st4b.nights.map(n => n - st4b.weekKey * 7));
ok(minN >= 0 && maxN <= 6, 'ночи внутри недели (0..6)');

const reg4b = makeRegistry(23); // ночь
reg4b.get('gameTime').day = 14; // попадаем в ту же неделю
ensureFenceWeek(reg4b, reg4b.get('gameTime'), () => 0.99); // rng 0.99: 5 ночей, среди них день недели №0 (14-е = №0)
ok(isFenceInTown(reg4b, reg4b.get('gameTime'), Math.random) === true, 'ночь + его ночь недели → Скупщик на месте');
const reg4c = makeRegistry(12); // день
ensureFenceWeek(reg4c, reg4c.get('gameTime'), () => 0.0);
ok(isFenceInTown(reg4c, reg4c.get('gameTime'), Math.random) === false, 'днём Скупщика НЕТ (даже в его ночь)');
const reg4d = makeRegistry(12);
const ts4d = reg4d.get('gameTime');
ensureFenceWeek(reg4d, ts4d, () => 0.99); // count=5, но день 14 может не попасть — проверим сам механизм ночи
ok(isFenceInTown(reg4d, ts4d, Math.random) === false, 'день (12 ч) никогда не показывает Скупщика');

console.log('--- 5. Продажа краденого — ТОЛЬКО Скупщику (приказ 5) ---');
const isrc = read('game/src/scenes/InteriorScene.js');
ok(isrc.includes('sellableLoot(player).filter(r => !r.stolen)'), 'честная скупка (Фёдор/Потап): краденые строки УБРАНЫ');
ok(isrc.includes('sellableLoot(player).filter(r => r.stolen)'), 'меню Скупщика: ТОЛЬКО краденое');
ok(isrc.includes('Скупщик (краденое)') && isrc.includes('drawFenceInterior'), 'кнопка Скупщика и ночная фигура на первом этаже двора');
ok(isrc.includes('isFenceInTown(this.registry, tsNow)'), 'кнопка/фигура — только в ночи Скупщика');
ok(isrc.includes("t('Краденое уходит без торга · каждая продажа — молва хуже (репутация −1)')"), 'в меню Скупщика — предупреждение о молве');

console.log('--- 6. Каждая продажа — репутация −1 (приказ 6) ---');
ok(FENCE_SALE_VILLAGE_REP === -1, 'константа −1 за продажу');
const reg6 = makeRegistry();
reg6.set('reputation', { villageRep: 0, npcRep: {} });
noteFenceSale(reg6, 'Убрус', 1);
noteFenceSale(reg6, 'Убрус', 1);
const repAfter3 = noteFenceSale(reg6, 'Горшок', 1);
ok(getVillageRep(reg6) === -3, `три продажи → ровно −3 (факт ${getVillageRep(reg6)})`);
ok(repAfter3 === -3, 'noteFenceSale возвращает новую репутацию');
ok(!fenceWarnedOnce(reg6), 'предупреждение о сбыте ещё НЕ показано');
markFenceWarned(reg6);
ok(fenceWarnedOnce(reg6), 'предупреждение о сбыте показано ОДИН раз (флаг)');

console.log('--- 7. Однократное красное предупреждение (приказ 7) ---');
const reg7 = makeRegistry();
ok(!crimeWarnedOnce(reg7), 'первая попытка: предупреждение ещё не показано');
markCrimeWarned(reg7);
ok(crimeWarnedOnce(reg7), 'флагcrimeWarned сохранён');
ok(CRIME_WARNING_TEXT().includes('противозаконное действие') && CRIME_WARNING_TEXT().includes('наказание'), 'текст приказа: «противозаконное действие… наказание»');
const vsrc = read('game/src/scenes/VillageScene.js');
ok(vsrc.includes('crimeWarnedOnce(this.registry)') && vsrc.includes("coverColor: 0x5a0f0f"), 'дверь: гейт предупреждения + красная подложка');
ok(isrc.includes('crimeWarnedOnce(this.registry)') && isrc.includes("coverColor: 0x5a0f0f"), 'сундук: гейт предупреждения + красная подложка');

console.log('--- 8. Взлом и Кража = 10 минут (приказ 8) ---');
ok(vsrc.includes("tickTime(this.registry, 10, 'walk')"), 'дверь (VillageScene): попытка = 10 минут');
ok(isrc.includes("tickTime(this.registry, 10, 'walk')"), 'сундук (InteriorScene): попытка = 10 минут');
ok(!vsrc.includes("tickTime(this.registry, 30, 'walk')"), 'дверь: 30-минутных попыток больше НЕТ');
ok(!isrc.includes("tickTime(this.registry, 30, 'walk')"), 'сундук: 30-минутных попыток больше НЕТ');

console.log('--- 9. Любая торговля = 30 минут, часы стоят (приказ 9) ---');
ok(TRADE_MINUTES === 30, 'TRADE_MINUTES = 30');
const reg9 = makeRegistry(9);
const t0 = reg9.get('gameTime').minute;
chargeTradeTime(reg9);
const t1 = reg9.get('gameTime');
const delta = ((t1.hour * 60 + t1.minute) - (9 * 60 + t0) + 1440) % 1440;
ok(delta === 30, `сделка списывает ровно 30 минут (факт ${delta})`);
ok(isrc.split('pauseWorldClock(this.registry)').length - 1 >= 5, 'торговые панели (≥5) ставят мировые часы на паузу');
ok(isrc.split('resumeWorldClock(this.registry)').length - 1 >= 5, 'закрытие панели снимает паузу');
ok(isrc.split('chargeTradeTime(this.registry)').length - 1 >= 7, 'каждая сделка (покупка ИЛИ продажа) списывает 30 минут');
ok(isrc.includes("tickTime(this.registry, MEAL_DURATION_MIN)"), 'еда двора — исключение: час по meal.js (съедается сразу)');

console.log('--- 10. «СЛАВА» → «РЕПУТАЦИЯ» (приказ 10) ---');
ok(!vsrc.includes('к славе в деревне'), 'VillageScene: «слава в деревне» в статовых строках удалена');
ok(!isrc.includes('к славе в деревне') && !isrc.includes('к доброй славе'), 'InteriorScene: «слава» в статовых строках удалена');
ok(!isrc.includes('слава у кузнеца') && !isrc.includes('славе у кузнеца'), 'кузница: «слава у кузнеца» → «репутация у кузнеца»');
const shopSrc = read('game/src/systems/shopRules.js');
ok(shopSrc.includes('репутация у кузнеца +{0}'), 'shopRules: отказ кузнеца называет репутацию');
ok(isrc.includes('−2 к репутации в деревне') || isrc.includes('−{2} к репутации в деревне'), 'скомороший переполох: репутация, не слава');
ok(isrc.includes('Добрая молва о работнике идёт по деревне: +1 к репутации'), 'подёнка: +1 к репутации (гончар/ткачиха/плотник)');

console.log('--- 11. i18n: EN-ключи патча 66.78 ---');
i18n.setLang('en');
const enKeys = [
    '⚠ ПРОТИВОЗАКОНИЕ!',
    'Вы хотите совершить противозаконное действие и за это может быть наказание и падение репутации.',
    '🌛 Скупщик (краденое)',
    'Тёмный угол постоялого двора — Скупщик',
    'Всё равно продать',
    'Ускользнуть',
    'Любая торговля занимает полчаса',
    'Краденое честным скупщикам не сбыть — только Скупщику по ночам',
    'Добрая молва о работнике идёт по деревне: +1 к репутации (ставка подёнки — раз в сутки).',
    '🔒 {0} — {1} {2} {3}   ·   репутация у кузнеца: {4}/{5}',
];
for (const k of enKeys) ok(i18n.t(k) !== k, `EN: «${k.slice(0, 40)}…» переведён`);
i18n.setLang('ru');

restoreRandom();
console.log(`\n=== ИТОГ: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

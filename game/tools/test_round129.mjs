// test_round129.mjs — 66.82: ДОЛГОВАЯ СИСТЕМА (приказы владельца 1–9).
//
//  1\ Меню персонажа — блок «ДОЛГИ» рядом с казной: строка на каждый
//     долг (кому, сколько, за что, срок; просрочка красным).
//  2\ Еда в долг у трактирщика — только хлеб и каша (CREDIT_FOOD_IDS).
//  3\ Ночлег в долг при нехватке денег (restInTavern opts.credit).
//  4\ Кредит ТОЛЬКО при положительной репутации (деревня И трактирщик),
//     суммарный долг ≤ 100 д., просрочившему нового не дают.
//  5\ Каждый взятый долг роняет репутацию по сумме:
//     деревня max(1, round(сумма/25)), трактирщик max(2, round(сумма/12)).
//  6\ ДВА срока у долга: выдачи и возврата (+7 дней, «до седьмого дня»).
//  7\ Отсрочка просрочки — проверка разговорного навыка (Убеждение/
//     Болтовня), НЕ БОЛЕЕ 3 раз (Судебник 1497, ст. 55 «О заемех»).
//  8\ Неуплата: стражник у ворот — монеты первым взносом, имущество
//     по 50% базовой цены, излишек возврату, надетое не трогают.
//  9\ Историческая рамка (без лихвы, срок до недели, отсрочка,
//     продажа добра должника) — закомментирована в systems/debts.js.
//
//  ПЛЮС: проводки сцен (CharacterScene/InteriorScene/VillageScene),
//  i18n EN-ключи всех новых строк, пин EN_KEYS (см. test_round116).
// Запуск из корня репозитория: node game/tools/test_round129.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const realRandom = Math.random;
function rollSeq(seq) { let i = 0; Math.random = () => (i < seq.length ? seq[i++] : 0.5); }
function restoreRandom() { Math.random = realRandom; }

import {
    debtDayIndex, loansOf, totalDebtOf, loanIsOverdue, overdueLoansOf,
    canTakeDebt, takeDebt, repayLoan, attemptDeferral,
    villageRepLossFor, npcRepLossFor,
    guardDebtNeeded, debtGuardBill, debtGuardCollect,
    creditorNameOf, debtShortLineOf, debtDueLabelOf, debtIssuedLabelOf,
    debtKindName, debtRefusalLine, previewDueLabelOf,
    CREDIT_FOOD_IDS, DEBT_MAX_TOTAL, DEBT_TERM_DAYS, DEBT_MAX_DEFERRALS,
    CONFISCATION_PRICE_FACTOR,
} from '../src/systems/debts.js';
import { getReputation, getVillageRep, getNpcRep } from '../src/data/reputation.js';
import { t, setLang } from '../src/systems/i18n.js';

function makeRegistry({ month = 6, day = 14, villageRep = 10, tkRep = 20, dengas = 30 } = {}) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month, day, hour: 12, minute: 0 });
    reg.set('player', {
        HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55, DEX: 70, POW: 55,
        skills: { persuade: 55, fast_talk: 40 },
        inventory: [], dengas,
        weaponId: 'club', armorId: 'none',
    });
    reg.set('reputation', { villageRep, npcRep: { tavernkeeper: tkRep } });
    reg.set('npcs', [{ id: 'tavernkeeper', met: true, knownDescription: 'Фёдор, трактирщик', strangerDescription: 'трактирщик', gender: 'male' }]);
    reg.set('quest', {});
    reg.set('actionLog', { entries: [] });
    return reg;
}

console.log('--- 1. Время: абсолютный день монотонен через месяц и год ---');
ok(debtDayIndex({ yearFromChrist: 1445, month: 6, day: 14 }) === 1445 * 366 + 181 + 14, 'debtDayIndex: год×366 + дни месяцев (сентябрь-стиль: сен+окт+ноя+дек+янв+фев = 181) + день');
{
    const a = debtDayIndex({ yearFromChrist: 1445, month: 0, day: 30 }); // 30 сентября
    const b = debtDayIndex({ yearFromChrist: 1445, month: 1, day: 1 });  // 1 октября
    ok(b === a + 1, 'через границу месяца: 1 октября = 30 сентября + 1');
    const c = debtDayIndex({ yearFromChrist: 1445, month: 11, day: 31 });
    const d = debtDayIndex({ yearFromChrist: 1446, month: 0, day: 1 });
    ok(d > c, 'через границу года: индекс растёт');
}

console.log('--- 2. П.5: падение репутации по сумме долга ---');
ok(villageRepLossFor(20) === 1 && villageRepLossFor(50) === 2 && villageRepLossFor(100) === 4, 'деревня: max(1, round(сумма/25)) → 20→1, 50→2, 100→4');
ok(npcRepLossFor(20) === 2 && npcRepLossFor(50) === 4 && npcRepLossFor(100) === 8, 'трактирщик: max(2, round(сумма/12)) → 20→2, 50→4, 100→8');

console.log('--- 3. П.4: кто может взять долг ---');
{
    const r0 = makeRegistry({ villageRep: 0, tkRep: 20 });
    ok(!canTakeDebt(r0, 10).ok && canTakeDebt(r0, 10).reason === 'rep_village', 'репутация деревни 0 → отказ (нужна ПОЛОЖИТЕЛЬНАЯ)');
    const r1 = makeRegistry({ villageRep: 10, tkRep: 0 });
    ok(!canTakeDebt(r1, 10).ok && canTakeDebt(r1, 10).reason === 'rep_npc', 'репутация трактирщика 0 → отказ');
    const r2 = makeRegistry({ villageRep: -5 });
    ok(!canTakeDebt(r2, 10).ok, 'отрицательная молва → отказ');
    const r3 = makeRegistry({});
    ok(canTakeDebt(r3, 20).ok, 'молва +10 / у Фёдора +20 → долг дают');
    ok(canTakeDebt(r3, 0).reason === 'amount' && !canTakeDebt(r3, -5).ok, 'сумма < 1 → отказ');
    ok(canTakeDebt(r3, 101).reason === 'cap', 'одна сумма > 100 → отказ по потолку');
}

console.log('--- 4. Пп.5–6: взятие долга — два срока и списания ---');
{
    const r = makeRegistry({ dengas: 0 });
    const res = takeDebt(r, { npcId: 'tavernkeeper', kind: 'food', amount: 20 });
    ok(res.ok && res.loan, 'долг взят');
    ok(res.loan.issuedDayIdx === debtDayIndex(r.get('gameTime')), 'срок выдачи записан (абсолютный день)');
    ok(res.loan.dueDayIdx === res.loan.issuedDayIdx + DEBT_TERM_DAYS, 'срок возврата = выдача + 7 дней («до седьмого дня», п.6)');
    ok(res.loan.issuedTs.day === 14 && res.loan.issuedTs.month === 6, 'дата выдачи календарём: 14 марта (сентябрь-стиль: инд. 6)');
    ok(res.loan.dueTs.day === 21 && res.loan.dueTs.month === 6, 'дата возврата: 21 марта');
    ok(totalDebtOf(r) === 20, 'суммарный долг 20 д.');
    const rep = getReputation(r);
    ok(rep.villageRep === 9, 'деревня 10 − 1 = 9 (п.5)');
    ok(getNpcRep(r, 'tavernkeeper') === 18, 'у Фёдора 20 − 2 = 18 (п.5)');
    ok(loansOf(r).length === 1 && loansOf(r)[0].kind === 'food', 'в столбце одна запись «еда»');
    // Второй долг: суммарный потолок 100 (п.4)
    takeDebt(r, { kind: 'lodging', amount: 70 });
    ok(totalDebtOf(r) === 90, 'второй долг 70 д. → всего 90');
    const third = canTakeDebt(r, 20);
    ok(!third.ok && third.reason === 'cap', '90 + 20 > 100 → потолок (п.4)');
    ok(canTakeDebt(r, 10).ok, '90 + 10 = 100 → ровно по потолку можно');
}

console.log('--- 5. Просрочка: пп.6–7 (отсрочка не более 3 раз) ---');
{
    const r = makeRegistry({ dengas: 50 });
    takeDebt(r, { kind: 'lodging', amount: 12 });
    const loan = loansOf(r)[0];
    ok(!loanIsOverdue(loan, debtDayIndex(r.get('gameTime'))), 'в день выдачи долг не просрочен');
    ok(overdueLoansOf(r).length === 0 && !guardDebtNeeded(r), 'стражнику делать нечего до срока');
    const gt = r.get('gameTime'); gt.day = 21; r.set('gameTime', gt); // день возврата
    ok(!loanIsOverdue(loan, debtDayIndex(gt)), 'в САМ день возврата ещё не просрочено («до 21-го»)');
    gt.day = 22; r.set('gameTime', gt);
    ok(loanIsOverdue(loan, debtDayIndex(gt)) && overdueLoansOf(r).length === 1, 'на следующий день просрочено');
    ok(guardDebtNeeded(r), 'п.8: стражник у ворот имеет долговое дело');
    // Новый долг просрочившему не дают (п.4, строго логично)
    ok(!canTakeDebt(r, 5).ok && canTakeDebt(r, 5).reason === 'overdue', 'просрочившему новый долг не дают');
    // Отсрочка: успех (бросок 11 при навыке 55)
    rollSeq([0.1]); const okDef = attemptDeferral(r, loan.id, r.get('player')); restoreRandom();
    ok(okDef.ok && okDef.deferrals === 1, 'п.7: отсрочка №1 выторгована (проверка разговорного навыка)');
    ok(loan.dueDayIdx === debtDayIndex(gt) + DEBT_TERM_DAYS, 'срок сдвинут на неделю вперёд');
    ok(!loanIsOverdue(loan, debtDayIndex(gt)), 'после отсрочки долг не просрочен');
    // Отсрочка НЕ просроченному не нужна
    const res2 = attemptDeferral(r, loan.id, r.get('player'));
    ok(!res2.ok === false || res2.reason === 'not_overdue', 'по не-просроченному долгу отсрочка не даётся (not_overdue)');
    // Три отсрочки — предел
    for (let i = 0; i < 2; i++) {
        const g2 = r.get('gameTime'); g2.day += 10; r.set('gameTime', g2);
        rollSeq([0.05]); attemptDeferral(r, loan.id, r.get('player')); restoreRandom();
    }
    const g3 = r.get('gameTime'); g3.day += 10; r.set('gameTime', g3);
    ok(loan.deferrals === 3, 'три отсрочки выторгованы');
    const res4 = attemptDeferral(r, loan.id, r.get('player'));
    ok(res4.reason === 'max_deferrals', 'п.7: четвёртой отсрочки НЕ БЫВАЕТ');
    // Провал отсрочки: репутация −3
    const r2 = makeRegistry({ dengas: 0 });
    takeDebt(r2, { kind: 'food', amount: 8 });
    const l2 = loansOf(r2)[0];
    const g4 = r2.get('gameTime'); g4.day = l2.dueDayIdx - debtDayIndex({ yearFromChrist: 1445, month: 6, day: 14 }) + 22; r.set('gameTime', g4);
    const repBefore = getNpcRep(r2, 'tavernkeeper');
    rollSeq([0.99]); const failDef = attemptDeferral(r2, l2.id, r2.get('player')); restoreRandom();
    ok(!failDef.ok, 'провал проверки — отсрочки нет');
    ok(getNpcRep(r2, 'tavernkeeper') === repBefore - 3, 'п.7: заимодавец не верит — репутация −3');
}

console.log('--- 6. Возврат долга (п.6): в срок и с запозданием ---');
{
    const r = makeRegistry({ dengas: 30, villageRep: 10, tkRep: 10 });
    takeDebt(r, { kind: 'food', amount: 10 });
    const loan = loansOf(r)[0];
    const repBefore = getNpcRep(r, 'tavernkeeper');
    const res = repayLoan(r, loan.id);
    ok(res.ok && res.paid === 10 && res.onTime, 'долг 10 д. возвращён в срок');
    ok(getNpcRep(r, 'tavernkeeper') === repBefore + 2, 'доверие заимодавца +2 за своевременный возврат');
    ok(loansOf(r).length === 0 && totalDebtOf(r) === 0, 'запись из столбца выбита');
    ok(r.get('player').dengas === 20, 'монеты списаны (30 → 20)');
    const poor = repayLoan(r, 'нет такого');
    ok(!poor.ok && poor.reason === 'no_loan', 'возврат несуществующего долга невозможен');
    // С запозданием — без бонуса
    takeDebt(r, { kind: 'lodging', amount: 8 });
    const l2 = loansOf(r)[0];
    const g = r.get('gameTime'); g.day += 10; r.set('gameTime', g);
    const before2 = getNpcRep(r, 'tavernkeeper');
    const res2 = repayLoan(r, l2.id);
    ok(res2.ok && !res2.onTime, 'просроченный долг возвращён «с запозданием»');
    ok(getNpcRep(r, 'tavernkeeper') === before2, 'молва помнит запоздание: бонуса НЕТ');
    // Денег не хватает
    takeDebt(r, { kind: 'food', amount: 6 });
    const l3 = loansOf(r)[0];
    r.get('player').dengas = 5;
    const res3 = repayLoan(r, l3.id);
    ok(!res3.ok && res3.reason === 'poor', 'не хватает монет — возврат невозможен');
}

console.log('--- 7. П.8: взыскание стражником (50% цены, монеты первым взносом) ---');
{
    const r = makeRegistry({ dengas: 7, villageRep: 10, tkRep: 20 });
    const p = r.get('player');
    p.inventory = [
        { id: 'fish_raw', count: 4 },      // sell 2 → unit50 = 1 → 4 д.
        { id: 'fish_cooked', count: 3 },   // sell 4 → unit50 = 2 → 6 д.
        { id: 'skin', count: 1 },          // дорогая шкура
        { id: 'club', count: 1 },          // ДРУЖИННОЕ ОРУЖИЕ В РУКАХ (weaponId) — не трогают
        { id: 'padded', count: 1 },        // надетый тегиляй (armorId) — не трогают
    ];
    p.armorId = 'padded';
    takeDebt(r, { kind: 'lodging', amount: 12 });
    const g = r.get('gameTime'); g.day += 10; r.set('gameTime', g);
    const bill = debtGuardBill(r);
    ok(bill.totalDebt === 12 && bill.coins === 7, 'превью: долг 12 д., монет 7 д. (первый взнос)');
    ok(bill.items.some(i => i.id === 'fish_raw') && bill.items.some(i => i.id === 'skin'), 'опись: лут в списке');
    ok(!bill.items.some(i => i.id === 'club') && !bill.items.some(i => i.id === 'padded'), 'надетое (оружие в руках, тегиляй) НЕ описывают');
    const raw50 = bill.items.find(i => i.id === 'fish_raw');
    ok(raw50.unit50 === 1 && raw50.sale50 === 4, 'п.8: 50% цены — рыба сырая 2 д. → 1 д. за штуку, 4 шт. = 4 д.');
    const res = debtGuardCollect(r);
    ok(res.coinsTaken === 7, 'монеты взяты первым взносом (7 из 12)');
    ok(res.takenItems.length >= 1, 'имущество продано в счёт долга');
    ok(p.inventory.some(e => e.id === 'club') && p.inventory.some(e => e.id === 'padded'), 'надетое осталось у должника');
    ok(res.stillOwed === 0, 'долг покрыт полностью');
    ok(p.dengas >= 0, 'мошна не уходит в минус');
}

console.log('--- 8. П.8: излишек продажи возвращается, недопокрытие остаётся долгом ---');
{
    const r = makeRegistry({ dengas: 0, villageRep: 10, tkRep: 20 });
    const p = r.get('player');
    p.inventory = [{ id: 'fish_cooked', count: 10 }]; // sell 4 → 2 д./шт → 20 д. за кучку
    takeDebt(r, { kind: 'food', amount: 9 });
    const g = r.get('gameTime'); g.day += 10; r.set('gameTime', g);
    const res = debtGuardCollect(r);
    ok(res.collected === 20, 'кучка продана за 20 д. (50% от 40)');
    ok(res.surplus === 11, 'излишек 11 д. вернули должнику (продали лишнего — вернули остаток)');
    ok(p.dengas === 11 && res.stillOwed === 0, 'мошна 11 д., долг закрыт');
}
{
    // Патч 66.83 (п.8 дословно): надетое описывается СЛЕД за инвентарём —
    // клуб в руках (2 д. цены → 1 д.) и тегиляй (10 д. → 5 д.) дополняют уплату
    const r = makeRegistry({ dengas: 0, villageRep: 10, tkRep: 20 });
    const p = r.get('player');
    p.weaponId = 'club';
    p.armorId = 'padded';
    p.inventory = [
        { id: 'fish_raw', count: 1 },   // 1 д. продажи
        { id: 'club', count: 1 },       // надетое оружие (в руках)
        { id: 'padded', count: 1 },     // надетый тегиляй
    ];
    takeDebt(r, { kind: 'lodging', amount: 6 });
    const g = r.get('gameTime'); g.day += 10; r.set('gameTime', g);
    const res = debtGuardCollect(r);
    ok(res.stillOwed === 0, 'после инвентаря (1 д.) и надетого (клуб 1 д. + тегиляй 5 д.) долг 10 д. покрыт');
    ok(p.weaponId === 'fists' && p.armorId === 'none', 'надетое ушло: оружие → кулаки, доспех → «без доспеха»');
    ok(loansOf(r).length === 0, 'долг закрыт правежом с надетым (66.83)');
    ok(p.dengas === 1, 'лишек 1 д. вернулся в мошну');
    ok(!guardDebtNeeded(r), 'после полного правежа (66.83) стражнику дела нет');
}

console.log('--- 9. Строки для свитка и меню (пп.1, 6) ---');
{
    const r = makeRegistry({ month: 6, day: 14, villageRep: 10, tkRep: 20 });
    takeDebt(r, { kind: 'food', amount: 12 });
    const loan = loansOf(r)[0];
    ok(debtDueLabelOf(loan) === 'до 21 марта', 'срок возврата словами: «до 21 марта»');
    ok(debtIssuedLabelOf(loan) === 'взят 14 марта', 'дата выдачи: «взят 14 марта» (п.6 — ДВА срока)');
    ok(debtKindName('lodging') === 'ночлег' && debtKindName('food') === 'еда', 'причины долга: еда/ночлег');
    ok(creditorNameOf(r, 'tavernkeeper') === 'Фёдор, трактирщик', 'имя заимодавца из реестра');
    const line = debtShortLineOf(r, loan);
    ok(line.includes('Фёдор, трактирщик') && line.includes('12 д.') && line.includes('еда') && line.includes('до 21 марта'), 'строка п.1: кому, сколько, за что и срок');
    ok(!line.includes('ПРОСРОЧЕНО'), 'срочный долг не помечен просрочкой');
    const g = r.get('gameTime'); g.day += 20; r.set('gameTime', g);
    ok(debtShortLineOf(r, loan).includes('ПРОСРОЧЕНО'), 'просроченный долг помечен в строке');
    ok(debtRefusalLine('rep_village').includes('ПОЛОЖИТЕЛЬНОЙ'), 'отказ «не по молве» объясняет правило');
    ok(previewDueLabelOf(r).startsWith('до '), 'превью срока — календарём');
}

console.log('--- 10. Кредит еды: только хлеб и каша (п.2) ---');
ok(CREDIT_FOOD_IDS.length === 2 && CREDIT_FOOD_IDS.includes('bread') && CREDIT_FOOD_IDS.includes('kasha'), 'CREDIT_FOOD_IDS = [bread, kasha] — хмельного в долг НЕТ');
ok(CONFISCATION_PRICE_FACTOR === 0.5 && DEBT_MAX_TOTAL === 100 && DEBT_MAX_DEFERRALS === 3, 'константы приказов: 50% / 100 д. / 3 отсрочки');

console.log('--- 11. Проводки сцен ---');
const cs = read('game/src/scenes/CharacterScene.js');
ok(cs.includes("from '../systems/debts.js'") && cs.includes("t('📜 Долги:')"), 'CharacterScene: блок ДОЛГИ рядом с казной (п.1)');
ok(cs.includes('Долгов нет.') && cs.includes('…и ещё {0} долгов.'), 'CharacterScene: пустой столбец и «ещё N»');
const is = read('game/src/scenes/InteriorScene.js');
ok(is.includes('offerFoodOnCredit') && is.includes('offerLodgingOnCredit'), 'InteriorScene: еда и ночлег В ДОЛГ (пп.2–3)');
ok(is.includes('showDebtsMenu') && is.includes('attemptDeferral') && is.includes('repayLoan'), 'InteriorScene: меню «Долги» — возврат и отсрочка (пп.6–7)');
ok(is.includes('debtFullLineOf') && is.includes('debtIssuedLabelOf'), 'InteriorScene: в меню долга ДВА срока — «взят …, до …» (п.6)');
ok(is.includes('CREDIT_FOOD_IDS.includes(item.id)'), 'InteriorScene: в долг только хлеб и каша');
ok(is.includes('{ credit: true }') && is.includes('onCredit'), 'InteriorScene: ночлег в долг без списания монет');
const vs = read('game/src/scenes/VillageScene.js');
ok(vs.includes('guardDebtNeeded') && vs.includes('showDebtGuard') && vs.includes('debtGuardCollect'), 'VillageScene: стражник-взыскатель у ворот (п.8)');
const db = read('game/src/systems/debts.js');
ok(db.includes('без лихвы') && db.includes('Судебник 1497') && db.includes('О заемех'), 'п.9: историческая рамка в док-блоке (лихва/Судебник/отсрочка)');

console.log('--- 12. i18n: EN-ключи долговой системы ---');
setLang('en');
const enChecks = [
    ['еда', 'food'],
    ['ночлег', 'lodging'],
    ['в долг', 'on credit'],
    ['Долгов нет.', 'No debts.'],
    ['🪙 Долги в столбце', '🪙 Debts on the tally'],
    ['Отдать долг, чем есть', 'Pay the debt with what you have'],
];
for (const [ru, en] of enChecks) ok(t(ru) === en, `EN: «${ru}» → «${en}»`);
ok(t('«Хмельного в долг не держу — пропьёшь. А вот хлеб да кашу — это дело другое».').startsWith('"No strong drink'), 'EN: хмельное в долг не дают');
ok(t('{0} — {1} д. ({2}), {3}{4}') !== '{0} — {1} д. ({2}), {3}{4}', 'EN: шаблон строки долга переведён');
ok(t('— ПРОСРОЧЕНО!') !== '— ПРОСРОЧЕНО!' || t(' — ПРОСРОЧЕНО!') !== ' — ПРОСРОЧЕНО!', 'EN: пометка просрочки переведена');
setLang('ru');
ok(t('Долгов нет.') === 'Долгов нет.', 'RU: t() возвращает исходную строку');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

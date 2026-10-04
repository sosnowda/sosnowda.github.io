// test_round127.mjs — 66.79: ТРИНАДЦАТЬ ПРИКАЗОВ ВЛАДЕЛЬЦА (правосудие):
//  1\ Обворованные НПЦ ВСЕГДА подозревают игрока — нужна проверка
//     разговорного навыка (лучший из Убеждения/Болтовни) — justice.js;
//  2\ Удачная проверка снимает подозрение ДО следующей кражи;
//  3\ Повторная кража у того же НПЦ — сложность −15% за каждую прежнюю;
//  4\ Провал проверки: репутация у НПЦ −10 (точно), в деревне −5 (точно);
//  5\ СТРАЖНИК у ворот: осмотр узла, краденое изымается, вира по
//     Судебнику 1497 (продажа 24 д. + урок за сбытое по полной цене),
//     деревенская репутация −15;
//  6\ ПРИМИРЕНИЕ: вернуть украденное или компенсировать по полной
//     стоимости + вира 24 д.; подозрение и «поимка» сняты;
//  7\ Повторная поимка — вира и падение репутации ×3;
//  8\ Третья поимка — всё имущество отобрано, изгнание = ПРОВАЛ
//     (q.expelledFromVillage → 'defeat_expelled');
//  9\ Красный поп-ап «к дому идут хозяева» ДО прихода + побег через
//     Ловкость (ЛОВ×5) или Скрадывание (attemptChestPick deferOwners);
// 10\ Удачный побег — герой снаружи дома (placePlayerOutsideHouse);
// 11–12\ предложения баланса — docs/BALANCE_PROPOSALS_6679.md (source);
// 13\ Диалоги RU+EN: EN-ключи всех новых строк (i18n.js).
// Запуск из корня репозитория: node game/tools/test_round127.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const realRandom = Math.random;
function rollSeq(seq) {
    let i = 0;
    Math.random = () => (i < seq.length ? seq[i++] : 0.5);
}
function restoreRandom() { Math.random = realRandom; }

function makeRegistry(hour = 12) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour, minute: 0 });
    reg.set('player', {
        HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55, DEX: 70, POW: 55,
        skills: { stealth: 68, lockpicking: 60, persuade: 40, fast_talk: 55 },
        inventory: [], dengas: 0,
    });
    reg.set('reputation', { villageRep: 0, npcRep: { potter1: 0, weaver1: 0 } });
    reg.set('quest', {});
    return reg;
}

// ---------- Импорты ----------
const justice = await import(join(ROOT, 'game/src/systems/justice.js'));
const crime = await import(join(ROOT, 'game/src/systems/crime.js'));
const burglary = await import(join(ROOT, 'game/src/systems/burglary.js'));
const loot = await import(join(ROOT, 'game/src/systems/loot.js'));
const rep = await import(join(ROOT, 'game/src/data/reputation.js'));
const i18n = await import(join(ROOT, 'game/src/systems/i18n.js'));
const {
    SUSPECT_PENALTY_PER_RETHEFT, SUSPECT_FAIL_NPC_REP, SUSPECT_FAIL_VILLAGE_REP,
    THEFT_VIRA_SALE, GUARD_VILLAGE_REP, REPEAT_MULT, CATCHES_EXPULSION,
    noteTheftDone, isSuspecting, theftCountOf, suspectCheckSkill, attemptInnocence,
    markCaughtRedhanded, isCaughtByHost, hasGuardBusiness, caughtCountOf,
    noteSoldStolen, soldStolenValueOf, guardBill, guardInspection,
    reconcileNeeds, reconcileWithHost,
} = justice;
const { rollOwnersReturn, applyOwnersCaught } = crime;
const { attemptChestPick } = burglary;
const { addStolenItem } = loot;
const { getVillageRep, getNpcRep } = rep;

console.log('--- 0. Константы правосудия (точные значения приказов) ---');
ok(SUSPECT_PENALTY_PER_RETHEFT === 15, 'п.3: сложность −15% за каждую прежнюю кражу');
ok(SUSPECT_FAIL_NPC_REP === -10 && SUSPECT_FAIL_VILLAGE_REP === -5, 'п.4: провал проверки — −10 у НПЦ / −5 в деревне');
ok(THEFT_VIRA_SALE === 24, 'вира-«продажа» за татьбу 24 д. (12 гривен по 2 д., Судебник 1497)');
ok(GUARD_VILLAGE_REP === -15, 'п.5: поимка стражником — деревенская репутация −15');
ok(REPEAT_MULT === 3, 'п.7: повторная поимка ×3');
ok(CATCHES_EXPULSION === 3, 'п.8: третья поимка — изгнание');

console.log('--- 1. Подозрение после кражи (приказы 1–3) ---');
const reg1 = makeRegistry();
ok(!isSuspecting(reg1, 'potter1'), 'до кражи подозрения нет');
const n1 = noteTheftDone(reg1, 'potter1');
ok(n1.theftCount === 1 && isSuspecting(reg1, 'potter1'), 'п.1: после кражи хозяин ВСЕГДА подозревает');
const chk1 = suspectCheckSkill(reg1, 'potter1', reg1.get('player'));
ok(chk1.skill === 55 && chk1.effective === 55 && chk1.penalty === 0, `первая кража: навык max(Убеждение 40, Болтовня 55)=55 без штрафа (факт ${chk1.effective})`);

// Повторная кража — сложность падает на 15%
noteTheftDone(reg1, 'potter1');
const chk2 = suspectCheckSkill(reg1, 'potter1', reg1.get('player'));
ok(chk2.thefts === 2 && chk2.penalty === 15 && chk2.effective === 40, `п.3: вторая кража — сложность 55−15=40 (факт ${chk2.effective})`);
noteTheftDone(reg1, 'potter1');
const chk3 = suspectCheckSkill(reg1, 'potter1', reg1.get('player'));
ok(chk3.thefts === 3 && chk3.penalty === 30 && chk3.effective === 25, `п.3: третья кража — 55−30=25 (факт ${chk3.effective})`);
ok(theftCountOf(reg1, 'weaver1') === 0, 'у другого НПЦ счётчик краж свой (нулевой)');

console.log('--- 2. Проверка «невиновности»: успех/провал (приказы 2, 4) ---');
const reg2 = makeRegistry();
noteTheftDone(reg2, 'potter1');
rollSeq([0.30]); // бросок 31 ≤ 55 — успех
const ok2 = attemptInnocence(reg2, 'potter1', reg2.get('player'), { rng: Math.random });
restoreRandom();
ok(ok2.ok === true, 'успешная проверка разговорным навыком');
ok(!isSuspecting(reg2, 'potter1'), 'п.2: подозрение снято ДО следующей кражи');
ok(getNpcRep(reg2, 'potter1') === 0 && getVillageRep(reg2) === 0, 'успех: репутации не тронуты');
noteTheftDone(reg2, 'potter1'); // новая кража — подозрение вернулось
ok(isSuspecting(reg2, 'potter1'), 'после НОВОЙ кражи хозяин снова подозревает');

const reg2b = makeRegistry();
noteTheftDone(reg2b, 'potter1');
rollSeq([0.99]); // бросок 100 — провал
const bad2 = attemptInnocence(reg2b, 'potter1', reg2b.get('player'), { rng: Math.random });
restoreRandom();
ok(bad2.ok === false, 'провал проверки');
ok(getNpcRep(reg2b, 'potter1') === -10, `п.4: репутация у НПЦ −10 точно (факт ${getNpcRep(reg2b, 'potter1')})`);
ok(getVillageRep(reg2b) === -5, `п.4: деревенская −5 точно (факт ${getVillageRep(reg2b)})`);

console.log('--- 3. Происхождение краденого и сбыт (пп.5–6) ---');
const reg3 = makeRegistry();
const p3 = reg3.get('player');
p3.dengas = 100; // хватает на счёт стражника
addStolenItem(p3, 'sukon', 2, 'potter_house');   // краденое из дома гончара
addStolenItem(p3, 'grain', 3, 'potter_house');
addStolenItem(p3, 'wax', 1, 'elder_house');      // из другого дома — отдельная кучка
reg3.set('player', p3);
ok(p3.inventory.length === 3, 'краденое разных домов — отдельные кучки (from)');
noteSoldStolen(reg3, 'potter_house', 24); // сбыто сукна на 24 д. полной цены
noteSoldStolen(reg3, 'potter_house', 8);
ok(soldStolenValueOf(reg3, 'potter_house') === 32, `сбыт копится по дому (факт ${soldStolenValueOf(reg3, 'potter_house')})`);
ok(soldStolenValueOf(reg3, 'elder_house') === 0, 'у другого дома сбыта нет');

console.log('--- 4. Стражник у ворот: счёт и осмотр (п.5) ---');
markCaughtRedhanded(reg3, 'potter1', 'potter_house'); // хозяева застукали (дом для урока)
ok(isCaughtByHost(reg3, 'potter1') && hasGuardBusiness(reg3), 'п.5: уличён — стражник вправе остановить');
const bill = guardBill(reg3, p3);
ok(bill.items.length === 3 && bill.confiscatedValue > 0, `счёт: к изъятию 3 кучки (сукно×2, зерно×3, воск×1)`);
ok(bill.vira === 24 && bill.soldBill === 32 && bill.total === 56, `п.5: вира 24 + урок за сбытое 32 = 56 д. (факт ${bill.total})`);
ok(bill.villageRep === -15 && bill.mult === 1, 'первая поимка: −15 деревне, множитель ×1');
const insp = guardInspection(reg3);
ok(insp.items.length === 3 && p3.inventory.length === 0, 'изъято ВСЁ краденое (узел чист)');
ok(p3.dengas === 44 && insp.lostDengas === 56, `уплачено 56 д. (в мошне было 100, факт ${insp.lostDengas}, остаток ${p3.dengas})`);
ok(getVillageRep(reg3) === -15, `деревенская репутация −15 (факт ${getVillageRep(reg3)})`);
ok(!hasGuardBusiness(reg3) && insp.caughtCount === 1, 'мир за этот дом: стражнику причин больше нет');

console.log('--- 5. Повторная поимка ×3 (п.7) ---');
const reg5 = makeRegistry();
const p5 = reg5.get('player');
p5.dengas = 300;
addStolenItem(p5, 'honey', 2, 'potter_house');
reg5.set('player', p5);
markCaughtRedhanded(reg5, 'potter1', 'potter_house');
const b5a = guardBill(reg5, p5);
ok(b5a.mult === 1 && b5a.vira === 24 && b5a.villageRep === -15, 'первая поимка: базовые значения');
guardInspection(reg5);
// снова застукали и снова крали
addStolenItem(p5, 'wax', 1, 'elder_house');
markCaughtRedhanded(reg5, 'elder', 'elder_house');
const b5b = guardBill(reg5, p5);
ok(b5b.mult === 3 && b5b.vira === 72 && b5b.villageRep === -45, `п.7: повторная поимка ×3 — вира 72 д., репутация −45 (факт ${b5b.vira}/${b5b.villageRep})`);
const insp5 = guardInspection(reg5);
ok(insp5.caughtCount === 2 && !insp5.expelled, 'вторая поимка — ещё не провал');

console.log('--- 6. Третья поимка: ИЗГНАНИЕ = ПРОВАЛ (п.8) ---');
const reg6 = makeRegistry();
const p6 = reg6.get('player');
p6.dengas = 500;
addStolenItem(p6, 'iron', 1, 'blacksmith');
reg6.set('player', p6);
for (let i = 0; i < 2; i++) { markCaughtRedhanded(reg6, 'potter1', 'potter_house'); guardInspection(reg6); addStolenItem(p6, 'iron', 1, 'blacksmith'); }
ok(caughtCountOf(reg6) === 2, 'до решающей поимки — 2');
markCaughtRedhanded(reg6, 'potter1', 'potter_house');
const insp6 = guardInspection(reg6);
ok(insp6.expelled === true, 'п.8: третья поимка — изгнание');
ok(p6.inventory.length === 0 && p6.dengas === 0, 'всё имущество отобрано (узел и мошна пусты)');
ok(reg6.get('quest').expelledFromVillage === true, 'флаг провала: q.expelledFromVillage (EndScene «ИЗГНАН ИЗ ДЕРЕВНИ»)');

console.log('--- 7. Примирение с обкраденным НПЦ (п.6) ---');
const reg7 = makeRegistry();
const p7 = reg7.get('player');
p7.dengas = 100;
addStolenItem(p7, 'clay_pot', 2, 'potter_house');
reg7.set('player', p7);
noteTheftDone(reg7, 'potter1');
markCaughtRedhanded(reg7, 'potter1', 'potter_house');
noteSoldStolen(reg7, 'potter_house', 12); // сбыл часть на 12 д. полной цены
const needs = reconcileNeeds(reg7, p7, 'potter_house');
ok(needs.entries.length === 1 && needs.returnCount === 2, 'п.6: вернуть краденое этого дома (горшки ×2)');
ok(needs.soldValue === 12 && needs.vira === 24 && needs.total === 36, `счёт мира: сбытое 12 + вира 24 = 36 д. (факт ${needs.total})`);
rep.changeNpcRepExact(reg7, 'potter1', -30); // после застукивания у хозяина −30
const peace = reconcileWithHost(reg7, 'potter1', 'potter_house');
ok(peace.success === true, 'мир свершен');
ok(p7.dengas === 100 - 36 && p7.inventory.length === 0, 'уплачено 36 д., краденое вернулось хозяину');
ok(!isSuspecting(reg7, 'potter1') && !isCaughtByHost(reg7, 'potter1'), 'подозрение снято, стражник за этот дом не тронет');
ok(getNpcRep(reg7, 'potter1') === 0, `обида смыта: репутация хозяина 0 (факт ${getNpcRep(reg7, 'potter1')})`);
// Не хватает денег
const reg7b = makeRegistry();
const p7b = reg7b.get('player');
p7b.dengas = 5;
addStolenItem(p7b, 'grain', 1, 'potter_house');
reg7b.set('player', p7b);
noteSoldStolen(reg7b, 'potter_house', 60);
const poor = reconcileWithHost(reg7b, 'potter1', 'potter_house');
ok(poor.success === false && poor.reason === 'poor', 'без денег мир не выходит (нужна компенсация + вира)');

console.log('--- 8. Побег от хозяев: deferOwners (пп.9–10) ---');
const reg8 = makeRegistry(12);
rollSeq([0.30, 0.10]); // Скрадывание 31 (успех) → хозяева пришли (10%<20%) — БЕЗ списаний
const res8 = attemptChestPick(reg8, reg8.get('player'), 'potter_house', reg8.get('gameTime'), {
    stealth: 68, lock: 60, rng: Math.random, hostNpcId: 'potter1', deferOwners: true,
});
restoreRandom();
ok(res8.ownersCame === true && res8.ownersDeferred === true, 'пп.9: хозяева идут — поп-ап до прихода (deferOwners)');
ok(getNpcRep(reg8, 'potter1') === 0 && getVillageRep(reg8) === 0, 'пока игрок НЕ застукан: репутации целы (шанс побега)');
ok(hasGuardBusiness(reg8) === false, 'стражнику причин нет — побег ещё возможен');
// Провал побега → applyOwnersCaught: −30/−20 + маркер стражника
rollSeq([0.30]); // атака: мужчина 30%<40% — нападёт
const caught = applyOwnersCaught(reg8, { hostNpcId: 'potter1', interiorId: 'potter_house', rng: Math.random });
restoreRandom();
ok(getNpcRep(reg8, 'potter1') === -30 && getVillageRep(reg8) === -20, 'провал побега: −30 у хозяев, −20 в деревне (точно)');
ok(isCaughtByHost(reg8, 'potter1') && hasGuardBusiness(reg8), 'застукали — стражник у ворот вправе осмотреть узел');
ok(caught.attack === true, 'застукавшие хозяева могут и напасть (мужчина 40%)');

console.log('--- 9. Успешный побег: никакой кары (пп.9–10) ---');
const reg9 = makeRegistry(12);
rollSeq([0.30, 0.10]); // Скрадывание 31 (успех) → хозяева пришли
const res9 = attemptChestPick(reg9, reg9.get('player'), 'weaver_house', reg9.get('gameTime'), {
    stealth: 68, lock: 60, rng: Math.random, hostNpcId: 'weaver1', deferOwners: true,
});
restoreRandom();
ok(res9.ownersCame === true && res9.done === false, 'хозяева идут (ткачиха — женщина), попытка сорвана: сундук не помечен');
// игрок сбежал (успешная проверка в сцене) — списаний НЕТ
ok(getNpcRep(reg9, 'weaver1') === 0 && getVillageRep(reg9) === 0 && !hasGuardBusiness(reg9),
    'п.9: удачный побег — «его не обнаруживают»: репутации целы, стражник не в деле');

console.log('--- 10. Совместимость: старый путь (без defer) — карает сразу ---');
const reg10 = makeRegistry(12);
rollSeq([0.30, 0.10, 0.5]); // Скрадывание 31 (успех) → хозяева пришли → атака 50%≥40% — нет
const res10 = attemptChestPick(reg10, reg10.get('player'), 'potter_house', reg10.get('gameTime'), {
    stealth: 68, lock: 60, rng: Math.random, hostNpcId: 'potter1',
});
restoreRandom();
ok(res10.ownersCame === true && res10.hostAttacks === false, 'без deferOwners — прежнее поведение (сразу карает, атака по броску)');
ok(getNpcRep(reg10, 'potter1') === -30 && getVillageRep(reg10) === -20, '−30/−20 применены сразу (совместимость с 66.78)');

console.log('--- 11. i18n: EN-ключи правосудия (п.13) ---');
i18n.setLang('en');
const enKeys = [
    '⚠ К дому идут хозяева!',
    '🛡 Стражник у ворот',
    '🚪 ИЗГНАНИЕ ИЗ ДЕРЕВНИ',
    'Мириться (кража)',
    'Отвести подозрение ({0}%)',
    '🤝 Признаться и помириться',
    '💨 Ушёл чистым',
    'Предъявить узел и уплатить',
    '• выплатить виру за кражу: {0} д. (Судебник 1497, о татбе).',
    'Уличён в краже трижды: имущество отобрано, из деревни изгнан.',
    '(Побег — обязательная проверка Ловкости или Скрадывания. Удача — тебя не заметят; провал — застукают на месте преступления.)',
    '🏃 Бежать (Ловкость)',
];
for (const k of enKeys) ok(i18n.t(k) !== k, `EN: «${k.slice(0, 36)}…» переведён`);
i18n.setLang('ru');

console.log('--- 12. Source-проверки сцен (пп.1,5,6,9,10) ---');
const isrc = read('game/src/scenes/InteriorScene.js');
const vsrc = read('game/src/scenes/VillageScene.js');
ok(isrc.includes('deferOwners: true'), 'InteriorScene: сундук даёт шанс побега (deferOwners)');
ok(isrc.includes('showOwnersComing') && isrc.includes('⚠ К дому идут хозяева!'), 'InteriorScene: красный поп-ап «к дому идут хозяева»');
ok(isrc.includes('attemptOwnerEscape') && isrc.includes('skillCheck(dex * 5)'), 'InteriorScene: побег — Ловкость (ЛОВ×5) или Скрадывание');
ok(isrc.includes('placePlayerOutsideHouse'), 'InteriorScene: удачный побег — герой снаружи дома');
ok(isrc.includes('noteTheftDone(this.registry, interior.npcId)'), 'InteriorScene: после кражи хозяин подозревает (п.1)');
ok(isrc.includes('showReconcileMenu') && isrc.includes('reconcileWithHost'), 'InteriorScene: примирение с обкраденным (п.6)');
ok(isrc.includes('noteSoldStolen'), 'InteriorScene: сбыт Скупщику копит урок по домам');
ok(vsrc.includes('exitVillageThroughGate') && vsrc.includes('hasGuardBusiness'), 'VillageScene: стражник останавливает у ворот (п.5)');
ok(vsrc.includes('guardInspection(this.registry)'), 'VillageScene: осмотр узла с изъятием и вирой');
ok(vsrc.includes('expelledFromVillage = true'), 'VillageScene: третья поимка — изгнание (п.8)');
const jsrc = read('game/src/systems/justice.js');
ok(jsrc.includes('Судебник 1497'), 'justice.js: историческая рамка Судебника 1497');
ok(read('game/docs/BALANCE_PROPOSALS_6679.md').includes('БАЛАНС'), 'пп.11–12: предложения баланса вынесены в документ');

restoreRandom();
console.log(`\n=== ИТОГ: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

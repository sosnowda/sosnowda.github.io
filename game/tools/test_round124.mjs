// test_round124.mjs — 66.76: ЧЕТВЁРТАЯ ВОЛНА ПРИКАЗОВ (владелец, пп.1–9):
//  1\ Мельничное дело: навык + работа у мельника ТОЛЬКО за деньги
//     (зерно из наград исключено приказом: millDaywork.grain === 0 всегда);
//  2\ Самострел: WEAPONS.crossbow + навык «Стрельба из самострела» +
//     MILITARY_GEAR_IDS + награда старосты 20% (hard) + перезарядка в бою
//     (source-проверки CombatScene: флаг в create(), crank-метод, Уклон скрыт);
//  3\ Ткачество: дом ткачихи, оплата полотном/сукном (weaveDaywork);
//  4\ Плотницкое дело: дом плотника, ставка успеха 3–6 д. (carpenterDaywork);
//  5\ Лавка Аверьяна: оберег УДАЛЁН (приказ 6); Тегиляй 10 д. и Кожаная
//     броня 25 д. ДОБАВЛЕНЫ (приказ 7);
//  6\ Кузнец: заказные САБЛЯ 100 д. и КОЛЬЧУГА 150 д. — shopRules.js
//     (порог личной славы +25 + рамки Судебника; цены без скидок славы);
//  7\ Прегены (8) и генерация: все 4 новых навыка, высокие по специализации
//     (воин — самострел 40);
//  8\ i18n: EN-ключи новых строк (Самострел → Crossbow и др.);
//  9\ UI-проводка сцен (source): кнопки мельницы/ткачихи/плотника, вкладка
//     «Доспехи» у кузнеца, заказные товары.
// Запуск из корня репозитория: node game/tools/test_round124.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const realRandom = Math.random;
function rollOnce(v) { Math.random = () => v; }
function rollSeq(list) { let i = 0; Math.random = () => list[Math.min(i++, list.length - 1)]; }
function restoreRandom() { Math.random = realRandom; }

// ---------- Импорты ----------
const {
    SKILLS, WEAPONS, ARMORS, PRESET_HEROES, GENERATION_PATTERNS,
    createPresetHero, createRandomHero,
} = await import(join(ROOT, 'game/src/systems/Character.js'));
const { carpenterDaywork, millDaywork, weaveDaywork } = await import(join(ROOT, 'game/src/systems/jobs.js'));
const { SABRE_SMITH_PRICE, CHAIN_SMITH_PRICE, SMITH_TRUST_REP, canBuySmithSpecial } = await import(join(ROOT, 'game/src/systems/shopRules.js'));
const interiors = await import(join(ROOT, 'game/src/data/interiors.js'));
const i18n = await import(join(ROOT, 'game/src/systems/i18n.js'));
const reputation = await import(join(ROOT, 'game/src/data/reputation.js'));

console.log('--- 1. SKILLS: 4 новых навыка (66.76) ---');
const byKey = Object.fromEntries(SKILLS.map(s => [s.key, s]));
ok(SKILLS.length === 28, `SKILLS: 28 навыков (было 24, +4; факт ${SKILLS.length})`);
ok(byKey.milling && byKey.milling.name === 'Мельничное дело' && byKey.milling.category === 'manipulation' && byKey.milling.attr === 'DEX' && byKey.milling.base === 10, 'Мельничное дело: manipulation/DEX/10');
ok(byKey.weaving && byKey.weaving.name === 'Ткачество' && byKey.weaving.category === 'manipulation' && byKey.weaving.base === 15, 'Ткачество: manipulation/DEX/15');
ok(byKey.carpentry && byKey.carpentry.name === 'Плотницкое дело' && byKey.carpentry.category === 'manipulation' && byKey.carpentry.base === 10, 'Плотницкое дело: manipulation/DEX/10');
ok(byKey.crossbow && byKey.crossbow.name === 'Стрельба из самострела' && byKey.crossbow.category === 'combat' && byKey.crossbow.attr === 'DEX' && byKey.crossbow.base === 10, 'Стрельба из самострела: combat/DEX/10');
ok(!byKey.swimming && !byKey.omens, 'Плавание/Приметы по-прежнему НЕ добавлены (приказ третьей волны)');

console.log('--- 2. САМОСТРЕЛ: оружие, воинские рамки, награда старосты ---');
ok(WEAPONS.crossbow && WEAPONS.crossbow.skill === 'crossbow' && WEAPONS.crossbow.dice.min === 1 && WEAPONS.crossbow.dice.max === 8 && WEAPONS.crossbow.bonus === 1 && WEAPONS.crossbow.price === 120, 'WEAPONS.crossbow: 1–8+1, навык crossbow, справочная цена 120 д.');
ok(reputation.MILITARY_GEAR_IDS.has('crossbow') && reputation.MILITARY_GEAR_IDS.has('sabre') && reputation.MILITY_GEAR === undefined, 'MILITARY_GEAR_IDS: crossbow добавлен (сабля/цеп на месте)');
const qgen = read('game/src/data/questGenerator.js');
ok(qgen.includes("npcId === 'elder' && difficulty === 'hard' && Math.random() < 0.2"), 'Награда: самострел — староста, hard, шанс 0.20 (реже меча)');
ok(qgen.includes("id: 'crossbow', name: cb.name") && qgen.includes('weapon: true'), 'Награда: самострел кладётся как weapon (без unique — повторный возможен)');

console.log('--- 3. ЛЕСТНИЦЫ ОПЛАТ (детерминированные броски) ---');
// millDaywork: навык 50 → провал 96+, крит 1–2 (50/20=2.5 → 1..2), успех 3..95
rollOnce(0.96); // бросок 97 → провал; die(2,3) тем же моком: 2+floor(0.96*2)=3
{
    const r = millDaywork(null, 50);
    ok(!r.ok && r.wage === 3 && r.grain === 0, `Мельница: провал = черновые 2–3 д., зерна НЕТ (факт ${r.wage}/${r.grain})`);
}
rollOnce(0.001); // бросок 1 — крит; die(8,12) тем же моком: 8+floor(0.001*5)=8
{
    const r = millDaywork(null, 50);
    ok(r.ok && r.crit && r.wage === 8 && r.grain === 0, `Мельница: крит = 8–12 д., зерна НЕТ (факт ${r.wage}/${r.grain})`);
}
rollOnce(0.40); // бросок 41 — успех; die(4,7): 4+floor(0.4*4)=5
{
    const r = millDaywork(null, 50);
    ok(r.ok && !r.crit && r.wage === 5 && r.grain === 0, `Мельница: успех = 5 д., зерна НЕТ (ПРИКАЗ 1) (факт ${r.wage}/${r.grain})`);
}
// carpenterDaywork: провал 2; успех die(3,6); крит die(7,10)
rollOnce(0.99);
{
    const r = carpenterDaywork(null, 50);
    ok(!r.ok && r.wage === 2, `Плотник: провал = 2 д. (факт ${r.wage})`);
}
rollOnce(0.40); // die(3,6): 3+floor(0.4*4)=4
{
    const r = carpenterDaywork(null, 50);
    ok(r.ok && !r.crit && r.wage === 4 && r.wage >= 3 && r.wage <= 6, `Плотник: успех в коридоре 3–6 (факт ${r.wage})`);
}
rollOnce(0.001); // крит; die(7,10): 7+floor(0.2*4)=7
{
    const r = carpenterDaywork(null, 50);
    ok(r.crit && r.wage === 7, `Плотник: крит = 7–10 д. (факт ${r.wage})`);
}
// weaveDaywork: оплата НАТУРОЙ
rollOnce(0.99);
{
    const r = weaveDaywork(null, 50);
    ok(!r.ok && r.wage === 2 && r.cloth === null, `Ткачество: провал = 2 д., без полотна (факт ${r.wage}/${r.cloth})`);
}
rollOnce(0.40);
{
    const r = weaveDaywork(null, 50);
    ok(r.ok && !r.crit && r.cloth === 'polotno' && r.wage === 2, `Ткачество: успех = полотно + 2 д. (факт ${r.cloth}/${r.wage})`);
}
rollOnce(0.001);
{
    const r = weaveDaywork(null, 50);
    ok(r.crit && r.cloth === 'sukon' && r.wage === 3, `Ткачество: крит = СУКНО + 3 д. (факт ${r.cloth}/${r.wage})`);
}
restoreRandom();

console.log('--- 4. ПРЕГЕНЫ И ГЕНЕРАЦИЯ: новые навыки у всех ---');
const needKeys = ['milling', 'weaving', 'carpentry', 'crossbow'];
PRESET_HEROES.forEach(p => {
    const missing = needKeys.filter(k => p.skillOverrides[k] == null);
    ok(missing.length === 0, `${p.id}: все 4 новых навыка заданы`);
});
const warrior = PRESET_HEROES.find(p => p.id === 'warrior_m');
ok(warrior.skillOverrides.crossbow === 40, 'Воин Добрыня: самострел 40 (ратная специализация)');
const ranger = PRESET_HEROES.find(p => p.id === 'ranger_m');
ok(ranger.skillOverrides.carpentry === 30, 'Следопыт Гаврила: плотницкое 30');
{
    const h = createRandomHero('warrior');
    ok(needKeys.every(k => typeof h.skills[k] === 'number' && h.skills[k] >= 1), 'Генерация (Воин): новые навыки дрейфуют от прегена');
    const h2 = createRandomHero('detective');
    ok(needKeys.every(k => typeof h2.skills[k] === 'number' && h2.skills[k] >= 1), 'Генерация (Сыщик): новые навыки дрейфуют от прегена');
}

console.log('--- 5. shopRules: заказные товары кузнеца (приказы 8–9) ---');
ok(SABRE_SMITH_PRICE === 100 && CHAIN_SMITH_PRICE === 150 && SMITH_TRUST_REP === 25, 'Цены/порог: сабля 100, кольчуга 150, слава +25 (задорого)');
ok(canBuySmithSpecial(10, { ok: true }).ok === false, 'Слава 10 < 25 — отказ');
ok(canBuySmithSpecial(25, { ok: true }).ok === true, 'Слава 25 + рамки ок — можно');
ok(canBuySmithSpecial(60, { ok: true }).ok === true, 'Слава 60 — можно');
const denied = canBuySmithSpecial(60, { ok: false, reason: 'рамки' });
ok(denied.ok === false && denied.reason === 'рамки', 'Рамки Судебника пробрасываются');
ok(WEAPONS.sabre.price === 60 && ARMORS.chain.price === 80, 'Справочные цены не тронуты (скупка полцены 30/40)');

console.log('--- 6. ЛАВКА АВЕРЬЯНА (приказы 6–7) ---');
const averyan = interiors.INTERIORS
    ? Object.values(interiors.INTERIORS).find(i => i.id === 'shop_tools')
    : null;
if (!averyan) {
    // interiors.js может экспортировать по-другому — ищем в любом экспорте
    const all = Object.values(interiors).flat().filter(Boolean);
    const shop = all.find(i => i && i.id === 'shop_tools');
    ok(!!shop, 'shop_tools найден в экспортах interiors.js');
    if (shop) checkAveryan(shop.market);
} else {
    checkAveryan(averyan.market);
}
function checkAveryan(market) {
    const ids = market.items.map(i => i.id);
    ok(!ids.includes('amulet'), 'ОБЕРЕГ ОТ СГЛАЗУ УДАЛЁН из лавки (приказ 6)');
    const padded = market.items.find(i => i.id === 'padded');
    const leather = market.items.find(i => i.id === 'leather');
    ok(padded && padded.kind === 'armor' && padded.armorId === 'padded' && padded.price === 10, 'Тегиляй у Аверьяна: 10 д., armor/padded');
    ok(leather && leather.kind === 'armor' && leather.armorId === 'leather' && leather.price === 25, 'Кожаная броня у Аверьяна: 25 д., armor/leather');
    ok(ids.includes('rod') && ids.includes('arrows_pack'), 'Удочка и стрелы на месте');
}

console.log('--- 7. КУЗНИЦА: UI-проводка заказных товаров (source) ---');
const interiorSrc = read('game/src/scenes/InteriorScene.js');
ok(interiorSrc.includes("mkTab(width / 2, 'Доспехи', 'armor')"), 'Вкладка «Доспехи» возвращена в кузницу');
ok(!/SMITH_SALE_WEAPONS = \[[^\]]*'sabre'/.test(interiorSrc), 'Сабля НЕ в общем списке оружия (только заказная)');
ok(interiorSrc.includes('SABRE_SMITH_PRICE') && interiorSrc.includes('CHAIN_SMITH_PRICE') && interiorSrc.includes('canBuySmithSpecial'), 'Кузница использует shopRules (цены + порог славы)');
ok(interiorSrc.includes("getNpcRep(this.registry, smithId)"), 'Порог читает ЛИЧНУЮ славу кузнеца');
const interiorsSrc = read('game/src/data/interiors.js');
ok(interiorsSrc.includes("id: 'padded', name: 'Тегиляй', price: 10") && interiorsSrc.includes("id: 'leather', name: 'Кожаная броня', price: 25"), 'interiors.js: Тегиляй 10 д. и Кожаная броня 25 д. (source)');
ok(!interiorsSrc.includes("id: 'amulet', name: 'Оберег от сглазу'"), 'interiors.js: оберег удалён (source)');
ok(interiorSrc.includes("workInWeaver") && interiorSrc.includes("workInCarpenter"), 'InteriorScene: методы ткачихи и плотника');
ok(interiorSrc.includes("weaveDaywork(this.registry") && interiorSrc.includes("carpenterDaywork(this.registry"), 'InteriorScene: лестницы подключены');
ok(interiorSrc.includes("interior.id === 'weaver_house'") && interiorSrc.includes("interior.id === 'carpenter_house'"), 'InteriorScene: кнопки в ветках интерьеров');
ok(interiorSrc.includes("hasChest(interior.id)) this.pushChestButton"), 'InteriorScene: сундук в домах мастеров не потерян');

console.log('--- 8. МЕЛЬНИЦА: UI-проводка (source) ---');
const locSrc = read('game/src/scenes/LocationScene.js');
ok(locSrc.includes("this.locationId === 'mill'") && locSrc.includes('Работать у мельника'), 'LocationScene: кнопка работы на мельнице');
ok(locSrc.includes('workAtMill') && locSrc.includes('millDaywork'), 'LocationScene: метод работы + лестница');
ok(locSrc.includes("qM.dayworkRepDay = todayM"), 'Мельница: слава подёнки — общий ключ раз/сутки');

console.log('--- 9. БОЙ: самострел и перезарядка (source) ---');
const combatSrc = read('game/src/scenes/CombatScene.js');
ok(combatSrc.includes("const isCrossbow = equippedKey === 'crossbow'"), 'CombatScene: самострел распознан в панели действий');
ok(combatSrc.includes("if (eqNow === 'crossbow' && this.__crossbowReload) this.crossbowCrank();"), 'CombatScene: главная кнопка решает по флагу в момент клика (панель строится один раз)');
ok(combatSrc.includes('refreshMainActionLabel()'), 'CombatScene: подпись главной кнопки живая (после выстрела и после завода)');
ok(combatSrc.includes("Руки заняты тетивой самострела — уклоняться некогда"), 'CombatScene: УКЛОНЕНИЕ недоступно в ход перезарядки (гейт в dodge(), ход не тратится)');
ok(combatSrc.includes("this.__crossbowReload = true;"), 'CombatScene: выстрел ставит флаг перезарядки');
ok(/create\(\)[\s\S]{0,600}__crossbowReload = false/.test(combatSrc), 'CombatScene: флаг сбрасывается в create() (сцена живёт всю игру)');
ok(combatSrc.includes("weaponKey === 'bow' || weaponKey === 'crossbow'"), 'CombatScene: стрела тратится и у самострела (общий колчан)');
ok(combatSrc.includes('crossbowCrank() {'), 'CombatScene: метод crossbowCrank');

console.log('--- 10. i18n: EN-ключи 66.76 ---');
i18n.setLang('en');
ok(i18n.t('Самострел') === 'Crossbow', `t(Самострел) EN = Crossbow (факт: ${i18n.t('Самострел')})`);
ok(i18n.t('Завести тетиву (ход)') === 'Crank the string (turn)', 't(Завести тетиву (ход)) EN');
ok(i18n.t('🧶 Помочь за станком (1 час)') === '🧶 Help at the loom (1 h)', 't(Помочь за станком) EN');
ok(i18n.t('⚙ Работать у мельника (1 час)') === '⚙ Work for the miller (1 h)', 't(Работать у мельника) EN');
ok(i18n.t('нить порвалась') === 'thread snapped', 't(нить порвалась) EN');
ok(i18n.t('защита 2') === 'def 2', 't(защита 2) EN');
i18n.setLang('ru');
ok(i18n.t('Самострел') === 'Самострел', 'RU-режим: без подмены');

console.log(`\n=== ИТОГ: ${pass} успешно, ${fail} провалено ===`);
process.exit(fail > 0 ? 1 : 0);

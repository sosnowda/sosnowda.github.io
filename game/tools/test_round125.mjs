// test_round125.mjs — 66.77: ПЯТЫЙ ЗАГОЛОВОК ПРИКАЗОВ (уточнения владельца):
//  1\ КРАДЕНЕЕ (приказ 2): лут из сундуков кладётся в узел ОТДЕЛЬНОЙ кучкой
//     (addStolenItem, флаг stolen:true); скупка платит за краденое на 80%
//     МЕНЬШЕ стандартной покупной — fencePriceOf = round(sell×0.2), мин. 1 д.;
//     строка краденого в скупке помечена «(краденое)» (source);
//  2\ Кучки не смешиваются: addItem кладёт честное рядом (не в краденую
//     кучку); removeItem расходует честное первым; countOf суммирует все
//     кучки; removeFromEntry удаляет из конкретной записи; награда за
//     задание не валится в краденую кучку (source questGenerator);
//  3\ ТКАЧЕСТВО — ТОЛЬКО ДЛЯ ЖЕНСКОГО ПЕРСОНАЖА (приказ 5): кнопка
//     «Помочь за станком» обёрнута проверкой player.gender === 'female';
//  4\ Еда постоялого двора (пункт 1 приказа — ДОКУМЕНТ): TRADE_TABLE §1.1
//     объясняет, что трактирная еда съедается сразу и в узел не попадает
//     (потому покупка и занимает 1 час) — source-проверка доки;
//  5\ Подёнки 66.76 в таблице торговли: §4а плотницкое 3–6 (крит 7–10,
//     провал 2), ткачество (полотно+2/сукно+3/провал 2), мельница ТОЛЬКО
//     деньги 2–3/4–7/8–12 — source-проверки доки + jobs.js;
//  6\ Самострел в §4 таблицы: урон 1–8+1, тетива/уклон/общий колчан;
//  7\ i18n: EN-ключи краденого; SW v118 (бамп по §4 — исходники src/**);
//  8\ Механика реэкспорта: attemptChestPick кладёт лут через addStolenItem
//     (source InteriorScene).
// Запуск из корня репозитория: node game/tools/test_round125.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const realRandom = Math.random;
function restoreRandom() { Math.random = realRandom; }

// ---------- Импорты ----------
const loot = await import(join(ROOT, 'game/src/systems/loot.js'));
const i18n = await import(join(ROOT, 'game/src/systems/i18n.js'));
const { addItem, addStolenItem, removeItem, removeFromEntry, countOf, sellableLoot, fencePriceOf, STOLEN_SELL_DISCOUNT, LOOT_DEFS } = loot;

const mkPlayer = () => ({ inventory: [], dengas: 0 });

console.log('--- 1. fencePriceOf: краденое = 20% скупки (−80%, приказ 2) ---');
ok(STOLEN_SELL_DISCOUNT === 0.2, 'STOLEN_SELL_DISCOUNT = 0.2 (платят 20% стандартной скупки)');
ok(fencePriceOf(12) === 2, 'сукно: 12 → 2 д. (−80%)');
ok(fencePriceOf(8) === 2, 'полотно: 8 → 2 д. (−80%)');
ok(fencePriceOf(15) === 3, 'оберег янтарный: 15 → 3 д. (−80%)');
ok(fencePriceOf(7) === 1, 'железо: 7 → 1 д. (округление 1.4 → 1)');
ok(fencePriceOf(3) === 1, 'горшок: 3 → 1 д. (0.6 → 1, минимум 1 д.)');
ok(fencePriceOf(0) === 1, 'нулевая база защищена: минимум 1 д.');

console.log('--- 2. addStolenItem: отдельная кучка узла ---');
const p1 = mkPlayer();
addStolenItem(p1, 'sukon', 2);
addStolenItem(p1, 'sukon', 1);
ok(p1.inventory.length === 1 && p1.inventory[0].stolen === true && p1.inventory[0].count === 3, 'краденое кучкуется в ОДНОЙ записи со флагом stolen:true (2+1=3)');
addItem(p1, 'sukon', 5);
ok(p1.inventory.length === 2, 'честное addItem НЕ подмешивается в краденую кучку (вторая запись)');
const honest = p1.inventory.find(i => !i.stolen);
const hot = p1.inventory.find(i => i.stolen);
ok(honest.count === 5 && hot.count === 3, 'честная кучка 5, краденая 3 — раздельный учёт');
ok(countOf(p1, 'sukon') === 8, 'countOf суммирует ОБЕ кучки (5+3=8)');

console.log('--- 3. sellableLoot: краденая строка по 20%, честная по полной ---');
const rows = sellableLoot(p1);
ok(rows.length === 2, 'две строки скупки (краденая и честная)');
const stRow = rows.find(r => r.stolen);
const hnRow = rows.find(r => !r.stolen);
ok(stRow && stRow.price === 2, `строка краденого: цена 2 д. (20% от 12; факт ${stRow && stRow.price})`);
ok(hnRow && hnRow.price === 12, `честная строка: полная цена 12 д. (факт ${hnRow && hnRow.price})`);
// смешанный сценарий: краденое мёда + честная рыба
const p2 = mkPlayer();
addStolenItem(p2, 'honey', 1);
addItem(p2, 'fish_raw', 2);
const rows2 = sellableLoot(p2);
ok(rows2.find(r => r.stolen).price === 1, 'краденый мёд: 6 → 1 д.');
ok(rows2.find(r => !r.stolen).price === 2, 'честная сырая рыба: полная цена 2 д.');

console.log('--- 4. removeItem/removeFromEntry: расход честного первым ---');
const p3 = mkPlayer();
addStolenItem(p3, 'polotno', 2);
addItem(p3, 'polotno', 4);
removeItem(p3, 'polotno', 4); // расход идёт из ЧЕСТНОЙ кучки
const left3 = sellableLoot(p3);
ok(left3.length === 1 && left3[0].stolen && left3[0].count === 2, 'removeItem списал 4 ЧЕСТНЫХ полотна; краденая кучка (2) цела');
const p4 = mkPlayer();
addStolenItem(p4, 'grain', 3);
removeFromEntry(p4, p4.inventory[0], 2);
ok(countOf(p4, 'grain') === 1 && p4.inventory.length === 1, 'removeFromEntry снял 2 из конкретной краденой кучки (3→1)');
removeFromEntry(p4, p4.inventory[0], 1);
ok(p4.inventory.length === 0, 'пустая кучка удаляется из узла');

console.log('--- 5. UI/source-проверки: краденое только Скупщику (66.78) и проводка взлома ---');
const isrc = read('game/src/scenes/InteriorScene.js');
ok(isrc.includes("res.items.forEach(it => addStolenItem(player, it.id, it.count, interior.id));"), 'Взлом сундука: лут кладётся через addStolenItem (краденое, 66.79 — с происхождением от дома)');
// ПАТЧ 66.78 (пп.4–5): краденое продать ТОЛЬКО Скупщику по ночам —
// честная скупка краденые строки больше НЕ показывает (66.77-канон отменён).
ok(isrc.includes("sellableLoot(player).filter(r => !r.stolen)"), 'Скупка (честная): краденые строки убраны (66.78 п.5)');
ok(isrc.includes("sellableLoot(player).filter(r => r.stolen)"), 'Меню Скупщика: ТОЛЬКО краденые строки (66.78 п.4)');
ok(isrc.includes("t('Краденое честным скупщикам не сбыть — только Скупщику по ночам')"), 'Скупка: подсказка «краденое — только Скупщику по ночам»');
ok(isrc.includes("noteFenceSale(this.registry, row.def.name, total)"), 'Журнал/репутация: продажа через noteFenceSale (−1 за каждую, 66.78 п.6)');
ok(isrc.includes("removeFromEntry(player, row.entry, 1)") && isrc.includes("removeFromEntry(player, row.entry, n)"), 'Продажа идёт из конкретной кучки (removeFromEntry, «1» и «всё»)');
ok(isrc.includes("(Краденое добро честным скупщикам не сбыть: только Скупщику по ночам на постоялом дворе.)"), 'Диалог сундука: подсказка «краденое — только Скупщику по ночам»');
ok(!/\bremoveItem\(player,\s*def\.id/.test(isrc), 'В скупке НЕТ слепого removeItem по id (только removeFromEntry по кучке)');

console.log('--- 6. ТКАЧЕСТВО — только для женского персонажа (приказ 5) ---');
ok(/weaver_house[\s\S]{0,600}?player\.gender === 'female'[\s\S]{0,300}?Помочь за станком/.test(isrc.replace(/\r/g, '')), "Кнопка «Помочь за станком» обёрнута проверкой player.gender === 'female'");
restoreRandom();

console.log('--- 7. Награда за задание — мимо краденой кучки ---');
const qsrc = read('game/src/data/questGenerator.js');
ok(qsrc.includes("player.inventory.find(i => i.id === reward.id && !i.stolen)"), 'questGenerator: награда ищет только честную кучку (!i.stolen)');

console.log('--- 8. Документ TRADE_TABLE_6676.md (пункты 1–6 приказа) ---');
const trade = read('docs/TRADE_TABLE_6676.md');
ok(trade.includes('СРАЗУ ЖЕ СЪЕДАЕТСЯ') && trade.includes('В ИНВЕНТАРЬ (узел) НЕ ПОПАДАЕТ'), '§1.1: еда двора съедается сразу, в узел НЕ попадает — потому покупка занимает час');
ok(trade.includes('на 80% МЕНЬШЕ стандартной покупной'), '§1.4: цена продажи ворованного — на 80% меньше стандартной покупной');
ok(trade.includes('fencePriceOf()'), '§1.4: лестница краденого в коде — fencePriceOf()');
ok(trade.includes('Плотницкое дело') && trade.includes('3–6 д.') && trade.includes('крит 7–10, провал 2'), '§4а: плотницкое — ставка 3–6 д. (крит 7–10, провал 2)');
ok(trade.includes('ТОЛЬКО для ЖЕНСКОГО персонажа') && trade.includes('полотно в узел +2 д.') && trade.includes('сукно +3 д.'), '§4а: ткачество — жен-только, полотно+2/сукно+3/провал 2');
ok(trade.includes('ТОЛЬКО деньги 2–3 (провал) / 4–7 (успех) / 8–12 (крит)') && trade.includes('grain === 0'), '§4а: мельничное — только деньги 2–3/4–7/8–12, зерно удалено');
ok(trade.includes('Самострел') && trade.includes('1–8 +1') && trade.includes('Завести тетиву') && trade.includes('УКЛОН НЕДОСТУПЕН') && trade.includes('ОБЩЕГО колчана'), '§4: самострел — урон 1–8+1, тетива через ход, уклон недоступен, общий колчан');
ok(trade.includes('шанс 20%'), '§4: самострел — шанс награды 20% (реже меча)');

console.log('--- 9. i18n: EN-ключи краденого ---');
i18n.setLang('en');
const enKeys = [
    'Краденое — на 80% дешевле скупки',
    'краденое',
    'Сбыл скупщику краденое «{0}» за {1} д. (за краденое платят на 80% меньше).',
    'Сбыл скупщику краденое «{0}» ×{1} за {2} д. (за краденое платят на 80% меньше).',
    '(Краденое добро: скупщики платят за него на 80% меньше стандартной цены.)',
];
for (const k of enKeys) ok(i18n.t(k) !== k, `EN: «${k.slice(0, 42)}…» переведён`);
i18n.setLang('ru');

console.log('--- 10. SW: бамп v117→v118 (§4 — менялись исходники src/**) ---');
const sw = read('sw.js');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v130';"), 'sw.js: CACHE_NAME v130 (66.95 актуализация)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 (66.86 актуализация)');
const swlog = read('docs/SW_CHANGELOG.md');
ok(swlog.includes('- v118 — итерация 66.77'), 'SW_CHANGELOG: запись v118 добавлена');
ok(swlog.includes('КРАДЕНЕЕ — СКУПКА −80%') && swlog.includes('ТОЛЬКО ДЛЯ ЖЕНСКОГО ПЕРСОНАЖА'), 'SW_CHANGELOG v118: краденое и жен-только упомянуты');

restoreRandom();
console.log(`\n=== ИТОГ: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail > 0 ? 1 : 0);

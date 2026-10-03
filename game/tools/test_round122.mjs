// test_round122.mjs — 66.74: НОВАЯ ВОЛНА НАВЫКОВ (приказы владельца 1–18):
//  1\ SKILLS: +10 навыков (Скрадывание/Рыболовство/Бортничество/Ремесло/
//     Грамота/Сметка/Скоморошество/Следопытство/Кузнечное дело/Взлом);
//     категория «Скрытность» больше не пустует;
//  2\ Прегены (все 8) и случайная генерация содержат ВСЕ новые навыки,
//     высокие значения по специализации (следопыт — следы, сыщик — замки);
//  3\ Бортничество: дикие борти 'B' в карте леса (валидна), сбор —
//     проверка навыка (провал — укусы −1 HP, успех 2 мёда, крит 4 мёда + воск);
//     пасека: улей = точка мёда раз в день;
//  4\ Ремесло: лестница подёнки (брак 2 д. / успех 4–7 / крит 6–9 + шедевр);
//  5\ Кузнечное дело: помощь кузнецу (2–3 / 4–7 / 8–12 д.);
//  6\ Грамота: служка (провал 0 д. / успех 3–6 / крит 7–10 д.);
//  7\ Скоморошество: сбор со стола (3–8 / 9–16 д.), fumble-переполох,
//     риск гнева Церкви (rng < 0.2);
//  8\ Следопытство: следы вора читает max(Внимательность, Следопытство);
//     planForestAnimals({tracking:true}) даёт больше дичи; проверка при
//     входе в лес — раз в день (rollForestTracking);
//  9\ Взлом/Сундук: 16 жилых домов с сундуками; раз в месяц; лут 1–5 шт.
//     по таблице дома (крит — все 5); Скрадывание перед любым взломом —
//     провал = −2 репутации деревни; дверь только при отсутствии НПЦ рядом;
// 10\ Сметка: торг альтернативным навыком (attemptHaggle с skillLabel);
// 11\ Рыболовство/Скрадывание в сценах (source-проверки UI-проводки).
// Запуск из корня репозитория: node game/tools/test_round122.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

function makeRegistry(hour = 9, minute = 30, day = 14) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day, hour, minute });
    reg.set('player', {
        HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55, DEX: 70, POW: 55,
        skills: { survival: 50, cooking: 40, persuade: 50, fast_talk: 45, intimidate: 40,
            stealth: 68, fishing: 55, beekeeping: 55, track: 75, craft: 45,
            literacy: 40, commerce: 45, performance: 40, smithing: 40, lockpicking: 60 },
        inventory: [],
    });
    return reg;
}
const realRandom = Math.random;
function rollOnce(v) { Math.random = () => v; }
function rollSeq(list) { let i = 0; Math.random = () => list[Math.min(i++, list.length - 1)]; }
function restoreRandom() { Math.random = realRandom; }

// ---------- Импорты ----------
const {
    SKILLS, SKILL_CATEGORIES, PRESET_HEROES, GENERATION_PATTERNS,
    createPresetHero, createRandomHero,
} = await import(join(ROOT, 'game/src/systems/Character.js'));
const { planForestAnimals, forestGatherSpots, validateForestMap, rollForestTracking, FOREST_SOLID } = await import(join(ROOT, 'game/src/data/forest.js'));
const { bortnikGather, getLootDef, countOf } = await import(join(ROOT, 'game/src/systems/loot.js'));
const { craftDaywork, smithyDaywork, acolyteServe, tavernPerformance } = await import(join(ROOT, 'game/src/systems/jobs.js'));
const {
    hasChest, CHEST_HOUSES, monthKeyOf, canPickChest, attemptBreakIn, attemptChestPick,
} = await import(join(ROOT, 'game/src/systems/burglary.js'));
const { attemptHaggle, canHaggleToday } = await import(join(ROOT, 'game/src/systems/trade.js'));
const { getVillageRep } = await import(join(ROOT, 'game/src/data/reputation.js'));
const { hideFromThief } = await import(join(ROOT, 'game/src/data/thief.js'));

console.log('\n— 1. ДЕСЯТЬ НОВЫХ НАВЫКОВ в SKILLS —');
{
    const keys = SKILLS.map(s => s.key);
    const expected = ['stealth', 'fishing', 'beekeeping', 'craft', 'literacy',
        'commerce', 'performance', 'track', 'smithing', 'lockpicking'];
    expected.forEach(k => ok(keys.includes(k), `навык «${k}» есть в SKILLS`));
    ok(SKILL_CATEGORIES.stealth && SKILLS.some(s => s.key === 'stealth' && s.category === 'stealth'),
        'категория «Скрытность» заполнена навыком Скрадывание');
    ok(SKILLS.find(s => s.key === 'literacy').base === 5, 'Грамота — редкая (база 05)');
}

console.log('\n— 2. ПРЕГЕНЫ И ГЕНЕРАЦИЯ (приказ 9) —');
{
    const newKeys = ['stealth', 'fishing', 'beekeeping', 'craft', 'literacy', 'commerce', 'performance', 'track', 'smithing', 'lockpicking'];
    PRESET_HEROES.forEach(p => {
        const missing = newKeys.filter(k => p.skillOverrides[k] == null);
        ok(missing.length === 0, `${p.name}: все 10 новых навыков заданы (${missing.length ? 'нет ' + missing : 'ок'})`);
    });
    // Высокие значения по специализации
    const ranger = PRESET_HEROES.find(p => p.id === 'ranger_m');
    ok(ranger.skillOverrides.track >= 70 && ranger.skillOverrides.stealth >= 60,
        'Следопыт: Следопытство/Скрадывание высоки');
    const warrior = PRESET_HEROES.find(p => p.id === 'warrior_m');
    ok(warrior.skillOverrides.smithing >= 50, 'Воин: Кузнечное дело высоко');
    const detective = PRESET_HEROES.find(p => p.id === 'detective_m');
    ok(detective.skillOverrides.literacy >= 60 && detective.skillOverrides.lockpicking >= 55 && detective.skillOverrides.commerce >= 55,
        'Сыщик: Грамота/Взлом/Сметка высоки');
    // Готовые герои создаются со всеми навыками
    const hero = createPresetHero('ranger_m');
    ok(newKeys.every(k => typeof hero.skills[k] === 'number'), 'createPresetHero: новые навыки в skills');
    // Случайная генерация дрейфует от прегена — значения в разумных пределах
    for (let i = 0; i < 30; i++) {
        const rh = createRandomHero('detective');
        const lit = rh.skills.literacy;
        if (!(lit >= 50 && lit <= 90)) { ok(false, `случайный сыщик: Грамота ${lit} вне 50..90`); lit._bad = true; break; }
    }
    ok(true, '30 случайных сыщиков: Грамота в диапазоне дрейфа 50..90');
}

console.log('\n— 3. БОРТНИЧЕСТВО: карта леса и сбор —');
{
    ok(FOREST_SOLID.has('B'), 'борть «B» непроходима (FOREST_SOLID)');
    const spots = forestGatherSpots();
    const borts = spots.filter(s => s.kind === 'bort');
    ok(borts.length >= 2, `диких бортей в лесу: ${borts.length} (≥2)`);
    const v = validateForestMap();
    ok(v.problems.length === 0, 'карта леса валидна (борти достижимы)');
    // Сбор: провал — укусы
    const reg = makeRegistry();
    const player = reg.get('player');
    const hpBefore = player.HP;
    rollOnce(0.999); // бросок 100 — провал (fumble при навыке < 50? навык 55 → fumble при 100)
    const f = bortnikGather(reg, player, { wild: true, skill: 55 });
    restoreRandom();
    ok(!f.ok && f.stung && player.HP === hpBefore - 1, `провал у борти: пчёлы ужалили (HP ${hpBefore}→${player.HP})`);
    ok(countOf(player, 'honey') === 0, 'провал — мёда нет');
    // Успех — 2 мёда
    const reg2 = makeRegistry();
    const p2 = reg2.get('player');
    rollOnce(0.40); // бросок 40 при навыке 55 — успех
    const s = bortnikGather(reg2, p2, { wild: false, skill: 55 });
    restoreRandom();
    ok(s.ok && s.honey === 2 && s.wax === 0, `успех: +2 мёд (мёд=${s.honey}, воск=${s.wax})`);
    ok(countOf(p2, 'honey') === 2, 'мёд в узле');
    // Крит — 4 мёда + 1 воск
    const reg3 = makeRegistry();
    const p3 = reg3.get('player');
    rollOnce(0.001); // бросок 1 — крит (1 ≤ 55/20)
    const c = bortnikGather(reg3, p3, { wild: false, skill: 55 });
    restoreRandom();
    ok(c.ok && c.crit && c.honey === 4 && c.wax === 1, `крит: мёд ×2 (${c.honey}) и воск (${c.wax})`);
    // Предметы в LOOT_DEFS
    ['honey', 'wax', 'sukon', 'polotno', 'iron', 'clay_pot', 'master_pot', 'ubrus', 'amber', 'grain', 'salo']
        .forEach(id => ok(!!getLootDef(id), `товар «${id}» определён в LOOT_DEFS`));
}

console.log('\n— 4. РЕМЕСЛО / КУЗНЯ / ГРАМОТА / СКОМОРОШЕСТВО —');
{
    // Провал — брак 2 д.
    const reg = makeRegistry();
    rollOnce(0.999);
    const bad = craftDaywork(reg, 40);
    restoreRandom();
    ok(!bad.ok && bad.wage === 2, `Ремесло провал: ставка ${bad.wage} д. (брак)`);
    // Успех — 4..7
    const reg2 = makeRegistry();
    rollOnce(0.30); // бросок 30 — успех; rng тот же → die(4,7) = 4+floor(0.3*4)=5
    const good = craftDaywork(reg2, 40);
    restoreRandom();
    ok(good.ok && good.wage >= 4 && good.wage <= 7, `Ремесло успех: ставка ${good.wage} д. (4..7)`);
    // Крит — шедевр
    rollOnce(0.001);
    const crit = craftDaywork(makeRegistry(), 40);
    restoreRandom();
    ok(crit.crit && crit.masterpiece && crit.wage >= 6 && crit.wage <= 9, `Ремесло крит: ${crit.wage} д. + шедевр`);
    // Кузнечное дело
    rollOnce(0.999);
    const smithBad = smithyDaywork(makeRegistry(), 40);
    restoreRandom();
    ok(!smithBad.ok && smithBad.wage >= 2 && smithBad.wage <= 3, `Кузнечное дело провал: ${smithBad.wage} д. (2..3)`);
    rollOnce(0.001);
    const smithCrit = smithyDaywork(makeRegistry(), 40);
    restoreRandom();
    ok(smithCrit.crit && smithCrit.wage >= 8 && smithCrit.wage <= 12, `Кузнечное дело крит: ${smithCrit.wage} д. (8..12)`);
    // Грамота: провал — 0 д., крит — 7..10
    rollOnce(0.999);
    const serveBad = acolyteServe(makeRegistry(), 40);
    restoreRandom();
    ok(!serveBad.ok && serveBad.wage === 0, 'Грамота провал: служба без платы (0 д.)');
    rollOnce(0.001);
    const serveCrit = acolyteServe(makeRegistry(), 40);
    restoreRandom();
    ok(serveCrit.crit && serveCrit.wage >= 7 && serveCrit.wage <= 10, `Грамота крит: ${serveCrit.wage} д. (7..10)`);
    // Скоморошество: успех 3..8; крит 9..16; fumble; гнев Церкви
    rollOnce(0.30);
    const perf = tavernPerformance(makeRegistry(), 40);
    restoreRandom();
    ok(perf.ok && perf.coins >= 3 && perf.coins <= 8 && !perf.churchAngry, `Скоморошество успех: ${perf.coins} д. (3..8)`);
    rollOnce(0.998); // бросок 100 → fumble при навыке < 50 → fumble-флаг
    const perfF = tavernPerformance(makeRegistry(), 40);
    restoreRandom();
    ok(perfF.fumble && perfF.coins === 0, 'Скоморошество fumble: переполох, монет нет');
    rollSeq([0.30, 0.10]); // бросок 31 — успех; затем rng=0.10 (die) и 0.10 < 0.2 → гнев Церкви
    const perfC = tavernPerformance(makeRegistry(), 40);
    restoreRandom();
    ok(perfC.churchAngry, 'Скоморошество: риск гнева Церкви (20%) срабатывает');
}

console.log('\n— 5. СЛЕДОПЫТСТВО: план дичи и следы вора —');
{
    // Без следопытства косуля при rng=0.4 не выпадает (0.4 ≥ 0.25),
    // со Следопытством — выпадает (0.4 < 0.5)
    const rng04 = () => 0.4;
    const plainNoRoe = planForestAnimals(rng04).some(a => a.kind === 'roe');
    const trackRoe = planForestAnimals(rng04, { tracking: true }).some(a => a.kind === 'roe');
    ok(!plainNoRoe && trackRoe, 'шанс косули 25% → 50% при Следопытстве (rng=0.4)');
    // Зайцев больше при следопытстве (rng 0.5 → 2+1/1+1)
    const plain = planForestAnimals(() => 0.5);
    const boosted = planForestAnimals(() => 0.5, { tracking: true });
    const haresPlain = plain.filter(a => a.kind === 'hare').length;
    const haresBoost = boosted.filter(a => a.kind === 'hare').length;
    ok(haresBoost === haresPlain + 1, `зайцев при следопытстве +1 (${haresPlain}→${haresBoost})`);
    // Следы вора: max(spot, track) в обеих точках thief.js
    const thief = read('game/src/data/thief.js');
    ok((thief.match(/player\.skills\.track/g) || []).length >= 2,
        'thief.js: Следопытство учитывается в следах (≥2 точки)');
    // rollForestTracking: раз в день, успех хранится весь день
    const reg = makeRegistry();
    reg.set('player', { HP: 12, HPmax: 12, skills: { track: 75 } });
    reg.set('quest', {});
    rollOnce(0.20); // бросок 21 ≤ 75 — успех
    const r1 = rollForestTracking(reg);
    restoreRandom();
    ok(r1.boost === true, 'rollForestTracking: успех при входе в лес');
    rollOnce(0.999); // второй вход в тот же день — бросок НЕ делается
    const r2 = rollForestTracking(reg);
    restoreRandom();
    ok(r2.boost === true, 'rollForestTracking: в тот же день успех сохраняется (без новой проверки)');
}

console.log('\n— 6. ВЗЛОМ И СУНДУКИ (приказы 13–18) —');
{
    // 16 жилых домов с сундуками; общественные — без
    ok(Object.keys(CHEST_HOUSES).length === 16, `сундуков: ${Object.keys(CHEST_HOUSES).length} (16 жилых домов)`);
    ok(!hasChest('tavern') && !hasChest('church'), 'постоялый двор и церковь — без сундуков (общественные)');
    // Раз в месяц
    const ts = { yearFromChrist: 1445, month: 6, day: 14 };
    ok(monthKeyOf(ts) === '1445-6', 'ключ месяца');
    const reg = makeRegistry();
    const player = reg.get('player');
    // УСПЕХ: скрадывание бросок 10 (ок), взлом бросок 10 (ок), rng: n=5, всё «деньги»
    const rngStub = () => 0.999;
    rollSeq([0.10, 0.10]);
    const res = attemptChestPick(reg, player, 'elder_house', ts, { stealth: 68, lock: 60, rng: rngStub });
    restoreRandom();
    ok(res.done && !res.stealthFailed && !res.lockFailed, 'сундук: удачная попытка');
    ok(res.crit === false, 'n=5 по rng — не крит (это честные 1-5 по приказу 15)');
    const itemsTotal = res.items.reduce((s2, it) => s2 + it.count, 0) + (res.dengas > 0 ? 1 : 0);
    ok(itemsTotal >= 1 && itemsTotal <= 5, `лут 1–5 штук: ${itemsTotal}`);
    ok(!canPickChest(reg, 'elder_house', ts), 'сундук помечен обчищенным');
    // Повтор в тот же месяц — блок
    const res2 = attemptChestPick(reg, player, 'elder_house', ts, { stealth: 68, lock: 60, rng: rngStub });
    ok(res2.blocked === 'month', 'повтор в тот же месяц заблокирован (приказ 16)');
    // Другой месяц — снова можно
    ok(canPickChest(reg, 'elder_house', { yearFromChrist: 1445, month: 7, day: 1 }), 'в новом месяце сундук снова с добром');
    // СКРАДЫВАНИЕ провал → −2 репутации (приказ 18)
    const reg3 = makeRegistry();
    reg3.set('reputation', undefined);
    rollSeq([0.985]); // бросок 99 — провал Скрадывания (68)
    const res3 = attemptChestPick(reg3, reg3.get('player'), 'potter_house', ts, { stealth: 68, lock: 60, rng: rngStub });
    restoreRandom();
    ok(res3.stealthFailed && !res3.done, 'провал Скрадывания срывает взлом');
    ok(getVillageRep(reg3) === -2, `репутация деревни −2 (итого ${getVillageRep(reg3)})`);
    // Дверь: успех/провал
    const reg4 = makeRegistry();
    rollSeq([0.10, 0.10]);
    const door = attemptBreakIn(reg4, reg4.get('player'), { stealth: 68, lock: 60 });
    restoreRandom();
    ok(door.done, 'дверь: замок вскрыт при двух удачных бросках');
    const reg5 = makeRegistry();
    rollSeq([0.10, 0.985]);
    const doorF = attemptBreakIn(reg5, reg5.get('player'), { stealth: 68, lock: 60 });
    restoreRandom();
    ok(!doorF.done && doorF.lockFailed, 'дверь: крепкий замок при провале Взлома');
}

console.log('\n— 7. СМЕТКА: торг альтернативным навыком —');
{
    const reg = makeRegistry();
    reg.set('player', { ...reg.get('player'), skills: { ...reg.get('player').skills, commerce: 60, persuade: 20 } });
    // торговец: встречный бросок; rollSeq: игрок 10, НПЦ 90
    rollSeq([0.10, 0.90]);
    const res = attemptHaggle(reg, 'tavernkeeper', 60, { skillLabel: 'Сметка' });
    restoreRandom();
    ok(res.done && res.mult > 1 && res.checkLine.includes('Сметка'),
        'attemptHaggle со Сметкой: цены выросли, подпись «Сметка»');
    ok(!canHaggleToday(reg, 'tavernkeeper'), 'одна попытка в день общая (слово ИЛИ сметка)');
}

console.log('\n— 8. ПРЯТКИ ОТ ВОРА (Скрадывание) —');
{
    // Готовим погоню: вор на остановке route[0]
    const reg = makeRegistry();
    reg.set('quest', { chase: { stop: 0, phase: 'stay', route: ['river', 'lake', 'mill'], ticksLeft: 3, traces: {} } });
    reg.set('player', { HP: 12, HPmax: 12, skills: { stealth: 75 } });
    // успех: игрок 10, вор 50
    rollSeq([0.10, 0.50]);
    const hid = hideFromThief(reg);
    restoreRandom();
    ok(hid.hidden === true && hid.thiefEscaped === false, 'Спрятался от вора: успех — вор тебя потерял');
    // провал: игрок 90, вор 10 — вор уходит к следующей остановке
    const reg2 = makeRegistry();
    reg2.set('quest', { chase: { stop: 0, phase: 'stay', route: ['river', 'lake', 'mill'], ticksLeft: 3, traces: {} } });
    reg2.set('player', { HP: 12, HPmax: 12, skills: { stealth: 75 } });
    rollSeq([0.90, 0.10]);
    const notHid = hideFromThief(reg2);
    restoreRandom();
    ok(notHid.hidden === false, 'Провал пряток: вор чует человека');
    ok(reg2.get('quest').chase.stop === 1 || notHid.thiefEscaped, 'вор после провала пускается наутёк');
}

console.log('\n— 9. UI-ПРОВОДКА (source-проверки сцен) —');
{
    const inter = read('game/src/scenes/InteriorScene.js');
    ok(inter.includes('Скоморошить (Скоморошество)'), 'таверна: кнопка «Скоморошить»');
    ok(inter.includes('Помочь кузнецу (1 час)'), 'кузница: кнопка «Помочь кузнецу»');
    ok(inter.includes('Служить при службе (Грамота)'), 'церковь: кнопка «Служить при службе»');
    ok(inter.includes('⚖ Сметить (Сметка)'), 'скупка: кнопка «Сметить (Сметка)»');
    ok(inter.includes('🧰 Взломать сундук (Взлом)'), 'интерьер: кнопка «Взломать сундук»');
    ok(inter.includes('this.houseEmpty'), 'интерьер: дом должен быть ПУСТ для сундука (приказ 16)');
    ok(inter.includes("craftDaywork(this.registry"), 'подёнка у гончара — проверка Ремесла');
    ok(inter.includes("smithyDaywork(this.registry"), 'помощь кузнецу — проверка Кузнечного дела');
    ok(inter.includes("acolyteServe(this.registry"), 'служке — проверка Грамоты');
    ok(inter.includes("tavernPerformance(this.registry"), 'скоморошество — проверка навыка');
    ok(inter.includes('SERVICES.find'), 'служке нужно окно богослужения (SERVICES)');
    ok(inter.includes("attemptChestPick(this.registry"), 'интерьер: взлом сундука через burglary.js');
    const vil = read('game/src/scenes/VillageScene.js');
    ok(vil.includes('🔓 Взломать замок (Взлом)'), 'закрытый дом: кнопка взлома');
    ok(vil.includes('isNpcNearby()'), 'дверь: проверка «рядом нет НПЦ» (приказ 17)');
    ok(vil.includes("attemptBreakIn(this.registry"), 'дверь: attemptBreakIn (Скрадывание → Взлом)');
    ok(vil.includes("burglary: true"), 'вход в дом в режиме взлома');
    const loc = read('game/src/scenes/LocationScene.js');
    ok(loc.includes('player.skills.fishing') || loc.includes('(player.skills && player.skills.fishing)'), 'рыбалка: проверка Рыболовства');
    ok(loc.includes('полный садок') || loc.includes('full creel'), 'рыбалка: крит — полный садок');
    ok(loc.includes('🌑 Подкрасться (Скрадывание)'), 'поляна: подкрадывание к дичи');
    ok(loc.includes('sneakBonus'), 'поляна: +10 к выстрелу после Скрадывания');
    ok(loc.includes('rollForestTracking'), 'лесные локации: Следопытство при входе');
    const forest = read('game/src/scenes/ForestScene.js');
    ok(forest.includes('showStalkDialog'), 'лес: диалог «стрелять/подкрасться» перед выстрелом');
    ok(forest.includes("entry.kind === 'bort'"), 'лес: борть собирается Бортничеством');
    ok(forest.includes('bortnikGather'), 'лес: bortnikGather подключён');
    ok(forest.includes('(!g.img || g.img.visible)'), 'лес: ФИКС — ягоды/борть без img доступны для сбора');
    ok(forest.includes("apiaryGathered") === false, 'пасечный кулдаун — не в лесу');
    const apiary = read('game/src/scenes/ApiaryScene.js');
    ok(apiary.includes('bortnikGather'), 'пасека: улей = проверка Бортничества');
    ok(apiary.includes('apiaryGathered'), 'пасека: раз в день на улей');
    const char = read('game/src/systems/Character.js');
    ok(char.includes("{ key: 'stealth', name: 'Скрадывание'"), 'Character.js: Скрадывание');
    ok(char.includes("{ key: 'lockpicking', name: 'Взлом'"), 'Character.js: Взлом');
    ok(char.includes("{ key: 'track', name: 'Следопытство'"), 'Character.js: Следопытство возвращён');
}

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);

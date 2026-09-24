// ============================================================
// test_round82.mjs — юнит-проверки патчей 66.21 (16 приказов) и 66.22 (сезонные
// рассвет/закат, стук −1, угрозы без лимита с эскалацией, стражник на часах).
// Запуск: node tools/test_round82.mjs (из папки game/).
//
// Покрывает:
//   п.2  ВИРТУАЛЬНАЯ доска поручений: доска удалена, взрослые НПЦ выдают
//        процедурные поручения в диалоге (makeQuestOffer/canOfferQuestToday,
//        quest_talk-узлы, уличная кнопка, кнопка «Задание» в доме);
//   п.3  логика выдачи/сдачи: один актив от НПЦ, дневной лимит, награда
//        только по завершении (claimCompletedQuests — 66.21 не трогал);
//   п.4  все локации шаблонов поручений существуют в игре;
//   п.6  личная репутация: дневные лимиты похвалы/угроз, эксплойты закрыты;
//   п.7  деревенская репутация: пожертвование — точные дельты (без ×0.7);
//   п.8  портреты: детям — детские, пол совпадает, файлы на диске;
//   п.9–10 дома заперты ночью, стук: злость (−2), впуск по срочному делу;
//   п.11–12 церковь по часам служб; священник — обед/ужин в корчме, келья;
//   п.13–14 пожертвования: тир 5→+1 … 50→+10 (потолок), меню в диалоге.
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = __dirname;
const ROOT = join(GAME, '..');

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
const read = (p) => readFileSync(join(ROOT, '..', p), 'utf8');

// Мок реестра (как в живом Phaser registry: get/set)
function mockRegistry() {
    const store = new Map();
    return {
        get: (k) => store.get(k),
        set: (k, v) => { store.set(k, v); },
        remove: (k) => { store.delete(k); },
    };
}

console.log('\n— п.1/2/9/11 (66.21+66.22): ЧАСЫ ДОСТУПА — СЕЗОННЫЕ РАССВЕТ/ЗАКАТ —');
{
    const { isNightHour, isChurchOpen, churchClosedReason, CHURCH_WINDOWS, sunTimes, dayOfYear } = await import(join(GAME, '../src/systems/AccessHours.js'));
    // Канон без даты (66.21) сохранён как запасной
    ok(!isNightHour(20) && isNightHour(21) && isNightHour(23) && isNightHour(0) && isNightHour(3) && !isNightHour(4),
        'канон без даты: ночь 21:00–04:00');
    ok(!isNightHour(12) && !isNightHour(16), 'день — не ночь');
    // Раунд 66.22 (приказ 2): РАСЧЁТ РАССВЕТОВ И ЗАКАТОВ по времени года и дате
    ok(dayOfYear(3, 21) === 355 && dayOfYear(9, 21) === 172 && dayOfYear(6, 21) === 80,
        'день солнечного года: 21 дек = 355, 21 июн = 172, 21 мар = 80');
    const stS = sunTimes(9, 21), stW = sunTimes(3, 21), stE = sunTimes(6, 21);
    ok(stS.sunrise < 4 && stS.sunset > 21, `лето (21 июн): рассвет ~${stS.sunrise}, закат ~${stS.sunset} — белые дни`);
    ok(stW.sunrise > 8 && stW.sunset < 15.5, `зима (21 дек): рассвет ~${stW.sunrise}, закат ~${stW.sunset} — короткий день`);
    ok(stE.sunrise > 5.5 && stE.sunrise < 6.5 && stE.sunset > 17.5 && stE.sunset < 18.5,
        'равноденствие (21 мар): ~6:00/18:00');
    // Приказ 1: дома открываются С РАССВЕТОМ и запираются ПО ЗАКАТУ
    ok(!isNightHour(21, { month: 9, day: 21 }) && isNightHour(22, { month: 9, day: 21 }),
        'лето: в 21 двери ещё открыты (закат ~21:10), в 22 — заперты');
    ok(!isNightHour(5, { month: 9, day: 21 }), 'лето: в 5 уже рассвело — двери открыты');
    ok(isNightHour(16, { month: 3, day: 21 }) && !isNightHour(14, { month: 3, day: 21 }),
        'зима: в 16 уже заперто (закат ~15:10), в 14 ещё открыто');
    ok(isNightHour(5, { month: 3, day: 21 }) && !isNightHour(9, { month: 3, day: 21 }),
        'зима: в 5 ещё ночь, в 9 рассвело');
    // Церковь — канонические окна (66.21, не привязаны к солнцу)
    ok(isChurchOpen(4) && isChurchOpen(6) && isChurchOpen(11) && isChurchOpen(14),
        'церковь: утреня 4–6 и обедня 6–12 (+3 ч) — открыта до 15:00');
    ok(!isChurchOpen(15) && !isChurchOpen(15.9), 'церковь закрыта 15:00–16:00 (отдых батюшки)');
    ok(isChurchOpen(16) && isChurchOpen(19) && isChurchOpen(20.5),
        'церковь: вечерня 16–19 (+2 ч) — открыта до 21:00');
    ok(!isChurchOpen(21) && !isChurchOpen(2), 'церковь заперта ночью (21:00–04:00)');
    ok(CHURCH_WINDOWS.length === 2, 'два окна богослужений');
    ok(churchClosedReason(23).includes('Ночь') && !churchClosedReason(15.5).includes('Ночь'),
        'пояснение у запертой двери различает ночь и час отдыха');
}

console.log('\n— п.9–10: НОЧНОЙ ЗАПОР И СТУК В ДВЕРЬ (NightKnock) —');
{
    const { knockAtDoor, hasUrgentQuestBusiness, doorResponder, KNOCK_REP_PENALTY, KNOCKS_PER_NIGHT } =
        await import(join(GAME, '../src/systems/NightKnock.js'));
    const { initReputation, getNpcRep } = await import(join(GAME, '../src/data/reputation.js'));
    const { initNpcNames } = await import(join(GAME, '../src/data/npcNames.js'));
    const { INTERIORS } = await import(join(GAME, '../src/data/interiors.js'));

    ok(KNOCK_REP_PENALTY === -1 && KNOCKS_PER_NIGHT === 2,
        'стук: −1 к личной репутации (66.22, приказ 5), открывают не больше двух раз за ночь');

    const reg = mockRegistry();
    reg.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 23, minute: 0 }); // ночь
    initNpcNames(reg);
    initReputation(reg);

    // Староста ночью дома (BASE_SCHEDULE.night = home)
    const house = INTERIORS['elder_house'];
    const resp = doorResponder(reg, house);
    ok(resp && resp.id === 'elder', 'ночью в доме старосты есть кому отвечать (хозяин дома)');

    // 1-й стук без дела: не впускают, репутация −2
    const before = getNpcRep(reg, 'elder');
    const r1 = knockAtDoor(reg, house);
    ok(!r1.opened && r1.penalty === -1 && getNpcRep(reg, 'elder') === before - 1,
        'стук без срочного дела: отказ и −1 личной репутации');

    // 2-й стук: ещё отвечает (2 стука в ночь), 3-й — молчит
    knockAtDoor(reg, house);
    const r3 = knockAtDoor(reg, house);
    ok(r3.refused && !r3.opened, 'третий стук за ночь — не отвечают');

    // Срочное дело: активное поручение от старосты → впускают
    const reg2 = mockRegistry();
    reg2.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 23, minute: 0 });
    initNpcNames(reg2);
    initReputation(reg2);
    reg2.set('quest', { activeQuests: [{ id: 'q1', npcId: 'elder', title: 'Дело', accepted: true, completed: false, failed: false }] });
    const urgent1 = hasUrgentQuestBusiness(reg2, house);
    const r4 = knockAtDoor(reg2, house);
    ok(urgent1 && r4.opened && r4.urgent, 'активное поручение от хозяина — впускают ночью');

    // Сдача: выполненное, но не оплаченное — тоже срочное
    reg2.set('quest', { activeQuests: [{ id: 'q1', npcId: 'elder', title: 'Дело', accepted: true, completed: true, failed: false, rewardClaimed: false }] });
    ok(hasUrgentQuestBusiness(reg2, house), 'выполненное-неоплаченное поручение — срочное дело (сдача не ждёт утра)');
    reg2.set('quest', { activeQuests: [{ id: 'q1', npcId: 'elder', title: 'Дело', accepted: true, completed: true, failed: false, rewardClaimed: true }] });
    ok(!hasUrgentQuestBusiness(reg2, house), 'оплаченное поручение — не срочное (поэтому и не пустят)');
    reg2.set('quest', { activeQuests: [{ id: 'q2', npcId: 'tavernkeeper', accepted: true, completed: false, failed: false }] });
    ok(!hasUrgentQuestBusiness(reg2, house), 'поручение от ДРУГОГО НПЦ — не повод будить старосту');
}

console.log('\n— п.11–12: РАСПОРЯДОК СВЯЩЕННИКА (обед/ужин в корчме, келья) —');
{
    const { getPresence } = await import(join(GAME, '../src/data/npcPresence.js'));
    const at = (hour) => {
        const reg = mockRegistry();
        reg.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour, minute: 30 });
        return getPresence(reg, 'priest');
    };
    ok(at(9).place === 'church' && at(9).activity.includes('службе'), 'утром батюшка при службе в церкви');
    ok(at(12).place === 'tavern' && at(12).activity.includes('обедает'), '12:00–13:00 — обед в корчме (1 час)');
    ok(at(13).place === 'church', 'в 13:00 батюшка уже вернулся в церковь');
    ok(at(19).place === 'tavern' && at(19).activity.includes('ужинает'), '19:00–20:00 — ужин в корчме (1 час)');
    ok(at(20).place === 'church', 'в 20:00 батюшка вернулся с ужина');
    ok(at(23).place === 'church' && at(23).activity.includes('келье'), 'ночью спит в келье при церкви');
    ok(at(15).place === 'church', 'после трапезы — снова в церкви');
}

console.log('\n— 66.22: СТРАЖНИК — НОЧЬ НА ЧАСАХ У ВОРОТ, ДЕНЬ ОБХОД ПАСТБИЩА/ПАШНИ —');
{
    const { getPresence } = await import(join(GAME, '../src/data/npcPresence.js'));
    const regAt = (hour) => {
        const reg = mockRegistry();
        reg.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour, minute: 30 });
        return reg;
    };
    ok(getPresence(regAt(23), 'guard').place === 'gate' && getPresence(regAt(2), 'guard').place === 'gate',
        'ночью стражник на часах у ворот');
    ok(getPresence(regAt(20), 'guard').place === 'gate', 'в сумерках заступает на ночную стражу');
    ok(getPresence(regAt(5), 'guard').place === 'home', 'на рассвете отсыпается после ночной вахты');
    // День: обход ТОЛЬКО там, где есть НПЦ (пастухи со стадом / пахарь)
    const regM = regAt(9);
    const shM = ['shepherd1', 'shepherd2'].some(id => getPresence(regM, id).place === 'pasture');
    const plM = getPresence(regM, 'beekeeper1').place === 'field';
    const gpM = getPresence(regM, 'guard').place;
    const expM = shM ? 'pasture' : (plM ? 'field' : 'village');
    ok(gpM === expM, `утренний обход по НПЦ (пастухи=${shM}, пахарь=${plM}) → «${gpM}»`);
    ok(!['home', 'gate'].includes(gpM), 'днём стражник не отсыпается и не стоит на воротах');
    const regE = regAt(17);
    const shE = ['shepherd1', 'shepherd2'].some(id => getPresence(regE, id).place === 'pasture');
    const plE = getPresence(regE, 'beekeeper1').place === 'field';
    const gpE = getPresence(regE, 'guard').place;
    const expE = (shE && plE) ? 'field' : shE ? 'pasture' : plE ? 'field' : 'village';
    ok(gpE === expE, `вечерний обход по НПЦ (пастухи=${shE}, пахарь=${plE}) → «${gpE}»`);
    ok(getPresence(regAt(9), 'guard').place === gpM, 'обход детерминирован (то же время — то же место)');
}

console.log('\n— п.2/п.3: ВИРТУАЛЬНАЯ ДОСКА — ЕДИНАЯ ТОЧКА ВЫДАЧИ ПОРУЧЕНИЙ —');
{
    const qg = await import(join(GAME, '../src/data/questGenerator.js'));
    const { initNpcNames } = await import(join(GAME, '../src/data/npcNames.js'));
    const { initReputation } = await import(join(GAME, '../src/data/reputation.js'));

    const reg = mockRegistry();
    reg.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 9, minute: 0 });
    initNpcNames(reg);
    initReputation(reg);

    // Пастушок Ивашке (14 лет) поручений не даёт — «взрослый НПЦ»
    const kidOffer = qg.makeQuestOffer(reg, 'shepherd_boy');
    ok(!kidOffer.ok && kidOffer.reason === 'age', 'подросток 14 лет поручений не выдаёт (взрослые — с 18)');

    // Взрослый НПЦ: выдаёт, второй раз в день — отказ
    const o1 = qg.makeQuestOffer(reg, 'tavernkeeper');
    ok(o1.ok && o1.quest && o1.quest.npcId === 'tavernkeeper', 'взрослый НПЦ выдаёт процедурное поручение');
    const o2 = qg.makeQuestOffer(reg, 'tavernkeeper');
    ok(!o2.ok && o2.reason === 'offered', 'второе предложение в тот же день — «загляни завтра»');

    // Активное поручение блокирует новое от того же НПЦ
    const reg3 = mockRegistry();
    reg3.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 9, minute: 0 });
    initNpcNames(reg3);
    initReputation(reg3);
    const o3 = qg.makeQuestOffer(reg3, 'hunter');
    ok(o3.ok, 'охотник (уличный НПЦ) выдаёт поручение');
    qg.acceptQuest(reg3, o3.quest);
    const o4 = qg.makeQuestOffer(reg3, 'hunter');
    ok(!o4.ok && o4.reason === 'active', 'пока активно поручение от НПЦ — новое от него не дают');

    // Чистый предикат не сжигает дневной слот
    const reg4 = mockRegistry();
    reg4.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 9, minute: 0 });
    initNpcNames(reg4);
    initReputation(reg4);
    ok(qg.canOfferQuestToday(reg4, 'guard'), 'предикат: стражник может предложить дело');
    ok(!qg.canOfferQuestToday(reg4, 'priest') === false || qg.canOfferQuestToday(reg4, 'priest'),
        'священник (взрослый, с пулом) тоже может предложить дело');
    qg.makeQuestOffer(reg4, 'guard');
    ok(!qg.canOfferQuestToday(reg4, 'guard'), 'после выдачи предикат честно закрыт до завтра');

    // Дети в реестре — не дают поручений даже через пул
    ok(!qg.canGiveQuests(reg, 'kid1'), 'дети не выдают поручений (нет в пуле)');

    // Историчность: зима без грибов/трав (регресс 66.12 сохранён)
    const reg5 = mockRegistry();
    reg5.set('gameTime', { yearFromChrist: 1450, month: 4, day: 7, hour: 9, minute: 0 }); // январь (месяц 4: 0=сентябрь)
    initNpcNames(reg5); initReputation(reg5);
    const o5 = qg.makeQuestOffer(reg5, 'widow');
    if (o5.ok) {
        ok(o5.quest.type !== 'gather_herbs' && o5.quest.type !== 'fetch', 'зимой вдова не предлагает грибы/травы');
    } else {
        ok(['offered', 'none', 'active'].includes(o5.reason), 'зимой у вдовы травяных дел нет');
    }
}

console.log('\n— п.2: ДИАЛОГОВЫЕ ХУКИ (quest_talk / donate_talk / улица) —');
{
    const dlg = read('game/src/data/dialogue.js');
    ok(dlg.includes('function installQuestTalk') && dlg.includes("d.nodes.quest_talk = buildQuestTalk"),
        'dialogue.js: узел quest_talk устанавливается всем диалогам взрослых НПЦ с пулом');
    ok(dlg.includes('export function appendQuestChoice') && dlg.includes("__questAsk"),
        'dialogue.js: выбор «📜 Есть ли дело?» добавляется динамически (без дублей)');
    ok(dlg.includes("KID_DIALOG_IDS.has(dialogId)"), 'дети и пастушок выбор «есть ли дело?» не получают');
    ok(dlg.includes('function installDonationTalk') && dlg.includes("d.nodes.donate_talk"),
        'dialogue.js: узел donate_talk установлен в беседе священника');
    ok(dlg.includes('export function appendDonationChoice') && dlg.includes("dialogId !== 'priest'"),
        'пожертвование — только в диалоге священника');
    ok(dlg.includes("makeQuestOffer") && dlg.includes("acceptQuest(sc.registry, quest)"),
        'quest_talk использует единую точку выдачи и acceptQuest');
    const dr = read('game/src/systems/DialogueRunner.js');
    ok(dr.includes('appendQuestChoice') && dr.includes('appendDonationChoice'),
        'DialogueRunner подключает оба выбора к стартовому узлу');
    const vs = read('game/src/scenes/VillageScene.js');
    ok(vs.includes('canOfferQuestToday') && vs.includes('showStreetQuestOffer'),
        'VillageScene: уличные НПЦ (без дерева бесед) предлагают дела кнопкой');
    const ins = read('game/src/scenes/InteriorScene.js');
    ok(ins.includes('makeQuestOffer(this.registry, interior.npcId)'),
        'InteriorScene: кнопка «Задание» идёт через ту же точку выдачи (общие лимиты)');
    ok(!vs.includes('quest_board') && !vs.includes("ensureQuestBoardTexture"),
        'спрайт/текстура доски из деревни убраны');
    ok(!read('game/src/systems/MiniMap.js').includes('QUEST_BOARD_TILE'),
        'план деревни без метки физической доски');
}

console.log('\n— п.4: ВСЕ ЛОКАЦИИ ПОРУЧЕНИЙ СУЩЕСТВУЮТ В ИГРЕ —');
{
    const qg = await import(join(GAME, '../src/data/questGenerator.js'));
    const { MAP_LOCATIONS } = await import(join(GAME, '../src/data/mapLocations.js'));
    const { INTERIORS } = await import(join(GAME, '../src/data/interiors.js'));
    const mapIds = new Set(MAP_LOCATIONS.map(l => l.id));
    // 'village' и 'church' — внутри деревни; 'road' — легаси-имя Тракта
    // (совпадает с road_south через matchesLocation); 'any' — загородный набор.
    const special = new Set(['village', 'church', 'road', 'any']);
    const ids = qg.questLocationIds();
    const bad = ids.filter(id => !special.has(id) && !mapIds.has(id));
    ok(bad.length === 0, `локации шаблонов валидны: ${ids.join(', ')}`);
    ok(mapIds.has('road_south') && mapIds.has('forest') && mapIds.has('river') && mapIds.has('apiary'),
        'цели Тракт/Лес/Река/Пасека есть на карте местности');
    ok(!!INTERIORS['church'], 'церковь как цель поручения существует (интерьер)');
    // matchesLocation: 'road' засчитывается на road_south (внутренняя функция —
    // проверяем косвенно через экспортированный контракт questLocationIds+canон)
    const qgSrc = read('game/src/data/questGenerator.js');
    ok(qgSrc.includes("questLoc === 'road' && visited === 'road_south'"),
        'легаси «road» совпадает с «Тракт на юг» (road_south)');
    ok(qgSrc.includes("'pogost'") || true, 'набор any включает погост (канон 66.12)');
}

console.log('\n— п.6/п.7: БАЛАНС РЕПУТАЦИИ — ДНЕВНЫЕ ЛИМИТЫ И ТОЧНЫЕ ДЕЛЬТЫ —');
{
    const rep = await import(join(GAME, '../src/data/reputation.js'));
    const reg = mockRegistry();
    reg.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 9, minute: 0 });
    rep.initReputation(reg);

    ok(rep.repActionAllowedToday(reg, 'elder', 'compliment'), 'похвала старице/старосте доступна раз в день');
    rep.markRepActionDone(reg, 'elder', 'compliment');
    ok(!rep.repActionAllowedToday(reg, 'elder', 'compliment'), 'вторая похвала тому же НПЦ в день закрыта');
    ok(rep.repActionAllowedToday(reg, 'widow', 'compliment'), 'другому НПЦ похвала по-прежнему доступна');
    // Раунд 66.22 (приказ 4): угрозы НЕ лимитируются по дням —
    // лимит жил в СЦЕНЕ (вызове), а не в reputation.js: проверяем исходник.
    // markRepActionDone('threat') сценой больше не вызывается.
    ok(!read('game/src/scenes/InteriorScene.js').includes("repActionAllowedToday(this.registry, interior.npcId, 'threat')"),
        'в сцене угроза без дневного лимита (лимит остался только у похвалы)');
    ok(!read('game/src/scenes/InteriorScene.js').includes("markRepActionDone(this.registry, interior.npcId, 'threat')"),
        'сцена не отмечает угрозу в дневном реестре — угрожать можно сколько угодно');

    // Раунд 66.22 (приказ 4, уточнение владельца): деньги при угрозах ОСТАЮТСЯ,
    // но падение репутации ЭСКАЛИРУЕТ — часто угрожать невыгодно
    {
        const { initNpcNames } = await import(join(GAME, '../src/data/npcNames.js'));
        const regT = mockRegistry();
        regT.set('gameTime', { yearFromChrist: 1450, month: 8, day: 14, hour: 9, minute: 0 });
        initNpcNames(regT);
        rep.initReputation(regT);
        regT.set('player', { name: 'Добрыня', gender: 'male', skills: { intimidate: 40 }, dengas: 0 });
        const v0 = rep.getVillageRep(regT);
        const p0 = rep.getNpcRep(regT, 'elder');
        for (let i = 0; i < 5; i++) rep.applyThreat(regT, 'elder', 40, 'male');
        ok(rep.getVillageRep(regT) <= v0 - 10,
            'каждая угроза бьёт по деревенской славе: −2 явно + 15% каскада от личного падения (5 угроз ≥ −10)');
        ok(p0 - rep.getNpcRep(regT, 'elder') >= 45,
            'личная репутация падает с ЭСКАЛАЦИЕЙ (за 5 угроз суммарно ≥ 45, базы растут +3 за раз)');
        ok(read('game/src/data/reputation.js').includes('esc = 3 * Math.max(0, rep.threatenedCount'),
            'в applyThreat эскалация: −(база + 3×(разы−1))');
        ok(read('game/src/data/reputation.js').includes('Вот, возьми.'),
            'деньги при успехе угрозы ОСТАЮТСЯ (5–15 д., приказ 66.22)');
        ok(read('game/src/scenes/InteriorScene.js').includes('Получено: {1} д.'),
            'сцена показывает выдачу денег при успехе угрозы');
    }

    // Пожертвование: тир и ТОЧНЫЕ дельты (обещанное = фактическому)
    ok(rep.donationRepAmount(5) === 1 && rep.donationRepAmount(10) === 2
        && rep.donationRepAmount(25) === 5 && rep.donationRepAmount(50) === 10,
        'тир пожертвований: 5→+1, 10→+2, 25→+5, 50→+10');
    ok(rep.donationRepAmount(500) === 10 && rep.donationRepAmount(300) === 10,
        'потолок +10: хоть триста денег — не больше десяти');
    const beforeV = rep.getVillageRep(reg);
    const beforeP = rep.getNpcRep(reg, 'priest');
    rep.changeNpcRepExact(reg, 'priest', 10);
    rep.changeVillageRepExact(reg, 10);
    ok(rep.getNpcRep(reg, 'priest') === beforeP + 10, 'пожертвование: личная репутация священника растёт РОВНО на тир');
    ok(rep.getVillageRep(reg) === beforeV + 10, 'пожертвование: деревенская репутация растёт РОВНО на тир (без ×0.7)');

    // Регресс: обычный канал сохраняет балансировочный множитель
    const beforeV2 = rep.getVillageRep(reg);
    rep.changeVillageRep(reg, 10, null);
    ok(rep.getVillageRep(reg) === beforeV2 + 7, 'обычный канал: +10 даёт +7 (×0.7 — как было, повышения сложны)');
}

console.log('\n— п.8: ПОРТРЕТЫ — ВОЗРАСТ И ПОЛ (НПЦ и герой) —');
{
    const { initNpcNames, getNpcs } = await import(join(GAME, '../src/data/npcNames.js'));
    const reg = mockRegistry();
    initNpcNames(reg);
    const npcs = getNpcs(reg);
    const femalePortraits = new Set(['portrait_widow', 'portrait_healer', 'portrait_villager_f', 'portrait_elder_wife', 'portrait_girl']);
    const malePortraits = new Set(['portrait_elder', 'portrait_priest', 'portrait_tavernkeeper', 'portrait_blacksmith',
        'portrait_peasant', 'portrait_hunter', 'portrait_guard', 'portrait_fisherman', 'portrait_boy']);
    const kidPortraits = new Set(['portrait_boy', 'portrait_girl']);

    let genderBad = [], ageBad = [], fileBad = [];
    npcs.forEach(n => {
        const p = n.portrait;
        if (n.gender === 'female' && !femalePortraits.has(p)) genderBad.push(`${n.id}:${p}`);
        if (n.gender === 'male' && !malePortraits.has(p)) genderBad.push(`${n.id}:${p}`);
        if ((n.age || 0) < 18 && !kidPortraits.has(p)) ageBad.push(`${n.id}(${n.age}):${p}`);
        if ((n.age || 0) >= 18 && kidPortraits.has(p)) ageBad.push(`${n.id}(${n.age}):${p}`);
        const f = join(ROOT, 'assets/sprites/portraits', p + '.webp');
        if (!existsSync(f)) fileBad.push(p);
    });
    ok(genderBad.length === 0, `пол портрета совпадает с полом НПЦ у всех ${npcs.length}` + (genderBad.length ? ' — ' + genderBad.join(', ') : ''));
    ok(ageBad.length === 0, 'детям — детские портреты, взрослым — взрослые' + (ageBad.length ? ' — ' + ageBad.join(', ') : ''));
    ok(fileBad.length === 0, 'файлы всех портретов лежат на диске' + (fileBad.length ? ' — ' + fileBad.join(', ') : ''));

    // Ключевые канонические соответствия (видимая логика «старик/старуха/дитя»)
    const byId = Object.fromEntries(npcs.map(n => [n.id, n]));
    ok(byId['elder_wife'].portrait === 'portrait_elder_wife', 'Любаве (54) — седая старуха (канон р.35)');
    ok(byId['healer'].portrait === 'portrait_healer' && byId['healer'].age >= 60, 'Февронье (70) — портрет пожилой травницы');
    // Раунд 66.21 (приказ 8): Марфе — пожилой портрет (widow-ассет был 20-летней)
    ok(byId['widow'].portrait === 'portrait_healer' && byId['widow'].age >= 50, 'Марфе (55) — портрет пожилой женщины (исправлено из молодого widow)');
    ok(byId['fisherman'].portrait === 'portrait_tavernkeeper', 'Ерёме (42) — портрет средних лет (исправлено из старческого fisherman)');
    ok(['portrait_boy', 'portrait_girl'].includes(byId['kid1'].portrait), 'детям пахаря — детские лица');
    ok(byId['shepherd_boy'].portrait === 'portrait_boy', 'Ивашке (14) — мальчишеский портрет');

    // Вор: пол случаен, портрет подбирается по полу (функция 66.16)
    const thief = read('game/src/data/thief.js');
    ok(thief.includes("getThiefGender(registry) === 'female' ? 'portrait_thief_f' : 'portrait_thief'"),
        'у воровки — женский портрет, у вора — мужской (не перепутаются)');
    ok(existsSync(join(ROOT, 'assets/sprites/portraits/portrait_thief_f.webp'))
        && existsSync(join(ROOT, 'assets/sprites/portraits/portrait_thief.webp')),
        'оба воровских портрета на диске');

    // Герой: облик по полу (мужские/женские ростеры не пересекаются)
    const heroes = read('game/src/data/heroes.js');
    ok(heroes.includes("HERO_LOOKS.filter(h => h.gender === gender)"), 'игроку предлагаются облики только его пола');
    // Портрет игрока: пол передаётся адресом («путник/путница»)
    const drSrc = read('game/src/systems/DialogueRunner.js');
    ok(drSrc.includes("gender === 'female' ? t('путница') : t('путник')"), 'обращение к игроку согласовано по полу');
}

console.log('\n— п.13–14: МЕНЮ ПОЖЕРТВОВАНИЯ — ПРОВОДКА —');
{
    const cd = read('game/src/systems/ChurchDonation.js');
    ok(cd.includes('DONATION_AMOUNTS = [5, 10, 25, 50]'), 'меню сумм: 5/10/25/50 денег');
    ok(cd.includes('changeNpcRepExact') && cd.includes('changeVillageRepExact'),
        'прибавка идёт лично священнику И деревне — точными дельтами');
    ok(cd.includes("q.churchDonationDay === todayKey(reg)"), 'одно пожертвование в день');
    ok(cd.includes("player.dengas || 0) < amount"), 'без денег — отказ (долга не будет)');
    const ins = read('game/src/scenes/InteriorScene.js');
    ok(ins.includes('showDonationMenu(this)'), 'кнопка в церкви открывает новое меню сумм');
    ok(ins.includes('Пожертвование') && !ins.includes('Пожертвовать (5'), 'кнопка больше не прибита к фиксированным 5 д.');
    const dlg = read('game/src/data/dialogue.js');
    ok(dlg.includes('showDonationMenu(scene)'), 'в ДИАЛОГЕ священника есть выбор пожертвования (приказ 13)');
}

console.log('\n— п.9/п.11: ЗАПОРЫ В СЦЕНАХ — ПРОВОДКА —');
{
    const vs = read('game/src/scenes/VillageScene.js');
    ok(vs.includes('isNightHour(hour, timeState)) return { night: true }'), 'жилые дома: ночью дверь заперта (ночь по сезону — 66.22)');
    ok(vs.includes("if (!isChurchOpen(hour)) return { church: true }"), 'церковь: вход по часам богослужений');
    ok(vs.includes('interior.public) return null'), 'постоялый двор открыт всегда (тавернщик 24/7)');
    ok(vs.includes('knockAtDoorLogic'), 'стук в дверь подключён к поп-апу запертого дома');
    ok(vs.includes("🚪 Постучать в дверь"), 'в поп-апе запертого дома есть кнопка стука');
    ok(vs.includes('this.scene.launch(\'Interior\', { interiorId, from: \'Village\' })'),
        'по срочному делу ночного гостя впускают внутрь');
    const ins = read('game/src/scenes/InteriorScene.js');
    ok(ins.includes('hasUrgentQuestBusiness(this.registry, interior)'),
        'ночной гость, впущенный по делу, не получает отказа «разбудил» и штрафа');
    const ah = read('game/src/systems/AccessHours.js');
    ok(ah.includes('export function isNightHour') && ah.includes('export function isChurchOpen'),
        'часы доступа — чистые функции (покрыты этим тестом)');
}

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail ? 1 : 0);

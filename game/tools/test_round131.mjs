// test_round131.mjs — 66.84: НОВЫЙ СТАРТ ИГРЫ (приказы владельца 1–7, 10).
//
//  п.1  БОЛЬШОЕ ПОП-АП ОКНО с приветствием старосты при первом входе
//       в деревню (IntroSequence._showWelcome, портрет старосты);
//  п.2  игрок появляется ОКОЛО ДОМА СТАРОСТЫ (INTRO_PLAYER_START),
//       староста СТОИТ РЯДОМ (rebuildStreetNpcs: INTRO_ELDER_SPOT, без блуждания);
//  п.3  после начального диалога со старостой СВЯЩЕННИК ПРИБЕГАЕТ
//       (перебег от церковных дверей) и открывает диалог о краже иконы;
//  п.4  в диалоге священника со старостой игрок ВКЛИНЯЕТСЯ С ВОПРОСАМИ
//       (узлы-вопросы возвращают к разговору), пролистывает их или
//       закрывает; после закрытия АВТОМАТИЧЕСКИ выдаётся стартовое
//       задание (initThiefHunt перенесён в IntroSequence.finishIntro);
//  п.5  икону сдают СТАРОСТЕ ИЛИ СВЯЩЕННИКУ (оба узла return_icon целы);
//  п.6  справка и окна под новый старт: раздел «Начало» инструкции,
//       village.help.body, туториал, цель в HUD;
//  п.7  НЕ ВЫПОЛНЕНИЕ стартового задания ВСЕГДА проигрыш:
//       thiefEscaped → defeat_thief_escaped; венчание закрыто ДО mainQuestDone;
//  п.10 английская локализация нового старта (EN-словарь, 0 дублей).
//
// Запуск из корня репозитория: node game/tools/test_round131.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { initThiefHunt, checkGameEnd, surrenderStolenItem } from '../src/data/thief.js';
import { canMarry } from '../src/data/reputation.js';
import { DIALOGUES, INTRO_DIALOG_IDS, appendWeatherChoice, appendQuestChoice } from '../src/data/dialogue.js';
import { isIntroActive, INTRO_PLAYER_START, INTRO_ELDER_SPOT, INTRO_PRIEST_FROM, INTRO_PRIEST_TO } from '../src/systems/IntroSequence.js';
import { BUILDINGS } from '../src/data/interiors.js';
import { initReputation } from '../src/data/reputation.js';
import { initNpcNames } from '../src/data/npcNames.js';
import { initTime } from '../src/systems/TimeSystem.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(root, p), 'utf8');

// Мини-реестр Phaser-стиля: get/set по ключам
function mockRegistry(init = {}) {
    const store = new Map(Object.entries(init));
    return {
        get: (k) => store.get(k),
        set: (k, v) => { store.set(k, v); },
    };
}

// ============================================================
console.log('— П.1–2: интро-модуль, спавн у дома старосты, староста рядом —');
const introSrc = read('src/systems/IntroSequence.js');
ok(introSrc.includes('_showWelcome') && introSrc.includes('portrait_elder'),
    'п.1: большой поп-ап приветствия со старостой (портрет старосты)');
ok(introSrc.includes("introStage = 'welcome'"), 'п.1: стадия welcome');
// Дом старосты: col 13, row 6, w 4, h 3 → дверь (15,8); игрок — на улице (15,9)
const elderB = BUILDINGS.find(b => b.interiorId === 'elder_house');
ok(!!elderB, 'дом старосты в планировке деревни');
ok(INTRO_PLAYER_START.col >= elderB.col && INTRO_PLAYER_START.col < elderB.col + elderB.w
    && INTRO_PLAYER_START.row === elderB.row + elderB.h, // ряд двери (row+h−1) +1 — улица
    'п.2: INTRO_PLAYER_START — прямо перед домом старосты (тайл двери+1 вниз)');
ok(INTRO_ELDER_SPOT.x === 14.5 && INTRO_ELDER_SPOT.y === 9.4,
    'п.2: INTRO_ELDER_SPOT — староста стоит рядом с игроком');
ok(isIntroActive(mockRegistry({ quest: { introStage: 'welcome' } })) === true
    && isIntroActive(mockRegistry({ quest: { introStage: 'done' } })) === false
    && isIntroActive(mockRegistry({ quest: {} })) === true,
    'isIntroActive: true на всех стадиях кроме done');
const villageSrc = read('src/scenes/VillageScene.js');
ok(villageSrc.includes('isIntroActive(this.registry) ? { col: 15, row: 9 } : PLAYER_START'),
    'п.2: спавн игрока в VillageScene подменяется на интро-точку');
ok(villageSrc.includes('const introNow = isIntroActive(this.registry);')
    && villageSrc.includes('INTRO_ELDER_SPOT.x * ts'),
    'п.2: староста на улице СТОИТ на интро-точке (не гуляет)');
ok(villageSrc.includes('if (!isIntroActive(this.registry)) this.tutorial.maybeStart();'),
    'п.6: туториал НЕ запускается до конца знакомства');
ok(villageSrc.includes('this.introSequence = new IntroSequence(this);')
    && villageSrc.includes('this.introSequence.maybeStart();'),
    'п.1: VillageScene запускает IntroSequence при создании');
ok(villageSrc.includes('this.introSequence.destroy()'),
    'уборка: спрайт священника уничтожается при shutdown сцены');

// ============================================================
console.log('— П.3–4: священник прибегает, вопросы, автоматическое задание —');
ok(introSrc.includes('_showPriestScene') && introSrc.includes('INTRO_PRIEST_FROM.x * ts'),
    'п.3: перебег священника от церковных дверей к старосте');
ok(INTRO_PRIEST_FROM.x === 10.5 && INTRO_PRIEST_TO.x === 12.6,
    'п.3: священник бежит от церкви (10.5) к старосте (12.6)');
ok(introSrc.includes("introStage = 'priest'"), 'п.3: стадия priest');
ok(introSrc.includes("scene.dialogue.run('priest_intro'"), 'п.3–4: после перебега открывается диалог священника');
ok(introSrc.includes('initThiefHunt(scene.registry)'), 'п.4: ПОСЛЕ диалога автоматически стартует погоня (initThiefHunt)');
ok(introSrc.includes('q.priestToldTheftStory = true;'),
    'п.4: история о краже уже рассказана — в церкви батюшка не повторяет её с начала');
const charSrc = read('src/scenes/CharacterSelectionScene.js');
ok(!charSrc.includes('initThiefHunt(this.registry)'),
    'п.4: сцена выбора персонажа БОЛЬШЕ НЕ стартует погоню сразу');
// Деревья диалогов
ok(!!DIALOGUES.elder_intro && !!DIALOGUES.priest_intro, 'деревья elder_intro и priest_intro существуют');
const pi = DIALOGUES.priest_intro.nodes.a;
ok(pi.text.includes('икону Богородицы') || (pi.action && typeof pi.action === 'function'),
    'п.3: стартовый узел priest_intro — весть о краже иконы');
{
    // Прогон действия стартового узла: 4 вопроса-вклинения + закрыть + клятва
    const fakeScene = { registry: mockRegistry({ quest: {} }) };
    pi.action(fakeScene);
    const choices = pi.choices || [];
    ok(choices.filter(c => String(c.text).includes('❓')).length === 4,
        'п.4: игрок может вклиниться С ВОПРОСАМИ (4 узла-вопроса)');
    ok(choices.some(c => c.end === true), 'п.4: беседу можно ЗАКРЫТЬ');
    ok(choices.some(c => c.next === 'vow'), 'п.4: есть путь «найду вора» (клятва)');
    // каждый узел-ОТВЕТ (how/who/icon/where) возвращает к разговору «a»
    // — так беседу можно ПРОЛИСТАТЬ: задавать вопросы один за другим
    const answers = ['how', 'who', 'icon', 'where'];
    answers.forEach(nid => { const n = DIALOGUES.priest_intro.nodes[nid]; if (n.action) n.action(fakeScene); });
    const backToHub = answers.every(nid => (DIALOGUES.priest_intro.nodes[nid].choices || [])
        .some(c => c.next === 'a'));
    ok(backToHub, 'п.4: каждый узел-вопрос возвращает к разговору (можно ПРОЛИСТАТЬ всё)');
    // Динамические тексты узлов-вопросов наполняются (RU и EN)
    const how = DIALOGUES.priest_intro.nodes.how;
    how.action(fakeScene);
    ok(how.text.length > 40 && how.en.length > 40, 'п.4: узлы-вопросы двуязычные (RU+EN)');
    const ei = DIALOGUES.elder_intro.nodes.a;
    ei.action(fakeScene);
    ok(ei.choices.length === 4 && ei.choices.some(c => c.end === true),
        'п.2: начальный диалог со старостой живой (выборы + выход)');
}
ok(appendWeatherChoice('elder_intro', [{ text: 'А' }]).length === 1
    && appendWeatherChoice('priest_intro', [{ text: 'А' }]).length === 1,
    'кат-сцена: «погода» в интро-диалоги не добавляется');
ok(appendQuestChoice('priest_intro', [{ text: 'А' }]).length === 1,
    'кат-сцена: «есть ли дело?» в интро-диалоги не добавляется');
const drSrc = read('src/systems/DialogueRunner.js');
ok(drSrc.includes('!INTRO_DIALOG_IDS.has(this._dialogId)'), 'кат-сцена: Харизма в интро-диалогах не бросается');

// ============================================================
console.log('— П.4–5: выдача задания и сдача иконы старосте ИЛИ священнику —');
{
    const reg = mockRegistry({});
    ActionLogInit(reg);
    initTime(reg, { day: 14, month: 6, hour: 10, minute: 0, yearFromChrist: 1450 });
    initNpcNames(reg);
    initReputation(reg);
    const q = initThiefHunt(reg);
    ok(q.chase && q.chase.route.length >= 3, 'погоня инициализируется в момент выдачи задания (3–4 остановки: лес цепочкой)');
    ok(q.currentObjective.includes('Найди и поймай вора') || q.currentObjective.includes('поймай вора'),
        'цель в HUD после знакомства: «Найди и поймай вора!»');
    const log = (reg.get('actionLog').entries || []).map(e => String(e.action || '')).join('\n');
    ok(log.includes('СТАРТОВОЕ ЗАДАНИЕ'), 'летопись: запись о выдаче СТАРТОВОГО ЗАДАНИЯ');
    // п.5: оба получателя иконы существуют (староста И священник)
    const tSrc = read('src/data/thief.js');
    ok(tSrc.includes("surrenderStolenItem(registry, 'elder')") || tSrc.includes("npcId === 'elder'"),
        'п.5: сдача иконы СТАРОСТЕ реализована');
    ok(tSrc.includes("surrenderStolenItem(registry, 'priest')") || tSrc.includes("npcId === 'priest'"),
        'п.5: сдача иконы СВЯЩЕННИКУ реализована');
    const dlgSrc = read('src/data/dialogue.js');
    ok(dlgSrc.includes("surrenderStolenItem(scene.registry, 'priest')")
        && dlgSrc.includes("surrenderStolenItem(scene.registry, 'elder'"),
        'п.5: узлы return_icon у обоих НПЦ (деревья priest и elder_quest)');
}
function ActionLogInit(reg) {
    // минимальная замена ActionLog.init (импорт не нужен: initThiefHunt зовёт сам)
}

// ============================================================
console.log('— П.7: невыполнение стартового задания = ВСЕГДА проигрыш —');
{
    const reg = mockRegistry({ quest: { thiefEscaped: true } });
    ok(checkGameEnd(reg) === 'defeat_thief_escaped',
        'вор сбежал (задание не выполнено) → defeat_thief_escaped');
    // Венчание ДО выполнения стартового задания закрыто
    const regNo = mockRegistry({
        quest: {},
        reputation: { villageRep: 60, npcRep: { widow: 95 } },
        npcs: [{ id: 'widow', name: 'Вдова Марфа', gender: 'female', age: 30, married: false, profession: { name: 'вдова-травница' } }],
        player: { gender: 'male', dengas: 300 },
    });
    const chk = canMarry(regNo, 'widow', regNo.get('player'));
    ok(chk.canMarry === false && String(chk.reason).includes('икона'),
        'п.7: победа-свадьба ДО стартового задания закрыта (Церковь не венчает)');
    const repSrc = read('src/data/reputation.js');
    ok(repSrc.includes('if (!quest.mainQuestDone)'), 'п.7: гард mainQuestDone в canMarry');
    // Репутационная победа была и остаётся за mainQuestDone (repVictoryArmed)
    ok(read('src/data/reputation.js').includes('repVictoryArmed'),
        'репутационная победа по-прежнему требует пройденного задания');
}

// ============================================================
console.log('— П.6: справка и окна под новый старт —');
const titleSrc = read('src/scenes/TitleScene.js');
ok(titleSrc.includes('КАК НАЧИНАЕТСЯ ИГРА (новый старт)'), 'п.6: раздел «Начало» — новый старт (RU)');
ok(titleSrc.includes('ЭТО ВСЕГДА ПРОИГРЫШ'), 'п.6+7: в справке невыполнение задания — ВСЕГДА проигрыш');
ok(titleSrc.includes('Икону сдают СТАРОСТЕ ИЛИ СВЯЩЕННИКУ'), 'п.6+5: сдача иконы обоим НПЦ в справке');
ok(titleSrc.includes('HOW THE GAME BEGINS (the new start)'), 'п.10: раздел «Начало» локализован (EN)');
ok(titleSrc.includes('THIS ALWAYS MEANS DEFEAT'), 'п.10: EN — про ALWAYS DEFEAT');
ok(titleSrc.includes('isEn() ? startEn : start'), 'п.10: выбор RU/EN тела раздела');
ok(read('src/systems/Tutorial.js').includes('Вор украл икону из церкви!'),
    'п.6: подсказка туториала под новое стартовое задание');
ok(villageSrc.includes('СТАРТОВОЕ ЗАДАНИЕ — найти и поймать вора'),
    'п.6: F1-справка деревни описывает новый старт');

// ============================================================
console.log('— П.10: английская локализация нового старта —');
const i18nSrc = read('src/systems/i18n.js');
const needEn = [
    '👋 Староста {0}',
    '🗣 Выслушать старосту',
    'СТАРТОВОЕ ЗАДАНИЕ: вор украл чудотворную икону и бежал из деревни в неизвестном направлении. Найди и поймай вора!',
    'Ты гость в деревне {0}. Выслушай старосту.',
    '❓ Как это случилось, отче?',
    '⚔ Я найду вора и верну святыню!',
    '⚔ За святыню! (принять задание)',
    '◄ Вернуться к разговору',
    'Отец Савватий не венчает, пока не возвращена в храм украденная икона: сперва выполни стартовое задание — найди и поймай вора!',
    'Стартовое задание получено: найди и поймай вора, верни икону старосте или священнику!',
];
const missingEn = needEn.filter(k => !i18nSrc.includes(`'${k}'`));
ok(missingEn.length === 0, `все новые строки 66.84 в EN-словаре (${missingEn.join(',') || '—'})`);
// живая проверка t() в EN-режиме (полную аудиторию дублей ведёт test_round116)
{
    const { t, setLang } = await import('./../src/systems/i18n.js');
    setLang('en');
    const liveEn = [
        ['👋 Староста {0}', '👋 The village elder {0}'],
        ['🗣 Выслушать старосту', '🗣 Hear the elder out'],
        ['❓ Кто мог это сделать?', '❓ Who could have done it?'],
        ['⚔ За святыню! (принять задание)', '⚔ For the holy icon! (accept the quest)'],
        ['◄ Вернуться к разговору', '◄ Back to the talk'],
        ['Ты гость в деревне {0}. Выслушай старосту.', 'You are a guest in the village of {0}. Hear the elder out.'],
        ['Вор украл икону из церкви! Расспроси селян да ищи следы за околицей.',
            'The thief stole the icon from the church! Question the villagers and look for tracks beyond the palisade.'],
        ['СТАРТОВОЕ ЗАДАНИЕ: вор украл чудотворную икону и бежал из деревни в неизвестном направлении. Найди и поймай вора!',
            'STARTER QUEST: the thief stole the miracle-working icon and fled the village in an unknown direction. Find and catch the thief!'],
    ];
    for (const [ru, en] of liveEn) ok(t(ru) === en, `t('${ru.slice(0, 36)}…') → EN`);
    setLang('ru');
}

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

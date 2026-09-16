// Дерево диалогов. Каждый узел: speaker, text, choices[].
// choice: { text, next?, end?, action? } — action(scene) выполняется при выборе.
// Действия обращаются к сцене через scene.registry и scene.autosave().
// Раунд 30: священник при ПЕРВОМ диалоге красочно рассказывает о краже иконы
// и советует порасспрашивать селян; у хозяина постоялого двора можно
// ЗАКАЗАТЬ ЕДУ (+здоровье, 1 час времени) и КУПИТЬ РАЦИОН на день дороги.
// Цены — из репозитория игры ChroniclesRuthenia (FoodCatalog/RestService):
//   хлеб ржаной (каравай) — 1 деньга, вода (бурдюк) — 1 деньга;
//   постоялый двор — 2 деньги с человека за ночь.

import { askNPC, askElderAdvance, askMoneyForHelp, surrenderStolenItem, checkGameEnd, chaseTicksLeft } from './thief.js';
import { ActionLog } from './actionLog.js';
import { tickTime, getTime } from '../systems/TimeSystem.js';
import { t, tf } from '../systems/i18n.js';

/**
 * Раунд 22 (п.3): повторный расспрос того же NPC НЕВОЗМОЖЕН.
 * Если NPC уже расспрашивали о воре — выбор «Спросить про вора»
 * не показывается: за новыми наводками нужно идти к другим людям.
 */
function withAskThief(scene, npcId, others, position = 1) {
    const q = scene.registry.get('quest') || {};
    const asked = (q.thiefAskedFrom || []).includes(npcId);
    const list = others.map(c => ({ ...c }));
    if (!asked) {
        list.splice(Math.min(position, list.length), 0, { text: t('Спросить про вора'), next: 'ask_thief' });
    }
    return list;
}

export const DIALOGUES = {
    // === СТАРОСТА — выдаёт задание + задаток + ПРИЁМ ИКОНЫ (раунд 21) ===
    elder_quest: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Староста Мирослав',
                text: 'Здравствуй, {address}. У нас беда! Ночью неизвестный вор забрался в церковь и украл чудотворную икону. Это наша главная святыня!',
                // Раунд 21: если икона у игрока — первым делом предлагаем её вернуть
                action: (scene) => {
                    const q = scene.registry.get('quest') || {};
                    const base = [
                        { text: t('Я помогу найти вора.'), next: 'b' },
                        { text: t('Расскажи подробнее.'), next: 'c' },
                        { text: t('Дай задаток за работу.'), next: 'ask_advance' },
                        { text: t('Извини, я спешу.'), end: true },
                    ];
                    const node = DIALOGUES.elder_quest.nodes.a;
                    node.choices = (q.stolenItemRecovered && !q.mainQuestDone)
                        ? [{ text: t('🏺 Вернуть икону!'), next: 'return_icon' }, ...base]
                        : base;
                },
                choices: [],
                choices_base: null,
            },
            b: {
                speaker: 'Староста Мирослав',
                text: 'Благодарю, {address}! Вор бежал из деревни, но куда именно — никто не знает. Спроси жителей, может, кто что видел. Или поищи следы за воротами. У тебя мало времени — вор может уйти далеко!',
                action: (scene) => {
                    const q = scene.registry.get('quest');
                    q.elderTalked = true;
                    q.currentObjective = 'Найди вора: спроси жителей или поищи следы за воротами';
                    ActionLog.add(scene.registry, 'Поговорил со старостой — получил задание найти вора.');
                },
                choices: [{ text: 'Я найду его!', end: true }],
            },
            c: {
                speaker: 'Староста Мирослав',
                text: 'Иконе более ста лет. Её написал монах-иконописец. Без неё деревня потеряла благословение. Вор был в тёмном плаще, среднего роста. Больше ничего не известно.',
                choices: [
                    { text: 'Я берусь за поиски.', next: 'b' },
                    { text: 'Подумаю.', end: true },
                ],
            },
            // Просьба о задатке (п.10)
            ask_advance: {
                speaker: 'Староста Мирослав',
                text: '...',
                action: (scene) => {
                    const r = askElderAdvance(scene.registry);
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_advance_result' },
                ],
            },
            ask_advance_result: {
                speaker: 'Староста Мирослав',
                text: '...',
                action: (scene) => {
                    const r = scene._lastAskResult;
                    if (r && r.message) {
                        // Текст уже в r.message
                    }
                },
                choices: [
                    { text: 'Спасибо. Я берусь за поиски.', next: 'b' },
                    { text: 'Понятно.', end: true },
                ],
            },
            // Раунд 21: возврат иконы старосте — награда и победа, игра продолжается
            return_icon: {
                speaker: 'Староста Мирослав',
                text: '...',
                action: (scene) => {
                    const r = surrenderStolenItem(scene.registry, 'elder');
                    scene._lastAskResult = {
                        message: r.success
                            ? `${t('Староста бережно принимает икону и осеняет себя крестом.')}\n${t('Награда')}: ${r.rewardText}`
                            : r.message,
                    };
                },
                choices: [{ text: t('(дальше)'), next: 'victory_continue' }],
            },
            victory_continue: {
                speaker: 'Староста Мирослав',
                text: '...',
                choices: [
                    { text: t('🏆 Продолжить игру (поручения жителей)'), end: true },
                    {
                        text: t('📜 Завершить поход и посмотреть итоги'),
                        action: (scene) => {
                            const q = scene.registry.get('quest');
                            q.runFinished = true;
                            ActionLog.add(scene.registry, 'Поход завершён по воле героя.');
                        },
                        end: true,
                    },
                ],
            },
            // Финальный узел после победы
            d: {
                speaker: 'Староста Мирослав',
                text: 'Ты вернул нашу святыню! Вся деревня у тебя в долгу. Прими нашу искреннюю благодарность и это благословение. (Здоровье и воля восстановлены)',
                action: (scene) => {
                    const p = scene.registry.get('player');
                    p.HP = p.HPmax;
                    p.MP = p.MPmax;
                    const q = scene.registry.get('quest');
                    q.currentObjective = 'Поход окончен. Икона возвращена!';
                },
                choices: [{ text: 'Слава Богу.', end: true }],
            },
        },
    },

    // === ТАВЕРНЩИК — новости + еда/рацион + можно попросить денег ===
    tavernkeeper: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Тавернщик Фёдор',
                text: 'Здравствуй, путник! Заходи, присаживайся. Хочешь поесть, попить или переночевать?',
                // Раунд 22: расспрос о воре — один раз за игру
                // Раунд 30 (пп.10–12): заказ еды и покупка рациона на день дороги
                action: (scene) => {
                    DIALOGUES.tavernkeeper.nodes.a.choices = withAskThief(scene, 'tavernkeeper', [
                        { text: t('🍲 Заказать еду (2 д.)'), next: 'meal' },
                        { text: t('🎒 Купить рацион на день дороги (2 д.)'), next: 'ration' },
                        { text: t('Что нового в деревне?'), next: 'b' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, я пойду.'), end: true },
                    ]);
                },
                choices: [],
            },
            // Раунд 30 (п.11): еда НЕМНОГО восстанавливает здоровье и занимает
            // РОВНО 1 ЧАС времени. Цена 2 деньги — по каталогу харчей
            // ChroniclesRuthenia: каравай ржаного хлеба (1 д.) + похлёбка (1 д.).
            meal: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                action: (scene) => {
                    const player = scene.registry.get('player');
                    const MEAL_PRICE = 2; // хлеб 1 д. + похлёбка 1 д. (FoodCatalog)
                    if ((player.dengas || 0) < MEAL_PRICE) {
                        scene._lastAskResult = { message: t('Фёдор качает головой: «Без денег и щи жидкие не варятся. Нужно 2 д.»') };
                        return;
                    }
                    player.dengas -= MEAL_PRICE;
                    const heal = 1 + Math.floor(Math.random() * 3); // немного: 1..3 HP
                    const before = player.HP;
                    player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                    scene.registry.set('player', player);
                    // Еда занимает 1 час времени (п.11) — вор тоже двигается
                    tickTime(scene.registry, 60);
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, t(`Заказал еду у хозяина постоялого двора (2 д.): +${player.HP - before} HP, прошёл час.`));
                    scene._lastAskResult = {
                        message: t('Фёдор ставит перед тобой миску горячих щей, краюху ржаного хлеба и кружку кваса. Ешь не спеша — силы понемногу возвращаются.') +
                            `\n\n✚ Здоровье: +${player.HP - before} HP (${before} → ${player.HP})\n⏳ ${t('Прошёл час времени — солнце сдвинулось по небу.')}` +
                            (scene.registry.get('quest')?.thiefEscaped ? '' : `\n⏳ ${t('Осталось действий')}: ${chaseTicksLeft(scene.registry)}`),
                    };
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            // Раунд 30 (п.12): РАЦИОН — еда и вода с собой НА ДЕНЬ ДОРОГИ.
            // Цена 2 деньги — точно по каталогу харчей ChroniclesRuthenia
            // (FoodCatalog.PROVISIONS): хлеб ржаной 1 д. + вода (бурдюк) 1 д.
            ration: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                action: (scene) => {
                    const player = scene.registry.get('player');
                    const RATION_PRICE = 2; // хлеб 1 д. + вода 1 д. (FoodCatalog)
                    if ((player.dengas || 0) < RATION_PRICE) {
                        scene._lastAskResult = { message: t('«Два дняги — цена хлеба да бурдюка воды. Без денег не выйдет», — говорит Фёдор.') };
                        return;
                    }
                    player.dengas -= RATION_PRICE;
                    player.inventory = player.inventory || [];
                    player.inventory.push({ id: 'ration', name: t('Рацион (хлеб да вода на день дороги)') });
                    scene.registry.set('player', player);
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, t('Купил рацион у хозяина постоялого двора (2 д.): хлеб и вода на день дороги.'));
                    scene._lastAskResult = {
                        message: t('Фёдор заворачивает в тряпицу тёплый каравай ржаного хлеба и наливает бурдюк чистой воды — еды и питья на день дороги.') +
                            `\n\n🎒 +1 ${t('Рацион (хлеб да вода на день дороги)')} · −2 д.` +
                            `\n💰 ${t('В кошеле')}: ${player.dengas} ${t('д.')}`,
                    };
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            b: {
                speaker: 'Тавернщик Фёдор',
                text: 'Слыхал, вор украл икону из церкви! Староста в отчаянии. А ещё говорят, что кто-то видел подозрительного человека в тёмном плаще у околицы. Но куда он побежал — никто толком не знает.',
                action: (scene) => {
                    DIALOGUES.tavernkeeper.nodes.b.choices = withAskThief(scene, 'tavernkeeper', [
                        { text: t('Спасибо за новости.'), end: true },
                    ]);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'tavernkeeper', 'Тавернщик Фёдор');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'tavernkeeper', 'Тавернщик Фёдор');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                choices: [
                    { text: 'Понятно, спасибо.', end: true },
                ],
            },
        },
    },

    // === КУЗНЕЦ — продажа оружия/брони + можно спросить про вора ===
    blacksmith: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Кузнец Данила',
                text: 'Здрав будь, воин! Моя кузница к твоим услугам. Нужно оружие или броня — открой меню «Купить оружие».',
                action: (scene) => {
                    DIALOGUES.blacksmith.nodes.a.choices = withAskThief(scene, 'blacksmith', [
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, я пойду.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Кузнец Данила',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'blacksmith', 'Кузнец Данила');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Кузнец Данила',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'blacksmith', 'Кузнец Данила');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Кузнец Данила',
                text: '...',
                choices: [
                    { text: 'Понятно, спасибо.', end: true },
                ],
            },
        },
    },

    // === МЕЛЬНИК АВДЕЙ (раунд 27, п.7: работал на мельнице днём) ===
    peasant1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Мельник Авдей',
                text: 'Здравствуй, путник. С утра до заката я на мельнице — жернова не ждут, зерно само не смелется. А тут ещё иконокража — никакого спасу от лихих людей!',
                action: (scene) => {
                    DIALOGUES.peasant1.nodes.a.choices = withAskThief(scene, 'peasant1', [
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Что с коровой?'), next: 'cow' },
                        { text: t('Про мельницу расскажи.'), next: 'mill' },
                        { text: t('Сочувствую. Прощай.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            mill: {
                speaker: 'Мельник Авдей',
                text: 'Мельница у нас ветряная — на пригорке стоит, крылья ветер крутит. Неси зерно — смелет и на муку, и на крупу. А старая водяная давно сломалась — ручей обмелел, колесо убрали.',
                action: (scene) => {
                    DIALOGUES.peasant1.nodes.mill.choices = withAskThief(scene, 'peasant1', [
                        { text: t('Спасибо за рассказ.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            cow: {
                speaker: 'Мельник Авдей',
                text: 'Корова моя Машка ушла со двора и не вернулась. Ищу по окрестностям, но никак не найду. Может, в лес ушла?',
                action: (scene) => {
                    DIALOGUES.peasant1.nodes.cow.choices = withAskThief(scene, 'peasant1', [
                        { text: t('Найдётся ваша корова.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Мельник Авдей',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'peasant1', 'Мельник Авдей');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Мельник Авдей',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'peasant1', 'Мельник Авдей');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Мельник Авдей',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },

    // === ПАСЕЧНИЦА МАРФА (раунд 27, пп.8,13) ===
    // Бывшая вдова — теперь пасечница: работает на пасеке, собирает травы.
    // У неё можно купить мёд (лечение, не более 3 раз в сутки, кулдаун 1 час).
    widow: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Пасечница Марфа',
                text: 'Здравствуйте, путник. Пчёлы мои нынче добрые — взяток славный. А ещё травы собираю — у озера, на реке, где найду. Нужен мёд — это ко мне.',
                action: (scene) => {
                    DIALOGUES.widow.nodes.a.choices = withAskThief(scene, 'widow', [
                        { text: t('🍯 Купить мёд (8 д.)'), next: 'honey' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Помолюсь с вами.'), next: 'pray' },
                        { text: t('Извините, я спешу.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            // Раунд 27 (п.13): мёд восстанавливает здоровье.
            // НЕ БОЛЕЕ 3 РАЗ В СУТКИ, кулдаун между приёмами — 1 час.
            honey: {
                speaker: 'Пасечница Марфа',
                text: '...',
                action: (scene) => {
                    const player = scene.registry.get('player');
                    const time = getTime(scene.registry);
                    // В timeState час — поле `hour`; кулдаун считаем в минутах
                    const hour = time ? (time.hour ?? 12) : 12;
                    const day = time ? (time.yearFromChrist * 372 + time.month * 31 + time.day) : 0;
                    const absMin = time ? (day * 1440 + hour * 60 + (time.minute || 0)) : 0;
                    const st = scene.registry.get('honey') || { day: -1, uses: 0, lastAbsMin: -999 };
                    if (st.day === day && st.uses >= 3) {
                        scene._lastAskResult = { message: t('Марфа качает головой: «Мёд — он как лекарство: три ложки в день, и довольно. Больше — не на пользу, а во вред. Приходи завтра».') };
                        return;
                    }
                    if (absMin - (st.lastAbsMin || -999) < 60) {
                        scene._lastAskResult = { message: t('«Не раньше, чем через час. Мёд силён, дай ему разойтись по крови», — говорит Марфа.') };
                        return;
                    }
                    if ((player.dengas || 0) < 8) {
                        scene._lastAskResult = { message: t('«Без денег мёд не дам, — строго говорит Марфа. — Горшочек трудом достаётся». (Нужно 8 д.)') };
                        return;
                    }
                    player.dengas -= 8;
                    const heal = 8;
                    const before = player.HP;
                    player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                    // Новый день — счётчик заново
                    if (st.day !== day) { st.day = day; st.uses = 0; }
                    st.uses += 1;
                    st.lastAbsMin = absMin;
                    scene.registry.set('honey', st);
                    scene.registry.set('player', player);
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, t(`Купил мёд у Марфы (8 д.): +${player.HP - before} HP. Съедено за сегодня: ${st.uses}/3.`));
                    scene._lastAskResult = { message: t('Марфа наливает полную ложку янтарного мёда. Тепло разливается по телу, силы возвращаются.') +
                        `\n\n✚ Здоровье: +${player.HP - before} HP (${before} → ${player.HP})\n🍯 За сегодня: ${st.uses}/3 — следующая ложка не раньше, чем через час.` };
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            pray: {
                speaker: 'Пасечница Марфа',
                text: 'Спаси вас Господь. Пусть хранит вас Пресвятая Богородица.',
                action: (scene) => {
                    DIALOGUES.widow.nodes.pray.choices = withAskThief(scene, 'widow', [
                        { text: t('Прощайте.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Пасечница Марфа',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'widow', 'Пасечница Марфа');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Пасечница Марфа',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'widow', 'Пасечница Марфа');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Пасечница Марфа',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },

    // === ПАХАРЬ ТАРАС (раунд 27, п.6; раунд 28 п.1: ПАХАРЬ, не пасечник!) ===
    beekeeper1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Пахарь Тарас',
                text: 'Мир тебе, путник! Ты в доме, где семеро детей — шумно, как ярмарка в торговый день. Сам-то я с сохой вожусь с рассвета: поле само себя не вспашет.',
                action: (scene) => {
                    DIALOGUES.beekeeper1.nodes.a.choices = withAskThief(scene, 'beekeeper1', [
                        { text: t('Расскажи о своей пашне.'), next: 'field' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Удачи тебе, Тарас.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            field: {
                speaker: 'Пахарь Тарас',
                text: 'Земля кормит того, кто её любит. С утра бороню, после обеда — рожь сею. Дети мне в подмогу: кто на выпас скот гоняет, кто рыбу ловит, кто грибы в лесу ищет. А мёд к чаю — у Марфы спрашивай: её пасека постарше, и мёд у неё целебный — здоровье ставит на ноги.',
                action: (scene) => {
                    DIALOGUES.beekeeper1.nodes.field.choices = withAskThief(scene, 'beekeeper1', [
                        { text: t('Спасибо за рассказ.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Пахарь Тарас',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'beekeeper1', 'Пахарь Тарас');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Пахарь Тарас',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'beekeeper1', 'Пахарь Тарас');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Пахарь Тарас',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },

    // === ФЁКЛА, ЖЕНА ПАХАРЯ (раунд 27, п.6; раунд 28: муж — пахарь) ===
    beekeeper_wife: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Фёкла',
                text: 'Заходи, путник, только тихо — малых только уложила. Нас с Тарасом Господь семерым детками благословил: крики в избе от зари до зари!',
                action: (scene) => {
                    // Раунд 30: Фёкла — возможный свидетель о воре (один раз)
                    DIALOGUES.beekeeper_wife.nodes.a.choices = withAskThief(scene, 'beekeeper_wife', [
                        { text: t('Как семья живёт?'), next: 'family' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Храни вас Бог.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            // Раунд 30: расспрос о воре — единожды (если Фёкла видела вора — расскажет)
            ask_thief: {
                speaker: 'Фёкла',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'beekeeper_wife', 'Фёкла');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            family: {
                speaker: 'Фёкла',
                text: 'Живём впроголодь, да дружно: Тарас с поля рожь приносит, я — огород да скотину. Старшие за младшими смотрят, а сам прибыльный — на выпас гоняют да в лес за грибами. Хлеб с молоком на столе — уже не бедность.',
                action: (scene) => {
                    DIALOGUES.beekeeper_wife.nodes.family.choices = [
                        { text: t('Доброго вам достатка.'), end: true },
                    ];
                },
                choices: [],
            },
            ask_money: {
                speaker: 'Фёкла',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'beekeeper_wife', 'Фёкла');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Фёкла',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },

    // === ЛЮБАВА, ЖЕНА СТАРОСТЫ (раунд 27, п.9) ===
    elder_wife: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Любава',
                text: 'Здравствуй, странник. Ты по делам к моему Мирославу? Он нынче по деревне ходит — дела смотрит, споры решает. А я в доме: печь, скотина, огород.',
                action: (scene) => {
                    // Раунд 30: Любава — возможный свидетель о воре (один раз)
                    DIALOGUES.elder_wife.nodes.a.choices = withAskThief(scene, 'elder_wife', [
                        { text: t('Как поживаете?'), next: 'husband' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, хозяйка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            // Раунд 30: расспрос о воре — единожды (если Любава видела вора — расскажет)
            ask_thief: {
                speaker: 'Любава',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'elder_wife', 'Любава');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            husband: {
                speaker: 'Любава',
                text: 'Староста он — воля деревенская. То с церковным старостой говорит, то стражу учит, то у колодца судит, кто чей телегой дорогу забил. Вечером придёт — отдохнём с ним за ужином.',
                action: (scene) => {
                    DIALOGUES.elder_wife.nodes.husband.choices = [
                        { text: t('Дай Бог вам здоровья.'), end: true },
                    ];
                },
                choices: [],
            },
            ask_money: {
                speaker: 'Любава',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'elder_wife', 'Любава');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Любава',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },

    // === СВЯЩЕННИК (Отец Савватий) — церковь ===
    priest: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Отец Савватий',
                text: 'Мир тебе, чадо. Что привело тебя в дом Божий? Может, хочешь исповедаться или помолиться?',
                // Раунд 21: если икона у игрока — предлагаем вернуть святыню церкви
                // Раунд 22: + благословение (п.11) и одноразовый расспрос (п.3)
                // Раунд 30 (п.8): при ПЕРВОМ диалоге батюшка КРАСОЧНО рассказывает
                // о краже иконы: вор — пришлый, как и игрок; сам он вора не видал,
                // но советует порасспросить селян — кто что видел и куда он бежал.
                action: (scene) => {
                    const q = scene.registry.get('quest') || {};
                    const node = DIALOGUES.priest.nodes.a;
                    const asked = (q.thiefAskedFrom || []).includes('priest');
                    const base = [
                        { text: t('Расскажи про украденную икону'), next: 'about_icon' },
                        ...(!asked ? [{ text: t('Спросить про вора'), next: 'ask_thief' }] : []),
                        { text: t('🙏 Попросить благословения'), next: 'blessing' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Помолиться'), next: 'pray' },
                        { text: t('Спасибо, батюшка.'), end: true },
                    ];
                    node.choices = (q.stolenItemRecovered && !q.mainQuestDone)
                        ? [{ text: t('🏺 Вернуть икону церкви!'), next: 'return_icon' }, ...base]
                        : base;
                    // ПЕРВЫЙ диалог — красочный рассказ о краже (только один раз)
                    if (!q.priestToldTheftStory && !q.mainQuestDone && !q.stolenItemRecovered) {
                        q.priestToldTheftStory = true;
                        scene.registry.set('quest', q);
                        node.text = t('Ох, горе нам, чадо... Ночью случилось дело великое: вор прокрался в храм Божий и выкрал чудотворную икону Богородицы из самого киота! Я молился в алтаре, свечи ещё теплились — и слыхал только, как скрипнула дверца. А под утро глянул: киот пуст, лишь лампада коптит и пыль на полу лежит, где святыня стояла.\n\nВидел я в церкви темного человека краем глаза, а разобрать не успел — мелькнёт и нет. Одно скажу точно: человек был ПРИШЛЫЙ, не из наших селян — одеждой и повадкой странник, такой же пришлый человек в деревне, как и ты, чадо.\n\nСам я лица его не разглядел и куда побежал — не видал, Бог миловал. Но в деревне народ разный ходит, всякий на виду: кто у колодца зорит, кто на выпас глядит во все стороны. Может, кто-то из селян и видел вора — куда он бежал да где нынче прячется. ПОРАСПРОСИ ЛЮДЕЙ, чадо: спроси каждого о воре и о том, куда он мог податься. Господь путь укажет, а люди — подскажут.');
                        ActionLog.add(scene.registry, t('Первый разговор с батюшкой: он рассказал о краже иконы и посоветовал расспросить селян.'));
                    } else {
                        node.text = t('Мир тебе, чадо. Что привело тебя в дом Божий? Может, хочешь исповедаться или помолиться?');
                    }
                },
                choices: [],
            },
            // Раунд 22 (п.11): благословение — +10% к ШАНСАМ ОДНОЙ проверки навыка
            // (поиска следов, расспроса, убеждения, оглушения или удара в бою).
            blessing: {
                speaker: 'Отец Савватий',
                text: '...',
                action: (scene) => {
                    const q = scene.registry.get('quest') || {};
                    if (q.blessing) {
                        scene._lastAskResult = { message: t('Батюшка качает головой: «Ты уже под защитой Господней, чадо. Благословение исполнится при первом же испытании — не гневи Боженьку жадностью.»') };
                        return;
                    }
                    q.blessing = true;
                    scene.registry.set('quest', q);
                    // Молитва занимает время — вор тоже двигается
                    tickTime(scene.registry, 15);
                    // Раунд 24: тихая молитва и колокол при благословении
                    if (scene.audioManager) {
                        scene.audioManager.playPrayerChant();
                    }
                    scene._lastAskResult = { message: t('Батюшка кладёт руку тебе на голову и шепчет молитву. Тепло разливается по плечам.\n\n✨ Благословение: СЛЕДУЮЩАЯ проверка навыка (следы, расспрос, убеждение, оглушение или удар) пройдёт с +10 к шансу — но только одна!') };
                    ActionLog.add(scene.registry, t('Получил благословение в церкви: +10 к одной проверке навыка.'));
                },
                choices: [
                    { text: t('Аминь.'), next: 'ask_result' },
                ],
            },
            // Раунд 21: возврат иконы священнику — награда и победа, игра продолжается
            return_icon: {
                speaker: 'Отец Савватий',
                text: '...',
                action: (scene) => {
                    const r = surrenderStolenItem(scene.registry, 'priest');
                    scene._lastAskResult = {
                        message: r.success
                            ? `${t('Батюшка принимает икону; на его лице слёзы радости. Святыня снова в киоте!')}\n${t('Награда')}: ${r.rewardText}`
                            : r.message,
                    };
                },
                choices: [{ text: t('(дальше)'), next: 'victory_continue' }],
            },
            victory_continue: {
                speaker: 'Отец Савватий',
                text: '...',
                choices: [
                    { text: t('🏆 Продолжить игру (поручения жителей)'), end: true },
                    {
                        text: t('📜 Завершить поход и посмотреть итоги'),
                        action: (scene) => {
                            const q = scene.registry.get('quest');
                            q.runFinished = true;
                            ActionLog.add(scene.registry, 'Поход завершён по воле героя.');
                        },
                        end: true,
                    },
                ],
            },
            about_icon: {
                speaker: 'Отец Савватий',
                text: 'Ох, горе нам, {address}! Ночью вор забрался в церковь и украл чудотворную икону Богородицы Одигитрии. Ей более ста лет, её написал монах-иконописец из Киево-Печерской лавры. Без неё деревня потеряла благословение Божье. Найди вора и верни святыню! Возьми задание у меня, если хочешь помочь.',
                action: (scene) => {
                    const q = scene.registry.get('quest');
                    q.elderTalked = true; // отмечаем, что игрок узнал о краже
                    q.currentObjective = 'Найди вора: спроси жителей или поищи следы за воротами';
                    ActionLog.add(scene.registry, 'Поговорил с батюшкой о краже иконы.');
                },
                choices: [{ text: 'Я найду её, батюшка!', end: true }],
            },
            ask_thief: {
                speaker: 'Отец Савватий',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'priest', 'Отец Савватий');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Отец Савватий',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'priest', 'Отец Савватий');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            pray: {
                speaker: 'Отец Савватий',
                text: 'Помолимся вместе, чадо. Господи, помилуй и сохрани раба Твоего...',
                action: (scene) => {
                    const p = scene.registry.get('player');
                    p.MP = Math.min(p.MPmax, p.MP + 2);
                    ActionLog.add(scene.registry, 'Помолился в церкви (+2 MP).');
                },
                choices: [{ text: 'Аминь.', end: true }],
            },
            ask_result: {
                speaker: 'Отец Савватий',
                text: '...',
                choices: [
                    { text: 'Спасибо, батюшка.', end: true },
                ],
            },
        },
    },
};

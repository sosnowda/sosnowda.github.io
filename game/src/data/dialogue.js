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
                    // Раунд 31 (пп.11,12): час списывается при закрытии беседы
                    // (трапеза — внутри того же часа разговора с хозяином)
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, t(`Заказал еду у хозяина постоялого двора (2 д.): +${player.HP - before} HP.`));
                    scene._lastAskResult = {
                        message: t('Фёдор ставит перед тобой миску горячих щей, краюху ржаного хлеба и кружку кваса. Ешь не спеша — силы понемногу возвращаются.') +
                            `\n\n✚ Здоровье: +${player.HP - before} HP (${before} → ${player.HP})\n⏳ ${t('Трапеза пройдёт в тот час, что уйдёт на беседу с хозяином.')}` +
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
                text: 'Заходи, путник, только тихо — малых только уложила. Нас с Тарасом Господь семерыми детками благословил: крики в избе от зари до зари!',
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
                    // Раунд 31: час на беседу с батюшкой списывается при закрытии
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
                text: 'Ох, горе нам, {address}! Ночью вор забрался в церковь и украл чудотворную икону Богородицы Одигитрии. Ей более ста лет, её написал монах-иконописец Печерского монастыря. Без неё деревня потеряла благословение Божье. Найди вора и верни святыню! Возьми задание у меня, если хочешь помочь.',
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

    // ============================================================
    // === ДЕТСКИЕ ДИАЛОГИ (раунд 34, заявка владельца) ===
    // Семеро детей пахаря Тараса (5–12 лет): у каждого свой характер,
    // темы — забавы, колокольный звон по службам, чужие края; дети тоже
    // могут оказаться свидетелями вора (мелкий гость видел больше всех).
    // Каждый узел несёт en-перевод (DialogueRunner выбирает по языку).
    // ============================================================

    // --- kid1: ПРОНЬКА (12) — старший, гоняет скот, важничает ---
    kid1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'А я у бати старший помощник! Скотину гоняю — и на выпас, и на водопой. Вот вырасту — к старосте в конюхи пойду: у него конь сытый, по бокам лоснится! А ты кто, путник? Далёко ли идёшь?',
                en: 'I am Father\'s eldest helper! I drive the herd — to pasture and to water. When I grow up I\'ll be the elder\'s stable-boy: his horse is sleek and glossy on both flanks! And who are you, wayfarer? Do you travel from afar?',
                action: (scene) => {
                    DIALOGUES.kid1.nodes.a.choices = withAskThief(scene, 'kid1', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'Мы рюхами бьёмся: кто больше бабок выбьет, тот и мошну собрал. А в жмурки да салочки — я всегда первый! Ну... почти всегда. Сенька вон быстрей, да он по лесу за белкиными орехами бегает — вот ноги и разгоняются!',
                en: 'We play rukhi: whoever knocks down the most knucklebones wins the pot. And blind-man\'s buff and chase — I am always first! Well... almost always. Senka is faster — he roams the woods after squirrel nuts, no wonder his legs are so quick!',
                choices: [
                    { text: t('И кто же победил?'), next: 'games2' },
                ],
            },
            games2: {
                speaker: 'ребёнок',
                text: 'Я победил, кого ж ещё! А как дождь пойдёт — так и игра: кто раньше до овина добежит. Я раньше всех. Прибежал — а там старший брат батиных снопов навалил... Так я первым и высох!',
                en: 'I won, who else! And when the rain starts — a new game: whoever reaches the barn first. I got there first — and found Father\'s elder sons had piled up their sheaves inside. So I was the first to dry out, too!',
                choices: [
                    { text: t('Ну-ну, ври дальше.'), end: true },
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Колокол? Я на колокольню лазил — только дядька Лука спалил меня! Благовест звонят спозаранку, к заутрене. В полдень — к обедне, как шестой час бить. А как к вечеру — вечерню звонят. А трезвон — это когда во ВСЕ колокола разом: весело так, аж в ушах звенит!',
                en: 'The bell? I climbed the bell-tower — only uncle Luka caught me! The toll rings at first light, for Matins. At noon — for the Liturgy, when the sixth hour strikes. And toward evening — for Vespers. And the peal is when ALL the bells ring together: so merry your ears ring too!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'Батя на ярмарку в город ездил — говорит, там палаты каменные, а колоколов больше, чем у нас овец! А ещё там переулки кривые, кто раз заблудился — до сей поры, может, бродит. Ты правда издалека? А в городе купцы правда мёд пьют вместо воды?',
                en: 'Father went to the fair in town — he says there are stone mansions there, and more bells than we have sheep! And the lanes are crooked: whoever got lost once may still be wandering. Did you really come from far away? Do merchants in town truly drink honey instead of water?',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid1', t('мальчик'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // --- kid2: ГОРПИНА (11) — сплетница, первая во всех новостях ---
    kid2: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'Ой, путник! А ты слыхал? У старосты корова на разные голоса мычит — я сама слышала! А ещё Степанида всю бражку съела, сама призналась, я первая узнала! Ты не гордый? Сядь рядышком, я тебе ещё новостей скажу!',
                en: 'Oh, wayfarer! Have you heard? The elder\'s cow moos in different voices — I heard it myself! And Stepanida ate all the mash, she confessed it herself, I was the first to know! Are you proud? Sit down beside me, I have more news to tell!',
                action: (scene) => {
                    DIALOGUES.kid2.nodes.a.choices = withAskThief(scene, 'kid2', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'Мы с девчонками куколок из соломы вяжем да в «колечко» играем. А мальчишек не берём — они врут, что мы медлим! А я лучшая: у меня куколка с косой из льна, как настоящая, только говорить не умеет. Пока.',
                en: 'We girls weave straw dolls and play "the ring". We don\'t take the boys — they lie that we dawdle! And I am the best: my doll has a flax braid like a real one, except she can\'t talk. Yet.',
                choices: [
                    { text: t('Возьми конфетку.'), end: true },
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Это дядька Лука звонит, он у нас звонарь. По звону и узнаём всё: редкий-мерный звон — благовест, значит, служба скоро, народ собирается. А частый-весёлый — трезвон, значит, уже началось! Мамка говорит: благовест на три версты слышно. На ЧЕТЫРЕ слышно, я проверяла!',
                en: 'Uncle Luka rings — he is our bell-ringer. The ringing tells us everything: the slow measured toll is the blagovest — the service is near, folk are gathering. The fast merry one is the trezvon — it has already begun! Mother says the toll carries three versts. It carries FOUR, I have checked!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'Тётка Марфа говорила: за озером травы раньше зацветают, а в лесу-то волки... Ты правда издалека? В городе хлеб белый дают? А у нас хлеб белый только на Пасху. Ты не кумекай, что я много спрашиваю: я первая во всех новостях, мне положено!',
                en: 'Aunt Marfa said: beyond the lake the herbs bloom earlier, and the forest has wolves... Did you truly come from far away? Do they give you white bread in town? We only have white bread at Easter. Don\'t mind my asking so much: I am first in all the news, it is my duty!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid2', t('девочка'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // --- kid3: СЕНЬКА (9) — грибник-хвастун ---
    kid3: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'Смотри, сколько грибов набрал! Вон грузди, вон рыжики! Я один ходил, честно! Ну... почти один. Тузик со мной был — это собака, она не считается! Грибы я знаю лучше всех в деревне, даже лучше тётки Марфы, только она не признаёт.',
                en: 'Look how many mushrooms I gathered! There — milk-caps, there — orange-caps! I went all alone, honestly! Well... almost alone. Tuzik was with me — he\'s a dog, dogs don\'t count! I know mushrooms better than anyone in the village, even better than aunt Marfa, she just won\'t admit it.',
                action: (scene) => {
                    DIALOGUES.kid3.nodes.a.choices = withAskThief(scene, 'kid3', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 2);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'А мы в прятки! Я в овин сел — меня до заката не нашли, каша стыла! А ещё я знаю, где белки орехи прячут. Только не скажу. Ну, если махнешь печёной репки — скажу!',
                en: 'And we play hide-and-seek! I hid in the barn — they couldn\'t find me till sunset, the porridge went cold! And I know where the squirrels hide their nuts. But I won\'t tell. Well... if you toss me a baked turnip, I will!',
                choices: [
                    { text: t('Чур, не выдумывай!'), next: 'games2' },
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            games2: {
                speaker: 'ребёнок',
                text: 'Не вру! Я хоть маленький, а слово держу. Вот пойдёшь в лес за грибами — и увидишь: на старой сосне дупло, а в дупле — орехов целая горка. Это белкины запасы. Я взял всего горсть! Чуть-чуть. Самую малость...',
                en: 'I\'m not lying! I may be small but I keep my word. Go mushrooming in the forest and you\'ll see: there\'s a hollow in the old pine, and in the hollow — a whole heap of nuts. The squirrels\' stores. I took just one handful! A tiny one. The very smallest...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Как благовест услыху — так домой: мамка велела, значит, обедня скоро, надо печку топить да мойся. А в понедельник не звонят... почему-то. Дядька Лука, поди, отдыхает. А как трезвон — с берёзы листья сыплются! Сам видел!',
                en: 'The moment I hear the toll — I go home: Mother says the Liturgy is soon, I must heat the stove and wash up. And on Mondays there\'s no ringing... for some reason. Uncle Luka must be resting. And when the peal rings — the birch drops its leaves! I saw it myself!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'В лесу за чащей — волчье логово, мне охотник сказывал! Ты волков видал? Настоящих? А я больше в лес не хожу... то есть хожу, но теперь с рогатиной! Палка — это тоже рогатина, если уметь держать.',
                en: 'Beyond the thickets lies a wolves\' den — the hunter told me! Have you seen wolves? Real ones? I don\'t go to the forest anymore... that is, I do, but now with a boar spear! A stick is also a spear, if you know how to hold it.',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid3', t('мальчик'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // --- kid4: АКУЛЬКА (8) — мечтательная, боится козла Прохора ---
    kid4: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'На выпасе козёл Прохор меня бодает. Злой очень! Я ему травку несу, а он всё равно... А у тебя есть свой козёл? Нет? А зачем же ты тогда пришёл? Ой, ты путник! А я думала — новый пастух.',
                en: 'On the pasture the goat Prokhor butts me. Very mean! I bring him grass, and he still... Do you have a goat of your own? No? Then why did you come? Oh — you\'re a wayfarer! And I thought you were the new herder.',
                action: (scene) => {
                    DIALOGUES.kid4.nodes.a.choices = withAskThief(scene, 'kid4', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 2);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'Я веночки плету да песни пою. А мальчишки бегают грязные, я с ними не играю... Ну, иногда играю. В салочки. Недолго. Чтобы мамка не видела, что я по колено в лужах — она любит чистоту, а лужи этого не уважают.',
                en: 'I weave wreaths and sing songs. The boys run about dirty, I don\'t play with them... Well, sometimes I do. A game of chase. Not for long. So Mother doesn\'t see me knee-deep in puddles — she loves cleanliness, and puddles don\'t respect that.',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Мамка говорит: колокол — Божий голос. Коли звонит — стало быть, пора молиться да хлебы печь. Я люблю трезвон: птицы с крыши так и взлетают, словно снегири! А благовест тихий — красивый. Слушаешь — и не страшно в темноте.',
                en: 'Mother says: the bell is God\'s voice. When it rings — it is time to pray and bake bread. I love the peal: the birds burst off the roof like bullfinches! And the toll is quiet — beautiful. When you listen to it, the dark isn\'t frightening.',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'Птицы улетают за море... а что там, за морем? А ты там был? А расскажи! Только не ври: я знаю, как врать, — сама умею. У вруна уши красные, а у тебя не красные. Значит, пока не врёшь.',
                en: 'The birds fly away across the sea... and what lies beyond the sea? Have you been there? Tell me! But don\'t lie: I know what lying looks like — I can do it myself. A liar\'s ears turn red, and yours are not red. So you\'re not lying yet.',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid4', t('девочка'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // --- kid5: ДАНЬКА (7) — рыбак-неудачник, озорной ---
    kid5: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'Улов покажешь? А то у меня ни одной рыбки не клюнуло! Весь день просидел! Ну... полдня. Часа два. Да оно и неважно! Места-то лучшие занял, после меня уже никто не сядет — омут мой!',
                en: 'Show me your catch? Not a single fish bit for me! I sat there all day! Well... half a day. Two hours. But it doesn\'t matter! I took the best spot — nobody sits there after me — the pool is mine!',
                action: (scene) => {
                    DIALOGUES.kid5.nodes.a.choices = withAskThief(scene, 'kid5', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'А я камешки с мостков кидаю — у меня дальше всех! Честно! Ну, после Сеньки. Сенька — жулик, он до нас родился, потому и старше! А ещё я лягушек ловлю. Мамка кричит: «Брось эту мерзость!» А лягушка — не мерзость, она пища для аиста!',
                en: 'I skip stones off the footbridge — mine fly farthest! Honestly! Well, after Senka. Senka is a rogue — he was born before us, that\'s why he\'s older! And I catch frogs. Mother shouts: "Drop that nasty thing!" A frog isn\'t nasty — it\'s food for the stork!',
                choices: [
                    { text: t('Покажи, как играешь.'), next: 'games2' },
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            games2: {
                speaker: 'ребёнок',
                text: 'Вот смотри: боком так — раз! Камешек три раза прыгнул, как жаба! Учишься, путник? Локоть выше, палец вот так... Ух, и намаешься, пока выучишь. Я с прошлого лета учусь — зато теперь все девчонки смотрят!',
                en: 'Look: sideways like this — there! The stone hopped thrice, like a toad! Learning, wayfarer? Elbow higher, finger like so... Phew, you\'ll toil before you master it. I\'ve been learning since last summer — but now all the girls watch!',
                choices: [
                    { text: t('И кто же победил?'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Это дядька Лука звонит, у него колотушка с кожей! Как благовест — я рыбу из воды тяну: рыба-то тоже слушает, ей не до червяка! Дядька Сила говорит: «Как звон — рыба спит». А я говорю: как звон — я обедать!',
                en: 'Uncle Luka rings — he has a beater with leather! When the toll sounds I pull the fish out of the water: the fish listens too, it has no time for worms! Uncle Sila says: "When the bell rings, the fish sleeps." And I say: when the bell rings — I go to dinner!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'А в реке за омутом — сом! Водяной его стережёт, дядька Сила говорил! Ты сильный? А мог бы сома вытащить? Я бы помог! Ну, кричать буду: «Держи его!». И удочку держать. Вдвоём-то оно не так страшно... то есть не так трудно!',
                en: 'Beyond the pool in the river lives a sheatfish! The water-spirit guards it, uncle Sila said. Are you strong? Could you pull a sheatfish out? I would help! Well... I\'d be shouting: "Hold it!" And holding the rod. With two of us it\'s not so scary... that is, not so hard!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid5', t('мальчик'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // --- kid6: МАШУТКА (6) — пословичная, всё повторяет за взрослыми ---
    kid6: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'Батя говорит: кто поле любит, того и земля кормит. А мамка говорит: не суйся в лужу, обуй валенки. А я говорю: хочу в лужу! Вот и весь уговор. А ты кто? Ты большой. Большим всё можно, да?', 
                en: 'Father says: who loves the field, the earth feeds. And Mother says: don\'t step in the puddle, put on your felt boots. And I say: I want the puddle! That\'s the whole bargain. And who are you? You\'re big. Big folk can do anything, can\'t they?',
                action: (scene) => {
                    DIALOGUES.kid6.nodes.a.choices = withAskThief(scene, 'kid6', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 2);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'Мне сестрёнки косички плетут, а я хочу в городки! Мне не дают... А я украдкой играл, и меня в лужу столкнули. За то и столкнули! За городки. А я не заплакала. Почти не заплакала.',
                en: 'My sisters braid my hair, but I want to play rukhi! They won\'t let me... And I played on the sly, and they pushed me into a puddle. That\'s why they pushed me! For the rukhi. And I didn\'t cry. I almost didn\'t cry.',
                choices: [
                    { text: t('Покажи, как играешь.'), next: 'games2' },
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            games2: {
                speaker: 'ребёнок',
                text: 'Берёшь палку и бьёшь по рюхе! БАБАХ! Рюхи разлетаются, все кричат... Это дядька Демид сказал, что так играют взрослые. Я пока по лужам бью ладошкой. Тоже БАБАХ, только мокрый!',
                en: 'You take a stick and strike the knucklebone! WHAM! The bones scatter, everyone shouts... Uncle Demid said grown folk play like that. For now I strike puddles with my palm. Also WHAM, only a wet one!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Коли звонят — надо в избе затихнуть, мамка так сказала. Длинный звон — это батюшка зазывает, а быстрый — праздник! Ещё я умею голосом: дзынь-дзынь! Только тихонько, а то мамка: «Машутка, не гуди!»',
                en: 'When the bell rings we hush in the izba — Mother said so. The long toll is the priest calling, and the fast one is a feast! And I can do it with my voice: ding-ding! Only quietly, or Mother goes: "Mashutka, don\'t ring!"',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'Дядька Авдей сказал: у мельницы ручей быстрый. А где ручей кончается — не знаю. А ты знаешь, где ручей кончается? А море? А почему трава зелёная? А почему коза бодается? У тебя много ответов? У бати много ответов, а всё не все!',
                en: 'Uncle Avdey said the stream runs fast by the mill. But where the stream ends — I don\'t know. Do you know where the stream ends? And the sea? And why is grass green? And why does the goat butt? Do you have many answers? Father has many answers, but not all of them!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid6', t('девочка'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // --- kid7: ВАНЮШКА (5) — самый младший, гуляка ---
    kid7: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'А я раньше бати с поля прибежал! Честно-пречестно! ...Ну, после обеда прибежал. Батя сказал: ступай, малой, не мешай сохе сохать. Соха — она вот такая большая, а я ещё больше! Потом вырасту.',
                en: 'And I came back from the field before Father! Honest-honest! ...Well, after dinner. Father said: off you go, little one, don\'t hinder the plough from ploughing. A plough is THIS big, and I\'m even bigger! When I grow up, that is.',
                action: (scene) => {
                    DIALOGUES.kid7.nodes.a.choices = withAskThief(scene, 'kid7', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('А за околицей что?'), next: 'world' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'Я в догонялки! Меня все ловят, потому что я самый ловкий! Или самый маленький... А шишки я собираю! Большие! Вот такие! Это еловые. Их нельзя есть, я проверял.',
                en: 'I play chase! Everybody catches me because I\'m the quickest! Or the smallest... And I collect pinecones! Big ones! Like THIS! Those are spruce ones. You can\'t eat them, I checked.',
                choices: [
                    { text: t('Возьми конфетку.'), end: true },
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Дзынь! Это колокол! Мамка на руки берёт и говорит: «Слушай, малой, к обедне звонят». А я умею как колокол: дзыыынь! Только громко нельзя, у меня живот. У колокола тоже живот был бы, он бы тоже не звонил!',
                en: 'Ding! That\'s the bell! Mother picks me up and says: "Listen, little one — they\'re ringing for the Liturgy." And I can do the bell: diiing! But not too loud, I have a tummy. If the bell had a tummy too, it wouldn\'t ring either!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            world: {
                speaker: 'ребёнок',
                text: 'А ты большой! Вот вырасту — тоже буду большой, пойду в город и... и... ну, за бабкой пойду! Бабка за яйцами ходит, я с ней. А ты за кем ходишь? У тебя есть своя бабка? А можно вашу? Хи!',
                en: 'You\'re big! When I grow up I\'ll be big too, and go to town and... and... well, I\'ll go with Granny! Granny goes for eggs, I go with her. And who do you walk with? Do you have your own granny? Can I have yours? Hee!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid7', t('мальчик'));
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'ребёнок',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },
};

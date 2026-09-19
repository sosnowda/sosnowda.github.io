// Дерево диалогов. Каждый узел: speaker, text, choices[].
// choice: { text, next?, end?, action? } — action(scene) выполняется при выборе.
// Действия обращаются к сцене через scene.registry и scene.autosave().
// Раунд 30: священник при ПЕРВОМ диалоге красочно рассказывает о краже иконы
// и советует порасспрашивать селян; у хозяина постоялого двора можно
// ЗАКАЗАТЬ ЕДУ (+здоровье, 1 час времени) и КУПИТЬ РАЦИОН на день дороги.
// Цены — из репозитория игры ChroniclesRuthenia (FoodCatalog/RestService):
//   хлеб ржаной (каравай) — 1 деньга, вода (бурдюк) — 1 деньга;
//   постоялый двор — 2 деньги с человека за ночь.

import { askNPC, askElderAdvance, askMoneyForHelp, surrenderStolenItem, checkGameEnd, chaseTicksLeft, inheritThiefKnowledge } from './thief.js';
import { ActionLog } from './actionLog.js';
import { tickTime, getTime } from '../systems/TimeSystem.js';
import { t, tf } from '../systems/i18n.js';
// Раунд 45 (пп.5,6 заявки): староста мирит игрока с разозлёнными НПЦ за виру
// Раунд 46 (п.4): со СТАРОСТОЙ всегда можно помириться (getViraCandidates)
import { getViraCandidates, calculateVira, payViraToElder } from './reputation.js';

/**
 * Раунд 22 (п.3): повторный расспрос того же NPC НЕВОЗМОЖЕН.
 * Если NPC уже расспрашивали о воре — выбор «Спросить про вора»
 * не показывается: за новыми наводками нужно идти к другим людям.
 */
function withAskThief(scene, npcId, others, position = 1) {
    const q = scene.registry.get('quest') || {};
    // Раунд 47 (п.2 заявки): наводка НЕ пропадает со смертью кузнеца —
    // его знание наследует ученик (мастер убирается из «уже расспрашивали»,
    // опция «Спросить про вора» снова появляется — уже от имени ученика).
    if (npcId === 'blacksmith') inheritThiefKnowledge(scene.registry);
    // Опция скрыта, если рассказывал сам мастер — ИЛИ уже ученик
    // (его собственная запись 'apprentice', раунд 47)
    const askedList = q.thiefAskedFrom || [];
    const asked = askedList.includes(npcId)
        || (npcId === 'blacksmith' && askedList.includes('apprentice'));
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
                en: 'Greetings, {address}. We are in trouble! In the night an unknown thief crept into the church and stole the wonderworking icon. It is our chief holy treasure!',
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
                    // Раунд 45 (п.5 заявки): есть разозлённые НПЦ — староста
                    // может их примирить с игроком за виру по Судебнику.
                    // Раунд 46 (п.4): СО СТАРОСТОЙ помириться можно ВСЕГДА —
                    // он берёт виру и за собственную обиду (getViraCandidates).
                    if (getViraCandidates(scene.registry).length > 0) {
                        base.unshift({ text: t('🤝 Просить мира (вира по Судебнику)'), next: 'vira_hub' });
                    }
                    node.choices = (q.stolenItemRecovered && !q.mainQuestDone)
                        ? [{ text: t('🏺 Вернуть икону!'), next: 'return_icon' }, ...base]
                        : base;
                },
                choices: [],
                choices_base: null,
            },
            // ================================================================
            // Раунд 45 (пп.5,6 заявки): ВИРА ПО СУДЕБНИКУ — староста как
            // судья-посредник смывает обиду серебром. Расчёт: вира за кровь
            // свободного мужа 40 гривен / полувирье за женщину (по 2 д. за
            // гривну) + «продажа» суду 20 д.; за разбой без свады — вдвое.
            // После выплаты репутация НПЦ УЛУЧШАЕТСЯ ДО +30.
            // ================================================================
            vira_hub: {
                speaker: 'Староста Мирослав',
                text: '...',
                action: (scene) => {
                    // Раунд 46 (п.4): список кандидатов включает и САМОГО СТАРОСТУ,
                    // если у него есть обида на героя (репутация < +30)
                    const hostiles = getViraCandidates(scene.registry);
                    const node = DIALOGUES.elder_quest.nodes.vira_hub;
                    if (hostiles.length === 0) {
                        node.text = t('Староста разводит руками: «На тебя никто больше не в ярости — мирить некого. Спасибо Судебнику!»');
                        node.choices = [{ text: t('Слава Богу.'), end: true }];
                        return;
                    }
                    node.text = t('Староста листает Судебник: «Обида смывается серебром. Вира за кровь свободного мужа — 40 гривен (80 д.), за женщину или отрока — полувирье (40 д.), да продажа мне за суд — 20 д. За разбой без всякой свады — всё вдвое. Плати — и обиженный тебя простит (репутация станет +30).»') +
                        '\n\n' + hostiles.map(h => tf(
                            h.isElder
                                ? t('• {0} — обида на тебя (репутация {1}), вира {2} д.')
                                : t('• {0} — в ярости (репутация {1}), вира {2} д.'),
                            h.name, h.rep, h.vira)).join('\n');
                    const choices = hostiles.slice(0, 6).map(h => ({
                        text: tf(t('🤝 Мириться с {0} ({1} д.)'), h.name, h.vira),
                        action: (sc) => { sc._viraNpcId = h.id; },
                        next: 'vira_pay',
                    }));
                    choices.push({ text: t('Пока не помирюсь.'), end: true });
                    node.choices = choices;
                },
                choices: [],
            },
            vira_pay: {
                speaker: 'Староста Мирослав',
                text: '...',
                action: (scene) => {
                    const npcId = scene._viraNpcId;
                    const r = payViraToElder(scene.registry, npcId);
                    scene._lastAskResult = { message: r.message };
                    const node = DIALOGUES.elder_quest.nodes.vira_pay;
                    const hostiles = getViraCandidates(scene.registry);
                    const choices = [];
                    if (hostiles.length > 0) {
                        choices.push({ text: t('🤝 Просить мира ещё'), next: 'vira_hub' });
                    }
                    choices.push({ text: t('Спасибо, староста.'), end: true });
                    node.choices = choices;
                },
                choices: [],
            },
            b: {
                speaker: 'Староста Мирослав',
                text: 'Благодарю, {address}! Вор бежал из деревни, но куда именно — никто не знает. Спроси жителей, может, кто что видел. Или поищи следы за воротами. У тебя мало времени — вор может уйти далеко!',
                en: 'Thank you, {address}! The thief fled the village, but where to — nobody knows. Ask the villagers; maybe someone saw something. Or look for tracks beyond the gate. You have little time — the thief may get far away!',
                action: (scene) => {
                    const q = scene.registry.get('quest');
                    q.elderTalked = true;
                    // Раунд 43 (п.3): в баннере над деревней — только короткий статус.
                    q.currentObjective = 'Найди вора.';
                    ActionLog.add(scene.registry, 'Поговорил со старостой — получил задание найти вора.');
                },
                choices: [{ text: t('Я найду его!'), end: true }],
            },
            c: {
                speaker: 'Староста Мирослав',
                text: 'Иконе более ста лет. Её написал монах-иконописец. Без неё деревня потеряла благословение. Вор был в тёмном плаще, среднего роста. Больше ничего не известно.',
                en: 'The icon is more than a hundred years old. A monk-icon-painter wrote it. Without it the village loses God\'s blessing. The thief wore a dark cloak and was of middling height. Nothing else is known.',
                choices: [
                    { text: t('Я берусь за поиски.'), next: 'b' },
                    { text: t('Подумаю.'), end: true },
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
                    { text: t('(продолжить)'), next: 'ask_advance_result' },
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
                    { text: t('Спасибо. Я берусь за поиски.'), next: 'b' },
                    { text: t('Понятно.'), end: true },
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
                    {
                        text: t('🏆 Продолжить игру (поручения жителей)'),
                        // Раунд 36: репутационная победа (+100) открывается ТОЛЬКО
                        // после прохождения «обучалки» с поимкой вора и возвратом
                        // иконы (mainQuestDone) и ТОЛЬКО выбором «Продолжить игру».
                        action: (scene) => {
                            const q = scene.registry.get('quest');
                            if (q && q.mainQuestDone && !q.repVictoryArmed) {
                                q.repVictoryArmed = true;
                                ActionLog.add(scene.registry, t('Герой остался в деревне — добрые дела теперь в его воле.'));
                            }
                        },
                        end: true,
                    },
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
                en: 'You have returned our holy treasure! The whole village is in your debt. Accept our heartfelt thanks and this blessing. (Health and Will are restored)',
                action: (scene) => {
                    const p = scene.registry.get('player');
                    p.HP = p.HPmax;
                    p.MP = p.MPmax;
                    const q = scene.registry.get('quest');
                    // Раунд 43 (п.2): квест окончен — баннер цели гаснет.
                    q.currentObjective = '';
                },
                choices: [{ text: t('Слава Богу.'), end: true }],
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
                en: 'Welcome, traveller! Come in and sit yourself down. Will you eat, drink, or lodge for the night?',
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
                en: 'Have you heard? A thief stole the icon from the church! The village elder is in despair. And they say someone saw a suspicious fellow in a dark cloak by the outskirts. But where he ran off to — nobody rightly knows.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                choices: [
                    { text: t('Понятно, спасибо.'), end: true },
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
                en: 'Good health to you, warrior! My smithy is at your service. Need a weapon or armor? Open the "Buy weapons" menu.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Кузнец Данила',
                text: '...',
                choices: [
                    { text: t('Понятно, спасибо.'), end: true },
                ],
            },
        },
    },

    // === Раунд 46 (п.1 заявки): УЧЕНИК КУЗНЕЦА ===
    // Встаёт к горну после гибели кузнеца. Делает всё то же самое, что и
    // мастер (торговля в кузнице, наводки о воре — знания ученика), но он
    // МОЛОЖЕ и СЛАБЕЕ (боевые параметры — VILLAGER_COMBAT.apprentice).
    apprentice: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Ученик кузнеца',
                text: 'Здрав будь, путник. Мастер мой... увы, покинул мир живых. Теперь у горна я: молот тяжёл, да руки крепнут. Нужно оружие или броня — открой меню «Купить оружие».',
                en: 'Good health to you, traveller. My master... alas, has left the world of the living. Now the forge is mine: the hammer is heavy, but my arms grow strong. Need a weapon or armor? Open the "Buy weapons" menu.',
                action: (scene) => {
                    DIALOGUES.apprentice.nodes.a.choices = withAskThief(scene, 'blacksmith', [
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, я пойду.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Ученик кузнеца',
                text: '...',
                action: (scene) => {
                    // Ученик знает всё, что видел его мастер (наследник свидетеля)
                    const r = askNPC(scene.registry, 'apprentice', 'Ученик кузнеца');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Ученик кузнеца',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'apprentice', 'Ученик кузнеца');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Ученик кузнеца',
                text: '...',
                choices: [
                    { text: t('Понятно, спасибо.'), end: true },
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
                en: 'Good day, traveller. From sunrise to sunset I am at the mill — the millstones wait for no one, and grain will not grind itself. And now the icon stolen on top of it — there is no deliverance from wicked men!',
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
                en: 'Our mill is a windmill — it stands on the hill, the wind turns its sails. Bring your grain — it will grind it into flour or groats alike. The old watermill broke down long ago — the stream ran shallow, and the wheel was taken away.',
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
                en: 'My cow Mashka strayed from the yard and never came back. I search all round about, but I cannot find her anywhere. Maybe she wandered into the forest?',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Мельник Авдей',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
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
                en: 'Good day, traveller. My bees are kind this year — a fine haul of honey. I gather herbs too — by the lake, along the river, wherever I find them. If you need honey, I am the one to see.',
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
                en: 'The Lord save you. May the Most Holy Mother of God keep watch over you.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Пасечница Марфа',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
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
                en: 'Peace be with you, traveller! You stand in a house of seven children — as loud as a fair on market day. As for me, I have wrestled the plough since dawn: a field will not plough itself.',
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
                en: 'The earth feeds the one who loves it. In the morning I harrow, after the midday meal I sow the rye. The children are my helpers: one drives the cattle to the pasture, another fishes, another hunts mushrooms in the forest. And for honey with your tea, ask Marfa: her apiary is older, and her honey is a healer — it sets a man back on his feet.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Пахарь Тарас',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
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
                en: 'Come in, traveller, but softly — I only just laid the little ones down. God has blessed Taras and me with seven children: there is shouting in the izba from dawn to dusk!',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            family: {
                speaker: 'Фёкла',
                text: 'Живём впроголодь, да дружно: Тарас с поля рожь приносит, я — огород да скотину. Старшие за младшими смотрят, а сам прибыльный — на выпас гоняют да в лес за грибами. Хлеб с молоком на столе — уже не бедность.',
                en: 'We live from hand to mouth, but all together: Taras brings rye from the field, and I tend the garden and the cattle. The elder ones mind the younger, and in the profitable season they drive the herd to pasture and pick mushrooms in the forest. Bread and milk on the table — that is no longer poverty.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Фёкла',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
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
                en: 'Good day, wanderer. Have you come to my Miroslav on business? He is out walking the village today — minding affairs, settling quarrels. And I keep to the house: the stove, the cattle, the garden.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            husband: {
                speaker: 'Любава',
                text: 'Староста он — воля деревенская. То с церковным старостой говорит, то стражу учит, то у колодца судит, кто чей телегой дорогу забил. Вечером придёт — отдохнём с ним за ужином.',
                en: 'He is the elder — the village\'s will. Now he speaks with the church warden, now he drills the watch, now he judges by the well who blocked the road with whose cart. He will come home in the evening, and we shall rest over supper together.',
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Любава',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
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
                en: 'Peace to you, my child. What brings you to the house of God? Would you confess, or pray?',
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
                        // Раунд 36: EN-перевод истории уже в словаре i18n — узел a
                        // динамический, поэтому node.en зеркалит локализованный text
                        // (статичный en здесь перебил бы рассказ о краже при isEn()).
                        node.en = node.text;
                        ActionLog.add(scene.registry, t('Первый разговор с батюшкой: он рассказал о краже иконы и посоветовал расспросить селян.'));
                    } else {
                        node.text = t('Мир тебе, чадо. Что привело тебя в дом Божий? Может, хочешь исповедаться или помолиться?');
                        // Раунд 36: после рассказа о краже node.en держит длинную
                        // историю — возвращаем en к приветствию.
                        node.en = node.text;
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
                    {
                        text: t('🏆 Продолжить игру (поручения жителей)'),
                        // Раунд 36: тот же «ключ» репутационной победы, что и
                        // у старосты — без выбора «Продолжить игру» ветка
                        // +100 репутации не открывается.
                        action: (scene) => {
                            const q = scene.registry.get('quest');
                            if (q && q.mainQuestDone && !q.repVictoryArmed) {
                                q.repVictoryArmed = true;
                                ActionLog.add(scene.registry, t('Герой остался в деревне — добрые дела теперь в его воле.'));
                            }
                        },
                        end: true,
                    },
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
                en: 'Oh, woe to us, {address}! In the night a thief broke into the church and stole the wonderworking icon of the Mother of God Hodegetria. It is more than a hundred years old; a monk-icon-painter of the Pechersky Monastery wrote it. Without it the village has lost God\'s blessing. Find the thief and bring back the holy treasure! Take the task from me, if you would help.',
                action: (scene) => {
                    const q = scene.registry.get('quest');
                    q.elderTalked = true; // отмечаем, что игрок узнал о краже
                    // Раунд 43 (п.3): короткий статус в баннере.
                    q.currentObjective = 'Найди вора.';
                    ActionLog.add(scene.registry, 'Поговорил с батюшкой о краже иконы.');
                },
                choices: [{ text: t('Я найду её, батюшка!'), end: true }],
            },
            ask_thief: {
                speaker: 'Отец Савватий',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'priest', 'Отец Савватий');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
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
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            pray: {
                speaker: 'Отец Савватий',
                text: 'Помолимся вместе, чадо. Господи, помилуй и сохрани раба Твоего...',
                en: 'Let us pray together, my child. O Lord, have mercy and keep Thy servant...',
                action: (scene) => {
                    const p = scene.registry.get('player');
                    p.MP = Math.min(p.MPmax, p.MP + 2);
                    ActionLog.add(scene.registry, 'Помолился в церкви (+2 MP).');
                },
                choices: [{ text: t('Аминь.'), end: true }],
            },
            ask_result: {
                speaker: 'Отец Савватий',
                text: '...',
                choices: [
                    { text: t('Спасибо, батюшка.'), end: true },
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

    // ===== РАУНД 37 (вариант Б): ЖИТЕЛИ НОВОЙ УЛИЦЫ =====

    // ПЛОТНИК МИКУЛА — lore о ремесле + задел на будущий крафт
    carpenter1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Плотник Микула',
                text: 'Микула я, плотник. Изба, клеть, сенник — всё моими руками сложено. Топор да скоба — вот и всё богатство, да зато какое: без них и деревня не деревня. Гляди-ка, у тебя плечи крепкие — не надобен ли тебе честный труд?',
                en: 'I am Mikula, the carpenter. House, storeroom, hay-barn — all built with these two hands. An axe and a saw are all the riches I own — yet what riches: without them a village is no village at all. You have broad shoulders, friend — might you be after honest work?',
                action: (scene) => {
                    DIALOGUES.carpenter1.nodes.a.choices = withAskThief(scene, 'carpenter1', [
                        { text: t('Что строишь теперь?'), next: 'build' },
                        { text: t('Про лес расскажи.'), next: 'forest_talk' },
                        { text: t('Чем мастерство добыл?'), next: 'craft' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Удачи в работе.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            build: {
                speaker: 'Плотник Микула',
                text: 'Сани новые затеял к зиме: полозья дубовые вяжу, вяз под клин кладу — десять лет прослужат. Да кровельку у батюшки поправить надобно: Богу угождать надобно сперва делом, а после словом.',
                en: 'I am building new sledges for winter: the runners are woven from oak wedges — they will serve ten years. And the priest\'s roof needs mending: you serve the Mother of God first with work, and only then with words.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            forest_talk: {
                speaker: 'Плотник Микула',
                text: 'Лес — он как брат, только молчаливый. Сосна — на стены, дуб — на пороги и сохи, осина — под дранку: она не гниёт. А без спросу лес рубить — грех: спроси у лесного дедушки, полено положи на пень. Так дед мой делал, так и я учу сыновей, если Бог даст.',
                en: 'The forest is like a brother, only a silent one. Pine for walls, oak for thresholds and ploughs, aspen for roof-shingles — it never rots. But felling without asking is a sin: ask the forest grandfather\'s leave and lay a log on the stump. That is what my grandfather did, and what I shall teach my sons, God willing.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            craft: {
                speaker: 'Плотник Микула',
                text: 'Дед выучил — с семи лет щепу возить заставлял. «Плотник, — говорил, — не тот, кто гвоздь забить умеет, а тот, кто дерево услышит: где резать, где гнуть, где досадовать да подождать». Вот вся и наука: слушай дерево — не ошибёшься.',
                en: 'My grandfather taught me — from the age of seven he made me carry shavings. "A carpenter," he said, "is not the one who can hammer a nail, but the one who listens to the wood: where to cut, where to bend, where to grumble and wait." That is the whole science: listen to the wood, and you will not err.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Плотник Микула',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'carpenter1', 'Плотник Микула');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Плотник Микула',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'carpenter1', 'Плотник Микула');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Плотник Микула',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // МАТРЁНА — жена плотника, короткое дерево
    carpenter_wife: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Матрёна, жена плотника',
                text: 'Муж весь день по дворам, а я пряду да варево варю. Дерево он слышит, а меня — не всегда. Уж что-что, а дым в трубе держать — это ко мне.',
                en: 'My husband is out at other people\'s yards all day, while I spin and cook. He can hear the wood, but not always me. Yet keeping the hearth alive — that is my craft.',
                action: (scene) => {
                    DIALOGUES.carpenter_wife.nodes.a.choices = withAskThief(scene, 'carpenter_wife', [
                        { text: t('Понятно, спасибо.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Матрёна, жена плотника',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'carpenter_wife', 'Матрёна, жена плотника');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Матрёна, жена плотника',
                text: '...',
                choices: [
                    { text: t('Понятно, спасибо.'), end: true },
                ],
            },
        },
    },

    // ГОНЧАР ИГНАТ — lore + ПОДЁННАЯ РАБОТА в мастерской (бывш. молотьба)
    potter1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Гончар Игнат',
                text: 'Здравствуй, добрый человек! Я Игнат, гончар. Мои горшки — в каждой избе, а не то и в церкви: кутью да в каком горшке носить? Обжиг сегодня — загляни, как огонь да глина творят чудо.',
                en: 'Good day, kind soul! I am Ignat, the potter. My pots sit in every house — and in the church too: after all, what would they carry the funeral wheat in? The kiln fires today — come and see what fire and clay can do together.',
                action: (scene) => {
                    DIALOGUES.potter1.nodes.a.choices = withAskThief(scene, 'potter1', [
                        { text: t('Помочь в мастерской (1 час)'), next: 'work' },
                        { text: t('Откуда глина берёшь?'), next: 'clay' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, я пойду.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            work: {
                speaker: 'Гончар Игнат',
                text: '...',
                action: (scene) => {
                    const player = scene.registry.get('player');
                    if ((player.HP || 0) <= 5) {
                        scene._lastAskResult = { message: t('Игнат щурится: «Сначала — хлеб да отдых. Обессиленного работником не нанимают». (Нужно больше здоровья)') };
                        return;
                    }
                    player.HP = Math.max(1, (player.HP || 1) - 3);
                    const wage = 3 + Math.floor(Math.random() * 4); // 3..6 д. — как в амбаре раньше
                    player.dengas = (player.dengas || 0) + wage;
                    scene.registry.set('player', player);
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, `Отработал час в гончарной мастерской: +${wage} д., усталость −3 HP.`);
                    scene._lastAskResult = { message: `Час у круга и печи: носил дрова, мешал глину, ставил горшки на обжиг. Игнат доволен.\n\nЗаработано: +${wage} д. Усталость: −3 здоровья.` };
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            clay: {
                speaker: 'Гончар Игнат',
                text: 'Глина — с речки, с брода: там она жирная, синяя. Пешком хожу, с сумой да лопатой. Кто горшком кормится, тот по воде и ходит. А как глину набрал — месяц мну да вылёживаю: торопливый горшок в печи лопнет, как поспешное слово.',
                en: 'The clay comes from the river ford — there it is rich and blue. I walk there with a sack and a spade. He who lives by the pot walks by the water. And once I gather the clay I knead and let it rest a month: a hasty pot cracks in the kiln, like a hasty word.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Гончар Игнат',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'potter1', 'Гончар Игнат');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Гончар Игнат',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'potter1', 'Гончар Игнат');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Гончар Игнат',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // АННА — жена гончара, короткое дерево
    potter_wife: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Анна, жена гончара',
                text: 'Пока Игнат по глину ходит, я при горшках да при дочке. Дунька уже чашку вылепила — не чаша, а загляденье! Приходите, когда обжиг: тепло у печи да разговоры в доме водятся.',
                en: 'While Ignat goes for clay, I mind the pots and our daughter. Dun\'ka has already thrown her first cup — not a goblet, but a sight for sore eyes! Come at the firing: the kiln warms the hearth, and gossip warms the house.',
                action: (scene) => {
                    DIALOGUES.potter_wife.nodes.a.choices = withAskThief(scene, 'potter_wife', [
                        { text: t('Спасибо.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Анна, жена гончара',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'potter_wife', 'Анна, жена гончара');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Анна, жена гончара',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // ТКАЧИХА ПЕЛАГЕЯ — вдова, лор о стане и сыне
    weaver1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Ткачиха Пелагея',
                text: 'Входи, не шуми — холст на стане, сейчас перекину нитку. Вдова я, Пелагея. Муж на погосте, сын при овцах, а стан — вот он, кормит. Холст, ряднина, по́лошка — чего надобно?',
                en: 'Come in, but quietly — there is linen on the loom, I am about to change the thread. I am Pelageya, a widow. My husband lies in the churchyard, my son is with the sheep, and the loom — well, the loom feeds us. Linen, sackcloth, coarse weave — what do you need?',
                action: (scene) => {
                    DIALOGUES.weaver1.nodes.a.choices = withAskThief(scene, 'weaver1', [
                        { text: t('Про сына расскажи.'), next: 'son' },
                        { text: t('Тяжела ль работа ткачихи?'), next: 'loom_talk' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Мира твоему дому.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            son: {
                speaker: 'Ткачиха Пелагея',
                text: 'Ивашка? Отцовская выправка, материнская упрямость. Овцы его слушаются лучше, чем я. Растёт — не по дням, по часам. Овечью выручку прячет за частоколом — копит на собственный нож. Мужик в доме растёт, как ни крути.',
                en: 'Ivashka? His father\'s bearing, his mother\'s stubbornness. The sheep obey him better than I do. He grows not by days but by hours. He hides the wool money behind the stockade — saving up for a knife of his own. A man of the house is growing, like it or not.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            loom_talk: {
                speaker: 'Ткачиха Пелагея',
                text: 'Тяжела ль? Нитка тонка, спина ноет, глаза слезятся к вечеру. Зато холст — он честный: что соткала, то и твое. Зимой при свече тку, летом при окне. Не божись, не зевай — и к Покрову будет тебе рубаха.',
                en: 'Is it hard? The thread is fine, the back aches, the eyes water by evening. But linen is honest: what you wove is yours. In winter I weave by candle, in summer by the window. Do not swear, do not idle — and by the Feast of the Protection you shall have your shirt.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Ткачиха Пелагея',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'weaver1', 'Ткачиха Пелагея');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Ткачиха Пелагея',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'weaver1', 'Ткачиха Пелагея');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Ткачиха Пелагея',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // ИВАШКА — пастушок-подросток при овчарне
    shepherd_boy: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'парень',
                text: 'Ивашка я, при овцах. Мать на стане с утра до ночи, а я — за частоколом. Овец у нас семь да баран Рыжий — тот самый, что думает, будто он человек. А ты не местный? Иди сюда, овцы не кусаются. Почти не кусаются.',
                en: 'I am Ivashka, I mind the sheep. My mother weaves from morning till night, and I am out here by the stockade. We have seven ewes and the ram Red — the one who thinks he is a person. You are not from here, are you? Come closer, the sheep do not bite. They almost never bite.',
                action: (scene) => {
                    DIALOGUES.shepherd_boy.nodes.a.choices = withAskThief(scene, 'shepherd_boy', [
                        { text: t('Что за баран у тебя?'), next: 'ram' },
                        { text: t('Про овчарню расскажи.'), next: 'fold' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            ram: {
                speaker: 'парень',
                text: 'Рыжий? Ох, баран как баран, только злопамятный. Как помашешь рукой — он рогами в бок! Мать велела его на осень зарезать, а я его обучил с ноги корм брать. Теперь хоть зарежь — не дам.',
                en: 'Red? A ram like any ram, only he holds a grudge. Wave your hand and he will butt you with his horns! Mother says to slaughter him in autumn, but I taught him to take feed from my palm. Now they may as well slaughter me first — I shall not give him up.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            fold: {
                speaker: 'парень',
                text: 'Частокол батя ещё поставил, до своей смерти. Овец держать — дело верное: шерсть — матери на стан, молоко да мясо — на постоялый двор, навоз — на грядки. Овца, она всё отдаёт, только корми да счесть не забывай!',
                en: 'Father built the stockade before he died. Keeping sheep is a sure thing: wool for Mother\'s loom, milk and meat for the lodging-yard, manure for the garden beds. A sheep gives everything — you only have to feed her and never miscount!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'парень',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'shepherd_boy', 'парень');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'парень',
                text: '...',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
        },
    },

    // ДОМНА — жена рыбака, короткое дерево
    fisher_wife: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Домна, жена рыбака',
                text: 'Ерёма на реке с зарею, а я уху варю да сети чиню. Рыбий дом — тоже дом: пахнет, может, не розой, да сытно.',
                en: 'Yeryoma is at the river from dawn, while I cook the fish stew and mend the nets. A fisherman\'s house is a house too: it may not smell of roses, but no one goes hungry.',
                action: (scene) => {
                    DIALOGUES.fisher_wife.nodes.a.choices = withAskThief(scene, 'fisher_wife', [
                        { text: t('Спасибо.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Домна, жена рыбака',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'fisher_wife', 'Домна, жена рыбака');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Домна, жена рыбака',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // РЫБАК ЕРЁМА — свой дом на новой улице, продаёт копчёную рыбу
    fisherman1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Рыбак Ерёма',
                text: 'Ерёма я, рыбак. От зари до зари на броду стою — и вот весь мой сказ. Рыба нынче идёт: лещи да окуни. Дом мой — вон он, на новой улице; заходи — Домна ухи нальёт.',
                en: 'I am Yeryoma, a fisherman. From dawn to dusk I stand at the ford — and that is my whole tale. The fish are running: bream and perch. My house is over there on the new street; come by — Domna will pour you some fish stew.',
                action: (scene) => {
                    DIALOGUES.fisherman1.nodes.a.choices = withAskThief(scene, 'fisherman', [
                        { text: t('🐟 Купить копчёную рыбу (2 д.)'), next: 'fish' },
                        { text: t('Где нынче клюёт?'), next: 'spot' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, я пойду.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            fish: {
                speaker: 'Рыбак Ерёма',
                text: '...',
                action: (scene) => {
                    const player = scene.registry.get('player');
                    const FISH_PRICE = 2;
                    if ((player.dengas || 0) < FISH_PRICE) {
                        scene._lastAskResult = { message: t('Ерёма разводит руками: «Без двух монет и хвост не отдаю. Рыба — она не трава, сам лови».') };
                        return;
                    }
                    player.dengas -= FISH_PRICE;
                    const heal = 2 + Math.floor(Math.random() * 2); // 2..3 HP — дешевле трапезы, чуть жирнее
                    player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                    scene.registry.set('player', player);
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, `Купил копчёной рыбы у Ерёмы: −2 д., +${heal} HP.`);
                    scene._lastAskResult = { message: `Лещ копчёный, дымом пахнет — как в детстве. Ешь, не жалей.\n\n−2 д. · +${heal} здоровья.` };
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            spot: {
                speaker: 'Рыбак Ерёма',
                text: 'Клюёт у брода, где ива склонилась, да под глинистым яром. На червя — лещ, на мелкую рыбку — щука. А ночью рыбачи не советую: вода ночью — хозяйка, а не слуга.',
                en: 'They bite at the ford under the leaning willow, and under the clay bluff. Worm for bream, a small live fish for pike. But I do not advise night fishing: at night the water is a mistress, not a servant.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Рыбак Ерёма',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'fisherman', 'Рыбак Ерёма');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Рыбак Ерёма',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'fisherman', 'Рыбак Ерёма');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Рыбак Ерёма',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // ЗНАХАРКА ФЕВРОНЬЯ — лечение за деньги (первая полноценная «лекарка»)
    healer1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Знахарка Февронья',
                text: 'Заходи, заходи, не стой в дверях — сквозняк. Я Февронья, травами лечу от столетья века. Раны у тебя, вижу, свежие: так и знала, что дорогой идёшь. Полечу — как раз ноги не подводили?',
                en: 'Come in, come in, do not linger in the doorway — there is a draft. I am Fevronia; I have healed with herbs since time out of mind. Your wounds are fresh, I can see: I knew you came from the road. Let me treat them — your legs still carry you, do they?',
                action: (scene) => {
                    DIALOGUES.healer1.nodes.a.choices = withAskThief(scene, 'healer', [
                        { text: t('🌿 Полечить раны (3 д.)'), next: 'heal' },
                        { text: t('Чего травами лечишь?'), next: 'herbs' },
                        { text: t('Про внучку расскажи.'), next: 'granddaughter' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Слава Богу, здоров.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            heal: {
                speaker: 'Знахарка Февронья',
                text: '...',
                action: (scene) => {
                    const player = scene.registry.get('player');
                    const HEAL_PRICE = 3;
                    if ((player.dengas || 0) < HEAL_PRICE) {
                        scene._lastAskResult = { message: t('Февронья качает головой: «Три деньги — не жадность, а плата за коренья: я их сама ищу, на росе, до петухов. Нет трёх — терпи».') };
                        return;
                    }
                    player.dengas -= HEAL_PRICE;
                    const heal = 3 + Math.floor(Math.random() * 3); // 3..5 HP — сильнее трапезы
                    player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                    scene.registry.set('player', player);
                    if (scene.audioManager && scene.audioManager.playGoldSpend) scene.audioManager.playGoldSpend();
                    ActionLog.add(scene.registry, `Февронья полечила раны: −3 д., +${heal} HP.`);
                    scene._lastAskResult = { message: `Приложила подорожник, напоила отваром — кровь остановить, боль унять. К утру затянется.\n\n−3 д. · +${heal} здоровья.` };
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            herbs: {
                speaker: 'Знахарка Февронья',
                text: 'Полынь — от живота, зверобой — от девяноста девяти хворей, подорожник — раны заживлять, мята — сердце успокоить. Собираю на Троицу, на росе, с наговором. А на Ивана Купалу — так это уже не трава, а сила.',
                en: 'Wormwood for the belly, Saint-John\'s-wort for ninety-nine ailments, plantain to close wounds, mint to still the heart. I gather them at Trinity, on the dew, with a whispered charm. And at Midsummer — that is no longer a herb, that is raw power.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            granddaughter: {
                speaker: 'Знахарка Февронья',
                text: 'Ульяна? Вся в меня: травы отличает, как я — свои веники. Только бабку свою слушает, а мать-то у неё померла родами... Научу всему — и дурою никто её не назовёт. Женщина с травой в руках — самостоятельный человек, запомни.',
                en: 'Ulyana? She takes after me: she can tell the herbs apart the way I tell my own brooms. She listens to her granny alone — her mother died in childbed... I shall teach her everything, and no one will dare call her a fool. A woman with herbs in her hands can stand on her own, remember that.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Знахарка Февронья',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'healer', 'Знахарка Февронья');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Знахарка Февронья',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'healer', 'Знахарка Февронья');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Знахарка Февронья',
                text: '...',
                choices: [
                    { text: t('Спасибо, батюшка... то есть, бабушка.'), end: true },
                ],
            },
        },
    },

    // ДУНЬКА — дочка гончара (9 лет)
    kid8: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'Я Дунька! Я уже горшок вылепила — настоящий, с носиком! Батя сказал — на обжиг ставить, когда печь остынет. А у тебя мошна звенит? Это монетки? У меня тоже есть — батя дал за то, что дрова собрала!',
                en: 'I am Dun\'ka! I have already thrown a real pot — with a spout and everything! Father said it goes to the kiln once it cools. Is that your purse jingling? Are those coins? I have some too — Father gave them to me for stacking the firewood!',
                action: (scene) => {
                    DIALOGUES.kid8.nodes.a.choices = withAskThief(scene, 'kid8', [
                        { text: t('Во что играете?'), next: 'games' },
                        { text: t('Покажешь горшок?'), next: 'pot' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            games: {
                speaker: 'ребёнок',
                text: 'Мы в черепки играем! Которые с трещиной — они больше не горшки, так можно! Я в них крупу ношу, как настоящая хозяйка. А ещё на качелях качаемся у Карповки — до неба достаём!',
                en: 'We play with cracked pots! The ones with a crack are not pots anymore, so we may! I carry grain in them, like a real housewife. And we swing on the swing by the stream — we touch the sky!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            pot: {
                speaker: 'ребёнок',
                text: 'Вот он! Видишь, ровненький? Мама говорит — как у батиного деда вышло. А если треснет — я не буду плакать! Ну... немножко буду. Батя говорит: глина — она живая, сама знает, каким горшком быть.',
                en: 'Here it is! See how even it is? Mother says it turned out like Grandfather\'s. And if it cracks — I shall not cry! Well... maybe a little. Father says the clay is alive and knows itself what kind of pot to become.',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid8', t('мальчик'));
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

    // УЛЬЯНА — внучка знахарки (11 лет)
    kid9: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'ребёнок',
                text: 'Тише, бабушка отдыхает! Я Ульяна, её внучка. Травы разбираю: эта — полынь, эта — зверобой, а эту трогать нельзя — она крапива! Бабушка говорит, я у неё в бабку, а это значит — самая умная!',
                en: 'Hush, grandmother is resting! I am Ulyana, her granddaughter. I sort the herbs: this is wormwood, this is Saint-John\'s-wort, and this one you must not touch — it is a nettle! Granny says I take after her, which means I am the cleverest!',
                action: (scene) => {
                    DIALOGUES.kid9.nodes.a.choices = withAskThief(scene, 'kid9', [
                        { text: t('Чему учишься?'), next: 'lessons' },
                        { text: t('Слышишь, звонят?'), next: 'bells' },
                        { text: t('Береги себя, детка.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            lessons: {
                speaker: 'ребёнок',
                text: 'Бабушка учит: рана кровоточит — подорожник, болит голова — мята, страшно ночью — то молитва, а не трава! Ещё я умею пиявок собирать. Мальчишки боятся, а я — нет. Прикольные, липкие!',
                en: 'Granny teaches me: a bleeding wound — plantain, a headache — mint, fear at night — that is prayer, not an herb! I can also gather leeches. The boys are afraid, but I am not. They are funny and sticky!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            bells: {
                speaker: 'ребёнок',
                text: 'Ой, люблю, когда трезвон! Мы с бабушкой тогда в церковь идём — она к молитве, а я к подружкам. Батюшка говорит, у каждого колокола голос свой, как у людей. У большого — бас, у маленького — пищит, как я, когда огорчусь!',
                en: 'Oh, I love the peal! Then Granny and I go to church — she to pray, and I to my friends. Father Savvaty says every bell has its own voice, like people. The big one booms, the small one squeaks — like me when I am upset!',
                choices: [
                    { text: t('Береги себя, детка.'), end: true },
                ],
            },
            ask_thief: {
                speaker: 'ребёнок',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'kid9', t('мальчик'));
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

    // ===== РАУНД 51 (п.11 заявки): ВОСТОЧНАЯ СЛОБОДА =====
    // Три лавки рыночного ряда и два новых деревянных дома.

    // ПРАСКОВЬЯ — снедница (раунд 53: лавка удалена — Прасковья печёт дома,
    // гостей принимает на своём дворе)
    grocer: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Снедница Прасковья',
                text: 'Здравствуй, дорогой гость! Прасковья я, снедница: пеку дома. Караваи с утра горячие, сыр — из-за Реки, молоко — от своих коровок. Заходи на двор, каждому гостю — угощение да ласковое слово!',
                en: 'Greetings, dear guest! I am Praskovya, the victualer: I bake at home. Loaves are hot since morning, cheese comes from beyond the River, milk from my own cows. Step into my yard — a treat and a kind word for every guest!',
                action: (scene) => {
                    DIALOGUES.grocer.nodes.a.choices = withAskThief(scene, 'grocer', [
                        { text: t('Что нынче свежее?'), next: 'fresh' },
                        { text: t('Откуда товар?'), next: 'goods' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('До свидания.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            fresh: {
                speaker: 'Снедница Прасковья',
                text: 'С утра — пироги с репой да с грибами, в полдень — творожники. Грибы сушёные — сама брала, сама сушила: на полатях, под крышей — ни червячка! А молоко — вот это молоко: ложка стоит, столбом!',
                en: 'In the morning — pies with turnip and mushrooms, at noon — curd pasties. Dried mushrooms — I picked them myself, dried them myself: on the rafters, under the roof — not a single worm! And the milk — now that is milk: a spoon stands upright!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            goods: {
                speaker: 'Снедница Прасковья',
                text: 'Хлеб — из общинной печи, мукой снабжает староста. Сыр меняем с речными сёлами, грибы и ягоды — из нашего леса. Всё честно, без обману: снедь должна быть свежей, как утро!',
                en: 'Bread is from the communal oven — the village elder supplies the flour. Cheese we barter with river villages, mushrooms and berries are from our own forest. All honest, no trickery: victuals must be as fresh as morning!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Снедница Прасковья',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'grocer', 'Снедница Прасковья');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Снедница Прасковья',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'grocer', 'Снедница Прасковья');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Снедница Прасковья',
                text: '...',
                choices: [
                    { text: t('Спасибо, хозяйка.'), end: true },
                ],
            },
        },
    },

    // ПОТАП — мясник (раунд 53: лавка удалена — столешня при его доме)
    butcher: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Мясник Потап',
                text: 'Чего надобно? Потап я, мясник. Тесак острый, товар свежий. Заходи на двор: колбаса — бери, окорок — копчёный, рыба вяленая — к пиву самому постоялому двору не снилось лучше. Смотри не тяни — к вечеру всё разберут!',
                en: 'What do you need? I am Potap, the butcher. Sharp cleaver, fresh goods. Step into my yard: take the sausage, the smoked ham, the dried fish — even the tavern cellars never dreamt of better. Do not dawdle — by evening it is all sold!',
                action: (scene) => {
                    DIALOGUES.butcher.nodes.a.choices = withAskThief(scene, 'butcher', [
                        { text: t('Откуда скот?'), next: 'cattle' },
                        { text: t('Про лес расскажи.'), next: 'forest_talk' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('До свидания.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            cattle: {
                speaker: 'Мясник Потап',
                text: 'Скот беру у своих: у пастухов Силы и Настасьи — лучший на сёла вокруг. Коровку Мушку, что в камышах прячется, вжух — не трону: коровка добрая, молока много. А вот кабанчика дикого на прошлой неделе в силке взял — окорок вышел знатный!',
                en: 'I take livestock from my own folk: shepherd Sila and Nastasya keep the finest around. Their cow Mushka that hides in the reeds — shoo, I touch her not: she is a good cow, gives much milk. But last week I took a wild boar in a snare — a fine ham it made!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            forest_talk: {
                speaker: 'Мясник Потап',
                text: 'Лес кормит, да и испытывает. Ходишь за зверем — ходи тихо, а тут на днях топор чей-то слышал в чащи — дровосек Горазд, сказывают, всё дальше рубит. Ну да лес — не я: срубишь с умом — не оскудеет.',
                en: 'The forest feeds — and it tests you. When you hunt, walk quietly; and these days someone\'s axe is heard deep in the thicket — they say the woodcutter Gorazd fells farther and farther. Well, the forest is not me: cut with sense, and it will never run dry.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Мясник Потап',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'butcher', 'Мясник Потап');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Мясник Потап',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'butcher', 'Мясник Потап');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Мясник Потап',
                text: '...',
                choices: [
                    { text: t('Спасибо.'), end: true },
                ],
            },
        },
    },

    // АВЕРЬЯН — торгарь (лавка ремесленника)
    peddler: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Торгарь Аверьян',
                text: 'Ага, гость! Аверьян я, торгарь. В лавке моей — всякая вещица к делу: нож, что бриту родня, верёвка — семь вёрст тянет, кремень — искру из-под дождя достанет. А обереги — от бабки-знахарки заговорённые. Бери — не прогадаешь!',
                en: 'Ah, a guest! I am Averyan, the peddler. In my stall every trinket is good for something: a knife that is kin to a razor, a rope that stretches seven versts, a flint that strikes a spark even in rain. And the amulets are charmed by the healer granny. Take one — you will not regret it!',
                action: (scene) => {
                    DIALOGUES.peddler.nodes.a.choices = withAskThief(scene, 'peddler', [
                        { text: t('Откуда товар?'), next: 'origin' },
                        { text: t('Что в народе слыхал?'), next: 'news' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('До свидания.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            origin: {
                speaker: 'Торгарь Аверьян',
                text: 'По трактам хожу, с возами торгаши вожу — вот и присматриваю, что народу надобно. Ножи — у кузнеца выторговал, свечи — от церковного воска, обереги — знахарка Февронья плетёт да наговаривает. Всё по-честному, каждая вещь — с историей!',
                en: 'I walk the roads, drive carts with merchants — and I watch what folk need. The knives I traded from the smith, the candles are from church wax, the amulets the healer Fevronia weaves and charms. All honestly made, every item with a story!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            news: {
                speaker: 'Торгарь Аверьян',
                text: 'Народ гуторит разное: где барыш, там и сплетня. Слыхал я, будто по ночам у околицы огонёк ходит — то ли путник заблудный, то ли худой человек лазит. Ты в ноги не кланяйся, а глаз держи востро!',
                en: 'Folk talk all manner of things: where there is profit, there is gossip. I have heard that at night a small fire wanders by the village edge — be it a lost traveller or a wicked man creeping about. Do not bow too deep, but keep a sharp eye!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Торгарь Аверьян',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'peddler', 'Торгарь Аверьян');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Торгарь Аверьян',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'peddler', 'Торгарь Аверьян');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Торгарь Аверьян',
                text: '...',
                choices: [
                    { text: t('Спасибо, торгарь.'), end: true },
                ],
            },
        },
    },

    // НЕФЁД — сапожник (дом сапожника)
    shoemaker: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Сапожник Нефёд',
                text: 'Нефёд я, сапожник. Сапог на Руси — не обуза, а гордость: у доброго сапога голенище в обтяжку, подошва — что дубовая кора. Дай сюда ногу... э, да ты не в очередь — садись, погутарим, пока Агафья чаю ставит.',
                en: 'I am Nefyod, the shoemaker. A boot in Rus is not a burden but a pride: a good boot fits the calf snugly, and its sole is like oak bark. Let me see your foot... ah, no queue today — sit down and let us talk while Agafya makes tea.',
                action: (scene) => {
                    DIALOGUES.shoemaker.nodes.a.choices = withAskThief(scene, 'shoemaker', [
                        { text: t('Про ремесло расскажи.'), next: 'craft' },
                        { text: t('Кто заказывает?'), next: 'clients' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('До свидания.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            craft: {
                speaker: 'Сапожник Нефёд',
                text: 'Ремесло — это глаз, да рука, да терпение. Кожу мочу, месю, тяну; шило веду под наклоном, нитку — конопляную, в дёгте. Сапог, сшитый с песней, — служит без починки. А сапог, сшитый со злобой, — трещит на первом же броду!',
                en: 'The craft is an eye, a hand, and patience. I soak the leather, knead it, stretch it; guide the awl at an angle, use hemp thread in tar. A boot sewn with a song serves without repair. A boot sewn in anger — cracks at the first ford!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            clients: {
                speaker: 'Сапожник Нефёд',
                text: 'Кто заказывает? Староста — сапоги к празднику, стражник — сапоги «чтоб бегать за ворами», ткачиха Пелагея — башмачки сыну. А вот кузнец Данила не шьётся у меня — у него кожа на фартук идёт. Хоть сам в моём добре, хоть вся деревня!',
                en: 'Who orders? The elder — boots for the feast, the guard — boots "for chasing thieves", the weaver Pelageya — little shoes for her son. And smith Danila does not order from me — his leather goes to aprons. Wear my goods yourself — or the whole village will!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Сапожник Нефёд',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'shoemaker', 'Сапожник Нефёд');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Сапожник Нефёд',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'shoemaker', 'Сапожник Нефёд');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Сапожник Нефёд',
                text: '...',
                choices: [
                    { text: t('Спасибо, мастер.'), end: true },
                ],
            },
        },
    },

    // АГАФЬЯ — жена сапожника
    shoemaker_wife: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Агафья, жена сапожника',
                text: 'Муж мой весь в кожаной стружке, а я в кухонной. Агафья я. Нефёд шьёт — а я, чтоб дом стоял: щи да каша — пища наша. Заходи, гостюю ты ко мне, я хоть расскажу, что в слободе делается.',
                en: 'My husband is covered in leather shavings, and I in kitchen ones. I am Agafya. Nefyod sews — and I keep the house standing: shchi and kasha are our food. Come in, dear guest, and I will tell you what goes on in the settlement.',
                action: (scene) => {
                    DIALOGUES.shoemaker_wife.nodes.a.choices = withAskThief(scene, 'shoemaker_wife', [
                        { text: t('Как живётся в слободе?'), next: 'settlement' },
                        { text: t('Про соседей расскажи.'), next: 'neighbours' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('До свидания.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            settlement: {
                speaker: 'Агафья, жена сапожника',
                text: 'Слобода наша новая — но уже как своя. Утром Прасковья пирогами ветер гоняет — вся слобода к её двору носами идёт. А по вечерам Горазд дрова колет — эхом по лесу отдаётся, будто кто дровосека вторит.',
                en: 'Our settlement is new — but already feels like our own. In the morning Praskovya\'s pies chase the wind — the whole settlement walks to her yard by the nose. And in the evenings Gorazd splits firewood — it echoes through the forest, as if someone answers the woodcutter.',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            neighbours: {
                speaker: 'Агафья, жена сапожника',
                text: 'Соседи — золотые. Потап хоть и грозный на вид, а кошке моей косточки отдаёт. Аверьян всё торгует да торгует — а как хворала я в зиму, так он мне мёду принёс без денег. Слободские — друг за друга!',
                en: 'Our neighbours are golden. Potap looks fearsome, but he saves bones for my cat. Averyan trades and trades — yet when I was ill that winter, he brought me honey for no money. The settlement folk stand by each other!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Агафья, жена сапожника',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'shoemaker_wife', 'Агафья, жена сапожника');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Агафья, жена сапожника',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'shoemaker_wife', 'Агафья, жена сапожника');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Агафья, жена сапожника',
                text: '...',
                choices: [
                    { text: t('Спасибо, Агафьюшка.'), end: true },
                ],
            },
        },
    },

    // ГОРАЗД — дровосек (изба дровосека)
    woodcutter: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Дровосек Горазд',
                text: 'Горазд. Просто Горазд — прозвище за дело дали: всё горазд делать. Дрова — горазд, избу — горазд, волка топором — тоже горазд. Ты не пугайся: волков не трогаю, если они меня не трогают. Дров надобно? Всегда есть — поленница за плечом.',
                en: 'Gorazd. Just Gorazd — they gave the nickname for the deed: I am "good at" everything. Firewood — good at it, a house — good at it, a wolf with an axe — also good at it. Do not fear: I touch no wolves unless they touch me. Need firewood? Always have some — the woodpile is over my shoulder.',
                action: (scene) => {
                    DIALOGUES.woodcutter.nodes.a.choices = withAskThief(scene, 'woodcutter', [
                        { text: t('Про лес расскажи.'), next: 'forest_talk' },
                        { text: t('Про метки на брёвнах.'), next: 'marks' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('До свидания.'), end: true },
                    ], 1);
                },
                choices: [],
            },
            forest_talk: {
                speaker: 'Дровосек Горазд',
                text: 'Лес — он как дед: молчит, да всё видит. Рублю только сухостой да на вырубке — живое дерево зря не валю: лес кормит и меня, и охотника, и зверя. На опушке вчера волк выл — долго выл. Чует: нечисть в лесу не одна ходит...',
                en: 'The forest is like a grandfather: silent, but it sees everything. I fell only deadwood and at clearings — I do not fell live trees in vain: the forest feeds me, the hunter, and the beast alike. Yesterday a wolf howled at the forest edge — howled long. It senses: not only the wicked walk the woods...',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            marks: {
                speaker: 'Дровосек Горазд',
                text: 'Метки? Это счёт. Каждое дерево — зарубка на бревне у печи. Зима нынешняя — сто сорок. Зимой топить надо, а летом из сухостоя — на новые избы. Гляди-ка: слобода наша растёт — Прасковья печью обзаводится, сапожник дом ставит. Хорошо пойдёт!',
                en: 'The marks? That is my tally. Every tree — a notch on the log by the stove. This winter — one hundred and forty. In winter one must heat, and in summer the deadwood goes to new houses. Look: our settlement grows — Praskovya builds her bread oven, the shoemaker raises his house. Things will go well!',
                choices: [
                    { text: t('(продолжить)'), next: 'a' },
                ],
            },
            ask_thief: {
                speaker: 'Дровосек Горазд',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'woodcutter', 'Дровосек Горазд');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Дровосек Горазд',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'woodcutter', 'Дровосек Горазд');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: t('(продолжить)'), next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Дровосек Горазд',
                text: '...',
                choices: [
                    { text: t('Спасибо, Горазд.'), end: true },
                ],
            },
        },
    },
};

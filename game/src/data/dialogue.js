// Дерево диалогов. Каждый узел: speaker, text, choices[].
// choice: { text, next?, end?, action? } — action(scene) выполняется при выборе.
// Действия обращаются к сцене через scene.registry и scene.autosave().

import { askNPC, askElderAdvance, askMoneyForHelp, surrenderStolenItem, checkGameEnd } from './thief.js';
import { ActionLog } from './actionLog.js';
import { tickTime } from '../systems/TimeSystem.js';
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

    // === ТАВЕРНЩИК — новости + можно попросить денег ===
    tavernkeeper: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Тавернщик Фёдор',
                text: 'Здравствуй, путник! Заходи, присаживайся. Хочешь поесть, попить или переночевать?',
                // Раунд 22: расспрос о воре — один раз за игру
                action: (scene) => {
                    DIALOGUES.tavernkeeper.nodes.a.choices = withAskThief(scene, 'tavernkeeper', [
                        { text: t('Что нового в деревне?'), next: 'b' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Спасибо, я пойду.'), end: true },
                    ]);
                },
                choices: [],
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

    // === КРЕСТЬЯНИН АВДЕЙ ===
    peasant1: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Крестьянин Авдей',
                text: 'Ох, путник... у меня беда. Корова пропала третьего дня, а тут ещё иконокража! Никакого спасу от лихих людей.',
                action: (scene) => {
                    DIALOGUES.peasant1.nodes.a.choices = withAskThief(scene, 'peasant1', [
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Что с коровой?'), next: 'cow' },
                        { text: t('Сочувствую. Прощай.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            cow: {
                speaker: 'Крестьянин Авдей',
                text: 'Корова моя Машка ушла со двора и не вернулась. Ищу по окрестностям, но никак не найду. Может, в лес ушла?',
                action: (scene) => {
                    DIALOGUES.peasant1.nodes.cow.choices = withAskThief(scene, 'peasant1', [
                        { text: t('Найдётся ваша корова.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Крестьянин Авдей',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'peasant1', 'Крестьянин Авдей');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Крестьянин Авдей',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'peasant1', 'Крестьянин Авдей');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Крестьянин Авдей',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },

    // === ВДОВА МАРФА ===
    widow: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Вдова Марфа',
                text: 'Здравствуйте, молодой человек. Помолитесь со мной за упокой души моего мужа, царство ему небесное.',
                action: (scene) => {
                    DIALOGUES.widow.nodes.a.choices = withAskThief(scene, 'widow', [
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Помолюсь.'), next: 'pray' },
                        { text: t('Извините, я спешу.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            pray: {
                speaker: 'Вдова Марфа',
                text: 'Спаси вас Господь. Пусть хранит вас Пресвятая Богородица.',
                action: (scene) => {
                    DIALOGUES.widow.nodes.pray.choices = withAskThief(scene, 'widow', [
                        { text: t('Прощайте.'), end: true },
                    ], 0);
                },
                choices: [],
            },
            ask_thief: {
                speaker: 'Вдова Марфа',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'widow', 'Вдова Марфа');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_money: {
                speaker: 'Вдова Марфа',
                text: '...',
                action: (scene) => {
                    const r = askMoneyForHelp(scene.registry, 'widow', 'Вдова Марфа');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_result' },
                ],
            },
            ask_result: {
                speaker: 'Вдова Марфа',
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
                action: (scene) => {
                    const q = scene.registry.get('quest') || {};
                    const asked = (q.thiefAskedFrom || []).includes('priest');
                    const base = [
                        { text: t('Расскажи про украденную икону'), next: 'about_icon' },
                        ...(!asked ? [{ text: t('Спросить про вора'), next: 'ask_thief' }] : []),
                        { text: t('🙏 Попросить благословения'), next: 'blessing' },
                        { text: t('Попросить денег'), next: 'ask_money' },
                        { text: t('Помолиться'), next: 'pray' },
                        { text: t('Спасибо, батюшка.'), end: true },
                    ];
                    const node = DIALOGUES.priest.nodes.a;
                    node.choices = (q.stolenItemRecovered && !q.mainQuestDone)
                        ? [{ text: t('🏺 Вернуть икону церкви!'), next: 'return_icon' }, ...base]
                        : base;
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

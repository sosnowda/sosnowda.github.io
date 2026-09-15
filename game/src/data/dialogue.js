// Дерево диалогов. Каждый узел: speaker, text, choices[].
// choice: { text, next?, end?, action? } — action(scene) выполняется при выборе.
// Действия обращаются к сцене через scene.registry и scene.autosave().

import { askNPC, askElderAdvance, askMoneyForHelp, surrenderStolenItem, checkGameEnd } from './thief.js';
import { ActionLog } from './actionLog.js';
import { t } from '../systems/i18n.js';

export const DIALOGUES = {
    // === СТАРОСТА — выдаёт задание + задаток + ПРИЁМ ИКОНЫ (раунд 21) ===
    elder_quest: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Староста Мирослав',
                text: 'Здравствуй, {address}. У нас беда! Ночью неизвестный вор забрался в часовню и украл чудотворную икону. Это наша главная святыня!',
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
                choices: [
                    { text: 'Что нового в деревне?', next: 'b' },
                    { text: 'Спросить про вора', next: 'ask_thief' },
                    { text: 'Попросить денег', next: 'ask_money' },
                    { text: 'Спасибо, я пойду.', end: true },
                ],
            },
            b: {
                speaker: 'Тавернщик Фёдор',
                text: 'Слыхал, вор украл икону из часовни! Староста в отчаянии. А ещё говорят, что кто-то видел подозрительного человека в тёмном плаще у околицы. Но куда он побежал — никто толком не знает.',
                choices: [
                    { text: 'Спросить про вора', next: 'ask_thief' },
                    { text: 'Спасибо за новости.', end: true },
                ],
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
                choices: [
                    { text: 'Спросить про вора', next: 'ask_thief' },
                    { text: 'Попросить денег', next: 'ask_money' },
                    { text: 'Спасибо, я пойду.', end: true },
                ],
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
                choices: [
                    { text: 'Спросить про вора', next: 'ask_thief' },
                    { text: 'Попросить денег', next: 'ask_money' },
                    { text: 'Что с коровой?', next: 'cow' },
                    { text: 'Сочувствую. Прощай.', end: true },
                ],
            },
            cow: {
                speaker: 'Крестьянин Авдей',
                text: 'Корова моя Машка ушла со двора и не вернулась. Ищу по окрестностям, но никак не найду. Может, в лес ушла?',
                choices: [
                    { text: 'Спрошу про вора.', next: 'ask_thief' },
                    { text: 'Найдётся ваша корова.', end: true },
                ],
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
                choices: [
                    { text: 'Спросить про вора', next: 'ask_thief' },
                    { text: 'Попросить денег', next: 'ask_money' },
                    { text: 'Помолюсь.', next: 'pray' },
                    { text: 'Извините, я спешу.', end: true },
                ],
            },
            pray: {
                speaker: 'Вдова Марфа',
                text: 'Спаси вас Господь. Пусть хранит вас Пресвятая Богородица.',
                choices: [
                    { text: 'Спрошу про вора.', next: 'ask_thief' },
                    { text: 'Прощайте.', end: true },
                ],
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
                action: (scene) => {
                    const q = scene.registry.get('quest') || {};
                    const base = [
                        { text: t('Расскажи про украденную икону'), next: 'about_icon' },
                        { text: t('Спросить про вора'), next: 'ask_thief' },
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

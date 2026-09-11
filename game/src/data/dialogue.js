// Дерево диалогов. Каждый узел: speaker, text, choices[].
// choice: { text, next?, end?, action? } — action(scene) выполняется при выборе.
// Действия обращаются к сцене через scene.registry и scene.autosave().

import { askNPC, searchLocation, winGame, loseHeroDead } from './thief.js';
import { ActionLog } from './actionLog.js';

export const DIALOGUES = {
    // === СТАРОСТА — выдаёт задание ===
    elder_quest: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Староста Мирослав',
                text: 'Путник, у нас беда! Ночью неизвестный вор забрался в часовню и украл чудотворную икону. Это наша главная святыня!',
                choices: [
                    { text: 'Я помогу найти вора.', next: 'b' },
                    { text: 'Расскажи подробнее.', next: 'c' },
                    { text: 'Извини, я спешу.', end: true },
                ],
            },
            b: {
                speaker: 'Староста Мирослав',
                text: 'Благодарю! Вор бежал из деревни, но куда именно — никто не знает. Спроси жителей, может, кто что видел. Или поищи следы за воротами. У тебя мало времени — вор может уйти далеко!',
                action: (scene) => {
                    const q = scene.registry.get('quest');
                    q.elderTalked = true;
                    q.currentObjective = 'Найди вора: спроси жителей или поищи следы за воротами';
                    scene.autosave();
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
                    scene.autosave();
                },
                choices: [{ text: 'Слава Богу.', end: true }],
            },
        },
    },

    // === ТАВЕРНЩИК — новости + услуги ===
    tavernkeeper: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Тавернщик Фёдор',
                text: 'Здравствуй, путник! Заходи, присаживайся. Хочешь поесть, попить или переночевать?',
                choices: [
                    { text: 'Что нового в деревне?', next: 'b' },
                    { text: 'Поесть (5 монет, +3 HP)', next: 'eat', action: (scene) => {
                        const p = scene.registry.get('player');
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 5) {
                            q.gold = (q.gold || 0) - 5;
                            p.HP = Math.min(p.HPmax, p.HP + 3);
                            ActionLog.add(scene.registry, 'Поел в таверне (+3 HP, -5 золота).');
                        }
                    } },
                    { text: 'Попить (3 монет, +1 MP)', next: 'drink', action: (scene) => {
                        const p = scene.registry.get('player');
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 3) {
                            q.gold = (q.gold || 0) - 3;
                            p.MP = Math.min(p.MPmax, p.MP + 1);
                            ActionLog.add(scene.registry, 'Попил в таверне (+1 MP, -3 золота).');
                        }
                    } },
                    { text: 'Отдохнуть (10 монет, полное восстановление)', next: 'rest', action: (scene) => {
                        const p = scene.registry.get('player');
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 10) {
                            q.gold = (q.gold || 0) - 10;
                            p.HP = p.HPmax;
                            p.MP = p.MPmax;
                            ActionLog.add(scene.registry, 'Отдохнул в таверне (полное восстановление, -10 золота).');
                        }
                    } },
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
                text: '... (тавернщик задумывается)',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'tavernkeeper', 'Тавернщик Фёдор');
                    scene._lastAskResult = r;
                },
                choices: [
                    {
                        text: '(продолжить)',
                        next: 'ask_thief_result',
                    },
                ],
            },
            ask_thief_result: {
                speaker: 'Тавернщик Фёдор',
                text: '...',
                action: (scene) => {
                    const r = scene._lastAskResult;
                    if (r && r.message) {
                        // Подставляем текст в реплику
                    }
                },
                choices: [
                    { text: 'Понятно, спасибо.', end: true },
                ],
            },
            eat: {
                speaker: 'Тавернщик Фёдор',
                text: 'Держи хлеб с кашей и квас. Приятного аппетита!',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            drink: {
                speaker: 'Тавернщик Фёдор',
                text: 'Вот тебе медовуха. Пей на здоровье!',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            rest: {
                speaker: 'Тавернщик Фёдор',
                text: 'Отведу тебя в горницу. Отдыхай сколько нужно. Утром будешь как новый.',
                choices: [{ text: 'Спасибо за кров.', end: true }],
            },
        },
    },

    // === КУЗНЕЦ — продажа оружия и брони ===
    blacksmith: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Кузнец Данила',
                text: 'Здрав будь, воин! Моя кузница к твоим услугам. Нужно оружие или броня?',
                choices: [
                    { text: 'Купить длинный меч (30 золота)', next: 'buy_sword', action: (scene) => {
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 30) {
                            q.gold = (q.gold || 0) - 30;
                            const p = scene.registry.get('player');
                            p.skills.sword = Math.min(100, p.skills.sword + 5);
                            ActionLog.add(scene.registry, 'Купил длинный меч у кузнеца (+5 к навыку меча, -30 золота).');
                        }
                    } },
                    { text: 'Купить стальной меч (60 золота)', next: 'buy_steel', action: (scene) => {
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 60) {
                            q.gold = (q.gold || 0) - 60;
                            const p = scene.registry.get('player');
                            p.skills.sword = Math.min(100, p.skills.sword + 10);
                            p.DB = { text: '+1d4', min: 1, max: 4 };
                            ActionLog.add(scene.registry, 'Купил стальной меч у кузнеца (+10 к навыку, +бонус урона, -60 золота).');
                        }
                    } },
                    { text: 'Купить кожаную броню (25 золота)', next: 'buy_leather', action: (scene) => {
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 25) {
                            q.gold = (q.gold || 0) - 25;
                            const p = scene.registry.get('player');
                            p.HPmax = p.HPmax + 2;
                            p.HP = p.HP + 2;
                            ActionLog.add(scene.registry, 'Купил кожаную броню (+2 к макс. HP, -25 золота).');
                        }
                    } },
                    { text: 'Купить кольчугу (80 золота)', next: 'buy_chain', action: (scene) => {
                        const q = scene.registry.get('quest');
                        if ((q.gold || 0) >= 80) {
                            q.gold = (q.gold || 0) - 80;
                            const p = scene.registry.get('player');
                            p.HPmax = p.HPmax + 5;
                            p.HP = p.HP + 5;
                            ActionLog.add(scene.registry, 'Купил кольчугу (+5 к макс. HP, -80 золота).');
                        }
                    } },
                    { text: 'Спросить про вора', next: 'ask_thief' },
                    { text: 'Спасибо, я пойду.', end: true },
                ],
            },
            buy_sword: {
                speaker: 'Кузнец Данила',
                text: 'Бери, добрый клинок. Острый, лёгкий, в руке лежит как влитой.',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            buy_steel: {
                speaker: 'Кузнец Данила',
                text: 'Вот это настоящий меч! Сталь дамасская, сам ковал. Не подведёт.',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            buy_leather: {
                speaker: 'Кузнец Данила',
                text: 'Кожаная броня — лёгкая, но от удара спасёт. Носи на здоровье.',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            buy_chain: {
                speaker: 'Кузнец Данила',
                text: 'Кольчуга — самое то для серьёзного боя. Тяжеловата, но зато надёжна.',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            ask_thief: {
                speaker: 'Кузнец Данила',
                text: '...',
                action: (scene) => {
                    const r = askNPC(scene.registry, 'blacksmith', 'Кузнец Данила');
                    scene._lastAskResult = r;
                },
                choices: [
                    { text: '(продолжить)', next: 'ask_thief_result' },
                ],
            },
            ask_thief_result: {
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
                    { text: '(продолжить)', next: 'ask_thief_result' },
                ],
            },
            ask_thief_result: {
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
                    { text: '(продолжить)', next: 'ask_thief_result' },
                ],
            },
            ask_thief_result: {
                speaker: 'Вдова Марфа',
                text: '...',
                choices: [
                    { text: 'Спасибо.', end: true },
                ],
            },
        },
    },
};

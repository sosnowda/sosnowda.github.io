// Дерево диалогов. Каждый узел: speaker, text, choices[].
// choice: { text, next?, end?, action? } — action(scene) выполняется при выборе.
// Действия обращаются к сцене (VillageScene) через scene.registry и scene.autosave().

export const DIALOGUES = {
    elder: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Старейшина',
                text: 'Рад видеть тебя, путник. Беда у нас: в лесу обосновались разбойники и похитили чудотворную икону из нашей часовни.',
                choices: [
                    { text: 'Что мне сделать?', next: 'b' },
                    { text: 'Я ухожу.', end: true },
                ],
            },
            b: {
                speaker: 'Старейшина',
                text: 'Перейди через мост у реки и срази разбойника, что держит икону. Да хранит тебя Господь!',
                choices: [
                    {
                        text: 'Обещаю вернуть икону!',
                        next: 'c',
                        action: (scene) => {
                            const q = scene.registry.get('quest');
                            q.elderTalked = true;
                            scene.autosave();
                        },
                    },
                    { text: 'Позже.', end: true },
                ],
            },
            c: {
                speaker: 'Старейшина',
                text: 'Возьми благословение — твои раны затянутся. (Здоровье и воля восстановлены)',
                action: (scene) => {
                    const p = scene.registry.get('player');
                    p.HP = p.HPmax;
                    p.MP = p.MPmax;
                },
                choices: [{ text: 'Благодарю.', end: true }],
            },
        },
    },

    merchant: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Купец',
                text: 'Торгую солью, мехами и добрым словом. Хочешь травы целебной на ратный случай?',
                choices: [
                    {
                        text: 'Дай траву.',
                        next: 'b',
                        action: (scene) => {
                            const q = scene.registry.get('quest');
                            q.hasHerb = true;
                            q.merchantTalked = true;
                            scene.autosave();
                        },
                    },
                    { text: 'Меч получше не найдётся?', next: 'c' },
                    { text: 'Прощай.', end: true },
                ],
            },
            b: {
                speaker: 'Купец',
                text: 'Держи пучок череды. Прими в бою — и силы вернутся. (Получена целебная трава)',
                choices: [{ text: 'Спасибо.', end: true }],
            },
            c: {
                speaker: 'Купец',
                text: 'Мечи у меня добрые, да дороги. Авось и сам справишься, путник.',
                choices: [{ text: 'Как знаешь.', end: true }],
            },
        },
    },

    soldier: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Раненый воин',
                text: 'Ох... разбойники застали нас врасплох. Берегись их секача — бьёт подло и больно.',
                choices: [
                    {
                        text: 'Держи, перевяжу.',
                        next: 'b',
                        action: (scene) => {
                            const p = scene.registry.get('player');
                            p.HP = Math.min(p.HPmax, p.HP + Math.ceil(p.HPmax / 2));
                            const q = scene.registry.get('quest');
                            q.soldierTalked = true;
                            scene.autosave();
                        },
                    },
                    { text: 'Где их стоянка?', next: 'c' },
                    { text: 'Потерпи.', end: true },
                ],
            },
            b: {
                speaker: 'Раненый воин',
                text: 'Благодарю... ты добрый человек. (Восстановлено здоровье)',
                choices: [{ text: 'Береги себя.', end: true }],
            },
            c: {
                speaker: 'Раненый воин',
                text: 'Через мост, в чаще. Там один из них дозор держит. Смети его — и путь свободен.',
                choices: [{ text: 'Понял.', end: true }],
            },
        },
    },

    bandit: {
        start: 'a',
        nodes: {
            a: {
                speaker: 'Разбойник',
                text: 'Стой, путник! Икона теперь наша. Хочешь живым уйти — клади оружие.',
                choices: [
                    { text: 'Сражаться!', action: (scene) => { scene.time.delayedCall(60, () => scene.startCombat(scene.activeNpc)); } },
                    { text: 'Уйти прочь.', end: true },
                ],
            },
        },
    },
};

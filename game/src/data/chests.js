// Сундуки с лутом в деревне (раунд 11).
// Каждый сундук: id, координаты тайла (обязательно проходимые '.' — проверено
// validateMap-логикой вручную), подпись, таблица лута и редкость.
// Открывается один раз в игровой день: в q.chestsOpened хранится [{id, day}].
// Раунд 15: подписи локализованы (i18n).
// Раунд 37 (п.14 заявки): сундук у постоялого двора и сундук за амбаром
// УДАЛЕНЫ («удалить все сундуки… около постоялого двора»); церковный
// ларец перенесён с бывшей дороги (20,14) на чистую траву (18,12).
import { t, tf } from '../systems/i18n.js';

export const CHESTS = [
    {
        id: 'well_bundle',
        col: 11,
        row: 10,
        label: t('Тюк у колодца'),
        rare: false,
        // Кто-то обронил узелок у колодца
        loot: [
            { kind: 'money', min: 1, max: 3, weight: 6 },
            { kind: 'apple', weight: 4 },
        ],
    },
    {
        id: 'church_relic',
        col: 18,
        row: 12,
        label: t('Позолоченный ларец'),
        rare: true,
        // Редкий ларец за церковью — заметная награда
        loot: [
            { kind: 'money', min: 10, max: 16, weight: 7 },
            { kind: 'icon_scrap', weight: 3 },
        ],
    },
    // Раунд 37: новый сундук у овчарни (взамен убранных) — чабан прячет
    // выручку от шерсти за частоколом
    {
        id: 'sheepfold_bundle',
        col: 21,
        row: 19,
        label: t('Узел чабана у овчарни'),
        rare: false,
        loot: [
            { kind: 'money', min: 2, max: 5, weight: 6 },
            { kind: 'apple', weight: 4 },
        ],
    },
];

// Достать сундук по координатам тайла (для updateNearestInteractable)
export function chestAt(col, row) {
    return CHESTS.find(c => c.col === col && c.row === row) || null;
}

// Раунд 12: домашние тайники в интерьерах («свой тюк» — по одному в день).
// Работают через те же q.chestsOpened + dayKey, что и уличные сундуки,
// но открываются КНОПКОЙ в интерьере (InteriorScene), а не по E на карте.
export const STASHES = {
    tavern: {
        id: 'stash_tavern',
        label: t('твой тюк за лавкой'),
        // У тавернщика на сохранении: перекус и мелочь на дорогу
        loot: [
            { kind: 'apple', weight: 5 },
            { kind: 'money', min: 1, max: 3, weight: 5 },
        ],
    },
    potter: {
        id: 'stash_potter',
        label: t('твой узел в углу мастерской'),
        // Работничий узел: хлеб да несколько монет за смену
        loot: [
            { kind: 'apple', weight: 6 },
            { kind: 'money', min: 2, max: 4, weight: 4 },
        ],
    },
};

// Ключ игрового дня из timeState (та же формула, что в InteriorScene.dayKey)
export function dayKeyOf(timeState) {
    return timeState
        ? `${timeState.yearFromChrist}-${timeState.month}-${timeState.day}`
        : 'unknown';
}

// Уже открыт сегодня?
export function isOpenedToday(quest, chestId, today) {
    const list = (quest && quest.chestsOpened) || [];
    return list.some(e => e && e.id === chestId && e.day === today);
}

// Отметить открытие (мутирует quest, сохранение — на вызывающей стороне)
export function markOpened(quest, chestId, today) {
    if (!quest.chestsOpened) quest.chestsOpened = [];
    quest.chestsOpened.push({ id: chestId, day: today });
}

// Взвешенный выбор элемента лута
export function rollLoot(chest) {
    const total = chest.loot.reduce((s, l) => s + (l.weight || 1), 0);
    let roll = Math.random() * total;
    for (const l of chest.loot) {
        roll -= (l.weight || 1);
        if (roll <= 0) return l;
    }
    return chest.loot[chest.loot.length - 1];
}

// Человекочитаемое имя предмета (для всплывающего текста и лога)
export function lootDisplayName(loot, amount) {
    switch (loot.kind) {
        case 'money': return tf('+{0} денги', amount);
        case 'apple': return t('Яблоко: +2 ❤');
        case 'icon_scrap': return t('Медная иконка: +1 ⭐');
        default: return t('Пусто');
    }
}

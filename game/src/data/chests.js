// Сундуки с лутом в деревне (раунд 11).
// Каждый сундук: id, координаты тайла (обязательно проходимые '.' — проверено
// validateMap-логикой вручную), подпись, таблица лута и редкость.
// Открывается один раз в игровой день: в q.chestsOpened хранится [{id, day}].
//
// Позиции подобраны по карте buildMap() (26×18):
//   (9, 6)   — сбоку таверны, между домом старосты и tavern (трава '.'),
//   (21, 3)  — за амбаром с севера (трава '.', южнее — дорожная лента),
//   (11, 10) — у колодца (колодец 'W' в (10,10), тюк «обронён» рядом),
//   (20, 14) — за церковью (трава '.', рядом дерево (22,14)) — редкий ларец.

export const CHESTS = [
    {
        id: 'tavern_side',
        col: 9,
        row: 6,
        label: 'Сундук у таверны',
        rare: false,
        // Путники обронили мелочь
        loot: [
            { kind: 'money', min: 2, max: 5, weight: 7 },
            { kind: 'apple', weight: 3 },
        ],
    },
    {
        id: 'barn_back',
        col: 21,
        row: 3,
        label: 'Сундук за амбаром',
        rare: false,
        // Работник амбара держит тут припасы
        loot: [
            { kind: 'apple', weight: 5 },
            { kind: 'money', min: 3, max: 6, weight: 5 },
        ],
    },
    {
        id: 'well_bundle',
        col: 11,
        row: 10,
        label: 'Тюк у колодца',
        rare: false,
        // Кто-то обронил узелок у колодца
        loot: [
            { kind: 'money', min: 1, max: 3, weight: 6 },
            { kind: 'apple', weight: 4 },
        ],
    },
    {
        id: 'church_relic',
        col: 20,
        row: 14,
        label: 'Позолоченный ларец',
        rare: true,
        // Редкий ларец за церковью — заметная награда
        loot: [
            { kind: 'money', min: 10, max: 16, weight: 7 },
            { kind: 'icon_scrap', weight: 3 },
        ],
    },
];

// Достать сундук по координатам тайла (для updateNearestInteractable)
export function chestAt(col, row) {
    return CHESTS.find(c => c.col === col && c.row === row) || null;
}

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
        case 'money': return `+${amount} денги`;
        case 'apple': return 'Яблоко: +2 ❤';
        case 'icon_scrap': return 'Медная иконка: +1 ⭐';
        default: return 'Пусто';
    }
}

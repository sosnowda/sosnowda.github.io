// Определения интерьеров зданий деревни.
// Каждое здание имеет: id, name, вход (дверь), интерьер (NPC, предметы, диалоги).

export const INTERIORS = {
    elder_house: {
        id: 'elder_house',
        name: 'Дом старосты',
        npcId: 'elder',
        npcName: 'Староста Мирослав',
        npcSprite: 'npc_elder',
        portrait: 'portrait_elder',
        // Староста выдаёт задание
        dialogueId: 'elder_quest',
        description: 'Уютная горница с иконами в углу. Староста сидит за столом, перебирая бумаги.',
        decor: ['icons', 'table', 'candle'],
    },

    tavern: {
        id: 'tavern',
        name: 'Таверна «У дороги»',
        npcId: 'tavernkeeper',
        npcName: 'Тавернщик Фёдор',
        npcSprite: 'npc_merchant',
        portrait: 'portrait_merchant',
        dialogueId: 'tavernkeeper',
        description: 'Просторный зал с деревянными столами. Пахнет хлебом и медовухой. У камина греются путники.',
        decor: ['bar', 'tables', 'fireplace'],
        services: ['eat', 'drink', 'rest'],
        prices: { eat: 5, drink: 3, rest: 10 },
    },

    blacksmith: {
        id: 'blacksmith',
        name: 'Кузница',
        npcId: 'blacksmith',
        npcName: 'Кузнец Данила',
        npcSprite: 'npc_soldier',
        portrait: 'portrait_soldier',
        dialogueId: 'blacksmith',
        description: 'Жарко. Стук молота по наковальне. На стенах развешаны мечи и кольчуги.',
        decor: ['anvil', 'forge', 'weapons'],
        services: ['buy_weapon', 'buy_armor'],
        items: [
            { id: 'sword_long', name: 'Длинный меч', type: 'weapon', price: 30, dmg: { min: 1, max: 10 }, bonus: 2, skill: 'sword' },
            { id: 'sword_steel', name: 'Стальной меч', type: 'weapon', price: 60, dmg: { min: 1, max: 12 }, bonus: 3, skill: 'sword' },
            { id: 'armor_leather', name: 'Кожаная броня', type: 'armor', price: 25, def: 1 },
            { id: 'armor_chain', name: 'Кольчуга', type: 'armor', price: 80, def: 2 },
        ],
    },

    villager_house_1: {
        id: 'villager_house_1',
        name: 'Дом крестьянина',
        npcId: 'peasant1',
        npcName: 'Крестьянин Авдей',
        npcSprite: 'npc_merchant',
        portrait: 'portrait_narrator',
        dialogueId: 'peasant1',
        description: 'Скромная изба. Хозяин сидит на лавке, с обеспокоенным лицом.',
        decor: ['bed', 'table'],
    },

    villager_house_2: {
        id: 'villager_house_2',
        name: 'Дом вдовы',
        npcId: 'widow',
        npcName: 'Вдова Марфа',
        npcSprite: 'npc_elder',
        portrait: 'portrait_narrator',
        dialogueId: 'widow',
        description: 'Тихий дом. У окна сидит пожилая женщина, перебирая чётки.',
        decor: ['bed', 'icon'],
    },

    // Церковь со священником — выдаёт основное задание (поиск иконы)
    church: {
        id: 'church',
        name: 'Церковь Рождества Богородицы',
        npcId: 'priest',
        npcName: 'Отец Савватий',
        npcSprite: 'npc_elder',
        portrait: 'portrait_elder',
        dialogueId: 'priest',
        description: 'Небольшая деревянная церковь с резным иконостасом. Пахнет ладаном и воском. У алтаря молится седой священник.',
        decor: ['altar', 'icons', 'candles'],
    },
};

// Координаты зданий в деревне (col, row — верхний-левый угол двери)
export const BUILDINGS = [
    { interiorId: 'elder_house', col: 4, row: 4, w: 3, h: 3, label: 'Староста' },
    { interiorId: 'tavern', col: 10, row: 4, w: 3, h: 3, label: 'Таверна' },
    { interiorId: 'blacksmith', col: 16, row: 4, w: 3, h: 3, label: 'Кузница' },
    { interiorId: 'church', col: 20, row: 11, w: 3, h: 3, label: 'Церковь' },
    { interiorId: 'villager_house_1', col: 4, row: 11, w: 3, h: 3, label: 'Дом Авдея' },
    { interiorId: 'villager_house_2', col: 10, row: 11, w: 3, h: 3, label: 'Дом Марфы' },
];

// Ворота на выходе из деревни (правый край карты)
export const VILLAGE_GATE = { col: 23, row: 9, label: 'Ворота' };

// Локации на развилке
export const FORK_LOCATIONS = [
    { id: 'forest', name: 'Лес', icon: '🌲', description: 'Густой лес за рекой. Много следов, но и много зверья.' },
    { id: 'road', name: 'Тракт', icon: '🛤', description: 'Торный тракт на юг, к большим городам.' },
    { id: 'river', name: 'Река', icon: '🌊', description: 'Брод через реку. Галька, илистый берег — следы видны хорошо.' },
    { id: 'field', name: 'Поле', icon: '🌾', description: 'Рожковое поле на восток. Высокие стебли скрывают следы.' },
];

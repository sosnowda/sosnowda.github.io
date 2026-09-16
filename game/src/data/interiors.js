// Определения интерьеров зданий деревни.
// Каждое здание имеет: id, name, вход (дверь), интерьер (NPC, предметы, диалоги).
// Раунд 15: названия/описания/NPC локализованы (i18n).
import { t } from '../systems/i18n.js';

export const INTERIORS = {
    elder_house: {
        id: 'elder_house',
        name: t('Дом старосты'),
        npcId: 'elder',
        npcName: t('Староста Мирослав'),
        npcSprite: 'npc_elder',
        portrait: 'portrait_elder',
        // Староста выдаёт задание
        dialogueId: 'elder_quest',
        description: t('Уютная горница с иконами в углу. Староста сидит за столом, перебирая бумаги.'),
        decor: ['icons', 'table', 'candle'],
    },

    tavern: {
        id: 'tavern',
        name: t('Таверна «У дороги»'),
        npcId: 'tavernkeeper',
        npcName: t('Тавернщик Фёдор'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_tavernkeeper',
        dialogueId: 'tavernkeeper',
        description: t('Просторный зал с деревянными столами. Пахнет хлебом и медовухой. У камина греются путники.'),
        decor: ['bar', 'tables', 'fireplace'],
        services: ['eat', 'drink', 'rest'],
        prices: { eat: 5, drink: 3, rest: 10 },
    },

    blacksmith: {
        id: 'blacksmith',
        name: t('Кузница'),
        npcId: 'blacksmith',
        npcName: t('Кузнец Данила'),
        npcSprite: 'npc_soldier',
        portrait: 'portrait_blacksmith',
        dialogueId: 'blacksmith',
        description: t('Жарко. Стук молота по наковальне. На стенах развешаны мечи и кольчуги.'),
        decor: ['anvil', 'forge', 'weapons'],
        services: ['buy_weapon', 'buy_armor'],
        items: [
            { id: 'sword_long', name: t('Длинный меч'), type: 'weapon', price: 30, dmg: { min: 1, max: 10 }, bonus: 2, skill: 'sword' },
            { id: 'sword_steel', name: t('Стальной меч'), type: 'weapon', price: 60, dmg: { min: 1, max: 12 }, bonus: 3, skill: 'sword' },
            { id: 'armor_leather', name: t('Кожаная броня'), type: 'armor', price: 25, def: 1 },
            { id: 'armor_chain', name: t('Кольчуга'), type: 'armor', price: 80, def: 2 },
        ],
    },

    villager_house_1: {
        id: 'villager_house_1',
        name: t('Дом крестьянина'),
        npcId: 'peasant1',
        npcName: t('Крестьянин Авдей'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'peasant1',
        description: t('Скромная изба. Хозяин сидит на лавке, с обеспокоенным лицом.'),
        decor: ['bed', 'table'],
    },

    villager_house_2: {
        id: 'villager_house_2',
        name: t('Дом вдовы'),
        npcId: 'widow',
        npcName: t('Вдова Марфа'),
        npcSprite: 'npc_elder',
        portrait: 'portrait_widow',
        dialogueId: 'widow',
        description: t('Тихий дом. У окна сидит пожилая женщина, перебирая чётки.'),
        decor: ['bed', 'icon'],
    },

    // Амбар общины — подённая работа (молотьба зерна) за деньги.
    // Без NPC: кнопки «Работать» и «Осмотреть зерно» — особый набор действий.
    barn: {
        id: 'barn',
        name: t('Амбар общины'),
        npcId: null,
        npcName: t('Работник не показывается'),
        npcSprite: 'npc_merchant',
        portrait: null,
        dialogueId: null,
        description: t('Снопы под потолком, мешки с зерном, пахнет сухой соломой и мышами. Община хранит здесь общее зерно — за молотьбу платят по копеечке.'),
        decor: ['hay', 'sacks', 'firewood', 'shelf'],
        noNpc: true,
    },

    // Церковь со священником — выдаёт основное задание (поиск иконы).
    // Раунд 26: часовня удалена из деревни — святыня одна; сюжет кражи,
    // молитва, пожертвование и осмотр киота теперь живут здесь.
    church: {
        id: 'church',
        name: t('Церковь Рождества Богородицы'),
        npcId: 'priest',
        npcName: t('Отец Савватий'),
        npcSprite: 'npc_elder',
        portrait: 'portrait_priest',
        dialogueId: 'priest',
        description: t('Небольшая деревянная церковь с резным иконостасом. Пахнет ладаном и воском. У алтаря молится седой священник, а ниша главного киота пуста — чудотворную икону этой ночью унесли воры.'),
        decor: ['empty_kiot', 'altar', 'icons', 'candles'],
    },
};

// Координаты зданий в деревне (col, row — верхний-левый угол двери)
// Раунд 9: + Амбар (северо-восток). Раунд 26: часовня удалена — есть церковь.
// Двери и дорожки строятся автоматически в world.buildMap(),
// проходимость проверяет validateMap() (BFS от спавна).
export const BUILDINGS = [
    { interiorId: 'elder_house', col: 4, row: 4, w: 3, h: 3, label: t('Староста') },
    { interiorId: 'tavern', col: 10, row: 4, w: 3, h: 3, label: t('Таверна') },
    { interiorId: 'blacksmith', col: 16, row: 4, w: 3, h: 3, label: t('Кузница') },
    { interiorId: 'barn', col: 20, row: 4, w: 3, h: 3, label: t('Амбар') },
    { interiorId: 'villager_house_1', col: 4, row: 11, w: 3, h: 3, label: t('Дом Авдея') },
    { interiorId: 'villager_house_2', col: 10, row: 11, w: 3, h: 3, label: t('Дом Марфы') },
    { interiorId: 'church', col: 20, row: 11, w: 3, h: 3, label: t('Церковь') },
];

// Ворота на выходе из деревни (правый край карты)
export const VILLAGE_GATE = { col: 23, row: 9, label: t('Ворота') };

// Локации на развилке
export const FORK_LOCATIONS = [
    { id: 'forest', name: t('Лес'), icon: '🌲', description: t('Густой лес за рекой. Много следов, но и много зверья.') },
    { id: 'road', name: t('Тракт'), icon: '🛤', description: t('Торный тракт на юг, к большим городам.') },
    { id: 'river', name: t('Река'), icon: '🌊', description: t('Брод через реку. Галька, илистый берег — следы видны хорошо.') },
    { id: 'field', name: t('Поле'), icon: '🌾', description: t('Рожковое поле на восток. Высокие стебли скрывают следы.') },
];

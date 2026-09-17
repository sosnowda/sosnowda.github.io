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
        // Раунд 27 (п.9): у старосты есть жена — Любава (у печи)
        secondaryNpcId: 'elder_wife',
        secondaryNpcName: t('Любава, жена старосты'),
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'elder_wife',
    },

    // Раунд 27 (п.12): владелец переименовал таверну в «Постоялый двор»
    // (внутренний id 'tavern' не меняем — на нём завязаны сейвы и код).
    tavern: {
        id: 'tavern',
        name: t('Постоялый двор «У дороги»'),
        npcId: 'tavernkeeper',
        npcName: t('Тавернщик Фёдор'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_tavernkeeper',
        dialogueId: 'tavernkeeper',
        description: t('Просторный зал с деревянными столами. Пахнет хлебом да хмельным мёдом. У печи греются путники.'),
        decor: ['bar', 'tables', 'fireplace'],
        services: ['eat', 'drink', 'rest'],
        // Раунд 30: цены — из репозитория игры ChroniclesRuthenia:
        // еда (трапеза) 2 д. = каравай хлеба 1 д. + похлёбка 1 д. (FoodCatalog);
        // рацион (хлеб + бурдюк воды на день) 2 д. (FoodCatalog: bread 1 + water 1);
        // ночлег на постоялом дворе 2 д. с человека (RestService.PLACES.inn).
        prices: { eat: 2, drink: 3, rest: 2, ration: 2 },
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
        name: t('Дом Марфы'),
        npcId: 'widow',
        npcName: t('Пасечница Марфа'),
        npcSprite: 'npc_elder',
        portrait: 'portrait_widow',
        dialogueId: 'widow',
        description: t('Тихий дом. Пахнет сушёными травами и мёдом. Хозяйка приглядывает за горшками с целебными настоями.'),
        decor: ['bed', 'icon'],
    },

    // Раунд 27 (п.6), раунд 28 (п.1): дом на месте убранной часовни —
    // ДОМ ПАХАРЯ (не пасечника!): Тарас днём на поле, Фёкла с семерыми детьми.
    beekeeper_house: {
        id: 'beekeeper_house',
        name: t('Дом пахаря'),
        npcId: 'beekeeper1',
        npcName: t('Пахарь Тарас'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'beekeeper1',
        description: t('Изба полна детского гомона: у Тараса и Фёклы семеро детей. У крыльца — соха, на лавках — клубки шерсти, в углу — плетёные корзины для грибов.'),
        decor: ['bed', 'table', 'cradle'],
        // Жена — вторая фигура в доме (как у старосты)
        secondaryNpcId: 'beekeeper_wife',
        secondaryNpcName: t('Фёкла, жена пахаря'),
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'beekeeper_wife',
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
// Раунд 27 (п.6), раунд 28 (п.1): на свободном месте часовни — ДОМ ПАХАРЯ.
// Двери и дорожки строятся автоматически в world.buildMap(),
// проходимость проверяет validateMap() (BFS от спавна).
export const BUILDINGS = [
    { interiorId: 'elder_house', col: 4, row: 4, w: 3, h: 3, label: t('Староста') },
    { interiorId: 'tavern', col: 10, row: 4, w: 3, h: 3, label: t('Постоялый двор') },
    { interiorId: 'blacksmith', col: 16, row: 4, w: 3, h: 3, label: t('Кузница') },
    { interiorId: 'barn', col: 20, row: 4, w: 3, h: 3, label: t('Амбар') },
    { interiorId: 'villager_house_1', col: 4, row: 11, w: 3, h: 3, label: t('Дом Авдея') },
    { interiorId: 'villager_house_2', col: 10, row: 11, w: 3, h: 3, label: t('Дом Марфы') },
    { interiorId: 'beekeeper_house', col: 15, row: 11, w: 3, h: 3, label: t('Дом пахаря') },
    { interiorId: 'church', col: 20, row: 11, w: 3, h: 3, label: t('Церковь') },
];

// Ворота на выходе из деревни (правый край карты)
export const VILLAGE_GATE = { col: 23, row: 9, label: t('Ворота') };

// Локации на развилке (раунд 30: лес — тремя частями: опушка/поляна/чаща)
export const FORK_LOCATIONS = [
    { id: 'forest_edge', name: t('Опушка леса'), icon: '🌳', description: t('Краешек леса, где кончается трава и начинаются деревья. Светло, грибные места да ягодные кусты.') },
    { id: 'forest_glade', name: t('Лесная поляна'), icon: '🌼', description: t('Солнечная поляна среди леса, в кольце деревьев. Много цветов, ягод и пчелиного звона.') },
    { id: 'forest', name: t('Лес'), icon: '🌲', description: t('Густая чаща за опушкой и поляной. Много следов, но и много зверья.') },
    { id: 'road', name: t('Тракт'), icon: '🛤', description: t('Торный тракт на юг, к большим городам.') },
    { id: 'river', name: t('Река'), icon: '🌊', description: t('Брод через реку. Галька, илистый берег — следы видны хорошо.') },
    { id: 'field', name: t('Поле'), icon: '🌾', description: t('Рожковое поле на восток. Высокие стебли скрывают следы.') },
];

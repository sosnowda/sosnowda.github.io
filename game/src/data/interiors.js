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
        public: true,  // раунд 37: постоялый двор открыт всегда (тавернщик за стойкой 24/7)
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

    // РАУНД 37 (вариант Б, п.18 заявки): АМБАР УДАЛЁН — на его месте
    // ДОМ ГОНЧАРА: Игнат, жена Анна, дочка Дунька. Подённая работа
    // (молотьба) переехала сюда как «помощь в мастерской».
    potter_house: {
        id: 'potter_house',
        name: t('Дом гончара'),
        npcId: 'potter1',
        npcName: t('Гончар Игнат'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'potter1',
        description: t('Тесная мастерская: круг, стопки сырых горшков, запах глины и печного жара. Хозяин приглядывает к заготовкам, вымазанный по локти.'),
        decor: ['bed', 'table', 'pottery'],
        // Жена — вторая фигура в доме (как у старосты)
        secondaryNpcId: 'potter_wife',
        secondaryNpcName: t('Анна, жена гончара'),
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'potter_wife',
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
        public: true,
    },

    // ===== РАУНД 37 (вариант Б): НОВАЯ УЛИЦА — 4 новых двора =====

    // Дом знахарки — свой дом для травницы (раньше «жила» у Марфы)
    healer_house: {
        id: 'healer_house',
        name: t('Дом знахарки'),
        npcId: 'healer',
        npcName: t('Знахарка Февронья'),
        npcSprite: 'npc_elder',
        portrait: 'portrait_healer',
        dialogueId: 'healer1',
        description: t('Пахнет сушёными травами и воском. Пучки полыни и зверобоя под потолком, ступка, у печи — бабушка с внучкой перебирают коренья.'),
        decor: ['bed', 'icon', 'herbs'],
        secondaryNpcId: 'kid9',
        secondaryNpcName: t('Ульяна, внучка знахарки'),
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_girl',
        secondaryDialogueId: 'kid9',
    },

    // Дом рыбака — свой дом для рыбака (был «у Авдея»)
    fisher_house: {
        id: 'fisher_house',
        name: t('Дом рыбака'),
        npcId: 'fisherman',
        npcName: t('Рыбак Ерёма'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_fisherman',
        dialogueId: 'fisherman1',
        description: t('Сети сушатся под потолком, на лавке — плетёные верши и уды. У печи хозяйка потрошит улов.'),
        decor: ['bed', 'table', 'nets'],
        secondaryNpcId: 'fisher_wife',
        secondaryNpcName: t('Домна, жена рыбака'),
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'fisher_wife',
    },

    // Дом плотника — новый двор (Микула и Матрёна)
    carpenter_house: {
        id: 'carpenter_house',
        name: t('Дом плотника'),
        npcId: 'carpenter1',
        npcName: t('Плотник Микула'),
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'carpenter1',
        description: t('Во дворе — брёвна, тесла и скобы. В избе пахнет свежей стружкой: хозяин тешет ложки, жена прядёт у печи.'),
        decor: ['bed', 'table', 'tools'],
        secondaryNpcId: 'carpenter_wife',
        secondaryNpcName: t('Матрёна, жена плотника'),
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'carpenter_wife',
    },

    // Дом ткачихи — вдова Пелагея с сыном-пастушком (Ивашка при овчарне)
    weaver_house: {
        id: 'weaver_house',
        name: t('Дом ткачихи'),
        npcId: 'weaver1',
        npcName: t('Ткачиха Пелагея'),
        npcSprite: 'npc_elder',
        portrait: 'portrait_villager_f',
        dialogueId: 'weaver1',
        description: t('Полутьма, у окна — ткацкий стан, на нём — недотянутый холст. Клубки шерсти, прялка, пучки льна. Хозяйка работает, не поднимая глаз.'),
        decor: ['bed', 'loom', 'yarn'],
    },
};

// Координаты зданий в деревне (col, row — верхний-левый угол двери)
// Раунд 9: + Амбар (северо-восток). Раунд 26: часовня удалена — есть церковь.
// Раунд 27 (п.6), раунд 28 (п.1): на свободном месте часовни — ДОМ ПАХАРЯ.
// Раунд 37 (вариант Б): амбар → ДОМ ГОНЧАРА; вторая улица (ряды 15–17) —
// дома знахарки, плотника, рыбака и ткачихи. Двери и дорожки строятся
// автоматически в world.buildMap(), проходимость проверяет validateMap().
export const BUILDINGS = [
    { interiorId: 'elder_house', col: 4, row: 4, w: 3, h: 3, label: t('Староста') },
    { interiorId: 'tavern', col: 10, row: 4, w: 3, h: 3, label: t('Постоялый двор') },
    { interiorId: 'blacksmith', col: 16, row: 4, w: 3, h: 3, label: t('Кузница') },
    { interiorId: 'potter_house', col: 20, row: 4, w: 3, h: 3, label: t('Дом гончара') },
    { interiorId: 'villager_house_1', col: 4, row: 11, w: 3, h: 3, label: t('Дом Авдея') },
    { interiorId: 'villager_house_2', col: 10, row: 11, w: 3, h: 3, label: t('Дом Марфы') },
    { interiorId: 'beekeeper_house', col: 15, row: 11, w: 3, h: 3, label: t('Дом пахаря') },
    { interiorId: 'church', col: 20, row: 11, w: 3, h: 3, label: t('Церковь') },
    // Раунд 37: новая улица (ряды 15–17, двери на второй улице)
    { interiorId: 'healer_house', col: 3, row: 15, w: 3, h: 3, label: t('Дом знахарки') },
    { interiorId: 'carpenter_house', col: 9, row: 15, w: 3, h: 3, label: t('Дом плотника') },
    { interiorId: 'fisher_house', col: 15, row: 15, w: 3, h: 3, label: t('Дом рыбака') },
    { interiorId: 'weaver_house', col: 20, row: 15, w: 3, h: 3, label: t('Дом ткачихи') },
];

// Ворота на выходе из деревни (правый край карты)
export const VILLAGE_GATE = { col: 23, row: 9, label: t('Ворота') };

// Локации на развилке (раунд 30: лес — тремя частями; раунд 39 (п.23):
// лес — единая локация цепочкой, вход только через Опушку; «Лес» = Густой лес).
export const FORK_LOCATIONS = [
    { id: 'forest_edge', name: t('Опушка леса'), icon: '🌳', description: t('Краешек леса, где кончается трава и начинаются деревья. Светло, грибные места да ягодные кусты.') },
    { id: 'forest_glade', name: t('Лесная поляна'), icon: '🌼', description: t('Солнечная поляна среди леса, в кольце деревьев. Много цветов, ягод и пчелиного звона.') },
    { id: 'forest', name: t('Густой лес'), icon: '🌲', description: t('Глубина леса: тёмная чаща за опушкой и поляной. Много следов, но и много зверья.') },
    { id: 'road', name: t('Тракт'), icon: '🛤', description: t('Торный тракт на юг, к большим городам.') },
    { id: 'river', name: t('Река'), icon: '🌊', description: t('Брод через реку. Галька, илистый берег — следы видны хорошо.') },
    { id: 'field', name: t('Поле'), icon: '🌾', description: t('Рожковое поле на восток. Высокие стебли скрывают следы.') },
];

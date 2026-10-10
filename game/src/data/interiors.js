// Определения интерьеров зданий деревни.
// Каждое здание имеет: id, name, вход (дверь), интерьер (NPC, предметы, диалоги).
// Раунд 15: названия/описания/NPC локализованы (i18n).
// 66.97 (§12.3 аудита 66.92, п.4 i18n-гигиена): t() переведён с load-time на
// ЛЕНИВОЕ оборачивание при выводе (геттеры) — name/npcName/description/label
// вычисляются в момент обращения, а не при импорте модуля.
import { t } from '../systems/i18n.js';

export const INTERIORS = {
    elder_house: {
        id: 'elder_house',
        get name() { return t('Дом старосты'); },
        npcId: 'elder',
        get npcName() { return t('Староста Мирослав'); },
        npcSprite: 'npc_elder',
        portrait: 'portrait_elder',
        // Староста выдаёт задание
        dialogueId: 'elder_quest',
        get description() { return t('Уютная горница с иконами в углу. Староста сидит за столом, перебирая бумаги.'); },
        decor: ['icons', 'table', 'candle'],
        // Раунд 27 (п.9): у старосты есть жена — Любава (у печи)
        secondaryNpcId: 'elder_wife',
        get secondaryNpcName() { return t('Любава, жена старосты'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'elder_wife',
    },

    // Раунд 27 (п.12): владелец переименовал таверну в «Постоялый двор»
    // (внутренний id 'tavern' не меняем — на нём завязаны сейвы и код).
    tavern: {
        id: 'tavern',
        get name() { return t('Постоялый двор «У дороги»'); },
        npcId: 'tavernkeeper',
        get npcName() { return t('Тавернщик Фёдор'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_tavernkeeper',
        dialogueId: 'tavernkeeper',
        get description() { return t('Просторный зал с деревянными столами. Пахнет хлебом да хмельным мёдом. У печи греются путники.'); },
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
        get name() { return t('Кузница'); },
        npcId: 'blacksmith',
        get npcName() { return t('Кузнец Данила'); },
        npcSprite: 'npc_soldier',
        portrait: 'portrait_blacksmith',
        dialogueId: 'blacksmith',
        get description() { return t('Жарко. Стук молота по наковальне. На стенах — топоры, копья да кольчуги.'); },
        decor: ['anvil', 'forge', 'weapons'],
        services: ['buy_weapon', 'buy_armor'],
        // Раунд 45 (п.6 заявки — АУДИТ ОРУЖИЯ/БРОНИ): прежний массив items
        // (sword_long 30 д. 1d10+2, sword_steel 60 д. 1d12+3, armor_leather
        // def 1, armor_chain def 2) был МЁРТВЫМИ ДАННЫМИ — ни одна сцена его
        // не читала, а его цены/статы расходились с боевой системой
        // (Character.js WEAPONS/ARMORS: «Меч» 30 д. 1d8+1, «Стальной меч»
        // 100 д. 1d10+3, кольчуга def 4). Удалён: кузница торгует ТОЛЬКО
        // по реестру Character.js (см. InteriorScene.showBlacksmithShop).
    },

    villager_house_1: {
        id: 'villager_house_1',
        get name() { return t('Дом крестьянина'); },
        npcId: 'peasant1',
        get npcName() { return t('Крестьянин Авдей'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'peasant1',
        get description() { return t('Скромная изба. Хозяин сидит на лавке, с обеспокоенным лицом.'); },
        decor: ['bed', 'table'],
    },

    villager_house_2: {
        id: 'villager_house_2',
        get name() { return t('Дом Марфы'); },
        npcId: 'widow',
        get npcName() { return t('Пасечница Марфа'); },
        npcSprite: 'npc_elder',
        // Раунд 66.21 (приказ 8): портрет по возрасту (55 лет)
        portrait: 'portrait_healer',
        dialogueId: 'widow',
        get description() { return t('Тихий дом. Пахнет сушёными травами и мёдом. Хозяйка приглядывает за горшками с целебными настоями.'); },
        decor: ['bed', 'icon'],
    },

    // Раунд 27 (п.6), раунд 28 (п.1): дом на месте убранной часовни —
    // ДОМ ПАХАРЯ (не пасечника!): Тарас днём на поле, Фёкла с семерыми детьми.
    beekeeper_house: {
        id: 'beekeeper_house',
        get name() { return t('Дом пахаря'); },
        npcId: 'beekeeper1',
        get npcName() { return t('Пахарь Тарас'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'beekeeper1',
        get description() { return t('Изба полна детского гомона: у Тараса и Фёклы семеро детей. У крыльца — соха, на лавках — клубки шерсти, в углу — плетёные корзины для грибов.'); },
        decor: ['bed', 'table', 'cradle'],
        // Жена — вторая фигура в доме (как у старосты)
        secondaryNpcId: 'beekeeper_wife',
        get secondaryNpcName() { return t('Фёкла, жена пахаря'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'beekeeper_wife',
    },

    // РАУНД 37 (вариант Б, п.18 заявки): АМБАР УДАЛЁН — на его месте
    // ДОМ ГОНЧАРА: Игнат, жена Анна, дочка Дунька. Подённая работа
    // (молотьба) переехала сюда как «помощь в мастерской».
    potter_house: {
        id: 'potter_house',
        get name() { return t('Дом гончара'); },
        npcId: 'potter1',
        get npcName() { return t('Гончар Игнат'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'potter1',
        get description() { return t('Тесная мастерская: круг, стопки сырых горшков, запах глины и печного жара. Хозяин приглядывает к заготовкам, вымазанный по локти.'); },
        decor: ['bed', 'table', 'pottery'],
        // Жена — вторая фигура в доме (как у старосты)
        secondaryNpcId: 'potter_wife',
        get secondaryNpcName() { return t('Анна, жена гончара'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'potter_wife',
    },

    // Церковь со священником — выдаёт основное задание (поиск иконы).
    // Раунд 26: часовня удалена из деревни — святыня одна; сюжет кражи,
    // молитва, пожертвование и осмотр киота теперь живут здесь.
    church: {
        id: 'church',
        get name() { return t('Церковь Рождества Богородицы'); },
        npcId: 'priest',
        get npcName() { return t('Отец Савватий'); },
        npcSprite: 'npc_elder',
        portrait: 'portrait_priest',
        dialogueId: 'priest',
        get description() { return t('Небольшая деревянная церковь с резным иконостасом. Пахнет ладаном и воском. У алтаря молится седой священник, а ниша главного киота пуста — чудотворную икону этой ночью унесли воры.'); },
        decor: ['empty_kiot', 'altar', 'icons', 'candles'],
        public: true,
    },

    // ===== РАУНД 37 (вариант Б): НОВАЯ УЛИЦА — 4 новых двора =====

    // Дом знахарки — свой дом для травницы (раньше «жила» у Марфы)
    healer_house: {
        id: 'healer_house',
        get name() { return t('Дом знахарки'); },
        npcId: 'healer',
        get npcName() { return t('Знахарка Февронья'); },
        npcSprite: 'npc_elder',
        portrait: 'portrait_healer',
        dialogueId: 'healer1',
        get description() { return t('Пахнет сушёными травами и воском. Пучки полыни и зверобоя под потолком, ступка, у печи — бабушка с внучкой перебирают коренья.'); },
        decor: ['bed', 'icon', 'herbs'],
        secondaryNpcId: 'kid9',
        get secondaryNpcName() { return t('Ульяна, внучка знахарки'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_girl',
        secondaryDialogueId: 'kid9',
    },

    // Дом рыбака — свой дом для рыбака (был «у Авдея»)
    fisher_house: {
        id: 'fisher_house',
        get name() { return t('Дом рыбака'); },
        npcId: 'fisherman',
        get npcName() { return t('Рыбак Ерёма'); },
        npcSprite: 'npc_merchant',
        // Раунд 66.21 (приказ 8): портрет по возрасту (42 года)
        portrait: 'portrait_tavernkeeper',
        dialogueId: 'fisherman1',
        get description() { return t('Сети сушатся под потолком, на лавке — плетёные верши и уды. У печи хозяйка потрошит улов.'); },
        decor: ['bed', 'table', 'nets'],
        secondaryNpcId: 'fisher_wife',
        get secondaryNpcName() { return t('Домна, жена рыбака'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'fisher_wife',
    },

    // Дом плотника — новый двор (Микула и Матрёна)
    carpenter_house: {
        id: 'carpenter_house',
        get name() { return t('Дом плотника'); },
        npcId: 'carpenter1',
        get npcName() { return t('Плотник Микула'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'carpenter1',
        get description() { return t('Во дворе — брёвна, тесла и скобы. В избе пахнет свежей стружкой: хозяин тешет ложки, жена прядёт у печи.'); },
        decor: ['bed', 'table', 'tools'],
        secondaryNpcId: 'carpenter_wife',
        get secondaryNpcName() { return t('Матрёна, жена плотника'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'carpenter_wife',
    },

    // Дом ткачихи — вдова Пелагея с сыном-пастушком (Ивашка при овчарне)
    weaver_house: {
        id: 'weaver_house',
        get name() { return t('Дом ткачихи'); },
        npcId: 'weaver1',
        get npcName() { return t('Ткачиха Пелагея'); },
        npcSprite: 'npc_elder',
        portrait: 'portrait_villager_f',
        dialogueId: 'weaver1',
        get description() { return t('Полутьма, у окна — ткацкий стан, на нём — недотянутый холст. Клубки шерсти, прялка, пучки льна. Хозяйка работает, не поднимая глаз.'); },
        decor: ['bed', 'loom', 'yarn'],
    },

    // ===== РАУНД 51: ВОСТОЧНАЯ СЛОБОДА / РАУНД 53: ЛАВКИ → ЖИЛЫЕ ДОМА =====
    // Владелец удалил торговую и мясную лавки (дома нужнее) — на их месте
    // стоят жилые дома Прасковьи и Потапа. Профессии жителей остались:
    // снедница печёт дома, мясник держит столешню — торгуют с крыльца,
    // панель «Торговать» снята.

    // Дом Прасковьи — снедница: печёт караваи и пироги в своей печи
    grocer_house: {
        id: 'grocer_house',
        get name() { return t('Дом Прасковьи'); },
        npcId: 'grocer',
        get npcName() { return t('Прасковья, снедница'); },
        npcSprite: 'npc_elder',
        portrait: 'portrait_villager_f',
        dialogueId: 'grocer',
        get description() { return t('Тёплая горница с хлебной печью. На полках — караваи, головы сыра и связки сушёных грибов, на столе остывают пироги с репой. Хозяйка присыпает мукой столешницу, не глядя.'); },
        decor: ['bed', 'table', 'shelf'],
    },

    // Дом Потапа — мясник: при доме держит столешню и коптильню
    butcher_house: {
        id: 'butcher_house',
        get name() { return t('Дом Потапа'); },
        npcId: 'butcher',
        get npcName() { return t('Потап, мясник'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'butcher',
        get description() { return t('Пахнет дымом и свежим мясом: при доме у Потапа своя столешня. Колбасы и окорока подвешены под потолком, на разделочном столе — ряды нарезки, у печи сушится медвежья шкура.'); },
        decor: ['bed', 'table', 'barrel'],
    },

    // РАУНД 63 (п.2): «ВМЕСТО ЛАВКИ РЕМЕСЛЕННИКА — НОРМАЛЬНЫЙ ДОМ
    // РЕМЕСЛЕННИКА». Аверьян теперь живёт и работает в своём доме:
    // верстак, ложки да лучины, а торговля — с крыльца (ассортимент и
    // цены прежние, рынок при доме — как у Прасковьи и Потапа).
    shop_tools: {
        id: 'shop_tools',
        get name() { return t('Дом ремесленника'); },
        npcId: 'peddler',
        get npcName() { return t('Ремесленник Аверьян'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_tavernkeeper',
        dialogueId: 'peddler',
        get description() { return t('Дом ремесленника: у стены — верстак со стругами, под потолком — связки ложек, лучины и мочал. На прилавке у окна — ножи, верёвки, кремни, свечи восковые да обереги от сглазу. Хозяин и мастер, и торгаш в одном.'); },
        decor: ['shelf', 'table'], // раунд 66.10: 'chest' удалён (сундуки не нужны)
        market: {
            title: t('Дом ремесленника — товар'),
            // Раунд 66.12 (п.7): мёртвые товары (факел/верёвка/кремень —
            // эффект нулевой, ни одна система их не читала) сняты с продажи.
            // Раунд 66.17 (п.12): УДОЧКА — товар (для рыбалки на броду;
            // без неё — только Ерёмина уда на броду, п.13).
            items: [
                // ПАТЧ 66.76 (приказ 6): ОБЕРЕГ ОТ СГЛАЗУ УДАЛЁН из лавки
                // (прямое указание владельца; янтарный оберег из сундуков —
                // другой предмет, скупке не мешает).
                // ПАТЧ 66.76 (приказ 7): МАТЕРЧАТЫЙ И КОЖАНЫЙ ДОСПЕХИ —
                // Аверьян шьёт и торгует стёганкой/кожей (исторично: скорняк-
                // ремесленник держал и тегиляи). Кузнец их НЕ продаёт.
                { id: 'padded', name: 'Тегиляй', price: 10, kind: 'armor', armorId: 'padded', note: 'защита 1' },
                { id: 'leather', name: 'Кожаная броня', price: 25, kind: 'armor', armorId: 'leather', note: 'защита 2' },
                { id: 'rod', name: 'Удочка', price: 12, kind: 'gear', note: 'для рыбалки' },
                // Раунд 66.28 (пп.9,12): стрелы в продажу — ТОЛЬКО пачками по 10
                // (в узел слотами по ≤10; в колчан наложить на экране персонажа)
                { id: 'arrows_pack', name: 'Пачка стрел (10 шт.)', price: 5, kind: 'ammo', note: 'стрелы в узел' },
            ],
        },
    },

    // Дом сапожника — Нефёд шьёт сапоги и кожаные пояса, жена Агафья
    shoemaker_house: {
        id: 'shoemaker_house',
        get name() { return t('Дом сапожника'); },
        npcId: 'shoemaker',
        get npcName() { return t('Сапожник Нефёд'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'shoemaker',
        get description() { return t('В горнице пахнет кожей и дёгтем: на лавке — сапоги всех размеров, колодки, шило и суровые нитки. Хозяин сшивает голенище, не отрываясь от дела.'); },
        decor: ['bed', 'table', 'shelf'],
        secondaryNpcId: 'shoemaker_wife',
        get secondaryNpcName() { return t('Агафья, жена сапожника'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'shoemaker_wife',
    },

    // Изба дровосека — Горазд рубит лес за околицей, топоры и поленницы
    woodcutter_house: {
        id: 'woodcutter_house',
        get name() { return t('Изба дровосека'); },
        npcId: 'woodcutter',
        get npcName() { return t('Дровосек Горазд'); },
        npcSprite: 'npc_soldier',
        portrait: 'portrait_peasant',
        dialogueId: 'woodcutter',
        get description() { return t('Изба простая и ладная: в углу — поленница до потолка, у двери — топоры и пилы. На бревне у печи вырезаны метки — счёт срубленным деревьям.'); },
        decor: ['bed', 'table', 'firewood'],
    },

    // РАУНД 63 (п.1): «УДАЛИТЬ ОВЧАРНЮ И ВМЕСТО НЕЁ — ЕЩЁ ОДИН ЖИЛОЙ ДОМ».
    // Дом Степана да Арины — простая крестьянская семья восточной улицы.
    villager_house_3: {
        id: 'villager_house_3',
        get name() { return t('Дом Степана'); },
        npcId: 'peasant2',
        get npcName() { return t('Крестьянин Степан'); },
        npcSprite: 'npc_merchant',
        portrait: 'portrait_peasant',
        dialogueId: 'peasant2',
        get description() { return t('Крепкая изба в два окна: на шестке горшки глиняные, у красного угла — образа с рушником, под лавкой — кувадка с прялкой Арины. У крыльца сушатся сбруя и рукавицы, в сенцах пахнет хлебом и скотиной.'); },
        decor: ['bed', 'table', 'shelf'],
        secondaryNpcId: 'peasant2_wife',
        get secondaryNpcName() { return t('Арина, жена Степана'); },
        secondaryNpcSprite: 'npc_elder',
        secondaryPortrait: 'portrait_villager_f',
        secondaryDialogueId: 'peasant2_wife',
    },
};

// Координаты зданий в деревне (col, row — верхний-левый угол; w×h в тайлах).
// РАУНД 66 (п.6 приказа владельца): ДОМА ПЕРЕУСТАНОВЛЕНЫ ЗАНОВО, дорожная
// сеть перерисована (world.buildMap): «дороги должны вести от дверей домов
// на улицу, а улица должна связывать дома единой сетью и вести к выходу»,
// лишних дорожек-переулков больше НЕТ.
//   - В ЦЕНТРЕ — ЦЕРКОВЬ (10–12) и ДОМ СТАРОСТЫ (14–17), средний ряд;
//   - ПО КРАЯМ — КУЗНИЦА (северо-восток, 23–24) и дома ремесленников
//     (гончар — северо-запад, прасковья/ремесленник — север,
//     ткачиха/сапожник/дровосек/мясник — южный ряд);
//   - между любыми двумя домами ЗАЗОР ≥1 тайл (п.3 — дома не срастаются);
//   - двери средних/южных рядов выходят прямо на улицу (ряд 9 / ряд 13),
//     двери северного ряда — 1 тайл дорожки до главной улицы (ряд 5).
// Карта 26×15: ряд 0 и 14, колонки 0 и 25 — частокол (п.8); главная улица
// 'B' — ряд 5, средняя 'S' — ряд 9, задняя 'S' — ряд 13; западный и
// восточный проезды (колонки 1 и 24) связывают три улицы; ворота (25,5).
export const BUILDINGS = [
    // ПАТЧ 66.35 (приказы 3-5 владельца): ПЕРЕСОБРАННАЯ ПЛАНИРОВКА.
    // «Дом крестьянина наполовину обрезан справа» + теснота у восточного
    // частокола: теперь КАЖДЫЙ дом стоит минимум в 1 тайле от частокола
    // (колонка 24 свободна по всей восточной кромке), зазоры между домами
    // ≥1 тайла, все три ряда пересоблены. Восточный проезд перенесён
    // в колонку 24 (ряды 10–12), западный укорочен до рядов 6–8.
    // Северный ряд (ряды 1–3, двери на 3): постоялый двор, избы, ремёсла
    { interiorId: 'potter_house', col: 1, row: 1, w: 3, h: 3, get label() { return t('Дом гончара'); } },
    // Постоялый двор w4 (66.35): иначе северный ряд не помещается до колонки 22
    // — а правее фасад лезет под виджет «План деревни» (урок 66.25)
    { interiorId: 'tavern', col: 5, row: 1, w: 4, h: 3, get label() { return t('Постоялый двор'); } },
    // Плотник — из среднего ряда в северный (его место у церкви занято лавкой ремесленника)
    { interiorId: 'carpenter_house', col: 10, row: 1, w: 3, h: 3, get label() { return t('Дом плотника'); } },
    { interiorId: 'villager_house_1', col: 14, row: 1, w: 3, h: 3, get label() { return t('Дом Авдея'); } },
    { interiorId: 'blacksmith', col: 18, row: 1, w: 2, h: 3, get label() { return t('Кузница'); } },
    { interiorId: 'healer_house', col: 21, row: 1, w: 2, h: 3, get label() { return t('Дом знахарки'); } },
    // Средний ряд (ряды 6–8, двери на 8): ХРАМ И ДОМ СТАРОСТЫ — В ЦЕНТРЕ
    // Ремесленник — из северного ряда к западному проезду
    { interiorId: 'shop_tools', col: 2, row: 6, w: 2, h: 3, get label() { return t('Дом ремесленника'); } },
    { interiorId: 'villager_house_2', col: 5, row: 6, w: 3, h: 3, get label() { return t('Дом Марфы'); } },
    { interiorId: 'church', col: 9, row: 6, w: 3, h: 3, get label() { return t('Церковь'); } },
    { interiorId: 'elder_house', col: 13, row: 6, w: 4, h: 3, get label() { return t('Староста'); } },
    { interiorId: 'beekeeper_house', col: 18, row: 6, w: 3, h: 3, get label() { return t('Дом пахаря'); } },
    // Мясник Потап — у восточного края, теперь с полным тайлом до частокола
    { interiorId: 'butcher_house', col: 22, row: 6, w: 2, h: 3, get label() { return t('Дом Потапа'); } },
    // Южный ряд (ряды 10–12, двери на 12): ткачиха у западной кромки,
    // Прасковья — у восточной (обе с зазором от частокола)
    { interiorId: 'weaver_house', col: 1, row: 10, w: 3, h: 3, get label() { return t('Дом ткачихи'); } },
    { interiorId: 'villager_house_3', col: 5, row: 10, w: 3, h: 3, get label() { return t('Дом Степана'); } },
    { interiorId: 'shoemaker_house', col: 9, row: 10, w: 3, h: 3, get label() { return t('Дом сапожника'); } },
    { interiorId: 'woodcutter_house', col: 13, row: 10, w: 3, h: 3, get label() { return t('Изба дровосека'); } },
    { interiorId: 'fisher_house', col: 17, row: 10, w: 3, h: 3, get label() { return t('Дом рыбака'); } },
    { interiorId: 'grocer_house', col: 21, row: 10, w: 3, h: 3, get label() { return t('Дом Прасковьи'); } },
];

// Ворота на выходе из деревни (восточный край карты, ряд главной улицы).
// world.buildMap() ставит 'G' на (MAP_W-1, VILLAGE_GATE.row).
export const VILLAGE_GATE = { col: 25, row: 5, get label() { return t('Ворота'); } }; // 66.97: лениво

// Локации на развилке (раунд 30: лес — тремя частями; раунд 39 (п.23):
// лес — единая локация цепочкой, вход только через Опушку; «Лес» = Густой лес).
export const FORK_LOCATIONS = [
    { id: 'forest_edge', name: t('Опушка леса'), icon: '🌳', description: t('Краешек леса, где кончается трава и начинаются деревья. Светло, грибные места да ягодные кусты.') },
    { id: 'forest_glade', name: t('Лесная поляна'), icon: '🌼', description: t('Солнечная поляна среди леса, в кольце деревьев. Много цветов, ягод и пчелиного звона.') },
    { id: 'forest', name: t('Густой лес'), icon: '🌲', description: t('Глубина леса: тёмная чаща за опушкой и поляной. Много следов, но и много зверья.') },
    { id: 'road', name: t('Тракт'), icon: '🛤', description: t('Торный тракт на юг, к большим городам.') },
    { id: 'river', name: t('Река'), icon: '🌊', description: t('Брод через реку. Галька, илистый берег — следы видны хорошо.') },
    { id: 'field', name: t('Поле'), icon: '🌾', description: t('Ржаное поле на восток. Высокие стебли скрывают следы.') },
];

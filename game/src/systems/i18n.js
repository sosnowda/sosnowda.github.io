// i18n — мини-словарь для EN-локализации демо (раунд 15).
//
// Принцип: русский текст — источник и ключ. t('Новая игра') возвращает
// EN-перевод, если язык 'en', иначе исходную строку (безопасный фолбэк:
// непереведённые места остаются русскими — частичное покрытие не ломает игру).
//
// Определение языка (по приоритету):
//   1) URL-параметр ?lang=en|ru  (ссылка с EN-лендинга ведёт на /game/?lang=en)
//   2) localStorage 'gameLang'   (запоминается после ручного переключения)
//   3) document.documentElement.lang (EN-страницы выставляют lang="en")
//   4) 'ru'
//
// API:
//   t(ru)            — статическая строка
//   tf(pattern, ...) — шаблон с {0} {1}: tf('Открыть: {0}', name)
//   tk(key, ru)      — семантический ключ для больших текстов (help.body и т.п.)
//   getLang() / setLang(lang) / isEn()

const LS_LANG = 'gameLang';

let currentLang = null;

export function detectLang() {
    // 1) URL-параметр — язык сессии (НЕ пишем в localStorage, чтобы визит
    //    с EN-лендинга не «приклеивал» EN к последующим визитам с RU)
    try {
        const p = new URLSearchParams(window.location.search).get('lang');
        if (p === 'en' || p === 'ru') return p;
    } catch (e) { /* noop */ }
    // 2) Ручной выбор (тумблер в настройках) — сохранённый язык
    try {
        const saved = localStorage.getItem(LS_LANG);
        if (saved === 'en' || saved === 'ru') return saved;
    } catch (e) { /* noop */ }
    // 3) Язык страницы (EN-лендинг выставляет lang="en")
    const html = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || 'ru';
    return String(html).toLowerCase().indexOf('en') === 0 ? 'en' : 'ru';
}

export function getLang() {
    if (!currentLang) currentLang = detectLang();
    return currentLang;
}

export function isEn() {
    return getLang() === 'en';
}

/** Переключить язык и сохранить (сцена сама решает, перерисоваться или перезагрузиться). */
export function setLang(lang) {
    if (lang !== 'en' && lang !== 'ru') return;
    currentLang = lang;
    try { localStorage.setItem(LS_LANG, lang); } catch (e) { /* noop */ }
}

// ----- Словарь EN (ключ — точная русская строка) -----
const EN = {
    // --- Title ---
    'Новая игра': 'New Game',
    'Персонаж': 'Character',
    '❓ Помощь': '❓ Help',
    '⚙ Настройки': '⚙ Settings',
    'О игре': 'About',
    'ОК': 'OK',
    'Закрыть': 'Close',
    'XV век · Поход за утраченной иконой': '15th century · The quest for the stolen icon',
    '🔊 Все звуки: {0}': '🔊 All sound: {0}',
    '🎵 Музыка: {0}': '🎵 Music: {0}',
    '🔊 Эффекты (SFX): {0}': '🔊 Sound effects (SFX): {0}',
    '🌐 Язык: {0} → {1}': '🌐 Language: {0} → {1}',
    'ВКЛ': 'ON',
    'ВЫКЛ': 'OFF',
    '🌐 Язык': '🌐 Language',
    'Русский': 'Russian',
    'English': 'English',
    '(нужна перезагрузка)': '(page will reload)',

    // --- Время (TimeSystem) ---
    'на ранней заре': 'at first light',
    'поутру': 'early in the morning',
    'утром': 'in the morning',
    'перед обедом': 'late in the morning',
    'в полдень': 'at noon',
    'после обеда': 'in the afternoon',
    'под вечер': 'toward evening',
    'на закате': 'at sunset',
    'ночью': 'at night',
    'глубокой ночью': 'deep in the night',
    'от С.М.': 'A.M.',
    'рассвѣтъ': 'dawn',
    'утро': 'morning',
    'полудень': 'midday',
    'вечеръ': 'evening',
    'сумерки': 'dusk',
    'ночь': 'night',
    // --- Раунд 29: счёт времени «как на Руси XV века» ---
    'полночь': 'midnight',
    'глубокая ночь': 'dead of night',
    'первые петухи': 'first cockcrow',
    'вторые петухи': 'second cockcrow',
    'заря занимается': 'daybreak',
    'восход солнца': 'sunrise',
    'заутреня отошла': 'matins past',
    'третий час': 'the third hour',
    'шестой час (обедня)': 'the sixth hour (mass)',
    'девятый час (вечерня)': 'the ninth hour (vespers)',
    'повечерие': 'compline',
    '📜 Летопись': '📜 Chronicle',
    'Месяц: ': 'Month: ',
    'Сутки: ': 'Time of day: ',
    'Весна': 'Spring',
    'Лето': 'Summer',
    'Осень': 'Autumn',
    'Зима': 'Winter',

    // --- Погода ---
    'Ясно': 'Clear',
    'Пасмурно': 'Overcast',
    'Дождь': 'Rain',
    'Гроза': 'Thunderstorm',
    'Снег': 'Snow',

    // --- Развилка (ForkScene) ---
    'Околица деревни': 'Village outskirts',
    'Куда пойдёшь?': 'Where will you go?',
    '⏳ Ходов до побега вора: {0}': '⏳ Turns until the thief escapes: {0}',
    'Улики от жителей:': 'Clues from the villagers:',
    '{0} (обыскано)': '{0} (searched)',
    '🌲 Тёмный лес — прогулка': '🌲 Dark Forest — a walk',
    '◀ Вернуться в деревню': '◀ Back to the village',
    '🗺 Карта местности': '🗺 Area map',
    '🏠': '🏠',
    'Лес': 'Forest',
    'Тракт': 'Highway',
    'Река': 'River',
    'Поле': 'Field',
    'Озеро': 'Lake',
    'Погост': 'Churchyard',
    'Мельница': 'Mill',
    'Пасека': 'Apiary',
    'Выпас': 'Pasture',

    // --- Деревня (VillageScene) ---
    'Нажмите E — {0}': 'Press E — {0}',
    'Войти': 'Enter',
    'Открыть: {0}': 'Open: {0}',
    'Выйти из деревни': 'Leave the village',
    'Отдохнуть у костра (1 час)': 'Rest by the campfire (1 hour)',
    'Рыбалка': 'Fishing',
    'Помолиться у креста (1 час)': 'Pray at the cross (1 hour)',
    'Двинская слобода': 'Dvinskaya Sloboda',

    // --- Сундуки / тайники ---
    'Сундук у таверны': 'Chest by the tavern',
    'Сундук за амбаром': 'Chest behind the barn',
    'Тюк у колодца': 'Bundle by the well',
    'Позолоченный ларец': 'Gilded casket',
    'твой тюк за лавкой': 'your bundle behind the bench',
    'твой узел в углу амбара': 'your bundle in the barn corner',
    'Сундук уже открыт сегодня': 'The chest was already opened today',

    // --- Здания (интерьеры) ---
    'Староста': 'Elder',
    'Таверна': 'Tavern',
    // Раунд 27 (п.12): таверна переименована владельцем в «Постоялый двор»
    'Постоялый двор': 'The Wayside Inn',
    'Постоялый двор «У дороги»': 'The Wayside Inn',
    'Кузница': 'Smithy',
    'Амбар': 'Barn',
    'Дом Авдея': 'Avdey\'s house',
    'Дом Марфы': 'Marfa\'s house',
    'Дом пасечника': 'Beekeeper\'s house',
    // Раунд 28 (п.1): дом на месте часовни — ДОМ ПАХАРЯ (не пасечника)
    'Дом пахаря': 'Ploughman\'s house',
    'Пахарь Тарас': 'Ploughman Taras',
    'Фёкла, жена пахаря': 'Fyokla, the ploughman\'s wife',
    'Изба полна детского гомона: у Тараса и Фёклы семеро детей. У крыльца — соха, на лавках — клубки шерсти, в углу — плетёные корзины для грибов.': 'The hut is full of children\'s chatter: Taras and Fyokla have seven of them. A wooden plough rests by the porch, balls of wool lie on the benches, and wicker baskets for mushrooms stand in the corner.',
    'Расскажи о своей пашне.': 'Tell me about your ploughing.',
    'Церковь': 'Church',
    'Ворота': 'Gate',
    'Дом старосты': 'Elder\'s house',
    'Таверна «У дороги»': 'The Wayfarer\'s Tavern',
    'Дом крестьянина': 'Peasant\'s house',
    'Дом вдовы': 'Widow\'s house',
    'Пасечница Марфа': 'Marfa the Beekeeper',
    'Мельник Авдей': 'Avdey the Miller',
    'Любава, жена старосты': 'Lyubava, the elder\'s wife',
    'Фёкла, жена пасечника': 'Fyokla, the beekeeper\'s wife',
    'Амбар общины': 'Community barn',
    'Церковь Рождества Богородицы': 'Church of the Nativity of the Theotokos',

    // --- Раунд 37 (вариант Б): новая улица — дома, жители, профессии ---
    'Дом гончара': 'Potter\'s house',
    'Дом знахарки': 'Healer\'s house',
    'Дом рыбака': 'Fisherman\'s house',
    'Дом плотника': 'Carpenter\'s house',
    'Дом ткачихи': 'Weaver\'s house',
    'Овчарня': 'Sheepfold',
    'Гончар Игнат': 'Ignat the Potter',
    'Анна, жена гончара': 'Anna, the potter\'s wife',
    'Знахарка Февронья': 'Fevronia the Healer',
    'Ульяна, внучка знахарки': 'Ulyana, the healer\'s granddaughter',
    'Рыбак Ерёма': 'Yeryoma the Fisherman',
    'Домна, жена рыбака': 'Domna, the fisherman\'s wife',
    'Плотник Микула': 'Mikula the Carpenter',
    'Матрёна, жена плотника': 'Matryona, the carpenter\'s wife',
    'Ткачиха Пелагея': 'Pelageya the Weaver',
    'парень': 'lad',
    'Тесная мастерская: круг, стопки сырых горшков, запах глины и печного жара. Хозяин приглядывает к заготовкам, вымазанный по локти.': 'A cramped workshop: a wheel, stacks of raw pots, the smell of clay and kiln heat. The master watches over his wares, smeared to the elbows.',
    'Пахнет сушёными травами и воском. Пучки полыни и зверобоя под потолком, ступка, у печи — бабушка с внучкой перебирают коренья.': 'It smells of dried herbs and beeswax. Bundles of wormwood and St. John\'s wort hang from the ceiling; by the stove a grandmother and her granddaughter sort through roots.',
    'Сети сушатся под потолком, на лавке — плетёные верши и уды. У печи хозяйка потрошит улов.': 'Fishing nets dry from the ceiling; wicker traps and rods lie on the bench. By the stove the mistress of the house is gutting the catch.',
    'Во дворе — брёвна, тесла и скобы. В избе пахнет свежей стружкой: хозяин тешет ложки, жена прядёт у печи.': 'Logs, adzes and clamps lie in the yard. The hut smells of fresh shavings: the master carves spoons while his wife spins by the stove.',
    'Полутьма, у окна — ткацкий стан, на нём — недотянутый холст. Клубки шерсти, прялка, пучки льна. Хозяйка работает, не поднимая глаз.': 'It is dim inside; a loom stands by the window with a half-finished length of linen on it. Balls of wool, a spinning wheel, bundles of flax. The mistress works without raising her eyes.',
    'твой узел в углу мастерской': 'your bundle in the corner of the workshop',
    'Узел чабана у овчарни': 'The herdsman\'s bundle by the sheepfold',
    '🔒 Дом закрыт, никого нет': '🔒 The house is shut — nobody is home',
    'Дом закрыт': 'House shut',
    'Хозяин сейчас: {0} · {1}': 'The owner right now: {0} · {1}',
    '🗺 Вся деревня': '🗺 Whole village',
    '🗺 Обзор': '🗺 Overview',
    'Обзор всей деревни (клавиша M)': 'Overview of the whole village (key M)',
    'Видно всю деревню. Нажми ещё раз, чтобы вернуть камеру к себе.': 'You can see the whole village. Press again to bring the camera back to yourself.',
    'Камера снова следует за тобой.': 'The camera follows you again.',
    // варианты выбора в новых диалогах
    'Что строишь теперь?': 'What are you building now?',
    'Про лес расскажи.': 'Tell me about the forest.',
    'Чем мастерство добыл?': 'How did you learn your craft?',
    'Удачи в работе.': 'Good luck with your work.',
    'Помочь в мастерской (1 час)': 'Help in the workshop (1 hour)',
    'Откуда глина берёшь?': 'Where does the clay come from?',
    'Про сына расскажи.': 'Tell me about your son.',
    'Тяжела ль работа ткачихи?': 'Is a weaver\'s work hard?',
    'Мира твоему дому.': 'Peace to your home.',
    'Что за баран у тебя?': 'What about that ram of yours?',
    'Про овчарню расскажи.': 'Tell me about the sheepfold.',
    'Где нынче клюёт?': 'Where are they biting now?',
    'Полечить раны (3 д.)': 'Treat my wounds (3 d.)',
    'Чего травами лечишь?': 'What do you heal with herbs?',
    'Про внучку расскажи.': 'Tell me about your granddaughter.',
    'Слава Богу, здоров.': 'Thank God, I am well.',
    'Покажешь горшок?': 'Will you show me the pot?',
    'Чему учишься?': 'What are you learning?',
    'Спасибо, батюшка... то есть, бабушка.': 'Thank you, father... that is, granny.',

    // --- Тёмный лес ---
    '◀ К ОКОЛИЦЕ': '◀ TO THE OUTSKIRTS',
    '🌲 Тёмный лес': '🌲 Dark Forest',

    // --- Пасека (раунд 17: пчёлы — только антураж, без боя и мёда) ---
    '🐝 Пасека': '🐝 Apiary',
    '🐝 Пасека — прогулка': '🐝 Apiary — a stroll',
    'Колодный улей': 'Log hive',
    'Подойти к улью': 'Walk up to the hive',
    'пчёлы спят': 'bees are asleep',
    'пчёлы кружат над ульями': 'bees are buzzing over the hives',
    '🐝 Ровный тёплый гул — улей живёт своим ладом.': '🐝 A steady warm hum — the hive lives its own quiet rhythm.',
    '🐝 Пчёлы возвращаются с взятком: лапки в золотой пыльце.': '🐝 Bees return with their haul: legs dusted golden with pollen.',
    '🐝 У летка дежурит сторожевая пчела — принюхивается к каждому.': '🐝 A guard bee keeps watch at the entrance, sniffing every arrival.',
    '🐝 Восковые соты пахнут мёдом и сухой липой.': '🐝 The wax combs smell of honey and dry linden.',
    '🐝 Две пчелы танцуют на плашке — показывают, где цветы.': '🐝 Two bees dance on the lid board — showing where the flowers are.',
    'Обыскать тайник разбойников': 'Search the bandits\' stash',
    'Вернуться к околице': 'Return to the outskirts',
    'Грибы': 'Mushrooms',
    'Куст ягод': 'Berry bush',
    'Зверобой': 'St. John\'s wort',
    'Сорвать грибы (+2 ❤)': 'Pick mushrooms (+2 ❤)',
    'Собрать ягоды (+1 ❤)': 'Gather berries (+1 ❤)',
    'Собрать зверобой (+3 ❤)': 'Gather St. John\'s wort (+3 ❤)',

    // --- Текстовая локация ---
    'Ты уже обыскивал эту местность.\nНовых следов здесь не найти.': 'You have already searched this place.\nNo new traces to be found here.',
    '🔍 Поиск': '🔍 Search',
    '🔍 Осмотр': '🔍 Inspect',
    '🔍 Искать следы': '🔍 Search for traces',
    '{0} (проверка Внимательности)': '{0} (Notice check)',
    '🚪 Выход': '🚪 Exit',
    '◀ Назад к развилке': '◀ Back to the crossroads',
    '⏳ Ходов: {0}': '⏳ Turns: {0}',
    '✦ Воля': '✦ Will',
    '⚔ Меч': '⚔ Sword',

    // --- Бой (CombatScene) ---
    '🤜 Кулаками': '🤜 Bare fists',
    '{0}: {1} — промах!': '{0}: {1} — miss!',
    '{0}: {1} — промах.': '{0}: {1} — miss.',
    '[КРИТ!]': '[CRIT!]',
    '[ОСОБЫЙ!]': '[SPECIAL!]',
    'Разбойник': 'Bandit',
    'Волк': 'Wolf',
    'Вор-иконокрад': 'The Icon Thief',
    'Секач': 'Hewing knife',
    'Клыки': 'Fangs',
    'Кривой кинжал': 'Crooked dagger',
    'Длинный меч': 'Long sword',
    'Стальной меч': 'Steel sword',
    'Кожаная броня': 'Leather armor',
    'Кольчуга': 'Chainmail',
    'Меч': 'Sword',
    'Лук': 'Bow',
    'Кулаки': 'Fists',

    // --- Выбор персонажа ---
    'Создание персонажа': 'Character creation',
    '🎲 Случайный персонаж': '🎲 Random character',
    '🎨 Свой облик': '🎨 Custom look',
    '◀ Назад': '◀ Back',
    'Выберите готового героя или сгенерируйте случайного': 'Pick a ready-made hero or roll a random one',
    'Генерация случайного героя': 'Random hero generation',
    'Выберите паттерн генерации:': 'Choose a generation pattern:',
    'Отмена': 'Cancel',

    // --- Деньги (Character.formatMoney) ---
    'д.': 'd.',
    'пол.': 'pol.',
    'гр.': 'hrv.',
    'руб.': 'rub.',
    '0 д.': '0 d.',

    // --- Локации развилки (mapLocations) ---
    'Тёмный лес': 'Dark Forest',
    'Тракт на югъ': 'The Southern Highway',
    'Ржаное поле': 'Rye Fields',
    'Святое озеро': 'The Holy Lake',
    'Погостъ': 'The Churchyard',
    'Водяная мельница': 'The Watermill',
    // Раунд 27 (п.4): ветряная мельница (водяное колесо и ручей убраны)
    'Ветряная мельница': 'The Windmill',
    'Ветряная мельница на пригорке. Мельник мелет зерно для всей округи.': 'A windmill on the hill. The miller grinds grain for the whole area.',
    'Выпасъ': 'The Pasture',
    'Рѣка Кистерма': 'The Kisterma River',
    'Густой бор за рекой. Много зверья и грибов, но и разбойники водятся.': 'A dense forest across the river. Plenty of game and mushrooms — but bandits roam here too.',
    'Большой тракт, ведущий к южным городам. По нему ходят купеческие обозы.': 'The great highway leading to the southern cities. Merchant convoys travel along it.',
    'Поля общинной пашни. Здесь крестьяне сеют рожь, овёс и ячмень.': 'Fields of communal arable land. Here the peasants sow rye, oats and barley.',
    'Тихое лесное озеро с чистой водой. Здесь ловят рыбу и собирают камыши.': 'A quiet forest lake with clear water. Fish are caught and reeds gathered here.',
    'Деревенское кладбище с деревянной часовней и рядами могил с крестами. Много деревьев и травы.': 'The village cemetery with a wooden chapel and rows of graves marked with crosses. Many trees and grass.',
    'Деревянная мельница на ручье. Мельник мелет зерно для всей округи.': 'A wooden mill on a stream. The miller grinds grain for the whole district.',
    'Пасека с колодными ульями в лесной чаще. Здесь добывают мёд и воск.': 'An apiary with log-hive beehives deep in the woods. Honey and wax are harvested here.',
    'Луг, где пасутся деревенские коровы, козы и лошади. Тут же пастух присматривает за стадом.': 'A meadow where the village cows, goats and horses graze. A herdsman watches over the herd.',
    'Брод через реку. Здесь стирают бельё, ловят рыбу, поят скот.': 'A ford across the river. Laundry is washed here, fish caught, cattle watered.',

    // --- Краткие описания (FORK_LOCATIONS) ---
    'Густой лес за рекой. Много следов, но и много зверья.': 'A dense forest across the river. Many tracks — and much game.',
    'Торный тракт на юг, к большим городам.': 'A well-travelled highway south, to the big cities.',
    'Брод через реку. Галька, илистый берег — следы видны хорошо.': 'A river ford. Pebbles and muddy banks — tracks show up well.',
    'Рожковое поле на восток. Высокие стебли скрывают следы.': 'A rye field to the east. Tall stalks hide the tracks.',

    // --- NPC (интерьеры) ---
    'Староста Мирослав': 'Elder Miroslav',
    'Тавернщик Фёдор': 'Taverner Fyodor',
    'Кузнец Данила': 'Blacksmith Danila',
    'Крестьянин Авдей': 'Peasant Avdey',
    'Вдова Марфа': 'Widow Marfa',
    'Отец Савватий': 'Father Savvatiy',
    'Работник не показывается': 'Nobody is around',

    // --- Лут ---
    '+{0} денги': '+{0} dengas',
    'Яблоко: +2 ❤': 'Apple: +2 ❤',
    'Медная иконка: +1 ⭐': 'Copper icon: +1 ⭐',
    'Пусто': 'Nothing',

    // --- Репутация (уровни) ---
    'свой человек': 'one of their own',
    'друг деревни': 'friend of the village',
    'уважаемый': 'respected',
    'нейтральный': 'neutral',
    'нелюбимый': 'disliked',
    'нежеланный': 'unwanted',
    'отверженный': 'shunned',
    'враг': 'enemy',

    // --- Инфо о здании (VillageScene) ---
    'NPC: {0}': 'NPC: {0}',
    'Личная репутация: {0} ({1})': 'Personal reputation: {0} ({1})',
    'Сейчас: {0}': 'Right now: {0}',
    'Реп: {0} ({1})': 'Rep: {0} ({1})',
    '⏳{0}ход': '⏳{0} turns',

    // --- Бой: журнал и кнопки ---
    'промах!': 'miss!',
    'Уклон': 'Dodge',
    'Трава': 'Herb',
    '🏃 Бежать': '🏃 Flee',
    'Ты занимаешь оборонительную стойку, готовясь уклониться.': 'You take a defensive stance, ready to dodge.',
    'У тебя нет целебной травы.': 'You have no healing herb.',
    'Ты принял траву и восстановил {0} здоровья.': 'You took the herb and restored {0} health.',
    'Ты успешно бежал с поля боя (бросок {0})!': 'You escaped the battlefield (roll {0})!',
    'Не удалось сбежать (бросок {0})! Враг атакует.': 'Couldn\'t escape (roll {0})! The enemy attacks.',
    '{0} уклонился от удара ({1}).': '{0} dodged the blow ({1}).',
    '{0}: попадание! Урон {1}{2} (бросок {3}){4}{5}.': '{0}: hit! Damage {1}{2} (roll {3}){4}{5}.',
    ' (бронь {0})': ' (armor {0})',
    ' [КРИТ!]': ' [CRIT!]',
    ' [ОСОБЫЙ!]': ' [SPECIAL!]',
    '{0} повержен!': '{0} is slain!',
    'Ты уклонился от {0} ({1})!': 'You dodged {0}\'s attack ({1})!',
    '{0} бьёт {1}: урон {2}{3} ({4}){5}.': '{0} strikes with {1}: damage {2}{3} ({4}){5}.',
    'Твой ход.': 'Your turn.',
    'Бой начинается! Приготовься, путник.': 'The battle begins! Steel yourself, traveler.',
    'Вор повержен! Икона твоя!': 'The thief is slain! The icon is yours!',
    'Враг повержен! Ты одержал победу.': 'The enemy is slain! You are victorious.',
    'Ты пал в бою...': 'You fell in battle...',

    // --- Поиск следов (LocationScene) ---
    '✨ Следы найдены!': '✨ Traces found!',
    '🔍 Поиск следов': '🔍 Searching for traces',
    'Погоня!': 'Chase!',
    'Продолжить': 'Continue',

    // --- Диалоги ---
    'Понятно': 'Got it',
    'Драться!': 'Fight!',
    'Краем глаза ты замечаешь движение между деревьями...\n\nРазбойник вернулся в свой лагерь!': 'Out of the corner of your eye you catch movement between the trees...\n\nThe bandit has returned to his camp!',

    // --- Оружие / броня (Character.js, CombatScene) ---
    'Без доспеха': 'No armor',
    'Тегиляй': 'Padded jack',
    'Зерцальный доспех': 'Mirrored armor',
    'Дубина': 'Club',
    'Нож': 'Knife',
    'Копьё': 'Spear',
    'Боевой топор': 'Battle axe',
    'Сабля': 'Sabre',

    // --- Герои (архетипы и описания) ---
    'Следопыт': 'Ranger',
    'Воин': 'Warrior',
    'Сыщик': 'Sleuth',
    'Приключенец': 'Adventurer',
    'Хорошие навыки разведки и чтения следов, средние боевые, слабое общение.': 'Good scouting and tracking skills, average combat, weak social skills.',
    'Слабые навыки розыска и общения, но отличные боевые навыки.': 'Weak investigation and social skills, but excellent combat skills.',
    'Хорошие навыки общения и поиска улик в разговорах, средние боевые.': 'Good social skills and clue-finding in conversations, average combat.',
    'Все навыки среднего уровня — универсал.': 'All skills at an average level — a jack-of-all-trades.',

    // --- Паттерны генерации героя ---
    'Сбалансированный': 'Balanced',
    'Все характеристики средние (40..60)': 'All characteristics average (40..60)',
    'Боевой': 'Combat-focused',
    'Высокие STR/CON/SIZ, низкие CHA/INT': 'High STR/CON/SIZ, low CHA/INT',
    'Учёный': 'Scholar',
    'Высокие INT/POW, низкие физические': 'High INT/POW, low physical stats',
    'Социальный': 'Social',
    'Высокие CHA/APP, средние остальные': 'High CHA/APP, others average',
    'Ловкий': 'Agile',
    'Высокие DEX/INT, низкие SIZ/STR': 'High DEX/INT, low SIZ/STR',

    // --- Навыки (карточки героя) ---
    'Владение мечом': 'Sword fighting',
    'Стрельба из лука': 'Archery',
    'Владение копьём': 'Spear fighting',
    'Рукопашная': 'Brawling',
    'Уклонение': 'Dodge',
    'Красноречие': 'Oratory',
    'Убеждение': 'Persuade',
    'Болтовня': 'Fast talk',
    'Запугивание': 'Intimidate',
    'Знахарство': 'Folk medicine',
    'Выживание': 'Survival',
    'Верховая езда': 'Riding',
    'Слух': 'Listen',

    // --- LPC-генератор персонажа (раунд 20) ---
    'Телосложение': 'Body',
    'Глаза': 'Eyes',
    'Борода': 'Beard',
    'Прическа': 'Hair',
    'Штаны': 'Legs',
    'Обувь': 'Footwear',
    'Одежда': 'Clothing',
    '🎨 Создание персонажа (LPC)': '🎨 Character Creation (LPC)',
    'Загрузка LPC-слоёв...': 'Loading LPC layers...',
    'Предпросмотр': 'Preview',
    'Пол:': 'Sex:',
    '♂ Муж': '♂ Male',
    '♀ Жен': '♀ Female',
    '◀ Пред': '◀ Prev',
    'След ▶': 'Next ▶',
    '🎲 Случайный облик': '🎲 Random look',
    'Подтвердить ▶': 'Confirm ▶',
    '(нет опций)': '(no options)',
    'Введите имя персонажа:': 'Enter the character name:',
    'Путник': 'Wanderer',

    // --- Кнопки интерьеров (раунд 20) ---
    '💬 Поговорить': '💬 Talk',
    '💰 Просить денег': '💰 Ask for money',
    '📜 Задание': '📜 Quest',
    '🎁 Подарить': '🎁 Give a gift',
    '👍 Похвалить': '👍 Compliment',
    '😠 Угрожать': '😠 Threaten',
    '💍 Свататься': '💍 Propose marriage',
    '🍻 Угостить (20д)': '🍻 Treat everyone (20d)',
    '🛒 Купить еды': '🛒 Buy food',
    '🛒 Купить оружие': '🛒 Buy weapons',
    '🎒 Мой тюк': '🎒 My bundle',
    '🎒 Мой узел': '🎒 My bundle',
    '🙏 Помолиться': '🙏 Pray',
    '🕯 Пожертвовать (5д)': '🕯 Donate (5d)',
    '🔍 Осмотреть киот': '🔍 Inspect the icon case',
    '⚒ Работать (1 час)': '⚒ Work (1 hour)',
    '🌾 Осмотреть зерно': '🌾 Inspect the grain',
    '🚪 Выйти': '🚪 Leave',
    '💸 Подарить 10 денег': '💸 Gift 10 dengas',
    '💸 Подарить 50 денег': '💸 Gift 50 dengas',
    'Оружие': 'Weapons',
    'Доспехи': 'Armor',
    'Нападение!': 'Attack!',
    '💬 Нажми, чтобы поговорить': '💬 Click to talk',
    'Подарок': 'A gift',
    'Не хватает денег!': 'Not enough money!',

    // ----- Раунд 21: много-локационная погоня за вором -----
    '⏳ Вор скроется через {0} действий': '⏳ The thief will vanish in {0} actions',
    '⏳ Действий: {0}': '⏳ Actions left: {0}',
    '⏳{0}действ.': '⏳{0}act.',
    '{0} действий': '{0} actions',
    'Найди и поймай вора!': 'Find and catch the thief!',
    'Найди вора.': 'Find the thief.',
    'Игра началась. Вор украл чудотворную икону и бежал из деревни в неизвестном направлении.':
        'The journey begins. The thief stole the miracle-working icon and fled the village in an unknown direction.',
    'Вор покинул «{0}» и двинулся дальше.': 'The thief left "{0}" and moved on.',
    'Вор скрылся с иконой. Погоня провалена.': 'The thief escaped with the icon. The chase has failed.',
    'ПОРАЖЕНИЕ: вор покинул вторую локацию и скрылся из вида. След ведёт за околицу.':
        'DEFEAT: the thief left the second location and vanished. The trail leads out of the village bounds.',
    'Пока ты осматривался, вор успел скрыться из вида...': 'While you were searching, the thief managed to slip away...',
    'Погоня окончена — искать больше нечего.': 'The chase is over — there is nothing left to search for.',
    'Следы свежайшие — трава ещё примята! Вор где-то совсем рядом, оглянись!':
        'The tracks are absolutely fresh — the grass is still flattened! The thief is very close, look around!',
    'Вор был здесь! Следы ведут в сторону «{0}». Не теряй времени!':
        'The thief was here! The tracks lead towards "{0}". Waste no time!',
    'Следы вора здесь обрываются: он уходил прочь из деревни широкими шагами бегуна.':
        'The thief\'s tracks end here: he left the village at a runner\'s stride, heading away for good.',
    'Кто-то здесь проходил — видны примятые травы. Но разобрать следы не вышло. Попробуй ещё раз.':
        'Someone passed here — the grass is trampled. But you could not make out the tracks. Try again.',
    'Ты тщательно осмотрел местность — свежих следов вора здесь нет. Видимо, он пошёл другой дорогой.':
        'You searched the area thoroughly — no fresh tracks of the thief here. He must have taken another road.',
    'Видел, как воришка в тёмном плаще бежал в сторону «{0}»!':
        'I saw the sneaky wretch in a dark cloak running towards "{0}"!',
    'И следы ещё не остыли — поспеши!': 'And the tracks are still fresh — hurry!',
    'Его видели уже на дороге к «{0}». Догоняй!': 'He was already seen on the road to "{0}". Catch him!',
    'Его видели уже у «{0}». Догоняй!': 'He was already seen near "{0}". Catch him!',
    'Следы потерялись — не знаю, куда он подался.': 'The trail went cold — I know not where he went.',
    'Не видел я никакого вора. Спроси кого другого, путник.':
        'I saw no thief. Ask someone else, traveller.',
    'Пока вы говорили, вор успел скрыться из вида...': 'While you were talking, the thief managed to vanish from sight...',
    'Слава Богу, ворюгу изловили! Дай Бог тебе удачи, сыщик.':
        'Thank God the rogue is caught! God speed you, detective.',
    'Я уже помог тебе, чем мог. Больше не дам.': 'I have already helped you all I could. I will give no more.',
    'Возьми, путник, чем богат. Помоги тебе Господь!': 'Take this, traveller, all I can spare. God bless you!',
    'Вот тебе немного денег на дорогу.': 'Here is a little money for the road.',
    'Попрошайка! Уходи, не позорься!': 'You beggar! Go away, have you no shame!',
    'Больше не даст.': 'Will give no more.',
    'Нет у меня лишних денег, сам перебиваюсь.': 'I have no spare money — I barely get by myself.',
    'репутация упала на': 'reputation dropped by',
    '😱 Встреча с вором!': '😱 You met the thief!',
    'Вор в тёмном плаще сжимает краденую икону. Он тебя заметил! Можно напасть, убедить отдать краденое (проверка Убеждения) или подкрасться и оглушить (проверка Драки).':
        'The thief in a dark cloak clutches the stolen icon. He has spotted you! You can attack, persuade him to give it back (Persuasion check), or sneak up and knock him out (Brawl check).',
    '⚔ Напасть': '⚔ Attack',
    '🤝 Убедить': '🤝 Persuade',
    '🌑 Оглушить': '🌑 Knock out',
    '◀ Отступить': '◀ Back off',
    '🏃 Вор скрылся!': '🏃 The thief escaped!',
    'Итоги похода': 'Journey summary',
    '🏆 Святыня у тебя!': '🏆 The holy icon is yours!',
    '💨 Вор вырвался!': '💨 The thief broke free!',
    'Вор, помявшись, опускает икону в траву: «Ладно! Пронеси тебя Бог, сыщик!» — и растворяется в чаще. Икона цела! Отнеси её старосте или батюшке.':
        'The thief hesitates, then lowers the icon into the grass: "Fine! God speed you, detective!" — and melts into the thicket. The icon is unharmed! Carry it to the village elder or the priest.',
    'бросок': 'roll',
    '«Не на того напал, сыщик!» — хохочет вор и исчезает меж деревьев. Это была твоя последняя возможность...':
        '"You picked the wrong man, detective!" the thief laughs and vanishes among the trees. That was your last chance...',
    '«Не на того напал!» — вор швыряет в тебя ком земли и пускается наутёк. Успей прочесть его следы!':
        '"You picked the wrong man!" The thief hurls a clod of earth at you and bolts. Hurry and read his tracks!',
    'Одним точным ударом в висок ты срубишь вора с ног и накрепко связываешь его. Икона в киоте невредима!':
        'With one precise blow to the temple you fell the thief and bind him tightly. The icon is unharmed!',
    'Ты догоняешь вора и оглушаешь его ударом в затылок. Вор связан — его ждёт суд старосты, а икона снова цела!':
        'You catch up with the thief and knock him out with a blow to the back of the head. The thief is bound — the elder\'s court awaits him, and the icon is safe again!',
    'Ты наступил на сухую ветку — вор обернулся и скрылся во мраке. Это была твоя последняя возможность...':
        'You stepped on a dry twig — the thief whirled around and vanished into the dark. That was your last chance...',
    'Вор оказался проворнее: увернулся от захвата и пустился наутёк. Успей прочесть его следы!':
        'The thief proved nimbler: he dodged your grasp and bolted. Hurry and read his tracks!',
    'Погоня окончена.': 'The chase is over.',
    'Икона у тебя! Верни её старосте или священнику в деревне.':
        'You have the icon! Return it to the village elder or the priest.',
    'Чудотворная икона': 'Miracle-working icon',
    'Вор повержен в бою': 'The thief was slain in combat',
    'Вор оглушён и взят в плен': 'The thief was knocked out and taken captive',
    'Вор сам вернул украденное': 'The thief gave back the stolen icon himself',
    'ПОБЕДА:': 'VICTORY:',
    'Чудотворная икона у тебя!': 'The miracle-working icon is in your hands!',
    'Икона уже возвращена деревне.': 'The icon has already been returned to the village.',
    'благословение (полное восстановление)': 'blessing (full recovery)',
    'Вернул украденную икону': 'Returned the stolen icon',
    'Икона возвращена! Деревня благодарна. Староста и жители дают поручения.':
        'The icon has been returned! The village is grateful. The elder and villagers offer errands.',
    'ПОБЕДА: чудотворная икона возвращена деревне!': 'VICTORY: the miracle-working icon has been returned to the village!',
    'Награда': 'Reward',
    'Герой пал в бою. Поход окончен.': 'The hero fell in battle. The journey is over.',
    'ПОРАЖЕНИЕ: герой пал. Летопись обрывается на этой странице.':
        'DEFEAT: the hero has fallen. The chronicle breaks off on this page.',
    'Напал на вора в его убежище.': 'Attacked the thief at his hiding place.',
    '🏆 Вор повержен!': '🏆 The thief is defeated!',
    'Ты обыскал тело поверженного вора и нашёл чудотворную икону Богородицы — целую и невредимую. Возвращайся в деревню: отдай святыню старосте или батюшке и получи заслуженную награду.':
        'You search the fallen thief and find the miracle-working icon of the Mother of God — whole and unharmed. Return to the village: give the holy icon to the elder or the priest and claim your well-earned reward.',
    'В деревню!': 'To the village!',
    'Поручение «{0}» выполнено! Загляни к {1} за наградой.':
        'Errand "{0}" is done! Visit {1} to collect your reward.',
    'Принял задание: {0} от {1}. Время: {2}.': 'Accepted errand: {0} from {1}. Time limit: {2}.',
    '🏺 Вернуть икону!': '🏺 Return the icon!',
    '🏺 Вернуть икону церкви!': '🏺 Return the icon to the church!',
    '(дальше)': '(continue)',
    '🏆 Продолжить игру (поручения жителей)': '🏆 Keep playing (villagers\' errands)',
    '📜 Завершить поход и посмотреть итоги': '📜 Finish the journey and view the summary',
    'Староста бережно принимает икону и осеняет себя крестом.':
        'The elder receives the icon reverently and crosses himself.',
    'Батюшка принимает икону; на его лице слёзы радости. Святыня снова в киоте!':
        'The priest receives the icon; tears of joy on his face. The holy icon is back in its shrine!',
    '✓ Поручение выполнено!': '✓ Errand completed!',
    'Ты справился, {0}! Прими это в благодарность.': 'Well done, {0}! Accept this with our gratitude.',
    'Спасибо!': 'Thank you!',
    'путник': 'traveller',
    'путница': 'traveller (f)',
    'Ты уже прочитал следы в этой местности.\nНовых здесь не найти.':
        'You have already read the tracks in this area.\nThere is nothing new to find here.',

    // ----- Раунд 22: три локации, одноразовые следы и расспросы, благословение -----
    'ПОРАЖЕНИЕ: вор покинул последнюю локацию и скрылся из вида. След ведёт за околицу.':
        'DEFEAT: the thief left the last location and vanished from sight. The trail leads out of the village bounds.',
    'Ты уже обследовал следы здесь. Больше из них ничего не выжать — придётся искать вора в других местах.':
        'You have already examined the tracks here. Nothing more to squeeze out of them — you will have to look for the thief elsewhere.',
    'Вор был здесь! Следы ведут в сторону «{0}».':
        'The thief was here! The tracks lead towards "{0}".',
    'По свежести примятой травы ясно: вор сейчас на дороге к «{0}»!':
        'By the freshness of the trampled grass you can tell: the thief is right now on the road to "{0}"!',
    'Судя по свежести следов, вор сейчас где-то у «{0}»!':
        'Judging by how fresh the tracks are, the thief is somewhere near "{0}" right now!',
    'Кто-то здесь проходил — видны примятые травы, но разобрать следы не вышло. Больше следы здесь не обследовать: придётся искать вора ВСЛЕПУЮ — обходить локации или расспрашивать других селян.':
        'Someone passed here — the grass is trampled, but you could not make out the tracks. These tracks cannot be examined again: you will have to search for the thief BLIND — checking locations one by one or questioning other villagers.',
    'Я уже всё тебе рассказал. Больше не знаю ничего — спроси у других людей.':
        'I have told you everything I know. Ask other folk — I know nothing more.',
    'Вор не стал испытывать судьбу: он бежал в другое место и затаился там. У тебя появилось немного больше времени, но искать нужно заново.':
        'The thief would not tempt fate twice: he ran to another place and went to ground there. You have a little more time now, but the search starts anew.',
    '✨ Благословение батюшки окрыляет: +10 к шансу этой проверки (единственный раз).':
        '✨ The priest\'s blessing lifts you: +10 to this check\'s chance (one time only).',
    '⌛ Поручение «{0}» просрочено! Срок вышел, а дело не сделано.':
        '⌛ The errand "{0}" has expired! The deadline passed and the deed was not done.',

    // ----- Раунд 22: благословение в церкви -----
    '🙏 Попросить благословения': '🙏 Ask for a blessing',
    'Батюшка качает головой: «Ты уже под защитой Господней, чадо. Благословение исполнится при первом же испытании — не гневи Боженьку жадностью.»':
        'The priest shakes his head: "You are already under God\'s protection, my child. The blessing will come true at your first trial — do not anger the Lord with greed."',
    'Батюшка кладёт руку тебе на голову и шепчет молитву. Тепло разливается по плечам.\n\n✨ Благословение: СЛЕДУЮЩАЯ проверка навыка (следы, расспрос, убеждение, оглушение или удар) пройдёт с +10 к шансу — но только одна!':
        'The priest lays his hand on your head and whispers a prayer. Warmth spreads over your shoulders.\n\n✨ Blessing: your NEXT skill check (tracks, questioning, persuasion, knock-out or a strike) gets +10 to its chance — but only one!',
    'Получил благословение в церкви: +10 к одной проверке навыка.':
        'Received a blessing at the church: +10 to one skill check.',
    'Аминь.': 'Amen.',
    'Спросить про вора': 'Ask about the thief',
    'Попросить денег': 'Ask for money',
    'Что нового в деревне?': 'What is new in the village?',
    'Спасибо, я пойду.': 'Thank you, I will be going.',
    'Спасибо за новости.': 'Thank you for the news.',
    'Что с коровой?': 'What about the cow?',
    'Сочувствую. Прощай.': 'My sympathies. Farewell.',
    'Найдётся ваша корова.': 'Your cow will be found.',
    'Помолюсь.': 'I will pray.',
    'Прощайте.': 'Farewell.',
    'Извините, я спешу.': 'Forgive me, I am in a hurry.',
    'Расскажи про украденную икону': 'Tell me about the stolen icon',
    'Спасибо, батюшка.': 'Thank you, father.',
    'Не сейчас': 'Not now',

    // ----- Раунд 22: отдых в таверне (п.10/12) -----
    '🛏 Отдых': '🛏 Rest',
    '🛏 Отдых в таверне': '🛏 Rest at the tavern',
    'Фёдор вытирает стойку: «Комнатка чистая, сено свежее. Отдохнёшь — силы вернутся.»':
        'Fyodor wipes the counter: "The room is clean, the hay is fresh. Rest a while and your strength will return."',
    '⚠ ВНИМАНИЕ: погоня за вором продолжается! Пока ты спишь, вор уйдёт далеко. Отдых лучше отложить до победы.':
        '⚠ WARNING: the chase for the thief is still on! While you sleep, the thief will get far away. Better postpone your rest until after the victory.',
    'Отдохнуть 1 час (4 д.) — лечение ~1/3': 'Rest for 1 hour (4 d.) — heal ~1/3',
    'Ночлег 8 часов (12 д.) — полное восстановление': 'Lodge for 8 hours (12 d.) — full recovery',
    'Не хватает денег: нужно {0} д., а у тебя {1}.': 'Not enough money: {0} d. is needed, but you have {1}.',
    '😴 Отдых окончен': '😴 Rest is over',
    'Ты выспался, сил — не меряно... но пока ты спал, вор успел скрыться из вида!':
        'You slept soundly, bursting with strength... but while you slept, the thief managed to vanish from sight!',
    'Встать': 'Rise',
    'Ты провёл в постели {0} ч. {1}': 'You spent {0} h in bed. {1}',
    'Здоровье и Воля восстановлены ПОЛНОСТЬЮ.': 'Health and Will have been FULLY restored.',
    'Здоровье +{0}, Воля +{1}.': 'Health +{0}, Will +{1}.',
    'Ты полон сил!': 'You are full of strength!',
    'Отдохнул в таверне ({0} ч) за {1} д. {2}': 'Rested at the inn ({0} h) for {1} d. {2}',

    // ----- Раунд 40: «⏳ Провести время» на постоялом дворе -----
    '⏳ Время': '⏳ Time',
    '⏳ Провести время': '⏳ Spend time',
    'Сейчас: {0} · {1}': 'Now: {0} · {1}',
    '⚠ Погоня за вором продолжается! Каждый час за столом — вор всё дальше.':
        '⚠ The chase for the thief is still on! Every hour at the table — the thief gets farther away.',
    '✍️ Своё время (1–24 ч):': '✍️ Custom duration (1–24 h):',
    'Цифры, Backspace, Enter — или кнопки и шаблоны:': 'Digits, Backspace, Enter — or the buttons and presets:',
    '−1 ч': '−1 h',
    '+1 ч': '+1 h',
    '⏳ Провести это время': '⏳ Spend this time',
    '— или сразу —': '— or right away —',
    '🌅 До утра (в 6:00)': '🌅 Until morning (6:00)',
    '☀️ До полудня (в 12:00)': '☀️ Until noon (12:00)',
    '🌇 До вечера (в 16:00)': '🌇 Until evening (16:00)',
    'через {0}': 'in {0}',
    '{0} ч': '{0} h',
    '{0} мин': '{0} min',
    '{0} ч {1} мин': '{0} h {1} min',
    '⏳ Время прошло': '⏳ Time has passed',
    'Ты провёл за столом в горнице {0}. Сейчас {1}, {2}.':
        'You spent {0} at the table in the common room. It is now {1}, {2}.',
    'Сил это не вернуло — для лечения есть платный «Отдых» (1 ч / 8 ч) и костёр во дворе.':
        'It did not restore your strength — for healing there is the paid "Rest" (1 h / 8 h) and the campfire in the yard.',
    'Провёл время на постоялом дворе ({0}).': 'Spent time at the inn ({0}).',
    'Ты посидел за столом у Фёдора... но пока время шло, вор успел скрыться из вида!':
        "You sat at Fyodor's table for hours... but while the time was passing, the thief managed to vanish from sight!",

    // --- Раунд 27: живой мир (пп.6-13) ---
    '🌙 Здесь сейчас никого нет...': '🌙 Nobody is here right now...',
    'Найди(е) его там — или возвращайся в другой час.': 'Find them there — or come back at another hour.',
    '💬 Поговорить': '💬 Talk',
    'Продолжить': 'Continue',
    'на постоялом дворе': 'at the wayside inn', 'на мельнице': 'at the mill',
    'на пасеке': 'at the apiary', 'у озера': 'by the lake', 'на реке': 'at the river',
    'в лесу': 'in the forest', 'в поле': 'in the field', 'у ворот': 'at the gate',
    'в церкви': 'in the church', 'на улице деревни': 'in the village street', 'дома': 'at home',
    '🍯 Купить мёд (8 д.)': '🍯 Buy honey (8 d.)',
    'Марфа качает головой: «Мёд — он как лекарство: три ложки в день, и довольно. Больше — не на пользу, а во вред. Приходи завтра».':
        'Marfa shakes her head: "Honey is like medicine: three spoonfuls a day, and that\'s it. More does harm, not good. Come back tomorrow."',
    '«Не раньше, чем через час. Мёд силён, дай ему разойтись по крови», — говорит Марфа.':
        '"Not before an hour passes. Honey is potent — let it settle in your blood first," Marfa says.',
    '«Без денег мёд не дам, — строго говорит Марфа. — Горшочек трудом достаётся». (Нужно 8 д.)':
        '"No honey without money," Marfa says sternly. "That pot is hard-won." (8 d. needed)',
    'Марфа наливает полную ложку янтарного мёда. Тепло разливается по телу, силы возвращаются.':
        'Marfa pours a full spoonful of amber honey. Warmth spreads through your body and your strength returns.',
    '(продолжить)': '(continue)',
    'Занят(а) своим делом. Заходи в другой раз.': 'Busy with their own affairs. Come back another time.',
    'Занят(а) работой на пасеке.': 'Busy working at the apiary.',
    '«Хорошая медовуха нынче...»': '"Fine mead this year..."',
    'Помолюсь с вами.': 'I will pray with you.',
    'Пасечница Марфа': 'Marfa the Beekeeper',
    'Мельник Авдей': 'Avdey the Miller',

    // --- Раунд 34: добор EN для строк раундов 30–33 (трапеза, следы, охота на вора) ---
    'Я помогу найти вора.': 'I will help find the thief.',
    'Расскажи подробнее.': 'Tell me more.',
    'Дай задаток за работу.': 'Give me an advance for the work.',
    'Извини, я спешу.': 'Forgive me, I am in haste.',
    '🍲 Заказать еду (2 д.)': '🍲 Order a meal (2 d.)',
    '🎒 Купить рацион на день дороги (2 д.)': '🎒 Buy a day\'s travel ration (2 d.)',
    'Фёдор качает головой: «Без денег и щи жидкие не варятся. Нужно 2 д.»':
        'Fyodor shakes his head: "Without coin even the shchi come out thin. Two dengas needed."',
    'Фёдор ставит перед тобой миску горячих щей, краюху ржаного хлеба и кружку кваса. Ешь не спеша — силы понемногу возвращаются.':
        'Fyodor sets before you a bowl of hot shchi, a hunk of rye bread and a mug of kvass. Eat unhurried — your strength slowly returns.',
    'Трапеза пройдёт в тот час, что уйдёт на беседу с хозяином.': 'The meal takes the same hour your talk with the host costs.',
    '«Два дняги — цена хлеба да бурдюка воды. Без денег не выйдет», — говорит Фёдор.':
        '"Two dengas — the price of a loaf and a waterskin. It won\'t happen without coin," Fyodor says.',
    'Рацион (хлеб да вода на день дороги)': 'Ration (bread and water for a day\'s travel)',
    'Купил рацион у хозяина постоялого двора (2 д.): хлеб и вода на день дороги.':
        'Bought a ration from the innkeeper (2 d.): bread and water for a day\'s travel.',
    'Фёдор заворачивает в тряпицу тёплый каравай ржаного хлеба и наливает бурдюк чистой воды — еды и питья на день дороги.':
        'Fyodor wraps a warm loaf of rye bread in a cloth and fills a waterskin with clean water — food and drink for a day\'s road.',
    'В кошеле': 'In your satchel',
    'Про мельницу расскажи.': 'Tell me about the mill.',
    'Спасибо за рассказ.': 'Thank you for the tale.',
    'Удачи тебе, Тарас.': 'Good fortune to you, Taras.',
    'Как семья живёт?': 'How does your family fare?',
    'Храни вас Бог.': 'God keep you.',
    'Доброго вам достатка.': 'May your household prosper.',
    'Как поживаете?': 'How do you fare?',
    'Спасибо, хозяйка.': 'Thank you, goodwife.',
    'Дай Бог вам здоровья.': 'God grant you health.',
    'Помолиться': 'Pray',
    'Ох, горе нам, чадо... Ночью случилось дело великое: вор прокрался в храм Божий и выкрал чудотворную икону Богородицы из самого киота! Я молился в алтаре, свечи ещё теплились — и слыхал только, как скрипнула дверца. А под утро глянул: киот пуст, лишь лампада коптит и пыль на полу лежит, где святыня стояла.\n\nВидел я в церкви темного человека краем глаза, а разобрать не успел — мелькнёт и нет. Одно скажу точно: человек был ПРИШЛЫЙ, не из наших селян — одеждой и повадкой странник, такой же пришлый человек в деревне, как и ты, чадо.\n\nСам я лица его не разглядел и куда побежал — не видал, Бог миловал. Но в деревне народ разный ходит, всякий на виду: кто у колодца зорит, кто на выпас глядит во все стороны. Может, кто-то из селян и видел вора — куда он бежал да где нынче прячется. ПОРАСПРОСИ ЛЮДЕЙ, чадо: спроси каждого о воре и о том, куда он мог податься. Господь путь укажет, а люди — подскажут.':
        'Oh, woe to us, my child... A great deed was done this night: a thief crept into the church of God and stole the wonderworking icon of the Mother of God from its very shrine! I was praying in the altar, the candles still burning — and all I heard was the little door creak. And at dawn I looked: the shrine empty, only the icon-lamp smoking and dust on the floor where the holy thing stood.\n\nI glimpsed a dark figure in the church from the corner of my eye, but could not make him out — a flash, and gone. One thing I can say for certain: he was a STRANGER, none of our villagers — a wayfarer in dress and manner, a newcomer to this village just as you are, my child.\n\nI did not see his face, nor where he ran — God spared me that. But many kinds of people walk about the village, all in plain sight: some keep watch by the well, some stare in every direction on the pasture. Perhaps one of the villagers did see the thief — where he ran and where he hides now. QUESTION THE PEOPLE, my child: ask everyone about the thief and where he might have gone. The Lord will show the way, and the people will help.',
    'Мир тебе, чадо. Что привело тебя в дом Божий? Может, хочешь исповедаться или помолиться?':
        'Peace to you, my child. What brings you to the house of God? Would you confess, or pray?',
    'Батюшка кладёт руку тебе на голову и шепчет молитву. Тепло разливается по плечам.\n\n✨ Благословение…':
        'The priest lays his hand on your head and whispers a prayer. Warmth spreads over your shoulders.\n\n✨ A blessing…',
    'Первый разговор с батюшкой: он рассказал о краже иконы и посоветовал расспросить селян.':
        'First talk with the priest: he told of the icon\'s theft and advised questioning the villagers.',
    'Уютная горница с иконами в углу. Староста сидит за столом, перебирая бумаги.':
        'A snug chamber with icons in the corner. The elder sits at the table, sorting through papers.',
    'Просторный зал с деревянными столами. Пахнет хлебом да хмельным мёдом. У печи греются путники.':
        'A spacious hall with wooden tables. The air smells of bread and honey mead. Travellers warm themselves by the stove.',
    'Жарко. Стук молота по наковальне. На стенах развешаны мечи и кольчуги.':
        'It is hot here. The hammer rings on the anvil. Swords and mail shirts hang on the walls.',
    'Скромная изба. Хозяин сидит на лавке, с обеспокоенным лицом.':
        'A modest izba. The host sits on the bench, his face troubled.',
    'Тихий дом. Пахнет сушёными травами и мёдом. Хозяйка приглядывает за горшками с целебными настоями.':
        'A quiet house. It smells of dried herbs and honey. The mistress tends pots of healing infusions.',
    'Снопы под потолком, мешки с зерном, пахнет сухой соломой и мышами. Община хранит здесь общее зерно — за молотьбу платят по копеечке.':
        'Sheaves under the roof, sacks of grain, the smell of dry straw and mice. The community keeps its common grain here — a small coin is paid for threshing.',
    'Небольшая деревянная церковь с резным иконостасом. Пахнет ладаном и воском. У алтаря молится седой священник, а ниша главного киота пуста — чудотворную икону этой ночью унесли воры.':
        'A small wooden church with a carved iconostasis. It smells of incense and wax. A grey-haired priest prays by the altar — and the niche of the main shrine stands empty: thieves carried off the wonderworking icon this very night.',
    'Опушка леса': 'Forest edge',
    'Краешек леса, где кончается трава и начинаются деревья. Светло, грибные места да ягодные кусты.':
        'The rim of the forest where grass gives way to trees. Bright and open, with mushroom grounds and berry bushes.',
    // Раунд 39 (п.23): лес — единая локация цепочкой
    'Лес': 'Forest',
    'Густой лес': 'Dense Forest',
    'Глубина леса: тёмная чаща за опушкой и поляной. Много зверья и грибов, но и разбойники водятся.':
        'The deep forest: dark thicket beyond the edge and the glade. Much game and mushrooms — and robbers, too.',
    'Глубина леса: тёмная чаща за опушкой и поляной. Много следов, но и много зверья.':
        'The deep forest: dark thicket beyond the edge and the glade. Many tracks — and much game.',
    '🌲 Лес цепочкой: Опушка леса → Лесная поляна → Густой лес. Вход — только через Опушку, выход — последовательно.':
        '🌲 The Forest is a chain: Forest edge → Forest glade → Dense forest. Enter only via the Edge; leave step by step.',
    '🌿 Глубже в лес: {0} →': '🌿 Deeper into the forest: {0} →',
    '◀ К околице': '◀ To the outskirts',
    'Вход: Опушка': 'Entry: Forest edge',
    'Центр: Лесная поляна': 'Center: Forest glade',
    'Глубина: Густой лес': 'Depth: Dense forest',
    '🌲 Лес — единая локация цепочкой: вход через Опушку → Поляна → Густой лес; выход последовательно.':
        '🌲 The Forest is one chained location: enter via the Edge → Glade → Dense forest; leave step by step.',
    '🌲 Лес — единая локация цепочкой: вход через Опушку → Поляна → Густой лес; выход последовательно.':
        '🌲 The Forest is one chained location: enter via the Edge → Glade → Dense forest; leave step by step.',
    'Лесная поляна': 'Forest glade',
    'Солнечная поляна среди леса, в кольце деревьев. Много цветов, ягод и пчелиного звона.':
        'A sunlit glade ringed by trees. Abundant flowers, berries and the humming of bees.',
    'Густая чаща за опушкой и поляной. Много следов, но и много зверья.':
        'Thick thicket beyond the edge and the glade. Many tracks — and much game.',
    'Густая чаща за опушкой и поляной. Много зверья и грибов, но и разбойники водятся.':
        'Thick thicket beyond the edge and the glade. Much game and mushrooms — but brigands roam here too.',
    'Заливной луг с густой сочной травой и множеством цветов. Здесь пасутся деревенские коровы, козы и лошади, тут же пастух присматривает за стадом.':
        'A water-meadow of thick, lush grass and countless flowers. The village cows, goats and horses graze here, and a shepherd watches over the herd.',
    'Старые следы вора истёрлись за давностью — земля их больше не хранит.':
        'The old footprints have worn away with time — the earth keeps them no longer.',
    'Снегопад замёл все старые следы вора — остались только свежие, оставленные уже под снегом.':
        'The snowfall has buried all the thief\'s old tracks — only fresh ones remain, left after the snow.',
    'Дождь размыл все старые следы вора — остались только свежие, оставленные уже под дождём.':
        'The rain has washed away all the thief\'s old tracks — only fresh ones remain, left after the rain.',
    'Следов вора здесь нет.': 'No tracks of the thief here.',
    '📍 Вор сейчас на дороге к «{0}»!': '📍 The thief is on the road to "{0}"!',
    '📍 Вор сейчас где-то у «{0}»!': '📍 The thief is hiding somewhere at "{0}"!',
    'След ещё хранит отпечаток, но свежесть ушла.': 'The print is still there, but its freshness is gone.',
    'Этот след ты уже затоптал — больше он ничего не скажет.': 'You already trampled this print — it will tell you no more.',
    'Ночь: в темноте и следы читаются куда хуже.': 'Night: in the darkness tracks are far harder to read.',
    'Пока ты склонялся над следом, вор успел скрыться из вида...': 'While you bent over the print, the thief slipped out of sight...',
    '📍 ПОП-АП: вор сейчас на дороге к «{0}»!': '📍 TIP: the thief is on the road to "{0}"!',
    '📍 ПОП-АП: вор сейчас где-то у «{0}»!': '📍 TIP: the thief is hiding somewhere at "{0}"!',
    'След прочитан, но человек он скрытный — куда подался, не разобрать.':
        'The print is read, but he is a stealthy one — where he went is anyone\'s guess.',
    'Сам след ведёт в сторону «{0}».': 'The print itself leads toward "{0}".',
    'Ты пригляделся к следу, но неосторожно наступил — отпечаток затрётся и пропал. Больше этот след не обследовать.':
        'You studied the print, but stepped carelessly — the print will smear away. This track can be examined no more.',
    'Видел я его, темного человека! Он бежит к «{0}» — поспеши, догонешь!':
        'I saw him, the dark man! He is running toward "{0}" — hurry, you will catch him!',
    'Видел я его, темного человека! Он сейчас прячется у «{0}» — поспеши!':
        'I saw him, the dark man! He is hiding at "{0}" right now — hurry!',
    'Видел я вора, да куда он подался — не ведаю.': 'I saw the thief, but where he went — I cannot say.',
    'Вор? Здесь не пробегал. Я бы заметил — весь день на виду был.':
        'The thief? No one ran past here. I would have noticed — I was in plain sight all day.',
    'Темных людей не видал, батиушко упаси. Может, в другой стороне ищешь?':
        'I saw no dark figures, God forbid. Perhaps you should search another way?',
    'Вор затаился на месте — уйдёт не раньше, чем через три часа. Но и раны его не заживали: сил у него меньше, чем было.':
        'The thief is lying low — he will not move for at least three hours. But his wounds have not healed: his strength is less than it was.',
    'Вор ещё не залечил раны с прошлой схватки — он ослаблен!': 'The thief has not yet healed from your last fight — he is weakened!',
    '⚔ Бой пошаговый (BRP d100): атака, уклон, трава, побег.\nПроверки навыков бросают d100: успех — в пределах навыка,\nкрит — 1/20 навыка (урон ×1.5), особый успех — 1/5 (урон ×2).\n🛡 Доспех поглощает урон каждого попадания.':
        '⚔ Combat is turn-based (BRP d100): attack, dodge, herbs, escape.\nSkill checks roll d100: success is within the skill value,\ncritical is 1/20 of it (damage ×1.5), special success — 1/5 (damage ×2).\n🛡 Armour absorbs damage from every hit.',
    'Вор повержен! Икона у тебя!': 'The thief is defeated! The icon is yours!',
    '🐺 Стая напугана — волки держатся подальше': '🐺 The pack is frightened — the wolves keep their distance',
    '⏳ Вор скроется примерно через {0} ч.': '⏳ The thief will vanish in about {0} h.',
    '⏳ Часов до побега вора: {0}': '⏳ Hours until the thief escapes: {0}',
    'Опушка': 'Forest Edge',
    'Поляна': 'Glade',
    '🗺 Околица — карта местности: выбирай локацию и в путь.\nКаждый переход по карте занимает ровно 1 игровой час.\nСледы вора живут от 12 до 24 часов — а дождь и снег смывают их и раньше.':
        '🗺 The outskirts — a map of the area: pick a location and set out.\nEvery crossing on the map takes exactly 1 game hour.\nThe thief\'s tracks last 12 to 24 hours — and rain or snow washes them away even sooner.',
    '🏠 Разговор с хозяином дома занимает 1 игровой час —\nвыбирай, с кем и о чём говорить.\n📦 Сундуки и тайники открываются раз в игровой день.\n◀ Выход — кнопка внизу.':
        '🏠 Talking to a host takes 1 game hour —\nchoose whom and what to speak about.\n📦 Chests and hiding places open once per game day.\n◀ Leave by the button below.',
    '💬 Поговорить': '💬 Talk',
    '💰 Просить денег': '💰 Ask for money',
    '📜 Задание': '📜 Quest',
    '🎁 Подарить': '🎁 Give a gift',
    '👍 Похвалить': '👍 Praise',
    '😠 Угрожать': '😠 Threaten',
    '💍 Свататься': '💍 Court',
    '🍻 Угостить (20д)': '🍻 Treat (20 d.)',
    '🛒 Купить еды': '🛒 Buy food',
    '🛏 Отдых': '🛏 Rest',
    '🎒 Мой тюк': '🎒 My bundle',
    '🛒 Купить оружие': '🛒 Buy weapons',
    '🙏 Помолиться': '🙏 Pray',
    '🕯 Пожертвовать (5д)': '🕯 Donate (5 d.)',
    '🔍 Осмотреть киот': '🔍 Examine the shrine',
    '⚒ Работать (1 час)': '⚒ Work (1 hour)',
    '🌾 Осмотреть зерно': '🌾 Inspect the grain',
    '🎒 Мой узел': '🎒 My pack',
    '🚪 Выйти': '🚪 Leave',
    '📜 Персонаж': '📜 Character',
    '🎒 Инвентарь': '🎒 Inventory',
    '🔍 Каждый след проверяется отдельно и только один раз;\nнеудача затирает след. Ночью следы читаются хуже.\n🕐 Обследование следа занимает ровно 1 игровой час.\n◀ Назад к развилке — тоже час дороги.':
        '🔍 Each track is examined separately and only once;\na failure smears the print away. At night tracks are harder to read.\n🕐 Examining a track takes exactly 1 game hour.\n◀ Back to the crossroads — another hour of road.',
    '⟳ Наводка устарела': '⟳ The tip has gone stale',
    '📍 Ты по адресу!': '📍 You are on the spot!',
    'Селяне говорили, что вора видели у «{0}». Но с той поры прошло больше пяти часов — наводка больше не верна: вор давно перебрался в другое место. Ищи свежие следы или расспроси новых людей!':
        'The villagers said the thief was seen at "{0}". But more than five hours have passed — the tip no longer holds: the thief moved elsewhere long ago. Look for fresh tracks or question new people!',
    'Селяне говорили правду: вора видели именно здесь, у «{0}»! Но помни: наводка живёт только 5 часов с разговора — осталось около {1} ч. Потом вор уйдёт в другое место!':
        'The villagers spoke true: the thief was seen here at "{0}"! But remember: a tip lives only 5 hours from the talk — about {1} h remain. Then the thief will move elsewhere!',
    'Расспросить о воре': 'Question about the thief',
    '✨ след прочитан': '✨ print read',
    '🔍 след вора': '🔍 thief\'s print',
    '✨ След прочитан!': '✨ Print read!',
    '🔍 След': '🔍 Print',
    '🔍 След затёрт': '🔍 Print smeared away',

    // --- Раунд 34: возрастные группы и обращения (дети и не только) ---
    'младенец': 'babe in arms',
    'мальчик': 'boy', 'девочка': 'girl',
    'парень': 'lad', 'девушка': 'lass',
    'мужчина': 'man', 'женщина': 'woman',
    'старик': 'old man', 'старуха': 'old woman',
    'незнакомец': 'stranger',
    'селянин': 'peasant', 'селянка': 'peasant woman',
    'кузнец': 'blacksmith', 'священник': 'priest', 'староста': 'village elder',
    'охотник': 'hunter', 'травник': 'herbalist', 'травница': 'herbal woman',
    'пастух': 'shepherd', 'пастушка': 'shepherd girl',
    'тавернщик': 'innkeeper', 'тавернщица': 'innkeeper\'s wife',
    'рыбак': 'fisherman', 'мельник': 'miller', 'пахарь': 'ploughman',
    'пасечник': 'beekeeper', 'пасечница': 'beekeeper woman',
    'плотник': 'carpenter', 'стражник': 'guard', 'инок': 'monk',
    'торгарь': 'trader', 'торгарка': 'trader woman',
    'ткачиха': 'weaver', 'повитуха': 'midwife', 'вдова': 'widow',
    'хозяйка': 'goodwife', 'ребёнок': 'child', 'дитя': 'child',

    // --- Раунд 34: колокольный звон по службам ---
    'заутреня': 'Matins', 'обедня': 'the Divine Liturgy', 'вечерня': 'Vespers',
    'повечерие': 'Compline', 'всенощное бдение': 'the All-Night Vigil',
    '🔔 Благовѣстъ къ заутрени…': '🔔 The bell tolls for Matins…',
    '🔔 Благовѣстъ къ обеднѣ…': '🔔 The bell tolls for the Divine Liturgy…',
    '🔔 Благовѣстъ къ вечернѣ…': '🔔 The bell tolls for Vespers…',
    '🔔 Благовѣстъ къ всенощной…': '🔔 The bell tolls for the All-Night Vigil…',
    '🔔 Благовѣстъ къ повечерію…': '🔔 The bell tolls for Compline…',
    '🔔 Трезвонъ! В храмѣ — заутреня': '🔔 The peal rings out — Matins at the church',
    '🔔 Трезвонъ! В храмѣ — обедня': '🔔 The peal rings out — the Divine Liturgy at the church',
    '🔔 Трезвонъ! В храмѣ — вечерня': '🔔 The peal rings out — Vespers at the church',
    '🔔 Трезвонъ! В храмѣ — всенощное бдение': '🔔 The peal rings out — the All-Night Vigil at the church',
    '🔔 Трезвонъ! В храмѣ — повечерие': '🔔 The peal rings out — Compline at the church',
    'Слышишь, колокол звонит?': 'Do you hear the bell ringing?',

    // --- Раунд 34: детские диалоги (реплики-выборы) ---
    'Мир и тебе, малой.': 'Peace to you too, little one.',
    'Во что играете?': 'What are you playing?',
    'Слышишь, звонят?': 'Do you hear the ringing?',
    'А за околицей что?': 'What lies beyond the outskirts?',
    'Береги себя, детка.': 'Take care, little one.',
    'Ну-ну, ври дальше.': 'Sure, keep making things up.',
    'Покажи, как играешь.': 'Show me how you play.',
    'И кто же победил?': 'And who won?',
    'Возьми конфетку.': 'Here, take a sweet.',
    'Чур, не выдумывай!': 'Don\'t make things up!',

    // --- Раунд 36: выборы из взрослых деревьев диалогов (обёрнуты в t()) ---
    'Я найду его!': 'I will find him!',
    'Я берусь за поиски.': 'I will take up the search.',
    'Подумаю.': 'Let me think.',
    'Спасибо. Я берусь за поиски.': 'Thank you. I will take up the search.',
    'Понятно.': 'Understood.',
    'Понятно, спасибо.': 'Understood, thank you.',
    'Слава Богу.': 'Glory to God.',
    'Спасибо.': 'Thank you.',
    'Я найду её, батюшка!': 'I will find it, father!',

    // Раунд 36 (добор): строки, обёрнутые в t() в прошлых раундах, но
    // отсутствовавшие в словаре (actions у victory_continue и трапезы)
    'Герой остался в деревне — добрые дела теперь в его воле.':
        'The hero stayed in the village — good deeds are now in his keeping.',
    'Осталось действий': 'Actions left',

    // --- Раунд 45: вира по Судебнику, убийство НПЦ, перемирье, кузница ---
    '🤝 Просить мира (вира по Судебнику)':
        '🤝 Ask for peace (wergild, by the Law Code)',
    '🤝 Просить мира ещё': '🤝 Ask for peace with another',
    'Пока не помирюсь.': 'I will not make peace yet.',
    'Спасибо, староста.': 'Thank you, elder.',
    '• {0} — в ярости (репутация {1}), вира {2} д.':
        '• {0} — in fury (reputation {1}); wergild {2} d.',
    '🤝 Мириться с {0} ({1} д.)': '🤝 Make peace with {0} ({1} d.)',
    'Продать': 'Sell',
    ' (скидка за добрую славу)': ' (good-repute discount)',
    ' (наценка за дурную славу)': ' (ill-repute surcharge)',
    ' 🔒 воинское': ' 🔒 warrior-grade',
    ' 🔒': ' 🔒',
    'Продать можно лишь то, что не надето на тебя (полцены):':
        'Only what you are not wearing can be sold (half price):',
    'В узле нечего продать — всё надето или пусто.':
        'Nothing to sell — everything is worn or the bag is empty.',
    '💰 {0} — {1} д. (полцены)': '💰 {0} — {1} d. (half price)',
    'Кузнец Данила откладывает молот и крестит руки на груди:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»':
        'Smith Danila lays down the hammer and folds his arms:\n"I will neither sell to you nor buy from you, man of ill repute. Begone!"',
    'Кузнец Данила качает головой: «{0}.»':
        'Smith Danila shakes his head: "{0}."',
    'По уложению Судебника воинское снаряжение не продаётся несовершеннолетним (с 18 лет)':
        'By the Law Code, warrior-grade gear is not sold to minors (from age 18)',
    'По уложению Судебника воинское снаряжение не продаётся людям дурной славы (репутация деревни ниже 0)':
        'By the Law Code, warrior-grade gear is not sold to those of ill repute (village reputation below 0)',
    ' (воинское снаряжение, по уложению Судебника)':
        ' (warrior-grade gear, by the Law Code)',
    '🕯 Здесь стоит тишина...': '🕯 Silence fills this place...',
    '{0} погиб(ла) от твоей руки.\nДом опустел, вещи прикрыты холстиной.\nДеревня шепчется о кровной вине.':
        '{0} perished at your hand.\nThe house stands empty, the things draped in linen.\nThe village whispers of blood-guilt.',
    'Староста может смыть эту вину вирой — если заплатишь.':
        'The elder can wash away this guilt with wergild — if you pay.',
    '☠ Кровная вина!': '☠ Blood-guilt!',
    'Ты убил {0}. Вся деревня в ужасе: репутация в деревне и у всех жителей упала на 50!\n{1}\nТакие грехи смываются только вирой у старосты — если он согласится мирить.':
        'You killed {0}. The whole village is horrified: village and every villager\'s reputation fell by 50!\n{1}\nOnly the wergild paid to the elder can wash away such a sin — if he agrees to make peace.',
    'Родня убитого проклинает тебя: их репутация упала до −100.':
        'The slain one\'s kin curse you: their reputation fell to −100.',
    'Староста разводит руками: «На тебя никто больше не в ярости — мирить некого. Спасибо Судебнику!»':
        'The elder spreads his hands: "Nobody rages at you anymore — no one to reconcile. Thank the Law Code!"',
    'Староста листает Судебник: «Обида смывается серебром. Вира за кровь свободного мужа — 40 гривен (80 д.), за женщину или отрока — полувирье (40 д.), да продажа мне за суд — 20 д. За разбой без всякой свады — всё вдвое. Плати — и обиженный тебя простит (репутация станет +30).»':
        'The elder leafs through the Law Code: "Grievance is washed away with silver. Wergild for a free man\'s blood — 40 grivnas (80 d.), for a woman or a youth — half-wergild (40 d.), plus 20 d. of the fine to me for the court. For lawless robbery — double. Pay, and the offended will forgive you (reputation becomes +30)."',
    '{0} убит! Кровная вина пала на тебя...': '{0} is slain! Blood-guilt has fallen upon you...',
    'Уходи! Я тебя ненавижу... но староста велел крови сегодня не проливать.':
        'Away with you! I hate you... but the elder bade no blood be shed today.',
    'Побег из боя с разгневанным жителем (бросок {0}, успех). Он не нападёт снова сразу — перемирье на 12 часов.':
        'Escaped the fight with the enraged villager (roll {0}, success). He will not attack again at once — a truce for 12 hours.',
    'Кузнец Данила отказался торговаться с героем дурной славы (репутация ≤ −50).':
        'Smith Danila refused to trade with a hero of ill repute (reputation ≤ −50).',
    '🚪 ИЗГНАН ИЗ ДЕРЕВНИ': '🚪 EXILED FROM THE VILLAGE',
    'Изгнан': 'Exiled',
    'Староста выгнал тебя на все четыре стороны: деревня не прощает крови и бесчестия.':
        'The elder drove you beyond the gates: the village forgives neither blood nor dishonour.',

    // --- Раунд 36: репутационная победа (отдельная ветка финала) ---
    '🌿 ПОБЕДА! ТЕБЯ ПРИНЯЛИ КАК СВОЕГО': '🌿 VICTORY! TAKEN IN AS ONE OF THE VILLAGE',
    'Староста собрал всю деревню: «Ты добрыми делами снискал нашу любовь. Отныне ты — не гость, а свой!» Жители чествуют тебя хлебом-солью.':
        'The elder gathered the whole village: "You have won our love with good deeds. From now on you are not a guest, but one of our own!" The villagers honour you with bread and salt.',
    'Тебя приняли в деревню как своего! Победа!': 'The village has taken you in as one of its own! Victory!',
    'Деревня тебя полюбила, но зваться «своим» судьбой суждено после возврата иконы и продолжения похода.':
        'The village has grown fond of you, but to be called "one of our own" is fated only after the icon is returned and the journey continues.',
    'Деревня тебя полюбила!': 'The village has grown fond of you!',
    'Душа деревни': 'Soul of the Village',
    'Ни одной ошибки, и весь приход любит тебя. Редкий дар!':
        'Not a single mistake, and the whole parish loves you. A rare gift!',
    'Свой человек': 'One of Our Own',
    'Тебя приняли в деревню как родного: добрые дела и честный труд дороже золота.':
        'The village has taken you in as kin: good deeds and honest labour are worth more than gold.',
    'Долгий путь к доверию': 'A Long Road to Trust',
    'Любовь деревни снискивается годами — и ты её снискал.':
        "A village's love is earned over years — and you have earned it.",

    // --- Раунд 36: рыбалка на Реке (пруд в деревне удалён) ---
    '🎣 Рыбалка': '🎣 Fishing',
    '🎣 Лунка во льду': '🎣 Ice Fishing Hole',
    'Прорубаешь лунку на реке и долго ждёшь, грея пальцы... Поплавок дёргается — на льду бьётся налим. Ужин обеспечен.':
        'You cut a hole in the river ice and wait long, warming your fingers... The float jerks — a burbot thrashes on the ice. Supper is secured.',
    'Забросил удочку с берега под моросящим дождём... Рыба клюёт одна за другой — вёдра полные!':
        'You cast your line from the bank in the drizzling rain... Fish bite one after another — the buckets are full!',
    'Забросил удочку с песчаного брода... Через час в корзине пара ершей и лещ. Свежая рыба — это силы.':
        'You cast your line from the sandy ford... An hour later there are a couple of ruffe and a bream in the basket. Fresh fish means strength.',
    'Свежая рыба': 'Fresh fish',
    'Взять улов': 'Take the catch',
    'Порыбачил на реке — клёв плохой.': 'Went fishing at the river — the bite is poor.',
    'Клюёт плохо: рыба сыта или уже видела твою наживку. Попробуй завтра.':
        'The bite is poor: the fish are full or have already seen your bait. Try again tomorrow.',
    'Смотать удочку': 'Reel in the line',

    // --- Раунд 37: меню внешности на LPC-слоях (CharacterAppearanceScene) ---
    '🎨 Настройка внешности': '🎨 Character Appearance',
    'Одежда и лицо — из тех же слоёв, что у жителей деревни. Ходьба и взгляд в 4 стороны.':
        'Clothes and face use the same layers as the villagers. Walk and look in 4 directions.',
    'Тип персонажа': 'Character Type',
    'Категории': 'Categories',
    'Рубаха/куртка': 'Shirt / Jacket',
    'Отделка куртки': 'Jacket Trim',
    'Штаны/юбка': 'Trousers / Skirt',
    'Готовим одежду...': 'Preparing the clothes...',
    'Собираем облик...': 'Assembling your look...',
    'Форма:': 'Shape:',
    'Цвет:': 'Colour:',
    'Нет бороды': 'No beard',
    'Щетина': 'Stubble',
    'Короткая': 'Short',
    'Средняя': 'Medium',
    'Подстриженная': 'Trimmed',
    'Борода лопатой': 'Full spade beard',
    'Усы': 'Mustache',
    'Борода — только мужчинам.': 'A beard is for men only.',
    // Телосложение (тона кожи)
    'Светлое': 'Fair',
    'Загорелое': 'Tanned',
    'Оливковое': 'Olive',
    'Серо-бурое': 'Taupe',
    'Янтарное': 'Amber',
    'Бронзовое': 'Bronze',
    // Причёска: формы
    'Под горшок': 'Bowl cut',
    'На бок': 'Side-swept',
    'Взъерошенная': 'Ruffled',
    'С чёлкой': 'With bangs',
    'Распущенные': 'Loose',
    'Волнистые': 'Wavy',
    'Косички': 'Braids',
    // Причёска: цвета
    'Чёрные': 'Black',
    'Тёмно-русые': 'Dark brown',
    'Каштановые': 'Chestnut',
    'Светлые': 'Blond',
    'Седые': 'Grey',
    // Глаза
    'Карие': 'Brown',
    'Голубые': 'Blue',
    'Серые': 'Grey',
    'Зелёные': 'Green',
    // Борода: цвета
    'Чёрная': 'Black',
    'Тёмно-русая': 'Dark brown',
    'Каштановая': 'Chestnut',
    'Светлая': 'Blond',
    'Седая': 'Grey',
    // Рубаха/куртка
    'Сукно зелёное': 'Green cloth',
    'Сукно рыжее': 'Tan cloth',
    'Сукно тёмное': 'Dark cloth',
    'Сукно бордовое': 'Maroon cloth',
    'Сукно белое': 'White cloth',
    'Шнуровка зелёная': 'Laced, green',
    'Шнуровка рыжая': 'Laced, tan',
    'Шнуровка тёмная': 'Laced, dark',
    'Шнуровка бордовая': 'Laced, maroon',
    'Шнуровка белая': 'Laced, white',
    // Отделка куртки
    'Без отделки': 'No trim',
    'Жилет тёмный': 'Dark jerkin',
    'Жилет зелёный': 'Green jerkin',
    'Жилет бордовый': 'Maroon jerkin',
    'Жилет рыжий': 'Tan jerkin',
    'Жилет белый': 'White jerkin',
    'Плащ': 'Cape',
    // Штаны/юбка
    'Штаны зелёные': 'Green trousers',
    'Штаны рыжие': 'Tan trousers',
    'Штаны тёмные': 'Dark trousers',
    'Штаны бордовые': 'Maroon trousers',
    'Штаны белые': 'White trousers',
    'Порты чёрные': 'Black breeches',
    'Порты бурые': 'Brown breeches',
    'Порты серые': 'Grey breeches',
    'Обмотки рыжие': 'Tan leg wraps',
    'Обмотки зелёные': 'Green leg wraps',
    'Обмотки тёмные': 'Dark leg wraps',
    'Обмотки бордовые': 'Maroon leg wraps',
    'Обмотки белые': 'White leg wraps',
    'Понёва рыжая': 'Tan poneva skirt',
    'Понёва зелёная': 'Green poneva skirt',
    'Понёва тёмная': 'Dark poneva skirt',
    // Обувь
    'Сапоги тёмные': 'Dark boots',
    'Сапоги зелёные': 'Green boots',
    'Сапоги бордовые': 'Maroon boots',
    'Сапоги рыжие': 'Tan boots',
    'Постолы рыжие': 'Tan postoly',
    'Постолы тёмные': 'Dark postoly',
    'Онучи (лапти)': 'Foot wraps (lapti)',
    // Пресеты «Тип персонажа» (простолюдины Руси XV века)
    'Пахарь': 'Ploughman',
    'Бортник-охотник': 'Wild-hive hunter',
    'Мастеровой': 'Craftsman',
    'Офеня-коробейник': 'Peddler (ofenya)',
    'Ратник ополчения': 'Militia trooper',
    'Паломник': 'Pilgrim',
    'Крестьянка': 'Peasant woman',
    'Ткачиха': 'Weaver (f)',
};

// ----- Шаблоны с семантическими ключами (большие тексты) -----
const EN_KEYS = {
    // Раунд 32 (пп.14,15): обязательная строка «Информации по игре» (F1)
    'help.timeRatio':
        '⏱ TIME: 1 minute of real time = 20 minutes of game time (1:20 ratio),\n' +
        '  a full game day passes in 72 real minutes.\n' +
        '  Any travel between locations on the map takes EXACTLY 1 game hour.\n' +
        '  Talking to an NPC costs 1 hour; examining a footprint costs 1 hour.\n' +
        '  While a conversation is open, the real-time countdown is PAUSED.\n' +
        '  The thief moves AT MOST ONE STEP per game hour.\n' +
        '  🔔 Bells ring for the services: a toll before Matins (~6 o\'clock),\n' +
        '  the Liturgy (at noon), Vespers (toward 3 pm) and Compline (toward 6 pm).',
    'title.about': '«The Chronicles of Ruthenia» — a browser RPG set in 15th-century Rus\'.\n' +
        'Role-playing system: BRP (Basic Roleplaying Universal Game Engine SRD) — ' +
        'characteristics 3d6×5, d100 skill checks, critical success 1/20 of the skill, ' +
        'special success 1/5 of the skill, damage bonus from the STR+SIZ table.\n' +
        'Money: rubles, grivnas, kunas, dengas (15th-century Rus\').\n' +
        'Controls: WASD/arrows — move, E — interact.\n' +
        'The run is one-shot — no save games.\n' +
        'Note: quest and dialogue texts are currently in Russian; the interface is translated.',
    'title.help.body': '🎯 GOAL:\n' +
        'You are a refugee in an unfamiliar village. Settle in, find work,\n' +
        'earn the villagers\' trust. Reach +100 reputation — or get married.\n' +
        '\n' +
        '⏱ TIME: 1 minute of real time = 20 minutes of game time (1:20 ratio),\n' +
        '  a full game day passes in 72 real minutes. Any travel between locations\n' +
        '  on the map takes EXACTLY 1 game hour. Talking to an NPC costs 1 hour;\n' +
        '  examining a footprint costs 1 hour. While a conversation is open, the\n' +
        '  real-time countdown is PAUSED. The thief moves at most one step per hour.\n' +
        '\n' +
        '🎮 CONTROLS:\n' +
        '  WASD / arrows — movement (all 4 directions)\n' +
        '  E / space — interact (enter a building, talk)\n' +
        '  LMB on a building — walk up and enter\n' +
        '  LMB on an NPC — walk up and start talking\n' +
        '  RMB on an NPC — show reputation and condition\n' +
        '  F1 — this help window\n' +
        '  ESC — main menu\n' +
        '\n' +
        '⚠ DEFEAT:\n' +
        '  • The hero dies in combat\n' +
        '  • Village reputation −100 → exile (only at the very bottom!)\n' +
        '  • The icon thief escapes (turn limit)\n' +
        '\n' +
        '🏆 VICTORY:\n' +
        '  • Village reputation +100 → accepted as one of their own\n' +
        '  • Marriage (NPC rep +90, village +50, 200 dengas)\n' +
        '\n' +
        '⭐ REPUTATION:\n' +
        '  Raise it: quests, gifts, praise, buying drinks for everyone.\n' +
        '  Lower it: begging, threats, night-time disturbance.\n' +
        '  ≤ −30: NPC won\'t talk. ≤ −50: won\'t trade. ≤ −80: may attack.\n' +
        '  Killed a villager? Village and all NPCs −50, the kin — down to −100.\n' +
        '  The elder accepts wergild (vira): silver buys peace (+30 to enmity).',
    'forest.help.body': '🌲 DARK FOREST — A WALK\n' +
        '\n' +
        '  WASD / arrows — movement\n' +
        '  E — gather mushrooms, berries and herbs (limited per day)\n' +
        '  Wolves patrol the thicket: don\'t get close.\n' +
        '  In rain they hear worse — their aggro radius shrinks.\n' +
        '  The bandits\' stash may hold coin — but sometimes it\'s an ambush.\n' +
        '  If a wolf is defeated, the pack stays scared for 4 hours.\n' +
        '  F1 — this help. ESC — main menu.',
    'apiary.help.body': '🐝 APIARY — A QUIET STROLL\n' +
        '\n' +
        '  WASD / arrows — movement\n' +
        '  E — walk up to a hive and watch the bees; they are busy with their own business.\n' +
        '  The smudge fire by the hut smoulders peacefully — pure scenery, leave it be.\n' +
        '  In winter, rain and at night the bees sleep and the apiary falls quiet.\n' +
        '  The exit to the outskirts is on the southern edge.',
    'village.help.body': '🏠 DVINSKAYA SLOBODA\n' +
        '\n' +
        '  WASD / arrows — movement\n' +
        '  E — interact: doors, chests, campfire, the stone cross\n' +
        '  Chests hold small loot — once a day each.\n' +
        '  The campfire restores Health and Will (1 hour).\n' +
        '  Fishing — at the River on the map (best in the rain).\n' +
        '  At night windows glow and fireflies come out.\n' +
        '  F1 — this help. ESC — main menu.',

    // --- Раунд 44: возраст персонажа (15..50) и правила BRP SRD ---
    'Возраст:': 'Age:',
    'Возраст': 'Age',
    'лет': 'y.o.',
    'в расцвете сил — без штрафов': 'in one\'s prime — no penalties',
    'отрок': 'young lad', 'отроковица': 'young lass',
    'юнец': 'youth', 'девица': 'maiden',
    'взрослый': 'adult', 'взрослая': 'adult woman',
    'зрелый': 'mature', 'зрелая': 'mature woman',
    'пожилой': 'elderly', 'пожилая': 'elderly woman',
    'Сила': 'Strength', 'Телосложение': 'Constitution', 'Размер': 'Size', 'Ловкость': 'Dexterity',
    'Боевые навыки': 'Combat skills',
    'Уклонение': 'Dodge',
    'Общение и Знания': 'Communication & Knowledge',
    'Я маленький ещё, я не видал никакого вора. Дядька, не гоняй меня!':
        'I\'m just a child, I saw no thief. Please don\'t chase me away, sir!',
};

// ----- Месяцы / дни недели (сентябрьский стиль индексации) -----
export const EN_MONTHS = [
    'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
];
export const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function t(ru) {
    if (!isEn()) return ru;
    return Object.prototype.hasOwnProperty.call(EN, ru) ? EN[ru] : ru;
}

export function tf(pattern, ...args) {
    let s = t(pattern);
    args.forEach((v, i) => {
        s = s.split('{' + i + '}').join(String(v));
    });
    return s;
}

export function tk(key, ru) {
    if (!isEn()) return ru;
    return Object.prototype.hasOwnProperty.call(EN_KEYS, key) ? EN_KEYS[key] : ru;
}

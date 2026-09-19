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
    // Раунд 57 (п.4 приказа): «Помощь» переименована в «Инструкцию»
    '❓ Инструкция': '❓ Instructions',
    'Инструкция': 'Instructions',
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

    // --- Пасека (раунд 17: пчёлы — только антураж; раунд 57 — единый вход) ---
    '🐝 Пасека': '🐝 Apiary',
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
    // Раунд 58 (п.2): счётчик времени до побега вора — в игровых часах
    // (EN для «⏳ Часов до побега вора: {0}» уже есть в словаре выше)
    '⏳{0} ч до побега': '⏳{0} h until escape',
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
    '😱 Встреча с {0}!': '😱 You met the thief!',
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
    // ================================================================
    // --- РАУНД 57 (п.1 приказа владельца): EN-ПЕРЕВОД ГЛУБИННЫХ ТЕКСТОВ ---
    // Диалоги, интерьеры, торг, угрозы/похвала/сватовство, бой, охота на
    // вора, расписания занятий, эпитафии, вирa по Судебнику, свадьба,
    // финальные экраны и летопись (ActionLog). Русский текст — ключ.
    // ================================================================
    '• {0} — обида на тебя (репутация {1}), вира {2} д.': '• {0} — bears a grudge against you (reputation {1}); wergild {2} d.',
    'Поговорил со старостой — получил задание найти вора.': 'Talked to the elder — got the task of finding the thief.',
    'Поход завершён по воле героя.': 'The quest ended by the hero\'s own will.',
    'Ох, горе нам, чадо... Ночью случилось дело великое: вор прокрался в храм Божий и выкрал чудотворную икону Богородицы из самого киота! Я молился в алтаре, свечи ещё теплились — и слыхал только, как скрипнула дверца. А под утро глянул: киот пуст, лишь лампада коптит и пыль на полу лежит, где святыня стояла.\n\nВидел я в церкви темного человека краем глаза, а разобрать не успел — мелькнёт и нет. Одно скажу точно: человек был ПРИШЛЫЙ, не из наших селян — одеждой и повадкой странник, такой же пришлый человек в деревне, как и ты, чадо.\n\nСам я лица его не разглядел и куда побежал — не видал, Бог миловал. Но в деревне народ разный ходит, всякий на виду: кто у колодца зорит, кто на выпас глядит во все стороны. Может, кто-то из селян и видел вора — куда он бежал да где нынче прячется. ПОРАСПРОСИ ЛЮДЕЙ, чадо: спроси каждого о воре и о том, куда он мог податься. Господь путь укажет, а люди — подскажут.':
        'Oh, woe is us, child... A great deed was done in the night: a thief crept into the temple of God and stole the wonderworking icon of the Mother of God from its very shrine! I was praying at the altar, the candles were still burning — and all I heard was the little door creak. And at dawn I looked: the shrine was empty, only the vigil lamp smoking and dust on the floor where the holy thing had stood.\n\nI caught a glimpse of a dark man in the church, but could not make him out — a flash and he was gone. One thing I say for certain: the man was a STRANGER, not one of our villagers — in dress and manner a wanderer, as much a stranger in this village as you are, child.\n\nI did not see his face and did not see where he ran — God spared me. But all sorts of people walk in the village, everyone in plain sight: some spy by the well, some gaze over the pasture. Maybe one of the villagers saw the thief — where he ran and where he hides now. QUESTION THE PEOPLE, child: ask each one about the thief and where he might have gone. The Lord will point the way, and the people will give counsel.',
    'Батюшка кладёт руку тебе на голову и шепчет молитву. Тепло разливается по плечам.\n\n✨ Благословение: СЛЕДУЮЩАЯ проверка навыка (следы, расспрос, убеждение, оглушение или удар) пройдёт с +10 к шансу — но только одна!':
        'The priest lays his hand on your head and whispers a prayer. Warmth spreads over your shoulders.\n\n✨ Blessing: your NEXT skill check (traces, questioning, persuasion, knock-out or strike) gets +10 to the chance — but only one!',
    'Поговорил с батюшкой о краже иконы.': 'Talked to the priest about the icon theft.',
    'Помолился в церкви (+2 MP).': 'Prayed in the church (+2 MP).',
    'девочка': 'little girl',
    'Игнат щурится: «Сначала — хлеб да отдых. Обессиленного работником не нанимают». (Нужно больше здоровья)':
        'Ignat squints: "First — bread and rest. No one hires an exhausted man as a worker." (Need more Health)',
    '🐟 Купить копчёную рыбу (2 д.)': '🐟 Buy smoked fish (2 d.)',
    'Ерёма разводит руками: «Без двух монет и хвост не отдаю. Рыба — она не трава, сам лови».': 'Yeryoma spreads his hands: "No two coins — no fish. Fish is no grass; catch it yourself."',
    '🌿 Полечить раны (3 д.)': '🌿 Heal wounds (3 d.)',
    'Февронья качает головой: «Три деньги — не жадность, а плата за коренья: я их сама ищу, на росе, до петухов. Нет трёх — терпи».':
        'Fevronia shakes her head: "Three dengas is no greed, but payment for the roots: I seek them myself, in the dew, before cock-crow. Without three — endure."',
    'Что нынче свежее?': 'What is fresh today?',
    'Откуда товар?': 'Where does your goods come from?',
    'До свидания.': 'Farewell.',
    'Откуда скот?': 'Where does the livestock come from?',
    'Что в народе слыхал?': 'What do the people say?',
    'Спасибо, торгарь.': 'Thank you, peddler.',
    'Про ремесло расскажи.': 'Tell me of your craft.',
    'Кто заказывает?': 'Who is commissioning?',
    'Спасибо, мастер.': 'Thank you, master.',
    'Как живётся в слободе?': 'How do you live in the sloboda?',
    'Про соседей расскажи.': 'Tell me of the neighbours.',
    'Спасибо, Агафьюшка.': 'Thank you, Agafyushka.',
    'Про метки на брёвнах.': 'Tell me of the marks on the logs.',
    'Спасибо, Горазд.': 'Thank you, Gorazd.',
    'Дом Прасковьи': 'Praskovya\'s House',
    'Прасковья, снедница': 'Praskovya the victualler',
    'Тёплая горница с хлебной печью. На полках — караваи, головы сыра и связки сушёных грибов, на столе остывают пироги с репой. Хозяйка присыпает мукой столешницу, не глядя.':
        'A warm chamber with a bread oven. On the shelves — loaves, heads of cheese and strings of dried mushrooms; on the table turnip pies are cooling. The mistress dusts flour off her hands.',
    'Дом Потапа': 'Potap\'s House',
    'Потап, мясник': 'Potap the butcher',
    'Пахнет дымом и свежим мясом: при доме у Потапа своя столешня. Колбасы и окорока подвешены под потолком, на разделочном столе — ряды нарезки, у печи сушится медвежья шкура.':
        'It smells of smoke and fresh meat: Potap keeps his own slaughtering shed by the house. Sausages and hams hang from the ceiling; rows of cuts lie on the block, and hides dry by the stove.',
    'Лавка ремесленника': 'Artisan\'s Shop',
    'Торгарь Аверьян': 'Averyan the peddler',
    'Тесная лавка, полная всякого добра: витрины с ожерельями, связки ножей, верёвки, кремни, свечи восковые да обереги от сглазу. Хозяин знал бы толк каждой вещице.':
        'A cramped shop full of all manner of goods: showcases with necklaces, bundles of knives, ropes, flints, wax candles and charms against the evil eye. The master would know the worth of every thing.',
    'Лавка ремесленника — товар': 'Artisan\'s Shop — goods',
    'Дом сапожника': 'Shoemaker\'s House',
    'Сапожник Нефёд': 'Nefyod the shoemaker',
    'В горнице пахнет кожей и дёгтем: на лавке — сапоги всех размеров, колодки, шило и суровые нитки. Хозяин сшивает голенище, не отрываясь от дела.':
        'The chamber smells of leather and tar: on the bench boots of every size, lasts, an awl and coarse thread. The master stitches a bootleg without looking up from his work.',
    'Агафья, жена сапожника': 'Agafya, the shoemaker\'s wife',
    'Изба дровосека': 'Woodcutter\'s Hut',
    'Дровосек Горазд': 'Gorazd the woodcutter',
    'Изба простая и ладная: в углу — поленница до потолка, у двери — топоры и пилы. На бревне у печи вырезаны метки — счёт срубленным деревьям.':
        'A plain and tidy hut: a woodpile to the ceiling in the corner, axes and saws by the door. Marks are cut into the log by the stove — a count of the trees felled.',
    'Репутация у {0} упала на {1} за просроченное поручение.': 'Reputation of {0} fell by {1} for an overdue task.',
    'Хлеб': 'Bread',
    'Медовуха': 'Mead',
    'Целебная трава': 'Healing herb',
    'Благословение батюшки (полное восстановление)': 'The priest\'s blessing (full restoration)',
    'Благословение (полное восстановление)': 'Blessing (full restoration)',
    'Награда за «{0}»: {1}.': 'Reward for "{0}": {1}.',
    'Репутация в деревне {0} ({1}). Итого: {2}.': 'Village reputation {0} ({1}). Total: {2}.',
    '«Уходи! Я тебя ненавижу... но староста велел крови сегодня не проливать.»': '"Begone! I hate you... but the elder forbade the shedding of blood today."',
    'NPC в ярости и бросается на тебя!': 'The NPC is furious and throws itself at you!',
    '«Не смей ко мне подходить! Уходи, пока цел!»': '"Do not dare come near me! Leave while you are whole!"',
    '«Не желаю с тобой говорить! Уходи!»': '"I will not speak with you! Begone!"',
    '«Какого ляда ты меня будишь среди ночи?! Спать мешаешь! Уходи, завтра поговорим!»':
        '"Why in the world are you waking me in the middle of the night?! You keep me from sleep! Leave; we will talk tomorrow!"',
    '«Не видишь — я занят! Потом приходи.»': '"Can you not see — I am busy! Come later."',
    '«Ох, спасибо на добром слове!»': '"Oh, thank you for the kind word!"',
    '«Благодарю за доброе слово.»': '"I thank you for the kind word."',
    '«Не льсти мне, не люблю я это!»': '"Do not flatter me — I do not like it!"',
    '«Хватит пустые слова говорить.»': '"Enough of your empty words."',
    'NPC не найден.': 'NPC not found.',
    '{0}: «Ладно, ладно! Не надо злиться! Вот, возьми.»': '{0}: "All right, all right! Do not be angry! Here, take it."',
    '{0}: «Ну... ладно. Только не злись. Возьми и уходи.»': '{0}: "Well... fine. Only do not be angry. Take it and go."',
    '{0}: «Ты мне угрожаешь?! Да я тебя на куски порву!»': '{0}: "You threaten me?! I will tear you to pieces!"',
    '{0}: «Пошёл прочь со своими угрозами! Ничего не получишь!»': '{0}: "Away with your threats! You will get nothing!"',
    '{0} хватает оружие!': '{0} grabs a weapon!',
    'Староста собрал сходку: «Ты позоришь нашу деревню! Уходи и не возвращайся!» Игрок изгнан из деревни с репутацией {0}.':
        'The elder called the assembly: "You shame our village! Leave and do not return!" The player is expelled from the village with a reputation of {0}.',
    '☠ Кровная вина: герой убил {0}. Деревня и все жители −{1} репутации.': '☠ Blood guilt: the hero killed {0}. The village and all its people −{1} reputation.',
    'Родня убитого ({0}) проклинает героя: их репутация до −100.': 'The kin of the slain ({0}) curse the hero: their reputation down to −100.',
    '{0} оплакивает {1}: теперь он(а) {2}.': '{0} mourns {1}: he(she) is now a {2}.',
    'вдовец': 'widower',
    'вдова': 'widow',
    'Ты овдовел(а): твой(я) супруг(а) {0} мёртв(а).': 'You are widowed: your spouse {0} is dead.',
    'К горну встал {0}, ученик кузнеца: моложе мастера, но работа кузницы не встанет.':
        '{0} has stepped to the forge as apprentice blacksmith: younger than the master, but the forge will not stand idle.',
    'ПОРАЖЕНИЕ: староста мёртв от твоей руки. Деревня проклинает убийцу — репутация до −100. Проигрыш.':
        'DEFEAT: the elder is dead at your hand. The village curses the murderer — reputation down to −100. Game over.',
    'сам староста': 'the elder himself',
    'вира {0} д. + продажа {1} д., за разбой без свады — вдвое': 'wergild {0} d. + court sale {1} d.; for robbery without connivance — double',
    'вира {0} д. + продажа {1} д.': 'wergild {0} d. + court sale {1} d.',
    'Староста крестится: «{0} — мёртв(а). Судебник мёртвых не судит. Кровная вина на тебе до конца дней.»':
        'The elder crosses himself: "{0} is dead. The Law judges not the dead. Blood guilt is upon you to the end of your days."',
    'Ошибка: игрок не найден.': 'Error: player not found.',
    'Староста листает Судебник: «Вира за твою обиду — {0} д. ({1}). А в мошне у тебя лишь {2} д. Не будет мира — будет суд.»':
        'The elder leafs through the Law: "The wergild for your offence is {0} d. ({1}). And in your purse there is only {2} d. No peace — then judgement."',
    '🤝 Примирение у старосты: выплачена вира {0} д. за {1} ({2}). Репутация {3} теперь +30.':
        '🤝 Peace made before the elder: wergild of {0} d. paid for {1} ({2}). Reputation of {3} is now +30.',
    'Староста принимает виру — {0} д. ({1}) — и жмёт руку {2}: «Обида смыта серебром, по Судебнику быть миру!»\n\nРепутация {3} к тебе теперь +30.':
        'The elder accepts the wergild — {0} d. ({1}) — and clasps {2}\'s hand: "The offence is washed away with silver; by the Law there shall be peace!"\n\nReputation of {3} with you is now +30.',
    'СВАДЬБА: {0} {1} {2} ({3}). Свадебное торжество обошлось в {4} д. Деревенская репутация выросла.': 'WEDDING: {0} {1} {2} ({3}). The wedding feast cost {4} d. Village reputation has grown.',
    'Обследовал след в «{0}» — след прочитан (бросок {1}, успех{2}): вор у «{3}».':
        'Examined a footprint in "{0}" — trail read (roll {1}, success{2}): the thief is near "{3}".',
    ', ночь': ', night',
    'Обследовал след в «{0}» — провал (бросок {1}{2}), след затёрт.': 'Examined a footprint in "{0}" — failure (roll {1}{2}), the trail is trampled.',
    'Поиск следов в «{0}» — вор рядом!': 'Searching for traces in "{0}" — the thief is near!',
    'Поиск следов в «{0}» — следы прочитаны (бросок {1}, успех{2}).': 'Searching for traces in "{0}" — trails read (roll {1}, success{2}).',
    'Поиск следов в «{0}» — провал (бросок {1}, следы были, но не разобраны).':
        'Searching for traces in "{0}" — failure (roll {1}, trails were there but could not be made out).',
    'Поиск следов в «{0}» — следов нет.': 'Searching for traces in "{0}" — no trails.',
    'Знание кузнеца не пропало с ним: его ученик видел то же, что и мастер.':
        'The blacksmith\'s knowledge did not die with him: his apprentice saw the same as the master.',
    'Расспрос {0} о воре — СВИДЕТЕЛЬ: {1}.': 'Questioned {0} about the thief — WITNESS: {1}.',
    'Расспрос {0} о воре — не свидетель, ничего не знает.': 'Questioned {0} about the thief — no witness, knows nothing.',
    'Просил денег у {0} — КРИТИЧЕСКИЙ успех, получено {1} д. ({2}).': 'Begged money from {0} — CRITICAL success, got {1} d. ({2}).',
    'Просил денег у {0} — успех, получено {1} д. ({2}).': 'Begged money from {0} — success, got {1} d. ({2}).',
    'Просил денег у {0} — FUMBLE, ничего не получено ({1}).': 'Begged money from {0} — FUMBLE, got nothing ({1}).',
    'Просил денег у {0} — провал, ничего не получено ({1}).': 'Begged money from {0} — failure, got nothing ({1}).',
    ' Можно напасть, убедить отдать краденое (проверка Убеждения) или подкрасться и оглушить (проверка Драки).':
        ' You may attack, persuade the thief to give up the loot (Persuasion check) or sneak up and knock him out (Brawling check).',
    'Убеждение не подействовало ({0}){1}': 'The persuasion did not work ({0}){1}',
    ' — вор скрылся!': ' — the thief escaped!',
    ' — вор пустился наутёк!': ' — the thief fled into the night!',
    'Оглушить вора не вышло ({0}){1}': 'The knock-out failed ({0}){1}',
    'Ты уже прочитал следы в этой местности.\nНовых здесь не найти.':
        'You have already read the trails in this area.\nNo new ones to find here.',
    'Пасека: наблюдал за пчёлами у колодного улья.': 'Apiary: watched the bees at the log hive.',
    'Вернулся с пасеки к околице.': 'Returned from the apiary to the outskirts.',
    '🧝 Облик героя': '🧝 Hero\'s Look',
    'Готовые фигурки Medieval-Heroes: тонкая настройка слоёв недоступна (раунд 50).\nВыбери, кем ты войдёшь в летопись.':
        'Ready-made Medieval-Heroes figures: fine layer tuning is unavailable (round 50).\nChoose who will enter the chronicle.',
    '🎨 Создание персонажа': '🎨 Character Creation',
    'Имя, класс, возраст — и облик из готовых героев. Кастомизация слоёв отключена (раунд 50).':
        'Name, class, age — and a look from the ready-made heroes. Layer customisation is disabled (round 50).',
    'Имя:': 'Name:',
    'Класс:': 'Class:',
    'Облик героя:': 'Hero\'s look:',
    'В руках': 'In hands',
    'Надето': 'Worn',
    'НАДЕТО': 'WORN',
    'Навыки героя — в свитке «Персонаж» (по ходу игры).': 'The hero\'s skills — in the "Character" scroll (as the game goes).',
    'Воровка-иконокрадка': 'Thief-Woman',
    '⚔ Бой пошаговый (BRP d100): атака, уклон, трава, побег.\nПроверки навыков бросают d100: успех — в пределах навыка,\nкрит — 1/20 навыка (урон ×1.5), особый успех — 1/5 (урон ×2).\n🛡 Доспех поглощает урон каждого попадания.\n👁 Исследование: удачная проверка открывает параметры противника;\nпосле первого его удара видно мастерство применённого оружия.':
        '⚔ Turn-based combat (BRP d100): attack, dodge, herbs, escape.\nSkill checks roll d100: success — within the skill,\ncritical — 1/20 of the skill (damage ×1.5), special success — 1/5 (damage ×2).\n🛡 Armour absorbs the damage of each hit.\n👁 Study: a successful check reveals the enemy\'s stats;\nafter his first blow the mastery of the weapon he used is shown.',
    '👁 Исследование': '👁 Study',
    'Побег из боя. Потеряно 2 действия (бросок {0}, успех).': 'Escaped the fight. 2 actions lost (roll {0}, success).',
    'Неудачный побег из боя. Потеряно 1 действие (бросок {0}, провал).': 'Failed escape from the fight. 1 action lost (roll {0}, failure).',
    'Ты уже изучил этого противника.': 'You have already studied this opponent.',
    '👁 Ты изучил противника: {0}': '👁 You studied the opponent: {0}',
    'Изучил противника в бою ({0}). {1}.': 'Studied the opponent in combat ({0}). {1}.',
    '👁 Ты всматривался в противника, но ничего не понял ({0}).': '👁 You peered at the opponent but understood nothing ({0}).',
    'Не сумел изучить противника в бою ({0}).': 'Failed to study the opponent in combat ({0}).',
    'СИЛ': 'STR',
    'ТЕЛ': 'CON',
    'РАЗ': 'SIZ',
    'ЛОВ': 'DEX',
    '⚔ Первый удар открыл мастерство противника: {0} — {1}.': '⚔ The first blow revealed the opponent\'s mastery: {0} — {1}.',
    'Бой с вором выигран. Вор повержен!': 'The fight with the thief is won. The thief is defeated!',
    'Кровная вина на тебе. Староста может помирить за виру.': 'Blood guilt is on you. The elder may make peace for a wergild.',
    'Враг повержен': 'The enemy is defeated',
    'Икона у тебя! Верни её старосте или священнику.': 'The icon is with you! Return it to the elder or the priest.',
    '☠ Кровь старосты!': '☠ The Elder\'s Blood!',
    'Ты убил {0} — старосту деревни! Старшина сходки указывает на тебя пальцем: «Убийца судьи — вне закона!» Деревня проклинает тебя: репутация упала до −100.\n\nЛетопись твоего похода окончена — ПРОИГРЫШ.':
        'You killed {0} — the village elder! The assembly\'s headman points a finger at you: "The murderer of a judge is outlaw!" The village curses you: reputation fell to −100.\n\nThe chronicle of your quest is over — DEFEAT.',
    'Смириться с судьбой': 'Accept one\'s fate',
    'Ты убил {0}. Вся деревня в ужасе: репутация в деревне и у всех жителей упала на 50!\n{1}\nТакие грехи смываются только вирой у старосты — если он согласится мирить.':
        'You killed {0}. The whole village is horrified: reputation in the village and with every villager fell by 50!\n{1}\nSuch sins are washed away only by wergild before the elder — if he consents to make peace.',
    'Бой проигран. Герой пал — поход окончен.': 'The fight is lost. The hero has fallen — the quest is over.',
    '⚖ УБИЙСТВО СТАРОСТЫ': '⚖ MURDER OF THE ELDER',
    '🏆 ПОБЕДА! ИКОНА ВОЗВРАЩЕНА': '🏆 VICTORY! THE ICON IS RETURNED',
    '⚖ ВОР ПОВЕРЖЕН': '⚖ THE THIEF IS DEFEATED',
    '🏃 ВОР СБЕЖАЛ': '🏃 THE THIEF ESCAPED',
    '☠ ГЕРОЙ ПАЛ': '☠ THE HERO HAS FALLEN',
    'Путница': 'Wanderess',
    'неизвестно': 'unknown',
    'Всего действий: {0}': 'Total actions: {0}',
    'Поисков следов: {0}': 'Trace searches: {0}',
    'Бесед с жителями: {0}': 'Talks with villagers: {0}',
    'Провалов проверок: {0}': 'Failed checks: {0}',
    'Финальная дата: {0}': 'Final date: {0}',
    '📜 Хроника действий:': '📜 Chronicle of deeds:',
    'Лог пуст': 'The log is empty',
    'В меню': 'To menu',
    'Тёмный лес: взаимодействие — {0}.': 'Dark Forest: interaction — {0}.',
    'Обыскал разбойничий тайник в лесу: +{0} денег.': 'Searched the robbers\' stash in the forest: +{0} dengas.',
    'Засада у тайника: бой с разбойником.': 'Ambush at the stash: fight with a robber.',
    'Волк напал в Тёмном лесу!': 'A wolf attacked in the Dark Forest!',
    'Вернулся из Тёмного леса к околице.': 'Returned from the Dark Forest to the outskirts.',
    '🗺 Околица — карта местности: выбирай локацию и в путь.\nКаждый переход по карте занимает ровно 1 игровой час.\nСледы вора живут от 12 до 24 часов — а дождь и снег смывают их и раньше.':
        '🗺 The outskirts — a map of the land: choose a location and set out.\nEach crossing on the map takes exactly 1 game hour.\nThe thief\'s trails live from 12 to 24 hours — and rain and snow wash them away sooner.',
    'Игрок отправился в локацию «{0}».': 'The player set out for the location "{0}".',
    'Игрок отправился гулять в Тёмный лес.': 'The player set out to stroll in the Dark Forest.',
    '🏠 Разговор с хозяином дома занимает 1 игровой час —\nвыбирай, с кем и о чём говорить.\n📦 Сундуки и тайники открываются раз в игровой день.\n◀ Выход — кнопка внизу.':
        '🏠 Talking to the master of a house takes 1 game hour —\nchoose with whom and about what to speak.\n📦 Chests and stashes open once per game day.\n◀ The exit is the button below.',
    'Ученик кузнеца': 'Blacksmith\'s Apprentice',
    '{0} погиб(ла) от твоей руки.\nДом опустел, вещи прикрыты холстиной.\nДеревня шепчется о кровной вине.':
        '{0} perished at your hand.\nThe house stands empty, the things covered with canvas.\nThe village whispers of blood guilt.',
    '🛒 Торговать': '🛒 Trade',
    '🪵 Помочь в мастерской (1 час)': '🪵 Help in the workshop (1 hour)',
    '{0} бросается на тебя с кулаками!': '{0} throws itself at you with fists!',
    'Отказ': 'Refusal',
    'Поговорил с {0} в «{1}».': 'Talked with {0} in "{1}".',
    'Познакомился с {0}.': 'Made the acquaintance of {0}.',
    'Просьба о деньгах': 'A request for money',
    'Задание': 'Task',
    '{0}: «Ты ещё не выполнил моё прошлое поручение. Сперва закончи его!»': '{0}: "You have not yet finished my last errand. Finish it first!"',
    '{0}: «Нет у меня сейчас для тебя дел. Зайди попозже.»': '{0}: "I have no business for you right now. Come back later."',
    'что-то': 'something',
    'Цель:': 'Goal:',
    'Время на выполнение:': 'Time to complete:',
    'Сложность:': 'Difficulty:',
    'тяжёлая': 'hard',
    'средняя': 'medium',
    'лёгкая': 'easy',
    'Награда:': 'Reward:',
    '✓ Принять': '✓ Accept',
    'Задание принято': 'Task accepted',
    '{0}: «Благодарю! Не подведи. Возвращайся, как выполнишь.»': '{0}: "I thank you! Do not fail me. Return when it is done."',
    '✗ Отказаться': '✗ Refuse',
    'Отказался от задания: {0}.': 'Refused the task: {0}.',
    'Подарить {0}': 'Gift to {0}',
    '{0}: «Спасибо тебе! Доброе дело сделал.» (+{1} реп.)': '{0}: "Thank you! You have done a good deed." (+{1} rep.)',
    '{0}: «Не нужно мне твоих подачек!» ({1} реп.)': '{0}: "I need not your handouts!" ({1} rep.)',
    '{0}: «Ох, какая щедрость! Благодарю от сердца!» (+{1} реп.)': '{0}: "Oh, what generosity! I thank you from the heart!" (+{1} rep.)',
    '{0}: «Что-то ты уж слишком щедр... Чего хочешь?» ({1} реп.)': '{0}: "You are over-generous somehow... What do you want?" ({1} rep.)',
    'Предметы из инвентаря:': 'Items from the inventory:',
    'ценность': 'worth',
    '{0}: «Ох, вещь добрая! Спасибо, пригодится.» (+{1} реп.)': '{0}: "Oh, a fine thing! Thank you — it will serve." (+{1} rep.)',
    '{0}: «Не нужна мне такая вещь.» ({1} реп.)': '{0}: "I have no need of such a thing." ({1} rep.)',
    'Похвала': 'Praise',
    '{0}: {1}{2}\n{3} репутации':
        '{0}: {1}{2}\n{3} reputation',
    'Угрозой вымогал {0} д. у {1} (бросок {2}).': 'Extorted {0} d. from {1} by threats (roll {2}).',
    'Угроза': 'Threat',
    '{0}\n\nПолучено: {1} д.\n(Репутация {2}){3}':
        '{0}\n\nReceived: {1} d.\n(Reputation {2}){3}',
    'Угроза — нападение!': 'Threat — attack!',
    '{0}\n(Репутация {1}){2}':
        '{0}\n(Reputation {1}){2}',
    '{0}: «Ты мне хоть и {1}, но я тебя ещё не так хорошо знаю, чтобы семью создавать. Подожди ещё, наберись опыта в деревне.» (Нужно личная репутация +{2}, у вас {3})':
        '{0}: "Though I find you {1}, I do not know you well enough yet to start a family. Wait a while; gain standing in the village." (Need personal reputation +{2}, you have {3})',
    'люба': 'dear (f.)',
    'люб': 'dear (m.)',
    '{0}: «Я бы {1}, да староста не благословит. Ты ещё не {2} уважение всей деревни.» (Нужно деревенская репутация +{3}, у вас {4})':
        '{0}: "I would be {1}, but the elder will not bless it. You have not yet {2} the respect of the whole village." (Need village reputation +{3}, you have {4})',
    'рада': 'glad (f.)',
    'рад': 'glad (m.)',
    'заслужила': 'earned (f.)',
    'заслужил': 'earned (m.)',
    '{0}: «Свадьба — дело не дешёвое! Нужно {1} д. на свадебное торжество и подарки. А у тебя всего {2} д.»':
        '{0}: "A wedding is no cheap matter! {1} d. are needed for the wedding feast and gifts. And you have only {2} d."',
    '{0}: «Я {1} — венчан(а) с другим человеком. Ищи себе пару среди свободных сердец.»': '{0}: "I am {1} — wed to another. Seek yourself a match among free hearts."',
    'замужем': 'a wife',
    'женат': 'a husband',
    '{0}: «Не могу я {1}. {2}.»': '{0}: "I cannot {1}. {2}."',
    'выйти за тебя': 'marry you (of a woman)',
    'жениться на тебе': 'marry you (of a man)',
    'Сватовство': 'Matchmaking',
    'Ты {0} свататься: {1}.\n\nУсловия для свадьбы:\n✓ Личная репутация: {2} (нужно +{3})\n✓ Деревенская репутация: {4} (нужно +{5})\n✓ Свадебное торжество: {6} д. (у вас {7} д.)\n\n{8} {9} принять твоё предложение! Свадьба состоится по обычаям Руси!':
        'You {0} to court: {1}.\n\nConditions for the wedding:\n✓ Personal reputation: {2} (need +{3})\n✓ Village reputation: {4} (need +{5})\n✓ Wedding feast: {6} d. (you have {7} d.)\n\n{8} {9} to accept your offer! The wedding shall be held by the customs of Rus!',
    'решила': 'resolved (f.)',
    'решил': 'resolved (m.)',
    'согласна': 'ready (f.)',
    'согласен': 'ready (m.)',
    '💍 Сватовство': '💍 Matchmaking',
    '💍 Сыграем свадьбу!': '💍 We shall hold the wedding!',
    '🎉 СВАДЬБА! 🎉\n\nПо обычаям Руси, отец Савватий обвенчал вас в церкви. Вся деревня гуляла три дня на свадебном пиру!\n\n':
        '🎉 WEDDING! 🎉\n\nBy the customs of Rus, Father Savvaty wed you in the church. The whole village feasted three days at the wedding! ',
    '{0} и {1} теперь — муж и жена.\n':
        '{0} and {1} are now husband and wife.\n',
    'Ты принята в деревню как своя!': 'You have been accepted into the village as one of its own (f.)!',
    'Ты принят в деревню как свой!': 'You have been accepted into the village as one of its own (m.)!',
    'Жизнь в деревне продолжается!': 'Life in the village goes on!',
    '🎉 СВАДЬБА': '🎉 WEDDING',
    '🎉 Продолжить игру': '🎉 Continue the game',
    'Ты замужем за {0}. Живи и обустраивай жизнь в деревне!': 'You are married to {0}. Live and build your life in the village!',
    'Ты женат на {0}. Живи и обустраивай жизнь в деревне!': 'You are married to {0}. Live and build your life in the village!',
    'Подумать ещё': 'Let me think further',
    'Решила пока не выходить замуж за {0}.': 'Resolved for now not to marry {0}.',
    'Решил пока не жениться на {0}.': 'Resolved for now not to take {0} in marriage.',
    'Не хватает денег на выпивку для всех!': 'Not enough money for a drink for everyone!',
    'Угостил всех выпивкой в таверне за {0} д. (+{1} к репутации).': 'Treated everyone to drink at the tavern for {0} d. (+{1} to reputation).',
    '🎉 Выпивка для всех': '🎉 A drink for everyone',
    'Ты заказал бочку медовуги на всех! Гости радостно поднимают кубки. «За гостеприимного гостя!» — раздаётся по залу. (Репутация у всех NPC +3, в деревне +5)':
        'You ordered a barrel of mead for all! The guests raise their cups with joy. "To the generous guest!" rings through the hall. (Reputation of all NPCs +3, in the village +5)',
    '🎉 За нас!': '🎉 To us!',
    '{0} отказался торговаться с героем дурной славы (репутация ≤ −50).': '{0} refused to trade with a person of ill repute (reputation ≤ −50).',
    '{0} загораживает прилавок рукой:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»':
        '{0} bars the counter with a hand:\n"I will neither sell to you nor buy from you, man of ill repute. Go!"',
    'Денег:': 'Money:',
    'урон': 'damage',
    'защита': 'defence',
    'снаряжение': 'gear',
    'Купил «{0}» в «{1}» за {2} д.{3}': 'Bought "{0}" in "{1}" for {2} d.{3}',
    'Таверна «У дороги» — меню': 'Tavern "By the Road" — menu',
    'Купил «{0}» в таверне за {1} д. ({2}).': 'Bought "{0}" at the tavern for {1} d. ({2}).',
    'Ты посидел за столом у Фёдора... но пока время шло, вор успел скрыться из вида!':
        'You sat a while at Fyodor\'s table... but while the time passed, the thief slipped out of sight!',
    '{0} откладывает молот и крестит руки на груди:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»':
        '{0} lays down the hammer and crosses his arms on his chest:\n"I will neither sell to you nor buy from you, man of ill repute. Go!"',
    'Кузница Данилы': 'Danila\'s Forge',
    'Кузница — {0}': 'Forge — {0}',
    'полцены': 'half price',
    'Продал «{0}» кузнецу за {1} д. (полцены, урок Судебника о честной торговле).': 'Sold "{0}" to the smith for {1} d. (half price, the Law\'s lesson of honest trade).',
    '{0} качает головой: «{1}.»': '{0} shakes his head: "{1}."',
    'Купил «{0}» у кузнеца за {1} д.{2}': 'Bought "{0}" from the smith for {1} d.{2}',
    'Осмотрел себя у кузнеца (свиток персонажа).': 'Examined yourself at the smith\'s (character scroll).',
    'Помолился в церкви (уже молился сегодня).': 'Prayed in the church (already prayed today).',
    'Молитва': 'Prayer',
    'Ты снова стоишь перед киотом. Сердце уже нашло покой сегодня — больше не нужно.':
        'You stand again before the icon shrine. Your heart has already found peace today — there is no more need.',
    'Помолился в церкви — Воля +{0}.': 'Prayed in the church — Will +{0}.',
    'Ты опускаешься на колени перед киотом. В полумраке церкви, под мерцание лампад, приходит покой.\n\nВоля восстановлена: +{0}.':
        'You kneel before the icon shrine. In the half-dark of the church, under the flickering of vigil lamps, peace comes.\n\nWill restored: +{0}.',
    'Встать с колен.': 'Rise from your knees.',
    'Пожертвование': 'Donation',
    'Ты уже жертвовал сегодня. Свечей куплено на всю неделю вперёд.': 'You have already given today. Candles are bought for a week ahead.',
    'Ну ладно.': 'Well, all right.',
    'В мошне пусто — не до пожертвований. Заработай в амбаре или помоги деревне.': 'The purse is empty — no time for donations. Earn in the workshop or help the village.',
    'Приду позже.': 'I shall come later.',
    'Пожертвование в церкви': 'Donation in the church',
    'Пожертвовал 5 д. в церкви — деревня это помнит (+1 репутация).': 'Donated 5 d. in the church — the village remembers (+1 reputation).',
    'Ты кладёшь пять денег на блюдо у входа. «На свечи и ладан», — говоришь тихо. Казначей церкви будет рад.\n\n':
        'You lay five dengas on the dish by the entrance. "For candles and incense," you say quietly. The church treasurer will be glad.\n\n',
    'Репутация в деревне +1.': 'Village reputation +1.',
    'Низко поклониться иконам.': 'Bow low before the icons.',
    'Пустой киот': 'The Empty Shrine',
    'Больше тут ничего не изменилось: ниша без иконы, воск на полу, верёвка.': 'Nothing has changed here: a niche without an icon, wax on the floor, a rope.',
    'Уйти от киота.': 'Step away from the shrine.',
    'На полу церкви — капли стеарина и обрывок пеньковой верёвки с двумя узлами. Икону несли бережно, вдвоём, и накануне в церкви горела свеча.':
        'On the church floor — drops of stearin and a piece of hemp rope with two knots. The icon was carried carefully, by two, and the day before a candle had burned in the church.',
    'Осмотрел киот в церкви — нашёл улику (воск, верёвка с узлами).': 'Examined the shrine in the church — found a clue (wax, knotted rope).',
    'Осмотр киота': 'Examining the shrine',
    'Ниша, где стояла чудотворная икона, пуста. Ты присматриваешься: на полу — капли стеарина, ещё тёплые. У подножия — обрывок пеньковой верёвки с двумя узлами.\n\nВор был не один — и нёс святыню бережно. Это стоит рассказать старосте.\n\nУлика добавлена к делу.':
        'The niche where the wonderworking icon stood is empty. You look closely: on the floor — drops of stearin, still warm. At the foot — a piece of hemp rope with two knots.\n\nThe thief was not alone — and he carried the holy thing with care. This is worth telling the elder.\n\nThe clue is added to the case.',
    'Запомнить.': 'Remember.',
    'Силы кончились': 'Strength spent',
    'Руки не поднимаются таскать дрова и мять глину. Нужно поесть и отдохнуть, прежде чем браться за работу.':
        'Your arms will not lift to haul firewood and knead clay. Eat and rest before taking up the work.',
    'Справедливо...': 'Fair enough...',
    'В углу мастерской блеснула чужая монетка — видать, обронил кто-то из заказчиков. Она твоя: +{0} д.':
        'In the corner of the workshop a stranger\'s coin gleamed — dropped, it seems, by one of the customers. It is yours: +{0} d.',
    'Отработал час в гончарной мастерской: +{0} д., усталость −3 HP.': 'Worked an hour in the potter\'s workshop: +{0} d., weariness −3 HP.',
    'Помощь в мастерской': 'Help in the workshop',
    'Час у круга и печи: носил дрова, мешал глину, ставил горшки на обжиг. Игнат доволен: «Работник, что надо!»\n\n':
        'An hour at the wheel and the kiln: carried firewood, mixed clay, set pots for firing. Ignat is pleased: "A worker worth his salt!"\n\n',
    'Заработано: +{0} д. Усталость: −3 здоровья.': 'Earned: +{0} d. Weariness: −3 health.',
    'Спасибо': 'Thanks',
    'Мастерская': 'Workshop',
    'Гончарного зерна тут нет — только глина, дрова и ряды горшков на просушке.': 'There is no potter\'s grain here — only clay, firewood and rows of pots drying.',
    'В углу мастерской нашлась горсть сушёных яблок — Игнат не обидится. +2 здоровья.':
        'In the corner of the workshop a handful of dried apples was found — Ignat will not take offence. +2 health.',
    'Подкрепился сушёными яблоками в мастерской: +2 HP.': 'Refreshed with dried apples in the workshop: +2 HP.',
    'мышь-хвостунья черкнула за мешками глины': 'a long-tailed mouse darted behind the sacks of clay',
    'воробей вылетел в слуховое окно': 'a sparrow flew out of the small window',
    'кот-невидимка оставил следы на просушке': 'an invisible cat left tracks on the drying pots',
    'Осмотр мастерской': 'Examining the workshop',
    'Всё при деле: глина вымешена, горшки на просушке, дрова в поленнице. Пахнет печным жаром.\n\n':
        'All is at its business: clay kneaded, pots drying, firewood in the woodpile. It smells of kiln heat.\n\n',
    'Мимо ': 'Past ',
    'Довольно.': 'Enough.',
    'слово Божие — в сердцах': 'the word of God — in hearts',
    'По уложению Судебника воинское снаряжение не продаётся несовершеннолетним (с {0} лет)': 'By the Law\'s ordinance, military gear is not sold to minors (from {0} years of age)',
    'По уложению Судебника воинское снаряжение не продаётся людям дурной славы (репутация деревни ниже 0)': 'By the Law\'s ordinance, military gear is not sold to persons of ill repute (village reputation below 0)',
    'NPC не найден': 'NPC not found',
    'Традиции не позволяют брак с человеком того же пола': 'Traditions do not allow marriage with a person of the same sex',
    '{0} ещё несовершеннолетний(няя) — венчают только с {1} лет': '{0} is still under age — weddings are performed only from {1} years',
    'Ты ещё несовершеннолетний(яя) — венчают только с {0} лет': 'You are still under age — weddings are performed only from {0} years',
    'Ты уже венчан(а) с {0} — Церковь второго брака не благословит': 'You are already wed to {0} — the Church does not bless a second marriage',
    'Недостаточно личной репутации (нужно +{0}, у вас {1})': 'Not enough personal reputation (need +{0}, you have {1})',
    'Недостаточно деревенской репутации (нужно +{0}, у вас {1})': 'Not enough village reputation (need +{0}, you have {1})',
    'Недостаточно денег на свадебное торжество (нужно {0} д., у вас {1} д.)': 'Not enough money for the wedding feast (need {0} d., you have {1} d.)',
    '{0} уже состоит в браке': '{0} is already married',
    '{0} покинул(а) мир живых — над ним(ей) уже отпели': '{0} has left the world of the living — the funeral rites have been read',
    '🍺 Угостить (20д)': '🍺 Treat everyone (20 d.)',
    ' 🔒': ' 🔒',
    '🔍 Каждый след проверяется отдельно и только один раз;\nнеудача затирает след. Ночью следы читаются хуже.\n🕐 Обследование следа занимает ровно 1 игровой час.\n◀ Назад к развилке — тоже час дороги.':
        '🔍 Each footprint is examined separately and only once;\nfailure tramples the trail. At night trails are harder to read.\n🕐 Examining a footprint takes exactly 1 game hour.\n◀ Back to the outskirts — an hour\'s road as well.',
    'Игрок углубился в лес: «{0}».': 'The player went deeper into the forest: "{0}".',
    'Игрок вышел из леса на «{0}».': 'The player came out of the forest to "{0}".',
    'Игрок покинул локацию «{0}».': 'The player left the location "{0}".',
    'Порыбачил через лунку — налим к ужину (+{0} ❤).': 'Fished through the ice-hole — a burbot for supper (+{0} ❤).',
    'Дождь — рыба идёт на крючок смело. Отличный улов (+{0} ❤).': 'Rain — the fish bite boldly. An excellent catch (+{0} ❤).',
    'Наловил рыбы на реке к обеду (+{0} ❤).': 'Caught fish in the river for dinner (+{0} ❤).',
    'Наводка на «{0}» устарела (п.10).': 'The lead on "{0}" has gone stale (p.10).',
    'Наводка привела на «{0}» (п.10, осталось ~{1} ч.).': 'The lead brought you to "{0}" (p.10, ~{1} h. left).',
    'Герой': 'The Hero',
    'Спи спокойно, добрая душа.': 'Sleep in peace, kind soul.',
    'житель сам напал на героя — пал(а) в честной схватке': 'the villager attacked the hero first — fell in a fair fight',
    'Посетил могилу {0} на погосте.': 'Visited {0}\'s grave at the churchyard.',
    '⚰ Могила': '⚰ Grave',
    'Здесь покоится {0}{1}.\nУпокоен(а) на {2}-й день странствия.\n\nОт руки героя {3} — {4}.\n\n«{5}»':
        'Here lies {0}{1}.\nLaid to rest on the {2}-th day of the wander.\n\nBy the hero\'s hand {3} — {4}.\n\n"{5}"',
    ' (': ' (',
    ')': ')',
    'Помянуть (печально)': 'Mourn (sorrowfully)',
    '⚰ На погосте {0} свежих могил — тех, кого не досчиталась деревня. Кликни по холмику.': '⚰ At the churchyard {0} fresh graves — those the village misses. Click the mound.',
    'ВЫХОД ▶': 'EXIT ▶',
    'Обзор': 'Overview',
    '📋 Задания': '📋 Tasks',
    'Открыл меню персонажа.': 'Opened the character menu.',
    'Открыл инвентарь.': 'Opened the inventory.',
    'ПОРАЖЕНИЕ: {0}': 'DEFEAT: {0}',
    'ПОБЕДА: {0}': 'VICTORY: {0}',
    'Деревня': 'Village',
    'Игрок взаимодействует с: {0}.': 'The player interacts with: {0}.',
    'Игрок вышел за околицу.': 'The player left the village outskirts.',
    'Игрок вошёл в здание.': 'The player entered a building.',
    'занят(а) своим делом': 'busy with one\'s own affairs',
    'Дверь закрыта: {0}. Хозяин: {1} ({2})': 'The door is locked: {0}. The master: {1} ({2})',
    'Деревня уместилась на один экран — обзор не нужен.': 'The village fits one screen — no overview needed.',
    'занят': 'busy',
    '📋 Журнал заданий': '📋 Task Journal',
    'Нет активных заданий.\nПоговорите с жителями деревни.':
        'No active tasks.\nSpeak with the villagers.',
    '✅ Выполнено': '✅ Done',
    '❌ Провалено': '❌ Failed',
    '🔄 Выполняется': '🔄 In progress',
    '{0} действ. (≈{1} ч.)': '{0} actions (≈{1} h.)',
    'Штраф за провал: −15 к репутации у заказчика': 'Failure penalty: −15 to the customer\'s reputation',
    'Штраф за провал: −8 к репутации у заказчика': 'Failure penalty: −8 to the customer\'s reputation',
    'Штраф за провал: −3 к репутации у заказчика': 'Failure penalty: −3 to the customer\'s reputation',
    'благословение': 'blessing',
    'Выдал:': 'Given by:',
    'Описание:': 'Description:',
    'Срок:': 'Time limit:',
    'нет': 'none',
    'Сдавать:': 'Deliver to:',
    'тому же NPC': 'the same NPC',
    'Заглянул в «{0}» — уже обыскан сегодня.': 'Looked into "{0}" — already searched today.',
    'Обыскал «{0}»: {1}.': 'Searched "{0}": {1}.',
    'Погрелся у костра — силы и так полны.': 'Warmed by the fire — strength is already full.',
    '🔥 Костёр': '🔥 Campfire',
    'Присесть у огня': 'Sit by the fire',
    'Отдохнул у костра — час крепкого сна, силы восстановились.': 'Rested by the fire — an hour of sound sleep, strength restored.',
    'Помолился у креста (уже молился сегодня).': 'Prayed at the cross (already prayed today).',
    'молится дома': 'praying at home',
    'решает дела в горнице': 'settling affairs in the upper room',
    'обходит деревню': 'walking round the village',
    'возвращается домой': 'returning home',
    'спит': 'asleep',
    'совершает утреню': 'celebrating matins',
    'служит обедню': 'serving the mass',
    'трапезничает': 'at table',
    'совершает вечерню': 'celebrating vespers',
    'запирает церковь': 'locking up the church',
    'молится в келье': 'praying in the cell',
    'готовит еду': 'cooking food',
    'обслуживает гостей': 'waiting on guests',
    'убирает зал': 'tidying the hall',
    'готовит ужин': 'cooking supper',
    'печёт караваи': 'baking loaves',
    'торгует мелочью': 'trading in small wares',
    'пересчитывает товар': 'counting up the goods',
    'допродаёт пироги с крыльца': 'selling pies from the porch',
    'растапливает горн': 'heating the forge',
    'куёт оружие и орудия': 'forging weapons and tools',
    'подковывает лошадей': 'shoeing horses',
    'гасит горн': 'letting the forge cool',
    'чинит соху во дворе': 'mending the plough in the yard',
    'гончарит у круга': 'throwing pots at the wheel',
    'обжигает горшки': 'firing pots in the kiln',
    'мешает глину': 'mixing clay',
    'носит дрова': 'carrying firewood',
    'сушит горшки на солнце': 'drying pots in the sun',
    'принимает заказчиков': 'receiving customers',
    'красит изгородь': 'painting the fence',
    'мелет зерно': 'grinding grain',
    'проверяет жернова': 'checking the millstones',
    'принимает зерно': 'taking in grain',
    'чинишь мешки': 'mending sacks',
    'чинит мешки': 'mending sacks',
    'сшивает меши': 'sewing sacks',
    'прядет пряжу': 'spinning yarn',
    'ткёт полотно': 'weaving cloth',
    'красит пряжу': 'dyeing yarn',
    'мотает нитки': 'winding thread',
    'работает за станком': 'working at the loom',
    'шьёт сапоги': 'stitching boots',
    'кроит кожу': 'cutting leather',
    'колет тушу': 'carcass-splitting',
    'рубит тушу в столешне': 'cleaving the carcass in the shed',
    'коптит окорока': 'smoking hams',
    'делает колбасы': 'making sausages',
    'солит мясо': 'salting meat',
    'допродаёт мясо с крыльца': 'selling meat from the porch',
    'заготавливает рыбу': 'curing fish',
    'коптит рыбу': 'smoking fish',
    'чинит сети на берегу': 'mending nets on the shore',
    'проверяет сети': 'checking the nets',
    'ловит рыбу': 'fishing',
    'возвращается с уловом': 'returning with the catch',
    'работает в поле': 'working in the field',
    'пашет и боронит': 'ploughing and harrowing',
    'обедает в поле': 'dining in the field',
    'обедает у межи': 'dining at the boundary',
    'обедает у мельницы': 'dining by the mill',
    'возвращается с поля': 'returning from the field',
    'вышел с сохой на поле': 'gone out to the field with the plough',
    'выгоняет скот': 'driving out the cattle',
    'пасти скот': 'herding the cattle',
    'пасёт скот': 'herding the cattle',
    'стережёт стадо': 'watching the herd',
    'доит корову': 'milking the cow',
    'загоняет скот': 'driving in the cattle',
    'колет дрова во дворе': 'splitting firewood in the yard',
    'ходил за дровами': 'gone for firewood',
    'возвращается с дровами': 'returning with firewood',
    'рубит лес за околицей': 'felling timber beyond the outskirts',
    'возвращается с добычей': 'returning with the kill',
    'на охоте в лесу': 'hunting in the forest',
    'уходил на охоту': 'gone out hunting',
    'собирает травы на росе': 'gathering herbs in the dew',
    'сушит травы дома': 'drying herbs at home',
    'лечит больных': 'tending the sick',
    'готовит снадобья': 'brewing remedies',
    'принимает пациентов': 'receiving patients',
    'на постоялом дворе': 'at the inn',
    'на постоялом дворе, пьёт медовуху': 'at the inn, drinking mead',
    'спит на постоялом дворе': 'asleep at the inn',
    'дома, за рукоделием': 'at home, at her needlework',
    'хозяйствует по дому': 'keeping the household',
    'топит печь': 'lighting the stove',
    'готовит обед': 'cooking dinner',
    'ужинает с семьёй': 'at supper with the family',
    'ужинает дома': 'at supper at home',
    'на трапезе': 'at the meal',
    'обедает': 'at dinner',
    'на утренней молитве': 'at morning prayer',
    'на вечерней молитве': 'at evening prayer',
    'молится': 'praying',
    'в церкви на вечерне': 'at vespers in the church',
    'по детским делам': 'minding the children',
    'бегает по деревне': 'running about the village',
    'играет с другими детьми': 'playing with the other children',
    'пасёт гусей': 'herding the geese',
    'на пастбище со скотом': 'at the pasture with the cattle',
    'занят по дому': 'busy about the house',
    'встаёт на стражу': 'taking up the watch',
    'на страже у ворот': 'on watch at the gates',
    'сменяется со стражи': 'relieved from the watch',
    'патрулирует деревню': 'patrolling the village',
    'допродаёт свечи': 'selling candles',
    'выкладывает товар': 'laying out the goods',
    'запирает лавку': 'closing the shop',
    'запирает двор': 'closing the yard',
    'носит заказы по деревне': 'delivering commissions about the village',
    'торгует на площади': 'trading on the square',
    'у колодца, по хозяйству': 'at the well, about the chores',
    'ходит к колодцу': 'walking to the well',
    'на пасеке': 'at the apiary',
    'проверяет ульи': 'checking the hives',
    'ухаживает за пчёлами': 'tending the bees',
    'проснулся с петухами': 'risen with the roosters',
    'на выпасе': 'at the pasture',
    'разбужен ночью': 'woken in the night',
    'попрошайничество': 'begging',
    'выполнено задание': 'task done',
    'угостил выпивкой': 'treated to a drink',
    'угостил всех в таверне': 'bought drinks for all at the tavern',
    'подарок принят': 'gift accepted',
    'подарок отвергнут': 'gift refused',
    'удачная похвала (крит)': 'a flattering word (critical)',
    'удачная похвала': 'a flattering word',
    'неудачная лесть (fumble)': 'clumsy flattery (fumble)',
    'неудачная лесть': 'clumsy flattery',
    'угроза (успех)': 'threat (success)',
    'угроза (fumble)': 'threat (fumble)',
    'угроза (провал)': 'threat (failure)',
    'агрессивное поведение': 'aggressive behaviour',
    'свадьба с жителем деревни': 'wedding with a villager',
    'брак': 'marriage',
    'Медная иконка из ларца': 'A copper icon from the casket',
    'другим человеком': 'another person',
    'Душа деревни': 'The Soul of the Village',
    'Ни одной ошибки, и весь приход любит тебя. Редкий дар!': 'Not a single mistake, and the whole parish loves you. A rare gift!',
    'Свой человек': 'One of Our Own',
    'Тебя приняли в деревню как родного: добрые дела и честный труд дороже золота.': 'The village took you in as kin: good deeds and honest labour are worth more than gold.',
    'Долгий путь к доверию': 'A Long Road to Trust',
    'Любовь деревни снискивается годами — и ты её снискал.': 'A village\'s love is earned over years — and you have earned it.',
    'Идеальный сыщик': 'The Perfect Sleuth',
    'Молниеносное расследование без единой ошибки!': 'A lightning investigation without a single mistake!',
    'Опытный следопыт': 'The Seasoned Tracker',
    'Быстро и уверенно нашли вора. Отличная работа.': 'You found the thief quickly and surely. Excellent work.',
    'Старательный путник': 'The Diligent Wanderer',
    'Победа досталась трудом, но цель достигнута.': 'The victory came through toil, but the goal is reached.',
    'Упорный, но медленный': 'Persistent but Slow',
    'Еле успели поймать вора. В следующий раз будьте расторопнее.': 'You barely caught the thief in time. Be quicker next time.',
    'Вор ушёл': 'The Thief Got Away',
    'Вор успел скрыться. Стоило действовать быстрее и собирать улики внимательнее.':
        'The thief managed to escape. You should have acted faster and gathered clues more carefully.',
    'Убийца судьи': 'Murderer of the Judge',
    'Поднять руку на старосту — вне закона: летопись такого героя обрывается позором.': 'To raise a hand against the elder is outlawry: the chronicle of such a hero ends in shame.',
    'Изгнан': 'Expelled',
    'Староста выгнал тебя на все четыре стороны: деревня не прощает крови и бесчестия.': 'The elder drove you to all four winds: the village forgives neither blood nor dishonour.',
    'Путник пал': 'The Wanderer Fell',
    'Герой погиб в бою. Тренируйте воинское мастерство.': 'The hero died in battle. Train your martial skill.',
    'Игра прервана': 'The Game Was Interrupted',
    'Игра не была завершена.': 'The game was not finished.',
    'Беженец': 'The Refugee',
    'Ты пришёл в незнакомую деревню. Найди приют и работу.': 'You have come to an unfamiliar village. Find shelter and work.',
    'Движение': 'Movement',
    'WASD или стрелки — движение по деревне': 'WASD or the arrows — move about the village',
    'Действие': 'Action',
    'ЛКМ на здании — войти. E — взаимодействие': 'LMB on a building — enter. E — interact',
    'Цель': 'The Goal',
    'Поговори с жителями, чтобы узнать их имена': 'Speak with the villagers to learn their names',
    'Муж': 'Husband',
    'Жена': 'Wife',
    'муж': 'husband',
    'жена': 'wife',
    'вдовец (муж)': 'widower (husband)',
    'вдова (жена)': 'widow (wife)',
    'Муж (погиб)': 'Husband (slain)',
    'Жена (погибла)': 'Wife (slain)',
    'Муж (мёртв)': 'Husband (dead)',
    'Жена (мертва)': 'Wife (dead)',
    'Супруг (мёртв)': 'Spouse (dead)',
    'Супруга (мертва)': 'Spouse (dead f.)',
};

// ----- Шаблоны с семантическими ключами (большие тексты) -----
const EN_KEYS = {
    // Раунд 32 (пп.14,15): обязательная строка «Информации по игре» (F1)
    'help.timeRatio':
        '⏱ TIME: 1 minute of real time = 20 minutes of game time (1:20 ratio),\n' +
        '  a full game day passes in 72 real minutes.\n' +
        '  Any travel between locations on the map takes EXACTLY 1 game hour.\n' +
        '  Talking to an NPC costs 10 minutes; entering a house costs 10 minutes; examining a footprint costs 1 hour.\n' +
        '  While a conversation is open, the real-time countdown is PAUSED.\n' +
        '  The thief moves AT MOST ONE STEP per game hour.\n' +
        '  ⏳ The "until the thief escapes" counter shows how many GAME HOURS remain\n' +
        '  before he vanishes for good (a thief tick = 1 game hour; ≤3 h red, ≤6 h orange).\n' +
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
    // Раунд 57: фолбэк на EN_KEYS — возрастные/BRP-ключи раунда 44 жили в
    // EN_KEYS, но вызывались через t(); фолбэк закрывает подобные зазоры.
    if (Object.prototype.hasOwnProperty.call(EN, ru)) return EN[ru];
    if (Object.prototype.hasOwnProperty.call(EN_KEYS, ru)) return EN_KEYS[ru];
    return ru;
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

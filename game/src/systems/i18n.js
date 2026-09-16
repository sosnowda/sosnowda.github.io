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
    'Вор украл икону и бежал из деревни! Расспроси жителей или ищи следы — время уходит.':
        'The thief stole the icon and fled the village! Question the locals or look for tracks — time is running out.',
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
};

// ----- Шаблоны с семантическими ключами (большие тексты) -----
const EN_KEYS = {
    // Раунд 32 (пп.14,15): обязательная строка «Информации по игре» (F1)
    'help.timeRatio':
        '⏱ TIME: 1 minute of real time = 30 minutes of game time (1:30 ratio),\n' +
        '  a full game day passes in 48 real minutes.\n' +
        '  Any travel between locations on the map takes EXACTLY 1 game hour.\n' +
        '  Talking to an NPC costs 1 hour; examining a footprint costs 1 hour.\n' +
        '  While a conversation is open, the real-time countdown is PAUSED.\n' +
        '  The thief moves AT MOST ONE STEP per game hour.',
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
        '⏱ TIME: 1 minute of real time = 30 minutes of game time (1:30 ratio),\n' +
        '  a full game day passes in 48 real minutes. Any travel between locations\n' +
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
        '  • Village reputation ≤ −80 → exile\n' +
        '  • The icon thief escapes (turn limit)\n' +
        '\n' +
        '🏆 VICTORY:\n' +
        '  • Village reputation +100 → accepted as one of their own\n' +
        '  • Marriage (NPC rep +90, village +50, 200 dengas)\n' +
        '\n' +
        '⭐ REPUTATION:\n' +
        '  Raise it: quests, gifts, praise, buying drinks for everyone.\n' +
        '  Lower it: begging, threats, night-time disturbance.\n' +
        '  ≤ −30: NPC won\'t talk. ≤ −50: won\'t trade. ≤ −80: may attack.',
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
        '  E — interact: doors, chests, campfire, fishing, the stone cross\n' +
        '  Chests hold small loot — once a day each.\n' +
        '  The campfire restores Health and Will (1 hour).\n' +
        '  Fishing is best in the rain.\n' +
        '  At night windows glow and fireflies come out.\n' +
        '  F1 — this help. ESC — main menu.',
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

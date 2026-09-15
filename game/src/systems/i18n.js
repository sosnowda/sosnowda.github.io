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
    'Кузница': 'Smithy',
    'Амбар': 'Barn',
    'Дом Авдея': 'Avdey\'s house',
    'Дом Марфы': 'Marfa\'s house',
    'Часовня': 'Chapel',
    'Церковь': 'Church',
    'Ворота': 'Gate',
    'Дом старосты': 'Elder\'s house',
    'Таверна «У дороги»': 'The Wayfarer\'s Tavern',
    'Дом крестьянина': 'Peasant\'s house',
    'Дом вдовы': 'Widow\'s house',
    'Амбар общины': 'Community barn',
    'Часовня Николая Чудотворца': 'Chapel of St. Nicholas',
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
};

// ----- Шаблоны с семантическими ключами (большие тексты) -----
const EN_KEYS = {
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

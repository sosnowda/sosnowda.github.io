// Система времени для Руси XV века.
// Использует исторический календарь:
// - Летоисчисление от сотворения мира (5508 г. до Р.Х.)
// - Месяцы по церковному календарю (сентябрьский стиль)
// - Часы: дневное время (рассвет–закат) и ночное
// - Времена года: весна, лето, осень, зима

// Месяцы церковного календаря Руси XV века (сентябрьский стиль)
export const MONTHS = [
    { name: 'сентября', nameNominative: 'Сентябрь', season: 'autumn', days: 30 },
    { name: 'октября', nameNominative: 'Октябрь', season: 'autumn', days: 31 },
    { name: 'ноября', nameNominative: 'Ноябрь', season: 'autumn', days: 30 },
    { name: 'декабря', nameNominative: 'Декабрь', season: 'winter', days: 31 },
    { name: 'января', nameNominative: 'Январь', season: 'winter', days: 31 },
    { name: 'февраля', nameNominative: 'Февраль', season: 'winter', days: 28 },
    { name: 'марта', nameNominative: 'Март', season: 'spring', days: 31 },
    { name: 'апреля', nameNominative: 'Апрель', season: 'spring', days: 30 },
    { name: 'мая', nameNominative: 'Май', season: 'spring', days: 31 },
    { name: 'июня', nameNominative: 'Июнь', season: 'summer', days: 30 },
    { name: 'июля', nameNominative: 'Июль', season: 'summer', days: 31 },
    { name: 'августа', nameNominative: 'Август', season: 'summer', days: 31 },
];

// Дни недели (по-славянски)
export const WEEKDAYS = [
    'Неделя',      // воскресенье
    'Понедѣльник', // понедельник
    'Вторникъ',
    'Среда',
    'Четвергъ',
    'Пятница',
    'Суббота',
];

// Славянские названия времён суток
export const TIME_OF_DAY = {
    DAWN: { id: 'dawn', name: 'рассвѣтъ', startHour: 4, endHour: 6, color: 0xf4a460, alpha: 0.15 },
    MORNING: { id: 'morning', name: 'утро', startHour: 6, endHour: 12, color: 0xffe4b5, alpha: 0.0 },
    NOON: { id: 'noon', name: 'полудень', startHour: 12, endHour: 16, color: 0xffffe0, alpha: 0.0 },
    EVENING: { id: 'evening', name: 'вечеръ', startHour: 16, endHour: 19, color: 0xff8c00, alpha: 0.2 },
    DUSK: { id: 'dusk', name: 'сумерки', startHour: 19, endHour: 21, color: 0x8b4513, alpha: 0.35 },
    NIGHT: { id: 'night', name: 'ночь', startHour: 21, endHour: 24, color: 0x191970, alpha: 0.55 },
    NIGHT_EARLY: { id: 'night', name: 'ночь', startHour: 0, endHour: 4, color: 0x191970, alpha: 0.55 },
};

// Времена года
export const SEASONS = {
    spring: { name: 'Весна', color: 0x90ee90, alpha: 0.05 },
    summer: { name: 'Лето', color: 0xffd700, alpha: 0.05 },
    autumn: { name: 'Осень', color: 0xd2691e, alpha: 0.1 },
    winter: { name: 'Зима', color: 0xffffff, alpha: 0.15 },
};

// Создать случайную дату в пределах 15 века (1401-1500 от Р.Х., 6909-7008 от С.М.)
export function createRandomStartDate() {
    const yearFromChrist = 1401 + Math.floor(Math.random() * 100); // 1401..1500
    const yearFromCreation = yearFromChrist + 5508; // от сотворения мира
    const month = Math.floor(Math.random() * 12); // 0..11
    const day = 1 + Math.floor(Math.random() * 28); // 1..28
    return {
        yearFromChrist,
        yearFromCreation,
        month, // 0..11
        day, // 1..31
        hour: 6 + Math.floor(Math.random() * 4), // 6..9 утра
        minute: 0,
    };
}

// Создать объект времени
export function createTimeState(startDate) {
    return {
        ...startDate,
        tickCount: 0, // счётчик тиков (1 тик = ~15 игровых минут)
    };
}

// Получить время суток по часу
export function getTimeOfDay(hour) {
    if (hour >= 4 && hour < 6) return TIME_OF_DAY.DAWN;
    if (hour >= 6 && hour < 12) return TIME_OF_DAY.MORNING;
    if (hour >= 12 && hour < 16) return TIME_OF_DAY.NOON;
    if (hour >= 16 && hour < 19) return TIME_OF_DAY.EVENING;
    if (hour >= 19 && hour < 21) return TIME_OF_DAY.DUSK;
    return TIME_OF_DAY.NIGHT;
}

// Получить время года по месяцу
export function getSeason(month) {
    return MONTHS[month].season;
}

// Продвинуть время на указанное количество минут
export function advanceTime(timeState, minutes) {
    timeState.minute += minutes;
    while (timeState.minute >= 60) {
        timeState.minute -= 60;
        timeState.hour++;
        if (timeState.hour >= 24) {
            timeState.hour = 0;
            timeState.day++;
            const monthDef = MONTHS[timeState.month];
            if (timeState.day > monthDef.days) {
                timeState.day = 1;
                timeState.month++;
                if (timeState.month >= 12) {
                    timeState.month = 0;
                    timeState.yearFromChrist++;
                    timeState.yearFromCreation++;
                }
            }
        }
    }
    timeState.tickCount++;
    return timeState;
}

// Получить день недели (0 = воскресенье)
export function getWeekday(timeState) {
    // Простой алгоритм: считаем дни от известной даты
    // 1 января 1401 — понедельник (грубо)
    const baseDate = new Date(1401, 0, 1);
    const currentDate = new Date(timeState.yearFromChrist, timeState.month, timeState.day);
    const diffDays = Math.floor((currentDate - baseDate) / (1000 * 60 * 60 * 24));
    return ((diffDays % 7) + 7) % 7;
}

// Форматировать дату в историческом стиле
export function formatDate(timeState) {
    const day = timeState.day;
    const monthName = MONTHS[timeState.month].name;
    const year = timeState.yearFromCreation;
    return `${day} ${monthName} ${year} от С.М.`;
}

// Форматировать время (приблизительно)
export function formatTime(timeState) {
    const hour = timeState.hour;
    const tod = getTimeOfDay(hour);
    // Примерное время — славянское деление
    if (hour >= 4 && hour < 6) return 'на ранней заре';
    if (hour >= 6 && hour < 8) return 'поутру';
    if (hour >= 8 && hour < 10) return 'утром';
    if (hour >= 10 && hour < 12) return 'перед обедом';
    if (hour >= 12 && hour < 13) return 'в полдень';
    if (hour >= 13 && hour < 16) return 'после обеда';
    if (hour >= 16 && hour < 19) return 'под вечер';
    if (hour >= 19 && hour < 21) return 'на закате';
    if (hour >= 21 || hour < 1) return 'ночью';
    if (hour >= 1 && hour < 4) return 'глубокой ночью';
    return tod.name;
}

// Получить полную строку даты+времени
export function formatDateTime(timeState) {
    const weekday = WEEKDAYS[getWeekday(timeState)];
    return `${weekday}, ${formatDate(timeState)}, ${formatTime(timeState)}`;
}

// Инициализация времени в registry
export function initTime(registry, startDate) {
    const timeState = createTimeState(startDate || createRandomStartDate());
    registry.set('gameTime', timeState);
    return timeState;
}

// Получить текущее время из registry
export function getTime(registry) {
    return registry.get('gameTime');
}

// Продвинуть время и сохранить в registry
export function tickTime(registry, minutes = 15) {
    let timeState = registry.get('gameTime');
    if (!timeState) {
        timeState = initTime(registry);
    }
    advanceTime(timeState, minutes);
    registry.set('gameTime', timeState);
    return timeState;
}

// Получить overlay-цвет для визуальной смены дня/ночи
export function getDayNightOverlay(timeState) {
    if (!timeState) return { color: 0x000000, alpha: 0 };
    const tod = getTimeOfDay(timeState.hour);
    const season = SEASONS[getSeason(timeState.month)];
    // Комбинируем время суток и сезон
    return {
        color: tod.color,
        alpha: Math.max(tod.alpha, season.alpha),
        timeOfDay: tod.id,
        season: getSeason(timeState.month),
    };
}

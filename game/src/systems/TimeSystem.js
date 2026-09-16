// Система времени для Руси XV века.
// Использует исторический календарь:
// - Летоисчисление от сотворения мира (5508 г. до Р.Х.)
// - Месяцы по церковному календарю (сентябрьский стиль)
// - Часы: дневное время (рассвет–закат) и ночное
// - Времена года: весна, лето, осень, зима
// Раунд 15: формат даты/времени локализован (i18n) — EN месяц/день/время.
import { t, isEn, EN_MONTHS, EN_WEEKDAYS } from './i18n.js';
import { tickQuestTime } from '../data/questGenerator.js';

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

// Времена года (имя локализуется через t() при выводе)
export const SEASONS = {
    spring: { name: 'Весна', color: 0x90ee90, alpha: 0.05 },
    summer: { name: 'Лето', color: 0xffd700, alpha: 0.05 },
    autumn: { name: 'Осень', color: 0xd2691e, alpha: 0.1 },
    winter: { name: 'Зима', color: 0xffffff, alpha: 0.15 },
};

// Локализованное имя сезона по ключу ('spring'...)
export function seasonName(seasonKey) {
    return t(SEASONS[seasonKey] ? SEASONS[seasonKey].name : seasonKey);
}

// Создать случайную дату в пределах 15 века (1401-1500 от Р.Х., 6909-7008 от С.М.)
// Раунд 28 (п.5): РЕАЛЬНОЕ ВРЕМЯ — новая игра начинается в тот час и минуту,
// которые сейчас у игрока (день/ночь при старте совпадает с настоящим).
export function createRandomStartDate() {
    const yearFromChrist = 1401 + Math.floor(Math.random() * 100); // 1401..1500
    const yearFromCreation = yearFromChrist + 5508; // от сотворения мира
    const month = Math.floor(Math.random() * 12); // 0..11
    const day = 1 + Math.floor(Math.random() * 28); // 1..28
    const now = new Date();
    return {
        yearFromChrist,
        yearFromCreation,
        month, // 0..11
        day, // 1..31
        hour: now.getHours(),            // реальный час игрока (0..23)
        minute: now.getMinutes(),        // реальная минута игрока
    };
}

/**
 * Раунд 28 (п.5): текущее РЕАЛЬНОЕ время игрока «ЧЧ:ММ» — для живых часов
 * в статус-баре деревни и на локациях.
 */
export function realTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
// EN: "5 September 6909 A.M. (1401 AD)" — год от С.М. с уточнением от Р.Х.
export function formatDate(timeState) {
    const day = timeState.day;
    const year = timeState.yearFromCreation;
    if (isEn()) {
        return `${day} ${EN_MONTHS[timeState.month]} ${year} A.M. (${timeState.yearFromChrist} AD)`;
    }
    const monthName = MONTHS[timeState.month].name;
    return `${day} ${monthName} ${year} от С.М.`;
}

// Форматировать время (приблизительно)
export function formatTime(timeState) {
    const hour = timeState.hour;
    const tod = getTimeOfDay(hour);
    // Примерное время — славянское деление
    if (hour >= 4 && hour < 6) return t('на ранней заре');
    if (hour >= 6 && hour < 8) return t('поутру');
    if (hour >= 8 && hour < 10) return t('утром');
    if (hour >= 10 && hour < 12) return t('перед обедом');
    if (hour >= 12 && hour < 13) return t('в полдень');
    if (hour >= 13 && hour < 16) return t('после обеда');
    if (hour >= 16 && hour < 19) return t('под вечер');
    if (hour >= 19 && hour < 21) return t('на закате');
    if (hour >= 21 || hour < 1) return t('ночью');
    if (hour >= 1 && hour < 4) return t('глубокой ночью');
    return t(tod.name);
}

// Получить полную строку даты+времени
export function formatDateTime(timeState) {
    const weekday = isEn() ? EN_WEEKDAYS[getWeekday(timeState)] : WEEKDAYS[getWeekday(timeState)];
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

// Продвинуть время и сохранить в registry.
// Раунд 21: на каждый тик времени реагирует мировая погоня за вором —
// вор ждёт на локации или перемещается (хук из data/thief.js).
export function tickTime(registry, minutes = 15) {
    let timeState = registry.get('gameTime');
    if (!timeState) {
        timeState = initTime(registry);
    }
    // Раунд 29: новолетие — смена года по сентябрьскому (1 сентября) или
    // мартовскому (1 марта) стилю; сигнал для сцен-анонсов.
    const prevMonth = timeState.month, prevDay = timeState.day;
    advanceTime(timeState, minutes);
    registry.set('gameTime', timeState);
    let novoletie = null;
    if (timeState.month === 0 && timeState.day === 1 && !(prevMonth === 0 && prevDay === 1)) {
        // Сентябрьский год = stored yearFromChrist + 5509 (см. RusTime.eraYear)
        novoletie = { style: 'september', era: timeState.yearFromChrist + 5509 };
    } else if (timeState.month === 6 && timeState.day === 1 && !(prevMonth === 6 && prevDay === 1)) {
        // Мартовское: реальный Р.Х.-год в марте = stored + 1
        novoletie = { style: 'march', era: timeState.yearFromChrist + 1 + 5508 };
    }
    if (novoletie) {
        registry.set('novoletie', novoletie);
    }
    // Мировой тик погони (вор двигается на каждый полный тик)
    const chaseHook = registry.get && registry.get('chaseTickHook');
    if (typeof chaseHook === 'function') {
        chaseHook(registry, minutes);
    }
    // Раунд 22: мировое время также течёт для сроков процедурных поручений
    tickQuestTime(registry, minutes);
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

// RusTime — счёт времени «как на Руси XV века» (раунд 29).
// Реализует историческую справку владельца:
//   1. Летосчисление от Сотворения мира (византийская эра), сентябрьский и
//      мартовский стили новолетия (по умолчанию сентябрьский).
//      Сентябрьский: IX–XII мес. = Р.Х.+5509, I–VIII = Р.Х.+5508.
//      Мартовский:   III–XII мес. = Р.Х.+5508, I–II   = Р.Х.+5507.
//   2. Вспомогательные циклы: индикт (15 лет, с 1 сентября, по сентябрьскому
//      лету), круг солнца (28) и круг луны (19) — от мартовского лета.
//      Проверка на летописном примере: 7 Вересня 6971 (1462 г.) → индикт 11.
//   3. «Косые часы»: сутки = день + ночь, час = 1/12 светлого/тёмного времени
//      (летом дневной час ~87 минут, зимой ~34–36). Широта ~ Москвы (55.75°).
//   4. Народные ориентиры: полночь, первые/вторые петухи, заря занимается,
//      восход солнца, заутреня отошла, третий час, шестой час (обедня),
//      девятый час (вечерня), повечерие, сумерки, глубокая ночь.
//   5. Народные названия месяцев (ряд «вересень…» — как в летописном примере).
// Игровой `hour` остаётся равными часами (математика боёв/погони) — «косой»
// счёт это слой погружения поверх game-времени или реального времени игрока.
import { isEn, t, EN_WEEKDAYS, EN_MONTHS } from './i18n.js';
import { MONTHS, WEEKDAYS, getWeekday } from './TimeSystem.js';

// Патч 66.3: месяцы народного календаря — имена собственные, в EN пишутся
// ТРАНСЛИТЕРАЦИЕЙ (Вересень → Veresen, Студень → Studen) — словарные ключи
// в i18n.js (блок «Патч 66.3»). В коде вывода — только через t().
export const monthNameNom = (m) => t(MONTH_NAMES[m] || '');
export const monthNameGen = (m) => t(MONTH_NAMES_GEN[m] || MONTH_NAMES[m] || '');
export const monthNameAlt = (m) => t(MONTH_NAMES_ALT[m] || '');

// ----- Народные названия месяцев -----
// Индексация совпадает с TimeSystem.MONTHS: 0 = сентябрь (сентябрьский год).
// Основной ряд — «вересенный» (как в летописном примере владельца),
// запасной — древнерусский «рюенный» ряд для справки в летописи.
export const MONTH_NAMES = [
    'Вересень', 'Паздерник', 'Грудень', 'Студень',
    'Просинец', 'Лютень', 'Березозол', 'Цветень',
    'Травень', 'Кресень', 'Липень', 'Серпень',
];
export const MONTH_NAMES_ALT = [
    'Рюень', 'Листогной', 'Грудень', 'Студень',
    'Просинец', 'Сечень', 'Сухень', 'Березозол',
    'Травень', 'Изок', 'Червень', 'Серпень',
];

// Родительный падеж («7-й день Вересня») — беглые гласные как в живой речи
export const MONTH_NAMES_GEN = [
    'Вересня', 'Паздерника', 'Грудня', 'Студня',
    'Просинца', 'Лютня', 'Березозола', 'Цветня',
    'Травеня', 'Кресня', 'Липня', 'Серпня',
];
function monthGen(m) {
    return MONTH_NAMES_GEN[m] || MONTH_NAMES[m];
}

// ----- Эра от Сотворения мира -----
// Внутренняя конвенция игры: timeState.yearFromChrist хранит Р.Х.-год,
// с которого начался текущий сентябрьский год; месяц 0 = сентябрь.
// Настоящий Р.Х.-год даты: +1 для месяцев января–августа (индексы 4..11).
export function realYearAD(ts) {
    return ts.yearFromChrist + (ts.month >= 4 ? 1 : 0);
}

// Месяц по-обычному счёту: 0 = январь ... 11 = декабрь
export function monthADIndex(ts) {
    return (ts.month + 8) % 12;
}

/**
 * Лето от Сотворения мира.
 * style: 'september' (по умолчанию) | 'march'.
 */
export function eraYear(ts, style) {
    const st = style || (typeof ts.newYearStyle === 'string' ? ts.newYearStyle : 'september');
    const ad = realYearAD(ts);
    const m = monthADIndex(ts);
    if (st === 'march') {
        return ad + (m >= 2 ? 5508 : 5507);
    }
    // Сентябрь–декабрь (AD-месяцы 8..11) → +5509, январь–август → +5508
    return ad + (m >= 8 ? 5509 : 5508);
}

// ----- Вспомогательные циклы (церковно-календарная практика) -----
// Индикт: 15-летний цикл, меняется 1 сентября, считается по сентябрьскому лету.
export function indiction(ts) {
    const era = eraYear(ts, 'september');
    return ((era - 1) % 15) + 1;
}

// Круг солнца (28 лет) и круг луны (19 лет) — от мартовского лета.
export function solarCircle(ts) {
    const era = eraYear(ts, 'march');
    return ((era - 1) % 28) + 1;
}

export function lunarCircle(ts) {
    const era = eraYear(ts, 'march');
    return ((era - 1) % 19) + 1;
}

// ----- «Косые часы» -----
const LATITUDE = 55.75; // широта Москвы
// Средние дни года для середины каждого месяца (январь..декабрь)
const MID_MONTH_DOY = [17, 47, 75, 105, 135, 166, 196, 227, 258, 288, 318, 349];

/** Длина светлого дня в часах (солнечный восход-закат, широта Москвы). */
export function dayLengthHours(gameMonthIdx) {
    const doy = MID_MONTH_DOY[(gameMonthIdx + 8) % 12];
    const decl = 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365); // склонение солнца
    const x = -Math.tan((LATITUDE * Math.PI) / 180) * Math.tan((decl * Math.PI) / 180);
    const H = Math.acos(Math.max(-1, Math.min(1, x))); // полудуговой угол
    const len = (2 * (H * 180) / Math.PI) / 15; // часы
    return Math.max(5, Math.min(19.5, len));
}

export function sunriseHour(gameMonthIdx) { return 12 - dayLengthHours(gameMonthIdx) / 2; }
export function sunsetHour(gameMonthIdx) { return 12 + dayLengthHours(gameMonthIdx) / 2; }

/** Косой час дня/ночи в минутах (1/12 светлого или тёмного времени). */
export function unequalDayHourLenMin(gameMonthIdx) { return (dayLengthHours(gameMonthIdx) / 12) * 60; }
export function unequalNightHourLenMin(gameMonthIdx) { return ((24 - dayLengthHours(gameMonthIdx)) / 12) * 60; }

function enOrdinal(n) {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
}

/**
 * Косой час для заданного равного часа суток.
 * Возвращает { n, isDay, text } — «4-й час дня» / «6-й час ночи».
 */
export function slavonicHourParts(hour, gameMonthIdx) {
    const h = ((hour % 24) + 24) % 24;
    const dl = dayLengthHours(gameMonthIdx);
    const sr = 12 - dl / 2, ss = 12 + dl / 2;
    let n, isDay;
    if (h >= sr && h < ss) {
        isDay = true;
        n = Math.min(12, Math.floor((h - sr) / (dl / 12)) + 1);
    } else {
        isDay = false;
        const hRel = (h - ss + 24) % 24;
        n = Math.min(12, Math.floor(hRel / ((24 - dl) / 12)) + 1);
    }
    const text = isEn()
        ? `${enOrdinal(n)} hour of the ${isDay ? 'day' : 'night'}`
        : `${n}-й час ${isDay ? 'дня' : 'ночи'}`;
    return { n, isDay, text };
}

/** Косой час по игровому времени. */
export function slavonicHourLine(ts) {
    return slavonicHourParts(ts.hour, ts.month).text;
}

/** Косой час по НАСТОЯЩЕМУ времени игрока (живые часы — раунд 28+29). */
export function slavonicHourReal(now) {
    const d = now || new Date();
    const gameIdx = (d.getMonth() + 4) % 12; // январь(AD 0) → игровой индекс 4
    return slavonicHourParts(d.getHours() + d.getMinutes() / 60, gameIdx).text;
}

// ----- Народные ориентиры времени -----
// Таблица в порядке из справки владельца; fixed-слоты ~1.5–3 часа.
export const FOLK_PERIODS = [
    { from: 0,    name: 'полночь' },
    { from: 1,    name: 'глубокая ночь' },
    { from: 3,    name: 'первые петухи' },
    { from: 4.5,  name: 'вторые петухи' },
    { from: 6,    name: 'заря занимается' },
    { from: 7.5,  name: 'восход солнца' },
    { from: 9,    name: 'заутреня отошла' },
    { from: 10.5, name: 'третий час' },
    { from: 12,   name: 'шестой час (обедня)' },
    { from: 15,   name: 'девятый час (вечерня)' },
    { from: 18,   name: 'повечерие' },
    { from: 20,   name: 'сумерки' },
    { from: 22,   name: 'глубокая ночь' },
];

export function folkTimeName(hour) {
    const h = ((hour % 24) + 24) % 24;
    let name = FOLK_PERIODS[0].name;
    for (const p of FOLK_PERIODS) {
        if (h >= p.from) name = p.name;
    }
    return t(name);
}

/** Народное время по настоящему времени игрока. */
export function folkTimeReal(now) {
    const d = now || new Date();
    return folkTimeName(d.getHours() + d.getMinutes() / 60);
}

// ----- Форматы дат -----
/**
 * Компактная историческая дата для статус-баров:
 * «Понедѣльник, 7-й день Вересня, лето 6971-е (1462)»
 */
export function formatDateRus(ts) {
    const era = eraYear(ts);
    const ad = realYearAD(ts);
    if (isEn()) {
        // Патч 66.3: месяц — транслитерацией (Veresen/Studen), не кириллицей
        return `${EN_WEEKDAYS[getWeekday(ts)]}, the ${enOrdinal(ts.day)} day of ${monthNameNom(ts.month)}, year ${era} A.M. (${ad})`;
    }
    return `${WEEKDAYS[getWeekday(ts)]}, ${ts.day}-й день ${monthGen(ts.month)}, лето ${era}-е (${ad})`;
}

/**
 * Полная летописная датировка (по справке владельца):
 * «7-й день месяца Вересень, лето 6971-е от Сотворения мира
 *  (1462 г. от Р.Х.), индикт 11, круг солнца 26, круг луны 16»
 * style: 'september' | 'march' — стиль для лета (по умолчанию текущий).
 */
export function chronicleDateLine(ts, style) {
    const st = style || (typeof ts.newYearStyle === 'string' ? ts.newYearStyle : 'september');
    const era = eraYear(ts, st);
    const ad = realYearAD(ts);
    const ind = indiction(ts);
    const sc = solarCircle(ts);
    const lc = lunarCircle(ts);
    if (isEn()) {
        return `The ${enOrdinal(ts.day)} day of ${monthNameNom(ts.month)}, year ${era} from the Creation of the World (${ad} AD), indiction ${ind}, solar circle ${sc}, lunar circle ${lc}`;
    }
    return `${ts.day}-й день месяца ${MONTH_NAMES[ts.month]}, лето ${era}-е от Сотворения мира (${ad} г. от Р.Х.), индикт ${ind}, круг солнца ${sc}, круг луны ${lc}`;
}

/** Короткая сводка «косых часов» для летописи. */
export function slavonicDayNote(gameMonthIdx) {
    const dl = dayLengthHours(gameMonthIdx);
    const h = Math.floor(dl);
    const m = Math.round((dl - h) * 60);
    const dm = Math.round(unequalDayHourLenMin(gameMonthIdx));
    const nm = Math.round(unequalNightHourLenMin(gameMonthIdx));
    if (isEn()) {
        return `Daylight is about ${h} h ${m} min: an hour of the day ≈ ${dm} min, an hour of the night ≈ ${nm} min.`;
    }
    return `Светлый день — около ${h} ч ${m} м: косой час дня ≈ ${dm} мин, час ночи ≈ ${nm} мин.`;
}

// ----- Новолетие -----
/**
 * Сравнить состояние до/после тика; вернуть 'september'|'march'|null.
 * Сентябрьское новолетие — переход в месяц 0 (сентябрь), мартовское — в 6 (март).
 */
export function checkNovoletie(prevMonth, prevDay, nextMonth, nextDay) {
    if (nextMonth === 0 && nextDay === 1 && !(prevMonth === 0 && prevDay === 1)) return 'september';
    if (nextMonth === 6 && nextDay === 1 && !(prevMonth === 6 && prevDay === 1)) return 'march';
    return null;
}

// ----- Летописная панель (общая для сцен) -----
/**
 * Показывает панель «📜 Летопись» поверх сцены (Village/Location).
 * Закрытие: клик по затемнению или кнопке.
 */
export function showChroniclePanel(scene) {
    const { width, height } = scene.scale;
    const ts = scene.registry.get('gameTime');
    if (!ts) return;
    const style = scene.registry.get('newYearStyle') || 'september';
    scene.children.list.filter(c => c.depth >= 200 && c.depth < 210).forEach(c => c.destroy());

    const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.8)
        .setOrigin(0).setInteractive().setScrollFactor(0).setDepth(200);
    const panelW = Math.min(760, width - 30), panelH = 430;
    const panel = scene.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
        .setStrokeStyle(3, 0xC9A961).setScrollFactor(0).setDepth(201);

    const title = scene.add.text(width / 2, height / 2 - panelH / 2 + 22, t('📜 Летопись'), {
        fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    const hourParts = slavonicHourParts(ts.hour, ts.month);
    const folk = folkTimeName(ts.hour);
    const lines = [
        `«${chronicleDateLine(ts, style)}»`,
        '',
        `${isEn() ? 'Month: ' : 'Месяц: '}${monthNameNom(ts.month)} (${isEn() ? 'otherwise ' : 'иначе '}${monthNameAlt(ts.month)}) — ${isEn() ? (EN_MONTHS[ts.month] || '').toLowerCase() : MONTHS[ts.month].nameNominative.toLowerCase()}`,
        `${isEn() ? 'Time of day: ' : 'Сутки: '}${hourParts.text} · ${folk}`,
        slavonicDayNote(ts.month),
        isEn()
            ? (style === 'september' ? 'New year: September style — the year begins on 1 September.' : 'New year: March style — the year begins on 1 March.')
            : (style === 'september' ? 'Новолетие: сентябрьское — год начинается 1 сентября (официальный стиль XV века).' : 'Новолетие: мартовское — год начинается 1 марта (бытовой стиль).'),
        isEn()
            ? (style === 'september' ? `In the March style it would be year ${eraYear(ts, 'march')}.` : `In the September style it would be year ${eraYear(ts, 'september')}.`)
            : (style === 'september' ? `По мартовскому стилю: лето ${eraYear(ts, 'march')}-е.` : `По сентябрьскому стилю: лето ${eraYear(ts, 'september')}-е.`),
    ];
    const body = scene.add.text(width / 2, height / 2 - 52, lines.join('\n'), {
        fontSize: '15px', color: '#E8DCC4', align: 'center',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 1,
        lineSpacing: 4, wordWrap: { width: panelW - 50 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);

    // Переключатель стиля новолетия (как GameTime.new_year_style в справке)
    const btnLabel = isEn()
        ? (style === 'september' ? 'Count by the March style' : 'Count by the September style')
        : (style === 'september' ? 'Считать по-мартовски (1 марта)' : 'Считать по-сентябрьски (1 сентября)');
    const btnBg = scene.add.rectangle(width / 2, height / 2 + panelH / 2 - 58, 320, 30, 0x2a4a6a, 0.95)
        .setStrokeStyle(1, 0xC9A961).setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(202);
    const btnText = scene.add.text(width / 2, height / 2 + panelH / 2 - 58, btnLabel, {
        fontSize: '12px', color: '#E8DCC4', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(203);
    btnBg.on('pointerup', () => {
        const next = (scene.registry.get('newYearStyle') || 'september') === 'september' ? 'march' : 'september';
        scene.registry.set('newYearStyle', next);
        showChroniclePanel(scene); // перерисовать с новым стилем
    });

    // Кнопка закрытия
    const closeBg = scene.add.rectangle(width / 2, height / 2 + panelH / 2 - 24, 140, 28, 0x8B2C1A, 1)
        .setStrokeStyle(2, 0xC9A961).setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(202);
    const closeText = scene.add.text(width / 2, height / 2 + panelH / 2 - 24, t('Закрыть'), {
        fontSize: '13px', color: '#E8DCC4', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(203);

    const closeAll = () => {
        [overlay, panel, title, body, btnBg, btnText, closeBg, closeText].forEach(o => o && o.destroy());
    };
    overlay.on('pointerup', closeAll);
    closeBg.on('pointerup', closeAll);
    showChroniclePanel._close = closeAll;
    return closeAll;
}

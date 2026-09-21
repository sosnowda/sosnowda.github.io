// WeatherOmens.js — НАРОДНЫЕ ПРИМЕТЫ: СЛУХИ О ПОГОДЕ УПРАВЛЯЮТ ПОГОДОЙ
// (раунд 66.7, приказы владельца пп.5–7):
//   п.5 — взрослые НПЦ отвечают о погоде «в ближайшее время»;
//   п.6 — ВЕСТИ ПОДСЧЁТ СЛУХАМ: если о одном типе погоды (дождь/снег/ясно)
//         набрано БОЛЕЕ 3 слухов — эта погода приходит в ближайшее время
//         ВМЕСТО случайной;
//   п.7 — слухи и погода полностью соответствуют временам года.
//
// Механика:
//   • «примета дня» ЕДИНА для всей деревни (детерминирована датой) — все
//     взрослые НПЦ и корчмарь «чувствуют» один и тот же знак, иначе
//     собрать 3 слуха об одном типе было бы невозможно;
//   • каждый выслушанный слух о погоде (реплика НПЦ, слух Фёдора) звонит
//     в recordWeatherRumor() — счёт растёт в registry('weatherRumors');
//   • на 3-м слухе registry('weatherForecast') фиксирует тип погоды НА
//     ЗАВТРАШНИЙ день; Weather.getWeather() отдаёт его вместо хеша;
//   • тип нормализуется по СЕЗОНУ ЦЕЛЕВОГО дня: зимой дождь/гроза
//     превращаются в снег, летом снег — в дождь (п.7).

import { getTime, getSeason, MONTHS } from './TimeSystem.js';
import { getWeather } from './Weather.js';
import { t, tf } from './i18n.js';

// Сколько слухов о погоде нужно, чтобы примета сбылась (п.6: «более 3 раз»).
export const OMEN_THRESHOLD = 3;

/** FNV-1a — стабильный хеш строки. */
export function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
}

/** Ключ дня из timeState — тот же формат, что в Weather.js. */
export function dayKeyOfTime(t) {
    return t ? `${t.yearFromChrist}-${t.month}-${t.day}` : null;
}

/** Следующий день по календарю MONTHS (28–31 день, месяц 0 = сентябрь). */
export function nextDayOf(t) {
    if (!t) return null;
    let y = t.yearFromChrist, m = ((t.month % 12) + 12) % 12, d = t.day;
    const dim = (MONTHS[m] && MONTHS[m].days) || 30;
    d += 1;
    if (d > dim) { d = 1; m += 1; }
    if (m > 11) { m = 0; y += 1; }
    return { yearFromChrist: y, month: m, day: d };
}

/**
 * Типы погоды, допустимые в сезоне месяца (п.7 — сезонное соответствие).
 * Зима: снег/пасмурно/ясно (дождь и гроза невозможны — порядок владельца).
 * Весна: пасмурно и дождь чаще; лето: ясно/жара, грозы; осень: дождь/морось.
 * @returns {string[]} список id из WEATHER_TYPES
 */
export function seasonWeatherTypes(month) {
    const season = getSeason(((month % 12) + 12) % 12);
    switch (season) {
        case 'winter': return ['snow', 'cloudy', 'clear'];
        case 'spring': return ['rain', 'cloudy', 'rain', 'clear'];
        case 'summer': return ['clear', 'clear', 'cloudy', 'rain', 'storm'];
        default:       return ['rain', 'cloudy', 'clear'];       // осень
    }
}

/**
 * Примета дня — ЕДИНАЯ для всей деревни (детерминирована датой).
 * 60% случаев примета отличается от текущей погоды (приметы замечают ПЕРЕМЕНУ).
 * @returns {string|null} id типа погоды
 */
export function omenTypeForDay(registry) {
    const t = getTime(registry);
    if (!t) return null;
    const allowed = seasonWeatherTypes(t.month);
    const h = hashStr(dayKeyOfTime(t) + '|omen');
    let type = allowed[h % allowed.length];
    try {
        const cur = getWeather(registry);
        if (cur && cur.id === type && allowed.length > 1 && (h % 10) < 6) {
            type = allowed[(h + 1 + (h % 3)) % allowed.length];
        }
    } catch (e) { /* без времени погода не определится — примета остаётся */ }
    return type;
}

/**
 * Записать ОДИН выслушанный слух о погоде. На OMEN_THRESHOLD-м слухе
 * фиксирует форкаст на завтра (с сезонной нормализацией, п.7).
 * @returns {{type: string, count: number, fulfilled: boolean}|null}
 */
export function recordWeatherRumor(registry) {
    const t = getTime(registry);
    if (!t || !registry || typeof registry.get !== 'function') return null;
    const type = omenTypeForDay(registry);
    if (!type) return null;
    const today = dayKeyOfTime(t);
    const prev = registry.get('weatherRumors');
    const state = (prev && prev.day === today && prev.counts) ? prev : { day: today, counts: {} };
    state.counts[type] = (state.counts[type] || 0) + 1;
    registry.set('weatherRumors', state);

    let fulfilled = false;
    if (state.counts[type] >= OMEN_THRESHOLD) {
        const nd = nextDayOf(t);
        const allowedN = seasonWeatherTypes(nd.month);
        // нормализация по сезону целевого дня (п.7): зимой дождь → снег,
        // летом снег → дождь; иначе примета противоречила бы временам года
        let norm = type;
        if (!allowedN.includes(type)) {
            if (type === 'snow') norm = 'rain';
            else if (type === 'storm') norm = allowedN.includes('rain') ? 'rain' : 'cloudy';
            else if (type === 'rain') norm = allowedN.includes('snow') ? 'snow' : 'cloudy';
            else norm = allowedN[0];
        }
        registry.set('weatherForecast', { dayKey: dayKeyOfTime(nd), type: norm, from: today });
        fulfilled = true;
    }
    return { type, count: state.counts[type], fulfilled };
}

/** Счёт слухов о погоде сегодня (для тестов и UI). */
export function weatherRumorCount(registry, type) {
    const t = getTime(registry);
    if (!t || !registry) return 0;
    const st = registry.get('weatherRumors');
    if (!st || st.day !== dayKeyOfTime(t)) return 0;
    return (st.counts && st.counts[type]) || 0;
}

/** Действующий форкаст (для отладки/тестов): {dayKey, type}|null. */
export function getForecast(registry) {
    try {
        if (!registry || typeof registry.get !== 'function') return null;
        const fc = registry.get('weatherForecast');
        const t = getTime(registry);
        if (fc && t && fc.dayKey === dayKeyOfTime(t)) return fc;
    } catch (e) { /* ок */ }
    return null;
}

// ============================================================
// Реплики о погоде «в ближайшее время» (п.5): пары {ru, en}, вариации
// по seed — чтобы бабы у колодца, кузнец и поп говорили ПО-РАЗНОМУ,
// но об ОДНОЙ примете дня. Ключи i18n не нужны: EN живёт в паре.
// ============================================================
const OMEN_LINES = {
    clear: [
        { ru: 'Небо к вёдру клонится: звёзды нынче чисто горели, да ветер с полей сухой. Будет погожее время.', en: 'The sky leans toward fair weather: the stars burned clear tonight and the wind off the fields is dry. It will be fine.' },
        { ru: 'По приметам — вёдро стоит будет. Ласточки высоко летают, да туман по низам к полудню поднимается.', en: 'By the signs, clear days are coming. The swallows fly high, and the morning fog lifts off the hollows by noon.' },
        { ru: 'Погода в ближайшее время установится ясная: солнце садится в чистое, и дым из труб столбом.', en: 'The weather will settle clear soon enough: the sun sets into cloudless sky, and chimney smoke rises straight up.' },
    ],
    cloudy: [
        { ru: 'Небо затянет, чую: солнце в белую муть садилось, да ветра переменились. Пасмурное время будет.', en: 'I feel the sky will grey over: the sun set into a white haze and the winds have shifted. Overcast days are coming.' },
        { ru: 'По приметам — облака наволокут. Курицы на насест рано прячутся, да роса к вечеру тяжёлая.', en: 'The signs say clouds will roll in. The hens hide on the roost early, and the evening dew lies heavy.' },
        { ru: 'Пасмурно станет в ближайшие дни: месяц в тонкой пелене сидит, да птицы к земле жмутся.', en: 'Grey skies in the days ahead: the moon sits in a thin veil, and the birds hug the ground.' },
    ],
    rain: [
        { ru: 'К дождю всё идёт: лягушки квакают густо, да кисель в погребе киснет раньше срока. Жди дождя.', en: 'It is heading toward rain: the frogs croak thick, and the jelly sours in the cellar ahead of time. Wait for rain.' },
        { ru: 'Примечаю — дождь будет в ближайшее время. Ласточки низко носятся, да трава росой к полудню не сохнет.', en: 'I mark it — rain will come soon. The swallows skim low, and the grass stays wet with dew past midday.' },
        { ru: 'Небо воду собирает: ветер встречный с дождём дует, да солнце в кругах садилось. Дождь будет, не миновать.', en: 'The sky is gathering water: a headwind carries damp, and the sun set ringed. Rain will come, no avoiding it.' },
    ],
    storm: [
        { ru: 'Бури жди: гром с чистого неба слышали за рекой, да комары вьются столбом. Гроза находит.', en: 'Expect a storm: they heard thunder from a clear sky across the river, and the midges swarm in pillars. A storm is closing in.' },
        { ru: 'По всем приметам гроза будет: духота стоит, да небо с севера тучами наливается.', en: 'Every sign points to a thunderstorm: the air is heavy, and the sky fills with clouds from the north.' },
        { ru: 'К грозе клонится: печь дымит в избу, да куры беспокоятся. Задержится гроза ненадолго — но будет.', en: 'It leans toward a storm: the stove smokes into the house and the hens are restless. The storm will hold off a while — but it will come.' },
    ],
    snow: [
        { ru: 'К снегу всё: воробьи распушились, да дым к земле клонится. Снег ближайшим временем падёт.', en: 'It is turning to snow: the sparrows are puffed up, and smoke bends toward the ground. Snow will fall before long.' },
        { ru: 'Приметы снежные: белая радуга зимою, да уголь в кресалах ярко горит. Жди снегопада.', en: 'Snow signs: a white rainbow in winter, and the coals in the hearth burn bright. Wait for snowfall.' },
        { ru: 'Снег будет, точно говорю: галки с крыш в стаю сбились, да небо низкой сизью затянуло.', en: 'Snow is coming, I tell you truly: the jackdaws have flocking off the roofs, and a low grey veil has covered the sky.' },
    ],
};

/**
 * Реплика о примете дня. seed — стабильный (id НПЦ/день), чтобы один и тот
 * же НПЦ говорил одно и то же, а разные НПЦ — по-разному.
 * @returns {{ru: string, en: string}}
 */
export function omenLine(type, seed = 0) {
    const arr = OMEN_LINES[type] || OMEN_LINES.cloudy;
    return arr[((seed % arr.length) + arr.length) % arr.length];
}

/** Реплика-дополнение, когда примета уже сбылась (3 слуха собрано). */
export const OMEN_FULFILLED_NOTE = {
    ru: 'Толкуют об этом всячески — и все, как один, об одном. Видимо, сбудется: к завтрашнему дню погода обернётся.',
    en: 'Everyone is talking about it — and all of them say the same. It seems it will come true: by tomorrow the weather will turn.',
};

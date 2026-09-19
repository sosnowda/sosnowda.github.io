// ОХОТА НА ВОРА — много-локационная погоня (раунд 21, по спецификации владельца;
// раунд 22: ТРИ локации, следы и расспросы — по одному разу, побег вора из боя;
// раунд 30: СЛЕДЫ — отдельные видимые метки: каждый след проверяется ОДИН раз,
// после неудачи след исчезает, после удачи светится и показывает, где вор;
// свидетели о воре — 3–5 случайных селян, выбираются на старте игры.
// раунд 31 (пп.1,4,5,7,10 владельца): в лес вор входит ПОСЛЕДОВАТЕЛЬНО
// (Опушка → Поляна → Чаща); следов НЕ БОЛЬШЕ ДВУХ на локацию (два — только
// на Реке с двумя берегами); каждый след — цепочка из 6 чёрных отпечатков;
// ночью следы читаются ХУЖЕ; дождь/снег смывают следы, оставленные ДО осадков;
// обследование следа занимает ровно 1 час.
// раунд 32 (пп.2–4,9–13 владельца):
//  п.2  — вор делает НЕ БОЛЕЕ ОДНОГО ШАГА за игровой час;
//  п.3  — на каждой локации вор сидит ОТ 1 ДО 3 ЧАСОВ (случайно);
//  п.4  — подсказка селянина или прочитанный след «прибивают» вора к локации,
//         куда они ведут: 2 часа он оттуда НЕ уходит (даже если его собственный
//         счётчик времени уже обнулился);
//  п.9  — следы вора исчезают через 12–24 часа (случайно) после оставления,
//         НО только если за это время не было осадков;
//  п.10 — наводка от НПЦ действительна только первые 5 игровых часов, потом
//         вор уходит в другую локацию (поп-ап при входе на указанную локацию);
//  п.11 — вор НЕ лечится после прерванного побегом игрока боя;
//  п.12 — после побега игрока его переносит ко входу в деревню;
//  п.13 — после побега игрока вор сидит на этой локации ещё 3 часа.
//
// Механика:
// - Вор бежит из деревни в случайном направлении и проходит ПО ТРЁМ локациям
//   друг за другом в случайном порядке, оставляя следы.
// - После старта идёт отсчёт времени (тики). Тики тратятся на всё:
//   перемещение между локациями, поиск следов, разговоры с NPC, вход в дом
//   и даже ходьбу по деревне. При каждом тике вор перемещается или ждёт.
//   По истечении времени он покидает локацию и идёт в следующую. После
//   третьей локации вор сбегает — игра проиграна.
// - Селяне с некоторым шансом (проверка разговорного навыка) дают наводку
//   на первую локацию вора. КАЖДЫЙ селянин расспрашивается ОДИН РАЗ —
//   за новыми наводками нужно идти к другим людям.
// - Следы в каждой локации обследуются ТОЛЬКО ОДИН РАЗ. Удачное обследование
//   показывает, где вор находится прямо сейчас; неудачное — ничего не даёт,
//   дальше придётся искать вслепую.
// - Если вор в локации и туда заходит игрок — он сразу же видит вора:
//   можно напасть (бой), оглушить (плен) или убедить вернуть украденное.
//   Если игрок сбежал из боя — вор перебегает в случайную локацию,
//   и времени на его поимку становится чуть больше.
// - Получив украденный предмет, игрок возвращает его старосте или
//   священнику и получает награду. После победы игра ПРОДОЛЖАЕТСЯ:
//   староста и жители дают процедурно генерируемые задания.

import { skillCheck, opposedSkillCheck, formatOpposedCheck } from '../systems/BRPEngine.js';
import { ActionLog } from './actionLog.js';
import { applyBeggingPenalty, changeVillageRep } from './reputation.js';
import { getLocationById } from './mapLocations.js';
import { tickTime, getTimeOfDay } from '../systems/TimeSystem.js';
import { getWeather, isPrecip } from '../systems/Weather.js';
import { consumeBlessing } from './questGenerator.js';
import { formatMoney } from '../systems/Character.js';
import { t, tf } from '../systems/i18n.js';
import { createDialog } from '../utils/ui.js';
import { getNpcShortName, findNpc } from './npcNames.js';
// Раунд 47 (пп.2,4 заявки): смерть кузнеца не прячет наводку — знание
// наследует ученик; встречные проверки — по параметрам из базы жителей
import { isNpcKilled } from './reputation.js';
import { getNpcOpposition } from './npcStats.js';

/**
 * Раунд 41 (QA): говорящий в репликах о воре — ДИНАМИЧЕСКОЕ имя NPC
 * (рандомные исторические имена раунда 34), а не жёсткое из дерева диалога
 * («Тавернщик Фёдор» при тавернщике Миронеге/Ростиславе — лор-конфликт).
 * Если NPC ещё не знаком/не найден — fallback на имя из дерева диалога.
 */
function talkerName(registry, npcId, fallbackName) {
    try {
        const dyn = getNpcShortName(registry, npcId);
        if (dyn && dyn !== t('незнакомец')) return dyn;
    } catch (e) { /* npcNames недоступен — используем статическое имя */ }
    return fallbackName;
}

// Раунд 32 (п.2): длительность одного тика погони = 1 ИГРОВОЙ ЧАС.
// Вор делает НЕ БОЛЕЕ ОДНОГО ШАГА за час: за тик он либо ждёт на локации,
// либо один раз переходит к следующей. Часы для игрока (раунд 58 п.1):
// разговор — 10 минут, вход в дом — 10 минут, обследование следа — 1 час,
// переход по карте — ровно 1 час (п.5).
export const TICK_MINUTES = 60;
// Сколько локаций проходит вор, прежде чем сбежать (раунд 22: было 2, стало 3)
export const CHASE_STOPS = 3;
// Сколько тиков (часов) вор идёт между локациями (раунд 32, п.2: один шаг в час)
export const TRAVEL_TICKS = 1;
// Сколько тиков (часов) вор идёт из деревни до первой локации
export const START_TRAVEL_TICKS = 1;
// Раунд 32 (п.3), раунд 39 (п.22): вор ВСЕГДА сидит на обычной локации
// ОТ 2 ДО 5 ЧАСОВ (случайно) — раньше было 1–3, вор «слишком быстро убегал».
export const MIN_STAY_HOURS = 2;
export const MAX_STAY_HOURS = 5;
// Раунд 39 (п.25): в ЛЕСНЫХ локациях (Опушка/Поляна/Густой лес) вор задерживается
// ДОЛЬШЕ — от 4 до 7 часов (лес скрывает беглеца).
export const FOREST_STAY_MIN_HOURS = 4;
export const FOREST_STAY_MAX_HOURS = 7;
// Раунд 32 (п.4): прочитанный след или подсказка держат вора на месте 2 часа
export const TRAIL_LOCK_HOURS = 2;
// Раунд 32 (п.10): наводка от НПЦ действительна 5 игровых часов; когда срок
// выходит, вор уходит в другую локацию (принудительный переход).
export const NPC_HINT_VALID_HOURS = 5;
// Раунд 32 (п.13): после побега игрока из боя вор остаётся на локации ещё 3 часа
export const POST_FIGHT_STAY_HOURS = 3;
// Раунд 32 (п.9): следы вора исчезают через 12–24 часа (случайно) после
// оставления — но только если за это время не было осадков.
export const TRACE_LIFETIME_MIN_MINUTES = 12 * 60; // 12 часов
export const TRACE_LIFETIME_MAX_MINUTES = 24 * 60; // 24 часа

/** Случайный срок жизни следа в минутах (12–24 часа, п.9). */
export function randomTraceLifetime() {
    return TRACE_LIFETIME_MIN_MINUTES +
        Math.floor(Math.random() * (TRACE_LIFETIME_MAX_MINUTES - TRACE_LIFETIME_MIN_MINUTES + 1));
}

/** Случайная длительность сидения вора на локации в часах (2–5, п.22 раунда 39). */
export function randomStayHours() {
    return MIN_STAY_HOURS + Math.floor(Math.random() * (MAX_STAY_HOURS - MIN_STAY_HOURS + 1));
}

/** Раунд 39 (п.25): срок сидения вора в ЛЕСНОЙ локации — 4–7 часов. */
export function randomForestStayHours() {
    return FOREST_STAY_MIN_HOURS +
        Math.floor(Math.random() * (FOREST_STAY_MAX_HOURS - FOREST_STAY_MIN_HOURS + 1));
}

/** Раунд 39: срок ожидания вора для конкретной локации (лес — дольше). */
export function randomStayHoursFor(locationId) {
    return FOREST_SEQUENCE.includes(locationId)
        ? randomForestStayHours()
        : randomStayHours();
}
// Нижние пороги проверок (раунд 22, баланс: даже у воина-непрофильника
// должны быть реальные шансы — проверки решают исход погони)
export const MIN_SPOT = 35;      // обследование следов (Внимательность)
export const MIN_ORATORY = 30;   // расспрос селян (Красноречие)
export const MIN_PERSUADE = 35;  // убеждение вора (Убеждение)
export const MIN_BRAWL = 35;     // оглушение вора (Драка)
// Раунд 31 (п.4): ночью проверка обнаружения следов СЛОЖНЕЕ, чем днём
export const NIGHT_SPOT_PENALTY = 15;
// Раунд 31 (п.10): обследование следов занимает ровно 1 час
export const FOOTPRINT_EXAMINE_MINUTES = 60;

/** Ночь ли сейчас по игровому часу (сегмент «ночь»: 21:00–04:59). */
export function isNightHour(hour) {
    return hour >= 21 || hour < 5;
}

/** Ночная ли проверка навыка по состоянию времени (для сообщений). */
function isNightCheck(registry) {
    const ts = registry.get('gameTime');
    return !!(ts && (isNightHour(ts.hour) || (getTimeOfDay(ts.hour) || {}).id === 'night'));
}
// Лимит (для совместимости со старым UI/сохранениями)
export const TURN_LIMIT = 20;

// Локации, куда может бежать вор (все ходовые точки у околицы).
// Раунд 21: баг «road» vs «road_south» устранён — вор теперь может
// бежать в любую локацию с развилки, включая Тракт.
// Раунд 30: ЛЕС разделён на три части — Опушка, Поляна и сам Лес.
export const CHASE_LOCATIONS = [
    'forest', 'forest_edge', 'forest_glade',
    'road_south', 'field', 'river', 'lake', 'pogost', 'mill', 'apiary', 'pasture',
];

// Легаси-импорт (LocationScene импортирует THIEF_LOCATIONS)
export const THIEF_LOCATIONS = CHASE_LOCATIONS;

// Дорога до локации в тиках (ближние — 1, дальние — 2, как на «Карте местности»)
export const TRAVEL_COST = {
    forest: 1, forest_edge: 1, forest_glade: 1,
    road_south: 1, field: 1, river: 1,
    lake: 2, pogost: 2, mill: 2, apiary: 2, pasture: 2,
};

// ============================================================
// РАУНД 30/31: СЛЕДЫ — ОТДЕЛЬНЫЕ ВИДИМЫЕ МЕТКИ
// ============================================================

// Раунд 31 (п.7): на локации НЕ БОЛЬШЕ ДВУХ следов вора. Два — только на
// локации, состоящей из ДВУХ ЧАСТЕЙ (Река: два берега, разделённые мостом);
// в простой открытой локации — ОДИН след.
export const FOOTPRINTS_PER_TRACE = 2; // максимум (легаси-импорт для совместимости)
export const TWO_PART_LOCATIONS = ['river'];

/** Сколько отдельных следов вор оставляет на ЭТОЙ локации (п.7). */
export function footprintsForLocation(locationId) {
    return TWO_PART_LOCATIONS.includes(locationId) ? 2 : 1;
}

// Раунд 31 (п.1): лесные локации вор проходит СТРОГО ПОСЛЕДОВАТЕЛЬНО —
// сначала ОПУШКА, потом ПОЛЯНА, и только в конце ГУСТОЙ ЛЕС.
export const FOREST_SEQUENCE = ['forest_edge', 'forest_glade', 'forest'];

/**
 * Раунд 31 (п.1): расставить лесные локации маршрута в каноническом порядке
 * (Опушка → Поляна → Чаща), не трогая позиции остальных локаций.
 */
export function applyForestSequence(route) {
    const depth = (id) => FOREST_SEQUENCE.indexOf(id);
    const idx = route.map((id, i) => (depth(id) >= 0 ? i : -1)).filter(i => i >= 0);
    const sorted = idx.map(i => route[i]).sort((a, b) => depth(a) - depth(b));
    idx.forEach((pos, k) => { route[pos] = sorted[k]; });
    return route;
}

/** Мировое время в минутах от условной эпохи (для «возраста» следов). */
export function worldMinutesOf(registry) {
    const ts = registry.get('gameTime');
    if (!ts) return 0;
    return ((ts.yearFromChrist * 372 + ts.month * 31 + ts.day) * 24 + ts.hour) * 60 + (ts.minute || 0);
}

/**
 * Раунд 31 (п.5): после дождя или снегопада ВСЕ следы вора, оставленные
 * ДО начала осадков, пропадают (размыло/замело). Следы, оставленные уже
 * ПОСЛЕ начала осадков, остаются. Погода в игре суточная — начало осадков
 * совпадает с началом дня, поэтому смываются следы «вчерашние и старше».
 * Вызывается на каждом тике времени.
 * Раунд 32 (п.9): помимо осадков у следа есть собственный срок жизни
 * 12–24 часа (случайно, trace.life) — если осадков не было, след всё равно
 * истёртся по давности.
 */
export function expireTracesByAge(registry) {
    const q = registry.get('quest');
    if (!q || !q.chase || !q.chase.traces) return false;
    const now = worldMinutesOf(registry);
    let expired = false;
    Object.keys(q.chase.traces).forEach((locId) => {
        const tr = q.chase.traces[locId];
        if (tr && typeof tr.leftAt === 'number' && typeof tr.life === 'number') {
            if (now - tr.leftAt > tr.life) {
                delete q.chase.traces[locId];
                if (q.footprintStates) delete q.footprintStates[locId];
                expired = true;
            }
        }
    });
    if (expired) {
        registry.set('quest', q);
        ActionLog.add(registry, t('Старые следы вора истёрлись за давностью — земля их больше не хранит.'));
    }
    return expired;
}
export function washTracksByWeather(registry) {
    const q = registry.get('quest');
    if (!q || !q.chase || !q.chase.traces) return false;
    const weather = getWeather(registry);
    if (!isPrecip(weather)) return false;
    const ts = registry.get('gameTime');
    if (!ts) return false;
    const dayStart = ((ts.yearFromChrist * 372 + ts.month * 31 + ts.day) * 24) * 60;
    let washed = false;
    Object.keys(q.chase.traces).forEach((locId) => {
        const tr = q.chase.traces[locId];
        if (tr && typeof tr.leftAt === 'number' && tr.leftAt < dayStart) {
            delete q.chase.traces[locId];
            if (q.footprintStates) delete q.footprintStates[locId];
            washed = true;
        }
    });
    if (washed) {
        registry.set('quest', q);
        ActionLog.add(registry, weather.id === 'snow'
            ? t('Снегопад замёл все старые следы вора — остались только свежие, оставленные уже под снегом.')
            : t('Дождь размыл все старые следы вора — остались только свежие, оставленные уже под дождём.'));
    }
    return washed;
}

// Раунд 30: свидетели о воре — не всякий селянин его видел. На старте игры
// (по спецификации владельца, п.9) случайным образом выбирается, КТО может
// рассказать о воре и месте его нахождения — но не менее ТРЁХ человек.
// Священник и староста в списке не участвуют: батюшка сам не видел вора
// (он рассказывает о краже при первом диалоге), староста выдаёт задание.
export const MIN_WITNESSES = 3;
// Раунд 34 добавлял детей (kid1, kid2) — НО раунд 44 (п.6 владельца):
// «дети не могут выдавать задания и наводки» — дети исключены из пула.
const WITNESS_POOL = [
    'peasant1', 'widow', 'beekeeper1', 'beekeeper_wife', 'elder_wife',
    'blacksmith', 'tavernkeeper', 'hunter', 'fisherman',
];

/** Список свидетелей (ленивая инициализация — для старых сейвов тоже работает). */
export function ensureWitnesses(registry) {
    const q = registry.get('quest') || {};
    if (!q.thiefWitnesses || !q.thiefWitnesses.length) {
        const pool = [...WITNESS_POOL];
        const count = MIN_WITNESSES + Math.floor(Math.random() * 3); // 3..5
        q.thiefWitnesses = [];
        for (let i = 0; i < count && pool.length; i++) {
            q.thiefWitnesses.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        registry.set('quest', q);
    }
    return q.thiefWitnesses;
}

/** Был ли этот селянин свидетелем вора (случайно, на старте игры). */
export function isThiefWitness(registry, npcId) {
    return ensureWitnesses(registry).includes(npcId);
}

/**
 * Следы на локации (раунд 30): список отдельных следов с состоянием.
 * 'fresh' — можно обследовать; 'found' — прочитан (светится); 'gone' — затёрт.
 */
export function getFootprints(registry, locationId) {
    const q = registry.get('quest');
    const c = getChase(registry);
    if (!q || !c || !c.traces || !c.traces[locationId]) return [];
    const st = (q.footprintStates && q.footprintStates[locationId]) || {};
    const list = [];
    const count = footprintsForLocation(locationId); // раунд 31 (п.7): 1, на Реке — 2
    for (let i = 0; i < count; i++) {
        const id = `fp${i}`;
        list.push({ id, state: st[id] || 'fresh' });
    }
    return list;
}

/** Есть ли на локации необследованные следы (для кнопки общего осмотра). */
export function hasFreshFootprints(registry, locationId) {
    return getFootprints(registry, locationId).some(fp => fp.state === 'fresh');
}

/**
 * Обследовать КОНКРЕТНЫЙ след (раунд 30, пп.4–6 спецификации владельца):
 * - проверка отдельная на каждый след и только ЕДИНожды на след;
 * - после НЕУДАЧНОЙ проверки след пропадает (затёрт);
 * - после УДАЧНОЙ след «светится» и появляется подсказка с названием
 *   локации текущего местоположения вора.
 * Раунд 31 (п.10): обследование занимает ровно 1 ЧАС реального времени
 * (вор за этот час успевает уйти — четыре пятнадцатиминутных шага).
 * Раунд 31 (п.4): НОЧЬЮ следы читаются хуже — штраф к Внимательности.
 */
export function examineFootprint(registry, locationId, fpId) {
    const q = registry.get('quest') || {};
    const c = getChase(registry);
    const loc = getLocationById(locationId) || { id: locationId, name: locationId };

    if (!c || !c.traces || !c.traces[locationId]) {
        return { resolved: false, found: false, message: t('Следов вора здесь нет.') };
    }

    q.footprintStates = q.footprintStates || {};
    q.footprintStates[locationId] = q.footprintStates[locationId] || {};
    const st = q.footprintStates[locationId];

    // Уже обследованный след повторно НЕ проверяется (без траты времени)
    if (st[fpId]) {
        if (st[fpId] === 'found') {
            const where = thiefWhereabouts(registry);
            const nowLoc = where ? getLocationById(where.locId) : null;
            const popup = nowLoc
                ? (where.heading
                    ? tf(t('📍 Вор сейчас на дороге к «{0}»!'), nowLoc.name)
                    : tf(t('📍 Вор сейчас где-то у «{0}»!'), nowLoc.name))
                : t('След ещё хранит отпечаток, но свежесть ушла.');
            return { resolved: true, found: true, alreadyChecked: true, message: popup };
        }
        return {
            resolved: true, found: false, alreadyChecked: true,
            message: t('Этот след ты уже затоптал — больше он ничего не скажет.'),
        };
    }

    const wasActive = isChaseActive(registry);
    // Раунд 31 (п.10): обследование следа занимает ровно 1 час —
    // вор тоже двигается (четыре шага за час)
    tickTime(registry, FOOTPRINT_EXAMINE_MINUTES);
    const nightNote = isNightCheck(registry) ? `\n(${t('Ночь: в темноте и следы читаются куда хуже.')})` : '';

    if (q.thiefEscaped) {
        return { resolved: false, found: false, thiefEscaped: true, message: t('Пока ты склонялся над следом, вор успел скрыться из вида...') };
    }
    if (!wasActive) {
        return { resolved: false, found: false, message: t('Погоня окончена — искать больше нечего.') };
    }

    // Вор стоит на локации — обследовать следы некогда, он рядом!
    if (isThiefAt(registry, locationId)) {
        registry.set('quest', q);
        return {
            resolved: false, found: false, thiefNearby: true,
            message: t('Следы свежайшие — трава ещё примята! Вор где-то совсем рядом, оглянись!'),
        };
    }

    const trace = c.traces[locationId];
    const player = registry.get('player');
    // Раунд 31 (п.4): ночью проверка Внимательности СЛОЖНЕЕ (штраф)
    const nightPenalty = isNightCheck(registry) ? NIGHT_SPOT_PENALTY : 0;
    const spotSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.spot) || 25, MIN_SPOT) - nightPenalty);
    const res = skillCheck(spotSkill);
    const success = res.result === 'critical' || res.result === 'success';

    if (success) {
        // УДАЧА: след «светится» и выдаёт местоположение вора (п.6)
        st[fpId] = 'found';
        // Раунд 32 (п.4): прочитанный след «прибивает» вора к его текущей
        // локации на 2 часа — даже если его счётчик уже обнулился
        pinThiefAtCurrentStop(registry, TRAIL_LOCK_HOURS, false);
        registry.set('quest', q);
        const where = thiefWhereabouts(registry);
        const nowLoc = where ? getLocationById(where.locId) : null;
        let message = nowLoc
            ? (where.heading
                ? tf(t('📍 ПОП-АП: вор сейчас на дороге к «{0}»!'), nowLoc.name)
                : tf(t('📍 ПОП-АП: вор сейчас где-то у «{0}»!'), nowLoc.name))
            : t('След прочитан, но человек он скрытный — куда подался, не разобрать.');
        message = message.replace('📍 ПОП-АП: ', '📍 ');
        if (trace.wentTo) {
            const next = getLocationById(trace.wentTo);
            message += '\n' + tf(t('Сам след ведёт в сторону «{0}».'), next ? next.name : trace.wentTo);
        }
        message += nightNote;
        ActionLog.add(registry, tf(t('Обследовал след в «{0}» — след прочитан (бросок {1}, успех{2}): вор у «{3}».'), t(loc.name), res.roll, nightPenalty ? t(', ночь') : '', t(nowLoc ? nowLoc.name : '?')));
        return { resolved: true, found: true, message, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
    }

    // НЕУДАЧА: след пропадает (п.5)
    st[fpId] = 'gone';
    registry.set('quest', q);
    ActionLog.add(registry, tf(t('Обследовал след в «{0}» — провал (бросок {1}{2}), след затёрт.'), t(loc.name), res.roll, nightPenalty ? t(', ночь') : ''));
    return {
        resolved: true, found: false,
        message: t('Ты пригляделся к следу, но неосторожно наступил — отпечаток затрётся и пропал. Больше этот след не обследовать.') + nightNote,
        turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
    };
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ
// ============================================================

/**
 * Инициализировать погоню. Вызывается при начале новой игры.
 * Вор выбирает маршрут из ТРЁХ случайных локаций и уже бежит из деревни.
 */
export function initThiefHunt(registry) {
    const quest = registry.get('quest') || {};

    // Маршрут: ТРИ РАЗНЫЕ локации в случайном порядке (раунд 22).
    // Раунд 39 (п.24): если вор решит бежать ЧЕРЕЗ ЛЕС — он обязан пройти
    // ВСЕ ТРИ лесные локации цепочкой (Опушка → Поляна → Густой лес),
    // и сбежать сможет только после срока ожидания в Густом лесу.
    const pool = [...CHASE_LOCATIONS];
    const picks = [];
    for (let i = 0; i < CHASE_STOPS; i++) {
        picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    let route;
    if (picks.some(id => FOREST_SEQUENCE.includes(id))) {
        // Лес в маршруте: НЕлесные остановки вперёд, затем ВСЯ лесная цепочка
        route = picks.filter(id => !FOREST_SEQUENCE.includes(id)).concat(FOREST_SEQUENCE);
    } else {
        route = picks;
    }
    // Раунд 39 (пп.22,25): срок ожидания на каждой остановке:
    // обычные локации 2–5 ч, лесные (Опушка/Поляна/Густой лес) 4–7 ч.
    const stays = route.map((id) => randomStayHoursFor(id));

    quest.chase = {
        route,
        phase: 'travel',       // 'travel' (в пути) | 'stay' (сидит на локации)
        stop: 0,               // индекс текущей остановки в route
        ticksLeft: START_TRAVEL_TICKS,
        // Раунд 39 (пп.22,25): 2–5 ч на обычных локациях, 4–7 ч в лесных
        stays,
        minutesAccum: 0,       // накопитель неполных тиков (часов)
        traces: {},            // { locId: { wentTo, side, leftAt, life } }
        hintLockHours: 0,      // раунд 32 (п.4): «заморозка» на 2/5 часов (сводная)
        hintLockFlee: false,   // раунд 32 (п.10): уйти ли принудительно по истечении
        npcLockHours: 0,       // раунд 35: заморозка наводки НПЦ (уход по истечении)
        traceLockHours: 0,     // раунд 35: заморозка прочитанного следа
        // Раунд 50 (п.7 заявки): пол вора выбирается СЛУЧАЙНО в начале игры —
        // от него зависят фигурка (Townfolk Skulker / Beggar) и слово «вор/воровка»
        gender: Math.random() < 0.5 ? 'male' : 'female',
    };
    // Раунд 31 (п.1): в лес — строго последовательно: Опушка → Поляна → Чаща
    // (раунд 39: маршрут уже строится цепочкой — перестановка идемпотентна)
    applyForestSequence(route);
    quest.thiefEscaped = false;
    quest.thiefDefeated = null;    // 'killed' | 'captured' | 'convinced'
    quest.stolenItemRecovered = false;
    quest.mainQuestDone = false;
    quest.runFinished = false;
    quest.turnsUsed = 0;
    quest.turnLimit = TURN_LIMIT;
    quest.cluesGathered = [];
    quest.locationsSearched = [];
    // Раунд 30: состояния отдельных следов ({ locId: { fp0: 'fresh'|'found'|'gone' } })
    // и случайные свидетели о воре (не менее трёх селян)
    quest.footprintStates = {};
    ensureWitnesses(registry);
    // Раунд 43 (п.3 заявки): в строке цели над деревней — ТОЛЬКО короткий статус;
    // полные описания и инструкции — в журнале «📋 Задания» и диалогах.
    quest.currentObjective = t('Найди и поймай вора!');
    registry.set('quest', quest);

    // Хук мирового времени: TimeSystem.tickTime вызывает его на каждый тик,
    // чтобы вор двигался синхронно с игровыми часами.
    registry.set('chaseTickHook', thiefChaseTick);

    ActionLog.init(registry);
    ActionLog.add(registry, t('Игра началась. Вор украл чудотворную икону и бежал из деревни в неизвестном направлении.'));

    return quest;
}

/** Активная погоня (или null, если она уже завершилась). */
export function getChase(registry) {
    const q = registry.get('quest');
    if (!q || !q.chase || q.thiefEscaped || q.thiefDefeated) return null;
    return q.chase;
}

export function isChaseActive(registry) {
    return !!getChase(registry);
}

/** Вор сейчас находится в этой локации (и игрок сразу же его увидит). */
export function isThiefAt(registry, locationId) {
    const c = getChase(registry);
    if (!c) return false;
    return c.phase === 'stay' && c.route[c.stop] === locationId;
}

/** Сколько тиков (действий) осталось до побега вора. */
export function chaseTicksLeft(registry) {
    const q = registry.get('quest');
    if (!q || !q.chase || q.thiefEscaped || q.thiefDefeated) return 0;
    const c = q.chase;
    let total = c.ticksLeft;
    if (c.phase === 'travel') total += c.stays[c.stop] || 0;
    for (let j = c.stop + 1; j < c.route.length; j++) {
        total += TRAVEL_TICKS + (c.stays[j] || 0);
    }
    return total;
}

/**
 * Раунд 58 (п.2 приказа владельца): ИНДИКАЦИЯ ВРЕМЕНИ ДО ПОБЕГА ВОРА.
 * Каждый тик погони = 1 игровой час (TICK_MINUTES = 60), поэтому
 * chaseTicksLeft — это ровно «сколько игровых часов осталось до того,
 * как вор покинет последнюю локацию и скроется». Сцены показывают это
 * счётчиком «⏳ До побега вора: ~N ч» (красный ≤3 ч, оранжевый ≤6 ч).
 */
export function chaseHoursLeft(registry) {
    return chaseTicksLeft(registry);
}

/** Где вор сейчас/куда направляется — для подсказок селян и следов. */
function thiefWhereabouts(registry) {
    const c = getChase(registry);
    if (!c) return null;
    return { locId: c.route[c.stop], heading: c.phase === 'travel' };
}

// ============================================================
// МИРОВОЕ ВРЕМЯ — ТИКИ ПОГОНИ
// ============================================================

/**
 * Мировой тик: вызывается из TimeSystem.tickTime на каждое изменение времени.
 * Раунд 32 (п.2): на каждый полный тик (60 ИГРОВЫХ минут = 1 час) вор ждёт
 * или перемещается РОВНО ОДИН РАЗ — не более одного шага в час.
 */
export function thiefChaseTick(registry, minutes) {
    const q = registry.get('quest');
    if (!q || !q.chase || q.thiefEscaped || q.thiefDefeated) return;
    // Раунд 31 (п.5): дождь/снег смывают следы, оставленные ДО осадков
    washTracksByWeather(registry);
    // Раунд 32 (п.9): следы старше 12–24 часов истёртись сами (если осадков не было)
    expireTracesByAge(registry);
    if (!q.chase || q.thiefEscaped || q.thiefDefeated) return;
    const c = q.chase;
    c.minutesAccum = (c.minutesAccum || 0) + minutes;
    let guard = 0;
    while (c.minutesAccum >= TICK_MINUTES && guard < 48) {
        c.minutesAccum -= TICK_MINUTES;
        thiefStep(registry, c);
        guard++;
        if (q.thiefEscaped || q.thiefDefeated) { c.minutesAccum = 0; break; }
    }
    registry.set('quest', q);
}

/**
 * Один шаг ИИ вора: ожидание на локации или переход к следующей.
 * Раунд 32 (п.4): пока активна «заморозка» (подсказка/след), вор НЕ двигается
 * вообще — счётчик его сидения тоже стоит; по истечении заморозки всё
 * продолжается как ни в чём не бывало (или, для наводки НПЦ, п.10 —
 * вор принудительно уходит в следующую локацию).
 */
function thiefStep(registry, c) {
    const q = registry.get('quest');

    // Раунд 32 (пп.4,10): «заморозка» от подсказки/следа — вор не двигается.
    // Раунд 35 (QA-фикс P2): у заморозок «наводка НПЦ» (5 ч, по истечении вор
    // принудительно уходит) и «прочитанный след» (2 ч, обычное продолжение)
    // теперь РАЗНЫЕ счётчики. Раньше обе жили в одной паре
    // hintLockHours/hintLockFlee, и поздний след перетирал флаг ухода активной
    // наводки — вор переставал уходить по истечении срока наводки (п.10).
    const npcLock = c.npcLockHours || 0;
    const traceLock = c.traceLockHours || 0;
    const effectiveLock = Math.max(npcLock, traceLock);
    if (effectiveLock > 0) {
        if (npcLock > 0) c.npcLockHours = npcLock - 1;
        if (traceLock > 0) c.traceLockHours = traceLock - 1;
        // легаси-поля отражают суммарную (эффективную) заморозку
        c.hintLockHours = Math.max(c.npcLockHours || 0, c.traceLockHours || 0);
        if (npcLock > 0 && npcLock - 1 === 0 && npcLock >= traceLock) {
            // Раунд 32 (п.10): срок наводки вышел — вор уходит в другую локацию
            if (c.phase === 'stay' && c.stop < c.route.length - 1) {
                thiefLeaveLocation(registry, c);
            }
        }
        registry.set('quest', q);
        return;
    }

    c.ticksLeft--;
    if (c.ticksLeft > 0) { registry.set('quest', q); return; }

    if (c.phase === 'travel') {
        // Вор добрался до своей текущей остановки и затаился
        c.phase = 'stay';
        c.ticksLeft = c.stays[c.stop] || randomStayHours();
    } else {
        thiefLeaveLocation(registry, c);
    }
    registry.set('quest', q);
}

/**
 * Вор уходит с текущей локации: оставляет следы в сторону следующей и
 * либо прячется на новой остановке, либо сбегает совсем.
 * (выделено из thiefStep; используется и при истечении наводки, п.10)
 */
function thiefLeaveLocation(registry, c) {
    const q = registry.get('quest');
    const fromId = c.route[c.stop];
    const nextId = c.route[c.stop + 1] || null;
    // Раунд 30 (п.3): сторона следов на Реке — ДО моста или ЗА мостом.
    // Раунд 31 (п.5): «возраст» следа (leftAt).
    // Раунд 32 (п.9): случайный срок жизни следа 12–24 часа (life).
    c.traces[fromId] = {
        wentTo: nextId,
        side: Math.random() < 0.5 ? 'before' : 'after',
        leftAt: worldMinutesOf(registry),
        life: randomTraceLifetime(),
    };
    // Раунд 32 (п.10): если наводка указывала на покидаемую локацию и её срок
    // ещё не вышел — наводка фактически сгорела (вор ушёл раньше срока)
    if (q.npcHint && q.npcHint.locId === fromId) q.npcHint.broken = true;
    c.stop++;
    if (c.stop >= c.route.length) {
        // После последней локации вор сбегает — проигрыш
        escapeThief(registry);
        return;
    }
    c.phase = 'travel';
    c.ticksLeft = TRAVEL_TICKS;
    const from = getLocationById(fromId);
    ActionLog.add(registry, tf(t('Вор покинул «{0}» и двинулся дальше.'), from ? from.name : fromId));
}

/** Вор сбежал из деревни с добычей — игра проиграна. */
export function escapeThief(registry) {
    const q = registry.get('quest');
    if (!q || !q.chase) return;
    const c = q.chase;
    const lastLoc = c.route[c.route.length - 1];
    if (lastLoc && !c.traces[lastLoc]) c.traces[lastLoc] = { wentTo: null, side: Math.random() < 0.5 ? 'before' : 'after', leftAt: worldMinutesOf(registry), life: randomTraceLifetime() };
    q.thiefEscaped = true;
    // Раунд 43 (п.2 заявки): квест окончен — баннер цели над деревней гаснет.
    q.currentObjective = '';
    ActionLog.add(registry, t('ПОРАЖЕНИЕ: вор покинул последнюю локацию и скрылся из вида. След ведёт за околицу.'));
    registry.set('quest', q);
}

// ============================================================
// ДЕЙСТВИЯ ИГРОКА (каждое тратит тик времени)
// ============================================================

/**
 * Поиск следов в локации (проверка «Внимательность»). Тратит 1 тик.
 * Раунд 22: обследовать следы в локации можно ТОЛЬКО ОДИН РАЗ:
 * - удачное обследование показывает, где вор находится ПРЯМО СЕЙЧАС;
 * - неудачное не даёт ничего — дальше придётся искать вора «вслепую»
 *   (об этом прямо сказано в тексте неудачи);
 * - если вора здесь не было — локация помечается обысканной (исключение варианта).
 */
export function searchLocation(registry, locationId) {
    let q = registry.get('quest');
    if (!q) q = {};
    if (!q.locationsSearched) q.locationsSearched = [];

    const loc = getLocationById(locationId) || { id: locationId, name: locationId };

    // Раунд 22: следы обследуются только единожды (до траты времени)
    if (q.locationsSearched.includes(locationId)) {
        return {
            found: false, alreadySearched: true,
            message: t('Ты уже обследовал следы здесь. Больше из них ничего не выжать — придётся искать вора в других местах.'),
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    const wasActive = isChaseActive(registry);

    // Раунд 31 (п.10): исследование следов занимает ровно 1 час — вор тоже двигается
    tickTime(registry, FOOTPRINT_EXAMINE_MINUTES);

    if (q.thiefEscaped) {
        return {
            found: false, alreadySearched: false,
            message: t('Пока ты осматривался, вор успел скрыться из вида...'),
            turnsLeft: 0, thiefEscaped: true,
        };
    }
    if (!wasActive) {
        return {
            found: false, alreadySearched: false,
            message: t('Погоня окончена — искать больше нечего.'),
            turnsLeft: 0, thiefEscaped: false,
        };
    }

    const c = q.chase;

    // 1) Вор здесь прямо сейчас
    if (isThiefAt(registry, locationId)) {
        if (!q.locationsSearched.includes(locationId)) q.locationsSearched.push(locationId);
        registry.set('quest', q);
        ActionLog.add(registry, tf(t('Поиск следов в «{0}» — вор рядом!'), t(loc.name)));
        return {
            found: false, alreadySearched: false, thiefNearby: true,
            message: t('Следы свежайшие — трава ещё примята! Вор где-то совсем рядом, оглянись!'),
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    // 2) Вор был здесь и ушёл — остались следы
    const trace = c.traces ? c.traces[locationId] : null;
    const player = registry.get('player');
    // Раунд 22: нижний порог Внимательности + благословение (+10, одна проверка)
    // Раунд 31 (п.4): ночью проверка СЛОЖНЕЕ (штраф к Внимательности)
    const nightPenaltyS = isNightCheck(registry) ? NIGHT_SPOT_PENALTY : 0;
    const spotSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.spot) || 25, MIN_SPOT) - nightPenaltyS);

    if (trace) {
        const res = skillCheck(spotSkill);
        // Следы разбираются ОДИН раз — неудача закрывает эту локацию навсегда
        if (!q.locationsSearched.includes(locationId)) q.locationsSearched.push(locationId);
        if (res.result === 'critical' || res.result === 'success') {
            // Раунд 32 (п.4): прочитанный след «прибивает» вора на 2 часа
            pinThiefAtCurrentStop(registry, TRAIL_LOCK_HOURS, false);
        }
        registry.set('quest', q);

        if (res.result === 'critical' || res.result === 'success') {
            // Удача: видно и направление следов, и где вор сейчас
            const where = thiefWhereabouts(registry);
            const nowLoc = where ? getLocationById(where.locId) : null;
            let message;
            if (trace.wentTo) {
                const next = getLocationById(trace.wentTo);
                message = tf(t('Вор был здесь! Следы ведут в сторону «{0}».'), next ? next.name : trace.wentTo);
            } else {
                message = t('Следы вора здесь обрываются: он уходил прочь из деревни широкими шагами бегуна.');
            }
            if (nowLoc) {
                message += where.heading
                    ? ' ' + tf(t('По свежести примятой травы ясно: вор сейчас на дороге к «{0}»!'), nowLoc.name)
                    : ' ' + tf(t('Судя по свежести следов, вор сейчас где-то у «{0}»!'), nowLoc.name);
            }
            ActionLog.add(registry, tf(t('Поиск следов в «{0}» — следы прочитаны (бросок {1}, успех{2}).'), t(loc.name), res.roll, nightPenaltyS ? t(', ночь') : ''));
            return { found: true, direction: trace.wentTo, message, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
        }
        ActionLog.add(registry, tf(t('Поиск следов в «{0}» — провал (бросок {1}, следы были, но не разобраны).'), t(loc.name), res.roll));
        return {
            found: false, alreadySearched: false,
            message: t('Кто-то здесь проходил — видны примятые травы, но разобрать следы не вышло. Больше следы здесь не обследовать: придётся искать вора ВСЛЕПУЮ — обходить локации или расспрашивать других селян.'),
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    // 3) Вор здесь не проходил
    if (!q.locationsSearched.includes(locationId)) q.locationsSearched.push(locationId);
    registry.set('quest', q);
    ActionLog.add(registry, tf(t('Поиск следов в «{0}» — следов нет.'), t(loc.name)));
    return {
        found: false, alreadySearched: true,
        message: t('Ты тщательно осмотрел местность — свежих следов вора здесь нет. Видимо, он пошёл другой дорогой.'),
        turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
    };
}

/**
 * Раунд 47 (п.2 заявки): НАСЛЕДОВАНИЕ ЗНАНИЯ О ВОРЕ.
 * «Наводка на вора не наследуется, а пропадает» — было: кузнец дал наводку,
 * игрок его убил, ученик отказывался говорить («уже всё рассказал») — и
 * знание мастера пропадало навсегда. Теперь: смерть кузнеца передаёт его
 * ЗНАНИЕ живому ученику — мастер уже не расскажет, но ученик расскажет сам
 * (мастер убирается из списка «уже расспрашивали», ученик становится
 * полноправным носителем свидетельства).
 * Вызывается перед показом опции «Спросить про вора» и перед askNPC.
 *
 * @returns {boolean} true — наследование выполнено (мастер убран из списка)
 */
export function inheritThiefKnowledge(registry) {
    const q = registry.get('quest') || {};
    if (!q.thiefAskedFrom || !q.thiefAskedFrom.includes('blacksmith')) return false;
    // Ученик УЖЕ рассказывал своё — наследование состоялось раньше,
    // второй раз оно не открывается
    if (q.thiefAskedFrom.includes('apprentice')) return false;
    if (!isNpcKilled(registry, 'blacksmith')) return false; // мастер жив — сам расскажет
    // Ученик должен быть жив и стоять у горна
    const app = findNpc(registry, 'apprentice');
    if (!app || isNpcKilled(registry, 'apprentice')) return false;
    q.thiefAskedFrom = q.thiefAskedFrom.filter(id => id !== 'blacksmith');
    registry.set('quest', q);
    ActionLog.add(registry, t('Знание кузнеца не пропало с ним: его ученик видел то же, что и мастер.'));
    return true;
}

/**
 * Расспросить жителя о воре.
 * Раунд 31: час за разговор списывается при закрытии диалога (пп.11,12).
 * Раунд 22: КАЖДЫЙ селянин расспрашивается ТОЛЬКО ОДИН РАЗ — повторный
 * запрос к нему невозможен, за наводками нужно идти к другим людям.
 * Раунд 30 (пп.7,9 спецификации владельца): рассказать о воре и месте его
 * нахождения могут только СВИДЕТЕЛИ — 3–5 случайных селян, выбираемых на
 * старте игры. Свидетель выдаёт место вора; остальные честно говорят,
 * что не видели (не все могли видеть вора). Подсказка даётся ЕДИНожды:
 * второй раз строчки диалога про вора у этого NPC не появляется.
 */
export function askNPC(registry, npcId, npcName) {
    const who = talkerName(registry, npcId, npcName); // раунд 41: динамическое имя
    const q = registry.get('quest');
    if (!q) {
        return { gotClue: false, message: '...', turnsLeft: 0, thiefEscaped: false };
    }

    // Раунд 46 (п.1 заявки): УЧЕНИК КУЗНЕЦА наследует знания мастера —
    // если кузнец был свидетелем вора, ученик «видел то же самое» (и
    // память у них общая: мастера уже спросили → ученик не повторяет).
    const isApprentice = (npcId === 'apprentice');
    const witnessId = isApprentice ? 'blacksmith' : npcId;

    // Раунд 47 (п.2 заявки): наводка НАСЛЕДУЕТСЯ, а не пропадает.
    // Если мастера уже расспрашивали, а теперь его нет в живых — его
    // знание переходит к ученику: спрашиваем ученика как НОВОГО свидетеля.
    if (isApprentice) {
        inheritThiefKnowledge(registry);
        // перечитываем quest после возможной правки thiefAskedFrom
        const qFresh = registry.get('quest');
        if (qFresh) Object.assign(q, qFresh);
    }

    // Раунд 47: «уже рассказывал» — по СОБСТВЕННОЙ записи рассказчика
    // (мастер — 'blacksmith', ученик — 'apprentice'), а не по общему ключу:
    // иначе ответ ученика снова открывал бы память убитого мастера.
    const askedId = isApprentice ? 'apprentice' : npcId;

    // Раунд 44 (п.6 владельца): ДЕТИ не выдают наводок — вежливо отнекиваются,
    // попытка расспроса НЕ расходуется (в thiefAskedFrom не пишем).
    const childNpc = findNpc(registry, npcId);
    if (childNpc && typeof childNpc.age === 'number' && childNpc.age < 18) {
        return {
            gotClue: false, child: true,
            message: `${who}: «${t('Я маленький ещё, я не видал никакого вора. Дядька, не гоняй меня!')}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    // Раунд 22: повторный расспрос того же NPC невозможен (без траты времени).
    // Раунд 47: запись — по СОБСТВЕННОМУ ключу рассказчика (askedId).
    // Пока МАСТЕР ЖИВ и уже рассказывал — ученик «покрыт» его ответом
    // (стоят рядом у горна, ведали одно); после смерти мастера знание
    // наследуется и ученик отвечает по собственной записи.
    if (!q.thiefAskedFrom) q.thiefAskedFrom = [];
    const masterCoversApprentice = isApprentice
        && !isNpcKilled(registry, 'blacksmith')
        && q.thiefAskedFrom.includes('blacksmith');
    if (q.thiefAskedFrom.includes(askedId) || masterCoversApprentice) {
        return {
            gotClue: false, alreadyAsked: true,
            message: `${who}: «${t('Я уже всё тебе рассказал. Больше не знаю ничего — спроси у других людей.')}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }
    q.thiefAskedFrom.push(askedId);
    registry.set('quest', q);

    // Раунд 31 (пп.11,12): час за разговор списывается при ЗАКРЫТИИ диалога
    // (chargeTalkTime в ui.js/DialogueRunner) — здесь время больше не тратим.

    const c = q.chase;
    if (!c || q.thiefDefeated) {
        const msg = q.thiefDefeated
            ? t('Слава Богу, ворюгу изловили! Дай Бог тебе удачи, сыщик.')
            : t('Не видел я никакого вора. Спроси кого другого, путник.');
        return {
            gotClue: false,
            message: `${who}: «${msg}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    if (!q.cluesGathered) q.cluesGathered = [];
    let gotClue = false;
    let message = '';

    // Раунд 30: видел ли этот селянин вора — решено случайно на старте игры.
    // Раунд 46: ученик кузнеца наследует свидетательство мастера.
    const witness = isThiefWitness(registry, witnessId);

    if (witness) {
        // Свидетель выдаёт ТЕКУЩЕЕ местоположение вора (п.9)
        gotClue = true;
        const where = thiefWhereabouts(registry);
        const loc = where ? getLocationById(where.locId) : null;
        // Раунд 32 (пп.4,10): наводка «прибивает» вора к указанной локации
        // (2 часа гарантии, п.4) и действительна 5 игровых часов (п.10) —
        // когда срок выйдет, вор уйдёт в другую локацию.
        const pinnedLoc = pinThiefAtCurrentStop(registry, NPC_HINT_VALID_HOURS, true);
        q.npcHint = {
            locId: pinnedLoc || (where ? where.locId : null),
            issuedAtMin: worldMinutesOf(registry),
            expiresAtMin: worldMinutesOf(registry) + NPC_HINT_VALID_HOURS * 60,
            popupShown: false,
            broken: false,
        };
        const clueText = loc
            ? (where.heading
                ? tf(t('Видел я его, темного человека! Он бежит к «{0}» — поспеши, догонешь!'), loc.name)
                : tf(t('Видел я его, темного человека! Он сейчас прячется у «{0}» — поспеши!'), loc.name))
            : t('Видел я вора, да куда он подался — не ведаю.');
        // Раунд 41: в улике храним динамическое имя (панель «Улики от жителей»)
        q.cluesGathered.push({ npcId, npcName: who, clue: clueText, whereClue: true });
        message = `${who}: «${clueText}»`;
        ActionLog.add(registry, tf(t('Расспрос {0} о воре — СВИДЕТЕЛЬ: {1}.'), who, clueText));
    } else {
        // Не все могли видеть вора — этот селянин ничего не знает
        const notSeen = [
            t('Не видел я никакого вора. Спроси кого другого, путник.'),
            t('Вор? Здесь не пробегал. Я бы заметил — весь день на виду был.'),
            t('Темных людей не видал, батиушко упаси. Может, в другой стороне ищешь?'),
        ];
        message = `${who}: «${notSeen[Math.floor(Math.random() * notSeen.length)]}»`;
        ActionLog.add(registry, tf(t('Расспрос {0} о воре — не свидетель, ничего не знает.'), who));
    }

    registry.set('quest', q);
    return { gotClue, message, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
}

/**
 * Попросить денег у NPC. Одноразовое действие для каждого NPC.
 * Разговор занимает время (1 тик) — вор тоже двигается.
 */
export function askMoneyForHelp(registry, npcId, npcName) {
    const who = talkerName(registry, npcId, npcName); // раунд 41: динамическое имя
    const q = registry.get('quest');
    if (!q) return { success: false, amount: 0, message: '...', turnsLeft: 0, thiefEscaped: false };

    if (!q.moneyAskedFrom) q.moneyAskedFrom = [];
    if (q.moneyAskedFrom.includes(npcId)) {
        return {
            success: false, alreadyAsked: true,
            message: `${who}: «${t('Я уже помог тебе, чем мог. Больше не дам.')}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }
    q.moneyAskedFrom.push(npcId);

    // Раунд 31: час за разговор списывается при закрытии диалога (п.11)

    // Модификатор щедрости по роли NPC
    const npcGenerosity = {
        elder: 1.5, priest: 0.7, blacksmith: 0.8, tavernkeeper: 1.0,
        peasant1: 0.4, widow: 0.3,
    }[npcId] || 0.5;

    const player = registry.get('player');
    // Раунд 48 (п.4 заявки): проверка «НАВЫК ПРОТИВ НАВЫКА» — Убеждение игрока
    // против Убеждения жителя (без навыка — Обаяние против Обаяния) +
    // сложность 10 (просить денег труднее, чем просто говорить).
    const persuadeSkill = consumeBlessing(registry, (player.skills && player.skills.persuade) || 20);
    const opp = getNpcOpposition(findNpc(registry, npcId), 'persuade');
    const res = opposedSkillCheck(persuadeSkill, opp.value, 10);
    const checkLine = formatOpposedCheck(res, 'Убеждение', `${opp.ruNameGen} жителя`);

    let success = false;
    let amount = 0;
    let message = '';

    if (res.result === 'critical') {
        amount = Math.round((15 + Math.floor(Math.random() * 15)) * npcGenerosity * 2);
        success = true;
        message = `${who}: «${t('Возьми, путник, чем богат. Помоги тебе Господь!')}» (+${amount} д.)`;
        ActionLog.add(registry, tf(t('Просил денег у {0} — КРИТИЧЕСКИЙ успех, получено {1} д. ({2}).'), who, amount, checkLine));
    } else if (res.result === 'success') {
        amount = Math.round((5 + Math.floor(Math.random() * 15)) * npcGenerosity);
        success = true;
        message = `${who}: «${t('Вот тебе немного денег на дорогу.')}» (+${amount} д.)`;
        ActionLog.add(registry, tf(t('Просил денег у {0} — успех, получено {1} д. ({2}).'), who, amount, checkLine));
    } else if (res.result === 'fumble') {
        message = `${who}: «${t('Попрошайка! Уходи, не позорься!')}» (${t('Больше не даст.')})`;
        ActionLog.add(registry, tf(t('Просил денег у {0} — FUMBLE, ничего не получено ({1}).'), who, checkLine));
    } else {
        message = `${who}: «${t('Нет у меня лишних денег, сам перебиваюсь.')}»`;
        ActionLog.add(registry, tf(t('Просил денег у {0} — провал, ничего не получено ({1}).'), who, checkLine));
    }

    if (success) {
        player.dengas = (player.dengas || 0) + amount;
        registry.set('player', player);
    }

    // Штраф репутации за попрошайничество
    const repPenalty = applyBeggingPenalty(registry, npcId);
    if (repPenalty < 0) {
        message += ` (${t('репутация упала на')} ${Math.abs(repPenalty)})`;
    }

    registry.set('quest', q);
    return { success, amount, message, checkLine, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
}

/** Задаток от старосты (легаси-обёртка). */
export function askElderAdvance(registry) {
    return askMoneyForHelp(registry, 'elder', 'Староста Мирослав');
}

// ============================================================
// ВСТРЕЧА С ВОРОМ (напасть / оглушить / убедить)
// ============================================================

/**
 * Показать встречу с вором в сцене локации.
 * Вор отображается спрайтом; диалог предлагает 4 варианта действий.
 * @param {Phaser.Scene} scene — LocationScene или ApiaryScene
 * @param {string} locationId — текущая локация
 * @param {Object} opts — { x, y } мировые координаты спрайта вора
 */
export function presentThiefEncounter(scene, locationId, opts = {}) {
    const registry = scene.registry;
    if (!isThiefAt(registry, locationId)) return null;
    if (scene.busyDialog) return null;
    scene.busyDialog = true;

    const { width, height } = scene.scale;
    // Раунд 33: вор стоит В ПРАВОЙ свободной зоне (панель диалога занимает
    // ~26–73% ширины по центру — раньше фигурка пряталась за ней).
    const x = (opts.x !== undefined) ? opts.x : width * 0.83;
    const y = (opts.y !== undefined) ? opts.y : height * 0.40;
    // Раунд 33 (владелец): у вора — УНИКАЛЬНАЯ фигурка (капюшон, серый плащ,
    // кинжал), а не общий «крестьянин», как у игрока. Рисуем ОДИН кадр листа
    // (раньше add.image показывал всю сетку 4×4), профиль ВЛЕВО — на игрока.
    // Раунд 50 (п.7 заявки): фигурка зависит от СЛУЧАЙНОГО пола вора —
    // мужской (Townfolk Skulker) или женский (Townfolk Beggar).
    const texKey = scene.textures.exists(getThiefSpriteKey(registry)) ? getThiefSpriteKey(registry)
        : (scene.textures.exists('enemy_thief') ? 'enemy_thief'
            : (scene.textures.exists('enemy_bandit') ? 'enemy_bandit' : 'knight_idle'));
    // кадр 4 = строка 1 (профиль влево), колонка 0 (стойка)
    const thiefFrame = (texKey === 'knight_idle') ? 0 : 4;
    const sprite = scene.add.sprite(x, y, texKey, thiefFrame).setScale(2.6).setDepth(60);
    scene.tweens.add({
        targets: sprite,
        y: y - 4,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const finish = (fn) => () => {
        scene.busyDialog = false;
        try { sprite.destroy(); } catch (e) { /* уже уничтожен */ }
        if (fn) fn();
    };

    // Показать исход убеждения/оглушения
    const showOutcome = (result, howLabel) => {
        ActionLog.add(registry, howLabel);
        if (result.thiefEscaped) {
            // Последний шанс упущен — вор сбежал
            createDialog(scene, t('🏃 Вор скрылся!'), result.message, [
                { text: t('Итоги похода'), callback: () => scene.scene.start('End') },
            ], { singleton: false, portraitKey: 'portrait_thief', typing: true, typingSpeed: 25 });
            return;
        }
        if (result.success) {
            try { sprite.destroy(); } catch (e) { /* ок */ }
            createDialog(scene, t('🏆 Святыня у тебя!'), result.message, [
                { text: t('Продолжить'), callback: () => { scene.busyDialog = false; } },
            ], { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
            return;
        }
        // Вор вырвался и бежит — остаёмся в локации
        createDialog(scene, t('💨 Вор вырвался!'), result.message, [
            { text: t('Продолжить'), callback: () => { scene.busyDialog = false; } },
        ], { singleton: false, portraitKey: 'portrait_thief', typing: true, typingSpeed: 25 });
    };

    const noun = thiefNounInstr(registry);
    const female = getThiefGender(registry) === 'female';
    const intro = female
        ? 'Воровка в тёмном плаще сжимает краденую икону. Она тебя заметила!'
        : 'Вор в тёмном плаще сжимает краденую икону. Он тебя заметил!';
    createDialog(scene, tf(t('😱 Встреча с {0}!'), noun),
        intro + t(' Можно напасть, убедить отдать краденое (проверка Убеждения) или подкрасться и оглушить (проверка Драки).'),
        [
            {
                text: t('⚔ Напасть'),
                callback: finish(() => {
                    ActionLog.add(registry, t('Напал на вора в его убежище.'));
                    // Раунд 40 (QA-фикс): scene.start вызывался ИЗ колбэка клика
                    // поверх активного диалога/твинов — фаза обновления Phaser
                    // коррумпировалась и игровой цикл зависал (воспроизведено
                    // agent-browser 3/3 раза). Переход переносится на СЛЕДУЮЩИЙ
                    // кадр, вне стека обработчика ввода.
                    scene.time.delayedCall(0, () => {
                        scene.scene.start('Combat', { enemyKeys: ['thief'], npcId: 'thief', fromLocation: locationId });
                    });
                }),
            },
            {
                text: t('🤝 Убедить'),
                callback: finish(() => showOutcome(persuadeThief(registry), 'Пытался убедить вора вернуть икону.')),
            },
            {
                text: t('🌑 Оглушить'),
                callback: finish(() => showOutcome(stunThief(registry), 'Пытался оглушить вора и взять его в плен.')),
            },
            {
                text: t('◀ Отступить'),
                callback: () => { scene.busyDialog = false; },
            },
        ],
        { singleton: false, portraitKey: 'portrait_thief', typing: true, typingSpeed: 25 });

    return sprite;
}

/**
 * Убедить вора вернуть украденное (проверка «Убеждения»).
 * Успех: вор отдаёт икону и сбегает — тоже победа (по спецификации).
 * Провал: вор бросается бежать (с первой локации — в следующую,
 * со второй — сбегает навсегда).
 */
export function persuadeThief(registry) {
    const q = registry.get('quest');
    const c = getChase(registry);
    if (!c) return { success: false, message: t('Погоня окончена.'), thiefEscaped: !!q.thiefEscaped };

    const player = registry.get('player');
    // Раунд 22: нижний порог Убеждения + благословение (+10, одна проверка)
    // Раунд 47 (п.4 заявки): ВСТРЕЧНАЯ проверка — Убеждение игрока против
    // ТАКОГО ЖЕ параметра вора (болтливый наёмник: 50) + сложность 10
    // (на равных с вором; раунд 48: «навык против навыка», без сопротивлений).
    const persuadeSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.persuade) || 20, MIN_PERSUADE));
    const res = opposedSkillCheck(persuadeSkill, 50, 10);
    const checkLine = formatOpposedCheck(res, 'Убеждение', 'Болтовни вора');

    if (res.result === 'critical' || res.result === 'success') {
        recoverStolenItem(registry, 'convinced', res);
        return {
            success: true,
            message: t('Вор, помявшись, опускает икону в траву: «Ладно! Пронеси тебя Бог, сыщик!» — и растворяется в чаще. Икона цела! Отнеси её старосте или батюшке.') +
                ` (${checkLine})`,
            thiefEscaped: false,
        };
    }

    // Провал убеждения — вор паникует и бежит
    const fled = thiefFleesNow(registry);
    ActionLog.add(registry, tf(t('Убеждение не подействовало ({0}){1}'), checkLine, fled.escaped ? t(' — вор скрылся!') : t(' — вор пустился наутёк!')));
    return {
        success: false,
        message: fled.escaped
            ? t('«Не на того напал, сыщик!» — хохочет вор и исчезает меж деревьев. Это была твоя последняя возможность...')
            : t('«Не на того напал!» — вор швыряет в тебя ком земли и пускается наутёк. Успей прочесть его следы!'),
        thiefEscaped: fled.escaped,
    };
}

/**
 * Подкрасться и оглушить вора (проверка «Драки»).
 * Успех: вор пленён, икона возвращена — победа.
 * Провал: вор вырывается и бежит (со второй локации — сбегает навсегда).
 */
export function stunThief(registry) {
    const q = registry.get('quest');
    const c = getChase(registry);
    if (!c) return { success: false, message: t('Погоня окончена.'), thiefEscaped: !!q.thiefEscaped };

    const player = registry.get('player');
    // Раунд 22: нижний порог Драки + благословение (+10, одна проверка)
    // Раунд 47 (п.4 заявки): ВСТРЕЧНАЯ проверка — Драка игрока против
    // ТАКОГО ЖЕ параметра вора (Рукопашная вора = его навык атаки 50).
    const brawlSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.brawl) || 25, MIN_BRAWL));
    const res = opposedSkillCheck(brawlSkill, 50, 0);
    const checkLine = formatOpposedCheck(res, 'Рукопашная', 'Рукопашной вора');

    if (res.result === 'critical' || res.result === 'success') {
        recoverStolenItem(registry, 'captured', res);
        const crit = res.result === 'critical';
        return {
            success: true,
            message: (crit
                ? t('Одним точным ударом в висок ты срубишь вора с ног и накрепко связываешь его. Икона в киоте невредима!')
                : t('Ты догоняешь вора и оглушаешь его ударом в затылок. Вор связан — его ждёт суд старосты, а икона снова цела!'))
                + ` (${checkLine})`,
            thiefEscaped: false,
        };
    }

    const fled = thiefFleesNow(registry);
    ActionLog.add(registry, tf(t('Оглушить вора не вышло ({0}){1}'), checkLine, fled.escaped ? t(' — вор скрылся!') : t(' — вор пустился наутёк!')));
    return {
        success: false,
        message: fled.escaped
            ? t('Ты наступил на сухую ветку — вор обернулся и скрылся во мраке. Это была твоя последняя возможность...')
            : t('Вор оказался проворнее: увернулся от захвата и пустился наутёк. Успей прочесть его следы!'),
        thiefEscaped: fled.escaped,
    };
}

/**
 * Вор в панике бежит немедленно (провал убеждения/оглушения).
 * С текущей остановки — к следующей; с последней — прочь (поражение).
 */
function thiefFleesNow(registry) {
    const q = registry.get('quest');
    const c = q.chase;
    if (!c) return { escaped: true };
    if (c.stop >= c.route.length - 1) {
        escapeThief(registry);
        return { escaped: true };
    }
    // Немедленно в путь к следующей остановке
    const fromId = c.route[c.stop];
    c.traces[fromId] = { wentTo: c.route[c.stop + 1], side: Math.random() < 0.5 ? 'before' : 'after', leftAt: worldMinutesOf(registry), life: randomTraceLifetime() };
    c.stop++;
    c.phase = 'travel';
    c.ticksLeft = TRAVEL_TICKS;
    registry.set('quest', q);
    return { escaped: false };
}

/**
 * Раунд 32 (пп.4,10): «ПРИБИТЬ» вора к его текущей остановке.
 * hours — на сколько часов он гарантированно остаётся там, куда ведёт
 * подсказка или след (п.4: «даже если счётчик перемещения уже обнулился»);
 * forceFlee — уйти ли принудительно по истечении срока (наводка НПЦ, п.10:
 * «потом вор убегает в другую локацию»). Если вор сейчас в пути, он
 * немедленно «добирается» до остановки — наводка всегда указывает верно.
 * Возвращает id локации, к которой прибит вор (или null).
 */
export function pinThiefAtCurrentStop(registry, hours, forceFlee) {
    const q = registry.get('quest');
    const c = getChase(registry);
    if (!c) return null;
    if (c.phase === 'travel') {
        c.phase = 'stay';
        c.ticksLeft = c.stays[c.stop] || randomStayHours();
    }
    // Раунд 35 (QA-фикс P2): раздельные заморозки для наводки (forceFlee=true,
    // уход по истечении) и следа (forceFlee=false); легаси-пара
    // hintLockHours/hintLockFlee остаётся как сводное отражение для UI/сейвов.
    if (forceFlee) {
        c.npcLockHours = Math.max(c.npcLockHours || 0, hours);
    } else {
        c.traceLockHours = Math.max(c.traceLockHours || 0, hours);
    }
    c.hintLockHours = Math.max(c.npcLockHours || 0, c.traceLockHours || 0);
    c.hintLockFlee = !!forceFlee;
    registry.set('quest', q);
    return c.route[c.stop];
}

// ============================================================
// РАУНД 32 (п.11): HP ВОРА МЕЖДУ БОЯМИ — вор не лечится
// ============================================================

/** Сохранить текущий HP вора (после прерванного боя). */
export function saveThiefHp(registry, hp) {
    const q = registry.get('quest') || {};
    q.thiefHp = Math.max(1, Math.round(hp));
    registry.set('quest', q);
}

/** Восстановить сохранённый HP вора (или null — бой «с чистого листа»). */
export function restoreThiefHp(registry, fullHp) {
    const q = registry.get('quest') || {};
    if (typeof q.thiefHp !== 'number') return null;
    return Math.max(1, Math.min(fullHp, q.thiefHp));
}

/** Сбросить сохранённый HP (вор повержен или погоня окончена). */
export function clearThiefHp(registry) {
    const q = registry.get('quest') || {};
    delete q.thiefHp;
    registry.set('quest', q);
}

/**
 * Раунд 32 (пп.11,13): игрок СБЕЖАЛ из боя с вором.
 *  п.11 — вор НЕ лечится: текущий запас его HP сохраняется в quest.thiefHp
 *         и восстанавливается при следующем бое (см. CombatScene);
 *  п.13 — вор ЕЩЁ 3 ЧАСА сидит на ЭТОЙ ЖЕ локации, а потом снова убегает
 *         ПО ОБЫЧНЫМ ПРАВИЛАМ (один шаг в час, следы, следующая остановка).
 * (раньше вор сразу перебегал в случайную локацию — по п.13 он больше не
 * срывается с места: игрок знает, где он, но повторный вход стоит часа).
 */
export function thiefFleesFromFight(registry, fromLocationId) {
    const q = registry.get('quest');
    const c = getChase(registry);
    if (!c) return false;

    // Раунд 32 (п.13): ровно 3 часа на текущей локации, дальше — обычные правила
    c.phase = 'stay';
    c.stays[c.stop] = c.stays[c.stop] || randomStayHours();
    c.ticksLeft = POST_FIGHT_STAY_HOURS;
    // «Заморозки» от старых подсказок больше не действуют — теперь вора
    // держит на месте срок из п.13
    c.hintLockHours = 0;
    c.hintLockFlee = false;
    c.npcLockHours = 0;
    c.traceLockHours = 0;
    void fromLocationId;

    ActionLog.add(registry, t('Вор затаился на месте — уйдёт не раньше, чем через три часа. Но и раны его не заживали: сил у него меньше, чем было.'));
    registry.set('quest', q);
    return true;
}

/**
 * Получить украденный предмет (икону). how: 'killed' | 'captured' | 'convinced'.
 * Погоня завершена победой, но игра ПРОДОЛЖАЕТСЯ: предмет нужно вернуть
 * старосте или священнику, чтобы получить награду.
 */
export function recoverStolenItem(registry, how, res) {
    const q = registry.get('quest');
    const player = registry.get('player');
    q.thiefDefeated = how;
    q.stolenItemRecovered = true;
    q.currentObjective = t('Икона у тебя! Верни её старосте или священнику в деревне.');
    clearThiefHp(registry); // раунд 32 (п.11): сохранённый HP больше не нужен
    delete q.npcHint;       // раунд 32 (п.10): наводка больше не нужна

    // Икона — в инвентарь
    if (!player.inventory) player.inventory = [];
    const existing = player.inventory.find(i => i.id === 'icon');
    if (existing) existing.count += 1;
    else player.inventory.push({ id: 'icon', name: t('Чудотворная икона'), count: 1, type: 'quest' });
    registry.set('player', player);

    const howText = how === 'killed' ? t('Вор повержен в бою')
        : how === 'captured' ? t('Вор оглушён и взят в плен')
        : t('Вор сам вернул украденное');
    const rollText = res ? ` (бросок ${res.roll})` : '';
    ActionLog.add(registry, `${t('ПОБЕДА:')} ${howText}. ${t('Чудотворная икона у тебя!')} ${rollText}`);
    registry.set('quest', q);
}

/**
 * Вернуть икону старосте ('elder') или священнику ('priest') — награда.
 * Игра продолжается: после победы староста и жители дают процедурные задания.
 */
export function surrenderStolenItem(registry, npcId) {
    const q = registry.get('quest');
    const player = registry.get('player');
    if (!q.stolenItemRecovered || q.mainQuestDone) {
        return { success: false, rewardText: '', message: t('Икона уже возвращена деревне.') };
    }

    // Икона уходит из инвентаря
    player.inventory = (player.inventory || []).filter(i => i.id !== 'icon');

    let rewardText;
    if (npcId === 'priest') {
        const amount = 20 + Math.floor(Math.random() * 11);
        player.dengas = (player.dengas || 0) + amount;
        player.HP = player.HPmax;
        player.MP = player.MPmax;
        rewardText = `${formatMoney(amount)} + ${t('благословение (полное восстановление)')}`;
    } else {
        const amount = 40 + Math.floor(Math.random() * 21);
        player.dengas = (player.dengas || 0) + amount;
        rewardText = formatMoney(amount);
    }
    changeVillageRep(registry, 10, t('Вернул украденную икону'));

    // Раунд 22: главный квест из разговоров (icon_return/thief_catch) тоже закрыт
    if (q.activeQuests) {
        q.activeQuests.forEach(aq => {
            if (aq.isMainQuest && !aq.completed) {
                aq.completed = true;
                aq.rewardClaimed = true; // награда уже выдана здесь (деньги/лечение)
            }
        });
    }

    q.mainQuestDone = true;
    // Раунд 43 (п.2 заявки): после сдачи иконы надпись о задании по поиску
    // вора вверху над деревней ПРОПАДАЕТ (тексты поручений — в «📋 Задания»). 
    q.currentObjective = '';
    ActionLog.add(registry, `${t('ПОБЕДА: чудотворная икона возвращена деревне!')} ${t('Награда')}: ${rewardText}.`);
    registry.set('player', player);
    registry.set('quest', q);

    return { success: true, rewardText };
}

// ============================================================
// КОНЕЦ ИГРЫ И СОСТОЯНИЕ ДЛЯ UI
// ============================================================

/**
 * Проверить, не пора ли закончить поход.
 * 'victory' — только когда игрок сам завершил поход после победы
 * (q.runFinished), иначе игра продолжается (процедурные задания).
 */
export function checkGameEnd(registry) {
    const q = registry.get('quest');
    if (!q) return null;
    // Раунд 46 (п.2): убийство старосты — немедленный Проигрыш (высший приоритет)
    if (q.elderMurdered) return 'defeat_elder_murdered';
    // Раунд 45 (п.2): изгнание из деревни — отдельный исход Проигрыша
    // (ставится только при репутации −100)
    if (q.expelledFromVillage) return 'defeat_expelled';
    if (q.heroDead) return 'defeat_hero_dead';
    if (q.thiefEscaped) return 'defeat_thief_escaped';
    if (q.runFinished && q.thiefDefeated) return 'victory';
    return null;
}

/** Состояние погони для HUD/финальных окон. */
export function getHuntState(registry) {
    const q = registry.get('quest') || {};
    const ticks = chaseTicksLeft(registry);
    return {
        active: isChaseActive(registry),
        stage: q.chase ? q.chase.stage : null,
        route: q.chase ? [...q.chase.route] : [],
        ticksLeft: ticks,
        turnsLeft: ticks, // совместимость со старым HUD
        thiefEscaped: !!q.thiefEscaped,
        thiefDefeated: q.thiefDefeated || null,
        stolenItemRecovered: !!q.stolenItemRecovered,
        mainQuestDone: !!q.mainQuestDone,
        cluesGathered: q.cluesGathered || [],
        locationsSearched: q.locationsSearched || [],
        askedFrom: q.thiefAskedFrom || [],   // раунд 22: кого уже расспрашивали
        blessing: !!q.blessing,              // раунд 22: есть благословение
        turnsUsed: q.turnsUsed || 0,
        turnLimit: q.turnLimit || TURN_LIMIT,
    };
}

// ===== РАУНД 50 (п.7 заявки): ПОЛ ВОРА =====
// Пол выбирается случайно в initThiefHunt и определяет фигурку
// (Medieval-Townfolk: муж. Skulker / жен. Beggar) и слово «вор/воровка».

/** Пол вора: 'male' | 'female' (старые сейвы — 'male'). */
export function getThiefGender(registry) {
    const q = registry.get('quest') || {};
    return (q.chase && q.chase.gender) || 'male';
}

/** Спрайт-лист вора по полу (4×4 @64px, анимации в BootScene). */
export function getThiefSpriteKey(registry) {
    return getThiefGender(registry) === 'female' ? 'enemy_thief_f' : 'enemy_thief_m';
}

/** Слово для текстов: «вор» / «воровка». */
export function thiefNoun(registry) {
    return getThiefGender(registry) === 'female' ? 'воровка' : 'вор';
}

/** Творительный падеж для заголовков вида «Встреча с {0}!» (раунд 52, QA). */
export function thiefNounInstr(registry) {
    return getThiefGender(registry) === 'female' ? 'воровкой' : 'вором';
}

// ----- Легаси-заглушки (старый экспорт, чтобы ничего не сломалось) -----

/** Легаси: трата хода теперь = трата тика времени (15 минут). */
export function spendTurn(registry, action) {
    tickTime(registry, TICK_MINUTES);
    if (action) ActionLog.add(registry, action);
    return chaseTicksLeft(registry);
}

/** Легаси: победа в бою с вором теперь обрабатывается в CombatScene через recoverStolenItem. */
export function winGame(registry) {
    recoverStolenItem(registry, 'killed', null);
}

/** Герой пал — игра проиграна. */
export function loseHeroDead(registry) {
    const q = registry.get('quest');
    if (!q) return;
    q.heroDead = true;
    // Раунд 43 (п.2): квест окончен — баннер цели гаснет.
    q.currentObjective = '';
    ActionLog.add(registry, t('ПОРАЖЕНИЕ: герой пал. Летопись обрывается на этой странице.'));
    registry.set('quest', q);
}

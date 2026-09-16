// ОХОТА НА ВОРА — много-локационная погоня (раунд 21, по спецификации владельца;
// раунд 22: ТРИ локации, следы и расспросы — по одному разу, побег вора из боя).
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

import { skillCheck } from '../systems/BRPEngine.js';
import { ActionLog } from './actionLog.js';
import { applyBeggingPenalty, changeVillageRep } from './reputation.js';
import { getLocationById } from './mapLocations.js';
import { tickTime } from '../systems/TimeSystem.js';
import { consumeBlessing } from './questGenerator.js';
import { formatMoney } from '../systems/Character.js';
import { t, tf } from '../systems/i18n.js';
import { createDialog } from '../utils/ui.js';

// Длительность одного тика погони в игровых минутах
export const TICK_MINUTES = 15;
// Сколько локаций проходит вор, прежде чем сбежать (раунд 22: было 2, стало 3)
export const CHASE_STOPS = 3;
// Сколько тиков вор идёт между локациями
export const TRAVEL_TICKS = 2;
// Сколько тиков вор идёт из деревни до первой локации
export const START_TRAVEL_TICKS = 2;
// Нижние пороги проверок (раунд 22, баланс: даже у воина-непрофильника
// должны быть реальные шансы — проверки решают исход погони)
export const MIN_SPOT = 35;      // обследование следов (Внимательность)
export const MIN_ORATORY = 30;   // расспрос селян (Красноречие)
export const MIN_PERSUADE = 35;  // убеждение вора (Убеждение)
export const MIN_BRAWL = 35;     // оглушение вора (Драка)
// Лимит (для совместимости со старым UI/сохранениями)
export const TURN_LIMIT = 20;

// Локации, куда может бежать вор (все ходовые точки у околицы).
// Раунд 21: баг «road» vs «road_south» устранён — вор теперь может
// бежать в любую локацию с развилки, включая Тракт.
export const CHASE_LOCATIONS = [
    'forest', 'road_south', 'field', 'river', 'lake', 'pogost', 'mill', 'apiary', 'pasture',
];

// Легаси-импорт (LocationScene импортирует THIEF_LOCATIONS)
export const THIEF_LOCATIONS = CHASE_LOCATIONS;

// Дорога до локации в тиках (ближние — 1, дальние — 2, как на «Карте местности»)
export const TRAVEL_COST = {
    forest: 1, road_south: 1, field: 1, river: 1,
    lake: 2, pogost: 2, mill: 2, apiary: 2, pasture: 2,
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ
// ============================================================

/**
 * Инициализировать погоню. Вызывается при начале новой игры.
 * Вор выбирает маршрут из ТРЁХ случайных локаций и уже бежит из деревни.
 */
export function initThiefHunt(registry) {
    const quest = registry.get('quest') || {};

    // Маршрут: ТРИ РАЗНЫЕ локации в случайном порядке (раунд 22)
    const pool = [...CHASE_LOCATIONS];
    const route = [];
    for (let i = 0; i < CHASE_STOPS; i++) {
        route.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }

    quest.chase = {
        route,
        phase: 'travel',       // 'travel' (в пути) | 'stay' (сидит на локации)
        stop: 0,               // индекс текущей остановки в route
        ticksLeft: START_TRAVEL_TICKS,
        stays: [
            4 + Math.floor(Math.random() * 3), // 4..6 тиков на первой локации
            3 + Math.floor(Math.random() * 3), // 3..5 тиков на второй
            3 + Math.floor(Math.random() * 3), // 3..5 тиков на третьей
        ],
        minutesAccum: 0,       // накопитель неполных тиков
        traces: {},            // { locId: { wentTo: locId|null } }
    };
    quest.thiefEscaped = false;
    quest.thiefDefeated = null;    // 'killed' | 'captured' | 'convinced'
    quest.stolenItemRecovered = false;
    quest.mainQuestDone = false;
    quest.runFinished = false;
    quest.turnsUsed = 0;
    quest.turnLimit = TURN_LIMIT;
    quest.cluesGathered = [];
    quest.locationsSearched = [];
    quest.currentObjective = t('Вор украл икону и бежал из деревни! Расспроси жителей или ищи следы — время уходит.');
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
 * На каждый полный тик (15 игровых минут) вор ждёт или перемещается.
 */
export function thiefChaseTick(registry, minutes) {
    const q = registry.get('quest');
    if (!q || !q.chase || q.thiefEscaped || q.thiefDefeated) return;
    const c = q.chase;
    c.minutesAccum = (c.minutesAccum || 0) + minutes;
    let guard = 0;
    while (c.minutesAccum >= TICK_MINUTES && guard < 24) {
        c.minutesAccum -= TICK_MINUTES;
        thiefStep(registry, c);
        guard++;
        if (q.thiefEscaped || q.thiefDefeated) { c.minutesAccum = 0; break; }
    }
    registry.set('quest', q);
}

/** Один шаг ИИ вора: ожидание на локации или переход к следующей. */
function thiefStep(registry, c) {
    const q = registry.get('quest');
    c.ticksLeft--;
    if (c.ticksLeft > 0) { registry.set('quest', q); return; }

    if (c.phase === 'travel') {
        // Вор добрался до своей текущей остановки и затаился
        c.phase = 'stay';
        c.ticksLeft = c.stays[c.stop] || 3;
    } else {
        // Вор ушёл с локации — оставил следы в сторону следующей
        const fromId = c.route[c.stop];
        const nextId = c.route[c.stop + 1] || null;
        c.traces[fromId] = { wentTo: nextId };
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
    registry.set('quest', q);
}

/** Вор сбежал из деревни с добычей — игра проиграна. */
export function escapeThief(registry) {
    const q = registry.get('quest');
    if (!q || !q.chase) return;
    const c = q.chase;
    const lastLoc = c.route[c.route.length - 1];
    if (lastLoc && !c.traces[lastLoc]) c.traces[lastLoc] = { wentTo: null };
    q.thiefEscaped = true;
    q.currentObjective = t('Вор скрылся с иконой. Погоня провалена.');
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
    const q = registry.get('quest');
    if (!q) q = registry.get('quest') || {};
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

    // Поиск занимает время — вор тоже двигается
    tickTime(registry, TICK_MINUTES);

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
        ActionLog.add(registry, `Поиск следов в «${loc.name}» — вор рядом!`);
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
    const spotSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.spot) || 25, MIN_SPOT));

    if (trace) {
        const res = skillCheck(spotSkill);
        // Следы разбираются ОДИН раз — неудача закрывает эту локацию навсегда
        if (!q.locationsSearched.includes(locationId)) q.locationsSearched.push(locationId);
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
            ActionLog.add(registry, `Поиск следов в «${loc.name}» — следы прочитаны (бросок ${res.roll}, успех).`);
            return { found: true, direction: trace.wentTo, message, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
        }
        ActionLog.add(registry, `Поиск следов в «${loc.name}» — провал (бросок ${res.roll}, следы были, но не разобраны).`);
        return {
            found: false, alreadySearched: false,
            message: t('Кто-то здесь проходил — видны примятые травы, но разобрать следы не вышло. Больше следы здесь не обследовать: придётся искать вора ВСЛЕПУЮ — обходить локации или расспрашивать других селян.'),
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    // 3) Вор здесь не проходил
    if (!q.locationsSearched.includes(locationId)) q.locationsSearched.push(locationId);
    registry.set('quest', q);
    ActionLog.add(registry, `Поиск следов в «${loc.name}» — следов нет.`);
    return {
        found: false, alreadySearched: true,
        message: t('Ты тщательно осмотрел местность — свежих следов вора здесь нет. Видимо, он пошёл другой дорогой.'),
        turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
    };
}

/**
 * Расспросить жителя о воре (проверка «Красноречия»). Тратит 1 тик.
 * Раунд 22: КАЖДЫЙ селянин расспрашивается ТОЛЬКО ОДИН РАЗ — повторный
 * запрос к нему невозможен, за наводками нужно идти к другим людям.
 * Успех: наводка на ПЕРВУЮ локацию маршрута вора; если она уже известна —
 * селянин подсказывает, где вор находится сейчас.
 */
export function askNPC(registry, npcId, npcName) {
    const q = registry.get('quest');
    if (!q) {
        return { gotClue: false, message: '...', turnsLeft: 0, thiefEscaped: false };
    }

    // Раунд 22: повторный расспрос того же NPC невозможен (без траты времени)
    if (!q.thiefAskedFrom) q.thiefAskedFrom = [];
    if (q.thiefAskedFrom.includes(npcId)) {
        return {
            gotClue: false, alreadyAsked: true,
            message: `${npcName}: «${t('Я уже всё тебе рассказал. Больше не знаю ничего — спроси у других людей.')}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }
    q.thiefAskedFrom.push(npcId);
    registry.set('quest', q);

    // Разговор занимает время — вор тоже двигается
    tickTime(registry, TICK_MINUTES);

    if (q.thiefEscaped) {
        return {
            gotClue: false,
            message: t('Пока вы говорили, вор успел скрыться из вида...'),
            turnsLeft: 0, thiefEscaped: true,
        };
    }

    const c = q.chase;
    if (!c || q.thiefDefeated) {
        const msg = q.thiefDefeated
            ? t('Слава Богу, ворюгу изловили! Дай Бог тебе удачи, сыщик.')
            : t('Не видел я никакого вора. Спроси кого другого, путник.');
        return {
            gotClue: false,
            message: `${npcName}: «${msg}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }

    const player = registry.get('player');
    // Раунд 22: нижний порог Красноречия + благословение (+10, одна проверка)
    const oratorySkill = consumeBlessing(registry, Math.max((player.skills && player.skills.oratory) || 15, MIN_ORATORY));
    const res = skillCheck(oratorySkill);
    const success = res.result === 'critical' || res.result === 'success';

    if (!q.cluesGathered) q.cluesGathered = [];
    let gotClue = false;
    let message = '';

    if (success) {
        const knowStop0 = q.cluesGathered.some(cl => cl && cl.stop0Clue);
        if (!knowStop0) {
            // Наводка на первую локацию маршрута (по спецификации)
            gotClue = true;
            const stop0 = getLocationById(c.route[0]);
            const clueText = tf(t('Видел, как воришка в тёмном плаще бежал в сторону «{0}»!'), stop0 ? stop0.name : c.route[0]);
            q.cluesGathered.push({ npcId, npcName, clue: clueText, stop0Clue: true });
            const extra = res.result === 'critical' ? ' ' + t('И следы ещё не остыли — поспеши!') : '';
            message = `${npcName}: «${clueText}${extra}»`;
            ActionLog.add(registry, `Расспрос ${npcName} о воре — НАВОДКА: ${clueText} (бросок ${res.roll}, успех).`);
        } else {
            // Первая локация уже известна — подсказка, где вор сейчас
            gotClue = true;
            const where = thiefWhereabouts(registry);
            const loc = where ? getLocationById(where.locId) : null;
            const clueText = loc
                ? (where.heading
                    ? tf(t('Его видели уже на дороге к «{0}». Догоняй!'), loc.name)
                    : tf(t('Его видели уже у «{0}». Догоняй!'), loc.name))
                : t('Следы потерялись — не знаю, куда он подался.');
            q.cluesGathered.push({ npcId, npcName, clue: clueText, whereClue: true });
            message = `${npcName}: «${clueText}»`;
            ActionLog.add(registry, `Расспрос ${npcName} о воре — подсказка: ${clueText} (бросок ${res.roll}, успех).`);
        }
    } else {
        message = `${npcName}: «${t('Не видел я никакого вора. Спроси кого другого, путник.')}»`;
        ActionLog.add(registry, `Расспрос ${npcName} о воре — ничего не узнал (бросок ${res.roll}, провал).`);
    }

    registry.set('quest', q);
    return { gotClue, message, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
}

/**
 * Попросить денег у NPC. Одноразовое действие для каждого NPC.
 * Разговор занимает время (1 тик) — вор тоже двигается.
 */
export function askMoneyForHelp(registry, npcId, npcName) {
    const q = registry.get('quest');
    if (!q) return { success: false, amount: 0, message: '...', turnsLeft: 0, thiefEscaped: false };

    if (!q.moneyAskedFrom) q.moneyAskedFrom = [];
    if (q.moneyAskedFrom.includes(npcId)) {
        return {
            success: false, alreadyAsked: true,
            message: `${npcName}: «${t('Я уже помог тебе, чем мог. Больше не дам.')}»`,
            turnsLeft: chaseTicksLeft(registry), thiefEscaped: false,
        };
    }
    q.moneyAskedFrom.push(npcId);

    // Разговор занимает время — вор тоже двигается
    tickTime(registry, TICK_MINUTES);

    if (q.thiefEscaped) {
        return {
            success: false, amount: 0,
            message: t('Пока вы говорили, вор успел скрыться из вида...'),
            turnsLeft: 0, thiefEscaped: true,
        };
    }

    // Модификатор щедрости по роли NPC
    const npcGenerosity = {
        elder: 1.5, priest: 0.7, blacksmith: 0.8, tavernkeeper: 1.0,
        peasant1: 0.4, widow: 0.3,
    }[npcId] || 0.5;

    const player = registry.get('player');
    const persuadeSkill = consumeBlessing(registry, (player.skills && player.skills.persuade) || 20);
    const res = skillCheck(persuadeSkill);

    let success = false;
    let amount = 0;
    let message = '';

    if (res.result === 'critical') {
        amount = Math.round((15 + Math.floor(Math.random() * 15)) * npcGenerosity * 2);
        success = true;
        message = `${npcName}: «${t('Возьми, путник, чем богат. Помоги тебе Господь!')}» (+${amount} д.)`;
        ActionLog.add(registry, `Просил денег у ${npcName} — КРИТИЧЕСКИЙ успех, получено ${amount} д. (бросок ${res.roll}).`);
    } else if (res.result === 'success') {
        amount = Math.round((5 + Math.floor(Math.random() * 15)) * npcGenerosity);
        success = true;
        message = `${npcName}: «${t('Вот тебе немного денег на дорогу.')}» (+${amount} д.)`;
        ActionLog.add(registry, `Просил денег у ${npcName} — успех, получено ${amount} д. (бросок ${res.roll}).`);
    } else if (res.result === 'fumble') {
        message = `${npcName}: «${t('Попрошайка! Уходи, не позорься!')}» (${t('Больше не даст.')})`;
        ActionLog.add(registry, `Просил денег у ${npcName} — FUMBLE, ничего не получено (бросок ${res.roll}).`);
    } else {
        message = `${npcName}: «${t('Нет у меня лишних денег, сам перебиваюсь.')}»`;
        ActionLog.add(registry, `Просил денег у ${npcName} — провал, ничего не получено (бросок ${res.roll}).`);
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
    return { success, amount, message, turnsLeft: chaseTicksLeft(registry), thiefEscaped: false };
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
    const x = (opts.x !== undefined) ? opts.x : width * 0.68;
    const y = (opts.y !== undefined) ? opts.y : height * 0.27;
    const texKey = scene.textures.exists('enemy_bandit') ? 'enemy_bandit' : 'knight_idle';
    const sprite = scene.add.image(x, y, texKey).setScale(2.6).setDepth(60);
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

    createDialog(scene, t('😱 Встреча с вором!'),
        t('Вор в тёмном плаще сжимает краденую икону. Он тебя заметил! Можно напасть, убедить отдать краденое (проверка Убеждения) или подкрасться и оглушить (проверка Драки).'),
        [
            {
                text: t('⚔ Напасть'),
                callback: finish(() => {
                    ActionLog.add(registry, t('Напал на вора в его убежище.'));
                    scene.scene.start('Combat', { enemyKeys: ['thief'], npcId: 'thief', fromLocation: locationId });
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
    const persuadeSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.persuade) || 20, MIN_PERSUADE));
    const res = skillCheck(persuadeSkill);

    if (res.result === 'critical' || res.result === 'success') {
        recoverStolenItem(registry, 'convinced', res);
        return {
            success: true,
            message: t('Вор, помявшись, опускает икону в траву: «Ладно! Пронеси тебя Бог, сыщик!» — и растворяется в чаще. Икона цела! Отнеси её старосте или батюшке.') +
                ` (${t('бросок')} ${res.roll})`,
            thiefEscaped: false,
        };
    }

    // Провал убеждения — вор паникует и бежит
    const fled = thiefFleesNow(registry);
    ActionLog.add(registry, `Убеждение не подействовало (бросок ${res.roll}, провал)${fled.escaped ? ' — вор скрылся!' : ' — вор пустился наутёк!'}`);
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
    const brawlSkill = consumeBlessing(registry, Math.max((player.skills && player.skills.brawl) || 25, MIN_BRAWL));
    const res = skillCheck(brawlSkill);

    if (res.result === 'critical' || res.result === 'success') {
        recoverStolenItem(registry, 'captured', res);
        const crit = res.result === 'critical';
        return {
            success: true,
            message: (crit
                ? t('Одним точным ударом в висок ты срубишь вора с ног и накрепко связываешь его. Икона в киоте невредима!')
                : t('Ты догоняешь вора и оглушаешь его ударом в затылок. Вор связан — его ждёт суд старосты, а икона снова цела!'))
                + ` (${t('бросок')} ${res.roll})`,
            thiefEscaped: false,
        };
    }

    const fled = thiefFleesNow(registry);
    ActionLog.add(registry, `Оглушить вора не вышло (бросок ${res.roll}, провал)${fled.escaped ? ' — вор скрылся!' : ' — вор пустился наутёк!'}`);
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
    c.traces[fromId] = { wentTo: c.route[c.stop + 1] };
    c.stop++;
    c.phase = 'travel';
    c.ticksLeft = TRAVEL_TICKS;
    registry.set('quest', q);
    return { escaped: false };
}

/**
 * Раунд 22: игрок СБЕЖАЛ из боя с вором. Вор не станет ждать второго
 * нападения: он перебегает в СЛУЧАЙНУЮ локацию (не текущую и не уже
 * пройденную) и затаивается там, а времени на его поимку становится
 * ЧУТЬ БОЛЬШЕ (+2 тика к текущей остановке).
 */
export function thiefFleesFromFight(registry, fromLocationId) {
    const q = registry.get('quest');
    const c = getChase(registry);
    if (!c) return false;

    const visited = c.route.slice(0, c.stop);
    let pool = CHASE_LOCATIONS.filter(l => l !== fromLocationId && !visited.includes(l));
    if (pool.length === 0) pool = CHASE_LOCATIONS.filter(l => l !== fromLocationId);
    const dest = pool[Math.floor(Math.random() * pool.length)];

    // Следы, что вели к старой остановке, теперь ведут к новому месту
    Object.keys(c.traces || {}).forEach(k => {
        if (c.traces[k] && c.traces[k].wentTo === c.route[c.stop]) c.traces[k].wentTo = dest;
    });
    if (fromLocationId) c.traces[fromLocationId] = { wentTo: dest };

    c.route[c.stop] = dest;
    c.stays[c.stop] = (c.stays[c.stop] || 3) + 2;   // время его тиков увеличивается
    c.phase = 'stay';
    c.ticksLeft = c.stays[c.stop];

    // Новое убежище — новые следы: если эту локацию обыскивали раньше,
    // снова разрешаем обследование (иначе следы было бы не прочесть)
    if (q.locationsSearched) {
        q.locationsSearched = q.locationsSearched.filter(l => l !== dest);
    }

    ActionLog.add(registry, t('Вор не стал испытывать судьбу: он бежал в другое место и затаился там. У тебя появилось немного больше времени, но искать нужно заново.'));
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
    q.currentObjective = t('Икона возвращена! Деревня благодарна. Староста и жители дают поручения.');
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
    q.currentObjective = t('Герой пал в бою. Поход окончен.');
    ActionLog.add(registry, t('ПОРАЖЕНИЕ: герой пал. Летопись обрывается на этой странице.'));
    registry.set('quest', q);
}

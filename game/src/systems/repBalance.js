// ============================================================
// ПАТЧ 66.80 (пп.11–12 приказа владельца): ОДОБРЕННЫЙ БАЛАНС
// РЕПУТАЦИИ И ОПЛАТЫ — предложение BALANCE_PROPOSALS_6679.md
// утверждено владельцем со следующими значениями:
//
//  РЕПУТАЦИЯ (п.11)
//   • Еженедельное «забывание» мелких обид: раз в игровой неделю
//     деревенская репутация +1 к нулю — но только пока она в диапазоне
//     −20…0 («нелюбимый, но не враг»). Личные репутации и тяжкие дела
//     (убийства, −50 и глубже) молва не забывает.
//   • Лестница статусов: ≤ −20 — «подозрительный» (стражник у ворот
//     останавливает на ОСМОТР: изымает только краденое, БЕЗ виры и без
//     поимки); ≥ +30 — «свой» (в дома пускают без присмотра).
//   • Прощение церквью: пожертвование 50 д. «замолить грехи» — РАЗ
//     В МЕСЯЦ снимает до −5 деревенской репутации (к нулю, не выше).
//   • Нелинейность повторных обид: каждая повторная ОДНОТИПНАЯ обида
//     одному и тому же НПЦ бьёт сильнее — ×1.5 (округление вниз):
//     −10 → −15 → −22 → −30 (потолок −30 за одну обиду).
//
//  ОПЛАТА (п.12)
//   • Ставки подёнки ×(1 + деревенская репутация/200) с клэмпом
//     ×0.75…×1.25 — «своему платят подороже, подозрительному — минимум».
//   • Сезонные надбавки: зимой (декабрь–февраль) у гончара и плотника
//     −20%; у мельницы +20% после урожая (Серпень–Грудень).
//   • «О слове» — раз в сутки поторговаться о ставке до работы
//     (Убеждение против Убеждения хозяина, как торг 66.73):
//     успех +25%, крит +50%, провал — базовая ставка.
//   • Вирá и примирение — главный «сток денег» воровской ветки
//     (внедрено патчем 66.79, здесь только константы для справки).
//   • Премия старосты 20 д. за ПОИМКУ вора живьём (thief.js).
//
// Модуль registry-only — тестируется в Node (test_round128).
// ============================================================

import { t, tf } from './i18n.js';
import { ActionLog } from '../data/actionLog.js';
import { getReputation, getVillageRep, changeVillageRepExact } from '../data/reputation.js';
import { opposedSkillCheck, formatOpposedCheck } from './BRPEngine.js';
// §12.3 (66.96): единый игровой календарь — одна формула дня на всю игру
import { absDay } from './gameCalendar.js';
import { getNpcOpposition } from '../data/npcStats.js';
import { getChaEdgeMod, clearChaEdge } from './charisma.js';
import { getSeason } from './TimeSystem.js';

// ---------------- п.11-а: ЕЖЕНЕДЕЛЬНОЕ «ЗАБЫВАНИЕ» ОБИД ----------------

/** Ниже этой репутации молва уже не «забывает» (враг — не мелкая обида). */
export const WEEK_FORGET_RANGE_MIN = -20;
/** Шаг еженедельного потепления молвы (к нулю). */
export const WEEK_FORGET_STEP = 1;
/** Сколько недель можно «наверстать» за один тик (защита от скачков времени). */
export const WEEK_FORGET_MAX_CATCHUP = 4;

/** Ключ игровой недели (неделя = 7 игровых дней; канон gameCalendar, §12.3). */
export function repWeekKeyOf(timeState) {
    return Math.floor(absDay(timeState) / 7);
}

/**
 * П.11-а: еженедельный тик «забывания» мелких обид (ленивый — вызывается
 * при входе в сцены). За КАЖДУЮ прошедшую неделю деревенская репутация в
 * диапазоне −20…−1 подрастает на +1 (не выше нуля). Личные репутации не
 * трогаются; тяжкая молва (ниже −20) сама не рассеивается.
 * @returns {{ weeks:number, applied:number, villageRep:number }}
 */
export function tickWeeklyRepForget(registry, timeState) {
    if (!registry || !timeState) return { weeks: 0, applied: 0, villageRep: getVillageRep(registry) };
    const wk = repWeekKeyOf(timeState);
    const st0 = registry.get('repForgetState');
    // Первое обращение в партии: запоминаем ТЕКУЩУЮ неделю и выходим
    // (наверстывать до начала игры нечего); состояние СОХРАНЯЕМ, чтобы
    // следующая неделя сравнивалась именно с этой.
    if (!st0 || typeof st0.weekKey !== 'number') {
        registry.set('repForgetState', { weekKey: wk });
        return { weeks: 0, applied: 0, villageRep: getVillageRep(registry) };
    }
    if (wk <= st0.weekKey) return { weeks: 0, applied: 0, villageRep: getVillageRep(registry) };
    const weeks = Math.min(wk - st0.weekKey, WEEK_FORGET_MAX_CATCHUP);
    st0.weekKey = wk; // недели «просеяны» даже без эффекта — тик раз в неделю
    registry.set('repForgetState', st0);
    const rep = getReputation(registry);
    let applied = 0;
    for (let i = 0; i < weeks; i++) {
        const v = rep.villageRep;
        if (v >= WEEK_FORGET_RANGE_MIN && v < 0) {
            rep.villageRep = Math.min(0, v + WEEK_FORGET_STEP);
            applied++;
        }
    }
    if (applied > 0) {
        registry.set('reputation', rep);
        ActionLog.add(registry, tf(t('Неделя минула — деревня помаленьку забывает мелкие обиды: репутация в деревне +{0} ({1} нед.).'),
            applied * WEEK_FORGET_STEP, applied));
    }
    return { weeks, applied, villageRep: rep.villageRep };
}

// ---------------- п.11-в: ЛЕСТНИЦА «ПОДОЗРИТЕЛЬНЫЙ ↔ СВОЙ» ----------------

/** Порог статуса «подозрительный» (стражник осматривает узел у ворот). */
export const REP_STATUS_SUSPICIOUS = -20;
/** Порог статуса «свой» (в дома пускают без присмотра хозяина). */
export const REP_STATUS_OWN = 30;

/**
 * П.11-в: статус игрока по деревенской репутации (null — «никакой»).
 * @returns {{ key:'suspicious'|'own', name:string, color:string }|null}
 */
export function villageRepStatusOf(repValue) {
    const v = Number(repValue) || 0;
    if (v <= REP_STATUS_SUSPICIOUS) return { key: 'suspicious', name: 'подозрительный', color: '#ff8040' };
    if (v >= REP_STATUS_OWN) return { key: 'own', name: 'свой', color: '#40ff40' };
    return null;
}

/** Суффикс для статус-бара: « (подозрительный)» / « (свой)» / ''. */
export function villageRepStatusSuffix(registry) {
    const st = villageRepStatusOf(getVillageRep(registry));
    return st ? ` (${t(st.name)})` : '';
}

// ---------------- п.11-д: НЕЛИНЕЙНОСТЬ ПОВТОРНЫХ ОБИД ----------------

/** Множитель повторной однотипной обиды (×1.5 — приказ владельца). */
export const OFFENSE_ESCALATION_MULT = 1.5;
/** Потолок удара по личной репутации за одну обиду. */
export const OFFENSE_CAP = 30;

/**
 * П.11-д: escalated штраф за однотипную обиду НПЦ. Первая обида — база,
 * каждая повторная того же типа тому же НПЦ — ×1.5 (вниз), потолок −30.
 * Счётчик хранится в состоянии репутации (rep.offenseCounts).
 * @param {Object} registry
 * @param {string} npcId
 * @param {string} kind — тип обиды ('suspect_fail', 'night_wake', …)
 * @param {number} base — базовый штраф (положительное число очков)
 * @returns {number} отрицательное значение для changeNpcRepExact
 */
export function escalatedNpcOffense(registry, npcId, kind, base) {
    const rep = getReputation(registry);
    if (!rep.offenseCounts) rep.offenseCounts = {};
    const key = `${npcId}:${kind}`;
    const prior = rep.offenseCounts[key] || 0;
    const penalty = Math.min(OFFENSE_CAP, Math.floor(base * Math.pow(OFFENSE_ESCALATION_MULT, prior)));
    rep.offenseCounts[key] = prior + 1;
    registry.set('reputation', rep);
    return -penalty;
}

/** Сколько раз уже наносилась эта обида (для UI/тестов). */
export function offenseCountOf(registry, npcId, kind) {
    const rep = getReputation(registry);
    return (rep.offenseCounts && rep.offenseCounts[`${npcId}:${kind}`]) || 0;
}

// ---------------- п.12-а/б: СТАВКИ × РЕПУТАЦИЯ × СЕЗОН ----------------

/** Делитель репутации в формуле ставки (×(1 + rep/200)). */
export const WAGE_REP_DIVISOR = 200;
/** Клэмп репутационного множителя ставки. */
export const WAGE_MULT_MIN = 0.75;
export const WAGE_MULT_MAX = 1.25;
/** Зимняя надбавка гончару/плотнику (мало заказов). */
export const WINTER_WAGE_MULT = 0.8;
/** Мельничная надбавка после урожая (Серпень–Грудень). */
export const MILL_POST_HARVEST_MULT = 1.2;
/** Месяцы мельничной надбавки (индексация TimeSystem: 0 = сентябрь). */
export const MILL_POST_HARVEST_MONTHS = [11, 0, 1, 2, 3]; // Серпень…Грудень
/** Подёнки, замирающие зимой. */
export const WINTER_SLOW_JOBS = new Set(['potter', 'carpenter']);

/** Множитель ставки по репутации (клэмп ×0.75…×1.25). */
export function repWageMultiplier(registry) {
    const v = getVillageRep(registry);
    return Math.max(WAGE_MULT_MIN, Math.min(WAGE_MULT_MAX, 1 + v / WAGE_REP_DIVISOR));
}

/**
 * П.12-б: сезонный множитель ставки по роду работы и месяцу.
 * @param {string|null} jobId — 'potter'|'carpenter'|'mill'|null
 * @param {number|null} monthIdx — месяц TimeSystem (0 = сентябрь); null — вне сезона
 */
export function seasonWageMultiplier(jobId, monthIdx) {
    if (!jobId || monthIdx === null || monthIdx === undefined) return 1;
    const m = ((Number(monthIdx) || 0) % 12 + 12) % 12;
    if (WINTER_SLOW_JOBS.has(jobId) && getSeason(m) === 'winter') return WINTER_WAGE_MULT;
    if (jobId === 'mill' && MILL_POST_HARVEST_MONTHS.includes(m)) return MILL_POST_HARVEST_MULT;
    return 1;
}

/**
 * П.12-а/б: финальная ставка подёнки — база × репутация × сезон × торг.
 * Нейтрально (rep 0, вне сезона, без торга) — ровно база.
 * @returns {{ wage:number, base:number, repMult:number, seasonMult:number, dealMult:number }}
 */
export function applyWageBalance(registry, baseWage, jobId, opts = {}) {
    const base = Math.max(0, Math.round(Number(baseWage) || 0));
    if (!registry) return { wage: base, base, repMult: 1, seasonMult: 1, dealMult: 1 };
    const repMult = repWageMultiplier(registry);
    const ts = registry.get('gameTime');
    const seasonMult = opts.noSeason ? 1 : seasonWageMultiplier(jobId, ts ? ts.month : null);
    const dealMult = opts.noDeal ? 1 : wageDealMultFor(registry);
    const wage = Math.max(0, Math.round(base * repMult * seasonMult * dealMult));
    return { wage, base, repMult, seasonMult, dealMult };
}

// ---------------- п.12-в: «О СЛОВЕ» — ТОРГ О СТАВКЕ ----------------

/** Торг о ставке: успех (+25%). */
export const WAGE_DEAL_SUCCESS_MULT = 1.25;
/** Торг о ставке: крит (+50%). */
export const WAGE_DEAL_CRITICAL_MULT = 1.5;

/** Ключ игрового дня — канон gameCalendar.absDay (§12.3, 66.96). */
function wageDealDayKey(registry) {
    const time = registry ? registry.get('gameTime') : null;
    return absDay(time);
}

function wageDealStateOf(registry) {
    const today = wageDealDayKey(registry);
    let st = (registry && registry.get('wageDealState')) || null;
    if (!st || st.dayKey !== today) st = { dayKey: today, mult: 1, npcId: null };
    return st;
}

function saveWageDealState(registry, st) {
    if (registry) registry.set('wageDealState', st);
}

/** Действующий множитель ставки на сегодня (1 — торгов не был или не удался). */
export function wageDealMultFor(registry) {
    const st = wageDealStateOf(registry);
    return (Number(st.mult) || 1);
}

/** Можно ли сегодня торговаться о ставке (одна попытка в сутки). */
export function canWageDealToday(registry) {
    const st = wageDealStateOf(registry);
    return !st.npcId;
}

/**
 * П.12-в: «О слове» — поторговаться о ставке подёнки ДО работы.
 * Встречная проверка Убеждения против Убеждения хозяина (как торг 66.73):
 * успех +25%, крит +50%, провал/fumble — базовая ставка (попытка за день
 * потрачена). Множитель действует на ВСЕ подёнки этого дня (jobs.js).
 * @param {Object} registry
 * @param {string} npcId — хозяин (potter1, carpenter1, blacksmith, weaver1, peasant1)
 * @param {number} skillValue — Убеждение игрока
 * @returns {{ done:boolean, mult:number, message:string, checkLine:string|null }}
 */
export function attemptWageDeal(registry, npcId, skillValue) {
    if (!canWageDealToday(registry)) {
        return { done: false, mult: wageDealMultFor(registry),
            message: t('Хозяин отмахивается: «Уж сегодня договорились — за слово платят один раз!»'), checkLine: null };
    }
    const opp = getNpcOpposition({ id: npcId }, 'persuade');
    const edge = getChaEdgeMod(registry);
    const res = opposedSkillCheck((Number(skillValue) || 1) + edge, opp.value, 0);
    const checkLine = formatOpposedCheck(res, 'Убеждение' + (edge ? (edge > 0 ? ` (+${edge} обаяние)` : ` (${edge} обаяние)`) : ''),
        `${opp.ruNameGen} хозяина`);

    let mult = 1;
    let message;
    if (res.won && res.critical) {
        mult = WAGE_DEAL_CRITICAL_MULT;
        message = t('Хозяин расхохотался: «Экий уговорщик! Ладно, коли так ладно бает — плачу вполовину больше, и дело с концом!» Ставка +50% на день.');
        ActionLog.add(registry, tf(t('«О слове» (крит Убеждения): ставки подёнки +{0}% на день.'), Math.round((mult - 1) * 100)));
    } else if (res.won) {
        mult = WAGE_DEAL_SUCCESS_MULT;
        message = t('Хозяин крякнул и почесал затылок: «Складно баешь, спорить нечего. Ладно, накину четверть — только работай так, как баешь!» Ставка +25% на день.');
        ActionLog.add(registry, tf(t('«О слове» удалось (Убеждение): ставки подёнки +{0}% на день.'), Math.round((mult - 1) * 100)));
    } else {
        message = t('Хозяин покачал головой: «Ставка нынче у меня одна, для всех. Работать будешь — так работай, а торговаться неча». Попытка за день потрачена.');
        ActionLog.add(registry, t('«О слове» не удалось (Убеждение): хозяин твёрд — ставка базовая.'));
    }
    const st = wageDealStateOf(registry);
    st.mult = mult;
    st.npcId = npcId || 'unknown';
    saveWageDealState(registry, st);
    if (registry.get('chaEdge')) clearChaEdge(registry);
    return { done: true, mult, message, checkLine };
}

// ---------------- п.11-г: ПРОЩЕНИЕ ЦЕРКВИ («ЗАМОЛИТЬ ГРЕХИ») ----------------

/** Цена замаливания грехов (приказ владельца: 50 д.). */
export const ABSOLUTION_COST = 50;
/** Сколько деревенской молвы снимает епитимья (до −5, к нулю). */
export const ABSOLUTION_REP = 5;

/** Ключ календарного месяца (год от С.м. + месяц) — епитимья раз в месяц. */
export function absolutionMonthKeyOf(timeState) {
    return timeState ? `${timeState.yearFromChrist}-${timeState.month}` : '0';
}

/** Уже замаливал грехи в этом месяце? */
export function absolutionUsedThisMonth(registry, timeState) {
    return (registry && registry.get('absolutionMonthKey') || null) === absolutionMonthKeyOf(timeState);
}

/**
 * П.11-г: епитимья — «замолить грехи» пожертвованием 50 д. в церкви.
 * РАЗ В КАЛЕНДАРНЫЙ МЕСЯЦ снимает до −5 деревенской репутации (к нулю,
 * не выше; личные обиды — не Церковное дело). Деньги списывает СЦЕНА.
 * @returns {{ success:boolean, reason?:'poor'|'clean'|'used', before?:number, after?:number, healed?:number }}
 */
export function performChurchAbsolution(registry, timeState) {
    if (!registry) return { success: false, reason: 'poor' };
    if (absolutionUsedThisMonth(registry, timeState)) return { success: false, reason: 'used' };
    const rep = getReputation(registry);
    const before = rep.villageRep;
    if (before >= 0) return { success: false, reason: 'clean' };
    const after = Math.min(0, before + ABSOLUTION_REP);
    rep.villageRep = after;
    registry.set('reputation', rep);
    registry.set('absolutionMonthKey', absolutionMonthKeyOf(timeState));
    ActionLog.add(registry, tf(t('Замолил грехи перед церковью: епитимья 50 д. принята, молва в деревне смягчилась ({0} → {1}).'),
        before, after));
    return { success: true, before, after, healed: after - before };
}

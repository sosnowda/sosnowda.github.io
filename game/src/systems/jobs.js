// ============================================================
// ПАТЧ 66.74 (приказы владельца 4, 5, 7, 12): РАБОТЫ ПО НАВЫКАМ.
//
// «4\ Навык: Ремесло (подёнка у гончара и других мастеров).
//  5\ Грамота — помощь священнику в Храме как Служка во время Богослужений.
//  7\ Скоморошество — игра на гуслях за столом на постоялом дворе
//     (риск гнева Церкви).
// 12\ Добавить новый Навык: "Кузнечное дело" для работы в кузне
//     в помощь кузнецу, за деньги.»
//
// Модуль ЧИСТЫЙ (registry + кубик, без сцены): бросает проверку навыка
// (благословение молитвы/батюшки, голод и усталость — getBlessedSkill),
// возвращает исход + деньги; время, усталость, репутацию и поп-апы ведёт
// сцена. Все лестницы — по образцу Готовки 66.72 (провал — впустую,
// крит — «удалось на славу»).
//
// ПАТЧ 66.80 (пп.12-а/б/в): финальная ставка = база × репутация
// (×(1+rep/200), клэмп ×0.75…×1.25) × сезон (зима −20% гончар/плотник,
// мельница после урожая +20%) × торг «О слове» (+25%/+50% на день).
// При registry=null (юнит-тесты лестниц) множители нейтральные — база.
// ============================================================

import { skillCheck } from './BRPEngine.js';
import { getBlessedSkill } from '../data/questGenerator.js';
// Патч 66.80: ставки × репутация × сезон × торг «О слове»
import { applyWageBalance } from './repBalance.js';

/** Одна проверка навыка со всеми модификаторами. */
function jobCheck(registry, skillValue) {
    const skill = Math.max(1, Math.min(99, getBlessedSkill(registry, Number(skillValue) || 1)));
    return { res: skillCheck(skill), skill };
}

function die(min, max, rng = Math.random) {
    return min + Math.floor(rng() * (max - min + 1));
}

// ------------------------------------------------------------
// РЕМЕСЛО — подёнка у гончара (кнопка «Помочь в мастерской»).
//  • провал — брак на круге: ставка 2 д. (было 3–6 без навыка);
//  • успех — честная ставка 4–7 д.;
//  • крит — «шедевр»: 6–9 д. И горшок мастеровой в узел (продать 10 д.).
// ------------------------------------------------------------
export function craftDaywork(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = failed ? 2 : (crit ? die(6, 9, rng) : die(4, 7, rng));
    // 66.80: × репутация × сезон (зима −20%) × торг «О слове»
    const pay = applyWageBalance(registry, base, 'potter');
    return { ok: !failed, crit, masterpiece: crit, wage: pay.wage, baseWage: base, roll: res.roll, skill };
}

// ------------------------------------------------------------
// КУЗНЕЧНОЕ ДЕЛО — помощь кузнецу у горна (кнопка в кузнице).
//  • провал — черновая работа (дрова, меха): 2–3 д.;
//  • успех — помогал у наковальни: 4–7 д.;
//  • крит — «получилась скоба, как у мастера»: 8–12 д.
// ------------------------------------------------------------
export function smithyDaywork(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = failed ? die(2, 3, rng) : (crit ? die(8, 12, rng) : die(4, 7, rng));
    const pay = applyWageBalance(registry, base, 'smithy'); // сезонной надбавки у горна нет
    return { ok: !failed, crit, wage: pay.wage, baseWage: base, roll: res.roll, skill };
}

// ------------------------------------------------------------
// ГРАМОТА — служка в храме во время богослужения (кнопка в церкви).
// Сцена проверяет окно службы (SERVICES из ChurchBells.js); здесь —
// бросок Грамоты: читать псалтырь и держать кадило неграмотному нельзя.
//  • провал — сбился со строки, батюшка отослал с миром: 0 д.;
//  • успех — служка за службу: 3–6 д.;
//  • крит — читал Cleanо и складно: 7–10 д. (батюшка хвалит).
// ------------------------------------------------------------
export function acolyteServe(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = failed ? 0 : (crit ? die(7, 10, rng) : die(3, 6, rng));
    // 66.80: у служки — только репутационный множитель (с батюшкой не торгуются)
    const pay = applyWageBalance(registry, base, 'acolyte', { noSeason: true, noDeal: true });
    return { ok: !failed, crit, wage: pay.wage, baseWage: base, roll: res.roll, skill };
}

// ------------------------------------------------------------
// СКОМОРОШЕСТВО — гусли за столом постоялого двора (кнопка в таверне).
//  • провал — струны вразлад, стол не смеялся: 0 д.;
//  • успех — сбор со стола: 3–8 д.;
//  • крит — «плясали и стар и млад»: 9–16 д.;
//  • fumble — переполох: перевернули скамью (сцена: −2 к репутации деревни);
//  • РИСК ГНЕВА ЦЕРКВИ: при любом исходе 20% (бросок rng < 0.2) — молва о
//    потешнике доходит до батюшки (сцена: −2 к личной репутации у священника).
// ------------------------------------------------------------
export function tavernPerformance(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const coins = failed ? 0 : (crit ? die(9, 16, rng) : die(3, 8, rng));
    return {
        ok: !failed, crit, fumble: res.result === 'fumble',
        coins, churchAngry: rng() < 0.2, roll: res.roll, skill,
    };
}

// ------------------------------------------------------------
// ПАТЧ 66.76 (приказ 4): ПЛОТНИЦКОЕ ДЕЛО — подёнка у сруба
// (дом плотника). Приказ: ставка 3–6 д.
//  • провал — «запорол доску»: 2 д.;
//  • успех — честная ставка: 3–6 д.;
//  • крит — «зарубка ровна, шов плотён»: 7–10 д.
// ------------------------------------------------------------
export function carpenterDaywork(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = failed ? 2 : (crit ? die(7, 10, rng) : die(3, 6, rng));
    // 66.80: × репутация × сезон (зима −20%) × торг «О слове»
    const pay = applyWageBalance(registry, base, 'carpenter');
    return { ok: !failed, crit, wage: pay.wage, baseWage: base, roll: res.roll, skill };
}

// ------------------------------------------------------------
// ПАТЧ 66.76 (приказ 1): МЕЛЬНИЧНОЕ ДЕЛО — работа у ветряной мельницы.
// ПРИКАЗ ВЛАДЕЛЬЦА: «удалить зерно из наград» — оплата ТОЛЬКО ДЕНЬГАМИ.
//  • провал — «пересушил зерно, жернов искрил»: черновая работа 2–3 д.;
//  • успех — намолол чинно: 4–7 д.;
//  • крит — «отхода меньше всех»: 8–12 д.
// ------------------------------------------------------------
export function millDaywork(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = failed ? die(2, 3, rng) : (crit ? die(8, 12, rng) : die(4, 7, rng));
    // 66.80: × репутация × надбавка после урожая (Серпень–Грудень +20%) × торг
    const pay = applyWageBalance(registry, base, 'mill');
    return { ok: !failed, crit, wage: pay.wage, baseWage: base, grain: 0, roll: res.roll, skill };
}

// ------------------------------------------------------------
// ПАТЧ 66.76 (приказ 3): ТКАЧЕСТВО — подёнка за станком (дом ткачихи).
// Оплата НАТУРОЙ — полотном/сукном (товары Руси; полотно 8 д., сукно 12 д.
// в скупке Фёдора/Потапа): «подёнка за полотно/сукно» — прямая формулировка
// приказа. Мелочь сверху — на нити и лампаду.
//  • провал — «порвал нить»: 2 д., без полотна;
//  • успех — 1 отрез ПОЛОТНА в узел + 2 д. мелочью;
//  • крит — «узор стянула ровно»: 1 отрез СУКНА в узел + 3 д.
// ------------------------------------------------------------
export function weaveDaywork(registry, skillValue, rng = Math.random) {
    const { res, skill } = jobCheck(registry, skillValue);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = failed ? 2 : (crit ? 3 : 2);
    // 66.80: мелочь сверху × репутация × торг (сезонной надбавки у станка нет)
    const pay = applyWageBalance(registry, base, 'weave', { noSeason: true });
    return {
        ok: !failed, crit,
        wage: pay.wage, baseWage: base,
        cloth: crit ? 'sukon' : (!failed ? 'polotno' : null),
        roll: res.roll, skill,
    };
}

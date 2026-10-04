// ============================================================
// Раунд 66.17 (приказы владельца 4, 5, 7, 8, 10, 11, 12):
// ДОБЫЧА И ПРИПАСЫ В УЗЛЕ (инвентаре).
//
// Новый вид предметов — «добыча»: сырая и приготовленная рыба,
// мясо дичи. Правила по приказам:
//  • п.7: сырую, только что выловленную рыбу есть НЕЛЬЗЯ — только
//    продать или приготовить на костре;
//  • п.8: на костре можно приготовить рыбу И мясо дичи;
//  • п.4: у съедобных припасов в инвентаре есть кнопка «Съесть»;
//  • п.1 (уточнение): простая еда (яблоко, мёд, грибы, рацион) — +1 HP;
//    полноценная (каша/хлеб в трактире, жаркое, печёная рыба) — 2–3 HP;
//  • все правила meal.js действуют: 1 час, кулдаун еды 4 часа;
//  • п.5: добычу можно ПРОДАТЬ (трактирщик — на кухню, мясник Потап);
//  • п.12: удочка — товар (Аверьян); с ней рыбалка своя, без неё —
//    только у чужой удочки на броду (п.13);
//  • п.10/11: стрельба из лука по дичи и мясо с туши (см. data/forest.js
//    GAME_ANIMALS и CombatScene — волчья туша).
// ============================================================

import { t } from './i18n.js';
import { canEat, registerMeal, showMealBlockedPopup, MEAL_DURATION_MIN } from './meal.js';
import { tickTime } from './TimeSystem.js';
import { createDialog } from '../utils/ui.js';
// Раунд 66.70 (приказы 9,12): готовка на костре — ПРОВЕРКА НАВЫКА «Готовка»
// (провал — продукты пропали; крит. успех — блюдо сытнее на +1);
// бонус молитвы (+5 на одну проверку) применяется снаружи (prayer.js).
import { skillCheck } from './BRPEngine.js';
import { consumePrayerBless } from './prayer.js';
// Раунд 66.72: лекарственная трава — кулдаун 12 ч сохранён из 66.71 (canUseHerb);
// применение — проверка Знахарства (приказ 13), время НЕ тратится (канон 66.71).
import { canUseHerb, registerHerb } from './meal.js';
// Патч 66.73 (приказ 7): голод > 48 ч — штраф ко всем проверкам навыков,
// включая собранные тут Выживание/Готовку/Знахарство.
import { hungerSkillPenalty } from './hunger.js';
// Патч 66.73 (приказ 14): усталость — −1% за каждый отрицательный ОУ (BRP SRD)
import { fatigueSkillMod } from './fatigue.js';
// Патч 66.74 (приказы 2,3): новые навыки берут благословение молитвы и
// полный модификатор благословения/голода/усталости (getBlessedSkill)
import { getBlessedSkill } from '../data/questGenerator.js';

/** Патч 66.73: значение навыка с голодным и усталостным штрафом (пол 1). */
function hungrySkill(registry, base) {
    return Math.max(1, Math.round(Number(base) || 1) - hungerSkillPenalty(registry) + fatigueSkillMod(registry));
}

/**
 * Определения добычи/припасов узла.
 *  edible  — можно съесть из инвентаря (кнопка «Съесть»);
 *  heal    — сколько HP лечит (простая еда 1, полноценная 2–3);
 *  sell    — цена продажи за 1 штуку (деньги);
 *  cookFrom— из чего готовится на костре (id сырья).
 */
export const LOOT_DEFS = {
    fish_raw: {
        id: 'fish_raw', name: 'Рыба (сырая)', emoji: '🐟',
        edible: false, heal: 0, sell: 2,
        cookTo: 'fish_cooked', cookToTasty: 'fish_cooked_tasty', cookMinutes: 30,
    },
    fish_cooked: {
        id: 'fish_cooked', name: 'Рыба печёная', emoji: '🍢',
        edible: true, heal: 2, sell: 4,
    },
    // Раунд 66.70: крит Готовки — блюдо «удалось на славу»: +1 к лечению и цене.
    fish_cooked_tasty: {
        id: 'fish_cooked_tasty', name: 'Рыба печёная (удалась на славу)', emoji: '🍢',
        edible: true, heal: 3, sell: 5,
    },
    meat_raw: {
        id: 'meat_raw', name: 'Мясо дичи (сырое)', emoji: '🥩',
        edible: false, heal: 0, sell: 3,
        cookTo: 'meat_cooked', cookToTasty: 'meat_cooked_tasty', cookMinutes: 30,
    },
    meat_cooked: {
        id: 'meat_cooked', name: 'Жаркое из дичи', emoji: '🍖',
        edible: true, heal: 3, sell: 5,
    },
    meat_cooked_tasty: {
        id: 'meat_cooked_tasty', name: 'Жаркое (удалось на славу)', emoji: '🍖',
        edible: true, heal: 4, sell: 6,
    },
    // Раунд 66.70 (приказы 3,4): ягоды и грибы — отдельные ПРЕДМЕТЫ узла.
    // Ягоды едят сразу как еду (+1 HP, правила meal.js); сырые грибы есть
    // НЕЛЬЗЯ — только готовить на костре (жареные грибы) или продать.
    // Оба товара принимают на постоялом дворе (приказ 4).
    berry: {
        id: 'berry', name: 'Ягоды лесные', emoji: '🫐',
        edible: true, heal: 1, sell: 1,
    },
    mushroom_raw: {
        id: 'mushroom_raw', name: 'Грибы (сырые)', emoji: '🍄',
        edible: false, heal: 0, sell: 1,
        cookTo: 'mushroom_fried', cookToTasty: 'mushroom_fried_tasty', cookMinutes: 30,
    },
    mushroom_fried: {
        id: 'mushroom_fried', name: 'Грибы жареные', emoji: '🍲',
        edible: true, heal: 2, sell: 2,
    },
    mushroom_fried_tasty: {
        id: 'mushroom_fried_tasty', name: 'Грибы жареные (удались на славу)', emoji: '🍲',
        edible: true, heal: 3, sell: 3,
    },
    // Раунд 66.70 (приказы 7,8,13): зверобой — ЛЕКАРСТВЕННАЯ трава (не еда):
    // в узел, применение — проверка «Знахарства» (+3 HP; провал — трава
    // впустую; при полном HP трава ОСТАЁТСЯ в узле).
    herb: {
        id: 'herb', name: 'Зверобой (целебная трава)', emoji: '🌿',
        edible: false, medicinal: true, heal: 1, sell: 5,
    },
    // Раунд 66.70 (приказ 8): снятие шкур — проверка «Выживания».
    // Шкура — товар (постоялый двор/мясник), не еда.
    skin: {
        id: 'skin', name: 'Шкура (зверя)', emoji: '🟫',
        edible: false, heal: 0, sell: 4,
    },
    // Патч 66.73 (приказ 13): ЦЕННЫЙ ЛУТ при критическом разделке —
    // клыки волка и рога косули уходят на продажу (товар, не еда).
    // Выпадают ТОЛЬКО при критической удаче (крит проверки Выживания).
    wolf_fangs: {
        id: 'wolf_fangs', name: 'Волчьи клыки (трофей)', emoji: '🦷',
        edible: false, heal: 0, sell: 8, trophy: true,
    },
    roe_antlers: {
        id: 'roe_antlers', name: 'Рога косули (трофей)', emoji: '🦌',
        edible: false, heal: 0, sell: 10, trophy: true,
    },
    // ============================================================
    // ПАТЧ 66.74 (приказы 3, 12–15 владельца): ТОВАРЫ РУСИ XV ВЕКА —
    // промысловые и ремесленные (мёд/воск — главный экспорт Руси;
    // сукно/полотно/железо/горшки/убрус/зерно/сало — добро в сундуках
    // жителей, добытое навыком «Взлом», и шедевр гончара при крите
    // «Ремесла»). Все — на продажу (трактирщик/мясник); мёд и сало —
    // ещё и простая еда (+1 HP, правила meal.js).
    // ============================================================
    honey: {
        id: 'honey', name: 'Мёд лесной', emoji: '🍯',
        edible: true, heal: 1, sell: 6,
    },
    wax: {
        id: 'wax', name: 'Воск пчелиный', emoji: '🕯',
        edible: false, heal: 0, sell: 8,
    },
    sukon: {
        id: 'sukon', name: 'Сукно (отрез)', emoji: '🧵',
        edible: false, heal: 0, sell: 12,
    },
    polotno: {
        id: 'polotno', name: 'Полотно холщовое', emoji: '🧶',
        edible: false, heal: 0, sell: 8,
    },
    iron: {
        id: 'iron', name: 'Железная полоса', emoji: '🔩',
        edible: false, heal: 0, sell: 7,
    },
    clay_pot: {
        id: 'clay_pot', name: 'Горшок печёный', emoji: '🏺',
        edible: false, heal: 0, sell: 3,
    },
    // Крит «Ремесла» у гончара — «шедевр»: горшок мастеровой (дороже вдвое)
    master_pot: {
        id: 'master_pot', name: 'Горшок мастеровой (шедевр)', emoji: '🏺',
        edible: false, heal: 0, sell: 10, trophy: true,
    },
    ubrus: {
        id: 'ubrus', name: 'Убрус вышитый', emoji: '🧣',
        edible: false, heal: 0, sell: 6,
    },
    amber: {
        id: 'amber', name: 'Оберег янтарный', emoji: '📿',
        edible: false, heal: 0, sell: 15, trophy: true,
    },
    grain: {
        id: 'grain', name: 'Зерно (мешечек)', emoji: '🌾',
        edible: false, heal: 0, sell: 4,
    },
    salo: {
        id: 'salo', name: 'Сало солёное', emoji: '🥓',
        edible: true, heal: 1, sell: 4,
    },
};

/**
 * Прочие съестные припасы узла (простая еда — +1 HP).
 * Рацион: хлеб да вода на день дороги (продаёт трактирщик).
 */
export const SIMPLE_FOOD_DEFS = {
    ration: { id: 'ration', name: 'Рацион (хлеб да вода на день дороги)', emoji: '🥖', edible: true, heal: 1, sell: 1 },
};

/** Определение съестного/добычи по id узла (или null — не еда). */
export function getLootDef(itemId) {
    return LOOT_DEFS[itemId] || SIMPLE_FOOD_DEFS[itemId] || null;
}

/** Сколько штук предмета в узле (по ВСЕМ кучкам — патч 66.77: краденая кучка считается тоже). */
export function countOf(player, itemId) {
    if (!player || !Array.isArray(player.inventory)) return 0;
    return player.inventory
        .filter(i => i && i.id === itemId)
        .reduce((sum, i) => sum + (i.count || 1), 0);
}

/**
 * Добавить добычу в узел (кучкуется по id). Возвращает новый счётчик.
 * Патч 66.77: честное добро НЕ подмешивается в краденую кучку — при
 * наличии только краденой кучки создаётся отдельная честная запись.
 */
export function addItem(player, itemId, count = 1) {
    if (!player) return 0;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    const def = getLootDef(itemId);
    const name = def ? def.name : t(itemId);
    let it = player.inventory.find(i => i && i.id === itemId && !i.stolen);
    if (it) {
        it.count = (it.count || 1) + count;
    } else {
        it = { id: itemId, name, count, type: 'loot' };
        player.inventory.push(it);
    }
    return it.count;
}

/**
 * Убрать count штук из узла. Возвращает сколько реально убрано.
 * Патч 66.77: расход идёт сначала из ЧЕСТНЫХ записей (краденое —
 * отдельной записью — продать можно только скупщику за 20%,
 * а съесть/израсходовать честное добро естественнее).
 */
export function removeItem(player, itemId, count = 1) {
    if (!player || !Array.isArray(player.inventory)) return 0;
    const matches = player.inventory.filter(i => i && i.id === itemId);
    if (matches.length === 0) return 0;
    matches.sort((a, b) => (a.stolen ? 1 : 0) - (b.stolen ? 1 : 0)); // честные первыми
    let taken = 0;
    for (const it of matches) {
        if (taken >= count) break;
        const have = it.count || 1;
        const take = Math.min(have, count - taken);
        it.count = have - take;
        taken += take;
        if (it.count <= 0) player.inventory = player.inventory.filter(i => i !== it);
    }
    return taken;
}

/**
 * ПАТЧ 66.77 (приказ владельца 2): КРАДЕНЕЕ — отдельная запись узла.
 * Лут из сундуков (Взлом, burglary.js) НЕ смешивается с честным добром:
 * та же самая вещь рядом с честной лежит отдельной кучкой со флагом
 * stolen:true. Скупщики платят за краденое НА 80% МЕНЬШЕ стандартной
 * покупной (fencePriceOf) — и строка в скупке помечена «(краденое)».
 * Возвращает новый счётчик краденой кучки.
 */
export function addStolenItem(player, itemId, count = 1) {
    if (!player) return 0;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    const def = getLootDef(itemId);
    const name = def ? def.name : t(itemId);
    let it = player.inventory.find(i => i && i.id === itemId && i.stolen);
    if (it) {
        it.count = (it.count || 1) + count;
    } else {
        it = { id: itemId, name, count, type: 'loot', stolen: true };
        player.inventory.push(it);
    }
    return it.count;
}

/** Цена КРАДЕНОГО за 1 шт.: на 80% меньше стандартной скупки (приказ 2). */
export const STOLEN_SELL_DISCOUNT = 0.2; // платят 20% обычной цены скупки
export function fencePriceOf(baseSell) {
    return Math.max(1, Math.round((Number(baseSell) || 0) * STOLEN_SELL_DISCOUNT));
}

/**
 * Список добычи на продажу: [{ def, count, price, stolen, entry }].
 * Патч 66.77: строки идут ПО ЗАПИСЯМ узла — краденая кучка (stolen:true)
 * живёт отдельной строкой с ценой за 20% (fencePriceOf), честная — по
 * def.sell. Кнопки продажи работают с конкретной записью (entry).
 */
export function sellableLoot(player) {
    if (!player || !Array.isArray(player.inventory)) return [];
    const rows = [];
    player.inventory.forEach((entry) => {
        if (!entry || !entry.id) return;
        const def = getLootDef(entry.id);
        if (!def) return; // торговец берёт только добычу/товары из LOOT_DEFS
        const count = entry.count || 1;
        const stolen = !!entry.stolen;
        rows.push({ def, count, price: stolen ? fencePriceOf(def.sell) : def.sell, stolen, entry });
    });
    return rows;
}

/** Убрать штук из КОНКРЕТНОЙ записи узла (продажа краденого/честного). */
export function removeFromEntry(player, entry, count = 1) {
    if (!player || !Array.isArray(player.inventory) || !entry) return 0;
    const it = player.inventory.find(i => i === entry);
    if (!it) return 0;
    const have = it.count || 1;
    const take = Math.min(have, count);
    it.count = have - take;
    if (it.count <= 0) player.inventory = player.inventory.filter(i => i !== it);
    return take;
}

// (sellableLoot перенесён выше, к записям узла — патч 66.77)

/**
 * П.10: шанс попадания из лука по дичи — база по виду дичи + половина
 * навыка «Стрельба из лука», клэмп 5..90 (никогда не «верняк» и не ноль).
 */
export function shotChance(basePct, bowSkill) {
    const skill = Math.max(0, Number(bowSkill) || 0);
    return Math.max(5, Math.min(90, Math.round((Number(basePct) || 0) + skill * 0.5)));
}

/**
 * П.13: улов одной удачной рыбалки (штук сырой рыбы).
 *   зима (налим из лунки) — 1; осенний жор — +1; дождь — +1 (максимум 3);
 *   с ЧУЖОЙ удочкой каждая вторая рыба — хозяину: −1 (но не меньше 1).
 */
export function fishingCatchCount({ seasonId, raining, winter, ownRod }) {
    let n = 1;
    if (seasonId === 'autumn_feed') n += 1;
    if (raining) n += 1;
    if (winter) n = 1;                      // лунка: налим один, но верный
    if (!ownRod) n = Math.max(1, n - 1);    // доля хозяина чужой удочки
    return n;
}

/**
 * П.4: съесть припас из узла (жёсткие правила meal.js).
 * Возвращает { ok, reason, heal }:
 *   ok:true        — съедено (время пошло, кулдаун поставлен);
 *   reason:'cooldown'    — герой сыт (поп-ап уже показан);
 *   reason:'not_edible'  — сырым не едят (поп-ап с советом показан);
 *   reason:'no_item'     — предмета нет в узле.
 */
export function tryEatFood(scene, player, itemId) {
    const def = getLootDef(itemId);
    if (!def || !player) return { ok: false, reason: 'no_item', heal: 0 };
    if (countOf(player, itemId) <= 0) return { ok: false, reason: 'no_item', heal: 0 };

    // П.7: сырая рыба/мясо не едятся — только готовка или продажа.
    // Патч 66.73 (приказ 12): поп-ап с ДОСЛОВНЫМ предупреждением владельца
    // «Еда не пригодна в пищу!» — при попытке съесть сырые грибы, мясо, рыбу.
    if (!def.edible) {
        if (scene && scene.add) {
            createDialog(scene, t('⚠ Еда не пригодна в пищу!'),
                t('Сырым это не едят — сырые грибы, мясо и рыба непригодны в пищу! Приготовь на костре (лесное кострище, костёр пастухов или печь постоялого двора — 30 мин) или продай трактирщику/мяснику.'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
        }
        return { ok: false, reason: 'not_edible', heal: 0 };
    }

    // Единые правила еды: кулдаун 4 часа — «герой сытый» (поп-ап внутри).
    if (!canEat(scene.registry).ok) {
        showMealBlockedPopup(scene);
        return { ok: false, reason: 'cooldown', heal: 0 };
    }

    const heal = Math.max(0, Math.min(def.heal || 0, (player.HPmax || 10) - (player.HP || 0)));
    player.HP = (player.HP || 0) + heal;
    removeItem(player, itemId, 1);
    registerMeal(scene.registry);
    tickTime(scene.registry, MEAL_DURATION_MIN); // п.1: еда — ровно 1 час
    scene.registry.set('player', player);
    return { ok: true, reason: 'eaten', heal };
}

// ============================================================
// РАУНД 66.70 (приказы владельца 3, 9): ГОТОВКА НА КОСТРЕ — ПРОВЕРКА
// НАВЫКА «ГОТОВКА» (новый навык в Character.js).
//  • успех — сырьё (1 шт.) превращается в готовое блюдо (30 мин);
//  • НЕУДАЧА (и fumble) — ПРОДУКТЫ ПРОПАЛИ: сырьё испорчено на огне,
//    блюда нет (время и сырьё потрачены);
//  • КРИТИЧЕСКАЯ УДАЧА — качество готовки выше: блюдо сытнее на +1
//    (запись с bonus:1 в узле, «Съесть» даст +heal+1 HP);
//  • бонус молитвы (+5 к одной проверке, prayer.js) передаётся аргументом.
// ============================================================

/**
 * Готовка 1 сырой штуки на костре (лесное кострище / костёр пастухов).
 * @param {object} registry — игровой registry.
 * @param {object} player — игрок (player.inventory).
 * @param {string} rawId — id сырья (fish_raw / meat_raw / mushroom_raw).
 * @param {object} [opts] — { skill: значение навыка Готовка, bonus: бонус молитвы }.
 * @returns {{ ok:boolean, lost:boolean, crit:boolean, bonusHeal:number,
 *            reason:'no_item'|'not_cookable'|'lost'|'cooked' }}
 */
export function cookAtFire(registry, player, rawId, opts = {}) {
    const def = getLootDef(rawId);
    if (!player || !def || !def.cookTo) return { ok: false, lost: false, crit: false, bonusHeal: 0, reason: 'not_cookable' };
    if (countOf(player, rawId) <= 0) return { ok: false, lost: false, crit: false, bonusHeal: 0, reason: 'no_item' };

    // Сырьё забирается ДО броска: на провале оно пропадает (приказ 9).
    removeItem(player, rawId, 1);
    // Бонус молитвы: явный opts.bonus (тесты) ИЛИ списание активного благословения.
    const bless = opts.bonus != null ? (Number(opts.bonus) || 0) : consumePrayerBless(registry);
    const skillValue = Math.max(1, Math.min(99, hungrySkill(registry, (Number(opts.skill) || 1) + bless)));
    const res = skillCheck(skillValue);

    if (res.result === 'fail' || res.result === 'fumble') {
        // НЕУДАЧА: продукты пропали (сгорели/подгорели насухо).
        if (registry) registry.set('player', player);
        tickTime(registry, def.cookMinutes || 30); // время у костра потрачено
        return { ok: false, lost: true, crit: false, bonusHeal: 0, reason: 'lost', roll: res.roll, skill: skillValue };
    }

    const crit = res.result === 'critical';
    if (crit) {
        // КРИТ: качество готовки +1 — блюдо «удалось на славу» (лечит на +1 больше,
        // продаётся дороже — собственные определения *_tasty).
        addItem(player, def.cookToTasty || def.cookTo, 1);
    } else {
        addItem(player, def.cookTo, 1);
    }
    if (registry) registry.set('player', player);
    tickTime(registry, def.cookMinutes || 30);
    const producedId = crit ? (def.cookToTasty || def.cookTo) : def.cookTo;
    return { ok: true, lost: false, crit, bonusHeal: crit ? 1 : 0, producedId, reason: 'cooked', roll: res.roll, skill: skillValue };
}

// ============================================================
// РАУНД 66.70 (приказы владельца 7, 13): ПРИМЕНЕНИЕ ЛЕКАРСТВЕННЫХ ТРАВ —
// ПРОВЕРКА «ЗНАХАРСТВА» (кроме еды: еда — meal.js, без навыков).
//  • при полном Здоровье трава НЕ тратится: «Вы полностью здоровы.
//    Трава осталась в узле» (приказ 7);
//  • успех — лечение def.heal (зверобой +3 HP), 15 мин;
//  • особый/критический успех (BRP) — лечение ×2 (+6);
//  • НЕУДАЧА — лечение не удалось, трава потрачена впустую.
// ============================================================

/**
 * @param {object} registry, @param {object} player
 * @param {string} herbId — id лекарственной травы ('herb').
 * @param {object} [opts] — { skill: значение Знахарства, bonus: бонус молитвы }.
 * @returns {{ ok:boolean, reason:'no_item'|'not_medicinal'|'full_hp'|'failed'|'healed',
 *            heal:number, crit:boolean }}
 */
export function applyHerb(registry, player, herbId, opts = {}) {
    const def = getLootDef(herbId);
    if (!player || !def || !def.medicinal) return { ok: false, reason: 'not_medicinal', heal: 0, crit: false };
    if (countOf(player, herbId) <= 0) return { ok: false, reason: 'no_item', heal: 0, crit: false };

    // Приказ 7: при полном Здоровье трава ОСТАЁТСЯ В УЗЛЕ.
    if ((player.HP || 0) >= (player.HPmax || 10)) {
        return { ok: false, reason: 'full_hp', heal: 0, crit: false };
    }

    // Кулдаун трав 12 ч (канон 66.71) — сцена показывает поп-ап заранее;
    // здесь страхует прямые вызовы.
    const herbCd = canUseHerb(registry);
    if (!herbCd.ok) {
        return { ok: false, reason: 'herb_cooldown', minutesLeft: herbCd.minutesLeft, heal: 0, crit: false };
    }

    // Бонус молитвы: явный opts.bonus (тесты) ИЛИ списание благословения.
    const bless = opts.bonus != null ? (Number(opts.bonus) || 0) : consumePrayerBless(registry);
    const skillValue = Math.max(1, Math.min(99, hungrySkill(registry, (Number(opts.skill) || 1) + bless)));
    const res = skillCheck(skillValue);

    // Трава тратится при любой броске (кроме full_hp): даже при провале
    // снадобье испорчено (размял, пролил — приказ 13 в толковании «применения»).
    removeItem(player, herbId, 1);
    registerHerb(registry); // точка 12-часового отката (66.71)

    if (res.result === 'fail' || res.result === 'fumble') {
        if (registry) registry.set('player', player);
        return { ok: false, reason: 'failed', heal: 0, crit: false, roll: res.roll, skill: skillValue };
    }

    // BRP: особый успех — эффект ×2 (трава +1 → +2).
    const crit = res.special || res.result === 'critical';
    const want = (def.heal || 0) * (crit ? 2 : 1);
    const heal = Math.max(0, Math.min(want, (player.HPmax || 10) - (player.HP || 0)));
    player.HP = (player.HP || 0) + heal;
    if (registry) registry.set('player', player);
    // Время НЕ тратится (канон 66.71: отвар — не еда).
    return { ok: true, reason: 'healed', heal, crit, roll: res.roll, skill: skillValue };
}

// ============================================================
// РАУНД 66.70 (приказы владельца 8, 10): ВЫЖИВАНИЕ — ПРОВЕРЯЕМЫЙ НАВЫК.
//  • п.8: Выживание используется при сборе ТРАВ, ГРИБОВ и ЯГОД, при
//    снятии ШКУР и добыче МЯСА с дичи;
//  • п.10: сбор ягод — успех = ГОРСТЬ ягод (2 шт.); неудача = НИЧЕГО
//    не собрал; крит. удача = количество ×2 (4 шт.). Грибы/зверобой —
//    та же лестница (гриб 2/0/4, зверобой 1/0/2);
//  • обдир туши: успех = мясо по лестнице размера + шкура (у зверя);
//    неудача = неловкий обдир (половина мяса, без шкуры); крит = мясо ×2
//    и шкура. Бонус молитвы списывается первой проверкой (prayer.js).
// ============================================================

/** Сколько единиц сырья даёт УСПЕШНЫЙ сбор (крит — вдвое, провал — 0). */
export const GATHER_SUCCESS_AMOUNT = { berry: 2, mushroom: 2, herb: 1 };

/** id предмета узла для вида точки сбора. */
export function gatherItemId(kind) {
    if (kind === 'berry') return 'berry';
    if (kind === 'mushroom') return 'mushroom_raw';
    if (kind === 'herb') return 'herb';
    return null;
}

/**
 * Проверка Выживания при сборе (ягоды/грибы/травы). Добыча кладётся в узел.
 * @returns {{ ok:boolean, gathered:number, itemId:string|null,
 *             crit:boolean, roll:number, skill:number }}
 */
export function survivalGather(registry, player, kind, opts = {}) {
    const itemId = gatherItemId(kind);
    if (!itemId) return { ok: false, gathered: 0, itemId: null, crit: false, roll: 0, skill: 0 };
    const bless = opts.bonus != null ? (Number(opts.bonus) || 0) : consumePrayerBless(registry);
    const skill = Math.max(1, Math.min(99, hungrySkill(registry, (Number(opts.skill) || (player && player.skills && player.skills.survival) || 1) + bless)));
    const res = skillCheck(skill);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    const base = GATHER_SUCCESS_AMOUNT[kind] || 1;
    const gathered = failed ? 0 : (crit ? base * 2 : base);
    if (gathered > 0 && player) addItem(player, itemId, gathered);
    if (registry) registry.set('player', player);
    return { ok: !failed && gathered > 0, gathered, itemId, crit, roll: res.roll, skill };
}

/**
 * Проверка Выживания при обдире туши (мясо + шкура).
 * @param {Array<number>} meatRange — [мин, макс] по лестнице размера.
 * @param {boolean} hasSkin — есть ли шкура у зверя (заяц/косуля/волк — да; глухарь — нет).
 * @param {Function} [rng] — подмена в тестах (по умолчанию Math.random).
 * @returns {{ ok:boolean, meat:number, skin:number, trophy:number, crit:boolean, roll:number, skill:number }}
 */
export function survivalButcher(registry, player, meatRange, hasSkin, opts = {}, rng = Math.random) {
    const bless = opts.bonus != null ? (Number(opts.bonus) || 0) : consumePrayerBless(registry);
    const skill = Math.max(1, Math.min(99, hungrySkill(registry, (Number(opts.skill) || (player && player.skills && player.skills.survival) || 1) + bless)));
    const res = skillCheck(skill);
    const [min, max] = Array.isArray(meatRange) ? meatRange : [1, 1];
    const roll = () => min + Math.floor(rng() * (max - min + 1));
    let meat;
    let skin = 0;
    let trophy = 0;
    if (res.result === 'fail' || res.result === 'fumble') {
        meat = Math.max(1, Math.floor(roll() / 2)); // неловкий обдир — половина, без шкуры
    } else if (res.result === 'critical') {
        meat = roll() * 2;                          // крит: мясо ×2
        skin = hasSkin ? 1 : 0;
        // Патч 66.73 (приказ 13): КРИТИЧЕСКАЯ УДАЧА при разделке зверя
        // с ценным лутом — трофей в узел (клыки волка, рога косули — на продажу).
        if (opts.trophy && player) {
            addItem(player, opts.trophy, 1);
            trophy = 1;
        }
    } else {
        meat = roll();                              // обычный успех
        skin = hasSkin ? 1 : 0;
    }
    if (player) {
        if (meat > 0) addItem(player, 'meat_raw', meat);
        if (skin > 0) addItem(player, 'skin', skin);
    }
    if (registry) registry.set('player', player);
    return { ok: meat > 0, meat, skin, trophy, crit: res.result === 'critical', roll: res.roll, skill };
}

// ============================================================
// ПАТЧ 66.74 (приказ владельца 3): БОРТНИЧЕСТВО — проверяемый навык.
// «Навык: Бортничество — мёд и воск, дикие борти в лесу + пасека
// (уже в игре); главный экспорт Руси».
//  • дикие борти в лесу: провал — пчёлы ужалили (−1 HP, точка жива),
//    успех — соты с мёдом (2 шт. в узел), крит — мёд ×2 И воск (+1);
//  • пасека (культурные ульи): провал — впустую (без укусов — свой
//    дымокур под рукой), та же лестница мёда/воска;
//  • время и усталость — на стороне сцены (как у survivalGather).
// ============================================================

/**
 * Проверка Бортничества при добыче мёда из борти/улья.
 * @param {object} registry, @param {object} player
 * @param {object} [opts] — { skill: значение Бортничества, wild: дикая борть (укусы) }.
 * @returns {{ ok:boolean, honey:number, wax:number, stung:boolean, crit:boolean, roll:number, skill:number }}
 */
export function bortnikGather(registry, player, opts = {}) {
    const bless = opts.bonus != null ? (Number(opts.bonus) || 0) : consumePrayerBless(registry);
    const skill = Math.max(1, Math.min(99, hungrySkill(registry,
        (Number(opts.skill) || (player && player.skills && player.skills.beekeeping) || 1) + bless)));
    const res = skillCheck(skill);
    const failed = res.result === 'fail' || res.result === 'fumble';
    const crit = res.result === 'critical';
    let honey = 0;
    let wax = 0;
    let stung = false;
    if (failed) {
        // Пчёлы жалят только у ДИКИХ бортей (на пасеке — дымокур и убор)
        stung = !!opts.wild;
        if (stung && player) player.HP = Math.max(1, (player.HP || 1) - 1);
    } else {
        honey = crit ? 4 : 2;              // успех — 2, крит — «полный сот» ×2
        if (crit) wax = 1;                 // крит — ещё и воск (на продажу)
        if (player) {
            if (honey > 0) addItem(player, 'honey', honey);
            if (wax > 0) addItem(player, 'wax', wax);
        }
    }
    if (registry) registry.set('player', player);
    return { ok: !failed, honey, wax, stung, crit, roll: res.roll, skill };
}

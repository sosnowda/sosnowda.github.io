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
        cookTo: 'fish_cooked', cookMinutes: 30,
    },
    fish_cooked: {
        id: 'fish_cooked', name: 'Рыба печёная', emoji: '🍢',
        edible: true, heal: 2, sell: 4,
    },
    meat_raw: {
        id: 'meat_raw', name: 'Мясо дичи (сырое)', emoji: '🥩',
        edible: false, heal: 0, sell: 3,
        cookTo: 'meat_cooked', cookMinutes: 30,
    },
    meat_cooked: {
        id: 'meat_cooked', name: 'Жаркое из дичи', emoji: '🍖',
        edible: true, heal: 3, sell: 5,
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

/** Сколько штук предмета в узле. */
export function countOf(player, itemId) {
    if (!player || !Array.isArray(player.inventory)) return 0;
    const it = player.inventory.find(i => i && i.id === itemId);
    return it ? (it.count || 1) : 0;
}

/** Добавить добычу в узел (кучкуется по id). Возвращает новый счётчик. */
export function addItem(player, itemId, count = 1) {
    if (!player) return 0;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    const def = getLootDef(itemId);
    const name = def ? def.name : t(itemId);
    let it = player.inventory.find(i => i && i.id === itemId);
    if (it) {
        it.count = (it.count || 1) + count;
    } else {
        it = { id: itemId, name, count, type: 'loot' };
        player.inventory.push(it);
    }
    return it.count;
}

/** Убрать count штук из узла. Возвращает сколько реально убрано. */
export function removeItem(player, itemId, count = 1) {
    if (!player || !Array.isArray(player.inventory)) return 0;
    const it = player.inventory.find(i => i && i.id === itemId);
    if (!it) return 0;
    const have = it.count || 1;
    const take = Math.min(have, count);
    it.count = have - take;
    if (it.count <= 0) player.inventory = player.inventory.filter(i => i !== it);
    return take;
}

/** Список добычи на продажу: [{ def, count, price }] (по цене за 1 шт.). */
export function sellableLoot(player) {
    if (!player || !Array.isArray(player.inventory)) return [];
    const rows = [];
    Object.values(LOOT_DEFS).forEach((def) => {
        const count = countOf(player, def.id);
        if (count > 0) rows.push({ def, count, price: def.sell });
    });
    return rows;
}

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
    if (!def.edible) {
        if (scene && scene.add) {
            createDialog(scene, def.emoji + ' ' + t(def.name),
                t('Сырым это не едят: приготовь на костре (лесное кострище или костёр пастухов — 30 мин) или продай трактирщику/мяснику.'),
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

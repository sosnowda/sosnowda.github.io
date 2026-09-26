// ============================================================
// РАУНД 66.28 (приказ владельца, пп.5–12): СТРЕЛЫ И КОЛЧАН.
//
// Правила по приказу:
//  • п.5  — у лука есть БОЕПРИПАСЫ: стрелы;
//  • п.6  — стрелы живут в ОТДЕЛЬНОМ СЛОТЕ меню персонажа — КОЛЧАНЕ
//          (экран «Персонаж → Инвентарь», третья карточка снаряжения);
//  • п.7  — при СТРЕЛЬБЕ учитываются только экипированные стрелы
//          в колчане (стрелы из узла сами не тратятся);
//  • п.8  — попытка стрелять с пустым колчаном открывает ПОП-АП
//          предупреждение об отсутствии боеприпасов;
//  • п.9  — стрелы ПРОДАЮТСЯ (кузнец Данила и ремесленник Аверьян);
//  • п.10 — колчан вмещает НЕ БОЛЕЕ 10 стрел;
//  • п.11 — в ОДНОМ слоте инвентаря лежит ДО 10 стрел (лишние —
//          в новый слот);
//  • п.12 — покупка только ПАЧКАМИ ПО 10 ШТУК.
//
// Хранение:
//   player.quiver                — число стрел В КОЛЧАНЕ (0..QUIVER_CAP);
//   player.inventory[]           — { id:'arrows', name:'Стрелы', count, type:'ammo' }
//                                  (каждый слот не более ARROW_SLOT_CAP).
// ============================================================

import { t } from './i18n.js';

/** Вместимость колчана (п.10). */
export const QUIVER_CAP = 10;
/** Максимум стрел в одном слоте инвентаря (п.11). */
export const ARROW_SLOT_CAP = 10;
/** Размер пачки при покупке (п.12). */
export const ARROW_PACK_SIZE = 10;
/** Цена пачки из 10 стрел (деньги). */
export const ARROW_PACK_PRICE = 5;

/** Сколько стрел сейчас в колчане (0..10; для старых объектов — 0). */
export function getQuiver(player) {
    if (!player) return 0;
    return Math.max(0, Math.min(QUIVER_CAP, Math.floor(player.quiver || 0)));
}

/** Прямо выставить счётчик колчана (с клэмпом по вместимости). */
export function setQuiver(player, n) {
    if (!player) return 0;
    player.quiver = Math.max(0, Math.min(QUIVER_CAP, Math.floor(n || 0)));
    return player.quiver;
}

/** Лук экипирован в руки? */
export function hasBowEquipped(player) {
    return !!player && player.weaponId === 'bow';
}

/** Сколько стрел лежит в УЗЛЕ (по всем слотам). */
export function countInventoryArrows(player) {
    if (!player || !Array.isArray(player.inventory)) return 0;
    return player.inventory
        .filter(i => i && i.id === 'arrows')
        .reduce((sum, i) => sum + (i.count || 0), 0);
}

/**
 * Добавить n стрел в УЗЕЛ (п.11): существующие слоты 'arrows'
 * наполняются до 10, излишек — в новый слот (тоже не более 10).
 * @returns сколько стрел реально положено.
 */
export function addArrowsToInventory(player, n) {
    if (!player || !(n > 0)) return 0;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    let left = Math.floor(n);
    const slots = player.inventory.filter(i => i && i.id === 'arrows');
    for (const s of slots) {
        if (left <= 0) break;
        const free = ARROW_SLOT_CAP - (s.count || 0);
        if (free > 0) {
            const put = Math.min(free, left);
            s.count = (s.count || 0) + put;
            left -= put;
        }
    }
    while (left > 0) {
        const put = Math.min(ARROW_SLOT_CAP, left);
        player.inventory.push({ id: 'arrows', name: t('Стрелы'), count: put, type: 'ammo', emoji: '🪶' });
        left -= put;
    }
    return Math.floor(n) - left;
}

/**
 * НАЛОЖИТЬ стрелы из узла в колчан (до вместимости п.10).
 * @returns сколько стрел переложено.
 */
export function loadQuiver(player) {
    if (!player) return 0;
    const free = QUIVER_CAP - getQuiver(player);
    if (free <= 0) return 0;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    let moved = 0;
    // Сначала забираем из неполных слотов, потом из любых
    const slots = player.inventory.filter(i => i && i.id === 'arrows' && (i.count || 0) > 0)
        .sort((a, b) => (a.count || 0) - (b.count || 0));
    for (const s of slots) {
        if (moved >= free) break;
        const take = Math.min(free - moved, s.count || 0);
        s.count -= take;
        moved += take;
        if (s.count <= 0) player.inventory = player.inventory.filter(x => x !== s);
    }
    if (moved > 0) player.quiver = getQuiver(player) + moved;
    return moved;
}

/**
 * ВЫСЫПАТЬ все стрелы из колчана обратно в узел (по слотам ≤10, п.11).
 * @returns сколько стрел высыпано.
 */
export function unloadQuiver(player) {
    if (!player) return 0;
    const n = getQuiver(player);
    if (n <= 0) return 0;
    player.quiver = 0;
    addArrowsToInventory(player, n);
    return n;
}

/**
 * Истратить ОДНУ стрелу из колчана (выстрел — попал или промах,
 * стрела всё равно ушла, п.7).
 * @returns true — стрела была и потрачена; false — колчан пуст.
 */
export function spendArrow(player) {
    if (!player) return false;
    const q = getQuiver(player);
    if (q <= 0) return false;
    player.quiver = q - 1;
    return true;
}

/** Подпись колчана для HUD/меню: «10 стрел» / «1 стрела» / «2 стрелы» / «нет стрел». */
export function quiverWord(n) {
    if (!n || n <= 0) return t('нет стрел');
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t('стрела');
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t('стрелы');
    return t('стрел');
}

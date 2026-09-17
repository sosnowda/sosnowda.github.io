// Сундуки с лутом в деревне (раунд 11).
//
// РАУНД 39 (п.13 заявки владельца): «УДАЛИТЬ ИЗ ИГРЫ ВСЕ ТЮКИ, СУНДУКИ И ЛАРЦЫ!»
// Список CHESTS ПУСТ — уличные сундуки/тюки/ларцы больше не спавнятся
// (тайлы 'C' на карте не появляются, спрайты не рисуются, взаимодействие
// по E недоступно). Домашние тайники STASHES (кнопки «Мой тюк»/«Мой узел»
// в интерьерах) тоже удалены.
//
// Функции-помощники оставлены: их всё ещё использует игровая логика
// (молитва у креста «раз в день», лесной тайник разбойников и т.п.).
import { t, tf } from '../systems/i18n.js';

export const CHESTS = [];

// Достать сундук по координатам тайла (для updateNearestInteractable)
export function chestAt(col, row) {
    return CHESTS.find(c => c.col === col && c.row === row) || null;
}

// Ключ игрового дня из timeState (та же формула, что в InteriorScene.dayKey)
export function dayKeyOf(timeState) {
    return timeState
        ? `${timeState.yearFromChrist}-${timeState.month}-${timeState.day}`
        : 'unknown';
}

// Уже открыт сегодня?
export function isOpenedToday(quest, chestId, today) {
    const list = (quest && quest.chestsOpened) || [];
    return list.some(e => e && e.id === chestId && e.day === today);
}

// Отметить открытие (мутирует quest, сохранение — на вызывающей стороне)
export function markOpened(quest, chestId, today) {
    if (!quest.chestsOpened) quest.chestsOpened = [];
    quest.chestsOpened.push({ id: chestId, day: today });
}

// Взвешенный выбор элемента лута
export function rollLoot(chest) {
    const total = chest.loot.reduce((s, l) => s + (l.weight || 1), 0);
    let roll = Math.random() * total;
    for (const l of chest.loot) {
        roll -= (l.weight || 1);
        if (roll <= 0) return l;
    }
    return chest.loot[chest.loot.length - 1];
}

// Человекочитаемое имя предмета (для всплывающего текста и лога)
export function lootDisplayName(loot, amount) {
    switch (loot.kind) {
        case 'money': return tf('+{0} денги', amount);
        case 'apple': return t('Яблоко: +2 ❤');
        case 'icon_scrap': return t('Медная иконка: +1 ⭐');
        default: return t('Пусто');
    }
}

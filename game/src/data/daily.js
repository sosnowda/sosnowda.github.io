// Дневные действия (раунд 66.10).
//
// РАУНД 66.10 (приказ владельца): «СУНДУКИ/ТАЙНИКИ НЕ НУЖНО, УДАЛИТЬ!» —
// уличные сундуки/тюки/ларцы и домашние тайники удалены из игры окончательно
// (вместе с файлом data/chests.js раунда 11). Здесь остались только хелперы
// «один раз в игровой день», которые использует живая механика:
// рыбалка на локациях (LocationScene, 'fish_daily') и лес (ForestScene).
//
// ВАЖНО (совместимость сейвов, правило 4 AGENTS.md): записи хранятся в
// quest.chestsOpened — ИСТОРИЧЕСКОЕ имя ключа из раунда 11, оно уже лежит в
// сейвах игроков. НЕ переименовывать.

// Ключ игрового дня из timeState (та же формула, что в InteriorScene.dayKey)
export function dayKeyOf(timeState) {
    return timeState
        ? `${timeState.yearFromChrist}-${timeState.month}-${timeState.day}`
        : 'unknown';
}

// Действие уже совершено сегодня? (читает quest.chestsOpened)
export function isActionDoneToday(quest, actionId, today) {
    const list = (quest && quest.chestsOpened) || [];
    return list.some(e => e && e.id === actionId && e.day === today);
}

// Отметить действие совершённым (мутирует quest, сохранение — на вызывающей стороне)
export function markActionDone(quest, actionId, today) {
    if (!quest.chestsOpened) quest.chestsOpened = [];
    quest.chestsOpened.push({ id: actionId, day: today });
}

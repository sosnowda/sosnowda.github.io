// Пасека — ходячая локация за околицей (раунд 16; раунд 17 — пчёлы ТОЛЬКО
// как антураж: ни боя с роем, ни добычи мёда, ни дымокура-механики —
// по прямому указанию владельца). Лесная поляна с колодными ульями,
// пчёлы кружат над ульями и цветами; дымокур у избушки мирно тлеет.
// Карта задана ASCII-сеткой по образцу forest.js — производные данные
// (ульи, дымокур, выход) читаются из карты, чтобы не разъезжались.
//
// Легенда:
//   T — густое дерево (НЕПРОХОДИМО, канопа)
//   t — одинокое дерево (НЕПРОХОДИМО)
//   . — трава (проходимо)
//   , — трава с куртиной (проходимо, декор)
//   w — цветы (проходимо, декор — пчёлы кружат и тут)
//   r — валун (НЕПРОХОДИМ)
//   U — колодный улей (НЕПРОХОДИМ, наблюдение за пчёлами с соседнего тайла)
//   H — избушка пасечника (НЕПРОХОДИМА, декор)
//   F — дымокур (НЕПРОХОДИМ, тлеет для антуража)
//   E — выход к околице (проходимо, южная кромка)

import { t } from '../systems/i18n.js';
import { getSeason } from '../systems/TimeSystem.js';

export const APIARY_COLS = 26;
export const APIARY_ROWS = 20;

export const APIARY_MAP = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'Tt..,T....T,,...T...w,..tT',
    'T.,....w,....T....,T...w.T',
    'T..T.,..,......,....TH.,.T',
    'T.w,....,..F.....T.,.....T',
    'T..,..T....,....w,....T..T',
    'T.,...U.,...U.,...U.,....T',
    'T....,....w....,......,..T',
    'Tt..T..,....T....,w...T..T',
    'T.,....,......,....,....wT',
    'T....U.,...U.,...U.,..r..T',
    'T.w...,T......,..T....,..T',
    'T....,....T.w.....,....T.T',
    'Tt.,....,....,..T...w....T',
    'T...,T....,....,....,....T',
    'T.w....T....,..r...,T....T',
    'T....,....,w....T....,..tT',
    'T..T....,....,....,T.....T',
    'T.,....,....w....,....,..T',
    'TTTTTTTTTTTTTETTTTTTTTTTTT',
];

// Непроходимые буквы ('U' улей и 'F' дымокур — интерактив с соседней клетки,
// как ягодный куст в лесу; 'H' — декорация-домик)
export const APIARY_SOLID = new Set(['T', 't', 'r', 'U', 'H', 'F']);

// Точка появления игрока (юг, у выхода)
export const APIARY_SPAWN = { col: 13, row: 17 };

// Выход на околицу
export const APIARY_EXIT = { col: 13, row: 19 };

// Параметры антуража пасеки (раунд 17: без боя и добычи — только живость)
export const APIARY_CFG = {
    ambientBeesPerHive: 3,    // пчёл-декораций (орбитальных) у каждого улья
    swarmShimmers: 2,         // анимированных «кипящих» роев-мерцаний над ульями
};

// Активны ли пчёлы сейчас (системные хуки, как волки в дождь — раунд 14):
// спят зимой (сезон из таблицы месяцев TimeSystem: месяцы индексируются с сентября!),
// в осадки и ночью (с 21 до 6).
export function beesActive(timeState, weather) {
    if (!timeState) return false;
    if (getSeason(timeState.month) === 'winter') return false;
    if (weather && (weather.id === 'rain' || weather.id === 'thunder' || weather.id === 'snow')) return false;
    if (timeState.hour < 6 || timeState.hour >= 21) return false;
    return true;
}

// Точки сбора мёда: читаются из карты (буква 'U').
// Возвращает массив { id, col, row, prompt, label }.
export function apiaryHives() {
    const hives = [];
    for (let row = 0; row < APIARY_ROWS; row++) {
        const line = APIARY_MAP[row] || '';
        for (let col = 0; col < APIARY_COLS; col++) {
            if (line[col] === 'U') {
                hives.push({
                    id: `u${col}_${row}`,
                    col, row,
                    label: t('Колодный улей'),
                    prompt: t('Подойти к улью'),
                });
            }
        }
    }
    return hives;
}

// Дымокур — из карты (буква 'F') — мирно тлеет для антуража
export function smudgePos() {
    for (let row = 0; row < APIARY_ROWS; row++) {
        const col = (APIARY_MAP[row] || '').indexOf('F');
        if (col >= 0) return { col, row };
    }
    return { col: 11, row: 4 };
}

// Избушка пасечника — из карты (буква 'H')
export function hutPos() {
    for (let row = 0; row < APIARY_ROWS; row++) {
        const col = (APIARY_MAP[row] || '').indexOf('H');
        if (col >= 0) return { col, row };
    }
    return { col: 21, row: 3 };
}

export function apiaryTileAt(col, row) {
    if (col < 0 || row < 0 || col >= APIARY_COLS || row >= APIARY_ROWS) return 'T';
    return APIARY_MAP[row][col] || 'T';
}

export function isApiarySolid(col, row) {
    return APIARY_SOLID.has(apiaryTileAt(col, row));
}

/**
 * Валидация карты пасеки: BFS от точки спавна.
 * Проверяем достижимость: выход E, соседней клетки каждого улья U,
 * соседней клетки дымокура F. Возвращает { problems, reachableCount }.
 */
export function validateApiaryMap() {
    const problems = [];
    APIARY_MAP.forEach((line, i) => {
        if (line.length !== APIARY_COLS) {
            problems.push(`Строка ${i}: длина ${line.length} ≠ ${APIARY_COLS}`);
        }
    });

    const key = (c, r) => `${c},${r}`;
    const visited = new Set();
    const queue = [APIARY_SPAWN];
    visited.add(key(APIARY_SPAWN.col, APIARY_SPAWN.row));
    while (queue.length) {
        const { col, row } = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = col + dx, r = row + dy;
            if (c < 0 || r < 0 || c >= APIARY_COLS || r >= APIARY_ROWS) continue;
            if (visited.has(key(c, r)) || isApiarySolid(c, r)) continue;
            visited.add(key(c, r));
            queue.push({ col: c, row: r });
        }
    }

    const near = (spot) => {
        if (visited.has(key(spot.col, spot.row))) return true;
        return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
            visited.has(key(spot.col + dx, spot.row + dy)));
    };

    if (!near(APIARY_EXIT)) problems.push('Выход E недостижим от спавна');
    for (const hive of apiaryHives()) {
        if (!near(hive)) problems.push(`Улей ${hive.id} недостижим (нет соседней проходимой клетки)`);
    }
    if (!near(smudgePos())) problems.push('Дымокур F недостижим (декор)');
    if (isApiarySolid(APIARY_SPAWN.col, APIARY_SPAWN.row)) problems.push('Спавн на непроходимом тайле');

    return { problems, reachableCount: visited.size };
}

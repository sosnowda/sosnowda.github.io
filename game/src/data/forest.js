// Тёмный лес — ходячая локация за околицей (§5.1 роадмапа).
// Карта задана ASCII-сеткой: буква = тип тайла. Все производные данные
// (точки сбора, тайник, спавны) читаются из карты, чтобы не разъезжались.
//
// Легенда:
//   T — густое дерево (НЕПРОХОДИМО, канопа)
//   t — одинокое дерево (НЕПРОХОДИМО)
//   . — трава (проходимо)
//   , — трава с куртиной/опилом (проходимо, декор)
//   f — лесной пол (тёмная хвоя, проходимо)
//   r — валун (НЕПРОХОДИМ)
//   L — поваленный ствол (НЕПРОХОДИМ)
//   m — грибы (проходимо, сбор: +2 HP, раз в игровой день)
//   b — куст ягод (НЕПРОХОДИМ, сбор с соседнего тайла: +1 HP)
//   h — зверобой (проходимо, сбор: +3 HP, раз в игровой день)
//   C — кострище брошенного лагеря разбойников (НЕПРОХОДИМО, декор)
//   S — разбойничий тайник под корягой (НЕПРОХОДИМ, лут 1 раз за игру)
//   E — выход к околице (проходимо, южная кромка)

export const FOREST_COLS = 30;
export const FOREST_ROWS = 22;

export const FOREST_MAP = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'Tt..T,,f..T..tt....Tff,..t...T',
    'T.m..ffT....,....bT....m..T..T',
    'T..T.,....T....T...TffT..T...T',
    'T..,CS.L..,..T.....,....,...tT',
    'T.m....,..b...T..m....T......T',
    'T....T.....,......,..L...T.,.T',
    'Tt..T..hT....Tt........,....tT',
    'T..f..,....r.......T.........T',
    'T.bT....m.,....T.....,..m..b.T',
    'T....T.......b....,....T.....T',
    'T..r.....T......t..m....,..r.T',
    'T.m...,.....,........T..b....T',
    'T....T..b.,....T.,........,..T',
    'Tt....,....h........,..Tt....T',
    'T..L.......T...r..bT.........T',
    'T...,..T.m....,.....,..m...t.T',
    'T.m....,....T....t...........T',
    'T....bT..,......,..L...T..b..T',
    'Tt......,..T......,......,...T',
    'T...T....m....,T.....,..T....T',
    'TTTTTTTTTTTTTTE TTTTTTTTTTTTTT',
];

// Непроходимые буквы (с precision: 'b' куст — собирать с соседней клетки)
export const FOREST_SOLID = new Set(['T', 't', 'r', 'L', 'b', 'C', 'S']);

// Точка появления игрока (юг, у выхода)
export const FOREST_SPAWN = { col: 14, row: 19 };

// Выход на околицу
export const FOREST_EXIT = { col: 14, row: 21 };

// Логова волков (проверены на проходимость валидатором).
// den_mid отодвинут от спавна (14,19): при (14,13) волк за 3 хода патруля
// добегал до точки появления и рвал игрока на старте (найдено в QA).
export const WOLF_DENS = [
    { id: 'den_east', col: 20, row: 9 },
    { id: 'den_camp', col: 8, row: 5 },   // у старого лагеря разбойников
    { id: 'den_mid', col: 18, row: 14 },
];

// Параметры поведения волков (радиусы в px при тайле 48)
export const WOLF_CFG = {
    patrolSpeed: 70,      // медленное рысканье
    chaseSpeed: 205,      // быстрее игрока (160) — надо убегать или драться
    retreatSpeed: 185,    // отступление, когда стая напугана
    aggroRadius: 152,     // ~3.2 тайла — заметил
    loseRadius: 345,      // отрываешься — теряет интерес
    homeLeash: 345,       // дальше логова не уходит
    attackRadius: 34,     // контакт → бой
};

// Лут тайника разбойников (один раз за игру)
export const FOREST_STASH = {
    get col() { return stashPos().col; },
    get row() { return stashPos().row; },
    moneyMin: 12,
    moneyMax: 20,
    ambushChance: 0.35,   // разбойник вернулся в лагерь!
    ambushText: 'Краем глаза ты замечаешь движение между деревьями...\n\nРазбойник вернулся в свой лагерь!',
};

// Точки сбора: читаются из карты. Возвращает массив
// { id, kind: 'mushroom'|'berry'|'herb', col, row, hp, prompt, label }
// Раунд 15: подписи сбора локализованы (i18n).
import { t } from '../systems/i18n.js';

export function forestGatherSpots() {
    const spots = [];
    for (let row = 0; row < FOREST_ROWS; row++) {
        const line = FOREST_MAP[row] || '';
        for (let col = 0; col < FOREST_COLS; col++) {
            const ch = line[col];
            if (ch === 'm') {
                spots.push({
                    id: `m${col}_${row}`, kind: 'mushroom', col, row,
                    hp: 2, label: t('Грибы'), prompt: t('Сорвать грибы (+2 ❤)'),
                    actionLog: 'Собрал грибов в лесу.',
                    floatText: '+2 ❤', tint: 0xffd9a0,
                });
            } else if (ch === 'b') {
                spots.push({
                    id: `b${col}_${row}`, kind: 'berry', col, row,
                    hp: 1, label: t('Куст ягод'), prompt: t('Собрать ягоды (+1 ❤)'),
                    actionLog: 'Обобрал куст лесных ягод.',
                    floatText: '+1 ❤', tint: 0xffb0b0,
                });
            } else if (ch === 'h') {
                spots.push({
                    id: `h${col}_${row}`, kind: 'herb', col, row,
                    hp: 3, label: t('Зверобой'), prompt: t('Собрать зверобой (+3 ❤)'),
                    actionLog: 'Срезал зверобой на лесной поляне.',
                    floatText: '+3 ❤', tint: 0xffe9a0,
                });
            }
        }
    }
    return spots;
}

// Позиция тайника — из карты (буква 'S')
export function stashPos() {
    for (let row = 0; row < FOREST_ROWS; row++) {
        const col = (FOREST_MAP[row] || '').indexOf('S');
        if (col >= 0) return { col, row };
    }
    return { col: 5, row: 4 };
}

// Кострище лагеря — из карты (буква 'C')
export function campfirePos() {
    for (let row = 0; row < FOREST_ROWS; row++) {
        const col = (FOREST_MAP[row] || '').indexOf('C');
        if (col >= 0) return { col, row };
    }
    return { col: 4, row: 4 };
}

export function forestTileAt(col, row) {
    if (col < 0 || row < 0 || col >= FOREST_COLS || row >= FOREST_ROWS) return 'T';
    return FOREST_MAP[row][col] || 'T';
}

export function isForestSolid(col, row) {
    return FOREST_SOLID.has(forestTileAt(col, row));
}

/**
 * Валидация карты леса: BFS от точки спавна.
 * Проверяем достижимость: выход E, каждой точки сбора (или её соседней
 * клетки для кустов 'b'), тайника 'S' (соседняя клетка).
 * Возвращает { problems: string[], reachableCount: number }.
 */
export function validateForestMap() {
    const problems = [];
    // Ширина строк — все равны?
    FOREST_MAP.forEach((line, i) => {
        if (line.length !== FOREST_COLS) {
            problems.push(`Строка ${i}: длина ${line.length} ≠ ${FOREST_COLS}`);
        }
    });

    const key = (c, r) => `${c},${r}`;
    const visited = new Set();
    const queue = [FOREST_SPAWN];
    visited.add(key(FOREST_SPAWN.col, FOREST_SPAWN.row));
    while (queue.length) {
        const { col, row } = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = col + dx, r = row + dy;
            if (c < 0 || r < 0 || c >= FOREST_COLS || r >= FOREST_ROWS) continue;
            if (visited.has(key(c, r)) || isForestSolid(c, r)) continue;
            visited.add(key(c, r));
            queue.push({ col: c, row: r });
        }
    }

    const near = (spot) => {
        if (visited.has(key(spot.col, spot.row))) return true;
        return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
            visited.has(key(spot.col + dx, spot.row + dy)));
    };

    if (!near(FOREST_EXIT)) problems.push('Выход E недостижим от спавна');
    for (const spot of forestGatherSpots()) {
        if (!near(spot)) problems.push(`Точка сбора ${spot.id} недостижима`);
    }
    if (!near(stashPos())) problems.push('Тайник S недостижим');
    for (const den of WOLF_DENS) {
        if (isForestSolid(den.col, den.row)) problems.push(`Логово ${den.id} на непроходимом тайле`);
        if (!near(den)) problems.push(`Логово ${den.id} отрезано от спавна`);
    }
    if (isForestSolid(FOREST_SPAWN.col, FOREST_SPAWN.row)) problems.push('Спавн на непроходимом тайле');

    return { problems, reachableCount: visited.size };
}

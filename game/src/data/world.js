// Описание мира: карта деревни с 5 зданиями и воротами на выход.
// Символы карты:
//   '.' — трава, ',' — тропа, '~' — вода, 'T' — лес, '#' — камень,
//   'H' — стена дома, 'R' — крыша дома (непроходимые),
//   'D' — дверь (проходима, запускает вход в интерьер),
//   'G' — ворота на выход (проходима, запускает переход на развилку),
//   'F' — костёр (декорация), 'f' — забор (декорация), 'W' — колодец.

import { BUILDINGS, VILLAGE_GATE } from './interiors.js';

export const MAP_W = 26;
export const MAP_H = 18;

export const SOLID = new Set(['T', '~', '#', 'H', 'R', 'W']);
export const DOOR = new Set(['D']);
export const GATE = new Set(['G']);
export const INTERACTIVE = new Set(['D', 'G']);

// Возвращает ключ текстуры для символа тайла.
export function tileTexture(t, x, y) {
    switch (t) {
        case '.': return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case ',': return `tile_path_${((x + y) % 2 === 0) ? 0 : 1}`;
        case '~': return `tile_water_0`;
        case 'T': return `tile_forest_${(x * 3 + y * 5) % 2}`;
        case '#': return `tile_rock_${(x * 11 + y * 17) % 2}`;
        case 'H': return `tile_house_wall_${(x + y) % 3}`;
        case 'R': return `tile_house_roof_${(x * 2 + y) % 2}`;
        case 'G': return `tile_gate`;
        default: return 'tile_grass_0';
    }
}

// Построение сетки карты с 5 зданиями и воротами.
export function buildMap() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        const row = [];
        for (let x = 0; x < MAP_W; x++) {
            let t = '.';
            // Лес по периметру
            if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) t = 'T';
            row.push(t);
        }
        grid.push(row);
    }

    // Дорога-крест от ворот к центру
    // Вертикальная дорога (от ворот вглубь деревни)
    for (let y = 1; y < MAP_H - 1; y++) {
        if (grid[y][12] === '.') grid[y][12] = ',';
        if (grid[y][13] === '.') grid[y][13] = ',';
    }
    // Горизонтальная дорога
    for (let x = 1; x < MAP_W - 1; x++) {
        if (grid[9][x] === '.') grid[9][x] = ',';
        if (grid[10][x] === '.') grid[10][x] = ',';
    }

    // Размещаем здания
    BUILDINGS.forEach(b => {
        // Верхняя часть — крыша 'R', нижняя — стена 'H', в центре нижней строки — дверь 'D'
        for (let dy = 0; dy < b.h; dy++) {
            for (let dx = 0; dx < b.w; dx++) {
                const x = b.col + dx;
                const y = b.row + dy;
                if (!grid[y] || grid[y][x] === undefined) continue;
                if (dy === 0) grid[y][x] = 'R';
                else grid[y][x] = 'H';
            }
        }
        // Дверь — в центре нижней стены
        const doorX = b.col + Math.floor(b.w / 2);
        const doorY = b.row + b.h - 1;
        if (grid[doorY]) grid[doorY][doorX] = 'D';

        // Тропинка от двери к основной дороге
        // Прокладываем тропу вниз (или вверх) до ближайшей дороги
        let pathY = doorY + 1;
        while (pathY < MAP_H && grid[pathY] && grid[pathY][doorX] !== ',') {
            if (grid[pathY][doorX] === '.' || grid[pathY][doorX] === 'T') {
                grid[pathY][doorX] = ',';
            }
            pathY++;
        }
    });

    // Ворота на восточной границе
    grid[VILLAGE_GATE.row][MAP_W - 1] = 'G';

    // Несколько деревьев для атмосферы (не блокируя дороги)
    const trees = [[2, 3], [3, 8], [7, 14], [15, 13], [18, 6], [21, 5]];
    trees.forEach(([x, y]) => {
        if (grid[y] && grid[y][x] === '.') grid[y][x] = 'T';
    });

    // Колодец в центре деревни
    grid[7][14] = 'W';
    grid[7][15] = 'W';
    grid[8][14] = 'W';
    grid[8][15] = 'W';

    return grid;
}

// Сопоставление двери с интерьером
export function doorInteriorId(col, row) {
    for (const b of BUILDINGS) {
        const doorX = b.col + Math.floor(b.w / 2);
        const doorY = b.row + b.h - 1;
        if (col === doorX && row === doorY) return b.interiorId;
    }
    return null;
}

// Является ли тайл воротами?
export function isGate(col, row) {
    return col === MAP_W - 1 && row === VILLAGE_GATE.row;
}

// NPC: col/row — координаты тайла; sprite — ключ текстуры; dialogue — id диалога.
// В новой версии NPC живут внутри интерьеров, а не на карте деревни.
// На карте деревни их нет — только здания.
export const NPCS = [];

export const PLAYER_START = { col: 13, row: 15 };
export const LOCATION_NAME = 'Деревня Русь';

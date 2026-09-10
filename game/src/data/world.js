// Описание мира: карта деревни, NPC и точка старта игрока.
// Символы карты:
//   '.' — трава, ',' — тропа, '~' — вода, 'T' — лес, '#' — камень, 'H' — дом.
// Проходимые: '.', ','. Непроходимые: 'T', '~', '#', 'H'.

export const MAP_W = 26;
export const MAP_H = 18;

export const SOLID = new Set(['T', '~', '#', 'H']);

export const TILE_KEY = {
    '.': 'tile_grass',
    ',': 'tile_path',
    '~': 'tile_water',
    'T': 'tile_forest',
    '#': 'tile_rock',
    'H': 'tile_house',
};

// Построение сетки карты (программно, чтобы не считать символы вручную).
export function buildMap() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        const row = [];
        for (let x = 0; x < MAP_W; x++) {
            let t = '.';
            if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) t = 'T'; // лес по периметру
            row.push(t);
        }
        grid.push(row);
    }

    // Река справа (разделяет деревню и лес разбойников)
    for (let y = 1; y < MAP_H - 1; y++) {
        grid[y][18] = '~';
        grid[y][19] = '~';
    }
    // Мост через реку на девятой строке
    grid[9][18] = ',';
    grid[9][19] = ',';

    // Дома (блоки 2x2)
    const placeHouse = (cx, cy) => {
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                if (grid[cy + dy] && grid[cy + dy][cx + dx] !== undefined) {
                    grid[cy + dy][cx + dx] = 'H';
                }
            }
        }
    };
    placeHouse(3, 3);   // дом старейшины
    placeHouse(8, 5);   // дом купца
    placeHouse(5, 10);  // амбар
    placeHouse(11, 8);  // клеть

    // Несколько деревьев внутри для атмосферы
    const trees = [[14, 4], [16, 6], [15, 12], [20, 14], [7, 14], [13, 15]];
    trees.forEach(([x, y]) => { if (grid[y] && grid[y][x] === '.') grid[y][x] = 'T'; });

    return grid;
}

// NPC: col/row — координаты тайла; sprite — ключ текстуры; dialogue — id диалога.
// combat:true означает, что взаимодействие начинает бой.
export const NPCS = [
    { id: 'elder',    name: 'Старейшина',   col: 5,  row: 6,  sprite: 'npc_elder',    dialogue: 'elder',    color: 0xdddddd },
    { id: 'merchant', name: 'Купец',        col: 9,  row: 8,  sprite: 'npc_merchant', dialogue: 'merchant', color: 0xd4a017 },
    { id: 'soldier',  name: 'Раненый воин', col: 4,  row: 12, sprite: 'npc_soldier',  dialogue: 'soldier',  color: 0x9c2b2b },
    { id: 'bandit',   name: 'Разбойник',    col: 22, row: 9,  sprite: 'npc_bandit',   dialogue: 'bandit', color: 0x333333 },
];

export const PLAYER_START = { col: 3, row: 15 };
export const LOCATION_NAME = 'Деревня Русь';

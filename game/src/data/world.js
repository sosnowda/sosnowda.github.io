// Описание мира: карта деревни, NPC, точки интереса и декорации.
// Символы карты:
//   '.' — трава (рандомный вариант), ',' — тропа (рандомный вариант),
//   '~' — вода (анимированная), 'T' — лес, '#' — камень,
//   'H' — стена дома, 'R' — крыша дома, 'W' — колодец (декорация),
//   'F' — костёр (декорация), 'f' — забор (декорация).
// Проходимые: '.', ',', 'F', 'f'. Непроходимые: 'T', '~', '#', 'H', 'R', 'W'.

export const MAP_W = 26;
export const MAP_H = 18;

export const SOLID = new Set(['T', '~', '#', 'H', 'R', 'W']);

// Возвращает ключ текстуры для символа тайла.
// Для травы/тропы/леса/камня рандомно выбирает вариант — карта становится живее.
export function tileTexture(t, x, y) {
    switch (t) {
        case '.': return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case ',': return `tile_path_${((x + y) % 2 === 0) ? 0 : 1}`;
        case '~': return `tile_water_0`; // анимация управляется в VillageScene
        case 'T': return `tile_forest_${(x * 3 + y * 5) % 2}`;
        case '#': return `tile_rock_${(x * 11 + y * 17) % 2}`;
        case 'H': return `tile_house_wall_${(x + y) % 3}`;
        case 'R': return `tile_house_roof_${(x * 2 + y) % 2}`;
        default: return 'tile_grass_0';
    }
}

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

    // Дома (блоки 2×2: верхняя строка = крыша 'R', нижняя = стена 'H')
    const placeHouse = (cx, cy) => {
        // Верхняя часть — крыша
        grid[cy][cx] = 'R'; grid[cy][cx + 1] = 'R';
        // Нижняя часть — стена (с окном/дверью в случайном варианте)
        grid[cy + 1][cx] = 'H';
        grid[cy + 1][cx + 1] = 'H';
    };
    placeHouse(3, 3);   // дом старейшины
    placeHouse(8, 5);   // дом купца
    placeHouse(5, 10);  // амбар
    placeHouse(11, 8);  // клеть

    // Несколько деревьев внутри для атмосферы
    const trees = [[14, 4], [16, 6], [15, 12], [20, 14], [7, 14], [13, 15]];
    trees.forEach(([x, y]) => { if (grid[y] && grid[y][x] === '.') grid[y][x] = 'T'; });

    // Декорации (отдельный список — рисуются поверх тайлов)
    // 'W' — колодец (2×2), 'F' — костёр, 'f' — забор
    // Эти символы НЕ помещаем в grid — используем DECORATIONS ниже,
    // чтобы сохранить проходимость (декорации отдельно добавляются в SOLID при необходимости).

    return grid;
}

// Декорации: { type, col, row, solid }
// type: 'well' (2×2), 'campfire', 'fence'
export const DECORATIONS = [
    { type: 'well', col: 13, row: 9, solid: true },      // центр деревни
    { type: 'campfire', col: 7, row: 8, solid: false },  // у дома купца
    { type: 'fence', col: 6, row: 7, solid: false },
    { type: 'fence', col: 7, row: 7, solid: false },
    { type: 'fence', col: 8, row: 7, solid: false },
];

// NPC: col/row — координаты тайла; sprite — ключ текстуры; dialogue — id диалога.
// combat:true означает, что взаимодействие начинает бой.
export const NPCS = [
    { id: 'elder',    name: 'Старейшина',   col: 5,  row: 6,  sprite: 'npc_elder',    dialogue: 'elder',    color: 0xdddddd, portrait: 'portrait_elder' },
    { id: 'merchant', name: 'Купец',        col: 9,  row: 8,  sprite: 'npc_merchant', dialogue: 'merchant', color: 0xd4a017, portrait: 'portrait_merchant' },
    { id: 'soldier',  name: 'Раненый воин', col: 4,  row: 12, sprite: 'npc_soldier',  dialogue: 'soldier',  color: 0x9c2b2b, portrait: 'portrait_soldier' },
    { id: 'bandit',   name: 'Разбойник',    col: 22, row: 9,  sprite: 'npc_bandit',   dialogue: 'bandit',   color: 0x333333, portrait: 'portrait_bandit' },
];

export const PLAYER_START = { col: 3, row: 15 };
export const LOCATION_NAME = 'Деревня Русь';

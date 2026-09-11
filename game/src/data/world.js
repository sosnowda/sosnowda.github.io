// Описание мира: карта деревни с 6 зданиями, воротами и дорожной сетью.
// Символы карты:
//   '.' — трава, 'S' — песочная дорога, ',' — тропа, '~' — вода,
//   'T' — дерево (НЕ непроходимо, декорация), '#' — камень (непроходим),
//   'H' — стена дома (непроходим), 'R' — крыша дома (непроходим),
//   'D' — дверь (проходима, вход в интерьер),
//   'G' — ворота на выход (проходима, переход на развилку),
//   'W' — колодец (непроходим, декорация).

import { BUILDINGS, VILLAGE_GATE } from './interiors.js';

export const MAP_W = 26;
export const MAP_H = 18;

// ВАЖНО: деревья 'T' НЕ в SOLID — они декоративные, игрок проходит сквозь них.
// Только стены, вода, камни и колодец блокируют движение.
export const SOLID = new Set(['~', '#', 'H', 'R', 'W']);
export const DOOR = new Set(['D']);
export const GATE = new Set(['G']);
export const INTERACTIVE = new Set(['D', 'G']);

// Возвращает ключ текстуры для символа тайла.
export function tileTexture(t, x, y) {
    switch (t) {
        case '.': return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case 'S': return `tile_path_${((x + y) % 2 === 0) ? 0 : 1}`;
        case ',': return `tile_path_${((x + y) % 2 === 0) ? 0 : 1}`;
        case '~': return `tile_water_0`;
        case 'T': return `tile_forest_${(x * 3 + y * 5) % 2}`;
        case '#': return `tile_rock_${(x * 11 + y * 17) % 2}`;
        case 'H': return `tile_house_wall_${(x + y) % 3}`;
        case 'R': return `tile_house_roof_${(x * 2 + y) % 2}`;
        case 'G': return `tile_gate`;
        case 'W': return `tile_grass_0`;
        default: return 'tile_grass_0';
    }
}

// П.7: buildingTileTexture — упрощён, использует старые текстуры (точно загружены)
export function buildingTileTexture(t, x, y, buildingId) {
    return tileTexture(t, x, y);
}

// Построение сетки карты с дорожной сетью, зданиями и деревьями.
export function buildMap() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        const row = [];
        for (let x = 0; x < MAP_W; x++) {
            row.push('.');
        }
        grid.push(row);
    }

    // === ДОРОЖНАЯ СЕТЬ (п.5: песочные дороги, единая сеть) ===
    // Главная горизонтальная дорога через центр деревни (ряды 8-9)
    for (let x = 1; x < MAP_W - 1; x++) {
        grid[8][x] = 'S';
        grid[9][x] = 'S';
    }
    // Главная вертикальная дорога от ворот к центру (колонки 12-13)
    for (let y = 1; y < MAP_H - 1; y++) {
        grid[y][12] = 'S';
        grid[y][13] = 'S';
    }

    // === РАЗМЕЩЕНИЕ ЗДАНИЙ ===
    BUILDINGS.forEach(b => {
        // Верхняя часть — крыша 'R', нижняя — стена 'H'
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

        // Песочная дорожка от двери к ближайшей дороге (п.5)
        // Идём от двери вниз (или вверх) до первой дороги
        let pathY = doorY + 1;
        while (pathY < MAP_H && grid[pathY] && grid[pathY][doorX] !== 'S') {
            if (grid[pathY][doorX] === '.') {
                grid[pathY][doorX] = 'S';
            }
            pathY++;
        }
        // Если дорога не найдена внизу — идём вверх
        if (pathY >= MAP_H) {
            pathY = doorY - 1;
            while (pathY >= 0 && grid[pathY] && grid[pathY][doorX] !== 'S') {
                if (grid[pathY][doorX] === '.') {
                    grid[pathY][doorX] = 'S';
                }
                pathY--;
            }
        }
    });

    // === ДОПОЛНИТЕЛЬНЫЕ ДОРОЖКИ между зданиями ===
    // Дорожка от верхних зданий к нижним (колонка 5, 11, 17, 21)
    [5, 11, 17, 21].forEach(col => {
        for (let y = 7; y <= 11; y++) {
            if (grid[y] && grid[y][col] === '.') grid[y][col] = 'S';
        }
    });

    // === ВОРОТА на восточной границе ===
    grid[VILLAGE_GATE.row][MAP_W - 1] = 'G';
    // Дорожка к воротам
    grid[VILLAGE_GATE.row][MAP_W - 2] = 'S';

    // === ДЕРЕВЬЯ (п.8: больше деревьев, НЕ непроходимые) ===
    // Деревья по периметру, но НЕ блокируют движение
    for (let x = 0; x < MAP_W; x++) {
        if (grid[0][x] === '.') grid[0][x] = 'T';
        if (grid[MAP_H - 1][x] === '.') grid[MAP_H - 1][x] = 'T';
    }
    for (let y = 0; y < MAP_H; y++) {
        if (grid[y][0] === '.') grid[y][0] = 'T';
        if (grid[y][MAP_W - 1] === '.') grid[y][MAP_W - 1] = 'T';
    }
    // Отдельные деревья внутри деревни для атмосферы (п.8)
    const trees = [
        [2, 2], [3, 3], [7, 6], [14, 6], [18, 3], [22, 3],
        [2, 14], [7, 15], [14, 14], [18, 15], [22, 14],
        [1, 7], [24, 6], [1, 12], [24, 13],
        [8, 2], [15, 2], [19, 8], [3, 10], [23, 10],
    ];
    trees.forEach(([x, y]) => {
        if (grid[y] && grid[y][x] === '.') grid[y][x] = 'T';
    });

    // === КОЛОДЕЦ в центре деревни ===
    // Убираем колодец из SOLID — делаем его декорацией, а не препятствием
    // (он рисуется отдельно в VillageScene, здесь оставляем траву)

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

// Получить координаты двери здания
export function getDoorPosition(building) {
    return {
        col: building.col + Math.floor(building.w / 2),
        row: building.row + building.h - 1,
    };
}

export const PLAYER_START = { col: 13, row: 15 };

// Исторические названия деревень Руси XV века
export const HISTORICAL_VILLAGE_NAMES = [
    'Березовец', 'Волок Ламский', 'Городец на Волге', 'Двинская слобода',
    'Елец', 'Заозерье', 'Кистерма', 'Лукомлье', 'Медвежья Голова',
    'Новое Село', 'Опоки', 'Пёрмышль', 'Раковая слобода', 'Старая Руса',
    'Торжок-Новый', 'Углич-Поле', 'Холм Великий', 'Царёво Займище',
    'Чёрная Грязь', 'Шуя Малая', 'Верхний Млин', 'Боголюбово',
    'Вятская Поляна', 'Деревянница', 'Клещин городок', 'Муромское селище',
    'Плёс на Волге', 'Славянское', 'Тихвинское село', 'Великое Село',
];

let _currentVillageName = null;

export function getRandomVillageName() {
    return HISTORICAL_VILLAGE_NAMES[Math.floor(Math.random() * HISTORICAL_VILLAGE_NAMES.length)];
}

export function getVillageName() {
    if (!_currentVillageName) {
        _currentVillageName = getRandomVillageName();
    }
    return _currentVillageName;
}

export function resetVillageName() {
    _currentVillageName = null;
}

export const LOCATION_NAME = '';

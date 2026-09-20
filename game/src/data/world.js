// Описание мира: карта деревни. РАУНД 52 (п.5 приказа владельца): ДЕРЕВНЯ
// УПЛОТНЕНА НА ОДИН ЭКРАН — 26×15 тайлов (при тайле 48 мир = 1248×720 и
// влезает в окно 1280×720 целиком, обзор «🗺 Вся деревня» больше не нужен
// для компоновки). Застройка: три ряда домов (север/середина/юг), главная
// улица 'B' (ряд 5), южная грунтовая 'S' (ряд 10), ворота на востоке (25,5).
// Символы карты:
//   '.' — трава, 'S' — грунтовая дорожка (лента), 'B' — широкая песчаная улица,
//   '~' — вода (в деревне не используется — раунд 36), 'T' — дерево (НЕПРОХОДИМО),
//   '#' — камень (непроходим), 'H' — стена дома (непроходим),
//   'R' — крыша дома (непроходим), 'D' — дверь (проходима, вход в интерьер),
//   'G' — ворота на выход (проходима, переход на развилку),
//   'W' — колодец (непроходим, анимированная декорация),
//   'F' — костёр (непроходим, отдых у огня), 'X' — каменный крест (непроходим),
//   'C' — сундук (непроходим — сундуки удалены в раунде 39, символ запасной).

import { BUILDINGS, VILLAGE_GATE } from './interiors.js';
import { CHESTS } from './chests.js';

export const MAP_W = 26;
export const MAP_H = 15;

// ВАЖНО: деревья 'T' теперь НЕПРОХОДИМЫ (ствол) — раньше были декорацией,
// и игрок «проходил сквозь дерево», что выглядело как сломанные коллизии.
// Только дороги, трава, двери и ворота проходимы.
// Раунд 12: 'F' (костёр), 'X' (крест) и 'C' (сундук) тоже непроходимы —
// честные коллизии для новых интерактивных объектов.
export const SOLID = new Set(['~', '#', 'H', 'R', 'W', 'T', 'F', 'X', 'C']);
export const DOOR = new Set(['D']);
export const GATE = new Set(['G']);
export const INTERACTIVE = new Set(['D', 'G']);

// Проезжаемый символ? (для автотайла: сосед считается «дорогой»)
export function isRoadChar(t) {
    return t === 'S' || t === ',' || t === 'B' || t === 'G';
}

/**
 * Автотайл дороги: выбираем текстуру по соседям, чтобы дорога выглядела
 * НЕПРЕРЫВНОЙ ПЕСЧАНОЙ ЛЕНТОЙ (а не шахматной мешаниной H/V тайлов).
 * Текстуры: path_0 — горизонталь, path_1 — вертикаль,
 *           path_2 — угол (соединяет верх+лево при угле 0°),
 *           path_3 — крест/перекрёсток.
 * Возвращает { key, angle } — угол нужен для поворота угловой текстуры.
 */
export function roadTileSpec(x, y, grid) {
    const road = (xx, yy) => {
        const row = grid[yy];
        if (!row) return false;
        return isRoadChar(row[xx]);
    };
    const up = road(x, y - 1);
    const down = road(x, y + 1);
    const left = road(x - 1, y);
    const right = road(x + 1, y);
    const n = (up ? 1 : 0) + (down ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);

    if (n >= 3) return { key: 'tile_path_3', angle: 0 };            // Т/крест
    if (up && down) return { key: 'tile_path_1', angle: 0 };        // вертикаль
    if (left && right) return { key: 'tile_path_0', angle: 0 };     // горизонталь
    if (up && left) return { key: 'tile_path_2', angle: 0 };        // угол ↑←
    if (up && right) return { key: 'tile_path_2', angle: 90 };      // угол ↑→
    if (down && right) return { key: 'tile_path_2', angle: 180 };   // угол ↓→
    if (down && left) return { key: 'tile_path_2', angle: 270 };    // угол ↓←
    if (left || right) return { key: 'tile_path_0', angle: 0 };     // тупик гориз.
    if (up || down) return { key: 'tile_path_1', angle: 0 };        // тупик верт.
    return { key: 'tile_path_3', angle: 0 };                        // одиночный
}

// Возвращает ключ текстуры для символа тайла.
// grid — необязателен, но нужен дорогам ('S'/',') для автотайла.
export function tileTexture(t, x, y, grid) {
    switch (t) {
        case '.': return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case 'S':
        case ',':
            if (grid) return roadTileSpec(x, y, grid).key;
            return 'tile_path_0';
        case 'B': return `tile_road_${(x * 5 + y * 3) % 2}`; // сплошной песок
        case '~': return 'tile_water_0';
        case 'P': return 'tile_pier';   // мостки причала (раунд 12)
        case 'F':                       // под костром — трава (пламя рисует VillageScene)
        case 'C':                       // под сундуком — трава (спрайт сундука сверху)
            return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case 'X': return 'deco_cross';  // каменный крест (Y-сортировка)
        // Раунд 27 (п.1): под деревом — трава; само дерево рисуется
        // ПРОЗРАЧНЫМ спрайтом deco_tree_*/deco_pine_* (VillageScene),
        // чтобы не было квадратной «плашки» с фоном вокруг кроны.
        case 'T': return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case '#': return `tile_rock_${(x * 11 + y * 17) % 2}`;
        case 'H': return `tile_house_wall_${(x + y) % 3}`;
        case 'R': return `tile_house_roof_${(x * 2 + y) % 2}`;
        case 'G': return 'tile_gate';
        case 'W': return 'deco_well_0';
        case 'D': return 'tile_house_wall_1'; // дверь в стене (спрайт дома ляжет поверх)
        default: return 'tile_grass_0';
    }
}

// П.7: buildingTileTexture — упрощён, использует старые текстуры (точно загружены)
export function buildingTileTexture(t, x, y, buildingId) {
    return tileTexture(t, x, y);
}

// Построение сетки карты: единая дорожная сеть (непрерывные песчаные ленты),
// здания, колодец, камни и деревья.
export function buildMap() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        const row = [];
        for (let x = 0; x < MAP_W; x++) {
            row.push('.');
        }
        grid.push(row);
    }

    const set = (x, y, c) => {
        if (grid[y] && grid[y][x] !== undefined) grid[y][x] = c;
    };

    // === ДОРОЖНАЯ СЕТЬ (раунд 52: компактная; раунд 62 — дорожки
    // ПЕРЕПРОВЕДЕНЫ заново после переустановки домов, п.4 приказа) ===
    // 1) Вертикальные переулки 'S' — колонки 5, 13, 21 (зазоры между домами).
    [5, 13, 21].forEach(col => {
        for (let y = 1; y <= 14; y++) set(col, y, 'S');
    });
    // 2) Главная улица 'B' — ряд 5 (сплошной песок), до ворот на (25,5).
    for (let x = 1; x < MAP_W - 1; x++) grid[5][x] = 'B';
    // 3) Южная грунтовая улица 'S' — ряд 10 (двери средних домов выходят вниз).
    for (let x = 1; x <= 24; x++) set(x, 10, 'S');
    // 4) РАУНД 62 (п.4): НОВАЯ ЮЖНАЯ ОКОЛИЧНАЯ ДОРОЖКА — непрерывная лента
    // вдоль задних дворов южного ряда (ряд 14, колонки 2..21): дорожки
    // между домами больше не обрываются тупиками у дверей.
    for (let x = 2; x <= 21; x++) set(x, 14, 'S');

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

        // Песчаная дорожка от двери строго вниз до первой дороги.
        // (Раньше дорожка могла уходить «в никуда» или обходить дом сверху —
        // теперь вниз всегда есть переулок/южная лента, так что путь короткий
        // и непрерывный.)
        let pathY = doorY + 1;
        while (pathY < MAP_H && !isRoadChar(grid[pathY][doorX])) {
            if (grid[pathY][doorX] === '.') grid[pathY][doorX] = 'S';
            pathY++;
        }
    });

    // === КОЛОДЕЦ — в зазоре между домом Марфы и домом пахаря (кол 9, у южной улицы) ===
    // Непроходим, отрисуется анимированным спрайтом deco_well_0..3.
    set(9, 9, 'W');

    // === КАМЕННЫЙ КРЕСТ — тихий юго-западный угол у околицы (молитва) ===
    set(1, 9, 'X');

    // === СУНДУКИ — теперь непроходимы ('C') ===
    // Раунд 37: сундук у постоялого двора и сундук за амбаром удалены
    // (п.14 заявки); церковный перенесён с будущей дороги (18,12).
    CHESTS.forEach(c => set(c.col, c.row, 'C'));

    // === ХОЗЯЙСТВЕННЫЕ ПОСТРОЙКИ ('H' — честные коллизии) ===
    // Ставим ПОСЛЕ сундуков (не пересекаются по координатам), но ДО деревьев —
    // деревья сажаются только на траву '.', так что поверх построек не лягут.
    YARD_PROPS.forEach(p => {
        for (let dy = 0; dy < p.h; dy++) {
            for (let dx = 0; dx < p.w; dx++) {
                const y = p.row + dy, x = p.col + dx;
                if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 'H';
            }
        }
    });

    // === РАУНД 52: ОВЧАРНЯ — загон 'H' 3×2 на юго-востоке (кол 22–24,
    // ряды 11–12), рядом с избой дровосека. Овцы и сено рисует VillageScene
    // (координаты — константа SHEEPFOLD ниже).
    for (let y = 11; y <= 12; y++) {
        for (let x = 22; x <= 24; x++) {
            if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 'H';
        }
    }

    // === КАМНИ для разнообразия (непроходимы, текстура rock_0/1) ===
    // (камни [22,5] и [15,12] убраны — их место занял Амбар; часовня раунда 26 удалена — есть церковь)
    // Раунд 37: камень [8,13] убран — на этом месте теперь двор плотника.
    [
        [9, 3],
    ].forEach(([x, y]) => {
        if (grid[y] && grid[y][x] === '.') grid[y][x] = '#';
    });

    // === ВОРОТА на восточной границе ===
    grid[VILLAGE_GATE.row][MAP_W - 1] = 'G';
    // Полотно главной улицы (ряд 5) доходит до колонки 24, ворота в колонке 25.

    // === ДЕРЕВЬЯ (НЕПРОХОДИМЫ: ствол — честная коллизия) ===
    // Раунд 52: северный ряд и западная/восточная околицы — лес; на юге —
    // редкие деревья (там дворы южных домов). Деревья сажаются только на
    // траву '.', так что под застройку сами не прорастут.
    for (let x = 0; x < MAP_W; x++) {
        if (grid[0][x] === '.') grid[0][x] = 'T';
    }
    for (let y = 0; y < MAP_H; y++) {
        if (grid[y][0] === '.') grid[y][0] = 'T';
        // Раунд 57 (QA-фикс воротни): у ВОРОТ на восточной околице — ПОЛЯНА
        // (ряды 1..10 колонки 25 без сосен). Сосны 1.5× из колонки 25
        // перерывали башни воротни (78px крона каждой) — ворота «тонули в
        // лесу» и были не видны. Поляна шириной в 10 рядов честно показывает
        // парадную воротню при подходе по главной улице.
        const gateGlade = y >= 1 && y <= 10;
        if (!gateGlade && grid[y][MAP_W - 1] === '.') grid[y][MAP_W - 1] = 'T';
    }
    [1, 8, 16, 24].forEach(x => {
        if (grid[14][x] === '.') grid[14][x] = 'T';
    });
    // Отдельные деревья внутри деревни для атмосферы
    const trees = [
        [7, 4], [15, 4], [24, 4],
        [17, 9], [25, 9], [11, 14], [25, 13],
    ];
    trees.forEach(([x, y]) => {
        if (grid[y] && grid[y][x] === '.') grid[y][x] = 'T';
    });

    return grid;
}

/**
 * Проверка карты (QA коллизий и проходимости): BFS от точки старта игрока.
 * Возвращает список проблем: недостижимые двери, ворота, дорожные ленты.
 * Вызывается в VillageScene.create() — проблемы попадают в console.warn.
 */
export function validateMap(grid) {
    const passable = (x, y) => {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
        return !SOLID.has(grid[y][x]);
    };

    const seen = new Set([`${PLAYER_START.col},${PLAYER_START.row}`]);
    const queue = [[PLAYER_START.col, PLAYER_START.row]];
    while (queue.length) {
        const [x, y] = queue.shift();
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            const k = `${nx},${ny}`;
            if (!seen.has(k) && passable(nx, ny)) {
                seen.add(k);
                queue.push([nx, ny]);
            }
        });
    }

    const problems = [];
    BUILDINGS.forEach(b => {
        const doorX = b.col + Math.floor(b.w / 2);
        const doorY = b.row + b.h - 1;
        if (!seen.has(`${doorX},${doorY}`)) {
            problems.push(`дверь «${b.label}» (${doorX},${doorY}) недостижима`);
        }
    });
    if (!seen.has(`${MAP_W - 1},${VILLAGE_GATE.row}`)) {
        problems.push('ворота на восточной границе недостижимы');
    }
    // Раунд 12: конец причала 'P' должен быть достижим (рыбалка)
    // Раунд 36: причал удалён вместе с прудом — рыбалка теперь на Реке
    // (LocationScene), причальная проверка не нужна.
    // Каждая дорожка 'S' должна быть достижима (нет висящих лент)
    let orphanRoads = 0;
    for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
            if (grid[y][x] === 'S' && !seen.has(`${x},${y}`)) orphanRoads++;
        }
    }
    if (orphanRoads > 0) problems.push(`отрезанных дорожных тайлов: ${orphanRoads}`);

    return { reachable: seen, problems };
}

// === ХОЗЯЙСТВЕННЫЕ ПОСТРОЙКИ И ДЕТАЛИ ДВОРОВ (§3 village-visual-upgrade) ===
// Раунд 37 (заявка п.14, п.17): БАНЯ удалена; стога за амбаром убраны
// (амбар стал домом гончара); сундук/костёр у двора — в world.buildMap.
// Раунд 39 (пп.18,19 заявки): РИГА у дома старосты УДАЛЕНА (п.18),
// ОВИН у кузницы УДАЛЕН (п.19). Остались стога, поленница и телега.
// Овчарня — загон на второй улице (частокол рисуется отдельной веткой
// drawYardProps вместе с овцами).
export const YARD_PROPS = [
    { id: 'haystack', col: 24, row: 4,  w: 1, h: 1 },  // стог за лавкой ремесленника
    { id: 'firewood', col: 10, row: 4,  w: 1, h: 1 },  // поленница у кузницы (перед фасадом)
    { id: 'cart',     col: 17, row: 9,  w: 1, h: 1 },  // телега у дороги
];

// Овчарня (загон 'H'): координаты для drawSheepfold (VillageScene)
export const SHEEPFOLD = { col: 22, row: 11, w: 3, h: 2 };

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

export const PLAYER_START = { col: 12, row: 5 };  // раунд 52: на главной улице, в центре деревни

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

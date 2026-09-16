// Описание мира: карта деревни с 8 зданиями, воротами и дорожной сетью.
// Символы карты:
//   '.' — трава, 'S' — грунтовая дорожка (лента), 'B' — широкая песчаная улица,
//   '~' — вода (пруд, анимированная), 'T' — дерево (НЕПРОХОДИМО: ствол),
//   '#' — камень (непроходим),
//   'H' — стена дома (непроходим), 'R' — крыша дома (непроходим),
//   'D' — дверь (проходима, вход в интерьер),
//   'G' — ворота на выход (проходима, переход на развилку),
//   'W' — колодец (непроходим, анимированная декорация),
//   'P' — мостки причала (проходимы, поверх воды — рыбалка),
//   'F' — костёр (непроходим, отдых у огня),
//   'X' — каменный крест (непроходим, молитва/медитация),
//   'C' — сундук (непроходим — раунд 12: сквозь сундуки больше нельзя пройти).

import { BUILDINGS, VILLAGE_GATE } from './interiors.js';
import { CHESTS } from './chests.js';

export const MAP_W = 26;
export const MAP_H = 18;

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

    // === ДОРОЖНАЯ СЕТЬ (непрерывные ленты, без тупиков и обрывов) ===
    // 1) Грунтовые ленты 'S': вертикальные переулки (колонки 2, 7, 13, 19, 23)
    [2, 7, 13, 19, 23].forEach(col => {
        for (let y = 2; y <= 16; y++) set(col, y, 'S');
    });
    // 2) Поперечные ленты: северная (ряд 2) и южная (ряд 16)
    for (let x = 2; x <= 23; x++) {
        set(x, 2, 'S');
        set(x, 16, 'S');
    }
    // 3) Главная улица 'B' — широкое сплошное песчаное полотно (ряды 8-9).
    //    Рисуется ПОВЕРХ переулков, чтобы на перекрёстках не было прорех.
    for (let x = 1; x < MAP_W - 1; x++) {
        grid[8][x] = 'B';
        grid[9][x] = 'B';
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

    // === КОЛОДЕЦ в центре деревни (между таверной и домом Марфы) ===
    // Непроходим, отрисуется анимированным спрайтом deco_well_0..3.
    set(10, 10, 'W');

    // === РАУНД 12: ПРУД С ПРИЧАЛОМ на юго-западе (рыбалка) ===
    // Вода (6-10, 14-15), поверх неё — деревянные мостки 'P' (9, 14-15):
    // игрок заходит с южной дороги на причал и ловит рыбу.
    // Дерево (7,15) убрано под пруд; камень (8,13) остаётся — «валун у воды».
    for (let y = 14; y <= 15; y++) {
        for (let x = 6; x <= 10; x++) set(x, y, '~');
    }
    set(9, 14, 'P');
    set(9, 15, 'P');

    // === РАУНД 12: КОСТЁР у таверны (отдых путников) ===
    set(12, 7, 'F');

    // === РАУНД 12: КАМЕННЫЙ КРЕСТ на юго-западе (молитва) ===
    // Тихий угол у околицы, подальше от суеты.
    set(3, 12, 'X');

    // === РАУНД 12: СУНДУКИ — теперь непроходимы ('C') ===
    // Под спрайтом сундука появляется честная коллизия: сквозь сундук
    // больше нельзя пройти насквозь.
    CHESTS.forEach(c => set(c.col, c.row, 'C'));

    // === РАУНД 17: ХОЗЯЙСТВЕННЫЕ ПОСТРОЙКИ ('H' — честные коллизии) ===
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

    // === КАМНИ для разнообразия (непроходимы, текстура rock_0/1) ===
    // (камни [22,5] и [15,12] убраны — их место занял Амбар; часовня раунда 26 удалена — есть церковь)
    [
        [9, 3], [8, 13], [17, 15],
    ].forEach(([x, y]) => {
        if (grid[y] && grid[y][x] === '.') grid[y][x] = '#';
    });

    // === ВОРОТА на восточной границе ===
    grid[VILLAGE_GATE.row][MAP_W - 1] = 'G';
    // Полотно главной улицы уже доходит до колонки 24, ворота в колонке 25.

    // === ДЕРЕВЬЯ (НЕПРОХОДИМЫ: ствол — честная коллизия) ===
    // Деревья по периметру образуют естественную границу деревни.
    for (let x = 0; x < MAP_W; x++) {
        if (grid[0][x] === '.') grid[0][x] = 'T';
        if (grid[MAP_H - 1][x] === '.') grid[MAP_H - 1][x] = 'T';
    }
    for (let y = 0; y < MAP_H; y++) {
        if (grid[y][0] === '.') grid[y][0] = 'T';
        if (grid[y][MAP_W - 1] === '.') grid[y][MAP_W - 1] = 'T';
    }
    // Отдельные деревья внутри деревни для атмосферы
    // (дерево [22,3] убрано — на его месте вывеска Амбара; [7,15] — под прудом)
    const trees = [
        [2, 2], [3, 3], [7, 6], [14, 6], [18, 3],
        [2, 14], [14, 14], [18, 15], [22, 14],
        [1, 7], [24, 6], [24, 13],
        [8, 2], [15, 2], [19, 8], [3, 10], [23, 10],
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
    if (!seen.has('9,14')) {
        problems.push('конец причала (9,14) недостижим — рыбалка сломана');
    }
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

// === РАУНД 17: ХОЗЯЙСТВЕННЫЕ ПОСТРОЙКИ И ДЕТАЛИ ДВОРОВ (§3 village-visual-upgrade) ===
// Рига-сеновал у околицы (юго-запад), стога за амбаром, поленница у кузницы,
// телега у дороги. Все тайлы помечаются 'H' (непроходимы — честные коллизии),
// спрайты рисуются в VillageScene.drawYardProps() по этому списку.
// Рига/амбар — новые ТИПЫ зданий по плану (раньше амбар выглядел как таверна).
export const YARD_PROPS = [
    { id: 'riga',     col: 3,  row: 14, w: 2, h: 1 },  // рига-сеновал у околицы (не на дорожке дома Авдея — кол. 5)
    { id: 'haystack', col: 4,  row: 15, w: 1, h: 1 },  // стог подле риги
    { id: 'haystack', col: 20, row: 3,  w: 1, h: 1 },  // стог за амбаром (левый)
    { id: 'haystack', col: 22, row: 3,  w: 1, h: 1 },  // стог за амбаром (правый)
    { id: 'firewood', col: 16, row: 7,  w: 1, h: 1 },  // поленница у кузницы
    { id: 'cart',     col: 18, row: 7,  w: 1, h: 1 },  // телега у дороги
    // §3.1 (раунд 20): баня — у двора Авдея, ближе к пруду (вода для бани);
    // овин — у кузницы, у главной улицы (сушить снопы перед молотьбой в риге).
    // Клетки проверены по buildMap(): обе пары — чистая трава '.', дорожки,
    // двери и сундуки не перекрыты (BFS-валидатор подтверждает).
    { id: 'banya',    col: 5,  row: 10, w: 2, h: 1 },  // баня по-белому с трубой (дым — в drawYardProps)
    { id: 'ovin',     col: 14, row: 7,  w: 2, h: 1 },  // овин — шатёр для сушки снопов, тёплый дух
];

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

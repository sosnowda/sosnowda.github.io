// Описание мира: карта деревни (раунд 37 — РАСШИРЕННАЯ, 26×21, вариант Б:
// вторая улица на юге + 6 новых дворов), воротами и дорожной сетью.
// Символы карты:
//   '.' — трава, 'S' — грунтовая дорожка (лента), 'B' — широкая песчаная улица,
//   '~' — вода (в деревне больше НЕ используется — раунд 36; тайл остался
//         для локаций карты), 'T' — дерево (НЕПРОХОДИМО: ствол),
//   '#' — камень (непроходим),
//   'H' — стена дома (непроходим), 'R' — крыша дома (непроходим),
//   'D' — дверь (проходима, вход в интерьер),
//   'G' — ворота на выход (проходима, переход на развилку),
//   'W' — колодец (непроходим, анимированная декорация),
//   'P' — мостки причала (проходимы; раунд 36: в деревне не используется),
//   'F' — костёр (непроходим, отдых у огня),
//   'X' — каменный крест (непроходим, молитва/медитация),
//   'C' — сундук (непроходим — раунд 12: сквозь сундуки больше нельзя пройти).

import { BUILDINGS, VILLAGE_GATE } from './interiors.js';
import { CHESTS } from './chests.js';

export const MAP_W = 26;
// Раунд 37 (вариант Б, этап 1): карта расширена 18 → 21 за южной дорогой —
// вторая улица (ряды 18–19), 4 новых двора на ней, овчарня и задворки.
export const MAP_H = 21;

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
    // 1) Грунтовые ленты 'S': вертикальные переулки (колонки 2, 7, 13, 19, 23).
    //    Раунд 37: удлинены до новой улицы (ряд 17).
    [2, 7, 13, 19, 23].forEach(col => {
        for (let y = 2; y <= 17; y++) set(col, y, 'S');
    });
    // 2) Поперечные ленты: северная (ряд 2) и южная (ряд 14 — раунд 37:
    //    поднята с 16-го, чтобы дома старой улицы выходили прямо на грунт)
    for (let x = 2; x <= 23; x++) {
        set(x, 2, 'S');
        set(x, 14, 'S');
    }
    // 3) Главная улица 'B' — широкое сплошное песчаное полотно (ряды 8-9).
    //    Рисуется ПОВЕРХ переулков, чтобы на перекрёстках не было прорех.
    for (let x = 1; x < MAP_W - 1; x++) {
        grid[8][x] = 'B';
        grid[9][x] = 'B';
    }
    // 4) РАУНД 37 (вариант Б): ВТОРАЯ УЛИЦА 'B' — ряды 18–19.
    //    К ней выходят двери четырёх новых дворов; на восточном конце — овчарня.
    for (let x = 1; x <= 21; x++) {
        grid[18][x] = 'B';
        grid[19][x] = 'B';
    }
    // Соединение второй улицы с переулком 23 и краем карты
    for (let x = 22; x <= 24; x++) set(x, 18, 'B');

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

    // === РАУНД 36: ПРУД С ПРИЧАЛОМ УДАЛЁН (заявка владельца: «убрать тайлы
    // воды из деревни»). Рыбалка переехала на РЕКУ (локация карты,
    // LocationScene — кнопка «🎣 Рыбалка»).

    // === РАУНД 37: КОСТЁР У ПОСТОЯЛОГО ДВОРА УДАЛЁН (заявка владельца,
    // п.14: «удалить все сундуки, тюки и костёр около постоялого двора»). ===

    // === РАУНД 12: КАМЕННЫЙ КРЕСТ на юго-западе (молитва) ===
    // Тихий угол у околицы, подальше от суеты.
    set(3, 12, 'X');

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

    // === РАУНД 37 (вариант Б): ОВЧАРНЯ на восточном конце второй улицы ===
    // Загон 'H' 3×1 (частокол) на ряду 19; овцы и сено рисует VillageScene.
    for (let x = 22; x <= 24; x++) {
        if (grid[19] && grid[19][x] !== undefined) grid[19][x] = 'H';
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
    // (дерево [22,3] убрано — на его месте вывеска дома гончара; [7,15] — был под
    // прудом. Раунд 37: деревья на юге пересажены — старая южная околица (ряды
    // 14–16) застроена новыми дворами; деревья сажаются только на траву '.',
    // так что попавшие под застройку сами не прорастут.)
    const trees = [
        [2, 2], [3, 3], [7, 6], [14, 6], [18, 3],
        [1, 7], [24, 6],
        [8, 2], [15, 2], [19, 8], [3, 10], [23, 10],
        [1, 16], [6, 19], [13, 19],
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
    { id: 'haystack', col: 19, row: 3,  w: 1, h: 1 },  // стог за домом гончара
    { id: 'firewood', col: 16, row: 7,  w: 1, h: 1 },  // поленница у кузницы
    { id: 'cart',     col: 18, row: 7,  w: 1, h: 1 },  // телега у дороги
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

export const PLAYER_START = { col: 12, row: 18 };  // раунд 37: вторая улица (старый спавн застроен)

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

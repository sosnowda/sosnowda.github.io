// Описание мира: карта деревни. РАУНД 66 (п.6): дома переустановлены заново,
// дорожная сеть перерисована — ТОЛЬКО улицы (ряд 5 главная 'B', ряд 9
// средняя 'S', ряд 13 задняя 'S'), западный/восточный проезды (колонки 1
// и 24) и дорожки от дверей; переулки-«гребёнки» ведущие в никуда удалены.
// Застройка: три ряда домов, церковь+староста в центре, кузня у края.
// Символы карты:
//   '.' — трава, 'S' — грунтовая дорожка (лента), 'B' — широкая песчаная улица,
//   '~' — вода (в деревне не используется — раунд 36), 'T' — дерево (НЕПРОХОДИМО),
//   '#' — камень (непроходим), 'H' — стена дома (непроходим),
//   'R' — крыша дома (непроходим), 'D' — дверь (проходима, вход в интерьер),
//   'G' — ворота на выход (проходима, переход на развилку),
//   'W' — колодец (непроходим, анимированная декорация),
//   'L' — частокол (НЕПРОХОДИМ — раунд 65, п.8: кольцо вокруг деревни).
//   РАУНД 66.10: 'C' (сундук) удалено из легенды и SOLID — сундуки вырезаны
//   из игры по приказу владельца (chests.js больше не существует).

import { BUILDINGS, VILLAGE_GATE } from './interiors.js';

export const MAP_W = 26;
export const MAP_H = 15;

// ВАЖНО: деревья 'T' теперь НЕПРОХОДИМЫ (ствол) — раньше были декорацией,
// и игрок «проходил сквозь дерево», что выглядело как сломанные коллизии.
// Только дороги, трава, двери и ворота проходимы.
// Раунд 65 (пп.5,6): 'F' (костёр) и 'X' (крест) из деревни УДАЛЕНЫ —
// костёр с отдыхом переехал на Опушку леса, молитва — только в церкви.
// Раунд 65 (п.8): 'L' — частокол (кольцо вокруг деревни, кроме входа).
export const SOLID = new Set(['~', '#', 'H', 'R', 'W', 'T', 'F', 'X', 'L']);
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
        case 'F':                       // под костром — трава (пламя рисует ForestScene)
            return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case 'X': return 'deco_cross';  // каменный крест (в деревне больше не ставится)
        // Раунд 65 (п.8): частокол — заострённые брёвна (тайл из make_houses_r65)
        case 'L': return 'tile_palisade';
        // Раунд 27 (п.1): под деревом — трава; само дерево рисуется
        // ПРОЗРАЧНЫМ спрайтом deco_tree_*/deco_pine_* (VillageScene),
        // чтобы не было квадратной «плашки» с фоном вокруг кроны.
        case 'T': return `tile_grass_${(x * 7 + y * 13) % 4}`;
        case '#': return `tile_rock_${(x * 11 + y * 17) % 2}`;
        case 'H': return `tile_house_wall_${(x + y) % 3}`;
        case 'R': return `tile_house_roof_${(x * 2 + y) % 2}`;
        // Раунд 63 (п.4): тайл 'G' рисуется как обычная дорога — старый
        // tile_gate был повёрнут на 90° (столбы поперёк проезда). Ворота
        // теперь рисует VillageScene (village_gate_r63) поверх дороги.
        case 'G': return `tile_road_${(x * 5 + y * 3) % 2}`;
        case 'W': return 'deco_well_0';
        case 'D': return 'tile_house_wall_1'; // дверь в стене (спрайт дома ляжет поверх)
        default: return 'tile_grass_0';
    }
}

// П.7: buildingTileTexture — упрощён, использует старые текстуры (точно загружены)
export function buildingTileTexture(t, x, y, buildingId) {
    return tileTexture(t, x, y);
}

/**
 * РАУНД 65 (п.3 приказа): QA-проверка ЗАЗОРОВ между домами — дома не должны
 * срастаться ни друг с другом, ни с деревьями/прочими объектами. Между любыми
 * двумя зданиями должен быть зазор ≥1 тайл (по обеим осям, углы тоже).
 * @returns {string[]} список проблем (пустой — всё хорошо)
 */
export function checkBuildingSpacing() {
    const problems = [];
    for (let i = 0; i < BUILDINGS.length; i++) {
        for (let j = i + 1; j < BUILDINGS.length; j++) {
            const a = BUILDINGS[i], b = BUILDINGS[j];
            // расширяем прямоугольник a на 1 тайл — пересечение = срастание
            if (a.col - 1 < b.col + b.w && b.col < a.col + a.w + 1 &&
                a.row - 1 < b.row + b.h && b.row < a.row + a.h + 1) {
                problems.push(`«${a.interiorId}» и «${b.interiorId}» срастаются (зазор < 1 тайла)`);
            }
        }
        const b0 = BUILDINGS[i];
        if (b0.col < 1 || b0.row < 1 || b0.col + b0.w > MAP_W - 1 || b0.row + b0.h > MAP_H - 1) {
            problems.push(`«${b0.interiorId}» вплотную к частоколу/за границей`);
        }
    }
    return problems;
}

/**
 * РАУНД 66 (пп.9–11 приказа): валидатор РАЗМЕЩЕНИЯ ДЕРЕВЬЕВ.
 * Правила владельца:
 *   — дерево НЕ стоит на дороге/дорожке (только трава);
 *   — дерево НЕ перекрывает ВХОД В ДОМ: крона (эллипс до 3 тайлов вверх
 *     и ~2 тайла в стороны) не накрывает дверной тайл;
 *   — через крону МОЖНО ПРОЙТИ (проверяется коллизией только ствола —
 *     см. VillageScene: спрайт с Y-сортировкой, тело — один тайл);
 *   — деревья не стоят вплотную друг к другу (зазор ≥1 тайл);
 *   — подъезд к воротам (23–25 × 3–7) свободен от деревьев.
 * @param {number[][]} candidates — [col,row]
 * @param {string[][]} [grid] — сетка buildMap (если задана — проверяется
 *        что тайл ещё свободен: трава, не дорога/дом/колодец/частокол)
 * @returns {{accepted: number[][], rejected: string[]}}
 */
export function validateTreePlacement(candidates, grid) {
    const doors = BUILDINGS.map(b => ({
        x: b.col + Math.floor(b.w / 2),
        y: b.row + b.h - 1,
        label: b.label,
    }));
    const WELL = { x: 18, y: 7 };
    const accepted = [];
    const rejected = [];
    const crownHalfWidth = (u) => (u === 1 ? 1.5 : u === 2 ? 1.0 : u === 3 ? 0.5 : 0);

    candidates.forEach(([tc, tr]) => {
        const reject = (why) => rejected.push(`дерево (${tc},${tr}): ${why}`);
        if (tc < 1 || tr < 1 || tc > MAP_W - 2 || tr > MAP_H - 2) return reject('вне карты/вплотную к частоколу');
        if (grid) {
            const t = grid[tr] && grid[tr][tc];
            if (t !== '.') return reject(`тайл занят (${t || 'за границей'}) — не трава`);
        }
        // подъезд к воротам свободен
        if (tc >= 23 && tc <= 25 && tr >= 3 && tr <= 7) return reject('коридор у ворот');
        // не вплотную к колодцу
        if (Math.max(Math.abs(tc - WELL.x), Math.abs(tr - WELL.y)) <= 1) return reject('вплотную к колодцу');
        // крона не накрывает дверной тайл (п.11: «не перекрывали вход в дома»)
        for (const d of doors) {
            const u = tr - d.y;              // 0 — дерево в ряду двери; >0 — дверь выше дерева
            if (u < 0 || u > 3) continue;    // дверь ниже ствола/далеко — крона не достаёт
            const dx = Math.abs(tc - d.x);
            const half = u === 0 ? 0.6 : crownHalfWidth(u);
            if (dx <= half) return reject(`крона накрывает дверь «${d.label}» (${d.x},${d.y})`);
        }
        // зазор ≥1 тайл между деревьями
        for (const [ax, ay] of accepted) {
            if (Math.max(Math.abs(tc - ax), Math.abs(tr - ay)) < 2) {
                return reject(`вплотную к уже принятому дереву (${ax},${ay})`);
            }
        }
        accepted.push([tc, tr]);
    });
    return { accepted, rejected };
}

// Построение сетки карты: РАУНД 65 (п.10) — деревня СГЕНЕРИРОВАНА ЗАНОВО:
// сначала ЧАСТОКОЛ, затем дорожная сеть, затем дома (зазоры ≥1 тайла),
// колодец и деревья (без коллизий с дорогами/домами/другими деревьями).
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

    // === 1) ЧАСТОКОЛ (п.8): кольцо брёвен вокруг ВСЕЙ деревни, разрыв —
    // только вход на востоке (25,5) — там стоят ворота 'G'. ===
    for (let x = 0; x < MAP_W; x++) {
        set(x, 0, 'L');
        set(x, MAP_H - 1, 'L');
    }
    for (let y = 0; y < MAP_H; y++) {
        set(0, y, 'L');
        if (y !== VILLAGE_GATE.row) set(MAP_W - 1, y, 'L');
    }

    // === 2) ДОРОЖНАЯ СЕТЬ (п.6 раунда 66): ТОЛЬКО улицы, проезды и дорожки
    // от дверей — «избегая ненужных дорог, ведущих в никуда». ===
    // Главная улица 'B' — ряд 5 (сплошной песок), до ворот на (25,5).
    for (let x = 1; x < MAP_W - 1; x++) grid[5][x] = 'B';
    // Средняя улица 'S' — ряд 9: двери средних домов выходят ПРЯМО на неё.
    for (let x = 1; x <= 24; x++) set(x, 9, 'S');
    // Задняя грунтовая 'S' — ряд 13: двери южных домов выходят ПРЯМО на неё.
    for (let x = 1; x <= 24; x++) set(x, 13, 'S');
    // Западный проезд (колонка 1, ряды 6–12) — связывает три улицы
    // в ЕДИНУЮ СЕТЬ. Восточный проезд не нужен: сеть уже замкнута, а
    // лишних дорог по приказу (п.6) быть не должно. Больше никаких
    // переулков-«гребёнки».
    for (let y = 6; y <= 12; y++) set(1, y, 'S');

    // === 3) ЗДАНИЯ (п.10): зазор ≥1 тайла между любыми двумя (п.3); ===
    // QA-контроль срастания — проблемы попадают в консоль.
    const spacingProblems = checkBuildingSpacing();
    if (spacingProblems.length) {
        console.warn('[Деревня] Дома срастаются:', spacingProblems);
    }
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

        // Песчаная дорожка от двери строго вниз до первой дороги —
        // КАЖДАЯ дверь соединена с улицей (п.10).
        let pathY = doorY + 1;
        while (pathY < MAP_H && !isRoadChar(grid[pathY][doorX])) {
            if (grid[pathY][doorX] === '.') grid[pathY][doorX] = 'S';
            pathY++;
        }
    });

    // === 4) КОЛОДЕЦ — в зазоре между усадьбой старосты и домом пахаря (18,7); ===
    // жёны по воду — на средней улице рядом (ряд 9).
    set(18, 7, 'W');

    // === 5) ДЕРЕВЬЯ (п.9/10/11 раунда 66): НОВЫЕ АССЕТЫ
    // (Medieval_Expansion_Trees — см. tools/make_assets_r66.py). Сажаем
    // ТОЛЬКО на траву; КРОНА НЕ ДОЛЖНА ЗАКРЫВАТЬ ВХОД В ДОМ (п.11) —
    // кандидаты проверяет validateTreePlacement; между деревьями зазор ≥1
    // тайл; на дорогах и дорожках деревьев нет. Крона нависает над крышами
    // и дорогой — сквозь неё МОЖНО ПРОЙТИ (ствол — единственная коллизия). ===
    const TREES = [
        // Северные промежутки (кроны над крышами северного ряда)
        [4, 1], [10, 1], [14, 1], [18, 1], [22, 2],
        // Средний ряд: промежутки и передние дворы
        [5, 6], [9, 7], [13, 6], [22, 6],
        // Южный ряд: промежутки
        [5, 10], [9, 11], [13, 10], [17, 11], [21, 11],
    ];
    const treeReport = validateTreePlacement(TREES, grid);
    if (treeReport.rejected.length) {
        console.warn('[Деревня] Деревья-кандидаты отклонены валидатором:', treeReport.rejected);
    }
    treeReport.accepted.forEach(([x, y]) => {
        if (grid[y] && grid[y][x] === '.') grid[y][x] = 'T';
    });

    // === ВОРОТА на восточной границе (в разрыве частокола) ===
    grid[VILLAGE_GATE.row][MAP_W - 1] = 'G';
    // Полотно главной улицы (ряд 5) доходит до колонки 24, ворота в колонке 25.

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

// === ХОЗЯЙСТВЕННЫЕ ПОСТРОЙКИ ===
// РАУНД 64 (п.7 приказа владельца): стога, поленница и телега удалены;
// РАУНД 65 (пп.5,6,7): костёр и крест тоже удалены из деревни — из
// игровых объектов остались только колодец ('W') — сбор у колодца.
export const YARD_PROPS = [];

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

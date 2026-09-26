// Тёмный лес — ходячая локация за околицей (§5.1 роадмапа).
// Карта задана ASCII-сеткой: буква = тип тайла. Все производные данные
// (точки сбора, кострище, спавны) читаются из карты, чтобы не разъезжались.
// Раунд 66.11 (приказ владельца: «НЕ ДОЛЖНО БЫТЬ НИКАКОГО РАЗБОЙНИЧЬЕГО
// ТАЙНИКА ИЛИ ЛОГОВА»): схрон 'S' с лутом и засадой вырезан насовсем;
// от кострища 'C' осталась только нейтральная стоянка лесников
// (отдых — раунды 65/66), без всяких чужаков.
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
//   C — старое кострище лесников (НЕПРОХОДИМО, декор; отдых 1 час)
//   E — выход к околице (проходимо, южная кромка)

export const FOREST_COLS = 30;
export const FOREST_ROWS = 22;

export const FOREST_MAP = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'Tt..T,,f..T..tt....Tff,..t...T',
    'T.m..ffT....,....bT....m..T..T',
    'T..T.,....T....T...TffT..T...T',
    'T..,C..L..,..T.....,....,...tT',
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
// Раунд 66.11: буква 'S' вырезана вместе с фичей.
export const FOREST_SOLID = new Set(['T', 't', 'r', 'L', 'b', 'C']);

// Точка появления игрока (юг, у выхода)
export const FOREST_SPAWN = { col: 14, row: 19 };

// Выход на околицу
export const FOREST_EXIT = { col: 14, row: 21 };

// Логова волков (проверены на проходимость валидатором).
// den_mid отодвинут от спавна (14,19): при (14,13) волк за 3 хода патруля
// добегал до точки появления и рвал игрока на старте (найдено в QA).
export const WOLF_DENS = [
    { id: 'den_east', col: 20, row: 9 },
    { id: 'den_camp', col: 8, row: 5 },   // у старого кострища (ид-имя легаси)
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
                    // Раунд 66.16 (приказ 2): грибы — еда, лечит ровно +1 HP
                    hp: 1, label: t('Грибы'), prompt: t('Сорвать грибы (+1 ❤)'),
                    actionLog: 'Собрал и съел грибов в лесу (час времени).',
                    floatText: '+1 ❤', tint: 0xffd9a0,
                });
            } else if (ch === 'b') {
                spots.push({
                    id: `b${col}_${row}`, kind: 'berry', col, row,
                    hp: 1, label: t('Куст ягод'), prompt: t('Собрать ягоды (+1 ❤)'),
                    actionLog: 'Обобрал и съел куст лесных ягод (час времени).',
                    floatText: '+1 ❤', tint: 0xffb0b0,
                });
            } else if (ch === 'h') {
                // Зверобой — лекарственная трава, НЕ еда (без кулдауна еды)
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

// Кострище лесников — из карты (буква 'C')
export function campfirePos() {
    for (let row = 0; row < FOREST_ROWS; row++) {
        const col = (FOREST_MAP[row] || '').indexOf('C');
        if (col >= 0) return { col, row };
    }
    return { col: 4, row: 4 };
}

// ============================================================
// РАУНД 66.17 (приказы 9,10,11): ЛЕСНАЯ ДИЧЬ.
//  • п.9: на поляне и в лесу водится дичь — крупные ПТИЦЫ и ЗАЙЦЫ;
//    КОСУЛЯ — редко и только в чаще (северная, самая густая часть карты).
//  • п.10: по дичи можно стрелять из лука — шанс зависит от вида дичи
//    (base) и навыка «Стрельба из лука» (см. shotChance в systems/loot.js);
//    лук должен быть В УЗЛЕ И ЭКИПИРОВАН (player.weaponId === 'bow').
//  • п.11: при обдире туши случайно выпадает мясо — объём по размеру
//    зверя (meat: [мин, макс]); с убитого волка тоже (CombatScene).
// РАУНД 66.28 (п.13): ЛЕСТНИЦА РАЗМЕРА — «ЧЕМ КРУПНЕЕ ДИЧЬ, ТЕМ БОЛЬШЕ
// МЯСА»: заяц 1–2 < глухарь 2–3 < косуля 4–6 < волк 5–9 (CombatScene).
// ============================================================
export const GAME_ANIMALS = {
    hare: {
        id: 'hare', name: 'Заяц', emoji: '🐇',
        tex: 'game_hare', corpseTex: 'game_hare_dead',
        base: 45,            // базовый шанс попадания (%)
        meat: [1, 2],        // мелкая дичь — мяса мало (п.13, лестница размера)
        fleeRadius: 120,     // ближе — ускакал
        speed: 190,
        scale: 1.6,
    },
    bird: {
        id: 'bird', name: 'Глухарь', emoji: '🦅',
        tex: 'game_bird', corpseTex: 'game_bird_dead',
        base: 30,            // летящую крупную птицу бить труднее
        meat: [2, 3],        // крупная птица: больше зайца (п.13)
        fleeRadius: 95,
        speed: 250,
        scale: 1.5,
        flying: true,        // спугнул — взлетает и исчезает
    },
    roe: {
        id: 'roe', name: 'Косуля', emoji: '🦌',
        tex: 'game_roe', corpseTex: 'game_roe_dead',
        base: 55,
        meat: [4, 6],        // крупная добыча — мяса много (п.13)
        fleeRadius: 140,
        speed: 215,
        scale: 2.0,
        rare: true,          // редко
        maxRow: 7,           // только в чаще (север карты)
    },
};

/**
 * План спавна дичи на ходячей карте Густого леса: список
 * { kind, col, row } по ПРОХОДИМЫМ тайлам (валидно для BFS-карты).
 * Зайцы (2–3) и глухари (1–2) — по всему лесу; косуля — шанс 25%,
 * только ряды 0..maxRow (чаща). rng подменяется в тестах.
 */
export function planForestAnimals(rng = Math.random) {
    const passable = [];
    for (let row = 0; row < FOREST_ROWS; row++) {
        for (let col = 0; col < FOREST_COLS; col++) {
            if (!isForestSolid(col, row)) passable.push({ col, row });
        }
    }
    const pick = (filter) => {
        const pool = passable.filter(filter);
        if (!pool.length) return null;
        return pool[Math.floor(rng() * pool.length)];
    };
    const plan = [];
    const hares = 2 + Math.floor(rng() * 2);           // 2–3
    const birds = 1 + Math.floor(rng() * 2);           // 1–2
    for (let i = 0; i < hares; i++) {
        const spot = pick(({ row }) => row >= 8 && row <= FOREST_ROWS - 3);
        if (spot) plan.push({ kind: 'hare', ...spot });
    }
    for (let i = 0; i < birds; i++) {
        const spot = pick(({ row }) => row >= 2 && row <= FOREST_ROWS - 3);
        if (spot) plan.push({ kind: 'bird', ...spot });
    }
    if (rng() < 0.25) {                                 // косуля — редко, в чаще
        const roeCfg = GAME_ANIMALS.roe;
        const spot = pick(({ row }) => row >= 1 && row <= roeCfg.maxRow);
        if (spot) plan.push({ kind: 'roe', ...spot });
    }
    return plan;
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
 * Проверяем достижимость: выход E и каждой точки сбора (или её соседней
 * клетки для кустов 'b'). Раунд 66.11: проверка 'S' снята (фича удалена).
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
    for (const den of WOLF_DENS) {
        if (isForestSolid(den.col, den.row)) problems.push(`Логово ${den.id} на непроходимом тайле`);
        if (!near(den)) problems.push(`Логово ${den.id} отрезано от спавна`);
    }
    if (isForestSolid(FOREST_SPAWN.col, FOREST_SPAWN.row)) problems.push('Спавн на непроходимом тайле');

    return { problems, reachableCount: visited.size };
}

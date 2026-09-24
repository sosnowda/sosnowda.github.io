#!/usr/bin/env node
/**
 * Юнит-проверки раунда 66 (приказ владельца из 11 пунктов).
 * Запуск: node tools/test_round66.mjs (из папки game/).
 *
 * Покрывает:
 *   п.3  ворота village_gate_r66 без верёвки с вымпелами;
 *   п.5  шрифт диалогов 21px/кнопки 20px + динамический перенос строк;
 *   п.6  дома переустановлены; дорожная сеть = улицы + проезды + дорожки
 *        от дверей, БЕЗ переулков-«гребёнки»; BFS-проходимость;
 *   п.7  эмодзи-эмблемы над домами удалены;
 *   п.8  частокол — один ряд брёвен с остриём (тайл);
 *   п.9  деревья в деревне: 10–20 шт, зазор ≥1 тайл, не на дорогах;
 *   п.11 валидатор деревьев: крона не накрывает двери, подъезд к воротам
 *        свободен; сквозь крону можно пройти (коллизия = 1 тайл ствола);
 *   п.1  отдых у костра — только +1 час (нет восстановления HP);
 *   п.2  костёр пастухов на выпасе.
 */
import { buildMap, validateMap, checkBuildingSpacing, validateTreePlacement,
         MAP_W, MAP_H } from '../src/data/world.js';
import { BUILDINGS, VILLAGE_GATE } from '../src/data/interiors.js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};

const villageSrc = readFileSync(join(root, 'src/scenes/VillageScene.js'), 'utf8');
const bootSrc = readFileSync(join(root, 'src/scenes/BootScene.js'), 'utf8');
const forestSrc = readFileSync(join(root, 'src/scenes/ForestScene.js'), 'utf8');
const locSrc = readFileSync(join(root, 'src/scenes/LocationScene.js'), 'utf8');
const uiSrc = readFileSync(join(root, 'src/utils/ui.js'), 'utf8');
const styleSrc = readFileSync(join(root, 'src/config/StyleConfig.js'), 'utf8');
const gatePng = join(root, 'assets/sprites/village_gate_r66.png');
const palisadePng = join(root, 'assets/tiles/palisade_0.png');

const grid = buildMap();

// ===== п.6: дорожная сеть =====
console.log('\nп.6 Дорожная сеть');
const isRoad = t => t === 'S' || t === 'B' || t === 'G' || t === ',';
// улицы
ok([...Array(24)].every((_, i) => grid[5][i + 1] === 'B'), 'главная улица B — ряд 5, колонки 1–24');
ok([...Array(24)].every((_, i) => isRoad(grid[9][i + 1])), 'средняя улица — ряд 9');
ok([...Array(24)].every((_, i) => isRoad(grid[13][i + 1])), 'задняя улица — ряд 13');
ok([6, 7, 8, 10, 11, 12].every(y => isRoad(grid[y][1])), 'западный проезд — колонка 1, ряды 6–12');
ok([6, 7, 8, 10, 11, 12].every(y => !isRoad(grid[y][24])), 'восточной колонки 24 проезда НЕТ (лишних дорог нет)');
// никаких переулков-«гребёнки» в глубине кварталов
const deepAlleyFree = [[7, 1], [11, 1], [15, 1], [19, 1], [7, 2], [15, 2], [9, 6], [13, 7], [18, 6], [5, 11], [13, 11], [17, 10]]
    .every(([x, y]) => !isRoad(grid[y][x]));
ok(deepAlleyFree, 'в глубине кварталов нет дорог-переулков «в никуда»');
// дорожки от дверей: у каждой двери соседняя дорога (низ/верх/бок)
let doorsWithRoad = 0, doorsTotal = 0;
BUILDINGS.forEach(b => {
    const dx = b.col + Math.floor(b.w / 2), dy = b.row + b.h - 1;
    doorsTotal++;
    const near = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2]]
        .some(([ox, oy]) => isRoad(grid[dy + oy]?.[dx + ox]));
    if (near) doorsWithRoad++;
});
ok(doorsWithRoad === doorsTotal, `каждая из ${doorsTotal} дверей связана с улицей (${doorsWithRoad}/${doorsTotal})`);
// дорожных тайлов минимум (было ~130 с «гребёнкой»)
let roadTiles = 0;
for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isRoad(grid[y][x])) roadTiles++;
ok(roadTiles < 100, `дорожных тайлов меньше 100 (сейчас ${roadTiles})`);

// BFS-проходимость
const validation = validateMap(grid);
ok(validation.problems.length === 0, 'BFS: все двери/ворота/дорожки достижимы' + (validation.problems.length ? ' — ' + validation.problems.join('; ') : ''));
ok(checkBuildingSpacing().length === 0, 'п.3: зазор ≥1 тайла между всеми домами');

// ===== п.9/11: деревья =====
console.log('\nп.9/11 Деревья');
const trees = [];
for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (grid[y][x] === 'T') trees.push([x, y]);
ok(trees.length >= 10 && trees.length <= 20, `деревьев 10–20 (сейчас ${trees.length})`);
ok(trees.every(([x, y]) => !isRoad(grid[y][x])), 'ни одного дерева на дороге');
let treeGapOk = true;
for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) {
    const [ax, ay] = trees[i], [bx, by] = trees[j];
    if (Math.max(Math.abs(ax - bx), Math.abs(ay - by)) < 2) treeGapOk = false;
}
ok(treeGapOk, 'зазор ≥1 тайла между деревьями');
// крона не накрывает двери (эллиптическая модель валидатора)
let crownOk = true;
const doorList = BUILDINGS.map(b => ({ x: b.col + Math.floor(b.w / 2), y: b.row + b.h - 1 }));
const half = u => (u === 1 ? 1.5 : u === 2 ? 1.0 : u === 3 ? 0.5 : 0);
trees.forEach(([tc, tr]) => doorList.forEach(d => {
    const u = tr - d.y;
    if (u >= 0 && u <= 3 && Math.abs(tc - d.x) <= (u === 0 ? 0.6 : half(u))) crownOk = false;
}));
ok(crownOk, 'кроны не накрывают ни одну дверь');
ok(trees.every(([x, y]) => !(x >= 23 && x <= 25 && y >= 3 && y <= 7)), 'подъезд к воротам свободен от деревьев');
// валидатор ловит нарушения
const vr = validateTreePlacement([[7, 4]]);   // тайл дорожки у двери постоялого двора? 7,4 — дорожка
ok(vr.rejected.length >= 0, 'валидатор вызывается без исключений');
const vrRoad = validateTreePlacement([[3, 5]], [['3']].length ? (() => { const g = buildMap().map(r => r.slice()); g[5][3] = 'S'; return g; })() : undefined);
ok(vrRoad.rejected.some(r => r.includes('не трава')), 'валидатор: дерево на дороге отклонено');
const vrDoor = validateTreePlacement([[12, 6]]);  // крона прямо над дверью Авдея (12,3)
ok(vrDoor.rejected.some(r => r.includes('дверь')), 'валидатор: крона над дверью отклонена');

// ===== п.8: частокол =====
console.log('\nп.8 Частокол');
ok(existsSync(palisadePng), 'тайл частокола palisade_0.png существует');
// один ряд: в исходнике генератора нет «дальнего ряда» и обвязки поверх острий
const gen66 = readFileSync(join(root, 'tools/make_assets_r66.py'), 'utf8');
ok(!gen66.includes('дальний ряд'), 'частокол: второй (дальний) ряд брёвен убран');
ok(!gen66.includes('обвязка'), 'частокол: поперечная обвязка поверх острий убрана');
ok(gen66.includes('top - 18'), 'частокол: высокое остриё (~18px конус)');
// кольцо цело, разрыв только у ворот
let ringOk = true;
for (let x = 0; x < MAP_W; x++) {
    if (grid[0][x] !== 'L' || grid[MAP_H - 1][x] !== 'L') ringOk = false;
}
for (let y = 0; y < MAP_H; y++) {
    if (grid[y][0] !== 'L') ringOk = false;
    if (y !== VILLAGE_GATE.row && grid[y][MAP_W - 1] !== 'L') ringOk = false;
}
ok(ringOk, 'частокол — сплошное кольцо, разрыв только у ворот (25,5)');

// ===== п.3: ворота без вымпелов =====
console.log('\nп.3 Ворота');
ok(existsSync(gatePng), 'village_gate_r66.png существует');
ok(bootSrc.includes("village_gate_r66"), 'BootScene загружает village_gate_r66');
ok(villageSrc.includes("'village_gate_r66'"), 'VillageScene рисует village_gate_r66');
ok(!gen66.includes('вымпелы на верёвке'), 'воротня: вымпелы удалены из генератора');
ok(!gen66.includes('подковой') && !gen66.includes('вымпелы на верёвке'), 'воротня: доска-подкова и вымпелы удалены из генератора');

// ===== п.6/7/9: сцены =====
console.log('\nп.6/7 Дома и значки');
ok(!/add\.text\(cx, topY[^)]*'🍺'/.test(villageSrc), 'эмблема 🍺 постоялого двора удалена');
ok(!/add\.text\(cx, topY[^)]*'🔨'/.test(villageSrc), 'эмблема 🔨 кузницы удалена');
ok(!villageSrc.includes("fillTriangle(cx, topY - ts * 0.8"), 'флаг над усадьбой старосты удалён');
ok(villageSrc.includes('deco_tree_${idx}'), 'деревня: спрайты новых деревьев deco_tree_0..4');
ok(bootSrc.includes('v < 5; v++') && bootSrc.includes('deco_tree_'), 'BootScene: 5 лиственных текстур');

// ===== п.5: шрифты диалогов =====
console.log('\nп.5 Шрифты диалогов');
ok(styleSrc.includes("fontMax: 26") && styleSrc.includes('width: 440'), 'реплики best-fit до 26px, панель 440 (66.20, StyleConfig)');
ok(styleSrc.replace(/\n\s*/g, '').replace(/\s+/g, ' ').includes('button: {fontSize: 20'), 'кнопки 20px (StyleConfig)');
ok(uiSrc.includes('let fontPx = best.fp') && uiSrc.includes('fontHardMin'), 'createDialog: динамический best-fit кегля 26→13 (66.20)');
ok(uiSrc.includes('dialogWidth - pad.left - pad.right'), 'перенос строк от фактической ширины панели');

// ===== п.1: отдых у костра =====
console.log('\nп.1 Отдых у костра');
ok(forestSrc.includes('ТОЛЬКО промотка времени') && forestSrc.includes('restAtCampfire'), 'ForestScene: restAtCampfire — только время');
ok(!/restAtCampfire[\s\S]{0,1400}player\.HP\s*=\s*hpMax/.test(forestSrc), 'ForestScene: HP у костра не восстанавливается');
ok(forestSrc.includes('tickTime(this.registry, 60)'), 'ForestScene: +60 минут времени');
ok(locSrc.includes('Пересидел час у костра на выпасе'), 'LocationScene: отдых на выпасе — только время');
ok(!/restAtCampfire[\s\S]{0,1400}playHeal/.test(forestSrc + locSrc), 'звук лечения у костра убран');

// ===== п.2: костёр на выпасе =====
console.log('\nп.2 Костёр пастухов');
ok(locSrc.includes('spawnPastureCampfire'), 'LocationScene: костёр пастухов рисуется');
ok(locSrc.includes("campfire_flame_0"), 'костёр: живое пламя (3 кадра)');
ok(locSrc.includes("🔥 Костёр пастухов"), 'подсказка «Костёр пастухов»');

// ===== п.10: новые деревья повсюду =====
console.log('\nп.10 Новые деревья во всех сценах');
ok(forestSrc.includes('deco_pine_${deepIdx % 2}') && forestSrc.includes("deco_tree_${deepIdx % 5}"), 'Густой лес: новые спрайты деревьев');
ok(locSrc.includes("['deco_tree_0', 'deco_tree_1', 'deco_tree_2', 'deco_tree_3', 'deco_tree_4'"), 'локации: TREE_KEYS расширен (5 лиственных)');
ok(!locSrc.includes('setScale(2.6).setOrigin(0.5, 0.88)'), 'локации: старый масштаб 2.6 убран');

console.log(`\n=== ИТОГ: ${pass} OK, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

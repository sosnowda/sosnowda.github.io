#!/usr/bin/env node
/**
 * Юнит-проверки раунда 65 (приказ владельца из 11 пунктов + дома из
 * пакета «Fantastic Buildings - Medieval»).
 * Запуск: node tools/test_round65.mjs (из папки game/).
 */
import { buildMap, validateMap, checkBuildingSpacing, MAP_W, MAP_H, SOLID } from '../src/data/world.js';
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

const village = readFileSync(join(root, 'src/scenes/VillageScene.js'), 'utf8');
const boot = readFileSync(join(root, 'src/scenes/BootScene.js'), 'utf8');
const forest = readFileSync(join(root, 'src/scenes/ForestScene.js'), 'utf8');
const wander = readFileSync(join(root, 'src/systems/NpcWander.js'), 'utf8');
const worldSrc = readFileSync(join(root, 'src/data/world.js'), 'utf8');
const interiorSrc = readFileSync(join(root, 'src/scenes/InteriorScene.js'), 'utf8');
const i18nSrc = readFileSync(join(root, 'src/systems/i18n.js'), 'utf8');

// Код без комментариев (проверки строк-методов не должны ловить исторические комментарии)
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
const villageCode = stripComments(village);
const bootCode = stripComments(boot);
const i18nCode = stripComments(i18nSrc);

console.log('— П.1: НПЦ не ходят вбок спиной —');
ok(!/\bMath\.round\((anchorX|anchorY|spr\.x|spr\.y)\s*\/\s*ts\)/.test(wander),
    'в NpcWander нет Math.round(x/ts) для тайлов спрайта');
ok(wander.includes('tileOf(anchorX)') && wander.includes('dirOf(tx - tileOf(spr.x)'),
    'тайл спрайта и направление шага считаются через Math.floor (tileOf)');

console.log('— П.2: анимация ходьбы игрока —');
ok(!village.includes('!this.playerObj.anims.isPlaying)'), 'условие «dir!==lastDir || !isPlaying» убрано');
ok(village.includes('запускается КАЖДЫЙ кадр движения'), 'ходьба запускается каждый кадр движения');

console.log('— П.3: дома не срастаются (коллизии) —');
ok(checkBuildingSpacing().length === 0,
    'зазор ≥1 тайла между всеми домами: ' + (checkBuildingSpacing().join('; ') || 'чисто'));
ok(worldSrc.includes('checkBuildingSpacing()'), 'QA-проверка вызывается в buildMap');

console.log('— П.4: разнообразие домов —');
const fbKeys = ['fb_church', 'fb_inn', 'fb_smithy', 'fb_elder', 'fb_manor',
    'fb_thatch_big', 'fb_thatch_small', 'fb_log_flowers', 'fb_log_thatch',
    'fb_log_big', 'fb_tudor_fl', 'fb_tudor_sm'];
fbKeys.forEach(k => ok(existsSync(join(root, `assets/sprites/${k}.png`)), `спрайт ${k}.png существует`));
fbKeys.forEach(k => ok(boot.includes(`'${k}'`), `BootScene загружает ${k}`));
const spriteIds = new Set([...villageCode.matchAll(/'(fb_[a-z_]+)'/g)].map(m => m[1]));
ok(spriteIds.size >= 12, `в деревне используются ${spriteIds.size} разных fb_* фасадов`);
ok((villageCode.match(/'fb_[a-z_]+'/g) || []).length >= 18, 'все 18 зданий получают fb_* спрайты (с зеркалами)');
ok(!/['"]hp_[a-z_0-9]+['"]/.test(villageCode), 'процедурные hp_* из кода деревни убраны');

console.log('— П.5: костёр удалён из деревни, отдых — в лесу —');
const grid = buildMap();
let hasF = false, hasX = false;
for (const row of grid) for (const ch of row) { if (ch === 'F') hasF = true; if (ch === 'X') hasX = true; }
ok(!hasF, "тайлов 'F' (костёр) на карте деревни нет");
ok(!villageCode.includes('createCampfire'), 'createCampfire удалён из VillageScene');
ok(!villageCode.includes('restAtCampfire'), 'restAtCampfire удалён из VillageScene');
ok(forest.includes("type: 'campfire'") && forest.includes('restAtCampfire()'),
    'в ForestScene есть костёр и отдых (1 час)');
ok(forest.includes("t('🔥 Костёр в лесу')"), 'диалог отдыха у лесного костра');

console.log('— П.6: крест удалён, молитва только в церкви —');
ok(!hasX, "тайлов 'X' (крест) на карте деревни нет");
ok(!villageCode.includes('prayAtCross'), 'prayAtCross удалён из VillageScene');
ok(!villageCode.includes('createCrossGlow'), 'лампада креста удалена');
ok(interiorSrc.includes('prayInChurch'), 'молитва осталась в церкви (prayInChurch)');
ok(!i18nCode.includes('southern street'), 'в EN-помощи нет устаревшей подсказки про дом Степана');

console.log('— П.7: воротня меньше и проёмом к выходу —');
// 66.25: воротня переведена на поколение r67 («створ поперёк дороги», два
// слоя); профильные r64/r65/r66 удалены из репозитория и из загрузки.
ok(existsSync(join(root, 'assets/sprites/village_gate_r67_north.png')) && existsSync(join(root, 'assets/sprites/village_gate_r67_south.png')),
    'воротня актуального поколения r67 (north+south) существует');
ok(!existsSync(join(root, 'assets/sprites/village_gate_r65.png')) && !existsSync(join(root, 'assets/sprites/village_gate_r66.png')),
    'устаревшие профильные r65/r66 удалены (66.25)');
ok(bootCode.includes("'village_gate_r67_north'") && bootCode.includes("'village_gate_r67_south'") && !bootCode.includes('village_gate_r64'),
    'BootScene грузит r67, старые r64–r66 из загрузки убраны');
ok(villageCode.includes("'village_gate_r67_north'") && villageCode.includes("'village_gate_r67_south'") && !villageCode.includes('village_gate_r64'),
    'VillageScene ставит воротню r67 (два слоя)');
ok(villageCode.includes("setDepth(VILLAGE_GATE.row - 0.55)"), 'воротня: северная башня — дальний слой 4.45');
ok(villageCode.includes("setDepth(VILLAGE_GATE.row + 2 + 0.45)"), 'воротня: южная группа — ближний слой 7.45');

console.log('— П.8: частокол вокруг деревни, разрыв только у входа —');
let palisadeOk = true, gapOk = false;
for (let x = 0; x < MAP_W; x++) {
    if (grid[0][x] !== 'L' || grid[MAP_H - 1][x] !== 'L') palisadeOk = false;
}
for (let y = 0; y < MAP_H; y++) {
    if (grid[y][0] !== 'L') palisadeOk = false;
    const east = grid[y][MAP_W - 1];
    if (y === VILLAGE_GATE.row) { if (east === 'G') gapOk = true; }
    else if (east !== 'L') palisadeOk = false;
}
ok(palisadeOk, "кольцо 'L' замкнуто по всем границам");
ok(gapOk, 'разрыв частокола только на месте ворот (25,5)');
ok(SOLID.has('L'), "частокол непроходим ('L' в SOLID)");
ok(boot.includes('tile_palisade') && existsSync(join(root, 'assets/tiles/palisade_0.png')),
    'тайл частокола загружен и существует');

console.log('— П.9: деревья в деревне без коллизий —');
const trees = [];
for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (grid[y][x] === 'T') trees.push([x, y]);
ok(trees.length >= 10 && trees.length <= 20, `деревьев внутри деревни: ${trees.length} (10–20)`);
const doors = BUILDINGS.map(b => [b.col + Math.floor(b.w / 2), b.row + b.h - 1]);
let treeCollide = false, treeAdjTree = false, treeNearDoor = false;
const isRoad = (x, y) => ['S', 'B', 'G', 'D', 'W'].includes(grid[y][x]);
trees.forEach(([x, y]) => {
    if (SOLID.has(grid[y][x]) && grid[y][x] !== 'T') treeCollide = true;
    if (isRoad(x, y)) treeCollide = true;
    doors.forEach(([dx, dy]) => { if (Math.abs(dx - x) + Math.abs(dy - y) <= 1) treeNearDoor = true; });
});
trees.forEach(([x, y]) => trees.forEach(([x2, y2]) => {
    if (x !== x2 || y !== y2) { if (Math.abs(x - x2) <= 1 && Math.abs(y - y2) <= 1) treeAdjTree = true; }
}));
ok(!treeCollide, 'ни одно дерево не стоит на дороге/двери/колодце/постройке');
ok(!treeAdjTree, 'деревья не растут вплотную друг к другу');
ok(!treeNearDoor, 'деревья не заслоняют двери');

console.log('— П.10: деревня сгенерирована заново —');
ok(BUILDINGS.length === 18, `зданий 18 (${BUILDINGS.length})`);
const church = BUILDINGS.find(b => b.interiorId === 'church');
const elder = BUILDINGS.find(b => b.interiorId === 'elder_house');
const centerish = (b) => b.col >= 8 && b.col + b.w <= 20 && b.row >= 5 && b.row <= 9;
ok(centerish(church) && centerish(elder), 'храм и дом старосты — в ЦЕНТРЕ деревни');
const smithy = BUILDINGS.find(b => b.interiorId === 'blacksmith');
// 66.25 (п.2): кузница («лавка» под планом деревни) ПЕРЕМЕЩЕНА из
// северо-восточного угла в северный ряд — угол пуст, фасады не под виджетом.
ok(smithy.row <= 3 && smithy.col + smithy.w <= 22, 'кузница — в северном ряду ЛЕВЕЕ зоны плана деревни (66.25 п.2)');
ok(!BUILDINGS.some(b => b.col >= 23 && b.row <= 3), 'северо-восточный угол пуст — план деревни ничего не перекрывает');
const valid = validateMap(grid);
ok(valid.problems.length === 0, 'BFS: все двери и ворота достижимы: ' + valid.problems.join('; '));
// каждая дверь стоит на своей дорожке: под дверью проходимо
let doorPathsOk = true;
doors.forEach(([dx, dy]) => {
    const below = grid[dy + 1] && grid[dy + 1][dx];
    if (below === undefined || SOLID.has(below)) doorPathsOk = false;
});
ok(doorPathsOk, 'от каждой двери вниз идёт дорожка/улица (пути к дверям)');

console.log('— Ассеты/данные —');
ok(existsSync(join(root, 'tools/make_houses_r65.py')), 'генератор make_houses_r65.py на месте');
ok(worldSrc.includes("case 'L': return 'tile_palisade'"), 'tileTexture рисует частокол');
ok(village.includes('streetSpotFor'), 'точки жителей пересчитаны (streetSpotFor)');
ok(!/x:\s*1[78]\.5,\s*y:\s*14\.4/.test(village), 'старых точек (южный ряд р.52) больше нет');

console.log(`\nИтог: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

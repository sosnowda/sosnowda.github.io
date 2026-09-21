#!/usr/bin/env node
/**
 * Юнит-проверки раунда 64 (приказ владельца из 10 пунктов).
 * Запуск: node tools/test_round64.mjs (из папки game/).
 */
import { buildMap, validateMap, MAP_W, MAP_H, YARD_PROPS } from '../src/data/world.js';
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

console.log('— П.1: ограды удалены —');
const village = readFileSync(join(root, 'src/scenes/VillageScene.js'), 'utf8');
ok(!village.includes('addYardAndGarden(b, ts)'), 'вызов addYardAndGarden убран');
ok(!village.includes('addPublicFence(b, ts)'), 'вызов addPublicFence убран');
ok(!village.includes('this.gateFenceTiles'), 'gateFenceTiles (частокол у ворот) убран');
ok(!village.includes('tile_fence_h'), 'в деревне не рисуется tile_fence_h');

console.log('— П.2,5: живность удалена —');
ok(!village.includes('spawnChickens()'), 'куры не спавнятся');
ok(!village.includes('spawnBirdFlocks()'), 'воробьиные стайки убраны');
ok(!village.includes('updateBirds()'), 'updateBirds убран из update()');
ok(!village.includes('this.farmAnimals'), 'farmAnimals не осталось');
ok(!village.includes('animal_chicken_walk'), 'LPC-курица из деревни убрана');

console.log('— П.6: дым удалён —');
ok(!village.includes('puffSmoke'), 'puffSmoke удалён');
ok(!village.includes('this.smokeBuildings'), 'smokeBuildings удалён');
ok(!village.includes('CHIMNEY_SPRITES.has') && !village.includes("CHIMNEY_SPRITES = new Set"), 'CHIMNEY_SPRITES удалён');

console.log('— П.7: постройки удалены —');
ok(Array.isArray(YARD_PROPS) && YARD_PROPS.length === 0, 'YARD_PROPS пуст (стог/поленница/телега убраны)');
ok(!village.includes('drawYardProps('), 'drawYardProps убран');
ok(existsSync(join(root, 'src/data/world.js')), 'world.js на месте');

console.log('— П.8,9: дома из частей «стены+крыши» —');
const hpKeys = ['hp_log_thatch_a', 'hp_log_thatch_b', 'hp_log_wood_a', 'hp_log_wood_b',
    'hp_plank_thatch_a', 'hp_plank_wood_a', 'hp_plaster_thatch_a', 'hp_plaster_wood_a',
    'hp_narrow_thatch', 'hp_narrow_wood', 'hp_inn', 'village_gate_r64'];
hpKeys.forEach(k => ok(existsSync(join(root, `assets/sprites/${k}.png`)), `спрайт ${k}.png существует`));
ok(existsSync(join(root, 'assets/sprites/vh_chapel.png')), 'часовня vh_chapel сохранена');
const boot = readFileSync(join(root, 'src/scenes/BootScene.js'), 'utf8');
// Раунды 65–66: hp_* заменены fb_* (пак Celianna), воротня — r66
ok(boot.includes("'fb_church'") && boot.includes("'village_gate_r66'"), 'BootScene загружает дома fb_* и воротню актуального поколения');
ok(!boot.includes("'vh_manor'") && !boot.includes("'vh_stall'"), 'старые вырезы vh_* из загрузки убраны');
ok(!village.includes("'vh_manor'") && !village.includes("'vh_loghouse'"), 'VillageScene не ссылается на старые вырезы');
ok(village.includes("'fb_inn'"), 'постоялый двор — двухэтажный fb_inn (единственный, r65+)');

console.log('— П.3,4: воротня-арка без башенок —');
ok(!boot.includes('this.createGateTexture'), 'процедурный createGateTexture удалён');
ok(village.includes("village_gate_r66"), 'VillageScene ставит воротню актуального поколения (r66)');
const W = MAP_W, H = MAP_H, ts = 48;
const grid = buildMap();
const valid = validateMap(grid);
ok(valid.problems.length === 0, `BFS: все двери и ворота достижимы (${valid.problems.length || '0'} проблем)`);
ok(grid[VILLAGE_GATE.row][MAP_W - 1] === 'G', 'ворота на восточной границе на месте');
// Ни один спрайт дома не пересекает ОПАКУЮ зону воротни.
// Раунды 65–66: воротня-профиль 104×118, якорь (низ) на южной кромке ряда
// ворот; её верхняя треть прозрачна (там были вымпелы — сняты в r66), поэтому
// проверяем нижнюю непрозрачную часть (столбы + проезд): y от gb-90 до gb.
const GW = 104, GH = 90;
const gx = MAP_W * ts - 44, gy = (VILLAGE_GATE.row + 1) * ts;
const gl = gx - GW / 2, gr = gx + GW / 2, gt = gy - GH, gb = gy;
let overlap = null;
BUILDINGS.forEach(b => {
    const tw = b.w * ts + 16, th = b.h * ts;
    const cx = b.col * ts + b.w * ts / 2, cy = b.row * ts + b.h * ts / 2;
    const fit = Math.min((b.w * ts + 8) / tw, (b.h * ts + 6) / th);
    const dw = tw * fit, dh = th * fit;
    const l = cx - dw / 2, r = cx + dw / 2, t = cy - dh / 2, bo = cy + dh / 2;
    if (!(r < gl || l > gr || bo < gt || t > gb)) overlap = b.interiorId;
});
ok(!overlap, `ни один спрайт не перекрыт воротней${overlap ? ' (НАРУШЕНИЕ: ' + overlap + ')' : ''}`);
const st = BUILDINGS.find(b => b.interiorId === 'shop_tools');
// Раунд 66: подход к воротам — ряд 5 (главная улица), дома не должны его занимать
const passageFree = BUILDINGS.every(b => b.row + b.h <= 5 || b.row >= 6);
ok(passageFree, 'подход к воротне (ряд 5) свободен от домов (планировка r66)');
ok(valid.reachable.has(`${st.col + 1},${st.row + st.h - 1}`), 'дверь дома ремесленника достижима');
let orphan = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (grid[y][x] === 'S' && !valid.reachable.has(`${x},${y}`)) orphan++;
ok(orphan === 0, 'нет отрезанных дорожных лент');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

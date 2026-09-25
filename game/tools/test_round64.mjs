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

console.log('— П.8,9: дома из частей «стены+крыши» — устаревшее поколение удалено —');
// Раунд 66.19: процедурные hp_* (р.64) и старые вырезы rural_*/rurald_*/vh_*/wood_house_*
// удалены из репозитория (не загружаются ни одной сценой; актуальные фасады — fb_*).
for (const k of ['hp_log_thatch_a', 'hp_inn', 'rural_house_0', 'rurald_house_1', 'rural_shop_1']) {
    ok(!existsSync(join(root, `assets/sprites/${k}.png`)), `устаревший ${k}.png удалён (66.19)`);
}
// Раунд 66.19: устаревшие вырезы vh_* (включая часовню — церковь теперь fb_church)
// удалены из репозитория; актуальный фасад церкви — fb_church (загружается в BootScene)
ok(existsSync(join(root, 'assets/sprites/fb_church.png')), 'церковь fb_church существует (часовня vh_* удалена в 66.19)');
ok(!existsSync(join(root, 'assets/sprites/vh_chapel.png')), 'устаревший vh_chapel.png удалён (66.19)');
const boot = readFileSync(join(root, 'src/scenes/BootScene.js'), 'utf8');
// Раунды 65–66: hp_* заменены fb_* (пак Celianna), воротня — r66
ok(boot.includes("'fb_church'") && boot.includes("'village_gate_r67_north'"), 'BootScene загружает дома fb_* и воротню актуального поколения (r67, 66.25)');
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
// РАУНД 66.25: воротня нового поколения «створ поперёк дороги» — два слоя:
//   северная башня village_gate_r67_north 48×96: брёвна x 1214..1256,
//     y (row*ts−96)..(row*ts); глубина 4.45 (дальняя, за игроком);
//   южная группа village_gate_r67_south 96×148: мир x (gx−48)..(gx+48),
//     y (row*ts−24)..(row*ts+124); непрозрачные зоны — поперечина с фонарём
//     (верхние 72px) и южная башня (нижние 76px); глубина 7.45 (ближняя).
// Линия ворот смещена к востоку (башни x 1214..1256), чтобы дом мясника
// (23,6) не касался башен. Проверяем зоны брёвен обеих башен; створки и
// фонарь не считаем — они лежат НА дороге, где домов нет.
const gx = MAP_W * ts - ts / 2;                     // 1224 — центр колонки ворот
const gateZones = [
    { l: gx - 10, r: gx + 32, t: VILLAGE_GATE.row * ts - 96, b: VILLAGE_GATE.row * ts },        // северная башня
    { l: gx - 10, r: gx + 32, t: VILLAGE_GATE.row * ts + ts, b: VILLAGE_GATE.row * ts + 124 },  // южная башня
];
let overlap = null;
BUILDINGS.forEach(b => {
    const tw = b.w * ts + 16, th = b.h * ts;
    const cx = b.col * ts + b.w * ts / 2, cy = b.row * ts + b.h * ts / 2;
    const fit = Math.min((b.w * ts + 8) / tw, (b.h * ts + 6) / th);
    const dw = tw * fit, dh = th * fit;
    const l = cx - dw / 2, r = cx + dw / 2, t = cy - dh / 2, bo = cy + dh / 2;
    for (const z of gateZones) {
        if (!(r < z.l || l > z.r || bo < z.t || t > z.b)) overlap = b.interiorId;
    }
});
ok(!overlap, `ни один спрайт не пересекает башни воротни 66.25${overlap ? ' (НАРУШЕНИЕ: ' + overlap + ')' : ''}`);
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

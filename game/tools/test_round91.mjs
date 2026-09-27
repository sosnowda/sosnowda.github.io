// test_round91 — ПАТЧ 66.35 (приказы владельца 1–5):
//   1) ремонт фасадов fb_* (срезы крыш/труб/стен устранены, церковь +10px);
//   2) поп-апы наведения: хит-зона = отпечаток + видимый спрайт (buildingAt);
//   3) планировка 66.35: все дома ≥1 тайл от восточного частокола, точки
//      НПЦ на проходимых тайлах, окна/трубы housesFX в границах текстур;
//   4) rim-light Найи 0.6 (единообразие) — детали в r89;
//   5) SW v85 / game-assets-v30 — детали в r69–72/84/86–90.
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BUILDINGS } from '../src/data/interiors.js';
import { buildMap, validateMap, SOLID } from '../src/data/world.js';
import { HOUSES_FX } from '../src/data/housesFX.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = join(root, 'game'); // tools/../.. = репо, ассеты в game/
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; } else { failed++; console.log('  ✗ FAIL: ' + msg); } };

// ---------- PNG-ридер (как в r70: самописный, палитровые PNG) ----------
function pngSize(p) {
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

console.log('--- 1. Ремонт фасадов (оригиналы сохранены, размеры новые) ---');
const FB = ['fb_church', 'fb_inn', 'fb_smithy', 'fb_elder', 'fb_manor',
    'fb_thatch_big', 'fb_thatch_small', 'fb_log_flowers', 'fb_log_thatch',
    'fb_log_big', 'fb_tudor_fl', 'fb_tudor_sm'];
for (const k of FB) {
    ok(existsSync(join(game, 'assets/sprites', k + '.png')), `${k}.png на месте`);
    ok(existsSync(join(game, 'tools/fb_originals_6635', k + '.png')), `${k}: оригинал в tools/fb_originals_6635 (ремонт идемпотентен)`);
}
// церковь: 263x350 (66.7 +52, 66.35 +10)
const ch = pngSize(join(game, 'assets/sprites/fb_church.png'));
ok(ch.w === 263 && ch.h === 350, `fb_church 263x350 [${ch.w}x${ch.h}]`);
// конвейер ремонта в репо и заявляет идемпотентность
const rep = readFileSync(join(game, 'tools/make_houses_repair_6635.py'), 'utf-8');
ok(rep.includes('fb_originals_6635') && rep.includes('grow_top') && rep.includes('cap_slab'),
    'конвейер ремонта: grow_top/cap_slab, бэкап оригиналов');

// ---------- 2. housesFX: окна/трубы в границах новых текстур ----------
console.log('--- 2. housesFX: окна/трубы в границах текстур (синхрон с ремонтом) ---');
for (const k of FB) {
    const { w, h } = pngSize(join(game, 'assets/sprites', k + '.png'));
    const fx = HOUSES_FX[k];
    ok(!!fx, `${k}: метаданные housesFX есть`);
    if (!fx) continue;
    const winBad = (fx.windows || []).filter(([cx, cy, ww, hh]) =>
        cx - ww / 2 < -2 || cx + ww / 2 > w + 2 || cy - hh / 2 < -2 || cy + hh / 2 > h + 2);
    ok(winBad.length === 0, `${k}: все окна в границах ${w}x${h} (${winBad.length ? JSON.stringify(winBad) : 'ok'})`);
    const chimBad = (fx.chimneys || []).filter(([cx, cy]) => cx < 0 || cx > w || cy < 0 || cy > h);
    ok(chimBad.length === 0, `${k}: жерла труб в границах текстуры`);
    ok((fx.chimneys || []).length >= 1 || k === 'fb_church', `${k}: труба задана (кроме церкви)`);
}

// ---------- 3. Поп-апы: хит-зона по видимому спрайту ----------
console.log('--- 3. Поп-апы: buildingAt + houseHitRects в VillageScene ---');
const vsrc = readFileSync(join(game, 'src/scenes/VillageScene.js'), 'utf-8');
ok(vsrc.includes('this.houseHitRects = []'), 'VillageScene: houseHitRects инициализирован в create (сброс экземпляра)');
ok(vsrc.includes('buildingAt(worldX, worldY)') || vsrc.includes('buildingAt('), 'VillageScene: метод buildingAt есть');
ok(vsrc.includes("this.input.on('pointermove'") && /pointermove[\s\S]{0,220}buildingAt\(/.test(vsrc),
    'pointermove использует buildingAt (хит-зона спрайта, не только отпечаток)');
ok(/pointerdown[\s\S]{0,320}buildingAt\(/.test(vsrc), 'pointerdown тоже строится на buildingAt');
// showBuildingTooltip — метод КЛАССА (отступ 4), а не вложенная функция
// (урок 66.21: после удаления доски метод остался вложенным с отступом 8)
ok(/^    showBuildingTooltip\(building, screenX, screenY\) \{/m.test(vsrc),
    'showBuildingTooltip — метод класса (отступ 4), не вложен в другой метод');
ok(/^    hideBuildingTooltip\(\) \{/m.test(vsrc), 'hideBuildingTooltip — метод класса');

// ---------- 4. Планировка 66.35 ----------
console.log('--- 4. Планировка: зазор от частокола, проходимость, точки НПЦ ---');
ok(BUILDINGS.every(b => b.col + b.w <= 24), 'все дома в границах col+w ≤ 24 (≥1 тайл от частокола col 25)');
ok(BUILDINGS.length === 18, `зданий 18 [${BUILDINGS.length}]`);
const grid = buildMap();
const problems = validateMap(grid).problems;
ok(problems.length === 0, `BFS-валидатор: все двери достижимы (${problems.length ? problems.join('; ') : 'чисто'})`);
// восточный проезд и укороченный западный
ok(grid[7][1] === 'S' && grid[10][1] !== 'S', 'западный проезд: ряды 6–8 (юг колонки 1 свободен для ткачихи)');
ok(grid[11][24] === 'S', 'восточный проезд: колонка 24, ряды 10–12');
// каждая дверь соединена дорожкой с улицей (симметричная BFS-проверка validateMap выше)

// точки НПЦ (streetSpotFor): на проходимых тайлах, не внутри домов/деревьев/колодца
const mSpots = vsrc.match(/const SPOTS = \{([\s\S]*?)\n        \};/);
const mReserve = vsrc.match(/const RESERVE = \[([\s\S]*?)\n        \];/);
ok(!!mSpots && !!mReserve, 'таблицы SPOTS и RESERVE найдены в streetSpotFor');
const spotSrc = (mSpots ? mSpots[1] : '') + '\n' + (mReserve ? mReserve[1] : '');
const spotMatches = [...spotSrc.matchAll(/(\w+): \{ x: ([\d.]+), y: ([\d.]+) \}/g)];
ok(spotMatches.length >= 30, `точек НПЦ в streetSpotFor+RESERVE: ${spotMatches.length} (≥30)`);
const seenKeys = new Set();
let badTile = null, dupSpot = null;
const pts = [];
for (const [, key, xs, ys] of spotMatches) {
    const x = parseFloat(xs), y = parseFloat(ys);
    const fullKey = key + ':' + x + ',' + y;
    if (seenKeys.has(fullKey)) { dupSpot = fullKey; continue; }
    seenKeys.add(fullKey);
    pts.push({ key, x, y });
    const tx = Math.floor(x), ty = Math.floor(y);
    const ch2 = grid[ty] && grid[ty][tx];
    if (!ch2 || SOLID.has(ch2) || ch2 === 'L' || ch2 === 'G') badTile = `${key} -> (${tx},${ty})='${ch2}'`;
}
ok(!dupSpot, `дубликатов точек нет (${dupSpot || 'ok'})`);
ok(!badTile, `все точки НПЦ на проходимых тайлах (${badTile || 'ok'})`);
// попарная дистанция ≥ 40px (0.83 тайла) — «кучкования» 66.26 не возвращаются
let minDist = Infinity, minPair = '';
for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        if (a.x === b.x && a.y === b.y) continue;
        const d = Math.hypot((a.x - b.x) * 48, (a.y - b.y) * 48);
        if (d < minDist) { minDist = d; minPair = a.key + '~' + b.key; }
    }
}
ok(minDist >= 40, `минимальная дистанция точек НПЦ ${Math.round(minDist)}px ≥40 (${minPair})`);

// деревья: кроны не накрывают дверные тайлы (крона ~1.2 тайла от ствола)
const trees = [];
for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === 'T') trees.push([x, y]);
const doors = [];
for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === 'D') doors.push([x, y]);
const crownHits = [];
for (const [tx, ty] of trees) {
    for (const [dx, dy] of doors) {
        if (Math.hypot(dx - tx, dy - ty) < 1.9) crownHits.push(`tree(${tx},${ty})~door(${dx},${dy})`);
    }
}
ok(crownHits.length === 0, `кроны не накрывают двери (${crownHits.length ? crownHits.join('; ') : 'ok'})`);
ok(trees.length >= 15, `деревьев на карте: ${trees.length} (≥15)`);
ok(doors.length === 18, `дверей 18 [${doors.length}]`);

// колодец на новом месте
ok(grid[7][17] === 'W', 'колодец в зазоре староста/пахарь — (17,7)');

console.log(`\n=== ИТОГ: ${passed} зелёных, ${failed} красных ===`);
if (failed) process.exit(1);

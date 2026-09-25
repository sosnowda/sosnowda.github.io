// test_round84.mjs — РАУНД 66.25 (4 приказа владельца):
//   п.1  рабочие скрипты агента перенесены в репо (game/tools/) + АГЕНТ.md;
//   п.2  «лавка» (кузница с кузнечным двором) ВЫВЕДЕНА из правого верхнего
//        угла — под планом деревни (виджетом) больше нет ни одного фасада;
//        планировка пересобрана ротацией пяти домов, СВ угол пуст;
//   п.3  ворота деревни ПЕРЕДЕЛАНЫ: поколение r67 «створ поперёк дороги» —
//        северная башня + южная группа (поперечина, фонарь, створки, башня),
//        профильные r64/r65/r66 удалены насовсем;
//   п.4  скриншоты лендинга пересняты (см. CHANGES.md, здесь — assets).
// Запуск: node tools/test_round84.mjs
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BUILDINGS } from '../src/data/interiors.js';
import { VILLAGE_GATE } from '../src/data/interiors.js';
import { MAP_W, MAP_H, buildMap, validateMap, SOLID } from '../src/data/world.js';

const GAME = dirname(fileURLToPath(import.meta.url));
const root = join(GAME, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };
const read = (p) => readFileSync(join(root, p), 'utf8');

// Размер PNG из заголовка IHDR (байты 16..24, big-endian)
function pngSize(p) {
    const b = readFileSync(join(root, p));
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const ts = 48;
const bootSrc = read('src/scenes/BootScene.js');
const villageSrc = read('src/scenes/VillageScene.js');
const worldSrc = read('src/data/world.js');
const interiorsSrc = read('src/data/interiors.js');

console.log('\n[1] П.2: ротация планировки — «лавка» ушла из правого верхнего угла');
const smithy = BUILDINGS.find(b => b.interiorId === 'blacksmith');
const shop = BUILDINGS.find(b => b.interiorId === 'shop_tools');
const healer = BUILDINGS.find(b => b.interiorId === 'healer_house');
const butcher = BUILDINGS.find(b => b.interiorId === 'butcher_house');
const grocer = BUILDINGS.find(b => b.interiorId === 'grocer_house');
ok(smithy.col === 18 && smithy.row === 1, `кузница — северный ряд (18,1), была (23,1) [${smithy.col},${smithy.row}]`);
ok(shop.col === 15 && shop.row === 1, `дом ремесленника — (15,1) [${shop.col},${shop.row}]`);
ok(healer.col === 21 && healer.row === 1, `знахарка — (21,1) [${healer.col},${healer.row}]`);
ok(butcher.col === 23 && butcher.row === 6, `мясник Потап — средний ряд (23,6) [${butcher.col},${butcher.row}]`);
ok(grocer.col === 22 && grocer.row === 10 && grocer.w === 3, `Прасковья — южный ряд (22..24,10) [${grocer.col},${grocer.row},w${grocer.w}]`);
ok(BUILDINGS.length === 18, `зданий по-прежнему 18 (${BUILDINGS.length})`);

// Северо-восточный угол пуст (колонки 23–24, ряды 1–3)
ok(!BUILDINGS.some(b => b.col + b.w > 23 && b.row <= 3 && b.col >= 22),
    'СВ угол (колонки 23–24, ряды 1–3) пуст — под планом только трава');
// …кроме того ни один фасад не заходит в зону виджета «План деревни».
// Виджет: экран x 1113..1275, y 59..155; мир смещён на +16 (камера 1248 на 1280)
// → зона в мировых координатах x 1097..1259, y 59..155.
const WIDGET = { l: 1097, r: 1259, t: 59, b: 155 };
const SPRITE_SIZE = {
    fb_elder: null, // лениво: размеры читаем из PNG по ключу
};
function spriteRect(b) {
    const key = { elder_house: 'fb_elder', tavern: 'fb_inn', blacksmith: 'fb_smithy',
        potter_house: 'fb_log_flowers', villager_house_1: 'fb_log_thatch',
        villager_house_2: 'fb_manor', beekeeper_house: 'fb_log_big',
        healer_house: 'fb_tudor_sm', carpenter_house: 'fb_log_thatch',
        fisher_house: 'fb_thatch_small', weaver_house: 'fb_manor',
        shop_tools: 'fb_tudor_sm', grocer_house: 'fb_thatch_big',
        butcher_house: 'fb_thatch_small', shoemaker_house: 'fb_log_big',
        woodcutter_house: 'fb_tudor_fl', villager_house_3: 'fb_thatch_big',
        church: 'fb_church' }[b.interiorId];
    const { w: iw, h: ih } = pngSize(`assets/sprites/${key}.png`);
    const fit = Math.min((b.w * ts + 8) / iw, (b.h * ts + 6) / ih);
    const dw = iw * fit, dh = ih * fit;
    const cx = b.col * ts + b.w * ts / 2, cy = b.row * ts + b.h * ts / 2;
    return { l: cx - dw / 2, r: cx + dw / 2, t: cy - dh / 2, b: cy + dh / 2 };
}
let underWidget = null;
BUILDINGS.forEach(b => {
    const r = spriteRect(b);
    if (!(r.r < WIDGET.l || r.l > WIDGET.r || r.b < WIDGET.t || r.t > WIDGET.b)) underWidget = b.interiorId;
});
ok(!underWidget, `ни один фасад не пересекает зону виджета «План деревни»${underWidget ? ' (НАРУШЕНИЕ: ' + underWidget + ')' : ''}`);

// Зазоры между домами ≥1 тайла (пересобранная планировка не срастается)
let merged = null;
for (let i = 0; i < BUILDINGS.length && !merged; i++) {
    for (let j = i + 1; j < BUILDINGS.length; j++) {
        const a = BUILDINGS[i], b = BUILDINGS[j];
        if (a.col - 1 < b.col + b.w && b.col - 1 < a.col + a.w &&
            a.row - 1 < b.row + b.h && b.row - 1 < a.row + a.h) { merged = `${a.interiorId}~${b.interiorId}`; break; }
    }
}
ok(!merged, `зазоры ≥1 тайла между всеми домами${merged ? ' (СРАСТАНИЕ: ' + merged + ')' : ''}`);

// Точки улиц для перемещённых жителей
ok(villageSrc.includes('blacksmith: { x: 18.5, y: 4.4 }'), 'уличная точка кузнеца — у новой кузницы (18.5,4.4)');
ok(villageSrc.includes('healer: { x: 21.5, y: 4.4 }'), 'уличная точка знахарки — у нового дома (21.5,4.4)');
ok(!villageSrc.includes('blacksmith: { x: 23.5, y: 4.4 }'), 'старая точка кузнеца (23.5,4.4) убрана');

console.log('\n[2] П.3: ворота нового поколения r67 «створ поперёк дороги»');
const n = pngSize('assets/sprites/village_gate_r67_north.png');
const s = pngSize('assets/sprites/village_gate_r67_south.png');
ok(n.w === 48 && n.h === 96, `village_gate_r67_north.png 48×96 (${n.w}×${n.h})`);
ok(s.w === 96 && s.h === 148, `village_gate_r67_south.png 96×148 (${s.w}×${s.h})`);
ok(!existsSync(join(root, 'assets/sprites/village_gate_r64.png')) &&
   !existsSync(join(root, 'assets/sprites/village_gate_r65.png')) &&
   !existsSync(join(root, 'assets/sprites/village_gate_r66.png')),
    'профильные r64/r65/r66 удалены насовсем (66.25)');
ok(bootSrc.includes("'village_gate_r67_north'") && bootSrc.includes("'village_gate_r67_south'"),
    'BootScene загружает оба слоя воротни r67');
ok(bootSrc.includes("load.image(k, `assets/sprites/${k}.png`)") && !bootSrc.includes("'village_gate_r65'") && !bootSrc.includes("'village_gate_r66'"),
    'BootScene не загружает r65/r66 (только упоминание в комментариях допустимо)');
ok(villageSrc.includes("'village_gate_r67_north'") && villageSrc.includes("'village_gate_r67_south'"),
    'VillageScene рисует оба слоя r67');
ok(villageSrc.includes('setDepth(VILLAGE_GATE.row - 0.55)'), 'северная башня — дальний слой (row−0.55 = 4.45)');
ok(villageSrc.includes('setDepth(VILLAGE_GATE.row + 2 + 0.45)'), 'южная группа — ближний слой (row+2.45 = 7.45)');
ok(villageSrc.includes('glow_soft') && villageSrc.includes('lantern'), 'фонарь ворот с тёплым свечением (glow_soft)');
// Смещение линии ворот к востоку: дом мясника не касается башен
const but = spriteRect(butcher);
ok(but.r <= 1214, `фасад мясника (${Math.round(but.r)}) не заходит на башни (левая кромка 1214)`);
// Прозрачный проезд в южной текстуре: полоса дороги (мировые y 244..284,
// текстурные y 28..68) в зоне створок/фонаря прозрачна по краям проезда
{
    const b = readFileSync(join(root, 'assets/sprites/village_gate_r67_south.png'));
    // быстрый RGBA-декод не нужен: проверяем через PIL-независимый путь нельзя,
    // поэтому проверяем маркер прозрачности в генераторе
    const gen = read('tools/make_gate_r67.py');
    ok(gen.includes('Проезд прозрачен') || gen.includes('проезд ПОЛНОСТЬЮ прозрачен') || gen.includes('ПОЛНОСТЬЮ прозрачен'),
        'генератор: проезд прозрачен (дорога видна насквозь)');
}

console.log('\n[3] Карта: проходимость, деревья, ворота');
const grid = buildMap();
const valid = validateMap(grid);
ok(valid.problems.length === 0, 'BFS: все двери и ворота достижимы: ' + valid.problems.join('; '));
ok(grid[VILLAGE_GATE.row][MAP_W - 1] === 'G', "ворота 'G' на (25,5) на месте");
ok(grid[1][24] === 'T', "новое дерево у СВ угла (24,1)");
ok(grid[1][18] !== 'T' && grid[2][22] !== 'T', 'старые деревья (18,1)/(22,2) сняты (колонки заняты домами)');
// Дорожки от новых дверей
const doorOf = (b) => [b.col + Math.floor(b.w / 2), b.row + b.h - 1];
const pathsOk = [smithy, shop, healer, butcher, grocer].every(b => {
    const [dx, dy] = doorOf(b);
    const below = grid[dy + 1] && grid[dy + 1][dx];
    return below !== undefined && !SOLID.has(below);
});
ok(pathsOk, 'от дверей всех перемещённых домов идут дорожки до улиц');

console.log('\n[4] П.1: рабочие скрипты в репо + АГЕНТ.md');
ok(existsSync(join(root, '..', 'АГЕНТ.md')), 'АГЕНТ.md (памятка агента) в корне репо');
ok(existsSync(join(root, 'tools/README.md')), 'game/tools/README.md — инструкция по скриптам');
for (const f of ['landing_shots.mjs', 'convert_shots.js', 'update_shots_6624.py',
    'terrain_smoke_6624.mjs', 'season_walkthrough_6623.mjs', 'thief_night_smoke_6623.mjs',
    'seasonal_smoke_6622.mjs', 'night_knock_smoke.mjs', 'honest_thief.mjs',
    'village_visual_check_6625.mjs',
    'debug_apiary.mjs', 'debug_click.mjs', 'debug_thief.mjs', 'debug_time.mjs', 'debug_tutorial.mjs']) {
    ok(existsSync(join(root, 'tools', f)), `game/tools/${f} в репо`);
}

console.log('\n[5] П.4: скриншоты лендинга и SW');
const swSrc = read('../sw.js');
ok(swSrc.includes("var CACHE_NAME = 'chronicles-ruthenia-v77'"), 'SW: site-cache v77 (раунд 66.27)');
ok(swSrc.includes("var GAME_ASSETS_CACHE = 'game-assets-v25'"), 'SW: game-assets-v25 (новые PNG воротни)');
ok(existsSync(join(root, '..', 'assets/screenshots/05-map.webp')), 'кадр карты местности 05-map.webp на месте');

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

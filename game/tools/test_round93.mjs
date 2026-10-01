// test_round93 — ПАТЧ 66.37 (2 приказа владельца):
//   1) ДЫМ АВДЕЯ/ПРАСКОВЬИ ВОЗВРАЩЁН — трубы дорисованы В СТИЛЕ ПАКА
//      (tools/make_chimneys_6637.py: доноры fb_manor/fb_thatch_small,
//      тело удлинено тесселяцией, жерла в housesFX.js);
//   2) МИРОВЫЕ СПРАЙТЫ ПЕРСОНАЖЕЙ ИЗ ПАКОВ GOOGLE DRIVE
//      (tools/make_world_6637.py → assets/sprites/world/, 71 лист 9×4 @128):
//      игрок Baenor/Naia, жители — слои Town&Country/Warfare, дети готовые;
//      геометрия: рост 88px, ноги y=126; масштабы сцен × WORLD_K=31/88;
//      физтело 68px кадра; ключи player_composite/npc_lpc_<id> сохранены.
import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HOUSES_FX } from '../src/data/housesFX.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = join(root, 'game');
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; } else { failed++; console.log('  ✗ FAIL: ' + msg); } };

function pngSize(p) {
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}

// Минимальный PNG-декодер (как в r92) — для проверки геометрии фигур
const require = (await import('module')).createRequire(import.meta.url);
const zlib = require('zlib');
function pngPixels(p) {
    const b = readFileSync(p);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    const bitDepth = b[24], colorType = b[25];
    assert.ok(bitDepth === 8, 'ожидается 8 бит');
    let pos = 8, idat = [];
    const pal = [], trns = [];
    while (pos < b.length) {
        const len = b.readUInt32BE(pos), type = b.toString('ascii', pos + 4, pos + 8);
        if (type === 'IDAT') idat.push(b.subarray(pos + 8, pos + 8 + len));
        if (type === 'PLTE') for (let i = 0; i < len; i += 3) pal.push([b[pos + 8 + i], b[pos + 9 + i], b[pos + 10 + i]]);
        if (type === 'tRNS') for (let i = 0; i < len; i++) trns.push(b[pos + 8 + i]);
        pos += 12 + len;
    }
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : 1;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    const out = new Uint8ClampedArray(w * h * 4);
    let prev = new Uint8ClampedArray(stride);
    for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const cur = new Uint8ClampedArray(stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? cur[i - channels] : 0;
            const c = prev[i];
            let val = line[i];
            if (filter === 1) val = (val + a) & 255;
            else if (filter === 2) val = (val + c) & 255;
            else if (filter === 3) val = (val + ((a + c) >> 1)) & 255;
            else if (filter === 4) {
                const pp = i >= channels ? prev[i - channels] : 0;
                const p = a + c - pp, pa = Math.abs(p - a), pb = Math.abs(p - c), pc = Math.abs(p - pp);
                val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? c : pp)) & 255;
            }
            cur[i] = val;
        }
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, bl = 0, al = 255;
            if (colorType === 6) { r = cur[x * 4]; g = cur[x * 4 + 1]; bl = cur[x * 4 + 2]; al = cur[x * 4 + 3]; }
            else if (colorType === 2) { r = cur[x * 3]; g = cur[x * 3 + 1]; bl = cur[x * 3 + 2]; }
            else if (colorType === 3) { const idx = cur[x]; [r, g, bl] = pal[idx] || [0, 0, 0]; al = trns[idx] ?? 255; }
            else if (colorType === 0) { r = g = bl = cur[x]; }
            const o = (y * w + x) * 4;
            out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al;
        }
        prev = cur;
    }
    return { w, h, at(x, y) { const o = (y * w + x) * 4; return [out[o], out[o + 1], out[o + 2], out[o + 3]]; } };
}

const read = (rel) => readFileSync(join(game, rel), 'utf-8');

// ============================================================
console.log('— 1. Трубы Авдея/Прасковьи в стиле пака —');
ok(existsSync(join(game, 'tools/make_chimneys_6637.py')), 'tools/make_chimneys_6637.py в репо');
ok(existsSync(join(game, 'tools/fb_originals_6637/fb_log_thatch.png')) &&
   existsSync(join(game, 'tools/fb_originals_6637/fb_thatch_big.png')),
   'оригиналы 66.36 сохранены в fb_originals_6637/');
ok(HOUSES_FX.fb_log_thatch.chimneys.length === 1 &&
   HOUSES_FX.fb_log_thatch.chimneys[0][0] === 144 && HOUSES_FX.fb_log_thatch.chimneys[0][1] === 10,
   'fb_log_thatch: жерло трубы (144,10)');
ok(HOUSES_FX.fb_thatch_big.chimneys.length === 1 &&
   HOUSES_FX.fb_thatch_big.chimneys[0][0] === 178 && HOUSES_FX.fb_thatch_big.chimneys[0][1] === 34,
   'fb_thatch_big: жерло трубы (178,34)');
// жерло на текстуре — тёмный проём (камень колпака светлый вокруг)
{
    const t1 = pngPixels(join(game, 'assets/sprites/fb_log_thatch.png'));
    let dark = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const [r, g, b, a] = t1.at(144 + dx, 10 + dy);
        if (a > 100 && r + g + b < 260) dark++;
    }
    ok(dark >= 6, `fb_log_thatch: жерло тёмное (тёмных пикселей ${dark} ≥ 6)`);
    const t2 = pngPixels(join(game, 'assets/sprites/fb_thatch_big.png'));
    let dark2 = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const [r, g, b, a] = t2.at(178 + dx, 34 + dy);
        if (a > 100 && r + g + b < 260) dark2++;
    }
    ok(dark2 >= 6, `fb_thatch_big: жерло тёмное (тёмных пикселей ${dark2} ≥ 6)`);
    // труба НЕ срезана краем текстуры: у fb_log_thatch камень над коньком (y=2..8)
    let stone = 0;
    for (let y = 3; y <= 8; y++) { const [, , , a] = t1.at(135, y); if (a > 100) stone++; }
    ok(stone >= 4, `fb_log_thatch: тело трубы выше конька цело (${stone}/6)`);
}
// остальные дома по-прежнему с аутентичными трубами
ok(HOUSES_FX.fb_elder.chimneys.length === 2 && HOUSES_FX.fb_inn.chimneys.length === 1 &&
   HOUSES_FX.fb_smithy.chimneys.length === 1 && HOUSES_FX.fb_manor.chimneys.length === 1 &&
   HOUSES_FX.fb_log_big.chimneys.length === 1 && HOUSES_FX.fb_log_flowers.chimneys.length === 2 &&
   HOUSES_FX.fb_thatch_small.chimneys.length === 1 && HOUSES_FX.fb_tudor_fl.chimneys.length === 1 &&
   HOUSES_FX.fb_tudor_sm.chimneys.length === 1 && HOUSES_FX.fb_church.chimneys.length === 0,
   'остальные дома: аутентичные трубы пака без изменений (66.42: гончар×2)');

// ============================================================
console.log('— 2. Мировые листы (assets/sprites/world/) —');
ok(existsSync(join(game, 'tools/make_world_6637.py')), 'tools/make_world_6637.py в репо');
const worldDir = join(game, 'assets/sprites/world');
ok(existsSync(worldDir), 'assets/sprites/world/ на месте');
const files = readdirSync(worldDir).filter(f => f.endsWith('.png'));
// 66.40: база KT_Male_1 и 5 кафтанов PB добавлены — 143 мировых листа (было 137 после 66.39)
ok(files.length === 143, `143 мировых листа [${files.length}]`);
const MUST = ['world_hero_male.png', 'world_hero_female.png',
    'world_m_base1.png', 'world_m_top9.png', 'world_m_pants5.png', 'world_m_hair6.png',
    'world_m_beard1.png', 'world_m_beard2.png', 'world_m_feet3.png',
    'world_w_base1.png', 'world_w_top7.png', 'world_w_bottom4.png', 'world_w_feet2.png', 'world_w_helm4.png',
    'world_f_base3.png', 'world_f_dress5.png', 'world_f_hair7.png', 'world_f_feet2.png',
    'world_child1.png', 'world_child6.png'];
MUST.forEach(f => ok(files.includes(f), `${f} в паке мировых листов`));
// размеры и палитра
let badSize = 0, notPalette = 0;
files.forEach(f => {
    const s = pngSize(join(worldDir, f));
    if (s.w !== 1152 || s.h !== 512) badSize++;
    if (s.colorType !== 3) notPalette++;   // палитра ≤255 (вес)
});
ok(badSize === 0, `все листы 1152×512 [плохих: ${badSize}]`);
ok(notPalette === 0, `все листы в палитре ≤255 [не-палитровых: ${notPalette}]`);
// геометрия фигур: рост ~88px (85..95), ноги у y=126 (120..128), центр по X
const geoCheck = ['world_m_base1.png', 'world_f_base1.png', 'world_hero_male.png', 'world_hero_female.png', 'world_child1.png'];
geoCheck.forEach(f => {
    const img = pngPixels(join(worldDir, f));
    // bbox кадра walk-down (ячейка 0,0)
    let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const [, , , a] = img.at(x, y);
        if (a > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const h = y1 - y0 + 1, cx = (x0 + x1) / 2;
    ok(h >= 85 && h <= 95, `${f}: рост фигуры 85..95 [${h}]`);
    ok(y1 >= 120 && y1 <= 128, `${f}: ноги у y=126 [${y1}]`);
    ok(cx >= 52 && cx <= 76, `${f}: фигура по центру ячейки [cx=${cx.toFixed(1)}]`);
});

// ============================================================
console.log('— 3. WorldLook.js и подключение —');
const worldLook = read('src/systems/WorldLook.js');
ok(worldLook.includes('export const WORLD_K = 31 / 88;'), 'WorldLook: WORLD_K = 31/88');
ok(worldLook.includes('export const WORLD_BODY_PX = 68;'), 'WorldLook: WORLD_BODY_PX = 68');
ok(worldLook.includes("export function composeWorldPlayerTexture"), 'WorldLook: composeWorldPlayerTexture');
ok(worldLook.includes("export function ensureWorldNpcTexture"), 'WorldLook: ensureWorldNpcTexture');
ok(worldLook.includes("`npc_lpc_${npc.id}`"), 'WorldLook: ключ npc_lpc_<id> сохранён');
ok(worldLook.includes("'player_composite'"), 'WorldLook: ключ player_composite сохранён');
ok(worldLook.includes('OUTFIT_M') && worldLook.includes('OUTFIT_F') && worldLook.includes('world_w_helm'),
   'WorldLook: профессиональные схемы одежды (в т.ч. стражник)');
// BootScene грузит мировые листы
const boot = read('src/scenes/BootScene.js');
ok(boot.includes("'world_hero_male'") && boot.includes("'world_child6'"), 'BootScene: мировые листы в загрузке');
ok(/frameWidth:\s*128/.test(boot), 'BootScene: кадры мировых листов 128px');
const bootWorldCount = (boot.match(/world_/g) || []).length;
// 66.40: 143 листа (база KT_Male_1 и 5 кафтанов PB добавлены)
ok(bootWorldCount >= 143, `BootScene: перечислены все мировые листы [${bootWorldCount} ≥ 143]`);
// NpcLpc — делегирование на WorldLook с LPC-фолбэком
const npcLpc = read('src/systems/NpcLpc.js');
ok(npcLpc.includes('ensureWorldNpcTexture(scene, registry, npc)'), 'NpcLpc: основной путь — мировые листы');
ok(npcLpc.includes("rollLpcAppearance(registry, npc)"), 'NpcLpc: LPC-фолбэк сохранён');
// CharacterSelection — новый композит игрока
const css = read('src/scenes/CharacterSelectionScene.js');
ok(css.includes('composeWorldPlayerTexture(this, hero.gender)'), 'CharacterSelection: composeWorldPlayerTexture');
ok(!css.includes('composePlayerTexture(this,'), 'CharacterSelection: прежний LPC-вызов убран');
// SmoothSprites — world_ под LINEAR
ok(read('src/systems/SmoothSprites.js').includes("'world_'"), 'SmoothSprites: префикс world_ гладкий');

// ============================================================
console.log('— 4. Масштабы/физтело в сценах × WORLD_K —');
const village = read('src/scenes/VillageScene.js');
ok(village.includes('ts / 32 * 0.75 * WORLD_K'), 'VillageScene: игрок × WORLD_K');
ok(village.includes('this.tileSize / 32 * 0.75 * WORLD_K'), 'VillageScene: npcScaleByAge × WORLD_K');
ok(village.includes('body.setSize(WORLD_BODY_PX, WORLD_BODY_PX, true)'), 'VillageScene: физтело 68px кадра');
const interior = read('src/scenes/InteriorScene.js');
ok((interior.match(/2\.5 \* WORLD_K/g) || []).length === 4,
   'InteriorScene: игрок+НПЦ+второстепенные+посетители × WORLD_K [4]');
const location = read('src/scenes/LocationScene.js');
ok(location.includes('2.5 * WORLD_K'), 'LocationScene: игрок × WORLD_K');
ok((location.match(/scale \* WORLD_K/g) || []).length === 2,
   'LocationScene: НПЦ локаций и работники поля × WORLD_K [2]');
const forest = read('src/scenes/ForestScene.js');
ok(forest.includes('TS / 32 * 0.75 * WORLD_K') && forest.includes('body.setSize(WORLD_BODY_PX, WORLD_BODY_PX, true)'),
   'ForestScene: игрок × WORLD_K + физтело');
const apiary = read('src/scenes/ApiaryScene.js');
ok(apiary.includes('TS / 32 * 0.75 * WORLD_K') && apiary.includes('body.setSize(WORLD_BODY_PX, WORLD_BODY_PX, true)') &&
   apiary.includes('TS / 32 * 0.85 * WORLD_K'),
   'ApiaryScene: игрок и жители × WORLD_K + физтело');

// ============================================================
console.log('— 5. SW: site-cache v96, game-assets-v41 —');
const sw = read('../sw.js');
const swlog = read('../docs/SW_CHANGELOG.md'); // 66.47: журнал переехал
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v102';"), 'SW: site-cache v96');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v41';"), 'SW: game-assets-v41');
ok(swlog.includes('v87 — итерация 66.37'), 'SW: журнал содержит запись v87');
ok(swlog.includes('v86 — итерация 66.36'), 'SW: журнал хранит v86');

// ============================================================
console.log(`\n=== ИТОГ: ${passed} OK, ${failed} FAIL ===`);
process.exit(failed ? 1 : 0);

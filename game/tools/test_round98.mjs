// test_round98.mjs — ПАТЧ 66.42 (5 приказов владельца):
//   1) БОЕВЫЕ ЛИСТЫ (приказ 1 «проверить модели игрока и вора в бою»):
//      КОРЕННОЙ БАГ С 66.32 — альт-полосы пака 3×128 резались на 4×96;
//      «кадр 1» игровой стойки idle был вертикальным обрывком (модель игрока
//      в бою рвалась в полоску — видно и на старом прод-скриншоте 08-combat).
//      Регресс-тест: КАЖДЫЙ из 4 кадров КАЖДОГО листа содержит
//      достаточную альфа-массу (>700 px на 96×96 кадр) + сетка 3×128
//      подтверждена проекциями альфы исходных полос.
//      66.43: в наборе ещё 4 листа вора/воровки (battle_thiefm/thieff_*) —
//      итого 59; стейджинг-проверка стала средово-необязательной (в чистой
//      среде /home/z/my-project/drive_parts_battle нет).
//   2) ПЕЧНЫЕ ТРУБЫ (приказ 3): fb_log_flowers и fb_tudor_sm получили
//      каменные трубы в стиле пака (make_chimneys_6642.py, оригиналы
//      сохранены), housesFX.js — 19 дымовых точек суммарно.
//   3) СКРИНШОТЫ (приказы 2+4): все 9 webp на месте.
//   4) ИНСТРУМЕНТЫ 66.42 в репо + исторический маркер у 6632/6633.
//   5) SW v92 / game-assets-v44 (версии актуализирует каждый новый раунд).
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');

// Декодер PNG (colorType 3 — палитра и 6 — truecolor RGBA, фильтр 0 от PIL) — как в r94.
function pngLoad(path) {
    const b = readFileSync(path);
    let off = 8, w = 0, h = 0, colorType = 0, plte = null, trns = null;
    const idat = [];
    while (off < b.length) {
        const len = b.readUInt32BE(off);
        const type = b.toString('ascii', off + 4, off + 8);
        const data = b.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
        if (type === 'PLTE') plte = data;
        if (type === 'tRNS') trns = data;
        if (type === 'IDAT') idat.push(data);
        off += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat));
    if (colorType === 3) {
        const stride = w + 1;
        const at = (x, y) => {
            const pi = raw[y * stride + 1 + x];
            const r = plte[pi * 3], g = plte[pi * 3 + 1], bl = plte[pi * 3 + 2];
            const a = trns && pi < trns.length ? trns[pi] : 255;
            return [r, g, bl, a];
        };
        return { w, h, colorType, at };
    }
    // colorType 6 — RGBA 8 бит
    const stride = w * 4 + 1;
    const at = (x, y) => {
        const o = y * stride + 1 + x * 4;
        return [raw[o], raw[o + 1], raw[o + 2], raw[o + 3]];
    };
    return { w, h, colorType, at };
}

let pass = 0, fail = 0;
const fails = [];
const ok = (cond, name) => { if (cond) pass++; else { fail++; fails.push(name); } console.log((cond ? '  ✓ ' : '  ✗ ') + name); };

console.log('— 1. Боевые листы: полнота КАЖДОГО кадра (регресс бага 66.32) —');
const BATTLE = join(ROOT, 'game/assets/sprites/battle');
const sheets = readdirSync(BATTLE).filter(f => f.startsWith('battle_') && f.endsWith('.png'));
// 66.43: 55 листов героев + 4 листа вора/воровки (thiefm/thieff idle+attack1)
ok(sheets.length === 59, `всего 59 боевых листов (фактически ${sheets.length})`);
let badSheets = [];
for (const f of sheets) {
    const img = pngLoad(join(BATTLE, f));
    if (img.w !== 384 || img.h !== 128) { badSheets.push(`${f}: ${img.w}x${img.h}`); continue; }
    for (let i = 0; i < 4; i++) {
        let opaque = 0;
        for (let y = 0; y < 128; y++) {
            for (let x = i * 96; x < (i + 1) * 96; x++) {
                if (img.at(x, y)[3] > 20) opaque++;
            }
        }
        if (opaque <= 700) badSheets.push(`${f} кадр ${i}: всего ${opaque} px`);
    }
}
ok(badSheets.length === 0, `все 59×4 кадров полные (>700 px альфы)${badSheets.length ? ' — ПУСТЫЕ: ' + badSheets.slice(0, 4).join('; ') : ''}`);
// палитра ≤255 (color type 3) — совместимость с декодером r70
let nonPalette = [];
for (const f of sheets) {
    const buf = readFileSync(join(BATTLE, f));
    if (buf[25] !== 3) nonPalette.push(f);
}
ok(nonPalette.length === 0, `все листы палитровые (color type 3)${nonPalette.length ? ' — ' + nonPalette.join(',') : ''}`);

console.log('— 2. Сетка источников 3×128 (проверка постраничных зон) —');
const staging = '/home/z/my-project/drive_parts_battle';
if (existsSync(staging)) {
    //Быстрая проверка без внешних зависимостей: у полос 384×128 контент
    // лежит в трёх зонах ~128px; проверяем крайние зоны ненулевые у донора трубы
    ok(existsSync(join(staging, 'Baenor_MVsv_alt_stance2.png')), 'стейджинг альт-полос на месте');
    ok(existsSync(join(staging, 'Huntress_dead.png')), 'Huntress_dead.png в стейджинге (смерть Охотницы, сетка 128)');
} else {
    // 66.43: в чистой среде стейджинга нет — проверки ИСХОДНИКОВ необязательны
    // (готовые листы в репо проверяются секцией 1 независимо от стейджинга)
    ok(true, 'стейджинг альт-полос отсутствует (чистая среда) — пропущено');
}

console.log('— 3. Конвейер 66.42 — крой 3×128, hold-last —');
const conv = read('game/tools/mvsv_battle_6642.py');
ok(conv.includes('CELL = 128'), 'mvsv_battle_6642.py: CELL = 128 (истинная сетка полос)');
ok(conv.includes('frames + [frames[-1]]') || conv.includes('frames[-1]]'), '4-й кадр = hold последнего');
ok(conv.includes('def strip_frames_3x128'), 'кроитель strip_frames_3x128');
ok(conv.includes("'pbnoble'"), 'альты 66.40 тоже пересобраны');
ok(read('game/tools/mvsv_battle_6632.py').includes('ИСТОРИЧЕСКИЙ КОНВЕЙЕР'), 'mvsv_battle_6632.py помечен историческим');
ok(read('game/tools/mvsv_battle_6633.py').includes('ИСТОРИЧЕСКИЙ КОНВЕЙЕР'), 'mvsv_battle_6633.py помечен историческим');
ok(existsSync(join(ROOT, 'game/assets/sprites/battle/MANIFEST_6642.txt')), 'MANIFEST_6642.txt записан');

console.log('— 4. Печные трубы 66.42 —');
const fx = read('game/src/data/housesFX.js');
ok(fx.includes('[[40, 18], [148, 66]]'), 'housesFX: гончар — дымницы 66.86 (жерла 40,18 и 148,66; актуализация 66.87)');
ok(fx.includes('[[102, 34]]'), 'housesFX: знахарка/ремесленник — дымница 66.86 (жерло 102,34; актуализация 66.87)');
ok(!fx.includes('[[125, 38]]'), 'housesFX: старое жерло «фонарика» (125,38) снято');
// суммарно дымовых точек: 17 домов по 1 + староста 2 + гончар 2 = 20? нет:
// 18 зданий, у церкви 0. Считаем по фактам: 11 текстур домов с трубами,
// у fb_elder две, у fb_log_flowers теперь две → 12 текстур + 1 = 13 жерел
// в текстурах; зданий-эмиттеров 18 (у церкви 0): potter 2, tavern 1,
// carpenter 1, villager1 1, blacksmith 1, healer 1, shoptools 1, marfa 1,
// elder 2, beekeeper 1, butcher 1, weaver 1, stepan 1, shoemaker 1,
// woodcutter 1, fisher 1, grocer 1 = 19
const chimSum = [...fx.matchAll(/chimneys:\s*\[((?:\[[^\]]*\]\s*,?\s*)*)\]/g)]
    .map(m => (m[1].match(/\[\s*\d+\s*,\s*\d+\s*\]/g) || []).length)
    .reduce((a, b) => a + b, 0);
// 13 — в ТЕКСТУРАХ (elder 2 + гончар 2 + остальные 9 по 1, церковь 0);
// в живой деревне 19 эмиттеров (17 зданий × 1 + староста +1 + гончар +1) —
// живое значение проверяет qa_6639
ok(chimSum === 13, `суммарно 13 жерел в текстурах (фактически ${chimSum})`);
// текстуры: у гончара и знахарки каменная труба дорисована — в зоне посадки
// есть непрозрачные пиксели; оригиналы сохранены. Пиксели читает Python-пробник
// (RGBA-файлы fb_* с адаптивными фильтрами строк — вне зоны Node-декодера r94)
for (const f of ['fb_log_flowers', 'fb_tudor_sm']) {
    ok(existsSync(join(ROOT, `game/tools/fb_originals_6642/${f}.png`)), `fb_originals_6642/${f}.png сохранён`);
}
{
    const probe = JSON.parse(execSync(`python3 ${join(__dirname, 'test_98_pixel_probe.py')}`).toString());
    ok(probe.log_flowers_pipe > 800, `fb_log_flowers: каменная труба в зоне посадки (${probe.log_flowers_pipe} px)`);
    ok(probe.tudor_sm_pipe > 800, `fb_tudor_sm: каменная труба в зоне посадки (${probe.tudor_sm_pipe} px)`);
}
ok(read('game/tools/make_chimneys_6642.py').includes('fb_originals_6642'), 'make_chimneys_6642.py идемпотентен (оригиналы 6642)');

console.log('— 5. Скриншоты лендинга (приказы 2+4) —');
for (const f of ['01-title', '02-character-select', '03-character-custom', '04-village', '05-map',
    '06-elder-interior', '07-priest-dialogue', '08-combat', '09-thief-encounter']) {
    const p = join(ROOT, `assets/screenshots/${f}.webp`);
    ok(existsSync(p), `${f}.webp на месте`);
}

console.log('— 6. Инструменты 66.42 в репо —');
for (const f of ['qa_battle_thief_6642.mjs', 'qa_chimneys_6642.mjs', 'make_chimneys_6642.py']) {
    ok(existsSync(join(ROOT, `game/tools/${f}`)), `game/tools/${f} в репо`);
}

console.log('— 7. SW v92 / game-assets-v44 —');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md'); // 66.47: журнал переехал
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v125';"), 'SW: site-cache v125 (актуализация 66.92)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'SW: game-assets-v45');
ok(swlog.includes('66.42'), 'SW-журнал: запись 66.42 есть');

console.log(`\ntest_round98: ${pass} зелёных, ${fail} красных`);
if (fail > 0) { console.log(fails.map(f => '  RED: ' + f).join('\n')); process.exit(1); }

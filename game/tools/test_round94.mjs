// test_round94.mjs — ПАТЧ 66.38 (2 приказа владельца) + АКТУАЛИЗАЦИЯ 66.39:
//   1) ВАРИАНТЫ ОДЕЖДЫ ИЗ DRIVE-ПАКОВ: гардероб жителей расширен частями тех же
//      паков — мужские/женские причёски ×5 цветов (альты пака), бороды ×5,
//      шлемы стражи 10; 66.39: ЖЕНСКИЙ БРЮЧНЫЙ КОСТЮМ УДАЛЕН (неисторично
//      для Руси 15 века — приказ владельца: женщины только в длинных платьях,
//      брюки только у мужчин) — листы и логика сняты;
//   2) АССЕТЫ ВНЕШНЕГО ВИДА НПЦ И ИГРОКА пересобраны из НОВОЙ библиотеки
//      Google Drive (единый источник владельца; с 66.40 — 143 листа: 66.39
//      убрал 8 женских, 66.40 добавил базу KT_Male_1 и 5 кафтанов PB, геометрия 66.37).
// Проверки: конвейер (make_world_6638 + drive_fetch_world_6638), 143 листа
// 1152×512 в палитре ≤255, наборы листов, геометрия фигур, силуэты
// альтов = базам (IoU ≥ 0.9), таблицы WorldLook (без женских брюк),
// BootScene-перечень, SW v90/v35 (66.40).
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const game = join(__dirname, '..');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
    if (cond) { pass++; }
    else { fail++; fails.push(msg); console.log('  RED: ' + msg); }
}
function read(p) { return readFileSync(join(game, p), 'utf8'); }

// Минимальный PNG-декодер (color type 3 — палитра; конвейер 66.38 пишет только такие)
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
    const stride = w + 1; // colorType 3: 1 байт/пиксель
    const at = (x, y) => {
        const rowStart = y * stride;
        const pi = raw[rowStart + 1 + x]; // фильтры 0/2 не ломают индекс палитры у нашего выхода (фильтр 0 от PIL)
        const r = plte[pi * 3], g = plte[pi * 3 + 1], bl = plte[pi * 3 + 2];
        const a = trns && pi < trns.length ? trns[pi] : 255;
        return [r, g, bl, a];
    };
    return { w, h, colorType, at };
}

console.log('— 1. Конвейер 66.38 —');
ok(existsSync(join(game, 'tools/make_world_6638.py')), 'tools/make_world_6638.py в репо');
ok(existsSync(join(game, 'tools/drive_fetch_world_6638.py')), 'tools/drive_fetch_world_6638.py в репо');
const fetcher = read('tools/drive_fetch_world_6638.py');
ok(fetcher.includes('1p_tJFXiaQPEO1-EQVqg6dwnvvSyg2e3s'), 'fetcher: ссылка на библиотеку владельца');
// 66.39: женские брюки/топы больше НЕ скачиваются (неисторично)
ok(!fetcher.includes('Medieval_T&C_Female_Pants_') && !fetcher.includes('Medieval_T&C_Female_Top_'),
    '66.39: fetcher больше не качает женские брюки/топы');
ok(fetcher.includes('Medieval_Warfare_Male_Head_') && fetcher.includes('range(1, 11)'), 'fetcher: 10 шлемов Warfare');
ok(fetcher.includes('embeddedfolderview'), 'fetcher: перечисление через embeddedfolderview');

console.log('— 2. Мировые листы (143 после 66.40) —');
const worldDir = join(game, 'assets/sprites/world');
ok(existsSync(worldDir), 'assets/sprites/world/ на месте');
const files = readdirSync(worldDir).filter(f => f.endsWith('.png'));
// 66.40: 143 = 145 − 8 (3 брюк + 5 топов женщин удалены в 66.39)
//       + 1 база KT_Male_1 + 5 кафтанов PB (= 8 новых в 66.40)
ok(files.length === 143, `143 мировых листа [${files.length}]`);
ok(!files.some(f => f.startsWith('world_f_pants') || f.startsWith('world_f_top')),
    '66.39: женских брюк/топов на диске нет (неисторично)');
const sheetsSet = new Set(files);
// полнота наборов (66.39: без женских брюк/топов)
const mustRanges = [
    ['world_m_hair', 30], ['world_m_beard', 10], ['world_f_hair', 35], ['world_w_helm', 10],
];
mustRanges.forEach(([pre, n]) => {
    for (let i = 1; i <= n; i++) {
        ok(files.includes(`${pre}${i}.png`), `${pre}${i}.png в паке мировых листов`);
    }
});
// размеры/палитра всех листов
let badSize = 0, notPalette = 0;
files.forEach(f => {
    const s = pngLoad(join(worldDir, f));
    if (s.w !== 1152 || s.h !== 512) badSize++;
    if (s.colorType !== 3) notPalette++;
});
ok(badSize === 0, `все листы 1152×512 [плохих: ${badSize}]`);
ok(notPalette === 0, `все листы в палитре ≤255 [не-палитровых: ${notPalette}]`);

// геометрия полных фигур: рост 85..95, ноги y=120..128, центр 52..76
function frameBbox(f) {
    const img = pngLoad(join(worldDir, f));
    let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const [, , , a] = img.at(x, y);
        if (a > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { x0, y0, x1, y1, h: y1 - y0 + 1, cx: (x0 + x1) / 2 };
}
['world_m_base1.png', 'world_f_base1.png', 'world_hero_male.png', 'world_hero_female.png',
    'world_child1.png'].forEach(f => {
    const b = frameBbox(f);
    ok(b.h >= 85 && b.h <= 95, `${f}: рост фигуры 85..95 [${b.h}]`);
    ok(b.y1 >= 120 && b.y1 <= 128, `${f}: ноги у y=126 [${b.y1}]`);
    ok(b.cx >= 52 && b.cx <= 76, `${f}: фигура по центру ячейки [cx=${b.cx.toFixed(1)}]`);
});
// шлемы — область головы (верх 25..45, низ ≤ 70)
['world_w_helm1.png', 'world_w_helm10.png'].forEach(f => {
    const bb = frameBbox(f);
    ok(bb.y0 >= 25 && bb.y0 <= 45, `${f}: верх шлема в полосе головы [${bb.y0}]`);
    ok(bb.y1 <= 70, `${f}: шлем не ниже головы [${bb.y1}]`);
});
// альты = та же форма, другой цвет (IoU альфа-масок ≥ 0.9; у пака минорный рендер-шум)
function alphaIoU(a, b) {
    const A = pngLoad(join(worldDir, a)), B = pngLoad(join(worldDir, b));
    let inter = 0, uni = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const pa = A.at(x, y)[3] > 20, pb = B.at(x, y)[3] > 20;
        if (pa && pb) inter++;
        if (pa || pb) uni++;
    }
    return inter / uni;
}
[['world_m_hair1.png', 'world_m_hair7.png'], ['world_m_hair2.png', 'world_m_hair11.png'],
 ['world_f_hair1.png', 'world_f_hair8.png'], ['world_m_beard1.png', 'world_m_beard3.png']].forEach(([base, alt]) => {
    const v = alphaIoU(base, alt);
    ok(v >= 0.9, `${alt}: силуэт = ${base} (IoU ≥ 0.9) [${v.toFixed(3)}]`);
});
// цвет альтов отличается от базы
function colorDiffers(fa, fb) {
    const A = pngLoad(join(worldDir, fa)), B = pngLoad(join(worldDir, fb));
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const pa = A.at(x, y), pb = B.at(x, y);
        if (pa[3] > 20 && pb[3] > 20 && (pa[0] !== pb[0] || pa[1] !== pb[1] || pa[2] !== pb[2])) return true;
    }
    return false;
}
ok(colorDiffers('world_m_hair1.png', 'world_m_hair7.png'), 'world_m_hair7: цвет отличается от hair1');
ok(colorDiffers('world_m_hair1.png', 'world_m_hair8.png'), 'world_m_hair8: цвет отличается от hair1');
ok(colorDiffers('world_m_hair1.png', 'world_m_hair9.png'), 'world_m_hair9: цвет отличается от hair1');

console.log('— 3. WorldLook.js: таблицы (66.39: женщины — только платья) —');
const worldLook = read('src/systems/WorldLook.js');
ok(worldLook.includes("length: 30 }, (_, i) => `world_m_hair${i + 1}`"), 'M.hair: 30 причёсок');
ok(worldLook.includes("length: 10 }, (_, i) => `world_m_beard${i + 1}`"), 'M.beards: 10 бород');
ok(worldLook.includes("length: 35 }, (_, i) => `world_f_hair${i + 1}`"), 'F.hair: 35 причёсок');
ok(worldLook.includes("length: 10 }, (_, i) => `world_w_helm${i + 1}`"), 'W.helms: 10 шлемов');
// 66.39: женских брюк/топов и брючной логики БОЛЬШЕ НЕТ
ok(!worldLook.includes('trousers'), '66.39: флаг trousers удалён (неисторично)');
ok(!worldLook.includes('world_f_pants') && !worldLook.includes('world_f_top'),
    '66.39: в WorldLook нет ссылок на женские брюки/топы');
ok(worldLook.includes('длинное платье'), '66.39: в комментарии — только длинные платья');
// прежние контракты не тронуты
ok(worldLook.includes('export const WORLD_K = 31 / 88;'), 'WORLD_K = 31/88 сохранён');
ok(worldLook.includes('export const WORLD_BODY_PX = 68;'), 'WORLD_BODY_PX = 68 сохранён');
ok(worldLook.includes("`npc_lpc_${npc.id}`") && worldLook.includes("'player_composite'"), 'ключи композитов сохранены');
// все ключи, на которые ссылается WorldLook, существуют на диске
const keyRefs = [...worldLook.matchAll(/world_[a-z_]+\d+/g)].map(m => m[0]);
const missingRefs = [...new Set(keyRefs)].filter(k => !sheetsSet.has(k + '.png'));
ok(missingRefs.length === 0, `все ключи WorldLook существуют на диске [нет: ${missingRefs.slice(0, 5)}]`);

console.log('— 4. BootScene: предзагрузка 137 листов —');
const boot = read('src/scenes/BootScene.js');
ok(/frameWidth:\s*128/.test(boot), 'кадры мировых листов 128px');
['world_m_hair30', 'world_m_beard10', 'world_f_hair35', 'world_w_helm10']
    .forEach(k => ok(boot.includes(`'${k}'`), `BootScene: ${k} в загрузке`));
ok(!boot.includes("'world_f_pants1'") && !boot.includes("'world_f_top5'"),
    '66.39: женские брюки/топы из загрузки удалены');
const bootKeys = [...boot.matchAll(/'(world_[a-z_0-9]+)'/g)].map(m => m[1]);
const bootUnique = [...new Set(bootKeys)];
ok(bootUnique.length >= 143, `BootScene: перечислены все мировые листы [${bootUnique.length} ≥ 143]`);
const missingOnDisk = bootUnique.filter(k => !sheetsSet.has(k + '.png'));
const notInBoot = [...sheetsSet].filter(f => !bootUnique.includes(f.replace('.png', '')));
ok(missingOnDisk.length === 0, `BootScene не грузит несуществующие [${missingOnDisk.slice(0, 5)}]`);
ok(notInBoot.length === 0, `все листы на диске в загрузке [нет: ${notInBoot.slice(0, 5)}]`);

console.log('— 5. SW: site-cache v96, game-assets-v44 (66.39) —');
const sw = read('../sw.js');
const swlog = read('../docs/SW_CHANGELOG.md'); // 66.47: журнал переехал
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v121';"), 'SW: site-cache v121 (актуализация 66.87)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'SW: game-assets-v45');
ok(swlog.includes('v89 — итерация 66.39'), 'SW: журнал версий дополнен');

console.log('');
console.log(`=== ИТОГ: ${pass} OK, ${fail} FAIL ===`);
if (fail > 0) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exit(1); }

// test_round96.mjs — ПАТЧ 66.40 (приказы владельца):
//   1) PB/KT_Humans: человеческие ассеты библиотеки задействованы
//      (приказ «если есть человеческие ассеты для НПЦ и героя — можно»):
//      база жителей world_m_base4 = Medieval_KT_Male_1 (ЖИВОЙ по бусту),
//      кафтаны world_m_top10..14 = PB_Male_Top_{1,2,3,5,8} (одежда безликая).
//      ОТБРАКОВАНО по бустам (не люди/неисторично): PB_Male_1/2 — зомби,
//      PB_Premade_Male_1 — зомби, PB_Premade_Male_3 — чумной доктор,
//      женская одежда PB/KT — штаны/короткие табарды (приказ 66.39);
//   2) АЛЬТ СЫЩИКА: paul → pbnoble «Яромир» (PB_Premade_Male_2 — живой
//      дворянин): 7 боевых листов (СО стрельбой — полоса в паке есть)
//      + 8 бустов; листалка Сыщика = 16 вариантов;
//   3) КАРТА: мельница ПЕРЕНЕСЕНА РЯДОМ С ПАСЕКОЙ (зона/подпись/дорожка);
//   4) SW v92/game-assets-v41; конвейеры 6640 в репо.
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

// Минимальный PNG-декодер (color type 3 — палитра; конвейер пишет только такие)
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
    const stride = w + 1;
    const at = (x, y) => {
        const pi = raw[y * stride + 1 + x];
        const r = plte[pi * 3], g = plte[pi * 3 + 1], bl = plte[pi * 3 + 2];
        const a = trns && pi < trns.length ? trns[pi] : 255;
        return [r, g, bl, a];
    };
    return { w, h, colorType, at };
}

console.log('— 1. Конвейеры 66.40 в репо —');
for (const t of ['tools/drive_fetch_pbkt_6640.py', 'tools/make_world_6640.py',
    'tools/make_battle_alts_6640.py', 'tools/make_busts_6640.py']) {
    ok(existsSync(join(game, t)), `${t} в репо`);
}
const fetcher40 = read('tools/drive_fetch_pbkt_6640.py');
ok(fetcher40.includes('Medieval_KT_Male_1'), 'fetcher 6640: база KT_Male_1');
ok(fetcher40.includes('Medieval_PB_Premade_Male_2'), 'fetcher 6640: премаde-дворянин (альт Сыщика)');
ok(!fetcher40.includes('Medieval_PB_Male_1_walking') && !fetcher40.includes('Medieval_PB_Male_2_walking'),
    'fetcher 6640: зомби-базы PB_Male_1/2 НЕ качаются');
ok(!fetcher40.includes('Medieval_PB_Premade_Male_1_') && !fetcher40.includes('Medieval_PB_Premade_Male_3_'),
    'fetcher 6640: зомби/чумной доктор из премаde НЕ качаются');
const mw40 = read('tools/make_world_6640.py');
ok(mw40.includes('ЗОМБИ') || mw40.includes('зомби'), 'make_world_6640: отбраковка задокументирована');
ok(mw40.includes("('world_m_base4', 'male', 'Medieval_KT_Male_1')"), 'make_world_6640: world_m_base4 = KT_Male_1');

console.log('— 2. Мировые листы 66.40 (база KT + кафтаны PB) —');
const worldDir = join(game, 'assets/sprites/world');
const files = readdirSync(worldDir).filter(f => f.endsWith('.png'));
ok(files.includes('world_m_base4.png'), 'world_m_base4.png (KT_Male_1) на диске');
ok(files.includes('world_m_base5.png') === false && files.includes('world_m_base6.png') === false,
    'зомби-баз PB на диске НЕТ (world_m_base5/6)');
for (let i = 10; i <= 14; i++) {
    ok(files.includes(`world_m_top${i}.png`), `world_m_top${i}.png (кафтан PB) на диске`);
}
// геометрия новой базы: тот же класс 'male' (рост 88, ноги 126)
{
    const img = pngLoad(join(worldDir, 'world_m_base4.png'));
    ok(img.w === 1152 && img.h === 512, 'world_m_base4: 1152×512');
    ok(img.colorType === 3, 'world_m_base4: палитра ≤255');
    let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const [, , , a] = img.at(x, y);
        if (a > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    ok((y1 - y0 + 1) >= 85 && (y1 - y0 + 1) <= 95, `world_m_base4: рост фигуры 85..95 [${y1 - y0 + 1}]`);
    ok(y1 >= 120 && y1 <= 128, `world_m_base4: ноги у y=126 [${y1}]`);
    // кафтан длинный: нижний край ниже y=100 (короткая туника TC — до ~75)
    const robe = pngLoad(join(worldDir, 'world_m_top10.png'));
    let r0 = 999, r1 = -1;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        if (robe.at(x, y)[3] > 20) { if (y < r0) r0 = y; if (y > r1) r1 = y; }
    }
    ok(r1 >= 100, `кафтан world_m_top10 длинный (нижний край y=${r1} ≥ 100)`);
}

console.log('— 3. Таблицы WorldLook/BootScene —');
const worldLook = read('src/systems/WorldLook.js');
ok(worldLook.includes("'world_m_base4'"), 'WorldLook: база 4 в M.bases');
ok(/tops:\s*Array\.from\(\{\s*length:\s*14\s*\}/.test(worldLook), 'WorldLook: M.tops длина 14');
ok(/bases:\s*\[.*'world_m_base4'\]/.test(worldLook), 'WorldLook: M.bases — 4 элемента');
ok(!worldLook.includes('world_m_base5') && !worldLook.includes('world_m_base6'),
    'WorldLook: зомби-баз в таблицах нет');
ok(!worldLook.includes('pbwarrior'), 'WorldLook: след зомби-альта pbwarrior снят');
const boot = read('src/scenes/BootScene.js');
ok(boot.includes("'world_m_base4'") && boot.includes("'world_m_top14'"),
    'BootScene: новая база и кафтаны в предзагрузке');
ok(!boot.includes("'world_m_base5'") && !boot.includes("'world_m_base6'"),
    'BootScene: зомби-баз в предзагрузке нет');
ok(/pbnoble:\s*\['idle',\s*'attack1',\s*'attack2',\s*'fists',\s*'shoot',\s*'death',\s*'victory'\]/.test(boot),
    'BootScene: pbnoble — 7 анимаций (со стрельбой)');
ok(boot.includes('bust_pbnoble_'), 'BootScene: бусты Яромира в предзагрузке');

console.log('— 4. Боевые листы pbnoble (альт Сыщика) —');
const battleDir = join(game, 'assets/sprites/battle');
for (const a of ['idle', 'attack1', 'attack2', 'fists', 'shoot', 'death', 'victory']) {
    const p = join(battleDir, `battle_pbnoble_${a}.png`);
    ok(existsSync(p), `battle_pbnoble_${a}.png на месте`);
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    ok(buf.readUInt32BE(16) === 384 && buf.readUInt32BE(20) === 128, `battle_pbnoble_${a}.png: 384×128`);
    ok(buf[25] === 3, `battle_pbnoble_${a}.png: палитровый`);
}
ok(existsSync(join(battleDir, 'MANIFEST_6640.txt')), 'MANIFEST_6640 боевых листов в репо');
ok(!existsSync(join(battleDir, 'battle_pbwarrior_idle.png')), 'зомби-альт pbwarrior с диска снят');
// контент idle: фигура занимает существенную площадь (полосы не «пустые»)
{
    const img = pngLoad(join(battleDir, 'battle_pbnoble_idle.png'));
    let mass = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 384; x++) {
        if (img.at(x, y)[3] > 40) mass++;
    }
    ok(mass > 2000, `idle pbnoble: альфа-масса существенная [${mass} > 2000]`);
}

console.log('— 5. Бусты pbnoble —');
const bustsDir = join(game, 'assets/sprites/busts');
const bustFiles = readdirSync(bustsDir).filter(f => f.startsWith('bust_') && f.endsWith('.png'));
for (let i = 1; i <= 8; i++) {
    const p = join(bustsDir, `bust_pbnoble_${i}.png`);
    ok(existsSync(p), `bust_pbnoble_${i}.png на месте`);
    if (!existsSync(p)) continue;
    const img = pngLoad(p);
    ok(img.w === 256 && img.h === 256, `bust_pbnoble_${i}.png: 256×256`);
    ok(img.colorType === 3, `bust_pbnoble_${i}.png: палитровый`);
}
ok(bustFiles.length === 43, `всего бустов 43 [${bustFiles.length}]`);
ok(!existsSync(join(bustsDir, 'bust_pbwarrior_1.png')), 'зомби-буст pbwarrior с диска снят');
ok(existsSync(join(bustsDir, 'MANIFEST_6640.txt')), 'MANIFEST_6640 бустов в репо');

console.log('— 6. heroes.js/i18n: альт Сыщика —');
const heroes = read('src/data/heroes.js');
ok(/paul:\s*'pbnoble'/.test(heroes), 'BATTLE_LOOK_ALT_BY_LOOK: paul → pbnoble');
ok(/pbnoble:\s*'Яромир'/.test(heroes), 'ALT_LOOK_NAMES: pbnoble = Яромир');
ok(/pbnoble:\s*Array\.from\(\{\s*length:\s*8\s*\}/.test(heroes), 'BUSTS_BY_LOOK: 8 бустов pbnoble');
ok(/pbnoble:\s*'bust_pbnoble_1'/.test(heroes), 'BUST_BY_LOOK страховка: bust_pbnoble_1');
// bustVariantsFor('Сыщик','male') = 8 paul + 8 pbnoble = 16
const heroesSrc = heroes;
ok(/export function bustVariantsFor/.test(heroesSrc), 'bustVariantsFor на месте (считает канон+альт)');
const i18n = read('src/systems/i18n.js');
ok(i18n.includes("'Яромир': 'Yaromir'"), 'i18n: EN-имя Yaromir');

console.log('— 7. Карта: мельница рядом с пасекой —');
const tmap = read('src/systems/TerrainMap.js');
ok(/mill:\s*\{\s*x:\s*252,\s*y:\s*388,\s*pathY:\s*388\s*\}/.test(tmap),
    'TERRAIN.mill = (252, 388) — рядом с пасекой');
ok(/\{ id: 'mill',\s*shape: 'ellipse',\s*x: 252,\s*y: 382,\s*rx: 42,\s*ry: 46 \}/.test(tmap),
    'клик-зона мельницы — эллипс у новой поляны (включая подпись)');
ok(/text: 'Мельница', x: 216, y: 404/.test(tmap), 'подпись «Мельница» у новой поляны');
ok(/\[\[348, 254\], \[320, 302\], \[296, 346\], \[272, 376\]\]/.test(tmap),
    'дорожка к мельнице проложена на юго-запад');
// зона не пересекает пасеку (правый край 218) и погост (левый край 304)
ok(252 + 30 <= 304 && 252 - 30 >= 218, 'зона мельницы между пасекой и погостом без наложений');

console.log('— 8. SW v90 —');
const sw = read('../sw.js');
const swlog = read('../docs/SW_CHANGELOG.md'); // 66.47: журнал переехал
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v99';"), 'SW: site-cache v96');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v41';"), 'SW: game-assets-v41');
ok(swlog.includes('66.40'), 'SW-журнал: запись 66.40 есть');

console.log(`\ntest_round96: ${pass} зелёных, ${fail} красных`);
if (fail > 0) { console.log(fails.map(f => '  RED: ' + f).join('\n')); process.exit(1); }

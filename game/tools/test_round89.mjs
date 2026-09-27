// test_round89.mjs — итерация 66.33: хвосты 66.32.
// 1) Атаки Найи из базового MVsv (сетка 9×6 @128×128 — док-ошибка 66.29 исправлена)
// 2) Rim-light тёмных обликов (baenor/paul 1.0, gaerron 0.9, huntress 0.75; naia 0)
// 3) Бусты пака в меню: 6 файлов, heroes.js BUST_BY_PRESET/getBustFor, BootScene,
//    CharacterSelectionScene (карточки + превью), CharacterScene (свиток, ≥900px)
// 4) SW v84 + game-assets-v30. Сейвы совместимы.
// Запуск: cd game/tools && node test_round89.mjs
import { readFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
    if (cond) { pass++; console.log(`  ✓ ${msg}`); }
    else { fail++; console.log(`  ✗ FAIL: ${msg}`); }
};
const read = p => readFileSync(p, 'utf8');
const BATTLE = '../assets/sprites/battle';
const BUSTS = '../assets/sprites/busts';

const isPalettePng = (p) => {
    const b = readFileSync(p);
    return b.length > 26 && b[25] === 3; // color type 3 (палитра), bits=8
};
const pngSize = (p) => {
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

console.log('--- 1. Атаки Найи из базового MVsv (п.1) ---');
const pipe = read('../tools/mvsv_battle_6633.py');
ok(pipe.includes('NAIA_BASE_CELLS'), 'конвейер 6633: карта ячеек базового листа Найи');
ok(pipe.includes("'a1':   [(5, 3), (5, 4), (5, 5), (5, 5)],"), 'attack1: замах→удар→проводка→удержание (r5c3..c5; QA-6633 убрал r2c0 с обрезанным флаилом)');
ok(pipe.includes("'a2':   [(0, 5), (0, 6), (0, 7), (0, 8)],"), 'attack2: бело-калёный удар щитом (r0c5..c8)');
ok(pipe.includes("'bash': [(1, 3), (1, 4), (1, 5), (1, 6)],"), 'fists: удар щитом (r1c3..c6)');
ok(pipe.includes("assert im.size == (1152, 768)"), 'базовый лист проверяется 1152×768');
ok(!pipe.includes("'critical6'"), 'critical6 больше не используется (был приседом со щитом)');
for (const a of ['attack1', 'attack2', 'fists']) {
    const p = `${BATTLE}/battle_naia_${a}.png`;
    ok(existsSync(p), `battle_naia_${a}.png на месте`);
    const s = pngSize(p);
    ok(s.w === 384 && s.h === 128, `battle_naia_${a}.png: 384×128`);
    ok(isPalettePng(p), `battle_naia_${a}.png: палитровый (color type 3)`);
}
// 66.35: rim-light Найи ради единообразия (naia 0.6) — в манифесте +rim0.6
const manifest = read(`${BATTLE}/MANIFEST_6633.txt`).trim().split('\n');
const manifestBody = manifest.slice(0, 34);
ok(manifest.length === 35, 'манифест 6633: 34 записи + итог');
const noteOf = name => manifestBody.find(l => l.startsWith(name)) || '';
for (const a of ['idle', 'shoot', 'death', 'victory']) {
    const n = noteOf(`battle_naia_${a}.png`);
    ok(n.length > 0 && n.includes('+rim0.6'), `battle_naia_${a}: лист с римом 0.6 (66.35) [${n}]`);
}
for (const a of ['attack1', 'attack2', 'fists']) {
    ok(noteOf(`battle_naia_${a}.png`).includes('Naia_MVsv 128er'), `battle_naia_${a}: манифест указывает базовый MVsv`);
}

console.log('--- 2. Rim-light тёмных обликов (п.2) ---');
ok(/RIM = \{'baenor': 1\.0, 'gaerron': 0\.9, 'huntress': 0\.75, 'paul': 1\.0, 'naia': 0\.6\}/.test(pipe),
    'силы rim: baenor/paul 1.0, gaerron 0.9, huntress 0.75, naia 0.6 (66.35 единообразие)');
ok(pipe.includes('RIM_COLOR = (255, 238, 196)'), 'цвет рима — тёплый пергамент (в тон золоту UI)');
ok(pipe.includes('LIGHT = (-0.55, -0.83)'), 'свет сверху-слева (как солнце в SkyClock)');
ok(pipe.includes('def rim_light'), 'функция rim_light в конвейере');
const rimCount = manifestBody.filter(l => l.includes('+rim')).length;
ok(rimCount === 34, `рим-листов 34 (66.35: все облики, включая Найю): ${rimCount}`);

console.log('--- 3. Бусты пака в меню (п.3) ---');
const bustFiles = ['bust_baenor_1', 'bust_baenor_5', 'bust_huntress_1', 'bust_huntress_5', 'bust_gaerron', 'bust_naia'];
let bustKB = 0;
for (const k of bustFiles) {
    const p = `${BUSTS}/${k}.png`;
    ok(existsSync(p), `${k}.png на месте`);
    if (existsSync(p)) {
        const s = pngSize(p);
        ok(s.w === 256 && s.h === 256, `${k}.png: 256×256`);
        ok(isPalettePng(p), `${k}.png: палитровый`);
        bustKB += statSync(p).size;
    }
}
ok(bustKB < 150 * 1024, `вес бустов разумный: ${Math.round(bustKB / 1024)} КБ (< 150 КБ)`);
ok(existsSync('../tools/make_busts_6633.py'), 'tools/make_busts_6633.py в репо');
ok(existsSync(`${BATTLE}/MANIFEST_6633.txt`), 'манифест 6633 в репо');

const heroes = read('../src/data/heroes.js');
ok(heroes.includes('export const BUST_BY_PRESET'), 'heroes.js: карта бустов по пресетам');
ok(heroes.includes("export function getBustFor"), 'heroes.js: getBustFor экспортирован');
for (const pair of ['Воин|male', 'Воин|female', 'Следопыт|male', 'Следопыт|female', 'Сыщик|male', 'Сыщик|female', 'Приключенец|male', 'Приключенец|female']) {
    ok(heroes.includes(`'${pair}':`), `буст-маппинг ${pair}`);
}
ok(/'Сыщик\|male': null/.test(heroes), 'Сыщик|male → null (буста Пауля в паке нет)');
ok(heroes.includes('BUST_BY_LOOK'), 'страховка getBustFor по облику (BUST_BY_LOOK)');

const boot = read('../src/scenes/BootScene.js');
ok(boot.includes('const BUST_KEYS_6633 = ['), 'BootScene: список бустов объявлен');
ok(!/export\s+const\s+BUST_KEYS_6633/.test(boot), 'ВАЖНО: список бустов НЕ экспортируется (первый экспорт = класс сцены)');
for (const k of bustFiles) ok(boot.includes(`'${k}'`), `BootScene грузит ${k}`);
ok(boot.includes("this.load.image(k, `assets/sprites/busts/${k}.png`)"), 'BootScene: загрузка из assets/sprites/busts/');

const sel = read('../src/scenes/CharacterSelectionScene.js');
ok(sel.includes("import { getBustFor } from '../data/heroes.js';"), 'сцена выбора: импорт getBustFor');
ok(sel.includes('h >= 160 && this.textures.exists(bustKey)'), 'карточка: буст только при h≥160 и живой текстуре');
ok(sel.includes('panelW >= 600 && this.textures.exists(bustKey)'), 'превью: буст только при панели ≥600px (мобильный без наложений)');
ok(sel.includes('const oneLine = compact || hasBust;'), 'снаряжение буст-карточек — одной строкой (без пересечений)');

const charScene = read('../src/scenes/CharacterScene.js');
ok(charScene.includes("import { getBustFor } from '../data/heroes.js';"), 'свиток персонажа: импорт getBustFor');
ok(charScene.includes('width >= 900 && this.textures.exists(bustKey)'), 'свиток: буст только на экранах ≥900px');

console.log('--- 4. SW v84 + game-assets-v30 (п.4) ---');
const sw = read('../../sw.js');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v85';"), 'SW: site-cache v84');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v30';"), 'SW: game-assets-v30 (30 листов перегенерированы + 6 бустов)');
ok(sw.includes('// v84 — итерация 66.34'), 'SW: журнал содержит запись v84');
// game-assets кэширует /game/assets/ целиком — бусты попадают автоматически,
// отдельный список не нужен (проверяем отсутствие хардкода бустов в sw)
ok(!sw.includes('bust_baenor'), 'SW: бусты не хардкожены (кэш по префиксу /game/assets/)');

console.log(`\nИТОГО: ✓ ${pass}  ✗ ${fail}`);
process.exit(fail ? 1 : 0);

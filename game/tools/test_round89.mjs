// test_round89.mjs — итерация 66.33: хвосты 66.32.
// 1) Атаки Найи из базового MVsv (сетка 9×6 @128×128 — док-ошибка 66.29 исправлена)
// 2) Rim-light тёмных обликов (baenor/paul 1.0, gaerron 0.9, huntress 0.75; naia 0)
// 3) Бусты пака в меню: 6 файлов, heroes.js BUST_BY_PRESET/getBustFor, BootScene,
//    CharacterSelectionScene (карточки + превью), CharacterScene (свиток, ≥900px)
// 4) SW v84 + game-assets-v44. Сейвы совместимы.
// Запуск: cd game/tools && node test_round89.mjs
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
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
// 66.39: полный комплект альтов — 35 бустов (было 6); каноничные 6 остаются на месте
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
// 66.39/66.40: полный комплект — 43 файла (Баэнор/Охотница/Пауль/Лейанн ×8 +
// Гаэррон/Найя/Эстер + Яромир/pbnoble ×8 из пака PB)
const allBusts = readdirSync(BUSTS).filter(f => f.startsWith('bust_') && f.endsWith('.png'));
ok(allBusts.length === 43, `полный комплект альтов: 43 буста [${allBusts.length}]`);
ok(existsSync(`${BUSTS}/bust_paul_1.png`) && existsSync(`${BUSTS}/bust_leyanne_1.png`)
    && existsSync(`${BUSTS}/bust_esther.png`) && existsSync(`${BUSTS}/bust_pbnoble_1.png`),
    'новые бусты 66.39/66.40: Пауль/Лейанн/Эстер/Яромир на месте');
ok(bustKB < 900 * 1024, `вес бустов разумный: ${Math.round(bustKB / 1024)} КБ (< 900 КБ)`);
ok(existsSync('../tools/make_busts_6633.py'), 'tools/make_busts_6633.py в репо');
ok(existsSync('../tools/make_busts_6639.py'), '66.39: tools/make_busts_6639.py в репо (полный комплект)');
ok(existsSync(`${BATTLE}/MANIFEST_6633.txt`), 'манифест 6633 (боевые листы) в репо');
ok(existsSync(`${BUSTS}/MANIFEST_6639.txt`), '66.39: манифест make_busts_6639 в репо');

const heroes = read('../src/data/heroes.js');
ok(heroes.includes('export const BUST_BY_PRESET'), 'heroes.js: карта бустов по пресетам');
ok(heroes.includes("export function getBustFor"), 'heroes.js: getBustFor экспортирован');
for (const pair of ['Воин|male', 'Воин|female', 'Следопыт|male', 'Следопыт|female', 'Сыщик|male', 'Сыщик|female', 'Приключенец|male', 'Приключенец|female']) {
    ok(heroes.includes(`'${pair}':`), `буст-маппинг ${pair}`);
}
ok(heroes.includes("'Сыщик|male': 'bust_paul_1'"), '66.39: Сыщик|male → bust_paul_1 (бусты Пауля появились в библиотеке)');
ok(heroes.includes('BUST_BY_LOOK'), 'страховка getBustFor по облику (BUST_BY_LOOK)');
// 66.39: альты боевых обликов + варианты бустов
ok(heroes.includes('export const BATTLE_LOOK_ALT_BY_LOOK'), 'heroes.js: карта альтов боевых обликов');
ok(heroes.includes("baenor: 'esther'") && heroes.includes("huntress: 'leyanne'"), 'альты: baenor→esther, huntress→leyanne');
ok(heroes.includes('export const BUSTS_BY_LOOK'), 'heroes.js: полный комплект бустов по облику (BUSTS_BY_LOOK)');
ok(heroes.includes('export function bustVariantsFor'), 'heroes.js: bustVariantsFor (листалка альтов)');

const boot = read('../src/scenes/BootScene.js');
ok(boot.includes('const BUST_KEYS_6633 = ['), 'BootScene: список бустов объявлен');
ok(!/export\s+const\s+BUST_KEYS_6633/.test(boot), 'ВАЖНО: список бустов НЕ экспортируется (первый экспорт = класс сцены)');
for (const k of bustFiles) ok(allBusts.includes(`${k}.png`), `на диске ${k}.png`);
// 66.39: список в BootScene генерируется (32×flatMap + 3 единственных) —
// полнота соответствия диску проверяет test_round95
ok(boot.includes("['baenor', 'huntress', 'paul', 'leyanne'].flatMap"), 'BootScene: бусты героев ×8 генерируются списком');
ok(boot.includes("'bust_gaerron', 'bust_naia', 'bust_esther'"), 'BootScene: единственные бусты в списке');
ok(boot.includes("this.load.image(k, `assets/sprites/busts/${k}.png`)"), 'BootScene: загрузка из assets/sprites/busts/');

const sel = read('../src/scenes/CharacterSelectionScene.js');
ok(sel.includes("import { getBustFor, bustVariantsFor, ALT_LOOK_NAMES } from '../data/heroes.js';"), '66.39: сцена выбора импортирует варианты альтов');
ok(sel.includes('h >= 160 && this.textures.exists(bustKey)'), 'карточка: буст только при h≥160 и живой текстуре');
ok(sel.includes('panelW >= 600 && this._variants.length > 0'), '66.39: превью — листалка при панели ≥600px (мобильный без наложений)');
ok(sel.includes('cycleVariant(') && sel.includes('updateVariantLabel()'), '66.39: листалка альтов (◀/▶ + подпись)');
ok(sel.includes('hero.bustKey = variant.bust') && sel.includes('hero.battleLookKey = variant.look'), '66.39: выбор пишется в героя (bustKey + battleLookKey)');
ok(sel.includes('const oneLine = compact || hasBust;'), 'снаряжение буст-карточек — одной строкой (без пересечений)');

const charScene = read('../src/scenes/CharacterScene.js');
ok(charScene.includes("import { getBustFor } from '../data/heroes.js';"), 'свиток персонажа: импорт getBustFor');
ok(charScene.includes('width >= 900 && this.textures.exists(bustKey)'), 'свиток: буст только на экранах ≥900px');
ok(charScene.includes('p.bustKey || getBustFor(p.archetype, p.gender)'), '66.39: свиток показывает выбранный вариант (hero.bustKey)');

console.log('--- 4. SW v89 + game-assets-v44 (п.4) ---'); // 66.39: актуализация (35 бустов + альты обликов + удаление женских брюк)
const sw = read('../../sw.js');
const swlog = read('../../docs/SW_CHANGELOG.md'); // 66.47: журнал переехал
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v123';"), 'SW: site-cache v123 (актуализация 66.90)');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'SW: game-assets-v45 (35 бустов + 14 боевых альтов, −8 женских брюк/топов)');
ok(swlog.includes('v89 — итерация 66.39'), 'SW: журнал содержит запись v89');
// game-assets кэширует /game/assets/ целиком — бусты попадают автоматически,
// отдельный список не нужен (проверяем отсутствие хардкода бустов в sw)
ok(!sw.includes('bust_baenor'), 'SW: бусты не хардкожены (кэш по префиксу /game/assets/)');

console.log(`\nИТОГО: ✓ ${pass}  ✗ ${fail}`);
process.exit(fail ? 1 : 0);

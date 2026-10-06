// test_round99.mjs — ПАТЧ 66.43 (7 приказов владельца):
//   1) ДОРОЖКИ К ДВЕРЯМ (приказ 5): каждая из 18 дверей деревни имеет
//      песчаную дорожку от двери до своей улицы + БФС-достижимость —
//      регресс-тест связности планировки (66.35/66.43).
//   2) ЧАСТОКОЛ (приказ 6): новый palisade_0 32×32 — два составленных
//      бревна на тайл (непрерывная стена без просветов), наклонные срезы
//      (остриё внутри тайла), горизонтальная обвязка.
//   3) НОВАЯ МОДЕЛЬ ВОРА В БОЮ (приказ 7): 4 боковых листа
//      battle_thiefm/thieff_{idle,attack1} + подключение в BootScene и
//      CombatScene (вор на линии ног героя, выпад кинжалом).
//   4) ЛИЦОМ К ЛИЦУ (приказ 4): герой на MVsv-листах флипается (setFlipX) —
//      фигуры пака смотрят влево, без флипа герой стоял спиной к вору.
//   5) ПЕРЕСЪЁМКА (приказы 2+3): __shotReady у ScreenshotDirector, оседание
//      кадра меню, глушение туториала; 9 webp на месте.
//   6) SW v93 / game-assets-v44.
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const fails = [];
const ok = (cond, name) => { if (cond) pass++; else { fail++; fails.push(name); } console.log((cond ? '  ✓ ' : '  ✗ ') + name); };

// Декодер PNG: colorType 3 (палитра) / 6 (RGBA8) с ПОЛНОЙ реконструкцией
// фильтров сканлайнов (PIL для RGBA пишет адаптивные Sub/Up/Average/Paeth —
// фильтр 0 нельзя предполагать, урок r99).
function pngLoad(path) {
    const b = readFileSync(path);
    let off = 8, w = 0, h = 0, colorType = 0, bitDepth = 8, plte = null, trns = null;
    const idat = [];
    while (off < b.length) {
        const len = b.readUInt32BE(off);
        const type = b.toString('ascii', off + 4, off + 8);
        const data = b.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0); h = data.readUInt32BE(4);
            bitDepth = data[8]; colorType = data[9];
        }
        if (type === 'PLTE') plte = data;
        if (type === 'tRNS') trns = data;
        if (type === 'IDAT') idat.push(data);
        off += 12 + len;
    }
    if (bitDepth !== 8) throw new Error(`pngLoad: bitDepth ${bitDepth} не поддержан`);
    const raw = inflateSync(Buffer.concat(idat));
    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    const stride = w * bpp;
    // реконструкция фильтров (RFC 2083): 0 none, 1 Sub, 2 Up, 3 Average, 4 Paeth
    const out = Buffer.alloc(stride * h);
    const paeth = (a, bb, c) => {
        const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
        return (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
    };
    for (let y = 0; y < h; y++) {
        const ft = raw[y * (stride + 1)];
        const src = y * (stride + 1) + 1;
        for (let i = 0; i < stride; i++) {
            const x = raw[src + i];
            const left = i >= bpp ? out[y * stride + i - bpp] : 0;
            const up = y > 0 ? out[(y - 1) * stride + i] : 0;
            const ul = (y > 0 && i >= bpp) ? out[(y - 1) * stride + i - bpp] : 0;
            let v;
            if (ft === 0) v = x;
            else if (ft === 1) v = x + left;
            else if (ft === 2) v = x + up;
            else if (ft === 3) v = x + ((left + up) >> 1);
            else v = x + paeth(left, up, ul);
            out[y * stride + i] = v & 0xff;
        }
    }
    if (colorType === 3) {
        const at = (x, y) => {
            const pi = out[y * stride + x];
            const r = plte[pi * 3], g = plte[pi * 3 + 1], bl = plte[pi * 3 + 2];
            const a = trns && pi < trns.length ? trns[pi] : 255;
            return [r, g, bl, a];
        };
        return { w, h, at };
    }
    if (colorType === 6) {
        const at = (x, y) => {
            const o = y * stride + x * 4;
            return [out[o], out[o + 1], out[o + 2], out[o + 3]];
        };
        return { w, h, at };
    }
    throw new Error(`pngLoad: colorType ${colorType} не поддержан`);
}

console.log('— 1. Дорожки к дверям ВСЕХ домов (приказ 5) —');
const { buildMap, MAP_W, MAP_H, isRoadChar, SOLID } = await import(join(ROOT, 'game/src/data/world.js').replace(/^file:\/\//, ''));
const { BUILDINGS, VILLAGE_GATE } = await import(join(ROOT, 'game/src/data/interiors.js').replace(/^file:\/\//, ''));
const grid = buildMap();
ok(BUILDINGS.length === 18, `в деревне 18 зданий (фактически ${BUILDINGS.length})`);
let doorsOk = 0;
const doorProblems = [];
for (const b of BUILDINGS) {
    const doorX = b.col + Math.floor(b.w / 2);
    const doorY = b.row + b.h - 1;
    if (grid[doorY][doorX] !== 'D') { doorProblems.push(`${b.interiorId}: дверь не 'D'`); continue; }
    let y = doorY + 1, connected = false;
    while (y < MAP_H) {
        const t = grid[y][doorX];
        if (isRoadChar(t)) { connected = true; break; }
        if (t !== 'S' && t !== '.') break;
        y++;
    }
    if (connected) doorsOk++; else doorProblems.push(`${b.interiorId}: дорожка не доходит до улицы`);
}
ok(doorsOk === BUILDINGS.length, `все ${BUILDINGS.length} дверей соединены дорожкой с улицей${doorProblems.length ? ' — ' + doorProblems.join('; ') : ''}`);
// БФС-достижимость от точки старта игрока
{
    const passable = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !SOLID.has(grid[y][x]);
    const seen = new Set(['12,5']);
    const q = [[12, 5]];
    while (q.length) {
        const [x, y] = q.shift();
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
            if (!seen.has(k) && passable(nx, ny)) { seen.add(k); q.push([nx, ny]); }
        });
    }
    const unreachable = BUILDINGS.filter(b => {
        const doorX = b.col + Math.floor(b.w / 2), doorY = b.row + b.h - 1;
        return !seen.has(`${doorX},${doorY}`);
    });
    ok(unreachable.length === 0, `БФС: все двери достижимы от точки старта${unreachable.length ? ' — ' + unreachable.map(u => u.interiorId).join(',') : ''}`);
    ok(seen.has(`${MAP_W - 1},${VILLAGE_GATE.row}`), 'ворота на востоке достижимы');
}

console.log('— 2. Частокол: нормальный деревянный частокол (приказ 6) —');
{
    const pal = pngLoad(join(ROOT, 'game/assets/tiles/palisade_0.png'));
    ok(pal.w === 32 && pal.h === 32, `тайл 32×32 (фактически ${pal.w}×${pal.h})`);
    // непрерывная стена у основания: оба бревна на всю ширину тайла, без просветов
    let groundGaps = 0;
    for (let y = 27; y < 31; y++) for (let x = 0; x < 32; x++) if (pal.at(x, y)[3] < 200) groundGaps++;
    ok(groundGaps === 0, `основание сплошное (просветов ${groundGaps} — у прежнего тайла были «бочки» с травой)`);
    // остриё ВНУТРИ тайла: на y=2 есть и острия, и просветы между ними
    let tipOpaque = 0;
    for (let x = 0; x < 32; x++) if (pal.at(x, 2)[3] > 200) tipOpaque++;
    ok(tipOpaque > 0 && tipOpaque < 22, `острия присутствуют и не срезаны (непрозрачных на y=2: ${tipOpaque})`);
    // горизонтальная обвязка — сплошная полоса на y=21..25
    let beamGaps = 0;
    for (let x = 0; x < 32; x++) if (pal.at(x, 23)[3] < 200) beamGaps++;
    ok(beamGaps === 0, `обвязка (лежень) сплошная поперёк брёвен (дыр ${beamGaps})`);
    // мировой код по-прежнему рисует 'L' тайлом частокола
    ok(read('game/src/data/world.js').includes("case 'L': return 'tile_palisade'"), "тайл 'L' остаётся частоколом");
    ok(read('game/src/scenes/BootScene.js').includes("assets/tiles/palisade_0.png"), 'palisade_0 загружается BootScene');
}

console.log('— 3. Новая модель вора в бою (приказ 7) —');
{
    const boot = read('game/src/scenes/BootScene.js');
    ok(boot.includes("thiefm: ['idle', 'attack1']") && boot.includes("thieff: ['idle', 'attack1']"),
        'BATTLE_LOOK_SHEETS содержит thiefm/thieff');
    for (const f of ['battle_thiefm_idle.png', 'battle_thiefm_attack1.png',
                     'battle_thieff_idle.png', 'battle_thieff_attack1.png']) {
        const p = join(ROOT, 'game/assets/sprites/battle', f);
        ok(existsSync(p), `${f} на месте`);
        if (!existsSync(p)) continue;
        const buf = readFileSync(p);
        ok(buf.readUInt32BE(16) === 384 && buf.readUInt32BE(20) === 128, `${f}: 384×128`);
        ok(buf[25] === 3, `${f}: палитровый (color type 3)`);
    }
    const combat = read('game/src/scenes/CombatScene.js');
    ok(combat.includes("'enemy_thief_m') ? 'thiefm'"), 'CombatScene: вор-мужчина → листы thiefm');
    ok(combat.includes("'enemy_thief_f') ? 'thieff'"), 'CombatScene: воровка → листы thieff');
    ok(combat.includes('battle_${thiefLook}_idle') || combat.includes('`battle_${thiefLook}_idle`'),
        'CombatScene: стойка вора из новых листов');
    ok(combat.includes('battle_${rec.combatant.battleLookKey}_attack1'),
        'CombatScene: атака вора — выпад кинжалом');
    ok(combat.includes('groundY = height * 0.55'), 'вор на одной линии ног с героем (y=0.55h)');
}

console.log('— 4. Герой лицом к вору (приказ 4) —');
{
    const combat = read('game/src/scenes/CombatScene.js');
    const flipIdx = combat.indexOf('this.playerSprite.setFlipX(true)');
    const usesIdx = combat.indexOf('if (this.usesBattleLook) {');
    ok(flipIdx > 0, 'CombatScene: флип героя включён');
    ok(usesIdx > 0 && flipIdx > usesIdx && flipIdx - usesIdx < 600, 'флип стоит в ветке MVsv-облика (рыцарь-fallback не тронут)');
}

console.log('— 5. Пересъёмка скриншотов (приказы 2+3) —');
{
    const sd = read('game/src/tools/ScreenshotDirector.js');
    ok(sd.includes('__shotReady'), 'ScreenshotDirector: флаг готовности кадра __shotReady');
    ok(sd.includes('__shotError'), 'ScreenshotDirector: флаг ошибки съёмки');
    ok(/menu: async \(\) => \{ await waitScene\('Title', 20000\); await sleep\(2000\)/.test(sd),
        'кадр меню: ожидание оседания Титула 2 c (не полоса загрузки)');
    ok(sd.includes('tutorialStep = 3'), 'туториал глушится для кадров (подсказки не попадают в кадр)');
    ok(sd.includes('__shotsNoTyping = true'), 'тайпрайтер отключается в съёмочных сессиях');
    ok(read('game/src/utils/ui.js').includes('!!opts.typing && !window.__shotsNoTyping'),
        'ui.js: тайпрайтер уважает флаг съёмки (в обычной игре без изменений)');
    const shots = ['01-title', '02-character-select', '03-character-custom', '04-village',
                   '05-map', '06-elder-interior', '07-priest-dialogue', '08-combat', '09-thief-encounter'];
    for (const s of shots) {
        const p = join(ROOT, 'assets/screenshots', s + '.webp');
        ok(existsSync(p) && statSync(p).size > 5000, `${s}.webp на месте (>5 КБ)`);
    }
}

console.log('— 6. SW v93 / game-assets-v44 —');
{
    const sw = read('sw.js');
    const swlog = read('docs/SW_CHANGELOG.md'); // 66.47: журнал переехал
    ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v121';"), 'SW: site-cache v121 (актуализация 66.87)');
    ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'SW: game-assets-v45 (новые листы вора + тайл частокола)');
    ok(swlog.includes('итерация 66.43'), 'SW-журнал: запись 66.43 есть');
}

console.log(`\ntest_round99: ${pass} зелёных, ${fail} красных`);
if (fail) { console.log('ПРОВАЛЫ:', fails); process.exit(1); }

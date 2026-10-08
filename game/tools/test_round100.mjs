// Тест-раунд 100 — патч 66.44 (14 приказов владельца).
// Проверки: новые тайлы дорожек, фоны боя (ассеты+маппинг), снятая церковь
// из предзагрузки, окно диалога ×2, уникальные облики 8 героев, глубина
// героя поверх домов/деревьев, новая модель вора, кнопки боя, портрет
// воровки, SW v94/v39.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');          // game/
const REPO = path.resolve(ROOT, '..');               // репозиторий

let passed = 0, failed = 0;
const ok = (cond, name) => {
    if (cond) { passed++; }
    else { failed++; console.error(`  ✗ ${name}`); }
};

// ---------- декодер PNG с полной реконструкцией фильтров (урок r99) ----------
const zlib = require('node:zlib');
function decodePNG(buf) {
    let pos = 8;
    let w = 0, h = 0, bitDepth = 0, colorType = 0;
    const idat = [];
    let plte = null, trns = null;
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0); h = data.readUInt32BE(4);
            bitDepth = data[8]; colorType = data[9];
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'PLTE') plte = data;
        else if (type === 'tRNS') trns = data;
        pos += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    const bpp = Math.max(1, Math.floor(channels * bitDepth / 8));
    const stride = Math.ceil(w * channels * bitDepth / 8);
    const out = Buffer.alloc(h * stride);
    const prevRow = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)];
        const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const cur = out.subarray(y * stride, (y + 1) * stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? cur[i - bpp] : 0;
            const b = prevRow[i];
            const c = i >= bpp ? prevRow[i - bpp] : 0;
            let v = row[i];
            if (f === 1) v = (v + a) & 0xff;
            else if (f === 2) v = (v + b) & 0xff;
            else if (f === 3) v = (v + ((a + b) >> 1)) & 0xff;
            else if (f === 4) {
                const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
            }
            cur[i] = v;
        }
        prevRow.set(cur);
    }
    return { w, h, bitDepth, colorType, stride, data: out, plte, trns };
}
function alphaAt(png, x, y) {
    const { colorType, stride, data, bitDepth, trns } = png;
    const idx = y * stride + x * { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    if (colorType === 6) return data[idx + 3];
    if (colorType === 4) return data[idx + 1];
    if (colorType === 3) {
        if (!trns) return 255;
        const pi = data[idx];
        return pi < trns.length ? trns[pi] : 255;
    }
    return 255;
}
function rgbAt(png, x, y) {
    const { colorType, stride, data } = png;
    const idx = y * stride + x * { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    if (colorType === 2) return [data[idx], data[idx + 1], data[idx + 2]];
    if (colorType === 6) return [data[idx], data[idx + 1], data[idx + 2]];
    if (colorType === 3) {
        const pi = data[idx];
        return [png.plte[pi * 3], png.plte[pi * 3 + 1], png.plte[pi * 3 + 2]];
    }
    return [data[idx], data[idx], data[idx]];
}

const A = (p) => readFileSync(path.join(REPO, p));
// =========================================================================
console.log('r100: патч 66.44 — 14 приказов');

// ---- 1) НОВЫЕ ТАЙЛЫ ДОРОЖЕК ----
{
    const tiles = ['path_0', 'path_1', 'path_2', 'path_3'].map(n => {
        const png = decodePNG(A(`game/assets/tiles/${n}.png`));
        return { n, png };
    });
    for (const { n, png } of tiles) {
        ok(png.w === 32 && png.h === 32, `1: ${n} — 32×32`);
        ok(png.colorType === 3, `1: ${n} — палитровый (P)`);
        // непрозрачных пикселей достаточно (лента, а не точка)
        let opaque = 0;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (alphaAt(png, x, y) > 128) opaque++;
        ok(opaque > 200, `1: ${n} — лента нарисована (${opaque}px)`);
    }
    // path_0 (горизонталь): открытые края слева/справа — у x=0 и x=31 есть песок в центре
    const h = tiles[0].png;
    ok(alphaAt(h, 0, 16) > 128 && alphaAt(h, 31, 16) > 128, '1: path_0 стыкуется по горизонтали');
    ok(alphaAt(h, 16, 1) < 128 && alphaAt(h, 16, 30) < 128, '1: path_0 сверху/снизу — трава');
    // path_1 (вертикаль): наоборот
    const v = tiles[1].png;
    ok(alphaAt(v, 16, 0) > 128 && alphaAt(v, 16, 31) > 128, '1: path_1 стыкуется по вертикали');
    ok(alphaAt(v, 1, 16) < 128 && alphaAt(v, 30, 16) < 128, '1: path_1 слева/справа — трава');
    // path_2 (угол ↑←): открыты top (x≈16) и left (y≈16)
    const c = tiles[2].png;
    ok(alphaAt(c, 16, 0) > 128, '1: path_2 открыт сверху');
    ok(alphaAt(c, 0, 16) > 128, '1: path_2 открыт слева');
    ok(alphaAt(c, 31, 31) < 128, '1: path_2 закрытый угол (низ-право) — трава');
    // path_3 (крест): открыты все 4 стороны
    const x3 = tiles[3].png;
    ok(alphaAt(x3, 16, 0) > 128 && alphaAt(x3, 16, 31) > 128
        && alphaAt(x3, 0, 16) > 128 && alphaAt(x3, 31, 16) > 128, '1: path_3 крест — все стороны открыты');
}

// ---- 2) ФОНЫ БОЯ ----
{
    const groups = ['forest', 'field', 'lake', 'river', 'pogost', 'mill', 'apiary', 'road', 'interior'];
    for (const g of groups) {
        const p = `game/assets/sprites/battle/battle_bg_${g}.webp`;
        ok(existsSync(path.join(REPO, p)), `2: ${p} существует`);
        const sz = statSync(path.join(REPO, p)).size;
        ok(sz > 4000 && sz < 120000, `2: ${p} разумный вес (${sz}B)`);
    }
    // BootScene грузит все 9
    const boot = readFileSync(path.join(REPO, 'game/src/scenes/BootScene.js'), 'utf8');
    ok(boot.includes("'forest', 'field', 'lake', 'river', 'pogost', 'mill', 'apiary', 'road', 'interior'"),
        '2: BootScene — 9 фонов в предзагрузке');
    // CombatScene: группа по локации
    const cs = readFileSync(path.join(REPO, 'game/src/scenes/CombatScene.js'), 'utf8');
    ok(cs.includes('combatBackgroundGroup()'), '2: CombatScene — combatBackgroundGroup есть');
    ok(cs.includes("return 'interior'") && cs.includes("return 'forest'")
        && cs.includes("return 'road'") && cs.includes("return 'lake'"), '2: CombatScene — маппинг групп');
    ok(cs.includes('battle_bg_'), '2: CombatScene — текстура battle_bg_* используется');
    // LocationScene передаёт fromLocation в засаде
    const ls = readFileSync(path.join(REPO, 'game/src/scenes/LocationScene.js'), 'utf8');
    ok(/enemyKeys: \['bandit'\], fromScene: 'Location', fromLocation: this\.locationId/.test(ls),
        '2: LocationScene — засада передаёт fromLocation');
}

// ---- 3) ЦЕРКОВЬ: фон снят, предметы добавлены ----
{
    ok(!existsSync(path.join(REPO, 'game/assets/interiors/int_bg_church.webp')),
        '3: int_bg_church.webp удалён с диска');
    const boot = readFileSync(path.join(REPO, 'game/src/scenes/BootScene.js'), 'utf8');
    ok(!/interiorBgIds = \[[^\]]*'church'/.test(boot), '3: church снят с предзагрузки');
    const ints = readFileSync(path.join(REPO, 'game/src/scenes/InteriorScene.js'), 'utf8');
    ok(ints.includes('drawChurchCandleStand'), '3: подсвечники — drawChurchCandleStand');
    ok(ints.includes('ЦЕРКОВНЫЕ ПРЕДМЕТЫ'), '3: ветка церковных предметов есть');
    ok(/int_deco_bench'\)\)\s*\{[^}]*0\.16, 0\.70/.test(ints.replace(/\n/g, ' ').replace(/\s+/g, ' ')),
        '3: лавки для прихожан добавлены');
}

// ---- 4) ОКНО ДИАЛОГА ×2 ----
{
    const st = readFileSync(path.join(REPO, 'game/src/config/StyleConfig.js'), 'utf8');
    ok(/width: 880/.test(st), '4: DIALOG_STYLES.width = 880 (×2 от 440)');
    ok(/fontMax: 28/.test(st), '4: кегль поднят до 28');
    const ui = readFileSync(path.join(REPO, 'game/src/utils/ui.js'), 'utf8');
    ok(/portraitKey \? 1120 : DIALOG_STYLES\.width/.test(ui), '4: диалог с портретом — 1120');
    ok(/Math\.min\(1160, Math\.max\(240, cam\.width - 24\)\)/.test(ui), '4: потолок расширения 1160');
}

// ---- 5) УНИКАЛЬНЫЕ ОБЛИКИ 8 ГЕРОЕВ ----
{
    const wl = readFileSync(path.join(REPO, 'game/src/systems/WorldLook.js'), 'utf8');
    ok(wl.includes('HERO_WORLD_LOOKS'), '5: HERO_WORLD_LOOKS объявлен');
    // 8 пресетов, у каждого слои уникальны
    const m = wl.match(/export const HERO_WORLD_LOOKS = \{([\s\S]*?)\n\};/);
    ok(!!m, '5: HERO_WORLD_LOOKS парсится');
    if (m) {
        const ids = [...m[1].matchAll(/^\s{4}(ranger_m|warrior_m|detective_m|adventurer_m|ranger_f|warrior_f|detective_f|adventurer_f):/gm)].map(x => x[1]);
        ok(ids.length === 8, `5: 8 пресетов (найдено ${ids.length})`);
        const layerSets = [...m[1].matchAll(/layers: \[([^\]]+)\]/g)].map(x =>
            x[1].replace(/['" ]/g, ''));
        ok(new Set(layerSets).size === 8, '5: все 8 сборок РАЗЛИЧНЫ');
        ok(layerSets.every(s => s.startsWith('world_')), '5: слои — мировые листы');
    }
    ok(wl.includes('rollHeroWorldLook'), '5: rollHeroWorldLook есть');
    // composeWorldPlayerTexture принимает layers
    ok(/composeWorldPlayerTexture\(scene, gender, layers = null\)/.test(wl),
        '5: composeWorldPlayerTexture принимает layers');
    // преген несёт presetId
    const chr = readFileSync(path.join(REPO, 'game/src/systems/Character.js'), 'utf8');
    ok(chr.includes('presetId: preset.id'), '5: createPresetHero пишет presetId');
    ok(chr.includes('chr.presetId = opts.presetId || null'), '5: createCharacter хранит presetId');
    const css = readFileSync(path.join(REPO, 'game/src/scenes/CharacterSelectionScene.js'), 'utf8');
    ok(css.includes('HERO_WORLD_LOOKS') && css.includes('rollHeroWorldLook'),
        '5: CharacterSelectionScene использует уникальные облики');
}

// ---- 6) ГЛУБИНА: герой и НПЦ поверх домов/деревьев ----
{
    const vs = readFileSync(path.join(REPO, 'game/src/scenes/VillageScene.js'), 'utf8');
    ok(vs.includes('playerObj.y / ts + 20'), '6: игрок +20 в create');
    ok(vs.includes('playerObj.y / this.tileSize + 20'), '6: игрок +20 в update');
    ok(vs.includes('y / ts + 20.3'), '6: НПЦ +20.3');
    ok(vs.includes('y / ts + 20.5'), '6: подписи НПЦ +20.5');
    ok(vs.includes('treeNearHouse'), '6/5: treeNearHouse есть');
    // дома: максимальная глубина < 20 (буст гарантированно выше)
    ok(vs.includes('bottomRow - 0.55'), '6: глубина домов не тронута (Y-сортировка сцены)');
}

// ---- 7) НОВАЯ МОДЕЛЬ ВОРА В БОЮ ----
{
    for (const key of ['battle_thiefm_idle', 'battle_thiefm_attack1', 'battle_thieff_idle', 'battle_thieff_attack1']) {
        const png = decodePNG(A(`game/assets/sprites/battle/${key}.png`));
        ok(png.w === 384 && png.h === 128, `7: ${key} — 384×128`);
        ok(png.colorType === 3, `7: ${key} — палитровый`);
        // каждый из 4 кадров >700px альфы (регресс r98) и фигура с «телом»
        for (let f = 0; f < 4; f++) {
            let a = 0;
            const x0 = f * 96;
            for (let y = 0; y < 128; y++) for (let x = x0; x < x0 + 96; x++) if (alphaAt(png, x, y) > 96) a++;
            ok(a > 700, `7: ${key}[${f}] — фигура полная (${a}px)`);
        }
        // ноги у нижнего края контента 96×96 (строки 84..96; кадры в верхней
        // трети ячейки 96×128 — геометрия 66.43)
        let feet = 0;
        for (let y = 84; y < 96; y++) for (let x = 0; x < 384; x++) if (alphaAt(png, x, y) > 96) feet++;
        ok(feet > 20, `7: ${key} — ноги у нижнего края контента (${feet}px)`);
    }
    // воровка — сливовый оттенок: в листе есть пиксель с R>B нет, у сливовой B≈R
    {
        const png = decodePNG(A('game/assets/sprites/battle/battle_thieff_idle.png'));
        let plum = 0;
        for (let y = 0; y < 128; y += 2) for (let x = 0; x < 384; x += 2) {
            const [r, g, b] = rgbAt(png, x, y);
            if (r > 60 && b > 55 && r > g + 8 && Math.abs(r - b) < 40) plum++;
        }
        ok(plum > 30, `7: воровка — сливовые тона (${plum}px)`);
    }
}

// ---- 8) ПАНЕЛЬ БОЯ без «Трава»/«Исследование» ----
{
    const cs = readFileSync(path.join(REPO, 'game/src/scenes/CombatScene.js'), 'utf8');
    ok(!cs.includes("t('Трава')"), '8: кнопка «Трава» снята');
    ok(!cs.includes("t('👁 Исследование')"), '8: кнопка «Исследование» снята');
    ok(!cs.includes('useHerb') || cs.includes('методы useHerb/examineEnemy сняты'),
        '8: useHerb удалён (или только в комментарии)');
    ok(!/useHerb\(\)\s*\{/.test(cs), '8: метод useHerb удалён');
    ok(!/examineEnemy\(\)\s*\{/.test(cs), '8: метод examineEnemy удалён');
    ok(cs.includes("t('Уклон')") && cs.includes("t('🎒 Смена оружия')") && cs.includes("t('🏃 Бежать')"),
        '8: атака/уклон/смена/бежать на месте');
    ok(!cs.includes('трава, побег'), '8: справка F1 без травы');
    ok(!cs.includes('👁'), '8: иконка исследования с панели снята');
}

// ---- 9) ПОРТРЕТ ВОРОВКИ без свечи ----
{
    // webp не декодируем (VP8) — проверяем что инструмент есть и файл свежий,
    // а также — маркер в имени файла-инструмента
    ok(existsSync(path.join(REPO, 'game/tools/portrait_thief_f_6644.py')),
        '9: tools/portrait_thief_f_6644.py в репо');
    const tool = readFileSync(path.join(REPO, 'game/tools/portrait_thief_f_6644.py'), 'utf8');
    ok(tool.includes('CX0, CY0, CX1, CY1 = 820, 548, 1024, 1024'), '9: зона свечи описана');
    const sz = statSync(path.join(REPO, 'game/assets/sprites/portraits/portrait_thief_f.webp')).size;
    ok(sz > 40000 && sz < 900000, `9: портрет в разумном весе (${sz}B)`);
}

// ---- 10) SW-версии ----
{
    const sw = readFileSync(path.join(REPO, 'sw.js'), 'utf8');
    const swlog = readFileSync(path.join(REPO, 'docs', 'SW_CHANGELOG.md'), 'utf8'); // 66.47: журнал переехал
    ok(sw.includes("CACHE_NAME = 'chronicles-ruthenia-v125'"), '10: site-cache v125 (актуализация 66.92)');
    ok(sw.includes("GAME_ASSETS_CACHE = 'game-assets-v45'"), '10: game-assets v39→v45 (актуализация 66.87)');
    ok(swlog.includes('итерация 66.44'), '10: журнал версий дополнен');
}

console.log(`\nr100: ${passed} ok, ${failed} fail`);
process.exit(failed ? 1 : 0);

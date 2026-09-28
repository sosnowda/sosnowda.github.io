// test_round97.mjs — ПАТЧ 66.41 (приказы владельца):
//   1) КАРТА: Лесная поляна — КРУГ ПО ЦЕНТРУ ЛЕСА (TERRAIN.forestGlade
//      513,225 r46 = геометрический центр леса; клик-зона shape 'circle';
//      полоса 460..666 вне круга — Густой лес; тропа цепочки сквозь поляну;
//      подпись «Лесная поляна» в центре круга — клик по подписи = поляна);
//   2) ЧИСТКА РЕПО (приказ 12): ScoreManager.js / game/public/ /
//      assets/video/intro.* / icons.svg / _config.yml / effects/fire_1..3 /
//      старые QA-кадры game/docs — удалены; MD-отчёты game/docs сохранены;
//   3) ЛЕНДИНГ: preload первого скриншота (01-title.webp, fetchpriority=low)
//      в RU и EN; alt-тексты карты про круглую поляну; OG — абсолютные URL;
//   4) СЕЙВЫ (приказ «СЕЙВЫ НЕ НУЖНЫ»): SaveManager — заглушка без записи,
//      писателя gameScoreData больше нет в game/src;
//   5) ИСТОРИЧЕСКИЕ КОНВЕЙЕРЫ: 10 make_*/repair_* помечены маркером,
//      актуальные (6640/6638/6636/6635/6637/6633/6639/6624) — БЕЗ маркера;
//   6) SW v92 / game-assets-v37; аудио — lazy-cache (нет precache-списка).
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const game = join(__dirname, '..');
const root = join(game, '..');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
    if (cond) { pass++; }
    else { fail++; fails.push(msg); console.log('  RED: ' + msg); }
}
function read(p) { return readFileSync(join(root, p), 'utf8'); }

console.log('— 1. Карта: круглая поляна по центру леса —');
const tmap = read('game/src/systems/TerrainMap.js');
ok(/forestGlade: \{ x: 513, y: 225, r: 46 \}/.test(tmap), 'TERRAIN.forestGlade — круг (513,225, r46)');
ok(/forestGladeX: 513/.test(tmap), 'forestGladeX = 513 (центр леса по X)');
// геометрический центр леса (360..666 × 14..436) ≈ (513, 225)
const fcx = (360 + 666) / 2, fcy = (14 + 436) / 2;
ok(Math.abs(fcx - 513) <= 1 && Math.abs(fcy - 225) <= 1, 'центр круга = геометрический центр леса');

console.log('— 2. Клик-зоны и приоритет —');
const t = read('game/src/systems/TerrainMap.js');
const zoneGlade = /id: 'forest_glade', shape: 'circle',\s*x: 513, y: 225, r: 46/.test(t);
ok(zoneGlade, "зона 'forest_glade' — shape 'circle' (сам круг)");
ok(/id: 'forest',\s+shape: 'rect',\s+x: 460, y: 14,\s+w: 206, h: 416/.test(t.replace(/\n\s+/g, ' ').replace(/  +/g, ' ')) ||
   /id: 'forest',\s*shape: 'rect',\s*x: 460,\s*y: 14,\s*w: 206,\s*h: 416/.test(t.replace(/\n\s+/g, ' ')),
   "зона 'forest' (чаща) покрывает полосу 460..666 вне круга");
const gi = t.indexOf("id: 'forest_glade'"), fi = t.indexOf("id: 'forest',");
ok(gi > -1 && fi > -1 && gi < fi, 'приоритет: зона поляны стоит ПЕРЕД зоной чащи');

console.log('— 3. zoneAt: живая проверка попаданий —');
const { TERRAIN, TERRAIN_ZONES, TERRAIN_LABELS, TERRAIN_PATHS, zoneAt } =
    await import('../src/systems/TerrainMap.js');
ok(zoneAt(513, 225).id === 'forest_glade', 'центр круга → поляна');
ok(zoneAt(500, 230).id === 'forest_glade', 'точка r90 (500,230) → по-прежнему поляна');
ok(zoneAt(513, 270).id === 'forest_glade', 'низ круга (513,270) → поляна');
ok(zoneAt(506, 60).id === 'forest', 'полоса НАД кругом (506,60) → чаща (вне круга)');
ok(zoneAt(520, 340).id === 'forest', 'полоса ПОД кругом (520,340) → чаща');
ok(zoneAt(400, 150).id === 'forest_edge', 'опушка не тронута');
ok(zoneAt(630, 300).id === 'forest', 'правый край — чаща (r83 цел)');
const lblGlade = TERRAIN_LABELS.find(l => l.key === 'forestGlade');
ok(lblGlade && lblGlade.x === 513 && lblGlade.y === 226, 'подпись «Лесная поляна» в центре круга');
ok(zoneAt(lblGlade.x, lblGlade.y).id === 'forest_glade', 'клик по подписи = зона поляны');

console.log('— 4. Тропа цепочки сквозь круглую поляну —');
const chain = TERRAIN_PATHS.filter(p => p.forestChain);
ok(chain.length === 3, 'цепочка из трёх звеньев сохранена (r83 цел)');
const g = TERRAIN.forestGlade;
const inside = (pt) => (pt[0] - g.x) ** 2 + (pt[1] - g.y) ** 2 <= g.r * g.r;
const gladeEnd = chain.find(p => p.to === 'forest_glade').pts.slice(-1)[0];
const forestStart = chain.find(p => p.to === 'forest').pts[0];
ok(inside(gladeEnd), 'тропа к поляне ЗАКАНЧИВАЕТСЯ внутри круга');
ok(inside(forestStart), 'тропа к чаще НАЧИНАЕТСЯ внутри круга (сквозь поляну)');
ok(gladeEnd[0] === forestStart[0] && gladeEnd[1] === forestStart[1], 'звенья цепочки стыкуются в круге');
const deepEnd = chain.find(p => p.to === 'forest').pts.slice(-1)[0];
ok(deepEnd[0] === TERRAIN.forestPathEnd.x && deepEnd[1] === TERRAIN.forestPathEnd.y,
    'конец тропы — прежний forestPathEnd (600,228)');

console.log('— 5. drawTerrainMap: круглые поляны в коде —');
ok(!/ellipse\(glade\.x, glade\.y - 62/.test(tmap), 'прежняя полоса (две дуги) удалена');
ok(/arc\(glade\.x, glade\.y, glade\.r \+ 7/.test(tmap), 'светлый ореол вокруг круга');
ok(/arc\(glade\.x, glade\.y, glade\.r, 0, Math\.PI \* 2\)/.test(tmap), 'поляна рисуется КРУГОМ');
ok(/drawTree\(ctx, glade\.x - 13, glade\.y - 21, 7\.5/.test(tmap), 'старый дуб внутри круга');
// мок-контекст: рендер без ошибок
const calls = [];
const mockCtx = new Proxy({}, {
    get: (t2, prop) => (prop === 'canvas' ? { width: 680, height: 540 } : (...a) => { calls.push(String(prop)); return mockCtx; }),
    set: () => true,
});
const { drawTerrainMap } = await import('../src/systems/TerrainMap.js');
let drew = false;
try { drawTerrainMap(mockCtx); drew = true; } catch (e) { console.log('  ERR:', String(e).slice(0, 120)); }
ok(drew && calls.includes('arc'), 'drawTerrainMap выполняется на мок-контексте (arc вызван)');

console.log('— 6. Чистка репо (приказ 12) —');
ok(!existsSync(join(root, 'game/src/systems/ScoreManager.js')), 'ScoreManager.js удалён (не использовался)');
ok(!existsSync(join(root, 'game/public')), 'game/public/ удалён (шаблонные остатки Phaser)');
ok(!existsSync(join(root, 'assets/video/intro.mp4')) && !existsSync(join(root, 'assets/video/intro.webm')),
    'assets/video/intro.* удалены (нигде не упоминались)');
ok(!existsSync(join(root, 'icons.svg')), 'icons.svg удалён (не упоминался)');
ok(!existsSync(join(root, '_config.yml')), '_config.yml удалён (Jekyll выключен .nojekyll)');
// fire_0..3 — кадры анимации камина (BootScene int_fire_%d) — ДОЛЖНЫ быть на диске
// (66.41: сначала были удалены сканером орфанов, живой QA поймал 404 — возвращены)
const boot = read('game/src/scenes/BootScene.js');
ok(/assets\/effects\/fire_\$\{f\}\.png/.test(boot), 'BootScene: fire-кадры грузятся динамически (int_fire)');
ok(existsSync(join(root, 'game/assets/effects/fire_0.png'))
   && existsSync(join(root, 'game/assets/effects/fire_1.png'))
   && existsSync(join(root, 'game/assets/effects/fire_2.png'))
   && existsSync(join(root, 'game/assets/effects/fire_3.png')), 'fire_0..3.png на месте (анимация камина)');
ok(existsSync(join(root, 'assets/video/promo.webp')) || existsSync(join(root, 'assets/video/promo.webm')),
    'используемое промо-видимо на месте (promo.webm/mp4)');
const docsLeft = readdirSync(join(root, 'game/docs'));
ok(docsLeft.every(f => f.endsWith('.md')), 'game/docs: остались только MD-отчёты (QA-кадры удалены)');
ok(docsLeft.some(f => f.startsWith('QA_ROUND')), 'MD-отчёты QA сохранены');

console.log('— 7. Сейвы не нужны (приказ 6) —');
const sm = read('game/src/systems/SaveManager.js');
ok(/заглушка|no-op/.test(sm) && !/setItem/.test(sm), 'SaveManager — заглушка без записи');
const allSrc = ['game/src'].flatMap((d) => {
    const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true })
        .flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
    return walk(d);
});
const scoreWriters = allSrc.filter(f => {
    if (f.endsWith('ScoreManager.js') || f.endsWith('SaveManager.js')) return false;
    return /gameScoreData/.test(read(f));
});
ok(scoreWriters.length === 0, 'писателей gameScoreData в game/src больше нет');
ok(!allSrc.some(f => f.endsWith('ScoreManager.js')), 'импортов ScoreManager нет');

console.log('— 8. Лендинг: preload + alt + OG —');
const ru = read('index.html'), en = read('en/index.html');
for (const [name, html, pre] of [['RU', ru, 'assets/screenshots/01-title.webp'], ['EN', en, '../assets/screenshots/01-title.webp']]) {
    ok(html.includes(`rel="preload" href="${pre}" as="image" fetchpriority="low"`),
        `${name}: preload первого скриншота (fetchpriority=low)`);
    ok(html.includes('rel="preload"'), `${name}: preload присутствует`);
}
ok(/05-map\.webp" alt="[^"]*КРУГЛАЯ[^"]*"/.test(ru), 'RU: alt карты про КРУГЛУЮ поляну');
ok(/05-map\.webp" alt="[^"]*ROUND[^"]*"/.test(en), 'EN: alt карты про ROUND glade');
ok(/og:image" content="https:\/\/sosnowda\.github\.io\/assets\/images\/og-image\.jpg"/.test(ru)
   && /og:image" content="https:\/\/sosnowda\.github\.io\/assets\/images\/og-image\.jpg"/.test(en),
   'OG:image — абсолютный URL в RU и EN');
ok(/twitter:image" content="https:\/\/sosnowda\.github\.io\//.test(ru), 'twitter:image — абсолютный URL');
ok(existsSync(join(root, 'assets/images/og-image.jpg')), 'файл og-image.jpg существует');
ok(!/og:image" content="\//.test(ru), 'OG:image не относительный');

console.log('— 9. Исторические конвейеры (приказ 11) —');
const historical = ['make_assets_r66.py', 'make_assets_r67.py', 'make_gate_r67.py',
    'mvsv_battle_6632.py', 'mvsv_battle_6633.py',
    'make_houses_r64.py', 'make_houses_r65.py', 'make_thief_sprite.py', 'make_trees.py',
    'make_world_6637.py', 'repair_interiors_6629.py', 'make_og_demo_r68.py'];
for (const f of historical) {
    ok(read(`game/tools/${f}`).includes('ИСТОРИЧЕСКИЙ КОНВЕЙЕР'), `${f} помечен историческим`);
}
const actual = ['make_world_6638.py', 'make_world_6640.py', 'drive_fetch_world_6638.py',
    'drive_fetch_pbkt_6640.py',
    'make_battle_alts_6639.py', 'make_battle_alts_6640.py', 'make_busts_6633.py',
    'make_busts_6639.py', 'make_busts_6640.py', 'make_houses_6636.py',
    'make_houses_repair_6635.py', 'make_chimneys_6637.py', 'update_shots_6624.py'];
for (const f of actual) {
    ok(!read(`game/tools/${f}`).includes('ИСТОРИЧЕСКИЙ КОНВЕЙЕР'), `${f} — актуальный, без маркера`);
}

console.log('— 10. SW v92 + аудио lazy-cache —');
const sw = read('sw.js');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v92';"), 'SW: site-cache v92');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v37';"), 'SW: game-assets-v37');
ok(sw.includes('66.41'), 'SW-журнал: запись 66.41 есть');
ok(!sw.includes('addAll'), 'SW: precache-списка нет (аудио кэшируется лениво по запросу)');
ok(!/\.ogg/.test(sw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')),
    'SW: в логике нет жёстких ссылок на .ogg (lazy-cache)');

console.log(`\ntest_round97: ${pass} зелёных, ${fail} красных`);
if (fail > 0) { console.log(fails.map(f => '  RED: ' + f).join('\n')); process.exit(1); }

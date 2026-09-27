// Прод-верификация 66.34 (карта местности = экран околицы + гладкие персонажи).
// Режимы: static | live | all (как verify_prod_6632.mjs).
//   static — ждёт деплой (SW v84), сверяет sha256 ключевых файлов прод=локал,
//            проверяет константы SW и кадры лендинга.
//   live   — тот же qa_map_6634 (BASE_URL=прод, OUT_DIR=/tmp/prod6634):
//            интерьер LINEAR, карта-клики, мобайл.
// Запуск: node game/tools/verify_prod_6634.mjs static|live|all
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const MODE = process.argv[2] || 'all';
const ROOT = '/home/z/my-project/sosnowda-site';
const PROD = 'https://sosnowda.github.io';
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// Сторож: песочница любит подвешивать прогоны — бьём через 240с
setTimeout(() => {
    console.log('WATCHDOG: 240с истекли — прерываю верификацию (частичный результат выше)');
    process.exit(2);
}, 240000).unref();

const t0 = Date.now();
const ts = () => `[${Math.round((Date.now() - t0) / 1000)}с]`;

let fails = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails++; };

async function fetchBuf(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} для ${url}`);
    return Buffer.from(await r.arrayBuffer());
}

// ---------- STATIC ----------
async function staticCheck() {
    console.log(`\n=== STATIC: ждём деплой SW v84 на ${PROD} ===`);
    // 1) деплой: /sw.js должен содержать v84 (поллинг до 3 минут)
    let swBuf = null, deployed = false;
    for (let i = 0; i < 18; i++) {
        try {
            swBuf = await fetchBuf(`${PROD}/sw.js`);
            if (swBuf.toString('utf8').includes("CACHE_NAME = 'chronicles-ruthenia-v84'")) { deployed = true; break; }
        } catch (e) { /* Pages может коротко отдавать 404 */ }
        console.log(`${ts()} ждём деплой (попытка ${i + 1}/18)...`);
        await new Promise(r => setTimeout(r, 10000));
    }
    ok(deployed, 'SW v84 задеплоен на прод');
    if (!deployed) return;

    // 2) константы SW
    const sw = swBuf.toString('utf8');
    ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v84';"), 'SW: site-cache v84');
    ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v29';"), 'SW: game-assets-v29 (не тронут)');
    ok(sw.includes('// v84 — итерация 66.34'), 'SW: журнал содержит запись v84');

    // 3) ключевые файлы бит-в-бит прод=локал
    const files = [
        'game/src/systems/TerrainMap.js',
        'game/src/scenes/ForkScene.js',
        'game/src/systems/SmoothSprites.js',
        'game/src/systems/CharacterAppearance.js',
        'game/src/systems/NpcLook.js',
        'game/src/scenes/BootScene.js',
        'game/index.html',
    ];
    for (const f of files) {
        const localPath = join(ROOT, f);
        if (!existsSync(localPath)) { ok(false, `${f}: нет локально`); continue; }
        const local = sha(readFileSync(localPath));
        const remote = sha(await fetchBuf(`${PROD}/${f}`));
        ok(local === remote, `${f}: sha256 прод=локал`);
    }

    // 4) скриншоты лендинга (заменённые в 66.34)
    const shots = ['assets/screenshots/05-map.webp', 'assets/screenshots/04-village.webp',
        'assets/screenshots/06-elder-interior.webp', 'assets/screenshots/08-combat.webp'];
    for (const f of shots) {
        const local = sha(readFileSync(join(ROOT, f)));
        const remote = sha(await fetchBuf(`${PROD}/${f}`));
        ok(local === remote, `${f}: sha256 прод=локал`);
    }

    // 5) лендинг ссылается на кадр карты
    const index = (await fetchBuf(`${PROD}/index.html`)).toString('utf8');
    ok(index.includes('05-map.webp'), 'лендинг: кадр 05-map на месте');
}

// ---------- LIVE ----------
async function liveCheck() {
    console.log(`\n=== LIVE: живой прогон QA 66.34 против прода ===`);
    const env = { ...process.env, BASE_URL: PROD, OUT_DIR: '/tmp/prod6634' };
    try {
        execFileSync('node', [join(ROOT, 'game/tools/qa_map_6634.mjs')], {
            env, stdio: 'inherit', timeout: 220000,
        });
        console.log('  ✓ qa_map_6634 против прода завершился без провалов');
    } catch (e) {
        fails++;
        console.log('  ✗ qa_map_6634 против прода: код выхода ' + e.status + ' (см. лог выше)');
    }
}

if (MODE === 'static' || MODE === 'all') await staticCheck();
if (MODE === 'live' || MODE === 'all') await liveCheck();

console.log(`\n=== ИТОГ ВЕРИФИКАЦИИ (${MODE}): ${fails === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : 'ПРОВАЛОВ: ' + fails} ===`);
process.exit(fails ? 1 : 0);

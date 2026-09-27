// Прод-верификация 66.32 против https://sosnowda.github.io (патч 6afdc13)
// Статика: SW v82/v28, манифест MVsv, 34 боевых листа sha256, 9 скриншотов sha256, ключевые js
// Живой прогон: игра (Preload→Title, текстуры/анимации battle_*), лендинг (таймлайн, 0 ошибок)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MODE = process.argv[2] || 'all'; // static | live | all
const t0 = Date.now();
const mark = s => console.log(`  [${((Date.now() - t0) / 1000).toFixed(0)}с] ${s}`);
const BASE = 'https://sosnowda.github.io';
const ROOT = '/home/z/my-project/sosnowda-site';
let jsErrors = 0, fails = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fails++; };
const isNoise = t => t.includes('Framebuffer') || t.includes('ERR_CERT_AUTHORITY_INVALID') || t.includes('hdrc') || t.includes('mc.yandex');
// Сторож: весь живой прогон обязан уложиться в 4 минуты
setTimeout(() => { console.log('WATCHDOG: 240с истекли, принудительный выход'); process.exit(2); }, 240000).unref();
const sha = b => createHash('sha256').update(b).digest('hex');

async function fetchBuf(url) {
    const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
}

console.log('--- СТАТИКА: деплой и SW ---');
// Деплой-маркер: MANIFEST_6632.txt появился только в 6afdc13 (ждём сборку Pages до 3 мин)
let manifest = null;
if (MODE === 'static' || MODE === 'all') {
    for (let i = 0; i < 18; i++) {
        manifest = await fetchBuf(BASE + '/game/assets/sprites/battle/MANIFEST_6632.txt');
        if (manifest) break;
        mark(`Pages ещё собирает (${(i + 1) * 10}с), ждём`);
        await sleep(10000);
    }
}
const localManifest = readFileSync(ROOT + '/game/assets/sprites/battle/MANIFEST_6632.txt');
if (MODE === 'static' || MODE === 'all') {
    ok(!!manifest, 'прод: MANIFEST_6632.txt отдаётся (деплой 6afdc13 вышел)');
    ok(manifest && manifest.equals(localManifest), 'прод: манифест бит-в-бит с локальным');
}

const swUrl = await fetchBuf(BASE + '/sw.js');
if (MODE === 'static' || MODE === 'all') {
    ok(!!swUrl && swUrl.equals(readFileSync(ROOT + '/sw.js')), 'прод: /sw.js бит-в-бит с локальным');
    ok(!!swUrl && swUrl.toString('utf8').includes("CACHE_NAME = 'chronicles-ruthenia-v82'"), 'прод: sw.js — chronicles-ruthenia-v82');
    ok(!!swUrl && swUrl.toString('utf8').includes("GAME_ASSETS_CACHE = 'game-assets-v28'"), 'прод: sw.js — game-assets-v28');
}

if (MODE === 'static' || MODE === 'all') {
console.log('--- СТАТИКА: 34 боевых листа MVsv (sha256 прод=локал) ---');
const bdir = ROOT + '/game/assets/sprites/battle';
const sheets = readdirSync(bdir).filter(f => f.endsWith('.png')).sort();
let sheetOk = 0, sheetBad = [];
for (const f of sheets) {
    const remote = await fetchBuf(`${BASE}/game/assets/sprites/battle/${f}`);
    if (remote && remote.equals(readFileSync(`${bdir}/${f}`))) sheetOk++;
    else sheetBad.push(f);
}
ok(sheetOk === sheets.length && sheetBad.length === 0,
    `прод: боевых листов совпало ${sheetOk}/${sheets.length}${sheetBad.length ? ' — БЕДЫ: ' + sheetBad.join(',') : ''}`);

console.log('--- СТАТИКА: скриншоты и ключевые файлы ---');
const shotsDir = ROOT + '/assets/screenshots';
const shots = readdirSync(shotsDir).filter(f => f.endsWith('.webp')).sort();
let shotOk = 0, shotBad = [];
for (const f of shots) {
    const remote = await fetchBuf(`${BASE}/assets/screenshots/${f}`);
    if (remote && remote.equals(readFileSync(`${shotsDir}/${f}`))) shotOk++;
    else shotBad.push(f);
}
ok(shotOk === shots.length, `прод: скриншоты лендинга совпали ${shotOk}/${shots.length}${shotBad.length ? ' — БЕДЫ: ' + shotBad.join(',') : ''}`);

for (const p of ['game/index.html', 'game/src/data/heroes.js', 'game/src/scenes/BootScene.js', 'game/src/scenes/CombatScene.js', 'index.html']) {
    const remote = await fetchBuf(`${BASE}/${p}`);
    const localPath = ROOT + '/' + p;
    ok(remote && remote.equals(readFileSync(localPath)), `прод: ${p} бит-в-бит с локальным`);
}
}

if (MODE === 'static') {
    console.log(`\nСТАТИКА 66.32: ${fails === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : 'ЕСТЬ ПРОБЛЕМЫ'} (провалов: ${fails})`);
    process.exit(fails ? 1 : 0);
}

console.log('--- ЖИВОЙ ПРОГОН: игра ---');
mark('запуск браузера');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-web-security', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { if (!isNoise(String(e))) { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); } });
page.on('console', m => { if (m.type() === 'error' && !isNoise(m.text())) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 120)); } });
await page.goto(BASE + '/game/', { waitUntil: 'load' });
mark('game/ загружен, ждём сцены');
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
mark('Phaser поднялся');
const scenesEarly = await page.evaluate(() => window.game.scene.scenes.map(s => s.scene.key));
ok(scenesEarly.includes('Preload'), 'прод: PreloadScene в менеджере сцен');
await page.waitForFunction(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 120000 });
mark('TitleScene активна');
const prog = await page.evaluate(() => window.game.registry.get('bootProgress'));
ok(prog === 1, `прод: загрузка завершена, bootProgress=${prog}`);
const tex = await page.evaluate(() => {
    const keys = window.game.textures.getTextureKeys().filter(k => k.startsWith('battle_'));
    const looks = ['baenor', 'gaerron', 'huntress', 'naia', 'paul'];
    const per = {};
    looks.forEach(l => { per[l] = keys.filter(k => k.startsWith('battle_' + l + '_')).length; });
    const anims = ['battle_baenor_attack1', 'battle_huntress_death', 'battle_paul_victory', 'battle_naia_shoot']
        .filter(k => window.game.anims.exists(k)).length;
    return { total: keys.length, per, anims4: anims };
});
ok(tex.total >= 34, `прод: текстур battle_* загружено ${tex.total} (ожидалось ≥34)`);
ok(tex.per.baenor === 7 && tex.per.gaerron === 7 && tex.per.huntress === 7 && tex.per.naia === 7 && tex.per.paul === 6,
    `прод: раскладка по обликам 7/7/7/7/6 — ${JSON.stringify(tex.per)}`);
ok(tex.anims4 === 4, `прод: анимации обликов в менеджере (4/4) — ${tex.anims4}`);
mark('текстуры/анимации battle_* проверены');
// старые фичи 66.31 не регрессировали
const btn = await page.evaluate(() => {
    const t = window.game.scene.getScene('Title');
    let found = null;
    const walk = o => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim && o.text.trim().includes('Вернуться на сайт')) found = true; };
    t.children.list.forEach(walk);
    return found;
});
ok(btn, 'прод (регресс 66.31): кнопка «Вернуться на сайт» на месте');
await page.close();

console.log('--- ЖИВОЙ ПРОГОН: лендинг ---');
const lp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
lp.on('pageerror', e => { if (!isNoise(String(e))) { jsErrors++; console.log('LP PAGEERROR:', String(e).slice(0, 160)); } });
lp.on('console', m => { if (m.type() === 'error' && !isNoise(m.text())) { jsErrors++; console.log('LP CONSOLE-ERR:', m.text().slice(0, 120)); } });
await lp.goto(BASE + '/', { waitUntil: 'load' });
await sleep(1000);
mark('лендинг загружен');
// 08-combat.webp реально грузится на лендинге (новая версия) — ограниченное ожидание, без бесконечного evaluate
await lp.evaluate(() => document.getElementById('screenshots')?.scrollIntoView({ block: 'center' })).catch(() => {});
const shot = await lp.waitForFunction(() => {
    const img = Array.from(document.querySelectorAll('img')).find(i => (i.currentSrc || i.src || '').includes('screenshots/08-combat'));
    return img && img.complete && img.naturalWidth > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : false;
}, { timeout: 20000, polling: 500 }).then(h => h.jsonValue()).catch(() => null);
ok(!!shot && shot.w === 1280 && shot.h === 720, `прод: 08-combat.webp на лендинге декодирован ${shot ? shot.w + '×' + shot.h : 'НЕ дождались'}`);
await lp.evaluate(() => document.getElementById('princesTimeline').scrollIntoView({ block: 'center' }));
await lp.click('.pt-reign-1');
await sleep(600);
const tlOk = await lp.evaluate(() => {
    const name = document.querySelector('#princesTimeline .pt-detail-name').textContent;
    const hits = Array.from(document.querySelectorAll('.chronicle-card.pt-hit')).map(c => c.dataset.year).join(',');
    return name.includes('Василий I') && hits === '1408,1410,1425';
});
ok(tlOk, 'прод (регресс 66.31): таймлайн — Василий I, подсветка 1408/1410/1425');
await lp.close();
await browser.close();

console.log(`\nПРОД-ВЕРИФИКАЦИЯ 66.32: ${fails === 0 && jsErrors === 0 ? 'ВСЁ ЗЕЛЁНОЕ' : 'ЕСТЬ ПРОБЛЕМЫ'} (JS-ошибок: ${jsErrors}, провалов: ${fails})`);
process.exit(fails || jsErrors ? 1 : 0);

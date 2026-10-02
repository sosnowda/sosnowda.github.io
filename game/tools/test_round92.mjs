// test_round92 — ПАТЧ 66.36 (приказ владельца): дома ПЕРЕСОБРАНЫ из
// восстановленных листов пака «Fantastic Buildings - Medieval» (Drive):
//   1) вырезка по полным габаритам (tools/make_houses_6636.py), чужие
//      фрагменты/тени стёрты, края листа достроены зеркалом;
//   2) церковь: шатёр со звездой — аутентичная деталь листа на колокольне;
//   3) housesFX: окна по стеклу, трубы аутентичные (у Авдея и Прасковьи
//      труб в паке нет);
//   4) поп-апы/планировка 66.35 не тронуты;
//   5) SW: game-assets-v42 (текстуры изменились), site-cache v96.
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BUILDINGS } from '../src/data/interiors.js';
import { HOUSES_FX } from '../src/data/housesFX.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = join(root, 'game');
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; } else { failed++; console.log('  ✗ FAIL: ' + msg); } };

function pngSize(p) {
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function pngPixels(p) {
    const zlib = require('zlib');
    const b = readFileSync(p);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    const bitDepth = b[24], colorType = b[25];
    assert.ok(bitDepth === 8, 'ожидается 8 бит');
    let pos = 8, idat = [];
    const pal = [], trns = [];
    while (pos < b.length) {
        const len = b.readUInt32BE(pos), type = b.toString('ascii', pos + 4, pos + 8);
        if (type === 'IDAT') idat.push(b.subarray(pos + 8, pos + 8 + len));
        if (type === 'PLTE') for (let i = 0; i < len; i += 3) pal.push([b[pos + 8 + i], b[pos + 9 + i], b[pos + 10 + i]]);
        if (type === 'tRNS') for (let i = 0; i < len; i++) trns.push(b[pos + 8 + i]);
        pos += 12 + len;
    }
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 0 ? 1 : 2;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    const out = new Uint8ClampedArray(w * h * 4);
    let prev = new Uint8ClampedArray(stride);
    for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const cur = new Uint8ClampedArray(stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? cur[i - channels] : 0;
            const c = prev[i];
            let val = line[i];
            if (filter === 1) val = (val + a) & 255;
            else if (filter === 2) val = (val + c) & 255;
            else if (filter === 3) val = (val + ((a + c) >> 1)) & 255;
            else if (filter === 4) {
                const pp = i >= channels ? prev[i - channels] : 0;
                const p = a + c - pp, pa = Math.abs(p - a), pb = Math.abs(p - c), pc = Math.abs(p - pp);
                val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? c : pp)) & 255;
            }
            cur[i] = val;
        }
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, bl = 0, al = 255;
            if (colorType === 6) { r = cur[x * 4]; g = cur[x * 4 + 1]; bl = cur[x * 4 + 2]; al = cur[x * 4 + 3]; }
            else if (colorType === 2) { r = cur[x * 3]; g = cur[x * 3 + 1]; bl = cur[x * 3 + 2]; }
            else if (colorType === 3) { const idx = cur[x]; [r, g, bl] = pal[idx] || [0, 0, 0]; al = trns[idx] ?? 255; }
            else if (colorType === 0) { r = g = bl = cur[x]; }
            const o = (y * w + x) * 4;
            out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al;
        }
        prev = cur;
    }
    return { w, h, at(x, y) { const o = (y * w + x) * 4; return [out[o], out[o + 1], out[o + 2], out[o + 3]]; } };
}
const require = (await import('module')).createRequire(import.meta.url);

// ---------- 1. Конвейер и текстуры ----------
console.log('--- 1. Конвейер 66.36 и новые текстуры ---');
ok(existsSync(join(game, 'tools/make_houses_6636.py')), 'tools/make_houses_6636.py в репо');
ok(existsSync(join(game, 'tools/fb_contact_6636.png')), 'контактный лист 66.3 6 в репо');
// Размеры 66.36 (вырезка из листов пака; церковь — со шатрём)
const SIZES = {
    fb_church: [270, 412], fb_inn: [398, 409], fb_smithy: [154, 364],
    fb_elder: [406, 303], fb_manor: [192, 224], fb_thatch_big: [342, 238],
    fb_thatch_small: [208, 205], fb_log_flowers: [220, 187], fb_log_thatch: [180, 200],
    fb_log_big: [220, 362], fb_tudor_fl: [241, 249], fb_tudor_sm: [156, 298],
};
for (const [k, [w, h]] of Object.entries(SIZES)) {
    const p = join(game, 'assets/sprites', k + '.png');
    ok(existsSync(p), `${k}.png на месте`);
    const s = pngSize(p);
    ok(s.w === w && s.h === h, `${k}: ${w}x${h} [${s.w}x${s.h}]`);
}
// у постоялого двора каменная галерея внизу: нижние 40px плотно заполнены
{
    const img = pngPixels(join(game, 'assets/sprites/fb_inn.png'));
    let dense = 0;
    for (let x = 0; x < img.w; x++) if (img.at(x, img.h - 30)[3] > 8) dense++;
    ok(dense > img.w * 0.55, `fb_inn: галерея с арками доходит до низа (px на h-30: ${dense}/${img.w})`);
}
// у малой избы каменная труба ДО кромки: раньше срезалась r65-рамкой
{
    const img = pngPixels(join(game, 'assets/sprites/fb_thatch_small.png'));
    let chim = 0;
    for (let y = 0; y < 24; y++) for (let x = img.w - 60; x < img.w; x++) if (img.at(x, y)[3] > 8) chim++;
    ok(chim > 120, `fb_thatch_small: каменная труба присутствует сверху (px в правой трети верха: ${chim})`);
}

// ---------- 2. housesFX: границы и аутентичные трубы ----------
console.log('--- 2. housesFX: окна в границах, трубы по паку ---');
for (const [k, [w, h]] of Object.entries(SIZES)) {
    const fx = HOUSES_FX[k];
    ok(!!fx, `${k}: метаданные есть`);
    if (!fx) continue;
    const winBad = (fx.windows || []).filter(([cx, cy, ww, hh]) =>
        cx - ww / 2 < -2 || cx + ww / 2 > w + 2 || cy - hh / 2 < -2 || cy + hh / 2 > h + 2);
    ok(winBad.length === 0, `${k}: окна в границах ${w}x${h}`);
    const chimBad = (fx.chimneys || []).filter(([cx, cy]) => cx < 0 || cx > w || cy < 0 || cy > h);
    ok(chimBad.length === 0, `${k}: жерла труб в границах`);
}
// 66.37: у Авдея и Прасковьи трубы ДОРИСОВАНЫ в стиле пака (жерла 144,10 и 178,34)
ok(HOUSES_FX.fb_log_thatch.chimneys.length === 1 &&
   HOUSES_FX.fb_log_thatch.chimneys[0][0] === 144 && HOUSES_FX.fb_log_thatch.chimneys[0][1] === 10 &&
   HOUSES_FX.fb_thatch_big.chimneys.length === 1 &&
   HOUSES_FX.fb_thatch_big.chimneys[0][0] === 178 && HOUSES_FX.fb_thatch_big.chimneys[0][1] === 34,
    'у Авдея и Прасковьи дорисованные трубы в стиле пака (66.37)');
ok(HOUSES_FX.fb_church.chimneys.length === 0, 'у церкви трубы нет');
ok(HOUSES_FX.fb_elder.chimneys.length === 2 && HOUSES_FX.fb_inn.chimneys.length === 1 &&
   HOUSES_FX.fb_smithy.chimneys.length === 1 && HOUSES_FX.fb_manor.chimneys.length === 1 &&
   HOUSES_FX.fb_log_big.chimneys.length === 1 && HOUSES_FX.fb_log_flowers.chimneys.length === 2 &&
   HOUSES_FX.fb_thatch_small.chimneys.length === 1 && HOUSES_FX.fb_tudor_fl.chimneys.length === 1 &&
   HOUSES_FX.fb_tudor_sm.chimneys.length === 1,
   'трубы: староста×2, двор/кузница/марфа/пахарь/рыбак/дровосек/знахарка×1, гончар×2 (66.42)');

// ---------- 3. Жерла труб — на камнях/дереве трубы, не в воздухе ----------
console.log('--- 3. Жерла труб сидят на текстуре трубы ---');
{
    // вокруг жерла (±6px, чуть ниже) должен быть непрозрачный контент
    for (const [k, [w, h]] of Object.entries(SIZES)) {
        const fx = HOUSES_FX[k];
        if (!fx || !fx.chimneys.length) continue;
        const img = pngPixels(join(game, 'assets/sprites', k + '.png'));
        for (const [cx, cy] of fx.chimneys) {
            let solid = 0, total = 0;
            for (let dy = 4; dy <= 10; dy++) for (let dx = -5; dx <= 5; dx++) {
                const x = cx + dx, y = cy + dy;
                if (x < 0 || y < 0 || x >= w || y >= h) continue;
                total++;
                if (img.at(x, y)[3] > 8) solid++;
            }
            ok(total > 0 && solid / total > 0.5, `${k}: под жерлом (${cx},${cy}) ствол трубы (${Math.round(100 * solid / Math.max(1, total))}%)`);
        }
    }
}

// ---------- 4. Планировка 66.35 не тронута ----------
console.log('--- 4. Планировка 66.35: дома ≥1 тайла от частокола ---');
ok(BUILDINGS.length === 18, `зданий 18 [${BUILDINGS.length}]`);
ok(BUILDINGS.every(b => b.col + b.w <= 24), 'все дома col+w ≤ 24 (≥1 тайл от частокола)');
ok(BUILDINGS.every(b => b.col >= 1), 'все дома ≥1 тайл от западной кромки');

// ---------- 5. SW: кэши подняты ----------
console.log('--- 5. SW: game-assets-v42 / site-cache v96 ---');
const sw = readFileSync(join(root, 'sw.js'), 'utf-8');
ok(sw.includes("game-assets-v42"), 'SW: game-assets-v42 (текстуры fb_* изменились)');
ok(sw.includes("'chronicles-ruthenia-v108'"), 'SW: site-cache v96');

console.log(`\n=== ИТОГ: ${passed} зелёных, ${failed} красных ===`);
process.exit(failed ? 1 : 0);

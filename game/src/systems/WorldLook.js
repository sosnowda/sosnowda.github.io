// WorldLook.js — 66.37 (приказ владельца): НОВЫЕ АССЕТЫ ВНЕШНЕГО ВИДА ИГРОКА
// И НПЦ ИЗ ПАКОВ GOOGLE DRIVE («Medieval - Heroes I / Townfolk / Town & Country /
// Warfare»), вместо LPC-композитов 64×64.
//
// ДИАГНОЗ: в деревне (×1.125) LPC-фигуры выглядели сносно, но в интерьерах
// (×2.5) лист 64×64 растягивался — «отвратительно» (66.34 маскировал это
// LINEAR-фильтром, плотности пикселей это не прибавило).
//
// РЕШЕНИЕ: мировые листы пересобраны конвейером tools/make_world_6637.py из
// высокоразрешённых листов паков (кадры 128×128, фигура ~88px — втрое плотнее
// LPC). МАСШТАБЫ СЦЕН УМНОЖАЮТСЯ НА WORLD_K = 31/88: фигуры на экране ровно
// прежнего размера (деревня 26px, интерьер 78px), но в интерьерах ×2.5 лист
// теперь ПОНИЖАЕТ разрешение (×0.88 от источника) вместо растяжения —
// фигуры гладкие. Физическое тело: старые 24px кадра 64 → 68px кадра 128
// (WORLD_BODY_PX = 24 / WORLD_K) — мировой размер тот же.
//
// РАСКЛАДКА ЛИСТОВ (assets/sprites/world/*.png): 9 колонок × 4 строки @128,
// кадры row-major 0..35: колонки 0..7 — ходьба, колонка 8 — idle; строки
// 0=вниз, 1=влево, 2=вправо, 3=вверх. Та же нумерация, что у LPC-композита,
// поэтому анимации собираются createCustomCharacterAnimations без изменений.
//
// КЛЮЧИ СОХРАНЕНЫ: игрок — 'player_composite', жители — 'npc_lpc_<id>'
// (единая точка getNpcSpriteKey и весь код сцен работают без правок).

import { createCustomCharacterAnimations } from './CharacterAppearance.js';

export const WORLD_FRAME = 128;
export const WORLD_COLS = 9;
export const WORLD_ROWS = 4;

// Калибровка роста: старая LPC-фигура была 31px в кадре 64; новая — 88px в
// кадре 128. WORLD_K умножает СТАРЫЕ масштабы сцен — визуальный размер
// фигур не меняется (деревня 26px, интерьер 78px), источник плотнее втрое.
export const WORLD_K = 31 / 88;
// Физтело игрока: прежние 24px кадра 64 → 68px кадра 128 (тот же мировой размер).
export const WORLD_BODY_PX = 68;
// Хит-зона НПЦ (прямоугольник в координатах кадра 128): фигура + небольшой
// запас; на экране даёт прежние размеры кликабельной области (54px деревня,
// 160px интерьер).
export const WORLD_HIT_RECT = { x: 30, y: 42, w: 68, h: 86 };

// Детерминированный псевдорандом (идентично NpcLpc/npcPresence)
function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

function pick(list, rnd) {
    return list[Math.floor(rnd * list.length) % list.length];
}

// ---- Гардероб (листы assets/sprites/world/, всё предзагружено в BootScene) ----
const M = {
    bases: ['world_m_base1', 'world_m_base2', 'world_m_base3'],
    tops: Array.from({ length: 9 }, (_, i) => `world_m_top${i + 1}`),
    pants: Array.from({ length: 5 }, (_, i) => `world_m_pants${i + 1}`),
    hair: Array.from({ length: 6 }, (_, i) => `world_m_hair${i + 1}`),
    beards: ['world_m_beard1', 'world_m_beard2'],
    feet: ['world_m_feet1', 'world_m_feet2', 'world_m_feet3'],
};
const F = {
    bases: ['world_f_base1', 'world_f_base2', 'world_f_base3'],
    dresses: Array.from({ length: 5 }, (_, i) => `world_f_dress${i + 1}`),
    hair: Array.from({ length: 7 }, (_, i) => `world_f_hair${i + 1}`),
    feet: ['world_f_feet1', 'world_f_feet2'],
};
const W = { // стража (Warfare): база + доспех + штаны + сапоги + шлем
    base: 'world_w_base1',
    tops: Array.from({ length: 7 }, (_, i) => `world_w_top${i + 1}`),
    bottoms: Array.from({ length: 4 }, (_, i) => `world_w_bottom${i + 1}`),
    feet: ['world_w_feet1', 'world_w_feet2'],
    helms: Array.from({ length: 4 }, (_, i) => `world_w_helm${i + 1}`),
};
const KIDS = Array.from({ length: 6 }, (_, i) => `world_child${i + 1}`);

// Профессиональные схемы одежды (professionId → слои; остальное — случай)
const OUTFIT_M = {
    guard: { warfare: true },
    priest: { tops: ['world_m_top9'], pants: ['world_m_pants4'], feet: ['world_m_feet3'] },
    elder: { tops: ['world_m_top5'], pants: ['world_m_pants4'], feet: ['world_m_feet3'] },
    blacksmith: { tops: ['world_m_top1'], pants: ['world_m_pants1'], feet: ['world_m_feet2'] },
    tavernkeeper: { tops: ['world_m_top6'], pants: ['world_m_pants5'], feet: ['world_m_feet3'] },
    hunter: { tops: ['world_m_top4'], pants: ['world_m_pants3'], feet: ['world_m_feet2'] },
    fisherman: { tops: ['world_m_top7'], pants: ['world_m_pants1'], feet: ['world_m_feet1'] },
    miller: { tops: ['world_m_top2'], pants: ['world_m_pants3'], feet: ['world_m_feet2'] },
    ploughman: { tops: ['world_m_top8'], pants: ['world_m_pants3'], feet: ['world_m_feet1'] },
    peasant: { tops: ['world_m_top2', 'world_m_top8'], pants: ['world_m_pants3', 'world_m_pants1'], feet: ['world_m_feet2'] },
    shepherd: { tops: ['world_m_top2'], pants: ['world_m_pants3'], feet: ['world_m_feet2'] },
    carpenter: { tops: ['world_m_top8'], pants: ['world_m_pants1'], feet: ['world_m_feet2'] },
    potter: { tops: ['world_m_top5'], pants: ['world_m_pants3'], feet: ['world_m_feet1'] },
    butcher: { tops: ['world_m_top6'], pants: ['world_m_pants2'], feet: ['world_m_feet2'] },
    shoemaker: { tops: ['world_m_top3'], pants: ['world_m_pants2'], feet: ['world_m_feet3'] },
    woodcutter: { tops: ['world_m_top4'], pants: ['world_m_pants2'], feet: ['world_m_feet2'] },
    craftsman: { tops: ['world_m_top7'], pants: ['world_m_pants4'], feet: ['world_m_feet2'] },
    apprentice: { tops: ['world_m_top3'], pants: ['world_m_pants1'], feet: ['world_m_feet1'] },
};
const OUTFIT_F = {
    healer_f: { dresses: ['world_f_dress5'], feet: ['world_f_feet1'] },
    beekeeper: { dresses: ['world_f_dress5', 'world_f_dress2'], feet: ['world_f_feet1'] },
    homemaker: { dresses: ['world_f_dress3', 'world_f_dress4'], feet: ['world_f_feet1', 'world_f_feet2'] },
    weaver: { dresses: ['world_f_dress4'], feet: ['world_f_feet2'] },
    shepherd: { dresses: ['world_f_dress3'], feet: ['world_f_feet1'] },
    grocer: { dresses: ['world_f_dress2', 'world_f_dress1'], feet: ['world_f_feet2'] },
};

// ---- Перекраска (механика NpcLook: hue-сдвиг одежды, кожа не трогается) ----
const SKIN_HUE_MIN = 10;
const SKIN_HUE_MAX = 55;

function rgbToHsl(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    return { h: h * 60, s, l };
}

function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return q + (p - q) * (2 / 3 - t) * 6;
    return p;
}

function hslToRgb(hDeg, s, l) {
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hNorm = hDeg / 360;
    return [
        Math.round(hueToRgb(p, q, hNorm + 1 / 3) * 255),
        Math.round(hueToRgb(p, q, hNorm) * 255),
        Math.round(hueToRgb(p, q, hNorm - 1 / 3) * 255),
    ];
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Перекрасить canvas на месте (hue/sat/val), как NpcLook.recolorImage:
 * «цветные» пиксели (одежда) сдвигаются, кожа в полосе тонов 10..55° — нет.
 * Возраст 50+ даёт выцветание (satMul×0.35) — читается как седина.
 */
function recolorWorldCanvas(canvas, look, age) {
    if (!look && !(age >= 50)) return;
    const hue = (look && look.hue) || 0;
    const satMul = (look && look.satMul || 1) * (age >= 50 ? 0.35 : 1);
    const valMul = (look && look.valMul) || 1;
    if (!hue && satMul === 1 && valMul === 1) return;
    const ctx = canvas.getContext('2d');
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
        return; // загрязнённый canvas — остаёмся без перекраски
    }
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const { h: hue0, s: s0, l: l0 } = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        const isSkin = hue0 >= SKIN_HUE_MIN && hue0 <= SKIN_HUE_MAX
            && s0 >= 0.15 && s0 <= 0.85 && l0 >= 0.25 && l0 <= 0.95;
        if (isSkin || s0 < 0.14 || l0 < 0.08 || l0 > 0.97) continue;
        const s1 = Math.min(1, s0 * satMul);
        const l1 = Math.max(0, Math.min(1, l0 * valMul));
        const h1 = (hue0 + hue) % 360;
        const [r, g, b] = hslToRgb(h1, s1, l1);
        d[i] = clamp255(r);
        d[i + 1] = clamp255(g);
        d[i + 2] = clamp255(b);
    }
    ctx.putImageData(imageData, 0, 0);
}

/**
 * Слои НПЦ: детерминированно по зерну игры и id (свой на каждый старт).
 * @returns {string[]} список ключей листов снизу вверх
 */
function rollWorldLayers(scene, registry, npc) {
    const seed = (registry && registry.get('npcSeed')) || 0;
    const base = `${seed}:${npc.id}`;
    const female = npc.gender === 'female';
    const age = npc.age || 30;
    const isChild = age <= 13;
    const prof = npc.professionId || '';
    const rnd = (tag) => hash01(`${base}:${tag}`);

    if (isChild) {
        return [pick(KIDS, rnd('kid'))];
    }

    if (female) {
        const o = OUTFIT_F[prof] || {};
        return [
            pick(F.bases, rnd('base')),
            pick(o.dresses || F.dresses, rnd('dress')),
            pick(o.feet || F.feet, rnd('feet')),
            pick(F.hair, rnd('hair')),
        ];
    }

    const o = OUTFIT_M[prof] || {};
    if (o.warfare) {
        return [
            W.base,
            pick(W.bottoms, rnd('wbottom')),
            pick(W.tops, rnd('wtop')),
            pick(W.feet, rnd('wfeet')),
            pick(W.helms, rnd('whelm')),
        ];
    }
    const layers = [
        pick(M.bases, rnd('base')),
        pick(o.pants || M.pants, rnd('pants')),
        pick(o.tops || M.tops, rnd('top')),
        pick(o.feet || M.feet, rnd('feet')),
        pick(M.hair, rnd('hair')),
    ];
    if (age >= 25) layers.push(pick(M.beards, rnd('beard')));
    return layers;
}

/**
 * Нарисовать композит 9×4 @128 на canvas из загруженных листов.
 * Раскладки совпадают (источники уже 1152×512 с idle в колонке 8), поэтому
 * каждый слой — один drawImage.
 */
function drawWorldComposite(scene, canvas, layerKeys) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const key of layerKeys) {
        if (!scene.textures.exists(key)) {
            console.warn(`[WorldLook] слой не загружен: ${key}`);
            return false;
        }
        const img = scene.textures.get(key).source[0].image;
        if (!img || img.width !== WORLD_COLS * WORLD_FRAME || img.height !== WORLD_ROWS * WORLD_FRAME) {
            console.warn(`[WorldLook] неожиданный размер листа ${key}`);
            return false;
        }
        ctx.drawImage(img, 0, 0);
    }
    return true;
}

/** Разметить кадры 0..35 row-major + LINEAR-фильтр + анимации walk/idle. */
function registerWorldTexture(scene, key, canvas) {
    let tex = null;
    if (scene.textures.exists(key)) {
        const existing = scene.textures.get(key);
        const src = existing.source && existing.source[0];
        if (src && src.image && src.image.tagName === 'CANVAS'
            && src.image.width === canvas.width && src.image.height === canvas.height) {
            const c = src.image.getContext('2d');
            c.clearRect(0, 0, canvas.width, canvas.height);
            c.drawImage(canvas, 0, 0);
            existing.refresh();
            tex = existing;
        } else {
            scene.textures.remove(key);
        }
    }
    if (!tex) {
        tex = scene.textures.addCanvas(key, canvas);
    }
    if (!tex) return false;
    for (let row = 0; row < WORLD_ROWS; row++) {
        for (let col = 0; col < WORLD_COLS; col++) {
            const name = `${row * WORLD_COLS + col}`;
            try {
                if (!tex.has(name)) {
                    tex.add(name, 0, col * WORLD_FRAME, row * WORLD_FRAME, WORLD_FRAME, WORLD_FRAME);
                }
            } catch (e) { /* кадр уже есть */ }
        }
    }
    if (tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    createCustomCharacterAnimations(scene, key, key);
    return true;
}

/**
 * Собрать текстуру ИГРОКА 'player_composite' из мировых листов героев
 * (male → world_hero_male/Baenor, female → world_hero_female/Naia).
 * @returns {boolean} true — текстура собрана
 */
export function composeWorldPlayerTexture(scene, gender) {
    const srcKey = gender === 'female' ? 'world_hero_female' : 'world_hero_male';
    if (!scene.textures.exists(srcKey)) {
        console.warn(`[WorldLook] ${srcKey} не загружен`);
        return false;
    }
    const canvas = document.createElement('canvas');
    canvas.width = WORLD_COLS * WORLD_FRAME;
    canvas.height = WORLD_ROWS * WORLD_FRAME;
    if (!drawWorldComposite(scene, canvas, [srcKey])) return false;
    return registerWorldTexture(scene, 'player_composite', canvas);
}

/**
 * Собрать мировой спрайт жителя 'npc_lpc_<id>' (ключ сохранён для
 * совместимости с getNpcSpriteKey и всеми сценами).
 * @returns {string|null} ключ текстуры или null (тогда сцены откатятся
 * на прежний спрайт — механизм fallback не тронут)
 */
export function ensureWorldNpcTexture(scene, registry, npc) {
    if (!npc || !npc.id) return null;
    const key = `npc_lpc_${npc.id}`;
    if (scene.textures.exists(key)) return key; // уже собран

    const layerKeys = rollWorldLayers(scene, registry, npc);
    const canvas = document.createElement('canvas');
    canvas.width = WORLD_COLS * WORLD_FRAME;
    canvas.height = WORLD_ROWS * WORLD_FRAME;
    if (!drawWorldComposite(scene, canvas, layerKeys)) return null;

    // Индивидуальная перекраска одежды (механика look'ов раунда 23/59)
    try {
        recolorWorldCanvas(canvas, npc.look, npc.age || 30);
    } catch (e) { /* без перекраски */ }

    if (!registerWorldTexture(scene, key, canvas)) return null;
    return key;
}

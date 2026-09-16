// NpcLook.js — уникальная внешность NPC (раунд 23, п.4).
//
// Проблема: все NPC отрисованы тремя базовыми спрайтами
// (npc_elder / npc_merchant / npc_soldier) — половина деревни выглядит
// близнецами, и при каждом старте игры вид одинаковый.
//
// Решение: при старте новой игры каждый NPC получает «look» —
// случайный сдвиг цвета одежды (hue), насыщенности, яркости и рост
// (scale). По look'у холст-обработка перекрашивает ПОПИКСЕЛЬНО базовый
// spritesheet (только «цветные» пиксели — одежда; кожа в диапазоне
// тонов 10°..55° не трогается) и портрет. Итог — у каждого NPC свой
// облик, и он другой при каждом новом старте игры.
//
// Текстуры-варианты кэшируются по ключам:
//   'npc_var_<npcId>'      — spritesheet 4×4 кадра 64×64 (как базовый)
//   'portrait_var_<npcId>' — портрет (96×96 или размер базового)
// и анимации '<variant>_idle_<dir>' / '<variant>_walk_<dir>'.

// Диапазон «кожаных» тонов, которые НЕ перекрашиваем
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
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
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
 * Перекрасить изображение по look'у: сдвиг hue «цветных» пикселей
 * (одежды), множители насыщенности/яркости. Кожа не трогается.
 * maxSide — ограничение размера результата (портреты 1024² перекрашивать
 * по-пиксельно расточительно — они показываются в 96px).
 * Возвращает новый canvas.
 */
function recolorImage(sourceImg, look, maxSide = 0) {
    const sw = sourceImg.width;
    const sh = sourceImg.height;
    // Раунд 24: даунскейл больших портретов перед покраской (экономия ×16+)
    let w = sw, h = sh;
    if (maxSide > 0 && (sw > maxSide || sh > maxSide)) {
        const k = maxSide / Math.max(sw, sh);
        w = Math.max(1, Math.round(sw * k));
        h = Math.max(1, Math.round(sh * k));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sourceImg, 0, 0, sw, sh, 0, 0, w, h);

    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
        // Canvas загрязнён (не должно случаться с локальными ассетами) —
        // возвращаем как есть, NPC останется с базовым видом
        return canvas;
    }
    const d = imageData.data;
    const hue = look.hue || 0;
    const satMul = look.satMul || 1;
    const valMul = look.valMul || 1;

    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const { h: hue0, s: s0, l: l0 } = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        // Кожа: тёплый тон в узкой полосе — не перекрашиваем
        const isSkin = hue0 >= SKIN_HUE_MIN && hue0 <= SKIN_HUE_MAX
            && s0 >= 0.15 && s0 <= 0.85 && l0 >= 0.25 && l0 <= 0.95;
        // Перекрашиваем только заметно цветные пиксели (одежда/волосы-краски)
        if (isSkin || s0 < 0.14 || l0 < 0.08 || l0 > 0.97) continue;

        let s1 = Math.min(1, s0 * satMul);
        let l1 = Math.max(0, Math.min(1, l0 * valMul));
        const h1 = (hue0 + hue) % 360;
        const [r, g, b] = hslToRgb(h1, s1, l1);
        d[i] = clamp255(r);
        d[i + 1] = clamp255(g);
        d[i + 2] = clamp255(b);
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Пересоздать canvas-текстуру из изображения с покраской.
 */
function addRecoloredTexture(scene, outKey, sourceImg, look, maxSide = 0) {
    if (scene.textures.exists(outKey)) scene.textures.remove(outKey);
    const canvas = recolorImage(sourceImg, look, maxSide);
    scene.textures.addCanvas(outKey, canvas);
}

/**
 * Создать анимации для варианта NPC (сетка 4×4 по 64px, как у базовых
 * npc_*-листов): idle = кадр row*4, walk = row*4+1..3 (+2 для плавности).
 */
function createVariantAnims(scene, variantKey) {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir, row) => {
        scene.anims.create({
            key: `${variantKey}_walk_${dir}`,
            frames: scene.anims.generateFrameNumbers(variantKey, {
                frames: [row * 4 + 1, row * 4 + 2, row * 4 + 3, row * 4 + 2],
            }),
            frameRate: 8,
            repeat: -1,
        });
        scene.anims.create({
            key: `${variantKey}_idle_${dir}`,
            frames: [{ key: variantKey, frame: row * 4 }],
            frameRate: 1,
        });
    });
}

/**
 * Построить (один раз за игру) вариант-текстуры NPC: спрайт-лист и портрет.
 *
 * @param {Phaser.Scene} scene
 * @param {Object} npc — объект NPC из registry ('npcs'), с полем look
 * @returns {boolean} true, если вариант построен/уже есть
 */
export function buildNpcLookTextures(scene, npc) {
    if (!npc || !npc.look || !npc.id) return false;
    const variantKey = `npc_var_${npc.id}`;
    const portraitKey = `portrait_var_${npc.id}`;
    if (scene.textures.exists(variantKey)) return true; // уже построено

    const baseKey = npc.sprite || 'npc_elder';
    if (!scene.textures.exists(baseKey)) return false;

    // --- Спрайт-лист (4×4 × 64px) ---
    const baseTex = scene.textures.get(baseKey);
    const sourceImg = baseTex.source && baseTex.source[0] && baseTex.source[0].image;
    if (!sourceImg) return false;
    addRecoloredTexture(scene, variantKey, sourceImg, npc.look);

    // Разметка кадров (Phaser не размечает canvas-текстуры сам)
    const tex = scene.textures.get(variantKey);
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const frameName = `${row * 4 + col}`;
            try {
                if (!tex.has(frameName)) {
                    tex.add(frameName, 0, col * 64, row * 64, 64, 64);
                }
            } catch (e) { /* кадр уже есть */ }
        }
    }
    createVariantAnims(scene, variantKey);

    // --- Портрет (если есть базовый) ---
    // Раунд 24: портрет — живописный webp 1024²; перекрашиваем с даунскейлом
    // до 256px (показывается в 96px) — быстрая покраска, мягкие тона
    const basePortrait = npc.portrait;
    if (basePortrait && scene.textures.exists(basePortrait)) {
        const pTex = scene.textures.get(basePortrait);
        const pImg = pTex.source && pTex.source[0] && pTex.source[0].image;
        if (pImg) {
            addRecoloredTexture(scene, portraitKey, pImg, npc.look, 256);
        }
    }
    return true;
}

/**
 * Ключ варианта спрайта NPC (или null, если look не назначен).
 */
export function npcVariantKey(npc) {
    return (npc && npc.look && npc.id) ? `npc_var_${npc.id}` : null;
}

/**
 * Ключ варианта портрета NPC (или null).
 */
export function npcPortraitVariantKey(npc) {
    return (npc && npc.look && npc.id && npc.portrait) ? `portrait_var_${npc.id}` : null;
}

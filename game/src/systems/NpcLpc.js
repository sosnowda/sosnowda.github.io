// NpcLpc.js — раунд 28 (п.2): LPC-композиты для ВСЕХ жителей деревни.
//
// Владелец выбрал Вариант A: жители собираются той же системой
// композитинга LPC, что и герой (CharacterAppearance.composeCharacterTexture):
//   тело + глаза + причёска + борода + штаны + обувь + рубаха = 64×64,
//   ходьба в 4 стороны + idle, у каждого жителя СВОЯ внешность.
//
// Отличие от героя: слои для жителей выбираются ДЕТЕРМИНИРОВАННО
// (FNV-хэш от npcSeed + id NPC) из фиксированной «крестьянской» палитры
// (PALETTE ниже). Поэтому BootScene заранее подгружает ровно эти файлы
// (быстро), а внешность уникальна в каждой новой игре и стабильна в течение
// партии. Живописные портреты DarklandsReborn в диалогах остаются как были.
//
// Дети (п.1 раунда 28) собираются из той же палитры, но без бород и
// отображаются в меньшем масштабе (решает сцена по возрасту NPC).

import { composeCharacterTexture, createCustomCharacterAnimations } from './CharacterAppearance.js';

// ---- «Крестьянская» палитра слоёв (все файлы существуют в assets/lpc/) ----
export const PALETTE = {
    body_male: [
        'male_light', 'male_tan', 'male_olive', 'male_taupe', 'male_amber', 'male_bronze',
    ],
    body_female: [
        'female_light', 'female_tan', 'female_olive', 'female_taupe', 'female_amber', 'female_bronze',
    ],
    // 3 мужские стрижки × 5 цветов
    hair_male_colors: ['black', 'dark_brown', 'chestnut', 'blonde', 'white'],
    hair_male_shapes: ['mop', 'swoop', 'messy1'],
    // 3 женские причёски × 5 цветов + косички для девочек
    hair_female_shapes: ['bangslong', 'loose', 'wavy'],
    hair_girl_extra_shapes: ['bunches'],
    torso: [
        // Раунд 37 (п.16 заявки «НПЦ просвечиваются»): открытые жилеты vest_open_*
        // убраны — сквозь них виднеется голое тело. Только полная одежда.
        'longsleeve_longsleeve_forest', 'longsleeve_longsleeve_tan', 'longsleeve_longsleeve_charcoal',
        'longsleeve_longsleeve_maroon', 'longsleeve_longsleeve_white',
        'longsleeve_laced_forest', 'longsleeve_laced_tan', 'longsleeve_laced_charcoal',
        'longsleeve_laced_maroon', 'longsleeve_laced_white',
        'vest_charcoal', 'vest_forest', 'vest_maroon', 'vest_tan', 'vest_white',
    ],
    // Раунд 28: штаны/юбки по полу — мужчины без юбок, женщины без «мужских»
    legs_male: [
        'pants_forest', 'pants_tan', 'pants_charcoal', 'pants_maroon', 'pants_white',
        'male_black', 'male_brown', 'male_gray', 'leggings_tan', 'leggings_forest',
        'teen_brown', 'teen_gray', 'teen_black',
    ],
    legs_female: [
        'skirts_plain_tan', 'skirts_plain_forest', 'skirts_plain_charcoal',
        'pants_forest', 'pants_tan', 'pants_charcoal', 'leggings_tan', 'leggings_forest',
        'teen_brown', 'teen_gray',
    ],
    feet_male: [
        'boots_charcoal', 'boots_forest', 'boots_maroon', 'boots_tan', 'boots_white',
        'male_black', 'male_brown', 'male_gray', 'shoes2_tan', 'shoes2_charcoal',
    ],
    feet_female: [
        'boots_forest', 'boots_tan', 'female_brown', 'female_black',
        'shoes2_tan', 'shoes2_charcoal', 'male_brown',
    ],
    // Цвет бороды = цвет волос (см. rollLpcAppearance)
    // Раунд 37: добавлена короткая борода beard_basic (6 форм теперь)
    beards: ['beard_medium', 'beard_trimmed', 'beard_winter', 'mustache_bigstache', 'beard_basic'],
    beard_colors: ['black', 'dark_brown', 'chestnut', 'white', 'blonde'],
    eyes: ['human_adult_brown', 'human_adult_blue', 'human_adult_gray', 'human_adult_green'],
};

// Плоский список файлов палитры для предзагрузки в BootScene (без дублей).
export function paletteLayerFiles() {
    const files = [];
    const seen = new Set();
    const push = (cat, name) => {
        const key = `lpc_${cat}_${name}`;
        if (seen.has(key)) return;          // ноги/обувь общие у полов — грузим один раз
        seen.add(key);
        files.push({ cat, name, key });
    };
    PALETTE.body_male.forEach(n => push('body', n));
    PALETTE.body_female.forEach(n => push('body', n));
    PALETTE.hair_male_shapes.forEach(s => PALETTE.hair_male_colors.forEach(c => push('hair', `${s}_${c}`)));
    [...PALETTE.hair_female_shapes, ...PALETTE.hair_girl_extra_shapes].forEach(s =>
        PALETTE.hair_male_colors.forEach(c => push('hair', `${s}_${c}`)));
    PALETTE.torso.forEach(n => push('torso', n));
    [...PALETTE.legs_male, ...PALETTE.legs_female].forEach(n => push('legs', n));
    [...PALETTE.feet_male, ...PALETTE.feet_female].forEach(n => push('feet', n));
    PALETTE.beards.forEach(s => PALETTE.beard_colors.forEach(c => push('beards', `${s}_${c}`)));
    PALETTE.eyes.forEach(n => push('eyes', n));
    return files;
}

// ---- Детерминированный псевдорандом (как в npcPresence.js) ----
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

/**
 * Детерминированная внешность жителя (по зерну игры и id).
 * @returns {Object} appearance — { body, eyes, beards?, hair, legs, feet, torso }
 */
export function rollLpcAppearance(registry, npc) {
    const seed = (registry && registry.get('npcSeed')) || 0;
    const base = `${seed}:${npc.id}`;
    const female = npc.gender === 'female';
    const isChild = (npc.age || 30) <= 13;
    const rnd = (tag) => hash01(`${base}:${tag}`);

    const bodies = female ? PALETTE.body_female : PALETTE.body_male;
    const hairShapes = female
        ? (isChild ? [...PALETTE.hair_female_shapes, ...PALETTE.hair_girl_extra_shapes] : PALETTE.hair_female_shapes)
        : PALETTE.hair_male_shapes;

    const hairShape = pick(hairShapes, rnd('hair.shape'));
    const hairColor = pick(PALETTE.hair_male_colors, rnd('hair.color'));

    const appearance = {
        body: pick(bodies, rnd('body')),
        eyes: pick(PALETTE.eyes, rnd('eyes')),
        hair: `${hairShape}_${hairColor}`,
        legs: pick(female ? PALETTE.legs_female : PALETTE.legs_male, rnd('legs')),
        feet: pick(female ? PALETTE.feet_female : PALETTE.feet_male, rnd('feet')),
        torso: pick(PALETTE.torso, rnd('torso')),
    };
    // Раунд 39 (п.4 заявки): женский силуэт — оверлей груди поверх одежды
    // (слой lpc_chest_female генерируется в BootScene.ensureFemaleChestTexture)
    if (female) appearance.chest = 'female';

    // Борода — только взрослым мужчинам (65%), цвет совпадает с волосами
    if (!female && !isChild && rnd('beard.want') < 0.65) {
        const shape = pick(PALETTE.beards, rnd('beard.shape'));
        const bColor = PALETTE.beard_colors.includes(hairColor)
            ? hairColor
            : pick(PALETTE.beard_colors, rnd('beard.color'));
        appearance.beards = `${shape}_${bColor}`;
    }
    return appearance;
}

/** Ключ LPC-текстуры жителя */
export function npcLpcKey(npcId) {
    return `npc_lpc_${npcId}`;
}

/**
 * Собрать LPC-спрайт-лист жителя (один раз за игру). Все нужные слои уже
 * загружены в BootScene из палитры; если чего-то нет — вежливый отказ,
 * вызывающая сцена останется на прежнем спрайте npc_*.
 * @returns {string|null} ключ текстуры или null
 */
export function ensureNpcLpcTexture(scene, registry, npc) {
    if (!npc || !npc.id) return null;
    const key = npcLpcKey(npc.id);
    if (scene.textures.exists(key)) return key;           // уже собран
    if (!scene.cache.json.has('lpc_manifest')) return null;

    const appearance = rollLpcAppearance(registry, npc);
    // Все ли слои на месте?
    const missing = Object.entries(appearance)
        .some(([cat, name]) => !scene.textures.exists(`lpc_${cat}_${name}`));
    if (missing) return null;

    const ok = composeCharacterTexture(scene, appearance, key);
    if (!ok) {
        // Раунд 41 (QA): НЕ удаляем текстуру — compose уже обновил её на месте
        // (частичным контентом); удаление могло бы «убить» спрайты, которые
        // уже ссылаются на этот ключ с прошлой удачной сборки.
        return null;
    }
    // Анимации walk/idle в 4 стороны с префиксом = ключу текстуры
    createCustomCharacterAnimations(scene, key, key);
    return key;
}

/**
 * Ключ спрайта жителя для сцены: LPC-композит (если собрался) или прежний
 * базовый спрайт (npc_elder/npc_merchant/npc_soldier). Единая точка для
// всех сцен — деревня, интерьеры, локации, пасека.
 */
export function getNpcSpriteKey(scene, registry, npcId) {
    const npc = registry.get('npcs')?.find(n => n.id === npcId) || null;
    if (npc) {
        const lpc = ensureNpcLpcTexture(scene, registry, npc);
        if (lpc) return lpc;
    }
    return (npc && npc.sprite) || 'npc_elder';
}

/**
 * Ребёнок ли NPC (для уменьшенного масштаба и детских реплик).
 */
export function isChildNpc(npc) {
    return !!npc && (npc.age || 30) <= 13;
}

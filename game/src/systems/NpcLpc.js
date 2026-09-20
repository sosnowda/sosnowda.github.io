// NpcLpc.js — раунд 28 (п.2): LPC-композиты для ВСЕХ жителей деревни.
//
// РАУНД 58 (п.5 приказа владельца) — ЕДИНЫЙ ШАБЛОН ЖИТЕЛЕЙ:
// все жители собираются ОДНИМ шаблоном (CharacterAppearance.composeCharacterTexture):
//   тело + глаза + причёска + борода + штаны + обувь + рубаха = 64×64,
//   ходьба в 4 стороны + idle.
// РАУНД 59 (приказ владельца, пп.2,3,6,7,8) — уточнения шаблона:
//   1) РАЗМЕР ПО ВОЗРАСТУ (ребёнок 0.7 / подросток 0.85 / взрослый 1.0) —
//      решает сцена по возрасту NPC;
//   2) ИНДИВИДУАЛЬНАЯ РАСЦВЕТКА ОДЕЖДЫ (торс/штаны/обувь — детерминированно
//      из крестьянской палитры PALETTE ниже, FNV-хэш от npcSeed + id NPC);
//   3) ПРИЧЁСКИ У ВСЕХ РАЗНЫЕ (п.2): у мужчин — КОРОТКИЕ стрижки
//      (mop/swoop/messy1), у женщин — ДЛИННЫЕ волосы (bangslong/loose/wavy),
//      у девочек — ещё и косички (bunches); цвет волос тоже индивидуален;
//   4) БОРОДА У МУЖЧИН 25+ (п.3, было 45+), единая окладистая;
//   5) СЕДИНА У 50+ (п.6, было 60+) — белые волосы и борода;
//   6) ЦВЕТ ГЛАЗ У ВСЕХ РАЗНЫЙ (п.7): случайно из реалистичных
//      (карие/синие/серые/зелёные);
//   7) все случайные цвета (одежда/волосы/глаза) свои на КАЖДЫЙ СТАРТ ИГРЫ
//      (п.8 — зерно npcSeed создаётся заново при initNpcNames).
// РАУНД 61 (пп.3,7,10 приказа владельца): облик героя собирался из готовых
// моделей ('player'/'npc_merchant'), прессеты были удалены.
// РАУНД 62 (п.1 приказа владельца): прессеты «Баэнор» (♂)/«Пауль» (♀)
// ВЕРНУЛИСЬ — см. HERO_PRESETS/getHeroPreset/composePlayerTexture ниже.

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
 * ЕДИНЫЙ ШАБЛОН жителя (раунды 58–59): детерминированная внешность
 * (по зерну игры и id — своё на КАЖДЫЙ СТАРТ ИГРЫ, п.8).
 * Раунд 59 (пп.2,3,6,7): индивидуальны — ПРИЧЁСКА (муж. короткие /
 * жен. длинные, у всех разные), ЦВЕТ ВОЛОС (седина у 50+), ЦВЕТ ГЛАЗ
 * (случайный из реалистичных), расцветка ОДЕЖДЫ; борода у мужчин 25+.
 * Тело собирается одним и тем же шаблоном; масштаб — строго по возрасту.
 * @returns {Object} appearance — { body, eyes, beards?, hair, legs, feet, torso }
 */
export function rollLpcAppearance(registry, npc) {
    const seed = (registry && registry.get('npcSeed')) || 0;
    const base = `${seed}:${npc.id}`;
    const female = npc.gender === 'female';
    const isChild = (npc.age || 30) <= 13;
    const age = (npc.age || 30);
    const rnd = (tag) => hash01(`${base}:${tag}`);

    // --- ЕДИНАЯ БАЗА ШАБЛОНА: тон кожи (случаен, п.8) ---
    const body = pick(female ? PALETTE.body_female : PALETTE.body_male, rnd('body'));

    // --- ПРИЧЁСКА (раунд 59, п.2): У ВСЕХ РАЗНЫЕ, разделение по полу ---
    // Мужчины — КОРОТКИЕ стрижки; женщины — ДЛИННЫЕ волосы; у девочек —
    // ещё и косички. Цвет волос индивидуален; СЕДИНА У 50+ (п.6) — белые.
    const hairShapes = female
        ? [...PALETTE.hair_female_shapes, ...(isChild ? PALETTE.hair_girl_extra_shapes : [])]
        : PALETTE.hair_male_shapes;
    const hairShape = pick(hairShapes, rnd('hairShape'));
    const hairColor = age >= 50 ? 'white'
        : pick(PALETTE.hair_male_colors.filter(c => c !== 'white'), rnd('hairColor'));

    // --- ЦВЕТ ГЛАЗ (раунд 59, п.7): случайный из РЕАЛИСТИЧНЫХ ---
    const eyes = pick(PALETTE.eyes, rnd('eyes'));

    // --- ИНДИВИДУАЛЬНОЕ: расцветка одежды (п.8: своя на каждый старт) ---
    const appearance = {
        body,
        eyes,
        hair: `${hairShape}_${hairColor}`,
        legs: pick(female ? PALETTE.legs_female : PALETTE.legs_male, rnd('legs')),
        feet: pick(female ? PALETTE.feet_female : PALETTE.feet_male, rnd('feet')),
        torso: pick(PALETTE.torso, rnd('torso')),
    };
    // Раунд 39 (п.4 заявки): женский силуэт — оверлей груди поверх одежды
    // (слой lpc_chest_female генерируется в BootScene.ensureFemaleChestTexture)
    if (female) appearance.chest = 'female';

    // Борода — ВОЗРАСТНОЙ признак: мужчины 25+ (раунд 59, п.3 — было 45+)
    // носят единую окладистую бороду цвета волос (у седых — седая).
    if (!female && !isChild && age >= 25) {
        appearance.beards = `beard_medium_${hairColor}`;
    }
    return appearance;
}

/**
 * ============================================================
 * РАУНД 62 (п.1 приказа владельца): ГОТОВЫЕ ПРЕССЕТЫ ГЕРОЯ ВЕРНУЛИСЬ.
 * «прессеты „Пауль"/«Баэнора" (LPC-композиты) удалены…» — ВЕРНУТЬ ОБРАТНО,
 * причём ПРЕССЕТ «Пауль» — ДЛЯ ЖЕНСКОГО ПЕРСОНАЖА, а «Баэнор» — ДЛЯ
 * МУЖСКОГО (перекрёстно к раунду 60, где было наоборот). Выбор
 * АВТОМАТИЧЕСКИЙ, без меню; кастомизации по-прежнему НЕТ (пп.7,10 р.61).
 *
 * Прессеты собираются из LPC-слоёв ЕДИНЫМ ШАБЛОНОМ (как у жителей,
 * composeCharacterTexture), цвета/причёска/одежда ФИКСИРОВАННЫЕ.
 * Тело и оверлей груди — всегда по полу героя (иначе спрайт «чужого»
 * тела); возрастные правила единого шаблона сохранены: борода у мужчин
 * 25+ цвета волос, седина у 50+.
 * ============================================================
 */
// Верхняя граница возраста игрока (AgeRules.AGE_MAX = 50 — без циклического импорта)
const AGE_MAX_PLAYER = 50;

export const HERO_PRESETS = {
    male: {
        name: 'Баэнор',
        // «странник с тёмными волосами»: светлая кожа, зелёные глаза,
        // длинные тёмные волосы, бордовая рубаха, коричневые штаны
        appearance: {
            body: 'male_light',
            eyes: 'human_adult_green',
            hair: 'loose_dark_brown',
            torso: 'longsleeve_longsleeve_maroon',
            legs: 'male_brown',
            feet: 'boots_tan',
        },
    },
    female: {
        name: 'Пауль',
        // «молотобойка с короткой стрижкой»: смуглая кожа, карие глаза,
        // каштановая стрижка «моп», серая рубаха, тёмные штаны
        appearance: {
            body: 'female_tan',
            eyes: 'human_adult_brown',
            hair: 'mop_chestnut',
            torso: 'longsleeve_longsleeve_charcoal',
            legs: 'pants_charcoal',
            feet: 'boots_charcoal',
        },
    },
};

/**
 * Раунд 62 (п.1): готовый прессет героя ПО ПОЛУ — «Баэнор» (муж.)
 * или «Пауль» (жен.). Возрастные правила единого шаблона применяются
 * к прессету: у мужчин 25+ — борода цвета волос; у 50+ — седые волосы.
 * @param {string} gender — 'male' | 'female'
 * @param {number} age — возраст героя (15..50)
 * @returns {{ name: string, appearance: Object }}
 */
export function getHeroPreset(gender, age) {
    const preset = HERO_PRESETS[gender === 'female' ? 'female' : 'male'];
    const a = Math.max(15, Math.min(AGE_MAX_PLAYER, Number(age) || 25));
    const appearance = { ...preset.appearance };

    // Форма и цвет волос разбираются честно: «loose_dark_brown» →
    // форма «loose», цвет «dark_brown» (цвет может быть из двух слов).
    const [shape, ...colorParts] = appearance.hair.split('_');
    const hairColor = colorParts.join('_') || 'brown';

    // Седина у 50+ (п.6 раунда 59) — белые волосы (и борода ниже)
    if (a >= 50) {
        appearance.hair = `${shape}_white`;
    }
    // Борода у мужчин 25+ (п.3 раунда 59) — единственная окладистая
    if (gender !== 'female' && a >= 25) {
        appearance.beards = `beard_medium_${a >= 50 ? 'white' : hairColor}`;
    }
    // Женский силуэт — оверлей груди (тело всегда «своего» пола)
    if (gender === 'female') appearance.chest = 'female';

    return { name: preset.name, appearance };
}

/**
 * Собрать текстуру ИГРОКА 'player_composite' (LPC-композит, 9×4 кадра)
 * и создать анимации walk/idle. Все слои уже предзагружены в BootScene.
 * Анимации создаются ОДИН РАЗ (повторная сборка той же текстуры обновляет
 * кадры на месте — анимации остаются валидными).
 * @returns {boolean} true — текстура собрана
 */
export function composePlayerTexture(scene, appearance, textureKey = 'player_composite') {
    const ok = composeCharacterTexture(scene, appearance, textureKey);
    if (ok && !scene.anims.exists(`${textureKey}_walk_down`)) {
        createCustomCharacterAnimations(scene, textureKey, textureKey);
    }
    return ok;
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

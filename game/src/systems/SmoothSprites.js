// 66.34 (п.11 владельца): ГЛАДКИЕ ПЕРСОНАЖИ НА КРУПНЫХ МАСШТАБАХ.
//
// Проблема: конфиг pixelArt:true даёт ВСЕМ текстурам NEAREST-фильтр.
// Листы персонажей 64×64 показываются в интерьерах/локациях в 2.5×, и
// нецелое NEAREST-увеличение рвёт картинку: пиксели становятся неравными
// (то 2px, то 3px), контуры «пилой», лица — кашей. В деревне фигуры почти
// в натуральную величину (×1.125) — там дефект незаметен, отсюда и жалоба
// «внутри помещений отвратительно, в деревне намного лучше».
//
// Решение (выбрано по живым кадрам-сравнениям game/tools/quality_variants_6634.mjs
// — NEAREST 2.5 / LINEAR 2.5 / целочисленный 2.0 / запечённый билинейный клон):
// LINEAR-фильтр ТОЛЬКО на текстурах персонажей. Фигуры на крупном плане
// становятся гладкими (кадр variant_b_linear25.png), в деревне ×1.125 разница
// на глаз не видна. Тайлы/декор/эффекты остаются NEAREST — пиксель-арт мира цел.
//
// Динамические текстуры (LPC-композиты, перекрашенные варианты) собираются
// позже BootScene — фильтр ставится в местах их создания:
//   - CharacterAppearance.composeCharacterTexture ('player_composite', 'npc_lpc_*')
//   - NpcLook.addRecoloredTexture ('npc_var_*')
// Эта точка (applyCharacterSmoothFilter) накрывает всё загруженное в Boot.

const CHAR_EXACT = new Set([
    'player', 'player_composite', 'enemy_bandit', 'enemy_thief',
]);

const CHAR_PREFIXES = [
    'hero_',        // облики игрока из паков Medieval (hero_baenor, hero_paul, …)
    'npc_',         // npc_elder/merchant/soldier/bandit, npc_lpc_*, npc_var_*
    'enemy_thief',  // enemy_thief_m / enemy_thief_f (+ базовый в точном списке)
];

/** Это ключ текстуры персонажа (кандидат на гладкий фильтр)? */
export function isCharacterTextureKey(key) {
    if (!key) return false;
    if (CHAR_EXACT.has(key)) return true;
    return CHAR_PREFIXES.some(p => key.startsWith(p));
}

/**
 * Поставить LINEAR-фильтр на все ЗАГРУЖЕННЫЕ текстуры персонажей.
 * Вызывается один раз в BootScene.create(); динамические текстуры
 * получают фильтр в местах сборки (см. шапку файла).
 * @param {Phaser.Scene} scene
 */
export function applyCharacterSmoothFilter(scene) {
    if (!scene || !scene.textures) return 0;
    let n = 0;
    scene.textures.getTextureKeys().forEach((k) => {
        if (isCharacterTextureKey(k)) {
            scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
            n++;
        }
    });
    console.info(`[SmoothSprites] LINEAR filter applied to ${n} character textures`);
    return n;
}

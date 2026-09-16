// AmbientFX.js — раунд 28: утренний туман и сезонные детали земли.
//
// п.4 владельца: туман у мельницы ВЕРНУТЬ и добавить С УТРА во все локации.
// п.5 владельца: смена времён года на всех локациях (снег зимой, листья
// осенью, цветы весной) — поверх уже существующих overlay дня/ночи.
//
// Все эффекты мягкие и дешёвые: несколько спрайтов fog_puff + готовые
// процедурные текстуры deco_snow_patch / deco_flower_* / forest_leaf.

import { getTime, getSeason } from './TimeSystem.js';

/**
 * Коэффициент утренней мглы 0..1 по игровому часу:
 *  4-6 (рассвет)  — густой туман,
 *  6-9 (утро)     — постепенно рассеивается,
 *  после 9        — чисто.
 */
export function morningFogFactor(registry) {
    const t = getTime(registry);
    const hour = t ? (t.hour ?? 12) : 12;
    if (hour >= 4 && hour < 6) return 1;
    if (hour >= 6 && hour < 9) return (9 - hour) / 3;   // 1 → 0
    return 0;
}

/**
 * Утренний туман: клочья fog_puff низко над землёй, медленно дрейфуют.
 * Чем раньше утро — тем гуще (alpha и количество растут).
 * Вызывать ПОСЛЕ отрисовки фона локации.
 *
 * @param {Phaser.Scene} scene
 * @param {Object} opts { width, height, yMin, yMax, depth, top }
 */
export function addMorningFog(scene, opts = {}) {
    const width = opts.width ?? scene.scale.width;
    const height = opts.height ?? scene.scale.height;
    const yMin = opts.yMin ?? height * 0.18;
    const yMax = opts.yMax ?? height - 60;
    const depth = opts.depth ?? 6.5;
    const k = morningFogFactor(scene.registry);
    if (k <= 0.02 || !scene.textures.exists('fog_puff')) return 0;

    const n = Math.round(4 + k * 5);          // 4..9 клочьев
    let made = 0;
    for (let i = 0; i < n; i++) {
        const fx = Phaser.Math.Between(30, width - 30);
        const fy = Phaser.Math.Between(yMin, yMax);
        const fog = scene.add.image(fx, fy, 'fog_puff')
            .setScale(1.1 + Math.random() * 1.5)
            .setAlpha(0.05 * k + Math.random() * 0.06 * k)
            .setDepth(depth + Math.random() * 0.4);
        scene.tweens.add({
            targets: fog,
            x: fx + Phaser.Math.Between(-80, 80),
            y: fy + Phaser.Math.Between(-12, 12),
            duration: 11000 + Math.random() * 9000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        made++;
    }
    return made;
}

/**
 * Сезонные детали поверхности по КАЛЕНДАРЮ игры (не по погоде дня):
 *   winter — снежные намёты deco_snow_patch,
 *   autumn — редкая падающая листва forest_leaf,
 *   spring — цветочки deco_flower_*,
 *   summer — ничего (свежая трава и так летом).
 * Возвращает строку сезона (для QA-проверок).
 */
export function addSeasonalGround(scene, opts = {}) {
    const width = opts.width ?? scene.scale.width;
    const height = opts.height ?? scene.scale.height;
    const yMin = opts.yMin ?? 95;
    const yMax = opts.yMax ?? height - 40;
    const depth = opts.depth ?? 2.2;
    const density = opts.density ?? 1;
    const t = getTime(scene.registry);
    if (!t) return 'none';
    const season = getSeason(t.month);

    if (season === 'winter' && scene.textures.exists('deco_snow_patch')) {
        const n = Math.round(16 * density);
        for (let i = 0; i < n; i++) {
            scene.add.image(Math.random() * width, Phaser.Math.Between(yMin, yMax), 'deco_snow_patch')
                .setScale(1 + Math.random() * 0.8)
                .setAlpha(0.75)
                .setFlipX(i % 2 === 0)
                .setDepth(depth);
        }
    }
    if (season === 'autumn' && scene.textures.exists('forest_leaf')) {
        scene.add.particles(0, 0, 'forest_leaf', {
            x: { min: 0, max: width },
            y: -10,
            lifespan: 9000,
            speedY: { min: 16, max: 36 },
            speedX: { min: -12, max: 20 },
            rotate: { start: 0, end: 220 },
            scale: { min: 0.7, max: 1.2 },
            alpha: { start: 0.55, end: 0.12 },
            quantity: 1,
            frequency: 2200,
        }).setDepth(depth + 0.5);
    }
    if (season === 'spring' && scene.textures.exists('deco_flower_0')) {
        const n = Math.round(10 * density);
        for (let i = 0; i < n; i++) {
            scene.add.image(Math.random() * width, Phaser.Math.Between(yMin, yMax), `deco_flower_${i % 3}`)
                .setScale(1)
                .setAlpha(0.9)
                .setDepth(depth);
        }
    }
    return season;
}

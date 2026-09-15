// Погодная система (раунд 14).
// Погода детерминирована датой (year-month-day): все сцены в один игровой день
// видят одинаковую погоду — без рассинхрона между деревней, лесом и развилкой.
// Типы: ясно / пасмурно / дождь / гроза; зимой дождь заменяется снегом.
// Геймплейные хуки:
//  - в дождь/грозу рыба клюёт лучше (+1 ❤ к улову в VillageScene.goFishing);
//  - в дождь/грозу волки слышат хуже (радиус агро −35% в ForestScene);
//  - гроза — редкие вспышки молний.

import { getTime, getSeason } from './TimeSystem.js';

export const WEATHER_TYPES = {
    clear:  { id: 'clear',  name: 'Ясно',     icon: '☀️' },
    cloudy: { id: 'cloudy', name: 'Пасмурно', icon: '☁️' },
    rain:   { id: 'rain',   name: 'Дождь',    icon: '🌧' },
    storm:  { id: 'storm',  name: 'Гроза',    icon: '⛈' },
    snow:   { id: 'snow',   name: 'Снег',     icon: '🌨' },
};

// FNV-1a — стабильный хеш строки даты
function hashDateKey(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
}

/**
 * Погода дня. Без registry.getTime → ясно (сцены меню).
 */
export function getWeather(registry) {
    const t = getTime(registry);
    if (!t) return WEATHER_TYPES.clear;
    const roll = hashDateKey(`${t.yearFromChrist}-${t.month}-${t.day}`) % 100;
    if (getSeason(t.month) === 'winter') {
        if (roll < 42) return WEATHER_TYPES.snow;
        if (roll < 72) return WEATHER_TYPES.cloudy;
        return WEATHER_TYPES.clear;
    }
    if (roll < 46) return WEATHER_TYPES.clear;
    if (roll < 72) return WEATHER_TYPES.cloudy;
    if (roll < 93) return WEATHER_TYPES.rain;
    return WEATHER_TYPES.storm;
}

export function isRainy(w) {
    return !!w && (w.id === 'rain' || w.id === 'storm');
}

export function isPrecip(w) {
    return isRainy(w) || (!!w && w.id === 'snow');
}

/**
 * Применить погодную графику к сцене (вызывается один раз в create()).
 * Возвращает { weather, tint, emitter, flash }.
 *  - tint: MULTIPLY-затемнение неба (экранные координаты, scrollFactor 0);
 *  - emitter: дождь/снег в экранных координатах;
 *  - flash: прямоугольник молний (только гроза).
 * depth-соглашение: day/night overlay 95, HUD 100+ → затемнение 94, осадки 98.
 */
export function applyWeatherVisuals(scene, { tintDepth = 94, precipDepth = 98 } = {}) {
    const weather = getWeather(scene.registry);
    scene.weather = weather;
    const { width, height } = scene.scale;
    const out = { weather, tint: null, emitter: null, flash: null };

    if (weather.id === 'cloudy' || isPrecip(weather)) {
        const color = weather.id === 'cloudy' ? 0x707a84 : 0x4a545e;
        const alpha = weather.id === 'cloudy' ? 0.16 : (weather.id === 'snow' ? 0.20 : 0.30);
        out.tint = scene.add.rectangle(0, 0, width, height, color, alpha)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(tintDepth)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    if (isRainy(weather)) {
        const heavy = weather.id === 'storm';
        out.emitter = scene.add.particles(0, 0, 'weather_rain', {
            x: { min: -60, max: width + 60 },
            y: -18,
            lifespan: 640,
            speedY: { min: 620, max: 840 },
            speedX: { min: 60, max: 120 },          // наклон — ветер
            scale: { min: 0.7, max: 1.15 },
            alpha: { start: 0.52, end: 0.22 },
            quantity: heavy ? 4 : 2,
            frequency: heavy ? 26 : 46,
        });
        out.emitter.setScrollFactor(0).setDepth(precipDepth);

        if (heavy) {
            // Молния: короткая вспышка экрана по редкому расписанию
            const flash = scene.add.rectangle(0, 0, width, height, 0xf4f0ff, 1)
                .setOrigin(0).setScrollFactor(0).setDepth(precipDepth - 1).setAlpha(0);
            const strike = () => {
                scene.tweens.add({
                    targets: flash,
                    alpha: { from: 0, to: 0.32 },
                    duration: 70,
                    yoyo: true,
                    hold: 50,
                    ease: 'Quad.easeOut',
                });
            };
            const schedule = () => {
                scene.time.delayedCall(Phaser.Math.Between(7000, 16000), () => {
                    strike();
                    schedule();
                });
            };
            schedule();
            out.flash = flash;
        }
    } else if (weather.id === 'snow') {
        out.emitter = scene.add.particles(0, 0, 'weather_snow', {
            x: { min: 0, max: width },
            y: -10,
            lifespan: 9500,
            speedY: { min: 26, max: 48 },
            speedX: { min: -16, max: 16 },
            scale: { min: 0.5, max: 1.1 },
            alpha: { start: 0.85, end: 0.35 },
            quantity: 1,
            frequency: 90,
        });
        out.emitter.setScrollFactor(0).setDepth(precipDepth);
    }

    return out;
}

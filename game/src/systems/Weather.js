// Погодная система (раунд 14; раунд 66.6 — ПЛАВНЫЕ ПЕРЕХОДЫ).
// Погода детерминирована датой (year-month-day): все сцены в один игровой день
// видят одинаковую погоду — без рассинхрона между деревней, лесом и развилкой.
// Типы: ясно / пасмурно / дождь / гроза; зимой дождь заменяется снегом.
// Геймплейные хуки:
//  - в дождь/грозу рыба клюёт лучше (+1 ❤ к улову);
//  - в дождь/грозу волки слышат хуже (радиус агро −35% в ForestScene);
//  - гроза — редкие вспышки молний.
//
// РАУНД 66.6: погодные эффекты больше не «выскакивают» мгновенно:
//  1) при входе в сцену затемнение и осадки ПЛАВНО проявляются (~2.2 с);
//  2) сцены, живущие дольше дня (деревня, локации), САМИ плавно переключаются
//     на погоду нового дня: старое затемнение/осадки растворяются, новые
//     проявляются (crossfade ~1.6 с) — без перезапуска сцены.

import { getTime, getSeason } from './TimeSystem.js';
import { t as tI18n } from './i18n.js';

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
        if (roll < 42) return localize(WEATHER_TYPES.snow);
        if (roll < 72) return localize(WEATHER_TYPES.cloudy);
        return localize(WEATHER_TYPES.clear);
    }
    if (roll < 46) return localize(WEATHER_TYPES.clear);
    if (roll < 72) return localize(WEATHER_TYPES.cloudy);
    if (roll < 93) return localize(WEATHER_TYPES.rain);
    return localize(WEATHER_TYPES.storm);
}

// Имя погоды локализуется (i18n), id/icon остаются ключами.
// Внимание: параметр t здесь — timeState, функция t словаря импортирована как tI18n.
function localize(w) {
    return { ...w, name: tI18n(w.name) };
}

export function isRainy(w) {
    return !!w && (w.id === 'rain' || w.id === 'storm');
}

export function isPrecip(w) {
    return isRainy(w) || (!!w && w.id === 'snow');
}

// ============================================================
//  РАУНД 66.6: ПЛАВНЫЕ ПОГОДНЫЕ ПЕРЕХОДЫ
// ============================================================

/** День-ключ погоды: «год-месяц-день» (смена → crossfade). */
function weatherDayKey(registry) {
    const t = getTime(registry);
    if (!t) return null;
    return `${t.yearFromChrist}-${t.month}-${t.day}`;
}

/** Безопасно установить alpha частицам (ParticleEmitter — GameObject в 3.60+). */
function setEmitterAlpha(emitter, value) {
    try {
        if (emitter && typeof emitter.setAlpha === 'function') emitter.setAlpha(value);
    } catch (e) { /* старые версии Phaser — просто без fade осадков */ }
}

/**
 * Создать затемняющий прямоугольник погоды (MULTIPLY), плавно проявить.
 */
function makeTint(scene, weather, tintDepth, fadeIn) {
    const { width, height } = scene.scale;
    const color = weather.id === 'cloudy' ? 0x707a84 : 0x4a545e;
    const targetAlpha = weather.id === 'cloudy' ? 0.16 : (weather.id === 'snow' ? 0.20 : 0.30);
    const tint = scene.add.rectangle(0, 0, width, height, color, targetAlpha)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(tintDepth)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    if (fadeIn) {
        tint.alpha = 0;
        scene.tweens.add({ targets: tint, alpha: targetAlpha, duration: 2200, ease: 'Sine.easeOut' });
    }
    return tint;
}

/**
 * Создать осадки (дождь/снег) в экранных координатах, плавно проявить.
 * Возвращает { emitter, flash, flashEvents } (молнии — только гроза).
 */
function makePrecip(scene, weather, precipDepth, fadeIn) {
    const { width, height } = scene.scale;
    const out = { emitter: null, flash: null, flashEvents: [] };

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
        if (fadeIn) {
            setEmitterAlpha(out.emitter, 0);
            scene.tweens.add({ targets: out.emitter, alpha: 1, duration: 2200, ease: 'Sine.easeOut' });
        }

        if (heavy) {
            // Молния: короткая вспышка экрана по редкому расписанию.
            // Раунд 66.6: TimerEvents хранятся в списке flashEvents — при
            // crossfade старую грозу можно корректно снять (раньше
            // рекурсивный delayedCall жил вечно и бил по уничтоженной сцене).
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
            out.flash = flash;
            scheduleStrikes(scene, strike, out.flashEvents);
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
        if (fadeIn) {
            setEmitterAlpha(out.emitter, 0);
            scene.tweens.add({ targets: out.emitter, alpha: 1, duration: 2200, ease: 'Sine.easeOut' });
        }
    }

    return out;
}

/**
 * Рекурсивное расписание молний: каждое событие добавляет следующее в общий
 * список flashEvents — так crossfade/выключение сцены снимает всю цепочку.
 */
function scheduleStrikes(scene, strike, flashEvents) {
    let ev = null;
    ev = scene.time.addEvent({
        delay: Phaser.Math.Between(7000, 16000),
        loop: false,
        callback: () => {
            if (!scene.sys || !scene.sys.isActive()) return;
            strike();
            scheduleStrikes(scene, strike, flashEvents);
        },
    });
    flashEvents.push(ev);
}

/** Снять цепочку молний и вспышку (crossfade/выключение сцены). */
function disposeFlash(scene, wv) {
    if (!wv) return;
    (wv.flashEvents || []).forEach((ev) => {
        try { ev.remove(false); } catch (e) { /* ок */ }
    });
    wv.flashEvents = [];
    if (wv.flash) {
        try { wv.flash.destroy(); } catch (e) { /* ок */ }
        wv.flash = null;
    }
}

/** Плавно убрать старое затемнение/осадки и уничтожить их. */
function fadeOutWeatherView(scene, wv) {
    if (!wv) return;
    disposeFlash(scene, wv);
    if (wv.tint) {
        const tint = wv.tint;
        scene.tweens.add({
            targets: tint, alpha: 0, duration: 1600, ease: 'Sine.easeIn',
            onComplete: () => { try { tint.destroy(); } catch (e) { /* ок */ } },
        });
    }
    if (wv.emitter) {
        const emitter = wv.emitter;
        scene.tweens.add({
            targets: emitter, alpha: 0, duration: 1400, ease: 'Sine.easeIn',
            onComplete: () => {
                try { emitter.stop(); emitter.destroy(); } catch (e) { /* ок */ }
            },
        });
    }
}

/**
 * Построить погодный вид сцены заново (с fade-in).
 * @returns объект вида { weather, tint, emitter, flash, flashEvent, dayKey }
 */
function buildWeatherView(scene, depths, fadeIn) {
    const weather = getWeather(scene.registry);
    scene.weather = weather;
    const wv = { weather, tint: null, emitter: null, flash: null, flashEvents: [] };
    wv.dayKey = weatherDayKey(scene.registry);
    if (weather.id === 'cloudy' || isPrecip(weather)) {
        wv.tint = makeTint(scene, weather, depths.tintDepth, fadeIn);
    }
    if (isPrecip(weather)) {
        const p = makePrecip(scene, weather, depths.precipDepth, fadeIn);
        wv.emitter = p.emitter;
        wv.flash = p.flash;
        wv.flashEvents = p.flashEvents;
    }
    return wv;
}

/**
 * Плавно переключить сцену на погоду нового дня (crossfade без рестарта).
 */
function crossfadeWeather(scene, wv, depths) {
    fadeOutWeatherView(scene, wv);
    const next = buildWeatherView(scene, depths, true);
    // переносим накопленные поля в прежний объект (сцены держат ссылку на него)
    Object.keys(wv).forEach(k => delete wv[k]);
    Object.assign(wv, next);
    // тост о смене погоды — тихий, пергаментный (стиль колокольных плашек)
    try {
        const icon = wv.weather.icon || '';
        const name = wv.weather.name || '';
        showWeatherToast(scene, `${icon} ${tI18n('Погода меняется')}: ${name}`);
    } catch (e) { /* ок */ }
}

/** Пергаментная плашка смены погоды (в стиле колокольных тостов). */
let _weatherToast = null;
function showWeatherToast(scene, text) {
    if (!scene || !scene.add) return;
    const { width } = scene.scale;
    if (_weatherToast) {
        try { _weatherToast.forEach(o => o.destroy()); } catch (e) { /* ок */ }
        _weatherToast = null;
    }
    const y = 124; // ниже колокольной плашки (86), чтобы не мешали друг другу
    const w = Math.min(480, width - 40);
    const bg = scene.add.rectangle(width / 2, y, w, 30, 0x241B15, 0.9)
        .setStrokeStyle(1, 0x7d6a45).setScrollFactor(0).setDepth(151);
    const txt = scene.add.text(width / 2, y, text, {
        fontSize: '14px', color: '#CFC3A6',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(152);
    [bg, txt].forEach(o => o.setAlpha(0));
    scene.tweens.add({ targets: [bg, txt], alpha: 1, duration: 400 });
    scene.tweens.add({
        targets: [bg, txt], alpha: 0, delay: 3400, duration: 600,
        onComplete: () => { try { bg.destroy(); txt.destroy(); } catch (e) { /* ок */ } },
    });
    _weatherToast = [bg, txt];
}

/**
 * Применить погодную графику к сцене (вызывается один раз в create()).
 * РАУНД 66.6: эффекты проявляются ПЛАВНО и сцена сама следит за сменой дня —
 * при смене погоды выполняется crossfade (старое тает, новое проявляется).
 * Возвращает { weather, tint, emitter, flash, flashEvents } (живой объект:
 * поля обновляются при crossfade — можно читать scene.weather).
 * depth-соглашение: day/night overlay 95, HUD 100+ → затемнение 94, осадки 98.
 */
export function applyWeatherVisuals(scene, { tintDepth = 94, precipDepth = 98 } = {}) {
    const depths = { tintDepth, precipDepth };
    const wv = buildWeatherView(scene, depths, true);

    // Автомонитор смены дня: опрос раз в 4 реальные секунды. 1 игровой час =
    // 2 реальные минуты, значит в полдень сцена гарантированно увидит новую
    // дату в течение 4 с после её наступления.
    try {
        if (scene.time && typeof scene.time.addEvent === 'function') {
            scene.time.addEvent({
                delay: 4000, loop: true,
                callback: () => {
                    if (!scene.sys || !scene.sys.isActive()) return;
                    if (scene.busyDialog) return; // в диалоге погода «ждёт»
                    const key = weatherDayKey(scene.registry);
                    if (key && key !== wv.dayKey) crossfadeWeather(scene, wv, depths);
                },
            });
        }
    } catch (e) { /* headless-песочница: без монитора */ }

    // при закрытии сцены — снять цепочку молний (безопасность)
    if (scene.events && typeof scene.events.once === 'function') {
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => disposeFlash(scene, wv));
    }

    return wv;
}

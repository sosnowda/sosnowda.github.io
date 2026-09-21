// RiverAmbience.js — ШУМ РЕКИ И ОЗЕРА (раунд 66.6, приказ владельца:
// «звуки: …река»). Продолжение канона ChurchBells (раунд 34): звук
// синтезируется WebAudio на лету — ассеты не требуются, звук подчиняется
// громкости SFX из настроек (masterVolumeNode Phaser).
//
// Состав шума:
//   1) низкий гул потока — бурый (brown) шум через lowpass ~700 Гц,
//      громкость «дышит» медленным LFO (0.08 Гц ±18%);
//   2) «бурление» — тот же буфер через bandpass ~1900 Гц, редкие случайные
//      приливы (телеграфный шум 320–700 мс) — перекаты у камней;
//   3) мелкий плеск — второй bandpass ~3600 Гц, очень тихо, рыхлый фон.
//
// Громкость подключаемой локации: Река 0.9, Озеро 0.65, Мельница 0.45
// (водяное колесо стоит на реке). Внутри сцены — постоянный фон; при уходе
// со сцены — плавное затухание 0.6 с.

/** Буфер коричневого шума (2 с) — общий «материал» всех слоёв. */
function makeBrownNoiseBuffer(ctx) {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        // brown noise: интегрированный белый шум с мягким спадом
        last = (last + 0.02 * white) / 1.02;
        ch[i] = last * 3.2;
    }
    // сшить концы для бесшовного лупа (короткий кроссфейд 0.05 с)
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
        const k = i / fade;
        ch[i] = ch[i] * k + ch[len - fade + i] * (1 - k);
    }
    return buf;
}

/**
 * Подключить шум реки к сцене.
 * @param {Phaser.Scene} scene
 * @param {Object} opts
 *   - volume: множитель громкости 0..1 (0 → звук не создаётся вовсе)
 * @returns объект реки (для отладки) или null, если звук не нужен/недоступен
 */
export function attachRiverAmbience(scene, { volume = 0.8 } = {}) {
    if (volume <= 0) return null;
    const ctx = scene.sound && scene.sound.context;
    if (!ctx || scene.sound.locked) {
        // аудио ещё не разблокировано (нет первого клика) — тихо выходим;
        // шум реки — фон, не требующий разблокировки ценой ошибки
        return null;
    }

    const river = {
        scene, ctx, volume,
        master: null, layers: [], dead: false,
    };

    // Цепочка: master gain → masterVolumeNode Phaser (громкость SFX)
    river.master = ctx.createGain();
    river.master.gain.value = 0;
    river.master.connect(scene.sound.masterVolumeNode);

    const noiseBuf = makeBrownNoiseBuffer(ctx);

    // ----- слой 1: гул потока (lowpass) с медленным «дыханием» -----
    const layer1 = noiseLayer(ctx, noiseBuf, river.master, {
        type: 'lowpass', frequency: 700, Q: 0.4, gain: 0.5 * volume,
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18 * 0.5 * volume; // ±18% от слоя
    lfo.connect(lfoGain);
    lfoGain.connect(layer1.gain.gain);
    lfo.start();
    river.layers.push({ ...layer1, lfo });

    // ----- слой 2: «бурление» (bandpass 1900) с приливами -----
    const layer2 = noiseLayer(ctx, noiseBuf, river.master, {
        type: 'bandpass', frequency: 1900, Q: 0.8, gain: 0.16 * volume,
    });
    river.layers.push(layer2);

    // ----- слой 3: мелкий плеск (bandpass 3600, совсем тихо) -----
    const layer3 = noiseLayer(ctx, noiseBuf, river.master, {
        type: 'bandpass', frequency: 3600, Q: 0.6, gain: 0.07 * volume,
    });
    river.layers.push(layer3);

    // Плавный вход 1.2 с
    const now = ctx.currentTime;
    try {
        river.master.gain.setValueAtTime(0.0001, now);
        river.master.gain.linearRampToValueAtTime(1, now + 1.2);
    } catch (e) { /* ок */ }

    // Телеграфные приливы «бурления» + монитор мьюта SFX: такт 2 с
    scene.time.addEvent({
        delay: 2000, loop: true,
        callback: () => tickRiver(river),
    });
    tickRiver(river);

    // При уходе со сцены — плавное затухание и отвязка узлов
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        river.dead = true;
        try {
            const t0 = ctx.currentTime;
            river.master.gain.cancelScheduledValues(t0);
            river.master.gain.setValueAtTime(river.master.gain.value, t0);
            river.master.gain.linearRampToValueAtTime(0.0001, t0 + 0.6);
            setTimeout(() => {
                try { river.master.disconnect(); } catch (e) { /* ок */ }
            }, 800);
        } catch (e) { /* контекст уже мёртв */ }
    });

    return river;
}

/** Один слой шумового потока: буфер-луп → фильтр → gain → destino. */
function noiseLayer(ctx, noiseBuf, dest, { type, frequency, Q, gain }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter); filter.connect(g); g.connect(dest);
    src.start(0, Math.random() * 1.5); // рассинхрон слоёв
    return { src, filter, gain: g };
}

/** Такт 2 с: мьют SFX — тишина; иначе случайные приливы бурления. */
function tickRiver(river) {
    if (river.dead) return;
    const scene = river.scene;
    try {
        const muted = scene.registry && scene.registry.get('settings.audio.sfxMuted');
        const now = river.ctx.currentTime;
        if (muted) {
            river.master.gain.cancelScheduledValues(now);
            river.master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
            return;
        }
        if (river.master.gain.value < 0.5) {
            river.master.gain.cancelScheduledValues(now);
            river.master.gain.linearRampToValueAtTime(1, now + 0.8);
        }
        // прилив на слое бурления
        const burst = river.layers[1];
        if (burst && Math.random() < 0.65) {
            const g = burst.gain.gain;
            const base = 0.16 * river.volume;
            const peak = base * (1.6 + Math.random() * 1.4);
            const dur = 0.32 + Math.random() * 0.38;
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            g.linearRampToValueAtTime(peak, now + dur * 0.4);
            g.linearRampToValueAtTime(base, now + dur);
        }
    } catch (e) { /* контекст мёртв */ }
}

/**
 * ОДНОРАЗОВЫЙ ПЛЕСК ВОДЫ (рыбалка: заброс/улов, raунд 66.6).
 * Синтез: шумовой всплеск с падающим bandpass + низкий «бултых».
 * @param {Phaser.Scene} scene
 * @param {number} volume 0..1 (по умолчанию 0.7)
 */
export function playWaterSplash(scene, volume = 0.7) {
    try {
        const ctx = scene.sound && scene.sound.context;
        if (!ctx || scene.sound.locked) return;
        if (scene.registry && scene.registry.get('settings.audio.sfxMuted')) return;

        const master = ctx.createGain();
        master.gain.value = volume;
        master.connect(scene.sound.masterVolumeNode);
        const t0 = ctx.currentTime + 0.02;

        // всплеск: короткий белый шум, bandpass 1400→500 Гц
        const len = Math.floor(ctx.sampleRate * 0.45);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1400, t0);
        bp.frequency.exponentialRampToValueAtTime(500, t0 + 0.4);
        bp.Q.value = 0.9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.9, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
        src.connect(bp); bp.connect(g); g.connect(master);
        src.start(t0);

        // «бултых»: короткий тон 190→80 Гц
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(190, t0 + 0.04);
        osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.3);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.5, t0 + 0.04);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        osc.connect(og); og.connect(master);
        osc.start(t0 + 0.04);
        osc.stop(t0 + 0.35);

        setTimeout(() => { try { master.disconnect(); } catch (e) { /* ок */ } }, 900);
    } catch (e) { /* звук не критичен */ }
}

// Экспорт для юнит-тестов (без контекста — только таблица громкостей).
export const RIVER_VOLUME_BY_LOCATION = {
    river: 0.9,
    lake: 0.65,
    mill: 0.45,
};

// WeatherAudio.js — ПОГОДНЫЕ ЗВУКИ (раунд 66.7, приказ владельца:
// «погодные звуки (дождь/гром процедурно к новой погоде)»).
// Продолжение канона RiverAmbience/ChurchBells: звук синтезируется WebAudio
// на лету — ассеты не требуются, подчиняется громкости SFX (masterVolumeNode
// Phaser) и мьюту SFX из настроек.
//
// Состав:
//   1) ДОЖДЬ — петля: белый шум → highpass 1400 Гц («шипение капель») +
//      bandpass 450 Гц («гул водяной завесы»); в грозу плотнее и громче,
//      с редкими «приливами» ливня;
//   2) ГРОМ — одиночный удар: низкий раскат (brown noise → lowpass 90 Гц,
//      спад 2.4–3.6 с) + короткий «треск» (bandpass 900 Гц, 0.12 с);
//      вызывается синхронно со вспышкой молнии (Weather.js strike()).
//
// Снег беззвучен. Все входы/выходы плавные (ramp), при уходе со сцены
// звук снимается (Weather.js вызывает stopRainSound на SHUTDOWN).

/** Белый шум 2 с, сшитый для бесшовного лупа. */
function makeWhiteNoiseBuffer(ctx) {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
        const k = i / fade;
        ch[i] = ch[i] * k + ch[len - fade + i] * (1 - k);
    }
    return buf;
}

/** Буфер коричневого шума (для раскатов грома). */
function makeBrownNoiseBuffer(ctx) {
    const len = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        ch[i] = last * 3.2;
    }
    return buf;
}

/** Идёт ли дождевой loop в сцене. */
function rainHandle(scene) { return scene && scene.__rainAudio ? scene.__rainAudio : null; }

/**
 * Запустить петлю дождя (если ещё не запущена). Повторный вызов с другой
 * интенсивностью плавно перестраивает громкость/плотность.
 * @param {Phaser.Scene} scene
 * @param {boolean} heavy — гроза (ливень)
 */
export function startRainSound(scene, heavy = false) {
    try {
        const ctx = scene.sound && scene.sound.context;
        if (!ctx || scene.sound.locked) return;
        const existing = rainHandle(scene);
        if (existing) {
            // уже звучит — подстроить громкость под новую интенсивность
            const target = heavy ? 0.5 : 0.3;
            try {
                const now = ctx.currentTime;
                existing.master.gain.cancelScheduledValues(now);
                existing.master.gain.setValueAtTime(existing.master.gain.value, now);
                existing.master.gain.linearRampToValueAtTime(target, now + 1.4);
            } catch (e) { /* ок */ }
            existing.heavy = heavy;
            return;
        }

        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(scene.sound.masterVolumeNode);

        const noiseBuf = makeWhiteNoiseBuffer(ctx);

        // слой 1: шипение капель (highpass 1400)
        const hiss = ctx.createBufferSource();
        hiss.buffer = noiseBuf; hiss.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 1400;
        const hissGain = ctx.createGain();
        hissGain.gain.value = heavy ? 0.34 : 0.2;
        hiss.connect(hp); hp.connect(hissGain); hissGain.connect(master);
        hiss.start(0, Math.random());

        // слой 2: гул водяной завесы (bandpass 450)
        const roar = ctx.createBufferSource();
        roar.buffer = noiseBuf; roar.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.4;
        const roarGain = ctx.createGain();
        roarGain.gain.value = heavy ? 0.26 : 0.14;
        roar.connect(bp); bp.connect(roarGain); roarGain.connect(master);
        roar.start(0, Math.random());

        const handle = { scene, ctx, master, hiss, roar, hissGain, roarGain, heavy, dead: false };
        scene.__rainAudio = handle;

        // плавный вход 1.8 с (в такт fade-in осадков 2.2 с)
        const now = ctx.currentTime;
        master.gain.setValueAtTime(0.0001, now);
        master.gain.linearRampToValueAtTime(heavy ? 0.5 : 0.3, now + 1.8);

        // такт 3 с: мьют SFX → тишина; в грозу — редкие приливы ливня
        handle.tick = scene.time.addEvent({
            delay: 3000, loop: true,
            callback: () => tickRain(handle),
        });

        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopRainSound(scene, true));
    } catch (e) { /* аудио не критично */ }
}

/** Такт дождя: мьют + приливы ливня в грозу. */
function tickRain(handle) {
    if (handle.dead) return;
    try {
        const scene = handle.scene;
        const muted = scene.registry && scene.registry.get('settings.audio.sfxMuted');
        const now = handle.ctx.currentTime;
        if (muted) {
            handle.master.gain.cancelScheduledValues(now);
            handle.master.gain.linearRampToValueAtTime(0.0001, now + 0.5);
            return;
        }
        const base = handle.heavy ? 0.5 : 0.3;
        if (handle.master.gain.value < base * 0.6) {
            handle.master.gain.cancelScheduledValues(now);
            handle.master.gain.linearRampToValueAtTime(base, now + 1.0);
        }
        // прилив ливня в грозу
        if (handle.heavy && Math.random() < 0.5) {
            const g = handle.hissGain.gain;
            const peak = (handle.heavy ? 0.34 : 0.2) * (1.5 + Math.random());
            const dur = 0.8 + Math.random() * 1.4;
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            g.linearRampToValueAtTime(peak, now + dur * 0.4);
            g.linearRampToValueAtTime(handle.heavy ? 0.34 : 0.2, now + dur);
        }
    } catch (e) { /* контекст мёртв */ }
}

/**
 * Остановить петлю дождя (плавный выход 1.4 с).
 * @param {Phaser.Scene} scene
 * @param {boolean} immediate — при SHUTDOWN гасим быстрее и рвём сразу
 */
export function stopRainSound(scene, immediate = false) {
    const handle = rainHandle(scene);
    if (!handle || handle.dead) return;
    handle.dead = true;
    try {
        if (handle.tick) handle.tick.remove(false);
        const now = handle.ctx.currentTime;
        handle.master.gain.cancelScheduledValues(now);
        handle.master.gain.setValueAtTime(handle.master.gain.value, now);
        handle.master.gain.linearRampToValueAtTime(0.0001, now + (immediate ? 0.3 : 1.4));
        const delay = immediate ? 400 : 1600;
        setTimeout(() => {
            try { handle.hiss.stop(); } catch (e) { /* ок */ }
            try { handle.roar.stop(); } catch (e) { /* ок */ }
            try { handle.master.disconnect(); } catch (e) { /* ок */ }
        }, delay);
    } catch (e) { /* контекст уже мёртв */ }
    if (scene) scene.__rainAudio = null;
}

/**
 * ОДИНАЧНЫЙ УДАР ГРОМА (синхронно со вспышкой молнии).
 * Раскат: brown noise → lowpass 90 Гц с падающим срезом, спад 2.4–3.6 с;
 * треск: короткий bandpass-всплеск в первые 0.12 с.
 * @param {Phaser.Scene} scene
 * @param {number} volume 0..1 (по умолчанию 0.55)
 */
export function playThunder(scene, volume = 0.55) {
    try {
        const ctx = scene.sound && scene.sound.context;
        if (!ctx || scene.sound.locked) return;
        if (scene.registry && scene.registry.get('settings.audio.sfxMuted')) return;

        const master = ctx.createGain();
        master.gain.value = volume;
        master.connect(scene.sound.masterVolumeNode);
        const t0 = ctx.currentTime + 0.05;   // гром чуть отстаёт от вспышки

        // раскат
        const src = ctx.createBufferSource();
        src.buffer = makeBrownNoiseBuffer(ctx);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(140, t0);
        lp.frequency.exponentialRampToValueAtTime(55, t0 + 2.8);
        const g = ctx.createGain();
        const dur = 2.4 + Math.random() * 1.2;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(1.0, t0 + 0.09);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(lp); lp.connect(g); g.connect(master);
        src.start(t0); src.stop(t0 + dur + 0.1);

        // треск (сухой первый импульс)
        const crackLen = Math.floor(ctx.sampleRate * 0.14);
        const crackBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
        const ch = crackBuf.getChannelData(0);
        for (let i = 0; i < crackLen; i++) {
            ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 1.6);
        }
        const crack = ctx.createBufferSource();
        crack.buffer = crackBuf;
        const cbp = ctx.createBiquadFilter();
        cbp.type = 'bandpass'; cbp.frequency.value = 900; cbp.Q.value = 0.7;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.8, t0);
        cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        crack.connect(cbp); cbp.connect(cg); cg.connect(master);
        crack.start(t0);

        setTimeout(() => { try { master.disconnect(); } catch (e) { /* ок */ } }, (dur + 0.4) * 1000);
    } catch (e) { /* звук не критичен */ }
}

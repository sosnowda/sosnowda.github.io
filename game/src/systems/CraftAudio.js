// CraftAudio.js — ЗВУКИ РЕМЁСЕЛ (раунд 66.9, бэклог утраченного сеанса:
// «CraftSounds — молот/прялка/таверна»). Продолжение канона RiverAmbience
// (66.6) и WeatherAudio (66.7): звук синтезируется WebAudio на лету —
// ассеты не требуются, громкость подчиняется SFX-настройкам
// (scene.sound.masterVolumeNode), мьют SFX уважается в такте 2 с.
//
// Три «голоса ремёсел» (по интерьерам из data/interiors.js):
//   1) МОЛОТ — кузница (blacksmith): серии ударов по наковальне —
//      негармоничные металлические обертоны (~1.7/2.6/4.2 кГц, быстрый
//      экспоненциальный спад) + короткий шумовой «щелчок» удара; серия
//      из 3–6 ударов с интервалом 0.38–0.6 с, затем передышка 2.2–5.2 с;
//      изредка — «шип» закалки в бочке с водой (высокочастотный шум 0.9 с).
//      Пустая кузница (мастер и ученик погибли) МОЛЧИТ — громкость 0.
//   2) ПРЯЛКА — дом ткачихи (weaver_house) и дом вдовы Марфы
//      (villager_house_2, текстура int_deco_spinning): ровное жужжание
//      веретена (bandpass ~850 Гц с «дыханием» LFO) + ритмичные щелчки
//      колеса (~1.1 с: короткий bandpass-треск + низкий стук).
//   3) ТАВЕРНА — постоялый двор (tavern): гул голосов ПОВЕРХ трека
//      ambient_tavern.ogg (бурый шум band 420/750 Гц с медленными
//      приливами-репликами) + редкий деревянный стук кружки о стол.
//
// Все слои: master gain → masterVolumeNode; вход 1.2 с, уход со сцены —
// затухание 0.6 с (Phaser.Scenes.Events.SHUTDOWN); таймеры снимаются.

/** Буфер коричневого шума (2 с, бесшовный луп) — общий материал слоёв. */
function makeBrownNoiseBuffer(ctx) {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        ch[i] = last * 3.2;
    }
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
        const k = i / fade;
        ch[i] = ch[i] * k + ch[len - fade + i] * (1 - k);
    }
    return buf;
}

/** Один непрерывный шумовой слой: буфер-луп → фильтр → gain → dest. */
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

/**
 * ОДИН УДАР ПО НАКОВАЛЬНЕ: негармоничные обертоны + шумовой щелчок.
 * Синтез в момент вызова (ctx.currentTime) — узлы сами затухают.
 */
function playAnvilBlow(craft, volume) {
    const ctx = craft.ctx;
    const t0 = ctx.currentTime + 0.005;
    const detune = 0.94 + Math.random() * 0.12; // каждый удар чуть иной
    // обертоны наковальни (негармоничные — «сталь», не «колокол»)
    const partials = [
        { f: 1720 * detune, g: 0.5, d: 0.22 },
        { f: 2610 * detune, g: 0.32, d: 0.16 },
        { f: 4180 * detune, g: 0.18, d: 0.10 },
    ];
    for (const p of partials) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = p.f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(p.g * volume, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.d);
        osc.connect(g); g.connect(craft.master);
        osc.start(t0);
        osc.stop(t0 + p.d + 0.02);
    }
    // щелчок удара: короткий шумовой всплеск bandpass ~3 кГц
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7 * volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    src.connect(bp); bp.connect(g); g.connect(craft.master);
    src.start(t0);
}

/** ЗАКАЛКА: «шип» горячего железа в бочке с водой (0.9 с). */
function playQuenchHiss(craft, volume) {
    const ctx = craft.ctx;
    const t0 = ctx.currentTime + 0.01;
    const len = Math.floor(ctx.sampleRate * 0.9);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        const rise = Math.min(1, i / (ctx.sampleRate * 0.06));
        ch[i] = (Math.random() * 2 - 1) * rise * Math.pow(1 - i / len, 1.6);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    src.connect(hp); hp.connect(g); g.connect(craft.master);
    src.start(t0);
}

/** ЩЕЛЧОК КОЛЕСА ПРЯЛКИ за оборот (~1.1 с). */
function playWheelTick(craft, volume) {
    const ctx = craft.ctx;
    const t0 = ctx.currentTime + 0.002;
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1650; bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    src.connect(bp); bp.connect(g); g.connect(craft.master);
    src.start(t0);
    // деревянный низкий стук механизма
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, t0);
    osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.1 * volume, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(og); og.connect(craft.master);
    osc.start(t0);
    osc.stop(t0 + 0.1);
}

/** СТУК ДЕРЕВЯННОЙ КРУЖКИ О СТОЛ (таверна, редкий). */
function playMugClink(craft, volume) {
    const ctx = craft.ctx;
    const t0 = ctx.currentTime + 0.005;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t0);
    osc.frequency.exponentialRampToValueAtTime(170, t0 + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(g); g.connect(craft.master);
    osc.start(t0);
    osc.stop(t0 + 0.14);
}

/** Такт кузницы (120 мс): конечный автомат «серия ударов ↔ передышка». */
function tickAnvil(craft) {
    if (craft.dead) return;
    const now = craft.ctx.currentTime;
    if (craft.state === 'rest') {
        if (now >= craft.nextAt) {
            craft.state = 'hammer';
            craft.blowsLeft = 3 + Math.floor(Math.random() * 4);
            craft.nextAt = now;
        }
        return;
    }
    if (now >= craft.nextAt) {
        playAnvilBlow(craft, craft.volume);
        craft.blowsLeft--;
        craft.nextAt = now + 0.38 + Math.random() * 0.22;
        if (craft.blowsLeft <= 0) {
            craft.state = 'rest';
            craft.nextAt = now + 2.2 + Math.random() * 3.0;
            if (Math.random() < 0.3) playQuenchHiss(craft, craft.volume * 0.8);
        }
    }
}

/** Такт таверны (2 с): мьют SFX + приливы гула голосов + кружка. */
function tickTavern(craft) {
    if (craft.dead) return;
    const scene = craft.scene;
    try {
        const muted = scene.registry && scene.registry.get('settings.audio.sfxMuted');
        const now = craft.ctx.currentTime;
        if (muted) {
            craft.master.gain.cancelScheduledValues(now);
            craft.master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
            return;
        }
        if (craft.master.gain.value < 0.5) {
            craft.master.gain.cancelScheduledValues(now);
            craft.master.gain.linearRampToValueAtTime(1, now + 0.8);
        }
        // прилив-«реплика» на слое голосов
        const burst = craft.layers[0];
        if (burst && Math.random() < 0.6) {
            const g = burst.gain.gain;
            const base = 0.14 * craft.volume;
            const peak = base * (1.5 + Math.random() * 1.3);
            const dur = 0.7 + Math.random() * 0.9;
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            g.linearRampToValueAtTime(peak, now + dur * 0.45);
            g.linearRampToValueAtTime(base, now + dur);
        }
        if (Math.random() < 0.14) playMugClink(craft, craft.volume);
    } catch (e) { /* контекст мёртв */ }
}

/**
 * Громкости ремёсел по интерьерам (0..1): кузница громче всех,
 * прялка тише (женская работа у окна), таверна — фон поверх трека.
 * @type {Object<string, number>}
 */
export const CRAFT_VOLUME_BY_INTERIOR = {
    blacksmith: 0.5,
    weaver_house: 0.35,
    villager_house_2: 0.35,
    tavern: 0.3,
};

/**
 * Подключить звук ремесла к сцене интерьера.
 * @param {Phaser.Scene} scene сцена Interior
 * @param {string} interiorId id интерьера ('blacksmith'|'weaver_house'|
 *   'villager_house_2'|'tavern'); прочие — null (звука нет)
 * @param {Object} [opts] { volume } — переопределение громкости (0 = тихо)
 * @returns объект ремесла (для отладки) или null
 */
export function attachCraftAudio(scene, interiorId, { volume } = {}) {
    const vol = volume != null ? volume : CRAFT_VOLUME_BY_INTERIOR[interiorId] || 0;
    if (vol <= 0) return null;
    const ctx = scene.sound && scene.sound.context;
    if (!ctx || scene.sound.locked) return null; // аудио не разблокировано

    const craft = {
        scene, ctx, volume: vol, interiorId,
        master: null, layers: [], timers: [], dead: false,
        state: 'rest', blowsLeft: 0, nextAt: 0,
    };
    craft.master = ctx.createGain();
    craft.master.gain.value = 0;
    craft.master.connect(scene.sound.masterVolumeNode);

    const noiseBuf = makeBrownNoiseBuffer(ctx);
    const now0 = ctx.currentTime;

    if (interiorId === 'tavern') {
        // гул голосов: два band-слоя поверх ambient_tavern.ogg
        craft.layers.push(noiseLayer(ctx, noiseBuf, craft.master,
            { type: 'bandpass', frequency: 420, Q: 0.7, gain: 0.14 * vol }));
        craft.layers.push(noiseLayer(ctx, noiseBuf, craft.master,
            { type: 'bandpass', frequency: 750, Q: 0.5, gain: 0.08 * vol }));
        craft.timers.push(scene.time.addEvent({ delay: 2000, loop: true, callback: () => tickTavern(craft) }));
    } else if (interiorId === 'weaver_house' || interiorId === 'villager_house_2') {
        // жужжание веретена с «дыханием»
        const whirr = noiseLayer(ctx, noiseBuf, craft.master,
            { type: 'bandpass', frequency: 850, Q: 1.0, gain: 0.06 * vol });
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.02 * vol;
        lfo.connect(lfoGain);
        lfoGain.connect(whirr.gain.gain);
        lfo.start();
        craft.layers.push({ ...whirr, lfo });
        // щелчок колеса за оборот
        craft.timers.push(scene.time.addEvent({
            delay: 1100, loop: true,
            callback: () => {
                if (!craft.dead && !craft.scene.registry.get('settings.audio.sfxMuted')) {
                    playWheelTick(craft, craft.volume);
                }
            },
        }));
    } else if (interiorId === 'blacksmith') {
        // кузница: только ритм ударов (без непрерывного слоя — горн уже трещит)
        craft.state = 'rest';
        craft.nextAt = now0 + 0.8 + Math.random() * 1.5;
        craft.timers.push(scene.time.addEvent({ delay: 120, loop: true, callback: () => tickAnvil(craft) }));
    } else {
        try { craft.master.disconnect(); } catch (e) { /* ок */ }
        return null;
    }

    // плавный вход 1.2 с
    try {
        craft.master.gain.setValueAtTime(0.0001, now0);
        craft.master.gain.linearRampToValueAtTime(1, now0 + 1.2);
    } catch (e) { /* ок */ }

    // уход со сцены: затухание 0.6 с, снять таймеры, отвязать узлы
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        craft.dead = true;
        craft.timers.forEach(tm => { try { tm.remove(); } catch (e) { /* ок */ } });
        try {
            const t0 = ctx.currentTime;
            craft.master.gain.cancelScheduledValues(t0);
            craft.master.gain.setValueAtTime(craft.master.gain.value, t0);
            craft.master.gain.linearRampToValueAtTime(0.0001, t0 + 0.6);
            setTimeout(() => {
                try { craft.master.disconnect(); } catch (e) { /* ок */ }
            }, 800);
        } catch (e) { /* контекст уже мёртв */ }
    });

    return craft;
}

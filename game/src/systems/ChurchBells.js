// ChurchBells.js — КОЛОКОЛЬНЫЙ ЗВОН ПО СЛУЖБАМ (раунд 34, заявка владельца).
//
// В сельском приходе XV века день мерялся не только часами, но и колоколами:
// перед каждой службой звонили БЛАГОВЕСТ (редкие мерные удары в большой
// колокол — «благо весть»), а в начале службы — ТРЕЗВОН (весёлый частый звон
// во все колокола). Расписание увязано с народным счётом времени (RusTime):
//   заутреня  — благовест ~6:00, служба с 6:15 («заутреня отошла» к 9);
//   обедня    — благовест ~11:30, литургия с 12:00 (шестой час);
//   вечерня   — благовест ~14:30, служба с 15:00 (девятый час);
//               в СУББОТУ вечерня — ВСЕНОЩНОЕ БДЕНИЕ (трезвон длиннее);
//   повечерие — благовест ~17:30, служба с 18:00.
//
// Звук синтезируется WebAudio на лету (частичные тона настоящего колокола:
// hum 0.5×, prime 1×, терция 1.19×, квинта 1.5×, номинал 2×) — ассетов не
// требуется, звук подчиняется громкости SFX из настроек.
//
// Громкость зависит от УДАЛЁННОСТИ от храма — каждая сцена подключает звон
// со своим множителем (деревня 1.0, погост 0.85, интерьер 0.45 глухо,
// лес 0.3). В интерьере звук глохнет lowpass-фильтром.
//
// Одно и то же событие (благовест/трезвон службы) не проигрывается дважды
// за день: ключиPlayed хранятся в registry (переживают смену сцены).

import { t } from './i18n.js';

// Службы прихода (игровые часы; 1 игровой час = 2 реальные минуты)
export const SERVICES = [
    { id: 'utrenya',  name: 'заутреня', blagoAt: 6.0,  startAt: 6.25, vigil: false },
    { id: 'liturgy',  name: 'обедня',   blagoAt: 11.5, startAt: 12.0, vigil: false },
    { id: 'vespers',  name: 'вечерня',  blagoAt: 14.5, startAt: 15.0, vigil: 'saturday' },
    { id: 'compline', name: 'повечерие', blagoAt: 17.5, startAt: 18.0, vigil: false },
];

// Характеристики колоколов (prime-частота Гц): большой благовестный +
// три зазвонных для трезвона.
const BLAGO_BELL = 164; // «редкий» большой колокол (ми малой октавы)
const TREZVON_BELLS = [262, 330, 392]; // зазвонные: до-соль-соль верхней октавы

function dayKeyOf(time) {
    if (!time) return 0;
    return time.yearFromChrist * 372 + time.month * 31 + time.day;
}

/**
 * Подключить колокольный звон к сцене.
 * @param {Phaser.Scene} scene
 * @param {Object} opts
 *   - volume: множитель громкости 0..1 (удалённость от храма)
 *   - muffled: глушить ли звук lowpass-ом (интерьеры)
 */
export function attachChurchBells(scene, { volume = 0.6, muffled = false } = {}) {
    const ctx = scene.sound && scene.sound.context;
    if (!ctx) return null;

    const bells = {
        scene, ctx, volume, muffled,
        gain: null, filter: null, noiseBuf: null, dead: false,
    };

    // Цепочка: gain → [lowpass] → masterVolumeNode Phaser (громкость SFX)
    bells.gain = ctx.createGain();
    bells.gain.gain.value = 1;
    if (muffled) {
        bells.filter = ctx.createBiquadFilter();
        bells.filter.type = 'lowpass';
        bells.filter.frequency.value = 900; // «за стенами»
        bells.filter.Q.value = 0.6;
        bells.gain.connect(bells.filter);
        bells.filter.connect(scene.sound.masterVolumeNode);
    } else {
        bells.gain.connect(scene.sound.masterVolumeNode);
    }

    // Мини-буфер шума для «стука языка о медь» в начале удара
    const bufLen = Math.floor(ctx.sampleRate * 0.02);
    bells.noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = bells.noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
        ch[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    }

    // При уходе со сцены — плавно заглушить и отвязать узлы
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        bells.dead = true;
        try {
            const now = ctx.currentTime;
            bells.gain.gain.cancelScheduledValues(now);
            bells.gain.gain.setValueAtTime(bells.gain.gain.value, now);
            bells.gain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
            setTimeout(() => {
                try { bells.gain.disconnect(); bells.filter && bells.filter.disconnect(); } catch (e) { /* ок */ }
            }, 400);
        } catch (e) { /* контекст уже мёртв */ }
    });

    // Опрос игрового времени: каждые 2 реальные секунды (1 игровой час =
    // 2 реальным минутам; окно благовеста в пол-игрового часа живёт ~60 с)
    scene.time.addEvent({
        delay: 2000, loop: true,
        callback: () => checkServiceBells(bells),
    });
    // И сразу проверить (вход в сцену посреди благовеста/трезвона)
    checkServiceBells(bells);
    return bells;
}

/** Служба, попадающая в текущее окно (благовест/трезвон), или null. */
function serviceInWindow(hour, phase) {
    const h = ((hour % 24) + 24) % 24;
    for (const svc of SERVICES) {
        if (phase === 'blago' && h >= svc.blagoAt && h < svc.blagoAt + 0.5) return svc;
        if (phase === 'trezvon' && h >= svc.startAt && h < svc.startAt + 0.25) return svc;
    }
    return null;
}

function checkServiceBells(bells) {
    if (bells.dead) return;
    const scene = bells.scene;
    const registry = scene.registry;
    const time = registry.get('gameTime');
    if (!time) return;
    if (scene.sound.locked) return; // аудио ещё не разблокировано — пропускаем такт

    // Мьют SFX из настроек (громкость применяет masterVolumeNode Phaser)
    if (registry.get('settings.audio.sfxMuted')) return;

    const dk = dayKeyOf(time);
    // День недели: для субботы/недели — по календарной дате (JS-эпоха даёт
    // верный цикл 7 дней для любой даты), 0 = воскресенье
    let isSaturday = false, isSunday = false;
    try {
        const wd = new Date(time.yearFromChrist, time.month, time.day).getDay();
        isSunday = wd === 0;
        isSaturday = wd === 6;
    } catch (e) { /* при ошибке — будничный звон */ }

    const played = registry.get('bellsPlayed') || {};

    // ----- БЛАГОВЕСТ (редкие удары большого колокола за полчаса до службы) -----
    const blagoSvc = serviceInWindow(time.hour + time.minute / 60, 'blago');
    if (blagoSvc) {
        const key = `b:${dk}:${blagoSvc.id}`;
        if (played[key] !== true) {
            played[key] = true;
            registry.set('bellsPlayed', played);
            const name = (blagoSvc.vigil === 'saturday' && isSaturday) ? 'всенощное бдение' : blagoSvc.name;
            const toastKey = name === 'всенощное бдение'
                ? '🔔 Благовѣстъ къ всенощной…'
                : ({ 'заутреня': '🔔 Благовѣстъ къ заутрени…',
                     'обедня': '🔔 Благовѣстъ къ обеднѣ…',
                     'вечерня': '🔔 Благовѣстъ къ вечернѣ…',
                     'повечерие': '🔔 Благовѣстъ къ повечерію…' }[name] || '🔔 Благовѣстъ…');
            showBellToast(scene, t(toastKey));
            playBlagovest(bells, { slow: isSunday });
            return; // за один такт — одно событие
        }
    }

    // ----- ТРЕЗВОН (частый звон во все колокола — служба началась) -----
    const trSvc = serviceInWindow(time.hour + time.minute / 60, 'trezvon');
    if (trSvc) {
        const key = `t:${dk}:${trSvc.id}`;
        if (played[key] !== true) {
            played[key] = true;
            registry.set('bellsPlayed', played);
            const isVigil = (trSvc.vigil === 'saturday' && isSaturday);
            const toastKeyMap = {
                'заутреня': '🔔 Трезвонъ! В храмѣ — заутреня',
                'обедня': '🔔 Трезвонъ! В храмѣ — обедня',
                'вечерня': '🔔 Трезвонъ! В храмѣ — вечерня',
                'повечерие': '🔔 Трезвонъ! В храмѣ — повечерие',
                'всенощное бдение': '🔔 Трезвонъ! В храмѣ — всенощное бдение',
            };
            showBellToast(scene, t(toastKeyMap[isVigil ? 'всенощное бдение' : trSvc.name] || trSvc.name));
            // Неделя (воскресенье) и всенощная — трезвон торжественнее и длиннее
            const dur = (isSunday ? 1.5 : 1.0) * (isVigil ? 1.4 : 1.0);
            playTrezvon(bells, dur);
        }
    }
}

// ============================================================
//  СИНТЕЗ КОЛОКОЛА
// ============================================================

/**
 * Один удар колокола: частичные тона + шумовой «стук» языка.
 * @param {AudioContext} ctx
 * @param {AudioNode} dest — куда подключать
 * @param {number} when — время старта (ctx.currentTime-координата)
 * @param {number} prime — основная частота (Гц)
 * @param {number} vol — громкость 0..1
 */
function strikeBell(ctx, dest, noiseBuf, when, prime, vol) {
    // [соотношение к prime, громкость, длительность в секундах]
    const partials = [
        [0.5, 0.55, 2.6], [1.0, 1.0, 2.0], [1.19, 0.34, 1.2],
        [1.5, 0.22, 1.0], [2.0, 0.3, 0.75], [2.66, 0.12, 0.5], [3.36, 0.07, 0.35],
    ];
    // Чем больше колокол, тем дольше звучит
    const sizeK = 1.35 + 480 / prime;
    for (const [ratio, g, durBase] of partials) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = prime * ratio;
        const gn = ctx.createGain();
        const dur = Math.min(8, durBase * sizeK);
        gn.gain.setValueAtTime(0.0001, when);
        gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * g), when + 0.006);
        gn.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        osc.connect(gn);
        gn.connect(dest);
        osc.start(when);
        osc.stop(when + dur + 0.05);
    }
    // «Стук» языка — короткий щелчок шума
    if (noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = Math.min(4000, prime * 9);
        bp.Q.value = 1.2;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(vol * 0.4, when);
        gn.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
        src.connect(bp); bp.connect(gn); gn.connect(dest);
        src.start(when);
        src.stop(when + 0.06);
    }
}

/** БЛАГОВЕСТ: 5-6 мерных ударов в большой колокол, раз в ~3.8 с. */
function playBlagovest(bells, { slow = false } = {}) {
    const ctx = bells.ctx;
    const vol = 0.30 * bells.volume;
    const now = ctx.currentTime + 0.08;
    const gap = slow ? 4.6 : 3.8;
    const count = 5;
    for (let i = 0; i < count; i++) {
        strikeBell(ctx, bells.gain, bells.noiseBuf, now + i * gap, BLAGO_BELL, vol);
    }
}

/** ТРЕЗВОН: частый весёлый звон во все зазвонные колокола. */
function playTrezvon(bells, durMult = 1) {
    const ctx = bells.ctx;
    const vol = 0.22 * bells.volume;
    const now = ctx.currentTime + 0.08;
    const total = 11 * durMult; // секунд реального звона
    let at = now;
    let last = -1;
    while (at < now + total) {
        // зазвонные чередуются, но без строгой монотонности
        let idx = Math.floor(Math.random() * TREZVON_BELLS.length);
        if (idx === last) idx = (idx + 1) % TREZVON_BELLS.length;
        last = idx;
        const bell = TREZVON_BELLS[idx];
        strikeBell(ctx, bells.gain, bells.noiseBuf, at, bell, vol * (0.85 + Math.random() * 0.3));
        // иногда двойной удар «в подбас»
        if (Math.random() < 0.22) {
            strikeBell(ctx, bells.gain, bells.noiseBuf, at + 0.12,
                TREZVON_BELLS[(idx + 1) % TREZVON_BELLS.length], vol * 0.6);
        }
        at += 0.42 + Math.random() * 0.3;
    }
    // Финальный удар в большой благовестный
    strikeBell(ctx, bells.gain, bells.noiseBuf, at + 0.3, BLAGO_BELL, vol * 1.25);
}

// ============================================================
//  ПЛАШКА-УВЕДОМЛЕНИЕ «🔔 …»
// ============================================================

/**
 * Пергаментная строка сверху: «🔔 Благовѣстъ къ заутрени…».
 * Стиль — как панель летописи (тёмное дерево + золото).
 */
export function showBellToast(scene, text) {
    if (!scene || !scene.add) return;
    const { width } = scene.scale;
    // убрать предыдущую
    if (scene._bellToast) {
        try { scene._bellToast.forEach(o => o.destroy()); } catch (e) { /* ок */ }
        scene._bellToast = null;
    }
    const y = 86;
    const w = Math.min(560, width - 40);
    const bg = scene.add.rectangle(width / 2, y, w, 32, 0x241B15, 0.92)
        .setStrokeStyle(2, 0xC9A961).setScrollFactor(0).setDepth(151);
    const txt = scene.add.text(width / 2, y, text, {
        fontSize: '16px', color: '#E8DCC4', fontStyle: 'bold',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(152);

    [bg, txt].forEach(o => { o.setAlpha(0); });
    scene.tweens.add({ targets: [bg, txt], alpha: 1, duration: 350 });
    scene.tweens.add({
        targets: [bg, txt], alpha: 0, delay: 4200, duration: 600,
        onComplete: () => { try { bg.destroy(); txt.destroy(); } catch (e) { /* ок */ } },
    });
    scene._bellToast = [bg, txt];
}

// SkyClock.js — раунд 66.23 (приказ владельца): ВИЗУАЛЬНЫЕ ЧАСЫ
// РАССВЕТА/ЗАКАТА НА НЕБЕ ДЕРЕВНИ.
//
// Над деревней (верхний центр, между кнопками меню и планом) висит
// небесная полоска: солнце и луна идут по дуге по НАСТОЯЩЕМУ расписанию
// солнца (AccessHours.sunTimes по дате — 66.22). На рассвете диск встаёт
// у левого края горизонта, к полудню поднимается в зенит дуги (чем длиннее
// световой день — тем выше дуга), на закате уходит за горизонт справа;
// ночью тем же путём идёт луна. Полоска окрашивается фазой: заря / день /
// закат / ночь. При наведении — подсказка с временем рассвета, заката
// и длиной светового дня.
//
// Чистые функции (sunArcProgress/moonArcProgress/arcXY/skyPhaseInfo)
// без Phaser — покрываются юнит-тестом (test_round82).

import { sunTimes } from './AccessHours.js';
import { tf } from './i18n.js';

/**
 * Позиция солнца на дуге 0..1 (0 = встал на востоке, 1 = зашёл на западе)
 * или null, если солнце под горизонтом.
 */
export function sunArcProgress(h, sunrise, sunset) {
    if (!(sunset > sunrise)) return null;
    if (h < sunrise || h > sunset) return null;
    return (h - sunrise) / (sunset - sunrise);
}

/**
 * Позиция луны на дуге 0..1 (идёт от заката до рассвета) или null днём.
 */
export function moonArcProgress(h, sunrise, sunset) {
    const nightLen = 24 - (sunset - sunrise);
    if (h >= sunset) return (h - sunset) / nightLen;
    if (h < sunrise) return (h + 24 - sunset) / nightLen;
    return null;
}

/** Точка дуги: x 0..1 (слева направо), y 0..1 (высота над горизонтом). */
export function arcXY(p) {
    const c = Math.max(0, Math.min(1, p));
    return { x: c, y: Math.sin(c * Math.PI) };
}

/**
 * Полное состояние неба по игровому времени (чистая функция — для виджета
 * и тестов). Без даты — усреднённый канон 06:00/18:00.
 * @returns {{ sunrise, sunset, phase: 'dawn'|'day'|'dusk'|'night',
 *             sun: {x,y}|null, moon: {x,y}|null }}
 */
export function skyPhaseInfo(timeState) {
    const hasDate = timeState && Number.isFinite(timeState.month) && Number.isFinite(timeState.day);
    const st = hasDate ? sunTimes(timeState.month, timeState.day) : { sunrise: 6, sunset: 18 };
    // ВАЖНО: час 0 (полночь) — валиден; проверяем тип явно, не через ||
    const hh = (timeState && typeof timeState.hour === 'number') ? timeState.hour : 12;
    const mm = (timeState && typeof timeState.minute === 'number') ? timeState.minute : 0;
    const h = hh + mm / 60;
    const sp = sunArcProgress(h, st.sunrise, st.sunset);
    const mp = moonArcProgress(h, st.sunrise, st.sunset);
    let phase;
    if (sp !== null) phase = (sp < 0.12) ? 'dawn' : (sp > 0.88 ? 'dusk' : 'day');
    else phase = 'night';
    return {
        sunrise: st.sunrise,
        sunset: st.sunset,
        phase,
        sun: sp !== null ? arcXY(sp) : null,
        moon: mp !== null ? arcXY(mp) : null,
    };
}

/** «06:02» из дробных часов (для подписи виджета). */
export function formatHours(h) {
    const m = Math.round(((h % 24) + 24) % 24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Цвета полоски неба по фазам (тёплая пергаментная рамка вокруг — как у плана)
const SKY_BG = {
    night: 0x101a38,
    dawn: 0x9a5a30,
    day: 0x87a9cf,
    dusk: 0x7a3c22,
};

/** Процедурные текстуры дисков (создаются один раз на игру). */
function ensureDiscTextures(scene) {
    if (!scene.textures.exists('skyclock_sun')) {
        const tex = scene.textures.createCanvas('skyclock_sun', 26, 26);
        const c = tex.getContext();
        const g = c.createRadialGradient(13, 13, 2, 13, 13, 10);
        g.addColorStop(0, '#ffe9a0');
        g.addColorStop(0.55, '#ffd75e');
        g.addColorStop(1, '#ff9a2a');
        c.fillStyle = g;
        c.beginPath();
        c.arc(13, 13, 9, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,215,94,0.85)';
        c.lineWidth = 1.6;
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            c.beginPath();
            c.moveTo(13 + Math.cos(a) * 10.5, 13 + Math.sin(a) * 10.5);
            c.lineTo(13 + Math.cos(a) * 12.5, 13 + Math.sin(a) * 12.5);
            c.stroke();
        }
        tex.refresh();
    }
    if (!scene.textures.exists('skyclock_moon')) {
        const tex = scene.textures.createCanvas('skyclock_moon', 22, 22);
        const c = tex.getContext();
        c.fillStyle = '#e9e6da';
        c.beginPath();
        c.arc(11, 11, 8, 0, Math.PI * 2);
        c.fill();
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.arc(15, 8, 7, 0, Math.PI * 2);
        c.fill();
        c.globalCompositeOperation = 'source-over';
        tex.refresh();
    }
}

/**
 * Прикрепить небесные часы к сцене (деревня). Возвращает объект с
 * update(timeState) — вызывать из updateHUD (раз в секунду достаточно:
 * солнце проходит дугу за 7–18 игровых часов = 2–6 реальных минут).
 * @param {Phaser.Scene} scene
 * @param {{ depth?: number }} [opts]
 */
export function attachSkyClock(scene, opts = {}) {
    ensureDiscTextures(scene);
    const depth = opts.depth ?? 103;
    const W = 232, H = 54;
    const x = Math.round(scene.scale.width / 2 - W / 2);
    const y = 32;
    const gx = x + 8, gw = W - 16;          // рабочая зона дуги
    const hy = y + H - 12;                  // линия горизонта
    const arcH = H - 30;                    // высота зенита дуги

    const bg = scene.add.rectangle(x, y, W, H, SKY_BG.day, 0.88)
        .setOrigin(0).setStrokeStyle(2, 0xC9A961, 0.85)
        .setScrollFactor(0).setDepth(depth)
        .setInteractive({ useHandCursor: true });

    // Дуга пути светил + горизонт (статичная графика)
    const gfx = scene.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    gfx.lineStyle(1, 0xC9A961, 0.55);
    gfx.lineBetween(gx, hy, gx + gw, hy);
    gfx.fillStyle(0xE8DCC4, 0.22);
    for (let i = 0; i <= 24; i++) {
        const p = i / 24;
        const px = gx + p * gw;
        const py = hy - Math.sin(p * Math.PI) * arcH;
        gfx.fillCircle(px, py, 1);
    }

    const sun = scene.add.image(0, 0, 'skyclock_sun')
        .setScrollFactor(0).setDepth(depth + 2).setVisible(false);
    const moon = scene.add.image(0, 0, 'skyclock_moon')
        .setScrollFactor(0).setDepth(depth + 2).setVisible(false);

    const label = scene.add.text(x + 8, y + 5, '', {
        fontSize: '10px', color: '#E8DCC4', fontFamily: 'Georgia, serif',
        stroke: '#000', strokeThickness: 1,
    }).setScrollFactor(0).setDepth(depth + 3);

    // Подсказка при наведении (пергаментная, под виджетом).
    // Слушатели навешиваются ОДИН раз; текст строится по последнему
    // состоянию неба (lastInfo обновляется в update()).
    let tip = null;
    let lastInfo = null;
    const hideTip = () => { if (tip) { try { tip.forEach(o => o.destroy()); } catch (e) { /* ок */ } tip = null; } };
    const showTip = () => {
        if (!lastInfo) return;
        hideTip();
        const dayH = Math.floor(lastInfo.sunset - lastInfo.sunrise);
        const dayM = Math.round((lastInfo.sunset - lastInfo.sunrise - dayH) * 60);
        const text = tf('Рассвет ~ {0} · Закат ~ {1} · Световой день {2} ч {3} мин',
            formatHours(lastInfo.sunrise), formatHours(lastInfo.sunset), dayH, dayM);
        const ty = y + H + 9;
        const bgR = scene.add.rectangle(x + W / 2, ty, Math.max(220, text.length * 7 + 30), 24, 0x241B15, 0.92)
            .setStrokeStyle(1, 0x7d6a45).setScrollFactor(0).setDepth(depth + 4);
        const tx = scene.add.text(x + W / 2, ty, text, {
            fontSize: '12px', color: '#CFC3A6', fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 5);
        tip = [bgR, tx];
    };
    bg.on('pointerover', showTip);
    bg.on('pointerout', hideTip);
    bg.on('pointerup', hideTip);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, hideTip);

    const api = {
        _objs: [bg, gfx, sun, moon, label],
        update(timeState) {
            if (!timeState) return;
            const info = skyPhaseInfo(timeState);
            bg.setFillStyle(SKY_BG[info.phase] || SKY_BG.day, 0.88);
            if (info.sun) {
                sun.setVisible(true).setPosition(gx + info.sun.x * gw, hy - info.sun.y * arcH);
            } else {
                sun.setVisible(false);
            }
            if (info.moon) {
                moon.setVisible(true).setPosition(gx + info.moon.x * gw, hy - info.moon.y * arcH);
            } else {
                moon.setVisible(false);
            }
            label.setText(`↑ ${formatHours(info.sunrise)} · ↓ ${formatHours(info.sunset)}`);
            lastInfo = info;
            hideTip();
        },
    };
    api.update(scene.registry.get('gameTime'));
    return api;
}

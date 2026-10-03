// Phaser загружен глобально через CDN

/**
 * Патч 66.75 (приказы 5–6 владельца): ЕДИНАЯ ПАНЕЛЬ «⚙ НАСТРОЙКИ».
 *
 * Раньше панель настроек была только на титульном экране (TitleScene) —
 * во время игры выключить музыку/звуки было негде (ESC вёл в меню).
 * Теперь:
 *   - панель живёт ЗДЕСЬ и открывается из ЛЮБОЙ сцены (кнопка «⚙»
 *     в статус-баре: деревня, лес, пасека, локации, развилка, интерьеры);
 *   - тумблеры «🔊 Все звуки», «🎵 Музыка», «🔊 Эффекты (SFX)» пишут
 *     settings.audio.* в registry + localStorage ('gameSettings.audio');
 *     AudioManager каждой сцены слушает эти ключи — тишина наступает
 *     НЕМЕДЛЕННО и переживает перезапуск игры;
 *   - на титульном экране панель та же (плюс тумблер языка), отдельной
 *     копии кода больше нет (единый источник правды).
 *
 * Модуль самодостаточен: без импорта ui.js (чтобы ui.js мог импортировать
 * кнопку «⚙» без циклической зависимости), кнопки рисуются прямоугольниками.
 */

import { t, tf, getLang, setLang } from './i18n.js';
import { pauseWorldClock, resumeWorldClock } from './WorldClock.js';

// Диапазон глубин панели (закрытие чистит ТОЛЬКО его — не чужие оверлеи)
const D_OVERLAY = 250;
const D_PANEL = 251;
const D_WIDGET = 252;
const D_WIDGET_HI = 253;

/** Аудио-настройки: localStorage 'gameSettings.audio' (совместимо с SettingsManager). */
export function readAudioSettingsLocal() {
    const defaults = { musicMuted: false, sfxMuted: false, musicVolume: 0.7, sfxVolume: 0.8 };
    try {
        const raw = JSON.parse(localStorage.getItem('gameSettings') || '{}');
        if (raw && raw.audio) return { ...defaults, ...raw.audio };
    } catch (e) { /* noop */ }
    return defaults;
}

/**
 * Записать аудио-настройки: registry-ключи (их слушает AudioManager КАЖДОЙ
 * сцены — тишина/громкость применяются во всей игре немедленно) + localStorage.
 */
export function writeAudioSettingsLocal(scene, s) {
    if (scene && scene.registry) {
        scene.registry.set('settings.audio.musicMuted', !!s.musicMuted);
        scene.registry.set('settings.audio.sfxMuted', !!s.sfxMuted);
        scene.registry.set('settings.audio.musicVolume', typeof s.musicVolume === 'number' ? s.musicVolume : 0.7);
        scene.registry.set('settings.audio.sfxVolume', typeof s.sfxVolume === 'number' ? s.sfxVolume : 0.8);
    }
    try {
        const raw = JSON.parse(localStorage.getItem('gameSettings') || '{}');
        raw.audio = { ...(raw.audio || {}), ...s };
        localStorage.setItem('gameSettings', JSON.stringify(raw));
    } catch (e) { /* noop */ }
    // Немедленное применение ко ВСЕМ живым сценам (см. комментарий syncFromRegistry):
    // тишина/громкость наступают в тот же кадр, а не после пересоздания сцен.
    try {
        const scenes = (scene && scene.game && scene.game.scene) ? scene.game.scene.scenes : [];
        scenes.forEach((sc) => {
            try { if (sc && sc.audioManager && typeof sc.audioManager.syncFromRegistry === 'function') sc.audioManager.syncFromRegistry(); } catch (e) { /* noop */ }
        });
    } catch (e) { /* noop */ }
}

/** Закрыть панель (если открыта) — чистит свой диапазон глубин 250–255 и снимает блокировки. */
export function closeSettingsPanel(scene) {
    if (!scene || !scene.children) return;
    scene.children.list
        .filter(c => c.depth >= D_OVERLAY && c.depth <= 255)
        .forEach(c => c.destroy());
    // Снять блокировки открытой панели (см. openSettingsPanel)
    if (scene.__settingsPanelPrevBusy !== undefined) {
        scene.busyDialog = scene.__settingsPanelPrevBusy;
        delete scene.__settingsPanelPrevBusy;
    }
    try { if (scene.registry) resumeWorldClock(scene.registry); } catch (e) { /* noop */ }
}

/**
 * Открыть панель «⚙ Настройки» поверх текущей сцены.
 * opts.showLanguage  — добавить тумблер языка (титульный экран);
 * opts.onMusicToggle — колбэк (muted) для сцена-специфичных действий
 *                      (Title: стоп/старт меню-музыки).
 */
export function openSettingsPanel(scene, opts = {}) {
    if (!scene || !scene.add) return;
    const { width, height } = scene.scale;

    // Повторное открытие = перерисовка (закрыть прошлую инстанцию)
    closeSettingsPanel(scene);

    // Модальность: в деревне глобальный обработчик pointerdown ловит КЛИКИ ПО
    // ДОМАМ насквозь (scene-события не блокируются оверлеем Phaser) — гасим
    // через busyDialog; мировые часы на паузу, чтобы настройки «не стоили» времени.
    if ('busyDialog' in scene) {
        scene.__settingsPanelPrevBusy = !!scene.busyDialog;
        scene.busyDialog = true;
    }
    try { if (scene.registry) pauseWorldClock(scene.registry); } catch (e) { /* noop */ }

    const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85)
        .setOrigin(0).setInteractive().setDepth(D_OVERLAY);
    // Патч 66.75 (аудит размеров): на узких экранах панель и кнопки ужмются —
    // ничего не выходит за край (урок 66.73: высота по содержимому, ширина по экрану)
    const panelW = Math.min(500, width - 16);
    const btnW = Math.min(300, panelW - 40);
    const panelH = opts.showLanguage ? 350 : 300;
    scene.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
        .setStrokeStyle(3, 0xC9A961).setDepth(D_PANEL);

    scene.add.text(width / 2, height / 2 - panelH / 2 + 25, t('⚙ Настройки'), {
        fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
        fontFamily: 'Georgia, serif',
        stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D_WIDGET);

    const settings = readAudioSettingsLocal();
    const persist = () => writeAudioSettingsLocal(scene, settings);
    const redraw = () => openSettingsPanel(scene, opts);

    const onOff = (v) => t(v ? 'ВКЛ' : 'ВЫКЛ');
    const mkToggle = (y, label, cb) => {
        const bg = scene.add.rectangle(width / 2, y, btnW, 36, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setDepth(D_WIDGET);
        scene.add.text(width / 2, y, label, {
            fontSize: '14px', color: '#E8DCC4',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(D_WIDGET_HI);
        bg.on('pointerup', cb);
        bg.on('pointerover', () => bg.setFillStyle(0x5a4530, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x4a3520, 0.95));
    };

    const step = 50;
    let y = height / 2 - (opts.showLanguage ? 85 : 70);

    // 1. Все звуки (приказ 6): если что-то звучит — глушим ВСЁ; иначе включаем
    mkToggle(y, tf(t('🔊 Все звуки: {0}'), onOff(!settings.musicMuted || !settings.sfxMuted)), () => {
        const muteAll = !settings.musicMuted || !settings.sfxMuted;
        settings.musicMuted = muteAll;
        settings.sfxMuted = muteAll;
        persist(); redraw();
    });
    y += step;

    // 2. Музыка (приказ 5)
    mkToggle(y, tf(t('🎵 Музыка: {0}'), onOff(!settings.musicMuted)), () => {
        settings.musicMuted = !settings.musicMuted;
        persist();
        if (opts.onMusicToggle) opts.onMusicToggle(settings.musicMuted);
        redraw();
    });
    y += step;

    // 3. Звуковые эффекты (клики/шаги/урон/колокола — всё SFX)
    mkToggle(y, tf(t('🔊 Эффекты (SFX): {0}'), onOff(!settings.sfxMuted)), () => {
        settings.sfxMuted = !settings.sfxMuted;
        persist(); redraw();
    });
    y += step;

    // 4. Язык интерфейса — только на титульном экране (перезагрузка страницы)
    if (opts.showLanguage) {
        const other = getLang() === 'en' ? 'Русский' : 'English';
        const langLabel = tf('🌐 Язык: {0} → {1}', getLang() === 'en' ? 'English' : 'Русский', other);
        mkToggle(y, langLabel, () => {
            setLang(getLang() === 'en' ? 'ru' : 'en');
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('lang')) {
                    url.searchParams.delete('lang');
                    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
                }
            } catch (e) { /* noop */ }
            window.location.reload();
        });
    }

    // Кнопка закрытия
    const btnBg = scene.add.rectangle(width / 2, height / 2 + panelH / 2 - 30, 140, 35, 0x8B2C1A, 1)
        .setStrokeStyle(2, 0xC9A961)
        .setInteractive({ useHandCursor: true }).setDepth(D_WIDGET);
    scene.add.text(width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#E8DCC4',
    }).setOrigin(0.5).setDepth(D_WIDGET_HI);

    const closeSettings = () => closeSettingsPanel(scene);
    btnBg.on('pointerup', closeSettings);
    overlay.on('pointerup', closeSettings);
}

/**
 * Кнопка «⚙» в статус-баре сцены (приказы 5–6: настройки доступны В ИГРЕ).
 * Геометрия: узкая кнопка 36×20 между «📜 Персонаж» (width−220) и
 * «🎒 Инвентарь» (width−100); на узких экранах — левее одиночного «📜».
 */
export function addSettingsGearButton(scene, x, y) {
    if (!scene || !scene.add) return null;
    const btn = scene.add.rectangle(x, y, 36, 20, 0x4a3520, 0.95)
        .setStrokeStyle(1, 0xC9A961)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(101);
    const txt = scene.add.text(x, y, '⚙', {
        fontSize: '12px', color: '#E8DCC4', stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    btn.on('pointerup', () => openSettingsPanel(scene));
    btn.on('pointerover', () => btn.setFillStyle(0x5a4530, 1));
    btn.on('pointerout', () => btn.setFillStyle(0x4a3520, 0.95));
    scene.__sceneMenuButtons = scene.__sceneMenuButtons || [];
    scene.__sceneMenuButtons.push(btn, txt);
    return btn;
}

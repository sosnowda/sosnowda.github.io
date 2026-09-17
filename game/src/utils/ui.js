/**
 * Вспомогательные функции UI — ЧИСТЫЙ PHASER (без RexUI)
 *
 * История:
 *   Ранее модуль зависел от плагина Phaser3-Rex-Plugins (rexUI).
 *   Плагин был удалён из index.html, но функции всё ещё обращались к scene.rexUI,
 *   что приводило к падению VillageScene/CombatScene при открытии диалога.
 *   В этой версии все компоненты построены на нативных Phaser.GameObjects.
 *
 * Экспортируемые функции:
 *   - bindRegistryKeys
 *   - createButton
 *   - createDialog
 *   - createFloatingText
 *   - createScaledImage
 *   - createParticleExplosion
 *   - createStoryTextBox         (упрощённая реализация)
 *   - createScrollableList       (упрощённая реализация)
 */

import {
    COLORS,
    TYPOGRAPHY,
    BUTTON_STYLES,
    DIALOG_STYLES,
    STORY_TEXTBOX_STYLES,
    FLOATING_TEXT_STYLES,
    PARTICLE_STYLES,
    ROUND_RECTANGLE_DEFAULTS
} from '../config/StyleConfig.js';
// Раунд 31 (пп.11,12): пауза реального времени в диалогах + час за разговор
import { pauseWorldClock, resumeWorldClock, chargeTalkTime } from '../systems/WorldClock.js';
// Раунд 40: локализация подписей кнопок меню (addSceneMenuButtons)
import { t } from '../systems/i18n.js';

// ============================================================
// ВНУТРЕННИЕ ХЕЛПЕРЫ
// ============================================================

// ============================================================
// АДАПТИВНОСТЬ (раунд 20): полный ресайз окна.
// Phaser работает в Scale.RESIZE — канвас занимает ВСЁ окно,
// координаты сцены = CSS-пиксели окна (любое разрешение/ориентация).
// Все кнопки/диалоги, созданные через createButton/createDialog,
// регистрируются в реестре анкоров и сами переезжают при ресайзе:
//   • близко к центру X  → привязка к центру (с сохранением смещения)
//   • у левого/правого края → к краю
//   • верхняя треть по Y → к верху, нижняя — к низу, иначе — к середине.
// Дополнительно: bindRestartOnResize(scene) для меню-сцен (перезапуск
// с сохранением scene data после паузы), scene.__uiOnResize(fn) —
// произвольные обработчики (HUD, VirtualControls, фоны сцен).
// ============================================================
const ANCHORED_UI = new WeakMap(); // scene -> [{obj, ax, ay, dx, dy, stretch}]

function inferAnchor(x, y, w, h) {
    const ax = Math.abs(x - w / 2) < 10 ? 'center' : (x <= w * 0.3 ? 'left' : (x >= w * 0.7 ? 'right' : 'center'));
    const ay = y <= h * 0.33 ? 'top' : (y >= h * 0.67 ? 'bottom' : 'middle');
    const dx = ax === 'center' ? x - w / 2 : (ax === 'right' ? x - w : x);
    const dy = ay === 'top' ? y : (ay === 'bottom' ? y - h : y - h / 2);
    return { ax, ay, dx, dy };
}

function applyAnchor(e, w, h) {
    if (!e.obj || !e.obj.scene) return;
    if (e.stretch) {
        if (typeof e.obj.setSize === 'function') e.obj.setSize(w, h);
        return;
    }
    e.obj.x = e.ax === 'center' ? w / 2 + e.dx : (e.ax === 'right' ? w + e.dx : e.dx);
    e.obj.y = e.ay === 'top' ? e.dy : (e.ay === 'bottom' ? h + e.dy : h / 2 + e.dy);
}

/** Зарегистрировать объект UI для авто-перепозиционирования при ресайзе. */
export function registerAnchoredUI(scene, obj, x = obj.x, y = obj.y, opts = {}) {
    if (!scene || !scene.scale || !obj) return obj;
    let list = ANCHORED_UI.get(scene);
    if (!list) { list = []; ANCHORED_UI.set(scene, list); }
    if (!list.some(e => e.obj === obj)) {
        if (opts.stretch) {
            list.push({ obj, stretch: true });
        } else {
            list.push({ obj, ...inferAnchor(x, y, scene.scale.width, scene.scale.height) });
        }
    }
    ensureSceneResizeBinding(scene);
    return obj;
}

/** Ленивая привязка resize-обработчика сцены (один раз на сцену). */
export function ensureSceneResizeBinding(scene) {
    if (!scene || !scene.scale || scene.__uiResizeBound) return;
    scene.__uiResizeBound = true;
    const list = ANCHORED_UI.get(scene) || [];
    ANCHORED_UI.set(scene, list);

    let restartTimer = null;
    let lastW = scene.scale.width;
    let lastH = scene.scale.height;

    const onResize = (gameSize) => {
        const w = gameSize.width;
        const h = gameSize.height;
        for (let i = 0; i < list.length; i++) applyAnchor(list[i], w, h);
        if (Array.isArray(scene.__uiResizeHandlers)) {
            scene.__uiResizeHandlers.forEach((fn) => {
                try { fn(w, h); } catch (e) { console.warn('[ui] resize handler failed', e); }
            });
        }
        if (scene.__uiRestartOnResize) {
            clearTimeout(restartTimer);
            restartTimer = setTimeout(() => {
                if (!scene.scene || !scene.scene.isActive()) return;
                if (Math.abs(w - lastW) < 80 && Math.abs(h - lastH) < 80) return;
                lastW = w; lastH = h;
                scene.scene.restart((scene.scene.settings && scene.scene.settings.data) || {});
            }, 280);
        }
    };

    scene.scale.on('resize', onResize);
    scene.events.once('shutdown', () => {
        clearTimeout(restartTimer);
        try { scene.scale.off('resize', onResize); } catch (e) { /* noop */ }
        scene.__uiResizeBound = false;
        scene.__uiResizeHandlers = [];
        ANCHORED_UI.delete(scene);
    });
}

/** Меню-сцены: полный перезапуск сцены при существенном изменении окна. */
export function bindRestartOnResize(scene) {
    if (!scene || !scene.scale) return;
    scene.__uiRestartOnResize = true;
    ensureSceneResizeBinding(scene);
}

/** Произвольный обработчик ресайза сцены (HUD, фоны, контролы). */
export function onSceneResize(scene, fn) {
    if (!scene || typeof fn !== 'function') return;
    ensureSceneResizeBinding(scene);
    if (!Array.isArray(scene.__uiResizeHandlers)) scene.__uiResizeHandlers = [];
    scene.__uiResizeHandlers.push(fn);
}

// ============================================================
// Внутренние хелперы (рисование)
// ============================================================

/**
 * Создать скруглённый прямоугольник-фон на чистом Phaser.
 * Возвращает Phaser.GameObjects.Graphics, который можно перемещать/масштабировать.
 */
function createRoundRectangle(
    scene,
    color,
    radius = ROUND_RECTANGLE_DEFAULTS.cornerRadius,
    strokeColor = ROUND_RECTANGLE_DEFAULTS.strokeColor,
    strokeWidth = ROUND_RECTANGLE_DEFAULTS.strokeWidth
) {
    const { width, height } = ROUND_RECTANGLE_DEFAULTS.fallbackSize;
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeColor !== null && strokeWidth > 0) {
        g.lineStyle(strokeWidth, strokeColor, 1);
        g.strokeRoundedRect(0, 0, width, height, radius);
    }
    // Точка привязки — центр
    g.setOrigin(0.5);
    g.x = 0;
    g.y = 0;
    return g;
}

/**
 * Привязать событие changedata к scene.registry и автоматически отвязать при уничтожении target.
 */
export function bindRegistryKeys(scene, target, keys = [], onChange) {
    const registry = scene?.registry;
    const emitter = registry?.events;

    if (!emitter || !Array.isArray(keys) || keys.length === 0) {
        return () => {};
    }

    const handler = (...args) => {
        if (typeof onChange === 'function') {
            onChange(...args);
        }
    };

    const eventNames = keys.map((k) => `changedata-${k}`);
    eventNames.forEach((eventName) => emitter.on(eventName, handler));

    const cleanup = () => {
        eventNames.forEach((eventName) => emitter.off(eventName, handler));
    };

    if (target && typeof target.once === 'function') {
        target.once('destroy', cleanup);
    } else if (scene?.events && typeof scene.events.once === 'function') {
        scene.events.once('shutdown', cleanup);
    }

    return cleanup;
}

// ============================================================
// createButton — кнопка на чистом Phaser
// ============================================================

/**
 * Создать кнопку на чистом Phaser (без RexUI).
 *
 * Возвращает Phaser.GameObjects.Container, который содержит:
 *   - background (Rectangle или Graphics со скруглёнными углами)
 *   - text (Phaser.GameObjects.Text)
 *
 * Контейнер поддерживает:
 *   setInteractive / disableInteractive / setScale / setDepth / setVisible /
 *   setPosition / setX / setY / setOrigin / on / once / destroy /
 *   getElement('background'|'text') / layout / __uiResetVisual
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {Function} onClick
 * @param {Object} options
 * @returns {Phaser.GameObjects.Container}
 */
export function createButton(scene, x, y, text, onClick, options = {}) {
    const config = {
        fontSize: options.fontSize || BUTTON_STYLES.fontSize,
        textColor: options.textColor || TYPOGRAPHY.textColor.primary,
        icon: options.icon || null,

        backgroundImageKey: options.backgroundImageKey || null,
        backgroundImageFrame: options.backgroundImageFrame,
        backgroundImageTint: (typeof options.backgroundImageTint === 'number') ? options.backgroundImageTint : 0xffffff,
        hoverImageTint: (typeof options.hoverImageTint === 'number') ? options.hoverImageTint : null,
        pressImageTint: (typeof options.pressImageTint === 'number') ? options.pressImageTint : 0xdddddd,
        backgroundAlpha: (typeof options.backgroundAlpha === 'number') ? options.backgroundAlpha : 1,
        resizeBackgroundToLabel: options.resizeBackgroundToLabel !== false,

        textStrokeThickness: options.textStrokeThickness,
        textStrokeColor: options.textStrokeColor,
        textShadowColor: options.textShadowColor,
        textShadowOffsetX: Number.isFinite(options.textShadowOffsetX) ? options.textShadowOffsetX : 1,
        textShadowOffsetY: Number.isFinite(options.textShadowOffsetY) ? options.textShadowOffsetY : 1,
        textShadowBlur: Number.isFinite(options.textShadowBlur) ? options.textShadowBlur : 2,

        backgroundColor: options.backgroundColor || COLORS.primary,
        hoverColor: options.hoverColor || COLORS.light,
        pressColor: options.pressColor || COLORS.dark,

        cornerRadius: options.cornerRadius || BUTTON_STYLES.cornerRadius,
        padding: options.padding || BUTTON_STYLES.padding,
        autoPlayAnim: options.autoPlayAnim !== undefined ? options.autoPlayAnim : true,

        clickCooldown: options.clickCooldown !== undefined ? options.clickCooldown : 350,
        lockWhileReturnedAlive: options.lockWhileReturnedAlive !== undefined ? options.lockWhileReturnedAlive : true,

        ...options
    };

    const buttonText = config.icon ? `${config.icon} ${text}` : text;

    // Создаём текст — нужен, чтобы определить размер фоновой плашки
    const textObj = scene.add.text(0, 0, buttonText, {
        fontSize: `${config.fontSize}px`,
        color: config.textColor,
        fontFamily: TYPOGRAPHY.fontFamily.default,
        fontStyle: TYPOGRAPHY.fontWeight.bold
    }).setOrigin(0.5);

    if (typeof textObj.setStroke === 'function' && (config.textStrokeColor != null || Number.isFinite(config.textStrokeThickness))) {
        const strokeColor = (config.textStrokeColor != null) ? config.textStrokeColor : '#000000';
        const strokeThickness = Number.isFinite(config.textStrokeThickness) ? config.textStrokeThickness : 3;
        textObj.setStroke(strokeColor, strokeThickness);
    }
    if (typeof textObj.setShadow === 'function' && config.textShadowColor != null) {
        textObj.setShadow(
            config.textShadowOffsetX,
            config.textShadowOffsetY,
            config.textShadowColor,
            config.textShadowBlur,
            false,
            true
        );
    }

    // Вычисляем размеры фона по размеру текста + padding
    const pad = config.padding || { left: 0, right: 0, top: 0, bottom: 0 };
    const bgWidth = Math.max(8, textObj.width + (pad.left || 0) + (pad.right || 0));
    const bgHeight = Math.max(8, textObj.height + (pad.top || 0) + (pad.bottom || 0));

    // Контейнер: фоновый rectangle + текст. Origin — центр.
    const container = scene.add.container(x, y);
    container.setDepth(0);

    // Фон: либо image (если передан ключ), либо скруглённый rectangle
    let bgElement;
    if (config.backgroundImageKey) {
        bgElement = scene.add.image(0, 0, config.backgroundImageKey, config.backgroundImageFrame);
        if (config.resizeBackgroundToLabel && typeof bgElement.setDisplaySize === 'function') {
            bgElement.setDisplaySize(bgWidth, bgHeight);
        }
        if (typeof bgElement.setTint === 'function') {
            bgElement.setTint(config.backgroundImageTint);
        }
        if (typeof bgElement.setAlpha === 'function') {
            bgElement.setAlpha(config.backgroundAlpha);
        }
    } else {
        bgElement = scene.add.rectangle(0, 0, bgWidth, bgHeight, config.backgroundColor, 1);
        if (config.cornerRadius > 0) {
            // Если нужен скруглённый фон — рисуем graphics, заменяем rectangle
            bgElement.destroy();
            const g = scene.make.graphics({ add: false });
            g.fillStyle(config.backgroundColor, 1);
            g.fillRoundedRect(0, 0, bgWidth, bgHeight, config.cornerRadius);
            g.lineStyle(BUTTON_STYLES.strokeWidth, COLORS.white, 1);
            g.strokeRoundedRect(0, 0, bgWidth, bgHeight, config.cornerRadius);
            g.generateTexture(`__btn_bg_${bgWidth}x${bgHeight}_${config.backgroundColor}_${config.cornerRadius}`, bgWidth, bgHeight);
            g.destroy();
            bgElement = scene.add.image(0, 0, `__btn_bg_${bgWidth}x${bgHeight}_${config.backgroundColor}_${config.cornerRadius}`);
            bgElement.setOrigin(0.5);
        }
    }
    bgElement.setOrigin(0.5);
    container.add(bgElement);
    container.add(textObj);

    // Размеры контейнера для hit-area
    container.width = bgWidth;
    container.height = bgHeight;
    container.setSize(bgWidth, bgHeight);
    container.setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight),
        callback: Phaser.Geom.Rectangle.Contains
    });

    // ---- Состояния фона ----
    const setBgNormal = () => {
        if (!bgElement) return;
        if (typeof bgElement.setFillStyle === 'function') {
            bgElement.setFillStyle(config.backgroundColor, 1);
            return;
        }
        if (typeof bgElement.setTint === 'function') {
            bgElement.setTint(config.backgroundImageTint);
        }
        if (typeof bgElement.setAlpha === 'function') {
            bgElement.setAlpha(config.backgroundAlpha);
        }
    };
    const setBgHover = () => {
        if (!bgElement) return;
        if (typeof bgElement.setFillStyle === 'function') {
            bgElement.setFillStyle(config.hoverColor, 1);
            return;
        }
        if (typeof bgElement.setTint === 'function') {
            const tint = (typeof config.hoverImageTint === 'number') ? config.hoverImageTint : config.backgroundImageTint;
            bgElement.setTint(tint);
        }
    };
    const setBgPress = () => {
        if (!bgElement) return;
        if (typeof bgElement.setFillStyle === 'function') {
            bgElement.setFillStyle(config.pressColor, 1);
            return;
        }
        if (typeof bgElement.setTint === 'function') {
            bgElement.setTint(config.pressImageTint);
        }
    };

    const resetVisual = () => {
        if (!container || !container.scene) return;
        if (scene?.tweens && typeof scene.tweens.killTweensOf === 'function') {
            scene.tweens.killTweensOf(container);
        }
        setBgNormal();
        container.setScale(BUTTON_STYLES.normal.scale);
    };
    container.__uiResetVisual = resetVisual;

    // ---- Защита от многократного клика ----
    const clickCooldownMs = Math.max(0, Number(config.clickCooldown) || 0);
    let lastClickAt = -Infinity;
    let unlockTimer = null;

    const clearUnlockTimer = () => {
        if (unlockTimer && typeof unlockTimer.remove === 'function') {
            unlockTimer.remove(false);
        } else if (unlockTimer && scene?.time && typeof scene.time.removeEvent === 'function') {
            scene.time.removeEvent(unlockTimer);
        }
        unlockTimer = null;
    };

    const enableButtonInput = () => {
        if (!container || !container.scene) return;
        if (typeof container.setInteractive === 'function') {
            container.setInteractive({
                useHandCursor: true,
                hitArea: new Phaser.Geom.Rectangle(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight),
                callback: Phaser.Geom.Rectangle.Contains
            });
        }
    };
    const disableButtonInput = () => {
        if (!container || !container.scene) return;
        if (typeof container.disableInteractive === 'function') {
            container.disableInteractive();
        }
    };

    container.once('destroy', clearUnlockTimer);

    // ---- Hover / press / release ----
    container.on('pointerover', () => {
        setBgHover();
        scene.tweens.add({
            targets: container,
            scaleX: BUTTON_STYLES.hover.scale,
            scaleY: BUTTON_STYLES.hover.scale,
            duration: BUTTON_STYLES.hover.duration,
            ease: BUTTON_STYLES.hover.ease
        });
        if (scene.audioManager && typeof scene.audioManager.playButtonHover === 'function') {
            scene.audioManager.playButtonHover();
        }
    });

    container.on('pointerout', () => {
        setBgNormal();
        scene.tweens.add({
            targets: container,
            scaleX: BUTTON_STYLES.normal.scale,
            scaleY: BUTTON_STYLES.normal.scale,
            duration: BUTTON_STYLES.normal.duration,
            ease: BUTTON_STYLES.normal.ease
        });
    });

    container.on('pointerdown', () => {
        setBgPress();
        scene.tweens.add({
            targets: container,
            scaleX: BUTTON_STYLES.press.scale,
            scaleY: BUTTON_STYLES.press.scale,
            duration: BUTTON_STYLES.press.duration,
            ease: BUTTON_STYLES.press.ease
        });
    });

    container.on('pointerup', () => {
        const now = (scene?.time && typeof scene.time.now === 'number') ? scene.time.now : Date.now();

        if (clickCooldownMs > 0 && now - lastClickAt < clickCooldownMs) {
            resetVisual();
            return;
        }

        lastClickAt = now;
        clearUnlockTimer();
        disableButtonInput();

        if (scene?.tweens && typeof scene.tweens.killTweensOf === 'function') {
            scene.tweens.killTweensOf(container);
        }
        setBgNormal();

        scene.tweens.add({
            targets: container,
            scaleX: BUTTON_STYLES.release.scale,
            scaleY: BUTTON_STYLES.release.scale,
            duration: BUTTON_STYLES.release.duration,
            ease: BUTTON_STYLES.release.ease,
            onComplete: () => {
                resetVisual();

                let clickResult;
                try {
                    if (onClick && typeof onClick === 'function') {
                        clickResult = onClick();
                    }
                } finally {
                    if (
                        config.lockWhileReturnedAlive &&
                        clickResult &&
                        clickResult !== container &&
                        typeof clickResult.once === 'function'
                    ) {
                        clickResult.once('destroy', () => {
                            enableButtonInput();
                            resetVisual();
                        });
                        return;
                    }

                    if (clickCooldownMs > 0 && scene?.time && typeof scene.time.delayedCall === 'function') {
                        unlockTimer = scene.time.delayedCall(clickCooldownMs, () => {
                            enableButtonInput();
                            resetVisual();
                        });
                    } else {
                        enableButtonInput();
                        resetVisual();
                    }
                }
            }
        });

        if (scene.audioManager && typeof scene.audioManager.playButtonClick === 'function') {
            scene.audioManager.playButtonClick();
        }
    });

    // ---- Анимация появления ----
    if (config.autoPlayAnim) {
        container.setScale(0);
        scene.tweens.add({
            targets: container,
            scaleX: 1,
            scaleY: 1,
            duration: BUTTON_STYLES.entrance.duration,
            ease: BUTTON_STYLES.entrance.ease,
            delay: Math.random() * BUTTON_STYLES.entrance.maxDelay
        });
    }

    // ---- API совместимости с RexUI ----
    container.getElement = (key) => {
        if (key === 'background') return bgElement;
        if (key === 'text') return textObj;
        return null;
    };
    container.layout = () => container; // no-op для совместимости

    // Раунд 20: авто-анкор при ресайзе окна (Scale.RESIZE)
    registerAnchoredUI(scene, container, x, y);

    return container;
}

// ============================================================
// createDialog — модальное окно на чистом Phaser
// ============================================================

/**
 * Создать модальное диалоговое окно на чистом Phaser (без RexUI).
 *
 * Поддерживает:
 *   - портрет говорящего (options.portraitKey — ключ текстуры)
 *   - эффект печатной машинки (options.typing = true, options.typingSpeed = 30 мс/символ)
 *   - пергаментный фон (использует текстуру 'ui_panel_parchment' если доступна)
 *
 * @param {Phaser.Scene} scene
 * @param {string} title
 * @param {string} content — текст (поддерживает \n)
 * @param {Array} buttons — [{ text, callback?, closeDialog? }]
 * @param {Object} options
 *   - singleton: boolean (по умолчанию true)
 *   - singletonKey: string
 *   - closeOnBlocker: boolean (по умолчанию false — клик по подложке НЕ закрывает)
 *   - coverColor, coverAlpha
 *   - baseDepth
 *   - portraitKey: string — ключ текстуры портрета (например 'portrait_elder')
 *   - typing: boolean — включить эффект печатной машинки
 *   - typingSpeed: number — мс/символ (по умолчанию 30)
 * @returns {Phaser.GameObjects.Container}
 */
export function createDialog(scene, title, content, buttons = [], options = {}) {
    const opts = options || {};
    const singleton = opts.singleton !== false;
    const singletonKey = opts.singletonKey || `dialog:${title}`;
    const portraitKey = opts.portraitKey || null;
    const useTyping = !!opts.typing;
    const typingSpeed = Math.max(10, Number(opts.typingSpeed) || 30);

    // Фаза 1: живописный пергамент (DarklandsReborn) вместо плоской заливки +
    // лента-плашка под именем говорящего. Текст на тёмном пергаменте — светлый.
    const hasParchment = scene.textures.exists('ui_parchment_b') || scene.textures.exists('ui_parchment_a');
    const parchmentKey = scene.textures.exists('ui_parchment_b') ? 'ui_parchment_b' : 'ui_parchment_a';
    const hasRibbon = scene.textures.exists('ui_ribbon');
    const inkColor = hasParchment ? '#f8e9c8' : '#3a2818';
    const inkStroke = hasParchment ? '#1d1208' : '#c9a14a';

    const getSceneMaxDepth = () => {
        const list = scene?.children?.list || [];
        let max = 0;
        for (let i = 0; i < list.length; i++) {
            const go = list[i];
            if (!go) continue;
            const d = (typeof go.depth === 'number') ? go.depth : 0;
            if (d > max) max = d;
        }
        return max;
    };

    const depthPadding = Number.isFinite(opts.depthPadding) ? opts.depthPadding : 20;
    const baseDepth = Number.isFinite(opts.baseDepth)
        ? opts.baseDepth
        : Math.max(DIALOG_STYLES.depth.base, getSceneMaxDepth() + depthPadding);

    const coverDepth = baseDepth;
    const dialogDepth = baseDepth + 1;
    const buttonDepth = baseDepth + 2;

    const coverColor = (typeof opts.coverColor === 'number') ? opts.coverColor : DIALOG_STYLES.modal.coverColor;
    const coverAlpha = (typeof opts.coverAlpha === 'number') ? opts.coverAlpha : DIALOG_STYLES.modal.coverAlpha;
    const closeOnBlocker = opts.closeOnBlocker !== undefined ? !!opts.closeOnBlocker : false;

    const resetSceneButtonVisuals = () => {
        const list = scene?.children?.list || [];
        for (let i = 0; i < list.length; i++) {
            const go = list[i];
            if (go && typeof go.__uiResetVisual === 'function') {
                go.__uiResetVisual();
            }
            if (go && Array.isArray(go.list)) {
                for (let j = 0; j < go.list.length; j++) {
                    const child = go.list[j];
                    if (child && typeof child.__uiResetVisual === 'function') {
                        child.__uiResetVisual();
                    }
                }
            }
        }
    };

    if (singleton) {
        if (!scene.__uiSingletonDialogs) scene.__uiSingletonDialogs = new Map();
        const existing = scene.__uiSingletonDialogs.get(singletonKey);
        if (existing && existing.scene && existing.active !== false) {
            resetSceneButtonVisuals();
            if (typeof existing.setDepth === 'function') existing.setDepth(dialogDepth);
            if (typeof existing.setVisible === 'function') existing.setVisible(true);
            return existing;
        }
    }

    const cam = scene.cameras.main;
    const centerX = cam.centerX;
    const centerY = cam.centerY;

    // Подложка (блокер)
    const blocker = scene.add.rectangle(0, 0, cam.width, cam.height, coverColor, coverAlpha)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(coverDepth);
    blocker.setInteractive();

    // Контейнер диалога
    const dialog = scene.add.container(centerX, centerY);
    dialog.setDepth(dialogDepth);
    dialog.setScrollFactor(0);

    // Ширина диалога — увеличена, чтобы помещался портрет + текст
    // Раунд 20: на узких экранах диалог не шире окна (поля по 12px)
    const dialogWidth = Math.min(
        portraitKey ? 560 : DIALOG_STYLES.width,
        Math.max(240, cam.width - 24)
    );
    const pad = DIALOG_STYLES.padding;

    // Пергаментный фон — если доступна текстура 'ui_panel_parchment', используем её
    let panelBg;
    const hasParchmentTexture = scene.textures.exists('ui_panel_parchment');
    if (hasParchmentTexture) {
        // Используем 9-slice image — Phaser 3.88+ поддерживает через scene.add.nineslice
        // Но мы используем простой способ: рисуем Graphics + overlay с текстурой
        panelBg = scene.add.graphics();
    } else {
        panelBg = scene.add.graphics();
    }

    // Заголовок
    const titleText = scene.add.text(0, 0, title, {
        fontSize: '26px',
        fontStyle: 'bold',
        color: inkColor,
        fontFamily: 'Georgia, serif',
        stroke: inkStroke,
        strokeThickness: hasParchment ? 3 : 2,
    }).setOrigin(0.5, 0);

    // Контент (текст реплики)
    const contentStyle = {
        fontSize: '18px',
        color: inkColor,
        fontFamily: 'Georgia, serif',
        align: 'left',
        wordWrap: { width: portraitKey ? 380 : DIALOG_STYLES.content.wrapWidth }
    };
    if (hasParchment) {
        contentStyle.stroke = '#1d1208';
        contentStyle.strokeThickness = 2;
    }
    const contentText = scene.add.text(0, 0, content, contentStyle)
        .setOrigin(0, 0);  // выравнивание по левому краю — текст идёт справа от портрета

    // Портрет (если задан)
    let portraitImg = null;
    let portraitFrame = null;
    if (portraitKey && scene.textures.exists(portraitKey)) {
        // Рамка портрета — золотая
        portraitFrame = scene.add.graphics();
        portraitImg = scene.add.image(0, 0, portraitKey);
        portraitImg.setDisplaySize(96, 96);
    }

    // Фаза 1: живописный пергамент и лента-плашка имени (добавляются в контейнер ниже)
    let parchmentImg = null;
    if (hasParchment) {
        parchmentImg = scene.add.image(0, 0, parchmentKey);
        if (parchmentImg.setScrollFactor) parchmentImg.setScrollFactor(0);
    }
    let ribbonImg = null;
    if (hasRibbon) {
        ribbonImg = scene.add.image(0, 0, 'ui_ribbon');
        if (ribbonImg.setScrollFactor) ribbonImg.setScrollFactor(0);
    }

    // Кнопки
    const actionButtons = [];
    const actionContainers = buttons.map((btnConfig, index) => {
        const isPrimary = index === 0;
        const shouldCloseDialog = btnConfig.closeDialog !== false;

        const wrappedCallback = () => {
            // Если сейчас идёт эффект печатной машинки — пропускаем анимацию, не закрываем
            if (typingActive) {
                skipTyping();
                return;
            }
            if (btnConfig.callback && typeof btnConfig.callback === 'function') {
                btnConfig.callback(dialog);
            }
            if (shouldCloseDialog && dialog) {
                closeDialog();
            }
        };

        const btn = createButton(scene, 0, 0, `${index + 1}. ${btnConfig.text}`, wrappedCallback, {
            // Тёмно-красный/коричневый фон под пергамент
            backgroundColor: isPrimary ? 0x8B2C1A : 0x5a4030,
            hoverColor: isPrimary ? 0xB53925 : 0x6a5040,
            pressColor: isPrimary ? 0x6a1f12 : 0x4a3020,
            fontSize: DIALOG_STYLES.button.fontSize,
            cornerRadius: DIALOG_STYLES.button.cornerRadius,
            autoPlayAnim: false,
            clickCooldown: 0,
            textColor: '#f3e9d2',
        });
        btn.setDepth(buttonDepth);
        actionButtons.push(btn);
        return btn;
    });

    // Раунд 20: подложка и панель следуют за размером окна
    registerAnchoredUI(scene, blocker, 0, 0, { stretch: true });
    registerAnchoredUI(scene, dialog, centerX, centerY);
    onSceneResize(scene, (w, h) => {
        if (!dialog.scene) return;
        dialog.setPosition(w / 2, h / 2);
        layout();
    });

    if (parchmentImg) dialog.add(parchmentImg);
    if (ribbonImg) dialog.add(ribbonImg);
    dialog.add(titleText);
    dialog.add(contentText);
    if (portraitImg) dialog.add(portraitFrame);
    if (portraitImg) dialog.add(portraitImg);
    actionContainers.forEach((btn) => {
        // Раунд 12 ФИКС: кнопка наследует рендер от контейнера диалога
        // (scrollFactor 0), но её собственный scrollFactor оставался 1 —
        // хит-тест считал кнопку в мировых координатах, и при прокрученной
        // камере (деревня: игрок у пруда/костра) клики промахивались мимо
        // кнопок на величину скролла. Обнуляем — координаты совпадают.
        if (typeof btn.setScrollFactor === 'function') btn.setScrollFactor(0);
        dialog.add(btn);
    });

    // ----- Раскладка содержимого -----
    // Раунд 32: длинные диалоги (первый рассказ священника и т.п.) не должны
    // вылезать за пределы экрана. Сначала уменьшаем шрифт контента,
    // если панель выше 90% окна; если текст всё равно не помещается —
    // обрезаем маской и включаем прокрутку колесом мыши.
    let contentScrollY = 0;
    let contentMaskGfx = null;
    let wheelHandler = null;
    let layoutOverflow = 0;
    let layoutContentTop = 0;
    let maxContentHCache = 120;

    // ----- Раунд 39 (пп.2,12 заявки): ЧЕСТНАЯ РАСКЛАДКА КНОПОК ПО ШИРИНЕ -----
    // Раньше: perRow = n>3 ? 2 : n — 3 длинные кнопки (например меню отдыха
    // «Отдохнуть 1 час (4 д.) — лечение ~1/3») сжимались в один ряд,
    // НАКЛАДЫВАЛИСЬ друг на друга и вылезали за панель. Теперь кнопки
    // упаковываются в ряды по фактической ширине (жадная упаковка).
    const BTN_ROW_GAP = 12;
    const BTN_ROW_H = 50;
    const getBtnWidth = (btn) => {
        try {
            const bg = btn.getElement ? btn.getElement('background') : null;
            const w = bg ? (bg.width || 0) * Math.abs(bg.scaleX || 1) : 0;
            return (w > 10) ? w : 120;
        } catch (e) { return 120; }
    };
    const packButtonRows = () => {
        const n = actionContainers.length;
        if (n === 0) return [];
        const maxRowW = Math.max(180, dialogWidth - 40);
        const widths = actionContainers.map(getBtnWidth);
        const rows = [];
        let cur = [], curW = 0;
        widths.forEach((w, i) => {
            const addW = cur.length ? w + BTN_ROW_GAP : w;
            if (cur.length && curW + addW > maxRowW) {
                rows.push(cur);
                cur = [i];
                curW = w;
            } else {
                cur.push(i);
                curW += addW;
            }
        });
        if (cur.length) rows.push(cur);
        return rows;
    };

    const layout = () => {
        const titleH = titleText.height || 30;
        const availH = Math.max(280, cam.height * 0.9);

        // Подбор шрифта: 18 → 16 → 14 → 12, пока панель не влезет
        const computeTotal = () => {
            const contentH = contentText.height || 60;
            let th = pad.top + titleH + pad.title + contentH + pad.content;
            if (actionContainers.length > 0) {
                const rowsCount = packButtonRows().length;
                th += pad.action + 50 + (rowsCount - 1) * BTN_ROW_H;
            }
            th += pad.bottom;
            return th;
        };
        let fontPx = 18;
        contentText.setStyle({ ...contentStyle, fontSize: fontPx + 'px' });
        let naturalH = computeTotal();
        while (naturalH > availH && fontPx > 12) {
            fontPx -= 2;
            contentText.setStyle({ ...contentStyle, fontSize: fontPx + 'px' });
            naturalH = computeTotal();
        }
        // Панель не выше 90% экрана, даже если текст ещё не убрался
        const totalH = Math.min(naturalH, availH);
        const contentTop = -totalH / 2 + pad.top + titleH + pad.title;
        const btnRows = packButtonRows();
        const btnBlockH = actionContainers.length > 0
            ? pad.action + 50 + (btnRows.length - 1) * BTN_ROW_H
            : 0;
        const maxContentH = Math.max(60,
            totalH - (pad.top + titleH + pad.title) - (pad.content + pad.bottom + btnBlockH));

        // Маска + колесо прокрутки, если контент выше отведённой области.
        // Саму маску создаём В КОНЦЕ layout() — когда contentText.x уже
        // выставлен (см. конец функции); здесь только считаем overflow.
        const overflow = Math.max(0, (contentText.height || 0) - maxContentH);
        if (wheelHandler) { scene.input.removeListener('wheel', wheelHandler); wheelHandler = null; }
        layoutOverflow = overflow;
        layoutContentTop = contentTop;
        maxContentHCache = maxContentH;
        contentScrollY = overflow > 2 ? Phaser.Math.Clamp(contentScrollY, 0, overflow) : 0;

        const contentH = contentText.height || 60;

        // Пергаментный фон панели
        panelBg.clear();
        if (hasParchment && parchmentImg) {
            // Фаза 1: живописный пергамент под размер панели (с запасом на «тёмные» края текстуры)
            parchmentImg.setDisplaySize(dialogWidth + 36, totalH + 32);
            // Graphics остаётся только тонкой тёмной рамкой поверх пергамента
            panelBg.lineStyle(2, 0x120a05, 0.9);
            panelBg.strokeRoundedRect(-dialogWidth / 2 - 15, -totalH / 2 - 14, dialogWidth + 30, totalH + 28, DIALOG_STYLES.cornerRadius);
        } else {
            // Основная заливка пергамента
            panelBg.fillStyle(0xe8d7a8, 1);
            panelBg.fillRoundedRect(-dialogWidth / 2, -totalH / 2, dialogWidth, totalH, DIALOG_STYLES.cornerRadius);
            // Тёмная золотая окантовка
            panelBg.lineStyle(3, 0x8c6a30, 1);
            panelBg.strokeRoundedRect(-dialogWidth / 2, -totalH / 2, dialogWidth, totalH, DIALOG_STYLES.cornerRadius);
            // Внутренняя тонкая окантовка
            panelBg.lineStyle(1, 0xc9a14a, 1);
            panelBg.strokeRoundedRect(-dialogWidth / 2 + 4, -totalH / 2 + 4, dialogWidth - 8, totalH - 8, DIALOG_STYLES.cornerRadius - 2);
        }
        panelBg.setDepth(dialogDepth - 1);
        dialog.panelHeight = totalH;

        // Заголовок — сверху по центру
        titleText.setPosition(0, -totalH / 2 + pad.top);

        // Фаза 1: плашка имени — золотая лента под заголовком,
        // чуть выступает за верхний край панели
        if (ribbonImg) {
            const ribW = Math.min(Math.max(titleText.width + 120, 260), dialogWidth - 30);
            const ribH = ribW * (143 / 530);
            const ribCY = -totalH / 2 + ribH * 0.46;
            ribbonImg.setDisplaySize(ribW, ribH);
            ribbonImg.setPosition(0, ribCY);
            titleText.setPosition(0, ribCY - titleText.height / 2);
        }

        // Портрет — слева сверху (после заголовка)
        // (contentTop вычислен выше — с учётом маски и прокрутки, раунд 32)
        if (portraitImg) {
            const px = -dialogWidth / 2 + pad.left + 48;
            const py = contentTop + 48;
            portraitImg.setPosition(px, py);
            // Рамка портрета
            portraitFrame.clear();
            portraitFrame.fillStyle(0x8c6a30, 1);
            portraitFrame.fillRoundedRect(px - 50, py - 50, 100, 100, 6);
            portraitFrame.lineStyle(2, 0xc9a14a, 1);
            portraitFrame.strokeRoundedRect(px - 50, py - 50, 100, 100, 6);
            portraitFrame.setDepth(dialogDepth);

            // Контент — правее портрета
            const contentX = -dialogWidth / 2 + pad.left + 110;
            contentText.setPosition(contentX, contentTop - contentScrollY);
        } else {
            // Без портрета — контент по центру
            contentText.setPosition(-contentText.width / 2, contentTop - contentScrollY);
        }

        // Кнопки — внизу; ряды упакованы по фактической ширине кнопок
        // (раунд 39: без наложений и выхода за панель при любых подписях)
        if (btnRows.length > 0) {
            const rowH = BTN_ROW_H;
            const btnYBase = totalH / 2 - pad.bottom - 25 - (btnRows.length - 1) * rowH / 2;
            btnRows.forEach((rowIdxs, r) => {
                const y = btnYBase + r * rowH;
                const rowW = rowIdxs.reduce((s, bi) => s + getBtnWidth(actionContainers[bi]), 0)
                    + (rowIdxs.length - 1) * BTN_ROW_GAP;
                let x = -rowW / 2;
                rowIdxs.forEach((bi) => {
                    const btn = actionContainers[bi];
                    const w = getBtnWidth(btn);
                    btn.setPosition(x + w / 2, y);
                    x += w + BTN_ROW_GAP;
                });
            });
        }

        // ----- Раунд 32: маска длинного текста (в МИРОВЫХ координатах —
        // geometry-маска не знает о контейнере dialog) + колесо прокрутки -----
        if (contentMaskGfx) { contentMaskGfx.destroy(); contentMaskGfx = null; }
        contentText.clearMask();
        if (layoutOverflow > 2) {
            const cX = contentText.x;
            const cW = (contentStyle.wordWrap && contentStyle.wordWrap.width) || dialogWidth - pad.left - 110;
            const wx = dialog.x + cX - 4;
            const wy = dialog.y + layoutContentTop - 6;
            contentMaskGfx = scene.make.graphics({ add: false });
            contentMaskGfx.fillRect(wx, wy, cW + 14, maxContentHCache + 14);
            contentText.setMask(contentMaskGfx.createGeometryMask());
            if (!wheelHandler) {
                wheelHandler = (pointer, over, dx, dy) => {
                    if (!dialog.scene) return;
                    contentScrollY = Phaser.Math.Clamp(contentScrollY + dy, 0, layoutOverflow);
                    contentText.y = layoutContentTop - contentScrollY;
                };
                scene.input.on('wheel', wheelHandler);
            }
        }
        contentText.y = layoutContentTop - contentScrollY;
    };

    panelBg.setDepth(dialogDepth - 1);
    panelBg.setScrollFactor(0);
    // Фаза 1: при живописном пергаменте graphics-рамка должна быть НАД ним,
    // иначе addAt(0) прячет рамку под текстурой
    dialog.addAt(panelBg, parchmentImg ? 1 : 0);

    layout();

    // ----- Эффект печатной машинки -----
    let typingActive = false;
    let typeIndex = 0;
    let typeTimer = null;
    const fullContent = content;

    const skipTyping = () => {
        if (typeTimer) {
            typeTimer.remove();
            typeTimer = null;
        }
        typingActive = false;
        contentText.setText(fullContent);
        layout();
    };

    const startTyping = () => {
        typingActive = true;
        typeIndex = 0;
        contentText.setText('');
        typeTimer = scene.time.addEvent({
            delay: typingSpeed,
            callback: () => {
                if (typeIndex >= fullContent.length) {
                    typeTimer.remove();
                    typeTimer = null;
                    typingActive = false;
                    return;
                }
                typeIndex++;
                contentText.setText(fullContent.substring(0, typeIndex));
                // Звук печатной машинки — если AudioManager поддерживает
                if (scene.audioManager && typeof scene.audioManager.playTypewriter === 'function' && typeIndex % 3 === 0) {
                    scene.audioManager.playTypewriter();
                }
            },
            loop: true,
        });
    };

    // Клик по подложке во время печати — пропускает анимацию
    blocker.on('pointerup', () => {
        if (typingActive) {
            skipTyping();
        }
    });

    // ----- Закрытие диалога -----
    let isClosing = false;
    const closeDialog = () => {
        if (isClosing) return;
        isClosing = true;
        if (typeTimer) typeTimer.remove();
        // Раунд 32: убрать колесо прокрутки и маску длинного текста
        if (wheelHandler) { scene.input.removeListener('wheel', wheelHandler); wheelHandler = null; }
        if (contentMaskGfx) { contentMaskGfx.destroy(); contentMaskGfx = null; }

        actionButtons.forEach((btn) => {
            if (typeof btn.disableInteractive === 'function') btn.disableInteractive();
            if (scene?.tweens && typeof scene.tweens.killTweensOf === 'function') {
                scene.tweens.killTweensOf(btn);
            }
            btn.setScale(1);
        });

        scene.tweens.add({
            targets: dialog,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: DIALOG_STYLES.modal.durationOut,
            ease: DIALOG_STYLES.animation.transitOutEase,
            onComplete: () => {
                if (blocker && blocker.scene) blocker.destroy();
                dialog.destroy();
            }
        });

        scene.tweens.add({
            targets: blocker,
            alpha: 0,
            duration: DIALOG_STYLES.modal.durationOut,
            onComplete: () => {
                if (blocker && blocker.scene) blocker.destroy();
            }
        });
    };

    if (closeOnBlocker && !useTyping) {
        blocker.on('pointerup', () => closeDialog());
    }

    // ----- API -----
    dialog.active = true;
    dialog.__uiModalBlocker = blocker;
    dialog.closeDialog = closeDialog;
    dialog.modalClose = closeDialog;
    dialog.setContentText = (text) => {
        contentText.setText(text);
        layout();
    };
    dialog.layout = layout;
    dialog.getElement = (key) => {
        if (key === 'title') return titleText;
        if (key === 'content') return contentText;
        if (key === 'actions') return actionContainers;
        if (key === 'background') return panelBg;
        if (key === 'portrait') return portraitImg;
        return null;
    };

    if (singleton) {
        scene.__uiSingletonDialogs.set(singletonKey, dialog);
        dialog.once('destroy', () => {
            if (scene.__uiSingletonDialogs) {
                scene.__uiSingletonDialogs.delete(singletonKey);
            }
        });
    }

    // Анимация появления
    resetSceneButtonVisuals();
    dialog.setScale(0.1);
    dialog.setAlpha(0);
    blocker.setAlpha(0);
    scene.tweens.add({
        targets: dialog,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: DIALOG_STYLES.modal.durationIn,
        ease: DIALOG_STYLES.animation.transitInEase,
        onComplete: () => {
            // Запускаем печатную машинку после появления
            if (useTyping) startTyping();
        }
    });
    scene.tweens.add({
        targets: blocker,
        alpha: coverAlpha,
        duration: DIALOG_STYLES.modal.durationIn
    });

    // ----- Раунд 31 (пп.11,12): мировые часы и разговоры -----
    // Пока открыт ЛЮБОЙ диалог — отсчёт реального времени стоит (п.12).
    // Если это разговор с НПЦ (opts.talkMinutes > 0), при закрытии беседы
    // списывается ровно 1 час (п.11). talkKey объединяет поп-апы одной
    // беседы (приветствие → результат расспроса), чтобы час был один.
    const clockPauses = opts.pauseClock !== false;
    if (clockPauses) pauseWorldClock(scene.registry);
    dialog.once('destroy', () => {
        if (clockPauses) resumeWorldClock(scene.registry);
        if (opts.talkMinutes > 0) {
            chargeTalkTime(scene.registry, opts.talkMinutes, opts.talkKey || title);
        }
        // Раунд 35 (QA-фикс P1): блокировщик живёт в сцене ОТДЕЛЬНО от контейнера
        // диалога. Раньше его удалял только onComplete твины closeDialog — но
        // DialogueRunner при смене узла и при финале делает _currentDialog.destroy()
        // напрямую, и полноэкранный чёрный прямоугольник (alpha ~0.7, интерактивный)
        // оставался висеть: экран кумулятивно темнел, а клики по сцене съедались.
        // Теперь блокировщик гарантированно умирает вместе с диалогом.
        if (blocker && blocker.scene) blocker.destroy();
    });

    return dialog;
}

// ============================================================
// createParticleExplosion — взрыв частиц (без изменений)
// ============================================================

/**
 * Создать эффект взрыва частиц
 */
export function createParticleExplosion(scene, x, y, texture = 'particle', count = 20) {
    const emitter = scene.add.particles(x, y, texture, {
        speed: PARTICLE_STYLES.speed,
        angle: PARTICLE_STYLES.angle,
        scale: PARTICLE_STYLES.scale,
        lifespan: PARTICLE_STYLES.lifespan,
        blendMode: PARTICLE_STYLES.blendMode,
        tint: PARTICLE_STYLES.tint
    });

    if (emitter && typeof emitter.explode === 'function') {
        emitter.explode(count);
    }

    scene.time.delayedCall(PARTICLE_STYLES.destroyDelay, () => {
        if (emitter && typeof emitter.destroy === 'function') {
            emitter.destroy();
        }
    });

    return emitter;
}

// ============================================================
// createFloatingText — всплывающий текст (без изменений)
// ============================================================

/**
 * Создать всплывающий текст (число урона/подсказка очков)
 */
export function createFloatingText(scene, x, y, text, color = TYPOGRAPHY.textColor.primary) {
    const floatText = scene.add.text(x, y, text, {
        fontFamily: TYPOGRAPHY.fontFamily.pixel,
        fontSize: FLOATING_TEXT_STYLES.fontSize,
        color: color,
        stroke: FLOATING_TEXT_STYLES.strokeColor,
        strokeThickness: FLOATING_TEXT_STYLES.strokeThickness
    }).setOrigin(0.5);

    scene.tweens.add({
        targets: floatText,
        y: y + FLOATING_TEXT_STYLES.animation.offsetY,
        alpha: 0,
        duration: FLOATING_TEXT_STYLES.animation.duration,
        ease: FLOATING_TEXT_STYLES.animation.ease,
        onComplete: () => {
            if (floatText && typeof floatText.destroy === 'function') {
                floatText.destroy();
            }
        }
    });

    return floatText;
}

// ============================================================
// createScaledImage — изображение с адаптивным масштабом (без изменений)
// ============================================================

/**
 * Создать изображение с адаптивным масштабированием
 */
export function createScaledImage(scene, x, y, texture, maxWidth, maxHeight = null) {
    const image = scene.add.image(x, y, texture);

    if (!maxHeight) {
        maxHeight = maxWidth;
    }

    const scaleX = maxWidth / image.width;
    const scaleY = maxHeight / image.height;
    const scale = Math.min(scaleX, scaleY);

    if (image && typeof image.setScale === 'function') {
        image.setScale(scale);
    }

    return image;
}

// ============================================================
// createStoryTextBox — упрощённая реализация на чистом Phaser
// (без эффекта печатной машинки постраничной навигации RexUI)
// ============================================================

/**
 * Создать сюжетное диалоговое окно.
 * Упрощённая реализация: один блок текста + имя говорящего.
 * Клик по экрану — закрывает.
 */
export function createStoryTextBox(scene, config = {}) {
    const {
        characterName = 'Рассказчик',
        content = '',
        avatarTexture = null,
        typingSpeed = STORY_TEXTBOX_STYLES.typing.defaultSpeed,
        onComplete = null,
        x = scene.cameras.main.centerX,
        y = scene.cameras.main.height + STORY_TEXTBOX_STYLES.defaultPosition.yOffset
    } = config;

    const { wrapWidth, fixedWidth, fixedHeight } = STORY_TEXTBOX_STYLES.textBox;

    // Метка имени
    const nameLabel = scene.add.text(0, 0, characterName, {
        fontSize: STORY_TEXTBOX_STYLES.nameLabel.fontSize,
        color: TYPOGRAPHY.textColor.primary,
        fontFamily: TYPOGRAPHY.fontFamily.default,
        fontStyle: TYPOGRAPHY.fontWeight.bold,
        backgroundColor: '#000000',
        padding: STORY_TEXTBOX_STYLES.nameLabel.padding
    }).setOrigin(0, 1);

    // Основной текст
    const textBox = scene.add.text(0, 0, content, {
        fontSize: STORY_TEXTBOX_STYLES.textBox.fontSize,
        color: TYPOGRAPHY.textColor.primary,
        fontFamily: TYPOGRAPHY.fontFamily.default,
        wordWrap: { width: wrapWidth },
        maxLines: STORY_TEXTBOX_STYLES.textBox.maxLines
    }).setOrigin(0.5);

    // Фон
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.storyPrimary, 1);
    bg.fillRoundedRect(-fixedWidth / 2, -fixedHeight / 2, fixedWidth, fixedHeight, STORY_TEXTBOX_STYLES.textBox.cornerRadius);
    bg.lineStyle(STORY_TEXTBOX_STYLES.textBox.strokeWidth, COLORS.storyLight, 1);
    bg.strokeRoundedRect(-fixedWidth / 2, -fixedHeight / 2, fixedWidth, fixedHeight, STORY_TEXTBOX_STYLES.textBox.cornerRadius);

    // Контейнер
    const storyDialog = scene.add.container(x, y);
    storyDialog.add(bg);
    storyDialog.add(textBox);
    storyDialog.add(nameLabel);
    nameLabel.setPosition(-fixedWidth / 2 + STORY_TEXTBOX_STYLES.padding.nameLeft, -fixedHeight / 2 - STORY_TEXTBOX_STYLES.padding.nameBottom);

    storyDialog.setDepth(STORY_TEXTBOX_STYLES.depth);

    // Эффект печатной машинки (упрощённый)
    let isTyping = false;
    let typeIndex = 0;
    let typeTimer = null;

    const startTyping = () => {
        isTyping = true;
        textBox.setText('');
        typeIndex = 0;
        typeTimer = scene.time.addEvent({
            delay: typingSpeed,
            callback: () => {
                if (typeIndex >= content.length) {
                    typeTimer.remove();
                    isTyping = false;
                    return;
                }
                textBox.setText(content.substring(0, typeIndex + 1));
                typeIndex++;
                if (scene.audioManager && typeof scene.audioManager.playTypewriter === 'function') {
                    scene.audioManager.playTypewriter();
                }
            },
            loop: true
        });
    };

    const clickHandler = () => {
        if (isTyping) {
            // Пропускаем анимацию печати
            if (typeTimer) typeTimer.remove();
            textBox.setText(content);
            isTyping = false;
        } else {
            scene.input.off('pointerdown', clickHandler);
            scene.tweens.add({
                targets: storyDialog,
                alpha: 0,
                y: y + STORY_TEXTBOX_STYLES.animation.exit.offsetY,
                duration: STORY_TEXTBOX_STYLES.animation.exit.duration,
                ease: STORY_TEXTBOX_STYLES.animation.exit.ease,
                onComplete: () => {
                    storyDialog.destroy();
                    if (onComplete && typeof onComplete === 'function') {
                        onComplete();
                    }
                }
            });
        }
    };
    scene.input.on('pointerdown', clickHandler);

    // Анимация появления
    storyDialog.setAlpha(0);
    storyDialog.y += STORY_TEXTBOX_STYLES.animation.entrance.offsetY;
    scene.tweens.add({
        targets: storyDialog,
        alpha: 1,
        y: y,
        duration: STORY_TEXTBOX_STYLES.animation.entrance.duration,
        ease: STORY_TEXTBOX_STYLES.animation.entrance.ease,
        onComplete: () => startTyping()
    });

    return {
        textBox: textBox,
        nameLabel: nameLabel,
        container: storyDialog,
        destroy: () => {
            scene.input.off('pointerdown', clickHandler);
            if (typeTimer) typeTimer.remove();
            storyDialog.destroy();
        }
    };
}

// ============================================================
// createScrollableList — упрощённая реализация на чистом Phaser
// ============================================================

/**
 * Создать прокручиваемый список.
 * Упрощённая реализация: один вертикальный контейнер с элементами,
 * скролл колёсиком мыши или перетаскиванием.
 */
export function createScrollableList(scene, config = {}) {
    const {
        x = 0, y = 0, width = 400, height = 500,
        headerTitle = 'Inventory',
        items = [],
        depth = 0
    } = config;

    // Фон
    const bg = scene.add.graphics();
    bg.fillStyle(0x2d2d2d, 1);
    bg.fillRoundedRect(0, 0, width, height, 10);
    bg.lineStyle(2, 0x5e92f3, 1);
    bg.strokeRoundedRect(0, 0, width, height, 10);

    // Заголовок
    const header = scene.add.text(12, 8, headerTitle, {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff'
    });

    // Контейнер
    const container = scene.add.container(x, y);
    container.add(bg);
    container.add(header);
    container.setDepth(depth);

    // Элементы списка
    const itemNodes = [];
    let itemY = 50;
    const itemHeight = 52;

    const addItem = (item) => {
        if (item && typeof item === 'object' && item.type === 'spacer') {
            itemY += Math.max(1, item.height || 5);
            return;
        }

        const text = typeof item === 'string' ? item : (item?.text ?? '');
        const bgColor = (typeof item === 'object' && item.backgroundColor != null) ? item.backgroundColor : 0x3e3e3e;

        const itemBg = scene.add.rectangle(10, itemY, width - 20, itemHeight - 4, bgColor, 1)
            .setOrigin(0, 0);
        itemBg.setStrokeStyle(1, 0x555555);
        itemBg.setInteractive({ useHandCursor: true });

        const label = scene.add.text(20, itemY + 12, text, {
            fontSize: '16px',
            color: '#ffffff'
        });

        itemBg.on('pointerover', () => itemBg.setFillStyle(0x555555, 1));
        itemBg.on('pointerout', () => itemBg.setFillStyle(bgColor, 1));

        if (item && typeof item === 'object' && typeof item.onClick === 'function') {
            itemBg.on('pointerup', () => item.onClick(item));
        }

        container.add(itemBg);
        container.add(label);
        itemNodes.push({ bg: itemBg, label });
        itemY += itemHeight;
    };

    if (items.length > 0) {
        items.forEach((item) => addItem(item));
    }

    container.addItem = addItem;
    container.setDepthAll = (d) => container.setDepth(d);

    return container;
}

// ============================================================
// Раунд 40 (заявка п.1): кнопки [📜 Персонаж] / [🎒 Инвентарь]
// в правом верхнем углу ЛЮБОЙ локации и помещения — единый
// стиль с VillageScene/ForestScene/ApiaryScene.
//   • нет персонажа → экран выбора/создания;
//   • сцена ставится на паузу, «Назад» в свитке персонажа
//     возвращает без потери состояния;
//   • узкий экран (<640px) — компактная кнопка «📜» (вкладки
//     доступны внутри свитка персонажа).
// ============================================================
export function addSceneMenuButtons(scene, fromKey, opts = {}) {
    if (!scene || !scene.add) return;
    const { width } = scene.scale;
    const btnY = opts.y ?? 14;
    const btnW = 70, btnH = 20;

    const openSheet = (tab) => {
        const p = scene.registry.get('player');
        if (!p) {
            scene.scene.start('CharacterSelection');
            return;
        }
        scene.scene.pause();
        scene.scene.launch('Character', { from: fromKey, tab });
    };

    const make = (x, label, tab) => {
        const btn = scene.add.rectangle(x, btnY, btnW, btnH, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(101);
        const txt = scene.add.text(x, btnY, label, {
            fontSize: '11px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        btn.on('pointerup', () => openSheet(tab));
        btn.on('pointerover', () => btn.setFillStyle(0x5a4530, 1));
        btn.on('pointerout', () => btn.setFillStyle(0x4a3520, 0.95));
        scene.__sceneMenuButtons = scene.__sceneMenuButtons || [];
        scene.__sceneMenuButtons.push(btn, txt);
        return btn;
    };

    if (width < 640) {
        make(width - 46, '📜', 'stats');
    } else {
        make(width - 220, t('📜 Персонаж'), 'stats');
        make(width - 100, t('🎒 Инвентарь'), 'inventory');
    }
}

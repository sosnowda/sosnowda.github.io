/**
 * Вспомогательные функции UI — расширение RexUI
 * Создание качественных UI-компонентов с помощью Phaser3-Rex-Plugins
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

/**
 * Создать фон со скруглёнными углами (требуется для RexUI Label)
 * @param {Phaser.Scene} scene
 * @param {number} color
 * @param {number} radius
 * @param {number} strokeColor
 * @param {number} strokeWidth
 */
function createRoundRectangle(
    scene, 
    color, 
    radius = ROUND_RECTANGLE_DEFAULTS.cornerRadius, 
    strokeColor = ROUND_RECTANGLE_DEFAULTS.strokeColor, 
    strokeWidth = ROUND_RECTANGLE_DEFAULTS.strokeWidth
) {
    if (!scene.rexUI) {
        console.error('RexUI plugin not loaded!');
        const { width, height } = ROUND_RECTANGLE_DEFAULTS.fallbackSize;
        return scene.add.graphics().fillStyle(color).fillRoundedRect(0, 0, width, height, radius);
    }
    
    const bg = scene.rexUI.add.roundRectangle(0, 0, 0, 0, radius, color);
    if (strokeColor !== null) {
        bg.setStrokeStyle(strokeWidth, strokeColor);
    }
    return bg;
}


/**
 * Привязать событие changedata к scene.registry и автоматически отвязать при уничтожении target
 * @param {Phaser.Scene} scene
 * @param {any} target - обычно dialog/scrollable и т.п., достаточно наличия once('destroy')
 * @param {string[]} keys - список ключей registry, напр. ['score.current', 'settings.audio.sfxVolume']
 * @param {Function} onChange - вызывается при изменении любого ключа
 * @returns {Function} cleanup
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

    // Авто-отвязка: в первую очередь следуем жизненному циклу target
    if (target && typeof target.once === 'function') {
        target.once('destroy', cleanup);
    } else if (scene?.events && typeof scene.events.once === 'function') {
        scene.events.once('shutdown', cleanup);
    }

    return cleanup;
}

/**
 * Создать кнопку RexUI (расширенная версия — поддерживает повторное использование в Dialog)
 * @param {Phaser.Scene} scene - текущая сцена
 * @param {number} x - координата X
 * @param {number} y - координата Y
 * @param {string} text - текст кнопки
 * @param {Function} onClick - колбэк клика
 * @param {Object} options - необязательная конфигурация
 * @returns {RexUI.Label}
 */
export function createButton(scene, x, y, text, onClick, options = {}) {
    if (!scene.rexUI) {
        console.error('RexUI plugin not loaded! Cannot create button.');
        return null;
    }

    const config = {
        fontSize: options.fontSize || BUTTON_STYLES.fontSize,
        textColor: options.textColor || TYPOGRAPHY.textColor.primary,
        icon: options.icon || null,

        // По умолчанию — однотонный скруглённый прямоугольник; если передан backgroundImageKey — используем фон-картинку
        backgroundImageKey: options.backgroundImageKey || null,
        backgroundImageFrame: options.backgroundImageFrame,
        backgroundImageTint: (typeof options.backgroundImageTint === 'number') ? options.backgroundImageTint : 0xffffff,
        hoverImageTint: (typeof options.hoverImageTint === 'number') ? options.hoverImageTint : null,
        pressImageTint: (typeof options.pressImageTint === 'number') ? options.pressImageTint : 0xdddddd,
        backgroundAlpha: (typeof options.backgroundAlpha === 'number') ? options.backgroundAlpha : 1,
        resizeBackgroundToLabel: options.resizeBackgroundToLabel !== false,

        // Обводка/тень текста (фиксированные значения; авто-подбор контраста не выполняется)
        textStrokeThickness: options.textStrokeThickness,

        // Ручная обводка/тень текста
        textStrokeColor: options.textStrokeColor,
        textShadowColor: options.textShadowColor,
        textShadowOffsetX: Number.isFinite(options.textShadowOffsetX) ? options.textShadowOffsetX : 1,
        textShadowOffsetY: Number.isFinite(options.textShadowOffsetY) ? options.textShadowOffsetY : 1,
        textShadowBlur: Number.isFinite(options.textShadowBlur) ? options.textShadowBlur : 2,

        // Однотонный фон (запасной вариант, если картинка не настроена/не загружена)
        backgroundColor: options.backgroundColor || COLORS.primary,
        hoverColor: options.hoverColor || COLORS.light,
        pressColor: options.pressColor || COLORS.dark,

        cornerRadius: options.cornerRadius || BUTTON_STYLES.cornerRadius,
        padding: options.padding || BUTTON_STYLES.padding,
        autoPlayAnim: options.autoPlayAnim !== undefined ? options.autoPlayAnim : true,

        // Защита от многократного клика (мс). 0 — без ограничения
        clickCooldown: options.clickCooldown !== undefined ? options.clickCooldown : 350,

        // Если onClick возвращает объект с once('destroy') (например dialog), по умолчанию блокируем до его уничтожения
        lockWhileReturnedAlive: options.lockWhileReturnedAlive !== undefined ? options.lockWhileReturnedAlive : true,

        ...options
    };

    const buttonText = config.icon ? `${config.icon} ${text}` : text;

    // Фон: по умолчанию скруглённый прямоугольник; при backgroundImageKey — картинка
    const backgroundGO = config.backgroundImageKey
        ? scene.add.image(0, 0, config.backgroundImageKey, config.backgroundImageFrame)
        : createRoundRectangle(
            scene,
            config.backgroundColor,
            config.cornerRadius,
            COLORS.white,
            BUTTON_STYLES.strokeWidth
        );

    // Создаём компонент Label
    const button = scene.rexUI.add.label({
        background: backgroundGO,

        text: scene.add.text(0, 0, buttonText, {
            fontSize: `${config.fontSize}px`,
            color: config.textColor,
            fontFamily: TYPOGRAPHY.fontFamily.default,
            fontWeight: TYPOGRAPHY.fontWeight.bold
        }),

        space: config.padding,

        align: 'center',
        name: text
    });

    button.setPosition(x, y);
    button.layout();

    // Текстовый эффект: через параметры добавляем обводку/тень для читаемости (авто-подбор контраста не выполняется)
    const textElement = button.getElement('text');
    if (textElement) {
        if (typeof textElement.setStroke === 'function' && (config.textStrokeColor != null || Number.isFinite(config.textStrokeThickness))) {
            const strokeColor = (config.textStrokeColor != null) ? config.textStrokeColor : '#000000';
            const strokeThickness = Number.isFinite(config.textStrokeThickness) ? config.textStrokeThickness : 3;
            textElement.setStroke(strokeColor, strokeThickness);
        }

        if (typeof textElement.setShadow === 'function' && config.textShadowColor != null) {
            textElement.setShadow(
                config.textShadowOffsetX,
                config.textShadowOffsetY,
                config.textShadowColor,
                config.textShadowBlur,
                false,
                true
            );
        }
    }

    const bgElement = button.getElement('background');

    const setBgNormal = () => {
        if (!bgElement) return;
        if (typeof bgElement.setFillStyle === 'function') {
            bgElement.setFillStyle(config.backgroundColor);
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
            bgElement.setFillStyle(config.hoverColor);
            return;
        }
        if (typeof bgElement.setTint === 'function') {
            const tint = (typeof config.hoverImageTint === 'number') ? config.hoverImageTint : config.backgroundImageTint;
            bgElement.setTint(tint);
        }
        if (typeof bgElement.setAlpha === 'function') {
            bgElement.setAlpha(config.backgroundAlpha);
        }
    };

    const setBgPress = () => {
        if (!bgElement) return;
        if (typeof bgElement.setFillStyle === 'function') {
            bgElement.setFillStyle(config.pressColor);
            return;
        }
        if (typeof bgElement.setTint === 'function') {
            bgElement.setTint(config.pressImageTint);
        }
        if (typeof bgElement.setAlpha === 'function') {
            bgElement.setAlpha(config.backgroundAlpha);
        }
    };

    const resetVisual = () => {
        if (!button || !button.scene) return;
        if (scene?.tweens && typeof scene.tweens.killTweensOf === 'function') {
            scene.tweens.killTweensOf(button);
        }
        setBgNormal();
        if (typeof button.setScale === 'function') {
            button.setScale(BUTTON_STYLES.normal.scale);
        }
    };

    // Позволяет извне (например, при открытии модального окна) принудительно сбросить визуал кнопки,
    // чтобы не застряло состояние hover/pressed
    button.__uiResetVisual = resetVisual;

    // Если фон — картинка: подгоняем под итоговый размер label
    if (config.backgroundImageKey && config.resizeBackgroundToLabel && bgElement && typeof bgElement.setDisplaySize === 'function') {
        const bounds = (typeof button.getBounds === 'function') ? button.getBounds() : null;
        const w = bounds?.width || button.width;
        const h = bounds?.height || button.height;
        if (w && h) {
            bgElement.setDisplaySize(w, h);
        }
        setBgNormal();
    } else {
        setBgNormal();
    }


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
        if (!button || !button.scene) return;
        if (typeof button.setInteractive === 'function') {
            button.setInteractive({ useHandCursor: true });
        }
    };

    const disableButtonInput = () => {
        if (!button || !button.scene) return;
        if (typeof button.disableInteractive === 'function') {
            button.disableInteractive();
        }
    };

    if (button && typeof button.once === 'function') {
        button.once('destroy', clearUnlockTimer);
    }

    button.setInteractive({ useHandCursor: true });

    // Эффекты взаимодействия — используем анимационные параметры из конфигурации
    button.on('pointerover', function () {
        setBgHover();
        scene.tweens.add({
            targets: button,
            scaleX: BUTTON_STYLES.hover.scale,
            scaleY: BUTTON_STYLES.hover.scale,
            duration: BUTTON_STYLES.hover.duration,
            ease: BUTTON_STYLES.hover.ease
        });
        if (scene.audioManager && typeof scene.audioManager.playButtonHover === 'function') {
            scene.audioManager.playButtonHover();
        }
    });

    button.on('pointerout', function () {
        setBgNormal();
        scene.tweens.add({
            targets: button,
            scaleX: BUTTON_STYLES.normal.scale,
            scaleY: BUTTON_STYLES.normal.scale,
            duration: BUTTON_STYLES.normal.duration,
            ease: BUTTON_STYLES.normal.ease
        });
    });

    button.on('pointerdown', function () {
        setBgPress();
        scene.tweens.add({
            targets: button,
            scaleX: BUTTON_STYLES.press.scale,
            scaleY: BUTTON_STYLES.press.scale,
            duration: BUTTON_STYLES.press.duration,
            ease: BUTTON_STYLES.press.ease
        });
    });

    button.on('pointerup', function () {
        const now = (scene?.time && typeof scene.time.now === 'number') ? scene.time.now : Date.now();

        // Защита от многократного клика: в период cooldown просто игнорируем, но принудительно сбрасываем визуал
        // (чтобы модальная подложка не «съела» pointerout и кнопка не застряла)
        if (clickCooldownMs > 0 && now - lastClickAt < clickCooldownMs) {
            resetVisual();
            return;
        }

        lastClickAt = now;
        clearUnlockTimer();

        // На время обработки клика отключаем ввод, чтобы не срабатывать повторно до завершения твина
        disableButtonInput();

        // Важно: не оставляем в состоянии hover/press; после появления модалки может не прийти pointerout
        if (scene?.tweens && typeof scene.tweens.killTweensOf === 'function') {
            scene.tweens.killTweensOf(button);
        }
        setBgNormal();

        scene.tweens.add({
            targets: button,
            scaleX: BUTTON_STYLES.release.scale,
            scaleY: BUTTON_STYLES.release.scale,
            duration: BUTTON_STYLES.release.duration,
            ease: BUTTON_STYLES.release.ease,
            onComplete: () => {
                // Сначала полностью возвращаем визуал, затем выполняем бизнес-логику,
                // чтобы кнопка не «казалась зажатой»
                resetVisual();

                let clickResult;
                try {
                    if (onClick && typeof onClick === 'function') {
                        clickResult = onClick();
                    }
                } finally {
                    // Если onClick вернул «уничтожаемый объект» (например dialog) — блокируем до его уничтожения
                    if (
                        config.lockWhileReturnedAlive &&
                        clickResult &&
                        clickResult !== button &&
                        typeof clickResult.once === 'function'
                    ) {
                        clickResult.once('destroy', () => {
                            enableButtonInput();
                            resetVisual();
                        });
                        return;
                    }

                    // Иначе разблокируем по cooldown (0 — немедленно)
                    if (clickCooldownMs > 0 && scene?.time && typeof scene.time.delayedCall === 'function') {
                        unlockTimer = scene.time.delayedCall(clickCooldownMs, () => {
                            enableButtonInput();
                            resetVisual();
                        });
                    } else if (clickCooldownMs > 0) {
                        unlockTimer = setTimeout(() => {
                            unlockTimer = null;
                            enableButtonInput();
                            resetVisual();
                        }, clickCooldownMs);
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

    // Управление анимацией появления
    if (config.autoPlayAnim) {
        button.setScale(0);
        scene.tweens.add({
            targets: button,
            scaleX: 1,
            scaleY: 1,
            duration: BUTTON_STYLES.entrance.duration,
            ease: BUTTON_STYLES.entrance.ease,
            delay: Math.random() * BUTTON_STYLES.entrance.maxDelay
        });
    }

    return button;
}

/**
 * Создать диалоговое окно RexUI (кнопки могут управлять закрытием окна)
 * @param {Phaser.Scene} scene
 * @param {string} title
 * @param {string} content
 * @param {Array} buttons
 * @param {string} buttons[].text
 * @param {Function} buttons[].callback
 * @param {boolean} buttons[].closeDialog
 * @returns {RexUI.Dialog}
 */
export function createDialog(scene, title, content, buttons = [], options = {}) {
    if (!scene.rexUI) {
        console.error('RexUI plugin not loaded! Cannot create dialog.');
        return null;
    }

    const opts = options || {};
    const singleton = opts.singleton !== false;
    const singletonKey = opts.singletonKey || `dialog:${title}`;

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

    // Окно/подложка всегда «поверх текущего максимального слоя сцены»,
    // чтобы scrollablePanel/UI не прорисовывались поверх после самоподъёма depth
    const depthPadding = Number.isFinite(opts.depthPadding) ? opts.depthPadding : 20;
    const baseDepth = Number.isFinite(opts.baseDepth)
        ? opts.baseDepth
        : Math.max(DIALOG_STYLES.depth.base, getSceneMaxDepth() + depthPadding);

    const coverDepth = baseDepth;
    const dialogDepth = baseDepth + 1;
    const buttonDepth = baseDepth + 2;

    const coverColor = (typeof opts.coverColor === 'number') ? opts.coverColor : DIALOG_STYLES.modal.coverColor;
    const coverAlpha = (typeof opts.coverAlpha === 'number') ? opts.coverAlpha : DIALOG_STYLES.modal.coverAlpha;
    const closeOnBlocker = opts.closeOnBlocker !== undefined ? !!opts.closeOnBlocker : true;

    const resetSceneButtonVisuals = () => {
        const list = scene?.children?.list || [];
        for (let i = 0; i < list.length; i++) {
            const go = list[i];
            if (go && typeof go.__uiResetVisual === 'function') {
                go.__uiResetVisual();
            }
        }
    };

    const ensureModalBlocker = (targetDialog) => {
        if (targetDialog && targetDialog.__uiModalBlocker && targetDialog.__uiModalBlocker.scene) {
            const blk = targetDialog.__uiModalBlocker;
            blk.setDepth(coverDepth);
            blk.setVisible(true);
            return blk;
        }

        const cam = scene.cameras.main;
        const blocker = scene.add.rectangle(0, 0, cam.width, cam.height, coverColor, coverAlpha)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(coverDepth);

        if (typeof blocker.setInteractive === 'function') {
            blocker.setInteractive();
        }

        if (closeOnBlocker && typeof blocker.on === 'function') {
            blocker.on('pointerup', () => {
                if (targetDialog && typeof targetDialog.closeDialog === 'function') {
                    targetDialog.closeDialog();
                } else if (targetDialog && typeof targetDialog.modalClose === 'function') {
                    targetDialog.modalClose();
                }
            });
        }

        if (targetDialog) {
            targetDialog.__uiModalBlocker = blocker;
            if (typeof targetDialog.once === 'function') {
                targetDialog.once('destroy', () => {
                    if (blocker && blocker.scene && typeof blocker.destroy === 'function') {
                        blocker.destroy();
                    }
                });
            }
        }

        return blocker;
    };

    if (singleton) {
        if (!scene.__uiSingletonDialogs) scene.__uiSingletonDialogs = new Map();
        const existing = scene.__uiSingletonDialogs.get(singletonKey);
        if (existing && existing.scene && existing.active !== false) {
            // При появлении окна нижние кнопки могли застрять в hover/pressed из-за подложки,
            // сначала принудительно сбрасываем
            resetSceneButtonVisuals();
            ensureModalBlocker(existing);

            if (typeof existing.setDepth === 'function') existing.setDepth(dialogDepth);
            if (typeof existing.setVisible === 'function') existing.setVisible(true);
            if (typeof existing.layout === 'function') existing.layout();

            // По возможности поднимаем и actions (в некоторых версиях rexUI actions не являются children dialog)
            const actions = existing.getElement ? existing.getElement('actions') : null;
            if (actions && typeof actions.setDepth === 'function') actions.setDepth(buttonDepth);

            return existing;
        }
    }

    let dialog;

    // Переиспользуем createButton для формирования массива кнопок
    const actionButtons = buttons.map((btnConfig, index) => {
        const isPrimary = index === 0;
        const shouldCloseDialog = btnConfig.closeDialog !== false;

        const wrappedCallback = () => {
            if (btnConfig.callback && typeof btnConfig.callback === 'function') {
                btnConfig.callback(dialog);
            }

            if (shouldCloseDialog && dialog) {
                actionButtons.forEach(btn => {
                    btn.disableInteractive();
                    scene.tweens.killTweensOf(btn);
                    btn.setScale(1);
                });
                dialog.modalClose();
            }
        };

        return createButton(scene, 0, 0, btnConfig.text, wrappedCallback, {
            backgroundColor: isPrimary ? COLORS.primary : COLORS.secondary,
            hoverColor: isPrimary ? COLORS.light : COLORS.secondaryLight,
            pressColor: isPrimary ? COLORS.dark : COLORS.secondaryDark,
            fontSize: DIALOG_STYLES.button.fontSize,
            cornerRadius: DIALOG_STYLES.button.cornerRadius,
            autoPlayAnim: false,
            clickCooldown: 0
        });
    });

    // Создаём компонент Dialog
    dialog = scene.rexUI.add.dialog({
        x: scene.cameras.main.centerX,
        y: scene.cameras.main.centerY,
        width: DIALOG_STYLES.width,

        background: createRoundRectangle(
            scene,
            COLORS.dialogBg,
            DIALOG_STYLES.cornerRadius,
            COLORS.dialogStroke,
            DIALOG_STYLES.strokeWidth
        ),

        title: scene.add.text(0, 0, title, {
            fontSize: DIALOG_STYLES.title.fontSize,
            fontWeight: DIALOG_STYLES.title.fontWeight,
            color: TYPOGRAPHY.textColor.primary,
            fontFamily: TYPOGRAPHY.fontFamily.default
        }),

        content: scene.rexUI.add.BBCodeText(0, 0, content, {
            fontSize: DIALOG_STYLES.content.fontSize,
            color: TYPOGRAPHY.textColor.primary,
            align: 'center',
            fontFamily: TYPOGRAPHY.fontFamily.default,
            wrap: { mode: 'word', width: DIALOG_STYLES.content.wrapWidth }
        }),

        actions: actionButtons,

        space: DIALOG_STYLES.padding,

        align: {
            title: 'center',
            content: 'center',
            actions: 'center'
        },

        expand: {
            title: false,
            content: false,
            actions: false
        }
    });

    // Сначала сбрасываем визуал нижних кнопок (чтобы не застряло hover/pressed), затем ставим видимую и интерактивную подложку
    resetSceneButtonVisuals();
    ensureModalBlocker(dialog);

    dialog.setDepth(dialogDepth);
    dialog.layout();
    dialog.setVisible(true);
    dialog.setScale(1);
    actionButtons.forEach(btn => btn.setDepth(buttonDepth));

    if (singleton) {
        scene.__uiSingletonDialogs.set(singletonKey, dialog);
        if (dialog && typeof dialog.once === 'function') {
            dialog.once('destroy', () => {
                if (scene.__uiSingletonDialogs) {
                    scene.__uiSingletonDialogs.delete(singletonKey);
                }
            });
        }
    }

    // Модальное появление: встроенную подложку RexUI делаем прозрачной,
    // чтобы не конфликтовать по слоям/визуалу с нашей собственной подложкой
    dialog.modalPromise({
        manualClose: true,
        defaultBehavior: false,
        duration: {
            in: DIALOG_STYLES.modal.durationIn,
            out: DIALOG_STYLES.modal.durationOut
        },
        cover: {
            color: coverColor,
            alpha: 0,
            depth: coverDepth
        },
        transitIn: function (gameObject, duration) {
            gameObject.setVisible(true);
            gameObject.setScale(1);
            return scene.tweens.add({
                targets: gameObject,
                scaleX: { from: 0.1, to: 1 },
                scaleY: { from: 0.1, to: 1 },
                duration: duration,
                ease: DIALOG_STYLES.animation.transitInEase
            });
        },
        transitOut: function (gameObject, duration) {
            return scene.tweens.add({
                targets: gameObject,
                scaleX: 0,
                scaleY: 0,
                duration: duration,
                ease: DIALOG_STYLES.animation.transitOutEase
            });
        }
    }).then(() => {
        dialog.destroy();
    });

    // Единый метод обновления содержимого
    dialog.setContentText = function (text) {
        const contentElement = dialog.getElement('content');
        if (contentElement) {
            contentElement.setText(text);
            dialog.layout();
        }
    };

    // Добавляем метод ручного закрытия
    dialog.closeDialog = function () {
        actionButtons.forEach(btn => {
            btn.disableInteractive();
            scene.tweens.killTweensOf(btn);
            btn.setScale(1);
        });
        dialog.modalClose();
    };

    return dialog;
}

/**
 * Создать эффект взрыва частиц
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} texture - ключ текстуры частиц
 * @param {number} count - количество частиц
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

    // Авто-уничтожение
    scene.time.delayedCall(PARTICLE_STYLES.destroyDelay, () => {
        if (emitter && typeof emitter.destroy === 'function') {
            emitter.destroy();
        }
    });

    return emitter;
}

/**
 * Создать всплывающий текст (число урона/подсказка очков)
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {string} color
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

/**
 * Создать изображение с адаптивным масштабированием
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} texture
 * @param {number} maxWidth - максимальная ширина
 * @param {number} maxHeight - максимальная высота (необязательно)
 */
export function createScaledImage(scene, x, y, texture, maxWidth, maxHeight = null) {
    const image = scene.add.image(x, y, texture);
    
    // Если высота не задана — используем ширину
    if (!maxHeight) {
        maxHeight = maxWidth;
    }
    
    // Вычисляем коэффициент масштабирования
    const scaleX = maxWidth / image.width;
    const scaleY = maxHeight / image.height;
    const scale = Math.min(scaleX, scaleY);
    
    if (image && typeof image.setScale === 'function') {
        image.setScale(scale);
    }
    
    return image;
}

/**
 * Создать объект форматированного текста BBCodeText (для сюжетного диалога)
 * @param {Phaser.Scene} scene
 * @param {number} wrapWidth - ширина переноса текста
 * @param {number} fixedWidth - фиксированная ширина
 * @param {number} fixedHeight - фиксированная высота
 * @returns {RexUI.BBCodeText}
 */
function createBBCodeText(scene, wrapWidth, fixedWidth, fixedHeight) {
    return scene.rexUI.add.BBCodeText(0, 0, '', {
        fixedWidth: fixedWidth,
        fixedHeight: fixedHeight,
        fontSize: STORY_TEXTBOX_STYLES.textBox.fontSize,
        color: TYPOGRAPHY.textColor.primary,
        fontFamily: TYPOGRAPHY.fontFamily.default,
        wrap: {
            mode: 'word',
            width: wrapWidth
        },
        maxLines: STORY_TEXTBOX_STYLES.textBox.maxLines
    });
}

/**
 * Создать сюжетное диалоговое окно (с эффектом печатной машинки)
 * @param {Phaser.Scene} scene
 * @param {Object} config - объект конфигурации
 * @param {string} config.characterName - имя персонажа
 * @param {string} config.content - содержимое диалога (поддерживает теги BBCode)
 * @param {string} config.avatarTexture - ключ текстуры аватара (необязательно)
 * @param {number} config.typingSpeed - скорость печати (мс/символ, по умолчанию 50)
 * @param {Function} config.onComplete - колбэк завершения сюжета (необязательно)
 * @returns {Object} - объект, содержащий textBox и nameLabel
 */
export function createStoryTextBox(scene, config = {}) {
    if (!scene.rexUI) {
        console.error('RexUI plugin not loaded! Cannot create story textbox.');
        return null;
    }

    const {
        characterName = 'Рассказчик',
        content = '',
        avatarTexture = null,
        typingSpeed = STORY_TEXTBOX_STYLES.typing.defaultSpeed,
        onComplete = null,
        x = scene.cameras.main.centerX,
        y = scene.cameras.main.height + STORY_TEXTBOX_STYLES.defaultPosition.yOffset
    } = config;

    // 1. Создаём метку имени
    const nameLabel = scene.rexUI.add.label({
        background: createRoundRectangle(
            scene, 
            COLORS.storyPrimary, 
            STORY_TEXTBOX_STYLES.nameLabel.cornerRadius, 
            COLORS.storyLight, 
            STORY_TEXTBOX_STYLES.nameLabel.strokeWidth
        ),
        text: scene.add.text(0, 0, characterName, {
            fontSize: STORY_TEXTBOX_STYLES.nameLabel.fontSize,
            color: TYPOGRAPHY.textColor.primary,
            fontFamily: TYPOGRAPHY.fontFamily.default,
            fontWeight: TYPOGRAPHY.fontWeight.bold
        }),
        space: STORY_TEXTBOX_STYLES.nameLabel.padding
    });

    // 2. Создаём контейнер основного диалога
    const { wrapWidth, fixedWidth, fixedHeight } = STORY_TEXTBOX_STYLES.textBox;

    const textBox = scene.rexUI.add.textBox({
        background: createRoundRectangle(
            scene, 
            COLORS.storyPrimary, 
            STORY_TEXTBOX_STYLES.textBox.cornerRadius, 
            COLORS.storyLight, 
            STORY_TEXTBOX_STYLES.textBox.strokeWidth
        ),

        icon: avatarTexture ? 
            scene.add.image(0, 0, avatarTexture).setDisplaySize(
                STORY_TEXTBOX_STYLES.avatar.displayWidth, 
                STORY_TEXTBOX_STYLES.avatar.displayHeight
            ) : undefined,

        text: createBBCodeText(scene, wrapWidth, fixedWidth, fixedHeight),

        action: scene.add.image(0, 0, 'nextPageIcon')
            .setTint(COLORS.storyLight)
            .setVisible(false)
            .setDisplaySize(
                STORY_TEXTBOX_STYLES.actionIcon.displayWidth, 
                STORY_TEXTBOX_STYLES.actionIcon.displayHeight
            ),

        space: {
            left: STORY_TEXTBOX_STYLES.padding.left,
            right: STORY_TEXTBOX_STYLES.padding.right,
            top: STORY_TEXTBOX_STYLES.padding.top,
            bottom: STORY_TEXTBOX_STYLES.padding.bottom,
            icon: avatarTexture ? STORY_TEXTBOX_STYLES.padding.icon : 0,
            text: STORY_TEXTBOX_STYLES.padding.text
        }
    });

    // 3. Объединяем метку имени и диалоговое окно
    const storyDialog = scene.rexUI.add.sizer({
        orientation: 'y',
        x: x,
        y: y
    })
    .add(nameLabel, { 
        align: 'left', 
        padding: { 
            bottom: STORY_TEXTBOX_STYLES.padding.nameBottom, 
            left: STORY_TEXTBOX_STYLES.padding.nameLeft 
        } 
    })
    .add(textBox)
    .layout();

    // 4. Устанавливаем уровень слоя
    storyDialog.setDepth(STORY_TEXTBOX_STYLES.depth);

    // 5. Добавляем анимацию «дыхания» иконки «продолжить»
    const actionIcon = textBox.getElement('action');
    if (actionIcon) {
        scene.tweens.add({
            targets: actionIcon,
            scaleX: STORY_TEXTBOX_STYLES.typing.iconBreath.scale,
            scaleY: STORY_TEXTBOX_STYLES.typing.iconBreath.scale,
            duration: STORY_TEXTBOX_STYLES.typing.iconBreath.duration,
            yoyo: true,
            repeat: -1,
            ease: STORY_TEXTBOX_STYLES.typing.iconBreath.ease
        });
    }

    // 6. Запускаем эффект печатной машинки
    textBox.start(content, typingSpeed);

    // 7. Логика взаимодействия
    let isCurrentlyTyping = false;

    textBox.on('type', function () {
        isCurrentlyTyping = true;
        if (actionIcon) actionIcon.setVisible(false);
        // Воспроизводим звук печатной машинки
        if (scene.audioManager && typeof scene.audioManager.playTypewriter === 'function') {
            scene.audioManager.playTypewriter();
        }
    });

    textBox.on('pageend', function () {
        isCurrentlyTyping = false;
        if (actionIcon) actionIcon.setVisible(true);
    });

    // 8. Глобальная обработка клика
    const clickHandler = function () {
        if (isCurrentlyTyping) {
            textBox.stop(true);
            isCurrentlyTyping = false;
            if (actionIcon) actionIcon.setVisible(true);
        } else {
            if (!textBox.isLastPage) {
                textBox.typeNextPage();
                if (actionIcon) actionIcon.setVisible(false);
            } else {
                console.log('Сюжетный диалог завершён');
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
        }
    };

    scene.input.on('pointerdown', clickHandler);

    // 9. Анимация появления
    storyDialog.setAlpha(0);
    storyDialog.y += STORY_TEXTBOX_STYLES.animation.entrance.offsetY;
    scene.tweens.add({
        targets: storyDialog,
        alpha: 1,
        y: y,
        duration: STORY_TEXTBOX_STYLES.animation.entrance.duration,
        ease: STORY_TEXTBOX_STYLES.animation.entrance.ease
    });

    // 10. Возвращаем объект диалога
    return {
        textBox: textBox,
        nameLabel: nameLabel,
        container: storyDialog,
        destroy: () => {
            scene.input.off('pointerdown', clickHandler);
            storyDialog.destroy();
        }
    };
}

export function createScrollableList(scene, config = {}) {
    if (!scene.rexUI) return null;

    const {
        x = 0, y = 0, width = 400, height = 500,
        headerTitle = 'Inventory',
        items = [],
        depth = 0
    } = config;

    const STYLES = {
        bg: 0x2d2d2d, stroke: 0x5e92f3,
        track: 0x1a1a1a, thumb: 0x5e92f3,
        // space.panel -> внутри rexScrollablePanel отображается как space.child
        // - panel.right: оставляем правый внутренний отступ для прокручиваемого контента, чтобы не прилипал к скроллбару
        // - slider: управляет расстоянием между panel и скроллбаром
        space: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 10,
            item: 5,
            panel: { left: 0, right: 12 },
            slider: 10
        }
    };

    // 1. Контейнер содержимого
    const contentPanel = scene.rexUI.add.sizer({
        orientation: 'y',
        space: { item: STYLES.space.item }
    });

    // Для решения проблемы перекрытия при «сначала item, потом panel»: держим глубину item синхронной с панелью
    const itemNodes = [];

    // 2. Основная панель
    const scrollable = scene.rexUI.add.scrollablePanel({
        x: x, y: y,
        width: width, height: height,
        scrollMode: 0,

        background: scene.rexUI.add.roundRectangle(0, 0, 2, 2, 10, STYLES.bg)
            .setStrokeStyle(2, STYLES.stroke),

        panel: {
            child: contentPanel,
            mask: { padding: 1 }
        },

        slider: {
            // Вертикальный скроллбар: делаем thumb «длинной капсулой», чтобы не выглядел как точка
            track: scene.rexUI.add.roundRectangle(0, 0, 12, 10, 6, STYLES.track),
            thumb: scene.rexUI.add.roundRectangle(0, 0, 12, 60, 6, STYLES.thumb),
            input: 'drag',

            // === КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ ===
            hideUnscrollableSlider: true, // скрываем, когда прокрутка не нужна — прерывает зацикливание в некоторых версиях
            minThumbSize: 48,             // минимальная высота, чтобы всегда выглядело как «длинная полоса»
            // ======================
        },

        scroller: {
            threshold: 10,
            slidingDeceleration: 5000,
            backDeceleration: 2000,
        },

        header: scene.rexUI.add.label({
            // Немного увеличиваем высоту заголовка, чтобы текст сверху не обрезался
            height: 52,
            orientation: 'x',
            background: scene.rexUI.add.roundRectangle(0, 0, 2, 2, { tl: 10, tr: 10 }, 0x444444),
            text: scene.add.text(0, 0, headerTitle, {
                fontSize: '20px',
                fontStyle: 'bold',
                padding: { x: 0, y: 2 }
            }).setOrigin(0, 0.5),
            space: { left: 12, top: 8, bottom: 8 }
        }),

        space: STYLES.space
    });

    const originalSetDepth = scrollable.setDepth ? scrollable.setDepth.bind(scrollable) : null;
    scrollable.setDepthAll = (d) => {
        if (originalSetDepth) originalSetDepth(d);
        // Гарантируем, что item списка не перекроет фон panel
        itemNodes.forEach((n) => {
            if (n && typeof n.setDepth === 'function') n.setDepth(d + 1);
        });
        return scrollable;
    };
    // Совместимость с внешними вызовами list.setDepth(...)
    if (originalSetDepth) scrollable.setDepth = scrollable.setDepthAll;

    // 3. Подключаем методы
    // item поддерживает:
    // - string: простой текстовый пункт
    // - { text, onClick?, backgroundColor? }
    // - { type: 'spacer', height }
    // - { node: RexUI/GameObject, expand? }
    scrollable.addItem = (item) => {
        // spacer
        if (item && typeof item === 'object' && item.type === 'spacer') {
            const h = Math.max(1, item.height || STYLES.space.item);
            const zone = scene.add.zone(0, 0, 1, h);
            contentPanel.add(zone, 0, 'center', 0, true);
            itemNodes.push(zone);
            return;
        }

        // пользовательский узел
        if (item && typeof item === 'object' && item.node) {
            const node = item.node;
            // Более универсальная сигнатура RexUI: add(child, proportion, align, padding, expand)
            contentPanel.add(node, 0, 'center', 0, item.expand !== false);
            itemNodes.push(node);
            // Сразу синхронизируем глубину (снаружи может быть вызван setDepth позже)
            if (typeof scrollable.depth === 'number' && typeof node.setDepth === 'function') {
                node.setDepth(scrollable.depth + 1);
            }
            return;
        }

        // нормализуем текстовый пункт
        const text = typeof item === 'string' ? item : (item?.text ?? '');
        const bgColor = (typeof item === 'object' && item.backgroundColor != null) ? item.backgroundColor : 0x3e3e3e;
        const hoverColor = 0x555555;

        const bg = scene.rexUI.add.roundRectangle(0, 0, 20, 20, 8, bgColor);
        const label = scene.rexUI.add.label({
            height: 52,
            orientation: 'x',
            background: bg,
            text: scene.add.text(0, 0, text, { fontSize: '16px' }),
            space: { left: 12, right: 12, top: 10, bottom: 10 },
        });

        label.setInteractive({ useHandCursor: true })
            .on('pointerover', () => bg.setFillStyle(hoverColor))
            .on('pointerout', () => bg.setFillStyle(bgColor));

        if (item && typeof item === 'object' && typeof item.onClick === 'function') {
            label.on('pointerup', () => item.onClick(item));
        }

        contentPanel.add(label, 0, 'center', 0, true);
        itemNodes.push(label);
    };

    // 4. Заполняем данными
    if (items.length > 0) {
        items.forEach((item) => scrollable.addItem(item));
    } else {
        // Предотвращаем ошибку расчёта высоты для пустого списка
        const zone = scene.add.zone(0, 0, 1, 1);
        contentPanel.add(zone, 0, 'center', 0, true);
        itemNodes.push(zone);
    }

    scrollable.layout();
    // Начальная глубина (если снаружи будет вызван setDepth, здесь тоже перекроется и автоматически синхронизируется с items)
    scrollable.setDepthAll(depth);

    return scrollable;
}

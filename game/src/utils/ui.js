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

// ============================================================
// Внутренние хелперы
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

    return container;
}

// ============================================================
// createDialog — модальное окно на чистом Phaser
// ============================================================

/**
 * Создать модальное диалоговое окно на чистом Phaser (без RexUI).
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
 * @returns {Phaser.GameObjects.Container}
 */
export function createDialog(scene, title, content, buttons = [], options = {}) {
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

    // Сбрасываем визуал нижних кнопок при открытии модалки
    const resetSceneButtonVisuals = () => {
        const list = scene?.children?.list || [];
        for (let i = 0; i < list.length; i++) {
            const go = list[i];
            if (go && typeof go.__uiResetVisual === 'function') {
                go.__uiResetVisual();
            }
            // Рекурсивно для контейнеров
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

    // Singleton — если окно уже открыто, просто поднимаем его наверх
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

    // Размеры панели — адаптируются к контенту
    const dialogWidth = DIALOG_STYLES.width;
    const pad = DIALOG_STYLES.padding;

    // Заголовок
    const titleText = scene.add.text(0, 0, title, {
        fontSize: DIALOG_STYLES.title.fontSize,
        fontStyle: DIALOG_STYLES.title.fontWeight,
        color: TYPOGRAPHY.textColor.primary,
        fontFamily: TYPOGRAPHY.fontFamily.default
    }).setOrigin(0.5, 0);

    // Контент
    const contentText = scene.add.text(0, 0, content, {
        fontSize: DIALOG_STYLES.content.fontSize,
        color: TYPOGRAPHY.textColor.primary,
        fontFamily: TYPOGRAPHY.fontFamily.default,
        align: 'center',
        wordWrap: { width: DIALOG_STYLES.content.wrapWidth }
    }).setOrigin(0.5, 0);

    // Кнопки
    const actionButtons = [];
    const actionContainers = buttons.map((btnConfig, index) => {
        const isPrimary = index === 0;
        const shouldCloseDialog = btnConfig.closeDialog !== false;

        const wrappedCallback = () => {
            if (btnConfig.callback && typeof btnConfig.callback === 'function') {
                btnConfig.callback(dialog);
            }
            if (shouldCloseDialog && dialog) {
                closeDialog();
            }
        };

        const btn = createButton(scene, 0, 0, btnConfig.text, wrappedCallback, {
            backgroundColor: isPrimary ? COLORS.primary : COLORS.secondary,
            hoverColor: isPrimary ? COLORS.light : COLORS.secondaryLight,
            pressColor: isPrimary ? COLORS.dark : COLORS.secondaryDark,
            fontSize: DIALOG_STYLES.button.fontSize,
            cornerRadius: DIALOG_STYLES.button.cornerRadius,
            autoPlayAnim: false,
            clickCooldown: 0
        });
        btn.setDepth(buttonDepth);
        actionButtons.push(btn);
        return btn;
    });

    // Добавляем элементы в контейнер
    dialog.add(blocker); // не добавляем — blocker уже на сцене с глубиной coverDepth
    // Внимание: blocker не должен быть внутри контейнера, т.к. у него свой depth и scrollFactor
    // Убираем его из контейнера (если попал) и используем как отдельный объект
    dialog.remove(blocker);

    dialog.add(titleText);
    dialog.add(contentText);
    actionContainers.forEach((btn) => dialog.add(btn));

    // ----- Раскладка содержимого -----
    const layout = () => {
        const titleH = titleText.height || 30;
        const contentH = contentText.height || 60;

        let totalH = pad.top + titleH + pad.title + contentH + pad.content;
        if (actionContainers.length > 0) {
            totalH += pad.action + 50; // высота кнопки ~50
        }
        totalH += pad.bottom;

        // Перерисовываем фон панели
        panelBg.clear();
        panelBg.fillStyle(COLORS.dialogBg, 1);
        panelBg.fillRoundedRect(-dialogWidth / 2, -totalH / 2, dialogWidth, totalH, DIALOG_STYLES.cornerRadius);
        panelBg.lineStyle(DIALOG_STYLES.strokeWidth, COLORS.dialogStroke, 1);
        panelBg.strokeRoundedRect(-dialogWidth / 2, -totalH / 2, dialogWidth, totalH, DIALOG_STYLES.cornerRadius);
        panelBg.setDepth(dialogDepth - 1);
        dialog.panelHeight = totalH;

        // Заголовок
        titleText.setPosition(0, -totalH / 2 + pad.top);

        // Контент
        contentText.setPosition(0, -totalH / 2 + pad.top + titleH + pad.title);

        // Кнопки — в один ряд
        const n = actionContainers.length;
        const btnY = totalH / 2 - pad.bottom - 25;
        if (n === 1) {
            actionContainers[0].setPosition(0, btnY);
        } else if (n > 1) {
            const spacing = (dialogWidth - 40) / n;
            actionContainers.forEach((btn, i) => {
                const x = -dialogWidth / 2 + 20 + spacing / 2 + i * spacing;
                btn.setPosition(x, btnY);
            });
        }
    };

    // Фон панели (graphics) — должен быть добавлен ПЕРВЫМ в контейнер, чтобы быть позади
    const panelBg = scene.add.graphics();
    panelBg.setDepth(dialogDepth - 1);
    panelBg.setScrollFactor(0);
    // Вставляем panelBg первым в контейнер
    dialog.addAt(panelBg, 0);

    layout();

    // ----- Закрытие диалога -----
    let isClosing = false;
    const closeDialog = () => {
        if (isClosing) return;
        isClosing = true;

        // Блокируем кнопки
        actionButtons.forEach((btn) => {
            if (typeof btn.disableInteractive === 'function') btn.disableInteractive();
            if (scene?.tweens && typeof scene.tweens.killTweensOf === 'function') {
                scene.tweens.killTweensOf(btn);
            }
            btn.setScale(1);
        });

        // Анимация исчезновения
        scene.tweens.add({
            targets: dialog,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: DIALOG_STYLES.modal.durationOut,
            ease: DIALOG_STYLES.animation.transitOutEase,
            onComplete: () => {
                // Уничтожаем blocker
                if (blocker && blocker.scene) blocker.destroy();
                // Уничтожаем диалог
                dialog.destroy();
            }
        });

        // Также гасим подложку
        scene.tweens.add({
            targets: blocker,
            alpha: 0,
            duration: DIALOG_STYLES.modal.durationOut,
            onComplete: () => {
                if (blocker && blocker.scene) blocker.destroy();
            }
        });
    };

    // Если клик по подложке должен закрывать
    if (closeOnBlocker) {
        blocker.on('pointerup', () => closeDialog());
    }

    // ----- API совместимости с RexUI Dialog -----
    dialog.active = true;
    dialog.__uiModalBlocker = blocker;
    dialog.closeDialog = closeDialog;
    dialog.modalClose = closeDialog; // алиас для совместимости
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
        return null;
    };

    // Singleton registry
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
        ease: DIALOG_STYLES.animation.transitInEase
    });
    scene.tweens.add({
        targets: blocker,
        alpha: coverAlpha,
        duration: DIALOG_STYLES.modal.durationIn
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

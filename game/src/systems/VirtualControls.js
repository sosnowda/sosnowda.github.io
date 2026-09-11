// Виртуальный джойстик для мобильных устройств.
// Показывается только на touch-устройствах. Слева — джойстик движения,
// справа — кнопка действия E.

export class VirtualControls {
    constructor(scene) {
        this.scene = scene;
        this.enabled = false;
        this.joystick = null;
        this.actionButton = null;
        this.joyX = 0;
        this.joyY = 0;

        // Проверяем touch-устройство
        this.enabled = this._isTouchDevice();
        if (this.enabled) {
            this.create();
        }
    }

    _isTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        );
    }

    create() {
        const { width, height } = this.scene.scale;

        // ----- Джойстик (левый нижний угол) -----
        const jx = 100;
        const jy = height - 100;
        const jr = 60; // радиус базы

        // База джойстика (внешний круг)
        const base = this.scene.add.circle(jx, jy, jr, 0x000000, 0.4)
            .setStrokeStyle(3, 0xc9a14a, 0.8)
            .setScrollFactor(0)
            .setDepth(200);
        // Ползунок (внутренний круг)
        const thumb = this.scene.add.circle(jx, jy, 25, 0xc9a14a, 0.7)
            .setStrokeStyle(2, 0x000000, 0.5)
            .setScrollFactor(0)
            .setDepth(201);

        this.joystick = { base, thumb, jx, jy, jr, active: false, pointerId: null };

        // Touch-обработчик джойстика
        base.setInteractive({ useHandCursor: false });
        base.on('pointerdown', (pointer) => {
            this.joystick.active = true;
            this.joystick.pointerId = pointer.id;
            this._updateThumb(pointer.x, pointer.y);
        });
        // Глобальный обработчик move/up — чтобы работало за пределами базы
        this.scene.input.on('pointermove', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                this._updateThumb(pointer.x, pointer.y);
            }
        });
        this.scene.input.on('pointerup', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                this._resetJoystick();
            }
        });
        this.scene.input.on('pointerupoutside', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                this._resetJoystick();
            }
        });

        // ----- Кнопка действия E (правый нижний угол) -----
        const ax = width - 100;
        const ay = height - 100;
        const ar = 50;

        const actionBase = this.scene.add.circle(ax, ay, ar, 0x8B2C1A, 0.7)
            .setStrokeStyle(3, 0xc9a14a, 1)
            .setScrollFactor(0)
            .setDepth(200);
        const actionText = this.scene.add.text(ax, ay, 'E', {
            fontSize: '36px',
            color: '#f3e9d2',
            fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000',
            strokeThickness: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        actionBase.setInteractive({ useHandCursor: true });
        actionBase.on('pointerdown', () => {
            actionBase.setScale(0.9);
            actionText.setScale(0.9);
            // Триггерим E
            if (this.scene.input && this.scene.input.keyboard) {
                // Эмулируем нажатие E через emit
                this.scene.input.keyboard.emit('keydown-E', { key: 'E' });
            }
            if (this.scene.tryInteract) {
                this.scene.tryInteract();
            }
        });
        actionBase.on('pointerup', () => {
            actionBase.setScale(1);
            actionText.setScale(1);
        });
        actionBase.on('pointerout', () => {
            actionBase.setScale(1);
            actionText.setScale(1);
        });

        this.actionButton = { base: actionBase, text: actionText, ax, ay, ar };
    }

    _updateThumb(px, py) {
        const { jx, jy, jr, thumb } = this.joystick;
        const dx = px - jx;
        const dy = py - jy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = jr;
        let tx, ty;
        if (dist > maxDist) {
            tx = jx + dx / dist * maxDist;
            ty = jy + dy / dist * maxDist;
        } else {
            tx = px;
            ty = py;
        }
        thumb.setPosition(tx, ty);
        // Нормализованные значения -1..1
        this.joyX = (tx - jx) / maxDist;
        this.joyY = (ty - jy) / maxDist;
    }

    _resetJoystick() {
        const { jx, jy, thumb } = this.joystick;
        this.scene.tweens.add({
            targets: thumb,
            x: jx, y: jy,
            duration: 150,
            ease: 'Quad.easeOut',
        });
        this.joyX = 0;
        this.joyY = 0;
        this.joystick.active = false;
        this.joystick.pointerId = null;
    }

    /**
     * Получить нормализованный вектор движения от джойстика.
     * Возвращает {x, y} в диапазоне -1..1, или null если джойстик не активен.
     */
    getMovement() {
        if (!this.enabled || !this.joystick || !this.joystick.active) return null;
        if (Math.abs(this.joyX) < 0.1 && Math.abs(this.joyY) < 0.1) return null;
        return { x: this.joyX, y: this.joyY };
    }

    /**
     * Скрыть/показать контролы (например, во время диалога).
     */
    setVisible(visible) {
        if (!this.enabled) return;
        if (this.joystick) {
            this.joystick.base.setVisible(visible);
            this.joystick.thumb.setVisible(visible);
        }
        if (this.actionButton) {
            this.actionButton.base.setVisible(visible);
            this.actionButton.text.setVisible(visible);
        }
    }

    destroy() {
        if (this.joystick) {
            this.joystick.base.destroy();
            this.joystick.thumb.destroy();
            this.joystick = null;
        }
        if (this.actionButton) {
            this.actionButton.base.destroy();
            this.actionButton.text.destroy();
            this.actionButton = null;
        }
    }
}

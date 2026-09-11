// Туториал: показывает всплывающие подсказки управления при первом входе в деревню.
// Подсказки исчезают по таймауту (3 сек) или при выполнении соответствующего действия.

export class Tutorial {
    constructor(scene) {
        this.scene = scene;
        this.quest = scene.registry.get('quest');
        this.activeOverlays = [];
    }

    /**
     * Запустить серию подсказок, если туториал ещё не пройден.
     */
    maybeStart() {
        if (!this.quest) return;
        if (this.quest.tutorialStep === undefined) {
            this.quest.tutorialStep = 0;
        }
        if (this.quest.tutorialStep >= 3) return;

        // Сначала показываем подсказку движения
        this.showStep(0);
    }

    /**
     * Показать конкретный шаг туториала.
     */
    showStep(step) {
        if (step >= 3) {
            this.quest.tutorialStep = 3;
            return;
        }
        this.quest.tutorialStep = step + 1;

        const hints = [
            {
                title: 'Движение',
                text: 'WASD или стрелки — двигайся по деревне',
                icon: '⬆⬇⬅➡',
                duration: 4000,
                position: 'top',
            },
            {
                title: 'Взаимодействие',
                text: 'Подойди к NPC и нажми E, чтобы поговорить',
                icon: 'E',
                duration: 4000,
                position: 'top',
            },
            {
                title: 'Цель',
                text: 'Найди старейшину — он даст тебе задание',
                icon: '◆',
                duration: 5000,
                position: 'top',
            },
        ];

        const hint = hints[step];
        this._showHint(hint, () => {
            // Показать следующий шаг через 500 мс после закрытия текущего
            this.scene.time.delayedCall(500, () => this.showStep(step + 1));
        });
    }

    _showHint(hint, onComplete) {
        const { width } = this.scene.scale;
        const y = 120;

        // Контейнер подсказки
        const container = this.scene.add.container(width / 2, y);
        container.setScrollFactor(0).setDepth(200);

        // Фон
        const bgWidth = 460;
        const bgHeight = 70;
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 12);
        bg.lineStyle(2, 0xc9a14a, 1);
        bg.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 12);
        container.add(bg);

        // Иконка
        const icon = this.scene.add.text(-bgWidth / 2 + 30, 0, hint.icon, {
            fontSize: '24px',
            color: '#c9a14a',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(icon);

        // Заголовок
        const title = this.scene.add.text(-bgWidth / 2 + 70, -16, hint.title, {
            fontSize: '16px',
            color: '#c9a14a',
            fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
        }).setOrigin(0, 0.5);
        container.add(title);

        // Текст
        const text = this.scene.add.text(-bgWidth / 2 + 70, 12, hint.text, {
            fontSize: '14px',
            color: '#f3e9d2',
            fontFamily: 'Georgia, serif',
        }).setOrigin(0, 0.5);
        container.add(text);

        // Анимация появления
        container.setAlpha(0);
        container.setY(y - 20);
        this.scene.tweens.add({
            targets: container,
            alpha: 1,
            y: y,
            duration: 400,
            ease: 'Cubic.easeOut',
        });

        // Авто-скрытие
        const closeTimer = this.scene.time.delayedCall(hint.duration, () => {
            this._hideHint(container, onComplete);
        });

        // Сохраняем ссылку для возможного принудительного закрытия
        this.activeOverlays.push({ container, closeTimer });
    }

    _hideHint(container, onComplete) {
        if (!container || !container.scene) {
            if (onComplete) onComplete();
            return;
        }
        this.scene.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 20,
            duration: 300,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                container.destroy();
                if (onComplete) onComplete();
            },
        });
        // Удаляем из activeOverlays
        this.activeOverlays = this.activeOverlays.filter((o) => o.container !== container);
    }

    /**
     * Принудительно закрыть все подсказки (например, при выходе из сцены).
     */
    destroyAll() {
        this.activeOverlays.forEach((o) => {
            if (o.closeTimer) o.closeTimer.remove();
            if (o.container && o.container.scene) o.container.destroy();
        });
        this.activeOverlays = [];
    }
}

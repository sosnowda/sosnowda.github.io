// CharacterAppearanceScene.js — простая сцена выбора внешности персонажа.
// П.11: Открывается после выбора героя (пресет или случайный).
// П.4: Игрок выбирает цвета (волосы, одежда, кожа) — применяется как tint к спрайту.
//
// Это упрощённая версия LPC-генератора: вместо сложного композитинга слоёв
// используем tint существующего спрайта 'player' (или 'npc_*' по выбору архетипа).

import { RUS } from '../config/RusTheme.js';
import { createButton } from '../utils/ui.js';

// Палитры цветов (Phaser tint — 0xRRGGBB)
const SKIN_COLORS = [
    { name: 'Светлая',   tint: 0xffe0c0 },
    { name: 'Загорелая', tint: 0xe0b888 },
    { name: 'Смуглая',   tint: 0xc89868 },
    { name: 'Тёмная',    tint: 0x8a5e3a },
];

const HAIR_COLORS = [
    { name: 'Чёрные',    tint: 0x2a1a0e },
    { name: 'Тёмно-русые', tint: 0x5a3a1e },
    { name: 'Русые',     tint: 0x8a6a3e },
    { name: 'Светлые',   tint: 0xc8a868 },
    { name: 'Рыжие',     tint: 0xa04020 },
    { name: 'Седые',     tint: 0xc0c0c0 },
];

const CLOTH_COLORS = [
    { name: 'Красный',   tint: 0x8c2f1d },
    { name: 'Синий',     tint: 0x2a4a6a },
    { name: 'Зелёный',   tint: 0x3a5a3a },
    { name: 'Коричневый', tint: 0x5a3a22 },
    { name: 'Серый',     tint: 0x4a4a4a },
    { name: 'Бордовый',  tint: 0x5a1a3a },
    { name: 'Охра',      tint: 0x8a6a2a },
    { name: 'Чёрный',    tint: 0x2a2a2a },
];

const SPRITE_VARIANTS = [
    { name: 'Путник (муж)', key: 'player' },
    { name: 'Старейшина', key: 'npc_elder' },
    { name: 'Купец',      key: 'npc_merchant' },
    { name: 'Воин',       key: 'npc_soldier' },
];

export class CharacterAppearanceScene extends Phaser.Scene {
    constructor() {
        super('CharacterAppearance');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);

        // Текущий выбор
        this.player = this.registry.get('player');
        this.selectedSprite = (this.player && this.player.sprite) || 'player';
        this.skinIdx = 0;
        this.hairIdx = 0;
        this.clothIdx = 0;

        // Заголовок
        this.add.text(width / 2, 30, '🎨 Настройка внешности', {
            fontFamily: 'Georgia, serif',
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 70,
            'Выберите тип персонажа и цвета. Изменения применятся к спрайту в игре.',
            {
                fontSize: '14px', color: RUS.textDim,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5, 0);

        // === Превью спрайта (центр) ===
        this.previewX = width / 2;
        this.previewY = height / 2 - 20;
        // Рамка
        this.add.rectangle(this.previewX, this.previewY, 200, 220, 0x1a140e, 0.9)
            .setStrokeStyle(2, 0xc9a14a);
        this.add.text(this.previewX, this.previewY - 115, 'Предпросмотр', {
            fontSize: '13px', color: RUS.textDim,
        }).setOrigin(0.5);

        // Спрайт-превью
        this.previewSprite = this.add.sprite(this.previewX, this.previewY, this.selectedSprite, 0);
        this.previewSprite.setScale(2.5);
        // Анимация idle
        const animKey = `${this.selectedSprite}_idle_down`;
        if (this.anims.exists(animKey)) {
            this.previewSprite.play(animKey);
        }
        // Покачивание
        this.tweens.add({
            targets: this.previewSprite,
            y: { from: this.previewY, to: this.previewY - 4 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // Имя персонажа
        this.charName = (this.player && this.player.name) || 'Путник';
        this.nameText = this.add.text(this.previewX, this.previewY + 130, this.charName, {
            fontSize: '18px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        this.nameText.setInteractive({ useHandCursor: true });
        this.nameText.on('pointerdown', () => this.editName());

        // === Выбор типа спрайта (слева) ===
        const leftX = 150;
        let y = 130;
        this.add.text(leftX, y, 'Тип персонажа:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        y += 35;
        SPRITE_VARIANTS.forEach((v, i) => {
            createButton(this, leftX, y + i * 40, v.name, () => {
                this.selectedSprite = v.key;
                this.updatePreview();
            }, {
                backgroundColor: this.selectedSprite === v.key ? RUS.accent : 0x4a3520,
                hoverColor: this.selectedSprite === v.key ? RUS.accentLight : 0x5a4530,
                textColor: RUS.text, fontSize: 13,
                padding: { left: 12, right: 12, top: 6, bottom: 6 },
            });
        });
        this.spriteBtnY = y;

        // === Выбор цвета кожи (справа, верх) ===
        const rightX = width - 150;
        y = 130;
        this.add.text(rightX, y, 'Цвет кожи:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        y += 30;
        // Палитра — 4 кружка в ряд
        this.skinCircles = [];
        SKIN_COLORS.forEach((c, i) => {
            const cx = rightX - 75 + i * 50;
            const circle = this.add.circle(cx, y + 15, 18, c.tint)
                .setStrokeStyle(2, 0xc9a14a);
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.skinIdx = i;
                this.updatePreview();
                this.highlightSelection();
            });
            this.skinCircles.push(circle);
        });

        // === Цвет волос (справа, середина) ===
        y += 60;
        this.add.text(rightX, y, 'Цвет волос:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        y += 30;
        this.hairCircles = [];
        HAIR_COLORS.forEach((c, i) => {
            const cx = rightX - 125 + i * 50;
            const circle = this.add.circle(cx, y + 15, 18, c.tint)
                .setStrokeStyle(2, 0xc9a14a);
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.hairIdx = i;
                this.updatePreview();
                this.highlightSelection();
            });
            this.hairCircles.push(circle);
        });

        // === Цвет одежды (справа, низ) ===
        y += 60;
        this.add.text(rightX, y, 'Цвет одежды:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        y += 30;
        this.clothCircles = [];
        CLOTH_COLORS.forEach((c, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const cx = rightX - 75 + col * 50;
            const cy = y + 15 + row * 50;
            const circle = this.add.circle(cx, cy, 18, c.tint)
                .setStrokeStyle(2, 0xc9a14a);
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.clothIdx = i;
                this.updatePreview();
                this.highlightSelection();
            });
            this.clothCircles.push(circle);
        });

        // Подписи цветов под палитрами
        this.skinLabel = this.add.text(rightX, height / 2 + 80, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);
        this.hairLabel = this.add.text(rightX, height / 2 + 100, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);
        this.clothLabel = this.add.text(rightX, height / 2 + 120, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);

        // === Кнопка "Случайно" ===
        createButton(this, width / 2, height - 110, '🎲 Случайный облик', () => {
            this.skinIdx = Math.floor(Math.random() * SKIN_COLORS.length);
            this.hairIdx = Math.floor(Math.random() * HAIR_COLORS.length);
            this.clothIdx = Math.floor(Math.random() * CLOTH_COLORS.length);
            const variants = SPRITE_VARIANTS.length;
            const idx = Math.floor(Math.random() * variants);
            this.selectedSprite = SPRITE_VARIANTS[idx].key;
            this.updatePreview();
            this.highlightSelection();
            // Обновляем цвета кнопок типа персонажа
            this.refreshSpriteButtons();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        // === Кнопки внизу ===
        createButton(this, 100, height - 40, '◀ Назад', () => {
            this.scene.start('CharacterSelection');
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        });

        createButton(this, width - 130, height - 40, 'Подтвердить ▶', () => {
            this.confirmAppearance();
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        // Первичная отрисовка
        this.updatePreview();
        this.highlightSelection();
    }

    /**
     * Обновить превью — применить tint к спрайту.
     */
    updatePreview() {
        // Меняем текстуру спрайта
        if (this.textures.exists(this.selectedSprite)) {
            this.previewSprite.setTexture(this.selectedSprite);
            const animKey = `${this.selectedSprite}_idle_down`;
            if (this.anims.exists(animKey)) {
                this.previewSprite.play(animKey);
            }
        }
        // Композитный tint: смешиваем кожу, волосы, одежду
        // Phaser tint работает как мультипликативный фильтр — нельзя применить 3 цвета одновременно.
        // Решение: используем только цвет одежды как основной tint (самый заметный).
        const clothTint = CLOTH_COLORS[this.clothIdx].tint;
        this.previewSprite.setTint(clothTint);

        // Обновляем подписи
        this.skinLabel.setText(`Кожа: ${SKIN_COLORS[this.skinIdx].name}`);
        this.hairLabel.setText(`Волосы: ${HAIR_COLORS[this.hairIdx].name}`);
        this.clothLabel.setText(`Одежда: ${CLOTH_COLORS[this.clothIdx].name}`);
    }

    /**
     * Подсветить выбранные кружки (более толстая обводка).
     */
    highlightSelection() {
        this.skinCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.skinIdx ? 4 : 2, i === this.skinIdx ? 0xffffff : 0xc9a14a);
        });
        this.hairCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.hairIdx ? 4 : 2, i === this.hairIdx ? 0xffffff : 0xc9a14a);
        });
        this.clothCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.clothIdx ? 4 : 2, i === this.clothIdx ? 0xffffff : 0xc9a14a);
        });
    }

    /**
     * Обновить цвета кнопок выбора типа спрайта.
     */
    refreshSpriteButtons() {
        // Удаляем старые кнопки и перерисовываем
        this.children.list.filter(c => c.depth === 0 && c.type === 'Container' &&
            c.y >= this.spriteBtnY && c.y < this.spriteBtnY + SPRITE_VARIANTS.length * 40)
            .forEach(c => c.destroy());
        // Простое решение: перезапускаем сцену
        this.scene.restart();
    }

    editName() {
        const newName = window.prompt('Введите имя персонажа:', this.charName);
        if (newName && newName.trim().length > 0) {
            this.charName = newName.trim().slice(0, 24);
            this.nameText.setText(this.charName);
            if (this.player) {
                this.player.name = this.charName;
            }
        }
    }

    /**
     * Подтвердить выбор и начать игру.
     */
    confirmAppearance() {
        // Сохраняем выбор в player
        if (this.player) {
            this.player.sprite = this.selectedSprite;
            this.player.appearance = {
                skin: SKIN_COLORS[this.skinIdx],
                hair: HAIR_COLORS[this.hairIdx],
                cloth: CLOTH_COLORS[this.clothIdx],
            };
            this.player.name = this.charName;
            this.registry.set('player', this.player);
        }
        // Переход в деревню
        this.scene.start('Village');
    }
}

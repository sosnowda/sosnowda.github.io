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
        // П.1-2: Используем image вместо sprite — показывает canvas-текстуру
        // с раздельными tint-регионами (волосы/кожа/одежда).
        this.previewX = width / 2;
        this.previewY = height / 2 - 20;
        // Рамка
        this.add.rectangle(this.previewX, this.previewY, 200, 220, 0x1a140e, 0.9)
            .setStrokeStyle(2, 0xc9a14a);
        this.add.text(this.previewX, this.previewY - 115, 'Предпросмотр', {
            fontSize: '13px', color: RUS.textDim,
        }).setOrigin(0.5);

        // П.1-2: Сначала генерируем canvas-текстуру, потом создаём image.
        // Это гарантия, что 'preview_composite' существует к моменту создания image.
        this.generateCompositeTexture();
        this.previewImage = this.add.image(this.previewX, this.previewY, 'preview_composite');
        this.previewImage.setScale(3);
        // Покачивание
        this.tweens.add({
            targets: this.previewImage,
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
            // П.1-2: НЕ меняем selectedSprite при случайной генерации —
            // это避免 сброса через scene.restart(). Только цвета.
            this.updatePreview();
            this.highlightSelection();
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
     * Обновить превью — перерисовать canvas с раздельными tint-регионами.
     * П.1-2: Каждый цвет (волосы/кожа/одежда) применяется к своему региону спрайта.
     *
     * Регионы (для спрайта 64×64, idle_down):
     *   y = 0..14   — волосы (макушка)
     *   y = 14..26  — лицо/кожа
     *   y = 26..64  — тело/одежда
     */
    updatePreview() {
        // Перерисовываем canvas-текстуру
        this.generateCompositeTexture();
        // Обновляем image превью
        if (this.previewImage) {
            this.previewImage.setTexture('preview_composite');
        }
        // Обновляем подписи
        this.updateLabels();
    }

    /**
     * Создать/пересоздать canvas-текстуру 'preview_composite' с раздельными tint-регионами.
     */
    generateCompositeTexture() {
        const skinTint = SKIN_COLORS[this.skinIdx].tint;
        const hairTint = HAIR_COLORS[this.hairIdx].tint;
        const clothTint = CLOTH_COLORS[this.clothIdx].tint;

        // Получаем базовый спрайт (нужен frame 0 = idle_down)
        const baseKey = this.textures.exists(this.selectedSprite) ? this.selectedSprite : 'player';
        const baseTex = this.textures.get(baseKey);
        if (!baseTex || !baseTex.source || !baseTex.source[0]) {
            console.warn('Базовый спрайт не найден:', baseKey);
            return;
        }
        const baseImage = baseTex.source[0].image;

        // Создаём canvas 64×64
        const FS = 64;
        if (this.textures.exists('preview_composite')) {
            this.textures.remove('preview_composite');
        }
        const canvas = document.createElement('canvas');
        canvas.width = FS;
        canvas.height = FS;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // 1. Рисуем базовый спрайт целиком (frame 0 — первый кадр)
        try {
            ctx.drawImage(baseImage, 0, 0, FS, FS, 0, 0, FS, FS);
        } catch (e) {
            console.warn('Не удалось нарисовать базовый спрайт:', e);
            return;
        }

        // 2. tint волос к верхней части (y = 0..14) — макушка
        this.applyRegionTint(ctx, 0, 0, FS, 14, hairTint, 0.8);

        // 3. tint кожи к середине (y = 14..26) — лицо
        this.applyRegionTint(ctx, 0, 14, FS, 12, skinTint, 0.7);

        // 4. tint одежды к нижней части (y = 26..64) — тело
        this.applyRegionTint(ctx, 0, 26, FS, 38, clothTint, 0.75);

        // 5. Регистрируем canvas как Phaser-текстуру
        this.textures.addCanvas('preview_composite', canvas);
    }

    /**
     * Применить tint к региону canvas через source-atop + clip.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x, y, w, h — регион
     * @param {number} tint — цвет в формате 0xRRGGBB
     * @param {number} alpha — сила применения (0..1)
     */
    applyRegionTint(ctx, x, y, w, h, tint, alpha) {
        ctx.save();
        // Clip-регион
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        // source-atop: рисуем только там, где уже есть непрозрачные пиксели
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = alpha;
        const hex = '#' + tint.toString(16).padStart(6, '0');
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    /**
     * Обновить текстовые подписи цветов.
     */
    updateLabels() {
        if (this.skinLabel) this.skinLabel.setText(`Кожа: ${SKIN_COLORS[this.skinIdx].name}`);
        if (this.hairLabel) this.hairLabel.setText(`Волосы: ${HAIR_COLORS[this.hairIdx].name}`);
        if (this.clothLabel) this.clothLabel.setText(`Одежда: ${CLOTH_COLORS[this.clothIdx].name}`);
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
     * Создаёт композитную текстуру 'player_composite' для использования в игре.
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

        // П.1-2: Создаём композитную текстуру 'player_composite' для игры.
        // Это статичный кадр (frame 0 = idle_down) с раздельными tint-регионами.
        // В VillageScene/InteriorScene будем использовать его как image (не sprite).
        this.generatePlayerCompositeTexture();
        // Помечаем player.useComposite = true, чтобы сцены знали, что использовать композит
        if (this.player) {
            this.player.useComposite = this.textures.exists('player_composite');
            this.registry.set('player', this.player);
        }

        // Переход в деревню
        this.scene.start('Village');
    }

    /**
     * Создать композитную текстуру 'player_composite' для использования в игре.
     * Использует те же цвета, что и превью.
     */
    generatePlayerCompositeTexture() {
        const skinTint = SKIN_COLORS[this.skinIdx].tint;
        const hairTint = HAIR_COLORS[this.hairIdx].tint;
        const clothTint = CLOTH_COLORS[this.clothIdx].tint;

        const baseKey = this.textures.exists(this.selectedSprite) ? this.selectedSprite : 'player';
        const baseTex = this.textures.get(baseKey);
        if (!baseTex || !baseTex.source || !baseTex.source[0]) {
            console.warn('Базовый спрайт не найден для композита:', baseKey);
            return;
        }
        const baseImage = baseTex.source[0].image;

        const FS = 64;
        if (this.textures.exists('player_composite')) {
            this.textures.remove('player_composite');
        }
        const canvas = document.createElement('canvas');
        canvas.width = FS;
        canvas.height = FS;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        try {
            ctx.drawImage(baseImage, 0, 0, FS, FS, 0, 0, FS, FS);
        } catch (e) {
            console.warn('Не удалось создать player_composite:', e);
            return;
        }

        // Те же регионы, что в превью
        this.applyRegionTint(ctx, 0, 0, FS, 14, hairTint, 0.8);
        this.applyRegionTint(ctx, 0, 14, FS, 12, skinTint, 0.7);
        this.applyRegionTint(ctx, 0, 26, FS, 38, clothTint, 0.75);

        this.textures.addCanvas('player_composite', canvas);
    }
}

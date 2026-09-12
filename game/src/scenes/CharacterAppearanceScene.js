// CharacterAppearanceScene.js — расширенная сцена выбора внешности персонажа.
// П.1-3: Больше вариантов кастомизации, раздельные куртка/штаны, готовые пресеты.
//
// Регионы спрайта 64×64 (idle_down):
//   y = 0..14   — волосы (макушка)
//   y = 14..26  — лицо/кожа
//   y = 26..42  — куртка (верхняя часть тела)
//   y = 42..64  — штаны (нижняя часть тела)

import { RUS } from '../config/RusTheme.js';
import { createButton } from '../utils/ui.js';

// Палитры цветов (Phaser tint — 0xRRGGBB)
const SKIN_COLORS = [
    { name: 'Светлая',     tint: 0xffe0c0 },
    { name: 'Бледная',     tint: 0xf0d0b0 },
    { name: 'Загорелая',   tint: 0xe0b888 },
    { name: 'Смуглая',     tint: 0xc89868 },
    { name: 'Тёмная',      tint: 0xa07050 },
    { name: 'Очень тёмная', tint: 0x8a5e3a },
];

const HAIR_COLORS = [
    { name: 'Чёрные',      tint: 0x2a1a0e },
    { name: 'Тёмно-русые', tint: 0x5a3a1e },
    { name: 'Русые',       tint: 0x8a6a3e },
    { name: 'Светло-русые', tint: 0xa88858 },
    { name: 'Светлые',     tint: 0xc8a868 },
    { name: 'Блонд',       tint: 0xe8c878 },
    { name: 'Рыжие',       tint: 0xa04020 },
    { name: 'Тёмно-рыжие', tint: 0x80301a },
    { name: 'Каштановые',  tint: 0x6a4220 },
    { name: 'Седые',       tint: 0xc0c0c0 },
    { name: 'Белые',       tint: 0xe8e8e8 },
    { name: 'Синие (маг)', tint: 0x3a4a8a },
];

// П.2: Куртка и штаны — раздельные палитры
const JACKET_COLORS = [
    { name: 'Красная',     tint: 0x8c2f1d },
    { name: 'Тёмно-красная', tint: 0x6a2010 },
    { name: 'Синяя',       tint: 0x2a4a6a },
    { name: 'Тёмно-синяя', tint: 0x1a2a4a },
    { name: 'Зелёная',     tint: 0x3a5a3a },
    { name: 'Тёмно-зелёная', tint: 0x2a3a2a },
    { name: 'Коричневая',  tint: 0x5a3a22 },
    { name: 'Тёмно-коричневая', tint: 0x3a2212 },
    { name: 'Серая',       tint: 0x4a4a4a },
    { name: 'Бордовая',    tint: 0x5a1a3a },
    { name: 'Охра',        tint: 0x8a6a2a },
    { name: 'Чёрная',      tint: 0x2a2a2a },
    { name: 'Белая',       tint: 0xc8c8c8 },
    { name: 'Фиолетовая',  tint: 0x4a2a5a },
    { name: 'Бирюзовая',   tint: 0x2a6a6a },
    { name: 'Оранжевая',   tint: 0xa85a1a },
];

const PANTS_COLORS = [
    { name: 'Чёрные',      tint: 0x2a2a2a },
    { name: 'Тёмно-серые', tint: 0x3a3a3a },
    { name: 'Серые',       tint: 0x5a5a5a },
    { name: 'Коричневые',  tint: 0x4a2a1a },
    { name: 'Тёмно-коричневые', tint: 0x2a1a0a },
    { name: 'Синие',       tint: 0x2a3a5a },
    { name: 'Зелёные',     tint: 0x2a4a2a },
    { name: 'Бежевые',     tint: 0x8a7a5a },
    { name: 'Белые',       tint: 0xc8c8c8 },
    { name: 'Бордовые',    tint: 0x4a1a2a },
];

// П.3: Готовые пресеты внешнего вида
const PRESETS = [
    { name: 'Купец',     sprite: 'npc_merchant', skin: 1, hair: 4, jacket: 6,  pants: 3 },
    { name: 'Воин',      sprite: 'npc_soldier',  skin: 2, hair: 0, jacket: 0,  pants: 0 },
    { name: 'Старейшина', sprite: 'npc_elder',   skin: 0, hair: 8, jacket: 7,  pants: 4 },
    { name: 'Крестьянин', sprite: 'player',      skin: 2, hair: 1, jacket: 6,  pants: 4 },
    { name: 'Путник',    sprite: 'player',       skin: 1, hair: 2, jacket: 10, pants: 0 },
    { name: 'Дружинник', sprite: 'npc_soldier',  skin: 3, hair: 0, jacket: 1,  pants: 0 },
    { name: 'Священник', sprite: 'npc_elder',    skin: 0, hair: 9, jacket: 12, pants: 0 },
    { name: 'Торговец',  sprite: 'npc_merchant', skin: 1, hair: 3, jacket: 10, pants: 7 },
];

const SPRITE_VARIANTS = [
    { name: 'Путник',     key: 'player' },
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
        this.jacketIdx = 0;  // П.2: куртка (вместо clothIdx)
        this.pantsIdx = 0;   // П.2: штаны (новое)

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

        // === П.2: Цвет куртки (справа, середина-низ) ===
        y += 50;
        this.add.text(rightX, y, 'Цвет куртки:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        y += 30;
        this.jacketCircles = [];
        JACKET_COLORS.forEach((c, i) => {
            const col = i % 8;
            const row = Math.floor(i / 8);
            const cx = rightX - 175 + col * 50;
            const cy = y + 15 + row * 45;
            const circle = this.add.circle(cx, cy, 16, c.tint)
                .setStrokeStyle(2, 0xc9a14a);
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.jacketIdx = i;
                this.updatePreview();
                this.highlightSelection();
            });
            this.jacketCircles.push(circle);
        });

        // === П.2: Цвет штанов (справа, низ) ===
        y += 95;
        this.add.text(rightX, y, 'Цвет штанов:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        y += 30;
        this.pantsCircles = [];
        PANTS_COLORS.forEach((c, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const cx = rightX - 100 + col * 50;
            const cy = y + 15 + row * 45;
            const circle = this.add.circle(cx, cy, 16, c.tint)
                .setStrokeStyle(2, 0xc9a14a);
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.pantsIdx = i;
                this.updatePreview();
                this.highlightSelection();
            });
            this.pantsCircles.push(circle);
        });

        // Подписи цветов под палитрами
        this.skinLabel = this.add.text(rightX, height / 2 + 80, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);
        this.hairLabel = this.add.text(rightX, height / 2 + 100, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);
        this.jacketLabel = this.add.text(rightX, height / 2 + 120, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);
        this.pantsLabel = this.add.text(rightX, height / 2 + 140, '', {
            fontSize: '13px', color: RUS.text,
        }).setOrigin(0.5);

        // === П.3: Готовые пресеты (внизу слева) ===
        const presetX = 150;
        const presetY = height - 280;
        this.add.text(presetX, presetY, 'Готовые варианты:', {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        PRESETS.forEach((p, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const px = presetX - 80 + col * 160;
            const py = presetY + 30 + row * 32;
            createButton(this, px, py, p.name, () => {
                this.selectedSprite = p.sprite;
                this.skinIdx = p.skin;
                this.hairIdx = p.hair;
                this.jacketIdx = p.jacket;
                this.pantsIdx = p.pants;
                this.updatePreview();
                this.highlightSelection();
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 12, padding: { left: 8, right: 8, top: 5, bottom: 5 },
            });
        });

        // === Кнопка "Случайно" ===
        createButton(this, width / 2, height - 110, '🎲 Случайный облик', () => {
            this.skinIdx = Math.floor(Math.random() * SKIN_COLORS.length);
            this.hairIdx = Math.floor(Math.random() * HAIR_COLORS.length);
            this.jacketIdx = Math.floor(Math.random() * JACKET_COLORS.length);
            this.pantsIdx = Math.floor(Math.random() * PANTS_COLORS.length);
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
     * П.1-2: Каждый цвет (волосы/кожа/куртка/штаны) применяется к своему региону спрайта.
     *
     * Регионы (для спрайта 64×64, idle_down):
     *   y = 0..14   — волосы (макушка)
     *   y = 14..26  — лицо/кожа
     *   y = 26..42  — куртка (верхняя часть тела)
     *   y = 42..64  — штаны (нижняя часть тела)
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
        const jacketTint = JACKET_COLORS[this.jacketIdx].tint;
        const pantsTint = PANTS_COLORS[this.pantsIdx].tint;

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

        // П.2: 4. tint куртки к верхней части тела (y = 26..42)
        this.applyRegionTint(ctx, 0, 26, FS, 16, jacketTint, 0.75);

        // П.2: 5. tint штанов к нижней части тела (y = 42..64)
        this.applyRegionTint(ctx, 0, 42, FS, 22, pantsTint, 0.75);

        // 6. Регистрируем canvas как Phaser-текстуру
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
        if (this.jacketLabel) this.jacketLabel.setText(`Куртка: ${JACKET_COLORS[this.jacketIdx].name}`);
        if (this.pantsLabel) this.pantsLabel.setText(`Штаны: ${PANTS_COLORS[this.pantsIdx].name}`);
    }

    /**
     * Подсветить выбранные кружки (более толстая обводка).
     */
    highlightSelection() {
        if (this.skinCircles) this.skinCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.skinIdx ? 4 : 2, i === this.skinIdx ? 0xffffff : 0xc9a14a);
        });
        if (this.hairCircles) this.hairCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.hairIdx ? 4 : 2, i === this.hairIdx ? 0xffffff : 0xc9a14a);
        });
        if (this.jacketCircles) this.jacketCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.jacketIdx ? 4 : 2, i === this.jacketIdx ? 0xffffff : 0xc9a14a);
        });
        if (this.pantsCircles) this.pantsCircles.forEach((c, i) => {
            c.setStrokeStyle(i === this.pantsIdx ? 4 : 2, i === this.pantsIdx ? 0xffffff : 0xc9a14a);
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
                jacket: JACKET_COLORS[this.jacketIdx],
                pants: PANTS_COLORS[this.pantsIdx],
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
        const jacketTint = JACKET_COLORS[this.jacketIdx].tint;
        const pantsTint = PANTS_COLORS[this.pantsIdx].tint;

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

        // Те же регионы, что в превью (волосы/кожа/куртка/штаны)
        this.applyRegionTint(ctx, 0, 0, FS, 14, hairTint, 0.8);
        this.applyRegionTint(ctx, 0, 14, FS, 12, skinTint, 0.7);
        this.applyRegionTint(ctx, 0, 26, FS, 16, jacketTint, 0.75);
        this.applyRegionTint(ctx, 0, 42, FS, 22, pantsTint, 0.75);

        this.textures.addCanvas('player_composite', canvas);
    }
}

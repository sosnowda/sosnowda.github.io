// CharacterGeneratorScene.js — экран создания персонажа через LPC-генератор.
// Игрок выбирает тело, прическу, одежду, штаны, обувь, бороду, глаза —
// и видит живой предпросмотр. После подтверждения композитный spritesheet
// сохраняется в реестре как player.appearance и используется в VillageScene.
//
// Источник LPC: Universal LPC Spritesheet Character Generator
// https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator
// Лицензия: CC-BY-SA 3.0 / GPL 3.0

import { RUS } from '../config/RusTheme.js';
import { createButton } from '../utils/ui.js';
import {
    loadAllLpcLayers, composeCharacterTexture,
    createCustomCharacterAnimations,
    randomAppearance, defaultAppearance,
} from '../systems/CharacterAppearance.js';
import { createCharacter } from '../systems/Character.js';
import { ActionLog } from '../data/actionLog.js';
import { initThiefHunt } from '../data/thief.js';
import { resetVillageName } from '../data/world.js';
import { initTime, createRandomStartDate } from '../systems/TimeSystem.js';
import { initNpcNames } from '../data/npcNames.js';
import { initReputation } from '../data/reputation.js';
import AudioManager from '../systems/AudioManager.js';

const CAT_LABELS = {
    body: 'Телосложение',
    eyes: 'Глаза',
    beards: 'Борода',
    hair: 'Прическа',
    legs: 'Штаны',
    feet: 'Обувь',
    torso: 'Одежда',
};

const CAT_ORDER = ['body', 'eyes', 'beards', 'hair', 'legs', 'feet', 'torso'];

export class CharacterGeneratorScene extends Phaser.Scene {
    constructor() {
        super('CharacterGenerator');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);

        // Состояние
        this.sex = 'male';
        this.appearance = {};
        this.manifest = this.cache.json.get('lpc_manifest') || { categories: {} };
        this.currentIndex = {}; // category -> index в options[]
        this.layersReady = false;
        this.previewSprite = null;

        // Заголовок
        this.add.text(width / 2, 30, '🎨 Создание персонажа (LPC)', {
            fontFamily: 'Georgia, serif',
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        // Подсказка загрузки
        this.loadingText = this.add.text(width / 2, height / 2, 'Загрузка LPC-слоёв...', {
            fontSize: '20px', color: RUS.text,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        this.loadingBar = this.add.rectangle(width / 2, height / 2 + 30, 400, 12, 0x000000, 0.5)
            .setStrokeStyle(1, RUS.border);
        this.loadingFill = this.add.rectangle(width / 2 - 200, height / 2 + 30, 4, 10, RUS.border)
            .setOrigin(0, 0.5);

        // Начинаем загрузку слоёв
        this.loadLpcLayers();
    }

    async loadLpcLayers() {
        try {
            await loadAllLpcLayers(this, (frac) => {
                this.loadingFill.width = 400 * frac;
            });
        } catch (e) {
            console.warn('LPC layer loading had errors:', e);
        }
        this.loadingText.setVisible(false);
        this.loadingBar.setVisible(false);
        this.loadingFill.setVisible(false);
        this.layersReady = true;
        this.buildUi();
    }

    buildUi() {
        const { width, height } = this.scale;

        // Дефолтная внешность
        this.appearance = defaultAppearance(this.manifest, this.sex);
        // Инициализируем индексы
        for (const cat of CAT_ORDER) {
            const opts = this.getFilteredOptions(cat);
            const cur = this.appearance[cat];
            this.currentIndex[cat] = Math.max(0, opts.indexOf(cur));
            if (opts.length > 0) this.appearance[cat] = opts[this.currentIndex[cat]];
        }

        // === Превью персонажа (большой спрайт по центру) ===
        this.previewScale = 4; // 64 × 4 = 256 px
        this.previewX = width / 2;
        this.previewY = height / 2 - 30;
        // Рамка под превью
        this.add.rectangle(this.previewX, this.previewY, 280, 280, 0x1a140e, 0.9)
            .setStrokeStyle(2, RUS.border);
        this.add.text(this.previewX, this.previewY - 145, 'Предпросмотр', {
            fontSize: '14px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // Имя персонажа
        this.characterName = 'Путник';
        this.nameInput = this.add.text(this.previewX, this.previewY + 150, this.characterName, {
            fontSize: '20px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
            padding: { x: 12, y: 6 },
        }).setOrigin(0.5);
        this.nameInput.setInteractive({ useHandCursor: true });
        this.nameInput.on('pointerdown', () => this.editName());

        // === Переключатель пола ===
        const sexY = 100;
        this.add.text(width / 2 - 100, sexY, 'Пол:', {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(1, 0.5);
        createButton(this, width / 2 - 60, sexY, '♂ Муж', () => {
            this.sex = 'male';
            this.rebuildAppearanceForSex();
        }, {
            backgroundColor: this.sex === 'male' ? RUS.accent : 0x4a3520,
            hoverColor: this.sex === 'male' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });
        createButton(this, width / 2 + 30, sexY, '♀ Жен', () => {
            this.sex = 'female';
            this.rebuildAppearanceForSex();
        }, {
            backgroundColor: this.sex === 'female' ? RUS.accent : 0x4a3520,
            hoverColor: this.sex === 'female' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });

        // === Кнопки выбора категорий (слева) ===
        this.catButtonsY = 160;
        this.categoryButtons = [];
        CAT_ORDER.forEach((cat, i) => {
            const bx = 100;
            const by = this.catButtonsY + i * 50;
            const btn = createButton(this, bx, by, CAT_LABELS[cat], () => {
                this.activeCategory = cat;
                this.refreshCategoryButtons();
                this.drawOptionPanel();
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
            });
            this.categoryButtons.push({ cat, btn });
        });
        this.activeCategory = 'body';

        // === Панель опций (справа) — рисуется динамически ===
        this.optionPanel = this.add.container(0, 0);
        this.optionPanel.x = width - 180;

        // === Кнопки навигации по опциям ===
        // «◀ Пред» и «След ▶» для текущей категории
        createButton(this, width - 240, height - 180, '◀ Пред', () => {
            this.cycleOption(-1);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
        });
        createButton(this, width - 120, height - 180, 'След ▶', () => {
            this.cycleOption(1);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
        });

        // === Кнопка "Случайно" ===
        createButton(this, width / 2, height - 110, '🎲 Случайный облик', () => {
            this.appearance = randomAppearance(this.manifest, this.sex);
            // Обновим индексы
            for (const cat of CAT_ORDER) {
                const opts = this.getFilteredOptions(cat);
                this.currentIndex[cat] = Math.max(0, opts.indexOf(this.appearance[cat]));
            }
            this.refreshCategoryButtons();
            this.drawOptionPanel();
            this.updatePreview();
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
            this.confirmCharacter();
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        // Первичная отрисовка
        this.refreshCategoryButtons();
        this.drawOptionPanel();
        this.updatePreview();
    }

    /**
     * Получить отфильтрованные опции для категории с учётом пола.
     */
    getFilteredOptions(cat) {
        const opts = (this.manifest.categories[cat] || {}).options || [];
        if (cat === 'body') {
            return opts.filter(o => o.startsWith(this.sex + '_'));
        }
        if (cat === 'beards' && this.sex === 'female') {
            return []; // без бороды для женщин
        }
        return opts;
    }

    rebuildAppearanceForSex() {
        // При смене пола — пересобираем внешность
        this.appearance = defaultAppearance(this.manifest, this.sex);
        for (const cat of CAT_ORDER) {
            const opts = this.getFilteredOptions(cat);
            this.currentIndex[cat] = Math.max(0, opts.indexOf(this.appearance[cat]));
            if (opts.length > 0) this.appearance[cat] = opts[this.currentIndex[cat]];
            else delete this.appearance[cat];
        }
        this.refreshCategoryButtons();
        this.drawOptionPanel();
        this.updatePreview();
    }

    refreshCategoryButtons() {
        this.categoryButtons.forEach(({ cat, btn }) => {
            // Меняем цвет активной категории
            // (кнопка уже создана, мы не можем изменить цвет напрямую —
            // перерисуем через tint)
            const isActive = cat === this.activeCategory;
            // Найдём фон кнопки и обновим
            // Упрощённо: используем setTint
            btn.setTint(isActive ? RUS.accent : 0xffffff);
        });
    }

    drawOptionPanel() {
        this.optionPanel.removeAll(true);
        const cat = this.activeCategory;
        const opts = this.getFilteredOptions(cat);
        if (opts.length === 0) {
            const t = this.add.text(0, 0, '(нет опций)', {
                fontSize: '14px', color: RUS.textDim,
            }).setOrigin(0.5);
            this.optionPanel.add(t);
            return;
        }
        // Список до 6 опций с прокруткой
        const maxShow = 8;
        const startIdx = Math.max(0, this.currentIndex[cat] - 3);
        const endIdx = Math.min(opts.length, startIdx + maxShow);
        const topY = this.catButtonsY - 20;
        for (let i = startIdx; i < endIdx; i++) {
            const optName = opts[i];
            const yi = topY + (i - startIdx) * 32;
            const isActive = i === this.currentIndex[cat];
            const txt = this.add.text(0, yi, this.shortLabel(optName), {
                fontSize: '13px',
                color: isActive ? '#c9a14a' : RUS.text,
                fontStyle: isActive ? 'bold' : 'normal',
                stroke: '#000', strokeThickness: 1,
                padding: { x: 6, y: 3 },
                backgroundColor: isActive ? '#00000099' : '#00000055',
            }).setOrigin(0.5, 0.5);
            txt.setInteractive({ useHandCursor: true });
            txt.on('pointerdown', () => {
                this.currentIndex[cat] = i;
                this.appearance[cat] = opts[i];
                this.drawOptionPanel();
                this.updatePreview();
            });
            this.optionPanel.add(txt);
        }
        // Счётчик
        const counter = this.add.text(0, topY + maxShow * 32 + 10,
            `${this.currentIndex[cat] + 1} / ${opts.length}`, {
                fontSize: '12px', color: RUS.textDim,
            }).setOrigin(0.5);
        this.optionPanel.add(counter);
    }

    shortLabel(optName) {
        // body_male_white → "white (male)"
        // hair_long_blonde → "long blonde"
        const parts = optName.split('_');
        if (parts.length >= 2) {
            return parts.slice(-2).join(' ');
        }
        return optName;
    }

    cycleOption(delta) {
        const cat = this.activeCategory;
        const opts = this.getFilteredOptions(cat);
        if (opts.length === 0) return;
        this.currentIndex[cat] = (this.currentIndex[cat] + delta + opts.length) % opts.length;
        this.appearance[cat] = opts[this.currentIndex[cat]];
        this.drawOptionPanel();
        this.updatePreview();
    }

    /**
     * Обновить превью — перерисовать композитный спрайт.
     */
    updatePreview() {
        // Удаляем старый спрайт
        if (this.previewSprite) {
            this.previewSprite.destroy();
            this.previewSprite = null;
        }
        // Композим новый spritesheet
        const ok = composeCharacterTexture(this, this.appearance, 'preview_lpc');
        if (!ok) {
            console.warn('composeCharacterTexture failed');
            return;
        }
        // Создаём анимации (один раз — потом перезапишутся)
        createCustomCharacterAnimations(this, 'preview_lpc', 'preview_lpc');
        // Спрайт-превью показывает idle down (первый кадр walk-down = frame 0)
        // В нашей композитной текстуре: row 0 = down, col 8 = idle
        this.previewSprite = this.add.sprite(this.previewX, this.previewY, 'preview_lpc', 8);
        this.previewSprite.setScale(this.previewScale);
        // Покачивание для живости
        this.tweens.add({
            targets: this.previewSprite,
            y: { from: this.previewY, to: this.previewY - 4 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    editName() {
        // Простой промпт через JS
        const newName = window.prompt('Введите имя персонажа:', this.characterName);
        if (newName && newName.trim().length > 0) {
            this.characterName = newName.trim().slice(0, 24);
            this.nameInput.setText(this.characterName);
        }
    }

    confirmCharacter() {
        // 1. Композим финальную текстуру под именем 'player_custom'
        composeCharacterTexture(this, this.appearance, 'player_custom');
        createCustomCharacterAnimations(this, 'player_custom', 'player_custom');

        // 2. Создаём персонажа
        const player = createCharacter(this.characterName || 'Путник');
        // Сохраняем внешку и sprite key
        player.appearance = { ...this.appearance, sex: this.sex };
        player.sprite = 'player_custom';
        player.name = this.characterName;
        player.gender = this.sex;

        // 3. Инициализация игры (общая логика для нового старта)
        this.registry.set('player', player);
        this.registry.set('quest', {
            elderTalked: false,
            merchantTalked: false,
            soldierTalked: false,
            banditDefeated: false,
            hasHerb: false,
            tutorialStep: 0,
            currentObjective: 'Поговори со старейшиной',
            chestsOpened: [],
            hoursPassed: 0,
        });

        resetVillageName();
        initThiefHunt(this.registry);
        initTime(this.registry, createRandomStartDate());
        initNpcNames(this.registry);
        initReputation(this.registry);
        ActionLog.init(this.registry);
        ActionLog.add(this.registry, `Создан новый персонаж: ${player.name} (LPC-генератор).`);

        // 4. Переход в деревню
        this.scene.start('Village');
    }
}

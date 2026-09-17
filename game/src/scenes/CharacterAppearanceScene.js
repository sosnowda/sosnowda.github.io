// CharacterAppearanceScene.js — меню внешности персонажа на LPC-слоях (раунд 37).
//
// Полная переработка (task 37-a): прежняя грубая система (один статичный кадр
// 64×64 с region-tint по прямоугольным зонам) заменена на ЖИВОЙ LPC-композит —
// те же слои, из которых собираются жители деревни (systems/NpcLpc.js):
//   body + eyes + beards + hair + legs + feet + torso (+ extra: плащ)
//   → spritesheet 9 колонок × 4 ряда × 64px (8 кадров walk + idle в каждом ряду).
//
// Структура меню (1280×720, тёмный стиль, Georgia/serif):
//   слева   — «Тип персонажа» (LPC-пресеты: пахарь, бортник, ратник...) + список категорий;
//   центр   — живое превью: ходьба по кругу (down→left→up→right) с остановкой на idle;
//   справа  — сетка вариантов выбранной категории (форма×цвет для волос/бороды).
//
// КОНТРАКТ с игровыми сценами (Village/Interior/Forest/Apiary) после «Подтвердить»:
//   • 'player_composite' — canvas-текстура 576×256 (9×4 кадров 64px);
//   • анимации 'player_composite_walk_down|left|right|up' (8 кадров) и
//     'player_composite_idle_down|left|right|up' — созданы глобально;
//   • player.useComposite = true — сцены играют эти анимации;
//   • player.sprite и player.appearance.{skin,hair,jacket,pants} (объекты
//     name+tint) сохраняются как раньше — legacy-fallback старых сейвов не сломан.
// Названия LPC-слоёв хранятся в player.appearance.lpc (см. confirmAppearance).

import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
import { t } from '../systems/i18n.js';
import {
    loadAllLpcLayers, composeCharacterTexture, createCustomCharacterAnimations,
} from '../systems/CharacterAppearance.js';

// ================= ПАЛИТРЫ-СЛОИ (все файлы есть в assets/lpc/) =================

// Телосложение: 6 тонов кожи на пол (палитра жителей из NpcLpc.js)
const BODY_TONES = ['light', 'tan', 'olive', 'taupe', 'amber', 'bronze'];
const BODY_TONE_LABELS = {
    light: 'Светлое', tan: 'Загорелое', olive: 'Оливковое',
    taupe: 'Серо-бурое', amber: 'Янтарное', bronze: 'Бронзовое',
};

// Причёска: форма × цвет (два ряда кнопок)
const HAIR_SHAPES_MALE = ['mop', 'swoop', 'messy1'];
const HAIR_SHAPES_FEMALE = ['bangslong', 'loose', 'wavy', 'bunches'];
const HAIR_SHAPE_LABELS = {
    mop: 'Под горшок', swoop: 'На бок', messy1: 'Взъерошенная',
    bangslong: 'С чёлкой', loose: 'Распущенные', wavy: 'Волнистые', bunches: 'Косички',
};
const HAIR_COLORS = ['black', 'dark_brown', 'chestnut', 'blonde', 'white'];
const HAIR_COLOR_LABELS = {
    black: 'Чёрные', dark_brown: 'Тёмно-русые', chestnut: 'Каштановые',
    blonde: 'Светлые', white: 'Седые',
};

// Глаза
const EYES = ['human_adult_brown', 'human_adult_blue', 'human_adult_gray', 'human_adult_green'];
const EYE_LABELS = {
    human_adult_brown: 'Карие', human_adult_blue: 'Голубые',
    human_adult_gray: 'Серые', human_adult_green: 'Зелёные',
};

// Борода/усы (п.8: добавление/удаление, размеры и формы) — только мужской пол
const BEARD_SHAPES = ['beard_5oclock_shadow', 'beard_basic', 'beard_medium', 'beard_trimmed', 'beard_winter', 'mustache_bigstache'];
const BEARD_SHAPE_LABELS = {
    beard_5oclock_shadow: 'Щетина', beard_basic: 'Короткая', beard_medium: 'Средняя',
    beard_trimmed: 'Подстриженная', beard_winter: 'Борода лопатой', mustache_bigstache: 'Усы',
};
const BEARD_COLOR_LABELS = {
    black: 'Чёрная', dark_brown: 'Тёмно-русая', chestnut: 'Каштановая',
    blonde: 'Светлая', white: 'Седая',
};

// Рубаха/куртка: сукно (длиннорукое) + со шнуровкой
const TORSO_PLAIN = [
    'longsleeve_longsleeve_forest', 'longsleeve_longsleeve_tan', 'longsleeve_longsleeve_charcoal',
    'longsleeve_longsleeve_maroon', 'longsleeve_longsleeve_white',
];
const TORSO_LACED = [
    'longsleeve_laced_forest', 'longsleeve_laced_tan', 'longsleeve_laced_charcoal',
    'longsleeve_laced_maroon', 'longsleeve_laced_white',
];
const TORSO_LABELS = {
    longsleeve_longsleeve_forest: 'Сукно зелёное',
    longsleeve_longsleeve_tan: 'Сукно рыжее',
    longsleeve_longsleeve_charcoal: 'Сукно тёмное',
    longsleeve_longsleeve_maroon: 'Сукно бордовое',
    longsleeve_longsleeve_white: 'Сукно белое',
    longsleeve_laced_forest: 'Шнуровка зелёная',
    longsleeve_laced_tan: 'Шнуровка рыжая',
    longsleeve_laced_charcoal: 'Шнуровка тёмная',
    longsleeve_laced_maroon: 'Шнуровка бордовая',
    longsleeve_laced_white: 'Шнуровка белая',
};

// Отделка куртки (п.9): без / камзол-жилет поверх / плащ
const FINISH_VESTS = ['vest_charcoal', 'vest_forest', 'vest_maroon', 'vest_tan', 'vest_white'];
const FINISH_VEST_LABELS = {
    vest_charcoal: 'Жилет тёмный', vest_forest: 'Жилет зелёный', vest_maroon: 'Жилет бордовый',
    vest_tan: 'Жилет рыжий', vest_white: 'Жилет белый',
};
const CAPE_LAYER = 'cape_gray_male'; // assets/lpc/extra/ — вне categories манифеста

// Штаны/юбка
const LEGS_MALE = [
    'pants_forest', 'pants_tan', 'pants_charcoal', 'pants_maroon', 'pants_white',
    'male_black', 'male_brown', 'male_gray',
    'leggings_tan', 'leggings_forest', 'leggings_charcoal', 'leggings_maroon', 'leggings_white',
];
const LEGS_FEMALE = ['skirts_plain_tan', 'skirts_plain_forest', 'skirts_plain_charcoal', ...LEGS_MALE];
const LEGS_LABELS = {
    pants_forest: 'Штаны зелёные', pants_tan: 'Штаны рыжие', pants_charcoal: 'Штаны тёмные',
    pants_maroon: 'Штаны бордовые', pants_white: 'Штаны белые',
    male_black: 'Порты чёрные', male_brown: 'Порты бурые', male_gray: 'Порты серые',
    leggings_tan: 'Обмотки рыжие', leggings_forest: 'Обмотки зелёные', leggings_charcoal: 'Обмотки тёмные',
    leggings_maroon: 'Обмотки бордовые', leggings_white: 'Обмотки белые',
    skirts_plain_tan: 'Понёва рыжая', skirts_plain_forest: 'Понёва зелёная', skirts_plain_charcoal: 'Понёва тёмная',
};

// Обувь
const FEET = ['boots_charcoal', 'boots_forest', 'boots_maroon', 'boots_tan', 'shoes2_tan', 'shoes2_charcoal', 'male_brown'];
const FEET_LABELS = {
    boots_charcoal: 'Сапоги тёмные', boots_forest: 'Сапоги зелёные', boots_maroon: 'Сапоги бордовые',
    boots_tan: 'Сапоги рыжие', shoes2_tan: 'Постолы рыжие', shoes2_charcoal: 'Постолы тёмные',
    male_brown: 'Онучи (лапти)',
};

// ================= ПРЕСЕТЫ «ТИП ПЕРСОНАЖА» (п.10 — Русь XV века) =================
// Простолюдины-беженцы; никаких властных титулов («Староста» — это NPC Мирослав!).
// gender: null — виден всем; 'male'/'female' — только при совпадении пола игрока.
const PRESETS = [
    {
        name: 'Пахарь', gender: 'male',
        lpc: { body: 'male_tan', eyes: 'human_adult_brown', hair: 'mop_chestnut', legs: 'pants_tan', feet: 'boots_tan', torso: 'longsleeve_longsleeve_tan', beards: 'beard_medium_chestnut' },
    },
    {
        name: 'Бортник-охотник', gender: 'male',
        lpc: { body: 'male_olive', eyes: 'human_adult_gray', hair: 'messy1_chestnut', legs: 'leggings_forest', feet: 'boots_forest', torso: 'longsleeve_longsleeve_forest', beards: 'beard_winter_chestnut' },
    },
    {
        name: 'Мастеровой', gender: 'male',
        lpc: { body: 'male_taupe', eyes: 'human_adult_brown', hair: 'swoop_black', legs: 'pants_charcoal', feet: 'boots_charcoal', torso: 'longsleeve_longsleeve_charcoal', finish: 'vest_charcoal' },
    },
    {
        name: 'Офеня-коробейник', gender: 'male',
        lpc: { body: 'male_light', eyes: 'human_adult_blue', hair: 'swoop_dark_brown', legs: 'pants_maroon', feet: 'boots_maroon', torso: 'longsleeve_laced_maroon', beards: 'beard_trimmed_dark_brown' },
    },
    {
        name: 'Ратник ополчения', gender: 'male',
        lpc: { body: 'male_bronze', eyes: 'human_adult_gray', hair: 'mop_black', legs: 'male_gray', feet: 'boots_charcoal', torso: 'longsleeve_longsleeve_white', beards: 'beard_basic_black' },
    },
    {
        name: 'Паломник', gender: 'male',
        lpc: { body: 'male_taupe', eyes: 'human_adult_brown', hair: 'mop_dark_brown', legs: 'male_white', feet: 'male_brown', torso: 'longsleeve_longsleeve_white', beards: 'beard_medium_white' },
    },
    {
        name: 'Крестьянка', gender: 'female',
        lpc: { body: 'female_tan', eyes: 'human_adult_brown', hair: 'bangslong_chestnut', legs: 'skirts_plain_tan', feet: 'boots_tan', torso: 'longsleeve_longsleeve_tan' },
    },
    {
        name: 'Ткачиха', gender: 'female',
        lpc: { body: 'female_light', eyes: 'human_adult_green', hair: 'wavy_dark_brown', legs: 'skirts_plain_forest', feet: 'female_black', torso: 'longsleeve_laced_forest' },
    },
];

// Категории левой колонки (борода скрыта у женщин)
const CATEGORIES = [
    { id: 'body', label: 'Телосложение' },
    { id: 'hair', label: 'Причёска' },
    { id: 'eyes', label: 'Глаза' },
    { id: 'beards', label: 'Борода', maleOnly: true },
    { id: 'torso', label: 'Рубаха/куртка' },
    { id: 'finish', label: 'Отделка куртки' },
    { id: 'legs', label: 'Штаны/юбка' },
    { id: 'feet', label: 'Обувь' },
];

// Легаси-tint'ы (совместимость со старыми сейвами: appearance.{skin,hair,jacket,pants})
const LEGACY_SKIN = {
    light: { name: 'Светлая', tint: 0xffe0c0 }, tan: { name: 'Загорелая', tint: 0xe0b888 },
    olive: { name: 'Смуглая', tint: 0xc89868 }, taupe: { name: 'Тёмная', tint: 0xa07050 },
    amber: { name: 'Тёмная', tint: 0xb07c48 }, bronze: { name: 'Очень тёмная', tint: 0x8a5e3a },
};
const LEGACY_HAIR = {
    black: { name: 'Чёрные', tint: 0x2a1a0e }, dark_brown: { name: 'Тёмно-русые', tint: 0x5a3a1e },
    chestnut: { name: 'Каштановые', tint: 0x8a6a3e }, blonde: { name: 'Светлые', tint: 0xc8a868 },
    white: { name: 'Седые', tint: 0xc0c0c0 },
};
const LEGACY_CLOTH = {
    forest: 0x3a5a3a, tan: 0x8a6a3e, charcoal: 0x3a3a3a, maroon: 0x5a1a3a, white: 0xc8c8c8,
    black: 0x2a2a2a, brown: 0x4a2a1a, gray: 0x5a5a5a,
};

export class CharacterAppearanceScene extends Phaser.Scene {
    constructor() {
        super('CharacterAppearance');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);

        // --- Состояние ---
        this.player = this.registry.get('player') || null;
        this.gender = (this.player && this.player.gender === 'female') ? 'female' : 'male';
        this.charName = (this.player && this.player.name) || t('Путник');
        this.activeCategory = 'body';
        this.chosenPresetIdx = -1;
        this.layersReady = false;
        this.confirmBusy = false;
        this.optionButtons = [];
        this.presetButtons = [];
        this.categoryButtons = [];

        // Заголовок
        this.add.text(width / 2, 30, t('🎨 Настройка внешности'), {
            fontFamily: 'Georgia, serif',
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 70,
            t('Одежда и лицо — из тех же слоёв, что у жителей деревни. Ходьба и взгляд в 4 стороны.'),
            {
                fontSize: '14px', color: RUS.textDim,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5, 0);

        // --- Рамка превью (центр) ---
        this.previewX = width / 2;
        this.previewY = height / 2 - 40;
        this.add.rectangle(this.previewX, this.previewY, 220, 240, 0x1a140e, 0.9)
            .setStrokeStyle(2, RUS.border);
        this.add.text(this.previewX, this.previewY - 132, t('Предпросмотр'), {
            fontSize: '13px', color: RUS.textDim,
        }).setOrigin(0.5);

        // Имя персонажа (клик — редактирование)
        this.nameText = this.add.text(this.previewX, this.previewY + 138, this.charName, {
            fontSize: '18px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        this.nameText.setInteractive({ useHandCursor: true });
        this.nameText.on('pointerdown', () => this.editName());

        // Легенда выбранных слоёв (2 строки под превью)
        this.legendLine1 = this.add.text(this.previewX, this.previewY + 170, '', {
            fontSize: '13px', color: RUS.text, align: 'center',
            wordWrap: { width: 420 },
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        this.legendLine2 = this.add.text(this.previewX, this.previewY + 192, '', {
            fontSize: '13px', color: RUS.text, align: 'center',
            wordWrap: { width: 420 },
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // --- Левая колонка: пресеты + категории (кнопки ниже) ---

        // --- Кнопки низа ---
        createButton(this, 100, height - 40, t('◀ Назад'), () => {
            this.scene.start('CharacterSelection');
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        });

        createButton(this, width / 2, height - 110, t('🎲 Случайный облик'), () => {
            this.randomizeLook();
            this.chosenPresetIdx = -1;
            this.refreshPresetHighlight();
            this.drawOptionsPanel();
            this.rebuildPreview();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        createButton(this, width - 130, height - 40, t('Подтвердить ▶'), () => {
            this.confirmAppearance();
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        // --- Стартовый выбор и загрузка слоёв ---
        this.initDefaultLpc();
        this.buildPresetButtons();
        this.buildCategoryButtons();
        this.refreshPresetHighlight();
        this.refreshCategoryButtons();

        this.prepareLayersAndBuild();
    }

    // ============================================================
    // ЗАГРУЗКА СЛОЁВ
    // ============================================================

    async prepareLayersAndBuild() {
        // Загрузочный экран в зоне правой панели
        const { width } = this.scale;
        const noteX = width / 2 + 260;
        this.loadingNote = this.add.text(noteX, 260, t('Готовим одежду...'), {
            fontSize: '18px', color: RUS.text, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        this.loadBarBg = this.add.rectangle(noteX, 290, 300, 12, 0x000000, 0.5)
            .setStrokeStyle(1, RUS.border);
        this.loadFill = this.add.rectangle(noteX - 150, 290, 4, 10, RUS.border)
            .setOrigin(0, 0.5);

        try {
            await loadAllLpcLayers(this, (frac) => {
                this.loadFill.width = 296 * frac;
            });
        } catch (e) {
            console.warn('LPC: ошибка загрузки слоёв:', e);
        }
        // Плащ лежит в extra/ — вне categories манифеста, догружаем отдельно
        try {
            await this.ensureExtraLayer(CAPE_LAYER);
        } catch (e) {
            console.warn('LPC: не удалось догрузить плащ:', e);
        }

        this.layersReady = true;
        this.loadingNote.setVisible(false);
        this.loadBarBg.setVisible(false);
        this.loadFill.setVisible(false);

        this.drawOptionsPanel();
        this.rebuildPreview();
    }

    /**
     * Догрузить один слой из assets/lpc/extra/ (не входит в categories манифеста,
     * поэтому loadAllLpcLayers его не грузит).
     */
    ensureExtraLayer(name) {
        return new Promise((resolve) => {
            const key = `lpc_extra_${name}`;
            if (this.textures.exists(key)) { resolve(); return; }
            this.load.image(key, `assets/lpc/extra/${name}.png`);
            this.load.once('complete', () => resolve());
            this.load.once('loaderror', () => resolve());
            if (!this.load.isLoading()) this.load.start();
        });
    }

    // ============================================================
    // ВЫБОР ПО УМОЛЧАНИЮ / СЛУЧАЙНЫЙ ОБЛИК
    // ============================================================

    initDefaultLpc() {
        const male = this.gender === 'male';
        this.lpc = {
            body: male ? 'male_tan' : 'female_tan',
            eyes: 'human_adult_brown',
            hairShape: male ? 'mop' : 'bangslong',
            hairColor: 'chestnut',
            beardShape: male ? 'beard_medium' : 'none',
            beardColor: 'chestnut',
            torsoBase: 'longsleeve_longsleeve_forest',
            finish: 'none',
            legs: male ? 'pants_tan' : 'skirts_plain_tan',
            feet: 'boots_tan',
        };
    }

    randomizeLook() {
        const male = this.gender === 'male';
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        this.lpc.body = (male ? 'male_' : 'female_') + pick(BODY_TONES);
        this.lpc.hairShape = pick(male ? HAIR_SHAPES_MALE : HAIR_SHAPES_FEMALE);
        this.lpc.hairColor = pick(HAIR_COLORS);
        this.lpc.eyes = pick(EYES);
        this.lpc.torsoBase = pick(TORSO_PLAIN.concat(TORSO_LACED));
        const r = Math.random();
        this.lpc.finish = r < 0.55 ? 'none' : (r < 0.9 ? pick(FINISH_VESTS) : 'cape');
        this.lpc.legs = pick(male ? LEGS_MALE : LEGS_FEMALE);
        this.lpc.feet = pick(FEET);
        if (male) {
            // У трети мужиков бороды нет; у остальных — в цвет волос
            this.lpc.beardShape = Math.random() < 0.35 ? 'none' : pick(BEARD_SHAPES);
            this.lpc.beardColor = this.lpc.hairColor;
        } else {
            this.lpc.beardShape = 'none';
        }
    }

    // ============================================================
    // ЛЕВАЯ КОЛОНКА: ПРЕСЕТЫ И КАТЕГОРИИ
    // ============================================================

    visiblePresets() {
        return PRESETS.filter(p => !p.gender || p.gender === this.gender);
    }

    buildPresetButtons() {
        const x = 128;
        const presets = this.visiblePresets();
        this.presetButtons = [];
        this.add.text(x, 98, t('Тип персонажа'), {
            fontSize: '15px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        presets.forEach((p, i) => {
            const btn = createButton(this, x, 126 + i * 29, t(p.name), () => {
                this.applyPreset(p);
                this.chosenPresetIdx = i;
                this.refreshPresetHighlight();
                this.drawOptionsPanel();
                this.rebuildPreview();
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 12, padding: { left: 8, right: 8, top: 4, bottom: 4 },
            });
            this.presetButtons.push(btn);
        });
    }

    refreshPresetHighlight() {
        this.presetButtons.forEach((btn, i) => this.tintButton(btn, i === this.chosenPresetIdx, RUS.accent, RUS.accentLight, 0x4a3520));
    }

    buildCategoryButtons() {
        const x = 128;
        const presets = this.visiblePresets();
        const startY = 126 + presets.length * 29 + 22;

        this.add.text(x, startY, t('Категории'), {
            fontSize: '15px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        this.categoryButtons = [];
        const cats = CATEGORIES.filter(c => !c.maleOnly || this.gender === 'male');
        cats.forEach((c, i) => {
            const btn = createButton(this, x, startY + 28 + i * 40, t(c.label), () => {
                this.activeCategory = c.id;
                this.refreshCategoryButtons();
                this.drawOptionsPanel();
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 14, padding: { left: 14, right: 14, top: 7, bottom: 7 },
            });
            this.categoryButtons.push({ id: c.id, btn });
        });
    }

    refreshCategoryButtons() {
        this.categoryButtons.forEach(({ id, btn }) => this.tintButton(btn, id === this.activeCategory, RUS.accent, RUS.accentLight, 0x4a3520));
    }

    /**
     * Раунд 20 ФИКС (паттерн CharacterGeneratorScene): контейнер кнопки не
     * поддерживает setTint — красим ФОН через getElement('background').
     */
    tintButton(btn, isActive, activeColor, activeHover, idleColor) {
        if (!btn || typeof btn.getElement !== 'function') return;
        const bg = btn.getElement('background');
        if (!bg) return;
        if (typeof bg.setFillStyle === 'function') {
            bg.setFillStyle(isActive ? activeColor : idleColor, 1);
        } else if (typeof bg.setTint === 'function') {
            bg.setTint(isActive ? activeHover : 0xffffff);
        }
    }

    // ============================================================
    // ПРАВАЯ ПАНЕЛЬ: ВАРИАНТЫ ВЫБРАННОЙ КАТЕГОРИИ
    // ============================================================

    drawOptionsPanel() {
        if (!this.layersReady) return; // панель рисуется после загрузки слоёв
        this.optionButtons.forEach(o => o.destroy());
        this.optionButtons = [];

        const { width } = this.scale;
        const startX = width / 2 + 125; // правее рамки превью (та шире на 110px от центра)
        const availW = width - startX - 20;
        let y = 120;
        const self = this;

        const addBtn = (label, isSel, onPick, gx, gy) => {
            const b = createButton(this, gx, gy, label, () => {
                onPick();
                self.chosenPresetIdx = -1;
                self.refreshPresetHighlight();
                self.drawOptionsPanel();
                self.rebuildPreview();
            }, {
                backgroundColor: isSel ? RUS.accent : 0x4a3520,
                hoverColor: isSel ? RUS.accentLight : 0x5a4530,
                textColor: RUS.text, fontSize: 12,
                padding: { left: 8, right: 8, top: 6, bottom: 6 },
            });
            self.optionButtons.push(b);
        };

        const addLabel = (text, gx, gy) => {
            const lbl = this.add.text(gx, gy, text, {
                fontSize: '13px', color: '#c9a14a', fontStyle: 'bold',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0.5);
            this.optionButtons.push(lbl);
        };

        // Сетка кнопок: cols колонок с автоматическим шагом по ширине панели
        const grid = (items, cols, topY, isSelFn, onPickFn) => {
            const step = Math.min(146, Math.floor(availW / cols));
            items.forEach((item, i) => {
                const gx = startX + (i % cols) * step + step / 2;
                const gy = topY + Math.floor(i / cols) * 48;
                addBtn(item.label, isSelFn(item), () => onPickFn(item), gx, gy);
            });
            return topY + Math.ceil(items.length / cols) * 48;
        };

        const cat = this.activeCategory;

        if (cat === 'body') {
            const items = BODY_TONES.map(tone => ({
                label: t(BODY_TONE_LABELS[tone]),
                value: (this.gender === 'male' ? 'male_' : 'female_') + tone,
            }));
            grid(items, 3, y, it => this.lpc.body === it.value, it => { this.lpc.body = it.value; });
        } else if (cat === 'hair') {
            const shapes = (this.gender === 'male' ? HAIR_SHAPES_MALE : HAIR_SHAPES_FEMALE)
                .map(s => ({ label: t(HAIR_SHAPE_LABELS[s]), value: s }));
            addLabel(t('Форма:'), startX, y);
            y = grid(shapes, 3, y + 34, it => this.lpc.hairShape === it.value, it => { this.lpc.hairShape = it.value; }) + 12;
            const colors = HAIR_COLORS.map(c => ({ label: t(HAIR_COLOR_LABELS[c]), value: c }));
            addLabel(t('Цвет:'), startX, y);
            grid(colors, 5, y + 34, it => this.lpc.hairColor === it.value, it => { this.lpc.hairColor = it.value; });
        } else if (cat === 'eyes') {
            const items = EYES.map(e => ({ label: t(EYE_LABELS[e]), value: e }));
            grid(items, 3, y, it => this.lpc.eyes === it.value, it => { this.lpc.eyes = it.value; });
        } else if (cat === 'beards') {
            if (this.gender !== 'male') {
                const note = this.add.text(startX + 130, y + 60, t('Борода — только мужчинам.'), {
                    fontSize: '15px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
                }).setOrigin(0.5);
                this.optionButtons.push(note);
                return;
            }
            const shapes = [{ label: t('Нет бороды'), value: 'none' }]
                .concat(BEARD_SHAPES.map(s => ({ label: t(BEARD_SHAPE_LABELS[s]), value: s })));
            addLabel(t('Форма:'), startX, y);
            y = grid(shapes, 3, y + 34, it => this.lpc.beardShape === it.value, it => { this.lpc.beardShape = it.value; }) + 12;
            const colors = HAIR_COLORS.map(c => ({ label: t(BEARD_COLOR_LABELS[c]), value: c }));
            addLabel(t('Цвет:'), startX, y);
            grid(colors, 5, y + 34, it => this.lpc.beardColor === it.value, it => { this.lpc.beardColor = it.value; });
        } else if (cat === 'torso') {
            const items = TORSO_PLAIN.concat(TORSO_LACED).map(tr => ({ label: t(TORSO_LABELS[tr]), value: tr }));
            grid(items, 3, y, it => this.lpc.torsoBase === it.value && !this.isVestFinish(), it => { this.lpc.torsoBase = it.value; });
        } else if (cat === 'finish') {
            const items = [{ label: t('Без отделки'), value: 'none' }]
                .concat(FINISH_VESTS.map(v => ({ label: t(FINISH_VEST_LABELS[v]), value: v })))
                .concat([{ label: t('Плащ'), value: 'cape' }]);
            grid(items, 3, y, it => this.lpc.finish === it.value, it => { this.lpc.finish = it.value; });
        } else if (cat === 'legs') {
            const list = this.gender === 'male' ? LEGS_MALE : LEGS_FEMALE;
            const items = list.map(l => ({ label: t(LEGS_LABELS[l] || l), value: l }));
            grid(items, 3, y, it => this.lpc.legs === it.value, it => { this.lpc.legs = it.value; });
        } else if (cat === 'feet') {
            const items = FEET.map(f => ({ label: t(FEET_LABELS[f] || f), value: f }));
            grid(items, 3, y, it => this.lpc.feet === it.value, it => { this.lpc.feet = it.value; });
        }
    }

    isVestFinish() {
        return !!this.lpc.finish && this.lpc.finish !== 'none' && this.lpc.finish !== 'cape';
    }

    // ============================================================
    // ПРЕСЕТЫ
    // ============================================================

    applyPreset(p) {
        const l = p.lpc;
        this.lpc.body = l.body;
        this.lpc.eyes = l.eyes;
        this.lpc.legs = l.legs;
        this.lpc.feet = l.feet;
        this.lpc.torsoBase = l.torso;
        this.lpc.finish = l.finish || 'none';
        // волосы: "<форма>_<цвет>" (цвет может содержать '_': dark_brown)
        const shapes = this.gender === 'male' ? HAIR_SHAPES_MALE : HAIR_SHAPES_FEMALE;
        const hShape = shapes.find(s => l.hair.startsWith(s + '_')) || shapes[0];
        this.lpc.hairShape = hShape;
        this.lpc.hairColor = l.hair.slice(hShape.length + 1);
        // борода
        if (this.gender === 'male' && l.beards) {
            const bShape = BEARD_SHAPES.find(s => l.beards.startsWith(s + '_'));
            if (bShape) {
                this.lpc.beardShape = bShape;
                this.lpc.beardColor = l.beards.slice(bShape.length + 1);
            } else {
                this.lpc.beardShape = 'none';
            }
        } else {
            this.lpc.beardShape = 'none';
        }
    }

    // ============================================================
    // ИТОГОВЫЙ НАБОР СЛОЁВ (для композита и сохранения)
    // ============================================================

    /**
     * Собрать объект внешности для composeCharacterTexture:
     * { body, eyes, hair, legs, feet, torso, beards?, extra? }.
     * Отделка: жилет ЗАМЕНЯЕТ torso, плащ идёт в extra (рисуется поверх торса).
     */
    buildComposeAppearance() {
        const s = this.lpc;
        const app = {
            body: s.body,
            eyes: s.eyes,
            hair: `${s.hairShape}_${s.hairColor}`,
            legs: s.legs,
            feet: s.feet,
            torso: this.isVestFinish() ? s.finish : s.torsoBase,
        };
        if (this.gender === 'male' && s.beardShape && s.beardShape !== 'none') {
            app.beards = `${s.beardShape}_${s.beardColor}`;
        }
        if (s.finish === 'cape') {
            app.extra = CAPE_LAYER;
        }
        return app;
    }

    // ============================================================
    // ПРЕВЬЮ: ЖИВАЯ ХОДЬБА ПО КРУГУ
    // ============================================================

    rebuildPreview() {
        if (!this.layersReady) return;
        // 1. Сначала УБИРАЕМ старый спрайт: он ссылается на текстуру 'preview_lpc',
        //    которую composeCharacterTexture пересоздаёт (remove+addCanvas) —
        //    иначе следующий кадр рендера читает frame уничтоженной текстуры
        //    (краш "Cannot read properties of null (reading 'sourceSize')").
        if (this.previewSprite) {
            this.previewSprite.destroy();
            this.previewSprite = null;
        }
        // 2. Останавливаем цикл ходьбы (токен гасит отложенные цепочки)
        this.restartPreviewCycleTokenOnly();
        const app = this.buildComposeAppearance();
        // Гарантия: все слои загружены (compose warn'ит и рисует пустоты иначе)
        const missing = Object.entries(app)
            .filter(([cat, name]) => !this.textures.exists(`lpc_${cat}_${name}`))
            .map(([cat, name]) => `lpc_${cat}_${name}`);
        if (missing.length > 0) {
            console.warn('LPC превью: не загружены слои:', missing.join(', '));
        }
        // 3. Пересобираем spritesheet и анимации
        composeCharacterTexture(this, app, 'preview_lpc');
        createCustomCharacterAnimations(this, 'preview_lpc', 'preview_lpc');

        // Кадр 8 = idle_down (последняя колонка нулевого ряда)
        this.previewSprite = this.add.sprite(this.previewX, this.previewY, 'preview_lpc', 8);
        this.previewSprite.setScale(2.5);
        // 4. Заново запускаем живой цикл ходьбы
        this.restartPreviewCycle();
        this.updateLegend();
    }

    /** Инкремент токена без запуска шага (используется перед пересборкой). */
    restartPreviewCycleTokenOnly() {
        this.previewCycleToken = (this.previewCycleToken || 0) + 1;
    }

    /**
     * Цикл: walk_down → walk_left → walk_up → walk_right → idle_down (пара секунд)
     * → снова ходьба. Токен гасит устаревшие цепочки после пересборки превью.
     */
    restartPreviewCycle() {
        this.previewCycleToken = (this.previewCycleToken || 0) + 1;
        this.runPreviewCycle(this.previewCycleToken, 0);
    }

    runPreviewCycle(token, dirIdx) {
        if (token !== this.previewCycleToken) return;
        if (!this.previewSprite || !this.previewSprite.active) return;
        const dirs = ['down', 'left', 'up', 'right'];
        const dir = dirs[dirIdx % dirs.length];
        this.previewSprite.play(`preview_lpc_walk_${dir}`, true);
        this.time.delayedCall(1050, () => {
            if (token !== this.previewCycleToken) return;
            if (dirIdx % dirs.length === dirs.length - 1) {
                // Полный круг пройден — остановка на idle
                if (this.previewSprite && this.previewSprite.active) {
                    this.previewSprite.play('preview_lpc_idle_down', true);
                }
                this.time.delayedCall(1900, () => this.runPreviewCycle(token, dirIdx + 1));
            } else {
                this.runPreviewCycle(token, dirIdx + 1);
            }
        });
    }

    // ============================================================
    // ЛЕГЕНДА / ИМЯ
    // ============================================================

    updateLegend() {
        if (!this.legendLine1) return;
        const s = this.lpc;
        const male = this.gender === 'male';
        const beardText = (male && s.beardShape !== 'none')
            ? t(BEARD_SHAPE_LABELS[s.beardShape] || s.beardShape)
            : t('Нет бороды');
        let finishText = '';
        if (this.isVestFinish()) finishText = ' + ' + t(FINISH_VEST_LABELS[s.finish]);
        else if (s.finish === 'cape') finishText = ' + ' + t('Плащ');

        this.legendLine1.setText(
            `${t('Телосложение')}: ${t(BODY_TONE_LABELS[s.body.split('_')[1]])} · ` +
            `${t('Причёска')}: ${t(HAIR_SHAPE_LABELS[s.hairShape])}, ${t(HAIR_COLOR_LABELS[s.hairColor])} · ` +
            `${t('Борода')}: ${beardText}`
        );
        this.legendLine2.setText(
            `${t('Рубаха/куртка')}: ${t(TORSO_LABELS[s.torsoBase])}${finishText} · ` +
            `${t('Штаны/юбка')}: ${t(LEGS_LABELS[s.legs] || s.legs)} · ` +
            `${t('Обувь')}: ${t(FEET_LABELS[s.feet] || s.feet)}`
        );
    }

    editName() {
        const newName = window.prompt(t('Введите имя персонажа:'), this.charName);
        if (newName && newName.trim().length > 0) {
            this.charName = newName.trim().slice(0, 24);
            this.nameText.setText(this.charName);
            if (this.player) {
                this.player.name = this.charName;
                this.registry.set('player', this.player);
            }
        }
    }

    // ============================================================
    // ПОДТВЕРЖДЕНИЕ → 'player_composite' → Village
    // ============================================================

    async confirmAppearance() {
        if (this.confirmBusy) return;
        this.confirmBusy = true;

        // Вуаль «Собираем облик...» (слой 9xxx — выше всего UI)
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(9000);
        this.add.text(width / 2, height / 2, t('Собираем облик...'), {
            fontFamily: 'Georgia, serif',
            fontSize: '22px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(9001);

        // 1. Сохраняем выбор в player (лёгаси-поля остаются для сейв-совместимости)
        const app = this.buildComposeAppearance();
        if (this.player) {
            const skinTone = this.lpc.body.split('_')[1] || 'tan';
            const hairColor = this.lpc.hairColor;
            const torsoName = this.isVestFinish() ? this.lpc.finish : this.lpc.torsoBase;
            const legacy = {
                skin: LEGACY_SKIN[skinTone] || LEGACY_SKIN.tan,
                hair: LEGACY_HAIR[hairColor] || LEGACY_HAIR.chestnut,
                jacket: { name: t(TORSO_LABELS[torsoName] || FINISH_VEST_LABELS[torsoName] || torsoName), tint: LEGACY_CLOTH[torsoName.split('_').pop()] || 0x4a2a1a },
                pants: { name: t(LEGS_LABELS[this.lpc.legs] || this.lpc.legs), tint: LEGACY_CLOTH[this.lpc.legs.split('_').pop()] || 0x3a2a1a },
            };
            this.player.appearance = {
                // Легаси-поля (старые сейвы и fallback-ветки сцен читают их)
                skin: legacy.skin,
                hair: legacy.hair,
                jacket: legacy.jacket,
                pants: legacy.pants,
                // Новое: названия LPC-слоёв + борода
                lpc: app,
                beard: (this.gender === 'male' && this.lpc.beardShape !== 'none') ? this.lpc.beardShape : 'none',
                gender: this.gender,
            };
            this.player.name = this.charName;
            this.registry.set('player', this.player);
        }

        // 2. Гарантия загрузки ВСЕХ слоёв (обычно уже готовы после превью)
        if (!this.layersReady) {
            try { await loadAllLpcLayers(this); } catch (e) { console.warn('LPC load:', e); }
            try { await this.ensureExtraLayer(CAPE_LAYER); } catch (e) { console.warn('LPC cape:', e); }
        }

        // 3. Собрать ПОЛНЫЙ АНИМИРУЕМЫЙ композит игрока
        const missing = Object.entries(app)
            .filter(([cat, name]) => !this.textures.exists(`lpc_${cat}_${name}`))
            .map(([cat, name]) => `lpc_${cat}_${name}`);
        let composed = false;
        if (missing.length === 0) {
            composed = composeCharacterTexture(this, app, 'player_composite');
            if (composed) {
                createCustomCharacterAnimations(this, 'player_composite', 'player_composite');
            } else if (this.textures.exists('player_composite')) {
                // compose вернул false (какие-то кадры не легли) — чиним, что смогли,
                // но не оставляем текстуру без анимаций
                createCustomCharacterAnimations(this, 'player_composite', 'player_composite');
                composed = this.textures.exists('player_composite');
            }
        } else {
            console.warn('player_composite: не хватает слоёв, остаёмся на legacy-спрайте:',
                missing.join(', '));
        }
        if (this.player) {
            this.player.useComposite = composed && this.textures.exists('player_composite');
            // player.sprite НЕ трогаем — legacy fallback (player/npc_*) живёт как был
            this.registry.set('player', this.player);
        }

        // 4. В деревню
        this.scene.start('Village');
    }
}

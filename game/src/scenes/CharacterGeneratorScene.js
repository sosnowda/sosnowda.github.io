// CharacterGeneratorScene.js — экран создания персонажа через LPC-генератор.
// Игрок выбирает тело, прическу, одежду, штаны, обувь, бороду, глаза —
// и видит живой предпросмотр. После подтверждения композитный spritesheet
// сохраняется в реестре как player.appearance и используется в VillageScene.
//
// Источник LPC: Universal LPC Spritesheet Character Generator
// https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator
// Лицензия: CC-BY-SA 3.0 / GPL 3.0

import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
import { t } from '../systems/i18n.js';
import {
    loadAllLpcLayers, composeCharacterTexture,
    createCustomCharacterAnimations,
    randomAppearance, defaultAppearance,
} from '../systems/CharacterAppearance.js';
import { createCharacter } from '../systems/Character.js';
import { AGE_MIN, AGE_MAX, AGE_DEFAULT, getAgeGroupName, describeAgeEffects, ageUnitWord } from '../systems/AgeRules.js';
import { ActionLog } from '../data/actionLog.js';
import { initThiefHunt } from '../data/thief.js';
import { resetVillageName } from '../data/world.js';
import { initTime, createRandomStartDate } from '../systems/TimeSystem.js';
import { initNpcNames } from '../data/npcNames.js';
import { initReputation } from '../data/reputation.js';
import AudioManager from '../systems/AudioManager.js';

const CAT_LABELS = {
    body: 'Телосложение',   // EN: Body
    eyes: 'Глаза',          // EN: Eyes
    beards: 'Борода',       // EN: Beard
    hair: 'Прическа',       // EN: Hair
    legs: 'Штаны',          // EN: Legs
    feet: 'Обувь',          // EN: Footwear
    torso: 'Одежда',        // EN: Clothing
};
const catLabel = (cat) => t(CAT_LABELS[cat] || cat);

const CAT_ORDER = ['body', 'eyes', 'beards', 'hair', 'legs', 'feet', 'torso'];

// ФИКС аудита локализации (этот раунд): панель опций показывала сырые куски
// английских ID ассетов («male white», «bright green») — против правила
// «игровой текст только на русском». Ниже — полный словарь перевода по
// всем категориям manifest.json.
const RU_TONE = {
    amber: 'янтарная', base: 'натуральная', black: 'тёмная', blue: 'синеватая',
    bright_green: 'ярко-зелёная', bronze: 'бронзовая', brown: 'коричневая',
    dark: 'смуглая', dark_green: 'тёмно-зелёная', green: 'зелёная',
    lavender: 'сиреневая', light: 'светлая', olive: 'оливковая',
    pale_green: 'бледно-зелёная', tan: 'загорелая', taupe: 'серо-бурая',
    white: 'белая', zombie: 'мертвая', zombie_green: 'гнилая',
    fur_black: 'шерсть чёрная', fur_brown: 'шерсть бурая', fur_copper: 'шерсть медная',
    fur_gold: 'шерсть золотистая', fur_grey: 'шерсть серая', fur_tan: 'шерсть рыжая',
    fur_white: 'шерсть белая',
};
const RU_EYES = {
    blue: 'синие', brown: 'карие', gray: 'серые', green: 'зелёные',
    orange: 'оранжевые', purple: 'фиолетовые', red: 'красные', yellow: 'жёлтые',
};
const RU_HAIR = {
    bangslong: 'длинная с чёлкой', bangslong2: 'длинная с чёлкой II',
    bunches: 'с хвостиками', long_messy: 'длинная растрёпанная',
    long_messy2: 'длинная растрёпанная II', loose: 'распущенная',
    messy1: 'растрёпанная', mop: 'шапкой', swoop: 'набок', wavy: 'волнистая',
};
const RU_HAIR_COLOR = {
    black: 'чёрные', blonde: 'светлые', chestnut: 'каштановые',
    dark_brown: 'тёмно-каштановые', white: 'седые',
};
const RU_BEARD = {
    beard_5oclock_shadow: 'щетина', beard_basic: 'густая', beard_medium: 'средняя',
    beard_trimmed: 'подстриженная', beard_winter: 'окладистая',
    mustache_bigstache: 'пышные усы',
};
const RU_BEARD_COLOR = {
    black: 'чёрная', blonde: 'светлая', chestnut: 'каштановая',
    dark_brown: 'тёмно-каштановая', white: 'седая',
};
const RU_LEG_TYPE = {
    cuffed: 'с отворотами', female: 'дамские', leggings: 'легинсы',
    male: 'простые', pants: 'портки', shorts_shorts: 'шорты',
    skirts_legion: 'юбка-легион', skirts_plain: 'простая юбка', teen: 'подростковые',
};
const RU_FOOT_TYPE = {
    boots: 'сапоги', female: 'дамские туфли', hoofs: 'копыта',
    male: 'лапти', shoes2: 'туфли', slippers: 'обмотки',
};
const RU_TORSO_TYPE = {
    longsleeve_formal_striped: 'нарядная в полоску', longsleeve_formal: 'нарядная',
    longsleeve_laced: 'шнурованная с рукавами', longsleeve_longsleeve: 'простая с рукавами',
    shortsleeve_shortsleeve: 'с коротким рукавом', sleeveless_laced: 'шнурованная безрукавка',
    vest: 'безрукавка', vest_open: 'расстёгнутая безрукавка',
};
const RU_CLOTH_COLOR = {
    charcoal: 'тёмно-серые', forest: 'тёмно-зелёные', maroon: 'бордовые',
    tan: 'бежевые', white: 'белые', black: 'чёрные', blue: 'синие',
    brown: 'коричневые', gray: 'серые', green: 'зелёные', olive: 'оливковые',
};

export class CharacterGeneratorScene extends Phaser.Scene {
    constructor() {
        super('CharacterGenerator');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
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
        this.selectedAge = AGE_DEFAULT; // раунд 44: возраст героя 15..50 (выбор владельца)

        // Заголовок
        this.add.text(width / 2, 30, t('🎨 Создание персонажа (LPC)'), {
            fontFamily: 'Georgia, serif',
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        // Подсказка загрузки
        this.loadingText = this.add.text(width / 2, height / 2, t('Загрузка LPC-слоёв...'), {
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
        // Раунд 20: на узких экранах превью компактнее и колонки прижаты к краям
        const narrow = width < 760;
        this.previewScale = narrow ? 3 : 4;
        this.previewX = width / 2;
        this.previewY = height / 2 - 30;
        // Рамка под превью
        this.add.rectangle(this.previewX, this.previewY, narrow ? 200 : 280, narrow ? 200 : 280, 0x1a140e, 0.9)
            .setStrokeStyle(2, RUS.border);
        // ФИКС аудита UI: подпись «Предпросмотр» наезжала на верхнюю грань
        // рамки — поднят выше рамки с зазором
        this.add.text(this.previewX, this.previewY - (narrow ? 118 : 160), t('Предпросмотр'), {
            fontSize: '14px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // Имя персонажа
        this.characterName = t('Путник');
        this.nameInput = this.add.text(this.previewX, this.previewY + (narrow ? 110 : 150), this.characterName, {
            fontSize: '20px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
            padding: { x: 12, y: 6 },
        }).setOrigin(0.5);
        this.nameInput.setInteractive({ useHandCursor: true });
        this.nameInput.on('pointerdown', () => this.editName());

        // === Переключатель пола ===
        const sexY = 100;
        this.add.text(width / 2 - 100, sexY, t('Пол:'), {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(1, 0.5);
        createButton(this, width / 2 - 60, sexY, t('♂ Муж'), () => {
            this.sex = 'male';
            this.rebuildAppearanceForSex();
        }, {
            backgroundColor: this.sex === 'male' ? RUS.accent : 0x4a3520,
            hoverColor: this.sex === 'male' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });
        createButton(this, width / 2 + 30, sexY, t('♀ Жен'), () => {
            this.sex = 'female';
            this.rebuildAppearanceForSex();
        }, {
            backgroundColor: this.sex === 'female' ? RUS.accent : 0x4a3520,
            hoverColor: this.sex === 'female' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });

        // === Выбор возраста (раунд 44, пп.3–4): от 15 до 50 лет ===
        // Обычный экран: в строке пола справа («Возраст: [−] 25 [+]»);
        // узкий экран (< 620): компактный центр [−] 25 [+] под полом (без label).
        const compactAge = width < 620;
        const ageY = compactAge ? sexY + 42 : sexY;
        const ageX = compactAge ? width / 2 - 40 : width / 2 + 140;
        if (!compactAge) {
            this.add.text(ageX, ageY, t('Возраст:'), {
                fontSize: '16px', color: RUS.text,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0.5);
        }
        createButton(this, ageX + (compactAge ? 0 : 86), ageY, '−', () => {
            this.selectedAge = Math.max(AGE_MIN, this.selectedAge - 1);
            this.updateAgeUI();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 10, right: 10, top: 4, bottom: 4 },
        });
        this.ageValueText = this.add.text(ageX + (compactAge ? 40 : 122), ageY, String(this.selectedAge), {
            fontSize: '20px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5);
        createButton(this, ageX + (compactAge ? 80 : 158), ageY, '+', () => {
            this.selectedAge = Math.min(AGE_MAX, this.selectedAge + 1);
            this.updateAgeUI();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 10, right: 10, top: 4, bottom: 4 },
        });

        // Строка группы возраста и активных модификаторов (под именем героя)
        const nameY = this.previewY + (narrow ? 110 : 150);
        this.ageEffectsText = this.add.text(width / 2, nameY + 34, '', {
            fontSize: '12px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: narrow ? 320 : 460 },
        }).setOrigin(0.5, 0.5);

        // === Кнопки выбора категорий (слева) ===
        this.catButtonsY = 160;
        this.categoryButtons = [];
        CAT_ORDER.forEach((cat, i) => {
            const bx = narrow ? 70 : 100;
            const by = this.catButtonsY + i * 50;
            const btn = createButton(this, bx, by, catLabel(cat), () => {
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
        this.optionPanel.x = width - (narrow ? 110 : 180);

        // === Кнопки навигации по опциям ===
        // «◀ Пред» и «След ▶» для текущей категории
        createButton(this, width - (narrow ? 190 : 240), height - 180, t('◀ Пред'), () => {
            this.cycleOption(-1);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
        });
        createButton(this, width - (narrow ? 70 : 120), height - 180, t('След ▶'), () => {
            this.cycleOption(1);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
        });

        // === Кнопка "Случайно" ===
        createButton(this, width / 2, height - 110, t('🎲 Случайный облик'), () => {
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
        createButton(this, narrow ? 80 : 100, height - 40, t('◀ Назад'), () => {
            this.scene.start('CharacterSelection');
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        });

        createButton(this, width - (narrow ? 100 : 130), height - 40, t('Подтвердить ▶'), () => {
            this.confirmCharacter();
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        // Первичная отрисовка
        this.refreshCategoryButtons();
        this.drawOptionPanel();
        this.updatePreview();
        this.updateAgeUI(); // раунд 44: строка возраста/эффектов с первого кадра
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
            // Раунд 20 ФИКС: контейнер кнопки не поддерживает setTint —
            // красим ФОН (image/rectangle) через getElement('background').
            // (Раньше здесь падал buildUi — опции и превью не отрисовывались.)
            const isActive = cat === this.activeCategory;
            const bg = (typeof btn.getElement === 'function') ? btn.getElement('background') : null;
            if (!bg) return;
            if (typeof bg.setTint === 'function') {
                bg.setTint(isActive ? RUS.accent : 0xffffff);
            } else if (typeof bg.setFillStyle === 'function') {
                bg.setFillStyle(isActive ? RUS.accent : 0x4a3520, 1);
            }
        });
    }

    drawOptionPanel() {
        this.optionPanel.removeAll(true);
        const cat = this.activeCategory;
        const opts = this.getFilteredOptions(cat);
        if (opts.length === 0) {
            const noOptText = t('(нет опций)');
            const t = this.add.text(0, 0, noOptText, {
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
        // ФИКС аудита локализации: русские подписи опций вместо кусков
        // английских ID ассетов (body_male_white → «белая (муж.)»).
        const parts = optName.split('_');
        const colorRu = (arr, def) => (arr && arr[def]) || def;
        if (this.activeCategory === 'body') {
            // body_male_white / body_female_fur_gold
            const sex = parts[0] === 'female' ? 'жен.' : 'муж.';
            const toneKey = parts.slice(1).join('_');
            return `${RU_TONE[toneKey] || toneKey} (${sex})`;
        }
        if (this.activeCategory === 'eyes') {
            // human_blue / human_adult_red
            const color = parts[parts.length - 1];
            const adult = parts.includes('adult') ? ' (взрослый взгляд)' : '';
            return `${colorRu(RU_EYES, color)}${adult}`;
        }
        if (this.activeCategory === 'hair') {
            // long_messy2_dark_brown: тип = всё кроме цвета, цвет = последний
            const color = parts[parts.length - 1];
            const type = parts.slice(0, -1).join('_');
            return `${RU_HAIR[type] || type}, ${colorRu(RU_HAIR_COLOR, color)}`;
        }
        if (this.activeCategory === 'beards') {
            const color = parts[parts.length - 1];
            const type = parts.slice(0, -1).join('_');
            return `${RU_BEARD[type] || type}, ${colorRu(RU_BEARD_COLOR, color)}`;
        }
        if (this.activeCategory === 'legs') {
            // pants_maroon / skirts_legion_charcoal / shorts_shorts_white
            const color = parts[parts.length - 1];
            const type = parts.slice(0, -1).join('_');
            return `${RU_LEG_TYPE[type] || type}, ${colorRu(RU_CLOTH_COLOR, color)}`;
        }
        if (this.activeCategory === 'feet') {
            const color = parts[parts.length - 1];
            const type = parts.slice(0, -1).join('_');
            return `${RU_FOOT_TYPE[type] || type}, ${colorRu(RU_CLOTH_COLOR, color)}`;
        }
        if (this.activeCategory === 'torso') {
            // longsleeve_formal_striped_white: тип = всё кроме цвета
            const color = parts[parts.length - 1];
            const type = parts.slice(0, -1).join('_');
            const typeName = RU_TORSO_TYPE[type] || type;
            const ruColor = RU_CLOTH_COLOR[color];
            // Цвет согласуется с родом слова-типа: «нарядная в полоску, белая»
            const femEnd = /а$|я$/.test(typeName);
            const femColors = { 'тёмно-серые': 'тёмно-серая', 'тёмно-зелёные': 'тёмно-зелёная', 'бордовые': 'бордовая', 'бежевые': 'бежевая', 'белые': 'белая', 'чёрные': 'чёрная', 'синие': 'синяя', 'коричневые': 'коричневая', 'серые': 'серая', 'зелёные': 'зелёная', 'оливковые': 'оливковая' };
            return `${typeName}, ${femEnd && femColors[ruColor] ? femColors[ruColor] : ruColor || color}`;
        }
        // запасной путь (как раньше)
        if (parts.length >= 2) return parts.slice(-2).join(' ');
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
        const newName = window.prompt(t('Введите имя персонажа:'), this.characterName);
        if (newName && newName.trim().length > 0) {
            this.characterName = newName.trim().slice(0, 24);
            this.nameInput.setText(this.characterName);
        }
    }

    /** Раунд 44: обновить возрастное значение и строку эффектов. */
    updateAgeUI() {
        if (!this.ageValueText) return;
        this.ageValueText.setText(String(this.selectedAge));
        const group = getAgeGroupName(this.selectedAge, this.sex);
        const effects = describeAgeEffects(this.selectedAge);
        const suffix = effects.length
            ? `${group} · ${effects.join(', ')}`
            : t('в расцвете сил — без штрафов');
        this.ageEffectsText.setText(`${t('Возраст')} ${this.selectedAge} ${ageUnitWord(this.selectedAge)}: ${suffix}`);
    }

    confirmCharacter() {
        // 1. Композим финальную текстуру под именем 'player_custom'
        composeCharacterTexture(this, this.appearance, 'player_custom');
        createCustomCharacterAnimations(this, 'player_custom', 'player_custom');

        // 2. Создаём персонажа (с выбранным возрастом 15..50 — раунд 44)
        const player = createCharacter(this.characterName || 'Путник', { age: this.selectedAge });
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

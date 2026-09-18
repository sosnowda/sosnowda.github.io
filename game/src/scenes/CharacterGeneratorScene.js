// CharacterGeneratorScene.js — создание собственного персонажа.
//
// РАУНД 50 (пп.8,9 заявки): меню LPC-кастомизации ОТКЛЮЧЕНО — готовые
// спрайты Medieval - Heroes I не слоевые, перекрашивать их слоями нельзя.
// Оставлено только то, что велено владельцем: ИМЯ, КЛАСС, ВОЗРАСТ —
// плюс выбор ОБЛИКА героя (4 готовых фигурки Medieval-Heroes I,
// список фильтруется по полу; сам выбор облика = п.9 заявки).
//
// Контракт со сценами: player.sprite = 'hero_<key>' (лист 4×4 × 64px,
// анимации созданы в BootScene.createWalkAnimations), player.useComposite=false.

import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
import { t } from '../systems/i18n.js';
import { createCharacter } from '../systems/Character.js';
import { getAgeGroupName, describeAgeEffects, ageUnitWord, AGE_MIN, AGE_MAX, AGE_DEFAULT } from '../systems/AgeRules.js';
import { ActionLog } from '../data/actionLog.js';
import { initThiefHunt } from '../data/thief.js';
import { resetVillageName } from '../data/world.js';
import { initTime, createRandomStartDate } from '../systems/TimeSystem.js';
import { initNpcNames } from '../data/npcNames.js';
import { initReputation } from '../data/reputation.js';
import { HERO_LOOKS, heroLooksForGender } from '../data/heroes.js';
import AudioManager from '../systems/AudioManager.js';

const ARCHETYPES = ['Следопыт', 'Воин', 'Сыщик', 'Приключенец'];

export class CharacterGeneratorScene extends Phaser.Scene {
    constructor() {
        super('CharacterGenerator');
    }

    create() {
        bindRestartOnResize(this);
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);

        // Состояние
        this.sex = 'male';
        this.selectedAge = AGE_DEFAULT; // возраст героя 15..50 (раунд 44)
        this.archetype = 'Приключенец';
        this.heroKey = 'hero_baenor';
        this.heroCards = [];

        this.add.text(width / 2, 26, t('🎨 Создание персонажа'), {
            fontFamily: 'Georgia, serif',
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        this.add.text(width / 2, 60, t('Имя, класс, возраст — и облик из готовых героев. Кастомизация слоёв отключена (раунд 50).'), {
            fontSize: '13px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5, 0);

        const narrow = width < 760;

        // === Пол ===
        const sexY = 108;
        this.add.text(width / 2 - 100, sexY, t('Пол:'), {
            fontSize: '16px', color: RUS.text, stroke: '#000', strokeThickness: 1,
        }).setOrigin(1, 0.5);
        this.sexBtnM = createButton(this, width / 2 - 60, sexY, t('♂ Муж'), () => {
            this.sex = 'male';
            this.refreshSexButtons();
            this.refreshHeroes();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });
        this.sexBtnF = createButton(this, width / 2 + 30, sexY, t('♀ Жен'), () => {
            this.sex = 'female';
            this.refreshSexButtons();
            this.refreshHeroes();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });
        this.refreshSexButtons();

        // === Возраст (в строке пола справа) ===
        const ageX = width / 2 + 140;
        if (!narrow) {
            this.add.text(ageX, sexY, t('Возраст:'), {
                fontSize: '16px', color: RUS.text, stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0.5);
        }
        createButton(this, ageX + (narrow ? 0 : 86), sexY, '−', () => {
            this.selectedAge = Math.max(AGE_MIN, this.selectedAge - 1);
            this.updateAgeUI();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 10, right: 10, top: 4, bottom: 4 },
        });
        this.ageValueText = this.add.text(ageX + (narrow ? 40 : 122), sexY, String(this.selectedAge), {
            fontSize: '20px', color: '#c9a14a', fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5);
        createButton(this, ageX + (narrow ? 80 : 158), sexY, '+', () => {
            this.selectedAge = Math.min(AGE_MAX, this.selectedAge + 1);
            this.updateAgeUI();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 10, right: 10, top: 4, bottom: 4 },
        });
        this.ageEffectsText = this.add.text(width / 2, sexY + 30, '', {
            fontSize: '12px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
            wordWrap: { width: narrow ? 320 : 460 },
        }).setOrigin(0.5, 0.5);

        // === Имя ===
        this.characterName = t('Путник');
        this.add.text(width / 2, 164, t('Имя:'), {
            fontSize: '14px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        this.nameInput = this.add.text(width / 2, 190, this.characterName, {
            fontSize: '20px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2, padding: { x: 12, y: 6 },
            backgroundColor: '#00000055',
        }).setOrigin(0.5);
        this.nameInput.setInteractive({ useHandCursor: true });
        this.nameInput.on('pointerdown', () => this.editName());

        // === Класс (ниже имени — раунд 50: раньше «Класс:» прятался под рамкой имени) ===
        const classY = 252;
        this.add.text(width / 2, classY - 24, t('Класс:'), {
            fontSize: '14px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        const step = narrow ? 92 : 128;
        const startX = width / 2 - step * 1.5;
        this.classBtns = [];
        ARCHETYPES.forEach((arc, i) => {
            const btn = createButton(this, startX + i * step, classY, t(arc), () => {
                this.archetype = arc;
                this.refreshClassButtons();
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 13, padding: { left: 10, right: 10, top: 6, bottom: 6 },
            });
            this.classBtns.push({ arc, btn });
        });

        // === Облик (Medieval - Heroes I) ===
        this.heroTitle = this.add.text(width / 2, 308, t('Облик героя:'), {
            fontSize: '14px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        this.heroLayer = this.add.container(0, 0);
        this.refreshHeroes();

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
            backgroundColor: 0x6a3020, hoverColor: 0x7a4030, textColor: '#f0d890',
            fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 },
        });

        this.updateAgeUI();
    }

    refreshSexButtons() {
        const pair = [[this.sexBtnM, 'male'], [this.sexBtnF, 'female']];
        pair.forEach(([btn, sex]) => {
            if (!btn) return;
            const bg = (typeof btn.getElement === 'function') ? btn.getElement('background') : null;
            if (bg && typeof bg.setFillStyle === 'function') {
                bg.setFillStyle(sex === this.sex ? RUS.accent : 0x4a3520, 1);
            }
        });
    }

    refreshClassButtons() {
        (this.classBtns || []).forEach(({ arc, btn }) => {
            const bg = (typeof btn.getElement === 'function') ? btn.getElement('background') : null;
            if (bg && typeof bg.setFillStyle === 'function') {
                bg.setFillStyle(arc === this.archetype ? RUS.accent : 0x4a3520, 1);
            }
        });
    }

    refreshHeroes() {
        const { width } = this.scale;
        this.heroLayer.removeAll(true);
        this.heroCards = [];
        const looks = heroLooksForGender(this.sex);
        if (!looks.some(h => h.key === this.heroKey)) {
            this.heroKey = looks[0].key;
        }
        const step2 = width < 760 ? 110 : 140;
        const startX2 = width / 2 - step2 * (looks.length - 1) / 2;
        looks.forEach((h, i) => {
            const cx = startX2 + i * step2;
            const cy = 420;
            const selected = h.key === this.heroKey;
            const frame = this.add.rectangle(cx, cy, step2 - 16, 150, selected ? 0x3a2c14 : 0x1a140e, 0.95)
                .setStrokeStyle(2, selected ? RUS.accent : 0x5a4530);
            const spr = this.add.sprite(cx, cy - 22, h.key, 0).setScale(1.6);
            if (this.anims.exists(`${h.key}_walk_down`)) spr.play(`${h.key}_walk_down`);
            const name = this.add.text(cx, cy + 40, t(h.name), {
                fontSize: '14px', color: selected ? '#c9a14a' : RUS.text, fontStyle: 'bold',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5);
            const desc = this.add.text(cx, cy + 58, t(h.desc), {
                fontSize: '10px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
                align: 'center', wordWrap: { width: step2 - 24 },
            }).setOrigin(0.5);
            const hit = this.add.rectangle(cx, cy, step2 - 12, 156, 0xffffff, 0.001)
                .setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => {
                this.heroKey = h.key;
                this.refreshHeroes();
            });
            this.heroLayer.add([frame, spr, name, desc, hit]);
        });
    }

    editName() {
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
        // Раунд 50 (пп.8,9): облик — готовый герой Medieval-Heroes I,
        // LPC-кастомизация отключена. Класс и возраст — выбор игрока.
        const player = createCharacter(this.characterName || 'Путник', {
            age: this.selectedAge,
            gender: this.sex,
            archetype: this.archetype,
        });
        player.sprite = this.heroKey;
        player.useComposite = false;
        player.heroLook = this.heroKey;
        player.name = this.characterName || player.name;

        // Инициализация игры (общая логика для нового старта)
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
        ActionLog.add(this.registry, `Создан новый персонаж: ${player.name} (${player.archetype}, облик «${t((HERO_LOOKS.find(h => h.key === this.heroKey) || {}).name || 'герой')}»).`);

        this.scene.start('Village');
    }
}

// CharacterGeneratorScene.js — создание собственного персонажа.
//
// РАУНД 50 (пп.8,9 заявки): меню послойной LPC-кастомизации было отключено —
// готовые спрайты Medieval - Heroes I не слоевые.
// РАУНД 59 (пп.7,8 приказа владельца): облик героя снова СОБИРАЕТСЯ ИЗ СЛОЁВ
// LPC — тем же единым шаблоном, что и жители (NpcLpc), а цвета ОДЕЖДЫ,
// ВОЛОС и ГЛАЗ выбираются СЛУЧАЙНЫМ ОБРАЗОМ при каждом старте игры.
// Осталось по-прежнему: ИМЯ, КЛАСС, ВОЗРАСТ, ПОЛ (+ кнопка «Другой облик»).
//
// Контракт со сценами (раунд 59): player.useComposite = true, спрайт —
// LPC-композит 'player_composite' (анимации player_composite_walk_*/idle_*).
// Все сцены (Village/Interior/Location/Apiary/Forest) уже поддерживают
// композитный путь — проверяют player.useComposite.

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
// Раунд 59 (пп.7,8 приказа владельца): облик героя собирается ЕДИНМ шаблоном
// LPC (как у жителей), а цвета ОДЕЖДЫ/ВОЛОС/ГЛАЗ — СЛУЧАЙНЫЕ на каждый старт
import { rollPlayerAppearance, composePlayerTexture } from '../systems/NpcLpc.js';
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
        this.playerLook = null;  // раунд 59: случайный облик (LPC-слои)

        this.add.text(width / 2, 26, t('🎨 Создание персонажа'), {
            fontFamily: 'Georgia, serif',
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        this.add.text(width / 2, 60, t('Имя, класс, возраст, пол — облик собран единым шаблоном со случайными цветами (раунд 59).'), {
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
            this.rerollLook();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });
        this.sexBtnF = createButton(this, width / 2 + 30, sexY, t('♀ Жен'), () => {
            this.sex = 'female';
            this.refreshSexButtons();
            this.rerollLook();
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

        // === Облик (раунд 59): случайные цвета одежды/волос/глаз на каждый старт ===
        this.heroTitle = this.add.text(width / 2, 308, t('Облик героя (случайные цвета на каждый старт игры):'), {
            fontSize: '14px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        this.lookLayer = this.add.container(0, 0);
        this.buildLookPreview();

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
            if (!btn) return;
            const bg = (typeof btn.getElement === 'function') ? btn.getElement('background') : null;
            if (bg && typeof bg.setFillStyle === 'function') {
                bg.setFillStyle(arc === this.archetype ? RUS.accent : 0x4a3520, 1);
            }
        });
    }

    /**
     * Раунд 59 (пп.7,8): превью СЛУЧАЙНОГО облика героя (LPC-композит).
     * Цвета одежды/волос/глаз — Math.random; кнопка «🎲 Другой облик»
     * перебрасывает. Возраст влияет на бороду (25+) и седину (50+).
     */
    buildLookPreview() {
        const { width } = this.scale;
        this.lookLayer.removeAll(true);
        if (!this.playerLook) {
            this.playerLook = rollPlayerAppearance(this.sex, this.selectedAge);
        }
        // Собираем превью-текстуру (обновляется на месте — без remove/add)
        composePlayerTexture(this, this.playerLook, 'player_preview');
        const cy = 408;
        const frame = this.add.rectangle(width / 2, cy, 170, 172, 0x1a140e, 0.95)
            .setStrokeStyle(2, RUS.accent);
        const spr = this.add.sprite(width / 2, cy - 24, 'player_preview', 0).setScale(2.3);
        if (this.anims.exists('player_preview_walk_down')) spr.play('player_preview_walk_down');
        const hint = this.add.text(width / 2, cy + 66, t('Цвета одежды, волос и глаз выбираются случайно'), {
            fontSize: '10px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        const reroll = createButton(this, width / 2, cy + 102, t('🎲 Другой облик'), () => this.rerollLook(), {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 13, padding: { left: 14, right: 14, top: 6, bottom: 6 },
        });
        this.lookLayer.add([frame, spr, hint, reroll]);
    }

    /** Перебросить случайный облик (пол/возраст учитываются). */
    rerollLook() {
        this.playerLook = rollPlayerAppearance(this.sex, this.selectedAge);
        this.buildLookPreview();
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
        // Раунд 59: возраст меняет облик (борода 25+, седина 50+) —
        // перебрасываем только ВОЗРАСТНЫЕ признаки, сохраняя цвета
        if (this.playerLook) {
            const fresh = rollPlayerAppearance(this.sex, this.selectedAge);
            this.playerLook = { ...fresh, ...this.playerLook, hair: fresh.hair, beards: fresh.beards };
            if (!this.playerLook.beards) delete this.playerLook.beards;
            this.buildLookPreview();
        }
    }

    confirmCharacter() {
        // Раунд 59 (пп.7,8): облик героя — LPC-композит 'player_composite'
        // со случайными цветами одежды/волос/глаз (своими на каждый старт).
        if (!this.playerLook) this.playerLook = rollPlayerAppearance(this.sex, this.selectedAge);
        const player = createCharacter(this.characterName || 'Путник', {
            age: this.selectedAge,
            gender: this.sex,
            archetype: this.archetype,
        });
        // Собираем ИТОГОВУЮ текстуру героя (+ анимации walk/idle)
        const composed = composePlayerTexture(this, this.playerLook, 'player_composite');
        player.useComposite = composed;          // при неудаче — честный фолбэк на hero_*
        player.lpcAppearance = this.playerLook;  // состав слоёв (для отладки/будущих сейвов)
        player.sprite = composed ? 'player_composite' : player.sprite;
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
        ActionLog.add(this.registry, `Создан новый персонаж: ${player.name} (${player.archetype}). Облик собран из случайных цветов одежды, волос и глаз (раунд 59).`);

        this.scene.start('Village');
    }
}

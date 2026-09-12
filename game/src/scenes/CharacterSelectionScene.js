// Сцена выбора/создания персонажа.
// Позволяет выбрать одного из 4 готовых героев или сгенерировать случайного.
// После выбора можно изменить имя.

import { RUS } from '../config/RusTheme.js';
import { createButton } from '../utils/ui.js';
import {
    PRESET_HEROES, GENERATION_PATTERNS,
    createPresetHero, createRandomHero,
    CHARACTER_KEYS, SKILLS, SKILL_CATEGORIES,
    ARMORS, WEAPONS,
} from '../systems/Character.js';
import { ActionLog } from '../data/actionLog.js';
import { initThiefHunt } from '../data/thief.js';
import { resetVillageName, getVillageName } from '../data/world.js';
import { initTime, createRandomStartDate } from '../systems/TimeSystem.js';
import { initNpcNames } from '../data/npcNames.js';
import { initReputation } from '../data/reputation.js';
import AudioManager from '../systems/AudioManager.js';

export class CharacterSelectionScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelection');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);
        this.audioManager.playSceneMusic('menu');
        this.selectedHero = null;
        this.customName = '';

        // Заголовок
        this.add.text(width / 2, 30, 'Создание персонажа', {
            fontFamily: 'Georgia, serif', fontSize: '32px', color: '#E8DCC4',
            fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        // Кнопка "Случайный персонаж"
        createButton(this, width / 2, 90, '🎲 Случайный персонаж', () => {
            this.showRandomGenerator();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 12, bottom: 12 },
        });

        // Кнопка "Свой персонаж (LPC)" — переход в CharacterGenerator
        createButton(this, width / 2 + 280, 90, '🎨 Свой облик', () => {
            this.scene.start('CharacterGenerator');
        }, {
            backgroundColor: 0x4a3a5a, hoverColor: 0x5a4a6a, textColor: RUS.text,
            fontSize: 14, padding: { left: 18, right: 18, top: 12, bottom: 12 },
        });

        // 8 готовых героев в сетке 4×2 (4 архетипа × 2 пола)
        const cardW = 240;
        const cardH = 280;
        const gapX = 16;
        const gapY = 16;
        const cols = 4;
        const totalW = cardW * cols + gapX * (cols - 1);
        const startX = (width - totalW) / 2 + cardW / 2;
        const startY = 260;

        PRESET_HEROES.forEach((hero, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);
            this.drawHeroCard(x, y, cardW, cardH, hero, () => {
                this.selectHero(hero, false);
            });
        });

        // Подсказка снизу
        this.add.text(width / 2, height - 80, 'Выберите готового героя или сгенерируйте случайного', {
            fontSize: '14px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // Кнопка "Назад"
        createButton(this, 100, height - 40, '◀ Назад', () => {
            this.scene.start('Title');
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        });
    }

    /**
     * Нарисовать карточку готового героя.
     */
    drawHeroCard(x, y, w, h, hero, onClick) {
        const container = this.add.container(x, y);

        // Фон карточки
        const bg = this.add.rectangle(0, 0, w, h, 0x241B15, 0.95)
            .setStrokeStyle(2, 0xC9A961);
        container.add(bg);

        // Заголовок-архетип
        const title = this.add.text(0, -h / 2 + 25, hero.archetype, {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        container.add(title);

        // Имя
        const name = this.add.text(0, -h / 2 + 55, hero.name + (hero.gender === 'female' ? ' ♀' : ' ♂'), {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        container.add(name);

        // Описание
        const desc = this.add.text(0, -h / 2 + 90, hero.description, {
            fontSize: '12px', color: RUS.textDim,
            wordWrap: { width: w - 20 }, align: 'center',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5, 0);
        container.add(desc);

        // Ключевые навыки (3-4 верхних)
        const topSkills = Object.entries(hero.skillOverrides)
            .sort((a, b) => b[1] - a[1]).slice(0, 4);
        let skillY = -h / 2 + 170;
        topSkills.forEach(([key, val]) => {
            const skillDef = SKILLS.find(s => s.key === key);
            if (skillDef) {
                const txt = this.add.text(0, skillY, `${skillDef.name}: ${val}%`, {
                    fontSize: '13px', color: RUS.text,
                    stroke: '#000', strokeThickness: 1,
                }).setOrigin(0.5);
                container.add(txt);
                skillY += 18;
            }
        });

        // Стартовое снаряжение
        const armor = ARMORS[hero.startArmor];
        const weapon = WEAPONS[hero.startWeapon];
        const gear = this.add.text(0, h / 2 - 50,
            `⚔ ${weapon.name}\n🛡 ${armor.name}`, {
            fontSize: '12px', color: '#c9a14a', align: 'center',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        container.add(gear);

        // Hover-эффект
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => {
            bg.setFillStyle(0x3a2b1f, 1);
            bg.setScale(1.03);
            title.setScale(1.03);
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(0x241B15, 0.95);
            bg.setScale(1);
            title.setScale(1);
        });
        bg.on('pointerup', () => onClick());
    }

    /**
     * Показать окно генератора случайного персонажа.
     */
    showRandomGenerator() {
        const { width, height } = this.scale;
        // Подложка
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);

        // Панель
        const panelW = 600, panelH = 500;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, 'Генерация случайного героя', {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 65, 'Выберите паттерн генерации:', {
            fontSize: '16px', color: RUS.text,
        }).setOrigin(0.5).setDepth(202);

        // Кнопки паттернов
        const patterns = GENERATION_PATTERNS;
        const btnY = height / 2 - panelH / 2 + 110;
        const btnH = 60;
        patterns.forEach((p, i) => {
            const y = btnY + i * (btnH + 8);
            createButton(this, width / 2, y, `${p.name} — ${p.desc}`, () => {
                const hero = createRandomHero(p.id);
                this.selectedHero = hero;
                overlay.destroy();
                panel.destroy();
                // Уничтожаем все кнопки паттернов
                this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
                this.showHeroPreview(hero);
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setDepth(202);
        });

        // Кнопка "Отмена"
        createButton(this, width / 2, height / 2 + panelH / 2 - 40, 'Отмена', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    /**
     * Показать превью выбранного/сгенерированного героя с возможностью смены имени.
     */
    showHeroPreview(hero) {
        const { width, height } = this.scale;
        // Сохраним hero для использования в обработчиках
        this._previewHero = hero;

        // Подложка
        this._previewOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);

        // Панель
        const panelW = 700, panelH = 580;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);
        this._previewPanel = panel;

        // Архетип и пол
        this.add.text(width / 2, height / 2 - panelH / 2 + 30,
            `${hero.archetype} (${hero.gender === 'female' ? 'женщина' : 'мужчина'})`, {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        // Поле ввода имени (через DOM-элемент, т.к. Phaser не имеет встроенного input)
        const inputY = height / 2 - panelH / 2 + 80;
        this.add.text(width / 2 - 200, inputY, 'Имя:', {
            fontSize: '18px', color: RUS.text,
        }).setOrigin(1, 0.5).setDepth(202);

        // Создаём HTML input поверх canvas
        const input = document.createElement('input');
        input.type = 'text';
        input.value = hero.name;
        input.maxLength = 20;
        input.style.position = 'absolute';
        input.style.left = '50%';
        input.style.top = (inputY - 14) + 'px';
        input.style.transform = 'translateX(-50%)';
        input.style.width = '250px';
        input.style.padding = '6px 10px';
        input.style.fontSize = '16px';
        input.style.fontFamily = 'Georgia, serif';
        input.style.background = '#1a1a1a';
        input.style.color = '#E8DCC4';
        input.style.border = '2px solid #C9A961';
        input.style.borderRadius = '4px';
        input.style.outline = 'none';
        input.style.zIndex = '300';
        document.body.appendChild(input);
        this._nameInput = input;

        // Характеристики
        const statsY = inputY + 50;
        this.add.text(width / 2 - 300, statsY, 'Характеристики:', {
            fontSize: '16px', color: '#C9A961', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        const statsLine1 = CHARACTER_KEYS.slice(0, 4).map(c => `${c.name}: ${hero[c.key]}`).join('  ');
        const statsLine2 = CHARACTER_KEYS.slice(4).map(c => `${c.name}: ${hero[c.key]}`).join('  ');
        this.add.text(width / 2 - 300, statsY + 22, statsLine1, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);
        this.add.text(width / 2 - 300, statsY + 44, statsLine2, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        // Производные
        const derivY = statsY + 80;
        const derivText = `HP: ${hero.HPmax}   MP: ${hero.MPmax}   Бонус урона: ${hero.DB.text}   Броня: ${hero.armor ? hero.armor.def : 0}`;
        this.add.text(width / 2, derivY, derivText, {
            fontSize: '15px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Навыки по категориям
        const skillsY = derivY + 30;
        this.add.text(width / 2 - 300, skillsY, 'Навыки:', {
            fontSize: '16px', color: '#C9A961', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        // Группируем навыки по категориям
        let skillDisplayY = skillsY + 25;
        const colX1 = width / 2 - 300;
        const colX2 = width / 2 + 50;
        let col1Y = skillDisplayY;
        let col2Y = skillDisplayY;
        SKILLS.forEach((s, i) => {
            const val = hero.skills[s.key] || 0;
            const txt = `${s.name}: ${val}%`;
            const colObj = SKILL_CATEGORIES[s.category];
            const color = colObj ? colObj.color : RUS.text;
            const x = (i % 2 === 0) ? colX1 : colX2;
            const y = (i % 2 === 0) ? col1Y : col2Y;
            this.add.text(x, y, txt, {
                fontSize: '13px', color: color,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0).setDepth(202);
            if (i % 2 === 0) col1Y += 18;
            else col2Y += 18;
        });

        // Снаряжение
        const gearY = col1Y + 20;
        const weapon = WEAPONS[hero.weaponId] || { name: 'Кулаки' };
        const armor = ARMORS[hero.armorId] || { name: 'Без доспеха' };
        this.add.text(width / 2 - 300, gearY, `⚔ Оружие: ${weapon.name}`, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);
        this.add.text(width / 2 - 300, gearY + 22, `🛡 Доспех: ${armor.name}`, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        // Кнопки "Начать игру" и "Отмена"
        createButton(this, width / 2 - 120, height / 2 + panelH / 2 - 40, 'Начать игру', () => {
            const customName = this._nameInput.value.trim() || hero.name;
            hero.name = customName;
            this.cleanupPreview();
            this.startGameWithHero(hero);
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 12, bottom: 12 },
        }).setDepth(202);

        createButton(this, width / 2 + 120, height / 2 + panelH / 2 - 40, 'Отмена', () => {
            this.cleanupPreview();
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 12, bottom: 12 },
        }).setDepth(202);
    }

    cleanupPreview() {
        if (this._nameInput) {
            this._nameInput.remove();
            this._nameInput = null;
        }
        if (this._previewOverlay) {
            this._previewOverlay.destroy();
            this._previewOverlay = null;
        }
        if (this._previewPanel) {
            this._previewPanel.destroy();
            this._previewPanel = null;
        }
        this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
    }

    selectHero(presetHero, isRandom) {
        const hero = isRandom ? presetHero : createPresetHero(presetHero.id);
        this.showHeroPreview(hero);
    }

    startGameWithHero(hero) {
        // Сбрасываем название деревни для новой сессии
        resetVillageName();
        const villageName = getVillageName();

        // Случайная дата начала игры в пределах 15 века (п.12)
        const startDate = createRandomStartDate();

        const q = {
            elderTalked: false,
            merchantTalked: false,
            soldierTalked: false,
            banditDefeated: false,
            hasHerb: true,
            tutorialStep: 0,
            currentObjective: `Ты беженец в деревне ${villageName}. Найди приют и работу.`,
            chestsOpened: [],
            hoursPassed: 0,
            moneyAskedFrom: [],
            villageName: villageName,
            // Сценарий беженца (п.1): герой пришёл в незнакомую деревню
            isRefugee: true,
            metNpcs: [],
            // Беженец начинает с минимумом денег
            refugeeStartingMoney: 5 + Math.floor(Math.random() * 10), // 5-14 д.
        };

        // Беженец начинает с минимумом денег (п.1)
        hero.dengas = q.refugeeStartingMoney;

        this.registry.set('player', hero);
        this.registry.set('quest', q);
        initThiefHunt(this.registry);
        ActionLog.init(this.registry);
        // Инициализируем игровое время
        initTime(this.registry, startDate);
        // Инициализируем NPC со случайными историческими именами (п.6)
        initNpcNames(this.registry);
        // Инициализируем систему репутации
        initReputation(this.registry);
        
        ActionLog.add(this.registry, 
            `Игра началась. ${hero.name} (${hero.archetype}) — беженец из разорённой врагами деревни. ` +
            `Пришёл в незнакомую деревню ${villageName}. ` +
            `Дата: ${startDate.day}.${startDate.month + 1}.${startDate.yearFromChrist} от Р.Х.`
        );
        // П.11: После выбора героя — переход в генератор внешности, а не сразу в деревню.
        this.scene.start('CharacterAppearance');
    }
}

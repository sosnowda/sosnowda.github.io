// Сцена выбора/создания персонажа.
// Позволяет выбрать одного из 4 готовых героев или сгенерировать случайного.
// После выбора можно изменить имя.

import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
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
import { t, tf } from '../systems/i18n.js';
import { ageUnitWord } from '../systems/AgeRules.js';
// РАУНД 62 (п.1): готовые прессеты героя «Баэнор» (♂)/«Пауль» (♀)
// возвращены — LPC-композит собирается здесь, автоматом по полу.
// (Кастомизация по-прежнему отсутствует — пп.7,10 раунда 61.)
import { getHeroPreset, composePlayerTexture } from '../systems/NpcLpc.js';

export class CharacterSelectionScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelection');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);
        this.audioManager.playSceneMusic('menu');
        this.selectedHero = null;
        this.customName = '';

        // Раунд 17 (QA-фикс): при любом уходе со сцены (ESC, переходы)
        // снимать DOM-инпут имени с body — иначе поле «Гаврила»
        // остаётся висеть поверх игры.
        this.events.once('shutdown', () => this.cleanupPreview());

        // Заголовок
        this.add.text(width / 2, 30, t('Создание персонажа'), {
            fontFamily: 'Georgia, serif', fontSize: '32px', color: '#E8DCC4',
            fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        // Кнопка "Случайный персонаж" (центр)
        // РАУНД 61: кнопка «🎨 Свой облик» УДАЛЕНА (кастомизация внешности
        // не работала как надо — вернули готовые модели без кастомизации).
        // ФИКС аудита UI: кнопка стояла на y=90 и её верхний край касался
        // низа заголовка — опущена на y=100
        createButton(this, width / 2, 100, t('🎲 Случайный персонаж'), () => {
            this.showRandomGenerator();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 12, bottom: 12 },
        });

        // 8 готовых героев в сетке (4 архетипа × 2 пола).
        // ФИКС аудита UI: сетка была жёстко 4×240px = 1008px — на узких окнах
        // карточки вылезали за края; второй ряд уходил под подсказку при низких
        // окнах. Теперь число колонок по ширине, карточки сжимаются по высоте.
        const cols = width >= 1100 ? 4 : 2;
        const cardW = Math.min(240, Math.floor((width - 40 - (cols - 1) * 16) / cols));
        const startY = 148;
        const rows = Math.ceil(PRESET_HEROES.length / cols);
        const availH = Math.max(300, height - startY - 76);
        const cardH = Phaser.Math.Clamp(Math.floor(availH / rows) - 16, 130, 252);
        const gapX = 16;
        const gapY = 16;
        const totalW = cardW * cols + gapX * (cols - 1);
        const startX = (width - totalW) / 2 + cardW / 2;

        PRESET_HEROES.forEach((hero, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            // startY — ВЕРХ сетки; контейнер карточки центрируется, поэтому
            // первый ряд сдвинут на cardH/2 (фикс: карточки перекрывали заголовок)
            const y = startY + cardH / 2 + row * (cardH + gapY);
            this.drawHeroCard(x, y, cardW, cardH, hero, () => {
                this.selectHero(hero, false);
            });
        });

        // Подсказка снизу
        this.add.text(width / 2, height - 60, t('Выберите готового героя или сгенерируйте случайного'), {
            fontSize: '14px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // Кнопка "Назад"
        createButton(this, 100, height - 24, t('◀ Назад'), () => {
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
        // ФИКС аудита UI: при сжатых карточках (узкие/низкие окна) —
        // компактная раскладка текстов, без пересечений
        const compact = h < 220;

        // Фон карточки
        const bg = this.add.rectangle(0, 0, w, h, 0x241B15, 0.95)
            .setStrokeStyle(2, 0xC9A961);
        container.add(bg);

        // Заголовок-архетип
        const title = this.add.text(0, -h / 2 + (compact ? 18 : 25), t(hero.archetype), {
            fontSize: compact ? '17px' : '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        container.add(title);

        // Имя
        // Патч 66.3: имя героя — собственное, в EN транслитерацией (t())
        const name = this.add.text(0, -h / 2 + (compact ? 40 : 55), t(hero.name) + (hero.gender === 'female' ? ' ♀' : ' ♂'), {
            fontSize: compact ? '13px' : '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        container.add(name);

        // Описание (в компактных карточках скрывается — навыки и снаряжение важнее)
        let descH = 0;
        if (!compact) {
            const desc = this.add.text(0, -h / 2 + 90, t(hero.description), {
                fontSize: '12px', color: RUS.textDim,
                wordWrap: { width: w - 20 }, align: 'center',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5, 0);
            container.add(desc);
            descH = desc.height;
        }

        // Ключевые навыки (3 верхних) — старт строго после фактической высоты описания
        const topSkills = Object.entries(hero.skillOverrides)
            .sort((a, b) => b[1] - a[1]).slice(0, 3);
        const skillFont = compact ? 10 : 13;
        const skillStep = compact ? 15 : 18;
        let skillY = -h / 2 + (compact ? 56 : 90) + descH + 14;
        topSkills.forEach(([key, val]) => {
            const skillDef = SKILLS.find(s => s.key === key);
            if (skillDef) {
                const txt = this.add.text(0, skillY, `${t(skillDef.name)}: ${val}%`, {
                    fontSize: `${skillFont}px`, color: RUS.text,
                    stroke: '#000', strokeThickness: 1,
                }).setOrigin(0.5);
                container.add(txt);
                skillY += skillStep;
            }
        });

        // Стартовое снаряжение (в компактных карточках — одной строкой,
        // чтобы не пересекалось с третьим навыком)
        const armor = ARMORS[hero.startArmor];
        const weapon = WEAPONS[hero.startWeapon];
        const gear = this.add.text(0, h / 2 - (compact ? 16 : 26),
            compact
                ? `⚔ ${t(weapon.name)} · 🛡 ${t(armor.name)}`
                : `⚔ ${t(weapon.name)}\n🛡 ${t(armor.name)}`, {
            fontSize: compact ? '9px' : '12px', color: '#c9a14a', align: 'center',
            stroke: '#000', strokeThickness: 1,
            wordWrap: compact ? { width: w - 14 } : undefined,
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

        // Панель — ФИКС аудита UI: была жёстко 600×500, вылезала на узких окнах;
        // подписи кнопок укорочены (только имя паттерна) — длинные строки
        // «Боевой — Высокие STR/CON…» не влезали в узкую панель
        const panelW = Math.min(600, width - 20);
        const panelH = Math.min(500, height - 16);
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, t('Генерация случайного героя'), {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 65, t('Выберите паттерн генерации:'), {
            fontSize: '16px', color: RUS.text,
        }).setOrigin(0.5).setDepth(202);

        // Кнопки паттернов — с описанием под кнопкой (не в подписи кнопки)
        const patterns = GENERATION_PATTERNS;
        const btnH = 40;
        const descStep = 20;
        const slotH = btnH + descStep + 8;
        const startY0 = height / 2 - panelH / 2 + 100;
        patterns.forEach((p, i) => {
            const y = startY0 + i * slotH;
            createButton(this, width / 2, y, t(p.name), () => {
                const hero = createRandomHero(p.id);
                this.selectedHero = hero;
                overlay.destroy();
                panel.destroy();
                // Уничтожаем все кнопки паттернов
                this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
                this.showHeroPreview(hero);
            }, {
                backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
                fontSize: 15, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setDepth(202);
            // Короткое описание паттерна — под кнопкой
            this.add.text(width / 2, y + btnH / 2 + 4, t(p.desc), {
                fontSize: '11px', color: RUS.textDim,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5, 0).setDepth(202);
        });

        // Кнопка "Отмена"
        createButton(this, width / 2, height / 2 + panelH / 2 - 40, t('Отмена'), () => {
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

        // Панель — ФИКС аудита UI: была жёстко 700×580 (выше окна 577 и
        // шире мобильного 390). Вписываем в окно; при нехватке высоты —
        // компакт: навыки в 3 колонки, меньшие шаги.
        const panelW = Math.min(700, width - 20);
        const panelH = Math.min(580, height - 16);
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);
        this._previewPanel = panel;
        const compact = panelH < 520;
        const left = width / 2 - panelW / 2 + 20;   // левый край контента
        const top = height / 2 - panelH / 2;        // верх панели

        // Архетип и пол (+ возраст — раунд 44)
        this.add.text(width / 2, top + 30,
            `${t(hero.archetype)} (${hero.gender === 'female' ? t('женщина') : t('мужчина')}${hero.age != null ? `, ${hero.age} ${ageUnitWord(hero.age)}` : ''})`, {
            fontSize: compact ? '18px' : '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        // Поле ввода имени (через DOM-элемент, т.к. Phaser не имеет встроенного input)
        const inputY = top + (compact ? 62 : 80);
        this.add.text(width / 2 - (compact ? 130 : 200), inputY, t('Имя:'), {
            fontSize: compact ? '14px' : '18px', color: RUS.text,
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
        const statsY = inputY + (compact ? 38 : 50);
        this.add.text(left, statsY, t('Характеристики:'), {
            fontSize: compact ? '13px' : '16px', color: '#C9A961', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        // Патч 66.2: названия характеристик через t() (EN-экран выбора героя)
        const statsLine1 = CHARACTER_KEYS.slice(0, 4).map(c => `${t(c.name)}: ${hero[c.key]}`).join('  ');
        const statsLine2 = CHARACTER_KEYS.slice(4).map(c => `${t(c.name)}: ${hero[c.key]}`).join('  ');
        this.add.text(left, statsY + (compact ? 18 : 22), statsLine1, {
            fontSize: compact ? '12px' : '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);
        this.add.text(left, statsY + (compact ? 36 : 44), statsLine2, {
            fontSize: compact ? '12px' : '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        // Производные
        const derivY = statsY + (compact ? 58 : 80);
        const derivText = `HP: ${hero.HPmax}   MP: ${hero.MPmax}   ${t('Бонус урона:')} ${hero.DB.text}   ${t('Броня:')} ${hero.armor ? hero.armor.def : 0}`;
        this.add.text(width / 2, derivY, derivText, {
            fontSize: compact ? '13px' : '15px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Навыки по категориям (при нехватке места — краткая справка,
        // полный список всегда доступен в свитке персонажа в игре)
        const skillsY = derivY + (compact ? 22 : 30);
        this.add.text(left, skillsY, t('Навыки:'), {
            fontSize: compact ? '13px' : '16px', color: '#C9A961', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5).setDepth(202);

        if (compact) {
            this.add.text(width / 2, skillsY + 24, t('Навыки героя — в свитке «Персонаж» (по ходу игры).'), {
                fontSize: '12px', color: RUS.textDim,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);
        } else {
            let skillDisplayY = skillsY + 25;
            const colX1 = left;
            const colX2 = width / 2 + 50;
            let col1Y = skillDisplayY;
            let col2Y = skillDisplayY;
            SKILLS.forEach((s, i) => {
                const val = hero.skills[s.key] || 0;
                const txt = `${t(s.name)}: ${val}%`;
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
            this.add.text(left, gearY, `${t('⚔ Оружие:')} ${t(weapon.name)}`, {
                fontSize: '14px', color: RUS.text,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0.5).setDepth(202);
            this.add.text(left, gearY + 22, `${t('🛡 Доспех:')} ${t(armor.name)}`, {
                fontSize: '14px', color: RUS.text,
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0.5).setDepth(202);
        }

        // Кнопки "Начать игру" и "Отмена"
        const btnGap = panelW < 520 ? 100 : 120;
        createButton(this, width / 2 - btnGap, height / 2 + panelH / 2 - 40, t('Начать игру'), () => {
            const customName = this._nameInput.value.trim() || hero.name;
            hero.name = customName;
            this.cleanupPreview();
            this.startGameWithHero(hero);
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: compact ? 15 : 18, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);

        createButton(this, width / 2 + btnGap, height / 2 + panelH / 2 - 40, t('Отмена'), () => {
            this.cleanupPreview();
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: compact ? 15 : 18, padding: { left: 20, right: 20, top: 10, bottom: 10 },
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
            currentObjective: tf(t('Ты беженец в деревне {0}. Найди приют и работу.'), t(villageName)),
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
            // Патч 66.3: имя героя/архетип/деревня — через t() (EN транслитерация)
            tf(t('Игра началась. {0} ({1}) — беженец из разорённой врагами деревни. Пришёл в незнакомую деревню {2}. Дата: {3} от Р.Х.'),
                t(hero.name), t(hero.archetype), t(villageName),
                `${startDate.day}.${((startDate.month + 8) % 12) + 1}.${startDate.yearFromChrist + (startDate.month >= 4 ? 1 : 0)}`
            )
        );
        // РАУНД 62 (п.1 приказа владельца): ГОТОВЫЕ ПРЕССЕТЫ «Баэнор»/«Пауль»
        // ВЕРНУЛИСЬ — LPC-композиты применяются АВТОМАТИЧЕСКИ ПО ПОЛУ:
        // «Баэнор» — мужскому герою, «Пауль» — женскому (перекрёстно к р.60,
        // как велел владелец). Меню облика нет, кастомизации нет (пп.7,10 р.61);
        // старая готовая модель ('player'/'npc_merchant') остаётся ЗАПАСНОЙ —
        // если композит собрать не удастся, сцены откатятся на неё сами.
        const preset = getHeroPreset(hero.gender, hero.age);
        const composed = composePlayerTexture(this, preset.appearance, 'player_composite');
        hero.useComposite = composed;
        hero.lpcAppearance = preset.appearance;
        hero.presetName = preset.name;
        if (composed) hero.sprite = 'player_composite';
        ActionLog.add(this.registry,
            tf(t('Облик героя: прессет «{0}» выбран автоматически по полу (раунд 62).'), t(preset.name)));
        this.scene.start('Village');
    }
}

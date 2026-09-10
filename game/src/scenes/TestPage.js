import Phaser from 'phaser';
import { createButton, createDialog, createStoryTextBox, createScrollableList, bindRegistryKeys } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import ScoreManager from '../systems/ScoreManager.js';
import SettingsManager from '../systems/SettingsManager.js';
import SaveManager from '../systems/SaveManager.js';

export class TestPage extends Phaser.Scene {

    constructor() {
        super('TestPage');
    }

    preload() {
        this.load.image('background', 'assets/tmp/images/space.png');
        this.load.image('logo', 'assets/tmp/images/phaser.png');

        //  The ship sprite is CC0 from https://ansimuz.itch.io - check out his other work!
        this.load.spritesheet('ship', 'assets/tmp/images/spaceship.png', { frameWidth: 176, frameHeight: 96 });

        // Фоновое изображение кнопки (находится в assets/ui)
        this.load.image('panel_brown_damaged', 'assets/tmp/images/ui/panel_brown_damaged.png');
        
        // Загрузка ресурсов для сюжетного диалога
        this.load.image('characterAvatar', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/assets/images/person.png');
        this.load.image('nextPageIcon', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/assets/images/arrow-down-left.png');
    }

    create() {
        // Инициализация всех системных менеджеров
        this.initManagers();

        this.background = this.add.tileSprite(640, 360, 1280, 720, 'background');

        const logo = this.add.image(640, 200, 'logo');

        const ship = this.add.sprite(640, 360, 'ship');

        // Безопасное создание и воспроизведение анимации
        if (ship && ship.anims && typeof ship.anims.create === 'function') {
            ship.anims.create({
                key: 'fly',
                frames: this.anims.generateFrameNumbers('ship', { start: 0, end: 2 }),
                frameRate: 15,
                repeat: -1
            });
        }

        if (ship && typeof ship.play === 'function') {
            ship.play('fly');
        }

        this.tweens.add({
            targets: logo,
            y: 180,
            duration: 1500,
            ease: 'Sine.inOut',
            yoyo: true,
            loop: -1
        });

        // Создание кнопок
        this.createButtons();
        
        // Создание тестовой панели системных менеджеров
        this.createManagerTestPanel();
    }

    initManagers() {
        console.log('🚀 Инициализация системных менеджеров...');

        // Менеджер настроек (единственный источник всех настроек, включая audio)
        this.settingsManager = new SettingsManager(this);
        console.log('✅ SettingsManager инициализирован');

        // Аудио-менеджер (читает/слушает settings.audio.*)
        this.audioManager = new AudioManager(this);
        console.log('✅ AudioManager инициализирован');

        // Менеджер очков (поддерживает events + registry)
        this.scoreManager = new ScoreManager(this);

        // Слушаем изменения очков/уровня через registry (без привязки к событиям каждой системы)
        const reg = this.registry;
        const regEvents = reg?.events;

        const onScoreCurrentChanged = (parent, value, previous) => {
            if (typeof previous === 'number') {
                const delta = value - previous;
                console.log(`💰 Изменение очков: +${delta} = ${value}`);
            } else {
                console.log(`💰 Текущие очки: ${value}`);
            }
        };

        const onScoreLevelChanged = (parent, value) => {
            console.log(`🎊 Повышение до ${value} уровня!`);
            this.audioManager.playLevelUp();
        };

        if (regEvents) {
            regEvents.on('changedata-score.current', onScoreCurrentChanged);
            regEvents.on('changedata-score.level', onScoreLevelChanged);
        }

        // Достижения пока не синхронизируются в registry, обрабатываются через ScoreManager.events (для звука/логов)
        this.scoreManager.events.on('achievement-unlocked', ({ name }) => {
            console.log(`🏆 Разблокировано достижение: ${name}`);
            this.audioManager.playAchievement();
        });

        // При завершении сцены отвязываем слушатели registry, чтобы не регистрировать повторно
        if (this.events && typeof this.events.once === 'function') {
            this.events.once('shutdown', () => {
                if (regEvents) {
                    regEvents.off('changedata-score.current', onScoreCurrentChanged);
                    regEvents.off('changedata-score.level', onScoreLevelChanged);
                }
            });
        }

        console.log('✅ ScoreManager инициализирован');

        // Слушаем изменения settings.* через registry (легче, чем выводить все настройки)
        const onAnyRegistryChange = (parent, key, value, previous) => {
            if (typeof key === 'string' && key.startsWith('settings.')) {
                console.log(`⚙️ Настройки обновлены: ${key} = ${value} (было: ${previous})`);
            }
        };

        if (regEvents) {
            regEvents.on('changedata', onAnyRegistryChange);
        }

        if (this.events && typeof this.events.once === 'function') {
            this.events.once('shutdown', () => {
                if (regEvents) {
                    regEvents.off('changedata', onAnyRegistryChange);
                }
            });
        }

        // Менеджер сохранений (events)
        this.saveManager = new SaveManager(this);
        this.saveManager.events.on('save-success', ({ slotId }) => {
            console.log(`💾 Сохранение ${slotId} успешно!`);
        });
        this.saveManager.events.on('load-success', ({ slotId, gameState }) => {
            console.log(`📂 Сохранение ${slotId} загружено!`);

            // Пусть «загрузка сохранения» влияет на очки времени выполнения (иначе тест очков читает старое значение)
            if (gameState && this.scoreManager && typeof this.scoreManager.applyGameState === 'function') {
                this.scoreManager.applyGameState(gameState);
            }
        });
        console.log('✅ SaveManager инициализирован');

        console.log('🎉 Все системные менеджеры инициализированы!');
    }

    createButtons() {
        console.log('Начинаем создание кнопок...');
        
        // Кнопка 1: Начать игру
        const startButton = createButton(
            this, 
            640, 
            500, 
            'Начать игру', 
            () => {
                console.log('Нажата кнопка «Начать игру»!');
                this.startGame();
            },
            {
                backgroundImageKey: 'panel_brown_damaged',
                backgroundImageTint: 0xffffff,
                hoverImageTint: 0xffffff,
                pressImageTint: 0xdddddd,

                // Кремовый текст (фиксированный цвет, без авто-подбора контраста)
                textColor: '#F7E7D2',
                textStrokeColor: '#2a1a10',
                textStrokeThickness: 3,
                textShadowColor: '#000000',

                // Однотонная подложка (на случай, если картинка не загрузилась)
                backgroundColor: 0x4CAF50,
                hoverColor: 0x66BB6A,
                pressColor: 0x388E3C,

                icon: '🎮',
                fontSize: 20,
                padding: { left: 26, right: 26, top: 18, bottom: 18 }
            }
        );

        // Кнопка 2: Настройки
        const settingsButton = createButton(
            this, 
            440, 
            580, 
            'Настройки', 
            () => {
                console.log('Нажата кнопка «Настройки»!');
                this.showSettings();
            },
            {
                backgroundImageKey: 'panel_brown_damaged',
                backgroundImageTint: 0xffffff,
                hoverImageTint: 0xffffff,
                pressImageTint: 0xdddddd,

                // Кремовый текст (фиксированный цвет, без авто-подбора контраста)
                textColor: '#F7E7D2',
                textStrokeColor: '#2a1a10',
                textStrokeThickness: 3,
                textShadowColor: '#000000',

                // Однотонная подложка (на случай, если картинка не загрузилась)
                backgroundColor: 0x2196F3,
                hoverColor: 0x42A5F5,
                pressColor: 0x1976D2,

                icon: '⚙️',
                fontSize: 18,
                padding: { left: 22, right: 22, top: 16, bottom: 16 }
            }
        );

        // Кнопка 3: О игре
        const aboutButton = createButton(
            this, 
            840, 
            580, 
            'О игре', 
            () => {
                console.log('Нажата кнопка «О игре»!');
                this.showAbout();
            },
            {
                backgroundColor: 0xFF9800,
                hoverColor: 0xFFB74D,
                pressColor: 0xF57C00,
                icon: 'ℹ️',
                fontSize: 18
            }
        );

        // Дополнительно: кнопка теста диалога
        const testDialogButton = createButton(
            this,
            540,
            650,
            'Тест диалога',
            () => {
                console.log('Нажата кнопка «Тест диалога»!');
                this.showTestDialog();
            },
            {
                backgroundColor: 0x9C27B0,
                hoverColor: 0xBA68C8,
                pressColor: 0x7B1FA2,
                icon: '💬',
                fontSize: 16
            }
        );

        // Дополнительно: кнопка теста сюжетного диалога
        const testStoryButton = createButton(
            this,
            740,
            650,
            'Тест сюжета',
            () => {
                console.log('Нажата кнопка «Тест сюжета»!');
                this.showTestStory();
            },
            {
                backgroundColor: 0xE91E63,
                hoverColor: 0xF06292,
                pressColor: 0xC2185B,
                icon: '📖',
                fontSize: 16
            }
        );

        // Сохраняем ссылки на кнопки
        this.buttons = {
            start: startButton,
            settings: settingsButton,
            about: aboutButton,
            testDialog: testDialogButton,
            testStory: testStoryButton
        };
        
        console.log('Кнопки созданы:', this.buttons);
    }

    startGame() {
        // Создание диалога подтверждения начала игры
        createDialog(
            this,
            'Начать игру',
            'Готовы начать своё космическое приключение?',
            [
                {
                    text: 'Да',
                    callback: () => {
                        console.log('Подтверждено начало игры');
                        // Здесь можно переключиться на игровую сцену
                        // this.scene.start('GamePlay');
                    }
                },
                {
                    text: 'Отмена',
                    callback: () => {
                        console.log('Отменено начало игры');
                    }
                }
            ]
        );
    }

    showSettings() {
        // Создание диалога настроек
        createDialog(
            this,
            'Настройки игры',
            'Здесь можно настроить громкость, качество графики и пр.\n\nГромкость эффектов: 70%\nГромкость музыки: 50%\nКачество: Высокое',
            [
                {
                    text: 'Сохранить',
                    callback: () => {
                        console.log('Сохранить настройки');
                    }
                },
                {
                    text: 'Отмена',
                    callback: () => {
                        console.log('Отменить настройки');
                    }
                }
            ]
        );
    }

    showAbout() {
        // Создание диалога «О игре»
        createDialog(
            this,
            'О игре',
            'Космическое приключение v1.0\n\nСоздано на Phaser 3\n\nСпасибо за игру!',
            [
                {
                    text: 'OK',
                    callback: () => {
                        console.log('Закрыть диалог «О игре»');
                    }
                }
            ]
        );
    }

    showTestDialog() {
        // Тест различных возможностей диалога RexUI
        createDialog(
            this,
            '🎉 Тест диалога RexUI',
            'Это диалог, созданный с помощью Phaser3-Rex-Plugins!\n\n✨ Автоматическая вёрстка\n🎨 Современный дизайн\n🔊 Встроенные звуки\n💫 Плавные анимации\n\nНажмите кнопку или подложку для закрытия',
            [
                {
                    text: 'Отлично!',
                    callback: () => {
                        console.log('Пользователю нравится RexUI!');
                    }
                },
                {
                    text: 'Ещё',
                    callback: () => {
                        console.log('Пользователь хочет посмотреть ещё');
                    }
                },
                {
                    text: 'Закрыть',
                    callback: () => {
                        console.log('Закрыть тестовый диалог');
                    }
                }
            ]
        );
    }

    showTestStory() {
        // Тест сюжетного диалога (с эффектом печатной машинки)
        const storyContent = `[b]Добро пожаловать в космическое приключение![/b]

Это диалоговое окно реализовано через [color=yellow]TextBox от RexUI[/color].

Оно поддерживает:
✨ [color=cyan]Эффект печатной машинки[/color]
📄 [color=lime]Автоматическую разбивку на страницы[/color]
🎨 [color=orange]Форматирование BBCode[/color]
🖱️ [color=pink]Ускорение/пропуск по клику[/color]

[i]Нажмите мышью, чтобы продолжить чтение...[/i]

---

Это содержимое второй страницы.
Когда текст превышает область отображения, происходит автоматическая разбивка.
Видите мигающую иконку в правом нижнем углу?

Она означает, что можно перейти к следующей странице!

---

[b][color=red]Последняя страница[/color][/b]

Спасибо за знакомство с системой сюжетных диалогов!

Эту систему можно использовать для:
• Диалогов RPG
• Визуальных новелл
• Обучающих подсказок
• Сюжетных сцен

[color=yellow]Нажмите ещё раз, чтобы закрыть диалог[/color]`;

        createStoryTextBox(this, {
            characterName: '✨ Системный гид',
            content: storyContent,
            avatarTexture: 'characterAvatar',
            typingSpeed: 50,
            onComplete: () => {
                console.log('Демонстрация сюжета завершена!');
                // Здесь можно запустить последующую логику
            }
        });
    }

    createManagerTestPanel() {
        console.log('Создание тестовой панели системных менеджеров...');

        const cam = this.cameras.main;
        const panelX = 160;
        const panelY = 240;
        const panelWidth = 260;
        const panelHeight = Math.min(340, cam.height - 140);

        const makeButtonNode = (text, callback, color = 0x9C27B0) => {
            return createButton(this, 0, 0, text, callback, {
                backgroundColor: color,
                hoverColor: color + 0x222222,
                pressColor: color - 0x222222,
                fontSize: 14,
                autoPlayAnim: false
            });
        };

        const items = [
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('🔊 Тест звука', () => this.testAudioManager()) },
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('🎵 Управление громкостью', () => this.testVolumeControl()) },
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('💰 Тест очков', () => this.testScoreManager()) },
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('🏆 Тест достижений', () => this.testAchievements()) },
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('⚙️ Тест настроек', () => this.testSettingsManager()) },
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('💾 Тест сохранений', () => this.testSaveManager()) },
            { type: 'spacer', height: 10 },
            { node: makeButtonNode('🔄 Сброс данных', () => this.resetAllData(), 0xFF5252) },
            { type: 'spacer', height: 10 },
        ];

        const list = createScrollableList(this, {
            x: panelX,
            y: panelY,
            width: panelWidth,
            height: panelHeight,
            headerTitle: 'Панель тестов систем',
            items
        });

        if (list) {
            list.setDepth(50);
            list.setChildrenInteractive();
        }
    }
    
    // ==========================================
    //  Методы тестирования AudioManager
    // ==========================================
    
    testAudioManager() {
        console.log('🔊 Тест AudioManager...');
        
        const effects = [
            { name: 'Клик кнопки', method: 'playButtonClick' },
            { name: 'Сбор предмета', method: 'playCollectItem' },
            { name: 'Прыжок', method: 'playJump' },
            { name: 'Выстрел', method: 'playShoot' },
            { name: 'Взрыв', method: 'playExplosion' },
            { name: 'Победа', method: 'playVictory' }
        ];
        
        let delay = 0;
        effects.forEach((effect, index) => {
            this.time.delayedCall(delay, () => {
                console.log(`Воспроизведение: ${effect.name}`);
                this.audioManager[effect.method]();
            });
            delay += 500;
        });
        
        createDialog(
            this,
            '🔊 Тест звука',
            'Последовательно воспроизводятся 6 звуков:\n\n• Клик кнопки\n• Сбор предмета\n• Прыжок\n• Выстрел\n• Взрыв\n• Победа\n\nСлушайте внимательно!',
            [{ text: 'OK', callback: () => {} }]
        );
    }
    
    testVolumeControl() {
        console.log('🎵 Тест управления громкостью...');

        const buildVolumeMessage = () => {
            const currentVol = (this.audioManager.getSFXVolume() * 100).toFixed(0);
            const isMuted = this.audioManager.isSFXMuted();
            return `Текущая громкость эффектов: ${currentVol}%\nСостояние mute: ${isMuted ? 'вкл' : 'выкл'}\n\nПосле настройки нажмите «Готово»`;
        };

        const dialog = createDialog(
            this,
            '🎵 Управление громкостью',
            buildVolumeMessage(),
            [
                {
                    text: '+ Увеличить',
                    closeDialog: false,
                    callback: () => {
                        const currentVol = Math.min(100, Math.round(this.audioManager.getSFXVolume() * 100) + 10);
                        this.audioManager.setSFXVolume(currentVol / 100);
                        console.log(`Громкость увеличена до ${currentVol}%`);
                    }
                },
                {
                    text: '− Уменьшить',
                    closeDialog: false,
                    callback: () => {
                        const currentVol = Math.max(0, Math.round(this.audioManager.getSFXVolume() * 100) - 10);
                        this.audioManager.setSFXVolume(currentVol / 100);
                        console.log(`Громкость уменьшена до ${currentVol}%`);
                    }
                },
                {
                    text: 'Переключить mute',
                    closeDialog: false,
                    callback: () => {
                        this.audioManager.toggleSFXMute();
                        console.log('Переключено состояние mute');
                    }
                },
                {
                    text: 'Готово',
                    closeDialog: true,
                    callback: () => {
                        console.log('Настройка громкости завершена');
                    }
                }
            ]
        );

        const updateDialog = () => {
            if (dialog && typeof dialog.setContentText === 'function') {
                dialog.setContentText(buildVolumeMessage());
            }
        };

        // Слушаем registry напрямую (единственный источник: settings.audio.*), меньше ручных on/off
        bindRegistryKeys(this, dialog, ['settings.audio.sfxVolume', 'settings.audio.sfxMuted'], updateDialog);
    }
    
    // ==========================================
    //  Методы тестирования ScoreManager
    // ==========================================
    
    testScoreManager() {
        console.log('💰 Тест ScoreManager...');

        // Внимание: здесь не меняем очки/уровень автоматически; тестируйте кнопками в окне

        const buildScoreMessage = () => {
            const stats = {
                'Текущие очки': this.scoreManager.getCurrentScore(),
                'Рекорд': this.scoreManager.getHighScore(),
                'Уровень': this.scoreManager.getLevel(),
                'Комбо': this.scoreManager.getCombo(),
                'Множитель комбо': this.scoreManager.getComboMultiplier()
            };

            let message = 'Статистика очков:\n\n';
            Object.entries(stats).forEach(([key, value]) => {
                message += `${key}: ${value}\n`;
            });
            return message;
        };

        const dialog = createDialog(
            this,
            '💰 Результат теста очков',
            buildScoreMessage(),
            [
                {
                    text: '+100',
                    closeDialog: false,
                    callback: () => {
                        this.scoreManager.addScore(100);
                    }
                },
                {
                    text: 'Повысить уровень',
                    closeDialog: false,
                    callback: () => {
                        this.scoreManager.levelUp();
                    }
                },
                {
                    text: 'Сбросить',
                    closeDialog: false,
                    callback: () => {
                        this.scoreManager.resetScore();
                        console.log('Очки сброшены');
                    }
                },
                {
                    text: 'Готово',
                    closeDialog: true,
                    callback: () => {}
                }
            ]
        );

        const updateDialog = () => {
            if (dialog && typeof dialog.setContentText === 'function') {
                dialog.setContentText(buildScoreMessage());
            }
        };

        // Слушаем registry напрямую (ScoreManager синхронизирует score.*), меньше ручных on/off
        bindRegistryKeys(this, dialog, ['score.current', 'score.high', 'score.level', 'score.combo', 'score.maxCombo'], updateDialog);
    }
    
    testAchievements() {
        console.log('🏆 Тест системы достижений...');
        
        // Разблокируем несколько тестовых достижений
        this.scoreManager.unlockAchievement('test_1', 'Тест достижения 1');
        this.scoreManager.unlockAchievement('test_2', 'Тест достижения 2');
        this.scoreManager.unlockAchievement('test_3', 'Тест достижения 3');
        
        const stats = this.scoreManager.getStatistics();
        
        createDialog(
            this,
            '🏆 Тест системы достижений',
            `Разблокированные достижения:\n\n${stats.achievements.join('\n') || 'Достижений пока нет'}\n\nВсего игр: ${stats.totalGamesPlayed}\nВсего очков: ${stats.totalScore}`,
            [{ text: 'OK', callback: () => {} }]
        );
    }
    
    // ==========================================
    //  Методы тестирования SettingsManager
    // ==========================================
    
    testSettingsManager() {
        console.log('⚙️ Тест SettingsManager...');
        
        const updateDialogContent = (dialog) => {
            const currentSettings = {
                'Громкость музыки': this.settingsManager.get('audio.musicVolume'),
                'Громкость эффектов': this.settingsManager.get('audio.sfxVolume'),
                'Сложность': this.settingsManager.get('game.difficulty'),
                'Язык': this.settingsManager.get('game.language'),
                'Качество графики': this.settingsManager.get('display.quality')
            };
            
            let message = 'Текущие настройки:\n\n';
            Object.entries(currentSettings).forEach(([key, value]) => {
                message += `${key}: ${value}\n`;
            });
            message += '\nНажмите кнопку для изменения настроек';
            
            if (dialog && typeof dialog.setContentText === 'function') {
                dialog.setContentText(message);
            } else if (dialog && dialog.getElement('content')) {
                dialog.getElement('content').setText(message);
                dialog.layout();
            }
        };
        
        const dialog = createDialog(
            this,
            '⚙️ Менеджер настроек',
            '', // начальное содержимое задаётся через updateDialogContent
            [
                {
                    text: 'Изменить сложность',
                    closeDialog: false, // не закрывать диалог
                    callback: (dialogInstance) => {
                        const difficulties = ['easy', 'normal', 'hard'];
                        const current = this.settingsManager.get('game.difficulty');
                        const currentIndex = difficulties.indexOf(current);
                        const next = difficulties[(currentIndex + 1) % difficulties.length];
                        this.settingsManager.setDifficulty(next);
                        console.log(`Сложность изменена: ${next}`);
                    }
                },
                {
                    text: 'Изменить качество',
                    closeDialog: false, // не закрывать диалог
                    callback: (dialogInstance) => {
                        const qualities = ['low', 'medium', 'high'];
                        const current = this.settingsManager.get('display.quality');
                        const currentIndex = qualities.indexOf(current);
                        const next = qualities[(currentIndex + 1) % qualities.length];
                        this.settingsManager.setQuality(next);
                        console.log(`Качество изменено: ${next}`);
                    }
                },
                {
                    text: 'Сбросить по умолчанию',
                    closeDialog: false, // не закрывать диалог
                    callback: (dialogInstance) => {
                        this.settingsManager.resetToDefault();
                        console.log('Настройки сброшены к значениям по умолчанию');
                    }
                },
                {
                    text: 'Готово',
                    closeDialog: true, // закрыть диалог
                    callback: () => {
                        console.log('Настройка завершена');
                    }
                }
            ]
        );
        
        // Инициализация содержимого диалога
        updateDialogContent(dialog);

        // Слушаем registry напрямую (SettingsManager синхронизирует settings.*), меньше ручных обновлений
        bindRegistryKeys(this, dialog, [
            'settings.game.difficulty',
            'settings.game.language',
            'settings.display.quality',
            'settings.audio.musicVolume',
            'settings.audio.sfxVolume',
            'settings.audio.musicMuted',
            'settings.audio.sfxMuted'
        ], () => updateDialogContent(dialog));
    }
    
    // ==========================================
    //  Методы тестирования SaveManager
    // ==========================================
    
    testSaveManager() {
        console.log('💾 Тест SaveManager...');
        
        // Создание тестовых данных сохранения
        const testGameState = {
            score: this.scoreManager.getCurrentScore(),
            level: this.scoreManager.getLevel(),
            timestamp: Date.now(),
            testData: 'This is a test save'
        };
        
        // Получение информации обо всех сохранениях
        const saveInfo = this.saveManager.getAllSaveInfo();
        
        let message = 'Состояние слотов сохранения:\n\n';
        saveInfo.forEach((info, index) => {
            if (info) {
                message += `Слот ${index}: ${info.saveName}\n`;
                message += `  Время: ${info.date}\n\n`;
            } else {
                message += `Слот ${index}: [пусто]\n\n`;
            }
        });
        
        const storageInfo = this.saveManager.getStorageInfo();
        message += `\nИспользовано: ${storageInfo.usedKB}KB / ${storageInfo.totalMB}MB`;
        
        createDialog(
            this,
            '💾 Тест менеджера сохранений',
            message,
            [
                {
                    text: 'Сохранить в слот 0',
                    callback: () => {
                        this.saveManager.saveGame(0, testGameState, 'Тестовое сохранение');
                        console.log('Сохранено в слот 0');
                    }
                },
                {
                    text: 'Загрузить слот 0',
                    callback: () => {
                        const loaded = this.saveManager.loadGame(0);
                        if (loaded) {
                            console.log('Загрузка успешна:', loaded);
                            createDialog(
                                this,
                                'Загрузка успешна',
                                `Очки: ${loaded.score}\nУровень: ${loaded.level}\nДанные: ${loaded.testData}`,
                                [{ text: 'OK', callback: () => {} }]
                            );
                        }
                    }
                },
                {
                    text: 'Удалить слот 0',
                    callback: () => {
                        this.saveManager.deleteSave(0);
                        console.log('Слот 0 удалён');
                    }
                }
            ]
        );
    }
    
    // ==========================================
    //  Сброс всех данных
    // ==========================================
    
    resetAllData() {
        console.log('🔄 Сброс всех данных...');
        
        createDialog(
            this,
            '⚠️ Внимание',
            'Сбросить все данные?\n\nЭто удалит:\n• Все очки и достижения\n• Все настройки\n• Все сохранения\n\nДействие необратимо!',
            [
                {
                    text: 'Сбросить',
                    callback: () => {
                        this.scoreManager.resetAllData();
                        this.settingsManager.resetToDefault();
                        this.saveManager.clearAllSaves();
                        console.log('✅ Все данные сброшены!');
                        
                        createDialog(
                            this,
                            '✅ Сброс завершён',
                            'Все данные удалены!',
                            [{ text: 'OK', callback: () => {} }]
                        );
                    }
                },
                {
                    text: 'Отмена',
                    callback: () => {
                        console.log('Сброс отменён');
                    }
                }
            ]
        );
    }

    update() {
        // Безопасная прокрутка фона
        if (this.background && typeof this.background.tilePositionX !== 'undefined') {
            this.background.tilePositionX += 2;
        }
    }
    
}

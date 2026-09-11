// Главное меню игры — кнопки на чистом Phaser (без RexUI)
import { RUS } from '../config/RusTheme.js';
import AudioManager from '../systems/AudioManager.js';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('Title');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);

        // Фоновая музыка главного меню
        this.audioManager.playSceneMusic('menu');

        // Декор: парящие золотые точки
        for (let i = 0; i < 40; i++) {
            const d = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 3),
                0xc9a14a,
                Phaser.Math.FloatBetween(0.2, 0.6)
            );
            this.tweens.add({
                targets: d,
                y: d.y - 30,
                alpha: 0,
                duration: Phaser.Math.Between(2500, 5000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000),
            });
        }

        this.add.text(width / 2, 110, 'ЛЕТОПИСИ РУСИ', {
            fontFamily: 'Georgia, serif', fontSize: '66px', color: '#E8DCC4',
            fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);
        this.add.text(width / 2, 178, 'XV век · Поход за утраченной иконой', {
            fontSize: '22px', color: '#A89878',
        }).setOrigin(0.5);

        // Кнопки — без "Продолжить" (одноразовая игра)
        const by = 270;
        this.makeButton(width / 2, by, 'Новая игра', 0x8B2C1A, 0xB53925, () => this.scene.start('CharacterSelection'));
        this.makeButton(width / 2, by + 68, 'Персонаж', 0x4a3520, 0x5a4530, () => this.scene.start('Character', { from: 'Title' }));
        this.makeButton(width / 2, by + 136, '❓ Помощь', 0x2e4a6a, 0x3a5a8a, () => this.showHelp());
        this.makeButton(width / 2, by + 204, '⚙ Настройки', 0x2a4a2a, 0x3a5a3a, () => this.showSettings());
        this.makeButton(width / 2, by + 272, 'О игре', 0x2e4a6a, 0x3a5a8a, () => this.about());
        
        // П.26: ESC — переключение в главное меню и обратно
        this.input.keyboard.on('keydown-ESC', () => {
            // Если уже в Title — ничего не делаем (уже в главном меню)
        });
        // П.25: F1 — окно помощи
        this.input.keyboard.on('keydown-F1', () => {
            this.showHelp();
        });
    }

    makeButton(x, y, label, bgColor, hoverColor, callback) {
        const w = 280, h = 56;
        const bg = this.add.rectangle(x, y, w, h, bgColor, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#E8DCC4',
            stroke: '#000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setFillStyle(hoverColor, 1);
            bg.setScale(1.05);
            text.setScale(1.05);
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(bgColor, 1);
            bg.setScale(1);
            text.setScale(1);
        });
        bg.on('pointerdown', () => {
            bg.setScale(0.95);
            text.setScale(0.95);
        });
        bg.on('pointerup', () => {
            bg.setScale(1.05);
            text.setScale(1.05);
            callback();
        });

        return { bg, text };
    }

    showSimpleDialog(title, message) {
        const { width, height } = this.scale;
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive();

        const panelW = 500, panelH = 250;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(2, 0xC9A961);

        const titleText = this.add.text(width / 2, height / 2 - 80, title, {
            fontFamily: 'Georgia, serif', fontSize: '24px', color: '#C9A961',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const msgText = this.add.text(width / 2, height / 2, message, {
            fontFamily: 'Arial', fontSize: '16px', color: '#E8DCC4',
            align: 'center', wordWrap: { width: 440 },
        }).setOrigin(0.5);

        const btnW = 140, btnH = 40;
        const btnBg = this.add.rectangle(width / 2, height / 2 + 85, btnW, btnH, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true });
        const btnText = this.add.text(width / 2, height / 2 + 85, 'ОК', {
            fontFamily: 'Georgia, serif', fontSize: '18px', color: '#E8DCC4',
        }).setOrigin(0.5);

        const closeDialog = () => {
            overlay.destroy();
            panel.destroy();
            titleText.destroy();
            msgText.destroy();
            btnBg.destroy();
            btnText.destroy();
        };

        btnBg.on('pointerover', () => btnBg.setFillStyle(0xB53925, 1));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x8B2C1A, 1));
        btnBg.on('pointerup', closeDialog);
        overlay.on('pointerup', closeDialog);
    }

    about() {
        this.showSimpleDialog('О игре',
            '«Летописи Руси» — браузерная RPG в сеттинге Руси XV века.\n' +
            'Ролевая система: BRP (Basic Roleplaying Universal Game Engine SRD) — ' +
            'характеристики 3d6×5, проверки d100, критический успех 1/20 навыка, ' +
            'особый успех 1/5 навыка, бонус урона по таблице STR+SIZ.\n' +
            'Деньги: рубли, гривны, куны, деньги (Русь XV в.).\n' +
            'Управление: WASD/стрелки — движение, E — действие.\n' +
            'Игра одноразовая — сохранения не поддерживаются.');
    }

    // П.14: Полное окно помощи
    showHelp() {
        const { width, height } = this.scale;
        // Очищаем старый диалог если есть
        this.children.list.filter(c => c.depth === 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 700, panelH = 600;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 20, '❓ Помощь', {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        const helpText = [
            '🎯 ЦЕЛЬ ИГРЫ:',
            'Ты — беженец в незнакомой деревне. Прижись, найди работу,',
            'завоюй доверие жителей. Достигни репутации +100 или женись.',
            '',
            '🎮 УПРАВЛЕНИЕ:',
            '  WASD / стрелки — движение (все 4 направления)',
            '  E / пробел — взаимодействие (войти в здание, говорить)',
            '  ЛКМ на здании — подойти и войти',
            '  ЛКМ на NPC — подойти и начать разговор',
            '  ПКМ на NPC — показать репутацию и состояние',
            '  F1 — окно помощи',
            '  ESC — главное меню',
            '',
            '⚠ ПРОИГРЫШ:',
            '  • Смерть героя в бою',
            '  • Репутация в деревне ≤ −80 → изгнание',
            '  • Вор украдённой иконы сбежал (лимит времени)',
            '',
            '🏆 ВЫИГРЫШ:',
            '  • Репутация в деревне +100 → принят как свой',
            '  • Брак с жителем (репутация +90 у NPC, +50 в деревне, 200 д.)',
            '',
            '⭐ РЕПУТАЦИЯ:',
            '  Повышение: задания, подарки, похвала, выпивка всем.',
            '  Понижение: попрошайничество, угрозы, ночное беспокойство.',
            '  ≤ −30: NPC не говорит. ≤ −50: не торгует. ≤ −80: может напасть.',
        ].join('\n');

        this.add.text(width / 2 - panelW / 2 + 20, height / 2 - panelH / 2 + 60, helpText, {
            fontSize: '13px', color: '#E8DCC4',
            fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 1,
            lineSpacing: 3,
            wordWrap: { width: panelW - 40 },
        }).setOrigin(0, 0).setDepth(202);

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 30, 140, 35, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 30, 'Закрыть', {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeHelp = () => {
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeHelp);
        overlay.on('pointerup', closeHelp);
        this.input.keyboard.once('keydown-ESC', closeHelp);
        this.input.keyboard.once('keydown-F1', closeHelp);
    }

    // П.15: Настройки
    showSettings() {
        const { width, height } = this.scale;
        this.children.list.filter(c => c.depth === 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 500, panelH = 350;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 25, '⚙ Настройки', {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        // Читаем текущие настройки
        const settings = this.registry.get('gameSettings') || {
            soundEnabled: true,
            musicEnabled: true,
            stepsEnabled: true,
        };

        let y = height / 2 - 60;

        // 1. Все звуки
        this.makeToggleButton(width / 2, y, '🔊 Все звуки: ' + (settings.soundEnabled ? 'ВКЛ' : 'ВЫКЛ'), () => {
            settings.soundEnabled = !settings.soundEnabled;
            this.registry.set('gameSettings', settings);
            this.showSettings(); // перерисовать
        });
        y += 50;

        // 2. Музыка
        this.makeToggleButton(width / 2, y, '🎵 Музыка: ' + (settings.musicEnabled ? 'ВКЛ' : 'ВЫКЛ'), () => {
            settings.musicEnabled = !settings.musicEnabled;
            this.registry.set('gameSettings', settings);
            if (!settings.musicEnabled && this.audioManager) {
                this.audioManager.stopMusic('menu');
            } else if (settings.musicEnabled && this.audioManager) {
                this.audioManager.playSceneMusic('menu');
            }
            this.showSettings();
        });
        y += 50;

        // 3. Звуки шагов
        this.makeToggleButton(width / 2, y, '👣 Звуки шагов: ' + (settings.stepsEnabled ? 'ВКЛ' : 'ВЫКЛ'), () => {
            settings.stepsEnabled = !settings.stepsEnabled;
            this.registry.set('gameSettings', settings);
            this.showSettings();
        });

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 30, 140, 35, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 30, 'Закрыть', {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeSettings = () => {
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeSettings);
        overlay.on('pointerup', closeSettings);
    }

    makeToggleButton(x, y, label, callback) {
        const bg = this.add.rectangle(x, y, 300, 36, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setDepth(202);
        const text = this.add.text(x, y, label, {
            fontSize: '14px', color: '#E8DCC4',
            fontFamily: 'Georgia, serif',
        }).setOrigin(0.5).setDepth(203);
        bg.on('pointerup', () => {
            callback();
        });
        bg.on('pointerover', () => bg.setFillStyle(0x5a4530, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x4a3520, 0.95));
    }
}

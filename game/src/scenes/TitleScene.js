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
        const by = 300;
        this.makeButton(width / 2, by, 'Новая игра', 0x8B2C1A, 0xB53925, () => this.scene.start('CharacterSelection'));
        this.makeButton(width / 2, by + 78, 'Персонаж', 0x4a3520, 0x5a4530, () => this.scene.start('Character', { from: 'Title' }));
        this.makeButton(width / 2, by + 156, 'О игре', 0x2e4a6a, 0x3a5a8a, () => this.about());
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
}

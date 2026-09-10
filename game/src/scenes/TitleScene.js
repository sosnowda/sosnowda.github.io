// Главное меню игры.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { createButton, createDialog } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { createCharacter } from '../systems/Character.js';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('Title');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);

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
            fontFamily: 'Georgia, serif', fontSize: '66px', color: RUS.text,
            fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);
        this.add.text(width / 2, 178, 'XV век · Поход за утраченной иконой', {
            fontSize: '22px', color: RUS.textDim,
        }).setOrigin(0.5);

        const by = 300;
        createButton(this, width / 2, by, 'Новая игра', () => this.newGame(), {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 22, padding: { left: 34, right: 34, top: 16, bottom: 16 },
        });
        createButton(this, width / 2, by + 78, 'Продолжить', () => this.continueGame(), {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 20, padding: { left: 34, right: 34, top: 14, bottom: 14 },
        });
        createButton(this, width / 2, by + 156, 'Персонаж', () => this.scene.start('Character', { from: 'Title' }), {
            backgroundColor: RUS.panelLight, hoverColor: 0x5a4030, textColor: RUS.text,
            fontSize: 20, padding: { left: 34, right: 34, top: 14, bottom: 14 },
        });
        createButton(this, width / 2, by + 234, 'О игре', () => this.about(), {
            backgroundColor: 0x2e4a6a, hoverColor: 0x3a5a8a, textColor: RUS.text,
            fontSize: 20, padding: { left: 34, right: 34, top: 14, bottom: 14 },
        });
    }

    newGame() {
        const p = createCharacter('Путник');
        const q = {
            elderTalked: false, merchantTalked: false, soldierTalked: false,
            banditDefeated: false, hasHerb: false,
        };
        this.registry.set('player', p);
        this.registry.set('quest', q);
        this.saveManager.saveGame(0, { player: p, quest: q }, 'Поход');
        this.scene.start('Village');
    }

    continueGame() {
        const data = this.saveManager.loadGame(0);
        if (data && data.player) {
            this.registry.set('player', data.player);
            this.registry.set('quest', data.quest || {});
            this.scene.start('Village');
        } else {
            createDialog(this, 'Сохранение', 'Нет доступных сохранений. Начните новую игру.', [{ text: 'ОК' }]);
        }
    }

    about() {
        createDialog(this, 'О игре',
            '«Летописи Руси» — браузерная RPG в сеттинге Руси XV века.\n\n' +
            'Основа боевой и ролевой системы — BRP (Basic Roleplaying): характеристики 3d6×5, ' +
            'проверки навыков броском d100, урон с учётом бонуса силы.\n\n' +
            'Управление: WASD/стрелки — движение, E — действие рядом с персонажем.',
            [{ text: 'Закрыть' }]);
    }
}

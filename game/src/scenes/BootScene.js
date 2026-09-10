// Сцена загрузки: генерирует все текстуры процедурно (без внешних файлов)
// и создаёт персонажа/квест при первом запуске.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { createCharacter } from '../systems/Character.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.generateTextures();

        // Создаём персонажа и квест, если их ещё нет в реестре
        if (!this.registry.get('player')) {
            this.registry.set('player', createCharacter('Путник'));
        }
        if (!this.registry.get('quest')) {
            this.registry.set('quest', {
                elderTalked: false,
                merchantTalked: false,
                soldierTalked: false,
                banditDefeated: false,
                hasHerb: false,
            });
        }

        this.scene.start('Title');
    }

    generateTextures() {
        const ts = 48;
        this.makeTile('tile_grass', RUS.grass, RUS.grassDark);
        this.makeTile('tile_path', RUS.path, 0x9c7e44);
        this.makeTile('tile_water', RUS.water, 0x2c546e);
        this.makeTile('tile_forest', RUS.forest, 0x1c3a1f);
        this.makeTile('tile_rock', RUS.rock, 0x554d42);
        this.makeTile('tile_house', RUS.house, 0x5e3820);

        this.makeFigure('player', 0x2f5d8a, 32, 44);
        this.makeFigure('npc_elder', 0xdddddd, 32, 44);
        this.makeFigure('npc_merchant', 0xd4a017, 32, 44);
        this.makeFigure('npc_soldier', 0x9c2b2b, 32, 44);
        this.makeFigure('npc_bandit', 0x333333, 32, 44);
        this.makeFigure('enemy_bandit', 0x444444, 56, 64);
        this.makeFigure('enemy_wolf', 0x6b6b6b, 56, 64);

        // Частица для эффектов
        const pg = this.make.graphics({ add: false });
        pg.fillStyle(0xffffff, 1);
        pg.fillRect(0, 0, 8, 8);
        pg.generateTexture('particle', 8, 8);
        pg.destroy();
    }

    makeTile(key, color, shade) {
        const g = this.make.graphics({ add: false });
        g.fillStyle(color, 1);
        g.fillRect(0, 0, 48, 48);
        g.fillStyle(shade, 1);
        for (let i = 0; i < 6; i++) {
            const x = Phaser.Math.Between(2, 44);
            const y = Phaser.Math.Between(2, 44);
            const s = Phaser.Math.Between(3, 8);
            g.fillRect(x, y, s, s);
        }
        g.generateTexture(key, 48, 48);
        g.destroy();
    }

    makeFigure(key, color, w, h) {
        const g = this.make.graphics({ add: false });
        const cx = w / 2;
        // тело
        g.fillStyle(color, 1);
        g.fillRoundedRect(cx - 10, h * 0.35, 20, h * 0.45, 6);
        // голова
        g.fillStyle(0xf0d2a8, 1);
        g.fillCircle(cx, h * 0.22, 9);
        // пояс
        g.fillStyle(0x2a1c10, 1);
        g.fillRect(cx - 10, h * 0.6, 20, 4);
        g.generateTexture(key, w, h);
        g.destroy();
    }
}

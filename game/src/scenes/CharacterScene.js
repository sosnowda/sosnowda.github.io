// Экран персонажа: характеристики и навыки по BRP.
import Phaser from 'phaser';
import { RUS } from '../config/RusTheme.js';
import { createButton } from '../utils/ui.js';
import { CHARACTER_KEYS, SKILLS } from '../systems/Character.js';

export class CharacterScene extends Phaser.Scene {
    constructor() {
        super('Character');
    }

    init(data) {
        this.from = (data && data.from) || 'Title';
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        const p = this.registry.get('player');

        this.add.text(width / 2, 40, 'Свиток персонажа', {
            fontFamily: 'Georgia, serif', fontSize: '34px', color: RUS.text, fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(width / 2, 82, p.name, { fontSize: '22px', color: RUS.textDim }).setOrigin(0.5);

        const charLines = CHARACTER_KEYS.map(c => `${c.name}: ${p[c.key]}`);
        charLines.push('—');
        charLines.push(`Здоровье: ${p.HP}/${p.HPmax}`);
        charLines.push(`Воля (MP): ${p.MP}/${p.MPmax}`);
        charLines.push(`Бонус урона: ${p.DB.text}`);

        const skillLines = SKILLS.map(s => `${s.name}: ${p.skills[s.key]}%`);

        const colX = width / 2 - 360;
        const colX2 = width / 2 + 40;
        const top = 140;

        this.add.text(colX, top, 'Характеристики (BRP)', { fontSize: '20px', color: RUS.border }).setOrigin(0, 0.5);
        this.add.text(colX, top + 30, charLines.join('\n'), {
            fontSize: '18px', color: RUS.text, lineSpacing: 6,
        }).setOrigin(0, 0);

        this.add.text(colX2, top, 'Навыки', { fontSize: '20px', color: RUS.border }).setOrigin(0, 0.5);
        this.add.text(colX2, top + 30, skillLines.join('\n'), {
            fontSize: '18px', color: RUS.text, lineSpacing: 6,
        }).setOrigin(0, 0);

        createButton(this, width / 2, height - 60, 'Назад', () => this.scene.start(this.from), {
            backgroundColor: RUS.panelLight, hoverColor: 0x5a4030, textColor: RUS.text,
            fontSize: 20, padding: { left: 34, right: 34, top: 14, bottom: 14 },
        });
    }
}

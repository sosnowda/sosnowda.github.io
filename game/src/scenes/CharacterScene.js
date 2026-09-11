// Экран персонажа: характеристики и навыки по BRP + инвентарь.
// Phaser загружен глобально через CDN
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
        const q = this.registry.get('quest') || {};

        // Заголовок
        this.add.text(width / 2, 40, 'Свиток персонажа', {
            fontFamily: 'Georgia, serif', fontSize: '34px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);
        this.add.text(width / 2, 82, p.name, {
            fontSize: '22px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        // ----- Характеристики и навыки (две колонки) -----
        const charLines = CHARACTER_KEYS.map(c => `${c.name}: ${p[c.key]}`);
        charLines.push('—');
        charLines.push(`Здоровье: ${p.HP}/${p.HPmax}`);
        charLines.push(`Воля (MP): ${p.MP}/${p.MPmax}`);
        charLines.push(`Бонус урона: ${p.DB.text}`);

        const skillLines = SKILLS.map(s => `${s.name}: ${p.skills[s.key]}%`);

        const colX = width / 2 - 360;
        const colX2 = width / 2 + 40;
        const top = 140;

        this.add.text(colX, top, 'Характеристики (BRP)', {
            fontSize: '20px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        this.add.text(colX, top + 30, charLines.join('\n'), {
            fontSize: '18px', color: RUS.text, lineSpacing: 6,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0);

        this.add.text(colX2, top, 'Навыки', {
            fontSize: '20px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        this.add.text(colX2, top + 30, skillLines.join('\n'), {
            fontSize: '18px', color: RUS.text, lineSpacing: 6,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0);

        // ----- Инвентарь (сетка 4×2) -----
        const invTopY = top + 30 + Math.max(charLines.length, skillLines.length) * 26 + 30;
        this.add.text(width / 2, invTopY, 'Сумка', {
            fontSize: '22px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        // 8 ячеек инвентаря
        const invStartX = width / 2 - 4 * 36;
        const invY = invTopY + 50;
        for (let i = 0; i < 8; i++) {
            const ix = invStartX + (i % 4) * 72;
            const iy = invY + Math.floor(i / 4) * 72;
            // Фон ячейки
            this.add.rectangle(ix, iy, 64, 64, 0x2a1f15, 0.8)
                .setStrokeStyle(2, RUS.border, 1);
        }

        // Заполняем ячейки имеющимися предметами
        const items = [];
        // Трава
        if (q.hasHerb) items.push({ icon: 'icon_herb', name: 'Целебная трава' });
        // Золото (пока всегда 0, но покажем иконку)
        items.push({ icon: 'icon_gold', name: `Золото: ${q.gold || 0}` });
        // Если есть икона (победил разбойника)
        if (q.banditDefeated) items.push({ icon: 'icon_icon', name: 'Чудотворная икона' });
        // Стартовый меч
        items.push({ icon: 'icon_sword', name: 'Меч путника' });
        // Лук
        items.push({ icon: 'icon_bow', name: 'Лук' });

        items.forEach((item, i) => {
            if (i >= 8) return;
            const ix = invStartX + (i % 4) * 72;
            const iy = invY + Math.floor(i / 4) * 72;
            if (this.textures.exists(item.icon)) {
                this.add.image(ix, iy, item.icon).setDisplaySize(48, 48);
            }
            // Подсказка при наведении
            const hitArea = this.add.zone(ix, iy, 64, 64).setInteractive({ useHandCursor: true });
            const tooltip = this.add.text(ix, iy - 40, item.name, {
                fontSize: '14px', color: RUS.text, backgroundColor: '#000000dd',
                padding: { x: 6, y: 4 },
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setVisible(false).setDepth(50);
            hitArea.on('pointerover', () => tooltip.setVisible(true));
            hitArea.on('pointerout', () => tooltip.setVisible(false));
        });

        // ----- Кнопка "Назад" -----
        createButton(this, width / 2, height - 60, 'Назад', () => this.scene.start(this.from), {
            backgroundColor: RUS.panelLight, hoverColor: 0x5a4030, textColor: RUS.text,
            fontSize: 20, padding: { left: 34, right: 34, top: 14, bottom: 14 },
        });
    }
}

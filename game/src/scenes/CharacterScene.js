// Экран персонажа: характеристики, навыки и инвентарь с экипировкой.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { createButton } from '../utils/ui.js';
import {
    CHARACTER_KEYS, SKILLS, SKILL_CATEGORIES,
    ARMORS, WEAPONS,
    equipWeapon, equipArmor,
    formatMoney,
} from '../systems/Character.js';

export class CharacterScene extends Phaser.Scene {
    constructor() {
        super('Character');
    }

    init(data) {
        this.from = (data && data.from) || 'Title';
        this.activeTab = (data && data.tab) || 'stats';
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        const p = this.registry.get('player');
        const q = this.registry.get('quest') || {};

        // Заголовок
        this.add.text(width / 2, 30, '📜 Свиток персонажа', {
            fontFamily: 'Georgia, serif', fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);

        // Имя и архетип
        this.add.text(width / 2, 65, `${p.name} — ${p.archetype} (${p.gender === 'female' ? '♀' : '♂'})`, {
            fontSize: '18px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        // Кнопки вкладок: [Характеристики] [Инвентарь]
        const tabY = 100;
        createButton(this, width / 2 - 100, tabY, 'Характеристики', () => {
            this.activeTab = 'stats';
            this.scene.restart({ from: this.from, tab: 'stats' });
        }, {
            backgroundColor: this.activeTab === 'stats' ? RUS.accent : 0x4a3520,
            hoverColor: this.activeTab === 'stats' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 16,
            padding: { left: 20, right: 20, top: 8, bottom: 8 },
        });
        createButton(this, width / 2 + 100, tabY, 'Инвентарь', () => {
            this.activeTab = 'inventory';
            this.scene.restart({ from: this.from, tab: 'inventory' });
        }, {
            backgroundColor: this.activeTab === 'inventory' ? RUS.accent : 0x4a3520,
            hoverColor: this.activeTab === 'inventory' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 16,
            padding: { left: 20, right: 20, top: 8, bottom: 8 },
        });

        if (this.activeTab === 'stats') {
            this.drawStatsTab(p, q);
        } else {
            this.drawInventoryTab(p, q);
        }

        // Кнопка "Назад"
        createButton(this, width / 2, height - 40, '◀ Назад', () => {
            if (this.scene.isPaused(this.from)) {
                this.scene.stop();
                this.scene.resume(this.from);
            } else {
                this.scene.start(this.from);
            }
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 18, padding: { left: 34, right: 34, top: 10, bottom: 10 },
        });
    }

    /**
     * Вкладка характеристик.
     */
    drawStatsTab(p, q) {
        const { width } = this.scale;
        // Характеристики (2 колонки)
        const charLines = CHARACTER_KEYS.slice(0, 4).map(c => `${c.name}: ${p[c.key]}`);
        const charLines2 = CHARACTER_KEYS.slice(4).map(c => `${c.name}: ${p[c.key]}`);
        // Добавляем производные
        charLines.push('—');
        charLines.push(`HP: ${p.HP}/${p.HPmax}`);
        charLines.push(`MP: ${p.MP}/${p.MPmax}`);
        charLines.push(`Бонус урона: ${p.DB.text}`);

        const colX = width / 2 - 360;
        const colX2 = width / 2 + 40;
        const top = 160;

        this.add.text(colX, top, 'Характеристики (BRP)', {
            fontSize: '18px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        this.add.text(colX, top + 30, charLines.join('\n'), {
            fontSize: '15px', color: RUS.text, lineSpacing: 4,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0);

        // Навыки по категориям
        this.add.text(colX2, top, 'Навыки', {
            fontSize: '18px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);

        let skillY = top + 30;
        Object.entries(SKILL_CATEGORIES).forEach(([catKey, cat]) => {
            const catSkills = SKILLS.filter(s => s.category === catKey);
            if (catSkills.length === 0) return;
            this.add.text(colX2, skillY, cat.name + ':', {
                fontSize: '13px', color: cat.color, fontStyle: 'bold',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0);
            skillY += 18;
            catSkills.forEach(s => {
                const val = p.skills[s.key] || 0;
                this.add.text(colX2 + 10, skillY, `${s.name}: ${val}%`, {
                    fontSize: '13px', color: RUS.text,
                    stroke: '#000', strokeThickness: 1,
                }).setOrigin(0, 0);
                skillY += 16;
            });
            skillY += 6;
        });

        // Снаряжение
        this.add.text(colX, top + 130, 'Снаряжение:', {
            fontSize: '16px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        const weapon = WEAPONS[p.weaponId] || { name: 'Кулаки' };
        const armor = ARMORS[p.armorId] || { name: 'Без доспеха' };
        this.add.text(colX, top + 155, `⚔ Оружие: ${weapon.name} (урон ${weapon.dice.min}-${weapon.dice.max}+${weapon.bonus || 0})`, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5);
        this.add.text(colX, top + 175, `🛡 Доспех: ${armor.name} (защита ${armor.def})`, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5);

        // Деньги
        this.add.text(colX, top + 205, `💰 Денег: ${formatMoney(p.dengas || 0)}`, {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
    }

    /**
     * Вкладка инвентаря с экипировкой.
     */
    drawInventoryTab(p, q) {
        const { width, height } = this.scale;
        const top = 150;

        // Текущее снаряжение
        this.add.text(width / 2, top, 'Снаряжение', {
            fontSize: '20px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const currentWeapon = WEAPONS[p.weaponId] || { name: 'Кулаки' };
        const currentArmor = ARMORS[p.armorId] || { name: 'Без доспеха' };
        this.add.text(width / 2, top + 30, `⚔ Оружие: ${currentWeapon.name}   🛡 Доспех: ${currentArmor.name}`, {
            fontSize: '15px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // Оружие для экипировки (список)
        this.add.text(width / 4, top + 70, 'Оружие (экипировать):', {
            fontSize: '16px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        let wY = top + 100;
        Object.values(WEAPONS).forEach((w) => {
            const isEquipped = p.weaponId === w.id;
            const hasInInv = (p.inventory || []).some(i => i.id === w.id) || w.id === 'fists';
            if (!hasInInv) return;
            const btnColor = isEquipped ? 0x3a5a3a : 0x4a3520;
            const hoverColor = isEquipped ? 0x4a6a4a : 0x5a4530;
            createButton(this, width / 4, wY, `${isEquipped ? '✓ ' : ''}${w.name} (${w.dice.min}-${w.dice.max}+${w.bonus || 0})`, () => {
                if (!isEquipped) {
                    equipWeapon(p, w.id);
                    this.scene.restart({ from: this.from, tab: 'inventory' });
                }
            }, {
                backgroundColor: btnColor, hoverColor, textColor: RUS.text,
                fontSize: 13, padding: { left: 14, right: 14, top: 6, bottom: 6 },
            });
            wY += 36;
        });

        // Доспехи для экипировки
        this.add.text(width * 3 / 4, top + 70, 'Доспехи (экипировать):', {
            fontSize: '16px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        let aY = top + 100;
        Object.values(ARMORS).forEach((a) => {
            const isEquipped = p.armorId === a.id;
            const hasInInv = (p.inventory || []).some(i => i.id === a.id) || a.id === 'none';
            if (!hasInInv) return;
            const btnColor = isEquipped ? 0x3a5a3a : 0x4a3520;
            const hoverColor = isEquipped ? 0x4a6a4a : 0x5a4530;
            createButton(this, width * 3 / 4, aY, `${isEquipped ? '✓ ' : ''}${a.name} (защита ${a.def})`, () => {
                if (!isEquipped) {
                    equipArmor(p, a.id);
                    this.scene.restart({ from: this.from, tab: 'inventory' });
                }
            }, {
                backgroundColor: btnColor, hoverColor, textColor: RUS.text,
                fontSize: 13, padding: { left: 14, right: 14, top: 6, bottom: 6 },
            });
            aY += 36;
        });

        // Предметы (травы, зелья и т.п.)
        this.add.text(width / 2, top + 320, 'Предметы:', {
            fontSize: '16px', color: RUS.border, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const items = p.inventory || [];
        if (items.length === 0) {
            this.add.text(width / 2, top + 350, 'Сумка пуста', {
                fontSize: '14px', color: RUS.textDim,
            }).setOrigin(0.5);
        } else {
            let iX = width / 2 - (items.length * 80) / 2;
            items.forEach((item, i) => {
                const ix = iX + i * 80 + 40;
                const iy = top + 380;
                // Фон ячейки
                this.add.rectangle(ix, iy, 64, 64, 0x2a1f15, 0.8)
                    .setStrokeStyle(2, RUS.border, 1);
                // Иконка
                if (this.textures.exists(`icon_${item.id}`)) {
                    this.add.image(ix, iy, `icon_${item.id}`).setDisplaySize(48, 48);
                }
                // Количество
                if (item.count > 1) {
                    this.add.text(ix + 20, iy + 20, `×${item.count}`, {
                        fontSize: '12px', color: '#fff',
                        stroke: '#000', strokeThickness: 2,
                    }).setOrigin(1, 1);
                }
                // Подсказка
                const hitArea = this.add.zone(ix, iy, 64, 64).setInteractive({ useHandCursor: true });
                const tooltip = this.add.text(ix, iy - 40, item.name, {
                    fontSize: '12px', color: RUS.text, backgroundColor: '#000000dd',
                    padding: { x: 6, y: 4 },
                    stroke: '#000', strokeThickness: 1,
                }).setOrigin(0.5).setVisible(false).setDepth(50);
                hitArea.on('pointerover', () => tooltip.setVisible(true));
                hitArea.on('pointerout', () => tooltip.setVisible(false));
            });
        }

        // Деньги
        this.add.text(width / 2, top + 470, `💰 Денег: ${formatMoney(p.dengas || 0)}`, {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
    }
}

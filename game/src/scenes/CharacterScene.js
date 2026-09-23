// Экран персонажа: характеристики, навыки и инвентарь с экипировкой.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
// Раунд 42 (QA-фикс): t() использовался (строки «В руках»/«Надето»/«НАДЕТО»),
// но i18n НЕ импортировался → вкладка «Инвентарь» падала с TypeError:
// «Предметы»-сетка и кнопка «Назад» не рисовались, игрок застревал на экране.
import { t, tf } from '../systems/i18n.js';
import { ageUnitWord } from '../systems/AgeRules.js';
import {
    CHARACTER_KEYS, SKILLS, SKILL_CATEGORIES,
    ARMORS, WEAPONS,
    equipWeapon, equipArmor,
    formatMoney,
} from '../systems/Character.js';
// Раунд 66.17 (п.4): кнопка «Съесть» для съестных припасов узла —
// единые правила еды (1 час, кулдаун 4 часа, «герой сытый»)
import { getLootDef, tryEatFood } from '../systems/loot.js';
import { createDialog } from '../utils/ui.js';

export class CharacterScene extends Phaser.Scene {
    constructor() {
        super('Character');
    }

    init(data) {
        this.from = (data && data.from) || 'Title';
        this.activeTab = (data && data.tab) || 'stats';
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        const p = this.registry.get('player');
        const q = this.registry.get('quest') || {};

        // Заголовок
        this.add.text(width / 2, 30, t('📜 Свиток персонажа'), {
            fontFamily: 'Georgia, serif', fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);

        // Имя и архетип (+ возраст — раунд 44; + облик-прессет — раунд 62)
        // Патч 66.3: имя героя и имя облика — собственные, в EN транслитерацией (t())
        this.add.text(width / 2, 65, `${t(p.name)} — ${t(p.archetype)}` +
            (p.presetName ? ` · ${t('Облик')} «${t(p.presetName)}»` : '') +
            ` (${p.gender === 'female' ? '♀' : '♂'}${p.age != null ? `, ${p.age} ${ageUnitWord(p.age)}` : ''})`, {
            fontSize: '18px', color: RUS.textDim,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        // Кнопки вкладок: [Характеристики] [Инвентарь]
        const tabY = 100;
        createButton(this, width / 2 - 100, tabY, t('Характеристики'), () => {
            this.activeTab = 'stats';
            this.scene.restart({ from: this.from, tab: 'stats' });
        }, {
            backgroundColor: this.activeTab === 'stats' ? RUS.accent : 0x4a3520,
            hoverColor: this.activeTab === 'stats' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 16,
            padding: { left: 20, right: 20, top: 8, bottom: 8 },
        });
        createButton(this, width / 2 + 100, tabY, t('Инвентарь'), () => {
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
        createButton(this, width / 2, height - 40, t('◀ Назад'), () => {
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
        const { width, height } = this.scale;
        // П.13: показываем только текущего персонажа
        if (!p) {
            this.add.text(width / 2, 200, t('Персонаж не выбран.\nНачните новую игру.'), {
                fontSize: '20px', color: RUS.text, align: 'center',
            }).setOrigin(0.5);
            return;
        }

        // Характеристики (2 колонки)
        // Патч 66.2: названия характеристик через t() (EN-лист героя)
        const charLines = CHARACTER_KEYS.slice(0, 4).map(c => `${t(c.name)}: ${p[c.key]}`);
        const charLines2 = CHARACTER_KEYS.slice(4).map(c => `${t(c.name)}: ${p[c.key]}`);
        charLines.push('—');
        charLines.push(`HP: ${p.HP}/${p.HPmax}`);
        charLines.push(`MP: ${p.MP}/${p.MPmax}`);
        charLines.push(`${t('Бонус урона:')} ${p.DB.text}`);

        const colX = width / 2 - 360;
        const colX2 = width / 2 + 40;
        const top = 160;

        // П.12: жёлтые заголовки вместо чёрных
        this.add.text(colX, top, t('Характеристики (BRP)'), {
            fontSize: '18px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        this.add.text(colX, top + 30, charLines.join('\n'), {
            fontSize: '15px', color: RUS.text, lineSpacing: 4,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0);

        // Навыки по категориям
        this.add.text(colX2, top, t('Навыки'), {
            fontSize: '18px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);

        let skillY = top + 30;
        // МИНИ-ФИКС 66.3 (пре-существующий): на низких канвасах (<590px)
        // последняя строка навыков подлезала под кнопку «◀ Назад» (фиксные
        // шаги 18/16/6 рассчитаны на высоту ≥590). Сжимаем межстрочные
        // интервалы правой колонки пропорционально доступной высоте; на
        // высоких канвасах k=1 — раскладка пиксельно прежняя.
        const backTop = height - 62;                       // верх зоны кнопки «Назад»
        const availH = backTop - (top + 30);
        let natH = 0;
        Object.entries(SKILL_CATEGORIES).forEach(([catKey]) => {
            const n = SKILLS.filter(s => s.category === catKey).length;
            if (n) natH += 18 + n * 16 + 6;
        });
        const kFit = availH > 0 ? Math.min(1, availH / natH) : 1;
        const catStep = Math.max(13, 18 * kFit);   // шаг заголовка категории
        const lineStep = Math.max(10.5, 16 * kFit); // шаг строки навыка
        const gapStep = Math.max(2, 6 * kFit);      // пауза после категории
        const skillFont = kFit < 0.8 ? '12px' : '13px';
        Object.entries(SKILL_CATEGORIES).forEach(([catKey, cat]) => {
            const catSkills = SKILLS.filter(s => s.category === catKey);
            if (catSkills.length === 0) return;
            this.add.text(colX2, skillY, t(cat.name) + ':', {
                fontSize: skillFont, color: cat.color, fontStyle: 'bold',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0);
            skillY += catStep;
            catSkills.forEach(s => {
                const val = p.skills[s.key] || 0;
                this.add.text(colX2 + 10, skillY, `${t(s.name)}: ${val}%`, {
                    fontSize: skillFont, color: RUS.text,
                    stroke: '#000', strokeThickness: 1,
                }).setOrigin(0, 0);
                skillY += lineStep;
            });
            skillY += gapStep;
        });

        // П.11: снаряжение — исправлен текст, не налезает
        // (раунд 16: блок характеристик занимает 7 строк × ~22px ≈ 154px от top+30
        // и заканчивается на ~top+184 — снаряжение опущено ниже, было top+140 → наложение)
        this.add.text(colX, top + 200, t('Снаряжение:'), {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        const weapon = WEAPONS[p.weaponId] || { name: 'Кулаки' };
        const armor = ARMORS[p.armorId] || { name: 'Без доспеха' };
        this.add.text(colX, top + 224, `${t('⚔ Оружие:')} ${t(weapon.name)} (${t('урон')} ${weapon.dice.min}-${weapon.dice.max}+${weapon.bonus || 0})`, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5);
        this.add.text(colX, top + 246, `${t('🛡 Доспех:')} ${t(armor.name)} (${t('защита')} ${armor.def})`, {
            fontSize: '14px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5);

        // Деньги
        this.add.text(colX, top + 276, `${t('💰 Денег:')} ${formatMoney(p.dengas || 0)}`, {
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
        this.add.text(width / 2, top, t('Снаряжение'), {
            fontSize: '20px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const currentWeapon = WEAPONS[p.weaponId] || { name: 'Кулаки' };
        const currentArmor = ARMORS[p.armorId] || { name: 'Без доспеха' };
        this.add.text(width / 2, top + 30, `${t('⚔ Оружие:')} ${t(currentWeapon.name)}   ${t('🛡 Доспех:')} ${t(currentArmor.name)}`, {
            fontSize: '15px', color: RUS.text,
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);

        // Оружие для экипировки (список)
        this.add.text(width / 4, top + 70, t('Оружие (экипировать):'), {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        let wY = top + 100;
        Object.values(WEAPONS).forEach((w) => {
            const isEquipped = p.weaponId === w.id;
            const hasInInv = (p.inventory || []).some(i => i.id === w.id) || w.id === 'fists';
            if (!hasInInv) return;
            const btnColor = isEquipped ? 0x3a5a3a : 0x4a3520;
            const hoverColor = isEquipped ? 0x4a6a4a : 0x5a4530;
            createButton(this, width / 4, wY, `${isEquipped ? '✓ ' : ''}${t(w.name)} (${w.dice.min}-${w.dice.max}+${w.bonus || 0})`, () => {
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
        this.add.text(width * 3 / 4, top + 70, t('Доспехи (экипировать):'), {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        let aY = top + 100;
        Object.values(ARMORS).forEach((a) => {
            const isEquipped = p.armorId === a.id;
            const hasInInv = (p.inventory || []).some(i => i.id === a.id) || a.id === 'none';
            if (!hasInInv) return;
            const btnColor = isEquipped ? 0x3a5a3a : 0x4a3520;
            const hoverColor = isEquipped ? 0x4a6a4a : 0x5a4530;
            createButton(this, width * 3 / 4, aY, `${isEquipped ? '✓ ' : ''}${t(a.name)} (${t('защита')} ${a.def})`, () => {
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

        // Предметы (травы, зелья и т.п.) — раунд 39: блок поднят выше,
        // чтобы сетка и плашки «НАДЕТО» не задевали кнопку «Назад» внизу
        this.add.text(width / 2, top + 285, t('Предметы:'), {
            fontSize: '16px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        // Раунд 39 (п.14 заявки): НАДЕТЫЕ предметы (броня и оружие) теперь
        // отображаются ПЕРВЫМИ СЛОТАМИ окна «Предметы» — раньше в ячейках
        // был только содержимое сумки, экипировка не показывалась.
        const equipped = [];
        const wIcon = ['icon_' + currentWeapon.id, 'icon_sword', 'icon_weapon']
            .find(k => this.textures.exists(k));
        const aIcon = ['icon_' + currentArmor.id, 'icon_armor']
            .find(k => this.textures.exists(k));
        equipped.push({
            id: 'equipped_weapon',
            name: `${t('В руках')}: ${t(currentWeapon.name)}`,
            iconKey: wIcon || null,
            emoji: '⚔',
            count: 1,
            equipped: true,
        });
        equipped.push({
            id: 'equipped_armor',
            name: `${t('Надето')}: ${t(currentArmor.name)}`,
            iconKey: aIcon || null,
            emoji: '🛡',
            count: 1,
            equipped: true,
        });

        const items = equipped.concat(p.inventory || []);
        if (items.length === 0) {
            this.add.text(width / 2, top + 320, t('Сумка пуста'), {
                fontSize: '14px', color: RUS.textDim,
            }).setOrigin(0.5);
        } else {
            const cols = Math.min(items.length, 6);
            const rows = Math.ceil(items.length / cols);
            const gridW = cols * 80;
            const startX = width / 2 - gridW / 2 + 40;
            const startY = top + 330;
            items.forEach((item, i) => {
                const ix = startX + (i % cols) * 80;
                const iy = startY + Math.floor(i / cols) * 78;
                // Фон ячейки
                this.add.rectangle(ix, iy, 64, 64, 0x2a1f15, 0.8)
                    .setStrokeStyle(2, item.equipped ? RUS.accent : RUS.border, 1);
                // Иконка / эмодзи-заглушка
                if (item.iconKey) {
                    this.add.image(ix, iy, item.iconKey).setDisplaySize(48, 48);
                } else {
                    this.add.text(ix, iy, item.emoji || '📦', { fontSize: '26px' })
                        .setOrigin(0.5);
                }
                // Количество
                if (item.count > 1) {
                    this.add.text(ix + 20, iy + 20, `×${item.count}`, {
                        fontSize: '12px', color: '#fff',
                        stroke: '#000', strokeThickness: 2,
                    }).setOrigin(1, 1);
                }
                // Плашка «НАДЕТО» на экипировке
                if (item.equipped) {
                    this.add.text(ix, iy - 24, t('НАДЕТО'), {
                        fontSize: '8px', color: '#ffd700',
                        backgroundColor: '#000000dd', padding: { x: 3, y: 1 },
                        stroke: '#000', strokeThickness: 1,
                    }).setOrigin(0.5).setDepth(51);
                }
                // Подсказка
                const hitArea = this.add.zone(ix, iy, 64, 64).setInteractive({ useHandCursor: true });
                const tooltip = this.add.text(ix, iy - 40, t(item.name), {
                    fontSize: '12px', color: RUS.text, backgroundColor: '#000000dd',
                    padding: { x: 6, y: 4 },
                    stroke: '#000', strokeThickness: 1,
                }).setOrigin(0.5).setVisible(false).setDepth(52);
                hitArea.on('pointerover', () => tooltip.setVisible(true));
                hitArea.on('pointerout', () => tooltip.setVisible(false));
                // РАУНД 66.17 (п.4): съестное/добыча — клик открывает карточку
                // с кнопкой «Съесть» (печёная рыба +2, жаркое +3, рацион +1);
                // сырое мясо/сырая рыба — карточка-подсказка (готовить/продавать).
                const foodDef = getLootDef(item.id);
                if (foodDef && !item.equipped) {
                    this.add.text(ix + 20, iy - 20, '🍽', { fontSize: '12px' })
                        .setOrigin(0.5).setDepth(51);
                    hitArea.on('pointerup', () => this.showFoodCard(item, foodDef));
                }
            });
        }

        // Деньги — под строкой снаряжения (раунд 39: не пересекается с сеткой предметов)
        this.add.text(width / 2, top + 58, `${t('💰 Денег:')} ${formatMoney(p.dengas || 0)}`, {
            fontSize: '15px', color: '#c9a14a', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
    }

    /**
     * Раунд 66.17 (п.4): карточка съестного предмета узла.
     * Съедобное — кнопка «Съесть» (правила meal.js: 1 час, кулдаун 4 ч,
     * поп-ап «герой сытый»); сырое — подсказка «готовить на костре/продать».
     */
    showFoodCard(item, def) {
        const p = this.registry.get('player');
        const count = (item && item.count) || 0;
        if (count <= 0) return;
        if (def.edible) {
            createDialog(this, `${def.emoji} ${t(def.name)}`,
                tf(t('{0} ×{1} в узле. Съесть порцию: +{2} здоровья, час времени, кулдаун следующего приёма еды — 4 часа.'), t(def.name), count, def.heal),
                [
                    { text: t('🍽 Съесть'), callback: () => {
                        const res = tryEatFood(this, p, item.id);
                        if (res.ok) {
                            this.scene.restart({ from: this.from, tab: 'inventory' });
                        }
                    } },
                    { text: t('Отмена'), callback: () => {} },
                ], { singleton: false });
        } else {
            createDialog(this, `${def.emoji} ${t(def.name)}`,
                t('Сырым это не едят: приготовь на костре (лесное кострище или костёр пастухов — 30 мин) или продай трактирщику/мяснику.'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
        }
    }
}

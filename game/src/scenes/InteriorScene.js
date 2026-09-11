// Сцена интерьера здания (таверна, кузница, дома жителей, дом старосты, церковь).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { createButton, createDialog } from '../utils/ui.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd, askMoneyForHelp, askElderAdvance } from '../data/thief.js';
import { ARMORS, WEAPONS, formatMoney, equipWeapon, equipArmor } from '../systems/Character.js';
import { generateQuest, acceptQuest, getActiveQuests, grantQuestRewards, checkQuestCompletion } from '../data/questGenerator.js';

export class InteriorScene extends Phaser.Scene {
    constructor() {
        super('Interior');
    }

    init(data) {
        this.interiorId = data?.interiorId || 'elder_house';
        this.from = data?.from || 'Village';
    }

    create() {
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);
        this.audioManager.playSceneMusic('village'); // ambient деревни

        const interior = INTERIORS[this.interiorId];
        if (!interior) {
            console.error('Interior not found:', this.interiorId);
            this.scene.start(this.from);
            return;
        }
        this.interior = interior;

        // ----- Фон интерьера — запасной цвет (если текстуры не загрузились) -----
        this.cameras.main.setBackgroundColor(RUS.panel);

        // ----- Заголовок интерьера -----
        this.add.text(width / 2, 20, interior.name, {
            fontSize: '24px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(50);

        // ----- Описание интерьера -----
        this.add.text(20, 60, interior.description, {
            fontSize: '14px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0).setDepth(50);

        // ----- NPC в интерьере -----
        this.npcSprite = this.add.sprite(width * 0.65, height * 0.55, interior.npcSprite, 0).setScale(2.5);
        this.npcSprite.play(`${interior.npcSprite}_idle_down`);
        // Лёгкое дыхание
        this.tweens.add({
            targets: this.npcSprite,
            scaleX: { from: 2.5, to: 2.55 },
            scaleY: { from: 2.5, to: 2.45 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Имя NPC
        this.add.text(this.npcSprite.x, this.npcSprite.y + 80, interior.npcName, {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);

        // ----- Игрок (слева от NPC) -----
        this.player = this.registry.get('player');
        this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, 'player', 0).setScale(2.5);
        this.playerSprite.play('player_idle_right');
        this.tweens.add({
            targets: this.playerSprite,
            y: { from: height * 0.55, to: height * 0.55 - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ----- Декорации в зависимости от типа интерьера -----
        this.addDecorations(interior);

        // ----- HUD -----
        this.hud = this.add.text(16, height - 60, '', {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);
        this.updateHUD();

        // ----- Кнопка "Поговорить" -----
        createButton(this, width / 2 - 200, height - 50, 'Поговорить', () => {
            ActionLog.add(this.registry, `Поговорил с ${interior.npcName} в «${interior.name}».`);
            this.activeNpc = {
                id: interior.npcId,
                name: interior.npcName,
                portrait: interior.portrait,
            };
            this.busyDialog = true;
            this.dialogue.run(interior.dialogueId, () => {
                this.busyDialog = false;
                const end = checkGameEnd(this.registry);
                if (end) this.scene.start('End');
            });
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 16, padding: { left: 18, right: 18, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // ----- Кнопка "Попросить денег" (одноразовая, п.16) -----
        createButton(this, width / 2 - 60, height - 50, 'Просить денег', () => {
            this.askMoneyFromNpc(interior);
        }, {
            backgroundColor: 0x6a5a2a, hoverColor: 0x7a6a3a, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // ----- Кнопка "Взять задание" (процедурный генератор, п.5-8) -----
        createButton(this, width / 2 + 80, height - 50, '📜 Задание', () => {
            this.offerQuest(interior);
        }, {
            backgroundColor: 0x2a4a6a, hoverColor: 0x3a5a7a, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // ----- Кнопка "Торговля" (только для таверны и кузницы) -----
        if (interior.id === 'tavern') {
            createButton(this, width / 2 + 220, height - 50, 'Купить еды', () => {
                this.showTavernShop();
            }, {
                backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
                cornerRadius: 8,
            });
        } else if (interior.id === 'blacksmith') {
            createButton(this, width / 2 + 220, height - 50, 'Купить оружие', () => {
                this.showBlacksmithShop('weapon');
            }, {
                backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
                cornerRadius: 8,
            });
        }

        // ----- Кнопка "Выйти" -----
        createButton(this, width / 2 + 360, height - 50, 'Выйти', () => {
            this.scene.start(this.from);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        this.busyDialog = false;
    }

    /**
     * Попросить денег у NPC (п.16) — одноразовое действие.
     */
    askMoneyFromNpc(interior) {
        const result = askMoneyForHelp(this.registry, interior.npcId, interior.npcName);
        createDialog(this, 'Просьба о деньгах', result.message, [
            { text: 'Понятно', callback: () => {} },
        ], {
            singleton: false,
            portraitKey: interior.portrait,
            typing: true,
            typingSpeed: 30,
        });
        this.updateHUD();
        // Проверка конца игры
        if (result.thiefEscaped) {
            this.time.delayedCall(2000, () => this.scene.start('End'));
        }
    }

    /**
     * Предложить задание от NPC (п.5-8: процедурный генератор).
     */
    offerQuest(interior) {
        // Проверяем, есть ли уже активные задания от этого NPC
        const activeQuests = getActiveQuests(this.registry);
        const hasActiveFromThisNpc = activeQuests.some(q => q.npcId === interior.npcId);
        
        if (hasActiveFromThisNpc) {
            createDialog(this, 'Задание', 
                `${interior.npcName}: «Ты ещё не выполнил моё прошлое поручение. Сперва закончи его!»`, 
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: interior.portrait, typing: true, typingSpeed: 30 }
            );
            return;
        }

        // Генерируем задание
        const quest = generateQuest(interior.npcId, this.registry);
        if (!quest) {
            createDialog(this, 'Задание',
                `${interior.npcName}: «Нет у меня сейчас для тебя дел. Зайди попозже.»`,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: interior.portrait, typing: true, typingSpeed: 30 }
            );
            return;
        }

        // Формируем описание наград
        const rewardTexts = quest.rewards.map(r => {
            if (r.type === 'money') return formatMoney(r.amount);
            if (r.type === 'item') return `${r.name} ×${r.count}`;
            if (r.type === 'lodging') return r.name;
            if (r.type === 'blessing') return r.name;
            return r.name || 'что-то';
        });

        const questText = `${quest.description}\n\n` +
            `Цель: ${quest.objective}\n` +
            `Время на выполнение: ${quest.timeLimit} ходов\n` +
            `Сложность: ${quest.difficulty === 'hard' ? 'тяжёлая' : (quest.difficulty === 'medium' ? 'средняя' : 'лёгкая')}\n` +
            `Награда: ${rewardTexts.join(', ')}`;

        // Показываем задание с кнопками "Принять" и "Отказаться"
        createDialog(this, `📜 ${quest.title}`, questText, [
            {
                text: '✓ Принять',
                callback: () => {
                    acceptQuest(this.registry, quest);
                    createDialog(this, 'Задание принято',
                        `${interior.npcName}: «Благодарю, путник! Не подведи. Возвращайся, как выполнишь.»`,
                        [{ text: 'Понятно', callback: () => {} }],
                        { singleton: false, portraitKey: interior.portrait, typing: true, typingSpeed: 30 }
                    );
                },
            },
            {
                text: '✗ Отказаться',
                callback: () => {
                    ActionLog.add(this.registry, `Отказался от задания: ${quest.title}.`);
                },
            },
        ], {
            singleton: false,
            portraitKey: interior.portrait,
            typing: true,
            typingSpeed: 25,
        });
    }

    /**
     * Меню торговли в таверне — покупка еды и питья (п.14).
     */
    showTavernShop() {
        const player = this.registry.get('player');
        const items = [
            { id: 'bread', name: 'Хлеб', price: 2, effect: '+2 HP', heal: 2, mpHeal: 0 },
            { id: 'kasha', name: 'Каша', price: 5, effect: '+3 HP', heal: 3, mpHeal: 0 },
            { id: 'mead', name: 'Медовуха', price: 4, effect: '+2 MP', heal: 0, mpHeal: 2 },
            { id: 'kvass', name: 'Квас', price: 3, effect: '+1 MP', heal: 0, mpHeal: 1 },
            { id: 'rest', name: 'Ночлег', price: 15, effect: 'Полное восстановление', heal: 999, mpHeal: 999 },
        ];

        const { width, height } = this.scale;
        // Подложка
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 500, panelH = 420;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, 'Таверна «У дороги» — меню', {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 65,
            `Денег: ${formatMoney(player.dengas || 0)}`, {
            fontSize: '16px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Список товаров
        const startY = height / 2 - panelH / 2 + 110;
        items.forEach((item, i) => {
            const y = startY + i * 42;
            const canAfford = (player.dengas || 0) >= item.price;
            createButton(this, width / 2, y, `${item.name} — ${item.price} д. (${item.effect})`, () => {
                if (!canAfford) {
                    createDialog(this, 'Таверна', 'Не хватает денег!', [
                        { text: 'Понятно', callback: () => {} },
                    ], { singleton: false, portraitKey: 'portrait_merchant' });
                    return;
                }
                player.dengas -= item.price;
                player.HP = Math.min(player.HPmax, player.HP + item.heal);
                player.MP = Math.min(player.MPmax, player.MP + item.mpHeal);
                this.registry.set('player', player);
                ActionLog.add(this.registry, `Купил «${item.name}» в таверне за ${item.price} д. (${item.effect}).`);
                this.updateHUD();
                // Закрыть меню и открыть заново с обновлённым балансом
                overlay.destroy();
                panel.destroy();
                this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
                this.showTavernShop();
            }, {
                backgroundColor: canAfford ? 0x3a5a3a : 0x3a3a3a,
                hoverColor: canAfford ? 0x4a6a4a : 0x4a4a4a,
                textColor: canAfford ? RUS.text : '#888',
                fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setDepth(202);
        });

        // Кнопка закрытия
        createButton(this, width / 2, height / 2 + panelH / 2 - 30, 'Закрыть', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    /**
     * Меню торговли у кузнеца — покупка оружия и доспехов (п.15).
     */
    showBlacksmithShop(tab = 'weapon') {
        const player = this.registry.get('player');
        const { width, height } = this.scale;

        // Подложка
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 600, panelH = 480;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, 'Кузница Данилы', {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 65,
            `Денег: ${formatMoney(player.dengas || 0)}`, {
            fontSize: '16px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Переключатель вкладок
        createButton(this, width / 2 - 100, height / 2 - panelH / 2 + 100, 'Оружие', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
            this.showBlacksmithShop('weapon');
        }, {
            backgroundColor: tab === 'weapon' ? RUS.accent : 0x4a3520,
            hoverColor: tab === 'weapon' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 16, right: 16, top: 6, bottom: 6 },
        }).setDepth(202);

        createButton(this, width / 2 + 100, height / 2 - panelH / 2 + 100, 'Доспехи', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
            this.showBlacksmithShop('armor');
        }, {
            backgroundColor: tab === 'armor' ? RUS.accent : 0x4a3520,
            hoverColor: tab === 'armor' ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 16, right: 16, top: 6, bottom: 6 },
        }).setDepth(202);

        // Список товаров
        const startY = height / 2 - panelH / 2 + 150;
        const items = tab === 'weapon'
            ? Object.values(WEAPONS).filter(w => w.id !== 'fists')
            : Object.values(ARMORS).filter(a => a.id !== 'none');

        items.forEach((item, i) => {
            const y = startY + i * 42;
            const price = item.price || 0;
            const canAfford = (player.dengas || 0) >= price;
            const desc = tab === 'weapon'
                ? `${item.name} — ${price} д. (урон ${item.dice.min}-${item.dice.max}+${item.bonus || 0})`
                : `${item.name} — ${price} д. (защита ${item.def})`;
            createButton(this, width / 2, y, desc, () => {
                if (!canAfford) {
                    createDialog(this, 'Кузница', 'Не хватает денег!', [
                        { text: 'Понятно', callback: () => {} },
                    ], { singleton: false, portraitKey: 'portrait_soldier' });
                    return;
                }
                player.dengas -= price;
                if (tab === 'weapon') {
                    equipWeapon(player, item.id);
                    if (!player.inventory) player.inventory = [];
                    if (!player.inventory.find(it => it.id === item.id)) {
                        player.inventory.push({ id: item.id, name: item.name, count: 1, type: 'weapon' });
                    }
                } else {
                    equipArmor(player, item.id);
                    if (!player.inventory) player.inventory = [];
                    if (!player.inventory.find(it => it.id === item.id)) {
                        player.inventory.push({ id: item.id, name: item.name, count: 1, type: 'armor' });
                    }
                }
                this.registry.set('player', player);
                ActionLog.add(this.registry, `Купил «${item.name}» у кузнеца за ${price} д.`);
                this.updateHUD();
                overlay.destroy();
                panel.destroy();
                this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
                this.showBlacksmithShop(tab);
            }, {
                backgroundColor: canAfford ? 0x3a5a3a : 0x3a3a3a,
                hoverColor: canAfford ? 0x4a6a4a : 0x4a4a4a,
                textColor: canAfford ? RUS.text : '#888',
                fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
            }).setDepth(202);
        });

        // Кнопка закрытия
        createButton(this, width / 2, height / 2 + panelH / 2 - 30, 'Закрыть', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    /**
     * Добавить декорации в зависимости от типа интерьера.
     */
    addDecorations(interior) {
        const { width, height } = this.scale;
        const decor = interior.decor || [];
        const ts = 32;

        // Текстура деревянного пола по всей нижней части
        if (this.textures.exists('int_floor_0')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 100; y < height; y += ts) {
                    const v = ((x + y) / ts) % 2;
                    this.add.image(x + ts / 2, y + ts / 2, `int_floor_${v}`).setOrigin(0.5).setDepth(0);
                }
            }
        }
        // Стены (верхняя часть)
        if (this.textures.exists('int_wall')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 0; y < 100; y += ts) {
                    this.add.image(x + ts / 2, y + ts / 2, 'int_wall').setOrigin(0.5).setDepth(0);
                }
            }
        }
        // Окно
        if (this.textures.exists('int_window')) {
            this.add.image(width - 140, 50, 'int_window').setScale(2).setDepth(0);
        }

        if (interior.id === 'tavern') {
            // Барная стойка
            if (this.textures.exists('int_deco_bar')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_bar').setScale(1.5).setDepth(5);
            }
            // Бочки
            if (this.textures.exists('int_deco_barrel')) {
                this.add.image(width * 0.85, height * 0.4, 'int_deco_barrel').setScale(1.5).setDepth(5);
                this.add.image(width * 0.92, height * 0.4, 'int_deco_barrel').setScale(1.5).setDepth(5);
            }
            // Камин с анимированным огнём
            if (this.textures.exists('int_deco_fireplace')) {
                this.add.image(80, height * 0.45, 'int_deco_fireplace').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_fire_0')) {
                const fire = this.add.image(80, height * 0.5, 'int_fire_0').setScale(2).setDepth(6);
                let fireFrame = 0;
                this.time.addEvent({
                    delay: 100,
                    callback: () => {
                        fireFrame = (fireFrame + 1) % 4;
                        fire.setTexture(`int_fire_${fireFrame}`);
                    },
                    loop: true,
                });
            }
            // Столы и стулья
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.25, height * 0.65, 'int_deco_table').setScale(1).setDepth(5);
                this.add.image(width * 0.75, height * 0.7, 'int_deco_table').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_chair')) {
                this.add.image(width * 0.25 - 30, height * 0.65, 'int_deco_chair').setScale(1).setDepth(5);
                this.add.image(width * 0.75 + 30, height * 0.7, 'int_deco_chair').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'blacksmith') {
            // Наковальня
            if (this.textures.exists('int_deco_anvil')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_anvil').setScale(1.5).setDepth(5);
            }
            // Горн с огнём
            this.add.rectangle(width * 0.85, height * 0.4, 100, 80, 0x4a2a10)
                .setStrokeStyle(2, 0x2a1a05).setDepth(4);
            if (this.textures.exists('int_fire_0')) {
                const forge = this.add.image(width * 0.85, height * 0.42, 'int_fire_0').setScale(2.5).setDepth(5);
                let fireFrame = 0;
                this.time.addEvent({
                    delay: 80,
                    callback: () => {
                        fireFrame = (fireFrame + 1) % 4;
                        forge.setTexture(`int_fire_${fireFrame}`);
                    },
                    loop: true,
                });
            }
            // Оружие на стене
            this.add.text(width * 0.2, 80, '⚔ 🔨 🛡', {
                fontSize: '32px',
            }).setOrigin(0.5).setDepth(10);
        } else if (interior.id === 'elder_house') {
            // Стол
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_table').setScale(1.2).setDepth(5);
            }
            // Свеча на столе
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_candle').setScale(1.5).setDepth(6);
            }
            // Икона в углу
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
            }
        } else {
            // Обычный дом — кровать + стол + икона
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.4, height * 0.55, 'int_deco_table').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_bed')) {
                this.add.image(width * 0.8, height * 0.55, 'int_deco_bed').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'church') {
            // Церковь — алтарь, иконостас, свечи
            // Алтарь (большой стол)
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.5, height * 0.4, 'int_deco_table').setScale(1.5).setDepth(5);
            }
            // Иконостас — несколько икон на стене
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width * 0.25, height * 0.3, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
                this.add.image(width * 0.5, height * 0.25, 'int_deco_icon_wall').setScale(1.8).setDepth(5);
                this.add.image(width * 0.75, height * 0.3, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
            }
            // Свечи на алтаре
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.42, height * 0.35, 'int_deco_candle').setScale(1.5).setDepth(6);
                this.add.image(width * 0.58, height * 0.35, 'int_deco_candle').setScale(1.5).setDepth(6);
            }
            // Крест над алтарём
            this.add.text(width * 0.5, height * 0.15, '✝', {
                fontSize: '48px', color: '#c9a14a',
            }).setOrigin(0.5).setDepth(10);
        }
    }

    updateHUD() {
        const p = this.player;
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}  ✦ Воля ${p.MP}/${p.MPmax}  💰 ${formatMoney(p.dengas || 0)}`);
    }
}

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
import { getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { findNpc, meetNpc, getNpcDisplayName, getNpcShortName, getNpcs } from '../data/npcNames.js';
import {
    checkNpcWillingToTalk, getNpcRep, getReputationLevel,
    applyGiftBonus, applyCompliment, applyTreatEveryoneBonus,
    applyQuestCompleteBonus, willNpcAttack, willNpcRefuseTrade,
    getPriceModifier, getRewardModifier,
} from '../data/reputation.js';
import { getNpcSchedule, getNpcActivity } from '../data/npcSchedules.js';

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

        // Получаем NPC из registry (со случайным именем, п.5,6)
        this.npcData = findNpc(this.registry, interior.npcId);
        // Отображаемое имя: до знакомства — «старик священник», после — «Отец Савватий (священник)»
        const displayName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;

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
        const npcSpriteKey = (this.npcData && this.npcData.sprite) || interior.npcSprite;
        this.npcSprite = this.add.sprite(width * 0.65, height * 0.55, npcSpriteKey, 0).setScale(2.5);
        this.npcSprite.play(`${npcSpriteKey}_idle_down`);
        // Лёгкое дыхание
        this.tweens.add({
            targets: this.npcSprite,
            scaleX: { from: 2.5, to: 2.55 },
            scaleY: { from: 2.5, to: 2.45 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Имя NPC — динамическое (п.2-5)
        this.npcNameText = this.add.text(this.npcSprite.x, this.npcSprite.y + 80, displayName, {
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

        // ----- Overlay дня/ночи (п.5) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- HUD -----
        this.hud = this.add.text(16, height - 60, '', {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);

        // Дата и время сверху (п.13)
        if (timeState) {
            this.add.text(width / 2, 55, `📅 ${formatDateTime(timeState)}`, {
                fontSize: '11px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0).setDepth(100);
        }

        this.updateHUD();

        // ----- Кнопка "Поговорить" -----
        createButton(this, width / 2 - 200, height - 50, 'Поговорить', () => {
            // Проверка готовности NPC говорить (п.2,3,4,5)
            const timeState = getTime(this.registry);
            const hour = timeState ? timeState.hour : 12;
            const npcBusy = false; // В интерьере NPC всегда доступен, занятость проверяется по расписанию
            const talkCheck = checkNpcWillingToTalk(this.registry, interior.npcId, { npcBusy });
            
            // Пункт 4: При крайней вражде — NPC нападает
            if (talkCheck.willAttack) {
                createDialog(this, 'Нападение!',
                    `${getNpcDisplayName(this.registry, interior.npcId)} бросается на тебя с кулаками!`,
                    [{ text: 'Драться!', callback: () => {
                        this.scene.start('Combat', { enemyKeys: ['bandit'], npcId: interior.npcId + '_hostile' });
                    }}],
                    { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait }
                );
                return;
            }
            
            // Пункт 3: Отказ говорить при низкой репутации
            if (!talkCheck.canTalk) {
                createDialog(this, 'Отказ', talkCheck.message,
                    [{ text: 'Понятно', callback: () => {} }],
                    { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait }
                );
                return;
            }
            
            const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
            ActionLog.add(this.registry, `Поговорил с ${npcName} в «${interior.name}».`);

            // При первом разговоре — знакомство (п.5): NPC представляется
            if (this.npcData && !this.npcData.met) {
                meetNpc(this.registry, interior.npcId);
                ActionLog.add(this.registry, `Познакомился с ${this.npcData.knownDescription}.`);
                const newName = getNpcDisplayName(this.registry, interior.npcId);
                this.npcNameText.setText(newName);
            }

            this.activeNpc = {
                id: interior.npcId,
                name: this.npcData ? (this.npcData.met ? this.npcData.name : npcName) : interior.npcName,
                portrait: (this.npcData && this.npcData.portrait) || interior.portrait,
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

        // ----- Кнопка "Подарить" (п.10) -----
        createButton(this, width / 2 + 220, height - 50, '🎁 Подарить', () => {
            this.showGiftMenu(interior);
        }, {
            backgroundColor: 0x5a2a5a, hoverColor: 0x6a3a6a, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // ----- Кнопка "Похвалить" (п.11) -----
        createButton(this, width / 2 + 360, height - 50, '💬 Похвалить', () => {
            this.complimentNpc(interior);
        }, {
            backgroundColor: 0x2a5a5a, hoverColor: 0x3a6a6a, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // ----- Кнопка "Угостить всех" — только в таверне (п.9) -----
        if (interior.id === 'tavern') {
            createButton(this, width / 2 - 200, height - 90, '🍺 Угостить всех выпивкой (20 д.)', () => {
                this.treatEveryone(interior);
            }, {
                backgroundColor: 0x6a5a2a, hoverColor: 0x7a6a3a, textColor: RUS.text,
                fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
                cornerRadius: 8,
            });
        }

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
            // Пункт 8: возобновляем Village вместо полного перехода
            this.scene.stop();
            if (this.scene.isPaused(this.from)) {
                this.scene.resume(this.from);
            } else {
                this.scene.start(this.from);
            }
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
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const result = askMoneyForHelp(this.registry, interior.npcId, npcName);
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
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        // Проверяем, есть ли уже активные задания от этого NPC
        const activeQuests = getActiveQuests(this.registry);
        const hasActiveFromThisNpc = activeQuests.some(q => q.npcId === interior.npcId);
        
        if (hasActiveFromThisNpc) {
            createDialog(this, 'Задание', 
                `${npcName}: «Ты ещё не выполнил моё прошлое поручение. Сперва закончи его!»`, 
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait, typing: true, typingSpeed: 30 }
            );
            return;
        }

        // Генерируем задание
        const quest = generateQuest(interior.npcId, this.registry);
        if (!quest) {
            createDialog(this, 'Задание',
                `${npcName}: «Нет у меня сейчас для тебя дел. Зайди попозже.»`,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait, typing: true, typingSpeed: 30 }
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
                        `${npcName}: «Благодарю! Не подведи. Возвращайся, как выполнишь.»`,
                        [{ text: 'Понятно', callback: () => {} }],
                        { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait, typing: true, typingSpeed: 30 }
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
            portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
            typing: true,
            typingSpeed: 25,
        });
    }

    // === Пункт 10: Подарить NPC вещь или деньги ===
    showGiftMenu(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const { width, height } = this.scale;
        
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 500, panelH = 400;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, `Подарить ${npcName}`, {
            fontSize: '20px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        let y = height / 2 - panelH / 2 + 80;

        // Подарить деньги (10 д.)
        createButton(this, width / 2, y, '💸 Подарить 10 денег', () => {
            if ((player.dengas || 0) < 10) {
                createDialog(this, 'Подарок', 'Не хватает денег!', [{ text: 'Понятно', callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= 10;
            this.registry.set('player', player);
            const result = applyGiftBonus(this.registry, interior.npcId, 10);
            const msg = result.success
                ? `${npcName}: «Спасибо тебе! Доброе дело сделал.» (+${result.bonus} репутации)`
                : `${npcName}: «Не нужно мне твоих подачек!» (${result.bonus} репутации)`;
            createDialog(this, 'Подарок', msg, [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait });
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
        }).setDepth(202);
        y += 40;

        // Подарить деньги (50 д.)
        createButton(this, width / 2, y, '💸 Подарить 50 денег', () => {
            if ((player.dengas || 0) < 50) {
                createDialog(this, 'Подарок', 'Не хватает денег!', [{ text: 'Понятно', callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= 50;
            this.registry.set('player', player);
            const result = applyGiftBonus(this.registry, interior.npcId, 50);
            const msg = result.success
                ? `${npcName}: «Ох, какая щедрость! Благодарю от сердца!» (+${result.bonus} репутации)`
                : `${npcName}: «Что-то ты уж слишком щедр... Чего хочешь?» (${result.bonus} репутации)`;
            createDialog(this, 'Подарок', msg, [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait });
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
        }).setDepth(202);
        y += 40;

        // Подарить целебную траву
        if (player.inventory && player.inventory.some(i => i.id === 'herb')) {
            createButton(this, width / 2, y, '🌿 Подарить целебную траву', () => {
                const herb = player.inventory.find(i => i.id === 'herb');
                if (herb) {
                    herb.count--;
                    if (herb.count <= 0) {
                        player.inventory = player.inventory.filter(i => i.id !== 'herb');
                    }
                    this.registry.set('player', player);
                    const result = applyGiftBonus(this.registry, interior.npcId, 15);
                    const msg = result.success
                        ? `${npcName}: «Ох, травка добрая! Спасибо, пригодится.» (+${result.bonus} репутации)`
                        : `${npcName}: «Не нужна мне трава.» (${result.bonus} репутации)`;
                    createDialog(this, 'Подарок', msg, [{ text: 'Понятно', callback: () => {} }],
                        { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait });
                    overlay.destroy();
                    panel.destroy();
                    this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
                }
            }, {
                backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                fontSize: 14, padding: { left: 14, right: 14, top: 8, bottom: 8 },
            }).setDepth(202);
            y += 40;
        }

        // Закрыть
        createButton(this, width / 2, height / 2 + panelH / 2 - 30, 'Закрыть', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    // === Пункт 11: Похвалить NPC ===
    complimentNpc(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const oratorySkill = player.skills.oratory || 15;
        const result = applyCompliment(this.registry, interior.npcId, oratorySkill);
        
        createDialog(this, 'Похвала', `${npcName}: ${result.message} (бросок ${result.roll}, ${result.bonus > 0 ? '+' : ''}${result.bonus} репутации)`, [
            { text: 'Понятно', callback: () => {} },
        ], {
            singleton: false,
            portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
            typing: true, typingSpeed: 30,
        });
    }

    // === Пункт 9: Угостить всех выпивкой в таверне ===
    treatEveryone(interior) {
        const player = this.registry.get('player');
        const cost = 20;
        if ((player.dengas || 0) < cost) {
            createDialog(this, 'Таверна', 'Не хватает денег на выпивку для всех!', [
                { text: 'Понятно', callback: () => {} },
            ], { singleton: false, portraitKey: interior.portrait });
            return;
        }
        player.dengas -= cost;
        this.registry.set('player', player);
        const totalBonus = applyTreatEveryoneBonus(this.registry);
        ActionLog.add(this.registry, `Угостил всех выпивкой в таверне за ${cost} д. (+${totalBonus} к репутации).`);
        createDialog(this, '🎉 Выпивка для всех',
            `Ты заказал бочку медовуги на всех! Гости радостно поднимают кубки. ` +
            `«За гостеприимного гостя!» — раздаётся по залу. ` +
            `(Репутация у всех NPC +3, в деревне +5)`, [
            { text: '🎉 За нас!', callback: () => {} },
        ], {
            singleton: false,
            portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
            typing: true, typingSpeed: 30,
        });
        this.updateHUD();
    }

    /**
     * Меню торговли в таверне — покупка еды и питья (п.14).
     */
    showTavernShop() {
        const player = this.registry.get('player');
        // Список товаров с учётом репутации (п.13.2: скидки при высокой репутации)
        const priceMod = getPriceModifier(this.registry, 'tavernkeeper');
        const items = [
            { id: 'bread', name: 'Хлеб', price: Math.max(1, Math.round(2 * priceMod)), effect: '+2 HP', heal: 2, mpHeal: 0 },
            { id: 'kasha', name: 'Каша', price: Math.max(1, Math.round(5 * priceMod)), effect: '+3 HP', heal: 3, mpHeal: 0 },
            { id: 'mead', name: 'Медовуха', price: Math.max(1, Math.round(4 * priceMod)), effect: '+2 MP', heal: 0, mpHeal: 2 },
            { id: 'kvass', name: 'Квас', price: Math.max(1, Math.round(3 * priceMod)), effect: '+1 MP', heal: 0, mpHeal: 1 },
            { id: 'rest', name: 'Ночлег', price: Math.max(1, Math.round(15 * priceMod)), effect: 'Полное восстановление', heal: 999, mpHeal: 999 },
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
            // Таверна: барная стойка, бочки, камин, столы, скамьи, сундук
            if (this.textures.exists('int_deco_bar')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_bar').setScale(1.5).setDepth(5);
            }
            if (this.textures.exists('int_deco_barrel')) {
                this.add.image(width * 0.85, height * 0.4, 'int_deco_barrel').setScale(1.5).setDepth(5);
                this.add.image(width * 0.92, height * 0.4, 'int_deco_barrel').setScale(1.5).setDepth(5);
            }
            if (this.textures.exists('int_deco_fireplace')) {
                this.add.image(80, height * 0.45, 'int_deco_fireplace').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_fire_0')) {
                const fire = this.add.image(80, height * 0.5, 'int_fire_0').setScale(2).setDepth(6);
                let fireFrame = 0;
                this.time.addEvent({
                    delay: 100,
                    callback: () => { fireFrame = (fireFrame + 1) % 4; fire.setTexture(`int_fire_${fireFrame}`); },
                    loop: true,
                });
            }
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.25, height * 0.65, 'int_deco_table').setScale(1).setDepth(5);
                this.add.image(width * 0.75, height * 0.7, 'int_deco_table').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_bench')) {
                this.add.image(width * 0.25 - 40, height * 0.65, 'int_deco_bench').setScale(1).setDepth(5);
                this.add.image(width * 0.75 + 40, height * 0.7, 'int_deco_bench').setScale(1).setDepth(5);
            }
            // Полка с горшками за стойкой
            if (this.textures.exists('int_deco_shelf')) {
                this.add.image(width * 0.5, height * 0.25, 'int_deco_shelf').setScale(1.2).setDepth(5);
            }
            // Сундук у входа
            if (this.textures.exists('int_deco_chest')) {
                this.add.image(width * 0.15, height * 0.75, 'int_deco_chest').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'blacksmith') {
            // Кузница: наковальня, горн, поленница, оружие, сундук
            if (this.textures.exists('int_deco_anvil')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_anvil').setScale(1.5).setDepth(5);
            }
            this.add.rectangle(width * 0.85, height * 0.4, 100, 80, 0x4a2a10)
                .setStrokeStyle(2, 0x2a1a05).setDepth(4);
            if (this.textures.exists('int_fire_0')) {
                const forge = this.add.image(width * 0.85, height * 0.42, 'int_fire_0').setScale(2.5).setDepth(5);
                let fireFrame = 0;
                this.time.addEvent({
                    delay: 80,
                    callback: () => { fireFrame = (fireFrame + 1) % 4; forge.setTexture(`int_fire_${fireFrame}`); },
                    loop: true,
                });
            }
            // Поленница дров у горна
            if (this.textures.exists('int_deco_firewood')) {
                this.add.image(width * 0.95, height * 0.6, 'int_deco_firewood').setScale(1.2).setDepth(5);
            }
            // Сундук с готовой продукцией
            if (this.textures.exists('int_deco_chest')) {
                this.add.image(width * 0.15, height * 0.65, 'int_deco_chest').setScale(1).setDepth(5);
            }
            this.add.text(width * 0.2, 80, '⚔ 🔨 🛡', { fontSize: '32px' }).setOrigin(0.5).setDepth(10);
        } else if (interior.id === 'elder_house') {
            // Дом старосты: стол, свеча, икона, сундук с документами, лавка
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_table').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_candle').setScale(1.5).setDepth(6);
            }
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
            }
            if (this.textures.exists('int_deco_bench')) {
                this.add.image(width * 0.2, height * 0.7, 'int_deco_bench').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_chest')) {
                this.add.image(width * 0.8, height * 0.7, 'int_deco_chest').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'church') {
            // Церковь: алтарь, иконостас, свечи, аналой, крест
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.5, height * 0.4, 'int_deco_table').setScale(1.5).setDepth(5);
            }
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width * 0.25, height * 0.3, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
                this.add.image(width * 0.5, height * 0.25, 'int_deco_icon_wall').setScale(1.8).setDepth(5);
                this.add.image(width * 0.75, height * 0.3, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
            }
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.42, height * 0.35, 'int_deco_candle').setScale(1.5).setDepth(6);
                this.add.image(width * 0.58, height * 0.35, 'int_deco_candle').setScale(1.5).setDepth(6);
            }
            // Аналой (подставка для икон/книг)
            if (this.textures.exists('int_deco_analogion')) {
                this.add.image(width * 0.5, height * 0.6, 'int_deco_analogion').setScale(1.2).setDepth(5);
            }
            this.add.text(width * 0.5, height * 0.15, '✝', {
                fontSize: '48px', color: '#c9a14a',
            }).setOrigin(0.5).setDepth(10);
        } else if (interior.id === 'villager_house_1') {
            // Дом крестьянина Авдея: стол, лавка, кровать, поленница, стог сена
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.4, height * 0.55, 'int_deco_table').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_bench')) {
                this.add.image(width * 0.4 - 50, height * 0.55, 'int_deco_bench').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_bed')) {
                this.add.image(width * 0.8, height * 0.55, 'int_deco_bed').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_firewood')) {
                this.add.image(width * 0.15, height * 0.7, 'int_deco_firewood').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_hay')) {
                this.add.image(width * 0.9, height * 0.75, 'int_deco_hay').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'villager_house_2') {
            // Дом вдовы Марфы: кровать, прялка, икона, колыбель, полка с травами
            if (this.textures.exists('int_deco_bed')) {
                this.add.image(width * 0.8, height * 0.55, 'int_deco_bed').setScale(1).setDepth(5);
            }
            // Прялка — символ женского труда
            if (this.textures.exists('int_deco_spinning')) {
                this.add.image(width * 0.3, height * 0.55, 'int_deco_spinning').setScale(1.2).setDepth(5);
            }
            // Колыбель
            if (this.textures.exists('int_deco_cradle')) {
                this.add.image(width * 0.5, height * 0.6, 'int_deco_cradle').setScale(1).setDepth(5);
            }
            // Полка с горшками (травы, снадобья)
            if (this.textures.exists('int_deco_shelf')) {
                this.add.image(width * 0.15, height * 0.5, 'int_deco_shelf').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1.2).setDepth(5);
            }
            // Свеча
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.15, height * 0.65, 'int_deco_candle').setScale(1.2).setDepth(6);
            }
        }
    }

    updateHUD() {
        const p = this.player;
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}  ✦ Воля ${p.MP}/${p.MPmax}  💰 ${formatMoney(p.dengas || 0)}`);
    }
}

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
import { getTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
import { findNpc, meetNpc, getNpcDisplayName, getNpcShortName, getNpcs } from '../data/npcNames.js';
import {
    checkNpcWillingToTalk, getNpcRep, getReputationLevel,
    applyGiftBonus, applyCompliment, applyTreatEveryoneBonus,
    applyQuestCompleteBonus, applyThreat, willNpcAttack, willNpcRefuseTrade,
    getPriceModifier, getRewardModifier,
    canMarry, marry, getMarriageCost, getMarriageNpcRepThreshold, getMarriageVillageRepThreshold,
    getVillageRep, changeVillageRep,
} from '../data/reputation.js';
import { getNpcSchedule, getNpcActivity } from '../data/npcSchedules.js';
import { STASHES, isOpenedToday, markOpened, rollLoot, lootDisplayName } from '../data/chests.js';

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

        // ----- Фон интерьера — ЯВНО коричневый, без зависимости от setBackgroundColor -----
        // П.5 (4-й раз!): рисуем непрозрачный коричневый прямоугольник на весь экран
        // ПОВЕРХ любого фона canvas, чтобы исключить любую «зелёную сетку».
        this.cameras.main.setBackgroundColor(0x2e2118);
        this.add.rectangle(0, 0, width, height, 0x2e2118, 1)
            .setOrigin(0, 0).setDepth(-10);

        // ----- Заголовок интерьера -----
        this.add.text(width / 2, 20, interior.name, {
            fontSize: '24px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(50);

        // ----- Описание интерьера -----
        // Раунд 9: перенос по ширине 42% — длинные описания не наезжают на окна
        this.add.text(20, 60, interior.description, {
            fontSize: '14px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: width * 0.42 },
        }).setOrigin(0, 0).setDepth(50);

        // ----- NPC в интерьере -----
        // Часовня и амбар — БЕЗ NPC (ограблена / работник на поле):
        // вместо него — декор-центр и особый набор действий в кнопках.
        const hasNpc = !interior.noNpc && !!interior.npcId;
        if (hasNpc) {
            const npcSpriteKey = (this.npcData && this.npcData.sprite) || interior.npcSprite;
            // П.6: Проверяем существование текстуры
            const finalSpriteKey = this.textures.exists(npcSpriteKey) ? npcSpriteKey : 'npc_elder';
            this.npcSprite = this.add.sprite(width * 0.65, height * 0.55, finalSpriteKey).setScale(2.5).setDepth(5);
            // Проверяем существование анимации
            const animKey = `${finalSpriteKey}_idle_down`;
            if (this.anims.exists(animKey)) {
                this.npcSprite.play(animKey);
            }
            // Лёгкое дыхание
            this.tweens.add({
                targets: this.npcSprite,
                scaleX: { from: 2.5, to: 2.55 },
                scaleY: { from: 2.5, to: 2.45 },
                duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            // П.7: NPC интерактивен — ЛКМ запускает разговор
            this.npcSprite.setInteractive({ useHandCursor: true });
            this.npcSprite.on('pointerdown', (pointer) => {
                // Только ЛКМ
                if (pointer.leftButtonDown() && !this.busyDialog) {
                    this.talkToNpc(interior);
                }
            });
            // Имя NPC — динамическое (п.2-5)
            this.npcNameText = this.add.text(this.npcSprite.x, this.npcSprite.y + 80, displayName, {
                fontSize: '16px', color: RUS.text,
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            // П.7: Подсказка «нажмите, чтобы поговорить»
            this.add.text(this.npcSprite.x, this.npcSprite.y - 80, '💬 Нажми, чтобы поговорить', {
                fontSize: '11px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(20);
        }

        // ----- Игрок (слева от NPC) -----
        // П.6: Используем спрайт игрока из реестра, а не жёстко 'player'.
        // П.1-2: Если игрок настроил внешность — используем композитную текстуру 'player_composite'
        // (с раздельными tint-регионами для волос/кожи/одежды).
        this.player = this.registry.get('player');
        const useComposite = this.player && this.player.useComposite && this.textures.exists('player_composite');
        const playerTextureKey = useComposite ? 'player_composite' : ((this.player && this.player.sprite) || 'player');
        const safePlayerKey = this.textures.exists(playerTextureKey) ? playerTextureKey : 'player';
        this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, safePlayerKey, 0).setScale(2.5);
        // П.4: Применяем tint одежды только если НЕ композит (композит уже имеет все цвета)
        if (!useComposite && this.player && this.player.appearance && this.player.appearance.jacket) {
            this.playerSprite.setTint(this.player.appearance.jacket.tint);
        }
        // Анимация idle_right — только если НЕ композит (у композита нет анимаций)
        if (!useComposite) {
            const idleRightKey = `${safePlayerKey}_idle_right`;
            const idleDownKey = `${safePlayerKey}_idle_down`;
            if (this.anims.exists(idleRightKey)) {
                this.playerSprite.play(idleRightKey);
            } else if (this.anims.exists(idleDownKey)) {
                this.playerSprite.play(idleDownKey);
            }
        }
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
        // Раунд 9: y = height-88 — НАД рядом кнопок (при 7 кнопках строка кнопок
        // начинается с x≈160 и перекрывала HUD на height-60)
        this.hud = this.add.text(16, height - 88, '', {
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

        // ============================================================
        // П.8: ВСЕ КНОПКИ ДЕЙСТВИЙ — В ОДНУ СТРОКУ, БЕЗ ПЕРЕКРЫТИЙ
        // ============================================================
        const btnY = height - 50;
        const btnGap = 8;

        const player = this.registry.get('player');
        const npcRepValue = getNpcRep(this.registry, interior.npcId);
        const villageRepValue = getVillageRep(this.registry);

        const buttons = [];
        if (hasNpc) {
            buttons.push({ label: '\u{1F4AC} Поговорить', bg: RUS.accent, hover: RUS.accentLight, cb: () => this.talkToNpc(interior) });
            buttons.push({ label: '\u{1F4B0} Просить денег', bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.askMoneyFromNpc(interior) });
            buttons.push({ label: '\u{1F4DC} Задание', bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.offerQuest(interior) });
            buttons.push({ label: '\u{1F381} Подарить', bg: 0x5a2a5a, hover: 0x6a3a6a, cb: () => this.showGiftMenu(interior) });
            buttons.push({ label: '\u{1F44D} Похвалить', bg: 0x2a5a5a, hover: 0x3a6a6a, cb: () => this.complimentNpc(interior) });
            buttons.push({ label: '\u{1F620} Угрожать', bg: 0x5a1a1a, hover: 0x6a2a2a, cb: () => this.threatenNpc(interior) });
            if (this.npcData && this.npcData.gender !== player.gender && npcRepValue >= 50 && villageRepValue >= 30) {
                buttons.push({ label: '\u{1F48D} Свататься', bg: 0x5a2a5a, hover: 0x6a3a6a, cb: () => this.proposeMarriage(interior) });
            }
            if (interior.id === 'tavern') {
                buttons.push({ label: '\u{1F37B} Угостить (20\u0434)', bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.treatEveryone(interior) });
                buttons.push({ label: '\u{1F6D2} Купить еды', bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showTavernShop() });
                // Раунд 12: свой тюк, оставленный на сохранение у тавернщика
                buttons.push({ label: '\u{1F392} Мой тюк', bg: 0x5a4530, hover: 0x6a5540, cb: () => this.openStash('tavern') });
            } else if (interior.id === 'blacksmith') {
                buttons.push({ label: '\u{1F6D2} Купить оружие', bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showBlacksmithShop('weapon') });
            }
        } else if (interior.id === 'chapel') {
            // Часовня: богомолье вместо разговора
            buttons.push({ label: '\u{1F64F} Помолиться', bg: RUS.accent, hover: RUS.accentLight, cb: () => this.prayInChapel() });
            buttons.push({ label: '\u{1F56F} Пожертвовать (5\u0434)', bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.donateInChapel() });
            buttons.push({ label: '\u{1F50D} Осмотреть киот', bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.inspectChapelKiot() });
        } else if (interior.id === 'barn') {
            // Амбар: подённая работа
            buttons.push({ label: '\u{2692} Работать (1 час)', bg: RUS.accent, hover: RUS.accentLight, cb: () => this.workInBarn() });
            buttons.push({ label: '\u{1F33E} Осмотреть зерно', bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.inspectBarnGrain() });
            // Раунд 12: свой работничий узел в углу
            buttons.push({ label: '\u{1F392} Мой узел', bg: 0x5a4530, hover: 0x6a5540, cb: () => this.openStash('barn') });
        }
        const exitAction = () => {
            this.scene.stop();
            if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
            else this.scene.start(this.from);
        };
        buttons.push({ label: '\u{1F6AA} Выйти', bg: 0x4a3520, hover: 0x5a4530, cb: exitAction });

        // Раунд 12 ФИКС: в таверне теперь 10 кнопок — фиксированные 130px
        // давали 1372px и обрезали «Выйти» за краем экрана. Ширина подстраивается:
        // все кнопки гарантированно помещаются с полями 16px по бокам.
        const btnW = Math.min(130, Math.floor((width - 32 - (buttons.length - 1) * btnGap) / buttons.length));
        const totalW = buttons.length * btnW + (buttons.length - 1) * btnGap;
        const startX = (width - totalW) / 2 + btnW / 2;
        buttons.forEach((b, i) => {
            const x = startX + i * (btnW + btnGap);
            createButton(this, x, btnY, b.label, b.cb, {
                backgroundColor: b.bg, hoverColor: b.hover, textColor: RUS.text,
                fontSize: 12, padding: { left: 6, right: 6, top: 10, bottom: 10 },
                cornerRadius: 6,
            });
        });

        this.input.keyboard.on('keydown-ESC', exitAction);
        this.busyDialog = false;
    }

    /**
     * П.7: Общий метод разговора с NPC — используется и кнопкой, и кликом по спрайту.
     */
    talkToNpc(interior) {
        if (this.busyDialog) return;
        const talkCheck = checkNpcWillingToTalk(this.registry, interior.npcId, { npcBusy: false });
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
        if (!talkCheck.canTalk) {
            createDialog(this, 'Отказ', talkCheck.message,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait }
            );
            return;
        }
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        ActionLog.add(this.registry, `Поговорил с ${npcName} в «${interior.name}».`);
        if (this.npcData && !this.npcData.met) {
            meetNpc(this.registry, interior.npcId);
            ActionLog.add(this.registry, `Познакомился с ${this.npcData.knownDescription}.`);
            this.npcNameText.setText(getNpcDisplayName(this.registry, interior.npcId));
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

    // === Пункт 10: Подарить NPC вещь или деньги (п.6: любой предмет, ценность = цена × 0.5) ===
    showGiftMenu(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const { width, height } = this.scale;
        
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 500, panelH = 450;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 25, `Подарить ${npcName}`, {
            fontSize: '18px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        let y = height / 2 - panelH / 2 + 65;

        // Подарить деньги (10 д.)
        createButton(this, width / 2, y, '💸 Подарить 10 денег', () => {
            if ((player.dengas || 0) < 10) {
                createDialog(this, 'Подарок', 'Не хватает денег!', [{ text: 'Понятно', callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= 10;
            this.registry.set('player', player);
            // П.6: ценность денег = номинал × 0.5 = 5
            const result = applyGiftBonus(this.registry, interior.npcId, 5);
            const msg = result.success
                ? `${npcName}: «Спасибо тебе! Доброе дело сделал.» (+${result.bonus} реп.)`
                : `${npcName}: «Не нужно мне твоих подачек!» (${result.bonus} реп.)`;
            this._closeGiftMenu(overlay, panel);
            createDialog(this, 'Подарок', msg, [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait });
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
        }).setDepth(202);
        y += 35;

        // Подарить деньги (50 д.)
        createButton(this, width / 2, y, '💸 Подарить 50 денег', () => {
            if ((player.dengas || 0) < 50) {
                createDialog(this, 'Подарок', 'Не хватает денег!', [{ text: 'Понятно', callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= 50;
            this.registry.set('player', player);
            // П.6: ценность = 50 × 0.5 = 25
            const result = applyGiftBonus(this.registry, interior.npcId, 25);
            const msg = result.success
                ? `${npcName}: «Ох, какая щедрость! Благодарю от сердца!» (+${result.bonus} реп.)`
                : `${npcName}: «Что-то ты уж слишком щедр... Чего хочешь?» (${result.bonus} реп.)`;
            this._closeGiftMenu(overlay, panel);
            createDialog(this, 'Подарок', msg, [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait });
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
        }).setDepth(202);
        y += 35;

        // Подарить любой предмет из инвентаря (п.6: ценность = цена × 0.5)
        const WEAPONS = {
            club: { name: 'Дубина', price: 2 }, knife: { name: 'Нож', price: 3 },
            spear: { name: 'Копьё', price: 8 }, sword: { name: 'Меч', price: 30 },
            axe: { name: 'Боевой топор', price: 25 }, bow: { name: 'Лук', price: 20 },
            sabre: { name: 'Сабля', price: 60 }, steel_sword: { name: 'Стальной меч', price: 100 },
        };
        const ARMORS = {
            padded: { name: 'Тегиляй', price: 10 }, leather: { name: 'Кожаная броня', price: 25 },
            chain: { name: 'Кольчуга', price: 80 }, plate: { name: 'Зерцальный доспех', price: 200 },
        };

        if (player.inventory && player.inventory.length > 0) {
            this.add.text(width / 2, y, 'Предметы из инвентаря:', {
                fontSize: '13px', color: RUS.textDim,
            }).setOrigin(0.5).setDepth(202);
            y += 25;

            player.inventory.forEach((item) => {
                // Определяем цену предмета
                let itemPrice = 0;
                if (WEAPONS[item.id]) itemPrice = WEAPONS[item.id].price;
                else if (ARMORS[item.id]) itemPrice = ARMORS[item.id].price;
                else if (item.id === 'herb') itemPrice = 5;
                else if (item.id === 'icon') itemPrice = 50;
                else itemPrice = 10; // базовая цена

                const giftValue = Math.round(itemPrice * 0.5); // п.6: ценность = цена × 0.5
                const itemLabel = `${item.name}${item.count > 1 ? ' ×' + item.count : ''} (ценность ${giftValue})`;

                createButton(this, width / 2, y, `📦 ${itemLabel}`, () => {
                    // Удаляем один предмет
                    item.count--;
                    if (item.count <= 0) {
                        player.inventory = player.inventory.filter(i => i !== item);
                    }
                    this.registry.set('player', player);
                    const result = applyGiftBonus(this.registry, interior.npcId, giftValue);
                    const msg = result.success
                        ? `${npcName}: «Ох, вещь добрая! Спасибо, пригодится.» (+${result.bonus} реп.)`
                        : `${npcName}: «Не нужна мне такая вещь.» (${result.bonus} реп.)`;
                    this._closeGiftMenu(overlay, panel);
                    createDialog(this, 'Подарок', msg, [{ text: 'Понятно', callback: () => {} }],
                        { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait });
                }, {
                    backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                    fontSize: 12, padding: { left: 12, right: 12, top: 6, bottom: 6 },
                }).setDepth(202);
                y += 30;
            });
        }

        // Закрыть
        createButton(this, width / 2, height / 2 + panelH / 2 - 25, 'Закрыть', () => {
            this._closeGiftMenu(overlay, panel);
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 20, right: 20, top: 8, bottom: 8 },
        }).setDepth(202);
    }

    _closeGiftMenu(overlay, panel) {
        overlay.destroy();
        panel.destroy();
        this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
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

    // === Пункты 7-10: Угрожать NPC ===
    threatenNpc(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const intimidateSkill = player.skills.intimidate || 15;
        const playerGender = player.gender || 'male';
        
        const result = applyThreat(this.registry, interior.npcId, intimidateSkill, playerGender);
        
        // П.8: При успехе — NPC может выдать деньги или предмет
        if (result.success) {
            // Выдаём случайные деньги (5-15 д.)
            const loot = 5 + Math.floor(Math.random() * 11);
            player.dengas = (player.dengas || 0) + loot;
            this.registry.set('player', player);
            ActionLog.add(this.registry, `Угрозой вымогал ${loot} д. у ${npcName} (бросок ${result.roll}).`);
            createDialog(this, 'Угроза',
                `${result.message}\n\nПолучено: ${loot} д.\n(Репутация ${result.repChange > 0 ? '+' : ''}${result.repChange})`,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
                  typing: true, typingSpeed: 30 }
            );
        } else if (result.willAttack) {
            // NPC нападает
            createDialog(this, 'Угроза — нападение!',
                `${result.message}\n(Репутация ${result.repChange > 0 ? '+' : ''}${result.repChange})`,
                [{ text: 'Драться!', callback: () => {
                    this.scene.start('Combat', { enemyKeys: ['bandit'], npcId: interior.npcId + '_hostile' });
                }}],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait }
            );
        } else {
            createDialog(this, 'Угроза',
                `${result.message}\n(Репутация ${result.repChange > 0 ? '+' : ''}${result.repChange})`,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
                  typing: true, typingSpeed: 30 }
            );
        }
        this.updateHUD();
    }

    // === Пункт 1: Свататься к NPC ===
    proposeMarriage(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const npcRepValue = getNpcRep(this.registry, interior.npcId);
        const villageRepValue = getVillageRep(this.registry);
        const cost = getMarriageCost();
        const npcRepThreshold = getMarriageNpcRepThreshold();
        const villageRepThreshold = getMarriageVillageRepThreshold();
        
        // Проверка условий
        const check = canMarry(this.registry, interior.npcId, player);
        
        if (!check.canMarry) {
            // NPC отказывает
            let message = '';
            if (npcRepValue < npcRepThreshold) {
                message = `${npcName}: «Ты мне хоть и люб, но я тебя ещё не так хорошо знаю, ` +
                    `чтобы семью создавать. Подожди ещё, наберись опыта в деревне.» ` +
                    `(Нужно личная репутация +${npcRepThreshold}, у вас ${npcRepValue})`;
            } else if (villageRepValue < villageRepThreshold) {
                message = `${npcName}: «Я бы рад(а), да староста не благословит. ` +
                    `Ты ещё не заслужил уважение всей деревни.» ` +
                    `(Нужно деревенская репутация +${villageRepThreshold}, у вас ${villageRepValue})`;
            } else if ((player.dengas || 0) < cost) {
                message = `${npcName}: «Свадьба — дело не дешёвое! Нужно ${cost} д. ` +
                    `на свадебное торжество и подарки. А у тебя всего ${player.dengas || 0} д.»`;
            } else {
                message = `${npcName}: «Не могу я выйти за тебя. ${check.reason}.»`;
            }
            
            createDialog(this, 'Сватовство', message, [
                { text: 'Понятно', callback: () => {} },
            ], {
                singleton: false,
                portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
                typing: true, typingSpeed: 30,
            });
            return;
        }
        
        // Условия выполнены — предложение брака
        const proposalText = `Ты решил свататься к ${npcName}.\n\n` +
            `Условия для свадьбы:\n` +
            `✓ Личная репутация: ${npcRepValue} (нужно +${npcRepThreshold})\n` +
            `✓ Деревенская репутация: ${villageRepValue} (нужно +${villageRepThreshold})\n` +
            `✓ Свадебное торжество: ${cost} д. (у вас ${player.dengas || 0} д.)\n\n` +
            `${npcName} согласен(на) принять твоё предложение! Свадьба состоится по обычаям Руси!`;
        
        createDialog(this, '💍 Сватовство', proposalText, [
            {
                text: '💍 Сыграем свадьбу!',
                callback: () => {
                    const result = marry(this.registry, interior.npcId, player);
                    if (result.success) {
                        // Свадьба состоялась — ВЫИГРЫШ
                        const winMessage = `🎉 СВАДЬВА! 🎉\n\n` +
                            `По обычаям Руси, отец Савватий обвенчал вас в церкви. ` +
                            `Вся деревня гуляла три дня на свадебном пиру!\n\n` +
                            `${player.name} и ${result.npcName} теперь — муж и жена.\n` +
                            `Ты принят в деревню как свой!\n\n` +
                            `ИГРА УСПЕШНО ЗАВЕРШЕНА!`;
                        
                        createDialog(this, '🎉 СВАДЬБА', winMessage, [
                            {
                                text: '🎉 Финал',
                                callback: () => {
                                    const q = this.registry.get('quest');
                                    q.thiefDefeated = true; // флаг победы для EndScene
                                    q.currentObjective = 'Женился и принят в деревню! Победа!';
                                    this.registry.set('quest', q);
                                    this.scene.stop();
                                    this.scene.resume(this.from);
                                    this.scene.getScene(this.from).scene.start('End');
                                },
                            },
                        ], {
                            singleton: false,
                            portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
                            typing: true, typingSpeed: 20,
                        });
                    }
                },
            },
            {
                text: 'Подумать ещё',
                callback: () => {
                    ActionLog.add(this.registry, `Решил пока не жениться на ${npcName}.`);
                },
            },
        ], {
            singleton: false,
            portraitKey: (this.npcData && this.npcData.portrait) || interior.portrait,
            typing: true, typingSpeed: 25,
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

    // ================================================================
    // Раунд 9: Часовня — богомолье, пожертвования, осмотр места кражи
    // ================================================================

    // Ключ игрового дня (для «раз в день»-ограничений)
    dayKey() {
        const t = getTime(this.registry);
        return t ? `${t.yearFromChrist}-${t.month}-${t.day}` : 'unknown';
    }

    /**
     * Раунд 12: домашний тайник («свой тюк») — раз в игровой день.
     * Работает через q.chestsOpened (те же помощники, что у уличных сундуков).
     * Лут скромный: перекус и мелочь. Забирает 5 минут.
     */
    openStash(stashKey) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const stash = STASHES[stashKey];
        if (!stash) return;

        const q = this.registry.get('quest') || {};
        const today = this.dayKey();
        if (isOpenedToday(q, stash.id, today)) {
            createDialog(this, '\u{1F392} Твой тюк',
                `Сегодня ты уже заглядывал в ${stash.label} — там больше ничего нет.`,
                [{ text: 'Ладно', callback: () => {} }]);
            return;
        }
        markOpened(q, stash.id, today);
        this.registry.set('quest', q);

        const loot = rollLoot(stash);
        let msg = 'Пусто... только старая тряпица.';
        if (loot.kind === 'money') {
            const amount = Phaser.Math.Between(loot.min, loot.max);
            player.dengas = (player.dengas || 0) + amount;
            msg = lootDisplayName(loot, amount);
            this.audioManager.playSound('sfx_button_click');
        } else if (loot.kind === 'apple') {
            player.HP = Math.min(player.HPmax || player.HP + 2, player.HP + 2);
            msg = lootDisplayName(loot);
            this.audioManager.playSound('sfx_heal');
        }
        this.registry.set('player', player);
        this.updateHUD();
        tickTime(this.registry, 5);
        ActionLog.add(this.registry, `Заглянул в ${stash.label}: ${msg}.`);

        createDialog(this, '\u{1F392} Твой тюк',
            `Ты развязываешь узел и проверяешь припасы. ${stash.label} — тут всегда найдётся что-то пригодное.\n\n${msg}`,
            [{ text: 'Прибрать узел', callback: () => {} }]);
    }

    /**
     * Молитва в часовне: +Воля (MP), один раз в игровой день.
     * Забирает 15 минут времени.
     */
    prayInChapel() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        tickTime(this.registry, 15);

        const q = this.registry.get('quest') || {};
        const today = this.dayKey();
        if (q.prayerDay === today) {
            ActionLog.add(this.registry, 'Помолился в часовне (уже молился сегодня).');
            createDialog(this, 'Молитва', 'Ты снова стоишь перед пустым киотом. Сердце уже нашло покой утром — сегодня больше не нужно.', [
                { text: 'Аминь.', callback: () => {} },
            ]);
            return;
        }
        q.prayerDay = today;
        this.registry.set('quest', q);

        const gain = Phaser.Math.Between(3, 8);
        player.MP = Math.min(player.MPmax || player.MP + gain, player.MP + gain);
        this.registry.set('player', player);
        this.updateHUD();
        ActionLog.add(this.registry, `Помолился в часовне — Воля +${gain}.`);

        createDialog(this, 'Молитва',
            'Ты опускаешься на колени перед пустым киотом. Вопреки горю, отделявшему деревню от святого, в тишине часовни приходит покой.\n\nВоля восстановлена: +' + gain + '.',
            [{ text: 'Встать с колен.', callback: () => {} }]);
    }

    /**
     * Пожертвование на свечи и ладан: −5 д., +1 к репутации в деревне.
     * Не чаще одного раза в игровой день.
     */
    donateInChapel() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;

        const q = this.registry.get('quest') || {};
        const today = this.dayKey();
        if (q.donationDay === today) {
            createDialog(this, 'Пожертвование', 'Ты уже жертвовал сегодня. Свечей куплено на всю неделю вперёд.', [
                { text: 'Ну ладно.', callback: () => {} },
            ]);
            return;
        }
        if ((player.dengas || 0) < 5) {
            createDialog(this, 'Пожертвование', 'В мошне пусто — не до пожертвований. Заработай в амбаре или помоги деревне.', [
                { text: 'Приду позже.', callback: () => {} },
            ]);
            return;
        }
        player.dengas -= 5;
        this.registry.set('player', player);
        q.donationDay = today;
        this.registry.set('quest', q);
        const res = changeVillageRep(this.registry, 1, 'Пожертвование в часовне');
        tickTime(this.registry, 10);
        this.updateHUD();
        ActionLog.add(this.registry, 'Пожертвовал 5 д. в часовне — деревня это помнит (+1 репутация).');

        createDialog(this, 'Пожертвование',
            'Ты кладёшь пять денег на блюдо у входа. «На свечи и ладан», — говоришь тихо. Казначей церкви будет рад.\n\n' +
            (res && res.message ? res.message : 'Репутация в деревне +1.'),
            [{ text: 'Низко поклониться иконам.', callback: () => {} }]);
    }

    /**
     * Осмотр киота: уникальная улика по делу о краже (один раз за игру).
     */
    inspectChapelKiot() {
        if (this.busyDialog) return;
        const q = this.registry.get('quest') || {};
        tickTime(this.registry, 10);

        if (q.chapelInspected) {
            createDialog(this, 'Пустой киот', 'Больше тут ничего не изменилось: ниша без иконы, воск на полу, верёвка.', [
                { text: 'Уйти от киота.', callback: () => {} },
            ]);
            return;
        }
        q.chapelInspected = true;
        if (!q.cluesGathered) q.cluesGathered = [];
        const clue = 'На полу часовни — капли стеарина и обрывок пеньковой верёвки с двумя узлами. Икону несли бережно, вдвоём, и накануне в часовне горела свеча.';
        q.cluesGathered.push({ npcId: 'chapel', npcName: 'Часовня', clue });
        this.registry.set('quest', q);
        ActionLog.add(this.registry, 'Осмотрел киот в часовне — нашёл улику (воск, верёвка с узлами).');

        createDialog(this, 'Осмотр киота',
            'Ниша, где стояла чудотворная икона, пуста. Ты присматриваешься: на полу — капли стеарина, ещё тёплые. У подножия — обрывок пеньковой верёвки с двумя узлами.\n\n' +
            'Вор был не один — и нёс святыню бережно. Это стоит рассказать старосте.\n\nУлика добавлена к делу.',
            [{ text: 'Запомнить.', callback: () => {} }]);
    }

    // ================================================================
    // Раунд 9: Амбар — подённая работа и общее зерно
    // ================================================================

    /**
     * Подённая работа (молотьба): 1 час времени, −4 здоровья, +3..6 денег,
     * 15% шанс найти монетку в соломе. При истощении (HP ≤ 5) отказ.
     */
    workInBarn() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;

        if ((player.HP || 0) <= 5) {
            createDialog(this, 'Силы кончились', 'Руки не поднимаются на цеп. Нужно поесть и отдохнуть в таверне, прежде чем браться за работу.', [
                { text: 'Справедливо...', callback: () => {} },
            ]);
            return;
        }
        tickTime(this.registry, 60);
        player.HP = Math.max(1, (player.HP || 1) - 4);
        const wage = Phaser.Math.Between(3, 6);
        let bonus = 0;
        let bonusMsg = '';
        if (Math.random() < 0.15) {
            bonus = Phaser.Math.Between(2, 4);
            bonusMsg = '\n\nВ соломе блеснула чужая монетка — видать, обронил кто-то из работников. Она твоя: +' + bonus + ' д.';
        }
        player.dengas = (player.dengas || 0) + wage + bonus;
        this.registry.set('player', player);
        this.updateHUD();
        ActionLog.add(this.registry, `Отработал час в амбаре: +${wage + bonus} д., усталость −4 HP.`);

        createDialog(this, 'Подённая работа',
            'Час за цепом и лопатой: снопы, веяние, мешки. Спина гудит, но в мошне звенит.\n\n' +
            'Заработано: +' + wage + ' д. Усталость: −4 здоровья.' + bonusMsg,
            [{ text: 'Отдышаться.', callback: () => {} }]);
    }

    /**
     * Осмотр зерна: атмосферная деталь + редкий съедобный бонус.
     */
    inspectBarnGrain() {
        if (this.busyDialog) return;
        tickTime(this.registry, 10);
        const player = this.registry.get('player');
        let extra = '';
        if (Math.random() < 0.2 && player && (player.HP || 0) < (player.HPmax || 10)) {
            player.HP = Math.min(player.HPmax || player.HP + 2, player.HP + 2);
            this.registry.set('player', player);
            this.updateHUD();
            extra = '\n\nВ закромах нашлась горсть сушёных яблок — хозяева не обидятся. +2 здоровья.';
            ActionLog.add(this.registry, 'Подкрепился сушёными яблоками в амбаре: +2 HP.');
        }
        const mice = ['мышь-хвостунья черкнула за мешками', 'воробей вылетел в слуховое окно', 'кот-невидимка оставил следы на пшенице'];
        createDialog(this, 'Осмотр зерна',
            'Закрома полны: рожь, пшеница, горох. Зерно в амбре сухое, не сопрело — стараниями общины.\n\n' +
            'Мимо ' + mice[Phaser.Math.Between(0, mice.length - 1)] + '.' + extra,
            [{ text: 'Довольно.', callback: () => {} }]);
    }

    /**
     * П.5 (4-й раз!): Пол и стены рисуем НАДЁЖНО — сначала заливаем прямоугольниками
     * коричневый фон, потом поверх — тайлы 32×32. Это исключает любую «зелёную сетку».
     */
    addDecorations(interior) {
        const { width, height } = this.scale;
        const decor = interior.decor || [];
        const ts = 32;

        // === Раунд 9: инфраструктура света ===
        // Собираем источники света (печь, свечи, лампада, камин),
        // в конце рендерим тёплые пятна: днём — лёгкая база, ночью — ярко.
        this._lightSources = [];
        const timeState = getTime(this.registry);
        const hour = timeState ? timeState.hour : 12;
        let daylight = 0;                 // насколько ярко за окном (для столбов света)
        let dark = 0;                     // насколько темно в доме (для отсветов огня)
        if (hour >= 8 && hour < 17) daylight = 1;
        else if (hour >= 6 && hour < 8) daylight = (hour - 6) / 2;
        else if (hour >= 17 && hour < 19) daylight = 1 - (hour - 17) / 2;
        if (hour >= 21 || hour < 5) dark = 1;
        else if (hour >= 18) dark = (hour - 18) / 3;
        else if (hour < 8) dark = (8 - hour) / 3;
        this._interiorDark = dark;

        // === ПОДЛОЖКА ПОЛА — коричневый прямоугольник на всю нижнюю часть ===
        // Гарантирует, что даже если тайлы не загрузятся, будет коричневый пол, не зелёный.
        const floorGfx = this.add.graphics().setDepth(-5);
        floorGfx.fillStyle(0x3a2616, 1);  // тёмно-коричневый
        floorGfx.fillRect(0, 100, width, height - 100);
        // === ПОДЛОЖКА СТЕН — более светлый коричневый на верхнюю часть ===
        floorGfx.fillStyle(0x5a3a22, 1);
        floorGfx.fillRect(0, 0, width, 100);

        // === Тайлы пола (если загружены) — поверх подложки ===
        if (this.textures.exists('int_floor_0')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 100; y < height; y += ts) {
                    // ФИКС «зелёной сетки» (была дробь 100/32 → int_floor_1.125 → __MISSING):
                    // вариант вычисляем по ЦЕЛОЧИСЛЕННЫМ индексам тайла, а не по пикселям.
                    const v = (Math.floor(x / ts) + Math.floor(y / ts)) % 2;
                    const key = `int_floor_${v}`;
                    if (!this.textures.exists(key)) continue;
                    this.add.image(x + ts / 2, y + ts / 2, key)
                        .setOrigin(0.5).setDepth(-4);
                }
            }
        }
        // === Тайлы стен (если загружены) ===
        if (this.textures.exists('int_wall')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 0; y < 100; y += ts) {
                    this.add.image(x + ts / 2, y + ts / 2, 'int_wall')
                        .setOrigin(0.5).setDepth(-4);
                }
            }
        }
        // === Окна (2 шт) с дневным светом и ночным синим стеклом ===
        // x = 62% и 84% — свободная зона стены (левее описание, в центре дата)
        if (this.textures.exists('int_window')) {
            const winY = 50;
            [width * 0.62, width * 0.84].forEach(wx => {
                const win = this.add.image(wx, winY, 'int_window').setScale(2).setDepth(-3);
                // Ночью стекло темнеет и синеет
                if (dark > 0.15) {
                    const c = Phaser.Display.Color.IntegerToColor(0xffffff);
                    const n = Phaser.Display.Color.IntegerToColor(0x3d4f73);
                    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(c, n, 100, Math.min(100, dark * 100));
                    win.setTint(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
                }
                // Дневной столб света из окна на пол (ADD) — гаснет к ночи
                if (daylight > 0.05) {
                    const shaft = this.add.graphics().setDepth(-2);
                    shaft.fillStyle(0xfff0c0, 0.16 * daylight);
                    shaft.fillPoints([
                        { x: wx - 30, y: winY + 18 },
                        { x: wx + 30, y: winY + 18 },
                        { x: wx + 74, y: height - 96 },
                        { x: wx - 6, y: height - 96 },
                    ], true);
                    shaft.setBlendMode(Phaser.BlendModes.ADD);
                }
            });
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
                this._lightSources.push({ x: 80, y: height * 0.55, w: 190, h: 60, a: 0.55 });
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
                this._lightSources.push({ x: width * 0.85, y: height * 0.5, w: 200, h: 64, a: 0.6 });
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
            // Дом старосты: стол, свеча, икона, сундук с документами, лавка, ПЕЧЬ,
            // КРАСНЫЙ УГОЛ с лампадой (раунд 9)
            if (this.textures.exists('int_deco_fireplace')) {
                this.add.image(80, height * 0.5, 'int_deco_fireplace').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_fire_0')) {
                const oven = this.add.image(80, height * 0.55, 'int_fire_0').setScale(2).setDepth(6);
                let ovenFrame = 0;
                this.time.addEvent({
                    delay: 110,
                    loop: true,
                    callback: () => { ovenFrame = (ovenFrame + 1) % 4; oven.setTexture(`int_fire_${ovenFrame}`); },
                });
                this._lightSources.push({ x: 80, y: height * 0.58, w: 180, h: 56, a: 0.55 });
            }
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_table').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_candle').setScale(1.5).setDepth(6);
                this._lightSources.push({ x: width * 0.5, y: height * 0.47, w: 80, h: 30, a: 0.4 });
            }
            // Красный угол — передний (восточный) угол с иконами и лампадой
            this.addRedCorner(width - 80, height * 0.34);
            if (this.textures.exists('int_deco_bench')) {
                this.add.image(width * 0.2, height * 0.7, 'int_deco_bench').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_chest')) {
                this.add.image(width * 0.8, height * 0.7, 'int_deco_chest').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'barn') {
            // Амбар общины (раунд 9): снопы, мешки зерна, поленница, весы
            if (this.textures.exists('int_deco_hay')) {
                this.add.image(width * 0.2, height * 0.42, 'int_deco_hay').setScale(1.4).setDepth(5);
                this.add.image(width * 0.78, height * 0.62, 'int_deco_hay').setScale(1.1).setDepth(5);
            }
            // Мешки зерна — рисованные (текстуры мешков нет)
            const sackGfx = this.add.graphics().setDepth(5);
            [[width * 0.38, height * 0.62], [width * 0.44, height * 0.58], [width * 0.62, height * 0.66]].forEach(([sx, sy]) => {
                sackGfx.fillStyle(0xb89b6a, 1);
                sackGfx.fillRoundedRect(sx - 22, sy - 26, 44, 52, 10);
                sackGfx.fillStyle(0x8a7048, 1);
                sackGfx.fillRoundedRect(sx - 8, sy - 30, 16, 8, 3);   // завязка
                sackGfx.lineStyle(2, 0x6a5232, 1);
                sackGfx.strokeRoundedRect(sx - 22, sy - 26, 44, 52, 10);
            });
            if (this.textures.exists('int_deco_barrel')) {
                this.add.image(width * 0.9, height * 0.45, 'int_deco_barrel').setScale(1.3).setDepth(5);
            }
            if (this.textures.exists('int_deco_firewood')) {
                this.add.image(width * 0.08, height * 0.72, 'int_deco_firewood').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_deco_shelf')) {
                this.add.image(width * 0.55, height * 0.3, 'int_deco_shelf').setScale(1.1).setDepth(4);
            }
            // Инструменты на стене — между окнами
            this.add.text(width * 0.72, 78, '⚔ 🪣', { fontSize: '26px' }).setOrigin(0.5).setDepth(10);
        } else if (interior.id === 'chapel') {
            // Часовня (раунд 9): ПУСТОЙ киот, свечи, аналой, красный угол, крест.
            // Ограблена: место иконы — сюжетная точка (осмотр даёт улику).
            // Пустой киот — рисованная ниша с золотой окантовкой
            const kiot = this.add.graphics().setDepth(4);
            const kx = width * 0.65, ky = height * 0.4;
            kiot.fillStyle(0x1e130a, 1);                       // тёмная ниша
            kiot.fillRoundedRect(kx - 52, ky - 74, 104, 148, 10);
            kiot.lineStyle(3, 0xc9a14a, 1);                    // золотая окантовка
            kiot.strokeRoundedRect(kx - 52, ky - 74, 104, 148, 10);
            kiot.lineStyle(2, 0xc9a14a, 0.6);
            kiot.strokeCircle(kx, ky - 22, 30);                // пустой нимб
            // След от иконы: чуть более светлая «тень» в нише
            kiot.fillStyle(0x2c1e10, 1);
            kiot.fillRect(kx - 26, ky - 52, 52, 104);
            this.add.text(kx, ky + 62, 'слово Божие — в сердцах', {
                fontSize: '10px', color: '#8a7248', fontFamily: 'Georgia, serif',
            }).setOrigin(0.5).setDepth(5);
            if (this.textures.exists('int_deco_analogion')) {
                this.add.image(width * 0.4, height * 0.6, 'int_deco_analogion').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_deco_candle')) {
                [0.3, 0.9].forEach(fx => {
                    this.add.image(width * fx, height * 0.52, 'int_deco_candle').setScale(1.3).setDepth(5);
                    this._lightSources.push({ x: width * fx, y: height * 0.54, w: 90, h: 34, a: 0.5 });
                });
            }
            this.add.text(width * 0.5, height * 0.13, '✝', {
                fontSize: '44px', color: '#c9a14a',
            }).setOrigin(0.5).setDepth(10);
            // Красный угол с лампадой — единственный огонёк после кражи
            this.addRedCorner(width - 64, height * 0.3, true);
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
                this._lightSources.push({ x: width * 0.42, y: height * 0.37, w: 80, h: 30, a: 0.4 });
                this._lightSources.push({ x: width * 0.58, y: height * 0.37, w: 80, h: 30, a: 0.4 });
            }
            // Аналой (подставка для икон/книг)
            if (this.textures.exists('int_deco_analogion')) {
                this.add.image(width * 0.5, height * 0.6, 'int_deco_analogion').setScale(1.2).setDepth(5);
            }
            this.add.text(width * 0.5, height * 0.15, '✝', {
                fontSize: '48px', color: '#c9a14a',
            }).setOrigin(0.5).setDepth(10);
        } else if (interior.id === 'villager_house_1') {
            // Дом крестьянина Авдея: стол, лавка, кровать, поленница, стог сена, ПЕЧЬ,
            // КРАСНЫЙ УГОЛ (раунд 9)
            // Русская печь с живым огнём — сердце избы
            if (this.textures.exists('int_deco_fireplace')) {
                this.add.image(80, height * 0.45, 'int_deco_fireplace').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_fire_0')) {
                const oven = this.add.image(80, height * 0.5, 'int_fire_0').setScale(2).setDepth(6);
                let ovenFrame = 0;
                this.time.addEvent({
                    delay: 100,
                    loop: true,
                    callback: () => { ovenFrame = (ovenFrame + 1) % 4; oven.setTexture(`int_fire_${ovenFrame}`); },
                });
                this._lightSources.push({ x: 80, y: height * 0.56, w: 180, h: 56, a: 0.55 });
            }
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
            // Красный угол вместо одинокой иконы (раунд 9)
            this.addRedCorner(width - 72, height * 0.32);
        } else if (interior.id === 'villager_house_2') {
            // Дом вдовы Марфы: кровать, прялка, икона, колыбель, полка с травами, ПЕЧЬ,
            // КРАСНЫЙ УГОЛ (раунд 9)
            // Печь — у неё греются и готовят
            if (this.textures.exists('int_deco_fireplace')) {
                this.add.image(80, height * 0.45, 'int_deco_fireplace').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_fire_0')) {
                const oven = this.add.image(80, height * 0.5, 'int_fire_0').setScale(2).setDepth(6);
                let ovenFrame = 0;
                this.time.addEvent({
                    delay: 120,
                    loop: true,
                    callback: () => { ovenFrame = (ovenFrame + 1) % 4; oven.setTexture(`int_fire_${ovenFrame}`); },
                });
                this._lightSources.push({ x: 80, y: height * 0.56, w: 180, h: 56, a: 0.55 });
            }
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
            // Красный угол вместо одинокой иконы (раунд 9)
            this.addRedCorner(width - 76, height * 0.32);
            // Свеча
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.15, height * 0.65, 'int_deco_candle').setScale(1.2).setDepth(6);
                this._lightSources.push({ x: width * 0.15, y: height * 0.67, w: 70, h: 26, a: 0.35 });
            }
        }

        // === Раунд 9: тёплые пятна света от источников (день — слабо, ночь — ярко) ===
        this.renderInteriorLights();
    }

    /**
     * Красный угол — передний (восточный) угол избы с иконами:
     * доска-киот, божница, вышитое полотенце (рукавичник) и мерцающая лампада.
     * withNiche — усиленный вариант для часовни (дополнительная божница).
     */
    addRedCorner(x, y, withNiche = false) {
        // Доска-киот под иконами
        this.add.rectangle(x, y - 10, 66, 50, 0x4a2f18, 1)
            .setStrokeStyle(2, 0x2a1a08).setDepth(4);
        if (this.textures.exists('int_deco_icon_wall')) {
            this.add.image(x, y - 12, 'int_deco_icon_wall').setScale(0.6).setDepth(5);
        }
        if (withNiche && this.textures.exists('int_deco_icon_wall')) {
            // вторая икона рядом (в часовне)
            this.add.image(x - 44, y - 8, 'int_deco_icon_wall').setScale(0.4).setDepth(5);
        }
        // Красное полотенце с орнаментом (graphics)
        const towel = this.add.graphics().setDepth(6);
        towel.fillStyle(0x9b1c1c, 1);
        towel.fillRect(x + 24, y - 6, 14, 38);
        towel.fillStyle(0xe8d9a0, 1);
        towel.fillRect(x + 24, y + 26, 14, 6);          // светлая кайма внизу
        for (let i = 0; i < 3; i++) {
            towel.fillRect(x + 24, y + 4 + i * 8, 14, 2);   // орнамент-полоски
        }
        // Лампада — тёплый огонёк под иконами (мерцает)
        const lamp = this.add.image(x - 22, y + 8, this.textures.exists('particle_spark') ? 'particle_spark' : 'particle')
            .setTint(0xffb84d)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(7)
            .setScale(0.5);
        this.tweens.add({
            targets: lamp,
            alpha: { from: 0.55, to: 0.9 },
            scale: { from: 0.45, to: 0.6 },
            duration: Phaser.Math.Between(500, 800),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        // Отсвет лампады на стене/полу — как источник ночного света
        this._lightSources.push({ x: x - 20, y: y + 26, w: 80, h: 34, a: 0.45 });
    }

    /**
     * Раунд 9: рисует тёплые эллипсы над оверлеем (глубина 96 > 95),
     * имитируя свет от печей/свечей/лампад в тёмное время суток.
     * Днём остаётся лёгкая база (живой огонь виден и при свете).
     */
    renderInteriorLights() {
        const dark = this._interiorDark || 0;
        (this._lightSources || []).forEach(src => {
            const base = 0.06;
            const alpha = Math.min(0.85, base + dark * src.a);
            this.add.ellipse(src.x, src.y, src.w, src.h, 0xff9a3c, alpha)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(96);
        });
    }

    updateHUD() {
        const p = this.player;
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}  ✦ Воля ${p.MP}/${p.MPmax}  💰 ${formatMoney(p.dengas || 0)}`);
    }
}

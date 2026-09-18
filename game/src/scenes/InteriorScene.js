// Сцена интерьера здания (таверна, кузница, дома жителей, дом старосты, церковь).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { createButton, createDialog, bindRestartOnResize, addSceneMenuButtons } from '../utils/ui.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd, askMoneyForHelp, askElderAdvance, isChaseActive } from '../data/thief.js';
import { ARMORS, WEAPONS, formatMoney, equipWeapon, equipArmor } from '../systems/Character.js';
import { generateQuest, acceptQuest, getActiveQuests, grantQuestRewards, checkQuestCompletion, onLocationVisited } from '../data/questGenerator.js';
import { getTime, formatTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
import { getWeather } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';
import { findNpc, meetNpc, getNpcDisplayName, getNpcShortName, getNpcs } from '../data/npcNames.js';
import { buildNpcLookTextures, npcVariantKey, npcPortraitVariantKey } from '../systems/NpcLook.js';
import { ensureNpcLpcTexture } from '../systems/NpcLpc.js';
import { getPresence, PLACE_NAMES, getNpcsAtPlace, NPC_DIALOGUE, OUTDOOR_LINES, ALL_NPC_IDS } from '../data/npcPresence.js';
import {
    checkNpcWillingToTalk, getNpcRep, getReputationLevel,
    applyGiftBonus, applyCompliment, applyTreatEveryoneBonus,
    applyQuestCompleteBonus, applyThreat, willNpcAttack, willNpcRefuseTrade,
    getPriceModifier, getRewardModifier,
    canMarry, marry, getMarriageCost, getMarriageNpcRepThreshold, getMarriageVillageRepThreshold, getAgeOfMajority,
    getVillageRep, changeVillageRep,
    isNpcKilled, canBuyMilitaryGear, MILITARY_GEAR_IDS,
} from '../data/reputation.js';
import { getNpcSchedule, getNpcActivity } from '../data/npcSchedules.js';
// Раунд 39 (п.13): STASHES/тюки/сундуки/ларцы удалены из игры целиком
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine } from '../systems/WorldClock.js';

export class InteriorScene extends Phaser.Scene {
    constructor() {
        super('Interior');
    }

    init(data) {
        this.interiorId = data?.interiorId || 'elder_house';
        this.from = data?.from || 'Village';
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);
        // Раунд 31 (пп.11,12): мировые часы идут реальным временем (в диалогах стоят)
        attachWorldClock(this);
        attachChurchBells(this, { volume: 0.45, muffled: true });
        // Раунд 32 (пп.14,15): F1 — «Информация по игре» и в интерьерах
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ Информация по игре',
                timeRatioInfoLine() + '\n\n' +
                t('🏠 Разговор с хозяином дома занимает 1 игровой час —\nвыбирай, с кем и о чём говорить.\n📦 Сундуки и тайники открываются раз в игровой день.\n◀ Выход — кнопка внизу.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singletonKey: 'interior-help' });
        });
        // Раунд 24: звуковая атмосфера интерьера — музыка (таверна/церковь),
        // эмбиент и скрип двери при входе
        this.audioManager.playRealDoorOpen();
        if (this.interiorId === 'tavern') {
            this.audioManager.playInteriorMusic('tavern');
            this.audioManager.setAmbient('ambient_tavern');
        } else if (this.interiorId === 'church') {
            this.audioManager.playInteriorMusic('church');
            this.audioManager.playChurchBell();
        } else {
            this.audioManager.playSceneMusic('village'); // тихий фон деревни в домах
        }

        const interior = INTERIORS[this.interiorId];
        if (!interior) {
            console.error('Interior not found:', this.interiorId);
            this.scene.start(this.from);
            return;
        }
        this.interior = interior;

        // Раунд 21: вход в дом занимает время (1 тик) — вор тоже двигается.
        // До рисования HUD, чтобы дата/время уже были с учётом входа.
        tickTime(this.registry, 15);
        // Раунд 21: визит в церковь может закрыть поручение «Помолиться за больного»
        if (this.interiorId === 'church') {
            onLocationVisited(this.registry, 'church');
        }

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

        // Раунд 40 (заявка п.1): [📜 Персонаж] / [🎒 Инвентарь] вверху справа
        // ВО ВСЕХ помещениях (раньше — только кнопка у кузнеца)
        addSceneMenuButtons(this, 'Interior');

        // ----- NPC в интерьере -----
        // Амбар — БЕЗ NPC (работник на поле):
        // вместо него — декор-центр и особый набор действий в кнопках.
        // Раунд 26: часовня удалена — её богомолье/пожертвование/киот в церкви.
        const hasNpc = !interior.noNpc && !!interior.npcId;
        // Раунд 27: хозяин сейчас в СВОЁМ интерьере? (пп.7,8,10,11 —
        // Авдей на мельнице, Марфа на пасеке/с травами, староста гуляет,
        // жители на постоялом дворе). Место «home» ИЛИ совпадает с интерьером
        // (тавернщик: место «tavern», но его интерьер — и есть «tavern»).
        this.ownerPresence = hasNpc
            ? getPresence(this.registry, interior.npcId)
            : { place: 'home', activity: '' };
        const ownerHere = hasNpc &&
            (this.ownerPresence.place === 'home' || this.ownerPresence.place === this.interiorId);
        // Раунд 45 (п.3 заявки): убитый героем хозяин больше не живёт в доме —
        // стоит тишина, никаких разговоров и кнопок
        const ownerKilled = hasNpc && isNpcKilled(this.registry, interior.npcId);
        // Портрет для диалогов интерьера (с учётом варианта внешности NPC);
        // для интерьеров без NPC — базовый портрет интерьера
        this.npcPortraitKey = (this.npcData && this.npcData.portrait) || interior.portrait;
        if (hasNpc && ownerKilled) {
            // ----- Раунд 45 (п.3): ДОМ, ГДЕ УБИТ ХОЗЯИН —
            // пустота вместо фигуры, скорбная записка вместо разговоров -----
            const deadName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
            this.add.sprite(width * 0.65, height * 0.55, 'npc_elder').setAlpha(0.0).setDepth(5); // держим раскладку
            this.add.text(width * 0.65, height * 0.40, t('🕯 Здесь стоит тишина...'), {
                fontSize: '18px', color: RUS.textDim,
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.add.text(width * 0.65, height * 0.52, tf(t('{0} погиб(ла) от твоей руки.\nДом опустел, вещи прикрыты холстиной.\nДеревня шепчется о кровной вине.'), deadName), {
                fontSize: '15px', color: RUS.text, align: 'center',
                backgroundColor: '#000000aa', padding: { x: 10, y: 8 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.add.text(width * 0.65, height * 0.66, t('Староста может смыть эту вину вирой — если заплатишь.'), {
                fontSize: '12px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5).setDepth(20);
        } else if (hasNpc && ownerHere) {
            let npcSpriteKey = (this.npcData && this.npcData.sprite) || interior.npcSprite;
            // П.6: Проверяем существование текстуры
            let finalSpriteKey = this.textures.exists(npcSpriteKey) ? npcSpriteKey : 'npc_elder';
            // Раунд 28 (п.2): LPC-композит жителя (Вариант A владельца) —
            // тело/причёска/борода/одежда из палитры, уникально на каждую игру;
            // если слои недоступны — прежний перекрашенный вариант (раунд 23)
            const ownerLpc = this.npcData ? ensureNpcLpcTexture(this, this.registry, this.npcData) : null;
            if (ownerLpc) {
                finalSpriteKey = ownerLpc;
            } else if (this.npcData && buildNpcLookTextures(this, this.npcData)) {
                const variant = npcVariantKey(this.npcData);
                if (variant && this.textures.exists(variant)) finalSpriteKey = variant;
            }
            // Портрет — тоже вариант (цвет одежды на портрете совпадает)
            const portraitVariant = npcPortraitVariantKey(this.npcData);
            if (portraitVariant && this.textures.exists(portraitVariant)) {
                this.npcPortraitKey = portraitVariant;
            }
            // Рост NPC — раунд 37 (п.4): ЕДИНЫЙ масштаб по возрасту:
            // взрослый = 2.5 (как игрок в интерьере), подросток ×0.85, ребёнок ×0.7
            this.npcBaseScale = 2.5 * this.interiorAgeScale(this.npcData);
            this.npcSprite = this.add.sprite(width * 0.65, height * 0.55, finalSpriteKey).setScale(this.npcBaseScale).setDepth(5);
            // Раунд 37 (п.21): тавернщик ВСЕГДА ЗА СТОЙКОЙ (инт. 'tavern') —
            // стойка рисуется в (0.5w, 0.45h); хозяин стоит за ней, чуть выше
            if (this.interiorId === 'tavern') {
                this.npcSprite.setPosition(width * 0.5, height * 0.45 - 62);
                this.npcSprite.setDepth(4); // за стойкой (стойка — глубина 5)
            }
            // Проверяем существование анимации
            const animKey = `${finalSpriteKey}_idle_down`;
            if (this.anims.exists(animKey)) {
                this.npcSprite.play(animKey);
            }
            // Лёгкое дыхание
            this.tweens.add({
                targets: this.npcSprite,
                scaleX: { from: this.npcBaseScale, to: this.npcBaseScale * 1.02 },
                scaleY: { from: this.npcBaseScale, to: this.npcBaseScale * 0.98 },
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
            this.add.text(this.npcSprite.x, this.npcSprite.y - 80, t('💬 Нажми, чтобы поговорить'), {
                fontSize: '11px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(20);
        } else if (hasNpc && !ownerHere) {
            // ----- Раунд 27: ХОЗЯИНА НЕТ ДОМА —
            // показываем где его искать (живой мир, пп.7,8,10,11) -----
            const absentName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
            const where = t(PLACE_NAMES[this.ownerPresence.place] || '') || '';
            this.add.sprite(width * 0.65, height * 0.55, 'npc_elder').setAlpha(0.0).setDepth(5); // держим раскладку
            this.add.text(width * 0.65, height * 0.42, t('🌙 Здесь сейчас никого нет...'), {
                fontSize: '18px', color: RUS.textDim,
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.add.text(width * 0.65, height * 0.52, `${absentName}\n${this.ownerPresence.activity || ''}\n📍 ${where}`, {
                fontSize: '15px', color: RUS.text, align: 'center',
                backgroundColor: '#000000aa', padding: { x: 10, y: 8 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.add.text(width * 0.65, height * 0.66, t('Найди(е) его там — или возвращайся в другой час.'), {
                fontSize: '12px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5).setDepth(20);
        }

        // ----- Раунд 27 (пп.6,9): ВТОРАЯ ФИГУРА — ЖЕНА (староста/пасечник) -----
        // Раунд 45 (п.3): убитые вторые фигуры (жёны/родня) из дома убираются
        if (interior.secondaryNpcId && !isNpcKilled(this.registry, interior.secondaryNpcId)) {
            const secPresence = getPresence(this.registry, interior.secondaryNpcId);
            if (secPresence.place === 'home') {
                const secData = findNpc(this.registry, interior.secondaryNpcId);
                const secName = secData ? getNpcDisplayName(this.registry, interior.secondaryNpcId)
                    : interior.secondaryNpcName;
                const secSpriteKey = (secData && secData.sprite) || interior.secondaryNpcSprite || 'npc_elder';
                let secFinal = this.textures.exists(secSpriteKey) ? secSpriteKey : 'npc_elder';
                const secLpc = secData ? ensureNpcLpcTexture(this, this.registry, secData) : null;
                if (secLpc) {
                    secFinal = secLpc;
                } else if (secData && buildNpcLookTextures(this, secData)) {
                    const secVariant = npcVariantKey(secData);
                    if (secVariant && this.textures.exists(secVariant)) secFinal = secVariant;
                }
                const secScale = 2.5 * this.interiorAgeScale(secData);
                const secSpr = this.add.sprite(width * 0.84, height * 0.66, secFinal)
                    .setScale(secScale).setDepth(6);
                const secAnim = `${secFinal}_idle_down`;
                if (this.anims.exists(secAnim)) secSpr.play(secAnim);
                this.tweens.add({
                    targets: secSpr,
                    scaleX: { from: secScale, to: secScale * 1.02 },
                    scaleY: { from: secScale, to: secScale * 0.98 },
                    duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
                secSpr.setInteractive({ useHandCursor: true });
                secSpr.on('pointerdown', (pointer) => {
                    if (pointer.leftButtonDown() && !this.busyDialog) {
                        this.busyDialog = true;
                        this.dialogue.run(interior.secondaryDialogueId, () => { this.busyDialog = false; });
                    }
                });
                this.add.text(secSpr.x, secSpr.y + 70, secName, {
                    fontSize: '14px', color: RUS.text, stroke: '#000', strokeThickness: 2,
                }).setOrigin(0.5).setDepth(20);
                this.add.text(secSpr.x, secSpr.y - 64, t('💬 Нажми, чтобы поговорить'), {
                    fontSize: '10px', color: '#c9a14a',
                    backgroundColor: '#00000088', padding: { x: 5, y: 2 },
                }).setOrigin(0.5).setDepth(20);
            }
        }

        // ----- Раунд 27 (п.11): ПОСЕТИТЕЛИ ПОСТОЯЛОГО ДВОРА -----
        // Взрослые жители, которые по расписанию сегодня сидят здесь за столами.
        if (this.interiorId === 'tavern') {
            const visitorIds = getNpcsAtPlace(this.registry, 'tavern')
                .filter(id => id !== 'tavernkeeper').slice(0, 3);
            const VISITOR_SPOTS = [
                { x: 0.5, y: 0.74 }, { x: 0.84, y: 0.72 }, { x: 0.26, y: 0.44 },  // раунд 37: 3-й гость сдвинут с места тавернщика у стойки
            ];
            visitorIds.forEach((vId, vi) => {
                const vData = findNpc(this.registry, vId);
                const vName = vData ? getNpcDisplayName(this.registry, vId) : vId;
                const vSpriteKey = (vData && vData.sprite) || 'npc_merchant';
                let vFinal = this.textures.exists(vSpriteKey) ? vSpriteKey : 'npc_elder';
                const vLpc = vData ? ensureNpcLpcTexture(this, this.registry, vData) : null;
                if (vLpc) {
                    vFinal = vLpc;
                } else if (vData && buildNpcLookTextures(this, vData)) {
                    const vVariant = npcVariantKey(vData);
                    if (vVariant && this.textures.exists(vVariant)) vFinal = vVariant;
                }
                const vx = VISITOR_SPOTS[vi].x * width;
                const vy = VISITOR_SPOTS[vi].y * height;
                const vSpr = this.add.sprite(vx, vy, vFinal).setScale(2.5 * this.interiorAgeScale(vData)).setDepth(7);
                const vAnim = `${vFinal}_idle_down`;
                if (this.anims.exists(vAnim)) vSpr.play(vAnim);
                vSpr.setInteractive({ useHandCursor: true });
                vSpr.on('pointerdown', (pointer) => {
                    if (pointer.leftButtonDown() && !this.busyDialog) {
                        this.busyDialog = true;
                        const dId = NPC_DIALOGUE[vId];
                        if (dId) {
                            this.dialogue.run(dId, () => { this.busyDialog = false; });
                        } else {
                            const line = OUTDOOR_LINES[vId] || t('«Хорошая медовуха нынче...»');
                            createDialog(this, vName, line, [
                                { text: t('Продолжить'), callback: () => { this.busyDialog = false; } },
                            ], { singleton: true, portraitKey: (vData && vData.portrait) || 'portrait_villager_f' });
                        }
                    }
                });
                this.add.text(vx, vy + 44, vName, {
                    fontSize: '12px', color: RUS.text,
                    backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
                    stroke: '#000', strokeThickness: 2,
                }).setOrigin(0.5).setDepth(20);
            });
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

        // Дата и время сверху (п.13) — плотная подложка: читается и на живописном фоне
        if (timeState) {
            this.add.text(width / 2, 55, `📅 ${formatDateTime(timeState)}`, {
                fontSize: '11px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 2,
                backgroundColor: '#000000d9', padding: { x: 8, y: 4 },
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
        // Раунд 27: диалоговые кнопки — только если хозяин на месте
        // (иначе в доме тихо, работает только «Выйти»)
        // Раунд 45 (п.3): в доме убитого героя кнопок диалога нет вовсе
        if (hasNpc && ownerHere && !ownerKilled) {
            buttons.push({ label: t('\u{1F4AC} Поговорить'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.talkToNpc(interior) });
            buttons.push({ label: t('\u{1F4B0} Просить денег'), bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.askMoneyFromNpc(interior) });
            buttons.push({ label: t('\u{1F4DC} Задание'), bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.offerQuest(interior) });
            buttons.push({ label: t('\u{1F381} Подарить'), bg: 0x5a2a5a, hover: 0x6a3a6a, cb: () => this.showGiftMenu(interior) });
            buttons.push({ label: t('\u{1F44D} Похвалить'), bg: 0x2a5a5a, hover: 0x3a6a6a, cb: () => this.complimentNpc(interior) });
            buttons.push({ label: t('\u{1F620} Угрожать'), bg: 0x5a1a1a, hover: 0x6a2a2a, cb: () => this.threatenNpc(interior) });
            // Раунд 43 (п.13 заявки): «Свататься» — только с совершеннолетними
            // НПЦ противоположного пола (возраст НПЦ ≥ 18).
            // Раунд 44 (п.7): и только НЕ состоящими в браке (замужних/женатых
            // сразу не показываем — ранее отказ выдавался уже в canMarry).
            if (this.npcData && this.npcData.gender !== player.gender && (this.npcData.age || 0) >= getAgeOfMajority() && !this.npcData.married && npcRepValue >= 50 && villageRepValue >= 30) {
                buttons.push({ label: t('\u{1F48D} Свататься'), bg: 0x5a2a5a, hover: 0x6a3a6a, cb: () => this.proposeMarriage(interior) });
            }
            if (interior.id === 'tavern') {
                buttons.push({ label: t('\u{1F37B} Угостить (20\u0434)'), bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.treatEveryone(interior) });
                buttons.push({ label: t('\u{1F6D2} Купить еды'), bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showTavernShop() });
                // Раунд 22 (п.10/12): отдых в таверне — 1 час (частичное лечение)
                // или 8 часов (полное восстановление)
                buttons.push({ label: t('\u{1F6CF} Отдых'), bg: 0x4a3a5a, hover: 0x5a4a6a, cb: () => this.showTavernRestMenu(interior) });
                // Раунд 40 (заявка): «⏳ Провести время» — перемотка 1–24 ч /
                // до утра / до полудня / до вечера, чтобы не мотаться
                // деревня↔околица (по 2 ч за цикл) ради часов.
                buttons.push({ label: t('\u{23F3} Время'), bg: 0x2a4a5a, hover: 0x3a5a6a, cb: () => this.showSpendTimeMenu() });
                // Раунд 39 (п.13): кнопка «Мой тюк» УДАЛЕНА вместе со всеми тюками
            } else if (interior.id === 'blacksmith') {
                buttons.push({ label: t('\u{1F6D2} Купить оружие'), bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showBlacksmithShop('weapon') });
                // Раунд 40: кнопка «Персонаж» теперь ПОСТОЯННАЯ вверху справа
                // ВО ВСЕХ помещениях (addSceneMenuButtons) — дубликат у кузнеца снят
            }
            // Раунд 26: в церкви — богомолье и осмотр киота (переехали из удалённой часовни)
            if (interior.id === 'church') {
                buttons.push({ label: t('\u{1F64F} Помолиться'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.prayInChurch() });
                buttons.push({ label: t('\u{1F56F} Пожертвовать (5\u0434)'), bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.donateInChurch() });
                buttons.push({ label: t('\u{1F50D} Осмотреть киот'), bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.inspectChurchKiot() });
            }
        } else if (interior.id === 'potter_house') {
            // Раунд 37 (вариант Б): мастерская гончара — подённая работа
            // переехала сюда из удалённого амбара (п.18 заявки)
            buttons.push({ label: t('\u{1FAB5} Помочь в мастерской (1 час)'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.workInPotter() });
            // Раунд 39 (п.13): кнопка «Мой узел» УДАЛЕНА вместе со всеми тюками
        }
        const exitAction = () => {
            // Раунд 40: пока открыто меню «Провести время» — ESC закрывает
            // только меню, а не выбрасывает героя из постоялого двора.
            // Раунд 40 (QA-фикс): если открыт ЛЮБОЙ диалог (busyDialog) — ESC
            // вообще не должен срабатывать: scene.stop() поверх живого диалога
            // замораживал канвас (диалог оставался на экране, ввод умирал).
            if (this.__spendTimeOpen || this.busyDialog) return;
            // Раунд 24: скрип двери при выходе
            this.audioManager.playRealDoorClose();
            this.scene.stop();
            if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
            else this.scene.start(this.from);
        };
        buttons.push({ label: t('\u{1F6AA} Выйти'), bg: 0x4a3520, hover: 0x5a4530, cb: exitAction });

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
        // Раунд 21: если у NPC есть ВЫПОЛНЕННОЕ, но не оплаченное поручение —
        // сперва выдаём награду, потом разговор.
        if (this.claimCompletedQuests(interior)) return;
        const talkCheck = checkNpcWillingToTalk(this.registry, interior.npcId, { npcBusy: false });
        if (talkCheck.willAttack) {
            createDialog(this, t('Нападение!'),
                `${getNpcDisplayName(this.registry, interior.npcId)} бросается на тебя с кулаками!`,
                [{ text: 'Драться!', callback: () => {
                    // Раунд 40 (QA-фикс): переход в бой — на следующий кадр,
                    // вне стека обработчика клика (иначе зависание цикла Phaser)
                    this.time.delayedCall(0, () => {
                        this.scene.start('Combat', { enemyKeys: ['bandit'], npcId: interior.npcId + '_hostile' });
                    });
                }}],
                { singleton: false, portraitKey: this.npcPortraitKey }
            );
            return;
        }
        if (!talkCheck.canTalk) {
            createDialog(this, 'Отказ', talkCheck.message,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey }
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
            portrait: this.npcPortraitKey,
        };
        this.busyDialog = true;
        this.dialogue.run(interior.dialogueId, () => {
            this.busyDialog = false;
            const end = checkGameEnd(this.registry);
            if (end) this.scene.start('End');
        });
    }


    /**
     * Раунд 21: выдать награду за ВЫПОЛНЕННОЕ поручение этого NPC.
     * Поручения отмечаются выполненными по факту (бой/визит в локацию),
     * а награда выдаётся при разговоре с заказчиком — полный цикл RPG.
     * @returns {boolean} true, если награда была выдана (диалог открыт)
     */
    claimCompletedQuests(interior) {
        // Раунд 21 ФИКС: getActiveQuests ОТФИЛЬТРОВЫВАЕТ выполненные задания —
        // ищем среди ВСЕХ принятых поручений этого NPC
        const allQuests = ((this.registry.get('quest') || {}).activeQuests) || [];
        const done = allQuests
            .find(q => q.completed && !q.rewardClaimed && q.npcId === interior.npcId);
        if (!done) return false;
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const rewards = grantQuestRewards(this.registry, done);
        done.rewardClaimed = true;
        this.audioManager.playGoldReceive(); // раунд 24: звон монет
        applyQuestCompleteBonus(this.registry, interior.npcId, done.difficulty);
        ActionLog.add(this.registry, `Награда за «${done.title}»: ${rewards.join(', ')}.`);
        this.busyDialog = true;
        const address = this.player && this.player.gender === 'female' ? t('путница') : t('путник');
        createDialog(this, t('✓ Поручение выполнено!'),
            `${npcName}: «${tf(t('Ты справился, {0}! Прими это в благодарность.'), address)}»\n\n${t('Награда')}: ${rewards.join(', ')}`,
            [{ text: t('Спасибо!'), callback: () => { this.busyDialog = false; } }],
            { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 25 });
        if (this.hud) this.updateHUD();
        return true;
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
                { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 30 }
            );
            return;
        }

        // Генерируем задание
        const quest = generateQuest(interior.npcId, this.registry);
        if (!quest) {
            createDialog(this, 'Задание',
                `${npcName}: «Нет у меня сейчас для тебя дел. Зайди попозже.»`,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 30 }
            );
            return;
        }

        // Формируем описание наград
        const rewardTexts = quest.rewards.map(r => {
            if (r.type === 'money') return formatMoney(r.amount);
            if (r.type === 'item') return `${r.name} ×${r.count}`;
            if (r.type === 'blessing') return r.name;
            return r.name || 'что-то';
        });

        const questText = `${quest.description}\n\n` +
            `Цель: ${quest.objective}\n` +
            `Время на выполнение: ${tf(t('{0} действий'), quest.timeLimit)}\n` +
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
                        { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 30 }
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
            portraitKey: this.npcPortraitKey,
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
        createButton(this, width / 2, y, t('💸 Подарить 10 денег'), () => {
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
                { singleton: false, portraitKey: this.npcPortraitKey });
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
        }).setDepth(202);
        y += 35;

        // Подарить деньги (50 д.)
        createButton(this, width / 2, y, t('💸 Подарить 50 денег'), () => {
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
                { singleton: false, portraitKey: this.npcPortraitKey });
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
        }).setDepth(202);
        y += 35;

        // Подарить любой предмет из инвентаря (п.6: ценность = цена × 0.5)
        // Раунд 45 (п.6 заявки — аудит): раньше здесь дублировалась своя
        // таблица цен — единый источник правды теперь импорт из Character.js
        // (WEAPONS/ARMORS), чтобы цены подарков никогда не расходились с
        // кузницей и боевой системой.

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
                        { singleton: false, portraitKey: this.npcPortraitKey });
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
            portraitKey: this.npcPortraitKey,
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
                { singleton: false, portraitKey: this.npcPortraitKey,
                  typing: true, typingSpeed: 30 }
            );
        } else if (result.willAttack) {
            // NPC нападает
            createDialog(this, 'Угроза — нападение!',
                `${result.message}\n(Репутация ${result.repChange > 0 ? '+' : ''}${result.repChange})`,
                [{ text: 'Драться!', callback: () => {
                    // Раунд 40 (QA-фикс): переход в бой — на следующий кадр,
                    // вне стека обработчика клика (иначе зависание цикла Phaser)
                    this.time.delayedCall(0, () => {
                        this.scene.start('Combat', { enemyKeys: ['bandit'], npcId: interior.npcId + '_hostile' });
                    });
                }}],
                { singleton: false, portraitKey: this.npcPortraitKey }
            );
        } else {
            createDialog(this, 'Угроза',
                `${result.message}\n(Репутация ${result.repChange > 0 ? '+' : ''}${result.repChange})`,
                [{ text: 'Понятно', callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey,
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
        // Раунд 44: гендерно-согласованные формулировки (героиня/герой, НПЦ-ж/м)
        const heroIsF = player.gender === 'female';
        const npcIsF = this.npcData && this.npcData.gender === 'female';
        
        if (!check.canMarry) {
            // NPC отказывает
            let message = '';
            if (npcRepValue < npcRepThreshold) {
                message = `${npcName}: «Ты мне хоть и ${heroIsF ? 'люба' : 'люб'}, но я тебя ещё не так хорошо знаю, ` +
                    `чтобы семью создавать. Подожди ещё, наберись опыта в деревне.» ` +
                    `(Нужно личная репутация +${npcRepThreshold}, у вас ${npcRepValue})`;
            } else if (villageRepValue < villageRepThreshold) {
                message = `${npcName}: «Я бы ${npcIsF ? 'рада' : 'рад'}, да староста не благословит. ` +
                    `Ты ещё не ${heroIsF ? 'заслужила' : 'заслужил'} уважение всей деревни.» ` +
                    `(Нужно деревенская репутация +${villageRepThreshold}, у вас ${villageRepValue})`;
            } else if ((player.dengas || 0) < cost) {
                message = `${npcName}: «Свадьба — дело не дешёвое! Нужно ${cost} д. ` +
                    `на свадебное торжество и подарки. А у тебя всего ${player.dengas || 0} д.»`;
            } else if (this.npcData.married) {
                // Раунд 44 (п.7): вежливый отказ чужого мужа/жены
                message = `${npcName}: «Я ${npcIsF ? 'замужем' : 'женат'} — венчан(а) с другим человеком. ` +
                    `Ищи себе пару среди свободных сердец.»`;
            } else {
                message = `${npcName}: «Не могу я ${npcIsF ? 'выйти за тебя' : 'жениться на тебе'}. ${check.reason}.»`;
            }
            
            createDialog(this, 'Сватовство', message, [
                { text: 'Понятно', callback: () => {} },
            ], {
                singleton: false,
                portraitKey: this.npcPortraitKey,
                typing: true, typingSpeed: 30,
            });
            return;
        }
        
        // Условия выполнены — предложение брака
        const proposalText = `Ты ${heroIsF ? 'решила' : 'решил'} свататься: ${npcName}.\n\n` +
            `Условия для свадьбы:\n` +
            `✓ Личная репутация: ${npcRepValue} (нужно +${npcRepThreshold})\n` +
            `✓ Деревенская репутация: ${villageRepValue} (нужно +${villageRepThreshold})\n` +
            `✓ Свадебное торжество: ${cost} д. (у вас ${player.dengas || 0} д.)\n\n` +
            `${npcName} ${npcIsF ? 'согласна' : 'согласен'} принять твоё предложение! Свадьба состоится по обычаям Руси!`;
        
        createDialog(this, '💍 Сватовство', proposalText, [
            {
                text: '💍 Сыграем свадьбу!',
                callback: () => {
                    const result = marry(this.registry, interior.npcId, player);
                    if (result.success) {
                        // Свадьба состоялась — ВЫИГРЫШ
                        const winMessage = `🎉 СВАДЬБА! 🎉\n\n` +
                            `По обычаям Руси, отец Савватий обвенчал вас в церкви. ` +
                            `Вся деревня гуляла три дня на свадебном пиру!\n\n` +
                            `${player.name} и ${result.npcName} теперь — муж и жена.\n` +
                            `${heroIsF ? 'Ты принята в деревню как своя!' : 'Ты принят в деревню как свой!'}\n\n` +
                            `ИГРА УСПЕШНО ЗАВЕРШЕНА!`;
                        
                        createDialog(this, '🎉 СВАДЬБА', winMessage, [
                            {
                                text: '🎉 Финал',
                                callback: () => {
                                    const q = this.registry.get('quest');
                                    q.thiefDefeated = true; // флаг победы для EndScene
                                    q.currentObjective = heroIsF
                                        ? 'Вышла замуж и принята в деревню! Победа!'
                                        : 'Женился и принят в деревню! Победа!';
                                    this.registry.set('quest', q);
                                    this.scene.stop();
                                    this.scene.resume(this.from);
                                    this.scene.getScene(this.from).scene.start('End');
                                },
                            },
                        ], {
                            singleton: false,
                            portraitKey: this.npcPortraitKey,
                            typing: true, typingSpeed: 20,
                        });
                    }
                },
            },
            {
                text: 'Подумать ещё',
                callback: () => {
                    ActionLog.add(this.registry, heroIsF
                        ? `Решила пока не выходить замуж за ${npcName}.`
                        : `Решил пока не жениться на ${npcName}.`);
                },
            },
        ], {
            singleton: false,
            portraitKey: this.npcPortraitKey,
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
            portraitKey: this.npcPortraitKey,
            typing: true, typingSpeed: 30,
        });
        this.updateHUD();
    }

    /**
     * Меню торговли в таверне — покупка еды и питья (п.14).
     */
    showTavernShop() {
        const player = this.registry.get('player');
        // Список товаров с учётом репутации (п.13.2: скидки при высокой репутации).
        // Раунд 22: «Ночлег» убран из лавки — отдых теперь живёт в меню «Отдых»
        // (1 час / 8 часов), чтобы время реально текло, пока герой спит.
        const priceMod = getPriceModifier(this.registry, 'tavernkeeper');
        const items = [
            { id: 'bread', name: 'Хлеб', price: Math.max(1, Math.round(2 * priceMod)), effect: '+2 HP', heal: 2, mpHeal: 0 },
            { id: 'kasha', name: 'Каша', price: Math.max(1, Math.round(5 * priceMod)), effect: '+3 HP', heal: 3, mpHeal: 0 },
            { id: 'mead', name: 'Медовуха', price: Math.max(1, Math.round(4 * priceMod)), effect: '+2 MP', heal: 0, mpHeal: 2 },
            { id: 'kvass', name: 'Квас', price: Math.max(1, Math.round(3 * priceMod)), effect: '+1 MP', heal: 0, mpHeal: 1 },
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
            createButton(this, width / 2, y, `${t(item.name)} — ${item.price} ${t('д.')} (${item.effect})`, () => {
                if (!canAfford) {
                    createDialog(this, 'Таверна', 'Не хватает денег!', [
                        { text: 'Понятно', callback: () => {} },
                    ], { singleton: false, portraitKey: 'portrait_tavernkeeper' });
                    return;
                }
                player.dengas -= item.price;
                this.audioManager.playGoldSpend(); // раунд 24: расплата монетами
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
     * Раунд 22 (п.10/12): ОТДЫХ В ТАВЕРНЕ.
     * - Отдых 1 час (4 д.) — лечение около трети здоровья и Воли;
     * - Ночлег 8 часов (12 д.) — ПОЛНОЕ восстановление здоровья и Воли.
     * (Раунд 23: ваучер «Бесплатный ночлег» убран по просьбе владельца.)
     * Время реально течёт: во время погони за вором сон — дорогое решение.
     */
    showTavernRestMenu(interior) {
        if (this.busyDialog) return;
        const chaseActive = isChaseActive(this.registry);

        const warning = chaseActive
            ? '\n\n' + t('⚠ ВНИМАНИЕ: погоня за вором продолжается! Пока ты спишь, вор уйдёт далеко. Отдых лучше отложить до победы.')
            : '';

        this.busyDialog = true;
        createDialog(this, t('🛏 Отдых в таверне'),
            t('Фёдор вытирает стойку: «Комнатка чистая, сено свежее. Отдохнёшь — силы вернутся.»')
            + warning,
            [
                {
                    text: t('Отдохнуть 1 час (4 д.) — лечение ~1/3'),
                    callback: () => { this.busyDialog = false; this.restInTavern(interior, 1); },
                },
                {
                    text: t('Ночлег 8 часов (12 д.) — полное восстановление'),
                    callback: () => { this.busyDialog = false; this.restInTavern(interior, 8); },
                },
                {
                    text: t('Не сейчас'),
                    callback: () => { this.busyDialog = false; },
                },
            ],
            { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 25 });
    }

    /**
     * Раунд 22: выполнить отдых в таверне (см. showTavernRestMenu).
     * 1 час лечит ~1/3 HP и Воли, 8 часов восстанавливают всё.
     */
    restInTavern(interior, hours) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        const cost = hours >= 8 ? 12 : 4;

        if ((player.dengas || 0) < cost) {
            createDialog(this, t('🛏 Отдых'),
                tf(t('Не хватает денег: нужно {0} д., а у тебя {1}.'), cost, player.dengas || 0),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey });
            return;
        }

        this.busyDialog = true;
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.time.delayedCall(650, () => {
            player.dengas = (player.dengas || 0) - cost;

            // Время реально течёт (8 часов = 32 тика погони!)
            tickTime(this.registry, hours * 60);

            let effectText;
            if (hours >= 8) {
                player.HP = player.HPmax;
                player.MP = player.MPmax;
                effectText = t('Здоровье и Воля восстановлены ПОЛНОСТЬЮ.');
            } else {
                const heal = Math.max(3, Math.round((player.HPmax || 10) * 0.34));
                const mp = Math.max(1, Math.round((player.MPmax || 4) * 0.34));
                player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                player.MP = Math.min(player.MPmax || player.MP + mp, player.MP + mp);
                effectText = tf(t('Здоровье +{0}, Воля +{1}.'), heal, mp);
            }
            this.registry.set('player', player);
            this.updateHUD();
            if (this.audioManager) this.audioManager.playSound('sfx_heal');
            ActionLog.add(this.registry, tf(t('Отдохнул в таверне ({0} ч) за {1} д. {2}'), hours, cost, effectText));
            this.cameras.main.fadeIn(600, 0, 0, 0);

            const end = checkGameEnd(this.registry);
            if (end === 'defeat_thief_escaped') {
                createDialog(this, t('😴 Отдых окончен'),
                    t('Ты выспался, сил — не меряно... но пока ты спал, вор успел скрыться из вида!'),
                    [{ text: t('Итоги похода'), callback: () => this.scene.start('End') }],
                    { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
            } else if (end) {
                this.scene.start('End');
            } else {
                createDialog(this, t('😴 Отдых окончен'),
                    tf(t('Ты провёл в постели {0} ч. {1}'), hours, effectText)
                    + (player && (player.HP >= player.HPmax) ? '\n' + t('Ты полон сил!') : ''),
                    [{ text: t('Встать'), callback: () => { this.busyDialog = false; } }],
                    { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 25 });
            }
        });
    }

    // ============================================================
    // Раунд 40 (заявка владельца): «⏳ Провести время» на постоялом дворе.
    // Владелец: «Морочу время циклами деревня↔околица до утра (по 2 ч за
    // цикл)». Решение: за столом у Фёдора время можно перемотать ЧЕСТНО:
    //   1. Своё — от 1 до 24 часов (цифры с клавиатуры, «−/±» и шаблоны);
    //   2. До утра (6:00);  3. До полудня (12:00);  4. До вечера (16:00).
    // Бесплатно и БЕЗ лечения (лечение — платный «Отдых» и костёр во дворе).
    // Пока герой сидит в горнице, погоня за вором тикает и поручения
    // истекают: перемотка — осознанный выбор, а не чит.
    // ============================================================

    /** «X ч Y мин» из минут (для подписей «через …»). */
    spendHoursLabel(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0 && m > 0) return tf(t('{0} ч {1} мин'), h, m);
        if (h > 0) return tf(t('{0} ч'), h);
        return tf(t('{0} мин'), m);
    }

    /** Минут до ближайшего N:00 (строго в будущем; ровно N:00 — полные сутки). */
    minutesUntilHour(targetHour) {
        const ts = getTime(this.registry);
        const now = ts ? (ts.hour * 60 + ts.minute) : 0;
        let mins = targetHour * 60 - now;
        if (mins <= 0) mins += 24 * 60;
        return mins;
    }

    /** Открыть панель «⏳ Провести время» (кнопка «⏳ Время» в таверне). */
    showSpendTimeMenu() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        this.__spendTimeOpen = true;

        const { width, height } = this.scale;
        const cx = width / 2;
        const top = height / 2 - 240;
        const chaseActive = isChaseActive(this.registry);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = Math.min(560, width - 24);
        const panel = this.add.rectangle(cx, height / 2, panelW, 480, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);
        const ui = [overlay, panel];
        const track = (el) => { ui.push(el); return el; };

        // ----- Статика: заголовок, текущее время, подписи -----
        track(this.add.text(cx, top + 30, t('⏳ Провести время'), {
            fontSize: '20px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202));

        const nowText = track(this.add.text(cx, top + 58, '', {
            fontSize: '13px', color: '#E8DCC4', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202));

        track(this.add.text(cx, top + 80, chaseActive
            ? t('⚠ Погоня за вором продолжается! Каждый час за столом — вор всё дальше.')
            : '', {
            fontSize: '10px', color: '#ff8a6a', wordWrap: { width: panelW - 40 },
        }).setOrigin(0.5).setDepth(202));

        track(this.add.text(cx, top + 108, t('✍️ Своё время (1–24 ч):'), {
            fontSize: '12px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202));

        const hoursText = track(this.add.text(cx, top + 146, '2 ч', {
            fontSize: '26px', color: '#E8DCC4', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202));

        track(this.add.text(cx, top + 172, t('Цифры, Backspace, Enter — или кнопки и шаблоны:'), {
            fontSize: '9px', color: '#8a7a5a',
        }).setOrigin(0.5).setDepth(202));

        // ----- Своё время: переменная, степперы, шаблоны, ввод с клавиатуры -----
        let hours = 2;
        const clampHours = () => { hours = Math.min(24, Math.max(1, Math.round(hours) || 1)); };
        const refreshHours = () => { clampHours(); hoursText.setText(tf(t('{0} ч'), hours)); };
        const bump = (d) => { hours += d; refreshHours(); };

        ui.push(createButton(this, cx - 170, top + 146, t('−1 ч'), () => bump(-1), {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: '#E8DCC4',
            fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 }, cornerRadius: 6,
        }).setDepth(202));
        ui.push(createButton(this, cx + 170, top + 146, t('+1 ч'), () => bump(1), {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: '#E8DCC4',
            fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 }, cornerRadius: 6,
        }).setDepth(202));

        // Шаблоны: 1 2 3 4 6 8 12 24
        const presets = [1, 2, 3, 4, 6, 8, 12, 24];
        const chipGap = Math.min(56, (panelW - 60) / presets.length);
        const startX = cx - ((presets.length - 1) * chipGap) / 2;
        presets.forEach((p, i) => {
            ui.push(createButton(this, startX + i * chipGap, top + 204, String(p), () => { hours = p; refreshHours(); }, {
                backgroundColor: p === 24 ? 0x5a3a2a : 0x3a3a30, hoverColor: 0x4a4a3c,
                textColor: '#E8DCC4', fontSize: 12,
                padding: { left: 6, right: 6, top: 4, bottom: 4 }, cornerRadius: 5,
            }).setDepth(202));
        });

        ui.push(createButton(this, cx, top + 248, t('⏳ Провести это время'), () => confirmSpend(hours * 60), {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: '#E8DCC4',
            fontSize: 15, padding: { left: 18, right: 18, top: 8, bottom: 8 }, cornerRadius: 6,
        }).setDepth(202));

        // ----- «Или сразу»: до утра / до полудня / до вечера -----
        track(this.add.text(cx, top + 288, t('— или сразу —'), {
            fontSize: '11px', color: '#8a7a5a',
        }).setOrigin(0.5).setDepth(202));

        const quickRows = [
            { icon: '🌅', hour: 6, key: '🌅 До утра (в 6:00)', bg: 0x4a3a5a, hover: 0x5a4a6a },
            { icon: '☀️', hour: 12, key: '☀️ До полудня (в 12:00)', bg: 0x4a4a2a, hover: 0x5a5a3a },
            { icon: '🌇', hour: 16, key: '🌇 До вечера (в 16:00)', bg: 0x4a2a2a, hover: 0x5a3a3a },
        ];
        const inLabel = [];
        quickRows.forEach((row, i) => {
            const y = top + 320 + i * 38;
            ui.push(createButton(this, cx - 90, y, t(row.key), () => confirmSpend(this.minutesUntilHour(row.hour)), {
                backgroundColor: row.bg, hoverColor: row.hover, textColor: '#E8DCC4',
                fontSize: 12, padding: { left: 12, right: 12, top: 7, bottom: 7 }, cornerRadius: 6,
            }).setDepth(202));
            const lbl = track(this.add.text(cx + 120, y, '', {
                fontSize: '11px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
            }).setOrigin(0, 0.5).setDepth(202));
            inLabel.push({ hour: row.hour, lbl });
        });

        ui.push(createButton(this, cx, top + 444, t('Закрыть'), () => closeMenu(), {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: '#E8DCC4',
            fontSize: 14, padding: { left: 20, right: 20, top: 8, bottom: 8 }, cornerRadius: 6,
        }).setDepth(202));

        // ----- Живая строка «Сейчас: …» и durations «через …» (часы идут!) -----
        const refreshLive = () => {
            const ts = getTime(this.registry);
            if (!ts) return;
            const hhmm = `${String(ts.hour).padStart(2, '0')}:${String(ts.minute).padStart(2, '0')}`;
            nowText.setText(tf(t('Сейчас: {0} · {1}'), hhmm, formatTime(ts)));
            inLabel.forEach(({ hour, lbl }) => lbl.setText(tf(t('через {0}'), this.spendHoursLabel(this.minutesUntilHour(hour)))));
        };
        refreshLive();
        const liveTimer = this.time.addEvent({ delay: 1000, loop: true, callback: refreshLive });

        // ----- Ввод с клавиатуры: цифры / Backspace / Enter / Escape -----
        const keyHandler = (e) => {
            if (e.key >= '0' && e.key <= '9') {
                hours = Math.min(24, hours * 10 + Number(e.key));
                refreshHours();
            } else if (e.key === 'Backspace') {
                hours = Math.max(1, Math.floor(hours / 10));
                refreshHours();
            } else if (e.key === 'Enter') {
                clampHours();
                confirmSpend(hours * 60);
            } else if (e.key === 'Escape') {
                closeMenu();
            }
        };
        this.input.keyboard.on('keydown', keyHandler);
        this.events.once('shutdown', () => {
            try { this.input.keyboard.off('keydown', keyHandler); } catch (err) { /* сцена уже снята */ }
            liveTimer && liveTimer.remove();
        });

        // ----- Закрытие панели -----
        function closeMenu() {
            if (selfInput && selfInput.keyboard) selfInput.keyboard.off('keydown', keyHandler);
            liveTimer && liveTimer.remove();
            sceneRef.__spendTimeOpen = false;
            sceneRef.busyDialog = false;
            ui.forEach(c => c && c.destroy && c.destroy());
        }
        const sceneRef = this;
        const selfInput = this.input;

        // ----- Применить перемотку -----
        function confirmSpend(minutes) {
            if (!minutes || minutes <= 0) return;
            closeMenu();
            sceneRef.busyDialog = true;
            sceneRef.cameras.main.fadeOut(500, 0, 0, 0);
            sceneRef.time.delayedCall(550, () => {
                // Время реально течёт: вор делает шаги, поручения тикают
                tickTime(sceneRef.registry, minutes);
                sceneRef.updateHUD();
                ActionLog.add(sceneRef.registry, tf(t('Провёл время на постоялом дворе ({0}).'), sceneRef.spendHoursLabel(minutes)));
                sceneRef.cameras.main.fadeIn(500, 0, 0, 0);

                const end = checkGameEnd(sceneRef.registry);
                if (end === 'defeat_thief_escaped') {
                    createDialog(sceneRef, t('⏳ Время прошло'),
                        t('Ты посидел за столом у Фёдора... но пока время шло, вор успел скрыться из вида!'),
                        [{ text: t('Итоги похода'), callback: () => sceneRef.scene.start('End') }],
                        { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
                } else if (end) {
                    sceneRef.scene.start('End');
                } else {
                    const ts = getTime(sceneRef.registry);
                    const hhmm = ts ? `${String(ts.hour).padStart(2, '0')}:${String(ts.minute).padStart(2, '0')}` : '';
                    createDialog(sceneRef, t('⏳ Время прошло'),
                        tf(t('Ты провёл за столом в горнице {0}. Сейчас {1}, {2}.'),
                            sceneRef.spendHoursLabel(minutes), hhmm, ts ? formatTime(ts) : '')
                        + '\n' + t('Сил это не вернуло — для лечения есть платный «Отдых» (1 ч / 8 ч) и костёр во дворе.'),
                        [{ text: t('Понятно'), callback: () => { sceneRef.busyDialog = false; } }],
                        { singleton: false, portraitKey: sceneRef.npcPortraitKey, typing: true, typingSpeed: 25 });
                }
            });
        }
    }

    /**
     * Меню торговли у кузнеца — покупка оружия и доспехов (п.15).
     * Раунд 45 (пп.6,7э заявки): аудит и уложения Судебника —
     *  • при репутации ≤ −50 кузнец отказывается торговать вовсе;
     *  • цены покупок — с репутационной скидкой/наценкой (getPriceModifier);
     *  • «воинское» снаряжение (сабля, стальной меч, кольчуга, зерцальный
     *    доспех) — только совершеннолетним с доброй славой;
     *  • вкладка «Продать» — продажа снаряжения за полцены (урок о
     *    честной торговле: перекупка не приносит прибыли).
     */
    showBlacksmithShop(tab = 'weapon') {
        const player = this.registry.get('player');
        const { width, height } = this.scale;

        // 7э: отказ от торговли при дурной славе (репутация ≤ −50)
        if (willNpcRefuseTrade(this.registry, 'blacksmith')) {
            ActionLog.add(this.registry, 'Кузнец Данила отказался торговаться с героем дурной славы (репутация ≤ −50).');
            createDialog(this, t('Кузница'),
                t('Кузнец Данила откладывает молот и крестит руки на груди:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»'),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: 'portrait_blacksmith' });
            return;
        }

        // Подложка
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 600, panelH = 480;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        const closeMenu = () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        };

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
        const mkTab = (x, label, key) => createButton(this, x, height / 2 - panelH / 2 + 100, t(label), () => {
            closeMenu();
            this.showBlacksmithShop(key);
        }, {
            backgroundColor: tab === key ? RUS.accent : 0x4a3520,
            hoverColor: tab === key ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 14, right: 14, top: 6, bottom: 6 },
        }).setDepth(202);
        mkTab(width / 2 - 150, 'Оружие', 'weapon');
        mkTab(width / 2, 'Доспехи', 'armor');
        mkTab(width / 2 + 150, 'Продать', 'sell');

        // Список товаров
        const startY = height / 2 - panelH / 2 + 150;
        const priceMod = getPriceModifier(this.registry, 'blacksmith');
        const modNote = priceMod < 1 ? t(' (скидка за добрую славу)') : (priceMod > 1 ? t(' (наценка за дурную славу)') : '');

        if (tab === 'sell') {
            // ===== ВКЛАДКА «ПРОДАТЬ» (раунд 45, п.7э) =====
            // Урок Судебника о честной торговле: кузнец берёт снаряжение
            // за полцены — перекупкой герою не нажиться.
            const sellables = (player.inventory || []).filter(it =>
                it && (it.type === 'weapon' || it.type === 'armor') && (it.count || 0) > 0
                && it.id !== player.weaponId && it.id !== player.armorId);
            this.add.text(width / 2, startY - 20, t('Продать можно лишь то, что не надето на тебя (полцены):'), {
                fontSize: '12px', color: RUS.textDim,
            }).setOrigin(0.5).setDepth(202);
            if (sellables.length === 0) {
                this.add.text(width / 2, startY + 40, t('В узле нечего продать — всё надето или пусто.'), {
                    fontSize: '14px', color: RUS.textDim,
                }).setOrigin(0.5).setDepth(202);
            }
            sellables.forEach((item, i) => {
                const y = startY + 20 + i * 42;
                const base = (WEAPONS[item.id] && WEAPONS[item.id].price)
                    || (ARMORS[item.id] && ARMORS[item.id].price) || 10;
                const sellPrice = Math.max(1, Math.floor(base / 2));
                const label = `💰 ${item.name} — ${sellPrice} д. (полцены)`;
                createButton(this, width / 2, y, label, () => {
                    item.count -= 1;
                    if (item.count <= 0) {
                        player.inventory = player.inventory.filter(x => x !== item);
                    }
                    player.dengas = (player.dengas || 0) + sellPrice;
                    this.registry.set('player', player);
                    if (this.audioManager) this.audioManager.playGoldReceive();
                    ActionLog.add(this.registry, `Продал «${item.name}» кузнецу за ${sellPrice} д. (полцены, урок Судебника о честной торговле).`);
                    this.updateHUD();
                    closeMenu();
                    this.showBlacksmithShop('sell');
                }, {
                    backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a,
                    textColor: RUS.text, fontSize: 13,
                    padding: { left: 14, right: 14, top: 7, bottom: 7 },
                }).setDepth(202);
            });
        } else {
            const items = tab === 'weapon'
                ? Object.values(WEAPONS).filter(w => w.id !== 'fists')
                : Object.values(ARMORS).filter(a => a.id !== 'none');

            items.forEach((item, i) => {
                const y = startY + i * 42;
                const price = Math.max(1, Math.round((item.price || 0) * priceMod));
                const canAfford = (player.dengas || 0) >= price;
                // 7э: сословные рамки — «воинское» снаряжение не всякому
                const isMilitary = MILITARY_GEAR_IDS.has(item.id);
                const gearCheck = isMilitary ? canBuyMilitaryGear(this.registry, player) : { ok: true };
                const allowed = canAfford && gearCheck.ok;
                const lockNote = isMilitary ? (gearCheck.ok ? t(' 🔒 воинское') : t(' 🔒')) : '';
                const desc = tab === 'weapon'
                    ? `${item.name} — ${price} д.${modNote} (урон ${item.dice.min}-${item.dice.max}+${item.bonus || 0})${lockNote}`
                    : `${item.name} — ${price} д.${modNote} (защита ${item.def})${lockNote}`;
                createButton(this, width / 2, y, desc, () => {
                    if (isMilitary && !gearCheck.ok) {
                        createDialog(this, t('Кузница'), tf(t('Кузнец Данила качает головой: «{0}.»'), gearCheck.reason), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: 'portrait_blacksmith' });
                        return;
                    }
                    if (!canAfford) {
                        createDialog(this, t('Кузница'), t('Не хватает денег!'), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: 'portrait_blacksmith' });
                        return;
                    }
                    player.dengas -= price;
                    this.audioManager.playGoldSpend(); // раунд 24: расплата монетами
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
                    ActionLog.add(this.registry, `Купил «${item.name}» у кузнеца за ${price} д.${isMilitary ? t(' (воинское снаряжение, по уложению Судебника)') : ''}`);
                    this.updateHUD();
                    closeMenu();
                    this.showBlacksmithShop(tab);
                }, {
                    backgroundColor: allowed ? 0x3a5a3a : 0x3a3a3a,
                    hoverColor: allowed ? 0x4a6a4a : 0x4a4a4a,
                    textColor: allowed ? RUS.text : '#888',
                    fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
                }).setDepth(202);
            });
        }

        // Кнопка закрытия
        createButton(this, width / 2, height / 2 + panelH / 2 - 30, 'Закрыть', () => {
            closeMenu();
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    // ================================================================
    // Раунд 26 (быв. часовня, раунд 9): церковь — богомолье, пожертвования,
    // осмотр места кражи. Часовня удалена из деревни — всё живёт здесь.
    // ================================================================

    // Ключ игрового дня (для «раз в день»-ограничений)
    dayKey() {
        const t = getTime(this.registry);
        return t ? `${t.yearFromChrist}-${t.month}-${t.day}` : 'unknown';
    }

    /**
     * Раунд 40: свиток персонажа поверх помещения (раньше — только у кузнеца).
     * Кнопка постоянная вверху справа; метод сохранён для обратной совместимости.
     */
    openCharacterSheet() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        ActionLog.add(this.registry, 'Осмотрел себя у кузнеца (свиток персонажа).');
        this.scene.pause();
        this.scene.launch('Character', { from: 'Interior', tab: 'inventory' });
    }

    /**
     * Молитва в церкви: +Воля (MP), один раз в игровой день.
     * Забирает 15 минут времени.
     */
    prayInChurch() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        tickTime(this.registry, 15);

        const q = this.registry.get('quest') || {};
        const today = this.dayKey();
        if (q.prayerDay === today) {
            ActionLog.add(this.registry, 'Помолился в церкви (уже молился сегодня).');
            createDialog(this, 'Молитва', 'Ты снова стоишь перед киотом. Сердце уже нашло покой сегодня — больше не нужно.', [
                { text: 'Аминь.', callback: () => {} },
            ]);
            return;
        }
        q.prayerDay = today;
        this.registry.set('quest', q);

        const gain = Phaser.Math.Between(3, 8);
        player.MP = Math.min(player.MPmax || player.MP + gain, player.MP + gain);
        this.registry.set('player', player);
        this.audioManager.playPrayerChant(); // раунд 24: тихая молитва
        this.updateHUD();
        ActionLog.add(this.registry, `Помолился в церкви — Воля +${gain}.`);

        createDialog(this, 'Молитва',
            'Ты опускаешься на колени перед киотом. В полумраке церкви, под мерцание лампад, приходит покой.\n\nВоля восстановлена: +' + gain + '.',
            [{ text: 'Встать с колен.', callback: () => {} }]);
    }

    /**
     * Пожертвование на свечи и ладан: −5 д., +1 к репутации в деревне.
     * Не чаще одного раза в игровой день.
     */
    donateInChurch() {
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
        const res = changeVillageRep(this.registry, 1, 'Пожертвование в церкви');
        tickTime(this.registry, 10);
        this.updateHUD();
        ActionLog.add(this.registry, 'Пожертвовал 5 д. в церкви — деревня это помнит (+1 репутация).');

        createDialog(this, 'Пожертвование',
            'Ты кладёшь пять денег на блюдо у входа. «На свечи и ладан», — говоришь тихо. Казначей церкви будет рад.\n\n' +
            (res && res.message ? res.message : 'Репутация в деревне +1.'),
            [{ text: 'Низко поклониться иконам.', callback: () => {} }]);
    }

    /**
     * Осмотр киота: уникальная улика по делу о краже (один раз за игру).
     * Раунд 26: киот теперь в церкви (часовня удалена). Для старых сохранений
     * читается и прежний флаг chapelInspected.
     */
    inspectChurchKiot() {
        if (this.busyDialog) return;
        const q = this.registry.get('quest') || {};
        tickTime(this.registry, 10);

        if (q.kiotInspected || q.chapelInspected) {
            createDialog(this, 'Пустой киот', 'Больше тут ничего не изменилось: ниша без иконы, воск на полу, верёвка.', [
                { text: 'Уйти от киота.', callback: () => {} },
            ]);
            return;
        }
        q.kiotInspected = true;
        if (!q.cluesGathered) q.cluesGathered = [];
        const clue = 'На полу церкви — капли стеарина и обрывок пеньковой верёвки с двумя узлами. Икону несли бережно, вдвоём, и накануне в церкви горела свеча.';
        q.cluesGathered.push({ npcId: 'church', npcName: 'Церковь', clue });
        this.registry.set('quest', q);
        ActionLog.add(this.registry, 'Осмотрел киот в церкви — нашёл улику (воск, верёвка с узлами).');

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
    /**
     * Раунд 37 (п.4): единый масштаб по возрасту в интерьерах.
     * Взрослый — 1.0 (базовый 2.5, как игрок), подросток — 0.85, ребёнок — 0.7.
     */
    interiorAgeScale(npcData) {
        const age = (npcData && npcData.age) || 30;
        if (age <= 12) return 0.7;
        if (age <= 17) return 0.85;
        return ((npcData && npcData.look && npcData.look.scale) || 1);
    }

    workInPotter() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;

        if ((player.HP || 0) <= 5) {
            createDialog(this, 'Силы кончились', 'Руки не поднимаются таскать дрова и мять глину. Нужно поесть и отдохнуть, прежде чем браться за работу.', [
                { text: 'Справедливо...', callback: () => {} },
            ]);
            return;
        }
        tickTime(this.registry, 60);
        player.HP = Math.max(1, (player.HP || 1) - 3);
        const wage = Phaser.Math.Between(3, 6);
        let bonus = 0;
        let bonusMsg = '';
        if (Math.random() < 0.15) {
            bonus = Phaser.Math.Between(2, 4);
            bonusMsg = '\n\nВ углу мастерской блеснула чужая монетка — видать, обронил кто-то из заказчиков. Она твоя: +' + bonus + ' д.';
        }
        player.dengas = (player.dengas || 0) + wage + bonus;
        this.registry.set('player', player);
        this.updateHUD();
        ActionLog.add(this.registry, `Отработал час в гончарной мастерской: +${wage + bonus} д., усталость −3 HP.`);

        createDialog(this, 'Помощь в мастерской',
            'Час у круга и печи: носил дрова, мешал глину, ставил горшки на обжиг. Игнат доволен: «Работник, что надо!»\n\n' +
            'Заработано: +' + wage + ' д. Усталость: −3 здоровья.' + bonusMsg,
            [
                { text: t('Спасибо'), callback: () => {} },
            ]);
    }

    workInBarn() {
        // Раунд 37: амбар удалён (п.18) — работа переехала в мастерскую гончара
        // (workInPotter). Метод оставлен для старых сейвов/ссылок.
        this.workInPotter();
    }

    inspectBarnGrain() {
        // Раунд 37: зерно амбара больше не осматривается — амбара нет (п.18).
        createDialog(this, 'Мастерская',
            'Гончарного зерна тут нет — только глина, дрова и ряды горшков на просушке.',
            [
                { text: t('Понятно'), callback: () => {} },
            ]);
    }

    /**
     * Осмотр зерна: атмосферная деталь + редкий съедобный бонус.
     * Раунд 37: амбар удалён (п.18) — заглушка (зерно переехало в ригу/мастерскую).
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
            extra = '\n\nВ углу мастерской нашлась горсть сушёных яблок — Игнат не обидится. +2 здоровья.';
            ActionLog.add(this.registry, 'Подкрепился сушёными яблоками в мастерской: +2 HP.');
        }
        const mice = ['мышь-хвостунья черкнула за мешками глины', 'воробей вылетел в слуховое окно', 'кот-невидимка оставил следы на просушке'];
        createDialog(this, 'Осмотр мастерской',
            'Всё при деле: глина вымешена, горшки на просушке, дрова в поленнице. Пахнет печным жаром.\n\n' +
            'Мимо ' + mice[Phaser.Math.Between(0, mice.length - 1)] + '.' + extra,
            [{ text: 'Довольно.', callback: () => {} }]);
    }

    /**
     * П.5 (4-й раз!): Пол и стены рисуем НАДЁЖНО — сначала заливаем прямоугольниками
     * коричневый фон, потом поверх — тайлы 32×32. Это исключает любую «зелёную сетку».
     *
     * РАУНД 39 (п.10 заявки): ЖИВОПИСНЫЕ БЭКГРАУНДЫ DarklandsReborn УДАЛЕНЫ —
     * все интерьеры (таверна, кузница, церковь, дома) рисуются ЕДИНОЙ тайловой
     * графикой (wall_wood + floor_wood + окна + декор), как остальные дома.
     * Рисунки bg_* отличались по стилю от браузерной игры — больше не используются.
     */
    addDecorations(interior) {
        const { width, height } = this.scale;
        const decor = interior.decor || [];
        const ts = 32;
        // Раунд 39: painted-ветка удалена — ВСЕ интерьеры тайловые (единая рисовка)
        const painted = false;

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
        // (в «живописных» интерьерах не нужна — фон уже нарисован)
        if (!painted) {
            const floorGfx = this.add.graphics().setDepth(-5);
            floorGfx.fillStyle(0x3a2616, 1);  // тёмно-коричневый
            floorGfx.fillRect(0, 100, width, height - 100);
            // === ПОДЛОЖКА СТЕН — более светлый коричневый на верхнюю часть ===
            floorGfx.fillStyle(0x5a3a22, 1);
            floorGfx.fillRect(0, 0, width, 100);
        }

        // === Тайлы пола (если загружены) — поверх подложки ===
        if (!painted && this.textures.exists('int_floor_0')) {
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
        if (!painted && this.textures.exists('int_wall')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 0; y < 100; y += ts) {
                    this.add.image(x + ts / 2, y + ts / 2, 'int_wall')
                        .setOrigin(0.5).setDepth(-4);
                }
            }
        }
        // === Окна (2 шт) с дневным светом и ночным синим стеклом ===
        // x = 62% и 84% — свободная зона стены (левее описание, в центре дата)
        // Раунд 17: столбы света «дышат» и тускнеют в непогоду, в лучах
        // кружится золотая пыль, на подоконнике — цветочный горшок,
        // ночью из окна льётся слабый лунный столб.
        if (!painted && this.textures.exists('int_window')) {
            const winY = 50;
            const weather = getWeather(this.registry);
            const gloomy = !!(weather && (weather.id === 'rain' || weather.id === 'thunder' || weather.id === 'snow'));
            const sunK = (gloomy ? 0.5 : 1) * daylight;
            [width * 0.62, width * 0.84].forEach(wx => {
                const win = this.add.image(wx, winY, 'int_window').setScale(2).setDepth(-3);
                // Ночью стекло темнеет и синеет
                if (dark > 0.15) {
                    const c = Phaser.Display.Color.IntegerToColor(0xffffff);
                    const n = Phaser.Display.Color.IntegerToColor(0x3d4f73);
                    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(c, n, 100, Math.min(100, dark * 100));
                    win.setTint(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
                }
                // Форма столба света на пол (трапеция от подоконника вниз)
                const shaftPts = [
                    { x: wx - 30, y: winY + 18 },
                    { x: wx + 30, y: winY + 18 },
                    { x: wx + 74, y: height - 96 },
                    { x: wx - 6, y: height - 96 },
                ];
                // Дневной столб света из окна на пол (ADD) — гаснет к ночи и в непогоду
                if (sunK > 0.05) {
                    const shaft = this.add.graphics().setDepth(-2);
                    shaft.fillStyle(0xfff0c0, 0.16 * sunK);
                    shaft.fillPoints(shaftPts, true);
                    shaft.setBlendMode(Phaser.BlendModes.ADD);
                    // «Дыхание» дневного света — окно живое
                    this.tweens.add({
                        targets: shaft,
                        alpha: { from: 0.72, to: 1 },
                        duration: 3400,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                    });
                    // Золотая пыль, кружащаяся в столбе света
                    if (this.textures.exists('particle_spark')) {
                        const dust = this.add.particles(0, 0, 'particle_spark', {
                            x: { min: wx - 28, max: wx + 62 },
                            y: { min: winY + 22, max: height - 100 },
                            lifespan: 5200,
                            speedY: { min: -6, max: 14 },
                            speedX: { min: -5, max: 5 },
                            scale: { min: 0.12, max: 0.32 },
                            alpha: { start: 0.5 * sunK, end: 0 },
                            quantity: 1,
                            frequency: 700,
                            tint: 0xffe9a0,
                        }).setDepth(-1).setBlendMode(Phaser.BlendModes.ADD);
                        dust.setAlpha(sunK);
                    }
                }
                // Лунный столб ночью — слабый холодный свет из окна
                if (dark > 0.5) {
                    const moon = this.add.graphics().setDepth(-2);
                    moon.fillStyle(0x9fb4d8, 0.055 * dark);
                    moon.fillPoints(shaftPts, true);
                    moon.setBlendMode(Phaser.BlendModes.ADD);
                }
                // Цветочный горшок на подоконнике (маленький живой штрих)
                const pot = this.add.graphics().setDepth(-2);
                pot.fillStyle(0x7a4a28, 1);                     // горшок (шире сверху)
                pot.fillPoints([
                    { x: wx - 7, y: winY + 14 },
                    { x: wx + 7, y: winY + 14 },
                    { x: wx + 5, y: winY + 22 },
                    { x: wx - 5, y: winY + 22 },
                ], true);
                pot.fillStyle(0x5f3a20, 1);                     // ободок
                pot.fillRect(wx - 7, winY + 14, 14, 2);
                pot.fillStyle(0x3f6a2e, 1);                     // зелень
                pot.fillRect(wx - 3, winY + 9, 2, 5);
                pot.fillRect(wx + 1, winY + 10, 2, 4);
                pot.fillStyle(0xd884a0, 1);                     // цветок
                pot.fillCircle(wx - 2, winY + 8, 2);
                pot.fillCircle(wx + 2, winY + 9, 1.6);
            });
        }

        if (interior.id === 'tavern' && !painted) {
            // Таверна: барная стойка, бочки, камин, столы, скамьи, сундук
            // (в «живописной» таверне весь декор уже в фоне — пиксельные стенд-ины убраны)
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
            // Раунд 39 (п.13): сундук у входа УДАЛЕН (все сундуки/тюки/ларцы — из игры)
        } else if (interior.id === 'blacksmith' && !painted) {
            // Кузница: наковальня, горн, поленница, оружие, сундук
            // (в «живописной» кузнице весь декор уже в фоне)
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
            // Раунд 39 (п.13): сундук с готовой продукцией УДАЛЕН
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
            // Раунд 39 (п.13): сундук с документами УДАЛЕН
        } else if (interior.id === 'potter_house') {
            // Раунд 37 (вариант Б): мастерская гончара — круг, горшки, дрова
            if (this.textures.exists('int_deco_barrel')) {
                this.add.image(width * 0.2, height * 0.42, 'int_deco_barrel').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_deco_sacks')) {
                this.add.image(width * 0.78, height * 0.62, 'int_deco_sacks').setScale(1.1).setDepth(5);
            }
            if (this.textures.exists('int_deco_shelf')) {
                this.add.image(width * 0.5, height * 0.3, 'int_deco_shelf').setScale(1.2).setDepth(5);
            }
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
        } else if (interior.id === 'church') {
            // Церковь (раунд 26): сюда переехал сюжет часовни — ПУСТОЙ киот,
            // место кражи иконы (осмотр даёт улику). Киот рисуем и в живописном,
            // и в тайловом виде — это сюжетная точка. Правый верхний угол,
            // чтобы не перекрывать батюшку (0.65, 0.55) и игрока (0.25, 0.55).
            const kiot = this.add.graphics().setDepth(4);
            const kx = width * 0.86, ky = height * 0.27;
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
            if (!painted) {
                // Тайловый вид: алтарь, иконостас, свечи, аналой, крест
                // (в «живописной» церкви иконостас/алтарь/окна уже в фоне)
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
                // Красный угол с лампадой — единственный огонёк после кражи
                // (слева, чтобы не спорить с киотом в правом верхнем углу)
                this.addRedCorner(64, height * 0.3, true);
            }
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

        // === Фаза 1: виньетка по краям экрана — текст HUD/описания читается
        // на любом фоне (в «живописных» интерьерах — сильнее) ===
        if (this.textures.exists('vignette_soft')) {
            this.add.image(0, 0, 'vignette_soft')
                .setOrigin(0, 0).setDisplaySize(width, height)
                .setScrollFactor(0).setDepth(48)
                .setAlpha(painted ? 0.95 : 0.85);
        }
    }

    /**
     * Красный угол — передний (восточный) угол избы с иконами:
     * доска-киот, божница, вышитое полотенце (рукавичник) и мерцающая лампада.
     * withNiche — усиленный вариант (дополнительная божница).
     */
    addRedCorner(x, y, withNiche = false) {
        // Доска-киот под иконами
        this.add.rectangle(x, y - 10, 66, 50, 0x4a2f18, 1)
            .setStrokeStyle(2, 0x2a1a08).setDepth(4);
        if (this.textures.exists('int_deco_icon_wall')) {
            this.add.image(x, y - 12, 'int_deco_icon_wall').setScale(0.6).setDepth(5);
        }
        if (withNiche && this.textures.exists('int_deco_icon_wall')) {
            // вторая икона рядом (усиленный красный угол)
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

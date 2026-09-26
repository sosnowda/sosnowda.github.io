// Сцена интерьера здания (таверна, кузница, дома жителей, дом старосты, церковь).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
// Раунд 66.9 (CraftSounds): процедурные звуки ремёсел — молот/прялка/таверна
import { attachCraftAudio } from '../systems/CraftAudio.js';
import SaveManager from '../systems/SaveManager.js';
import { createButton, createDialog, bindRestartOnResize, addSceneMenuButtons, closeAllSingletonDialogs } from '../utils/ui.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd, askMoneyForHelp, askElderAdvance, isChaseActive } from '../data/thief.js';
import { ARMORS, WEAPONS, formatMoney, equipWeapon, equipArmor } from '../systems/Character.js';
// Раунд 66.28 (пп.9,12): стрелы в продажу — пачки по 10, слот колчана
import { addArrowsToInventory, getQuiver, countInventoryArrows, ARROW_PACK_PRICE, ARROW_PACK_SIZE, QUIVER_CAP } from '../systems/ammo.js';
import { makeQuestOffer, acceptQuest, getActiveQuests, grantQuestRewards, checkQuestCompletion, onLocationVisited } from '../data/questGenerator.js';
// Раунд 66.21 (приказ 10): срочное ночное дело (стук в дверь)
import { hasUrgentQuestBusiness } from '../systems/NightKnock.js';
// Раунд 66.21 (приказы 13-14): пожертвование церкви (меню сумм)
import { showDonationMenu } from '../systems/ChurchDonation.js';
import { getTime, formatTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
import { getWeather } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';
import { findNpc, meetNpc, getNpcDisplayName, getNpcShortName, getNpcs, getNpcFallbackName } from '../data/npcNames.js';
import { buildNpcLookTextures, npcVariantKey, npcPortraitVariantKey } from '../systems/NpcLook.js';
import { ensureNpcLpcTexture } from '../systems/NpcLpc.js';
import { getPresence, PLACE_NAMES, getNpcsAtPlace, NPC_DIALOGUE, ALL_NPC_IDS, pickOutdoorLine } from '../data/npcPresence.js';
import {
    checkNpcWillingToTalk, getNpcRep, getReputationLevel,
    applyGiftBonus, applyCompliment, applyTreatEveryoneBonus,
    applyQuestCompleteBonus, applyThreat, willNpcAttack, willNpcRefuseTrade,
    getPriceModifier, getRewardModifier,
    canMarry, marry, getMarriageCost, getMarriageNpcRepThreshold, getMarriageVillageRepThreshold, getAgeOfMajority,
    getVillageRep, changeVillageRep,
    isNpcKilled, canBuyMilitaryGear, MILITARY_GEAR_IDS,
    getSmithNpcId, // Раунд 46 (п.1): ученик кузнеца встаёт к горну после гибели мастера
    repActionAllowedToday, markRepActionDone, // 66.21/66.22: дневной лимит похвалы (угрозы не лимитируются)
} from '../data/reputation.js';
import { getNpcSchedule, getNpcActivity } from '../data/npcSchedules.js';
// Раунд 48 (пп.2,3 заявки): параметры НПЦ игроку НЕ показываются —
// в информации о жителе видно только во что он одет и что держит в руках
import { getNpcWornLine } from '../data/characters.js';
// Раунд 39 (п.13): STASHES/тюки/сундуки/ларцы удалены из игры целиком
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine } from '../systems/WorldClock.js';
// Раунд 66.16 (приказы 1–4): единые правила еды и сна (кукдауны, поп-апы)
// Раунд 66.17: пропорциональный отдых (8 ч = 100%), минимальный сон 2 часа
import { MEAL_HEAL_HP, MEAL_DURATION_MIN, canEat, registerMeal, canSleep, registerSleep, showMealBlockedPopup, showSleepBlockedPopup, restHealPct, SLEEP_MIN_MIN } from '../systems/meal.js';
// Раунд 66.17 (п.5): ПРОДАЖА ДОБЫЧИ — трактирщик берёт рыбу/дичь на кухню
import { sellableLoot, removeItem } from '../systems/loot.js';
// Раунд 66.17 (п.6): ставка подёнки — +1 к славе за отработанный день
import { dayKeyOf } from '../data/daily.js';

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
        // Раунд 66.26 (приказ 3): в ЦЕРКВИ фон — перспективная горница (стена
        // уходит до ~0.58H), и персонажи на 0.55H «висели в воздухе» на стене.
        // Спавн — на видимом полу (0.64H); в остальных интерьерах вид сверху —
        // пол начинается у верхнего края, прежняя высота корректна.
        const spawnY = this.interiorId === 'church' ? height * 0.64 : height * 0.55;
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
                // Раунд 66.10: строка о сундуках/тайниках удалена (механика вырезана по приказу владельца)
                t('🏠 Разговор с хозяином дома занимает 1 игровой час —\nвыбирай, с кем и о чём говорить.\n◀ Выход — кнопка внизу.'),
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

        let interior = INTERIORS[this.interiorId];
        if (!interior) {
            console.error('Interior not found:', this.interiorId);
            this.scene.start(this.from);
            return;
        }
        // Раунд 46 (п.1 заявки): если кузнец убит героем — в кузнице стоит
        // его УЧЕНИК (делает всё то же самое: торговля, разговор, наводки).
        // Если убиты оба — кузница пустует («тишина»).
        if (interior.id === 'blacksmith') {
            const smithId = getSmithNpcId(this.registry);
            if (smithId && smithId !== interior.npcId) {
                const app = findNpc(this.registry, smithId);
                interior = {
                    ...interior,
                    npcId: smithId,
                    npcName: app ? app.name : t('Ученик кузнеца'),
                    portrait: 'portrait_peasant',
                    dialogueId: 'apprentice',
                };
            }
        }
        // Раунд 46 (п.6 заявки): если ХОЗЯИН убит, но его ВДОВА жива —
        // вдова становится хозяйкой дома: с ней можно говорить, дарить
        // подарки, хвалить и СВАТАТЬСЯ (полный набор кнопок вместо «тишины»).
        if (interior.secondaryNpcId
            && isNpcKilled(this.registry, interior.npcId)
            && !isNpcKilled(this.registry, interior.secondaryNpcId)) {
            const widow = findNpc(this.registry, interior.secondaryNpcId);
            if (widow && widow.widowed) {
                interior = {
                    ...interior,
                    npcId: interior.secondaryNpcId,
                    npcName: widow.name,
                    portrait: interior.secondaryPortrait || interior.portrait,
                    dialogueId: interior.secondaryDialogueId || interior.dialogueId,
                    secondaryNpcId: null, // вторая фигура больше не нужна — она теперь хозяин
                };
            }
        }
        this.interior = interior;

        // Раунд 66.9 (CraftSounds): звуки ремёсел по интерьеру — молот
        // кузнеца (пустая кузница молчит: громкость 0 без мастера/ученика),
        // жужжание прялки (ткачиха, вдова Марфы), гул таверны поверх трека.
        attachCraftAudio(this, this.interiorId, {
            volume: this.interiorId === 'blacksmith' && !getSmithNpcId(this.registry)
                ? 0 : undefined,
        });

        // Раунд 21: вход в дом занимает время — вор тоже двигается.
        // До рисования HUD, чтобы дата/время уже были с учётом входа.
        // Раунд 58 (п.1 приказа): вход в дом — 10 минут (было 15 минут).
        tickTime(this.registry, 10);
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
        // ФИКС аудита UI (мобильный): длинные названия («Церковь Рождества
        // Богородицы») при 24px не влезали в 390px и наезжали на компактную
        // HUD-кнопку «📜» — перенос по ширине и сдвиг под кнопку на узком экране
        const narrowInterior = width < 640;
        this.add.text(width / 2, narrowInterior ? 36 : 20, interior.name, {
            fontSize: narrowInterior ? '18px' : '24px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
            align: 'center',
            wordWrap: { width: width - 60 },
        }).setOrigin(0.5, 0).setDepth(50);

        // ----- Описание интерьера -----
        // Раунд 9: перенос по ширине 42% — длинные описания не наезжают на окна
        // ФИКС аудита UI (мобильный): описание сдвинуто под двухстрочный заголовок
        this.add.text(20, narrowInterior ? 92 : 60, interior.description, {
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
            this.npcSprite = this.add.sprite(width * 0.65, spawnY, finalSpriteKey).setScale(this.npcBaseScale).setDepth(5);
            // Раунд 37 (п.21): тавернщик ЗА СТОЙКОЙ (инт. 'tavern').
            // 66.29: в bg стойка — окошко выдачи у стены (320..430, 60..180);
            // тавернщик теперь стоит НА ПОЛУ прямо под окошком (был в центре
            // зала в отрыве от стойки). Голова ниже линии пол/стена (185).
            if (this.interiorId === 'tavern') {
                this.npcSprite.setPosition(width * 0.293, height * 0.435);
                this.npcSprite.setDepth(4);
            }
            // Проверяем существование анимации
            const animKey = `${finalSpriteKey}_idle_down`;
            if (this.anims.exists(animKey)) {
                this.npcSprite.play(animKey);
            }
            // 66.29 (п.6 приказа): вместо «дыхания» деформацией масштаба
            // (scaleX/scaleY ±2% — желе на пиксель-арте) — мягкий вертикальный
            // bob: спрайт не деформируется, а чуть приподнимается/опускается.
            const bobY = this.npcSprite.y;
            this.tweens.add({
                targets: this.npcSprite,
                y: { from: bobY, to: bobY - 2.5 },
                duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
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
            // Раунд 48 (пп.2,3 заявки): ПОЛНЫЕ ПАРАМЕТРЫ жителя больше НЕ
            // показываются (раньше была строка «❤13 СИЛ 65… Навыки: …» —
            // игрок не должен так просто знать параметры НПЦ). Видно только
            // ВО ЧТО ОДЕТ житель и ЧТО ДЕРЖИТ В РУКАХ; параметры раскрываются
            // только в бою удачной проверкой «Исследование» (CombatScene).
            const wornLine = getNpcWornLine(this.npcData);
            if (wornLine) {
                this.add.text(this.npcSprite.x, this.npcSprite.y + 104, wornLine, {
                    fontSize: '10px', color: '#c9a14a', align: 'center',
                    fontFamily: 'Georgia, serif', lineSpacing: 3,
                    backgroundColor: '#000000aa', padding: { x: 6, y: 4 },
                    stroke: '#000', strokeThickness: 1,
                    wordWrap: { width: width * 0.52 },
                }).setOrigin(0.5, 0).setDepth(20);
            }
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
            this.add.text(width * 0.65, height * 0.52, `${absentName}\n${this.ownerPresence.activity ? t(this.ownerPresence.activity) : ''}\n📍 ${where}`, {
                fontSize: '15px', color: RUS.text, align: 'center',
                backgroundColor: '#000000aa', padding: { x: 10, y: 8 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.add.text(width * 0.65, height * 0.66, t('Найди его там — или возвращайся в другой час.'), {
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
                // 66.29: bob вместо желейной деформации масштаба (см. выше)
                const secBobY = secSpr.y;
                this.tweens.add({
                    targets: secSpr,
                    y: { from: secBobY, to: secBobY - 2.5 },
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
                { x: 0.5, y: 0.74 }, { x: 0.84, y: 0.72 }, { x: 0.60, y: 0.42 },  // 66.29: 3-й гость — из зоны окошка выдачи (там теперь тавернщик)
            ];
            visitorIds.forEach((vId, vi) => {
                const vData = findNpc(this.registry, vId);
                // Раунд 56: у НПЦ без объекта в registry (ученик кузнеца до гибели
                // мастера) показываем русское имя по ID — не сырой «apprentice»
                const vName = vData ? getNpcDisplayName(this.registry, vId) : t(getNpcFallbackName(vId));
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
                            const line = pickOutdoorLine(this.registry, vId, t('«Хорошая медовуха нынче...»'));
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
        this.playerSprite = this.add.sprite(width * 0.25, spawnY, safePlayerKey, 0).setScale(2.5);
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
            y: { from: spawnY, to: spawnY - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ----- Декорации в зависимости от типа интерьера -----
        this.addDecorations(interior);

        // ----- Overlay дня/ночи (п.5) -----
        // Раунд 50: при тайловом фоне (int_bg) ночь мягче (×0.55) — очаги запечены
        // в картинку и не могут «пробить» multiply-затемнение, как живой огонь.
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            // Ночь мягче: зажимаем итоговую силу затемнения (максимум 0.38),
            // иначе запечённый фон уходит в черноту под multiply-слоем.
            const ovlAlpha = this._intBg ? Math.min(overlay.alpha * 0.55, 0.38) : overlay.alpha;
            this.add.rectangle(0, 0, width, height, overlay.color, ovlAlpha)
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
            // Раунд 51: в ЛАВКАХ вместо «Задания» — кнопка «Торговать»
            // (торговцы не выдают поручений — пул квестов не трогаем)
            if (interior.market) {
                buttons.push({ label: t('\u{1F6D2} Торговать'), bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showMarketShop(interior) });
            } else {
                buttons.push({ label: t('\u{1F4DC} Задание'), bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.offerQuest(interior) });
            }
            buttons.push({ label: t('\u{1F381} Подарить'), bg: 0x5a2a5a, hover: 0x6a3a6a, cb: () => this.showGiftMenu(interior) });
            buttons.push({ label: t('\u{1F44D} Похвалить'), bg: 0x2a5a5a, hover: 0x3a6a6a, cb: () => this.complimentNpc(interior) });
            buttons.push({ label: t('\u{1F620} Угрожать'), bg: 0x5a1a1a, hover: 0x6a2a2a, cb: () => this.threatenNpc(interior) });
            // Раунд 43 (п.13 заявки): «Свататься» — только с совершеннолетними
            // НПЦ противоположного пола (возраст НПЦ ≥ 18).
            // Раунд 44 (п.7): и только НЕ состоящими в браке (замужних/женатых
            // сразу не показываем — ранее отказ выдавался уже в canMarry).
            // Раунд 47 (п.1): и при НЕЖЕНАТОМ герое (брак — не победа, второй раз
            // не венчают; кнопка у женатого игрока не показывается вовсе).
            if (this.npcData && !player.married && this.npcData.gender !== player.gender && (this.npcData.age || 0) >= getAgeOfMajority() && !this.npcData.married && npcRepValue >= 50 && villageRepValue >= 30) {
                buttons.push({ label: t('\u{1F48D} Свататься'), bg: 0x5a2a5a, hover: 0x6a3a6a, cb: () => this.proposeMarriage(interior) });
            }
            if (interior.id === 'tavern') {
                buttons.push({ label: t('\u{1F37B} Угостить (20\u0434)'), bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.treatEveryone(interior) });
                buttons.push({ label: t('\u{1F6D2} Купить еды'), bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showTavernShop() });
                // Раунд 66.17 (п.5): ПРОДАЖА ДОБЫЧИ — Фёдор берёт рыбу и дичь на кухню
                buttons.push({ label: t('\u{1F4B0} Продать добычу'), bg: 0x5a4a2a, hover: 0x6a5a3a, cb: () => this.showSellLootMenu(interior) });
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
            } else if (interior.id === 'butcher_house') {
                // Раунд 66.17 (п.5): мясник Потап скупает добычу (мясо/рыбу) на столешню
                buttons.push({ label: t('\u{1F4B0} Продать добычу'), bg: 0x5a4a2a, hover: 0x6a5a3a, cb: () => this.showSellLootMenu(interior) });
            }
            // Раунд 26: в церкви — богомолье и осмотр киота (переехали из удалённой часовни)
            if (interior.id === 'church') {
                buttons.push({ label: t('\u{1F64F} Помолиться'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.prayInChurch() });
                // Раунд 66.21 (приказы 13-14): пожертвование ЛЮБОГО размера
                // (меню 5/10/25/50 д.), личная репутация священника + деревенская
                buttons.push({ label: t('\u{1F56F} Пожертвование'), bg: 0x6a5a2a, hover: 0x7a6a3a, cb: () => this.donateInChurch() });
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
        // Раунд 51 ФИКС (после проверки в браузере, 390×844): ширина кнопки
        // строится по ТЕКСТУ (createButton), поэтому на узких экранах кнопки
        // были ШИРЕ шага сетки и налезали друг на друга. Теперь: создаём все
        // кнопки, ИЗМЕРЯЕМ фактические ширины и раскладываем в 1..3 ряда так,
        // чтобы каждый ряд помещался в экран; ряды центрируются вокруг btnY.
        const created = buttons.map(b => ({
            b,
            c: createButton(this, width / 2, btnY, b.label, b.cb, {
                backgroundColor: b.bg, hoverColor: b.hover, textColor: RUS.text,
                fontSize: 12, padding: { left: 6, right: 6, top: 10, bottom: 10 },
                cornerRadius: 6,
            }),
        }));
        const availW = width - 32;
        const gap = btnGap;
        // Раунд 56 (приказ владельца: «плашки не налезают и не вылезают»):
        // одиночная кнопка не бывает шире экрана — сжимаем её контейнер,
        // иначе на узких окнах плашка торчит за край рамки
        created.forEach((it) => {
            const w0 = Math.max(it.c.width, 56);
            it.base = (w0 > availW && availW > 0) ? Math.max(0.5, availW / w0) : 1;
            if (it.base < 1) it.c.setScale(it.base);
        });
        // Разбивка на ряды: жадно набираем ряд, пока влезает
        const rows = [];
        let row = [], rowW = 0;
        created.forEach(({ b, c, base }) => {
            const w = Math.max(c.width, 56) * (base || 1) + gap;
            if (row.length && rowW + w - gap > availW) {
                rows.push(row); row = []; rowW = 0;
            }
            row.push({ b, c, w: Math.max(c.width, 56) * (base || 1) });
            rowW += w;
        });
        if (row.length) rows.push(row);
        // Центрируем ряды вокруг btnY (шаг рядов 44px)
        const rowH = 44;
        // Раунд 54 ФИКС (проверка 390×844, таверна — 12 кнопок): панель
        // уезжала ЗА нижний край и налезала на HUD ❤/💰 слева внизу.
        // Узкие экраны (width<600): вся панель ставится ЦЕЛИКОМ в зону между
        // описанием и HUD (низ = верх HUD − 6); если рядов всё же больше, чем
        // влезает, — сжимаем кнопки масштабом и пересчитываем ряды.
        const isNarrow = width < 600;
        const bottomLimit = isNarrow ? (height - 88 - 6) : (height - 12);
        const topLimit = height * 0.55;
        const availH = bottomLimit - topLimit;
        let btnScale = 1;
        if (rows.length * rowH > availH) {
            btnScale = Math.max(0.66, availH / (rows.length * rowH));
            created.forEach(({ c, base }) => c.setScale((base || 1) * btnScale));
            // пересборка рядов по сжатым ширинам
            rows.length = 0;
            row = []; rowW = 0;
            created.forEach(({ b, c, base }) => {
                const w = Math.max(c.width, 56) * (base || 1) * btnScale + gap;
                if (row.length && rowW + w - gap > availW) {
                    rows.push(row); row = []; rowW = 0;
                }
                row.push({ b, c, w: Math.max(c.width, 56) * (base || 1) * btnScale });
                rowW += w;
            });
            if (row.length) rows.push(row);
        }
        const effRowH = rowH * btnScale;
        // опорный центр: обычные экраны — btnY (как в раундах 51–53);
        // узкие — центр свободной зоны между описанием и HUD.
        const fitsAtBtnY = (btnY - effRowH / 2) >= topLimit
            && (btnY + rows.length * effRowH - effRowH / 2) <= bottomLimit;
        const panelCenterY = fitsAtBtnY ? btnY : (topLimit + bottomLimit) / 2;
        rows.forEach((r, ri) => {
            const y = panelCenterY + (ri - (rows.length - 1) / 2) * effRowH;
            const total = r.reduce((s, it) => s + it.w, 0) + (r.length - 1) * gap;
            let x = (width - total) / 2;
            r.forEach(({ c, w }) => {
                c.x = x + w / 2;
                c.y = y;
                x += w + gap;
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
        // Раунд 66.21 (приказ 10): если игрок внутри ночью — его впустили по
        // срочному делу (стук в дверь); такие визиты ночная проверка не
        // отклоняет и штрафом «разбудил» не карает.
        const nightBusiness = hasUrgentQuestBusiness(this.registry, interior);
        const talkCheck = checkNpcWillingToTalk(this.registry, interior.npcId, {
            npcBusy: false,
            urgent: nightBusiness,
            questComplete: nightBusiness,
        });
        if (talkCheck.willAttack) {
            createDialog(this, t('Нападение!'),
                tf(t('{0} бросается на тебя с кулаками!'), getNpcDisplayName(this.registry, interior.npcId)),
                [{ text: t('Драться!'), callback: () => {
                    // Раунд 40 (QA-фикс): переход в бой — на следующий кадр,
                    // вне стека обработчика клика (иначе зависание цикла Phaser)
                    this.time.delayedCall(0, () => {
                        this.scene.start('Combat', { enemyKeys: ['villager'], npcId: interior.npcId + '_hostile' });
                    });
                }}],
                { singleton: false, portraitKey: this.npcPortraitKey }
            );
            return;
        }
        if (!talkCheck.canTalk) {
            createDialog(this, t('Отказ'), talkCheck.message,
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey }
            );
            return;
        }
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        ActionLog.add(this.registry, tf(t('Поговорил с {0} в «{1}».'), npcName, interior.name));
        if (this.npcData && !this.npcData.met) {
            meetNpc(this.registry, interior.npcId);
            ActionLog.add(this.registry, tf(t('Познакомился с {0}.'), this.npcData.knownDescription));
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
        ActionLog.add(this.registry, tf(t('Награда за «{0}»: {1}.'), done.title, rewards.join(', ')));
        this.busyDialog = true;
        const address = this.player && this.player.gender === 'female' ? t('путница') : t('путник');
        createDialog(this, t('✓ Поручение выполнено!'),
            `${npcName}: «${tf(t('Дело сделано, {0}! Прими это в благодарность.'), address)}»\n\n${t('Награда')}: ${rewards.join(', ')}`,
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
        // Раунд 47 (п.4): показываем ВСТРЕЧУЮ проверку Убеждения:
        // «бросок 22: Убеждение 45 против (Упорство жителя 35 + 10 сложности) — успех»
        const text = result.checkLine ? `${result.message}\n(${result.checkLine})` : result.message;
        createDialog(this, t('Просьба о деньгах'), text, [
            { text: t('Понятно'), callback: () => {} },
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
     * РАУНД 66.21 (приказ 2): единая точка выдачи makeQuestOffer — те же
     * лимиты, что у бесед («📜 Есть ли дело?») и уличных НПЦ: взрослый
     * НПЦ с пулом, одно активное поручение от НПЦ, одно предложение в день.
     */
    offerQuest(interior) {
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const offer = makeQuestOffer(this.registry, interior.npcId);

        if (!offer.ok) {
            const lines = {
                active: tf(t('{0}: «Ты ещё не выполнил моё прошлое поручение. Сперва закончи его!»'), npcName),
                offered: tf(t('{0}: «На нынче у меня дел больше нет. Загляни завтра — что-нибудь найдётся.»'), npcName),
                none: tf(t('{0}: «Нет у меня сейчас для тебя дел. Зайди попозже.»'), npcName),
                age: tf(t('{0}: «Куда тебе мои дела, мал ещё. Подрастёшь — разговор будет.»'), npcName),
                pool: tf(t('{0}: «Пустое дело ищешь? Иди с миром.»'), npcName),
            };
            createDialog(this, t('Задание'),
                lines[offer.reason] || lines.none,
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 30 }
            );
            return;
        }

        const quest = offer.quest;

        // Формируем описание наград
        const rewardTexts = quest.rewards.map(r => {
            if (r.type === 'money') return formatMoney(r.amount);
            if (r.type === 'item') return `${r.name} ×${r.count}`;
            if (r.type === 'blessing') return r.name;
            return r.name || t('что-то');
        });

        const questText = `${quest.description}\n\n` +
            `${t('Цель:')} ${quest.objective}\n` +
            `${t('Срок:')} ${tf(t('≈{0} ч'), quest.timeLimitHours || Math.round((quest.timeLimit || 10) / 4))}\n` +
            `${t('Сложность:')} ${quest.difficulty === 'hard' ? t('тяжёлая') : (quest.difficulty === 'medium' ? t('средняя') : t('лёгкая'))}\n` +
            `${t('Награда:')} ${rewardTexts.join(', ')}`;

        // Показываем задание с кнопками "Принять" и "Отказаться"
        createDialog(this, `📜 ${quest.title}`, questText, [
            {
                text: t('✓ Принять'),
                callback: () => {
                    acceptQuest(this.registry, quest);
                    createDialog(this, t('Задание принято'),
                        tf(t('{0}: «Благодарю! Не подведи. Возвращайся, как выполнишь.»'), npcName),
                        [{ text: t('Понятно'), callback: () => {} }],
                        { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 30 }
                    );
                },
            },
            {
                text: t('✗ Отказаться'),
                callback: () => {
                    ActionLog.add(this.registry, tf(t('Отказался от задания: {0}.'), quest.title));
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

        this.add.text(width / 2, height / 2 - panelH / 2 + 25, tf(t('Подарить {0}'), npcName), {
            fontSize: '18px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        let y = height / 2 - panelH / 2 + 65;

        // Подарить деньги (10 д.)
        createButton(this, width / 2, y, t('💸 Подарить 10 денег'), () => {
            if ((player.dengas || 0) < 10) {
                createDialog(this, t('Подарок'), t('Не хватает денег!'), [{ text: t('Понятно'), callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= 10;
            this.registry.set('player', player);
            // П.6: ценность денег = номинал × 0.5 = 5
            const result = applyGiftBonus(this.registry, interior.npcId, 5);
            const msg = result.success
                ? tf(t('{0}: «Спасибо тебе! Доброе дело сделал.» (+{1} реп.)'), npcName, result.bonus)
                : tf(t('{0}: «Не нужно мне твоих подачек!» ({1} реп.)'), npcName, result.bonus);
            this._closeGiftMenu(overlay, panel);
            createDialog(this, t('Подарок'), msg, [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey });
        }, {
            backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
            fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
        }).setDepth(202);
        y += 35;

        // Подарить деньги (50 д.)
        createButton(this, width / 2, y, t('💸 Подарить 50 денег'), () => {
            if ((player.dengas || 0) < 50) {
                createDialog(this, t('Подарок'), t('Не хватает денег!'), [{ text: t('Понятно'), callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= 50;
            this.registry.set('player', player);
            // П.6: ценность = 50 × 0.5 = 25
            const result = applyGiftBonus(this.registry, interior.npcId, 25);
            const msg = result.success
                ? tf(t('{0}: «Ох, какая щедрость! Благодарю от сердца!» (+{1} реп.)'), npcName, result.bonus)
                : tf(t('{0}: «Что-то ты уж слишком щедр... Чего хочешь?» ({1} реп.)'), npcName, result.bonus);
            this._closeGiftMenu(overlay, panel);
            createDialog(this, t('Подарок'), msg, [{ text: t('Понятно'), callback: () => {} }],
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
            this.add.text(width / 2, y, t('Предметы из инвентаря:'), {
                fontSize: '13px', color: RUS.textDim,
            }).setOrigin(0.5).setDepth(202);
            y += 25;

            player.inventory.forEach((item) => {
                // Раунд 66.12 (п.7): квестовые предметы (икона) и уникальный
                // меч старосты НЕ ДАРЯТСЯ — их потеря ломает сюжет/награду
                if (item.id === 'icon' || item.uniqueFromElder || item.quest) return;
                // Определяем цену предмета
                let itemPrice = 0;
                if (WEAPONS[item.id]) itemPrice = WEAPONS[item.id].price;
                else if (ARMORS[item.id]) itemPrice = ARMORS[item.id].price;
                else if (item.id === 'herb') itemPrice = 5;
                else if (item.id === 'icon') itemPrice = 50;
                else itemPrice = 10; // базовая цена

                const giftValue = Math.round(itemPrice * 0.5); // п.6: ценность = цена × 0.5
                const itemLabel = `${item.name}${item.count > 1 ? ' ×' + item.count : ''} (${t('ценность')} ${giftValue})`;

                createButton(this, width / 2, y, `📦 ${itemLabel}`, () => {
                    // Удаляем один предмет
                    item.count--;
                    if (item.count <= 0) {
                        player.inventory = player.inventory.filter(i => i !== item);
                    }
                    this.registry.set('player', player);
                    const result = applyGiftBonus(this.registry, interior.npcId, giftValue);
                    const msg = result.success
                        ? tf(t('{0}: «Ох, вещь добрая! Спасибо, пригодится.» (+{1} реп.)'), npcName, result.bonus)
                        : tf(t('{0}: «Не нужна мне такая вещь.» ({1} реп.)'), npcName, result.bonus);
                    this._closeGiftMenu(overlay, panel);
                    createDialog(this, t('Подарок'), msg, [{ text: t('Понятно'), callback: () => {} }],
                        { singleton: false, portraitKey: this.npcPortraitKey });
                }, {
                    backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                    fontSize: 12, padding: { left: 12, right: 12, top: 6, bottom: 6 },
                }).setDepth(202);
                y += 30;
            });
        }

        // Закрыть
        createButton(this, width / 2, height / 2 + panelH / 2 - 25, t('Закрыть'), () => {
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
        // Раунд 66.21 (аудит баланса, приказы 6–7): похвала — ОДИН раз в день
        // у каждого НПЦ. Раньше «Похвалить» можно было спамить: +2..+5 за клик
        // без всякой цены — эксплойт накрутки репутации.
        if (!repActionAllowedToday(this.registry, interior.npcId, 'compliment')) {
            const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
            createDialog(this, t('Похвала'),
                tf(t('{0}: «Всё, хватит мне льстить. Слова добрые по одному разу в день ценны».'), npcName),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 30 });
            return;
        }
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const oratorySkill = player.skills.oratory || 15;
        const result = applyCompliment(this.registry, interior.npcId, oratorySkill);
        markRepActionDone(this.registry, interior.npcId, 'compliment');
        
        // Раунд 47 (п.4): в диалоге видна ВСТРЕЧАЯ проверка:
        // «бросок 22: Красноречие 45 против (Красноречие жителя 40) — успех»
        const checkNote = result.checkLine ? `\n(${result.checkLine})` : ` (${t('бросок')} ${result.roll})`;
        createDialog(this, t('Похвала'), tf(t('{0}: {1}{2}\n{3} репутации'), npcName, result.message, checkNote, (result.bonus > 0 ? '+' : '') + result.bonus), [
            { text: t('Понятно'), callback: () => {} },
        ], {
            singleton: false,
            portraitKey: this.npcPortraitKey,
            typing: true, typingSpeed: 30,
        });
    }

    // === Пункты 7-10: Угрожать NPC ===
    threatenNpc(interior) {
        // Раунд 66.22 (приказ 4 владельца): дневной лимит угроз УБРАН —
        // угрожать можно сколько угодно. Баланс вместо лимита: деньги при
        // успехе остаются (5–15 д., см. applyThreat), но падение репутации
        // ЭСКАЛИРУЕТ (−база −3×(разы−1) лично + −2 деревне за каждую угрозу,
        // шанс успеха падает с каждым разом) — часто угрожать невыгодно,
        // только при крайней нужде.
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const intimidateSkill = player.skills.intimidate || 15;
        const playerGender = player.gender || 'male';
        
        const result = applyThreat(this.registry, interior.npcId, intimidateSkill, playerGender);
        // Раунд 47 (п.4): в диалоге видна ВСТРЕЧАЯ проверка Запугивания
        const checkNote = result.checkLine ? `\n(${result.checkLine})` : '';
        
        // П.8: При успехе — NPC может выдать деньги или предмет
        if (result.success) {
            // Выдаём случайные деньги (5-15 д.)
            const loot = 5 + Math.floor(Math.random() * 11);
            player.dengas = (player.dengas || 0) + loot;
            this.registry.set('player', player);
            ActionLog.add(this.registry, tf(t('Угрозой вымогал {0} д. у {1} (бросок {2}).'), loot, npcName, result.roll));
            createDialog(this, t('Угроза'),
                tf(t('{0}\n\nПолучено: {1} д.\n(Репутация {2}){3}'), result.message, loot, (result.repChange > 0 ? '+' : '') + result.repChange, checkNote),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey,
                  typing: true, typingSpeed: 30 }
            );
        } else if (result.willAttack) {
            // NPC нападает
            createDialog(this, t('Угроза — нападение!'),
                tf(t('{0}\n(Репутация {1}){2}'), result.message, (result.repChange > 0 ? '+' : '') + result.repChange, checkNote),
                [{ text: t('Драться!'), callback: () => {
                    // Раунд 40 (QA-фикс): переход в бой — на следующий кадр,
                    // вне стека обработчика клика (иначе зависание цикла Phaser)
                    this.time.delayedCall(0, () => {
                        this.scene.start('Combat', { enemyKeys: ['villager'], npcId: interior.npcId + '_hostile' });
                    });
                }}],
                { singleton: false, portraitKey: this.npcPortraitKey }
            );
        } else {
            createDialog(this, t('Угроза'),
                tf(t('{0}\n(Репутация {1}){2}'), result.message, (result.repChange > 0 ? '+' : '') + result.repChange, checkNote),
                [{ text: t('Понятно'), callback: () => {} }],
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
                message = tf(t('{0}: «Ты мне хоть и {1}, но я тебя ещё не так хорошо знаю, чтобы семью создавать. Подожди ещё, наберись опыта в деревне.» (Нужно личная репутация +{2}, у вас {3})'),
                    npcName, heroIsF ? t('люба') : t('люб'), npcRepThreshold, npcRepValue);
            } else if (villageRepValue < villageRepThreshold) {
                message = tf(t('{0}: «Я бы {1}, да староста не благословит. Ты ещё не {2} уважение всей деревни.» (Нужно деревенская репутация +{3}, у вас {4})'),
                    npcName, npcIsF ? t('рада') : t('рад'), heroIsF ? t('заслужила') : t('заслужил'), villageRepThreshold, villageRepValue);
            } else if ((player.dengas || 0) < cost) {
                message = tf(t('{0}: «Свадьба — дело не дешёвое! Нужно {1} д. на свадебное торжество и подарки. А у тебя всего {2} д.»'),
                    npcName, cost, player.dengas || 0);
            } else if (this.npcData.married) {
                // Раунд 44 (п.7): вежливый отказ чужого мужа/жены
                message = tf(t('{0}: «Я {1} — венчан(а) с другим человеком. Ищи себе пару среди свободных сердец.»'),
                    npcName, npcIsF ? t('замужем') : t('женат'));
            } else {
                message = tf(t('{0}: «Не могу я {1}. {2}.»'), npcName, npcIsF ? t('выйти за тебя') : t('жениться на тебе'), t(check.reason));
            }
            
            createDialog(this, t('Сватовство'), message, [
                { text: t('Понятно'), callback: () => {} },
            ], {
                singleton: false,
                portraitKey: this.npcPortraitKey,
                typing: true, typingSpeed: 30,
            });
            return;
        }
        
        // Условия выполнены — предложение брака
        const proposalText = tf(t('Ты {0} свататься: {1}.\n\nУсловия для свадьбы:\n✓ Личная репутация: {2} (нужно +{3})\n✓ Деревенская репутация: {4} (нужно +{5})\n✓ Свадебное торжество: {6} д. (у вас {7} д.)\n\n{8} {9} принять твоё предложение! Свадьба состоится по обычаям Руси!'),
            heroIsF ? t('решила') : t('решил'), npcName, npcRepValue, npcRepThreshold, villageRepValue, villageRepThreshold,
            cost, player.dengas || 0, npcName, npcIsF ? t('согласна') : t('согласен'));
        
        createDialog(this, t('💍 Сватовство'), proposalText, [
            {
                text: t('💍 Сыграем свадьбу!'),
                callback: () => {
                    const result = marry(this.registry, interior.npcId, player);
                    if (result.success) {
                        // Раунд 66.11 (приказ владельца): ЖЕНИТЬБА — ВЫИГРЫШ И
                        // КОНЕЦ ИГРЫ. «…с задачей женится ИЛИ получить 100
                        // репутации в деревне — ВЫИГРЫШ И КОНЕЦ ИГРЫ!»
                        // marry() уже поставила q.marriageVictory — checkGameEnd
                        // вернёт 'victory_marriage' в любой сцене; кнопка окна
                        // уводит в EndScene с титулом «💍 ПОБЕДА! СВАДЬБА СЫГРАНА».
                        const winMessage = t('🎉 СВАДЬБА! 🎉\n\nПо обычаям Руси, отец Савватий обвенчал вас в церкви. Вся деревня гуляла три дня на свадебном пиру!\n\n') +
                            tf(t('{0} и {1} теперь — муж и жена.\n'), player.name, result.npcName) +
                            (heroIsF ? t('Ты принята в деревню как своя!') : t('Ты принят в деревню как свой!')) + '\n\n' +
                            t('Это венец твоего похода: свадьба — ПОБЕДА, и летопись завершается свадебным звоном!');
                        
                        createDialog(this, t('🎉 СВАДЬБА — ПОБЕДА!'), winMessage, [
                            {
                                text: t('📜 Итоги похода'),
                                callback: () => {
                                    // Раунд 40 (QA-фикс): переход сцены — вне стека
                                    // обработчика клика, на следующий кадр.
                                    this.time.delayedCall(0, () => this.scene.start('End'));
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
                text: t('Подумать ещё'),
                callback: () => {
                    ActionLog.add(this.registry, heroIsF
                        ? tf(t('Решила пока не выходить замуж за {0}.'), npcName)
                        : tf(t('Решил пока не жениться на {0}.'), npcName));
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
            createDialog(this, t('Таверна'), t('Не хватает денег на выпивку для всех!'), [
                { text: t('Понятно'), callback: () => {} },
            ], { singleton: false, portraitKey: interior.portrait });
            return;
        }
        player.dengas -= cost;
        this.registry.set('player', player);
        const totalBonus = applyTreatEveryoneBonus(this.registry);
        ActionLog.add(this.registry, tf(t('Угостил всех выпивкой в таверне за {0} д. (+{1} к репутации).'), cost, totalBonus));
        createDialog(this, t('🎉 Выпивка для всех'),
            t('Ты заказал бочку медовухи на всех! Гости радостно поднимают кубки. «За гостеприимного гостя!» — раздаётся по залу. (Репутация у всех NPC +3, в деревне +5)'), [
            { text: t('🎉 За нас!'), callback: () => {} },
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
    /**
     * Раунд 51 (п.11 заявки): ПАНЕЛЬ ТОРГОВЛИ НОВЫХ ЛАВОК (восточная слобода).
     * Универсальный лавочный магазин по данным interior.market.items:
     *   kind: 'heal' — еда/мелочь (эффекты HP/MP сразу),
     *   kind: 'weapon' / 'armor' — снаряжение (equipWeapon/equipArmor).
     * Уважает репутацию: скидка за добрую славу / наценка за дурную,
     * отказ торговать при репутации ≤ −50 (как у кузнеца, п.7э Судебника).
     */
    showMarketShop(interior) {
        // РАУНД 66.20: анти-стакинг — как «Скупка» (66.19): кастомная панель
        // не должна открываться поверх живого диалога («Отдых», беседа НПЦ)
        closeAllSingletonDialogs(this);
        const player = this.registry.get('player');
        const market = interior.market;
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const { width, height } = this.scale;

        // Отказ от торговли при дурной славе (репутация ≤ −50)
        if (willNpcRefuseTrade(this.registry, interior.npcId)) {
            ActionLog.add(this.registry, tf(t('{0} отказался торговаться с героем дурной славы (репутация ≤ −50).'), npcName));
            createDialog(this, interior.name,
                tf(t('{0} загораживает прилавок рукой:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»'), npcName),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey });
            return;
        }

        const priceMod = getPriceModifier(this.registry, interior.npcId);
        const modNote = priceMod < 1 ? t(' (скидка за добрую славу)') : (priceMod > 1 ? t(' (наценка за дурную славу)') : '');

        // Подложка
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 560, panelH = 440;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        const closeMenu = () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        };

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, market.title || interior.name, {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 62,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}${modNote}`, {
            fontSize: '15px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Список товаров
        const startY = height / 2 - panelH / 2 + 105;
        market.items.forEach((item, i) => {
            const y = startY + i * 46;
            const price = Math.max(1, Math.round(item.price * priceMod));
            const canAfford = (player.dengas || 0) >= price;
            let desc = `${t(item.name)} — ${price} ${t('д.')}`;
            if (item.kind === 'weapon') {
                const w = WEAPONS[item.weaponId];
                if (w) desc += ` (${t('урон')} ${w.dice.min}-${w.dice.max}+${w.bonus || 0})`;
            } else if (item.kind === 'armor') {
                const a = ARMORS[item.armorId];
                if (a) desc += ` (${t('защита')} ${a.def})`;
            } else if (item.note) {
                desc += ` (${t(item.note)})`;
            }
            createButton(this, width / 2, y, desc, () => {
                if (!canAfford) {
                    createDialog(this, interior.name, t('Не хватает денег!'), [
                        { text: t('Понятно'), callback: () => {} },
                    ], { singleton: false, portraitKey: this.npcPortraitKey });
                    return;
                }
                player.dengas -= price;
                this.audioManager.playGoldSpend();
                let logNote = t(item.note) || '';
                if (item.kind === 'weapon') {
                    equipWeapon(player, item.weaponId);
                    if (!player.inventory) player.inventory = [];
                    if (!player.inventory.find(it => it.id === item.weaponId)) {
                        player.inventory.push({ id: item.weaponId, name: WEAPONS[item.weaponId].name, count: 1, type: 'weapon' });
                    }
                    logNote = t('снаряжение');
                } else if (item.kind === 'armor') {
                    equipArmor(player, item.armorId);
                    if (!player.inventory) player.inventory = [];
                    if (!player.inventory.find(it => it.id === item.armorId)) {
                        player.inventory.push({ id: item.armorId, name: ARMORS[item.armorId].name, count: 1, type: 'armor' });
                    }
                    logNote = t('снаряжение');
                } else if (item.kind === 'gear') {
                    // Раунд 66.17 (п.12): снаряжение, которое ЛОЖИТСЯ В УЗЕЛ
                    // (удочка и т.п.) — не съедается, не надевается, хранится.
                    if (!player.inventory) player.inventory = [];
                    const have = player.inventory.find(it => it.id === item.id);
                    if (have) {
                        have.count = (have.count || 1) + 1;
                    } else {
                        player.inventory.push({ id: item.id, name: t(item.name), count: 1, type: 'gear' });
                    }
                    logNote = t('в узел');
                } else if (item.kind === 'ammo') {
                    // Раунд 66.28 (пп.9,12): пачка стрел — ТОЛЬКО по 10 шт.,
                    // ложится в узел слотами по ≤10; в колчан — с экрана персонажа.
                    addArrowsToInventory(player, ARROW_PACK_SIZE);
                    logNote = t('в узел');
                } else {
                    // Еда/мелочь: эффект сразу (HP/MP), «в узел» не кладётся
                    if (item.heal) player.HP = Math.min(player.HPmax, player.HP + item.heal);
                    if (item.mpHeal) player.MP = Math.min(player.MPmax || 0, (player.MP || 0) + item.mpHeal);
                }
                this.registry.set('player', player);
                ActionLog.add(this.registry, tf(t('Купил «{0}» в «{1}» за {2} д.{3}'), t(item.name), interior.name, price, logNote ? ` (${logNote})` : ''));
                this.updateHUD();
                // Пересобрать панель с обновлённым балансом
                closeMenu();
                this.showMarketShop(interior);
            }, {
                backgroundColor: canAfford ? 0x3a5a3a : 0x3a3a3a,
                hoverColor: canAfford ? 0x4a6a4a : 0x4a4a4a,
                textColor: canAfford ? RUS.text : '#888',
                fontSize: 13,
                padding: { left: 12, right: 12, top: 8, bottom: 8 },
            }).setDepth(202);
        });

        // Кнопка закрытия
        createButton(this, width / 2, height / 2 + panelH / 2 - 34, t('Закрыть'), closeMenu, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 24, right: 24, top: 7, bottom: 7 },
        }).setDepth(202);
    }

    showTavernShop() {
        // РАУНД 66.20: анти-стакинг — закрыть открытые диалоги перед панелью
        closeAllSingletonDialogs(this);
        const player = this.registry.get('player');
        // Раунд 66.12 (п.7): единые правила торговли — при дурной славе
        // содержатель постоялого двора тоже отказывает (как кузнец и лавка).
        const tkName = this.npcData ? getNpcDisplayName(this.registry, 'tavernkeeper') : t('содержатель постоялого двора');
        if (willNpcRefuseTrade(this.registry, 'tavernkeeper')) {
            ActionLog.add(this.registry, tf(t('{0} отказался торговаться с героем дурной славы (репутация ≤ −50).'), tkName));
            createDialog(this, t('Постоялый двор'),
                tf(t('{0} загораживает прилавок рукой:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»'), tkName),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: 'portrait_tavernkeeper' });
            return;
        }
        // Список товаров с учётом репутации (п.13.2: скидки при высокой репутации).
        // Раунд 22: «Ночлег» убран из лавки — отдых теперь живёт в меню «Отдых»
        // (1 час / 8 часов), чтобы время реально текло, пока герой спит.
        // Раунд 66.16 (приказы 1–3): еда занимает РОВНО 1 час и имеет ОБЩИЙ
        // кулдаун 4 часа (см. systems/meal.js).
        // РАУНД 66.17 (уточнение п.1): «+1 HP» — про ПРОСТУЮ еду (яблоко, мёд).
        // ПОЛНОЦЕННАЯ еда в трактире лечит 2–3 HP: каша +3, хлеб +2.
        // Медовуха и квас — питьё: +1 HP, Воля едой не восстанавливается.
        const priceMod = getPriceModifier(this.registry, 'tavernkeeper');
        const modNote = priceMod < 1 ? t(' (скидка за добрую славу)') : (priceMod > 1 ? t(' (наценка за дурную славу)') : '');
        const mkEffect = (heal) => `+${heal} HP · ${t('1 час')}`;
        const items = [
            { id: 'bread', name: 'Хлеб', price: Math.max(1, Math.round(2 * priceMod)), effect: mkEffect(2), heal: 2, mpHeal: 0 },   // полноценная еда
            { id: 'kasha', name: 'Каша', price: Math.max(1, Math.round(5 * priceMod)), effect: mkEffect(3), heal: 3, mpHeal: 0 },   // самая сытная
            { id: 'mead', name: 'Медовуха', price: Math.max(1, Math.round(4 * priceMod)), effect: mkEffect(1), heal: 1, mpHeal: 0 }, // питьё
            { id: 'kvass', name: 'Квас', price: Math.max(1, Math.round(3 * priceMod)), effect: mkEffect(1), heal: 1, mpHeal: 0 },   // питьё
        ];

        const { width, height } = this.scale;
        // Подложка
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 500, panelH = 420;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 30, t('Постоялый двор «У дороги» — меню'), {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 65,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}${modNote}`, {
            fontSize: '17px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Список товаров
        const startY = height / 2 - panelH / 2 + 112;
        items.forEach((item, i) => {
            const y = startY + i * 44;
            const canAfford = (player.dengas || 0) >= item.price;
            createButton(this, width / 2, y, `${t(item.name)} — ${item.price} ${t('д.')} (${item.effect})`, () => {
                if (!canAfford) {
                    createDialog(this, t('Постоялый двор'), t('Не хватает денег!'), [
                        { text: t('Понятно'), callback: () => {} },
                    ], { singleton: false, portraitKey: 'portrait_tavernkeeper' });
                    return;
                }
                // Раунд 66.16 (приказ 3): кулдаун еды 4 часа — при попытке
                // поесть во время отката всплывает поп-ап «герой сытый»,
                // деньги НЕ списываются, время НЕ идёт.
                if (!canEat(this.registry).ok) {
                    showMealBlockedPopup(this);
                    return;
                }
                player.dengas -= item.price;
                this.audioManager.playGoldSpend(); // раунд 24: расплата монетами
                player.HP = Math.min(player.HPmax, player.HP + item.heal);
                player.MP = Math.min(player.MPmax, player.MP + item.mpHeal);
                registerMeal(this.registry); // приказ 3: кулдаун 4 часа
                // Приказ 1: еда ВСЕГДА занимает 1 час игрового времени
                tickTime(this.registry, MEAL_DURATION_MIN);
                this.registry.set('player', player);
                ActionLog.add(this.registry, tf(t('Купил и съел «{0}» на постоялом дворе за {1} д. (+{2} HP, час времени).'), t(item.name), item.price, item.heal));
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
                fontSize: 16, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setDepth(202);
        });

        // Кнопка закрытия
        createButton(this, width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 17, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    /**
     * РАУНД 66.17 (п.5): ПРОДАЖА ДОБЫЧИ. Трактирщик (Фёдор — на кухню)
     * и мясник (Потап — на столешню) скупают добычу: сырую/печёную рыбу,
     * сырое мясо и жаркое. Цены за штуку — из LOOT_DEFS (приготовленное
     * дороже сырого). «Продать 1» и «Продать всё» на каждый товар.
     */
    showSellLootMenu(interior) {
        const player = this.registry.get('player');
        if (!player) return;
        // Раунд 66.19 (бэклог «стакинг попапов»): «Скупка» закрывает ВСЕ
        // открытые диалоги («Отдых», беседу трактирщика) — нижняя панель
        // кликабельна под блокиратором, и раньше панель ложилась поверх них.
        closeAllSingletonDialogs(this);
        this.busyDialog = false;
        this.__sellLootOpen = true;
        const { width, height } = this.scale;
        const isButcher = interior.id === 'butcher_house';
        const buyerName = isButcher
            ? (this.npcData ? getNpcDisplayName(this.registry, 'butcher') : t('Потап, мясник'))
            : t('трактирщик');

        // Отказ от торговли при дурной славе (единые правила торговли)
        const buyerNpcId = isButcher ? 'butcher' : 'tavernkeeper';
        if (willNpcRefuseTrade(this.registry, buyerNpcId)) {
            ActionLog.add(this.registry, tf(t('{0} отказался торговаться с героем дурной славы (репутация ≤ −50).'), buyerName));
            createDialog(this, isButcher ? t('Столешня') : t('Постоялый двор'),
                tf(t('{0} загораживает прилавок рукой:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»'), buyerName),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: isButcher ? 'portrait_peasant' : 'portrait_tavernkeeper' });
            return;
        }

        const rows = sellableLoot(player);
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 560, panelH = 420;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);
        const closeMenu = () => {
            overlay.destroy(); panel.destroy();
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
            this.__sellLootOpen = false;
        };

        this.add.text(width / 2, height / 2 - panelH / 2 + 30,
            isButcher ? t('Столешня Потапа — скупка добычи') : t('Кухня Фёдора — скупка добычи'), {
                fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(202);
        this.add.text(width / 2, height / 2 - panelH / 2 + 62,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}`, {
                fontSize: '17px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);
        // РАУНД 66.20: подсказка о ценах вынесена в общую строку (раньше
        // дублировалась в каждой строке списка и вынуждала держать мелкий кегль)
        this.add.text(width / 2, height / 2 - panelH / 2 + 88,
            t('Печёное и жаркое дороже сырого'), {
                fontSize: '13px', color: RUS.textDim, fontStyle: 'italic',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);

        if (rows.length === 0) {
            this.add.text(width / 2, height / 2 - 10,
                t('В узле нет добычи. Настреляй дичи из лука, налови рыбы на броду — или раздери волка.'), {
                    fontSize: '16px', color: RUS.textDim, wordWrap: { width: panelW - 60 },
                    align: 'center',
                }).setOrigin(0.5).setDepth(202);
        }

        const startY = height / 2 - panelH / 2 + 140;
        rows.forEach((row, i) => {
            const y = startY + i * 52;
            const def = row.def;
            this.add.text(width / 2 - panelW / 2 + 30, y - 22,
                `${def.emoji} ${t(def.name)} ×${row.count} — ${row.price} ${t('д.')}`, {
                    fontSize: '15px', color: RUS.text, stroke: '#000', strokeThickness: 1,
                }).setOrigin(0, 0.5).setDepth(202);
            createButton(this, width / 2 + 60, y + 4, tf(t('Продать 1 ({0} д.)'), row.price), () => {
                removeItem(player, def.id, 1);
                player.dengas = (player.dengas || 0) + row.price;
                this.registry.set('player', player);
                if (this.audioManager) this.audioManager.playGoldReceive();
                ActionLog.add(this.registry, tf(t('Продал «{0}» ({1}) за {2} д.'), t(def.name), buyerName, row.price));
                this.updateHUD();
                closeMenu();
                this.showSellLootMenu(interior);
            }, {
                backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 },
            }).setDepth(202);
            if (row.count > 1) {
                createButton(this, width / 2 + 205, y + 4, tf(t('Всё ({0} д.)'), row.price * row.count), () => {
                    const n = row.count;
                    removeItem(player, def.id, n);
                    player.dengas = (player.dengas || 0) + row.price * n;
                    this.registry.set('player', player);
                    if (this.audioManager) this.audioManager.playGoldReceive();
                    ActionLog.add(this.registry, tf(t('Продал всё «{0}» ×{1} ({2}) за {3} д.'), t(def.name), n, buyerName, row.price * n));
                    this.updateHUD();
                    closeMenu();
                    this.showSellLootMenu(interior);
                }, {
                    backgroundColor: 0x2a4a5a, hoverColor: 0x3a5a6a, textColor: RUS.text,
                    fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 },
                }).setDepth(202);
            }
        });

        createButton(this, width / 2, height / 2 + panelH / 2 - 34, t('Закрыть'), closeMenu, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 24, right: 24, top: 7, bottom: 7 },
        }).setDepth(202);
    }

    /**
     * Раунд 22 (п.10/12): ОТДЫХ В ТАВЕРНЕ.
     * Раунд 66.16 (приказы 2, 4, 7): выбор времени отдыха — от 1 до 12 часов
     * ИЛИ фиксированное «до утра / до полудня / до вечера / до полуночи».
     * Кулдаун сна 12 часов: при попытке поспать во время отката — поп-ап
     * «герой не хочет спать», отдых отменяется (без денег и времени).
     * РАУНД 66.17 (уточнение приказов 2–3): отдых 8+ часов восстанавливает
     * здоровье ПОЛНОСТЬЮ; меньше 8 часов — ПРОПОРЦИОНАЛЬНО (8 ч = 100%,
     * 2 ч = 25%, 4 ч = 50%, 6 ч = 75%); сон короче 2 часов НЕдоступен:
     * пункт «1 час» снят с меню, «до X» не предлагается, если до цели
     * меньше 2 часов. (Раунд 23: ваучер «Бесплатный ночлег» убран.)
     * Время реально течёт: во время погони за вором сон — дорогое решение.
     */
    showTavernRestMenu(interior) {
        if (this.busyDialog) return;
        // Раунд 66.19 (бэклог «стакинг попапов»): панель «Скупка» перекрывает
        // весь экран своим блокиратором — отдых поверх неё невозможен; страховка:
        if (this.__sellLootOpen) return;
        // Приказ 4: кулдаун сна 12 часов — «герой не хочет спать», отмена.
        if (!canSleep(this.registry).ok) {
            showSleepBlockedPopup(this);
            return;
        }
        const chaseActive = isChaseActive(this.registry);

        const warning = chaseActive
            ? '\n\n' + t('⚠ ВНИМАНИЕ: погоня за вором продолжается! Пока ты спишь, вор уйдёт далеко. Отдых лучше отложить до победы.')
            : '';

        // Приказ 2: цены — минимум 4 д., 2 д. за час, но не дороже 12 д.
        const costOf = (h) => Math.min(12, Math.max(4, h * 2));
        // Раунд 66.17: 8 ч = 100%, меньше — пропорционально; сон меньше 2 ч — нельзя
        const healLabel = (h) => tf(t('— вернёт ~{0}% здоровья'), Math.round(restHealPct(h * 60) * 100));
        const fullLabel = t('— полное восстановление');
        const hourOptions = [2, 3, 4, 6, 8, 12].map((h) => ({
            text: (h >= 8)
                ? tf(t('Ночлег {0} ч ({1} д.) {2}'), h, costOf(h), fullLabel)
                : tf(t('Отдохнуть {0} ч ({1} д.) {2}'), h, costOf(h), healLabel(h)),
            hours: h,
        }));
        // Фиксированное время: спим ровно до цели (минутами, без округления);
        // раунд 66.17: цели, до которых меньше 2 часов сна, не предлагаются
        const fixedOptions = [
            { hour: 6,  key: '🌅 До утра (в 6:00)' },
            { hour: 12, key: '☀️ До полудня (в 12:00)' },
            { hour: 16, key: '🌇 До вечера (в 16:00)' },
            { hour: 0,  key: '🌙 До полуночи (в 0:00)' },
        ].map((f) => {
            const mins = this.minutesUntilHour(f.hour);
            if (mins < SLEEP_MIN_MIN) return null;   // сон меньше 2 часов не бывает
            const h = Math.ceil(mins / 60);
            const pct = Math.round(restHealPct(mins) * 100);
            return {
                text: `${t(f.key)} ${tf(t('— сон {0} ({1} д.), ~{2}% здоровья'), this.spendHoursLabel(mins), costOf(h), pct)}`,
                hours: h,
                minutes: mins,
            };
        }).filter(Boolean);

        // Раунд 66.19 (бэклог «стакинг попапов»): «Отдых» тоже закрывает все
        // открытые диалоги — вместо нагромождения панелей остаётся одна.
        closeAllSingletonDialogs(this);
        this.busyDialog = true;
        createDialog(this, t('🛏 Отдых в таверне'),
            t('Фёдор вытирает стойку: «Комнатка чистая, сено свежее. Сколько будешь отдыхать?»')
            + warning,
            [
                ...hourOptions.map((o) => ({
                    text: o.text,
                    callback: () => { this.busyDialog = false; this.restInTavern(interior, o.hours); },
                })),
                ...fixedOptions.map((o) => ({
                    text: o.text,
                    callback: () => { this.busyDialog = false; this.restInTavern(interior, o.hours, o.minutes); },
                })),
                {
                    text: t('Не сейчас'),
                    callback: () => { this.busyDialog = false; },
                },
            ],
            // Раунд 66.19 (бэклог «стакинг попапов»): singleton ВКЛЮЧЁН —
            // раньше «Отдых» открывался с singleton:false, не регистрировался
            // в реестре диалогов, не дедуплицировался и не закрывался
            // closeAllSingletonDialogs при открытии «Скупки» — панели стакались.
            { portraitKey: this.npcPortraitKey, typing: true, typingSpeed: 25 });
    }

    /**
     * Раунд 22: выполнить отдых в таверне (см. showTavernRestMenu).
     * Раунд 66.16: hours = длительность сна (1..12+), minutesOverride —
     * точная длительность для «до утра/полудня/вечера/полуночи».
     * Кулдаун сна 12 часов (приказ 4): при откате — поп-ап «герой не
     * хочет спать», отдых отменён. После сна кулдаун ставится.
     * РАУНД 66.17: сон короче 2 часов НЕдопустим (поп-ап и отмена);
     * лечение ПРОПОРЦИОНАЛЬНО: 8 ч = 100% (полное), меньше — по доле
     * restHealPct (2 ч = 25%, 4 ч = 50%, 6 ч = 75%).
     */
    restInTavern(interior, hours, minutesOverride) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        const cost = Math.min(12, Math.max(4, hours * 2));
        const sleepMinutes = (minutesOverride && minutesOverride > 0) ? minutesOverride : hours * 60;

        // Приказ 4: кулдаун сна 12 часов (страховка от прямых вызовов —
        // меню уже проверяет; здесь герой ничего не платит и не теряет время)
        if (!canSleep(this.registry).ok) {
            showSleepBlockedPopup(this);
            return;
        }
        // Раунд 66.17: сон не может быть короче 2 часов — отмена без денег/времени
        if (sleepMinutes < SLEEP_MIN_MIN) {
            createDialog(this, t('🛏 Отдых'),
                t('Фёдор качает головой: «Что ж ты в постель-то ложишься — только прилёг и вставать? Сон меньше двух часов — не сон. Отдыхай подольше, либо иди делецом».\n\n(Отдых отменён: сон должен быть не менее 2 часов.)'),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey });
            return;
        }

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

            // Время реально течёт (8 часов = 32 тика погони!);
            // приказ 4: после пробуждения — кулдаун сна на 12 часов
            tickTime(this.registry, sleepMinutes);
            registerSleep(this.registry);

            // Раунд 66.17: доля восстановления — 8 часов = 100%, меньше — пропорция
            const pct = restHealPct(sleepMinutes);
            let effectText;
            if (pct >= 1) {
                player.HP = player.HPmax;
                player.MP = player.MPmax;
                effectText = t('Здоровье и Воля восстановлены ПОЛНОСТЬЮ.');
            } else {
                const heal = Math.max(1, Math.round((player.HPmax || 10) * pct));
                const mp = Math.max(1, Math.round((player.MPmax || 4) * pct));
                player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                player.MP = Math.min(player.MPmax || player.MP + mp, player.MP + mp);
                effectText = tf(t('Здоровье +{0}, Воля +{1} (~{2}% от полного).'), heal, mp, Math.round(pct * 100));
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
    // Бесплатно и БЕЗ лечения (лечение — платный «Отдых» и костёр в лесу).
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
        // РАУНД 66.20: анти-стакинг — панель «Время» закрывает живые диалоги
        closeAllSingletonDialogs(this);

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
                        + '\n' + t('Сил это не вернуло — для лечения есть платный «Отдых» (от 1 до 12 ч) и костёр в лесу, у брошенного лагеря.'),
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
        // РАУНД 66.20: анти-стакинг — закрыть открытые диалоги перед панелью
        closeAllSingletonDialogs(this);
        const player = this.registry.get('player');
        const { width, height } = this.scale;

        // Раунд 46 (п.1): торговлю ведёт кузнец, а после его гибели — УЧЕНИК.
        const smithId = getSmithNpcId(this.registry) || 'blacksmith';
        const smithNpcData = findNpc(this.registry, smithId);
        const smithName = (smithId === 'blacksmith')
            ? t('Кузнец Данила')
            : (smithNpcData && smithNpcData.met ? smithNpcData.name : t('Ученик кузнеца'));
        const smithPortrait = (this.interior && this.interior.portrait) || 'portrait_blacksmith';

        // 7э: отказ от торговли при дурной славе (репутация ≤ −50)
        if (willNpcRefuseTrade(this.registry, smithId)) {
            ActionLog.add(this.registry, tf(t('{0} отказался торговаться с героем дурной славы (репутация ≤ −50).'), smithName));
            createDialog(this, t('Кузница'),
                tf(t('{0} откладывает молот и крестит руки на груди:\n«Не стану я ни продавать, ни покупать у тебя, человек дурной славы. Иди!»'), smithName),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: smithPortrait });
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

        this.add.text(width / 2, height / 2 - panelH / 2 + 30,
            smithId === 'blacksmith' ? t('Кузница Данилы') : tf(t('Кузница — {0}'), smithName), {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - panelH / 2 + 65,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}`, {
            fontSize: '16px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Переключатель вкладок. РАУНД 62 (п.7): вкладка «Доспехи» УДАЛЕНА —
        // доспехи кузнец НЕ продаёт, а ВЫДАЁТ только за самые тяжёлые
        // поручения (см. questGenerator.generateRewards).
        const mkTab = (x, label, key) => createButton(this, x, height / 2 - panelH / 2 + 100, t(label), () => {
            closeMenu();
            this.showBlacksmithShop(key);
        }, {
            backgroundColor: tab === key ? RUS.accent : 0x4a3520,
            hoverColor: tab === key ? RUS.accentLight : 0x5a4530,
            textColor: RUS.text, fontSize: 14,
            padding: { left: 14, right: 14, top: 6, bottom: 6 },
        }).setDepth(202);
        mkTab(width / 2 - 75, 'Оружие', 'weapon');
        mkTab(width / 2 + 75, 'Продать', 'sell');  // метки через t(label) в mkTab

        // Список товаров
        const startY = height / 2 - panelH / 2 + 150;
        const priceMod = getPriceModifier(this.registry, smithId);
        const modNote = priceMod < 1 ? t(' (скидка за добрую славу)') : (priceMod > 1 ? t(' (наценка за дурную славу)') : '');

        if (tab === 'sell') {
            // ===== ВКЛАДКА «ПРОДАТЬ» (раунд 45, п.7э) =====
            // Урок Судебника о честной торговле: кузнец берёт снаряжение
            // за полцены — перекупкой герою не нажиться.
            // РАУНД 62 (п.7): МЕЧ СТАРОСТЫ (uniqueFromElder) НЕ ПРОДАЁТСЯ —
            // это уникальный дар за самое тяжёлое дело, не товар.
            const sellables = (player.inventory || []).filter(it =>
                it && (it.type === 'weapon' || it.type === 'armor') && (it.count || 0) > 0
                && it.id !== player.weaponId && it.id !== player.armorId
                && !it.uniqueFromElder);
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
                const label = `💰 ${t(item.name)} — ${sellPrice} ${t('д.')} (${t('полцены')})`;
                createButton(this, width / 2, y, label, () => {
                    item.count -= 1;
                    if (item.count <= 0) {
                        player.inventory = player.inventory.filter(x => x !== item);
                    }
                    player.dengas = (player.dengas || 0) + sellPrice;
                    this.registry.set('player', player);
                    if (this.audioManager) this.audioManager.playGoldReceive();
                    ActionLog.add(this.registry, tf(t('Продал «{0}» кузнецу за {1} д. (полцены, урок Судебника о честной торговле).'), t(item.name), sellPrice));
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
            // РАУНД 62 (п.7 приказа владельца) — ЧТО КУЗНЕЦ ПРОДАЁТ:
            // только простое оружие своей работы (нож/дубина/копьё/топор/лук).
            // МЕЧ (а также сабля и стальной меч) НЕ ПРОДАЁТСЯ — меч есть
            // УНИКАЛЬНАЯ НАГРАДА ОТ СТАРОСТЫ за самое тяжёлое дело.
            // ДОСПЕХИ не продаются вовсе — выдаются за тяжёлые поручения.
            // Старые сейвы, пришедшие с вкладкой 'armor', попадают в «Оружие».
            if (tab === 'armor') tab = 'weapon';
            const SMITH_SALE_WEAPONS = ['club', 'knife', 'spear', 'axe', 'bow'];
            const items = tab === 'weapon'
                ? Object.values(WEAPONS).filter(w => SMITH_SALE_WEAPONS.includes(w.id))
                : [];

            if (tab === 'weapon') {
                this.add.text(width / 2, height / 2 + panelH / 2 - 58,
                    t('Мечи не продаются: меч — награда старосты. Доспех кузнец выдаёт только за самые тяжёлые поручения. Стрелы — пачками по 10.'), {
                    fontSize: '11px', color: RUS.textDim, wordWrap: { width: panelW - 60 },
                }).setOrigin(0.5).setDepth(202);
            }

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
                    ? `${t(item.name)} — ${price} ${t('д.')}${modNote} (${t('урон')} ${item.dice.min}-${item.dice.max}+${item.bonus || 0})${lockNote}`
                    : `${t(item.name)} — ${price} ${t('д.')}${modNote} (${t('защита')} ${item.def})${lockNote}`;
                createButton(this, width / 2, y, desc, () => {
                    if (isMilitary && !gearCheck.ok) {
                        createDialog(this, t('Кузница'), tf(t('{0} качает головой: «{1}.»'), smithName, t(gearCheck.reason)), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    if (!canAfford) {
                        createDialog(this, t('Кузница'), t('Не хватает денег!'), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    // Раунд 66.12 (п.7): повторная покупка той же вещи раньше
                    // списывала деньги «в никуда» (вещь не дублировалась) —
                    // теперь покупка честно блокируется.
                    if (player.weaponId === item.id || (player.inventory || []).some(it => it.id === item.id)) {
                        createDialog(this, t('Кузница'), t('Такая вещь у тебя уже есть — не по-торговому дважды платить за одну.'), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    player.dengas -= price;
                    this.audioManager.playGoldSpend(); // раунд 24: расплата монетами
                    if (tab === 'weapon') {
                        // Раунд 66.12 (п.7): прежнее НАДЕТОЕ оружие возвращается в узел
                        // (раньше исчезало навсегда — надеть/продать его было нельзя)
                        const oldWeaponId = player.weaponId;
                        equipWeapon(player, item.id);
                        if (!player.inventory) player.inventory = [];
                        if (oldWeaponId && oldWeaponId !== item.id
                            && WEAPONS[oldWeaponId]
                            && !player.inventory.find(it => it.id === oldWeaponId)) {
                            player.inventory.push({ id: oldWeaponId, name: WEAPONS[oldWeaponId].name, count: 1, type: 'weapon' });
                        }
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
                    ActionLog.add(this.registry, tf(t('Купил «{0}» у кузнеца за {1} д.{2}'), t(item.name), price, isMilitary ? t(' (воинское снаряжение, по уложению Судебника)') : ''));
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

            // Раунд 66.28 (пп.9,12): СТРЕЛЫ В ПРОДАЖУ — пачка 10 шт. у кузнеца
            // (он же кует луки). Покупка ТОЛЬКО пачками по 10; расходник —
            // можно покупать сколько угодно пачек.
            if (tab === 'weapon') {
                const packPrice = Math.max(1, Math.round(ARROW_PACK_PRICE * priceMod));
                const canAffordPack = (player.dengas || 0) >= packPrice;
                const qNow = getQuiver(player);
                const invNow = countInventoryArrows(player);
                const packDesc = tf(t('🪶 Пачка стрел ({0} шт.) — {1} {2}   ·   {3}: {4}/{5}, {6}: {7}'),
                    ARROW_PACK_SIZE, packPrice, t('д.'), t('колчан'), qNow, QUIVER_CAP, t('в узле'), invNow);
                createButton(this, width / 2, startY + items.length * 42, packDesc, () => {
                    if (!canAffordPack) {
                        createDialog(this, t('Кузница'), t('Не хватает денег!'), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    player.dengas -= packPrice;
                    this.audioManager.playGoldSpend();
                    addArrowsToInventory(player, ARROW_PACK_SIZE);
                    this.registry.set('player', player);
                    ActionLog.add(this.registry, tf(t('Купил пачку стрел ({0} шт.) у кузнеца за {1} д. — стрелы легли в узел (в колчан наложишь на экране персонажа).'), ARROW_PACK_SIZE, packPrice));
                    this.updateHUD();
                    closeMenu();
                    this.showBlacksmithShop('weapon');
                }, {
                    backgroundColor: canAffordPack ? 0x3a5a3a : 0x3a3a3a,
                    hoverColor: canAffordPack ? 0x4a6a4a : 0x4a4a4a,
                    textColor: canAffordPack ? RUS.text : '#888',
                    fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
                }).setDepth(202);
            }
        }

        // Кнопка закрытия
        createButton(this, width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), () => {
            closeMenu();
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 17, padding: { left: 20, right: 20, top: 10, bottom: 10 },
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
        ActionLog.add(this.registry, t('Осмотрел себя у кузнеца (свиток персонажа).'));
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
            ActionLog.add(this.registry, t('Помолился в церкви (уже молился сегодня).'));
            createDialog(this, t('Молитва'), t('Ты снова стоишь перед киотом. Сердце уже нашло покой сегодня — больше не нужно.'), [
                { text: t('Аминь.'), callback: () => {} },
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
        ActionLog.add(this.registry, tf(t('Помолился в церкви — Воля +{0}.'), gain));

        createDialog(this, t('Молитва'),
            tf(t('Ты опускаешься на колени перед киотом. В полумраке церкви, под мерцание лампад, приходит покой.\n\nВоля восстановлена: +{0}.'), gain),
            [{ text: t('Встать с колен.'), callback: () => {} }]);
    }

    /**
     * Пожертвование на свечи и ладан (раунд 66.21): меню сумм 5/10/25/50 д.,
     * не чаще одного раза в игровой день.
     */
    donateInChurch() {
        if (this.busyDialog) return;
        // Раунд 66.21 (приказы 13-14): меню сумм 5/10/25/50 д. — размер
        // пожертвования задаёт прибавку (5→+1 … 50→+10, потолок +10).
        // Прибавка идёт И личной репутации у священника, И деревенской.
        // Реестр/логика — systems/ChurchDonation.js (тестируется в Node).
        showDonationMenu(this);
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
            createDialog(this, t('Пустой киот'), t('Больше тут ничего не изменилось: ниша без иконы, воск на полу, верёвка.'), [
                { text: t('Уйти от киота.'), callback: () => {} },
            ]);
            return;
        }
        q.kiotInspected = true;
        if (!q.cluesGathered) q.cluesGathered = [];
        // Раунд 66.26 (приказ 5): вор в игре ОДИН — улика больше не говорит «вдвоём»
        const clue = t('На полу церкви — капли воска и обрывок пеньковой верёвки с двумя узлами. Икону несли бережно, не впопыхах, и накануне в церкви горела свеча.');
        q.cluesGathered.push({ npcId: 'church', npcName: t('Церковь'), clue });
        this.registry.set('quest', q);
        ActionLog.add(this.registry, t('Осмотрел киот в церкви — нашёл улику (воск, верёвка с узлами).'));

        createDialog(this, t('Осмотр киота'),
            t('Ниша, где стояла чудотворная икона, пуста. Ты присматриваешься: на полу — капли воска, ещё тёплые. У подножия — обрывок пеньковой верёвки с двумя узлами.\n\nВор был один, но действовал не впопыхах: узлы на верёвке затянуты крепко, святыню несли бережно, а воск не успел остыть — киот открывали этой же ночью. Это стоит рассказать старосте.\n\nУлика добавлена к делу.'),
            [{ text: t('Запомнить.'), callback: () => {} }]);
    }

    // ================================================================
    // Раунд 9: Амбар — подённая работа и общее зерно
    // ================================================================

    /**
     * Подённая работа (молотьба): 1 час времени, −4 здоровья, +3..6 денег,
     * 15% шанс найти монетку в соломе. При истощении (HP ≤ 5) отказ.
     */
    /**
     * Единый масштаб по возрасту в интерьерах (раунд 37 п.4; раунд 58 п.5 —
     * строго по возрасту). Взрослый — 1.0 (базовый 2.5, как игрок),
     * подросток — 0.85, ребёнок — 0.7.
     */
    interiorAgeScale(npcData) {
        const age = (npcData && npcData.age) || 30;
        if (age <= 12) return 0.7;
        if (age <= 17) return 0.85;
        return 1;
    }

    workInPotter() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;

        if ((player.HP || 0) <= 5) {
            createDialog(this, t('Силы кончились'), t('Руки не поднимаются таскать дрова и мять глину. Нужно поесть и отдохнуть, прежде чем браться за работу.'), [
                { text: t('Справедливо...'), callback: () => {} },
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
            bonusMsg = '\n\n' + tf(t('В углу мастерской блеснула чужая монетка — видать, обронил кто-то из заказчиков. Она твоя: +{0} д.'), bonus);
        }
        player.dengas = (player.dengas || 0) + wage + bonus;
        this.registry.set('player', player);
        this.updateHUD();
        ActionLog.add(this.registry, tf(t('Отработал час в гончарной мастерской: +{0} д., усталость −3 HP.'), wage + bonus));

        // РАУНД 66.17 (п.6): СТАВКА ПОДЁНКИ — за отработанный день герою
        // начисляется МИНИМУМ 1 очко репутации в деревне (раз в сутки;
        // хоть десять часов в день — приработка и так честная, а слава +1/день).
        let repMsg = '';
        const today66 = dayKeyOf(getTime(this.registry));
        const q66 = this.registry.get('quest') || {};
        if (q66.dayworkRepDay !== today66) {
            q66.dayworkRepDay = today66;
            this.registry.set('quest', q66);
            changeVillageRep(this.registry, 1, 'подённая работа');
            repMsg = '\n' + t('Слава о работнике идёт по деревне: +1 к доброй славе (ставка подёнки — раз в сутки).');
            ActionLog.add(this.registry, t('Ставка подёнки: +1 к славе в деревне за отработанный день.'));
        }

        createDialog(this, t('Помощь в мастерской'),
            t('Час у круга и печи: носил дрова, мешал глину, ставил горшки на обжиг. Игнат доволен: «Работник, что надо!»\n\n') +
            tf(t('Заработано: +{0} д. Усталость: −3 здоровья.'), wage) + bonusMsg + repMsg,
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
        createDialog(this, t('Мастерская'),
            t('Гончарного зерна тут нет — только глина, дрова и ряды горшков на просушке.'),
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
        // Раунд 66.16 (приказы 1–3): сушёные яблоки — тоже еда: +1 HP,
        // кулдаун 4 часа; сытый герой яблок не находит (бонус не выпадает).
        if (Math.random() < 0.2 && player && canEat(this.registry).ok && (player.HP || 0) < (player.HPmax || 10)) {
            player.HP = Math.min(player.HPmax || player.HP + MEAL_HEAL_HP, player.HP + MEAL_HEAL_HP);
            registerMeal(this.registry);
            // Приказ 1: перекус — это приём еды, занимает 1 час
            tickTime(this.registry, MEAL_DURATION_MIN);
            this.registry.set('player', player);
            this.updateHUD();
            extra = '\n\n' + t('В углу мастерской нашлась горсть сушёных яблок — Игнат не обидится. Перекус занял час: +1 здоровья.');
            ActionLog.add(this.registry, t('Подкрепился сушёными яблоками в мастерской: +1 HP (час времени).'));
        }
        const mice = [t('мышь-хвостунья черкнула за мешками глины'), t('воробей вылетел в слуховое окно'), t('кот-невидимка оставил следы на просушке')];
        createDialog(this, t('Осмотр мастерской'),
            t('Всё при деле: глина вымешена, горшки на просушке, дрова в поленнице. Пахнет печным жаром.\n\n') +
            t('Мимо ') + mice[Phaser.Math.Between(0, mice.length - 1)] + '.' + extra,
            [{ text: t('Довольно.'), callback: () => {} }]);
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

        // === РАУНД 50 (пп.2,4 заявки): ТАЙЛОВЫЙ ФОН ИЗ ПАКЕТА MEDIEVAL - INTERIORS ===
        // Стены, пол, окна и стационарная мебель запечены в картинку int_bg_<id>
        // (собрана из листов Walls/Furniture/Church/Tavern/Profession). Если фон
        // есть — процедурные пол/стены/окна и СТАТИЧЕСКИЙ декор не рисуются,
        // остаются только живые элементы (огонь, киот, свет). Позиции мебели
        // в фоне совпадают с прежними фракциями декора — точки взаимодействия не сместились.
        const bgKey = 'int_bg_' + interior.id;
        const hasBg = !painted && this.textures.exists(bgKey);
        this._intBg = hasBg;
        if (hasBg) {
            this.add.image(0, 0, bgKey)
                .setOrigin(0, 0).setDisplaySize(width, height).setDepth(-6);
            // Тёплые пятна света над ЗАПЕЧЁННЫМИ очагами (ночь должна светиться).
            // ВАЖНО: this._lightSources создаётся ниже (раунд 9) — страхуемся.
            this._lightSources = this._lightSources || [];
            if (interior.id === 'blacksmith') {
                this._lightSources.push({ x: width * 0.86, y: height * 0.42, w: 300, h: 170, a: 0.6 });
            } else if (interior.id === 'church') {
                this._lightSources.push({ x: width * 0.5, y: height * 0.3, w: 320, h: 150, a: 0.4 });
                this._lightSources.push({ x: width * 0.5, y: height * 0.62, w: 260, h: 130, a: 0.3 });
            } else {
                // очаг слева (дома, таверна) + мягкий светильня в центре горницы
                this._lightSources.push({ x: 90, y: height * 0.48, w: 280, h: 160, a: 0.55 });
                this._lightSources.push({ x: width * 0.56, y: height * 0.55, w: width * 0.72, h: height * 0.62, a: 0.22 });
            }
            // === РАУНД 54: ЖИВОЙ ОГОНЬ В ОЧАГЕ поверх запечённого фона ===
            // (раньше фон был статичной картинкой — печь не горела «живьём»).
            // Кузница: топка горна в центре горна; остальные дома — топка печи
            // слева (центр ≈ (130, 392) на 1280×720 — совпадает с фоном r54).
            if (this.textures.exists('int_fire_0')) {
                const noFire = ['church'];
                if (!noFire.includes(interior.id)) {
                    const fp = interior.id === 'blacksmith'
                        ? { x: width * 0.113, y: height * 0.465, sc: 0.9 }
                        : { x: 130, y: height * 0.545, sc: 1.15 };
                    const fire = this.add.image(fp.x, fp.y, 'int_fire_0')
                        .setScale(fp.sc).setDepth(-5).setAlpha(0.95);
                    let fFrame = 0;
                    this.time.addEvent({
                        delay: 110,
                        loop: true,
                        callback: () => { fFrame = (fFrame + 1) % 4; if (fire.active) fire.setTexture(`int_fire_${fFrame}`); },
                    });
                    // лёгкое «дыхание» пламени
                    this.tweens.add({
                        targets: fire,
                        scale: { from: fp.sc, to: fp.sc * 1.12 },
                        alpha: { from: 0.95, to: 0.8 },
                        duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }
            // Раунд 54: пар над котлом постоялого двора (котёл запечён в фоне на ~275,330)
            if (interior.id === 'tavern' && this.textures.exists('particle_spark')) {
                const steam = this.add.particles(0, 0, 'particle_spark', {
                    x: { min: 258, max: 292 },
                    y: 300,
                    lifespan: 1600,
                    speedY: { min: -26, max: -12 },
                    speedX: { min: -6, max: 6 },
                    scale: { start: 0.22, end: 0.02 },
                    alpha: { start: 0.35, end: 0 },
                    quantity: 1,
                    frequency: 260,
                    tint: 0xf0e8d8,
                }).setDepth(-4);
                steam.setAlpha(0.7);
            }
        }

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
        // Раунд 50: при тайловом фоне (int_bg) НЕ рисуем — непрозрачные плаши
        // на глубине -5 перекрыли бы собой фон на глубине -6.
        if (!painted && !hasBg) {
            const floorGfx = this.add.graphics().setDepth(-5);
            floorGfx.fillStyle(0x3a2616, 1);  // тёмно-коричневый
            floorGfx.fillRect(0, 100, width, height - 100);
            // === ПОДЛОЖКА СТЕН — более светлый коричневый на верхнюю часть ===
            floorGfx.fillStyle(0x5a3a22, 1);
            floorGfx.fillRect(0, 0, width, 100);
        }

        // === Тайлы пола (если загружены) — поверх подложки (раунд 50: пропускается при тайловом фоне) ===
        if (!painted && !hasBg && this.textures.exists('int_floor_0')) {
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
        // === Тайлы стен (если загружены; раунд 50: пропускается при тайловом фоне) ===
        if (!painted && !hasBg && this.textures.exists('int_wall')) {
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
        if (!painted && !hasBg && this.textures.exists('int_window')) {
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

        if (interior.id === 'tavern' && !painted && !hasBg) {
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
        } else if (interior.id === 'blacksmith' && !painted && !hasBg) {
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
        } else if (interior.id === 'elder_house' && !hasBg) {
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
        } else if (interior.id === 'potter_house' && !hasBg) {
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
            // место кражи иконы (осмотр даёт улику). Киот рисуем всегда — это
            // сюжетная точка. Правый верхний угол, чтобы не перекрывать батюшку
            // (0.65, 0.55) и игрока (0.25, 0.55).
            // РАУНД 66.20 (п.2): киот — резное тёмное дерево с кокошником и
            // крестом, глубокая ниша с золотой окладкой (вместо плоской ниши
            // с «пустым нимбом»).
            const kiot = this.add.graphics().setDepth(4);
            const kx = width * 0.86, ky = height * 0.27;
            kiot.fillStyle(0x4a3420, 1);                       // тёмное дерево киота
            kiot.fillRoundedRect(kx - 56, ky - 84, 112, 168, 8);
            kiot.fillStyle(0x1e130a, 1);                       // глубокая ниша
            kiot.fillRoundedRect(kx - 46, ky - 74, 92, 148, 6);
            kiot.fillStyle(0x2c1e10, 1);                       // след от иконы
            kiot.fillRect(kx - 24, ky - 52, 48, 104);
            kiot.lineStyle(3, 0xc9a14a, 1);                    // золотая окладка ниши
            kiot.strokeRoundedRect(kx - 46, ky - 74, 92, 148, 6);
            kiot.lineStyle(2, 0xc9a14a, 0.75);                 // внешний резной пояс
            kiot.strokeRoundedRect(kx - 52, ky - 80, 104, 160, 8);
            // кокошник — ступенчатый верх с крестом
            kiot.fillStyle(0x4a3420, 1);
            kiot.fillTriangle(kx - 40, ky - 84, kx + 40, ky - 84, kx, ky - 118);
            kiot.lineStyle(2, 0xc9a14a, 0.9);
            kiot.strokeTriangle(kx - 40, ky - 84, kx + 40, ky - 84, kx, ky - 118);
            kiot.fillStyle(0xc9a14a, 1);
            kiot.fillRect(kx - 1.5, ky - 140, 3, 18);
            kiot.fillRect(kx - 6, ky - 136, 12, 3);
            this.add.text(kx, ky + 70, t('слово Божие — в сердцах'), {
                fontSize: '10px', color: '#8a7248', fontFamily: 'Georgia, serif',
            }).setOrigin(0.5).setDepth(5);

            // РАУНД 66.20 (п.2): ИКОНОСТАС ИЗ НАСТОЯЩИХ ИКОН-ТАЙЛОВ.
            // Новый фон int_bg_church — пустая деревянная церковь; иконостас
            // и убранство собираются кодом ПОВЕРХ фона ВСЕГДА (а не только в
            // тайловом виде): пророческий ярус, деисус, местный ряд с Царскими
            // вратами и Голгофа — иконы новгородской школы вместо фигур-«идолов».
            this.drawIconostasisWithIcons(width, height);

            // Аналой с иконой — на ковре перед иконостасом.
            // Раунд 66.26 (приказ 4): на аналое БОЛЬШЕ не та же икона Благовещения,
            // что на Царских вратах (видимое дублирование) — иная икона из набора.
            // 66.29 (п.2 приказа): аналой ПЕРЕРИСОВАН — прежний спрайт 48×56
            // при scale 1.3 терялся ногами на красном ковре, икона «висела в
            // воздухе». Теперь: тень + деревянный треножник-пюпитр (графика)
            // с наклонной доской, икона ЛЕЖИТ на доске, ножки до пола.
            {
                const ax = width * 0.5, ay = height * 0.60;
                const ag = this.add.graphics().setDepth(5);
                // тень на полу
                ag.fillStyle(0x000000, 0.28);
                ag.fillEllipse(ax, ay + 66, 92, 20);
                // задние ножки
                ag.fillStyle(0x4a3420, 1);
                ag.fillRect(ax - 30, ay - 10, 9, 74);
                ag.fillRect(ax + 21, ay - 10, 9, 74);
                // наклонная доска-пюпитр (трапеция, лицом к молящимся)
                ag.fillStyle(0x5c422a, 1);
                ag.fillPoints([
                    { x: ax - 42, y: ay + 6 },
                    { x: ax + 42, y: ay + 6 },
                    { x: ax + 34, y: ay - 26 },
                    { x: ax - 34, y: ay - 26 },
                ], true);
                ag.fillStyle(0x6c4e30, 1);                    // верхняя кромка доски
                ag.fillRect(ax - 34, ay - 30, 68, 7);
                ag.lineStyle(2, 0x2e2012, 0.9);               // контуры
                ag.strokePoints([
                    { x: ax - 42, y: ay + 6 },
                    { x: ax + 42, y: ay + 6 },
                    { x: ax + 34, y: ay - 26 },
                    { x: ax - 34, y: ay - 26 },
                ], true, true);
                ag.lineStyle(2, 0xc9a14a, 0.55);              // золотая окладка доски
                ag.strokeRoundedRect(ax - 30, ay - 22, 60, 26, 4);
                // передняя опорная стойка
                ag.fillStyle(0x4a3420, 1);
                ag.fillRect(ax - 5, ay + 4, 10, 62);
                // икона ЛЕЖИТ на наклонной доске
                const analogIcon = this.textures.exists('int_deco_icon_wall')
                    ? 'int_deco_icon_wall' : 'int_deco_icon_annunciation';
                if (this.textures.exists(analogIcon)) {
                    this.add.image(ax, ay - 12, analogIcon)
                        .setDisplaySize(44, 50).setRotation(-0.04).setDepth(6);
                }
            }
            // Угасающая лампада у киота — единственный огонёк после кражи
            if (this.textures.exists('particle_spark')) {
                const lamp = this.add.image(kx - 34, ky + 30, 'particle_spark')
                    .setTint(0xffb84d).setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(7).setScale(0.45);
                this.tweens.add({
                    targets: lamp,
                    alpha: { from: 0.4, to: 0.75 },
                    scale: { from: 0.4, to: 0.55 },
                    duration: Phaser.Math.Between(600, 900),
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
                this._lightSources.push({ x: kx - 30, y: ky + 46, w: 80, h: 40, a: 0.5 });
            }
        } else if (interior.id === 'villager_house_1' && !hasBg) {
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
        } else if (interior.id === 'villager_house_2' && !hasBg) {
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
    /**
     * РАУНД 66.26 (приказы 2,4 владельца): ИКОНОСТАС УМЕНЬШЕН И СДВИНУТ
     * ВПРАВО — прежде панель 0.07..0.78W × 0.07..0.47H накрывала арочное
     * ОКНО на левой стене фона (окно живёт в ~3..12%W) и выглядела непомерно
     * большой. ДУБЛИ ИКОН УБРАНЫ: было 14 слотов из 6 текстур (Никола ×3,
     * Богородица ×3, Иоанн ×3, Архангел ×3, Спас ×2) — теперь РОВНО ШЕСТЬ
     * икон, каждая по одному разу: пророческий ярус (архангел, Никола,
     * Иоанн) + местный ряд (Богородица, Царские врата с Благовещением,
     * Спас крупнее). Голгофский крест над короной и резьба сохранены.
     * Правый край (0.70W) по-прежнему не касается сюжетного пустого киота
     * (0.86W) — святыню не перекрываем.
     */
    drawIconostasisWithIcons(width, height) {
        const g = this.add.graphics().setDepth(4);
        const GOLD = 0xc9a14a, GOLD_D = 0x8c6c2c;
        const WOOD = 0x3a2a18, WOOD_D = 0x291c0e;
        const x0 = width * 0.17, x1 = width * 0.70;
        // 66.29: верх иконостаса опущен с 0.12H до 0.165H — раньше верхняя кромка
        // (86px) заходила под текст описания и плашку даты (60..110px)
        const y0 = height * 0.165, y1 = height * 0.465;
        const iw = x1 - x0, ih = y1 - y0;
        const AR = 0.75; // пропорции икон-тайлов 288x384 (ширина = высота * 0.75)

        // тёмная стена иконостаса + резная рама
        g.fillStyle(WOOD, 1);
        g.fillRect(x0, y0, iw, ih);
        g.fillStyle(WOOD_D, 1);
        g.fillRect(x0, y1 - 8, iw, 8);
        g.lineStyle(4, GOLD, 1);
        g.strokeRect(x0 + 2, y0 + 2, iw - 4, ih - 4);
        g.lineStyle(1, GOLD_D, 0.8);
        g.strokeRect(x0 + 8, y0 + 8, iw - 16, ih - 16);

        // Одна икона-тайл: тёмная доска, золотой оклад, изображение без искажений
        const iconH = (key, cx, cy, icoH) => {
            const icoW = icoH * AR;
            g.fillStyle(0x14100a, 1);
            g.fillRect(cx - icoW / 2 - 2, cy - icoH / 2 - 2, icoW + 4, icoH + 4);
            g.lineStyle(2, GOLD, 1);
            g.strokeRect(cx - icoW / 2 - 1, cy - icoH / 2 - 1, icoW + 2, icoH + 2);
            if (this.textures.exists(key)) {
                this.add.image(cx, cy, key).setDisplaySize(icoW, icoH).setDepth(5);
            } else {
                g.fillStyle(0x6e4a28, 1);
                g.fillRect(cx - icoW / 2, cy - icoH / 2, icoW, icoH);
            }
        };

        const usable = iw - 24;                      // ширина под иконы внутри рамы
        const cxAt = (f) => x0 + 12 + usable * f;    // центр иконы по ярусу
        const t1y = y0 + 12, t1h = ih * 0.34;
        const t2y = t1y + t1h + 12, t2h = y1 - 12 - t2y;

        // --- ярус 1 (верх): пророческий — 3 малые иконы (каждая — единожды) ---
        iconH('int_deco_icon_archangel',  cxAt(0.14), t1y + t1h / 2, t1h);
        iconH('int_deco_icon_nicholas',   cxAt(0.50), t1y + t1h / 2, t1h - 6);
        iconH('int_deco_icon_john',       cxAt(0.86), t1y + t1h / 2, t1h);

        // --- ярус 2 (местный): Богородица | ЦАРСКИЕ ВРАТА (Благовещение) | Спас ---
        iconH('int_deco_icon_theotokos', cxAt(0.12), t2y + t2h / 2, t2h - 6);
        iconH('int_deco_icon_christ',    cxAt(0.88), t2y + t2h / 2, t2h);
        const dw = iw * 0.24, dx = cxAt(0.5) - dw / 2;
        // Царские врата: двойные створки с золотой аркой + Благовещение
        g.fillStyle(WOOD_D, 1);
        g.fillRect(dx, t2y - 6, dw, t2h + 6);
        g.lineStyle(3, GOLD, 1);
        g.strokeRect(dx + 1, t2y - 5, dw - 2, t2h + 4);
        g.lineStyle(2, GOLD, 1);
        g.beginPath();
        g.moveTo(dx + dw / 2, t2y - 5);
        g.lineTo(dx + dw / 2, t2y + t2h + 1);
        g.strokePath();
        if (this.textures.exists('int_deco_icon_annunciation')) {
            this.add.image(dx + dw / 2, t2y + t2h * 0.34, 'int_deco_icon_annunciation')
                .setDisplaySize(t2h * 0.34 * AR, t2h * 0.34).setDepth(5);
        }
        // евангелисты: золотые круги в нижних створках
        [[0.28, 0.74], [0.72, 0.74]].forEach(([ux, uy]) => {
            g.lineStyle(2, GOLD, 0.95);
            g.strokeCircle(dx + dw * ux, t2y + t2h * uy, 6);
        });

        // --- Голгофа над короной ---
        const gx = cxAt(0.5);
        g.fillStyle(GOLD, 1);
        g.fillRect(gx - 2, y0 - height * 0.042, 4, height * 0.042);
        g.fillRect(gx - height * 0.02, y0 - height * 0.03, height * 0.04, 4);
        g.fillRect(gx - height * 0.012, y0 - height * 0.039, height * 0.024, 3);

        // тень основания на полу
        g.fillStyle(0x000000, 0.35);
        g.fillRect(x0 - 4, y1, iw + 8, 6);
    }

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
        // Раунд 46 (п.8 заявки): из статус-бара удалён «✦ Воля» (MP)
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}  💰 ${formatMoney(p.dengas || 0)}`);
    }
}

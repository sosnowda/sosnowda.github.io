// Сцена интерьера здания (таверна, кузница, дома жителей, дом старосты, церковь).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
// 66.97 (§12.3 аудита 66.92, п.5): цены панелей и шансы событий сцены — в конфиге
import { SCENE_PRICES, SCENE_CHANCES } from '../config/GameConfig.js';
import { INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
// Раунд 66.9 (CraftSounds): процедурные звуки ремёсел — молот/прялка/таверна
import { attachCraftAudio } from '../systems/CraftAudio.js';
import SaveManager from '../systems/SaveManager.js';
import { createButton, createDialog, bindRestartOnResize, addSceneMenuButtons, closeAllSingletonDialogs } from '../utils/ui.js';
// §12.3 (66.96): панели меню с трекингом объектов массивом (вместо сноса по depth)
import { MenuPanel } from '../utils/MenuPanel.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd, askMoneyForHelp, isChaseActive } from '../data/thief.js';
import { ARMORS, WEAPONS, formatMoney, equipWeapon, equipArmor } from '../systems/Character.js';
// Раунд 66.28 (пп.9,12): стрелы в продажу — пачки по 10, слот колчана
import { addArrowsToInventory, getQuiver, countInventoryArrows, ARROW_PACK_PRICE, ARROW_PACK_SIZE, QUIVER_CAP } from '../systems/ammo.js';
import { makeQuestOffer, acceptQuest, grantQuestRewards, onLocationVisited, getBlessedSkill } from '../data/questGenerator.js';
// Раунд 66.71 (приказ 6): отказ от озвученного задания — штраф личной репутации
import { applyQuestRefusalPenalty } from '../data/reputation.js';
// Раунд 66.21 (приказ 10): срочное ночное дело (стук в дверь)
import { hasUrgentQuestBusiness } from '../systems/NightKnock.js';
// Раунд 66.21 (приказы 13-14): пожертвование церкви (меню сумм)
import { showDonationMenu } from '../systems/ChurchDonation.js';
import { getTime, formatTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
// Патч 66.46 (приказ 2): тёплый свет зари/заката через окна интерьера
import { attachSunLight } from '../systems/SunLight.js';
import { getWeather } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';
import { findNpc, meetNpc, getNpcDisplayName, getNpcFallbackName } from '../data/npcNames.js';
import { buildNpcLookTextures, npcVariantKey, npcPortraitVariantKey } from '../systems/NpcLook.js';
import { ensureNpcLpcTexture } from '../systems/NpcLpc.js';
// 66.37: калибровка масштаба мировых листов персонажей 128px (были 64)
import { WORLD_K } from '../systems/WorldLook.js';
import { getPresence, PLACE_NAMES, getNpcsAtPlace, NPC_DIALOGUE, pickOutdoorLine } from '../data/npcPresence.js';
import {
    checkNpcWillingToTalk, getNpcRep,
    applyGiftBonus, applyCompliment, applyTreatEveryoneBonus,
    applyQuestCompleteBonus, applyThreat, willNpcRefuseTrade,
    getPriceModifier,
    canMarry, marry, getMarriageCost, getMarriageNpcRepThreshold, getMarriageVillageRepThreshold, getAgeOfMajority,
    getVillageRep, changeVillageRep, changeNpcRepExact,
    isNpcKilled, canBuyMilitaryGear, MILITARY_GEAR_IDS,
    getSmithNpcId, // Раунд 46 (п.1): ученик кузнеца встаёт к горну после гибели мастера
    repActionAllowedToday, markRepActionDone, // 66.21/66.22: дневной лимит похвалы (угрозы не лимитируются)
} from '../data/reputation.js';
// Раунд 48 (пп.2,3 заявки): параметры НПЦ игроку НЕ показываются —
// в информации о жителе видно только во что он одет и что держит в руках
import { getNpcWornLine } from '../data/characters.js';
// Раунд 39 (п.13): STASHES/тюки/сундуки/ларцы удалены из игры целиком
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine } from '../systems/WorldClock.js';
// Раунд 66.16 (приказы 1–4): единые правила еды и сна (кукдауны, поп-апы)
// Раунд 66.17: пропорциональный отдых (8 ч = 100%), минимальный сон 2 часа
import { MEAL_HEAL_HP, MEAL_DURATION_MIN, canEat, registerMeal, canSleep, registerSleep, showMealBlockedPopup, showSleepBlockedPopup, restHealPct, SLEEP_MIN_MIN, canUseHerb, registerHerb, showHerbBlockedPopup, HERB_HEAL_HP } from '../systems/meal.js';
// Раунд 66.17 (п.5): ПРОДАЖА ДОБЫЧИ — трактирщик берёт рыбу/дичь на кухню
// Патч 66.77: сундучный лут идёт в узел КАК КРАДЕНЕЕ (addStolenItem),
// скупка платит за него на 80% меньше (fencePriceOf)
import { sellableLoot, removeFromEntry, cookAtFire, getLootDef, countOf, addItem, addStolenItem } from '../systems/loot.js';
// Раунд 66.70 (приказ 11): МОЛИТВА — откат 8 часов, «Молитва не услышана!»,
// благословение +5 к одной проверке навыка (списывается первой проверкой)
import { canPray, registerPrayer, consumePrayerBless } from '../systems/prayer.js';
// Раунд 66.70 (приказ 14): «Подслушать молву» — проверка «Слуха» за столами
import { skillCheck } from '../systems/BRPEngine.js';
import { overheardRumorLine } from '../data/rumors.js';
// Раунд 66.70 (приказы 1–2): счётчик сытости в HUD (норма 2 трапезы/сутки)
import { hungerStatusLine } from '../systems/hunger.js';
// Патч 66.73 (приказ 14): усталость — сон/отдых восстанавливают ОУ, HUD
// Патч 66.74: spendFatigue теперь и в интерьерах (работы/взлом) — ФИКС:
// workInPotter 66.73 вызывал spendFatigue без импорта (ReferenceError при клике)
import { restFatigueFull, fatigueStatusLine, spendFatigue } from '../systems/fatigue.js';
// Патч 66.73 (приказ 5): ТОРГ — продажа через меню торговли с торгом за цену
import { attemptHaggle, haggleMultFor, canHaggleToday, haggleHintLine } from '../systems/trade.js';
// Патч 66.74 (приказы 4, 5, 7, 12): РЕМЕСЛО/КУЗНЕЧНОЕ ДЕЛО/ГРАМОТА/СКОМОРОШЕСТВО
import { craftDaywork, smithyDaywork, acolyteServe, tavernPerformance, carpenterDaywork, millDaywork, weaveDaywork, claimDayworkRep } from '../systems/jobs.js';
// §12.3 (66.96): канон строкового ключа дня — gameCalendar.dayKey
import { dayKey as gameCalendarDayKey } from '../systems/gameCalendar.js';
// Патч 66.76 (приказы 8–9): заказные товары кузнеца (сабля/кольчуга) —
// цены и порог личной репутации у кузнеца
import { SABRE_SMITH_PRICE, CHAIN_SMITH_PRICE, SMITH_TRUST_REP, canBuySmithSpecial } from '../systems/shopRules.js';
// Патч 66.74 (приказы 13–18): ВЗЛОМ И СУНДУКИ (жилые дома)
import { hasChest, canPickChest, attemptChestPick, CHEST_HOUSES } from '../systems/burglary.js';
// Патч 66.78 (приказы 1–9): ПРЕСТУПНОСТЬ — молва/хозяева/Скупщик/предупреждения
import {
    isFenceInTown, isNightHour, noteFenceSale,
    crimeWarnedOnce, markCrimeWarned, fenceWarnedOnce, markFenceWarned, CRIME_WARNING_TEXT,
} from '../systems/crime.js';
// Патч 66.78 (приказ 9): торговля = фиксированные 30 минут, часы реального
// времени на время панели СТОЯТ (пауза/снятие паузы мировых часов)
import { pauseWorldClock, resumeWorldClock } from '../systems/WorldClock.js';
import { TRADE_MINUTES, chargeTradeTime } from '../systems/trade.js';
// Патч 66.79 (приказы 1–13): ПРАВОСУДИЕ — подозрения, вира, примирение
import {
    isSuspecting, noteTheftDone, attemptInnocence, suspectCheckSkill,
    isCaughtByHost, noteSoldStolen, reconcileNeeds, reconcileWithHost, THEFT_VIRA_SALE,
} from '../systems/justice.js';
// Патч 66.82 (приказы 1–9): ДОЛГИ — еда/ночлег в долг, возврат, отсрочка
import {
    canTakeDebt, takeDebt, repayLoan, attemptDeferral,
    loansOf, totalDebtOf, overdueLoansOf, loanIsOverdue, debtDayIndex,
    creditorNameOf, debtShortLineOf, debtFullLineOf, debtIssuedLabelOf, debtDueLabelOf, debtKindName,
    debtRefusalLine, previewDueLabelOf,
    CREDIT_FOOD_IDS, DEBT_MAX_TOTAL, DEBT_MAX_DEFERRALS,
    // Патч 66.83 (п.10): ЗАКУП — работа в счёт долга без права отказа
    workOffDebt, isBondedTo,
} from '../systems/debts.js';
// Патч 66.79 (пп.9–10): застукали — списания после провала побега
import { applyOwnersCaught } from '../systems/crime.js';
// Патч 66.80 (пп.11-а/г): недельное «забывание» обид + епитимья в церкви
import { tickWeeklyRepForget, performChurchAbsolution, absolutionUsedThisMonth, ABSOLUTION_COST, ABSOLUTION_REP } from '../systems/repBalance.js';
// Патч 66.80 (п.12-в): «О слове» — торг о ставке подёнки (раз в сутки)
import { attemptWageDeal, canWageDealToday, wageDealMultFor } from '../systems/repBalance.js';
// Патч 66.74 (приказ 5): служка — окно богослужения (SERVICES)
import { SERVICES } from '../systems/ChurchBells.js';
// Патч 66.73 (приказ 16): обаяние беседы — ±5/±10 к разговорным проверкам
import { chaAdjustedTalkSkill } from '../systems/charisma.js';
// Раунд 66.17 (п.6): ставка подёнки — +1 к репутации за отработанный день
import { dayKeyOf } from '../data/daily.js';

export class InteriorScene extends Phaser.Scene {
    constructor() {
        super('Interior');
    }

    init(data) {
        this.interiorId = data?.interiorId || 'elder_house';
        this.from = data?.from || 'Village';
        // Патч 66.74 (приказ 13): режим ВЗЛОМА — игрок вскрыл замок пустого дома
        // (VillageScene attemptBreakIn). В пустом доме доступен сундук.
        this.burglary = !!(data && data.burglary);
        // 66.94 (P2-7 аудита игры): флаги открытых меню не переживают рестарт
        // сцены (bindRestartOnResize → scene.restart → init). Рестарт при
        // открытом «Провести время»/«Скупка» оставлял __spendTimeOpen/
        // __sellLootOpen = true НАВСЕГДА: гард exitAction (787) убивал ESC,
        // гард showTavernRestMenu (2365) — «Отдых», в этом экземпляре сцены.
        // Образец — сброс busyDialog в LocationScene.init (раунд 30 QA-фикс).
        this.__spendTimeOpen = false;
        this.__sellLootOpen = false;
        // 66.94 (P2-8 аудита): свежий массив источников света на каждый вход.
        // Раньше старые визиты протекали в новый create() — см. гвард на 4054.
        this._lightSources = [];
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        // Патч 66.80 (п.11-а): ленивый недельный тик «забывания» мелких обид
        tickWeeklyRepForget(this.registry, getTime(this.registry));
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
            createDialog(this, t('❓ Информация по игре'),
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
        // Патч 66.74 (приказ 16): ПУСТОЙ ЛИ ДОМ (взлом сундука — только когда
        // никого нет): хозяин не дома И вторая родня (жена) тоже не дома.
        let secondaryHere = false;
        if (hasNpc && interior.secondaryNpcId) {
            const secPresence = getPresence(this.registry, interior.secondaryNpcId);
            secondaryHere = secPresence.place === 'home' || secPresence.place === this.interiorId;
        }
        this.houseEmpty = hasNpc && !ownerHere && !secondaryHere;
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
            // взрослый = как игрок, подросток ×0.85, ребёнок ×0.7
            // 66.37: × WORLD_K (листы 128px) — фигуры прежнего размера
            this.npcBaseScale = 2.5 * WORLD_K * this.interiorAgeScale(this.npcData);
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
            // П.7: NPC интерактивен — ЛКМ запускает разговор.
            // Патч 66.73 (приказ 1): разговор открывается по pointerup, НЕ по
            // pointerdown: диалог, созданный в pointerdown, ловил pointerup ТОГО
            // ЖЕ клика — кнопка выбора под курсором срабатывала мгновенно
            // («автоматический двойной клик»), начальный экран пропускался.
            this.npcSprite.setInteractive({ useHandCursor: true });
            this.npcSprite.on('pointerup', (pointer) => {
                // Только ЛКМ (кнопка отпущена)
                if (pointer.leftButtonReleased() && !this.busyDialog) {
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
            // Патч 66.83 (п.12): подсказка у мастерских — почему работа без хозяина
            if (interior.id === 'potter_house' || interior.id === 'weaver_house' || interior.id === 'carpenter_house') {
                this.add.text(width * 0.65, height * 0.74, t('\u{2692} Хозяин на поле — мастерская без присмотра: можно поработать.'), {
                    fontSize: '11px', color: '#8a9a6a',
                    backgroundColor: '#00000088', padding: { x: 6, y: 3 },
                }).setOrigin(0.5).setDepth(20);
            }
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
                const secScale = 2.5 * WORLD_K * this.interiorAgeScale(secData);
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
                // Патч 66.73: pointerup вместо pointerdown — защита от
                // «двойного клика» (см. комментарий у npcSprite выше)
                secSpr.on('pointerup', (pointer) => {
                    if (pointer.leftButtonReleased() && !this.busyDialog) {
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
                const vSpr = this.add.sprite(vx, vy, vFinal).setScale(2.5 * WORLD_K * this.interiorAgeScale(vData)).setDepth(7);
                const vAnim = `${vFinal}_idle_down`;
                if (this.anims.exists(vAnim)) vSpr.play(vAnim);
                vSpr.setInteractive({ useHandCursor: true });
                // Патч 66.73: pointerup вместо pointerdown — защита от
                // «двойного клика» (см. комментарий у npcSprite выше)
                vSpr.on('pointerup', (pointer) => {
                    if (pointer.leftButtonReleased() && !this.busyDialog) {
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
        this.playerSprite = this.add.sprite(width * 0.25, spawnY, safePlayerKey, 0).setScale(2.5 * WORLD_K);
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

        // ----- Патч 66.46 (приказ 2): тёплый слой солнца (без теней — под
        // крышей): заря красит избу золотым через окна, закат — багрянцем.
        this.sunLight = attachSunLight(this, { shadowDepth: 0.2, overlayDepth: 94.5 });

        // ----- HUD -----
        // Раунд 9: y = height-88 — НАД рядом кнопок (при 7 кнопках строка кнопок
        // начинается с x≈160 и перекрывала HUD на height-60)
        this.hud = this.add.text(16, height - 88, '', {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);

        // Дата и время сверху (п.13) — плотная подложка: читается и на живописном фоне
        if (timeState) {
            // Раунд 66.70 (приказы 1–2): рядом с датой — норма трапез (2/сутки);
            // ссылка сохраняется — счётчик обновляется в updateHUD
            this.dateHungerLine = this.add.text(width / 2, 55, `📅 ${formatDateTime(timeState)}  ·  ${hungerStatusLine(this.registry)}  ·  ${fatigueStatusLine(this.registry)}`, {
                fontSize: '11px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 2,
                backgroundColor: '#000000d9', padding: { x: 8, y: 4 },
            }).setOrigin(0.5, 0).setDepth(100);
        }

        this.updateHUD();

        // ============================================================
        // ПАТЧ 66.74 (приказы 14–16): СУНДУК В КАЖДОМ ЖИЛОМ ДОМЕ.
        // Рисуется в углу (до кнопок); взаимодействие — кнопкой в ряду
        // (только в ПУСТОМ доме: приказ 16 «только если в доме никого нету»).
        // ============================================================
        if (hasChest(interior.id)) {
            this.drawChestInterior(interior, width, height);
        }

        // ============================================================
        // ПАТЧ 66.78 (приказы 4–5): СКУПЩИК — ночной гость постоялого двора.
        // Рисуется в тёмном углу ТОЛЬКО ночью и только в свои ночи недели;
        // покупает ТОЛЬКО краденое (кнопка рядом с остальными действиями).
        // ============================================================
        this.fenceHere = false;
        if (interior.id === 'tavern') {
            const tsNow = getTime(this.registry);
            this.fenceHere = !!isFenceInTown(this.registry, tsNow);
            if (this.fenceHere) {
                this.drawFenceInterior(width, height);
            }
        }

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
            // ПАТЧ 66.79 (пп.1,6): обворованный хозяин ПОДОЗРЕВАЕТ игрока —
            // кнопка «Мириться» (вернуть краденое/компенсировать + вира)
            if (isSuspecting(this.registry, interior.npcId) || isCaughtByHost(this.registry, interior.npcId)) {
                buttons.push({ label: t('\u{1F91D} Мириться (кража)'), bg: 0x5a4a1a, hover: 0x6a5a2a, cb: () => this.showReconcileMenu(interior) });
            }
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
                // Патч 66.73 (приказ 8): ПЕЧЬ ПОСТОЯЛОГО ДВОРА — самостоятельная
                // готовка игрока (сырые грибы/мясо/рыба → готовое блюдо, Готовка)
                buttons.push({ label: t('\u{1F525} Печь (Готовка)'), bg: 0x6a3a1a, hover: 0x7a4a2a, cb: () => this.showStoveCookMenu(interior) });
                // Раунд 66.70 (приказ 14): «Слух» получил игровое применение —
                // подслушать молву за столами постоялого двора (исторично: двор —
                // средоточие вестей на Руси XV века)
                buttons.push({ label: t('\u{1F442} Подслушать (Слух)'), bg: 0x4a4a2a, hover: 0x5a5a3a, cb: () => this.eavesdropTavern(interior) });
                // Патч 66.74 (приказ 7): СКОМОРОШЕСТВО — гусли за столом
                // (сбор со стола за успех; риск гнева Церкви)
                buttons.push({ label: t('\u{1FA95} Скоморошить (Скоморошество)'), bg: 0x5a3a1a, hover: 0x6a4a2a, cb: () => this.performAtTavern(interior) });
                buttons.push({ label: t('\u{1F6CF} Отдых'), bg: 0x4a3a5a, hover: 0x5a4a6a, cb: () => this.showTavernRestMenu(interior) });
                // Патч 66.82 (пп.1,6,7): ДОЛГИ — постоянная кнопка трактирщика:
                // вернуть долг или просить отсрочку (кнопка всегда видна —
                // нижняя панель не перестраивается после взятия долга)
                buttons.push({ label: t('\u{1FA99} Долги'), bg: 0x6a4a1a, hover: 0x7a5a2a, cb: () => this.showDebtsMenu(interior) });
                // Патч 66.83 (п.10): ЗАКУП — час работы в счёт долга; плата
                // целиком уходит в погашение, отказаться нельзя до полной выплаты
                if (loansOf(this.registry).some(l => l.npcId === 'tavernkeeper')) {
                    buttons.push({ label: t('\u{2692} Отработать долг (1 час)'), bg: 0x4a3a1a, hover: 0x5a4a2a, cb: () => this.workOffDebtAtTavern(interior) });
                }
                // ПАТЧ 66.78 (приказы 4–5): СКУПЩИК — скупка ТОЛЬКО краденого,
                // только по ночам и только в его ночи (3–5 ночей недели)
                if (this.fenceHere) {
                    buttons.push({ label: t('\u{1F31B} Скупщик (краденое)'), bg: 0x242436, hover: 0x343446, cb: () => this.showFenceMenu(interior) });
                }
                // Раунд 40 (заявка): «⏳ Провести время» — перемотка 1–24 ч /
                // до утра / до полудня / до вечера, чтобы не мотаться
                // деревня↔околица (по 2 ч за цикл) ради часов.
                buttons.push({ label: t('\u{23F3} Время'), bg: 0x2a4a5a, hover: 0x3a5a6a, cb: () => this.showSpendTimeMenu() });
                // Раунд 39 (п.13): кнопка «Мой тюк» УДАЛЕНА вместе со всеми тюками
            } else if (interior.id === 'blacksmith') {
                buttons.push({ label: t('\u{1F6D2} Купить оружие'), bg: 0x3a5a3a, hover: 0x4a6a4a, cb: () => this.showBlacksmithShop('weapon') });
                // Патч 66.74 (приказ 12): КУЗНЕЧНОЕ ДЕЛО — работа у горна за деньги
                buttons.push({ label: t('\u{1F528} Помочь кузнецу (1 час)'), bg: 0x6a3a1a, hover: 0x7a4a2a, cb: () => this.helpBlacksmith(interior) });
                // Патч 66.80 (п.12-в): торг о ставке с кузнецом
                if (canWageDealToday(this.registry)) {
                    buttons.push({ label: t('\u{1F91D} О слове (Убеждение)'), bg: 0x2a4a5a, hover: 0x3a5a6a, cb: () => this.wageDealDialog('blacksmith', t('кузнеца')) });
                }
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
                // Патч 66.80 (п.11-г): ЕПИТИМЬЯ — «замолить грехи» 50 д. раз в месяц
                // (снимает до −5 деревенской молвы; видна только при плохой молве)
                if (getVillageRep(this.registry) < 0 && !absolutionUsedThisMonth(this.registry, getTime(this.registry))) {
                    buttons.push({ label: tf(t('⛪ Замолить грехи ({0} д.)'), ABSOLUTION_COST), bg: 0x5a2a4a, hover: 0x6a3a5a, cb: () => this.absolutionInChurch() });
                }
                buttons.push({ label: t('\u{1F50D} Осмотреть киот'), bg: 0x2a4a6a, hover: 0x3a5a7a, cb: () => this.inspectChurchKiot() });
                // Патч 66.74 (приказ 5): ГРАМОТА — служка при богослужении
                buttons.push({ label: t('\u{1F4D6} Служить при службе (Грамота)'), bg: 0x2a5a4a, hover: 0x3a6a5a, cb: () => this.serveAtChurch(interior) });
            }
        } else if (interior.id === 'potter_house') {
            // Раунд 37 (вариант Б): мастерская гончара — подённая работа
            // переехала сюда из удалённого амбара (п.18 заявки)
            buttons.push({ label: t('\u{1FAB5} Помочь в мастерской (1 час)'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.workInPotter() });
            // Патч 66.80 (п.12-в): «О слове» — торг о ставке (раз в сутки)
            if (canWageDealToday(this.registry)) {
                buttons.push({ label: t('\u{1F91D} О слове (Убеждение)'), bg: 0x2a4a5a, hover: 0x3a5a6a, cb: () => this.wageDealDialog('potter1', t('гончара')) });
            }
            // Раунд 39 (п.13): кнопка «Мой узел» УДАЛЕНА вместе со всеми тюками
            // Патч 66.74 (приказ 14): сундук гончара — только если дом ПУСТ
            if (this.houseEmpty) this.pushChestButton(interior, buttons);
        } else if (interior.id === 'weaver_house') {
            // Патч 66.76 (приказ 3): ТКАЧЕСТВО — подёнка за станком,
            // оплата полотном/сукном (товары Руси, скупка Фёдора/Потапа).
            // Патч 66.77 (приказ 5): станок ткачихи — ТОЛЬКО для ЖЕНСКОГО
            // персонажа (мужская кнопка не показывается вовсе).
            if (player && player.gender === 'female') {
                buttons.push({ label: t('\u{1F9F6} Помочь за станком (1 час)'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.workInWeaver() });
                // Патч 66.80 (п.12-в): торг о ставке и с ткачихой
                if (canWageDealToday(this.registry)) {
                    buttons.push({ label: t('\u{1F91D} О слове (Убеждение)'), bg: 0x2a4a5a, hover: 0x3a5a6a, cb: () => this.wageDealDialog('weaver1', t('ткачихи')) });
                }
            }
            // Патч 66.76: сундук ткачихи — как у плотника (подёнка + сундук)
            if (this.houseEmpty && hasChest(interior.id)) this.pushChestButton(interior, buttons);
        } else if (interior.id === 'carpenter_house') {
            // Патч 66.76 (приказ 4): ПЛОТНИЦКОЕ ДЕЛО — подёнка у сруба, 3–6 д.
            buttons.push({ label: t('\u{1FA93} Помочь плотнику (1 час)'), bg: RUS.accent, hover: RUS.accentLight, cb: () => this.workInCarpenter() });
            // Патч 66.80 (п.12-в): торг о ставке с плотником
            if (canWageDealToday(this.registry)) {
                buttons.push({ label: t('\u{1F91D} О слове (Убеждение)'), bg: 0x2a4a5a, hover: 0x3a5a6a, cb: () => this.wageDealDialog('carpenter1', t('плотника')) });
            }
            // Патч 66.76: сундук плотника — общий путь для пустых жилых домов
            // (else-ветка ниже по hasChest; в домах мастеров кнопка подёнки
            // и сундук показываются вместе)
            if (this.houseEmpty && hasChest(interior.id)) this.pushChestButton(interior, buttons);
        } else if (this.houseEmpty && hasChest(interior.id)) {
            // Патч 66.74 (приказы 13–16): в ПУСТОМ доме доступен сундук
            // (взлом замка двери — на улице, через поп-ап «Дом закрыт»)
            this.pushChestButton(interior, buttons);
        }
        // ============================================================
        // ПАТЧ 66.83 (п.12): СЕРЫЕ КНОПКИ-ПОДСКАЗКИ В МАСТЕРСКИХ.
        // Подёнка/станок и «О слове» у гончара, ткачихи и плотника видны,
        // только когда хозяин ВНЕ дома; игрок не понимает, почему кнопки
        // нет. При хозяине ДОМА видны серые кнопки: клик объясняет, что
        // работать можно, когда «хозяин на поле».
        // ============================================================
        if (hasNpc && ownerHere && !ownerKilled &&
            (interior.id === 'potter_house' || interior.id === 'weaver_house' || interior.id === 'carpenter_house')) {
            const workLabel = interior.id === 'weaver_house'
                ? t('\u{1F9F6} Станок — хозяин дома')
                : (interior.id === 'carpenter_house' ? t('\u{1FA93} Подёнка — хозяин дома') : t('\u{1FAB5} Подёнка — хозяин дома'));
            buttons.push({ label: workLabel, bg: 0x332d24, hover: 0x332d24, cb: () => this.showOwnerHomeHint(interior) });
            buttons.push({ label: t('\u{1F91D} О слове — хозяин дома'), bg: 0x332d24, hover: 0x332d24, cb: () => this.showOwnerHomeHint(interior) });
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
        // ПАТЧ 66.79 (пп.1–4): обворованный хозяин ВСЕГДА подозревает —
        // сперва проверка «невиновности» разговорным навыком (или мир, п.6).
        if (isSuspecting(this.registry, interior.npcId)) {
            this.showSuspicionDialog(interior);
            return;
        }
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

    // ================================================================
    // ПАТЧ 66.79 (пп.1–4): ПОДОЗРЕНИЕ В КРАЖЕ — проверка «невиновности».
    // Обворованный хозяин смотрит косо: разговорный навык (лучший из
    // Убеждения/Болтовни, −15% за каждую прежнюю кражу у него — п.3).
    // Успех — подозрение снято до следующей кражи (п.2); провал —
    // репутация у НПЦ −10 и в деревне −5 (точно, п.4).
    // ================================================================
    showSuspicionDialog(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const chk = suspectCheckSkill(this.registry, interior.npcId, player);
        this.busyDialog = true;
        const difficultyNote = chk.penalty > 0
            ? '\n\n' + tf(t('Он уже не раз терял добро: разговор придётся вести хитрее (сложность −{0}% за {1} прежние кражи).'), chk.penalty, chk.thefts - 1)
            : '';
        createDialog(this, t('👁 Косые взгляды'),
            tf(t('{0} сразу смекает, что дела тут нечисти: после пропажи в доме ты первый в подозреваемых. Отведи подозрение разговором — иначе будет хуже.'), npcName)
            + difficultyNote,
            [
                { text: tf(t('Отвести подозрение ({0}%)'), chk.effective), callback: () => { this.busyDialog = false; this.runInnocenceCheck(interior); } },
                { text: t('🤝 Признаться и помириться'), callback: () => { this.busyDialog = false; this.showReconcileMenu(interior); } },
                { text: t('Отступить'), callback: () => { this.busyDialog = false; } },
            ],
            { singleton: false, portraitKey: this.npcPortraitKey });
    }

    /** Проверка «невиновности» (пп.1–4) и её исход. */
    runInnocenceCheck(interior) {
        const player = this.registry.get('player');
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const res = attemptInnocence(this.registry, interior.npcId, player);
        this.registry.set('player', player);
        this.updateHUD();
        if (res.ok) {
            ActionLog.add(this.registry, tf(t('Проверка «невиновности» у {0} пройдена ({1}%: бросок {2}).'), npcName, res.effective, res.roll));
            // П.2: подозрение снято — разговор идёт своим чередом
            const npc = this.npcData;
            if (npc && !npc.met) {
                meetNpc(this.registry, interior.npcId);
            }
            this.busyDialog = true;
            this.dialogue.run(interior.dialogueId, () => {
                this.busyDialog = false;
                const end = checkGameEnd(this.registry);
                if (end) this.scene.start('End');
            });
        } else {
            createDialog(this, t('👆 Не уверил!'),
                tf(t('{0} отворачивается с сердитым видом: слова твои лживы, и добро пропало не само. По деревне уже шепчутся.\n\n(Репутация у {0} −10, в деревне −5.)'), npcName),
                [{ text: t('Замолчать'), callback: () => { this.busyDialog = false; } }],
                { singleton: false, portraitKey: this.npcPortraitKey });
        }
    }

    // ================================================================
    // ПАТЧ 66.79 (п.6): ПРИМИРЕНИЕ С ОБКРАДЕННЫМ ХОЗЯИНОМ.
    // Вернуть украденное (вещами) или компенсировать сбытое деньгами
    // по полной стоимости + вира за кражу (24 д., Судебник 1497).
    // После мира: подозрение снято, обида смыта, стражник за этот дом
    // причин задерживать героя больше не имеет.
    // ================================================================
    showReconcileMenu(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const needs = reconcileNeeds(this.registry, player, interior.id);
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        this.busyDialog = true;
        const lines = [tf(t('{0} сидит над пепелищем доверия. Чтобы очистить душу и избежать суда, надобно:'), npcName)];
        if (needs.entries.length > 0) {
            lines.push(t('• вернуть украденное из его дома:') + '\n' + needs.entries.map(e => `  ${e.emoji} ${t(e.name)} ×${e.count}`).join('\n'));
        } else {
            lines.push(t('• украденного в узле не осталось — всё сбыто, придётся платить.'));
        }
        if (needs.soldValue > 0) {
            lines.push(tf(t('• компенсировать сбытое деньгами по полной стоимости: {0} д.'), needs.soldValue));
        }
        lines.push(tf(t('• выплатить виру за кражу: {0} д. (Судебник 1497, о татбе).')), tf(t('Итого: {0} д. (В узле сейчас {1} д.)'), needs.total, player.dengas || 0));
        createDialog(this, t('🤝 Мириться (кража)'),
            lines.join('\n')
            + '\n\n' + t('После мира хозяин простит: подозрение снимется, обида смоется серебром (репутация хозяина станет не ниже 0).'),
            [
                {
                    text: needs.total > 0 ? tf(t('Свершить мир ({0} д.)'), needs.total) : t('Свершить мир'),
                    callback: () => { this.busyDialog = false; this.doReconcile(interior); },
                },
                { text: t('Пока нет'), callback: () => { this.busyDialog = false; } },
            ],
            { singleton: false, portraitKey: this.npcPortraitKey });
    }

    /** Примирение (п.6) — списания и исход. */
    doReconcile(interior) {
        const res = reconcileWithHost(this.registry, interior.npcId, interior.id);
        this.updateHUD();
        if (!res.success) {
            createDialog(this, t('🤝 Мир не вышел'),
                tf(t('Не хватает серебра: надобно {0} д., а в узле лишь {1} д. Примиришься, когда достанешь денег — или Стражник у ворот рассудит по Судебнику.'), res.total, (this.registry.get('player') || {}).dengas || 0),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singleton: false });
            return;
        }
        if (this.audioManager) this.audioManager.playGoldReceive();
        ActionLog.add(this.registry, tf(t('Примирился с обкраденным в «{0}»: возвращено {1} шт., уплачено {2} д. (в т.ч. вира {3} д.).'), interior.name, res.returnedCount, res.soldPaid + res.vira, res.vira));
        createDialog(this, t('🤝 Обида смыта'),
            tf(t('Вещи легли на место, серебро перешло в руки хозяина — мир по Судебнику свершен! Репутация хозяина теперь {0}, и у ворот деревни за этот дом тебя не тронут.'), res.npcRepNow >= 0 ? '+' + res.npcRepNow : res.npcRepNow),
            [{ text: t('Мир-дружба'), callback: () => { this.busyDialog = false; } }],
            { singleton: false });
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
                    // Раунд 66.71 (приказ 6): отказ от озвученного задания
                    // понижает личную репутацию у НПЦ на 1–3 единицы.
                    const pen = applyQuestRefusalPenalty(this.registry, interior.npcId);
                    ActionLog.add(this.registry, tf(t('Отказался от задания: «{0}». Личная репутация у НПЦ −{1}.'), quest.title, pen));
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
        
        // §12.3 (66.96): панель с трекингом объектов массивом (MenuPanel);
        // алиасы overlay/panel оставлены для ссылок внутри метода
        const menu = this._menu = this._giftMenu = new MenuPanel(this, { panelW: 500, panelH: 450 });
        const overlay = menu.overlay, panel = menu.panel;
        const panelW = menu.panelW, panelH = menu.panelH;

        menu.text(width / 2, height / 2 - panelH / 2 + 25, tf(t('Подарить {0}'), npcName), {
            fontSize: '18px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        let y = height / 2 - panelH / 2 + 65;

        // Подарить деньги (SCENE_PRICES.giftSmall.cost — 66.97 §12.3: цена панели из конфига)
        menu.button( width / 2, y, tf(t('💸 Подарить {0} денег'), SCENE_PRICES.giftSmall.cost), () => {
            if ((player.dengas || 0) < SCENE_PRICES.giftSmall.cost) {
                createDialog(this, t('Подарок'), t('Не хватает денег!'), [{ text: t('Понятно'), callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= SCENE_PRICES.giftSmall.cost;
            this.registry.set('player', player);
            // П.6: ценность денег = номинал × 0.5 = SCENE_PRICES.giftSmall.value
            const result = applyGiftBonus(this.registry, interior.npcId, SCENE_PRICES.giftSmall.value);
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

        // Подарить деньги (SCENE_PRICES.giftLarge.cost — 66.97 §12.3)
        menu.button( width / 2, y, tf(t('💸 Подарить {0} денег'), SCENE_PRICES.giftLarge.cost), () => {
            if ((player.dengas || 0) < SCENE_PRICES.giftLarge.cost) {
                createDialog(this, t('Подарок'), t('Не хватает денег!'), [{ text: t('Понятно'), callback: () => {} }],
                    { singleton: false, portraitKey: interior.portrait });
                return;
            }
            player.dengas -= SCENE_PRICES.giftLarge.cost;
            this.registry.set('player', player);
            // П.6: ценность = SCENE_PRICES.giftLarge.value
            const result = applyGiftBonus(this.registry, interior.npcId, SCENE_PRICES.giftLarge.value);
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
            menu.text(width / 2, y, t('Предметы из инвентаря:'), {
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

                menu.button( width / 2, y, `📦 ${itemLabel}`, () => {
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
        menu.button( width / 2, height / 2 + panelH / 2 - 25, t('Закрыть'), () => {
            this._closeGiftMenu(overlay, panel);
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 20, right: 20, top: 8, bottom: 8 },
        }).setDepth(202);
    }

    _closeGiftMenu() {
        // §12.3 (66.96): точечное закрытие по массиву трекинга (был снос по depth)
        this._giftMenu?.close();
        this._giftMenu = null;
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
        // Раунд 66.71 (п.10): похвала идёт от навыка «Болтовня» (fast_talk);
        // «Красноречие» удалено. Благословение батюшки усиливает навык (+10%).
        // Патч 66.73 (приказ 16): обаяние беседы (Харизма vs Харизма) даёт ±5/±10
        const fastTalkSkill = chaAdjustedTalkSkill(this.registry,
            getBlessedSkill(this.registry, player.skills.fast_talk || 10));
        const result = applyCompliment(this.registry, interior.npcId, fastTalkSkill);
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
        // Раунд 66.71: благословение усиливает и Запугивание (+10%)
        // Патч 66.73 (приказ 16): обаяние беседы — разговорные проверки ±5/±10
        const intimidateSkill = chaAdjustedTalkSkill(this.registry,
            getBlessedSkill(this.registry, player.skills.intimidate || 15));
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
        // Патч 66.78 (приказ 9): открыта торговля — счётчик реального времени стоит
        pauseWorldClock(this.registry);
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
        // §12.3 (66.96): панель с трекингом объектов массивом (MenuPanel)
        const menu = this._menu = new MenuPanel(this, {
            panelW: 560, panelH: 440,
            onClose: () => {
                // Патч 66.78 (приказ 9): панель закрыта — реальное время снова идёт
                resumeWorldClock(this.registry);
            },
        });
        const overlay = menu.overlay, panel = menu.panel;
        const panelW = menu.panelW, panelH = menu.panelH;

        const closeMenu = () => menu.close();

        menu.text(width / 2, height / 2 - panelH / 2 + 30, market.title || interior.name, {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        menu.text(width / 2, height / 2 - panelH / 2 + 62,
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
            menu.button( width / 2, y, desc, () => {
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
                    // Еда/мелочь: эффект сразу (HP) — раунд 66.71: МР удалён (приказ 7)
                    if (item.heal) player.HP = Math.min(player.HPmax, player.HP + item.heal);
                }
                this.registry.set('player', player);
                ActionLog.add(this.registry, tf(t('Купил «{0}» в «{1}» за {2} д.{3}'), t(item.name), interior.name, price, logNote ? ` (${logNote})` : ''));
                // Патч 66.78 (приказ 9): любая покупка — 30 минут
                chargeTradeTime(this.registry);
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
        menu.button( width / 2, height / 2 + panelH / 2 - 34, t('Закрыть'), closeMenu, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 24, right: 24, top: 7, bottom: 7 },
        }).setDepth(202);
    }

    showTavernShop() {
        // РАУНД 66.20: анти-стакинг — закрыть открытые диалоги перед панелью
        closeAllSingletonDialogs(this);
        // Патч 66.78 (приказ 9): открыта торговля — счётчик реального времени стоит
        // (еда при покупке съедается сразу — её час считается по meal.js, приказ 66.77)
        pauseWorldClock(this.registry);
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
        // Медовуха и квас — питьё: +1 HP. Раунд 66.71: МР удалён (приказ 7).
        const priceMod = getPriceModifier(this.registry, 'tavernkeeper');
        const modNote = priceMod < 1 ? t(' (скидка за добрую славу)') : (priceMod > 1 ? t(' (наценка за дурную славу)') : '');
        const mkEffect = (heal) => `+${heal} HP · ${t('1 час')}`;
        const items = [
            { id: 'bread', name: 'Хлеб', price: Math.max(1, Math.round(2 * priceMod)), effect: mkEffect(2), heal: 2 },   // полноценная еда
            { id: 'kasha', name: 'Каша', price: Math.max(1, Math.round(5 * priceMod)), effect: mkEffect(3), heal: 3 },   // самая сытная
            { id: 'mead', name: 'Медовуха', price: Math.max(1, Math.round(4 * priceMod)), effect: mkEffect(1), heal: 1 }, // питьё
            { id: 'kvass', name: 'Квас', price: Math.max(1, Math.round(3 * priceMod)), effect: mkEffect(1), heal: 1 },   // питьё
        ];

        const { width, height } = this.scale;
        // Подложка
        // §12.3 (66.96): панель с трекингом объектов массивом (MenuPanel)
        const menu = this._menu = new MenuPanel(this, { panelW: 500, panelH: 420 });
        const overlay = menu.overlay, panel = menu.panel;
        const panelW = menu.panelW, panelH = menu.panelH;

        menu.text(width / 2, height / 2 - panelH / 2 + 30, t('Постоялый двор «У дороги» — меню'), {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        menu.text(width / 2, height / 2 - panelH / 2 + 65,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}${modNote}`, {
            fontSize: '17px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Список товаров
        const startY = height / 2 - panelH / 2 + 112;
        items.forEach((item, i) => {
            const y = startY + i * 44;
            const canAfford = (player.dengas || 0) >= item.price;
            const creditFood = CREDIT_FOOD_IDS.includes(item.id); // п.2: только хлеб и каша
            const btnLabel = creditFood && !canAfford
                ? `${t(item.name)} — ${item.price} ${t('д.')} (${item.effect}) · ${t('в долг')}`
                : `${t(item.name)} — ${item.price} ${t('д.')} (${item.effect})`;
            menu.button( width / 2, y, btnLabel, () => {
                if (!canAfford) {
                    // Патч 66.82 (пп.2,4): денег нет — еда в ДОЛГ у трактирщика
                    // (только хлеб и каша; хмельного в долг не дают)
                    this.offerFoodOnCredit(item);
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
                registerMeal(this.registry); // приказ 3: кулдаун 4 часа
                // Приказ 1: еда ВСЕГДА занимает 1 час игрового времени
                tickTime(this.registry, MEAL_DURATION_MIN);
                this.registry.set('player', player);
                ActionLog.add(this.registry, tf(t('Купил и съел «{0}» на постоялом дворе за {1} д. (+{2} HP, час времени).'), t(item.name), item.price, item.heal));
                this.updateHUD();
                // Закрыть меню и открыть заново с обновлённым балансом
                // (§12.3: точечное закрытие по массиву трекинга; время остаётся
                // на паузе — панель тут же открывается заново)
                menu.close();
                this.showTavernShop();
            }, {
                backgroundColor: canAfford ? 0x3a5a3a : 0x3a3a3a,
                hoverColor: canAfford ? 0x4a6a4a : 0x4a4a4a,
                textColor: canAfford ? RUS.text : '#888',
                fontSize: 16, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setDepth(202);
        });

        // Кнопка закрытия
        menu.button( width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), () => {
            // §12.3 (66.96): точечное закрытие по массиву трекинга;
            // Патч 66.78 (приказ 9): панель закрыта — реальное время снова идёт
            menu.close();
            resumeWorldClock(this.registry);
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 17, padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setDepth(202);
    }

    /**
     * Патч 66.82 (пп.2,4): ЕДА В ДОЛГ у трактирщика, когда денег не хватает.
     * Только хлеб и каша (хмельного в долг не дают — «пропьёшь»); условия п.4:
     * положительная репутация в деревне И у трактирщика, суммарный долг ≤ 100 д.,
     * просрочек быть не должно. Долг создаётся с двумя сроками (п.6), репутация
     * падает по сумме (п.5). Еда съедается сразу (канон 66.77).
     */
    offerFoodOnCredit(item) {
        const player = this.registry.get('player');
        if (!player) return;
        if (!CREDIT_FOOD_IDS.includes(item.id)) {
            createDialog(this, t('Постоялый двор'),
                t('«Хмельного в долг не держу — пропьёшь. А вот хлеб да кашу — это дело другое».'),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: 'portrait_tavernkeeper' });
            return;
        }
        const chk = canTakeDebt(this.registry, item.price);
        if (!chk.ok) {
            createDialog(this, t('Постоялый двор'), debtRefusalLine(chk.reason),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: 'portrait_tavernkeeper' });
            return;
        }
        const dueLabel = previewDueLabelOf(this.registry);
        createDialog(this, t('🪙 Долг у трактирщика'),
            tf(t('«Денег нет — а есть хочешь. Что ж, хлеб да соль в долг даю, без лихвы: {0} д., вернуть до {1}. Запишу в столбец — деревня про такие дела узнает, молва подсядет».'), item.price, dueLabel)
            + '\n\n' + tf(t('(Долг: {0} д. из {1} возможных. Два срока — выдача и возврат через неделю. Репутация в деревне и у трактирщика упадёт.)'), chk.totalDebt + item.price, DEBT_MAX_TOTAL),
            [
                { text: tf(t('🙏 В долг ({0} д.)'), item.price), callback: () => {
                    const res = takeDebt(this.registry, { npcId: 'tavernkeeper', kind: 'food', amount: item.price });
                    if (!res.ok) return;
                    // Еда съедается сразу (канон 66.77) — как при обычной покупке
                    player.HP = Math.min(player.HPmax, player.HP + item.heal);
                    registerMeal(this.registry);
                    tickTime(this.registry, MEAL_DURATION_MIN);
                    this.registry.set('player', player);
                    ActionLog.add(this.registry, tf(t('Взял «{0}» в долг и съел сразу (+{1} HP, час времени).'), t(item.name), item.heal));
                    this.updateHUD();
                    // ПАТЧ 66.82 (QA-фикс, §12.3): панель лавки убирается
                    // ПОЛНОСТЬЮ — точечным закрытием по массиву трекинга MenuPanel
                    // (подложка + пергамент + кнопки; раньше — снос по depth 200..205)
                    this._menu?.close();
                    this.showTavernShop(); // обновлённая лавка (баланс и долг)
                } },
                { text: t('Отказаться'), callback: () => {} },
            ],
            { singleton: false, portraitKey: 'portrait_tavernkeeper' });
    }

    /**
     * Патч 66.82 (пп.3,4): НОЧЛЕГ В ДОЛГ у трактирщика, когда денег не хватает.
     * Условия те же (п.4): репутация в деревне И у трактирщика положительная,
     * суммарный долг ≤ 100 д., без просрочек. Срок — неделя (п.6).
     */
    offerLodgingOnCredit(interior, hours, sleepMinutes, cost) {
        const player = this.registry.get('player');
        if (!player) return;
        const chk = canTakeDebt(this.registry, cost);
        if (!chk.ok) {
            createDialog(this, t('🛏 Отдых'), debtRefusalLine(chk.reason),
                [{ text: t('Понятно'), callback: () => {} }],
                { singleton: false, portraitKey: this.npcPortraitKey });
            return;
        }
        const dueLabel = previewDueLabelOf(this.registry);
        createDialog(this, t('🛏 Отдых'),
            tf(t('Фёдор чешет затылок: «Пусто в мошне, а ночлег нужен... Ну, бери в долг, без лихвы: {0} д., вернуть до {1}. Запись в столбце — как без неё».'), cost, dueLabel)
            + '\n\n' + tf(t('(Долг: {0} д. из {1} возможных. Репутация в деревне и у трактирщика упадёт.)'), chk.totalDebt + cost, DEBT_MAX_TOTAL),
            [
                { text: tf(t('🛏 Ночлег в долг ({0} д.)'), cost), callback: () => {
                    const res = takeDebt(this.registry, { npcId: 'tavernkeeper', kind: 'lodging', amount: cost });
                    if (!res.ok) return;
                    this.restInTavern(interior, hours, sleepMinutes, { credit: true });
                } },
                { text: t('Отказаться'), callback: () => {} },
            ],
            { singleton: false, portraitKey: this.npcPortraitKey });
    }

    /**
     * Патч 66.82 (пп.1,6,7): МЕНЮ ДОЛГОВ у трактирщика — возврат и отсрочка.
     * Каждый долг — двумя сроками (выдача и возврат); просроченным — отсрочка
     * через проверку разговорного навыка (не более 3 раз).
     */
    showDebtsMenu(interior) {
        const player = this.registry.get('player');
        if (!player) return;
        closeAllSingletonDialogs(this);
        const loans = loansOf(this.registry);
        if (!loans.length) {
            createDialog(this, t('🪙 Долги в столбце'),
                t('«Столбец-то чист: долгов за тобой нет». (Вернул в срок — и молодец: такому и в долг дадут.)'),
                [{ text: t('Закрыть'), callback: () => {} }],
                { singleton: false, portraitKey: 'portrait_tavernkeeper' });
            return;
        }
        const nowIdx = debtDayIndex(getTime(this.registry));
        const buttons = [];
        loans.forEach((loan) => {
            const overdue = loanIsOverdue(loan, nowIdx);
            const name = creditorNameOf(this.registry, loan.npcId);
            if ((player.dengas || 0) >= loan.amount) {
                buttons.push({ text: tf(t('🪙 Вернуть {0} д. ({1})'), loan.amount, debtDueLabelOf(loan)), callback: () => {
                    chargeTradeTime(this.registry); // дело при деньгах — 30 минут (канон 66.78)
                    repayLoan(this.registry, loan.id);
                    this.registry.set('player', player);
                    this.updateHUD();
                    this.showDebtsMenu(interior); // обновлённый список
                } });
            } else if (!overdue) {
                buttons.push({ text: tf(t('🪙 {0} д. — в мошне не хватает'), loan.amount), callback: () => {} });
            }
            if (overdue && loan.deferrals < DEBT_MAX_DEFERRALS) {
                buttons.push({ text: tf(t('🎙 Просить отсрочку у {0} (Убеждение)'), name), callback: () => {
                    tickTime(this.registry, 10); // разговор — 10 минут (канон торга)
                    const res = attemptDeferral(this.registry, loan.id, player);
                    this.registry.set('player', player);
                    this.updateHUD();
                    const head = res.ok
                        ? tf(t('«Ну, погляжу я на тебя. Подожму до {0} — и чтоб к сроку!» (отсрочка №{1} из {2})'), debtDueLabelOf(loansOf(this.registry).find(l => l.id === loan.id) || loan), res.deferrals, DEBT_MAX_DEFERRALS)
                        : tf(t('«Слов у тебя много, а долгу — ни полушки. Иди, достань серебро!» (бросок {0} против {1}%) — отсрочки нет.'), res.roll, res.skill);
                    createDialog(this, t('🎙 Отсрочка долга'), head,
                        [{ text: t('Дальше'), callback: () => this.showDebtsMenu(interior) }],
                        { singleton: false, portraitKey: 'portrait_tavernkeeper' });
                } });
            }
        });
        buttons.push({ text: t('Закрыть'), callback: () => {} });
        const overdueN = overdueLoansOf(this.registry).length;
        const head = overdueN > 0
            ? tf(t('Долгу всего {0} д., из них просрочено: {1}. Стражник у ворот спросит за просрочку, а новых долгов тут не дадут.'), totalDebtOf(this.registry), overdueN)
            : tf(t('Долгу всего {0} д. За каждым — свой срок возврата: кто вовремя платит, тому и верят.'), totalDebtOf(this.registry));
        // Патч 66.83 (п.10): закуп доступен и из самого меню долгов
        buttons.push({ text: t('\u{2692} Отработать час в закупах'), callback: () => {
            this.busyDialog = false;
            this.workOffDebtAtTavern(interior);
        } });
        createDialog(this, t('🪙 Долги в столбце'), head + '\n\n' + loans.map(l => debtFullLineOf(this.registry, l)).join('\n'),
            buttons, { singleton: false, portraitKey: 'portrait_tavernkeeper' });
    }

    /**
     * Патч 66.83 (п.10): ЗАКУП — час работы у Фёдора в счёт долга
     * (дрова, вода, чаны). Вся плата уходит в погашение (лишек — в мошну);
     * отказаться от закупа нельзя, пока весь долг не выплачен.
     */
    workOffDebtAtTavern(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        if (!loansOf(this.registry).some(l => l.npcId === 'tavernkeeper')) return;
        this.busyDialog = true;
        // Тяжёлая подёнка: час, −2 ОУ, −1 HP (как у кузницы 66.74)
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 2);
        player.HP = Math.max(1, (player.HP || 1) - 1);
        const res = workOffDebt(this.registry, 'tavernkeeper');
        this.registry.set('player', player);
        this.updateHUD();
        let text = res.debtLeft > 0
            ? tf(t('Час колол дрова, таскал воду и мыл чаны. Плата — {0} д., и вся она ушла в счёт долга. Осталось: {1} д.\n\n(Закуп: отказаться от работы нельзя, пока весь долг не выплачен — всякая плата у Фёдора идёт в счёт долга.)'), res.applied, res.debtLeft)
            : tf(t('Час колол дрова, таскал воду и мыл чаны — и {0} д. платы закрыли долг ПОЛНОСТЬЮ! Фёдор доволен: «Закуп кончился, живи как знаешь».'), res.applied);
        if (res.surplus > 0) {
            text += '\n' + tf(t('Лишек ({0} д.) Фёдор отсчитал деньгами в мошну.'), res.surplus);
        }
        createDialog(this, t('\u{2692} Закуп — работа в счёт долга'), text,
            [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
            { singleton: false, portraitKey: this.npcPortraitKey });
    }

    /**
     * Патч 66.83 (п.12): клик по СЕРОЙ кнопке-подсказке в мастерской,
     * пока хозяин дома. Кнопки подёнки/станка и «О слове» активны только
     * когда «хозяин на поле» — окно объясняет это прямым текстом.
     */
    showOwnerHomeHint(interior) {
        const ownerName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : t('хозяин');
        createDialog(this, t('\u{2692} Хозяин дома'),
            tf(t('{0} сейчас дома. Работать в мастерской и торговаться о ставке («О слове») можно, только когда хозяин на поле или на промысле.\n\nПоговори с хозяином сейчас — или приходи в мастерскую, когда он уйдёт (в доме появится подсказка «хозяин на поле»).'), ownerName),
            [{ text: t('Понятно'), callback: () => {} }],
            { singleton: false, portraitKey: this.npcPortraitKey });
    }

    /**
     * РАУНД 66.17 (п.5): ПРОДАЖА ДОБЫЧИ. Трактирщик (Фёдор — на кухню)
     * и мясник (Потап — на столешню) скупают добычу: сырую/печёную рыбу,
     * сырое мясо и жаркое. Цены за штуку — из LOOT_DEFS (приготовленное
     * дороже сырого). «Продать 1» и «Продать всё» на каждый товар.
     * Патч 66.73 (приказ 5): ТОРГ за цену — встречная проверка Убеждения,
     * множитель цен до конца дня (+25%/+50% при крите/−10% при fumble);
     * панель растёт по числу товаров — всё влезает без скролла (п.2).
     * ПАТЧ 66.78 (пп.4–5): краденое честным скупщикам НЕ СДАЮТ —
     * только Скупщику по ночам (краденые строки отсюда убраны).
     * ПАТЧ 66.78 (приказ 9): любая продажа = 30 минут, часы реального
     * времени на время панели СТОЯТ.
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
        // Патч 66.78 (приказ 9): открыта торговля — счётчик реального времени стоит
        pauseWorldClock(this.registry);
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

        // Патч 66.73 (приказ 5): действующий множитель торга
        const haggleMult = haggleMultFor(this.registry, buyerNpcId);
        const priceOf = (base) => Math.max(1, Math.round(base * haggleMult));

        // ПАТЧ 66.78 (пп.4–5): краденое честным скупщикам НЕ СДАЮТ —
        // строки краденого отсюда убраны (только Скупщик по ночам).
        const rows = sellableLoot(player).filter(r => !r.stolen);
        const hasStolen = sellableLoot(player).some(r => r.stolen);
        // Патч 66.73 (п.2, аудит размеров): высота панели РАСТЁТ по числу
        // товаров — раньше фиксированные 420px при 8+ видах добычи выталкивали
        // нижние строки и кнопку «Закрыть» за пергамент. Потолок — 88% экрана.
        const panelW = 560;
        const panelH = Math.min(Math.round(height * 0.88), 160 + rows.length * 52 + 78);
        // §12.3 (66.96): панель с трекингом объектов массивом (MenuPanel)
        const menu = this._menu = new MenuPanel(this, { panelW, panelH });
        const overlay = menu.overlay, panel = menu.panel;
        const closeMenu = () => {
            menu.close();
            this.__sellLootOpen = false;
            // Патч 66.78 (приказ 9): панель закрыта — реальное время снова идёт
            resumeWorldClock(this.registry);
        };

        menu.text(width / 2, height / 2 - panelH / 2 + 30,
            isButcher ? t('Столешня Потапа — скупка добычи') : t('Кухня Фёдора — скупка добычи'), {
                fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(202);
        menu.text(width / 2, height / 2 - panelH / 2 + 62,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}`, {
                fontSize: '17px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);
        // РАУНД 66.20: подсказка о ценах вынесена в общую строку (раньше
        // дублировалась в каждой строке списка и вынуждала держать мелкий кегль)
        // Патч 66.73 (приказ 5): рядом — строка состояния торга
        // Патч 66.78 (пп.4–5): краденое здесь НЕ СДАЮТ — только Скупщику по ночам
        menu.text(width / 2, height / 2 - panelH / 2 + 88,
            t('Печёное и жаркое дороже сырого') + '  ·  ' + haggleHintLine(this.registry, buyerNpcId)
            + '  ·  ' + (hasStolen
                ? t('Краденое честным скупщикам не сбыть — только Скупщику по ночам')
                : t('Любая торговля занимает полчаса')), {
                fontSize: '13px', color: RUS.textDim, fontStyle: 'italic',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);

        if (rows.length === 0) {
            menu.text(width / 2, height / 2 - 10,
                t('В узле нет добычи. Настреляй дичи из лука, налови рыбы на броду — или раздери волка.'), {
                    fontSize: '16px', color: RUS.textDim, wordWrap: { width: panelW - 60 },
                    align: 'center',
                }).setOrigin(0.5).setDepth(202);
        }

        const startY = height / 2 - panelH / 2 + 140;
        rows.forEach((row, i) => {
            const y = startY + i * 52;
            const def = row.def;
            const unitPrice = priceOf(row.price); // патч 66.73: цена с учётом торга (краденое отсюда убрано — 66.78)
            menu.text(width / 2 - panelW / 2 + 30, y - 22,
                `${def.emoji} ${t(def.name)} ×${row.count} — ${unitPrice} ${t('д.')}`, {
                    fontSize: '15px', color: RUS.text, stroke: '#000', strokeThickness: 1,
                }).setOrigin(0, 0.5).setDepth(202);
            menu.button( width / 2 + 60, y + 4, tf(t('Продать 1 ({0} д.)'), unitPrice), () => {
                removeFromEntry(player, row.entry, 1); // патч 66.77: из конкретной кучки
                player.dengas = (player.dengas || 0) + unitPrice;
                this.registry.set('player', player);
                if (this.audioManager) this.audioManager.playGoldReceive();
                ActionLog.add(this.registry, tf(t('Продал «{0}» ({1}) за {2} д.'), t(def.name), buyerName, unitPrice));
                // Патч 66.78 (приказ 9): любая продажа — 30 минут
                chargeTradeTime(this.registry);
                this.updateHUD();
                closeMenu();
                this.showSellLootMenu(interior);
            }, {
                backgroundColor: 0x3a5a3a, hoverColor: 0x4a6a4a, textColor: RUS.text,
                fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 },
            }).setDepth(202);
            if (row.count > 1) {
                menu.button( width / 2 + 205, y + 4, tf(t('Всё ({0} д.)'), unitPrice * row.count), () => {
                    const n = row.count;
                    removeFromEntry(player, row.entry, n); // патч 66.77: из конкретной кучки
                    player.dengas = (player.dengas || 0) + unitPrice * n;
                    this.registry.set('player', player);
                    if (this.audioManager) this.audioManager.playGoldReceive();
                    ActionLog.add(this.registry, tf(t('Продал всё «{0}» ×{1} ({2}) за {3} д.'), t(def.name), n, buyerName, unitPrice * n));
                    // Патч 66.78 (приказ 9): любая продажа — 30 минут
                    chargeTradeTime(this.registry);
                    this.updateHUD();
                    closeMenu();
                    this.showSellLootMenu(interior);
                }, {
                    backgroundColor: 0x2a4a5a, hoverColor: 0x3a5a6a, textColor: RUS.text,
                    fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 },
                }).setDepth(202);
            }
        });

        // ----- Патч 66.73 (приказ 5): кнопка ТОРГА; патч 66.74 (приказ 6):
        // кнопка «Сметить» — торг от СМЕТКИ (знание цен) вместо Убеждения.
        // Одна попытка в день на торговца ОБЩАЯ: слово ИЛИ сметка.
        const haggleY = height / 2 + panelH / 2 - 34;
        const haggleOpts = {
            backgroundColor: 0x4a3a2a, hoverColor: 0x5a4a3a, textColor: RUS.text,
            fontSize: 13, padding: { left: 10, right: 10, top: 7, bottom: 7 },
        };
        const haggleResult = (res, interiorRef, portraitKey) => {
            closeMenu();
            createDialog(this, t('🤝 Торг'),
                (res.checkLine ? res.checkLine + '\n\n' : '') + res.message,
                [{ text: t('К делу'), callback: () => this.showSellLootMenu(interiorRef) }],
                { singleton: false, portraitKey });
        };
        if (canHaggleToday(this.registry, buyerNpcId)) {
            menu.button( width / 2 - 180, haggleY, t('⚖ Сметить (Сметка)'), () => {
                const res = attemptHaggle(this.registry, buyerNpcId, (player.skills && player.skills.commerce) || 10, { skillLabel: 'Сметка' });
                haggleResult(res, interior, isButcher ? 'portrait_peasant' : 'portrait_tavernkeeper');
            }, haggleOpts).setDepth(202);
            menu.button( width / 2 - 20, haggleY, t('🤝 Поторговаться'), () => {
                const res = attemptHaggle(this.registry, buyerNpcId, player.skills.persuade);
                haggleResult(res, interior, isButcher ? 'portrait_peasant' : 'portrait_tavernkeeper');
            }, haggleOpts).setDepth(202);
            menu.button( width / 2 + 140, haggleY, t('Закрыть'), closeMenu, {
                backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
                fontSize: 15, padding: { left: 24, right: 24, top: 7, bottom: 7 },
            }).setDepth(202);
        } else {
            menu.button( width / 2, haggleY, t('Закрыть'), closeMenu, {
                backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
                fontSize: 15, padding: { left: 24, right: 24, top: 7, bottom: 7 },
            }).setDepth(202);
        }
    }

    /**
     * ПАТЧ 66.78 (приказы 4–6): МЕНЮ СКУПЩИКА — ночной сбыт краденого.
     *  • появляется только ПО НОЧАМ и только в свои ночи (3–5 ночей недели);
     *  • покупает ТОЛЬКО краденое (честное ему не нужно, строки честного нет);
     *  • платит 20% стандартной скупки (fencePriceOf — патч 66.77);
     *  • КАЖДАЯ продажа — репутация в деревне −1 (точно, приказ 6);
     *  • ПЕРВАЯ продажа — однократный красный поп-ап о противозаконности;
     *  • продажа = 30 минут (приказ 9), часы реального времени стоят.
     * Скупщик — человек дурного ремесла: репутационных отказов и торга у него нет.
     */
    showFenceMenu(interior) {
        const player = this.registry.get('player');
        if (!player) return;
        closeAllSingletonDialogs(this);
        this.busyDialog = false;
        // Патч 66.78 (приказ 9): открыта торговля — счётчик реального времени стоит
        pauseWorldClock(this.registry);
        const { width, height } = this.scale;
        const rows = sellableLoot(player).filter(r => r.stolen);
        const panelW = 560;
        const panelH = Math.min(Math.round(height * 0.88), 190 + rows.length * 52 + 78);
        // §12.3 (66.96): панель с трекингом объектов массивом (MenuPanel);
        // тёмная тема Скупщика — те же цвета, что были у самодельной панели
        const menu = this._menu = new MenuPanel(this, {
            panelW, panelH, veilAlpha: 0.85, panelColor: 0x161420, panelStroke: 0x4a3a5a,
        });
        const overlay = menu.overlay, panel = menu.panel;
        const closeMenu = () => {
            menu.close();
            // Патч 66.78 (приказ 9): панель закрыта — реальное время снова идёт
            resumeWorldClock(this.registry);
        };

        menu.text(width / 2, height / 2 - panelH / 2 + 30,
            t('Тёмный угол постоялого двора — Скупщик'), {
                fontSize: '22px', color: '#b09ad0', fontStyle: 'bold',
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(202);
        menu.text(width / 2, height / 2 - panelH / 2 + 62,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}`, {
                fontSize: '16px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);
        menu.text(width / 2, height / 2 - panelH / 2 + 88,
            t('Краденое уходит без торга · каждая продажа — молва хуже (репутация −1)'), {
                fontSize: '13px', color: RUS.textDim, fontStyle: 'italic',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(202);

        if (rows.length === 0) {
            menu.text(width / 2, height / 2,
                t('«Пусто, что ли принёс? Мне честное не надо — только краденое.»'), {
                    fontSize: '15px', color: RUS.textDim, wordWrap: { width: panelW - 60 },
                    align: 'center',
                }).setOrigin(0.5).setDepth(202);
        }

        /** Одна продажа Скупщику (после однократного предупреждения — п.6). */
        const doSell = (row, n, unitPrice) => {
            const total = unitPrice * n;
            removeFromEntry(player, row.entry, n);
            player.dengas = (player.dengas || 0) + total;
            this.registry.set('player', player);
            if (this.audioManager) this.audioManager.playGoldReceive();
            // Патч 66.78 (приказ 6): каждая продажа краденого — репутация −1
            noteFenceSale(this.registry, row.def.name, total);
            // Патч 66.79 (пп.5–6): сбыт запоминается по дому — за проданное
            // придётся отвечать УРОКОМ по полной стоимости (стражник/мир)
            if (row.entry && row.entry.from) {
                noteSoldStolen(this.registry, row.entry.from, (row.def.sell || 0) * n);
            }
            // Патч 66.78 (приказ 9): любая продажа — 30 минут
            chargeTradeTime(this.registry);
            this.updateHUD();
            closeMenu();
            this.showFenceMenu(interior);
        };

        const startY = height / 2 - panelH / 2 + 140;
        rows.forEach((row, i) => {
            const y = startY + i * 52;
            const def = row.def;
            const unitPrice = row.price; // fencePriceOf уже в row.price (20% скупки)
            menu.text(width / 2 - panelW / 2 + 30, y - 22,
                `${def.emoji} ${t(def.name)} ×${row.count} — ${unitPrice} ${t('д.')}${t(' — краденое')}`, {
                    fontSize: '15px', color: '#d8c8a8', stroke: '#000', strokeThickness: 1,
                }).setOrigin(0, 0.5).setDepth(202);
            menu.button( width / 2 + 60, y + 4, tf(t('Продать 1 ({0} д.)'), unitPrice), () => {
                // ПАТЧ 66.78 (приказ 6): ПЕРВАЯ продажа — красный поп-ап
                if (!fenceWarnedOnce(this.registry)) {
                    markFenceWarned(this.registry);
                    closeMenu();
                    createDialog(this, t('⚠ ПРОТИВОЗАКОНИЕ!'),
                        t('Ты сбываешь краденое! Это противозаконное действие: за него может быть наказание, а молва в деревне с каждой продажи становится хуже (репутация −1).'),
                        [
                            { text: t('Всё равно продать'), callback: () => { this.showFenceMenu(interior); doSell(row, 1, unitPrice); } },
                            { text: t('Отказаться'), callback: () => {} },
                        ],
                        { singleton: false, coverColor: 0x5a0f0f, coverAlpha: 0.85 });
                    return;
                }
                doSell(row, 1, unitPrice);
            }, {
                backgroundColor: 0x5a3a2a, hoverColor: 0x6a4a3a, textColor: RUS.text,
                fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 },
            }).setDepth(202);
            if (row.count > 1) {
                menu.button( width / 2 + 205, y + 4, tf(t('Всё ({0} д.)'), unitPrice * row.count), () => {
                    if (!fenceWarnedOnce(this.registry)) {
                        markFenceWarned(this.registry);
                        closeMenu();
                        createDialog(this, t('⚠ ПРОТИВОЗАКОНИЕ!'),
                            t('Ты сбываешь краденое! Это противозаконное действие: за него может быть наказание, а молва в деревне с каждой продажи становится хуже (репутация −1).'),
                            [
                                { text: t('Всё равно продать'), callback: () => { this.showFenceMenu(interior); doSell(row, row.count, unitPrice); } },
                                { text: t('Отказаться'), callback: () => {} },
                            ],
                            { singleton: false, coverColor: 0x5a0f0f, coverAlpha: 0.85 });
                        return;
                    }
                    doSell(row, row.count, unitPrice);
                }, {
                    backgroundColor: 0x2a4a5a, hoverColor: 0x3a5a6a, textColor: RUS.text,
                    fontSize: 14, padding: { left: 10, right: 10, top: 6, bottom: 6 },
                }).setDepth(202);
            }
        });

        menu.button( width / 2, height / 2 + panelH / 2 - 34, t('Закрыть'), closeMenu, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 24, right: 24, top: 7, bottom: 7 },
        }).setDepth(202);
    }

    /**
     * Патч 66.73 (приказ 8): ПЕЧЬ НА ПОСТОЯЛОМ ДВОРЕ — самостоятельная
     * готовка еды игроком. Русская печь у стойки Фёдора: сырые грибы,
     * мясо дичи и рыба превращаются в готовые блюда (проверка «Готовки»;
     * провал — продукты пропали, крит — «удалось на славу» +1).
     * Механика — cookAtFire (systems/loot.js), как на лесном кострище,
     * но под крышей: деревенский двор — место путника, посуда найдётся.
     */
    showStoveCookMenu(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        const fishRaw = countOf(player, 'fish_raw');
        const meatRaw = countOf(player, 'meat_raw');
        const mushRaw = countOf(player, 'mushroom_raw');
        const cookOpts = [];
        if (fishRaw > 0) {
            cookOpts.push({ text: tf(t('🐟 Запечь рыбу в печи ({0} мин)'), 30), callback: () => { close(); this.cookAtStove('fish_raw'); } });
        }
        if (meatRaw > 0) {
            cookOpts.push({ text: tf(t('🍖 Томить мясо дичи в печи ({0} мин)'), 30), callback: () => { close(); this.cookAtStove('meat_raw'); } });
        }
        if (mushRaw > 0) {
            cookOpts.push({ text: tf(t('🍄 Жарить грибы в печи ({0} мин)'), 30), callback: () => { close(); this.cookAtStove('mushroom_raw'); } });
        }
        const noFoodLine = cookOpts.length === 0
            ? '\n\n' + t('В узле нечего готовить: сырые грибы, мясо дичи или рыба продаются на постоялом дворе, а несут их из леса и с реки.')
            : '';
        createDialog(this, t('🔥 Русская печь постоялого двора'),
            t('Устье печи дышит жаром, на шестке чугун и ухват. Здесь путник может сам приготовить сырую добычу (Готовка; при неудаче продукты пропадут, при критической удаче блюдо выйдет сытнее на +1).') + noFoodLine,
            [
                ...cookOpts,
                { text: t('Не сейчас'), callback: close },
            ], { portraitKey: 'portrait_tavernkeeper' });
    }

    /** Готовка одной штуки на печи постоялого двора (механика cookAtFire). */
    cookAtStove(rawId) {
        const player = this.registry.get('player');
        if (!player || countOf(player, rawId) <= 0) return;
        const def = getLootDef(rawId);
        if (!def || !def.cookTo) return;
        const res = cookAtFire(this.registry, player, rawId, { skill: player.skills.cooking });
        const cooked = getLootDef(res.producedId || def.cookTo);
        if (res.lost) {
            ActionLog.add(this.registry, tf(t('Прогоревал у печи постоялого двора: {0} пригорели (Готовка {1}%: бросок {2}).'), t(def.name).toLowerCase(), res.skill, res.roll));
            createDialog(this, t('💀 Прогорело!'),
                tf(t('{0} подгорели на печи — продукты пропали (Готовка {1}%: бросок {2}).'), t(def.name).toLowerCase(), res.skill, res.roll),
                [{ text: t('Понятно'), callback: () => {} }]);
            this.updateHUD();
            return;
        }
        if (this.audioManager) this.audioManager.playHeal();
        const suffix = res.crit ? tf(t(' — удалось на славу (+1 к сытости)!')) : '';
        ActionLog.add(this.registry, res.crit
            ? tf(t('Пир в печи! {0} → {1} сытнее на +1 (Готовка {2}%: бросок {3} — крит).'), t(def.name), t(cooked.name), res.skill, res.roll)
            : tf(t('Приготовил в печи постоялого двора: {0} → {1} (Готовка {2}%: бросок {3}).'), t(def.name), t(cooked.name), res.skill, res.roll));
        createDialog(this, res.crit ? t('🍲 Удалось на славу!') : t('🍲 С печи — горячее'),
            tf(t('На печи поспело: {0}{1}\nТеперь в узле — можно съесть (Персонаж → Инвентарь → «Съесть») или продать.'), t(cooked.name), suffix),
            [{ text: t('Хорошо'), callback: () => {} }]);
        this.updateHUD();
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
    restInTavern(interior, hours, minutesOverride, opts = {}) {
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

        if (!opts.credit && (player.dengas || 0) < cost) {
            // Патч 66.82 (пп.3,4): денег нет — НОЧЛЕГ В ДОЛГ (условия п.4);
            // opts.credit — повторный вызов после взятия долга: монет не проверяем
            this.offerLodgingOnCredit(interior, hours, sleepMinutes, cost);
            return;
        }

        this.busyDialog = true;
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.time.delayedCall(650, () => {
            const onCredit = !!opts.credit; // патч 66.82: ночлег В ДОЛГ — денег не списываем
            if (!onCredit) player.dengas = (player.dengas || 0) - cost;

            // Время реально течёт (8 часов = 32 тика погони!);
            // приказ 4: после пробуждения — кулдаун сна на 12 часов
            // Патч 66.73 (п.3): во сне голод копится МЕДЛЕННЕЕ (вес ×0.4)
            tickTime(this.registry, sleepMinutes, 'sleep');
            registerSleep(this.registry);
            // Патч 66.73 (приказ 14): сон — бездеятельность, ОУ восстанавливаются
            // полностью (канон BRP: полное восстановление за ~20 минут покоя)
            restFatigueFull(this.registry);

            // Раунд 66.17: доля восстановления — 8 часов = 100%, меньше — пропорция
            const pct = restHealPct(sleepMinutes);
            let effectText;
            if (pct >= 1) {
                player.HP = player.HPmax;
                effectText = t('Здоровье восстановлено ПОЛНОСТЬЮ.');
            } else {
                const heal = Math.max(1, Math.round((player.HPmax || 10) * pct));
                player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                effectText = tf(t('Здоровье +{0} (~{1}% от полного).'), heal, Math.round(pct * 100));
            }
            this.registry.set('player', player);
            this.updateHUD();
            if (this.audioManager) this.audioManager.playSound('sfx_heal');
            ActionLog.add(this.registry, onCredit
                ? tf(t('Отдохнул в таверне ({0} ч) В ДОЛГ ({1} д. — записаны в столбец). {2}'), hours, cost, effectText)
                : tf(t('Отдохнул в таверне ({0} ч) за {1} д. {2}'), hours, cost, effectText));
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
                // Патч 66.73: бездельная перемотка — отдых (вес ×0.6, ОУ восстанавливаются)
                tickTime(sceneRef.registry, minutes, 'rest');
                restFatigueFull(sceneRef.registry);
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
        // Патч 66.78 (приказ 9): открыта торговля — счётчик реального времени стоит
        pauseWorldClock(this.registry);
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

        // §12.3 (66.96): панель с трекингом объектов массивом (MenuPanel)
        const panelW = 600, panelH = 560;  // 66.71: 560 — 9 строк ассортимента (4 дробящих + нож/копьё/топор/лук/стрелы)
        const menu = this._menu = new MenuPanel(this, {
            panelW, panelH,
            onClose: () => {
                // Патч 66.78 (приказ 9): панель закрыта — реальное время снова идёт
                resumeWorldClock(this.registry);
            },
        });
        const overlay = menu.overlay, panel = menu.panel;

        const closeMenu = () => menu.close();

        menu.text(width / 2, height / 2 - panelH / 2 + 30,
            smithId === 'blacksmith' ? t('Кузница Данилы') : tf(t('Кузница — {0}'), smithName), {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        menu.text(width / 2, height / 2 - panelH / 2 + 65,
            `${t('Денег:')} ${formatMoney(player.dengas || 0)}`, {
            fontSize: '16px', color: '#c9a14a',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);

        // Переключатель вкладок. РАУНД 62 (п.7): вкладка «Доспехи» была
        // удалена. ПАТЧ 66.76 (приказ 8) ВОЗВРАЩАЕТ её с ОДНИМ заказным
        // товаром — КОЛЬЧУГОЙ (задорого и при высокой репутации у кузнеца);
        // кожаная броня и тегиляй продаются у Аверьяна (приказ 7).
        const mkTab = (x, label, key) => menu.button( x, height / 2 - panelH / 2 + 100, t(label), () => {
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
        mkTab(width / 2 + 150, 'Продать', 'sell');  // метки через t(label) в mkTab

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
            menu.text(width / 2, startY - 20, t('Продать можно лишь то, что не надето на тебя (полцены):'), {
                fontSize: '12px', color: RUS.textDim,
            }).setOrigin(0.5).setDepth(202);
            if (sellables.length === 0) {
                menu.text(width / 2, startY + 40, t('В узле нечего продать — всё надето или пусто.'), {
                    fontSize: '14px', color: RUS.textDim,
                }).setOrigin(0.5).setDepth(202);
            }
            sellables.forEach((item, i) => {
                const y = startY + 20 + i * 42;
                const base = (WEAPONS[item.id] && WEAPONS[item.id].price)
                    || (ARMORS[item.id] && ARMORS[item.id].price) || 10;
                const sellPrice = Math.max(1, Math.floor(base / 2));
                const label = `💰 ${t(item.name)} — ${sellPrice} ${t('д.')} (${t('полцены')})`;
                menu.button( width / 2, y, label, () => {
                    item.count -= 1;
                    if (item.count <= 0) {
                        player.inventory = player.inventory.filter(x => x !== item);
                    }
                    player.dengas = (player.dengas || 0) + sellPrice;
                    this.registry.set('player', player);
                    if (this.audioManager) this.audioManager.playGoldReceive();
                    ActionLog.add(this.registry, tf(t('Продал «{0}» кузнецу за {1} д. (полцены, урок Судебника о честной торговле).'), t(item.name), sellPrice));
                    // Патч 66.78 (приказ 9): любая продажа — 30 минут
                    chargeTradeTime(this.registry);
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
            // простое оружие своей работы (нож/дубина/копьё/топор/лук).
            // Раунд 66.71 (приказ 14): дробящее пополнено — ПАЛИЦА, БУЛАВА,
            // КИСТЕНЬ (навык «Ударное оружие»); дубина теперь тоже дробящая.
            // МЕЧ НЕ ПРОДАЁТСЯ — УНИКАЛЬНАЯ НАГРАДА ОТ СТАРОСТЫ.
            // ПАТЧ 66.76 (приказы 8–9): в оружии — ЗАКАЗНАЯ САБЛЯ (100 д.),
            // в «Доспехах» — ЗАКАЗНАЯ КОЛЬЧУГА (150 д.); обе только при
            // высокой личной репутации у кузнеца (+25) и рамках Судебника.
            const SMITH_SALE_WEAPONS = ['club', 'palitsa', 'mace', 'flail', 'knife', 'spear', 'axe', 'bow'];
            const items = tab === 'weapon'
                ? Object.values(WEAPONS).filter(w => SMITH_SALE_WEAPONS.includes(w.id))
                : [];

            if (tab === 'weapon') {
                menu.text(width / 2, height / 2 + panelH / 2 - 44,
                    t('Меч — награда старосты. Сабля и кольчуга — заказные: задорого и только своим людям кузнецу. Стрелы — пачками по 10.'), {
                    fontSize: '11px', color: RUS.textDim, wordWrap: { width: panelW - 60 },
                }).setOrigin(0.5).setDepth(202);
            } else if (tab === 'armor') {
                menu.text(width / 2, height / 2 + panelH / 2 - 44,
                    t('Тегиляй и кожаную броню шьёт ремесленник Аверьян. Кольчуга — кузнец куёт на заказ: 150 д. и только при высокой репутации у кузнеца.'), {
                    fontSize: '11px', color: RUS.textDim, wordWrap: { width: panelW - 60 },
                }).setOrigin(0.5).setDepth(202);
            }

            items.forEach((item, i) => {
                const y = startY + i * 36;  // 66.71: шаг 36 — 9 строк в панели 560
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
                menu.button( width / 2, y, desc, () => {
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
                    // Патч 66.78 (приказ 9): любая покупка — 30 минут
                    chargeTradeTime(this.registry);
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
                menu.button( width / 2, startY + items.length * 36, packDesc, () => {
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
                    // Патч 66.78 (приказ 9): любая покупка — 30 минут
                    chargeTradeTime(this.registry);
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

            // ===== ПАТЧ 66.76 (приказы 8–9): ЗАКАЗНЫЕ ТОВАРЫ КУЗНЕЦА =====
            // Сабля (в «Оружии») и кольчуга (в «Доспехах»): ЗАДОРОГО
            // (твёрдая заказная цена БЕЗ скидок славы) и ТОЛЬКО при высокой
            // личной репутации у кузнеца (npcRep ≥ +25) + рамках Судебника.
            if (tab === 'weapon' || tab === 'armor') {
                const specialId = tab === 'weapon' ? 'sabre' : 'chain';
                const specialDef = tab === 'weapon' ? WEAPONS.sabre : ARMORS.chain;
                const specialPrice = tab === 'weapon' ? SABRE_SMITH_PRICE : CHAIN_SMITH_PRICE;
                const repNow = getNpcRep(this.registry, smithId);
                const gearCheckSp = canBuyMilitaryGear(this.registry, player);
                const gateSp = canBuySmithSpecial(repNow, gearCheckSp);
                const canAffordSp = (player.dengas || 0) >= specialPrice;
                const statSp = tab === 'weapon'
                    ? `(${t('урон')} ${specialDef.dice.min}-${specialDef.dice.max}+${specialDef.bonus || 0})`
                    : `(${t('защита')} ${specialDef.def})`;
                const spDesc = tf(t('🔒 {0} — {1} {2} {3}   ·   репутация у кузнеца: {4}/{5}'),
                    t(specialDef.name), specialPrice, t('д.'), statSp, Math.round(repNow), SMITH_TRUST_REP);
                menu.button( width / 2, startY + items.length * 36 + (tab === 'weapon' ? 72 : 0), spDesc, () => {
                    if (!gateSp.ok) {
                        createDialog(this, t('Кузница'), gateSp.reason, [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    if (!canAffordSp) {
                        createDialog(this, t('Кузница'), t('Не хватает денег!'), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    if (player.weaponId === specialId || player.armorId === specialId
                        || (player.inventory || []).some(it => it.id === specialId)) {
                        createDialog(this, t('Кузница'), t('Такая вещь у тебя уже есть — не по-торговому дважды платить за одну.'), [
                            { text: t('Понятно'), callback: () => {} },
                        ], { singleton: false, portraitKey: smithPortrait });
                        return;
                    }
                    player.dengas -= specialPrice;
                    this.audioManager.playGoldSpend();
                    if (tab === 'weapon') {
                        const oldWeaponId = player.weaponId;
                        equipWeapon(player, specialId);
                        if (!player.inventory) player.inventory = [];
                        if (oldWeaponId && oldWeaponId !== specialId
                            && WEAPONS[oldWeaponId]
                            && !player.inventory.find(it => it.id === oldWeaponId)) {
                            player.inventory.push({ id: oldWeaponId, name: WEAPONS[oldWeaponId].name, count: 1, type: 'weapon' });
                        }
                        if (!player.inventory.find(it => it.id === specialId)) {
                            player.inventory.push({ id: specialId, name: specialDef.name, count: 1, type: 'weapon' });
                        }
                    } else {
                        equipArmor(player, specialId);
                        if (!player.inventory) player.inventory = [];
                        if (!player.inventory.find(it => it.id === specialId)) {
                            player.inventory.push({ id: specialId, name: specialDef.name, count: 1, type: 'armor' });
                        }
                    }
                    this.registry.set('player', player);
                    ActionLog.add(this.registry, tf(t('Заказал «{0}» у кузнеца за {1} д. (заказная цена, репутация у кузнеца {2}).'), t(specialDef.name), specialPrice, Math.round(repNow)));
                    // Патч 66.78 (приказ 9): любая покупка — 30 минут
                    chargeTradeTime(this.registry);
                    this.updateHUD();
                    closeMenu();
                    this.showBlacksmithShop(tab);
                }, {
                    backgroundColor: (gateSp.ok && canAffordSp) ? 0x5a4a20 : 0x3a3a3a,
                    hoverColor: (gateSp.ok && canAffordSp) ? 0x6a5a2e : 0x4a4a4a,
                    textColor: (gateSp.ok && canAffordSp) ? RUS.text : '#888',
                    fontSize: 13, padding: { left: 14, right: 14, top: 7, bottom: 7 },
                }).setDepth(202);
            }
        }

        // Кнопка закрытия
        menu.button( width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), () => {
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

    // Ключ игрового дня (для «раз в день»-ограничений) — канон gameCalendar (§12.3)
    dayKey() {
        return gameCalendarDayKey(getTime(this.registry));
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
     * Раунд 66.72 (приказ 14): ПОДСЛУШАТЬ МОЛВУ за столами постоялого двора —
     * игровое применение навыка «Слух» (исторично для Руси XV века: двор —
     * средоточие вестей, у стол переселись обозные/ямщики/торговцы).
     * Проверка «Слуха» (+5 при благословении молитвы, списывается):
     *  • успех — молва из ленты слухов (не расходует лимит слуха дня Фёдора,
     *    но та же весть не повторится и у корчмаря);
     *  • провал — за гулом голосов ничего не разобрать;
     *  • попытка — 15 минут времени.
     */
    eavesdropTavern() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        tickTime(this.registry, 15);

        const listen = (player.skills && player.skills.listen) || 10;
        const bless = consumePrayerBless(this.registry);
        const eff = Math.min(99, listen + bless);
        const res = skillCheck(eff);

        if (res.result === 'fail' || res.result === 'fumble') {
            ActionLog.add(this.registry, tf(t('Прислушивался к разговорам за столами (Слух {0}%: бросок {1}) — ничего не разобрал.'), eff, res.roll));
            createDialog(this, t('👂 За столами'),
                tf(t('Гул голосов, смех, спор подгулявших ямщиков… Слух {0}%: бросок {1} — за шумом ничего путного не разобрать.'), eff, res.roll),
                [{ text: t('Отойти'), callback: close }], { singleton: false });
            this.updateHUD();
            return;
        }

        const line = overheardRumorLine(this.registry);
        if (!line) {
            createDialog(this, t('👂 За столами'),
                t('За столами нынче тихо — говорили не о чем: молва на сегодня иссякла.'),
                [{ text: t('Отойти'), callback: close }], { singleton: false });
            this.updateHUD();
            return;
        }
        ActionLog.add(this.registry, tf(t('Подслушал молву за столами постоялого двора (Слух {0}%: бросок {1} — успех).'), eff, res.roll));
        createDialog(this, t('👂 Подслушал молву'),
            line + tf(t('\n\n(Слух {0}%: бросок {1} — успех.)'), eff, res.roll),
            [{ text: t('Запомнить'), callback: close }], { singleton: false });
        this.updateHUD();
    }

    /**
     * Молитва в церкви — БЛАГОСЛОВЕНИЕ (+5 к одной проверке навыка).
     * Раунд 66.72 (приказ 11): откат Молитвы — 8 ИГРОВЫХ ЧАСОВ (было — раз в
     * игровой день); при НЕИСТЕКШЕМ откате — поп-ап «Молитва не услышана!»;
     * благословение усиливает ЛЮБОЙ один навык при следующей проверке
     * (сбор Выживанием, готовка, Знахарство, Слух…) и списывается первой же
     * проверкой. Раунд 66.71: МР (Воля) удалён из игры — молитва не трогает
     * параметры. Забирает 15 минут времени.
     */
    prayInChurch() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        tickTime(this.registry, 15);

        // Приказ 11: откат 8 часов. Ещё не истёк — «Молитва не услышана!»
        const cd = canPray(this.registry);
        if (!cd.ok) {
            ActionLog.add(this.registry, t('Молитва не услышана! (откат Молитвы ещё не истёк)'));
            createDialog(this, t('Молитва'),
                tf(t('Молитва не услышана! Сердце ещё не отошло от прошлой молитвы — небо молчит. Вернись позже (откат: ещё около {0} ч).'), Math.max(1, Math.round(cd.minutesLeft / 60))),
                [{ text: t('Поклониться и уйти.'), callback: () => {} }]);
            return;
        }

        this.audioManager.playPrayerChant(); // раунд 24: тихая молитва
        registerPrayer(this.registry); // точка отката 8 ч + благословение
        ActionLog.add(this.registry, t('Помолился в церкви — благословение: следующий навык крепче на +5.'));

        createDialog(this, t('Молитва'),
            t('Ты опускаешься на колени перед киотом. В полумраке церкви, под мерцание лампад, приходит покой.\n\nБлагословение: ЛЮБОЙ твой навык пройдёт ближайшую проверку на +5 крепче (сбор в лесу, готовка на костре, знахарское снадобье, слух за столами…).'),
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
     * ПАТЧ 66.78 (приказы 14–18): СУНДУК В ЖИЛОМ ДОМЕ — рисунок + кнопка.
     * Сундук рисуется у левой стены (3 прямоугольника — дубовый окованный
     * ларь с замком); кнопка в ряду — только в ПУСТОМ доме (приказ 16).
     */
    drawChestInterior(interior, width, height) {
        const cx = width * 0.135;
        const cy = height * 0.735;
        const depth = 6;
        this.add.rectangle(cx, cy, 66, 38, 0x6a4a26).setStrokeStyle(2, 0x3a2814).setDepth(depth);
        this.add.rectangle(cx, cy - 14, 66, 14, 0x7d5a30).setStrokeStyle(2, 0x3a2814).setDepth(depth);
        this.add.rectangle(cx, cy, 10, 12, 0xc9a14a).setStrokeStyle(1, 0x3a2814).setDepth(depth + 1); // замок
        this.add.text(cx, cy + 30, t('🧰 Сундук'), {
            fontSize: '10px', color: '#c9a14a', backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(depth + 1);
    }

    /**
     * ПАТЧ 66.78 (приказы 4–5): СКУПЩИК НА ПЕРВОМ ЭТАЖЕ ПОСТОЯЛОГО ДВОРА.
     * Тёмная фигура в капюшоне у дальней стены — приходит только ПО НОЧАМ
     * и только в свои ночи (3–5 ночей недели, выбор случаен). Покупает
     * ТОЛЬКО краденое.
     */
    drawFenceInterior(width, height) {
        const cx = width * 0.87;
        const cy = height * 0.62;
        const depth = 6;
        // тень-пятно под ногами
        this.add.ellipse(cx, cy + 34, 56, 12, 0x000000, 0.35).setDepth(depth);
        // плащ (тёмный, до земли)
        this.add.rectangle(cx, cy, 34, 62, 0x1d1d2a).setStrokeStyle(2, 0x0d0d16).setDepth(depth);
        // капюшон
        this.add.circle(cx, cy - 38, 13, 0x1d1d2a).setStrokeStyle(2, 0x0d0d16).setDepth(depth);
        // тень лица под капюшоном
        this.add.circle(cx, cy - 37, 7, 0x000000, 0.85).setDepth(depth + 1);
        // узел с товаром у ног
        this.add.circle(cx + 26, cy + 28, 8, 0x6a4a26).setStrokeStyle(1, 0x3a2814).setDepth(depth);
        this.add.text(cx, cy + 52, t('🕯 Скупщик'), {
            fontSize: '10px', color: '#c9a14a', backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(depth + 1);
    }

    /** Кнопка сундука в ряду действий (только в пустом доме — приказ 16). */
    pushChestButton(interior, buttons) {
        const cfg = CHEST_HOUSES[interior.id];
        if (!cfg) return;
        const timeState = getTime(this.registry);
        const picked = !canPickChest(this.registry, interior.id, timeState);
        const label = picked ? t('🧰 Сундук (обчищен)') : t('🧰 Взломать сундук (Взлом)');
        buttons.push({ label, bg: 0x5a4a1a, hover: 0x6a5a2a, cb: () => this.openChest(interior) });
    }

    /**
     * ПАТЧ 66.74 (приказы 14–18): ВЗЛОМ СУНДУКА.
     *  • раз в месяц на дом (canPickChest); только в пустом доме —
     *    кнопка и так появляется лишь тогда;
     *  • попытка: СКРАДЫВАНИЕ (провал — геометрическая молва, 66.78 п.1),
     *    затем ХОЗЯЕВА (66.78 пп.2–3 + 66.79 пп.9–10: красный поп-ап
     *    «к дому идут хозяева», шанс сбежать — Ловкость/Скрадывание;
     *    провал побега — застукали: репутация у хозяев −30, в деревне
     *    −20, могут и напасть — бой), затем ВЗЛОМ: успех — лут 1–5 штук
     *    по таблице дома, крит — все 5;
     *  • попытка — ФИКСИРОВАННО 10 минут (66.78 п.8), усталость −1;
     *  • ПЕРВАЯ попытка кражи/взлома — однократное КРАСНОЕ предупреждение
     *    (66.78 п.7);
     *  • УДАЧА — хозяин ОБВОРОВАН и теперь ВСЕГДА подозревает игрока
     *    (66.79 п.1); краденое помечено происхождением (п.5–6).
     */
    openChest(interior) {
        if (this.busyDialog) return;
        // ПАТЧ 66.78 (приказ 7): первая попытка Кражи/Взлома — красный поп-ап
        if (!crimeWarnedOnce(this.registry)) {
            markCrimeWarned(this.registry);
            this.busyDialog = true;
            createDialog(this, t('⚠ ПРОТИВОЗАКОНИЕ!'),
                CRIME_WARNING_TEXT(),
                [
                    { text: t('Решиться'), callback: () => { this.busyDialog = false; this.doOpenChest(interior); } },
                    { text: t('Одуматься'), callback: () => { this.busyDialog = false; } },
                ],
                { singleton: false, coverColor: 0x5a0f0f, coverAlpha: 0.85 });
            return;
        }
        this.doOpenChest(interior);
    }

    doOpenChest(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const timeState = getTime(this.registry);
        const cfg = CHEST_HOUSES[interior.id];
        if (!cfg) return;
        if (!canPickChest(this.registry, interior.id, timeState)) {
            createDialog(this, t('🧰 Сундук'),
                t('Сундук пуст: ты уже обчистил его в этом месяце. Хозяева ещё не успели нажить добро — приходи через месяц.') +
                '\n\n' + t('(Приказ 16: сундук можно вскрывать не чаще раза в месяц.)'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
            return;
        }
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        tickTime(this.registry, 10, 'walk');   // ковырять замок — ровно 10 минут (66.78 п.8)
        spendFatigue(this.registry, 1);
        const res = attemptChestPick(this.registry, player, interior.id, timeState, {
            stealth: (player.skills && player.skills.stealth) || 10,
            lock: (player.skills && player.skills.lockpicking) || 10,
            hostNpcId: interior.npcId, // застукали — репутация у хозяев −30 (66.78 п.2)
            deferOwners: true, // 66.79 пп.9–10: сначала шанс сбежать, карают после провала
        });
        // 1) Скрадывание провалено (приказ 18): геометрическая молва уже списана
        if (res.stealthFailed) {
            createDialog(this, t('👣 Шорох за стеной'),
                tf(t('Ты ковырял замок, как вдруг в сенях хрустнула половица — кто-то идёт к дому! Ты скрылся задворками, но приметили тебя: по деревне пойдёт дурная молва.\n\n(Скрадывание {0}%: бросок {1} — провал; −{2} к репутации в деревне.)'), res.stealthSkill, res.stealthRoll, res.stealthPenalty),
                [{ text: t('Уйти пока цел'), callback: close }], { singleton: false });
            this.registry.set('player', player);
            this.updateHUD();
            return;
        }
        // 1а) ПАТЧ 66.78 (пп.2–3) + 66.79 (пп.9–10): ХОЗЯЕВА ВОЗВРАЩАЮТСЯ —
        // красный поп-ап с шансом СБЕЖАТЬ до их прихода (Ловкость/Скрадывание).
        if (res.ownersCame) {
            this.registry.set('player', player);
            this.showOwnersComing(interior);
            return;
        }
        // 2) Замок не поддался
        if (res.lockFailed) {
            ActionLog.add(this.registry, tf(t('Ковырял замок сундука в «{0}» (Взлом {1}%: бросок {2}) — замок крепок, сундук не открылся.'), interior.name, res.skill, res.roll));
            createDialog(this, t('🧰 Крепкий замок'),
                tf(t('Замок дубовый, окованный — отмычка скребёт да соскальзывает. Сундук цел, добро за хозяином.\n\n(Взлом {0}%: бросок {1} — провал. Пока дом пуст, можно пробовать снова — десять минут и риск на тебе.)'), res.skill, res.roll),
                [{ text: t('Отступить от сундука'), callback: close }], { singleton: false });
            this.registry.set('player', player);
            this.updateHUD();
            return;
        }
        // 3) УДАЧА: лут 1–5 штук по таблице дома (крит — все 5).
        // Патч 66.77 (приказ 2) + 66.78 (пп.4–5): лут кладётся КАК КРАДЕНЕЕ
        // (отдельная кучка узла) — сбыть можно ТОЛЬКО Скупщику по ночам.
        // Патч 66.79 (пп.5–6): краденое помечено ПРОИСХОЖДЕНИЕМ (дом) —
        // хозяева узнают свои вещи при осмотре у стражника и мире.
        res.items.forEach(it => addStolenItem(player, it.id, it.count, interior.id));
        if (res.dengas > 0) player.dengas = (player.dengas || 0) + res.dengas;
        this.registry.set('player', player);
        // ПАТЧ 66.79 (п.1): хозяин ОБВОРОВАН — теперь ВСЕГДА подозревает игрока.
        noteTheftDone(this.registry, interior.npcId);
        const lootLines = [];
        res.items.forEach(it => {
            const def = getLootDef(it.id);
            lootLines.push(`${def ? def.emoji : '📦'} ${def ? t(def.name) : it.id} ×${it.count}`);
        });
        if (res.dengas > 0) lootLines.push(`💰 ${t('деньги из шкатулки')} : ${res.dengas} ${t('д.')}`);
        ActionLog.add(this.registry, tf(t('Вскрыл сундук в «{0}»: {1} (Взлом {2}%: бросок {3}{4}).'), interior.name,
            lootLines.join(', '), res.skill, res.roll, res.crit ? t(' — крит') : ''));
        createDialog(this, res.crit ? t('🧰 До донышка!') : t('🧰 Замок поддался!'),
            tf(t('Отмычка нашла щёлк — крышка откинулась. В сундуке:{0}\n\n(Взлом {1}%: бросок {2}{3}. В этот месяц здесь больше нечего взять.)'),
                '\n· ' + lootLines.join('\n· '), res.skill, res.roll, res.crit ? t(' — КРИТ: вытянул всё до донышка!') : '')
            + '\n\n' + t('(Краденое добро честным скупщикам не сбыть: только Скупщику по ночам на постоялом дворе.)'),
            [{ text: t('Взять добро'), callback: close }], { singleton: false });
        this.updateHUD();
    }

    // ================================================================
    // ПАТЧ 66.79 (пп.9–10): ХОЗЯЕВА ИДУТ К ДОМУ — КРАСНЫЙ ПОП-АП И ПОБЕГ.
    //  • перед приходом хозяев — красное предупреждение;
    //  • есть шанс сбежать с ОБЯЗАТЕЛЬНОЙ проверкой Ловкости (ЛОВ×5)
    //    или Навыка Скрытности (Скрадывание) — на выбор игрока;
    //  • удача — игрок НЕ обнаружен, ничьих репутаций не коснулось;
    //  • провал побега (или «замереть») — застукали: −30 у хозяев,
    //    −20 в деревне, стражник у ворот получит право на осмотр;
    //  • удачный побег — герой появляется СНАРУЖИ дома, в деревне.
    // ================================================================

    /** Красный поп-ап «к дому идут хозяева» + выбор способа побега (п.9). */
    showOwnersComing(interior) {
        if (this.busyDialog) return;
        this.busyDialog = true;
        createDialog(this, t('⚠ К дому идут хозяева!'),
            t('Со двора слышны шаги и голоса — хозяева вот-вот войдут в дом и увидят тебя у открытого сундука! Стрелки солнца ещё ползут по полу — есть мгновение, чтобы скрыться. Как уйти?')
            + '\n\n' + t('(Побег — обязательная проверка Ловкости или Скрадывания. Удача — тебя не заметят; провал — застукают на месте преступления.)'),
            [
                { text: t('🏃 Бежать (Ловкость)'), callback: () => { this.busyDialog = false; this.attemptOwnerEscape(interior, 'dex'); } },
                { text: t('🫥 Ускользнуть (Скрадывание)'), callback: () => { this.busyDialog = false; this.attemptOwnerEscape(interior, 'stealth'); } },
                { text: t('Опустить голову и надеяться'), callback: () => { this.busyDialog = false; this.caughtByOwners(interior, true); } },
            ],
            { singleton: false, coverColor: 0x5a0f0f, coverAlpha: 0.85 });
    }

    /** Побег от хозяев (п.9): проверка Ловкости (ЛОВ×5) или Скрадывания. */
    attemptOwnerEscape(interior, mode) {
        const player = this.registry.get('player');
        if (!player) return;
        let res;
        if (mode === 'dex') {
            // Ловкость как характеристика — BRP: бросок против ЛОВ×5
            const dex = Math.max(1, Number(player.DEX) || 10);
            res = skillCheck(dex * 5);
            ActionLog.add(this.registry, tf(t('Побег через задворки (Ловкость {0}×5): бросок {1}.'), dex, res.roll));
        } else {
            const stealth = Math.max(1, (player.skills && player.skills.stealth) || 10);
            res = skillCheck(getBlessedSkill(this.registry, stealth));
            ActionLog.add(this.registry, tf(t('Ускользнул задворками (Скрадывание {0}%): бросок {1}.'), stealth, res.roll));
        }
        const ok = res.result === 'critical' || res.result === 'success';
        if (ok) {
            this.escapeToVillage(interior, mode, res);
        } else {
            this.caughtByOwners(interior, false, res);
        }
    }

    /** УДАЧНЫЙ ПОБЕГ (п.10): герой появляется снаружи дома, в деревне. */
    escapeToVillage(interior, mode, res) {
        ActionLog.add(this.registry, tf(t('Успел скрыться из «{0}» до прихода хозяев: тебя не обнаружили, дурной молвы нет ({1}).'),
            interior.name,
            mode === 'dex' ? tf(t('Ловкость, бросок {0}'), res.roll) : tf(t('Скрадывание, бросок {0}'), res.roll)));
        // Появиться снаружи дома — в локации деревня (п.10)
        const village = this.scene.get('Village');
        this.scene.stop(); // интерьер закрыт — деревня увидит героя у порога
        if (village) {
            if (typeof village.placePlayerOutsideHouse === 'function') {
                village.placePlayerOutsideHouse(interior.id);
            }
            // Поп-ап удачи покажет VillageScene после возобновления update()
            village.__pendingEscapePopup = { name: interior.name, mode, roll: res.roll };
        }
        if (this.scene.isPaused('Village')) this.scene.resume('Village');
    }

    /** Провал побега / «замереть» — хозяева ЗАСТУКАЛИ вора (пп.9→2–3). */
    caughtByOwners(interior, stayed, failRes) {
        const player = this.registry.get('player');
        if (player) this.registry.set('player', player);
        if (stayed) {
            ActionLog.add(this.registry, tf(t('Замер у сундука в «{0}» — и хозяева вошли: укрыться было негде.'), interior.name));
        } else if (failRes) {
            ActionLog.add(this.registry, tf(t('Побег не удался в «{0}» (бросок {1}): хозяева вошли и увидели вора.'), interior.name, failRes.roll));
        }
        // Списания застукивания: −30 у хозяев, −20 в деревне + маркер стражника
        const owners = applyOwnersCaught(this.registry, { hostNpcId: interior.npcId, interiorId: interior.id });
        this.updateHUD();
        if (owners.attack) {
            // Нападение хозяев (п.3 приказа 66.78): бой, как с враждебным жителем
            ActionLog.add(this.registry, tf(t('Хозяева вернулись во время воровства и бросились на тебя в «{0}»!'), interior.name));
            createDialog(this, t('🗡 На тебя нападают!'),
                t('Дверь распахивается — на пороге хозяева! Узнав вора, они с криком бросаются на тебя!\n\n(Репутация у хозяев −30, в деревне −20. У ворот деревни теперь вправе осмотреть твой узел.)'),
                [{ text: t('Драться!'), callback: () => {
                    // Бой — на следующий кадр (раунд 40, вне стека клика)
                    this.time.delayedCall(0, () => {
                        this.scene.start('Combat', { enemyKeys: ['villager'], npcId: interior.npcId + '_hostile' });
                    });
                } }], { singleton: false });
        } else {
            createDialog(this, t('👣 Хозяева застукали!'),
                t('Дверь распахивается — на пороге хозяева! Уйти не вышло: тебя запомнили, и по деревне уже бежит злая молва.\n\n(Репутация у хозяев −30, в деревне −20. У ворот деревни теперь вправе осмотреть твой узел.)'),
                [{ text: t('Опустить голову'), callback: () => { this.busyDialog = false; } }], { singleton: false });
        }
    }

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

    /**
     * Подёнка у гончара — ПАТЧ 66.74 (приказ 4): ПРОВЕРКА «РЕМЕСЛА»:
     *  • провал — брак на круге: ставка всего 2 д.;
     *  • успех — честная ставка 4–7 д.;
     *  • крит — «шедевр»: 6–9 д. И горшок мастеровой в узел (10 д. на продаже).
     * Найти монетку (15%) и слава подёнщика (+1, раз в сутки) — как прежде.
     */
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
        // Патч 66.73: подённая работа — тяжёлый труд (вес ×1.75, −2 ОУ)
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 2);
        player.HP = Math.max(1, (player.HP || 1) - 3);
        // ПАТЧ 66.74 (приказ 4): РЕМЕСЛО — проверка навыка
        const jobRes = craftDaywork(this.registry, (player.skills && player.skills.craft) || 15);
        const wage = jobRes.wage;
        if (jobRes.masterpiece) {
            addItem(player, 'master_pot', 1);
        }
        let bonus = 0;
        let bonusMsg = '';
        if (Math.random() < SCENE_CHANCES.potterCoinFind) {
            bonus = Phaser.Math.Between(SCENE_CHANCES.potterCoinMin, SCENE_CHANCES.potterCoinMax);
            bonusMsg = '\n\n' + tf(t('В углу мастерской блеснула чужая монетка — видать, обронил кто-то из заказчиков. Она твоя: +{0} д.'), bonus);
        }
        player.dengas = (player.dengas || 0) + wage + bonus;
        this.registry.set('player', player);
        this.updateHUD();
        const craftNote = jobRes.crit
            ? tf(t('Ремесло {0}%: бросок {1} — КРИТ: горшок вышел загляденье — мастеровой шедевр, в узле (продать за 10 д.)!'), jobRes.skill, jobRes.roll)
            : tf(t('(Ремесло {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.ok ? t('успех') : t('брак на круге'));
        ActionLog.add(this.registry, tf(t('Отработал час в гончарной мастерской: +{0} д., усталость −3 HP.{1}'), wage + bonus, jobRes.masterpiece ? t(' Шедевр — горшок мастеровой в узел.') : ''));

        // РАУНД 66.17 (п.6): СТАВКА ПОДЁНКИ — за отработанный день герою
        // начисляется МИНИМУМ 1 очко репутации в деревне (раз в сутки;
        // хоть десять часов в день — приработка и так честная, а репутация +1/день).
        // §12.3 (66.96): ставка подёнки — единый хелпер jobs.claimDayworkRep
        const repMsg = claimDayworkRep(this.registry);

        createDialog(this, jobRes.crit ? t('🏺 Шедевр на круге!') : t('Помощь в мастерской'),
            (jobRes.crit
                ? t('Час у круга и печи — и вдруг руки сами ведут: горшок вышел ровный, звонкий, как у самого Игната. «Эк ты горазд!» — ахает гончар.\n\n')
                : jobRes.ok
                    ? t('Час у круга и печи: носил дрова, мешал глину, ставил горшки на обжиг. Игнат доволен: «Работник, что надо!»\n\n')
                    : t('Час у круга — а глина в руки не идёт: пара горшков перекосилась на сушке. Игнат вздыхает: «Не твоя ли это работа, путник?»\n\n'))
            + tf(t('Заработано: +{0} д. Усталость: −3 здоровья.'), wage)
            + '\n' + craftNote
            + (jobRes.masterpiece ? t('\n+1 Горшок мастеровой (шедевр) — в узел.') : '')
            + bonusMsg + repMsg,
            [
                { text: t('Спасибо'), callback: () => {} },
            ]);
    }

    /**
     * ПАТЧ 66.76 (приказ 3): ТКАЧЕСТВО — подёнка за станком в доме ткачихи.
     * Оплата НАТУРОЙ: успех — отрез полотна в узел (+2 д. мелочью),
     * крит — отрез сукна (+3 д.), провал — «порвал нить», 2 д.
     * 1 час, −3 здоровья, −2 ОУ; ставка репутации подёнки — раз в сутки
     * (общий ключ dayworkRepDay с гончаром/кузницей).
     */
    workInWeaver() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        if ((player.HP || 0) <= 5) {
            createDialog(this, t('Силы кончились'), t('Станок требует ровных рук и ясных глаз: ослабевшему ткачихи не доверит. Поешь и отдохни.'), [
                { text: t('Справедливо...'), callback: () => {} },
            ]);
            return;
        }
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 2);
        player.HP = Math.max(1, (player.HP || 1) - 3);
        const jobRes = weaveDaywork(this.registry, (player.skills && player.skills.weaving) || 15);
        player.dengas = (player.dengas || 0) + jobRes.wage;
        if (jobRes.cloth) addItem(player, jobRes.cloth, 1);
        this.registry.set('player', player);
        this.updateHUD();
        const checkNote = jobRes.crit
            ? tf(t('(Ткачество {0}%: бросок {1} — КРИТ!)'), jobRes.skill, jobRes.roll)
            : tf(t('(Ткачество {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.ok ? t('успех') : t('нить порвалась'));
        ActionLog.add(this.registry, tf(t('Отработал час за станком ткачихи: +{0} д.{1} усталость −3 HP.'), jobRes.wage, jobRes.cloth ? (jobRes.crit ? t(' сукно в узел,') : t(' полотно в узел,')) : ''));
        // §12.3 (66.96): ставка подёнки — единый хелпер jobs.claimDayworkRep
        const repMsgW = claimDayworkRep(this.registry);
        createDialog(this, jobRes.crit ? t('🧶 Узор вышел ровен!') : t('Помощь за станком'),
            (jobRes.crit
                ? t('Час за станком — и нити легли ровно, узор стянулся без единой петли. Ткачиха гладит отрез: «Такое и на торгу не стыдно показать!»\n\n')
                : jobRes.ok
                    ? t('Час за станком: продевала нити, била уток, подкидывала челнок. Отрез сошёл ладный — ткачиха кивает: «Бери за работу полотном — годится!»\n\n')
                    : t('Час за станком — а нить то и дело рвётся. Ткачиха вздыхает: «Не станок виноват, руки не приноровились».\n\n'))
            + tf(t('Заработано: +{0} д.{1} Усталость: −3 здоровья.'), jobRes.wage, jobRes.cloth ? (jobRes.crit ? t(' +1 Сукно (отрез) в узел.') : t(' +1 Полотно холщовое в узел.')) : '')
            + '\n' + checkNote + repMsgW,
            [{ text: t('Спасибо'), callback: () => {} }]);
    }

    /**
     * ПАТЧ 66.76 (приказ 4): ПЛОТНИЦКОЕ ДЕЛО — подёнка у сруба (дом плотника).
     * Ставка приказа: успех 3–6 д.; провал — «запорол доску», 2 д.;
     * крит — «зарубка ровна», 7–10 д. 1 час, −3 здоровья, −2 ОУ.
     */
    workInCarpenter() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        if ((player.HP || 0) <= 5) {
            createDialog(this, t('Силы кончились'), t('Топор тяжёл, бревно упрямо: ослабевшему плотник топора не доверит. Поешь и отдохни.'), [
                { text: t('Справедливо...'), callback: () => {} },
            ]);
            return;
        }
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 2);
        player.HP = Math.max(1, (player.HP || 1) - 3);
        const jobRes = carpenterDaywork(this.registry, (player.skills && player.skills.carpentry) || 10);
        player.dengas = (player.dengas || 0) + jobRes.wage;
        this.registry.set('player', player);
        this.updateHUD();
        const checkNote = jobRes.crit
            ? tf(t('(Плотницкое дело {0}%: бросок {1} — КРИТ!)'), jobRes.skill, jobRes.roll)
            : tf(t('(Плотницкое дело {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.ok ? t('успех') : t('доска запорота'));
        ActionLog.add(this.registry, tf(t('Отработал час у плотника на срубе: +{0} д., усталость −3 HP.'), jobRes.wage));
        // §12.3 (66.96): ставка подёнки — единый хелпер jobs.claimDayworkRep
        const repMsgC = claimDayworkRep(this.registry);
        createDialog(this, jobRes.crit ? t('🪓 Ладная зарубка!') : t('Помощь плотнику'),
            (jobRes.crit
                ? t('Топор в руках ходил сам: зарубка легла ровно, шов плотён, топорище не скрипит. Плотник хлопает по плечу: «Рубить тебе, не путешествовать!»\n\n')
                : jobRes.ok
                    ? t('Час у сруба: тесал доски, вколачивал нагели, подавал брёвна. Работа спорится — плотник доволен.\n\n')
                    : t('Час у сруба — а доска то криво, то щепа в глаз. Плотник качает головой: «Доску запорол, платить буду по малой части».\n\n'))
            + tf(t('Заработано: +{0} д. Усталость: −3 здоровья.'), jobRes.wage)
            + '\n' + checkNote + repMsgC,
            [{ text: t('Спасибо'), callback: () => {} }]);
    }

    workInBarn() {
        // Раунд 37: амбар удалён (п.18) — работа переехала в мастерскую гончара
        // (workInPotter). Метод оставлен для старых сейвов/ссылок.
        this.workInPotter();
    }

    /**
     * ПАТЧ 66.74 (приказ 12): КУЗНЕЧНОЕ ДЕЛО — работа в кузне в помощь
     * кузнецу, за деньги. 1 час, −3 здоровья, −2 ОУ:
     *  • провал — черновая работа (дрова, меха, вода): 2–3 д.;
     *  • успех — у наковальни: 4–7 д.;
     *  • крит — «скоба как у мастера»: 8–12 д.
     * Кнопка видна, когда кузнец (или ученик) на месте.
     */
    helpBlacksmith(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        if ((player.HP || 0) <= 5) {
            createDialog(this, t('Силы кончились'), t('У горна жарко, молот тяжёл: ослабевшего подручного кузнец не возьмёт. Поешь и отдохни.'), [
                { text: t('Справедливо...'), callback: () => {} },
            ]);
            return;
        }
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 2);
        player.HP = Math.max(1, (player.HP || 1) - 3);
        const jobRes = smithyDaywork(this.registry, (player.skills && player.skills.smithing) || 15);
        player.dengas = (player.dengas || 0) + jobRes.wage;
        this.registry.set('player', player);
        this.updateHUD();
        const smithName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : t('кузнец');
        // ФИКС 66.80 (был ReferenceError repMsgC — копипаст из плотника):
        // в кузнице ставка репутации подёнки теперь работает как у остальных
        // §12.3 (66.96): ставка подёнки — единый хелпер jobs.claimDayworkRep
        const repMsgS = claimDayworkRep(this.registry);
        const checkNote = jobRes.crit
            ? tf(t('(Кузнечное дело {0}%: бросок {1} — КРИТ!)'), jobRes.skill, jobRes.roll)
            : tf(t('(Кузнечное дело {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.ok ? t('успех') : t('черновая работа'));
        ActionLog.add(this.registry, tf(t('Отработал час в кузнице в помощь кузнецу: +{0} д., усталость −3 HP.'), jobRes.wage));
        createDialog(this, jobRes.crit ? t('🔥 Ладная скоба!') : t('Помощь в кузнице'),
            (jobRes.crit
                ? tf(t('Ты держал клещи и бил молотом в лад — и вышла скоба, ровная, как у самого мастера. {0} глядит с уважением: «Поступай ко мне в подручные!»\n\n'), smithName)
                : jobRes.ok
                    ? tf(t('Час у горна: держал клещи, качал меха, бил по наковальне, куда мастер укажет. Работа ладится.\n\n'))
                    : tf(t('К молоту тебя не подпустили — носил дрова, качал меха да таскал воду. Работа черновая, и плата черновая.\n\n')))
            + tf(t('Заработано: +{0} д. Усталость: −3 здоровья.'), jobRes.wage)
            + '\n' + checkNote + repMsgS,
            [{ text: t('Спасибо'), callback: () => {} }]);
    }

    /**
     * ПАТЧ 66.80 (п.11-г): ЕПИТИМЬЯ — «замолить грехи» в церкви.
     * Пожертвование 50 д. РАЗ В КАЛЕНДАРНЫЙ МЕСЯЦ снимает до −5 деревенской
     * репутации (к нулю, не выше; личные обиды — не церковное дело).
     * Исторично: епитимья/вклад на помин души (Русь XV века).
     */
    absolutionInChurch() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const timeState = getTime(this.registry);
        if (absolutionUsedThisMonth(this.registry, timeState)) {
            createDialog(this, t('⛪ Епитимья уже принята'),
                t('Отец Савватий качает головой: «Ты уже замаливал грехи в этот месяц. Молись тихо и дела добрые делай — молва сама смягчится».'),
                [{ text: t('Поклониться иконам'), callback: () => {} }], { singleton: false });
            return;
        }
        if ((player.dengas || 0) < ABSOLUTION_COST) {
            createDialog(this, t('⛪ В мошне пусто'),
                tf(t('Замолить грехи стоит {0} д. — на свечи, ладан и помин души. Пособи деревне или заработай в мастерской, потом приходи.'), ABSOLUTION_COST),
                [{ text: t('Приду позже'), callback: () => {} }], { singleton: false });
            return;
        }
        player.dengas -= ABSOLUTION_COST;
        this.registry.set('player', player);
        const res = performChurchAbsolution(this.registry, timeState);
        this.updateHUD();
        if (res.success) {
            createDialog(this, t('⛪ Грехи замолены'),
                t('Ты кладёшь на блюдо 50 денег. Отец Савватий читает над тобой разрешительную молитву: «Госпи, остави согрешения его, и молва людская смягчится».')
                + '\n\n' + tf(t('Епитимья принята: репутация в деревне {0} → {1}. (Раз в месяц; личные обиды людей — не церковное дело.)'), res.before, res.after),
                [{ text: t('Низко поклониться'), callback: () => {} }], { singleton: false });
        } else {
            createDialog(this, t('⛪ Душа перед людьми чиста'),
                t('Отец Савватий улыбается: «Худой молвы за тобой не ведут — и замаливать нечего. Иди с миром».'),
                [{ text: t('Слава Богу'), callback: () => {} }], { singleton: false });
        }
    }

    /**
     * ПАТЧ 66.80 (п.12-в): «О СЛОВЕ» — торг о ставке подёнки ДО работы.
     * Раз в сутки: Убеждение против Убеждения хозяина — успех +25%,
     * крит +50%, провал — базовая ставка. Множитель действует на все
     * подёнки этого дня (jobs.js читает wageDealMultFor при выплате).
     * @param {string} npcId — хозяин (potter1, carpenter1, blacksmith, weaver1)
     * @param {string} hostGen — родительный падеж («гончара», «ткачихи»…)
     */
    wageDealDialog(npcId, hostGen) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const persuade = (player.skills && player.skills.persuade) || 10;
        const res = attemptWageDeal(this.registry, npcId, persuade);
        tickTime(this.registry, 10, 'talk'); // уговоры — те же 10 минут, что беседа
        this.updateHUD();
        const multNote = res.mult > 1
            ? '\n\n' + tf(t('Ставка на сегодня: ×{0} ко всем подёнкам.'), res.mult)
            : '';
        createDialog(this, t('🤝 О слове'),
            tf(t('Ты заводишь речь с {0} о ставке: мол, работа честная, а цена — как посмотришь…'), hostGen)
            + (res.checkLine ? '\n\n' + res.checkLine : '')
            + '\n\n' + res.message + multNote,
            [{ text: t('Договорились'), callback: () => {} }], { singleton: false });
    }

    /**
     * ПАТЧ 66.74 (приказ 5): ГРАМОТА — служка в храме. Помощь священнику
     * во время богослужения: читать псалтырь, держать кадило, выводить
     * клиросное. Кнопка видна, когда священник на месте; работает ТОЛЬКО
     * в окно службы (SERVICES: благовест … 2 часа после начала службы) —
     * в остальное время служке при пустом храме делать нечего.
     * Раз в сутки. Успех — 3–6 д., крит — 7–10 д. и похвала (+2 славы у
     * батюшки); провал — сбился со строки, служа без платы.
     */
    serveAtChurch(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const timeState = getTime(this.registry);
        const hour = timeState ? (timeState.hour ?? 12) : 12;
        // Окно богослужения: благовест (за полчаса) … 2 часа после начала
        const svc = SERVICES.find(s => hour >= s.blagoAt && hour < s.startAt + 2);
        if (!svc) {
            createDialog(this, t('📖 Не время службы'),
                t('Храм тих, свечи дремлют. Служке работа при богослужении: приди на заутреню (~6:00), обедню (~12:00), вечерню (~15:00) или повечерие (~18:00) — и предложи батюшке помощь.'),
                [{ text: t('Приду вовремя'), callback: () => {} }], { singleton: false });
            return;
        }
        const today = dayKeyOf(timeState);
        const q = this.registry.get('quest') || {};
        if (q.serveChurchDay === today) {
            createDialog(this, t('📖 Служба отошла'),
                t('Ты уже помогал при сегодняшней службе — не пристало одному мирянину служить без передышки. Приходи на другую службу завтра.'),
                [{ text: t('Справедливо'), callback: () => {} }], { singleton: false });
            return;
        }
        q.serveChurchDay = today;
        this.registry.set('quest', q);
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 1);
        const jobRes = acolyteServe(this.registry, (player.skills && player.skills.literacy) || 5);
        if (jobRes.ok) {
            player.dengas = (player.dengas || 0) + jobRes.wage;
            changeNpcRepExact(this.registry, 'priest', jobRes.crit ? 3 : 2, 'служба служкой');
            ActionLog.add(this.registry, tf(t('Служил при богослужении ({0}): +{1} д. от батюшки (Грамота {2}%: бросок {3}{4}).'),
                t(svc.name), jobRes.wage, jobRes.skill, jobRes.roll, jobRes.crit ? t(' — крит') : ''));
            createDialog(this, jobRes.crit ? t('📖 Чисто читаешь!') : t('📖 Служба отслужена'),
                (jobRes.crit
                    ? t('Ты читал псалтырь чисто и складно, кадило нёс ровно — сам священник похвалил на клиросе: «Дар у тебя, отрок». ')
                    : t('Час при службе: держал свечи, подавал кадило, подтягивал на клиросе где смог. '))
                + tf(t('Батюшка дал служке за службу: +{0} д.'), jobRes.wage)
                + tf(t('\n\n(Грамота {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.crit ? t('КРИТ') : t('успех'))
                + '\n' + t('Священник запомнил помощь: +2 к личной славе у батюшки.'),
                [{ text: t('Слава Богу'), callback: () => {} }]);
        } else {
            ActionLog.add(this.registry, tf(t('Пытался служить при богослужении ({0}) — сбился со строки (Грамота {1}%: бросок {2}).'), t(svc.name), jobRes.skill, jobRes.roll));
            createDialog(this, t('📖 Строка уплывает'),
                t('Без грамоты при службе туго: буквы в псалтыри сливаются, ты сбился дважды, кадило чуть не опрокинул. Священник мягко отсылает тебя с миром — без платы: «Учись, отрок, потом придёшь».')
                + tf(t('\n\n(Грамота {0}%: бросок {1} — провал.)'), jobRes.skill, jobRes.roll),
                [{ text: t('Смиренно поклониться'), callback: () => {} }]);
        }
        this.registry.set('player', player);
        this.updateHUD();
    }

    /**
     * ПАТЧ 66.74 (приказ 7): СКОМОРОШЕСТВО — гусли за столом постоялого
     * двора. Раз в сутки. 1 час, −1 ОУ:
     *  • успех — сбор со стола 3–8 д.; крит — 9–16 д. («стар и млад плясал»);
     *  • провал — струны вразлад, стол молчит;
     *  • fumble — переполох: скамья опрокинута (−2 к репутации деревни);
     *  • РИСК ГНЕВА ЦЕРКВИ (20% при любом исходе): молва о потешнике
     *    доходит до батюшки — −2 к личной славе у священника.
     */
    performAtTavern(interior) {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const today = dayKeyOf(getTime(this.registry));
        const q = this.registry.get('quest') || {};
        if (q.performanceDay === today) {
            createDialog(this, t('🪕 Струны отдохнули'),
                t('Сегодня ты уже тешил двор — и горло, и струны просят покоя. Завтра выйдет по-новому.'),
                [{ text: t('Ладно'), callback: () => {} }], { singleton: false });
            return;
        }
        q.performanceDay = today;
        this.registry.set('quest', q);
        tickTime(this.registry, 60, 'work');
        spendFatigue(this.registry, 1);
        const jobRes = tavernPerformance(this.registry, (player.skills && player.skills.performance) || 10);
        let repNote = '';
        if (jobRes.fumble) {
            changeVillageRep(this.registry, -2, 'скомороший переполох');
            repNote = '\n' + t('Переполох заметили все: −2 к репутации в деревне.');
        }
        if (jobRes.churchAngry) {
            changeNpcRepExact(this.registry, 'priest', -2, 'скоморошество');
            ActionLog.add(this.registry, t('Молва о скоморошестве дошла до батюшки: −2 к личной репутации у священника.'));
            repNote += '\n' + t('⛪ А поутру молва о потешнике дошла и до батюшки: Церковь скоморохов не жалует (−2 к репутации у священника).');
        }
        if (jobRes.ok) {
            player.dengas = (player.dengas || 0) + jobRes.coins;
            ActionLog.add(this.registry, tf(t('Скоморошил на гуслях за столом постоялого двора: собрал {0} д. со стола (Скоморошество {1}%: бросок {2}{3}).'),
                jobRes.coins, jobRes.skill, jobRes.roll, jobRes.crit ? t(' — крит') : ''));
            createDialog(this, jobRes.crit ? t('🪕 Стар и млад пляшет!') : t('🪕 Струны запели'),
                (jobRes.crit
                    ? t('Гусли запели так, что встал весь двор: плясали стар и млад, кошель ходил по кругу дважды! ')
                    : t('Перебирал струны под гул голосов — про Илью Муромца, про купца соболиного. За игру стол швырял медяки. '))
                + tf(t('Собрано со стола: +{0} д.'), jobRes.coins)
                + tf(t('\n\n(Скоморошество {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.crit ? t('КРИТ') : t('успех'))
                + repNote,
                [{ text: t('Поклониться столу'), callback: () => {} }]);
        } else {
            ActionLog.add(this.registry, tf(t('Скоморошил за столом — струны вразлад (Скоморошество {0}%: бросок {1}).'), jobRes.skill, jobRes.roll));
            createDialog(this, jobRes.fumble ? t('💥 Переполох!') : t('🪕 Не поётся'),
                (jobRes.fumble
                    ? t('Заволновался, задел локтем кружку, смахнул гусли — скамья грохнула, двое дрались уже не на шутку. Двор осерчал. ')
                    : t('Струны вразлад, пальцы чужие — двор не слушал, медяков никто не собрал. '))
                + tf(t('(Скоморошество {0}%: бросок {1} — {2}.)'), jobRes.skill, jobRes.roll, jobRes.fumble ? 'fumble' : t('провал'))
                + repNote,
                [{ text: t('Смущённо сесть за стол'), callback: () => {} }]);
        }
        this.registry.set('player', player);
        this.updateHUD();
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
        if (Math.random() < SCENE_CHANCES.driedAppleFind && player && canEat(this.registry).ok && (player.HP || 0) < (player.HPmax || 10)) {
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
        // 66.94 (P2-8 аудита): было `this._lightSources = []` — безусловная
        // зачистка УБИВАЛА тёплые пятна hasBg-фонов (очаг кузницы/церкви/
        // горниц, наполнение на 3995–4005 идёт ВЫШЕ этой строки). Теперь —
        // безопасное объединение: массив свежий (init), hasBg-пятна живут.
        this._lightSources = this._lightSources || [];
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
        // §12.3 (66.96): поштучные тайлы (40×19 ≈ 760 объектов на интерьер)
        // заменены ОДНИМ TileSprite. Чекборд int_floor_0/int_floor_1
        // (v = (col+row) % 2 — ФИКС «зелёной сетки» раунда 50 сохранён)
        // запекается в общую текстуру 64×64 (2×2 клетки) один раз на игру.
        // tilePosition(0, 32) воспроизводит исходную ФАЗУ узора: первая строка
        // пола лежала на y=100 → floor(100/32)=3 (нечётная) — так же сдвинута.
        if (!painted && !hasBg && this.textures.exists('int_floor_0')) {
            if (!this.textures.exists('int_floor_checker')) {
                const ct = this.textures.createCanvas('int_floor_checker', 64, 64);
                const f0 = this.textures.get('int_floor_0').getSourceImage();
                const f1 = this.textures.exists('int_floor_1')
                    ? this.textures.get('int_floor_1').getSourceImage() : f0;
                ct.context.drawImage(f0, 0, 0, 32, 32);
                ct.context.drawImage(f1, 32, 0, 32, 32);
                ct.context.drawImage(f1, 0, 32, 32, 32);
                ct.context.drawImage(f0, 32, 32, 32, 32);
                ct.refresh();
            }
            this.add.tileSprite(0, 100, width, height - 100, 'int_floor_checker')
                .setOrigin(0, 0).setTilePosition(0, 32).setDepth(-4);
        }
        // === Тайлы стен (если загружены; раунд 50: пропускается при тайловом фоне) ===
        // §12.3 (66.96): 3 ряда поштучных тайлов → один TileSprite (0..96,
        // ниже — светлая подложка стены, как прежде)
        if (!painted && !hasBg && this.textures.exists('int_wall')) {
            this.add.tileSprite(0, 0, width, 96, 'int_wall')
                .setOrigin(0, 0).setDepth(-4);
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

            // === 66.44 (приказ 3): ЦЕРКОВНЫЕ ПРЕДМЕТЫ вместо снятого фона ===
            // int_bg_church (фотореалистичный «зал с красным ковром») удалён —
            // интерьер теперь на общих тайлах избы; убранство добирают ПРЕДМЕТЫ:
            // лавки для прихожан вдоль прохода и стоячие подсвечники
            // (киот/иконостас/аналой/лампада рисуются выше всегда).
            // Лавки — по ЛЕВУЮ и ПРАВУЮ руку от прохода к аналою, лицом к горнему месту.
            if (this.textures.exists('int_deco_bench')) {
                [[0.16, 0.70], [0.26, 0.82], [0.78, 0.72], [0.68, 0.85]].forEach(([ux, uy]) => {
                    const bench = this.add.image(width * ux, height * uy, 'int_deco_bench')
                        .setScale(1.05).setDepth(5);
                    bench.setFlipX(ux > 0.5);   // правый ряд развёрнут к центру
                });
            }
            // Стоячие подсвечники — у киота и перед местным рядом иконостаса
            this.drawChurchCandleStand(width * 0.795, height * 0.58);
            this.drawChurchCandleStand(width * 0.40, height * 0.52);
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
    /**
     * 66.44 (приказ 3): СТОЯЧИЙ ЦЕРКОВНЫЙ ПОДСВЕЧНИК — бронзовая тумба
     * с наклонной чашей, три свечи с живыми огоньками (мерцание + тёплый свет).
     */
    drawChurchCandleStand(x, y) {
        const g = this.add.graphics().setDepth(6);
        // тень на полу
        g.fillStyle(0x000000, 0.3);
        g.fillEllipse(x, y + 4, 46, 12);
        // тумба-столб (бронза/тёмная бронза)
        g.fillStyle(0x5c4a22, 1);
        g.fillRect(x - 4, y - 58, 8, 58);
        g.fillStyle(0x7a6230, 1);
        g.fillRect(x - 4, y - 58, 3, 58);
        // основание
        g.fillStyle(0x5c4a22, 1);
        g.fillEllipse(x, y, 34, 10);
        g.fillStyle(0x8a6f38, 1);
        g.fillEllipse(x, y - 3, 26, 7);
        // чаша с песком
        g.fillStyle(0x6e5728, 1);
        g.fillEllipse(x, y - 60, 44, 12);
        g.fillStyle(0x8a6f38, 1);
        g.fillEllipse(x, y - 62, 38, 9);
        // три свечи разной высоты (восковые, с оплывками)
        [[-12, 34], [0, 44], [12, 28]].forEach(([dx, hh]) => {
            g.fillStyle(0xe8ddc0, 1);
            g.fillRect(x + dx - 3, y - 62 - hh, 6, hh);
            g.fillStyle(0xcabf9e, 1);
            g.fillRect(x + dx + 1, y - 62 - hh, 2, hh);
            g.fillStyle(0xf4ecd8, 1);
            g.fillRect(x + dx - 3, y - 62 - hh, 6, 3);
            // огонёк — живой (мерцает)
            const fx = x + dx, fy = y - 66 - hh;
            const flame = this.add.image(fx, fy, 'particle_spark')
                .setTint(0xffc24d).setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(7).setScale(0.3);
            this.tweens.add({
                targets: flame,
                alpha: { from: 0.55, to: 0.95 },
                scale: { from: 0.26, to: 0.38 },
                duration: Phaser.Math.Between(320, 520),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        });
        // тёплый свет подсвечника
        this._lightSources.push({ x, y: y - 70, w: 120, h: 70, a: 0.45 });
    }

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
        // Раунд 66.70: счётчик трапез при дате — живой (обновляется с HUD)
        if (this.dateHungerLine) {
            const timeState = getTime(this.registry);
            if (timeState) this.dateHungerLine.setText(`📅 ${formatDateTime(timeState)}  ·  ${hungerStatusLine(this.registry)}  ·  ${fatigueStatusLine(this.registry)}`);
        }
        // Патч 66.46 (приказ 2): тёплый свет зари/заката живой
        if (this.sunLight) this.sunLight.update(getTime(this.registry));
    }
}

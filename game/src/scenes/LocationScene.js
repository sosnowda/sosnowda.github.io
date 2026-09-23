// Сцена локации (лес/тракт/река/поле) — поиск следов вора.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { FORK_LOCATIONS } from '../data/interiors.js';
import { getLocationById, isForestLocation, forestDeeper, forestShallower } from '../data/mapLocations.js';
import {
    searchLocation, getHuntState, checkGameEnd,
    isChaseActive, isThiefAt, presentThiefEncounter,
    getFootprints, examineFootprint, getChase, askNPC, worldMinutesOf,
} from '../data/thief.js';
import { onLocationVisited, getActiveQuests } from '../data/questGenerator.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog, bindRestartOnResize, addSceneMenuButtons } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import { getTime, getDayNightOverlay, tickTime, getSeason } from '../systems/TimeSystem.js';
// Раунд 32 (п.5): ЛЮБОЕ перемещение между локациями по карте = ровно 1 час
import { MAP_TRAVEL_MINUTES } from './ForkScene.js';
// Раунд 29: счёт времени «как на Руси XV века» — эра, косые часы, народные ориентиры
import { formatDateRus, slavonicHourLine, folkTimeName, showChroniclePanel } from '../systems/RusTime.js';
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах, час за беседу
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine, TALK_MINUTES } from '../systems/WorldClock.js';
// Раунд 31 (п.2): стадо и пастухи на водопое
import { getHerdState } from '../data/herd.js';
import { getWeather, applyWeatherVisuals, isRainy } from '../systems/Weather.js';
// Раунд 66.7 (п.4): сезонные запреты/бонусы рыбалки (нерест/жор)
import { fishingSeason } from '../systems/FishingSeasons.js';
// Раунд 36: рыбалка переехала из деревни (пруд удалён) на Реку
// Раунд 66.10: дневные лимиты — из data/daily.js (сундуки/тайники удалены по приказу владельца)
import { dayKeyOf, isActionDoneToday, markActionDone } from '../data/daily.js';
import { t, tf } from '../systems/i18n.js';
import { findNpc, getNpcDisplayName } from '../data/npcNames.js';
import { getNpcsAtPlace, NPC_DIALOGUE, pickOutdoorLine } from '../data/npcPresence.js';
import { npcPortraitVariantKey } from '../systems/NpcLook.js';
import { getNpcSpriteKey, isChildNpc } from '../systems/NpcLpc.js';
import { addMorningFog, addSeasonalGround } from '../systems/AmbientFX.js';
// Раунд 68 (п.5): коллизия воды — ни НПЦ, ни персонаж не входят в воду на
// локациях «Река» и «Озеро» (споты/следы/стадо выталкиваются на берег)
import { isWaterAt, clampOutOfWater } from '../systems/WaterBounds.js';
// Раунд 66.6: ШУМ РЕКИ/ОЗЕРА (WebAudio, без ассетов) + плеск при рыбалке;
// СЕЗОННЫЕ РАБОТЫ поля (пахота/посев/сенокос/жатва) — приказ владельца
import { attachRiverAmbience, playWaterSplash, RIVER_VOLUME_BY_LOCATION } from '../systems/RiverAmbience.js';
import { getSeasonalWork, seasonalWorkerLine, fieldPhaseOf } from '../systems/SeasonalWork.js';
import { showBellToast } from '../systems/ChurchBells.js';
import { ensureNpcLpcTexture } from '../systems/NpcLpc.js';

// Раунд 27 (п.1): прозрачные деревья без фона вместо квадратных тайлов
const TREE_KEYS = ['deco_tree_0', 'deco_tree_1', 'deco_tree_2', 'deco_tree_3', 'deco_tree_4', 'deco_pine_0', 'deco_pine_1'];

const LOCATION_BG = {
    forest: 0x1a2a1a,
    forest_edge: 0x3d6b33,   // раунд 30: опушка — светлее чащи
    forest_glade: 0x4d7d3a,  // раунд 30: поляна — солнечная трава
    road: 0x4a3a2a,
    river: 0x4a7c3a,    // П.10: трава (река рисуется поверх)
    field: 0x4a7c3a,    // П.14: трава (жёлтое поле рисуется поверх)
    lake: 0x4a7c3a,     // П.12: трава (озеро рисуется поверх)
    pogost: 0x3a3a2a,
    pasture: 0x5a8a3a,
    mill: 0x4a7c3a,     // П.5,13: трава (мельница рисуется поверх)
};

export class LocationScene extends Phaser.Scene {
    constructor() {
        super('Location');
    }

    /**
     * Раунд 34: громкость колокольного звона — насколько локация далеко
     * от храма и часовни. Погост с часовней слышит звон почти целиком,
     * лес и чаща — глухо.
     */
    bellVolume() {
        switch (this.locationId) {
            case 'pogost': return 0.85;   // часовня рядом
            case 'field':
            case 'pasture': return 0.65;  // открытые места
            case 'lake':
            case 'river': return 0.55;
            case 'mill': return 0.5;
            default: return 0.35;         // лес, чаща, дорога
        }
    }

    init(data) {
        this.locationId = data?.locationId || 'forest';
        this.from = data?.from || 'Fork';
        // Раунд 30 QA-фикс: флаг диалога не должен переживать рестарт сцены
        // (застрявший true блокировал все клики после перезахода на локацию)
        this.busyDialog = false;
        // Раунд 20 (слияние Пасек): статичного вида пасеки больше нет —
        // охотничья пасека открывается через ходячую ApiaryScene с поиском следов.
        if (this.locationId === 'apiary') {
            this.scene.start('Apiary', { from: this.from, hunt: true });
            return;
        }
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);
        // Раунд 31 (п.12): мировые часы тикают РЕАЛЬНЫМ временем, а пока
        // открыт разговор (диалог) — стоят
        attachWorldClock(this);
        attachChurchBells(this, { volume: this.bellVolume() });
        // Раунд 66.6: шум воды на «водяных» локациях — река громче всех,
        // озеро тише, у мельницы слышно водяное колесо. WebAudio, без ассетов.
        attachRiverAmbience(this, { volume: RIVER_VOLUME_BY_LOCATION[this.locationId] || 0 });
        // Раунд 32 (пп.14,15): F1 — «Информация по игре» и на локациях
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ Информация по игре',
                timeRatioInfoLine() + '\n\n' +
                t('🔍 Каждый след проверяется отдельно и только один раз;\nнеудача затирает след. Ночью следы читаются хуже.\n🕐 Обследование следа занимает ровно 1 игровой час.\n◀ Назад к развилке — тоже час дороги.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singletonKey: 'location-help' });
        });
        this.audioManager.playSceneMusic('village');

        const loc = getLocationById(this.locationId) || FORK_LOCATIONS.find(l => l.id === this.locationId) || { name: this.locationId, icon: '❓', description: '' };
        const state = getHuntState(this.registry);

        // ----- Фон локации — устанавливаем базовый цвет -----
        this.cameras.main.setBackgroundColor(LOCATION_BG[this.locationId] || 0x1a2a1a);
        this.drawLocationBackground(this.locationId, width, height);

        // ----- Overlay дня/ночи (п.5) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- Погода (раунд 14): дождь/снег над текстовой локацией -----
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 96 });

        // ----- Раунд 28 (пп.4,5): УТРЕННИЙ ТУМАН + СЕЗОННАЯ ЗЕМЛЯ —
        // на ВСЕХ локациях (туман с рассвета до 9 утра, снег зимой,
        // листья осенью, цветы весной — по календарю игры) -----
        const fogSeason = addSeasonalGround(this, { width, height, density: this.locationId === 'pogost' ? 0.6 : 1 });
        addMorningFog(this, { width, height, yMin: 110, yMax: height - 60, depth: 55 });

        // Раунд 28 (п.5): зимой/осенью кроны деревьев перекрашиваются
        // (зимний иней / осеннее золото) — по календарю, не по погоде дня
        if (fogSeason === 'winter' || fogSeason === 'autumn') {
            this.children.list.forEach((ch) => {
                if (ch.type === 'Image' && ch.texture && TREE_KEYS.includes(ch.texture.key)) {
                    ch.setTint(fogSeason === 'winter' ? 0xd6e4ee : 0xe0b060);
                }
            });
        }

        // ----- Заголовок -----
        this.add.text(width / 2, 20, `${loc.icon} ${loc.name}`, {
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 55, loc.description, {
            fontSize: '13px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5, 0);

        // Дата и время (п.13) + погода дня (раунд 14) + время «как на Руси» (раунд 29)
        if (timeState) {
            const weather = getWeather(this.registry);
            // Раунд 31: часы — по МИРОВОМУ времени (пп.10–12: реальный ход +
            // час за разговор/обследование; современные ЧЧ:ММ убраны)
            const rusDateLine = () => `📅 ${formatDateRus(timeState)}   ${weather.icon} ${weather.name}   🕐 ${slavonicHourLine(timeState)} · ${folkTimeName(timeState.hour + (timeState.minute || 0) / 60)}`;
            this.dateLine = this.add.text(width / 2, 80, rusDateLine(), {
                fontSize: '11px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0).setDepth(100);
            // Раунд 29: клик по дате открывает «Летопись» (полная датировка с индиктом)
            this.dateLine.setInteractive({ useHandCursor: true });
            this.dateLine.on('pointerup', () => showChroniclePanel(this));
            // Раунд 28 (п.5): часы реального времени тикают, пока игрок на локации
            this.time.addEvent({
                delay: 15000, loop: true,
                callback: () => {
                    if (this.dateLine && this.dateLine.active) {
                        this.dateLine.setText(rusDateLine());
                    }
                },
            });
        }

        // ----- HUD -----
        const player = this.registry.get('player');
        const q = this.registry.get('quest') || {};
        // Раунд 45 (п.1 заявки): параметр «меч» (⚔%) из верхнего виджета удалён
        // Раунд 46 (п.8 заявки): из статус-бара удалён и параметр «✦ Воля» (MP)
        this.add.text(16, 12, `❤ ${player.HP}/${player.HPmax}`, {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);
        // Раунд 66.12 (приказ владельца №6): счётчик часов до побега вора СКРЫТ
        // из HUD — игрок не видит, сколько вору осталось до побега. Внутренний
        // счётчик погони работает как прежде. Попутно устранён латентный краш:
        // doSearch() вызывал chaseHoursLeft, который здесь никогда не импортировался.

        // ----- Игрок -----
        // Раунд 28 QA-фикс: у спрайта героя не было depth — на локациях,
        // где фон рисуется graphics с depth 1 (поле/озеро), герой оказывался
        // ПОД заливкой и «исчезал». Ставим его поверх фона, но под NPC.
        // Раунд 50 (п.9): спрайт героя берётся из player.sprite (облики
        // Medieval-Heroes I; композит LPC — прежний приоритет).
        const regPlayer50 = this.registry.get('player') || {};
        const useComposite50 = !!(regPlayer50.useComposite && this.textures.exists('player_composite'));
        const locPlayerTex = useComposite50 ? 'player_composite'
            : ((regPlayer50.sprite && this.textures.exists(regPlayer50.sprite)) ? regPlayer50.sprite : 'player');
        // Раунд 68 (п.5): спавн игрока вне воды — на Реке точка (0.2w, 0.6h)
        // попадала в полосу воды; clamp выталкивает её на ближайший берег.
        const spawnPt68 = clampOutOfWater(this.locationId, width, height, width * 0.2, height * 0.6, 30);
        this.playerSprite = this.add.sprite(spawnPt68.x, spawnPt68.y, locPlayerTex, 0).setScale(2.5).setDepth(40);
        const locIdle = useComposite50 ? 'player_composite_idle_right' : `${locPlayerTex}_idle_right`;
        this.playerSprite.play(this.anims.exists(locIdle) ? locIdle : 'player_idle_right');
        this.tweens.add({
            targets: this.playerSprite,
            y: { from: spawnPt68.y, to: spawnPt68.y - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ----- Состояние поиска + погоня (раунд 21) -----
        const chaseActive = isChaseActive(this.registry);
        // Раунд 66.12 (п.5 приказа): ЛИХИЕ ЛЮДИ на большой дороге. Поручение
        // «Избить лихих людей» теперь выполняется ЗАСАДОЙ на дороге (шанс 60%
        // при входе на «Большую дорогу на юг» с активным поручением) — раньше
        // единственным «разбойником» в игре был... враждебный житель в деревне.
        if (this.locationId === 'road_south' && !chaseActive) {
            const banditQuest = getActiveQuests(this.registry).find(qq =>
                qq.combat && qq.enemyKeys && qq.enemyKeys.includes('bandit'));
            if (banditQuest && Math.random() < 0.6) {
                ActionLog.add(this.registry, t('На большой дороге тебе преградили путь лихие люди!'));
                this.time.delayedCall(500, () => this.scene.start('Combat', { enemyKeys: ['bandit'], fromScene: 'Location' }));
                return;
            }
        }
        const alreadySearched = state.locationsSearched.includes(this.locationId);
        // Раунд 30 (пп.4–6): ВИДИМЫЕ СЛЕДЫ — если вор оставил следы на этой
        // локации, общий поиск заменяется отдельной проверкой каждого следа
        const footprints = chaseActive ? getFootprints(this.registry, this.locationId) : [];
        const hasFootprints = footprints.length > 0;
        if (chaseActive && alreadySearched && !hasFootprints) {
            this.add.text(width / 2, height * 0.4, t('Ты уже прочитал следы в этой местности.\nНовых здесь не найти.'), {
                fontSize: '18px', color: RUS.textDim, align: 'center',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5);
        }

        // ----- ВСТРЕЧА С ВОРОМ (раунд 21): если вор в локации — игрок видит его сразу -----
        const thiefHere = isThiefAt(this.registry, this.locationId);
        // ----- Раунд 32 (п.10): ПОП-АП О НАВОДКЕ НПЦ при заходе на локацию,
        // на которую указал свидетель. Пока наводка свежа (первые 5 часов)
        // и вор ещё здесь — про неё напоминает сама встреча; если срок вышел
        // или вор ушёл раньше срока — честно говорим, что наводка устарела.
        this.showNpcHintPopupIfAny(width, height, thiefHere);
        if (thiefHere) {
            this.time.delayedCall(400, () => presentThiefEncounter(this, this.locationId));
        }

        // П.11,16: Названия кнопок зависят от локации.
        // Для Реки: «Поиск» и «Выход». Для Тракта: «Осмотр» и «Выход».
        // Для остальных: «Искать следы» и «Назад к развилке».
        const isRiver = this.locationId === 'river';
        const isRoad = this.locationId === 'road' || this.locationId === 'road_south';
        const searchLabel = isRiver ? t('🔍 Поиск') : (isRoad ? t('🔍 Осмотр') : t('🔍 Искать следы'));

        // ===== РАУНД 39 (п.23 заявки): ЛЕС — ЦЕПОЧКА ЛОКАЦИЙ =====
        // Вход в лес только через Опушку; глубже — последовательно
        // (Опушка → Поляна → Густой лес); выход из леса тоже последовательно.
        const inForest = isForestLocation(this.locationId);
        const deeperId = inForest ? forestDeeper(this.locationId) : null;
        const shallowerId = inForest ? forestShallower(this.locationId) : null;
        const deeperLoc = deeperId ? getLocationById(deeperId) : null;
        const shallowerLoc = shallowerId ? getLocationById(shallowerId) : null;

        let exitLabel;
        if (inForest && shallowerLoc) {
            exitLabel = `◀ ${t(shallowerLoc.name)}`;           // шаг назад по цепочке
        } else if (inForest) {
            exitLabel = t('◀ К околице');                    // Опушка → развилка
        } else {
            exitLabel = (isRiver || isRoad) ? t('🚪 Выход') : t('◀ Назад к развилке');
        }

        // ----- Кнопка поиска/осмотра (только пока активна погоня и НЕТ следов:
        // раунд 30 — где вор прошёл, там следы проверяются по одному кликом) -----
        const hasSearchBtn = chaseActive && !alreadySearched && !hasFootprints;
        if (hasSearchBtn) {
            createButton(this, width / 2, height - 100, tf(t('{0} (проверка Внимательности)'), t(searchLabel)), () => {
                this.doSearch();
            }, {
                backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
                fontSize: 18, padding: { left: 24, right: 24, top: 14, bottom: 14 },
                cornerRadius: 8,
            }).setScrollFactor(0).setDepth(50);
        }

        // ----- Кнопка «глубже в лес» — только в лесной цепочке (п.23) -----
        if (deeperLoc) {
            const hasSearch = hasSearchBtn;
            const deeperY = hasSearch ? height - 152 : height - 100;
            createButton(this, width / 2, deeperY, tf(t('🌿 Глубже в лес: {0} →'), t(deeperLoc.name)), () => {
                tickTime(this.registry, MAP_TRAVEL_MINUTES);   // переход = 1 игровой час
                ActionLog.add(this.registry, tf(t('Игрок углубился в лес: «{0}».'), t(deeperLoc.name)));
                onLocationVisited(this.registry, deeperId);
                this.scene.restart({ locationId: deeperId, from: this.from });
            }, {
                backgroundColor: 0x2e4a2e, hoverColor: 0x3c5c3c, textColor: '#c9e0b0',
                fontSize: 16, padding: { left: 20, right: 20, top: 12, bottom: 12 },
                cornerRadius: 8,
            }).setScrollFactor(0).setDepth(50);
        }

        // ----- Кнопка рыбалки на Реке (раунд 36: пруд в деревне удалён,
        // рыба ловится на броду через реку — как в XV веке) -----
        if (isRiver) {
            const fishY = (chaseActive && !alreadySearched && !hasFootprints) ? height - 150 : height - 100;
            createButton(this, width / 2, fishY, t('🎣 Рыбалка'), () => {
                this.goFishing();
            }, {
                backgroundColor: 0x2a4a5a, hoverColor: 0x3a5a6a, textColor: RUS.text,
                fontSize: 16, padding: { left: 20, right: 20, top: 12, bottom: 12 },
                cornerRadius: 8,
            }).setScrollFactor(0).setDepth(50);
        }

        // ----- Кнопка выхода: из леса — НАЗАД ПО ЦЕПОЧКЕ (п.23);
        // с опушки и из обычных локаций — на околицу/разилку -----
        createButton(this, width / 2, height - 50, exitLabel, () => {
            // Раунд 32 (п.5): любое перемещение по карте — РОВНО 1 игровой час
            tickTime(this.registry, MAP_TRAVEL_MINUTES);
            if (inForest && shallowerLoc) {
                ActionLog.add(this.registry, tf(t('Игрок вышел из леса на «{0}».'), t(shallowerLoc.name)));
                this.scene.restart({ locationId: shallowerId, from: this.from });
            } else {
                ActionLog.add(this.registry, tf(t('Игрок покинул локацию «{0}».'), t(loc.name)));
                this.scene.start(this.from);
            }
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 12, bottom: 12 },
            cornerRadius: 8,
        }).setScrollFactor(0).setDepth(50);

        // Раунд 40 (заявка п.1): [📜 Персонаж] / [🎒 Инвентарь] вверху
        // справа — ВО ВСЕХ локациях, единый стиль с деревней/лесом/пасекой
        addSceneMenuButtons(this, 'Location');

        // ----- Раунд 27 (пп.7,8): ЖИТЕЛИ НА ЛОКАЦИЯХ —
        // Авдей на мельнице, Марфа с травами на озере/реке/в лесу и т.д.
        this.drawLocationNpcs(width, height);

        // ----- Раунд 66.6: СЕЗОННЫЕ РАБОТЫ на Поле — статисты-крестьяне
        // (пахарь/сеятель/косарь/жнец) + плашка «Сенокосная пора…» -----
        if (this.locationId === 'field') {
            this.spawnSeasonalWorkers(width, height);
            const work66 = getSeasonalWork(getTime(this.registry));
            showBellToast(this, work66.toast);
        }

        // ----- Раунд 30 (пп.3–6): ВИДИМЫЕ СЛЕДЫ ВОРА — рисуем поверх фона,
        // клик по следу — отдельная проверка (единожды на след) -----
        if (hasFootprints) {
            const trace = getChase(this.registry);
            const traceSide = trace && trace.traces && trace.traces[this.locationId] ? trace.traces[this.locationId].side : null;
            this.drawFootprints(footprints, traceSide, width, height);
        }
    }

    /**
     * Раунд 36: рыбалка на Реке (пруд в деревне удалён по заявке владельца).
     * Первый улов за день: свежая рыба +3 ❤, уходит 1 час. Повторно —
     * «не клюёт», уходит 15 минут. В дождь рыба активнее (+4), зимой —
     * лунка во льду (механика переехала из VillageScene без изменений).
     * РАУНД 66.7 (п.4): СЕЗОННЫЕ ЗАПРЕТЫ/БОНУСЫ — апрель-май НЕРЕСТ
     * (запрет), сентябрь-октябрь ЖОР (+2), декабрь-февраль лунка.
     */
    goFishing() {
        const player = this.registry.get('player');
        if (!player) return;
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const winter = timeState ? getSeason(timeState.month) === 'winter' : false;
        const season = fishingSeason(timeState ? timeState.month : 9);

        // --- НЕРЕСТ (апрель-май): запрет — рыба метать икру, ловить грех ---
        if (season.blocked) {
            tickTime(this.registry, 15);
            ActionLog.add(this.registry, season.log);
            createDialog(this, season.title,
                t('Ты подошёл к воде с удочкой — и остановился. У самого берега, в тёплой мутной воде, рыба трётся: спины и плавники ходят косяком. Нерест.\n\nЛовить в нерест — грех и разорение: убьёшь по паре штук — и осенью в реке рыбы не будет. Старики говорят: «Пропустишь нерест — весь год пропадёт». Удочки убраны до лета.')
                + `\n\n${t('(Рыбалка закрыта до июня.)')}`,
                [{ text: t('Сберечь рыбу'), callback: () => {} }]);
            return;
        }

        const caught = isActionDoneToday(q, 'fish_daily', today);
        const title = season.title;
        // Раунд 66.6: плеск воды — заброс/лунка озвучены всегда
        playWaterSplash(this, winter ? 0.5 : 0.7);

        if (!caught) {
            tickTime(this.registry, 60);
            markActionDone(q, 'fish_daily', today);
            this.registry.set('quest', q);
            // Раунд 14: в дождь рыба активнее (+4 вместо +3).
            // Раунд 66.7: осенний жор — ещё +2 (сезонный бонус).
            const weather = getWeather(this.registry);
            const raining = weather && isRainy(weather);
            const heal = (raining ? 4 : 3) + (season.bonus || 0);
            player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
            this.registry.set('player', player);
            let catchLine;
            if (winter) {
                catchLine = t('Прорубаешь лунку на реке и долго ждёшь, грея пальцы... Поплавок дёргается — на льду бьётся налим. Ужин обеспечен.');
            } else if (raining) {
                catchLine = t('Забросил удочку с берега под моросящим дождём... Рыба клюёт одна за другой — вёдра полные!');
            } else if (season.id === 'autumn_feed') {
                catchLine = t('Рыба жирует перед зимой и берёт жадно: крючок едва успевает коснуться дна. Корзина полна!');
            } else {
                catchLine = t('Забросил удочку с песчаного брода... Через час в корзине пара ершей и лещ. Свежая рыба — это силы.');
            }
            ActionLog.add(this.registry, winter
                ? tf(t('Порыбачил через лунку — налим к ужину (+{0} ❤).'), heal)
                : (raining
                    ? tf(t('Дождь — рыба идёт на крючок смело. Отличный улов (+{0} ❤).'), heal)
                    : tf(t('Наловил рыбы на реке к обеду (+{0} ❤).'), heal)));
            createDialog(this, title,
                catchLine
                + `\n\n${t('Свежая рыба')}: +${heal} ❤.`
                + (season.id === 'autumn_feed' ? `\n${t('(Осенний жор: +2 ❤ к улову.)')}` : ''),
                [{ text: t('Взять улов'), callback: () => {} }]);
        } else {
            tickTime(this.registry, 15);
            ActionLog.add(this.registry, t('Порыбачил на реке — клёв плохой.'));
            createDialog(this, title,
                t('Клюёт плохо: рыба сыта или уже видела твою наживку. Попробуй завтра.'),
                [{ text: t('Смотать удочку'), callback: () => {} }]);
        }
    }

    /**
     * Раунд 32 (п.10): поп-ап о статусе НАВОДКИ НПЦ при входе на локацию,
     * на которую указал свидетель. Наводка действительна только первые
     * 5 игровых часов (NPC_HINT_VALID_HOURS) — потом вор уходит в другую
     * локацию, и об этом игрок узнаёт именно здесь, на месте.
     * Показывается один раз на наводку (q.npcHint.popupShown).
     */
    showNpcHintPopupIfAny(width, height, thiefHere) {
        const q = this.registry.get('quest');
        if (!q || !q.npcHint || q.npcHint.popupShown) return;
        if (q.npcHint.locId !== this.locationId) return;
        const hint = q.npcHint;
        const now = worldMinutesOf(this.registry);
        const expired = !!hint.broken || now >= hint.expiresAtMin;
        // Если вор сам сидит на локации и наводка свежа — он игроку и так
        // виден: встреча говорит сама за себя, поп-ап не нужен.
        if (!expired && thiefHere) return;
        hint.popupShown = true;
        this.registry.set('quest', q);
        const locName = (getLocationById(hint.locId) || {}).name || hint.locId;
        // Раунд 66.12 (приказ владельца №6): ЖИВЫХ ЧАСОВ в подсказке больше нет —
        // игрок не видит обратного отсчёта (ни до побега вора, ни до конца наводки):
        // только само правило «наводка живёт недолго».
        const title = expired ? t('⟳ Наводка устарела') : t('📍 Ты по адресу!');
        const body = expired
            ? tf(t('Селяне говорили, что вора видели у «{0}». Но с той поры прошло больше пяти часов — наводка больше не верна: вор давно перебрался в другое место. Ищи свежие следы или расспроси новых людей!'), locName)
            : tf(t('Селяне говорили правду: вора видели именно здесь, у «{0}»! Но помни: наводка живёт недолго — поспеши, пока вор не перебрался в другое место!'), locName);
        this.time.delayedCall(250, () => {
            if (this.busyDialog) return;
            createDialog(this, title, body, [
                { text: t('Понятно'), callback: () => { this.busyDialog = false; } },
            ], { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
        });
        ActionLog.add(this.registry, expired
            ? tf(t('Наводка на «{0}» устарела — вор перебрался в другое место.'), locName)
            : tf(t('Наводка привела на «{0}».'), locName));
    }

    /**
     * Раунд 27: NPC по системе присутствия (npcPresence.js) — если по
     * расписанию житель сейчас на этой локации, рисуем его спрайт,
     * имя и даём поговорить (полное дерево диалога или короткая реплика).
     * Раунд 28: спрайты — LPC-композиты (п.2); добавлен ВЫПАС (пастбище);
     * дети пахаря видны на своих локациях (п.1) — до 4 штук, меньшего роста.
     */
    drawLocationNpcs(width, height) {
        // Раунд 68 (п.5): споты Реки/Озера вынесены из воды по построению
        // (раньше (0.5w+120, 0.5h+30) на Реке и (0.5w+60, 0.5h+30) на Озере
        // попадали ПРЯМО В ВОДУ); clamp в drawLocationNpc страхует каждую
        // нарисованную фигуру. Озеро: восточный берег за кольцом кустов
        // (радиус кустов r+15..r+55 → берём r+84). Река: северный берег
        // восточнее дороги к мосту (стадо/следы — на юге и на дороге).
        const lakeR68 = Math.min(width, height) / 3.5;
        const SPOTS = {
            mill:   { x: width * 0.5 - 100, y: height * 0.5 + 55 },
            // Озеро: восточный берег; +120 даёт запас под полуширину спрайта
            // (37px у взрослого 2.3×) и кольцо кустов; на узких экранах спот
            // прижимается к краю, а clamp выталкивает его за кромку воды.
            lake:   { x: Math.min(width * 0.5 + lakeR68 + 120, width - 70), y: height * 0.5 + 30 },
            river:  { x: width * 0.5 + 150, y: height * 0.45 - 80 },
            forest: { x: width * 0.42, y: height * 0.62 },
            field:  { x: width / 6 + (width * 2 / 3) * 0.28, y: height * 0.58 },
            pasture: { x: width * 0.55, y: height * 0.62 },   // раунд 28: дети на выпасе
        };
        const spot = SPOTS[this.locationId];
        if (!spot) return;
        // Раунд 31 (п.2): пастухи рисуются ПРИ СТАДЕ (отдельными спотами)
        const SHEPHERD_IDS = ['shepherd1', 'shepherd2'];
        const here = getNpcsAtPlace(this.registry, this.locationId).filter(id => !SHEPHERD_IDS.includes(id));
        // Взрослые (до 2) и дети (до 4) рисуются отдельными группами
        const adults = here.filter(id => !isChildNpc(findNpc(this.registry, id)));
        const kids = here.filter(id => isChildNpc(findNpc(this.registry, id)));
        adults.slice(0, 2).forEach((npcId, i) => {
            this.drawLocationNpc(npcId, spot.x - i * 55, spot.y + i * 12, 2.3, i);
        });
        kids.slice(0, 4).forEach((npcId, i) => {
            this.drawLocationNpc(npcId, spot.x + 40 + (i % 2) * 46, spot.y + 6 + Math.floor(i / 2) * 30, 1.5, i, true);
        });
        // Раунд 31 (п.2): пастухи стоят у стада (выпас или водопой)
        const herd = getHerdState(this.registry);
        if (herd.place === this.locationId) {
            const hs = this.herdShepherdSpots(width, height);
            if (hs) {
                if (hs.s1) this.drawLocationNpc('shepherd1', hs.s1.x, hs.s1.y, 2.2, 1);
                if (hs.s2) this.drawLocationNpc('shepherd2', hs.s2.x, hs.s2.y, 2.1, 2);
            }
        }
    }

    /** Раунд 31 (п.2): где стоят пастухи у стада на этой локации. */
    herdShepherdSpots(width, height) {
        // Раунд 68 (п.5): каждая точка пастуха прогоняется через clamp воды
        const safe = ({ x, y }) => clampOutOfWater(this.locationId, width, height, x, y, 30);
        switch (this.locationId) {
            case 'pasture':
                return { s1: { x: width * 0.42, y: height * 0.56 }, s2: { x: width * 0.66, y: height * 0.68 } };
            case 'river':
                // южный берег, у дороги к мосту — там, где стадо пьёт
                return {
                    s1: safe({ x: width / 2 + 84, y: height * 0.74 }),
                    s2: safe({ x: width / 2 - 96, y: height * 0.70 }),
                };
            case 'lake': {
                const lakeR = Math.min(width, height) / 3.5;
                return {
                    s1: safe({ x: width / 2 + lakeR * 0.75, y: height / 2 + 30 + lakeR * 0.62 }),
                    s2: safe({ x: width / 2 - lakeR * 0.7, y: height / 2 + 30 + lakeR * 0.72 }),
                };
            }
            default:
                return null;
        }
    }

    /** Один NPC на локации: спрайт (LPC), имя, подсказка, клик-диалог */
    drawLocationNpc(npcId, x, y, scale, i = 0, kid = false) {
        // Раунд 68 (п.5): страховочный clamp — фигура не может оказаться в воде
        const safe68 = clampOutOfWater(this.locationId, this.scale.width, this.scale.height, x, y, 26);
        x = safe68.x; y = safe68.y;
        const npcData = findNpc(this.registry, npcId);
        const displayName = npcData ? getNpcDisplayName(this.registry, npcId) : npcId;
        const spriteKey = getNpcSpriteKey(this, this.registry, npcId);
        const spr = this.add.sprite(x, y, this.textures.exists(spriteKey) ? spriteKey : 'npc_elder')
            .setScale(scale).setDepth(50);
        const animKey = `${spr.texture.key}_idle_down`;
        if (this.anims.exists(animKey)) spr.play(animKey);
        // Дети еро́зятся — слегка «прыгают» на месте (а если рядом ещё дети — бегают)
        this.tweens.add({
            targets: spr,
            y: { from: y, to: y - 3 },
            duration: 1600 + i * 240, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        if (kid && this.anims.exists(`${spr.texture.key}_walk_right`)) {
            const rx = 26 + Math.random() * 22;
            this.tweens.add({
                targets: spr,
                x: { from: x, to: x + (i % 2 === 0 ? -rx : rx) },
                duration: 1300 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                onYoyo: () => spr.setFlipX(!spr.flipX),
                onRepeat: () => spr.setFlipX(!spr.flipX),
            });
        }
        this.add.text(x, y + 42, displayName, {
            fontSize: '13px', color: RUS.text,
            backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(50);
        this.add.text(x, y - 46, t('💬 Нажми, чтобы поговорить'), {
            fontSize: '10px', color: '#c9a14a',
            backgroundColor: '#00000088', padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(50);
        spr.setInteractive({ useHandCursor: true });
        spr.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown() && !this.busyDialog) this.talkToLocationNpc(npcId);
        });
    }

    /**
     * РАУНД 66.6 (приказ: «сезонные работы (посев/жатва/сенокос)»):
     * статисты-крестьяне на Поле — состав по фазе года (пахарь/сеятель/
     * косарь+гребенщик/жнец+жница/крестьяне у скирд). LPC-композиты
     * собираются на лету из палитры (виртуальные npc-объекты, детерминизм
     * по id). Клик по работнику — реплика по текущей работе.
     */
    spawnSeasonalWorkers(width, height) {
        const ts66 = getTime(this.registry);
        const phase = fieldPhaseOf(ts66);
        // Зимой на поле никого нет; в залежь выйдут разве что двое у межи
        if (phase === 'snow') return;
        // Имена-роли и персоналии статистов по фазе
        const ROLE = {
            plow:      [{ id: 'fieldhand_a', gender: 'male',   age: 44, name: t('Пахарь') }, { id: 'fieldhand_b', gender: 'male', age: 17, name: t('Пахарный работник') }],
            sowing:    [{ id: 'fieldhand_a', gender: 'male',   age: 44, name: t('Сеятель') }, { id: 'fieldhand_c', gender: 'female', age: 33, name: t('Сеятельница') }],
            haymaking: [{ id: 'fieldhand_a', gender: 'male',   age: 38, name: t('Косарь') }, { id: 'fieldhand_c', gender: 'female', age: 33, name: t('Гребёт сено') }],
            harvest:   [{ id: 'fieldhand_a', gender: 'male',   age: 38, name: t('Жнец') }, { id: 'fieldhand_c', gender: 'female', age: 29, name: t('Жница') }, { id: 'fieldhand_d', gender: 'male', age: 12, name: t('Вяжет снопы') }],
            stubble:   [{ id: 'fieldhand_a', gender: 'male',   age: 44, name: t('Крестьянин') }, { id: 'fieldhand_b', gender: 'male', age: 17, name: t('Отрок') }],
            fallow:    [{ id: 'fieldhand_a', gender: 'male',   age: 44, name: t('Крестьянин') }],
        };
        const roster = ROLE[phase] || null;
        if (!roster) return;
        // Места: внутри жёлтого квадрата поля (см. drawLocationBackground)
        const fieldX = width / 6, fieldY = 120;
        const fieldW = (width * 2) / 3, fieldH = height - 200;
        const SPOTS = [
            { x: fieldX + fieldW * 0.42, y: fieldY + fieldH * 0.55 },
            { x: fieldX + fieldW * 0.62, y: fieldY + fieldH * 0.72 },
            { x: fieldX + fieldW * 0.5,  y: fieldY + fieldH * 0.42 },
        ];
        roster.slice(0, SPOTS.length).forEach((worker, i) => {
            const spot = SPOTS[i];
            const scale = (worker.age || 30) <= 13 ? 1.5 : 2.3;
            // виртуальный npc — LPC-композит детерминирован по id + npcSeed
            const texKey = ensureNpcLpcTexture(this, this.registry, worker)
                || (worker.gender === 'female' ? 'npc_villager_f' : 'npc_elder');
            const spr = this.add.sprite(spot.x, spot.y, this.textures.exists(texKey) ? texKey : 'npc_elder')
                .setScale(scale).setDepth(50);
            const animKey = `${spr.texture.key}_idle_down`;
            if (this.anims.exists(animKey)) spr.play(animKey);
            // лёгкий «трудовой» покачивающийся твин
            this.tweens.add({
                targets: spr,
                angle: { from: -2.2, to: 2.2 },
                duration: 1100 + i * 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this.add.text(spot.x, spot.y + 42, worker.name, {
                fontSize: '13px', color: RUS.text,
                backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(50);
            this.add.text(spot.x, spot.y - 46, t('💬 Нажми, чтобы поговорить'), {
                fontSize: '10px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(50);
            spr.setInteractive({ useHandCursor: true });
            spr.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.busyDialog) {
                    this.busyDialog = true;
                    ActionLog.add(this.registry, tf(t('Игрок разговорился с работником поля: {0}.'), worker.name));
                    createDialog(this, worker.name,
                        seasonalWorkerLine(phase),
                        [{ text: t('Хорошего труда!'), callback: () => { this.busyDialog = false; } }],
                        { singleton: false });
                }
            });
        });
    }

    /**
     * РАУНД 66 (п.2 приказа): КОСТЁР ПАСТУХОВ НА ВЫПАСЕ.
     * Стоянка у стада: сложенные поленья, живое пламя (3 кадра, ADD),
     * тёплый отсвет. Клик по костру — присесть (restAtCampfire: +1 час
     * времени БЕЗ лечения — п.1 того же приказа).
     */
    spawnPastureCampfire(width, height) {
        const cx = Math.round(width * 0.34);
        const cy = Math.round(height * 0.72);   // на переднем плане, рядом с пастухом (0.42w, 0.56h)
        if (this.textures.exists('campfire_base')) {
            const base = this.add.image(cx, cy, 'campfire_base').setScale(2).setDepth(6);
            base.setInteractive({ useHandCursor: true });
            base.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.busyDialog) this.restAtCampfire();
            });
        }
        if (this.textures.exists('campfire_flame_0')) {
            const flame = this.add.image(cx, cy - 12, 'campfire_flame_0')
                .setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(6.1);
            let frame = 0;
            this.time.addEvent({
                delay: 180, loop: true,
                callback: () => {
                    frame = (frame + 1) % 3;
                    if (flame.scene && this.textures.exists(`campfire_flame_${frame}`)) {
                        flame.setTexture(`campfire_flame_${frame}`);
                    }
                },
            });
        }
        // Тёплый отсвет на траве
        const glow = this.add.ellipse(cx, cy + 10, 96, 34, 0xff7a30, 0.22)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(5.9);
        this.tweens.add({
            targets: glow, alpha: { from: 0.16, to: 0.3 },
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Подсказка
        const hint = this.add.text(cx, cy - 52, t('🔥 Костёр пастухов — присесть (1 час)'), {
            fontSize: '12px', color: '#E8DCC4', backgroundColor: '#00000088',
            padding: { x: 6, y: 3 }, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(6.2);
        this.tweens.add({ targets: hint, alpha: { from: 1, to: 0.55 }, duration: 1200, yoyo: true, repeat: -1 });
    }

    /**
     * РАУНД 66 (пп.1,2 приказа): отдых у костра (Выпас) — ТОЛЬКО промотка
     * времени на 1 игровой час. Здоровье и Воля у костра НЕ восстанавливаются
     * (полное лечение — ночлег на постоялом дворе и молебен в церкви).
     */
    restAtCampfire() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        createDialog(this, t('🔥 Костёр пастухов'),
            t('Пастухи сложили костёр у стада. У огня можно только пересидеть час — раны он не лечит, только время идёт мимо.\n\nПересидеть час у костра? (1 час — время +1 час, без лечения.)'),
            [
                { text: t('Присесть у огня (1 час)'), callback: () => {
                    close();
                    this.cameras.main.fadeOut(600, 0, 0, 0);
                    this.time.delayedCall(650, () => {
                        tickTime(this.registry, 60);
                        ActionLog.add(this.registry, t('Пересидел час у костра на выпасе — время шло мимо.'));
                        this.cameras.main.fadeIn(600, 0, 0, 0);
                    });
                } },
                { text: t('Не сейчас'), callback: close },
            ]);
    }

    /** Разговор с жителем на локации (раунд 27; раунд 30: + расспрос о воре) */
    talkToLocationNpc(npcId) {
        this.busyDialog = true;
        const npcData = findNpc(this.registry, npcId);
        const displayName = npcData ? getNpcDisplayName(this.registry, npcId) : npcId;
        // Раунд 34: и на локации полное дерево говорит «своим» портретом
        const pvKey = npcPortraitVariantKey(npcData);
        this.activeNpc = {
            id: npcId,
            name: displayName,
            portrait: (pvKey && this.textures.exists(pvKey)) ? pvKey
                : (npcData && npcData.portrait) || 'portrait_villager_f',
        };
        const dialogueId = NPC_DIALOGUE[npcId];
        if (dialogueId) {
            this.dialogue.run(dialogueId, () => { this.busyDialog = false; });
            return;
        }

        // Раунд 30 (пп.7,9): расспрос о воре доступен и на локациях —
        // но каждый НПЦ выдаёт подсказку ЕДИНожды (строчка не повторяется)
        const q = this.registry.get('quest') || {};
        const chaseActive = isChaseActive(this.registry);
        const alreadyAsked = (q.thiefAskedFrom || []).includes(npcId);
        const canAsk = chaseActive && !alreadyAsked;

        const closeCb = () => { this.busyDialog = false; };
        // Раунд 58 (п.1): разговор с НПЦ — 10 минут (было 1 час, раунд 31).
        // Поп-ап ответа о воре — та же беседа, второй раз время не списываем
        const talkOpts = {
            singleton: true,
            portraitKey: (npcData && npcData.portrait) || 'portrait_villager_f',
            talkMinutes: TALK_MINUTES,
            talkKey: npcId + '@' + Math.floor(Date.now() / 90000),
        };
        const choices = canAsk
            ? [
                {
                    text: t('Расспросить о воре'),
                    callback: (parentDlg) => {
                        const r = askNPC(this.registry, npcId, displayName);
                        // Раунд 31-фикс: поп-ап ответа — ОТДЕЛЬНОЕ окно (не singleton
                        // с тем же ключом, что приветствие — иначе ответ не виден),
                        // приветствие закрываем: ответ — продолжение той же беседы
                        createDialog(this, displayName, r.message, [
                            { text: t('Продолжить'), callback: closeCb },
                        ], { singleton: false, portraitKey: (npcData && npcData.portrait) || 'portrait_villager_f' });
                        if (parentDlg && parentDlg.closeDialog) parentDlg.closeDialog();
                    },
                },
                { text: t('Продолжить'), callback: closeCb },
            ]
            : [{ text: t('Продолжить'), callback: closeCb }];

        const line = pickOutdoorLine(this.registry, npcId, t('Занят(а) своим делом. Заходи в другой раз.'));
        createDialog(this, displayName, line, choices, talkOpts);
    }

    update() {
        // Раунд 21: побег вора закрывает поход (пока открыт диалог — ждём)
        if (this.busyDialog) return;
        const endState = checkGameEnd(this.registry);
        if (endState) this.scene.start('End');
    }

    // ============================================================
    // РАУНД 30 (пп.3–6): ВИДИМЫЕ СЛЕДЫ ВОРА
    // ============================================================

    /**
     * Нарисовать следы на локации (раунд 31, пп.8–9): каждый след — КОРОТКАЯ
     * ЦЕПОЧКА ИЗ 6 ЧЁРНЫХ отпечатков, вытянутая ВДОЛЬ ДОРОГИ. След — отдельный
     * интерактивный объект: проверяется ТОЛЬКО ЕДИНожды; после неудачи
     * пропадает, после удачи светится (золотое сияние) и даёт подсказку с
     * названием локации, где вор находится сейчас. Затёртые следы не рисуются.
     */
    drawFootprints(footprints, traceSide, width, height) {
        footprints.forEach((fp, idx) => {
            if (fp.state === 'gone') return; // п.5: неудачная проверка — след пропал
            const pos = this.footprintPosition(this.locationId, idx, traceSide, width, height);
            if (!pos) return;
            this.drawFootprintChain(fp, pos.x, pos.y, traceSide, width, height);
        });
    }

    /**
     * Раунд 31 (п.8): направление цепочки следов — вдоль дороги локации.
     * На Реке дорога идёт вертикально (север → мост → юг): цепочка тянется
     * вдоль неё; до моста — к мосту (юг), за мостом — тоже вдоль дороги.
     */
    footprintChainDir(locId, traceSide) {
        switch (locId) {
            case 'river':
                // до моста цепочка идёт ЮЖЕ (к мосту), за мостом — СЕВЕРЕ (к мосту),
                // чтобы цепочка осталась на дороге в дальней части локации
                return (traceSide === 'after') ? { x: 0, y: -1 } : { x: 0, y: 1 };
            case 'road_south':
            case 'mill':
                return { x: 1, y: 0 };      // гравийный тракт / дорога к мельнице
            case 'field':
                return { x: 0.8, y: 0.6 };
            default:
                return { x: 0.7, y: 0.7 };
        }
    }

    /**
     * Один след = цепочка из 6 чёрных отпечатков (п.9): шаг ~14px,
     * лево/право чередуются, как при ходьбе. Найденный — светится золотом.
     */
    drawFootprintChain(fp, ax, ay, traceSide, width, height) {
        const found = fp.state === 'found';
        const cont = this.add.container(ax, ay).setDepth(45);
        const dir = this.footprintChainDir(this.locationId, traceSide);
        const step = 14;    // расстояние между отпечатками вдоль цепочки
        const lat = 6;      // чередование лево/право (шаг человека)
        const baseAngle = Math.atan2(dir.y, dir.x) * 180 / Math.PI + 90;
        const perp = { x: -dir.y, y: dir.x };
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const side = (i % 2 === 0) ? -1 : 1;
            let px = perp.x * side * lat + dir.x * step * i;
            let py = perp.y * side * lat + dir.y * step * i;
            // не выходим за пределы игрового поля
            px = Phaser.Math.Clamp(ax + px, 40, width - 40) - ax;
            py = Phaser.Math.Clamp(ay + py, 110, height - 60) - ay;
            pts.push({ x: px, y: py, angle: baseAngle + (side < 0 ? -14 : 14) });
        }
        // центр цепочки — для сияния, подписи и зоны клика
        const cx = (pts[0].x + pts[5].x) / 2;
        const cy = (pts[0].y + pts[5].y) / 2;

        if (found) {
            // П.6: удачная проверка — след «СВЕТИТСЯ» (пульсирующее золотое сияние)
            const halo = this.add.ellipse(cx, cy, 120, 44, 0xffe08a, 0.35)
                .setBlendMode(Phaser.BlendModes.ADD);
            cont.add(halo);
            this.tweens.add({
                targets: halo,
                alpha: { from: 0.22, to: 0.5 },
                scale: { from: 0.9, to: 1.18 },
                duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }

        if (this.textures.exists('deco_footprint')) {
            pts.forEach((p) => {
                const img = this.add.image(p.x, p.y, 'deco_footprint')
                    .setScale(1.9).setAngle(p.angle);
                // П.9: отпечатки ЧЁРНЫЕ; найденный след — золотой
                img.setTint(found ? 0xffd76a : 0x161616);
                cont.add(img);
            });
        } else {
            // Запасной вариант — графика: 6 чёрных отпечатков
            const g = this.add.graphics();
            pts.forEach((p) => {
                g.fillStyle(found ? 0x6a5528 : 0x161616, 0.92);
                g.fillEllipse(p.x, p.y, 7, 13);
                if (found) {
                    g.lineStyle(1.4, 0xffd76a, 0.95);
                    g.strokeEllipse(p.x, p.y, 8, 14);
                }
            });
            cont.add(g);
        }

        // Подпись следа — над центром цепочки
        cont.add(this.add.text(cx, cy - 24, found ? t('✨ след прочитан') : t('🔍 след вора'), {
            fontSize: '10px', color: found ? '#ffd76a' : '#e8d8a8',
            fontFamily: 'Georgia, serif',
            backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
        }).setOrigin(0.5));

        // Клик — отдельная проверка этого следа (зона покрывает всю цепочку)
        const minX = Math.min(...pts.map(p => p.x)) - 16;
        const minY = Math.min(...pts.map(p => p.y)) - 16;
        const maxX = Math.max(...pts.map(p => p.x)) + 16;
        const maxY = Math.max(...pts.map(p => p.y)) + 16;
        cont.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
        });
        cont.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown() && !this.busyDialog) this.onFootprintClick(fp.id);
        });
    }

    /**
     * Детерминированная позиция следа (хэш строки — при перерисовке сцены
     * следы стоят на тех же местах, «прыганья» нет).
     * П.3: на РЕКЕ следы стоят или ПЕРЕД мостом, или ЗА мостом (сторона
     * выбирается один раз на след в данных погони), в ДАЛЬНЕЙ части локации.
     */
    footprintPosition(locId, idx, traceSide, width, height) {
        const hash = (s) => {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
            return (h >>> 0);
        };
        const h1 = hash(`${locId}:fp${idx}`);
        const jig = (range) => (h1 % (range * 2)) - range;   // ±range
        const bridgeX = width / 2;

        switch (locId) {
            case 'river': {
                // П.3: ДО моста (север, дальний верх) или ЗА мостом (юг, дальний низ),
                // на дороге к мосту; цепочка следов тянется вдоль дороги
                // (раунд 68: clamp страхует — дорога/мост вне воды по построению)
                const before = traceSide ? traceSide === 'before' : (h1 % 2 === 0);
                const x = bridgeX + jig(16);
                const y = before
                    ? 120 + (h1 % 46) + idx * 34            // перед мостом — дальняя часть у верха
                    : height - 190 + (h1 % 46) + idx * 34;  // за мостом — дальняя часть у низа
                const raw68 = { x, y: Phaser.Math.Clamp(y, 110, height - 70) };
                const safe68 = clampOutOfWater('river', width, height, raw68.x, raw68.y, 12);
                return { x: safe68.x, y: safe68.y };
            }
            case 'forest':
                // Чаща: среди деревьев верхней (дальней) трети
                return { x: 70 + (h1 % Math.max(80, width - 140)), y: 130 + ((h1 >> 5) % Math.max(40, height * 0.28)) + idx * 26 };
            case 'forest_edge':
                // Опушка: у кромки деревьев (верх локации)
                return { x: 70 + (h1 % Math.max(80, width - 140)), y: 125 + ((h1 >> 5) % Math.max(30, height * 0.22)) + idx * 26 };
            case 'forest_glade':
                // Поляна: поперёк травяного круга
                return { x: width * 0.28 + (h1 % Math.max(60, width * 0.44)), y: height * 0.4 + ((h1 >> 5) % Math.max(30, height * 0.22)) + idx * 26 };
            case 'field':
                // Поле: в высокой ржи (центральные 2/3)
                return { x: width / 6 + (h1 % Math.max(60, (width * 2) / 3)), y: 150 + ((h1 >> 5) % Math.max(40, height - 300)) + idx * 22 };
            case 'lake': {
                // Озеро: дальний берег (раунд 68: clamp — след не в воде;
                // у центра озера прежняя формула опускалась в круг воды)
                const raw68 = { x: 80 + (h1 % Math.max(80, width - 160)), y: height / 2 - Math.min(width, height) / 3.5 - 20 + ((h1 >> 5) % 40) + idx * 20 };
                const safe68 = clampOutOfWater('lake', width, height, raw68.x, raw68.y, 24);
                return { x: safe68.x, y: safe68.y };
            }
            case 'road_south':
                // Тракт: на гравийной ленте
                return { x: 60 + (h1 % Math.max(80, width - 120)), y: height * 0.5 + jig(30) + idx * 6 };
            case 'pogost':
                // Погост: между рядами могил (дальняя половина)
                return { x: 70 + (h1 % Math.max(80, width - 140)), y: height * 0.42 + ((h1 >> 5) % Math.max(30, height * 0.3)) + idx * 22 };
            case 'mill':
                // Мельница: вдоль дороги к мельнице (дальняя часть)
                return { x: 70 + (h1 % Math.max(80, width - 140)), y: height * 0.5 + 60 + ((h1 >> 5) % 40) + idx * 22 };
            case 'pasture':
                // Выпас: в сочной траве (дальний край луга)
                return { x: 70 + (h1 % Math.max(80, width - 140)), y: 130 + ((h1 >> 5) % Math.max(40, height * 0.3)) + idx * 26 };
            default:
                return { x: width * 0.3 + (h1 % Math.max(60, width * 0.4)), y: height * 0.35 + ((h1 >> 5) % 80) + idx * 24 };
        }
    }

    /**
     * Клик по следу (раунд 30, пп.4–6): проверка отдельная на каждый след,
     * только единожды. Удача — след светится + поп-ап «где вор сейчас»;
     * неудача — след пропадает.
     */
    onFootprintClick(fpId) {
        this.busyDialog = true;
        const res = examineFootprint(this.registry, this.locationId, fpId);
        // Раунд 66.12 (приказ владельца №6): отсчёт до побега вора скрыт из UI
        if (res.thiefEscaped) {
            createDialog(this, t('🏃 Вор скрылся!'), res.message, [
                { text: t('Итоги похода'), callback: () => this.scene.start('End') },
            ], { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
            return;
        }
        // Раунд 60 (QA-фикс): заголовок ЧЕСТНО различает первую неудачу
        // (след остался — можно присмотреться ещё раз) и вторую (затёрт).
        // Раньше обе показывались как «След затёрт» — игрок думал, что
        // вторая попытка недоступна (раунд 59, п.1).
        const title = res.found
            ? t('✨ След прочитан!')
            : res.retryLeft
                ? t('🔍 След не поддался')
                : (res.alreadyChecked ? t('🔍 След') : t('🔍 След затёрт'));
        createDialog(this, title, res.message, [
            {
                text: t('Продолжить'),
                callback: () => {
                    this.busyDialog = false;
                    // Перерисовать: найденный след засветился, затёртый — исчез
                    this.scene.restart({ locationId: this.locationId, from: this.from });
                },
            },
        ], { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
    }

    /**
     * Нарисовать фон локации в зависимости от типа.
     * П.5-16: Полностью переработанные локации.
     */
    drawLocationBackground(locId, width, height) {
        const gfx = this.add.graphics();

        if (locId === 'forest') {
            // Лес — тёмный зелёный фон + много деревьев
            gfx.fillStyle(0x1a3a1a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Травянистый узор
            gfx.fillStyle(0x2a5a2a, 0.5);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 4, 4);
            }
            // Раунд 27: деревья — ПРОЗРАЧНЫЕ спрайты (без квадратного фона),
            // с взаимной коллизией (п.2) — не наслаиваются друг на друга
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 58) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 20; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 110 + Math.random() * (height - 170);
                    if (!hasTreeCollision(x, y, 58)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.5).setOrigin(0.5, 0.88).setDepth(2 + (y % 7) * 0.1);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        } else if (locId === 'forest_edge') {
            // РАУНД 30 (п.1): ОПУШКА ЛЕСА — светлая трава, деревья только у
            // верхнего края (лес «нависает» с дальнего плана), кусты и грибы
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Светлая трава
            gfx.fillStyle(0x5f9448, 0.55);
            for (let i = 0; i < 70; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 4);
            }
            // Травяные пласты и кочки (живая земля)
            for (let i = 0; i < 18; i++) {
                this.add.image(Math.random() * width, 110 + Math.random() * (height - 150),
                    `tile_grass_${i % 4}`).setScale(1.5).setAlpha(0.4).setDepth(0.5);
            }
            const tuftOkE = this.textures.exists('deco_grass_tuft');
            for (let i = 0; i < 22; i++) {
                this.add.image(Math.random() * width, 110 + Math.random() * (height - 150),
                    tuftOkE ? 'deco_grass_tuft' : 'tile_grass_0').setScale(1.4).setDepth(1);
            }
            // Ягодные кусты и грибы по опушке
            const bushOkE = this.textures.exists('deco_berry_bush');
            for (let i = 0; i < 9; i++) {
                const x = Math.random() * width;
                const y = height * 0.55 + Math.random() * (height * 0.35);
                this.add.image(x, y, bushOkE ? 'deco_berry_bush' : 'tile_forest_0')
                    .setScale(1.7).setOrigin(0.5, 0.8).setDepth(3);
            }
            // Лес нависает с дальнего плана: плотная стена деревьев вверху
            const placedEdgeTrees = [];
            for (let i = 0; i < 14; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height * 0.3);
                    const clash = placedEdgeTrees.some(p => Math.abs(p.x - x) < 54 && Math.abs(p.y - y) < 54);
                    if (!clash) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.6).setOrigin(0.5, 0.88).setDepth(3);
                        placedEdgeTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Одиночные деревья-стражи по бокам опушки
            for (let i = 0; i < 3; i++) {
                const x = (i === 1) ? width * 0.5 + Phaser.Math.Between(-40, 40) : (i === 0 ? 70 : width - 70);
                const y = height * 0.52 + Math.random() * 60;
                const tex = TREE_KEYS[(i + 2) % TREE_KEYS.length];
                this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                    .setScale(1.4).setOrigin(0.5, 0.88).setDepth(3.5);
            }
            // Птицы на опушке (живность, не монстры)
            if (this.textures.exists('deco_bird')) {
                for (let i = 0; i < 2; i++) {
                    const bx = width * 0.3 + i * width * 0.4;
                    const by = height * 0.6 + Math.random() * 60;
                    const bird = this.add.image(bx, by, 'deco_bird').setScale(2).setDepth(4).setFlipX(i % 2 === 0);
                    this.tweens.add({
                        targets: bird,
                        scaleY: { from: 2, to: 1.5 },
                        duration: 260 + i * 110, yoyo: true, repeat: -1, ease: 'Quad.easeOut',
                    });
                }
            }
        } else if (locId === 'forest_glade') {
            // РАУНД 30 (п.1): ЛЕСНАЯ ПОЛЯНА — солнечный круг травы среди леса,
            // деревья кольцом по краю, много цветов и ягодных кустов
            gfx.fillStyle(0x55863c, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Солнечное пятно в центре поляны
            gfx.fillStyle(0x6a9a48, 0.5);
            gfx.fillCircle(width / 2, height * 0.52, Math.min(width, height) * 0.28);
            gfx.setDepth(0.5);
            // Кочки и трава
            for (let i = 0; i < 20; i++) {
                this.add.image(Math.random() * width, 110 + Math.random() * (height - 150),
                    `tile_grass_${i % 4}`).setScale(1.5).setAlpha(0.45).setDepth(0.5);
            }
            const tuftOkG = this.textures.exists('deco_grass_tuft');
            for (let i = 0; i < 18; i++) {
                this.add.image(Math.random() * width, 110 + Math.random() * (height - 150),
                    tuftOkG ? 'deco_grass_tuft' : 'tile_grass_0').setScale(1.5).setDepth(1);
            }
            // МНОГО ЦВЕТОВ на поляне (по сезону: зимой — снег вместо цветов)
            const tsGlade = getTime(this.registry);
            const seasonGlade = getSeason(tsGlade ? tsGlade.month : 5);
            if (seasonGlade !== 'winter' && this.textures.exists('deco_flower_0')) {
                for (let i = 0; i < 30; i++) {
                    const fl = `deco_flower_${i % 3}`;
                    const x = Math.random() * width;
                    const y = 130 + Math.random() * (height - 190);
                    const flower = this.add.image(x, y, fl).setScale(1.6).setDepth(1.3);
                    // Цветы слегка качаются
                    this.tweens.add({
                        targets: flower,
                        angle: { from: -5, to: 5 },
                        duration: 1800 + Math.random() * 1600,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                        delay: Math.random() * 1200,
                    });
                }
            }
            // Ягодные кусты в кольце
            const bushOkG = this.textures.exists('deco_berry_bush');
            for (let i = 0; i < 7; i++) {
                const angle = (i / 7) * Math.PI * 2 + 0.3;
                const r = Math.min(width, height) * 0.3;
                const x = width / 2 + Math.cos(angle) * r;
                const y = height * 0.52 + Math.sin(angle) * r * 0.7;
                this.add.image(x, y, bushOkG ? 'deco_berry_bush' : 'tile_forest_0')
                    .setScale(1.8).setOrigin(0.5, 0.8).setDepth(3);
            }
            // Бревно в центре поляны (привал грибников)
            const logG = this.add.graphics();
            logG.fillStyle(0x5a4028, 1);
            logG.fillRoundedRect(width * 0.44, height * 0.62, 130, 22, 10);
            logG.fillStyle(0x6f5233, 1);
            logG.fillRoundedRect(width * 0.44, height * 0.62, 130, 8, 4);
            logG.fillStyle(0x8a6a44, 1);
            logG.fillCircle(width * 0.44 + 6, height * 0.62 + 11, 10);
            logG.fillCircle(width * 0.44 + 124, height * 0.62 + 11, 10);
            logG.setDepth(3.5);
            // Деревья КОЛЬЦОМ вокруг поляны (лес окружает просвет)
            const placedGladeTrees = [];
            for (let i = 0; i < 16; i++) {
                let attempts = 0;
                while (attempts < 12) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 140);
                    // Не в центре поляны (просвет) и без наложения
                    const inClearing = Math.abs(x - width / 2) < width * 0.22 && Math.abs(y - height * 0.52) < height * 0.2;
                    const clash = placedGladeTrees.some(p => Math.abs(p.x - x) < 56 && Math.abs(p.y - y) < 56);
                    if (!inClearing && !clash) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.65).setOrigin(0.5, 0.88).setDepth(4);
                        placedGladeTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Бабочки над цветами (живность, не монстры)
            if (seasonGlade !== 'winter' && this.textures.exists('particle_spark')) {
                for (let i = 0; i < 4; i++) {
                    const fx = width * 0.3 + Math.random() * width * 0.4;
                    const fy = height * 0.4 + Math.random() * height * 0.3;
                    const b = this.add.image(fx, fy, 'particle_spark')
                        .setScale(0.35).setTint(0xf2e8b8).setDepth(7);
                    this.tweens.add({
                        targets: b,
                        x: fx + Phaser.Math.Between(-40, 40),
                        y: fy + Phaser.Math.Between(-24, 24),
                        duration: 2600 + Math.random() * 2000,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                    this.tweens.add({
                        targets: b,
                        alpha: { from: 0.35, to: 0.85 },
                        duration: 500, yoyo: true, repeat: -1,
                    });
                }
            }
        } else if (locId === 'road' || locId === 'road_south') {
            // П.15: Тракт — трава по бокам, гравийная дорога горизонтально
            // С коллизиями: дорога рисуется ПЕРВЫМ слоем, деревья и камни — поверх,
            // но их позиции проверяются, чтобы не пересекаться с дорогой.
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура травы
            gfx.fillStyle(0x5a8c4a, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 3);
            }
            // ----- Раунд 28 (п.7): ГРАВИЙНАЯ ДОРОГА — настоящие тайлы вместо
            // плоской полосы: гравий двух видов (с колеями) + кромки с травой,
            // камешки и разметанные следы обоза — тракт больше не «жёлтая полоса»
            const roadY = height * 0.5;
            const roadH = 100;
            const roadTop = roadY - roadH / 2;
            const roadBottom = roadY + roadH / 2;
            const hasGravel = this.textures.exists('tile_gravel_0');
            if (hasGravel) {
                const step = 58;
                for (let gx = 0; gx < width + step; gx += step) {
                    const v = (Math.round(gx / step) % 3 === 0) && this.textures.exists('tile_gravel_1')
                        ? 'tile_gravel_1' : 'tile_gravel_0';
                    this.add.image(gx, roadY, v)
                        .setDisplaySize(step + 6, roadH + 6)
                        .setDepth(1.1);
                }
                // Кромки с травой (переход газон → гравий) сверху и снизу
                if (this.textures.exists('tile_gravel_edge')) {
                    for (let gx = 0; gx < width + 60; gx += 60) {
                        this.add.image(gx, roadTop + 3, 'tile_gravel_edge')
                            .setDisplaySize(64, 22).setDepth(1.15);
                        this.add.image(gx, roadBottom - 3, 'tile_gravel_edge')
                            .setDisplaySize(64, 22).setFlipY(true).setDepth(1.15);
                    }
                }
            } else {
                gfx.fillStyle(0x9a8060, 1);
                gfx.fillRect(0, roadTop, width, roadH);
                gfx.setDepth(1);
            }
            // Камешки и колеи ПОВЕРХ гравия — ОТДЕЛЬНЫЙ graphics (не поднимаем
            // общий фон gfx, иначе он закроет тайлы гравия!)
            const roadGfx = this.add.graphics();
            roadGfx.fillStyle(0x6a5c4a, 0.5);
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * width;
                const y = roadTop + 10 + Math.random() * (roadH - 20);
                roadGfx.fillCircle(x, y, 1.6);
            }
            roadGfx.fillStyle(0x74654e, 0.4);
            for (let i = 0; i < 6; i++) {
                roadGfx.fillRect(0, roadTop + 20 + (i % 2) * 40, width, 4);
            }
            roadGfx.setDepth(1.2);
            // П.15: Камни на дороге — только ВНЕ дороги (на траве), чтобы не перекрывать
            const placedPositions = [];
            const isOnRoad = (y) => y > roadTop - 20 && y < roadBottom + 20;
            const hasCollision = (x, y, minDist = 40) => {
                return placedPositions.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 15; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    // Не на дороге и нет коллизии
                    if (!isOnRoad(y) && !hasCollision(x, y, 50)) {
                        this.add.image(x, y, `tile_rock_${i % 2}`).setScale(1.5).setDepth(2);
                        placedPositions.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // П.15: Деревья по бокам дороги — с проверкой коллизий.
            // Раунд 27: прозрачные спрайты вместо квадратных тайлов.
            for (let i = 0; i < 12; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 6) ? Math.random() * 180 : width - Math.random() * 180;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnRoad(y) && !hasCollision(x, y, 60)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.6).setOrigin(0.5, 0.88).setDepth(3);
                        placedPositions.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Тропинки травы у дороги — только выше дороги.
            // Раунд 28: прозрачные кочки deco_grass_tuft вместо квадратных
            // тайлов tile_grass_0 с фоном (продолжение п.1 раунда 27)
            const tuftOk = this.textures.exists('deco_grass_tuft');
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * width;
                const y = roadTop - 10 - Math.random() * 20;
                this.add.image(x, y, tuftOk ? 'deco_grass_tuft' : 'tile_grass_0')
                    .setScale(1.6).setDepth(1.25);
            }
        } else if (locId === 'river') {
            // П.10: Река — голубая полоса посередине, мост, заросли, дорога к мосту
            // Фон — трава по обоим берегам
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Берега (песчаные кромки) вдоль реки
            const riverY = height * 0.45;
            const riverH = 120;
            gfx.fillStyle(0x8a7a5a, 1);
            gfx.fillRect(0, riverY - 6, width, 6);
            gfx.fillRect(0, riverY + riverH, width, 6);
            // Река — голубая горизонтальная полоса через весь экран (середина)
            gfx.fillStyle(0x2e5a78, 1);
            gfx.fillRect(0, riverY, width, riverH);
            gfx.setDepth(1);

            // ----- Раунд 27 (п.3): НАСТОЯЩИЕ ТАЙЛЫ ВОДЫ на реке -----
            // Раньше вода была плоской заливкой — «река без воды». Теперь
            // анимированные тайлы tile_water_0..2 (как пруд в деревне).
            this.riverWaterTiles = [];
            for (let wy = riverY + 16; wy < riverY + riverH - 8; wy += 34) {
                for (let wx = 26; wx < width; wx += 62) {
                    const img = this.add.image(wx, wy, 'tile_water_0')
                        .setScale(1.25).setDepth(1.4).setAlpha(0.8);
                    this.riverWaterTiles.push(img);
                }
            }
            this.riverWaterFrame = 0;
            this.time.addEvent({
                delay: 320,
                loop: true,
                callback: () => {
                    this.riverWaterFrame = (this.riverWaterFrame + 1) % 3;
                    this.riverWaterTiles.forEach(w => w.setTexture(`tile_water_${this.riverWaterFrame}`));
                },
            });

            // ----- Раунд 28 (п.6): ТЕЧЕНИЕ РЕКИ СЛЕВА НАПРАВО -----
            // Штрихи течения и пена плывут вдоль всей ленты реки (под мостом —
            // глубина штрихов ниже настила моста, вода уходит «под него»).
            if (this.textures.exists('river_streak')) {
                for (let i = 0; i < 14; i++) {
                    const streak = this.add.image(-60 - Math.random() * 260, riverY + 16 + Math.random() * (riverH - 30), 'river_streak')
                        .setScale(1 + Math.random() * 1.7)
                        .setAlpha(0.3 + Math.random() * 0.35)
                        .setDepth(1.6);
                    const dur = 5500 + Math.random() * 5500;
                    this.tweens.add({
                        targets: streak,
                        x: width + 80,
                        duration: dur,
                        repeat: -1,
                        delay: Math.random() * dur,
                        ease: 'Linear',
                        onRepeat: () => {
                            streak.y = riverY + 16 + Math.random() * (riverH - 30);
                            streak.setScale(1 + Math.random() * 1.7);
                            streak.setAlpha(0.3 + Math.random() * 0.35);
                        },
                    });
                }
            }
            // Блики течения
            gfx.fillStyle(0x6a9bbc, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = riverY + Math.random() * riverH;
                gfx.fillRect(x, y, 10, 2);
            }

            // П.10.3: Густые заросли по берегам реки (раунд 27: прозрачные камыши
            // deco_reed и кусты deco_berry_bush вместо квадратных тайлов с фоном)
            const reedOk = this.textures.exists('deco_reed');
            const bushOk = this.textures.exists('deco_berry_bush');
            // Верхний берег
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * width;
                const y = riverY - 10 - Math.random() * 30;
                const useBush = (i % 4 === 0) && bushOk;
                const key = useBush ? 'deco_berry_bush' : (reedOk ? 'deco_reed' : 'tile_forest_0');
                this.add.image(x, y, key).setScale(useBush ? 1.6 : 1.9)
                    .setOrigin(0.5, 1).setDepth(2);
            }
            // Нижний берег
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * width;
                const y = riverY + riverH + 10 + Math.random() * 30;
                const useBush = (i % 4 === 1) && bushOk;
                const key = useBush ? 'deco_berry_bush' : (reedOk ? 'deco_reed' : 'tile_forest_0');
                this.add.image(x, y, key).setScale(useBush ? 1.6 : 1.9)
                    .setOrigin(0.5, 0).setDepth(2);
            }
            // П.10.4: Деревянный мост посередине реки (вертикальный)
            const bridgeX = width / 2;
            const bridgeW = 80;
            // Настил моста
            gfx.fillStyle(0x6a4a2a, 1);
            gfx.fillRect(bridgeX - bridgeW / 2, riverY - 10, bridgeW, riverH + 20);
            gfx.setDepth(3);
            // Доски моста (горизонтальные линии)
            gfx.fillStyle(0x4a3a1a, 1);
            for (let y = riverY; y < riverY + riverH; y += 12) {
                gfx.fillRect(bridgeX - bridgeW / 2, y, bridgeW, 2);
            }
            // Перила моста
            gfx.fillStyle(0x5a3a1a, 1);
            gfx.fillRect(bridgeX - bridgeW / 2 - 4, riverY - 15, 4, riverH + 20);
            gfx.fillRect(bridgeX + bridgeW / 2, riverY - 15, 4, riverH + 20);
            // ----- Раунд 27 (п.2 ФИКС): дорога шла ВДОЛЬ реки прямо ПО ВОДЕ и
            // «съедала» всю воду. Теперь дорога идёт ВЕРТИКАЛЬНО: с севера к
            // мосту и от моста на юг — вода на всей ленте реки видна.
            const roadW = 64;
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(bridgeX - roadW / 2, 80, roadW, riverY - 80);            // север → мост
            gfx.fillRect(bridgeX - roadW / 2, riverY + riverH, roadW, height - riverY - riverH - 50); // мост → юг
            gfx.setDepth(2);
            // Камешки на дороге
            gfx.fillStyle(0x8a7a4a, 0.6);
            for (let i = 0; i < 30; i++) {
                gfx.fillCircle(bridgeX - roadW / 2 + 6 + Math.random() * (roadW - 12), 90 + Math.random() * (height - 140), 1.8);
            }
            // П.10.5: Деревья разбросаны по всей локации, кроме воды, дороги и моста
            const placedTrees = [];
            const isOnRiver = (y) => y > riverY - 26 && y < riverY + riverH + 26;
            const isOnBridgeRoad = (x, y) => Math.abs(x - bridgeX) < roadW / 2 + 26;
            const hasTreeCollision = (x, y, minDist = 52) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 18; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 110 + Math.random() * (height - 170);
                    if (!isOnRiver(y) && !isOnBridgeRoad(x) && !hasTreeCollision(x, y, 52)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.6).setOrigin(0.5, 0.88).setDepth(4);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Раунд 31 (п.2): утром и вечером пастухи приводят стадо на водопой —
            // коровы и лошадь стоят у южного берега, при дороге к мосту, и пьют
            // (раунд 68: берег bankY уже вне полосы воды — clamp для однообразия)
            const herdR = getHerdState(this.registry);
            if (herdR.place === 'river') {
                const bankY = riverY + riverH + 24;
                const herdAnimals = [
                    { key: 'deco_cow', dx: -150 }, { key: 'deco_cow', dx: -84 },
                    { key: 'deco_cow', dx: 118 }, { key: 'deco_horse', dx: 176 },
                ];
                herdAnimals.forEach((a, i) => {
                    if (!this.textures.exists(a.key)) return;
                    const ay0 = bankY + (i % 2) * 18;
                    const safe68 = clampOutOfWater('river', width, height, bridgeX + a.dx, ay0, 18);
                    const ax = safe68.x, ay = safe68.y;
                    const animal = this.add.image(ax, ay, a.key)
                        .setScale(2).setDepth(3).setFlipX(i % 2 === 1);
                    this.tweens.add({
                        targets: animal, y: ay - 2,
                        duration: 1900 + i * 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                });
            }
        } else if (locId === 'field') {
            // П.14 + РАУНД 66.6: поле меняет ВИД по сезону — пахота/посев/
            // сенокос/жатва/жнивьё/залежь/снег (календарь: месяц 0 = сентябрь).
            const ts66 = getTime(this.registry);
            const phase66 = fieldPhaseOf(ts66);
            // Фон — обычная зелёная трава
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            const fieldX = width / 6;
            const fieldY = 120;
            const fieldW = (width * 2) / 3;
            const fieldH = height - 200;
            gfx.setDepth(1);
            const fillField = (color, alpha = 1) => {
                gfx.fillStyle(color, alpha);
                gfx.fillRect(fieldX, fieldY, fieldW, fieldH);
            };
            switch (phase66) {
                case 'plow':
                    // ПАХОТА: тёмная пашня, свежие борозды на всю ширину
                    fillField(0x5a4632);
                    for (let i = 0; i < 10; i++) {
                        const y = fieldY + (i + 0.5) * (fieldH / 10);
                        gfx.fillStyle(0x453424, 0.9);
                        gfx.fillRect(fieldX + 6, y - 3, fieldW - 12, 6);
                        gfx.fillStyle(0x6b5238, 0.65);
                        gfx.fillRect(fieldX + 6, y + 4, fieldW - 12, 3);
                    }
                    // редкие камешки
                    gfx.fillStyle(0x8a8070, 0.8);
                    for (let i = 0; i < 14; i++) {
                        gfx.fillRect(fieldX + 10 + Math.random() * (fieldW - 20),
                            fieldY + 10 + Math.random() * (fieldH - 20), 4, 3);
                    }
                    break;
                case 'sowing':
                    // ПОСЕВ: пашня со всходами — борозды + зелёные ростки
                    fillField(0x54422e);
                    for (let i = 0; i < 10; i++) {
                        const y = fieldY + (i + 0.5) * (fieldH / 10);
                        gfx.fillStyle(0x43321f, 0.8);
                        gfx.fillRect(fieldX + 6, y - 3, fieldW - 12, 6);
                        gfx.fillStyle(0x7ab04a, 0.95);
                        for (let k = 0; k < fieldW / 26; k++) {
                            const x = fieldX + 10 + k * 26 + (i % 2) * 12;
                            gfx.fillRect(x, y - 8, 2, 8);
                            gfx.fillRect(x - 2, y - 5, 6, 2);
                        }
                    }
                    break;
                case 'haymaking':
                    // СЕНОКОС: трава в полный рост, сочная зелень
                    fillField(0x8fae3c);
                    gfx.fillStyle(0xa8c354, 0.9);
                    for (let i = 0; i < 230; i++) {
                        gfx.fillRect(fieldX + Math.random() * fieldW,
                            fieldY + Math.random() * fieldH, 2, 14);
                    }
                    // копны — прибрано к краям
                    gfx.fillStyle(0xc8b04a, 0.95);
                    gfx.fillEllipse(fieldX + fieldW * 0.14, fieldY + fieldH * 0.2, 44, 26);
                    gfx.fillEllipse(fieldX + fieldW * 0.86, fieldY + fieldH * 0.74, 44, 26);
                    gfx.fillStyle(0xa8903a, 0.8);
                    gfx.fillEllipse(fieldX + fieldW * 0.14, fieldY + fieldH * 0.24, 36, 16);
                    gfx.fillEllipse(fieldX + fieldW * 0.86, fieldY + fieldH * 0.78, 36, 16);
                    break;
                case 'harvest':
                    // ЖАТВА: золотые колосья (прежний вид поля)
                    fillField(0xc8a838);
                    gfx.fillStyle(0xe8c858, 0.8);
                    for (let i = 0; i < 200; i++) {
                        gfx.fillRect(fieldX + Math.random() * fieldW,
                            fieldY + Math.random() * fieldH, 2, 12);
                    }
                    // несрезанные пятна колосьев гуще
                    gfx.fillStyle(0xd8b848, 0.7);
                    for (let i = 0; i < 40; i++) {
                        gfx.fillRect(fieldX + Math.random() * fieldW,
                            fieldY + Math.random() * fieldH, 5, 10);
                    }
                    break;
                case 'stubble':
                    // ЖНИВЬЁ: сжатое поле, короткие стерни, снопы
                    fillField(0xb8a878);
                    gfx.fillStyle(0x98885c, 0.9);
                    for (let i = 0; i < 260; i++) {
                        gfx.fillRect(fieldX + Math.random() * fieldW,
                            fieldY + Math.random() * fieldH, 2, 4);
                    }
                    gfx.fillStyle(0xc8b06a, 0.95);
                    for (let i = 0; i < 5; i++) {
                        const bx = fieldX + fieldW * (0.1 + 0.2 * i);
                        const by = fieldY + fieldH * (i % 2 ? 0.3 : 0.7);
                        gfx.fillEllipse(bx, by, 30, 20);
                        gfx.fillStyle(0x8a7448, 0.7);
                        gfx.fillRect(bx - 2, by + 8, 4, 8);
                        gfx.fillStyle(0xc8b06a, 0.95);
                    }
                    break;
                case 'fallow':
                    // ЗАЛЕЖЬ: бурая земля с сухой травой (поздняя осень/ранняя весна)
                    fillField(0x6a5a42);
                    gfx.fillStyle(0x8a7a5c, 0.8);
                    for (let i = 0; i < 90; i++) {
                        gfx.fillRect(fieldX + Math.random() * fieldW,
                            fieldY + Math.random() * fieldH, 2, 7);
                    }
                    break;
                default:
                    // СНЕГ: поле спит под снежным покровом
                    fillField(0xdde4ea);
                    gfx.fillStyle(0xc8d2da, 0.8);
                    for (let i = 0; i < 50; i++) {
                        gfx.fillEllipse(fieldX + Math.random() * fieldW,
                            fieldY + Math.random() * fieldH, 14 + Math.random() * 22, 5 + Math.random() * 5);
                    }
                    break;
            }
            gfx.setDepth(1);
            // Колышущиеся кочки — только на растущих фазах (трава в рост)
            if (phase66 === 'haymaking' || phase66 === 'harvest') {
                const stemTexF = this.textures.exists('deco_grass_tuft') ? 'deco_grass_tuft' : 'tile_grass_0';
                for (let i = 0; i < 25; i++) {
                    const x = fieldX + Math.random() * fieldW;
                    const y = fieldY + Math.random() * fieldH;
                    const stem = this.add.image(x, y, stemTexF).setScale(2.6).setTint(phase66 === 'harvest' ? 0xc8a838 : 0x8fae3c).setDepth(3);
                    this.tweens.add({
                        targets: stem,
                        angle: { from: -8, to: 8 },
                        duration: 1500 + Math.random() * 1500,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }
            // Деревья по краям поля (раунд 27: прозрачные + взаимные коллизии)
            const placedFieldTrees = [];
            for (let i = 0; i < 6; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 3) ? Math.random() * (fieldX - 30) : width - Math.random() * (fieldX - 30);
                    const y = 120 + Math.random() * (height - 200);
                    const clash = placedFieldTrees.some(p => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60);
                    if (!clash) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.6).setOrigin(0.5, 0.88).setDepth(4);
                        placedFieldTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        } else if (locId === 'lake') {
            // П.12: Озеро — круглое большое в центре, кусты по краям
            // Фон — трава
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // П.12: Круглое озеро в центре, занимает ~1/4 локации
            const lakeCX = width / 2;
            const lakeCY = height / 2 + 30;
            const lakeR = Math.min(width, height) / 3.5;  // радиус
            gfx.fillStyle(0x1a3050, 1);
            gfx.fillCircle(lakeCX, lakeCY, lakeR);
            gfx.setDepth(1);
            // Анимированные волны озера
            for (let i = 0; i < 25; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * lakeR * 0.8;
                const x = lakeCX + Math.cos(angle) * r;
                const y = lakeCY + Math.sin(angle) * r;
                const water = this.add.image(x, y, `tile_lake_${i % 3}`).setScale(1.5).setDepth(2);
                this.tweens.add({
                    targets: water,
                    x: x + 12,
                    duration: 2500 + Math.random() * 2000,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
            // П.12: Кусты по краям озера (раунд 27: прозрачные кусты deco_berry_bush
            // вместо квадратных тайлов tile_forest с фоном)
            const placedBushes = [];
            const hasBushCollision = (x, y, minDist = 30) => {
                return placedBushes.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const bushTex = this.textures.exists('deco_berry_bush') ? 'deco_berry_bush' : 'tile_forest_0';
            for (let i = 0; i < 30; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = lakeR + 15 + Math.random() * 40;
                    const x = lakeCX + Math.cos(angle) * r;
                    const y = lakeCY + Math.sin(angle) * r;
                    // Не на краю экрана
                    if (x > 20 && x < width - 20 && y > 100 && y < height - 20 && !hasBushCollision(x, y, 30)) {
                        this.add.image(x, y, bushTex).setScale(1.6).setOrigin(0.5, 0.8).setDepth(3);
                        placedBushes.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Деревья по углам (раунд 27: прозрачные + взаимные коллизии)
            const placedLakeTrees = [];
            for (let i = 0; i < 6; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 3) ? Math.random() * 150 : width - Math.random() * 150;
                    const y = 110 + Math.random() * (height - 170);
                    const clash = placedLakeTrees.some(p => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60);
                    if (!clash) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.6).setOrigin(0.5, 0.88).setDepth(4);
                        placedLakeTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Раунд 31 (п.2): утром и вечером стадо поят у Озера —
            // коровы и лошадь стоят у южной кромки воды
            // (раунд 68: каждая животная точка — вне воды через clamp)
            const herdL = getHerdState(this.registry);
            if (herdL.place === 'lake') {
                for (let i = 0; i < 3; i++) {
                    const key = i === 2 ? 'deco_horse' : 'deco_cow';
                    if (!this.textures.exists(key)) continue;
                    const ang = Math.PI * (0.3 + i * 0.2); // южная дуга берега
                    const raw68 = { x: lakeCX + Math.cos(ang) * (lakeR + 14), y: lakeCY + Math.sin(ang) * (lakeR + 14) };
                    const safe68 = clampOutOfWater('lake', width, height, raw68.x, raw68.y, 28);
                    const ax = safe68.x, ay = safe68.y;
                    const animal = this.add.image(ax, ay, key).setScale(2).setDepth(3);
                    this.tweens.add({
                        targets: animal, y: ay - 2,
                        duration: 2100 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }
        } else if (locId === 'pogost') {
            // П.6,7: Погост — часовня по центру, ряды могил с крестами, дорожки.
            // Раунд 17: живой погост — трава-текстура вместо плоской заливки,
            // ограда по периметру, мерцающая лампада часовни, голуби,
            // клочья тумана, падающие листья, светлячки ночью. БЕЗ монстров.
            gfx.fillStyle(0x3a3a2a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура земли
            gfx.fillStyle(0x4a4a3a, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 4, 4);
            }
            const weatherNow = getWeather(this.registry);
            const isWinter = weatherNow && weatherNow.id === 'snow';

            // Раунд 17: травяные пласты + кочки поверх тёмной земли (глушь, но живая)
            for (let i = 0; i < 26; i++) {
                const gx = Math.random() * width;
                const gy = 100 + Math.random() * (height - 130);
                const patch = this.add.image(gx, gy, `tile_grass_${i % 4}`)
                    .setScale(1.6).setAlpha(0.35).setTint(0x6a7a5a).setDepth(0.5);
                patch.setFlipX(i % 2 === 0);
            }
            if (this.textures.exists('deco_grass_tuft')) {
                for (let i = 0; i < 14; i++) {
                    this.add.image(Math.random() * width, 110 + Math.random() * (height - 160),
                        'deco_grass_tuft').setScale(1.2).setAlpha(0.55).setTint(0x8a9a78).setDepth(1);
                }
            }

            // П.7: Дорожка от входа (низ экрана) к часовне (центр)
            const pathW = 60;
            const chapelY = height * 0.35;
            gfx.fillStyle(0x8a7a5a, 1);
            gfx.fillRect(width / 2 - pathW / 2, chapelY + 40, pathW, height - chapelY - 60);
            gfx.setDepth(1);
            // Камешки дорожки — старая тропинка читается
            gfx.fillStyle(0x7a6a4c, 0.8);
            for (let i = 0; i < 26; i++) {
                gfx.fillCircle(
                    width / 2 - pathW / 2 + 8 + Math.random() * (pathW - 16),
                    chapelY + 50 + Math.random() * (height - chapelY - 80), 2.5,
                );
            }
            gfx.setDepth(1);

            // П.7: Часовня в центре
            if (this.textures.exists('deco_chapel')) {
                this.add.image(width / 2, chapelY, 'deco_chapel').setScale(2.5).setDepth(5);
            } else {
                // Запасной вариант — рисуем часовню графикой
                const chapelGfx = this.add.graphics();
                chapelGfx.fillStyle(0x6a5a3a, 1);
                chapelGfx.fillRect(width / 2 - 40, chapelY - 30, 80, 60);
                chapelGfx.fillStyle(0x4a3a2a, 1);
                chapelGfx.fillTriangle(width / 2 - 50, chapelY - 30, width / 2 + 50, chapelY - 30, width / 2, chapelY - 70);
                chapelGfx.fillStyle(0xc9a14a, 1);
                chapelGfx.fillRect(width / 2 - 2, chapelY - 90, 4, 25);
                chapelGfx.fillRect(width / 2 - 10, chapelY - 82, 20, 4);
                chapelGfx.setDepth(5);
            }

            // ----- Раунд 17: лампада часовни — тёплый мерцающий отсвет -----
            const lampY = chapelY + 34;
            const lampGlow = this.add.ellipse(width / 2, lampY, 46, 20, 0xffb050, 0.30)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
            this.tweens.add({
                targets: lampGlow,
                alpha: { from: 0.22, to: 0.42 },
                scale: { from: 0.92, to: 1.08 },
                duration: 900,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            // Огонёк свечи в окне часовни (тлеет и днём — тихий маяк прихода)
            if (this.textures.exists('campfire_flame_0')) {
                const candle = this.add.sprite(width / 2 + 26, lampY - 6, 'campfire_flame_0')
                    .setScale(0.8).setDepth(6).setAlpha(0.9);
                const candleFrames = [0, 1, 2, 3].filter(f => this.textures.exists(`campfire_flame_${f}`));
                if (candleFrames.length) {
                    if (!this.anims.exists('pogost_candle')) {
                        this.anims.create({
                            key: 'pogost_candle',
                            frames: candleFrames.map(f => ({ key: `campfire_flame_${f}`, frame: 0 })),
                            frameRate: 6, repeat: -1,
                        });
                    }
                    candle.play('pogost_candle');
                }
            }

            // П.6,7: Ровные ряды могил с крестами по бокам от часовни
            const placedGraves = [];
            const hasGraveCollision = (x, y, minDist = 50) => {
                return placedGraves.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            // 2 ряда слева от дорожки
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    const x = 100 + col * 90;
                    const y = chapelY + 80 + row * 100;
                    if (hasGraveCollision(x, y, 50)) continue;
                    const v = (row + col) % 2;
                    if (this.textures.exists(`deco_grave_${v}`)) {
                        const grave = this.add.image(x, y, `deco_grave_${v}`).setScale(1.8).setDepth(3);
                        // Старые могилы чуть темнее (мох и время)
                        if ((row * 3 + col) % 3 === 0) grave.setTint(0xb0b0a0);
                    }
                    placedGraves.push({ x, y });
                }
            }
            // 2 ряда справа от дорожки
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    const x = width - 100 - col * 90;
                    const y = chapelY + 80 + row * 100;
                    if (hasGraveCollision(x, y, 50)) continue;
                    const v = (row + col) % 2;
                    if (this.textures.exists(`deco_grave_${v}`)) {
                        const grave = this.add.image(x, y, `deco_grave_${v}`).setScale(1.8).setDepth(3);
                        if ((row * 3 + col) % 3 === 1) grave.setTint(0xb0b0a0);
                    }
                    placedGraves.push({ x, y });
                }
            }
            // ----- Раунд 17: живые цветы на свежих могилах + каменные кресты -----
            if (!isWinter) {
                if (this.textures.exists('deco_flower_0')) {
                    [0, 4, 7].forEach((gi) => {
                        const g = placedGraves[gi];
                        if (!g) return;
                        const fl = `deco_flower_${gi % 3}`;
                        if (this.textures.exists(fl)) {
                            this.add.image(g.x + 10, g.y + 14, fl).setScale(1.1).setDepth(3.5).setAlpha(0.95);
                        }
                    });
                }
            }

            // ============================================================
            // Раунд 46 (п.7 заявки): МОГИЛЫ УБИТЫХ ГЕРОЕМ ЖИТЕЛЕЙ.
            // Убитый НПЦ исчезает из деревни, но на погосте появляется ЕГО
            // могила — свежий холмик с крестом и цветами. Клик по могиле —
            // поп-ап: КТО убил, ПО КАКОЙ ПРИЧИНЕ и грустная эпитафия.
            // ============================================================
            const qGraves = this.registry.get('quest') || {};
            const killedNpcs = qGraves.npcKilled || {};
            const graveEntries = Object.entries(killedNpcs);
            if (graveEntries.length > 0) {
                // Свежие могилы — нижним рядом под старыми (лево/право от дорожки)
                this.pogostMurderGraves = [];
                graveEntries.forEach(([npcId, info], gi) => {
                    const col = Math.floor(gi / 2) % 3;
                    const side = gi % 2; // 0 — слева, 1 — справа
                    const gx = side === 0 ? 100 + col * 90 : width - 100 - col * 90;
                    const gy = Math.min(chapelY + 300 + Math.floor(gi / 6) * 70, height - 95);
                    if (hasGraveCollision(gx, gy, 46)) return; // не наезжаем на старые
                    placedGraves.push({ x: gx, y: gy });

                    const npc = findNpc(this.registry, npcId);
                    const npcName = npc ? (npc.name || npcId) : npcId;
                    const profName = npc && npc.profession ? npc.profession.name : '';
                    const who = (info && info.by) || t('Герой');
                    const day = (info && info.day) || 1;
                    const epitaph = (info && info.epitaph) || t('Спи спокойно, добрая душа.');
                    const reasonText = t('житель сам напал на героя — пал(а) в честной схватке');

                    // Свежий холмик — ярче старых (мох ещё не прирос)
                    const v = gi % 2;
                    if (this.textures.exists(`deco_grave_${v}`)) {
                        const grave = this.add.image(gx, gy, `deco_grave_${v}`)
                            .setScale(1.8).setDepth(3).setTint(0xf2ead8);
                        // Свежая земля — тёмный холмик у подножия
                        const mound = this.add.ellipse(gx, gy + 16, 44, 14, 0x5a4632, 0.9).setDepth(3.2);
                        // Цветы скорби (не зимой)
                        if (!isWinter && this.textures.exists(`deco_flower_${gi % 3}`)) {
                            this.add.image(gx - 12, gy + 14, `deco_flower_${gi % 3}`)
                                .setScale(1.1).setDepth(3.5).setAlpha(0.95);
                        }
                        grave.setInteractive({ useHandCursor: true });
                        this.pogostMurderGraves.push({ npcId, name: npcName, x: gx, y: gy });
                        // Подпись — чьё это имя (читается с расстояния)
                        this.add.text(gx, gy + 34, `† ${npcName}`, {
                            fontSize: '10px', color: '#d8cfa8',
                            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
                            backgroundColor: '#00000077', padding: { x: 4, y: 2 },
                        }).setOrigin(0.5).setDepth(4);
                        grave.on('pointerdown', (pointer) => {
                            if (!pointer.leftButtonDown() || this.busyDialog) return;
                            this.busyDialog = true;
                            ActionLog.add(this.registry, tf(t('Посетил могилу {0} на погосте.'), npcName));
                            createDialog(this, t('⚰ Могила'),
                                tf(t('Здесь покоится {0}{1}.\nУпокоен(а) на {2}-й день странствия.\n\nОт руки героя {3} — {4}.\n\n«{5}»'),
                                    npcName,
                                    profName ? t(' (') + t(profName) + t(')') : '',
                                    day, t(who), reasonText, t(epitaph)),
                                [{ text: t('Помянуть (печально)'), callback: () => { this.busyDialog = false; } }],
                                { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 20 });
                        });
                        void mound;
                    }
                });
                if (graveEntries.length > 0 && this.pogostMurderGraves && this.pogostMurderGraves.length > 0) {
                    // Тихая подсказка при входе на погост со свежими могилами
                    this.add.text(width / 2, height - 130,
                        tf(t('⚰ На погосте {0} свежих могил — тех, кого не досчиталась деревня. Кликни по холмику.'), this.pogostMurderGraves.length), {
                        fontSize: '12px', color: '#c9b98a', align: 'center',
                        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
                        backgroundColor: '#00000088', padding: { x: 8, y: 4 },
                    }).setOrigin(0.5).setDepth(20);
                }
            }

            // П.7: Узкие дорожки между рядами могил
            gfx.fillStyle(0x7a6a4a, 1);
            // Вертикальная дорожка между рядами слева
            gfx.fillRect(145, chapelY + 60, 20, 220);
            // Вертикальная дорожка между рядами справа
            gfx.fillRect(width - 165, chapelY + 60, 20, 220);
            gfx.setDepth(1);

            // ----- Раунд 17: ограда погоста по периметру (столбики + жерди) -----
            if (this.textures.exists('tile_fence_h')) {
                for (let fx = 14; fx < width - 10; fx += 44) {
                    this.add.image(fx, 96, 'tile_fence_h').setScale(1.5).setDepth(2).setTint(0x9a8a70);
                }
                // Боковые жерди — частокол по краям, где не дороги
                for (let fy = 120; fy < height - 60; fy += 52) {
                    this.add.image(12, fy, 'tile_fence_h').setScale(1.5).setAngle(90).setDepth(2).setTint(0x9a8a70);
                    this.add.image(width - 12, fy, 'tile_fence_h').setScale(1.5).setAngle(90).setDepth(2).setTint(0x9a8a70);
                }
            }

            // Деревья по периметру (с коллизиями)
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 10; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    // Не на дорожке и нет коллизии с могилами
                    const onPath = Math.abs(x - width / 2) < 40;
                    if (!onPath && !hasTreeCollision(x, y, 60) && !hasGraveCollision(x, y, 60)) {
                        // Раунд 66 (п.10): кладбищенские деревья — новые спрайты
                        const pgTex = (i % 4 === 0)
                            ? `deco_pine_${i % 2}`
                            : `deco_tree_${i % 5}`;
                        const pgImg = this.textures.exists(pgTex)
                            ? this.add.image(x, y, pgTex).setScale(1.3).setOrigin(0.5, 0.9).setDepth(2)
                            : this.add.image(x, y, `tile_forest_${i % 2}`).setScale(2.5).setOrigin(0.5, 0.7).setDepth(2);
                        placedTrees.push({ x, y, img: pgImg });
                        break;
                    }
                    attempts++;
                }
            }

            // ----- Раунд 17: голуби на погосте (живность, НЕ монстры) -----
            // Клюют, перепархивают между могилами; в снег прячутся.
            if (!isWinter && this.textures.exists('deco_bird')) {
                this.pogostBirds = [];
                for (let i = 0; i < 3; i++) {
                    const bx = width * 0.28 + i * width * 0.22;
                    const by = chapelY + 150 + (i % 2) * 90;
                    const bird = this.add.image(bx, by, 'deco_bird')
                        .setScale(2.2).setDepth(4).setFlipX(i % 2 === 0);
                    const hopBird = () => {
                        if (!bird.active) return;
                        // Клёв: наклон вниз
                        this.tweens.add({
                            targets: bird, scaleY: 1.7, duration: 160,
                            yoyo: true, ease: 'Quad.easeOut',
                            onComplete: () => {
                                this.time.delayedCall(Phaser.Math.Between(500, 1400), () => {
                                    if (!bird.active) return;
                                    // Перепархивает на новое место неподалёку
                                    const nx = Phaser.Math.Clamp(bird.x + Phaser.Math.Between(-90, 90), 40, width - 40);
                                    const ny = Phaser.Math.Clamp(bird.y + Phaser.Math.Between(-60, 60), 130, height - 120);
                                    this.tweens.add({
                                        targets: bird, x: nx, y: ny - 16,
                                        duration: 380, ease: 'Sine.easeOut',
                                        onComplete: () => {
                                            this.tweens.add({
                                                targets: bird, y: ny,
                                                duration: 200, ease: 'Quad.easeIn',
                                            });
                                        },
                                    });
                                    this.time.delayedCall(Phaser.Math.Between(1600, 3400), hopBird);
                                });
                            },
                        });
                    };
                    this.time.delayedCall(400 + i * 900, hopBird);
                    this.pogostBirds.push(bird);
                }
            }

            // ----- Раунд 17: клочья тумана меж могил -----
            this.pogostFog = [];
            for (let i = 0; i < 4; i++) {
                const fog = this.add.image(Math.random() * width, 160 + Math.random() * (height - 220), 'fog_puff')
                    .setScale(1.3 + Math.random() * 1.2).setAlpha(0.05).setDepth(6.5);
                this.tweens.add({
                    targets: fog,
                    x: fog.x + (Math.random() - 0.5) * 90,
                    duration: 13000 + Math.random() * 7000,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
                this.pogostFog.push(fog);
            }

            // ----- Раунд 17: падающие листья (ветер по берёзам) -----
            if (this.textures.exists('forest_leaf') && !isWinter) {
                this.pogostLeaves = this.add.particles(0, 0, 'forest_leaf', {
                    x: { min: 0, max: width },
                    y: -10,
                    lifespan: 9000,
                    speedY: { min: 18, max: 40 },
                    speedX: { min: -14, max: 22 },
                    rotate: { start: 0, end: 240 },
                    scale: { min: 0.7, max: 1.3 },
                    alpha: { start: 0.5, end: 0.15 },
                    quantity: 1,
                    frequency: 1600,
                }).setDepth(7);
            }

            // ----- Раунд 17: светлячки над могилами ночью (не страшно — тихо) -----
            const pogostTime = getTime(this.registry);
            const pogostHour = pogostTime ? pogostTime.hour : 12;
            const pogostDark = (pogostHour >= 21 || pogostHour < 5) ? 1 : (pogostHour >= 18 ? (pogostHour - 18) / 3 : (pogostHour < 8 ? (8 - pogostHour) / 3 : 0));
            if (pogostDark > 0.4 && this.textures.exists('particle_spark')) {
                for (let i = 0; i < 6; i++) {
                    const fx = 40 + Math.random() * (width - 80);
                    const fy = 140 + Math.random() * (height - 220);
                    const f = this.add.image(fx, fy, 'particle_spark')
                        .setScale(0.4).setTint(0xd8ffa0).setDepth(7.5).setAlpha(0);
                    this.tweens.add({
                        targets: f,
                        alpha: pogostDark * Phaser.Math.FloatBetween(0.3, 0.85),
                        duration: 1300 + Math.random() * 900,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                        delay: Math.random() * 1800,
                    });
                    this.tweens.add({
                        targets: f,
                        x: fx + Phaser.Math.Between(-26, 26),
                        y: fy + Phaser.Math.Between(-18, 18),
                        duration: 4200 + Math.random() * 2400,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }
        } else if (locId === 'pasture') {
            // РАУНД 30 (п.2): ВЫПАС — ГУСТАЯ СОЧНАЯ ТРАВА И МНОЖЕСТВО ЦВЕТОВ.
            // Заливной луг: многослойная трава, кочки, луговые цветы по всему
            // полю (по сезону: зимой — снежные наметы вместо цветов).
            gfx.fillStyle(0x5a8a3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Сочная двухцветная трава
            gfx.fillStyle(0x6a9a4a, 0.6);
            for (let i = 0; i < 90; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 5);
            }
            gfx.fillStyle(0x7aaa56, 0.45);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 4, 6);
            }
            // Травяные пласты — густой покров
            for (let i = 0; i < 26; i++) {
                this.add.image(Math.random() * width, 105 + Math.random() * (height - 140),
                    `tile_grass_${i % 4}`).setScale(1.7).setAlpha(0.5).setDepth(0.5);
            }
            // Пышные кочки
            const tuftOkP = this.textures.exists('deco_grass_tuft');
            const tsPast = getTime(this.registry);
            const seasonPast = getSeason(tsPast ? tsPast.month : 5);
            for (let i = 0; i < 40; i++) {
                this.add.image(Math.random() * width, 105 + Math.random() * (height - 140),
                    tuftOkP ? 'deco_grass_tuft' : 'tile_grass_0')
                    .setScale(1.5 + Math.random() * 0.8).setDepth(1)
                    .setTint(seasonPast === 'winter' ? 0xcfe0d8 : 0xffffff);
            }
            // МНОЖЕСТВО ЦВЕТОВ по всему лугу (не зимой — зимой снежные наметы)
            if (seasonPast !== 'winter' && this.textures.exists('deco_flower_0')) {
                for (let i = 0; i < 42; i++) {
                    const fl = `deco_flower_${i % 3}`;
                    const x = Math.random() * width;
                    const y = 115 + Math.random() * (height - 165);
                    const flower = this.add.image(x, y, fl)
                        .setScale(1.7 + Math.random() * 0.7).setDepth(1.4);
                    this.tweens.add({
                        targets: flower,
                        angle: { from: -6, to: 6 },
                        duration: 1700 + Math.random() * 1500,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                        delay: Math.random() * 1400,
                    });
                }
            }
            // Раунд 31 (п.2): Коровы, козы и лошадь на выпасе только ДНЁМ —
            // утром и вечером пастухи водят стадо на водопой (Река/Озеро),
            // а ночью скот загнан в хлев (на локациях никого нет)
            const herdPast = getHerdState(this.registry);
            if (herdPast.place === 'pasture') {
            // Коровы (3 шт)
            for (let i = 0; i < 3; i++) {
                const x = 150 + i * 300 + Math.random() * 50;
                const y = 250 + Math.random() * 200;
                if (this.textures.exists('deco_cow')) {
                    const cow = this.add.image(x, y, 'deco_cow').setScale(2).setDepth(3);
                    this.tweens.add({
                        targets: cow,
                        y: y - 3,
                        duration: 2000 + Math.random() * 1000,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }
            // Козы (2 шт)
            for (let i = 0; i < 2; i++) {
                const x = 200 + i * 400 + Math.random() * 50;
                const y = 300 + Math.random() * 150;
                if (this.textures.exists('deco_goat')) {
                    this.add.image(x, y, 'deco_goat').setScale(2).setDepth(3);
                }
            }
            // Лошадь (1 шт)
            if (this.textures.exists('deco_horse')) {
                this.add.image(width * 0.7, height * 0.6, 'deco_horse').setScale(2).setDepth(3);
            }
            }
            // Ограда выпаса (забор по периметру)
            for (let x = 0; x < width; x += 48) {
                if (this.textures.exists('tile_fence_h')) {
                    this.add.image(x + 24, 90, 'tile_fence_h').setScale(1.5).setDepth(2);
                    this.add.image(x + 24, height - 30, 'tile_fence_h').setScale(1.5).setDepth(2);
                }
            }
            // РАУНД 66 (п.2 приказа): КОСТЁР НА ПАСТБИЩЕ ДЛЯ ПАСТУХОВ —
            // у стоянки пастухов горит живое пламя; можно присесть
            // (1 час времени, без лечения — п.1).
            this.spawnPastureCampfire(width, height);
        } else if (locId === 'mill') {
            // П.5,13: Мельница — большая мельница в центре, дорога, много деревьев.
            // Раунд 27 (п.4): мельница — ВЕТРЯНАЯ! Ручей, анимированная вода,
            // наливное колесо и туман над водой УДАЛЕНЫ (по указанию владельца).
            // Остались: мешки с мукой, поленница, телега, мучная пыль, птицы.
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура травы
            gfx.fillStyle(0x5a8c4a, 0.5);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 3);
            }
            const weatherNowM = getWeather(this.registry);
            const isWinterM = weatherNowM && weatherNowM.id === 'snow';

            // Раунд 17: сочные травяные пласты + кочки
            for (let i = 0; i < 22; i++) {
                this.add.image(Math.random() * width, 110 + Math.random() * (height - 150),
                    `tile_grass_${i % 4}`).setScale(1.6).setAlpha(0.45).setDepth(0.5);
            }
            if (this.textures.exists('deco_grass_tuft') && !isWinterM) {
                for (let i = 0; i < 12; i++) {
                    this.add.image(Math.random() * width, 110 + Math.random() * (height - 160),
                        'deco_grass_tuft').setScale(1.2).setAlpha(0.7).setDepth(1);
                }
                if (this.textures.exists('deco_flower_0')) {
                    for (let i = 0; i < 8; i++) {
                        this.add.image(Math.random() * width, 130 + Math.random() * (height - 200),
                            `deco_flower_${i % 3}`).setScale(1).setAlpha(0.9).setDepth(1.2);
                    }
                }
            }

            // П.13: Дорога от края экрана до мельницы (раунд 27: сплошная, без брода)
            const millX = width / 2;
            const millY = height / 2;
            const roadW = 80;
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(0, millY - roadW / 2, width, roadW);
            gfx.setDepth(1);
            // Колеи на дороге
            gfx.fillStyle(0xa88848, 0.5);
            for (let i = 0; i < 24; i++) {
                gfx.fillRect(Math.random() * width, millY - roadW / 2 + 8 + Math.random() * (roadW - 20), 26, 3);
            }

            // П.13: Большая мельница в центре
            const millGfx = this.add.graphics();
            // Основание мельницы (деревянная башня)
            millGfx.fillStyle(0x6a4a2a, 1);
            millGfx.fillRect(millX - 60, millY - 80, 120, 120);
            // Горизонтальные брёвна на башне (раунд 17)
            for (let ly = millY - 68; ly < millY + 36; ly += 12) {
                millGfx.fillStyle(0x5c3f22, 1);
                millGfx.fillRect(millX - 58, ly, 116, 2);
            }
            // Крыша мельницы (треугольная)
            millGfx.fillStyle(0x4a3a1a, 1);
            millGfx.fillTriangle(millX - 70, millY - 80, millX + 70, millY - 80, millX, millY - 140);
            // Окно
            millGfx.fillStyle(0x2a1a0a, 1);
            millGfx.fillRect(millX - 15, millY - 60, 30, 30);
            // Тёплый отсвет в окне (мелют и вечером)
            const winGlow = this.add.ellipse(millX, millY - 45, 34, 26, 0xffc866, 0.35)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(5.5);
            this.tweens.add({
                targets: winGlow,
                alpha: { from: 0.26, to: 0.42 },
                duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            // Дверь
            millGfx.fillStyle(0x3a2a1a, 1);
            millGfx.fillRect(millX - 12, millY - 10, 24, 50);
            millGfx.setDepth(5);

            // Крылья мельницы (4 лопасти)
            millGfx.fillStyle(0x8a6a3a, 1);
            millGfx.fillRect(millX - 80, millY - 102, 160, 8);  // горизонтальная
            millGfx.fillRect(millX - 4, millY - 180, 8, 160);  // вертикальная
            // Концы крыльев (треугольники для жёсткости)
            millGfx.fillStyle(0x6a4a2a, 1);
            millGfx.fillTriangle(millX - 80, millY - 102, millX - 80, millY - 94, millX - 95, millY - 98);
            millGfx.fillTriangle(millX + 80, millY - 102, millX + 80, millY - 94, millX + 95, millY - 98);
            millGfx.fillTriangle(millX - 4, millY - 180, millX + 4, millY - 180, millX, millY - 195);
            millGfx.fillTriangle(millX - 4, millY - 20, millX + 4, millY - 20, millX, millY - 5);
            millGfx.setDepth(5);

            // Контейнер с крыльями для корректного вращения
            const bladesContainer = this.add.container(millX, millY - 98);
            const blade1 = this.add.graphics();
            blade1.fillStyle(0x8a6a3a, 1);
            blade1.fillRect(-80, -4, 160, 8);
            blade1.fillStyle(0x6a4a2a, 1);
            blade1.fillTriangle(-80, -4, -80, 4, -95, 0);
            blade1.fillTriangle(80, -4, 80, 4, 95, 0);
            const blade2 = this.add.graphics();
            blade2.fillStyle(0x8a6a3a, 1);
            blade2.fillRect(-4, -82, 8, 160);
            blade2.fillStyle(0x6a4a2a, 1);
            blade2.fillTriangle(-4, -82, 4, -82, 0, -97);
            blade2.fillTriangle(-4, 78, 4, 78, 0, 93);
            bladesContainer.add([blade1, blade2]);
            bladesContainer.setDepth(6);
            this.tweens.add({
                targets: bladesContainer,
                angle: 360,
                duration: 8000,
                repeat: -1,
                ease: 'Linear',
            });

            // Раунд 27 (п.4): НАЛИВНОЕ КОЛЕСО И РУЧЕЙ УДАЛЕНЫ —
            // мельница ветряная, работает от ветра (крылья выше).

            // ----- Раунд 17: мешки с мукой у двери + поленница + телега -----
            const sacksGfx = this.add.graphics();
            [[millX - 40, millY + 30], [millX - 56, millY + 22]].forEach(([sx, sy]) => {
                sacksGfx.fillStyle(0x000000, 0.2);
                sacksGfx.fillEllipse(sx, sy + 10, 26, 6);
                sacksGfx.fillStyle(0xb8a070, 1);       // мешок
                sacksGfx.fillRoundedRect(sx - 11, sy - 8, 22, 20, 6);
                sacksGfx.fillStyle(0xa08858, 1);       // тень сбоку
                sacksGfx.fillRoundedRect(sx + 3, sy - 8, 7, 20, 3);
                sacksGfx.fillStyle(0x8a744c, 1);       // перевязка
                sacksGfx.fillRect(sx - 11, sy + 1, 22, 3);
            });
            sacksGfx.setDepth(5.8);
            if (this.textures.exists('deco_firewood')) {
                this.add.image(millX + 42, millY + 52, 'deco_firewood').setScale(1.8).setDepth(5.8);
            }
            if (this.textures.exists('deco_cart')) {
                const cart = this.add.image(millX * 0.42, millY + 6, 'deco_cart')
                    .setScale(2).setDepth(5.5);
                // Телега чуть покачивается под ветром — живая деталь
                this.tweens.add({
                    targets: cart,
                    angle: { from: -1.2, to: 1.2 },
                    duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }

            // ----- Раунд 17: мучная пыль у двери (золотистая взвесь) -----
            if (this.textures.exists('particle_spark')) {
                this.millDust = this.add.particles(0, 0, 'particle_spark', {
                    x: { min: millX - 46, max: millX + 46 },
                    y: { min: millY - 10, max: millY + 50 },
                    lifespan: 4200,
                    speedY: { min: -8, max: 10 },
                    speedX: { min: -6, max: 6 },
                    scale: { min: 0.12, max: 0.3 },
                    alpha: { start: 0.4, end: 0 },
                    quantity: 1,
                    frequency: 900,
                    tint: 0xf0e2b0,
                }).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
            }

            // ----- Раунд 17: птицы на траве перед мельницей (живность, не монстры) -----
            if (!isWinterM && this.textures.exists('deco_bird')) {
                for (let i = 0; i < 2; i++) {
                    const bx = millX * 0.3 + i * 90;
                    const by = millY + 46;
                    const bird = this.add.image(bx, by, 'deco_bird')
                        .setScale(2).setDepth(6).setFlipX(i % 2 === 0);
                    this.tweens.add({
                        targets: bird,
                        scaleY: { from: 2, to: 1.5 },
                        duration: 220 + i * 90,
                        yoyo: true, repeat: -1, ease: 'Quad.easeOut',
                    });
                    this.tweens.add({
                        targets: bird,
                        x: bx + (i === 0 ? 60 : -70),
                        duration: 5200 + i * 1300,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }

            // ----- Раунд 28 (п.4): ТУМАН ВЕРНУТ — низкие клочья сырости
            // у подножия мельницы и вдоль дороги (как было до раунда 27,
            // теперь мельница ветряная, туман — просто утренняя сырость;
            // с рассвета до 9 утра добавляется ещё и общий туман локации) -----
            if (this.textures.exists('fog_puff')) {
                for (let i = 0; i < 3; i++) {
                    const fogX = millX + (i - 1) * 150 + Phaser.Math.Between(-30, 30);
                    const fogY = millY + 55 + Math.random() * 30;
                    const fog = this.add.image(fogX, fogY, 'fog_puff')
                        .setScale(1.1 + Math.random() * 0.9).setAlpha(0.06).setDepth(6.5);
                    this.tweens.add({
                        targets: fog,
                        x: fogX + Phaser.Math.Between(-60, 60),
                        duration: 12000 + Math.random() * 8000,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }

            // П.13: Много деревьев вокруг мельницы (с коллизиями).
            // Раунд 27: прозрачные спрайты, без проверки ручья (его больше нет).
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const isOnMill = (x, y) => Math.abs(x - millX) < 100 && Math.abs(y - millY) < 120;
            const isOnRoad = (y) => Math.abs(y - millY) < 50;
            for (let i = 0; i < 16; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 110 + Math.random() * (height - 170);
                    if (!isOnMill(x, y) && !isOnRoad(y) && !hasTreeCollision(x, y, 60)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(1.6).setOrigin(0.5, 0.88).setDepth(3);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        }
    }

    /**
     * Выполнить поиск следов вора (раунд 21: следы/направление; бой теперь
     * начинается только при встрече с вором лично).
     */
    doSearch() {
        const result = searchLocation(this.registry, this.locationId);
        // Раунд 66.12 (приказ владельца №6): отсчёт до побега вора скрыт из UI

        // Если вор сбежал — переход к концу
        if (result.thiefEscaped) {
            this.time.delayedCall(1500, () => this.scene.start('End'));
            return;
        }

        // Показать результат поиска через диалог
        const title = result.found ? t('✨ Следы найдены!') : t('🔍 Поиск следов');
        createDialog(this, title, result.message, [
            {
                text: t('Продолжить'),
                callback: () => {
                    // Раунд 21: вор мог прийти в локацию, пока мы искали
                    if (isThiefAt(this.registry, this.locationId)) {
                        this.scene.restart({ locationId: this.locationId, from: this.from });
                        return;
                    }
                    this.scene.restart({ locationId: this.locationId, from: this.from });
                },
            },
        ], {
            singleton: false,
            portraitKey: result.found ? 'portrait_narrator' : 'portrait_narrator',
            typing: true,
            typingSpeed: 30,
        });
    }
}

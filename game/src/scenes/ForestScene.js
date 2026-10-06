// Тёмный лес — ходячая локация за околицей (§5.1 роадмапа, раунд 13).
// Волки патрулируют у логовищ, на агрессию реагируют погоней; контакт → бой (Combat).
// Сбор грибов/ягод/зверобоя (раз в игровой день), отдых у старого кострища
// (раунд 66.11: схрон с засадой вырезан по приказу владельца),
// выход к околице. Атмосфера: туман, световые столбы, падающая листва, светлячки.
// Phaser загружен глобально через CDN
import {
    FOREST_COLS, FOREST_ROWS, FOREST_SPAWN, FOREST_EXIT,
    WOLF_DENS, WOLF_CFG, GAME_ANIMALS, planForestAnimals,
    forestGatherSpots, campfirePos, forestTileAt,
    validateForestMap, rollForestTracking,
} from '../data/forest.js';
import { tickTime, getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { applyWeatherVisuals, isRainy } from '../systems/Weather.js';
import { addMorningFog } from '../systems/AmbientFX.js';
// Патч 66.46 (приказ 2): ход солнца — тени и смена освещения
import { attachSunLight } from '../systems/SunLight.js';
import { checkGameEnd } from '../data/thief.js';
import { onLocationVisited, getBlessedSkill } from '../data/questGenerator.js';
import { ActionLog } from '../data/actionLog.js';
import { dayKeyOf, isActionDoneToday, markActionDone } from '../data/daily.js'; // раунд 66.10: daily вместо удалённого chests.js
// Раунд 66.16 (приказы 1–3): лесные грибы/ягоды — еда (+1 HP, час, кулдаун 4 ч)
// Раунд 66.17 (приказы 8,10,11): готовка на костре, стрельба по дичи, мясо с туши
// Раунд 66.70: еда по правилам meal.js теперь только в инвентаре («Съесть»);
// сбор/готовка/обдир — проверяемые навыки (Выживание/Готовка) — см. loot.js
// Патч 66.74: бортничество (борть) — bortnikGather; выстрел со Скрадывания (+10)
import { survivalGather, survivalButcher, bortnikGather, cookAtFire, getLootDef, countOf, shotChance, addItem, removeItem } from '../systems/loot.js';
// Патч 66.74: проверки Следопытства при входе и Скрадывания перед выстрелом
import { skillCheck } from '../systems/BRPEngine.js';
// Раунд 66.70 (приказы 1–2): счётчик сытости в HUD (норма 2 трапезы/сутки)
import { hungerStatusLine, hungerHours } from '../systems/hunger.js';
// Патч 66.73 (приказ 14): усталость — траты за охоту, гард изнеможения, HUD
import { spendFatigue, restFatigueFull, exhaustedGuardPopup, fatigueStatusLine } from '../systems/fatigue.js';
// Раунд 66.28 (пп.5–8): стрелы и колчан — стрельба тратит стрелу
import { getQuiver, spendArrow } from '../systems/ammo.js';
// Патч 66.75 (приказы 5–6): кнопка «⚙ Настройки» в статус-баре леса
import { addSettingsGearButton } from '../systems/SettingsPanel.js';
import { createDialog } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
// 66.37: калибровка масштаба мировых листов персонажей 128px (были 64)
import { WORLD_K, WORLD_BODY_PX } from '../systems/WorldLook.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { formatMoney } from '../systems/Character.js';
import { getVillageRep } from '../data/reputation.js';
// Патч 66.80: статус репутации в HUD (лестница «подозрительный ↔ свой»)
import { villageRepStatusSuffix } from '../systems/repBalance.js';
import { t, tf, tk } from '../systems/i18n.js';
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine } from '../systems/WorldClock.js';

const TS = 48;   // как в деревне — мир 1440×1056, камера скроллится
const WORLD_W = FOREST_COLS * TS;
const WORLD_H = FOREST_ROWS * TS;

// Тёплое золото искр у точек сбора
const SPARK_TINT = 0xffd970;

export class ForestScene extends Phaser.Scene {
    constructor() {
        super('Forest');
    }

    init(data) {
        this.from = (data && data.from) || 'Fork';
        // Возврат после боя — вернуть игрока туда, где он встал
        this.returnPos = this.registry.get('forestReturnPos') || null;
        this.registry.set('forestReturnPos', null);
    }

    create() {
        this.audioManager = new AudioManager(this);
        // 66.68 (§9.3 аудита 66.66, P3): переиспользуемый вектор движения — каждый
        // кадр movePlayer() раньше создавал new Phaser.Math.Vector2; и кэш idle-ключа
        // (без шаблонной строки каждый кадр стоянки).
        this._moveVec = new Phaser.Math.Vector2(0, 0);
        this._idleKey = ''; this._idleKeyDir = null;
        // Раунд 31 (пп.11,12): мировые часы идут реальным временем (в диалогах стоят)
        attachWorldClock(this);
        attachChurchBells(this, { volume: 0.3 });
        this.audioManager.playSceneMusic('village');
        // Раунд 24: эмбиент леса — птицы днём, сверчки ночью
        const fsTime = getTime(this.registry);
        const fsHour = fsTime ? fsTime.hour : 12; // раунд 31: фикс .hours → .hour
        this.audioManager.setAmbient((fsHour >= 21 || fsHour < 5)
            ? 'ambient_forest_night'
            : 'ambient_forest_day');

        // ----- QA-валидация проходимости (как в деревне) -----
        const validation = validateForestMap();
        if (validation.problems.length) {
            console.warn('[Лес] Проблемы проходимости:', validation.problems);
        }

        this.cameras.main.setBackgroundColor(0x0e1a0e);
        this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

        // Раунд 20: бесконечная трава за границами мира (лес) —
        // при RESIZE окно бывает шире мира, иначе по краям пустота фона.
        if (this.textures.exists('tile_grass_0')) {
            const pad = 2000;
            const back = this.add.tileSprite(-pad, -pad, WORLD_W + pad * 2, WORLD_H + pad * 2, 'tile_grass_0')
                .setOrigin(0, 0).setDepth(-10);
            back.setTileScale(1.5, 1.5);
        }

        this.solids = this.physics.add.staticGroup();
        this.gatherEntries = [];
        this.gatherByTile = new Map();
        this.wolves = [];
        this.animals = [];   // раунд 66.17: живая дичь (зайцы/глухари/косули)
        this.corpses = [];   // раунд 66.17: туши, которые можно обобрать
        this.fireflies = [];
        this.busyDialog = false;
        this.sneakBonus = false;   // патч 66.74: +10 к выстрелу после удачного Скрадывания
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = 350;

        this.drawForest();
        // Патч 66.46 (приказ 2): солнечный свет — ДО спавна героя (он станет
        // «следящей» тенью). Тени лежат на земле (0.35): выше тайлов/кустов (0.1),
        // ниже деревьев (y+0.55); тёплый слой — под вечной мглой (94).
        this.sunLight = attachSunLight(this, { shadowDepth: 0.35, overlayDepth: 92.5 });
        this.sunLight.addCaster(() => {
            const pts = [];
            for (let y = 0; y < FOREST_ROWS; y++) {
                for (let x = 0; x < FOREST_COLS; x++) {
                    const tc = forestTileAt(x, y);
                    if (tc === 'T') {
                        const jx = ((x * 37 + y * 61) % 13) - 6;
                        pts.push({ x: x * TS + TS / 2 + jx, y: y * TS + TS * 1.02, rx: 15, ry: 5, k: 0.95 });
                    } else if (tc === 't') {
                        const jx = ((x * 53 + y * 29) % 11) - 5;
                        pts.push({ x: x * TS + TS / 2 + jx, y: y * TS + TS * 0.84, rx: 11, ry: 4, k: 0.7 });
                    }
                }
            }
            return pts;
        });
        this.spawnGatherSpots();
        this.spawnCampfire();
        this.drawExitMarker();
        this.spawnPlayer();
        this.spawnWolves();
        // Патч 66.74 (приказ 8): проверка Следопытства при входе в лес —
        // удача увеличивает шанс появления дичи (до спавна зверя)
        this.rollTrackingOnEntry();
        this.spawnGameAnimals();   // раунд 66.17 (п.9): дичь в лесу
        this.buildAtmosphere();
        this.buildHUD();

        // ----- Управление -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
        // F1 — окно помощи (в сборке нет сцены 'Help' — показываем диалог; фикс латентного бага)
        this.input.keyboard.on('keydown-F1', () => this.showHelpDialog());
        this.input.keyboard.on('keydown-ESC', () => this.scene.start('Title'));
        this.virtualControls = new VirtualControls(this);
    }

    showHelpDialog() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        createDialog(this, '❓ Тёмный лес',
            timeRatioInfoLine() + '\n\n' +
            tk('forest.help.body',
                'Управление: WASD/стрелки — движение, E/пробел — действие, ESC — меню.\n\n' +
                '🐺 Волки рыщут у логовищ: заметят — погонят. В бою можно драться или сбежать.\n' +
                '🍄 Сбор — проверка Выживания: провал — пусто, успех — горсть в узел, крит — вдвое. Ягоды едят сразу («Съесть» в Персонаже), сырые грибы ТОЛЬКО на костре — жареные; зверобой — трава: лечит через Знахарство.\n' +
                '🏹 Дичь (зайцы, глухари, в чаще — косули): с экипированным луком подходи на выстрел и жми E; тушу обдирают Выживанием — мясо и шкура.\n' +
                '🔥 У старого кострища (северо-запад) можно пересидеть час и готовить сырую рыбу/мясо/грибы (проверка Готовки; провал — продукты пропали).\n' +
                '◀ Выход к околице — на юге у кромки леса.'),
            [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
            { singletonKey: 'forest-help' });
    }

    // ================= ОТРИСОВКА =================

    drawForest() {
        for (let y = 0; y < FOREST_ROWS; y++) {
            for (let x = 0; x < FOREST_COLS; x++) {
                const t = forestTileAt(x, y);
                const px = x * TS + TS / 2;
                const py = y * TS + TS / 2;

                // --- Земля ---
                let groundTex;
                if (t === 'f') {
                    groundTex = `tile_forest_dense_${(x * 5 + y * 3) % 2}`;
                } else {
                    groundTex = `tile_grass_${(x * 7 + y * 13) % 4}`;
                }
                const ground = this.add.image(px, py, this.textures.exists(groundTex) ? groundTex : 'tile_grass_0');
                ground.setScale(TS / 32);
                // Тёмный подлесок чуть темнее травы
                if (t === '.') ground.setTint(0xcfd8c0);

                // --- Куртины на ',' ---
                if (t === ',' && this.textures.exists('deco_grass_tuft')) {
                    this.add.image(px + (x % 3 - 1) * 6, py + 4, 'deco_grass_tuft')
                        .setScale(TS / 32).setDepth(0.1).setAlpha(0.9);
                }

                // --- Высокие объекты (Y-сортировка) ---
                if (t === 'T') {
                    // РАУНД 66 (пп.10,11): Густой лес — деревья из пака
                    // Medieval_Expansion_Trees (преобладают ели/пихты, местами
                    // лиственные); коллизия — только тайл ствола, сквозь
                    // крону игрок проходит (Y-сортировка).
                    const jx = ((x * 37 + y * 61) % 13) - 6;
                    const deepIdx = (x * 5 + y * 11);
                    const treeTex = (deepIdx % 3 === 0)
                        ? `deco_tree_${deepIdx % 5}`
                        : `deco_pine_${deepIdx % 2}`;
                    if (this.textures.exists(treeTex)) {
                        const tree = this.add.image(px + jx, py + 12 + jx * 0.4, treeTex)
                            .setScale(1.5).setOrigin(0.5, 0.92);
                        tree.setDepth(y + 0.6);
                    } else {
                        // Страховка: старый тайл-канопа
                        const canopy = this.add.image(px + jx, py + 9 + jx * 0.4, `tile_forest_dense_${(x + y) % 2}`);
                        canopy.setScale(TS / 32 * 1.45);
                        canopy.setDepth(y + 0.6);
                    }
                } else if (t === 't') {
                    // Редкое/молодое дерево — новый спрайт поменьше
                    const jx = ((x * 53 + y * 29) % 11) - 5;
                    const liteIdx = (x * 3 + y * 7);
                    const liteTex = (liteIdx % 3 === 0)
                        ? `deco_tree_${liteIdx % 5}`
                        : `deco_pine_${liteIdx % 2}`;
                    if (this.textures.exists(liteTex)) {
                        const sap = this.add.image(px + jx, py + 6, liteTex)
                            .setScale(1.05).setOrigin(0.5, 0.92);
                        sap.setDepth(y + 0.55);
                    } else {
                        const canopy = this.add.image(px + jx, py + 3, `tile_forest_${(x * 3 + y) % 2}`);
                        canopy.setScale(TS / 32 * 1.15);
                        canopy.setDepth(y + 0.55);
                    }
                } else if (t === 'r') {
                    const rock = this.add.image(px, py + 6, this.textures.exists('tile_rock_0') ? 'tile_rock_0' : groundTex);
                    rock.setScale(TS / 32 * 1.1).setDepth(y + 0.5);
                } else if (t === 'L') {
                    this.add.image(px, py + 10, 'deco_log').setScale(TS / 32 * 1.2).setDepth(0.2);
                } else if (t === 'b') {
                    this.add.image(px, py + 8, 'deco_berry_bush').setScale(TS / 32 * 1.2).setDepth(y + 0.4);
                } else if (t === 'B') {
                    // ПАТЧ 66.74 (приказ 3): БОРТНОЕ дерево — дикие пчёлы в колоде.
                    // Дерево как одинокое + колода-борть у подножия (deco_log).
                    const jx = ((x * 43 + y * 31) % 9) - 4;
                    const bortTex = this.textures.exists(`deco_tree_${(x * 3 + y) % 5}`)
                        ? `deco_tree_${(x * 3 + y) % 5}` : `deco_pine_${(x + y) % 2}`;
                    if (this.textures.exists(bortTex)) {
                        this.add.image(px + jx, py + 6, bortTex).setScale(1.15).setOrigin(0.5, 0.92).setDepth(y + 0.55);
                    }
                    if (this.textures.exists('deco_log')) {
                        this.add.image(px - 14, py + 14, 'deco_log').setScale(TS / 32 * 0.8).setDepth(y + 0.45).setTint(0xd8b060);
                    }
                }

                // --- Физическое тело для непроходимых ---
                if ('TtrLbCS'.includes(t) || t === 'B') {
                    const solid = this.solids.create(px, py, 'tile_grass_0');
                    solid.setScale(TS / 32).refreshBody();
                    solid.setVisible(false);
                }
            }
        }
    }

    spawnGatherSpots() {
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const gathered = q.forestGathered || {};

        forestGatherSpots().forEach((spot) => {
            const px = spot.col * TS + TS / 2;
            const py = spot.row * TS + TS / 2;
            const taken = gathered[spot.id] === today;

            let img;
            if (spot.kind === 'mushroom') {
                img = this.add.image(px, py + 8, 'deco_mushroom').setScale(TS / 32);
            } else if (spot.kind === 'berry' || spot.kind === 'bort') {
                // Куст/борть уже нарисованы в drawForest — тут только искра
                // (66.74: у борти — колода у подножия; img остаётся null —
                // см. фикс updateNearestInteractable)
                img = null;
            } else {
                img = this.add.image(px, py + 6, 'deco_herb').setScale(TS / 32);
            }
            if (img) {
                img.setDepth(0.25);
                if (taken) img.setVisible(false);
            }

            // Искра над нетронутыми точками
            let marker = null;
            if (!taken) {
                marker = this.add.image(px, py - 12, 'particle_spark')
                    .setScale(0.5).setDepth(0.6).setTint(spot.kind === 'herb' ? 0xffe9a0 : (spot.kind === 'bort' ? 0xffd960 : SPARK_TINT));
                this.tweens.add({
                    targets: marker,
                    y: py - 18,
                    alpha: { from: 0.9, to: 0.3 },
                    duration: 900 + (spot.col * 37 + spot.row * 61) % 300,
                    yoyo: true,
                    repeat: -1,
                });
            }

            const entry = { ...spot, img, marker };
            this.gatherEntries.push(entry);
            this.gatherByTile.set(`${spot.col},${spot.row}`, entry);
        });
    }

    /**
     * ПАТЧ 66.74 (приказ владельца 8): СЛЕДОПЫТСТВО ПРИ ВХОДЕ В ЛЕС —
     * общая проверка data/forest.js rollForestTracking (раз в день,
     * удача — дичи больше весь день в обеих лесных системах).
     */
    rollTrackingOnEntry() {
        this.trackBoost = rollForestTracking(this.registry).boost;
    }

    spawnCampfire() {
        const camp = campfirePos();

        // Старое кострище лесников — РАУНД 65 (п.5): в деревне костра нет,
        // отдых переехал СЮДА. РАУНД 66 (п.1): отдых = ТОЛЬКО промотка
        // времени на 1 час, без лечения (пламя горит, свет тлеет).
        // РАУНД 66.11 (приказ владельца): схрон под корягой вырезан насовсем —
        // здесь осталась только нейтральная стоянка лесников с костром,
        // без всяких чужаков и засад.
        const cx = camp.col * TS + TS / 2;
        const cy = camp.row * TS + TS / 2;
        if (this.textures.exists('campfire_base')) {
            this.add.image(cx, cy + 6, 'campfire_base').setScale(TS / 32).setDepth(0.25);
        }
        // Живое пламя (3 кадра, ADD) — костёр в лагере разожжён
        if (this.textures.exists('campfire_flame_0')) {
            this.campfireFlame = this.add.image(cx, cy - 4, 'campfire_flame_0')
                .setScale(TS / 32 * 1.3)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.35);
            let flameFrame = 0;
            this.time.addEvent({
                delay: 180, loop: true,
                callback: () => {
                    flameFrame = (flameFrame + 1) % 3;
                    if (this.campfireFlame && this.textures.exists(`campfire_flame_${flameFrame}`)) {
                        this.campfireFlame.setTexture(`campfire_flame_${flameFrame}`);
                    }
                },
            });
        }
        // Угли тлеют, тёплый отсвет качается
        this.campGlow = this.add.ellipse(cx, cy + 8, 64, 26, 0xff7a30, 0.22)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.26);
    }

    drawExitMarker() {
        const px = FOREST_EXIT.col * TS + TS / 2;
        const py = FOREST_EXIT.row * TS + TS / 2;
        const label = this.add.text(px, py - TS * 1.6, t('◀ К ОКОЛИЦЕ'), {
            fontSize: '13px', color: '#E8DCC4', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000088', padding: { x: 5, y: 2 },
        }).setOrigin(0.5).setDepth(0.7);
        this.tweens.add({ targets: label, alpha: { from: 1, to: 0.55 }, duration: 1100, yoyo: true, repeat: -1 });
    }

    spawnPlayer() {
        this.player = this.registry.get('player');
        const pos = this.returnPos || {
            x: FOREST_SPAWN.col * TS + TS / 2,
            y: FOREST_SPAWN.row * TS + TS / 2,
        };
        const useComposite = this.player && this.player.useComposite && this.textures.exists('player_composite');
        if (useComposite) {
            this.playerObj = this.physics.add.sprite(pos.x, pos.y, 'player_composite');
        } else {
            this.playerObj = this.physics.add.sprite(pos.x, pos.y, this.player.sprite || 'player');
            if (this.player.appearance && this.player.appearance.jacket) {
                this.playerObj.setTint(this.player.appearance.jacket.tint);
            }
            this.playerObj.play(`${this.player.sprite || 'player'}_idle_down`);
        }
        // 66.37: × WORLD_K — листы персонажей 128px, фигуры прежнего размера;
        // WORLD_BODY_PX — прежний мировой размер тела (68px кадра 128)
        this.playerObj.setScale(TS / 32 * 0.75 * WORLD_K);
        // Честный хитбокс (урок раунда 7): фигура в центре кадра
        if (this.playerObj.body) this.playerObj.body.setSize(WORLD_BODY_PX, WORLD_BODY_PX, true);
        this.playerObj.setCollideWorldBounds(true);
        this.physics.add.collider(this.playerObj, this.solids);
        this.playerObj.setDepth(this.playerObj.y / TS);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // Тень под ногами — патч 66.46: СЛЕДЯЩАЯ, по солнцу (раньше —
        // статичный овал на точке спавна, герой «выходил» из неё)
        if (this.sunLight) this.sunLight.follow(this.playerObj, 12, 4.2, 1);
    }

    spawnWolves() {
        const timeState = getTime(this.registry);
        const minutesNow = timeState ? timeState.day * 1440 + timeState.hour * 60 + timeState.minute : 0;
        const q = this.registry.get('quest') || {};
        // Стая напугана после недавнего боя (4 игровых часа)
        this.wolvesScaredUntil = q.wolfScaredUntilMin || 0;
        this.wolvesScared = minutesNow < this.wolvesScaredUntil;

        WOLF_DENS.forEach((den, i) => {
            const wx = den.col * TS + TS / 2;
            const wy = den.row * TS + TS / 2;
            const sprite = this.physics.add.sprite(wx, wy, 'enemy_wolf');
            sprite.setScale(TS / 32 * 0.95);
            if (sprite.body) sprite.body.setSize(26, 16, true);
            sprite.setCollideWorldBounds(true);
            sprite.setDepth(wy / TS);
            this.physics.add.collider(sprite, this.solids);
            sprite.play(`enemy_wolf_idle_down`);

            const wolf = {
                id: den.id,
                sprite,
                homeX: wx, homeY: wy,
                state: 'idle',
                targetX: wx, targetY: wy,
                nextThink: this.time.now + 400 + i * 700,
                cooldownUntil: 0,
                dir: 'down',
                phase: Math.random() * Math.PI * 2,
            };
            this.wolves.push(wolf);
            this.physics.add.overlap(this.playerObj, sprite, () => this.startWolfCombat(wolf));
        });
    }

    /**
     * РАУНД 66.17 (п.9): ДИЧЬ В ЛЕСУ. По плану planForestAnimals():
     * зайцы (2–3) и глухари (1–2) по всему лесу, косуля — редко (25%)
     * и только в чаще (север карты). Звери безразличны к человеку,
     * но близко не подпускают: подошёл — удирал (птица взлетает).
     */
    spawnGameAnimals() {
        // Патч 66.74: удачное Следопытство при входе — дичи больше
        planForestAnimals(Math.random, { tracking: !!this.trackBoost }).forEach((spot, i) => {
            const cfg = GAME_ANIMALS[spot.kind];
            if (!cfg || !this.textures.exists(cfg.tex)) return;
            const ax = spot.col * TS + TS / 2;
            const ay = spot.row * TS + TS / 2;
            const spr = this.physics.add.sprite(ax, ay, cfg.tex)
                .setScale(cfg.scale).setDepth(ay / TS);
            if (spr.body) {
                spr.body.setSize(20, 14, true);
                spr.setCollideWorldBounds(true);
            }
            this.physics.add.collider(spr, this.solids);
            const animal = {
                id: `${spot.kind}_${i}`,
                kind: spot.kind,
                cfg,
                sprite: spr,
                state: 'wander',
                targetX: ax, targetY: ay,
                nextThink: this.time.now + 600 + i * 500,
                fleeUntil: 0,
                dead: false,
                phase: Math.random() * Math.PI * 2,
            };
            this.animals.push(animal);
            // Птица «клyёт» — лёгкое покачивание
            if (cfg.flying) {
                this.tweens.add({
                    targets: spr,
                    angle: { from: -4, to: 4 },
                    duration: 700 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        });
    }

    /** Раунд 66.17: движение дичи — блуждание + паническое бегство. */
    updateAnimals(time) {
        const p = this.playerObj;
        this.animals.forEach((a) => {
            const s = a.sprite;
            if (!s.active || a.dead) return;
            const dist = Phaser.Math.Distance.Between(s.x, s.y, p.x, p.y);
            let vx = 0, vy = 0, speed = 0;

            if (a.state === 'flee' && time < a.fleeUntil) {
                // Бегство от игрока по последнему направлению
                const dx = s.x - p.x, dy = s.y - p.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                vx = dx / len; vy = dy / len;
                speed = a.cfg.speed;
            } else if (dist < a.cfg.fleeRadius) {
                // Подошёл слишком близко — прочь (птица — взлетает и исчезает)
                if (a.cfg.flying) {
                    a.dead = true;            // исчезает из сцены (упорхнула)
                    s.setVelocity(0, 0);
                    this.tweens.add({
                        targets: s,
                        y: s.y - 90,
                        alpha: 0,
                        angle: s.angle + (Math.random() < 0.5 ? -20 : 20),
                        duration: 900,
                        ease: 'Quad.easeOut',
                        onComplete: () => s.destroy(),
                    });
                    return;
                }
                a.state = 'flee';
                a.fleeUntil = time + 2200;
                const dx = s.x - p.x, dy = s.y - p.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                vx = dx / len; vy = dy / len;
                speed = a.cfg.speed;
            } else {
                // Спокойное блуждание в радиусе 3 тайлов
                if (time > a.nextThink || Phaser.Math.Distance.Between(s.x, s.y, a.targetX, a.targetY) < 6) {
                    a.nextThink = time + 1600 + Math.random() * 2600;
                    const c = Math.round(s.x / TS) + Math.floor(Math.random() * 7) - 3;
                    const r = Math.round(s.y / TS) + Math.floor(Math.random() * 7) - 3;
                    if (!'TtrLbCS'.includes(forestTileAt(c, r))) {
                        a.targetX = c * TS + TS / 2;
                        a.targetY = r * TS + TS / 2;
                    }
                }
                const dx = a.targetX - s.x, dy = a.targetY - s.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                if (len > 5) {
                    vx = dx / len; vy = dy / len;
                    speed = Math.round(a.cfg.speed * 0.3);   // рысцой/пошком
                } else {
                    a.state = 'wander';
                }
            }

            s.setVelocity(vx * speed, vy * speed);
            if (vx !== 0) s.setFlipX(vx > 0);   // профиль влево — flip вправо
            s.setDepth(s.y / TS);
        });
    }

    /**
     * РАУНД 66.17 (п.10): ВЫСТРЕЛ ИЗ ЛУКА ПО ДИЧИ. Лук должен быть
     * В УЗЛЕ И ЭКИПИРОВАН (weaponId === 'bow'); шанс = base вида дичи
     * + половина навыка «Стрельба из лука» (shotChance). Промах —
     * дичь удирает (птица — взлетает). Выстрел — 5 минут времени.
     */
    shootAnimal(animal) {
        if (this.busyDialog || !animal || animal.dead) return;
        // Патч 66.73 (приказ 14): изнеможённый герой не в силах охотиться
        if (exhaustedGuardPopup(this, this.registry)) return;
        const player = this.player;
        if (!player) return;
        if (player.weaponId !== 'bow') {
            createDialog(this, t('🏹 Без лука'),
                t('Стрелять можно только из лука — и он должен быть экипирован (Персонаж → Оружие). Кузнец Данила кует луки.'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
            return;
        }
        // Раунд 66.28 (пп.7,8): стрельба требует стрелы В КОЛЧАНЕ; пустой —
        // поп-ап предупреждение, время не тратится (выстрела не было)
        if (getQuiver(player) <= 0) {
            createDialog(this, '🪶 ' + t('Колчан пуст!'),
                t('Стрел в колчане нет — стрелять нечем. Пачку стрел (10 шт.) продают кузнец Данила и ремесленник Аверьян. Стрелы из узла наложи в колчан на экране персонажа (Персонаж → Инвентарь).'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
            return;
        }
        this.busyDialog = true;
        const s = animal.sprite;
        // Патч 66.73: выстрел по зверю — охота (голод ×2, −1 ОУ)
        tickTime(this.registry, 5, 'hunt');
        spendFatigue(this.registry, 1);
        // Раунд 66.28 (п.7): стрела уходит из колчана при КАЖДОМ выстреле (попал/промах)
        spendArrow(player);
        this.registry.set('player', player);
        if (this.audioManager) this.audioManager.playShoot();

        // Стрела — тонкая палочка, летящая от героя к зверю (160 мс)
        const dx = s.x - this.playerObj.x, dy = s.y - this.playerObj.y;
        const arrow = this.add.rectangle(this.playerObj.x, this.playerObj.y - 10, 14, 2, 0xd8c8a0)
            .setRotation(Math.atan2(dy, dx)).setDepth(150);
        this.tweens.add({
            targets: arrow,
            x: s.x, y: s.y,
            duration: 160, ease: 'Quad.easeOut',
            onComplete: () => arrow.destroy(),
        });

        // Раунд 66.71: благословение усиливает и выстрел по дичи (+10%)
        // Патч 66.74: удачное Скрадывание даёт +10 к выстрелу (списывается)
        const sneakBonus = this.sneakBonus ? 10 : 0;
        this.sneakBonus = false;
        const chance = shotChance(animal.cfg.base + sneakBonus, getBlessedSkill(this.registry, (player.skills && player.skills.bow) || 15));
        const roll = Math.random() * 100;
        this.time.delayedCall(180, () => {
            if (roll < chance) {
                // ПОПАДАНИЕ: зверь — туша (обобрать — п.11)
                animal.dead = true;
                s.setVelocity(0, 0);
                if (s.body) s.body.enable = false;
                if (this.textures.exists(animal.cfg.corpseTex)) s.setTexture(animal.cfg.corpseTex);
                s.setScale(Math.max(animal.cfg.scale, 1.4));
                s.setAngle(0);
                this.corpses.push(animal);
                this.showFloatingText(s.x, s.y - 20, t('Попал!'), '#8adf8a');
                ActionLog.add(this.registry, tf(t('Подстрелил {0} из лука — туша осталась лежать, можно обобрать.'), t(animal.cfg.name)));
            } else {
                // ПРОМАХ: дичь удирает
                this.showFloatingText(s.x, s.y - 20, t('Мимо!'), '#e8cc7a');
                ActionLog.add(this.registry, tf(t('Выстрел из лука по {0} — мимо: зверь удрал.'), t(animal.cfg.name)));
                if (animal.cfg.flying) {
                    animal.dead = true;
                    s.setVelocity(0, 0);
                    this.tweens.add({
                        targets: s, y: s.y - 90, alpha: 0, duration: 900, ease: 'Quad.easeOut',
                        onComplete: () => s.destroy(),
                    });
                } else {
                    animal.state = 'flee';
                    animal.fleeUntil = this.time.now + 2600;
                }
            }
            this.busyDialog = false;
        });
    }

    /**
     * РАУНД 66.17 (п.11): ОБОБРАТЬ ТУШУ — мясо по размеру зверя.
     * РАУНД 66.70 (приказ 8): обдир — ПРОВЕРКА «ВЫЖИВАНИЯ»:
     * успех — мясо + шкура (у зверей; глухарь — без шкуры);
     * неудача — неловкий обдир (половина мяса, шкура испорчена);
     * крит — мясо ×2 и шкура. Мясо сырое: готовить на костре или продать.
     */
    lootAnimalCorpse(animal) {
        if (this.busyDialog || !animal || !animal.dead) return;
        // Патч 66.73 (приказ 14): изнеможённый герой не в силах разделывать тушу
        if (exhaustedGuardPopup(this, this.registry)) return;
        const player = this.player;
        if (!player) return;
        const hasSkin = animal.cfg.id !== 'bird'; // у глухаря шкуры нет
        // Патч 66.73 (приказ 13): у зверя с ценным лутом крит разделки даёт трофей
        const res = survivalButcher(this.registry, player, animal.cfg.meat, hasSkin,
            animal.cfg.trophy ? { trophy: animal.cfg.trophy } : {});
        // Патч 66.73: обдир туши — охота (голод ×2, −1 ОУ)
        tickTime(this.registry, 10, 'hunt');
        spendFatigue(this.registry, 1);
        const spr = animal.sprite;
        this.animals = this.animals.filter(x => x !== animal);
        this.corpses = this.corpses.filter(x => x !== animal);
        if (spr) spr.destroy();
        if (this.audioManager) this.audioManager.playHeal();
        let msg = tf(t('Обобрал тушу {0}: +{1} сырое мясо (приготовить на костре или продать).'), t(animal.cfg.name), res.meat);
        let float = `+${res.meat} 🥩`;
        if (res.trophy > 0) {
            // Патч 66.73 (приказ 13): критическая удача — ценный трофей (на продажу)
            const trophyDef = getLootDef(animal.cfg.trophy);
            msg += ' ' + tf(t('Критическая удача разделки: в узле ценный трофей — {0} (продать трактирщику или мяснику).'), trophyDef ? t(trophyDef.name) : animal.cfg.trophy);
            float += ` +1 ${trophyDef ? trophyDef.emoji : '🏆'}`;
        }
        if (res.skin > 0) {
            msg = tf(t('Освежевал {0}: +{1} сырое мясо и шкура (Выживание {2}%: бросок {3}).'), t(animal.cfg.name), res.meat, res.skill, res.roll);
            float += ' +1 🟫';
        } else if (res.meat > 0 && animal.cfg.id !== 'bird') {
            msg = tf(t('Неловко ободрал тушу {0} (Выживание {1}%: бросок {2}) — лишь +{3} мясо, шкура порвана.'), t(animal.cfg.name), res.skill, res.roll, res.meat);
        }
        this.showFloatingText(this.playerObj.x, this.playerObj.y - 30, float, '#e8b08a');
        ActionLog.add(this.registry, msg);
        this.updateHUD();
    }

    buildAtmosphere() {
        const { width, height } = this.scale;

        // Вечная лесная мгла (день тут темнее, чем в деревне)
        this.add.rectangle(0, 0, width, height, 0x081408, 0.30)
            .setOrigin(0).setDepth(94).setBlendMode(Phaser.BlendModes.MULTIPLY)
            .setScrollFactor(0);

        // День/ночь поверх мглы
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.dayNightOverlay = this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY).setScrollFactor(0);
        }

        // Световые столбы (лучи сквозь кроны) — только днём управляется альфой
        this.godRays = [];
        for (let i = 0; i < 6; i++) {
            const ray = this.add.rectangle(
                (i + 0.5) * (width / 6) + (i % 2 === 0 ? -30 : 30),
                -40 + (i % 3) * 30,
                22 + (i * 13) % 34, height + 120,
                0xfff2c0, 0.05,
            ).setOrigin(0.5, 0).setAngle(i % 2 === 0 ? 14 : -12)
                .setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setDepth(93);
            this.godRays.push(ray);
            this.tweens.add({
                targets: ray,
                alpha: { from: 0.03, to: 0.08 },
                duration: 2600 + i * 430,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }

        // Клочья тумана — в мировых координатах, медленно дрейфуют
        this.fogPuffs = [];
        for (let i = 0; i < 12; i++) {
            const puff = this.add.image(
                Math.random() * WORLD_W, Math.random() * WORLD_H,
                'fog_puff',
            ).setScale(1.4 + Math.random() * 1.8)
                .setAlpha(0.05 + Math.random() * 0.05)
                .setDepth(96);
            this.tweens.add({
                targets: puff,
                x: puff.x + (Math.random() - 0.5) * 90,
                y: puff.y - 14 - Math.random() * 22,
                duration: 9000 + Math.random() * 7000,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this.fogPuffs.push(puff);
        }

        // Падающая листва — в экранных координатах
        this.leavesEmitter = this.add.particles(0, 0, 'forest_leaf', {
            x: { min: 0, max: width },
            y: -12,
            lifespan: 11000,
            speedY: { min: 16, max: 34 },
            speedX: { min: -9, max: 9 },
            rotate: { min: 0, max: 360 },
            scale: { min: 0.6, max: 1.2 },
            alpha: { start: 0.75, end: 0.25 },
            quantity: 1,
            frequency: 720,
        });
        this.leavesEmitter.setScrollFactor(0);
        this.leavesEmitter.setDepth(98);

        // ----- Погода (раунд 14): дождь/снег в лесу. Осадки поверх листвы (99).
        // В дождь волки хуже слышат — радиус агро срезается (см. wolfAggroRadius).
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 99 });

        // Раунд 28 (п.4): утренний туман в лесу (с рассвета до 9 утра)
        addMorningFog(this, { width: WORLD_W, height: WORLD_H, yMin: 2 * TS, yMax: WORLD_H - 2 * TS, depth: 90 });
        this.wolfAggroRadius = WOLF_CFG.aggroRadius * (isRainy(this.weather) ? 0.65 : 1);

        // Светлячки — проявляются ночью (как в деревне)
        for (let i = 0; i < 9; i++) {
            const fx = (24 + Math.random() * (WORLD_W - 48));
            const fy = (24 + Math.random() * (WORLD_H - 48));
            const f = this.add.image(fx, fy, 'particle_spark')
                .setScale(0.45).setTint(0xd8ffa0).setDepth(97).setVisible(false);
            f.homeX = fx; f.homeY = fy;
            f.phase = Math.random() * Math.PI * 2;
            f.pulseSpeed = 0.002 + Math.random() * 0.0022;
            this.fireflies.push(f);
        }
    }

    buildHUD() {
        const { width, height } = this.scale;

        // Название локации (под кнопками — урок раунда 11)
        this.add.text(12, 34, t('🌲 Тёмный лес') + (this.weather ? `  ${this.weather.icon}` : ''), {
            fontSize: '15px', color: '#9fc08a', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(102);

        // Единый статус-бар (как в деревне)
        this.statusText = this.add.text(12, 10, '', {
            fontSize: '12px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(102);

        // Кнопки справа вверху: [Персонаж] [Инвентарь]
        const btnY = 14, btnW = 70, btnH = 20;
        const charBtnX = width - 220;
        const charBtn = this.add.rectangle(charBtnX, btnY, btnW, btnH, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961).setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(101);
        this.add.text(charBtnX, btnY, t('📜 Персонаж'), {
            fontSize: '11px', color: '#E8DCC4', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        charBtn.on('pointerup', () => {
            this.scene.pause();
            this.scene.launch('Character', { from: 'Forest' });
        });

        const invBtnX = width - 100;
        const invBtn = this.add.rectangle(invBtnX, btnY, btnW, btnH, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961).setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(101);
        this.add.text(invBtnX, btnY, t('🎒 Инвентарь'), {
            fontSize: '11px', color: '#E8DCC4', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        invBtn.on('pointerup', () => {
            this.scene.pause();
            this.scene.launch('Character', { from: 'Forest', tab: 'inventory' });
        });

        // Патч 66.75 (приказы 5–6 владельца): «⚙ Настройки» — панель звука в игре
        addSettingsGearButton(this, width - 160, btnY);

        // Подсказка взаимодействия внизу по центру
        this.prompt = this.add.text(width / 2, height - 22, '', {
            fontSize: '14px', color: '#E8DCC4', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000099', padding: { x: 10, y: 4 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

        // Предупреждение о напуганной стае
        if (this.wolvesScared) {
            this.add.text(width / 2, 60, t('🐺 Стая напугана — волки держатся подальше'), {
                fontSize: '12px', color: '#9fc08a',
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
                backgroundColor: '#00000088', padding: { x: 8, y: 3 },
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        }

        this.updateHUD();

        // Раунд 21: прогулка в лес может закрыть поручение «Заготовить дрова» и т.п.
        onLocationVisited(this.registry, 'forest');
    }

    // ================= ИГРОВОЙ ЦИКЛ =================

    update(time) {
        // Пока открыт диалог — мир ждёт (раунд 21)
        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            this.wolves.forEach(w => w.sprite.setVelocity(0, 0));
            if (this.virtualControls) this.virtualControls.setVisible(false);
            return;
        }

        // Патч 66.46 (приказ 2): тень героя следует за ним каждый кадр
        if (this.sunLight) this.sunLight.updateFollowers();

        const endState = checkGameEnd(this.registry);
        // Раунд 66.16 (гард р.41): защёлка против per-frame шторма переходов
        if (endState) {
            if (!this.__endQueued) { this.__endQueued = true; this.scene.start('End'); }
            return;
        }

        if (this.virtualControls) this.virtualControls.setVisible(true);

        this.movePlayer();
        this.updateWolves(time);
        this.updateAnimals(time);
        this.updateNearestInteractable();
        this.updateHUD();
    }

    movePlayer() {
        const speed = 160;
        let vx = 0, vy = 0;
        const joyMove = this.virtualControls ? this.virtualControls.getMovement() : null;
        if (joyMove) {
            vx = joyMove.x;
            vy = joyMove.y;
        } else {
            if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
            if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
            if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
            if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
        }

        // 66.68 (§9.3, P3): вектор переиспользуется — set() вместо new (см. create)
        const v = this._moveVec.set(vx, vy);
        if (v.length() > 0) {
            v.normalize().scale(speed);
            let dir = this.lastDir;
            if (Math.abs(vy) >= Math.abs(vx)) dir = vy < 0 ? 'up' : 'down';
            else dir = vx < 0 ? 'left' : 'right';

            if (dir !== this.lastDir || !this.playerObj.anims.isPlaying) {
                if (!this.player.useComposite) {
                    this.playerObj.play(`${this.player.sprite || 'player'}_walk_${dir}`, true);
                }
                this.lastDir = dir;
            }
            const now = this.time.now;
            if (now - this.lastStepTime > this.stepInterval) {
                this.audioManager.playStep();
                this.lastStepTime = now;
                // Патч 66.73: шаг по лесу — перемещение (голод ×1.5)
                tickTime(this.registry, 0.25, 'walk');
            }
        } else if (!this.player.useComposite) {
            this.playerObj.anims.pause();
            // 66.68 (§9.3, P3): idle-ключ кэшируется по направлению
            if (this.lastDir !== this._idleKeyDir) {
                this._idleKeyDir = this.lastDir;
                this._idleKey = `${this.player.sprite || 'player'}_idle_${this.lastDir}`;
            }
            this.playerObj.play(this._idleKey, true);
        }
        this.playerObj.setVelocity(v.x, v.y);
        this.playerObj.setDepth(this.playerObj.y / TS);
    }

    updateWolves(time) {
        const p = this.playerObj;
        this.wolves.forEach((wolf) => {
            const s = wolf.sprite;
            if (!s.active) return;
            const dist = Phaser.Math.Distance.Between(s.x, s.y, p.x, p.y);
            const distHome = Phaser.Math.Distance.Between(s.x, s.y, wolf.homeX, wolf.homeY);
            const scared = this.wolvesScared;
            let vx = 0, vy = 0, speed = 0;

            if (scared && dist < 170) {
                // Отступление от человека
                const dx = s.x - p.x, dy = s.y - p.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                vx = dx / len; vy = dy / len;
                speed = WOLF_CFG.retreatSpeed;
                wolf.state = 'retreat';
            } else if (!scared && dist < (this.wolfAggroRadius || WOLF_CFG.aggroRadius) && distHome < WOLF_CFG.homeLeash * 1.5) {
                // Погоня
                const dx = p.x - s.x, dy = p.y - s.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                vx = dx / len; vy = dy / len;
                speed = WOLF_CFG.chaseSpeed;
                wolf.state = 'chase';
            } else if (wolf.state === 'chase' && (dist > WOLF_CFG.loseRadius || distHome > WOLF_CFG.homeLeash)) {
                wolf.state = 'idle';
                wolf.nextThink = 0;
            } else if (wolf.state !== 'chase') {
                // Патруль вокруг логова
                if (time > wolf.nextThink || Phaser.Math.Distance.Between(s.x, s.y, wolf.targetX, wolf.targetY) < 6) {
                    wolf.nextThink = time + 1300 + Math.random() * 2200;
                    // Случайная проходимая точка в радиусе 3 тайлов от логова
                    for (let tries = 0; tries < 8; tries++) {
                        const c = Math.round(wolf.homeX / TS) + Math.floor(Math.random() * 7) - 3;
                        const r = Math.round(wolf.homeY / TS) + Math.floor(Math.random() * 7) - 3;
                        if (!'TtrLbCS'.includes(forestTileAt(c, r))) {
                            wolf.targetX = c * TS + TS / 2;
                            wolf.targetY = r * TS + TS / 2;
                            break;
                        }
                    }
                }
                const dx = wolf.targetX - s.x, dy = wolf.targetY - s.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                if (len > 4) {
                    vx = dx / len; vy = dy / len;
                    speed = WOLF_CFG.patrolSpeed;
                    wolf.state = 'patrol';
                } else {
                    wolf.state = 'idle';
                }
            }

            s.setVelocity(vx * speed, vy * speed);
            if (speed > 0) {
                const dir = Math.abs(vy) >= Math.abs(vx) ? (vy < 0 ? 'up' : 'down') : (vx < 0 ? 'left' : 'right');
                if (dir !== wolf.dir || !s.anims.isPlaying) {
                    s.play(`enemy_wolf_walk_${dir}`, true);
                    wolf.dir = dir;
                }
            } else if (wolf.state === 'idle' && s.anims.isPlaying && !s.anims.currentAnim?.key.includes('idle')) {
                s.play(`enemy_wolf_idle_${wolf.dir}`, true);
            }
            s.setDepth(s.y / TS);
        });
    }

    updateNearestInteractable() {
        const px = Math.floor(this.playerObj.x / TS);
        const py = Math.floor(this.playerObj.y / TS);

        let nearest = null;
        let bestDist = 1.5;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = px + dx, cy = py + dy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= bestDist) continue;

                const g = this.gatherByTile.get(`${cx},${cy}`);
                // Патч 66.74: у кустов ягод и бортей img нет (рисованы в drawForest) —
                // раньше они не доходили до ближайшего действия (ягоды в Тёмном лесу
                // нельзя было собрать со времён 66.70). Пустой img — тоже точка сбора.
                if (g && (!g.img || g.img.visible)) {
                    bestDist = dist;
                    nearest = { type: 'gather', entry: g, label: g.prompt };
                    continue;
                }
                // РАУНД 66.17 (п.11): туша рядом — обобрать мясо
                for (const corpse of this.corpses) {
                    const cc = Math.floor(corpse.sprite.x / TS), cr = Math.floor(corpse.sprite.y / TS);
                    if (cc === cx && cr === cy) {
                        bestDist = dist;
                        nearest = { type: 'loot_animal', animal: corpse, label: tf(t('Обобрать дичь ({0})'), t(corpse.cfg.name)) };
                    }
                }
                // РАУНД 65 (п.5): отдых у костра — ТОЛЬКО в лесу (из деревни удалён)
                const camp = campfirePos();
                if (cx === camp.col && cy === camp.row) {
                    bestDist = dist;
                    nearest = { type: 'campfire', label: t('Костёр: отдых и готовка') };
                    continue;
                }
                if (cx === FOREST_EXIT.col && cy === FOREST_EXIT.row) {
                    bestDist = dist;
                    nearest = { type: 'exit', label: t('Вернуться к околице') };
                }
            }
        }

        // РАУНД 66.17 (п.10): СТРЕЛЬБА — дичь в пределах 2..6.5 тайлов.
        // Лук в узле И экипирован → «Стрелять из лука (Заяц)»; рядом без лука —
        // только подсказка. Приоритет — у ближних действий (сбор/костёр/туша).
        if (!nearest) {
            const player = this.player;
            let shootTarget = null, shootDist = Infinity;
            this.animals.forEach((a) => {
                if (a.dead || !a.sprite.active) return;
                const dTiles = Phaser.Math.Distance.Between(this.playerObj.x, this.playerObj.y, a.sprite.x, a.sprite.y) / TS;
                if (dTiles >= 2 && dTiles <= 6.5 && dTiles < shootDist) {
                    shootDist = dTiles; shootTarget = a;
                }
            });
            if (shootTarget) {
                if (player && player.weaponId === 'bow') {
                    nearest = { type: 'shoot', animal: shootTarget, label: tf(t('Стрелять из лука ({0})'), t(shootTarget.cfg.name)) };
                } else if (shootDist <= 3) {
                    nearest = { type: 'need_bow', animal: shootTarget, label: tf(t('{0} рядом — нужен экипированный лук'), t(shootTarget.cfg.name)) };
                }
            }
        }
        this.nearestInteractable = nearest;

        if (nearest && !this.busyDialog) {
            this.prompt.setText(tf(t('Нажмите E — {0}'), nearest.label)).setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearestInteractable) return;
        const n = this.nearestInteractable;
        ActionLog.add(this.registry, tf(t('Тёмный лес: взаимодействие — {0}.'), n.label));
        if (n.type === 'gather') this.gatherResource(n.entry);
        else if (n.type === 'campfire') this.restAtCampfire();
        else if (n.type === 'exit') this.leaveForest();
        // Патч 66.74 (приказ 1): перед выстрелом — выбор «стрелять / подкрасться»
        else if (n.type === 'shoot') this.showStalkDialog(n.animal);
        else if (n.type === 'loot_animal') this.lootAnimalCorpse(n.animal);
        else if (n.type === 'need_bow') {
            this.busyDialog = true;
            createDialog(this, t('🏹 Без лука'),
                t('Дичь так просто не догнать — нужна стрельба. Лук должен лежать в узле и быть экипирован (Персонаж → Оружие). Луки куёт кузнец Данила.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }], { singleton: false });
        }
    }

    /**
     * ПАТЧ 66.74 (приказ владельца 1): СКРАДЫВАНИЕ ПЕРЕД ВЫСТРЕЛОМ.
     * «Навык: Скрадывание — подкрадывание к дичи (+10 к выстрелу)».
     *  • «Подкрасться» — проверка Скрадывания: успех — следующий выстрел
     *    по этому зверю +10 к шансу (флаг сцены, списывается выстрелом);
     *    провал — зверь чует человека: удирает/взлетает БЕЗ выстрела;
     *  • «Стрелять» — прежний выстрел (5 минут, стрела).
     */
    showStalkDialog(animal) {
        if (this.busyDialog || !animal || animal.dead) return;
        const player = this.player;
        if (!player) return;
        // Гейты лука/колчана — как в shootAnimal (там же тратится время)
        if (player.weaponId !== 'bow') {
            createDialog(this, t('🏹 Без лука'),
                t('Стрелять можно только из лука — и он должен быть экипирован (Персонаж → Оружие). Кузнец Данила кует луки.'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
            return;
        }
        if (getQuiver(player) <= 0) {
            createDialog(this, '🪶 ' + t('Колчан пуст!'),
                t('Стрел в колчане нет — стрелять нечем. Пачку стрел (10 шт.) продают кузнец Данила и ремесленник Аверьян. Стрелы из узла наложи в колчан на экране персонажа (Персонаж → Инвентарь).'),
                [{ text: t('Понятно'), callback: () => {} }], { singleton: false });
            return;
        }
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        createDialog(this, '🏹 ' + t(animal.cfg.name),
            tf(t('{0} ходит рядом, но настороже. Стрелять сразу — или попытаться подкрасться (+10 к выстрелу, при неудаче зверь сорвётся)?'), t(animal.cfg.name)),
            [
                { text: tf(t('🏹 Стрелять из лука ({0})'), t(animal.cfg.name)), callback: () => { close(); this.shootAnimal(animal); } },
                { text: t('🌑 Подкрасться (Скрадывание)'), callback: () => {
                    close();
                    const stealth = getBlessedSkill(this.registry, (player.skills && player.skills.stealth) || 10);
                    const res = skillCheck(stealth);
                    if (res.result === 'fail' || res.result === 'fumble') {
                        ActionLog.add(this.registry, tf(t('Пытался подкрасться к {0} (Скрадывание {1}%: бросок {2}) — зверь чует человека и удирает без выстрела.'), t(animal.cfg.name), stealth, res.roll));
                        this.showFloatingText(animal.sprite.x, animal.sprite.y - 20, t('Упорхнул!'), '#e8cc7a');
                        if (animal.cfg.flying) {
                            animal.dead = true;
                            animal.sprite.setVelocity(0, 0);
                            this.tweens.add({ targets: animal.sprite, y: animal.sprite.y - 90, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => animal.sprite.destroy() });
                        } else {
                            animal.state = 'flee';
                            animal.fleeUntil = this.time.now + 2600;
                        }
                    } else {
                        // Успех: +10 к СЛЕДУЮЩЕМУ выстрелу по этому зверю
                        this.sneakBonus = true;
                        this.showFloatingText(animal.sprite.x, animal.sprite.y - 20, t('Ты в кустах — выстрел вернее (+10)'), '#8adf8a');
                        ActionLog.add(this.registry, tf(t('Подкрался к {0} (Скрадывание {1}%: бросок {2} — успех): следующий выстрел +10 к шансу.'), t(animal.cfg.name), stealth, res.roll));
                    }
                    this.updateHUD();
                } },
                { text: t('Отойти'), callback: close },
            ], { singleton: false });
    }

    /**
     * РАУНД 65 (п.5 приказа): отдых у костра — механика переехала из деревни
     * в лес (старое кострище лесников; раунд 66.11: схрон/лагерь чужаков
     * вырезаны, стоянка нейтральная).
     * РАУНД 66 (п.1 приказа): «ОТДЫХ У КОСТРА МОЖЕТ ТОЛЬКО ПРОМОТАТЬ ВРЕМЯ
     * НА 1 ЧАС» — здоровье и Воля у костра БОЛЬШЕ НЕ ВОССТАНАВЛИВАЮТСЯ,
     * никакой моментальной лечения: присел — час миновал (можно переждать
     * ночь/до утра/до срока). Полное лечение — только ночлег на постоялом
     * дворе и молебен в церкви.
     */
    restAtCampfire() {
        if (this.busyDialog) return;
        const player = this.player || this.registry.get('player');
        if (!player) return;
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        // РАУНД 66.17 (п.8): на костре можно ПРИГОТОВИТЬ сырую рыбу и мясо
        // дичи (по 30 минут за штуку). Приготовленное — полноценная еда:
        // печёная рыба +2 HP, жаркое +3 HP (есть из инвентаря — «Съесть»).
        const fishRaw = countOf(player, 'fish_raw');
        const meatRaw = countOf(player, 'meat_raw');
        // Раунд 66.70 (приказ 3): сырые грибы тоже ГОТОВЯТ на костре (жареные)
        const mushRaw = countOf(player, 'mushroom_raw');
        const cookOpts = [];
        if (fishRaw > 0) {
            cookOpts.push({ text: tf(t('🔥 Приготовить рыбу ({0} мин)'), 30), callback: () => { close(); this.cookAtCampfire('fish_raw'); } });
        }
        if (meatRaw > 0) {
            cookOpts.push({ text: tf(t('🔥 Жарить мясо дичи ({0} мин)'), 30), callback: () => { close(); this.cookAtCampfire('meat_raw'); } });
        }
        if (mushRaw > 0) {
            cookOpts.push({ text: tf(t('🔥 Жарить грибы ({0} мин)'), 30), callback: () => { close(); this.cookAtCampfire('mushroom_raw'); } });
        }
        createDialog(this, t('🔥 Костёр в лесу'),
            t('Тёплый огонь разгоняет лесную мглу. У костра можно пересидеть час — раны он не лечит, только время идёт мимо. На огне можно приготовить сырую рыбу, мясо дичи или грибы (Готовка; при неудаче продукты пропадают).\n\nПересидеть час у костра? (1 час — время +1 час, без лечения.)'),
            [
                { text: t('Присесть у огня (1 час)'), callback: () => {
                    close();
                    this.cameras.main.fadeOut(700, 0, 0, 0);
                    this.time.delayedCall(750, () => {
                        // п.1 раунда 66: ТОЛЬКО промотка времени на 1 час
                        // Патч 66.73: час у костра — отдых (голод ×0.6, ОУ восстанавливаются)
                        tickTime(this.registry, 60, 'rest');
                        restFatigueFull(this.registry);
                        this.registry.set('player', player);
                        this.updateHUD();
                        ActionLog.add(this.registry, t('Пересидел час у костра в лесу — время шло мимо.'));
                        this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, t('Час у костра миновал'), '#b8a88a');
                        this.cameras.main.fadeIn(700, 0, 0, 0);
                    });
                } },
                ...cookOpts,
                { text: t('Не сейчас'), callback: close },
            ]);
    }

    /**
     * РАУНД 66.70 (приказ 9): готовка на костре — ПРОВЕРКА «ГОТОВКИ»:
     * провал — ПРОДУКТЫ ПРОПАЛИ; крит — блюдо сытнее на +1.
     * Правила еды (meal.js) — при «Съесть» из узла.
     */
    cookAtCampfire(rawId) {
        const player = this.player || this.registry.get('player');
        if (!player || countOf(player, rawId) <= 0) return;
        const def = getLootDef(rawId);
        if (!def || !def.cookTo) return;
        const res = cookAtFire(this.registry, player, rawId, { skill: player.skills.cooking });
        const cooked = getLootDef(res.producedId || def.cookTo);
        if (res.lost) {
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 40, t('Продукты пропали!'), '#e88a8a');
            ActionLog.add(this.registry, tf(t('Прогоревал у костра: {0} сгорели (Готовка {1}%: бросок {2}).'), t(def.name).toLowerCase(), res.skill, res.roll));
            this.updateHUD();
            return;
        }
        if (this.audioManager) this.audioManager.playHeal();
        const suffix = res.crit ? ' (+1)' : '';
        this.showFloatingText(this.playerObj.x, this.playerObj.y - 40, `${cooked.emoji} ${t(cooked.name)}${suffix}`, '#ffd9a0');
        ActionLog.add(this.registry, res.crit
            ? tf(t('Пир у костра! {0} → {1} сытнее на +1 (Готовка {2}%: бросок {3} — крит).'), t(def.name), t(cooked.name), res.skill, res.roll)
            : tf(t('Приготовил на костре: {0} → {1} (Готовка {2}%: бросок {3}).'), t(def.name), t(cooked.name), res.skill, res.roll));
        this.updateHUD();
    }

    // ================= МЕХАНИКИ =================

    /**
     * РАУНД 66.70 (приказы 3, 8, 10): СБОР В ЛЕСУ — ПРОВЕРКА «ВЫЖИВАНИЯ».
     *  • добыча НЕ съедается на месте: ягоды/сырые грибы/зверобой идут В УЗЕЛ;
     *  • ягоды затем едят из узла («Съесть» — простая еда +1 HP, meal.js);
     *  • сырые грибы есть НЕЛЬЗЯ — только костёр (жареные грибы) или продажа;
     *  • лестница приказа 10: провал — НИЧЕГО; успех — горсть (2); крит — ×2;
     *  • при провале точка НЕ истощается (куст/грибница на месте — можно
     *    поискать получше, каждая попытка — время);
     *  • при успехе точка истощается до конца игрового дня (как раньше).
     */
    gatherResource(entry) {
        // Патч 66.73 (приказ 14): изнеможённый герой не в силах собирать
        if (exhaustedGuardPopup(this, this.registry)) return;
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const gathered = q.forestGathered || {};

        if (gathered[entry.id] === today) {
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, 'Уже собрано', '#b8a88a');
            return;
        }

        // ПАТЧ 66.74 (приказ 3): БОРТЬ — проверка БОРТНИЧЕСТВА (не Выживания):
        // провал — пчёлы ужалили (−1 HP), точка жива; успех — мёд в узел;
        // крит — мёд ×2 и воск. Раз в игровой день, как прочие точки сбора.
        if (entry.kind === 'bort') {
            const res66 = bortnikGather(this.registry, this.player, { wild: true });
            if (!res66.ok) {
                tickTime(this.registry, 20, 'work');
                spendFatigue(this.registry, 1);
                const stingLine = res66.stung
                    ? t('Пчёлы встретили тумаком: в шею вонзилось жало — минус здоровье.')
                    : t('Рой ходил сердитый — пришлось отступить без мёда.');
                this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, t('Пчёлы!'), '#e8cc7a');
                ActionLog.add(this.registry, tf(t('Лез к борти (Бортничество {0}%: бросок {1}) — впустую.'), res66.skill, res66.roll));
                createDialog(this, t('🐝 Бортное дерево'),
                    tf(t('Дикие пчёлы живут в колоде на старой сосне. {0}\n\n(Бортничество {1}%: бросок {2} — провал.)'), stingLine, res66.skill, res66.roll),
                    [{ text: t('Отойти'), callback: () => {} }], { singleton: false });
                this.updateHUD();
                return;
            }
            gathered[entry.id] = today;
            q.forestGathered = gathered;
            this.registry.set('quest', q);
            tickTime(this.registry, 40, 'work');
            spendFatigue(this.registry, 1);
            if (entry.marker) { entry.marker.destroy(); entry.marker = null; }
            if (this.audioManager) this.audioManager.playHeal();
            const critLine = res66.crit
                ? '\n' + t('Соты сняты чисто, до самого лета — мёда вдвое больше, и воск нашёлся (крит).')
                : '';
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, `+${res66.honey} 🍯`, '#ffd960');
            if (res66.crit) this.showFloatingText(this.playerObj.x, this.playerObj.y - 26, t('Полный сот! (×2 + воск)'), '#ffd9a0');
            ActionLog.add(this.registry, tf(t('Достал мёд из борти: +{0} мёд{1} (Бортничество {2}%: бросок {3}).'), res66.honey, res66.wax > 0 ? ' и воск' : '', res66.skill, res66.roll));
            createDialog(this, t('🐝 Бортное дерево'),
                tf(t('Поднапёк дымом, подрубишь соты ладонью — золотой мёд течёт в туесок. +{0} мёд{1} в узел.\nМёд — простая еда (+1 к здоровью) и товар: главный экспорт Руси.{2}\n\n(Бортничество {3}%: бросок {4} — {5}.)'),
                    res66.honey, res66.wax > 0 ? tf(t(' и {0} воск'), res66.wax) : '', critLine, res66.skill, res66.roll,
                    res66.crit ? t('крит') : t('успех')),
                [{ text: t('Слава Роду и меду!'), callback: () => {} }], { singleton: false });
            this.updateHUD();
            return;
        }

        // ПРОВЕРКА ВЫЖИВАНИЯ (приказы 8, 10; бонус молитвы списывается внутри)
        const res = survivalGather(this.registry, this.player, entry.kind);

        if (res.gathered <= 0) {
            // НЕУДАЧА — ничего не собрал: точка не истощена, время потрачено.
            // Патч 66.73: неудачный сбор — работа (голод ×1.75, −1 ОУ)
            tickTime(this.registry, 15, 'work');
            spendFatigue(this.registry, 1);
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, t('Ничего не собрал'), '#b8a88a');
            ActionLog.add(this.registry, tf(t('Обыскал {0} (Выживание {1}%: бросок {2}) — ничего не нашёл.'), t(entry.label).toLowerCase(), res.skill, res.roll));
            this.updateHUD();
            return;
        }

        // Успех/крит: точка истощается до конца дня.
        gathered[entry.id] = today;
        q.forestGathered = gathered;
        this.registry.set('quest', q);

        const def = getLootDef(res.itemId);
        const minutes = entry.kind === 'herb' ? 8 : 30;
        // Патч 66.73: сбор ягод/грибов/трав — работа (голод ×1.75, −1 ОУ)
        tickTime(this.registry, minutes, 'work');
        spendFatigue(this.registry, 1);

        if (entry.img) entry.img.setVisible(false);
        if (entry.marker) { entry.marker.destroy(); entry.marker = null; }

        if (this.audioManager) this.audioManager.playHeal();
        this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, `+${res.gathered} ${def.emoji}`, '#8adf8a');
        if (res.crit) {
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 26, t('Щедрая находка! (×2)'), '#ffd9a0');
        }
        ActionLog.add(this.registry, tf(t('Собрал {0}: +{1} в узел (Выживание {2}%: бросок {3}).'), t(def.name).toLowerCase(), res.gathered, res.skill, res.roll));
        this.updateHUD();
    }

    startWolfCombat(wolf) {
        if (this.busyDialog || this.time.now < wolf.cooldownUntil) return;
        this.busyDialog = true;
        wolf.cooldownUntil = this.time.now + 4000;
        this.registry.set('forestReturnPos', { x: this.playerObj.x, y: this.playerObj.y });
        // Итерация 66.89 (приказ владельца 16): СТАЯ ВОЛКОВ — нападает не один
        // волк, а 1–3 одновременно (вес: один 45%, пара 35%, тройка 20%).
        // Волчья стая бьёт согласованно — одиночки подбивают к стае.
        const packRoll = Math.random();
        const packSize = packRoll < 0.45 ? 1 : (packRoll < 0.80 ? 2 : 3);
        const enemyKeys = Array.from({ length: packSize }, () => 'wolf');
        if (packSize === 1) {
            ActionLog.add(this.registry, t('Волк напал в Тёмном лесу!'));
        } else {
            ActionLog.add(this.registry, tf(t('НАПАЛА СТАЯ ВОЛКОВ — {0} штуки! Приготовься!'), packSize));
        }
        // Патч 66.73: схватка с волками — охота/бой (голод ×2)
        tickTime(this.registry, 5, 'hunt');
        this.scene.start('Combat', { enemyKeys, fromScene: 'Forest' });
    }

    leaveForest() {
        ActionLog.add(this.registry, t('Вернулся из Тёмного леса к околице.'));
        // Патч 66.73: дорога назад — перемещение (голод ×1.5)
        tickTime(this.registry, 15, 'walk');
        this.scene.start('Fork');
    }

    showFloatingText(x, y, text, color = '#e8cc7a') {
        const t = this.add.text(x, y, text, {
            fontSize: '13px', color, fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(150);
        this.tweens.add({
            targets: t,
            y: y - 34,
            alpha: { from: 1, to: 0 },
            duration: 1600,
            ease: 'Cubic.easeOut',
            onComplete: () => t.destroy(),
        });
    }

    updateHUD() {
        const p = this.player;
        const timeState = getTime(this.registry);
        const villageRep = getVillageRep(this.registry);
        const moneyStr = formatMoney(p.dengas || 0);

        let statusLine = `❤${p.HP}/${p.HPmax}  💰${moneyStr}`;  // 66.71: МР удалён (приказ 7)
        if (timeState) statusLine += `  📅${formatDateTime(timeState)}`;
        // Раунд 66.70 (приказы 1–2): норма еды — 2 трапезы в сутки
        statusLine += `  ${hungerStatusLine(this.registry)}`;
        // Патч 66.73 (приказ 14): усталость в HUD (ОУ = СИЛ+ТЕЛ, BRP SRD)
        statusLine += `  ${fatigueStatusLine(this.registry)}`;
        statusLine += `  ⭐${villageRep > 0 ? '+' : ''}${villageRep}`;
        // Патч 66.80 (п.11-в): лестница статусов — «(подозрительный)» / «(свой)»
        statusLine += villageRepStatusSuffix(this.registry);
        this.statusText.setText(statusLine);

        // День/ночь + светлячки + лучи + кострище
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            if (this.dayNightOverlay) {
                this.dayNightOverlay.setFillStyle(overlay.color, overlay.alpha);
            }
            // Патч 66.46 (приказ 2): ход солнца — тени и тёплый свет
            if (this.sunLight) this.sunLight.update(timeState);
            const h = timeState.hour;
            let dark = 0;
            if (h >= 21 || h < 5) dark = 1;
            else if (h >= 18) dark = (h - 18) / 3;
            else if (h < 8) dark = (8 - h) / 3;

            // Светлячки — ночные, как в деревне
            const now = this.time.now;
            this.fireflies.forEach((f) => {
                if (dark <= 0.35) {
                    f.setVisible(false);
                    return;
                }
                f.setVisible(true);
                const pulse = 0.35 + 0.55 * Math.sin(now * f.pulseSpeed + f.phase);
                f.setAlpha(dark * Math.max(0, pulse));
                f.x = f.homeX + Math.sin(now * 0.0011 + f.phase) * 24;
                f.y = f.homeY + Math.cos(now * 0.0009 + f.phase * 1.7) * 16;
            });

            // Днём лучи ярче, ночью почти гаснут; светлячки и мгла усиливаются
            const day = 1 - dark;
            if (this.godRays) this.godRays.forEach(r => r.setAlpha(0.02 + day * 0.05));
            if (this.fogPuffs) this.fogPuffs.forEach(fg => fg.setAlpha(0.04 + dark * 0.09));
            if (this.campGlow) this.campGlow.setAlpha(0.10 + dark * 0.22);
        }
    }
}

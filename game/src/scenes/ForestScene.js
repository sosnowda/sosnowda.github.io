// Тёмный лес — ходячая локация за околицей (§5.1 роадмапа, раунд 13).
// Волки патрулируют у логовищ, на агрессию реагируют погоней; контакт → бой (Combat).
// Сбор грибов/ягод/зверобоя (раз в игровой день), разбойничий тайник с засадой,
// выход к околице. Атмосфера: туман, световые столбы, падающая листва, светлячки.
// Phaser загружен глобально через CDN
import {
    FOREST_COLS, FOREST_ROWS, FOREST_SPAWN, FOREST_EXIT,
    WOLF_DENS, WOLF_CFG, FOREST_STASH,
    forestGatherSpots, stashPos, campfirePos, forestTileAt,
    validateForestMap,
} from '../data/forest.js';
import { tickTime, getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { applyWeatherVisuals, isRainy } from '../systems/Weather.js';
import { addMorningFog } from '../systems/AmbientFX.js';
import { checkGameEnd, chaseTicksLeft } from '../data/thief.js';
import { onLocationVisited } from '../data/questGenerator.js';
import { ActionLog } from '../data/actionLog.js';
import { dayKeyOf } from '../data/daily.js'; // раунд 66.10: daily вместо удалённого chests.js
import { createDialog } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { formatMoney } from '../systems/Character.js';
import { getVillageRep } from '../data/reputation.js';
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
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
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
        this.fireflies = [];
        this.busyDialog = false;
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = 350;

        this.drawForest();
        this.spawnGatherSpots();
        this.spawnStashAndCamp();
        this.drawExitMarker();
        this.spawnPlayer();
        this.spawnWolves();
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
                '🍄 Грибы, ягоды и зверобой восстанавливают здоровье (раз в игровой день).\n' +
                '💰 В брошенном лагере разбойников (северо-запад) зарыт тайник — но они возвращаются…\n' +
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
                }

                // --- Физическое тело для непроходимых ---
                if ('TtrLbCS'.includes(t)) {
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
            } else if (spot.kind === 'berry') {
                // Куст уже нарисован в drawForest — тут только искра
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
                    .setScale(0.5).setDepth(0.6).setTint(spot.kind === 'herb' ? 0xffe9a0 : SPARK_TINT);
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

    spawnStashAndCamp() {
        const q = this.registry.get('quest') || {};
        const camp = campfirePos();
        const stash = stashPos();

        // Кострище брошенного лагеря — РАУНД 65 (п.5): в деревне костра нет,
        // отдых переехал СЮДА. РАУНД 66 (п.1): отдых = ТОЛЬКО промотка
        // времени на 1 час, без лечения (пламя горит, свет тлеет).
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

        // Тайник под корягой
        const sx = stash.col * TS + TS / 2;
        const sy = stash.row * TS + TS / 2;
        this.stashImg = this.add.image(sx, sy + 6, 'deco_stash_mound').setScale(TS / 32).setDepth(0.25);
        this.stashMarker = null;
        if (!q.forestStashOpened) {
            this.stashMarker = this.add.image(sx, sy - 14, 'particle_spark')
                .setScale(0.65).setDepth(0.6).setTint(0xffc040);
            this.tweens.add({
                targets: this.stashMarker,
                y: sy - 22,
                alpha: { from: 1, to: 0.35 },
                duration: 850,
                yoyo: true,
                repeat: -1,
            });
        } else {
            this.stashImg.setTint(0x8a7a60);
        }
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
        this.playerObj.setScale(TS / 32 * 0.75);
        // Честный хитбокс (урок раунда 7): кадр 64×64, тело 24×24 в центре
        if (this.playerObj.body) this.playerObj.body.setSize(24, 24, true);
        this.playerObj.setCollideWorldBounds(true);
        this.physics.add.collider(this.playerObj, this.solids);
        this.playerObj.setDepth(this.playerObj.y / TS);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // Тень под ногами
        this.add.ellipse(pos.x, pos.y + 14, 22, 8, 0x000000, 0.3).setDepth(0.05);
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

        const endState = checkGameEnd(this.registry);
        if (endState) {
            this.scene.start('End');
            return;
        }

        if (this.virtualControls) this.virtualControls.setVisible(true);

        this.movePlayer();
        this.updateWolves(time);
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

        const v = new Phaser.Math.Vector2(vx, vy);
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
                tickTime(this.registry, 0.25);
            }
        } else if (!this.player.useComposite) {
            this.playerObj.anims.pause();
            this.playerObj.play(`${this.player.sprite || 'player'}_idle_${this.lastDir}`, true);
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
                if (g && g.img && g.img.visible) {
                    bestDist = dist;
                    nearest = { type: 'gather', entry: g, label: g.prompt };
                    continue;
                }
                const stash = stashPos();
                if (cx === stash.col && cy === stash.row && this.stashMarker) {
                    bestDist = dist;
                    nearest = { type: 'stash', label: t('Обыскать тайник разбойников') };
                    continue;
                }
                // РАУНД 65 (п.5): отдых у костра — ТОЛЬКО в лесу (из деревни удалён)
                const camp = campfirePos();
                if (cx === camp.col && cy === camp.row) {
                    bestDist = dist;
                    nearest = { type: 'campfire', label: t('Отдохнуть у костра (1 час)') };
                    continue;
                }
                if (cx === FOREST_EXIT.col && cy === FOREST_EXIT.row) {
                    bestDist = dist;
                    nearest = { type: 'exit', label: t('Вернуться к околице') };
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
        else if (n.type === 'stash') this.openStash();
        else if (n.type === 'campfire') this.restAtCampfire();
        else if (n.type === 'exit') this.leaveForest();
    }

    /**
     * РАУНД 65 (п.5 приказа): отдых у костра — механика переехала из деревни
     * в лес (кострище брошенного лагеря).
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
        createDialog(this, t('🔥 Костёр в лесу'),
            t('Тёплый огонь разгоняет лесную мглу. У костра можно только пересидеть час — раны он не лечит, только время идёт мимо.\n\nПересидеть час у костра? (1 час — время +1 час, без лечения.)'),
            [
                { text: t('Присесть у огня (1 час)'), callback: () => {
                    close();
                    this.cameras.main.fadeOut(700, 0, 0, 0);
                    this.time.delayedCall(750, () => {
                        // п.1 раунда 66: ТОЛЬКО промотка времени на 1 час
                        tickTime(this.registry, 60);
                        this.registry.set('player', player);
                        this.updateHUD();
                        ActionLog.add(this.registry, t('Пересидел час у костра в лесу — время шло мимо.'));
                        this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, t('Час у костра миновал'), '#b8a88a');
                        this.cameras.main.fadeIn(700, 0, 0, 0);
                    });
                } },
                { text: t('Не сейчас'), callback: close },
            ]);
    }

    // ================= МЕХАНИКИ =================

    gatherResource(entry) {
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const gathered = q.forestGathered || {};

        if (gathered[entry.id] === today) {
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, 'Уже собрано', '#b8a88a');
            return;
        }
        gathered[entry.id] = today;
        q.forestGathered = gathered;
        this.registry.set('quest', q);

        // Съедено на месте: лечение
        const p = this.player;
        const heal = Math.min(entry.hp, p.HPmax - p.HP);
        p.HP += heal;
        this.registry.set('player', p);

        if (entry.img) entry.img.setVisible(false);
        if (entry.marker) { entry.marker.destroy(); entry.marker = null; }

        if (this.audioManager) this.audioManager.playHeal();
        this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, entry.floatText, '#8adf8a');
        if (heal > 0) {
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 26, `+${heal} ❤`, '#8adf8a');
        }
        ActionLog.add(this.registry, entry.actionLog);
        tickTime(this.registry, 8);
        this.updateHUD();
    }

    openStash() {
        const q = this.registry.get('quest') || {};
        if (q.forestStashOpened) {
            this.showFloatingText(this.stashImg.x, this.stashImg.y - 16, 'Пусто', '#b8a88a');
            return;
        }
        q.forestStashOpened = true;
        this.registry.set('quest', q);

        const money = Phaser.Math.Between(FOREST_STASH.moneyMin, FOREST_STASH.moneyMax);
        const p = this.player;
        p.dengas = (p.dengas || 0) + money;
        this.registry.set('player', p);

        if (this.stashMarker) { this.stashMarker.destroy(); this.stashMarker = null; }
        this.stashImg.setTint(0x8a7a60);

        if (this.audioManager) this.audioManager.playLevelUp();
        this.showFloatingText(this.stashImg.x, this.stashImg.y - 18, `+${money} 💰`, '#e8cc7a');
        ActionLog.add(this.registry, tf(t('Обыскал разбойничий тайник в лесу: +{0} денег.'), money));
        tickTime(this.registry, 10);

        // Засада: разбойник вернулся в лагерь
        if (Math.random() < FOREST_STASH.ambushChance) {
            this.busyDialog = true;
            this.time.delayedCall(700, () => {
                createDialog(this, t('Тёмный лес'), t(FOREST_STASH.ambushText), [{
                    text: t('Драться!'),
                    callback: () => {
                        this.busyDialog = false;
                        this.registry.set('forestReturnPos', { x: this.playerObj.x, y: this.playerObj.y });
                        ActionLog.add(this.registry, t('Засада у тайника: бой с разбойником.'));
                        tickTime(this.registry, 5);
                        // Раунд 40 (QA-фикс): переход в бой — на следующий кадр
                        this.time.delayedCall(0, () => {
                            this.scene.start('Combat', { enemyKeys: ['bandit'], fromScene: 'Forest' });
                        });
                    },
                }], { singletonKey: 'forest-ambush' });
            });
        }
        this.updateHUD();
    }

    startWolfCombat(wolf) {
        if (this.busyDialog || this.time.now < wolf.cooldownUntil) return;
        this.busyDialog = true;
        wolf.cooldownUntil = this.time.now + 4000;
        this.registry.set('forestReturnPos', { x: this.playerObj.x, y: this.playerObj.y });
        ActionLog.add(this.registry, t('Волк напал в Тёмном лесу!'));
        tickTime(this.registry, 5);
        this.scene.start('Combat', { enemyKeys: ['wolf'], fromScene: 'Forest' });
    }

    leaveForest() {
        ActionLog.add(this.registry, t('Вернулся из Тёмного леса к околице.'));
        tickTime(this.registry, 15);
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
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const villageRep = getVillageRep(this.registry);
        const moneyStr = formatMoney(p.dengas || 0);

        let statusLine = `❤${p.HP}/${p.HPmax}  ✦${p.MP}/${p.MPmax}  💰${moneyStr}`;
        if (timeState) statusLine += `  📅${formatDateTime(timeState)}`;
        statusLine += `  ⭐${villageRep > 0 ? '+' : ''}${villageRep}`;
        this.statusText.setText(statusLine);

        // День/ночь + светлячки + лучи + кострище
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            if (this.dayNightOverlay) {
                this.dayNightOverlay.setFillStyle(overlay.color, overlay.alpha);
            }
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

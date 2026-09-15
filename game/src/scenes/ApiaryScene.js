// Пасека — ходячая локация за околицей (раунд 16, по образцу Тёмного леса).
// Лесная поляна с рядами колодных ульев: мёд лечит (+5 ❤, раз в игровой день
// с улья). Пчёлы активны днём в тёплую погоду: сбор без дымокура может
// разозлить рой (бой «Рой пчёл»). Дымокур (40 игровых минут тления) делает
// сбор безопасным. Зимой/в дождь/ночью пчёлы спят — мёда меньше (+2 ❤), но
// рой не атакует. Выход к околице — на юге.
// Phaser загружен глобально через CDN
import {
    APIARY_COLS, APIARY_ROWS, APIARY_SPAWN, APIARY_EXIT,
    APIARY_CFG, apiaryHives, smudgePos, hutPos, apiaryTileAt,
    validateApiaryMap, beesActive,
} from '../data/apiary.js';
import { tickTime, getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { applyWeatherVisuals, getWeather } from '../systems/Weather.js';
import { checkGameEnd } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { dayKeyOf } from '../data/chests.js';
import { createDialog } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { formatMoney } from '../systems/Character.js';
import { getVillageRep } from '../data/reputation.js';
import { t, tf, tk } from '../systems/i18n.js';

const TS = 48;   // как в деревне/лесу — мир 1248×960, камера скроллится
const WORLD_W = APIARY_COLS * TS;
const WORLD_H = APIARY_ROWS * TS;

// Тёплое золото медовых искр
const HONEY_SPARK = 0xffc84a;

export class ApiaryScene extends Phaser.Scene {
    constructor() {
        super('Apiary');
    }

    init(data) {
        this.from = (data && data.from) || 'Fork';
        // Возврат после боя — вернуть игрока туда, где он встал
        this.returnPos = this.registry.get('apiaryReturnPos') || null;
        this.registry.set('apiaryReturnPos', null);
    }

    create() {
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.audioManager.playSceneMusic('village');

        // ----- QA-валидация проходимости (как в лесу/деревне) -----
        const validation = validateApiaryMap();
        if (validation.problems.length) {
            console.warn('[Пасека] Проблемы проходимости:', validation.problems);
        }

        this.cameras.main.setBackgroundColor(0x16240f);
        this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

        this.solids = this.physics.add.staticGroup();
        this.hiveEntries = [];
        this.hiveByTile = new Map();
        this.ambientBees = [];
        this.smokePuffs = [];
        this.fireflies = [];
        this.busyDialog = false;
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = 350;

        this.weather = getWeather(this.registry);

        this.drawApiary();
        this.spawnHives();
        this.spawnSmudgeAndHut();
        this.drawExitMarker();
        this.spawnPlayer();
        this.spawnAmbientBees();
        this.buildAtmosphere();
        this.buildHUD();

        // ----- Управление -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
        this.input.keyboard.on('keydown-F1', () => this.showHelpDialog());
        this.input.keyboard.on('keydown-ESC', () => this.scene.start('Title'));
        this.virtualControls = new VirtualControls(this);
    }

    showHelpDialog() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        createDialog(this, '🐝 ' + t('Пасека'),
            tk('apiary.help.body',
                'Управление: WASD/стрелки — движение, E/пробел — действие, ESC — меню.\n\n' +
                '🍯 Мёд из колодных ульев лечит (+5 ❤), раз в игровой день с каждого улья.\n' +
                '💨 Сначала разожги дымокур у избушки: с дымящей лучиной пчёлы не тронут.\n' +
                '🐝 Без дыма пчёлы могут кинуться роем — придётся драться или бежать.\n' +
                '❄️ Зимой, в дождь и ночью пчёлы спят: собирать безопасно, но мёда меньше.\n' +
                '◀ Выход к околице — на юге у кромки леса.'),
            [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
            { singletonKey: 'apiary-help' });
    }

    // ================= ОТРИСОВКА =================

    drawApiary() {
        for (let y = 0; y < APIARY_ROWS; y++) {
            for (let x = 0; x < APIARY_COLS; x++) {
                const tile = apiaryTileAt(x, y);
                const px = x * TS + TS / 2;
                const py = y * TS + TS / 2;

                // --- Земля: солнечная поляна, к краям — лесная тень ---
                let groundTex;
                if (tile === 'f') {
                    groundTex = `tile_forest_dense_${(x * 5 + y * 3) % 2}`;
                } else {
                    groundTex = `tile_grass_${(x * 7 + y * 13) % 4}`;
                }
                const ground = this.add.image(px, py, this.textures.exists(groundTex) ? groundTex : 'tile_grass_0');
                ground.setScale(TS / 32);
                // Кромка леса темнее (первые 2 и последние 2 ряда, колонки по бокам)
                const edge = (x < 2 || y < 2 || x >= APIARY_COLS - 2 || y >= APIARY_ROWS - 4);
                if (edge) ground.setTint(0xc4d2b2);

                // --- Куртины на ',' ---
                if (tile === ',' && this.textures.exists('deco_grass_tuft')) {
                    this.add.image(px + (x % 3 - 1) * 6, py + 4, 'deco_grass_tuft')
                        .setScale(TS / 32).setDepth(0.1).setAlpha(0.9);
                }

                // --- Цветы на 'w' (пчёлы кружат и тут) ---
                if (tile === 'w') {
                    const fl = `deco_flower_${(x * 3 + y * 5) % 3}`;
                    if (this.textures.exists(fl)) {
                        this.add.image(px, py + 6, fl).setScale(TS / 32 * 1.15).setDepth(0.15);
                    }
                }

                // --- Высокие объекты (Y-сортировка) ---
                if (tile === 'T') {
                    const jx = ((x * 37 + y * 61) % 13) - 6;
                    const canopy = this.add.image(px + jx, py + 9 + jx * 0.4, `tile_forest_dense_${(x + y) % 2}`);
                    canopy.setScale(TS / 32 * 1.5);
                    canopy.setDepth(y + 0.6);
                } else if (tile === 't') {
                    const jx = ((x * 53 + y * 29) % 11) - 5;
                    const canopy = this.add.image(px + jx, py + 3, `tile_forest_${(x * 3 + y) % 2}`);
                    canopy.setScale(TS / 32 * 1.2);
                    canopy.setDepth(y + 0.55);
                } else if (tile === 'r') {
                    const rock = this.add.image(px, py + 6, this.textures.exists('tile_rock_0') ? 'tile_rock_0' : groundTex);
                    rock.setScale(TS / 32 * 1.1).setDepth(y + 0.5);
                } else if (tile === 'H') {
                    // Избушка пасечника: рисуем один раз (на первой букве H)
                    if (!this.hutDrawn) {
                        this.hutDrawn = true;
                        const hut = hutPos();
                        const hx = hut.col * TS + TS / 2 + TS * 0.5;
                        const hy = hut.row * TS + TS / 2;
                        this.add.ellipse(hx, hut.row * TS + TS - 6, TS * 2.1, TS * 0.62, 0x000000, 0.25)
                            .setDepth(hut.row + 0.35);
                        const img = this.add.image(hx, hy - TS * 0.35, 'deco_house_0')
                            .setDisplaySize(TS * 2.1, TS * 1.9)
                            .setDepth(hut.row + 0.5);
                        img.setData('hut', true);
                    }
                }

                // --- Физическое тело для непроходимых ---
                if ('TtrUHF'.includes(tile)) {
                    const solid = this.solids.create(px, py, 'tile_grass_0');
                    solid.setScale(TS / 32).refreshBody();
                    solid.setVisible(false);
                }
            }
        }
    }

    spawnHives() {
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const gathered = q.apiaryGathered || {};

        apiaryHives().forEach((hive) => {
            const px = hive.col * TS + TS / 2;
            const py = hive.row * TS + TS / 2;

            // Улей стоит на подставке-камушках (псевдо-глубина)
            const img = this.add.image(px, py + 2, 'deco_hive').setScale(TS / 32 * 1.25);
            img.setDepth(hive.row + 0.4);
            const taken = gathered[hive.id] === today;

            // Медовая искра над нетронутыми ульями
            let marker = null;
            if (!taken) {
                marker = this.add.image(px, py - TS * 0.75, 'particle_spark')
                    .setScale(0.55).setDepth(hive.row + 0.6).setTint(HONEY_SPARK);
                this.tweens.add({
                    targets: marker,
                    y: py - TS * 0.75 - 7,
                    alpha: { from: 0.95, to: 0.35 },
                    duration: 850 + (hive.col * 41 + hive.row * 67) % 300,
                    yoyo: true,
                    repeat: -1,
                });
            } else {
                img.setTint(0xb09868);  // опустошённый улей чуть тусклее
            }

            const entry = { ...hive, img, marker };
            this.hiveEntries.push(entry);
            this.hiveByTile.set(`${hive.col},${hive.row}`, entry);
        });
    }

    spawnSmudgeAndHut() {
        const s = smudgePos();
        const sx = s.col * TS + TS / 2;
        const sy = s.row * TS + TS / 2;

        this.smudgeBase = this.add.image(sx, sy + 6, 'deco_smudge').setScale(TS / 32 * 1.15).setDepth(s.row + 0.3);
        // Пламя (тлеет только когда дымокур зажжён) — Sprite, чтобы играть анимацию
        this.smudgeFlame = null;
        if (this.textures.exists('campfire_flame_0')) {
            this.smudgeFlame = this.add.sprite(sx, sy - 6, 'campfire_flame_0')
                .setScale(TS / 32 * 0.9).setDepth(s.row + 0.5).setVisible(false);
            if (!this.anims.exists('smudge_burn')) {
                // Костровых кадров только три (0..2) — фильтруем по существованию
                const flameFrames = [0, 1, 2, 3].filter(f => this.textures.exists(`campfire_flame_${f}`));
                this.anims.create({
                    key: 'smudge_burn',
                    frames: flameFrames.map(f => ({ key: `campfire_flame_${f}`, frame: 0 })),
                    frameRate: 7,
                    repeat: -1,
                });
            }
        }
        // Тёплый отсвет углей
        this.smudgeGlow = this.add.ellipse(sx, sy + 8, 40, 16, 0xff8a30, 0.0)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(s.row + 0.31);

        // Тик дыма: когда дымокур тлеет — поднимаются клубы (как трубы в деревне)
        this.time.addEvent({
            delay: 480,
            loop: true,
            callback: () => {
                if (!this.isSmoked() || this.smokePuffs.length > 8) return;
                const puff = this.add.image(sx + Phaser.Math.Between(-6, 6), sy - 10, 'particle_dust')
                    .setScale(0.5).setAlpha(0.35).setTint(0xd8d2c4).setDepth(s.row + 0.6);
                this.smokePuffs.push(puff);
                this.tweens.add({
                    targets: puff,
                    y: puff.y - 46 - Math.random() * 20,
                    x: puff.x + Phaser.Math.Between(-14, 14),
                    scale: 1.25,
                    alpha: 0,
                    duration: 2400,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        const i = this.smokePuffs.indexOf(puff);
                        if (i >= 0) this.smokePuffs.splice(i, 1);
                        puff.destroy();
                    },
                });
            },
        });
        this.smudgeSmokeOrigin = { x: sx, y: sy };
    }

    drawExitMarker() {
        const px = APIARY_EXIT.col * TS + TS / 2;
        const py = APIARY_EXIT.row * TS + TS / 2;
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
            x: APIARY_SPAWN.col * TS + TS / 2,
            y: APIARY_SPAWN.row * TS + TS / 2,
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

    // ================= ПЧЁЛЫ-ДЕКОРАЦИИ =================

    spawnAmbientBees() {
        if (!this.textures.exists('deco_bee')) return;
        this.hiveEntries.forEach((hive) => {
            for (let i = 0; i < APIARY_CFG.ambientBeesPerHive; i++) {
                const bx = hive.col * TS + TS / 2;
                const by = hive.row * TS + TS / 2;
                const bee = this.add.image(bx, by, 'deco_bee')
                    .setScale(1.6).setDepth(hive.row + 0.7).setVisible(false);
                this.ambientBees.push({
                    img: bee,
                    hx: bx, hy: by - 14,
                    rx: 14 + ((i * 13 + hive.col * 7) % 12),
                    ry: 6 + ((i * 11 + hive.row * 5) % 8),
                    speed: 0.0012 + ((i * 17 + hive.col * 3) % 10) * 0.00018,
                    phase: (i * 2.1 + hive.col + hive.row) % (Math.PI * 2),
                    // Часть пчёл летает к ближайшим цветам
                    wander: (i === 0),
                });
            }
        });
    }

    updateAmbientBees(now) {
        const active = beesActive(getTime(this.registry), this.weather);
        this.ambientBees.forEach((b) => {
            if (!active) {
                b.img.setVisible(false);
                return;
            }
            b.img.setVisible(true);
            const t = now * b.speed + b.phase;
            // Часть пчёл то у улья, то на цветах рядом (медленный «рейс»)
            const drift = b.wander ? Math.sin(t * 0.23) * TS * 0.9 : 0;
            b.img.x = b.hx + Math.cos(t) * (b.rx + drift);
            b.img.y = b.hy + Math.sin(t * 1.7) * (b.ry + drift * 0.4);
            // Крылышки-мерцание
            b.img.setFlipX(Math.cos(t) < 0);
        });
    }

    buildAtmosphere() {
        const { width, height } = this.scale;

        // Поляна светлее леса — лёгкая дымка кромки
        this.add.rectangle(0, 0, width, height, 0x0a140a, 0.16)
            .setOrigin(0).setDepth(94).setBlendMode(Phaser.BlendModes.MULTIPLY)
            .setScrollFactor(0);

        // День/ночь поверх дымки
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.dayNightOverlay = this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY).setScrollFactor(0);
        }

        // Лучи солнца — 3 штуки, мягче лесных
        this.godRays = [];
        for (let i = 0; i < 3; i++) {
            const ray = this.add.rectangle(
                (i + 0.5) * (width / 3) + (i % 2 === 0 ? -20 : 20),
                -40 + (i % 2) * 20,
                26 + (i * 17) % 30, height + 120,
                0xfff2c0, 0.05,
            ).setOrigin(0.5, 0).setAngle(i % 2 === 0 ? 10 : -9)
                .setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setDepth(93);
            this.godRays.push(ray);
            this.tweens.add({
                targets: ray,
                alpha: { from: 0.03, to: 0.075 },
                duration: 2800 + i * 500,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }

        // Летняя пыльца/мошка — золотые искры медленно плывут
        this.pollenEmitter = this.add.particles(0, 0, 'particle_spark', {
            x: { min: 0, max: width },
            y: { min: height * 0.2, max: height + 10 },
            lifespan: 9000,
            speedY: { min: -14, max: -5 },
            speedX: { min: -8, max: 12 },
            scale: { min: 0.2, max: 0.45 },
            alpha: { start: 0.55, end: 0 },
            quantity: 1,
            frequency: 420,
            tint: 0xffe9a0,
        });
        this.pollenEmitter.setScrollFactor(0);
        this.pollenEmitter.setDepth(97);

        // Пара клочьев тумана на рассвете (тише лесного)
        this.fogPuffs = [];
        for (let i = 0; i < 5; i++) {
            const puff = this.add.image(
                Math.random() * WORLD_W, Math.random() * WORLD_H,
                'fog_puff',
            ).setScale(1.2 + Math.random() * 1.4)
                .setAlpha(0.04)
                .setDepth(96);
            this.tweens.add({
                targets: puff,
                x: puff.x + (Math.random() - 0.5) * 70,
                duration: 11000 + Math.random() * 6000,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this.fogPuffs.push(puff);
        }

        // ----- Погода (раунд 14): дождь/снег на пасеке. В осадки пчёлы спят -----
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 99 });

        // Светлячки — ночные
        for (let i = 0; i < 7; i++) {
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
        this.add.text(12, 34, t('🐝 Пасека') + (this.weather ? `  ${this.weather.icon}` : ''), {
            fontSize: '15px', color: '#d8c078', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(102);

        // Сводка состояния пчёл/дымокура (обновляется в updateHUD)
        this.beeHint = this.add.text(12, 54, '', {
            fontSize: '11px', color: '#c8b890',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(102);

        // Единый статус-бар (как в деревне/лесу)
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
            this.scene.launch('Character', { from: 'Apiary' });
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
            this.scene.launch('Character', { from: 'Apiary', tab: 'inventory' });
        });

        // Подсказка взаимодействия внизу по центру
        this.prompt = this.add.text(width / 2, height - 22, '', {
            fontSize: '14px', color: '#E8DCC4', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000099', padding: { x: 10, y: 4 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

        this.updateHUD();
    }

    // ================= СОСТОЯНИЕ ПЧЕЛ =================

    nowMinutes() {
        const ts = getTime(this.registry);
        return ts ? ts.day * 1440 + ts.hour * 60 + ts.minute : 0;
    }

    isSmoked() {
        const q = this.registry.get('quest') || {};
        return (q.apiarySmokeUntilMin || 0) > this.nowMinutes();
    }

    beesCalm() {
        const q = this.registry.get('quest') || {};
        return (q.beesCalmUntilMin || 0) > this.nowMinutes();
    }

    // ================= ИГРОВОЙ ЦИКЛ =================

    update(time) {
        const endState = checkGameEnd(this.registry);
        if (endState) {
            this.scene.start('End');
            return;
        }

        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            if (this.virtualControls) this.virtualControls.setVisible(false);
            return;
        }
        if (this.virtualControls) this.virtualControls.setVisible(true);

        this.movePlayer();
        this.updateAmbientBees(time);
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

                const h = this.hiveByTile.get(`${cx},${cy}`);
                if (h && h.marker) {
                    bestDist = dist;
                    nearest = { type: 'hive', entry: h, label: h.prompt };
                    continue;
                }
                const s = smudgePos();
                if (cx === s.col && cy === s.row) {
                    bestDist = dist;
                    nearest = {
                        type: 'smudge',
                        label: this.isSmoked() ? t('Подложить веток в дымокур') : t('Разжечь дымокур'),
                    };
                    continue;
                }
                if (cx === APIARY_EXIT.col && cy === APIARY_EXIT.row) {
                    bestDist = dist;
                    nearest = { type: 'exit', label: t('Вернуться к околице') };
                }
            }
        }
        this.nearestInteractable = nearest;

        if (nearest && !this.busyDialog) {
            this.prompt.setText(tf('Нажмите E — {0}', nearest.label)).setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearestInteractable) return;
        const n = this.nearestInteractable;
        ActionLog.add(this.registry, `Пасека: взаимодействие — ${n.label}.`);
        if (n.type === 'hive') this.harvestHive(n.entry);
        else if (n.type === 'smudge') this.lightSmudge();
        else if (n.type === 'exit') this.leaveApiary();
    }

    // ================= МЕХАНИКИ =================

    harvestHive(entry) {
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const gathered = q.apiaryGathered || {};

        if (gathered[entry.id] === today) {
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, t('Уже собрано'), '#b8a88a');
            return;
        }

        // ----- Рой: пчёлы активны, дыма нет, рой не разогнан → шанс атаки -----
        const active = beesActive(timeState, this.weather);
        if (active && !this.isSmoked() && !this.beesCalm()
            && Math.random() < APIARY_CFG.swarmChance) {
            this.busyDialog = true;
            this.registry.set('apiaryReturnPos', { x: this.playerObj.x, y: this.playerObj.y });
            ActionLog.add(this.registry, 'Пчёлы подняли рой — жадность без дымокура наказуема!');
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, '🐝 ' + t('Рой поднялся!'), '#ffb060');
            tickTime(this.registry, 5);
            this.time.delayedCall(650, () => {
                this.scene.start('Combat', { enemyKeys: ['bees'], fromScene: 'Apiary' });
            });
            return;
        }

        // ----- Сбор: безопасен (дым/покой/сон пчёл) -----
        gathered[entry.id] = today;
        q.apiaryGathered = gathered;
        this.registry.set('quest', q);

        const p = this.player;
        const heal = Math.min(
            active ? APIARY_CFG.honeyHeal : APIARY_CFG.honeyHealDormant,
            p.HPmax - p.HP,
        );
        p.HP += heal;
        this.registry.set('player', p);

        if (entry.marker) { entry.marker.destroy(); entry.marker = null; }
        if (entry.img) entry.img.setTint(0xb09868);

        if (this.audioManager) this.audioManager.playHeal();
        if (heal > 0) {
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, `🍯 +${heal} ❤`, '#e8cc7a');
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 26, `+${heal} ❤`, '#8adf8a');
        } else {
            this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, t('🍯 Мёд собран (раны уже перевязаны)'), '#e8cc7a');
        }
        ActionLog.add(this.registry,
            (active ? 'Добыл мёд из колодного улья под дымом.' : 'Добыл спящий мёд — пчёлы не проснулись.'));
        tickTime(this.registry, APIARY_CFG.harvestMin);
        this.updateHUD();
    }

    lightSmudge() {
        const q = this.registry.get('quest') || {};
        const wasLit = this.isSmoked();
        q.apiarySmokeUntilMin = this.nowMinutes() + APIARY_CFG.smokeDurationMin;
        this.registry.set('quest', q);

        if (this.audioManager) this.audioManager.playLevelUp();
        this.showFloatingText(
            this.smudgeSmokeOrigin.x, this.smudgeSmokeOrigin.y - 18,
            wasLit ? t('💨 Дым свежий (40 мин)') : t('💨 Дымокур разожжён (40 мин)'),
            '#c8d8b0',
        );
        ActionLog.add(this.registry,
            (wasLit ? 'Подложил веток в дымокур на пасеке.' : 'Разжёг дымокур на пасеке — пчёлы станут смирными.'));
        tickTime(this.registry, wasLit ? 2 : APIARY_CFG.lightCostMin);
        this.updateHUD();
    }

    leaveApiary() {
        ActionLog.add(this.registry, 'Вернулся с пасеки к околице.');
        tickTime(this.registry, 15);
        this.scene.start('Fork');
    }

    showFloatingText(x, y, text, color = '#e8cc7a') {
        const ft = this.add.text(x, y, text, {
            fontSize: '13px', color, fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(150);
        this.tweens.add({
            targets: ft,
            y: y - 34,
            alpha: { from: 1, to: 0 },
            duration: 1600,
            ease: 'Cubic.easeOut',
            onComplete: () => ft.destroy(),
        });
    }

    updateHUD() {
        const p = this.player;
        const timeState = getTime(this.registry);
        const villageRep = getVillageRep(this.registry);
        const moneyStr = formatMoney(p.dengas || 0);

        let statusLine = `❤${p.HP}/${p.HPmax}  ✦${p.MP}/${p.MPmax}  💰${moneyStr}`;
        if (timeState) statusLine += `  📅${formatDateTime(timeState)}`;
        statusLine += `  ⭐${villageRep > 0 ? '+' : ''}${villageRep}`;
        this.statusText.setText(statusLine);

        // ----- Сводка пчёл/дымокура -----
        if (this.beeHint) {
            const q = this.registry.get('quest') || {};
            const active = beesActive(timeState, this.weather);
            let hint = '';
            if (this.isSmoked()) {
                const left = (q.apiarySmokeUntilMin || 0) - this.nowMinutes();
                hint += `💨 ${tf('дымокур: ещё {0} мин', left)}   `;
                if (active && !this.beesCalm()) hint += `🐝 ${t('под дымом пчёлы смирны')}   `;
            } else if (this.beesCalm()) {
                hint += `🐝 ${t('рой разогнан')}   `;
            } else if (!active) {
                hint += `💤 ${t('пчёлы спят')}   `;
            } else {
                hint += `🐝 ${t('пчёлы активны — без дыма опасно')}   `;
            }
            this.beeHint.setText(hint.trim());
        }

        // ----- День/ночь: светлячки, лучи, дымокур -----
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

            const day = 1 - dark;
            if (this.godRays) this.godRays.forEach(r => r.setAlpha(0.02 + day * 0.05));
            if (this.fogPuffs) this.fogPuffs.forEach(fg => fg.setAlpha(0.03 + dark * 0.08));
            if (this.pollenEmitter) this.pollenEmitter.setAlpha(day > 0.3 ? 1 : 0.25);

            // Пламя/отсвет дымокура: живёт только пока тлеет
            const lit = this.isSmoked();
            if (this.smudgeFlame) {
                if (lit && !this.smudgeFlame.visible) this.smudgeFlame.play('smudge_burn');
                if (!lit && this.smudgeFlame.visible) this.smudgeFlame.stop();
                this.smudgeFlame.setVisible(lit);
            }
            if (this.smudgeGlow) {
                this.smudgeGlow.setAlpha(lit ? (0.14 + dark * 0.22) : 0);
            }
        }
    }
}

// Пасека — ходячая локация за околицей (раунд 16; раунд 17 — пчёлы ТОЛЬКО
// как антураж и анимации: ни боя с роем, ни добычи мёда, ни дымокура-
// механики — по прямому указанию владельца). Поляна с колодными ульями:
// пчёлы кружат орбитами, над ульями «кипят» анимированные рои-мерцания,
// дымокур у избушки мирно тлеет, светлячки/пыльца/погода живут как раньше.
// Выход к околице — на юге.
// Phaser загружен глобально через CDN
import {
    APIARY_COLS, APIARY_ROWS, APIARY_SPAWN, APIARY_EXIT,
    APIARY_CFG, apiaryHives, smudgePos, hutPos, apiaryTileAt,
    validateApiaryMap, beesActive,
} from '../data/apiary.js';
import { tickTime, getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { applyWeatherVisuals, getWeather } from '../systems/Weather.js';
import { checkGameEnd, searchLocation, getHuntState, isChaseActive, isThiefAt, presentThiefEncounter } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createDialog, createButton } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { formatMoney } from '../systems/Character.js';
import { getVillageRep } from '../data/reputation.js';
import { t, tf, tk } from '../systems/i18n.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import { findNpc, getNpcDisplayName } from '../data/npcNames.js';
import { getNpcsAtPlace, NPC_DIALOGUE, pickOutdoorLine } from '../data/npcPresence.js';
import { getNpcSpriteKey } from '../systems/NpcLpc.js';
import { addMorningFog } from '../systems/AmbientFX.js';
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine, TALK_MINUTES } from '../systems/WorldClock.js';

const TS = 48;   // как в деревне/лесу — мир 1248×960, камера скроллится
const WORLD_W = APIARY_COLS * TS;
const WORLD_H = APIARY_ROWS * TS;

// Наблюдательные заметки о пчёлах (чистый антураж, E у улья)
const HIVE_NOTES = [
    '🐝 Ровный тёплый гул — улей живёт своим ладом.',
    '🐝 Пчёлы возвращаются с взятком: лапки в золотой пыльце.',
    '🐝 У летка дежурит сторожевая пчела — принюхивается к каждому.',
    '🐝 Восковые соты пахнут мёдом и сухой липой.',
    '🐝 Две пчелы танцуют на плашке — показывают, где цветы.',
];

export class ApiaryScene extends Phaser.Scene {
    constructor() {
        super('Apiary');
    }

    init(data) {
        this.from = (data && data.from) || 'Fork';
        // Раунд 20 (слияние Пасек): пасека — ЕДИНАЯ сцена. С режима охоты на вора
        // сюда можно попасть из развилки — поиск следов прямо на ходячей локации.
        this.hunt = !!(data && data.hunt);
        // Возврат после боя — вернуть игрока туда, где он встал
        this.returnPos = this.registry.get('apiaryReturnPos') || null;
        this.registry.set('apiaryReturnPos', null);
    }

    create() {
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.dialogue = new DialogueRunner(this);
        // Раунд 31 (пп.11,12): мировые часы идут реальным временем (в диалогах стоят)
        attachWorldClock(this);
        attachChurchBells(this, { volume: 0.45 });
        this.audioManager.playSceneMusic('village');
        // Раунд 24: эмбиент леса — птицы днём, сверчки ночью
        const fsTime = getTime(this.registry);
        const fsHour = fsTime ? fsTime.hour : 12; // раунд 31: фикс .hours → .hour
        this.audioManager.setAmbient((fsHour >= 21 || fsHour < 5)
            ? 'ambient_forest_night'
            : 'ambient_forest_day');

        // ----- QA-валидация проходимости (как в лесу/деревне) -----
        const validation = validateApiaryMap();
        if (validation.problems.length) {
            console.warn('[Пасека] Проблемы проходимости:', validation.problems);
        }

        this.cameras.main.setBackgroundColor(0x16240f);
        this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

        // Раунд 20: бесконечная трава за границами мира (пасека) —
        // при RESIZE окно бывает шире мира, иначе по краям пустота фона.
        if (this.textures.exists('tile_grass_0')) {
            const pad = 2000;
            const back = this.add.tileSprite(-pad, -pad, WORLD_W + pad * 2, WORLD_H + pad * 2, 'tile_grass_0')
                .setOrigin(0, 0).setDepth(-10);
            back.setTileScale(1.5, 1.5);
        }

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

        // ----- Режим охоты на вора (раунд 20/21): поиск следов на пасеке -----
        if (this.hunt) {
            this.buildHuntUI();
        }

        // ----- ВСТРЕЧА С ВОРОМ (раунд 21): вор на пасеке — игрок видит его сразу -----
        if (isThiefAt(this.registry, 'apiary')) {
            this.time.delayedCall(400, () => {
                const px = this.playerObj ? this.playerObj.x + 110 : WORLD_W / 2;
                const py = this.playerObj ? this.playerObj.y : WORLD_H / 2;
                presentThiefEncounter(this, 'apiary', { x: px, y: py });
            });
        }
    }

    buildHuntUI() {
        const { width, height } = this.scale;
        const state = getHuntState(this.registry);
        const chaseActive = isChaseActive(this.registry);
        const alreadySearched = state.locationsSearched.includes('apiary');

        // Раунд 42 (QA-фикс): счётчик действий рисуем ТОЛЬКО при активной погоне —
        // после победы/поражения охота окончена, и красное «Действий: 0»
        // над пасекой сбивало с толку (прогулка ≠ охота).
        if (!chaseActive) return;

        // Раунд 66.12 (приказ владельца №6): счётчик часов до побега вора СКРЫТ —
        // игрок не видит, сколько вору осталось. Внутренний счётчик работает как прежде.

        if (alreadySearched) {
            this.add.text(width / 2, height - 170, t('Ты уже прочитал следы в этой местности.\nНовых здесь не найти.'), {
                fontSize: '14px', color: '#c8b890', align: 'center',
                fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
                backgroundColor: '#000000aa', padding: { x: 10, y: 6 },
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            return;
        }

        // Кнопка поиска (низ-центр, между джойстиком и кнопкой E).
        // Раунд 20 ФИКС: камера пасеки СКРОЛИТСЯ за игроком — кнопка обязана
        // быть привязана к экрану (scrollFactor 0), иначе «уплывает» с камерой.
        const searchBtn = createButton(this, width / 2, height - 90,
            tf('{0} (проверка Внимательности)', t('🔍 Искать следы')),
            () => this.doHuntSearch(),
            {
                backgroundColor: 0x4a6a4a, hoverColor: 0x5a7a5a, pressColor: 0x2a3a2a,
                textColor: '#f0e6c8', fontSize: 15,
                padding: { left: 20, right: 20, top: 10, bottom: 10 },
                cornerRadius: 8,
            });
        searchBtn.setScrollFactor(0);
        searchBtn.each ? searchBtn.list.forEach(o => o.setScrollFactor && o.setScrollFactor(0)) : null;
    }

    /** Поиск следов вора на пасеке (та же логика, что в LocationScene, раунд 21). */
    doHuntSearch() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        const result = searchLocation(this.registry, 'apiary');
        // Раунд 66.12 (приказ владельца №6): отсчёт до побега вора скрыт из UI

        if (result.thiefEscaped) {
            this.time.delayedCall(1500, () => this.scene.start('End'));
            return;
        }

        const title = result.found ? t('✨ Следы найдены!') : t('🔍 Поиск следов');
        createDialog(this, title, result.message, [
            {
                text: t('Продолжить'),
                callback: () => {
                    this.busyDialog = false;
                    this.scene.restart({ from: this.from, hunt: true });
                },
            },
        ], {
            singleton: false,
            portraitKey: 'portrait_narrator',
            typing: true,
            typingSpeed: 30,
        });
    }

    showHelpDialog() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        createDialog(this, '🐝 ' + t('Пасека'),
            timeRatioInfoLine() + '\n\n' +
            tk('apiary.help.body',
                'Управление: WASD/стрелки — движение, E/пробел — действие, ESC — меню.\n\n' +
                '🐝 Пасека — тихое место: пчёлы кружат над ульями и цветами.\n' +
                '👀 Подойди к улью и понаблюдай за пчёлами (E) — они заняты своим делом.\n' +
                '💨 У избушки мирно тлеет дымокур — просто антураж, трогать не нужно.\n' +
                '❄️ Зимой, в дождь и ночью пчёлы спят — пасека затихает до утра.\n' +
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
                    // Раунд 66 (п.10): пасека — деревья из пака владельца
                    const jx = ((x * 37 + y * 61) % 13) - 6;
                    const apIdx = (x * 5 + y * 11);
                    const apTex = (apIdx % 3 === 0)
                        ? `deco_tree_${apIdx % 5}`
                        : `deco_pine_${apIdx % 2}`;
                    if (this.textures.exists(apTex)) {
                        this.add.image(px + jx, py + 12 + jx * 0.4, apTex)
                            .setScale(1.5).setOrigin(0.5, 0.92).setDepth(y + 0.6);
                    } else {
                        const canopy = this.add.image(px + jx, py + 9 + jx * 0.4, `tile_forest_dense_${(x + y) % 2}`);
                        canopy.setScale(TS / 32 * 1.5);
                        canopy.setDepth(y + 0.6);
                    }
                } else if (tile === 't') {
                    const jx = ((x * 53 + y * 29) % 11) - 5;
                    const ap2Idx = (x * 3 + y * 7);
                    const ap2Tex = (ap2Idx % 3 === 0)
                        ? `deco_tree_${ap2Idx % 5}`
                        : `deco_pine_${ap2Idx % 2}`;
                    if (this.textures.exists(ap2Tex)) {
                        this.add.image(px + jx, py + 6, ap2Tex)
                            .setScale(1.05).setOrigin(0.5, 0.92).setDepth(y + 0.55);
                    } else {
                        const canopy = this.add.image(px + jx, py + 3, `tile_forest_${(x * 3 + y) % 2}`);
                        canopy.setScale(TS / 32 * 1.2);
                        canopy.setDepth(y + 0.55);
                    }
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
        const hives = apiaryHives();
        hives.forEach((hive) => {
            const px = hive.col * TS + TS / 2;
            const py = hive.row * TS + TS / 2;

            // Улей стоит на подставке-камушках (псевдо-глубина)
            const img = this.add.image(px, py + 2, 'deco_hive').setScale(TS / 32 * 1.25);
            img.setDepth(hive.row + 0.4);

            const entry = { ...hive, img };
            this.hiveEntries.push(entry);
            this.hiveByTile.set(`${hive.col},${hive.row}`, entry);
        });

        // ----- Раунд 17: анимированные рои-мерцания над первыми ульями -----
        // Те же процедурные кадры, что раньше рисовались в бою, теперь живут
        // на пасеке: «кипящий» облачок пчёл над летком. Чистый антураж.
        this.swarmShimmers = [];
        if (this.textures.exists('bees_combat_0')) {
            if (!this.anims.exists('bees_swarm')) {
                const frames = [0, 1, 2, 1].filter(f => this.textures.exists(`bees_combat_${f}`));
                this.anims.create({
                    key: 'bees_swarm',
                    frames: frames.map(f => ({ key: `bees_combat_${f}`, frame: 0 })),
                    frameRate: 8,
                    repeat: -1,
                });
            }
            hives.slice(0, APIARY_CFG.swarmShimmers).forEach((hive, i) => {
                const sh = this.add.sprite(
                    hive.col * TS + TS / 2 + (i % 2 === 0 ? -6 : 8),
                    hive.row * TS - 10,
                    'bees_combat_0',
                ).setScale(1.5).setAlpha(0.55).setDepth(hive.row + 0.75);
                sh.play('bees_swarm');
                // Рой медленно «дышит» — чуть смещается вокруг летка
                this.tweens.add({
                    targets: sh,
                    x: sh.x + (i % 2 === 0 ? 7 : -7),
                    y: sh.y - 5,
                    duration: 2600 + i * 700,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
                this.swarmShimmers.push(sh);
            });
        }
    }

    spawnSmudgeAndHut() {
        const s = smudgePos();
        const sx = s.col * TS + TS / 2;
        const sy = s.row * TS + TS / 2;

        this.smudgeBase = this.add.image(sx, sy + 6, 'deco_smudge').setScale(TS / 32 * 1.15).setDepth(s.row + 0.3);
        // Тёплый отсвет углей — дымокур тлеет ПОСТОЯННО (антураж, раунд 17)
        this.smudgeGlow = this.add.ellipse(sx, sy + 8, 40, 16, 0xff8a30, 0.12)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(s.row + 0.31);

        // Тик дыма: мирные клубы поднимаются от тлеющих веток (как трубы в деревне)
        this.time.addEvent({
            delay: 700,
            loop: true,
            callback: () => {
                if (this.smokePuffs.length > 6) return;
                const puff = this.add.image(sx + Phaser.Math.Between(-6, 6), sy - 10, 'particle_dust')
                    .setScale(0.5).setAlpha(0.3).setTint(0xd8d2c4).setDepth(s.row + 0.6);
                this.smokePuffs.push(puff);
                this.tweens.add({
                    targets: puff,
                    y: puff.y - 42 - Math.random() * 18,
                    x: puff.x + Phaser.Math.Between(-14, 14),
                    scale: 1.2,
                    alpha: 0,
                    duration: 2600,
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

        // ----- Раунд 27 (пп.6,8): ЖИТЕЛИ НА ПАСЕКЕ -----
        // Пасечник Тарас (и иногда Марфа с травами) — по системе присутствия.
        this.drawApiaryNpcs();
    }

    /**
     * Раунд 27: NPC по расписанию (npcPresence.js) — пасечник(и) у избушки.
     * Клик — разговор (полное дерево диалога или короткая реплика).
     */
    drawApiaryNpcs() {
        const here = getNpcsAtPlace(this.registry, 'apiary');
        const hut = hutPos();
        const baseX = hut.col * TS + TS / 2 + TS * 0.5;
        const baseY = hut.row * TS + TS / 2 + TS * 1.6;
        here.slice(0, 2).forEach((npcId, i) => {
            const npcData = findNpc(this.registry, npcId);
            const displayName = npcData ? getNpcDisplayName(this.registry, npcId) : npcId;
            const spriteKey = getNpcSpriteKey(this, this.registry, npcId);
            const x = baseX + i * 44;
            const y = baseY + i * 14;
            const spr = this.add.sprite(x, y, this.textures.exists(spriteKey) ? spriteKey : 'npc_elder')
                .setScale(TS / 32 * 0.85).setDepth(y / TS);
            const animKey = `${spr.texture.key}_idle_down`;
            if (this.anims.exists(animKey)) spr.play(animKey);
            this.tweens.add({
                targets: spr,
                y: { from: y, to: y - 3 },
                duration: 1500 + i * 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this.add.text(x, y + 30, displayName, {
                fontSize: '12px', color: '#E8DCC4',
                backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(y / TS + 0.1);
            this.add.text(x, y - 30, t('💬 Нажми, чтобы поговорить'), {
                fontSize: '10px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(y / TS + 0.1);
            spr.setInteractive({ useHandCursor: true });
            spr.on('pointerdown', (pointer) => {
                if (!pointer.leftButtonDown() || this.busyDialog) return;
                this.busyDialog = true;
                const dId = NPC_DIALOGUE[npcId];
                if (dId) {
                    this.dialogue.run(dId, () => { this.busyDialog = false; });
                } else {
                    const line = pickOutdoorLine(this.registry, npcId, t('Занят(а) работой на пасеке.'));
                    // Раунд 58 (п.1): разговор с НПЦ — 10 минут (было 1 час, раунд 31)
                    createDialog(this, displayName, line, [
                        { text: t('Продолжить'), callback: () => { this.busyDialog = false; } },
                    ], {
                        singleton: true,
                        portraitKey: (npcData && npcData.portrait) || 'portrait_villager_f',
                        talkMinutes: TALK_MINUTES,
                        talkKey: npcId + '@' + Math.floor(Date.now() / 90000),
                    });
                }
            });
        });
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
        // Рои-мерцания над ульями видны только при бодрствующих пчёлах
        if (this.swarmShimmers) {
            this.swarmShimmers.forEach(sh => sh.setVisible(active));
        }
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

        // Раунд 28 (п.4): утренний туман на пасеке (с рассвета до 9 утра)
        addMorningFog(this, { width: WORLD_W, height: WORLD_H, yMin: 2 * TS, yMax: WORLD_H - 2 * TS, depth: 90 });

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

    // ================= ИГРОВОЙ ЦИКЛ =================

    update(time) {
        // Пока открыт диалог — мир ждёт (раунд 21: не даём End перебить
        // финальный диалог встречи с вором)
        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            if (this.virtualControls) this.virtualControls.setVisible(false);
            return;
        }

        const endState = checkGameEnd(this.registry);
        // Раунд 66.16 (гард р.41): защёлка против per-frame шторма переходов
        if (endState) {
            if (!this.__endQueued) { this.__endQueued = true; this.scene.start('End'); }
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
                // Раунд 22 (п.5): 1 минута за шаг (было 0.25) — время течёт
                // и во время ходьбы по пасеке (счётчик вора тикает)
                tickTime(this.registry, 1);
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
                if (h) {
                    bestDist = dist;
                    nearest = { type: 'hive', entry: h, label: h.prompt };
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
            this.prompt.setText(tf(t('Нажмите E — {0}'), nearest.label)).setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearestInteractable) return;
        const n = this.nearestInteractable;
        if (n.type === 'hive') this.observeHive(n.entry);
        else if (n.type === 'exit') this.leaveApiary();
    }

    // ================= МЕХАНИКИ =================

    // Наблюдение за ульем — чистый антураж (раунд 17: ни мёда, ни риска).
    observeHive(entry) {
        const note = t(HIVE_NOTES[
            (entry.col * 7 + entry.row * 13 + (this.hiveNoteIdx = (this.hiveNoteIdx || 0) + 1)) % HIVE_NOTES.length
        ]);
        this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, note, '#e8cc7a');
        ActionLog.add(this.registry, t('Пасека: наблюдал за пчёлами у колодного улья.'));
        tickTime(this.registry, 2);
        this.updateHUD();
    }

    leaveApiary() {
        ActionLog.add(this.registry, t('Вернулся с пасеки к околице.'));
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

        // Раунд 46 (п.8 заявки): из статус-бара удалён «✦MP» (Воля — в свитке персонажа)
        let statusLine = `❤${p.HP}/${p.HPmax}  💰${moneyStr}`;
        if (timeState) statusLine += `  📅${formatDateTime(timeState)}`;
        statusLine += `  ⭐${villageRep > 0 ? '+' : ''}${villageRep}`;
        this.statusText.setText(statusLine);

        // ----- Сводка состояния пасеки (безопасно: пчёлы — только антураж) -----
        if (this.beeHint) {
            const active = beesActive(timeState, this.weather);
            this.beeHint.setText(active
                ? `🐝 ${t('пчёлы кружат над ульями')}`
                : `💤 ${t('пчёлы спят')}`);
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

            // Отсвет углей дымокура: тлеет постоянно, ночью светит ярче
            if (this.smudgeGlow) {
                this.smudgeGlow.setAlpha(0.08 + dark * 0.2);
            }
        }
    }
}

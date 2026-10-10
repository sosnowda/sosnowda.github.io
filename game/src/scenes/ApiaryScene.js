// Пасека — ходячая локация за околицей (раунд 16). Поляна с колодными ульями:
// пчёлы кружат орбитами, над ульями «кипят» анимированные рои-мерцания,
// дымокур у избушки мирно тлеет, светлячки/пыльца/погода живут как раньше.
// Выход к околице — на юге.
// ПАТЧ 66.74 (приказ 3 владельца): БОРТНИЧЕСТВО — улей стал точкой добычи:
// раз в день с улья можно доставать мёд (крит — мёд ×2 и воск); прежний
// запрет «пчёлы только антураж» (66.11) отменён ПРЯМЫМ приказом владельца.
// Phaser загружен глобально через CDN
import {
    APIARY_COLS, APIARY_ROWS, APIARY_SPAWN, APIARY_EXIT,
    APIARY_CFG, apiaryHives, smudgePos, hutPos, apiaryTileAt,
    validateApiaryMap, beesActive,
} from '../data/apiary.js';
import { tickTime, getTime } from '../systems/TimeSystem.js';
import { getWeather } from '../systems/Weather.js';
import { searchLocation, getHuntState, isChaseActive, isThiefAt, presentThiefEncounter } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
// Патч 66.74 (приказ 3): БОРТНИЧЕСТВО на ульях — мёд и воск (loot.js)
import { bortnikGather, getLootDef } from '../systems/loot.js';
import { dayKeyOf } from '../data/daily.js';
import { createDialog, createButtonRow } from '../utils/ui.js';
// §12.3 (66.96): базовый класс outdoor-локаций — общий create/движение/HUD
import { OutdoorLocationBase } from '../systems/OutdoorLocationBase.js';
import { t, tf, tk } from '../systems/i18n.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import { findNpc, getNpcDisplayName } from '../data/npcNames.js';
import { getNpcsAtPlace, NPC_DIALOGUE, pickOutdoorLine } from '../data/npcPresence.js';
import { getNpcSpriteKey } from '../systems/NpcLpc.js';
// 66.37: калибровка масштаба мировых листов персонажей 128px (были 64)
import { WORLD_K } from '../systems/WorldLook.js';
import { timeRatioInfoLine, TALK_MINUTES } from '../systems/WorldClock.js';

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

export class ApiaryScene extends OutdoorLocationBase {
    constructor() {
        // §12.3 (66.96): конфиг пасеки — в базовом классе (шаг 1 мин —
        // раунд 22 п.5, был в клоне movePlayer; атмосфера — в клоне
        // buildAtmosphere; общее теперь в OutdoorLocationBase)
        super('Apiary', {
            stepTickMinutes: 1,
            bellsVolume: 0.45,
            bgColor: 0x16240f,
            returnPosKey: 'apiaryReturnPos',
            spawn: APIARY_SPAWN,
            exit: APIARY_EXIT,
        });
        this.worldCols = APIARY_COLS;
        this.worldRows = APIARY_ROWS;
    }

    init(data) {
        // Раунд 20 (слияние Пасек): пасека — ЕДИНАЯ сцена. С режима охоты на вора
        // сюда можно попасть из развилки — поиск следов прямо на ходячей локации.
        this.hunt = !!(data && data.hunt);
        this.outdoorInit(data);
    }

    create() {
        this.createOutdoorCore();
    }

    // ===== КРЮКИ СОЗДАНИЯ МИРА (общая последовательность — в базе) =====

    validateMap() {
        return validateApiaryMap();
    }

    beforeWorld() {
        this.dialogue = new DialogueRunner(this);
        this.hiveEntries = [];
        this.hiveByTile = new Map();
        this.ambientBees = [];
        this.smokePuffs = [];
        this.weather = getWeather(this.registry);
    }

    /** Тени деревьев и ульёв (патч 66.46) — кастеры света пасеки. */
    attachSunCasters() {
        this.sunLight.addCaster(() => {
            const pts = [];
            for (let y = 0; y < APIARY_ROWS; y++) {
                for (let x = 0; x < APIARY_COLS; x++) {
                    const tc = apiaryTileAt(x, y);
                    if (tc === 'T') {
                        const jx = ((x * 37 + y * 61) % 13) - 6;
                        pts.push({ x: x * TS + TS / 2 + jx, y: y * TS + TS * 1.02, rx: 15, ry: 5, k: 0.95 });
                    } else if (tc === 't') {
                        const jx = ((x * 53 + y * 29) % 11) - 5;
                        pts.push({ x: x * TS + TS / 2 + jx, y: y * TS + TS * 0.84, rx: 11, ry: 4, k: 0.7 });
                    }
                }
            }
            (this.hiveEntries || []).forEach(hv => {
                if (hv && hv.img && hv.img.scene) pts.push({ x: hv.img.x, y: hv.img.y + 12, rx: 11, ry: 4, k: 0.8 });
            });
            return pts;
        });
    }

    /** Ульи + дымокур с избушкой. */
    spawnWorldObjects() {
        this.spawnHives();
        this.spawnSmudgeAndHut();
    }

    /** Жители пасеки рядом с точкой входа (раунд 27). */
    onPlayerSpawned() {
        this.drawApiaryNpcs();
    }

    /** Пчёлы-антураж после героя. */
    afterSpawn() {
        this.spawnAmbientBees();
    }

    /** Хвост create: охота на вора + встреча с вором (раунд 20/21). */
    createTail() {
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

        // Кнопка поиска (низ экрана, единый ряд активностей — 66.89 п.1).
        // Раунд 20 ФИКС: камера пасеки СКРОЛИТСЯ за игроком — кнопка обязана
        // быть привязана к экрану (scrollFactor 0), иначе «уплывает» с камерой.
        createButtonRow(this, [
            {
                text: tf('{0} (проверка Внимательности)', t('🔍 Искать следы')),
                cb: () => this.doHuntSearch(),
                bg: 0x4a6a4a, hover: 0x5a7a5a, textColor: '#f0e6c8',
                fontSize: 15, padding: { left: 20, right: 20, top: 10, bottom: 10 },
            },
        ], { depth: 102, marginBottom: 8, gap: 12 });
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

    drawWorld() {   // крюк базового класса (бывш. drawApiary)
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
                .setScale(TS / 32 * 0.85 * WORLD_K).setDepth(y / TS);
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

    // ===== КРЮКИ АТМОСФЕРЫ/HUD/ЦИКЛА (общее — в OutdoorLocationBase) =====

    /** Летняя пыльца/мошка — базовый класс зовёт между лучами и туманом. */
    atmoMid() {
        const { width, height } = this.scale;
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
    }

    /** Заголовок локации (иконку погоды добавит базовый класс). */
    hudTitle() {
        return { text: t('🐝 Пасека'), color: '#d8c078' };
    }

    /** Сводка состояния пчёл/дымокура (текст обновляется в updateHUD). */
    hudExtras() {
        this.beeHint = this.add.text(12, 54, '', {
            fontSize: '11px', color: '#c8b890',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(102);
    }

    /** Локальные актёры кадра: пчёлы-орбиты + рои-мерцания. */
    updateActors(time) {
        this.updateAmbientBees(time);
    }

    updateHUD() {
        // Сводка пасеки — как раньше, вне блока даты (beesActive терпит null)
        if (this.beeHint) {
            const active = beesActive(getTime(this.registry), this.weather);
            this.beeHint.setText(active
                ? `🐝 ${t('пчёлы кружат над ульями')}`
                : `💤 ${t('пчёлы спят')}`);
        }
        // §12.3 (66.96): общее ядро HUD — в OutdoorLocationBase.updateHUDCommon
        this.updateHUDCommon();
    }

    /** Пыльца днём ярче; отсвет углей дымокура — ночью ярче. */
    afterHudCommon(dark, day) {
        if (this.pollenEmitter) this.pollenEmitter.setAlpha(day > 0.3 ? 1 : 0.25);
        // Отсвет углей дымокура: тлеет постоянно, ночью светит ярче
        if (this.smudgeGlow) {
            this.smudgeGlow.setAlpha(0.08 + dark * 0.2);
        }
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
                    // Патч 66.74: при живых пчёлах улей — точка добычи мёда
                    const honeyNow = beesActive(getTime(this.registry), this.weather);
                    nearest = { type: 'hive', entry: h, label: honeyNow ? t('Достать мёд из улья (Бортничество)') : h.prompt };
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

    /**
     * Улей: ПАТЧ 66.74 (приказ 3) — БОРТНИЧЕСТВО.
     *  • пчёлы активны (день, без дождя/снега, не зима) и улей не обчищен
     *    сегодня → проверка Бортничества: провал — рой сердит, мёда нет;
     *    успех — +2 мёд в узел; крит — +4 мёд И +1 воск;
     *  • пчёлы спят/зима/дождь → прежнее наблюдение (антураж).
     * Попытка — 20 минут, усталость −1.
     */
    observeHive(entry) {
        const timeState = getTime(this.registry);
        const beesOn = beesActive(timeState, this.weather);
        const q = this.registry.get('quest') || {};
        const today = dayKeyOf(timeState);
        const gathered = q.apiaryGathered || {};

        if (beesOn && gathered[entry.id] !== today) {
            const res = bortnikGather(this.registry, this.player, { wild: false });
            tickTime(this.registry, 20, 'work');
            if (!res.ok) {
                ActionLog.add(this.registry, tf(t('Подходил к улью с туеском (Бортничество {0}%: бросок {1}) — рой ходил сердитый, пришлось отступить.'), res.skill, res.roll));
                this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, t('Рой сердит!'), '#e8cc7a');
            } else {
                gathered[entry.id] = today;
                q.apiaryGathered = gathered;
                this.registry.set('quest', q);
                const def = getLootDef('honey');
                ActionLog.add(this.registry, tf(t('Достал мёд из улья на пасеке: +{0} мёд{1} (Бортничество {2}%: бросок {3}).'), res.honey, res.wax > 0 ? ' и воск' : '', res.skill, res.roll));
                this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, `+${res.honey} 🍯`, '#ffd960');
                if (res.crit) this.showFloatingText(this.playerObj.x, this.playerObj.y - 26, t('Полный сот! (×2 + воск)'), '#ffd9a0');
                if (this.audioManager) this.audioManager.playHeal();
            }
            this.registry.set('player', this.player);
            this.updateHUD();
            return;
        }

        // Прежнее наблюдение (пчёлы спят или улей уже обчищен сегодня)
        const note = t(HIVE_NOTES[
            (entry.col * 7 + entry.row * 13 + (this.hiveNoteIdx = (this.hiveNoteIdx || 0) + 1)) % HIVE_NOTES.length
        ]);
        this.showFloatingText(entry.col * TS + TS / 2, entry.row * TS - 6, beesOn ? note : t('🐝 Ульи тихи: пчёлы не летают'), '#e8cc7a');
        ActionLog.add(this.registry, t('Пасека: наблюдал за пчёлами у колодного улья.'));
        tickTime(this.registry, 2);
        this.updateHUD();
    }

    leaveApiary() {
        ActionLog.add(this.registry, t('Вернулся с пасеки к околице.'));
        // Патч 66.73: дорога — перемещение (голод ×1.5)
        tickTime(this.registry, 15, 'walk');
        this.scene.start('Fork');
    }

}

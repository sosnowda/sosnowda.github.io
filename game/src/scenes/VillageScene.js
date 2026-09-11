// Деревня-оверхорлд: хаб с зданиями, воротами, сменой дня/ночи.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import {
    buildMap, SOLID, tileTexture, doorInteriorId, isGate,
    PLAYER_START, MAP_W, MAP_H, getVillageName,
} from '../data/world.js';
import { BUILDINGS, VILLAGE_GATE, INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { Tutorial } from '../systems/Tutorial.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd } from '../data/thief.js';
import { formatMoney } from '../systems/Character.js';
import { createButton } from '../utils/ui.js';
import { tickTime, getTime, getDayNightOverlay, formatDateTime } from '../systems/TimeSystem.js';
import { getVillageRep, getReputationLevel, checkExpulsion, checkVictory, getNpcRep } from '../data/reputation.js';
import { findNpc, getNpcDisplayName } from '../data/npcNames.js';
import { getNpcActivity } from '../data/npcSchedules.js';

export class VillageScene extends Phaser.Scene {
    constructor() {
        super('Village');
    }

    create() {
        const ts = 48;
        this.tileSize = ts;
        this.worldW = MAP_W * ts;
        this.worldH = MAP_H * ts;

        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);

        // Фоновая музыка деревни (ambient)
        this.audioManager.playSceneMusic('village');

        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        this.map = buildMap();
        this.solids = this.physics.add.staticGroup();

        // ----- Отрисовка тайлов карты -----
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const t = this.map[y][x];
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;
                const texKey = tileTexture(t, x, y);
                const img = this.add.image(px, py, texKey);
                img.setScale(ts / 32);
                if (SOLID.has(t)) {
                    this.solids.create(px, py, texKey).setScale(ts / 32).refreshBody();
                }
            }
        }

        // ----- Анимация воды -----
        this.waterTiles = [];
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                if (this.map[y][x] === '~') {
                    const px = x * ts + ts / 2;
                    const py = y * ts + ts / 2;
                    const oldImg = this.children.list.find(c => c.x === px && c.y === py && c.texture && c.texture.key.startsWith('tile_water'));
                    if (oldImg) oldImg.destroy();
                    const waterImg = this.add.image(px, py, 'tile_water_0').setScale(ts / 32);
                    this.waterTiles.push({ img: waterImg, x, y });
                }
            }
        }
        this.waterFrame = 0;
        this.waterTimer = this.time.addEvent({
            delay: 300,
            callback: () => {
                this.waterFrame = (this.waterFrame + 1) % 3;
                this.waterTiles.forEach(w => {
                    w.img.setTexture(`tile_water_${this.waterFrame}`);
                });
            },
            loop: true,
        });

        // ----- Подсветка дверей и ворот -----
        this.doors = [];
        BUILDINGS.forEach(b => {
            const doorX = b.col + Math.floor(b.w / 2);
            const doorY = b.row + b.h - 1;
            const px = doorX * ts + ts / 2;
            const py = doorY * ts + ts / 2;
            // Метка здания над дверью
            const label = this.add.text(b.col * ts + b.w * ts / 2, (b.row - 1) * ts - 10, b.label, {
                fontSize: '14px', color: RUS.text, backgroundColor: '#00000088',
                padding: { x: 6, y: 3 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(10);
            // Золотой кружок над дверью
            const doorMarker = this.add.image(px, py - ts, 'particle_spark')
                .setTint(0xc9a14a)
                .setDisplaySize(20, 20)
                .setDepth(10);
            this.tweens.add({
                targets: doorMarker,
                alpha: { from: 0.7, to: 1 },
                scale: { from: 0.9, to: 1.1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
            this.doors.push({ x: doorX, y: doorY, interiorId: b.interiorId, label, marker: doorMarker });

            // ----- П.7: Уникальные детали зданий -----
            this.addBuildingDetails(b, ts);

            // ----- Ограда и грядки для жилых домов (п.6) -----
            if (b.interiorId === 'villager_house_1' || b.interiorId === 'villager_house_2') {
                this.addYardAndGarden(b, ts);
            }
        });

        // ----- Ограда для общественных зданий (староста, таверна, кузница, церковь) -----
        BUILDINGS.forEach(b => {
            if (b.interiorId !== 'villager_house_1' && b.interiorId !== 'villager_house_2') {
                this.addPublicFence(b, ts);
            }
        });

        // ----- Метка ворот -----
        const gatePx = (MAP_W - 1) * ts + ts / 2;
        const gatePy = VILLAGE_GATE.row * ts + ts / 2;
        const gateLabel = this.add.text(gatePx, gatePy - ts, 'ВЫХОД ▶', {
            fontSize: '16px', color: '#ff8060', backgroundColor: '#00000088',
            padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(10);
        const gateMarker = this.add.image(gatePx, gatePy - ts * 1.8, 'particle_spark')
            .setTint(0xff6040)
            .setDisplaySize(24, 24)
            .setDepth(10);
        this.tweens.add({
            targets: gateMarker,
            alpha: { from: 0.7, to: 1 },
            scale: { from: 0.9, to: 1.2 },
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // ----- Игрок (п.9: уменьшен в 2 раза) -----
        this.player = this.registry.get('player');
        const ps = PLAYER_START;
        this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, this.player.sprite || 'player');
        this.playerObj.setScale(ts / 32 * 0.75);  // было 1.5, теперь 0.75 (в 2 раза меньше)
        this.playerObj.setCollideWorldBounds(true);
        this.playerObj.play(`${this.player.sprite || 'player'}_idle_down`);
        this.physics.add.collider(this.playerObj, this.solids);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // ----- Управление -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
        this.busyDialog = false;
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = 350;

        // П.25: F1 — окно помощи
        this.input.keyboard.on('keydown-F1', () => {
            this.scene.pause();
            this.scene.launch('Help');
        });
        // П.26: ESC — главное меню
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('Title');
        });

        // П.16,23: ЛКМ на здании — подойти и войти
        // П.24: ПКМ на здании — показать информацию
        this.input.on('pointerdown', (pointer) => {
            if (this.busyDialog) return;
            const worldPoint = pointer.positionToCamera(this.cameras.main);
            const ts = this.tileSize;
            const tx = Math.floor(worldPoint.x / ts);
            const ty = Math.floor(worldPoint.y / ts);

            // Проверяем, кликнул ли на дверь здания
            const interiorId = doorInteriorId(tx, ty);
            if (intereriorId) {
                if (pointer.rightButtonDown()) {
                    // П.24: ПКМ — показать информацию о здании
                    this.showBuildingInfo(interiorId);
                } else {
                    // П.16,23: ЛКМ — подойти к двери и войти
                    this.walkToAndEnter(interiorId, tx, ty);
                }
                return;
            }
        });

        // ----- СТАТУС-БАР (п.10: горизонтальный бар в самом верху) -----
        // Единая строка со всеми статусами
        this.statusBar = this.add.rectangle(0, 0, this.scale.width, 28, 0x000000, 0.85)
            .setOrigin(0).setScrollFactor(0).setDepth(100);
        this.statusText = this.add.text(6, 4, '', {
            fontSize: '12px', color: RUS.text,
            fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 1,
        }).setScrollFactor(0).setDepth(101);

        // Цель квеста (под статус-баром)
        this.objectiveText = this.add.text(8, 30, '', {
            fontSize: '12px', color: '#c9a14a', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Название деревни — справа сверху
        const villageName = getVillageName();
        this.add.text(this.scale.width - 8, 6, villageName, {
            fontSize: '16px', color: RUS.textDim, backgroundColor: '#000000cc', padding: { x: 8, y: 4 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        // ----- Overlay для смены дня/ночи (п.5,11) -----
        this.dayNightOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(90)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);

        // ----- Кнопки меню сверху (Пункт 9) -----
        this.createTopMenu();

        this.prompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', {
            fontSize: '16px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 10, y: 5 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

        // ----- Туториал -----
        this.tutorial = new Tutorial(this);
        this.tutorial.maybeStart();

        // ----- Мобильное управление -----
        this.virtualControls = new VirtualControls(this);

        this.events.once('shutdown', () => {
            if (this.tutorial) this.tutorial.destroyAll();
            if (this.virtualControls) this.virtualControls.destroy();
        });
    }

    /**
     * П.7: Уникальные детали для каждого здания.
     */
    addBuildingDetails(b, ts) {
        const cx = b.col * ts + b.w * ts / 2;
        const topY = b.row * ts;

        if (b.interiorId === 'church') {
            // Церковь: луковка купола + крест + звонница
            // Купол (луковка) — круг + треугольник
            const domeY = topY - ts * 0.6;
            const dome = this.add.graphics();
            dome.fillStyle(0x8b7355, 1);
            dome.fillCircle(cx, domeY, ts * 0.4);
            dome.fillStyle(0x6b5535, 1);
            dome.fillTriangle(cx - ts * 0.3, domeY, cx + ts * 0.3, domeY, cx, domeY - ts * 0.5);
            dome.lineStyle(2, 0x4a3a25, 1);
            dome.strokeCircle(cx, domeY, ts * 0.4);
            dome.setDepth(8);

            // Крест на куполе
            this.add.text(cx, domeY - ts * 0.7, '✝', {
                fontSize: '20px', color: '#c9a14a',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(9);

            // Звонница — справа от церкви
            const bellX = cx + b.w * ts / 2 - ts * 0.3;
            const bellY = topY - ts * 0.3;
            const bell = this.add.graphics();
            bell.fillStyle(0x7a5a3a, 1);
            bell.fillRect(bellX - ts * 0.15, bellY - ts * 0.5, ts * 0.3, ts * 0.8);
            bell.lineStyle(2, 0x4a3a25, 1);
            bell.strokeRect(bellX - ts * 0.15, bellY - ts * 0.5, ts * 0.3, ts * 0.8);
            // Колокол
            bell.fillStyle(0xc9a14a, 1);
            bell.fillCircle(bellX, bellY, ts * 0.1);
            bell.setDepth(8);
            // Крест на звоннице
            this.add.text(bellX, bellY - ts * 0.7, '✝', {
                fontSize: '14px', color: '#c9a14a',
            }).setOrigin(0.5).setDepth(9);

        } else if (b.interiorId === 'tavern') {
            // Таверна: вывеска с кружкой
            this.add.text(cx, topY - ts * 0.4, '🍺', {
                fontSize: '18px',
            }).setOrigin(0.5).setDepth(9);
            // Дымоход
            const chimney = this.add.graphics();
            chimney.fillStyle(0x5a4030, 1);
            chimney.fillRect(cx + ts * 0.6, topY - ts * 0.5, ts * 0.25, ts * 0.5);
            chimney.setDepth(8);

        } else if (b.interiorId === 'blacksmith') {
            // Кузница: молот + наковальня (эмблема)
            this.add.text(cx, topY - ts * 0.4, '🔨', {
                fontSize: '18px',
            }).setOrigin(0.5).setDepth(9);
            // Труба кузницы
            const chimney = this.add.graphics();
            chimney.fillStyle(0x4a3a25, 1);
            chimney.fillRect(cx - ts * 0.8, topY - ts * 0.5, ts * 0.3, ts * 0.6);
            chimney.setDepth(8);

        } else if (b.interiorId === 'elder_house') {
            // Дом старосты: флаг/вымпел
            const flag = this.add.graphics();
            flag.fillStyle(0x8b2c1a, 1);
            flag.fillTriangle(cx, topY - ts * 0.8, cx + ts * 0.5, topY - ts * 0.6, cx, topY - ts * 0.4);
            flag.fillRect(cx - ts * 0.05, topY - ts * 0.8, ts * 0.1, ts * 0.8);
            flag.setDepth(8);

        } else if (b.interiorId === 'villager_house_1') {
            // Дом Авдея: сено на крыше
            this.add.text(cx, topY - ts * 0.3, '🌾', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);

        } else if (b.interiorId === 'villager_house_2') {
            // Дом Марфы: прялка у окна (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🧶', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        }
    }

    /**
     * Добавить двор с оградой, грядками и КАЛИТКОЙ к жилому дому (п.6).
     * Калитка — проход в ограде перед дверью, через который игрок может войти.
     */
    addYardAndGarden(b, ts) {
        const baseX = b.col * ts;
        const baseY = (b.row + b.h) * ts;  // под домом
        const doorX = b.col + Math.floor(b.w / 2);  // колонка двери

        // Грядки перед домом (2×3) — по бокам от дорожки к двери
        for (let gy = 0; gy < 2; gy++) {
            for (let gx = 0; gx < b.w + 1; gx++) {
                // Пропускаем колонку двери — там дорожка
                if (gx === Math.floor(b.w / 2) || gx === Math.floor(b.w / 2) + 1) continue;
                const px = baseX + gx * ts + ts / 2;
                const py = baseY + gy * ts + ts / 2;
                if (this.textures.exists('tile_garden_0')) {
                    const v = (gx + gy) % 3;
                    this.add.image(px, py, `tile_garden_${v}`)
                        .setScale(ts / 32)
                        .setDepth(3);
                }
            }
        }

        // Ограда: горизонтальная снизу грядок
        // П.6: В ограде оставляем КАЛИТКУ — проём перед дверью (1 тайл)
        const fenceY = baseY + 2 * ts;
        for (let fx = 0; fx < b.w + 1; fx++) {
            // Пропускаем тайл калитки — перед дверью
            if (fx === Math.floor(b.w / 2)) continue;
            const px = baseX + fx * ts + ts / 2;
            if (this.textures.exists('tile_fence_h')) {
                this.add.image(px, fenceY, 'tile_fence_h')
                    .setScale(ts / 32)
                    .setDepth(3);
            }
        }

        // Вертикальные ограды по бокам двора
        for (let fy = 0; fy < 2; fy++) {
            const py = baseY + fy * ts + ts / 2;
            if (this.textures.exists('tile_fence_v')) {
                this.add.image(baseX - ts / 2, py, 'tile_fence_v')
                    .setScale(ts / 32)
                    .setDepth(3);
                this.add.image(baseX + (b.w + 1) * ts - ts / 2, py, 'tile_fence_v')
                    .setScale(ts / 32)
                    .setDepth(3);
            }
        }
        // Углы
        if (this.textures.exists('tile_fence_corner')) {
            this.add.image(baseX - ts / 2, fenceY, 'tile_fence_corner')
                .setScale(ts / 32).setDepth(3);
            this.add.image(baseX + (b.w + 1) * ts - ts / 2, fenceY, 'tile_fence_corner')
                .setScale(ts / 32).setDepth(3);
        }

        // Калитка — декоративный столбик с двух сторон от прохода
        const gateX = baseX + Math.floor(b.w / 2) * ts + ts / 2;
        if (this.textures.exists('tile_fence_v')) {
            // Два коротких столбика по бокам от калитки
            this.add.image(gateX - ts / 3, fenceY, 'tile_fence_v')
                .setScale(ts / 32 * 0.7).setDepth(4);
            this.add.image(gateX + ts / 3, fenceY, 'tile_fence_v')
                .setScale(ts / 32 * 0.7).setDepth(4);
        }
    }

    /**
     * Добавить простую ограду к общественному зданию (п.7).
     */
    addPublicFence(b, ts) {
        const baseX = b.col * ts;
        const baseY = (b.row + b.h) * ts;
        // Только горизонтальная ограда перед зданием
        for (let fx = 0; fx < b.w; fx++) {
            const px = baseX + fx * ts + ts / 2;
            if (this.textures.exists('tile_fence_h')) {
                this.add.image(px, baseY, 'tile_fence_h')
                    .setScale(ts / 32)
                    .setDepth(3);
            }
        }
    }

    /**
     * Создать кнопки меню сверху: [Персонаж] [Инвентарь]
     */
    createTopMenu() {
        const { width } = this.scale;
        // Кнопки в статус-баре (п.10): справа вверху, в пределах бара (y=14)
        const btnY = 14;
        const btnW = 70, btnH = 20;

        // Кнопка "Задания" (п.20)
        const questBtnX = width - 310;
        const questBtn = this.add.rectangle(questBtnX, btnY, btnW, btnH, 0x2a4a6a, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(101);
        const questText = this.add.text(questBtnX, btnY, '📋 Задания', {
            fontSize: '10px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        questBtn.on('pointerup', () => { this.showQuestJournal(); });
        questBtn.on('pointerover', () => questBtn.setFillStyle(0x3a5a7a, 1));
        questBtn.on('pointerout', () => questBtn.setFillStyle(0x2a4a6a, 0.95));

        // Кнопка "Персонаж"
        const charBtnX = width - 220;
        const charBtn = this.add.rectangle(charBtnX, btnY, btnW, btnH, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(101);
        const charText = this.add.text(charBtnX, btnY, '📜 Персонаж', {
            fontSize: '11px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        charBtn.on('pointerup', () => {
            // П.13: если персонаж не выбран — переход к созданию
            const p = this.registry.get('player');
            if (!p) {
                this.scene.start('CharacterSelection');
                return;
            }
            ActionLog.add(this.registry, 'Открыл меню персонажа.');
            this.scene.pause();
            this.scene.launch('Character', { from: 'Village' });
        });
        charBtn.on('pointerover', () => charBtn.setFillStyle(0x5a4530, 1));
        charBtn.on('pointerout', () => charBtn.setFillStyle(0x4a3520, 0.95));

        // Кнопка "Инвентарь"
        const invBtnX = width - 100;
        const invBtn = this.add.rectangle(invBtnX, btnY, btnW, btnH, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(101);
        const invText = this.add.text(invBtnX, btnY, '🎒 Инвентарь', {
            fontSize: '11px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        invBtn.on('pointerup', () => {
            const p = this.registry.get('player');
            if (!p) {
                this.scene.start('CharacterSelection');
                return;
            }
            ActionLog.add(this.registry, 'Открыл инвентарь.');
            this.scene.pause();
            this.scene.launch('Character', { from: 'Village', tab: 'inventory' });
        });
        invBtn.on('pointerover', () => invBtn.setFillStyle(0x5a4530, 1));
        invBtn.on('pointerout', () => invBtn.setFillStyle(0x4a3520, 0.95));
    }

    update() {
        // Проверка конца игры
        const endState = checkGameEnd(this.registry);
        if (endState) {
            this.scene.start('End');
            return;
        }
        
        // Пункт 12: Проверка изгнания из деревни при низкой репутации
        const expulsion = checkExpulsion(this.registry);
        if (expulsion.expelled) {
            ActionLog.add(this.registry, `ПОРАЖЕНИЕ: ${expulsion.message}`);
            const q = this.registry.get('quest');
            q.heroDead = true;
            q.currentObjective = 'Изгнан из деревни за дурную славу.';
            this.registry.set('quest', q);
            this.scene.start('End');
            return;
        }
        
        // Пункт 13: Проверка выигрыша при репутации +100
        const victory = checkVictory(this.registry);
        if (victory.victory) {
            ActionLog.add(this.registry, `ПОБЕДА: ${victory.message}`);
            const q = this.registry.get('quest');
            q.thiefDefeated = true; // используем как флаг победы для EndScene
            q.currentObjective = 'Принят в деревню как свой! Победа!';
            this.registry.set('quest', q);
            this.scene.start('End');
            return;
        }

        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            if (this.virtualControls) this.virtualControls.setVisible(false);
            return;
        }
        if (this.virtualControls) this.virtualControls.setVisible(true);

        const speed = 160;
        let vx = 0, vy = 0;

        const joyMove = this.virtualControls ? this.virtualControls.getMovement() : null;
        if (joyMove) {
            vx = joyMove.x;
            vy = joyMove.y;
        } else {
            // Фикс п.7: каждая клавиша проверяется отдельно, без else if
            if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
            if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
            if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
            if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
        }

        const v = new Phaser.Math.Vector2(vx, vy);
        if (v.length() > 0) {
            v.normalize().scale(speed);
            let dir = this.lastDir;
            if (Math.abs(vy) >= Math.abs(vx)) {
                dir = vy < 0 ? 'up' : 'down';
            } else {
                dir = vx < 0 ? 'left' : 'right';
            }
            if (dir !== this.lastDir || !this.playerObj.anims.isPlaying) {
                this.playerObj.play(`${this.player.sprite || 'player'}_walk_${dir}`, true);
                this.lastDir = dir;
            }
            const now = this.time.now;
            if (now - this.lastStepTime > this.stepInterval) {
                this.audioManager.playStep();
                this.lastStepTime = now;
                // Продвигаем время (п.3: 1:20 — 20x медленнее, было 5 мин, теперь 0.25 мин)
                tickTime(this.registry, 0.25);
            }
        } else {
            this.playerObj.anims.pause();
            this.playerObj.play(`${this.player.sprite || 'player'}_idle_${this.lastDir}`, true);
        }
        this.playerObj.setVelocity(v.x, v.y);

        this.updateNearestInteractable();
        this.updateHUD();
    }

    /**
     * Проверить, находится ли игрок рядом с дверью/воротами.
     */
    updateNearestInteractable() {
        const ts = this.tileSize;
        const px = Math.floor(this.playerObj.x / ts);
        const py = Math.floor(this.playerObj.y / ts);

        let nearest = null;
        let bestDist = 1.5;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = px + dx;
                const cy = py + dy;
                const interiorId = doorInteriorId(cx, cy);
                if (interiorId) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        const b = BUILDINGS.find(b => b.interiorId === interiorId);
                        nearest = { type: 'door', interiorId, label: b ? b.label : 'Войти' };
                    }
                }
                if (isGate(cx, cy)) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'gate', label: 'Выйти из деревни' };
                    }
                }
            }
        }

        this.nearestInteractable = nearest;
        if (nearest) {
            this.prompt.setText(`Нажмите E — ${nearest.label}`).setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }
    }

    updateHUD() {
        const p = this.player;
        if (!p) return;
        const q = this.registry.get('quest') || {};
        const moneyStr = formatMoney(p.dengas || 0);
        const timeState = getTime(this.registry);
        const villageRep = getVillageRep(this.registry);
        const repLevel = getReputationLevel(villageRep);
        const turnsLeft = (q.turnLimit || 12) - (q.turnsUsed || 0);
        
        // Единый статус-бар (п.10): HP | MP | Меч | Деньги | Дата | Ходы | Репутация
        let statusLine = `❤${p.HP}/${p.HPmax}  ✦${p.MP}/${p.MPmax}  ⚔${p.skills.sword}%  💰${moneyStr}`;
        if (timeState) {
            statusLine += `  📅${formatDateTime(timeState)}`;
        }
        if (turnsLeft > 0 && !q.thiefDefeated && !q.thiefEscaped) {
            statusLine += `  ⏳${turnsLeft}ход`;
        }
        statusLine += `  ⭐${villageRep > 0 ? '+' : ''}${villageRep}`;
        this.statusText.setText(statusLine);
        
        // Обновляем overlay дня/ночи
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            if (this.dayNightOverlay) {
                this.dayNightOverlay.setFillStyle(overlay.color, overlay.alpha);
            }
        }
        
        if (q.currentObjective) {
            this.objectiveText.setText(`◆ ${q.currentObjective}`);
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearestInteractable) return;
        ActionLog.add(this.registry, `Игрок взаимодействует с: ${this.nearestInteractable.label}.`);
        if (this.nearestInteractable.type === 'door') {
            // Пункт 8: интерьер открывается отдельным окном поверх деревни
            this.scene.pause();
            this.scene.launch('Interior', { interiorId: this.nearestInteractable.interiorId, from: 'Village' });
        } else if (this.nearestInteractable.type === 'gate') {
            this.scene.start('Fork');
        }
    }

    // П.16,23: Подойти к двери и войти
    walkToAndEnter(interiorId, tx, ty) {
        const ts = this.tileSize;
        const targetX = tx * ts + ts / 2;
        const targetY = ty * ts + ts / 2;
        const dist = Phaser.Math.Distance.Between(this.playerObj.x, this.playerObj.y, targetX, targetY);
        
        if (dist < ts * 1.5) {
            // Уже рядом — входим
            ActionLog.add(this.registry, `Игрок вошёл в здание.`);
            this.scene.pause();
            this.scene.launch('Interior', { interiorId: interiorId, from: 'Village' });
        } else {
            // Идём к двери
            this.playerObj.setVelocity(0, 0);
            const angle = Phaser.Math.Angle.Between(this.playerObj.x, this.playerObj.y, targetX, targetY);
            const speed = 200;
            this.playerObj.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            
            // Останавливаемся у двери
            this.time.delayedCall(dist / speed * 1000, () => {
                this.playerObj.setVelocity(0, 0);
                ActionLog.add(this.registry, `Игрок подошёл к зданию и вошёл.`);
                this.scene.pause();
                this.scene.launch('Interior', { interiorId: interiorId, from: 'Village' });
            });
        }
    }

    // П.24: Показать информацию о здании
    showBuildingInfo(interiorId) {
        const interior = INTERIORS[interiorId];
        if (!interior) return;
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const npcRep = getNpcRep(this.registry, interior.npcId);
        const repLevel = getReputationLevel(npcRep);
        const timeState = getTime(this.registry);
        const hour = timeState ? timeState.hour : 12;
        const activity = this.npcData ? getNpcActivity(this.npcData, hour) : 'занят';
        
        const info = `${interior.name}\n` +
            `NPC: ${npcName}\n` +
            `Личная репутация: ${npcRep > 0 ? '+' : ''}${npcRep} (${repLevel.name})\n` +
            `Сейчас: ${activity}`;
        
        // Показываем как всплывающую подсказку
        const { width, height } = this.scale;
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
            .setOrigin(0).setInteractive().setDepth(200).setScrollFactor(0);
        const panel = this.add.rectangle(width / 2, height / 2, 400, 180, 0x241B15, 1)
            .setStrokeStyle(2, 0xC9A961).setDepth(201).setScrollFactor(0);
        const text = this.add.text(width / 2, height / 2, info, {
            fontSize: '14px', color: '#E8DCC4', align: 'center',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202).setScrollFactor(0);
        
        const closeInfo = () => {
            overlay.destroy();
            panel.destroy();
            text.destroy();
        };
        overlay.on('pointerup', closeInfo);
        this.time.delayedCall(3000, closeInfo); // авто-закрытие через 3 сек
    }

    // П.20-22: Журнал заданий
    showQuestJournal() {
        const { width, height } = this.scale;
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 750, panelH = 600;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 20, '📋 Журнал заданий', {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        const q = this.registry.get('quest') || {};
        const quests = q.activeQuests || [];
        const timeState = getTime(this.registry);

        if (quests.length === 0) {
            this.add.text(width / 2, height / 2, 'Нет активных заданий.\nПоговорите с жителями деревни.', {
                fontSize: '16px', color: RUS.textDim, align: 'center',
            }).setOrigin(0.5).setDepth(202);
        } else {
            let y = height / 2 - panelH / 2 + 60;
            quests.forEach((quest) => {
                // П.21: Детальная информация о задании
                const status = quest.completed ? '✅ Выполнено' : (quest.failed ? '❌ Провалено' : '🔄 Выполняется');
                const statusColor = quest.completed ? '#60ff60' : (quest.failed ? '#ff4040' : '#c9a14a');
                
                // П.22: Сроки в часах/днях
                const timeLimitHours = quest.timeLimit ? quest.timeLimit * 4 : 0; // 1 ход = ~4 часа
                const timeLimitDays = Math.ceil(timeLimitHours / 24);
                const timeTaken = quest.acceptedTime || 'неизвестно';
                const deadline = quest.deadline || `${timeLimitDays} дн. (${timeLimitHours} ч.)`;

                // П.18: Штрафы за невыполнение
                const penaltyText = quest.difficulty === 'hard' 
                    ? 'Штраф: −15 репутации, возможное изгнание' 
                    : (quest.difficulty === 'medium' 
                        ? 'Штраф: −8 репутации' 
                        : 'Штраф: нет или −3 репутации');

                // П.21.7: Награды
                const rewardsText = (quest.rewards || []).map(r => {
                    if (r.type === 'money') return `${r.amount} д.`;
                    if (r.type === 'item') return `${r.name} ×${r.count}`;
                    if (r.type === 'lodging') return 'ночлег';
                    if (r.type === 'blessing') return 'благословение';
                    return r.name || '';
                }).join(', ');

                const questInfo = [
                    `${status}  |  ${quest.title}`,
                    `Выдал: ${quest.npcName || 'неизвестно'}`,
                    `Срок: ${deadline}  |  Сложность: ${quest.difficulty}`,
                    `Цель: ${quest.objective}`,
                    `Награда: ${rewardsText || 'нет'}`,
                    `${penaltyText}`,
                    `Сдавать: ${quest.npcName || 'тому же NPC'}`,
                ].join('\n');

                this.add.text(width / 2 - panelW / 2 + 20, y, questInfo, {
                    fontSize: '12px', color: '#E8DCC4',
                    fontFamily: 'Arial, sans-serif',
                    stroke: '#000', strokeThickness: 1,
                    lineSpacing: 3,
                    wordWrap: { width: panelW - 40 },
                }).setOrigin(0, 0).setDepth(202);

                // Цветная метка статуса
                this.add.text(width / 2 - panelW / 2 + 20, y, status, {
                    fontSize: '12px', color: statusColor, fontStyle: 'bold',
                }).setOrigin(0, 0).setDepth(203);

                y += 110;
                if (y > height / 2 + panelH / 2 - 60) return; // не выходим за пределы
            });
        }

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 25, 140, 30, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 25, 'Закрыть', {
            fontSize: '14px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeJournal = () => {
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeJournal);
        overlay.on('pointerup', closeJournal);
    }

    autosave() {
        // Сохранение отключено (одноразовая игра)
    }
}

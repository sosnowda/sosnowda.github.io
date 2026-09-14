// Деревня-оверхорлд: хаб с зданиями, воротами, сменой дня/ночи.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import {
    buildMap, SOLID, tileTexture, roadTileSpec, validateMap, doorInteriorId, isGate,
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
import { tickTime, getTime, getDayNightOverlay, formatDateTime, getSeason } from '../systems/TimeSystem.js';
import { getVillageRep, getReputationLevel, checkExpulsion, checkVictory, getNpcRep, changeVillageRep } from '../data/reputation.js';
import { CHESTS, chestAt, isOpenedToday, markOpened, rollLoot, lootDisplayName, dayKeyOf } from '../data/chests.js';
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

        // ----- QA коллизий и проходимости: BFS-проверка карты -----
        const validation = validateMap(this.map);
        if (validation.problems.length) {
            console.warn('[Деревня] Проблемы проходимости:', validation.problems);
        }

        // ----- Отрисовка тайлов карты -----
        // «Высокие» объекты (деревья, камни, колодец) получают Y-сортировку
        // (глубина = строка тайла): игрок за ними рисуется ПОЗАДИ, перед ними — ПЕРЕД.
        this.wellTiles = [];
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const t = this.map[y][x];
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;
                let texKey, angle = 0;
                if (t === 'S' || t === ',') {
                    // Автотайл дороги: непрерывная песчаная лента (H/V/угол/крест)
                    const spec = roadTileSpec(x, y, this.map);
                    texKey = spec.key;
                    angle = spec.angle;
                } else {
                    texKey = tileTexture(t, x, y, this.map);
                }
                // Проверяем существование текстуры, fallback на траву
                const safeTex = this.textures.exists(texKey) ? texKey : 'tile_grass_0';
                if (!this.textures.exists(texKey)) angle = 0;
                const img = this.add.image(px, py, safeTex);
                img.setScale(ts / 32);
                if (angle) img.setAngle(angle);
                // Y-сортировка высоких объектов; земля (трава/дороги/вода) — глубина 0
                if (t === 'T' || t === '#' || t === 'W') {
                    img.setDepth(y + 0.4);
                } else {
                    img.setDepth(0);
                }
                if (t === 'W') this.wellTiles.push({ img, x, y });
                if (SOLID.has(t)) {
                    // Создаём НЕВИДИМЫЙ физический объект для коллизий
                    const solid = this.solids.create(px, py, safeTex);
                    solid.setScale(ts / 32).refreshBody();
                    solid.setVisible(false);  // скрываем — отрисовка уже через add.image
                }
            }
        }

        // ----- Анимация колодца (deco_well_0..3) -----
        if (this.wellTiles.length) {
            let wellFrame = 0;
            this.time.addEvent({
                delay: 260,
                loop: true,
                callback: () => {
                    wellFrame = (wellFrame + 1) % 4;
                    this.wellTiles.forEach(w => {
                        if (this.textures.exists(`deco_well_${wellFrame}`)) {
                            w.img.setTexture(`deco_well_${wellFrame}`);
                        }
                    });
                },
            });
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
        // Спрайты домов: рисованные избы (deco_house_0..3) вместо плоских
        // двухтекстурных коробок. Крыльцо/окна/труба уже «запечены» в спрайте.
        const HOUSE_SPRITE_BY_ID = {
            elder_house: 'deco_house_3',
            tavern: 'deco_house_1',
            blacksmith: 'deco_house_2',
            villager_house_1: 'deco_house_0',
            villager_house_2: 'deco_house_2',
            barn: 'deco_house_1',            // амбар — та же клеть, что и таверна (свой декор отличит)
        };
        this.doors = [];
        BUILDINGS.forEach(b => {
            const doorX = b.col + Math.floor(b.w / 2);
            const doorY = b.row + b.h - 1;
            const px = doorX * ts + ts / 2;
            const py = doorY * ts + ts / 2;

            // Метка здания над дверью (глубина 20 — поверх спрайта дома)
            const label = this.add.text(b.col * ts + b.w * ts / 2, (b.row - 1) * ts - 10, b.label, {
                fontSize: '14px', color: RUS.text, backgroundColor: '#00000088',
                padding: { x: 6, y: 3 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);

            // ----- Дом спрайтом + тень (псевдо-2.5D: Y-сортировка) -----
            const sprKey = b.interiorId === 'church'
                ? 'deco_church_building'
                : b.interiorId === 'chapel'
                    ? 'deco_chapel'                        // узкая часовня с главкой (64×80)
                    : HOUSE_SPRITE_BY_ID[b.interiorId];
            const cx = b.col * ts + b.w * ts / 2;
            const cy = b.row * ts + b.h * ts / 2;
            const bottomRow = b.row + b.h;                 // строка под домом
            const usedSprite = sprKey && this.textures.exists(sprKey);
            if (usedSprite) {
                // Тень у основания дома (мягкий овал)
                this.add.ellipse(cx, bottomRow * ts - 4, b.w * ts * 0.94, ts * 0.6, 0x000000, 0.25)
                    .setDepth(bottomRow - 0.7);
                this.add.image(cx, cy, sprKey)
                    .setDisplaySize(b.w * ts + 8, b.h * ts + 6)
                    .setDepth(bottomRow - 0.5);            // Y-сортировка: игрок ниже дома — перед домом
            } else {
                // Fallback: старые тайлы + нарисованная дверь
                this.add.rectangle(px, py + 4, ts * 0.44, ts * 0.68, 0x3a2417)
                    .setStrokeStyle(2, 0x1f140c)
                    .setDepth(bottomRow - 0.5);
            }

            // Золотой кружок над дверью (глубина 20 — поверх спрайта дома)
            const doorMarker = this.add.image(px, py - ts, 'particle_spark')
                .setTint(0xc9a14a)
                .setDisplaySize(20, 20)
                .setDepth(20);
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

            // ----- П.7: Уникальные детали зданий (без дублей со спрайтом) -----
            this.addBuildingDetails(b, ts, usedSprite);

            // ----- Ограда и грядки для жилых домов (п.6) -----
            if (b.interiorId === 'villager_house_1' || b.interiorId === 'villager_house_2') {
                this.addYardAndGarden(b, ts);
            }
        });

        // ----- Дым из труб (атмосфера, §3 village-visual-upgrade) -----
        // Амбар и часовня без труб — дымит только жильё и очаги.
        this.smokeBuildings = BUILDINGS
            .filter(b => b.interiorId !== 'barn' && b.interiorId !== 'chapel')
            .map(b => ({
                x: b.col * ts + b.w * ts / 2 + ts * 0.42,   // трубы в спрайтах смещены вправо от центра
                y: b.row * ts - ts * 0.12,
                depth: b.row + b.h + 1,
            }));
        this.time.addEvent({
            delay: 620,
            loop: true,
            callback: () => {
                // раз в тик дымит ОДНО случайное здание — дым редкий и живой
                const b = Phaser.Utils.Array.GetRandom(this.smokeBuildings);
                this.puffSmoke(b.x, b.y, b.depth);
            },
        });

        // ----- Ночное свечение окон (тёплый свет в темноте) -----
        this.windowGlows = [];
        BUILDINGS.forEach(b => {
            const bottomRow = b.row + b.h;
            const cx = b.col * ts + b.w * ts / 2;
            const wallY = (bottomRow - 1.5) * ts;      // зона стены спрайта
            [-0.75, 0.75].forEach(dx => {
                const glow = this.add.rectangle(cx + dx * ts, wallY, 12, 15, 0xffc866, 0)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(bottomRow - 0.4);
                this.windowGlows.push(glow);
            });
        });

        // ----- Ограда для общественных зданий (староста, таверна, кузница, церковь) -----
        BUILDINGS.forEach(b => {
            if (b.interiorId !== 'villager_house_1' && b.interiorId !== 'villager_house_2') {
                this.addPublicFence(b, ts);
            }
        });

        // ----- Живность: бабочки днём / светлячки ночью (атмосфера) -----
        this.createAmbientCritters(ts);

        // ----- Полевые цветы/кочки и сундуки с лутом (раунд 11) -----
        this.scatterFlowers(ts);
        this.spawnChests(ts);

        // ----- Метка ворот -----
        const gatePx = (MAP_W - 1) * ts + ts / 2;
        const gatePy = VILLAGE_GATE.row * ts + ts / 2;
        const gateLabel = this.add.text(gatePx, gatePy - ts, 'ВЫХОД ▶', {
            fontSize: '16px', color: '#ff8060', backgroundColor: '#00000088',
            padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);
        const gateMarker = this.add.image(gatePx, gatePy - ts * 1.8, 'particle_spark')
            .setTint(0xff6040)
            .setDisplaySize(24, 24)
            .setDepth(20);
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
        // П.1-2: Если игрок настроил внешность через генератор — используем
        // композитную текстуру 'player_composite' как image (с раздельными tint-регионами).
        // Иначе — обычный sprite с tint одежды.
        this.player = this.registry.get('player');
        const ps = PLAYER_START;
        const useComposite = this.player && this.player.useComposite && this.textures.exists('player_composite');
        if (useComposite) {
            // Используем image с композитной текстурой (статичный кадр, без анимации)
            this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, 'player_composite');
            // Анимации нет — но добавим эффект дыхания через tween
        } else {
            // Обычный sprite с анимациями
            this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, this.player.sprite || 'player');
            // П.4: Применяем tint одежды (если игрок настроил внешность)
            if (this.player.appearance && this.player.appearance.jacket) {
                this.playerObj.setTint(this.player.appearance.jacket.tint);
            }
            this.playerObj.play(`${this.player.sprite || 'player'}_idle_down`);
        }
        this.playerObj.setScale(ts / 32 * 0.75);  // было 1.5, теперь 0.75 (в 2 раза меньше)
        // ЧЕСТНЫЙ ХИТБОКС: кадр спрайта 64×64, сам персонаж занимает ~24×24 в центре.
        // Раньше тело было равно всему кадру (72×72 при текущем масштабе) — игрок
        // «упирался» в невидимые стены там, где визуально свободно проходил.
        if (this.playerObj.body) {
            this.playerObj.body.setSize(24, 24, true);
        }
        this.playerObj.setCollideWorldBounds(true);
        this.physics.add.collider(this.playerObj, this.solids);
        // Псевдо-2.5D: глубина игрока зависит от Y — за домами/деревьями он ЗА,
        // перед ними — ПЕРЕД (Y-сортировка)
        this.playerObj.setDepth(this.playerObj.y / ts);
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
        this.input.on('pointerdown', (pointer) => {
            if (this.busyDialog) return;
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            const ts = this.tileSize;
            const tx = Math.floor(worldX / ts);
            const ty = Math.floor(worldY / ts);

            let targetBuilding = null;
            const interiorId = doorInteriorId(tx, ty);
            if (interiorId) {
                targetBuilding = { interiorId, doorX: tx, doorY: ty };
            } else {
                for (const b of BUILDINGS) {
                    if (tx >= b.col && tx < b.col + b.w && ty >= b.row && ty < b.row + b.h) {
                        targetBuilding = { interiorId: b.interiorId, doorX: b.col + Math.floor(b.w / 2), doorY: b.row + b.h - 1 };
                        break;
                    }
                }
            }
            if (targetBuilding) {
                if (pointer.rightButtonDown()) {
                    this.showBuildingInfo(targetBuilding.interiorId);
                } else {
                    this.walkToAndEnter(targetBuilding.interiorId, targetBuilding.doorX, targetBuilding.doorY);
                }
                return;
            }

            // П.4: Клик на ворота — выход из деревни
            if (isGate(tx, ty)) {
                this.scene.start('Fork');
                return;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.busyDialog) { this.hideBuildingTooltip(); return; }
            const tx = Math.floor(pointer.worldX / this.tileSize);
            const ty = Math.floor(pointer.worldY / this.tileSize);
            let hoverBuilding = null;
            for (const b of BUILDINGS) {
                if (tx >= b.col && tx < b.col + b.w && ty >= b.row && ty < b.row + b.h) { hoverBuilding = b; break; }
            }
            if (hoverBuilding) { this.showBuildingTooltip(hoverBuilding, pointer.x, pointer.y); }
            else { this.hideBuildingTooltip(); }
        });

        // ----- СТАТУС-БАР (п.10: горизонтальный бар в самом верху) -----
        // Единая строка со всеми статусами
        this.statusBar = this.add.rectangle(0, 0, this.scale.width, 28, 0x000000, 0.85)
            .setOrigin(0).setScrollFactor(0).setDepth(100);
        this.statusText = this.add.text(6, 4, '', {
            fontSize: '11px', color: RUS.text,
            fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: this.scale.width - 220 },
        }).setScrollFactor(0).setDepth(101);

        // Цель квеста (под статус-баром)
        this.objectiveText = this.add.text(8, 30, '', {
            fontSize: '12px', color: '#c9a14a', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Название деревни — справа, НИЖЕ строки кнопок меню (баг раунда 11:
        // при y=6 длинные названия вроде «Двинская слобода» наезжали на «Инвентарь»)
        const villageName = getVillageName();
        this.add.text(this.scale.width - 8, 34, villageName, {
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

        // П.2: Спавним 4 куриц в деревне (просто бродят по траве).
        // Используем эмодзи-текст как спрайт — надёжно, не зависит от загрузки PNG.
        this.spawnChickens();

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
     * usedSprite — дом отрисован спрайтом: пропускаем графику, дублирующую спрайт
     * (купол церкви уже «запечён» в deco_church_building).
     */
    addBuildingDetails(b, ts, usedSprite = false) {
        const cx = b.col * ts + b.w * ts / 2;
        const topY = b.row * ts;

        if (b.interiorId === 'church') {
            if (usedSprite) {
                // Спрайт уже с золотым куполом — только крест над ним
                this.add.text(cx, topY - 6, '✝', {
                    fontSize: '20px', color: '#c9a14a',
                    stroke: '#000', strokeThickness: 2,
                }).setOrigin(0.5).setDepth(9);
                return;
            }
            // Fallback (без спрайта): купол-луковка + крест + звонница
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
     * Ограда и грядки теперь С ЧЕСТНЫМИ КОЛЛИЗИЯМИ (solid-тела), а тайлы,
     * занятые дорогой/дверью, не перекрываются декором.
     */
    addYardAndGarden(b, ts) {
        const doorX = b.col + Math.floor(b.w / 2);
        const topRow = b.row + b.h;        // первая строка двора (грядки)
        const fenceRow = topRow + 1;       // строка ограды с калиткой
        const mapChar = (x, y) => (this.map[y] && this.map[y][x] !== undefined) ? this.map[y][x] : null;
        const isFree = (x, y) => mapChar(x, y) === '.';  // декор только на траве

        const addSolid = (px, py) => {
            const solid = this.solids.create(px, py, 'tile_fence_h');
            solid.setScale(ts / 32).refreshBody();
            solid.setVisible(false);
        };

        // Грядки перед домом — по бокам от дорожки к двери (1 ряд)
        for (let gx = 0; gx < b.w; gx++) {
            const col = b.col + gx;
            if (col === doorX) continue;             // дорожка к двери
            if (!isFree(col, topRow)) continue;      // не перекрываем дорогу
            const px = col * ts + ts / 2;
            const py = topRow * ts + ts / 2;
            if (this.textures.exists('tile_garden_0')) {
                const v = (gx + topRow) % 3;
                this.add.image(px, py, `tile_garden_${v}`)
                    .setScale(ts / 32)
                    .setDepth(topRow + 0.3);
                // Грядки непроходимы — не топчем посадки
                addSolid(px, py);
            }
        }

        // Ограда перед двором с КАЛИТКОЙ напротив двери
        for (let gx = 0; gx < b.w; gx++) {
            const col = b.col + gx;
            if (col === doorX) continue;             // калитка — проход к двери
            if (!isFree(col, fenceRow)) continue;    // не перекрываем дорогу
            const px = col * ts + ts / 2;
            const py = fenceRow * ts + ts / 2;
            const isEdge = (gx === 0 || gx === b.w - 1);
            const tex = isEdge && this.textures.exists('tile_fence_corner')
                ? 'tile_fence_corner'
                : 'tile_fence_h';
            if (this.textures.exists(tex)) {
                this.add.image(px, py, tex)
                    .setScale(ts / 32)
                    .setDepth(fenceRow + 0.3);
                addSolid(px, py);                    // ограда непроходима
            }
        }

        // Калитка — декоративные столбики по бокам от прохода
        const gateX = doorX * ts + ts / 2;
        if (this.textures.exists('tile_fence_v')) {
            this.add.image(gateX - ts / 3, fenceRow * ts + ts / 2, 'tile_fence_v')
                .setScale(ts / 32 * 0.7).setDepth(fenceRow + 0.4);
            this.add.image(gateX + ts / 3, fenceRow * ts + ts / 2, 'tile_fence_v')
                .setScale(ts / 32 * 0.7).setDepth(fenceRow + 0.4);
        }
    }

    /**
     * Добавить ограду к общественному зданию (п.7).
     * С проёмом напротив двери и честными коллизиями.
     */
    addPublicFence(b, ts) {
        const doorX = b.col + Math.floor(b.w / 2);
        const fenceRow = b.row + b.h;      // строка сразу под зданием
        const mapChar = (x, y) => (this.map[y] && this.map[y][x] !== undefined) ? this.map[y][x] : null;

        for (let gx = 0; gx < b.w; gx++) {
            const col = b.col + gx;
            if (col === doorX) continue;             // проём напротив двери
            if (mapChar(col, fenceRow) !== '.') continue; // не перекрываем дорогу
            const px = col * ts + ts / 2;
            const py = fenceRow * ts + ts / 2;
            if (this.textures.exists('tile_fence_h')) {
                this.add.image(px, py, 'tile_fence_h')
                    .setScale(ts / 32)
                    .setDepth(fenceRow + 0.3);
                const solid = this.solids.create(px, py, 'tile_fence_h');
                solid.setScale(ts / 32).refreshBody();
                solid.setVisible(false);
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
                // П.1-2: Если используем композит — анимаций нет, только меняем lastDir
                if (!this.player.useComposite) {
                    this.playerObj.play(`${this.player.sprite || 'player'}_walk_${dir}`, true);
                }
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
            // П.1-2: Если композит — не вызываем play/anims
            if (!this.player.useComposite) {
                this.playerObj.anims.pause();
                this.playerObj.play(`${this.player.sprite || 'player'}_idle_${this.lastDir}`, true);
            }
        }
        this.playerObj.setVelocity(v.x, v.y);
        // Псевдо-2.5D: обновляем глубину игрока по его Y-позиции каждый кадр
        this.playerObj.setDepth(this.playerObj.y / this.tileSize);

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
                const chestEntry = chestAt(cx, cy);
                if (chestEntry) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'chest', chest: chestEntry, label: `Открыть: ${chestEntry.label}` };
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

        // Ночное свечение окон: чем темнее, тем ярче тёплый свет в окнах
        if (this.windowGlows && timeState) {
            const h = timeState.hour;
            let dark = 0;
            if (h >= 21 || h < 5) dark = 1;
            else if (h >= 18) dark = (h - 18) / 3;   // 18→0 … 21→1
            else if (h < 8) dark = (8 - h) / 3;      // 5→1 … 8→0
            this.windowGlows.forEach(g => g.setAlpha(dark * 0.38));

            // Бабочки — на дне (светло), светлячки — ночью (темно)
            if (this.butterflies) {
                const day = 1 - dark;
                this.butterflies.forEach(b => {
                    b.setVisible(day > 0.25);
                    b.setAlpha(day);
                });
            }
            if (this.fireflies) {
                const now = this.time.now;
                this.fireflies.forEach(f => {
                    if (dark <= 0.35) {
                        f.setVisible(false);
                        return;
                    }
                    f.setVisible(true);
                    // Пульс: гаснут и разгораются вразнобой, параллельно лёгкий дрейф
                    const pulse = 0.35 + 0.55 * Math.sin(now * f.pulseSpeed + f.phase);
                    f.setAlpha(dark * Math.max(0, pulse));
                    f.x = f.homeX + Math.sin(now * 0.0011 + f.phase) * 26;
                    f.y = f.homeY + Math.cos(now * 0.0009 + f.phase * 1.7) * 18;
                });
            }

            // Домашняя живность (куры/коровы) на ночь прячется по домам
            if (this.farmAnimals) {
                const day = 1 - dark;
                this.farmAnimals.forEach(a => {
                    if (!a || !a.active) return;
                    a.setVisible(day > 0.3);
                    a.setAlpha(Math.min(1, day * 1.5));
                });
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
        } else if (this.nearestInteractable.type === 'chest') {
            // nearestInteractable.chest — сырой объект из CHESTS; нужен отрисованный
            // entry {data, img, marker} из this.chests
            const entry = (this.chests || []).find(e => e.data.id === this.nearestInteractable.chest.id);
            this.openChest(entry);
        }
    }

    // П.16,23: Подойти к двери и войти (упрощённо — телепорт + вход)
    walkToAndEnter(interiorId, tx, ty) {
        const ts = this.tileSize;
        // Телепортируем игрока к двери (встанем перед ней)
        this.playerObj.setVelocity(0, 0);
        this.playerObj.x = tx * ts + ts / 2;
        this.playerObj.y = (ty + 1) * ts + ts / 2;  // на тайл ниже двери
        if (this.playerObj.body) this.playerObj.body.reset(this.playerObj.x, this.playerObj.y);
        ActionLog.add(this.registry, `Игрок вошёл в здание.`);
        this.scene.pause();
        this.scene.launch('Interior', { interiorId: interiorId, from: 'Village' });
    }

    // П.5: Поп-ап тултип при наведении курсора на здание
    showBuildingTooltip(building, screenX, screenY) {
        if (!this.buildingTooltip) {
            this.buildingTooltip = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
            const bg = this.add.rectangle(0, 0, 240, 80, 0x000000, 0.9)
                .setStrokeStyle(1, 0xC9A961);
            this.buildingTooltipText = this.add.text(0, 0, '', {
                fontSize: '10px', color: '#E8DCC4',
                fontFamily: 'Arial, sans-serif',
                stroke: '#000', strokeThickness: 1,
                align: 'left',
                wordWrap: { width: 220 },
            }).setOrigin(0.5);
            this.buildingTooltip.add(bg);
            this.buildingTooltip.add(this.buildingTooltipText);
        }
        const interior = INTERIORS[building.interiorId];
        if (!interior) return;
        const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
        const npcRep = getNpcRep(this.registry, interior.npcId);
        const repLevel = getReputationLevel(npcRep);
        const timeState = getTime(this.registry);
        const hour = timeState ? timeState.hour : 12;
        const activity = this.npcData ? getNpcActivity(this.npcData, hour) : 'занят';
        const text = `${interior.name}\n${npcName}\nРеп: ${npcRep > 0 ? '+' : ''}${npcRep} (${repLevel.name})\n${activity}`;
        this.buildingTooltipText.setText(text);
        // Не выходим за правый край экрана
        const tx = Math.min(screenX + 120, this.scale.width - 130);
        const ty = Math.min(screenY + 40, this.scale.height - 90);
        this.buildingTooltip.setPosition(tx, ty);
        this.buildingTooltip.setVisible(true);
    }

    hideBuildingTooltip() {
        if (this.buildingTooltip) {
            this.buildingTooltip.setVisible(false);
        }
    }

    /**
     * Живность деревни: бабочки днём, светлячки ночью.
     * Видимость переключается в updateHUD() по «dark»-коэффициенту времени суток.
     */
    createAmbientCritters(ts) {
        // --- Текстура бабочки (крохотные крылышки, 10×8) ---
        if (!this.textures.exists('critter_butterfly')) {
            const g = this.add.graphics();
            g.fillStyle(0xffffff, 1);
            g.fillTriangle(0, 4, 5, 0, 5, 8);      // левое крыло
            g.fillTriangle(10, 4, 5, 0, 5, 8);     // правое крыло
            g.generateTexture('critter_butterfly', 10, 8);
            g.destroy();
        }

        // --- Бабочки (5 шт): порхают над травой и грядками днём ---
        this.butterflies = [];
        const tints = [0xf6e7a8, 0xe8c9e0, 0xd8e6c8];
        for (let i = 0; i < 5; i++) {
            const bx = Phaser.Math.Between(3, (MAP_W - 3)) * ts;
            const by = Phaser.Math.Between(4, (MAP_H - 4)) * ts;
            const b = this.add.image(bx, by, 'critter_butterfly')
                .setTint(tints[i % tints.length])
                .setAlpha(1)
                .setDepth(15)
                .setScale(1.2);
            // Порхание: «восьмёрка» — плавный дрейф + взмахи крыльев (flipX мигание)
            this.tweens.add({
                targets: b,
                x: bx + Phaser.Math.Between(-70, 70),
                y: by + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(2200, 3800),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
            this.tweens.add({
                targets: b,
                scaleX: { from: 1.2, to: 0.55 },   // «взмах» крыльев
                duration: 160,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
            this.butterflies.push(b);
        }

        // --- Светлячки (10 шт): зелёные искры над травой, пульсируют ночью ---
        // Пульс считаем в updateHUD() по синусоиде фазы — без отдельных твинов.
        this.fireflies = [];
        if (this.textures.exists('particle')) {
            for (let i = 0; i < 10; i++) {
                const fx = Phaser.Math.Between(2, (MAP_W - 2)) * ts;
                const fy = Phaser.Math.Between(3, (MAP_H - 3)) * ts;
                const f = this.add.image(fx, fy, 'particle')
                    .setTint(0xc8e86a)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setAlpha(0)
                    .setDepth(15)
                    .setScale(0.6);
                f.phase = Math.random() * Math.PI * 2;      // фаза пульса
                f.pulseSpeed = 0.0025 + Math.random() * 0.003; // индивидуальная скорость
                f.driftAngle = Math.random() * Math.PI * 2;   // случайный дрейф
                f.homeX = fx;
                f.homeY = fy;
                f.setVisible(false);
                this.fireflies.push(f);
            }
        }
    }

    /**
     * Клуб дыма из трубы: медленно всплывает, расширяется и тает.
     */
    puffSmoke(x, y, depth) {
        if (!this.textures.exists('particle_dust')) return;
        const smoke = this.add.image(x + Phaser.Math.Between(-4, 4), y, 'particle_dust')
            .setTint(0xcfc8bd)
            .setAlpha(0.4)
            .setScale(0.5)
            .setDepth(depth);
        this.tweens.add({
            targets: smoke,
            y: y - Phaser.Math.Between(34, 52),
            x: x + Phaser.Math.Between(-14, 14),
            alpha: 0,
            scale: 1.15,
            duration: 2600,
            ease: 'Sine.easeOut',
            onComplete: () => smoke.destroy(),
        });
    }

    /**
     * П.24: Показать информацию о здании
     */
    showBuildingInfo(interiorId) {
        const interior = INTERIORS[interiorId];
        if (!interior) return;
        // Здания без NPC (часовня, амбар): показываем описание вместо «репутации незнакомца»
        const noNpc = interior.noNpc || !interior.npcId;
        let info;
        if (noNpc) {
            info = `${interior.name}\n\n${interior.description || ''}`;
        } else {
            const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
            const npcRep = getNpcRep(this.registry, interior.npcId);
            const repLevel = getReputationLevel(npcRep);
            const timeState = getTime(this.registry);
            const hour = timeState ? timeState.hour : 12;
            const activity = this.npcData ? getNpcActivity(this.npcData, hour) : 'занят';
            info = `${interior.name}\n` +
                `NPC: ${npcName}\n` +
                `Личная репутация: ${npcRep > 0 ? '+' : ''}${npcRep} (${repLevel.name})\n` +
                `Сейчас: ${activity}`;
        }
        
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

    /**
     * П.2 + раунд 11: домашняя живность деревни на LPC-спрайтах.
     * Куры у амбара и у южной ленты, корова — на западе, у домов.
     * Ночью прячутся (updateHUD по dark-коэффициенту).
     */
    spawnChickens() {
        const ts = this.tileSize;
        this.farmAnimals = [];

        const defs = [
            { tex: 'animal_chicken_walk', col: 20, row: 7,  scale: 0.8,  speed: 14, eatChance: 0.3 },
            { tex: 'animal_chicken_walk', col: 22, row: 7,  scale: 0.8,  speed: 14, eatChance: 0.3 },
            { tex: 'animal_chicken_walk', col: 21, row: 10, scale: 0.85, speed: 14, eatChance: 0.3 },
            { tex: 'animal_chicken_walk', col: 9,  row: 14, scale: 0.8,  speed: 14, eatChance: 0.3 },
            { tex: 'animal_cow_walk',     col: 8,  row: 12, scale: 1.35, speed: 8,  eatChance: 0.5 },
        ];

        defs.forEach((def) => {
            if (!this.textures.exists(def.tex)) return;   // страховка от отсутствия ассета
            const px = def.col * ts + ts / 2;
            const py = def.row * ts + ts / 2;
            const spr = this.add.sprite(px, py, def.tex, 0);
            spr.setScale(def.scale);
            spr.setData('homeCol', def.col);
            spr.setData('homeRow', def.row);
            spr.setData('state', 'idle');
            spr.setData('stateTimer', 1200 + Math.random() * 2500);
            spr.setData('targetX', px);
            spr.setData('targetY', py);
            spr.setData('speed', def.speed);
            spr.setData('eatChance', def.eatChance);
            spr.setData('tex', def.tex);
            spr.setData('dir', 'down');
            spr.play(`${def.tex}_idle_down`);
            this.farmAnimals.push(spr);
        });

        // Таймер обновления состояний (раз в 500 мс — не мелькает)
        this.animalTimer = this.time.addEvent({
            delay: 500,
            callback: this.updateFarmAnimals,
            callbackScope: this,
            loop: true,
        });
    }

    /**
     * Обновление живности: idle → walk/eat → idle.
     * Без физики — просто двигаем спрайты, Y-сортировка по глубине.
     */
    updateFarmAnimals() {
        if (!this.farmAnimals) return;
        const ts = this.tileSize;
        const dt = 500;

        this.farmAnimals.forEach((a) => {
            if (!a || !a.active) return;
            const tex = a.getData('tex');
            let timer = a.getData('stateTimer') - dt;
            a.setData('stateTimer', timer);
            const state = a.getData('state');

            if (state === 'idle' && timer <= 0) {
                // Часть времени — «еда» (клевание/щипание травы), иначе прогулка
                if (Math.random() < a.getData('eatChance') && this.textures.exists(`${tex}_eat`)) {
                    a.play(`${tex}_eat`);
                    a.setData('state', 'eat');
                    a.setData('stateTimer', 1800 + Math.random() * 1500);
                    return;
                }
                const homeCol = a.getData('homeCol');
                const homeRow = a.getData('homeRow');
                const newCol = homeCol + (Math.random() * 4 - 2);
                const newRow = homeRow + (Math.random() * 4 - 2);
                a.setData('targetX', newCol * ts + ts / 2);
                a.setData('targetY', newRow * ts + ts / 2);
                a.setData('state', 'walk');
                a.setData('stateTimer', 2000 + Math.random() * 2000);
            } else if ((state === 'walk' || state === 'eat') && timer <= 0) {
                a.setData('state', 'idle');
                a.setData('stateTimer', 1500 + Math.random() * 2500);
                a.play(`${tex}_idle_${a.getData('dir') || 'down'}`);
            }

            if (state === 'walk') {
                const tx = a.getData('targetX');
                const ty = a.getData('targetY');
                const dx = tx - a.x;
                const dy = ty - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) {
                    const speed = a.getData('speed');
                    a.x += (dx / dist) * speed;
                    a.y += (dy / dist) * speed;
                    // Поворот мордочки по направлению движения
                    const dir = Math.abs(dx) > Math.abs(dy)
                        ? (dx > 0 ? 'right' : 'left')
                        : (dy > 0 ? 'down' : 'up');
                    if (dir !== a.getData('dir')) {
                        a.setData('dir', dir);
                        a.play(`${tex}_walk_${dir}`);
                    }
                } else {
                    a.setData('state', 'idle');
                    a.setData('stateTimer', 1500 + Math.random() * 2000);
                    a.play(`${tex}_idle_${a.getData('dir') || 'down'}`);
                }
            }
            // Живность участвует в Y-сортировке
            a.setDepth(a.y / ts + 0.5);
        });
    }

    /**
     * Раунд 11: сундуки с лутом. Отрисовка + восстановление состояния
     * «открыт сегодня» (из q.chestsOpened). Искра над неоткрытыми.
     */
    spawnChests(ts) {
        const q = this.registry.get('quest') || {};
        const today = dayKeyOf(getTime(this.registry));

        this.chests = CHESTS.map((chest) => {
            const px = chest.col * ts + ts / 2;
            const py = chest.row * ts + ts / 2;
            const opened = isOpenedToday(q, chest.id, today);

            // Мягкая тень под сундуком
            this.add.ellipse(px, py + 10, 30, 9, 0x000000, 0.22).setDepth(chest.row + 0.4);
            const img = this.add.image(px, py, opened ? 'chest_open' : 'chest_closed')
                .setScale(ts / 24)      // 24px текстура → 48px тайл
                .setDepth(chest.row + 0.45);

            // Искра над неоткрытым сундуком (у редкого — ярче и крупнее)
            let marker = null;
            if (!opened) {
                marker = this.add.image(px, py - 18, 'particle_spark')
                    .setTint(chest.rare ? 0xffd700 : 0xc9a14a)
                    .setDisplaySize(chest.rare ? 18 : 13, chest.rare ? 18 : 13)
                    .setDepth(chest.row + 0.5);
                this.tweens.add({
                    targets: marker,
                    alpha: { from: 0.55, to: 1 },
                    y: { from: py - 18, to: py - 22 },
                    duration: 900 + Math.random() * 300,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
            return { data: chest, img, marker };
        });
    }

    /**
     * Раунд 11: открытие сундука — раз в игровой день на сундук.
     * Лут по взвешенной таблице: деньги / яблоко (+2 HP) / медная иконка (+1 репутация).
     */
    openChest(entry) {
        if (!entry || this.busyDialog) return;
        const chest = entry.data;
        const player = this.registry.get('player');
        if (!player) return;

        const q = this.registry.get('quest') || {};
        const today = dayKeyOf(getTime(this.registry));

        if (isOpenedToday(q, chest.id, today)) {
            ActionLog.add(this.registry, `Заглянул в «${chest.label}» — уже обыскан сегодня.`);
            this.showFloatingText(entry.img.x, entry.img.y - 26, 'Уже обыскан', '#b8a88a');
            return;
        }

        markOpened(q, chest.id, today);
        this.registry.set('quest', q);

        // Крышка открывается, искра гаснет
        entry.img.setTexture('chest_open');
        if (entry.marker) {
            entry.marker.destroy();
            entry.marker = null;
        }

        // Лут
        const loot = rollLoot(chest);
        let msg = 'Пусто...';
        if (loot.kind === 'money') {
            const amount = Phaser.Math.Between(loot.min, loot.max);
            player.dengas = (player.dengas || 0) + amount;
            msg = lootDisplayName(loot, amount);
            this.audioManager.playSound('sfx_button_click');
        } else if (loot.kind === 'apple') {
            player.HP = Math.min(player.HPmax || player.HP + 2, player.HP + 2);
            msg = lootDisplayName(loot);
            this.audioManager.playSound('sfx_heal');
        } else if (loot.kind === 'icon_scrap') {
            const res = changeVillageRep(this.registry, 1, 'Медная иконка из ларца');
            msg = lootDisplayName(loot);
            this.audioManager.playSound('sfx_level_up');
            if (res && res.message) ActionLog.add(this.registry, res.message);
        }
        this.registry.set('player', player);
        this.updateHUD();

        // Эффекты: всплывающий текст + вспышка искр
        this.showFloatingText(entry.img.x, entry.img.y - 26, msg, chest.rare ? '#ffd700' : '#e8cc7a');
        const burst = this.add.particles(entry.img.x, entry.img.y, 'particle_spark', {
            speed: { min: 40, max: 90 },
            lifespan: 700,
            scale: { start: 0.5, end: 0 },
            tint: 0xe8cc7a,
            emitting: false,
        }).setDepth(150);
        burst.explode(chest.rare ? 14 : 9);
        this.time.delayedCall(1200, () => burst.destroy());

        tickTime(this.registry, 5);
        ActionLog.add(this.registry, `Обыскал «${chest.label}»: ${msg}.`);
    }

    /**
     * Раунд 11: всплывающий текст над точкой (для лута и подсказок).
     */
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

    /**
     * Раунд 11: полевые цветы и травяные кочки на травяных тайлах.
     * Зимой прячутся (снег). Без коллизий — декорация глубины 0.3.
     */
    scatterFlowers(ts) {
        this.flowers = [];
        const timeState = getTime(this.registry);
        const season = timeState ? getSeason(timeState.month) : 'summer';
        const winter = season === 'winter';
        const chestTiles = new Set(CHESTS.map(c => `${c.col},${c.row}`));

        for (let y = 1; y < MAP_H - 1; y++) {
            for (let x = 1; x < MAP_W - 1; x++) {
                if (this.map[y][x] !== '.') continue;
                if (chestTiles.has(`${x},${y}`)) continue;
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;

                if (Math.random() < 0.14) {
                    // Кластер из 1-2 цветков
                    const n = 1 + (Math.random() < 0.4 ? 1 : 0);
                    for (let i = 0; i < n; i++) {
                        const tex = `deco_flower_${Math.floor(Math.random() * 3)}`;
                        const f = this.add.image(px + (Math.random() * 30 - 15), py + (Math.random() * 26 - 13), tex)
                            .setScale(1.4 + Math.random() * 0.4)
                            .setDepth(0.3);
                        if (winter) f.setVisible(false);
                        // Покачивание на ветру — примерно половине цветков
                        if (Math.random() < 0.55) {
                            this.tweens.add({
                                targets: f,
                                angle: { from: -4, to: 4 },
                                duration: 1800 + Math.random() * 1600,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Sine.easeInOut',
                            });
                        }
                        this.flowers.push(f);
                    }
                } else if (Math.random() < 0.08) {
                    const g = this.add.image(px + (Math.random() * 24 - 12), py + (Math.random() * 24 - 12), 'deco_grass_tuft')
                        .setScale(1.3 + Math.random() * 0.5)
                        .setDepth(0.3);
                    if (winter) g.setVisible(false);
                    this.flowers.push(g);
                }
            }
        }
    }

    dirToVelocity(dir, speed) {
        switch (dir) {
            case 'down':  return { x: 0, y: speed };
            case 'up':    return { x: 0, y: -speed };
            case 'left':  return { x: -speed, y: 0 };
            case 'right': return { x: speed, y: 0 };
            default:      return { x: 0, y: 0 };
        }
    }
}

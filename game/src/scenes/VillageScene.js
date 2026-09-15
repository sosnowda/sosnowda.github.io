// Деревня-оверхорлд: хаб с зданиями, воротами, сменой дня/ночи.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import {
    buildMap, SOLID, tileTexture, roadTileSpec, validateMap, doorInteriorId, isGate,
    PLAYER_START, MAP_W, MAP_H, getVillageName, YARD_PROPS,
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
import { createButton, createDialog } from '../utils/ui.js';
import { tickTime, getTime, getDayNightOverlay, formatDateTime, getSeason } from '../systems/TimeSystem.js';
import { getWeather, applyWeatherVisuals, isRainy } from '../systems/Weather.js';
import { getVillageRep, getReputationLevel, checkExpulsion, checkVictory, getNpcRep, changeVillageRep } from '../data/reputation.js';
import { t, tf, tk } from '../systems/i18n.js';
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
                // Раунд 12: крест 'X' тоже высокий (Y-сортировка за/перед игроком)
                if (t === 'T' || t === '#' || t === 'W' || t === 'X') {
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
            barn: 'deco_barn',               // раунд 17: у амбара свой облик — широкие ворота и сеновал
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

        // ----- Воробьи на дорогах (§3 village-visual-upgrade, раунд 16) -----
        this.spawnBirdFlocks();

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

        // ----- Раунд 12: костёр, лампада креста и декор пруда -----
        this.createCampfire(ts);
        this.createCrossGlow(ts);
        this.decoratePond(ts);

        // ----- Раунд 17: рига, стога, поленница, телега (§3 village-visual-upgrade) -----
        this.drawYardProps(ts);

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

        // П.25: F1 — окно помощи (сцены 'Help' в сборке нет — фикс латентного бага,
        // ранее клавиша молча не работала: launch('Help') не находил сцену)
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ Помощь',
                tk('village.help.body',
                    'Управление: WASD/стрелки — движение, E/пробел — действие, ESC — меню.\n\n' +
                    '🏠 Подходи к дверям домов и жми E — внутри люди, работа и слухи.\n' +
                    '📦 Сундуки и тайники — раз в игровой день.\n' +
                    '🔥 Костёр — отдых, 🎣 причал — рыбалка, ✝ крест — молитва.\n' +
                    '🐺 За воротами, в Тёмном лесу, водятся волки — там же грибы и ягоды.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singletonKey: 'village-help' });
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

        // ----- Погода (раунд 14): затемнение + дождь/снег в экранных координатах.
        // День/ночь 90 → затемнение 92, осадки 96; HUD 100+ остаётся поверх.
        applyWeatherVisuals(this, { tintDepth: 92, precipDepth: 96 });

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
     * Раунд 17 (§3 village-visual-upgrade): хозяйственные постройки и детали
     * дворов — рига-сеновал, стога за амбаром, поленница у кузницы, телега.
     * Координаты берутся из YARD_PROPS (world.js), коллизии уже стоят ('H').
     * Рига слегка дымит — сушит снопы (овинный дух над околицей).
     */
    drawYardProps(ts) {
        const SPRITE_BY_ID = {
            riga: 'deco_riga',
            haystack: 'deco_haystack',
            firewood: 'deco_firewood',
            cart: 'deco_cart',
        };
        YARD_PROPS.forEach((p) => {
            const key = SPRITE_BY_ID[p.id];
            if (!key || !this.textures.exists(key)) return;
            const cx = p.col * ts + p.w * ts / 2;
            const cy = p.row * ts + p.h * ts / 2;
            const bottomRow = p.row + p.h;

            // Мягкая тень (псевдо-2.5D, как под домами)
            this.add.ellipse(cx, bottomRow * ts - 4, p.w * ts * 0.88, ts * 0.5, 0x000000, 0.22)
                .setDepth(bottomRow - 0.7);

            const isBig = p.id === 'riga';
            this.add.image(cx, cy, key)
                .setDisplaySize(p.w * ts + (isBig ? 16 : 6), p.h * ts + (isBig ? 14 : 4))
                .setDepth(bottomRow - 0.5);            // Y-сортировка

            if (p.id === 'riga' && this.smokeBuildings) {
                // Лёгкий овинный дымок над ригой — редкий, как из труб домов
                this.smokeBuildings.push({
                    x: cx - p.w * ts * 0.28,
                    y: p.row * ts - ts * 0.15,
                    depth: bottomRow + 1,
                });
            }
        });
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
        this.updateBirds();
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
                        nearest = { type: 'door', interiorId, label: b ? b.label : t('Войти') };
                    }
                }
                const chestEntry = chestAt(cx, cy);
                if (chestEntry) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'chest', chest: chestEntry, label: tf('Открыть: {0}', chestEntry.label) };
                    }
                }
                if (isGate(cx, cy)) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'gate', label: t('Выйти из деревни') };
                    }
                }

                // ----- Раунд 12: костёр, рыбалка у пруда, каменный крест -----
                const tile = (this.map[cy] && this.map[cy][cx] !== undefined) ? this.map[cy][cx] : null;
                if (tile === 'F') {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'campfire', label: t('Отдохнуть у костра (1 час)') };
                    }
                }
                if (tile === '~' || tile === 'P') {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'fish', label: t('Рыбалка') };
                    }
                }
                if (tile === 'X') {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'cross', label: t('Помолиться у креста (1 час)') };
                    }
                }
            }
        }

        this.nearestInteractable = nearest;
        if (nearest) {
            this.prompt.setText(tf('Нажмите E — {0}', nearest.label)).setVisible(true);
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
            // Раунд 14: иконка текущей погоды рядом с датой
            if (this.weather) statusLine += ` ${this.weather.icon}`;
        }
        if (turnsLeft > 0 && !q.thiefDefeated && !q.thiefEscaped) {
            statusLine += `  ${tf('⏳{0}ход', turnsLeft)}`;
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

            // Раунд 12: костёр — тёплый свет с живым мерцанием
            if (this.campfireGlow) {
                const nowGlow = this.time.now;
                const flick = 0.85 + 0.15 * Math.sin(nowGlow * 0.011) * Math.sin(nowGlow * 0.007);
                this.campfireGlow.setAlpha((0.10 + dark * 0.24) * flick);
            }
            // Раунд 12: лампада у каменного креста — тихий свет ночью
            if (this.crossGlow) {
                this.crossGlow.setAlpha(dark * 0.22);
            }
            // Раунд 12: зимний пруд — лёд, кувшинки спрятаны, камыш блёклый
            if (this.waterTiles) {
                const winter = getSeason(timeState.month) === 'winter';
                this.waterTiles.forEach(w => w.img.setTint(winter ? 0xb8d4e8 : 0xffffff));
                if (this.lilypads) this.lilypads.forEach(p => p.setVisible(!winter));
                if (this.reeds) this.reeds.forEach(r => r.setAlpha(winter ? 0.75 : 1));
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
        } else if (this.nearestInteractable.type === 'campfire') {
            this.restAtCampfire();
        } else if (this.nearestInteractable.type === 'fish') {
            this.goFishing();
        } else if (this.nearestInteractable.type === 'cross') {
            this.prayAtCross();
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
        const text = `${interior.name}\n${npcName}\n${tf('Реп: {0} ({1})', `${npcRep > 0 ? '+' : ''}${npcRep}`, t(repLevel.name))}\n${activity}`;
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
     * Воробьиные стайки (§3 атмосфера деревни, раунд 16): сидят у колодца
     * и перед таверной, клюют зерно; при приближении героя разлетаются,
     * через время возвращаются, если герой отошёл. Ночью спрятаны.
     */
    spawnBirdFlocks() {
        this.birds = [];
        if (!this.textures.exists('deco_bird')) return;
        const ts = this.tileSize;

        // Якоря стай: у колодца (если есть) и перед второй дверью (таверна)
        const anchors = [];
        if (this.wellTiles && this.wellTiles.length) {
            const w = this.wellTiles[0];
            anchors.push({ x: (w.x + 2.6) * ts, y: (w.y + 0.7) * ts });
        }
        if (this.doors && this.doors.length > 1) {
            const d = this.doors[1];
            anchors.push({ x: (d.x + 2.4) * ts, y: (d.y + 1.2) * ts });
        }

        anchors.forEach((a, fi) => {
            const count = 4 + (fi % 2);
            for (let i = 0; i < count; i++) {
                const hx = a.x + ((i * 23 + fi * 11) % 46) - 23;
                const hy = a.y + ((i * 31 + fi * 7) % 30) - 15;
                const img = this.add.image(hx, hy, 'deco_bird')
                    .setScale(ts / 32 * 1.15)
                    .setDepth(hy / ts);
                this.birds.push({
                    img,
                    homeX: hx, homeY: hy,
                    x: hx, y: hy,
                    state: 'idle',          // idle | fly | away
                    hopAt: this.time.now + 400 + i * 500 + fi * 300,
                    awayUntil: 0,
                });
            }
        });
    }

    /**
     * Обновление воробьёв: прыжки-клёв в стае, разлёт от героя, возврат.
     * Вызывается из update() каждый кадр; ночью (dark > 0.5) птицы спрятаны.
     */
    updateBirds() {
        if (!this.birds || !this.birds.length) return;
        const ts = this.tileSize;
        const now = this.time.now;
        const dark = this.darkFactor(getTime(this.registry));
        const hidden = dark > 0.5;
        const px = this.playerObj ? this.playerObj.x : -9999;
        const py = this.playerObj ? this.playerObj.y : -9999;

        this.birds.forEach((b) => {
            if (hidden) {
                b.img.setVisible(false);
                b.state = 'idle';
                return;
            }
            b.img.setVisible(true);

            if (b.state === 'idle') {
                // Клёв и мелкие прыжки
                if (now >= b.hopAt && !this.tweens.isTweening(b.img)) {
                    b.hopAt = now + 900 + Math.random() * 2200;
                    const nx = b.homeX + Phaser.Math.Between(-18, 18);
                    const ny = b.homeY + Phaser.Math.Between(-11, 11);
                    this.tweens.add({
                        targets: b.img,
                        x: nx, y: ny,
                        scaleY: { from: ts / 32 * 1.15, to: ts / 32 * 0.85 },
                        yoyo: true,
                        duration: 170,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            b.x = nx; b.y = ny;
                            b.img.setDepth(ny / ts);
                            b.img.setScale(ts / 32 * 1.15);
                        },
                    });
                }
                // Герой близко — разлетаемся
                const dist = Phaser.Math.Distance.Between(b.x, b.y, px, py);
                if (dist < 76) {
                    b.state = 'fly';
                    const dx = b.x - px, dy = b.y - py;
                    const len = Math.max(1, Math.hypot(dx, dy));
                    const fx = b.x + (dx / len) * Phaser.Math.Between(120, 190);
                    const fy = b.y + (dy / len) * Phaser.Math.Between(90, 140) - 55;
                    b.img.setFlipX(fx < b.x);
                    this.tweens.killTweensOf(b.img);
                    this.tweens.add({
                        targets: b.img,
                        x: fx, y: fy,
                        scaleX: ts / 32 * 1.35,
                        duration: 620,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            b.state = 'away';
                            b.awayUntil = now + 6000 + Math.random() * 6000;
                            b.img.setAlpha(0);
                        },
                    });
                    // Взмахи — частое подрагивание scaleY
                    this.tweens.add({
                        targets: b.img,
                        scaleY: { from: ts / 32 * 1.2, to: ts / 32 * 0.55 },
                        duration: 90,
                        yoyo: true,
                        repeat: 6,
                    });
                }
            } else if (b.state === 'away') {
                // Отсиделись — если герой отошёл от места кормёжки, вернуться
                const homeDist = Phaser.Math.Distance.Between(px, py, b.homeX, b.homeY);
                if (now >= b.awayUntil && homeDist > 150) {
                    b.state = 'idle';
                    b.x = b.homeX; b.y = b.homeY;
                    b.img.setPosition(b.homeX, b.homeY);
                    b.img.setScale(ts / 32 * 1.15);
                    b.img.setAlpha(0);
                    this.tweens.add({
                        targets: b.img,
                        alpha: 1,
                        duration: 500,
                    });
                    b.hopAt = now + 300;
                }
            }
        });
    }

    /**
     * Коэффициент темноты 0..1 (пороги согласованы с updateHUD).
     */
    darkFactor(timeState) {
        if (!timeState) return 0;
        const h = timeState.hour;
        if (h >= 21 || h < 5) return 1;
        if (h >= 18) return (h - 18) / 3;
        if (h < 8) return (8 - h) / 3;
        return 0;
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
                `${tf('NPC: {0}', npcName)}\n` +
                `${tf('Личная репутация: {0} ({1})', `${npcRep > 0 ? '+' : ''}${npcRep}`, t(repLevel.name))}\n` +
                `${tf('Сейчас: {0}', activity)}`;
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
            // Раунд 12: курица (9,14) переехала — на её месте теперь пруд
            { tex: 'animal_chicken_walk', col: 12, row: 14, scale: 0.8,  speed: 14, eatChance: 0.3 },
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
                // Часть времени — «еда» (клевание/щипание травы), иначе прогулка.
                // Раунд 12 ФИКС: анимация еды называется animal_chicken_eat
                // (без _walk), а не animal_chicken_walk_eat.
                const eatAnim = `${tex.replace('_walk', '_eat')}`;
                if (Math.random() < a.getData('eatChance') && this.anims.exists(eatAnim)) {
                    a.play(eatAnim);
                    a.setData('state', 'eat');
                    a.setData('stateTimer', 1800 + Math.random() * 1500);
                    return;
                }
                const homeCol = a.getData('homeCol');
                const homeRow = a.getData('homeRow');
                let newCol = homeCol + (Math.random() * 4 - 2);
                let newRow = homeRow + (Math.random() * 4 - 2);
                // Раунд 12 ФИКС: животные не наступают на непроходимое
                // (вода, камни, колодец, сундуки, крест) — цель прогулки
                // проверяется по SOLID, при попадании остаётся на месте.
                if (this.isSolidTile(newCol, newRow)) {
                    newCol = homeCol;
                    newRow = homeRow;
                }
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
                        // Раунд 12 ФИКС: у животных walk-анимации называются
                        // animal_chicken_walk_down (без двойного _walk_).
                        a.play(`${tex}_${dir}`);
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

    // ================================================================
    // РАУНД 12: костёр, каменный крест, пруд с причалом и рыбалка
    // ================================================================

    /**
     * Костёр у таверны (тайл 'F'): анимированное пламя из 3 кадров, тёплый
     * свет с мерцанием (updateHUD), редкий дымок. Отдых — через tryInteract.
     */
    createCampfire(ts) {
        const col = 12, row = 7;
        const cx = col * ts + ts / 2;
        const cy = row * ts + ts / 2;

        // Мягкая тень под камнями
        this.add.ellipse(cx, cy + 10, 42, 12, 0x000000, 0.22).setDepth(row + 0.3);
        // Основание: каменное кольцо + поленья (тайл 'F' уже нарисовал траву)
        this.add.image(cx, cy + 4, 'campfire_base').setScale(1.5).setDepth(row + 0.4);

        // Пламя — 3 кадра поверх основания, ADD-режим для жара
        this.campfireFlame = this.add.image(cx, cy - 6, 'campfire_flame_0')
            .setScale(1.4)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(row + 0.5);
        let flameFrame = 0;
        this.time.addEvent({
            delay: 180,
            loop: true,
            callback: () => {
                flameFrame = (flameFrame + 1) % 3;
                if (this.campfireFlame && this.textures.exists(`campfire_flame_${flameFrame}`)) {
                    this.campfireFlame.setTexture(`campfire_flame_${flameFrame}`);
                }
            },
        });

        // Тёплый свет на земле — яркость задаётся в updateHUD (день/ночь + мерцание)
        this.campfireGlow = this.add.ellipse(cx, cy + 6, 100, 54, 0xff9a3a, 0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(row + 0.35);

        // Дымок над костром (реже, чем из труб домов)
        this.time.addEvent({
            delay: 1400,
            loop: true,
            callback: () => this.puffSmoke(cx + 4, cy - 20, row + 0.6),
        });
    }

    /**
     * Каменный крест (3,12): «лампада» — мягкое золотое свечение у подножия
     * ночью (альфа задаётся в updateHUD по dark-коэффициенту).
     */
    createCrossGlow(ts) {
        const cx = 3 * ts + ts / 2;
        const cy = 12 * ts + ts / 2;
        this.crossGlow = this.add.ellipse(cx, cy + 8, 46, 18, 0xffc866, 0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(12 + 0.35);
    }

    /**
     * Декор пруда: камыш по берегам (с покачиванием) и кувшинки на воде.
     * Камыш ищется автоматически: береговой тайл ('.'/'S') вплотную к воде;
     * зимой камыш блёкнет, кувшинки прячутся (updateHUD).
     */
    decoratePond(ts) {
        this.reeds = [];
        this.lilypads = [];
        const reedSpots = new Set();
        for (let y = 1; y < MAP_H - 1; y++) {
            for (let x = 1; x < MAP_W - 1; x++) {
                if (this.map[y][x] !== '~') continue;
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;
                // Кувшинки: на части водных тайлов (не под причалом)
                if ((x + y) % 2 === 0 || (x * 7 + y * 3) % 4 === 0) {
                    this.lilypads.push(this.add.image(px - 8, py + 7, 'deco_lilypad')
                        .setScale(1.4)
                        .setDepth(y + 0.2));
                }
                // Камыш: соседний с водой берег, не на южной дороге (ряд 16)
                [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
                    const bx = x + dx;
                    const by = y + dy;
                    const bt = (this.map[by] && this.map[by][bx] !== undefined) ? this.map[by][bx] : null;
                    if (bt !== '.' && bt !== 'S') return;
                    if (by >= MAP_H - 2) return;
                    const key = `${bx},${by}`;
                    if (reedSpots.has(key) || reedSpots.size >= 8) return;
                    reedSpots.add(key);
                    const reed = this.add.image(
                        bx * ts + ts / 2 + dx * ts * 0.28,
                        by * ts + ts / 2 + dy * ts * 0.28,
                        'deco_reed'
                    ).setScale(1.5).setDepth(by + 0.42);
                    this.reeds.push(reed);
                    this.tweens.add({
                        targets: reed,
                        angle: { from: -3, to: 3 },
                        duration: 1500 + (bx * 137) % 600,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                    });
                });
            }
        }
    }

    /** Непроходим ли тайл (для блуждания живности). Вне карты — непроходим. */
    isSolidTile(col, row) {
        if (!this.map || !this.map[row] || this.map[row][col] === undefined) return true;
        return SOLID.has(this.map[row][col]);
    }

    /**
     * Раунд 12: отдых у костра — 1 час, HP и Воля до максимума (§5.4 роадмапа).
     * Если силы полны — время не тратится.
     */
    restAtCampfire() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const hpMax = player.HPmax || player.HP;
        const mpMax = player.MPmax || player.MP;
        if (player.HP >= hpMax && player.MP >= mpMax) {
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, 'Ты полон сил', '#b8a88a');
            ActionLog.add(this.registry, 'Погрелся у костра — силы и так полны.');
            return;
        }
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        createDialog(this, '🔥 Костёр',
            'Тёплый огонь разгоняет усталость. Присесть на минутку — а очнёшься через час крепкого сна.\n\nОтдохнуть у костра? (1 час — здоровье и Воля восстановятся полностью.)',
            [
                { text: 'Присесть у огня', callback: () => {
                    close();
                    this.cameras.main.fadeOut(700, 0, 0, 0);
                    this.time.delayedCall(750, () => {
                        tickTime(this.registry, 60);
                        player.HP = hpMax;
                        player.MP = mpMax;
                        this.registry.set('player', player);
                        this.updateHUD();
                        this.audioManager.playSound('sfx_heal');
                        ActionLog.add(this.registry, 'Отдохнул у костра — час крепкого сна, силы восстановились.');
                        this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, 'Силы восстановились', '#8fdc7a');
                        this.cameras.main.fadeIn(700, 0, 0, 0);
                    });
                } },
                { text: 'Не сейчас', callback: close },
            ]);
    }

    /**
     * Раунд 12: рыбалка у пруда (§5.1 роадмапа) — E у воды или на причале.
     * Первый улов за день: свежая рыба +3 ❤, уходит 1 час. Повторно —
     * «не клюёт», уходит 15 минут. Зимой — лунка во льду.
     */
    goFishing() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const q = this.registry.get('quest') || {};
        const timeState = getTime(this.registry);
        const today = dayKeyOf(timeState);
        const winter = timeState ? getSeason(timeState.month) === 'winter' : false;
        const caught = isOpenedToday(q, 'fish_daily', today);

        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        const title = winter ? '🎣 Лунка во льду' : '🎣 Рыбалка';

        if (!caught) {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(550, () => {
                tickTime(this.registry, 60);
                markOpened(q, 'fish_daily', today);
                this.registry.set('quest', q);
                // Раунд 14: в дождь рыба активнее — улов заметно богаче (+4 вместо +3)
                const raining = this.weather && isRainy(this.weather);
                const heal = raining ? 4 : 3;
                player.HP = Math.min(player.HPmax || player.HP + heal, player.HP + heal);
                this.registry.set('player', player);
                this.updateHUD();
                this.audioManager.playSound('sfx_heal');
                this.cameras.main.fadeIn(500, 0, 0, 0);
                ActionLog.add(this.registry, winter
                    ? `Порыбачил через лунку — налим к ужину (+${heal} ❤).`
                    : (raining
                        ? `Дождь — рыба идёт на крючок смело. Отличный улов (+${heal} ❤).`
                        : `Наловил рыбы к обеду (+${heal} ❤).`));
                createDialog(this, title,
                    (winter
                        ? 'Прорубаешь лунку и долго ждёшь, грея пальцы... Поплавок дёргается — на льду бьётся налим. Ужин обеспечен.'
                        : raining
                            ? 'Забросил удочку с причала под моросящим дождём... Рыба клюёт одна за другой — вёдра полные!'
                            : 'Забросил удочку с причала... Через час в корзине пара ершей и лещ. Свежая рыба — это силы.')
                    + `\n\nСвежая рыба: +${heal} ❤.`,
                    [{ text: 'Взять улов', callback: close }]);
            });
        } else {
            tickTime(this.registry, 15);
            this.updateHUD();
            ActionLog.add(this.registry, 'Порыбачил — клёв плохой.');
            createDialog(this, title,
                'Клюёт плохо: рыба сыта или уже видела твою наживку. Попробуй завтра.',
                [{ text: 'Смотать удочку', callback: close }]);
        }
    }

    /**
     * Раунд 12: молитва у каменного креста — 1 час, +2..5 Воли, раз в день
     * (тихая альтернатива часовне, §5.1 роадмапа).
     */
    prayAtCross() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const q = this.registry.get('quest') || {};
        const today = dayKeyOf(getTime(this.registry));
        if (isOpenedToday(q, 'cross_prayer', today)) {
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, 'Душа уже очистилась сегодня', '#b8a88a');
            ActionLog.add(this.registry, 'Помолился у креста (уже молился сегодня).');
            return;
        }
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.time.delayedCall(550, () => {
            tickTime(this.registry, 60);
            markOpened(q, 'cross_prayer', today);
            this.registry.set('quest', q);
            const gain = Phaser.Math.Between(2, 5);
            player.MP = Math.min(player.MPmax || player.MP + gain, player.MP + gain);
            this.registry.set('player', player);
            this.updateHUD();
            this.audioManager.playSound('sfx_level_up');
            // Золотые искры у подножия креста
            const cx = 3 * this.tileSize + this.tileSize / 2;
            const cy = 12 * this.tileSize + this.tileSize / 2;
            const burst = this.add.particles(cx, cy, 'particle_spark', {
                speed: { min: 18, max: 52 },
                lifespan: 900,
                scale: { start: 0.5, end: 0 },
                tint: 0xffd700,
                emitting: false,
            }).setDepth(150);
            burst.explode(10);
            this.time.delayedCall(1300, () => burst.destroy());
            this.cameras.main.fadeIn(500, 0, 0, 0);
            ActionLog.add(this.registry, `Помолился у каменного креста — Воля +${gain}.`);
            createDialog(this, '🕯 Молитва у креста',
                `Древний крест у околицы помнит ещё прадедов. Ты кладёшь ладонь на тёплый камень, и тревога отпускает.\n\nВоля восстановлена: +${gain}.`,
                [{ text: 'Поклониться кресту', callback: close }]);
        });
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

                // Раунд 15: зимой — снежные намети вместо цветов (стилизация травы)
                if (winter && Math.random() < 0.12) {
                    const s = this.add.image(px + (Math.random() * 22 - 11), py + (Math.random() * 22 - 11), 'deco_snow_patch')
                        .setScale(0.9 + Math.random() * 0.9)
                        .setDepth(0.29)
                        .setAlpha(0.9);
                    this.flowers.push(s); // единый массив сезонной декорации
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

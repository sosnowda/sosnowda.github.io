// ============================================================
// OUTDOOR LOCATION BASE (§12.3 аудита 66.92, эшелон 3, 66.96).
// ============================================================
// Аудит (P3, «OutdoorLocationBase для Forest/Apiary»): «Вынести ~300 строк
// клонированного HUD/движения/подсказок в общий базовый модуль; правило
// „баг правится один раз“».
//
// Фактически клонированы между ForestScene и ApiaryScene: spawnPlayer (92%),
// movePlayer (96%), update (91%), drawExitMarker (98%), showFloatingText
// (100%), buildHUD (82%), buildAtmosphere (73%), общий префикс create()
// (аудио/мировые часы/границы/трава/солнечный свет/управление) и ядро
// updateHUD. Базовый класс принимает КОНФИГ локации (this.locCfg) и даёт
// крюки (hooks) для локальной специфики — см. комментарии у каждого метода.
//
// ВАЖНО: параметры баланса вынесены в конфиг, а НЕ захардкожены:
//   • stepTickMinutes — минут игры за шаг (лес 0.25, пасека 1 — раунд 22 п.5);
//   • bellsVolume, bgColor, veil, лучи/туман/светлячки — атмосфера локаций.
//
// Крюки, которые СЦЕНА может/должна определить:
//   this.validateMap()        → { problems: [] }        (QA проходимости)
//   this.drawWorld()          → тайлы/декор мира        (обязательный)
//   this.attachSunCasters()   → sunLight.addCaster(...) (обязательный)
//   this.spawnWorldObjects()  → сборные точки/ульи…     (обязательный)
//   this.afterSpawn?.()       → волки/дичь/пчёлы после героя
//   this.pauseActors?.()      → стоп актёров при открытом диалоге
//   this.updateActors?.(time) → локальные актёры в update()
//   this.onPlayerSpawned?.()  → NPC пасеки рядом с героем
//   this.hudTitle()           → { text, color }         (обязательный)
//   this.hudExtras?.()        → beeHint / баннер «стая напугана»
//   this.onHudBuilt?.()       → onLocationVisited('forest')
//   this.atmoMid?.()          → листва/пыльца (между лучами и туманом)
//   this.atmoExtras?.()       → wolfAggroRadius после рассветной мглы
//   this.hudStatusExtra?.()   → строка голода/усталости в статус-бар леса
//   this.afterHudCommon?.()   → кострище/дымокур/пыльца в updateHUD
//   this.createTail?.()       → охота на вора/встреча (хвост create)
// Phaser загружен глобально через CDN (как во всех модулях игры) — без импорта
import { tickTime, getTime, formatDateTime, getDayNightOverlay } from './TimeSystem.js';
import { applyWeatherVisuals } from './Weather.js';
import { addMorningFog } from './AmbientFX.js';
import { attachSunLight } from './SunLight.js';
import { checkGameEnd } from '../data/thief.js';
import AudioManager from './AudioManager.js';
import { VirtualControls } from './VirtualControls.js';
import { formatMoney } from './Character.js';
import { getVillageRep } from '../data/reputation.js';
import { villageRepStatusSuffix } from './repBalance.js';
import { t } from './i18n.js';
import { attachChurchBells } from './ChurchBells.js';
import { attachWorldClock } from './WorldClock.js';
import { addSettingsGearButton } from './SettingsPanel.js';
// 66.37: калибровка масштаба мировых листов персонажей 128px (были 64)
import { WORLD_K, WORLD_BODY_PX } from './WorldLook.js';

export class OutdoorLocationBase extends Phaser.Scene {
    /**
     * @param {string} key ключ сцены ('Forest'/'Apiary')
     * @param {object} cfg конфиг локации (см. DEFAULTS ниже)
     */
    constructor(key, cfg = {}) {
        super(key);
        this.sceneKey = key;
        this.locCfg = Object.assign({
            ts: 48,                 // тайл мира (как в деревне)
            speed: 160,             // скорость героя, px/с
            stepInterval: 350,      // мс между шагами (звук + тик времени)
            stepTickMinutes: 1,     // минут игры за шаг (лес 0.25 / пасека 1)
            bellsVolume: 0.3,       // громкость колоколов
            bgColor: 0x0e1a0e,      // фон камеры
            returnPosKey: null,     // ключ registry для возврата после боя
            fromDefault: 'Fork',    // откуда вошли по умолчанию
            exitLabel: '◀ К ОКОЛИЦЕ',
            spawn: null,            // { col, row } — точка входа (обязательно)
            exit: null,             // { col, row } — выход к околице (обязательно)
            veilColor: 0x0a140a,    // вечная мгла локации
            veilAlpha: 0.16,
            raysCount: 3,           // световые столбы
            raysWidth: i => 26 + (i * 17) % 30,
            raysOffsetX: i => (i % 2 === 0 ? -20 : 20),
            raysOffsetY: i => -40 + (i % 2) * 20,
            raysAngle: i => (i % 2 === 0 ? 10 : -9),
            raysAlphaTo: 0.075,
            raysDuration: i => 2800 + i * 500,
            fogCount: 5,            // клочья тумана
            fogScale: () => 1.2 + Math.random() * 1.4,
            fogAlpha: 0.04,         // число или () => число (лес — случайная)
            fogDriftX: 70,
            fogYDrift: null,        // () => dy — вертикальный дрейф (лес)
            fogDuration: () => 11000 + Math.random() * 6000,
            fireflies: 7,           // светлячки
            fogDayAlpha: 0.03,      // updateHUD: днём
            fogNightAlpha: 0.08,    // updateHUD: ночью
        }, cfg);
    }

    // ============================================================
    //  ОБЩАЯ ИНИЦИАЛИЗАЦИЯ (init/create)
    // ============================================================

    /** Вызвать из init(data) сцены: from + возврат после боя. */
    outdoorInit(data) {
        this.from = (data && data.from) || this.locCfg.fromDefault;
        this.returnPos = this.locCfg.returnPosKey
            ? this.registry.get(this.locCfg.returnPosKey) || null
            : null;
        if (this.locCfg.returnPosKey) this.registry.set(this.locCfg.returnPosKey, null);
    }

    /** Общий каркас create() до/после локальных спавнов (см. шапку модуля). */
    createOutdoorCore() {
        const ts = this.locCfg.ts;
        this.ts = ts;
        this.worldW = this.worldCols * ts;
        this.worldH = this.worldRows * ts;

        this.audioManager = new AudioManager(this);
        // 66.68 (§9.3): переиспользуемый вектор движения + кэш idle-ключа
        this._moveVec = new Phaser.Math.Vector2(0, 0);
        this._idleKey = ''; this._idleKeyDir = null;
        // Раунд 31 (пп.11,12): мировые часы идут реальным временем (в диалогах стоят)
        attachWorldClock(this);
        attachChurchBells(this, { volume: this.locCfg.bellsVolume });
        this.audioManager.playSceneMusic('village');
        // Раунд 24: эмбиент — птицы днём, сверчки ночью
        const fsTime = getTime(this.registry);
        const fsHour = fsTime ? fsTime.hour : 12; // раунд 31: фикс .hours → .hour
        this.audioManager.setAmbient((fsHour >= 21 || fsHour < 5)
            ? 'ambient_forest_night'
            : 'ambient_forest_day');

        // ----- QA-валидация проходимости (как в деревне) -----
        const validation = this.validateMap ? this.validateMap() : { problems: [] };
        if (validation.problems.length) {
            console.warn(`[${this.sceneKey}] Проблемы проходимости:`, validation.problems);
        }

        this.cameras.main.setBackgroundColor(this.locCfg.bgColor);
        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        // Раунд 20: бесконечная трава за границами мира —
        // при RESIZE окно бывает шире мира, иначе по краям пустота фона.
        if (this.textures.exists('tile_grass_0')) {
            const pad = 2000;
            const back = this.add.tileSprite(-pad, -pad, this.worldW + pad * 2, this.worldH + pad * 2, 'tile_grass_0')
                .setOrigin(0, 0).setDepth(-10);
            back.setTileScale(1.5, 1.5);
        }

        this.solids = this.physics.add.staticGroup();
        this.fireflies = [];
        this.busyDialog = false;
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = this.locCfg.stepInterval;

        // ---- локальная часть: массивы состояния, карта, погода, кастеры ----
        this.beforeWorld?.();
        this.drawWorld();
        // Патч 66.46 (приказ 2): солнечный свет — ДО спавна героя (он станет
        // «следящей» тенью). Тени лежат на земле (0.35): выше тайлов (0.1),
        // ниже деревьев/ульёв (y+0.55); тёплый слой — под вечной мглой (94).
        this.sunLight = attachSunLight(this, { shadowDepth: 0.35, overlayDepth: 92.5 });
        this.attachSunCasters();
        this.spawnWorldObjects();
        this.drawExitMarker();
        this.spawnPlayer();
        this.afterSpawn?.();
        this.buildAtmosphere();
        this.buildHUD();

        // ----- Управление (общее для всех outdoor-локаций) -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
        // F1 — окно помощи (в сборке нет сцены 'Help' — показываем диалог)
        this.input.keyboard.on('keydown-F1', () => this.showHelpDialog());
        this.input.keyboard.on('keydown-ESC', () => this.scene.start('Title'));
        this.virtualControls = new VirtualControls(this);
        this.createTail?.();
    }

    // ============================================================
    //  ГЕРОЙ (spawnPlayer — канон Forest/Apiary, был клон 92%)
    // ============================================================

    spawnPlayer() {
        const ts = this.ts;
        this.player = this.registry.get('player');
        const spawn = this.locCfg.spawn;
        const pos = this.returnPos || {
            x: spawn.col * ts + ts / 2,
            y: spawn.row * ts + ts / 2,
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
        this.playerObj.setScale(ts / 32 * 0.75 * WORLD_K);
        // Честный хитбокс (урок раунда 7): фигура в центре кадра
        if (this.playerObj.body) this.playerObj.body.setSize(WORLD_BODY_PX, WORLD_BODY_PX, true);
        this.playerObj.setCollideWorldBounds(true);
        this.physics.add.collider(this.playerObj, this.solids);
        this.playerObj.setDepth(this.playerObj.y / ts);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // Тень под ногами — патч 66.46: СЛЕДЯЩАЯ, по солнцу
        if (this.sunLight) this.sunLight.follow(this.playerObj, 12, 4.2, 1);
        this.onPlayerSpawned?.();
    }

    /** Маркер выхода к околице (был клон 98%). */
    drawExitMarker() {
        const ts = this.ts;
        const exit = this.locCfg.exit;
        const px = exit.col * ts + ts / 2;
        const py = exit.row * ts + ts / 2;
        const label = this.add.text(px, py - ts * 1.6, t(this.locCfg.exitLabel), {
            fontSize: '13px', color: '#E8DCC4', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000088', padding: { x: 5, y: 2 },
        }).setOrigin(0.5).setDepth(0.7);
        this.tweens.add({ targets: label, alpha: { from: 1, to: 0.55 }, duration: 1100, yoyo: true, repeat: -1 });
    }

    // ============================================================
    //  АТМОСФЕРА (был клон 73% — мгла/день-ночь/лучи/туман/светлячки)
    // ============================================================

    buildAtmosphere() {
        const { width, height } = this.scale;
        const c = this.locCfg;

        // Вечная мгла локации (в лесу темнее — через cfg)
        this.add.rectangle(0, 0, width, height, c.veilColor, c.veilAlpha)
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
        for (let i = 0; i < c.raysCount; i++) {
            const ray = this.add.rectangle(
                (i + 0.5) * (width / c.raysCount) + c.raysOffsetX(i),
                c.raysOffsetY(i),
                c.raysWidth(i), height + 120,
                0xfff2c0, 0.05,
            ).setOrigin(0.5, 0).setAngle(c.raysAngle(i))
                .setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setDepth(93);
            this.godRays.push(ray);
            this.tweens.add({
                targets: ray,
                alpha: { from: 0.03, to: c.raysAlphaTo },
                duration: c.raysDuration(i),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }

        // Крюк: локальная «средняя» частица (листва леса / пыльца пасеки)
        this.atmoMid?.();

        // Клочья тумана — в мировых координатах, медленно дрейфуют
        this.fogPuffs = [];
        const fogA = typeof c.fogAlpha === 'function' ? c.fogAlpha : () => c.fogAlpha;
        for (let i = 0; i < c.fogCount; i++) {
            const puff = this.add.image(
                Math.random() * this.worldW, Math.random() * this.worldH,
                'fog_puff',
            ).setScale(c.fogScale())
                .setAlpha(fogA())
                .setDepth(96);
            const drift = { x: puff.x + (Math.random() - 0.5) * c.fogDriftX };
            if (c.fogYDrift) drift.y = puff.y + c.fogYDrift();
            this.tweens.add({
                targets: puff,
                ...drift,
                duration: c.fogDuration(),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this.fogPuffs.push(puff);
        }

        // ----- Погода (раунд 14): дождь/снег на локации. Осадки поверх (99).
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 99 });

        // Раунд 28 (п.4): утренний туман (с рассвета до 9 утра)
        addMorningFog(this, {
            width: this.worldW, height: this.worldH,
            yMin: 2 * this.ts, yMax: this.worldH - 2 * this.ts, depth: 90,
        });
        // Крюк: локальные следствия погоды (радиус агро волков в лесу)
        this.atmoExtras?.();

        // Светлячки — проявляются ночью (как в деревне)
        for (let i = 0; i < c.fireflies; i++) {
            const fx = (24 + Math.random() * (this.worldW - 48));
            const fy = (24 + Math.random() * (this.worldH - 48));
            const f = this.add.image(fx, fy, 'particle_spark')
                .setScale(0.45).setTint(0xd8ffa0).setDepth(97).setVisible(false);
            f.homeX = fx; f.homeY = fy;
            f.phase = Math.random() * Math.PI * 2;
            f.pulseSpeed = 0.002 + Math.random() * 0.0022;
            this.fireflies.push(f);
        }
    }

    // ============================================================
    //  HUD (был клон 82% — статус-бар/кнопки/подсказка)
    // ============================================================

    buildHUD() {
        const { width, height } = this.scale;

        // Название локации (под кнопками — урок раунда 11)
        const title = this.hudTitle();
        this.add.text(12, 34, title.text + (this.weather ? `  ${this.weather.icon}` : ''), {
            fontSize: '15px', color: title.color, fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(102);

        // Единый статус-бар (как в деревне)
        this.statusText = this.add.text(12, 10, '', {
            fontSize: '12px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(102);

        // Крюк: локальные HUD-строки (сводка пчёл / баннер напуганной стаи)
        this.hudExtras?.();

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
            this.scene.launch('Character', { from: this.sceneKey });
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
            this.scene.launch('Character', { from: this.sceneKey, tab: 'inventory' });
        });

        // Патч 66.75 (приказы 5–6 владельца): «⚙ Настройки» — панель звука в игре
        addSettingsGearButton(this, width - 160, btnY);

        // Подсказка взаимодействия внизу по центру
        this.prompt = this.add.text(width / 2, height - 22, '', {
            fontSize: '14px', color: '#E8DCC4', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000099', padding: { x: 10, y: 4 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

        this.updateHUD();
        this.onHudBuilt?.();
    }

    // ============================================================
    //  ИГРОВОЙ ЦИКЛ (был клон 91% + movePlayer 96%)
    // ============================================================

    update(time) {
        // Пока открыт диалог — мир ждёт (раунд 21)
        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            this.pauseActors?.();
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
        this.updateActors?.(time);
        this.updateNearestInteractable();
        this.updateHUD();
    }

    /** Движение героя: клавиатура/джойстик, анимации, шаг = тик времени. */
    movePlayer() {
        const speed = this.locCfg.speed;
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

        // 66.68 (§9.3, P3): вектор переиспользуется — set() вместо new
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
                // Минут игры за шаг — КОНФИГ локации (лес 0.25, пасека 1):
                // патч 66.73 — шаг считается перемещением (голод ×1.5)
                tickTime(this.registry, this.locCfg.stepTickMinutes, 'walk');
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
        this.playerObj.setDepth(this.playerObj.y / this.ts);
    }

    // ============================================================
    //  HUD: ОБНОВЛЕНИЕ (общее ядро; специфика — через hooks)
    // ============================================================

    /**
     * Общее ядро updateHUD: статус-бар + день/ночь + светлячки + лучи +
     * туман. Возвращает dark (0..1) — сцены дорисовывают своё (кострище,
     * дымокур, пыльца) через this.afterHudCommon?.(dark).
     */
    updateHUDCommon(statusLine) {
        const p = this.player;
        const timeState = getTime(this.registry);
        const villageRep = getVillageRep(this.registry);
        const moneyStr = formatMoney(p.dengas || 0);

        let line = `❤${p.HP}/${p.HPmax}  💰${moneyStr}`;  // 66.71: МР удалён (приказ 7)
        if (timeState) line += `  📅${formatDateTime(timeState)}`;
        // Крюк: голод/усталость леса (между датой и репутацией — прежний порядок)
        line += this.hudStatusExtra?.() || '';
        line += `  ⭐${villageRep > 0 ? '+' : ''}${villageRep}`;
        // Патч 66.80 (п.11-в): лестница статусов — «(подозрительный)» / «(свой)»
        line += villageRepStatusSuffix(this.registry);
        this.statusText.setText(line);

        // День/ночь + светлячки + лучи
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

            // Днём лучи ярче, ночью почти гаснут; туман густеет к ночи
            const day = 1 - dark;
            if (this.godRays) this.godRays.forEach(r => r.setAlpha(0.02 + day * 0.05));
            if (this.fogPuffs) this.fogPuffs.forEach(fg =>
                fg.setAlpha(this.locCfg.fogDayAlpha + dark * this.locCfg.fogNightAlpha));
            this.afterHudCommon?.(dark, day);
        }
    }

    // ============================================================
    //  ПЛАВАЮЩИЙ ТЕКСТ (был клон 100%)
    // ============================================================

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
}

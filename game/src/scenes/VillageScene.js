// Деревня-оверхорлд: хаб с зданиями, воротами, сменой дня/ночи.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import {
    buildMap, SOLID, tileTexture, roadTileSpec, validateMap, doorInteriorId, isGate,
    PLAYER_START, MAP_W, MAP_H, getVillageName, YARD_PROPS, SHEEPFOLD,
} from '../data/world.js';
import { BUILDINGS, VILLAGE_GATE, INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { Tutorial } from '../systems/Tutorial.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { ActionLog } from '../data/actionLog.js';
// Раунд 58 (п.2): chaseHoursLeft — часы до побега вора (тик = 1 игровой час)
import { checkGameEnd, chaseHoursLeft } from '../data/thief.js';
import { onLocationVisited } from '../data/questGenerator.js';
import { formatMoney } from '../systems/Character.js';
import { createButton, createDialog } from '../utils/ui.js';
import { tickTime, getTime, getDayNightOverlay, getSeason } from '../systems/TimeSystem.js';
// Раунд 29: счёт времени «как на Руси XV века» — эра, косые часы, народные ориентиры
import { formatDateRus, slavonicHourLine, folkTimeName, showChroniclePanel, eraYear, MONTH_NAMES, MONTH_NAMES_GEN } from '../systems/RusTime.js';
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах, час за беседу
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock, timeRatioInfoLine, TALK_MINUTES } from '../systems/WorldClock.js';
import { getWeather, applyWeatherVisuals } from '../systems/Weather.js';
import { getVillageRep, getReputationLevel, checkExpulsion, checkVictory, getNpcRep, changeVillageRep, isNpcKilled } from '../data/reputation.js';
import { t, tf, tk } from '../systems/i18n.js';
import { CHESTS, chestAt, isOpenedToday, markOpened, rollLoot, lootDisplayName, dayKeyOf } from '../data/chests.js';
import { findNpc, getNpcs, getNpcDisplayName } from '../data/npcNames.js';
import { getNpcActivity } from '../data/npcSchedules.js';
import { getPresence, ALL_NPC_IDS, NPC_DIALOGUE, PLACE_NAMES, pickOutdoorLine } from '../data/npcPresence.js';
import { getNpcSpriteKey, isChildNpc } from '../systems/NpcLpc.js';
import { attachNpcWander } from '../systems/NpcWander.js';
import { npcPortraitVariantKey } from '../systems/NpcLook.js';
import { addMorningFog } from '../systems/AmbientFX.js';

export class VillageScene extends Phaser.Scene {
    constructor() {
        super('Village');
    }

    create() {
        // РАУНД 52 (п.5 приказа): тайл 48, карта 26×15 → мир 1248×720 —
        // деревня влезает на ОДИН ЭКРАН без скролла; камера показывает её
        // целиком (см. applyCameraFit), обзор «🗺 Вся деревня» остаётся как
        // переключатель камера/игрок для окон меньше мира.
        const ts = 48;
        this.tileSize = ts;
        this.worldW = MAP_W * ts;
        this.worldH = MAP_H * ts;

        // Раунд 20: бесконечная трава за границами мира — при RESIZE окно
        // бывает ШИРЕ мира (1248px), иначе по краям видна пустота фона.
        if (this.textures.exists('tile_grass_0')) {
            const pad = 2000;
            const back = this.add.tileSprite(-pad, -pad, this.worldW + pad * 2, this.worldH + pad * 2, 'tile_grass_0')
                .setOrigin(0, 0).setDepth(-10);
            back.setTileScale(1.5, 1.5); // 32px текстура → 48px тайл, как в мире
        }

        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);
        // Раунд 31 (п.12): мировые часы тикают РЕАЛЬНЫМ временем — по соотношению
        // 1:30 (раунд 32, п.14: 1 реальная минута = 30 игровых минут),
        // а пока открыт разговор — стоят
        attachWorldClock(this);
        attachChurchBells(this, { volume: 1.0 });

        // Фоновая музыка деревни (ambient)
        this.audioManager.playSceneMusic('village');
        // Раунд 24: эмбиент деревни — день/ночь по игровому времени
        const vsTime = getTime(this.registry);
        const vsHour = vsTime ? vsTime.hour : 12; // раунд 31: фикс .hours → .hour (эмбиент день/ночь)
        this.audioManager.setAmbient((vsHour >= 21 || vsHour < 5)
            ? 'ambient_town_night'
            : 'ambient_town_day');

        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        this.map = buildMap();
        this.solids = this.physics.add.staticGroup();

        // ----- Раунд 39 (п.6 заявки): тайлы, ПОКРЫТЫЕ НОВЫМИ СПРАЙТАМИ —
        // под ними рисуется трава, чтобы старые тайлы стен/крыш (tile_house_*)
        // не «выглядывали» из-под домов, построек и овчарни.
        // Коллизии не меняются ('H'/'R' остаются непроходимыми).
        const coveredTiles = new Set();
        BUILDINGS.forEach((b) => {
            for (let dy = 0; dy < b.h; dy++) {
                for (let dx = 0; dx < b.w; dx++) coveredTiles.add(`${b.col + dx},${b.row + dy}`);
            }
        });
        YARD_PROPS.forEach((p) => {
            for (let dy = 0; dy < p.h; dy++) {
                for (let dx = 0; dx < p.w; dx++) coveredTiles.add(`${p.col + dx},${p.row + dy}`);
            }
        });
        for (let gx = SHEEPFOLD.col; gx < SHEEPFOLD.col + SHEEPFOLD.w; gx++) {
            for (let gy = SHEEPFOLD.row; gy < SHEEPFOLD.row + SHEEPFOLD.h; gy++) {
                coveredTiles.add(`${gx},${gy}`); // овчарня-загон
            }
        }

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
                    // Раунд 39 (п.6): под новыми спрайтами — трава вместо старых
                    // тайлов домов (они полностью скрыты 3D-спрайтами здания)
                    if ((t === 'H' || t === 'R' || t === 'D') && coveredTiles.has(`${x},${y}`)) {
                        texKey = `tile_grass_${(x * 7 + y * 13) % 4}`;
                    }
                    // Раунд 39 (п.20): ворота рисуются спрайтом drawVillageGate —
                    // старый tile_gate (повёрнутый не в ту сторону) не используется
                    if (t === 'G') {
                        texKey = `tile_grass_${(x * 7 + y * 13) % 4}`;
                    }
                }
                // Проверяем существование текстуры, fallback на траву
                const safeTex = this.textures.exists(texKey) ? texKey : 'tile_grass_0';
                if (!this.textures.exists(texKey)) angle = 0;
                const img = this.add.image(px, py, safeTex);
                img.setScale(ts / 32);
                if (angle) img.setAngle(angle);
                // Раунд 27 (п.1): 'T' — под деревом рисуется трава, а СВЕРХУ —
                // прозрачный спрайт дерева (deco_tree_*/deco_pine_*) с Y-сортировкой:
                // больше нет квадратной «плашки» с фоном вокруг кроны.
                if (t === 'T') {
                    img.setDepth(0);
                    const edge = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
                    const idx = (x * 7 + y * 13) % 5;
                    const treeTex = edge
                        ? `deco_pine_${(x + y) % 2}`
                        : `deco_tree_${idx % 3}`;
                    if (this.textures.exists(treeTex)) {
                        const tree = this.add.image(px, py + 10, treeTex)
                            .setScale(1.5).setOrigin(0.5, 0.9);
                        tree.setDepth(y + 0.4);
                    } else {
                        // Страховка: нет процедурных деревьев — старый тайл с фоном
                        img.setTexture(`tile_forest_${(x * 3 + y * 5) % 2}`);
                        img.setDepth(y + 0.4);
                    }
                } else if (t === '#' || t === 'W' || t === 'X') {
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

        // ----- КОЛОДЕЦ (п.17 заявки раунда 39): СТАТИЧНЫЙ, БЕЗ АНИМАЦИИ —
        // сруб с воротилом (deco_well_0) стоит ровно, вода не «плещется» кадрами.
        // (Анимация deco_well_0..3 удалена по заявке владельца.)

        // ----- Анимация воды (раунд 36: пруд в деревне удалён — тайлы '~'
        // больше не появляются на карте деревни, рыбалка переехала на Реку) -----

        // ----- Подсветка дверей и ворот -----
        // Спрайты домов. РАУНД 61 (п.5 приказа владельца «ПЕРЕДЕЛАТЬ ДОМА ПО
        // ТИПУ И ВНЕШНЕМУ ВИДУ КАК У ДОМА СТАРОСТЫ»): ВСЕ жилые дома — теперь
        // ЦЕЛЬНЫЕ ИЗБЫ того же типа, что дом старосты (wood_house_08): сруб,
        // целая двускатная/вальмовая крыша со свесами, крыльцо/наличники.
        // Плоские процедурные фасады phouse_* (раунд 60) УДАЛЕНЫ из обихода —
        // они читались «наклейками» на фоне объёмных домов. Каждый дом —
        // настоящий ассет из того же арт-пака, что дом старосты;
        // разнообразие — зеркалированием (FLIP_HOUSES).
        // Сохранены по прежним приказам: постоялый двор (wood_house_02, р.55),
        // дом старосты (wood_house_08), кузница (house3d_blacksmith), церковь,
        // мясник (rurald_house_1), рыбак/сапожник (rural_house_0), лавка (rural_shop_1).
        const HOUSE_SPRITE_BY_ID = {
            elder_house: 'wood_house_08',        // ЭТАЛОН: большой дом с крыльцом и ступенями
            tavern: 'wood_house_02',             // длинный трактир с каменной трубой (целый)
            blacksmith: 'house3d_blacksmith',    // кузница с навесом и горном (сохранена)
            potter_house: 'wood_house_07',       // Р61: целая изба с клумбой и резной дверью (был phouse)
            villager_house_1: 'rural_house_1',   // Р61: высокая изба с каменной трубой (был phouse)
            villager_house_2: 'wood_house_09',   // Р61: изба под соломой с каменным арочным дверцом (был phouse)
            beekeeper_house: 'wood_house_07',    // Р61: целая изба с клумбой, зеркально (был phouse)
            healer_house: 'rurald_house_0',      // Р61: побелённая изба под соломой, цветы (был phouse)
            carpenter_house: 'wood_house_09',    // Р61: целая изба, зеркально (был phouse)
            fisher_house: 'rural_house_0',       // дом рыбака с навесом-сетями (целый, зеркально)
            weaver_house: 'rural_house_1',       // Р61: высокая изба, зеркально (был phouse)
            // Восточная слобода (раунд 51): лавка ремесленника — палатка.
            // РАУНД 53: лавки снеди/мясная удалены владельцем — на их месте
            // ЖИЛЫЕ ДОМА Прасковьи и Потапа.
            shop_tools: 'rural_shop_1',          // лавка со светлым тентом — ремесленник
            grocer_house: 'rurald_house_0',      // Р61: побелённая изба под соломой (был phouse)
            butcher_house: 'rurald_house_1',     // дом с каменной кладкой — мясник (целый)
            shoemaker_house: 'rural_house_0',    // дом с резными воротами — сапожник (целый)
            woodcutter_house: 'rural_house_1',   // Р61: лесная изба с трубой (был phouse)
        };
        // Дома, рисуемые ЗЕРКАЛЬНО (разнообразие фасадов: одинаковые избы
        // соседей читаются по-разному)
        const FLIP_HOUSES = new Set(['fisher_house', 'villager_house_2', 'beekeeper_house', 'healer_house', 'weaver_house']);
        // Спрайты с собственными трубами (дым у них запечён в крышу — рисуем
        // дым именно над трубой, а не по центру). Раунд 61: у новых из
        // wood_house_07 / wood_house_09 / rural_house_1 / rurald_house_0
        // труба на левом/правом крае крыши (точные доли — в CHIMNEY_FRACTION_X).
        const CHIMNEY_SPRITES = new Set(['house3d_blacksmith', 'wood_house_02', 'wood_house_07', 'wood_house_09', 'rural_house_1', 'rurald_house_0']);
        // Раунд 61: доля ширины ТЕКСТУРЫ, где стоит труба (для точного дыма).
        // 0.5 — центр; направление учитывает зеркалирование дома.
        const CHIMNEY_FRACTION_X = {
            wood_house_07: 0.86,   // каменная труба на правом крае крыши
            wood_house_09: 0.10,   // каменная труба на левом крае крыши
            rural_house_1: 0.22,   // труба слева от конька
            rurald_house_0: 0.12,  // труба на левом крае соломенной крыши
        };
        this.doors = [];
        BUILDINGS.forEach(b => {
            const doorX = b.col + Math.floor(b.w / 2);
            const doorY = b.row + b.h - 1;
            const px = doorX * ts + ts / 2;
            const py = doorY * ts + ts / 2;

            // Метка здания — РАУНД 39 (п.21 заявки): ПОСТОЯННЫЕ НАДПИСИ НАД ДОМАМИ
            // УДАЛЕНЫ. Название и владелец показываются ТОЛЬКО поп-апом при
            // наведении (showBuildingTooltip — уже работает по pointermove).

            // ----- Дом спрайтом + тень (псевдо-2.5D: Y-сортировка) -----
            const sprKey = b.interiorId === 'church'
                ? 'deco_church_building'
                : HOUSE_SPRITE_BY_ID[b.interiorId];
            const cx = b.col * ts + b.w * ts / 2;
            const cy = b.row * ts + b.h * ts / 2;
            const bottomRow = b.row + b.h;                 // строка под домом
            const usedSprite = sprKey && this.textures.exists(sprKey);
            if (usedSprite) {
                // Тень у основания дома (мягкий овал)
                this.add.ellipse(cx, bottomRow * ts - 4, b.w * ts * 0.94, ts * 0.6, 0x000000, 0.25)
                    .setDepth(bottomRow - 0.7);
                // Раунд 39 (п.7): пропорции спрайта СОХРАНЯЮТСЯ (fit по меньшей
                // стороне) — раньше setDisplaySize растягивал дом в квадрат,
                // из-за чего узкие избы выглядели перекошенными, высокие — сплющенными.
                const houseImg = this.add.image(cx, cy, sprKey);
                const fitS = Math.min((b.w * ts + 8) / houseImg.width, (b.h * ts + 6) / houseImg.height);
                houseImg.setScale(fitS)
                    .setFlipX(FLIP_HOUSES.has(b.interiorId))
                    .setDepth(bottomRow - 0.55);          // Y-сортировка: игрок ниже дома — перед домом;
                                                          // на строке двери (bottomRow-0.5) игрок тоже ПЕРЕД домом (п.15)
            } else {
                // Fallback: старые тайлы + нарисованная дверь
                this.add.rectangle(px, py + 4, ts * 0.44, ts * 0.68, 0x3a2417)
                    .setStrokeStyle(2, 0x1f140c)
                    .setDepth(bottomRow - 0.5);
            }

            // РАУНД 56 (приказ владельца): «крестики» над дверями УДАЛЕНЫ.
            // Раньше над дверью каждого дома стоял золотой маркер-искра
            // ('particle_spark', 20×20) — владелец счёл его крестиком по центру
            // строений. Здание и так размечено дверью и поп-апом при наведении.
            this.doors.push({ x: doorX, y: doorY, interiorId: b.interiorId });

            // ----- П.7: Уникальные детали зданий (без дублей со спрайтом) -----
            // Раунд 38: передаём ключ спрайта — 3D-дома имеют собственные трубы.
            this.addBuildingDetails(b, ts, !!usedSprite, usedSprite ? sprKey : null);

            // ----- Ограда и грядки для жилых домов (п.6) -----
            // Раунд 28: дом пахаря тоже с огородом (порядок в хозяйстве)
            if (b.interiorId === 'villager_house_1' || b.interiorId === 'villager_house_2' || b.interiorId === 'beekeeper_house') {
                this.addYardAndGarden(b, ts);
            }

            // ----- Раунд 28 (п.1): у ДОМА ПАХАРЯ — соха и поленица дров
            // вместо ульев и медоносов (пасека у дома убрана!) -----
            if (b.interiorId === 'beekeeper_house') {
                const ploughX = (b.col + b.w + 0.5) * ts;
                const ploughY = (b.row + b.h + 0.55) * ts;
                const pg = this.add.graphics();
                // Тень
                pg.fillStyle(0x000000, 0.22);
                pg.fillEllipse(ploughX, ploughY + 14, 40, 8);
                // Дышло и рукоятки (деревянные)
                pg.lineStyle(4, 0x6a4a2a, 1);
                pg.beginPath();
                pg.moveTo(ploughX - 16, ploughY + 8);
                pg.lineTo(ploughX + 14, ploughY - 12);
                pg.strokePath();
                pg.lineStyle(3, 0x7a5a38, 1);
                pg.beginPath();
                pg.moveTo(ploughX + 2, ploughY - 4);
                pg.lineTo(ploughX + 16, ploughY - 18);
                pg.strokePath();
                pg.beginPath();
                pg.moveTo(ploughX + 2, ploughY - 4);
                pg.lineTo(ploughX + 18, ploughY - 6);
                pg.strokePath();
                // Сошник (железо) и лемех
                pg.fillStyle(0x3a3a42, 1);
                pg.fillTriangle(ploughX - 12, ploughY + 10, ploughX - 2, ploughY - 2, ploughX + 2, ploughY + 10);
                pg.fillStyle(0x55555e, 1);
                pg.fillTriangle(ploughX - 12, ploughY + 10, ploughX - 7, ploughY + 4, ploughX - 2, ploughY + 10);
                pg.setDepth(ploughY / ts + 0.2);
            }
        });

        // ----- Дым из труб (атмосфера, §3 village-visual-upgrade) -----
        // Раунд 52: дымим только у домов с трубами (CHIMNEY_SPRITES) и церкви;
        // ТОРГОВЫЕ ЛАВКИ (палатки) не дымят — труб у палаток нет.
        this.smokeBuildings = BUILDINGS
            .filter(b => {
                if (b.interiorId.indexOf('shop_') === 0) return false; // палатки
                const key = b.interiorId === 'church' ? 'deco_church_building' : HOUSE_SPRITE_BY_ID[b.interiorId];
                if (b.interiorId === 'church') return false; // у церкви купол, не труба
                return CHIMNEY_SPRITES.has(key);
            })
            .map(b => {
                const key = HOUSE_SPRITE_BY_ID[b.interiorId];
                // Раунд 55: у фасада постоялого двора (wood_house_02) труба у ПРАВОГО края
                // Раунд 61: точная доля трубы — по CHIMNEY_FRACTION_X, с учётом зеркала
                let dx = ts * 0.42;
                if (key === 'wood_house_02') {
                    dx = ts * 1.0;
                } else if (CHIMNEY_FRACTION_X[key] != null) {
                    // Считаем по фактической ширине спрайта на карте (fit по меньшей
                    // стороне — как при отрисовке дома) и не забываем про FLIP
                    const tex = this.textures.get(key);
                    const tw = (tex && tex.source && tex.source[0]) ? tex.source[0].width : 192;
                    const th = (tex && tex.source && tex.source[0]) ? tex.source[0].height : 192;
                    const fitS = Math.min((b.w * ts + 8) / tw, (b.h * ts + 6) / th);
                    const flip = FLIP_HOUSES.has(b.interiorId);
                    const frac = flip ? (1 - CHIMNEY_FRACTION_X[key]) : CHIMNEY_FRACTION_X[key];
                    dx = (frac - 0.5) * tw * fitS;
                }
                return {
                    x: b.col * ts + b.w * ts / 2 + dx,
                    y: b.row * ts - ts * 0.12,
                    depth: b.row + b.h + 1,
                };
            });
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

        // ----- Раунд 28 (п.4): УТРЕННИЙ ТУМАН над деревней (с 4 до 9 утра) -----
        addMorningFog(this, { width: MAP_W * ts, height: MAP_H * ts, yMin: 4 * ts, yMax: MAP_H * ts - 2 * ts, depth: 8500 });

        // ----- Раунд 28 (п.5): реальные часы — статус-бар обновляется каждую секунду,
        // чтобы время на часах игрока шло живым (🕐 HH:MM реального времени) -----
        this.realClockTimer = this.time.addEvent({
            delay: 1000, loop: true, callback: () => this.updateHUD(),
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
        // Раунд 51: восточная слобода (лавки, сапожник, дровосек) — БЕЗ оград:
        // слободская застройка открыта, заборы мешали бы дорожкам к палаткам.
        const FENCELESS = ['grocer_house', 'shop_tools', 'butcher_house', 'shoemaker_house', 'woodcutter_house'];
        BUILDINGS.forEach(b => {
            if (b.interiorId !== 'villager_house_1' && b.interiorId !== 'villager_house_2' && FENCELESS.indexOf(b.interiorId) < 0) {
                this.addPublicFence(b, ts);
            }
        });

        // ----- Живность: бабочки днём / светлячки ночью (атмосфера) -----
        this.createAmbientCritters(ts);

        // ----- Полевые цветы/кочки и сундуки с лутом (раунд 11) -----
        this.scatterFlowers(ts);
        this.spawnChests(ts);

        // ----- Раунд 12: костёр и лампада креста (пруд удалён в раунде 36) -----
        this.createCampfire(ts);
        this.createCrossGlow(ts);

        // ----- Раунд 17: рига, стога, поленница, телега (§3 village-visual-upgrade) -----
        this.drawYardProps(ts);

        // ----- Раунд 27 (пп.6-11): ЖИТЕЛИ НА УЛИЦАХ -----
        // Староста гуляет (п.10), жёны у колодца, стражник у ворот,
        // жители случайно ходят/сидят на постоялом дворе (п.11).
        this.streetNpcs = [];
        this.elderWalker = null;
        this._lastStreetHour = -1;
        this.rebuildStreetNpcs();

        // ----- Ворота (п.20 заявки раунда 39): НОВЫЕ ВОРОТА —
        // старый тайл tile_gate был «повёрнут не в ту сторону». Ворота стоят
        // на ВОСТОЧНОЙ околице: рисуем сторожевую башенку со створками во всю
        // ширину дороги (проезд с запада на восток), столбы по бокам дороги.
        const gatePx = (MAP_W - 1) * ts + ts / 2;
        const gatePy = VILLAGE_GATE.row * ts + ts / 2;
        this.drawVillageGate(gatePx, gatePy, ts);
        const gateLabel = this.add.text(gatePx - ts * 3.4, gatePy - ts * 0.4, t('ВЫХОД ▶'), {
            fontSize: '16px', color: '#ff8060', backgroundColor: '#00000088',
            padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);
        const gateMarker = this.add.image(gatePx, gatePy - ts * 3.5, 'particle_spark')
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

        // ----- Игрок (раунд 37: единый масштаб с жителями, п.4/п.12) -----
        // П.1-2: Если игрок настроил внешность через генератор — используем
        // композитную текстуру 'player_composite' (LPC-слой, 9×4 кадра)
        // С АНИМАЦИЯМИ ходьбы (п.22 заявки) — тем же композитом, что и NPC.
        this.player = this.registry.get('player');
        const ps = PLAYER_START;
        const useComposite = this.player && this.player.useComposite && this.textures.exists('player_composite');
        if (useComposite) {
            this.playerTexKey = 'player_composite';
        } else {
            this.playerTexKey = (this.player && this.player.sprite) || 'player';
        }
        this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, this.playerTexKey);
        if (!useComposite && this.player.appearance && this.player.appearance.jacket) {
            this.playerObj.setTint(this.player.appearance.jacket.tint);
        }
        // Анимации есть у обоих типов текстур (LPC-композит и legacy-листы):
        // п.22 — игрок ходит с анимацией, как и жители
        const startIdle = `${this.playerTexKey}_idle_down`;
        if (this.anims.exists(startIdle)) this.playerObj.play(startIdle);
        this.playerObj.setScale(ts / 32 * 0.75);  // единый «взрослый» масштаб (у NPC тот же)
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
        // РАУНД 52 (п.5): деревня 26×15 при тайле 48 = 1248×720 — на окнах
        // 1280×720 она влезает ЦЕЛИКОМ: камера переходит в режим «вся деревня
        // на одном экране» (без скролла). На мобильных (окно меньше мира)
        // остаётся классическое следование за игроком.
        this._fitMode = false;
        this.applyCameraFit();
        // Раунд 52 (QA-фикс): после остановки сцены камера уничтожена —
        // resize-хендлер больше не должен падать на setZoom.
        this.scale.on('resize', () => {
            if (!this.scene.isActive() || !this.cameras || !this.cameras.main) return;
            this.applyCameraFit();
        });

        // ----- Управление -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
        // Раунд 37 (п.5): обзор всей деревни
        this.input.keyboard.on('keydown-M', () => this.toggleVillageOverview());
        this.busyDialog = false;
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = 350;

        // П.25: F1 — окно помощи (сцены 'Help' в сборке нет — фикс латентного бага,
        // ранее клавиша молча не работала: launch('Help') не находил сцену)
        // Раунд 32 (пп.14,15): в «Информации по игре» — соотношение времени 1:30
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ ' + t('Инструкция'),
                timeRatioInfoLine() + '\n\n' +
                tk('village.help.body',
                    'Управление: WASD/стрелки — движение, E/пробел — действие, M — обзор деревни, ESC — меню.\n\n' +
                    '🏠 Подходи к дверям домов и жми E — внутри люди, работа и слухи.\n' +
                    '🔒 Закрытые избы: хозяин ушёл — подскажут, где искать.\n' +
                    '✝ Крест — молитва. 🎣 Рыбалка — на Реке (по карте). 🐑 Овчарня — на востоке новой улицы.\n' +
                    '🐺 За воротами, в Тёмном лесу, водятся волки — там же грибы и ягоды.\n' +
                    '🚪 Выход за околицу (по карте) занимает ровно 1 игровой час.'),
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
            // Раунд 32 (п.5): перемещение между локациями — РОВНО 1 игровой час
            if (isGate(tx, ty)) {
                tickTime(this.registry, 60);
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
            // ФИКС аудита: wordWrap здесь давал невидимый перенос под тёмный бар —
            // строка теперь ужимается по ширине в updateHUD (см. maxStatusW)
        }).setScrollFactor(0).setDepth(101);
        // Раунд 29: клик по статус-бару открывает «Летопись» (полная датировка)
        this.statusText.setInteractive({ useHandCursor: true });
        this.statusText.on('pointerup', () => showChroniclePanel(this));

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
    addBuildingDetails(b, ts, usedSprite = false, sprKey = null) {
        const is3d = !!(sprKey && sprKey.indexOf('house3d_') === 0); // 3D-спрайт: трубы уже запечены
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
            // Дымоход (для 3D-спрайта труба уже в текстуре — не рисуем)
            if (!is3d) {
                const chimney = this.add.graphics();
                chimney.fillStyle(0x5a4030, 1);
                chimney.fillRect(cx + ts * 0.6, topY - ts * 0.5, ts * 0.25, ts * 0.5);
                chimney.setDepth(8);
            }

        } else if (b.interiorId === 'blacksmith') {
            // Кузница: молот + наковальня (эмблема)
            this.add.text(cx, topY - ts * 0.4, '🔨', {
                fontSize: '18px',
            }).setOrigin(0.5).setDepth(9);
            // Труба кузницы (для 3D-спрайта труба уже в текстуре — не рисуем)
            if (!is3d) {
                const chimney = this.add.graphics();
                chimney.fillStyle(0x4a3a25, 1);
                chimney.fillRect(cx - ts * 0.8, topY - ts * 0.5, ts * 0.3, ts * 0.6);
                chimney.setDepth(8);
            }

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
        } else if (b.interiorId === 'potter_house') {
            // Раунд 37: гончар — горшок (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🏺', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'healer_house') {
            // Раунд 37: знахарка — пучок трав (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🌿', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'fisher_house') {
            // Раунд 37: рыбак — уды (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🎣', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'carpenter_house') {
            // Раунд 37: плотник — топор (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🪓', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'weaver_house') {
            // Раунд 37: ткачиха — нити (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🧵', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'grocer_house') {
            // Раунд 53: дом снедницы — каравай (эмблема)
            this.add.text(cx, topY - ts * 0.35, '🥖', {
                fontSize: '16px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'butcher_house') {
            // Раунд 53: дом мясника — окорок (эмблема)
            this.add.text(cx, topY - ts * 0.35, '🍖', {
                fontSize: '16px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'shop_tools') {
            // Раунд 51: лавка ремесленника — весы/товар (эмблема)
            this.add.text(cx, topY - ts * 0.35, '⚖️', {
                fontSize: '16px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'shoemaker_house') {
            // Раунд 51: сапожник — сапог (эмблема)
            this.add.text(cx, topY - ts * 0.3, '🥾', {
                fontSize: '14px',
            }).setOrigin(0.5).setDepth(9);
        } else if (b.interiorId === 'woodcutter_house') {
            // Раунд 51: дровосек — ель (эмблема; 🪓 уже у плотника)
            this.add.text(cx, topY - ts * 0.3, '🌲', {
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
            banya: 'deco_banya',   // §3.1 раунд 20 (раунд 37: баня с карты удалена — ветка не срабатывает)
            ovin: 'deco_ovin',     // §3.1 раунд 20
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
            if (p.id === 'banya' && this.smokeBuildings) {
                // §3.1: баня топится — дымок из каменной трубы (правый край сруба)
                this.smokeBuildings.push({
                    x: cx + p.w * ts * 0.30,
                    y: p.row * ts - ts * 0.62,
                    depth: bottomRow + 1,
                });
            }
        });

        // ----- Раунд 37 (вариант Б): ОВЧАРНЯ на восточном конце второй улицы -----
        // Частокол 'H' уже стоит (world.buildMap); рисуем поверх него жерди,
        // овец (мелкий рогатый скот — спрайт козы) и сено. Ивашка пасёт рядом.
        this.drawSheepfold(ts);
    }

    /**
     * Раунд 37: визуал овчарни — жерди частокола, 3 овцы, стог сена.
     */
    drawSheepfold(ts) {
        // Раунд 52: загон из константы SHEEPFOLD (юго-восток, 22–24 × 11–12)
        const sf = SHEEPFOLD;
        if (!this.map || !this.map[sf.row] || this.map[sf.row][sf.col] !== 'H') return; // нет загона — нет и овец
        const penCols = [];
        for (let x = sf.col - 1; x <= sf.col + sf.w; x++) {
            if (this.map[sf.row] && this.map[sf.row][x] === 'H') penCols.push(x);
        }
        if (!penCols.length) return;
        const rowY = (sf.row + 1) * ts; // нижний ряд загона — визуальный центр
        // Жерди частокола поверх «стенных» тайлов (визуально — частокол, не изба)
        penCols.forEach((col) => {
            const px = col * ts + ts / 2;
            if (this.textures.exists('tile_fence_h')) {
                this.add.image(px, rowY, 'tile_fence_h')
                    .setScale(ts / 32)
                    .setDepth(sf.row + 1 + 0.35);
            }
        });
        // Овцы — на подиуме загона, чуть дышат (лёгкий твин высоты)
        const sheepTex = this.textures.exists('deco_goat') ? 'deco_goat'
            : (this.textures.exists('deco_cow') ? 'deco_cow' : null);
        if (sheepTex) {
            const cols = [penCols[0], penCols[Math.floor(penCols.length / 2)], penCols[penCols.length - 1]];
            cols.forEach((col, i) => {
                const sx = col * ts + ts / 2 + (i % 2 ? 10 : -8);
                const sy = rowY - 4;
                const sheep = this.add.image(sx, sy, sheepTex)
                    .setScale(0.85 + i * 0.08)
                    .setFlipX(i % 2 === 0)
                    .setDepth(sf.row + 1 + 0.5);
                this.tweens.add({
                    targets: sheep,
                    y: sy - 1.5,
                    duration: 1600 + i * 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            });
        }
        // Стог сена в углу загона
        if (this.textures.exists('deco_haystack')) {
            this.add.image(penCols[penCols.length - 1] * ts + ts / 2, rowY - 8, 'deco_haystack')
                .setScale(0.7)
                .setDepth(sf.row + 1 + 0.45);
        }
    }

    /**
     * Добавить двор с оградой, грядками и КАЛИТКОЙ к жилому дому (п.6).
     * Калитка — проход в ограде перед дверью, через который игрок может войти.
     * Ограда и грядки теперь С ЧЕСТНЫМИ КОЛЛИЗИЯМИ (solid-тела), а тайлы,
     * занятые дорогой/дверью, не перекрываются декором.
     *
     * РАУНД 36 (заявка владельца «уменьшить придомовые участки»): участок ужат
     * с двух рядов до ОДНОГО — ограда стоит вплотную к дому (грядки больше не
     * занимают отдельный ряд перед фасадом). Грядки перенесены по бокам избы —
     * освободившийся ряд идёт под будущие дворы (см. VILLAGE_EXPANSION_PROPOSAL).
     */
    addYardAndGarden(b, ts) {
        const doorX = b.col + Math.floor(b.w / 2);
        const fenceRow = b.row + b.h;      // ограда ВПЛОТНУЮ к дому (участок в 1 ряд)
        const mapChar = (x, y) => (this.map[y] && this.map[y][x] !== undefined) ? this.map[y][x] : null;
        const isFree = (x, y) => mapChar(x, y) === '.';  // декор только на траве

        const addSolid = (px, py) => {
            const solid = this.solids.create(px, py, 'tile_fence_h');
            solid.setScale(ts / 32).refreshBody();
            solid.setVisible(false);
        };

        // Грядки ПО БОКАМ дома (по две с каждой стороны у стены) —
        // непроходимы, на дороге/двери/кресте не лежат (только чистая трава)
        const sideSpots = [
            [b.col - 1, b.row + b.h - 1],   // слева от избы (нижний ряд стены)
            [b.col - 1, b.row + b.h - 2],   // слева, ряд выше
            [b.col + b.w, b.row + b.h - 1], // справа от избы
            [b.col + b.w, b.row + b.h - 2], // справа, ряд выше
        ];
        sideSpots.forEach(([col, row]) => {
            if (!isFree(col, row)) return;
            const px = col * ts + ts / 2;
            const py = row * ts + ts / 2;
            if (this.textures.exists('tile_garden_0')) {
                const v = (col + row) % 3;
                this.add.image(px, py, `tile_garden_${v}`)
                    .setScale(ts / 32)
                    .setDepth(row + 0.3);
                // Грядки непроходимы — не топчем посадки
                addSolid(px, py);
            }
        });

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

        // Калитка — проход в ограде напротив двери.
        // Раунд 39 (п.5 заявки): декоративные столбики по бокам прохода УДАЛЕНЫ —
        // они стояли прямо на дорожке к двери («ограда на дорожках»).
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
     * РАУНД 61 (п.4 приказа «КРИВО СДЕЛАНЫ ВОРОТА — ПЕРЕДЕЛАТЬ!»): постановка
     * НОВОЙ воротни (текстура village_gate_r57, 232×336 — чистая симметричная
     * композиция, см. BootScene.createGateTexture). РАУНД 61 (QA-диагноз
     * «кривые ворота»): раньше текстура ЦЕНТРИРОВАЛАСЬ на кромке карты, и
     * правая треть воротни (со половиной южной башни) ОТРЕЗАЛАСЬ краем мира —
     * ворота выглядели скошенными. Теперь воротня сдвинута влево так, что
     * ЦЕЛИКОМ лежит на карте, а проезд остаётся на линии главной улицы.
     * Глубина ВЫШЕ окрестных деревьев; игрок честно отсортирован: севернее
     * башен — за воротами, южнее — перед ними, в проезде — «за» порогом.
     */
    drawVillageGate(gx, gy, ts) {
        const depth = 8.6;
        if (!this.textures.exists('village_gate_r57')) return;
        // Текстура рисована под тайл 48: центр дороги в ней на y=170/336.
        // Сдвиг: правый край текстуры НЕ выходит за кромку карты (было: центр
        // на gx — 92px текстуры оказывались за правым краем мира).
        const img = this.add.image(gx - 92, gy, 'village_gate_r57');
        img.setScale(ts / 48);
        img.setOrigin(0.5, 170 / 336);
        img.setDepth(depth);
    }

    /**
     * Создать кнопки меню сверху: [Персонаж] [Инвентарь]
     */
    createTopMenu() {
        const { width } = this.scale;
        // Кнопки в статус-баре (п.10): справа вверху, в пределах бара (y=14)
        const btnY = 14;
        const btnW = 70, btnH = 20;

        // Кнопка "🗺 Обзор" (раунд 37 п.5: вся деревня одним экраном)
        if (width >= 900) {
            const ovBtnX = width - 395;
            const ovBtn = this.add.rectangle(ovBtnX, btnY, btnW, btnH, 0x3a5a3a, 0.95)
                .setStrokeStyle(1, 0xC9A961)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0)
                .setDepth(101);
            const ovText = this.add.text(ovBtnX, btnY, '🗺 ' + t('Обзор'), {
                fontSize: '10px', color: '#E8DCC4',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            ovBtn.on('pointerup', () => { this.toggleVillageOverview(); });
            ovBtn.on('pointerover', () => ovBtn.setFillStyle(0x4a6a4a, 1));
            ovBtn.on('pointerout', () => ovBtn.setFillStyle(0x3a5a3a, 0.95));
        }

        // Кнопка "Задания" (п.20)
        const questBtnX = width - 310;
        const questBtn = this.add.rectangle(questBtnX, btnY, btnW, btnH, 0x2a4a6a, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(101);
        const questText = this.add.text(questBtnX, btnY, t('📋 Задания'), {
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
        const charText = this.add.text(charBtnX, btnY, t('📜 Персонаж'), {
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
            ActionLog.add(this.registry, t('Открыл меню персонажа.'));
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
        const invText = this.add.text(invBtnX, btnY, t('🎒 Инвентарь'), {
            fontSize: '11px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        invBtn.on('pointerup', () => {
            const p = this.registry.get('player');
            if (!p) {
                this.scene.start('CharacterSelection');
                return;
            }
            ActionLog.add(this.registry, t('Открыл инвентарь.'));
            this.scene.pause();
            this.scene.launch('Character', { from: 'Village', tab: 'inventory' });
        });
        invBtn.on('pointerover', () => invBtn.setFillStyle(0x5a4530, 1));
        invBtn.on('pointerout', () => invBtn.setFillStyle(0x4a3520, 0.95));

        // Раунд 21: возвращение в деревню может закрыть поручение «Помирить соседей» и т.п.
        onLocationVisited(this.registry, 'village');
    }

    update() {
        // Пока открыт диалог — не перебиваем его концом игры (раунд 21)
        if (this.busyDialog) return;

        // Раунд 27: смена часа — пересчитать, кто где стоит (пп.6-11)
        const tsNow = getTime(this.registry);
        const hNow = tsNow ? tsNow.hour : -1;
        if (hNow !== this._lastStreetHour) {
            this._lastStreetHour = hNow;
            this.rebuildStreetNpcs();
        }

        // Проверка конца игры
        const endState = checkGameEnd(this.registry);
        if (endState) {
            this.scene.start('End');
            return;
        }
        
        // Пункт 12: Проверка изгнания из деревни при низкой репутации
        const expulsion = checkExpulsion(this.registry);
        if (expulsion.expelled) {
            ActionLog.add(this.registry, tf(t('ПОРАЖЕНИЕ: {0}'), expulsion.message));
            const q = this.registry.get('quest');
            q.heroDead = true;
            // Раунд 45 (п.2): отдельный флаг изгнания — свой титул финала
            // «🚪 ИЗГНАН ИЗ ДЕРЕВНИ» и своя оценка в итогах
            q.expelledFromVillage = true;
            q.currentObjective = 'Изгнан из деревни за дурную славу.';
            this.registry.set('quest', q);
            this.scene.start('End');
            return;
        }
        
        // Пункт 13 / Раунд 36: репутационная победа при репутации +100 —
        // ОТДЕЛЬНАЯ ветка финала. Флаг q.thiefDefeated больше НЕ трогаем
        // (раньше погоня молча умирала и итоги врали «ВОР ПОВЕРЖЕН»);
        // ставим q.reputationVictory и уводим в End с новым титулом.
        // Победа засчитывается только при q.repVictoryArmed (см. dialogue.js
        // victory_continue: «обучалка» пройдена + выбрано «Продолжить игру»).
        const victory = checkVictory(this.registry);
        if (victory.victory) {
            ActionLog.add(this.registry, tf(t('ПОБЕДА: {0}'), victory.message));
            const q = this.registry.get('quest');
            q.reputationVictory = true;
            q.currentObjective = t('Тебя приняли в деревню как своего! Победа!');
            this.registry.set('quest', q);
            this.scene.start('End');
            return;
        }
        // Порог +100 взят ДО «обучалки»/выбора продолжения — один раз за игру
        // подсказываем, что венец добрых дел ещё впереди (без перегруза HUD).
        if (victory.thresholdReached) {
            const q = this.registry.get('quest') || {};
            if (!q.repThresholdNoted) {
                q.repThresholdNoted = true;
                this.registry.set('quest', q);
                ActionLog.add(this.registry, t('Деревня тебя полюбила, но зваться «своим» судьбой суждено после возврата иконы и продолжения похода.'));
                this.showFloatingText(this.playerObj.x, this.playerObj.y - 52, t('Деревня тебя полюбила!'), '#a8d46a');
            }
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
                // П.22 (раунд 37): анимация ходьбы у обоих типов текстуры
                // (LPC-композит 'player_composite_*' и legacy 'player_*')
                const walkKey = `${this.playerTexKey}_walk_${dir}`;
                if (this.anims.exists(walkKey)) this.playerObj.play(walkKey, true);
                this.lastDir = dir;
            }
            const now = this.time.now;
            if (now - this.lastStepTime > this.stepInterval) {
                this.audioManager.playStep();
                this.lastStepTime = now;
                // Раунд 22 (п.5): 1 минута за шаг (было 0.25) — время в деревне
                // реально течёт, и счётчик действий вора тикает во время ходьбы
                // (15 шагов = 1 действие вора).
                tickTime(this.registry, 1);
            }
        } else {
            // П.22: стоя — idle-кадр в последнем направлении
            const idleKey = `${this.playerTexKey}_idle_${this.lastDir}`;
            if (this.anims.exists(idleKey)) this.playerObj.play(idleKey, true);
        }
        this.playerObj.setVelocity(v.x, v.y);
        // Псевдо-2.5D: обновляем глубину игрока по его Y-позиции каждый кадр
        this.playerObj.setDepth(this.playerObj.y / this.tileSize);

        this.updateNearestInteractable();
        this.updateBirds();
        this.updateHUD();
    }

    /**
     * Раунд 27 (пп.6-11): пересчитать видимых уличных жителей по системе
     * присутствия. Вызывается при создании сцены и при смене часа.
     */
    rebuildStreetNpcs() {
        const ts = this.tileSize;

        // --- Убрать старых (спрайты, подписи, твины, поводки блуждания) ---
        this.streetNpcs.forEach(n => {
            if (n.wander) n.wander.stop();
            if (n.spr) {
                this.tweens.killTweensOf(n.spr);
                n.spr.destroy();
            }
            if (n.label) {
                this.tweens.killTweensOf(n.label);
                n.label.destroy();
            }
            if (n.hint) n.hint.destroy();
        });
        this.streetNpcs = [];
        if (this.elderWalker) {
            const w = this.elderWalker;
            [w.spr, w.label].forEach(o => {
                if (!o) return;
                this.tweens.killTweensOf(o);
                o.destroy();
            });
            if (w.hint) w.hint.destroy();
            this.elderWalker = null;
        }

        // --- Кто сейчас «на улице деревни»? ---
        const registryIds = getNpcs(this.registry).map(n => n.id);
        const allIds = registryIds.length ? registryIds : ALL_NPC_IDS;

        allIds.forEach(id => {
            if (id === 'elder') return; // староста — ходячий, отдельно ниже
            // Раунд 45 (п.3): убитый героем житель исчезает с улицы деревни
            if (isNpcKilled(this.registry, id)) return;
            const pres = getPresence(this.registry, id);
            if (pres.place !== 'village') return;
            const npcData = findNpc(this.registry, id);
            const displayName = npcData ? getNpcDisplayName(this.registry, id) : id;
            const spot = this.streetSpotFor(id);
            if (!spot) return;
            const x = spot.x * ts;
            const y = spot.y * ts;
            // Раунд 28 (п.2): LPC-композит жителя (уникальная внешность).
            // Раунд 37 (п.4): ЕДИНЫЙ масштаб по возрасту — взрослый ровно
            // как игрок, подросток 0.85, ребёнок 0.7 (больше нет гигантов 2.2×).
            const spriteKey = getNpcSpriteKey(this, this.registry, id);
            const kid = isChildNpc(npcData);
            const spr = this.add.sprite(x, y, this.textures.exists(spriteKey) ? spriteKey : 'npc_elder')
                .setScale(this.npcScaleByAge(npcData))
                .setDepth(y / ts + 0.3);
            const animKey = `${spr.texture.key}_idle_down`;
            if (this.anims.exists(animKey)) spr.play(animKey);
            const label = this.add.text(x, y + 36, displayName, {
                fontSize: '12px', color: RUS.text,
                backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(y / ts + 0.5);
            const hint = this.add.text(x, y - 40, t('💬 Поговорить'), {
                fontSize: '10px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(y / ts + 0.5);
            spr.setInteractive({ useHandCursor: true });
            spr.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.busyDialog) this.talkToStreetNpc(id);
            });
            const entry = { id, spr, label, hint, wander: null };
            // Раунд 37 (пп.13,15): осмысленное блуждание по проходимым тайлам
            // с анимацией ходьбы (никаких «дёрганий» и пробежек сквозь дома)
            entry.wander = attachNpcWander(this, {
                spr,
                anchorX: x, anchorY: y,
                radius: kid ? 3 : 2,
                map: this.map, ts,
                label, hint,
                idleMin: kid ? 900 : 1800,
                idleMax: kid ? 2600 : 5200,
                // Раунд 55: жители/дети ходят В 2 РАЗА МЕДЛЕННЕЕ (460→920, 320→640 мс/тайл)
                stepMs: kid ? 640 : 920,
            });
            this.streetNpcs.push(entry);
        });

        // --- Староста (п.10): днём ХОДИТ по деревне, а не сидит в доме ---
        const epres = getPresence(this.registry, 'elder');
        if (epres.place === 'village') {
            const npcData = findNpc(this.registry, 'elder');
            const displayName = npcData ? getNpcDisplayName(this.registry, 'elder') : 'Староста';
            const spriteKey = getNpcSpriteKey(this, this.registry, 'elder');
            const y = 9.5 * ts; // главная улица (ряд 8-9)
            const minX = 3 * ts;
            const maxX = 21 * ts;
            const startX = minX + Math.random() * (maxX - minX);
            const spr = this.add.sprite(startX, y, this.textures.exists(spriteKey) ? spriteKey : 'npc_elder')
                .setScale(this.npcScaleByAge(npcData))
                .setDepth(y / ts + 0.3);
            const walkKey = `${spr.texture.key}_walk_right`;
            if (this.anims.exists(walkKey)) spr.play(walkKey);
            const targetX = Math.random() < 0.5 ? minX : maxX;
            // Раунд 55: староста тоже прогуливается В 2 РАЗА МЕДЛЕННЕЕ
            const walkDur = 24000 + Math.random() * 16000;
            this.tweens.add({
                targets: spr,
                x: { from: startX, to: targetX },
                duration: walkDur,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                onYoyo: () => spr.setFlipX(!spr.flipX),
                onRepeat: () => spr.setFlipX(!spr.flipX),
            });
            const label = this.add.text(startX, y + 36, displayName, {
                fontSize: '12px', color: '#ffd700',
                backgroundColor: '#000000cc', padding: { x: 5, y: 2 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(y / ts + 0.5);
            // Подпись ходит вместе со старостой
            this.tweens.add({
                targets: label,
                x: { from: startX, to: targetX },
                duration: walkDur,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            const hint = this.add.text(startX, y - 40, t('💬 Поговорить'), {
                fontSize: '10px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(y / ts + 0.5);
            spr.setInteractive({ useHandCursor: true });
            spr.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.busyDialog) this.talkToStreetNpc('elder');
            });
            this.elderWalker = { spr, label, hint };
        }
    }

    /**
     * ЕДИНЫЙ масштаб персонажей по возрасту (раунд 37 п.4; раунд 58 п.5 —
     * строго по возрасту, индивидуальный разброс look.scale удалён).
     * Взрослый — ровно как игрок (ts/32 × 0.75), подросток (13–17) — 0.85,
     * ребёнок (≤12) — 0.7.
     */
    npcScaleByAge(npcData) {
        const base = this.tileSize / 32 * 0.75;
        const age = (npcData && npcData.age) || 30;
        if (age <= 12) return base * 0.7;
        if (age <= 17) return base * 0.85;
        return base;
    }

    /**
     * Точка на улице для жителя (в тайлах). Возле своего двора/колодца/ворот.
     * Раунд 37: координаты пересчитаны под карту 26×21 (вторая улица) и
     * добавлены жители новых дворов (знахарка, плотник, гончар, ткачиха,
     * жена рыбака, пастушок, дети).
     */
    streetSpotFor(id) {
        // Раунд 52: все точки пересчитаны под компактную деревню 26×15
        // (дома в трёх рядах; улица B — ряд 5, южная 'S' — ряд 10).
        const SPOTS = {
            peasant1: { x: 4.5, y: 9.4 },       // у дома Авдея (средний ряд)
            widow: { x: 8.5, y: 9.4 },          // у дома Марфы
            beekeeper1: { x: 12.5, y: 9.4 },    // у дома пахаря
            beekeeper_wife: { x: 10.5, y: 10.4 }, // у колодца (9,9), со стороны южной улицы
            elder_wife: { x: 8.5, y: 10.4 },    // у колодца
            blacksmith: { x: 12.5, y: 4.4 },    // у кузницы (северный ряд)
            healer: { x: 4.5, y: 14.4 },        // у дома знахарки (южный ряд)
            hunter: { x: 16.5, y: 14.4 },       // у южного двора
            fisherman: { x: 12.5, y: 14.4 },    // у дома рыбака
            carpenter1: { x: 8.5, y: 14.4 },    // у дома плотника
            carpenter_wife: { x: 6.5, y: 10.4 }, // по воду
            potter1: { x: 17.5, y: 4.4 },       // за домом гончара (сушит горшки)
            potter_wife: { x: 16.5, y: 4.4 },   // у двора гончара
            weaver1: { x: 16.5, y: 14.4 },      // у дома ткачихи
            shepherd_boy: { x: 23.5, y: 13.4 }, // у овчарни (22–24 × 11–12)
            fisher_wife: { x: 11.5, y: 14.4 },  // у дома рыбака
            guard: { x: 24.4, y: 5.4 },         // у ворот (25,5)
            tavernkeeper: { x: 8.5, y: 4.4 },   // у постоялого двора
            priest: null,                       // батюшка не гуляет — он в церкви
            // Детские площадки — у колодца, улицы и дворов
            kid1: { x: 8.2, y: 10.4 }, kid2: { x: 12.6, y: 10.4 },
            kid3: { x: 16.8, y: 10.4 }, kid4: { x: 5.5, y: 13.4 },
            kid5: { x: 19.5, y: 14.4 }, kid6: { x: 13.5, y: 14.4 },
            kid7: { x: 7.5, y: 5.4 },
            kid8: { x: 17.5, y: 5.4 },          // дочка гончара — у дома
            kid9: { x: 3.5, y: 14.4 },          // внучка знахарки — у дома
        };
        return SPOTS[id] || { x: 12.5, y: 5.4 };
    }

    /**
     * Разговор с жителем на улице: полное дерево диалога (если есть)
     * или короткая реплика. Работает и для сдачи поручений (староста
     * принимает икону прямо на улице — раунд 27, п.10).
     */
    talkToStreetNpc(npcId) {
        this.busyDialog = true;
        const npcData = findNpc(this.registry, npcId);
        const displayName = npcData ? getNpcDisplayName(this.registry, npcId) : npcId;
        // Раунд 34: полные деревья на улице тоже говорят «своим» портретом —
        // перекрашенным вариантом NPC (а не рассказчиком, как раньше)
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
        } else {
            const line = pickOutdoorLine(this.registry, npcId, t('Занят(а) своим делом. Заходи в другой раз.'));
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
                        nearest = { type: 'chest', chest: chestEntry, label: tf(t('Открыть: {0}'), t(chestEntry.label)) };
                    }
                }
                if (isGate(cx, cy)) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'gate', label: t('Выйти из деревни') };
                    }
                }

                // ----- Раунд 12: костёр, каменный крест (рыбалка — на Реке) -----
                const tile = (this.map[cy] && this.map[cy][cx] !== undefined) ? this.map[cy][cx] : null;
                if (tile === 'F') {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'campfire', label: t('Отдохнуть у костра (1 час)') };
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
            this.prompt.setText(tf(t('Нажмите E — {0}'), nearest.label)).setVisible(true);
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
        // Раунд 21: отсчёт до побега вора в ДЕЙСТВИЯХ (тиках)
        const ticksLeft = chaseHoursLeft(this.registry);
        
        // Единый статус-бар (п.10): HP | Деньги | Дата | Действия | Репутация
        // Раунд 45 (п.1 заявки): параметр «меч» (⚔%) из виджета УДАЛЁН —
        // владение мечом смотрится в свитке персонажа, а не в строке статуса.
        // Раунд 46 (п.8 заявки): из верхнего виджета удалён и параметр «✦MP» —
        // Воля смотрится в свитке персонажа; механики (молитва, медовуха) целы.
        let statusLine = `❤${p.HP}/${p.HPmax}  💰${moneyStr}`;
        if (timeState) {
            // Раунд 29: дата «как на Руси» — день, народный месяц, лето от Сотворения мира
            statusLine += `  📅${formatDateRus(timeState)}`;
            // Раунд 14: иконка текущей погоды рядом с датой
            if (this.weather) statusLine += ` ${this.weather.icon}`;
            // Раунд 29: живые часы в косом счёте + народный ориентир.
            // Раунд 31: часы — по МИРОВОМУ времени (оно течёт реальным временем
            // и сдвигается на час за каждый разговор/обследование — пп.10–12)
            statusLine += `  🕐${slavonicHourLine(timeState)} · ${folkTimeName(timeState.hour + (timeState.minute || 0) / 60)}`;
        }
        // Раунд 29: анонс новолетия (сигнал из tickTime) — показываем один раз
        const novoletie = this.registry.get('novoletie');
        if (novoletie) {
            this.registry.set('novoletie', null);
            this.showNovoletieAnnounce(novoletie);
        }
        if (ticksLeft > 0) {
            // Раунд 58 (п.2): в статус-баре — часы до побега вора (тик = 1 час)
            statusLine += `  ${tf(t('⏳{0} ч до побега'), ticksLeft)}`;
        }
        // Раунд 46 (п.9 заявки): репутация игрока в деревне — в статус-баре
        // деревни, с явной подписью (раньше была только безымянная звезда ⭐).
        statusLine += `  ⭐${t('Деревня')}: ${villageRep > 0 ? '+' : ''}${villageRep}`;

        // ФИКС аудита UI (этот раунд): длинная строка статуса наезжала на кнопки
        // меню «Обзор/Задания/Персонаж/Инвентарь» (правая зона ~430px) — хвост
        // «⭐Деревня: 0» прятался под кнопкой. Теперь при нехватке ширины строка
        // ужимается по уровням: без народного ориентира → короткая дата → совсем
        // без часов; HP, деньги, счётчик действий и репутация деревни не скрываются.
        this.statusText.setText(statusLine);
        const maxStatusW = this.scale.width - 450;
        let statusTooLong = this.statusText.width > maxStatusW;
        if (statusTooLong && timeState) {
            const icon = this.weather ? ` ${this.weather.icon}` : '';
            const rep = `  ⭐${t('Деревня')}: ${villageRep > 0 ? '+' : ''}${villageRep}`;
            const act = ticksLeft > 0 ? `  ${tf(t('⏳{0} ч до побега'), ticksLeft)}` : '';
            const candidates = [
                // 1) без народного ориентира (« · заутреня отошла»)
                `❤${p.HP}/${p.HPmax}  💰${moneyStr}  📅${formatDateRus(timeState)}${icon}` +
                `  🕐${slavonicHourLine(timeState)}${act}${rep}`,
                // 2) без дня недели и года от Р.Х.
                `❤${p.HP}/${p.HPmax}  💰${moneyStr}  📅${timeState.day}-й ${MONTH_NAMES_GEN[timeState.month] || ''}, лето ${eraYear(timeState)}-е${icon}${act}${rep}`,
                // 3) дата в одну строку без часов
                `❤${p.HP}/${p.HPmax}  💰${moneyStr}  📅${timeState.day} ${MONTH_NAMES[timeState.month] || ''}, лето ${eraYear(timeState)}-е${icon}${act}${rep}`,
            ];
            let chosen = null;
            for (const cand of candidates) {
                this.statusText.setText(cand);
                if (this.statusText.width <= maxStatusW) { chosen = cand; break; }
            }
            if (chosen) {
                statusTooLong = false;
            } else {
                // Крайний случай очень узкого окна — полная строка мелким шрифтом
                this.statusText.setText(statusLine);
            }
        }
        if (statusTooLong) {
            this.statusText.setStyle({ fontSize: '10px' });
        } else if (this.statusText.style.fontSize !== '11px') {
            this.statusText.setStyle({ fontSize: '11px' });
        }
        
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
            // Раунд 36: зимний лёд/камыш убраны вместе с прудом
        }
        
        if (q.currentObjective) {
            this.objectiveText.setText(`◆ ${q.currentObjective}`);
        } else {
            // Раунд 43 (п.2 заявки): квест окончен — надпись о задании НАД ДЕРЕВНЕЙ ПРОПАДАЕТ.
            // Раньше текст оставался висеть навсегда (баг «вечного баннера»). 
            this.objectiveText.setText('');
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearestInteractable) return;
        ActionLog.add(this.registry, tf(t('Игрок взаимодействует с: {0}.'), this.nearestInteractable.label));
        if (this.nearestInteractable.type === 'door') {
            // Раунд 37 (п.19 заявки): если в жилом доме никого нет — дверь ЗАКРЫТА,
            // внутрь не пускаем (поп-ап). Постоялый двор и церковь открыты всегда.
            const closed = this.getInteriorClosure(this.nearestInteractable.interiorId);
            if (closed) {
                this.showClosedHouseDialog(this.nearestInteractable.interiorId, closed);
                return;
            }
            // Пункт 8: интерьер открывается отдельным окном поверх деревни
            this.scene.pause();
            this.scene.launch('Interior', { interiorId: this.nearestInteractable.interiorId, from: 'Village' });
        } else if (this.nearestInteractable.type === 'gate') {
            // Раунд 32 (п.5): выход за околицу — перемещение между локациями,
            // занимает РОВНО 1 игровой час — вор тоже двигается
            tickTime(this.registry, 60);
            ActionLog.add(this.registry, t('Игрок вышел за околицу.'));
            this.scene.start('Fork');
        } else if (this.nearestInteractable.type === 'chest') {
            // nearestInteractable.chest — сырой объект из CHESTS; нужен отрисованный
            // entry {data, img, marker} из this.chests
            const entry = (this.chests || []).find(e => e.data.id === this.nearestInteractable.chest.id);
            this.openChest(entry);
        } else if (this.nearestInteractable.type === 'campfire') {
            this.restAtCampfire();
        } else if (this.nearestInteractable.type === 'cross') {
            this.prayAtCross();
        }
    }

    // П.16,23: Подойти к двери и войти (упрощённо — телепорт + вход)
    walkToAndEnter(interiorId, tx, ty) {
        const ts = this.tileSize;
        // Раунд 37 (п.19): закрытый дом не пускает и при входе кликом
        const closed = this.getInteriorClosure(interiorId);
        if (closed) {
            this.showClosedHouseDialog(interiorId, closed);
            return;
        }
        // Телепортируем игрока к двери (встанем перед ней)
        this.playerObj.setVelocity(0, 0);
        this.playerObj.x = tx * ts + ts / 2;
        this.playerObj.y = (ty + 1) * ts + ts / 2;  // на тайл ниже двери
        if (this.playerObj.body) this.playerObj.body.reset(this.playerObj.x, this.playerObj.y);
        ActionLog.add(this.registry, t('Игрок вошёл в здание.'));
        this.scene.pause();
        this.scene.launch('Interior', { interiorId: interiorId, from: 'Village' });
    }

    /**
     * Раунд 37 (п.19): закрыт ли дом для входа.
     * Возвращается { pres } (присутствие хозяина), если ВХОДИТЬ НЕЛЬЗЯ, иначе null.
     * Открыты всегда: общественные здания (public: true — постоялый двор, церковь)
     * и дома, где хозяин/хозяйка сейчас дома (или вторая фигура — жена).
     * Ковка кузницы при уходе Данилы на постоялый двор (п.20) честно закрывается.
     */
    getInteriorClosure(interiorId) {
        const interior = INTERIORS[interiorId];
        if (!interior || !interior.npcId || interior.noNpc || interior.public) return null;
        const pres = getPresence(this.registry, interior.npcId);
        const ownerHere = pres.place === 'home' || pres.place === interiorId;
        if (ownerHere) return null;
        if (interior.secondaryNpcId) {
            const secPres = getPresence(this.registry, interior.secondaryNpcId);
            if (secPres.place === 'home') return null; // жена дома — дверь открыта
        }
        return { pres };
    }

    /**
     * Раунд 37 (пп.19,20): поп-ап «Дом закрыт, никого нет» с подсказкой,
     * где искать хозяина (деятельность · место).
     */
    showClosedHouseDialog(interiorId, closure) {
        const interior = INTERIORS[interiorId];
        const name = interior ? interior.name : '';
        const pres = closure.pres;
        const where = t(PLACE_NAMES[pres.place] || '') || pres.place;
        const activity = (pres.activity ? t(pres.activity) : t('занят(а) своим делом'));
        ActionLog.add(this.registry, tf(t('Дверь закрыта: {0}. Хозяин: {1} ({2})'), name, activity, where));
        this.busyDialog = true;
        createDialog(this,
            t('Дом закрыт'),
            `${t('🔒 Дом закрыт, никого нет')}` +
            `\n\n${name}\n` +
            tf(t('Хозяин сейчас: {0} · {1}'), activity, where),
            [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
            { singletonKey: `closed-${interiorId}` });
    }

    /**
     * РАУНД 52 (п.5): если окно БОЛЬШЕ мира (1248×720), показываем деревню
     * целиком — камера центрируется, скролл не нужен (локация уплотнена
     * «на один экран»). Если окно меньше — обычный follow за игроком.
     */
    applyCameraFit() {
        const cam = this.cameras.main;
        const vw = this.scale.width, vh = this.scale.height;
        // Раунд 52: деревня уплотнена до 26×15 — на десктопе держим её ЦЕЛИКОМ
        // на экране (zoom-fit по меньшей стороне); на узких экранах (<900px)
        // камера следует за героем как раньше.
        const canFit = vw >= 900 && !this._overviewMode;
        if (canFit) {
            const zoom = Math.min(vw / this.worldW, vh / this.worldH);
            if (!this._fitMode) {
                this._fitMode = true;
                cam.stopFollow();
                cam.setBackgroundColor('#3d5232');
            }
            cam.setZoom(zoom);
            cam.centerOn(this.worldW / 2, this.worldH / 2);
        } else if (this._fitMode) {
            this._fitMode = false;
            cam.setZoom(1);
            cam.startFollow(this.playerObj, true, 0.1, 0.1);
        }
    }

    /**
     * Раунд 37 (п.5): обзор ВСЕЙ деревни одним экраном (клавиша M или кнопка 🗺).
     * Камера отъезжает так, чтобы карта влезла целиком; повторное
     * нажатие возвращает камеру к игроку.
     */
    toggleVillageOverview() {
        const cam = this.cameras.main;
        // Раунд 52: на десктопе деревня и так целиком на экране (applyCameraFit) —
        // «обзор» не отключаем, просто подсказываем, что камера уже показывает всё.
        if (this.scale.width >= 900) {
            this.applyCameraFit();
            this.showFloatingText(this.scale.width / 2, this.scale.height - 80,
                t('Деревня уместилась на один экран — обзор не нужен.'), '#c9a14a');
            return;
        }
        if (!this._overviewMode) {
            const zoom = Math.min(this.scale.width / this.worldW, this.scale.height / this.worldH);
            this._overviewMode = true;
            cam.stopFollow();
            cam.setZoom(zoom);
            cam.centerOn(this.worldW / 2, this.worldH / 2);
            if (this.prompt) this.prompt.setVisible(false);
            this.showFloatingText(this.scale.width / 2, this.scale.height - 80,
                t('Видно всю деревню. Нажми ещё раз, чтобы вернуть камеру к себе.'), '#c9a14a');
        } else {
            this._overviewMode = false;
            cam.setZoom(1);
            cam.startFollow(this.playerObj, true, 0.1, 0.1);
            this.showFloatingText(this.scale.width / 2, this.scale.height - 80,
                t('Камера снова следует за тобой.'), '#c9a14a');
        }
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
        // Раунд 27: активность по системе присутствия (где человек сейчас)
        const pres = interior.npcId ? getPresence(this.registry, interior.npcId) : null;
        const activity = pres
            ? `${t(pres.activity)}${pres.place !== 'home' ? ` · ${t(PLACE_NAMES[pres.place] || '')}` : ''}`
            : 'занят';
        const text = `${t(interior.name)}\n${npcName}\n${tf(t('Реп: {0} ({1})'), `${npcRep > 0 ? '+' : ''}${npcRep}`, t(repLevel.name))}\n${activity}`;
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
        // Здания без NPC (амбар): показываем описание вместо «репутации незнакомца»
        const noNpc = interior.noNpc || !interior.npcId;
        let info;
        if (noNpc) {
            info = `${interior.name}\n\n${interior.description || ''}`;
        } else {
            const npcName = this.npcData ? getNpcDisplayName(this.registry, interior.npcId) : interior.npcName;
            const npcRep = getNpcRep(this.registry, interior.npcId);
            const repLevel = getReputationLevel(npcRep);
            // Раунд 27: активность по системе присутствия (где человек сейчас)
            const pres2 = interior.npcId ? getPresence(this.registry, interior.npcId) : null;
            const activity = pres2
                ? `${t(pres2.activity)}${pres2.place !== 'home' ? ` · ${t(PLACE_NAMES[pres2.place] || '')}` : ''}`
                : t('занят');
            info = `${interior.name}\n` +
                `${tf('NPC: {0}', npcName)}\n` +
                `${tf(t('Личная репутация: {0} ({1})'), `${npcRep > 0 ? '+' : ''}${npcRep}`, t(repLevel.name))}\n` +
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

    /**
     * Раунд 29: анонс новолетия — смена года от Сотворения мира
     * (сентябрьское 1 сентября / мартовское 1 марта, сигнал из tickTime).
     */
    showNovoletieAnnounce(novoletie) {
        if (!novoletie) return;
        const { width, height } = this.scale;
        const era = novoletie.era || (eraYear(getTime(this.registry)) + 1);
        const msg = novoletie.style === 'march'
            ? `✨ Новолетие! Весенний год пошёл: лето ${era}-е от Сотворения мира`
            : `✨ Новолетие! Настало лето ${era}-е от Сотворения мира`;
        const txt = this.add.text(width / 2, height * 0.22, msg, {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', align: 'center',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#000000cc', padding: { x: 18, y: 10 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(210);
        this.tweens.add({
            targets: txt,
            alpha: { from: 0, to: 1 },
            duration: 800,
            yoyo: false,
            hold: 4200,
            onComplete: () => {
                this.tweens.add({ targets: txt, alpha: 0, duration: 900, onComplete: () => txt.destroy() });
            },
        });
    }

    // П.20-22: Журнал заданий
    showQuestJournal() {
        const { width, height } = this.scale;
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        // Раунд 43: панель журнала вписывается в экран (при 577px высоты
        // прежние 600px обрезали заголовок и статус сверху).
        const panelW = Math.min(750, width - 20);
        const panelH = Math.min(600, height - 16);
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 20, t('📋 Журнал заданий'), {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        const q = this.registry.get('quest') || {};
        const quests = q.activeQuests || [];
        const timeState = getTime(this.registry);

        if (quests.length === 0) {
            this.add.text(width / 2, height / 2, t('Нет активных заданий.\nПоговорите с жителями деревни.'), {
                fontSize: '16px', color: RUS.textDim, align: 'center',
            }).setOrigin(0.5).setDepth(202);
        } else {
            let y = height / 2 - panelH / 2 + 60;
            quests.forEach((quest) => {
                // П.21: Детальная информация о задании
                const status = quest.completed ? t('✅ Выполнено') : (quest.failed ? t('❌ Провалено') : t('🔄 Выполняется'));
                const statusColor = quest.completed ? '#60ff60' : (quest.failed ? '#ff4040' : '#c9a14a');
                
                // П.22: Срок — РАУНД 61 (п.1): в реалистичных ИГРОВЫХ ЧАСАХ
                // (поручение несёт свой срок: послание 12 ч, волк 12 ч и т.д.).
                // 1 действие = 15 минут, часы = timeLimit/4 (совпадает с timeLimitHours).
                const deadline = tf(t('срок ≈{0} ч'), quest.timeLimitHours || Math.round((quest.timeLimit || 10) / 4));

                // П.18: Штрафы за невыполнение
                // Раунд 43: текст приведён в соответствие с реальным поведением
                // (штраф применяется к репутации заказчика при просрочке).
                const penaltyText = quest.difficulty === 'hard' 
                    ? t('Штраф за провал: −15 к репутации у заказчика') 
                    : (quest.difficulty === 'medium' 
                        ? t('Штраф за провал: −8 к репутации у заказчика') 
                        : t('Штраф за провал: −3 к репутации у заказчика'));

                // П.21.7: Награды
                const rewardsText = (quest.rewards || []).map(r => {
                    if (r.type === 'money') return `${r.amount} д.`;
                    if (r.type === 'item') return `${r.name} ×${r.count}`;
                    if (r.type === 'blessing') return t('благословение');
                    return r.name || '';
                }).join(', ');

                const questInfo = [
                    `${quest.title}`,
                    `${t('Выдал:')} ${quest.npcName || t('неизвестно')}`,
                    // Раунд 43 (п.3 заявки): ПОЛНОЕ описание задания — только здесь,
                    // в журнале «📋 Задания» (в мире — только короткий статус).
                    `${t('Описание:')} ${quest.description || '—'}`,
                    `${t('Срок:')} ${deadline}  |  ${t('Сложность:')} ${t(quest.difficulty === 'hard' ? 'тяжёлая' : (quest.difficulty === 'medium' ? 'средняя' : 'лёгкая'))}`,
                    `${t('Цель:')} ${quest.objective}`,
                    `${t('Награда:')} ${rewardsText || t('нет')}`,
                    `${penaltyText}`,
                    `${t('Сдавать:')} ${quest.npcName || t('тому же NPC')}`,
                ].join('\n');

                this.add.text(width / 2 - panelW / 2 + 20, y, questInfo, {
                    fontSize: '12px', color: '#E8DCC4',
                    fontFamily: 'Arial, sans-serif',
                    stroke: '#000', strokeThickness: 1,
                    lineSpacing: 3,
                    wordWrap: { width: panelW - 40 },
                }).setOrigin(0, 0).setDepth(202);

                // Цветная метка статуса — ОТДЕЛЬНОЙ строкой НАД заголовком
                // (раунд 43: раньше статус рисовался дважды и наезжал на текст).
                this.add.text(width / 2 - panelW / 2 + 20, y - 16, status, {
                    fontSize: '12px', color: statusColor, fontStyle: 'bold',
                }).setOrigin(0, 0).setDepth(203);

                y += 126;
                if (y > height / 2 + panelH / 2 - 60) return; // не выходим за пределы
            });
        }

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 25, 140, 30, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 25, t('Закрыть'), {
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
            // Раунд 12: курица (9,14) переехала (с раунда 36 там открытое место)
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
            ActionLog.add(this.registry, tf(t('Заглянул в «{0}» — уже обыскан сегодня.'), t(chest.label)));
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
        ActionLog.add(this.registry, tf(t('Обыскал «{0}»: {1}.'), t(chest.label), msg));
    }

    // ================================================================
    // РАУНД 12: костёр и каменный крест (пруд/рыбалка удалены — раунд 36)
    // ================================================================

    /**
     * Костёр у таверны (тайл 'F'): анимированное пламя из 3 кадров, тёплый
     * свет с мерцанием (updateHUD), редкий дымок. Отдых — через tryInteract.
     */
    createCampfire(ts) {
        // Раунд 37 (п.14 заявки): костёр у постоялого двора УДАЛЁН — тайлов 'F'
        // на карте больше нет, метод оставлен на случай возврата костра.
        if (!this.map || !this.map.some(row => row.includes('F'))) return;
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
            ActionLog.add(this.registry, t('Погрелся у костра — силы и так полны.'));
            return;
        }
        this.busyDialog = true;
        const close = () => { this.busyDialog = false; };
        createDialog(this, t('🔥 Костёр'),
            'Тёплый огонь разгоняет усталость. Присесть на минутку — а очнёшься через час крепкого сна.\n\nОтдохнуть у костра? (1 час — здоровье и Воля восстановятся полностью.)',
            [
                { text: t('Присесть у огня'), callback: () => {
                    close();
                    this.cameras.main.fadeOut(700, 0, 0, 0);
                    this.time.delayedCall(750, () => {
                        tickTime(this.registry, 60);
                        player.HP = hpMax;
                        player.MP = mpMax;
                        this.registry.set('player', player);
                        this.updateHUD();
                        this.audioManager.playSound('sfx_heal');
                        ActionLog.add(this.registry, t('Отдохнул у костра — час крепкого сна, силы восстановились.'));
                        this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, 'Силы восстановились', '#8fdc7a');
                        this.cameras.main.fadeIn(700, 0, 0, 0);
                    });
                } },
                { text: 'Не сейчас', callback: close },
            ]);
    }

    /**
     * Раунд 36: рыбалка переехала из деревни на РЕКУ (локация карты,
     * LocationScene.goFishing) — пруд с причалом удалён из деревни
     * по заявке владельца («убрать тайлы воды из деревни»).
     */

    /**
     * Раунд 12: молитва у каменного креста — 1 час, +2..5 Воли, раз в день
     * (тихая альтернатива церковной молитве, §5.1 роадмапа).
     */
    prayAtCross() {
        if (this.busyDialog) return;
        const player = this.registry.get('player');
        if (!player) return;
        const q = this.registry.get('quest') || {};
        const today = dayKeyOf(getTime(this.registry));
        if (isOpenedToday(q, 'cross_prayer', today)) {
            this.showFloatingText(this.playerObj.x, this.playerObj.y - 44, 'Душа уже очистилась сегодня', '#b8a88a');
            ActionLog.add(this.registry, t('Помолился у креста (уже молился сегодня).'));
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

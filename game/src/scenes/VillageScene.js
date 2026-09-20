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
        // Раунд 64 (п.7): хозяйственные постройки (стога/поленница/телега)
        // удалены из деревни — их тайлы больше не покрываются.

        // Раунд 64 (пп.1,4): линия частокола у ворот удалена — деревня
        // открытая, ворота стоят свободной аркой (gateFenceTiles упразднены).

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
                    // Раунд 64 (пп.3,4): тайл 'G' снова ПЕСЧАНАЯ ДОРОГА —
                    // старое переопределение на траву (r39/r63) снято: проезд
                    // воротни-арки village_gate_r64 прозрачен, дорога должна
                    // быть видна СКВОЗЬ арку (в r63 дорогу рисовала сама
                    // текстура воротни — теперь у арки проезд честно пустой).
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
        // Спрайты домов. РАУНД 64 (пп.8,9 приказа владельца): ВСЕ ДОМА
        // ПЕРЕСОБРАНЫ ИЗ ЧАСТЕЙ — «СТЕН И КРЫШ» (вариант 9 из приказа;
        // генератор tools/make_houses_r64.py собирает их из тайлов деревни:
        // стены wall_log/wall_plank/plaster + кровли roof_thatch/roof_wood).
        // У КАЖДОГО дома честные боковые стены (угловые столбы-замки во всю
        // высоту), каменный цоколь, наличники/ставни/цветники — ничего не
        // обрезано. Двухэтажный только постоялый двор (hp_inn, п.6 прежних
        // приказов); часовня — цельный вырез vh_chapel.
        const HOUSE_SPRITE_BY_ID = {
            elder_house: 'hp_log_wood_a',        // дом старосты: тёс-дранка, труба
            tavern: 'hp_inn',                    // ПОСТОЯЛЫЙ ДВОР: двухэтажный (разрешено, п.6)
            blacksmith: 'hp_plank_wood_a',       // кузница: тёс под тёмной дранкой
            potter_house: 'hp_log_thatch_a',     // изба-сруб под соломой, труба
            villager_house_1: 'hp_log_thatch_b', // сруб с цветниками у окон
            villager_house_2: 'hp_log_thatch_a', // как дом гончара, ЗЕРКАЛЬНО
            beekeeper_house: 'hp_plank_thatch_a',// тёс под соломой
            healer_house: 'hp_plaster_thatch_a', // беленая изба под соломой, труба
            carpenter_house: 'hp_log_wood_a',    // сруб под дранкой, труба слева
            fisher_house: 'hp_log_thatch_b',     // как дом Авдея, ЗЕРКАЛЬНО
            weaver_house: 'hp_plank_thatch_a',   // тёс под соломой, ЗЕРКАЛЬНО
            shop_tools: 'hp_narrow_thatch',      // узкий дом ремесленника (2×3)
            grocer_house: 'hp_plaster_wood_a',   // беленая изба под дранкой
            butcher_house: 'hp_narrow_wood',     // узкий дом мясника, ЗЕРКАЛЬНО
            shoemaker_house: 'hp_log_thatch_b',  // сруб с цветниками
            woodcutter_house: 'hp_log_wood_b',   // лесная изба под дранкой
            villager_house_3: 'hp_log_thatch_a', // дом Степана (на месте овчарни)
            church: 'vh_chapel',                 // часовня: звонница, шатёр и крест
        };
        // Дома, рисуемые ЗЕРКАЛЬНО (разнообразие фасадов; зеркала разнесены
        // так, чтобы одинаковые избы не стояли рядом)
        const FLIP_HOUSES = new Set(['villager_house_2', 'beekeeper_house', 'butcher_house',
            'carpenter_house', 'fisher_house', 'woodcutter_house']);
        // Раунд 64 (п.6): ДЫМ ИЗ ТРУБ УДАЛЁН (отображался неправильно) —
        // ни CHIMNEY_SPRITES, ни smokeBuildings больше нет.
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
            const sprKey = HOUSE_SPRITE_BY_ID[b.interiorId];
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
            // Раунд 38: передаём ключ спрайта (для деталей без дублей со спрайтом).
            this.addBuildingDetails(b, ts, !!usedSprite, usedSprite ? sprKey : null);

            // Раунд 64 (пп.1,7): ограды/калитки/грядки у жилых домов удалены
            // (addYardAndGarden упразднён — «УДАЛИТЬ ВСЕ ОГРАДЫ» + «УДАЛИТЬ
            // ОГОРОДЫ»; двор каждой избы теперь открыт).

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

        // Раунд 64 (п.6): ДЫМ ИЗ ТРУБ ДОМОВ УДАЛЁН по приказу владельца
        // («дым отображался неправильно») — ни smokeBuildings, ни таймера дыма.

        // Раунд 64 (пп.2,5): воробьиные стайки тоже убраны вместе со всей
        // живностью деревни (куры/коровы/воробьи — spawnChickens и
        // spawnBirdFlocks удалены целиком).

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

        // Раунд 64 (п.1): ВСЕ ОГРАДЫ УДАЛЕНЫ — ни придомовых заборов,
        // ни оград общественных зданий (addYardAndGarden/addPublicFence
        // упразднены вместе с грядками — см. п.7).

        // Раунд 64 (п.5): живность (куры/коровы/воробьи) удалена из деревни.

        // ----- Полевые цветы/кочки и сундуки с лутом (раунд 11) -----
        this.scatterFlowers(ts);
        this.spawnChests(ts);

        // ----- Раунд 12: костёр и лампада креста (пруд удалён в раунде 36) -----
        this.createCampfire(ts);
        this.createCrossGlow(ts);

        // Раунд 64 (п.7): стога, поленница и телега удалены (drawYardProps
        // упразднён; «кроме домов и ворот» — хозяйственных построек больше нет).

        // ----- Раунд 27 (пп.6-11): ЖИТЕЛИ НА УЛИЦАХ -----
        // Староста гуляет (п.10), жёны у колодца, стражник у ворот,
        // жители случайно ходят/сидят на постоялом дворе (п.11).
        this.streetNpcs = [];
        this.elderWalker = null;
        this._lastStreetHour = -1;
        this.rebuildStreetNpcs();

        // ----- Ворота (п.20 заявки раунда 39): ворота на ВОСТОЧНОЙ околице.
        // РАУНД 64 (пп.3,4): воротня-АРКА village_gate_r64 — широкая и
        // ВИДНАЯ, БЕЗ башенок (п.4) и без частокола (п.1); дом ремесленника
        // сдвинут на колонку 21, так что арке ничего не мешает. Надпись
        // «ВЫХОД ▶» осталась — указывает на проезд.
        const gatePx = (MAP_W - 1) * ts + ts / 2;
        const gatePy = VILLAGE_GATE.row * ts + ts / 2;
        this.drawVillageGate(ts);
        const gateLabel = this.add.text(gatePx - ts * 2.6, gatePy - ts * 0.4, t('ВЫХОД ▶'), {
            fontSize: '16px', color: '#ff8060', backgroundColor: '#00000088',
            padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);

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
                    '✝ Крест — молитва. 🎣 Рыбалка — на Реке (по карте). 🚪 Новый дом Степана — на востоке южной улицы.\n' +
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

        // Раунд 64 (п.5): куры в деревне больше не спавнятся (spawnChickens
        // удалён вместе со всей живностью — см. пп.2,5 приказа).

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
     * (крест на звоннице уже «запечён» в vh_chapel).
     */
    addBuildingDetails(b, ts, usedSprite = false, sprKey = null) {
        const cx = b.col * ts + b.w * ts / 2;
        const topY = b.row * ts;

        if (b.interiorId === 'church') {
            if (usedSprite) {
                // РАУНД 62: деревянная часовня vh_chapel — крест уже стоит
                // на звоннице в самой текстуре, лишний крест не рисуем.
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
            // Дымоход: РАУНД 62 УДАЛЁН — у целого фасада постоялого двора
            // (vh_inn) труба поверх крыши больше не рисуется.

        } else if (b.interiorId === 'blacksmith') {
            // Кузница: молот + наковальня (эмблема)
            this.add.text(cx, topY - ts * 0.4, '🔨', {
                fontSize: '18px',
            }).setOrigin(0.5).setDepth(9);
            // Труба: РАУНД 62 УДАЛЕНА — у кузнечного сарая (vh_logroof)
            // трубы нет; дым из горна больше не рисуется над целой кровлей.

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
            // Раунд 63 (п.2): лавка стала ДОМОМ ремесленника — эмблема весов снята
            // (у жилых домов эмблем ремесла не ставят; труба с дымом теперь есть).
        } else if (b.interiorId === 'villager_house_3') {
            // Раунд 64 (п.5): эмблема «🐔» снята вместе со всей живностью —
            // кур в деревне больше нет (и у дома Степана тоже).
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
     * РАУНД 64 (пп.3,4 приказа): воротня-АРКА village_gate_r64 (132×184,
     * готовый PNG из tools/make_houses_r64.py) — широкая фронтальная арка
     * БЕЗ башенок (п.4) и без частокольных крыльев (п.1): два массивных
     * столба на каменных основаниях, несущая балка с подкосами, вальмовая
     * кровля «как у домов», фонарь в проезде. Проезд прозрачен — дорога
     * видна сквозь арку. Арка стоит правее дома ремесленника (дом сдвинут
     * на колонку 21) и выше избы сапожника — НИЧТО НЕ ПЕРЕКРЫТО.
     * Глубина 5.0: игрок на улице (глубина ~5.5) проходит ПЕРЕД столбами,
     * подошедший с севера/юга честно уходит ЗА ворота.
     */
    drawVillageGate(ts) {
        if (!this.textures.exists('village_gate_r64')) return;
        // Правая кромка арки — в 4px от восточного края карты (не режется
        // границей), основание — на нижней кромке дороги (ряд 5.75).
        const img = this.add.image(MAP_W * ts - 70, VILLAGE_GATE.row * ts + ts * 0.75, 'village_gate_r64');
        img.setOrigin(0.5, 1);          // якорь: низ по центру
        img.setDepth(5.0);
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
        // Раунд 64: updateBirds удалён вместе с воробьями (пп.2,5 приказа).
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
            // РАУНД 63 (пп.6,7): «жители не должны бегать так быстро и бесцельно»
            //  - скорость ХОДЬБЫ ещё ниже: 920→1500 мс/тайл (взрослые),
            //    640→1150 (дети); минимум 480→900 мс (см. NpcWander);
            //  - МЕНЬШЕ СУЕТЫ: дольше стоят на месте (idle 3.8–8.6 с),
            //    радиус блуждания ужат, после паузы житель нередко
            //    продолжает стоять (wanderChance) — движение стало редким
            //    и спокойным, а не суетливым марафоном.
            entry.wander = attachNpcWander(this, {
                spr,
                anchorX: x, anchorY: y,
                radius: kid ? 2 : 2,
                map: this.map, ts,
                label, hint,
                // Раунд 64: blockedTiles (частокол у ворот) упразднён —
                // деревня открытая, оград нет.
                idleMin: kid ? 2400 : 3800,
                idleMax: kid ? 5400 : 8600,
                stepMs: kid ? 1150 : 1500,
                wanderChance: kid ? 0.6 : 0.55,
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
            // Раунд 63 (пп.6,7): и ЕЩЁ медленнее — неспешный обход 42–64 с
            const walkDur = 42000 + Math.random() * 22000;
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
            shepherd_boy: { x: 15.5, y: 14.4 }, // при матери-ткачихе (овчарня снята, р.63)
            peasant2: { x: 23.5, y: 14.4 },     // у своего нового дома (р.63, п.1)
            peasant2_wife: { x: 20.5, y: 10.4 }, // по воду (южная улица)
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

            // Раунд 64 (пп.2,5): живности в деревне больше нет — куры,
            // корова и воробьиные стайки удалены по приказу владельца.

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

    // Раунд 63 (п.8): createAmbientCritters (бабочки + светлячки) УДАЛЕНЫ —
    // ромбовидные «летающие призмы» больше не порхают над деревней.

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

        // Раунд 64 (п.6): дым над костром тоже убран — тот же механизм
        // puffs, что и у труб (владельцу не нравился).
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

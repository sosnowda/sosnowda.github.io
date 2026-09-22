// Сцена загрузки: загружает реальные pixelart-ассеты из /assets/
// и создаёт персонажа/квест при первом запуске.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { createCharacter } from '../systems/Character.js';
import { paletteLayerFiles } from '../systems/NpcLpc.js';
import { isEn } from '../systems/i18n.js';  // раунд 37 (п.7): полоска загрузки по языку
import { ensureFemaleChestTexture, ensureHeadTextures } from '../systems/CharacterAppearance.js'; // раунд 39 (п.4) + головы (р.61)
// Раунд 61: systems/HouseFacade.js УДАЛЕН — плоские процедурные фасады phouse_*
// больше не используются, все дома — целые избы-ассеты (см. VillageScene)

// ============================================================
// Раунд 41 (QA-хардендинг): защита от «тихого замерзания» игры.
//
// Симптом (воспроизведён в QA дважды за раунд): игра продолжает
// рисовать и принимать клики, но сцены больше не обновляются — твины
// стоят, диалоги «мертвы», время не идёт, бой не стартует.
//
// Причина: ЛЮБОЕ исключение внутри SceneManager.update() (например,
// из Clock.update — таймер эффекта печати в ui.js, или из
// DisplayList.shutdown при stop-е сцены с «дырявым» списком)
// оставляло SceneManager.isProcessing = true НАВСЕГДА — Phaser не
// страхует это поле, и каждый следующий кадр выходил из update()
// ранним return. Канвас рисует последний кадр, а игровой цикл мёртв.
//
// Гард: исключение перехватывается, isProcessing сбрасывается, цикл
// живёт, ошибка видна в консоли. Плюс shutdown списка сделан
// устойчивым к «дыркам» (undefined-ссылкам в children.list).
// Ставится в BootScene — единственный модуль, гарантированно
// исполняемый до создания Phaser.Game (index.html импортирует сцены
// напрямую, минуя src/main.js).
// ============================================================
(function () {
    const SM = Phaser.Scenes && Phaser.Scenes.SceneManager;
    if (SM && SM.prototype && typeof SM.prototype.update === 'function') {
        const origUpdate = SM.prototype.update;
        SM.prototype.update = function (time, delta) {
            // QA: в this.scenes могли остаться «дыры» (undefined после неудачного
            // stop/start) — родной цикл падал «reading 'sys' of undefined» КАЖДЫЙ
            // кадр, обрывая обновление всех сцен после дыры. Уплотняем список.
            try {
                if (Array.isArray(this.scenes)) {
                    let compact = false;
                    for (let i = 0; i < this.scenes.length; i++) {
                        if (!this.scenes[i]) { compact = true; break; }
                    }
                    if (compact) {
                        this.scenes = this.scenes.filter(Boolean);
                        console.warn('[Летописи:гард] SceneManager.scenes: удалены дыры');
                    }
                }
            } catch (e) { /* не мешаем основному циклу */ }
            try {
                return origUpdate.call(this, time, delta);
            } catch (e) {
                this.isProcessing = false; // критично: не оставить цикл замороженным
                console.error('[Летописи:гард] Исключение в SceneManager.update (цикл восстановлен):', e);
            }
        };
    }

    const DL = Phaser.GameObjects && Phaser.GameObjects.DisplayList;
    if (DL && DL.prototype && typeof DL.prototype.shutdown === 'function') {
        DL.prototype.shutdown = function () {
            const list = this.list || [];
            for (let i = list.length - 1; i >= 0; i--) {
                const obj = list[i];
                // QA: в списке могли остаться «дырки»/двойные записи —
                // shutdown одной битой ссылки раньше обрывал stop сцены
                if (obj && typeof obj.destroy === 'function') {
                    try { obj.destroy(true); } catch (e) { /* объект уже убит */ }
                }
            }
            list.length = 0;
            if (this.events) {
                this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            }
        };
    }
})();

export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // ----- Прогресс-бар -----
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2 - 20, 400, 20, 0x000000, 0.5).setStrokeStyle(2, RUS.border);
        const bar = this.add.rectangle(width / 2 - 200, height / 2 - 20, 4, 16, RUS.border).setOrigin(0, 0.5);
        this.load.on('progress', (val) => {
            bar.width = 400 * val;
        });
        // Раунд 37 (п.7 заявки): надпись у полоски загрузки — НА ЯЗЫКЕ ИГРЫ
        // (?lang=en с EN-лендинга / localStorage 'gameLang' / <html lang>)
        this.add.text(width / 2, height / 2 + 20, isEn() ? 'Loading…' : 'Загрузка...', {
            fontFamily: 'Georgia, serif', fontSize: '20px', color: '#E8DCC4',
        }).setOrigin(0.5);

        // ----- ТАЙЛЫ -----
        // Трава
        for (let v = 0; v < 4; v++) this.load.image(`tile_grass_${v}`, `assets/tiles/grass_${v}.png`);
        // Тропа
        for (let v = 0; v < 4; v++) this.load.image(`tile_path_${v}`, `assets/tiles/path_${v}.png`);
        // Вода (3 кадра)
        for (let f = 0; f < 3; f++) this.load.image(`tile_water_${f}`, `assets/tiles/water_${f}.png`);
        // Лес
        for (let v = 0; v < 2; v++) this.load.image(`tile_forest_${v}`, `assets/tiles/forest_${v}.png`);
        // Раунд 30 ФИКС: деревья — ФАЙЛОВЫЕ ассеты (PIL, прозрачный фон) вместо
        // пустых runtime-текстур: с раунда 27 deco_tree_*/deco_pine_* генерировались
        // graphics-ом в пустоту (0 непрозрачных пикселей) — деревья не были видны
        // ни в лесу, ни на опушке/поляне, ни в деревне. Ключи прежние —
        // все сцены (Village/Location/Forest) подхватывают фикс автоматически.
        // РАУНД 66 (пп.9,10): ИСХОДНИКИ ПЕРЕЗАПИСАНЫ деревьями из пака
        // владельца «Medieval_Expansion_Trees» (tools/make_assets_r66.py):
        // tree_0..2 — дуб/берёза/липа, tree_3 (НОВЫЙ) — осенний клён,
        // tree_4 (НОВЫЙ) — тёмный вяз, pine_0/1 — ель и пихта.
        for (let v = 0; v < 5; v++) this.load.image(`deco_tree_${v}`, `assets/sprites/tree_${v}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`deco_pine_${v}`, `assets/sprites/pine_${v}.png`);
        // Камень
        for (let v = 0; v < 2; v++) this.load.image(`tile_rock_${v}`, `assets/tiles/rock_${v}.png`);
        // Раунд 28 (п.7): гравийная дорога для тракта (нарисовано PIL-ом)
        this.load.image('tile_gravel_0', 'assets/tiles/gravel_0.png');
        this.load.image('tile_gravel_1', 'assets/tiles/gravel_1.png');
        this.load.image('tile_gravel_edge', 'assets/tiles/gravel_edge.png');
        // Дом (стена + крыша)
        for (let v = 0; v < 3; v++) this.load.image(`tile_house_wall_${v}`, `assets/tiles/house_wall_${v}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`tile_house_roof_${v}`, `assets/tiles/house_roof_${v}.png`);
        // Декорации
        for (let i = 0; i < 4; i++) this.load.image(`deco_well_${i}`, `assets/tiles/well_${i}.png`);
        this.load.image('deco_campfire', 'assets/tiles/campfire.png');
        this.load.image('deco_fence', 'assets/tiles/fence_0.png');

        // ----- СПРАЙТЫ ПЕРСОНАЖЕЙ (spritesheets 64×64, 16 кадров: 4 строки × 4 колонки) -----
        // Раунд 33: 'enemy_thief' — уникальная фигурка вора (капюшон/плащ/кинжал)
        const spriteKeys = ['player', 'npc_elder', 'npc_merchant', 'npc_soldier', 'npc_bandit', 'enemy_bandit', 'enemy_thief', 'enemy_wolf'];
        spriteKeys.forEach((key) => {
            this.load.spritesheet(key, `assets/sprites/${key}.png`, { frameWidth: 64, frameHeight: 64 });
        });

        // ----- РАУНД 50 (пп.7,9): ПЕРСОНАЖИ ИЗ ПАКОВ MEDIEVAL (Townfolk I / Heroes I) -----
        // Конвертация 8×4 @128 → игровые 4×4 @64 (вниз/влево/вправо/вверх).
        // enemy_thief_m/f — вор и воровка (пол выбирается случайно в начале игры);
        // hero_* — готовые облики игрока (кастомизация LPC отключена, п.8).
        const medievalSheets = {
            enemy_thief_m: 'assets/sprites/enemy_thief_m.png',
            enemy_thief_f: 'assets/sprites/enemy_thief_f.png',
            hero_baenor: 'assets/sprites/hero_baenor.png',
            hero_paul: 'assets/sprites/hero_paul.png',
            hero_huntress: 'assets/sprites/hero_huntress.png',
            hero_naia: 'assets/sprites/hero_naia.png',
        };
        Object.entries(medievalSheets).forEach(([key, url]) => {
            this.load.spritesheet(key, url, { frameWidth: 64, frameHeight: 64 });
        });

        // ----- РАУНД 50 (пп.2,4): ТАЙЛОВЫЕ ИНТЕРЬЕРЫ (пакет Medieval - Interiors) -----
        // Фоны 1280×720 собраны из листов Walls/Furniture/Church/Tavern/Profession;
        // статический декор запечён в фон, анимированный огонь/киот рисуются сценой.
        const interiorBgIds = ['tavern', 'blacksmith', 'elder_house', 'potter_house', 'church',
            'villager_house_1', 'villager_house_2', 'villager_house_3', 'healer_house', 'fisher_house',
            'carpenter_house', 'weaver_house', 'beekeeper_house'];
        interiorBgIds.forEach(id => {
            this.load.image(`int_bg_${id}`, `assets/interiors/int_bg_${id}.jpg`);
        });

        // ----- РАУНД 65 (п.10 прежнего приказа, вариант Б): ГОТОВЫЕ ДЕРЕВЯННЫЕ
        // ДОМА из пакета владельца «Fantastic Buildings - Medieval» (Celianna):
        // tools/make_houses_r65.py вырезает цельные здания из тайлсетов пакета
        // (Rural_TileB/C/D/E, City_TileB) — деревянная церковь с звонницей,
        // двухэтажный постоялый двор (только ему разрешена высота), каменная
        // кузница с горном, бревенчатые и соломенные избы. Ни одна стена не
        // обрезана — каждый дом вырезан ЦЕЛИКОМ из фирменного листа.
        // Процедурные hp_* (р.64) из загрузки убраны.
        const fbHouseKeys = ['fb_church', 'fb_inn', 'fb_smithy', 'fb_elder', 'fb_manor',
            'fb_thatch_big', 'fb_thatch_small', 'fb_log_flowers', 'fb_log_thatch',
            'fb_log_big', 'fb_tudor_fl', 'fb_tudor_sm',
            'village_gate_r65', 'village_gate_r66'];
        fbHouseKeys.forEach(k => this.load.image(k, `assets/sprites/${k}.png`));
        // Раунд 65 (п.8) → 66 (п.8): тайл ЧАСТОКОЛА — ПЕРЕДЕЛАН: один ряд
        // круглых брёвен с ЯВНЫМ остриём (tools/make_assets_r66.py)
        this.load.image('tile_palisade', 'assets/tiles/palisade_0.png');

        // ----- РАУНД 51/53: ТАЙЛОВЫЕ ФОНЫ ИНТЕРЬЕРОВ СЛОБОДЫ =====
        const round51BgIds = ['grocer_house', 'butcher_house', 'shop_tools', 'shoemaker_house', 'woodcutter_house'];
        round51BgIds.forEach(id => {
            this.load.image(`int_bg_${id}`, `assets/interiors/int_bg_${id}.jpg`);
        });

        // ----- ПОРТРЕТЫ (раунд 24: живописные портреты из DarklandsReborn) -----
        // 1024×1024 webp, при показе сжимаются до 96×96, перекрашиваются под look NPC.
        // Раунд 34: thief — воровское лицо (капюшон/шрам/ухмылка), boy/girl — дети.
        // Раунд 35: elder_wife — седая старуха (раньше «старухе хозяйке» показывали
        // молодой портрет villager_f — визуальная несостыковка).
        ['elder', 'priest', 'tavernkeeper', 'blacksmith', 'widow', 'healer',
         'hunter', 'guard', 'fisherman', 'peasant', 'thief', 'narrator', 'villager_f',
         'boy', 'girl', 'elder_wife'].forEach((p) => {
            this.load.image(`portrait_${p}`, `assets/sprites/portraits/portrait_${p}.webp`);
        });

        // ----- UI -----
        this.load.image('ui_panel_parchment', 'assets/ui/panel_parchment.png');
        this.load.image('ui_button_wood', 'assets/ui/button_wood.png');

        // ----- ИКОНКИ -----
        ['sword', 'bow', 'herb', 'gold', 'potion', 'icon'].forEach((i) => {
            this.load.image(`icon_${i}`, `assets/icons/${i}.png`);
        });

        // ----- ЧАСТИЦЫ -----
        this.load.image('particle_blood', 'assets/effects/particle_blood.png');
        this.load.image('particle_spark', 'assets/effects/particle_spark.png');
        this.load.image('particle_dust', 'assets/effects/particle_dust.png');
        // Фаза 1: VFX крови — всплеск-декаль из DarklandsReborn (файл как есть)
        this.load.image('fx_blood_splat', 'assets/effects/blood_splat.webp');

        // ----- ИНТЕРЬЕРНЫЕ ТАЙЛЫ И ДЕКОРАЦИИ (для InteriorScene) -----
        for (let v = 0; v < 2; v++) this.load.image(`int_floor_${v}`, `assets/interiors/floor_wood_${v}.png`);
        this.load.image('int_wall', 'assets/interiors/wall_wood.png');
        this.load.image('int_window', 'assets/interiors/window.png');
        this.load.image('int_door_back', 'assets/interiors/door_back.png');
        // Декорации интерьера (базовые + новые; 'chest' удалён — раунд 66.10,
        // приказ владельца: сундуки/тайники не нужны)
        ['table', 'chair', 'candle', 'fireplace', 'anvil', 'bed', 'icon_wall', 'bar', 'barrel',
         'loom', 'shelf', 'hay', 'firewood', 'analogion', 'bench', 'cradle', 'spinning'
        ].forEach((d) => {
            this.load.image(`int_deco_${d}`, `assets/interiors/deco_${d}.png`);
        });
        // Анимированный огонь (4 кадра)
        for (let f = 0; f < 4; f++) this.load.image(`int_fire_${f}`, `assets/effects/fire_${f}.png`);

        // ----- Фаза 1: живописные фоны интерьеров (DarklandsReborn, файлы как есть) -----
        // РАУНД 52: таверна теперь на новом тайловом фоне (загружен выше из
        // int_bg_tavern.jpg) — старая перезапись bg_tavern.jpg УДАЛЕНА.
        // Раунд 54 (аудит): дублирующая загрузка 'int_bg_blacksmith'/'int_bg_church'
        // из СТАРЫХ bg_blacksmith.jpg/bg_church.jpg удалена — Phaser игнорировал
        // дубли ключей, а мёртвые строки сбивали с толку. Новые фоны (r54) грузятся
        // выше через interiorBgIds; старые bg_*.jpg остаются в assets/reserve/.

        // ----- Фаза 1: пергамент GUI (DarklandsReborn) + лента-плашка имени -----
        this.load.image('ui_parchment_a', 'assets/ui/parchment_03.webp');
        this.load.image('ui_parchment_b', 'assets/ui/parchment_04.webp');
        this.load.image('ui_ribbon', 'assets/ui/textribbon.webp');

        // ----- ОГРАДЫ И ГРЯДКИ (для деревни) -----
        this.load.image('tile_fence_h', 'assets/tiles/fence_h.png');
        this.load.image('tile_fence_v', 'assets/tiles/fence_v.png');
        this.load.image('tile_fence_corner', 'assets/tiles/fence_corner.png');
        for (let v = 0; v < 3; v++) this.load.image(`tile_garden_${v}`, `assets/tiles/garden_bed_${v}.png`);

        // ----- П.7: УНИКАЛЬНЫЕ ТАЙЛЫ КРЫШ И СТЕН (top-down) -----
        ['roof_thatch', 'roof_wood', 'roof_tile', 'roof_dark',
         'wall_log', 'wall_plank', 'wall_stone'].forEach((t) => {
            this.load.image(t, `assets/tiles/${t}.png`);
        });

        // ----- ТАЙЛЫ ЛОКАЦИЙ (для LocationScene) -----
        for (let v = 0; v < 2; v++) this.load.image(`tile_forest_dense_${v}`, `assets/tiles/forest_dense_${v}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`tile_road_${v}`, `assets/tiles/road_${v}.png`);
        for (let f = 0; f < 3; f++) this.load.image(`tile_river_${f}`, `assets/tiles/river_${f}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`tile_field_${v}`, `assets/tiles/field_${v}.png`);
        this.load.image('tile_gate', 'assets/tiles/gate.png');

        // ----- ТАЙЛЫ НОВЫХ ЛОКАЦИЙ (озеро, погост, выпас) -----
        for (let f = 0; f < 3; f++) this.load.image(`tile_lake_${f}`, `assets/tiles/lake_${f}.png`);
        this.load.image('tile_cemetery_ground', 'assets/tiles/cemetery_ground.png');
        for (let v = 0; v < 2; v++) this.load.image(`deco_grave_${v}`, `assets/tiles/grave_cross_${v}.png`);
        this.load.image('tile_pasture_grass', 'assets/tiles/pasture_grass.png');

        // ----- ДЕКОРАЦИИ ЛОКАЦИЙ (часовня, скот, храм, дома) -----
        this.load.image('deco_chapel', 'assets/sprites/deco_chapel.png');
        this.load.image('deco_cow', 'assets/sprites/deco_cow.png');
        this.load.image('deco_goat', 'assets/sprites/deco_goat.png');
        this.load.image('deco_horse', 'assets/sprites/deco_horse.png');
        // РАУНД 62: deco_church_building из загрузки убран — церковь теперь
        // деревянная часовня vh_chapel (единый стиль со всей деревней).
        for (let v = 0; v < 4; v++) this.load.image(`deco_house_${v}`, `assets/sprites/deco_house_${v}.png`);
        // Раунд 38 (этап 2 Варианта Б): дома, сконвертированные из 3D-моделей
        // (Google Drive glb → орто-рендер с UV-текстурами → квантование палитры + контур)
        // РАУНД 62: 3D-кузница (house3d_blacksmith) из загрузки УБРАНА —
        // кузница теперь бревенчатая vh_logroof в едином стиле деревни.
        // (Файлы старых домов оставлены в assets/reserve/.)

        // ----- РАУНД 52 (пп.1,4): ДЕРЕВЯННЫЕ ДОМА — ЖИЛЫЕ ДОМА ДЕРЕВНИ -----
        // РАУНД 62: фасады wood_house_* из загрузки убраны — вся деревня
        // переведена на новый полный набор vh_* (без обрезов).

        // ===== НОВЫЕ АССЕТЫ (п.1-5 ТЗ) =====

        // ----- Quaternius PBR-текстуры (32×32) для домов/стен -----
        const quatTiles = [
            'brick_red_32', 'brick_dark_32', 'brick_uneven_32', 'plaster_32',
            'wood_trim_32', 'roof_tile_32', 'rock_trim_32', 'vine_leaf_32',
            'terrain_dirt_32', 'window_gradient_32',
        ];
        quatTiles.forEach((t) => this.load.image(`qt_${t}`, `assets/tiles/quaternius/${t}.png`));

        // ----- Fantasy Knight (aamatniekss) — для CombatScene -----
        // Все кадры 120×80, одна строка (рыцарь смотрит вправо).
        const knightAnims = [
            'idle', 'walk', 'attack1', 'attack2', 'attack_cmb', 'hit', 'death',
            'jump', 'fall', 'roll', 'slide', 'dash', 'crouch',
        ];
        knightAnims.forEach((a) => {
            this.load.spritesheet(`knight_${a}`, `assets/sprites/knight/${a}.png`,
                { frameWidth: 120, frameHeight: 80 });
            // Альтернативная цветовая вариация
            this.load.spritesheet(`knight_${a}_c2`, `assets/sprites/knight/${a}_c2.png`,
                { frameWidth: 120, frameHeight: 80 });
        });

        // ----- LPC Farm Animals — для VillageScene (walk + eat) -----
        // Walk-листы: 4 направления × 7 кадров (6 walk + 1 idle) = 28 кадров, 64×64.
        const animals = ['cow', 'llama', 'pig', 'sheep', 'chicken'];
        animals.forEach((a) => {
            this.load.spritesheet(`animal_${a}_walk`, `assets/sprites/animals/${a}_walk.png`,
                { frameWidth: 64, frameHeight: 64 });
            this.load.spritesheet(`animal_${a}_eat`, `assets/sprites/animals/${a}_eat.png`,
                { frameWidth: 64, frameHeight: 64 });
        });

        // ----- LPC Wolf — для CombatScene (combat sheet 6×5 × 64px) -----
        // wolf_combat.png: row 0=idle(1+5), row 1=walk(6), row 2=attack(6),
        // row 3=hurt(1+5), row 4=die(6). Все лицом вниз.
        this.load.spritesheet('wolf_combat', 'assets/sprites/wolf_combat.png',
            { frameWidth: 64, frameHeight: 64 });
        // Полные LPC-листы — для деревни/разных направлений. Фаза 1 ФИКС:
        // боевые side-кадры волка берутся из ПУСТЫХ ячеек сетки 64×64
        // (frame 5 — стойка, frames 35-37 — рык), т.к. frame 15 содержал
        // обрывки двух соседних кадров («двойной волк» в бою).
        for (let i = 1; i <= 6; i++) {
            this.load.spritesheet(`wolf_full_${i}`, `assets/sprites/wolf_${i}.png`,
                { frameWidth: 64, frameHeight: 64 });
        }

        // ----- Universal LPC Character Generator слои -----
        // Загружаем манифест с перечнем опций
        this.load.json('lpc_manifest', 'assets/lpc/manifest.json');

        // ----- Раунд 28 (п.2): LPC-композиты жителей Вариант A -----
        // Жители собираются системой композитинга как герой. Слои выбираются
        // из фиксированной крестьянской палитры (NpcLpc.PALETTE) — здесь
        // предзагружаются ровно эти файлы (небольшие PNG, суммарно ~1.5 МБ),
        // чтобы жители выглядели LPC-персонажами в ЛЮБОМ пути старта игры
        // (и «свой персонаж», и быстрый).
        paletteLayerFiles().forEach(({ key, cat, name }) => {
            this.load.image(key, `assets/lpc/${cat}/${name}.png`);
        });
        // Загружаем все PNG-слои по списку из манифеста.
        // Это ~250 файлов, каждый 832×2944. Загрузка идёт в фоне с прогресс-баром.
        // Чтобы не блокировать игру, мы загружаем только манифест здесь,
        // (палитра слоёв грузится здесь целиком; генератор персонажа раунда 61 удалён)

        // Запасная частица (для совместимости со старым кодом)
        const pg = this.make.graphics({ add: false });
        pg.fillStyle(0xffffff, 1);
        pg.fillRect(0, 0, 8, 8);
        pg.generateTexture('particle', 8, 8);
        pg.destroy();

        // ----- Процедурные текстуры (сундуки, цветы) — раунд 11 -----
        this.createDecoTextures();

        // ----- Процедурные текстуры Тёмного леса — раунд 13 -----
        this.createForestTextures();

        // ----- Процедурные текстуры Пасеки — раунд 16 -----
        this.createApiaryTextures();

        // ----- Процедурные текстуры хозяйственных построек — раунд 17 -----
        this.createVillageYardTextures();

        // ----- РАУНД 65: воротня village_gate_r65 — ГОТОВЫЙ PNG из
        // tools/make_houses_r65.py (профильный створ, проёмом к выходу).
        // Процедурный createGateTexture (r57–r63) удалён вместе с методом.

        // ----- АУДИО -----
        // SFX
        const sfxKeys = [
            'sfx_button_click', 'sfx_button_hover',
            'sfx_sword_hit', 'sfx_sword_miss',
            'sfx_bow_shoot', 'sfx_arrow_hit',
            'sfx_damage_taken', 'sfx_heal', 'sfx_level_up',
            'sfx_dialogue_open', 'sfx_dialogue_close',
            'sfx_step', 'sfx_typewriter',
            // Раунд 23: боевые SFX из репозитория DarklandsReborn (sosnowda)
            'sfx_combat_hit_1', 'sfx_combat_hit_2', 'sfx_combat_hit_3', 'sfx_combat_hit_4',
            'sfx_combat_miss_1', 'sfx_combat_miss_2', 'sfx_combat_swing',
            'sfx_combat_armor', 'sfx_combat_shield',
            'sfx_combat_death', 'sfx_wolf_howl',
            // Раунд 24: мир и торговля (DarklandsReborn)
            'sfx_church_bell', 'sfx_door_open', 'sfx_door_close',
            'sfx_gold_receive', 'sfx_gold_spend', 'sfx_prayer_chant',
        ];
        sfxKeys.forEach((key) => {
            this.load.audio(key, `assets/audio/sfx/${key}.ogg`);
        });
        // Музыка
        this.load.audio('music_menu', 'assets/audio/music/music_menu.ogg');
        this.load.audio('music_village', 'assets/audio/music/music_village.ogg');
        this.load.audio('music_combat', 'assets/audio/music/music_combat.ogg');

        // Раунд 24: эмбиент локаций (лёгкие циклы, DarklandsReborn)
        ['ambient_town_day', 'ambient_town_night', 'ambient_forest_day',
         'ambient_forest_night', 'ambient_tavern'].forEach((key) => {
            this.load.audio(key, `assets/audio/ambient/${key}.ogg`);
        });

        // Сохраняем список аудио-ключей в registry для AudioManager
        this.registry.set('audioKeys', sfxKeys);
    }

    create() {
        // ----- Раунд 39 (п.4 заявки): оверлей груди для женских LPC-персонажей —
        // canvas-слой «поверх одежды», один раз за игру (см. CharacterAppearance.js)
        // Раунд 61 (п.9): + ГОЛОВЫ жителей под цвет кожи тел (безголовые body-файлы
        // пакa не рисуют голову — из-за этого «одежда висела отдельно от тела») -----
        ensureFemaleChestTexture(this);
        const headsMade = ensureHeadTextures(this);
        if (headsMade > 0) console.info(`[Boot] LPC heads generated: ${headsMade}`);

        // ----- Фаза 0: ДОМА (раунд 61: phouse_* больше НЕ генерируются —
        // все дома теперь целые избы из настоящих ассетов, см. VillageScene) -----

        // ----- Фаза 1: мягкая виньетка (radial gradient) — канвас-текстура,
        // создаётся ОДИН раз за игру, используется интерьерами и боем для читаемости -----
        if (!this.textures.exists('vignette_soft')) {
            const VS = 512;
            const cv = this.textures.createCanvas('vignette_soft', VS, VS);
            if (cv) {
                const ctx = cv.getContext();
                const grad = ctx.createRadialGradient(VS / 2, VS / 2, VS * 0.30, VS / 2, VS / 2, VS * 0.74);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.62, 'rgba(0,0,0,0.20)');
                grad.addColorStop(1, 'rgba(0,0,0,0.66)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, VS, VS);
                cv.refresh();
            }
        }

        // ----- Раунд 15: восстанавливаем аудио-настройки из localStorage -----
        // (пишет их Title-панель настроек; AudioManager всех сцен читает settings.audio.*)
        try {
            const raw = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            if (raw && raw.audio) {
                if (typeof raw.audio.musicMuted === 'boolean') this.registry.set('settings.audio.musicMuted', raw.audio.musicMuted);
                if (typeof raw.audio.sfxMuted === 'boolean') this.registry.set('settings.audio.sfxMuted', raw.audio.sfxMuted);
                if (typeof raw.audio.musicVolume === 'number') this.registry.set('settings.audio.musicVolume', raw.audio.musicVolume);
                if (typeof raw.audio.sfxVolume === 'number') this.registry.set('settings.audio.sfxVolume', raw.audio.sfxVolume);
            }
        } catch (e) { /* noop */ }

        // ----- Раунд 37 (п.1): текстуры ИКОНКИ ВЕТРЯНОЙ МЕЛЬНИЦЫ для карты
        // развилки (ForkScene). Башня с шатровой крышей + крестовина крыльев
        // (крылья рисуются отдельной текстурой — ForkScene медленно вращает их).
        try {
            if (!this.textures.exists('icon_windmill_tower')) {
                const g = this.make.graphics({ x: 0, y: 0, add: false });
                // Тень
                g.fillStyle(0x000000, 0.25);
                g.fillEllipse(26, 42, 40, 8);
                // Сруб-башня (сужается вверх)
                g.fillStyle(0x8a6a42, 1);
                g.fillTriangle(12, 42, 40, 42, 34, 14);
                g.fillTriangle(18, 42, 34, 42, 31, 16);
                g.fillStyle(0x6a4a2a, 1);
                g.fillTriangle(12, 42, 18, 42, 20, 16);
                // Брёвна
                g.lineStyle(1, 0x5a3a20, 0.8);
                for (let i = 0; i < 4; i++) {
                    g.lineBetween(13 + i * 1.5, 38 - i * 6, 39 - i * 1.5, 38 - i * 6);
                }
                // Дверь
                g.fillStyle(0x3a2417, 1);
                g.fillRect(23, 32, 8, 10);
                // Шатровая крыша (тёс)
                g.fillStyle(0x4a3a25, 1);
                g.fillTriangle(10, 15, 42, 15, 26, 2);
                g.fillStyle(0x5a4830, 1);
                g.fillTriangle(12, 14, 40, 14, 26, 4);
                // Ось крыльев (ступица)
                g.fillStyle(0x2a1a0e, 1);
                g.fillCircle(26, 13, 2.5);
                g.generateTexture('icon_windmill_tower', 52, 46);
                g.destroy();
            }
            if (!this.textures.exists('icon_windmill_blades')) {
                const b = this.make.graphics({ x: 0, y: 0, add: false });
                b.lineStyle(2, 0x3a2a18, 1);
                b.lineBetween(26, 26, 26, 2);   // вверх
                b.lineBetween(26, 26, 50, 26);  // вправо
                b.lineBetween(26, 26, 26, 50);  // вниз
                b.lineBetween(26, 26, 2, 26);   // влево
                b.fillStyle(0xd8cfae, 0.95);    // парусины (треугольные крылья)
                b.fillTriangle(26, 2, 26, 13, 37, 12);
                b.fillTriangle(50, 26, 39, 26, 40, 37);
                b.fillTriangle(26, 50, 26, 39, 15, 40);
                b.fillTriangle(2, 26, 13, 26, 12, 15);
                b.generateTexture('icon_windmill_blades', 52, 52);
                b.destroy();
            }
        } catch (e) { console.warn('windmill icon:', e); }

        // ----- Создаём walk-анимации для каждого персонажа -----
        this.addThiefFace();                 // раунд 37 (п.3): лицо вора ДО анимаций
        this.createWalkAnimations('player');
        this.createWalkAnimations('npc_elder');
        this.createWalkAnimations('npc_merchant');
        this.createWalkAnimations('npc_soldier');
        this.createWalkAnimations('npc_bandit');
        this.createWalkAnimations('enemy_bandit');
        this.createWalkAnimations('enemy_thief');   // раунд 33: фигурка вора
        this.createWalkAnimations('enemy_wolf');
        // Раунд 50: воры (м/ж) и герои Medieval — те же листы 4×4 @64px
        ['enemy_thief_m', 'enemy_thief_f', 'hero_baenor', 'hero_paul', 'hero_huntress', 'hero_naia']
            .forEach(key => this.createWalkAnimations(key));

        // ----- Анимации Fantasy Knight (для CombatScene) -----
        this.createKnightAnimations('knight');
        this.createKnightAnimations('knight', '_c2');

        // ----- Анимации LPC Wolf (combat sheet) -----
        this.createWolfAnimations();

        // ----- Анимация «кипящего» роя пчёл (раунд 17: ТОЛЬКО антураж пасеки —
        // кадровый спрайт-мерцание над ульями; врагов из пчёл больше нет) -----
        if (this.textures.exists('bees_combat_0')) {
            this.anims.create({
                key: 'bees_idle',
                frames: [
                    { key: 'bees_combat_0', frame: 0 },
                    { key: 'bees_combat_1', frame: 0 },
                    { key: 'bees_combat_2', frame: 0 },
                    { key: 'bees_combat_1', frame: 0 },
                ],
                frameRate: 9,
                repeat: -1,
            });
        }

        // ----- Анимации LPC Farm Animals -----
        const animals = ['cow', 'llama', 'pig', 'sheep', 'chicken'];
        animals.forEach((a) => this.createAnimalAnimations(a));

        // Создаём персонажа и квест, если их ещё нет в реестре
        if (!this.registry.get('player')) {
            this.registry.set('player', createCharacter('Путник'));
        }
        if (!this.registry.get('quest')) {
            this.registry.set('quest', {
                elderTalked: false,
                merchantTalked: false,
                soldierTalked: false,
                banditDefeated: false,
                hasHerb: false,
                tutorialStep: 0,
                currentObjective: 'Поговори со старейшиной',
                // chestsOpened — ИСТОРИЧЕСКОЕ имя ключа дневных действий
                // (рыбалка и т.п.; data/daily.js). Имя не менять — совместимость сейвов.
                chestsOpened: [],
                hoursPassed: 0,
            });
        }

        this.scene.start('Title');
    }

    /**
     * Процедурные текстуры декора (раунд 11): полевые цветы 3 цветов и
     * травяные кочки. Рисуются graphics-ом один раз при загрузке — никаких
     * лишних сетевых запросов.
     * Раунд 66.10 (приказ владельца): текстуры сундуков (chest_closed/open)
     * удалены — сундуки/тайники вырезаны из игры.
     */
    createDecoTextures() {
        const g = this.make.graphics({ add: false });

        // ===== Полевые цветы (10×12): стебель + лепестки вокруг серединки =====
        const flowerColors = [
            { petal: 0xf2f2e8, petal2: 0xd8d8c8, core: 0xd9a521 },   // 0 — ромашка
            { petal: 0xc94f3d, petal2: 0xa63a2c, core: 0x2a2a2a },   // 1 — мак
            { petal: 0xe8c84a, petal2: 0xc9a521, core: 0x8a6a10 },   // 2 — лютик
        ];
        flowerColors.forEach((c, i) => {
            g.clear();
            g.fillStyle(0x3f6b2f, 1); g.fillRect(4, 7, 2, 5);          // стебель
            g.fillStyle(0x4d7d3a, 1); g.fillRect(2, 9, 2, 1);          // листик слева
            g.fillStyle(0x4d7d3a, 1); g.fillRect(6, 8, 2, 1);          // листик справа
            g.fillStyle(c.petal, 1);
            g.fillRect(3, 1, 4, 4);                                     // шапка лепестков
            g.fillRect(2, 2, 6, 2);
            g.fillStyle(c.petal2, 1);
            g.fillRect(3, 4, 4, 1);                                     // тень лепестков
            g.fillStyle(c.core, 1);
            g.fillRect(4, 2, 2, 2);                                     // серединка
            g.generateTexture(`deco_flower_${i}`, 10, 12);
        });

        // ===== Травяная кочка (14×8): пучок тёмных травинок =====
        g.clear();
        g.fillStyle(0x2f5a24, 1);
        g.fillRect(1, 5, 2, 3); g.fillRect(4, 3, 2, 5); g.fillRect(7, 4, 2, 4);
        g.fillRect(10, 2, 2, 6); g.fillRect(6, 6, 4, 2);
        g.fillStyle(0x3f6b2f, 1);
        g.fillRect(2, 6, 2, 2); g.fillRect(5, 4, 2, 4); g.fillRect(11, 3, 2, 5);
        g.generateTexture('deco_grass_tuft', 14, 8);

        // ===== Раунд 15: снежная наметь (26×10) — зимняя стилизация травы =====
        g.clear();
        g.fillStyle(0xf0f4fa, 0.95);
        g.fillEllipse(13, 6, 26, 9);
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(10, 5, 14, 6);
        g.fillEllipse(19, 6, 8, 4);
        g.fillStyle(0xdce8f4, 0.9);
        g.fillEllipse(13, 9, 22, 3);
        g.generateTexture('deco_snow_patch', 26, 12);

        // ===== Раунд 16: воробей (9×7) — стайки на дорогах деревни =====
        g.clear();
        g.fillStyle(0x6a4a32, 1); g.fillEllipse(5, 4, 7, 5);            // тело
        g.fillStyle(0x7d5a3e, 1); g.fillEllipse(4, 3, 5, 3);            // спинка-блик
        g.fillStyle(0x4a3220, 1); g.fillCircle(8, 3, 1.6);              // голова
        g.fillStyle(0x2a1a10, 1); g.fillCircle(8.6, 2.6, 0.5);          // глаз
        g.fillStyle(0x8a6a2a, 1); g.fillRect(9.4, 3, 1.6, 0.8);         // клюв
        g.fillStyle(0x3a2818, 1); g.fillTriangle(1, 3, 0, 5, 2.4, 4.2); // хвост
        g.generateTexture('deco_bird', 11, 8);

        // ===== Раунд 30: отпечаток сапога (11×15) — след вора на локациях =====
        // Подошва + каблук, тёмно-грязный с влажным ободком; правый рисуется
        // тем же спрайтом с setFlipX(true). Следы ставит LocationScene.
        g.clear();
        g.fillStyle(0x241a10, 0.35);                                    // влажный ободок
        g.fillEllipse(5.5, 5.5, 9.5, 12.5);
        g.fillEllipse(5.5, 12, 7, 4.5);
        g.fillStyle(0x33261a, 0.95);                                    // подошва
        g.fillEllipse(5.5, 5.5, 7.5, 10.5);
        g.fillEllipse(5.5, 12, 5.2, 3.4);
        g.fillStyle(0x463423, 0.9);                                     // внутренний блик
        g.fillEllipse(5, 5, 4.6, 7);
        g.fillStyle(0x2a1f14, 0.9);                                     // протектор
        g.fillRect(3.2, 4, 4.6, 1);
        g.fillRect(3.4, 6.4, 4.2, 1);
        g.fillRect(3.9, 11.4, 3.2, 1);
        g.generateTexture('deco_footprint', 11, 15);

        // ============================================================
        // РАУНД 30: ДЕРЕВЬЯ ПЕРЕНЕСЕНЫ В ФАЙЛОВЫЕ АССЕТЫ (assets/sprites/).
        // Runtime-генерация deco_tree_*/deco_pine_* удалена — она давала
        // ПУСТЫЕ текстуры (деревья были невидимы с раунда 27).
        // ============================================================

        // ===== Улей колодный (36×46) — у дома пасечника (раунд 27, п.6) =====
        g.clear();
        g.fillStyle(0x000000, 0.22);
        g.fillEllipse(18, 43, 30, 6);                    // тень на земле
        g.fillStyle(0x4a3018, 1);
        g.fillRoundedRect(8, 14, 20, 28, 6);             // корпус-колода
        g.fillStyle(0x5a4028, 1);
        g.fillRect(10, 16, 3, 24);                       // блик слева
        g.fillStyle(0x3a2417, 1);
        g.fillRect(8, 22, 20, 2);                        // обручи
        g.fillRect(8, 32, 20, 2);
        g.fillStyle(0x6b4a2a, 1);
        g.fillTriangle(4, 15, 32, 15, 18, 3);            // двускатная крышка
        g.fillStyle(0x7d5834, 1);
        g.fillTriangle(6, 14, 30, 14, 18, 6);            // блик крышки
        g.fillStyle(0x2a1a0e, 1);
        g.fillRect(15, 36, 6, 3);                        // леток
        g.fillStyle(0xd9a521, 1);
        g.fillCircle(14, 38, 1.2);                       // пчела у летка
        g.fillCircle(22, 37, 1.2);                       // ещё пчела
        g.generateTexture('deco_beehive', 36, 46);

        // ============================================================
        // РАУНД 12: пруд, причал, костёр, крест, камыш
        // ============================================================

        // ===== Мостки причала (32×32): доски поперёк хода + гвозди =====
        g.clear();
        g.fillStyle(0x7a5a34, 1); g.fillRect(0, 0, 32, 32);            // основа
        // Доски (горизонтальные плашки с зазорами и волокнами)
        for (let i = 0; i < 4; i++) {
            const yy = i * 8;
            g.fillStyle(0x8a6a40, 1); g.fillRect(0, yy, 32, 7);
            g.fillStyle(0x9a7a4c, 1); g.fillRect(0, yy, 32, 1);        // блик сверху
            g.fillStyle(0x6a4a2a, 1); g.fillRect(0, yy + 6, 32, 1);    // тень снизу
            g.fillStyle(0x6a4a2a, 1);                                   // трещины волокон
            g.fillRect(6 + (i * 7) % 12, yy + 2, 5, 1);
            g.fillRect(20 - (i * 5) % 10, yy + 4, 4, 1);
        }
        // Кованые гвозди по краям досок
        g.fillStyle(0x3d3d3d, 1);
        g.fillRect(2, 3, 1, 1); g.fillRect(29, 3, 1, 1);
        g.fillRect(2, 19, 1, 1); g.fillRect(29, 19, 1, 1);
        g.generateTexture('tile_pier', 32, 32);

        // ===== Костёр — основание (32×22): каменное кольцо + поленья =====
        g.clear();
        // Каменное кольцо (сером-бурые камни по кругу)
        const stoneCol = [0x8a8078, 0x7a7068, 0x968c82];
        const stones = [[2, 12], [6, 16], [12, 18], [19, 17], [25, 14], [27, 9], [22, 4], [15, 2], [8, 4], [4, 8]];
        stones.forEach(([sx, sy], i) => {
            g.fillStyle(stoneCol[i % 3], 1);
            g.fillRect(sx, sy, 5, 4);
            g.fillStyle(0xa89e92, 1);
            g.fillRect(sx, sy, 5, 1);                                   // блик
        });
        // Поленья крест-накрест (тёмный дуб, обугленные концы)
        g.fillStyle(0x4a3018, 1); g.fillRect(8, 10, 16, 4);            // полено 1
        g.fillStyle(0x2a1a0e, 1); g.fillRect(8, 10, 4, 4);             // обугленный левый конец
        g.fillStyle(0x5a4028, 1); g.fillRect(10, 11, 12, 1);           // волокно
        g.fillStyle(0x4a3018, 1); g.fillRect(11, 13, 14, 4);           // полено 2
        g.fillStyle(0x2a1a0e, 1); g.fillRect(22, 13, 3, 4);            // обугленный правый конец
        g.fillStyle(0x5a4028, 1); g.fillRect(13, 14, 10, 1);           // волокно
        // Угли между поленьями (тлеющие)
        g.fillStyle(0xd95f2a, 1); g.fillRect(13, 11, 3, 2);
        g.fillStyle(0xe87a3a, 1); g.fillRect(17, 12, 2, 1);
        g.generateTexture('campfire_base', 32, 22);

        // ===== Костёр — 3 кадра пламени (20×26), рисуются поверх основания =====
        const flameFrames = [
            // Кадр 0: язык пламени влево
            { inner: [8, 10, 4, 12], mid: [6, 4, 8, 18], outer: [4, 0, 12, 22] },
            // Кадр 1: пламя вверх (пик)
            { inner: [8, 12, 4, 10], mid: [7, 6, 6, 16], outer: [5, 0, 10, 22] },
            // Кадр 2: язык пламени вправо
            { inner: [8, 10, 4, 12], mid: [7, 4, 7, 18], outer: [5, 0, 11, 22] },
        ];
        flameFrames.forEach((f, i) => {
            g.clear();
            // Внешний слой — тёмно-оранжевый
            g.fillStyle(0xd95f2a, 1);
            g.fillRect(f.outer[0], f.outer[1], f.outer[2], f.outer[3]);
            // Средний — ярко-оранжевый (уже)
            g.fillStyle(0xf08a2a, 1);
            g.fillRect(f.mid[0], f.mid[1], f.mid[2], f.mid[3]);
            // Внутренний — жёлтое ядро
            g.fillStyle(0xf8c84a, 1);
            g.fillRect(f.inner[0], f.inner[1], f.inner[2], f.inner[3]);
            // Белая сердцевина у основания
            g.fillStyle(0xfff0c0, 1);
            g.fillRect(8, 18, 4, 4);
            g.generateTexture(`campfire_flame_${i}`, 20, 26);
        });

        // ===== Каменный крест (22×34): замшелый валун-крест с резьбой =====
        g.clear();
        // Основание-подножие
        g.fillStyle(0x6a6a60, 1); g.fillRect(3, 29, 16, 5);
        g.fillStyle(0x7a7a70, 1); g.fillRect(3, 29, 16, 1);
        // Столб
        g.fillStyle(0x8a8a80, 1); g.fillRect(8, 8, 6, 22);
        g.fillStyle(0x9a9a90, 1); g.fillRect(8, 8, 2, 22);             // блик слева
        g.fillStyle(0x6a6a60, 1); g.fillRect(12, 8, 2, 22);            // тень справа
        // Перекладина (верхняя короткая и средняя — православный стиль)
        g.fillStyle(0x8a8a80, 1); g.fillRect(3, 4, 16, 5);
        g.fillStyle(0x9a9a90, 1); g.fillRect(3, 4, 16, 1);
        g.fillStyle(0x6a6a60, 1); g.fillRect(3, 7, 16, 2);
        g.fillStyle(0x8a8a80, 1); g.fillRect(5, 11, 12, 4);            // вторая перекладина
        g.fillStyle(0x9a9a90, 1); g.fillRect(5, 11, 12, 1);
        // Резьба-зарубки на столбе
        g.fillStyle(0x5a5a50, 1);
        g.fillRect(10, 17, 2, 1); g.fillRect(10, 20, 2, 1); g.fillRect(10, 23, 2, 1);
        // Мох у подножия и на плече перекладины
        g.fillStyle(0x4d7d3a, 1);
        g.fillRect(2, 31, 4, 2); g.fillRect(16, 30, 4, 3); g.fillRect(4, 4, 3, 2);
        g.fillStyle(0x3f6b2f, 1);
        g.fillRect(17, 32, 2, 1); g.fillRect(3, 32, 2, 1);
        // Трещина
        g.fillStyle(0x5a5a50, 1); g.fillRect(9, 13, 1, 4);
        g.generateTexture('deco_cross', 22, 34);

        // ===== Камыш (16×30): три стебля с рогозовыми шишками =====
        g.clear();
        // Стебель 1 (прямой, с шишкой)
        g.fillStyle(0x4d6b2f, 1); g.fillRect(4, 8, 2, 22);
        g.fillStyle(0x6a4a2a, 1); g.fillRect(3, 2, 4, 7);              // шишка рогоза
        g.fillStyle(0x7d5834, 1); g.fillRect(3, 2, 4, 1);
        // Стебель 2 (наклонён вправо — рисуем сегментами)
        g.fillStyle(0x5d7d3a, 1);
        g.fillRect(8, 24, 2, 6); g.fillRect(9, 18, 2, 7); g.fillRect(11, 14, 2, 5);
        g.fillRect(13, 11, 2, 4);
        g.fillStyle(0x7d9d4a, 1); g.fillRect(13, 11, 1, 4);            // блик
        // Стебель 3 (короткий, без шишки)
        g.fillStyle(0x4d6b2f, 1); g.fillRect(2, 16, 2, 14);
        // Метёлка наверху стебля 2
        g.fillStyle(0xc9b06a, 1); g.fillRect(14, 8, 1, 3);
        g.generateTexture('deco_reed', 16, 30);

        // ===== Лист кувшинки (16×10): зелёный диск с вырезом над водой =====
        g.clear();
        g.fillStyle(0x3f7d3a, 1); g.fillEllipse(8, 6, 16, 9);
        g.fillStyle(0x4d8d44, 1); g.fillEllipse(7, 5, 10, 5);          // внутренний блик
        g.fillStyle(0x2a5a2a, 1); g.fillRect(8, 2, 1, 4);              // вырез к центру
        g.generateTexture('deco_lilypad', 16, 10);

        g.destroy();
    }

    /**
     * Процедурные текстуры Тёмного леса (раунд 13): грибы, куст ягод,
     * зверобой, поваленный ствол, клочья тумана.
     * (раунд 66.11: текстура схрона под корягой удалена вместе с фичей)
     * Всё рисуется кодом — ноль сетевых запросов.
     */
    createForestTextures() {
        const g = this.add.graphics();

        // ===== Грибы (18×14): три грибка на подстилке из хвои =====
        g.clear();
        g.fillStyle(0x4a5a2a, 0.6); g.fillEllipse(9, 12, 16, 4);       // подстилка
        // Большой гриб
        g.fillStyle(0xE8DCC4, 1); g.fillRect(7, 7, 3, 5);              // ножка
        g.fillStyle(0xB53925, 1); g.fillEllipse(8.5, 7, 10, 6);        // шляпка
        g.fillStyle(0xD85B45, 1); g.fillEllipse(7.5, 6, 6, 3);         // блик
        g.fillStyle(0xF2E8D0, 1); g.fillCircle(6, 6, 1); g.fillCircle(11, 7, 1); // пятна
        // Маленький гриб слева
        g.fillStyle(0xE8DCC4, 1); g.fillRect(2, 9, 2, 3);
        g.fillStyle(0x9a3a2a, 1); g.fillEllipse(3, 9, 6, 4);
        g.generateTexture('deco_mushroom', 18, 14);

        // ===== Куст ягод (26×22): тёмная зелень + грозди красных ягод =====
        g.clear();
        g.fillStyle(0x2a4a1e, 1); g.fillEllipse(13, 14, 24, 15);       // крона
        g.fillStyle(0x3a5a28, 1); g.fillEllipse(10, 11, 14, 9);        // блик
        g.fillStyle(0x1e3816, 1); g.fillEllipse(17, 18, 12, 6);        // тень низа
        // Ягоды — грозди по 3
        const berrySpots = [[7, 12], [9, 15], [6, 16], [13, 10], [15, 13], [12, 16], [19, 11], [21, 14], [18, 16]];
        berrySpots.forEach(([bx, by], i) => {
            g.fillStyle(0x8a1a2a, 1); g.fillCircle(bx, by, 2.2);       // тень ягоды
            g.fillStyle(i % 3 === 0 ? 0xC94060 : 0xB03050, 1); g.fillCircle(bx - 0.5, by - 0.5, 1.8);
            g.fillStyle(0xE88AA0, 1); g.fillCircle(bx - 1, by - 1, 0.7); // блик
        });
        g.generateTexture('deco_berry_bush', 26, 22);

        // ===== Зверобой (16×18): пучок стеблей с жёлтыми цветками =====
        g.clear();
        g.fillStyle(0x4a6a2a, 1); g.fillRect(7, 6, 2, 11);             // главный стебель
        g.fillStyle(0x5a7a35, 1); g.fillRect(4, 9, 3, 2); g.fillRect(9, 11, 3, 2); // листья
        g.fillRect(3, 13, 3, 2); g.fillRect(10, 14, 3, 2);
        // Цветки (звёзды из 5 точек)
        g.fillStyle(0xF2C940, 1);
        g.fillCircle(8, 4, 1.6); g.fillCircle(5, 7, 1.3); g.fillCircle(11, 8, 1.3);
        g.fillStyle(0xF7E080, 1);
        g.fillCircle(8, 4, 0.8); g.fillCircle(5, 7, 0.6);
        g.generateTexture('deco_herb', 16, 18);

        // ===== Поваленный ствол (44×16): лежачее бревно с мхом =====
        g.clear();
        g.fillStyle(0x4a3826, 1); g.fillRoundedRect(0, 4, 44, 10, 4);  // тело бревна
        g.fillStyle(0x5a4830, 1); g.fillRoundedRect(2, 5, 40, 4, 2);   // блик сверху
        g.fillStyle(0x33261a, 1); g.fillRoundedRect(0, 10, 44, 4, 2);  // тень низа
        g.fillStyle(0x3a2a1a, 1); g.fillEllipse(2, 9, 5, 9);           // срез слева
        g.fillStyle(0x6a5232, 1); g.fillEllipse(2, 9, 3, 6);           // годовые кольца
        // Мох
        g.fillStyle(0x3f6a2e, 1);
        g.fillEllipse(12, 5, 8, 4); g.fillEllipse(28, 5, 10, 4); g.fillEllipse(38, 6, 6, 3);
        g.generateTexture('deco_log', 44, 16);

        // ===== Клок тумана (128×128): мягкий радиальный диск =====
        g.clear();
        for (let i = 10; i >= 1; i--) {
            const a = 0.028 * (11 - i) / 10;
            g.fillStyle(0xdfe8d8, a);
            g.fillCircle(64, 64, i * 6.2);
        }
        g.generateTexture('fog_puff', 128, 128);

        // ===== Плавающий листок (10×8): для падающей листвы =====
        g.clear();
        g.fillStyle(0x9a7b3f, 1); g.fillEllipse(5, 4, 10, 6);
        g.fillStyle(0x7d5f2a, 1); g.fillRect(0, 4, 10, 1);             // прожилка
        g.generateTexture('forest_leaf', 10, 8);

        // ===== Раунд 28 (п.6): штрих течения реки (32×5) — плывёт слева направо =====
        g.clear();
        g.fillStyle(0xd8ecf8, 0.75); g.fillEllipse(16, 2.5, 30, 3.2);
        g.fillStyle(0xffffff, 0.55); g.fillEllipse(13, 2.2, 14, 1.8);
        g.generateTexture('river_streak', 32, 5);

        // ===== Погода (раунд 14): капля дождя 2×14 и снежинка 5×5 =====
        g.clear();
        g.fillStyle(0xbfd8ff, 0.85); g.fillRect(0, 0, 2, 12);          // тело капли
        g.fillStyle(0xffffff, 0.45); g.fillRect(0, 0, 1, 7);           // светлый край
        g.generateTexture('weather_rain', 2, 14);

        g.clear();
        g.fillStyle(0xffffff, 0.95); g.fillCircle(2.5, 2.5, 1.6);      // ядро
        g.fillStyle(0xffffff, 0.4);  g.fillCircle(2.5, 2.5, 2.4);      // ореол
        g.generateTexture('weather_snow', 5, 5);

        g.destroy();
    }

    /**
     * Процедурные текстуры Пасеки (раунд 16): колодный улей, пчела-декорация,
     * дымокур и три кадра боевого роя пчёл для CombatScene.
     */
    createApiaryTextures() {
        const g = this.make.graphics({ add: false });

        // ===== Колодный улей (26×34): бревно-дуплянка с плашкой-крышкой и летком =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(13, 31, 24, 6);      // тень на земле
        g.fillStyle(0x4a3520, 1); g.fillRoundedRect(5, 8, 16, 22, 3);   // корпус бревна
        g.fillStyle(0x5f4830, 1); g.fillRoundedRect(7, 9, 5, 19, 2);    // блик-полоса слева
        g.fillStyle(0x33261a, 1); g.fillRoundedRect(16, 10, 4, 18, 2);  // тень справа
        g.fillStyle(0x3a2a1a, 1); g.fillEllipse(13, 8, 18, 5);          // верхний срез
        g.fillStyle(0x6a5232, 1); g.fillEllipse(13, 8, 12, 3);          // годовые кольца
        // Крышка-плашка (дощечка сверху от дождя)
        g.fillStyle(0x5a4030, 1); g.fillRoundedRect(2, 2, 22, 6, 2);
        g.fillStyle(0x6f5236, 1); g.fillRoundedRect(3, 3, 20, 2, 1);
        // Леток (тёмная щель, из неё пчёлы)
        g.fillStyle(0x1a1008, 1); g.fillEllipse(13, 20, 4, 6);
        // Полоска мёда-прополиса у летка
        g.fillStyle(0xd8912a, 0.85); g.fillRect(11, 24, 4, 2);
        g.generateTexture('deco_hive', 26, 34);

        // ===== Пчела (7×6): тельце с полоской и крылышки =====
        g.clear();
        g.fillStyle(0xffffff, 0.55); g.fillEllipse(2, 2, 5, 3);         // крыло верхнее
        g.fillStyle(0xffffff, 0.4);  g.fillEllipse(5, 2, 4, 3);         // крыло заднее
        g.fillStyle(0xd8a020, 1); g.fillEllipse(3.5, 4, 5, 3);          // тельце
        g.fillStyle(0x2a1a08, 1); g.fillRect(3, 3, 1, 3);               // полоска
        g.fillStyle(0x2a1a08, 1); g.fillCircle(1.5, 4, 1);              // голова
        g.generateTexture('deco_bee', 7, 6);

        // ===== Дымокур (30×18): кучка тлеющих веток и влажного дёрна =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(15, 15, 28, 6);
        g.fillStyle(0x3f5a2e, 1); g.fillEllipse(9, 12, 12, 7);          // пласт дёрна травой вверх
        g.fillStyle(0x4f7038, 1); g.fillEllipse(8, 10, 10, 5);
        g.fillStyle(0x4a3826, 1); g.fillRoundedRect(14, 8, 14, 6, 3);   // ветки
        g.fillStyle(0x2e2118, 1); g.fillRoundedRect(16, 10, 10, 2, 1);  // тень между ветками
        g.fillStyle(0xff7a30, 0.8); g.fillCircle(20, 11, 2);            // угли
        g.fillStyle(0xffc060, 0.9); g.fillCircle(20, 11, 1);
        g.generateTexture('deco_smudge', 30, 18);

        // ===== Боевой рой пчёл — 3 кадра 44×36 для CombatScene =====
        // Каждая точка — пчела; кадры отличаются раскладкой, анимация «кипит».
        const swarmDots = [
            // [x, y, r] — фиксированные раскладки (без Math.random — детерминизм)
            [[10,14,3],[17,9,2.5],[24,16,3],[14,22,2.5],[30,10,2],[27,24,3],[20,18,2],[33,18,2.5],[7,22,2],[24,30,2.5],[36,26,2],[13,30,2]],
            [[13,10,3],[20,15,2.5],[26,11,3],[10,18,2.5],[29,19,3],[23,26,2],[33,13,2],[17,27,2.5],[8,13,2],[28,30,2.5],[36,20,2],[19,21,2]],
            [[11,17,3],[18,12,2.5],[23,20,3],[15,9,2.5],[31,15,2],[26,27,3],[21,13,2],[35,23,2.5],[9,25,2],[25,31,2.5],[34,28,2],[16,24,2]],
        ];
        for (let f = 0; f < swarmDots.length; f++) {
            g.clear();
            // Размытое облако-подложка
            for (let i = 6; i >= 1; i--) {
                g.fillStyle(0x3a2c10, 0.035 * (7 - i) / 6);
                g.fillEllipse(22, 19, i * 9, i * 7);
            }
            swarmDots[f].forEach(([x, y, r], i) => {
                // Тельце с полосатым брюшком, каждое с лёгким «крылом»
                g.fillStyle(0xffffff, 0.5); g.fillEllipse(x - 1, y - r - 1, r * 1.6, r * 0.9);
                g.fillStyle(0xd8a020, 1); g.fillEllipse(x, y, r * 2, r * 1.5);
                g.fillStyle(0x2a1a08, 1); g.fillRect(x, y - r * 0.6, Math.max(1, r * 0.4), r * 1.2);
                if (i % 3 === 0) {
                    g.fillStyle(0x2a1a08, 1); g.fillCircle(x - r * 0.8, y, Math.max(0.8, r * 0.45));
                }
            });
            g.generateTexture(`bees_combat_${f}`, 44, 36);
        }

        g.destroy();
    }

    /**
     * Процедурные текстуры хозяйственных построек (раунд 17, §3
     * village-visual-upgrade): амбар (собственный облик вместо таверны),
     * рига-сеновал, стог сена, поленница дров и телега.
     * Все детерминированы (без Math.random) — как остальные процедурные.
     */
    createVillageYardTextures() {
        const g = this.make.graphics({ add: false });

        // ===== АМБАР (96×80): широкий сруб с воротами и сеновалом-окном =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(48, 76, 88, 8);      // тень
        // Сруб
        g.fillStyle(0x5a4028, 1); g.fillRoundedRect(6, 30, 84, 46, 3);
        // Горизонтальные брёвна
        for (let ly = 36; ly < 74; ly += 8) {
            g.fillStyle(0x6a4c30, 1); g.fillRect(8, ly, 80, 2);
            g.fillStyle(0x46301c, 1); g.fillRect(8, ly + 4, 80, 1);
        }
        // Торцы брёвен по углам
        [10, 86].forEach(cx2 => {
            g.fillStyle(0x7a5a3a, 1); g.fillCircle(cx2, 34, 3); g.fillCircle(cx2, 70, 3);
        });
        // Двойные ворота
        g.fillStyle(0x3a2816, 1); g.fillRect(30, 44, 36, 32);
        g.fillStyle(0x584026, 1); g.fillRect(32, 46, 15, 30); g.fillRect(49, 46, 15, 30);
        g.lineStyle(2, 0x2e2013, 1);
        g.lineBetween(32, 52, 47, 46 + 24); g.lineBetween(64, 46, 49, 46 + 24);
        g.lineBetween(32, 46 + 24, 47, 52); g.lineBetween(64, 52, 49, 46 + 24);
        // Скоба-запор
        g.fillStyle(0x2e2013, 1); g.fillRect(46, 58, 4, 6);
        // Сеновал-окно над воротами (сено торчит)
        g.fillStyle(0x2e2013, 1); g.fillRect(38, 32, 20, 10);
        g.fillStyle(0xc8a838, 1); g.fillRect(40, 34, 16, 6);
        g.fillStyle(0xe0c050, 1); g.fillRect(40, 34, 16, 2);
        // Крыша-самцовая (широкий фронтон)
        g.fillStyle(0x4a3520, 1); g.fillPoints([
            { x: 0, y: 30 }, { x: 96, y: 30 }, { x: 48, y: 4 },
        ], true);
        g.fillStyle(0x5f4630, 1); g.fillPoints([
            { x: 6, y: 30 }, { x: 90, y: 30 }, { x: 48, y: 8 },
        ], true);
        // Дранка на крыше
        for (let i = 0; i < 5; i++) {
            const yy = 26 - i * 4;
            const half = 44 - i * 8;
            g.fillStyle(0x3a2818, 1);
            g.fillRect(48 - half, yy, half * 2, 1);
        }
        g.generateTexture('deco_barn', 96, 80);

        // ===== РИГА-СЕНАЛ (112×72): низкая широкая, открытый закром с сеном =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(56, 68, 104, 8);     // тень
        // Левая половина — открытый закром с сеном
        g.fillStyle(0x46301c, 1); g.fillRect(6, 32, 48, 34);
        g.fillStyle(0x2e2013, 1); g.fillRect(9, 35, 42, 28);            // проём
        g.fillStyle(0xc8a838, 1);                                       // сено внутри
        g.fillEllipse(20, 52, 22, 16); g.fillEllipse(36, 54, 20, 14);
        g.fillStyle(0xe0c050, 1);
        g.fillEllipse(22, 48, 12, 6); g.fillEllipse(34, 50, 10, 5);
        // Правая половина — глухая стена из брёвен
        g.fillStyle(0x5a4028, 1); g.fillRect(54, 32, 52, 34);
        for (let ly = 37; ly < 65; ly += 8) {
            g.fillStyle(0x6a4c30, 1); g.fillRect(56, ly, 48, 2);
            g.fillStyle(0x46301c, 1); g.fillRect(56, ly + 4, 48, 1);
        }
        // Сено, просыпавшееся у закрома
        g.fillStyle(0xc8a838, 1);
        g.fillEllipse(16, 64, 26, 6); g.fillEllipse(34, 65, 16, 4);
        // Кровля-навес на всю ширину (слегка провисшая)
        g.fillStyle(0x4a3520, 1); g.fillPoints([
            { x: 0, y: 34 }, { x: 112, y: 34 }, { x: 100, y: 8 }, { x: 12, y: 8 },
        ], true);
        g.fillStyle(0x5f4630, 1); g.fillPoints([
            { x: 5, y: 31 }, { x: 107, y: 31 }, { x: 97, y: 11 }, { x: 15, y: 11 },
        ], true);
        for (let i = 0; i < 5; i++) {                                    // дранка
            g.fillStyle(0x3a2818, 1);
            g.fillRect(16 + i * 1, 28 - i * 3.4, 82 - i * 2, 1);
        }
        // Гнёзда-ласточки под свесом (живая деталь)
        g.fillStyle(0x2e2013, 1);
        g.fillCircle(24, 36, 3); g.fillCircle(88, 36, 2.6);
        g.generateTexture('deco_riga', 112, 72);

        // РАУНД 66.10 (приказ владельца): генераторы «БАНЯ ПО-БЕЛОМУ» и «ОВИН»
        // (§3.1 раунда 20) удалены — постройки сняты с бэклога и вырезаны
        // насовсем; текстуры deco_banya/deco_ovin больше не создаются.

        // ===== СТОГ СЕНА (36×28): округлый, с «расчёской»-штрихами =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(18, 25, 32, 6);
        g.fillStyle(0xa8902e, 1); g.fillEllipse(18, 16, 30, 18);        // тело
        g.fillStyle(0xc8a838, 1); g.fillEllipse(18, 14, 26, 14);        // светлый верх
        g.fillStyle(0xb89a32, 1); g.fillTriangle(18, 2, 10, 12, 26, 12); // верхушка
        for (let i = 0; i < 7; i++) {                                    // штрихи-грабли
            const sx = 6 + i * 4;
            g.fillStyle(0x8f7824, 1);
            g.fillRect(sx, 8 + (i % 3) * 3, 1, 12 - (i % 3) * 2);
        }
        g.generateTexture('deco_haystack', 36, 28);

        // ===== ПОЛЕННИЦА (36×20): два ряда брёвен торцами наружу =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(18, 18, 34, 5);
        g.fillStyle(0x2e2013, 1); g.fillRect(2, 4, 32, 12);              // общая масса
        // Нижний ряд торцов
        for (let i = 0; i < 4; i++) {
            const cx2 = 6 + i * 8;
            g.fillStyle(0x8a6a42, 1); g.fillCircle(cx2, 12, 4);
            g.fillStyle(0x6a4c2c, 1); g.fillCircle(cx2, 12, 2.2);
            g.fillStyle(0xa8885a, 1); g.fillCircle(cx2 - 1, 11, 1);
        }
        // Верхний ряд (3 бревна)
        for (let i = 0; i < 3; i++) {
            const cx2 = 10 + i * 8;
            g.fillStyle(0x8a6a42, 1); g.fillCircle(cx2, 6, 3.6);
            g.fillStyle(0x6a4c2c, 1); g.fillCircle(cx2, 6, 2);
            g.fillStyle(0xa8885a, 1); g.fillCircle(cx2 - 1, 5, 0.9);
        }
        g.generateTexture('deco_firewood', 36, 20);

        // ===== ТЕЛЕГА (48×30): кузов с сеном, два колеса, оглобля =====
        g.clear();
        g.fillStyle(0x000000, 0.25); g.fillEllipse(24, 27, 44, 6);
        // Оглобля (вправо)
        g.fillStyle(0x4a3826, 1); g.fillRect(30, 12, 16, 3);
        // Кузов
        g.fillStyle(0x5a4028, 1); g.fillRect(4, 8, 34, 10);
        g.fillStyle(0x46301c, 1); g.fillRect(4, 8, 34, 2);
        for (let sx2 = 8; sx2 < 36; sx2 += 6) {                          // доски
            g.fillStyle(0x6a4c30, 1); g.fillRect(sx2, 10, 1, 7);
        }
        // Сено в кузове
        g.fillStyle(0xc8a838, 1);
        g.fillEllipse(14, 7, 16, 8); g.fillEllipse(26, 8, 12, 7);
        g.fillStyle(0xe0c050, 1); g.fillEllipse(15, 5, 8, 4);
        // Колёса со спицами
        [10, 34].forEach(wx2 => {
            g.fillStyle(0x2e2013, 1); g.fillCircle(wx2, 20, 6.5);
            g.fillStyle(0x584026, 1); g.fillCircle(wx2, 20, 4.5);
            g.lineStyle(1, 0x2e2013, 1);
            g.lineBetween(wx2 - 4, 20, wx2 + 4, 20);
            g.lineBetween(wx2, 16, wx2, 24);
            g.fillStyle(0x2e2013, 1); g.fillCircle(wx2, 20, 1.6);
        });
        g.generateTexture('deco_cart', 48, 30);

        g.destroy();
    }

    /**
     * РАУНД 63 (пп.3,4,5 приказа владельца): ВОРОТНЯ ПЯТОГО ПОКОЛЕНИЯ.
     * Приказ: «СДЕЛАЙ ПОМЕНЬШЕ ПРИВРАТНЫЕ БАШНИ», «ПОВЕРНИ ИХ НА 90°»,
     * «ДОМ САПОЖНИКА И ЛАВКА ПЕРЕКРЫТЫ ТЕКСТУРОЙ БАШНИ ВОРОТ».
     * Диагноз r61: башни-исполины (по 5 тайлов) с кровлями-щипцами,
     * повёрнутыми поперёк улицы (выглядели домами «боком»), и вся воротня
     * накрывала лавку и избу сапожника. Теперь:
     *  - башни МАЛЫЕ — сторожевые будки ~1×1 тайла над/под дорогой;
     *  - кровли КАК У ВСЕХ ДОМОВ ДЕРЕВНИ: конёк ВДОЛЬ улицы (запад-восток),
     *    передний скат — трапецией («поворот на 90°» против прежних щипцов);
     *  - вся воротня — узкая полоса ровно в колонке ворот (48×300):
     *    на запад от колонки ничего не лежит — лавке и избе сапожника
     *    больше нечем перекрываться;
     *  - створки раскрыты настежь (прижаты к башням), фонарь с тёплым
     *    светом, порог с колеями, тыновые крылья на север и юг.
     */
/**
     * Создать walk-анимации в 4 направлениях для spritesheet 4×4.
     * Структура: строки 0=down, 1=left, 2=right, 3=up; колонки 0..3 = кадры.
     */
    /**
     * Раунд 37 (п.3 заявки «у модели вора нет лица»): дорисовываем вору ЛИЦО.
     * Спрайт enemy_thief (256×256, 4×4 кадра 64px) — тёмный капюшон с чёрной
     * пустотой внутри. Поверх каждого кадра (кроме вида со спины, ряд 3)
     * рисуем бледные глаза в тени капюшона: зловещий прищур убийцы икон.
     * Вызывать ДО createWalkAnimations('enemy_thief').
     */
    addThiefFace() {
        if (!this.textures.exists('enemy_thief')) return;
        const tex = this.textures.get('enemy_thief');
        const srcImg = tex.source && tex.source[0] && tex.source[0].image;
        if (!srcImg) return;

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(srcImg, 0, 0);

        const drawEye = (cx, cy) => {
            // мягкое свечение
            ctx.fillStyle = 'rgba(210, 190, 150, 0.35)';
            ctx.fillRect(cx - 1, cy - 1, 4, 4);
            // сам глаз
            ctx.fillStyle = '#d8cba8';
            ctx.fillRect(cx, cy, 2, 3);
            // блик
            ctx.fillStyle = '#fff8e0';
            ctx.fillRect(cx, cy, 1, 1);
        };

        // Ряд 0 (лицом вниз) — глаза по центру капюшона;
        // ряд 1 (влево) / ряд 2 (вправо) — смещение по ходу взгляда;
        // ряд 3 (спина) — глаз нет.
        const rows = [
            { y: 0, eyes: [[27, 17], [35, 17]] },
            { y: 1, eyes: [[24, 17], [32, 17]] },
            { y: 2, eyes: [[29, 17], [37, 17]] },
        ];
        rows.forEach(({ y, eyes }) => {
            for (let col = 0; col < 4; col++) {
                const ox = col * 64, oy = y * 64;
                eyes.forEach(([ex, ey]) => drawEye(ox + ex, oy + ey));
            }
        });

        this.textures.remove('enemy_thief');
        this.textures.addCanvas('enemy_thief', canvas);
        // Восстанавливаем разметку кадров 4×4 по 64px
        const newTex = this.textures.get('enemy_thief');
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                try { newTex.add(`${r * 4 + c}`, 0, c * 64, r * 64, 64, 64); } catch (e) { /* есть */ }
            }
        }
    }

    createWalkAnimations(key) {
        const dirs = ['down', 'left', 'right', 'up'];
        dirs.forEach((dir, row) => {
            // Walk-анимация (3 кадра: 1, 2, 3 — пропускаем 0 = idle)
            this.anims.create({
                key: `${key}_walk_${dir}`,
                frames: this.anims.generateFrameNumbers(key, {
                    frames: [row * 4 + 1, row * 4 + 2, row * 4 + 3, row * 4 + 2]
                }),
                frameRate: 8,
                repeat: -1
            });
            // Idle — первый кадр (фиксированная стойка)
            this.anims.create({
                key: `${key}_idle_${dir}`,
                frames: [{ key, frame: row * 4 }],
                frameRate: 1,
            });
        });
    }

    /**
     * Создать анимации Fantasy Knight.
     * Каждый spritesheet — одна строка, рыцарь смотрит вправо.
     * Используется в CombatScene.
     *
     * @param {string} prefix — базовый префикс ('knight')
     * @param {string} suffix — суффикс для вариации ('' или '_c2')
     */
    createKnightAnimations(prefix, suffix = '') {
        // Текстуры: knight_idle, knight_walk, ... или knight_idle_c2, knight_walk_c2, ...
        // Анимации: knight_idle, knight_walk, ... или knight_c2_idle, knight_c2_walk, ...
        const S = suffix;
        const animSuffix = S === '_c2' ? '_c2' : '';
        const animPrefix = `${prefix}${animSuffix}`;  // 'knight' или 'knight_c2'
        const texPrefix = `${prefix}`;  // always 'knight' (texture key has _c2 suffix on each anim)

        const idleKey = `${texPrefix}_idle${S}`;       // 'knight_idle' or 'knight_idle_c2'
        const walkKey = `${texPrefix}_walk${S}`;
        const a1Key = `${texPrefix}_attack1${S}`;
        const a2Key = `${texPrefix}_attack2${S}`;
        const acKey = `${texPrefix}_attack_cmb${S}`;
        const hitKey = `${texPrefix}_hit${S}`;
        const deathKey = `${texPrefix}_death${S}`;

        // Idle — 10 кадров, frameRate 8 (дышит)
        if (this.textures.exists(idleKey)) {
            this.anims.create({
                key: `${animPrefix}_idle`,
                frames: this.anims.generateFrameNumbers(idleKey, { start: 0, end: 9 }),
                frameRate: 8, repeat: -1,
            });
        }
        // walk (бег) — 10 кадров
        if (this.textures.exists(walkKey)) {
            this.anims.create({
                key: `${animPrefix}_walk`,
                frames: this.anims.generateFrameNumbers(walkKey, { start: 0, end: 9 }),
                frameRate: 12, repeat: -1,
            });
        }
        // attack1 — 4 кадра, без повтора
        if (this.textures.exists(a1Key)) {
            this.anims.create({
                key: `${animPrefix}_attack1`,
                frames: this.anims.generateFrameNumbers(a1Key, { start: 0, end: 3 }),
                frameRate: 12, repeat: 0,
            });
        }
        // attack2 — 6 кадров
        if (this.textures.exists(a2Key)) {
            this.anims.create({
                key: `${animPrefix}_attack2`,
                frames: this.anims.generateFrameNumbers(a2Key, { start: 0, end: 5 }),
                frameRate: 14, repeat: 0,
            });
        }
        // attack combo — 10 кадров
        if (this.textures.exists(acKey)) {
            this.anims.create({
                key: `${animPrefix}_attack_cmb`,
                frames: this.anims.generateFrameNumbers(acKey, { start: 0, end: 9 }),
                frameRate: 16, repeat: 0,
            });
        }
        // hit — 1 кадр
        if (this.textures.exists(hitKey)) {
            this.anims.create({
                key: `${animPrefix}_hit`,
                frames: [{ key: hitKey, frame: 0 }],
                frameRate: 1,
            });
        }
        // death — 10 кадров
        if (this.textures.exists(deathKey)) {
            this.anims.create({
                key: `${animPrefix}_death`,
                frames: this.anims.generateFrameNumbers(deathKey, { start: 0, end: 9 }),
                frameRate: 10, repeat: 0,
            });
        }
    }

    /**
     * Создать анимации LPC Wolf (combat sheet 6×5).
     * row 0: idle (col 0), row 1: walk (cols 0-5),
     * row 2: attack (cols 0-5), row 3: hurt (col 0),
     * row 4: die (cols 0-5). Все лицом вниз.
     */
    createWolfAnimations() {
        if (!this.textures.exists('wolf_combat')) return;
        // Idle — первый кадр
        this.anims.create({
            key: 'wolf_idle',
            frames: [{ key: 'wolf_combat', frame: 0 }],
            frameRate: 1,
        });
        // Walk — row 1, 6 кадров
        this.anims.create({
            key: 'wolf_walk',
            frames: this.anims.generateFrameNumbers('wolf_combat', {
                frames: [6, 7, 8, 9, 10, 11]
            }),
            frameRate: 10, repeat: -1,
        });
        // Attack — row 2, 6 кадров
        this.anims.create({
            key: 'wolf_attack',
            frames: this.anims.generateFrameNumbers('wolf_combat', {
                frames: [12, 13, 14, 15, 16, 17]
            }),
            frameRate: 14, repeat: 0,
        });
        // Hurt — row 3, col 0
        this.anims.create({
            key: 'wolf_hurt',
            frames: [{ key: 'wolf_combat', frame: 18 }],
            frameRate: 1,
        });
        // Die — row 4, 6 кадров
        this.anims.create({
            key: 'wolf_die',
            frames: this.anims.generateFrameNumbers('wolf_combat', {
                frames: [24, 25, 26, 27, 28, 29]
            }),
            frameRate: 8, repeat: 0,
        });

        // ----- Раунд 23: БОКОВЫЕ кадры волка (wolf_full_1, правый блок) -----
        // Лист wolf_1.png 640×384 (10×6 кадров по 64). Правый блок (колонки 5-9)
        // содержит вид СБОКУ, мордой ВПРАВО: row 1 col 5 — стойка настороже,
        // row 3 cols 5-7 — рык/выпад. Для боя: игрок слева, волк справа,
        // поэтому спрайт волка флипается по X (мордой влево к игроку).
        if (this.textures.exists('wolf_full_1')) {
            // Фаза 1 ФИКС «двойного волка»: одиночный кадр стойки (row 0, col 5 = frame 5)
            this.anims.create({
                key: 'wolf_side_idle',
                frames: [{ key: 'wolf_full_1', frame: 5 }],
                frameRate: 1,
            });
            // Атака/рык — одиночные кадры (row 3, cols 5-7 = frames 35..37)
            this.anims.create({
                key: 'wolf_side_attack',
                frames: this.anims.generateFrameNumbers('wolf_full_1', {
                    frames: [35, 36, 37]
                }),
                frameRate: 9, repeat: 0,
            });
        }
    }

    /**
     * Создать walk + eat анимации для животных.
     * Walk-лист: 4 строки (down/left/right/up) × 7 колонок (6 walk + 1 idle).
     * Для chicken — упрощённый формат: 2 cols × 4 rows (1 walk + 1 idle на направление).
     */
    createAnimalAnimations(name) {
        const walkKey = `animal_${name}_walk`;
        const eatKey = `animal_${name}_eat`;
        if (!this.textures.exists(walkKey)) return;

        const tex = this.textures.get(walkKey);
        // Определяем формат по размеру источника (а не по frameTotal,
        // который включает __BASE кадр).
        const srcW = tex.source[0].width;
        const srcH = tex.source[0].height;
        const cols = srcW / 64;
        const rows = srcH / 64;
        const isCompact = (cols === 2 && rows === 4);  // chicken
        const colsPerDir = isCompact ? 2 : 7;
        const walkFrameCount = isCompact ? 1 : 6;
        const idleColIdx = isCompact ? 1 : 6;
        const dirs = ['down', 'left', 'right', 'up'];

        dirs.forEach((dir, row) => {
            // Walk frames
            const walkFrames = [];
            for (let c = 0; c < walkFrameCount; c++) {
                walkFrames.push({ key: walkKey, frame: row * colsPerDir + c });
            }
            // Для chicken (1 кадр) — дублируем, чтобы анимация не была статичной
            if (isCompact) {
                walkFrames.push(walkFrames[0]);
            }
            this.anims.create({
                key: `${walkKey}_${dir}`,
                frames: walkFrames,
                frameRate: isCompact ? 4 : 8,
                repeat: -1,
            });
            // Idle: последний кадр в ряду
            this.anims.create({
                key: `${walkKey}_idle_${dir}`,
                frames: [{ key: walkKey, frame: row * colsPerDir + idleColIdx }],
                frameRate: 1,
            });
        });

        // Eat — без направлений, простая зацикленная анимация
        if (this.textures.exists(eatKey)) {
            const eatTex = this.textures.get(eatKey);
            const eatCols = eatTex.source[0].width / 64;
            const eatRows = eatTex.source[0].height / 64;
            const totalEatFrames = eatCols * eatRows;
            this.anims.create({
                key: `${eatKey}`,
                frames: this.anims.generateFrameNumbers(eatKey, {
                    start: 0, end: Math.max(0, totalEatFrames - 1)
                }),
                frameRate: 6, repeat: -1,
            });
        }
    }
}

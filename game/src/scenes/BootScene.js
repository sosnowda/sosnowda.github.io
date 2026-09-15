// Сцена загрузки: загружает реальные pixelart-ассеты из /assets/
// и создаёт персонажа/квест при первом запуске.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { createCharacter } from '../systems/Character.js';

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
        this.add.text(width / 2, height / 2 + 20, 'Загрузка...', {
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
        // Камень
        for (let v = 0; v < 2; v++) this.load.image(`tile_rock_${v}`, `assets/tiles/rock_${v}.png`);
        // Дом (стена + крыша)
        for (let v = 0; v < 3; v++) this.load.image(`tile_house_wall_${v}`, `assets/tiles/house_wall_${v}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`tile_house_roof_${v}`, `assets/tiles/house_roof_${v}.png`);
        // Декорации
        for (let i = 0; i < 4; i++) this.load.image(`deco_well_${i}`, `assets/tiles/well_${i}.png`);
        this.load.image('deco_campfire', 'assets/tiles/campfire.png');
        this.load.image('deco_fence', 'assets/tiles/fence_0.png');

        // ----- СПРАЙТЫ ПЕРСОНАЖЕЙ (spritesheets 64×64, 16 кадров: 4 строки × 4 колонки) -----
        const spriteKeys = ['player', 'npc_elder', 'npc_merchant', 'npc_soldier', 'npc_bandit', 'enemy_bandit', 'enemy_wolf'];
        spriteKeys.forEach((key) => {
            this.load.spritesheet(key, `assets/sprites/${key}.png`, { frameWidth: 64, frameHeight: 64 });
        });

        // ----- ПОРТРЕТЫ -----
        ['elder', 'merchant', 'soldier', 'bandit', 'narrator'].forEach((p) => {
            this.load.image(`portrait_${p}`, `assets/sprites/portrait_${p}.png`);
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

        // ----- ИНТЕРЬЕРНЫЕ ТАЙЛЫ И ДЕКОРАЦИИ (для InteriorScene) -----
        for (let v = 0; v < 2; v++) this.load.image(`int_floor_${v}`, `assets/interiors/floor_wood_${v}.png`);
        this.load.image('int_wall', 'assets/interiors/wall_wood.png');
        this.load.image('int_window', 'assets/interiors/window.png');
        this.load.image('int_door_back', 'assets/interiors/door_back.png');
        // Декорации интерьера (базовые + новые)
        ['table', 'chair', 'candle', 'fireplace', 'anvil', 'bed', 'icon_wall', 'bar', 'barrel',
         'loom', 'shelf', 'hay', 'firewood', 'analogion', 'bench', 'cradle', 'spinning', 'chest'
        ].forEach((d) => {
            this.load.image(`int_deco_${d}`, `assets/interiors/deco_${d}.png`);
        });
        // Анимированный огонь (4 кадра)
        for (let f = 0; f < 4; f++) this.load.image(`int_fire_${f}`, `assets/effects/fire_${f}.png`);

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
        this.load.image('deco_church_building', 'assets/sprites/deco_church_building.png');
        for (let v = 0; v < 4; v++) this.load.image(`deco_house_${v}`, `assets/sprites/deco_house_${v}.png`);

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
        // Полные LPC-листы (10×6) — для деревни/разных направлений
        for (let i = 1; i <= 6; i++) {
            this.load.spritesheet(`wolf_full_${i}`, `assets/sprites/wolf_${i}.png`,
                { frameWidth: 64, frameHeight: 64 });
        }

        // ----- Universal LPC Character Generator слои -----
        // Загружаем манифест с перечнем опций
        this.load.json('lpc_manifest', 'assets/lpc/manifest.json');
        // Загружаем все PNG-слои по списку из манифеста.
        // Это ~250 файлов, каждый 832×2944. Загрузка идёт в фоне с прогресс-баром.
        // Чтобы не блокировать игру, мы загружаем только манифест здесь,
        // а сами слои подгружаются асинхронно при входе в CharacterGeneratorScene.

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

        // ----- АУДИО -----
        // SFX
        const sfxKeys = [
            'sfx_button_click', 'sfx_button_hover',
            'sfx_sword_hit', 'sfx_sword_miss',
            'sfx_bow_shoot', 'sfx_arrow_hit',
            'sfx_damage_taken', 'sfx_heal', 'sfx_level_up',
            'sfx_dialogue_open', 'sfx_dialogue_close',
            'sfx_step', 'sfx_typewriter',
        ];
        sfxKeys.forEach((key) => {
            this.load.audio(key, `assets/audio/sfx/${key}.ogg`);
        });
        // Музыка
        this.load.audio('music_menu', 'assets/audio/music/music_menu.ogg');
        this.load.audio('music_village', 'assets/audio/music/music_village.ogg');
        this.load.audio('music_combat', 'assets/audio/music/music_combat.ogg');

        // Сохраняем список аудио-ключей в registry для AudioManager
        this.registry.set('audioKeys', sfxKeys);
    }

    create() {
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

        // ----- Создаём walk-анимации для каждого персонажа -----
        this.createWalkAnimations('player');
        this.createWalkAnimations('npc_elder');
        this.createWalkAnimations('npc_merchant');
        this.createWalkAnimations('npc_soldier');
        this.createWalkAnimations('npc_bandit');
        this.createWalkAnimations('enemy_bandit');
        this.createWalkAnimations('enemy_wolf');

        // ----- Анимации Fantasy Knight (для CombatScene) -----
        this.createKnightAnimations('knight');
        this.createKnightAnimations('knight', '_c2');

        // ----- Анимации LPC Wolf (combat sheet) -----
        this.createWolfAnimations();

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
                chestsOpened: [],
                hoursPassed: 0,
            });
        }

        this.scene.start('Title');
    }

    /**
     * Процедурные текстуры декора (раунд 11): сундуки (закрыт/открыт),
     * полевые цветы 3 цветов и травяные кочки. Рисуются graphics-ом один раз
     * при загрузке — никаких лишних сетевых запросов.
     */
    createDecoTextures() {
        const g = this.make.graphics({ add: false });

        // ===== Сундук закрытый (24×20): дубовые доски + кованая полоса + замок =====
        g.clear();
        g.fillStyle(0x6b4a2a, 1); g.fillRect(2, 8, 20, 10);          // корпус
        g.fillStyle(0x7d5834, 1); g.fillRect(3, 9, 18, 3);           // светлее сверху
        g.fillStyle(0x5a3d22, 1); g.fillRect(2, 16, 20, 2);          // тень снизу
        g.fillStyle(0x4a3018, 1); g.fillRect(1, 6, 22, 4);           // крышка (прикрыта)
        g.fillStyle(0x8a6438, 1); g.fillRect(2, 7, 20, 1);           // блик крышки
        g.fillStyle(0x3d3d3d, 1); g.fillRect(10, 6, 4, 12);          // кованая полоса
        g.fillStyle(0x5a5a5a, 1); g.fillRect(10, 6, 4, 1);           // блик полосы
        g.fillStyle(0xc9a14a, 1); g.fillRect(11, 10, 2, 3);          // замок (латунь)
        g.generateTexture('chest_closed', 24, 20);

        // ===== Сундук открытый (24×22): крышка откинута, внутри поблёскивает =====
        g.clear();
        g.fillStyle(0x4a3018, 1); g.fillRect(1, 0, 22, 5);           // откинутая крышка
        g.fillStyle(0x8a6438, 1); g.fillRect(1, 0, 22, 1);           // блик крышки
        g.fillStyle(0x2a1a0e, 1); g.fillRect(2, 8, 20, 10);          // тёмный нутро
        g.fillStyle(0x6b4a2a, 1); g.fillRect(2, 16, 20, 3);          // корпус ниже
        g.fillStyle(0x5a3d22, 1); g.fillRect(2, 18, 20, 1);          // тень корпуса
        g.fillStyle(0x3d3d3d, 1); g.fillRect(10, 0, 4, 5);           // полоса на крышке
        g.fillStyle(0xc9a14a, 1); g.fillRect(6, 9, 2, 2);            // блеск монет
        g.fillStyle(0xe8cc7a, 1); g.fillRect(14, 10, 3, 2);          // ещё блеск
        g.fillStyle(0xc9a14a, 1); g.fillRect(9, 12, 2, 1);           // и ещё
        g.generateTexture('chest_open', 24, 22);

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
     * зверобой, тайник под корягой, поваленный ствол, клочья тумана.
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

        // ===== Тайник под корягой (30×20): бугор земли + корни + крест-затвор =====
        g.clear();
        g.fillStyle(0x4a3a26, 1); g.fillEllipse(15, 14, 28, 12);       // бугор
        g.fillStyle(0x5a4830, 1); g.fillEllipse(13, 12, 16, 7);        // светлее верх
        g.fillStyle(0x332619, 1); g.fillEllipse(15, 16, 14, 5);        // тень ямы
        // Коряга-корни
        g.fillStyle(0x4d3a22, 1);
        g.fillRect(2, 8, 3, 8); g.fillRect(25, 7, 3, 9);
        g.fillRect(4, 6, 8, 3); g.fillRect(20, 5, 8, 3);
        g.fillStyle(0x6a5232, 1); g.fillRect(5, 6, 6, 1);              // блик коряг
        // Крест-примета сверху (две перекладины)
        g.fillStyle(0x2e2013, 1); g.fillRect(14, 4, 2, 9); g.fillRect(11, 7, 8, 2);
        g.generateTexture('deco_stash_mound', 30, 20);

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
     * Создать walk-анимации в 4 направлениях для spritesheet 4×4.
     * Структура: строки 0=down, 1=left, 2=right, 3=up; колонки 0..3 = кадры.
     */
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

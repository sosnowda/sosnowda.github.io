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

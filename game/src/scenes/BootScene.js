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
        // Декорации интерьера
        ['table', 'chair', 'candle', 'fireplace', 'anvil', 'bed', 'icon_wall', 'bar', 'barrel'].forEach((d) => {
            this.load.image(`int_deco_${d}`, `assets/interiors/deco_${d}.png`);
        });
        // Анимированный огонь (4 кадра)
        for (let f = 0; f < 4; f++) this.load.image(`int_fire_${f}`, `assets/effects/fire_${f}.png`);

        // ----- ТАЙЛЫ ЛОКАЦИЙ (для LocationScene) -----
        for (let v = 0; v < 2; v++) this.load.image(`tile_forest_dense_${v}`, `assets/tiles/forest_dense_${v}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`tile_road_${v}`, `assets/tiles/road_${v}.png`);
        for (let f = 0; f < 3; f++) this.load.image(`tile_river_${f}`, `assets/tiles/river_${f}.png`);
        for (let v = 0; v < 2; v++) this.load.image(`tile_field_${v}`, `assets/tiles/field_${v}.png`);
        this.load.image('tile_gate', 'assets/tiles/gate.png');

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
}

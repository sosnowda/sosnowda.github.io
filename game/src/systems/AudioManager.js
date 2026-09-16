// Phaser загружен глобально через CDN
import { AudioEffects } from '../utils/audio.js';

/**
 * AudioManager — единая система управления аудио
 *
 * ✅ Единственный источник правды об аудио-настройках: SettingsManager (сохраняется в gameSettings.audio)
 * ✅ AudioManager через scene.registry по ключам settings.audio.* отслеживает изменения и применяет их к SoundManager/AudioEffects
 */
export default class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.registry = scene?.registry ?? null;
        this.settingsManager = scene?.settingsManager ?? null;
        this.events = new Phaser.Events.EventEmitter();

        this.music = {}; // объекты фоновой музыки
        this.sounds = {}; // объекты звуковых эффектов
        this.realSounds = {}; // реальные SFX-файлы (key -> Phaser.Sound.BaseSound)
        this.currentMusic = null; // ключ текущей проигрываемой музыки
        this.ambient = null; // Раунд 24: текущий эмбиент-цикл
        this.ambientKey = null; // Раунд 24: ключ эмбиента

        // Состояние времени выполнения (управляется из settings.audio.*)
        this.musicVolume = 0.7;
        this.sfxVolume = 0.8;
        this.musicMuted = false;
        this.sfxMuted = false;

        // Интеграция системы процедурных звуков (fallback если реальные SFX не загружены)
        this.audioEffects = new AudioEffects(scene);

        // Загрузка реальных SFX из registry (если они были предзагружены в BootScene)
        this._loadRealSounds();

        // Первичная синхронизация (если SettingsManager уже инициализирован, он запишет settings.audio.* в registry)
        this._pullFromRegistry();
        this._applyAll();
        this._bindRegistryListeners();

        // Автоматическая очистка при закрытии сцены
        if (this.scene?.events && typeof this.scene.events.once === 'function') {
            this.scene.events.once('shutdown', () => this.destroy());
        }
    }

    /**
     * Загрузить реальные SFX из registry, где они были предзагружены в BootScene.
     * Реальные SFX имеют приоритет над процедурными.
     */
    _loadRealSounds() {
        if (!this.scene?.sound) return;
        const registry = this.scene.registry;
        const audioKeys = registry?.get('audioKeys') || [];
        audioKeys.forEach((key) => {
            try {
                this.realSounds[key] = this.scene.sound.add(key);
            } catch (e) {
                // ignore
            }
        });
    }

    /**
     * Проиграть реальный SFX-файл по ключу. Falls back to procedural если не загружен.
     */
    _playRealSfx(key, fallback, volume = 1) {
        if (this.sfxMuted) return;
        const effectiveVolume = this.sfxVolume * volume;
        if (this.realSounds[key]) {
            try {
                this.realSounds[key].play({ volume: effectiveVolume });
                return;
            } catch (e) {
                // fall through to fallback
            }
        }
        if (fallback && this.audioEffects && typeof this.audioEffects[fallback] === 'function') {
            this.audioEffects[fallback]();
        }
    }

    /**
     * Раунд 23: проиграть случайный SFX из набора (вариации ударов/промахов).
     * Каждая вариация звучит чуть иначе — бой не превращается в метроном.
     */
    _playRealSfxRandom(keys, fallback, volume = 1) {
        const list = keys.filter(k => this.realSounds[k]);
        if (list.length === 0) {
            // Ни одной новой вариации не загружено — старый запасной ключ
            if (fallback) this._playRealSfx(fallback, null, volume);
            return;
        }
        const key = list[Math.floor(Math.random() * list.length)];
        this._playRealSfx(key, null, volume);
    }

    /**
     * Загрузить музыкальные треки. Должна вызываться после preload.
     * Раунд 24: + музыка таверны и церкви (треки подгружаются в фоне
     * после загрузки меню — kickoffBackgroundMusicPreload).
     */
    loadMusic() {
        if (!this.scene?.sound) return;
        const musicMap = {
            'menu': 'music_menu',
            'village': 'music_village',
            'combat': 'music_combat',
            'tavern': 'music_town_tavern',
            'church': 'music_town_church',
            'victory': 'music_victory',
            'gameover': 'music_game_over',
        };
        Object.entries(musicMap).forEach(([key, assetKey]) => {
            if (this.scene.sound.game.cache.audio.exists(assetKey) && !this.music[key]) {
                this.music[key] = this.scene.sound.add(assetKey, {
                    loop: true,
                    volume: this.musicMuted ? 0 : this.musicVolume * 0.5,
                });
            }
        });
    }

    /**
     * Переключить музыку по сцене. Fade out старой, fade in новой.
     */
    playSceneMusic(sceneKey) {
        // Загружаем музыке при первом вызове
        if (Object.keys(this.music).length === 0) {
            this.loadMusic();
        }
        if (!this.music[sceneKey]) return;

        if (this.currentMusic === sceneKey) return;

        // Fade out текущей
        if (this.currentMusic && this.music[this.currentMusic]) {
            const oldMusic = this.music[this.currentMusic];
            this.scene.tweens.add({
                targets: oldMusic,
                volume: 0,
                duration: 800,
                onComplete: () => {
                    oldMusic.stop();
                    oldMusic.setVolume(this.musicMuted ? 0 : this.musicVolume * 0.5);
                },
            });
        }

        // Fade in новой
        const newMusic = this.music[sceneKey];
        newMusic.play();
        newMusic.setVolume(0);
        this.scene.tweens.add({
            targets: newMusic,
            volume: this.musicMuted ? 0 : this.musicVolume * 0.5,
            duration: 800,
        });
        this.currentMusic = sceneKey;
    }

    _emit(eventName, payload) {
        if (this.events) {
            this.events.emit(eventName, payload);
        }
    }

    _clamp01(v, fallback) {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(1, n));
    }

    _pullFromRegistry() {
        if (!this.registry) return;
        this.musicVolume = this._clamp01(this.registry.get('settings.audio.musicVolume'), this.musicVolume);
        this.sfxVolume = this._clamp01(this.registry.get('settings.audio.sfxVolume'), this.sfxVolume);
        this.musicMuted = !!this.registry.get('settings.audio.musicMuted');
        this.sfxMuted = !!this.registry.get('settings.audio.sfxMuted');
    }

    _applyMusicVolume() {
        Object.values(this.music).forEach((music) => {
            if (music?.isPlaying) {
                music.setVolume(this.musicMuted ? 0 : this.musicVolume);
            }
        });
        // Раунд 24: эмбиент привязан к настройкам музыки (это атмосфера, не SFX)
        if (this.ambient?.isPlaying) {
            this.ambient.setVolume(this.musicMuted ? 0 : this.musicVolume * 0.35);
        }
    }

    // ==========================================
    //  Раунд 24: эмбиент локаций (циклические звуки мира)
    // ==========================================

    /**
     * Включить эмбиент-цикл для локации. Повторный вызов с тем же
     * ключом ничего не делает (нет «заикания» при смене под-локаций).
     * @param {string|null} key 'ambient_town_day' | 'ambient_town_night' |
     *   'ambient_forest_day' | 'ambient_forest_night' | 'ambient_tavern' | null
     */
    setAmbient(key) {
        if (!this.scene?.sound) return;
        if (key === this.ambientKey) return;
        if (this.ambient) {
            try {
                this.scene.tweens.add({
                    targets: this.ambient,
                    volume: 0,
                    duration: 600,
                    onComplete: () => {
                        this.ambient?.stop();
                        this.ambient?.destroy();
                    },
                });
            } catch (e) {
                this.ambient.stop();
                this.ambient.destroy();
            }
            this.ambient = null;
            this.ambientKey = null;
        }
        if (!key || !this.scene.sound.game.cache.audio.exists(key)) return;
        try {
            this.ambient = this.scene.sound.add(key, {
                loop: true,
                volume: this.musicMuted ? 0 : this.musicVolume * 0.35,
            });
            this.ambientKey = key;
            this.ambient.play();
        } catch (e) {
            this.ambient = null;
            this.ambientKey = null;
        }
    }

    stopAmbient() {
        this.setAmbient(null);
    }

    /**
     * Раунд 24: музыка интерьера (таверна/церковь). Трек мог быть ещё
     * не догружен фоновым прелоадером — тогда дожидаемся его и включаем.
     */
    playInteriorMusic(interiorId) {
        const map = { tavern: 'tavern', church: 'church' };
        const musicKey = map[interiorId];
        if (!musicKey) return; // в домах — тишина/эмбиент
        const assetKey = musicKey === 'tavern' ? 'music_town_tavern' : 'music_town_church';
        if (this.scene?.sound?.game?.cache?.audio?.exists(assetKey)) {
            this.loadMusic();
            this.playSceneMusic(musicKey);
        } else if (this.scene?.load) {
            // Фоновая догрузка: когда файл дойдёт — запустим музыку
            const loader = this.scene.load;
            if (!loader.listenerCount(`filecomplete-audio-${assetKey}`)) {
                loader.audio(assetKey, `assets/audio/music/${assetKey}.ogg`);
                loader.once(`filecomplete-audio-${assetKey}`, () => {
                    this.loadMusic();
                    this.playSceneMusic(musicKey);
                });
                try { loader.start(); } catch (e) { /* лоадер занят */ }
            }
        }
    }

    _applyAll() {
        this._applyMusicVolume();
        this.syncEffectsVolume();
    }

    _bindRegistryListeners() {
        const regEvents = this.registry?.events;
        if (!regEvents) {
            this._registryOffs = [];
            return;
        }

        this._registryOffs = [];

        const onMusicVol = (parent, value) => {
            const next = this._clamp01(value, this.musicVolume);
            if (next === this.musicVolume) return;
            this.musicVolume = next;
            this._applyMusicVolume();
            this._emit('music-volume-changed', { volume: this.musicVolume });
        };

        const onSfxVol = (parent, value) => {
            const next = this._clamp01(value, this.sfxVolume);
            if (next === this.sfxVolume) return;
            this.sfxVolume = next;
            this.syncEffectsVolume();
            this._emit('sfx-volume-changed', { volume: this.sfxVolume });
        };

        const onMusicMute = (parent, value) => {
            const next = !!value;
            if (next === this.musicMuted) return;
            this.musicMuted = next;
            this._applyMusicVolume();
            this._emit('music-mute-changed', { muted: this.musicMuted });
        };

        const onSfxMute = (parent, value) => {
            const next = !!value;
            if (next === this.sfxMuted) return;
            this.sfxMuted = next;
            this.syncEffectsVolume();
            this._emit('sfx-mute-changed', { muted: this.sfxMuted });
        };

        const pairs = [
            ['changedata-settings.audio.musicVolume', onMusicVol],
            ['changedata-settings.audio.sfxVolume', onSfxVol],
            ['changedata-settings.audio.musicMuted', onMusicMute],
            ['changedata-settings.audio.sfxMuted', onSfxMute]
        ];

        pairs.forEach(([eventName, handler]) => {
            regEvents.on(eventName, handler);
            this._registryOffs.push(() => regEvents.off(eventName, handler));
        });
    }

    _setSetting(path, value) {
        // Всегда идём через SettingsManager, чтобы гарантировать сохранение и синхронизацию с registry
        if (this.settingsManager && typeof this.settingsManager.set === 'function') {
            this.settingsManager.set(path, value);
            return;
        }

        // Запасной вариант: если SettingsManager нет, обновляем только registry (без гарантии сохранения)
        if (this.registry) {
            this.registry.set(`settings.${path}`, value);
        }
    }

    // ==========================================
    //  Управление звуковыми объектами Phaser
    // ==========================================

    addMusic(key, assetKey, config = {}) {
        const defaultConfig = {
            loop: true,
            volume: this.musicMuted ? 0 : this.musicVolume
        };
        this.music[key] = this.scene.sound.add(assetKey, { ...defaultConfig, ...config });
    }

    playMusic(key, restart = false) {
        if (!this.music[key]) {
            console.warn(`Music "${key}" not found`);
            return;
        }

        if (this.currentMusic && this.currentMusic !== key) {
            this.stopMusic(this.currentMusic);
        }

        const music = this.music[key];
        if (!music.isPlaying || restart) {
            music.play();
            music.setVolume(this.musicMuted ? 0 : this.musicVolume);
            this.currentMusic = key;
        }
    }

    stopMusic(key) {
        if (this.music[key]) {
            this.music[key].stop();
            if (this.currentMusic === key) {
                this.currentMusic = null;
            }
        }
    }

    pauseMusic(key) {
        if (this.music[key]) {
            this.music[key].pause();
        }
    }

    resumeMusic(key) {
        if (this.music[key]) {
            this.music[key].resume();
        }
    }

    addSound(key, assetKey) {
        this.sounds[key] = this.scene.sound.add(assetKey);
    }

    playSound(key, config = {}) {
        // Раунд 12 ФИКС: реальные SFX загружаются в this.realSounds (_loadRealSounds),
        // а this.sounds никто не наполняет (addSound никем не вызывается) —
        // поэтому каждый playSound('sfx_*') падал в warn «not found» без звука.
        const sound = this.sounds[key] || this.realSounds[key];
        if (!sound) {
            console.warn(`Sound "${key}" not found`);
            return;
        }

        const defaultConfig = {
            volume: this.sfxMuted ? 0 : this.sfxVolume
        };

        sound.play({ ...defaultConfig, ...config });
    }

    // ==========================================
    //  Аудио-настройки (запись через SettingsManager)
    // ==========================================

    setMusicVolume(volume) {
        const next = this._clamp01(volume, this.musicVolume);
        this._setSetting('audio.musicVolume', next);
    }

    setSFXVolume(volume) {
        const next = this._clamp01(volume, this.sfxVolume);
        this._setSetting('audio.sfxVolume', next);
    }

    toggleMusicMute() {
        this._setSetting('audio.musicMuted', !this.musicMuted);
    }

    toggleSFXMute() {
        this._setSetting('audio.sfxMuted', !this.sfxMuted);
    }

    syncEffectsVolume() {
        if (this.audioEffects) {
            const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume;
            this.audioEffects.setSfxVolume(effectiveVolume);
        }
    }

    getMusicVolume() {
        return this.musicVolume;
    }

    getSFXVolume() {
        return this.sfxVolume;
    }

    isMusicMuted() {
        return this.musicMuted;
    }

    isSFXMuted() {
        return this.sfxMuted;
    }

    // ==========================================
    //  Очистка
    // ==========================================

    destroy() {
        // слушатели registry
        if (Array.isArray(this._registryOffs)) {
            this._registryOffs.forEach((off) => {
                try { off(); } catch (e) { /* noop */ }
            });
            this._registryOffs = [];
        }

        Object.values(this.music).forEach((music) => music?.destroy?.());
        Object.values(this.sounds).forEach((sound) => sound?.destroy?.());
        this.music = {};
        this.sounds = {};
        this.currentMusic = null;

        // Раунд 24: остановить эмбиент
        if (this.ambient) {
            try { this.ambient.stop(); this.ambient.destroy(); } catch (e) { /* noop */ }
            this.ambient = null;
            this.ambientKey = null;
        }

        if (this.audioEffects) {
            this.audioEffects.destroy();
            this.audioEffects = null;
        }

        if (this.events) {
            this.events.removeAllListeners();
            this.events = null;
        }

        this.scene = null;
        this.registry = null;
        this.settingsManager = null;
    }

    // ==========================================
    //  Процедурные звуковые эффекты (делегируются AudioEffects)
    // ==========================================

    playButtonClick() {
        this._playRealSfx('sfx_button_click', 'playButtonClick');
    }

    playButtonHover() {
        this._playRealSfx('sfx_button_hover', 'playButtonHover');
    }

    playCollectItem() {
        this._playRealSfx('sfx_level_up', 'playCollectItem');
    }

    playJump() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playJump();
        }
    }

    playLanding() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playLanding();
        }
    }

    playShoot() {
        this._playRealSfx('sfx_bow_shoot', 'playShoot');
    }

    playExplosion() {
        this._playRealSfx('sfx_sword_hit', 'playExplosion');
    }

    playVictory() {
        this._playRealSfx('sfx_level_up', 'playVictory');
    }

    playLevelUp() {
        this._playRealSfx('sfx_level_up', 'playLevelUp');
    }

    playGameOver() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playGameOver();
        }
    }

    playAchievement() {
        this._playRealSfx('sfx_level_up', 'playAchievement');
    }

    playDoorOpen() {
        this._playRealSfx('sfx_dialogue_open', 'playDoorOpen');
    }

    playDoorClose() {
        this._playRealSfx('sfx_dialogue_close', 'playDoorClose');
    }

    playWarning() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playWarning();
        }
    }

    playMagic() {
        this._playRealSfx('sfx_heal', 'playMagic');
    }

    playTypewriter() {
        this._playRealSfx('sfx_typewriter', 'playTypewriter', 0.4);
    }

    // ====== Новые методы для конкретных SFX ======

    // ----- Раунд 23: боевые звуки (DarklandsReborn) -----
    // Взмах оружия (начало любой атаки — до определения исхода)
    playWeaponSwing() { this._playRealSfx('sfx_combat_swing', null, 0.75); }
    // Попадание оружием по телу — 4 случайные вариации
    playSwordHit() {
        this._playRealSfxRandom(
            ['sfx_combat_hit_1', 'sfx_combat_hit_2', 'sfx_combat_hit_3', 'sfx_combat_hit_4'],
            'sfx_sword_hit', 0.9);
    }
    // Промах / уклонение — свист воздуха, 2 вариации
    playSwordMiss() {
        this._playRealSfxRandom(['sfx_combat_miss_1', 'sfx_combat_miss_2'], 'sfx_sword_miss', 0.8);
    }
    // Удар по доспехам (урон частично погашен бронёй)
    playArmorHit() { this._playRealSfx('sfx_combat_armor', null, 0.85); }
    // Удар по щиту/полностью погашен (урон = 0)
    playShieldHit() { this._playRealSfx('sfx_combat_shield', null, 0.9); }
    // Падение поверженного (враг или герой)
    playCombatDeath() { this._playRealSfx('sfx_combat_death', null, 0.9); }
    // Вой волка (начало боя с волками)
    playWolfHowl() { this._playRealSfx('sfx_wolf_howl', null, 0.9); }

    playSwordHitLegacy() { this._playRealSfx('sfx_sword_hit', null); }
    playArrowHit() { this._playRealSfx('sfx_arrow_hit', null); }
    playDamageTaken() { this._playRealSfx('sfx_damage_taken', null); }
    playHeal() { this._playRealSfx('sfx_heal', null); }
    playStep() { this._playRealSfx('sfx_step', null, 0.4); }
    playDialogueOpen() { this._playRealSfx('sfx_dialogue_open', null); }
    playDialogueClose() { this._playRealSfx('sfx_dialogue_close', null); }

    // ====== Раунд 24: мир и торговля (DarklandsReborn) ======
    // Монеты: награды за квесты и работа
    playGoldReceive() { this._playRealSfx('sfx_gold_receive', null, 0.9); }
    // Монеты: покупки в таверне и кузнице
    playGoldSpend() { this._playRealSfx('sfx_gold_spend', null, 0.9); }
    // Колокол: вход в церковь, начало благословения
    playChurchBell() { this._playRealSfx('sfx_church_bell', null, 0.9); }
    // Молитва/благословение священника
    playPrayerChant() { this._playRealSfx('sfx_prayer_chant', null, 0.9); }
    // Двери домов
    playRealDoorOpen() { this._playRealSfx('sfx_door_open', null, 0.8); }
    playRealDoorClose() { this._playRealSfx('sfx_door_close', null, 0.8); }

    playRandomEffect() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playRandomEffect();
        }
    }
}

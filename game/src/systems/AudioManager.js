import Phaser from 'phaser';
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
        this.currentMusic = null; // ключ текущей проигрываемой музыки

        // Состояние времени выполнения (управляется из settings.audio.*)
        this.musicVolume = 0.7;
        this.sfxVolume = 0.8;
        this.musicMuted = false;
        this.sfxMuted = false;

        // Интеграция системы процедурных звуков
        this.audioEffects = new AudioEffects(scene);

        // Первичная синхронизация (если SettingsManager уже инициализирован, он запишет settings.audio.* в registry)
        this._pullFromRegistry();
        this._applyAll();
        this._bindRegistryListeners();

        // Автоматическая очистка при закрытии сцены
        if (this.scene?.events && typeof this.scene.events.once === 'function') {
            this.scene.events.once('shutdown', () => this.destroy());
        }
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
        if (!this.sounds[key]) {
            console.warn(`Sound "${key}" not found`);
            return;
        }

        const defaultConfig = {
            volume: this.sfxMuted ? 0 : this.sfxVolume
        };

        this.sounds[key].play({ ...defaultConfig, ...config });
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
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playButtonClick();
        }
    }

    playButtonHover() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playButtonHover();
        }
    }

    playCollectItem() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playCollectItem();
        }
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
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playShoot();
        }
    }

    playExplosion() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playExplosion();
        }
    }

    playVictory() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playVictory();
        }
    }

    playLevelUp() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playLevelUp();
        }
    }

    playGameOver() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playGameOver();
        }
    }

    playAchievement() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playAchievement();
        }
    }

    playDoorOpen() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playDoorOpen();
        }
    }

    playDoorClose() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playDoorClose();
        }
    }

    playWarning() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playWarning();
        }
    }

    playMagic() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playMagic();
        }
    }

    playTypewriter() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playTypewriter();
        }
    }

    playRandomEffect() {
        if (this.audioEffects && !this.sfxMuted) {
            this.audioEffects.playRandomEffect();
        }
    }
}

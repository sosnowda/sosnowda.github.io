// Phaser загружен глобально через CDN

/**
 * SettingsManager — система сохранения и управления настройками
 * Управляет настройками игры (язык, сложность, параметры отображения и т.д.)
 *
 * События:
 * - setting-changed: { path, value, previous }
 * - settings-changed: { settings }
 */
export default class SettingsManager {
    constructor(scene = null) {
        this.scene = scene;
        this.registry = scene?.registry ?? null;
        this.events = new Phaser.Events.EventEmitter();

        // Локальное сохранение с дросселированием: чтобы избежать подвисаний от частой записи в localStorage
        this._saveTimer = null;
        this._saveDelayMs = 400;
        this._boundFlushSave = () => this.flushSaveSettings();

        if (this.scene?.events && typeof this.scene.events.once === 'function') {
            this.scene.events.once('shutdown', this._boundFlushSave);
        }
        if (typeof window !== 'undefined' && window?.addEventListener) {
            window.addEventListener('pagehide', this._boundFlushSave);
        }

        // Настройки по умолчанию
        this.settings = {
            // Аудио-настройки
            audio: {
                musicVolume: 0.7,
                sfxVolume: 0.8,
                musicMuted: false,
                sfxMuted: false
            },

            // Настройки отображения
            display: {
                fullscreen: false,
                showFPS: false,
                particleEffects: true,
                screenShake: true,
                quality: 'high' // 'low', 'medium', 'high'
            },

            // Игровые настройки
            game: {
                difficulty: 'normal', // 'easy', 'normal', 'hard'
                language: 'ru-RU', // 'ru-RU', 'en-US'
                autoSave: true,
                showTutorial: true
            },

            // Настройки управления
            controls: {
                keyboardEnabled: true,
                mouseEnabled: true,
                touchEnabled: true,
                vibration: true
            }
        };

        this.loadSettings();
        this._syncRegistryAll();
    }

    _emit(eventName, payload) {
        if (this.events) {
            this.events.emit(eventName, payload);
        }
    }

    _syncRegistryAll() {
        if (!this.registry) return;
        // Синхронизируем только часто используемые ключи (чтобы не раздувать registry)
        this.registry.set('settings.game.difficulty', this.get('game.difficulty'));
        this.registry.set('settings.display.quality', this.get('display.quality'));
        this.registry.set('settings.game.language', this.get('game.language'));
        this.registry.set('settings.game.autoSave', this.get('game.autoSave'));
        this.registry.set('settings.display.fullscreen', this.get('display.fullscreen'));
        this.registry.set('settings.display.showFPS', this.get('display.showFPS'));
        this.registry.set('settings.audio.musicVolume', this.get('audio.musicVolume'));
        this.registry.set('settings.audio.sfxVolume', this.get('audio.sfxVolume'));
        this.registry.set('settings.audio.musicMuted', this.get('audio.musicMuted'));
        this.registry.set('settings.audio.sfxMuted', this.get('audio.sfxMuted'));
    }

    _syncRegistryPath(path, value) {
        if (!this.registry) return;
        this.registry.set(`settings.${path}`, value);
    }

    /**
     * Загрузить настройки из локального хранилища
     */
    loadSettings() {
        let parsedGameSettings = null;

        try {
            const data = localStorage.getItem('gameSettings');
            if (data) {
                parsedGameSettings = JSON.parse(data);
                this.settings = this.mergeDeep(this.settings, parsedGameSettings);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }

        // Совместимость при миграции: в старых версиях AudioManager хранил аудио отдельно в audioSettings
        // Единая миграция в gameSettings.audio, чтобы избежать «расхождения двух источников»
        try {
            const legacyAudio = localStorage.getItem('audioSettings');
            const shouldMigrate = legacyAudio && (!parsedGameSettings || !parsedGameSettings.audio);

            if (shouldMigrate) {
                const parsedLegacy = JSON.parse(legacyAudio);
                this.settings.audio = this.mergeDeep(this.settings.audio, {
                    musicVolume: parsedLegacy.musicVolume,
                    sfxVolume: parsedLegacy.sfxVolume,
                    musicMuted: parsedLegacy.musicMuted,
                    sfxMuted: parsedLegacy.sfxMuted
                });

                localStorage.removeItem('audioSettings');
                // Прямая запись в gameSettings (без лишних событий, чтобы не засорять лог при инициализации)
                localStorage.setItem('gameSettings', JSON.stringify(this.settings));
            } else if (legacyAudio) {
                // Если уже есть новый источник настроек — удаляем старый ключ во избежание ошибочного использования
                localStorage.removeItem('audioSettings');
            }
        } catch (error) {
            console.error('Failed to migrate legacy audio settings:', error);
        }
    }

    _scheduleSaveSettings() {
        if (this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._persistNow();
        }, this._saveDelayMs);
    }

    _persistNow() {
        try {
            localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Сохранить настройки в локальное хранилище (с дросселированием)
     */
    saveSettings() {
        // Сохраняем старую семантику: вызывающий считает, что «настройки изменились» — событие шлём сразу,
        // а реальная запись на диск откладывается и объединяется
        this._emit('settings-changed', { settings: this.settings });
        this._scheduleSaveSettings();
    }

    /**
     * Немедленно записать на диск (при смене сцены/закрытии страницы)
     */
    flushSaveSettings() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this._persistNow();
    }

    /**
     * Глубокое слияние объектов
     * @param {object} target - целевой объект
     * @param {object} source - исходный объект
     * @returns {object}
     */
    mergeDeep(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.mergeDeep(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        return output;
    }

    /**
     * Проверить, является ли значение объектом
     * @param {any} item - проверяемый элемент
     * @returns {boolean}
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Получить значение настройки
     * @param {string} path - путь к настройке (например: 'audio.musicVolume')
     * @returns {any}
     */
    get(path) {
        const keys = path.split('.');
        let value = this.settings;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * Установить значение
     * @param {string} path - путь к настройке (например: 'audio.musicVolume')
     * @param {any} value - устанавливаемое значение
     */
    set(path, value) {
        const previous = this.get(path);

        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.settings;

        for (const key of keys) {
            if (!(key in target)) {
                target[key] = {};
            }
            target = target[key];
        }

        target[lastKey] = value;
        this._syncRegistryPath(path, value);
        this.saveSettings();
        this._emit('setting-changed', { path, value, previous });
    }

    /**
     * Получить все настройки
     * @returns {object}
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Пакетное обновление настроек
     * @param {object} newSettings - объект новых настроек
     */
    updateSettings(newSettings) {
        this.settings = this.mergeDeep(this.settings, newSettings);
        this._syncRegistryAll();
        this.saveSettings();
    }

    /**
     * Сбросить к настройкам по умолчанию
     */
    resetToDefault() {
        this.settings = {
            audio: {
                musicVolume: 0.7,
                sfxVolume: 0.8,
                musicMuted: false,
                sfxMuted: false
            },
            display: {
                fullscreen: false,
                showFPS: false,
                particleEffects: true,
                screenShake: true,
                quality: 'high'
            },
            game: {
                difficulty: 'normal',
                language: 'ru-RU',
                autoSave: true,
                showTutorial: true
            },
            controls: {
                keyboardEnabled: true,
                mouseEnabled: true,
                touchEnabled: true,
                vibration: true
            }
        };
        this._syncRegistryAll();
        this.saveSettings();
    }

    /**
     * Переключить полноэкранный режим (здесь меняется только значение;
     * само переключение режима лучше выполнять в Scene)
     */
    toggleFullscreen() {
        this.set('display.fullscreen', !this.get('display.fullscreen'));
    }

    /**
     * Установить сложность
     * @param {string} difficulty - уровень сложности
     */
    setDifficulty(difficulty) {
        const validDifficulties = ['easy', 'normal', 'hard'];
        if (validDifficulties.includes(difficulty)) {
            this.set('game.difficulty', difficulty);
        }
    }

    /**
     * Установить язык
     * @param {string} language - код языка
     */
    setLanguage(language) {
        this.set('game.language', language);
    }

    /**
     * Установить качество графики
     * @param {string} quality - уровень качества
     */
    setQuality(quality) {
        const validQualities = ['low', 'medium', 'high'];
        if (validQualities.includes(quality)) {
            this.set('display.quality', quality);
        }
    }

    /**
     * Экспортировать настройки в JSON
     * @returns {string}
     */
    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Импортировать настройки из JSON
     * @param {string} jsonString - JSON-строка
     * @returns {boolean} - успешно ли
     */
    importSettings(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            this.updateSettings(parsed);
            return true;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }

    destroy() {
        // Стараемся гарантировать последнюю запись на диск
        this.flushSaveSettings();

        if (typeof window !== 'undefined' && window?.removeEventListener && this._boundFlushSave) {
            window.removeEventListener('pagehide', this._boundFlushSave);
        }

        if (this.events) {
            this.events.removeAllListeners();
            this.events = null;
        }
        this.scene = null;
        this.registry = null;
        this._boundFlushSave = null;
    }
}

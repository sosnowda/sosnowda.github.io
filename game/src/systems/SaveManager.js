import Phaser from 'phaser';

/**
 * SaveManager — система управления сохранениями
 * Управляет сохранением и загрузкой состояния игры
 *
 * События:
 * - save-success: { slotId, saveData }
 * - save-error: { slotId, message, error }
 * - load-success: { slotId, gameState }
 * - load-error: { slotId, message, error }
 */
export default class SaveManager {
    constructor(scene = null) {
        this.scene = scene;
        this.events = new Phaser.Events.EventEmitter();

        this.storageKey = 'gameSaveData';
        this.maxSaveSlots = 3; // максимум 3 слота сохранений
        this.autoSaveEnabled = true;
        this.autoSaveInterval = 60000; // интервал автосохранения (мс)
        this.autoSaveTimer = null;
        this._autoSaveCallback = null;

        // Автоматически останавливаем автосохранение при закрытии/уничтожении сцены
        if (this.scene && this.scene.events && typeof this.scene.events.once === 'function') {
            this.scene.events.once('shutdown', () => this.stopAutoSave());
            this.scene.events.once('destroy', () => this.stopAutoSave());
        }
    }

    _emit(eventName, payload) {
        if (this.events) {
            this.events.emit(eventName, payload);
        }
    }

    _isValidSlot(slotId) {
        return Number.isInteger(slotId) && slotId >= 0 && slotId < this.maxSaveSlots;
    }

    /**
     * Сохранить состояние игры
     * @param {number} slotId - ID слота сохранения (0-2)
     * @param {object} gameState - данные состояния игры
     * @param {string} saveName - имя сохранения (необязательно)
     * @returns {boolean} - успешно ли сохранено
     */
    saveGame(slotId, gameState, saveName = '') {
        if (!this._isValidSlot(slotId)) {
            const message = 'Invalid save slot ID';
            console.error(message);
            this._emit('save-error', { slotId, message });
            return false;
        }

        try {
            const saveData = {
                slotId,
                saveName: saveName || `Сохранение ${slotId + 1}`,
                timestamp: Date.now(),
                gameState: this.compressGameState(gameState)
            };

            const allSaves = this.getAllSaves();
            allSaves[slotId] = saveData;

            localStorage.setItem(this.storageKey, JSON.stringify(allSaves));

            this._emit('save-success', { slotId, saveData });
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            this._emit('save-error', { slotId, message: error.message, error });
            return false;
        }
    }

    /**
     * Загрузить состояние игры
     * @param {number} slotId - ID слота сохранения (0-2)
     * @returns {object|null} - данные состояния игры или null
     */
    loadGame(slotId) {
        if (!this._isValidSlot(slotId)) {
            const message = 'Invalid save slot ID';
            console.error(message);
            this._emit('load-error', { slotId, message });
            return null;
        }

        try {
            const allSaves = this.getAllSaves();
            const saveData = allSaves[slotId];

            if (!saveData) {
                const message = 'No save data found';
                console.warn(`No save data found in slot ${slotId}`);
                this._emit('load-error', { slotId, message });
                return null;
            }

            const gameState = this.decompressGameState(saveData.gameState);
            this._emit('load-success', { slotId, gameState });
            return gameState;
        } catch (error) {
            console.error('Failed to load game:', error);
            this._emit('load-error', { slotId, message: error.message, error });
            return null;
        }
    }

    /**
     * Получить все сохранения
     * @returns {Array} - массив сохранений
     */
    getAllSaves() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to get saves:', error);
        }
        return new Array(this.maxSaveSlots).fill(null);
    }

    /**
     * Получить информацию о сохранении (без полного состояния игры)
     * @param {number} slotId - ID слота сохранения
     * @returns {object|null} - информация о сохранении
     */
    getSaveInfo(slotId) {
        const allSaves = this.getAllSaves();
        const saveData = allSaves[slotId];

        if (!saveData) {
            return null;
        }

        return {
            slotId: saveData.slotId,
            saveName: saveData.saveName,
            timestamp: saveData.timestamp,
            date: new Date(saveData.timestamp).toLocaleString()
        };
    }

    /**
     * Получить информацию обо всех сохранениях
     * @returns {Array} - массив информации о сохранениях
     */
    getAllSaveInfo() {
        return Array.from({ length: this.maxSaveSlots }, (_, i) => this.getSaveInfo(i));
    }

    /**
     * Удалить сохранение
     * @param {number} slotId - ID слота сохранения
     * @returns {boolean} - успешно ли удалено
     */
    deleteSave(slotId) {
        if (!this._isValidSlot(slotId)) {
            console.error('Invalid save slot ID');
            return false;
        }

        try {
            const allSaves = this.getAllSaves();
            allSaves[slotId] = null;
            localStorage.setItem(this.storageKey, JSON.stringify(allSaves));
            return true;
        } catch (error) {
            console.error('Failed to delete save:', error);
            return false;
        }
    }

    /**
     * Проверить, пуст ли слот сохранения
     * @param {number} slotId - ID слота сохранения
     * @returns {boolean}
     */
    isSlotEmpty(slotId) {
        return this.getSaveInfo(slotId) === null;
    }

    /**
     * Сжать состояние игры (здесь можно добавить реальную логику сжатия)
     * @param {object} gameState - состояние игры
     * @returns {object}
     */
    compressGameState(gameState) {
        return gameState;
    }

    /**
     * Распаковать состояние игры
     * @param {object} compressedState - сжатое состояние игры
     * @returns {object}
     */
    decompressGameState(compressedState) {
        return compressedState;
    }

    /**
     * Запустить автосохранение (использует Phaser scene.time.addEvent — безопаснее с жизненным циклом сцены)
     * @param {Function} saveCallback - функция обратного вызова автосохранения
     */
    startAutoSave(saveCallback) {
        this._autoSaveCallback = (typeof saveCallback === 'function') ? saveCallback : null;

        if (!this.autoSaveEnabled) {
            return;
        }

        this.stopAutoSave();

        const delay = Math.max(1000, Number(this.autoSaveInterval) || 60000);

        // Предпочтительно используем Phaser TimeEvent (безопаснее при паузе/закрытии сцены)
        if (this.scene?.time && typeof this.scene.time.addEvent === 'function') {
            this.autoSaveTimer = this.scene.time.addEvent({
                delay,
                loop: true,
                callback: () => {
                    if (this._autoSaveCallback) {
                        this._autoSaveCallback();
                    }
                }
            });
            return;
        }

        // Запасной вариант: если нет scene/time (например, чистая логическая среда), возвращаемся к setInterval
        this.autoSaveTimer = setInterval(() => {
            if (this._autoSaveCallback) {
                this._autoSaveCallback();
            }
        }, delay);
    }

    /**
     * Остановить автосохранение
     */
    stopAutoSave() {
        if (!this.autoSaveTimer) return;

        // Phaser.Time.TimerEvent
        if (typeof this.autoSaveTimer.remove === 'function') {
            this.autoSaveTimer.remove(false);
            this.autoSaveTimer = null;
            return;
        }

        // id setInterval
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
    }

    /**
     * Установить интервал автосохранения
     * @param {number} interval - интервал (мс)
     */
    setAutoSaveInterval(interval) {
        this.autoSaveInterval = interval;

        // Если автосохранение уже запущено, немедленно перезапускаем с новым интервалом
        if (this.autoSaveEnabled && this.autoSaveTimer) {
            this.startAutoSave(this._autoSaveCallback);
        }
    }

    /**
     * Включить/выключить автосохранение
     * @param {boolean} enabled - включить ли
     */
    setAutoSaveEnabled(enabled) {
        this.autoSaveEnabled = !!enabled;

        if (!this.autoSaveEnabled) {
            this.stopAutoSave();
            return;
        }

        // При повторном включении: если ранее был зарегистрирован колбэк, возобновляем автосохранение
        if (this._autoSaveCallback) {
            this.startAutoSave(this._autoSaveCallback);
        }
    }

    /**
     * Очистить все сохранения
     * @returns {boolean}
     */
    clearAllSaves() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Failed to clear saves:', error);
            return false;
        }
    }

    /**
     * Экспортировать сохранение в файл
     * @param {number} slotId - ID слота сохранения
     * @returns {string|null} - JSON-строка
     */
    exportSave(slotId) {
        const saveData = this.getAllSaves()[slotId];
        if (!saveData) {
            return null;
        }
        return JSON.stringify(saveData, null, 2);
    }

    /**
     * Импортировать сохранение из файла
     * @param {number} slotId - ID слота сохранения
     * @param {string} jsonString - JSON-строка
     * @returns {boolean}
     */
    importSave(slotId, jsonString) {
        if (!this._isValidSlot(slotId)) {
            console.error('Invalid save slot ID');
            return false;
        }

        try {
            const saveData = JSON.parse(jsonString);
            const allSaves = this.getAllSaves();
            allSaves[slotId] = saveData;
            localStorage.setItem(this.storageKey, JSON.stringify(allSaves));
            return true;
        } catch (error) {
            console.error('Failed to import save:', error);
            return false;
        }
    }

    /**
     * Получить информацию об использовании хранилища
     * @returns {object}
     */
    getStorageInfo() {
        try {
            const data = localStorage.getItem(this.storageKey);
            const used = data ? new Blob([data]).size : 0;
            const total = 5 * 1024 * 1024; // предполагаем лимит 5MB

            return {
                used,
                total,
                usedPercent: (used / total * 100).toFixed(2),
                usedKB: (used / 1024).toFixed(2),
                totalMB: (total / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return null;
        }
    }

    destroy() {
        this.stopAutoSave();
        this._autoSaveCallback = null;
        if (this.events) {
            this.events.removeAllListeners();
            this.events = null;
        }
        this.scene = null;
    }
}

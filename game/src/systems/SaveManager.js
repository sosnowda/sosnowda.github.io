// Phaser загружен глобально через CDN

/**
 * SaveManager — заглушка (сохранения отключены).
 *
 * Игра одноразовая (для демонстрации), поэтому сохранения не используются.
 * Все методы возвращают no-op/false/null, чтобы не раздувать localStorage.
 *
 * Сохраняет совместимость API со старым кодом, который вызывает saveGame/loadGame.
 */
export default class SaveManager {
    constructor(scene = null) {
        this.scene = scene;
        this.events = new Phaser.Events.EventEmitter();
        // Очищаем любые старые сохранения при запуске
        try {
            localStorage.removeItem('gameSaveData');
        } catch (e) { /* noop */ }
    }

    _emit(eventName, payload) {
        if (this.events) this.events.emit(eventName, payload);
    }

    /**
     * No-op: сохранение отключено.
     */
    saveGame(slotId, gameState, saveName = '') {
        // Сохранение отключено — игра одноразовая
        return true;
    }

    /**
     * No-op: загрузка отключена.
     */
    loadGame(slotId) {
        return null;
    }

    getAllSaves() {
        return new Array(3).fill(null);
    }

    getSaveInfo(slotId) {
        return null;
    }

    getAllSaveInfo() {
        return [null, null, null];
    }

    deleteSave(slotId) {
        return true;
    }

    isSlotEmpty(slotId) {
        return true;
    }

    startAutoSave(saveCallback) {
        // no-op
    }

    stopAutoSave() {
        // no-op
    }

    setAutoSaveInterval(interval) {
        // no-op
    }

    setAutoSaveEnabled(enabled) {
        // no-op
    }

    clearAllSaves() {
        try {
            localStorage.removeItem('gameSaveData');
        } catch (e) { /* noop */ }
        return true;
    }

    destroy() {
        if (this.events) {
            this.events.removeAllListeners();
            this.events = null;
        }
        this.scene = null;
    }
}

import Phaser from 'phaser';

/**
 * ScoreManager — система очков и статистики
 * Управляет очками, уровнями, достижениями и прочей статистикой
 *
 * События:
 * - score-changed: { score, delta, highScore }
 * - highscore-changed: { highScore }
 * - level-changed: { level }
 * - combo-changed: { combo, maxCombo }
 * - achievement-unlocked: { id, name }
 * - score-reset: { score, level, combo }
 */
export default class ScoreManager {
    constructor(scene = null) {
        this.scene = scene;
        this.registry = scene?.registry ?? null;
        this.events = new Phaser.Events.EventEmitter();

        // Локальное сохранение с дросселированием: чтобы избежать подвисаний от частой записи в localStorage
        this._saveTimer = null;
        this._saveDelayMs = 400;
        this._boundFlushSave = () => this.flushSaveData();

        if (this.scene?.events && typeof this.scene.events.once === 'function') {
            this.scene.events.once('shutdown', this._boundFlushSave);
        }
        if (typeof window !== 'undefined' && window?.addEventListener) {
            // pagehide надёжнее срабатывает при сворачивании вкладки/браузера
            window.addEventListener('pagehide', this._boundFlushSave);
        }

        this.currentScore = 0;
        this.highScore = 0;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;

        // Статистика
        this.statistics = {
            totalGamesPlayed: 0,
            totalScore: 0,
            totalPlayTime: 0, // секунды
            achievements: []
        };

        this.loadData();
        this._syncRegistryAll();
    }

    _emit(eventName, payload) {
        if (this.events) {
            this.events.emit(eventName, payload);
        }
    }

    _syncRegistryAll() {
        if (!this.registry) return;
        this.registry.set('score.current', this.currentScore);
        this.registry.set('score.high', this.highScore);
        this.registry.set('score.level', this.level);
        this.registry.set('score.combo', this.combo);
        this.registry.set('score.maxCombo', this.maxCombo);
    }

    /**
     * Загрузить данные из локального хранилища
     */
    loadData() {
        try {
            const data = localStorage.getItem('gameScoreData');
            if (data) {
                const parsed = JSON.parse(data);
                this.highScore = parsed.highScore || 0;
                this.statistics = parsed.statistics || this.statistics;
            }
        } catch (error) {
            console.error('Failed to load score data:', error);
        }
    }

    _scheduleSaveData() {
        if (this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._persistNow();
        }, this._saveDelayMs);
    }

    _persistNow() {
        try {
            const data = {
                highScore: this.highScore,
                statistics: this.statistics
            };
            localStorage.setItem('gameScoreData', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save score data:', error);
        }
    }

    /**
     * Сохранить данные в локальное хранилище (с дросселированием)
     */
    saveData() {
        this._scheduleSaveData();
    }

    /**
     * Немедленно записать на диск (при смене сцены/закрытии страницы)
     */
    flushSaveData() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this._persistNow();
    }

    /**
     * Добавить очки
     * @param {number} points - количество добавляемых очков
     * @param {number} multiplier - множитель очков (необязательно)
     */
    addScore(points, multiplier = 1) {
        const addedPoints = Math.floor(points * multiplier);
        if (!Number.isFinite(addedPoints) || addedPoints === 0) {
            return;
        }

        this.currentScore += addedPoints;
        this.statistics.totalScore += addedPoints;

        // Проверяем, побит ли рекорд
        const prevHigh = this.highScore;
        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
        }

        this._syncRegistryAll();

        this._emit('score-changed', {
            score: this.currentScore,
            delta: addedPoints,
            highScore: this.highScore
        });

        if (this.highScore !== prevHigh) {
            this._emit('highscore-changed', { highScore: this.highScore });
        }

        this.saveData();
    }

    /**
     * Сбросить текущие очки
     */
    resetScore() {
        const prevScore = this.currentScore;
        const prevLevel = this.level;
        const prevCombo = this.combo;

        this.currentScore = 0;
        this.level = 1;
        this.combo = 0;

        this._syncRegistryAll();

        if (prevScore !== 0) {
            this._emit('score-changed', { score: 0, delta: -prevScore, highScore: this.highScore });
        }
        if (prevLevel !== 1) {
            this._emit('level-changed', { level: this.level });
        }
        if (prevCombo !== 0) {
            this._emit('combo-changed', { combo: this.combo, maxCombo: this.maxCombo });
        }

        this._emit('score-reset', { score: this.currentScore, level: this.level, combo: this.combo });
    }

    /**
     * Увеличить комбо
     */
    increaseCombo() {
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }

        this._syncRegistryAll();
        this._emit('combo-changed', { combo: this.combo, maxCombo: this.maxCombo });
    }

    /**
     * Сбросить комбо
     */
    resetCombo() {
        this.combo = 0;
        this._syncRegistryAll();
        this._emit('combo-changed', { combo: this.combo, maxCombo: this.maxCombo });
    }

    /**
     * Получить множитель комбо
     * @returns {number}
     */
    getComboMultiplier() {
        if (this.combo < 5) return 1;
        if (this.combo < 10) return 1.5;
        if (this.combo < 20) return 2;
        return 3;
    }

    /**
     * Повысить уровень
     */
    levelUp() {
        this.level++;
        this._syncRegistryAll();
        this._emit('level-changed', { level: this.level });
    }

    /**
     * Установить уровень
     * @param {number} level - уровень
     */
    setLevel(level) {
        const next = Math.max(1, Math.floor(level));
        if (next === this.level) return;
        this.level = next;
        this._syncRegistryAll();
        this._emit('level-changed', { level: this.level });
    }

    /**
     * Применить состояние игры из «сохранения/снимка» к текущему состоянию
     * (не изменяет накопительную статистику totalScore)
     * @param {{score?: number, level?: number, combo?: number, maxCombo?: number, highScore?: number}} gameState
     */
    applyGameState(gameState = {}) {
        const prevScore = this.currentScore;
        const prevLevel = this.level;
        const prevCombo = this.combo;
        const prevMaxCombo = this.maxCombo;
        const prevHighScore = this.highScore;

        if (Number.isFinite(gameState.score)) {
            this.currentScore = Math.max(0, Math.floor(gameState.score));
        }
        if (Number.isFinite(gameState.level)) {
            this.level = Math.max(1, Math.floor(gameState.level));
        }
        if (Number.isFinite(gameState.combo)) {
            this.combo = Math.max(0, Math.floor(gameState.combo));
        }
        if (Number.isFinite(gameState.maxCombo)) {
            this.maxCombo = Math.max(0, Math.floor(gameState.maxCombo));
        }
        if (Number.isFinite(gameState.highScore)) {
            this.highScore = Math.max(0, Math.floor(gameState.highScore));
        }

        // Самосогласованные ограничения
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
        }

        this._syncRegistryAll();

        if (this.currentScore !== prevScore) {
            this._emit('score-changed', {
                score: this.currentScore,
                delta: this.currentScore - prevScore,
                highScore: this.highScore
            });
        }
        if (this.highScore !== prevHighScore) {
            this._emit('highscore-changed', { highScore: this.highScore });
            // highScore — сохраняемая величина, после применения снимка тоже записываем
            this.saveData();
        }
        if (this.level !== prevLevel) {
            this._emit('level-changed', { level: this.level });
        }
        if (this.combo !== prevCombo || this.maxCombo !== prevMaxCombo) {
            this._emit('combo-changed', { combo: this.combo, maxCombo: this.maxCombo });
        }
    }

    getCurrentScore() {
        return this.currentScore;
    }

    getHighScore() {
        return this.highScore;
    }

    getLevel() {
        return this.level;
    }

    getCombo() {
        return this.combo;
    }

    /**
     * Начать новую игру
     */
    startNewGame() {
        this.resetScore();
        this.statistics.totalGamesPlayed++;
        this.saveData();
    }

    /**
     * Завершить игру
     */
    endGame() {
        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
        }
        this._syncRegistryAll();
        this.saveData();
    }

    /**
     * Разблокировать достижение
     * @param {string} achievementId - ID достижения
     * @param {string} achievementName - имя достижения
     */
    unlockAchievement(achievementId, achievementName) {
        if (!this.statistics.achievements.includes(achievementId)) {
            this.statistics.achievements.push(achievementId);
            this._emit('achievement-unlocked', { id: achievementId, name: achievementName });
            this.saveData();
        }
    }

    hasAchievement(achievementId) {
        return this.statistics.achievements.includes(achievementId);
    }

    /**
     * Добавить игровое время
     * @param {number} seconds - секунды
     */
    addPlayTime(seconds) {
        const s = Number(seconds);
        if (!Number.isFinite(s) || s <= 0) return;
        this.statistics.totalPlayTime += s;
        this.saveData();
    }

    getStatistics() {
        return {
            ...this.statistics,
            highScore: this.highScore,
            maxCombo: this.maxCombo
        };
    }

    /**
     * Сбросить все данные
     */
    resetAllData() {
        this.currentScore = 0;
        this.highScore = 0;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.statistics = {
            totalGamesPlayed: 0,
            totalScore: 0,
            totalPlayTime: 0,
            achievements: []
        };

        this._syncRegistryAll();
        this._emit('score-reset', { score: this.currentScore, level: this.level, combo: this.combo });
        this._emit('highscore-changed', { highScore: this.highScore });

        this.saveData();
    }

    destroy() {
        // Стараемся гарантировать последнюю запись на диск
        this.flushSaveData();

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

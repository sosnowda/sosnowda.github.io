/**
 * Утилитарный класс процедурных звуковых эффектов (WebAudio):
 * тоны, свипы и шум синтезируются на лету, без аудио-ассетов.
 * Используется AudioManager как процедурный фолбэк реальных SFX
 * (_playRealSfx передаёт имя метода сюда, если ассет не загружен).
 * Оптимизировано по CPU (кэширование шума), планированию времени (игровые часы)
 * и управлению жизненным циклом (авто-очистка при уничтожении сцены)
 */
export class AudioEffects {
    constructor(scene) {
        this.scene = scene;
        this.context = scene.sound.context;
        this.sfxVolume = 1.0;
        
        // Управление состоянием
        this.lastPlayTime = new Map();
        this.cooldownTime = new Map();
        
        // Оптимизация 1: кэшируем буфер белого шума, чтобы не пересчитывать случайные числа при каждом createBuffer
        this.sharedNoiseBuffer = null; 

        // Инициализация конфигурации
        this.setupEffectLimits();

        // Оптимизация 2: привязка к жизненному циклу — авто-очистка при уничтожении сцены
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    setupEffectLimits() {
        // Устанавливаем время задержки (мс) — чтобы звук не играл слишком часто
        this.cooldownTime.set('buttonClick', 100);     // задержка клика по кнопке 100мс
        this.cooldownTime.set('buttonHover', 50);      // задержка наведения на кнопку 50мс
        this.cooldownTime.set('collect', 50);          // задержка сбора предмета 50мс
        this.cooldownTime.set('shoot', 80);            // задержка выстрела 80мс
        this.cooldownTime.set('jump', 200);            // задержка прыжка 200мс
        this.cooldownTime.set('landing', 300);         // задержка приземления 300мс
        this.cooldownTime.set('typewriter', 30);       // задержка печатной машинки 30мс
    }

    _ensureNoiseBuffer(seconds = 2) {
        // Если кэш уже есть — пропускаем
        if (this.sharedNoiseBuffer) return;
        if (!this.context) return;

        // Моно-буфер белого шума (длины с запасом для зацикливания длинных эффектов)
        const bufferSize = Math.floor(this.context.sampleRate * seconds);
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        // Заполняем случайным шумом
        for (let i = 0; i < bufferSize; i++) {
            // Math.random() * 2 - 1 даёт значения от -1 до 1
            data[i] = Math.random() * 2 - 1;
        }

        this.sharedNoiseBuffer = buffer;
    }

    destroy() {
        // Очищаем кэш (опционально; если нужно переиспользовать между сценами — сохраните в глобальной области)
        this.sharedNoiseBuffer = null;
        this.scene = null;
        this.context = null;
    }

    canPlayEffect(effectName) {
        const now = this.scene.time.now; // Совет: используем игровое время, а не системное Date.now()
        const lastTime = this.lastPlayTime.get(effectName) || 0;
        const cooldown = this.cooldownTime.get(effectName) || 0;
        
        if (now - lastTime >= cooldown) {
            this.lastPlayTime.set(effectName, now);
            return true;
        }
        return false;
    }

    // ==========================================
    //  Общие вспомогательные методы (Timer Helper)
    // ==========================================
    /**
     * Оптимизация 2: отложенный вызов по игровым часам Phaser
     * Гарантирует, что звуковая последовательность тоже паузится при паузе игры и автоматически отменяется при уничтожении сцены
     */
    delay(ms, callback) {
        if (!this.scene) return;
        this.scene.time.delayedCall(ms, callback, [], this);
    }

    // ==========================================
    //  Конкретные реализации звуков (с применением оптимизации delay)
    // ==========================================

    /**
     * 1. Звук клика по кнопке
     * Сценарии: клик UI-кнопки, выбор в меню, подтверждение действия
     */
    playButtonClick() {
        if (!this.canPlayEffect('buttonClick')) return;

        // Основной тон: 600Гц синус, короткий и мягкий
        this.generateTone(600, 0.05, 0.2, 'sine');
    }

    /**
     * 2. Звук наведения на кнопку
     * Сценарии: наведение курсора на кнопку, подсветка пункта меню
     */
    playButtonHover() {
        if (!this.canPlayEffect('buttonHover')) return;
        this.generateTone(600, 0.05, 0.2, 'sine');
    }

    /**
     * 3. Звук печатной машинки
     * Сценарии: посимвольное отображение текста в сюжетном диалоге
     */
    playTypewriter() {
        if (!this.canPlayEffect('typewriter')) return;
        if (!this.context) return;

        this._ensureNoiseBuffer();
        if (!this.sharedNoiseBuffer) return;

        const ctx = this.context;
        const t = ctx.currentTime;

        const source = ctx.createBufferSource();
        source.buffer = this.sharedNoiseBuffer;

        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        // --- Точка изменения 1: Highpass (верхний пропуск) заменили на Lowpass (нижний пропуск) ---
        // Highpass оставляет резкие «ш-ш-ш», из-за чего звук трещит.
        // Lowpass срезает высокие частоты, оставляя глухое «тук-тук», похожее на каплю чернил на бумаге.
        filter.type = 'lowpass';
        filter.frequency.value = 1500 + Math.random() * 200; // около 800Гц, глухо и не резко

        // --- Точка изменения 2: заметно снижаем громкость ---
        // Энергия белого шума велика, 0.4 действительно слишком громко; 0.1–0.15 подходит лучше
        // Если всё ещё громко — можно снизить до 0.05
        const volume = 0.15 * this.sfxVolume; 

        // Соединяем узлы
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        // Слегка случайная скорость воспроизведения (0.8 ~ 1.2)
        source.playbackRate.setValueAtTime(0.8 + Math.random() * 0.4, t);

        // --- Точка изменения 3: сокращаем длительность ---
        // С 0.04 до 0.025 — звук очень короткий, чище
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025); 

        source.start(t);
        source.stop(t + 0.03); // чуть больше буфера, чтобы не обрезать с хлопком
    }

    /**
     * 4. Звук сбора предмета
     * Сценарии: подбор монет, предметов, сфер энергии, опыта
     */
    playCollectItem() {
        if (!this.canPlayEffect('collect')) return;
        const frequencies = [523, 659, 784]; // аккорд C-E-G
        frequencies.forEach((freq, index) => {
            this.delay(index * 50, () => this.generateTone(freq, 0.1, 0.4, 'sine'));
        });
    }

    /**
     * 4. Звук прыжка
     * Сценарии: прыжок персонажа, отскок, пружинная платформа
     */
    playJump() {
        if (!this.canPlayEffect('jump')) return;
        this.generateSweep(200, 600, 0.2, 0.5, 'square');
    }

    /**
     * 5. Звук приземления
     * Сценарии: приземление персонажа, падение предмета, удар о землю
     */
    playLanding() {
        if (!this.canPlayEffect('landing')) return;
        // Сверхнизкочастотный удар — более глухой базовый тон
        this.generateTone(40, 0.25, 0.9, 'square');
        
        // Низкочастотный шумовой удар — более плотное ощущение удара
        this.generateNoise(0.3, 0.7, 80);
        
        // Субнизкочастотный слой — добавляет толщины
        this.delay(80, () => this.generateTone(55, 0.15, 0.4, 'triangle'));
        
        // Лёгкая высокая частота — немного чёткости, но очень тихо
        this.delay(100, () => this.generateTone(120, 0.03, 0.15, 'sine'));
        
        // Глубокая остаточная вибрация — продлённый низкочастотный гул
        this.delay(150, () => this.generateTone(35, 0.2, 0.5, 'sine'));
    }

    /**
     * 6. Звук выстрела
     * Сценарии: выпуск пули, лазерное оружие, выстрел из лука
     */
    playShoot() {
        if (!this.canPlayEffect('shoot')) return;
        // Оптимизация 3: добавляем микро-случайность тона (detune), чтобы очередь звучала естественнее
        const detune = Phaser.Math.Between(-100, 100);
        
        this.generateTone(150, 0.05, 0.6, 'sawtooth', detune);
        this.delay(20, () => this.generateNoise(0.02, 0.4, 200));
    }

    /**
     * 7. Звук взрыва
     * Сценарии: взрыв бомбы, взрыв ракеты, эффект разрушения
     */
    playExplosion() {
        // Низкочастотная ударная волна
        this.generateTone(30, 0.4, 0.8, 'square');
        
        // Среднечастотный хлопок
        this.delay(50, () => this.generateNoise(0.3, 0.9, 500));
        
        // Высокочастотные осколки
        this.delay(100, () => {
            for (let i = 0; i < 8; i++) {
                this.delay(i * 20, () => {
                    const freq = 800 + Math.random() * 1200;
                    this.generateTone(freq, 0.05, 0.3, 'sawtooth');
                });
            }
        });
    }

    /**
     * 8. Звук победы
     * Сценарии: завершение уровня, успех задания, получение достижения
     */
    playVictory() {
        const frequencies = [440, 554, 659, 880]; // аккорд A-C#-E-A
        frequencies.forEach((freq, index) => {
            this.delay(index * 80, () => this.generateTone(freq, 0.15, 0.3, 'sine'));
        });
    }

    /**
     * 9. Звук повышения уровня
     * Сценарии: повышение уровня персонажа, разблокировка навыка, рост характеристик
     */
    playLevelUp() {
        const melody = [523, 659, 784, 1047]; // восходящая гамма C-E-G-C
        melody.forEach((freq, index) => {
            this.delay(index * 100, () => this.generateTone(freq, 0.2, 0.4, 'sine'));
        });
    }







    // ==========================================
    //  Базовые генераторы (Core Generators)
    // ==========================================

    /**
     * Общее ядро тона/свипа: осциллятор + огибающая громкости на мастер-шине Phaser.
     * generateTone/generateSweep — два фасада одного конвейера (снизит дублирование).
     * @param {number} startFreq - начальная частота (Гц)
     * @param {number|null} endFreq - конечная частота свипа (null — без свипа)
     * @param {number} duration - длительность (сек)
     * @param {number} volume - громкость (0-1)
     * @param {string} waveType - тип волны ('sine', 'square', 'sawtooth', 'triangle')
     * @param {number} detune - подстройка тона (центы), по умолчанию 0
     */
    _oscTone({ startFreq, endFreq = null, duration, volume, waveType, detune = 0 }) {
        // Если аудиосистема Phaser заблокирована (нет взаимодействия) или отключена — не воспроизводим
        if (this.scene.sound.locked || !this.context) return;

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);

        // Подключаем к узлу Master Volume от Phaser, а не к destination:
        // общая громкость музыки/SFX применяется Phaser'ом
        gainNode.connect(this.scene.sound.masterVolumeNode);

        oscillator.type = waveType;

        // Применяем подстройку тона
        if (detune !== 0) {
            oscillator.detune.setValueAtTime(detune, this.context.currentTime);
        }

        const now = this.context.currentTime;
        oscillator.frequency.setValueAtTime(startFreq, now);
        if (endFreq !== null) {
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        }

        // volume умножается только на sfxVolume: masterVolume применит Phaser
        const finalVolume = volume * this.sfxVolume;

        // Защита от хлопка: быстрое нарастание (0.005с) вместо прямой установки в 0
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(finalVolume, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);

        // Отключаем соединение после воспроизведения — помогает сборщику мусора
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }

    /**
     * Сгенерировать базовый тон
     * @param {number} frequency - частота (Гц)
     * @param {number} duration - длительность (сек)
     * @param {number} volume - громкость (0-1)
     * @param {string} waveType - тип волны ('sine', 'square', 'sawtooth', 'triangle')
     * @param {number} detune - подстройка тона (центы), по умолчанию 0
     */
    generateTone(frequency, duration, volume = 0.5, waveType = 'sine', detune = 0) {
        this._oscTone({ startFreq: frequency, duration, volume, waveType, detune });
    }

    /**
     * Сгенерировать сканирующий звук (sweep)
     * @param {number} startFreq - начальная частота
     * @param {number} endFreq - конечная частота
     * @param {number} duration - длительность
     * @param {number} volume - громкость
     * @param {string} waveType - тип волны
     * @param {number} detune - подстройка тона (центы), по умолчанию 0
     */
    generateSweep(startFreq, endFreq, duration, volume = 0.5, waveType = 'sine', detune = 0) {
        this._oscTone({ startFreq, endFreq, duration, volume, waveType, detune });
    }

    /**
     * Сгенерировать шумовой эффект
     * @param {number} duration - длительность
     * @param {number} volume - громкость
     * @param {number} filterFreq - частота фильтра
     * @param {boolean} highpass - использовать ли фильтр верхних частот
     */
    generateNoise(duration, volume = 0.5, filterFreq = 1000, highpass = false) {
        if (this.scene.sound.locked || !this.context) return;

        // Единый кэш шума с _ensureNoiseBuffer — дублирующая генерация убрана
        this._ensureNoiseBuffer();
        if (!this.sharedNoiseBuffer) return;

        const bufferSource = this.context.createBufferSource();
        bufferSource.buffer = this.sharedNoiseBuffer;
        
        // Если требуемая длительность больше длины буфера — включаем зацикливание
        if (duration > bufferSource.buffer.duration) {
            bufferSource.loop = true;
        }

        const gainNode = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        filter.type = highpass ? 'highpass' : 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, this.context.currentTime);

        bufferSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.scene.sound.masterVolumeNode);

        const now = this.context.currentTime;
        const finalVolume = volume * this.sfxVolume;

        // Защита от хлопка: быстрое нарастание
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(finalVolume, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        bufferSource.start(now);
        bufferSource.stop(now + duration);

        bufferSource.onended = () => {
            bufferSource.disconnect();
            filter.disconnect();
            gainNode.disconnect();
        };
    }

    // ==========================================
    //  Служебные методы (Utility Methods)
    // ==========================================

    /**
     * Установить громкость звуковых эффектов
     */
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Получить громкость звуковых эффектов
     */
    getSfxVolume() {
        return this.sfxVolume;
    }

    /**
     * Проверить состояние аудиоконтекста
     */
    getAudioContextState() {
        return this.context ? this.context.state : 'unavailable';
    }
}

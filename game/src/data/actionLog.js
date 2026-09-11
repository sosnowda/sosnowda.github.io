// Система лога действий игрока.
// Записывает все значимые действия для финального экрана.
// Хранится в scene.registry по ключу 'actionLog'.

export class ActionLog {
    constructor() {
        this.entries = [];
        this.startTime = Date.now();
    }

    static init(registry) {
        if (!registry.get('actionLog')) {
            registry.set('actionLog', new ActionLog());
        }
        return registry.get('actionLog');
    }

    static get(registry) {
        return registry.get('actionLog');
    }

    static add(registry, action, details = {}) {
        const log = ActionLog.get(registry);
        if (!log) return;
        log.entries.push({
            time: Date.now() - log.startTime,
            action,
            details,
        });
    }

    /**
     * Получить все записи лога.
     */
    getAll() {
        return this.entries;
    }

    /**
     * Получить отформатированный текст лога для финального экрана.
     */
    getFormattedText() {
        return this.entries.map((e) => {
            const sec = Math.floor(e.time / 1000);
            const min = Math.floor(sec / 60);
            const s = sec % 60;
            const timeStr = `${min}:${s.toString().padStart(2, '0')}`;
            return `[${timeStr}] ${e.action}`;
        });
    }

    /**
     * Подсчитать итоговую оценку на основе действий.
     * Возвращает { score, stars, title, comment }.
     * Параметр finalOutcome: 'victory' | 'defeat_thief_escaped' | 'defeat_hero_dead' —
     * итоговый результат игры (из quest). Имеет приоритет над логом.
     */
    getRating(finalOutcome = null) {
        const total = this.entries.length;
        // Подсчитываем разные типы действий
        const searches = this.entries.filter(e => e.action.includes('Поиск') || e.action.includes('следы')).length;
        const talks = this.entries.filter(e => e.action.includes('Поговорил') || e.action.includes('Спросил')).length;
        const failed = this.entries.filter(e => e.action.includes('провал') || e.action.includes('не удалось')).length;
        const found = this.entries.filter(e => e.action.includes('нашёл') || e.action.includes('нашла') || e.action.includes('НАЙДЕН')).length;

        // Определяем исход игры
        let isVictory = false;
        let isEscaped = false;
        let isHeroDead = false;
        if (finalOutcome === 'victory') isVictory = true;
        else if (finalOutcome === 'defeat_thief_escaped') isEscaped = true;
        else if (finalOutcome === 'defeat_hero_dead') isHeroDead = true;
        else {
            // Fallback на лог
            isVictory = this.entries.some(e => e.action.includes('ПОБЕДА'));
            isEscaped = this.entries.some(e => e.action.includes('сбежал'));
            isHeroDead = this.entries.some(e => e.action.includes('пал в бою'));
        }

        let stars = 0;
        let title = '';
        let comment = '';

        if (isVictory) {
            // Победа — оцениваем эффективность
            if (total <= 8 && failed === 0) {
                stars = 5; title = 'Идеальный сыщик';
                comment = 'Молниеносное расследование без единой ошибки!';
            } else if (total <= 12 && failed <= 1) {
                stars = 4; title = 'Опытный следопыт';
                comment = 'Быстро и уверенно нашли вора. Отличная работа.';
            } else if (total <= 18) {
                stars = 3; title = 'Старательный путник';
                comment = 'Победа досталась трудом, но цель достигнута.';
            } else {
                stars = 2; title = 'Упорный, но медленный';
                comment = 'Еле успели поймать вора. В следующий раз будьте расторопнее.';
            }
        } else if (isEscaped) {
            stars = 1; title = 'Вор ушёл';
            comment = 'Вор успел скрыться. Стоило действовать быстрее и собирать улики внимательнее.';
        } else if (isHeroDead) {
            stars = 0; title = 'Путник пал';
            comment = 'Герой погиб в бою. Тренируйте воинское мастерство.';
        } else {
            stars = 0; title = 'Игра прервана';
            comment = 'Игра не была завершена.';
        }

        return {
            stars,
            title,
            comment,
            stats: {
                total,
                searches,
                talks,
                failed,
                found,
                victory: isVictory,
                defeat: isEscaped || isHeroDead,
            },
        };
    }
}

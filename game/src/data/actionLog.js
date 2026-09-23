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
        // Раунд 57 (EN-глубинные тексты): летопись пишется НА ЯЗЫКЕ СЕССИИ —
        // ключевые слова двуязычные (RU + EN), оценка работает в обоих режимах.
        const has = (e, words) => words.some(w => e.action.includes(w));
        const searches = this.entries.filter(e => has(e, ['Поиск', 'следы', 'Search', 'traces', 'footprints'])).length;
        const talks = this.entries.filter(e => has(e, ['Поговорил', 'Спросил', 'Talked', 'Asked'])).length;
        const failed = this.entries.filter(e => has(e, ['провал', 'не удалось', 'failed'])).length;
        const found = this.entries.filter(e => has(e, ['нашёл', 'нашла', 'НАЙДЕН', 'found', 'FOUND'])).length;

        // Определяем исход игры
        let isVictory = false;
        let isEscaped = false;
        let isHeroDead = false;
        let isRepVictory = false;
        let isMarriageVictory = false;
        let isExpelled = false;
        let isElderMurdered = false;
        if (finalOutcome === 'victory') isVictory = true;
        else if (finalOutcome === 'victory_reputation') { isVictory = true; isRepVictory = true; }
        // Раунд 66.11 (приказ владельца): свадьба — ВЫИГРЫШ и конец игры
        else if (finalOutcome === 'victory_marriage') { isVictory = true; isMarriageVictory = true; }
        else if (finalOutcome === 'defeat_thief_escaped') isEscaped = true;
        else if (finalOutcome === 'defeat_hero_dead') isHeroDead = true;
        // Раунд 45 (п.2): изгнание за дурную славу — отдельный исход
        else if (finalOutcome === 'defeat_expelled') isExpelled = true;
        // Раунд 46 (п.2): убийство старосты — немедленный Проигрыш
        else if (finalOutcome === 'defeat_elder_murdered') { isExpelled = true; isElderMurdered = true; }
        else {
            // Fallback на лог (ключевые слова двуязычные — раунд 57)
            isVictory = this.entries.some(e => has(e, ['ПОБЕДА', 'VICTORY']));
            isEscaped = this.entries.some(e => has(e, ['сбежал', 'escaped']));
            isHeroDead = this.entries.some(e => has(e, ['пал в бою', 'fell in battle']));
            isExpelled = this.entries.some(e => has(e, ['изгнан', 'expelled']));
        }

        let stars = 0;
        let title = '';
        let comment = '';

        if (isVictory && isMarriageVictory) {
            // Раунд 66.11 (приказ владельца): ЖЕНИТЬБА — ВЫИГРЫШ И КОНЕЦ ИГРЫ.
            // Оцениваем путь героя, приведший к венцу.
            if (total <= 20 && failed === 0) {
                stars = 5; title = 'Свадебный венец';
                comment = 'Икона возвращена, деревня полюбила — и свадебный звон венчает летопись. Безупречно!';
            } else if (total <= 34) {
                stars = 4; title = 'Честь и семья';
                comment = 'Ты снискал любовь деревни и сердце одного из её жителей. Свадьба — награда за добрые дела.';
            } else {
                stars = 3; title = 'Долгая дорога к венцу';
                comment = 'Путь был долог, но свадебный каравай доехал: теперь у тебя семья и целый приход в родне.';
            }
        } else if (isVictory && isRepVictory) {
            // Раунд 36: репутационная победа — оцениваем путь добрых дел
            if (total <= 14 && failed === 0) {
                stars = 5; title = 'Душа деревни';
                comment = 'Ни одной ошибки, и весь приход любит тебя. Редкий дар!';
            } else if (total <= 24) {
                stars = 4; title = 'Свой человек';
                comment = 'Тебя приняли в деревню как родного: добрые дела и честный труд дороже золота.';
            } else {
                stars = 3; title = 'Долгий путь к доверию';
                comment = 'Любовь деревни снискивается годами — и ты её снискал.';
            }
        } else if (isVictory) {
            // Победа — оцениваем эффективность
            if (total <= 8 && failed === 0) {
                stars = 5; title = 'Идеальный следопыт';
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
        } else if (isExpelled && isElderMurdered) {
            // Раунд 46 (п.2): кровь старосты — худший из исходов
            stars = 0; title = 'Убийца судьи';
            comment = 'Поднять руку на старосту — вне закона: летопись такого героя обрывается позором.';
        } else if (isExpelled) {
            // Раунд 45 (п.2): изгнание из деревни (репутация −100)
            stars = 0; title = 'Изгнан';
            comment = 'Староста выгнал тебя на все четыре стороны: деревня не прощает крови и бесчестия.';
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

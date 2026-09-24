// Процедурный генератор заданий для деревни Руси XV века.
// Задания генерируются с учётом:
// - личности выдающего NPC (староста, священник, тавернщик, кузнец, крестьянин, вдова)
// - его реальных возможностей (какую награду может дать)
// - исторической достоверности (Русь 15 века)
// - реалистичного времени на выполнение (подготовка + дорога + выполнение)

import { ActionLog } from './actionLog.js';
import { ARMORS, WEAPONS } from '../systems/Character.js';
import { t, tf } from '../systems/i18n.js';
import { applyQuestFailurePenalty } from './reputation.js';
// Раунд 66.12 (п.5): сезонная привязка — зимой грибы/травы не выдаются
import { getSeason } from '../systems/TimeSystem.js';

// ============================================================
// БЛАГОСЛОВЕНИЕ (раунд 22, п.11)
// Священник в церкви даёт благословение: следующая проверка навыка
// (любая: поиск следов, расспрос, убеждение, оглушение, атака) проходит
// с +10 к шансу — но только ОДНА проверка.
// ============================================================

/** Есть ли у героя неиспользованное благословение. */
export function hasBlessing(registry) {
    const q = registry.get('quest') || {};
    return !!q.blessing;
}

/**
 * Применить благословение к проверке навыка. Если благословение есть —
 * оно расходуется и навык увеличивается на +10 (один раз!).
 * @returns {number} значение навыка для skillCheck
 */
export function consumeBlessing(registry, skillValue) {
    const q = registry.get('quest');
    if (q && q.blessing) {
        q.blessing = false;
        registry.set('quest', q);
        ActionLog.add(registry, t('✨ Благословение батюшки окрыляет: +10 к шансу этой проверки (единственный раз).'));
        return Math.min(95, (skillValue || 0) + 10);
    }
    return skillValue || 0;
}

// ============================================================
// СРОКИ ПОРУЧЕНИЙ (раунд 22, п.15)
// Время поручений течёт вместе с мировым временем: каждый тик (15 минут)
// приближает срок. Просроченное поручение проваливается.
// Главный квест (погоня за вором) живёт по своим правилам и не сгорает.
// ============================================================

/**
 * Вызывается из TimeSystem.tickTime на каждое изменение времени.
 * @param {Object} registry — Phaser registry
 * @param {number} minutes — сколько игровых минут прошло
 */
export function tickQuestTime(registry, minutes) {
    const q = registry.get('quest');
    if (!q || !q.activeQuests || q.activeQuests.length === 0) return;
    let changed = false;
    q.activeQuests.forEach(quest => {
        if (quest.completed || quest.failed || quest.rewardClaimed || quest.isMainQuest) return;
        quest.minutesDone = (quest.minutesDone || 0) + (minutes || 0);
        changed = true;
        const limitMinutes = (quest.timeLimit || 10) * 15;
        if (quest.minutesDone > limitMinutes) {
            quest.failed = true;
            ActionLog.add(registry, tf(t('⌛ Поручение «{0}» просрочено! Срок вышел, а дело не сделано.'), quest.title));
            // Раунд 43: журнал обещает штраф за провал — теперь он реально
            // применяется к репутации заказчика (лёгкое −3, среднее −8, тяжёлое −15).
            const failPenalty = applyQuestFailurePenalty(registry, quest.npcId, quest.difficulty);
            ActionLog.add(registry, tf(t('Репутация упала на {0} за просрочку.'), Math.abs(failPenalty)));
            // РАУНД 62 (п.7): если просрочено поручение с мечом старосты —
            // обещание «отпускается»: староста ещё раз может сулить меч
            // за новое тяжёлое дело (уникальность — по ВЫДАЧЕ, elderSwordGiven).
            if (quest.rewards && quest.rewards.some(r => r.id === 'sword' && r.uniqueFromElder)) {
                q.elderSwordPromised = false;
            }
        }
        // Раунд 66.12 (п.5): поручения с ОТРАБОТКОЙ (стража/примирение)
        // завершаются, когда отработано достаточно игрового времени.
        else if (quest.minMinutesDone && quest.minutesDone >= quest.minMinutesDone) {
            quest.completed = true;
            ActionLog.add(registry, tf(t('Поручение «{0}» выполнено! {1} ждёт тебя с наградой.'), quest.title, quest.npcName));
        }
    });
    if (changed) registry.set('quest', q);
}

// === ТИПЫ ЗАДАНИЙ (исторически достоверные для Руси XV века) ===
export const QUEST_TYPES = {
    // Боевые задания
    BANDIT: 'bandit',           // Избить лихих людей на большой дороге
    WOLF: 'wolf',               // Убить волка, задравшего скот
    THIEF_CATCH: 'thief_catch', // Поймать вора (главный квест)
    GUARD: 'guard',             // Постоять на страже ночью

    // Курьерские задания
    DELIVER: 'deliver',         // Доставить послание/грамоту
    FETCH: 'fetch',             // Принести предмет (травы, рыбу, дрова)

    // Ремесленные задания
    GATHER_HERBS: 'gather_herbs', // Собрать лекарственные травы
    FETCH_WOOD: 'fetch_wood',     // Принести дров на зиму
    FETCH_FISH: 'fetch_fish',     // Принести рыбы с реки

    // Социальные задания
    FIND_PERSON: 'find_person',   // Найти пропавшего человека
    ESCORT: 'escort',             // Сопроводить путника по большой дороге
    MEDIATE: 'mediate',           // Помирить соседей

    // Религиозные задания (только священник)
    ICON_RETURN: 'icon_return',   // Вернуть украденную икону (главный квест)
    CANDLE_FETCH: 'candle_fetch', // Принести воск для свечей
    PRAYER: 'prayer',             // Помолиться за больного
};

// === ШАБЛОНЫ ЗАДАНИЙ ПО NPC ===
// Каждый NPC может выдавать только те задания, которые соответствуют его роли
export const NPC_QUEST_POOLS = {
    elder: {
        // Староста — административные и охранные задания
        quests: [QUEST_TYPES.BANDIT, QUEST_TYPES.DELIVER, QUEST_TYPES.GUARD, QUEST_TYPES.MEDIATE, QUEST_TYPES.FIND_PERSON],
        // Награды: деньги + еда/трава
        rewardTypes: ['money', 'herb', 'food'],
        rewardScale: 1.5, // староста богаче
        description: 'староста',
    },
    priest: {
        // Священник — религиозные и моральные задания.
        // Раунд 66.12 (п.5): процедурный ICON_RETURN ИЗЪЯТ — главный квест
        // («вернуть икону») существует ТОЛЬКО в сюжете; раньше священник с
        // шансом 30% выдавал «повторную кражу иконы» поверх сюжета, а наградой
        // служила сама икона-предмет (логическая нелепость).
        quests: [QUEST_TYPES.CANDLE_FETCH, QUEST_TYPES.PRAYER, QUEST_TYPES.FIND_PERSON, QUEST_TYPES.MEDIATE],
        rewardTypes: ['blessing', 'herb', 'money'],
        rewardScale: 0.8, // священник беднее деньгами, но даёт духовные награды
        description: 'батюшка',
    },
    tavernkeeper: {
        // Тавернщик — курьерские и информационные
        quests: [QUEST_TYPES.DELIVER, QUEST_TYPES.FETCH, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['food', 'drink', 'money', 'herb'],
        rewardScale: 1.0,
        description: 'тавернщик',
    },
    blacksmith: {
        // Кузнец — ремесленные и боевые
        quests: [QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.BANDIT, QUEST_TYPES.GUARD, QUEST_TYPES.WOLF],
        rewardTypes: ['weapon', 'armor', 'money'],
        rewardScale: 1.2, // кузнец может выковать оружие
        description: 'кузнец',
    },
    peasant1: {
        // Крестьянин — простые бытовые задания.
        // Раунд 22: награда поднята (0.4 → 0.9) — боевые задания за 3 деньги
        // были нелогичны.
        quests: [QUEST_TYPES.WOLF, QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.ESCORT],
        rewardTypes: ['food', 'herb', 'money'],
        rewardScale: 0.9,
        description: 'крестьянин',
    },
    widow: {
        // Вдова — духовные и бытовые. Раунд 22: 0.3 → 0.7 (та же причина).
        quests: [QUEST_TYPES.PRAYER, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['herb', 'food', 'blessing'],
        rewardScale: 0.7,
        description: 'вдова',
    },
    // ============================================================
    // Раунд 43 (п.4 заявки): процедурные задания выдаёт КАЖДЫЙ взрослый
    // житель деревни (раньше — только 6 НПЦ: староста, батюшка, тавернщик,
    // кузнец, мельник и вдова). Пулы подобраны по роду занятий; дети
    // (kid1–kid9, 5–12 лет) поручений не дают — по возрасту.
    // ============================================================
    hunter: {
        // Охотник — лесные и боевые
        quests: [QUEST_TYPES.WOLF, QUEST_TYPES.BANDIT, QUEST_TYPES.FIND_PERSON, QUEST_TYPES.ESCORT],
        rewardTypes: ['food', 'money', 'herb'],
        rewardScale: 1.0,
        description: 'охотник',
    },
    guard: {
        // Стражник — охрана и порядок
        quests: [QUEST_TYPES.GUARD, QUEST_TYPES.BANDIT, QUEST_TYPES.DELIVER, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['money', 'food'],
        rewardScale: 1.0,
        description: 'стражник',
    },
    fisherman: {
        // Рыбак — река и мелкие дела
        quests: [QUEST_TYPES.FETCH_FISH, QUEST_TYPES.DELIVER, QUEST_TYPES.FETCH],
        rewardTypes: ['food', 'money'],
        rewardScale: 0.8,
        description: 'рыбак',
    },
    healer: {
        // Знахарка Февронья — травы и духовное
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.PRAYER, QUEST_TYPES.FIND_PERSON, QUEST_TYPES.MEDIATE],
        rewardTypes: ['herb', 'blessing', 'money'],
        rewardScale: 0.7,
        description: 'знахарка',
    },
    beekeeper1: {
        // Пахарь Тарас — двор и лес (в доме ещё и ульи пасечницы Марфы)
        quests: [QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.WOLF, QUEST_TYPES.DELIVER],
        rewardTypes: ['food', 'money', 'drink'],
        rewardScale: 0.8,
        description: 'пахарь',
    },
    shepherd1: {
        // Пастух Сила — стадо и околица
        quests: [QUEST_TYPES.FIND_PERSON, QUEST_TYPES.ESCORT, QUEST_TYPES.FETCH_WOOD],
        rewardTypes: ['food', 'money'],
        rewardScale: 0.7,
        description: 'пастух',
    },
    shepherd2: {
        // Пастушка Настасья — мелкие дела
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.MEDIATE],
        rewardTypes: ['food', 'herb', 'money'],
        rewardScale: 0.6,
        description: 'пастушка',
    },
    carpenter1: {
        // Плотник Микула — лес и подмога
        quests: [QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.DELIVER, QUEST_TYPES.GUARD],
        rewardTypes: ['money', 'food'],
        rewardScale: 1.0,
        description: 'плотник',
    },
    potter1: {
        // Гончар Игнат — дрова для горна и дела
        quests: [QUEST_TYPES.FETCH_WOOD, QUEST_TYPES.DELIVER, QUEST_TYPES.MEDIATE],
        rewardTypes: ['money', 'food'],
        rewardScale: 0.9,
        description: 'гончар',
    },
    weaver1: {
        // Ткачиха Пелагея — хозяйственные дела
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.FIND_PERSON],
        rewardTypes: ['money', 'food', 'herb'],
        rewardScale: 0.8,
        description: 'ткачиха',
    },
    shepherd_boy: {
        // Пастушок Ивашка (14) — посильные поручения подростка
        quests: [QUEST_TYPES.FETCH, QUEST_TYPES.GATHER_HERBS],
        rewardTypes: ['food', 'herb'],
        rewardScale: 0.5,
        description: 'пастушок',
    },
    elder_wife: {
        // Хозяйки — домашние дела (по домам мужей)
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.PRAYER, QUEST_TYPES.MEDIATE],
        rewardTypes: ['food', 'herb', 'money'],
        rewardScale: 0.7,
        description: 'хозяйка',
    },
    beekeeper_wife: {
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.FETCH, QUEST_TYPES.DELIVER],
        rewardTypes: ['food', 'herb'],
        rewardScale: 0.6,
        description: 'хозяйка',
    },
    carpenter_wife: {
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.FETCH, QUEST_TYPES.DELIVER],
        rewardTypes: ['food', 'herb'],
        rewardScale: 0.6,
        description: 'хозяйка',
    },
    potter_wife: {
        quests: [QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER, QUEST_TYPES.FETCH],
        rewardTypes: ['food', 'herb'],
        rewardScale: 0.6,
        description: 'хозяйка',
    },
    fisher_wife: {
        quests: [QUEST_TYPES.FETCH_FISH, QUEST_TYPES.GATHER_HERBS, QUEST_TYPES.DELIVER],
        rewardTypes: ['food', 'herb'],
        rewardScale: 0.6,
        description: 'хозяйка',
    },
};

// === ОПИСАНИЯ ЗАДАНИЙ (исторически достоверные) ===
const QUEST_TEMPLATES = {
    [QUEST_TYPES.BANDIT]: {
        title: 'Лихие люди на большой дороге',
        descriptions: [
            'На большой дороге засели лихие люди, грабят купцов. Прогони их, путник!',
            'Лихие люди обложили дорогу данью. Купцы боятся возить товар. Разберись с ними!',
            'Разбойничья ватага облюбовала лес у большой дороги. Уже три воза разграбили. Избей их!',
        ],
        objective: 'Избить лихих людей на большой дороге',
        location: 'road',
        combat: true,
        enemyKeys: ['bandit'],
        baseTime: 4, // 4 хода на выполнение (подготовка + дорога + бой)
        // РАУНД 61 (п.1): срок — реалистичный. Выследить и избить шайку —
        // дело не одного часа: сутки (24 ч). 1 действие = 15 минут.
        timeLimitHours: 24,
        // РАУНД 62 (п.7 приказа): разбойничье дело — САМОЕ ТЯЖЁЛОЕ в деревне
        // (difficulty: 'hard'). Только за такое дело кузнец выдаёт ДОСПЕХ,
        // а староста — свой ЕДИНСТВЕННЫЙ МЕЧ (см. generateRewards).
        difficulty: 'hard',
    },
    [QUEST_TYPES.WOLF]: {
        title: 'Волк задрал скот',
        descriptions: [
            'Волк-людоед завёлся в лесу, задрал уже двух телят. Убей его, пока не добрался до детей!',
            'Серый хищник таскает кур и ягнят. Крестьяне боятся в поле выходить. Избавь нас от него!',
            'Стая волков обнаглела — ходят у самых дворов. Прогони их от дворов и из леса!',
        ],
        objective: 'Убить волка в лесу',
        location: 'forest',
        combat: true,
        enemyKeys: ['wolf'],
        baseTime: 3,
        // РАУНД 61: выследить волка в лесу — полдня (12 ч)
        timeLimitHours: 12,
        difficulty: 'easy',
    },
    [QUEST_TYPES.THIEF_CATCH]: {
        title: 'Поймать вора-иконокрада',
        descriptions: [
            'Вор украл чудотворную икону из церкви! Найди его следы и верни святыню.',
        ],
        objective: 'Найти и поймать вора',
        location: 'any',
        combat: true,
        enemyKeys: ['thief'],
        baseTime: 12, // главный квест — больше времени
        timeLimitHours: 36, // отображается, но главный квест живёт по своим правилам (погоня)
        difficulty: 'hard',
        isMainQuest: true,
    },
    [QUEST_TYPES.GUARD]: {
        title: 'Стоять на страже',
        descriptions: [
            'Ночью у ворот неспокойно. Постой на страже, присмотри за околицей.',
            // РАУНД 61 (п.1): «разведка доносит» — анахронизм; на Руси XV века
            // о лихих людях узнавали от проезжих и купцов («слышно, шалят»).
            'Слышно, лихие люди по большой дороге шалят. Постой на страже у ворот до утра.',
        ],
        objective: 'Отстоять на страже у ворот',
        // Раунд 22: 'gate' не был достижим (поручение было НЕВЫПОЛНИМО) —
        // стража у ворот = дело деревенское, как и помирить соседей.
        location: 'village',
        combat: false,
        baseTime: 2,
        // РАУНД 61: ночная стража — от заката до утра ≈ 8 ч
        timeLimitHours: 8,
        difficulty: 'easy',
        // Раунд 66.12 (п.5): стража требует ОТРАБОТКИ — 6 игровых часов
        // (24 действия), иначе поручение «выполнялось» мгновенным визитом.
        minMinutesDone: 360,
    },
    [QUEST_TYPES.DELIVER]: {
        title: 'Доставить послание',
        descriptions: [
            'Отнеси грамоту старосте соседнего села. Срочно нужно передать весточку!',
            'Передай свёрток кузнецу в соседнюю деревню. Там его ждут.',
            // РАУНД 61 (п.1): раньше письмо адресовали отцу Савватию — НАШЕМУ
            // священнику, что живёт здесь же (поручение-дорога выходило нелепым).
            // Теперь — священник соседнего погоста.
            'Снеси грамоту священнику соседнего погоста — ведётся дело о меже, нужна его рука.',
        ],
        objective: 'Доставить послание адресату',
        location: 'road',
        combat: false,
        baseTime: 3,
        // РАУНД 61: соседнее село — туда-обратно пешком за световой день (12 ч).
        // Было 11 действий (≈3 ч) — «послание в соседнее село» сгорало раньше,
        // чем герой успевал дойти и вернуться (проверено прогона̄ми раунда 60).
        timeLimitHours: 12,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FETCH]: {
        title: 'Принести нужное',
        descriptions: [
            'Сходи в лес за грибами, да побольше — зима длинная будет!',
            'Принеси дров из лесу — печь топить нечем стало.',
            'Нужны сухие ветки да хворост. Загляни в лес, пока не стемнело.',
        ],
        objective: 'Принести требуемое из леса',
        location: 'forest',
        combat: false,
        baseTime: 2,
        timeLimitHours: 6,
        difficulty: 'easy',
    },
    [QUEST_TYPES.GATHER_HERBS]: {
        title: 'Собрать лекарственные травы',
        descriptions: [
            'Знахарке нужны травы: череда, зверобой, полынь. Собери их в лесу.',
            'Больная у меня корова — нужны лечебные травы. Поищи зверобой в лесу.',
            'На зиму травы запасти нужно. Собери в лесу полынь да ромашку.',
        ],
        objective: 'Собрать лекарственные травы',
        // Раунд 66.12 (п.5): травы собирают В ЛЕСУ (там и метка «Зверобой») —
        // раньше описание вело «у реки и в лесу», а зачёт шёл на поле.
        location: 'forest',
        combat: false,
        baseTime: 2,
        timeLimitHours: 6,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FETCH_WOOD]: {
        title: 'Заготовить дрова',
        descriptions: [
            'Зима близко, а дров мало. Наруби в лесу сухих дров и принеси.',
            'Кузнице нужны дрова для горна. Сходи в лес, набери сухостоя.',
        ],
        objective: 'Заготовить дрова в лесу',
        location: 'forest',
        combat: false,
        baseTime: 3,
        // РАУНД 61: нарубить и привезти воз дров — полдня работы (8 ч)
        timeLimitHours: 8,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FETCH_FISH]: {
        title: 'Наловить рыбы',
        descriptions: [
            'К столу нужна рыба. Порыбачь на реке — щуку или карасей.',
            'Постный день скоро, а рыбы нет. Налови на реке, да побольше.',
        ],
        objective: 'Наловить рыбы на реке',
        location: 'river',
        combat: false,
        baseTime: 2,
        timeLimitHours: 6,
        difficulty: 'easy',
    },
    [QUEST_TYPES.FIND_PERSON]: {
        title: 'Найти пропавшего',
        descriptions: [
            'Сын мой ушёл утром в лес и не вернулся. Найди его, прошу!',
            'Родич мой пошёл за дровами и пропал. Поищи его в лесу да по большой дороге.',
            'Подросток пропал — видели его последний раз у реки. Найди его!',
        ],
        objective: 'Найти пропавшего человека',
        location: 'any',
        combat: false,
        baseTime: 4,
        // РАУНД 61: искать человека — полдня до суток; ставим 12 ч
        timeLimitHours: 12,
        difficulty: 'medium',
    },
    [QUEST_TYPES.ESCORT]: {
        title: 'Сопроводить путника',
        descriptions: [
            'Купцу нужно дойти до соседнего села. Проводи его по большой дороге, там неспокойно.',
            // РАУНД 62 (п.8): монастыря НЕТ на карте местности — бабушку
            // провожают к родне в соседнее село (по большой дороге, как и было).
            'Старушка просится к дочери в соседнее село, боится одна идти. Проводи её по большой дороге.',
        ],
        objective: 'Сопроводить путника по большой дороге',
        location: 'road',
        combat: false,
        baseTime: 4,
        timeLimitHours: 12,
        difficulty: 'medium',
    },
    [QUEST_TYPES.MEDIATE]: {
        title: 'Помирить соседей',
        descriptions: [
            // РАУНД 61 (п.1): суд на Руси XV века — ВОЛОСТНОЙ (судит волостель),
            // не просто «суд». Уточнено для историчности.
            'Два соседа судятся из-за межи. Поговори с обоими — помири их, чтоб до волостного суда не дошло.',
            'Крестьяне поругались из-за покоса. Уговори их поделить луг по-братски.',
        ],
        objective: 'Помирить поссорившихся соседей',
        location: 'village',
        combat: false,
        baseTime: 2,
        timeLimitHours: 4,
        difficulty: 'easy',
        // Раунд 66.12 (п.5): мирить соседей — хотя бы час уговоров (4 действия),
        // иначе поручение «выполнялось» мгновенным визитом в деревню.
        minMinutesDone: 60,
    },
    [QUEST_TYPES.ICON_RETURN]: {
        title: 'Вернуть украденную икону',
        descriptions: [
            'Ночью вор забрался в церковь и украл чудотворную икону Богородицы. Это наша главная святыня! Найди вора и верни икону.',
        ],
        objective: 'Найти вора и вернуть икону',
        location: 'any',
        combat: true,
        enemyKeys: ['thief'],
        baseTime: 12,
        timeLimitHours: 36, // главный квест живёт по правилам погони
        difficulty: 'hard',
        isMainQuest: true,
    },
    [QUEST_TYPES.CANDLE_FETCH]: {
        title: 'Принести воск для свечей',
        descriptions: [
            'Свечи в церкви заканчиваются. Принеси воск с пасеки — там держат ульи.',
            'Для всенощной нужно много свечей. Сходи на пасеку, попроси воска.',
        ],
        objective: 'Принести воск для церковных свечей',
        // Раунд 22: воск берут на ПАСЕКЕ (было 'field' — описание не совпадало
        // с целью, и поручение путало игрока).
        location: 'apiary',
        combat: false,
        baseTime: 2,
        timeLimitHours: 4,
        difficulty: 'easy',
    },
    [QUEST_TYPES.PRAYER]: {
        title: 'Помолиться за больного',
        descriptions: [
            'Дитя занемогло. Пойди в церковь, поставь свечу за здравие раба Божьего.',
            'Муж болеет тяжко. Помолись за него в церкви, испроси у Господа исцеления.',
        ],
        objective: 'Помолиться в церкви за больного',
        location: 'church',
        combat: false,
        baseTime: 1,
        timeLimitHours: 2,
        difficulty: 'easy',
    },
};

// === НАГРАДЫ (зависят от NPC и типа задания) ===
// РАУНД 61 (п.1): ПЕРЕСЧЁТ ПО РЕАЛИЯМ РУСИ XV ВЕКА.
// Ориентир исторической цены: подённая работа крестьянина/работника —
// порядка 1–3 денег в день; деньга — мелкое серебро. Поэтому:
//   • лёгкое дело (грибы, травы, свеча) — 2–8 д. (небольшой приработок);
//   • среднее (проводник, поиски человека, стража) — ×1.5;
//   • тяжёлое (разбойники, шайка) — ×2.5.
// РАУНД 62 (п.7 приказа владельца) — ВООРУЖЕНИЕ И ДОСПЕХИ:
//   • ДОСПЕХ выдаёт ТОЛЬКО КУЗНЕЦ и ТОЛЬКО ЗА САМЫЕ ТЯЖЁЛЫЕ ЗАДАНИЯ
//     (разбойничье дело): кожаная броня или кольчуга его руки;
//   • МЕЧ — ВООБЩЕ НЕ ПРОДАЁТСЯ И НЕ КУЁТСЯ НА ЗАКАЗ: это УНИКАЛЬНАЯ
//     НАГРАДА ОТ СТАРОСТЫ (одна на игру, тоже за разбойничье дело);
//     сабля/стальной меч из оборота кузнеца убраны по той же причине.
// Возвращает массив наград: [{ type, id, name, count, ... }]
function generateRewards(npcId, questType, scale, registry) {
    const pool = NPC_QUEST_POOLS[npcId];
    if (!pool) return [];
    
    const rewards = [];
    const rewardTypes = pool.rewardTypes;
    const difficulty = QUEST_TEMPLATES[questType]?.difficulty || 'easy';
    const difficultyMult = difficulty === 'hard' ? 2.5 : (difficulty === 'medium' ? 1.5 : 1.0);
    const q = (registry && registry.get('quest')) || {};

    // Деньги (если NPC может давать деньги): база 3–8 д. (было 5–19 —
    // крестьянин платил за грибы полумесячный заработок)
    if (rewardTypes.includes('money')) {
        const baseAmount = Math.max(1, Math.round((3 + Math.floor(Math.random() * 6)) * scale * difficultyMult));
        rewards.push({ type: 'money', amount: baseAmount });
    }

    // Еда (хлеб, каша)
    if (rewardTypes.includes('food')) {
        rewards.push({ type: 'item', id: 'bread', name: t('Хлеб'), count: 1 + Math.floor(Math.random() * 2), consumable: true, heal: 2 });
    }

    // Питьё (медовуха, квас)
    if (rewardTypes.includes('drink') && Math.random() < 0.5) {
        rewards.push({ type: 'item', id: 'mead', name: t('Медовуха'), count: 1, consumable: true, mpHeal: 2 });
    }

    // Лечебная трава
    if (rewardTypes.includes('herb') && Math.random() < 0.6) {
        rewards.push({ type: 'item', id: 'herb', name: t('Целебная трава'), count: 1 + Math.floor(Math.random() * 2), consumable: true });
    }

    // Благословение/отвар (восстановление HP/MP). Раунд 66.12 (п.5):
    // «Благословение батюшки» — только у священника; вдова и знахарка
    // вручают свой травный отвар (сакральное — не их роль).
    if (rewardTypes.includes('blessing')) {
        const blessName = (npcId === 'priest')
            ? t('Благословение батюшки (полное восстановление)')
            : t('Травный отвар (полное восстановление)');
        rewards.push({ type: 'blessing', name: blessName });
    }

    // Икона (только за главный квест)
    if (rewardTypes.includes('icon') && questType === QUEST_TYPES.ICON_RETURN) {
        rewards.push({ type: 'item', id: 'icon', name: t('Чудотворная икона'), count: 1, quest: true });
    }

    // Оружие (кузнец может выковать) — РАУНД 62 (п.7): БЕЗ МЕЧЕЙ.
    //   easy   → нож (3 д.) / дубина (2 д.) — мелочь от щедрот;
    //   medium → боевой топор (25 д.) / копьё (8 д.);
    //   hard   → топор/копьё — лучшее из деревенской работы.
    // Меч (и сабля со стальным мечом) из выдачи УБРАНЫ: меч — уникальная
    // награда старосты (см. ниже).
    if (rewardTypes.includes('weapon')) {
        const weaponPoolByDiff = {
            easy: ['knife', 'club'],
            medium: ['axe', 'spear'],
            hard: ['axe', 'spear'],
        };
        const weaponPool = weaponPoolByDiff[difficulty] || weaponPoolByDiff.easy;
        const weaponId = weaponPool[Math.floor(Math.random() * weaponPool.length)];
        const weapon = WEAPONS[weaponId];
        if (weapon) {
            rewards.push({ type: 'item', id: weaponId, name: weapon.name, count: 1, weapon: true });
        }
    }

    // Доспех (кузнец куёт) — РАУНД 62 (п.7): ТОЛЬКО КУЗНЕЦ и ТОЛЬКО ЗА
    // САМЫЕ ТЯЖЁЛЫЕ задания (разбойники). Кожаная броня (25 д.) или
    // кольчуга (80 д.) — честная плата за кровь; тегиляй за среднее дело
    // больше не выдают.
    if (rewardTypes.includes('armor') && difficulty === 'hard' && Math.random() < 0.5) {
        const armorPool = ['leather', 'chain'];
        const armorId = armorPool[Math.floor(Math.random() * armorPool.length)];
        const armor = ARMORS[armorId];
        if (armor) {
            rewards.push({ type: 'item', id: armorId, name: armor.name, count: 1, armor: true });
        }
    }

    // МЕЧ — УНИКАЛЬНАЯ НАГРАДА ОТ СТАРОСТЫ (раунд 62, п.7): одна на игру,
    // только за самое тяжёлое дело (разбойники, difficulty hard). Кузнец
    // мечи не куёт и не продаёт — только староста отдаёт свой.
    if (npcId === 'elder' && difficulty === 'hard'
        && !q.elderSwordGiven && !q.elderSwordPromised
        && Math.random() < 0.35) {
        const sword = WEAPONS.sword;
        rewards.push({ type: 'item', id: 'sword', name: sword.name, count: 1, weapon: true, uniqueFromElder: true });
    }

    return rewards;
}

// === ГЕНЕРАЦИЯ ЗАДАНИЯ ===
/**
 * Сгенерировать случайное задание для NPC.
 * @param {string} npcId — ID NPC (elder, priest, tavernkeeper, blacksmith, peasant1, widow)
 * @param {Object} registry — Phaser registry
 * @returns {Object} — объект задания { id, type, title, description, objective, npcId, npcName, location, combat, enemyKeys, timeLimit, turnsUsed, rewards, completed, accepted }
 */
export function generateQuest(npcId, registry) {
    const pool = NPC_QUEST_POOLS[npcId];
    if (!pool) return null;

    // Проверяем, не выдан ли уже главный квест
    const q = registry.get('quest') || {};
    const activeQuests = q.activeQuests || [];
    
    // Выбираем случайный тип задания из пула NPC.
    // Раунд 66.12 (п.5): процедурный ICON_RETURN ИЗЪЯТ из генератора —
    // главный квест существует ТОЛЬКО в сюжете (см. приказ владельца:
    // вор крадёт икону и убегает — с этого начинается игра).
    let questType;
    {
    // Фильтруем задания, которые уже есть у игрока (не выдаем дубликаты).
    // Раунд 22: просроченные поручения тоже освобождают слот.
    // Раунд 66.12: ЗИМОЙ грибы не ищут и травы не собирают — такие
    // поручения не генерируются (сезонная привязка, приказ п.5).
    const gt6612 = registry.get('gameTime');
    const isWinter6612 = (() => { try { return gt6612 ? getSeason(gt6612.month) === 'winter' : false; } catch (e) { return false; } })();
    const availableTypes = pool.quests.filter(tp => {
            if (isWinter6612 && (tp === QUEST_TYPES.FETCH || tp === QUEST_TYPES.GATHER_HERBS)) return false;
            return !activeQuests.some(aq => aq.type === tp && !aq.completed && !aq.failed);
        });
        if (availableTypes.length === 0) return null; // нет доступных заданий
        questType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }

    const template = QUEST_TEMPLATES[questType];
    if (!template) return null;

    // Случайное описание
    const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];

    // Награды (реестр передаётся: меч старосты — уникальная награда,
    // обещание держим в quest-реестре, раунд 62 п.7)
    const rewards = generateRewards(npcId, questType, pool.rewardScale, registry);

    // РАУНД 62 (п.7): меч старосты — уникальная награда. РАУНД 66.12 (п.5):
    // обещание ставится при ПРИНЯТИИ поручения (acceptQuest), а не при
    // генерации — раньше ОТКАЗ игрока от предложения навсегда «сжигал»
    // единственный меч старосты (флаг оставался, а меч никто не получал).

    // Время на выполнение — РАУНД 61 (п.1): СРОКИ РЕАЛИСТИЧНЫ.
    // У каждого шаблона свой разумный срок в ЧАСАХ (timeLimitHours):
    //   молитва 2 ч · примирение 4 ч · воск 4 ч · грибы/рыба/травы 6 ч ·
    //   дрова 8 ч · стража (ночь) 8 ч · послание в соседнее село 12 ч ·
    //   поиски человека 12 ч · проводы 12 ч · волк 12 ч · разбойники 24 ч.
    // 1 действие = 15 минут ⇒ timeLimit (в действиях) = часы × 4.
    // Старая надбавка «+6 действий всем и +2 дальним» убрана: она делала
    // сроки произвольными (послание ≈3 ч) и не менялась от дальности цели.
    const hours = template.timeLimitHours || 8;
    const timeLimit = Math.max(4, hours * 4); // минимум 1 час

    const quest = {
        id: 'quest_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        type: questType,
        title: t(template.title),
        description: t(description),
        objective: t(template.objective),
        npcId: npcId,
        npcName: t(pool.description),
        location: template.location,
        combat: template.combat || false,
        enemyKeys: template.enemyKeys || null,
        timeLimit: timeLimit,
        timeLimitHours: hours,
        turnsUsed: 0,
        rewards: rewards,
        completed: false,
        accepted: false,
        isMainQuest: template.isMainQuest || false,
        difficulty: template.difficulty,
    };

    return quest;
}

/**
 * Принять задание.
 * РАУНД 61: срок показывается в ИГРОВЫХ ЧАСАХ (реалистично и понятно),
 * а не в абстрактных «действиях».
 */
export function acceptQuest(registry, quest) {
    const q = registry.get('quest') || {};
    if (!q.activeQuests) q.activeQuests = [];
    quest.accepted = true;
    q.activeQuests.push(quest);
    // Раунд 66.12 (п.5): меч старосты «обещается» при ПРИНЯТИИ (а не при
    // генерации) — отказ от предложения больше не выжигает уникальную награду.
    if ((quest.rewards || []).some(r => r.id === 'sword' && r.uniqueFromElder)) {
        q.elderSwordPromised = true;
    }
    const hours = quest.timeLimitHours || Math.round((quest.timeLimit || 10) / 4);
    q.currentObjective = quest.objective + ` (${tf(t('срок: {0} ч'), hours)})`;
    registry.set('quest', q);
    ActionLog.add(registry, tf(t('Принял задание: {0} от {1}. Срок: {2} ч.'), quest.title, quest.npcName, hours));
    return quest;
}

// Соответствие локации поручения посещённой локации.
// 'road' (легаси-имя) считается совпадающим с 'road_south';
// 'any' — любая загородная локация.
function matchesLocation(questLoc, visited) {
    if (!questLoc || !visited) return false;
    if (questLoc === visited) return true;
    if (questLoc === 'road' && visited === 'road_south') return true;
    if (questLoc === 'any') {
        // Раунд 66.12 (п.5): добавлены лесные локации Опушка/Поляна —
        // раньше «найти пропавшего» не засчитывался на них.
        return ['forest', 'forest_edge', 'forest_glade', 'road_south', 'field', 'river', 'lake', 'pogost', 'mill', 'apiary', 'pasture'].includes(visited);
    }
    return false;
}

/**
 * Раунд 21: отметить выполненными НЕБОЕВЫЕ поручения, подходящие по локации.
 * Вызывается при посещении деревни/лесов/пасеки/развилки/церкви.
 * Награда выдаётся при разговоре с заказчиком (claimCompletedQuests).
 * @returns {Array} список завершённых поручений
 */
export function onLocationVisited(registry, locationId) {
    const completed = [];
    getActiveQuests(registry).forEach(quest => {
        if (quest.combat || quest.completed) return;
        // Раунд 66.12 (п.5): поручения с ОТРАБОТКОЙ (стража/примирение)
        // завершаются не мгновенным визитом, а отработанным временем
        // (см. tickQuestTime) — иначе «постой до утра» выполнялось за миг.
        if (quest.minMinutesDone && (quest.minutesDone || 0) < quest.minMinutesDone) return;
        if (matchesLocation(quest.location, locationId)) {
            quest.completed = true;
            completed.push(quest);
            ActionLog.add(registry, tf(t('Поручение «{0}» выполнено! {1} ждёт тебя с наградой.'), quest.title, quest.npcName));
        }
    });
    return completed;
}

/**
 * Проверить, выполнено ли задание.
 * Вызывается при победе в бою (для боевых) или при возврате в локацию (для небоевых).
 */
export function checkQuestCompletion(registry, quest, context = {}) {
    if (!quest || quest.completed) return false;

    const template = QUEST_TEMPLATES[quest.type];
    if (!template) return false;

    // Для боевых заданий — проверяем, что бой с НУЖНЫМ типом врага выигран
    if (quest.combat && context.combatWon) {
        const enemyMatched = !context.enemyKey || !quest.enemyKeys || quest.enemyKeys.includes(context.enemyKey);
        if (enemyMatched) {
            quest.completed = true;
            return true;
        }
    }

    // Для небоевых заданий — проверяем, что игрок был в нужной локации
    if (!quest.combat && matchesLocation(quest.location, context.locationVisited)) {
        quest.completed = true;
        return true;
    }

    // Для заданий "в деревне" (mediate, prayer) — проверяем, что игрок вернулся в деревню
    if (quest.location === 'village' && context.returnedToVillage) {
        quest.completed = true;
        return true;
    }
    if (quest.location === 'church' && context.visitedChurch) {
        quest.completed = true;
        return true;
    }

    return false;
}

/**
 * Выдать награды за выполненное задание.
 */
export function grantQuestRewards(registry, quest) {
    if (!quest || !quest.rewards) return [];
    
    const player = registry.get('player');
    const q = registry.get('quest') || {};
    const grantedRewards = [];

    // Раунд 66.12 (п.5): меч старосты ОДИН на игру — если он уже выдан
    // (двойная выдача через доску/личное поручение в старых сейвах),
    // второй меч наградой не идёт.
    const rewardsToGrant = q.elderSwordGiven
        ? quest.rewards.filter(r => !(r.id === 'sword' && r.uniqueFromElder))
        : quest.rewards;

    rewardsToGrant.forEach(reward => {
        if (reward.type === 'money') {
            player.dengas = (player.dengas || 0) + reward.amount;
            grantedRewards.push(`${formatMoney(reward.amount)}`);
        } else if (reward.type === 'item') {
            if (!player.inventory) player.inventory = [];
            const existing = player.inventory.find(i => i.id === reward.id);
            if (existing) {
                existing.count += reward.count;
            } else {
                player.inventory.push({
                    id: reward.id,
                    name: reward.name,
                    count: reward.count,
                    type: reward.weapon ? 'weapon' : (reward.armor ? 'armor' : 'consumable'),
                    heal: reward.heal,
                    mpHeal: reward.mpHeal,
                    // РАУНД 62 (п.7): меч старосты — уникальный дар, продаже
                    // кузнецу не подлежит (флаг проверяется во вкладке «Продать»)
                    uniqueFromElder: reward.uniqueFromElder || false,
                });
            }
            grantedRewards.push(`${reward.name} ×${reward.count}`);
        } else if (reward.type === 'blessing') {
            player.HP = player.HPmax;
            player.MP = player.MPmax;
            grantedRewards.push(t('Благословение (полное восстановление)'));
        }
    });

    // РАУНД 62 (п.7): меч старосты ВЫДАН — уникальность отработана;
    // второй раз староста меча не обещает.
    if (quest.rewards.some(r => r.id === 'sword' && r.uniqueFromElder)) {
        q.elderSwordGiven = true;
        q.elderSwordPromised = false;
    }

    registry.set('player', player);
    registry.set('quest', q);
    ActionLog.add(registry, tf(t('Награда за «{0}»: {1}.'), quest.title, grantedRewards.join(', ')));
    return grantedRewards;
}

/**
 * Получить список активных (не выполненных и не просроченных) заданий.
 */
export function getActiveQuests(registry) {
    const q = registry.get('quest') || {};
    return (q.activeQuests || []).filter(q => q.accepted && !q.completed && !q.failed);
}

// ============================================================
// РАУНД 66.21 (приказы владельца 2–4): ВИРТУАЛЬНАЯ ДОСКА ПОРУЧЕНИЙ.
// Физическая доска у ворот удалена — процедурные поручения теперь
// выдаёт КАЖДЫЙ ВЗРОСЛЫЙ НПЦ в диалоговом окне (в доме — кнопка
// «Задание» и выбор в беседе, на улице — выбор в беседе).
// Общие правила для всех точек выдачи:
//   • у НПЦ есть пул поручений (NPC_QUEST_POOLS) и возраст ≥ 18 лет
//     (дети и пастушок Ивашка 14 лет поручений не дают — приказ «взрослый»);
//   • не больше ОДНОГО активного поручения от одного НПЦ (как прежде);
//   • ОДНО предложение от одного НПЦ в день (реестр 'npcQuestOffered') —
//     отказался/взял — новые дела у него только завтра;
//   • меч старосты по-прежнему выдаётся ТОЛЬКО лично (uniqueFromElder
//     не генерируется в предложениях... он и так только в его пуле).
// ============================================================

/** Возраст совершеннолетия для выдачи поручений. */
export const QUEST_GIVER_MIN_AGE = 18;

/** Может ли этот НПЦ выдавать процедурные поручения (пул + взрослый). */
export function canGiveQuests(registry, npcId) {
    if (!NPC_QUEST_POOLS[npcId]) return false;
    const npc = (registry.get('npcs') || []).find(n => n.id === npcId);
    if (!npc) return true; // нет данных о возрасте (старые сейвы) — пул решает
    return (npc.age || 30) >= QUEST_GIVER_MIN_AGE;
}

/** Есть ли у игрока активное поручение от этого НПЦ. */
export function hasActiveQuestFrom(registry, npcId) {
    return getActiveQuests(registry).some(aq => aq.npcId === npcId);
}

/** Предлагал ли этот НПЦ дело сегодня. */
function offeredToday(registry, npcId) {
    const time = registry.get('gameTime');
    const day = time ? (time.yearFromChrist * 372 + time.month * 31 + time.day) : 0;
    const st = registry.get('npcQuestOffered');
    if (!st || st.day !== day) return false;
    return (st.ids || []).includes(npcId);
}

/**
 * Может ли НПЦ СЕЙЧАС предложить дело (без побочных эффектов —
 * для показа кнопки «📜 Есть ли дело?»; сама выдача — makeQuestOffer).
 */
export function canOfferQuestToday(registry, npcId) {
    return !NPC_QUEST_POOLS[npcId]
        ? false
        : canGiveQuests(registry, npcId)
            && !hasActiveQuestFrom(registry, npcId)
            && !offeredToday(registry, npcId);
}

/** Отметить: НПЦ предложил дело сегодня (после этого — только завтра). */
function markOffered(registry, npcId) {
    const time = registry.get('gameTime');
    const day = time ? (time.yearFromChrist * 372 + time.month * 31 + time.day) : 0;
    const st = registry.get('npcQuestOffered') || { day, ids: [] };
    if (st.day !== day) { st.day = day; st.ids = []; }
    if (!st.ids.includes(npcId)) st.ids.push(npcId);
    registry.set('npcQuestOffered', st);
}

/**
 * Сформировать предложение поручения от НПЦ (единая точка для кнопки
 * «Задание» в доме и выбора «📜 Есть ли дело?» в беседе).
 * @returns {{ ok: boolean, quest?: object, reason?: 'pool'|'age'|'active'|'offered'|'none' }}
 */
export function makeQuestOffer(registry, npcId) {
    if (!NPC_QUEST_POOLS[npcId]) return { ok: false, reason: 'pool' };
    if (!canGiveQuests(registry, npcId)) return { ok: false, reason: 'age' };
    if (hasActiveQuestFrom(registry, npcId)) return { ok: false, reason: 'active' };
    if (offeredToday(registry, npcId)) return { ok: false, reason: 'offered' };
    const quest = generateQuest(npcId, registry);
    if (!quest) return { ok: false, reason: 'none' };
    markOffered(registry, npcId);
    return { ok: true, quest };
}

/**
 * Аудит (приказ 4): все локации шаблонов поручений валидны.
 * 'road' — легаси-имя Тракта (совпадает с road_south, см. matchesLocation).
 * @returns {string[]} уникальные идентификаторы локаций из всех шаблонов
 */
export function questLocationIds() {
    const ids = new Set();
    Object.values(QUEST_TEMPLATES).forEach(tpl => {
        if (tpl && tpl.location) ids.add(tpl.location);
    });
    return [...ids];
}

/**
 * Получить список выполненных заданий.
 */
export function getCompletedQuests(registry) {
    const q = registry.get('quest') || {};
    return (q.activeQuests || []).filter(q => q.completed);
}

// Импортируем formatMoney из Character.js
import { formatMoney } from '../systems/Character.js';

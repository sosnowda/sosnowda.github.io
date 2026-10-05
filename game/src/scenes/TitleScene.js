// Главное меню игры — кнопки на чистом Phaser (без RexUI)
import { RUS } from '../config/RusTheme.js';
import AudioManager from '../systems/AudioManager.js';
import { t, tf, tk, getLang, setLang, isEn } from '../systems/i18n.js';
// Патч 66.81: createButton — закладки и кнопки инструкции
import { createButton, bindRestartOnResize } from '../utils/ui.js';
// Патч 66.75 (приказы 5–6): единая панель «⚙ Настройки» (титул + все игровые сцены)
import { openSettingsPanel } from '../systems/SettingsPanel.js';
// Раунд 32 (пп.14,15): строка о времени 1:30 в «Информации по игре» (F1)
import { timeRatioInfoLine } from '../systems/WorldClock.js';

/**
 * 66.30 (хотфикс аудита, приказ п.4): фоновый прелоадер «тяжёлой» музыки
 * (таверна/церковь/финалы, ~9.5 МБ) УДАЛЁН — он начинал качать все 4 трека
 * прямо в меню, что утяжеляло мобильный запуск и сжигало трафик.
 * Тяжёлая музыка подгружается СТРОГО по требованию:
 *  - таверна/церковь — AudioManager.playInteriorMusic() (докачка на входе
 *    в интерьер, механизм filecomplete из раунда 24);
 *  - финальные треки — EndScene (докачка при показе итогов, 66.30).
 * Из preload игры (BootScene) грузится только music_menu (0.76 МБ).
 */

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('Title');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);

        // Фоновая музыка главного меню
        this.audioManager.playSceneMusic('menu');

        // 66.30: тяжёлая музыка догружается по требованию (см. шапку файла)

        // Декор: парящие золотые точки
        for (let i = 0; i < 40; i++) {
            const d = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 3),
                0xc9a14a,
                Phaser.Math.FloatBetween(0.2, 0.6)
            );
            this.tweens.add({
                targets: d,
                y: d.y - 30,
                alpha: 0,
                duration: Phaser.Math.Between(2500, 5000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000),
            });
        }

        // Раунд 20: заголовок масштабируется под ширину окна (на телефоне не выпирает)
        // 66.52 (приказ 2 + аудит P2-3): бренд-титул локализован через словарь
        // (t('ЛЕТОПИСИ РУСИ') → 'THE CHRONICLES OF RUTHENIA'). EN-строка вдвое
        // длиннее (26 против 13 символов) — отдельная формула размера: width/17,
        // кламп [20,52], чтобы на мобильной ширине (320–720) не переполнять экран.
        const brand = t('ЛЕТОПИСИ РУСИ');
        const isEnBrand = brand !== 'ЛЕТОПИСИ РУСИ';
        const titleSize = isEnBrand
            ? Math.max(20, Math.min(52, Math.round(width / 17)))
            : Math.max(30, Math.min(66, Math.round(width / 12)));
        this.add.text(width / 2, 110, brand, {
            fontFamily: 'Georgia, serif', fontSize: titleSize + 'px', color: '#E8DCC4',
            fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);
        const subSize = Math.max(14, Math.min(22, Math.round(width / 30)));
        this.add.text(width / 2, 110 + titleSize * 0.75 + 18, t('XV век · Поход за утраченной иконой'), {
            fontSize: subSize + 'px', color: '#A89878',
        }).setOrigin(0.5);

        // Кнопки — без "Продолжить" (одноразовая игра).
        // Раунд 58 (п.4 приказа): пункт «Персонаж» из главного меню УДАЛЁН —
        // лист персонажа открывается из игры (кнопка «📜 Персонаж» в HUD);
        // выбор героя идёт через «Новая игра» → окно готовых героев.
        const by = 270;
        this.makeButton(width / 2, by, t('Новая игра'), 0x8B2C1A, 0xB53925, () => this.scene.start('CharacterSelection'));
        // Раунд 57 (п.4 приказа): меню «Помощь» переименовано в «ИНСТРУКЦИЯ»
        this.makeButton(width / 2, by + 68, t('❓ Инструкция'), 0x6b5320, 0x7d6428, () => this.showHelp());
        this.makeButton(width / 2, by + 136, t('⚙ Настройки'), 0x4f4a1e, 0x5f5a26, () => this.showSettings());
        this.makeButton(width / 2, by + 204, t('Об игре'), 0x54382a, 0x644536, () => this.about());

        // 66.31 (п.6): «ВЕРНУТЬСЯ НА САЙТ» — выход из игры на лендинг.
        // ESC из любой сцены приводит сюда (главное меню = пауза), поэтому
        // кнопка возврата живёт ЗДЕСЬ. Не в основной стопке, а внизу экрана:
        // компактная, видна на любых экранах (в т.ч. телефон в landscape) и
        // не двигает привычные пункты меню.
        this.makeSiteButton(width / 2, height - 34, t('Вернуться на сайт'), () => {
            try { window.location.href = isEn() ? '/en/' : '/'; } catch (e) { /* noop */ }
        });
        
        // П.26: ESC — переключение в главное меню и обратно
        this.input.keyboard.on('keydown-ESC', () => {
            // Если уже в Title — ничего не делаем (уже в главном меню)
        });
        // П.25: F1 — окно помощи
        this.input.keyboard.on('keydown-F1', () => {
            this.showHelp();
        });
    }

    makeButton(x, y, label, bgColor, hoverColor, callback) {
        const w = 280, h = 56;
        const bg = this.add.rectangle(x, y, w, h, bgColor, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#E8DCC4',
            stroke: '#000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setFillStyle(hoverColor, 1);
            bg.setScale(1.05);
            text.setScale(1.05);
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(bgColor, 1);
            bg.setScale(1);
            text.setScale(1);
        });
        bg.on('pointerdown', () => {
            bg.setScale(0.95);
            text.setScale(0.95);
        });
        bg.on('pointerup', () => {
            bg.setScale(1.05);
            text.setScale(1.05);
            callback();
        });

        return { bg, text };
    }

    /**
     * 66.31 (п.6): компактная «ссылочная» кнопка внизу экрана (меньше и
     * тише основных пунктов меню) — «Вернуться на сайт» / 'Back to site'.
     */
    makeSiteButton(x, y, label, callback) {
        const w = Math.min(240, Math.max(170, label.length * 11));
        const h = 42;
        const bgColor = 0x35543a;      // тёмная хвоя (в тон зелени деревни)
        const hoverColor = 0x446a4a;
        const bg = this.add.rectangle(x, y, w, h, bgColor, 1)
            .setStrokeStyle(1, 0xC9A961, 0.8)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '16px',
            color: '#E8DCC4',
            stroke: '#000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        bg.on('pointerover', () => { bg.setFillStyle(hoverColor, 1); });
        bg.on('pointerout', () => { bg.setFillStyle(bgColor, 1); });
        bg.on('pointerdown', () => { bg.setScale(0.96); text.setScale(0.96); });
        bg.on('pointerup', () => { callback(); });

        return { bg, text };
    }

    showSimpleDialog(title, message) {
        const { width, height } = this.scale;
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive();

        // Раунд 39: панель растёт по высоте текста — кнопка «ОК» всегда НИЖЕ текста
        const msgText0 = this.add.text(0, 0, message, {
            fontFamily: 'Arial', fontSize: '16px', color: '#E8DCC4',
            align: 'center', wordWrap: { width: 440 },
        }).setOrigin(0.5);
        const panelW = 500;
        const panelH = Math.min(height - 24, Math.max(250, msgText0.height + 150));
        msgText0.destroy();
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(2, 0xC9A961);

        const titleText = this.add.text(width / 2, height / 2 - panelH / 2 + 34, title, {
            fontFamily: 'Georgia, serif', fontSize: '24px', color: '#C9A961',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const msgText = this.add.text(width / 2, height / 2 - 10, message, {
            fontFamily: 'Arial', fontSize: '16px', color: '#E8DCC4',
            align: 'center', wordWrap: { width: 440 },
        }).setOrigin(0.5);

        const btnW = 140, btnH = 40;
        const btnY = height / 2 + panelH / 2 - 34;
        const btnBg = this.add.rectangle(width / 2, btnY, btnW, btnH, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true });
        const btnText = this.add.text(width / 2, btnY, t('ОК'), {
            fontFamily: 'Georgia, serif', fontSize: '18px', color: '#E8DCC4',
        }).setOrigin(0.5);

        const closeDialog = () => {
            overlay.destroy();
            panel.destroy();
            titleText.destroy();
            msgText.destroy();
            btnBg.destroy();
            btnText.destroy();
        };

        btnBg.on('pointerover', () => btnBg.setFillStyle(0xB53925, 1));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x8B2C1A, 1));
        btnBg.on('pointerup', closeDialog);
        overlay.on('pointerup', closeDialog);
    }

    about() {
        this.showSimpleDialog(t('Об игре'), tk('title.about',
            '«Летописи Руси» — браузерная RPG в сеттинге Руси XV века.\n' +
            'Ролевая система: BRP (Basic Roleplaying Universal Game Engine SRD) — ' +
            'характеристики 3d6×5, проверки d100, критический успех 1/20 навыка, ' +
            'особый успех 1/5 навыка, бонус урона по таблице STR+SIZ.\n' +
            'Деньги: рубли, гривны, куны, деньги (Русь XV в.).\n' +
            'Управление: WASD/стрелки — движение, E — действие.\n' +
            'Игра одноразовая — сохранения не поддерживаются.'));
    }

    // ============================================================
    // ПАТЧ 66.81 (п.13 приказа): ИНСТРУКЦИЯ — ПОЛНОСТЬЮ ПЕРЕПИСАНА.
    //  • ВСЕ правила игры: цель/управление, ролевая система (BRP),
    //    правила проверок навыков и характеристик;
    //  • описание ДЕНЕЖНОЙ системы (куна/полтина/гривна/рубль);
    //  • описание ИГРОВОГО КАЛЕНДАРЯ (месяцы, сезоны, косые часы);
    //  • правила репутации/правосудия и новые ПРАВИЛА ДОЛГОВ;
    //  • текст разбит на РАЗДЕЛЫ С ЗАКЛАДКАМИ СВЕРХУ (не надо
    //    долго листать экран), прокрутка внутри раздела колесом
    //    и перетаскиванием;
    //  • экран РАЗВОРАЧИВАЕТСЯ НА ВЕСЬ ЭКРАН (кнопка «⛶»), шрифт
    //    крупный, в полном экране — ещё крупнее.
    // ============================================================

    /** Содержимое разделов инструкции (тексты под закладками). */
    helpSections() {
        // ПАТЧ 66.84 (п.6 приказа): раздел «Начало» — ПОД НОВЫЙ СТАРТ
        // (поп-ап старосты → диалог со старостой → весть священника →
        // стартовое задание → сдача иконы старосте/священнику), и он
        // ЛОКАЛИЗОВАН (RU + EN). Остальные разделы — раунд 66.81/66.83.
        const start = [
            '🎯 ЦЕЛЬ ИГРЫ:',
            'Ты — пришлый человек на Руси XV века: пришёл издалека',
            'в незнакомую деревню и думаешь прижиться и остаться жить.',
            'Верни украденную святыню, найди работу, завоюй доверие',
            'жителей. Достигни репутации +100 или женись — тогда игра',
            'будет выиграна.',
            '',
            timeRatioInfoLine(),
            '',
            '📖 КАК НАЧИНАЕТСЯ ИГРА (новый старт):',
            '  1. Прибыв в деревню, ты получаешь БОЛЬШОЕ ПРИВЕТСТВИЕ',
            '     от старосты — он встречает тебя как нового гостя.',
            '  2. Ты появляешься ОКОЛО ДОМА СТАРОСТЫ, староста стоит рядом.',
            '  3. К старосте ПРИБЕГАЕТ деревенский священник: ночью',
            '     КТО-ТО УКРАЛ ИКОНУ из деревенского храма!',
            '  4. В их диалоге ты можешь вклиниться с вопросами,',
            '     пролистать его или закрыть — после этого тебе',
            '     АВТОМАТИЧЕСКИ выдаётся СТАРТОВОЕ ЗАДАНИЕ.',
            '  5. СТАРТОВОЕ ЗАДАНИЕ — найти и поймать вора: расспрашивай',
            '     селян (каждый — один раз), читай следы, торопись:',
            '     вор идёт от локации к локации и не ждёт.',
            '  6. Икону сдают СТАРОСТЕ ИЛИ СВЯЩЕННИКУ — награда и слава.',
            '',
            '🎮 УПРАВЛЕНИЕ:',
            '  WASD / стрелки — движение (все 4 направления)',
            '  E / пробел — взаимодействие (войти в здание, говорить)',
            '  ЛКМ на здании — подойти и войти',
            '  ЛКМ на NPC — подойти и начать разговор',
            '  ПКМ на NPC — репутация и состояние жителя',
            '  M — обзор деревни · P — план деревни',
            '  F1 — инструкция · ESC — главное меню',
            '',
            '⚠ ПРОИГРЫШ (любой пункт — конец игры):',
            '  • СТАРТОВОЕ ЗАДАНИЕ НЕ ВЫПОЛНЕНО: вор уходит со',
            '    святыней — ЭТО ВСЕГДА ПРОИГРЫШ!',
            '  • Смерть героя в бою',
            '  • Репутация в деревне −100 → изгнание',
            '  • Долги не выплачены → изгойство (закладка «Долги»)',
            '',
            '🏆 ВЫИГРЫШ (только ПОСЛЕ выполнения стартового задания):',
            '  • Репутация в деревне +100 → принят как свой',
            '  • Брак с жителем (репутация +90 у NPC, +50 в деревне,',
            '    200 д.) — Церковь не венчает, пока икона не вернулась.',
        ].join('\n');

        const startEn = [
            '🎯 GOAL OF THE GAME:',
            'You are a newcomer in 15th-century Rus\': you have come from',
            'afar to an unfamiliar village and mean to settle and stay.',
            'Return the stolen holy icon, find work, earn the villagers\'',
            'trust. Reach +100 reputation — or get married. Either wins',
            'the game.',
            '',
            timeRatioInfoLine(),
            '',
            '📖 HOW THE GAME BEGINS (the new start):',
            '  1. Upon arriving you receive a BIG WELCOME from the village',
            '     elder — he greets you as a new guest.',
            '  2. You appear NEAR THE ELDER\'S HOUSE, with the elder standing',
            '     beside you.',
            '  3. The village priest RUNS UP to the elder: in the night',
            '     SOMEONE STOLE AN ICON from the village church!',
            '  4. In their dialogue you may interject with questions, flip',
            '     through it or close it — after that you are AUTOMATICALLY',
            '     given the STARTER QUEST.',
            '  5. STARTER QUEST — find and catch the thief: question the',
            '     villagers (each one once), read the tracks, hurry:',
            '     the thief moves from place to place and will not wait.',
            '  6. Hand the icon back to THE ELDER OR THE PRIEST — reward',
            '     and glory follow.',
            '',
            '🎮 CONTROLS:',
            '  WASD / arrows — movement (all 4 directions)',
            '  E / space — interact (enter a building, talk)',
            '  LMB on a building — walk up and enter',
            '  LMB on an NPC — walk up and start a talk',
            '  RMB on an NPC — villager\'s reputation and state',
            '  M — village overview · P — village plan',
            '  F1 — instructions · ESC — main menu',
            '',
            '⚠ DEFEAT (any of the following ends the game):',
            '  • THE STARTER QUEST NOT COMPLETED: the thief escapes with',
            '    the holy icon — THIS ALWAYS MEANS DEFEAT!',
            '  • The hero dies in battle',
            '  • Village reputation −100 → banishment',
            '  • Debts unpaid → outlawry (the «Debts» tab)',
            '',
            '🏆 VICTORY (only AFTER the starter quest is done):',
            '  • Village reputation +100 → accepted as one of their own',
            '  • Marriage to a villager (+90 NPC rep., +50 village, 200 d.)',
            '    — the Church will not wed you until the icon is returned.',
        ].join('\n');

        const rp = [
            '🎲 РОЛЕВАЯ СИСТЕМА — BRP (Basic Roleplaying SRD)',
            'Характеристики создаются броском 3d6×5 (от 15 до 90),',
            'все проверки — бросок d100 под значение.',
            '',
            '📊 ПЯТЬ ХАРАКТЕРИСТИК:',
            '  СИЛ — физическая мощь и урон;   ТЕЛ — здоровье, запас сил;',
            '  МОЩ — воля и интуиция;          ЛОВ — проворство, меткость;',
            '  ХАР — первое впечатление и слово.',
            '  Здоровье: HP = (ТЕЛ + СИЛ) / 10. Бонус урона — по СИЛ+ТЕЛ.',
            '',
            '🎯 НАВЫКИ — 28, по шести категориям:',
            '  Боевые · Общение · Знания · Манипуляции · Восприятие · Скрытность.',
            '  Навык = база + характеристика × коэффициент + личная надбавка 1d10.',
            '  Герой силён в своём ремесле: у следопыта — Скрадывание и след,',
            '  у воина — меч, у сыщика — слово (Убеждение).',
            '',
            '🎲 ПРАВИЛА ПРОВЕРОК НАВЫКОВ И ХАРАКТЕРИСТИК:',
            '  • Бросается d100: выпало МЕНЬШЕ ИЛИ РАВНО значению навыка — успех.',
            '  • Критический успех — 1/20 навыка (при 60% это 1–3): наилучший исход.',
            '  • Особый успех — 1/5 навыка: в бою даёт урон ×2.',
            '  • Критический провал (fumble): 96+ при навыке ниже 50, иначе ровно 00.',
            '  • Встречная проверка (торг, спор): оба бросают d100 — чей успех выше.',
            '  • На бросок влияют: благословение молитвы (+5 к одной проверке),',
            '    голод и усталость (штрафы к проверкам).',
            '',
            '⏳ ЦЕНЫ ВРЕМЕНИ:',
            '  еда — ровно 1 час (кукдаун трапезы 4 часа); торговля — 30 минут;',
            '  кража и взлом — 10 минут; час подёнки — 1 час и −2 очка усталости.',
        ].join('\n');

        const money = [
            '💰 ДЕНЕЖНАЯ СИСТЕМА РУСИ XV ВЕКА',
            'Счёт идёт на ДЕНЬГИ — серебряную монету. Медного чекана',
            'на Руси в XV веке ещё нет. Мошна героя считается деньгами,',
            'в свитке она показана разложением по крупным единицам.',
            '',
            '  1 куна    = 2 деньги',
            '  1 полтина = 50 денег (полгривны)',
            '  1 гривна  = 100 денег (серебряный слиток)',
            '  1 рубль   = 200 денег (две гривны)',
            '',
            '🛒 ЦЕНЫ (примеры):',
            '  Хлеб 2 д. · Каша 5 д. · Квас 3 д. · Медовуха 4 д.',
            '  Ночлег 4–12 д. · Нож 3 д. · Дубина 2 д. · Меч 30 д.',
            '  Кольчуга 80 д. · Сабля на заказ 100 д.',
            '',
            '💼 ЗАРАБОТКИ:',
            '  Подёнка у мастеров: 2–7 д. за час (по навыку Ремесла),',
            '  у кузнеца 2–12 д., служка в храме 3–10 д., гусли за столом',
            '  3–16 д.; рыба, дичь, ягоды и грибы — скупка на постоялом',
            '  дворе и у мясника. Ткачиха платит полотном и сукном.',
            '',
            '⚖ ОПЛАТА И МОЛВА:',
            '  Ставки ×(1 + репутация/200): своему до ×1.25, чужаку до ×0.75.',
            '  Зимой у гончара и плотника −20%; у мельницы после урожая +20%.',
            '  «О слове»: раз в сутки уговорись о ставке — успех +25%, крит +50%.',
            '  Денег нет? Еду и ночлег берут В ДОЛГ у трактирщика',
            '  (все правила — на закладке «Долги»).',
        ].join('\n');

        const cal = [
            '📅 ИГРОВОЙ КАЛЕНДАРЬ',
            'Год считают по-старому — от Сотворения мира (лето 70XX)',
            'и с новолетием по сентябрьскому стилю: сентябрь — первый месяц.',
            '',
            'МЕСЯЦЫ НАРОДНОГО КАЛЕНДАРЯ:',
            '  Вересень (сентябрь) · Паздерник (октябрь) · Грудень (ноябрь)',
            '  Студень (декабрь) · Просинец (январь) · Лютень (февраль)',
            '  Березозол (март) · Цветень (апрель) · Травень (май)',
            '  Кресень (июнь) · Липень (июль) · Серпень (август)',
            '',
            'НЕДЕЛЯ — 7 дней: Неделя, Понедѣльник, Вторник, Середа,',
            'Четверг, Пятница, Субота.',
            '',
            '🌾 РАБОТЫ ПОЛЯ (живой мир):',
            '  Цветень — пахота · Травень — посев · Кресень — сенокос;',
            '  Липень–Серпень — жатва; Вересень–Паздерник — жнивьё;',
            '  от Грудня до Лютеня поле спит под снегом.',
            '',
            '⏱ ТЕЧЕНИЕ ВРЕМЕНИ:',
            '  ' + timeRatioInfoLine(),
            '  Часы — «косые»: и день, и ночь делятся на 12 часов,',
            '  поэтому летний час длиннее зимнего.',
            '  Норма еды — 2 трапезы в сутки (полдень и вечер): пропуск',
            '  бьёт здоровьем. Сон не короче 2 часов; после сна 12 часов',
            '  спать не тянет. Молитва и травы — со своими откатками.',
        ].join('\n');

        const rep = [
            '⭐ РЕПУТАЦИЯ (МОЛВА):',
            '  Повышение: задания, подарки, похвала, угощение всему двору,',
            '  пожертвования церкви, честная подёнка (+1 в сутки).',
            '  Понижение: попрошайничество, угрозы, ночное беспокойство,',
            '  кражи и взломы, а также ДОЛГИ (см. закладку «Долги»).',
            '  ≤ −30: житель не говорит. ≤ −50: не торгует. ≤ −80: может напасть.',
            '',
            '🚶 ЛЕСТНИЦА СТАТУСОВ:',
            '  ≤ −20 — «подозрительный»: у ворот осмотрят узел и отберут краденое;',
            '  ≥ +30 — «свой»: в дома пускают без присмотра хозяина.',
            '  Молва живёт: каждую неделю деревня прощает мелкие обиды',
            '  (+1 к нулю, пока репутация в пределах −20…0). Повторная',
            '  однотипная обида бьёт сильнее — ×1.5 (−10 → −15 → −22 → −30).',
            '',
            '⚖ ПРАВОСУДИЕ (Судебник 1497, «о татбе»):',
            '  Обокрал — хозяин всегда подозревает: отвести подозрение может',
            '  проверка разговорного навыка; провал −10 личной и −5 деревенской.',
            '  Поимка у ворот: краденое изымается, вира 24 д. + урок за сбытое',
            '  по полной; повторная поимка — всё ×3; третья — поток и разграбление:',
            '  всё имущество отобрать и изгнать (провал игры).',
            '  Мир с обкраденным: вернуть вещи (или серебром по полной) + вира 24 д.',
            '  Замаливание грехов: 50 д. в церкви раз в месяц — до +5 молвы.',
        ].join('\n');

        const debts = [
            '🪙 ДОЛГИ НА ПОСТОЯЛОМ ДВОРЕ',
            'Денег нет? Трактирщик Фёдор отпускает В ДОЛГ еду',
            '(меню «Купить еды») и комнату для ночлега (меню «Отдых»).',
            '',
            '✔ ПРАВО НА ДОЛГ (строгое):',
            '  • репутация в деревне ПОЛОЖИТЕЛЬНАЯ,',
            '  • и репутация у самого кредитора ПОЛОЖИТЕЛЬНАЯ;',
            '  • сумма всех долгов не бывает БОЛЬШЕ 100 денег.',
            '',
            '📉 ЦЕНА ДОЛГА:',
            '  С каждым взятым долгом молва в деревне И у кредитора',
            '  ПАДАЕТ — тем сильнее, чем больше сумма (10 д. — по мелочи,',
            '  100 д. — деревня запомнит надолго).',
            '',
            '📅 ДВА СРОКА У КАЖДОГО ДОЛГА:',
            '  время ВЫДАЧИ и время ВОЗВРАТА — неделя со дня взятия.',
            '  Сроки видны: свиток персонажа (строки «Долги») и',
            '  меню «Долги» на постоялом дворе.',
            '',
            '⏳ ОТСРОЧКА («и впредь им отложити» — Судебник, о займах):',
            '  Просрочил — проси отсрочку: проверка разговорного навыка',
            '  (лучший из Убеждения и Болтовни). Успех продлевает срок',
            '  на 3 дня. Отсрочек — НЕ БОЛЕЕ ТРЁХ, попытка раз в сутки.',
            '',
            '🛡 ПРАВЁЖ (взыскание у ворот):',
            '  Не вернул просроченный долг, и мошны не хватает — при выходе',
            '  из деревни тебя остановит стражник: сперва заберёт ВСЮ мошну,',
            '  потом имущество ИЗ УЗЛА, потом НАДЕТОЕ (оружие, доспех) —',
            '  всё продаётся за ПОЛОВИНУ цены в счёт долгов. Лишек вернут.',
            '',
            '🚪 ИЗГОЙСТВО:',
            '  Всего имущества не хватило на просроченные долги? Изгоняют',
            '  из деревни — ЭТО ПРОВАЛ И ОКОНЧАНИЕ ИГРЫ!',
            '',
            '⚒ ЗАКУП — ОТРАБОТКА ДОЛГА:',
            '  Можно наняться в закупы к Фёдору: час работы (дрова, вода,',
            '  чаны) — и ВСЯ плата идёт в погашение долга. Отказаться от',
            '  закупа нельзя, пока весь долг не выплачен: любая работа у',
            '  кредитора оплачивается только в счёт долга (Русская Правда,',
            '  ст. 56–62: закуп работает на купу).',
        ].join('\n');

        // Патч 66.84: раздел «Начало» двуязычный (RU/EN по языку сессии)
        return [isEn() ? startEn : start, rp, money, cal, rep, debts];
    }

    /** Закладки инструкции (надписи сверху). */
    helpTabs() {
        return [
            t('📜 Начало'),
            t('🎲 Ролевая система'),
            t('💰 Деньги'),
            t('📅 Календарь'),
            t('⭐ Репутация'),
            t('🪙 Долги'),
        ];
    }

    showHelp(startTab = null) {
        const { width, height } = this.scale;
        // Уборка прошлого показа (слушатели колеса/перетаскивания — в том числе)
        if (typeof this.__helpCleanup === 'function') this.__helpCleanup();
        this.__helpCleanup = null;
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        if (typeof startTab === 'number') this.__helpTab = startTab;
        if (!Number.isInteger(this.__helpTab)) this.__helpTab = 0;

        const fullscreen = !!this.__helpFullscreen;
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.88)
            .setOrigin(0).setInteractive().setDepth(200);
        // П.13: полноэкранный режим — панель разворачивается на весь экран
        const panelW = fullscreen ? Math.min(1360, width - 16) : Math.min(780, width - 16);
        const panelH = fullscreen ? height - 16 : Math.min(700, height - 16);
        this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        // Заголовок — компактный, чтобы оставить место тексту раздела
        this.add.text(width / 2, height / 2 - panelH / 2 + 22, t('❓ Инструкция — Летописи Руси XV века'), {
            fontSize: fullscreen ? '24px' : '20px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        // ----- ЗАКЛАДКИ СВЕРХУ (п.13: разделы без долгой прокрутки) -----
        const tabs = this.helpTabs();
        const tabFontSize = fullscreen ? 15 : 13;
        const tabButtons = tabs.map((label, i) => ({
            i,
            c: createButton(this, -999, -999, label, () => {
                if (this.__helpTab !== i) this.showHelp(i);
            }, {
                backgroundColor: this.__helpTab === i ? 0x8B6C1A : 0x4a3520,
                hoverColor: this.__helpTab === i ? 0xa8821f : 0x5a4530,
                textColor: this.__helpTab === i ? '#fff6d8' : RUS.text,
                fontSize: tabFontSize,
                padding: { left: 10, right: 10, top: 7, bottom: 7 },
                cornerRadius: 6,
            }),
        }));
        // Закладки — НАД оверлеем (иначе клик по ним глотает блокиратор)
        tabButtons.forEach((tb) => tb.c.setDepth(204));
        // Раскладка закладок в 1..2 ряда по фактическим ширинам кнопок
        const tabsTop = height / 2 - panelH / 2 + 44;
        const tabGap = 6;
        const maxTabW = panelW - 28;
        const tabRows = [];
        let tabRow = [], tabRowW = 0;
        tabButtons.forEach((tb) => {
            const w = Math.max(tb.c.width, 40) + tabGap;
            if (tabRow.length && tabRowW + w - tabGap > maxTabW) {
                tabRows.push(tabRow); tabRow = []; tabRowW = 0;
            }
            tabRow.push(tb); tabRowW += w;
        });
        if (tabRow.length) tabRows.push(tabRow);
        const tabRowH = 34;
        tabRows.forEach((r, ri) => {
            const totalW = r.reduce((s, tb) => s + Math.max(tb.c.width, 40), 0) + tabGap * (r.length - 1);
            let x = width / 2 - totalW / 2;
            r.forEach((tb) => {
                tb.c.setPosition(x + Math.max(tb.c.width, 40) / 2, tabsTop + ri * tabRowH);
                x += Math.max(tb.c.width, 40) + tabGap;
            });
        });
        const tabsBottom = tabsTop + tabRows.length * tabRowH;

        // ----- ЗОНА ТЕКСТА РАЗДЕЛА -----
        const footerH = 56;
        const textX = width / 2 - panelW / 2 + 18;
        const textY = tabsBottom + 8;
        const availTextH = Math.max(120, height / 2 + panelH / 2 - footerH - 8 - textY);
        const body = this.helpSections()[this.__helpTab] || '';
        // П.13: КРУПНЫЙ шрифт (в полном экране — ещё крупнее)
        const fontSize = fullscreen ? 19 : 16;
        const helpText = this.add.text(textX, textY, body, {
            fontSize: fontSize + 'px', color: '#E8DCC4',
            fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 1,
            lineSpacing: Math.round(fontSize * 0.45),
            wordWrap: { width: panelW - 36 },
        }).setOrigin(0, 0).setDepth(202);

        // Прокрутка: колесо + перетаскивание (палец на мобильном)
        let scrollY = 0;
        let maskGfx = null;
        let wheelHandler = null;
        let dragHandlers = null;
        const overflow = Math.max(0, helpText.height - availTextH);
        const applyScroll = () => {
            scrollY = Phaser.Math.Clamp(scrollY, 0, overflow);
            helpText.y = textY - scrollY;
        };
        if (overflow > 0) {
            maskGfx = this.make.graphics({ add: false });
            maskGfx.fillRect(textX - 4, textY - 4, panelW - 28, availTextH + 10);
            helpText.setMask(maskGfx.createGeometryMask());
            wheelHandler = (pointer, over, dx, dy) => {
                scrollY += dy;
                applyScroll();
            };
            this.input.on('wheel', wheelHandler);
            let dragStartY = null;
            let dragStartScroll = 0;
            const downH = (p) => { dragStartY = p.y; dragStartScroll = scrollY; };
            const moveH = (p) => {
                if (dragStartY === null) return;
                scrollY = dragStartScroll - (p.y - dragStartY) * 1.4;
                applyScroll();
            };
            const upH = () => { dragStartY = null; };
            this.input.on('pointerdown', downH);
            this.input.on('pointermove', moveH);
            this.input.on('pointerup', upH);
            dragHandlers = { downH, moveH, upH };
            // Подсказка прокрутки в правом верхнем углу зоны текста
            this.add.text(width / 2 + panelW / 2 - 18, textY + 6, '⇕', {
                fontSize: '16px', color: '#8a7a5a',
            }).setOrigin(0.5, 0).setDepth(202);
        }

        // ----- НИЖНИЙ РЯД: «⛶ НА ВЕСЬ ЭКРАН» + «ЗАКРЫТЬ» -----
        const footY = height / 2 + panelH / 2 - 26;
        createButton(this, width / 2 - 120, footY,
            this.__helpFullscreen ? t('\u{1F5D7} Свернуть') : t('⛶ На весь экран'), () => {
                this.__helpFullscreen = !this.__helpFullscreen;
                this.showHelp();
            }, {
                backgroundColor: 0x4f4a1e, hoverColor: 0x5f5a26, textColor: RUS.text,
                fontSize: 15, padding: { left: 14, right: 14, top: 8, bottom: 8 },
            }).setDepth(203);
        createButton(this, width / 2 + 120, footY, t('Закрыть'), () => {
            this.closeHelp();
        }, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 15, padding: { left: 18, right: 18, top: 8, bottom: 8 },
        }).setDepth(203);

        // Универсальная уборка (перевызов showHelp и закрытие)
        this.__helpCleanup = () => {
            if (wheelHandler) { this.input.removeListener('wheel', wheelHandler); wheelHandler = null; }
            if (dragHandlers) {
                this.input.off('pointerdown', dragHandlers.downH);
                this.input.off('pointermove', dragHandlers.moveH);
                this.input.off('pointerup', dragHandlers.upH);
                dragHandlers = null;
            }
            if (maskGfx) { maskGfx.destroy(); maskGfx = null; }
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        this.closeHelp = () => {
            if (typeof this.__helpCleanup === 'function') this.__helpCleanup();
            this.__helpCleanup = null;
        };

        this.input.keyboard.once('keydown-ESC', () => this.closeHelp());
        this.input.keyboard.once('keydown-F1', () => this.closeHelp());
    }

    // Патч 66.75 (приказы 5–6): панель настроек ВЫНЕСЕНА в общий модуль
    // systems/SettingsPanel.js — та же панель открывается и В ИГРЕ (кнопка «⚙»
    // в статус-баре деревни/леса/пасеки/локаций/развилки/интерьеров). Здесь —
    // тумблеры звука + язык; колбэк гасит/запускает меню-музыку сразу.
    showSettings() {
        openSettingsPanel(this, {
            showLanguage: true,
            onMusicToggle: (muted) => {
                if (muted && this.audioManager) this.audioManager.stopMusic('menu');
                if (!muted && this.audioManager) this.audioManager.playSceneMusic('menu');
            },
        });
    }

}

// РАУНД 32 (п.1): ДИРЕКТОР СКРИНШОТОВ — отладочные сценарии для снятия
// скриншотов сайта (?shot=<name> в адресной строке game/index.html).
// В обычной игре параметр не указывается — модуль ничего не делает.
//
// Сценарии (10 скриншотов сайта, по 3 в ряд + 1):
//   menu       — главное меню (Title)
//   select     — окно выбора персонажа (CharacterSelection)
//   custom     — лист готового героя (превью Следопыта Гаврилы, как по клику
//                на карточку; раунд 66.4 — раньше здесь был генератор)
//   village    — локация «Деревня»
//   map        — карта местности (экран Fork; 66.34: карта = сам экран)
//   interior   — интерьер дома старосты (Interior elder_house)
//   priest     — начальный диалог со священником (Interior church)
//   thief      — локация с вором и персонажем игрока (до боя)
//   combat     — окно сцены боя с вором
//   blacksmith — интерьер кузницы: горн, наковальня, торговля (раунд 66.4)
//
// Модуль подключается из game/index.html после создания Phaser.Game.

import { createPresetHero, PRESET_HEROES } from '../systems/Character.js';
import { getWeather } from '../systems/Weather.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Дождаться активной сцены (create() уже выполнен). */
function waitScene(key, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const t0 = Date.now();
        const poll = () => {
            const s = window.game && window.game.scene && window.game.scene.getScene(key);
            if (s && s.scene.isActive()) {
                resolve(s);
                return;
            }
            if (Date.now() - t0 > timeoutMs) { reject(new Error('scene timeout: ' + key)); return; }
            setTimeout(poll, 60);
        };
        poll();
    });
}

/** 66.43: найти текстовые объекты сцены по подстроке (включая контейнеры). */
function findTexts(scene, substr) {
    const found = [];
    const walk = (obj) => {
        if (!obj) return;
        if (obj.list) { obj.list.forEach(walk); return; }
        if (obj.text && typeof obj.text === 'string' && obj.text.trim && obj.text.includes(substr)) found.push(obj);
    };
    (scene.children && scene.children.list || []).forEach(walk);
    return found;
}

/** 66.43: универсальное ожидание конца печати диалога на сцене.
 * Жизненный цикл контента: ПОЛНЫЙ текст (layout до печати) → сброс в '' →
 * монотонный рост до той же длины. Готово = длина вернулась к максимуму,
 * был замечен сброс, и длина не меняется ~2.4 c. Если печати не было
 * (короткие реплики) — дожидаемся капа и выходим без ошибки. */
async function waitDialogTextDone(scene, capMs = 120000) {
    if (window.__shotsNoTyping) return true;   // печати нет — текст полный сразу
    let maxLen = 0, sawReset = false, last = -1, stable = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < capMs) {
        let len = 0;
        const walk = (obj) => {
            if (!obj) return;
            if (obj.list) { obj.list.forEach(walk); return; }
            if (obj.text && typeof obj.text === 'string' && obj.text.trim) len = Math.max(len, obj.text.length);
        };
        (scene.children && scene.children.list || []).forEach(walk);
        if (maxLen > 40 && len < maxLen * 0.25) sawReset = true;
        if (sawReset && len >= maxLen && len === last) {
            stable++;
            // 6 c без роста: при 3-4 fps паузы печати случаются, 2.4 c мало
            if (stable >= 20) return true;
        } else {
            stable = 0;
        }
        maxLen = Math.max(maxLen, len);
        last = len;
        await sleep(300);
    }
    return false;
}

/** Инициализировать прогон: герой-воин + погоня за вором (как при старте игры). */
async function startRun() {
    window.game.scene.start('CharacterSelection');
    const sel = await waitScene('CharacterSelection', 15000);
    const hero = createPresetHero('warrior_m', 'Добрыня');
    sel.startGameWithHero(hero); // → CharacterAppearance (инициализирует время/погоню/репутацию)
    await sleep(700);
    // 66.85 (приказ 1): с патча 66.84 игра открывается ИНТРО-ПОСЛЕДОВАТЕЛЬНОСТЬЮ
    // (поп-ап приветствия старосты, диалог, приход священника). Для кадров
    // сайта интро пропускаем напрямую: finishIntro() завершает сцену знакомства
    // и отдаёт управление игроку (как реальный игрок после диалогов).
    await sleep(300);
    const vil0 = window.game.scene.getScene('Village');
    if (vil0 && vil0.introSequence && vil0.introSequence.finishIntro) {
        vil0.introSequence.finishIntro();
    }
    await sleep(600);
    // 66.43 (пересъёмка): обучающие подсказки (Туторial, 4 шага ~20 c)
    // НЕ должны попадать в кадры сайта — помечаем туториал пройденным.
    const q0 = window.game.registry.get('quest');
    if (q0 && q0.tutorialStep !== undefined) {
        q0.tutorialStep = 3;
        window.game.registry.set('quest', q0);
    }
    // Скриншоты снимаем «июльским утром в 10:00» при ясной погоде: ночью НПЦ
    // спят (священник гонит прочь), дождь/снег портят кадр (раунд 28: старт
    // игры = реальное время игрока — для съёмки фиксируем красивый день)
    const ts = window.game.registry.get('gameTime');
    if (ts) {
        ts.month = 10; // июль — лето
        ts.hour = 10;
        ts.minute = 0;
        for (let d = 1; d <= 28; d++) {
            ts.day = d;
            window.game.registry.set('gameTime', ts);
            if (getWeather(window.game.registry).id === 'clear') break;
        }
    }
}

/** Загнать вора на Реку (для сценариев thief/combat). */
async function stageThiefAtRiver() {
    await startRun();
    const q = window.game.registry.get('quest');
    q.chase.route = ['river', 'field', 'lake'];
    q.chase.stop = 0;
    q.chase.phase = 'stay';
    q.chase.ticksLeft = 99;
    q.chase.stays = [99, 99, 99];
    window.game.registry.set('quest', q);
}

const SCENARIOS = {
    // 66.43 (приказ 3): кадр меню — ДОЖИДАЕМСЯ оседания сцены: у Титула есть
    // фейд-ин/анимации, и прежний съёмщик иногда снимал полосу загрузки.
    menu: async () => { await waitScene('Title', 20000); await sleep(2000); },
    select: async () => { await waitScene('Title', 15000); window.game.scene.start('CharacterSelection'); },
    custom: async () => { // раунд 66.4: лист готового героя — превью Следопыта Гаврилы
        // (как при клике на карточку в выборе персонажа; соответствует alt на сайте)
        await waitScene('Title', 15000); window.game.scene.start('CharacterSelection');
        await sleep(400);
        const sel = window.game.scene.getScene('CharacterSelection');
        if (sel) sel.selectHero(PRESET_HEROES[0], false);
        await sleep(500);
    },
    village: async () => { await startRun(); window.game.scene.start('Village'); },
    map: async () => {
        await startRun();
        // 66.34: карта местности — САМ экран развилки (showMap удалён)
        window.game.scene.start('Fork');
        await waitScene('Fork');
        await sleep(300);
    },
    interior: async () => { await startRun(); window.game.scene.start('Interior', { interiorId: 'elder_house', from: 'Village' }); },
    priest: async () => {
        await startRun();
        window.game.scene.start('Interior', { interiorId: 'church', from: 'Village' });
        const church = await waitScene('Interior');
        await sleep(400);
        church.talkToNpc(church.interior);
        // 66.43 (пересъёмка): ждём конец печати реплики — иначе в кадре
        // оборванная фраза «Ох…» вместо полного диалога.
        await waitDialogTextDone(church);
        await sleep(400);
    },
    thief: async () => {
        await stageThiefAtRiver();
        window.game.scene.start('Location', { locationId: 'river', from: 'Fork' });
        const loc = await waitScene('Location');
        await sleep(1600); // ждём presentThiefEncounter (delayedCall 400 + анимации)
        // 66.43 (пересъёмка): в headless первые кадры страницы тормозят —
        // delayedCall(400) догорает позже wall-времени, а тайпрайтер печатает
        // ~1 символ/кадр. Ждём появления диалога, затем КОНЦА печати.
        const t0 = Date.now();
        while (Date.now() - t0 < 20000 && !findTexts(loc, 'Встреча с воро').length) {
            await sleep(200);
        }
        // …и ждём КОНЕЦ печати. НЮАНС (66.43): до старта тайпрайтера layout()
        // кладёт в текст ПОЛНЫЙ контент, затем печать сбрасывает его в '' и
        // растит заново — поэтому одиночной проверки мало. Паттерн «нашёл →
        // через 2.5 c проверил снова»: у завершённой печати «проверка Драки»
        // остаётся навсегда (substring монотонно растёт), у окна — сбрасывается.
        const t1 = Date.now();
        let typingDone = false;
        while (Date.now() - t1 < 150000 && !typingDone) {
            if (findTexts(loc, 'проверка Драки').length) {
                await sleep(2500);
                typingDone = findTexts(loc, 'проверка Драки').length > 0;
            } else {
                await sleep(300);
            }
        }
        // 66.43 (приказ 4): герой ЛИЦОМ к вору (idle_right уже играет) и на
        // открытом месте: стартовая точка (0.2w, 0.6h) у Реки прячется за
        // кроной жёлтого дерева — ставим героя на чистую траву у низа кадра.
        // Твин покачивания перезаписывает y — гасим его перед перестановкой.
        if (loc.playerSprite && loc.playerSprite.active) {
            loc.tweens.killTweensOf(loc.playerSprite);
            loc.playerSprite.setPosition(300, 668).setDepth(40);
        }
        await sleep(400);
    },
    combat: async () => {
        await stageThiefAtRiver();
        window.game.scene.start('Combat', { enemyKeys: ['thief'], npcId: 'thief', fromLocation: 'river' });
        await waitScene('Combat');
        await sleep(1200);
    },
    blacksmith: async () => { // раунд 66.4: кузница — горн с живым огнём, наковальня, торговля
        await startRun();
        window.game.scene.start('Interior', { interiorId: 'blacksmith', from: 'Village' });
        await waitScene('Interior');
        await sleep(600);
    },
    // 66.85 (приказы 1–2): НОВЫЙ кадр сайта — Южный тракт с ГРУНТОВОЙ
    // дорогой (земляное полотно, колеи, дёрн по кромкам, путевой столб).
    tract: async () => {
        await startRun();
        window.game.scene.start('Location', { locationId: 'road_south', from: 'Fork' });
        await waitScene('Location');
        await sleep(1500);
    },
};

export function bootScreenshotDirector() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot || !SCENARIOS[shot]) return;
    // 66.43: флаг готовности кадра для съёмщика — сценарий выполнен, сцена
    // осела. Съёмщик ждёт window.__shotReady и снимает ПОСЛЕ него.
    window.__shotReady = false;
    // 66.43: тайпрайтер диалогов в съёмочных сессиях отключён (см. utils/ui.js) —
    // при троттлинге headless печать реплики растягивается на минуты.
    window.__shotsNoTyping = true;
    // Ждём полной загрузки игры (window.game создан в index.html) и запускаем
    const t0 = Date.now();
    const tryStart = () => {
        // Раунд 33 (фикс): ждать не только СУЩЕСТВОВАНИЯ сцены Title (экземпляры
        // создаются при старте игры), но и её АКТИВАЦИИ — иначе сценарий мог
        // стартовать до BootScene.create, анимации рыцаря/вора ещё не были
        // созданы, и вор в бою отрисовывался запасным рыцарем (как у игрока).
        const title = window.game && window.game.scene && window.game.scene.getScene('Title');
        if (title && title.scene.isActive()) {
            SCENARIOS[shot]()
                .then(() => { window.__shotReady = true; })
                .catch(err => {
                    console.error('[shots] scenario failed:', shot, err);
                    window.__shotError = String(err && err.message || err);
                });
            return;
        }
        if (Date.now() - t0 > 30000) {
            console.error('[shots] boot timeout');
            window.__shotError = 'boot timeout';
            return;
        }
        setTimeout(tryStart, 200);
    };
    tryStart();
}

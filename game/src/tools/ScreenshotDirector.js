// РАУНД 32 (п.1): ДИРЕКТОР СКРИНШОТОВ — отладочные сценарии для снятия
// скриншотов сайта (?shot=<name> в адресной строке game/index.html).
// В обычной игре параметр не указывается — модуль ничего не делает.
//
// Сценарии (9 скриншотов сайта, по 3 в ряд):
//   menu     — главное меню (Title)
//   select   — окно выбора персонажа (CharacterSelection)
//   custom   — окно генерации случайного героя (CharacterSelection)
//   village  — локация «Деревня»
//   map      — карта местности (Fork + showMap)
//   interior — интерьер дома старосты (Interior elder_house)
//   priest   — начальный диалог со священником (Interior church)
//   thief    — локация с вором и персонажем игрока (до боя)
//   combat   — окно сцены боя с вором
//
// Модуль подключается из game/index.html после создания Phaser.Game.

import { createPresetHero } from '../systems/Character.js';
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

/** Инициализировать прогон: герой-воин + погоня за вором (как при старте игры). */
async function startRun() {
    window.game.scene.start('CharacterSelection');
    const sel = await waitScene('CharacterSelection', 15000);
    const hero = createPresetHero('warrior_m', 'Добрыня');
    sel.startGameWithHero(hero); // → CharacterAppearance (инициализирует время/погоню/репутацию)
    await sleep(700);
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
    menu: async () => { await waitScene('Title', 15000); },
    select: async () => { await waitScene('Title', 15000); window.game.scene.start('CharacterSelection'); },
    custom: async () => { // раунд 61: окна кастомизации больше нет — снимаем генератор случайного героя
        await waitScene('Title', 15000); window.game.scene.start('CharacterSelection');
        await sleep(400);
        const sel = window.game.scene.getScene('CharacterSelection');
        if (sel) sel.showRandomGenerator();
    },
    village: async () => { await startRun(); window.game.scene.start('Village'); },
    map: async () => {
        await startRun();
        window.game.scene.start('Fork');
        const fork = await waitScene('Fork');
        await sleep(300);
        fork.showMap();
    },
    interior: async () => { await startRun(); window.game.scene.start('Interior', { interiorId: 'elder_house', from: 'Village' }); },
    priest: async () => {
        await startRun();
        window.game.scene.start('Interior', { interiorId: 'church', from: 'Village' });
        const church = await waitScene('Interior');
        await sleep(400);
        church.talkToNpc(church.interior);
    },
    thief: async () => {
        await stageThiefAtRiver();
        window.game.scene.start('Location', { locationId: 'river', from: 'Fork' });
        await waitScene('Location');
        await sleep(1600); // ждём presentThiefEncounter (delayedCall 400 + анимации)
    },
    combat: async () => {
        await stageThiefAtRiver();
        window.game.scene.start('Combat', { enemyKeys: ['thief'], npcId: 'thief', fromLocation: 'river' });
        await waitScene('Combat');
        await sleep(1200);
    },
};

export function bootScreenshotDirector() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot || !SCENARIOS[shot]) return;
    // Ждём полной загрузки игры (window.game создан в index.html) и запускаем
    const t0 = Date.now();
    const tryStart = () => {
        // Раунд 33 (фикс): ждать не только СУЩЕСТВОВАНИЯ сцены Title (экземпляры
        // создаются при старте игры), но и её АКТИВАЦИИ — иначе сценарий мог
        // стартовать до BootScene.create, анимации рыцаря/вора ещё не были
        // созданы, и вор в бою отрисовывался запасным рыцарем (как у игрока).
        const title = window.game && window.game.scene && window.game.scene.getScene('Title');
        if (title && title.scene.isActive()) {
            SCENARIOS[shot]().catch(err => console.error('[shots] scenario failed:', shot, err));
            return;
        }
        if (Date.now() - t0 > 30000) { console.error('[shots] boot timeout'); return; }
        setTimeout(tryStart, 200);
    };
    tryStart();
}

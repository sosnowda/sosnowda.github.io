// Раунд 66.21 (приказ 1): пересъёмка 9 скриншотов лендинга 1280×720.
// Игра запускается локально (python http.server 8765 из корня репо),
// Playwright проходит путь игрока: титул → выбор героя → лист героя →
// деревня (БЕЗ доски поручений) → околица → дом старосты → церковь +
// диалог священника (с пожертвованием) → бой → встреча с воровкой.
// Кадры кладутся в /tmp/shots/*.png, далее конвертируются в webp.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
    headless: true,
    args: ['--mute-audio', '--disable-web-security'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });

async function shot(name) {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('SHOT', name);
}

// Клик по Phaser-текстовой кнопке: находим текст среди живых объектов
// всех сцен, вычисляем ЭКРАННЫЕ координаты (с учётом контейнеров) и
// делаем реальный клик мышью по канвасу.
async function clickText(txt, timeout = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate((txt) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                // обход в глубину с накоплением смещений контейнеров
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { // контейнер
                        for (const c of obj.list) {
                            const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0));
                            if (r) return r;
                        }
                        return null;
                    }
                    if (obj.text && obj.text.trim && obj.text.trim() === txt) {
                        return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    }
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) {
                        const cam = s.cameras ? s.cameras.main : null;
                        const zoom = cam ? (cam.zoom || 1) : 1;
                        const cx = (r.x - (cam ? (cam.scrollX || 0) : 0)) / zoom;
                        const cy = (r.y - (cam ? (cam.scrollY || 0) : 0)) / zoom;
                        return { x: Math.round(cx), y: Math.round(cy), scene: s.scene.key };
                    }
                }
            }
            return null;
        }, txt);
        if (pos && pos.x > 0 && pos.y > 0) {
            await page.mouse.click(pos.x, pos.y);
            await sleep(300);
            return true;
        }
        await sleep(250);
    }
    return false;
}

// ---- 1. Титул (ДО кликов) ----
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(5000); // boot-ассеты, появление кнопок
await shot('01-title');

// ---- 2. Выбор персонажа ----
if (!await clickText('Новая игра', 15000)) console.log('WARN: «Новая игра» не кликнулась');
await sleep(2000);
await shot('02-character-select');

// ---- 3. Лист героя: клик по первой карточке героя (координатно) ----
await page.mouse.click(360, 300);
await sleep(1500);
await shot('03-character-custom');

// ---- 4. Начало игры → деревня (БЕЗ доски поручений) ----
if (!await clickText('Начать игру', 8000)) console.log('WARN: «Начать игру» не кликнулась');
await sleep(4500); // постройка деревни + появление туториала
// Headless-браузер тормозит RAF → таймеры Phaser идут в ~2.5 раза медленнее,
// подсказки туториала «залипают». Принудительно гасим все оверлеи туториала.
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    if (!s) return;
    if (s.tutorial && s.tutorial.activeOverlays) {
        s.tutorial.activeOverlays.forEach(o => {
            try { o.closeTimer.remove(false); } catch (e) { /* уже снят */ }
            try { o.container.destroy(); } catch (e) { /* уже уничтожен */ }
        });
        s.tutorial.activeOverlays = [];
    }
    const q = s.registry.get('quest');
    if (q) { q.tutorialStep = 3; s.registry.set('quest', q); }
});
await sleep(1500);
await shot('04-village');

// ---- 5. Околица (развилка) + ПОЛНОЦЕННАЯ КАРТА МЕСТНОСТИ (66.24) ----
await page.evaluate(() => {
    const g = window.game;
    g.scene.stop('Village');
    g.scene.start('Fork');
});
await sleep(3500);
// Раунд 66.24 (приказ 1/3): кадр 05 — карта местности с центром в деревне
// (TerrainMap: тракт через деревню и мост к реке, выпас/пасека/поле,
// леса цепочкой, мельница и озеро у Северного Тракта)
await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    if (s && s.showMap) s.showMap();
});
await sleep(1500);
await shot('05-map');
await page.evaluate(() => {
    const s = window.game.scene.getScene('Fork');
    if (s) s.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
});
await sleep(400);

// ---- 6. Дом старосты (интерьер) ----
await page.evaluate(() => {
    const g = window.game;
    g.scene.stop('Fork');
    g.scene.start('Interior', { interiorId: 'elder_house', from: 'Fork' });
});
await sleep(3500);
await shot('06-elder-interior');

// ---- 7. Церковь + диалог священника ----
await page.evaluate(() => {
    const g = window.game;
    g.scene.stop('Interior');
    g.scene.start('Interior', { interiorId: 'church', from: 'Village' });
});
await sleep(3500);
await page.evaluate(() => {
    const s = window.game.scene.getScene('Interior');
    if (s && s.talkToNpc && s.interior) s.talkToNpc(s.interior);
});
await sleep(2200); // печать текста
await shot('07-priest-dialogue');

// ---- 8. Бой ----
await page.evaluate(() => {
    const g = window.game;
    g.scene.stop('Interior');
    g.scene.start('Combat', { enemyKeys: ['bandit'], fromScene: 'Village' });
});
await sleep(3500);
await shot('08-combat');

// ---- 9. Встреча с воровкой на погосте ----
await page.evaluate(() => {
    const g = window.game;
    g.scene.stop('Combat');
    g.scene.start('Location', { locationId: 'pogost', from: 'Fork' });
});
await sleep(3500);
await page.evaluate(async () => {
    const mod = await import('./src/data/thief.js');
    const s = window.game.scene.getScene('Location');
    if (!s) return 'no Location';
    try { mod.initThiefHunt(s.registry); } catch (e) { /* уже инициализирована */ }
    // Вор должен СТОЯТЬ на погосте: route[stop] = 'pogost', phase 'stay'
    const q = s.registry.get('quest') || {};
    if (q.chase) {
        q.chase.route[q.chase.stop] = 'pogost';
        q.chase.phase = 'stay';
        s.registry.set('quest', q);
    }
    mod.presentThiefEncounter(s, 'pogost');
    return 'ok';
});
await sleep(7000); // допечатка текста диалога (typing 25 мс/зн., headless ~2.5x медленнее)
await shot('09-thief-encounter');

await browser.close();
console.log('DONE');

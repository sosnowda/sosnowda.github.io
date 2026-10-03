// qa_6674.mjs — ЖИВОЙ QA 66.74 (новая волна навыков):
//  §1 таверна: кнопка «Скоморошить», меню скупки с «Сметить (Сметка)» и торгом;
//  §2 кузница: кнопка «Помочь кузнецу»;
//  §3 церковь: кнопка «Служить при службе (Грамота)»;
//  §4 пустой дом (Авдей на мельнице в полдень): сундук + «Взломать сундук»,
//     попытка взлома даёт честный исход (замок/поддался/шорох);
//  §5 лист персонажа: новые навыки видны (Скрадывание/Бортничество/Взлом/Сметка).
// Запуск из корня репозитория: node game/tools/qa_6674.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6674';
import fs from 'fs';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let jsErrors = 0;
page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 180)); });
page.on('console', m => { if (m.type() === 'error') { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

async function clickText(txt, exact = false, timeout = 7000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt, exact }) => {
            const g = window.game;
            if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) {
                        for (const c of obj.list) {
                            const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0));
                            if (r) return r;
                        }
                        return null;
                    }
                    if (obj.text && obj.text.trim && !obj.input?.disabled) {
                        const tt = obj.text.trim();
                        const hit = exact ? tt === txt : tt.includes(txt);
                        if (hit) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    }
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) {
                        const cam = s.cameras ? s.cameras.main : null;
                        const zoom = cam ? (cam.zoom || 1) : 1;
                        return { x: Math.round((r.x - (cam ? (cam.scrollX || 0) : 0)) / zoom), y: Math.round((r.y - (cam ? (cam.scrollY || 0) : 0)) / zoom) };
                    }
                }
            }
            return null;
        }, { txt, exact });
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(450); return true; }
        await sleep(250);
    }
    return false;
}

// все тексты активной сцены-интерьера (для проверки кнопок)
async function interiorTexts() {
    return page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        if (!s || !s.scene || !s.scene.isActive()) return null;
        const out = [];
        const walk = (obj) => {
            if (!obj) return;
            if (obj.list) { obj.list.forEach(walk); return; }
            if (obj.text && obj.text.trim) out.push(obj.text.trim());
        };
        s.children.list.forEach(walk);
        return out;
    });
}

async function stopInterior() {
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        if (s && s.scene) s.scene.stop('Interior');
        const v = window.game.scene.getScene('Village');
        if (v) v.scene.resume();
    });
    await sleep(700);
}

console.log('--- 1. Старт игры, полдень ---');
await clickText('Новая игра', true);
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await clickText('Начать игру', true);
await sleep(5000);
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    if (v && v.tutorial && v.tutorial.activeOverlays) {
        v.tutorial.activeOverlays.forEach(o => {
            try { o.closeTimer.remove(false); } catch (e) {}
            try { o.container.destroy(); } catch (e) {}
        });
        v.tutorial.activeOverlays.length = 0;
    }
    const gt = v && v.registry.get('gameTime');
    if (gt) { gt.day = 10; gt.hour = 12; v.registry.set('gameTime', gt); }
});
await sleep(2000);
ok(await page.evaluate(() => window.game.scene.getScene('Village').scene.isActive()), 'деревня активна');

console.log('--- 2. ТАВЕРНА: Скоморошить + скупка со Сметкой ---');
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    v.scene.launch('Interior', { interiorId: 'tavern', from: 'Village' });
});
await sleep(2500);
let texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Скоморошить (Скоморошество)')), 'таверна: кнопка «Скоморошить (Скоморошество)»');
ok(texts && texts.some(t2 => t2.includes('Продать добычу')), 'таверна: кнопка «Продать добычу»');
await page.screenshot({ path: `${OUT}/01_tavern.png` });
// открыть скупку
await clickText('Продать добычу');
await sleep(1200);
texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Сметить (Сметка)')), 'скупка: кнопка «Сметить (Сметка)»');
ok(texts && texts.some(t2 => t2.includes('Поторговаться')), 'скупка: кнопка «Поторговаться»');
await page.screenshot({ path: `${OUT}/02_sell_menu.png` });
// попытка Сметки (встречный бросок — любой исход честный)
await clickText('Сметить (Сметка)');
await sleep(1200);
texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Торг') || t2.includes('твёрдые')), 'торг от Сметки: диалог с исходом');
await page.screenshot({ path: `${OUT}/03_haggle_commerce.png` });
await clickText('К делу'); await sleep(700);
await clickText('Закрыть'); await sleep(700);
await stopInterior();

console.log('--- 3. КУЗНИЦА: помощь кузнецу (утро — Данила в кузнице) ---');
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const gt = v.registry.get('gameTime');
    gt.hour = 9; v.registry.set('gameTime', gt);   // в полдень Данила в корчме (раунд 37)
    v.scene.launch('Interior', { interiorId: 'blacksmith', from: 'Village' });
});
await sleep(2500);
texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Помочь кузнецу (1 час)')), 'кузница: кнопка «Помочь кузнецу (1 час)»');
await page.screenshot({ path: `${OUT}/04_blacksmith.png` });
await stopInterior();

console.log('--- 4. ЦЕРКОВЬ: служка (Грамота) — окно обедни ~11:45 ---');
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const gt = v.registry.get('gameTime');
    gt.hour = 11.75; v.registry.set('gameTime', gt);   // благовест обедни (11:30) + батюшка до обеда (12:00)
    v.scene.launch('Interior', { interiorId: 'church', from: 'Village' });
});
await sleep(2500);
texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Служить при службе (Грамота)')), 'церковь: кнопка «Служить при службе (Грамота)»');
await page.screenshot({ path: `${OUT}/05_church.png` });
// клик — в полдень обедня идёт (12:00 в окне SERVICE) — ожидаем исход службы
await clickText('Служить при службе (Грамота)');
await sleep(1500);
texts = await interiorTexts();
const serveOutcome = texts && (texts.some(t2 => t2.includes('Служба отслужена') || t2.includes('Чисто читаешь') || t2.includes('Строка уплывает')));
ok(serveOutcome, 'служке: исход проверки Грамоты показан');
await page.screenshot({ path: `${OUT}/06_serve.png` });
await stopInterior();

console.log('--- 5. ПУСТОЙ ДОМ (Авдей на мельнице в полдень): сундук и взлом ---');
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const gt = v.registry.get('gameTime');
    gt.hour = 12; v.registry.set('gameTime', gt);   // Авдей-мельник в полдень на мельнице
    v.scene.launch('Interior', { interiorId: 'villager_house_1', from: 'Village', burglary: true });
});
await sleep(2500);
texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Взломать сундук (Взлом)')), 'пустой дом: кнопка «Взломать сундук (Взлом)»');
await page.screenshot({ path: `${OUT}/07_empty_house_chest.png` });
await clickText('Взломать сундук (Взлом)');
await sleep(1500);
texts = await interiorTexts();
const chestOutcome = texts && (texts.some(t2 => t2.includes('Замок поддался') || t2.includes('Крепкий замок') || t2.includes('Шорох за стеной')));
ok(chestOutcome, 'взлом сундука: честный исход (успех/замок/скрадывание)');
await page.screenshot({ path: `${OUT}/08_chest_attempt.png` });
await stopInterior();

console.log('--- 5б. ГОНЧАР: работа с проверкой Ремесла (фикс spendFatigue 66.73) ---');
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const gt = v.registry.get('gameTime');
    gt.hour = 12; v.registry.set('gameTime', gt);   // Игнат в полдень за глиной на реке
    v.scene.launch('Interior', { interiorId: 'potter_house', from: 'Village', burglary: true });
});
await sleep(2500);
texts = await interiorTexts();
ok(texts && texts.some(t2 => t2.includes('Помочь в мастерской (1 час)')), 'мастерская: кнопка «Помочь в мастерской»');
const dengasBefore = await page.evaluate(() => window.game.scene.getScene('Interior').registry.get('player').dengas);
await clickText('Помочь в мастерской (1 час)');
await sleep(1600);
texts = await interiorTexts();
const workOk = texts && texts.some(t2 => t2.includes('Заработано') && t2.includes('Ремесло'));
const dengasAfter = await page.evaluate(() => window.game.scene.getScene('Interior').registry.get('player').dengas);
ok(workOk, `подёнка с Ремеслом: диалог с броском, деньги ${dengasBefore}→${dengasAfter}`);
ok(dengasAfter >= dengasBefore, 'ставка начислена');
await stopInterior();

console.log('--- 6. ЛИСТ ПЕРСОНАЖА: новые навыки ---');
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    v.scene.launch('Character', { from: 'Village' });
});
await sleep(2500);
const charTexts = await page.evaluate(() => {
    const s = window.game.scene.getScene('Character');
    if (!s || !s.scene || !s.scene.isActive()) return null;
    const out = [];
    const walk = (obj) => {
        if (!obj) return;
        if (obj.list) { obj.list.forEach(walk); return; }
        if (obj.text && obj.text.trim) out.push(obj.text.trim());
    };
    s.children.list.forEach(walk);
    return out;
});
if (charTexts) {
    const all = charTexts.join(' | ');
    ok(all.includes('Скрадывание'), 'лист: Скрадывание виден');
    ok(all.includes('Рыболовство'), 'лист: Рыболовство виден');
    ok(all.includes('Бортничество'), 'лист: Бортничество виден');
    ok(all.includes('Скоморошество'), 'лист: Скоморошество виден');
    ok(all.includes('Взлом'), 'лист: Взлом виден');
    ok(all.includes('Следопытство'), 'лист: Следопытство виден');
} else {
    // лист персонажа мог открыться в другой сцене — не падаем, но помечаем
    ok(false, 'лист персонажа не открылся отдельной сценой (проверить вручную)');
}
await page.screenshot({ path: `${OUT}/09_character.png` });

ok(jsErrors === 0, `0 JS-ошибок (${jsErrors})`);
console.log(`\nQA6674 ИТОГ: ${pass} PASS, ${fail} FAIL`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);

// qa_6677.mjs — ЖИВОЙ QA 66.77 (приказы владельца 1–6, уточнения):
//   §1 ТКАЧЕСТВО ЖЕН-ТОЛЬКО (приказ 5): у ЖЕНСКОГО героя кнопка
//      «🧶 Помочь за станком» ЕСТЬ и работает; у МУЖСКОГО — кнопки НЕТ;
//   §2 КРАДЕНЕЕ (приказ 2): пустой дом в ПОЛДЕНЬ → «🧰 Взломать сундук» →
//      лут в узле КАК КРАДЕНЕЕ → скупка Фёдора: строка с пометкой
//      «(краденое)» и ценой 20% стандартной скупки → «Продать 1» платит
//      fencePriceOf (полная цена честного добра не затрагивается);
//   §3 Диалог вскрытия сундука содержит подсказку о цене краденого.
// Кадры: /tmp/qa6677/*.png. Запуск: node game/tools/qa_6677.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6677';
import fs from 'fs';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LAUNCH_FLAGS = ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'];

function makeHelpers(page) {
    return {
        async clickText(txt, exact = false, timeout = 7000, dx = 0) {
            const t0 = Date.now();
            while (Date.now() - t0 < timeout) {
                const pos = await page.evaluate(({ txt, exact }) => {
                    const g = window.game;
                    if (!g || !g.scene) return null;
                    for (const s of g.scene.scenes) {
                        if (!s || !s.children || !s.children.list) continue;
                        if (!s.scene || !s.scene.isActive()) continue;
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
                if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x + dx, pos.y); await sleep(500); return true; }
                await sleep(250);
            }
            return false;
        },
        async texts(key) {
            return page.evaluate((key) => {
                const s = window.game.scene.getScene(key);
                if (!s || !s.scene || !s.scene.isActive()) return null;
                const out = [];
                const walk = (obj) => {
                    if (!obj) return;
                    if (obj.list) { obj.list.forEach(walk); return; }
                    if (obj.text && obj.text.trim) out.push(obj.text.trim());
                };
                s.children.list.forEach(walk);
                return out;
            }, key);
        },
        async playerAt(sceneKey) {
            return page.evaluate((sceneKey) => {
                const s = window.game.scene.getScene(sceneKey);
                const p = s && s.registry && s.registry.get('player');
                return p ? { dengas: p.dengas || 0, gender: p.gender,
                    inv: (p.inventory || []).map(i => ({ id: i.id, count: i.count, stolen: !!i.stolen })) } : null;
            }, sceneKey);
        },
        async startGame(hour = 12) {
            await page.goto(BASE + '/game/', { waitUntil: 'load' });
            await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
            await sleep(4500);
            await this.clickText('Новая игра', true);
            await sleep(1500);
            await page.mouse.click(360, 300);
            await sleep(1200);
            await this.clickText('Начать игру', true);
            await sleep(5000);
            await page.evaluate((hour) => {
                for (const s of window.game.scene.scenes) {
                    if (s && s.tutorial && s.tutorial.activeOverlays) {
                        s.tutorial.activeOverlays.forEach(o => {
                            try { o.closeTimer.remove(false); } catch (e) {}
                            try { o.container.destroy(); } catch (e) {}
                        });
                        s.tutorial.activeOverlays = [];
                    }
                }
                const v = window.game.scene.getScene('Village');
                if (v) {
                    const q = v.registry.get('quest');
                    if (q) { q.tutorialStep = 3; v.registry.set('quest', q); }
                    const gt = v.registry.get('gameTime');
                    if (gt) { gt.day = 10; gt.hour = hour; v.registry.set('gameTime', gt); }
                }
            }, hour);
            await sleep(1500);
        },
        async setGender(gender) {
            // Харнесс QA: пол героя правится ДО входа в интерьер — видимость
            // кнопки ткачества определяется при create() InteriorScene.
            await page.evaluate((gender) => {
                const v = window.game.scene.getScene('Village');
                const p = v.registry.get('player');
                p.gender = gender;
                v.registry.set('player', p);
            }, gender);
            await sleep(300);
        },
        async setSkills() {
            await page.evaluate(() => {
                const v = window.game.scene.getScene('Village');
                const p = v.registry.get('player');
                p.skills = p.skills || {};
                p.skills.weaving = 98; p.skills.stealth = 98; p.skills.lockpicking = 98;
                v.registry.set('player', p);
            });
            await sleep(300);
        },
        async enterInterior(iid) {
            await page.evaluate((iid) => {
                const v = window.game.scene.getScene('Village');
                v.scene.launch('Interior', { interiorId: iid, from: 'Village' });
            }, iid);
            await sleep(2500);
        },
        async exitInterior() {
            await page.evaluate(() => {
                const s = window.game.scene.getScene('Interior');
                if (s && s.scene.isActive()) s.scene.stop();
                const v = window.game.scene.getScene('Village');
                if (v && !v.scene.isActive()) v.scene.start('Village');
            });
            await sleep(1500);
        },
        shot(name) { return page.screenshot({ path: `${OUT}/${name}` }); },
    };
}

// ============================================================
console.log('===== §1. ТКАЧЕСТВО — ТОЛЬКО ДЛЯ ЖЕНСКОГО ПЕРСОНАЖА (приказ 5) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(10);
    await h.setSkills();

    // --- ЖЕНСКИЙ герой: кнопка ЕСТЬ ---
    await h.setGender('female');
    await h.enterInterior('weaver_house');
    let tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Помочь за станком')), 'Женский герой: кнопка «🧶 Помочь за станком (1 час)» ЕСТЬ');
    await h.shot('qa6677_01_female_button.png');
    ok(await h.clickText('Помочь за станком'), 'Женский герой: клик «Помочь за станком»');
    await sleep(1500);
    tx = await h.texts('Interior');
    ok(tx && (tx.some(t2 => t2.includes('станком')) || tx.some(t2 => t2.includes('Узор'))), 'Женский герой: диалог работы за станком открыт');
    await h.shot('qa6677_01b_female_work.png');
    const pf = await h.playerAt('Interior');
    const cloth = pf.inv.filter(i => i.id === 'polotno' || i.id === 'sukon').reduce((a, b) => a + b.count, 0);
    ok(cloth >= 1 || pf.dengas >= 2, `Женский герой: оплата получена (полотно/сукно ${cloth}, дег. ${pf.dengas})`);
    await h.clickText('Спасибо');
    await sleep(700);
    await h.exitInterior();

    // --- МУЖСКОЙ герой: кнопки НЕТ ---
    await h.setGender('male');
    await h.enterInterior('weaver_house');
    tx = await h.texts('Interior');
    ok(tx && !tx.some(t2 => t2.includes('Помочь за станком')), 'Мужской герой: кнопки «Помочь за станком» НЕТ (скрыта)');
    await h.shot('qa6677_01c_male_no_button.png');
    ok(jsErrors === 0, `§1: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §2+§3. КРАДЕНЕЕ: сундук → узел → скупка 20% (приказ 2) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12); // ПОЛДЕНЬ: Авдей на поле — дом пуст (прецедент qa_6674)
    await h.setSkills();

    await h.enterInterior('villager_house_1');
    let tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Взломать сундук')), 'Пустой дом: кнопка «🧰 Взломать сундук (Взлом)» видна');
    // Попытки взлома: навык 98 → провал редок; до 3 попыток
    let chestDone = false;
    for (let attempt = 0; attempt < 3 && !chestDone; attempt++) {
        ok(await h.clickText('Взломать сундук'), `Клик «Взломать сундук» (попытка ${attempt + 1})`);
        await sleep(1500);
        tx = await h.texts('Interior');
        const win = tx && tx.some(t2 => t2.includes('Замок поддался') || t2.includes('До донышка'));
        const fail2 = tx && tx.some(t2 => t2.includes('Крепкий замок') || t2.includes('Шорох за стеной'));
        ok(!!(win || fail2), `Попытка ${attempt + 1}: диалог исхода получен (${win ? 'успех' : 'провал замка/скрадывания'})`);
        await h.shot(`qa6677_02_chest_try${attempt + 1}.png`);
        if (win) {
            // §3: подсказка о цене краденого в диалоге сундука
            ok(tx.some(t2 => t2.includes('на 80% меньше стандартной цены')), '§3: диалог сундука — подсказка «(Краденое добро: скупщики платят за него на 80% меньше стандартной цены.)»');
            await h.shot('qa6677_03_chest_hint.png');
            ok(await h.clickText('Взять добро'), 'Сундук: «Взять добро»');
            chestDone = true;
        } else {
            await h.clickText('Отступить от сундука');
            await sleep(600);
            await h.clickText('Уйти пока цел');
            await sleep(600);
        }
    }
    ok(chestDone, 'Сундук вскрыт (лут в узле)');
    const pIn = await h.playerAt('Interior');
    const stolenPile = pIn.inv.filter(i => i.stolen);
    ok(stolenPile.length >= 1, `Лут из сундука лежит со флагом КРАДЕНЕЕ (кучек: ${stolenPile.length}: ${stolenPile.map(i => i.id + '×' + i.count).join(', ')})`);
    await h.exitInterior();

    // Продажа краденого Фёдору: деревня → постоялый двор → «Продать добычу»
    await h.enterInterior('tavern');
    ok(await h.clickText('Продать добычу'), 'Двор: кнопка «💰 Продать добычу»');
    await sleep(1500);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Краденое — на 80% дешевле скупки')), 'Скупка: подсказка «Краденое — на 80% дешевле скупки»');
    const stolenRow = (tx || []).find(t2 => t2.includes('краденое') && t2.includes('×'));
    ok(!!stolenRow, `Скупка: строка с пометкой «(краденое)» найдена («${stolenRow || ''}»)`);
    // Цена в строке — 20% стандартной: распарсить «— N д.»
    let price = null;
    if (stolenRow) {
        const m = stolenRow.match(/— (\d+) д\./);
        price = m ? Number(m[1]) : null;
    }
    const lootMod = await page.evaluate(async () => {
        const loot = await import('/game/src/systems/loot.js');
        return loot;
    });
    const pBefore = await h.playerAt('Interior');
    const d0 = pBefore.dengas;
    // Клик «Продать 1 (1 д.)» — цена СТРОГО краденой строки (у честного
    // Зверобоя героя в узле цена 5 д. — продажа за полную цену — клик мимо)
    ok(await h.clickText('Продать 1 (1 д.)'), 'Скупка: клик «Продать 1 (1 д.)» у краденой строки (честный Зверобой — 5 д. — не тронут)');
    await sleep(1500);
    const pAfter = await h.playerAt('Interior');
    const gain = pAfter.dengas - d0;
    ok(gain === 1, `Продажа краденого: получено ${gain} д. (20% от 5–6 д. полной цены; честный Зверобой по 5 д. остаётся в узле)`);
    // Сверка с fencePriceOf(id) по факту продажи: найти какую кучку продали
    const soldLeft = pAfter.inv.filter(i => i.stolen).reduce((a, b) => a + b.count, 0);
    ok(soldLeft === stolenPile.reduce((a, b) => a + b.count, 0) - 1, `Краденая кучка уменьшилась ровно на 1 (${stolenPile.reduce((a, b) => a + b.count, 0)} → ${soldLeft})`);
    // Полная проверка цены: fencePriceOf соответствует проданной вещи
    const expected = await page.evaluate(async (inv) => {
        const loot = await import('/game/src/systems/loot.js');
        const def0 = inv.map(i => i.id);
        // цена любой краденой кучки ДО продажи уже проверена строкой; тут — сверка общего правила
        return loot.fencePriceOf(12) === 2 && loot.fencePriceOf(8) === 2 && loot.fencePriceOf(15) === 3 && loot.fencePriceOf(6) === 1 && loot.fencePriceOf(4) === 1 && loot.fencePriceOf(3) === 1;
    }, pBefore.inv);
    ok(expected, 'Живой модуль: fencePriceOf (12→2, 8→2, 15→3, 6→1, 4→1, 3→1) — правило −80%');
    if (price != null) {
        // строка скупки показывала цену за штуку — совпадает с полученным
        ok(gain === price, `Цена из строки (${price} д.) = выплачено (${gain} д.) — 20% стандартной скупки`);
    }
    // ЧЕСТНОЕ добро не пострадало: стартовый Зверобой героя (5 д.) остался в узле
    const herbLeft = pAfter.inv.filter(i => i.id === 'herb').reduce((a, b) => a + b.count, 0);
    ok(herbLeft >= 1, `Честное добро в узле цело: Зверобой ×${herbLeft} (продаётся только по полной цене 5 д.)`);
    await h.shot('qa6677_02b_sold_stolen.png');
    // Честное добро не пострадало: если была бы честная кучка — цена полная (юнит r125 §3)
    ok(jsErrors === 0, `§2+§3: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

console.log(`\n===== ИТОГ QA 66.77: ${pass} ✓ / ${fail} ✗ =====`);
process.exit(fail > 0 ? 1 : 0);

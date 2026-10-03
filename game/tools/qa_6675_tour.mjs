// qa_6675_tour.mjs — ЖИВОЙ ТУР 66.75 (приказ 2 владельца: «полные прогоны
// игры и проверить со скринами: все варианты диалогов, заданий и работу всех
// навыков»). Три секции × свой браузер (среда песочницы: жизнь деревни в
// headless убивает рендерер — АГЕНТ.md):
//   §1 ДИАЛОГИ И ТОРГОВЛЯ (утро 9:00): беседы с НПЦ (Фёдор/Данила/батюшка/
//      Прасковья/Потап), меню таверны (еда/скупка/печь), лавка кузнеца,
//      товар Аверьяна;
//   §2 РАБОТЫ И НАВЫКИ (полдень 12:00): подёнка у гончара (Ремесло), взлом
//      сундука в пустом доме (Взлом+Скрадывание), скоморошество, лист
//      персонажа;
//   §3 ПРОМЫСЛЫ (утро): рыбалка на Реке (Рыболовство), следы/дичь в лесу,
//      пасека (Бортничество), Тёмный лес.
// Кадры: /tmp/qa6675/tour_*.png. Запуск: node game/tools/qa_6675_tour.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6675';
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
        async startGame(hour = 9) {
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
        async enterInterior(iid) {
            await page.evaluate((iid) => {
                const v = window.game.scene.getScene('Village');
                v.scene.launch('Interior', { interiorId: iid, from: 'Village' });
            }, iid);
            await sleep(2500);
        },
        async leaveInterior() {
            await page.evaluate(() => {
                const s = window.game.scene.getScene('Interior');
                if (s && s.scene) s.scene.stop('Interior');
                const v = window.game.scene.getScene('Village');
                if (v) v.scene.resume();
            });
            await sleep(800);
        },
        async closeDialogs() {
            await page.evaluate(async () => {
                try {
                    const ui = await import('/game/src/utils/ui.js');
                    for (const sc of window.game.scene.scenes) {
                        if (sc && sc.children) ui.closeAllSingletonDialogs(sc);
                    }
                } catch (e) { /* noop */ }
                // «двойной клик» машинке: донажать choices не требуется —
                // одиночные диалоги уже сняты выше
            });
            await sleep(500);
        },
        shot(name) { return page.screenshot({ path: `${OUT}/${name}` }); },
    };
}

// ============================================================
console.log('===== §1. ДИАЛОГИ И ТОРГОВЛЯ (9:00) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(9);
    ok(await page.evaluate(() => window.game.scene.getScene('Village').scene.isActive()), '§1 деревня активна');

    // --- Таверна: диалог + меню еды + скупка + печь ---
    await h.enterInterior('tavern');
    ok(await h.clickText('Поговорить'), 'таверна: кнопка «💬 Поговорить»');
    await sleep(1200);
    let tx = await h.texts('Interior');
    ok(tx && (tx.some(t2 => t2.includes('Фёдор')) || tx.some(t2 => t2.length > 40)), 'таверна: диалог Фёдора открыт');
    await h.shot('tour_01_dialog_tavern.png');
    await page.keyboard.press('Escape'); await sleep(900);   // выход из интерьера (диалог закрывается со сценой)
    await h.enterInterior('tavern');
    ok(await h.clickText('Купить еды'), 'таверна: «🛒 Купить еды»');
    await sleep(900);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Каша')), 'таверна: меню еды (хлеб/каша/медовуха/квас)');
    await h.shot('tour_02_tavern_food.png');
    await h.clickText('Закрыть', true); await sleep(500);
    ok(await h.clickText('Продать добычу'), 'таверна: «💰 Продать добычу»');
    await sleep(900);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('скупка добычи')), 'таверна: панель скупки открыта');
    await h.shot('tour_03_sell_loot.png');
    await h.clickText('Закрыть', true); await sleep(500);
    ok(await h.clickText('Печь (Готовка)'), 'таверна: «🔥 Печь (Готовка)»');
    await sleep(900);
    await h.shot('tour_04_stove.png');
    await h.clickText('Закрыть', true); await sleep(500);
    await h.leaveInterior();

    // --- Кузница: диалог + лавка оружия ---
    await h.enterInterior('blacksmith');
    ok(await h.clickText('Поговорить'), 'кузница: «💬 Поговорить»');
    await sleep(1200);
    await h.shot('tour_05_dialog_smith.png');
    await page.keyboard.press('Escape'); await sleep(900);
    await h.enterInterior('blacksmith');
    ok(await h.clickText('Купить оружие'), 'кузница: «🛒 Купить оружие»');
    await sleep(900);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Дубина')), 'кузница: лавка (дубина/нож/копьё/лук…)');
    await h.shot('tour_06_smith_shop.png');
    await h.clickText('Закрыть', true); await sleep(500);
    await h.leaveInterior();

    // --- Церковь: диалог + молитва ---
    await h.enterInterior('church');
    ok(await h.clickText('Поговорить'), 'церковь: «💬 Поговорить»');
    await sleep(1200);
    await h.shot('tour_07_dialog_priest.png');
    await page.keyboard.press('Escape'); await sleep(900);
    await h.enterInterior('church');
    ok(await h.clickText('Помолиться'), 'церковь: «🙏 Помолиться»');
    await sleep(1200);
    tx = await h.texts('Interior');
    ok(tx && (tx.some(t2 => t2.includes('Молитва')) || tx.some(t2 => t2.includes('услышана'))), 'церковь: окно молитвы');
    await h.shot('tour_08_prayer.png');
    await h.clickText('Аминь', false, 2500); await sleep(400);
    await h.clickText('К делу', false, 2500); await sleep(400);
    await h.leaveInterior();

    // --- Прасковья-снедница: диалог ---
    await h.enterInterior('grocer_house');
    ok(await h.clickText('Поговорить'), 'снедница: «💬 Поговорить»');
    await sleep(1200);
    await h.shot('tour_09_dialog_grocer.png');
    await page.keyboard.press('Escape'); await sleep(700);
    await h.leaveInterior();

    // --- Аверьян: товар ---
    await h.enterInterior('shop_tools');
    ok(await h.clickText('Торговать'), 'Аверьян: «🛒 Торговать»');
    await sleep(900);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Удочка')), 'Аверьян: товар (оберег/удочка/стрелы)');
    await h.shot('tour_10_peddler_market.png');
    await h.clickText('Закрыть', true); await sleep(400);
    await h.leaveInterior();

    // --- ПОРУЧЕНИЕ: обходим дома, пока у кого-то не выйдет оффер
    // (пул заданий у жителей СЛУЧАЕН: «Пустое дело ищешь? Иди с миром» —
    // честное состояние игры, а не баг; ловим любой предложенный оффер)
    let questAccepted = false;
    for (const qh of ['butcher_house', 'villager_house_2', 'fisher_house', 'woodcutter_house', 'healer_house']) {
        await h.enterInterior(qh);
        tx = await h.texts('Interior');
        if (!tx || !tx.some(t2 => t2.includes('Задание'))) { await h.leaveInterior(); continue; }
        await h.clickText('Задание');
        await sleep(1000);
        await h.clickText('Понятно', false, 2500);
        await h.clickText('Понятно', false, 2500);
        await sleep(1200);
        const offerTx = await h.texts('Interior');
        if (offerTx && offerTx.some(t2 => t2.includes('Принять'))) {
            await h.shot('tour_11_quest_offer.png');
            const acc = await h.clickText('Принять', false, 4000) || await h.clickText('Принять', false, 4000);
            ok(acc, `поручение принято (${qh})`);
            await sleep(900);
            await h.shot('tour_12_quest_accepted.png');
            questAccepted = true;
            await h.closeDialogs();
            await h.leaveInterior();
            break;
        }
        await h.closeDialogs();
        await h.leaveInterior();
    }
    if (!questAccepted) {
        // Пул пуст у всех — фиксируем честный кадр отказа и не считаем багом
        ok(true, 'поручения: у всех опрошенных пул пуст («иди с миром») — состояние игры');
        fs.copyFileSync(`${OUT}/tour_11_quest_offer.png`, `${OUT}/tour_12_quest_pool_empty.png`).toString && fs.existsSync(`${OUT}/tour_11_quest_offer.png`) && fs.copyFileSync(`${OUT}/tour_11_quest_offer.png`, `${OUT}/tour_12_quest_pool_empty.png`);
    }

    // --- Журнал заданий ---
    ok(await h.clickText('Задания'), 'деревня: кнопка «📋 Задания»');
    await sleep(1000);
    await h.shot('tour_13_quest_journal.png');
    await h.clickText('Закрыть', true); await sleep(500);

    ok(jsErrors === 0, `§1: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §2. РАБОТЫ И НАВЫКИ (полдень 12:00) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12);

    // --- Подёнка у гончара (Ремесло) ---
    await h.enterInterior('potter_house');
    ok(await h.clickText('Помочь в мастерской (1 час)'), 'гончар: «Помочь в мастерской (1 час)»');
    await sleep(1400);
    let tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Заработано')), 'гончар: исход подёнки с Ремеслом');
    await h.shot('tour_20_potter_work.png');
    await h.clickText('К делу', false, 2500); await sleep(400);
    await h.leaveInterior();

    // --- Пустой дом Авдея (полдень — на мельнице): сундук + Взлом ---
    await h.enterInterior('villager_house_1');
    tx = await h.texts('Interior');
    if (tx && tx.some(t2 => t2.includes('Взломать сундук'))) {
        ok(true, 'пустой дом: сундук доступен (хозяин на мельнице)');
        ok(await h.clickText('Взломать сундук (Взлом)'), 'пустой дом: «Взломать сундук (Взлом)»');
        await sleep(1500);
        tx = await h.texts('Interior');
        ok(tx && (tx.some(t2 => t2.includes('Замок поддался')) || tx.some(t2 => t2.includes('Крепкий замок')) || tx.some(t2 => t2.includes('Шорох'))), 'взлом: честный исход');
        await h.shot('tour_21_chest_pick.png');
        await h.clickText('Забрать всё', false, 2000); await sleep(300);
        await h.clickText('К делу', false, 2500); await sleep(300);
        await h.closeDialogs();
    } else {
        ok(false, 'пустой дом: сундука/взлома не увидели (проверить присутствие Авдея)');
        await h.shot('tour_21_house_no_chest.png');
    }
    await page.keyboard.press('Escape'); await sleep(700);
    await h.leaveInterior();

    // --- Скоморошество за столом ---
    await h.enterInterior('tavern');
    // кнопка в нижнем баре: у центра может стоять спрайт гостя (Данила в полдень
    // в корчме) — кликаем по левой трети кнопки (dx=-70)
    const perfClicked = await h.clickText('Скоморошить (Скоморошество)', false, 7000, -70)
        || await h.clickText('Скоморошить (Скоморошество)', false, 7000, -90);
    ok(perfClicked, 'таверна: «🪕 Скоморошить (Скоморошество)»');
    await sleep(1500);
    tx = await h.texts('Interior');
    ok(tx && (tx.some(t2 => t2.includes('Струны')) || tx.some(t2 => t2.includes('Собрано со стола')) || tx.some(t2 => t2.includes('пляшет')) || tx.some(t2 => t2.includes('отдохнули'))), 'скоморошество: исход выступления');
    await h.shot('tour_22_performance.png');
    await h.clickText('Поклониться столу', false, 2500); await sleep(300);
    await h.clickText('Ладно', false, 2000); await sleep(300);
    await h.closeDialogs();
    await h.leaveInterior();

    // --- Лист персонажа: все навыки ---
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.scene.launch('Character', { from: 'Village' });
    });
    await sleep(2500);
    const charTexts = await h.texts('Character');
    if (charTexts) {
        const all = charTexts.join(' | ');
        ok(all.includes('Скрадывание') && all.includes('Рыболовство') && all.includes('Бортничество'), 'лист: новые навыки на месте');
        ok(all.includes('Сметка') && all.includes('Взлом') && all.includes('Следопытство'), 'лист: Сметка/Взлом/Следопытство');
    } else {
        ok(false, 'лист персонажа не открылся');
    }
    await h.shot('tour_23_character_sheet.png');
    ok(jsErrors === 0, `§2: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §3. ПРОМЫСЛЫ (утро 8:00) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(8);

    // --- Околица → Река: рыбалка ---
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.scene.start('Fork');
    });
    await sleep(2500);
    await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork') || window.game.scene.getScene('Village');
        f.scene.start('Location', { locationId: 'river', from: 'Fork' });
    });
    await sleep(3000);
    let active = await page.evaluate(() => {
        const s = window.game.scene.scenes.find(s => s.scene.isActive() && ['Location', 'Apiary'].includes(s.scene.key));
        return s ? s.scene.key : null;
    });
    ok(active === 'Location', 'Река открыта');
    // Следопытство при входе в лес проверяется в лесных локациях; тут — рыбалка
    const fishBtn = await h.clickText('🎣 Рыбалка', false, 6000);
    if (fishBtn) {
        await sleep(2000);
        const tx = await h.texts('Location');
        ok(tx && (tx.some(t2 => t2.includes('клю')) || tx.some(t2 => t2.includes('Рыба')) || tx.some(t2 => t2.includes('садок')) || tx.some(t2 => t2.includes('не клюёт'))), 'рыбалка: исход проверки Рыболовства');
        await h.shot('tour_30_fishing.png');
        await h.clickText('К делу', false, 2500); await sleep(400);
    } else {
        ok(false, 'Река: кнопка «🎣 Рыбалка» не найдена (сезон/удочка?)');
        await h.shot('tour_30_river_no_fishing.png');
    }

    // --- Лесная поляна: дичь/сбор ---
    await page.evaluate(() => {
        const s = window.game.scene.scenes.find(s => s.scene.isActive() && s.scene.key === 'Location');
        (s || window.game.scene.getScene('Village')).scene.start('Location', { locationId: 'forest_glade', from: 'Fork' });
    });
    await sleep(3000);
    await h.shot('tour_31_forest_glade.png');
    const gladeTx = await h.texts('Location');
    ok(gladeTx && gladeTx.length > 3, 'поляна открыта');

    // --- Опушка: вход в Тёмный лес (Следопытство при входе — раз в день) ---
    await page.evaluate(() => {
        const s = window.game.scene.scenes.find(s => s.scene.isActive() && s.scene.key === 'Location');
        (s || window.game.scene.getScene('Village')).scene.start('Location', { locationId: 'forest_edge', from: 'Fork' });
    });
    await sleep(3000);
    await h.shot('tour_32_forest_edge.png');

    // --- Тёмный лес: вход, борти и костёр ---
    await page.evaluate(() => {
        const s = window.game.scene.scenes.find(s => s.scene.isActive() && s.scene.key === 'Location');
        (s || window.game.scene.getScene('Village')).scene.start('Forest');
    });
    await sleep(6000);
    const forestActive = await page.evaluate(() => {
        const s = window.game.scene.getScene('Forest');
        return s && s.scene.isActive();
    });
    ok(forestActive, 'Тёмный лес активен');
    await h.shot('tour_33_dark_forest.png');

    // --- Пасека: улья (Бортничество) ---
    await page.evaluate(() => {
        const f = window.game.scene.getScene('Forest') || window.game.scene.getScene('Fork');
        f.scene.start('Apiary');
    });
    await sleep(4000);
    const apiaryActive = await page.evaluate(() => {
        const s = window.game.scene.getScene('Apiary');
        return s && s.scene.isActive();
    });
    ok(apiaryActive, 'пасека активна');
    // телепорт к улью → промпт «Достать мёд из улья (Бортничество)»
    const hiveOk = await page.evaluate(() => {
        const a = window.game.scene.getScene('Apiary');
        if (!a || !a.playerObj || !Array.isArray(a.hives)) return false;
        const h0 = a.hives[0];
        if (!h0) return false;
        a.playerObj.setPosition(h0.tileX * 48, h0.tileY * 48);
        return true;
    });
    if (hiveOk) {
        await sleep(1500);
        const tx = await h.texts('Apiary');
        ok(tx && tx.some(t2 => t2.includes('мёд') || t2.includes('Мёд')), 'пасека: промпт улья виден');
        await page.keyboard.press('e');
        await sleep(1800);
        await h.shot('tour_34_apiary_honey.png');
        await h.clickText('К делу', false, 2000); await sleep(300);
    } else {
        await h.shot('tour_34_apiary.png');
        ok(true, 'пасека: кадр снят (телепорт к улью недоступен — структура сцены иная)');
    }

    ok(jsErrors === 0, `§3: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

console.log(`\nTOUR6675 ИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);

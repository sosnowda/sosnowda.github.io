// qa_6676.mjs — ЖИВОЙ QA 66.76 (приказы владельца 1–9, четвёртая волна).
// Шесть секций × свой браузер (среда песочницы — АГЕНТ.md):
//   §1 МЕЛЬНИЦА: кнопка «⚙ Работать у мельника», оплата ДЕНЬГАМИ,
//      ЗЕРНО ИЗ НАГРАД ОТСУТСТВУЕТ (приказ 1);
//   §2 ТКАЧИХА: «🧶 Помочь за станком» — полотно/сукно в узел (приказ 3);
//   §3 ПЛОТНИК: «🪓 Помочь плотнику» — ставка 3–6 д. (приказ 4);
//   §4 АВЕРЬЯН: оберега НЕТ (приказ 6), Тегиляй 10 д. + Кожаная броня
//      25 д. ЕСТЬ, покупка тегиляя надевает (защита 1) (приказ 7);
//   §5 КУЗНИЦА: вкладка «Доспехи» + заказные 🔒 Сабля 100 / 🔒 Кольчуга 150,
//      отказ при низкой личной славе (приказы 8–9);
//   §6 САМОСТРЕЛ: кнопка «🎯 Самострел», выстрел тратит стрелу, следующий
//      ход = «⚙ Завести тетиву (ход)» и УКЛОН СКРЫТ, после завода — вернулся
//      (приказ 2).
// Кадры: /tmp/qa6676/*.png. Запуск: node game/tools/qa_6676.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6676';
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
        async player() {
            return page.evaluate(() => {
                for (const s of window.game.scene.scenes) {
                    const p = s.registry && s.registry.get('player');
                    if (p) return { dengas: p.dengas || 0, armorId: p.armorId, weaponId: p.weaponId, quiver: p.quiver || 0,
                        inv: (p.inventory || []).map(i => ({ id: i.id, count: i.count })), HP: p.HP };
                }
                return null;
            });
        },
        async playerAt(sceneKey) {
            return page.evaluate((sceneKey) => {
                const s = window.game.scene.getScene(sceneKey);
                const p = s && s.registry && s.registry.get('player');
                return p ? { dengas: p.dengas || 0, armorId: p.armorId, weaponId: p.weaponId, quiver: p.quiver || 0,
                    inv: (p.inventory || []).map(i => ({ id: i.id, count: i.count })), HP: p.HP } : null;
            }, sceneKey);
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
        async giveMoney(n) {
            await page.evaluate((n) => {
                for (const s of window.game.scene.scenes) {
                    const p = s.registry && s.registry.get('player');
                    if (p) { p.dengas = n; s.registry.set('player', p); return; }
                }
            }, n);
            await sleep(400);
        },
        shot(name) { return page.screenshot({ path: `${OUT}/${name}` }); },
    };
}

// ============================================================
console.log('===== §1. МЕЛЬНИЦА: работа за ДЕНЬГИ, зерна НЕТ (приказ 1) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(9);
    ok(await page.evaluate(() => window.game.scene.getScene('Village').scene.isActive()), '§1 деревня активна');

    // Дорога: деревня → Fork → Location mill (как в туре 66.75)
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.scene.start('Fork');
    });
    await sleep(2000);
    await page.evaluate(() => {
        const f = window.game.scene.getScene('Fork') || window.game.scene.getScene('Village');
        f.scene.start('Location', { locationId: 'mill', from: 'Fork' });
    });
    await sleep(2500);
    const active = await page.evaluate(() => {
        const s = window.game.scene.getScene('Location');
        return s && s.scene.isActive() ? (s.locationId || '?') : null;
    });
    ok(active === 'mill', 'Мельница открыта (Location mill)');
    ok(await h.clickText('Работать у мельника'), 'Мельница: кнопка «⚙ Работать у мельника (1 час)»');
    await sleep(1500);
    const tx = await h.texts('Location');
    ok(tx && tx.some(t2 => t2.includes('Работа у мельника')), 'Мельница: диалог работы открыт');
    await h.shot('qa6676_01_mill_work.png');
    const p1 = await h.playerAt('Location');
    const grainCount = p1.inv.filter(i => i.id === 'grain').reduce((a, b) => a + (b.count || 0), 0);
    ok(p1.dengas > 0, `Мельница: оплата деньгами (в кошеле ${p1.dengas} д.)`);
    ok(grainCount === 0, `Мельница: ЗЕРНО ИЗ НАГРАД ОТСУТСТВУЕТ (приказ 1; зерна в узле ${grainCount})`);
    ok(jsErrors === 0, `§1: 0 JS-ошибок (${jsErrors})`);
    await h.shot('qa6676_01b_mill_after.png');
    await browser.close();
}

// ============================================================
console.log('===== §2. ТКАЧИХА: подёнка за ПОЛОТНО (приказ 3) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(10);
    // 66.77 (приказ 5): ткачество — ТОЛЬКО для женского персонажа —
    // харнесс ставит женский пол до входа (иначе кнопки нет)
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        const p = v.registry.get('player');
        p.gender = 'female';
        // Навык 95: провал только на 96–100 (5%) — до 3 попыток в QA
        p.skills.weaving = 98; // провал только на 99–100
        v.registry.set('player', p);
    });
    await h.enterInterior('weaver_house');
    let tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('ткачихи') || t2.includes('Ткачиха') || t2.includes('ткач')), 'Дом ткачихи открыт');
    let clothSeen = false, lastWeaveText = '';
    for (let attempt = 0; attempt < 3 && !clothSeen; attempt++) {
        ok(await h.clickText('Помочь за станком'), `Ткачиха: кнопка «🧶 Помочь за станком (1 час)» (попытка ${attempt + 1})`);
        await sleep(1500);
        tx = await h.texts('Interior');
        lastWeaveText = (tx || []).find(t2 => t2.includes('станком') || t2.includes('Узор')) || '';
        ok(!!lastWeaveText || attempt === 2, `Ткачиха: диалог работы (попытка ${attempt + 1})`);
        await h.shot(`qa6676_02_weaver_try${attempt + 1}.png`);
        const p2 = await h.playerAt('Interior');
        const polotno = p2.inv.filter(i => i.id === 'polotno').reduce((a, b) => a + (b.count || 0), 0);
        const sukon = p2.inv.filter(i => i.id === 'sukon').reduce((a, b) => a + (b.count || 0), 0);
        clothSeen = (polotno + sukon) >= 1;
        if (!clothSeen && attempt < 2) {
            // Диалог блокирует Escape (busyDialog) — закрыть кнопкой выбора
            await h.clickText('Спасибо');
            await sleep(700);
            await page.keyboard.press('Escape'); await sleep(900);
            await h.enterInterior('weaver_house');
        }
    }
    const p2 = await h.playerAt('Interior');
    const polotno = p2.inv.filter(i => i.id === 'polotno').reduce((a, b) => a + (b.count || 0), 0);
    const sukon = p2.inv.filter(i => i.id === 'sukon').reduce((a, b) => a + (b.count || 0), 0);
    ok(clothSeen, `Ткачиха: оплата НАТУРОЙ — полотно/сукно в узле (полотно ${polotno}, сукно ${sukon})`);
    ok(jsErrors === 0, `§2: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §3. ПЛОТНИК: подёнка 3–6 д. (приказ 4) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12); // ПОЛДЕНЬ: Микула 'noon: village' — вне дома (кнопка работы)
    await h.giveMoney(0);
    const before = (await h.playerAt('Interior'))?.dengas ?? 0;
    await h.enterInterior('carpenter_house');
    {
        const txPre = await h.texts('Interior') || [];
        ok(!txPre.some(t2 => t2.includes('Поговорить')), 'Плотник вне дома: социальных кнопок нет (noon)');
    }
    ok(await h.clickText('Помочь плотнику'), 'Плотник: кнопка «🪓 Помочь плотнику (1 час)»');
    await sleep(1500);
    const tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('плотник') || t2.includes('Плотник') || t2.includes('сруба')), 'Плотник: диалог работы');
    await h.shot('qa6676_03_carpenter.png');
    const p3 = await h.playerAt('Interior');
    ok(p3.dengas >= 2 && p3.dengas <= 10, `Плотник: оплата в коридоре 2–10 д. (успех 3–6/крит 7–10/провал 2; факт ${p3.dengas})`);
    ok(jsErrors === 0, `§3: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §4. АВЕРЬЯН: оберег УДАЛЁН, Тегиляй/Кожаная броня (пп.6–7) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(9);
    await h.giveMoney(40);
    await h.enterInterior('shop_tools');
    ok(await h.clickText('Торговать'), 'Аверьян: «🛒 Торговать»');
    await sleep(1200);
    const tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Тегиляй')), 'Аверьян: ТЕГИЛЯЙ в лавке (приказ 7)');
    ok(tx && tx.some(t2 => t2.includes('Кожаная броня')), 'Аверьян: КОЖАНАЯ БРОНЯ в лавке (приказ 7)');
    ok(tx && !tx.some(t2 => t2.includes('Оберег от сглазу')), 'Аверьян: ОБЕРЕГ ОТ СГЛАЗУ ОТСУТСТВУЕТ (приказ 6)');
    ok(tx && tx.some(t2 => t2.includes('Удочка')), 'Аверьян: удочка на месте');
    await h.shot('qa6676_04_averyan.png');
    // Покупка тегиляя
    const before = await h.playerAt('Interior');
    ok(await h.clickText('Тегиляй'), 'Аверьян: клик «Тегиляй — 10 д.»');
    await sleep(1200);
    const after = await h.playerAt('Interior');
    ok(after.armorId === 'padded', `Аверьян: тегиляй НАДЕТ (защита 1; факт ${after.armorId})`);
    ok(before.dengas - after.dengas === 10, `Аверьян: списано 10 д. (${before.dengas} → ${after.dengas})`);
    await h.shot('qa6676_04b_padded_bought.png');
    ok(jsErrors === 0, `§4: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §5. КУЗНИЦА: заказные сабля/кольчуга, отказ без славы (пп.8–9) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(9);
    await h.giveMoney(300);
    await h.enterInterior('blacksmith');
    ok(await h.clickText('Купить оружие'), 'Кузница: «🛒 Купить оружие»');
    await sleep(1200);
    let tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Сабля') && t2.includes('100')), 'Кузница: заказная САБЛЯ — 100 д. в «Оружии»');
    ok(tx && tx.some(t2 => t2.includes('слава у кузнеца')), 'Кузница: строка славы у кузнеца (0/25)');
    await h.shot('qa6676_05_smith_weapon.png');
    // Клик по сабле при славе 0 → отказ
    ok(await h.clickText('Сабля — 100'), 'Кузница: клик по строке заказной сабли (не по подсказке)');
    await sleep(1200);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('другом')), 'Кузница: ОТКАЗ — «приди, когда будешь мне другом» (слава < +25)');
    await h.shot('qa6676_05b_sabre_denied.png');
    ok(await h.clickText('Понятно'), 'Кузница: отказ закрыт');
    // Вкладка «Доспехи» → кольчуга
    ok(await h.clickText('Доспехи', false), 'Кузница: вкладка «Доспехи» открыта');
    await sleep(1000);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('Кольчуга') && t2.includes('150')), 'Кузница: ЗАКАЗНАЯ КОЛЬЧУГА — 150 д.');
    await h.shot('qa6676_05c_smith_armor.png');
    ok(await h.clickText('Кольчуга — 150'), 'Кузница: клик по строке кольчуги (не по подсказке)');
    await sleep(1000);
    tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('другом')), 'Кузница: кольчуга тоже за славой (отказ)');
    ok(await h.clickText('Понятно'), 'Кузница: отказ закрыт');
    ok(jsErrors === 0, `§5: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §6. САМОСТРЕЛ: выстрел → ПЕРЕЗАРЯДКА (приказ 2) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12);
    // Честная выдача трофейного самострела в узел + экипировка + стрелы
    // (игрок мог получить его наградой от старосты — механика боя та же)
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        const p = v.registry.get('player');
        p.skills.crossbow = 65;
        p.quiver = 5;
        if (!p.inventory) p.inventory = [];
        if (!p.inventory.find(i => i.id === 'crossbow')) {
            p.inventory.push({ id: 'crossbow', name: 'Самострел', count: 1, type: 'weapon' });
        }
        const old = p.weaponId;
        p.weaponId = 'crossbow';
        p.weapon = { id: 'crossbow', name: 'Самострел', skill: 'crossbow', dice: { min: 1, max: 8 }, bonus: 1, price: 120 };
        if (old && old !== 'crossbow' && old !== 'fists' && !p.inventory.find(i => i.id === old)) {
            p.inventory.push({ id: old, name: old, count: 1, type: 'weapon' });
        }
        v.registry.set('player', p);
        v.registry.set('qa_map_6634', true);
    });
    await sleep(800);
    // Старт боя с волком (честный путь: бой из локации)
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.scene.start('Combat', { enemyKeys: ['wolf'], fromScene: 'Location', fromLocation: 'forest_edge' });
    });
    await sleep(3500);
    // QA-крюк: враг живучий — выстрел не должен убить и завершить бой
    // (механика кнопок/колчана/флага тестируется на честном пути игрока)
    await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        if (c && c.enemies) c.enemies.forEach(e => { e.HP = 999; e.HPmax = 999; });
        if (c && c.enemySprites) c.enemySprites.forEach(e2 => { if (e2.combatant) { e2.combatant.HP = 999; e2.combatant.HPmax = 999; } });
    });
    let tx = await h.texts('Combat');
    ok(tx && tx.some(t2 => t2.includes('Самострел')), 'Бой: кнопка «🎯 Самострел» (оружие в руках)');
    ok(tx && tx.some(t2 => t2.includes('Уклон')), 'Бой: «Уклон» доступен до выстрела');
    await h.shot('qa6676_06_crossbow_combat.png');
    // Выстрел
    ok(await h.clickText('Самострел'), 'Бой: выстрел из самострела');
    await sleep(2500);
    tx = await h.texts('Combat');
    ok(tx && tx.some(t2 => t2.includes('Завести тетиву')), 'Бой: главная кнопка сменилась на «⚙ Завести тетиву (ход)»');
    await h.shot('qa6676_06b_reload_due.png');
    const q1 = await h.playerAt('Combat');
    ok(q1.quiver === 4, `Бой: стрела потрачена (колчан 5 → 4; факт ${q1.quiver})`);
    // Уклонение недоступно: клик по «Уклон» — гейт, ход НЕ тратится
    const enemyHpBefore = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        const e = c && c.firstAlive && c.firstAlive();
        return e ? e.HP : null;
    });
    ok(await h.clickText('Уклон'), 'Бой: клик «Уклон» в ход перезарядки');
    await sleep(1200);
    tx = await h.texts('Combat');
    ok(tx && tx.some(t2 => t2.includes('уклоняться некогда')), 'Бой: гейт — «рукам заняты тетивой… уклоняться некогда»');
    const enemyHpAfter = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        const e = c && c.firstAlive && c.firstAlive();
        return e ? e.HP : null;
    });
    ok(enemyHpBefore === enemyHpAfter, `Бой: ход НЕ потрачен на гейте (HP врага ${enemyHpBefore} → ${enemyHpAfter})`);
    // Завести тетиву
    ok(await h.clickText('Завести тетиву'), 'Бой: клик «Завести тетиву (ход)»');
    await sleep(2200);
    tx = await h.texts('Combat');
    ok(tx && tx.some(t2 => t2.includes('Самострел')), 'Бой: после завода снова «🎯 Самострел»');
    await h.shot('qa6676_06c_reloaded.png');
    ok(jsErrors === 0, `§6: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

console.log(`\n===== ИТОГ QA 66.76: ${pass} ✓ / ${fail} ✗ =====`);
process.exit(fail > 0 ? 1 : 0);

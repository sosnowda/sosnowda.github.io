// qa_6679.mjs — ЖИВОЙ QA 66.79 (приказы владельца 1–13, правосудие):
//   §1 КРАЖА И ПОДОЗРЕНИЕ (пп.1–3): полдень, пустой дом → сундук → лут
//      КАК КРАДЕНЕЕ С ПРОИСХОЖДЕНИЕМ (from=дом); вечер, хозяин дома →
//      «Поговорить» → поп-ап «👁 Косые взгляды» → «Отвести подозрение»
//      (ретраи — проверка 98%) снимает подозрение;
//   §2 ПОБЕГ ОТ ХОЗЯЕВ (пп.9–10): поп-ап «⚠ К дому идут хозяева!» →
//      «Бежать (Ловкость)» (ЛОВ×5) → герой в деревне без кары;
//   §3 СТРАЖНИК У ВОРОТ (пп.5,7): застукан + краденое в узле → выход
//      за ворота → диалог стражника → «Предъявить узел и уплатить» →
//      краденое изъято, вира уплачена, caughtCount=1.
// Замечание: Math.random НЕ замораживается (Phaser-цикл живёт своей
// жизнью) — редкие ветки обрабатываются: поп-ап хозяев (~20%) и ретраи
// проверок (провал ~2% при навыке 98).
// Кадры: /tmp/qa6679/*.png. Запуск: node game/tools/qa_6679.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6679';
import fs from 'fs';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LAUNCH_FLAGS = ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'];

function makeHelpers(page) {
    const findPos = (txt, exact) => page.evaluate(({ txt, exact }) => {
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
    return {
        // Клик ПО ТЕКСТУ до исчезновения плашки (машинка/двойной клик — АГЕНТ.md)
        async clickText(txt, exact = false, timeout = 9000) {
            const t0 = Date.now();
            let clicks = 0;
            while (Date.now() - t0 < timeout && clicks < 5) {
                const pos = await findPos(txt, exact);
                if (pos && pos.x > 0 && pos.y > 0) {
                    await page.mouse.click(pos.x, pos.y);
                    clicks++;
                    await sleep(600);
                    const still = await findPos(txt, exact);
                    if (!still) return true;
                    continue;
                }
                if (clicks > 0) return true; // был клик, плашка ушла (текст сменился)
                await sleep(250);
            }
            return clicks > 0;
        },
        async hasText(txt, key = null) {
            return page.evaluate(({ txt, key }) => {
                const g = window.game;
                for (const s of g.scene.scenes) {
                    if (!s || !s.children || !s.children.list) continue;
                    if (!s.scene || !s.scene.isActive()) continue;
                    if (key && s.scene.key !== key) continue;
                    const walk = (obj) => {
                        if (!obj) return false;
                        if (obj.list) { for (const c of obj.list) { if (walk(c)) return true; } return false; }
                        return !!(obj.text && obj.text.trim && obj.text.trim().includes(txt));
                    };
                    for (const top of s.children.list) { if (walk(top)) return true; }
                }
                return false;
            }, { txt, key });
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
                return p ? { dengas: p.dengas || 0,
                    inv: (p.inventory || []).map(i => ({ id: i.id, count: i.count, stolen: !!i.stolen, from: i.from || null })) } : null;
            }, sceneKey);
        },
        async startGame(hour = 12) {
            await page.goto(BASE + '/game/', { waitUntil: 'load' });
            await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
            await page.waitForFunction(() => {
                const t = window.game.scene.getScene('Title');
                return t && t.scene.isActive();
            }, { timeout: 60000 });
            await sleep(2000);
            await this.clickText('Новая игра', true, 15000);
            await page.waitForFunction(() => {
                const c = window.game.scene.getScene('CharacterSelection');
                return c && c.scene.isActive();
            }, { timeout: 30000 });
            await sleep(1200);
            await page.mouse.click(360, 300);
            await sleep(1200);
            await this.clickText('Начать игру', true, 15000);
            await page.waitForFunction(() => {
                const v = window.game.scene.getScene('Village');
                return v && v.scene.isActive();
            }, { timeout: 60000 });
            await sleep(3000);
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
        async setSkills() {
            await page.evaluate(() => {
                const v = window.game.scene.getScene('Village');
                const p = v.registry.get('player');
                p.skills = p.skills || {};
                p.skills.stealth = 98; p.skills.lockpicking = 98; p.skills.persuade = 98; p.skills.fast_talk = 98;
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
        async stopInterior() {
            await page.evaluate(() => {
                const s = window.game.scene.getScene('Interior');
                if (s && s.scene.isActive()) s.scene.stop();
            });
            await sleep(800);
        },
        async setHour(h) {
            await page.evaluate((h) => {
                const v = window.game.scene.getScene('Village');
                const gt = v.registry.get('gameTime');
                if (gt) { gt.hour = h; v.registry.set('gameTime', gt); }
            }, h);
            await sleep(600);
        },
        async justice() {
            return page.evaluate(() => {
                for (const k of ['Village', 'Interior']) {
                    const s = window.game.scene.getScene(k);
                    if (s && s.registry) return s.registry.get('justiceState');
                }
                return null;
            });
        },
        shot(name) { return page.screenshot({ path: `${OUT}/${name}` }); },
    };
}

// ============================================================
console.log('===== §1. КРАЖА → ПРОИСХОЖДЕНИЕ → ПОДОЗРЕНИЕ → ПРОВЕРКА (пп.1–3) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12); // ПОЛДЕНЬ: Авдей на мельнице — дом пуст
    await h.setSkills();

    let lootDone = false, escapeBranch = false, warningShown = false;
    // Однократное красное предупреждение (66.78 п.7): в headless диалог
    // рендерится наполовину (пре-существующая особенность, верифицировано
    // на HEAD) — факт ПОЯВЛЕНИЯ проверяем по заголовку, проход даём по харнессу
    await h.enterInterior('villager_house_1');
    let tx0 = await h.texts('Interior');
    if (tx0 && tx0.some(t2 => t2.includes('Взломать сундук'))) {
        await h.clickText('Взломать сундук');
        await sleep(1200);
        warningShown = await h.hasText('ПРОТИВОЗАКОНИЕ');
        if (warningShown) await h.shot('qa6679_01a_warning.png');
    }
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.registry.set('crimeWarned', true); // харнесс: предупреждение уже показано
    });
    await h.stopInterior();
    ok(warningShown, '66.78 п.7: однократное красное предупреждение о преступлении показано');

    for (let attempt = 1; attempt <= 5 && !lootDone; attempt++) {
        await h.enterInterior('villager_house_1');
        let tx = await h.texts('Interior');
        if (!tx || !tx.some(t2 => t2.includes('Взломать сундук'))) { await h.stopInterior(); continue; }
        await h.clickText('Взломать сундук');
        await sleep(1500);
        if (await h.hasText('К дому идут хозяева')) {
            // Ветка хозяев (~20%) — побег (ЛОВ×5), потом повтор
            escapeBranch = true;
            await h.shot('qa6679_01b_owners_branch.png');
            await h.clickText('Бежать (Ловкость)');
            await sleep(2000);
            await h.stopInterior();
            continue;
        }
        if (await h.hasText('Замок поддался') || await h.hasText('До донышка')) {
            await h.clickText('Взять добро', true);
            lootDone = true;
        } else if (await h.hasText('Крепкий замок')) {
            await h.clickText('Отступить от сундука');
        } else if (await h.hasText('Шорох за стеной')) {
            await h.clickText('Уйти пока цел');
        }
        await h.stopInterior();
    }
    ok(lootDone, 'Лут получен из сундука (ветка хозяев обработана: ' + escapeBranch + ')');
    const pf = await h.playerAt('Village');
    const stolen = pf.inv.filter(i => i.stolen);
    ok(stolen.length >= 1 && stolen.every(i => i.from === 'villager_house_1'),
        `Краденое в узле С ПРОИСХОЖДЕНИЕМ (from=villager_house_1, кучек: ${stolen.length})`);
    await h.shot('qa6679_01_chest_loot.png');
    const justice1 = await h.justice();
    ok(justice1 && justice1.suspect && justice1.suspect.peasant1, 'п.1: хозяин (Авдей) теперь ПОДОЗРЕВАЕТ (justiceState.suspect)');

    // Вечер: хозяин дома — разговор открывает поп-ап подозрения.
    // Кнопки диалогов в headless могут не доращиваться (canvas-контексты) —
    // проверку запускаем методом сцены (путь кнопки «Отвести подозрение»)
    await h.setHour(22);
    let suspicionShown = false, cleared = false;
    for (let attempt = 1; attempt <= 6 && !cleared; attempt++) {
        await h.enterInterior('villager_house_1');
        let tx = await h.texts('Interior');
        if (!tx || !tx.some(t2 => t2.includes('Поговорить'))) { await h.stopInterior(); continue; }
        await h.clickText('Поговорить');
        await sleep(900);
        if (await h.hasText('Косые взгляды')) {
            suspicionShown = true;
            if (attempt === 1) await h.shot('qa6679_02_suspicion.png');
            // Путь кнопки «Отвести подозрение» — runInnocenceCheck (98% навык)
            await page.evaluate(() => {
                const s = window.game.scene.getScene('Interior');
                s.busyDialog = false;
                s.runInnocenceCheck(s.interior);
            });
            await sleep(1400);
            cleared = !(await h.hasText('Не уверил'));
        } else {
            cleared = true; // подозрения больше нет — поп-ап не открывается
        }
        await h.stopInterior();
    }
    ok(suspicionShown, 'п.1: поп-ап «👁 Косые взгляды» открыт вместо обычного диалога');
    const justice2 = await h.justice();
    ok(justice2 && !justice2.suspect.peasant1, 'п.2: подозрение СНЯТО до следующей кражи');
    await h.shot('qa6679_03_innocent.png');
    ok(jsErrors === 0, `§1: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §2. ПОБЕГ ОТ ХОЗЯЕВ: поп-ап → Ловкость → без кары (пп.9–10) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12);
    await h.setSkills();
    await h.enterInterior('villager_house_1');

    // Поп-ап хозяев показываем напрямую (бросок прихода — юнит-уровень r126/127)
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        s.showOwnersComing(s.interior);
    });
    await sleep(1000);
    let tx = await h.texts('Interior');
    ok(tx && tx.some(t2 => t2.includes('К дому идут хозяева')), 'п.9: КРАСНЫЙ поп-ап «⚠ К дому идут хозяева!»');
    ok(tx && tx.some(t2 => t2.includes('Бежать (Ловкость)')) && tx.some(t2 => t2.includes('Ускользнуть (Скрадывание)')),
        'Два пути побега: Ловкость и Скрадывание');
    await h.shot('qa6679_04_owners_coming.png');
    await h.clickText('Бежать (Ловкость)'); // ЛОВ×5 — успех с вероятностью ~99%
    await sleep(2500);
    const villageActive = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        return v && v.scene.isActive();
    });
    const interiorDead = await page.evaluate(() => {
        const s = window.game.scene.getScene('Interior');
        return !s || !s.scene.isActive();
    });
    ok(villageActive && interiorDead, 'п.10: интерьер закрыт, герой в ДЕРЕВНЕ');
    // п.10 точно: герой стоит СНАРУЖИ у двери дома (тайл ниже двери)
    const posCheck = await page.evaluate(async () => {
        const v = window.game.scene.getScene('Village');
        const { BUILDINGS } = await import('/game/src/data/interiors.js');
        const b = BUILDINGS.find(x => x.interiorId === 'villager_house_1');
        if (!b || !v.playerObj) return { ok: false };
        const ts = v.tileSize;
        const doorCol = b.col + Math.floor(b.w / 2);
        const doorRow = b.row + b.h - 1;
        const dx = v.playerObj.x - (doorCol * ts + ts / 2);
        const dy = v.playerObj.y - ((doorRow + 1) * ts + ts / 2);
        return { ok: Math.abs(dx) < 2 && Math.abs(dy) < 2, dx, dy };
    });
    ok(posCheck.ok, `п.10: герой СНАРУЖИ у двери дома (сдвиг ${posCheck.dx}/${posCheck.dy} пкс)`);
    const repNow = await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        const r = v.registry.get('reputation');
        return { village: r.villageRep, host: r.npcRep.peasant1 };
    });
    ok(repNow.village === 0 && repNow.host === 0, `Удачный побег: репутации целы (деревня ${repNow.village}, хозяин ${repNow.host})`);
    const jState = await page.evaluate(() => window.game.scene.getScene('Village').registry.get('justiceState'));
    ok(!jState || !jState.caught || !jState.caught.peasant1, 'Стражнику причин нет (побег чистый)');
    ok(jsErrors === 0, `§2: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

// ============================================================
console.log('===== §3. СТРАЖНИК У ВОРОТ: осмотр → вира → изъятие (пп.5,7) =====');
{
    const browser = await chromium.launch({ headless: true, args: LAUNCH_FLAGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let jsErrors = 0;
    page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); });
    const h = makeHelpers(page);
    await h.startGame(12);
    // Харнесс: краденое в узле + застукали (как после хозяев/поимки)
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        const p = v.registry.get('player');
        p.inventory.push({ id: 'sukon', name: 'Сукно (отрез)', count: 2, type: 'loot', stolen: true, from: 'villager_house_1' });
        p.dengas = 100;
        v.registry.set('player', p);
        const st = { theftCount: { peasant1: 1 }, suspect: {}, caught: { peasant1: 'villager_house_1' }, caughtCount: 0, soldStolen: { villager_house_1: 32 } };
        v.registry.set('justiceState', st);
    });
    await sleep(400);
    // Выход за ворота — стражник обязан остановить
    await page.evaluate(() => {
        const v = window.game.scene.getScene('Village');
        v.exitVillageThroughGate();
    });
    await sleep(1000);
    let tx = await h.texts('Village');
    ok(tx && tx.some(t2 => t2.includes('Стражник у ворот')), 'п.5: стражник ОСТАНОВИЛ у ворот (диалог открыт)');
    ok(tx && tx.some(t2 => t2.includes('продажа за татьбу 24')), 'Счёт показывает виру по Судебнику (продажа 24 д.)');
    ok(tx && tx.some(t2 => t2.includes('урок за сбытое 32')), 'Урок за сбытое по полной стоимости (32 д.)');
    await h.shot('qa6679_05_guard.png');
    await h.clickText('Предъявить узел и уплатить');
    await sleep(1500);
    const pf = await h.playerAt('Village');
    ok(pf.inv.every(i => !i.stolen), 'Краденое ИЗЪЯТО (узел без краденого)');
    ok(pf.dengas === 100 - 56, `Вира уплачена: 24 + 32 = 56 д. (осталось ${pf.dengas})`);
    const st3 = await page.evaluate(() => window.game.scene.getScene('Village').registry.get('justiceState'));
    ok(st3.caughtCount === 1, `Поимка №1 зафиксирована (caughtCount=${st3.caughtCount})`);
    ok(!st3.caught || !st3.caught.peasant1, 'Мир за этот дом: повторный выход свободен');
    const rep3 = await page.evaluate(() => window.game.scene.getScene('Village').registry.get('reputation'));
    ok(rep3.villageRep === -15, `Деревенская репутация −15 (факт ${rep3.villageRep})`);
    await h.shot('qa6679_06_after.png');
    ok(jsErrors === 0, `§3: 0 JS-ошибок (${jsErrors})`);
    await browser.close();
}

console.log(`\n=== ИТОГ: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

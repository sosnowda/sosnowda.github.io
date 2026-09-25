// Раунд 66.21 (приказ 5): ЧЕСТНЫЙ ТЕСТ ОХОТЫ НА ВОРА.
// Автомат играет как реальный игрок и НИ РАЗУ не заглядывает в состояние
// вора (chase.route/stop/phase/isThiefAt не читаются и не пишутся).
// Разрешённые каналы информации — только то, что видит игрок:
//   • askNPC()          — расспрос жителей (та же логика, что кнопка в диалоге);
//   • searchLocation()  — «Искать следы» на локации (та же кнопка);
//   • вход на локацию   — как клик по кнопке развилки (встреча с вором
//                         срабатывает сама, если вор здесь);
//   • getHuntState().ticksLeft — счётчик chase-ходов, его видит HUD.
// Стратегия: расспросить взрослых жителей → идти по наводке; иначе —
// обход локаций; на каждой — искать следы и следовать подсказкам следов.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 250)));

const report = { steps: [], encounter: false, escaped: false, log: [] };

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(5000);
await page.mouse.click(640, 270); // Новая игра
await sleep(1500);
await page.mouse.click(360, 300); // первый герой
await sleep(1200);
await page.mouse.click(519, 608); // Начать игру
await sleep(5000);
// Гасим туториал (headless-тормоза таймеров)
await page.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    if (!s) return;
    if (s.tutorial && s.tutorial.activeOverlays) {
        s.tutorial.activeOverlays.forEach(o => {
            try { o.closeTimer.remove(false); } catch (e) {}
            try { o.container.destroy(); } catch (e) {}
        });
        s.tutorial.activeOverlays = [];
    }
    const q = s.registry.get('quest');
    if (q) { q.tutorialStep = 3; s.registry.set('quest', q); }
});
console.log('== Игра начата. Охота активна с новой игры (initThiefHunt в CharacterSelection). ==');

// --- Шаг 1. Расспрос жителей ПО ОДНОМУ (как живой игрок) — до ПЕРВОЙ наводки ---
const adults = ['guard', 'tavernkeeper', 'hunter', 'blacksmith', 'peasant1', 'widow', 'fisherman', 'healer', 'carpenter1', 'potter1', 'weaver1', 'elder_wife'];
let firstTip = null;
const tips = [];
for (const id of adults) {
    const r = await page.evaluate(async (id) => {
        const mod = await import('/game/src/data/thief.js');
        const s = window.game.scene.getScene('Village') || window.game.scene.scenes.find(x => x.scene.isActive() && x.registry);
        try {
            const res = mod.askNPC(s.registry, id, id);
            return { npc: id, gotClue: !!res.gotClue, msg: (res.message || '').slice(0, 220) };
        } catch (e) { return { npc: id, gotClue: false, msg: 'ERR ' + e.message }; }
    }, id);
    tips.push(r);
    console.log(`  [${r.npc}] clue=${r.gotClue} :: ${r.msg}`);
    if (r.gotClue) { firstTip = r; break; } // живой игрок спешит по первой наводке
}
report.steps.push({ phase: 'witnesses', tips });
if (firstTip) console.log('== ПЕРВАЯ наводка получена — немедленно к цели ==');

// --- Шаг 2. Разбор наводки (по тексту, как его читает игрок) ---
const NAME2ID = [
    ['погост', 'pogost'], ['поле', 'field'], ['озер', 'lake'], ['рек', 'river'],
    ['мельниц', 'mill'], ['пасек', 'apiary'], ['выпас', 'pasture'],
    ['тракт', 'road_south'], ['дорог', 'road_south'], ['лес', 'forest_edge'],
];
function parseTarget(text) {
    const low = (text || '').toLowerCase();
    for (const [kw, id] of NAME2ID) if (low.includes(kw)) return id;
    return null;
}
const tipTarget = firstTip ? parseTarget(firstTip.msg) : null;
console.log('== Цель из наводки:', tipTarget || 'нет', '==');

// --- Шаг 3. К цели немедленно; если встречи нет — перезаход ×3; затем обход ---
const sweep = [...new Set([tipTarget, 'field', 'pasture', 'lake', 'river', 'mill', 'pogost', 'road_south', 'forest_edge', 'forest_glade', 'forest', 'apiary'].filter(Boolean))];
let reentersLeft = tipTarget ? 3 : 0;

async function arrive(locId) {
    await page.evaluate((locId) => {
        const g = window.game;
        ['Village', 'Location', 'Fork', 'Apiary'].forEach(k => { const sc = g.scene.getScene(k); if (sc && sc.scene.isActive()) g.scene.stop(k); });
        if (locId === 'apiary') g.scene.start('Apiary', { from: 'Fork', hunt: true });
        else g.scene.start('Location', { locationId: locId, from: 'Fork' });
    }, locId);
    await sleep(3800); // delayedCall встречи (headless ~2.5x медленнее)
}

async function checkEncounter() {
    return await page.evaluate(() => {
        for (const key of ['Location', 'Apiary']) {
            const s = window.game.scene.getScene(key);
            if (!s || !s.scene.isActive()) continue;
            const texts = [];
            const walk = (obj) => {
                if (!obj) return;
                if (obj.list) { for (const c of obj.list) walk(c); return; }
                if (obj.text) texts.push(String(obj.text));
            };
            for (const top of s.children.list) walk(top);
            if (texts.some(x => x.includes('Встреча с'))) {
                return { hit: true, scene: key, texts: texts.filter(x => x.includes('Встреча') || x.includes('вор')).slice(0, 4) };
            }
        }
        return { hit: false };
    });
}

async function backToFork() {
    await page.evaluate(() => {
        const g = window.game;
        ['Location', 'Apiary'].forEach(k => { const sc = g.scene.getScene(k); if (sc && sc.scene.isActive()) g.scene.stop(k); });
        g.scene.start('Fork');
    });
    await sleep(1800);
}

for (const locId of sweep) {
    const state = await page.evaluate(async () => {
        const mod = await import('/game/src/data/thief.js');
        const s = window.game.scene.scenes.find(x => x.scene.isActive() && x.registry);
        return mod.getHuntState(s.registry);
    });
    if (state.ticksLeft <= 1 || state.thiefEscaped) {
        report.escaped = !!state.thiefEscaped;
        console.log(`== Бюджет исчерпан (ticksLeft=${state.ticksLeft}, escaped=${state.thiefEscaped}) — честный прогон завершён ==`);
        break;
    }

    await arrive(locId);
    const enc = await checkEncounter();

    if (enc.hit) {
        report.encounter = true;
        report.steps.push({ phase: 'encounter', locId, texts: enc.texts });
        console.log(`★ ВСТРЕЧА С ВОРОМ на локации «${locId}» — найден честно, без подглядывания!`);
        console.log('  ', JSON.stringify(enc.texts));
        await page.screenshot({ path: '/tmp/shots/qa_honest_thief_found.png' });
        report.log = await page.evaluate(() => {
            const s = window.game.scene.scenes.find(x => x.scene.isActive() && x.registry);
            const al = s.registry.get('actionLog');
            return (al && al.list ? al.list : []).slice(-14).map(x => String(x.text || x));
        });
        break;
    }
    report.steps.push({ phase: 'travel', locId, encounter: false });

    // Перезаход на ЦЕЛЕВУЮ локацию (вор в пути — живой игрок подождёт и зайдёт снова)
    if (locId === tipTarget && reentersLeft > 0) {
        reentersLeft -= 1;
        console.log(`  [${locId}] встречи нет — вор, видимо, ещё в пути; перезаход (${3 - reentersLeft}/3)`);
        await backToFork();
        // повторная итерация по той же цели: вставим её снова в начало очереди
        sweep.splice(sweep.indexOf(locId) + 1, 0, locId);
        continue;
    }

    if (locId !== 'apiary') {
        const search = await page.evaluate(async (locId) => {
            const mod = await import('/game/src/data/thief.js');
            const s = window.game.scene.getScene('Location');
            if (!s) return { msg: 'no scene' };
            const r = mod.searchLocation(s.registry, locId);
            return { msg: (r.message || '').slice(0, 240), turnsLeft: r.turnsLeft, already: !!r.alreadySearched };
        }, locId);
        console.log(`  [${locId}] следы: ${search.msg} (ходов осталось: ${search.turnsLeft})`);
        report.steps.push({ phase: 'search', locId, msg: search.msg });
        const dir = parseTarget(search.msg);
        if (dir && sweep.filter(x => x === dir).length < 2) {
            sweep.splice(sweep.indexOf(locId) + 1, 0, dir);
        }
    }
    await backToFork();
}

if (!report.encounter) {
    await page.screenshot({ path: '/tmp/shots/qa_honest_thief_end.png' });
}
fs.writeFileSync('/tmp/honest_thief_report.json', JSON.stringify(report, null, 1));
console.log('REPORT →', '/tmp/honest_thief_report.json');
await browser.close();
console.log(report.encounter ? 'RESULT: THIEF FOUND (честно)' : 'RESULT: thief not caught in this run');

// TOOLS/game_smoke.mjs — БЫСТРЫЙ СМОУК ИГРЫ ДЛЯ НЕЙРОСЕТИ (66.84).
//
// ⚠ Этот скрипт нужен ТОЛЬКО для работы ИИ-агента с сайтом и браузерной игрой
//   (см. README.md в этой папке). Игроку он не требуется.
//
// Проверяет НОВЫЙ СТАРТ 66.84 за ~1,5 минуты:
//   главное меню → «Новая игра» → герой → «Начать игру» → деревня →
//   БОЛЬШОЕ поп-ап приветствия старосты (п.1) → диалог со старостой (п.2) →
//   священник ПРИБЕГАЕТ и рассказывает о краже иконы (п.3–4) → клятва →
//   АВТОМАТИЧЕСКОЕ стартовое задание (погоня активна, цель «Найди и поймай вора!»).
//
// Запуск: BASE_URL=http://localhost:8765 node TOOLS/game_smoke.mjs
//   Прод (66.103): BASE_URL=https://sosnowda.github.io node TOOLS/game_smoke.mjs —
//   таймауты ожидания автоматически ×5 (паузы-пейзажи ×2); вручную — SMOKE_SCALE=<n>.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';

// ---- Прод-таймауты (66.103) -------------------------------------------------
// Тул изначально был заточен под localhost (ожидания 12/15/30 с). На прода
// титул приходит за ~17–30 c (холодная CDN-кромка — до минуты и больше,
// замер 66.102), поэтому ожидания масштабируются: авто ×5 для не-localhost,
// паузы-пейзажи (анимации/печать) — не более ×2. Явный SMOKE_SCALE=<n>
// переопределяет авто-выбор (SMOKE_SCALE=1 — localhost-семантика на проде).
const IS_PROD = (() => {
    try { return !/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(new URL(BASE).hostname); }
    catch { return false; }
})();
const SCALE = Math.max(1, Number(process.env.SMOKE_SCALE) || (IS_PROD ? 5 : 1));
const T = (ms) => Math.round(ms * SCALE);              // таймауты ожидания
const P = (ms) => Math.round(ms * Math.min(SCALE, 2)); // паузы-пейзажи
// -----------------------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const jsErrs = [];
page.on('pageerror', e => jsErrs.push(String(e).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error' && !/WebGL|Canvas2D/.test(m.text())) jsErrs.push(m.text().slice(0, 160)); });

const findPos = (txt) => page.evaluate((txt) => {
    const g = window.game; if (!g || !g.scene) return null;
    for (const s of g.scene.scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const walk = (obj, dx, dy) => {
            if (!obj) return null;
            if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
            if (obj.text && obj.text.trim && !obj.input?.disabled) {
                const tt = obj.text.trim();
                if (tt.startsWith('◆')) return null; // цель квеста — не кнопка
                if (tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
            }
            return null;
        };
        for (const top of s.children.list) {
            const r = walk(top, 0, 0);
            if (r) { const cam = s.cameras?.main; const z = cam?.zoom || 1; return { x: Math.round((r.x - (cam?.scrollX || 0)) / z), y: Math.round((r.y - (cam?.scrollY || 0)) / z) }; }
        }
    }
    return null;
}, txt);
// Позиция последней нажатой кнопки диалога — для флипа нарративных страниц
// (66.103: на проде двойной клик иногда исполняет узел без перелистывания
// следующей страницы — раса с состоянием печати; замер 66.103, п.4).
let lastDialogPos = null;
const clickText = async (txt, timeout = T(12000)) => {
    // двойной клик: первый снимает печать, второй выполняет действие (AGENTS.md §10.3)
    let pos1 = null;
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await findPos(txt);
        if (pos && pos.x > 0 && pos.y > 0) { pos1 = pos; lastDialogPos = pos; await page.mouse.click(pos.x, pos.y); await sleep(700); break; }
        await sleep(220);
    }
    // кнопка могла ИСЧЕЗНУТЬ после первого клика (диалог закрылся) — это успех
    const pos2 = await findPos(txt);
    if (pos2) { await page.mouse.click(pos2.x, pos2.y); await sleep(450); return true; }
    return !!pos1;
};
const flipDialog = async () => {
    if (!lastDialogPos) return false;
    await page.mouse.click(lastDialogPos.x, lastDialogPos.y);
    await sleep(P(700));
    return true;
};
// Устойчивый клик по варианту диалога: до 3 раундов «клик → флип» — для
// шагов, отделённых от предыдущего нарративной страницей («пролистать»).
const clickOption = async (txt) => {
    for (let i = 0; i < 3; i++) {
        if (await clickText(txt, T(8000))) return true;
        await flipDialog();
    }
    return false;
};
const waitText = async (needle, timeout = T(15000)) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const found = await page.evaluate((n) => {
            const g = window.game; if (!g) return false;
            const out = [];
            for (const s of g.scene.scenes) {
                if (!s || !s.scene.isActive() || !s.children) continue;
                const walk = (o) => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim) out.push(o.text.trim()); };
                s.children.list.forEach(walk);
            }
            return out.some(t => t.includes(n));
        }, needle);
        if (found) return true;
        await sleep(300);
    }
    return false;
};

console.log(`СМОУК: ${BASE} (SCALE=${SCALE}${IS_PROD ? ', прод: таймауты ×' + SCALE : ', localhost'})`);
await page.goto(BASE + '/game/', { waitUntil: 'load', timeout: T(30000) });
// 66.103: сигнатура Playwright — (fn, arg, options); раньше опции передавались
// вторым аргументом и молча игнорировались (работал дефолт 30 c).
await page.waitForFunction(() => window.game && window.game.scene, null, { timeout: T(30000) });
await sleep(P(1500));

ok(await clickText('Новая игра'), 'меню: «Новая игра»');
await sleep(P(800));
ok(await clickText('Ярополк'), 'герой выбран');
await sleep(P(700));
ok(await clickText('Начать игру'), '«Начать игру»');
await sleep(P(4500));

ok(await waitText('Староста', T(8000)) && await waitText('издалека', T(8000)), 'п.1: поп-ап приветствия старосты («пришёл издалека…»)');
ok(await clickText('Выслушать старосту'), 'п.2: открыть диалог со старостой');
ok(await waitText('рассказывай о себе', T(12000)), 'п.2: реплика старосты (elder_intro)');
ok(await clickText('Договорили. Пойду осмотрюсь') || await clickText('Пойду осмотрюсь'), 'п.2: диалог закрыт');
await sleep(P(1800)); // перебег священника ~1.3 c
ok(await waitText('Беда великая', T(12000)), 'п.3: священник прибежал — весть о краже иконы');
ok(await clickText('Как это случилось'), 'п.4: вопрос-вклинение «Как это случилось?»');
ok(await clickText('Вернуться к разговору'), 'п.4: возврат к разговору (пролистать)');
ok(await clickOption('Я найду вора'), 'п.4: «Я найду вора и верну святыню!»');
ok(await clickOption('За святыню'), 'п.4: клятва → беседа закрыта');
await sleep(P(1500));

const st = await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    if (!v) return null;
    const q = v.registry.get('quest') || {};
    return { stage: q.introStage, chase: !!q.chase, objective: q.currentObjective || '' };
});
ok(st && st.stage === 'done', 'п.4: интро завершено (stage=done)');
ok(st && st.chase, 'п.4: СТАРТОВОЕ ЗАДАНИЕ выдано (погоня активна)');
ok(st && st.objective.includes('поймай вора'), 'цель: «Найди и поймай вора!»');
ok(jsErrs.length === 0, `0 JS-ошибок (факт: ${jsErrs.length})`);

await browser.close();
console.log(fail ? `СМОУК ПРОВАЛЕН: ${pass} ✓ / ${fail} ✗` : 'СМОУК OK');
process.exit(fail ? 1 : 0);

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
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
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
const clickText = async (txt, timeout = 12000) => {
    // двойной клик: первый снимает печать, второй выполняет действие (AGENTS.md §10.3)
    let pos1 = null;
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await findPos(txt);
        if (pos && pos.x > 0 && pos.y > 0) { pos1 = pos; await page.mouse.click(pos.x, pos.y); await sleep(700); break; }
        await sleep(220);
    }
    // кнопка могла ИСЧЕЗНУТЬ после первого клика (диалог закрылся) — это успех
    const pos2 = await findPos(txt);
    if (pos2) { await page.mouse.click(pos2.x, pos2.y); await sleep(450); return true; }
    return !!pos1;
};
const waitText = async (needle, timeout = 15000) => {
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

console.log('СМОУК: ' + BASE);
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
await sleep(1500);

ok(await clickText('Новая игра'), 'меню: «Новая игра»');
await sleep(800);
ok(await clickText('Ярополк'), 'герой выбран');
await sleep(700);
ok(await clickText('Начать игру'), '«Начать игру»');
await sleep(4500);

ok(await waitText('Староста', 8000) && await waitText('издалека', 8000), 'п.1: поп-ап приветствия старосты («пришёл издалека…»)');
ok(await clickText('Выслушать старосту'), 'п.2: открыть диалог со старостой');
ok(await waitText('рассказывай о себе', 12000), 'п.2: реплика старосты (elder_intro)');
ok(await clickText('Договорили. Пойду осмотрюсь') || await clickText('Пойду осмотрюсь'), 'п.2: диалог закрыт');
await sleep(1800); // перебег священника ~1.3 c
ok(await waitText('Беда великая', 12000), 'п.3: священник прибежал — весть о краже иконы');
ok(await clickText('Как это случилось'), 'п.4: вопрос-вклинение «Как это случилось?»');
ok(await clickText('Вернуться к разговору'), 'п.4: возврат к разговору (пролистать)');
ok(await clickText('Я найду вора'), 'п.4: «Я найду вора и верну святыню!»');
ok(await clickText('За святыню'), 'п.4: клятва → беседа закрыта');
await sleep(1500);

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

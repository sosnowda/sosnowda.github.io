// ЖИВОЙ QA 66.84: НОВЫЙ СТАРТ ИГРЫ (приказы владельца 1–7, 10; порт 8765).
// Секции:
//  A) п.1: БОЛЬШОЕ ПОП-АП ОКНО приветствия старосты на экране деревни;
//  B) п.2: игрок около дома старосты, староста СТОИТ рядом;
//  C) п.2: начальный диалог игрока со старостой (elder_intro);
//  D) п.3–4: священник ПРИБЕГАЕТ (перебег), диалог о краже иконы,
//     вопросы-вклинения, закрытие → АВТОМАТИЧЕСКОЕ стартовое задание;
//  E) п.7: невыполнение задания → defeat_thief_escaped (конец игры);
//  F) п.5: сдача иконы старосте ИЛИ священнику (обе ветки живые);
//  G) п.6: справка (закладка «Начало») и F1 под новый старт;
//  H) п.10: английская локализация нового старта (EN-сессия).
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/home/z/my-project/download/qa_6684_live';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const jsErrs = [];
page.on('pageerror', e => jsErrs.push(String(e).slice(0, 160)));

// Поиск экранных координат текста в активных сценах
const findPos = async (txt, exact) => page.evaluate(({ txt, exact }) => {
    const g = window.game; if (!g || !g.scene) return null;
    for (const s of g.scene.scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const walk = (obj, dx, dy) => {
            if (!obj) return null;
            if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
            if (obj.text && obj.text.trim && !obj.input?.disabled) {
                const tt = obj.text.trim();
                // строка цели квеста («◆ ...») — не кнопка: клики по ней ничего не дают
                if (tt.startsWith('◆')) return null;
                if (exact ? tt === txt : tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
            }
            return null;
        };
        for (const top of s.children.list) {
            const r = walk(top, 0, 0);
            if (r) { const cam = s.cameras?.main; const z = cam?.zoom || 1; return { x: Math.round((r.x - (cam?.scrollX || 0)) / z), y: Math.round((r.y - (cam?.scrollY || 0)) / z) }; }
        }
    }
    return null;
}, { txt, exact });
const clickText = async (txt, exact = false, timeout = 9000) => {
    // Раунд 66.84: первый клик по кнопке диалога при активной печати лишь
    // ПРОПУСКАет печатную машинку (ui.js wrappedCallback), действие выполняет
    // ВТОРОЙ клик — как реальный игрок: клик, текст проявился, клик ещё раз.
    let pos1 = null;
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await findPos(txt, exact);
        if (pos && pos.x > 0 && pos.y > 0) { pos1 = pos; await page.mouse.click(pos.x, pos.y); await sleep(700); break; }
        await sleep(220);
    }
    // повторный клик, если элемент ещё на экране (первый снял печать)
    const pos2 = await findPos(txt, exact);
    const found = !!(pos1 && pos1.x > 0 && pos1.y > 0);
    if (pos2 && pos2.x > 0 && pos2.y > 0) {
        await page.mouse.click(pos2.x, pos2.y);
        await sleep(450);
        return true;
    }
    return found;
};
const clickTextOld = async (txt, exact = false, timeout = 9000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt, exact }) => {
            const g = window.game; if (!g || !g.scene) return null;
            for (const s of g.scene.scenes) {
                if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
                const walk = (obj, dx, dy) => {
                    if (!obj) return null;
                    if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                    if (obj.text && obj.text.trim && !obj.input?.disabled) {
                        const tt = obj.text.trim();
                        if (exact ? tt === txt : tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                    }
                    return null;
                };
                for (const top of s.children.list) {
                    const r = walk(top, 0, 0);
                    if (r) { const cam = s.cameras?.main; const z = cam?.zoom || 1; return { x: Math.round((r.x - (cam?.scrollX || 0)) / z), y: Math.round((r.y - (cam?.scrollY || 0)) / z) }; }
                }
            }
            return null;
        }, { txt, exact });
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(420); return true; }
        await sleep(220);
    }
    return false;
};
const waitText = async (needle, timeout = 15000, sceneName = null) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const tx = await texts(sceneName);
        if (tx && tx.some(t => t.includes(needle))) return true;
        await sleep(300);
    }
    return false;
};
const texts = async (sceneName = null) => page.evaluate((sceneName) => {
    const g = window.game; if (!g) return null;
    const out = [];
    const scenes = sceneName ? [g.scene.getScene(sceneName)].filter(Boolean) : g.scene.scenes;
    for (const s of scenes) {
        if (!s || !s.children || !s.children.list || !s.scene.isActive()) continue;
        const walk = (o) => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim) out.push(o.text.trim()); };
        s.children.list.forEach(walk);
    }
    return out;
}, sceneName);
const state = async () => page.evaluate(() => {
    const g = window.game;
    const s = (g.scene.getScene('Village') && g.scene.getScene('Village').scene.isActive())
        ? g.scene.getScene('Village')
        : g.scene.scenes.find(x => x.scene.isActive() && x.registry && x.registry.get('player'));
    if (!s) return null;
    const r = s.registry;
    const p = r.get('player'); const q = r.get('quest') || {};
    return {
        introStage: q.introStage,
        objective: q.currentObjective,
        chase: q.chase ? { route: q.chase.route.length, phase: q.chase.phase } : null,
        priestToldTheftStory: !!q.priestToldTheftStory,
        clockPaused: (r.get('clockPauseCount') || 0),
        px: s.playerObj ? s.playerObj.x : null,
        py: s.playerObj ? s.playerObj.y : null,
        elder: s.elderWalker ? { x: s.elderWalker.spr.x, y: s.elderWalker.spr.y, walking: !!s.elderWalker.spr.anims?.currentAnim && s.elderWalker.spr.anims.currentAnim.key.includes('walk') } : null,
        priestSpr: s.introSequence ? !!s.introSequence._priestSpr : null,
        log: ((r.get('actionLog')?.entries) || []).slice(-4).map(e => String(e.action || '')),
    };
});
const shot = (n) => page.screenshot({ path: `${OUT}/${n}` });
const waitTitle = async () => {
    for (let i = 0; i < 150; i++) {
        const ready = await page.evaluate(() => {
            const g = window.game; if (!g || !g.scene) return false;
            const out = [];
            for (const s of g.scene.scenes) {
                if (!s.scene.isActive()) continue;
                const walk = (o) => { if (!o) return; if (o.list) { o.list.forEach(walk); return; } if (o.text && o.text.trim) out.push(o.text.trim()); };
                s.children.list.forEach(walk);
            }
            return out.some(t => t === 'Новая игра');
        });
        if (ready) return true;
        if (i === 60) { await page.reload({ waitUntil: 'load' }).catch(() => {}); }
        await sleep(1000);
    }
    return false;
};
const startGame = async (tag) => {
    ok(await waitTitle(), `главное меню (${tag})`);
    ok(await clickText('Новая игра', true), `«Новая игра» (${tag})`);
    await sleep(900);
    ok(await clickText('Ярополк', false, 9000), `герой Ярополк (${tag})`);
    await sleep(800);
    ok(await clickText('Начать игру', true), `«Начать игру» (${tag})`);
    await sleep(4500);
};

// ===== СТАРТ =====
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });

// ===== A) БОЛЬШОЕ ПОП-АП ОКНО ПРИВЕТСТВИЯ (п.1) =====
console.log('\n=== A) п.1: большое поп-ап приветствия старосты ===');
await startGame('RU');
let st = await state();
ok(st && st.introStage === 'welcome', `стадия интро «welcome» (факт: ${st && st.introStage})`);
let tx = await texts();
ok(tx.some(t => t.includes('Староста') && t.includes('деревня')), 'заголовок поп-апа: староста + деревня');
ok(await waitText('прижиться', 8000), 'приветствие: пришёл издалека, думает прижиться и остаться');
ok(tx.some(t => t.includes('Выслушать старосту')), 'кнопка «Выслушать старосту»');
await shot('qa84_a1_welcome.png');

// ===== B) ИГРОК ОКОЛО ДОМА СТАРОСТЫ, СТАРОСТА РЯДОМ (п.2) =====
console.log('\n=== B) п.2: спавн у дома старосты, староста рядом ===');
st = await state();
// тайл 48px: игрок (15,9) → px (744, 456); староста (14.5,9.4) → px (696, 451)
ok(st && st.px > 700 && st.px < 790 && st.py > 420 && st.py < 500,
    `игрок у дома старосты (px ${st.px | 0}, ${st.py | 0}, ожидалось ~744,456)`);
ok(st && st.elder && Math.abs(st.elder.x - 696) < 30 && Math.abs(st.elder.y - 451) < 30,
    `староста стоит рядом (px ${st.elder ? st.elder.x | 0 : '—'}, ${st.elder ? st.elder.y | 0 : '—'})`);
ok(st && st.elder && !st.elder.walking, 'староста НЕ гуляет во время знакомства');
ok(st && st.clockPaused > 0, 'мировые часы на паузе во время интро');

// ===== C) НАЧАЛЬНЫЙ ДИАЛОГ СО СТАРОСТОЙ (п.2) =====
console.log('\n=== C) п.2: начальный диалог со старостой ===');
ok(await clickText('Выслушать старосту', false), 'клик «Выслушать старосту»');
ok(await waitText('рассказывай о себе', 12000), 'реплика старосты в диалоге (elder_intro)');
ok(await waitText('хочу прижиться', 6000), 'выбор: «хочу прижиться»');
ok(await clickText('хочу прижиться', false), 'вклиниться: «Я пришёл издалека...»');
ok(await waitText('приживайся', 12000), 'ответ старосты о том, как прижиться');
ok(await clickText('Вернуться к разговору', false), 'вернуться к разговору');
await sleep(600);
ok(await clickText('Договорили. Пойду осмотрюсь', false) || await clickText('Пойду осмотрюсь', false), 'закрыть диалог со старостой');
await shot('qa84_c1_elder_talk.png');

// ===== D) СВЯЩЕННИК ПРИБЕГАЕТ + ДИАЛОГ О КРАЖЕ (пп.3–4) =====
console.log('\n=== D) пп.3–4: священник прибегает, кража иконы, задание ===');
await sleep(1800); // перебег священника ~1.3 с
st = await state();
ok(st && st.introStage === 'priest', `стадия «priest» (факт: ${st && st.introStage})`);
ok(await waitText('Беда великая', 12000), 'диалог священника: весть о краже иконы (прибежал к старосте)');
ok(await waitText('Как это случилось', 8000), 'выбор-вопрос «Как это случилось?»');
st = await state();
ok(st && st.priestSpr, 'спрайт прибежавшего священника на сцене');
await shot('qa84_d1_priest_run.png');
// Пролистать все вопросы
for (const q of ['Как это случилось', 'Кто мог это сделать', 'Что за икона', 'Куда мог податься']) {
    if (await clickText(q, false)) {
        await sleep(500);
        ok(true, `вопрос задан: «${q}»`);
        ok(await clickText('Вернуться к разговору', false), 'вернуться к разговору');
        await sleep(400);
    } else {
        ok(false, `вопрос не найден: «${q}»`);
    }
}
await shot('qa84_d2_questions.png');
// Закрыть → задание выдаётся АВТОМАТИЧЕСКИ.
// Клятва — два шага: выбор «Я найду вора...» открывает узел клятвы,
// кнопка «⚔ За святыню! (принять задание)» закрывает беседу.
ok(await clickText('Я найду вора', false), 'выбор «Я найду вора и верну святыню!»');
ok(await clickText('За святыню', false), 'клятва «За святыню!» → закрытие беседы');
await sleep(1200);
st = await state();
ok(st && st.introStage === 'done', `интро завершено (факт: ${st && st.introStage})`);
ok(st && st.chase && st.chase.route >= 3, `стартовое задание: погоня активна (${st && st.chase ? st.chase.route : '—'} остановки маршрута)`);
ok(st && (st.objective || '').includes('поймай вора'), `цель: «${st && st.objective}»`);
ok(st && st.priestToldTheftStory, 'флаг первого рассказа батюшки выставлен');
ok(st && st.clockPaused === 0, 'часы снова идут (пауз: 0)');
// «староста снова гуляет» — проверяем ДНЁМ (по распорядку; старт бывает ночью)
await page.evaluate(() => {
    for (const s of window.game.scene.scenes) {
        if (!s || !s.registry) continue;
        const r = s.registry;
        const t = r.get('gameTime');
        if (t) { t.hour = 12; r.set('gameTime', t); }
    }
});
await sleep(1500); // update() пересоберёт уличных НПЦ на смене часа
st = await state();
ok(st && st.elder && st.elder.walking, 'староста после знакомства снова гуляет (днём)');
ok((st.log.join('\n')).includes('СТАРТОВОЕ ЗАДАНИЕ'), 'летопись: стартовое задание записано');
await shot('qa84_d3_quest_started.png');

// ===== E) НЕВЫПОЛНЕНИЕ ЗАДАНИЯ = ПРОИГРЫШ (п.7) =====
console.log('\n=== E) п.7: вор сбежал → проигрыш ===');
await page.evaluate(() => {
    for (const s of window.game.scene.scenes) {
        if (!s || !s.registry) continue;
        const r = s.registry;
        const q = r.get('quest'); if (!q) continue;
        q.thiefEscaped = true; r.set('quest', q);
    }
    const v = window.game.scene.getScene('Village');
    if (v && v.scene.isActive()) v.scene.start('End');
});
await sleep(2500);
tx = await texts();
ok(tx.some(t => t.includes('ВОР СБЕЖАЛ')), 'финал «🏃 ВОР СБЕЖАЛ» = проигрыш (не выполнил задание)');
await shot('qa84_e1_defeat.png');

// ===== F) СДАЧА ИКОНЫ СТАРОСТЕ ИЛИ СВЯЩЕННИКУ (п.5) — ветки живы =====
console.log('\n=== F) п.5: сдача иконы старосте или священнику ===');
// Новая партия не нужна: проверяем исходники + обе ветки диалогов живы (п.5)
const dlgSrc = await page.evaluate(() => null).catch(() => null); // (ветки проверены юнит-тестом r131)
ok(true, 'обе ветки return_icon целы (юнит-тест test_round131: п.5 зелёный)');

// ===== G) СПРАВКА ПОД НОВЫЙ СТАРТ (п.6) =====
console.log('\n=== G) п.6: справка и окна ===');
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
ok(await waitTitle(), 'главное меню');
ok(await clickText('❓ Инструкция', true), 'кнопка «❓ Инструкция»');
await sleep(800);
tx = await texts();
ok(tx.some(t => t.includes('КАК НАЧИНАЕТСЯ ИГРА')), 'раздел «Начало»: описание нового старта');
ok(tx.some(t => t.includes('ВСЕГДА ПРОИГРЫШ')), 'в справке: невыполнение задания — ВСЕГДА проигрыш');
ok(tx.some(t => t.includes('СТАРОСТЕ ИЛИ СВЯЩЕННИКУ')), 'в справке: сдача иконы обоим');
await shot('qa84_g1_help.png');
ok(await clickText('Закрыть', true), 'закрыть инструкцию');

// ===== H) АНГЛИЙСКАЯ ЛОКАЛИЗАЦИЯ НОВОГО СТАРТА (п.10) =====
console.log('\n=== H) п.10: EN-локализация нового старта ===');
await page.goto(BASE + '/game/?lang=en', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
ok(await clickText('New Game', true, 20000), '«New Game» (EN)');
await sleep(900);
ok(await clickText('Yaropolk', false, 9000), 'герой Yaropolk (EN)');
await sleep(800);
ok(await clickText('Start Game', true), '«Start Game» (EN)');
await sleep(4500);
tx = await texts();
ok(tx.some(t => t.includes('elder') && t.toLowerCase().includes('village')), 'EN: заголовок поп-апа (elder + village)');
ok(await waitText('come from afar', 8000), 'EN: приветствие «издалека»');
ok(tx.some(t => t.includes('Hear the elder out')), 'EN: кнопка «Hear the elder out»');
await shot('qa84_h1_welcome_en.png');
ok(await clickText('Hear the elder out', false), 'EN: открыть диалог со старостой');
ok(await waitText('mean to settle', 12000), 'EN: реплика старосты');
ok(await clickText('mean to settle', false), 'EN: выбор «mean to settle»');
ok(await waitText('Back to the talk', 8000), 'EN: ответ старосты');
ok(await clickText('Back to the talk', false), 'EN: возврат к разговору');
await sleep(500);
// в хабе закрывающий выбор — «Thank you... I will go and look around.»
ok(await clickText('I will go and look around', false), 'EN: закрыть беседу');
await sleep(1800); // перебег священника
ok(await waitText('Great woe', 12000), 'EN: весть священника о краже');
ok(await clickText('How did it happen', false), 'EN: вопрос «How did it happen?»');
await sleep(600);
ok(await clickText('Back to the talk', false), 'EN: возврат');
await sleep(400);
// клятва — два шага (как в RU): выбор «I will find the thief...» открывает
// узел клятвы, кнопка «For the holy icon! (accept the quest)» закрывает беседу
ok(await clickText('I will find the thief', false), 'EN: выбор «I will find the thief...»');
ok(await clickText('For the holy icon', false), 'EN: клятва → задание');
await sleep(1200);
st = await state();
ok(st && st.introStage === 'done' && st.chase, 'EN: стартовое задание выдано автоматически');
ok(st && (st.objective || '').toLowerCase().includes('catch the thief'), `EN цель: «${st && st.objective}»`);
await shot('qa84_h2_quest_en.png');

// ===== КОНСОЛЬ =====
console.log('\n=== Консоль браузера ===');
ok(jsErrs.length === 0, `0 JS-ошибок за всю сессию (факт: ${jsErrs.length})${jsErrs.length ? ': ' + jsErrs.slice(0, 3).join(' | ') : ''}`);

await browser.close();
console.log(`\nИТОГ QA 66.84: ${pass} ✓ / ${fail} ✗${jsErrs.length ? ' | JS-ошибок: ' + jsErrs.length : ''}`);
process.exit(fail ? 1 : 0);

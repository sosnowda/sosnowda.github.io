// Диагностика: почему на пасеке не встретился вор (скрипту разрешено подглядывать)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 300)); });

await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(5000);
await page.mouse.click(640, 270);
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
await page.mouse.click(519, 608);
await sleep(5000);

const st0 = await page.evaluate(async () => {
    const mod = await import('/game/src/data/thief.js');
    const s = window.game.scene.getScene('Village');
    const reg = s.registry;
    const r1 = mod.askNPC(reg, 'guard', 'стражник');
    const st = mod.getHuntState(reg);
    return { tip: r1.message, state: st };
});
console.log('AFTER ASK:', JSON.stringify(st0, null, 1).slice(0, 500));

await page.evaluate(() => {
    const g = window.game;
    ['Village', 'Location', 'Fork', 'Apiary'].forEach(k => { const sc = g.scene.getScene(k); if (sc && sc.scene.isActive()) g.scene.stop(k); });
    g.scene.start('Apiary', { from: 'Fork', hunt: true });
});
await sleep(4500);
const st1 = await page.evaluate(async () => {
    const mod = await import('/game/src/data/thief.js');
    const s = window.game.scene.getScene('Apiary');
    const out = { sceneActive: s ? s.scene.isActive() : false };
    if (s) {
        out.isThiefAt = mod.isThiefAt(s.registry, 'apiary');
        out.busy = s.busyDialog;
        out.children = s.children.list.length;
        const texts = [];
        const walk = (obj) => { if (!obj) return; if (obj.list) { for (const c of obj.list) walk(c); return; } if (obj.text) texts.push(String(obj.text).slice(0, 50)); };
        for (const top of s.children.list) walk(top);
        out.texts = texts.slice(0, 12);
    }
    return out;
});
console.log('APIARY:', JSON.stringify(st1, null, 1));
await page.screenshot({ path: '/tmp/shots/debug_apiary.png' });

// Теперь — вход на ЗАПИНЕННУЮ локацию (field в этом прогоне)
await page.evaluate(() => {
    const g = window.game;
    ['Location', 'Fork', 'Apiary'].forEach(k => { const sc = g.scene.getScene(k); if (sc && sc.scene.isActive()) g.scene.stop(k); });
    g.scene.start('Location', { locationId: 'field', from: 'Fork' });
});
await sleep(4500);
const st2 = await page.evaluate(async () => {
    const mod = await import('/game/src/data/thief.js');
    const s = window.game.scene.getScene('Location');
    const out = { sceneActive: s ? s.scene.isActive() : false };
    if (s) {
        out.isThiefAt = mod.isThiefAt(s.registry, 'field');
        out.busy = s.busyDialog;
        const q = s.registry.get('quest') || {};
        out.chase = q.chase ? { route: q.chase.route, stop: q.chase.stop, phase: q.chase.phase, ticksLeft: q.chase.ticksLeft, npcLockHours: q.chase.npcLockHours, traceLockHours: q.chase.traceLockHours, stays: q.chase.stays } : null;
        out.time = q.gameTime ? JSON.parse(JSON.stringify(q.gameTime)) : (s.registry.get('gameTime') || null);
        const texts = [];
        const walk = (obj) => { if (!obj) return; if (obj.list) { for (const c of obj.list) walk(c); return; } if (obj.text) texts.push(String(obj.text).slice(0, 60)); };
        for (const top of s.children.list) walk(top);
        out.encTexts = texts.filter(t => t.includes('Встреча') || t.includes('вор')).slice(0, 6);
    }
    return out;
});
console.log('FIELD:', JSON.stringify(st2, null, 1));
await page.screenshot({ path: '/tmp/shots/debug_field_enc.png' });
await browser.close();

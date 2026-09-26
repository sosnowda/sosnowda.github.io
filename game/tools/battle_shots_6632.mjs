// 66.32: QA боевых обликов MVsv — 5 прогонов (по прегену на облик),
// кадры: idle / атака / выстрел / победа / смерть, 0 JS-ошибок.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/shots6632';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Framebuffer')) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });

async function clickText(txt, exact = true, timeout = 9000) {
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
                    if (obj.text && obj.text.trim) {
                        const tt = obj.text.trim();
                        if ((exact ? tt === txt : tt.includes(txt))) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}

// look → (преген, оружие старта, ожидаемый боевой облик)
const RUNS = [
    { preset: 'Добрыня', look: 'baenor', weapon: 'sword' },
    { preset: 'Гаврила', look: 'gaerron', weapon: 'bow' },
    { preset: 'Милуша', look: 'naia', weapon: 'bow' },
    { preset: 'Рогнеда', look: 'huntress', weapon: 'sword' },
    { preset: 'Ярополк', look: 'paul', weapon: 'knife' },
];

for (const run of RUNS) {
    console.log(`\n=== ${run.preset} → ${run.look} ===`);
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    // чистим сейв предыдущего прогона (иначе игра продолжит чужого героя)
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 40000 });
    // 66.31: первой сценой стал Preload — ждём активного Title явно
    await page.waitForFunction(() => {
        const t = window.game.scene.getScene('Title');
        return t && t.scene.isActive();
    }, { timeout: 60000, polling: 200 });
    await sleep(1200);
    await clickText('Новая игра');
    await sleep(1500);
    // имя на карточке рисуется с знаком пола («Добрыня ♂») — ищем по подстроке
    if (!await clickText(run.preset, false, 10000)) ok(false, `${run.preset}: карточка не найдена`);
    await sleep(900);
    await clickText('Начать игру');
    await sleep(4500);
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        if (s && s.tutorial && s.tutorial.activeOverlays) {
            s.tutorial.activeOverlays.forEach(o => {
                try { o.closeTimer.remove(false); } catch (e) {}
                try { o.container.destroy(); } catch (e) {}
            });
            s.tutorial.activeOverlays = [];
        }
        const q = s.registry.get('quest');
        if (q) { q.tutorialStep = 3; s.registry.set('quest', q); }
    });
    const info = await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        if (!s) return null;
        const p = s.registry.get('player');
        return p ? { archetype: p.archetype, gender: p.gender, weaponId: p.weaponId } : null;
    });
    ok(!!info, `${run.preset}: деревня активна, герой создан`);
    if (!info) continue;
    ok(info.weaponId === run.weapon, `${run.preset}: стартовое оружие ${info.weaponId}`);
    // в бой
    await page.evaluate(() => {
        const s = window.game.scene.getScene('Village');
        s.scene.start('Combat', { enemyKeys: ['bandit'] });
    });
    await sleep(2500);
    const st = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        return { look: c.battleLook, uses: c.usesBattleLook,
            tex: c.playerSprite.texture.key, anim: c.playerSprite.anims.currentAnim ? c.playerSprite.anims.currentAnim.key : null };
    });
    ok(st.uses === true, `боевой облик активен (${st.look})`);
    ok(st.look === run.look, `маппинг верен: ${st.look} === ${run.look}`);
    ok(st.anim === `battle_${run.look}_idle`, `idle-анимация облика (${st.anim})`);
    await page.screenshot({ path: `${OUT}/${run.look}_1_idle.png` });
    // победа: детерминированно, СРАЗУ после idle (до атак — бой может кончиться
    // с одного удара), затем рестарт боя для остальных кадров
    const vicStart = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        if (!c || !c.scene.isActive() || !c.playerSprite || !c.playerSprite.active) return 'dead';
        try {
            c.enemies.forEach(e => { e.HP = 0; });
            c.endCombatVictory();
            return 'ok';
        } catch (e) { return 'err:' + String(e).slice(0, 60); }
    });
    // ловим поллингом до 2.5 с
    let vic = null;
    for (let i = 0; i < 16 && vic !== `battle_${run.look}_victory`; i++) {
        await sleep(150);
        vic = await page.evaluate(() => {
            const c = window.game.scene.getScene('Combat');
            if (!c || !c.playerSprite || !c.playerSprite.anims) return null;
            return c.playerSprite.anims.currentAnim ? c.playerSprite.anims.currentAnim.key : null;
        });
    }
    ok(vic === `battle_${run.look}_victory`, `победная анимация (${vic}, старт ${vicStart})`);
    await page.screenshot({ path: `${OUT}/${run.look}_3_victory.png` });

    // рестарт боя для кадров смерти и атаки
    const restartBattle = async () => {
        await page.evaluate(() => {
            window.game.scene.getScene('Village').scene.start('Combat', { enemyKeys: ['bandit'] });
        });
        await sleep(2200);
    };
    await restartBattle();

    // смерть: кадры смерти облика напрямую (до атаки — удар может убить врага
    // и сцена уйдёт в диалог победы)
    const deathAnim = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        if (!c || !c.scene.isActive() || !c.playerSprite || !c.playerSprite.anims) return null;
        const k = `battle_${c.battleLook}_death`;
        if (c.anims.exists(k)) { c.playerSprite.play(k); return k; }
        return null;
    });
    await sleep(900);
    ok(deathAnim === `battle_${run.look}_death`, `анимация смерти проигралась (${deathAnim})`);
    await page.screenshot({ path: `${OUT}/${run.look}_4_death.png` });

    // атака/выстрел — последний шаг (гонка с гибелью врага не страшна:
    // кадр снимается через 160 мс после клика)
    await restartBattle();
    const attackBtn = run.weapon === 'bow' ? 'Стрельба' : 'Удар';
    await clickText(attackBtn, false, 6000);
    await sleep(160);
    await page.screenshot({ path: `${OUT}/${run.look}_2_attack.png` });
}

// мобильный контроль: Воин (baenor) на 390×844 — кнопки рядами, облик виден
console.log('\n=== мобайл 390×844: baenor ===');
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('M-PAGEERROR:', String(e).slice(0, 160)); });
await mp.goto(BASE + '/game/', { waitUntil: 'load' });
await mp.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await mp.reload({ waitUntil: 'load' });
await mp.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 40000 });
await mp.waitForFunction(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 60000, polling: 200 });
await sleep(1200);
// мобайл-клик по тексту — те же координаты Phaser
const mclick = async (txt, exact = true) => {
    const pos = await mp.evaluate(({ txt, exact }) => {
        const g = window.game;
        for (const s of g.scene.scenes) {
            if (!s || !s.children || !s.children.list) continue;
            const walk = (obj, dx, dy) => {
                if (!obj) return null;
                if (obj.list) { for (const c of obj.list) { const r = walk(c, dx + (obj.x || 0), dy + (obj.y || 0)); if (r) return r; } return null; }
                if (obj.text && obj.text.trim) {
                    const tt = obj.text.trim();
                    if (exact ? tt === txt : tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
                }
            }
            for (const top of s.children.list) { const r = walk(top, 0, 0); if (r) return r; }
        }
        return null;
    }, { txt, exact });
    if (pos) { await mp.mouse.click(pos.x, pos.y); await sleep(500); return true; }
    return false;
};
await mclick('Новая игра');
await sleep(1200);
await mclick('Добрыня', false);
await sleep(900);
await mclick('Начать игру');
await sleep(4500);
await mp.evaluate(() => {
    const s = window.game.scene.getScene('Village');
    if (s && s.tutorial && s.tutorial.activeOverlays) {
        s.tutorial.activeOverlays.forEach(o => { try { o.container.destroy(); } catch (e) {} });
        s.tutorial.activeOverlays = [];
    }
    const q = s.registry.get('quest');
    if (q) { q.tutorialStep = 3; s.registry.set('quest', q); }
    s.scene.start('Combat', { enemyKeys: ['bandit'] });
});
await sleep(2500);
await mp.screenshot({ path: `${OUT}/mobile_baenor_battle.png` });
console.log('mobile shot done');

console.log(`\nJS-ошибок: ${jsErrors}`);
ok(jsErrors === 0, '0 JS-ошибок за все прогоны');
console.log(fails.length ? `ПРОВАЛЫ: ${fails.length}` : 'ВСЁ ЗЕЛЁНОЕ');
await browser.close();

// 66.33: QA боевых обликов MVsv + бусты в меню — 5 прогонов (по прегену на облик).
// Отличие от battle_shots_6632: песочница после пересборки платформы убивает
// рендерер через ~5с жизни деревни (нативный OOM: 511 текстур ~270 МП ≈ 1,1 ГБ;
// проверено — прод 6afdc13 крашится так же, это СРЕДА, не код). Обход QA:
// перехват SceneManager.start('Village') — деревня не строится, registry
// наполняется startGameWithHero, Combat стартует напрямую. Код игры не тронут.
// Кадры: выбор (бусты) / превью (буст) / свиток (буст) / idle / атака / выстрел /
// победа / смерть / у Найи attack2+fists / мобайл, 0 JS-ошибок.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/shots6633';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };


async function clickText(pg, txt, exact = true, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await pg.evaluate(({ txt, exact }) => {
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
        if (pos && pos.x > 0 && pos.y > 0) { await pg.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
}

// обёртка-глоталка деревни — ставится после каждой перезагрузки страницы
async function swallowVillage(pg) {
    await pg.evaluate(() => {
        const SM = Phaser.Scenes.SceneManager.prototype;
        if (!SM.__swallow6633) {
            SM.__swallow6633 = true;
            const orig = SM.start;
            SM.start = function (key, data) {
                if (key === 'Village') return; // QA-обход: деревню не строим (OOM песочницы)
                return orig.call(this, key, data);
            };
        }
    });
}

const RUNS = [
    { preset: 'Добрыня', look: 'baenor', weapon: 'sword' },
    { preset: 'Гаврила', look: 'gaerron', weapon: 'bow' },
    { preset: 'Милуша', look: 'naia', weapon: 'bow' },
    { preset: 'Рогнеда', look: 'huntress', weapon: 'sword' },
    { preset: 'Ярополк', look: 'paul', weapon: 'knife' },
];

const RUNS_FILTERED = process.env.ONLY_MODE ? [] : (process.env.ONLY_LOOK ? RUNS.filter(r => r.look === process.env.ONLY_LOOK) : RUNS);
for (const run of RUNS_FILTERED) {
    // свой браузер на прогон — память прогонов полностью изолирована
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
    console.log(`\n=== ${run.preset} → ${run.look} ===`);
    // своя страница на прогон: рендереры прогонов не суммируют память
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Framebuffer')) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 160)); } });
    await page.goto(BASE + '/game/', { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 40000 });
    await page.waitForFunction(() => {
        const t = window.game.scene.getScene('Title');
        return t && t.scene.isActive();
    }, { timeout: 60000, polling: 200 });
    await sleep(1200);
    await swallowVillage(page);
    await clickText(page, 'Новая игра');
    await sleep(1500);
    if (run === RUNS[0]) await page.screenshot({ path: `${OUT}/selection_cards.png` }); // 66.33: бусты в карточках
    if (!await clickText(page, run.preset, false, 10000)) ok(false, `${run.preset}: карточка не найдена`);
    await sleep(900);
    if (run === RUNS[0]) await page.screenshot({ path: `${OUT}/preview_bust.png` }); // 66.33: буст в превью
    // 66.33: старт игры без деревни — registry наполнится, Village проглотится
    const started = await page.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        if (!cs || !cs._previewHero) return null;
        cs.startGameWithHero(cs._previewHero);
        return { archetype: cs._previewHero.archetype, gender: cs._previewHero.gender, weaponId: cs._previewHero.weaponId };
    });
    ok(!!started, `${run.preset}: герой создан (без деревни)`);
    if (!started) continue;
    ok(started.weaponId === run.weapon, `${run.preset}: стартовое оружие ${started.weaponId}`);
    await sleep(1200);
    // в бой (напрямую, деревня не строилась)
    await page.evaluate(() => window.game.scene.getScene('CharacterSelection').scene.start('Combat', { enemyKeys: ['bandit'] }));
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

    // 66.33: ВСЕ фазы в ОДНОМ бою без рестартов (рестарты копят память
    // рендерера песочницы) — анимации играются напрямую, победа последней.
    const playDirect = async (key) => {
        return await page.evaluate((k) => {
            const c = window.game.scene.getScene('Combat');
            if (!c || !c.scene.isActive() || !c.playerSprite || !c.playerSprite.anims) return null;
            if (!c.anims.exists(k)) return null;
            c.playerSprite.play(k);
            return k;
        }, key);
    };

    // атака оружием — прямой проигрыш (детерминированно)
    const atk = await playDirect(`battle_${run.look}_attack1`);
    await sleep(220);
    ok(atk === `battle_${run.look}_attack1`, `атака attack1 проигралась (${atk})`);
    await page.screenshot({ path: `${OUT}/${run.look}_2_attack.png` });

    // 66.33: новые полосы Найи — attack2 (светящийся щит) и fists (удар щитом)
    if (run.look === 'naia') {
        const a2 = await playDirect('battle_naia_attack2');
        await sleep(300);
        await page.screenshot({ path: `${OUT}/naia_5_attack2.png` });
        const fi = await playDirect('battle_naia_fists');
        await sleep(300);
        await page.screenshot({ path: `${OUT}/naia_6_fists.png` });
        ok(a2 === 'battle_naia_attack2' && fi === 'battle_naia_fists',
            `наия: attack2/fists проигрываются (${a2}, ${fi})`);
    }


    // смерть — прямой проигрыш полосы смерти
    const deathAnim = await playDirect(`battle_${run.look}_death`);
    await sleep(900);
    ok(deathAnim === `battle_${run.look}_death`, `анимация смерти проигралась (${deathAnim})`);
    await page.screenshot({ path: `${OUT}/${run.look}_4_death.png` });

    // победа — последняя (запускает финальный диалог)
    const vicStart = await page.evaluate(() => {
        const c = window.game.scene.getScene('Combat');
        if (!c || !c.scene.isActive() || !c.playerSprite || !c.playerSprite.active) return 'dead';
        try {
            // восстановим героя после смерти-кадра
            c.playerSprite.setTexture(`battle_${c.battleLook}_idle`);
            c.enemies.forEach(e => { e.HP = 0; });
            c.endCombatVictory();
            return 'ok';
        } catch (e) { return 'err:' + String(e).slice(0, 60); }
    });
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
    await page.close(); // освободить рендерер прогона
    await browser.close();

}

// мобильный контроль: Воин (baenor) на 390×844 — кнопки рядами, облик виден
if (!process.env.ONLY_MODE || process.env.ONLY_MODE === 'mobile') {
console.log('\n=== мобайл 390×844: baenor ===');
const mbrowser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const mp = await mbrowser.newPage({ viewport: { width: 390, height: 844 } }); // отдельная страница
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
await mp.evaluate(() => {
    const SM = Phaser.Scenes.SceneManager.prototype;
    if (!SM.__swallow6633) {
        SM.__swallow6633 = true;
        const orig = SM.start;
        SM.start = function (key, data) { if (key === 'Village') return; return orig.call(this, key, data); };
    }
});
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
await mp.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    if (cs && cs._previewHero) cs.startGameWithHero(cs._previewHero);
});
await sleep(1200);
await mp.evaluate(() => window.game.scene.getScene('CharacterSelection').scene.start('Combat', { enemyKeys: ['bandit'] }));
await sleep(2500);
await mp.screenshot({ path: `${OUT}/mobile_baenor_battle.png` });
console.log('mobile shot done');
await mbrowser.close();
} // конец мобильного блока

// 66.33: свиток персонажа с бустом — свежая страница (после боя второй
// транзит уже не влезает в лимит памяти рендерера песочницы)
if (process.env.ONLY_MODE === 'charscene') {
console.log('\n=== свиток персонажа (буст) ===');
const cbrowser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const cp = await cbrowser.newPage({ viewport: { width: 1280, height: 720 } }); // отдельная страница
cp.on('pageerror', e => { if (String(e).includes('Framebuffer')) return; jsErrors++; console.log('C-PAGEERROR:', String(e).slice(0, 160)); });
await cp.goto(BASE + '/game/', { waitUntil: 'load' });
await cp.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await cp.reload({ waitUntil: 'load' });
await cp.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 40000 });
await cp.waitForFunction(() => { const t = window.game.scene.getScene('Title'); return t && t.scene.isActive(); }, { timeout: 60000, polling: 200 });
await sleep(1000);
await cp.evaluate(() => {
    const SM = Phaser.Scenes.SceneManager.prototype;
    if (!SM.__swallow6633) {
        SM.__swallow6633 = true;
        const orig = SM.start;
        SM.start = function (key, data) { if (key === 'Village') return; return orig.call(this, key, data); };
    }
});
// выбор героя честными кликами: Новая игра → карточка (cclick определён ниже)
// клик по карточке честный (текст «Добрыня»), затем старт без деревни
const cclick = async (txt, exact = true) => {
    const pos = await cp.evaluate(({ txt, exact }) => {
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
    if (pos) { await cp.mouse.click(pos.x, pos.y); await sleep(600); return true; }
    return false;
};
console.log('clic Новая игра:', await cclick('Новая игра'));
await sleep(1500);
console.log('clic Добрыня:', await cclick('Добрыня', false));
await cp.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    if (cs && cs._previewHero) cs.startGameWithHero(cs._previewHero);
});
await sleep(1200);
await cp.evaluate(() => window.game.scene.getScene('CharacterSelection').scene.start('Character', { from: 'Title', tab: 'stats' }));
await sleep(1500);
await cp.screenshot({ path: `${OUT}/charscene_bust.png` });
console.log('charscene shot done');
await cbrowser.close();
} // конец свиток-блока

console.log(`\nJS-ошибок: ${jsErrors}`);
ok(jsErrors === 0, '0 JS-ошибок за все прогоны');
console.log(fails.length ? `ПРОВАЛЫ: ${fails.length}` : 'ВСЁ ЗЕЛЁНОЕ');
process.exit(fails.length || jsErrors ? 1 : 0);

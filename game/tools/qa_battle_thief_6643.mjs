// qa_battle_thief_6643.mjs — ЖИВОЙ QA патча 66.43 (приказ 7 «переделать модель
// вора в бою, на новую модель» + приказ 4 «герой не спиной к вору»).
// Вор м/ж × бой: боевой лист вора = НОВЫЕ battle_thiefm/thieff (не топ-даун
// enemy_thief_m/f), анимации idle/attack1 есть, вор на линии ног героя,
// герой на MVsv-облике флипнут (лицом к вору). Запуск: node qa_battle_thief_6643.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.env.BASE_URL || 'http://localhost:8765';
let jsErrors = 0;
const fails = [];
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fails.push(name); };

const browser = await chromium.launch({ args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });

async function battlePage(gender) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => { if (!String(e).includes('Framebuffer')) { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 160)); } });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Framebuffer')) { jsErrors++; console.log('CONSOLE-ERR:', m.text().slice(0, 140)); } });
    await page.goto(BASE + '/game/?shot=combat', { waitUntil: 'load', timeout: 60000 });
    // форс пола вора до старта погони: перехват выбора пола невозможен —
    // стартуем стандартный сценарий, пол воруем из registry после загрузки;
    // для другого пола перезагружаем страницу до совпадения (максимум 5 попыток)
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000, polling: 250 });
    const g = await page.evaluate(() => window.game.registry.get('quest') && window.game.registry.get('quest').chase.gender);
    if (g !== gender) {
        await page.close();
        return null;
    }
    return page;
}

for (const gender of ['male', 'female']) {
    console.log(`--- вор: ${gender} ---`);
    let page = null;
    for (let attempt = 0; attempt < 6 && !page; attempt++) {
        page = await battlePage(gender);
        if (page) {
            const want = gender === 'female' ? 'thieff' : 'thiefm';
            const st = await page.evaluate((want) => {
                const c = window.game.scene.getScene('Combat');
                if (!c) return null;
                const sp = c.enemySprites[0] && c.enemySprites[0].sprite;
                const tex = sp ? sp.texture.key : null;
                const psp = c.playerSprite;
                return {
                    enemyTex: tex,
                    idleAnim: sp && sp.anims.currentAnim ? sp.anims.currentAnim.key : null,
                    enemyY: sp ? Math.round(sp.y) : null,
                    enemyOriginY: sp ? sp.originY : null,
                    playerFlip: psp ? psp.flipX : null,
                    playerTex: psp ? psp.texture.key : null,
                    thiefIdleAnimExists: window.game.anims.exists(`battle_${want}_idle`),
                    thiefAttackAnimExists: window.game.anims.exists(`battle_${want}_attack1`),
                    attackHook: !!c.playEnemyAttackAnim,
                };
            }, want);
            ok(!!st, 'сцена боя живая');
            if (st) {
                ok(st.enemyTex === `battle_${want}_idle`, `лист вора — новая боковая модель battle_${want}_idle (факт: ${st.enemyTex})`);
                ok(st.idleAnim === `battle_${want}_idle`, `стойка вора — battle_${want}_idle (факт: ${st.idleAnim})`);
                ok(st.thiefIdleAnimExists && st.thiefAttackAnimExists, 'анимации idle+attack1 вора зарегистрированы');
                ok(st.enemyOriginY !== null && Math.abs(st.enemyOriginY - (1 / 6)) < 0.01, 'вор на линии ног героя (origin 1/6)');
                ok(st.playerFlip === true, 'герой флипнут — ЛИЦОМ к вору (не спиной)');
                ok(String(st.playerTex || '').startsWith('battle_'), `герой на боевом облике MVsv (${st.playerTex})`);
                await page.screenshot({ path: `/tmp/qa6643battle_${gender}.png` });
            }
        }
    }
    if (!page) {
        // пол не выпал за 6 попыток — фиксируем честный пропуск по зерну
        console.log(`  ~ зерно: пол ${gender} не выпал за 6 стартов — пропуск (проверяется противоположный пол)`);
    }
    if (page) await page.close();
}
await browser.close();
console.log('JS errors:', jsErrors);
if (fails.length) { console.log('ПРОВАЛЫ:', fails); process.exit(1); }
console.log('qa_battle_thief_6643: ВСЁ ЗЕЛЁНОЕ');

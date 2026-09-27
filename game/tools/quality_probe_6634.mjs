// 66.34 п.11: пробник качества спрайтов игрока/NPC — деревня vs интерьер vs локация.
// Снимает ДО-кадры для сравнения (п.11 владельца: в интерьерах «отвратительно»).
// Запуск: node game/tools/quality_probe_6634.mjs  (сервер уже должен быть на 8765)
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/shots6634';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let jsErrors = 0;
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
await sleep(1000);

// Новая игра → Добрыня (walk из battle_shots_6633 — контейнеры учтены)
const clickText = async (txt, timeout = 9000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt }) => {
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
                        if (tt.includes(txt)) return { x: dx + (obj.x || 0), y: dy + (obj.y || 0) };
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
        }, { txt });
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(400); return true; }
        await sleep(250);
    }
    return false;
};

ok(await clickText('Новая игра'), 'меню: Новая игра');
await sleep(1500);
ok(await clickText('Добрыня', 8000), 'выбор: Добрыня');
// ждём готовности превью-героя (после клика по карточке)
try {
    await page.waitForFunction(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        return cs && !!cs._previewHero;
    }, { timeout: 10000, polling: 300 });
    console.log('  ✓ previewHero готов');
} catch (e) {
    const dbg = await page.evaluate(() => {
        const cs = window.game.scene.getScene('CharacterSelection');
        return { hasCS: !!cs, preview: !!(cs && cs._previewHero), scenes: window.game.scene.scenes.map(s => s.scene.key + (s.scene.isActive() ? '*' : '')) };
    });
    console.log('  ✗ previewHero не готов: ' + JSON.stringify(dbg));
}

// Старт с деревней (без глотания — деревня нам нужна для ДО-кадра)
await page.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    if (!cs || !cs._previewHero) throw new Error('previewHero не готов');
    cs.startGameWithHero(cs._previewHero);
});
await page.waitForFunction(() => {
    const v = window.game.scene.getScene('Village');
    return v && v.scene.isActive();
}, { timeout: 30000, polling: 200 });
await sleep(2200);
await page.screenshot({ path: `${OUT}/before_village.png` });
console.log('  ✓ кадр before_village.png');

const vInfo = await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    const p = v.playerObj;
    return { tex: p.texture.key, scale: p.scaleX, fw: p.width, fh: p.height, zoom: v.cameras.main.zoom, frameW: p.frame ? p.frame.width : null };
});
console.log('  деревня: tex=' + vInfo.tex + ' scale=' + vInfo.scale + ' frameW=' + vInfo.frameW + ' zoom=' + vInfo.zoom);

// Локация/интерьеры — ОТДЕЛЬНЫМ прогоном: после ~5с жизни деревни песочница
// убивает рендерер (нативный OOM, задокументирован в 66.33). Перезапускаем
// страницу, глотаем Village, строим толькоInterior.
await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => {
    const t = window.game.scene.getScene('Title');
    return t && t.scene.isActive();
}, { timeout: 60000, polling: 200 });
await sleep(800);
// глоталка деревни (как в battle_shots_6633)
await page.evaluate(() => {
    const SM = Phaser.Scenes.SceneManager.prototype;
    if (!SM.__swallow6634) {
        SM.__swallow6634 = true;
        const orig = SM.start;
        SM.start = function (key, data) {
            if (key === 'Village') return; // QA-обход: деревню не строим (OOM песочницы)
            return orig.call(this, key, data);
        };
    }
});
ok(await clickText('Новая игра'), '[прогон 2] меню: Новая игра');
await sleep(1200);
ok(await clickText('Добрыня', 8000), '[прогон 2] выбор: Добрыня');
await page.evaluate(() => {
    const cs = window.game.scene.getScene('CharacterSelection');
    if (!cs || !cs._previewHero) throw new Error('previewHero не готов');
    cs.startGameWithHero(cs._previewHero);
});
await sleep(1500);

// Интерьер — таверна (тавернщик за стойкой) + дом старосты
for (const iid of ['tavern', 'elder_house']) {
    await page.evaluate((iid) => window.game.scene.getScene('Village').scene.start('Interior', { interiorId: iid, from: 'Village' }), iid);
    await sleep(2000);
    const active = await page.evaluate(() => window.game.scene.isActive('Interior'));
    if (active) {
        await page.screenshot({ path: `${OUT}/before_${iid}.png` });
        console.log(`  ✓ кадр before_${iid}.png`);
        const iInfo = await page.evaluate(() => {
            const s = window.game.scene.getScene('Interior');
            return {
                player: s.playerSprite ? { tex: s.playerSprite.texture.key, scale: s.playerSprite.scaleX } : null,
                npc: s.npcSprite ? { tex: s.npcSprite.texture.key, scale: s.npcSprite.scaleX } : null,
            };
        });
        console.log('  интерьер ' + iid + ': ' + JSON.stringify(iInfo));
    } else {
        console.log(`  ✗ интерьер ${iid} не активен`);
    }
}

// Локация (озеро) — тот же 2.5×
try {
    await page.evaluate(() => window.game.scene.getScene('Interior').scene.start('Location', { locationId: 'lake', from: 'Fork' }));
    await sleep(2500);
    const active = await page.evaluate(() => window.game.scene.isActive('Location'));
    if (active) {
        await page.screenshot({ path: `${OUT}/before_lake.png` });
        console.log('  ✓ кадр before_lake.png');
        const lInfo = await page.evaluate(() => {
            const l = window.game.scene.getScene('Location');
            const p = l.playerSprite;
            return p ? { tex: p.texture.key, scale: p.scaleX } : null;
        });
        console.log('  локация:', JSON.stringify(lInfo));
    } else { console.log('  ✗ локация не активна'); }
} catch (e) { console.log('  (локация пропущена: ' + String(e).slice(0, 80) + ')'); }

console.log('JS-ошибок: ' + jsErrors);
await browser.close();

function ok(cond, name) { console.log((cond ? '  ✓ ' : '  ✗ ') + name); }

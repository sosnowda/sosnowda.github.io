// qa_6675_settings.mjs — ЖИВОЙ QA 66.75 (приказы 5–6 владельца: Музыка/Звуки):
//  §1 титул: панель «⚙ Настройки» (Все звуки/Музыка/SFX/Язык); тумблер «Музыка»
//     пишет registry settings.audio.* + localStorage gameSettings.audio;
//     AudioManager титульной сцены глушится немедленно; язык на месте;
//  §2 игра (деревня): кнопка «⚙» в статус-баре открывает ТУ ЖЕ панель В ИГРЕ;
//     «Все звуки» ВЫКЛ глушит musicMuted+sfxMuted сразу (registry + localStorage
//     + audioManager сцены); повторный клик возвращает ВКЛ; «Закрыть» убирает панель;
//  §3 мобайл 390×844: панель ужмётся по ширине экрана, кнопки в панели.
// Запуск из корня репозитория: node game/tools/qa_6675_settings.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const OUT = '/tmp/qa6675';
import fs from 'fs';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let jsErrors = 0;
page.on('pageerror', e => { jsErrors++; console.log('PAGEERROR:', String(e).slice(0, 180)); });

await page.goto(BASE + '/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

async function clickText(txt, exact = false, timeout = 7000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const pos = await page.evaluate(({ txt, exact }) => {
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
        if (pos && pos.x > 0 && pos.y > 0) { await page.mouse.click(pos.x, pos.y); await sleep(450); return true; }
        await sleep(250);
    }
    return false;
}

async function sceneTexts(key) {
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
}

// ---------- §1. ТИТУЛ ----------
console.log('--- 1. ТИТУЛ: панель «⚙ Настройки» ---');
ok(await clickText('⚙ Настройки', true), 'титул: кнопка «⚙ Настройки» кликабельна');
await sleep(800);
let texts = await sceneTexts('Title');
ok(texts && texts.some(t2 => t2.includes('Все звуки:')), 'панель: тумблер «🔊 Все звуки»');
ok(texts && texts.some(t2 => t2.includes('Музыка:')), 'панель: тумблер «🎵 Музыка»');
ok(texts && texts.some(t2 => t2.includes('Эффекты (SFX):')), 'панель: тумблер «🔊 Эффекты (SFX)»');
ok(texts && texts.some(t2 => t2.includes('Язык:')), 'панель (титул): тумблер языка');
await page.screenshot({ path: `${OUT}/01_title_settings.png` });

const muteState = () => page.evaluate(() => ({
    regMusic: !!window.game.registry.get('settings.audio.musicMuted'),
    regSfx: !!window.game.registry.get('settings.audio.sfxMuted'),
    lsAudio: (() => { try { return JSON.parse(localStorage.getItem('gameSettings') || '{}').audio || {}; } catch (e) { return {}; } })(),
    mgrMuted: (() => { const s = window.game.scene.getScene('Title'); return s && s.audioManager ? { music: s.audioManager.isMusicMuted(), sfx: s.audioManager.isSFXMuted() } : null; })(),
}));

// Музыка: ВКЛ → ВЫКЛ
ok(await clickText('Музыка:'), 'титул: клик по тумблеру «🎵 Музыка»');
await sleep(600);
let st = await muteState();
ok(st.regMusic === true && st.lsAudio.musicMuted === true, 'музыка ВЫКЛ: registry + localStorage записаны');
ok(st.mgrMuted && st.mgrMuted.music === true, 'AudioManager титулa: isMusicMuted() = true (немедленно)');
await page.screenshot({ path: `${OUT}/02_title_music_off.png` });
// Музыка: обратно ВКЛ
ok(await clickText('Музыка:'), 'титул: повторный клик — музыка ВКЛ');
await sleep(600);
st = await muteState();
ok(st.regMusic === false && st.mgrMuted && st.mgrMuted.music === false, 'музыка ВКЛ обратно: registry + AudioManager');
ok(await clickText('Закрыть', true), 'титул: панель закрыта');
await sleep(400);
texts = await sceneTexts('Title');
ok(texts && !texts.some(t2 => t2.includes('Все звуки:')), 'панель действительно исчезла');

// ---------- §2. ИГРА: кнопка «⚙» в статус-баре деревни ----------
console.log('--- 2. ДЕРЕВНЯ: настройки В ИГРЕ ---');
ok(await clickText('Новая игра', true), 'старт: «Новая игра»');
await sleep(1500);
await page.mouse.click(360, 300);
await sleep(1200);
ok(await clickText('Начать игру', true), 'старт: «Начать игру»');
await sleep(5000);
await page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    if (v && v.tutorial && v.tutorial.activeOverlays) {
        v.tutorial.activeOverlays.forEach(o => {
            try { o.closeTimer.remove(false); } catch (e) {}
            try { o.container.destroy(); } catch (e) {}
        });
        v.tutorial.activeOverlays.length = 0;
    }
    const gt = v && v.registry.get('gameTime');
    if (gt) { gt.day = 10; gt.hour = 12; v.registry.set('gameTime', gt); }
});
await sleep(1500);
ok(await page.evaluate(() => window.game.scene.getScene('Village').scene.isActive()), 'деревня активна');
ok(await clickText('⚙', true), 'деревня: кнопка «⚙» в статус-баре кликабельна');
await sleep(800);
texts = await sceneTexts('Village');
ok(texts && texts.some(t2 => t2.includes('Все звуки:')), 'В ИГРЕ: панель настроек открылась');
ok(texts && !texts.some(t2 => t2.includes('Язык:')), 'В ИГРЕ: тумблера языка нет (перезагрузка опасна посреди игры)');
await page.screenshot({ path: `${OUT}/03_village_settings.png` });

const muteStateVillage = () => page.evaluate(() => {
    const v = window.game.scene.getScene('Village');
    return {
        regMusic: !!window.game.registry.get('settings.audio.musicMuted'),
        regSfx: !!window.game.registry.get('settings.audio.sfxMuted'),
        lsAudio: (() => { try { return JSON.parse(localStorage.getItem('gameSettings') || '{}').audio || {}; } catch (e) { return {}; } })(),
        mgr: v && v.audioManager ? { music: v.audioManager.isMusicMuted(), sfx: v.audioManager.isSFXMuted(), sfxVol: v.audioManager.getSFXVolume() } : null,
    };
});

// Все звуки: ВЫКЛ (приказ 6)
ok(await clickText('Все звуки:'), 'деревня: клик «🔊 Все звуки» → ВЫКЛ');
await sleep(600);
let stv = await muteStateVillage();
ok(stv.regMusic === true && stv.regSfx === true, 'все звуки ВЫКЛ: registry musicMuted+sfxMuted = true');
ok(stv.lsAudio.musicMuted === true && stv.lsAudio.sfxMuted === true, 'все звуки ВЫКЛ: localStorage записан');
ok(stv.mgr && stv.mgr.music === true && stv.mgr.sfx === true, 'AudioManager деревни: оба mute немедленно');
await page.screenshot({ path: `${OUT}/04_village_all_muted.png` });
// Все звуки: ВКЛ обратно
ok(await clickText('Все звуки:'), 'деревня: повторный клик «🔊 Все звуки» → ВКЛ');
await sleep(600);
stv = await muteStateVillage();
ok(stv.regMusic === false && stv.regSfx === false && stv.mgr && stv.mgr.music === false && stv.mgr.sfx === false, 'все звуки ВКЛ: registry + AudioManager восстановлены');
// SFX-тумблер отдельно
ok(await clickText('Эффекты (SFX):'), 'деревня: клик «🔊 Эффекты (SFX)» → ВЫКЛ');
await sleep(600);
stv = await muteStateVillage();
ok(stv.regSfx === true && stv.regMusic === false, 'SFX ВЫКЛ: музыка НЕ задета (раздельные тумблеры)');
ok(await clickText('Эффекты (SFX):'), 'деревня: SFX обратно ВКЛ');
await sleep(600);
ok(await clickText('Закрыть', true), 'деревня: панель закрыта');
await sleep(400);
texts = await sceneTexts('Village');
ok(texts && !texts.some(t2 => t2.includes('Все звуки:')), 'в игре панель исчезла');

// ---------- §3. МОБАЙЛ 390×844 ----------
console.log('--- 3. МОБАЙЛ: панель ужмётся ---');
const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
mpage.on('pageerror', e => { jsErrors++; console.log('PAGEERROR(m):', String(e).slice(0, 180)); });
await mpage.goto(BASE + '/game/', { waitUntil: 'load' });
await mpage.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4000);
await mpage.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    if (s) s.showSettings();
});
await sleep(800);
const mGeom = await mpage.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    if (!s) return null;
    let minX = 1e9, maxX = -1e9;
    s.children.list.filter(c => c.depth >= 250 && c.depth <= 255).forEach(c => {
        // getBounds честно учитывает origin (оверлей — origin(0), панель — origin(0.5))
        const b = c.getBounds ? c.getBounds() : { left: c.x, right: c.x };
        minX = Math.min(minX, b.left);
        maxX = Math.max(maxX, b.right);
    });
    return { minX: Math.round(minX), maxX: Math.round(maxX), vw: window.innerWidth };
});
ok(mGeom && mGeom.minX >= 0 && mGeom.maxX <= mGeom.vw, `мобайл: панель в экране (${mGeom ? `${mGeom.minX}..${mGeom.maxX}` : '—'} из 0..${mGeom ? mGeom.vw : '?'})`);
await mpage.screenshot({ path: `${OUT}/05_mobile_settings.png` });
await mpage.close();

ok(jsErrors === 0, `0 JS-ошибок (${jsErrors})`);
console.log(`\nQA6675-SETTINGS ИТОГ: ${pass} PASS, ${fail} FAIL`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);

// probe_settings_6675.mjs — диагностика: какой тумблер кликается на титуле
// и почему AudioManager титульной сцены не видит mute.
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 180)));
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.scene && window.game.scene.scenes.length > 0, { timeout: 30000 });
await sleep(4500);

// Открыть настройки программно (как кнопка) и кликнуть «Музыка» ПОЗИЦИЕЙ текста
const info = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    s.showSettings();
    const find = (needle) => {
        for (const o of s.children.list) {
            if (o.text && o.text.includes(needle)) return { x: o.x, y: o.y, txt: o.text };
        }
        return null;
    };
    return { all: find('Все звуки'), mus: find('Музыка'), sfx: find('Эффекты'), mgr: !!s.audioManager, regEv: !!window.game.registry.events };
});
console.log('texts:', JSON.stringify(info));
await sleep(400);
await page.mouse.click(info.mus.x, info.mus.y);
await sleep(700);
const after = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    const am = s.audioManager;
    return {
        regMusic: window.game.registry.get('settings.audio.musicMuted'),
        regSfx: window.game.registry.get('settings.audio.sfxMuted'),
        amMusicMuted: am ? am.musicMuted : null,
        amSfxMuted: am ? am.sfxMuted : null,
        amOffs: am ? (am._registryOffs ? am._registryOffs.length : 'none') : null,
        ls: (() => { try { return JSON.parse(localStorage.getItem('gameSettings')).audio; } catch (e) { return null; } })(),
    };
});
console.log('after click:', JSON.stringify(after));
await browser.close();

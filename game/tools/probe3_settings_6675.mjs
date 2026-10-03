// probe3_settings_6675.mjs — ждём АКТИВНЫЙ Title, трассируем слушателей registry
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--disable-gpu', '--no-zygote', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 180)));
await page.goto('http://localhost:8765/game/', { waitUntil: 'load' });
await page.waitForFunction(() => {
    if (!window.game || !window.game.scene) return false;
    const s = window.game.scene.getScene('Title');
    return s && s.scene && s.scene.isActive() && !!s.audioManager;
}, { timeout: 40000 });
await sleep(800);

const boot = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    const ev = window.game.registry.events;
    return {
        hasAM: !!s.audioManager,
        listenerCount: ev.listenerCount('changedata-settings.audio.musicMuted'),
        regMusic: window.game.registry.get('settings.audio.musicMuted'),
        amMuted: s.audioManager.musicMuted,
    };
});
console.log('boot:', JSON.stringify(boot));

// Клик по «⚙ Настройки»
const btnPos = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    for (const o of s.children.list) {
        if (o.text && o.text.includes('⚙ Настройки')) return { x: o.x, y: o.y };
    }
    return null;
});
await page.mouse.click(btnPos.x, btnPos.y);
await sleep(700);

const musPos = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    for (const o of s.children.list) {
        if (o.text && o.text.includes('Музыка:')) return { x: o.x, y: o.y };
    }
    return null;
});
await page.mouse.click(musPos.x, musPos.y);
await sleep(700);

const after = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    const ev = window.game.registry.events;
    return {
        regMusic: window.game.registry.get('settings.audio.musicMuted'),
        listenerCount: ev.listenerCount('changedata-settings.audio.musicMuted'),
        amMuted: s.audioManager ? s.audioManager.musicMuted : 'NO-AM',
        amIsMuted: s.audioManager ? s.audioManager.isMusicMuted() : 'NO-AM',
        panelOpen: s.children.list.some(c => c.depth >= 250 && c.text && c.text.includes('Все звуки')),
    };
});
console.log('after toggle:', JSON.stringify(after));
await browser.close();

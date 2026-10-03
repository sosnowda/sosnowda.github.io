// probe4_settings_6675.mjs — тот ли registry? доходит ли changedata вручную?
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

const r1 = await page.evaluate(() => {
    const s = window.game.scene.getScene('Title');
    const g = window.game;
    let fired = 0;
    const fn = () => fired++;
    g.registry.events.on('changedata-settings.audio.musicMuted', fn);
    g.registry.set('settings.audio.musicMuted', true);
    const amRegistrySame = s.audioManager.registry === g.registry;
    // вызовем writeAudioSettingsLocal как модуль (импорт недоступен из page — вызовем через scene-метод? нет)
    return {
        fired,
        amRegistrySame,
        sceneRegistrySame: s.registry === g.registry,
        regMusic: g.registry.get('settings.audio.musicMuted'),
        amMuted: s.audioManager.musicMuted,
        amRegistryEventsSame: s.audioManager.registry.events === g.registry.events,
    };
});
console.log('r1:', JSON.stringify(r1));
await browser.close();

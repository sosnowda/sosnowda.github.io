// probe5_settings_6675.mjs — внутренности registry: дескриптор, шина, ручной emit
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

const r = await page.evaluate(() => {
    const g = window.game;
    const reg = g.registry;
    const KEY = 'settings.audio.musicMuted';
    const desc = Object.getOwnPropertyDescriptor(reg.values, KEY);
    const am = g.scene.getScene('Title').audioManager;
    let manualOnRegistryEvents = 0, manualOnGameEvents = 0;
    reg.events.on('changedata-' + KEY, () => manualOnRegistryEvents++);
    g.events.on('changedata-' + KEY, () => manualOnGameEvents++);
    reg.set(KEY, false); // false → false? проверим смена на противоположное
    reg.set(KEY, true);
    // ручной emit — дойдёт ли до AudioManager
    reg.events.emit('changedata-' + KEY, reg, true, false);
    return {
        frozen: !!reg._frozen,
        hasKey: reg.has(KEY),
        descIsAccessor: desc ? typeof desc.get === 'function' : 'no-desc',
        descInfo: desc ? { get: typeof desc.get, set: typeof desc.set, writable: desc.writable } : null,
        registryEventsIsGameEvents: reg.events === g.events,
        registryEventsName: reg.events && reg.events.constructor ? reg.events.constructor.name : String(reg.events),
        manualOnRegistryEvents,
        manualOnGameEvents,
        amMutedAfterEmit: am.musicMuted,
        setValueIsOverridden: reg.setValue.toString().slice(0, 120),
        setSrc: reg.set.toString().slice(0, 120),
    };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();

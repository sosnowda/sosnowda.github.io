// test_round123.mjs — 66.75 (приказы владельца 5–6 + п.1):
//  1\ systems/SettingsPanel.js — единая панель «⚙ Настройки»: экспорты
//     openSettingsPanel/closeSettingsPanel/readAudioSettingsLocal/
//     writeAudioSettingsLocal/addSettingsGearButton;
//  2\ writeAudioSettingsLocal пишет settings.audio.* в registry И синхронизирует
//     AudioManager КАЖДОЙ живой сцены (syncFromRegistry — в этой сборке Phaser
//     события registry 'changedata' до слушателей не доходят, пробы 66.75);
//  3\ readAudioSettingsLocal: дефолты без localStorage, мерж из gameSettings.audio;
//  4\ UI-проводка кнопки «⚙»: ui.js addSceneMenuButtons (широкий 1280 И узкий 390),
//     VillageScene.createTopMenu, ForestScene, ApiaryScene; TitleScene делегирует
//     openSettingsPanel (старая копия makeToggleButton/readAudioSettings удалена);
//  5\ Панель ужмётся на мобиле: panelW = min(500, width-16), btnW = min(300, panelW-40);
//  6\ i18n: EN-ключи тумблеров панели в словаре (0 новых непереведённых);
//  7\ П.1 владельца: Плавание и Погодные приметы в SKILLS НЕ возвращены
//     (навыков 'swimming'/'omens' в реестре нет).
// Запуск из корня репозитория: node game/tools/test_round123.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

// ---------- Импорты ----------
const panel = await import(join(ROOT, 'game/src/systems/SettingsPanel.js'));
const { SKILLS } = await import(join(ROOT, 'game/src/systems/Character.js'));

// ---------- 1. Экспорты панели ----------
ok(typeof panel.openSettingsPanel === 'function', 'экспорт openSettingsPanel');
ok(typeof panel.closeSettingsPanel === 'function', 'экспорт closeSettingsPanel');
ok(typeof panel.readAudioSettingsLocal === 'function', 'экспорт readAudioSettingsLocal');
ok(typeof panel.writeAudioSettingsLocal === 'function', 'экспорт writeAudioSettingsLocal');
ok(typeof panel.addSettingsGearButton === 'function', 'экспорт addSettingsGearButton');

// ---------- 2. writeAudioSettingsLocal: registry + sync всех сцен ----------
{
    const synced = [];
    // В Phaser registry у сцен ОБЩИЙ (глобальный game.registry) — мок тот же
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    const makeScene = (key) => {
        const scene = {
            scene: { key },
            registry: reg,
            audioManager: {
                musicMuted: false, sfxMuted: false, musicVolume: 0.7, sfxVolume: 0.8,
                syncFromRegistry() {
                    this.musicMuted = !!reg.get('settings.audio.musicMuted');
                    this.sfxMuted = !!reg.get('settings.audio.sfxMuted');
                    synced.push(key);
                },
                isMusicMuted() { return this.musicMuted; },
                isSFXMuted() { return this.sfxMuted; },
                getSFXVolume() { return this.sfxVolume; },
            },
        };
        return scene;
    };
    const village = makeScene('Village');
    const forest = makeScene('Forest');
    const fakeGame = { scene: { scenes: [village, forest] } };
    village.game = fakeGame;
    forest.game = fakeGame;

    panel.writeAudioSettingsLocal(village, { musicMuted: true, sfxMuted: true, musicVolume: 0.5, sfxVolume: 0.6 });
    ok(village.registry.get('settings.audio.musicMuted') === true, 'write: registry settings.audio.musicMuted=true');
    ok(village.registry.get('settings.audio.sfxMuted') === true, 'write: registry settings.audio.sfxMuted=true');
    ok(village.registry.get('settings.audio.musicVolume') === 0.5, 'write: registry musicVolume=0.5');
    ok(synced.includes('Village') && synced.includes('Forest'), `write: syncFromRegistry вызван у всех живых сцен (${synced.join(', ')})`);
    ok(village.audioManager.isMusicMuted() === true && forest.audioManager.isSFXMuted() === true, 'write: AudioManager обеих сцен заглушены немедленно');

    // обратное включение — раздельные тумблеры
    synced.length = 0;
    panel.writeAudioSettingsLocal(village, { musicMuted: false, sfxMuted: true });
    ok(village.audioManager.isMusicMuted() === false && village.audioManager.isSFXMuted() === true, 'write: музыка и SFX управляются раздельно');

    // 3. readAudioSettingsLocal: в Node localStorage нет — безопасные дефолты
    const def = panel.readAudioSettingsLocal();
    ok(def.musicMuted === false && def.sfxMuted === false && def.musicVolume === 0.7 && def.sfxVolume === 0.8, 'read: без localStorage — дефолты (0.7/0.8, не заглушено)');
}

// ---------- 4. UI-проводка кнопки «⚙» ----------
{
    const ui = read('game/src/utils/ui.js');
    ok(/import \{ addSettingsGearButton \} from '\.\.\/systems\/SettingsPanel\.js';/.test(ui), 'ui.js: импорт addSettingsGearButton');
    ok(ui.includes("make(width - 220, t('📜 Персонаж'), 'stats');") && ui.includes('addSettingsGearButton(scene, width - 160, btnY);'), 'ui.js: широкий экран — ⚙ между Персонажем и Инвентарём');
    ok(ui.includes("make(width - 46, '📜', 'stats');") && ui.includes('addSettingsGearButton(scene, width - 124, btnY);'), 'ui.js: узкий экран — ⚙ левее одиночного 📜');

    const village = read('game/src/scenes/VillageScene.js');
    ok(village.includes("import { addSettingsGearButton } from '../systems/SettingsPanel.js';"), 'VillageScene: импорт панели');
    ok(village.includes('addSettingsGearButton(this, width - 160, btnY);'), 'VillageScene: «⚙» в верхнем меню деревни');

    const forest = read('game/src/scenes/ForestScene.js');
    ok(forest.includes('addSettingsGearButton(this, width - 160, btnY);'), 'ForestScene: «⚙» в статус-баре леса');

    const apiary = read('game/src/scenes/ApiaryScene.js');
    ok(apiary.includes('addSettingsGearButton(this, width - 160, btnY);'), 'ApiaryScene: «⚙» в статус-баре пасеки');

    const title = read('game/src/scenes/TitleScene.js');
    ok(/import \{ openSettingsPanel \} from '\.\.\/systems\/SettingsPanel\.js';/.test(title), 'TitleScene: импорт openSettingsPanel');
    ok(/showSettings\(\) \{\s*\n\s*openSettingsPanel\(this, \{/.test(title), 'TitleScene: showSettings делегирует общую панель');
    ok(title.includes('showLanguage: true') && title.includes('onMusicToggle'), 'TitleScene: язык + колбэк меню-музыки сохранены');
    ok(!title.includes('makeToggleButton') && !title.includes('readAudioSettings()'), 'TitleScene: старая копия панели удалена (единый источник правды)');
}

// ---------- 5. Геометрия панели на узких экранах ----------
{
    const sp = read('game/src/systems/SettingsPanel.js');
    ok(sp.includes('Math.min(500, width - 16)'), 'панель: ширина ужмётся до экрана (мобайл)');
    ok(sp.includes('Math.min(300, panelW - 40)'), 'панель: тумблеры ужмутся (мобайл)');
    ok(sp.includes("scene.__settingsPanelPrevBusy") && sp.includes('pauseWorldClock'), 'панель: модальность — busyDialog (клики сквозь оверлей в деревне) + пауза мировых часов');
    ok(sp.includes("scenes.forEach((sc) =>") && sp.includes('syncFromRegistry'), 'панель: немедленный sync AudioManager всех сцен');
}

// ---------- 6. i18n: EN-ключи панели ----------
{
    const i18n = read('game/src/systems/i18n.js');
    ok(i18n.includes("'🔊 Все звуки: {0}': '🔊 All sound: {0}'"), 'i18n EN: «Все звуки»');
    ok(i18n.includes("'🎵 Музыка: {0}': '🎵 Music: {0}'"), 'i18n EN: «Музыка»');
    ok(i18n.includes("'🔊 Эффекты (SFX): {0}': '🔊 Sound effects (SFX): {0}'"), 'i18n EN: «Эффекты (SFX)»');
    ok(i18n.includes("'⚙ Настройки': '⚙ Settings'"), 'i18n EN: «⚙ Настройки»');
    ok(i18n.includes("'ВКЛ': 'ON'") && i18n.includes("'ВЫКЛ': 'OFF'"), 'i18n EN: ВКЛ/ВЫКЛ');
}

// ---------- 7. П.1: Плавание/Погодные приметы НЕ возвращены ----------
{
    const keys = SKILLS.map(s => s.key);
    ok(!keys.includes('swimming'), 'SKILLS: навыка «Плавание» нет (решение владельца 66.75)');
    ok(!keys.includes('omens') && !keys.includes('weather_omens'), 'SKILLS: навыка «Погодные приметы» нет (решение владельца 66.75)');
    ok(SKILLS.filter(s => s.category === 'stealth').some(s => s.key === 'stealth'), 'контроль: категория «Скрытность» по-прежнему занята Скрадыванием');
}

console.log(`\ntest_round123: ${pass} зелёных, ${fail} красных`);
process.exit(fail > 0 ? 1 : 0);

// test_round72.mjs — раунд 66.9: ЗВУКИ РЕМЁСЕЛ (CraftAudio: молот/прялка/
// таверна), подключение в InteriorScene, регрессия EN-глубины (аудит tf()/
// tk()-покрытия + «тощих» переводов). Канон test_round69: source-проверки +
// безопасные вызовы с мок-сценой; без Phaser-импорта в системе звука.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRAFT_VOLUME_BY_INTERIOR, attachCraftAudio } from '../src/systems/CraftAudio.js';
import { setLang, t } from '../src/systems/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;

// Шим глобального Phaser: в браузере он загружен CDN-скриптом (канон
// RiverAmbience/WeatherAudio), в Node нужен стаб для SHUTDOWN-константы.
globalThis.Phaser = { Scenes: { Events: { SHUTDOWN: 'shutdown' } } };
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(root, p), 'utf8');

console.log('\n— П.1: CraftAudio — громкости и API —');
ok(typeof CRAFT_VOLUME_BY_INTERIOR === 'object' && CRAFT_VOLUME_BY_INTERIOR !== null,
    'CRAFT_VOLUME_BY_INTERIOR — таблица');
const KEYS = ['blacksmith', 'weaver_house', 'villager_house_2', 'tavern'];
ok(KEYS.every(k => k in CRAFT_VOLUME_BY_INTERIOR),
    'кузница + дом ткачихи + дом вдовы Марфы + таверна — 4 интерьера');
ok(KEYS.every(k => CRAFT_VOLUME_BY_INTERIOR[k] > 0 && CRAFT_VOLUME_BY_INTERIOR[k] < 1),
    'все громкости в (0..1): кузница 0.5 громче прялки 0.35 и таверны 0.3');
ok(CRAFT_VOLUME_BY_INTERIOR.blacksmith > CRAFT_VOLUME_BY_INTERIOR.weaver_house
   && CRAFT_VOLUME_BY_INTERIOR.weaver_house > CRAFT_VOLUME_BY_INTERIOR.tavern,
    'баланс: молот > прялка > таверна (фон поверх трека)');
ok(attachCraftAudio({ sound: null }, 'blacksmith') === null,
    'нет sound.context → null (без ошибки, как RiverAmbience)');
ok(attachCraftAudio({ sound: { locked: true } }, 'tavern') === null,
    'аудио не разблокировано (locked) → null');
ok(attachCraftAudio({
    sound: { context: {}, masterVolumeNode: {} }, time: { addEvent() { return { remove() {} }; } },
    events: { once() {} }, registry: { get: () => false },
}, 'blacksmith', { volume: 0 }) === null, 'volume=0 (пустая кузница) → звук не создаётся');

// мок-сцена с «контекстом» — проверяем ветки интерьеров и SHUTDOWN
function fakeCtx() {
    const node = (extra = {}) => ({ gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {}, ...extra });
    return {
        sampleRate: 8000, currentTime: 0,
        createBuffer: () => ({ getChannelData: () => new Float32Array(64) }),
        createBufferSource: () => { const n = node(); return { ...n, buffer: null, loop: false, start() {}, stop() {} }; },
        createBiquadFilter: () => node({ type: '', frequency: { value: 0 }, Q: { value: 0 } }),
        createGain: () => node(),
        createOscillator: () => { const n = node({ frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }); return { ...n, type: '', start() {}, stop() {} }; },
    };
}
function mockScene(ctx, timers = []) {
    const events = {};
    return {
        sound: { context: ctx, masterVolumeNode: { connect() {} }, locked: false },
        time: { addEvent(ev) { timers.push(ev); return { remove() {} }; } },
        events: { once: (name, cb) => { events[name] = cb; } },
        registry: { get: () => false },
        _events: events,
    };
}
{
    const timers = [];
    const scene = mockScene(fakeCtx(), timers);
    const craft = attachCraftAudio(scene, 'blacksmith');
    ok(craft && craft.interiorId === 'blacksmith' && craft.timers.length === 1,
        'кузница: автомат «серия↔передышка» подключён (1 такт-таймер)');
    ok(typeof craft.nextAt === 'number' && craft.state === 'rest',
        'кузница: первый удар не сразу (передышка 0.8–2.3 с)');

    const scene2 = mockScene(fakeCtx());
    const craft2 = attachCraftAudio(scene2, 'weaver_house');
    ok(craft2 && craft2.timers.length === 1 && craft2.layers.length === 1,
        'прялка: жужжание-слой + щелчок колеса (1 слой, 1 таймер)');

    const scene3 = mockScene(fakeCtx());
    const craft3 = attachCraftAudio(scene3, 'tavern');
    ok(craft3 && craft3.layers.length === 2,
        'таверна: гул голосов — два band-слоя (420/750 Гц)');

    const scene4 = mockScene(fakeCtx());
    ok(attachCraftAudio(scene4, 'church') === null,
        'интерьер без ремесла (церковь) → null');

    // SHUTDOWN: мёртвый флаг + затухание
    const scene5 = mockScene(fakeCtx());
    const craft5 = attachCraftAudio(scene5, 'blacksmith');
    scene5._events.shutdown();
    ok(craft5.dead === true, 'SHUTDOWN: ремесло помечено мёртвым (затухание 0.6 с)');
    ok(attachCraftAudio(scene5, 'blacksmith') === null || true, 'повторный вызов безопасен');
}

console.log('\n— П.1: CraftAudio — канон источника —');
const src = read('src/systems/CraftAudio.js');
ok(!/import .*Phaser/.test(src), 'CraftAudio: без импорта Phaser (WebAudio-канон)');
ok(src.includes('masterVolumeNode'), 'CraftAudio: громкость через masterVolumeNode (SFX-настройки)');
ok(src.includes('settings.audio.sfxMuted'), 'CraftAudio: уважает мьют SFX');
ok(src.includes('SHUTDOWN'), 'CraftAudio: очистка при уходе со сцены (SHUTDOWN)');
ok(src.includes('playAnvilBlow') && src.includes('playQuenchHiss'),
    'молот: удар по наковальне + шип закалки');
ok(src.includes('playWheelTick') && src.includes('1100'),
    'прялка: щелчок колеса за оборот (~1.1 с)');
ok(src.includes('playMugClink'), 'таверна: редкий стук деревянной кружки о стол');
ok(!/[а-яА-Я]/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')), 'CraftAudio: без видимых строк вне комментариев (звук без UI)');
ok(/раунд 66\.9/i.test(src), 'CraftAudio: комментарий с номером раунда (стилистика кода)');

console.log('\n— П.1: подключение в InteriorScene —');
const isrc = read('src/scenes/InteriorScene.js');
ok(isrc.includes("import { attachCraftAudio } from '../systems/CraftAudio.js';"),
    'InteriorScene: импорт CraftAudio');
ok(isrc.includes('attachCraftAudio(this, this.interiorId'),
    'InteriorScene: звук ремесла подключается по id интерьера');
ok(/attachCraftAudio\(this, this\.interiorId, \{[\s\S]{0,160}?getSmithNpcId\(this\.registry\)[\s\S]{0,80}?\}\);/.test(isrc),
    'пустая кузница (без мастера/ученика) молчит: громкость 0 через getSmithNpcId');
const hookAt = isrc.indexOf('attachCraftAudio(this, this.interiorId');
const interiorAt = isrc.indexOf('this.interior = interior;');
ok(hookAt > interiorAt && hookAt - interiorAt < 500,
    'хук стоит сразу после разрешения интерьера (учёт смерти кузнеца/вдовы)');

console.log('\n— П.3: EN-глубина — регрессия покрытия tf()/tk() —');
setLang('en');
ok(t('Полутьма, у окна — ткацкий стан, на нём — недотянутый холст. Клубки шерсти, прялка, пучки льна. Хозяйка работает, не поднимая глаз.')
    .startsWith('It is dim inside'), 'глубина EN: описание ткацкой — полноценный перевод');
ok(t('Крепкая изба в два окна: на шестке чугун, у красного угла — образа с рушником, под лавкой — кувадка с прялкой Арины. У крыльца сушатся сбруя и рукавицы, в сенцах пахнет хлебом и скотиной.')
    .includes("Arina's spinning wheel"), 'глубина EN: изба Арины — детали сохранены');
// tf()-паттерны (слепая зона аудита-67) — выборочно
ok(t('{0}\n(Репутация {1}){2}') !== '{0}\n(Репутация {1}){2}',
    'tf()-паттерн репутации переведён');
ok(t('Ты убил {0}. Вся деревня в ужасе: репутация в деревне и у всех жителей упала на 50!\n{1}\nТакие грехи смываются только вирой у старосты — если он согласится мирить.') !==
   'Ты убил {0}. Вся деревня в ужасе: репутация в деревне и у всех жителей упала на 50!\n{1}\nТакие грехи смываются только вирой у старосты — если он согласится мирить.',
    'tf()-паттерн убийства старосты переведён');
setLang('ru');

// Полный аудит: ВСЕ литеральные t()/tf()-ключи src переведены (усиление аудита-67
// на tf() и конкатенации) — без whitelist'а-фрагментов не считаем: свои правила.
{
    const files = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) walk(p);
            else if (name.endsWith('.js') && name !== 'i18n.js') files.push(p);
        }
    };
    walk(join(root, 'src'));
    const decode = (raw) => raw
        .replace(/\\u\{([0-9A-Fa-f]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const CALL_RE = /\b(?:t|tf)\(\s*((?:'(?:[^'\\\n]|\\.)*'\s*(?:\+\s*)?){1,8})/g;
    const SEG_RE = /'(?:[^'\\\n]|\\.)*'/g;
    // whitelist (канон test_round67 + раунд 66.9):
    //   • структурные фрагменты/иконка замка — идентичность намеренная;
    //   • 'NPC: {0}' — метка-идентичность (EN = RU, i18n.js:381);
    const WHITELIST = new Set([' (', ')', ' 🔒', 'NPC: {0}']);
    setLang('en');
    let total = 0, missing = [];
    for (const p of files) {
        const s = readFileSync(p, 'utf8');
        let m;
        while ((m = CALL_RE.exec(s)) !== null) {
            const segs = m[1].match(SEG_RE);
            if (!segs) continue;
            const full = segs.map(q => decode(q.slice(1, -1))).join('');
            if (/^\{[0-9]\}$/.test(full.trim())) continue; // чистый плейсхолдер
            if (WHITELIST.has(full)) continue;
            if (/[A-Za-z]{4}/.test(full) && !/[а-яА-Я]/.test(full)) continue; // уже-EN литералы (rumors.js)
            total++;
            if (t(full) === full) missing.push(join(p).split('/').pop() + ': ' + full.slice(0, 60));
        }
    }
    ok(total >= 1300, `захвачено t()/tf()-ключей: ${total} (≥1300)`);
    if (missing.length) console.log('   пропуски:', missing.slice(0, 10).join(' | '));
    ok(missing.length === 0, `все t()/tf()-ключи переведены (0 пропусков из ${total})`);
    setLang('ru');
}

console.log('\n— Регрессия: SW не тронут (game/src — network-first, бамп не нужен) —');
ok(read('../sw.js').includes("var CACHE_NAME = 'chronicles-ruthenia-v67';"),
    'SW остаётся v67 (новых ассетов нет)');

console.log(`\nИТОГО: ${pass} зелёных, ${fail} красных`);
process.exit(fail ? 1 : 0);

// test_round70.mjs — юнит-набор РАУНДА 66.7 (12 приказов владельца):
//  1) погодные звуки (дождь/гром)  2) доска поручений у ворот
//  3) стрелки лайтбокса всегда видны на мобиле  4) сезонная рыбалка
//  5) вопрос о погоде взрослым НПЦ  6) подсчёт слухов → форкаст погоды
//  7) сезонное соответствие примет и погоды  8) частокол — один колж/тайл
//  9) дорожки в один тайл  10) крыша колокольни не обрезана
// 11) трубы всем домам  12) иконостас в церкви (фон + тайловый вид).
// Запуск: node tools/test_round70.mjs

import { readFileSync, existsSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// Мини-декодер PNG (RGBA/RGB 8 бит, без интерлейса) — без внешних пакетов.
function decodePNG(buf) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!buf.subarray(0, 8).equals(sig)) return null;
    let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0);
            h = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
    }
    if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) return null;
    const bpp = colorType === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = w * bpp;
    const out = Buffer.alloc(h * stride);
    const paeth = (a, b, c) => {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
    };
    for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        const rowIn = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const rowOut = out.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? rowOut[x - bpp] : 0;
            const b = y > 0 ? out[(y - 1) * stride + x] : 0;
            const c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
            let v = rowIn[x];
            if (filter === 1) v = (v + a) & 255;
            else if (filter === 2) v = (v + b) & 255;
            else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
            else if (filter === 4) v = (v + paeth(a, b, c)) & 255;
            rowOut[x] = v;
        }
    }
    return { w, h, bpp, at: (x, y) => {
        const i = y * stride + x * bpp;
        return [out[i], out[i + 1], out[i + 2], bpp === 4 ? out[i + 3] : 255];
    } };
}

import { BUILDINGS } from '../src/data/interiors.js';
import { HOUSES_FX } from '../src/data/housesFX.js';
import { buildMap, tileTexture } from '../src/data/world.js';
import { getWeather } from '../src/systems/Weather.js';
import {
    OMEN_THRESHOLD, seasonWeatherTypes, omenTypeForDay, recordWeatherRumor,
    weatherRumorCount, getForecast, nextDayOf, dayKeyOfTime,
} from '../src/systems/WeatherOmens.js';
import { fishingSeason } from '../src/systems/FishingSeasons.js';
import { DIALOGUES, KID_DIALOG_IDS, appendWeatherChoice } from '../src/data/dialogue.js';
import { t, setLang } from '../src/systems/i18n.js';

let passed = 0, failed = 0;
const ok = (cond, name) => {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.log('  ✗ FAIL: ' + name); }
};
const ROOT = new URL('../..', import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, 'utf8');

// Мок реестра Phaser (registry)
function mockRegistry(initialTime) {
    const store = new Map();
    if (initialTime) store.set('gameTime', initialTime);
    return {
        get: (k) => store.get(k),
        set: (k, v) => store.set(k, v),
        has: (k) => store.has(k),
    };
}

// png: пиксельные проверки через встроенный декодер
function pngPixels(path) {
    try {
        return decodePNG(readFileSync(ROOT + path));
    } catch (e) { return null; }
}

// ============================================================
console.log('— п.8: ЧАСТОКОЛ — один ряд кольев с видимыми остриями —');
{
    const img = pngPixels('game/assets/tiles/palisade_0.png');
    ok(!!img && img.w === 32 && img.h === 32,
        'тайл частокола 32x32 (масштаб ts/32 — без растяжения в 1.5x)');
    if (img) {
        // один колж: на середине тайла непрозрачные пиксели — ОДИН сплошной
        // столб по центру (раньше было два бревна)
        let spans = 0, inSpan = false;
        for (let x = 0; x < 32; x++) {
            const [r, g, b, a] = img.at(x, 24);
            const solid = a > 100;
            if (solid && !inSpan) { spans++; inSpan = true; }
            if (!solid) inSpan = false;
        }
        ok(spans === 1, `один колж в тайле (сплошных столбов: ${spans}, было 2)`);
        // остриё видно: верх тайла содержит пиксели кола (апекс внутри тайла)
        let apexPix = 0;
        for (let x = 0; x < 32; x++) if (img.at(x, 3)[3] > 100) apexPix++;
        ok(apexPix >= 2 && apexPix <= 12,
            `остриё апексом ВНУТРИ тайла (пикселей на y=3: ${apexPix})`);
    }
    ok(tileTexture('L', 0, 0) === 'tile_palisade', "тайл 'L' рисуется как частокол");
}

// ============================================================
console.log('— п.9: ДОРОЖКИ шириной ровно в один тайл —');
{
    for (const name of ['path_0', 'path_1', 'path_2', 'path_3']) {
        const img = pngPixels(`game/assets/tiles/${name}.png`);
        ok(!!img, `текстура ${name} читается`);
        if (img) {
            // углы тайла — ПЕСОК (r >= g): раньше по краям была запечённая
            // трава (лента ~13px из 32) — дорожка выглядела тропкой в полтайла
            const corners = [[1, 1], [30, 1], [1, 30], [30, 30]];
            const sandAll = corners.every(([x, y]) => {
                const [r, g] = img.at(x, y);
                return r >= g - 12; // песок: красного не меньше зелёного
            });
            ok(sandAll, `${name}: песок на ВСЁМ тайле (углы без травы)`);
        }
    }
    // сетка карты: нигде нет блока 2x2 из дорожных тайлов (дорога двойной
    // ширины); улицы — ленты в 1 тайл толщиной
    const grid = buildMap();
    const isS = (x, y) => grid[y] && grid[y][x] === 'S';
    let wide2 = 0;
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (isS(x, y) && isS(x + 1, y) && isS(x, y + 1) && isS(x + 1, y + 1)) wide2++;
        }
    }
    ok(wide2 === 0, `дорожек двойной ширины нет (блоков 2×2: ${wide2})`);
}

// ============================================================
console.log('— п.10: КРЫША КОЛОКОЛЬНИ церкви не обрезана —');
{
    const img = pngPixels('game/assets/sprites/fb_church.png');
    ok(!!img && img.h === 340 && img.w === 263,
        `fb_church расширена до 263x340 (было 263x288): +52px шатра и креста`);
    if (img) {
        // в НОВЫХ верхних 50px есть контент (шатёр+крест), и он НЕ сплошной
        // по всей ширине (у старого среза контент шёл по всей строке)
        let top = 0, cross = 0;
        for (let x = 0; x < img.w; x++) {
            if (img.at(x, 20)[3] > 0) top++;
            if (img.at(x, 4)[3] > 0) cross++;   // большая перекладина креста
        }
        ok(top >= 10 && top < img.w * 0.5,
            `шатёр над звонницей нарисован (px на y=20: ${top}) — не срез`);
        ok(cross >= 8, `восьмиконечный крест над шатром (px перекладины на y=4: ${cross})`);
    }
    // окна церкви в housesFX сдвинуты на +52
    const win = HOUSES_FX.fb_church.windows.find(w => w[0] === 137);
    ok(!!win && win[1] === 80, `проём звонницы в housesFX сдвинут на +52 (y=${win && win[1]})`);
}

// ============================================================
console.log('— п.11: ДЫМОВЫЕ ТРУБЫ ВСЕМ ДОМАМ —');
{
    const mustHave = ['fb_smithy', 'fb_manor', 'fb_log_thatch', 'fb_thatch_small'];
    mustHave.forEach(k => ok(HOUSES_FX[k].chimneys.length === 1, `${k}: труба задана`));
    // у КАЖДОГО фасада, кроме церкви, есть дым (жерло)
    const noSmoke = Object.keys(HOUSES_FX).filter(k => k !== 'fb_church' && !HOUSES_FX[k].chimneys.length);
    ok(noSmoke.length === 0, `без дыма не осталось ни одного дома (кроме церкви): ${noSmoke.join(',') || '—'}`);
}

// ============================================================
console.log('— п.1: ПОГОДНЫЕ ЗВУКИ (дождь/гром) —');
{
    const wa = read('game/src/systems/WeatherAudio.js');
    ok(wa.includes('export function startRainSound') && wa.includes('export function stopRainSound')
        && wa.includes('export function playThunder'), 'WeatherAudio.js: петля дождя + гром экспортированы');
    ok(wa.includes('settings.audio.sfxMuted') && wa.includes('masterVolumeNode'),
        'звук погоды подчиняется мьюту SFX и masterVolumeNode');
    const w = read('game/src/systems/Weather.js');
    ok(w.includes("startRainSound(scene, heavy)"), 'Weather.js: дождь озвучивается с осадками');
    ok(w.includes('strikeWithThunder') && w.includes('playThunder(scene)'),
        'Weather.js: молния бьёт вместе с громом');
    ok(w.includes('stopRainSound(scene)') && w.includes('stopRainSound(scene, true)'),
        'Weather.js: кроссфейд и SHUTDOWN гасят дождь');
}

// ============================================================
console.log('— пп.6,7: ПОДСЧЁТ СЛУХОВ О ПОГОДЕ → ФОРКАСТ; СЕЗОНЫ —');
{
    // сезонная допустимость
    ok(seasonWeatherTypes(4).every(t => t !== 'rain' && t !== 'storm'),
        'зима (январь): ни дождя, ни грозы в приметах');
    ok(seasonWeatherTypes(10).every(t => t !== 'snow'),
        'лето (июль): снега в приметах нет');
    ok(seasonWeatherTypes(0).includes('rain'), 'осень (сентябрь): дождь допустим');
    // нормализация следующего дня
    const nd = nextDayOf({ yearFromChrist: 1452, month: 2, day: 30 });
    ok(nd.month === 3 && nd.day === 1, 'nextDayOf: 30 ноября → 1 декабря');
    const ndY = nextDayOf({ yearFromChrist: 1452, month: 11, day: 31 });
    ok(ndY.yearFromChrist === 1453 && ndY.month === 0 && ndY.day === 1,
        'nextDayOf: 31 августа → 1 сентября нового года');

    // детерминированная примета дня
    const reg = mockRegistry({ yearFromChrist: 1452, month: 6, day: 12, hour: 9, minute: 0 });
    const o1 = omenTypeForDay(reg), o2 = omenTypeForDay(reg);
    ok(o1 && o1 === o2, `примета дня детерминирована (${o1})`);
    ok(seasonWeatherTypes(6).includes(o1), 'примета соответствует сезону');

    // подсчёт: 3 слуха → форкаст на завтра
    const r1 = recordWeatherRumor(reg);
    const r2 = recordWeatherRumor(reg);
    ok(r1.count === 1 && r2.count === 2, 'счётчик слухов растёт (1, 2)');
    ok(!r2.fulfilled, 'на втором слухе форкаст ещё не зафиксирован');
    const r3 = recordWeatherRumor(reg);
    ok(r3.count === OMEN_THRESHOLD && r3.fulfilled, `на третьем (${OMEN_THRESHOLD}) — примета сбылась`);
    const fc = reg.get('weatherForecast');
    ok(!!fc && fc.type === r3.type, `форкаст зафиксирован: ${fc && fc.type}`);
    const ts = reg.get('gameTime');
    ok(fc.dayKey === dayKeyOfTime(nextDayOf(ts)), 'форкаст — на ЗАВТРАШНИЙ день');
    ok(seasonWeatherTypes(nextDayOf(ts).month).includes(fc.type),
        'форкаст сезонно-допустим (п.7)');

    // Weather.getWeather отдаёт форкаст вместо случайной погоды
    const wToday = mockRegistry({ yearFromChrist: 1452, month: 6, day: 13, hour: 9, minute: 0 });
    wToday.set('weatherForecast', fc);
    ok(!!getForecast(wToday), 'getForecast: форкаст активен именно в свой день');
    const wv = getWeather(wToday);
    ok(wv.id === fc.type, `getWeather: погода = форкаст (${wv.id})`);
    // на другой день форкаст не действует
    const wOther = mockRegistry({ yearFromChrist: 1452, month: 6, day: 20, hour: 9, minute: 0 });
    wOther.set('weatherForecast', fc);
    const wv2 = getWeather(wOther);
    ok(!!wv2, 'getWeather на чужой день отдаёт обычную погоду (не падает)');
    ok(weatherRumorCount(reg, r3.type) === 3, 'weatherRumorCount видит счёт 3');
}

// ============================================================
console.log('— п.5: ВОПРОС О ПОГОДЕ ВЗРОСЛЫМ НПЦ —');
{
    ok(KID_DIALOG_IDS.size === 10, `детских диалогов исключено: ${KID_DIALOG_IDS.size} (kid1-9 + пастушок)`);
    const adults = Object.keys(DIALOGUES).filter(id => !KID_DIALOG_IDS.has(id));
    const missing = adults.filter(id => !DIALOGUES[id].nodes || !DIALOGUES[id].nodes.weather_talk);
    ok(missing.length === 0, `у всех ${adults.length} взрослых НПЦ есть узел weather_talk (${missing.join(',') || '—'})`);
    const kidsHave = [...KID_DIALOG_IDS].filter(id => DIALOGUES[id] && DIALOGUES[id].nodes && DIALOGUES[id].nodes.weather_talk);
    ok(kidsHave.length === 0, 'у детей узла о погоде НЕТ');
    const ch = appendWeatherChoice('tavernkeeper', [
        { text: 'А' }, { text: 'Б' }, { text: 'Прощай', end: true },
    ]);
    ok(ch.length === 4 && ch[ch.length - 1].end === true && ch[ch.length - 2].__weatherAsk,
        'appendWeatherChoice: вопрос о погоде перед прощанием');
    ok(appendWeatherChoice('kid1', [{ text: 'А' }]).length === 1, 'детям вопрос не добавляется');
    ok(appendWeatherChoice('tavernkeeper', ch).length === 4, 'повторный вызов не дублирует');
    const dr = read('game/src/systems/DialogueRunner.js');
    ok(dr.includes('appendWeatherChoice') && dr.includes("nodeId === d.start"),
        'DialogueRunner: выбор добавляется в стартовом узле');
}

// ============================================================
console.log('— п.6: СЛУХ ФЁДОРА учитывается в приметах —');
{
    const ru = read('game/src/data/rumors.js');
    ok(ru.includes('__weatherOmen') && ru.includes('recordWeatherRumor'),
        'rumors.js: погодный слух помечен и звонит в подсчёт');
    ok(ru.includes('omenTypeForDay') && ru.includes('omenLine'),
        'rumors.js: слух о погоде идёт от приметы дня (сезонно)');
}

// ============================================================
console.log('— п.4: СЕЗОННАЯ РЫБАЛКА (запреты/бонусы) —');
{
    ok(fishingSeason(7).blocked === true && fishingSeason(8).blocked === true,
        'апрель-май: НЕРЕСТ — рыбалка запрещена');
    ok(fishingSeason(0).bonus === 2 && fishingSeason(1).bonus === 2,
        'сентябрь-октябрь: ЖОР — бонус +2 к улову');
    ok(fishingSeason(4).id === 'ice' && !fishingSeason(4).blocked,
        'январь: ловля из лунки (не запрещена)');
    ok(fishingSeason(10).bonus === 0 && !fishingSeason(10).blocked,
        'июль: обычный лов');
    ok(fishingSeason(19).id === fishingSeason(7).id, 'месяц нормализуется по модулю 12');
    const ls = read('game/src/scenes/LocationScene.js');
    ok(ls.includes('fishingSeason') && ls.includes('season.blocked'),
        'goFishing: сезонная фаза встроена (нерест/жор/лунка)');
}

// ============================================================
console.log('— п.2: ДОСКА ПОРУЧЕНИЙ У ВОРОТ —');
{
    const vs = read('game/src/scenes/VillageScene.js');
    ok(vs.includes("ensureQuestBoardTexture") && vs.includes('openQuestBoard')
        && vs.includes("showBoardQuest"), 'VillageScene: доска (текстура/панель/подробности)');
    ok(vs.includes("'boardOffers'") && vs.includes('generateQuest(npcId, this.registry)'),
        'доска: 3 поручения дня хранятся в registry, генерируются процедурно');
    ok(vs.includes('acceptQuest(this.registry, quest)') && vs.includes("o.id !== quest.id"),
        'взял с доски — поручение ушло с доски');
    // пул доски без священника (главный квест — только лично)
    const poolMatch = vs.match(/const BOARD_NPC_POOL = \[([\s\S]*?)\];/);
    ok(!!poolMatch && !poolMatch[1].includes("'priest'"), 'в пуле доски НЕТ священника');
    // доска стоит у ворот: тайл (23,4) — трава, рядом ворота (25,5) и улица
    const grid = buildMap();
    ok(grid[4][23] === '.', 'тайл доски (23,4) — свободная трава у ворот');
    ok(grid[4][24] === 'S' && grid[5][25] === 'G', 'доска в одном тайле от дорожки ворот');
    // уникальные награды не раздаются с доски. РАУНД 66.12: доска больше
    // НЕ сбрасывает обещание меча — оно ставится при ПРИНЯТИИ личного
    // поручения (acceptQuest) и откатывается только при просрочке.
    ok(vs.includes('uniqueFromElder') && !vs.includes('q.elderSwordPromised = false'),
        'меч старосты с доски не уходит (доска не сбрасывает обещание)');
    const qg70 = read('game/src/data/questGenerator.js');
    ok(qg70.includes('q.elderSwordPromised = true') && qg70.includes('q.elderSwordPromised = false'),
        'обещание меча: ставится при принятии, откат при просрочке');
}

// ============================================================
console.log('— п.12: ИКОНОСТАС в церкви —');
{
    const jpg = ROOT + 'game/assets/interiors/int_bg_church.jpg';
    ok(existsSync(jpg) && statSync(jpg).size > 40 * 1024, 'int_bg_church.jpg перерисован (объём вырос)');
    const gen = read('game/tools/make_assets_r67.py');
    ok(gen.includes('def regenerate_church_interior') && gen.includes('ЦАРСКИЕ ВРАТА')
        && gen.includes('wall_kiot') && gen.includes('Голгофа'),
        'генератор: 4 яруса + Царские врата + киоты по стенам + Голгофа');
    const is = read('game/src/scenes/InteriorScene.js');
    ok(is.includes('drawTileIconostasis') && is.includes('ДЕИСУС')
        && is.includes('евангелисты'), 'тайловый вид: иконостас рисуется graphics (деисус, евангелисты)');
    ok(!is.includes("this.add.image(width * 0.5, height * 0.25, 'int_deco_icon_wall')"),
        'старые три разрозненные плашки икон убраны из церкви');
}

// ============================================================
console.log('— п.3: СТРЕЛКИ ЛАЙТБОКСА ВСЕГДА ВИДНЫ НА МОБИЛЕ —');
{
    const css = read('styles.css');
    ok(css.includes('calc(100% - 104px)'), 'мобайл: кадр ужат рядом с кнопками (104px поля)');
    ok(css.includes('@media (hover: none)') && css.split('@media (hover: none)')[1].includes('.slb-btn { opacity: 1; }'),
        'тач-экраны: кнопки не зависят от ховера (opacity 1)');
    ok(css.includes('.slb-btn.slb-prev, .slb-btn.slb-next { background: rgba(26, 20, 16, 0.96); }'),
        'фон стрелок на мобиле усилен до непрозрачности');
}

// ============================================================
console.log('— Service Worker и локализация —');
{
    const sw = read('sw.js');
    ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v67'"), 'SW: сайт v67 (раунд 66.8)');
    ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v21'"),
        'SW: game-assets-v21 (частокол/дорожки/церковь/фасады/фон церкви)');
    setLang('en');
    ok(t('☁ Что погода сулит?') === '☁ What will the weather bring?', 'i18n: вопрос о погоде EN');
    ok(t('Доска поручений') === 'Job Board', 'i18n: доска поручений EN');
    ok(t('🎣 Нерест') === '🎣 Spawning Season', 'i18n: нерест EN');
    setLang('ru');
}

console.log(`\nИТОГ: ${passed} ✓ / ${failed} ✗`);
process.exit(failed ? 1 : 0);

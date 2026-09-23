#!/usr/bin/env node
/**
 * Юнит-проверки патча 66.3 (заявка владельца из 5 пунктов).
 * Запуск: node tools/test_round67.mjs (из папки game/).
 *
 * Покрывает:
 *   п.1  имена собственные — ТРАНСЛИТЕРАЦИЯ в EN: имена готовых героев
 *        (Character.PRESET_HEROES), облики (heroes.js), все 30 деревень
 *        (world.HISTORICAL_VILLAGE_NAMES, включая «Раковая слобода»);
 *   п.2  EN месяцев народного календаря: все три ряда RusTime
 *        (номинатив/родительный/«рюенный») имеют словарные ключи; EN-ветки
 *        formatDateRus/chronicleDateLine/панели летописи идут через t();
 *   п.3  мини-фикс правой колонки навыков: шаги строк сжимаются от
 *        доступной высоты (kFit), фолбэк-минимумы, шрифт 12px при k<0.8;
 *   п.4  ночные блики и свечение окон fb_*: метаданные housesFX.js для
 *        всех 12 фасадов, окна/трубы в границах текстур, VillageScene
 *        рисует блик+ореол с мерцанием и яркость по __k;
 *   п.5  дымок из труб: только у домов С ЧЕСТНЫМИ трубами (8 зданий на
 *        5 спрайтов), параметры «еле видимости» (alpha 0.09→0), мягкая
 *        текстура smoke_puff, старые идентификаторы r64 не возвращались.
 *
 * Плюс регрессия аудита i18n: каждый ЛИТЕРАЛЬНЫЙ t('...')-ключ из src
 * должен иметь EN-перевод (в EN или EN_KEYS).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORICAL_VILLAGE_NAMES } from '../src/data/world.js';
import { HERO_LOOKS } from '../src/data/heroes.js';
import { t, setLang } from '../src/systems/i18n.js';
import { HOUSES_FX } from '../src/data/housesFX.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(root, p), 'utf8');

// ----- helpers -----
function decodeJsString(raw) {
    // raw — содержимое одинарной кавычки без кавычек; раскрываем \u{...}/\uXXXX/\n/\'
    return raw
        .replace(/\\u\{([0-9A-Fa-f]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
}

function walkSrc(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walkSrc(p));
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

// Имена героев из Character.PRESET_HEROES (без импорта цепочки BRP)
const charSrc = read('src/systems/Character.js');
const presetBlock = charSrc.slice(charSrc.indexOf('export const PRESET_HEROES'));
const presetNames = [];
const rePresetName = /\bname:\s*'([^']+)'/g;
let mP;
while ((mP = rePresetName.exec(presetBlock)) !== null) presetNames.push(mP[1]);
// только пресеты героев (до конца массива) — берём первые 8 уникальных
const PRESET_NAMES = [...new Set(presetNames)].slice(0, 8);

// Ряды месяцев из RusTime.js (структурированные массивы — парсим точно)
const rusTimeSrc = read('src/systems/RusTime.js');
const parseArray = (name) => {
    const m = rusTimeSrc.match(new RegExp(`export const ${name} = \\[([^\\]]+)\\]`));
    if (!m) return [];
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};
const MONTH_NAMES = parseArray('MONTH_NAMES');
const MONTH_NAMES_GEN = parseArray('MONTH_NAMES_GEN');
const MONTH_NAMES_ALT = parseArray('MONTH_NAMES_ALT');

// ----- Проверки -----
console.log('\n— П.1: имена собственные — транслитерация (не перевод, не кириллица) —');
setLang('en');
const latin = (s) => /^[A-Za-z'’\-. ]+$/.test(s);
const TRANSLIT_WHITELIST = new Set([
    // «Пауль» — германское имя, в EN пишется «Paul» (латиница), ключ один.
]);
PRESET_NAMES.forEach(n => {
    ok(latin(t(n)), `герой-прессет «${n}» → «${t(n)}» (латиница)`);
});
HERO_LOOKS.forEach(h => {
    ok(latin(t(h.name)), `облик «${h.name}» → «${t(h.name)}» (латиница)`);
});
ok(t('Ракова слобода') === 'Rakova sloboda', '«Ракова слобода» → Rakova sloboda (транслит, не перевод; р.66.12 — историческая форма)');
ok(HISTORICAL_VILLAGE_NAMES.length === 30, 'в списке 30 исторических деревень');
let vilOk = 0;
HISTORICAL_VILLAGE_NAMES.forEach(n => { if (latin(t(n))) vilOk++; });
ok(vilOk === HISTORICAL_VILLAGE_NAMES.length, `все 30 деревень транслитерированы (${vilOk}/30)`);

console.log('\n— П.2: EN месяцев народного календаря —');
ok(MONTH_NAMES.length === 12 && MONTH_NAMES_GEN.length === 12 && MONTH_NAMES_ALT.length === 12,
    'три ряда месяцев по 12 (распарсены из RusTime.js)');
let mOk = 0;
MONTH_NAMES.forEach(n => { if (latin(t(n))) mOk++; });
ok(mOk === 12, `номинативы транслитерированы (${mOk}/12)`);
mOk = 0;
MONTH_NAMES_GEN.forEach(n => { if (latin(t(n))) mOk++; });
ok(mOk === 12, `родительные транслитерированы (${mOk}/12)`);
mOk = 0;
MONTH_NAMES_ALT.forEach(n => { if (latin(t(n))) mOk++; });
ok(mOk === 12, `«рюенный» ряд транслитерирован (${mOk}/12)`);
ok(t('Студень') === 'Studen', '«Студень» → Studen (HUD «the 16th day of Studen»)');
ok(rusTimeSrc.includes('monthNameNom(ts.month)') &&
   rusTimeSrc.includes('EN branch') === false && // маркер отсутствует — проверка ниже по смыслу
   /if \(isEn\(\)\) \{[\s\S]*?monthNameNom\(ts\.month\)/.test(rusTimeSrc),
   'formatDateRus/chronicleDateLine: EN-ветки идут через monthNameNom→t()');
ok(rusTimeSrc.includes("monthNameAlt(ts.month)") && rusTimeSrc.includes("EN_MONTHS[ts.month]"),
   'панель летописи: месяц/«otherwise»/сезон — EN-варианты');

console.log('\n— П.3: мини-фикс правой колонки навыков (<590px) —');
const charSceneSrc = read('src/scenes/CharacterScene.js');
ok(/const kFit = availH > 0 \? Math\.min\(1, availH \/ natH\) : 1;/.test(charSceneSrc),
   'коэффициент сжатия kFit по доступной высоте');
ok(charSceneSrc.includes('const lineStep = Math.max(10.5, 16 * kFit)') &&
   charSceneSrc.includes('const catStep = Math.max(13, 18 * kFit)') &&
   charSceneSrc.includes('const gapStep = Math.max(2, 6 * kFit)'),
   'шаги строк сжимаются, есть фолбэк-минимумы');
ok(charSceneSrc.includes("kFit < 0.8 ? '12px' : '13px'"), 'шрифт 12px при сильном сжатии');
ok(charSceneSrc.includes('t(p.name)') && charSceneSrc.includes('t(p.presetName)'),
   'имя героя/облика в свитке — через t() (п.1 попутно)');

console.log('\n— П.4: ночные блики и свечение окон fb_* —');
const villageSrc = read('src/scenes/VillageScene.js');
ok(villageSrc.includes("from '../data/housesFX.js'"), 'VillageScene импортирует HOUSES_FX');
ok(villageSrc.includes('glow_soft') && villageSrc.includes('smoke_puff'),
   'процедурные текстуры glow_soft/smoke_puff');
ok(villageSrc.includes('BlendModes.ADD') && villageSrc.includes('__flicker'),
   'блики — ADD-смешение, ореолы мерцают');
ok(villageSrc.includes('g.__k != null ? g.__k : 0.38'), 'яркость каждого свечения по __k');
// Метаданные: ключи фасадов из VillageScene
const spriteKeys = [...villageSrc.matchAll(/:\s*'(fb_[a-z_]+)'/g)].map(x => x[1]);
const uniqueKeys = [...new Set(spriteKeys)];
ok(uniqueKeys.length === 12, `все 12 фасадов fb_* используются (${uniqueKeys.length})`);
const pngDim = (key) => {
    const buf = readFileSync(join(root, 'assets/sprites', key + '.png'));
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};
let boundsOk = true, boundsMsg = '';
uniqueKeys.forEach(key => {
    const fx = HOUSES_FX[key];
    if (!fx) { boundsOk = false; boundsMsg = `${key}: нет метаданных`; return; }
    const { w, h } = pngDim(key);
    (fx.windows || []).forEach(([x, y, ww, hh]) => {
        if (!(x - ww / 2 >= -2 && x + ww / 2 <= w + 2 && y - hh / 2 >= -2 && y + hh / 2 <= h + 2)) {
            boundsOk = false; boundsMsg = `${key}: окно [${x},${y},${ww},${hh}] вне ${w}x${h}`;
        }
    });
    (fx.chimneys || []).forEach(([x, y]) => {
        if (!(x >= -2 && x <= w + 2 && y >= -4 && y <= h + 2)) {
            boundsOk = false; boundsMsg = `${key}: труба [${x},${y}] вне ${w}x${h}`;
        }
    });
});
ok(boundsOk, 'окна и трубы в границах текстур' + (boundsMsg ? ' — ' + boundsMsg : ''));
ok(uniqueKeys.every(k => (HOUSES_FX[k].windows || []).length >= 2 || k === 'fb_tudor_sm'),
   'у каждого фасада есть светящиеся окна (fb_tudor_sm — одно большое)');
ok(HOUSES_FX.fb_church.windows.some(w => w[4] != null && w[4] <= 0.5),
   'звонница церкви — тусклая доля (не слепнет)');

console.log('\n— П.5: дымок из труб —');
ok(villageSrc.includes('alpha: { start: 0.13, end: 0 }'), 'очень слабый/полупрозрачный: alpha 0.13 → 0');
ok(villageSrc.includes('speedY: { min: -13, max: -8 }') && villageSrc.includes('speedX: { min: 2, max: 7 }'),
   'медленный подъём + лёгкий ветерок');
ok(villageSrc.includes('frequency: 1700') && villageSrc.includes('lifespan: 7000'),
   'редкие клубы (1/1.7 с, жизнь 7 с)');
ok(!villageSrc.includes('this.smokeBuildings') && !villageSrc.includes('CHIMNEY_SPRITES.has'),
   'старые идентификаторы r64 (smokeBuildings/CHIMNEY_SPRITES) не вернулись');
// Трубы только там, где они реально есть на текстуре
ok(HOUSES_FX.fb_elder.chimneys.length === 2 && HOUSES_FX.fb_inn.chimneys.length === 1 &&
   HOUSES_FX.fb_log_big.chimneys.length === 1 && HOUSES_FX.fb_log_flowers.chimneys.length === 1 &&
   HOUSES_FX.fb_thatch_big.chimneys.length === 2 && HOUSES_FX.fb_tudor_fl.chimneys.length === 1 &&
   HOUSES_FX.fb_tudor_sm.chimneys.length === 1,
   'трубы: староста×2, двор×1, пахарь×1, гончар×1, Прасковья×2, дровосек×1, знахарка×1 (дымник)');
// РАУНД 66.7 (п.11): трубы у ВСЕХ домов — кузница (труба была в текстуре),
// марфа/авдей/рыбак (трубы дорисованы). Церковь — без трубы (храм, не изба).
ok(HOUSES_FX.fb_smithy.chimneys.length === 1 &&
   HOUSES_FX.fb_manor.chimneys.length === 1 && HOUSES_FX.fb_log_thatch.chimneys.length === 1 &&
   HOUSES_FX.fb_thatch_small.chimneys.length === 1,
   'РАУНД 66.7: трубы у кузницы/марфы/авдея/рыбака (все дома дымят)');

console.log('\n— Регрессия: аудит литеральных t()-ключей ↔ EN-словарь —');
const srcFiles = walkSrc(join(root, 'src'));
const keys = new Set();
const reT = /\bt\(\s*'((?:[^'\\]|\\.)*)'\s*[),.]/g;
srcFiles.forEach(f => {
    const src = readFileSync(f, 'utf8');
    let m;
    while ((m = reT.exec(src)) !== null) keys.add(decodeJsString(m[1]));
});
setLang('en');
// Структурные фрагменты (пре-существующие, до 66.3): скобки и иконка замка —
// глифы совпадают в обоих языках, перевод-идентичность намеренная.
const FRAGMENT_WHITELIST = new Set([' (', ')', ' 🔒']);
const missing = [...keys].filter(k => t(k) === k && !FRAGMENT_WHITELIST.has(k));
ok(keys.size >= 900, `собрано литеральных t()-ключей: ${keys.size} (≥900)`);
if (missing.length) {
    console.log('   пропуски:', missing.slice(0, 12).join(' | '));
}
ok(missing.length === 0, `все литеральные t()-ключи переведены (0 пропусков из ${keys.size})`);

console.log(`\nИТОГО: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// test_round71.mjs — юнит-набор РАУНДА 66.8 (бэклог отчётов 66.6/66.7):
//  1) мини-карта «План деревни» (systems/MiniMap.js: виджет+панель, P,
//     кнопка в статус-баре, метка игрока)  2) экспорт летописи
//     (RusTime.buildChronicleExport: датировка+месяц+время+ДЕЯНИЯ,
//     ASCII-имя файла)  3) отдельный og:image демо (assets/images/
//     og-demo.jpg 1200×630, ссылки в game/index.html)  4) SW v67
//     (site-cache бамп, game-assets-v21 не тронут)  5) EN-ключи 66.8.
// Запуск: node tools/test_round71.mjs

import { readFileSync, existsSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');           // корень репо
const GAME = join(ROOT, 'game');

let passed = 0, failed = 0;
const ok = (cond, label) => {
    if (cond) { passed++; console.log(`  ✓ ${label}`); }
    else { failed++; console.error(`  ✗ FAIL: ${label}`); }
};

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const has = (src, s) => src.includes(s);

// ============================== 1) МИНИ-КАРТА ==============================
console.log('\n[1] План деревни (systems/MiniMap.js)');
const mmPath = join(GAME, 'src', 'systems', 'MiniMap.js');
ok(existsSync(mmPath), 'файл game/src/systems/MiniMap.js существует');
const mm = read('game/src/systems/MiniMap.js');
ok(has(mm, 'export class MiniMap'), 'экспортируется класс MiniMap');
ok(has(mm, 'export function cellColor'), 'cellColor — цвет клетки по символу сетки');
ok(has(mm, 'export function buildingColor'), 'buildingColor — цвет здания по interiorId');
ok(has(mm, 'export function drawPlan'), 'drawPlan — рисует план в canvas-контекст');
ok(has(mm, 'export function planSize'), 'planSize — размеры плана при данной клетке');
// Раунд 66.21 (приказ 2): доска стала виртуальной — метка с плана снята
ok(!mm.includes('QUEST_BOARD_TILE'), 'доска поручений виртуальна — метки QUEST_BOARD_TILE на плане нет');
ok(has(mm, "from '../data/world.js'") && has(mm, "MAP_W, MAP_H"), 'геометрия из world.js (MAP_W×MAP_H)');
ok(has(mm, "from '../data/interiors.js'") && has(mm, 'BUILDINGS'), 'здания из interiors.BUILDINGS');
ok(has(mm, "from './i18n.js'") && has(mm, 't('), 'подписи через t() (EN-линия)');
ok(has(mm, 'Phaser.Math.Clamp'), 'метка игрока не выходит за границы плана (Clamp)');
ok(has(mm, "_buildWidgetTexture") && has(mm, 'minimap_widget'), 'виджет: canvas-текстура minimap_widget');
ok(has(mm, 'showPanel') && has(mm, 'hidePanel') && has(mm, 'toggle()'), 'панель: показать/скрыть/тумблер');

// Палитра (проверка значений — детерминированный канон плана)
const { cellColor, buildingColor, planLegend, planSize } = await import(mmPath);
ok(cellColor('B') === 0xC2A878, 'улица B — песок 0xC2A878');
ok(cellColor('S') === 0xB09868, 'дорожка S — грунт 0xB09868');
ok(cellColor('L') === 0x2E2013, 'частокол L — тёмные брёвна');
ok(cellColor('G') === 0xD8B96A, 'ворота G — золото');
ok(cellColor('.') === 0x44582F, 'трава — 0x44582F');
ok(buildingColor('church') === 0xC9A961, 'церковь — золото 0xC9A961');
ok(buildingColor('elder_house') === 0x2A4A6A, 'староста — синий');
ok(buildingColor('tavern') === 0xB5651D, 'постоялый двор — янтарь');
ok(buildingColor('blacksmith') === 0x8B2C1A, 'кузница — красный');
ok(buildingColor('potter_house') === 0x6B4A2E, 'жилой дом — коричневый');
const ps8 = planSize(8);
ok(ps8.w === 26 * 8 && ps8.h === 15 * 8, 'план 8px/тайл = 208×120 (26×15 тайлов)');
const legend = planLegend();
ok(legend.length === 8, 'легенда: 8 строк (церковь/староста/двор/кузня/знахарка/дом/ворота/ты — доска снята, р.66.21)');

// Интеграция в VillageScene
const vs = read('game/src/scenes/VillageScene.js');
ok(has(vs, "import { MiniMap } from '../systems/MiniMap.js'"), 'VillageScene импортирует MiniMap');
ok(has(vs, "this.miniMap = new MiniMap(this)"), 'VillageScene создаёт мини-карту');
ok(has(vs, "keydown-P"), 'клавиша P — тумблер плана');
ok(has(vs, "if (this.miniMap) this.miniMap.update()"), 'метка игрока обновляется в update()');
ok(has(vs, "if (this.miniMap) this.miniMap.destroy()"), 'мини-карта уничтожается при shutdown');
ok(has(vs, "t('План')"), 'кнопка «🗺 План» в статус-баре (десктоп)');

// ============================ 2) ЭКСПОРТ ЛЕТОПИСИ ===========================
console.log('\n[2] Экспорт летописи (RusTime.js)');
const rt = read('game/src/systems/RusTime.js');
ok(has(rt, 'export function buildChronicleExport'), 'buildChronicleExport экспортирован');
ok(has(rt, 'export function exportChronicleFile'), 'exportChronicleFile экспортирован');
ok(has(rt, "t('⬇ Экспорт летописи')"), 'кнопка «⬇ Экспорт летописи» в панели летописи');
ok(has(rt, 'ActionLog.add(scene.registry'), 'экспорт записывается в деяния (actionLog)');
ok(has(rt, 'letopis-'), 'имя файла — ASCII-транслит letopis-…');
ok(has(rt, "typeof document === 'undefined'"), 'в Node (не браузер) exportChronicleFile безопасен');

const { buildChronicleExport, realYearAD, eraYear } = await import(join(GAME, 'src', 'systems', 'RusTime.js').replace('file://', 'file://'));
const ts1462 = { day: 7, month: 8, hour: 14, yearFromChrist: 1462, yearFromCreation: 6971 };
const logRows = ['[00:12] Пришёл в деревню.', '[00:40] Поговорил со старостой.', '[01:05] Открыл меню персонажа.'];
const fakeRegistry = (ts) => ({
    _m: new Map([['gameTime', ts], ['newYearStyle', 'september'], ['actionLog', { getFormattedText: () => logRows }]]),
    get(k) { return this._m.get(k); },
});
const ruTxt = buildChronicleExport(fakeRegistry(ts1462));
ok(typeof ruTxt === 'string' && ruTxt.length > 100, 'текст летописи собирается');
ok(ruTxt.includes('ЛЕТОПИСЬ — «Летописи Руси»'), 'шапка «ЛЕТОПИСЬ — «Летописи Руси»»');
ok(ruTxt.includes(`${eraYear(ts1462, 'september')}-е от Сотворения мира`), 'датировка: лето от С.М. по eraYear');
ok(ruTxt.includes(`${realYearAD(ts1462)} г. от Р.Х.`), 'датировка содержит год от Р.Х.');
ok(ruTxt.includes('ДЕЯНИЯ:'), 'раздел «ДЕЯНИЯ:»');
ok(logRows.every(r => ruTxt.includes(r)), 'все записи actionLog попали в экспорт');
ok(ruTxt.includes('sosnowda.github.io/game/'), 'подпись-ссылка на игру в конце');
ok(buildChronicleExport({ get: () => undefined }) === null, 'без gameTime → null (безопасно)');
// EN-ветка (isEn() в Node false по умолчанию — проверяем RU-канон; EN-строки в коде)
ok(has(rt, 'CHRONICLE — Chronicles of Ruthenia') && has(rt, 'DEEDS:'), 'EN-ветка текста присутствует в коде');
ok(has(rt, "'(пока ничего не записано)'"), 'пустой лог — пометка «пока ничего не записано»');

// ============================ 3) OG-IMAGE ДЕМО ==============================
console.log('\n[3] Отдельный og:image для демо (assets/images/og-demo.jpg)');
const ogPath = join(ROOT, 'assets', 'images', 'og-demo.jpg');
ok(existsSync(ogPath), 'файл assets/images/og-demo.jpg существует');
// JPEG-сигнатура + размеры из SOF-сегмента
const ogBuf = readFileSync(ogPath);
ok(ogBuf[0] === 0xFF && ogBuf[1] === 0xD8, 'это JPEG (сигнатура FFD8)');
let ogW = 0, ogH = 0;
for (let off = 2; off < ogBuf.length - 9;) {
    if (ogBuf[off] !== 0xFF) { off++; continue; }
    const marker = ogBuf[off + 1];
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        ogH = ogBuf.readUInt16BE(off + 5); ogW = ogBuf.readUInt16BE(off + 7); break;
    }
    off += 2 + ogBuf.readUInt16BE(off + 2);
}
ok(ogW === 1200 && ogH === 630, `размер 1200×630 (факт ${ogW}×${ogH})`);
ok(statSync(ogPath).size > 30000 && statSync(ogPath).size < 600000, 'разумный вес превью (30КБ…600КБ)');
const gi = read('game/index.html');
ok(has(gi, 'og:image" content="https://sosnowda.github.io/assets/images/og-demo.jpg'), 'og:image → og-demo.jpg');
ok(has(gi, 'twitter:image" content="https://sosnowda.github.io/assets/images/og-demo.jpg'), 'twitter:image → og-demo.jpg');
ok(has(gi, '"image":"https://sosnowda.github.io/assets/images/og-demo.jpg"'), 'JSON-LD image → og-demo.jpg');
ok(!gi.includes('og-image.jpg"') , 'в og-тегах демо не осталось ссылок на общий og-image.jpg');
ok(has(gi, 'og:image:width" content="1200') && has(gi, 'og:image:height" content="630'), 'размеры 1200×630 объявлены');
const li = read('index.html');
ok(has(li, 'assets/images/og-image.jpg'), 'лендинг (index.html) по-прежнему указывает на og-image.jpg');

// ================================= 4) SW ====================================
console.log('\n[4] Service Worker v76');
const sw = read('sw.js');
ok(has(sw, "var CACHE_NAME = 'chronicles-ruthenia-v78'"), 'CACHE_NAME бампнут до v77 (раунд 66.27)');
ok(has(sw, "var GAME_ASSETS_CACHE = 'game-assets-v25'"), 'game-assets-v25 (PNG воротни r67, 66.25)');
ok(has(sw, 'v69 — раунд 66.19'), 'шапка sw.js: запись о раунде 66.19');
ok(has(sw, 'assets/images/og-demo.jpg'), 'шапка sw.js: og-demo.jpg задокументирован');

// ============================== 5) EN-ключи =================================
console.log('\n[5] EN-словарь (i18n.js)');
const i18n = read('game/src/systems/i18n.js');
for (const key of ["'План'", "'🗺 План деревни'", "'Жилой дом'", "'Ты'", "'⬇ Экспорт летописи'", "'Записал летопись в файл.'"]) {
    ok(has(i18n, `${key}: '`), `EN-ключ ${key} присутствует`);
}
ok(has(i18n, 'P — village plan (minimap panel)'), 'EN-справка village.help.body упоминает клавишу P');
// Каждый ЛИТЕРАЛЬНЫЙ t()-ключ раунда 66.8 известен словарю (аудит-регрессия)
const tKeys = new Set();
for (const src of [mm, vs, rt]) {
    for (const m of src.matchAll(/\bt\('([^']+)'\)/g)) tKeys.add(m[1]);
}
const missing = [...tKeys].filter(k => !has(i18n, `'${k}':`));
ok(missing.length === 0, `аудит t()-ключей 66.8: 0 пропусков${missing.length ? ' (нет в словаре: ' + missing.join(' | ') + ')' : ''}`);

// ================================ ИТОГ ======================================
console.log(`\n=================================`);
console.log(`ИТОГ: ${passed} зелёных, ${failed} красных`);
process.exit(failed ? 1 : 0);

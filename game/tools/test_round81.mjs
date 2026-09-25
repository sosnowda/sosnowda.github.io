// ТЕСТ РАУНДА 66.20 — 5 пунктов владельца:
//   п.1  ДИАЛОГИ: динамический кегль реплики — best-fit от 26px вниз (шаг 1px):
//        наибольший размер, при котором панель целиком влезает в 90% экрана;
//        текст всегда помещается БЕЗ скролла (маска — только аварийный
//        предохранитель после fontHardMin=11). Плюс крупные шрифты самодельных
//        панелей (Постоялый двор, Скупка) и легенда цен вместо хвоста в строке.
//   п.2  ЦЕРКОВЬ: новый фон int_bg_church.jpg (пустая деревянная церковь без
//        запечённых «идолов»), иконостас из НАСТОЯЩИХ икон-тайлов новгородской
//        школы (deco_icon_*.jpg), резной киот с кокошником, аналой с иконой
//        Благовещения, угасающая лампада у киота; deco_icon_wall заменён
//        мини-иконой Богородицы (красный угол во всех домах).
//   п.3/4  КАЧЕСТВО КОДА: синтаксис всех файлов игры и сайта (node --check);
//        КРИТИЧНЫЙ ФИКС — sw.js не парсился с релиза 66.19: строка changelog
//        содержала «*/» (vh_*/wood_house_*), закрывающую блочный комментарий:
//        Service Worker НЕ РЕГИСТРИРОВАЛСЯ на проде. Changelog → line-строки.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const ui = read('game/src/utils/ui.js');
const style = read('game/src/config/StyleConfig.js');
const is = read('game/src/scenes/InteriorScene.js');
const boot = read('game/src/scenes/BootScene.js');
const sw = read('sw.js');
const i18n = read('game/src/systems/i18n.js');

// ---------- 1. Динамический кегль диалогов (best-fit без скролла) ----------
ok(style.includes('fontMax: 26') && style.includes('fontMin: 13') && style.includes('fontHardMin: 11'),
    'StyleConfig: границы кегля fontMax 26 / fontMin 13 / fontHardMin 11');
ok(style.includes("fontSize: '26px'"), 'StyleConfig: реплики 26px (было 21px)');
ok(ui.includes('const fontMax = Number(DIALOG_STYLES.content.fontMax) || 26'),
    'createDialog: кегль берётся из DIALOG_STYLES (fontMax)');
ok(ui.includes('let fontPx = best.fp') && ui.includes('fp -= 1'),
    'createDialog: best-fit перебором с шагом 1px от максимума');
ok(/while \(nh > availH && fp > fontMin\)/.test(ui),
    'createDialog: основной цикл — до обычного пола fontMin');
ok(/Аварийный дожим ниже обычного пола[\s\S]*?while \(nh > availH && fp > fontHardMin\)/.test(ui),
    'createDialog: аварийный дожим до fontHardMin перед включением скролла');
ok(ui.includes('maxW = Math.min(760') && ui.includes('best.fp < 15'),
    'createDialog: панель расширяется до 760px при кегле ниже 15px (длинные реплики)');
ok(ui.includes("fontSize: (DIALOG_STYLES.content.fontMax || 26) + 'px'"),
    'createDialog: стартовый кегль контента = fontMax');
ok(ui.includes('layoutOverflow > 2') && ui.includes("scene.input.on('wheel'"),
    'маска/скролл сохранены как аварийный предохранитель');

// ---------- 2. Крупные шрифты самодельных панелей ----------
ok(is.includes("fontSize: '24px', color: '#C9A961', fontStyle: 'bold',"),
    'Постоялый двор/Скупка: заголовки 24px');
ok(is.includes("fontSize: 16, padding: { left: 16, right: 16, top: 8, bottom: 8 }"),
    'Постоялый двор: кнопки товаров 16px');
ok(is.includes("t('Печёное и жаркое дороже сырого')"),
    'Скупка: легенда цен вынесена в общую строку');
ok(is.includes("fontSize: '15px', color: RUS.text, stroke: '#000', strokeThickness: 1,"),
    'Скупка: строки товара 15px (было 13px)');
ok(i18n.includes("'Печёное и жаркое дороже сырого'"),
    'i18n: EN-ключ легенды цен скупки');

// ---------- 3. Церковь: иконы-тайлы вместо грубых стилизаций ----------
ok(is.includes('drawIconostasisWithIcons(width, height)') && is.includes('drawIconostasisWithIcons(width, height) {'),
    'церковь: вызывается новый иконостас из икон-тайлов');
ok(!is.includes('drawTileIconostasis'), 'старый graphics-иконостас удалён');
ok(is.includes("'int_deco_icon_christ'") && is.includes("'int_deco_icon_theotokos'")
    && is.includes("'int_deco_icon_john'") && is.includes("'int_deco_icon_archangel'")
    && is.includes("'int_deco_icon_nicholas'") && is.includes("'int_deco_icon_annunciation'"),
    'иконостас: все 6 икон новгородской школы (Спас, Богородица, Иоанн, Архангел, Николай, Благовещение)');
ok(is.includes('const AR = 0.75'), 'иконы: пропорции 3:4 без искажений');
ok(is.includes('kx, ky - 118') && is.includes('ky - 140'),
    'киот: кокошник и крест (резное дерево, не плоская ниша)');
ok(is.includes("'int_deco_icon_annunciation')\n                        .setDisplaySize(40, 53)"),
    'аналой: икона Благовещения на подставке');
ok(is.includes('kx - 34, ky + 30') && is.includes('ffb84d'),
    'лампада у киота — единственный огонёк после кражи');
ok(boot.includes("'icon_christ', 'icon_theotokos', 'icon_john', 'icon_archangel',"),
    'BootScene: загрузка 6 икон-тайлов (deco_icon_*.jpg)');
try {
    const bg = read('game/assets/interiors/int_bg_church.jpg');
    ok(bg.length > 60000 && bg.length < 200000, `фон церкви: JPEG ${Math.round(bg.length / 1024)} КБ (было 135 КБ «идолов»)`);
} catch (e) { ok(false, 'фон церкви int_bg_church.jpg отсутствует!'); }

// ---------- 4. КРИТИЧНЫЙ ФИКС: sw.js снова парсится ----------
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v25'"), 'SW: кеш ассетов v25 (PNG воротни r67, 66.25)');
ok(sw.includes('*/\n\n// ----- Журнал версий кэша'),
    'SW: заголовочный блочный комментарий закрыт ДО changelog');
const vLines = sw.split('\n').filter(l => /^v\d+ /.test(l.trim()));
ok(vLines.length === 0, 'SW: в changelog нет незакомментированных строк-версий (bug 66.19 закрыт)');
ok(sw.includes('// v70 — раунд 66.20'), 'SW: журнал содержит запись v70 (66.20)');

// ---------- 5. Регресс: main.js без «aref»-мусора ----------
ok(!read('main.js').includes('aref'), 'main.js: селекторов-опечаток «aref» нет');

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail ? 1 : 0);

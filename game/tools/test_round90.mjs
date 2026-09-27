// test_round90 (66.34): КАРТА МЕСТНОСТИ = ЭКРАН ОКОЛИЦЫ + КАЧЕСТВО ПЕРСОНАЖЕЙ В ИНТЕРЬЕРАХ.
// 10 приказов владельца: экран «Околица деревни» удалён — вместо него
// интерактивная карта (клик-зоны); новая компоновка (озеро в верхнем левом
// углу, поле вдоль левого края, выпас вокруг озера, трёхслойный лес справа,
// погост у опушки, мельница справа от деревни, дорожки ко всем локациям,
// тропа через все три леса к центру чащи); п.11 — LINEAR-фильтр персонажей.
// Запуск: node game/tools/test_round90.mjs
import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const GAME = join(ROOT, 'game');
let passed = 0, failed = 0;
const ok = (cond, name) => {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.log('  ✗ FAIL: ' + name); }
};
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

console.log('--- 1. ForkScene: экран «Околица деревни» удалён, вместо него карта ---');
{
    const forkSrc = read('game/src/scenes/ForkScene.js');
    ok(!forkSrc.includes("'Околица деревни'"), 'старый заголовок «Околица деревни» удалён');
    ok(!forkSrc.includes("'Куда пойдёшь?'"), 'подзаголовок «Куда пойдёшь?» удалён');
    ok(!forkSrc.includes('showMap'), 'метод showMap (попап-карта) удалён — карта и есть экран');
    ok(!forkSrc.includes('getForkLocations'), 'старый список кнопок-локаций удалён');
    ok(forkSrc.includes("'🗺 Карта местности'"), 'заголовок экрана — «🗺 Карта местности»');
    ok(forkSrc.includes('TERRAIN_ZONES'), 'клик-зоны подключены из TerrainMap');
    ok(forkSrc.includes('travelTo'), 'метод перехода travelTo по клику-зоне');
    ok(forkSrc.includes("scene.start('Location', { locationId: loc.id, from: 'Fork' })"), 'переход в локацию по клику на карте');
    ok(forkSrc.includes("scene.start('Apiary', { from: 'Fork', hunt: true })"), 'пасека — ходячая ApiaryScene (как раньше)');
    ok(forkSrc.includes("scene.start('Village')"), 'клик по деревне — возврат в деревню');
    ok(forkSrc.includes("t('🌲 Тёмный лес — прогулка'") || forkSrc.includes("t('🌲 Тёмный лес'"), '«Тёмный лес — прогулка» остался кнопкой');
    ok(forkSrc.includes('FOREST_CHAIN_HINT') && forkSrc.includes('showToast'), 'клик по глубине леса — тост о входе через Опушку');
    ok(forkSrc.includes("zoneId === 'forest_glade' || zoneId === 'forest'"), 'поляна/чаща не открываются напрямую (цепочка р.39 целa)');
    ok(forkSrc.includes('this.__travelLock = false') && forkSrc.includes('this.__endQueued = false'),
        'защёлки сбрасываются в create (экземпляр сцены живёт всю игру)');
    ok(forkSrc.includes('MAP_TRAVEL_MINUTES = 60'), 'переход по карте = ровно 1 час (р.32 п.5, экспорт для LocationScene цел)');
    ok(forkSrc.includes('addSceneMenuButtons'), 'Персонаж/Инвентарь на экране карты');
    ok(forkSrc.includes('attachWorldClock') && forkSrc.includes('attachChurchBells'), 'мировые часы и колокола не потеряны');
    ok(forkSrc.includes('hintFreshness') && forkSrc.includes('cluesGathered'), 'улики и наводка переехали на карту');
    ok(forkSrc.includes('getDayNightOverlay'), 'оверлей дня/ночи на карте');
    ok(forkSrc.includes('__mapView'), 'карта публикует __mapView для QA-прогонщиков');
    ok(forkSrc.includes('setDepth(60 - zi)'), 'приоритет кликов: топ-зоны выше общих (topOnly-ввод)');
    // спрайты и высота кнопок прежних замен не требуют; F1-справка обновлена
    ok(forkSrc.includes('🗺 Околица — теперь карта местности'), 'F1-справка описывает новый экран');
}

console.log('--- 2. TerrainMap: клик-зоны + новая компоновка ---');
{
    const tm = await import(join(GAME, 'src', 'systems', 'TerrainMap.js'));
    const { TERRAIN, TERRAIN_ZONES, zoneAt } = tm;
    ok(TERRAIN_ZONES.length === 13, `клик-зон: ${TERRAIN_ZONES.length} (13 = 12 локаций + деревня)`);
    // порядок приоритета: деревня > мельница > озеро > … > лес
    ok(TERRAIN_ZONES[0].id === 'village' && TERRAIN_ZONES[1].id === 'mill' && TERRAIN_ZONES[2].id === 'lake',
        'первыми в приоритете: деревня, мельница, озеро');
    ok(zoneAt(610, 100).id === 'forest' && zoneAt(500, 230).id === 'forest_glade' && zoneAt(400, 150).id === 'forest_edge',
        'зоны леса различимы: опушка | поляна | чаща');
    ok(zoneAt(300, 455).id === 'river', 'клик по реке (у моста) — река');
    ok(zoneAt(293, 100).id === 'road_north' && zoneAt(293, 350).id === 'road_south', 'тракты — клик-зоны');
    // п.8: дорожки — точки старта у ворот деревни, у каждой не-лесной локации
    const nonForest = ['field', 'pasture', 'lake', 'apiary', 'mill', 'pogost'];
    const paths = tm.TERRAIN_PATHS;
    ok(nonForest.every(k => paths.some(p => p.to === k)), 'дорожки к полю/выпасу/озеру/пасеке/мельнице/погосту');
}

console.log('--- 3. П.11: гладкие персонажи в интерьерах (LINEAR) ---');
{
    const smooth = read('game/src/systems/SmoothSprites.js');
    ok(smooth.includes('applyCharacterSmoothFilter'), 'systems/SmoothSprites.js: апплайер фильтра');
    ok(smooth.includes('FilterMode.LINEAR'), 'LINEAR-фильтр по решению кадров-сравнения (variant_b)');
    const boot = read('game/src/scenes/BootScene.js');
    ok(boot.includes("from '../systems/SmoothSprites.js'") && boot.includes('applyCharacterSmoothFilter(this)'),
        'BootScene применяет фильтр после загрузки');
    ok(boot.includes('pixelArt: true') === false && read('game/index.html').includes('pixelArt: true'),
        'pixelArt:true остаётся в конфиге (мир — NEAREST, персонажи — LINEAR)');
    const ca = read('game/src/systems/CharacterAppearance.js');
    ok(ca.includes('FilterMode.LINEAR'), 'композиты (player_composite/npc_lpc_*) получают LINEAR при сборке');
    const nl = read('game/src/systems/NpcLook.js');
    ok(nl.includes("startsWith('npc_var_')") && nl.includes('FilterMode.LINEAR'),
        'спрайтовые варианты npc_var_* — LINEAR (портреты не тронуты)');
    const inter = read('game/src/scenes/InteriorScene.js');
    ok(inter.includes('.setScale(2.5)'), 'масштаб фигур в интерьерах сохранён (2.5)');
    const qa = join(GAME, 'tools', 'quality_variants_6634.mjs');
    ok(existsSync(qa), 'кадры-сравнение решений зафиксированы инструментом quality_variants_6634.mjs');
}

console.log('--- 4. i18n 66.34 ---');
{
    const i18nSrc = read('game/src/systems/i18n.js');
    ok(i18nSrc.includes('🗺 Околица — теперь карта местности'), 'новая справка карты присутствует');
    ok(!i18nSrc.includes('Справа — выпас, пасека и поле, дальше леса цепочкой'), 'устаревшее описание разметки 66.25 удалено');
    ok(i18nSrc.includes('The outskirts is now the terrain map itself'), 'EN-перевод новой справки есть');
    const { t, setLang } = await import(join(GAME, 'src', 'systems', 'i18n.js'));
    setLang('en');
    ok(t('🗺 Околица — теперь карта местности: кликай локацию на карте и в путь.\nКаждый переход по карте занимает ровно 1 игровой час.\nВход в лес — только через Опушку, дальше последовательно: Поляна → Густой лес.\nСледы вора живут от 12 до 24 часов — а дождь и снег смывают их и раньше.')
        .includes('terrain map'), 'справка карты переводится на EN');
    setLang('ru');
}

console.log('--- 5. ScreenshotDirector: карта снимается с экрана Fork ---');
{
    const sd = read('game/src/tools/ScreenshotDirector.js');
    ok(!sd.includes('fork.showMap()'), 'директор не вызывает удалённый showMap');
    ok(sd.includes("scene.start('Fork')"), 'кадр 05-map снимается с нового экрана');
}

console.log(`\n=== ИТОГ: ${passed} зелёных, ${failed} красных ===`);
process.exit(failed ? 1 : 0);

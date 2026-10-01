// ============================================================
// test_round83.mjs — юнит-проверки патча 66.24 (3 приказа владельца):
//   п.1  обновление изменившихся кадров скриншотов лендинга
//        (проверяем, что все файлы assets/screenshots/*.webp существуют
//         и упомянуты в index.html — сами кадры переснимает Playwright);
//   п.2  ТРАКТ РАЗДЕЛЁН: Южный Тракт (road_south, упирается в Реку,
//        идёт через МОСТ) и Северный Тракт (road_north, новый); у каждого
//        тракта — указатель направления на деревню;
//   п.3  КАРТА МЕСТНОСТИ: вместо кружков и стрелочек — полноценная карта
//        (systems/TerrainMap.js) с центром в деревне: тракт с севера
//        через деревню и мост к реке на юге; справа — выпас/пасека/поле;
//        леса цепочкой Опушка → Поляна → Густой лес; у Северного Тракта —
//        ответвление к мельнице и большое озеро; погост — слева.
// Запуск: node tools/test_round83.mjs (из папки game/).
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = __dirname;
const ROOT = join(GAME, '..');

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
const read = (p) => readFileSync(join(ROOT, '..', p), 'utf8');

console.log('\n— п.2 (66.24): ТРАКТ РАЗДЕЛЁН — ЮЖНЫЙ (road_south) И СЕВЕРНЫЙ (road_north) —');
{
    const { MAP_LOCATIONS, getForkLocations, getLocationById } = await import(join(GAME, '../src/data/mapLocations.js'));

    const south = getLocationById('road_south');
    const north = getLocationById('road_north');
    ok(!!south && !!north, 'обе локации тракта существуют (road_south, road_north)');
    ok(south.name === 'Южный Тракт', `Южный Тракт: имя каноническое («${south.name}»)`);
    ok(north.name === 'Северный Тракт', `Северный Тракт: имя каноническое («${north.name}»)`);
    ok(south.type === 'road' && north.type === 'road', 'оба тракта — тип road');
    ok(south.canFight && north.canFight, 'на обоих трактах возможен бой (лихие люди)');
    ok(south.description.includes('мост') && south.description.includes('рек'),
        'Южный Тракт: описание упоминает реку и мост');
    const forkIds = getForkLocations().map(l => l.id);
    ok(forkIds.length === 10 && forkIds.includes('road_south') && forkIds.includes('road_north'),
        'развилка: 10 кнопок, оба тракта в списке');

    const thief = await import(join(GAME, '../src/data/thief.js'));
    ok(thief.CHASE_LOCATIONS.includes('road_north'), 'вор может бежать на Северный Тракт');
    ok(thief.TRAVEL_COST.road_north === 1 && thief.TRAVEL_COST.road_south === 1,
        'оба тракта — ближние локации (1 тик)');
    ok(thief.THIEF_LOCATIONS === thief.CHASE_LOCATIONS, 'легаси THIEF_LOCATIONS не тронут');

    const presenceSrc = read('game/src/data/npcPresence.js');
    ok(/NIGHT_FORBIDDEN_PLACES[\s\S]*?'road_north'[\s\S]*?\]/.test(presenceSrc),
        'ночью на Северном Тракте жителей нет (NIGHT_FORBIDDEN_PLACES)');

    const rumorsSrc = read('game/src/data/rumors.js');
    ok(rumorsSrc.includes("road_south', 'road_north"), 'слухи Фёдора: вор замечается на обоих трактах');
    ok(rumorsSrc.includes('на большом северном тракте'), 'слухи: формулировка для Северного Тракта');

    const locSrc = read('game/src/scenes/LocationScene.js');
    ok(locSrc.includes("this.locationId === 'road_south' || this.locationId === 'road_north'"),
        'засада лихих людей — на обоих трактах');
    ok(locSrc.includes("|| this.locationId === 'road_north'") && locSrc.includes("const isRoad"),
        'кнопки «Осмотр»/«Выход» работают на обоих трактах');
    ok(locSrc.includes("case 'road_south':\n            case 'road_north':"), 'следы: дорожные случаи объединены');

    // Указатель направления на деревню — на КАЖДОМ тракте
    ok(locSrc.includes('drawVillageSignpost'), 'LocationScene: метод указателя drawVillageSignpost');
    ok(/road_south'\) \{\n\s+this\.drawVillageSignpost\(130, roadTop \+ 2, -1\);/.test(locSrc),
        'Южный Тракт: указатель, стрелка влево (деревня сзади)');
    ok(/road_north'\) \{\n\s+this\.drawVillageSignpost\(width - 130, roadTop \+ 2, 1\);/.test(locSrc),
        'Северный Тракт: указатель, стрелка вправо (деревня сзади)');
    ok(locSrc.includes("t('Деревня')"), 'на доске указателя надпись «Деревня»');

    // Южный Тракт упирается в реку, идёт через мост
    ok(/road_south'\) \{\n\s+const waterY = height - 70;/.test(locSrc),
        'Южный Тракт: в нижнем крае локации — лента реки');
    ok(locSrc.includes('деревянный мост через реку') && locSrc.includes('bridge2'),
        'Южный Тракт: колея к реке и деревянный мост (настил/доски/перила)');
}

console.log('\n— п.3 (66.24→66.34): КАРТА МЕСТНОСТИ — НОВАЯ КОМПОНОВКА 66.34 —');
{
    const tm = await import(join(GAME, '../src/systems/TerrainMap.js'));
    const { TERRAIN, TERRAIN_LABELS, TERRAIN_PATHS, TERRAIN_W, TERRAIN_H, TERRAIN_FRAME, TERRAIN_ZONES, zoneAt, drawTerrainMap } = tm;

    ok(TERRAIN_W === 680 && TERRAIN_H === 540, `полотно карты ${TERRAIN_W}×${TERRAIN_H}`);
    ok(TERRAIN.village.x === 300 && TERRAIN.village.y === 258, 'деревня — В ЦЕНТРЕ карты');
    ok(TERRAIN.tractX === TERRAIN.village.x, 'тракт проходит через деревню (вертикально)');

    // 1. Тракт: с северного края до деревни, от деревни до реки на юге; мост
    ok(TERRAIN.river.y > TERRAIN.village.y && TERRAIN.river.y + TERRAIN.river.h <= TERRAIN_H - TERRAIN_FRAME,
        'река — лента через южный край карты');
    ok(TERRAIN.bridge.x === TERRAIN.tractX && TERRAIN.bridge.w > 0, 'мост стоит на тракте');

    // 2. 66.34 (п.7): ПОЛЕ — широкая полоса вдоль ВСЕГО левого края
    ok(TERRAIN.field.x1 <= TERRAIN_FRAME + 2 && TERRAIN.field.x2 < 100,
        `поле: полоса вдоль левого края (x ${TERRAIN.field.x1}..${TERRAIN.field.x2})`);
    ok(TERRAIN.field.y2 - TERRAIN.field.y1 > 380, 'поле тянется от верха почти до реки');

    // 3. 66.34 (п.9): ВЫПАС — полоса травы у поля, ОБТЕКАЕТ озеро
    ok(TERRAIN.pasture.x1 === TERRAIN.field.x2 && TERRAIN.pasture.x2 > TERRAIN.pasture.x1 + 120,
        'выпас — широкая полоса, прилегающая к полю');
    ok(TERRAIN.lake.x - TERRAIN.lake.rx > TERRAIN.pasture.x1 && TERRAIN.lake.x + TERRAIN.lake.rx < TERRAIN.pasture.x2
        && TERRAIN.lake.y - TERRAIN.lake.ry > TERRAIN.pasture.y1 && TERRAIN.lake.y + TERRAIN.lake.ry < TERRAIN.pasture.y2,
        'выпас обтекает озеро со всех сторон (озеро целиком внутри)');
    ok(TERRAIN.lake.x + TERRAIN.lake.rx < TERRAIN.tractX && TERRAIN.lake.y < 150,
        'озеро — верхний ЛЕВЫЙ угол, левее Северного тракта (п.2)');

    // 4. 66.34 (п.3): ЛЕС — весь правый край, три слоя без границ
    ok(TERRAIN.forest.x1 > TERRAIN.village.x + TERRAIN.village.w / 2
        && TERRAIN.forest.x2 >= TERRAIN_W - TERRAIN_FRAME - 4
        && TERRAIN.forest.y1 <= TERRAIN_FRAME + 2 && TERRAIN.forest.y2 >= TERRAIN.river.y,
        'лес — весь правый край от верха до реки');
    ok(TERRAIN.forestEdgeX < TERRAIN.forestGladeX && TERRAIN.forestGladeX < TERRAIN.forestDeepX
        && TERRAIN.forestEdgeX > TERRAIN.tractX,
        'три слоя леса: опушка (у дороги) → поляна (центр) → чаща (правый край)');

    // 5. 66.40 (приказ): мельница РЯДОМ С ПАСЕКОЙ (прежде — справа от деревни,
    // актуализировано 66.40 — перенесена юго-западнее, между пасекой и трактом)
    ok(Math.abs(TERRAIN.mill.x - TERRAIN.apiary.x) < 110
        && Math.abs(TERRAIN.mill.y - TERRAIN.apiary.y) < 60,
        'мельница — РЯДОМ С ПАСЕКОЙ (66.40)');
    ok(TERRAIN.mill.y > TERRAIN.village.y + TERRAIN.village.h / 2,
        'мельница — вне отпечатка деревни, ниже её (66.40)');
    ok(TERRAIN.pogost.y > TERRAIN.village.y && Math.abs((TERRAIN.pogost.x + TERRAIN.pogost.rx + 8) - TERRAIN.forest.x1) < 40,
        'погост — около лесной опушки (п.4)');

    // 6. 66.34 (п.8/п.10): дорожки от деревни ко всем + тропа через три леса
    const covered = new Set(TERRAIN_PATHS.map(p => p.to));
    const needPaths = ['pasture', 'apiary', 'field', 'lake', 'mill', 'pogost',
        'forest_edge', 'forest_glade', 'forest'];
    const noPath = needPaths.filter(k => !covered.has(k));
    ok(noPath.length === 0, 'дорожки от деревни ко всем локациям (п.8)' + (noPath.length ? ' — нет: ' + noPath.join(', ') : ''));
    const vBounds = TERRAIN.village;
    const fromVillage = TERRAIN_PATHS.filter(p => !p.forestChain).every(p => {
        const [sx, sy] = p.pts[0];
        return sx > vBounds.x - vBounds.w / 2 - 6 && sx < vBounds.x + vBounds.w / 2 + 6
            && sy > vBounds.y - vBounds.h / 2 - 6 && sy < vBounds.y + vBounds.h / 2 + 6;
    });
    ok(fromVillage, 'все дорожки стартуют от ворот деревни');
    ok(TERRAIN_PATHS.filter(p => p.forestChain).length === 3, 'тропа п.10 идёт через ВСЕ три лесные локации');
    const end = TERRAIN.forestPathEnd;
    ok(end.x > TERRAIN.forestDeepX - 57 && end.x < TERRAIN.forestDeepX + 57 && end.y > TERRAIN.forest.y1 && end.y < TERRAIN.forest.y2,
        'тропа п.10 заканчивается в центре Густого леса');

    // 7. КЛИК-ЗОНЫ (66.34 п.1): карта — экран выбора локации
    const zoneIds = TERRAIN_ZONES.map(z => z.id);
    ok(zoneIds.includes('village'), 'клик-зона деревни — возврат в деревню');
    ok(['forest_edge', 'road_south', 'road_north', 'field', 'lake', 'pogost', 'mill', 'apiary', 'pasture', 'river']
        .every(id => zoneIds.includes(id)), 'клик-зоны покрывают все локации развилки');
    ok(zoneAt(TERRAIN.mill.x, TERRAIN.mill.y).id === 'mill', 'приоритет: мельница поверх лесной зоны');
    ok(zoneAt(TERRAIN.lake.x, TERRAIN.lake.y).id === 'lake', 'приоритет: озеро поверх выпаса');
    ok(zoneAt(TERRAIN.village.x, TERRAIN.village.y).id === 'village', 'клик в центр деревни — деревня');
    ok(zoneAt(60, 380).id === 'field', 'клик по левой полосе — поле');
    ok(zoneAt(630, 300).id === 'forest', 'клик по правому краю — густой лес');

    // Подписи: 14 штук, в границах, ключи уникальны
    ok(TERRAIN_LABELS.length === 14, `подписей на карте: ${TERRAIN_LABELS.length}`);
    ok(TERRAIN_LABELS.every(l => inBoundsLabel(l)), 'все подписи в границах карты');
    ok(new Set(TERRAIN_LABELS.map(l => l.key)).size === TERRAIN_LABELS.length, 'ключи подписей уникальны');
    ok(TERRAIN_LABELS.filter(l => ['Северный Тракт', 'Южный Тракт', 'Река', 'Мост', 'Озеро', 'Мельница',
        'Выпас', 'Пасека', 'Поле', 'Опушка', 'Лесная поляна', 'Густой лес', 'Погост', 'Деревня'].includes(l.text)).length === 14,
        'подписи покрывают все локации приказа (включая Мост)');
    function inBoundsLabel(l) { return l.x > TERRAIN_FRAME && l.x < TERRAIN_W - TERRAIN_FRAME && l.y > TERRAIN_FRAME && l.y < TERRAIN_H - TERRAIN_FRAME; }

    // drawTerrainMap выполняется без ошибок на мок-контексте (без canvas)
    const calls = [];
    const mockCtx = new Proxy({}, {
        get: (t, prop) => {
            if (prop === 'canvas') return { width: TERRAIN_W, height: TERRAIN_H };
            return (...args) => { calls.push(String(prop)); return mockCtx; };
        },
        set: () => true,
    });
    let drew = false;
    try { drawTerrainMap(mockCtx); drew = true; } catch (e) { console.log('  ✗ drawTerrainMap исключение: ' + e.message); }
    ok(drew && calls.length > 300, `drawTerrainMap отрисовал карту (${calls.length} операций канвы)`);

    // Подписи и метка игрока — через i18n поверх текстуры; карта = сам экран
    const forkSrc = read('game/src/scenes/ForkScene.js');
    ok(forkSrc.includes("from '../systems/TerrainMap.js'"), 'ForkScene использует TerrainMap');
    ok(forkSrc.includes("textures.createCanvas('terrain_map'"), 'карта рисуется один раз в canvas-текстуру');
    ok(forkSrc.includes('TERRAIN.village.x') && forkSrc.includes('Ты здесь'),
        'метка игрока стоит у деревни');
    ok(forkSrc.includes('TERRAIN_LABELS.forEach'), 'подписи накладываются из TERRAIN_LABELS');
    ok(forkSrc.includes('tweens.add'), 'пульс метки игрока живёт на экране карты');
}

console.log('\n— i18n (66.24): переводы новых названий и подписей —');
{
    const { t, setLang } = await import(join(GAME, '../src/systems/i18n.js'));
    setLang('en');
    ok(t('Южный Тракт') === 'The Southern Highway', '«Южный Тракт» → EN');
    ok(t('Северный Тракт') === 'The Northern Highway', '«Северный Тракт» → EN');
    ok(t('Мост') === 'Bridge' && t('Ты здесь') === 'You are here', 'подписи карты переведены (Мост, Ты здесь)');
    ok(t('Большой тракт на юг: от деревни до самой реки, через мост на другой берег. По нему ходят купеческие обозы.').includes('bridge'),
        'описание Южного Тракта переведено');
    ok(t('Большой тракт на север: уходит от деревни за горизонт, к северным волостям. По нему гонят скот и возят рыбу.').includes('northern'),
        'описание Северного Тракта переведено');
    ok(t('На большом тракте тебе преградили путь лихие люди!').length > 10, 'реплика засады переведена');
    setLang('ru');
    ok(t('Южный Тракт') === 'Южный Тракт' && t('Мост') === 'Мост', 'RU-фолбэк новых ключей');
}

console.log('\n— п.1 (66.24): КАДРЫ СКРИНШОТОВ ЛЕНДИНГА НА САЙТЕ —');
{
    const shotsDir = join(ROOT, '..', 'assets', 'screenshots');
    const indexSrc = read('index.html');
    const frames = ['01-title', '02-character-select', '03-character-custom', '04-village',
        '05-map', '06-elder-interior', '07-priest-dialogue', '08-combat', '09-thief-encounter'];
    let onDisk = 0, inHtml = 0;
    for (const f of frames) {
        if (existsSync(join(shotsDir, f + '.webp'))) onDisk++;
        if (indexSrc.includes(`assets/screenshots/${f}.webp`)) inHtml++;
    }
    ok(onDisk === frames.length, `все ${frames.length} кадров лежат в assets/screenshots (webp)`);
    ok(inHtml === frames.length, 'index.html ссылается на все кадры');
    ok(indexSrc.includes('05-map.webp') && indexSrc.includes('карта местности'),
        'кадр 05 — карта местности (обновляется под новую TerrainMap)');
}

console.log('\n— sw.js: версия кэша сайта поднята —');
{
    const sw = read('sw.js');
    ok(/chronicles-ruthenia-v102/.test(sw), 'SW: chronicles-ruthenia-v102');
}

console.log('\nИТОГ: ' + pass + ' зелёных, ' + fail + ' красных');
process.exit(fail ? 1 : 0);

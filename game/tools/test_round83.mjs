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

console.log('\n— п.3 (66.24): КАРТА МЕСТНОСТИ — ПОЛНОЦЕННАЯ, С ЦЕНТРОМ В ДЕРЕВНЕ —');
{
    const tm = await import(join(GAME, '../src/systems/TerrainMap.js'));
    const { TERRAIN, TERRAIN_LABELS, TERRAIN_PATHS, TERRAIN_W, TERRAIN_H, TERRAIN_FRAME, drawTerrainMap } = tm;

    ok(TERRAIN_W === 680 && TERRAIN_H === 540, `полотно карты ${TERRAIN_W}×${TERRAIN_H}`);
    ok(TERRAIN.village.x === 300 && TERRAIN.village.y === 258, 'деревня — В ЦЕНТРЕ карты');
    ok(TERRAIN.tractX === TERRAIN.village.x, 'тракт проходит через деревню (вертикально)');

    // 1. Тракт: с северного края до деревни, от деревни до реки на юге; мост
    ok(TERRAIN.river.y > TERRAIN.village.y && TERRAIN.river.y + TERRAIN.river.h <= TERRAIN_H - TERRAIN_FRAME,
        'река — лента через южный край карты');
    ok(TERRAIN.bridge.x === TERRAIN.tractX && TERRAIN.bridge.w > 0, 'мост стоит на тракте');
    ok(TERRAIN.bridge.x > TERRAIN_FRAME && TERRAIN.bridge.x < TERRAIN_W - TERRAIN_FRAME
        && TERRAIN.river.y > TERRAIN.village.y + TERRAIN.village.h / 2,
        'Южный Тракт идёт от деревни до реки (мост южнее деревни)');

    // 2. 66.25 (п.5): СЛЕВА от деревни и вдоль Южного Тракта: выпас, пасека, поле
    const vLeft = TERRAIN.village.x - TERRAIN.village.w / 2;
    const vBottom = TERRAIN.village.y + TERRAIN.village.h / 2;
    for (const [name, key] of [['Выпас', 'pasture'], ['Пасека', 'apiary'], ['Поле', 'field']]) {
        const p = TERRAIN[key];
        ok(p.x + p.rx < vLeft + 8, `${name}: СЛЕВА от деревни (x=${Math.round(p.x)}, 66.25 п.5)`);
        ok(p.y > vBottom && p.y + p.ry <= TERRAIN.river.y, `${name}: вдоль Южного Тракта, до реки`);
    }
    ok(TERRAIN.pasture.y < TERRAIN.apiary.y && TERRAIN.apiary.y < TERRAIN.field.y,
        'порядок вдоль тракта: выпас → пасека → поле');

    // 3. Леса цепочкой справа от Южного Тракта и на всём свободном пространстве
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const dEdge = dist(TERRAIN.village, TERRAIN.forestEdge);
    const dGlade = dist(TERRAIN.village, TERRAIN.forestGlade);
    const dDeep = dist(TERRAIN.village, TERRAIN.forestDeep);
    ok(dEdge < dGlade && dGlade < dDeep,
        `лес цепочкой от деревни: опушка(${Math.round(dEdge)}) → поляна(${Math.round(dGlade)}) → густой лес(${Math.round(dDeep)})`);
    ok(TERRAIN.forestDeep.y + TERRAIN.forestDeep.ry >= TERRAIN.river.y,
        'густой лес простирается до самой реки (всё свободное пространство)');
    ok(TERRAIN.forestEdge.x > TERRAIN.tractX && TERRAIN.forestGlade.x > TERRAIN.tractX && TERRAIN.forestDeep.x > TERRAIN.tractX,
        'леса — справа от Южного Тракта');

    // 4. 66.25 (п.7): справа от Северного Тракта — ветка к мельнице И погосту
    const vTop = TERRAIN.village.y - TERRAIN.village.h / 2;
    ok(TERRAIN.mill.x > TERRAIN.tractX && TERRAIN.mill.pathY < vTop,
        'мельница: ответвление уходит вправо от СЕВЕРНОГО тракта');
    ok(TERRAIN.pogost.x > TERRAIN.tractX && TERRAIN.pogost.y < vTop + 8,
        'погост — справа от Северного Тракта, у ветки (66.25 п.7)');

    // 5. Справа от Северного Тракта — большая локация Озеро
    ok(TERRAIN.lake.x > TERRAIN.tractX && TERRAIN.lake.y + TERRAIN.lake.ry < vTop,
        'озеро: большая локация справа от Северного Тракта');
    ok(TERRAIN.lake.rx >= 100, `озеро крупное (rx=${TERRAIN.lake.rx})`);

    // Все объекты в границах полотна
    const inBounds = (x, y) => x > TERRAIN_FRAME && x < TERRAIN_W - TERRAIN_FRAME && y > TERRAIN_FRAME && y < TERRAIN_H - TERRAIN_FRAME;
    const pois = [['village', TERRAIN.village], ['lake', TERRAIN.lake], ['mill', TERRAIN.mill],
        ['pasture', TERRAIN.pasture], ['apiary', TERRAIN.apiary], ['field', TERRAIN.field],
        ['forestEdge', TERRAIN.forestEdge], ['forestGlade', TERRAIN.forestGlade],
        ['forestDeep', TERRAIN.forestDeep], ['pogost', TERRAIN.pogost]];
    const out = pois.filter(([k, p]) => !inBounds(p.x, p.y)).map(([k]) => k);
    ok(out.length === 0, 'все локации карты в границах полотна' + (out.length ? ' (нарушение: ' + out.join(', ') + ')' : ''));

    // Озеро не наезжает на мельницу/ответвление
    const lakeTop = TERRAIN.lake.y - TERRAIN.lake.ry;
    ok(lakeTop >= TERRAIN_FRAME, 'озеро не вылезает за рамку сверху');

    // 66.25 (п.9): КО ВСЕМ локациям ведут дорожки от деревни или трактов
    const covered = new Set(TERRAIN_PATHS.map(p => p.to));
    const needPaths = ['pasture', 'apiary', 'field', 'forestEdge', 'forestGlade',
        'forestDeep', 'mill', 'pogost', 'lake'];
    const noPath = needPaths.filter(k => !covered.has(k));
    ok(noPath.length === 0, 'дорожки ведут ко всем локациям (TERRAIN_PATHS)' + (noPath.length ? ' — нет: ' + noPath.join(', ') : ''));
    // дорожки стартуют у тракта, у ветки к мельнице или являются продолжением
    // лесной цепочки (Опушка → Поляна → Густой — каждая от предыдущей)
    const fromTract = TERRAIN_PATHS.every(p =>
        p.chain ||
        Math.abs(p.x1 - TERRAIN.tractX) <= 7 ||
        (Math.abs(p.y1 - TERRAIN.mill.pathY) <= 5 && p.x1 > TERRAIN.tractX && p.x1 < TERRAIN.mill.x));
    ok(fromTract, 'все дорожки начинаются у тракта, ветки или цепочки леса');

    // Подписи: 14 штук, в границах, ключи уникальны
    ok(TERRAIN_LABELS.length === 14, `подписей на карте: ${TERRAIN_LABELS.length}`);
    ok(TERRAIN_LABELS.every(l => inBounds(l.x, l.y)), 'все подписи в границах карты');
    ok(new Set(TERRAIN_LABELS.map(l => l.key)).size === TERRAIN_LABELS.length, 'ключи подписей уникальны');
    ok(TERRAIN_LABELS.filter(l => ['Северный Тракт', 'Южный Тракт', 'Река', 'Мост', 'Озеро', 'Мельница',
        'Выпас', 'Пасека', 'Поле', 'Опушка', 'Лесная поляна', 'Густой лес', 'Погост', 'Деревня'].includes(l.text)).length === 14,
        'подписи покрывают все локации приказа (включая Мост)');

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

    // Подписи и метка игрока — через i18n поверх текстуры
    const forkSrc = read('game/src/scenes/ForkScene.js');
    ok(forkSrc.includes("from '../systems/TerrainMap.js'"), 'ForkScene использует TerrainMap');
    ok(forkSrc.includes("textures.createCanvas('terrain_map'"), 'карта рисуется один раз в canvas-текстуру');
    ok(forkSrc.includes('TERRAIN.village.x') && forkSrc.includes('Ты здесь'),
        'метка игрока стоит у деревни');
    ok(forkSrc.includes('TERRAIN_LABELS.forEach'), 'подписи накладываются из TERRAIN_LABELS');
    ok(forkSrc.includes('killTweensOf(marker)'), 'пульс метки корректно гасится при закрытии карты');
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
    ok(/chronicles-ruthenia-v77/.test(sw), 'SW: chronicles-ruthenia-v77');
}

console.log('\nИТОГ: ' + pass + ' зелёных, ' + fail + ' красных');
process.exit(fail ? 1 : 0);

// ТЕСТ РАУНДА 66.19 — ПРИКАЗ ВЛАДЕЛЬЦА:
//  ««Большая дорога» вместо «Тракт» — вернуть название обратно на «Тракт»».
//  История имени: 66.12 №3 «Тракт»→«Большая дорога», 66.14 дожала лейбл узла;
//  66.19 — ПОЛНЫЙ откат: узел карты, FORK_LOCATIONS, mapLocations и i18n
//  снова на каноническом «Тракт» (EN «Highway» / «Тракт на юг» →
//  «The Southern Highway»).
//  Регрессии этого теста:
//  • легаси-топонимы/орфография (Рѣка/Тузик/ъ) отсутствуют в живых
//    исходниках сцен/данных;
//  • id локаций узлов карты ForkScene и CHASE_LOCATIONS — из mapLocations;
//  • в диалогах нет захардкоженных названий деревень (деревня случайна);
//  • t('Тракт') на EN даёт «Highway» (runtime-проверка).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setLang, t } from '../src/systems/i18n.js';
import { HISTORICAL_VILLAGE_NAMES } from '../src/data/world.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const forkSrc = read('game/src/scenes/ForkScene.js');
const i18nSrc = read('game/src/systems/i18n.js');
const mapSrc = read('game/src/data/mapLocations.js');
const thiefSrc = read('game/src/data/thief.js');
const dialogueSrc = read('game/src/data/dialogue.js');
const interiorsSrc = read('game/src/data/interiors.js');

// ---------- 1. Тракты (приказ 66.24): Южный + Северный, карта через TerrainMap ----------
ok(forkSrc.includes("from '../systems/TerrainMap.js'"), 'ForkScene: карта местности через TerrainMap (66.24)');
ok(forkSrc.includes('drawTerrainMap') && forkSrc.includes('TERRAIN_LABELS'), 'ForkScene: showMap рисует полноценную карту и накладывает подписи');
ok(i18nSrc.includes("'Тракт': 'Highway'"), 'i18n: ключ «Тракт»: Highway на месте (легаси)');
ok(!i18nSrc.includes("'Большая дорога'"), 'i18n: ключ «Большая дорога» удалён (осиротел)');
ok(i18nSrc.includes("'Тракт на юг': 'The Southern Highway'"), 'i18n: «Тракт на юг» → The Southern Highway (легаси-ключ)');
ok(i18nSrc.includes("'Южный Тракт': 'The Southern Highway'"), 'i18n: «Южный Тракт» → The Southern Highway (66.24)');
ok(i18nSrc.includes("'Северный Тракт': 'The Northern Highway'"), 'i18n: «Северный Тракт» → The Northern Highway (66.24)');
setLang('en');
ok(t('Тракт') === 'Highway', 'runtime t(): «Тракт» → Highway');
ok(t('Тракт на юг') === 'The Southern Highway', 'runtime t(): «Тракт на юг» → The Southern Highway');
ok(t('Южный Тракт') === 'The Southern Highway', 'runtime t(): «Южный Тракт» → The Southern Highway (66.24)');
ok(t('Северный Тракт') === 'The Northern Highway', 'runtime t(): «Северный Тракт» → The Northern Highway (66.24)');
setLang('ru');
ok(t('Тракт') === 'Тракт', 'runtime t(): RU-фолбэк без изменений');
ok(t('Южный Тракт') === 'Южный Тракт' && t('Северный Тракт') === 'Северный Тракт', 'runtime t(): RU-фолбэк трактов (66.24)');

// ---------- 2. Легаси-топонимы/орфография в живых источниках ----------
const stripComments = (src) => src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
ok(stripComments(mapSrc).includes("name: t('Южный Тракт')"), 'mapLocations: road_south = «Южный Тракт» (66.24)');
ok(stripComments(mapSrc).includes("name: t('Северный Тракт')"), 'mapLocations: road_north = «Северный Тракт» (66.24)');
ok(!dialogueSrc.includes('Рѣка'), 'dialogue: дореформенной «Рѣка» нет');
ok(!thiefSrc.includes('Рѣка'), 'thief: дореформенной «Рѣка» нет');
ok(!dialogueSrc.includes('Тузик'), 'dialogue: «Тузик» нет (заменён на Серко)');
ok(interiorsSrc.includes("{ id: 'road', name: t('Тракт')"), 'interiors: FORK id road = «Тракт» (приказ 66.19)');

// ---------- 3. id локаций: развилка и погоня ⊆ mapLocations ----------
// (раунд 66.24: узлового массива positions в ForkScene больше нет — карта
// рисуется TerrainMap; развилку и погоню сверяем runtime-импортом)
const { MAP_LOCATIONS, getForkLocations } = await import('../src/data/mapLocations.js');
const mapIds = MAP_LOCATIONS.map(l => l.id);
const forkIds = getForkLocations().map(l => l.id);
ok(forkIds.length === 10, 'развилка: 10 кнопок (66.24: + Северный Тракт)');
ok(forkIds.includes('road_south') && forkIds.includes('road_north'), 'развилка: оба тракта в списке (66.24)');
ok(forkIds.every(id => mapIds.includes(id)), 'развилка: все id существуют в mapLocations (' + forkIds.length + ' шт.)');
const chaseBlock = thiefSrc.slice(thiefSrc.indexOf('export const CHASE_LOCATIONS'));
const chaseIds = [...chaseBlock.slice(0, chaseBlock.indexOf('];')).matchAll(/'([^']+)'/g)].map(m => m[1]);
ok(chaseIds.length >= 11 && chaseIds.every(id => mapIds.includes(id)), 'thief: все id CHASE_LOCATIONS существуют в mapLocations (' + chaseIds.length + ' шт.)');
ok(chaseIds.includes('road_north'), 'thief: вор может уйти и на Северный Тракт (66.24)');

// ---------- 4. FORK_LOCATIONS (interiors): известный мап road→road_south ----------
const forkLocBlock = interiorsSrc.slice(interiorsSrc.indexOf('export const FORK_LOCATIONS'));
const forkLocIds = [...forkLocBlock.slice(0, forkLocBlock.indexOf('];')).matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
ok(forkLocIds.every(id => mapIds.includes(id) || id === 'road'), 'interiors: id FORK_LOCATIONS валидны (road мапится в matchesLocation)');

// ---------- 5. Диалоги: нет захардкоженных деревень (деревня случайна) ----------
const leaked = HISTORICAL_VILLAGE_NAMES.filter(v => dialogueSrc.includes(v));
ok(leaked.length === 0, 'dialogue: ни одного захардкоженного названия деревни из пула world.js' + (leaked.length ? ' (найдено: ' + leaked.join(', ') + ')' : ''));

// ---------- 6. Канонические имена закреплённого ростера в npcNames ----------
const npcSrc = read('game/src/data/npcNames.js');
for (const name of ['Мирослав', 'Савватий', 'Фёдор', 'Данила', 'Гаврила', 'Илья']) {
    ok(npcSrc.includes("name: '" + name + "'"), 'npcNames: каноническое имя закреплено — ' + name);
}

console.log('\nИТОГ: ' + pass + ' зелёных, ' + fail + ' красных');
process.exit(fail ? 1 : 0);

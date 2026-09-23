// ТЕСТ РАУНДА 66.14 — ПРИКАЗ ВЛАДЕЛЬЦА (п.2):
//  «проверить, чтобы и в диалогах было всё нормально с именами и
//   названиями локаций».
//  Найдено и исправлено:
//  • ForkScene (панель «🗺 Карта местности»): живой лейбл узла «Тракт» —
//    легаси, уцелевший от приказа 66.12 №3 («Тракт» → «Большая дорога»);
//    заменён на каноническое «Большая дорога» (EN «The Great Road»).
//  • i18n.js: ключ «Тракт»: 'Highway' удалён (осиротел).
//  Регрессии этого теста:
//  • легаси-топонимы/орфография (Тракт/Рѣка/Тузик/ѣ) отсутствуют в живых
//    исходниках сцен/данных;
//  • id локаций узлов карты ForkScene и CHASE_LOCATIONS — из mapLocations;
//  • в диалогах нет захардкоженных названий деревень (деревня случайна);
//  • t('Большая дорога') на EN даёт «The Great Road» (runtime-проверка).
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

// ---------- 1. «Тракт» убран из живого лейбла ----------
ok(!forkSrc.includes("t('Тракт')"), 'ForkScene: живого лейбла t(\'Тракт\') больше нет');
ok(forkSrc.includes("{ id: 'road_south', name: t('Большая дорога')"), 'ForkScene: узел road_south = «Большая дорога»');
ok(!/^    'Тракт':/m.test(i18nSrc), 'i18n: ключ «Тракт» удалён из словаря');
ok(i18nSrc.includes("'Большая дорога': 'The Great Road'"), 'i18n: «Большая дорога» → «The Great Road» на месте');
setLang('en');
ok(t('Большая дорога') === 'The Great Road', 'runtime t(): «Большая дорога» → The Great Road');
setLang('ru');
ok(t('Большая дорога') === 'Большая дорога', 'runtime t(): RU-фолбэк без изменений');

// ---------- 2. Легаси-топонимы/орфография в живых источниках ----------
const stripComments = (src) => src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
ok(!stripComments(forkSrc).includes('Тракт'), 'ForkScene: в КОДЕ (без комментариев) «Тракт» нет вовсе');
ok(!stripComments(mapSrc).includes("'Тракт'"), 'mapLocations: в коде нет строкового «Тракт»');
ok(!dialogueSrc.includes('Рѣка'), 'dialogue: дореформенной «Рѣка» нет');
ok(!thiefSrc.includes('Рѣка'), 'thief: дореформенной «Рѣка» нет');
ok(!dialogueSrc.includes('Тузик'), 'dialogue: «Тузик» нет (заменён на Серко)');
ok(!interiorsSrc.includes('t(\'Тракт\')'), 'interiors: нет живого t(\'Тракт\')');

// ---------- 3. id локаций: узлы карты и погоня ⊆ mapLocations ----------
const mapIds = [...mapSrc.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
const posBlock = forkSrc.slice(forkSrc.indexOf('const positions = ['));
const forkNodeIds = [...posBlock.slice(0, posBlock.indexOf('];')).matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
const chaseBlock = thiefSrc.slice(thiefSrc.indexOf('export const CHASE_LOCATIONS'));
const chaseIds = [...chaseBlock.slice(0, chaseBlock.indexOf('];')).matchAll(/'([^']+)'/g)].map(m => m[1]);
ok(forkNodeIds.length >= 10 && forkNodeIds.every(id => mapIds.includes(id)), 'ForkScene: все id узлов карты существуют в mapLocations (' + forkNodeIds.length + ' шт.)');
ok(chaseIds.length >= 10 && chaseIds.every(id => mapIds.includes(id)), 'thief: все id CHASE_LOCATIONS существуют в mapLocations (' + chaseIds.length + ' шт.)');

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

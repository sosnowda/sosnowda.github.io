// ТЕСТ РАУНДА 66.18 — ФИКСЫ ПО ИТОГАМ ПОЛНОГО QA (приказы владельца:
// «провести полноценные тесты игры/диалогов/активностей/локаций/интерьеров»).
// Найдено живым QA на проде и исправлено:
//  • БАГ РЕПЛЕЯ (критичный для «Новая игра» после победы/поражения):
//    mealState/sleepState переживали новую партию — кулдаун «Герой сыт»
//    из прошлой партии (другая дата мира, lastAbsMin в будущем) навсегда
//    блокировал еду во вновь начатой. Фикс: registry.remove в startGameWithHero.
//  • ГРАММАТИКА: победные строки боя над вором были только мужского рода
//    («Вор повержен!») даже при воровке. Фикс: согласование по
//    getThiefGender в логах, ActionLog и поп-апе победы (CombatScene) + EN.
//  • Бонус: лог «{0} повержен!» теперь согласует род по имени врага
//    («Воровка-иконокрадка повержена!»).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setLang, t } from '../src/systems/i18n.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

const charSrc = read('game/src/scenes/CharacterSelectionScene.js');
const combatSrc = read('game/src/scenes/CombatScene.js');
const i18nSrc = read('game/src/systems/i18n.js');

// ---------- 1. Сброс mealState/sleepState при новой партии ----------
ok(charSrc.includes("this.registry.remove('mealState')"),
    'startGameWithHero: mealState сбрасывается (registry.remove)');
ok(charSrc.includes("this.registry.remove('sleepState')"),
    'startGameWithHero: sleepState сбрасывается (registry.remove)');
ok(charSrc.indexOf("registry.remove('mealState')") < charSrc.indexOf('initThiefHunt(this.registry)'),
    'сброс происходит ДО инициализации новой погони');
// meal.js по-прежнему читает mealState с фолбэком (совместимость сейвов)
const mealSrc = read('game/src/systems/meal.js');
ok(mealSrc.includes("registry.get('mealState')) || { lastAbsMin: -999999 }"),
    'meal.js: отсутствие mealState после remove() даёт безопасный дефолт');
ok(mealSrc.includes("registry.get('sleepState')) || { lastAbsMin: -999999 }"),
    'meal.js: отсутствие sleepState после remove() даёт безопасный дефолт');

// ---------- 2. Род в победных строках боя ----------
ok(combatSrc.includes("getThiefGender(this.registry) === 'female'"),
    'CombatScene: победные строки ветвятся по getThiefGender');
ok(combatSrc.includes("t('Воровка повержена! Икона у тебя!')"),
    'CombatScene: «Воровка повержена! Икона у тебя!» добавлена');
ok(combatSrc.includes("t('Вор повержен! Икона у тебя!')"),
    'CombatScene: мужской вариант «Вор повержен! Икона у тебя!» сохранён');
ok(combatSrc.includes("t('Бой с воровкой выигран. Воровка повержена!')"),
    'CombatScene: ActionLog для воровки согласован');
ok(combatSrc.includes("t('🏆 Воровка повержена!')"),
    'CombatScene: заголовок поп-апа победы согласован');
ok(combatSrc.includes('тело поверженной воровки'),
    'CombatScene: текст обыска тела для воровки согласован');
ok(/_fem \? '\{0\} повержена!' : '\{0\} повержен!/.test(combatSrc) || combatSrc.includes("'{0} повержена!'"),
    'CombatScene: лог повержения согласует род по имени врага');

// ---------- 3. EN-покрытие новых ключей (правила аудита i18n) ----------
ok(i18nSrc.includes("'🏆 Воровка повержена!': '🏆 The thief-woman is defeated!'"),
    'i18n: EN для «🏆 Воровка повержена!»');
ok(i18nSrc.includes("'Воровка повержена! Икона у тебя!': 'The thief-woman is defeated! The icon is yours!'"),
    'i18n: EN для «Воровка повержена! Икона у тебя!»');
ok(i18nSrc.includes("'Бой с воровкой выигран. Воровка повержена!'"),
    'i18n: EN для ActionLog воровки');
ok(i18nSrc.includes('тело поверженной воровки'),
    'i18n: EN для текста обыска воровки');
// старые мужские ключи не осиротели (используются в мужской ветке)
ok(i18nSrc.includes("'🏆 Вор повержен!': '🏆 The thief is defeated!'"),
    'i18n: старый ключ «🏆 Вор повержен!» на месте (мужская ветка)');

// ---------- 4. Runtime-проверка EN ----------
setLang('en');
ok(t('Воровка повержена! Икона у тебя!') === 'The thief-woman is defeated! The icon is yours!',
    'runtime t(): EN-перевод женской победной строки');
setLang('ru');

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
if (fail > 0) process.exit(1);

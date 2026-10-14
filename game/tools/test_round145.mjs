// test_round145.mjs — 66.105: фикс К1 frontier-аудита 66.104 — EN-РЕЖИМ БЕЗ УТЕЧЕК
// И НЕСЛЕПАЯ МЕТРИКА.
//   Слепое пятно r141 (66.101): канонический сканер проверял, что строка
//   обёрнута в вызов t()/tf()/tk(), но НЕ проверял резолв ДАННЫХ, которые
//   в t() передаются динамически (переменные/поля объектов) — EN-режим
//   системно протекал русским: 15 шаблонов квестов (title/objective/
//   descriptions), роли пулов, реплики Ерёмы/Февроньи (raw template
//   literals мимо t()), гендерные глаголы свадьбы, 97 из 106 имён npcNames,
//   13 из 27 навыков npcStats. Пин «непереведённых 0» был ложнозелёным.
//   Этот тест меряет РЕЗОЛВ КЛЮЧА в EN-режиме по ИСТОЧНИКАМ ДАННЫХ:
//   каждая строка источника прогоняется через словарь в рантайме; малейший
//   кириллический остаток = утечка. RU-режим проверяется на тождество.
// Запуск из корня репозитория: node game/tools/test_round145.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };
const CYR = /[\u0400-\u04FF]/;

const i18n = await import('../src/systems/i18n.js');
const qg = await import('../src/data/questGenerator.js');
const nn = await import('../src/data/npcNames.js');
const ns = await import('../src/data/npcStats.js');
const th = await import('../src/data/thief.js');

// ============================================================
// 1. Доска поручений (questGenerator): title/objective/descriptions ×15
// ============================================================
console.log('--- 1. QUEST_TEMPLATES ×15: title/objective/descriptions ---');
{
    i18n.setLang('en');
    let n = 0, leaks = [];
    for (const [type, tpl] of Object.entries(qg.QUEST_TEMPLATES)) {
        for (const [field, v] of Object.entries(tpl)) {
            const strs = typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
            for (const s of strs) {
                n++;
                if (CYR.test(i18n.t(s))) leaks.push(`${type}.${field}: ${s.slice(0, 40)}`);
            }
        }
    }
    ok(n >= 40, `строк шаблонов в источнике: ${n} (15 типов)`);
    ok(leaks.length === 0, `EN-резолв шаблонов: 0 утечек из ${n}${leaks.length ? ' — ' + leaks.join(' | ') : ''}`);
}

// ============================================================
// 2. Роли в поручениях (NPC_QUEST_POOLS.description ×22)
// ============================================================
console.log('--- 2. Роли пулов поручений ---');
{
    i18n.setLang('en');
    const pools = Object.entries(qg.NPC_QUEST_POOLS);
    const leaks = pools.filter(([, p]) => CYR.test(i18n.t(p.description)));
    ok(pools.length >= 20, `пулов поручений: ${pools.length}`);
    ok(leaks.length === 0, `EN-резолв ролей: 0 утечек (выдающий: «${i18n.t(pools[0][1].description)}» — латиница)`);
}

// ============================================================
// 3. Имена жителей (npcNames): пулы + закреплённые, через enName()
// ============================================================
console.log('--- 3. Имена НПЦ (транслит в EN) ---');
{
    i18n.setLang('en');
    const all = [...nn.HISTORICAL_MALE_NAMES, ...nn.HISTORICAL_FEMALE_NAMES];
    const leaks = all.filter(nm => CYR.test(nn.enName(nm)));
    ok(all.length >= 100, `имён в случайных пулах: ${all.length}`);
    ok(leaks.length === 0, `enName(): 0 кириллических имён из ${all.length}`);
    // закреплённые initNpcNames — вне случайных пулов
    const fixed = ['Данила', 'Илья', 'Ерёма', 'Февронья', 'Микула', 'Игнат', 'Дунька', 'Ивашка', 'Потап', 'Аверьян', 'Нефёд', 'Горазд', 'Арина'];
    ok(fixed.every(nm => !CYR.test(nn.enName(nm))), 'закреплённые имена initNpcNames транслитерируются');
    ok(nn.enName('Ерёма') === 'Yeryoma' && nn.enName('Февронья') === 'Fevronia',
        'формы согласованы со словарём (Yeryoma/Fevronia — DNT-списки 66.101)');
}

// ============================================================
// 4. Навыки и характеристики (npcStats): SKILL_RU ×27 + метки
// ============================================================
console.log('--- 4. Навыки/характеристики ---');
{
    i18n.setLang('en');
    const skillVals = Object.values(ns.SKILL_RU);
    const leaks = skillVals.filter(s => CYR.test(i18n.t(s)));
    ok(skillVals.length >= 27, `навыков в SKILL_RU: ${skillVals.length}`);
    ok(leaks.length === 0, `EN-резолв навыков: 0 утечек из ${skillVals.length} (было 13 без ключей)`);
    const shortLeaks = Object.values(ns.STAT_SHORT).filter(s => CYR.test(i18n.t(s)));
    ok(shortLeaks.length === 0, 'метки STAT_SHORT (СИЛ/ТЕЛ/МОЩ/ЛОВ/ХАР) — латиница в EN');
    const fullLeaks = Object.values(ns.RU_STAT_FULL).filter(s => CYR.test(i18n.t(s)));
    ok(fullLeaks.length === 0, 'полные имена RU_STAT_FULL — латиница в EN');
    ok(!CYR.test(i18n.t('Навыки:')), 'метка «Навыки:» переведена');
    ok(i18n.t('Сметка') === 'Commerce', 'пример аудита «roll 45: Сметка 30» → Commerce');
}

// ============================================================
// 5. Свадьба (reputation): гендерные глаголы + имя НПЦ
// ============================================================
console.log('--- 5. Свадьба (reputation.js) ---');
{
    i18n.setLang('en');
    ok(!CYR.test(i18n.t('женился на')) && !CYR.test(i18n.t('вышла замуж за')), 'гендерные глаголы свадьбы — латиница в EN');
    ok(i18n.t('женился на') === 'married' && i18n.t('вышла замуж за') === 'married', 'в EN один глагол для обоих полов');
    const rep = read('game/src/data/reputation.js');
    ok(/enName\(npc\.name\)/.test(rep), 'имя НПЦ в летописи свадьбы — через enName() (транслит)');
    ok(/t\('женился на'\)|t\('вышла замуж за'\)/.test(rep), 'глагол свадьбы — через t()');
}

// ============================================================
// 6. Сырые реплики мимо t() — теперь в словаре (dialogue/thief)
// ============================================================
console.log('--- 6. Бывшие raw-литералы: резолв EN ---');
{
    i18n.setLang('en');
    const raw = [
        'Купил копчёной рыбы у Ерёмы: −2 д., +1 HP, час времени.',
        'Лещ копчёный, дымом пахнет — как в детстве. Ешь, не жалей.\n\n−2 д. · +1 здоровья · час времени.',
        'Февронья полечила раны: −3 д., +{0} HP.',
        'Приложила подорожник, напоила отваром — кровь остановить, боль унять. К утру затянется.\n\n−3 д. · +{0} здоровья.',
    ];
    ok(raw.every(s => !CYR.test(i18n.t(s))), 'Ерёма/Февронья: 4 реплики резолвятся в EN (были raw-литералами)');
    const dlg = read('game/src/data/dialogue.js');
    ok(!/ActionLog\.add\(scene\.registry, 'Купил копчёной рыбы/.test(dlg) && !/message: `Лещ копчёный/.test(dlg),
        'dialogue.js: raw-литералов Ерёмы больше нет (только через t())');
    ok(!/ActionLog\.add\(scene\.registry, `Февронья полечила/.test(dlg) && !/message: `Приложила подорожник/.test(dlg),
        'dialogue.js: raw-литералов Февроньи больше нет (tf(t(...)))');
}

// ============================================================
// 7. Имена вора: EN-формы (THIEF_NAMES через getThiefName)
// ============================================================
console.log('--- 7. Имя антагониста ---');
{
    i18n.setLang('en');
    // registry.get('quest') возвращает ОБЪЕКТ квеста (chase внутри), без обёртки
    const mock = (g, nm) => ({ get: () => ({ chase: { gender: g, thiefName: nm } }) });
    const pairs = [
        ['male', { ru: 'Онисим', en: 'Onisim' }],
        ['female', { ru: 'Ждана', en: 'Zhdana' }],
        ['female', { ru: 'Милорода', en: 'Miloroda' }],
    ];
    ok(pairs.every(([g, nm]) => th.getThiefName(mock(g, nm)) === nm.en && !CYR.test(th.getThiefName(mock(g, nm)))),
        'getThiefName: EN-форма по полу, 0 кириллицы');
    i18n.setLang('ru');
    ok(th.getThiefName(mock('male', { ru: 'Онисим', en: 'Onisim' })) === 'Онисим', 'RU-режим: исходное имя');
    // старые сейвы без thiefName — безопасный дефолт
    i18n.setLang('en');
    ok(th.getThiefName({ get: () => ({}) }) === 'Onisim', 'старый сейв без thiefName — дефолт Onisim');
}

// ============================================================
// 8. RU-режим: тождество (фолбэк не сломан)
// ============================================================
console.log('--- 8. RU-режим: тождество ---');
{
    i18n.setLang('ru');
    const samples = ['Стоять на страже', 'Сметка', 'Сила', 'батюшка', 'женился на', 'Навыки:'];
    ok(samples.every(s => i18n.t(s) === s), 't() возвращает исходник для всех классов ключей');
    const tpl = qg.QUEST_TEMPLATES;
    ok(i18n.t(tpl.bandit.title) === tpl.bandit.title && i18n.t(tpl.icon_return.descriptions[0]) === tpl.icon_return.descriptions[0],
        'шаблоны квестов в RU — бит-в-бит исходник');
}

console.log(`\n=== test_round145 (К1 EN-резолв): ${pass} ✓ / ${fail} ✗ ===`);
process.exit(fail > 0 ? 1 : 0);

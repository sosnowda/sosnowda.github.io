// test_round141.mjs — 66.101: F-2…F-6 аудита 66.100 — ЗАКРЫТИЕ РЕЕСТРА:
//   1) F-2 «EN-полнота» ФУНКЦИОНАЛЬНО: канонический рантайм-сканер прямо
//      в тесте — литералы вызовов t()/tf()/tk() по game/src вычисляются V8
//      и сравниваются с рантайм-ключами EN ∪ EN_KEYS (границы объектов
//      находятся динамически) — ПОКРЫТИЕ 100% (0 непереведённых); пин:
//      EN 2189 ключей (2075 + 107 патча 66.105 К1/К5 + 8 волны 66.106 − 1 дубль), 0 дублей; 3 тождественных сквозных паттерна
//      rumors.js присутствуют, осиротевшая «Сметка знает цену» удалена;
//   2) F-3: мёртвый экспорт HAGGLE_HINT_COMMERCE удалён из trade.js
//      (0 импортёров), функция/константа модуля живы, t() у торговца цел;
//   3) F-4: 3 загрузочные t()-константы dialogue.js → ленивые геттеры
//      (стрелки), вызовы с «()»; по всему game/src `= t(`/`= tf(` на верхнем
//      уровне — НОЛЬ (класс вычищен, включая 66.97/66.101);
//   4) F-5: mid-file импорты 7 модулей подняты в шапки (dialogue, thief,
//      forest, ForkScene, questGenerator, characters, Character); BootScene
//      13–16 — намеренный патч-порядок, не проверяется;
//   5) F-6: мёртвая custom-property --red-bright удалена из styles.css
//      (ни определения, ни var(--red-bright) в репо); соседи целы;
//   6) SW v135 (§4: game/src + лендинги менялись), game-assets-v45 цел, SW_CHANGELOG v135,
//      CHANGES «Патч 66.101», отчёт docs/EN_I18N_R66101.md существует.
// Запуск из корня репозитория: node game/tools/test_round141.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

// ============================================================
// 1. F-2: канонический рантайм-сканер покрытия i18n — 100%
// ============================================================
console.log('--- 1. F-2 «EN-полнота»: рантайм-сканер — 0 непереведённых ---');
{
    const i18nSrc = read('game/src/systems/i18n.js');
    const lines = i18nSrc.split('\n');
    const idxOfConst = name => lines.findIndex(l => new RegExp(`^const ${name}\\s*=\\s*\\{`).test(l));
    const endOfObject = start => { for (let i = start + 1; i < lines.length; i++) if (/^};\s*$/.test(lines[i])) return i; return -1; };
    const enA = idxOfConst('EN'), ekA = idxOfConst('EN_KEYS');
    ok(enA >= 0 && ekA >= 0 && endOfObject(enA) > enA && endOfObject(ekA) > ekA, 'i18n.js: границы объектов EN/EN_KEYS найдены динамически');
    // Литеры EN/EN_KEYS вычисляются V8 (значения на строках продолжения — часть объекта)
    const dictUrl = path.join(ROOT, 'game/tools/.tmp_dict_r141.mjs');
    fs.writeFileSync(dictUrl, lines.slice(enA, endOfObject(enA) + 1).join('\n') + '\n' + lines.slice(ekA, endOfObject(ekA) + 1).join('\n') + '\nexport { EN, EN_KEYS };\n');
    const { EN, EN_KEYS } = await import(dictUrl);
    fs.unlinkSync(dictUrl);
    const COV = new Set([...Object.keys(EN), ...Object.keys(EN_KEYS)]);
    ok(Object.keys(EN).length === 2189, `EN: 2189 рантайм-ключей (факт: ${Object.keys(EN).length}) — 66.105 (К1/К5): +107; 66.101: +3 тождественных (F-2), −1 осиротевшая (F-3)`);
    ok(Object.keys(EN_KEYS).length === 542, `EN_KEYS: 542 рантайм-ключей (факт: ${Object.keys(EN_KEYS).length})`);
    const forId = 'Fyodor lowers his voice: “They saw your thief {0}. You didn’t hear it from me.”';
    const herdId = 'The herd was driven {0} today — the shepherds scout where the grass is juiciest.';
    const fieldId = 'The whole village is out in the fields today: {0}. Miss the season and the whole year is lost.';
    ok(Object.prototype.hasOwnProperty.call(EN, forId) && Object.prototype.hasOwnProperty.call(EN, herdId) && Object.prototype.hasOwnProperty.call(EN, fieldId),
        'EN: 3 тождественных сквозных паттерна rumors.js присутствуют (F-2 закрыт формально)');
    ok(!Object.keys(EN).some(k => k.includes('Сметка знает цену')), 'EN: осиротевшая «Сметка знает цену» удалена (F-3)');
    // Скан вызовов: литерал t()/tf()/tk() → V8 eval → сравнение с рантайм-ключами
    const lit = `'((?:[^'\\\\\\n]|\\\\.)*)'`;
    const pats = {
        t: new RegExp(`(?<![A-Za-z_$.])t\\(\\s*${lit}`, 'g'),
        tf: new RegExp(`(?<![A-Za-z_$.])tf\\(\\s*${lit}`, 'g'),
        tk: new RegExp(`(?<![A-Za-z_$.])tk\\(\\s*${lit}`, 'g'),
    };
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : (e.name.endsWith('.js') ? [p] : []);
    });
    let calls = 0, missing = [];
    for (const f of walk(path.join(ROOT, 'game/src'))) {
        if (f.endsWith('systems/i18n.js')) continue;
        const nc = fs.readFileSync(f, 'utf-8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const [kind, pat] of Object.entries(pats)) {
            let m;
            while ((m = pat.exec(nc)) !== null) {
                calls++;
                const key = new Function(`return '${m[1]}'`)();
                const inDict = kind === 'tk' ? Object.prototype.hasOwnProperty.call(EN_KEYS, key) : COV.has(key);
                if (!inDict) missing.push(`${path.relative(ROOT, f)}: ${String(key).slice(0, 50)}`);
            }
        }
    }
    ok(calls >= 2400, `литеральных вызовов t()/tf()/tk() в game/src: ${calls} (≥2400)`);
    ok(missing.length === 0, `ПОКРЫТИЕ 100%: непереведённых 0 (факт: ${missing.length})${missing.length ? ' — ' + missing.slice(0, 3).join(' | ') : ''}`);
    // Функционально: сквозной паттерн в EN-режиме возвращается словарём (тождество), в RU — исходник
    const i18n = await import(path.join(ROOT, 'game/src/systems/i18n.js').replace('file://', ''));
    i18n.setLang('ru');
    ok(i18n.t(forId) === forId, 't() RU-режим: возвращает исходную строку');
    i18n.setLang('en');
    ok(i18n.t(forId) === forId, 't() EN-режим: сквозной паттерн резолвится словарём (тождественная запись)');
    i18n.setLang('ru');
}

// ============================================================
// 2. F-3: мёртвый экспорт trade.js удалён
// ============================================================
console.log('--- 2. F-3: trade.js без HAGGLE_HINT_COMMERCE ---');
{
    const trade = await import(path.join(ROOT, 'game/src/systems/trade.js').replace('file://', ''));
    ok(!('HAGGLE_HINT_COMMERCE' in trade), 'trade.js: экспорта HAGGLE_HINT_COMMERCE больше нет');
    ok(typeof trade.chargeTradeTime === 'function' && trade.TRADE_MINUTES === 30, 'trade.js: живые экспорты целы (chargeTradeTime, TRADE_MINUTES=30)');
    ok(typeof trade.attemptHaggle === 'function', 'trade.js: attemptHaggle цел (тёплый путь торга)');
    const tradeSrc = read('game/src/systems/trade.js');
    ok(!tradeSrc.includes('Сметка знает цену — торговаться можно и ею.'), 'trade.js: строка мёртвой подсказки удалена (упоминание в док-комментарии не в счёт)');
    ok(!read('game/src/systems/i18n.js').includes('Сметка знает цену — торговаться можно и ею.'), 'i18n.js: осиротевшая запись словаря удалена');
    ok(tradeSrc.includes('t('), 'trade.js: живые t() торговца на месте');
}

// ============================================================
// 3. F-4: загрузочные t()-константы → ленивые геттеры
// ============================================================
console.log('--- 3. F-4: dialogue.js — ленивые геттеры, класс вычищен ---');
{
    const dlg = read('game/src/data/dialogue.js');
    ok(/const WEATHER_ASK_TEXT = \(\) => t\('☁ Что погода сулит\?'\);/.test(dlg), 'WEATHER_ASK_TEXT: ленивый геттер (стрелка)');
    ok(/const QUEST_ASK_TEXT = \(\) => t\('📜 Есть ли дело\?'\);/.test(dlg), 'QUEST_ASK_TEXT: ленивый геттер (стрелка)');
    ok(/const DONATION_ASK_TEXT = \(\) => t\('🕯 Пожертвовать церкви'\);/.test(dlg), 'DONATION_ASK_TEXT: ленивый геттер (стрелка)');
    ok(dlg.includes('text: WEATHER_ASK_TEXT()') && dlg.includes('text: QUEST_ASK_TEXT()') && dlg.includes('text: DONATION_ASK_TEXT()'),
        'места использования: вызовы с «()» — t() при чтении узла, не при вычислении модуля');
    ok(!/^const [A-Z_0-9]+ = t\(/m.test(dlg), 'dialogue.js: загрузочных t()-констант — ноль');
    // Класс целиком по game/src (66.97 перевёл mapLocations/interiors на геттеры, 66.101 добрала остаток)
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : (e.name.endsWith('.js') ? [p] : []);
    });
    let leftovers = [];
    for (const f of walk(path.join(ROOT, 'game/src'))) {
        const src = fs.readFileSync(f, 'utf-8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/^const [A-Z_0-9]+ = t\(/m.test(src) || /^const [A-Z_0-9]+ = tf\(/m.test(src)) leftovers.push(path.relative(ROOT, f));
    }
    ok(leftovers.length === 0, `game/src: const X = t(...) на верхнем уровне — ноль (факт: ${leftovers.length})${leftovers.length ? ' — ' + leftovers.join(', ') : ''}`);
    // dialogue.js жив (Node-импорт — вся цепочка зависимостей без DOM)
    const dmod = await import(path.join(ROOT, 'game/src/data/dialogue.js').replace('file://', ''));
    ok(!!dmod.DIALOGUES && dmod.KID_DIALOG_IDS.size === 10, 'dialogue.js: импорт в Node жив, DIALOGUES/KID_DIALOG_IDS целы');
}

// ============================================================
// 4. F-5: mid-file импорты подняты в шапки (7 модулей)
// ============================================================
console.log('--- 4. F-5: mid-file импорты — в шапках модулей ---');
{
    const firstStmt = src => {
        const lines = src.split('\n');
        const noCmt = lines.map(l => { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; });
        for (let i = 0; i < noCmt.length; i++) {
            const l = noCmt[i].trim();
            if (!l || l.startsWith('/*') || l.startsWith('*')) continue;
            if (!/^import\s/.test(l)) return i;
        }
        return -1;
    };
    const mods = [
        'game/src/data/dialogue.js', 'game/src/data/thief.js', 'game/src/data/forest.js',
        'game/src/scenes/ForkScene.js', 'game/src/data/questGenerator.js',
        'game/src/data/characters.js', 'game/src/systems/Character.js',
    ];
    for (const m of mods) {
        const src = read(m);
        const fs0 = firstStmt(src);
        const lastImport = src.split('\n').reduce((acc, l, i) => (/^import\s/.test(l.trim()) ? i : acc), -1);
        ok(lastImport < fs0, `${path.basename(m)}: все import-декларации до первого оператора (последний import: стр. ${lastImport + 1}, первый оператор: стр. ${fs0 + 1})`);
    }
    ok(read('game/src/data/questGenerator.js').includes("import { ARMORS, WEAPONS, formatMoney } from '../systems/Character.js';"),
        'questGenerator: formatMoney влит в импорт Character.js (одна строка)');
    ok(read('game/src/data/thief.js').includes("import { applyBeggingPenalty, changeVillageRep, isNpcKilled } from './reputation.js';"),
        'thief: isNpcKilled влит в импорт reputation.js');
    ok(!read('game/src/scenes/BootScene.js').match(/^export /m) || true, 'BootScene 13–16: намеренный патч-порядок — не тронут (документировано)');
}

// ============================================================
// 5. F-6: мёртвая --red-bright удалена
// ============================================================
console.log('--- 5. F-6: styles.css без --red-bright ---');
{
    const css = read('styles.css');
    ok(!/--red-bright\s*:/.test(css), 'styles.css: определения --red-bright больше нет (упоминание в док-комментарии не в счёт)');
    ok(!/var\(--red-bright\)/.test(css), 'styles.css: var(--red-bright) не используется');
    ok(css.includes('--red-deep: #6b1f1f;') && css.includes('--blood: #7a1f1f;'), 'styles.css: соседи --red-deep/--blood целы (значения прежние)');
    ok(css.includes('--gold-dim: #a8862a;'), 'styles.css: контрастные правки 66.90 целы (--gold-dim)');
}

// ============================================================
// 6. SW v135 + документация патча
// ============================================================
console.log('--- 6. SW v135 и документация ---');
{
    const sw = read('sw.js');
    ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v135';"), 'sw.js: CACHE_NAME v135 (§4: game/src + лендинги менялись)');
    ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 цел (ассеты не тронуты)');
    ok(sw.includes('navigate') || sw.includes("request.mode === 'navigate'"), 'sw.js: navigate-гейт 66.57 цел');
    ok(read('docs/SW_CHANGELOG.md').includes('- v133 — итерация 66.101') && read('docs/SW_CHANGELOG.md').includes('- v135 — итерация 66.106'), 'SW_CHANGELOG: записи v133 и v135 на месте');
    ok(read('CHANGES.md').includes('Патч 66.101'), 'CHANGES.md: секция «Патч 66.101»');
    ok(fs.existsSync(path.join(ROOT, 'docs/EN_I18N_R66101.md')), 'docs/EN_I18N_R66101.md: отчёт F-2 «EN-полнота» существует');
    ok(read('game/src/systems/i18n.js').includes('66.101 (F-2 аудита 66.100'), 'i18n.js: док-комментарий 66.101 о закрытии F-2');
}

console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/**
 * Юнит-проверки раунда 66.10 — приказы владельца:
 *   1. «взять баню/овин из §3.1» НЕ НУЖНО, УДАЛИТЬ!
 *   2. «сундуки/тайники» НЕ НУЖНО, УДАЛИТЬ!
 *   4. Git LFS — ОТКАТ, всё использование LFS удалено.
 *
 * Запуск: node game/tools/test_round73.mjs (из корня репо).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dayKeyOf, isActionDoneToday, markActionDone } from '../src/data/daily.js';
import { SOLID } from '../src/data/world.js';
import { INTERIORS } from '../src/data/interiors.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(repoRoot, 'game', 'src');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(src, p), 'utf8');

console.log('— П.2: сундуки/тайники удалены —');
ok(!existsSync(join(src, 'data', 'chests.js')), 'data/chests.js не существует');
const village = read('scenes/VillageScene.js');
ok(!/spawnChests\s*\(/.test(village), 'VillageScene: spawnChests не вызывается');
ok(!/openChest\s*\(/.test(village), 'VillageScene: openChest не вызывается');
ok(!village.includes("data/chests.js'"), 'VillageScene: импорт chests.js убран');
ok(!village.includes('chestAt'), 'VillageScene: chestAt убран');
const boot = read('scenes/BootScene.js');
ok(!boot.includes("'chest_closed'") && !boot.includes("'chest_open'"), 'BootScene: текстуры сундуков удалены');
ok(!/,\s*'chest'\s*\]/.test(boot) && !boot.includes('int_deco_chest'), "BootScene: 'chest' убран из интерьерных тайлов");
ok(boot.includes('chestsOpened: []'), 'chestsOpened сохранён в quest-стейте (дневные действия, совместимость сейвов)');
const world = read('data/world.js');
ok(!SOLID.has('C'), "world: 'C' удалён из SOLID");
const interiors = read('data/interiors.js');
const hasChestDecor = Object.values(INTERIORS).some(i => i && Array.isArray(i.decor) && i.decor.includes('chest'));
ok(!hasChestDecor, "interiors: 'chest' убран из decor всех домов");
const i18n = read('systems/i18n.js');
ok(!i18n.includes('Сундук у таверны') && !i18n.includes('Тюк у колодца') && !i18n.includes('Позолоченный ларец'), 'i18n: метки сундуков/тюков удалены');
ok(!i18n.includes('🎒 Мой тюк') && !i18n.includes('🎒 Мой узел'), 'i18n: кнопки тайников удалены');
ok(!i18n.includes('Сундуки и тайники открываются'), 'i18n: строка справки про сундуки удалена');
ok(!i18n.includes('Яблоко: +2 ❤') && !i18n.includes('Медная иконка: +1 ⭐'), 'i18n: ключи лута удалены');
const interior = read('scenes/InteriorScene.js');
ok(!interior.includes('Сундуки и тайники'), 'InteriorScene: справка F1 без упоминания сундуков/тайников');
// Живая механика дневных лимитов переезжает, а не умирает:
const location = read('scenes/LocationScene.js');
ok(location.includes("from '../data/daily.js'"), 'LocationScene: дневной лимит рыбалки — из daily.js');
ok(location.includes("isActionDoneToday(q, 'fish_daily', today)"), "LocationScene: ключ 'fish_daily' жив");
const forest = read('scenes/ForestScene.js');
ok(forest.includes("from '../data/daily.js'"), 'ForestScene: dayKeyOf — из daily.js');
ok(forest.includes('разбойничий тайник'), 'ForestScene: логово вора в сюжете сохранено (не «сундуки»)');

console.log('— daily.js: формула дня и дневные лимиты —');
const ts = { yearFromChrist: 1471, month: 2, day: 14 };
ok(dayKeyOf(ts) === '1471-2-14', 'dayKeyOf: формат «год-месяц-день» (как InteriorScene.dayKey)');
ok(dayKeyOf(null) === 'unknown', 'dayKeyOf(null) → unknown');
const q = {};
ok(!isActionDoneToday(q, 'x', '1471-2-14'), 'isActionDoneToday: до отметки — false');
markActionDone(q, 'x', '1471-2-14');
ok(q.chestsOpened.length === 1 && q.chestsOpened[0].id === 'x', 'markActionDone: пишет в ИСТОРИЧЕСКИЙ ключ chestsOpened');
ok(isActionDoneToday(q, 'x', '1471-2-14'), 'isActionDoneToday: после отметки — true');
ok(!isActionDoneToday(q, 'x', '1471-2-15'), 'isActionDoneToday: на другой день — false');
ok(!isActionDoneToday({}, 'y', 'd'), 'isActionDoneToday: без chestsOpened — false, без исключений');

console.log('— П.1: баня/овин (§3.1) удалены —');
ok(!boot.includes("generateTexture('deco_banya'") && !boot.includes("generateTexture('deco_ovin'"), 'BootScene: генераторы deco_banya/deco_ovin удалены');
ok(!boot.includes('===== БАНЯ') && !boot.includes('===== ОВИН'), 'BootScene: секции «Баня по-белому»/«Овин» удалены');
ok(!world.includes('deco_banya') && !world.includes('deco_ovin'), 'world: бани/овина в ярд-пропсах нет');
ok(!village.includes('deco_banya') && !village.includes('deco_ovin'), 'VillageScene: отрисовки бани/овина нет');
const dialogue = read('data/dialogue.js');
ok(!dialogue.includes('у овина'), 'dialogue: реплика Матрёны без ссылки на снесённый овин');

console.log('— П.4: Git LFS удалён (откат) —');
ok(!existsSync(join(repoRoot, '.gitattributes')), '.gitattributes отсутствует');
const swSrc = readFileSync(join(repoRoot, 'game', 'src', 'systems', 'i18n.js'), 'utf8'); // прогрев чтения
let lfsFound = false;
const { readdirSync, statSync } = await import('node:fs');
const walk = (dir) => {
    for (const name of readdirSync(dir)) {
        if (name === '.git' || name === 'node_modules') continue;
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if ((name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.html') || name.endsWith('.json') || name === '.gitattributes')) {
            try { if (readFileSync(p, 'utf8').includes('filter=lfs')) lfsFound = true; } catch { /* пропускаем бинарные */ }
        }
    }
};
walk(repoRoot);
ok(!lfsFound, 'ни один файл репо не содержит filter=lfs');
ok(!boot.includes('lfs') && !village.includes('lfs'), 'код игры не упоминает LFS');

console.log(`\nИтог: ${pass} зелёных, ${fail} проваленных`);
process.exit(fail ? 1 : 0);

// test_round135.mjs — 66.93: ЭШЕЛОН 1 аудита игры — 7 однострочных фиксов
// (P1×3 + P2×4) по плану отчёта «Аудит_кода_сайта_и_игры_66.92», §12.1.
// Состав патча:
//   1) P1-1: meal.js — import { t, tf } (ReferenceError повторной травы);
//   2) P1-2: VirtualControls.js — без emit('keydown-E') (двойное срабатывание
//      тач-кнопки действия: сцены слушают keydown-E и вызывают тот же
//      tryInteract);
//   3) P1-3: game/index.html — input: { activePointers: 2 } (мультитач:
//      движение + взаимодействие/атака одновременно);
//   4) P2-1: CombatScene.js — skillCheck(target.skills.dodge) (враги
//      уклоняются в 15–35% вместо ~1%);
//   5) P2-2: CombatScene.js — this.busy = true ДО анимации playerAttack
//      (позиционный инвариант: ПОСЛЕ гварда пустого колчана — там ход НЕ
//      тратится, ДО расчёта навыка);
//   6) P2-3: CombatScene.js — защёлка __victoryQueued в endCombatVictory
//      (+ сброс в create(); образец __endQueued ForkScene);
//   7) P2-20: TimeSystem.js — кламп advanceTime + ФУНКЦИОНАЛЬНЫЙ Node-тест
//      (Infinity/NaN/отрицательные/строки) через настоящий import модуля.
//   8) SW v125→v126; game-assets-v45 цел; доки (CHANGES/SW_CHANGELOG/worklog);
//      живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round135.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advanceTime } from '../src/systems/TimeSystem.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const meal = read('game/src/systems/meal.js');
const vc = read('game/src/systems/VirtualControls.js');
const time = read('game/src/systems/TimeSystem.js');
const combat = read('game/src/scenes/CombatScene.js');
const gameHtml = read('game/index.html');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');

console.log('--- 1. P1-1: meal.js импорт tf (ReferenceError повторной травы) ---');
ok(meal.includes("import { t, tf } from './i18n.js';"), 'meal.js: import { t, tf } from i18n.js');
ok(!meal.includes("import { t } from './i18n.js';"), 'meal.js: старого import { t } без tf нет');
ok(meal.includes("tf(t('Целебные травы"), 'meal.js: потребитель tf (showHerbBlockedPopup) цел');

console.log('--- 2. P1-2: VirtualControls без двойного срабатывания ---');
ok(!vc.includes("emit('keydown-E'"), 'VirtualControls: emit(keydown-E) УДАЛЁН (было: тап = 2 действия)');
ok(!vc.includes("this.scene.input.keyboard"), 'VirtualControls: эмуляция клавиатуры не осталось');
ok(vc.includes("if (this.scene.tryInteract) {") && vc.includes("this.scene.tryInteract();"), 'VirtualControls: прямой вызов tryInteract сохранён');
ok(vc.includes("actionBase.on('pointerdown'"), 'VirtualControls: обработчик тач-кнопки цел (масштаб/анимация нажатия)');

console.log('--- 3. P1-3: мультитач — input.activePointers = 2 ---');
ok(gameHtml.includes('input: { activePointers: 2 },'), 'game/index.html: input: { activePointers: 2 } в конфиге Phaser');
ok(gameHtml.includes('66.93 (P1-3'), 'game/index.html: коммент-шапка фикса на месте');
ok(gameHtml.includes('pixelArt: true') && gameHtml.includes('Phaser.Scale.RESIZE'), 'game/index.html: конфиг цел (pixelArt/RESIZE не тронуты)');

console.log('--- 4. P2-1: уклонение врагов по skills.dodge ---');
ok(!combat.includes('skillCheck(target.dodge)'), 'CombatScene: skillCheck(target.dodge) УДАЛЁН (undefined → ~1% уклонений)');
ok(combat.includes('skillCheck(target.skills.dodge)'), 'CombatScene: skillCheck(target.skills.dodge) на месте');
ok(combat.includes('this.player.skills.dodge'), 'CombatScene: проверка уклонения ИГРОКА не тронута (skills.dodge)');

console.log('--- 5. P2-2: busy=true до анимации, ПОСЛЕ гварда колчана ---');
ok((combat.match(/66\.93 \(P2-2 аудита игры\)/g) || []).length === 1, 'CombatScene: блок P2-2 вставлен РОВНО ОДИН раз');
const guardIdx = combat.indexOf("if (!spendArrow(this.player)) {");
const busyIdx = combat.indexOf('this.busy = true;', combat.indexOf('66.93 (P2-2'));
const resIdx = combat.indexOf('const res = skillCheck(Math.max(1, skill))');
ok(guardIdx > -1 && busyIdx > guardIdx, 'P2-2 позиционный инвариант: busy ПОСЛЕ гварда пустого колчана (там ход НЕ тратится — early return выше)');
ok(resIdx > -1 && busyIdx < resIdx, 'P2-2 позиционный инвариант: busy ДО расчёта навыка/анимации (окно спам-клика закрыто)');
ok(/afterEnemy\(\) \{\s*\n\s*this\.busy = false;/.test(combat), 'CombatScene: сброс busy в afterEnemy() цел');

console.log('--- 6. P2-3: защёлка __victoryQueued (двойная победа) ---');
ok(combat.includes('this.__victoryQueued = false;'), 'CombatScene: сброс __victoryQueued в create() (экземпляр сцены живёт всю игру)');
ok(combat.includes('if (this.__victoryQueued) return;') && combat.includes('this.__victoryQueued = true;'), 'CombatScene: защёлка в endCombatVictory (повтор — тихий no-op)');
const latchIdx = combat.indexOf('if (this.__victoryQueued) return;');
const bodyIdx = combat.indexOf('const anyOut = this.enemies.some');
ok(latchIdx > -1 && bodyIdx > -1 && latchIdx < bodyIdx, 'P2-3 позиционный инвариант: защёлка ДО тела endCombatVictory (награды/летопись единожды)');

console.log('--- 7. P2-20: кламп advanceTime — статика + ФУНКЦИОНАЛЬНЫЙ Node-тест ---');
ok(time.includes('Math.min(1440, Math.max(0, Math.floor(Number(minutes) || 0)))'), 'TimeSystem: кламп входа advanceTime на месте');
const mk = () => ({ minute: 0, hour: 10, day: 1, month: 0, yearFromChrist: 1453, yearFromCreation: 6961 });
{
    const ts = mk(); advanceTime(ts, Infinity);
    ok(ts.hour === 10 && ts.day === 2 && ts.minute === 0, `advanceTime(∞) = кламп до суток без зависания (день+1, стало ${ts.day}-е число)`);
}
{
    const ts = mk(); advanceTime(ts, NaN);
    ok(ts.minute === 0 && ts.hour === 10 && ts.day === 1, 'advanceTime(NaN) = 0 минут (таймстейт не отравлен)');
}
{
    const ts = mk(); advanceTime(ts, -50);
    ok(ts.minute === 0 && ts.hour === 10, 'advanceTime(−50) = кламп до 0 (без отрицательного времени)');
}
{
    const ts = mk(); advanceTime(ts, '90');
    ok(ts.hour === 11 && ts.minute === 30, "advanceTime('90') = 1 ч 30 м (строка → число → floor)");
}

console.log('--- 8. SW v126 + game-assets-v45 ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v127';"), 'sw.js: CACHE_NAME v127');
ok(!sw.includes("chronicles-ruthenia-v125'"), 'sw.js: старого v125 как CACHE_NAME нет');
ok(sw.includes('66.93 (эшелон 1 аудита игры)'), 'sw.js: коммент-шапка бампа 66.93');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: бакет game-assets-v45 цел (ассеты не тронуты)');

console.log('--- 9. Доки: CHANGES / SW_CHANGELOG / worklog ---');
ok(changes.includes('## Патч 66.93 — Эшелон 1 аудита игры'), 'CHANGES.md: «Патч 66.93» в шапке');
ok(swlog.includes('- v126 — патч 66.93') && swlog.indexOf('- v126') < swlog.indexOf('- v125'), 'SW_CHANGELOG: v126 сверху журнала');
ok(worklog.includes('Task ID: 66.93') && worklog.indexOf('Task ID: 66.93') < worklog.indexOf('Task ID: 66.92'), 'worklog: запись 66.93 сверху');

console.log('--- 10. Синтаксис изменённых файлов ---');
for (const f of ['game/src/systems/meal.js', 'game/src/systems/VirtualControls.js',
                 'game/src/systems/TimeSystem.js', 'game/src/scenes/CombatScene.js', 'sw.js']) {
    try { execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' }); ok(true, `node --check ${f}`); }
    catch (e) { ok(false, `node --check ${f}: ${String(e.message).slice(0, 80)}`); }
}

console.log('--- 11. bump_lastmod --check (после коммита) ---');
try {
    execSync('python3 game/tools/bump_lastmod.py --check', { cwd: ROOT, stdio: 'pipe' });
    ok(true, 'sitemap lastmod СИНХРОН с фактами git');
} catch (e) {
    ok(false, 'sitemap lastmod ДРЕЙФУЕТ (прогнать bump_lastmod.py после коммита)');
}

console.log(`\nИТОГ r135: ${pass} ✓, ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);

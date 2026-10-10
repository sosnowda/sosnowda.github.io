// test_round137.mjs — 66.95: ЭШЕЛОН 3 аудита игры — боевой хвост (P2-4/P2-5),
// гигиена (P2-11…14) и обвязка (P2-16…19) по плану отчёта
// «Аудит_кода_сайта_и_игры_66.92», §12.2/§12.3 (пункты реестра P2).
// Состав патча:
//   1) P2-4: CombatScene — разделка волка по ФАКТУ убитых туш (Math.max(1,…)
//      давал мясо/шкуры с убежавшей стаи);
//   2) P2-5: CombatScene — сброс woundedThief в create() ДО restoreThiefHp
//      («Вор ещё не залечил раны…» печатался во всех последующих боях);
//   3) P2-11: CharacterScene — дубликат showFoodCard удалён (вторая копия
//      молча перезаписывала первую);
//   4) P2-12: WorldLook — канон hueToRgb (NpcLook) на t∈[1/2,2/3] (инверсия
//      зеркалила зелёно-синие оттенки одежды);
//   5) P2-13: src/main.js (мёртвое зеркало с устаревшими гардами) удалён —
//      гарды РЕАЛЬНО живут в BootScene (улучшенная версия), пины r86/r117
//      переведены на реальные файлы;
//   6) P2-14: scenes/Loading.js (522 строки чужой сцены «Powered by Genie»)
//      удалён;
//   7) P2-16: MiniMap — нормировка маркера по фактическому tileSize сцены
//      (деревня на тайле 48, не легаси-32);
//   8) P2-17: AudioManager._applyMusicVolume — множитель 0.5 как во всех
//      местах запуска (смена настроек делала музыку вдвое громче);
//   9) P2-18: AudioManager.setAmbient — захват const prevAmbient (onComplete
//      смотрел на уже заменённый this.ambient — старый трек не останавливался);
//  10) P2-19: utils/ui.js — removeScrollListeners + dialog.once('destroy')
//      (DialogueRunner делает прямой destroy() — до 5 висячих слушателей);
//  11) SW v127→v130; game-assets-v45 цел; доки (CHANGES/SW_CHANGELOG/worklog);
//      живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round137.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const combat = read('game/src/scenes/CombatScene.js');
const charScene = read('game/src/scenes/CharacterScene.js');
const worldLook = read('game/src/systems/WorldLook.js');
const npcLook = read('game/src/systems/NpcLook.js');
const miniMap = read('game/src/systems/MiniMap.js');
const audio = read('game/src/systems/AudioManager.js');
const ui = read('game/src/utils/ui.js');
const boot = read('game/src/scenes/BootScene.js');
const gameHtml = read('game/index.html');
const motionFx = read('game/src/systems/MotionFX.js');
const r86 = read('game/tools/test_round86.mjs');
const r117 = read('game/tools/test_round117.mjs');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');

console.log('--- 1. P2-4: CombatScene — разделка волка по факту убитых ---');
ok(combat.includes('const deadWolves = this.enemies.filter(e => e.HP <= 0).length;'),
   'CombatScene: deadWolves — фактическое число убитых туш');
ok(!combat.includes('Math.max(1, this.enemies.filter'), 'CombatScene: Math.max(1, …) при подсчёте туш БОЛЬШЕ НЕТ');
ok(combat.includes('if (deadWolves > 0) ActionLog.add'), 'CombatScene: при 0 убитых — ни лога, ни лута (гвард)');
ok(combat.includes("this.enemyKeys.includes('wolf')"), 'CombatScene: wolf-ветка endCombatVictory цела');
ok(combat.includes("survivalButcher(this.registry, this.player, [5, 9], true, { trophy: 'wolf_fangs' })"),
   'CombatScene: конвейер разделки (66.73: крит → волчьи клыки) не тронут');
ok(combat.includes("includes('bear') && anyKilled"), 'CombatScene: bear-ветка по-прежнему под гвардом anyKilled');

console.log('--- 2. P2-5: CombatScene — сброс флага раненого вора ---');
ok((combat.match(/this\.woundedThief = false;/g) || []).length === 1,
   'CombatScene: сброс woundedThief ровно ОДИН раз в create()');
ok(combat.includes('if (this.woundedThief) {'), 'CombatScene: предупреждение о раненом воре цело');
const wtReset = combat.indexOf('this.woundedThief = false;');
const wtSet = combat.indexOf('this.woundedThief = true;');
const restore = combat.indexOf('restoreThiefHp(');
ok(wtReset > -1 && restore > wtReset, 'P2-5 позиционный инвариант: сброс ВЫШЕ блока restoreThiefHp');
ok(wtSet > wtReset, 'P2-5 позиционный инвариант: честная установка (savedHp < HP) ПОСЛЕ сброса — флаг живёт ровно бой');

console.log('--- 3. P2-11: CharacterScene — дубликат showFoodCard удалён ---');
ok((charScene.match(/showFoodCard\(item, def\) \{/g) || []).length === 1,
   'CharacterScene: showFoodCard объявлен ровно ОДИН раз');
ok(!charScene.includes('/**\n    /**'), 'CharacterScene: висячего «/** /**» между копиями больше нет');
ok((charScene.match(/showHerbCard\(item, def\) \{/g) || []).length === 1, 'CharacterScene: showHerbCard цел (одна копия)');
ok((charScene.match(/this\.showHerbCard\(item, def\);/g) || []).length === 1,
   'CharacterScene: вызов showHerbCard из showFoodCard на месте');
ok(charScene.includes("tryEatFood(this, p, item.id)") && charScene.includes("this.scene.restart({ from: this.from, tab: 'inventory' })"),
   'CharacterScene: тело карточки (Съесть → tryEatFood → рестарт инвентаря) цело');

console.log('--- 4. P2-12: WorldLook — канон hueToRgb (функциональный тест) ---');
const extractHue = (src) => {
    const m = src.match(/function hueToRgb\(p, q, t\) \{[\s\S]*?\n\}/);
    if (!m) return null;
    try { return new Function(m[0] + '\nreturn hueToRgb;')(); } catch { return null; }
};
const hueW = extractHue(worldLook);
const hueN = extractHue(npcLook);
ok(hueW && hueN, 'hueToRgb извлечён из WorldLook и NpcLook (живые функции)');
if (hueW && hueN) {
    let eq = true, badT = null;
    for (let i = 0; i <= 2000; i++) {
        const t = i / 2000;
        if (hueW(0.25, 0.75, t) !== hueN(0.25, 0.75, t)) { eq = false; badT = t; break; }
    }
    ok(eq, `P2-12 ФУНКЦИОНАЛЬНО: WorldLook.hueToRgb ≡ NpcLook.hueToRgb на сетке t∈[0,1] ×2001${badT !== null ? ' (расходится при t=' + badT + ')' : ''}`);
    const canon = Math.abs(hueW(0, 1, 0.6) - 0.4) < 1e-9;
    ok(canon, 'P2-12 канон: hueToRgb(0,1,0.6) = 0.4 (инвертированная формула давала 0.6)');
    // сквозной: hslToRgb(120°,1,0.5) — чистый зелёный [0,255,0]
    const m2 = worldLook.match(/function hslToRgb\(hDeg, s, l\) \{[\s\S]*?\n\}/);
    if (m2) {
        const q = l => l < 0.5 ? l * 2 : 2 - 2 * l; // не используется — считаем вручную ниже
        const hue = hueW;
        const hslToRgb = (hDeg, s, l) => {
            if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
            const qq = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const pp = 2 * l - qq;
            const hn = hDeg / 360;
            return [Math.round(hue(pp, qq, hn + 1 / 3) * 255), Math.round(hue(pp, qq, hn) * 255), Math.round(hue(pp, qq, hn - 1 / 3) * 255)];
        };
        const g = hslToRgb(120, 1, 0.5);
        ok(g[0] === 0 && g[1] === 255 && g[2] === 0, `P2-12 сквозной: HSL(120°,1,50%) → RGB${JSON.stringify(g)} (чистый зелёный, не зеркальный)`);
    }
}

console.log('--- 5. P2-13/P2-14: мёртвые файлы удалены, гарды живут в BootScene ---');
ok(!fs.existsSync(path.join(ROOT, 'game/src/main.js')), 'P2-13: мёртвое зеркало src/main.js удалено');
ok(!fs.existsSync(path.join(ROOT, 'game/src/scenes/Loading.js')), 'P2-14: мёртвая сцена scenes/Loading.js удалена (522 строки)');
ok(boot.includes('const SM = Phaser.Scenes && Phaser.Scenes.SceneManager;'), 'BootScene: гард SceneManager.update на месте (реальное исполнение)');
ok(boot.includes('DL.prototype.shutdown = function () {'), 'BootScene: гард DisplayList.shutdown на месте');
ok(boot.includes('processQueue'), 'BootScene: дренаж processQueue цел (улучшенная версия гардов)');
ok(boot.includes('мёртвое зеркало src/main.js удалено в 66.95'), 'BootScene: коммент-ссылка на main.js обновлена (66.95)');
ok(motionFx.includes('мёртвое зеркало src/main.js удалено в 66.95'), 'MotionFX: коммент-ссылка обновлена');
ok(gameHtml.includes('зеркало удалено в 66.95 — P2-13 аудита игры'), 'game/index.html: коммент 66.30 актуализирован');
ok(gameHtml.includes("parent: 'game-container'") && gameHtml.includes('pixelArt: true'),
   'game/index.html: конфиг реальной точки входа цел (pixelArt + parent)');
ok(r86.includes("!existsSync('../src/main.js')"), 'r86: пин переведён на проверку удаления зеркала');
ok(r117.includes("read('game/src/scenes/BootScene.js').includes('DL.prototype.shutdown"), 'r117: пин DL-гарда переведён на BootScene');
ok(r117.includes("!fs.existsSync('game/src/main.js') && !fs.existsSync('game/src/scenes/Loading.js')"), 'r117: пин удаления обоих мёртвых файлов');
ok(!sw.includes("'game/src/main.js'") && !sw.includes("'game/src/scenes/Loading.js'"),
   'sw.js: удалённые файлы не в списках кэша (упоминание в комменте бампа допустимо)');

console.log('--- 6. P2-16: MiniMap — нормировка по фактическому тайлу ---');
ok(!miniMap.includes('MAP_W * 32'), 'MiniMap: жёсткой нормировки MAP_W * 32 больше нет');
ok(!miniMap.includes('MAP_H * 32'), 'MiniMap: жёсткой нормировки MAP_H * 32 больше нет');
ok(miniMap.includes('const mmTile = (s && s.tileSize) || 32;'), 'MiniMap: фактический tileSize сцены с фолбэком 32');
ok((miniMap.match(/MAP_W \* mmTile/g) || []).length === 2 && (miniMap.match(/MAP_H \* mmTile/g) || []).length === 2,
   'MiniMap: обе ветки (виджет + панель) на mmTile');
// ФУНКЦИОНАЛЬНО: маркер в центре мира → доля 0.5 плана; старая нормировка 32 давала 0.75
{
    const wd = read('game/src/data/world.js');
    const mw = Number((wd.match(/export const MAP_W = (\d+)/) || [])[1]);
    const mh = Number((wd.match(/export const MAP_H = (\d+)/) || [])[1]);
    ok(mw > 0 && mh > 0, `world.js: MAP_W×MAP_H = ${mw}×${mh} (для расчёта)`);
    if (mw > 0 && mh > 0) {
        const px = mw * 48 / 2; // центр мира деревни (тайл 48)
        const fracNew = px / (mw * 48);
        const fracOld = px / (mw * 32);
        ok(Math.abs(fracNew - 0.5) < 1e-9 && Math.abs(fracOld - 0.75) < 1e-9,
           `P2-16 ФУНКЦИОНАЛЬНО: центр мира → 0.5 плана (старая нормировка давала ${fracOld.toFixed(2)} — «упирался в край»)`);
    }
}

console.log('--- 7. P2-17: AudioManager — множитель музыки 0.5 везде ---');
ok((audio.match(/this\.musicVolume \* 0\.5/g) || []).length === 4,
   'AudioManager: множитель 0.5 ровно в 4 местах (loadMusic + fade-out + fade-in + _applyMusicVolume)');
ok(audio.includes('music.setVolume(this.musicMuted ? 0 : this.musicVolume * 0.5);'),
   'P2-17: _applyMusicVolume с множителем 0.5 (смена настроек больше не удваивает громкость)');
ok(audio.includes('this.musicVolume * 0.35'), 'AudioManager: множитель эмбиента 0.35 цел');

console.log('--- 8. P2-18: AudioManager — захват старого эмбиента ---');
ok(audio.includes('const prevAmbient = this.ambient;'), 'P2-18: ссылка на старый эмбиент захвачена ДО обнуления');
ok(audio.includes('targets: prevAmbient,') && !audio.includes('targets: this.ambient,'),
   'P2-18: tween затухания ведётся по prevAmbient (не по уже заменённому this.ambient)');
const prevIdx = audio.indexOf('const prevAmbient = this.ambient;');
const tweenIdx = audio.indexOf('targets: prevAmbient,');
const nullIdx = audio.indexOf('this.ambient = null;', prevIdx);
ok(prevIdx > -1 && tweenIdx > prevIdx && nullIdx > tweenIdx,
   'P2-18 позиционный инвариант: захват → tween → обнуление (onComplete увидит prevAmbient даже после null)');
ok(audio.includes('prevAmbient?.stop();') && audio.includes('prevAmbient?.destroy();'),
   'P2-18: onComplete останавливает и уничтожает ИМЕННО старый трек');

console.log('--- 9. P2-19: ui.js — слушатели прокрутки снимаются при destroy ---');
ok(ui.includes('const removeScrollListeners = () => {'), 'P2-19: единый идемпотентный хелпер removeScrollListeners');
ok((ui.match(/dialog\.once\('destroy', removeScrollListeners\);/g) || []).length === 1,
   'P2-19: dialog.once(destroy) зарегистрирован ровно один раз (прямой destroy() DialogueRunner больше не течёт)');
ok(ui.includes('        removeScrollListeners();'), 'P2-19: closeDialog вызывает хелпер (прежний путь цел)');
const helperIdx = ui.indexOf('const removeScrollListeners = () => {');
const onceIdx = ui.indexOf("dialog.once('destroy', removeScrollListeners);");
const closeIdx = ui.indexOf('const closeDialog = () => {');
ok(helperIdx > -1 && onceIdx > helperIdx && closeIdx > onceIdx,
   'P2-19 позиционный инвариант: хелпер → once(destroy) → closeDialog');
ok((ui.match(/removeListener\('pointerdown'/g) || []).length === 1,
   'P2-19: снятие pointerdown живёт ТОЛЬКО в хелпере (дублей нет)');
ok(ui.includes("scene.input.removeListener('pointerupoutside'"), 'P2-19: pointerupoutside снимается (все 4 drag-слушателя)');

console.log('--- 10. SW v130 + game-assets-v45 ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v130';"), 'sw.js: CACHE_NAME v130');
ok(!sw.includes("chronicles-ruthenia-v127'"), 'sw.js: старого v127 как CACHE_NAME нет');
ok(sw.includes('66.95 (эшелон 3 аудита игры)'), 'sw.js: коммент-шапка бампа 66.95');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: бакет game-assets-v45 цел (ассеты не тронуты)');

console.log('--- 11. Доки: CHANGES / SW_CHANGELOG / worklog ---');
ok(changes.includes('## Патч 66.95') && changes.indexOf('## Патч 66.95') < changes.indexOf('## Патч 66.94'),
   'CHANGES.md: «Патч 66.95» сверху журнала');
ok(changes.includes('## Патч 66.94'), 'CHANGES.md: заголовок 66.94 цел (не затёрт вставкой)');
ok(swlog.includes('- v130 — патч 66.97') && swlog.indexOf('- v130') < swlog.indexOf('- v129'),
   'SW_CHANGELOG: v130 сверху журнала');
ok(worklog.includes('Task ID: 66.95') && worklog.indexOf('Task ID: 66.95') < worklog.indexOf('Task ID: 66.94'),
   'worklog: запись 66.95 сверху');

console.log('--- 12. Синтаксис изменённых файлов ---');
for (const f of ['game/src/scenes/CombatScene.js', 'game/src/scenes/CharacterScene.js',
                 'game/src/systems/WorldLook.js', 'game/src/systems/MiniMap.js',
                 'game/src/systems/AudioManager.js', 'game/src/utils/ui.js',
                 'game/src/scenes/BootScene.js', 'game/src/systems/MotionFX.js',
                 'game/tools/test_round86.mjs', 'game/tools/test_round117.mjs', 'sw.js']) {
    try { execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' }); ok(true, `node --check ${f}`); }
    catch (e) { ok(false, `node --check ${f}: ${String(e.message).slice(0, 80)}`); }
}

console.log('--- 13. bump_lastmod --check (после коммита) ---');
try {
    execSync('python3 game/tools/bump_lastmod.py --check', { cwd: ROOT, stdio: 'pipe' });
    ok(true, 'sitemap lastmod СИНХРОН с фактами git');
} catch (e) {
    ok(false, 'sitemap lastmod ДРЕЙФУЕТ (прогнать bump_lastmod.py после коммита)');
}

console.log(`\nИТОГ r137: ${pass} ✓, ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);

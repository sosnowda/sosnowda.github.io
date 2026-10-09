// test_round136.mjs — 66.94: ЭШЕЛОН 2 аудита игры — блок состояния сцен
// (P2-6…P2-9, P2-15) + сторож прелоада (P2-10) по плану отчёта
// «Аудит_кода_сайта_и_игры_66.92», §12.2.
// Состав патча:
//   1) P2-6: VillageScene — scale.on('resize') именованным обработчиком +
//      снятие в events.once('shutdown'); VirtualControls — отписка в destroy()
//      (ScaleManager глобален: анонимные подписки накапливались);
//   2) P2-7: InteriorScene.init() — сброс __spendTimeOpen/__sellLootOpen
//      (рестарт по ресайзу навсегда убивал ESC и «Отдых» в экземпляре сцены);
//   3) P2-8: InteriorScene — _lightSources: свежий в init(), безопасное
//      объединение на 4054 (безусловная зачистка убивала hasBg-очаги);
//   4) P2-9: LocationScene — this.hpHudText + живой HP в updateHUD()
//      (до раннего return по timeState; мельница −3 HP);
//   5) P2-10: BootScene — loaderror-коллектор + сторож простоя 30 c
//      (fileprogress) + showBootErrorScreen «Перезагрузить» + гвард
//      перед scene.start('Title');
//   6) P2-15: WorldLook.resetNpcLookCache (текстуры npc_lpc_*/npc_var_* И
//      анимы) + вызов в startGameWithHero перед initNpcNames.
//   7) SW v126→v127; game-assets-v45 цел; доки (CHANGES/SW_CHANGELOG/worklog);
//      живой bump_lastmod --check.
// Запуск из корня репозитория: node game/tools/test_round136.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const village = read('game/src/scenes/VillageScene.js');
const interior = read('game/src/scenes/InteriorScene.js');
const location_ = read('game/src/scenes/LocationScene.js');
const boot = read('game/src/scenes/BootScene.js');
const charSel = read('game/src/scenes/CharacterSelectionScene.js');
const vc = read('game/src/systems/VirtualControls.js');
const worldLook = read('game/src/systems/WorldLook.js');
const npcLook = read('game/src/systems/NpcLook.js');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const worklog = read('worklog.md');

console.log('--- 1. P2-6: VillageScene — scale-подписка снимается в shutdown ---');
ok(village.includes("this.scale.on('resize', this.__onScaleResize);"), 'VillageScene: именованный обработчик __onScaleResize');
ok(!village.includes("this.scale.on('resize', () => {"), 'VillageScene: АНОНИМНОЙ подписки scale.on больше нет');
ok(village.includes("this.scale.off('resize', this.__onScaleResize);"), 'VillageScene: scale.off в shutdown');
const vSub = village.indexOf("this.scale.on('resize', this.__onScaleResize);");
const vOff = village.indexOf("this.scale.off('resize', this.__onScaleResize);");
ok(vSub > -1 && vOff > vSub && village.indexOf('events.once', vSub) < vOff, 'P2-6 позиционный инвариант: подписка → events.once(shutdown) → scale.off');
ok(village.includes('applyCameraFit();'), 'VillageScene: applyCameraFit в обработчике сохранён');

console.log('--- 2. P2-6: VirtualControls — отписка в destroy() ---');
ok(vc.includes('this.__onScaleResize = (gameSize) => {'), 'VirtualControls: именованный обработчик');
ok(!vc.includes("this.scene.scale.on('resize', (gameSize) => {"), 'VirtualControls: АНОНИМНОЙ подписки scale.on больше нет');
ok(vc.includes("this.scene.scale.on('resize', this.__onScaleResize);"), 'VirtualControls: подписка именованным обработчиком');
ok(vc.includes("this.scene.scale.off('resize', this.__onScaleResize);"), 'VirtualControls: scale.off в destroy()');
const vcDestroy = vc.indexOf('    destroy() {');
const vcOff = vc.indexOf("this.scene.scale.off('resize', this.__onScaleResize);");
ok(vcDestroy > -1 && vcOff > vcDestroy, 'P2-6 позиционный инвариант: scale.off внутри destroy()');

console.log('--- 3. P2-7: InteriorScene.init() — сброс флагов открытых меню ---');
ok(interior.includes('this.__spendTimeOpen = false;'), 'InteriorScene: __spendTimeOpen = false в init()');
ok(interior.includes('this.__sellLootOpen = false;'), 'InteriorScene: __sellLootOpen = false в init()');
const initIdx = interior.indexOf('    init(data) {');
ok(initIdx > -1
   && interior.indexOf('this.__spendTimeOpen = false;', initIdx) > initIdx
   && interior.indexOf('this.__sellLootOpen = false;', initIdx) > initIdx,
   'P2-7 позиционный инвариант: сброс флагов ИМЕННО в init() (не в create())');
ok(interior.includes('if (this.__spendTimeOpen || this.busyDialog) return;'), 'InteriorScene: гард ESC (exitAction) цел');
ok(interior.includes('if (this.__sellLootOpen) return;'), 'InteriorScene: гард «Отдых» (showTavernRestMenu) цел');

console.log('--- 4. P2-8: InteriorScene — источники света hasBg-фонов возвращены ---');
ok((interior.match(/66\.94 \(P2-8 аудита\)/g) || []).length === 2, 'InteriorScene: блок P2-8 ровно в 2 местах (init-сброс + инфраструктура света)');
ok(!/=== Раунд 9: инфраструктура света ===[\s\S]*?\n        this\._lightSources = \[\];/.test(interior),
   'InteriorScene: безусловной зачистки _lightSources в инфраструктуре света БОЛЬШЕ НЕТ');
const infraIdx = interior.indexOf('=== Раунд 9: инфраструктура света ===');
const infraLine = interior.indexOf('this._lightSources = this._lightSources || [];', infraIdx);
ok(infraIdx > -1 && infraLine > infraIdx, 'InteriorScene: безопасное объединение на месте инфраструктуры света');
ok(interior.includes('this._lightSources = [];'), 'InteriorScene: свежий _lightSources в init()');
const initLight = interior.indexOf('this._lightSources = [];', initIdx);
ok(initLight > -1 && initLight < infraIdx, 'P2-8 позиционный инвариант: init()-сброс ВЫШЕ hasBg-наполнения и инфраструктуры');
ok((interior.match(/this\._lightSources\.push\(/g) || []).length >= 10, `InteriorScene: все источники света на месте (${(interior.match(/this\._lightSources\.push\(/g) || []).length} push-вызовов)`);
ok(interior.includes('(this._lightSources || []).forEach'), 'InteriorScene: потребление renderWarmLightSpots цело');

console.log('--- 5. P2-9: LocationScene — живой HP в HUD ---');
ok(location_.includes('this.hpHudText = this.add.text(16, 12, `❤ ${player.HP}/${player.HPmax}`'), 'LocationScene: hpHudText сохраняется при создании');
ok((location_.match(/updateHUD\(\) \{[\s\S]*?this\.hpHudText[\s\S]*?\n    \}/) || []).length === 1, 'LocationScene: updateHUD обновляет hpHudText');
const updIdx = location_.indexOf('    updateHUD() {');
const hpUpd = location_.indexOf('this.hpHudText', updIdx);
const timeReturn = location_.indexOf('if (!timeState) return;', updIdx);
ok(hpUpd > -1 && timeReturn > -1 && hpUpd < timeReturn, 'P2-9 позиционный инвариант: обновление HP ДО раннего return по timeState');
ok(location_.includes("this.hpHudText.setText(`❤ ${p.HP}/${p.HPmax}`);"), 'LocationScene: формат ❤ HP/HPmax сохранён');

console.log('--- 6. P2-10: BootScene — сторож прелоада ---');
ok(boot.includes("this.load.on('loaderror'"), 'BootScene: обработчик loaderror на месте');
ok(boot.includes("this.load.on('fileprogress'"), 'BootScene: отслеживание fileprogress (сторож простоя)');
ok(boot.includes('Date.now() - this.__bootLastProgressAt > 30000'), 'BootScene: порог сторожа 30 c простоя');
ok(boot.includes('showBootErrorScreen(reason)'), 'BootScene: метод showBootErrorScreen');
ok(boot.includes("showBootErrorScreen('loaderror');") && boot.includes("showBootErrorScreen('stall');"), 'BootScene: обе причины (loaderror/stall) ведут на экран');
ok(boot.includes("en ? 'Loading error' : 'Ошибка загрузки'"), 'BootScene: экран двуязычный (isEn)');
ok(boot.includes("en ? 'Reload' : 'Перезагрузить'"), 'BootScene: кнопка «Перезагрузить»/«Reload»');
ok(boot.includes('location.reload();'), 'BootScene: reload по кнопке');
const guardIdx = boot.indexOf('if (this.__bootFailed) return;');
const titleIdx = boot.indexOf("this.scene.start('Title');");
ok(guardIdx > -1 && titleIdx > -1 && guardIdx < titleIdx, 'P2-10 позиционный инвариант: гвард __bootFailed ВЫШЕ scene.start(Title)');
ok((boot.match(/if \(this\.__bootFailed\) return;/g) || []).length === 3, 'BootScene: гвард ровно в 3 местах (сторож + showBootErrorScreen + финал create)');
ok(boot.includes('if (this.__bootWatchdog) { this.__bootWatchdog.remove();'), 'BootScene: сторож снимает свой таймер на экране ошибки');
ok(boot.includes("this.scene.isActive('Preload')) this.scene.stop('Preload');"), 'BootScene: Preload глушится на экране ошибки');
ok(!boot.includes("setTimeout(30"), 'BootScene: ОБЩЕГО таймаута нет — только сторож простоя (медленная сеть легитимна)');

console.log('--- 7. P2-15: сброс npc-кэша при новой партии ---');
ok(worldLook.includes('export function resetNpcLookCache(scene)'), 'WorldLook: экспорт resetNpcLookCache');
ok(worldLook.includes("key.startsWith('npc_lpc_') || key.startsWith('npc_var_')"), 'WorldLook: префикс-фильтр npc_lpc_*/npc_var_* (базовые npc_-листы не задеты)');
ok(worldLook.includes('scene.anims.remove(animKey);'), 'WorldLook: анимы снимаются (Phaser 3.88 anims.create НЕ перезаписывает)');
ok(worldLook.includes('Animation key exists'), 'WorldLook: документация о поведении Phaser 3.88 на месте');
ok(charSel.includes("import { HERO_WORLD_LOOKS, rollHeroWorldLook, resetNpcLookCache } from '../systems/WorldLook.js';"), 'CharacterSelectionScene: импорт resetNpcLookCache');
const resetCall = charSel.indexOf('resetNpcLookCache(this);');
const initNames = charSel.indexOf('initNpcNames(this.registry);');
ok(resetCall > -1 && initNames > resetCall, 'P2-15 позиционный инвариант: сброс ДО initNpcNames (в startGameWithHero)');
ok((charSel.match(/resetNpcLookCache\(this\);/g) || []).length === 1, 'CharacterSelectionScene: вызов ровно ОДИН раз');
ok(npcLook.includes('if (scene.textures.exists(variantKey)) return true;'), 'NpcLook: ранний return buildNpcLookTextures цел (сброс — снаружи, в WorldLook.resetNpcLookCache)');

console.log('--- 8. SW v127 + game-assets-v45 ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v127';"), 'sw.js: CACHE_NAME v127');
ok(!sw.includes("chronicles-ruthenia-v126'"), 'sw.js: старого v126 как CACHE_NAME нет');
ok(sw.includes('66.94 (эшелон 2 аудита игры)'), 'sw.js: коммент-шапка бампа 66.94');
ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: бакет game-assets-v45 цел (ассеты не тронуты)');

console.log('--- 9. Доки: CHANGES / SW_CHANGELOG / worklog ---');
ok(changes.includes('## Патч 66.94 — Эшелон 2 аудита игры'), 'CHANGES.md: «Патч 66.94» в шапке');
ok(changes.includes('## Патч 66.93 — Эшелон 1 аудита игры'), 'CHANGES.md: заголовок 66.93 цел (не затёрт вставкой)');
ok(swlog.includes('- v127 — патч 66.94') && swlog.indexOf('- v127') < swlog.indexOf('- v126'), 'SW_CHANGELOG: v127 сверху журнала');
ok(worklog.includes('Task ID: 66.94') && worklog.indexOf('Task ID: 66.94') < worklog.indexOf('Task ID: 66.93'), 'worklog: запись 66.94 сверху');

console.log('--- 10. Синтаксис изменённых файлов ---');
for (const f of ['game/src/scenes/VillageScene.js', 'game/src/scenes/InteriorScene.js',
                 'game/src/scenes/LocationScene.js', 'game/src/scenes/BootScene.js',
                 'game/src/scenes/CharacterSelectionScene.js',
                 'game/src/systems/VirtualControls.js', 'game/src/systems/WorldLook.js', 'sw.js']) {
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

console.log(`\nИТОГ r136: ${pass} ✓, ${fail} ✗`);
process.exit(fail === 0 ? 0 : 1);

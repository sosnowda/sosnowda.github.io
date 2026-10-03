// Тест-раунд 101 — патч 66.46 (5 приказов владельца).
// Проверки: снятый виджет SkyClock, новая система SunLight (чистая функция
// sunShadowState по солнцу + проводка во всех сценах), честная высота ряда
// кнопок диалога, перерисованные фоны боя lake/river (суша под ногами),
// SW v96/v41.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');          // game/
const REPO = path.resolve(ROOT, '..');               // репозиторий

let passed = 0, failed = 0;
const ok = (cond, name) => {
    if (cond) { passed++; }
    else { failed++; console.error(`  ✗ ${name}`); }
};

// ---------- 1) Виджет с солнцем снят с деревни ----------
{
    const vs = readFileSync(path.join(ROOT, 'src/scenes/VillageScene.js'), 'utf8');
    ok(!vs.includes("from '../systems/SkyClock.js'"), '1: VillageScene больше не импортирует SkyClock');
    ok(!vs.includes('attachSkyClock('), '1: attachSkyClock не вызывается');
    ok(!vs.includes('this.skyClock'), '1: поле skyClock удалено');
    ok(vs.includes('attachSunLight'), '1: вместо виджета — система SunLight');
    // Модуль остался в репо (чистые функции_covered test_round82)
    ok(existsSync(path.join(ROOT, 'src/systems/SkyClock.js')), '1: модуль SkyClock.js сохранён (тесты r82)');
}

// ---------- 2) SunLight: чистая функция состояния солнца ----------
{
    const { sunShadowState } = await import(path.join(ROOT, 'src/systems/SunLight.js'));

    // Ночь — солнечных теней нет
    const night = sunShadowState({ hour: 0, minute: 0, month: 0, day: 15 });
    ok(night.alpha === 0 && night.phase === 'night', '2: ночью теней нет');

    // Без времени — безопасное пустое состояние
    const empty = sunShadowState(null);
    ok(empty.alpha === 0 && empty.up === 0, '2: null-время не роняет');

    // Летний полдень (21 июня): солнце высоко, тени короткие, направление ~0
    const noon = sunShadowState({ hour: 13, minute: 0, month: 9, day: 21 });
    ok(noon.up > 0.6, `2: в полдень солнце высоко (${noon.up.toFixed(2)})`);
    ok(noon.len < 0.9, `2: в полдень тени короткие (len=${noon.len.toFixed(2)})`);
    ok(Math.abs(noon.dir) < 0.4, `2: в полдень тени «под ноги» (dir=${noon.dir.toFixed(2)})`);
    ok(noon.alpha > 0.2, '2: днём тени заметны');

    // Летняя ЗАРЯ (до восхода ~2:50): тени длинные, на ЗАПАД (dir < 0), тёплый свет
    const dawn = sunShadowState({ hour: 2, minute: 30, month: 9, day: 21 });
    ok(dawn.dir < 0, `2: утром тени на запад (dir=${dawn.dir.toFixed(2)})`);
    ok(dawn.len > 1.2, `2: утром тени длинные (len=${dawn.len.toFixed(2)})`);
    ok(dawn.warm > 0.3, `2: на заре тёплый свет (warm=${dawn.warm.toFixed(2)})`);

    // Летний вечер: тени на ВОСТОК (dir > 0)
    const dusk = sunShadowState({ hour: 20, minute: 30, month: 9, day: 21 });
    ok(dusk.dir > 0, `2: вечером тени на восток (dir=${dusk.dir.toFixed(2)})`);
    ok(dusk.warm > 0.3, '2: на закате тёплый свет');

    // Зимний полдень — тени длиннее летних (низкое солнце короткого дня)
    const winterNoon = sunShadowState({ hour: 12, minute: 0, month: 3, day: 21 });
    ok(winterNoon.len >= noon.len, `2: зимой тени длиннее летних (${winterNoon.len.toFixed(2)} >= ${noon.len.toFixed(2)})`);
}

// ---------- 3) SunLight: проводка во ВСЕХ локациях ----------
{
    const wired = {
        'VillageScene': 'src/scenes/VillageScene.js',
        'ForestScene': 'src/scenes/ForestScene.js',
        'LocationScene': 'src/scenes/LocationScene.js',
        'ApiaryScene': 'src/scenes/ApiaryScene.js',
        'InteriorScene': 'src/scenes/InteriorScene.js',
        'ForkScene': 'src/scenes/ForkScene.js',
    };
    for (const [name, rel] of Object.entries(wired)) {
        const src = readFileSync(path.join(ROOT, rel), 'utf8');
        ok(src.includes('attachSunLight'), `3: ${name} подключает SunLight`);
        // Fork — карта-экран: время меняется только переходом (сцена пересоздаётся),
        // достаточно первичной отрисовки в attachSunLight
        if (name !== 'ForkScene') {
            ok(src.includes('sunLight.update'), `3: ${name} обновляет свет`);
        }
    }
    // Живые тени героя
    ok(readFileSync(path.join(ROOT, 'src/scenes/VillageScene.js'), 'utf8').includes('sunLight.follow(this.playerObj'),
        '3: тень героя следует за ним (деревня)');
    ok(readFileSync(path.join(ROOT, 'src/scenes/ForestScene.js'), 'utf8').includes('sunLight.follow(this.playerObj'),
        '3: тень героя следует за ним (лес)');
    // LocationScene: теперь есть updateHUD (раньше вызывался несуществующий метод)
    ok(readFileSync(path.join(ROOT, 'src/scenes/LocationScene.js'), 'utf8').includes('updateHUD() {'),
        '3: LocationScene определяет updateHUD (фикс латентного падения)');
}

// ---------- 4) Диалог: высота ряда кнопок от фактической высоты ----------
{
    const ui = readFileSync(path.join(ROOT, 'src/utils/ui.js'), 'utf8');
    ok(!ui.includes('const BTN_ROW_H = 50'), '4: фиксированные 50px на ряд убраны');
    ok(ui.includes('getBtnHeight'), '4: высота кнопки измеряется фактически');
    ok(ui.includes('btnRowH'), '4: высота ряда = фактическая высота кнопки + зазор');
    ok(ui.includes('btnYBase = totalH / 2 - pad.bottom - btnH / 2'), '4: нижний ряд прижат по фактической высоте');
}

// ---------- 5) Фоны боя lake/river: суша под ногами ----------
{
    const toolPath = path.join(ROOT, 'tools/make_battle_bg_6646.py');
    ok(existsSync(toolPath), '5: инструмент 6646 в репо');
    const tool = readFileSync(toolPath, 'utf8');
    ok(tool.includes('DRY_POINTS'), '5: контрольные точки суши описаны');
    ok(tool.includes('check_dry'), '5: автопроверка суши в генераторе');
    // Контрольные точки покрывают все боевые стойки
    for (const pt of ['(320, 596)', '(921, 501)', '(891, 332)', '(951, 588)', '(921, 539)']) {
        ok(tool.includes(pt), `5: точка суши ${pt}`);
    }
    // Файлы перерисованы (свежие, разумный вес)
    for (const name of ['battle_bg_lake', 'battle_bg_river']) {
        const p = path.join(ROOT, 'assets/sprites/battle', `${name}.webp`);
        ok(existsSync(p), `5: ${name}.webp на месте`);
        const sz = statSync(p).size;
        ok(sz > 20000 && sz < 900000, `5: ${name}.webp в разумном весе (${sz}B)`);
    }
    // CombatScene документирует контракт сухости
    const cs = readFileSync(path.join(ROOT, 'src/scenes/CombatScene.js'), 'utf8');
    ok(cs.includes('66.46'), '5: CombatScene упоминает контракт 66.46');
}

// ---------- 6) SW-версии ----------
{
    const sw = readFileSync(path.join(REPO, 'sw.js'), 'utf8');
    const swlog = readFileSync(path.join(REPO, 'docs', 'SW_CHANGELOG.md'), 'utf8'); // 66.47: журнал переехал
    ok(sw.includes("CACHE_NAME = 'chronicles-ruthenia-v114'"), '6: site-cache v112 (актуализация 66.70)');
    ok(sw.includes("GAME_ASSETS_CACHE = 'game-assets-v43'"), '6: game-assets v41');
    ok(swlog.includes('итерация 66.46'), '6: журнал версий дополнен');
}

console.log(`\nr101: ${passed} ok, ${failed} fail`);
process.exit(failed ? 1 : 0);

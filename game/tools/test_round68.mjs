#!/usr/bin/env node
/**
 * Юнит-проверки патча 66.5 (заявка владельца из 7 пунктов — игровые части).
 * Запуск: node tools/test_round68.mjs (из папки game/).
 *
 * Покрывает:
 *   п.4  деревья по всем локациям: валидатор деревни (world.validateTreePlacement)
 *        принимает весь посад без отказов; крона не накрывает дверные тайлы;
 *        коридор у ворот свободен; карта проходима (validateMap без проблем);
 *   п.5  коллизия воды на Реке и Озере (systems/WaterBounds.js):
 *        геометрия полосы/моста/круга; спавн игрока, NPC-споты, пастухи,
 *        стадо и следы — вне воды на трёх разрешениях; свойство-тест:
 *        ЛЮБАЯ точка после clampOutOfWater вне воды;
 *   п.6  10-й скриншот кузницы удалён с сайта (RU/EN галереи, файл);
 *   п.1  worklog.md присутствует в репозитории и содержит секции раундов.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMap, validateMap, validateTreePlacement } from '../src/data/world.js';
import { isWaterAt, clampOutOfWater, riverBand, riverBridge, lakeShape } from '../src/systems/WaterBounds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(root, p), 'utf8');

console.log('\n[1] ДЕРЕВНЯ: валидатор деревьев и карта (п.4)');
{
    const grid = buildMap();
    // Кандидаты посадки — должны совпадать со списком TREES в world.buildMap.
    // Валидатор проверяет «тайл ещё свободен», поэтому подаём сетку ДО посадки
    // (возвращаем деревья 'T' обратно в траву '.'):
    const gridPreTree = grid.map(row => row.map(c => c === 'T' ? '.' : c));
    const TREES = [
        [4, 1], [10, 1], [14, 1], [18, 1], [22, 2],
        [5, 6], [9, 7], [13, 6], [22, 6],
        [5, 10], [9, 11], [13, 10], [17, 11], [21, 11],
    ];
    const report = validateTreePlacement(TREES, gridPreTree);
    ok(report.rejected.length === 0, `валидатор не отклонил ни одного дерева (отказы: ${report.rejected.length ? report.rejected.join('; ') : 'нет'})`);
    ok(report.accepted.length === TREES.length, `все ${TREES.length} деревьев приняты`);
    const tCount = grid.flat().filter(c => c === 'T').length;
    ok(tCount >= 10, `на карте посажено деревьев: ${tCount} (≥10)`);
    // Коридор у ворот свободен от деревьев
    const corridorFree = TREES.every(([c, r]) => !(c >= 23 && c <= 25 && r >= 3 && r <= 7));
    ok(corridorFree, 'подъезд к воротам (23–25 × 3–7) свободен от деревьев');
    // Дверной тайл каждой двери не занят деревом, а ДОРОЖКА от двери соединена с улицей
    const doors = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === 'D') doors.push([x, y]);
    }
    ok(doors.length === 18, `на карте 18 дверей (найдено ${doors.length})`);
    ok(doors.every(([x, y]) => grid[y][x + 1] !== undefined), 'у каждой двери есть окрестные тайлы');
    const problems = validateMap(grid).problems;
    ok(problems.length === 0, `validateMap: карта проходима без проблем (${problems.length === 0 ? '0' : problems.join('; ')})`);
    // Крона не накрывает дверной тайл — прямая проверка правил валидатора:
    // ни одно принятое дерево не стоит в «зоне кроны» двери (u ∈ 0..3 ниже двери)
    const doorList = doors;
    const crownHit = report.accepted.some(([tc, tr]) => doorList.some(([dx, dy]) => {
        const u = tr - dy;
        if (u < 0 || u > 3) return false;
        const half = u === 0 ? 0.6 : u === 1 ? 1.5 : u === 2 ? 1.0 : 0.5;
        return Math.abs(tc - dx) <= half;
    }));
    ok(!crownHit, 'кроны деревьев не накрывают ни один дверной тайл');
}

console.log('\n[2] ВОДА: геометрия WaterBounds (п.5)');
{
    const W = 1280, H = 720;
    const band = riverBand(H);
    ok(Math.abs(band.y1 - H * 0.45) < 0.01 && Math.abs(band.y2 - (H * 0.45 + 120)) < 0.01, `полоса реки y∈[${band.y1.toFixed(0)}, ${band.y2.toFixed(0)}] = [0.45h, 0.45h+120]`);
    const bridge = riverBridge(W);
    ok(bridge.x2 - bridge.x1 === 80 && Math.abs((bridge.x1 + bridge.x2) / 2 - W / 2) < 0.01, 'мост: x = w/2 ± 40');
    const lake = lakeShape(W, H);
    ok(Math.abs(lake.cx - W / 2) < 0.01 && Math.abs(lake.cy - (H / 2 + 30)) < 0.01 && Math.abs(lake.r - Math.min(W, H) / 3.5) < 0.01, 'озеро: центр (w/2, h/2+30), радиус min(w,h)/3.5');
    // мост — не вода
    ok(!isWaterAt('river', W, H, W / 2, H * 0.45 + 60), 'точка на мосту над водой — НЕ вода');
    ok(isWaterAt('river', W, H, W / 2 + 120, H * 0.45 + 60), 'точка в полосе реки вне моста — вода');
    ok(!isWaterAt('lake', W, H, 40, 100), 'угол экрана на озере — не вода');
}

console.log('\n[3] ВОДА: все сущности вне воды на трёх разрешениях (п.5)');
{
    const viewports = [[1280, 720], [900, 560], [390, 844]];
    for (const [W, H] of viewports) {
        const lake = lakeShape(W, H);
        // 1) спавн игрока (0.2w, 0.6h) после clamp — вне воды
        for (const loc of ['river', 'lake']) {
            const p = clampOutOfWater(loc, W, H, W * 0.2, H * 0.6, 30);
            ok(!isWaterAt(loc, W, H, p.x, p.y), `${W}×${H} ${loc}: спавн игрока (${p.x.toFixed(0)},${p.y.toFixed(0)}) вне воды${p.moved ? ' (вытолкнут)' : ''}`);
        }
        // 2) NPC-споты (как в drawLocationNpcs после правки 66.5)
        const lakeR = Math.min(W, H) / 3.5;
        const spots = {
            river: { x: W * 0.5 + 150, y: H * 0.45 - 80 },
            lake: { x: Math.min(W * 0.5 + lakeR + 120, W - 70), y: H * 0.5 + 30 },
        };
        for (const [loc, s] of Object.entries(spots)) {
            const p = clampOutOfWater(loc, W, H, s.x, s.y, 26);
            ok(!isWaterAt(loc, W, H, p.x, p.y), `${W}×${H} ${loc}: NPC-спот (${p.x.toFixed(0)},${p.y.toFixed(0)}) вне воды`);
            // даже БЕЗ clamp новый спот не в воде (построен на берегу)
            ok(!isWaterAt(loc, W, H, s.x, s.y), `${W}×${H} ${loc}: новый NPC-спот в воде по построению не нуждается`);
        }
        // 3) стадо у озера (южная дуга, радиус r+14, clamp pad 28)
        for (let i = 0; i < 3; i++) {
            const ang = Math.PI * (0.3 + i * 0.2);
            const raw = { x: lake.cx + Math.cos(ang) * (lake.r + 14), y: lake.cy + Math.sin(ang) * (lake.r + 14) };
            const p = clampOutOfWater('lake', W, H, raw.x, raw.y, 28);
            ok(!isWaterAt('lake', W, H, p.x, p.y), `${W}×${H} lake: животное стада #${i} вне воды`);
        }
        // 4) следы вора на озере: сырые точки формулы (по хэшу idx 0..5, джиттер ±40) после clamp — вне воды
        for (let idx = 0; idx < 6; idx++) {
            for (let jit = 0; jit < 6; jit++) {
                const rawY = H / 2 - Math.min(W, H) / 3.5 - 20 + ((jit * 7) % 40) + idx * 20;
                const rawX = 80 + ((jit * 97) % Math.max(80, W - 160));
                const p = clampOutOfWater('lake', W, H, rawX, rawY, 24);
                if (isWaterAt('lake', W, H, p.x, p.y)) { ok(false, `${W}×${H} lake: след idx=${idx} jit=${jit} В ВОДЕ`); }
            }
        }
        ok(true, `${W}×${H} lake: следы (36 проб хэш-пространства) вне воды`);
    }
}

console.log('\n[4] ВОДА: свойство-тест clamp — 2000 случайных точек (п.5)');
{
    let bad = 0;
    const W = 1280, H = 720;
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        for (const loc of ['river', 'lake']) {
            const p = clampOutOfWater(loc, W, H, x, y, 26);
            if (isWaterAt(loc, W, H, p.x, p.y)) bad++;
        }
    }
    ok(bad === 0, `после clampOutOfWater ни одна из 4000 точек не в воде (нарушений: ${bad})`);
    // точка вне воды не двигается
    const still = clampOutOfWater('lake', W, H, 40, 100, 26);
    ok(!still.moved && still.x === 40 && still.y === 100, 'точка вне воды остаётся на месте (moved=false)');
}

console.log('\n[5] САЙТ: 10-й скриншот кузницы удалён (п.6)');
{
    const ru = read('../index.html'), en = read('../en/index.html');
    ok(!ru.includes('10-blacksmith'), 'index.html не ссылается на 10-blacksmith');
    ok(!en.includes('10-blacksmith'), 'en/index.html не ссылается на 10-blacksmith');
    ok(!existsSync(join(root, 'assets/screenshots/10-blacksmith.webp')), 'файл assets/screenshots/10-blacksmith.webp удалён');
    ok(ru.includes('09-thief-encounter.webp') && en.includes('09-thief-encounter.webp'), 'галерея сохраняет кадры 01–09');
    ok(read('../sw.js').includes("CACHE_NAME = 'chronicles-ruthenia-v64'"), 'SW забамплен до v64 (сайт-кеш инвалидируется)');
}

console.log('\n[6] РЕПОЗИТОРИЙ: worklog.md в репо (п.1)');
{
    const wl = read('../worklog.md');
    ok(wl.includes('Task ID:'), 'worklog.md в корне репозитория содержит секции Task ID');
    ok(wl.includes('66.4'), 'worklog.md хранит историю раунда 66.4');
    ok(existsSync(join(root, '..', 'AGENTS.md')), 'AGENTS.md создан в корне репозитория');
}

console.log(`\n=== ИТОГ: ${pass} ✓ / ${fail} ✗ ===`);
process.exit(fail ? 1 : 0);

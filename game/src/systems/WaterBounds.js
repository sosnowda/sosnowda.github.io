// WaterBounds.js — раунд 68 (п.5 заявки владельца): КОЛЛИЗИЯ ВОДЫ на
// локациях «Река» и «Озеро». Ни НПЦ, ни персонаж не должны стоять/входить
// в воду: споты игрока, жителей, пастухов, стада и следы вора прогоняются
// через clampOutOfWater() — точка либо не меняется (вне воды), либо
// выталкивается на ближайший берег (радиально для озера, по вертикали
// для реки). Мост на реке — разрешённая зона поверх воды (настил).
//
// Модуль ЧИСТЫЙ (без Phaser) — используется и сценой, и юнит-тестами
// (tools/test_round68.mjs), чтобы геометрия в тестах совпадала 1:1.
//
// Геометрия ДОЛЖНА совпадать с отрисовкой в LocationScene.drawLocation():
//   река: полоса y = height*0.45 .. height*0.45 + 120, мост x = width/2 ± 40;
//   озеро: круг центр (width/2, height/2 + 30), радиус min(width,height)/3.5.

/** Полоса воды реки (без берегов-кромок): y ∈ [y1, y2]. */
export function riverBand(height) {
    const y1 = height * 0.45;
    return { y1, y2: y1 + 120 };
}

/** Настил моста через реку (разрешённая зона поверх воды). */
export function riverBridge(width) {
    const bridgeX = width / 2;
    const bridgeW = 80;
    return { x1: bridgeX - bridgeW / 2, x2: bridgeX + bridgeW / 2 };
}

/** Круглое озеро: центр и радиус. */
export function lakeShape(width, height) {
    return { cx: width / 2, cy: height / 2 + 30, r: Math.min(width, height) / 3.5 };
}

/**
 * Находится ли точка в воде (с запасом pad, чтобы спрайт «не наступал»
 * на кромку берега). Мост считается сушей.
 */
export function isWaterAt(locationId, width, height, x, y, pad = 0) {
    if (locationId === 'river') {
        const { y1, y2 } = riverBand(height);
        if (y < y1 - pad || y > y2 + pad) return false;
        const { x1, x2 } = riverBridge(width);
        if (x >= x1 && x <= x2) return false;   // настил моста — не вода
        return true;
    }
    if (locationId === 'lake') {
        const { cx, cy, r } = lakeShape(width, height);
        const dx = x - cx, dy = y - cy;
        return Math.sqrt(dx * dx + dy * dy) < r + pad;
    }
    return false;
}

/**
 * Вытолкнуть точку из воды на ближайший берег.
 * Река: точка уходит на верхний/нижний берег (какая ближе), если она не на
 * мосту. Озеро: радиальный вынос за кромку r + pad. Вне воды — без изменений.
 * @returns {{x: number, y: number, moved: boolean}}
 */
export function clampOutOfWater(locationId, width, height, x, y, pad = 26) {
    if (locationId === 'river') {
        const { y1, y2 } = riverBand(height);
        const { x1, x2 } = riverBridge(width);
        const inBand = y >= y1 - pad && y <= y2 + pad;
        if (!inBand || (x >= x1 && x <= x2)) return { x, y, moved: false };
        const mid = (y1 + y2) / 2;
        const ny = (y < mid) ? y1 - pad : y2 + pad;
        return { x, y: Math.min(Math.max(ny, 100), height - 40), moved: true };
    }
    if (locationId === 'lake') {
        const { cx, cy, r } = lakeShape(width, height);
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const lim = r + pad;
        if (d >= lim) return { x, y, moved: false };
        if (d < 0.5) {
            // точка в самом центре — выносим на южный берег
            return { x: cx, y: Math.min(cy + lim, height - 40), moved: true };
        }
        const k = lim / d;
        const nx = Math.min(Math.max(cx + dx * k, 40), width - 40);
        const ny = Math.min(Math.max(cy + dy * k, 100), height - 40);
        return { x: nx, y: ny, moved: true };
    }
    return { x, y, moved: false };
}

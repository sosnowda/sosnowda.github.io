// Раунд 66.34 (приказы владельца 1–10): НОВАЯ КОМПОНОВКА КАРТЫ МЕСТНОСТИ
// и КЛИК-ЗОНЫ для интерактивного экрана (ForkScene теперь — сама карта).
// Прежняя расстановка 66.25 (озеро/мельница справа, поле/выпас слева эллипсами)
// заменена по новой разметке владельца:
//   1. Экран «Околица деревни» УДАЛЁН — вместо него карта местности
//      (интерактивная: клик по зоне = переход, см. TERRAIN_ZONES).
//   2. ОЗЕРО — верхний ЛЕВЫЙ угол, левее Северного тракта.
//   3. ЛЕС — весь правый край от верхнего края до реки, ТРИ СЛОЯ без видимых
//      границ: у дороги — Опушка (светлая, редкие деревья), в центре полоса
//      Лесной поляны (светлая, цветы, старый дуб), у правого края — Густой
//      лес (тёмная чаща). Границ рисуем ноль — слои отличаются только
//      плотностью/цветом; доступные зоны локаций ограничены клик-зонами.
//   4. ПОГОСТ — около лесной опушки (между Южным трактом и опушкой, у реки).
//   5. МЕЛЬНИЦА — справа от деревни (полянка у кромки опушки).
//   7. ПОЛЕ — широкая полоса вдоль ВСЕГО левого края карты (от верха до реки).
//   8. От деревьи ОТДЕЛЬНЫЕ дорожки ко всем локациям (TERRAIN_PATHS).
//   9. ВЫПАС — широкая полоса зелёной травы, прилегающая к полю и
//      ОБТЕКАЮЩАЯ озеро со всех сторон (озеро целиком внутри выпаса).
//  10. Через все три лесные локации от деревни идёт ТОНКАЯ ТРОПА,
//      заканчивающаяся в ЦЕНТРЕ густого леса.
//  Центр карты — деревня, через неё проходит ТРАКТ: Северный (от северного
//  края до деревни) и Южный (от деревни до реки, по мосту на другой берег).
// Модуль ЧИСТЫЙ (без Phaser и i18n): drawTerrainMap(ctx) рисует карту на
// 2D-контексте canvas-текстуры; ForkScene накладывает подписи (t()),
// клик-зоны и пульсирующую метку игрока. Все координаты — в системе 680×540.

export const TERRAIN_W = 680;
export const TERRAIN_H = 540;

// Рамка карты (пергаментный кант)
export const TERRAIN_FRAME = 14;

// ===== КЛЮЧЕВЫЕ ОБЪЕКТЫ КАРТЫ (координаты в системе 680×540) =====
export const TERRAIN = {
    tractX: 300,                                   // тракт — вертикальная дорога
    village: { x: 300, y: 258, w: 96, h: 66 },     // деревня в центре
    river: { y: 436, h: 42 },                      // река — лента через южный край
    bridge: { x: 300, w: 26 },                     // мост тракта через реку
    // 66.34 п.2: озеро — верхний левый угол, ЛЕВЕЕ Северного тракта
    lake: { x: 160, y: 95, rx: 64, ry: 42 },
    // 66.40 (приказ владельца): мельница — РЯДОМ С ПАСЕКОЙ (юго-западнее
    // деревни, между пасекой и Южным Трактом; прежде — справа от деревни,
    // 66.34 п.5)
    mill: { x: 252, y: 388, pathY: 388 },
    // 66.34 п.4: погост — около лесной опушки (у Южного тракта, над рекой)
    pogost: { x: 334, y: 398, rx: 22, ry: 18 },
    // 66.34 п.9: выпас — полоса травы (x 80..250, y 14..310), прилегает к полю
    // и целиком ОБТЕКАЕТ озеро
    pasture: { x1: 80, y1: 14, x2: 250, y2: 310 },
    // пасека — слева-снизу, между выпасом и рекой (владелец её не двигал)
    apiary: { x: 172, y: 362, rx: 42, ry: 24 },
    // 66.34 п.7: поле — полоса вдоль ВСЕГО левого края (x 14..80, y 14..430)
    field: { x1: 14, y1: 14, x2: 80, y2: 430 },
    // 66.34 п.3: лес — весь правый край от верха до реки, три слоя
    forest: { x1: 360, y1: 14, x2: 666, y2: 436 },
    forestEdgeX: 410,   // центр полосы опушки   (x 360..460)
    forestGladeX: 506,  // центр полосы поляны   (x 460..552)
    forestDeepX: 609,   // центр полосы чащи     (x 552..666)
    forestPathEnd: { x: 600, y: 228 }, // п.10: конец тропы — в центре чащи
};

// ===== КЛИК-ЗОНЫ (66.34 п.1: карта = экран выбора локации) =====
// Порядок = приоритет попадания (первая зона, содержащая точку).
// shape: 'rect' {x,y,w,h} | 'ellipse' {x,y,rx,ry} | 'circle' {x,y,r}
// id 'village' — возврат в деревню; остальные — locationId из mapLocations.
export const TERRAIN_ZONES = [
    { id: 'village',      shape: 'rect',    x: 248, y: 221, w: 104, h: 74 },
    // 66.40: зона-эллипс охватывает поляну (башня/сарай/мешки) И подпись —
    // клик по подписи «Мельница» тоже ведёт в локацию (как было в 66.34);
    // не пересекает зону пасеки (правый край 218) и погоста (левый край 304)
    { id: 'mill',         shape: 'ellipse', x: 252, y: 382, rx: 42, ry: 46 },
    { id: 'lake',         shape: 'ellipse', x: 160, y: 95,  rx: 66, ry: 44 },
    { id: 'apiary',       shape: 'ellipse', x: 172, y: 362, rx: 46, ry: 27 },
    { id: 'pogost',       shape: 'ellipse', x: 334, y: 398, rx: 30, ry: 21 },
    { id: 'pasture',      shape: 'rect',    x: 80,  y: 14,  w: 170, h: 296 },
    { id: 'field',        shape: 'rect',    x: 14,  y: 14,  w: 66,  h: 416 },
    { id: 'river',        shape: 'rect',    x: 14,  y: 430, w: 652, h: 54 },
    { id: 'road_north',   shape: 'rect',    x: 286, y: 14,  w: 28,  h: 204 },
    { id: 'road_south',   shape: 'rect',    x: 286, y: 295, w: 28,  h: 135 },
    { id: 'forest_edge',  shape: 'rect',    x: 360, y: 14,  w: 100, h: 416 },
    { id: 'forest_glade', shape: 'rect',    x: 460, y: 14,  w: 92,  h: 416 },
    { id: 'forest',       shape: 'rect',    x: 552, y: 14,  w: 114, h: 416 },
];

/** Попадание точки карты (в системе 680×540) в клик-зону (с учётом приоритета). */
export function zoneAt(mx, my) {
    for (const z of TERRAIN_ZONES) {
        if (z.shape === 'rect') {
            if (mx >= z.x && mx <= z.x + z.w && my >= z.y && my <= z.y + z.h) return z;
        } else if (z.shape === 'ellipse') {
            const dx = (mx - z.x) / z.rx, dy = (my - z.y) / z.ry;
            if (dx * dx + dy * dy <= 1) return z;
        } else if (z.shape === 'circle') {
            const dx = mx - z.x, dy = my - z.y;
            if (dx * dx + dy * dy <= z.r * z.r) return z;
        }
    }
    return null;
}

// ===== ДОРОЖКИ (п.8): ОТ ДЕРЕВНИ ко всем локациям =====
// kind: 'trail' — грунтовая тропа (пунктир); лесная цепочка (п.10) помечена
// forestChain — тонкая тропа от деревни через ВСЕ три леса к центру чащи.
// pts — ломаная в системе 680×540.
export const TERRAIN_PATHS = [
    { to: 'field',       kind: 'trail', pts: [[252, 264], [212, 300], [152, 330], [84, 348]] },
    { to: 'pasture',     kind: 'trail', pts: [[250, 254], [222, 244], [196, 238]] },
    { to: 'lake',        kind: 'trail', pts: [[262, 224], [242, 160], [228, 122]] },
    { to: 'apiary',      kind: 'trail', pts: [[256, 288], [226, 330], [206, 354]] },
    // 66.40: дорожка к мельнице — от восточных ворот на юго-запад, к пасеке
    { to: 'mill',        kind: 'trail', pts: [[348, 254], [320, 302], [296, 346], [272, 376]] },
    { to: 'pogost',      kind: 'trail', pts: [[312, 293], [326, 336], [334, 380]] },
    // п.10: тонкая тропа через Опушку → Поляну → в ЦЕНТР Густого леса
    { to: 'forest_edge', kind: 'trail', forestChain: true, pts: [[348, 262], [382, 257], [424, 253], [460, 249]] },
    { to: 'forest_glade', kind: 'trail', forestChain: true, pts: [[460, 249], [486, 258], [508, 268]] },
    { to: 'forest',      kind: 'trail', forestChain: true, pts: [[508, 268], [544, 252], [576, 236], [600, 228]] },
];

// ===== ПОДПИСИ КАРТЫ (ключи i18n; рисует ForkScene поверх текстуры) =====
export const TERRAIN_LABELS = [
    { key: 'village', text: 'Деревня', x: 218, y: 250 },
    { key: 'northTract', text: 'Северный Тракт', x: 300, y: 52 },
    { key: 'southTract', text: 'Южный Тракт', x: 300, y: 356 },
    { key: 'river', text: 'Река', x: 150, y: 457 },
    { key: 'bridge', text: 'Мост', x: 352, y: 470 },
    { key: 'lake', text: 'Озеро', x: 160, y: 95 },
    { key: 'mill', text: 'Мельница', x: 216, y: 404 },
    { key: 'pogost', text: 'Погост', x: 334, y: 426 },
    { key: 'pasture', text: 'Выпас', x: 165, y: 224 },
    { key: 'apiary', text: 'Пасека', x: 172, y: 362 },
    { key: 'field', text: 'Поле', x: 47, y: 210 },
    // 66.40: подписи леса в две строки — на мобиле (шрифт не масштабируется)
    // «Опушка/Лесная поляна/Густой лес» наезжали друг на друга
    { key: 'forestEdge', text: 'Опушка', x: 410, y: 110 },
    { key: 'forestGlade', text: 'Лесная поляна', x: 506, y: 76 },
    { key: 'forestDeep', text: 'Густой лес', x: 609, y: 48 },
];

// Детерминированный псевдослучайный генератор (карта одинакова при
// каждой перерисовке — без «прыганья» элементов).
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Символ дерева: ствол + крона (для лесных массивов карты). */
function drawTree(ctx, x, y, r, crown, dark) {
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - r * 0.9);
    ctx.stroke();
    ctx.fillStyle = crown;
    ctx.beginPath();
    ctx.arc(x, y - r * 1.25, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.stroke();
}

/** Стог сена: жёлтый полукруг со штрихами (деталь выпаса, п.8 66.25). */
function drawHaystack(ctx, x, y, s) {
    ctx.fillStyle = '#d9b95c';
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.6, y - s * 1.5, x, y - s * 1.6);
    ctx.quadraticCurveTo(x + s * 0.6, y - s * 1.5, x + s, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a8862e';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - 1);
    ctx.lineTo(x - s * 0.2, y - s);
    ctx.moveTo(x + s * 0.4, y - 1);
    ctx.lineTo(x + s * 0.2, y - s * 0.9);
    ctx.stroke();
}

/** Утка на воде: две дуги-галочки (деталь озера). */
function drawDuck(ctx, x, y) {
    ctx.strokeStyle = 'rgba(40, 55, 70, 0.75)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x, y - 3.4, x + 1, y);
    ctx.moveTo(x + 1, y);
    ctx.quadraticCurveTo(x + 3, y - 2.4, x + 5, y - 1.2);
    ctx.stroke();
}

/** Смешение двух hex-цветов (t 0..1) — для плавных переходов леса. */
function lerpColor(c1, c2, t) {
    const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const [r1, g1, b1] = p(c1), [r2, g2, b2] = p(c2);
    const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Рисует полноценную карту местности на 2D-контексте canvas.
 * Размер канвы — TERRAIN_W × TERRAIN_H.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawTerrainMap(ctx) {
    const W = TERRAIN_W, H = TERRAIN_H, F = TERRAIN_FRAME;
    const rnd = mulberry32(6634);
    const T = TERRAIN;

    // ===== 1) Пергаментная основа =====
    ctx.fillStyle = '#e6d7ac';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
        ctx.fillStyle = `rgba(90, 70, 40, ${0.03 + rnd() * 0.05})`;
        ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
    }

    // ===== 2) Земли: травяной фон внутри рамки =====
    ctx.fillStyle = '#a9c383';
    ctx.fillRect(F, F, W - F * 2, H - F * 2);
    // травяные штрихи
    ctx.strokeStyle = 'rgba(90, 130, 60, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
        const gx = F + 4 + rnd() * (W - F * 2 - 8);
        const gy = F + 4 + rnd() * (H - F * 2 - 8);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 3, gy - 4);
        ctx.stroke();
    }

    // ===== 3) Рамка-кант (двойная линия) =====
    ctx.strokeStyle = '#6b4a2e';
    ctx.lineWidth = 3;
    ctx.strokeRect(6.5, 6.5, W - 13, H - 13);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(12.5, 12.5, W - 25, H - 25);

    // ===== 4) ПОЛЕ (п.7): золотая полоса вдоль ВСЕГО левого края =====
    {
        const f = T.field;
        const fw = f.x2 - f.x1, fh = f.y2 - f.y1;
        ctx.fillStyle = '#d9b95c';
        ctx.fillRect(f.x1, f.y1, fw, fh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(f.x1, f.y1, fw, fh);
        ctx.clip();
        // борозды — вертикальные волнистые ряды
        ctx.strokeStyle = '#b6923a';
        ctx.lineWidth = 1.1;
        for (let col = 0; col < 4; col++) {
            const xx = f.x1 + 12 + col * 15;
            ctx.beginPath();
            ctx.moveTo(xx, f.y1 + 4);
            for (let yy = f.y1 + 4; yy < f.y2 - 4; yy += 26) {
                ctx.quadraticCurveTo(xx + 5, yy + 13, xx, yy + 26);
            }
            ctx.stroke();
        }
        // снопы
        for (let i = 0; i < 9; i++) {
            const sx = f.x1 + 14 + (i % 3) * 20;
            const sy = f.y1 + 30 + Math.floor(i / 3) * 120;
            ctx.fillStyle = '#c4a23e';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#8a6a1e';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(sx - 1.8, sy + 2.2);
            ctx.lineTo(sx + 1.8, sy + 2.2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ===== 5) ВЫПАС (п.9): широкая полоса травы у поля, ОБТЕКАЕТ озеро =====
    {
        const p = T.pasture;
        const pw = p.x2 - p.x1, ph = p.y2 - p.y1;
        ctx.fillStyle = '#8fbc62';
        ctx.fillRect(p.x1, p.y1, pw, ph);
        ctx.strokeStyle = 'rgba(60, 110, 40, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 130; i++) {
            const sx = p.x1 + 4 + rnd() * (pw - 8);
            const sy = p.y1 + 4 + rnd() * (ph - 8);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + 2, sy - 4);
            ctx.stroke();
        }
        // цветы
        for (let i = 0; i < 30; i++) {
            const fx = p.x1 + 8 + rnd() * (pw - 16);
            const fy = p.y1 + 8 + rnd() * (ph - 16);
            ctx.fillStyle = rnd() < 0.5 ? '#f2f0d8' : '#e8c85a';
            ctx.beginPath();
            ctx.arc(fx, fy, 1.7, 0, Math.PI * 2);
            ctx.fill();
        }
        // стога сена (три, по лугу)
        drawHaystack(ctx, 118, 210, 6);
        drawHaystack(ctx, 214, 258, 5);
        drawHaystack(ctx, 150, 278, 5);
        // жердь-стойка у стога
        ctx.strokeStyle = '#6b4a2e';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(118, 210);
        ctx.lineTo(121, 201);
        ctx.stroke();
    }

    // ===== 6) ЛЕС (п.3): весь правый край, три слоя БЕЗ видимых границ =====
    // Подложка — горизонтальный градиент: у дороги светло, у правого края темно.
    {
        const fo = T.forest;
        const fw = fo.x2 - fo.x1, fh = fo.y2 - fo.y1;
        const grad = ctx.createLinearGradient(fo.x1, 0, fo.x2, 0);
        grad.addColorStop(0, '#8db76a');    // опушка — светлая кромка у дороги
        grad.addColorStop(0.42, '#5d8a4a'); // к поляне — гуще
        grad.addColorStop(1, '#2f5526');    // чаща — самая тёмная
        ctx.fillStyle = grad;
        ctx.fillRect(fo.x1, fo.y1, fw, fh);

        // Деревья: плотность и темнота растут слева направо; поляну не сажаем.
        const glade = { x: T.forestGladeX, y: 228, rx: 40, ry: 128 };
        const inGlade = (x, y, pad = 6) => {
            const dx = (x - glade.x) / (glade.rx + pad), dy = (y - glade.y) / (glade.ry + pad);
            return dx * dx + dy * dy <= 1;
        };
        for (let i = 0; i < 150; i++) {
            // плотнее к правому краю (степень 0.8); отступ от рамки — кроны
            // деревьев (r*2.25 вверх) не должны налезать на пергаментный кант
            const tx = fo.x1 + 6 + Math.pow(rnd(), 0.8) * (fw - 14);
            const ty = fo.y1 + 18 + rnd() * (fh - 40);
            if (ty > T.river.y - 10) continue;              // не сажаем в реку
            if (inGlade(tx, ty)) continue;                  // поляна без хаоса
            const t = (tx - fo.x1) / fw;                    // 0 у дороги … 1 у края
            const crown = lerpColor('#5f9448', '#24451d', t);
            const dark = lerpColor('#3f6b34', '#16300f', t);
            drawTree(ctx, tx, ty, 3.6 + t * 2.2 + rnd() * 1.3, crown, dark);
        }

        // 6а. ОПУШКА — ягодные кусты-бусины у светлой кромки (деталь п.8 66.25)
        for (let i = 0; i < 8; i++) {
            const bx = fo.x1 + 10 + rnd() * 70;
            const by = fo.y1 + 20 + rnd() * (fh - 70);
            ctx.fillStyle = '#c4453c';
            ctx.beginPath();
            ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 6б. ЛЕСНАЯ ПОЛЯНА — светлая полоса в центре (п.3), цветы + старый дуб
        ctx.fillStyle = '#9cc878';
        ctx.beginPath();
        ctx.ellipse(glade.x, glade.y - 62, glade.rx - 4, 74, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(glade.x, glade.y + 62, glade.rx - 4, 74, 0, 0, Math.PI * 2);
        ctx.fill();
        // цветы на поляне
        for (let i = 0; i < 16; i++) {
            const topHalf = rnd() < 0.5;
            const fx = glade.x - (glade.rx - 12) + rnd() * 2 * (glade.rx - 12);
            const fy = glade.y - 62 + (topHalf ? -1 : 1) * rnd() * 66;
            ctx.fillStyle = ['#f2f0d8', '#e8a0b4', '#e8c85a'][i % 3];
            ctx.beginPath();
            ctx.arc(fx, fy, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
        // старый дуб в северной части поляны (деталь п.8 66.25)
        drawTree(ctx, glade.x, glade.y - 48, 7.5, '#3f6b34', '#28451f');

        // 6в. ГУСТОЙ ЛЕС — грибочки на просвете (деталь п.8 66.25)
        for (let i = 0; i < 4; i++) {
            const mx = T.forestDeepX - 26 + i * 16, my = 150 + (i % 2) * 130;
            ctx.fillStyle = '#e8dcc4';
            ctx.fillRect(mx, my, 1.4, 3);
            ctx.fillStyle = '#b06a3a';
            ctx.beginPath();
            ctx.arc(mx + 0.7, my, 2.4, Math.PI, 0);
            ctx.fill();
        }
    }

    // ===== 7) РЕКА — лента через южный край (Южный Тракт упирается в неё) =====
    {
        const r = T.river;
        // берега
        ctx.fillStyle = '#c9b183';
        ctx.fillRect(F, r.y - 6, W - F * 2, r.h + 12);
        // вода
        ctx.fillStyle = '#5b8fb5';
        ctx.fillRect(F, r.y, W - F * 2, r.h);
        ctx.fillStyle = '#4a7ba3';
        ctx.fillRect(F, r.y + r.h * 0.3, W - F * 2, r.h * 0.42);
        // волны
        ctx.strokeStyle = 'rgba(230, 240, 248, 0.5)';
        ctx.lineWidth = 1.3;
        for (let i = 0; i < 22; i++) {
            const wx = F + 8 + rnd() * (W - F * 2 - 24);
            const wy = r.y + 8 + rnd() * (r.h - 16);
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.quadraticCurveTo(wx + 7, wy - 3, wx + 14, wy);
            ctx.stroke();
        }
        // камыши у берегов (деталь п.8)
        ctx.strokeStyle = '#6f8a3a';
        ctx.lineWidth = 1.1;
        for (let i = 0; i < 10; i++) {
            const rx2 = F + 12 + rnd() * (W - F * 2 - 40);
            const top = rnd() < 0.5;
            const ry2 = top ? r.y - 3 : r.y + r.h + 3;
            ctx.beginPath();
            ctx.moveTo(rx2, ry2 + (top ? 4 : 0));
            ctx.lineTo(rx2 + 1, ry2 + (top ? -4 : 4));
            ctx.stroke();
        }
    }

    // ===== 8) ОЗЕРО (п.2): верхний левый угол, целиком внутри выпаса =====
    {
        const l = T.lake;
        // песчаный берег
        ctx.fillStyle = '#c9b183';
        ctx.beginPath();
        ctx.ellipse(l.x, l.y, l.rx + 7, l.ry + 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // вода
        ctx.fillStyle = '#5b8fb5';
        ctx.beginPath();
        ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        // глубина
        ctx.fillStyle = '#4a7ba3';
        ctx.beginPath();
        ctx.ellipse(l.x + 6, l.y + 4, l.rx * 0.62, l.ry * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        // блики-волны
        ctx.strokeStyle = 'rgba(230, 240, 248, 0.55)';
        ctx.lineWidth = 1.3;
        for (let i = 0; i < 12; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd()) * 0.85;
            const wx = l.x + Math.cos(ang) * rr * l.rx;
            const wy = l.y + Math.sin(ang) * rr * l.ry;
            ctx.beginPath();
            ctx.moveTo(wx - 6, wy);
            ctx.quadraticCurveTo(wx, wy - 3, wx + 6, wy);
            ctx.stroke();
        }
        // камыши у берега
        ctx.strokeStyle = '#6f8a3a';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 8; i++) {
            const ang = rnd() * Math.PI * 2;
            const rx2 = l.x + Math.cos(ang) * (l.rx + 3);
            const ry2 = l.y + Math.sin(ang) * (l.ry + 3);
            ctx.beginPath();
            ctx.moveTo(rx2, ry2 + 4);
            ctx.lineTo(rx2 + 1, ry2 - 4);
            ctx.stroke();
        }
        // утки (деталь п.8)
        drawDuck(ctx, l.x - l.rx * 0.35, l.y - l.ry * 0.15);
        drawDuck(ctx, l.x + l.rx * 0.15, l.y + l.ry * 0.3);
    }

    // ===== 9) ДОРОГИ =====
    // 9а. Тракт: вертикальная песчаная лента (север → деревня → река → юг)
    {
        const tx = T.tractX, half = 7;
        ctx.fillStyle = '#c2a878';
        ctx.fillRect(tx - half, F, half * 2, T.village.y - T.village.h / 2 - F);   // Северный Тракт
        ctx.fillRect(tx - half, T.village.y + T.village.h / 2, half * 2,
            T.river.y - (T.village.y + T.village.h / 2));                          // Южный Тракт
        ctx.fillRect(tx - half, T.river.y + T.river.h + 6, half * 2,
            H - F - (T.river.y + T.river.h + 6));                                  // за мостом — на юг
        // кромки
        ctx.strokeStyle = '#8a744e';
        ctx.lineWidth = 1;
        [tx - half, tx + half].forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x, F);
            ctx.lineTo(x, T.village.y - T.village.h / 2);
            ctx.moveTo(x, T.village.y + T.village.h / 2);
            ctx.lineTo(x, T.river.y - 4);
            ctx.moveTo(x, T.river.y + T.river.h + 6);
            ctx.lineTo(x, H - F);
            ctx.stroke();
        });
        // колея
        ctx.strokeStyle = 'rgba(120, 96, 60, 0.55)';
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.moveTo(tx, F);
        ctx.lineTo(tx, T.village.y - T.village.h / 2);
        ctx.moveTo(tx, T.village.y + T.village.h / 2);
        ctx.lineTo(tx, T.river.y - 4);
        ctx.stroke();
        ctx.setLineDash([]);
        // ВЕРСТОВЫЕ КАМНИ вдоль тракта (деталь п.8)
        [[tx + 11, 90], [tx - 11, 210], [tx + 11, 330], [tx - 11, 398]].forEach(([sx, sy]) => {
            ctx.fillStyle = '#9a9a8e';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#6b6b60';
            ctx.lineWidth = 0.7;
            ctx.stroke();
        });
    }
    // 9б. Грунтовые дорожки ОТ ДЕРЕВНИ ко всем локациям (п.8) + тропа п.10
    {
        ctx.setLineDash([6, 5]);
        TERRAIN_PATHS.forEach(p => {
            ctx.strokeStyle = p.forestChain ? 'rgba(122, 96, 58, 0.8)' : '#8a744e';
            ctx.lineWidth = p.forestChain ? 1.2 : 1.6;   // п.10: лесная тропа — ТОНЬШЕ
            ctx.beginPath();
            ctx.moveTo(p.pts[0][0], p.pts[0][1]);
            for (let i = 1; i < p.pts.length; i++) {
                const [ax, ay] = p.pts[i - 1], [bx, by] = p.pts[i];
                ctx.quadraticCurveTo((ax + bx) / 2 + (rnd() - 0.5) * 8, (ay + by) / 2 + (rnd() - 0.5) * 8, bx, by);
            }
            ctx.stroke();
        });
        ctx.setLineDash([]);
        // конечная точка тропы — в центре густого леса (п.10)
        const e = T.forestPathEnd;
        ctx.fillStyle = 'rgba(90, 63, 36, 0.85)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
    }
    // 9в. МОСТ Южного Тракта через реку
    {
        const b = T.bridge, r = T.river;
        ctx.fillStyle = '#8a6a42';
        ctx.fillRect(b.x - b.w / 2, r.y - 8, b.w, r.h + 16);
        ctx.strokeStyle = '#6b4a2e';
        ctx.lineWidth = 1;
        for (let py = r.y - 4; py < r.y + r.h + 8; py += 6) {
            ctx.beginPath();
            ctx.moveTo(b.x - b.w / 2 + 2, py);
            ctx.lineTo(b.x + b.w / 2 - 2, py);
            ctx.stroke();
        }
        // перила
        ctx.fillStyle = '#5a3f24';
        ctx.fillRect(b.x - b.w / 2 - 3, r.y - 8, 3, r.h + 16);
        ctx.fillRect(b.x + b.w / 2, r.y - 8, 3, r.h + 16);
    }

    // ===== 10) ДЕРЕВНЯ В ЦЕНТРЕ (частокол, избы, церковь, колодец, дорожки) =====
    {
        const v = T.village;
        const vx = v.x - v.w / 2, vy = v.y - v.h / 2;
        // двор деревни
        ctx.fillStyle = '#c9b183';
        ctx.fillRect(vx, vy, v.w, v.h);
        // частокол: брёвна-зубчики по периметру, разрывы на севере/юге (тракт)
        ctx.strokeStyle = '#5a3f24';
        ctx.lineWidth = 3;
        ctx.strokeRect(vx + 2, vy + 2, v.w - 4, v.h - 4);
        ctx.fillStyle = '#5a3f24';
        for (let x = vx + 2; x < vx + v.w - 2; x += 6) {
            if (Math.abs(x - v.x) < 10) continue;         // разрыв — тракт
            ctx.fillRect(x - 1.2, vy - 2, 2.4, 5);        // северный ряд
            ctx.fillRect(x - 1.2, vy + v.h - 3, 2.4, 5);  // южный ряд
        }
        for (let y = vy + 2; y < vy + v.h - 2; y += 6) {
            ctx.fillRect(vx - 2, y - 1.2, 5, 2.4);        // западный ряд
            ctx.fillRect(vx + v.w - 3, y - 1.2, 5, 2.4);  // восточный ряд
        }
        // внутренние дорожки от ворот к церкви (деталь п.8)
        ctx.strokeStyle = 'rgba(122, 98, 62, 0.7)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(v.x, vy + 2);
        ctx.lineTo(v.x, v.y - 10);
        ctx.moveTo(v.x, v.y + 10);
        ctx.lineTo(v.x, vy + v.h - 2);
        ctx.moveTo(vx + 3, v.y);
        ctx.lineTo(v.x - 9, v.y);
        ctx.moveTo(vx + v.w - 3, v.y);
        ctx.lineTo(v.x + 9, v.y);
        ctx.stroke();
        // избы (шесть домов двумя рядами — деталь п.8)
        const houses = [
            [vx + 12, vy + 8], [vx + v.w - 24, vy + 8],
            [vx + 10, vy + v.h - 22], [vx + v.w - 26, vy + v.h - 22],
            [vx + 13, v.y - 5], [vx + v.w - 25, v.y - 5],
        ];
        houses.forEach(([hx, hy]) => {
            ctx.fillStyle = '#8a6a42';
            ctx.fillRect(hx, hy, 12, 9);
            ctx.fillStyle = '#7a3b2a';
            ctx.beginPath();
            ctx.moveTo(hx - 2, hy);
            ctx.lineTo(hx + 6, hy - 6);
            ctx.lineTo(hx + 14, hy);
            ctx.closePath();
            ctx.fill();
        });
        // колодец (деталь п.8): кружок с воротилом
        ctx.fillStyle = '#9a9a8e';
        ctx.beginPath();
        ctx.arc(vx + v.w - 12, v.y + 16, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a3f24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vx + v.w - 15, v.y + 14);
        ctx.lineTo(vx + v.w - 9, v.y + 14);
        ctx.stroke();
        // церковь в центре: сруб с башенкой и крестом
        ctx.fillStyle = '#d8d0c0';
        ctx.fillRect(v.x - 6, v.y - 8, 12, 14);
        ctx.fillStyle = '#5a7a8a';
        ctx.beginPath();
        ctx.moveTo(v.x - 8, v.y - 8);
        ctx.lineTo(v.x, v.y - 17);
        ctx.lineTo(v.x + 8, v.y - 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e8d8a0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y - 17);
        ctx.lineTo(v.x, v.y - 24);
        ctx.moveTo(v.x - 3.5, v.y - 21);
        ctx.lineTo(v.x + 3.5, v.y - 21);
        ctx.stroke();
    }

    // ===== 11) МЕЛЬНИЦА (66.40): рядом с пасекой — полянка между пасекой,
    // Южным Трактом и рекой =====
    {
        const m = T.mill;
        const mx = m.x, my = m.pathY;
        // полянка под мельницей (выбеливаем фон среди редких деревьев опушки)
        ctx.fillStyle = '#a9c383';
        ctx.beginPath();
        ctx.ellipse(mx, my + 2, 34, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        // сарай мельника (деталь п.8) — южнее мельницы
        ctx.fillStyle = '#8a6a42';
        ctx.fillRect(mx - 24, my + 14, 14, 9);
        ctx.fillStyle = '#5a3f24';
        ctx.beginPath();
        ctx.moveTo(mx - 26, my + 14);
        ctx.lineTo(mx - 17, my + 8);
        ctx.lineTo(mx - 8, my + 14);
        ctx.closePath();
        ctx.fill();
        // мешки зерна у сарая (деталь п.8)
        ctx.fillStyle = '#d9b95c';
        [[mx - 20, my + 27], [mx - 15, my + 28]].forEach(([bx, by]) => {
            ctx.beginPath();
            ctx.arc(bx, by, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a8862e';
            ctx.lineWidth = 0.7;
            ctx.stroke();
        });
        // башня мельницы
        ctx.fillStyle = '#8a6a42';
        ctx.beginPath();
        ctx.moveTo(mx - 7, my + 2);
        ctx.lineTo(mx - 4, my - 16);
        ctx.lineTo(mx + 4, my - 16);
        ctx.lineTo(mx + 7, my + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5a3f24';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#7a3b2a';
        ctx.beginPath();
        ctx.moveTo(mx - 5.5, my - 16);
        ctx.lineTo(mx, my - 21);
        ctx.lineTo(mx + 5.5, my - 16);
        ctx.closePath();
        ctx.fill();
        // крылья-крест
        ctx.strokeStyle = '#d8d0c0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx - 9, my - 24);
        ctx.lineTo(mx + 9, my - 10);
        ctx.moveTo(mx + 9, my - 24);
        ctx.lineTo(mx - 9, my - 10);
        ctx.stroke();
    }

    // ===== 12) ПАСЕКА (колодные ульи, пчёлы — деталь п.8) =====
    {
        const a = T.apiary;
        ctx.fillStyle = '#b8cf8a';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, a.rx, a.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        [[a.x - 16, a.y - 2], [a.x + 2, a.y - 8], [a.x + 14, a.y + 4], [a.x - 6, a.y + 8]].forEach(([ux, uy]) => {
            ctx.fillStyle = '#7a5a34';
            ctx.beginPath();
            ctx.ellipse(ux, uy, 6, 7.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a2a1a';
            ctx.fillRect(ux - 1.4, uy + 2, 2.8, 2.2);   // леток
            ctx.strokeStyle = '#5a3f24';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(ux - 5, uy - 1);
            ctx.lineTo(ux + 5, uy - 1);
            ctx.stroke();
        });
        // пчёлы-точки над ульями (деталь п.8)
        ctx.fillStyle = '#3a2a1a';
        for (let i = 0; i < 6; i++) {
            const bx = a.x - 20 + rnd() * 40, by = a.y - 14 - rnd() * 6;
            ctx.fillRect(bx, by, 1.3, 1.3);
        }
    }

    // ===== 13) ПОГОСТ (п.4): у лесной опушки — часовня, кресты, плетень =====
    {
        const p = T.pogost;
        ctx.fillStyle = '#9db877';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx + 8, p.ry + 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // плетень по кромке (деталь п.8)
        ctx.strokeStyle = '#7a5a34';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3.4, 2.6]);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx + 8, p.ry + 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // часовня
        ctx.fillStyle = '#8a6a42';
        ctx.fillRect(p.x - 6, p.y - 12, 12, 14);
        ctx.fillStyle = '#5a3f24';
        ctx.beginPath();
        ctx.moveTo(p.x - 8, p.y - 12);
        ctx.lineTo(p.x, p.y - 19);
        ctx.lineTo(p.x + 8, p.y - 12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e8d8a0';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 19);
        ctx.lineTo(p.x, p.y - 25);
        ctx.moveTo(p.x - 3, p.y - 22.5);
        ctx.lineTo(p.x + 3, p.y - 22.5);
        ctx.stroke();
        // ряды крестов
        ctx.strokeStyle = '#5a3f24';
        ctx.lineWidth = 1.4;
        [[-16, 2], [-8, 8], [12, 4], [18, 10], [-12, 13], [14, -3], [-4, -6]].forEach(([dx, dy]) => {
            const cx0 = p.x + dx, cy0 = p.y + dy;
            ctx.beginPath();
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(cx0, cy0 - 8);
            ctx.moveTo(cx0 - 2.6, cy0 - 5.8);
            ctx.lineTo(cx0 + 2.6, cy0 - 5.8);
            ctx.stroke();
        });
    }

    // ===== 14) Стрелка севера (компас) — в северо-западном углу =====
    // 66.34: озеро заняло верхний левый угол — компас смещён в юго-западный.
    {
        ctx.strokeStyle = '#6b4a2e';
        ctx.fillStyle = '#6b4a2e';
        ctx.lineWidth = 1.6;
        const cxx = 34, cyy = 500;
        ctx.beginPath();
        ctx.moveTo(cxx, cyy + 10);
        ctx.lineTo(cxx, cyy - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cxx, cyy - 14);
        ctx.lineTo(cxx - 4, cyy - 6);
        ctx.lineTo(cxx + 4, cyy - 6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cxx, cyy + 12, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

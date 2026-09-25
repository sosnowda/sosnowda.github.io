// Раунд 66.25 (приказы 5–8 владельца): ПЕРЕКОМПОНОВКА КАРТЫ МЕСТНОСТИ.
// Прежняя расстановка 66.24 (выпас/пасека/поле справа, погост слева) заменена
// по новой разметке владельца:
//   1. Центр карты — деревня, через неё проходит ТРАКТ: Северный Тракт —
//      от северного края карты до деревни, дальше на юг — Южный Тракт,
//      который упирается в РЕКУ и переходит её по МОСТУ.
//   2. СЛЕВА от деревни и вдоль Южного Тракта — Выпас, Пасека и Поле.
//   3. Справа от Южного Тракта и на всём свободном пространстве — ЛЕСА
//      цепочкой: Опушка (вход) → Лесная поляна → Густой лес (до реки).
//   4. Справа от Северного Тракта — ответвление дороги к МЕЛЬНИЦЕ И ПОГОСТУ
//      (ветка уходит на восток, к мельнице; грунтовый отросток — к погосту).
//   5. Справа от Северного Тракта — большая локация ОЗЕРО (66.24).
//   П.9: КО ВСЕМ ЛОКАЦИЯМ ведут дорожки от деревни или трактов — см.
//   TERRAIN_PATHS (грунтовые пунктирные тропы + ветка дороги).
//   П.8 «дорисовать детали»: стога на выпасе, борозды в поле, четвёртый улей
//   и пчёлы на пасеке, плетень и кресты на погосте, сарай у мельницы, утки и
//   камыши на озере, камыши у реки, верстовые камни вдоль тракта, колодец и
//   внутренние дорожки в деревне, ягоды на опушке, старый дуб на поляне.
// Модуль ЧИСТЫЙ (без Phaser и i18n): drawTerrainMap(ctx) рисует карту на
// 2D-контексте canvas-текстуры; ForkScene накладывает подписи (t()) и
// пульсирующую метку игрока. Все координаты — в системе 680×540.

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
    lake: { x: 558, y: 88, rx: 100, ry: 52 },      // большое озеро (справа от Сев. тракта)
    mill: { x: 485, y: 165, pathY: 165 },          // мельница + ответвление дороги (восток)
    pogost: { x: 395, y: 208 },                    // погост — отросток от ветки (справа от Сев. тракта)
    pasture: { x: 190, y: 300, rx: 52, ry: 30 },   // выпас — СЛЕВА от деревни
    apiary: { x: 175, y: 356, rx: 44, ry: 26 },    // пасека — слева, южнее
    field: { x: 190, y: 406, rx: 56, ry: 20 },     // поле — слева, у реки
    forestEdge: { x: 425, y: 296, rx: 54, ry: 30 },   // опушка — вход в лес (справа от Юж. тракта)
    forestGlade: { x: 540, y: 342, rx: 48, ry: 27 },  // лесная поляна
    forestDeep: { x: 548, y: 428, rx: 102, ry: 75 },  // густой лес (юго-восток, до реки)
};

// ===== ДОРОЖКИ (п.9): ко ВСЕЙ локации — от деревни или трактов =====
// kind: 'road' — песчаная дорога (ветка к мельнице/погосту),
//       'trail' — грунтовая тропа (пунктир).
export const TERRAIN_PATHS = [
    { to: 'pasture', kind: 'trail', x1: 293, y1: 300, x2: 244, y2: 300 },
    { to: 'apiary', kind: 'trail', x1: 293, y1: 356, x2: 221, y2: 356 },
    { to: 'field', kind: 'trail', x1: 293, y1: 406, x2: 248, y2: 406 },
    { to: 'forestEdge', kind: 'trail', x1: 307, y1: 308, x2: 377, y2: 302 },
    // лесная цепочка — рисуется кривыми (9в), в данных — для проверки покрытия
    { to: 'forestGlade', kind: 'trail', chain: true, x1: 471, y1: 304, x2: 496, y2: 336 },
    { to: 'forestDeep', kind: 'trail', chain: true, x1: 556, y1: 368, x2: 568, y2: 392 },
    { to: 'mill', kind: 'road', x1: 300, y1: 165, x2: 478, y2: 165 },
    { to: 'pogost', kind: 'road', x1: 395, y1: 165, x2: 395, y2: 190 },
    { to: 'lake', kind: 'trail', x1: 307, y1: 100, x2: 451, y2: 100 },
];

// ===== ПОДПИСИ КАРТЫ (ключи i18n; рисует ForkScene поверх текстуры) =====
export const TERRAIN_LABELS = [
    { key: 'village', text: 'Деревня', x: 218, y: 250 },
    { key: 'northTract', text: 'Северный Тракт', x: 300, y: 52 },
    { key: 'southTract', text: 'Южный Тракт', x: 300, y: 356 },
    { key: 'river', text: 'Река', x: 150, y: 457 },
    { key: 'bridge', text: 'Мост', x: 352, y: 470 },
    { key: 'lake', text: 'Озеро', x: 558, y: 88 },
    { key: 'mill', text: 'Мельница', x: 485, y: 138 },
    { key: 'pogost', text: 'Погост', x: 395, y: 236 },
    { key: 'pasture', text: 'Выпас', x: 190, y: 300 },
    { key: 'apiary', text: 'Пасека', x: 175, y: 356 },
    { key: 'field', text: 'Поле', x: 190, y: 406 },
    { key: 'forestEdge', text: 'Опушка', x: 425, y: 296 },
    { key: 'forestGlade', text: 'Лесная поляна', x: 540, y: 342 },
    { key: 'forestDeep', text: 'Густой лес', x: 548, y: 424 },
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

/** Стог сена: жёлтый полукруг со штрихами (деталь выпаса, п.8). */
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

/** Утка на воде: две дуги-галочки (деталь озера, п.8). */
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

/**
 * Рисует полноценную карту местности на 2D-контексте canvas.
 * Размер канвы — TERRAIN_W × TERRAIN_H.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawTerrainMap(ctx) {
    const W = TERRAIN_W, H = TERRAIN_H, F = TERRAIN_FRAME;
    const rnd = mulberry32(6625);
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

    // ===== 4) Поле (рожь): золотистый массив с БОРОЗДАМИ (деталь п.8) =====
    {
        const f = T.field;
        ctx.fillStyle = '#d9b95c';
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
        ctx.clip();
        // борозды — дуги рядами
        ctx.strokeStyle = '#b6923a';
        ctx.lineWidth = 1.1;
        for (let row = -2; row <= 2; row++) {
            const yy = f.y + row * (f.ry * 0.36);
            ctx.beginPath();
            ctx.moveTo(f.x - f.rx, yy);
            ctx.quadraticCurveTo(f.x, yy + 4, f.x + f.rx, yy);
            ctx.stroke();
        }
        // снопы
        for (let i = 0; i < 5; i++) {
            const sx = f.x - f.rx * 0.6 + i * f.rx * 0.3;
            const sy = f.y + (i % 2 ? 6 : -5);
            ctx.fillStyle = '#c4a23e';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#8a6a1e';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(sx - 1.6, sy + 2);
            ctx.lineTo(sx + 1.6, sy + 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ===== 5) Выпас: сочный луг, цветы и СТОГА (деталь п.8) =====
    {
        const p = T.pasture;
        ctx.fillStyle = '#8fbc62';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 110, 40, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 55; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd());
            const sx = p.x + Math.cos(ang) * rr * (p.rx - 5);
            const sy = p.y + Math.sin(ang) * rr * (p.ry - 4);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + 2, sy - 4);
            ctx.stroke();
        }
        // цветы
        for (let i = 0; i < 14; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd());
            const fx = p.x + Math.cos(ang) * rr * (p.rx - 8);
            const fy = p.y + Math.sin(ang) * rr * (p.ry - 6);
            ctx.fillStyle = rnd() < 0.5 ? '#f2f0d8' : '#e8c85a';
            ctx.beginPath();
            ctx.arc(fx, fy, 1.7, 0, Math.PI * 2);
            ctx.fill();
        }
        // стога сена (деталь п.8)
        drawHaystack(ctx, p.x - p.rx * 0.45, p.y + p.ry * 0.3, 6);
        drawHaystack(ctx, p.x + p.rx * 0.35, p.y - p.ry * 0.25, 5);
        // жердь-стойка у стога
        ctx.strokeStyle = '#6b4a2e';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.rx * 0.45, p.y + p.ry * 0.3);
        ctx.lineTo(p.x - p.rx * 0.45 + 3, p.y + p.ry * 0.3 - 9);
        ctx.stroke();
    }

    // ===== 6) ЛЕСА (цепочка): опушка → поляна → густой лес =====
    // 6а. Опушка — светлая, редкие деревья, ягодные кусты (деталь п.8)
    {
        const e = T.forestEdge;
        ctx.fillStyle = '#7fae5e';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 9; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd()) * 0.92;
            drawTree(ctx,
                e.x + Math.cos(ang) * rr * (e.rx - 8),
                e.y + Math.sin(ang) * rr * (e.ry - 6),
                4.5 + rnd() * 1.5, '#5f9448', '#3f6b34');
        }
        // ягоды-бусины
        for (let i = 0; i < 7; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd());
            const bx = e.x + Math.cos(ang) * rr * (e.rx - 10);
            const by = e.y + Math.sin(ang) * rr * (e.ry - 8);
            ctx.fillStyle = '#c4453c';
            ctx.beginPath();
            ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // 6б. Поляна — солнечный круг с цветами, кольцо деревьев и СТАРЫЙ ДУБ (п.8)
    {
        const g = T.forestGlade;
        ctx.fillStyle = '#9cc878';
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        // кольцо деревьев по кромке
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 + rnd() * 0.2;
            drawTree(ctx,
                g.x + Math.cos(ang) * (g.rx - 5),
                g.y + Math.sin(ang) * (g.ry - 4),
                4.5 + rnd() * 1.5, '#4f8140', '#33582a');
        }
        // цветы на поляне
        for (let i = 0; i < 16; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd());
            const fx = g.x + Math.cos(ang) * rr * (g.rx - 10);
            const fy = g.y + Math.sin(ang) * rr * (g.ry - 8);
            ctx.fillStyle = ['#f2f0d8', '#e8a0b4', '#e8c85a'][i % 3];
            ctx.beginPath();
            ctx.arc(fx, fy, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
        // старый дуб в середине поляны (деталь п.8)
        drawTree(ctx, g.x + 2, g.y + 6, 7.5, '#3f6b34', '#28451f');
    }
    // 6в. Густой лес — тёмная чаща на юго-востоке (до самой реки)
    {
        const d = T.forestDeep;
        ctx.fillStyle = '#3f6b34';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(d.x - d.rx * 0.45, d.y - d.ry * 0.35, d.rx * 0.62, d.ry * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(d.x + d.rx * 0.4, d.y + d.ry * 0.3, d.rx * 0.6, d.ry * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        // плотные кроны
        for (let i = 0; i < 46; i++) {
            const ang = rnd() * Math.PI * 2;
            const rr = Math.sqrt(rnd()) * 0.94;
            const tx = d.x + Math.cos(ang) * rr * (d.rx - 9);
            const ty = d.y + Math.sin(ang) * rr * (d.ry - 8);
            if (ty > T.river.y - 8) continue; // не сажаем в реку
            drawTree(ctx, tx, ty, 4 + rnd() * 2, '#2f5526', '#1f3a1a');
        }
        // грибочки на просвете (деталь п.8)
        for (let i = 0; i < 4; i++) {
            const mx = d.x - d.rx * 0.3 + i * 9, my = d.y - d.ry * 0.2 + (i % 2) * 8;
            ctx.fillStyle = '#e8dcc4';
            ctx.fillRect(mx, my, 1.4, 3);
            ctx.fillStyle = '#b06a3a';
            ctx.beginPath();
            ctx.arc(mx + 0.7, my, 2.4, Math.PI, 0);
            ctx.fill();
        }
    }

    // ===== 7) ОЗЕРО — большая вода справа от Северного Тракта =====
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

    // ===== 8) РЕКА — лента через южный край (Южный Тракт упирается в неё) =====
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
    // 9б. ВЕТКА ДОРОГИ к мельнице + отросток к погосту (справа от Сев. тракта)
    {
        const m = T.mill;
        const branchY = m.pathY;
        // основная ветка: тракт → мельница
        ctx.fillStyle = '#c2a878';
        ctx.fillRect(T.tractX, branchY - 4.5, m.x - T.tractX, 9);
        ctx.strokeStyle = '#8a744e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(T.tractX, branchY - 4.5);
        ctx.lineTo(m.x, branchY - 4.5);
        ctx.moveTo(T.tractX, branchY + 4.5);
        ctx.lineTo(m.x, branchY + 4.5);
        ctx.stroke();
        // колея на ветке
        ctx.strokeStyle = 'rgba(120, 96, 60, 0.5)';
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(T.tractX + 4, branchY);
        ctx.lineTo(m.x - 6, branchY);
        ctx.stroke();
        ctx.setLineDash([]);
        // отросток к погосту (п.7): юг от ветки
        const sp = TERRAIN_PATHS.find(p => p.to === 'pogost');
        ctx.fillStyle = '#c2a878';
        ctx.fillRect(sp.x1 - 3.5, branchY + 4, 7, sp.y2 - branchY - 4);
        ctx.strokeStyle = '#8a744e';
        ctx.beginPath();
        ctx.moveTo(sp.x1 - 3.5, branchY + 4.5);
        ctx.lineTo(sp.x1 - 3.5, sp.y2);
        ctx.moveTo(sp.x1 + 3.5, branchY + 4.5);
        ctx.lineTo(sp.x1 + 3.5, sp.y2);
        ctx.stroke();
    }
    // 9в. Грунтовые тропы (п.9): ко ВСЕЙ локациям — пунктиром
    {
        ctx.strokeStyle = '#8a744e';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        TERRAIN_PATHS.filter(p => p.kind === 'trail' && !p.chain).forEach(p => {
            ctx.beginPath();
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
        });
        // цепочка леса продолжается тропами между локациями
        ctx.beginPath();
        ctx.moveTo(T.forestEdge.x + T.forestEdge.rx - 8, T.forestEdge.y + 6);
        ctx.quadraticCurveTo(505, 316, T.forestGlade.x - T.forestGlade.rx + 6, T.forestGlade.y + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(T.forestGlade.x + 14, T.forestGlade.y + T.forestGlade.ry - 2);
        ctx.quadraticCurveTo(580, 372, T.forestDeep.x + 20, T.forestDeep.y - T.forestDeep.ry * 0.4);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // 9г. МОСТ Южного Тракта через реку
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

    // ===== 11) МЕЛЬНИЦА (ветряная: башня + крылья) и САРАЙ (деталь п.8) =====
    {
        const m = T.mill;
        const mx = m.x, my = m.pathY;
        // сарай мельника (деталь п.8) — левее мельницы
        ctx.fillStyle = '#8a6a42';
        ctx.fillRect(mx - 30, my - 4, 14, 9);
        ctx.fillStyle = '#5a3f24';
        ctx.beginPath();
        ctx.moveTo(mx - 32, my - 4);
        ctx.lineTo(mx - 23, my - 10);
        ctx.lineTo(mx - 14, my - 4);
        ctx.closePath();
        ctx.fill();
        // мешки зерна у сарая (деталь п.8)
        ctx.fillStyle = '#d9b95c';
        [[mx - 27, my + 8], [mx - 22, my + 9]].forEach(([bx, by]) => {
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

    // ===== 13) ПОГОСТ (часовня, кресты, ПЛЕТЕНЬ — деталь п.8) =====
    {
        const p = T.pogost;
        ctx.fillStyle = '#9db877';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 44, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        // плетень по кромке (деталь п.8)
        ctx.strokeStyle = '#7a5a34';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3.4, 2.6]);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 44, 26, 0, 0, Math.PI * 2);
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
        [[-30, 0], [-20, 7], [18, 3], [28, 9], [-24, 14], [22, 17], [-8, 16]].forEach(([dx, dy]) => {
            const cx0 = p.x + dx, cy0 = p.y + dy;
            ctx.beginPath();
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(cx0, cy0 - 9);
            ctx.moveTo(cx0 - 3, cy0 - 6.5);
            ctx.lineTo(cx0 + 3, cy0 - 6.5);
            ctx.stroke();
        });
    }

    // ===== 14) Стрелка севера (компас) — в северо-западном углу =====
    {
        ctx.strokeStyle = '#6b4a2e';
        ctx.fillStyle = '#6b4a2e';
        ctx.lineWidth = 1.6;
        const cxx = 34, cyy = 40;
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

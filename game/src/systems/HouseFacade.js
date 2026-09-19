// HouseFacade.js — РАУНД 60 (п.2 приказа владельца): ЦЕЛЬНЫЕ ДОМА.
//
// Прежние фасады wood_house_*/rural_house_* были вырезками из чужих
// тайлсетов: у БОЛЬШОЙ ЧАСТИ домов обрезаны крыши (одни стены),
// боковины или трубы. Владелец приказал переделать так, чтобы КАЖДЫЙ
// дом выглядел цельным: ВСЕ стены + ЦЕЛАЯ крыша.
//
// Решение: процедурная отрисовка фасадов на CanvasTexture (как воротня
// village_gate_r57) — собранная из НАСТОЯЩИХ тайлов игры (wall_log,
// wall_plank, wall_stone, roof_thatch, roof_wood, roof_tile).
// Фасад — фронтальный, со свесами крыши ЗА стенами, полным основанием,
// дверью, окнами, трубой и крыльцом. Ничего не обрезано: контур дома
// целиком внутри текстуры.
//
// Перерисовываются 9 домов с битыми вырезками; сохранены по приказам
// прежних раундов: постоялый двор (wood_house_02, раунд 55), дом старосты
// (wood_house_08), кузница (house3d_blacksmith), церковь, butcher
// (rurald_house_1), рыбацкий/сапожный (rural_house_0), лавка (rural_shop_1).

// Размер текстуры (2× от отображаемой области 152×150 — чёткость при даунскейле)
const TEX_W = 304;
const TEX_H = 300;

// Геометрия фасада (в координатах текстуры 304×300)
const CX = TEX_W / 2;          // ось симметрии
const RIDGE_Y = 10;            // конёк крыши
const EAVES_Y = 134;           // линия свесов (низ крыши)
const WALL_TOP = 130;          // верх стен (под свесами)
const WALL_BOTTOM = 266;       // низ стен
const FOUND_TOP = 246;         // верх каменного фундамента
const GROUND_Y = 272;          // земля (низ дома)
const WALL_L = 20;             // левая стена
const WALL_R = TEX_W - 20;     // правая стена
const ROOF_HALF = TEX_W / 2 - 2; // полупролёт крыши у свесов (свес ~9px при 1×)

/** Смешение цветов (0..1) */
function lerpC(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16)
        | (Math.round(ag + (bg - ag) * t) << 8)
        | Math.round(ab + (bb - ab) * t);
}

/** Полупролёт крыши на высоте y */
function roofHalfAt(y) {
    const t = Math.max(0, Math.min(1, (y - RIDGE_Y) / (EAVES_Y - RIDGE_Y)));
    return 10 + (ROOF_HALF - 10) * t;
}

/**
 * Собрать ЦЕЛЬНЫЙ фасад дома (CanvasTexture).
 * @param {Phaser.Scene} scene
 * @param {string} key — ключ текстуры (phouse_*)
 * @param {Object} spec — параметры фасада (см. HOUSE_SPECS)
 */
export function drawHouseFacade(scene, key, spec) {
    if (scene.textures.exists(key)) return key;
    if (!scene.textures.exists('roof_thatch') || !scene.textures.exists('wall_log')) return null;

    const ct = scene.textures.createCanvas(key, TEX_W, TEX_H);
    if (!ct) return null;
    const ctx = ct.getContext();
    const img = (k) => scene.textures.get(k).getSourceImage();
    const pat = (k) => ctx.createPattern(img(k), 'repeat');

    const roofKind = spec.roof || 'thatch';
    const wallKind = spec.wall || 'log';

    // ============ 1. ФУНДАМЕНТ (камень) ============
    ctx.save();
    ctx.beginPath();
    ctx.rect(WALL_L - 4, FOUND_TOP, (WALL_R - WALL_L) + 8, GROUND_Y - FOUND_TOP);
    ctx.clip();
    ctx.fillStyle = pat('wall_stone');
    ctx.fillRect(WALL_L - 4, FOUND_TOP, (WALL_R - WALL_L) + 8, GROUND_Y - FOUND_TOP);
    ctx.fillStyle = 'rgba(20, 14, 8, 0.45)';
    ctx.fillRect(WALL_L - 4, FOUND_TOP, (WALL_R - WALL_L) + 8, GROUND_Y - FOUND_TOP);
    ctx.restore();
    // Верхняя кромка фундамента (свет)
    ctx.fillStyle = '#6a625a';
    ctx.fillRect(WALL_L - 4, FOUND_TOP, (WALL_R - WALL_L) + 8, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(WALL_L - 4, GROUND_Y - 2, (WALL_R - WALL_L) + 8, 2);

    // ============ 2. СТЕНЫ ============
    const wallH = WALL_BOTTOM - WALL_TOP;
    if (wallKind === 'log') {
        // Сруб: горизонтальные брёвна + выпуски углов (круглые торцы)
        ctx.fillStyle = pat('wall_log');
        ctx.fillRect(WALL_L, WALL_TOP, WALL_R - WALL_L, wallH);
        const logH = 14;
        for (let y = WALL_TOP; y < WALL_BOTTOM; y += logH) {
            ctx.fillStyle = 'rgba(255, 220, 160, 0.22)';           // верх бревна — свет
            ctx.fillRect(WALL_L, y + 1, WALL_R - WALL_L, 3);
            ctx.fillStyle = 'rgba(30, 18, 6, 0.5)';                // шов — тень
            ctx.fillRect(WALL_L, y + logH - 3, WALL_R - WALL_L, 3);
        }
        // Торцы брёвен по углам (выпуски сруба)
        for (let y = WALL_TOP + 4; y < WALL_BOTTOM - 4; y += logH) {
            [WALL_L + 7, WALL_R - 7].forEach((x) => {
                ctx.fillStyle = '#8a6a42';
                ctx.beginPath(); ctx.arc(x, y + 3, 6.5, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#3a2610'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = 'rgba(255,225,170,0.35)';
                ctx.beginPath(); ctx.arc(x - 1.5, y + 1.5, 2.4, 0, Math.PI * 2); ctx.fill();
            });
        }
    } else if (wallKind === 'plank') {
        // Тёс: вертикальные доски
        ctx.fillStyle = pat('wall_plank');
        ctx.fillRect(WALL_L, WALL_TOP, WALL_R - WALL_L, wallH);
        for (let x = WALL_L + 9; x < WALL_R; x += 18) {
            ctx.fillStyle = 'rgba(30, 18, 6, 0.42)';
            ctx.fillRect(x, WALL_TOP, 2, wallH);
            ctx.fillStyle = 'rgba(255, 225, 170, 0.18)';
            ctx.fillRect(x + 2, WALL_TOP, 2, wallH);
        }
        // Прибойные доски-горизонтали сверху и снизу
        ctx.fillStyle = 'rgba(40, 26, 10, 0.4)';
        ctx.fillRect(WALL_L, WALL_TOP + 4, WALL_R - WALL_L, 4);
        ctx.fillRect(WALL_L, WALL_BOTTOM - 10, WALL_R - WALL_L, 4);
    } else {
        // Побелка с деревянным каркасом (светлые дома слободы)
        ctx.fillStyle = spec.wallFill || '#ddd0b4';
        ctx.fillRect(WALL_L, WALL_TOP, WALL_R - WALL_L, wallH);
        // лёгкая каменная крапинка побелки
        for (let i = 0; i < 220; i++) {
            const x = WALL_L + ((i * 97 + 31) % (WALL_R - WALL_L));
            const y = WALL_TOP + ((i * 53 + 17) % wallH);
            ctx.fillStyle = i % 3 ? 'rgba(120,100,70,0.10)' : 'rgba(255,255,240,0.16)';
            ctx.fillRect(x, y, 2, 2);
        }
        const beam = '#5a4028';
        ctx.fillStyle = beam;
        ctx.fillRect(WALL_L, WALL_TOP, WALL_R - WALL_L, 7);                 // верхний венец
        ctx.fillRect(WALL_L, WALL_BOTTOM - 8, WALL_R - WALL_L, 8);          // нижний венец
        ctx.fillRect(WALL_L, WALL_TOP, 7, wallH);                           // угловые стойки
        ctx.fillRect(WALL_R - 7, WALL_TOP, 7, wallH);
        for (let x = WALL_L + 78; x < WALL_R - 20; x += 78) {               // промежуточные стойки
            ctx.fillRect(x, WALL_TOP, 6, wallH);
        }
        // Раскосы
        ctx.strokeStyle = beam; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(WALL_L + 7, WALL_TOP + 46); ctx.lineTo(WALL_L + 78, WALL_BOTTOM - 8);
        ctx.moveTo(WALL_R - 78, WALL_BOTTOM - 8); ctx.lineTo(WALL_R - 7, WALL_TOP + 46);
        ctx.stroke();
    }
    // Тень под свесами крыши
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(WALL_L, WALL_TOP, WALL_R - WALL_L, 7);

    // ============ 3. КРЫША (двускатная, СО СВЕСАМИ, цельная) ============
    const roofTex = roofKind === 'thatch' ? 'roof_thatch'
        : roofKind === 'tile' ? 'roof_tile' : 'roof_wood';
    const rp = pat(roofTex);
    if (spec.roofTint) {
        // тонированный вариант: рисуем во временной канве и умножаем
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(CX, RIDGE_Y - 6);
        ctx.lineTo(CX + ROOF_HALF + 2, EAVES_Y);
        ctx.lineTo(CX - ROOF_HALF - 2, EAVES_Y);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = rp;
        ctx.fillRect(0, 0, TEX_W, EAVES_Y + 4);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = spec.roofTint;
        ctx.fillRect(0, 0, TEX_W, EAVES_Y + 4);
        ctx.restore();
    } else {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(CX, RIDGE_Y - 6);
        ctx.lineTo(CX + ROOF_HALF + 2, EAVES_Y);
        ctx.lineTo(CX - ROOF_HALF - 2, EAVES_Y);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = rp;
        ctx.fillRect(0, 0, TEX_W, EAVES_Y + 4);
        ctx.restore();
    }
    // Ряды кровли: свет сверху, тень снизу + фактура
    const rowH = 13;
    for (let y = RIDGE_Y + 4; y < EAVES_Y; y += rowH) {
        const half = roofHalfAt(y + rowH / 2);
        ctx.fillStyle = 'rgba(255, 230, 170, 0.13)';
        ctx.fillRect(CX - half, y, half * 2, 3);
        ctx.fillStyle = 'rgba(25, 14, 4, 0.34)';
        ctx.fillRect(CX - half, y + rowH - 3, half * 2, 3);
        // вертикальные швы дранки/черепицы — вразбежку
        if (roofKind !== 'thatch') {
            const off = (Math.floor((y - RIDGE_Y) / rowH) % 2) * 12;
            for (let x = CX - half + off; x < CX + half; x += 24) {
                ctx.fillStyle = 'rgba(25, 14, 4, 0.30)';
                ctx.fillRect(x, y, 2, rowH - 3);
            }
        } else {
            // солома: короткие штрихи-стебли (детерминированные)
            for (let i = 0; i < half / 5; i++) {
                const x = CX - half + ((i * 37 + y * 13) % (half * 2 - 6)) + 3;
                ctx.fillStyle = i % 2 ? 'rgba(255, 214, 130, 0.30)' : 'rgba(90, 58, 16, 0.30)';
                ctx.fillRect(x, y + 2 + ((i * 7) % 6), 2, 7);
            }
        }
    }
    // Конёк — тёмный охват + вид сверху
    ctx.fillStyle = roofKind === 'thatch' ? '#4a3410' : '#33200e';
    ctx.fillRect(CX - 13, RIDGE_Y - 7, 26, 9);
    ctx.fillStyle = 'rgba(255,230,170,0.25)';
    ctx.fillRect(CX - 13, RIDGE_Y - 7, 26, 2);
    // Свесы (нижний край крыши) — теневая кромка и капельники
    ctx.fillStyle = 'rgba(15, 8, 2, 0.55)';
    ctx.fillRect(CX - ROOF_HALF - 2, EAVES_Y - 4, (ROOF_HALF + 2) * 2, 5);
    ctx.fillStyle = '#241505';
    ctx.fillRect(CX - ROOF_HALF - 2, EAVES_Y + 1, (ROOF_HALF + 2) * 2, 2);
    // Подсвеченный край свесов
    ctx.fillStyle = 'rgba(255, 220, 150, 0.16)';
    ctx.fillRect(CX - ROOF_HALF - 2, EAVES_Y - 6, (ROOF_HALF + 2) * 2, 2);

    // ============ 4. ТРУБА (цельная, стоит на скате) ============
    if (spec.chimney) {
        const chX = CX + 62;
        const slopeY = RIDGE_Y + (EAVES_Y - RIDGE_Y) * ((chX - CX) / ROOF_HALF);
        const chTop = Math.max(6, slopeY - 34);
        const chW = 26;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';                       // тень трубы на крыше
        ctx.fillRect(chX - 2, slopeY - 6, chW + 8, 8);
        ctx.fillStyle = pat('wall_stone');                        // кладка
        ctx.fillRect(chX, chTop, chW, slopeY - chTop + 10);
        ctx.fillStyle = 'rgba(30, 22, 14, 0.30)';
        ctx.fillRect(chX, chTop, chW, slopeY - chTop + 10);
        // швы кладки
        ctx.strokeStyle = 'rgba(20,14,8,0.6)'; ctx.lineWidth = 1;
        for (let y = chTop + 8; y < slopeY + 8; y += 9) {
            ctx.beginPath(); ctx.moveTo(chX, y); ctx.lineTo(chX + chW, y); ctx.stroke();
        }
        // Шапка и дымовое отверстие
        ctx.fillStyle = '#57493c';
        ctx.fillRect(chX - 4, chTop - 8, chW + 8, 9);
        ctx.fillStyle = '#2a2019';
        ctx.fillRect(chX + 4, chTop - 6, chW - 8, 5);
        ctx.fillStyle = 'rgba(255,220,150,0.2)';
        ctx.fillRect(chX - 4, chTop - 8, chW + 8, 2);
    }

    // ============ 5. ОКНА (со ставнями/наличниками, тёплый свет) ============
    const drawWindow = (wx, wy, opts = {}) => {
        const w = 34, h = 40;
        // наличник
        ctx.fillStyle = '#4a3418';
        ctx.fillRect(wx - 3, wy - 3, w + 6, h + 6);
        // проём — тёплое свечение изнутри
        const grd = ctx.createLinearGradient(0, wy, 0, wy + h);
        grd.addColorStop(0, '#2c2012');
        grd.addColorStop(0.55, '#5a3f1c');
        grd.addColorStop(1, '#8a5c26');
        ctx.fillStyle = grd;
        ctx.fillRect(wx, wy, w, h);
        ctx.fillStyle = 'rgba(255, 200, 110, 0.30)';
        ctx.fillRect(wx + 4, wy + 4, w - 8, h - 8);
        // переплёт
        ctx.fillStyle = '#3a2812';
        ctx.fillRect(wx + w / 2 - 2, wy, 4, h);
        ctx.fillRect(wx, wy + h / 2 - 2, w, 4);
        // ставни
        if (opts.shutters) {
            ctx.fillStyle = opts.shutters;
            ctx.fillRect(wx - 13, wy - 1, 11, h + 2);
            ctx.fillRect(wx + w + 2, wy - 1, 11, h + 2);
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(wx - 13, wy - 1, 11, 3);
            ctx.fillRect(wx + w + 2, wy - 1, 11, 3);
            ctx.fillStyle = 'rgba(255,235,190,0.16)';
            ctx.fillRect(wx - 11, wy + 4, 2, h - 6);
            ctx.fillRect(wx + w + 4, wy + 4, 2, h - 6);
        }
        // подоконник
        ctx.fillStyle = '#6a5a44';
        ctx.fillRect(wx - 6, wy + h + 3, w + 12, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(wx - 6, wy + h + 8, w + 12, 2);
        // ящик с цветами
        if (opts.flowers) {
            ctx.fillStyle = '#5a4028';
            ctx.fillRect(wx - 4, wy + h + 10, w + 8, 11);
            ctx.fillStyle = '#2f2114';
            ctx.fillRect(wx - 4, wy + h + 19, w + 8, 2);
            const cols = ['#d84a3a', '#e8b23a', '#e05a8a', '#f0e0a0'];
            for (let i = 0; i < 7; i++) {
                ctx.fillStyle = cols[i % cols.length];
                ctx.beginPath();
                ctx.arc(wx + 4 + ((i * 13) % (w - 4)), wy + h + 8 + (i % 2), 3.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#4a7a34';
            ctx.fillRect(wx - 2, wy + h + 7, w + 4, 3);
        }
    };

    // Позиции окон по спецификации: {x: 0..1 доля стены, y: 'wall'|'attic', ...}
    (spec.windows || []).forEach((wd) => {
        if (wd.y === 'attic') {
            // чердачное окошко ВНУТРИ щипца
            const ay = WALL_TOP - 34;
            const half = roofHalfAt(ay) - 16;
            const ax = Math.max(WALL_L + 8, Math.min(WALL_R - 40, CX + (wd.x - 0.5) * 2 * half - 17));
            drawWindow(ax, ay, { shutters: wd.shutters });
        } else {
            const wx = WALL_L + 6 + (WALL_R - WALL_L - 46) * Math.max(0, Math.min(1, wd.x));
            drawWindow(wx, WALL_TOP + (wd.top ? 18 : 56), wd);
        }
    });

    // ============ 6. ДВЕРЬ ============
    const doorW = 46, doorH = 68;
    const doorBaseX = spec.doorX === 'left' ? WALL_L + 26
        : spec.doorX === 'right' ? WALL_R - 26 - doorW
        : CX - doorW / 2;
    const doorY = WALL_BOTTOM - doorH - 6;
    // крыльцо: столбы и кровелька
    if (spec.porch) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(doorBaseX - 16, doorY - 2, doorW + 32, 6);
        ctx.fillStyle = '#5a4028';
        ctx.fillRect(doorBaseX - 14, doorY - 30, 7, 34);
        ctx.fillRect(doorBaseX + doorW + 7, doorY - 30, 7, 34);
        // мини-крыльцо-навес дранкой
        ctx.fillStyle = pat('roof_wood');
        ctx.fillRect(doorBaseX - 18, doorY - 40, doorW + 36, 12);
        ctx.fillStyle = 'rgba(20,10,2,0.45)';
        ctx.fillRect(doorBaseX - 18, doorY - 31, doorW + 36, 3);
        ctx.fillStyle = '#3a2812';
        ctx.fillRect(doorBaseX - 18, doorY - 42, doorW + 36, 3);
    }
    // наличник двери
    ctx.fillStyle = '#33240f';
    ctx.fillRect(doorBaseX - 5, doorY - 5, doorW + 10, doorH + 5);
    // дверное полотно — вертикальные доски
    const doorPat = pat('wall_plank');
    ctx.save();
    ctx.beginPath(); ctx.rect(doorBaseX, doorY, doorW, doorH); ctx.clip();
    ctx.fillStyle = doorPat;
    ctx.fillRect(doorBaseX, doorY, doorW, doorH);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = spec.doorColor || '#7a5230';
    ctx.fillRect(doorBaseX, doorY, doorW, doorH);
    ctx.restore();
    // сквозные вертикальные швы полотна
    for (let x = doorBaseX + 11; x < doorBaseX + doorW; x += 11) {
        ctx.fillStyle = 'rgba(25,14,4,0.5)';
        ctx.fillRect(x, doorY, 2, doorH);
    }
    // резной орнамент (мастерская гончара)
    if (spec.carvedDoor) {
        ctx.strokeStyle = '#caa14a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(doorBaseX + doorW / 2, doorY + 22, 12, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
        ctx.strokeRect(doorBaseX + doorW / 2 - 8, doorY + 34, 16, 14);
    }
    // кованые петли и ручка
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(doorBaseX + 4, doorY + 16, 16, 4);
    ctx.fillRect(doorBaseX + 4, doorY + 44, 16, 4);
    ctx.beginPath(); ctx.arc(doorBaseX + doorW - 9, doorY + 36, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a14a'; ctx.fill();
    ctx.strokeStyle = '#3a2c10'; ctx.lineWidth = 1; ctx.stroke();
    // порог и ступени
    ctx.fillStyle = '#6a625a';
    ctx.fillRect(doorBaseX - 8, WALL_BOTTOM + 4, doorW + 16, 7);
    ctx.fillStyle = '#55504a';
    ctx.fillRect(doorBaseX - 8, WALL_BOTTOM + 11, doorW + 16, 4);

    // ============ 7. Тень на земле ============
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(WALL_L - 6, GROUND_Y, (WALL_R - WALL_L) + 12, 3);

    ct.refresh();
    return key;
}

// ============================================================
// СПЕЦИФИКАЦИИ 9 ЦЕЛЬНЫХ ДОМОВ (перерисовка битых вырезок)
// ============================================================
export const HOUSE_SPECS = {
    // Дом Авдея-крестьянина (была wood_house_03 — стены без крыши)
    phouse_avdey: {
        wall: 'log', roof: 'wood',
        doorX: 'center',
        windows: [{ x: 0.16, shutters: '#5a6a3a' }, { x: 0.72, shutters: '#5a6a3a' }],
        attic: false, chimney: true, porch: false,
    },
    // Дом Марфы (была wood_house_01 — крыша с обрезанными боками)
    phouse_marfa: {
        wall: 'log', roof: 'thatch',
        doorX: 'left',
        windows: [{ x: 0.62, shutters: '#7a4a3a', flowers: true }, { x: 0.12, y: 'attic' }],
        attic: true, chimney: false, porch: false,
    },
    // Дом пахаря Тараса (была wood_house_10 — стены без крыши)
    phouse_pahar: {
        wall: 'log', roof: 'thatch',
        doorX: 'left',
        windows: [{ x: 0.66, flowers: true }, { x: 0.24, flowers: true }],
        attic: false, chimney: true, porch: false,
    },
    // Дом знахарки (была wood_house_00 — осколок крыши с трубой)
    phouse_healer: {
        wall: 'plank', roof: 'thatch',
        doorX: 'right',
        windows: [{ x: 0.18, shutters: '#4a6a4a', flowers: true }, { x: 0.16, y: 'attic' }],
        attic: true, chimney: false, porch: false,
    },
    // Дом гончара (была wood_house_09 — обрубленная труба в углу)
    phouse_potter: {
        wall: 'plaster', wallFill: '#d8c9a8', roof: 'thatch',
        doorX: 'center', carvedDoor: true,
        windows: [{ x: 0.14 }, { x: 0.78 }],
        attic: false, chimney: true, porch: false,
    },
    // Дом плотника (была wood_house_11 — стены без крыши)
    phouse_carpenter: {
        wall: 'plank', roof: 'tile', roofTint: '#b08a6a',
        doorX: 'left',
        windows: [{ x: 0.68, shutters: '#8a6a30' }, { x: 0.2, y: 'attic' }],
        attic: true, chimney: false, porch: true,
    },
    // Дом ткачихи (была wood_house_07 — крыша обрезана справа)
    phouse_weaver: {
        wall: 'log', roof: 'thatch',
        doorX: 'center', porch: true,
        windows: [{ x: 0.14, shutters: '#6a4a6a', flowers: true }, { x: 0.78, shutters: '#6a4a6a', flowers: true }],
        attic: false, chimney: false, porch: true,
    },
    // Изба дровосека (была rural_house_1 — узкая щепка с трубой)
    phouse_drovosek: {
        wall: 'log', roof: 'wood', roofTint: '#8a7460',
        doorX: 'right',
        windows: [{ x: 0.2 }],
        attic: false, chimney: true, porch: false,
    },
    // Дом Прасковьи-снедницы (была rurald_house_0 — срезанная труба)
    phouse_praskovya: {
        wall: 'plaster', roof: 'thatch',
        doorX: 'center', doorColor: '#4a6a8a',
        windows: [{ x: 0.12, shutters: '#4a6a8a' }, { x: 0.8, shutters: '#4a6a8a' }],
        attic: false, chimney: true, porch: false,
    },
};

/**
 * Собрать все цельные фасады (вызывать из BootScene.create, когда тайлы
 * wall_* / roof_* уже загружены). Возвращает список собранных ключей.
 */
export function buildHouseFacades(scene) {
    const built = [];
    Object.entries(HOUSE_SPECS).forEach(([key, spec]) => {
        if (drawHouseFacade(scene, key, spec)) built.push(key);
    });
    if (built.length) {
        console.log(`[Дом] Собрано цельных фасадов: ${built.length}/${Object.keys(HOUSE_SPECS).length}`);
    }
    return built;
}

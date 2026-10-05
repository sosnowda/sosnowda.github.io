#!/usr/bin/env python3
# r86 патч 3: ФАСАДЫ — деревянные дымницы вместо каменных труб
# Русь XV века: курные избы (топились по-чёрному) — дым выходил через
# дымницу (деревянный дымник-короб с отверстием в кровле), каменных
# печных труб на крестьянских и большинстве городских домов НЕ БЫЛО.
#
# Алгоритм: бокс трубы стирается, кровля достраивается:
#   mode 'auto'   — силуэт по референс-колонкам (первый непрозрачный пиксель),
#                   заливка полосой НИЖЕ бокса (тянутся вверх, зеркальный тайл)
#   mode 'hshift' — горизонтальный клон-шифт (для бревна/теса с горизонтальными
#                   или вертикальными рядами) — бесшовно по рядам
# Поверх рисуется деревянная дымница (дощатый короб + двускатный козырёк
# + тёмное отверстие), в housesFX.js затем идут её координаты дыма.
from PIL import Image, ImageDraw
import os, math

REPO = '/home/z/my-project/sosnowda.github.io'
OUT = '/home/z/my-project/download/r86_probe'

# ---------- helpers ----------

def first_opaque_y(px, x, h, y_from=0):
    for y in range(max(0, y_from), h):
        if px[x, y][3] > 40:
            return y
    return h

def edge_func(im, box, refs, y0, pts=None):
    """Силуэт: либо МНК по колонкам, либо явная ломаная [(x,y),...]."""
    if pts:
        pts = sorted(pts)
        def ef(x):
            if x <= pts[0][0]: return pts[0][1]
            if x >= pts[-1][0]: return pts[-1][1]
            for i in range(len(pts) - 1):
                xa, ya = pts[i]; xb, yb = pts[i + 1]
                if xa <= x <= xb:
                    return ya + (yb - ya) * (x - xa) / max(1, (xb - xa))
            return pts[-1][1]
        return ef
    px = im.load()
    pts = []
    for x in refs:
        x = max(0, min(im.width - 1, x))
        pts.append((x, first_opaque_y(px, x, im.height)))
    if len(pts) == 1:
        return lambda x: pts[0][1]
    # МНК-прямая по точкам
    n = len(pts)
    sx = sum(p[0] for p in pts); sy = sum(p[1] for p in pts)
    sxx = sum(p[0] * p[0] for p in pts); sxy = sum(p[0] * p[1] for p in pts)
    d = n * sxx - sx * sx
    if d == 0:
        return lambda x: sy / n
    k = (n * sxy - sx * sy) / d
    b = (sy - k * sx) / n
    return lambda x: k * x + b

def erase_box(im, box, mode='auto', refs=None, pts=None, dx=0, dy=0, K=56, edge_dark=None):
    x0, y0, x1, y1 = box
    px = im.load()
    W, H = im.size
    if mode == 'auto':
        ef = edge_func(im, box, refs or [x0 - 2, x1 + 2], y0, pts=pts)
    else:
        ef = lambda x: y0
    donor_mode = (mode == 'donor' or bool(pts))
    for x in range(x0, x1):
        ye = int(round(ef(x)))
        ye = max(ye, 0)
        for y in range(y0, y1):
            if y < ye:
                px[x, y] = (0, 0, 0, 0)          # фон над силуэтом
                continue
            if mode == 'hshift':
                sx = x + dx
                px[x, y] = px[sx, y]
            elif donor_mode:
                # прямоугольник-донор (dx,dy) той же ширины, вертикально
                # с зеркальным тайлингом через K строк
                seg = (y - y0) % (2 * K)
                if seg >= K: seg = 2 * K - seg
                px[x, y] = px[x - x0 + dx, dy + seg]
            else:
                # полоса ниже бокса, тянется вверх с зеркальным тайлингом
                span = y1 - ye
                off = (y1 - y)                    # 1..span
                seg = off % (2 * K)
                if seg >= K: seg = 2 * K - seg    # зеркало
                seg = max(1, seg)
                sy = y1 - 1 + seg                 # источник: y1..y1+K
                sy = min(sy, H - 1)
                px[x, y] = px[x, sy]
    # тёмная кромка по силуэту (стиль пака)
    if mode == 'auto' and edge_dark:
        for x in range(x0, x1):
            ye = int(round(ef(x)))
            if y0 <= ye < y1 - 1:
                px[x, ye] = edge_dark
                r, g, b, a = px[x, ye + 1]
                px[x, ye + 1] = (r // 2, g // 2, b // 2, a)

def blend_px(px, x, y, rgb, k):
    r, g, b, a = px[x, y]
    px[x, y] = (int(r * (1 - k) + rgb[0] * k),
                int(g * (1 - k) + rgb[1] * k),
                int(b * (1 - k) + rgb[2] * k), a)

def draw_dymnitsa(im, cx, base_y, w=24, h=22, big=False):
    """Деревянная дымница: дощатый короб, тёмное отверстие, двускатный козырёк."""
    px = im.load()
    W, H = im.size
    dark  = (30, 21, 11, 255)
    oak   = (96, 70, 40, 255)
    oak_d = (72, 51, 28, 255)
    oak_l = (126, 96, 58, 255)
    hole  = (14, 9, 4, 255)
    cap_c = (84, 60, 34, 255)
    cap_l = (138, 106, 64, 255)
    cap_d = (58, 41, 22, 255)
    x0 = cx - w // 2
    body_top = base_y - h
    # контактная тень на кровле
    for x in range(x0 - 2, x0 + w + 2):
        if 0 <= x < W and 0 <= base_y < H:
            blend_px(px, x, base_y, (0, 0, 0), 0.35)
    # корпус — слегка расширяющийся книзу дощатый короб
    for yy in range(body_top + 6, base_y):
        t = (yy - body_top - 6) / max(1, h - 6)
        wi = w - 6 + int(round(5 * t))
        a = cx - wi // 2
        for x in range(a, a + wi):
            c = oak
            if (x - a) % 6 == 5:
                c = oak_d                       # шов между досками
            if x >= a + wi - max(2, wi // 4):
                c = oak_d if (x - a) % 6 != 5 else dark   # теневая сторона
            if 0 <= x < W and 0 <= yy < H:
                px[x, yy] = c
            if x == a and 0 <= x < W:
                px[x, yy] = oak_l               # светлая кромка
    # тёмное отверстие под козырьком
    for yy in range(body_top + 6, body_top + 11):
        for x in range(x0 + 3, x0 + w - 4):
            if 0 <= x < W and 0 <= yy < H:
                px[x, yy] = hole
    # подпалина над отверстием (козья ножка — след дыма)
    for yy in range(body_top + 3, body_top + 6):
        for x in range(cx - 3, cx + 4):
            if 0 <= x < W:
                blend_px(px, x, yy, (10, 7, 3), 0.4)
    # двускатный козырёк (плоский, с широким свесом)
    peak = body_top - 3 if not big else body_top - 5
    cap_bot = body_top + 7
    for yy in range(peak, cap_bot):
        t = (yy - peak) / max(1, cap_bot - peak)
        half = 2 + int(round(t * (w // 2 + 3)))
        for x in range(cx - half, cx + half + 1):
            if not (0 <= x < W and 0 <= yy < H):
                continue
            if yy == peak:
                c = cap_l
            elif x >= cx:
                c = cap_d
            else:
                c = cap_c
            px[x, yy] = c
    # контур
    for yy in range(peak, base_y):
        t = (yy - peak) / max(1, cap_bot - peak)
        half = (1 + int(round(t * (w // 2 + 3)))) if yy < cap_bot else None
        if half:
            for x in (cx - half, cx + half):
                if 0 <= x < W and 0 <= yy < H and px[x, yy][3]:
                    blend_px(px, x, yy, (0, 0, 0), 0.25)
    return (cx, body_top + 8)   # точка дыма (центр отверстия)

# ---------- конфигурация по домам ----------
# (текстура, [(бокс, mode, refs, dx, K, edge_dark, дымница(cx, base, w, h, big))])
DARK_THATCH = (46, 33, 16, 255)
DARK_SHING  = (34, 22, 10, 255)
DARK_LOG    = (30, 19, 9, 255)

JOBS = [
    ('fb_elder', [
        dict(box=(100, 14, 156, 96), mode='auto', refs=[97, 159, 163], edge=DARK_THATCH,
             dym=(126, 70, 26, 24, False)),
        dict(box=(148, 0, 236, 92), mode='auto',
             pts=[(140, 30), (178, 58), (236, 26)], dx=240, dy=24, K=56,
             edge=DARK_THATCH, dym=(185, 54, 26, 24, False)),
    ]),
    ('fb_inn', [
        dict(box=(2, 58, 113, 218), mode='donor', dx=115, dy=25, K=60,
             refs=[0, 1, 115, 116], edge=DARK_THATCH,
             dym=(148, 104, 28, 26, False)),
    ]),
    ('fb_smithy', [
        dict(box=(56, 0, 108, 128), mode='hshift', dx=-54, edge=None,
             dym=(82, 122, 30, 42, True)),
    ]),
    ('fb_manor', [
        dict(box=(12, 0, 80, 98), mode='donor', dx=120, dy=0, K=85,
             refs=[9, 84, 88], edge=DARK_THATCH,
             dym=(44, 88, 24, 24, False)),
    ]),
    ('fb_log_big', [
        dict(box=(160, 0, 218, 110), mode='auto', refs=[150, 155, 219], edge=DARK_SHING,
             dym=(186, 98, 24, 24, False)),
    ]),
    ('fb_thatch_big', [
        dict(box=(156, 14, 199, 96), mode='donor', dx=68, dy=0, K=60,
             refs=[156, 203], edge=DARK_THATCH,
             dym=(179, 78, 26, 26, False)),
    ]),
    ('fb_thatch_small', [
        dict(box=(154, 0, 202, 100), mode='donor', dx=40, dy=0, K=88,
             refs=[134, 144, 152], edge=DARK_THATCH,
             dym=(178, 92, 24, 26, False)),
    ]),
    ('fb_log_flowers', [
        dict(box=(28, 0, 52, 24), mode='auto', refs=[24, 56, 58], edge=DARK_LOG,
             dym=(40, 30, 22, 20, False)),
        dict(box=(131, 0, 167, 82), mode='hshift', dx=-70, edge=None,
             dym=(148, 84, 26, 26, False)),
    ]),
    ('fb_log_thatch', [
        dict(box=(124, 0, 168, 78), mode='hshift', dx=-46, edge=None,
             dym=(146, 80, 24, 24, False)),
    ]),
    ('fb_tudor_fl', [
        dict(box=(10, 0, 64, 62), mode='auto', refs=[6, 67, 69], edge=DARK_SHING,
             dym=(36, 62, 24, 24, False)),
    ]),
    ('fb_tudor_sm', [
        dict(box=(82, 0, 136, 102), mode='auto', refs=[78, 139, 142], edge=DARK_SHING,
             dym=(102, 50, 24, 24, False)),
    ]),
]

# ---------- выполнение ----------
report = []
for name, jobs in JOBS:
    p = f'{REPO}/game/assets/sprites/{name}.png'
    im = Image.open(p).convert('RGBA')
    smokes = []
    for j in jobs:
        erase_box(im, j['box'], mode=j['mode'], refs=j.get('refs'), pts=j.get('pts'),
                  dx=j.get('dx', 0), dy=j.get('dy', 0),
                  K=j.get('K', 56), edge_dark=j.get('edge'))
        cx, base, w, h, big = j['dym']
        s = draw_dymnitsa(im, cx, base, w, h, big)
        smokes.append(list(s))
    im.save(p)
    report.append((name, smokes))
    print(name, '→ smoke', smokes)

# контрольный лист «после»
fbs = [r[0] for r in report]
cell = 480; cols = 4
rows = (len(fbs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows * cell), (40, 44, 52))
d = ImageDraw.Draw(sheet)
for i, name in enumerate(fbs):
    im = Image.open(f'{REPO}/game/assets/sprites/{name}.png').convert('RGBA')
    bg = Image.new('RGBA', im.size, (168, 178, 190, 255))
    bg.alpha_composite(im)
    s = min((cell - 40) / im.width, (cell - 60) / im.height, 2.0)
    im2 = bg.resize((int(im.width * s), int(im.height * s)), Image.NEAREST)
    x = (i % cols) * cell; y = (i // cols) * cell
    sheet.paste(im2.convert('RGB'), (x + 20, y + 40))
    d.text((x + 8, y + 8), name, fill=(255, 220, 120))
sheet.save(f'{OUT}/facades_after.png')
print('sheet saved')

#!/usr/bin/env python3
"""
66.29 п.2/п.3: ремонт 18 запечённых фонов интерьеров.
Дефекты: «щитовые» столы чистого top-down, сломанные куски мебели, комоды/этажерки
посреди комнаты, мусор, ковёр на лавке. Ремонт: fill чистым полом из той же картинки
+ штамп хорошей мебели (альфа-маска по цвету + мягкая тень).
Результат: game/assets/interiors_repaired/ (проверка глазами -> замена оригиналов).
"""
from PIL import Image, ImageFilter
import numpy as np
import os

D = '/home/z/my-project/sosnowda-site/game/assets/interiors'
OUT = '/home/z/my-project/sosnowda-site/game/assets/interiors_repaired'
TMP = '/tmp/int_audit'
os.makedirs(OUT, exist_ok=True)

# ---------- доноры ----------
src_elder = Image.open(f'{D}/int_bg_elder_house.jpg').convert('RGB')

def make_alpha(crop, thr=42, dilate=5, blur=1.2, exclude=()):
    """Альфа-маска по цветовой дистанции от медианы углов (пол)."""
    a = np.asarray(crop).astype(int)
    corners = np.concatenate([
        a[:12, :12].reshape(-1, 3), a[:12, -12:].reshape(-1, 3),
        a[-12:, :12].reshape(-1, 3), a[-12:, -12:].reshape(-1, 3),
    ])
    med = np.median(corners, axis=0)
    dist = np.sqrt(((a - med) ** 2).sum(axis=2))
    mask = (dist > thr).astype(np.uint8) * 255
    m = Image.fromarray(mask).filter(ImageFilter.MaxFilter(dilate)).filter(ImageFilter.MinFilter(dilate))
    m = np.asarray(m).copy()
    # фильтр связных компонент: шум пола (мелкие острова) отсекаем
    import cv2
    n, labels, stats, _ = cv2.connectedComponentsWithStats((m > 0).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 400:
            m[labels == i] = 0
    for (ex0, ey0, ex1, ey1) in exclude:
        m[ey0:ey1, ex0:ex1] = 0
    soft = Image.fromarray(m).filter(ImageFilter.GaussianBlur(blur))
    rgba = crop.convert('RGBA')
    rgba.putalpha(soft)
    return rgba

def make_shadow(w, h, cy_k=0.86, rx_k=0.42, ry_k=0.10, alpha=105):
    sd = np.zeros((h, w, 4), dtype=np.uint8)
    cy, cx = int(h * cy_k), w // 2
    ry, rx = max(4, int(h * ry_k)), max(6, int(w * rx_k))
    yy, xx = np.mgrid[0:h, 0:w]
    ell = (((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2) <= 1
    sd[ell, 3] = alpha
    return Image.fromarray(sd)

# 1) ХОРОШИЙ СТОЛ (староста, 430..690 x 400..515), исключаем тёмный блоб снизу
# пол старосты — узор с вариацией > порога, поэтому высокий порог + компоненты
table = make_alpha(src_elder.crop((430, 400, 690, 515)), thr=52,
                   exclude=[(135, 78, 220, 115)])
table_shadow = make_shadow(260, 115)

# 2) КОМОД top-down (beekeeper 760..860 x 205..272)
bee = Image.open(f'{D}/int_bg_beekeeper_house.jpg').convert('RGB')
dresser = make_alpha(bee.crop((758, 203, 862, 274)), thr=40)
dresser_shadow = make_shadow(104, 71, cy_k=0.92, rx_k=0.40, ry_k=0.12, alpha=90)

# 3) ЧИСТЫЙ КОВЁР (fisher 495..585 x 505..585)
fisher = Image.open(f'{D}/int_bg_fisher_house.jpg').convert('RGB')
rug = make_alpha(fisher.crop((492, 502, 588, 588)), thr=34, dilate=7, blur=1.0)
rug_shadow = make_shadow(96, 86, cy_k=0.5, rx_k=0.48, ry_k=0.48, alpha=0)

# 4) ЭТАЖЕРКА-СТОЙКА (butcher 790..910 x 265..332)
but = Image.open(f'{D}/int_bg_butcher_house.jpg').convert('RGB')
sideboard = make_alpha(but.crop((786, 261, 914, 336)), thr=40)
sideboard_shadow = make_shadow(128, 75, cy_k=0.92, rx_k=0.44, ry_k=0.12, alpha=90)

# 5) ПОЛКА таверны (915..1035 x 275..337)
tav = Image.open(f'{D}/int_bg_tavern.jpg').convert('RGB')
shelf_t = make_alpha(tav.crop((911, 271, 1039, 341)), thr=40)
shelf_shadow = make_shadow(128, 70, cy_k=0.92, rx_k=0.44, ry_k=0.12, alpha=90)

DONORS = {
    'table': (table, table_shadow),
    'dresser': (dresser, dresser_shadow),
    'rug': (rug, rug_shadow),
    'sideboard': (sideboard, sideboard_shadow),
    'shelf': (shelf_t, shelf_shadow),
}

# ---------- операции ----------
def fill_tile(img, x0, y0, x1, y1, sx0, sy0):
    """Залить прямоугольник (x0..x1, y0..y1) плиткой пола из (sx0, sy0)."""
    w, h = x1 - x0, y1 - y0
    patch = img.crop((sx0, sy0, sx0 + min(w, 260), sy0 + min(h, 260)))
    pw, ph = patch.size
    canvas = Image.new('RGB', (w, h))
    for ty in range(0, h, ph):
        for tx in range(0, w, pw):
            canvas.paste(patch, (tx, ty))
    img.paste(canvas, (x0, y0))

def fill_wall(img, x0, y0, x1, y1, sx0, sy0):
    fill_tile(img, x0, y0, x1, y1, sx0, sy0)

def stamp(img, donor, cx, bottom, scale=1.0, shadow=True):
    spr, sh = DONORS[donor]
    w = int(spr.width * scale); h = int(spr.height * scale)
    spr2 = spr.resize((w, h), Image.LANCZOS)
    px, py = int(cx - w / 2), int(bottom - h)
    if shadow and sh.getextrema()[3][1] > 0:
        sh2 = sh.resize((w, h), Image.LANCZOS)
        img.paste(sh2, (px, py), sh2)
    img.paste(spr2, (px, py), spr2)

REPAIR = {
    'int_bg_beekeeper_house.jpg': [
        ('fill', 755, 200, 865, 280, 940, 240),      # комод (переносим к стене)
        ('fill', 755, 292, 865, 345, 940, 370),      # лавка под комодом
        ('stamp', 'dresser', 810, 192, 1.0),
        ('fill', 445, 375, 640, 615, 230, 340),      # щитовой стол + обломок + ковёр
        ('stamp', 'table', 540, 585, 0.9),
        ('stamp', 'rug', 640, 590, 1.0),
    ],
    'int_bg_blacksmith.jpg': [
        ('fill', 590, 305, 648, 352, 590, 360),      # парящая доска
        ('fill', 405, 282, 505, 362, 405, 380),      # верстак-щит
        ('stamp', 'table', 455, 360, 0.55),
    ],
    'int_bg_butcher_house.jpg': [
        ('fill', 485, 318, 700, 492, 250, 460),      # щитовой стол + обломок + палочка
        ('stamp', 'table', 590, 490, 0.9),
        ('fill', 785, 258, 918, 338, 640, 450),      # этажерка посреди комнаты
        ('stamp', 'sideboard', 940, 192, 1.0),       # к стене (свободный сегмент 830..1060)
    ],
    'int_bg_carpenter_house.jpg': [
        ('fill', 432, 352, 532, 432, 300, 455),      # верстак-щит
        ('stamp', 'table', 482, 430, 0.55),
        ('fill', 518, 448, 590, 505, 520, 512),      # обломок
        ('fill', 755, 230, 865, 312, 940, 240),      # комод (к стене)
        ('fill', 755, 315, 865, 368, 940, 370),      # лавка
        ('stamp', 'dresser', 810, 192, 1.0),
    ],
    'int_bg_fisher_house.jpg': [
        ('fill', 755, 200, 865, 280, 940, 240),      # комод (к стене)
        ('fill', 755, 292, 865, 345, 940, 370),      # лавка
        ('stamp', 'dresser', 810, 192, 1.0),
        ('fill', 470, 345, 668, 500, 245, 340),      # щитовой стол + обломок
        ('stamp', 'table', 535, 498, 0.9),
    ],
    'int_bg_grocer_house.jpg': [
        ('fill', 440, 368, 692, 540, 245, 390),      # top-down стол со стульями + лавка
        ('stamp', 'table', 565, 540, 0.95),
    ],
    'int_bg_healer_house.jpg': [
        ('fill', 410, 322, 628, 502, 200, 340),      # стол + обломок + лавка
        ('stamp', 'table', 490, 500, 0.9),
    ],
    'int_bg_potter_house.jpg': [
        ('fill', 712, 262, 862, 342, 900, 425),      # этажерка (к стене)
        ('stamp', 'sideboard', 880, 192, 1.0),
        ('fill', 495, 388, 705, 518, 230, 390),      # стол + обломок
        ('stamp', 'table', 590, 515, 0.9),
    ],
    'int_bg_shoemaker_house.jpg': [
        ('fill', 428, 296, 508, 365, 340, 375),      # маленький верстак
        ('stamp', 'table', 468, 360, 0.5),
        ('fill', 488, 338, 682, 528, 245, 390),      # стол + обломок
        ('stamp', 'table', 555, 522, 0.95),
    ],
    'int_bg_shop_tools.jpg': [
        ('fill', 468, 156, 652, 186, 470, 100),      # парящие инструменты (часть на стене)
        ('fill', 468, 186, 652, 194, 470, 200),      # (часть на полу)
        ('fill', 748, 110, 842, 162, 860, 112),      # синие предметы на стене
        ('fill', 486, 298, 628, 462, 650, 345),      # щитовой стол с тарелкой
        ('stamp', 'table', 555, 458, 0.95),
    ],
    'int_bg_tavern.jpg': [
        ('fill', 422, 332, 558, 478, 770, 275),      # щитовой стол 1
        ('fill', 628, 322, 742, 462, 780, 430),      # щитовой стол 2
        ('stamp', 'table', 487, 478, 1.0),
        ('stamp', 'table', 735, 462, 0.9),
        ('fill', 908, 268, 1042, 342, 770, 275),     # полка посреди комнаты
        ('fill', 828, 123, 858, 190, 735, 125),      # свеча на стене (под полкой)
        ('fill', 922, 148, 952, 190, 735, 150),      # крюк на стене
        ('stamp', 'shelf', 870, 190, 1.0),
    ],
    'int_bg_villager_house_1.jpg': [
        ('fill', 755, 228, 865, 310, 660, 230),      # комод (к стене)
        ('fill', 755, 315, 865, 368, 660, 370),      # лавка
        ('stamp', 'dresser', 810, 192, 1.0),
        ('fill', 468, 368, 682, 522, 245, 390),      # стол + обломок
        ('fill', 450, 515, 628, 628, 230, 340),      # ковёр НА лавке
        ('stamp', 'table', 555, 520, 0.95),
        ('stamp', 'rug', 555, 615, 1.0),
    ],
    'int_bg_villager_house_2.jpg': [
        ('fill', 748, 268, 882, 338, 760, 400),      # этажерка (к стене)
        ('stamp', 'sideboard', 880, 192, 1.0),
        ('fill', 505, 355, 720, 508, 900, 420),      # стол + обломок
        ('stamp', 'table', 610, 508, 0.9),
    ],
    'int_bg_villager_house_3.jpg': [
        ('fill', 755, 228, 865, 310, 660, 230),
        ('fill', 755, 315, 865, 368, 660, 370),
        ('stamp', 'dresser', 810, 192, 1.0),
        ('fill', 468, 368, 682, 522, 245, 390),
        ('fill', 450, 515, 628, 628, 230, 340),
        ('stamp', 'table', 555, 520, 0.95),
        ('stamp', 'rug', 555, 615, 1.0),
    ],
    'int_bg_weaver_house.jpg': [
        ('fill', 393, 428, 618, 582, 620, 430),      # стол + обломок
        ('stamp', 'table', 505, 577, 0.9),
    ],
    'int_bg_woodcutter_house.jpg': [
        ('fill', 598, 352, 818, 518, 900, 440),      # стол + обломок
        ('stamp', 'table', 700, 517, 0.9),
    ],
    'int_bg_elder_house.jpg': [
        ('fill', 1188, 562, 1248, 648, 1128, 562),   # мусор в правом нижнем углу
        ('fill', 568, 472, 648, 512, 480, 472),      # тёмный блоб под столом
    ],
}

for name, ops in REPAIR.items():
    img = Image.open(f'{D}/{name}').convert('RGB')
    for op in ops:
        if op[0] == 'fill':
            _, x0, y0, x1, y1, sx, sy = op
            fill_tile(img, x0, y0, x1, y1, sx, sy)
        elif op[0] == 'stamp':
            _, donor, cx, bottom, scale = op
            stamp(img, donor, cx, bottom, scale)
    img.save(f'{OUT}/{name}', quality=88)
    print('ok', name)
print('ГОТОВО:', len(REPAIR), 'фонов ->', OUT)

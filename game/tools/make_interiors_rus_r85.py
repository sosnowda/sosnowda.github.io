# -*- coding: utf-8 -*-
"""
Раунд 66.85 (приказ владельца 3): ИСТОРИЧЕСКАЯ РЕСТАВРАЦИЯ ИНТЕРЬЕРОВ —
соответствие фактам Руси XV века.

Найденные анахронизмы (западноевропейский пак Medieval):
  1. КАМЕННЫЙ КАМИН во всех 16 домах — на Руси XV в. топили ГЛИНОБИТНОЙ
     ПЕЧЬЮ (по-чёрному или с дымницей); камины с каминным дымоходом —
     западная реалия. Заменяем на русскую печь: белёная глина, устье с
     огнём (совмещено с живым огнём сцены (130,392)), подпечек, ухват.
  2. ГЕРБОВЫЕ ЩИТЫ со львами (таверна, кузница) — дворянская геральдика
     на Руси не употреблялась (с XVII в. лишь при царе). Заменяем:
     таверна — связка лука; кузница — стену чистим.
  3. РЫЦАРСКИЙ ЛАТНЫЙ ДОСПЕХ на подставке (кузница) — полный латный
     доспех в деревенской кузнице Руси невозможен. Заменяем на КОЛЬЧУГУ
     на вешале (кольчуга — основная защита Руси XV в.).
  4. НАПОЛЬНЫЕ ЧАСЫ, КОМОД, ЗЕРКАЛО-ТУАЛЕТ (дом старосты) — мебель
     XVIII-XIX вв. Заменяем: открытый постав с горшками, сундук, кадка.
  5. КАРТИНЫ В РАМАХ (староста, крестьянин, сапожник, снедница) —
     светских картин в избах не было; стены украшали ОБРАЗА в киотах
     (красный угол) и рушники. Заменяем на киот с иконой.
  6. ПЕРСИДСКИЕ КОВРЫ в крестьянских избах — авто-детект красных ковров
     (кроме дома старосты: волок зажиточного хозяина оставлен) →
     плетёная рогожка/дорожка.
  7. КОМНАТНЫЕ ЦВЕТЫ В ГОРШКАХ (знахарка, гончар) — не для Руси XV в.
     (окно с геранью — XIX в.). Заменяем пучками сушёных трав.
  8. ЧУГУННЫЙ КОТЁЛ (таверна) — чугун пришёл в XVI-XVII вв.; тонирование
     котла в МЕДЬ (медные котлы/братины — историчны).

Живой огонь сцены рисуется на (130, h*0.545) — устье печи рисуем так,
чтобы центр пламени совпал. Свет (x=90) остаётся в теле печи.

Запуск: python3 game/tools/make_interiors_rus_r85.py
"""
import os
import random
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
INT = os.path.join(HERE, '..', 'assets', 'interiors')
rnd = random.Random(6685)

# ---------------------------------------------------------------- утилиты
def patch_floor(im, box, src_dx):
    """Замазать область копией пола/стены из той же y-полосы (сохраняет
    горизонтальные линии полов и вертикальные доски стен)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    src_x = x0 + src_dx
    if src_x < 0 or src_x + w > im.width:
        src_x = x0 - src_dx
    strip = im.crop((src_x, y0, src_x + w, y1))
    im.paste(strip, (x0, y0))


def add_grain(im, box, amt=7):
    """Слегка зашуметь область, чтобы заплатка не читалась идеально ровной."""
    x0, y0, x1, y1 = box
    px = im.load()
    for y in range(max(0, y0), min(im.height, y1)):
        for x in range(max(0, x0), min(im.width, x1)):
            r, g, b = px[x, y][:3]
            d = rnd.randint(-amt, amt)
            px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))


# ---------------------------------------------------------------- печь
def draw_pech(im, fx=10, fy=145, fw=228, fh=305):
    """Русская глинобитная печь на месте прежнего камина.
    Устье с огнём — центр (fx+120, fy+247) ≈ (130,392) экрана (живой огонь)."""
    d = ImageDraw.Draw(im)
    x0, y0 = fx, fy
    x1, y1 = fx + fw, fy + fh

    # тень на полу справа
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(shadow)
    ds.ellipse([x1 - 30, y1 - 22, x1 + 40, y1 + 8], fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    im.paste(Image.alpha_composite(im.convert('RGBA'), shadow).convert('RGB'), (0, 0))
    d = ImageDraw.Draw(im)

    # --- ПОДПЕЧЕК (нижний ярус из валунов/брёвен на глине) ---
    base_top = y1 - 42
    d.rectangle([x0 + 6, base_top, x1 - 10, y1], fill=(84, 62, 38))
    for ly in range(base_top + 6, y1 - 2, 9):
        d.line([(x0 + 8, ly), (x1 - 12, ly)], fill=(62, 46, 28), width=2)
    for vx in range(x0 + 16, x1 - 12, 26):     # вертикальные торцы колотых брёвен
        d.line([(vx, base_top + 3), (vx, y1 - 3)], fill=(74, 54, 32), width=3)

    # --- ТЕЛО ПЕЧИ: белёная глина, горкой ---
    body = (229, 221, 201)
    body_dk = (203, 194, 173)
    body_sh = (183, 173, 152)
    # основной массив — скруглённый
    d.rounded_rectangle([x0, y0 + 26, x1 - 14, base_top + 14], radius=34, fill=body)
    # перекрыша (верхняя плита) чуть шире
    d.rounded_rectangle([x0 + 4, y0, x1 - 24, y0 + 40], radius=16, fill=body)
    # правая тень (свет слева-сверху)
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.rounded_rectangle([x1 - 74, y0 + 30, x1 - 12, base_top + 16], radius=30, fill=(70, 60, 45, 60))
    sh = sh.filter(ImageFilter.GaussianBlur(9))
    im.paste(Image.alpha_composite(im.convert('RGBA'), sh).convert('RGB'), (0, 0))
    d = ImageDraw.Draw(im)
    # потёки и пятна глины
    for _ in range(90):
        gx = rnd.randint(x0 + 10, x1 - 30)
        gy = rnd.randint(y0 + 12, base_top + 4)
        r = rnd.randint(2, 7)
        col = rnd.choice([body_dk, body_sh, (214, 205, 184)])
        d.ellipse([gx, gy, gx + r, gy + max(2, r - 2)], fill=col)

    # --- ЗАГНЕТКА И УСТЬЕ (арка с огнём) ---
    mouth_cx, mouth_cy = x0 + 120, y0 + 250        # ≈ (130,392)
    mw, mh = 62, 52
    d.ellipse([mouth_cx - mw, mouth_cy - mh, mouth_cx + mw, mouth_cy + mh], fill=body_dk)
    d.ellipse([mouth_cx - mw + 7, mouth_cy - mh + 5, mouth_cx + mw - 7, mouth_cy + mh - 5],
              fill=(64, 50, 38))
    d.ellipse([mouth_cx - mw + 12, mouth_cy - mh + 10, mouth_cx + mw - 12, mouth_cy + mh - 8],
              fill=(38, 29, 22))
    # сажа вокруг устья
    for _ in range(60):
        gx = mouth_cx + rnd.randint(-mw - 24, mw + 24)
        gy = mouth_cy + rnd.randint(-mh - 14, mh + 8)
        r = rnd.randint(1, 4)
        d.ellipse([gx, gy, gx + r, gy + r], fill=(150, 140, 122))

    # огонь в устье
    d.ellipse([mouth_cx - 34, mouth_cy - 14, mouth_cx + 34, mouth_cy + 30], fill=(214, 108, 32))
    d.ellipse([mouth_cx - 24, mouth_cy - 2, mouth_cx + 24, mouth_cy + 26], fill=(244, 168, 52))
    d.ellipse([mouth_cx - 12, mouth_cy + 8, mouth_cx + 12, mouth_cy + 22], fill=(252, 216, 108))
    # дрова в устье
    d.line([(mouth_cx - 28, mouth_cy + 20), (mouth_cx + 30, mouth_cy + 14)], fill=(58, 40, 24), width=5)
    d.line([(mouth_cx - 30, mouth_cy + 10), (mouth_cx + 26, mouth_cy + 22)], fill=(74, 52, 30), width=4)

    # --- УХВАТ и КОЧЕРГА прислонены к печи ---
    d.line([(x1 - 6, y1 - 6), (x1 - 30, y1 - 120)], fill=(96, 68, 38), width=5)
    d.ellipse([x1 - 36, y1 - 138, x1 - 16, y1 - 116], outline=(96, 68, 38), width=5)
    d.line([(x0 - 2, y1 - 4), (x0 - 14, y1 - 90)], fill=(84, 58, 34), width=4)

    # --- заслонка у печи ---
    d.ellipse([x0 + 152, base_top - 20, x0 + 200, base_top + 26], fill=(140, 96, 52))
    d.ellipse([x0 + 160, base_top - 12, x0 + 192, base_top + 18], outline=(108, 72, 38), width=3)


# ---------------------------------------------------------------- киот с иконой
def draw_kiot(im, x, y):
    """Киот с иконой в красный угол (замена картине): тёмная доска,
    золотой оклад, образ (силуэт), сверху рушник."""
    d = ImageDraw.Draw(im)
    # тёмная доска киота
    d.rectangle([x, y, x + 54, y + 66], fill=(58, 40, 24))
    d.rectangle([x + 3, y + 3, x + 51, y + 63], fill=(74, 52, 30))
    # золотой оклад
    d.rectangle([x + 9, y + 9, x + 45, y + 57], fill=(184, 148, 70))
    d.rectangle([x + 13, y + 13, x + 41, y + 53], fill=(112, 86, 48))
    # образ: тёмный фон, нимб, лик-силуэт
    d.rectangle([x + 15, y + 15, x + 39, y + 51], fill=(60, 44, 30))
    d.ellipse([x + 21, y + 17, x + 33, y + 29], fill=(196, 164, 88))
    d.ellipse([x + 23, y + 19, x + 31, y + 27], fill=(222, 196, 130))
    d.rectangle([x + 23, y + 32, x + 31, y + 48], fill=(94, 72, 46))
    d.rectangle([x + 22, y + 44, x + 32, y + 49], fill=(52, 38, 26))
    # рушник сверху (белый с красной каймой)
    d.rectangle([x - 4, y - 10, x + 58, y - 2], fill=(226, 220, 206))
    d.rectangle([x - 4, y - 12, x + 58, y - 10], fill=(168, 52, 40))
    d.rectangle([x - 4, y - 2, x + 58, y], fill=(168, 52, 40))


# ---------------------------------------------------------------- рогожка
def draw_mat(im, x, y, w=96, h=84):
    """Плетёная рогожка-дорожка (замена восточному ковру)."""
    d = ImageDraw.Draw(im)
    base, dark = (172, 160, 126), (148, 136, 104)
    d.rectangle([x, y, x + w, y + h], fill=base)
    for sy in range(y + 2, y + h - 2, 7):
        for sx in range(x + 2, x + w - 2, 7):
            if ((sx // 7) + (sy // 7)) % 2 == 0:
                d.rectangle([sx, sy, sx + 5, sy + 5], fill=dark)
    # обтрёпанные края
    d.rectangle([x, y, x + w, y + 3], fill=dark)
    d.rectangle([x, y + h - 3, x + w, y + h], fill=dark)


# ---------------------------------------------------------------- постав
def draw_shelf_pots(im, x, y, w=118, h=140):
    """Открытый постав-полка с глиняными горшками (замена шкафу/комоду).
    Горшки СТОЯТ на полках (днище касается доски)."""
    d = ImageDraw.Draw(im)
    wood, wood_dk = (122, 86, 48), (90, 62, 34)

    def pot(px, base_y, pr):
        py = base_y - pr          # центр: днище на доске
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(138, 92, 58))
        d.ellipse([px - pr + 2, py - pr + 2, px + pr - 2, py + pr - 2], fill=(158, 108, 66))
        d.rectangle([px - pr + 3, py - pr - 4, px + pr - 3, py - pr + 2], fill=(108, 70, 42))

    # верхняя доска + горшки НА ней
    d.rectangle([x, y, x + w, y + 8], fill=wood_dk)
    d.rectangle([x + 2, y + 8, x + w - 2, y + 12], fill=wood)
    for px, pr in ((x + 22, 11), (x + 48, 9), (x + 70, 12), (x + 96, 8)):
        pot(px, y, pr)
    # нижняя доска + горшки НА ней
    y2 = y + h // 2
    d.rectangle([x, y2, x + w, y2 + 8], fill=wood)
    d.rectangle([x + 2, y2 - 4, x + w - 2, y2], fill=wood_dk)
    for px, pr in ((x + 28, 10), (x + 60, 13), (x + 94, 9)):
        pot(px, y2, pr)
    # стойки после горшков (края)
    d.rectangle([x + 2, y + 8, x + 8, y + h], fill=wood_dk)
    d.rectangle([x + w - 8, y + 8, x + w - 2, y + h], fill=wood_dk)


# ---------------------------------------------------------------- сундук / кадка
def draw_chest(im, x, y, w=84, h=56):
    """Деревянный сундук с коваными полосами."""
    d = ImageDraw.Draw(im)
    wood, wood_dk = (116, 80, 44), (86, 58, 32)
    d.rounded_rectangle([x, y, x + w, y + h], radius=8, fill=wood)
    d.rounded_rectangle([x, y, x + w, y + h // 3], radius=8, fill=(132, 92, 52))
    d.rectangle([x + 6, y + 2, x + w - 6, y + 5], fill=wood_dk)
    for sx in (x + w // 4, x + 3 * w // 4):
        d.rectangle([sx - 4, y, sx + 4, y + h], fill=(92, 92, 96))
    d.rectangle([x + 2, y + h - 8, x + w - 2, y + h - 4], fill=wood_dk)


def draw_tub(im, x, y, r=22):
    """Кадка (дубовая) — замена туалетному зеркалу."""
    d = ImageDraw.Draw(im)
    d.ellipse([x - r, y - r // 2, x + r, y + r // 2], fill=(104, 72, 40))
    d.rectangle([x - r, y - r // 2, x + r, y + r], fill=(122, 86, 48))
    for sx in range(x - r + 5, x + r - 3, 8):
        d.line([(sx, y - r // 2 + 2), (sx, y + r - 2)], fill=(90, 62, 36), width=2)
    d.rectangle([x - r, y + 4, x + r, y + 9], fill=(86, 86, 90))
    d.ellipse([x - r, y + r, x + r, y + r + r // 2 - 6], fill=(90, 60, 34))
    d.ellipse([x - r + 5, y - r // 2 - 4, x + r - 5, y - r // 2 + 6], fill=(66, 44, 26))


# ---------------------------------------------------------------- травы / лук
def draw_herb_bunch(im, x, y):
    """Пучок сушёных трав и кореньев (замена вазону с цветами)."""
    d = ImageDraw.Draw(im)
    for i, dx in enumerate((-6, 0, 6)):
        col = [(96, 112, 62), (122, 110, 58), (86, 96, 54)][i]
        d.line([(x, y), (x + dx, y - 26)], fill=col, width=3)
        for ly in range(y - 22, y - 8, 5):
            d.line([(x + dx * (y - ly) // 26 - 3, ly), (x + dx * (y - ly) // 26 + 3, ly)],
                   fill=col, width=2)
    d.rectangle([x - 7, y - 2, x + 7, y + 4], fill=(140, 108, 62))
    d.line([(x, y + 4), (x, y + 14)], fill=(120, 96, 56), width=2)


def draw_onion_braid(im, x, y):
    """Связка лука на стене (замена гербовому щиту в таверне)."""
    d = ImageDraw.Draw(im)
    d.line([(x, y - 8), (x, y + 8)], fill=(196, 168, 106), width=3)
    py = y + 6
    for i in range(6):
        r = 13 - (i % 2) * 2
        px = x + (10 if i % 2 == 0 else -10)
        d.ellipse([px - r, py, px + r, py + r + 8], fill=(196, 150, 74))
        d.ellipse([px - r + 3, py + 3, px + r - 3, py + r + 5], fill=(216, 172, 92))
        d.line([(px, py + 2), (px, py + r + 6)], fill=(150, 108, 48), width=2)
        py += r + 4
    d.line([(x, y + 4), (x, py + 6)], fill=(150, 128, 70), width=2)


def draw_chainmail(im, x, y, h=120):
    """Кольчуга на вешале (замена рыцарскому доспеху)."""
    d = ImageDraw.Draw(im)
    wood = (104, 72, 40)
    d.rectangle([x + 26, y - 4, x + 34, y + h + 8], fill=wood)     # стойка
    d.rectangle([x - 14, y, x + 76, y + 7], fill=wood)             # перекладина
    d.rectangle([x + 8, y + h + 2, x + 52, y + h + 10], fill=(70, 48, 28))
    # полотно кольчуги — серый торс с чешуёй
    body = (150, 150, 156)
    dark = (108, 108, 116)
    lite = (190, 190, 196)
    d.rounded_rectangle([x - 6, y + 8, x + 68, y + h - 6], radius=22, fill=body)
    for sy in range(y + 12, y + h - 10, 5):
        for sx in range(x - 2, x + 64, 5):
            if (sx // 5 + sy // 5) % 2 == 0:
                d.point([(sx, sy)], fill=dark)
                d.point([(sx + 2, sy + 2)], fill=lite)
    d.ellipse([x + 18, y + 6, x + 44, y + 34], fill=body)          # плечи/капюшон
    d.ellipse([x + 24, y + 10, x + 40, y + 30], fill=dark)
    d.line([(x + 2, y + h - 30), (x - 6, y + h + 6)], fill=body, width=6)
    d.line([(x + 60, y + h - 30), (x + 68, y + h + 6)], fill=body, width=6)


# ---------------------------------------------------------------- ковры авто
def find_red_carpet(im):
    """Авто-детект красного ковра в нижней (пол) зоне кадра.
    Красные точки кластеризуются по X (зазор >40px = новый кластер):
    берём САМЫЙ ПЛОТНЫЙ кластер — так ковёр не слипается с красными
    оковками сундука/прочими красными мелочами."""
    px = im.load()
    pts = []
    for y in range(400, im.height - 40, 2):
        for x in range(240, im.width - 120, 2):
            r, g, b = px[x, y][:3]
            if r > 110 and r - g > 55 and r - b > 55 and g < 105:
                pts.append((x, y))
    if len(pts) < 120:
        return None
    pts.sort()
    # кластеризация по X
    clusters = []
    cur = [pts[0]]
    for p in pts[1:]:
        if p[0] - cur[-1][0] > 40:
            clusters.append(cur)
            cur = []
        cur.append(p)
    clusters.append(cur)
    best = max(clusters, key=len)
    if len(best) < 120:
        return None
    xs = [p[0] for p in best]
    ys = [p[1] for p in best]
    x0, x1 = min(xs) - 4, max(xs) + 4
    y0, y1 = min(ys) - 4, max(ys) + 4
    if (x1 - x0) < 36 or (x1 - x0) > 150 or (y1 - y0) < 40 or (y1 - y0) > 130:
        return None
    return (x0, y0, x1, y1)


def draw_copper_kettle(im, cx, cy, r=26):
    """МЕДНЫЙ КОТЕЛ на угольях (замена чугунному: чугун — XVI-XVII вв.,
    медные котлы/братины — историчны для Руси XV в.)."""
    d = ImageDraw.Draw(im)
    copper, copper_dk, copper_lt = (172, 112, 54), (128, 80, 38), (218, 158, 92)
    # уголья под котлом
    d.ellipse([cx - r - 8, cy + r - 8, cx + r + 8, cy + r + 10], fill=(52, 42, 36))
    # корпус котла — груша
    d.ellipse([cx - r, cy - r // 2, cx + r, cy + r + r // 3], fill=copper)
    d.ellipse([cx - r + 4, cy - r // 2 + 4, cx + r - 4, cy + r + r // 3 - 4],
              fill=copper_dk)
    d.ellipse([cx - r + 4, cy - r // 2 + 4, cx + r - 4, cy + r // 2], fill=copper)
    # горловина и обод
    d.rectangle([cx - r // 3, cy - r - 8, cx + r // 3, cy - r // 2 + 2], fill=copper_dk)
    d.ellipse([cx - r // 3 - 3, cy - r - 12, cx + r // 3 + 3, cy - r - 2], fill=copper_lt)
    # дужка
    d.arc([cx - r // 2, cy - r - 22, cx + r // 2, cy - r + 6], 180, 360,
          fill=(90, 60, 30), width=4)
    # блик
    d.ellipse([cx - r + 7, cy - r // 2 + 6, cx - r + 16, cy + r // 3], fill=copper_lt)


# ---------------------------------------------------------------- конфиг
# каждой картинке: заплатки (box, src_dx) + что рисуем
CONFIG = {
    'int_bg_tavern.webp': {
        'patches': [(1008, 104, 1096, 200, -272)],
        'draws': [('onion_braid', 1050, 132), ('copper_kettle', 276, 316)],
        'kettle_patch': (240, 258, 316, 356),
    },
    'int_bg_blacksmith.webp': {
        'patches': [(592, 102, 682, 196, -300), (988, 228, 1122, 370, -260)],
        'draws': [('chainmail', 1010, 240)],
    },
    'int_bg_elder_house.webp': {
        'patches': [(844, 108, 916, 192, -300), (636, 192, 924, 340, -330),
                    (844, 456, 956, 596, 264)],
        'draws': [('kiot', 856, 128), ('shelf_pots', 652, 204), ('chest', 830, 268),
                  ('tub', 888, 500)],
        'keep_carpet': True,
    },
    'int_bg_villager_house_1.webp': {
        'patches': [(434, 108, 506, 192, -300)],
        'draws': [('kiot', 442, 128)],
    },
    'int_bg_shoemaker_house.webp': {
        'patches': [(868, 116, 932, 194, -300)],
        'draws': [('kiot', 878, 128)],
    },
    'int_bg_grocer_house.webp': {
        'patches': [(848, 116, 912, 190, -300)],
        'draws': [('kiot', 858, 128)],
    },
    'int_bg_healer_house.webp': {
        'patches': [(462, 128, 542, 200, -300), (812, 192, 902, 340, -330),
                    (160, 576, 330, 654, 180), (1155, 574, 1235, 632, -200)],
        'draws': [('herb_bunch', 500, 156), ('shelf_pots', 822, 204),
                  ('herb_bunch', 240, 606), ('herb_bunch', 1192, 602)],
    },
    'int_bg_potter_house.webp': {
        'patches': [(424, 130, 538, 202, -300)],
        'draws': [('herb_bunch', 470, 160)],
    },
    'int_bg_weaver_house.webp': {},
    'int_bg_carpenter_house.webp': {},
    'int_bg_fisher_house.webp': {},
    'int_bg_beekeeper_house.webp': {},
    'int_bg_woodcutter_house.webp': {},
    'int_bg_villager_house_2.webp': {},
    'int_bg_villager_house_3.webp': {},
    'int_bg_butcher_house.webp': {},
    # shop_tools — без печи/камина: мастерская с открытым горном-очагом не рисуем
    'int_bg_shop_tools.webp': None,
}

PECH_FILES = [n for n in CONFIG if CONFIG[n] is not None and n != 'int_bg_shop_tools.webp']


def main():
    changed = []
    for name in sorted(CONFIG):
        path = os.path.join(INT, name)
        if not os.path.exists(path):
            print('SKIP (нет файла)', name)
            continue
        im = Image.open(path).convert('RGB')
        cfg = CONFIG[name]
        if cfg is None:
            continue

        # 1) заплатки
        for (bx, by, bx1, by1, dx) in cfg.get('patches', []):
            patch_floor(im, (bx, by, bx1, by1), dx)
            add_grain(im, (bx, by, bx1, by1), 6)

        # 2) печь вместо камина
        draw_pech(im)

        # 3) прочие рисунки
        for item in cfg.get('draws', []):
            kind = item[0]
            if kind == 'kiot':
                draw_kiot(im, item[1], item[2])
            elif kind == 'onion_braid':
                draw_onion_braid(im, item[1], item[2])
            elif kind == 'chainmail':
                draw_chainmail(im, item[1], item[2])
            elif kind == 'shelf_pots':
                draw_shelf_pots(im, item[1], item[2])
            elif kind == 'chest':
                draw_chest(im, item[1], item[2])
            elif kind == 'tub':
                draw_tub(im, item[1], item[2])
            elif kind == 'herb_bunch':
                draw_herb_bunch(im, item[1], item[2])

        # 4) ковры: авто-детект (кроме старосты — волок оставить)
        if not cfg.get('keep_carpet'):
            box = find_red_carpet(im)
            if box:
                patch_floor(im, box, 220 if box[0] > 700 else -220)
                draw_mat(im, box[0] - 4, box[1] - 4, box[2] - box[0] + 8, box[3] - box[1] + 8)
                changed.append(name + ' → рогожка')

        # 5) медный котёл: старый чугунный замазать полом, нарисовать медь
        if 'kettle_patch' in cfg:
            kb = cfg['kettle_patch']
            patch_floor(im, kb, 260)
            add_grain(im, kb, 5)

        im.save(path, 'WEBP', quality=88)
        print('OK', name)
    print('\nКовры/котёл:', changed if changed else '—')


if __name__ == '__main__':
    main()

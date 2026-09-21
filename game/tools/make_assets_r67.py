# -*- coding: utf-8 -*-
"""
make_assets_r67.py — ассеты раунда 66.7 (12 приказов владельца).

Генерирует / правит:
  1) assets/tiles/palisade_0.png      — п.8: ЧАСТОКОЛ ПЕРЕДЕЛАН: ОДИН ряд
     кольев на тайл (раньше — 2 бревна → стена выглядела двухрядной) с
     БОЛЬШИМ ВИДИМЫМ ЗАОСТРЁННЫМ КОНЦОМ (остриё целиком внутри тайла).
  2) assets/tiles/path_0..3.png       — п.9: ДОРОЖКИ ШИРИНОЙ В ОДИН ТАЙЛ:
     песчаное полотно теперь занимает ВЕСЬ тайл (раньше лента была ~40%
     высоты/ширины тайла — дорожка выглядела узкой тропкой).
  3) assets/sprites/fb_church.png     — п.10: КРЫША КОЛОКОЛЬНИ БОЛЬШЕ НЕ
     ОБРЕЗАНА: над звонницей достроен шатёр с полицами и восьмиконечный
     крест (текстура расширена вверх, окна housesFX сдвигаются кодом).
  4) fb_manor / fb_log_thatch / fb_thatch_small — п.11: ДОБАВЛЕНЫ КАМЕННЫЕ
     ДЫМОВЫЕ ТРУБЫ (у кузницы труба уже была в текстуре — остаётся).
  5) assets/interiors/int_bg_church.jpg — п.12: ПОЛНОЦЕННЫЙ ИКОНОСТАС
     (4 яруса + Царские врата + Голгофа) и болЕ икон по стенам.

Запуск из папки game/:  python3 tools/make_assets_r67.py
"""

import os
import random
from PIL import Image, ImageDraw

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(GAME, 'assets', 'tiles')
SPRITES = os.path.join(GAME, 'assets', 'sprites')
INTERIORS = os.path.join(GAME, 'assets', 'interiors')


# ============================================================
# 1) ЧАСТОКОЛ: один колж на тайл, остриё видно целиком
# ============================================================
def make_palisade(name='palisade_0'):
    """Тайл 32x32 (масштабируется до 48 в игре): ОДИН заострённый колж
    по центру. Остриё — крупный конус с гранью-бликом, апекс на y=1 —
    ЦЕЛИКОМ внутри тайла (ничего не срезается ни текстурой, ни картой).
    Между кольями — просветы травы: читается как честный ряд кольев."""
    TS = 32
    c = Image.new('RGBA', (TS, TS), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    rnd = random.Random(6708)

    x0, x1 = 5, 27                     # колж ~22px шириной
    apex = 1                           # остриё почти у верхнего края
    cone_base = 12                     # основание конуса
    mid = (x0 + x1) // 2

    # трава у основания (просветы между кольями)
    for gx in range(TS):
        if gx < x0 - 1 or gx > x1 + 1:
            g = rnd.randint(0, 2)
            if g:
                shade = (58, 92, 44, 255) if g == 1 else (72, 110, 52, 255)
                d.point((gx, 29 + rnd.randint(0, 2)), fill=shade)
                if rnd.random() < 0.4:
                    d.point((gx, 27 + rnd.randint(0, 2)), fill=(64, 100, 48, 220))

    # --- остриё: конус с асимметричной гранью ---
    d.polygon([(x0 + 1, cone_base), (x1 - 1, cone_base), (mid + 1, apex), (mid - 1, apex + 1)],
              fill=(128, 98, 60, 255), outline=(42, 28, 12, 255))
    # грань-блик на конусе
    d.line([(mid - 4, apex + 3), (x0 + 5, cone_base - 1)], fill=(164, 130, 82, 235), width=2)
    # тень на правой грани конуса
    d.line([(mid + 3, apex + 4), (x1 - 4, cone_base - 1)], fill=(96, 70, 40, 200), width=2)

    # --- тело кола: цилиндр с волокнами ---
    d.rectangle([x0, cone_base - 1, x1, TS], fill=(116, 88, 54, 255), outline=(42, 28, 12, 255))
    d.rectangle([x1 - 4, cone_base, x1 - 1, TS], fill=(88, 64, 38, 255))   # тень справа
    d.line([(x0 + 3, cone_base + 1), (x0 + 3, TS)], fill=(146, 114, 70, 235), width=2)
    for px in range(x0 + 7, x1 - 5, 4):
        d.line([(px, cone_base + 3), (px, TS)], fill=(96, 70, 42, 160))
    # заноздра + сучок
    gy = cone_base + 8 + rnd.randint(0, 8)
    d.line([(x0 + 2, gy), (x1 - 2, gy)], fill=(80, 56, 34, 180))
    kx, ky = x0 + 4 + rnd.randint(0, 10), gy + 4 + rnd.randint(0, 6)
    if ky < TS - 4:
        d.ellipse([kx, ky, kx + 3, ky + 3], fill=(68, 48, 30, 255), outline=(46, 32, 18, 255))
    # тёмное основание + лёгкая земля
    d.rectangle([x0, TS - 4, x1, TS], fill=(66, 46, 28, 220))
    d.ellipse([x0 - 2, TS - 3, x1 + 2, TS + 1], fill=(40, 30, 16, 120))

    c.save(os.path.join(TILES, name + '.png'))
    print('OK', name, c.size, '- один колж, остриё видно')


# ============================================================
# 2) ДОРОЖКИ: песок на ВСЁМ тайле (ширина ровно 1 тайл)
# ============================================================
def make_paths():
    """path_0..3 ← песчаное полотно road_0/road_1 на всю площадь тайла.
    Раньше path_0 нёс зелёные поля сверху/снизу (лента ~13px из 32) —
    дорожка выглядела тропкой в полтайла. Теперь все дорожки = 1 тайл,
    как главная улица 'B'."""
    road0 = Image.open(os.path.join(TILES, 'road_0.png')).convert('RGBA')
    road1 = Image.open(os.path.join(TILES, 'road_1.png')).convert('RGBA')
    variants = {
        'path_0': road0,
        'path_1': road1,
        'path_2': road0.transpose(Image.FLIP_LEFT_RIGHT),
        'path_3': road1.transpose(Image.FLIP_TOP_BOTTOM),
    }
    for name, im in variants.items():
        im.save(os.path.join(TILES, name + '.png'))
        print('OK', name, im.size, '- песок на всём тайле')


# ============================================================
# 3) ЦЕРКОВЬ: шатёр колокольни + крест
# ============================================================
def fix_church_roof():
    """fb_church.png: достроить СРЕЗАННЫЙ шатёр над звонницей.
    Старая текстура 263x288 обрезала кровлю звонницы верхним краем.
    Новая: 263x340 — +52px: полицы, шатёр (черепица в тон основной
    кровли), главка-pected cap и восьмиконечный крест."""
    src = Image.open(os.path.join(SPRITES, 'fb_church.png')).convert('RGBA')
    W, H = src.size                       # 263 x 288
    EXT = 52
    out = Image.new('RGBA', (W, H + EXT), (0, 0, 0, 0))
    out.paste(src, (0, EXT))
    d = ImageDraw.Draw(out)
    rnd = random.Random(6767)

    # --- границы звонницы: сплошной контент на строке среза ---
    px = src.load()
    cols = [x for x in range(W) if px[x, 2][3] > 0]
    tw_left, tw_right = min(cols), max(cols)
    # звонница — правая часть (там, где окно звонницы [137,28] из housesFX)
    # основной кров доходит до x≈110 слева; берём колонку от 112
    tw_left = max(tw_left, 112)
    cx = (tw_left + tw_right) // 2
    overhang = 10                          # свес кровли
    base_l, base_r = tw_left - overhang, tw_right + overhang
    base_y = EXT                           # линия среза (бывший верх)
    apex_y = 16                            # апекс шатра (под крестом)

    # палитра черепицы — снята с основной кровли церкви
    SH = [(80, 64, 48), (64, 48, 32), (88, 70, 52), (72, 56, 40), (52, 38, 24)]
    EDGE = (34, 24, 14)

    # --- полицы (нижний выступ по периметру основания шатра) ---
    d.rectangle([base_l - 6, base_y - 4, base_r + 6, base_y + 2],
                fill=(64, 48, 32, 255), outline=EDGE)
    d.rectangle([base_l - 6, base_y - 4, base_r + 6, base_y - 1],
                fill=(92, 74, 56, 255))

    # --- шатёр: сужающиеся горизонтальные ряды черепицы ---
    rows = 13
    for i in range(rows):
        t0 = i / rows
        t1 = (i + 1) / rows
        y0 = int(base_y - (base_y - apex_y) * t0)
        y1 = int(base_y - (base_y - apex_y) * t1)
        half0 = int((base_r - base_l) / 2 * (1 - t0))
        half1 = int((base_r - base_l) / 2 * (1 - t1))
        xl, xr = cx - half0, cx + half0
        col = SH[i % len(SH)]
        d.polygon([(xl, y1), (xr, y1), (cx + half1, y0), (cx - half1, y0)],
                  fill=col + (255,), outline=EDGE)
        # вертикальные швы черепицы в ряду
        if xr - xl > 14:
            for k in range(1, 5):
                xx = xl + (xr - xl) * k // 5
                d.line([(xx, y0 + 2), (xx, y1 - 1)], fill=(40, 30, 18, 200))
        # блик слева
        if xr - xl > 8:
            d.line([(xl + 2, y1 - 2), (cx - half1 + max(2, half1 // 3), y0 + 2)],
                   fill=(110, 92, 70, 190))

    # --- конёк/подглавие ---
    d.rectangle([cx - 7, apex_y - 4, cx + 7, apex_y + 3],
                fill=(58, 44, 30, 255), outline=EDGE)
    d.rectangle([cx - 4, apex_y - 8, cx + 4, apex_y - 3],
                fill=(76, 58, 40, 255), outline=EDGE)

    # --- восьмиконечный крест (упрощённо: вертикал + 2 перекладины) ---
    iron = (196, 168, 106, 255)            # золочёное железо
    iron_d = (120, 96, 54, 255)
    top_y = 0
    d.rectangle([cx - 1, top_y, cx + 2, apex_y - 8], fill=iron, outline=iron_d)      # вертикал
    d.rectangle([cx - 8, top_y + 3, cx + 9, top_y + 5], fill=iron, outline=iron_d)   # верхняя малая
    d.rectangle([cx - 12, top_y + 8, cx + 13, top_y + 11], fill=iron, outline=iron_d) # большая

    out.save(os.path.join(SPRITES, 'fb_church.png'))
    print('OK fb_church', out.size, '- шатёр и крест достроены, срез убран')


# ============================================================
# 4) КАМЕННЫЕ ТРУБЫ домам без труб
# ============================================================
def draw_chimney(im, x, y_top, y_base, w, rnd):
    """Каменная печная труба в стиле трубы кузницы (fb_smithy):
    cap-плита со свесом, тёмное жерло под ней, ствол из НЕРАВНЫХ камней
    с растворными швами (без «лестницы»), тень ствола справа, блик слева,
    мягкая тень на кровле у основания."""
    d = ImageDraw.Draw(im)
    MORTAR = (58, 54, 50)
    base_grey = (118, 114, 108)

    def jitter(c, k=12):
        return tuple(max(0, min(255, v + rnd.randint(-k, k))) for v in c)

    # мягкая тень на кровле под трубой
    for i in range(4):
        d.ellipse([x - 5 + i, y_base - 4 + i, x + w + 5 - i, y_base + 6 - i],
                  fill=(20, 16, 12, 40))
    # ствол
    d.rectangle([x, y_top, x + w, y_base], fill=base_grey + (255,))
    rows = max(2, (y_base - y_top) // 7)
    rh = (y_base - y_top) / rows
    for r in range(rows):
        yy0 = int(y_top + r * rh)
        yy1 = int(y_top + (r + 1) * rh) - 1
        # два камня в ряду со случайной границей
        split = x + 6 + rnd.randint(0, max(2, w - 12))
        d.rectangle([x + 1, yy0, split - 1, yy1], fill=jitter(base_grey, 14) + (255,))
        d.rectangle([split, yy0, x + w - 1, yy1], fill=jitter(base_grey, 14) + (255,))
        # растворные швы
        d.line([(x + 1, yy1 + 1), (x + w - 1, yy1 + 1)], fill=MORTAR + (255,))
        d.line([(split, yy0), (split, yy1)], fill=MORTAR + (255,))
    # цилиндрика: тень справа, блик слева
    d.rectangle([x + w - 3, y_top, x + w - 1, y_base], fill=(86, 82, 78, 255))
    d.line([(x + 1, y_top), (x + 1, y_base)], fill=(150, 146, 140, 255))
    d.line([(x, y_top), (x, y_base)], fill=MORTAR + (255,))
    d.line([(x + w, y_top), (x + w, y_base)], fill=MORTAR + (255,))
    # cap-плита со свесом
    d.rectangle([x - 3, y_top - 5, x + w + 3, y_top - 1], fill=(96, 92, 88, 255), outline=(44, 40, 36, 255))
    d.line([(x - 3, y_top - 1), (x + w + 3, y_top - 1)], fill=(60, 56, 52, 255))
    # жерло — тёмный канал над плитой
    d.rectangle([x + w // 2 - 5, y_top - 9, x + w // 2 + 4, y_top - 4], fill=(22, 18, 16, 255))
    d.line([(x + w // 2 - 5, y_top - 9), (x + w // 2 - 5, y_top - 4)], fill=(70, 62, 56, 255))


def add_chimneys():
    rnd = random.Random(6711)

    # --- fb_manor (200x188): труба на правом скате дранки, в стороне от
    # тёмного колпака у края (155..165) ---
    p = os.path.join(SPRITES, 'fb_manor.png')
    im = Image.open(p).convert('RGBA')
    draw_chimney(im, 118, 32, 76, 22, rnd)
    im.save(p)
    print('OK fb_manor + каменная труба (118..140, 27..76), жерло (128,23)')

    # --- fb_log_thatch (186x180): труба на логовом крове у конька ---
    p = os.path.join(SPRITES, 'fb_log_thatch.png')
    im = Image.open(p).convert('RGBA')
    draw_chimney(im, 94, 12, 56, 22, rnd)
    im.save(p)
    print('OK fb_log_thatch + каменная труба (94..116, 7..56), жерло (104,3)')

    # --- fb_thatch_small (154x190): труба на правом скате ---
    p = os.path.join(SPRITES, 'fb_thatch_small.png')
    im = Image.open(p).convert('RGBA')
    draw_chimney(im, 102, 22, 66, 22, rnd)
    im.save(p)
    print('OK fb_thatch_small + каменная труба (102..124, 17..66), жерло (112,13)')


# ============================================================
# 5) ИКОНОСТАС ЦЕРКВИ (int_bg_church.jpg) — 4 яруса + стены
# ============================================================
def paint_icon(d, x, y, w, h, rnd, figure='stand', robe=None, halo=True,
               frame_w=3, bg=(26, 18, 10)):
    """Одна икона в золотом окладе: тёмная доска, нимб, фигура."""
    GOLD = (201, 161, 74)
    GOLD_D = (140, 108, 44)
    SKIN = (216, 176, 136)
    ROBES = robe or [(122, 40, 56), (63, 90, 58), (154, 122, 58), (94, 52, 96),
                     (60, 70, 110), (110, 74, 40), (140, 40, 30)][rnd.randint(0, 6)]
    # доска + оклад
    d.rectangle([x, y, x + w, y + h], fill=bg + (255,), outline=GOLD + (255,), width=frame_w)
    d.rectangle([x + frame_w, y + frame_w, x + w - frame_w, y + h - frame_w],
                outline=GOLD_D + (255,))
    cx = x + w // 2
    cy = y + h // 2
    # нимб
    hr = min(w, h) * 0.22
    if halo:
        d.ellipse([cx - hr, cy - h * 0.30 - hr, cx + hr, cy - h * 0.30 + hr],
                  outline=GOLD + (255,), width=2)
    # фигура
    body_top = cy - h * 0.16
    body_bot = y + h - frame_w - 2
    bw = w * 0.52
    if figure == 'stand':
        d.polygon([(cx - bw / 2, body_bot), (cx + bw / 2, body_bot),
                   (cx + bw * 0.30, body_top), (cx - bw * 0.30, body_top)],
                  fill=ROBES + (255,))
        d.rectangle([cx - bw * 0.16, body_top - h * 0.10, cx + bw * 0.16, body_top + 2],
                    fill=SKIN + (255,))
        # благословляющая рука / свиток
        if w >= 40:
            d.rectangle([cx + bw * 0.22, body_top + h * 0.10, cx + bw * 0.30, body_top + h * 0.16],
                        fill=SKIN + (255,))
    elif figure == 'angel':  # для Царских врат
        d.polygon([(cx - bw / 2, body_bot), (cx + bw / 2, body_bot),
                   (cx, body_top)], fill=ROBES + (255,))
        d.rectangle([cx - 2, body_top - h * 0.08, cx + 2, body_top + 1], fill=SKIN + (255,))
    # лик: глаза-точки у крупных икон
    if w >= 52:
        d.rectangle([cx - 4, cy - h * 0.22, cx - 2, cy - h * 0.22 + 2], fill=(40, 28, 18, 255))
        d.rectangle([cx + 2, cy - h * 0.22, cx + 4, cy - h * 0.22 + 2], fill=(40, 28, 18, 255))


def regenerate_church_interior():
    """int_bg_church.jpg 1280x720: полноценный иконостас:
    местный ряд с Царскими вратами, деисус, праздничный и пророческий
    ярусы, Голгофа; по боковым стенам — киоты с иконами. Стиль плоский,
    в тон прежнему фону (бревенчатые стены, красная дорожка, подсвечники,
    лавки). Ниша пустого киота (правый верх) рисуется кодом игры —
    стена там оставлена чистой."""
    W, H = 1280, 720
    c = Image.new('RGB', (W, H), (58, 44, 30))
    d = ImageDraw.Draw(c)
    rnd = random.Random(6712)

    # --- бревенчатые стены ---
    for y in range(0, 470, 26):
        tone = 96 + (y // 26) % 3 * 8
        d.rectangle([0, y, W, y + 25], fill=(tone + 6, tone - 14, tone - 42))
        d.line([(0, y + 25), (W, y + 25)], fill=(54, 40, 26))
        # торцы брёвен
        for xx in range(20, W, 260):
            d.ellipse([xx - 6, y + 6, xx + 6, y + 20], fill=(76, 58, 38), outline=(48, 36, 24))
    # верхний тёмный периметр (антресоль, как раньше)
    d.rectangle([0, 0, W, 96], fill=(52, 38, 26))
    d.line([(0, 96), (W, 96)], fill=(30, 22, 14))
    for xx in range(0, W, 64):       # свесы балок
        d.rectangle([xx, 88, xx + 30, 96], fill=(66, 50, 34))

    # --- пол: доски ---
    for y in range(470, H, 34):
        tone = 118 + (y // 34) % 2 * 10
        d.rectangle([0, y, W, y + 33], fill=(tone, tone - 26, tone - 56))
        d.line([(0, y), (W, y)], fill=(70, 54, 36))
    # стыки досок
    for xx in range(90, W, 180):
        d.line([(xx, 470), (xx, H)], fill=(84, 66, 46))

    # --- красная дорожка к Царским вратам ---
    d.polygon([(560, H), (720, H), (688, 440), (592, 440)], fill=(122, 30, 34))
    d.polygon([(576, H), (600, H), (592, 440), (584, 440)], fill=(146, 44, 46))

    GOLD = (201, 161, 74)
    GOLD_D = (140, 108, 44)
    DARKWOOD = (52, 36, 22)
    WOOD = (78, 56, 34)

    # --- габарит иконостаса ---
    IX0, IX1 = 130, 810           # столбы
    IY0, IY1 = 60, 452            # верх короны → основание

    # задняя стена иконостаса (тёмная доска)
    d.rectangle([IX0, IY0 + 30, IX1, IY1], fill=(44, 32, 20))

    # --- столбы с золотыми инкрустациями ---
    for px_ in (IX0, IX1 - 26):
        d.rectangle([px_, IY0 + 20, px_ + 26, IY1], fill=WOOD + (255,) if False else WOOD,
                    outline=DARKWOOD, width=2)
        for gy in range(IY0 + 40, IY1 - 20, 44):
            d.rectangle([px_ + 8, gy, px_ + 18, gy + 22], fill=GOLD, outline=GOLD_D)

    # --- корона иконостаса (резной верх) ---
    d.rectangle([IX0 - 12, IY0 + 18, IX1 + 12, IY0 + 44], fill=(64, 46, 28), outline=DARKWOOD, width=2)
    for kx in range(IX0, IX1, 56):
        d.rectangle([kx + 18, IY0 + 6, kx + 34, IY0 + 20], fill=(74, 54, 32), outline=DARKWOOD)
    # Голгофа над короной
    cxg = (IX0 + IX1) // 2
    d.rectangle([cxg - 1, IY0 - 34, cxg + 3, IY0 + 20], fill=GOLD, outline=GOLD_D)
    d.rectangle([cxg - 14, IY0 - 20, cxg + 16, IY0 - 16], fill=GOLD, outline=GOLD_D)
    d.rectangle([cxg - 8, IY0 - 30, cxg + 8, IY0 - 27], fill=GOLD, outline=GOLD_D)

    # ===== ЯРУС 1 (верх): пророческий — 10 малых икон =====
    y1a, y1b = IY0 + 50, IY0 + 116
    n = 10
    gw = (IX1 - 56) - (IX0 + 56)
    step = gw / n
    for i in range(n):
        x = int(IX0 + 56 + i * step + 3)
        w = int(step - 8)
        paint_icon(d, x, y1a, w, y1b - y1a, rnd, figure='stand', frame_w=2)

    # ===== ЯРУС 2: праздничный — 8 икон =====
    y2a, y2b = IY0 + 124, IY0 + 208
    n = 8
    step = gw / n
    for i in range(n):
        x = int(IX0 + 56 + i * step + 4)
        w = int(step - 10)
        paint_icon(d, x, y2a, w, y2b - y2a, rnd, figure='stand', frame_w=3)

    # ===== ЯРУС 3: ДЕИСУС — Богородица, Спас (центр, крупнее), Иоанн =====
    y3a, y3b = IY0 + 216, IY0 + 330
    # боковые малые
    paint_icon(d, IX0 + 48, y3a + 8, 66, y3b - y3a - 12, rnd, figure='stand', frame_w=3)
    paint_icon(d, IX1 - 114, y3a + 8, 66, y3b - y3a - 12, rnd, figure='stand', frame_w=3)
    # Богородица (слева от Спаса)
    paint_icon(d, 268, y3a, 118, y3b - y3a, rnd, figure='stand', robe=(122, 40, 56))
    # Спас Вседержитель — центр деисуса
    paint_icon(d, 402, y3a - 10, 140, y3b - y3a + 10, rnd, figure='stand', robe=(94, 52, 96))
    # Иоанн Предтеча (справа)
    paint_icon(d, 558, y3a, 118, y3b - y3a, rnd, figure='stand', robe=(60, 70, 110))

    # ===== ЯРУС 4 (местный): иконы + ЦАРСКИЕ ВРАТА в центре =====
    y4a, y4b = IY0 + 338, IY1 - 6
    paint_icon(d, 152, y4a, 108, y4b - y4a, rnd, figure='stand', robe=(154, 122, 58))   # храмовая
    paint_icon(d, 272, y4a + 4, 104, y4b - y4a - 8, rnd, figure='stand', robe=(122, 40, 56))  # Богородицы
    paint_icon(d, 590, y4a + 4, 104, y4b - y4a - 8, rnd, figure='stand', robe=(94, 52, 96))   # Спасителя
    paint_icon(d, 706, y4a, 96, y4b - y4a, rnd, figure='stand', robe=(63, 90, 58))     # Иоанна
    # --- Царские врата (400..560) ---
    dx0, dx1 = 402, 562
    dy0, dy1 = y4a - 26, y4b
    d.rectangle([dx0, dy0, dx1, dy1], fill=(70, 50, 30), outline=DARKWOOD, width=3)
    d.rectangle([dx0 + 6, dy0 + 6, dx1 - 6, dy1 - 6], outline=GOLD, width=3)
    mx = (dx0 + dx1) // 2
    d.line([(mx, dy0 + 6), (mx, dy1 - 6)], fill=GOLD, width=3)
    # Благовещение: два малых образа в верхних створках
    paint_icon(d, dx0 + 14, dy0 + 12, (dx1 - dx0) // 2 - 26, 52, rnd, figure='angel', robe=(60, 70, 110), frame_w=2)
    paint_icon(d, mx + 12, dy0 + 12, (dx1 - dx0) // 2 - 26, 52, rnd, figure='stand', robe=(122, 40, 56), frame_w=2)
    # евангелисты: 4 малых круга в нижних створках (внутри врат)
    for i in range(4):
        ex = dx0 + 26 + i * ((dx1 - dx0 - 48) / 3)
        ey = dy1 - 34
        d.ellipse([ex - 11, ey - 11, ex + 11, ey + 11], outline=GOLD, width=2, fill=(36, 26, 16))
        d.ellipse([ex - 4, ey - 7, ex + 4, ey + 1], fill=(216, 176, 136))

    # --- тень иконостаса на пол ---
    d.rectangle([IX0 - 8, IY1, IX1 + 8, IY1 + 8], fill=(30, 22, 14))

    # ===== КИОТЫ ПО СТЕНАМ (п.12: болЕ икон) =====
    def wall_kiot(x, y, w, h):
        # доска-киот с резной рамкой и иконой
        d.rectangle([x - 8, y - 8, x + w + 8, y + h + 8], fill=(84, 62, 38), outline=(44, 32, 20), width=2)
        d.rectangle([x - 8, y - 8, x + w + 8, y + h + 8], outline=GOLD_D, width=1)
        paint_icon(d, x, y, w, h, rnd, figure='stand', frame_w=4)
        # лампадка под киотом
        d.line([(x + w // 2, y + h + 8), (x + w // 2, y + h + 20)], fill=(120, 96, 54), width=2)
        d.ellipse([x + w // 2 - 5, y + h + 18, x + w // 2 + 5, y + h + 28], fill=(240, 180, 80), outline=(120, 90, 40))

    # левая стена: два киота
    wall_kiot(28, 150, 74, 118)
    wall_kiot(28, 306, 74, 118)
    # правая стена: два киота (ниже зоны пустого киота, который рисует код)
    wall_kiot(848, 128, 74, 118)
    wall_kiot(960, 128, 74, 118)

    # --- подсвечники (как в прежнем фоне) ---
    def candle_stand(x, base_y):
        d.ellipse([x - 22, base_y - 6, x + 22, base_y + 8], fill=(40, 30, 20))
        d.rectangle([x - 3, base_y - 118, x + 3, base_y], fill=(150, 122, 64))
        for k in (-14, 0, 14):
            d.rectangle([x + k - 2, base_y - 148, x + k + 2, base_y - 116], fill=(226, 214, 186))
            flame = 10 + (abs(k) % 7)
            d.ellipse([x + k - 3, base_y - 150 - flame, x + k + 3, base_y - 144 - flame],
                      fill=(250, 200, 90))
    candle_stand(884, 462)
    candle_stand(1030, 462)

    # --- лавки ---
    def bench(x, y, w):
        d.rectangle([x, y, x + w, y + 12], fill=(88, 66, 42), outline=(44, 32, 20))
        d.rectangle([x + 8, y + 12, x + 16, y + 34], fill=(70, 52, 34))
        d.rectangle([x + w - 16, y + 12, x + w - 8, y + 34], fill=(70, 52, 34))
        d.ellipse([x + 10, y + 30, x + w - 10, y + 44], fill=(48, 38, 26))
    bench(250, 512, 210)
    bench(650, 546, 210)

    c.save(os.path.join(INTERIORS, 'int_bg_church.jpg'), quality=88)
    print('OK int_bg_church.jpg — иконостас 4 яруса + киоты на стенах')


if __name__ == '__main__':
    make_palisade()
    make_paths()
    fix_church_roof()
    add_chimneys()
    regenerate_church_interior()

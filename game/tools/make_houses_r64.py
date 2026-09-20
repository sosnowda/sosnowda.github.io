#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РАУНД 64 (пп.8,9,3,4 приказа владельца).

П.9: ВСЕ ДОМА ДЕРЕВНИ ПЕРЕСОБРАНЫ ИЗ ЧАСТЕЙ — «СТЕН И КРЫШ».
П.8: у собранных домов ЧЕСТНЫЕ БОКОВЫЕ СТЕНЫ (угловые столбы-замки по всей
     высоте + цоколь), ничего не обрезано — спрайт собирается целиком.
П.3,4: НОВАЯ ВОРОТНЯ village_gate_r64 — фронтальная арка БЕЗ БАШЕНОК:
     два массивных столба, несущая балка, двускатная крыша над проездом,
     фонарь. Широкая и контрастная — ВИДНА издалека.

Вход:  assets/tiles/{wall_log,wall_plank,roof_thatch,roof_wood,rock_0,
       quaternius/plaster_32}.png
Выход: assets/sprites/hp_*.png (дома), assets/sprites/village_gate_r64.png

Каждый дом собирается из стандартных тайлов 32→48px (тайл деревни) и
рисуется в «фасадной» проекции, как вся деревня. Дым НЕ рисуется и
не генерируется (п.6: дым из труб удалён владельцем).
"""
from PIL import Image, ImageDraw, ImageOps
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, 'assets', 'tiles')
OUT = os.path.join(ROOT, 'assets', 'sprites')
TS = 48            # выходной тайл (тайл деревни на карте)
SRC = 32

_cache = {}
def tile(name):
    if name not in _cache:
        im = Image.open(os.path.join(TILES, name + '.png')).convert('RGBA')
        if im.size != (TS, TS):
            im = im.resize((TS, TS), Image.NEAREST)
        _cache[name] = im
    return _cache[name]

def tiled(canvas, name, x0, y0, x1, y1):
    """Замостить прямоугольник текстурой тайла (клип по границам)."""
    t = tile(name)
    tw, th = t.size
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            canvas.alpha_composite(t, (x, y))
            x += tw
        y += th
    # подрезка снизу/справа
    if y1 - (y - th) < th or x1 - (x - tw) < tw:
        pass

def shade(img, factor):
    """Затемнить/осветлить изображение (factor<1 темнее)."""
    return ImageEnhance_factor(img, factor)

def ImageEnhance_factor(img, factor):
    from PIL import ImageEnhance
    return ImageEnhance.Brightness(img).enhance(factor)

def paste_clipped(dst, src, box):
    """Вставить src в dst, обрезав по box=(x0,y0,x1,y1)."""
    x0, y0, x1, y1 = box
    piece = src.crop((0, 0, min(src.width, x1 - x0), min(src.height, y1 - y0)))
    dst.alpha_composite(piece, (x0, y0))

# ---------------------------------------------------------------- кровля
def hip_roof(c, W, y_ridge, y_eave, tex_name='roof_thatch', half_ridge_frac=0.2):
    """Трапециевидная (вальмовая) кровля фасада: конёк сверху, свесы шире стен.
    Чистая заливка текстурой по маске + плавное затемнение к свесам +
    редкие гребни соломы/дранки. Без пилообразных рядов."""
    cx = W // 2
    half_ridge = max(10, int(W * half_ridge_frac))
    h = y_eave - y_ridge
    # 1) маска-трапеция
    mask = Image.new('L', (W, h + 6), 0)
    ImageDraw.Draw(mask).polygon(
        [(cx - half_ridge, 0), (cx + half_ridge, 0), (W - 1, h), (0, h)], fill=255)
    # 2) сплошная текстура (замощение по обеим осям)
    tex = Image.new('RGBA', (W, h + 6), (0, 0, 0, 0))
    t = tile(tex_name)
    yy = 0
    while yy < h + 6:
        xx = 0
        while xx < W:
            tex.alpha_composite(t, (xx, yy))
            xx += TS
        yy += TS
    # 3) затемнение к свесам (плавный градиент) + гребни рядов
    grad = Image.new('L', (W, h + 6), 0)
    gd = ImageDraw.Draw(grad)
    for gy in range(h + 6):
        v = int(74 * (gy / max(1, h)))          # 0 у конька → 74 у свеса
        gd.line([(0, gy), (W, gy)], fill=v)
    dark_layer = Image.new('RGBA', (W, h + 6), (18, 10, 2, 255))
    dark_layer.putalpha(grad)
    tex.alpha_composite(dark_layer)
    td = ImageDraw.Draw(tex)
    for gy in range(6, h, 7):
        td.line([(0, gy), (W, gy)], fill=(30, 18, 6, 46))
        td.line([(0, gy + 1), (W, gy + 1)], fill=(255, 224, 160, 26))
    # 4) клип по маске и вставка (маска = альфа: внутри непрозрачно 255,
    #    края сглажены; полупрозрачные штрихи не портят альфу)
    tex.putalpha(mask)
    c.alpha_composite(tex, (0, y_ridge))
    d = ImageDraw.Draw(c)
    # конёк — круглое бревно
    d.rectangle([cx - half_ridge - 2, y_ridge - 3, cx + half_ridge + 2, y_ridge + 3],
                fill=(94, 68, 38, 255), outline=(48, 32, 16, 255))
    d.line([cx - half_ridge - 1, y_ridge - 2, cx + half_ridge + 1, y_ridge - 2],
           fill=(150, 112, 66, 255))
    # лобовая доска свеса
    d.rectangle([0, y_eave, W - 1, y_eave + 4], fill=(43, 29, 15, 255))
    d.line([0, y_eave, W - 1, y_eave], fill=(120, 88, 50, 255))
    # причелина — резная доска по нижнему краю скатов
    for sgn in (-1, 1):
        x0 = cx + sgn * half_ridge
        x1 = cx + sgn * (W // 2 - 2)
        steps = max(2, abs(x1 - x0) // 8)
        for k in range(steps):
            xa = x0 + (x1 - x0) * k // steps
            xb = x0 + (x1 - x0) * (k + 1) // steps
            ytop = y_ridge + h * k // steps
            d.line([xa, ytop + 2, xb, ytop + 2], fill=(190, 152, 96, 170))
    return y_eave

# ---------------------------------------------------------------- стены
def walls(c, W, y_top, y_bot, tex_name='wall_log', corner='post', foundation=10):
    """Полотно стены с ЧЕСТНЫМИ БОКОВЫМИ СТЕНАМИ: угловые столбы-замки
    во всю высоту + каменный цоколь. Ничего не обрезано."""
    inset = 6
    tiled(c, tex_name, inset, y_top, W - inset, y_bot - foundation)
    d = ImageDraw.Draw(c)
    # швы между венцами (для бревна — тонкие тёмные линии каждые 12px)
    if tex_name == 'wall_log':
        for yy in range(y_top + 12, y_bot - foundation, 12):
            d.line([inset, yy, W - inset, yy], fill=(52, 36, 20, 110))
    # угловые столбы-замки (боковые стены)
    if corner == 'post':
        for x0 in (inset - 2, W - inset - 4):
            d.rectangle([x0, y_top - 2, x0 + 6, y_bot - foundation + 2],
                        fill=(62, 44, 26, 255), outline=(36, 23, 8, 255))
            d.line([x0 + 2, y_top, x0 + 2, y_bot - foundation], fill=(96, 70, 42, 255))
    # цоколь — камень (сначала сплошная тёмная подложка, потом камни:
    # тайл rock_0 с прозрачными дырами — без подложки сквозь цоколь видна трава)
    d.rectangle([inset - 4, y_bot - foundation, W - inset + 4, y_bot],
                fill=(74, 68, 60, 255))
    rock = tile('rock_0').resize((TS, foundation + 6), Image.NEAREST)
    rock = ImageEnhance_factor(rock, 0.82)
    x = inset - 4
    while x < W - inset + 4:
        c.alpha_composite(rock.crop((0, 0, min(TS, W - inset + 4 - x), foundation)), (x, y_bot - foundation))
        x += TS - 6
    d.rectangle([inset - 4, y_bot - foundation, W - inset + 4, y_bot - foundation + 1],
                fill=(150, 140, 126, 255))
    return y_top

def window(c, x, y, w=18, h=20, shutters=(120, 60, 44), flowers=False):
    """Окно с резным наличником, ставнями и (опц.) цветником."""
    d = ImageDraw.Draw(c)
    # наличник
    d.rectangle([x - 3, y - 3, x + w + 3, y + h + 3], fill=(214, 196, 160, 255),
                outline=(96, 70, 40, 255))
    # проём
    d.rectangle([x, y, x + w, y + h], fill=(24, 18, 12, 255))
    # тёплый отсвет стекла
    d.rectangle([x + 2, y + 2, x + w // 2, y + h // 2], fill=(96, 78, 52, 255))
    d.rectangle([x + 2, y + 2, x + w - 2, y + 2 + 3], fill=(130, 108, 74, 255))
    # переплёт
    d.line([x + w // 2, y, x + w // 2, y + h], fill=(214, 196, 160, 255))
    d.line([x, y + h // 2, x + w, y + h // 2], fill=(214, 196, 160, 255))
    # ставни
    if shutters:
        d.rectangle([x - 8, y - 1, x - 3, y + h + 1], fill=shutters + (255,),
                    outline=(60, 40, 24, 255))
        d.rectangle([x + w + 3, y - 1, x + w + 8, y + h + 1], fill=shutters + (255,),
                    outline=(60, 40, 24, 255))
    # цветник
    if flowers:
        d.rectangle([x - 9, y + h + 4, x + w + 9, y + h + 9], fill=(94, 62, 34, 255),
                    outline=(52, 34, 18, 255))
        import random
        rnd = random.Random(x * 31 + y)
        for fx in range(x - 7, x + w + 7, 5):
            col = rnd.choice([(196, 60, 48), (222, 170, 52), (170, 196, 70)])
            d.ellipse([fx, y + h + 4, fx + 4, y + h + 8], fill=col + (255,))

def door(c, x, y_bot, w=22, h=38, canopy=True):
    """Дверь: вертикальный тёсен, жёлтая рамка, ступень."""
    d = ImageDraw.Draw(c)
    top = y_bot - h
    d.rectangle([x - 3, top - 3, x + w + 3, y_bot], fill=(150, 118, 70, 255),
                outline=(64, 44, 24, 255))
    d.rectangle([x, top, x + w, y_bot - 1], fill=(74, 52, 30, 255))
    for px in range(x + 2, x + w - 1, 4):
        d.line([px, top + 1, px, y_bot - 2], fill=(58, 40, 22, 255))
    # кованая скоба
    d.line([x + w - 6, top + 10, x + w - 6, top + 16], fill=(196, 164, 84, 255))
    d.ellipse([x + w - 8, top + 14, x + w - 4, top + 18], fill=(196, 164, 84, 255))
    # ступень
    d.rectangle([x - 5, y_bot, x + w + 5, y_bot + 3], fill=(120, 110, 100, 255),
                outline=(70, 64, 58, 255))
    if canopy:
        d.polygon([(x - 8, top - 3), (x + w + 8, top - 3), (x + w + 4, top - 10),
                   (x - 4, top - 10)], fill=(96, 68, 40, 255), outline=(48, 32, 16, 255))

def chimney(c, cx, y_top, y_base, side=1):
    """Каменная труба на скате (БЕЗ дыма — п.6)."""
    d = ImageDraw.Draw(c)
    w = 14
    d.rectangle([cx - w // 2, y_top, cx + w // 2, y_base], fill=(122, 116, 108, 255),
                outline=(74, 70, 64, 255))
    for yy in range(y_top + 5, y_base, 7):
        d.line([cx - w // 2 + 1, yy, cx + w // 2 - 1, yy], fill=(96, 90, 84, 255))
    d.rectangle([cx - w // 2 - 2, y_top - 4, cx + w // 2 + 2, y_top], fill=(88, 82, 76, 255),
                outline=(56, 52, 48, 255))

# ---------------------------------------------------------------- дом
def make_house(name, tiles_w, tiles_h, wall='wall_log', roof='roof_thatch',
               win1=True, win2=True, win_shutters=(120, 60, 44), flowers=False,
               chim=None, door_offset=0.0, roof_frac=0.52):
    W = tiles_w * TS + 16
    H = tiles_h * TS
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y_eave = int(H * roof_frac)
    walls(c, W, y_eave + 4, H, tex_name=wall)
    hip_roof(c, W, y_eave - int(H * 0.40), y_eave, tex_name=roof)
    inset = 6
    wy0, wy1 = y_eave + 6, H
    cx = W // 2
    dx = int((W // 2 - 14) * door_offset)
    door(c, cx + dx - 11, H - 2)
    if win1:
        window(c, inset + 12, wy0 + 8, 18, 20, shutters=win_shutters, flowers=flowers)
    if win2:
        window(c, W - inset - 30, wy0 + 8, 18, 20, shutters=win_shutters, flowers=flowers)
    if chim == 'right':
        chimney(c, W - 34, y_eave - int(H * 0.30), y_eave - 2)
    elif chim == 'left':
        chimney(c, 34, y_eave - int(H * 0.30), y_eave - 2)
    c.save(os.path.join(OUT, name + '.png'))
    return name, c.size

# ---------------------------------------------------------------- двор
def make_inn(name='hp_inn'):
    """Постоялый двор — ЕДИНСТВЕННОЕ двухэтажное строение (4×3)."""
    tiles_w, tiles_h = 4, 3
    W = tiles_w * TS + 16
    H = tiles_h * TS
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y_eave = 52
    walls(c, W, y_eave + 4, H, tex_name='wall_log')
    hip_roof(c, W, 14, y_eave, tex_name='roof_wood')
    d = ImageDraw.Draw(c)
    # междуэтажный пояс
    d.rectangle([6, y_eave + 44, W - 6, y_eave + 48], fill=(80, 58, 34, 255),
                outline=(44, 30, 14, 255))
    # верхний этаж — три окошка
    for i, wx in enumerate((34, W // 2 - 9, W - 52)):
        window(c, wx, y_eave + 12, 18, 18, shutters=(96, 66, 40))
    # нижний этаж: дверь + два окна с цветниками
    door(c, W // 2 - 13, H - 2, w=26, h=40)
    window(c, 26, y_eave + 58, 18, 20, shutters=(120, 60, 44), flowers=True)
    window(c, W - 44, y_eave + 58, 18, 20, shutters=(120, 60, 44), flowers=True)
    # вывеска-кронштейн
    d.line([W - 6, y_eave + 8, W + 8, y_eave + 8], fill=(64, 44, 24, 255), width=3)
    d.rectangle([W + 2, y_eave + 8, W + 10, y_eave + 20], fill=(140, 108, 62, 255),
                outline=(56, 38, 18, 255))
    c.save(os.path.join(OUT, name + '.png'))
    return name, c.size

# ---------------------------------------------------------------- ворота
def make_gate(name='village_gate_r64'):
    """П.3,4: воротня-арка БЕЗ башенок (п.4) и БЕЗ частокольных крыльев (п.1).
    Широкая (3+ тайла) фронтальная арка: два массивных столба на каменных
    основаниях, несущая балка с подкосами, вальмовая кровля «как у домов»,
    фонарь в проезде. Проезд прозрачен — сквозь арку видна дорога."""
    W, H = 156, 184
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    pw = 22                          # толщина столба
    lx, rx = 10, W - 10 - pw         # столбы
    y_eave, y_beam0, y_beam1 = 58, 60, 74
    y_bot = 172
    # --- столбы: заранее замощённая полоса ровно pw пикселей (клип!) ---
    def post_strip():
        s = Image.new('RGBA', (pw, y_bot - y_beam1), (0, 0, 0, 0))
        t = tile('wall_plank')
        yy = 0
        while yy < s.height:
            xx = 0
            while xx < pw:
                s.alpha_composite(t, (xx, yy))
                xx += TS
            yy += TS
        sd = ImageDraw.Draw(s)
        for px in range(4, pw - 2, 6):
            sd.line([px, 0, px, s.height], fill=(52, 36, 20, 140))
        sd.rectangle([0, 0, pw - 1, s.height - 1], outline=(40, 26, 12, 255))
        sd.line([3, 0, 3, s.height], fill=(104, 76, 46, 255))
        return s
    strip = post_strip()
    for x0 in (lx, rx):
        c.alpha_composite(strip, (x0, y_beam1))
    # --- каменные основания под столбами ---
    for x0 in (lx - 5, rx - 5):
        d.rectangle([x0, y_bot - 14, x0 + pw + 9, y_bot], fill=(74, 68, 60, 255),
                    outline=(52, 46, 40, 255))
        rock = tile('rock_0').resize((pw + 10, 16), Image.NEAREST)
        c.alpha_composite(rock.crop((0, 0, pw + 10, 14)), (x0, y_bot - 14))
    # --- вальмовая кровля над проездом (как у домов деревни) ---
    hip_roof(c, W, 8, y_eave, tex_name='roof_thatch', half_ridge_frac=0.24)
    # --- несущая балка (12px, темнее столбов) ---
    d.rectangle([lx - 4, y_beam0, rx + pw + 4, y_beam1], fill=(84, 60, 34, 255),
                outline=(40, 26, 12, 255))
    d.line([lx - 2, y_beam0 + 2, rx + pw + 2, y_beam0 + 2], fill=(128, 94, 58, 255))
    # --- подкосы под балкой (стойка → балка) ---
    for x0, sgn in ((lx + pw, 1), (rx, -1)):
        d.polygon([(x0, y_beam1 + 22), (x0, y_beam1), (x0 + sgn * 16, y_beam1)],
                  fill=(74, 52, 30, 255), outline=(44, 30, 14, 255))
    # --- фонарь в проезде (компактный тёплый свет) ---
    fx = W // 2
    d.line([fx, y_beam1, fx, y_beam1 + 8], fill=(40, 26, 12, 255), width=2)
    d.polygon([(fx - 7, y_beam1 + 8), (fx + 7, y_beam1 + 8), (fx, y_beam1 + 2)],
              fill=(74, 52, 30, 255))
    d.rectangle([fx - 6, y_beam1 + 8, fx + 6, y_beam1 + 22], fill=(255, 202, 98, 235),
                outline=(40, 26, 12, 255))
    d.line([fx - 2, y_beam1 + 9, fx - 2, y_beam1 + 21], fill=(255, 236, 170, 150))
    for r, a in ((10, 40), (16, 22), (22, 9)):
        d.ellipse([fx - r, y_beam1 + 15 - r, fx + r, y_beam1 + 15 + r],
                  fill=(255, 176, 80, a))
    # --- мягкая внутренняя тень проезда у столбов (глубина арки) ---
    sh = Image.new('RGBA', (6, y_bot - y_beam1), (16, 10, 4, 46))
    c.alpha_composite(sh, (lx + pw, y_beam1))
    c.alpha_composite(sh, (rx - 6, y_beam1))
    c.save(os.path.join(OUT, name + '.png'))
    return name, c.size

# ---------------------------------------------------------------- сборка
def main():
    made = []
    # 3×3 жилые избы — 8 вариантов (чередование стен/крыш/окон)
    made.append(make_house('hp_log_thatch_a', 3, 3, 'wall_log', 'roof_thatch',
                           chim='right', door_offset=-0.35))
    made.append(make_house('hp_log_thatch_b', 3, 3, 'wall_log', 'roof_thatch',
                           win1=True, win2=True, flowers=True, door_offset=0.3))
    made.append(make_house('hp_log_wood_a', 3, 3, 'wall_log', 'roof_wood',
                           chim='left', door_offset=0.3, win_shutters=(96, 66, 40)))
    made.append(make_house('hp_log_wood_b', 3, 3, 'wall_log', 'roof_wood',
                           win2=False, door_offset=-0.4, win_shutters=(70, 96, 60)))
    made.append(make_house('hp_plank_thatch_a', 3, 3, 'wall_plank', 'roof_thatch',
                           chim='right', door_offset=0.0, win_shutters=(120, 60, 44)))
    made.append(make_house('hp_plank_wood_a', 3, 3, 'wall_plank', 'roof_wood',
                           chim=None, door_offset=-0.3, flowers=True))
    made.append(make_house('hp_plaster_thatch_a', 3, 3, 'quaternius/plaster_32',
                           'roof_thatch', chim='left', door_offset=0.25,
                           win_shutters=(120, 60, 44)))
    made.append(make_house('hp_plaster_wood_a', 3, 3, 'quaternius/plaster_32',
                           'roof_wood', win2=False, door_offset=-0.35,
                           win_shutters=(96, 66, 40), flowers=True))
    # 2×3 — узкие дома (ремесленник, мясник)
    made.append(make_house('hp_narrow_thatch', 2, 3, 'wall_log', 'roof_thatch',
                           win2=False, chim='right', door_offset=0.0))
    made.append(make_house('hp_narrow_wood', 2, 3, 'wall_plank', 'roof_wood',
                           win2=False, door_offset=0.0))
    # постоялый двор — двухэтажный (единственный)
    made.append(make_inn())
    # воротня
    made.append(make_gate())
    for n, sz in made:
        print('OK', n, sz)

if __name__ == '__main__':
    main()

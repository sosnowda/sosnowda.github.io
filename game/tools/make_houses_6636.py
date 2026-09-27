#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.36 — ПЕРЕСБОРКА ДОМОВ ИЗ ВОССТАНОВЛЕННОГО ПАКА (приказ владельца):
«исходные листы пака утеряны при пересборке платформы… файлы домов находятся
в папке (Google Drive)» + «заново переделать и пересобрать дома и строения» +
«проверить полностью новую деревню».

Источник: «Fantastic Buildings - Medieval» (Celianna), Tilesets:
  /home/z/my-project/drive-assets/fb_pack_6636/Tilesets/*.png (768x768, RGBA).

ЧТО ИЗМЕНИЛОСЬ ПРОТИВ 66.35: там фасады достраивались из самих себя, потому
что r65-прямоугольники резали здания, а листы были потеряны. Теперь листы
восстановлены владельцем — каждый дом ВЫРЕЗАЕТСЯ ПОЛНОСТЬЮ (щедрые прямоугольники,
чужие фрагменты/тени стёрты явно), и ТОЛЬКО места, где лист пака сам обрезает
здание (край листа), достраиваются зеркалом (pad + grow) — приём 66.35.

Особый случай: церковь — шатёр со звездой лежит в листе ОТДЕЛЬНОЙ деталью
(300..390, 0..142) и СОБИРАЕТСЯ на срезанный верх колокольни (как задумано
в паке), вместо рисованного шатра 66.7.

Свойства:
  - ИДЕМПОТЕНТЕН: читает листы пака, пишет assets/sprites/fb_*.png;
  - перед первой записью бэкапит текущие спрайты в tools/fb_current_6636/;
  - печает отчёт: размеры, касания краёв (mid-content cut vs чистый край);
  - координаты окон/труб housesFX.js обновляются ОТДЕЛЬНО (сдвиги печатаются
    по old_origin vs new_origin — старый r65-вырез воспроизводим из этого же
    пака, см. OLD_R65 ниже).

Запуск: python3 game/tools/make_houses_6636.py
"""
from PIL import Image, ImageDraw
import os, shutil

PACK = '/home/z/my-project/drive-assets/fb_pack_6636/Tilesets'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites')
BAK = os.path.join(ROOT, 'tools', 'fb_current_6636')
os.makedirs(BAK, exist_ok=True)

OPAQUE = 8

# (лист, имя, x0, y0, x1, y1,
#  erases — прямоугольники в КООРДИНАТАХ ЛИСТА (чужие фрагменты/тени),
#  pad — (top, left, right) достройка зеркалом мест, обрезанных КРАЕМ ЛИСТА,
#  gt_gap — зеркальное заполнение прозрачных зазоров СВЕРХУ (0 = выкл.) —
#  нужно там, где стирание чужой детали оставило дыру над кровлей)
BUILDINGS = [
    # Церковь: тело (0..277 — без тени), шатёр собирается отдельно (SPIRE)
    ('Rural_TileD', 'fb_church', 0, 0, 278, 262, [(277, 0, 400, 262)], (26, 0, 0), 0),
    # Постоялый двор: целиком с каменной галереей (арки до пола!)
    ('Rural_TileE', 'fb_inn', 392, 0, 768, 395, [], (14, 0, 22), 0),
    # Кузница: дымовая башня с колпаком, левое окно, горн с наковальней
    ('City_TileB', 'fb_smithy', 383, 33, 537, 397, [], (0, 0, 0), 0),
    # Усадьба старосты: изба + греблянка, обе каменные трубы (мостовая стёрта)
    ('Rural_TileE', 'fb_elder', 0, 0, 392, 287, [], (16, 14, 0), 0),
    # Дом со слуховым окном: труба с колпаком + цветник у левой стены
    ('Rural_TileD', 'fb_manor', 382, 8, 574, 238, [(574, 0, 620, 238)], (0, 0, 0), 0),
    # Большая белёная изба с красными окнами: основание часовни (камень с
    # решётчатым окном) стёрто, кровля достраивается зеркалом вверх
    ('Rural_TileD', 'fb_thatch_big', 388, 246, 734, 484,
     [(733, 0, 768, 484), (634, 228, 708, 276)], (0, 0, 0), 34),
    # Малая изба под соломой: каменная труба (прежде срезалась!); полоса
    # основания дома сверху и кромка тёмного амбара слева стёрты
    ('Rural_TileD', 'fb_thatch_small', 380, 476, 588, 702,
     [(372, 470, 588, 484), (579, 484, 588, 566)], (0, 0, 0), 12),
    # Изба с цветниками (гончар): низ чужого навеса и фонарь стёрты сверху
    ('Rural_TileC', 'fb_log_flowers', 376, 263, 596, 450, [], (0, 0, 0), 0),
    # Изба под тесовой кровлей (Авдей): без угла дома с оленьей головой
    ('Rural_TileC', 'fb_log_thatch', 368, 424, 548, 624, [], (0, 0, 0), 0),
    # Большая изба с крутым кровом (пахарь): тент рынка над трубой стёрт,
    # кровля/труба достраиваются зеркалом вверх
    ('Rural_TileB', 'fb_log_big', 528, 372, 750, 734,
     [(749, 0, 768, 734), (498, 354, 652, 389)], (0, 0, 0), 22),
    # Фахверк с цветниками (дровосек): каменный подвал-арка целиком
    ('City_TileB', 'fb_tudor_fl', 143, 8, 384, 262, [], (0, 0, 0), 0),
    # Узкий фахверк (знахарка): левая стена у КРАЯ ЛИСТА — достройка зеркалом
    ('City_TileB', 'fb_tudor_sm', 0, 18, 142, 326, [], (0, 14, 0), 0),
]

# Шатёр церкви: отдельная деталь в том же листе (полная — не касается края).
# Правая граница 378: дальше (384+) начинается чужая солома кровли дома-усадьбы.
SPIRE = ('Rural_TileD', 298, 0, 378, 142)

# Для пересчёта housesFX: прежние r65-прямоугольники (листы того же пака —
# 8/12 бит-в-бит; Rural_TileD обновлён владельцем пака 2020-07-28, сдвиги
# для него проверяются визуально по сетке).
OLD_R65 = [
    ('Rural_TileD', 'fb_church', 0, 0, 270, 304, []),
    ('Rural_TileE', 'fb_inn', 356, 0, 768, 285, []),
    ('City_TileB', 'fb_smithy', 434, 85, 576, 392, []),
    ('Rural_TileE', 'fb_elder', 0, 0, 358, 254, []),
    ('Rural_TileD', 'fb_manor', 372, 32, 572, 220, []),
    ('Rural_TileD', 'fb_thatch_big', 396, 232, 726, 478, [(394, 374, 413, 434)]),
    ('Rural_TileD', 'fb_thatch_small', 398, 530, 552, 730, []),
    ('Rural_TileC', 'fb_log_flowers', 374, 216, 604, 444, [(578, 394, 604, 444)]),
    ('Rural_TileC', 'fb_log_thatch', 398, 442, 584, 622, []),
    ('Rural_TileB', 'fb_log_big', 532, 384, 768, 730, []),
    ('City_TileB', 'fb_tudor_fl', 145, 0, 382, 235, []),
    ('City_TileB', 'fb_tudor_sm', 0, 36, 130, 318, []),
]


def sheet(name):
    return Image.open(os.path.join(PACK, name + '.png')).convert('RGBA')


def bbox_trim(im):
    bb = im.getbbox()
    return im.crop(bb), bb


def pad(im, top=0, bottom=0, left=0, right=0):
    W, H = im.size
    out = Image.new('RGBA', (W + left + right, H + top + bottom), (0, 0, 0, 0))
    out.alpha_composite(im, (left, top))
    return out


def first_opaque_y(px, x, W, H):
    for y in range(H):
        if px[x, y][3] > OPAQUE:
            return y
    return None


def grow_top(im, max_gap=None):
    """Зеркально заполнить прозрачный зазор НАД контентом каждого столбца."""
    W, H = im.size
    px = im.load()
    if max_gap is None:
        max_gap = H
    for x in range(W):
        ytop = first_opaque_y(px, x, W, H)
        if ytop is None or ytop == 0 or ytop > max_gap:
            continue
        h = ytop
        for k in range(1, h + 1):
            y = h - k
            sy = ytop + k - 1
            if sy >= H:
                sy = H - 1
            px[x, y] = px[x, sy]
    return im


def grow_side(im, side, max_gap=None):
    """Зеркально заполнить прозрачный зазор СЛЕВА/СПРАВА от контента."""
    W, H = im.size
    px = im.load()
    for y in range(H):
        if side == 'l':
            xedge = None
            for x in range(W):
                if px[x, y][3] > OPAQUE:
                    xedge = x
                    break
            if xedge is None or xedge == 0 or (max_gap and xedge > max_gap):
                continue
            w = xedge
            for k in range(1, w + 1):
                x = w - k
                sx = xedge + k - 1
                if sx >= W:
                    sx = W - 1
                px[x, y] = px[sx, y]
        else:
            xedge = None
            for x in range(W - 1, -1, -1):
                if px[x, y][3] > OPAQUE:
                    xedge = x
                    break
            if xedge is None or xedge == W - 1 or (max_gap and (W - 1 - xedge) > max_gap):
                continue
            w = W - 1 - xedge
            for k in range(1, w + 1):
                x = xedge + k
                sx = xedge - (k - 1)
                if sx < 0:
                    sx = 0
                px[x, y] = px[sx, y]
    return im


def cap_slab(im, x0, x1, ytop):
    """Каменный колпак на жерле трубы (зона достроена зеркалом — перекрыть)."""
    d = ImageDraw.Draw(im)
    stone = (118, 108, 96)
    lite = (150, 142, 128)
    dark = (74, 66, 56)
    hole = (40, 34, 28)
    d.rectangle([x0, 0, x1, ytop], fill=stone + (255,), outline=dark + (255,))
    d.rectangle([x0 - 2, 0, x1 + 2, 5], fill=lite + (255,), outline=dark + (255,))
    d.line([x0 - 2, 5, x1 + 2, 5], fill=dark + (255,))
    if x1 - x0 >= 14:
        d.rectangle([x0 + 3, 1, x1 - 3, 4], fill=hole + (255,))
    return im


def edge_report(im, name):
    a = im.split()[3]
    W, H = im.size
    px = a.load()
    top = sum(1 for x in range(W) if px[x, 0] > OPAQUE)
    bottom = sum(1 for x in range(W) if px[x, H - 1] > OPAQUE)
    left = sum(1 for y in range(H) if px[0, y] > OPAQUE)
    right = sum(1 for y in range(H) if px[W - 1, y] > OPAQUE)
    flag = 'CUT?' if (top or left or right) else ''
    print(f'   края {name:16s} top={top} left={left} right={right} bottom={bottom} {flag}')
    return (top, left, right, bottom)


def extract_all():
    out = {}
    for sh, name, x0, y0, x1, y1, erases, (pt, pl, pr), gt_gap in BUILDINGS:
        im = sheet(sh)
        crop = im.crop((x0, y0, x1, y1))
        for ex0, ey0, ex1, ey1 in erases:
            r = Image.new('RGBA', (max(0, ex1 - ex0), max(0, ey1 - ey0)), (0, 0, 0, 0))
            inter = (max(ex0, x0), max(ey0, y0), min(ex1, x1), min(ey1, y1))
            if inter[2] > inter[0] and inter[3] > inter[1]:
                crop.paste(r, (inter[0] - x0, inter[1] - y0))
        if gt_gap:
            grow_top(crop, max_gap=gt_gap)
        crop, bb = bbox_trim(crop)
        origin = (x0 + bb[0], y0 + bb[1])
        # достройка краёв листа: паддинг + зеркальный grow + вторичная обрезка
        if pt or pl or pr:
            crop = pad(crop, top=pt, left=pl, right=pr)
            if pt:
                grow_top(crop, max_gap=pt + 2)
            if pl:
                grow_side(crop, 'l', max_gap=pl + 2)
            if pr:
                grow_side(crop, 'r', max_gap=pr + 2)
            crop, _ = bbox_trim(crop)
        out[name] = (crop, origin)
        print(f'{name:16s} {crop.size[0]:4d}x{crop.size[1]:4d}  origin(лист)={origin}')
    return out


def build_church(body, origin):
    """Тело церкви + аутентичный шатёр пака на колокольню."""
    sh, sx0, sy0, sx1, sy1 = SPIRE
    spire, sbb = bbox_trim(sheet(sh).crop((sx0, sy0, sx1, sy1)))
    # центр колокольни в ТЕЛЕ (в координатах листа: колокольня x 95..190)
    tower_cx_sheet = (95 + 190) / 2
    tower_cx = tower_cx_cand = tower_cx_sheet - origin[0]
    BW, BH = body.size
    SW, SH = spire.size
    overlap = 14                      # шатёр перекрывает срез верха башни
    W = max(BW, int(tower_cx + SW / 2) + 2)
    top_extra = SH - overlap
    H = BH + top_extra
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(body, (0, top_extra))
    canvas.alpha_composite(spire, (int(tower_cx - SW / 2), 0))
    return canvas, int(tower_cx), top_extra


def main():
    print('=== 66.36: вырезка из восстановленных листов пака ===')
    res = extract_all()

    # --- бэкап текущих спрайтов (однократно) ---
    for _, name, *_ in BUILDINGS:
        cur = os.path.join(SPR, name + '.png')
        bak = os.path.join(BAK, name + '.png')
        if os.path.exists(cur) and not os.path.exists(bak):
            shutil.copy2(cur, bak)

    # --- церковь: тело + шатёр ---
    body, origin = res['fb_church']
    church, tower_cx, top_extra = build_church(body, origin)
    res['fb_church'] = (church, origin, {'tower_cx': tower_cx, 'top_extra': top_extra})
    print(f'fb_church с шатром: {church.size} (башня cx={tower_cx}, шатёр +{top_extra}px)')

    print('=== запись ===')
    for name, val in res.items():
        im = val[0]
        im.save(os.path.join(SPR, name + '.png'))
        print('OK', name, im.size)
        edge_report(im, name)

    # --- сдвиги для housesFX (старый r65 origin против нового) ---
    print('=== сдвиги координат housesFX (old_origin - new_origin) ===')
    sheet_cache = {}
    for sh, name, x0, y0, x1, y1, erases in OLD_R65:
        if sh not in sheet_cache:
            sheet_cache[sh] = sheet(sh)
        crop = sheet_cache[sh].crop((x0, y0, x1, y1))
        for ex0, ey0, ex1, ey1 in erases:
            r = Image.new('RGBA', (ex1 - ex0, ey1 - ey0), (0, 0, 0, 0))
            crop.paste(r, (ex0 - x0, ey0 - y0))
        _, bb = bbox_trim(crop)
        old_origin = (x0 + bb[0], y0 + bb[1])
        new_origin = res[name][1]
        dx = old_origin[0] - new_origin[0]
        dy = old_origin[1] - new_origin[1]
        print(f'{name:16s} old={old_origin} new={new_origin}  d=(x{dx:+d}, y{dy:+d})')

    # --- контактный лист для визуальной проверки ---
    names = [b[1] for b in BUILDINGS]
    CELL = 300
    contact = Image.new('RGBA', (CELL * 4, CELL * 3), (210, 205, 190, 255))
    d = ImageDraw.Draw(contact)
    for i, n in enumerate(names):
        im = res[n][0]
        s = min((CELL - 40) / im.width, (CELL - 40) / im.height)
        r = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
        x = (i % 4) * CELL
        y = (i // 4) * CELL
        contact.alpha_composite(r, (x + 20, y + 26))
        d.text((x + 8, y + 6), f'{n} {im.size[0]}x{im.size[1]}', fill=(120, 30, 30))
    contact.convert('RGB').save(os.path.join(ROOT, 'tools', 'fb_contact_6636.png'))
    print('контактный лист: tools/fb_contact_6636.png')


if __name__ == '__main__':
    main()

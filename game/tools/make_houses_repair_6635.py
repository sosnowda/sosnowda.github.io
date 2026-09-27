#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.35 — РЕМОНТ ФАСАДОВ fb_* (приказы владельца 3-5):
«проверять чтобы у всех домов не было обрезаны части стен, крыш и труб,
чтобы у церкви не была обрезана сверху колокольня».

Исходные листы пака «Fantastic Buildings - Medieval» утеряны (пересборка
платформы стёрла /home/z/fb_pack), поэтому каждый фасад ДОСТРАИВАЕТСЯ из
самого себя:
  grow_top   — зеркальное продолжение контента вверх (коньки крыш);
  grow_side  — зеркальное продолжение влево/вправо (срезанные стены/скаты);
  cap_slab   — каменный козырёк печной трубы (срезанные трубы);
  ridge_log  — коньковое бревно (бревенчатые фронтоны);
  corner_post— угловой столб-замок на новой кромке (как в паке);
  крест церкви — достройка срезанного верха (шатёр 66.7 не трогаем).

Генератор ИДЕМПОТЕНТЕН: при первом запуске копирует оригиналы в
tools/fb_originals_6635/ и читает оттуда; повторный запуск воспроизводит
тот же результат.

Выход: assets/sprites/fb_*.png (12 шт.) + отчёт о новых размерах.
Координаты окон/труб в src/data/housesFX.js обновляются ОТДЕЛЬНО
(сдвиги печатает этот скрипт).
"""
from PIL import Image, ImageDraw
import os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites')
BAK = os.path.join(ROOT, 'tools', 'fb_originals_6635')
os.makedirs(BAK, exist_ok=True)

NAMES = ['fb_church', 'fb_inn', 'fb_smithy', 'fb_elder', 'fb_manor',
         'fb_thatch_big', 'fb_thatch_small', 'fb_log_flowers', 'fb_log_thatch',
         'fb_log_big', 'fb_tudor_fl', 'fb_tudor_sm']

OPAQUE = 8  # порог альфы


def load(name):
    """Оригинал (для идемпотентности) или текущий файл."""
    bak = os.path.join(BAK, name + '.png')
    if not os.path.exists(bak):
        shutil.copy2(os.path.join(SPR, name + '.png'), bak)
    return Image.open(bak).convert('RGBA')


def save(name, im):
    im.save(os.path.join(SPR, name + '.png'))
    print('OK', name, im.size)


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


def first_opaque_x(px, y, W, H):
    for x in range(W):
        if px[x, y][3] > OPAQUE:
            return x
    return None


def grow_top(im, max_gap=None, x_limit=None):
    """Зеркально продолжить контент ВВЕРХ: для каждого столбца с прозрачным
    зазором над первой непрозрачной строкой заполнить зазор отражением строк
    снизу. max_gap — максимальная высота зазора (по умолчанию паддинг+2)."""
    W, H = im.size
    px = im.load()
    if max_gap is None:
        max_gap = H  # без ограничения
    for x in range(W):
        if x_limit and not (x_limit[0] <= x < x_limit[1]):
            continue
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


def grow_side(im, side, max_gap=None, y_limit=None):
    """Зеркально продолжить контент ВЛЕВО (side='l') или ВПРАВО (side='r')."""
    W, H = im.size
    px = im.load()
    for y in range(H):
        if y_limit and not (y_limit[0] <= y < y_limit[1]):
            continue
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


def erase(im, box):
    im.paste((0, 0, 0, 0), box)
    return im


def avg_color(im, box):
    """Средний цвет непрозрачных пикселей зоны."""
    crop = im.crop(box)
    px = crop.load()
    r = g = b = n = 0
    for y in range(crop.size[1]):
        for x in range(crop.size[0]):
            p = px[x, y]
            if p[3] > 128:
                r += p[0]; g += p[1]; b += p[2]; n += 1
    if not n:
        return (90, 70, 50)
    return (r // n, g // n, b // n)


def cap_slab(im, x0, x1, ytop, color=None):
    """Каменный козырёк трубы на жерле: светлая плита чуть шире ствола,
    тёмный верхний шов и тёмное жерло в центре. Камень — палитра пака."""
    d = ImageDraw.Draw(im)
    stone = (118, 108, 96)
    lite = (150, 142, 128)
    dark = (74, 66, 56)
    hole = (40, 34, 28)
    # ствол продолжить до самого верха
    d.rectangle([x0, 0, x1, ytop], fill=stone + (255,), outline=dark + (255,))
    # плита-козырёк
    d.rectangle([x0 - 2, 0, x1 + 2, 5], fill=lite + (255,), outline=dark + (255,))
    d.line([x0 - 2, 5, x1 + 2, 5], fill=dark + (255,))
    # жерло (тёмный проём) — если ствол достаточно широк
    if x1 - x0 >= 14:
        d.rectangle([x0 + 3, 1, x1 - 3, 4], fill=hole + (255,))
    return im


def ridge_log(im, x0, x1, y, color):
    """Коньковое бревно поверх срезанного фронтона (бревенчатые избы)."""
    d = ImageDraw.Draw(im)
    lite = tuple(min(255, c + 26) for c in color)
    dark = tuple(max(0, c - 60) for c in color)
    d.rectangle([x0, y, x1, y + 8], fill=color + (255,), outline=dark + (255,))
    d.line([x0 + 1, y + 1, x1 - 1, y + 1], fill=lite + (255,))
    # торцы-срезы по краям бревна
    for ex in (x0, x1):
        d.ellipse([ex - 2, y + 1, ex + 2, y + 7], fill=lite + (255,), outline=dark + (255,))
    return im


def shadow_wall(im, box, plank=14):
    """Заполнить прозрачные карманы в зоне box тёмной стеной в тени
    (западующее под навесом крыло): тёмное дерево с редкими досками."""
    x0, y0, x1, y1 = box
    px = im.load()
    base = (52, 38, 24)
    dark = (38, 27, 16)
    lite = (66, 50, 32)
    d = ImageDraw.Draw(im)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y][3] <= OPAQUE:
                px[x, y] = (base + (255,)) if (y % plank) else (dark + (255,))
    # лёгкие вертикальные доски
    for x in range(x0 + 4, x1, 9):
        d.line([x, y0, x, y1], fill=lite + (120,))
    return im


def ridge_roll(im, skip=(), min_run=16):
    """Коньковый валик вдоль плоского верха: для горизонтальных серий
    столбцов с контентом у верхней кромки (длиной ≥ min_run) перерисовать
    верхние 5px тёмной гребёнкой соломы с светлым верхним гребнем.
    skip — диапазоны (x0,x1) труб/козырьков, их не трогать."""
    W, H = im.size
    px = im.load()
    def blocked(x):
        return any(a <= x <= b for a, b in skip)
    # верхний ряд: столбцы с контентом на y=0
    cols = [x for x in range(W) if px[x, 0][3] > OPAQUE and not blocked(x)]
    # разбить на серии
    runs = []
    start = None
    prev = None
    for x in cols:
        if start is None:
            start = x
        elif x != prev + 1:
            runs.append((start, prev))
            start = x
        prev = x
    if start is not None:
        runs.append((start, prev))
    for x0, x1 in runs:
        if x1 - x0 + 1 < min_run:
            continue
        # цвет соломы под гребнем (усреднить) — темнее для валика
        ys = 8
        col = avg_color(im, (x0, 6, min(x1, x0 + 40), 6 + ys))
        dark = tuple(max(0, c - 46) for c in col)
        lite = tuple(min(255, c + 20) for c in col)
        d = ImageDraw.Draw(im)
        d.rectangle([x0, 0, x1, 4], fill=dark + (255,))
        d.line([x0, 0, x1, 0], fill=lite + (255,))
        # зубчики по нижней кромке валика (гребёнка соломы, неровная)
        for i, x in enumerate(range(x0, x1 + 1, 3)):
            dd = 5 if i % 2 else 7
            d.line([x, 4, x + 1, dd], fill=dark + (255,))
    return im


def corner_post(im, x, y0, y1, side='l'):
    """Угловой столб-замок на новой кромке (тёмное бревно с бликом)."""
    d = ImageDraw.Draw(im)
    w = 5
    wood = (74, 52, 30)
    lite = (110, 82, 50)
    dark = (40, 26, 14)
    if side == 'l':
        d.rectangle([x, y0, x + w, y1], fill=wood + (255,), outline=dark + (255,))
        d.line([x + 1, y0 + 1, x + 1, y1 - 1], fill=lite + (255,))
    else:
        d.rectangle([x - w, y0, x, y1], fill=wood + (255,), outline=dark + (255,))
        d.line([x - w + 1, y0 + 1, x - w + 1, y1 - 1], fill=lite + (255,))
    return im


def bbox_report(im, name):
    a = im.split()[3]
    W, H = im.size
    px = a.load()
    top = sum(1 for x in range(W) if px[x, 0] > OPAQUE)
    bottom = sum(1 for x in range(W) if px[x, H - 1] > OPAQUE)
    left = sum(1 for y in range(H) if px[0, y] > OPAQUE)
    right = sum(1 for y in range(H) if px[W - 1, y] > OPAQUE)
    print(f"   bbox-края {name}: top={top} left={left} right={right} bottom={bottom}")


# ======================================================================
def repair_church():
    """fb_church: паддинг +10 сверху, достройка срезанного верха креста."""
    im = load('fb_church')            # 263x340
    im = pad(im, top=10)              # 263x350
    # вертикальная перекладина креста: x 185-190, цвет из (187,14)
    col = avg_color(im, (185, 14, 191, 20))
    d = ImageDraw.Draw(im)
    d.rectangle([186, 4, 190, 16], fill=col + (255,))
    # верхняя перекладина креста (9px) — восьмиконечная схема
    d.rectangle([184, 4, 192, 6], fill=tuple(min(255, c + 24) for c in col) + (255,))
    save('fb_church', im)
    bbox_report(im, 'church')
    return {'dy': 10, 'dx': 0}


def repair_inn():
    """fb_inn: +16 слева (крыло), +12 сверху (конёк), труба-козырёк, столбы."""
    im = load('fb_inn')               # 412x285
    im = pad(im, top=12, left=16)     # 428x297
    grow_side(im, 'l', max_gap=18)    # продолжить крыло влево
    grow_top(im, max_gap=14)          # конёк главного корпуса
    # труба: ориг. x 33-63 -> падд. x 49-79; жерло было срезано (y=0)
    cap_slab(im, 52, 76, 12)
    ridge_roll(im, skip=((44, 84),))
    # западающий карман под навесом левого крыла — тёмная стена в тени
    shadow_wall(im, (0, 128, 40, 296))
    corner_post(im, 0, 130, im.size[1] - 1, 'l')
    save('fb_inn', im)
    bbox_report(im, 'inn')
    return {'dy': 12, 'dx': 16}


def repair_smithy():
    """fb_smithy: стереть чужую кромку справа, +8 слева/+12 сверху,
    конёк, труба-козырёк, угловые столбы."""
    im = load('fb_smithy')            # 142x307
    erase(im, (118, 0, 142, 307))     # чужая кровля/сруб соседнего корпуса
    im = im.crop((0, 0, 118, 307))    # мёртвую зону справа — срезать насовсем
    im = pad(im, top=12, left=8, right=12)   # 138x319
    grow_side(im, 'l', max_gap=10)
    grow_side(im, 'r', max_gap=14)
    grow_top(im, max_gap=14)
    # труба слева: срезана и сверху и слева (столб x 0-45 -> 8-53 падд.)
    cap_slab(im, 12, 50, 12)
    ridge_roll(im, skip=((6, 56),))
    corner_post(im, 0, 200, im.size[1] - 1, 'l')
    corner_post(im, im.size[0] - 1, 170, im.size[1] - 1, 'r')
    save('fb_smithy', im)
    bbox_report(im, 'smithy')
    return {'dy': 12, 'dx': 8}


def repair_elder():
    """fb_elder: +16 слева/справа (фронтон и крыло), +12 сверху (конёк)."""
    im = load('fb_elder')             # 358x254
    im = pad(im, top=12, left=16, right=16)  # 390x266
    grow_side(im, 'l', max_gap=18)
    grow_side(im, 'r', max_gap=18)
    grow_top(im, max_gap=14)
    ridge_roll(im, skip=((132, 152), (188, 208)))  # трубы старосты
    corner_post(im, 0, 150, im.size[1] - 1, 'l')
    corner_post(im, im.size[0] - 1, 150, im.size[1] - 1, 'r')
    save('fb_elder', im)
    bbox_report(im, 'elder')
    return {'dy': 12, 'dx': 16}


def repair_manor():
    """fb_manor: +12 сверху (конёк и срез трубы)."""
    im = load('fb_manor')             # 200x188
    im = pad(im, top=12)              # 200x200
    grow_top(im, max_gap=14)
    cap_slab(im, 58, 88, 12)
    ridge_roll(im, skip=((54, 92),))
    save('fb_manor', im)
    bbox_report(im, 'manor')
    return {'dy': 12, 'dx': 0}


def repair_thatch_big():
    """fb_thatch_big: стереть чужие фрагменты, +14 сверху (конёк и 2 трубы),
    правый край достроить, слева чужой камень стереть."""
    im = load('fb_thatch_big')        # 330x246
    # чужой фрагмент (фахверк с решётчатым окном) занимает (262,0)-(330,98)
    erase(im, (262, 0, 330, 98))
    # провал в собственной кровле под ним заполнить соломой снизу
    band = im.crop((262, 100, 330, 198))
    im.paste(band, (262, 0))
    # и плавный стык: 6 строк у шва взять из зоны шва
    seam = im.crop((262, 94, 330, 106))
    im.paste(seam, (262, 92))
    erase(im, (0, 190, 22, 232))      # чужой камень у левого края
    im = pad(im, top=14, right=14)    # 344x260
    grow_side(im, 'r', max_gap=16)
    grow_top(im, max_gap=16)
    # две трубы над коньком (ориг. жерла (117,0) и (206,0) -> +14)
    cap_slab(im, 108, 126, 14)
    cap_slab(im, 197, 215, 14)
    ridge_roll(im, skip=((102, 132), (191, 221)))
    corner_post(im, im.size[0] - 1, 150, im.size[1] - 1, 'r')
    save('fb_thatch_big', im)
    bbox_report(im, 'thatch_big')
    return {'dy': 14, 'dx': 0}


def repair_thatch_small():
    """fb_thatch_small: +12 сверху (конёк), труба 66.7 не тронута."""
    im = load('fb_thatch_small')      # 154x190
    im = pad(im, top=12)              # 154x202
    grow_top(im, max_gap=14)
    ridge_roll(im, skip=((96, 130),))  # труба 66.7 (102-124)
    save('fb_thatch_small', im)
    bbox_report(im, 'thatch_small')
    return {'dy': 12, 'dx': 0}


def repair_log_flowers():
    """fb_log_flowers: стереть фонарь и чужие обрезки, достроить фронтон
    (+14 сверху), коньковое бревно."""
    im = load('fb_log_flowers')       # 230x228
    erase(im, (0, 0, 30, 30))         # чужие брусья у левого края
    # ВАЖНО: чёрная «труба-фонарь» (x 37-49, y 33-58) — ЛЕГИТИМНАЯ чёрная
    # печная труба (метаданные 66.7, chimneys [[55,30]]) — НЕ трогаем!
    im = pad(im, top=14)              # 230x242
    grow_top(im, max_gap=16)
    col = avg_color(im, (60, 20, 170, 34))
    ridge_log(im, 34, 196, 0, col)
    save('fb_log_flowers', im)
    bbox_report(im, 'log_flowers')
    return {'dy': 14, 'dx': 0}


def repair_log_thatch():
    """fb_log_thatch: стереть срезанныеслеги справа, +12 сверху/+10 справа,
    конёк-бревно, столб; «жердь»-трубу увенчать козырьком."""
    im = load('fb_log_thatch')        # 186x180
    erase(im, (125, 0, 186, 78))      # срезанные диагональные слеги
    im = pad(im, top=12, right=10)    # 196x192
    grow_side(im, 'r', max_gap=12)
    grow_top(im, max_gap=14)
    # верх «жерди»-трубы (x 88-122): стереть зеркальную копию козырька,
    # нарисовать честный козырёк
    erase(im, (86, 12, 124, 28))
    cap_slab(im, 90, 120, 28)
    corner_post(im, im.size[0] - 1, 60, im.size[1] - 1, 'r')
    save('fb_log_thatch', im)
    bbox_report(im, 'log_thatch')
    return {'dy': 12, 'dx': 0}


def repair_log_big():
    """fb_log_big: +16 сверху (труба у конька + вершинка щипца), козырёк."""
    im = load('fb_log_big')           # 236x346
    im = pad(im, top=16)              # 236x362
    grow_top(im, max_gap=18)
    cap_slab(im, 168, 206, 16)
    ridge_roll(im, skip=((162, 212),))
    save('fb_log_big', im)
    bbox_report(im, 'log_big')
    return {'dy': 16, 'dx': 0}


def repair_tudor_fl():
    """fb_tudor_fl: +8 сверху (козырёк трубы)."""
    im = load('fb_tudor_fl')          # 237x222
    im = pad(im, top=8)               # 237x230
    grow_top(im, max_gap=10)
    cap_slab(im, 22, 58, 8)
    save('fb_tudor_fl', im)
    bbox_report(im, 'tudor_fl')
    return {'dy': 8, 'dx': 0}


def repair_tudor_sm():
    """fb_tudor_sm: +12 сверху (вершинка кровли и коньковый столбик)."""
    im = load('fb_tudor_sm')          # 130x282
    im = pad(im, top=12)              # 130x294
    grow_top(im, max_gap=14)
    cap_slab(im, 64, 80, 12)
    ridge_roll(im, skip=((58, 86),))
    save('fb_tudor_sm', im)
    bbox_report(im, 'tudor_sm')
    return {'dy': 12, 'dx': 0}


if __name__ == '__main__':
    shifts = {}
    shifts['fb_church'] = repair_church()
    shifts['fb_inn'] = repair_inn()
    shifts['fb_smithy'] = repair_smithy()
    shifts['fb_elder'] = repair_elder()
    shifts['fb_manor'] = repair_manor()
    shifts['fb_thatch_big'] = repair_thatch_big()
    shifts['fb_thatch_small'] = repair_thatch_small()
    shifts['fb_log_flowers'] = repair_log_flowers()
    shifts['fb_log_thatch'] = repair_log_thatch()
    shifts['fb_log_big'] = repair_log_big()
    shifts['fb_tudor_fl'] = repair_tudor_fl()
    shifts['fb_tudor_sm'] = repair_tudor_sm()
    print('\n=== СДВИГИ КООРДИНАТ ДЛЯ housesFX.js (dx, dy) ===')
    for k, v in shifts.items():
        print(f"{k}: dx={v['dx']} dy={v['dy']}")

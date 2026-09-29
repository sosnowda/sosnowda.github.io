#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.44 (приказ 1): ПЕРЕДЕЛКА ТАЙЛОВ ДОРОЖЕК ко всем домам.

Прежние tile_path_0..3 — плоские «шоколадные батоны»: жёсткая тёмная полоса
посередине, прямые машинные края, ни кромки с травой — дорожка читалась как
коричневая плашка, положенная ПОВЕРХ газона.

Новые тайлы (32×32, палитра ≤255, суперсемплинг ×4):
  • песчаная лента с НЕРОВНЫМИ краями и мягкой альфа-кромкой;
  • зелёная бахрома травы вдоль закрытых сторон — дорожка «растёт из газона»;
  • колеи, камешки, песчаный шум;
  • автотайл-геометрия прежняя (roadTileSpec в world.js НЕ тронут):
      path_0 — горизонталь (открыты лево/право),
      path_1 — вертикаль  (открыты верх/низ),
      path_2 — угол ↑← при 0° (поворачивается кодом на 90/180/270),
      path_3 — крест/Т (открыты все 4 стороны).
Идемпотентен: перезапись под теми же ключами.
Запуск: python3 game/tools/make_paths_6644.py
"""

import math
import random
from PIL import Image, ImageDraw

OUT = 'game/assets/tiles'
SS = 4                 # суперсемплинг ×4 → 128 → LANCZOS в 32
S = 32 * SS            # 128

SAND_BASE   = (176, 141, 92)
SAND_LIGHT  = (196, 163, 112)
SAND_DARK   = (150, 116, 72)
RUT_DARK    = (128, 96, 58)
STONE       = (172, 160, 142)
STONE_DARK  = (128, 118, 102)
GRASS_TUFT  = (86, 122, 56)
GRASS_TUFT2 = (108, 144, 68)

BAND0, BAND1 = 10, 21  # номинальная лента 10..21 (в координатах 32)

random.seed(6644)


def _wobble(t, freq, phase=0.0):
    return math.sin(t / S * math.pi * 2 * freq + freq * 13.7 + phase)


def edge_alpha(dist_px):
    """Альфа-спад у кромки: 1 внутри, к 0 за ~1.2px (в масштабе 32)."""
    if dist_px <= 0:
        return 0
    if dist_px >= 1.2:
        return 255
    return int(255 * (dist_px / 1.2) ** 0.7)


def spans(along):
    """Волнистые границы ленты: (lo, hi) поперёк от продольной координаты (SS)."""
    lo = BAND0 * SS + int(2.2 * SS * (0.6 * _wobble(along, 0.9) + 0.4 * _wobble(along, 2.1, 1.3)))
    hi = BAND1 * SS + int(2.2 * SS * (0.6 * _wobble(along + 91, 1.1) + 0.4 * _wobble(along + 37, 2.4)))
    return lo, hi


def paint_band(px_img, vertical, open_edges, x_range=None, y_range=None,
               fade_from=None, fade_len=None):
    """Песчаная лента по объединяемой области.

    vertical=False: лента вдоль X, границы — по Y (lo/hi от x).
    vertical=True : лента вдоль Y, границы — по X (lo/hi от y).
    x_range/y_range: ограничение продольной координаты (для угла).
    fade_from: продольная координата (SS), с которой начинается мягкий
    спад альфы хвоста (для углового тайла); fade_len — длина спада.
    """
    for along in range(S):
        if x_range is not None and not (x_range[0] <= along <= x_range[1]):
            continue
        if y_range is not None and not (y_range[0] <= along <= y_range[1]):
            continue
        lo, hi = spans(along)
        for across in range(S):
            al = min(edge_alpha((across - lo) / SS), edge_alpha((hi - across) / SS))
            if al <= 0:
                continue
            # хвост ленты — мягкий продольный спад (угол)
            if fade_from is not None and fade_len and along > fade_from:
                al = int(al * max(0.0, 1.0 - (along - fade_from) / fade_len))
            # открытые кромки тайла — без спада
            if vertical:
                px, py = across, along
                if along <= SS and 'top' in open_edges:
                    al = max(al, 255 if across >= BAND0 * SS and across <= BAND1 * SS else al)
                if along >= S - SS and 'bottom' in open_edges:
                    al = max(al, 255 if across >= BAND0 * SS and across <= BAND1 * SS else al)
            else:
                px, py = along, across
                if along <= SS and 'left' in open_edges:
                    al = max(al, 255 if across >= BAND0 * SS and across <= BAND1 * SS else al)
                if along >= S - SS and 'right' in open_edges:
                    al = max(al, 255 if across >= BAND0 * SS and across <= BAND1 * SS else al)
            if al <= 0:
                continue
            # шум песка
            n = random.random()
            col = SAND_LIGHT if n < 0.14 else (SAND_DARK if n < 0.30 else SAND_BASE)
            cur = px_img[px, py]
            if cur[3] < al:
                px_img[px, py] = col + (al,)


def paint_noise(px_img, only_opaque=True, n=900):
    for _ in range(n):
        x, y = random.randint(0, S - 1), random.randint(0, S - 1)
        cur = px_img[x, y]
        if only_opaque and cur[3] < 200:
            continue
        r = random.random()
        col = SAND_LIGHT if r < 0.4 else (SAND_DARK if r < 0.7 else SAND_BASE)
        px_img[x, y] = col + (cur[3],)


def paint_ruts(px_img, vertical, along_range=None):
    """Колеи: две тёмные полосы вдоль ленты + дуга в углу."""
    a0, a1 = along_range if along_range else (SS, S - SS)
    for along in range(a0, a1):
        lo, hi = spans(along)
        if hi - lo < SS * 4:
            continue
        mid, half = (lo + hi) / 2, (hi - lo) / 2
        for off in (-0.42, 0.42):
            c = mid + off * half
            w = max(0.8, half * 0.14)
            for k in range(-int(w), int(w) + 1):
                across = int(c) + k
                if not (lo + SS * 0.6 <= across <= hi - SS * 0.6):
                    continue
                px, py = (across, along) if vertical else (along, across)
                if 0 <= px < S and 0 <= py < S:
                    cur = px_img[px, py]
                    if cur[3] > 140:
                        px_img[px, py] = RUT_DARK + (min(150, cur[3]),)


def paint_stones(px_img, n=22, along_range=None):
    a0, a1 = along_range if along_range else (SS, S - SS)
    for _ in range(n):
        along = random.randint(a0, a1 - 1)
        lo, hi = spans(along)
        if hi - lo < SS * 3:
            continue
        across = random.randint(int(lo + SS), int(hi - SS - 1))
        px, py = (across, along) if random.random() < 0.5 else (along, across)
        r = random.choice((1, 1, SS // 4))
        col = STONE if random.random() < 0.6 else STONE_DARK
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    x2, y2 = px + dx, py + dy
                    if 0 <= x2 < S and 0 <= y2 < S and px_img[x2, y2][3] > 120:
                        px_img[x2, y2] = col + (235,)


def paint_fringe(px_img, vertical, open_edges, along_range=None):
    """Зелёная бахрома травы вдоль закрытых поперечных кромок."""
    a0, a1 = along_range if along_range else (SS, S - SS)
    for along in range(a0, a1):
        # у открытых торцов бахромы нет (стык с соседним тайлом)
        if vertical and ((along <= SS * 1.5 and 'top' in open_edges) or
                         (along >= S - SS * 1.5 and 'bottom' in open_edges)):
            continue
        if not vertical and ((along <= SS * 1.5 and 'left' in open_edges) or
                             (along >= S - SS * 1.5 and 'right' in open_edges)):
            continue
        lo, hi = spans(along)
        for side, edge in (('lo', lo), ('hi', hi)):
            if random.random() < 0.34:
                ln = random.randint(SS // 2, SS)
                col = GRASS_TUFT if random.random() < 0.5 else GRASS_TUFT2
                for k in range(ln):
                    across = edge - k if side == 'lo' else edge + k
                    if not (0 <= across < S):
                        break
                    px, py = (across, along) if vertical else (along, across)
                    al = max(0, 210 - k * 80)
                    if px_img[px, py][3] < al:
                        px_img[px, py] = col + (al,)


def make_h(open_edges):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    paint_band(px, False, open_edges)
    paint_noise(px)
    paint_ruts(px, False)
    paint_stones(px)
    paint_fringe(px, False, open_edges)
    return img


def make_v(open_edges):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    paint_band(px, True, open_edges)
    paint_noise(px)
    paint_ruts(px, True)
    paint_stones(px)
    paint_fringe(px, True, open_edges)
    return img


def make_cross():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    oe = {'top', 'bottom', 'left', 'right'}
    paint_band(px, False, oe)
    paint_band(px, True, oe)
    paint_noise(px)
    paint_ruts(px, False)
    paint_ruts(px, True)
    paint_stones(px, n=30)
    paint_fringe(px, False, oe)
    paint_fringe(px, True, oe)
    return img


def make_corner():
    """Угол ↑← при 0°: открытые top (x 10..21) и left (y 10..21).

    ОСЕВАЯ ЛИНИЯ (поле расстояний, SS-координаты):
      вертикаль x=62 (от верха) → дуга r=22 с центром (40,40) → горизонталь y=62 (к левому краю).
    Полоса = точки с расстоянием до оси ≤ 22; альфа-кромка по краю,
    песчаный шум, колея по оси, бахрома травы снаружи дуги и на хвостах.
    """
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    CX = (BAND0 + BAND1) // 2 * SS   # 62 — осевая линия
    R = (BAND1 - BAND0) // 2 * SS    # 22 — полуширина
    ACX, ACY = BAND0 * SS, BAND0 * SS  # 40,40 — центр дуги

    def axis_dist(x, y):
        # вертикальный сегмент (x=62, y от -20 до 40)
        if y <= ACY:
            d1 = abs(x - CX) if y >= -20 else math.hypot(x - CX, y - max(y, -20))
        else:
            d1 = math.hypot(x - CX, y - ACY)  # расстояние до конца сегмента
        # горизонтальный сегмент (y=62, x от -20 до 40)
        if x <= ACX:
            d3 = abs(y - CX) if x >= -20 else math.hypot(x - max(x, -20), y - CX)
        else:
            d3 = math.hypot(x - ACX, y - CX)
        # дуга (только в квадранте x>=40, y>=40)
        if x >= ACX and y >= ACY:
            d2 = abs(math.hypot(x - ACX, y - ACY) - R)
        else:
            d2 = 1e9
        return min(d1, d2, d3)

    HALF = R
    for y in range(S):
        for x in range(S):
            d = axis_dist(x, y) + random.uniform(-1.2, 1.2)
            al = edge_alpha((HALF - d) / SS)
            if al <= 0:
                continue
            # открытые кромки: top при x в ленте, left при y в ленте
            if y <= SS and abs(x - CX) <= HALF:
                al = 255
            if x <= SS and abs(y - CX) <= HALF:
                al = 255
            n = random.random()
            col = SAND_LIGHT if n < 0.14 else (SAND_DARK if n < 0.30 else SAND_BASE)
            px[x, y] = col + (al,)

    # шум
    for _ in range(700):
        x, y = random.randint(0, S - 1), random.randint(0, S - 1)
        if px[x, y][3] > 200:
            r = random.random()
            col = SAND_LIGHT if r < 0.4 else (SAND_DARK if r < 0.7 else SAND_BASE)
            px[x, y] = col + (px[x, y][3],)

    # колея вдоль оси (точки оси, загущённые)
    for t in range(-16, 96, 1):
        # вертикаль
        if t <= 40:
            for off in (-6, 6):
                xi, yi = CX + off, t
                if 0 <= xi < S and 0 <= yi < S and px[xi, yi][3] > 140:
                    px[xi, yi] = RUT_DARK + (140,)
        # горизонталь
        if t <= 40:
            for off in (-6, 6):
                xi, yi = t, CX + off
                if 0 <= xi < S and 0 <= yi < S and px[xi, yi][3] > 140:
                    px[xi, yi] = RUT_DARK + (140,)
    # дуга колеи
    for adeg in range(0, 92, 2):
        ang = math.radians(adeg)
        for rr in (R - 6, R + 6):
            xi = int(ACX + R + rr * math.cos(ang) - R)
            yi = int(ACY + R + rr * math.sin(ang) - R)
            # центр дуги (40,40), радиус оси 22; колея на 22±6
            xi = int(ACX + (R) * math.cos(ang)) + int(6 * math.cos(ang) * 0)  # упрощение ниже
        # честно: точки на радиусах 16 и 28 от центра дуги
        for rr in (R - 6, R + 6):
            xi = int(ACX + rr * math.cos(ang))
            yi = int(ACY + rr * math.sin(ang))
            if 0 <= xi < S and 0 <= yi < S and px[xi, yi][3] > 140:
                px[xi, yi] = RUT_DARK + (130,)

    # камешки
    for _ in range(14):
        x, y = random.randint(SS, S - SS), random.randint(SS, S - SS)
        if px[x, y][3] > 180 and axis_dist(x, y) < R - SS:
            r = random.choice((1, 1, SS // 4))
            col = STONE if random.random() < 0.6 else STONE_DARK
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r and 0 <= x + dx < S and 0 <= y + dy < S:
                        px[x + dx, y + dy] = col + (235,)

    # бахрома травы: снаружи дуги (радиус > R) и вдоль внешних краёв хвостов
    for adeg in range(0, 362, 3):
        ang = math.radians(adeg)
        if random.random() < 0.5:
            rr = R + random.randint(1, SS)
            xi = int(ACX + rr * math.cos(ang))
            yi = int(ACY + rr * math.sin(ang))
            if 0 <= xi < S and 0 <= yi < S and px[xi, yi][3] < 160:
                col = GRASS_TUFT if random.random() < 0.5 else GRASS_TUFT2
                px[xi, yi] = col + (200,)
    # бахрома вдоль нижнего края вертикального хвоста (x = CX±R, y от 0 до 40)
    for y in range(0, ACY, 2):
        for xedge in (CX - R, CX + R):
            if random.random() < 0.4:
                off = random.randint(1, SS)
                xi = xedge - off if xedge == CX + R else xedge - off
                xi = xedge + (off if xedge == CX + R else -off)
                if 0 <= xi < S and px[xi, y][3] < 160:
                    col = GRASS_TUFT if random.random() < 0.5 else GRASS_TUFT2
                    px[xi, y] = col + (190,)
    # бахрома вдоль правого края горизонтального хвоста
    for x in range(0, ACX, 2):
        for yedge in (CX - R, CX + R):
            if random.random() < 0.4:
                off = random.randint(1, SS)
                yi = yedge + (off if yedge == CX + R else -off)
                if 0 <= yi < S and px[x, yi][3] < 160:
                    col = GRASS_TUFT if random.random() < 0.5 else GRASS_TUFT2
                    px[x, yi] = col + (190,)
    return img


def quantize(im):
    return im.convert('RGBA').quantize(
        colors=255, method=Image.FASTOCTREE, dither=Image.NONE)


def main():
    tiles = {
        'path_0': make_h({'left', 'right'}),
        'path_1': make_v({'top', 'bottom'}),
        'path_2': make_corner(),
        'path_3': make_cross(),
    }
    for name, im in tiles.items():
        im32 = im.resize((32, 32), Image.LANCZOS)
        q = quantize(im32)
        q.save(f'{OUT}/{name}.png')
        print(f'{name}.png: {q.size}, mode={q.mode}, colors={len(q.getcolors(65536) or [])}')

    # Контактный лист на травяном фоне ×3
    bg = Image.new('RGB', (4 * 96 + 50, 96 + 20), (94, 130, 60))
    x = 10
    for name, im in tiles.items():
        big = im.resize((96, 96), Image.NEAREST)
        bg.paste(big, (x, 10), big)
        x += 96 + 10
    bg.save('/tmp/insp/new_paths.png')
    print('Контактный лист: /tmp/insp/new_paths.png')


if __name__ == '__main__':
    main()

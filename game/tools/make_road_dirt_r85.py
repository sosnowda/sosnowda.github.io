# -*- coding: utf-8 -*-
"""
Раунд 66.85 (приказ владельца 2): ГРУНТОВАЯ ДОРОГА ДЛЯ ТРАКТА —
исторический вид дороги Руси XV века.

Прежний тракт выложен тайлами gravel_0/1 (серый гравий с круглой галькой)
— в игре читался как ровная асфальтовая/брусчатая мостовая. На Руси XV века
большие дороги были ГРУНТОВЫМИ: полотно из уплотнённой земли, две колеи
от тележных колёс (тёмная вымученная полоса), задернованная середина между
колеями, трава, наползающая с обочин, камни, копытные следы, после дождя —
лужи.

Генерируемые ассеты (game/assets/tiles/):
  road_dirt_band.png         64x150 — лента полотна тракта (колеи + середина),
                             бесшовная по горизонтали (TileSprite тянется по X)
  road_dirt_band_stones.png  64x150 — вариант с камнями и копытными следами
  road_dirt_band_grass.png   64x150 — вариант с островом травы (задерновало)
  road_dirt_edge.png         64x22  — рваная кромка «трава -> грунт» (верх;
                             для нижней кромки код ставит setFlipY(true))

НЕ идемпотентен: перезапись поверх — файлы новые, конфликтов нет.
Запуск:  python3 game/tools/make_road_dirt_r85.py
"""
import os
import random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, '..', 'assets', 'tiles')

BAND_W, BAND_H = 64, 150
# Палитра грунта Руси XV в.: вымученная тёмная земля на колеях,
# светлее — сухой вытоптанный грунт, середина подзарастает травой.
EARTH_DARK = (86, 66, 44)
EARTH_MID = (125, 98, 68)
EARTH_LIGHT = (150, 121, 90)
RUT_DARK = (70, 52, 34)
RUT_DEEP = (60, 44, 29)
GRASS_MID = (106, 122, 68)     # трава на середине дороги (приглушённая)
GRASS_EDGE = (74, 124, 58)     # тон в тон заливке травы сцены 0x4a7c3a
GRASS_DARK = (58, 100, 46)
STONE_GREY = (138, 132, 120)
STONE_DARK = (104, 99, 90)
STONE_LIGHT = (168, 162, 148)


def clamp8(v):
    return max(0, min(255, int(v)))


def jitter(c, n, rnd):
    return (clamp8(c[0] + rnd.randint(-n, n)),
            clamp8(c[1] + rnd.randint(-n, n)),
            clamp8(c[2] + rnd.randint(-n, n)))


def draw_wrapped_h_dash(d, x, y, w, h, color):
    """Горизонтальный штрих с заворотом через край (бесшовность по X)."""
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=color)
    if x + w > BAND_W:
        d.rectangle([x - BAND_W, y, x - BAND_W + w - 1, y + h - 1], fill=color)
    if x < 0:
        d.rectangle([x + BAND_W, y, x + BAND_W + w - 1, y + h - 1], fill=color)


def base_earth(rnd, with_ruts=True):
    """Полотно грунтовой дороги 64x150. Бесшовность по горизонтали:
    мелкая крапчатость (белый шум) + горизонтальные штрихи с заворотом."""
    im = Image.new('RGB', (BAND_W, BAND_H))
    d = ImageDraw.Draw(im)
    px = im.load()

    # 1) База: уплотнённая земля, чуть темнее к кромкам (примятая трава/тень)
    for y in range(BAND_H):
        edge_k = 1.0
        if y < 22:
            edge_k = 0.92 + 0.08 * (y / 22.0)
        elif y > BAND_H - 23:
            edge_k = 0.92 + 0.08 * ((BAND_H - 1 - y) / 22.0)
        for x in range(BAND_W):
            base = EARTH_MID if (x + y * 7) % 3 else EARTH_LIGHT
            c = (base[0] * edge_k, base[1] * edge_k, base[2] * edge_k)
            px[x, y] = jitter(c, 9, rnd)

    # 2) Горизонтальные штрихи — следы колёс/копыт, вытянутые вдоль дороги
    for _ in range(160):
        y = rnd.randint(2, BAND_H - 4)
        x = rnd.randint(-8, BAND_W - 1)
        w = rnd.randint(3, 14)
        h = rnd.choice([1, 1, 2])
        dark = rnd.random() < 0.55
        col = EARTH_DARK if dark else EARTH_LIGHT
        draw_wrapped_h_dash(d, x, y, w, h, jitter(col, 8, rnd))

    # 3) КОЛЕИ — две тёмные вымученные полосы от тележных колёс.
    #    Центр ленты y=75, колеи на ~18px от центра; стенки колеи волнистые.
    if with_ruts:
        for cx_center in (57, 93):
            top_of = []
            bot_of = []
            for x in range(BAND_W):
                wobble = 1.6 * (1 + (x % 5) / 5.0) * (1 if (x // 9) % 2 else -1)
                t = cx_center - 7 + wobble + rnd.uniform(-0.8, 0.8)
                b = cx_center + 7 + wobble + rnd.uniform(-0.8, 0.8)
                top_of.append(t)
                bot_of.append(b)
            for x in range(BAND_W):
                t, b = int(top_of[x]), int(bot_of[x])
                for y in range(max(0, t), min(BAND_H, b)):
                    k = 0.82 if (y == t or y == b - 1) else 1.0
                    c = RUT_DEEP if abs(y - (t + b) / 2) < 3 else RUT_DARK
                    px[x, y] = (clamp8(c[0] * k), clamp8(c[1] * k), clamp8(c[2] * k))
        # сухие гребни колеи (светлые потёртости по краям колей)
        for _ in range(26):
            y = rnd.choice([rnd.randint(50, 58), rnd.randint(64, 72),
                            rnd.randint(80, 88), rnd.randint(98, 106)])
            x = rnd.randint(-6, BAND_W - 1)
            draw_wrapped_h_dash(d, x, y, rnd.randint(3, 9), 1, jitter(EARTH_LIGHT, 6, rnd))

    # 4) Задернованная середина между колеями — редкая травка (дорога глохнет,
    #    где редко объезжают)
    if with_ruts:
        for _ in range(46):
            x = rnd.randint(0, BAND_W - 1)
            y = rnd.randint(66, 84)
            d.point([x, y], fill=jitter(GRASS_MID, 14, rnd))
            if rnd.random() < 0.4:      # травинка в 1-2 px
                d.point([x, y - 1], fill=jitter(GRASS_MID, 18, rnd))

    return im


def add_stones(im, rnd, n_small=10, n_big=3, hoof=True):
    """Камни и копытные следы поверх полотна (вариант tiles)."""
    d = ImageDraw.Draw(im)
    for _ in range(n_small):
        x, y = rnd.randint(1, BAND_W - 3), rnd.randint(2, BAND_H - 3)
        r = rnd.choice([1, 1, 2])
        d.ellipse([x - r, y - r, x + r, y + r], fill=jitter(STONE_GREY, 14, rnd))
    for _ in range(n_big):
        x, y = rnd.randint(4, BAND_W - 6), rnd.randint(6, BAND_H - 8)
        w, h = rnd.randint(3, 5), rnd.randint(2, 4)
        d.ellipse([x - w, y - h, x + w, y + h], fill=jitter(STONE_GREY, 10, rnd))
        d.ellipse([x - w + 1, y - h, x + w - 2, y - h + 1], fill=STONE_LIGHT)
        d.ellipse([x - w + 1, y + h - 1, x + w - 2, y + h], fill=STONE_DARK)
    if hoof:   # копытные следы — пары овальных вмятин
        for _ in range(3):
            x, y = rnd.randint(3, BAND_W - 6), rnd.randint(10, BAND_H - 14)
            dx = rnd.choice([-4, -3, 3, 4])
            for hx, hy in ((x, y), (x + dx, y + rnd.randint(3, 5))):
                d.ellipse([hx - 1, hy - 2, hx + 1, hy + 2], fill=RUT_DEEP)
    return im


def add_grass_island(im, rnd):
    """Остров травы, наползающий на дорогу (задерновало там, где не ездят)."""
    d = ImageDraw.Draw(im)
    cy = rnd.randint(30, 120)
    rx, ry = rnd.randint(14, 22), rnd.randint(10, 16)
    blobs = 12
    for _ in range(blobs):
        bx = rnd.randint(2, BAND_W - 4)
        by = cy + rnd.randint(-ry // 2, ry // 2)
        br = rnd.randint(4, 9)
        d.ellipse([bx - br, by - br // 2, bx + br, by + br // 2],
                  fill=jitter(GRASS_EDGE, 16, rnd))
    # тёмные травинки-былинки поверх острова
    for _ in range(26):
        x = rnd.randint(1, BAND_W - 2)
        y = cy + rnd.randint(-ry, ry)
        if GRASS_EDGE[0] - 30 < im.getpixel((x % BAND_W, y))[0] < GRASS_EDGE[0] + 40:
            d.point([x, y], fill=GRASS_DARK)
            if rnd.random() < 0.5:
                d.point([x, y - 1], fill=GRASS_DARK)
    # рваный край острова: земляные пятна поверх
    for _ in range(8):
        bx = rnd.randint(2, BAND_W - 4)
        by = cy + rnd.choice([-ry, ry]) + rnd.randint(-2, 2)
        br = rnd.randint(1, 3)
        d.ellipse([bx - br, by - br // 2, bx + br, by + br // 2],
                  fill=jitter(EARTH_MID, 12, rnd))
    return im


def make_edge(rnd):
    """Кромка «трава -> грунт» 64x22: сверху сплошная трава (тон сцены),
    вниз рваные языки дёрна; ниже языков — прозрачный фон (полотно дороги)."""
    im = Image.new('RGBA', (64, 22), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    px = im.load()
    for y in range(22):
        for x in range(64):
            if y < 8:
                px[x, y] = jitter(GRASS_EDGE, 12, rnd) + (255,)
    # рваные языки дёрна вниз до y=12..18
    bottom_of = []
    for x in range(64):
        b = int(9 + 3 * (1 if (x // 7) % 2 else -1) + rnd.uniform(0, 5))
        bottom_of.append(min(19, b))
        for y in range(8, b):
            px[x, y] = jitter(GRASS_EDGE, 16, rnd) + (255,)
    # травинки, торчащие из кромки в полотно (на прозрачном)
    for _ in range(22):
        x = rnd.randint(0, 63)
        y = bottom_of[x] + rnd.randint(0, 3)
        d.point([x, y], fill=GRASS_DARK + (235,))
        if rnd.random() < 0.5 and y + 1 < 22:
            d.point([x, y + 1], fill=GRASS_DARK + (190,))
    # земляные точки у самого дёрна (переход)
    for _ in range(18):
        x = rnd.randint(0, 63)
        y = bottom_of[x] - rnd.randint(0, 2)
        d.point([x, y], fill=EARTH_DARK + (255,))
    return im


def main():
    rnd = random.Random(6685)
    os.makedirs(TILES, exist_ok=True)
    out = []

    band = base_earth(rnd, with_ruts=True)
    band.save(os.path.join(TILES, 'road_dirt_band.png'))
    out.append(('road_dirt_band.png', band.size))

    stones = add_stones(band.copy(), rnd)
    stones.save(os.path.join(TILES, 'road_dirt_band_stones.png'))
    out.append(('road_dirt_band_stones.png', stones.size))

    grass = add_grass_island(band.copy(), rnd)
    grass.save(os.path.join(TILES, 'road_dirt_band_grass.png'))
    out.append(('road_dirt_band_grass.png', grass.size))

    edge = make_edge(rnd)
    edge.save(os.path.join(TILES, 'road_dirt_edge.png'))
    out.append(('road_dirt_edge.png', edge.size))

    for name, size in out:
        print('OK', name, size, '- грунтовая дорога Руси XV в.')


if __name__ == '__main__':
    main()

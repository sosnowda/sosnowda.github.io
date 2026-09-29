#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.46 (приказы 4–5 владельца): СУША ПОД НОГАМИ НА ФОНАХ БОЯ.

Владелец: «в локации боя проверять, чтобы персонаж или NPC не стояли на воде
(как сейчас в локации река)». Живая проверка всех 9 фонов показала:

  • battle_bg_lake — вода занимает ВЕСЬ нижний план: герой (ноги ~596) и враги
    (ноги ~501) стояли ПО СЕРЕДИНЕ ОЗЕРА;
  • battle_bg_river — диагональная лента русла проходила ровно под врагами
    (x≈921, ноги ≈501) — враг стоял В ВОДЕ.

Перерисовываются ТОЛЬКО эти два фона (остальные 7 — лес/поле/погост/мельница/
пасека/тракт/изба — сухие, не трогаются). Новая геометрия:

  • вода — ТОЛЬКО в средней дистанции (между линией леса и кромкой берега);
  • кромка берега идёт волной: слева/в центре опускается до ~470,
    на ПРАВОМ краю (зона врагов, x>840) поднимается до ~350 — ноги всех
    боевых позиций (герой 320,596 · враги 891..951, 372..588 · волк 921,539)
    стоят на СУХОМ берегу;
  • передний план целиком — сухой луг с песчаными проплешинами, кустами,
    корягами и камышом У КРОМКИ воды.

Контрольные точки суши (1280×720): (320,596) (921,501) (891,372) (951,588)
(921,539) — юнит-проверка в скрипте падает, если точка попала в воду.
Запуск: python3 game/tools/make_battle_bg_6646.py
"""

import math
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = 'game/assets/sprites/battle'
W, H = 1280, 720

random.seed(6646)


# ---------------------------------------------------------------- базовые кисти
# (копии helpers из make_battle_bg_6644.py — манера живописи та же)

def vgrad(size, top, bottom):
    w, h = size
    im = Image.new('RGB', (1, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return im.resize((w, h))


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def grain(im, amount=10):
    w, h = im.size
    px = im.load()
    for _ in range(w * h // 28):
        x, y = random.randrange(w), random.randrange(h)
        r, g, b = px[x, y]
        d = random.randint(-amount, amount)
        px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return im


def blob(draw, cx, cy, rx, ry, color, alpha=255, wobble=0.18, seed=None):
    rnd = random.Random(seed or random.randrange(1 << 30))
    pts = []
    n = 14
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + rnd.uniform(-wobble, wobble)
        pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    draw.polygon(pts, fill=color + (alpha,))


def treeline(draw, y_base, w, color, alpha=255, h_min=40, h_max=120, step=26, seed=None):
    rnd = random.Random(seed or random.randrange(1 << 30))
    x = -20
    pts = [(x, y_base + 30)]
    while x < w + 20:
        hh = rnd.randint(h_min, h_max)
        pts.append((x, y_base - hh))
        pts.append((x + step * rnd.uniform(0.5, 1.0), y_base - rnd.randint(h_min, h_max) // 2))
        x += step * rnd.uniform(0.7, 1.3)
    pts.append((w + 30, y_base + 30))
    draw.polygon(pts, fill=color + (alpha,))


def vignette(im, power=0.55, color=(10, 6, 4)):
    w, h = im.size
    mask = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((-w * 0.25, -h * 0.35, w * 1.25, h * 1.35), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new('RGB', (w, h), color)
    return Image.composite(im, dark, mask.point(lambda v: int(255 - (255 - v) * power)))


def ground_shade(im, y0, tint=(20, 14, 8), max_a=90):
    w, h = im.size
    ov = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for y in range(y0, h, 4):
        t = (y - y0) / max(1, h - y0)
        d.rectangle((0, y, w, y + 4), fill=tint + (int(max_a * t),))
    return Image.alpha_composite(im.convert('RGBA'), ov)


def finish(im, name):
    im = vignette(im.convert('RGB'))
    im = grain(im, 9)
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=85)
    print(f'{name}.webp — готово')
    im.thumbnail((640, 360))
    im.save(f'/tmp/insp/bb_{name}.png')


# ------------------------------------------------------------- геометрия берега
# Кромка воды: слева/в центре ~470, справа (зона врагов x>840) поднимается до ~350.
def shoreline_y(x, base=478, rise=170, rise_x0=430, rise_x1=910, cap=315, wobble=0):
    # cap=315: ноги ВЕРХНЕГО врага пары (листы 64px, y=0.35h → ступни ~332)
    # обязаны быть на суше с запасом; rise=170 доводит кривую до cap
    t = max(0.0, min(1.0, (x - rise_x0) / max(1, (rise_x1 - rise_x0))))
    y = base - rise * (t * t * (3 - 2 * t))   # smoothstep
    return max(cap, y + wobble)


# Контрольные точки СУШИ (ноги бойцов) — все обязаны быть ниже кромки воды
DRY_POINTS = [
    (320, 596),   # герой (0.25w, 0.55h)
    (921, 501),   # враг одиночка (0.72w, 64px-листы: ступни y+80 от центра 381)
    (891, 332),   # враг №1 пары (ступни 252+80 — САМАЯ ВЫСОКАЯ точка)
    (951, 588),   # враг №2 пары
    (921, 539),   # волк
]


def check_dry(name, waterline_fn):
    for (x, y) in DRY_POINTS:
        wl = waterline_fn(x)
        assert y > wl + 8, f'{name}: точка ({x},{y}) в воде (кромка {wl:.0f})'
    print(f'{name}: все боевые точки на суше ✓')


# ---------------------------------------------------------------------- ОЗЕРО
def make_lake():
    im = vgrad((W, H), (84, 82, 76), (120, 110, 88)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.40)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((98, 94, 88), (150, 136, 104), t))
    treeline(d, horizon + 4, W, (44, 48, 32), 235, 14, 40, 16, seed=6646)
    treeline(d, horizon + 10, W, (34, 40, 26), 255, 20, 52, 20, seed=6647)

    # --- СУША: весь передний план от кромки воды до низа ---
    # Кромка рисуется волнистой ломаной (jitter по сегментам)
    pts = []
    x = -10
    while x <= W + 10:
        wl = shoreline_y(x, wobble=random.uniform(-9, 9))
        pts.append((x, wl))
        x += 26
    # вода (только ВЫШЕ кромки)
    for y in range(horizon + 8, H):
        row_left = None
        d.line((0, y, W, y), fill=None) if False else None
    # проще: сначала заливаем ВСЁ ниже горизонта водой, потом сушу полигоном
    for y in range(horizon + 8, H):
        t = (y - horizon) / (H - horizon)
        base = lerp((58, 66, 60), (36, 44, 44), min(1, t * 1.4))
        d.line((0, y, W, y), fill=base)
    dry = pts + [(W + 10, H + 10), (-10, H + 10)]
    d.polygon(dry, fill=(96, 88, 52, 255))

    # блики на воде (выше кромки)
    for _ in range(220):
        x = random.uniform(0, W)
        wl = shoreline_y(x)
        y = random.uniform(horizon + 10, max(horizon + 14, wl - 6))
        depth = (y - horizon) / max(1, (wl - horizon))
        ln = random.uniform(8, 12 + 60 * max(0, depth))
        col = random.choice([(150, 150, 128), (120, 126, 110), (170, 160, 128)])
        d.line((x, y, x + ln, y), fill=col + (random.randint(60, 140),), width=2 if depth > 0.4 else 1)

    # кувшинки (только в воде)
    for _ in range(9):
        x = random.uniform(W * 0.04, W * 0.96)
        wl = shoreline_y(x)
        if wl - horizon < 50:
            continue
        y = random.uniform(horizon + 24, wl - 22)
        d.ellipse((x - 12, y - 4, x + 12, y + 4), fill=(44, 52, 32, 255))
        d.ellipse((x - 5, y - 2, x + 2, y + 2), fill=(56, 66, 38, 255))

    # песчаная кромка вдоль берега (сухая полоса сразу под водой)
    sand = []
    for (px, py) in pts:
        sand.append((px, py + 4))
    for (px, py) in reversed(pts):
        sand.append((px, py + random.uniform(14, 26)))
    d.polygon(sand, fill=(150, 128, 88, 235))
    # мокрый тёмный песок прямо у воды
    wet = [(px, py + 2) for (px, py) in pts]
    for (px, py) in reversed(pts):
        wet.append((px, py + random.uniform(6, 11)))
    d.polygon(wet, fill=(112, 96, 66, 230))

    # трава-мазки на суше
    for _ in range(700):
        x = random.uniform(0, W)
        wl = shoreline_y(x)
        y = random.uniform(wl + 20, H)
        depth = (y - wl) / max(1, H - wl)
        ln = 3 + 11 * depth
        col = random.choice([(120, 108, 58), (104, 96, 52), (134, 118, 62)])
        d.line((x, y, x + random.uniform(-2, 2), y - ln), fill=col + (200,), width=1)
    # песчаные проплешины на переднем плане
    blob(d, W * 0.24, H * 0.86, 120, 22, (150, 128, 88), 210, 0.3, seed=11)
    blob(d, W * 0.62, H * 0.94, 90, 18, (144, 122, 84), 200, 0.3, seed=12)

    # камыш У КРОМКИ воды (слева, где берег низкий)
    for _ in range(46):
        x = random.uniform(0, W * 0.55)
        wl = shoreline_y(x) + random.uniform(-4, 4)
        ln = random.uniform(34, 78)
        d.line((x, wl + 8, x + random.uniform(-8, 8), wl + 8 - ln), fill=(30, 38, 22, 235), width=3)
        if random.random() < 0.4:
            d.ellipse((x - 3, wl - ln, x + 3, wl - ln + 8), fill=(60, 48, 28, 235))

    # кусты по КРАЯМ переднего плана (вне боевых точек)
    for x, y, r in ((W * 0.06, H * 0.9, 95), (W * 0.94, H * 0.86, 105)):
        blob(d, x, y, r, r * 0.6, (40, 52, 30), 255, 0.35, seed=int(x))
        blob(d, x + r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, (52, 64, 36), 255, 0.35, seed=int(x) + 1)
    # коряга на берегу (декор слева)
    d.line((W * 0.14, H * 0.8, W * 0.2, H * 0.79), fill=(52, 40, 26, 255), width=6)
    d.line((W * 0.17, H * 0.795, W * 0.185, H * 0.775), fill=(52, 40, 26, 255), width=4)

    im = ground_shade(im, int(H * 0.74), (10, 12, 8), 70)
    check_dry('lake', shoreline_y)
    finish(im, 'battle_bg_lake')


# ----------------------------------------------------------------------- РЕКА
def make_river():
    im = vgrad((W, H), (88, 84, 72), (128, 112, 84)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.36)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((94, 90, 80), (148, 130, 96), t))
    treeline(d, horizon + 4, W, (46, 50, 32), 230, 14, 40, 18, seed=6648)
    # заливаем всё ниже горизонта берегом
    d.rectangle((0, horizon + 6, W, H), fill=(96, 84, 56, 255))

    # --- РУСЛО: лента в СРЕДНЕЙ дистанции (выше ног врагов на правом краю) ---
    pts = []
    x = -10
    while x <= W + 10:
        wl = shoreline_y(x, base=452, rise=145, rise_x0=400, rise_x1=880, cap=315,
                         wobble=random.uniform(-8, 8))
        pts.append((x, wl))
        x += 26
    flow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(flow)
    water_top = horizon + 6
    poly = [(pts[0][0], pts[0][1])] + pts + [(W + 10, water_top), (-10, water_top)]
    df.polygon(poly, fill=(58, 72, 68, 255))
    im = Image.alpha_composite(im, flow)
    d = ImageDraw.Draw(im, 'RGBA')

    # течение: дуги (только в воде)
    for i in range(30):
        t = i / 30
        y = water_top + 8 + t * 130
        for seg in range(8):
            x0 = seg * (W / 8) + random.uniform(-30, 30)
            wl0 = shoreline_y(x0)
            if y > wl0 - 8:
                continue
            halfw = random.uniform(30, 90)
            col = (110, 128, 118) if random.random() < 0.7 else (140, 148, 128)
            d.arc((x0 - halfw, y - 6, x0 + halfw, y + 14), 200, 340,
                  fill=col + (random.randint(80, 150),), width=2)

    # песчаные отмели В РУСЛЕ (у кромки)
    for _ in range(6):
        x = random.uniform(0, W)
        wl = shoreline_y(x)
        if wl - horizon < 60:
            continue
        blob(d, x, wl - random.uniform(8, 18), random.uniform(40, 90), random.uniform(8, 14),
             (150, 128, 88), 210, 0.3)

    # мокрый песок + сухой песок вдоль берега (как у озера)
    wet = [(px, py + 2) for (px, py) in pts]
    for (px, py) in reversed(pts):
        wet.append((px, py + random.uniform(5, 10)))
    d.polygon(wet, fill=(112, 96, 66, 230))
    sand = [(px, py + 4) for (px, py) in pts]
    for (px, py) in reversed(pts):
        sand.append((px, py + random.uniform(12, 24)))
    d.polygon(sand, fill=(150, 128, 88, 225))

    # трава-мазки на суше
    for _ in range(650):
        x = random.uniform(0, W)
        wl = shoreline_y(x, base=452, rise=108, rise_x0=400, rise_x1=880, cap=330)
        y = random.uniform(wl + 18, H)
        depth = (y - wl) / max(1, H - wl)
        ln = 3 + 11 * depth
        col = random.choice([(118, 104, 56), (104, 92, 50), (130, 112, 60)])
        d.line((x, y, x + random.uniform(-2, 2), y - ln), fill=col + (200,), width=1)

    # тропа по переднему плану (береговая тропинка)
    d.line((W * 0.02, H * 0.93, W * 0.38, H * 0.9), fill=(140, 118, 78, 220), width=10)
    d.line((W * 0.36, H * 0.9, W * 0.62, H * 0.96), fill=(140, 118, 78, 220), width=12)

    # камыш у кромки (слева)
    for _ in range(40):
        x = random.uniform(0, W * 0.5)
        wl = shoreline_y(x, base=452, rise=145, rise_x0=400, rise_x1=880, cap=315) + random.uniform(-4, 4)
        ln = random.uniform(30, 70)
        d.line((x, wl + 6, x + random.uniform(-8, 8), wl + 6 - ln), fill=(30, 38, 22, 235), width=3)

    # кусты на берегах (вне боевых точек)
    for x, y, r in ((W * 0.05, H * 0.88, 100), (W * 0.95, H * 0.82, 100),
                    (W * 0.42, H * 0.55, 34)):
        blob(d, x, y, r, r * 0.6, (40, 52, 30), 255, 0.35, seed=int(x))
        blob(d, x + r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, (52, 64, 36), 255, 0.35, seed=int(x) + 2)

    im = ground_shade(im, int(H * 0.76), (10, 10, 6), 70)
    check_dry('river', lambda x: shoreline_y(x, base=452, rise=145, rise_x0=400, rise_x1=880, cap=315))
    finish(im, 'battle_bg_river')


if __name__ == '__main__':
    import os
    os.makedirs('/tmp/insp', exist_ok=True)
    make_lake()
    make_river()
    print('66.46: фоны боя lake/river перерисованы — бойцы на суше.')

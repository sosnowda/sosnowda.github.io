#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.44 (приказ 2): ФОНЫ ПОЛЯ БОЯ ПО ЛОКАЦИИ.

Прежде бой шёл на безликом градиенте «поляна на вечернем свету» с восемью
одинаковыми ёлками — где бы ни случился бой. Теперь у каждой группы локаций
СВОЯ нарисованная сцена (1280×720, webp q85, живописная манера пака):

  battle_bg_forest   — тёмный лес (Лес/Опушка/Поляна, волк из ForestScene)
  battle_bg_field    — поле/выпас: трава, дальний лес, высокое небо
  battle_bg_lake     — берег озера: вода с бликами, камыш, дальний берег
  battle_bg_river    — река: течение, песчаный берег, кусты
  battle_bg_pogost   — погост: часовня силуэтом, кресты, ограда
  battle_bg_mill     — мельница: крылья, стога, дорожка
  battle_bg_apiary   — пасека: ульи, луг, деревья
  battle_bg_road     — большой тракт: дорога в перспективе, поля
  battle_bg_interior — драка в избе (враждебный житель): брёвна, окно, лавка

Ключи грузит BootScene; CombatScene выбирает группу по fromLocation/fromScene/
npcId (см. combatBackgroundGroup). Прежний градиент остаётся фолбэком.
Запуск: python3 game/tools/make_battle_bg_6644.py
"""

import math
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = 'game/assets/sprites/battle'
W, H = 1280, 720

random.seed(6644)


# ---------------------------------------------------------------- базовые кисти
def vgrad(size, top, bottom):
    """Вертикальный градиент."""
    w, h = size
    im = Image.new('RGB', (1, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return im.resize((w, h))


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def noise_overlay(im, strength=8, alpha=0.5):
    """Лёгкий монохромный шум поверх (живописность)."""
    w, h = im.size
    n = Image.effect_noise((w // 2, h // 2), 40).resize((w, h)).convert('L')
    overlay = Image.merge('RGB', (n, n, n))
    return Image.blend(im, overlay, alpha * 0.18) if strength < 0 else Image.composite(
        overlay, im, Image.new('L', (w, h), int(255 * alpha * strength / 20)))


def grain(im, amount=10):
    """Зернистость: случайные полупрозрачные точки."""
    w, h = im.size
    px = im.load()
    for _ in range(w * h // 28):
        x, y = random.randrange(w), random.randrange(h)
        r, g, b = px[x, y]
        d = random.randint(-amount, amount)
        px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return im


def blob(draw, cx, cy, rx, ry, color, alpha=255, wobble=0.18, seed=None):
    """Органическое пятно (кривая из точек)."""
    rnd = random.Random(seed or random.randrange(1 << 30))
    pts = []
    n = 14
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + rnd.uniform(-wobble, wobble)
        pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    draw.polygon(pts, fill=color + (alpha,))


def treeline(draw, y_base, w, color, alpha=255, h_min=40, h_max=120, step=26, seed=None):
    """Рваная линия леса (силуэт)."""
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


def pine(draw, x, y_base, hh, color, alpha=255):
    """Ель силуэтом (три яруса)."""
    ww = hh * 0.42
    for k, frac in enumerate((1.0, 0.72, 0.45)):
        ytop = y_base - hh + hh * 0.30 * k
        yb = y_base - hh * 0.18 * (3 - k) + hh * 0.0
        yb = y_base - (hh * 0.10) * k
        draw.polygon([
            (x, ytop - hh * 0.16),
            (x - ww * frac / 2, yb),
            (x + ww * frac / 2, yb),
        ], fill=color + (alpha,))


def trunk_tree(draw, x, y_base, hh, bark, crown, alpha=255, crown_r=70):
    """Лиственное дерево: ствол + крона пятнами."""
    draw.polygon([(x - 7, y_base), (x - 3, y_base - hh * 0.6),
                  (x + 3, y_base - hh * 0.6), (x + 7, y_base)], fill=bark + (alpha,))
    rnd = random.Random(x * 7 + hh)
    for _ in range(9):
        cx = x + rnd.uniform(-crown_r, crown_r)
        cy = y_base - hh + rnd.uniform(-crown_r * 0.5, crown_r * 0.4)
        r = crown_r * rnd.uniform(0.5, 0.9)
        blob(draw, cx, cy, r, r * 0.75, crown, alpha, seed=rnd.randrange(1 << 30))


def vignette(im, power=0.55, color=(10, 6, 4)):
    """Мягкое затемнение краёв."""
    w, h = im.size
    mask = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((-w * 0.25, -h * 0.35, w * 1.25, h * 1.35), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new('RGB', (w, h), color)
    return Image.composite(im, dark, mask.point(lambda v: int(255 - (255 - v) * power)))


def ground_shade(im, y0, tint=(20, 14, 8), max_a=90):
    """Мягкая тень к низу сцены."""
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


# ---------------------------------------------------------------- сцены
def sky_plane(im, sky_top, sky_bot, horizon):
    d = ImageDraw.Draw(im, 'RGBA')
    # небо
    for y in range(0, horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp(sky_top, sky_bot, t))
    return d


def make_forest():
    im = vgrad((W, H), (30, 26, 18), (14, 11, 8)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    # дальняя чаща — сплошной тёмный массив от трети высоты
    treeline(d, int(H * 0.34), W, (26, 24, 15), 255, 130, 230, 26, seed=101)
    treeline(d, int(H * 0.46), W, (19, 18, 12), 255, 100, 180, 22, seed=202)
    treeline(d, int(H * 0.58), W, (15, 14, 10), 255, 70, 140, 20, seed=303)
    # тёплый подсвет в глубине (за стволами, слабый)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    blob(dg, W * 0.5, H * 0.38, 380, 170, (150, 118, 66), 34, 0.3)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    im = Image.alpha_composite(im, glow)
    d = ImageDraw.Draw(im, 'RGBA')
    # кроны сверху: два ряда, закрывают верх ЦЕЛИКОМ
    rnd = random.Random(6644)
    for _ in range(34):
        blob(d, rnd.uniform(0, W), rnd.uniform(-60, 90),
             rnd.uniform(110, 230), rnd.uniform(60, 120),
             (13, 12, 8), rnd.randint(200, 255), 0.32, seed=rnd.randrange(1 << 30))
    for _ in range(22):
        blob(d, rnd.uniform(0, W), rnd.uniform(60, 200),
             rnd.uniform(80, 170), rnd.uniform(45, 95),
             (18, 17, 11), rnd.randint(160, 235), 0.34, seed=rnd.randrange(1 << 30))
    # стволы
    trunks = [(70, 690, 26), (175, 770, 34), (320, 640, 20), (475, 600, 14),
              (630, 610, 13), (790, 630, 16), (960, 660, 18), (1105, 730, 28), (1235, 790, 36)]
    for x, hh, wdt in trunks:
        col = (10, 9, 6) if hh > 680 else (17, 14, 10)
        d.polygon([(x - wdt // 2, H), (x - wdt // 3, H - hh),
                   (x + wdt // 3, H - hh), (x + wdt // 2, H)], fill=col + (255,))
        for _ in range(4):
            yy = H - hh + rnd.randint(24, max(25, hh // 2))
            ln = rnd.randint(30, 90)
            dx = rnd.choice((-1, 1))
            d.line((x, yy, x + dx * ln, yy - ln * 0.32), fill=col + (255,), width=4)
    # мягкие лучи света
    rays = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(rays)
    for i in range(5):
        x0 = 250 + i * 200 + rnd.randint(-30, 30)
        dr.polygon([(x0, 0), (x0 + 54, 0), (x0 - 120, H), (x0 - 174, H)],
                   fill=(206, 174, 104, 16))
    rays = rays.filter(ImageFilter.GaussianBlur(20))
    im = Image.alpha_composite(im, rays)
    # земля: мох, папоротник, камни
    d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle((0, H * 0.80, W, H), fill=(26, 24, 14, 255))
    for _ in range(70):
        blob(d, rnd.uniform(0, W), rnd.uniform(H * 0.82, H),
             rnd.uniform(30, 90), rnd.uniform(8, 22),
             rnd.choice([(36, 33, 19), (24, 28, 15), (31, 26, 13)]),
             rnd.randint(90, 200), 0.4, seed=rnd.randrange(1 << 30))
    for _ in range(16):
        x, y = rnd.uniform(0, W), rnd.uniform(H * 0.84, H - 10)
        r = rnd.uniform(4, 12)
        d.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=(48, 44, 36, 220))
    im = ground_shade(im, int(H * 0.8))
    finish(im, 'battle_bg_forest')


def make_field():
    im = vgrad((W, H), (108, 96, 74), (150, 122, 82)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.44)
    # небо: тёплая дымка
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((96, 88, 78), (168, 138, 94), t))
    # солнце за дымкой
    d.ellipse((W * 0.68, 60, W * 0.68 + 90, 150), fill=(222, 190, 130, 200))
    haze = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dh = ImageDraw.Draw(haze)
    dh.ellipse((W * 0.62, 20, W * 0.62 + 210, 190), fill=(226, 196, 136, 90))
    haze = haze.filter(ImageFilter.GaussianBlur(40))
    im = Image.alpha_composite(im, haze)
    d = ImageDraw.Draw(im, 'RGBA')
    # дальний лес
    treeline(d, horizon + 6, W, (58, 52, 34), 235, 18, 44, 18)
    treeline(d, horizon + 14, W, (46, 44, 28), 255, 24, 60, 22)
    # поле: полосы травы в перспективе
    d.rectangle((0, horizon + 10, W, H), fill=(92, 88, 48, 255))
    y = horizon + 10
    shade = 0
    while y < H:
        hh = max(6, int((y - horizon) * 0.14))
        shade = 1 - shade
        col = (96, 92, 50) if shade else (86, 84, 46)
        if y > H * 0.7:
            col = (104, 96, 52) if shade else (92, 88, 48)
        d.rectangle((0, y, W, min(H, y + hh)), fill=col + (255,))
        y += hh
    # трава-мазки
    for _ in range(900):
        x = random.uniform(0, W)
        y = random.uniform(horizon + 14, H)
        depth = (y - horizon) / (H - horizon)
        ln = 3 + 12 * depth
        col = random.choice([(120, 108, 58), (104, 96, 52), (134, 118, 62)])
        d.line((x, y, x + random.uniform(-2, 2), y - ln), fill=col + (200,), width=1)
    # одиночная берёза слева
    trunk_tree(d, 170, H * 0.86, 250, (44, 36, 26), (116, 110, 54), 255, 60)
    # стог сена справа
    d.ellipse((W * 0.78, H * 0.72, W * 0.78 + 150, H * 0.72 + 95), fill=(128, 104, 56, 255))
    d.ellipse((W * 0.78 + 20, H * 0.70, W * 0.78 + 120, H * 0.70 + 60), fill=(146, 120, 66, 255))
    im = ground_shade(im, int(H * 0.62), (16, 14, 6), 80)
    finish(im, 'battle_bg_field')


def make_lake():
    im = vgrad((W, H), (84, 82, 76), (120, 110, 88)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.40)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((98, 94, 88), (150, 136, 104), t))
    treeline(d, horizon + 4, W, (44, 48, 32), 235, 14, 40, 16)
    treeline(d, horizon + 10, W, (34, 40, 26), 255, 20, 52, 20)
    # вода
    for y in range(horizon + 8, H):
        t = (y - horizon) / (H - horizon)
        base = lerp((58, 66, 60), (36, 44, 44), min(1, t * 1.4))
        d.line((0, y, W, y), fill=base)
    # блики (горизонтальные штрихи, шире ближе)
    for _ in range(300):
        y = random.randint(horizon + 10, H - 4)
        depth = (y - horizon) / (H - horizon)
        ln = random.uniform(8, 14 + 90 * depth)
        x = random.uniform(0, W - ln)
        col = random.choice([(150, 150, 128), (120, 126, 110), (170, 160, 128)])
        d.line((x, y, x + ln, y), fill=col + (random.randint(60, 150),), width=2 if depth > 0.4 else 1)
    # камыш по краям
    for _ in range(70):
        side = random.choice((0, W))
        x = side + random.uniform(-30, 30) * (1 if side == 0 else -1)
        y = random.uniform(H * 0.8, H)
        ln = random.uniform(50, 130)
        d.line((x, y, x + random.uniform(-10, 10), y - ln), fill=(30, 38, 22, 235), width=3)
        if random.random() < 0.4:
            d.ellipse((x - 3, y - ln - 10, x + 3, y - ln), fill=(60, 48, 28, 235))
    # кувшинки
    for _ in range(7):
        x, y = random.uniform(W * 0.2, W * 0.8), random.uniform(H * 0.62, H * 0.9)
        d.ellipse((x - 12, y - 4, x + 12, y + 4), fill=(44, 52, 32, 255))
    im = ground_shade(im, int(H * 0.7), (8, 12, 12), 70)
    finish(im, 'battle_bg_lake')


def make_river():
    im = vgrad((W, H), (88, 84, 72), (128, 112, 84)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.36)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((94, 90, 80), (148, 130, 96), t))
    treeline(d, horizon + 4, W, (46, 50, 32), 230, 14, 40, 18)
    # берега и русло (диагональная лента)
    d.rectangle((0, horizon + 6, W, H), fill=(96, 84, 56, 255))
    # русло: расширяющаяся лента от (W*0.45, horizon) к низу
    flow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(flow)
    df.polygon([(W * 0.34, horizon + 6), (W * 0.52, horizon + 6),
                (W * 1.05, H), (W * 0.62, H)], fill=(58, 72, 68, 255))
    im = Image.alpha_composite(im, flow)
    d = ImageDraw.Draw(im, 'RGBA')
    # течение: дуги
    for i in range(40):
        t = i / 40
        y = horizon + 10 + t * (H - horizon - 20)
        halfw = 20 + t * 260
        cx = W * 0.43 + t * W * 0.28
        col = (110, 128, 118) if random.random() < 0.7 else (140, 148, 128)
        d.arc((cx - halfw, y - 6, cx + halfw, y + 14), 200, 340,
              fill=col + (random.randint(80, 160),), width=2)
    # песчаные отмели
    blob(d, W * 0.70, H * 0.88, 160, 30, (150, 128, 88), 220, 0.3)
    blob(d, W * 0.24, H * 0.62, 90, 16, (140, 120, 84), 190, 0.3)
    # кусты на берегах
    for x, y, r in ((W * 0.16, H * 0.52, 60), (W * 0.86, H * 0.5, 70),
                    (W * 0.9, H * 0.8, 110), (W * 0.08, H * 0.9, 120)):
        blob(d, x, y, r, r * 0.6, (40, 52, 30), 255, 0.35)
        blob(d, x + r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, (52, 64, 36), 255, 0.35)
    im = ground_shade(im, int(H * 0.72), (10, 10, 6), 70)
    finish(im, 'battle_bg_river')


def make_pogost():
    im = vgrad((W, H), (64, 60, 62), (104, 92, 78)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.42)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((70, 66, 68), (122, 106, 88), t))
    treeline(d, horizon + 4, W, (40, 38, 30), 240, 12, 36, 16)
    # часовня силуэтом справа
    cx = W * 0.78
    body_w, body_h = 150, 150
    d.rectangle((cx - body_w / 2, horizon - body_h, cx + body_w / 2, horizon),
                fill=(34, 28, 24, 255))
    # шатёр + купол-луковка
    d.polygon([(cx - body_w * 0.62, horizon - body_h),
               (cx + body_w * 0.62, horizon - body_h),
               (cx, horizon - body_h - 80)], fill=(30, 25, 22, 255))
    d.ellipse((cx - 22, horizon - body_h - 118, cx + 22, horizon - body_h - 74),
              fill=(36, 30, 26, 255))
    d.rectangle((cx - 3, horizon - body_h - 140, cx + 3, horizon - body_h - 110),
                fill=(36, 30, 26, 255))
    d.rectangle((cx - 10, horizon - body_h - 146, cx + 10, horizon - body_h - 136),
                fill=(36, 30, 26, 255))
    # земля погоста
    d.rectangle((0, horizon + 8, W, H), fill=(70, 62, 48, 255))
    for _ in range(40):
        blob(d, random.uniform(0, W), random.uniform(horizon + 10, H),
             random.uniform(40, 110), random.uniform(10, 26),
             random.choice([(60, 54, 40), (56, 46, 36), (64, 58, 44)]),
             random.randint(90, 180), 0.4)
    # ограда из штакетника (задний план)
    for x in range(-10, W + 10, 34):
        d.rectangle((x, horizon - 34, x + 7, horizon + 6), fill=(44, 36, 28, 255))
        d.polygon([(x - 1, horizon - 34), (x + 8, horizon - 34), (x + 3.5, horizon - 44)],
                  fill=(44, 36, 28, 255))
    d.rectangle((0, horizon - 24, W, horizon - 18), fill=(40, 33, 26, 255))
    # кресты (средний план, 5 шт)
    for x, sc in ((180, 1.2), (340, 0.9), (520, 1.4), (700, 1.0), (980, 1.15)):
        y0 = H * 0.72
        hh = 90 * sc
        wd = 7 * sc
        d.rectangle((x - wd / 2, y0 - hh, x + wd / 2, y0), fill=(46, 38, 30, 255))
        d.rectangle((x - hh * 0.28, y0 - hh * 0.72, x + hh * 0.28, y0 - hh * 0.72 + wd),
                    fill=(46, 38, 30, 255))
        d.rectangle((x - hh * 0.20, y0 - hh * 0.5, x + hh * 0.20, y0 - hh * 0.5 + wd),
                    fill=(46, 38, 30, 255))
        # холмик
        d.ellipse((x - 26 * sc, y0 - 8, x + 26 * sc, y0 + 12), fill=(58, 50, 38, 255))
    im = ground_shade(im, int(H * 0.66), (12, 10, 8), 80)
    finish(im, 'battle_bg_pogost')


def make_mill():
    im = vgrad((W, H), (104, 92, 74), (142, 120, 86)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.46)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((100, 92, 78), (160, 134, 92), t))
    d.ellipse((W * 0.62, 44, W * 0.62 + 80, 124), fill=(222, 194, 134, 190))
    treeline(d, horizon + 4, W, (56, 52, 34), 235, 16, 44, 20)
    d.rectangle((0, horizon + 8, W, H), fill=(98, 88, 56, 255))
    # мельница слева: КОРПУС (светлое дерево, доски, дверь, окно)
    mx, my = W * 0.185, H * 0.80
    body_w0, body_w1, body_h = 118, 168, 330
    top_y = my - body_h
    d.polygon([(mx - body_w0 / 2, my), (mx + body_w0 / 2, my),
               (mx + body_w1 / 2, top_y), (mx - body_w1 / 2, top_y)],
              fill=(96, 72, 44, 255))
    for k in range(1, 9):  # доски корпуса
        yy = top_y + k * 36
        frac = (yy - top_y) / body_h
        w_now = body_w1 + (body_w0 - body_w1) * frac
        d.line((mx - w_now / 2, yy, mx + w_now / 2, yy), fill=(70, 52, 32, 220), width=2)
    d.rectangle((mx - 20, my - 64, mx + 20, my), fill=(58, 42, 26, 255))  # дверь
    d.ellipse((mx - 20, my - 76, mx + 20, my - 52), fill=(58, 42, 26, 255))
    d.rectangle((mx - 16, top_y + 60, mx + 16, top_y + 100), fill=(196, 168, 110, 255))
    d.rectangle((mx - 3, top_y + 60, mx + 3, top_y + 100), fill=(70, 52, 32, 255))
    # КРЫЛЬЯ: 4 чистых бруса с парусами на внешней половине
    hub = (mx, top_y + 34)
    for adeg in (18, 108, 198, 288):
        a = math.radians(adeg)
        ex, ey = hub[0] + 205 * math.cos(a), hub[1] + 205 * math.sin(a)
        d.line((hub[0], hub[1], ex, ey), fill=(52, 40, 26, 255), width=7)
        # парус-решётка вдоль внешней половины бруса
        for t in range(5):
            f0 = 100 + t * 22
            f1 = f0 + 20
            perp = a + math.pi / 2
            wdt = 34
            p0 = (hub[0] + f0 * math.cos(a) + wdt * math.cos(perp),
                  hub[1] + f0 * math.sin(a) + wdt * math.sin(perp))
            p1 = (hub[0] + f1 * math.cos(a) + wdt * math.cos(perp),
                  hub[1] + f1 * math.sin(a) + wdt * math.sin(perp))
            p2 = (hub[0] + f1 * math.cos(a), hub[1] + f1 * math.sin(a))
            p3 = (hub[0] + f0 * math.cos(a), hub[1] + f0 * math.sin(a))
            d.polygon([p0, p1, p2, p3], fill=(152, 128, 84, 225))
        # поперечины
        for f in (110, 150, 190):
            px_, py_ = hub[0] + f * math.cos(a), hub[1] + f * math.sin(a)
            d.line((px_, py_, px_ + 34 * math.cos(a + math.pi / 2),
                    py_ + 34 * math.sin(a + math.pi / 2)), fill=(70, 54, 34, 255), width=3)
    d.ellipse((hub[0] - 11, hub[1] - 11, hub[0] + 11, hub[1] + 11), fill=(40, 32, 22, 255))
    # стога справа
    d.ellipse((W * 0.68, H * 0.70, W * 0.68 + 140, H * 0.70 + 84), fill=(140, 112, 58, 255))
    d.ellipse((W * 0.68 + 16, H * 0.68, W * 0.68 + 116, H * 0.68 + 52), fill=(158, 128, 66, 255))
    d.ellipse((W * 0.86, H * 0.76, W * 0.86 + 110, H * 0.76 + 66), fill=(134, 108, 56, 255))
    # трава-мазки
    for _ in range(500):
        x = random.uniform(0, W)
        y = random.uniform(horizon + 12, H)
        depth = (y - horizon) / (H - horizon)
        d.line((x, y, x + random.uniform(-2, 2), y - (3 + 10 * depth)),
               fill=random.choice([(112, 100, 52), (98, 90, 48)]), width=1)
    im = ground_shade(im, int(H * 0.64), (16, 12, 6), 80)
    finish(im, 'battle_bg_mill')


def make_apiary():
    im = vgrad((W, H), (108, 98, 72), (150, 128, 86)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.42)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((104, 96, 76), (162, 138, 94), t))
    treeline(d, horizon + 4, W, (52, 54, 32), 240, 18, 52, 20)
    treeline(d, horizon + 10, W, (42, 46, 28), 255, 24, 64, 26)
    d.rectangle((0, horizon + 8, W, H), fill=(96, 92, 52, 255))
    # луг с цветами
    for _ in range(700):
        x = random.uniform(0, W)
        y = random.uniform(horizon + 12, H)
        depth = (y - horizon) / (H - horizon)
        d.line((x, y, x + random.uniform(-2, 2), y - (3 + 11 * depth)),
               fill=random.choice([(108, 100, 54), (94, 90, 50), (118, 106, 58)]), width=1)
        if random.random() < 0.12:
            col = random.choice([(196, 168, 84), (176, 140, 76), (208, 190, 120)])
            d.ellipse((x - 2, y - 4, x + 2, y), fill=col + (220,))
    # ряд ульев (средний план)
    for i in range(4):
        ux = W * 0.30 + i * 150
        uy = H * 0.66 + (i % 2) * 26
        uw, uh = 74, 92
        d.polygon([(ux - uw / 2, uy), (ux + uw / 2, uy),
                   (ux + uw / 2 - 8, uy - uh), (ux - uw / 2 + 8, uy - uh)],
                  fill=(148, 108, 56, 255))
        for k in range(4):
            yy = uy - 14 - k * 22
            d.rectangle((ux - uw / 2 + 6 + k, yy, ux + uw / 2 - 6 - k, yy + 7),
                        fill=(122, 88, 44, 255))
        d.rectangle((ux - 10, uy - uh - 4, ux + 10, uy - uh + 4), fill=(104, 74, 38, 255))
    im = ground_shade(im, int(H * 0.6), (14, 12, 5), 75)
    finish(im, 'battle_bg_apiary')


def make_road():
    im = vgrad((W, H), (100, 92, 76), (148, 124, 88)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    horizon = int(H * 0.40)
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=lerp((96, 88, 74), (156, 130, 90), t))
    treeline(d, horizon + 4, W, (54, 50, 32), 230, 12, 36, 18)
    d.rectangle((0, horizon + 6, W, H), fill=(94, 86, 52, 255))
    # поля по сторонам + дорога в перспективе
    d.polygon([(W * 0.40, horizon + 6), (W * 0.60, horizon + 6),
               (W * 1.25, H), (W * -0.25, H)], fill=(132, 110, 72, 255))
    # колеи
    for k in (-0.055, 0.055):
        d.line((W * (0.5 + k), horizon + 6, W * (0.5 + k * 6), H),
               fill=(112, 92, 58, 255), width=6)
    # краевые камни/травка вдоль дороги
    for _ in range(360):
        t = random.random()
        y = horizon + 8 + t * (H - horizon - 12)
        spread = 0.10 + t * 0.55
        side = random.choice((-1, 1))
        x = W * 0.5 + side * (0.07 + spread) * W * random.uniform(0.9, 1.25)
        depth = (y - horizon) / (H - horizon)
        d.line((x, y, x + random.uniform(-2, 2), y - (3 + 10 * depth)),
               fill=random.choice([(100, 92, 50), (88, 82, 46)]), width=1)
    # вехи у дороги
    for t in (0.25, 0.55):
        y = horizon + 10 + t * (H - horizon)
        x = W * 0.5 - (0.09 + t * 0.3) * W
        hh = 26 + t * 60
        d.line((x, y, x, y - hh), fill=(70, 56, 38, 255), width=4)
        d.rectangle((x, y - hh, x + 12, y - hh + 9), fill=(150, 130, 90, 255))
    # птицы
    for _ in range(3):
        x, y = random.uniform(W * 0.2, W * 0.8), random.uniform(50, 140)
        r = random.uniform(6, 12)
        d.arc((x - r, y - r / 2, x, y + r / 2), 200, 340, fill=(60, 54, 44, 220), width=2)
        d.arc((x, y - r / 2, x + r, y + r / 2), 200, 340, fill=(60, 54, 44, 220), width=2)
    im = ground_shade(im, int(H * 0.6), (16, 12, 6), 80)
    finish(im, 'battle_bg_road')


def make_interior():
    im = vgrad((W, H), (58, 40, 26), (38, 26, 16)).convert('RGBA')
    d = ImageDraw.Draw(im, 'RGBA')
    wall_h = int(H * 0.52)
    # бревенчатая стена: горизонтальные брёвна
    y = 0
    row = 0
    while y < wall_h:
        hh = 44
        col = lerp((92, 64, 40), (74, 50, 30), (row % 2) * 0.5 + 0.25)
        d.rectangle((0, y, W, min(wall_h, y + hh)), fill=col + (255,))
        # торцы брёвен (вертикальные стыки со смещением)
        off = 90 if row % 2 == 0 else 210
        for x in range(off, W, 260):
            d.ellipse((x - 9, y + 6, x + 9, min(wall_h, y + hh) - 6), fill=(60, 40, 24, 255))
            d.ellipse((x - 4, y + 11, x + 4, min(wall_h, y + hh) - 11), fill=(86, 60, 36, 255))
        d.line((0, y + hh - 2, W, y + hh - 2), fill=(40, 26, 14, 255), width=3)
        y += hh
        row += 1
    # окно с тёплым светом
    wx, wy, ww, wh = W * 0.72, 60, 150, 170
    d.rectangle((wx - 10, wy - 10, wx + ww + 10, wy + wh + 10), fill=(36, 24, 14, 255))
    d.rectangle((wx, wy, wx + ww, wy + wh), fill=(214, 178, 108, 255))
    d.rectangle((wx, wy, wx + ww, wy + wh // 2), fill=(228, 196, 124, 255))
    d.rectangle((wx + ww // 2 - 3, wy, wx + ww // 2 + 3, wy + wh), fill=(36, 24, 14, 255))
    d.rectangle((wx, wy + wh // 2 - 3, wx + ww, wy + wh // 2 + 3), fill=(36, 24, 14, 255))
    # свет из окна на пол
    shaft = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(shaft)
    ds.polygon([(wx, wy + wh), (wx + ww, wy + wh),
                (wx + ww + 130, H), (wx - 40, H)], fill=(226, 186, 110, 42))
    shaft = shaft.filter(ImageFilter.GaussianBlur(14))
    im = Image.alpha_composite(im, shaft)
    d = ImageDraw.Draw(im, 'RGBA')
    # пол: доски
    d.rectangle((0, wall_h, W, H), fill=(74, 52, 32, 255))
    for x in range(0, W, 64):
        d.line((x, wall_h, x - 30, H), fill=(52, 36, 22, 255), width=3)
    for y2 in range(wall_h + 40, H, 90):
        d.line((0, y2, W, y2 - 18), fill=(56, 38, 24, 200), width=2)
    # лавка у стены слева (вплотную к бревнам)
    bx, by = W * 0.10, wall_h - 34
    d.rectangle((bx, by, bx + 300, by + 26), fill=(96, 68, 40, 255))
    d.rectangle((bx, by, bx + 300, by + 8), fill=(112, 80, 48, 255))
    d.rectangle((bx + 10, by + 26, bx + 26, by + 88), fill=(76, 52, 30, 255))
    d.rectangle((bx + 274, by + 26, bx + 290, by + 88), fill=(76, 52, 30, 255))
    # печь справа: каменный массив с устьем и трубой
    ovx, ovy = W * 0.80, wall_h - 150
    d.rectangle((ovx, ovy, W, H * 0.86), fill=(84, 72, 62, 255))
    for k in range(7):
        yy = ovy + 12 + k * 30
        d.line((ovx, yy, W, yy), fill=(64, 54, 46, 255), width=3)
        for xst in range(int(ovx) + 14, W - 10, 44):
            d.arc((xst, yy - 9, xst + 34, yy + 9), 0, 360, fill=(70, 60, 52, 160), width=2)
    d.rectangle((ovx + 90, H * 0.60, ovx + 190, H * 0.78), fill=(28, 18, 10, 255))  # устье
    d.ellipse((ovx + 105, H * 0.63, ovx + 175, H * 0.75), fill=(52, 32, 16, 255))
    d.rectangle((W - 90, 0, W - 46, ovy), fill=(64, 54, 46, 255))  # труба
    # красный угол: икона в окладе с кокошником
    ix, iy = W * 0.18, 74
    d.polygon([(ix - 44, iy + 6), (ix + 44, iy + 6), (ix, iy - 22)], fill=(84, 58, 32, 255))
    d.rectangle((ix - 34, iy, ix + 34, iy + 76), fill=(84, 58, 32, 255))
    d.rectangle((ix - 25, iy + 9, ix + 25, iy + 67), fill=(146, 114, 60, 255))
    d.rectangle((ix - 25, iy + 9, ix + 25, iy + 67), outline=(96, 74, 40, 255), width=2)
    d.ellipse((ix - 9, iy + 18, ix + 9, iy + 36), fill=(96, 76, 42, 255))
    im = ground_shade(im, wall_h + 80, (12, 8, 4), 80)
    finish(im, 'battle_bg_interior')


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    make_forest()
    make_field()
    make_lake()
    make_river()
    make_pogost()
    make_mill()
    make_apiary()
    make_road()
    make_interior()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# r86 патч 4: ГУСТАЯ ПУШИСТАЯ ТРАВА во всех локациях
# grass_0..3.png (32x32) — процедурные бесшовные тайлы: пятнистая основа,
# сотни травинок-штрихов, кочки, сухинки; 4 варианта настроения.
# Тайл рисуется в 4x суперсэмплинге (128px) и ужимается — мягкие, но
# отчётливые былинки вместо плоской зелёной заливки.
from PIL import Image, ImageDraw
import math, random, os

REPO = '/home/z/my-project/sosnowda.github.io'
SS = 4          # суперсэмплинг
T = 32 * SS     # 128

# --- палитра из текущих тайлов (согласована с деревом игры) ---
im0 = Image.open(f'{REPO}/game/assets/tiles/grass_0.png').convert('RGB')
p0 = im0.load()
base_samples = [p0[x, y] for x in range(0, 32, 3) for y in range(0, 32, 3)]
base_samples.sort(key=lambda c: c[0] + c[1] + c[2])
dark  = base_samples[len(base_samples) // 20]     # тёмный тон
mid   = base_samples[len(base_samples) // 2]      # средний
light = base_samples[-len(base_samples) // 12]    # светлый
# сдвиг оттенков для былинок
def shift(c, dr, dg, db):
    return (max(0, min(255, c[0] + dr)), max(0, min(255, c[1] + dg)), max(0, min(255, c[2] + db)))

BLADE_L = shift(light, 14, 16, 6)     # светлые былинки
BLADE_D = shift(dark, -6, -4, -2)     # тёмные былинки
BLADE_M = shift(mid, 6, 8, 2)
TUFT_B  = shift(dark, -12, -10, -4)   # основание кочек
DRY     = shift(light, 26, 18, -18)   # сухинка (соломка)
FLOWER_Y = (214, 196, 108)
FLOWER_W = (218, 216, 196)

def wrap_draw(d, fn, *a):
    """Рисует примитив 9 раз для бесшовности."""
    for ox in (-T, 0, T):
        for oy in (-T, 0, T):
            fn(d, *(list(a) + [ox, oy]))

def blade(d, x, y, ln, w, c, ox, oy, bend=0.0, ang=0.0):
    """Травинка: сужающаяся кривая."""
    ln = float(ln); w = float(w)
    pts = []
    steps = max(3, int(ln // 3))
    for i in range(steps + 1):
        t = i / steps
        bx = x + math.sin(ang + bend * t * 1.7) * ln * 0.22 * t
        pts.append((bx + ox, y - ln * t + oy))
    for i in range(steps):
        t0, t1 = i / steps, (i + 1) / steps
        ww = max(1, int(w * (1 - t1 * 0.8)))
        d.line([pts[i], pts[i + 1]], fill=c, width=ww)

def make_variant(seed, mood):
    """mood: 0 обычная, 1 с сухинками, 2 с цветами, 3 сочная тёмная."""
    rnd = random.Random(seed)
    img = Image.new('RGB', (T, T), mid)
    d = ImageDraw.Draw(img)
    # 1) пятнистая основа — мягкие пятна ±1-2 тона
    for i in range(38):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        r = rnd.uniform(8, 20)
        c = shift(mid, rnd.randint(-7, 7), rnd.randint(-8, 8), rnd.randint(-5, 4))
        for (ox, oy) in ((0,0),(-T,0),(T,0),(0,-T),(0,T),(-T,-T),(T,T),(-T,T),(T,-T)):
            d.ellipse([x+ox-r, y+oy-r, x+ox+r, y+oy+r], fill=c)
    # 2) тёмные прогалины у оснований — мелкие, редкие
    for i in range(8):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        r = rnd.uniform(4, 8)
        c = shift(dark, 0, 2, 0)
        for (ox, oy) in ((0,0),(-T,0),(T,0),(0,-T),(0,T),(-T,-T),(T,T),(-T,T),(T,-T)):
            d.ellipse([x+ox-r, y+oy-r*0.6, x+ox+r, y+oy+r*0.6], fill=c)
    # 3) ТРАВИНКИ — плотный слой (главный объём)
    n_blades = 380
    for i in range(n_blades):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        ln = rnd.uniform(7, 19)
        w = rnd.uniform(2.0, 3.4)
        bend = rnd.uniform(-0.9, 0.9)
        ang = rnd.uniform(-0.25, 0.25)
        r = rnd.random()
        if r < 0.34: c = BLADE_L
        elif r < 0.62: c = BLADE_M
        else: c = BLADE_D
        wrap_draw(d, lambda dd, *aa: blade(dd, aa[0], aa[1], aa[2], aa[3], aa[4], aa[5], aa[6], bend, ang),
                  x, y, ln, w, c)
    # 4) Кочки: 5-7 пучков — тёмное основание + веер светлых травинок
    for i in range(6):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        base = shift(dark, -4, -6, -2)
        for (ox, oy) in ((0,0),(-T,0),(T,0),(0,-T),(0,T),(-T,-T),(T,T),(-T,T),(T,-T)):
            d.ellipse([x+ox-4*SS, y+oy-2*SS, x+ox+4*SS, y+oy+2*SS], fill=base)
        nb = rnd.randint(6, 9)
        for j in range(nb):
            a = -math.pi/2 + (j/(nb-1) - 0.5) * 2.2
            bx = x + math.cos(a) * 2.2 * SS
            by = y + 1 * SS
            ln = rnd.uniform(8, 14) * SS / 4
            c = BLADE_L if j % 2 else BLADE_M
            wrap_draw(d, lambda dd, *aa: blade(dd, aa[0], aa[1], aa[2], aa[3], aa[4], aa[5], aa[6],
                                              math.cos(a)*0.8, math.sin(a)*0.18), bx, by, ln, 2.6, c)
    # 5) настроение
    if mood == 1:   # сухинки
        for i in range(10):
            x, y = rnd.uniform(0, T), rnd.uniform(0, T)
            ln = rnd.uniform(5, 10)
            wrap_draw(d, lambda dd, *aa: blade(dd, aa[0], aa[1], aa[2], aa[3], aa[4], aa[5], aa[6],
                                              rnd.uniform(-1,1), 0), x, y, ln, 2.0, DRY)
    elif mood == 2: # цветочки
        for i in range(3):
            x, y = rnd.uniform(3, T-3), rnd.uniform(3, T-3)
            for (ox, oy) in ((0,0),(-T,0),(T,0),(0,-T),(0,T)):
                d.ellipse([x+ox-1.6*SS, y+oy-1.6*SS, x+ox+1.6*SS, y+oy+1.6*SS], fill=FLOWER_Y)
                d.ellipse([x+ox-0.7*SS, y+oy-0.7*SS, x+ox+0.7*SS, y+oy+0.7*SS], fill=shift(mid, 10, 12, 4))
    elif mood == 3: # сочная тёмная
        for i in range(60):
            x, y = rnd.uniform(0, T), rnd.uniform(0, T)
            ln = rnd.uniform(7, 15)
            wrap_draw(d, lambda dd, *aa: blade(dd, aa[0], aa[1], aa[2], aa[3], aa[4], aa[5], aa[6],
                                              rnd.uniform(-0.7,0.7), 0), x, y, ln, 2.8, shift(dark, 4, 8, 2))
    # 6) финальный светлый штрих — отдельные блики-травинки
    for i in range(50):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        ln = rnd.uniform(3, 7)
        wrap_draw(d, lambda dd, *aa: blade(dd, aa[0], aa[1], aa[2], aa[3], aa[4], aa[5], aa[6],
                                          rnd.uniform(-0.6,0.6), 0), x, y, ln, 1.8, BLADE_L)
    return img.resize((32, 32), Image.LANCZOS)

# варианты: 0 обычная, 1 суховатая, 2 с цветами, 3 сочная
MOODS = [0, 1, 2, 3]
for v, mood in enumerate(MOODS):
    t = make_variant(100 + v * 17, mood)
    t.save(f'{REPO}/game/assets/tiles/grass_{v}.png')
    print(f'grass_{v}.png ← mood {mood}')

# pasture_grass.png (выпас) — обновим тем же стилем, крупнее кочки
pg = make_variant(777, 1)
pg.save(f'{REPO}/game/assets/tiles/pasture_grass.png')
print('pasture_grass.png обновлён')

# контрольный монтаж: 4 тайла + 4x4 мозаика из них
tiles = [Image.open(f'{REPO}/game/assets/tiles/grass_{i}.png').convert('RGB') for i in range(4)]
mos = Image.new('RGB', (32 * 4, 32 * 4), (0, 0, 0))
rnd = random.Random(5)
for gy in range(4):
    for gx in range(4):
        mos.paste(tiles[rnd.randrange(4)], (gx * 32, gy * 32))
mos = mos.resize((32 * 4 * 4, 32 * 4 * 4), Image.NEAREST)
mos.save('/home/z/my-project/download/r86_probe/grass_new_mosaic.png')
strip = Image.new('RGB', (32 * 4 * 4, 32 * 4), (0, 0, 0))
for i, t in enumerate(tiles):
    strip.paste(t.resize((128, 128), Image.NEAREST), (i * 128, 0))
strip.save('/home/z/my-project/download/r86_probe/grass_new_tiles.png')
print('probes saved')

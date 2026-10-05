#!/usr/bin/env python3
# r86 патч 2: САМОПРЯЛКА → ПРЯЛКА-КОПЫЛ
# Самопрялка (колесо) на Руси появилась не раньше XVI–XIX вв.; в XV веке
# пряли с прялки-копыла: доска-копыл в донце, сверху лопатка с куделью,
# нить сучат веретеном. Колёса стираются из двух интерьеров и из декора.
from PIL import Image, ImageDraw
import os

REPO = '/home/z/my-project/sosnowda.github.io'

# палитра
W_DARK  = (43, 30, 17, 255)
W_MID   = (88, 63, 35, 255)
W_LIGHT = (116, 87, 50, 255)
W_HI    = (143, 112, 68, 255)
FLAX    = (217, 203, 168, 255)
FLAX_D  = (179, 163, 130, 255)
FLAX_L  = (236, 225, 196, 255)
HOLE_D  = (25, 17, 9, 255)

def lerp(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def draw_kopyl(im, cx, base_y, s=1.0, shadow=True):
    """Прялка-копыл в нормированных координатах 48x56, масштаб s.
    cx — центр копыла, base_y — низ донца."""
    px = im.load()
    W, H = im.size
    rgb = (im.mode == 'RGB')
    def C(c):
        return c[:3] if rgb else c
    def P(nx, ny):  # нормированные → пиксели
        return (cx + (nx - 24) * s, base_y + (ny - 56) * s)
    def rect(nx0, ny0, nx1, ny1, c):
        c = C(c)
        x0, y0 = P(nx0, ny0); x1, y1 = P(nx1, ny1)
        for yy in range(max(0, int(y0)), min(H, int(y1) + 1)):
            for xx in range(max(0, int(x0)), min(W, int(x1) + 1)):
                px[xx, yy] = c
    def vline(nx, ny0, ny1, c, w=1):
        c = C(c)
        x, y0_, y1_ = P(nx, ny0)[0], P(nx, ny0)[1], P(nx, ny1)[1]
        for yy in range(max(0, int(y0_)), min(H, int(y1_) + 1)):
            for dx in range(w):
                xx = int(x) + dx
                if 0 <= xx < W: px[xx, yy] = c
    # тень на полу
    if shadow:
        sh = int(20 * s)
        for dx in range(-sh, sh + 1):
            t = 1 - abs(dx) / (sh + 1)
            xx, yy = int(cx + dx), int(base_y + 1 * s)
            if 0 <= xx < W and 0 <= yy < H:
                if rgb:
                    r, g, b = px[xx, yy][:3]
                    px[xx, yy] = (int(r * (1 - 0.30 * t)), int(g * (1 - 0.30 * t)),
                                  int(b * (1 - 0.30 * t)))
                else:
                    r, g, b, a = px[xx, yy]
                    px[xx, yy] = (int(r * (1 - 0.30 * t)), int(g * (1 - 0.30 * t)),
                                  int(b * (1 - 0.30 * t)), a)
    # донце (базовая доска)
    rect(9, 50.5, 39, 54.5, W_MID)
    rect(9, 50.5, 39, 51.5, W_HI)      # верхняя светлая кромка
    rect(9, 53.5, 39, 54.5, W_DARK)    # низ
    rect(37, 50.5, 39, 54.5, W_DARK)   # торец
    # копыл (вертикальная доска, чуть сужается кверху)
    for i, ny in enumerate(range(19, 51)):
        t = (ny - 19) / 32
        w = 2.6 - 0.6 * t
        x0 = 24 - w; x1 = 24 + w
        rect(x0, ny, x1, ny + 1, W_MID if i % 7 else W_LIGHT)
    vline(21.8, 19, 51, W_DARK, 1)
    vline(26.0, 19, 51, W_LIGHT, 1)
    # лопатка (широкая доска сверху, трапеция)
    rect(17.5, 18, 30.5, 21, W_MID)
    for ny in range(10, 18):
        t = (ny - 10) / 8
        x0 = 16.5 - 1.0 * t; x1 = 31.5 + 1.0 * t
        rect(x0, ny, x1, ny + 1, W_MID if ny % 4 else W_LIGHT)
    rect(16.5, 10, 31.5, 11, W_DARK)    # верхний торец
    vline(17, 10, 18, W_DARK, 1)
    vline(31, 10, 18, W_HI, 1)
    # кудель (пучок волокна, обматывает лопатку сверху) — вертикальные штрихи
    import math, random
    rnd = random.Random(6686)
    for i in range(int(220 * min(2.0, s))):
        # плотное эллиптическое облако над лопаткой
        a = rnd.uniform(0, 2 * math.pi)
        rr = math.sqrt(rnd.random())
        nx = 24 + math.cos(a) * 11.5 * rr
        ny = 6.0 + math.sin(a) * 5.0 * rr + 2.0 * rr
        c = FLAX if i % 5 < 3 else (FLAX_D if i % 5 == 3 else FLAX_L)
        c = C(c)
        X0, Y0_ = P(nx, ny)
        X0, Y0_ = int(X0), int(Y0_)
        ln = rnd.randint(2, max(2, int(4 * s)))          # длина штриха
        for dy in range(ln):
            Y = Y0_ + dy
            if 0 <= X0 < W and 0 <= Y < H:
                px[X0, Y] = c
    # тёмный подпор кудели (тень под пучком)
    for i in range(int(40 * min(2.0, s))):
        a = rnd.uniform(0, math.pi)
        rr = math.sqrt(rnd.random())
        nx = 24 + math.cos(a) * 10.0 * rr
        ny = 14.5 + math.sin(a) * 2.0 * rr
        X0, Y0_ = P(nx, ny)
        X0, Y0_ = int(X0), int(Y0_)
        if 0 <= X0 < W and 0 <= Y0_ < H:
            px[X0, Y0_] = C((122, 104, 78, 255) if rgb else (122, 104, 78, 255))
    # обмотка кудели поперёк лопатки (2 нити)
    rect(15, 11.5, 33, 12.5, (139, 121, 90, 255))
    rect(15, 15.5, 33, 16.5, (139, 121, 90, 255))
    # веретено (тонкая палочка вкось, вонзена в кудель)
    steps = int(26 * s)
    for i in range(steps):
        t = i / steps
        nx = 20.5 - 9.5 * t
        ny = 17 + 21 * t
        X, Y = P(nx, ny)
        X, Y = int(X), int(Y)
        c = C(W_LIGHT if t < 0.85 else W_DARK)
        for dx in range(max(1, int(s))):
            for dy in range(max(1, int(s))):
                if 0 <= X + dx < W and 0 <= Y + dy < H:
                    px[X + dx, Y + dy] = c
    # шляпка веретена (маленькое утолщение-вихрь)
    X, Y = P(11.5, 37)
    X, Y = int(X), int(Y)
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            if 0 <= X + dx < W and 0 <= Y + dy < H:
                px[X + dx, Y + dy] = C(W_DARK)

# ---------- 1) deco_spinning.png 48x56 ----------
p = f'{REPO}/game/assets/interiors/deco_spinning.png'
im = Image.new('RGBA', (48, 56), (0, 0, 0, 0))   # чистый холст — старое колесо снято
draw_kopyl(im, 24, 55, s=1.0, shadow=False)
im.save(p)
print('deco_spinning.png → прялка-копыл 48x56')

# ---------- 2) int_bg_weaver_house.webp ----------
p = f'{REPO}/game/assets/interiors/int_bg_weaver_house.webp'
im = Image.open(p).convert('RGB')
px = im.load()
X0, Y0, X1, Y1 = 700, 158, 838, 292
for y in range(Y0, 284):                       # проход 1: сдвиг справа
    for x in range(X0, X1):
        px[x, y] = px[x + 140, y]
for y in range(284, Y1):                       # проход 2: курсы полов совпадают
    for x in range(X0, X1):
        px[x, y] = px[x, y - 40]
draw_kopyl(im, 772, 280, s=2.55)
im.save(p, quality=92)
print('int_bg_weaver_house.webp → колесо стёрто, копыл нарисован')

# ---------- 3) int_bg_villager_house_2.webp ----------
p = f'{REPO}/game/assets/interiors/int_bg_villager_house_2.webp'
im = Image.open(p).convert('RGB')
px = im.load()
X0, Y0, X1, Y1 = 376, 190, 512, 320
for y in range(Y0, Y1):
    for x in range(X0, X1):
        px[x, y] = px[x + 145, y]
draw_kopyl(im, 444, 314, s=2.1)
im.save(p, quality=92)
print('int_bg_villager_house_2.webp → колесо стёрто, копыл нарисован')

# контрольные кадры
OUT = '/home/z/my-project/download/r86_probe'
sp = Image.open(f'{REPO}/game/assets/interiors/deco_spinning.png').convert('RGBA')
b = Image.new('RGBA', sp.size, (200, 190, 170, 255)); b.alpha_composite(sp)
b.resize((sp.width * 6, sp.height * 6), Image.NEAREST).convert('RGB').save(f'{OUT}/kopyl_deco_x6.png')
wv = Image.open(f'{REPO}/game/assets/interiors/int_bg_weaver_house.webp').convert('RGB')
wv.crop((620, 100, 900, 360)).resize((560, 520), Image.LANCZOS).save(f'{OUT}/kopyl_weaver.png')
v2 = Image.open(f'{REPO}/game/assets/interiors/int_bg_villager_house_2.webp').convert('RGB')
v2.crop((330, 140, 600, 380)).resize((540, 480), Image.LANCZOS).save(f'{OUT}/kopyl_villager2.png')
print('probes saved')

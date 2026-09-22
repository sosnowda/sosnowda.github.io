#!/usr/bin/env python3
# Раунд 66.8: отдельный og:image для браузерного демо (game/index.html).
# 1200×630: фон — кадр деревни (04-village.webp), тёмная плашка снизу,
# заголовок «ЛЕТОПИСИ РУСИ», подзаголовок, адрес демо.
# Шрифт — DejaVu (кириллица есть). Результат: assets/images/og-demo.jpg
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

SRC = 'assets/screenshots/04-village.webp'
OUT = 'assets/images/og-demo.jpg'
W, H = 1200, 630

img = Image.open(SRC).convert('RGB')
sw, sh = img.size
# центр-кроп под 1200:630 (1.9048)
target = W / H
if sw / sh > target:
    nw = int(sh * target)
    img = img.crop(((sw - nw) // 2, 0, (sw - nw) // 2 + nw, sh))
else:
    nh = int(sw / target)
    img = img.crop((0, (sh - nh) // 2, sw, (sh - nh) // 2 + nh))
img = img.resize((W, H), Image.LANCZOS)

# лёгкое затемнение кадра сверху донизу + плотная плашка в нижней трети
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for y in range(H):
    a = int(90 * (y / H) ** 1.5)
    od.line([(0, y), (W, y)], fill=(10, 6, 2, a))
od.rectangle([0, H - 210, W, H], fill=(12, 8, 4, 200))
img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

d = ImageDraw.Draw(img)

def font(path, size):
    return ImageFont.truetype(path, size)

SERIF_B = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'

# Заголовок с двойной обводкой (тень)
title = 'ЛЕТОПИСИ РУСИ'
f_title = font(SERIF_B, 92)
tw = d.textlength(title, font=f_title)
tx, ty = (W - tw) / 2, H - 350
for dx, dy in [(4, 4), (-2, 2), (2, -2)]:
    d.text((tx + dx, ty + dy), title, font=f_title, fill=(0, 0, 0))
d.text((tx, ty), title, font=f_title, fill=(232, 200, 120))

sub = 'Браузерная RPG-детектив · Русь XV века · BRP d100'
f_sub = font(SERIF, 34)
sw2 = d.textlength(sub, font=f_sub)
d.text(((W - sw2) / 2, H - 226), sub, font=f_sub, fill=(232, 220, 196), stroke_width=2, stroke_fill=(0, 0, 0))

url = 'sosnowda.github.io/game/'
f_url = font(SERIF_B, 30)
uw = d.textlength(url, font=f_url)
d.rounded_rectangle([(W - uw) / 2 - 24, H - 152, (W + uw) / 2 + 24, H - 96], radius=14, fill=(139, 44, 26), outline=(201, 169, 97), width=3)
d.text(((W - uw) / 2, H - 138), url, font=f_url, fill=(243, 233, 210))

img.save(OUT, 'JPEG', quality=88, optimize=True)
print('OK', OUT, img.size, os.path.getsize(OUT), 'bytes')

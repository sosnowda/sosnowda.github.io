#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Прobe-вырезки зданий из Fantastic Buildings - Medieval (раунд 65).
Кропим щедрые прямоугольники, авто-обрезаем по альфе, собираем
пронумерованный контакт-лист для визуальной проверки границ."""
from PIL import Image, ImageDraw
import os

PACK = '/home/z/fb_pack/extracted/Fantastic Buildings - Medieval/mv-fantastic-buildings-medieval/Tilesets'
OUT = '/tmp/fb_probe'
os.makedirs(OUT, exist_ok=True)

CROPS = [
    # (sheet, name, x0, y0, x1, y1)
    ('Rural_TileD', 'd_church',      0,   0, 262, 300),
    ('Rural_TileD', 'd_manor',     362,  36, 578, 262),
    ('Rural_TileD', 'd_thatch_big',398, 238, 730, 500),
    ('Rural_TileD', 'd_thatch_small',398,530, 552, 730),
    ('Rural_TileC', 'c_log_gray',    0,   0, 266, 274),
    ('Rural_TileC', 'c_log_porch',   0, 186, 140, 274),
    ('Rural_TileC', 'c_log_flowers',376, 222, 618, 455),
    ('Rural_TileC', 'c_log_chimney',618,   0, 768, 328),
    ('Rural_TileC', 'c_log_thatch',376, 446, 620, 640),
    ('Rural_TileB', 'b_log_chimney',532, 384, 768, 730),
    ('Rural_TileE', 're_inn',      356,   0, 768, 285),
    ('Rural_TileE', 're_thatch_a',   0,   0, 358, 254),
    ('Rural_TileE', 're_thatch_b', 356, 435, 563, 672),
    ('City_TileB',  'cb_smithy',   440,  85, 580, 420),
    ('City_TileB',  'cb_tudor_fl', 145,   0, 382, 235),
    ('City_TileB',  'cb_tudor_sm',   0,  36, 158, 220),
]

trimmed = []
for sheet, name, x0, y0, x1, y1 in CROPS:
    im = Image.open(os.path.join(PACK, sheet + '.png')).convert('RGBA')
    crop = im.crop((x0, y0, x1, y1))
    bbox = crop.getbbox()  # по альфе+цвету
    t = crop.crop(bbox)
    t.save(os.path.join(OUT, name + '.png'))
    trimmed.append((name, t, (x0 + bbox[0], y0 + bbox[1], x0 + bbox[2], y0 + bbox[3])))
    print(f'{name}: crop=({x0},{y0},{x1},{y1}) -> trim={t.size} at abs ({x0+bbox[0]},{y0+bbox[1]})')

# Контакт-лист: клетки 260x340, подписи
COLS = 4
ROWS = (len(trimmed) + COLS - 1) // COLS
CW, CH = 280, 360
sheet_img = Image.new('RGBA', (COLS * CW, ROWS * CH), (40, 44, 38, 255))
d = ImageDraw.Draw(sheet_img)
for i, (name, t, absbox) in enumerate(trimmed):
    cx, cy = (i % COLS) * CW + 10, (i // COLS) * CH + 26
    # вписать по клетке
    sc = min((CW - 20) / t.width, (CH - 60) / t.height, 1.0)
    tt = t.resize((max(1, int(t.width * sc)), max(1, int(t.height * sc))), Image.NEAREST)
    sheet_img.alpha_composite(tt, (cx, cy))
    d.text((cx, cy - 18), f'{i}:{name} {t.size[0]}x{t.size[1]}', fill=(255, 220, 120, 255))
sheet_img.save(os.path.join(OUT, '_contact.png'))
print('contact sheet:', os.path.join(OUT, '_contact.png'))

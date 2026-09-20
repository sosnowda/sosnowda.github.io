#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Зум-проверка спорных вырезок с сеткой 8px (раунд 65)."""
from PIL import Image, ImageDraw
import os

PACK = '/home/z/fb_pack/extracted/Fantastic Buildings - Medieval/mv-fantastic-buildings-medieval/Tilesets'
OUT = '/tmp/fb_probe'

ZOOMS = [
    ('Rural_TileD', 'z_manor',   356,  30, 584, 268, 2),
    ('Rural_TileD', 'z_thbig',   392, 232, 740, 510, 1),
    ('Rural_TileC', 'z_flowers', 370, 216, 624, 460, 1),
    ('Rural_TileC', 'z_chimney', 600,   0, 768, 310, 1),
    ('Rural_TileE', 'z_thb',     350, 430, 570, 678, 1),
    ('Rural_TileC', 'z_gray',      0,   0, 120, 280, 2),
    ('Rural_TileC', 'z_thatch',  380, 440, 626, 646, 1),
]

for sheet, name, x0, y0, x1, y1, zoom in ZOOMS:
    im = Image.open(os.path.join(PACK, sheet + '.png')).convert('RGBA')
    crop = im.crop((x0, y0, x1, y1))
    if zoom > 1:
        crop = crop.resize((crop.width * zoom, crop.height * zoom), Image.NEAREST)
    # сетка каждые 48px исходника (или 8px мелкая — каждые 8*zoom)
    d = ImageDraw.Draw(crop)
    for gx in range(0, x1 - x0 + 1, 8):
        col = (255, 0, 0, 90) if gx % 48 == 0 else (255, 255, 255, 28)
        d.line([gx * zoom, 0, gx * zoom, crop.height], fill=col)
    for gy in range(0, y1 - y0 + 1, 8):
        col = (255, 0, 0, 90) if gy % 48 == 0 else (255, 255, 255, 28)
        d.line([0, gy * zoom, crop.width, gy * zoom], fill=col)
    # подписи абс. координат каждые 48
    for gx in range(0, x1 - x0 + 1, 48):
        d.text((gx * zoom + 2, 2), str(x0 + gx), fill=(255, 255, 0, 255))
    for gy in range(0, y1 - y0 + 1, 48):
        d.text((2, gy * zoom + 2), str(y0 + gy), fill=(0, 255, 255, 255))
    bg = Image.new('RGBA', crop.size, (30, 34, 30, 255))
    bg.alpha_composite(crop)
    bg.save(os.path.join(OUT, name + '.png'))
    print(name, bg.size)

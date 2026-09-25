#!/usr/bin/env python3
# 66.27: QA-кадры -> game/docs/r6627_*.webp (q80, гигиена репо: webp < 100 КБ)
from PIL import Image
import os

SRC = '/tmp/walk6627'
SRC_M = '/tmp/mobile6627'
DST = '/home/z/my-project/site-repo/game/docs'
os.makedirs(DST, exist_ok=True)

frames = [
    (f'{SRC}/loc_road_south.png',  'r6627_road_south.webp'),
    (f'{SRC}/loc_road_north.png',  'r6627_road_north.webp'),
    (f'{SRC}/loc_forest.png',      'r6627_forest.webp'),
    (f'{SRC}/loc_forest_edge.png', 'r6627_forest_edge.webp'),
    (f'{SRC}/loc_field.png',       'r6627_field.webp'),
    (f'{SRC}/loc_river.png',       'r6627_river.webp'),
    (f'{SRC}/loc_pasture.png',     'r6627_pasture.webp'),
    (f'{SRC}/loc_mill.png',        'r6627_mill.webp'),
    (f'{SRC}/loc_forest_glade.png','r6627_glade.webp'),
    (f'{SRC_M}/landscape_map.png', 'r6627_mobile_map.webp'),
    (f'{SRC_M}/landscape_fork.png','r6627_mobile_fork.webp'),
    (f'{SRC_M}/portrait_map.png',  'r6627_mobile_map_portrait.webp'),
]
for src, name in frames:
    if not os.path.exists(src):
        print(f'!! нет {src}'); continue
    im = Image.open(src).convert('RGB')
    out = os.path.join(DST, name)
    im.save(out, 'WEBP', quality=80)
    kb = os.path.getsize(out) / 1024
    flag = 'OK' if kb < 100 else '>>100KB!'
    print(f'{name}: {kb:.0f} KB {flag}')

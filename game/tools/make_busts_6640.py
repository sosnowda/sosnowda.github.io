#!/usr/bin/env python3
# make_busts_6640.py — ПАТЧ 66.40 (приказ владельца про PB/KT_Humans).
# БУСТЫ АЛЬТ-ГЕРОЯ pbnoble (альт боевого облика paul, «Яромир»): 8 портретов
# Medieval_PB_Premade_Male_2_Bust_1..8 (512×512 в паке; премаde — ЖИВОЙ
# дворянин; Male_1 зомби и Male_3 чумной доктор отбракованы) →
# assets/sprites/busts/bust_pbnoble_1..8.png (256×256 LANCZOS, палитра ≤255).
# Конвейер тот же, что make_busts_6639.py. Источник — стейджинг
# /home/z/my-project/drive_parts_battle (tools/drive_fetch_pbkt_6640.py).
import os
from PIL import Image

STAGING = os.environ.get('BUST_STAGING', '/home/z/my-project/drive_parts_battle')
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # game/
OUT = os.path.join(REPO, 'assets', 'sprites', 'busts')
os.makedirs(OUT, exist_ok=True)

N = 8
total = 0
for i in range(1, N + 1):
    src = os.path.join(STAGING, f'Medieval_PB_Premade_Male_2_Bust_{i}.png')
    im = Image.open(src).convert('RGBA')
    im = im.resize((256, 256), Image.LANCZOS)
    out_name = f'bust_pbnoble_{i}.png'
    dst = os.path.join(OUT, out_name)
    q = im.quantize(colors=255, method=Image.FASTOCTREE)
    q.save(dst, optimize=True)
    kb = os.path.getsize(dst) // 1024
    total += kb
    print(f'{out_name}: {kb} КБ <- Medieval_PB_Premade_Male_2_Bust_{i}.png')

with open(os.path.join(OUT, 'MANIFEST_6640.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(f'bust_pbnoble_{i}.png\tPB_Premade_Male_2_Bust_{i}.png'
                      for i in range(1, N + 1)))
    f.write(f'\nИТОГО\t{N} файлов\t{total} КБ\n')
print(f'ИТОГО: {N} бустов, {total} КБ')

#!/usr/bin/env python3
# 66.33: бусты пака «Medieval - Heroes I» -> assets/sprites/busts/ (меню персонажа).
# 512x512 -> 256x256 (LANCZOS), палитра <=255 (Fast Octree) — как у боевых листов.
# Варианты: Баэнор Bust_1 (Воин м) и Bust_5 (Приключенец м), Охотница Bust_1/5
# (Воин ж / Приключенец ж), Гаэррон и Найя — единственные бусты в паке.
# У Пауля буста НЕТ в паке — карта в heroes.js даёт для него null.
import os
from PIL import Image

PACK = '/home/z/my-project/drive-assets/Medieval - Heroes I'
OUT = '/home/z/my-project/sosnowda-site/game/assets/sprites/busts'
SRC = {
    'bust_baenor_1':  'Baenor/Baenor_Bust_1.png',
    'bust_baenor_5':  'Baenor/Baenor_Bust_5.png',
    'bust_huntress_1': 'Huntress/Huntress_Bust_1.png',
    'bust_huntress_5': 'Huntress/Huntress_Bust_5.png',
    'bust_gaerron':   'MasterGaerron/MasterGaerron_Bust.png',
    'bust_naia':      'Naia/Naia_Bust.png',
}

os.makedirs(OUT, exist_ok=True)
total = 0
for key, rel in SRC.items():
    im = Image.open(os.path.join(PACK, rel)).convert('RGBA')
    assert im.size == (512, 512), f'{rel}: {im.size}'
    im = im.resize((256, 256), Image.LANCZOS)
    q = im.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)
    path = os.path.join(OUT, f'{key}.png')
    q.save(path, 'PNG', optimize=True)
    kb = os.path.getsize(path) // 1024
    total += kb
    print(f'{key}.png: {kb} КБ <- {rel}')
print(f'ИТОГО: {len(SRC)} файлов, {total} КБ')

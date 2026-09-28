#!/usr/bin/env python3
# make_busts_6639.py — ПАТЧ 66.39 (приказ владельца: «добавить альты в бусты»).
# Полный комплект бустов пака «Medieval - Heroes I» → assets/sprites/busts/
# (256×256 LANCZOS, палитра ≤255 Fast Octree — как в 66.33):
#   Баэнор      Bust_1..8   (были только 1 и 5);
#   Охотница    Bust_1..8   (были только 1 и 5);
#   Пауль       Bust_1..8   (в 66.33 бустов Пауля в паке НЕ БЫЛО — библиотека
#                           пополнилась, «Сыщик|муж» получает портрет);
#   Лейанн      Bust_1..8   (НОВЫЙ герой пака — альт боевого облика huntress);
#   Гаэррон     Bust (единственный), Найя Bust (единственная),
#   ЛордЭстер   Bust (единственный — НОВЫЙ герой пака, альт облика baenor).
# Источник — стейджинг /home/z/my-project/drive_parts_battle
# (наполнение — tools/drive_fetch_busts_6639.py).
import os
from PIL import Image

STAGING = os.environ.get('BUST_STAGING', '/home/z/my-project/drive_parts_battle')
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # game/
OUT = os.path.join(REPO, 'assets', 'sprites', 'busts')
os.makedirs(OUT, exist_ok=True)

SRC = {}
for i in range(1, 9):
    SRC[f'bust_baenor_{i}'] = f'Baenor_Bust_{i}.png'
    SRC[f'bust_huntress_{i}'] = f'Huntress_Bust_{i}.png'
    SRC[f'bust_paul_{i}'] = f'PaulHammerArm_Bust_{i}.png'
    SRC[f'bust_leyanne_{i}'] = f'Leyanne_Bust_{i}.png'
SRC['bust_gaerron'] = 'MasterGaerron_Bust.png'
SRC['bust_naia'] = 'Naia_Bust.png'
SRC['bust_esther'] = 'LordEsther_Bust.png'

total = 0
manifest = []
for key, src in SRC.items():
    path = os.path.join(STAGING, src)
    im = Image.open(path).convert('RGBA')
    assert im.size == (512, 512), f'{src}: {im.size} != 512x512'
    im = im.resize((256, 256), Image.LANCZOS)
    q = im.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)
    out_path = os.path.join(OUT, f'{key}.png')
    q.save(out_path, 'PNG', optimize=True)
    kb = os.path.getsize(out_path) // 1024
    total += kb
    manifest.append(f'{key}.png\t{kb} КБ\t{src}')
    print(f'{key}.png: {kb} КБ <- {src}')

with open(os.path.join(OUT, 'MANIFEST_6639.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(manifest))
    f.write(f'\nИТОГО\t{len(SRC)} файлов\t{total} КБ\n')
print(f'ИТОГО: {len(SRC)} файлов, {total} КБ')

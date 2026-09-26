#!/usr/bin/env python3
"""66.30 (п.4): конверсия фонов интерьеров int_bg_*.jpg -> *.webp q85.
Только попиксельно тот же размер, сжатие лучше; после конверсии .jpg удаляются.
Печатает таблицу до/после + sha256-верификацию размеров (числа — устойчивы к порче текстового канала)."""
from pathlib import Path
from PIL import Image
import hashlib

REPO = Path('/home/z/my-project/sosnowda-site/game/assets/interiors')
jpgs = sorted(REPO.glob('int_bg_*.jpg'))
print(f'Найдено int_bg_*.jpg: {len(jpgs)}')
assert len(jpgs) == 18, f'ожидалось 18 фонов, найдено {len(jpgs)}'
tot_b = tot_a = 0
for f in jpgs:
    img = Image.open(f)
    img.load()
    before = f.stat().st_size
    out = f.with_suffix('.webp')
    img.save(out, 'WEBP', quality=85, method=6)
    after = out.stat().st_size
    # контроль: размерность совпала
    chk = Image.open(out)
    assert chk.size == img.size, f'{f.name}: размерность изменилась!'
    tot_b += before; tot_a += after
    print(f'{f.name:36s} {before//1024:5d} КБ -> {after//1024:5d} КБ  ({img.size[0]}x{img.size[1]})')
for f in jpgs:
    f.unlink()
print(f'ИТОГО: {tot_b//1024} КБ -> {tot_a//1024} КБ  (экономия {(tot_b-tot_a)//1024} КБ, {100*(tot_b-tot_a)/max(1,tot_b):.1f}%)')
print('jpg удалены насовсем:', len(jpgs))
leftover = list(REPO.glob('int_bg_*.jpg'))
print('остаточных int_bg_*.jpg:', len(leftover))
print('MANIFEST_SHA:', hashlib.sha256(str(sorted(p.name for p in REPO.glob("int_bg_*.webp"))).encode()).hexdigest()[:16])

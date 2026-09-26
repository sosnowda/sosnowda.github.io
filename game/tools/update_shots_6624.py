#!/usr/bin/env python3
# Раунд 66.24 (приказ 1): сравнение свежих кадров /tmp/shots/*.png с кадрами
# на сайте assets/screenshots/*.webp; замена ТОЛЬКО изменившихся кадров.
# Дополнительно: QA-кадры смоука 66.24 → game/docs/*.webp (q80).
import os
from PIL import Image, ImageChops

SRC = '/tmp/shots'
DST = '/home/z/my-project/sosnowda-site/assets/screenshots'
FRAMES = ['01-title', '02-character-select', '03-character-custom', '04-village',
          '05-map', '06-elder-interior', '07-priest-dialogue', '08-combat', '09-thief-encounter']

def webp_bytes(png_path):
    img = Image.open(png_path).convert('RGB')
    assert img.size == (1280, 720), f'{png_path}: {img.size} != 1280x720'
    out = '/tmp/_shot_tmp.webp'
    img.save(out, 'WEBP', quality=85)
    return out, img

changed, same = [], []
for f in FRAMES:
    png = os.path.join(SRC, f + '.png')
    old = os.path.join(DST, f + '.webp')
    tmp, img_new = webp_bytes(png)
    img_old = Image.open(old).convert('RGB')
    if img_old.size != img_new.size:
        diff_pct = 100.0
    else:
        diff = ImageChops.difference(img_old, img_new).convert('L')
        hist = diff.histogram()
        nz = sum(hist[8:])  # пиксели с разницей > 8 (шум webp отсекаем)
        diff_pct = 100.0 * nz / (1280 * 720)
    if diff_pct > 0.5:
        os.replace(tmp, old)
        changed.append((f, round(diff_pct, 1)))
    else:
        os.remove(tmp)
        same.append(f)

print('ЗАМЕНЕНЫ (изменившиеся кадры):')
for f, d in changed:
    print(f'  {f}.webp  diff {d}%')
print(f'БЕЗ ИЗМЕНЕНИЙ: {len(same)}: {", ".join(same)}')

# QA-кадры смоука 66.24 → game/docs (webp q80, как в 66.21–66.23)
qa = '/tmp/shots6624'
docs = '/home/z/my-project/sosnowda-site/game/docs'
for f in os.listdir(qa):
    if f.endswith('.png'):
        img = Image.open(os.path.join(qa, f)).convert('RGB')
        out = os.path.join(docs, f.replace('.png', '.webp'))
        img.save(out, 'WEBP', quality=80)
        print(f'QA: game/docs/{f.replace(".png", ".webp")} {os.path.getsize(out)//1024} KB')
print('DONE')

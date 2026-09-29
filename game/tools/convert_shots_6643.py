#!/usr/bin/env python3
# convert_shots_6643.py — ПАТЧ 66.43: PNG-кадры съёмщика → webp q85 в
# assets/screenshots/ (тот же формат карточек лендинга, что и прежде).
import os
from PIL import Image

SRC = '/tmp/shots6643'
DST = '/home/z/my-project/sosnowda.github.io/assets/screenshots'

NAMES = ['01-title', '02-character-select', '03-character-custom', '04-village',
         '05-map', '06-elder-interior', '07-priest-dialogue', '08-combat',
         '09-thief-encounter']

def main():
    for n in NAMES:
        src = os.path.join(SRC, n + '.png')
        dst = os.path.join(DST, n + '.webp')
        if not os.path.exists(src):
            print('НЕТ', src)
            continue
        im = Image.open(src).convert('RGBA')
        im.save(dst, 'WEBP', quality=85)
        old = os.path.getsize(dst)
        print('OK', n + '.webp', f'{old//1024} КБ')

if __name__ == '__main__':
    main()

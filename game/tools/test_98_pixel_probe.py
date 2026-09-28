#!/usr/bin/env python3
# test_98_pixel_probe.py — пиксельные проверки текстур для test_round98.mjs
# (Python+PIL надёжен для любых фильтров PNG; Node-декодер в r94 покрывает
# только палитровые фильтр-0 файлы). Печатает JSON.
import json
import sys

from PIL import Image

REPO = '/home/z/my-project/sosnowda.github.io'


def opaque_in(path, x0, y0, x1, y1, thr=40):
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').load()
    n = 0
    for y in range(y0, min(y1, im.height)):
        for x in range(x0, min(x1, im.width)):
            if a[x, y] > thr:
                n += 1
    return n


out = {
    'log_flowers_pipe': opaque_in(f'{REPO}/game/assets/sprites/fb_log_flowers.png', 136, 0, 165, 70),
    'tudor_sm_pipe': opaque_in(f'{REPO}/game/assets/sprites/fb_tudor_sm.png', 86, 4, 128, 100),
}
print(json.dumps(out))

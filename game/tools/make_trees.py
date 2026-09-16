#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Раунд 30: PIL-генерация деревьев (лиственные x3, ели x2) с ПРОЗРАЧНЫМ фоном.
Фикс: runtime-генерация deco_tree_* в BootScene давала ПУСТЫЕ текстуры
(деревья не видны ни в лесу, ни на опушке, ни в деревне с раунда 27).
Теперь деревья — файловые ассеты assets/sprites/, как остальные тайлы.
Размер как в исходных runtime-текстурах (56x72 / 44x76) — масштабы сцен не меняются.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sprites")
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)


def hexc(h):
    return (h >> 16 & 255, h >> 8 & 255, h & 255, 255)


def deciduous(path, under, mid, top, hi):
    """Лиственное дерево 112x144: ствол + 3 слоя кроны (эллипсы)."""
    W, H = 56, 72
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Ствол (сужается вверх) + корневая подушка
    d.polygon([(26, 70), (30, 70), (28.5, 38), (27.5, 38)], fill=hexc(0x4a3018))
    d.rectangle([26, 66, 32, 70], fill=hexc(0x4a3018))
    d.rectangle([29, 42, 30.5, 66], fill=hexc(0x5a4028))          # блик ствола
    # Ветви
    d.rectangle([18, 44, 28, 46], fill=hexc(0x4a3018))
    d.rectangle([30, 40, 40, 42], fill=hexc(0x4a3018))
    # Крона: нижний тёмный слой
    d.ellipse([5, 23, 51, 48], fill=hexc(under))
    d.ellipse([1, 31, 23, 49], fill=hexc(under))
    d.ellipse([33, 31, 55, 49], fill=hexc(under))
    # Средний слой
    d.ellipse([8, 14, 48, 37], fill=hexc(mid))
    d.ellipse([6, 25, 26, 40], fill=hexc(mid))
    d.ellipse([30, 24, 50, 39], fill=hexc(mid))
    # Верхний слой
    d.ellipse([12, 6, 44, 26], fill=hexc(top))
    d.ellipse([9, 13, 27, 24], fill=hexc(top))
    # Макушка и блики
    d.ellipse([17, 3, 36, 15], fill=hexc(hi))
    d.ellipse([22, 7, 29, 12], fill=hexc(hi))
    d.ellipse([12, 20, 19, 25], fill=hexc(hi))
    img.save(os.path.join(OUT, path))


def pine(path, a, b, c):
    """Ель 88x152: треугольные ярусы + ствол."""
    W, H = 44, 76
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 66, 25, 75], fill=hexc(0x4a3018))            # ствол
    d.rectangle([22.5, 66, 23.5, 75], fill=hexc(0x5a4028))        # блик
    # Ярусы снизу вверх
    d.polygon([(2, 68), (42, 68), (22, 44)], fill=hexc(a))
    d.polygon([(6, 52), (38, 52), (22, 30)], fill=hexc(b))
    d.polygon([(10, 37), (34, 37), (22, 16)], fill=hexc(c))
    d.polygon([(14, 24), (30, 24), (22, 6)], fill=hexc(0x3f6b2f))
    d.rectangle([21, 8, 23, 12], fill=hexc(0x4d7d3a))             # блик макушки
    img.save(os.path.join(OUT, path))


deciduous("tree_0.png", 0x24471f, 0x2f5a27, 0x3f6b2f, 0x4d7d3a)
deciduous("tree_1.png", 0x1f3d2a, 0x2a4f30, 0x356038, 0x436f42)
deciduous("tree_2.png", 0x3a5a22, 0x4a6b2c, 0x5a7d38, 0x6b8f46)
pine("pine_0.png", 0x1a331c, 0x24471f, 0x2f5a27)
pine("pine_1.png", 0x20401f, 0x2a5228, 0x35602e)

print("OK: 5 деревьев записано в", OUT)

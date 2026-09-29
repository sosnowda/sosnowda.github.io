#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.44 (приказ 13): УДАЛЕНИЕ СВЕЧИ из портрета воровки.

portrait_thief_f.webp (1024×1024): в правом нижнем углу — свеча на подсвечнике
(≈ x 830..1024, y 560..1024). Донор заплатки — ЧИСТАЯ СТЕНА над зоной свечи
(тот же столбец x, y 60..556): непрерывность текстуры дерева по вертикали,
затемнённая под градиент угла. Швы (левый/верхний) — мягкая альфа-маска.
Запуск: python3 game/tools/portrait_thief_f_6644.py
"""

from PIL import Image, ImageFilter

SRC = 'game/assets/sprites/portraits/portrait_thief_f.webp'

# Зона свечи (с запасом до краёв холста)
CX0, CY0, CX1, CY1 = 820, 548, 1024, 1024
# Донор: та же ширина, чистая стена над свечой (правее капюшона!)
DX0, DY0, DX1, DY1 = CX0, 44, CX1, 44 + (CY1 - CY0)


def main():
    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    assert (w, h) == (1024, 1024), f'неожиданный размер: {w}×{h}'

    cw, ch = CX1 - CX0, CY1 - CY0
    donor = im.crop((DX0, DY0, DX1, DY1))
    assert donor.size == (cw, ch)

    # Донор чуть светлее низа сцены — добавим вертикальное затемнение к низу,
    # чтобы заплатка легла в общий градиент угла.
    dpx = donor.load()
    for y in range(ch):
        k = 1.0 - 0.16 * (y / ch)
        for x in range(cw):
            r, g, b = dpx[x, y]
            dpx[x, y] = (int(r * k), int(g * k), int(b * k))

    # альфа-маска: мягкие ЛЕВЫЙ и ВЕРХНИЙ швы (правый/нижний — края холста)
    mask = Image.new('L', (cw, ch), 255)
    mpx = mask.load()
    feather = 36
    for y in range(ch):
        for x in range(cw):
            d = min(x, y)
            if d < feather:
                mpx[x, y] = int(255 * (d / feather) ** 0.8)
    mask = mask.filter(ImageFilter.GaussianBlur(6))

    im.paste(donor, (CX0, CY0), mask)

    im.save(SRC, 'WEBP', quality=88)
    print('портрет перезаписан без свечи')

    prev = im.copy()
    prev.thumbnail((640, 640))
    prev.save('/tmp/insp/portrait_thief_f_clean.png')
    # увеличенный фрагмент бывшей свечи — контроль швов
    frag = im.crop((700, 420, 1024, 1024))
    frag.save('/tmp/insp/portrait_thief_f_frag.png')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# make_chimneys_6637.py — ПАТЧ 66.37 (приказ владельца): ВЕРНУТЬ ДЫМ АВДЕЮ/ПРАСКОВЬЕ.
#
# Диагноз: в паке «Fantastic Buildings - Medieval» у фасадов fb_log_thatch
# (Авдей/плотник) и fb_thatch_big (Прасковья/Степан) труб НЕТ — в 66.36 дым
# у них был убран («трубы в паке нет — не дымят», см. housesFX.js).
#
# Решение: дорисовать трубы В СТИЛЕ ПАКА — взять аутентичные каменные трубы
# из самих листов пака (доноры) и посадить их на кровли:
#   fb_log_thatch  ← труба fb_manor  (каменная с колпаком, тесовая кровля)
#   fb_thatch_big  ← труба fb_thatch_small (каменная на соломенной кровле —
#                    тот же кровельный материал, что у fb_thatch_big)
# Тело трубы при посадке удлиняется тесселяцией нижнего ряда камней донора,
# низ утапливается в кровлю (по手法 66.35 «каменные козырьки труб»).
#
# Скрипт ИДЕМПОТЕНТЕН: оригиналы 66.36 сохраняются в tools/fb_originals_6637/,
# повторный запуск берёт трубы из оригиналов, а не из уже дополненных файлов.
import os
import shutil
from PIL import Image

REPO = '/home/z/my-project/repo/game'
SPR = os.path.join(REPO, 'assets', 'sprites')
ORIG_DIR = os.path.join(REPO, 'tools', 'fb_originals_6637')

# ---------- доноры (границы сняты попиксельной классификацией:
# S = серый камень, Y = жёлтая кровля, . = прозрачь) ----------
# fb_manor: труба x10..48, y0..30 — колпак+жерло+2 ряда камней, правее x48 — кровля
MANOR = dict(box=(10, 0, 48, 30), mouth=(28, 8), body_band=(16, 26))
# fb_thatch_small: труба x159..188, y0..40 — колпак y1..12, жерло y13..26, камни ниже
SMALL = dict(box=(159, 0, 188, 40), mouth=(19, 20), body_band=(28, 38))


def load_orig(name):
    """Оригинал 66.36 (без труб): из fb_originals_6637 или текущий ассет."""
    orig = os.path.join(ORIG_DIR, name + '.png')
    if os.path.exists(orig):
        return Image.open(orig).convert('RGBA')
    src = os.path.join(SPR, name + '.png')
    os.makedirs(ORIG_DIR, exist_ok=True)
    im = Image.open(src).convert('RGBA')
    im.save(orig)
    return im


def extract_chimney(donor_name, box):
    """Вырезать трубу донора (зона снята по классификации камень/кровля)."""
    im = Image.open(os.path.join(SPR, donor_name + '.png')).convert('RGBA')
    return im.crop(box)


def extend_body(ch, band, total_h):
    """Удлинить тело трубы до total_h, тесселируя ряд камней band=(y0,y1)."""
    w, h = ch.size
    y0, y1 = band
    out = Image.new('RGBA', (w, total_h), (0, 0, 0, 0))
    out.paste(ch, (0, 0))
    band_img = ch.crop((0, y0, w, y1))
    bh = y1 - y0
    y = h
    i = 0
    while y < total_h:
        out.paste(band_img, (0, y))
        y += bh
        i += 1
    return out


def paste_chimney(target, ch, x0, y0, mouth):
    """Посадить трубу на кровлю. Возвращает (cx, cy) жерла в координатах цели."""
    target.alpha_composite(ch, (x0, y0))
    return (x0 + mouth[0], y0 + mouth[1])


def main():
    report = {}
    # ---------- 1. fb_log_thatch ← труба fb_manor ----------
    base = load_orig('fb_log_thatch')
    ch = extract_chimney('fb_manor', MANOR['box'])           # 38×30
    ch = extend_body(ch, MANOR['body_band'], 52)             # тело удлинено до 52
    img = base.copy()
    # конёк тесовой кровли у x~135 на y~10..14; топ трубы y=2, тело до y=54 (в скате)
    cx, cy = paste_chimney(img, ch, 116, 2, MANOR['mouth'])
    img.save(os.path.join(SPR, 'fb_log_thatch.png'))
    report['fb_log_thatch'] = dict(chimney_size=ch.size, mouth=(cx, cy))

    # ---------- 2. fb_thatch_big ← труба fb_thatch_small ----------
    base = load_orig('fb_thatch_big')
    ch = extract_chimney('fb_thatch_small', SMALL['box'])    # 29×40
    ch = extend_body(ch, SMALL['body_band'], 64)             # тело удлинено до 64
    img = base.copy()
    # между слуховками (свободная зона x145..202, конёк y~40): топ y=14, тело до y=78
    cx, cy = paste_chimney(img, ch, 159, 14, SMALL['mouth'])
    img.save(os.path.join(SPR, 'fb_thatch_big.png'))
    report['fb_thatch_big'] = dict(chimney_size=ch.size, mouth=(cx, cy))

    for k, v in report.items():
        print(k, '->', v)


if __name__ == '__main__':
    main()

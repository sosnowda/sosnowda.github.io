#!/usr/bin/env python3
# make_chimneys_6642.py — ПАТЧ 66.42 (приказ 3 владельца): «НЕ У ВСЕХ ДОМОВ
# ДЕРЕВНИ ЕСТЬ ПЕЧНЫЕ ТРУБЫ, ДОБАВИТЬ!»
#
# Диагноз (живой аудит 18 домов, qa_chimneys_6642.mjs): у 14 домов трубы
# читаются ясно; у ТРЁХ труба есть, но на игровом масштабе НЕ ЧИТАЕТСЯ:
#   fb_log_flowers (гончар)  — чёрная «труба-фонарь» 13×25px — выглядит
#                              обломком бревна, не трубой;
#   fb_tudor_sm   (знахарка/ремесленник) — металлический дымник-«фонарик»
#                              15×33px — крошечный, не читается как труба.
# Решение — в手法 утверждённого владельцем 66.37 (make_chimneys_6637.py):
# аутентичные каменные трубы ИЗ САМИХ ЛИСТОВ ПАКА (доноры) сажаются на
# кровлю, тело удлиняется тесселяцией ряда камней, низ утапливается в скат:
#   fb_log_flowers ← труба fb_manor (каменная с колпаком; кровля тоже
#                    бревенчатая) — скат правее фронтона, топ y=0.
#   fb_tudor_sm   ← труба fb_tudor_fl (каменная с колпаком, ТА ЖЕ серо-
#                    коричневая гонтина) — на конёк; чёрный «фонарик» стёрт
#                    клон-заплаткой гонтины со сдвигом по скату.
# Уроки 66.37 учтены (там тесселировался ряд с жерлом — труба Авдея получила
# повторяющиеся тёмные пазы): здесь тесселируется ТОЛЬКО ЧИСТЫЙ РЯД КАМНЕЙ,
# и тело уже колпака — боковые колонки кровли донора в кроп маскируются.
# «Труба-фонарь» гончара СОХРАНЕНА (легитимная деталь пака, см. АГЕНТ.md) —
# у гончара теперь ДВЕ дымовые точки (фонарь + каменная труба).
#
# Скрипт ИДЕМПОТЕНТЕН: оригиналы 66.41 сохраняются в tools/fb_originals_6642/,
# повторный запуск берёт трубы из оригиналов, а не из дополненных файлов.
import os

from PIL import Image
import numpy as np

REPO = '/home/z/my-project/sosnowda.github.io'
SPR = os.path.join(REPO, 'game', 'assets', 'sprites')
ORIG = os.path.join(REPO, 'game', 'tools', 'fb_originals_6642')


def load_orig(name):
    """Оригинал 66.41 (до труб): из fb_originals_6642 или текущий ассет."""
    p = os.path.join(ORIG, name + '.png')
    if os.path.exists(p):
        return Image.open(p).convert('RGBA')
    os.makedirs(ORIG, exist_ok=True)
    im = Image.open(os.path.join(SPR, name + '.png')).convert('RGBA')
    im.save(p)
    return im


def build_chimney(donor_png, box, cap_h, body_x, band_y, total_h, mouth):
    """Собрать трубу из донора:
    box     — кроп донора (x0,y0,x1,y1);
    cap_h   — высота колпака (строки 0..cap_h идут на всю ширину кропа);
    body_x  — (bx0,bx1) столбцы ТЕЛА в координатах кропа (ниже колпака);
    band_y  — (y0,y1) ЧИСТЫЙ ряд камней для тесселяции (в координатах кропа);
    total_h — итоговая высота трубы;
    mouth   — жерло в координатах кропа."""
    src = Image.open(donor_png).convert('RGBA').crop(box)
    w, h = src.size
    bx0, bx1 = body_x
    out = Image.new('RGBA', (w, total_h), (0, 0, 0, 0))
    # колпак (полная ширина)
    out.paste(src.crop((0, 0, w, cap_h)), (0, 0))
    # тело донора (только столбцы тела)
    out.paste(src.crop((bx0, cap_h, bx1, h)), (bx0, cap_h))
    # тесселяция чистого ряда камней — тоже только столбцы тела
    band_img = src.crop((bx0, band_y[0], bx1, band_y[1]))
    bh = band_y[1] - band_y[0]
    y = h
    while y < total_h:
        out.paste(band_img, (bx0, y))
        y += bh
    return out, mouth


def clone_fill(img, src_box, dst_xy):
    """Клон-заплатка ската: кусок src_box кладётся в dst_xy (сдвиг по скату
    зашит в выборе src_box). Прозрачность источника сохраняется."""
    patch = img.crop(src_box)
    img.alpha_composite(patch, dst_xy)
    return img


def main():
    report = {}

    # ---------- 1. fb_log_flowers ← труба fb_thatch_small ----------
    # Донор: тот же, что дал ЧИСТУЮ трубу Прасковье в 66.37 — кроп
    # (159,0,188,40); колпак с жерлом y0..20, тёмная губа y20..28, чистые
    # светлые камни y28..35 (0 тёмных пикселей — проверено построчно).
    # У fb_manor тело в тени (ряды 25-29 тёмные) — тесселяция даёт полосы.
    # Труба 29×70, топ y=0, тело уходит в скат.
    base = load_orig('fb_log_flowers')
    ch, mouth_local = build_chimney(
        os.path.join(SPR, 'fb_thatch_small.png'), (159, 0, 188, 40),
        cap_h=20, body_x=(0, 29), band_y=(28, 35), total_h=70, mouth=(14, 13))
    img = base.copy()
    # скат правее фронтона; нажладка-брус на скате начинается с x≈170 —
    # труба x136..165 её не задевает; тело до y=70 утоплено в скат.
    img.alpha_composite(ch, (136, 0))
    mouth = (136 + mouth_local[0], 0 + mouth_local[1])
    img.save(os.path.join(SPR, 'fb_log_flowers.png'))
    report['fb_log_flowers'] = dict(chimney=ch.size, paste=(136, 0), mouth=mouth)

    # ---------- 2. fb_tudor_sm ← труба fb_tudor_fl ----------
    # Донор: кроп (22,0,64,58); колпак y0..26 (полная ширина), камни y26..58
    # (столбцы тела x3..38), чистый ряд y32..46. Труба 42×96, топ y=4.
    base = load_orig('fb_tudor_sm')
    ch, mouth_local = build_chimney(
        os.path.join(SPR, 'fb_tudor_fl.png'), (22, 0, 64, 58),
        cap_h=26, body_x=(3, 38), band_y=(32, 46), total_h=96, mouth=(19, 13))
    img = base.copy()
    # 2а. стереть чёрный «фонарик» (x116..133, y20..48): клон-заплатка
    # чистой гонты (x96..113, y4..32) со сдвигом по скату (+20,+16).
    img = clone_fill(img, (96, 4, 113, 32), (116, 20))
    # 2б. труба на конёк: кап x86..128, тело до y=100 (в скате).
    img.alpha_composite(ch, (86, 4))
    mouth = (86 + mouth_local[0], 4 + mouth_local[1])
    img.save(os.path.join(SPR, 'fb_tudor_sm.png'))
    report['fb_tudor_sm'] = dict(chimney=ch.size, paste=(86, 4), mouth=mouth)

    for k, v in report.items():
        print(k, '->', v)


if __name__ == '__main__':
    main()

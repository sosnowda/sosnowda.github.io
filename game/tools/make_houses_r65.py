#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РАУНД 65 — дома деревни из пакета «Fantastic Buildings - Medieval» (Celianna).

П.10 прежнего приказа (вариант Б): готовые деревянные дома владельца
заменяют процедурные hp_* — вырезаем цельные здания из тайлсетов пакета:
  Rural_TileD  — деревянная церковь с звонницей, беленые избы под соломой;
  Rural_TileE  — большой постоялый двор (2 этажа — только ему разрешено);
  Rural_TileC/B— бревенчатые избы;
  City_TileB   — каменная кузница с горном, фахверковые дома.

Так же (пп.7,8 приказа раунда 65):
  village_gate_r65 — воротня В ПРОФИЛЬ (проёмом на восток, к выходу),
                     компактная (88x116 вместо 156x184);
  assets/tiles/palisade_0.png — тайл ЧАСТОКОЛА (48x48, заострённые брёвна).

Выход: assets/sprites/fb_*.png (12 зданий), village_gate_r65.png,
       assets/tiles/palisade_0.png
Лицензия пакета: EULA Celianna/KOMODO (RPG Maker); пакета предоставлен
владельцем игры; в кредитах игры добавляется «[Copyright](C) Celianna».
"""
from PIL import Image, ImageDraw
import os

PACK = '/home/z/fb_pack/extracted/Fantastic Buildings - Medieval/mv-fantastic-buildings-medieval/Tilesets'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES = os.path.join(ROOT, 'assets', 'sprites')
TILES = os.path.join(ROOT, 'assets', 'tiles')
os.makedirs(SPRITES, exist_ok=True)
os.makedirs(TILES, exist_ok=True)

# (лист, имя, x0, y0, x1, y1, [erase-прямоугольники в абс. координатах листа])
BUILDINGS = [
    # Храм: деревянная церковь с звонницей и колоколом
    ('Rural_TileD', 'fb_church',      0,   0, 270, 304, []),
    # Постоялый двор: большой гостьевой двор (2 этажа — единственный)
    ('Rural_TileE', 'fb_inn',       356,   0, 768, 285, []),
    # Кузница: каменный корпус с горном и трубой
    ('City_TileB',  'fb_smithy',    434,  85, 576, 392, []),
    # Дом старосты: широкий гостиный дом под соломой
    ('Rural_TileE', 'fb_elder',       0,   0, 358, 254, []),
    # Состоячный дом «на горке» (соломенная кровля с слуховым окном)
    ('Rural_TileD', 'fb_manor',     372,  32, 572, 220, []),
    # Большая белёная изба с красными окнами (сосед снизу стёрт)
    ('Rural_TileD', 'fb_thatch_big',396, 232, 726, 478, [(394, 374, 413, 434)]),
    # Малая изба под соломой
    ('Rural_TileD', 'fb_thatch_small', 398, 530, 552, 730, []),
    # Бревенчатая изба с цветниками под окнами (лестница на кровле сохранена)
    ('Rural_TileC', 'fb_log_flowers', 374, 216, 604, 444, [(578, 394, 604, 444)]),
    # Бревенчатая изба с тесовой двускатной кровлей
    ('Rural_TileC', 'fb_log_thatch', 398, 442, 584, 622, []),
    # Большая изба с крутым кровом и трубой
    ('Rural_TileB', 'fb_log_big',   532, 384, 768, 730, []),
    # Фахверковый дом с красными цветниками
    ('City_TileB',  'fb_tudor_fl',  145,   0, 382, 235, []),
    # Узкий фахверковый дом (ремесленник): высокий узкий кров до самой стены
    ('City_TileB',  'fb_tudor_sm',    0,  36, 130, 318, []),
]

def extract():
    made = []
    for sheet, name, x0, y0, x1, y1, erases in BUILDINGS:
        im = Image.open(os.path.join(PACK, sheet + '.png')).convert('RGBA')
        crop = im.crop((x0, y0, x1, y1))
        for ex0, ey0, ex1, ey1 in erases:
            # стереть чужие фрагменты (прозрачно)
            r = Image.new('RGBA', (ex1 - ex0, ey1 - ey0), (0, 0, 0, 0))
            crop.paste(r, (ex0 - x0, ey0 - y0))
        bbox = crop.getbbox()
        t = crop.crop(bbox)
        t.save(os.path.join(SPRITES, name + '.png'))
        made.append((name, t.size))
        print('OK', name, t.size)
    return made

# ---------------------------------------------------------------- воротня
def make_gate(name='village_gate_r65'):
    """РАУНД 65 (п.7): воротня В ПРОФИЛЬ — проёмом В СТОРОНУ ВЫХОДА (восток).
    Компактная: 104x118 (прежде 156x184). Вид с юго-запада: ближний (южный)
    столб крупный слева-снизу на каменном основании, дальний (северный) —
    меньше справа-сверху под двускатной кровелькой; между вершинами натянута
    верёвка с вымпелами и подвесной доской-подковой; у ближнего столба —
    фонарь. Проезд между столбами прозрачен: дорога уходит на восток."""
    W, H = 104, 118
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)

    def log_post(x0, y0, x1, y1, light=(104, 76, 46), dark=(44, 30, 14), fiber=(86, 62, 36)):
        d.rectangle([x0, y0, x1, y1], fill=light + (255,), outline=dark + (255,))
        for px in range(x0 + 3, x1 - 1, 4):
            d.line([px, y0 + 2, px, y1 - 1], fill=fiber + (150,))
        d.line([x0 + 2, y0 + 2, x0 + 2, y1 - 1], fill=(134, 102, 62, 190))

    def stone_base(x0, y0, x1, y1):
        d.rectangle([x0, y0, x1, y1], fill=(74, 68, 60, 255), outline=(48, 42, 36, 255))
        for yy in range(y0 + 3, y1, 5):
            d.line([x0 + 1, yy, x1 - 1, yy], fill=(96, 90, 82, 160))
        for xx in range(x0 + 4, x1, 7):
            d.line([xx, y0 + 1, xx, y1 - 1], fill=(58, 52, 46, 140))

    # --- ближний (южный) столб: крупный, слева-снизу ---
    log_post(26, 46, 50, 104)
    stone_base(23, 100, 53, 114)
    # резной наконечник столба (силуэт «копья»)
    d.polygon([(26, 46), (50, 46), (44, 32), (38, 32), (32, 40)], fill=(96, 70, 42, 255),
              outline=(44, 30, 14, 255))
    # --- дальний (северный) столб: тоньше, справа-сверху ---
    log_post(64, 18, 82, 60, light=(92, 66, 40), fiber=(76, 54, 32))
    # кровелька над ним
    d.polygon([(58, 18), (88, 18), (73, 2)], fill=(196, 158, 74, 255),
              outline=(104, 76, 32, 255))
    d.polygon([(58, 18), (73, 2), (73, 18)], fill=(176, 138, 62, 255))
    d.rectangle([71, 0, 75, 6], fill=(94, 68, 38, 255))
    # --- верёвка между столбами (провис) ---
    rope = []
    for i in range(0, 41):
        tt = i / 40
        x = 38 + tt * (73 - 38)
        y = 34 + tt * (22 - 34) + 6 * (4 * tt * (1 - tt))  # провис
        rope.append((x, y))
    d.line(rope, fill=(64, 44, 24, 255), width=2)
    # вымпелы на верёвке
    d.polygon([(44, 33), (44, 44), (36, 38)], fill=(150, 44, 32, 255), outline=(70, 24, 16, 255))
    d.polygon([(60, 29), (60, 40), (68, 34)], fill=(150, 44, 32, 255), outline=(70, 24, 16, 255))
    # --- подвесная доска-подкова на верёвке ---
    d.line([(50, 36), (50, 44)], fill=(64, 44, 24, 255), width=2)
    d.line([(58, 37), (58, 44)], fill=(64, 44, 24, 255), width=2)
    d.rectangle([46, 44, 62, 58], fill=(140, 108, 62, 255), outline=(56, 38, 18, 255))
    d.arc([49, 46, 59, 56], 180, 360, fill=(196, 164, 84, 255), width=3)
    # --- фонарь на кронштейне ближнего столба (ниже доски, восточнее) ---
    d.line([50, 72, 64, 72], fill=(40, 26, 12, 255), width=3)
    d.line([62, 72, 62, 78], fill=(40, 26, 12, 255), width=2)
    d.rectangle([58, 78, 66, 90], fill=(255, 202, 98, 235), outline=(40, 26, 12, 255))
    d.line([60, 79, 60, 89], fill=(255, 236, 170, 160))
    for r, a in ((6, 55), (10, 26), (13, 10)):
        d.ellipse([62 - r, 84 - r, 62 + r, 84 + r], fill=(255, 176, 80, a))
    # --- лёгкая тень у основания ближнего столба ---
    d.ellipse([20, 108, 56, 118], fill=(0, 0, 0, 55))
    c.save(os.path.join(SPRITES, name + '.png'))
    print('OK', name, c.size)

# ---------------------------------------------------------------- частокол
def make_palisade(name='palisade_0'):
    """РАУНД 65 (п.8): тайл ЧАСТОКОЛА 48x48 — заострённые вертикальные
    брёвна в два ряда, стыкуется по всем четырём сторонам (кольцо вокруг
    деревни). Прорисован под стиль земли игры (тёплое дерево, тёмные швы)."""
    TS = 48
    c = Image.new('RGBA', (TS, TS), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    import random
    rnd = random.Random(6501)
    # дальний ряд брёвен (темнее, виден в щелях между передними)
    for i in range(4):
        x = 2 + i * 12
        top = 6 + rnd.randint(0, 4)
        d.polygon([(x, top), (x + 9, top), (x + 4, top - 7)], fill=(64, 46, 28, 255))
        d.rectangle([x, top, x + 9, TS], fill=(64, 46, 28, 255), outline=(36, 24, 12, 255))
    # передний ряд: ТРИ заострённых бревна (по 16px)
    for i in range(3):
        x = i * 16
        top = rnd.randint(0, 3)
        d.polygon([(x, top), (x + 15, top), (x + 7, top - 10)], fill=(112, 84, 52, 255),
                  outline=(44, 30, 14, 255))
        d.rectangle([x, top, x + 15, TS], fill=(104, 76, 46, 255), outline=(44, 30, 14, 255))
        # волокна + блик слева
        for px in range(x + 3, x + 15, 3):
            d.line([px, top + 5, px, TS], fill=(86, 62, 36, 140))
        d.line([x + 2, top + 4, x + 2, TS], fill=(134, 102, 62, 200))
        d.line([x + 4, top - 2, x + 10, top - 2], fill=(150, 116, 72, 160))
        # сучок
        kx, ky = x + 4 + rnd.randint(0, 7), top + 16 + rnd.randint(0, 22)
        d.ellipse([kx, ky, kx + 3, ky + 3], fill=(70, 50, 30, 255))
    # горизонтальная обвязка (тын связан поперечиной) — две жерди
    d.rectangle([0, 26, TS - 1, 30], fill=(78, 56, 34, 210))
    d.line([0, 26, TS - 1, 26], fill=(48, 34, 18, 230))
    d.rectangle([0, 38, TS - 1, 41], fill=(72, 52, 32, 190))
    c.save(os.path.join(TILES, name + '.png'))
    print('OK', name, c.size)

if __name__ == '__main__':
    extract()
    make_gate()
    make_palisade()

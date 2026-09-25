#!/usr/bin/env python3
# Раунд 66.25 (приказ 3): НОВАЯ ВОРОТНЯ village_gate_r67 — «ворота створом
# поперёк дороги». Прежняя village_gate_r66 (профиль r65) выглядела сломанной:
# узкая башня стояла ПРЯМО на проезде, второй столб читался случайной
# «лавкой-палаткой», вместо створок — чёрный блоб. Теперь:
#   - ворота стоят ПОПЕРЁК дороги (створ север-юг): СЕВЕРНАЯ башня над дорогой,
#     ЮЖНАЯ под дорогой, между ними — проезд (ряд ворот 'G');
#   - башни — в стиле частокола (частокол подходит к воротам с севера и юга);
#   - над проездом — дубовая поперечина с подвесным ФОНАРЁМ (тёплое стекло);
#   - створки РАСКРЫТЫ к деревне (запад) — две доски-полотна на петлях;
#   - проезд ПОЛНОСТЬЮ прозрачен — песчаная дорога видна насквозь.
# Два PNG (рисуются в мировых пикселях 1:1, тайл 48):
#   village_gate_r67_north.png 48×96  — северная башня (глубина 4.45, за игроком)
#   village_gate_r67_south.png 96×148 — поперечина+фонарь+створки+южная башня
#                                       (глубина 7.45, перед игроком)
# Геометрия (ts=48, дорога ряд 5: y 240..288, колонка ворот 'G' x 1200..1248):
#   ЛИНИЯ ВОРОТ смещена к восточному краю: башни x 1214..1256 (центр 1236) —
#   тогда восточный дом мясника (23,6; фасад до x 1204) не касается башен.
#   north: x 1212..1260 (якорь (1236,240), origin 0.5/1)
#   south: x 1176..1272 (якорь (1224,216), origin 0.5/0; створки уходят на запад)
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')

# Палитра частокола (снята с assets/tiles/palisade_0.png)
LOG      = (116, 88, 54, 255)    # основное бревно
LOG_HI   = (146, 114, 70, 255)   # светлая грань
LOG_DK   = (88, 64, 38, 255)     # тень бревна
OUTLINE  = (42, 28, 12, 255)     # контур
TIP_DK   = (66, 46, 28, 255)     # конус острия
STONE    = (122, 122, 112, 255)
STONE_DK = (92, 92, 84, 255)
STONE_HI = (150, 150, 138, 255)
IRON     = (58, 58, 62, 255)
IRON_HI  = (96, 96, 104, 255)
GLASS    = (255, 200, 115, 255)
FLAME    = (255, 154, 60, 255)
FLAME_HI = (255, 224, 150, 255)

# Линия ворот: башни x 1214..1256 (3 бревна по 14px)
TOWER_X0, TOWER_X1 = 1214, 1256


def px(d, x, y, w, h, col):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col)


def log_column(d, x, w, y_top, y_bot, tip_h):
    """Одно бревно с остриём (как тайл частокола): конус сверху, тело ниже."""
    body_top = y_top + tip_h
    steps = max(1, tip_h)
    for i in range(steps):
        t = i / steps
        half = max(1, int(w / 2 * (0.35 + 0.65 * t)))
        cx = x + w // 2
        col = TIP_DK if i < 2 else (LOG_DK if i < steps - 2 else LOG)
        d.rectangle([cx - half, y_top + i, cx + half - 1, y_top + i], fill=col)
    px(d, x, body_top, w, y_bot - body_top, LOG)
    px(d, x + 1, body_top, 2, y_bot - body_top, LOG_HI)
    px(d, x + w - 3, body_top, 2, y_bot - body_top, LOG_DK)
    for yy in range(body_top + 6, y_bot - 3, 14):
        px(d, x, yy, w, 1, OUTLINE)
    d.rectangle([x, y_top, x + w - 1, y_bot - 1], outline=OUTLINE)


def stone_base(d, x, y, w, h):
    px(d, x, y, w, h, STONE)
    px(d, x, y, w, 1, STONE_HI)
    px(d, x, y + h - 2, w, 2, STONE_DK)
    for sx in range(x + 3, x + w - 3, 9):
        d.line([sx, y + 2, sx - 2, y + h - 3], fill=STONE_DK)
    d.rectangle([x, y, x + w - 1, y + h - 1], outline=OUTLINE)


def tower_logs(d, ox, y_top, y_bot, tip_h):
    """Три бревна башни в колонке TOWER_X0..TOWER_X1 со смещением текстуры ox."""
    lw = (TOWER_X1 - TOWER_X0) // 3
    for i in range(3):
        log_column(d, TOWER_X0 + i * lw - ox, lw, y_top, y_bot, tip_h)


def make_north():
    """Северная башня 48×96: мир x 1212..1260, y 144..240."""
    W, H = 48, 96
    ox = 1212
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tower_logs(d, ox, 2, 76, 22)
    # поперечный брус-воротило поверх брёвен
    px(d, TOWER_X0 - 2 - ox, 30, TOWER_X1 - TOWER_X0 + 4, 6, LOG_DK)
    px(d, TOWER_X0 - 2 - ox, 30, TOWER_X1 - TOWER_X0 + 4, 2, LOG_HI)
    d.rectangle([TOWER_X0 - 2 - ox, 30, TOWER_X1 + 1 - ox, 35], outline=OUTLINE)
    # каменное основание
    stone_base(d, TOWER_X0 - 1 - ox, 76, TOWER_X1 - TOWER_X0 + 2, 19)
    im.save(os.path.join(OUT, 'village_gate_r67_north.png'))
    print('village_gate_r67_north.png', im.size)


def thick_line(d, x0, y0, x1, y1, w, col):
    """Жирная линия-доска (створка) с контуром."""
    steps = max(abs(x1 - x0), abs(y1 - y0)) + 1
    for i in range(steps):
        t = i / (steps - 1)
        cx = x0 + (x1 - x0) * t
        cy = y0 + (y1 - y0) * t
        d.rectangle([int(cx - w // 2), int(cy - w // 2),
                     int(cx - w // 2) + w - 1, int(cy - w // 2) + w - 1],
                    fill=col, outline=OUTLINE)


def make_south():
    """Южная группа 96×148: мир x 1176..1272, y 216..364.
    Поперечина над дорогой (мировая y 220..236), фонарь (236..264),
    створки к западу, южная башня (288..364). Проезд прозрачен."""
    W, H = 96, 148
    ox, oy = 1176, 216
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # --- Поперечина (дубовый брус) над проездом: мир x 1208..1262, y 220..236
    bx0, by0 = 1208 - ox, 220 - oy
    px(d, bx0, by0, 54, 14, LOG_DK)
    px(d, bx0, by0 + 2, 54, 3, LOG_HI)
    px(d, bx0, by0 + 10, 54, 2, OUTLINE)
    d.rectangle([bx0, by0, bx0 + 53, by0 + 13], outline=OUTLINE)
    # кованые скобы на поперечине
    for sx in (bx0 + 4, bx0 + 46):
        px(d, sx, by0 + 3, 4, 8, IRON)

    # --- Фонарь под поперечиной: мир (1222..1238, 236..264)
    lx, ly = 1222 - ox, 236 - oy
    px(d, lx + 6, ly, 4, 4, IRON)                  # подвес
    d.rectangle([lx + 2, ly + 4, lx + 13, ly + 6], fill=IRON)     # крыша
    d.polygon([(lx + 2, ly + 6), (lx + 13, ly + 6), (lx + 8, ly + 2)], fill=IRON_HI)
    px(d, lx + 3, ly + 7, 10, 10, GLASS)           # стекло
    d.polygon([(lx + 8, ly + 9), (lx + 4, ly + 15), (lx + 12, ly + 15)], fill=FLAME)
    d.polygon([(lx + 8, ly + 11), (lx + 6, ly + 14), (lx + 10, ly + 14)], fill=FLAME_HI)
    px(d, lx + 2, ly + 17, 12, 2, IRON)            # донце
    px(d, lx + 3, ly + 19, 10, 2, OUTLINE)         # крюк-подставка

    # --- Створки раскрыты к деревне (запад): две доски на петлях
    # северная створка: петля у северной кромки проезда → на запад-юг
    thick_line(d, 1212 - ox, 246 - oy, 1180 - ox, 266 - oy, 8, LOG)
    # южная створка: петля у южной кромки → на запад-север
    thick_line(d, 1212 - ox, 282 - oy, 1180 - ox, 262 - oy, 8, LOG_DK)
    # поперечная скоба на створках
    px(d, 1196 - ox, 258 - oy, 6, 2, OUTLINE)

    # --- Южная башня: мир x 1214..1256, y 288..364
    tower_logs(d, ox, 288 - oy, 344 - oy, 18)
    stone_base(d, TOWER_X0 - 1 - ox, 344 - oy, TOWER_X1 - TOWER_X0 + 2, 19)
    # воротило поверх южной башни
    px(d, TOWER_X0 - 2 - ox, 310 - oy, TOWER_X1 - TOWER_X0 + 4, 6, LOG_DK)
    d.rectangle([TOWER_X0 - 2 - ox, 310 - oy, TOWER_X1 + 1 - ox, 315 - oy],
                outline=OUTLINE)

    im.save(os.path.join(OUT, 'village_gate_r67_south.png'))
    print('village_gate_r67_south.png', im.size)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make_north()
    make_south()

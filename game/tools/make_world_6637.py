#!/usr/bin/env python3

# ═══════════════ ИСТОРИЧЕСКИЙ КОНВЕЙЕР (помечено 66.41) ═══════════════
# заменён make_world_6638 (новая библиотека Drive, 66.38).
# НЕ запускать без необходимости: актуальные конвейеры — см. АУДИТ
# (АУДИТ_sosnowda_github_io_66.40.pdf, §5) и АГЕНТ.md.

# make_world_6637.py — ПАТЧ 66.37 (приказ владельца): НОВЫЕ АССЕТЫ ВНЕШНЕГО
# ВИДА ИГРОКА И НПЦ ИЗ ПАКОВ GOOGLE DRIVE («Medieval - Heroes I»,
# «Medieval - Townfolk», «Medieval - Town & Country», «Medieval - Warfare»).
#
# ДИАГНОЗ: в мире (деревня/интерьеры/локации) игрок и жители собирались из
# LPC-слоёв 64×64 (символ ~31px в кадре). В деревне ×1.125 это выглядело
# приемлемо, но в интерьерах ×2.5 лист растягивался в 2.5 раза — «отвратительно».
# 66.34 маскировал дефект LINEAR-фильтром, но пикселей в источнике не прибавилось.
#
# РЕШЕНИЕ: мировые спрайты пересобраны из ВЫСОКОРАЗРЕШЁНЫХ листов паков
# (кадры 128×128, фигура ~90px — втрое плотнее LPC):
#   игрок  : male → Baenor (Heroes I), female → Naia (Heroes I)
#   муж НПЦ: база TC_Male_1..3 + Top_1..9 + Pants_1..5 + Hair_1..6
#            + FacialHair_1..2 (25+) + Feet_1..3; стражник — Warfare_Male
#   жена НПЦ: база TC_Female_1..3 + Dress_1..5 + Hair_1..7 + Feet_1..2
#   дети   : TC_Child_1..4, Townfolk_Child_1..2 (готовые одетые)
#
# ГЕОМЕТРИЯ: каждая ячейка приводится к росту фигуры 88px (исходник ~90px,
# плотность пикселей сохраняется) с ногами на y=126 и центровкой по
# горизонтали. Масштабы сцен умножаются на WORLD_K = 31/88 ≈ 0.3523
# (systems/WorldLook.js) — фигуры на экране ровно прежнего размера:
# в деревне 26px, в интерьерах 78px из 88px ИСТОЧНИКА (даунскейл ×0.88 —
# гладкие фигуры вместо растяжения LPC ×2.5). Физтело: 24px → 68px кадра.
# Раскладка ВЫХОДА: 9 колонок × 4 строки @128 (кадры 0..35 row-major):
#   колонки 0..7 — ходьба (лист *_walking.png), колонка 8 — idle (*_idle1.png
#   кадр 0). Строки: 0=вниз, 1=влево, 2=вправо, 3=вверх (как у walking-листов).
import os
from PIL import Image

DRIVE = '/home/z/my-project/drive_assets/sheets'
OUT = '/home/z/my-project/repo/game/assets/sprites/world'
os.makedirs(OUT, exist_ok=True)

# классы нормализации: (f, dx, dy) — рост 88px, ноги на y=126, центр по X
CLASSES = {
    'male':   (88 / 90, 1, 10),
    'female': (88 / 84, -3, 3),
    'baenor': (88 / 94, 4, 13),
    'naia':   (88 / 88, 0, 6),
    'child':  (88 / 68, -19, -14),
}

# (выход, класс, исходник_без_суффикса) — walking/idle1 читаются по имени
SRC_PREFIX = 'Medieval_'
SHEETS = [
    # игрок
    ('world_hero_male',   'baenor', 'Baenor'),
    ('world_hero_female', 'naia',   'Naia'),
    # мужские базы и одежда
    *[(f'world_m_base{i}', 'male', f'TC_Male_{i}') for i in range(1, 4)],
    *[(f'world_m_top{i}',  'male', f'TC_Male_Top_{i}') for i in range(1, 10)],
    *[(f'world_m_pants{i}', 'male', f'TC_Male_Pants_{i}') for i in range(1, 6)],
    *[(f'world_m_hair{i}', 'male', f'TC_Male_Hair_{i}') for i in range(1, 7)],
    *[(f'world_m_beard{i}', 'male', f'TC_Male_FacialHair_{i}') for i in range(1, 3)],
    *[(f'world_m_feet{i}', 'male', f'TC_Male_Feet_{i}') for i in range(1, 4)],
    # стражник (Warfare)
    ('world_w_base1', 'male', 'Warfare_Male_1'),
    *[(f'world_w_top{i}', 'male', f'Warfare_Male_Top_{i}') for i in range(1, 8)],
    *[(f'world_w_bottom{i}', 'male', f'Warfare_Male_Bottom_{i}') for i in range(1, 5)],
    *[(f'world_w_feet{i}', 'male', f'Warfare_Male_Feet_{i}') for i in range(1, 3)],
    *[(f'world_w_helm{i}', 'male', f'Warfare_Male_Head_{i}') for i in range(1, 5)],
    # женские базы и одежда
    *[(f'world_f_base{i}', 'female', f'TC_Female_{i}') for i in range(1, 4)],
    *[(f'world_f_dress{i}', 'female', f'TC_Female_Dress_{i}') for i in range(1, 6)],
    *[(f'world_f_hair{i}', 'female', f'TC_Female_Hair_{i}') for i in range(1, 8)],
    *[(f'world_f_feet{i}', 'female', f'TC_Female_Feet_{i}') for i in range(1, 3)],
    # дети (одетые, 6 вариантов)
    *[(f'world_child{i}', 'child', f'TC_Child_{i}') for i in range(1, 5)],
    *[(f'world_child{i}', 'child', f'Townfolk_Child_{i - 4}') for i in range(5, 7)],
]


def src_path(name):
    if name in ('Baenor', 'Naia'):
        return os.path.join(DRIVE, f'{name}_')
    return os.path.join(DRIVE, f'{SRC_PREFIX}{name}_')


def normalize_cell(cell, f, dx, dy):
    """Привести ячейку 128×128 к целевой геометрии (рост 62, ноги y=126)."""
    if f == 1.0:
        scaled = cell
    else:
        nw, nh = max(1, round(128 * f)), max(1, round(128 * f))
        scaled = cell.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    out.alpha_composite(scaled, (dx, dy))
    return out


def bake_sheet(out_name, cls, src_name):
    f, dx, dy = CLASSES[cls]
    walk = Image.open(src_path(src_name) + 'walking.png').convert('RGBA')
    idle = Image.open(src_path(src_name) + 'idle1.png').convert('RGBA')
    out = Image.new('RGBA', (9 * 128, 4 * 128), (0, 0, 0, 0))
    for row in range(4):            # 0=вниз 1=влево 2=вправо 3=вверх
        for col in range(8):        # ходьба: 8 кадров
            cell = walk.crop((col * 128, row * 128, col * 128 + 128, row * 128 + 128))
            out.paste(normalize_cell(cell, f, dx, dy), (col * 128, row * 128))
        cell = idle.crop((0, row * 128, 128, row * 128 + 128))  # idle: кадр 0
        out.paste(normalize_cell(cell, f, dx, dy), (8 * 128, row * 128))
    # палитра ≤255 (как у боевых листов 66.32) — вес ~втрое меньше
    q = out.quantize(colors=255, method=Image.FASTOCTREE)
    q.save(os.path.join(OUT, out_name + '.png'), optimize=True)
    return os.path.getsize(os.path.join(OUT, out_name + '.png'))


def main():
    total = 0
    for out_name, cls, src_name in SHEETS:
        size = bake_sheet(out_name, cls, src_name)
        total += size
        print(f'{out_name}.png  {size // 1024} КБ')
    print(f'\nИТОГО: {len(SHEETS)} листов, {total // 1024} КБ')

    # контрольная сборка: композит жителя + стражник + герои
    from PIL import ImageDraw
    def L(key):
        return Image.open(os.path.join(OUT, key + '.png')).convert('RGBA')
    demo = Image.new('RGBA', (128 * 6, 156), (70, 70, 80, 255))
    d = ImageDraw.Draw(demo)
    combos = [
        ['world_m_base1', 'world_m_top2', 'world_m_pants3', 'world_m_hair1', 'world_m_beard1', 'world_m_feet2'],
        ['world_m_base2', 'world_m_top5', 'world_m_pants1', 'world_m_hair4', 'world_m_feet3'],
        ['world_f_base1', 'world_f_dress1', 'world_f_hair2', 'world_f_feet1'],
        ['world_f_base3', 'world_f_dress3', 'world_f_hair5', 'world_f_feet2'],
        ['world_w_base1', 'world_w_top3', 'world_w_bottom1', 'world_w_feet1', 'world_w_helm1'],
        ['world_hero_male'],
    ]
    for i, layers in enumerate(combos):
        c = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        for key in layers:
            c.alpha_composite(L(key).crop((0, 0, 128, 128)))
        demo.alpha_composite(c, (i * 128, 26))
    demo.convert('RGB').save('/home/z/my-project/scripts/inspect/world_demo.png')
    print('демо: scripts/inspect/world_demo.png')


if __name__ == '__main__':
    main()

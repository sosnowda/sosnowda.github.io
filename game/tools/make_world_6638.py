#!/usr/bin/env python3
# make_world_6638.py — ПАТЧ 66.38 (приказ владельца): 1) ВАРИАНТЫ ОДЕЖДЫ ИЗ
# DRIVE-ПАКОВ — гардероб жителей расширен новыми частями из той же библиотеки
# Google Drive (папка владельца, https://drive.google.com/drive/folders/
# 1p_tJFXiaQPEO1-EQVqg6dwnvvSyg2e3s):
#   мужские причёски 6 → 30 (в паке у каждой из 6 причёсок 4 цветовых Alts:
#   чёрный/рыжий/седой/каштановый — то же лицо, другой цвет волос);
#   женские причёски 7 → 35 (та же схема Alts);
#   бороды 2 → 10 (FacialHair_1..2 × 4 Alts);
#   шлемы стражи 4 → 10 (Warfare_Male_Head_1..10);
#   НОВЫЙ тип женского костюма — брючный (TC_Female_Pants_1..3 + Top_1..5).
# 2) АССЕТЫ ВНЕШНЕГО ВИДА НПЦ И ИГРОКА — ПЕРЕСОБРАНЫ ИЗ НОВОЙ БИБЛИОТЕКИ
# GOOGLE DRIVE: все 145 мировых листов запечены заново из скачанных
# источников (стейджинг — tools/drive_fetch_world_6638.py → STAGING).
#
# Геометрия/раскладка — БЕЗ ИЗМЕНЕНИЙ от 66.37 (systems/WorldLook.js):
# выход 9 колонок × 4 строки @128 (кадры 0..35 row-major; колонки 0..7 —
# ходьба, колонка 8 — idle; строки 0=вниз 1=влево 2=вправо 3=вверх), рост
# фигуры 88px, ноги y=126, центр по X; палитра ≤255 (FASTOCTREE).
# ОДИН transform на класс (male/female/baenor/naia/child) — слои бумажной
# куклы совмещены; независимое масштабирование слоёв ЛОМАЕТ выравнивание.
#
# Запуск: python3 tools/make_world_6638.py
# Стейджинг (если пуст): python3 tools/drive_fetch_world_6638.py
import os
from PIL import Image

STAGING = os.environ.get('WORLD_STAGING', '/home/z/my-project/drive_parts')
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # game/
OUT = os.path.join(REPO, 'assets', 'sprites', 'world')
os.makedirs(OUT, exist_ok=True)

# классы нормализации (f, dx, dy) — рост 88px, ноги на y=126, центр по X
CLASSES = {
    'male':   (88 / 90, 1, 10),
    'female': (88 / 84, -3, 3),
    'baenor': (88 / 94, 4, 13),
    'naia':   (88 / 88, 0, 6),
    'child':  (88 / 68, -19, -14),
}


def hair_names(tc, cnt_base):
    """Причёски с альтами: базы 1..cnt_base, затем Alt_1..4 каждой.
    Порядок выходных индексов: 1..6, 1_Alt_1..4, 2_Alt_1..4, ...
    """
    names = [f'{tc}_Hair_{i}' for i in range(1, cnt_base + 1)]
    for i in range(1, cnt_base + 1):
        names += [f'{tc}_Hair_{i}_Alt_{a}' for a in range(1, 5)]
    return names


# (выход, класс, исходник_префикс_в_стейджинге) — <префикс>_walking/_idle1.png
SHEETS = [
    # игрок (Heroes I)
    ('world_hero_male',   'baenor', 'Baenor'),
    ('world_hero_female', 'naia',   'Naia'),
    # мужские базы и одежда (Town & Country)
    *[(f'world_m_base{i}', 'male', f'Medieval_TC_Male_{i}') for i in range(1, 4)],
    *[(f'world_m_top{i}',  'male', f'Medieval_TC_Male_Top_{i}') for i in range(1, 10)],
    *[(f'world_m_pants{i}', 'male', f'Medieval_TC_Male_Pants_{i}') for i in range(1, 6)],
    *[(f'world_m_hair{i}', 'male', n)
      for i, n in enumerate(hair_names('Medieval_TC_Male', 6), start=1)],
    # бороды: 1..2 базы, 3..10 — Alts (1_Alt_1..4, 2_Alt_1..4)
    *[(f'world_m_beard{i}', 'male', n) for i, n in enumerate(
        ['Medieval_TC_Male_FacialHair_1', 'Medieval_TC_Male_FacialHair_2']
        + [f'Medieval_TC_Male_FacialHair_1_Alt_{a}' for a in range(1, 5)]
        + [f'Medieval_TC_Male_FacialHair_2_Alt_{a}' for a in range(1, 5)], start=1)],
    *[(f'world_m_feet{i}', 'male', f'Medieval_TC_Male_Feet_{i}') for i in range(1, 4)],
    # стражник (Warfare): база + доспех + штаны + сапоги + шлемы 1..10
    ('world_w_base1', 'male', 'Medieval_Warfare_Male_1'),
    *[(f'world_w_top{i}', 'male', f'Medieval_Warfare_Male_Top_{i}') for i in range(1, 8)],
    *[(f'world_w_bottom{i}', 'male', f'Medieval_Warfare_Male_Bottom_{i}') for i in range(1, 5)],
    *[(f'world_w_feet{i}', 'male', f'Medieval_Warfare_Male_Feet_{i}') for i in range(1, 3)],
    *[(f'world_w_helm{i}', 'male', f'Medieval_Warfare_Male_Head_{i}') for i in range(1, 11)],
    # женские базы, платья, причёски 1..35, обувь + НОВОЕ: брюки и топы
    *[(f'world_f_base{i}', 'female', f'Medieval_TC_Female_{i}') for i in range(1, 4)],
    *[(f'world_f_dress{i}', 'female', f'Medieval_TC_Female_Dress_{i}') for i in range(1, 6)],
    *[(f'world_f_hair{i}', 'female', n)
      for i, n in enumerate(hair_names('Medieval_TC_Female', 7), start=1)],
    *[(f'world_f_feet{i}', 'female', f'Medieval_TC_Female_Feet_{i}') for i in range(1, 3)],
    *[(f'world_f_pants{i}', 'female', f'Medieval_TC_Female_Pants_{i}') for i in range(1, 4)],
    *[(f'world_f_top{i}', 'female', f'Medieval_TC_Female_Top_{i}') for i in range(1, 6)],
    # дети (одетые, 6 вариантов)
    *[(f'world_child{i}', 'child', f'Medieval_TC_Child_{i}') for i in range(1, 5)],
    *[(f'world_child{i}', 'child', f'Medieval_Townfolk_Child_{i - 4}') for i in range(5, 7)],
]


def normalize_cell(cell, f, dx, dy):
    """Привести ячейку 128×128 к целевой геометрии (рост 88, ноги y=126)."""
    if f == 1.0:
        scaled = cell
    else:
        nw, nh = max(1, round(128 * f)), max(1, round(128 * f))
        scaled = cell.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    out.alpha_composite(scaled, (dx, dy))
    return out


def bake_sheet(out_name, cls, src_prefix):
    f, dx, dy = CLASSES[cls]
    walk = Image.open(os.path.join(STAGING, src_prefix + '_walking.png')).convert('RGBA')
    idle = Image.open(os.path.join(STAGING, src_prefix + '_idle1.png')).convert('RGBA')
    out = Image.new('RGBA', (9 * 128, 4 * 128), (0, 0, 0, 0))
    for row in range(4):            # 0=вниз 1=влево 2=вправо 3=вверх
        for col in range(8):        # ходьба: 8 кадров
            cell = walk.crop((col * 128, row * 128, col * 128 + 128, row * 128 + 128))
            out.paste(normalize_cell(cell, f, dx, dy), (col * 128, row * 128))
        cell = idle.crop((0, row * 128, 128, row * 128 + 128))  # idle: кадр 0
        out.paste(normalize_cell(cell, f, dx, dy), (8 * 128, row * 128))
    # палитра ≤255 (как у боевых листов 66.32/мировых 66.37) — вес ~втрое меньше
    q = out.quantize(colors=255, method=Image.FASTOCTREE)
    q.save(os.path.join(OUT, out_name + '.png'), optimize=True)
    return os.path.getsize(os.path.join(OUT, out_name + '.png'))


def main():
    # контроль стейджинга ДО запуска
    missing = []
    for _, cls, src in SHEETS:
        for suffix in ('_walking.png', '_idle1.png'):
            if not os.path.exists(os.path.join(STAGING, src + suffix)):
                missing.append(src + suffix)
    if missing:
        raise SystemExit('нет в стейджинге (запусти tools/drive_fetch_world_6638.py):\n  '
                         + '\n  '.join(missing[:20]))

    total = 0
    for out_name, cls, src in SHEETS:
        size = bake_sheet(out_name, cls, src)
        total += size
    print(f'ИТОГО: {len(SHEETS)} листов, {total // 1024} КБ')

    # контрольная сборка: мужские/женские альты причёсок, брючный костюм, стражник в новых шлемах
    from PIL import ImageDraw

    def L(key):
        return Image.open(os.path.join(OUT, key + '.png')).convert('RGBA')

    demo = Image.new('RGBA', (128 * 7, 156), (70, 70, 80, 255))
    d = ImageDraw.Draw(demo)
    combos = [
        # один мужчина, 4 цвета волос (база + альты 1/2/3)
        ['world_m_base1', 'world_m_top2', 'world_m_pants3', 'world_m_hair1', 'world_m_beard1', 'world_m_feet2'],
        ['world_m_base1', 'world_m_top2', 'world_m_pants3', 'world_m_hair7', 'world_m_beard3', 'world_m_feet2'],
        ['world_m_base1', 'world_m_top2', 'world_m_pants3', 'world_m_hair8', 'world_m_beard7', 'world_m_feet2'],
        ['world_m_base1', 'world_m_top2', 'world_m_pants3', 'world_m_hair9', 'world_m_feet2'],
        # женщина в брючном костюме (новинка) и в платье
        ['world_f_base1', 'world_f_pants1', 'world_f_top1', 'world_f_hair1', 'world_f_feet1'],
        ['world_f_base2', 'world_f_pants3', 'world_f_top5', 'world_f_hair8', 'world_f_feet2'],
        # стражник в новом шлеме Head_10
        ['world_w_base1', 'world_w_top3', 'world_w_bottom1', 'world_w_feet1', 'world_w_helm10'],
    ]
    for i, layers in enumerate(combos):
        c = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        for key in layers:
            c.alpha_composite(L(key).crop((0, 0, 128, 128)))
        demo.alpha_composite(c, (i * 128, 26))
    demo.convert('RGB').save('/home/z/my-project/scripts/inspect/world_demo_6638.png')
    print('демо: scripts/inspect/world_demo_6638.png')


if __name__ == '__main__':
    main()

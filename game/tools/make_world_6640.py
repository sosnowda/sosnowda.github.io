#!/usr/bin/env python3
# make_world_6640.py — ПАТЧ 66.40 (приказы владельца).
# 66.40: ЧЕЛОВЕЧЕСКИЕ АССЕТЫ PB/KT_Humans ЗАДЕЙСТВОВАНЫ (приказ: «если там
# есть человеческие ассеты для НПЦ и героя — можно использовать»).
# Разведка scripts/pbkt_alignment_test.py: у библиотеки ОДИН риг бумажной
# куклы — IoU тел TC↔PB/KT 0.976..0.987, торс TC-одежды на PB/KT базах
# 0.91..0.96 → одежда Town&Country садится на базы PB/KT БЕЗ перекалибровки,
# класс нормализации 'male' тот же (базы 90px, ноги y=119 в исходнике).
#   ОТБРАКОВКА ПО БУСТАМ (контакт-лист scripts/inspect/pbkt_busts_contact.png):
#   базы Medieval_PB_Male_1/Medieval_PB_Male_2 — ЗОМБИ (гниющая плоть, раны),
#   премаde_Male_1 — зомби, премаde_Male_3 — чумной доктор — «только люди» НЕ
#   пропускают. Одобрены по лицу: Medieval_KT_Male_1 (лысый живой мужчина) и
#   Medieval_PB_Premade_Male_2 (дворянин-фехтовальщик — он идёт в альт героя,
#   tools/make_battle_alts_6640.py).
#   НОВАЯ МУЖСКАЯ БАЗА: world_m_base4 = KT_Male_1 (пул баз 3 → 4);
#   НОВЫЕ ВЕРХНИЕ кафтаны: world_m_top10..14 = PB_Male_Top_{1,2,3,5,8}
#   (длинные историчные кафтаны/рясы — ОДЕЖДА безликая, носится TC-базами;
#   Top_4 — доспех и Top_6/7 — кирасы —
#   отбракованы визуально, scripts/inspect/pb_tops_contact.png).
#   ЖЕНЩИНЫ PB/KT НЕ ЗАДЕЙСТВОВАНЫ: одежда пак-женщин — штаны
#   (PB_Female_Bottom — раздельные штанины) и короткие табарды (KT) —
#   неисторично для Руси XV века (приказ 66.39). Женщины — только в платьях TC.
# АЛЬТ ГЕРОЯ (боевой облик paul → pbnoble из PB_Premade_Male_2) —
# отдельный конвейер tools/make_battle_alts_6640.py; мировые листы игрока
# не тронуты (игрок в мире — шаблон по полу, Baenor/Naia).
#
# Геометрия/раскладка — БЕЗ ИЗМЕНЕНИЙ от 66.37/66.38 (systems/WorldLook.js):
# выход 9 колонок × 4 строки @128 (кадры 0..35 row-major; колонки 0..7 —
# ходьба, колонка 8 — idle; строки 0=вниз 1=влево 2=вправо 3=вверх), рост
# фигуры 88px, ноги y=126, центр по X; палитра ≤255 (FASTOCTREE).
# ОДИН transform на класс (male/female/baenor/naia/child) — слои бумажной
# куклы совмещены; независимое масштабирование слоёв ЛОМАЕТ выравнивание.
#
# Запуск: python3 tools/make_world_6640.py
# Стейджинг (если пуст): python3 tools/drive_fetch_pbkt_6640.py
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
    # 66.40: ЧЕЛОВЕЧЕСКАЯ БАЗА KT (живой мужчина по бусту; PB_Male_1/2 —
    # зомби, отбракованы — см. шапку). Риг тот же — одежда TC совместима.
    ('world_m_base4', 'male', 'Medieval_KT_Male_1'),
    # 66.40: кафтаны PB (длинные, историчные для мужчин)
    *[(f'world_m_top{10 + j}', 'male', f'Medieval_PB_Male_Top_{n}')
      for j, n in enumerate([1, 2, 3, 5, 8])],
    # стражник (Warfare): база + доспех + штаны + сапоги + шлемы 1..10
    ('world_w_base1', 'male', 'Medieval_Warfare_Male_1'),
    *[(f'world_w_top{i}', 'male', f'Medieval_Warfare_Male_Top_{i}') for i in range(1, 8)],
    *[(f'world_w_bottom{i}', 'male', f'Medieval_Warfare_Male_Bottom_{i}') for i in range(1, 5)],
    *[(f'world_w_feet{i}', 'male', f'Medieval_Warfare_Male_Feet_{i}') for i in range(1, 3)],
    *[(f'world_w_helm{i}', 'male', f'Medieval_Warfare_Male_Head_{i}') for i in range(1, 11)],
    # женские базы, платья, причёски 1..35, обувь
    # (66.39: женские брюки/топы удалены — неисторично; 66.40: женщины PB/KT
    # тоже НЕ задействованы — у пак штаны/короткие табарды, см. шапку)
    *[(f'world_f_base{i}', 'female', f'Medieval_TC_Female_{i}') for i in range(1, 4)],
    *[(f'world_f_dress{i}', 'female', f'Medieval_TC_Female_Dress_{i}') for i in range(1, 6)],
    *[(f'world_f_hair{i}', 'female', n)
      for i, n in enumerate(hair_names('Medieval_TC_Female', 7), start=1)],
    *[(f'world_f_feet{i}', 'female', f'Medieval_TC_Female_Feet_{i}') for i in range(1, 3)],
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
        raise SystemExit('нет в стейджинге (запусти tools/drive_fetch_pbkt_6640.py):\n  '
                         + '\n  '.join(missing[:20]))

    total = 0
    for out_name, cls, src in SHEETS:
        size = bake_sheet(out_name, cls, src)
        total += size
    print(f'ИТОГО: {len(SHEETS)} листов, {total // 1024} КБ')

    # контрольная сборка: PB/KT базы в одежде TC + кафтаны PB
    from PIL import ImageDraw

    def L(key):
        return Image.open(os.path.join(OUT, key + '.png')).convert('RGBA')

    demo = Image.new('RGBA', (128 * 8, 156), (70, 70, 80, 255))
    d = ImageDraw.Draw(demo)
    combos = [
        # 66.40: новая база KT_Male_1 в одежде TC (совместимость рига)
        ['world_m_base4', 'world_m_pants1', 'world_m_top2', 'world_m_hair1', 'world_m_beard1', 'world_m_feet2'],
        ['world_m_base4', 'world_m_pants3', 'world_m_top4', 'world_m_hair9', 'world_m_feet2'],
        ['world_m_base4', 'world_m_pants1', 'world_m_top3', 'world_m_hair3', 'world_m_beard3', 'world_m_feet1'],
        # 66.40: кафтаны PB на TC-базах
        ['world_m_base1', 'world_m_top10', 'world_m_feet2'],
        ['world_m_base2', 'world_m_top11', 'world_m_hair5', 'world_m_feet1'],
        ['world_m_base3', 'world_m_top12', 'world_m_hair7', 'world_m_beard1', 'world_m_feet3'],
        ['world_m_base1', 'world_m_top13', 'world_m_hair2', 'world_m_feet2'],
        ['world_m_base2', 'world_m_top14', 'world_m_hair4', 'world_m_beard2', 'world_m_feet1'],
    ]
    for i, layers in enumerate(combos):
        c = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        for key in layers:
            c.alpha_composite(L(key).crop((0, 0, 128, 128)))
        demo.alpha_composite(c, (i * 128, 26))
    demo.convert('RGB').save('/home/z/my-project/scripts/inspect/world_demo_6640.png')
    print('демо: scripts/inspect/world_demo_6640.png')


if __name__ == '__main__':
    main()

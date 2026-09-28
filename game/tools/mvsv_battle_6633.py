#!/usr/bin/env python3
# ИСТОРИЧЕСКИЙ КОНВЕЙЕР (66.33): заменён tools/mvsv_battle_6642.py — унаследовал
# от 6632 ОШИБОЧНЫЙ КРОЙ альт-полос 4×96 (истинная сетка 3×128). Его исправные
# части (rim-light, яркость idle, атаки Найи из базового листа) переехали в 6642.
# Не использовать.
# 66.33: конвейер MVsv-боевых листов, вторая итерация (заменяет mvsv_battle_6632.py по частям).
# Новое против 6632:
#   1) АТАКИ НАЙИ из базового листа Naia_MVsv.png — сетка 9×6 @128×128 (замер по
#      проекциям альфы; док-ошибка 66.29 «12×8 @96» относилась к alt-полосам).
#      Раньше attack1/attack2/fists были critical6 (присед со щитом — не атака).
#   2) RIM-LIGHT обликам (baenor/paul 1.0, gaerron 0.9, huntress 0.75, naia 0.6 с 66.35;
#      найя светлая — 0): кромка фигуры, обращённая к свету (верх-лево, как
#      солнце в SkyClock), подсвечивается тёплым цветом пергамента.
#   3) fit96: усадка и по высоте (кадры 128-сеток до 110px высотой).
# Источники: /home/z/my-project/drive-assets (полная выгрузка пака).
# Палитра ≤255 (color type 3, bits=8) — совместимо с декодером тестов r70.
import os
from PIL import Image

PACK = '/home/z/my-project/drive-assets/Medieval - Heroes I'
OUT = '/home/z/my-project/sosnowda-site/game/assets/sprites/battle'
FW = FH = 96

# look → (полоса idle, attack1, attack2, fists, shoot|None, death, victory)
PLAN = {
    'baenor':   ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'gaerron':  ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'huntress': ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shootingstance', '@dead:fall', 'victory6'),
    'naia':     ('stance4', '@base:a1', '@base:a2', '@base:bash', 'shooting', 'dead1', 'victory2'),
    'paul':     ('stance4', 'critical1', 'critical2', 'critical1', None, 'dead3', 'victory3'),
}
SRC = {
    'baenor': 'Baenor/Baenor_MVsv_alt_{0}.png',
    'gaerron': 'MasterGaerron/MasterGaerron_MVsv_alt_{0}.png',
    'huntress': 'Huntress/Huntress_MVsv_alt_{0}.png',
    'naia': 'Naia/Naia_MVsv_alt_{0}.png',
    'paul': 'PaulHammerArm/PaulHammerArm_MVsv_alt_{0}.png',
}
# 66.33: атаки Найи из базового листа (ячейки (row,col) сетки 9×6 @128):
#   a1   — удар оружием: r5c3 замах → r5c4 удар (смаз) → r5c5 проводка →
#          удержание r5c5 (кадр r2c0 «готовность» забракован QA-6633: у края
#          ячейки обрезан наконечник флаила)
#   a2   — светящийся удар щитом: r0c5 щит поднят → r0c6..c8 бело-калёный взмах
#   bash — удар щитом (кулаки): r1c3 замах → r1c4 щит вверх → r1c5 выпад →
#          r1c6 возврат в стойку
NAIA_BASE = os.path.join(PACK, 'Naia/Naia_MVsv.png')
NAIA_BASE_CELLS = {
    'a1':   [(5, 3), (5, 4), (5, 5), (5, 5)],
    'a2':   [(0, 5), (0, 6), (0, 7), (0, 8)],
    'bash': [(1, 3), (1, 4), (1, 5), (1, 6)],
}
NAIA_BASE_NOTE = {
    'a1':   'Naia_MVsv 128er: r5c3,r5c4,r5c5,r5c5*',
    'a2':   'Naia_MVsv 128er: r0c5..r0c8',
    'bash': 'Naia_MVsv 128er: r1c3..r1c6',
}

HUNTRESS_DEAD_FRAMES = [(0, 1), (1, 0), (1, 2), (2, 1)]

# 66.33: rim-light — сила по обликам.
# 66.35 (приказ 1 владельца): rim-light Найи РАДИ ЕДИНООБРАЗИЯ — умеренная
# 0.6 (светлая Наия: рим мягче, чем у тёмных, но читается на контуре).
RIM = {'baenor': 1.0, 'gaerron': 0.9, 'huntress': 0.75, 'paul': 1.0, 'naia': 0.6}
RIM_COLOR = (255, 238, 196)   # тёплый пергамент, в тон золоту интерфейса
LIGHT = (-0.55, -0.83)        # свет сверху-слева (len≈1.0)


def strip_frames(path):
    im = Image.open(path).convert('RGBA')
    assert im.size == (384, 128), f'{path}: {im.size} != 384x128'
    return [im.crop((i * FW, 0, (i + 1) * FW, FH)) for i in range(4)]


def base_cells(path, cells):
    """66.33: кадры из базового листа (сетка 128×128), кроп ячеек."""
    im = Image.open(path).convert('RGBA')
    assert im.size == (1152, 768), f'{path}: {im.size} != 1152x768'
    return [im.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128)) for (r, c) in cells]


def fit96(fr):
    """Кадр произвольного размера → 96×96, контент прижат к низу.
    66.33: усадка и по высоте (h>96 у кадров 128-сеток), и по ширине
    (лежащие фигуры), пропорционально."""
    if fr.size == (FW, FH):
        return fr
    b = fr.getbbox()
    if not b:
        return Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    content = fr.crop(b)
    scale = min(1.0, FW / content.width, FH / content.height)
    if scale < 1.0:
        content = content.resize((max(1, round(content.width * scale)),
                                  max(1, round(content.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    x = (FW - content.width) // 2
    y = FH - content.height
    canvas.paste(content, (x, y), content)
    return canvas


def torso_center(fr):
    """Центр ТУЛОВИЩА по X — окно 24px с максимальной альфа-массой (QA-6632)."""
    px = fr.load()
    col = []
    for x in range(fr.width):
        m = 0
        for y in range(fr.height):
            r, g, b, a = px[x, y]
            if a > 40:
                m += a
        col.append(m)
    W = 24
    best, best_c = -1, fr.width // 2
    for x0 in range(0, fr.width - W):
        s = sum(col[x0:x0 + W])
        if s > best:
            best, best_c = s, x0 + W // 2
    return best_c


def torso_align(frames, anchor='mean'):
    """Сдвиг полосы: туловище опорного кадра — в центр ячейки (QA-6632)."""
    centers = []
    for fr in frames:
        b = fr.getbbox()
        if b:
            centers.append(torso_center(fr))
    if not centers:
        return frames
    base = centers[1] if (anchor == 'f1' and len(centers) > 1) else (sum(centers) / len(centers))
    shift = round(FW / 2 - base)
    if shift == 0:
        return frames
    out = []
    for fr in frames:
        canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        canvas.paste(fr, (shift, 0), fr)
        out.append(canvas)
    return out


def rim_light(frames, strength):
    """66.33: подсветка кромки, обращённой к свету (верх-лево).
    Нормаль наружу — по градиенту альфы (альфа растёт внутрь); край, чья
    нормаль смотрит на свет (dot > 0.25), подмешивает RIM_COLOR с силой,
    растущей к острому углу. Работает по полупрозрачным краям (a>40)."""
    out = []
    for fr in frames:
        px = fr.load()
        W, H = fr.size
        # карта альфы с рамкой нулей — честные края на границе кадра
        A = [[0] * (W + 2) for _ in range(H + 2)]
        for y in range(H):
            row = A[y + 1]
            for x in range(W):
                row[x + 1] = px[x, y][3]
        lx, ly = LIGHT
        for y in range(H):
            for x in range(W):
                r, g, b, a = px[x, y]
                if a <= 40:
                    continue
                gx = A[y + 1][x + 2] - A[y + 1][x]
                gy = A[y + 2][x + 1] - A[y][x + 1]
                if gx == 0 and gy == 0:
                    continue
                ln = (gx * gx + gy * gy) ** 0.5
                w = (-(gx * lx + gy * ly)) / ln  # dot(outward, LIGHT)
                if w <= 0.25:
                    continue
                s = ((w - 0.25) / 0.75) * 0.85 * strength
                if s <= 0:
                    continue
                nr = round(r + (RIM_COLOR[0] - r) * s)
                ng = round(g + (RIM_COLOR[1] - g) * s)
                nb = round(b + (RIM_COLOR[2] - b) * s)
                px[x, y] = (nr, ng, nb, a)
        out.append(fr)
    return out


def quantize(fr):
    """Палитра ≤255 цветов (Fast Octree), color type 3 / bits=8 после save."""
    return fr.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)


os.makedirs(OUT, exist_ok=True)
manifest = []
for look, (idle, a1, a2, fists, shoot, death, victory) in PLAN.items():
    anims = {'idle': idle, 'attack1': a1, 'attack2': a2, 'fists': fists,
             'shoot': shoot, 'death': death, 'victory': victory}
    rim = RIM.get(look, 0.0)
    for anim, src in anims.items():
        out_name = f'battle_{look}_{anim}.png'
        out_path = os.path.join(OUT, out_name)
        if anim == 'death' and src == '@dead:fall':
            sheet = Image.open(os.path.join(PACK, 'Huntress/Huntress_dead.png')).convert('RGBA')
            frames = [fit96(sheet.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128)))
                      for (r, c) in HUNTRESS_DEAD_FRAMES]
            src_note = 'Huntress_dead.png 128er: r0c1,r1c0,r1c2,r2c1'
        elif isinstance(src, str) and src.startswith('@base:'):
            frames = base_cells(NAIA_BASE, NAIA_BASE_CELLS[src[6:]])
            src_note = NAIA_BASE_NOTE[src[6:]] + ' (66.33: из базового MVsv)'
        elif src is None:
            continue
        else:
            frames = strip_frames(os.path.join(PACK, SRC[look].format(src)))
            src_note = SRC[look].format(src)
        frames = torso_align(frames, anchor='f1' if anim == 'idle' else 'mean')
        if rim > 0:
            frames = rim_light(frames, rim)
            src_note += f' +rim{rim}'
        strip = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
        for i, fr in enumerate(frames):
            strip.paste(fr, (i * FW, 0))
        q = quantize(strip)
        q.save(out_path, 'PNG', optimize=True)
        kb = os.path.getsize(out_path) // 1024
        manifest.append((out_name, kb, src_note))
        print(f'{out_name}: {kb} КБ <- {src_note}')

total = sum(m[1] for m in manifest)
print(f'\nИТОГО: {len(manifest)} файлов, {total} КБ')
with open(os.path.join(OUT, 'MANIFEST_6633.txt'), 'w') as f:
    for name, kb, note in manifest:
        f.write(f'{name}\t{kb} КБ\t{note}\n')
    f.write(f'ИТОГО\t{len(manifest)} файлов\t{total} КБ\n')

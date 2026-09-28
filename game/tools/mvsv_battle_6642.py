#!/usr/bin/env python3
# mvsv_battle_6642.py — ПАТЧ 66.42 (приказ 1 владельца): «ПРОВЕРИТЬ МОДЕЛИ
# ИГРОКА И ВОРА В БОЮ». Живой QA (qa_battle_thief_6642.mjs) и прод-скриншот
# 08-combat.webp показали: боевая модель ИГРОКА — вертикальный обрывок.
#
# КОРЕНЬ БАГА (с 66.32, тянется во все итерации конвейера): альт-полосы пака
# «Medieval - Heroes I» — это СЕТКА 3×128 (три кадра 128×128: центры зон
# через ~128px, проверено проекциями альфы по всем 118 полосам), а
# strip_frames() резал полосу на 4 кадра 96×96. Каждый «кадр» получался
# сшивкой обрезков соседних фигур, затем torso_align единым сдвигом
# выталкивал содержимое влево: кадр 0 почти пуст (49..2664 px против
# ~2000 у целых), кадр 1 (стойка idle — игровой статичный кадр!) —
# вертикальный обрывок. Вор (листы enemy_thief_m/f, сетка 4×4@64) не страдал.
#
# ФИКС: крой 3×128 → fit96 (усадка пропорционально, ноги к низу) →
# torso_align (якорь f1 для стоек, среднее для действий) → rim-light
# (параметры 66.33/66.35) → яркость idle ×2 для тёмных обликов (66.33) →
# 4-й кадр = повтор последнего (удержание конечной позы — тайминг анимаций
# прежний, 12fps × 4) → палитра ≤255.
# Отдельные источники без изменений: смерть Охотницы (Huntress_dead.png,
# сетка 128), атаки Найи (базовый Naia_MVsv.png, сетка 9×6@128 — 66.33).
# Идемпотентен: перегенерация по желанию. Источники — staging
# /home/z/my-project/drive_parts_battle (наполнение scripts/drive_fetch_battle_6642.py).
import os
from PIL import Image

STAGING = '/home/z/my-project/drive_parts_battle'
OUT = '/home/z/my-project/sosnowda.github.io/game/assets/sprites/battle'
FW = FH = 96
CELL = 128          # истинная ячейка альт-полос
N_SRC = 3           # кадров в полосе

# look → (полоса idle, attack1, attack2, fists, shoot|None, death, victory)
PLAN = {
    'baenor':   ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'gaerron':  ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'huntress': ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shootingstance', '@dead:fall', 'victory6'),
    'naia':     ('stance4', '@base:a1', '@base:a2', '@base:bash', 'shooting', 'dead1', 'victory2'),
    'paul':     ('stance4', 'critical1', 'critical2', 'critical1', None, 'dead3', 'victory3'),
    # альты 66.39/66.40 (пересобраны тем же фиксом — у них тот же дефект кроя)
    'leyanne':  ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'esther':   ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'pbnoble':  ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
}
SRC = {
    'baenor': 'Baenor_MVsv_alt_{0}.png',
    'gaerron': 'MasterGaerron_MVsv_alt_{0}.png',
    'huntress': 'Huntress_MVsv_alt_{0}.png',
    'naia': 'Naia_MVsv_alt_{0}.png',
    'paul': 'PaulHammerArm_MVsv_alt_{0}.png',
    'leyanne': 'Leyanne_MVsv_alt_{0}.png',
    'esther': 'LordEsther_MVsv_alt_{0}.png',
    'pbnoble': 'Medieval_PB_Premade_Male_2_MVsv_alt_{0}.png',
}
NAIA_BASE = os.path.join(STAGING, 'Naia_MVsv.png')
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
HUNTRESS_DEAD = os.path.join(STAGING, 'Huntress_dead.png')
HUNTRESS_DEAD_FRAMES = [(0, 1), (1, 0), (1, 2), (2, 1)]

RIM = {'baenor': 1.0, 'gaerron': 0.9, 'huntress': 0.75, 'paul': 1.0,
       'naia': 0.6, 'leyanne': 0.75, 'esther': 0.9, 'pbnoble': 0.9}
RIM_COLOR = (255, 238, 196)
LIGHT = (-0.55, -0.83)
# 66.33: яркость idle ×2 только у тёмных обликов канона (Найя светлая)
IDLE_BRIGHT = {'baenor', 'gaerron', 'huntress', 'paul'}


def strip_frames_3x128(path):
    """ФИКС 66.42: альт-полоса = 3 кадра 128×128 (не 4×96!). Каждый кадр
    fit96. Выход: 4 кадра — 3 уникальных + повтор последнего (hold)."""
    im = Image.open(path).convert('RGBA')
    assert im.size == (384, 128), f'{path}: {im.size} != 384x128'
    cells = [im.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(N_SRC)]
    frames = [fit96(c) for c in cells]
    return frames + [frames[-1]]


def base_cells(path, cells):
    im = Image.open(path).convert('RGBA')
    assert im.size == (1152, 768), f'{path}: {im.size} != 1152x768'
    return [fit96(im.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128))) for (r, c) in cells]


def fit96(fr):
    """Кадр произвольного размера → 96×96, контент прижат к низу (66.33)."""
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
            if px[x, y][3] > 40:
                m += px[x, y][3]
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
    """66.33: подсветка кромки, обращённой к свету (верх-лево)."""
    out = []
    for fr in frames:
        px = fr.load()
        W, H = fr.size
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
                w = (-(gx * lx + gy * ly)) / ln
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


def brighten_x2(fr):
    """66.33: яркость idle ×2 (тёмные стойки пака не читались на тёмном фоне)."""
    px = fr.load()
    for y in range(fr.height):
        for x in range(fr.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (min(255, r * 2), min(255, g * 2), min(255, b * 2), a)
    return fr


def quantize(fr):
    return fr.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for look, (idle, a1, a2, fists, shoot, death, victory) in PLAN.items():
        anims = {'idle': idle, 'attack1': a1, 'attack2': a2, 'fists': fists,
                 'shoot': shoot, 'death': death, 'victory': victory}
        rim = RIM.get(look, 0.0)
        for anim, src in anims.items():
            if src is None:
                continue
            out_name = f'battle_{look}_{anim}.png'
            if anim == 'death' and src == '@dead:fall':
                sheet = Image.open(HUNTRESS_DEAD).convert('RGBA')
                frames = [fit96(sheet.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128)))
                          for (r, c) in HUNTRESS_DEAD_FRAMES]
                src_note = 'Huntress_dead.png 128er: r0c1,r1c0,r1c2,r2c1'
            elif isinstance(src, str) and src.startswith('@base:'):
                frames = base_cells(NAIA_BASE, NAIA_BASE_CELLS[src[6:]])
                src_note = NAIA_BASE_NOTE[src[6:]] + ' (базовый MVsv)'
            else:
                frames = strip_frames_3x128(os.path.join(STAGING, SRC[look].format(src)))
                src_note = SRC[look].format(src) + ' (3x128, hold-last)'
            frames = torso_align(frames, anchor='f1' if anim == 'idle' else 'mean')
            if rim > 0:
                frames = rim_light(frames, rim)
                src_note += f' +rim{rim}'
            if anim == 'idle' and look in IDLE_BRIGHT:
                frames = [brighten_x2(f) for f in frames]
                src_note += ' +idle_x2'
            strip = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
            for i, fr in enumerate(frames):
                strip.paste(fr, (i * FW, 0))
            q = quantize(strip)
            q.save(os.path.join(OUT, out_name), 'PNG', optimize=True)
            kb = os.path.getsize(os.path.join(OUT, out_name)) // 1024
            manifest.append((out_name, kb, src_note))
            print(f'{out_name}: {kb} КБ <- {src_note}')

    total = sum(m[1] for m in manifest)
    print(f'\nИТОГО: {len(manifest)} файлов, {total} КБ')
    with open(os.path.join(OUT, 'MANIFEST_6642.txt'), 'w') as f:
        for name, kb, note in manifest:
            f.write(f'{name}\t{kb} КБ\t{note}\n')
        f.write(f'ИТОГО\t{len(manifest)} файлов\t{total} КБ\n')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.45 (приказ 4): МОДЕЛЬ ВОРА В БОЮ ИЗ ГОТОВЫХ ТАЙЛОВ ПАКА.

Владелец: «во время боя голова вора отдельно от туловища. переделать ассеты
вора, использовав уникальные готовые уникальные тайлы, а не собирать из
кусков». Прорисованные полигонами листы 66.43/66.44 забракованы.

Источник — пак владельца (Google Drive «ТАЙЛЫ», скачан в
/home/z/my-project/drive_tiles):
  • вор (м)  = Medieval - Townfolk I / Medieval_Townfolk_Male_Skulker —
    капюшон + кольчужный койф + кожаный доспех, клинок, профиль ВЛЕВО;
  • воровка (ж) = Medieval - Townfolk I / Medieval_Townfolk_Female_Beggar —
    платок + поношенная одежда (аутентично для Руси XV в.), сливовая
    подкраска одежды (устоявшийся облик «сливового плаща» 66.43/66.44).

КЛЮЧЕВОЙ ФАКТ О ПАКЕ (вскрыт профилем колонок 66.45): MVsv_alt-полосы
384×128 — это ТРИ кадра 128×128 (не четыре 96×96!): фигуры стоят по одной
в каждой трети полосы (замеры: Skulker stance2 = x[37..120]/[165..248]/
[293..375]). Прежние попытки нарезки по 96px (66.43/66.44 — своя рисовалка;
наивная резка) и родили класс артефактов «голова отдельно от туловища» /
«парящие обрывки»: тела и клинки резались посередине.

Технология: MVsv_alt-полосы → честные ячейки 128×128 → чистка (связные
компоненты внутри ячейки; у главной фигуры оставляют свои детали — тень/
оружие; мелочь в стороне отбрасывается) → fit96 (контент прижат к низу
ячейки 96×96, конвейер 6633/6639/6640) → туловище на x=48 → rim-light как
у боевых обликов героев → палитра ≤255. Боевой цикл из 3 поз пака
компонуется в 4-кадровый лист игры.

Выход (ключи и проводка BootScene/CombatScene не меняются):
  battle_thiefm_idle.png / battle_thiefm_attack1.png
  battle_thieff_idle.png / battle_thieff_attack1.png
Запуск: python3 game/tools/make_thief_battle_6645.py
"""

import os
from collections import deque
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))      # game/
OUT = os.path.join(REPO, 'assets', 'sprites', 'battle')
DRIVE = os.environ.get('DRIVE_TILES', '/home/z/my-project/drive_tiles')
SKULKER = 'Medieval - Townfolk I/Medieval_Townfolk_Male_Skulker/Medieval_Townfolk_Skulker'
BEGGAR = 'Medieval - Townfolk I/Medieval_Townfolk_Female_Beggar/Medieval_Townfolk_Female_Beggar'

FW = FH = 96            # кадр игры
CELL = 128              # ячейка полосы пака (384×128 = 3 кадра)
MIN_MAIN_MASS = 500     # ниже — ячейка пустая/битая
KEEP_FRAGMENT_MASS = 150  # детали рядом с фигурой мельче — мусор


# ---------------------------------------------------------------- компоненты


def components_in(im):
    """Связные компоненты (8-связность, альфа>30) изображения."""
    W, H = im.size
    px = im.load()
    seen = bytearray(W * H)
    comps = []
    for y0 in range(H):
        for x0 in range(W):
            if seen[y0 * W + x0] or px[x0, y0][3] <= 30:
                continue
            q = deque([(x0, y0)])
            seen[y0 * W + x0] = 1
            mass = 0
            minx, maxx, miny, maxy = x0, x0, y0, y0
            while q:
                x, y = q.popleft()
                mass += 1
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H \
                                and not seen[ny * W + nx] and px[nx, ny][3] > 30:
                            seen[ny * W + nx] = 1
                            q.append((nx, ny))
            comps.append(dict(mass=mass, bbox=(minx, miny, maxx, maxy)))
    return comps


def near(a, b, pad=14):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return not (ax1 < bx0 - pad or bx1 < ax0 - pad or ay1 < by0 - pad or by1 < ay0 - pad)


def _paint(im, comp, out):
    """Перенести пиксели одного компонента на out (обход по связности)."""
    px = im.load()
    opx = out.load()
    x0, y0, x1, y1 = comp['bbox']
    start = None
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if px[x, y][3] > 30:
                start = (x, y)
                break
        if start:
            break
    if not start:
        return
    q = deque([start])
    seen = {start}
    while q:
        x, y = q.popleft()
        opx[x, y] = px[x, y]
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if x0 <= nx <= x1 and y0 <= ny <= y1 and (nx, ny) not in seen \
                        and px[nx, ny][3] > 30:
                    seen.add((nx, ny))
                    q.append((nx, ny))


def clean_cell(cell):
    """Ячейка 128×128 → чистая: главная фигура + свои детали (тень/оружие).

    Возвращает (массу главной фигуры, чистое изображение ячейки).
    Масса < MIN_MAIN_MASS → пустая ячейка.
    """
    comps = components_in(cell)
    if not comps:
        return 0, cell
    main = max(comps, key=lambda c: c['mass'])
    if main['mass'] < MIN_MAIN_MASS:
        return 0, cell
    out = Image.new('RGBA', cell.size, (0, 0, 0, 0))
    _paint(cell, main, out)
    for c in comps:
        if c is main:
            continue
        # своя деталь (тень/предмет): близко к фигуре и достаточно массивная
        if c['mass'] >= KEEP_FRAGMENT_MASS and near(c['bbox'], main['bbox']):
            _paint(cell, c, out)
    return main['mass'], out


def strip_poses(strip_path, verbose=True):
    """Полоса пака → [(96×96 RGBA) ×N] — чистые фигуры по ячейкам 128px."""
    im = Image.open(strip_path).convert('RGBA')
    assert im.size == (384, 128), f'{strip_path}: {im.size}'
    poses, masses = [], []
    for k in range(3):
        cell = im.crop((k * CELL, 0, k * CELL + CELL, 128))
        mass, clean = clean_cell(cell)
        masses.append(mass)
        poses.append(fit96(clean) if mass else None)
    if verbose:
        print(f'  {os.path.basename(strip_path)}: массы {masses}')
    return poses, masses


def fit96(fr):
    """Кадр → 96×96, контент прижат к низу (конвейер 6633/6639/6640)."""
    b = fr.getbbox()
    if not b:
        return Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    content = fr.crop(b)
    scale = min(1.0, FW / content.width, FH / content.height)
    if scale < 1.0:
        content = content.resize((max(1, round(content.width * scale)),
                                  max(1, round(content.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    canvas.paste(content, ((FW - content.width) // 2, FH - content.height), content)
    return canvas


def torso_center(fr):
    """Центр туловища по X — окно 24px с максимальной альфа-массой (QA-6632)."""
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


def center_frame(fr):
    """Сдвинуть туловище кадра на x=48."""
    c = torso_center(fr)
    shift = FW // 2 - c
    if shift == 0:
        return fr
    canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    canvas.paste(fr, (shift, 0), fr)
    return canvas


RIM_COLOR = (255, 238, 196)
LIGHT = (-0.55, -0.83)


def rim_light(frames, strength):
    """Подсветка кромки к свету (конвейер 6633, без изменений)."""
    out = []
    for fr in frames:
        px = fr.load()
        W, H = fr.size
        A = [[0] * (W + 2) for _ in range(H + 2)]
        for y in range(H):
            for x in range(W):
                A[y + 1][x + 1] = px[x, y][3]
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
                px[x, y] = (round(r + (RIM_COLOR[0] - r) * s),
                            round(g + (RIM_COLOR[1] - g) * s),
                            round(b + (RIM_COLOR[2] - b) * s), a)
        out.append(fr)
    return out


def recolor_plum(fr):
    """Жёлтую одежду Бегарки → тёмно-сливовую (облик воровки 66.43/66.44)."""
    px = fr.load()
    W, H = fr.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a <= 30:
                continue
            if r > 60 and g > 45 and r > b + 25 and g >= b:
                m = (r + b) // 2
                px[x, y] = (round(m * 0.62), round(g * 0.33), round(m * 0.66), a)
    return fr


def compose_sheet(frames, out_name, rim):
    """4 кадра 96×96 → лист 384×128, палитра ≤255."""
    frames = rim_light(frames, rim)
    strip = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.paste(fr, (i * FW, 0))
    q = strip.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)
    out_path = os.path.join(OUT, out_name)
    q.save(out_path, 'PNG', optimize=True)
    kb = os.path.getsize(out_path) // 1024
    print(f'{out_name}: {kb} КБ')
    return q


def best_pose(poses, masses):
    """Самая полная живая поза."""
    alive = [i for i, m in enumerate(masses) if m >= MIN_MAIN_MASS and poses[i]]
    assert alive, f'все кадры битые: {masses}'
    return max(alive, key=lambda i: masses[i])


def main():
    os.makedirs(OUT, exist_ok=True)
    sm = os.path.join(DRIVE, SKULKER)
    bg = os.path.join(DRIVE, BEGGAR)

    # ---------- ВОР (Skulker) ----------
    print('вор — Skulker (Townfolk):')
    sk_stance, sk_m = strip_poses(f'{sm}_MVsv_alt_stance2.png')
    i = best_pose(sk_stance, sk_m)
    print(f'  idle: stance2 поза {i} ({sk_m[i]}px) ×4')
    idle_m = [sk_stance[i].copy() for _ in range(4)]
    # атака — attack2: замах → выпад → удар (3 позы) → лист [A, B, C, C]
    sk_atk, sk_am = strip_poses(f'{sm}_MVsv_alt_attack2.png')
    order = [0, 1, 2, 2]
    print(f'  attack: attack2 {sk_am} → порядок {order}')
    atk_m = [sk_atk[o] for o in order]
    compose_sheet([center_frame(f) for f in idle_m], 'battle_thiefm_idle.png', rim=0.9)
    compose_sheet([center_frame(f) for f in atk_m], 'battle_thiefm_attack1.png', rim=0.9)

    # ---------- ВОРОВКА (Beggar → слива) ----------
    print('воровка — Female Beggar (Townfolk, сливовая подкраска):')
    bg_stance, bg_m = strip_poses(f'{bg}_MVsv_alt_stance2.png')
    j = best_pose(bg_stance, bg_m)
    print(f'  idle: stance2 поза {j} ({bg_m[j]}px) ×4')
    idle_f = [recolor_plum(bg_stance[j].copy()) for _ in range(4)]
    # атака — attack1: замах → удар сверху → выпад (3 позы) → [A, B, C, C]
    bg_atk, bg_am = strip_poses(f'{bg}_MVsv_alt_attack1.png')
    print(f'  attack: attack1 {bg_am} → порядок {order}')
    atk_f = [recolor_plum(bg_atk[o]) for o in order]
    compose_sheet([center_frame(f) for f in idle_f], 'battle_thieff_idle.png', rim=0.75)
    compose_sheet([center_frame(f) for f in atk_f], 'battle_thieff_attack1.png', rim=0.75)

    # ---------- Контактный лист (покадровый) ----------
    from PIL import ImageDraw
    Z = 2
    keys = ('battle_thiefm_idle.png', 'battle_thiefm_attack1.png',
            'battle_thieff_idle.png', 'battle_thieff_attack1.png')
    sheet = Image.new('RGB', (4 * (96 * Z + 10) + 10, len(keys) * (96 * Z + 26) + 10),
                      (44, 36, 30))
    d = ImageDraw.Draw(sheet)
    y = 6
    for key in keys:
        im = Image.open(os.path.join(OUT, key)).convert('RGBA')
        d.text((10, y), key, fill=(255, 210, 130))
        y += 20
        for f in range(4):
            fr = im.crop((f * 96, 0, f * 96 + 96, 96)).resize((96 * Z, 96 * Z), Image.NEAREST)
            sheet.paste(fr, (10 + f * (96 * Z + 10), y), fr)
        y += 96 * Z + 6
    sheet.save('/tmp/insp/new_thief_sheets_6645.png')
    print('Контактный лист: /tmp/insp/new_thief_sheets_6645.png')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# make_battle_alts_6640.py — ПАТЧ 66.40 (приказ владельца: «PB/KT_Humans —
# если там есть человеческие ассеты для НПЦ и героя, можно использовать»).
# АЛЬТ БОЕВОГО ОБЛИКА ПАУЛЯ (Сыщик|муж): Medieval_PB_Premade_Male_2 —
# ЖИВОЙ человек (по бусту: молодой дворянин в тёмном камзоле с мечом;
# премаde_Male_1 — зомби, Male_3 — чумной доктор — отбракованы, «только
# люди»). Боевой ключ pbnoble, альт-имя героя — Яромир (heroes.js/i18n).
# Полосы MVsv_alt_* 4×96 → 384×128 тем же конвейером 6633/6639 (fit96,
# torso_align, rim-light, палитра ≤255):
#   battle_pbnoble_{idle,attack1,attack2,fists,shoot,death,victory}.png
# У ЭТОГО премаde ПОЛОСА shooting ЕСТЬ (у PB_Premade_Male_1 её не было) —
# у альт-Сыщика впервые появляется честная стрельба. idle = stance2
# (якорь f1) — «проездные» стойки пака проверены на Лейанн/Эстер (6639).
# Источник — стейджинг /home/z/my-project/drive_parts_battle
# (наполнение — tools/drive_fetch_pbkt_6640.py).
import os
from PIL import Image

STAGING = os.environ.get('BUST_STAGING', '/home/z/my-project/drive_parts_battle')
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # game/
OUT = os.path.join(REPO, 'assets', 'sprites', 'battle')
FW = FH = 96

# look → (полоса idle, attack1, attack2, fists, shoot, death, victory)
PLAN = {
    'pbnoble': ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
}
SRC = {
    'pbnoble': 'Medieval_PB_Premade_Male_2_MVsv_alt_{0}.png',
}
# rim-light: тёмный камзол — 0.9 (как у Эстер/Гаэррона)
RIM = {'pbnoble': 0.9}
RIM_COLOR = (255, 238, 196)
LIGHT = (-0.55, -0.83)


def strip_frames(path):
    im = Image.open(path).convert('RGBA')
    assert im.size == (384, 128), f'{path}: {im.size} != 384x128'
    return [im.crop((i * FW, 0, (i + 1) * FW, FH)) for i in range(4)]


def fit96(fr):
    """Кадр произвольного размера → 96×96, контент прижат к низу (как 6633)."""
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
    """Подсветка кромки к свету (верх-лево) — конвейер 6633 без изменений."""
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


def main():
    manifest = []
    for look, (idle, a1, a2, fists, shoot, death, victory) in PLAN.items():
        anims = {'idle': idle, 'attack1': a1, 'attack2': a2, 'fists': fists,
                 'shoot': shoot, 'death': death, 'victory': victory}
        rim = RIM.get(look, 0.0)
        for anim, phase in anims.items():
            out_name = f'battle_{look}_{anim}.png'
            src_rel = SRC[look].format(phase)
            frames = strip_frames(os.path.join(STAGING, src_rel))
            frames = [fit96(fr) for fr in frames]
            frames = torso_align(frames, anchor='f1' if anim == 'idle' else 'mean')
            if rim > 0:
                frames = rim_light(frames, rim)
                src_note = src_rel + f' +rim{rim}'
            else:
                src_note = src_rel
            strip = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
            for i, fr in enumerate(frames):
                strip.paste(fr, (i * FW, 0))
            q = strip.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)
            out_path = os.path.join(OUT, out_name)
            q.save(out_path, 'PNG', optimize=True)
            kb = os.path.getsize(out_path) // 1024
            manifest.append(f'{out_name}\t{kb} КБ\t{src_note}')
            print(f'{out_name}: {kb} КБ <- {src_note}')

    total = sum(int(m.split('\t')[1].split()[0]) for m in manifest)
    with open(os.path.join(OUT, 'MANIFEST_6640.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(manifest))
        f.write(f'\nИТОГО\t{len(manifest)} файлов\t{total} КБ\n')
    print(f'\nИТОГО: {len(manifest)} файлов, {total} КБ')


if __name__ == '__main__':
    main()

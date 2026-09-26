#!/usr/bin/env python3
# 66.32: конвейер MVsv-боевых листов «Medieval - Heroes I» → assets/sprites/battle/
# Каждая полоса = 4 кадра 96×96 (384×128), ноги на нижнем крае кадра (y=96).
# Палитра ≤255 цветов (color type 3, bits=8) — совместимо с декодером тестов r70.
# Источники: /home/z/my-project/drive-assets (полная выгрузка пака, сентябрь 2026).
import os
from PIL import Image

PACK = '/home/z/my-project/drive-assets/Medieval - Heroes I'
OUT = '/home/z/my-project/sosnowda-site/game/assets/sprites/battle'
FW = FH = 96

# look → (полоса idle, attack1, attack2, fists, shoot|None, death, victory)
# QA-6632: idle = ТОЛЬКО «якорная» стойка (центр f1 ≈ 48 — тело стоит на месте;
# у stance1 Баэнора/Гаэррона f1=14/78 — это циклы ПЕРЕМЕЩЕНИЯ, фигура едет
# по ячейке — в пошаговом бою фигура «плывёт», у Баэнора вообще ребром к камере).
PLAN = {
    'baenor':   ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'gaerron':  ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1'),
    'huntress': ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shootingstance', '@dead:fall', 'victory6'),
    'naia':     ('stance4', 'critical6', 'critical6', 'critical6', 'shooting', 'dead1', 'victory2'),
    'paul':     ('stance4', 'critical1', 'critical2', 'critical1', None, 'dead3', 'victory3'),
}
# файлы отдельных героев лежат под другими именами:
SRC = {
    'baenor': 'Baenor/Baenor_MVsv_alt_{0}.png',
    'gaerron': 'MasterGaerron/MasterGaerron_MVsv_alt_{0}.png',
    'huntress': 'Huntress/Huntress_MVsv_alt_{0}.png',
    'naia': 'Naia/Naia_MVsv_alt_{0}.png',
    'paul': 'PaulHammerArm/PaulHammerArm_MVsv_alt_{0}.png',
}

# Смерть Huntress: в паке нет alt_dead — собираем падение из Huntress_dead.png.
# ВНИМАНИЕ: лист action-типа — сетка 3×4 кадров 128×128 (не 4×96!), проверено
# визуально (r6632): лежащая фигура шире 96px и «протекает» в соседние ячейки
# при кропе 96. Кадры: на коленях → падает → упала → лежит.
HUNTRESS_DEAD_FRAMES = [(0, 1), (1, 0), (1, 2), (2, 1)]  # (row, col), сетка 128


def strip_frames(path):
    im = Image.open(path).convert('RGBA')
    assert im.size == (384, 128), f'{path}: {im.size} != 384x128'
    return [im.crop((i * FW, 0, (i + 1) * FW, FH)) for i in range(4)]


def fit96(fr):
    """Кадр произвольного размера → 96×96 с контентом, прижатым к низу.
    Контент шире 96px (лежащие фигуры 128-сеток) пропорционально ужимается."""
    if fr.size == (FW, FH):
        return fr
    b = fr.getbbox()
    if not b:
        return Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    content = fr.crop(b)
    if content.width > FW:
        h = max(1, round(content.height * FW / content.width))
        content = content.resize((FW, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    x = (FW - content.width) // 2
    y = FH - content.height  # ноги на нижний край — как у всех MVsv кадров
    canvas.paste(content, (x, y), content)
    return canvas


def torso_center(fr):
    """QA-6632: центр ТУЛОВИЩА по X — окно 24px с максимальной альфа-массой.
    bbox-центр обманывает: тонкий клинок за спиной раздувает bbox вправо,
    а тело стоит у левого края (Баэнор stance2 f1: тело x0..20, bbox-центр 48).
    Туловище — высокое и плотное, клинок — низкая тонкая линия."""
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
    """Сдвиг всей полосы так, чтобы туловище опорного кадра встало в центр
    ячейки (48). anchor='f1' — по кадру 1 (стойки: их циклы «проездные»,
    среднее по циклу ≈48 и сдвиг обнуляется — QA-6632); anchor='mean' — по
    среднему туловищу цикла (атаки/смерти: динамика остаётся авторской,
    медиана тела — по центру). Единый сдвиг сохраняет связность анимации."""
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


def quantize(fr):
    """Палитра ≤255 цветов (Fast Octree — единственный метод для RGBA),
    color type 3 / bits=8 после save. Прозрачность сохраняется индексом 0."""
    return fr.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)


os.makedirs(OUT, exist_ok=True)
manifest = []
for look, (idle, a1, a2, fists, shoot, death, victory) in PLAN.items():
    anims = {'idle': idle, 'attack1': a1, 'attack2': a2, 'fists': fists,
             'shoot': shoot, 'death': death, 'victory': victory}
    for anim, src in anims.items():
        out_name = f'battle_{look}_{anim}.png'
        out_path = os.path.join(OUT, out_name)
        if anim == 'death' and src == '@dead:fall':
            sheet = Image.open(os.path.join(PACK, 'Huntress/Huntress_dead.png')).convert('RGBA')
            frames = [fit96(sheet.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128)))
                      for (r, c) in HUNTRESS_DEAD_FRAMES]
            src_note = 'Huntress_dead.png 128er: r0c1,r1c0,r1c2,r2c1'
        elif src is None:
            continue
        else:
            frames = strip_frames(os.path.join(PACK, SRC[look].format(src)))
            src_note = SRC[look].format(src)
        frames = torso_align(frames, anchor='f1' if anim == 'idle' else 'mean')
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
with open(os.path.join(OUT, 'MANIFEST_6632.txt'), 'w') as f:
    for name, kb, note in manifest:
        f.write(f'{name}\t{kb} КБ\t{note}\n')
    f.write(f'ИТОГО\t{len(manifest)} файлов\t{total} КБ\n')

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РАУНД 66 — новые ассеты по приказу владельца (11 пунктов).

п.9,10: ДЕРЕВЬЯ из пакета владельца «Medieval_Expansion_Trees.zip»
  (Google Drive, 69 PNG). Заменяем исходники прозрачных спрайтов
  deco_tree_*/deco_pine_* — то есть ВСЕ деревья игры (деревня, лес,
  все локации) автоматически переходят на новые ассеты:
    tree_0 — дуб густой зелёный   (Medieval_Expansion_Trees_33)
    tree_1 — берёза               (Medieval_Expansion_Trees_16)
    tree_2 — липа светло-зелёная  (Medieval_Expansion_Trees_50)
    tree_3 — клён осенний ЖЁЛТЫЙ  (Medieval_Expansion_Trees_9)  — новый
    tree_4 — вяз тёмно-зелёный    (Medieval_Expansion_Trees_36) — новый
    pine_0 — ель тёмная           (Medieval_Expansion_Trees_61)
    pine_1 — сосна/пихта          (Medieval_Expansion_Trees_63)
  Обрезаем прозрачные поля, приводим к высоте 128–140px (в сцене
  масштаб ~1.3–1.6 даёт дерево 3.5–4.5 тайла — крона нависает,
  СТВОЛ — единственная коллизия, сквозь крону проходят).

п.3: ВОРОТНЯ village_gate_r66 — как r65 (профиль, проёмом на восток),
  но БЕЗ верёвки с вымпелами и подвесной доски («УДАЛИТЬ ВЕРЕВКУ
  С ВЫМПЕЛАМИ С ВОРОТ»): столбы с острыми наконечниками, кровелька,
  фонарь.

п.8: ЧАСТОКОЛ palisade_0 — ПЕРЕДЕЛАН: ОДИН ряд брёвен (в одно бревно
  толщиной), брёвна КРУГЛЫЕ (цилиндр: блик слева, тень справа) с
  ЯВНЫМ ОСТРИЁМ — высокий конус, никакой поперечной обвязки поверх
  острий («чтобы остриё бревна было видно»).

Выход:
  assets/sprites/tree_0..4.png, assets/sprites/pine_0..1.png,
  assets/sprites/village_gate_r66.png, assets/tiles/palisade_0.png
"""
from PIL import Image, ImageDraw
import os

SRC = '/home/z/r66_src/Medieval_Expansion_Trees'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES = os.path.join(ROOT, 'assets', 'sprites')
TILES = os.path.join(ROOT, 'assets', 'tiles')
os.makedirs(SPRITES, exist_ok=True)
os.makedirs(TILES, exist_ok=True)

# (исходник, выход, высота) — высота в px, ширина по пропорции
TREES = [
    ('Medieval_Expansion_Trees_33.png', 'tree_0', 128),
    ('Medieval_Expansion_Trees_16.png', 'tree_1', 138),
    ('Medieval_Expansion_Trees_50.png', 'tree_2', 128),
    ('Medieval_Expansion_Trees_9.png',  'tree_3', 128),
    ('Medieval_Expansion_Trees_36.png', 'tree_4', 130),
    ('Medieval_Expansion_Trees_61.png', 'pine_0', 132),
    ('Medieval_Expansion_Trees_63.png', 'pine_1', 132),
]


def make_trees():
    for src, out, h in TREES:
        im = Image.open(os.path.join(SRC, src)).convert('RGBA')
        bbox = im.getbbox()
        im = im.crop(bbox)
        w = round(im.width * h / im.height)
        im = im.resize((w, h), Image.LANCZOS)
        im.save(os.path.join(SPRITES, out + '.png'))
        print('OK', out, im.size)


# ---------------------------------------------------------- воротня r66
def make_gate(name='village_gate_r66'):
    """п.3: воротня r65 БЕЗ верёвки с вымпелами и подвесной доски.
    Профильный вид с юго-запада: ближний (южный) столб крупный слева-снизу
    на каменном основании, дальний (северный) — тоньше справа-сверху под
    двускатной кровелькой; у ближнего столба фонарь. Проезд прозрачен."""
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
    # (п.3) верёвка с вымпелами и подвесная доска УДАЛЕНЫ
    # --- фонарь на кронштейне ближнего столба ---
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


# ---------------------------------------------------------- частокол r66
def make_palisade(name='palisade_0'):
    """п.8: тайл ЧАСТОКОЛА 48x48 — ОДИН ряд круглых брёвен (в одно бревно
    толщиной) с ВЫСОКИМ ОСТРИЁМ: конус ~18px с гранью-бликом, волокна,
    сучки. Поперечной обвязки НЕТ — остриё каждого бревна видно целиком.
    Стыкуется по всем четырём сторонам (кольцо вокруг деревни)."""
    TS = 48
    c = Image.new('RGBA', (TS, TS), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    import random
    rnd = random.Random(6608)

    # ДВА бревна в тайле (по 24px) — стена «в одно бревно» толщиной
    for i in range(2):
        x = i * 24
        top = 12 + rnd.randint(0, 5)           # основание конуса (остриё выше)
        w = 23
        mid = x + w // 2
        # --- остриё: конус с лёгкой асимметрией ---
        d.polygon([(x + 1, top), (x + w - 1, top), (mid + 1, top - 18), (mid - 1, top - 16)],
                  fill=(126, 96, 60, 255), outline=(44, 30, 14, 255))
        # грань-блик на конусе
        d.line([mid - 3, top - 15, x + 5, top - 1], fill=(158, 124, 78, 220), width=2)
        # --- тело бревна: цилиндр ---
        d.rectangle([x, top, x + w, TS], fill=(112, 84, 52, 255), outline=(44, 30, 14, 255))
        # круглота: тёмный край справа, светлый блик слева
        d.rectangle([x + w - 4, top, x + w - 1, TS], fill=(84, 60, 36, 255))
        d.line([x + 3, top + 2, x + 3, TS], fill=(140, 108, 66, 230), width=2)
        # волокна
        for px in range(x + 7, x + w - 5, 5):
            d.line([px, top + 4, px, TS], fill=(92, 66, 40, 150))
        # горизонтальная заноздра
        gy = top + 12 + rnd.randint(0, 14)
        d.line([x + 3, gy, x + w - 3, gy], fill=(80, 56, 34, 170))
        # сучок
        kx, ky = x + 5 + rnd.randint(0, 12), gy + 6 + rnd.randint(0, 8)
        d.ellipse([kx, ky, kx + 3, ky + 3], fill=(70, 50, 30, 255),
                  outline=(48, 34, 20, 255))
        # затемнение у земли
        d.rectangle([x, TS - 5, x + w, TS], fill=(70, 50, 30, 200))
    c.save(os.path.join(TILES, name + '.png'))
    print('OK', name, c.size)


if __name__ == '__main__':
    make_trees()
    make_gate()
    make_palisade()

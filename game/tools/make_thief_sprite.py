#!/usr/bin/env python3
# Раунд 33: уникальная фигурка вора (enemy_thief.png).
# Основа — Universal LPC (как у всех жителей), но воровской облик:
# угольно-серый капюшон, серый плащ, тёмная одежда, кинжал.
# Части: локальные game/assets/lpc + hat/cloth/hood + cape/solid/male + dagger
# из репозитория sanderfrenken (лицензии в game/assets/lpc/CREDITS.csv).
#
# Игровой лист: 256×256, кадры 64×64, сетка 4×4, строки 0=down,1=left,2=right,3=up,
# колонки: 0=idle, 1..3 = шаги (BootScene.createWalkAnimations играет [1,2,3,2]).
import os
from PIL import Image

ROOT = '/home/z/sosnewda-live'
OUT = os.path.join(ROOT, 'game/assets/sprites/enemy_thief.png')
FS = 64

# Слои снизу вверх (порядок как в manifest.json игры: body→hair→legs→feet→torso,
# затем плащ, капюшон, кинжал). Плащ «solid» рисуется ПОВЕРХ — это visible cloak.
LAYERS = [
    ROOT + '/game/assets/lpc/body/male_light.png',
    ROOT + '/game/assets/lpc/hair/messy1_black.png',
    ROOT + '/game/assets/lpc/legs/pants_charcoal.png',
    ROOT + '/game/assets/lpc/feet/boots_charcoal.png',
    ROOT + '/game/assets/lpc/torso/longsleeve_laced_charcoal.png',
    ROOT + '/game/assets/lpc/extra/cape_gray_male.png',
    ROOT + '/game/assets/lpc/extra/hood_charcoal.png',
    ROOT + '/game/assets/lpc/extra/dagger.png',
]

# В классическом LPC-листе (832×1344) walk-строки = 8..11 в порядке
# up, left, down, right (проверено визуально: 8 — спина, 9 — профиль влево,
# 10 — лицо, 11 — профиль вправо). Игра ждёт: 0=down,1=left,2=right,3=up.
LPC_ROW_FOR_GAME_ROW = {0: 10, 1: 9, 2: 11, 3: 8}
# Колонки игры из 9-кадрового walk-цикла LPC: idle=проход(1), шаги 0 и 2.
COL_FROM_LPC = {0: 1, 1: 0, 2: 1, 3: 2}


def frame(img, row, col):
    return img.crop((col * FS, row * FS, (col + 1) * FS, (row + 1) * FS))


def main():
    imgs = [Image.open(p).convert('RGBA') for p in LAYERS]
    out = Image.new('RGBA', (FS * 4, FS * 4), (0, 0, 0, 0))
    for grow, lrow in LPC_ROW_FOR_GAME_ROW.items():
        for gcol, lcol in COL_FROM_LPC.items():
            canvas = Image.new('RGBA', (FS, FS), (0, 0, 0, 0))
            for img in imgs:
                # листы 832×1344 и 832×2944: walk-строки одинаковы (8..11)
                canvas.alpha_composite(frame(img, lrow, lcol))
            out.paste(canvas, (gcol * FS, grow * FS))
    out.save(OUT)
    print('saved', OUT)

    # Контактный лист для проверки (×3, на тёмном фоне, с рамками сетки)
    dbg = Image.new('RGBA', (FS * 4 * 3, FS * 4 * 3), (45, 40, 52, 255))
    big = out.resize((FS * 4 * 3, FS * 4 * 3), Image.NEAREST)
    dbg.alpha_composite(big)
    for i in range(1, 4):
        for a in range(0, dbg.width, 3):
            pass
    px = dbg.load()
    for i in range(1, 4):
        x = i * FS * 3
        for y in range(dbg.height):
            if y % 3 == 0:
                px[x, y] = (255, 0, 0, 255)
    for i in range(1, 4):
        y = i * FS * 3
        for x in range(dbg.width):
            if x % 3 == 0:
                px[x, y] = (255, 0, 0, 255)
    dbg.convert('RGB').save('/tmp/thief_preview.png')
    print('preview /tmp/thief_preview.png')


if __name__ == '__main__':
    main()

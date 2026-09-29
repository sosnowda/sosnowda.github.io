#!/usr/bin/env python3
# make_thief_battle_6643.py — ПАТЧ 66.43 (приказ 7 владельца): «ПЕРЕДЕЛАТЬ
# МОДЕЛЬ ВОРА В БОЮ, НА НОВУЮ МОДЕЛЬ».
#
# ДИАГНОЗ: в бою вор до сих пор показывался верхо-видным листом 4×4@64
# (enemy_thief_m/f — спрайты ПОГОНИ), анимация *_idle_left — маленькая
# «топ-даун» фигурка рядом с живописными боковыми моделями героя из пака
# «Medieval - Heroes I» (боевые листы 96×96). Чужеродно и дёшево.
#
# НОВАЯ МОДЕЛЬ: боковые боевые листы вора/воровки в формате листов героев —
#   battle_thiefm_{idle,attack1}.png / battle_thieff_{idle,attack1}.png
#   384×128, палитра (color type 3), 4 кадра 96×96 (в верхних 2/3 листа —
#   как у всех боевых листов игры), фигура ПРОФИЛЕМ ВЛЕВО (вор стоит
#   справа и смотрит на игрока).
# Рисование: суперсемплинг ×2 (192→96, LANCZOS) — живописная миниатюра в
# духе пака; тёмный капюшон-плащ, кинжал, краденая икона в руке (золотой
# блисток у груди), обводка + рим-свет верх-лево (как у боевых листов
# 66.33/66.42). Позы: idle (дыхание/качание плаща) + attack1 (замах —
# выпад кинжалом — проводка, 4-й кадр = удержание, как в конвейере 66.42).
# Идемпотентен. Подключение: BATTLE_LOOK_SHEETS (BootScene) + CombatScene.
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = '/home/z/my-project/sosnowda.github.io/game/assets/sprites/battle'
FW = FH = 96
SS = 2                     # суперсемплинг
S = FW * SS

# ---------- палитра вора ----------
CLOAK = (47, 39, 31, 255)        # плащ — тёмный серо-бурый
CLOAK_F = (54, 42, 46, 255)      # плащ воровки — тёмный сливовый
CLOAK_L = (74, 62, 48, 255)      # световая грань
CLOAK_LF = (86, 68, 70, 255)     # световая грань (воровка)
CLOAK_D = (30, 24, 18, 255)      # тень
CLOAK_XD = (19, 15, 11, 255)
HOOD_IN = (14, 11, 8, 255)       # тень лица под капюшоном
SKIN = (198, 162, 128, 255)      # подбородок
SKIN_D = (150, 116, 88, 255)
BOOT = (28, 20, 13, 255)
BOOT_L = (46, 34, 22, 255)
BELT = (58, 42, 26, 255)
BELT_L = (84, 64, 40, 255)
BLADE = (176, 188, 198, 255)
BLADE_L = (226, 236, 242, 255)
BLADE_D = (108, 118, 128, 255)
GRIP = (74, 52, 30, 255)
GOLD = (216, 170, 74, 255)
GOLD_L = (244, 214, 130, 255)
GOLD_D = (150, 110, 44, 255)
OUTL = (16, 12, 8, 255)
RIM = (255, 232, 190, 255)       # рим-свет верх-лево
HAIR = (122, 84, 51, 255)        # прядь (воровка)
DAGGER_L = (255, 246, 224, 255)  # блик лезвия при выпаде


def px(v):
    return int(round(v * SS))


def scale_pts(pts):
    return [(px(x), px(y)) for x, y in pts]


def draw_frame(pose, female=False):
    """pose: dict(lean, arm, blade, hem, front) — логич. коорд. 96-кадра."""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lean = pose.get('lean', 0)
    hem = pose.get('hem', 0)
    arm = pose.get('arm', 'rest')      # rest | windup | thrust | sweep

    # --- смещения позы
    dx = lean                          # наклон корпуса: + назад, − вперёд
    cloak = CLOAK_F if female else CLOAK
    cloak_l = CLOAK_LF if female else CLOAK_L
    cloak_d = CLOAK_D

    # === ТЕНЬ НА ЗЕМЛЕ ===
    d.ellipse([px(20), px(89), px(72), px(95)], fill=(0, 0, 0, 80))

    # === ЗАДНЯЯ РУКА (дальняя, держит икону у груди) ===
    d.line(scale_pts([(56 + dx, 48), (48 + dx, 52)]), fill=cloak_d, width=px(5))

    # === НОГИ/САПОГИ (видны под подолом) ===
    d.rectangle([px(31 + dx), px(78), px(41 + dx), px(91)], fill=BOOT)
    d.rectangle([px(49 + dx), px(78), px(59 + dx), px(91)], fill=BOOT)
    d.rectangle([px(31 + dx), px(86), px(41 + dx), px(91)], fill=BOOT_L)
    d.rectangle([px(49 + dx), px(86), px(59 + dx), px(91)], fill=BOOT_L)
    # шаг при выпаде — передняя нога дальше влево
    if arm == 'thrust':
        d.rectangle([px(26), px(80), px(37), px(91)], fill=BOOT)
        d.rectangle([px(26), px(87), px(37), px(91)], fill=BOOT_L)

    # === ПЛАЩ (тело) ===
    # подол рваный: зигзаг
    hem_y = 80
    pts = [(30 + dx, 42), (62 + dx, 42), (66 + dx, 58), (68 + dx, hem_y + hem),
           (62 + dx, hem_y - 2 + hem), (58 + dx, hem_y + 2 + hem),
           (52 + dx, hem_y - 1 + hem), (46 + dx, hem_y + 2 + hem),
           (40 + dx, hem_y - 1 + hem), (34 + dx, hem_y + 1 + hem),
           (28 + dx, hem_y - 2 + hem), (26 + dx, hem_y + hem), (26 + dx, 56)]
    if female:
        pts = [(32 + dx, 42), (60 + dx, 42), (64 + dx, 58), (66 + dx, hem_y - 4 + hem),
               (58 + dx, hem_y - 6 + hem), (50 + dx, hem_y - 3 + hem),
               (42 + dx, hem_y - 5 + hem), (34 + dx, hem_y - 6 + hem),
               (28 + dx, hem_y - 4 + hem), (28 + dx, 56)]
    d.polygon(scale_pts(pts), fill=cloak, outline=OUTL)
    # тень по спине (правая сторона)
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.polygon(scale_pts([(52 + dx, 42), (62 + dx, 42), (66 + dx, 58),
                          (68 + dx, hem_y + hem), (54 + dx, hem_y + hem)]),
               fill=(0, 0, 0, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(px(2.2)))
    im.alpha_composite(sh)
    # световая грань спереди (левая)
    d.line(scale_pts([(30 + dx, 44), (27 + dx, 58), (27 + dx, hem_y - 4 + hem)]),
           fill=cloak_l, width=px(2))

    # === ИКОНА В ОКЛАДЕ (краденая — золотой блисток у груди, ПОВЕРХ плаща) ===
    d.line(scale_pts([(56 + dx, 46), (51 + dx, 49)]), fill=cloak_d, width=px(4))
    d.rectangle([px(42 + dx), px(44), px(51 + dx), px(55)], fill=GOLD_D, outline=OUTL)
    d.rectangle([px(43 + dx), px(45), px(50 + dx), px(54)], fill=GOLD)
    d.rectangle([px(44 + dx), px(47), px(47 + dx), px(51)], fill=GOLD_L)
    d.rectangle([px(48 + dx), px(49), px(49 + dx), px(52)], fill=GOLD_L)

    # === КАПЮШОН ===
    hood_pts = [(30 + dx, 30), (34 + dx, 16), (46 + dx, 10), (58 + dx, 16),
                (64 + dx, 30), (62 + dx, 40), (54 + dx, 44), (36 + dx, 44), (31 + dx, 40)]
    if female:  # капюшон + узел платка сзади
        hood_pts = [(31 + dx, 30), (35 + dx, 16), (46 + dx, 11), (57 + dx, 17),
                    (62 + dx, 30), (60 + dx, 40), (53 + dx, 44), (37 + dx, 44), (32 + dx, 40)]
    d.polygon(scale_pts(hood_pts), fill=cloak, outline=OUTL)
    # узел платка сзади (воровка)
    if female:
        d.ellipse([px(58 + dx), px(24), px(66 + dx), px(32)], fill=cloak, outline=OUTL)
    # тень внутри капюшона (проём лица) — смотрит ВЛЕВО
    d.ellipse([px(27 + dx), px(25), px(41 + dx), px(42)], fill=HOOD_IN, outline=OUTL)
    # подбородок — узкий свет в глубине проёма
    d.ellipse([px(29 + dx), px(35), px(35 + dx), px(41)], fill=SKIN_D)
    d.ellipse([px(30 + dx), px(35), px(34 + dx), px(39)], fill=SKIN)
    if female:  # прядь волос
        d.line(scale_pts([(39 + dx, 27), (37 + dx, 36), (39 + dx, 43)]), fill=HAIR, width=px(2))
    # блик на капюшоне (верх-лево)
    d.line(scale_pts([(34 + dx, 15), (45 + dx, 11), (55 + dx, 17)]), fill=cloak_l, width=px(2))

    # === ПЕРЕДНЯЯ РУКА + КИНЖАЛ ===
    if arm == 'rest':
        d.line(scale_pts([(34 + dx, 47), (24, 54), (17, 60)]), fill=cloak, width=px(6))
        d.line(scale_pts([(34 + dx, 47), (24, 54), (17, 60)]), fill=cloak_l, width=px(2))
        hx, hy = 16, 60
        d.polygon(scale_pts([(hx - 2, hy + 1), (hx - 14, hy + 4), (hx - 2, hy + 5)]),
                  fill=BLADE, outline=OUTL)                       # клинок вниз-влево
        d.line(scale_pts([(hx - 3, hy + 2), (hx - 12, hy + 4)]), fill=BLADE_L, width=px(1))
        d.rectangle([px(hx - 3), px(hy - 1), px(hx + 2), px(hy + 3)], fill=GRIP, outline=OUTL)
    elif arm == 'windup':
        d.line(scale_pts([(34 + dx, 47), (28, 50), (22, 52)]), fill=cloak, width=px(6))
        d.line(scale_pts([(34 + dx, 47), (28, 50), (22, 52)]), fill=cloak_l, width=px(2))
        hx, hy = 21, 52
        d.polygon(scale_pts([(hx + 1, hy - 1), (hx + 13, hy - 6), (hx + 1, hy + 3)]),
                  fill=BLADE, outline=OUTL)                       # клинок за спину (вправо-вверх)
        d.line(scale_pts([(hx + 2, hy - 1), (hx + 11, hy - 5)]), fill=BLADE_L, width=px(1))
        d.rectangle([px(hx - 3), px(hy - 1), px(hx + 2), px(hy + 3)], fill=GRIP, outline=OUTL)
    elif arm == 'thrust':
        d.line(scale_pts([(34 + dx, 47), (22, 52), (10, 56)]), fill=cloak, width=px(6))
        d.line(scale_pts([(34 + dx, 47), (22, 52), (10, 56)]), fill=cloak_l, width=px(2))
        hx, hy = 9, 56
        d.polygon(scale_pts([(hx, hy - 2), (hx - 16, hy + 1), (hx, hy + 3)]),
                  fill=BLADE, outline=OUTL)                       # выпад влево
        d.line(scale_pts([(hx - 1, hy - 1), (hx - 14, hy + 1)]), fill=DAGGER_L, width=px(1))
        d.rectangle([px(hx - 2), px(hy - 2), px(hx + 3), px(hy + 2)], fill=GRIP, outline=OUTL)
    elif arm == 'sweep':
        d.line(scale_pts([(34 + dx, 47), (24, 48), (14, 44)]), fill=cloak, width=px(6))
        d.line(scale_pts([(34 + dx, 47), (24, 48), (14, 44)]), fill=cloak_l, width=px(2))
        hx, hy = 13, 44
        d.polygon(scale_pts([(hx, hy + 2), (hx - 15, hy - 6), (hx - 1, hy - 2)]),
                  fill=BLADE, outline=OUTL)                       # проводка вверх-влево
        d.line(scale_pts([(hx - 2, hy), (hx - 13, hy - 5)]), fill=BLADE_L, width=px(1))
        d.rectangle([px(hx - 2), px(hy - 2), px(hx + 3), px(hy + 2)], fill=GRIP, outline=OUTL)

    # === ПОЯС ===
    d.rectangle([px(30 + dx), px(58), px(62 + dx), px(62)], fill=BELT)
    d.line([(px(30 + dx), px(58)), (px(62 + dx), px(58))], fill=BELT_L, width=px(1))
    d.rectangle([px(44 + dx), px(57), px(48 + dx), px(63)], fill=BELT_L, outline=OUTL)

    # === РИМ-СВЕТ верх-лево (кромка капюшона/плеча) ===
    d.line(scale_pts([(33 + dx, 17), (44 + dx, 11), (55 + dx, 16)]), fill=RIM, width=px(1))
    d.line(scale_pts([(29 + dx, 42), (27 + dx, 52)]), fill=RIM, width=px(1))

    return im.resize((FW, FH), Image.LANCZOS)


IDLE = [
    dict(lean=0, arm='rest', hem=0),    # f0 — вдох (корпус чуть выше рисуется базой)
    dict(lean=0, arm='rest', hem=0),    # f1 — каноничная стойка (статичный кадр)
    dict(lean=1, arm='rest', hem=1),    # f2 — плащ качнулся
    dict(lean=1, arm='rest', hem=1),    # f3 — удержание
]
ATTACK = [
    dict(lean=2, arm='windup', hem=0),  # f0 — замах
    dict(lean=-3, arm='thrust', hem=1), # f1 — выпад
    dict(lean=-1, arm='sweep', hem=0),  # f2 — проводка
    dict(lean=-1, arm='sweep', hem=0),  # f3 — удержание последнего
]


def build_strip(frames, female, name):
    strip = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
    for i, pose in enumerate(frames):
        fr = draw_frame(pose, female=female)
        strip.paste(fr, (i * FW, 0))
    pal = strip.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=255)
    pal.putalpha(strip.split()[3].point(lambda a: 255 if a > 10 else 0))
    # цветной P с альфой: сохраняем как RGBA-P через палитру+транспаренси
    pal = strip.convert('P', palette=Image.ADAPTIVE, colors=255)
    path = os.path.join(OUT, name)
    pal.save(path)
    print('OK', name, pal.size, pal.mode)


if __name__ == '__main__':
    build_strip(IDLE, False, 'battle_thiefm_idle.png')
    build_strip(ATTACK, False, 'battle_thiefm_attack1.png')
    build_strip(IDLE, True, 'battle_thieff_idle.png')
    build_strip(ATTACK, True, 'battle_thieff_attack1.png')

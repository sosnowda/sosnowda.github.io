#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАТЧ 66.44 (приказ 11): ПЕРЕДЕЛКА МОДЕЛИ ВОРА В БОЮ.

Листы 66.43 (battle_thiefm/thieff_{idle,attack1}.png) владелец забраковал:
«он там сломан» — фигура читалась как тёмная клякса: голова-яйцо с точкой,
тело-мешок без ног, кинжал терялся. Новая модель рисуется ЗАНОВО, в профиль
ВЛЕВО (на игрока), с честной анатомией:

  • капюшон с наклоном вперёд и ТЕНЬЮ ПОД НИМ — внутри читается лицо:
    кожа лба/носa/подбородка, глаз, бровь, тень глазницы;
  • слойка: плащ ЗА спиной (тёмный, развевается по кадрам), туника С
    ремнём и пряжкой, подол выше колен — НОГИ ЧИТАЮТСЯ: две штанины и
    сапоги с манжетами, стойка «одна нога вперёд»;
  • передняя рука держит КИНЖАЛ (сталь с блеском, деревянная рукоять);
  • краденая икона у груди — золотой оклад с нимбом;
  • idle = 4 кадра дыхания/покачивания плаща; attack1 = замах → выпад →
    удар → возврат (4 кадра);
  • воровка (thieff) — сливовый отлив плаща, платок с узлом, прядь волос.

Технология прежняя: суперсемплинг ×2 (кадр 192 → LANCZOS 96), лист 384×128,
палитра ≤255, фигуры лицом влево. Ключи и проводка (BootScene/CombatScene)
не менялись с 66.43 — заменяются только PNG.
Запуск: python3 game/tools/make_thief_battle_6644.py
"""

import math
from PIL import Image, ImageDraw

OUT = 'game/assets/sprites/battle'
F2 = 192          # холст кадра ×2
F1 = 96           # финальный кадр
COLS, ROWS = 4, 1 # 4 кадра в ряд → 384×128

# ---------------- палитра (мужской вор) ----------------
CLOAK    = (54, 46, 40)
CLOAK_D  = (38, 32, 27)
CLOAK_L  = (72, 62, 52)
TUNIC    = (70, 60, 47)
TUNIC_L  = (88, 76, 58)
TUNIC_D  = (52, 44, 34)
BELT     = (42, 31, 21)
BUCKLE   = (168, 134, 66)
BOOT     = (40, 31, 23)
BOOT_L   = (58, 46, 34)
PANTS    = (58, 50, 42)
SKIN     = (204, 160, 124)
SKIN_D   = (158, 118, 88)
EYE      = (24, 18, 14)
BEARD    = (66, 52, 40)
HOOD     = (48, 41, 36)
HOOD_L   = (64, 55, 47)
BLADE    = (196, 200, 208)
BLADE_D  = (142, 148, 160)
GRIP     = (74, 52, 32)
GUARD    = (120, 96, 48)
ICON_G   = (208, 168, 72)
ICON_L   = (242, 214, 130)
OUTL     = (18, 14, 10)

# ---------------- палитра (воровка) ----------------
F_CLOAK   = (76, 58, 74)
F_CLOAK_D = (54, 41, 53)
F_CLOAK_L = (98, 76, 96)
F_HOOD    = (66, 50, 64)
F_HOOD_L  = (88, 68, 86)
F_SCARF   = (58, 44, 56)
F_HAIR    = (128, 92, 58)
F_TUNIC   = (84, 68, 58)
F_TUNIC_L = (104, 84, 72)
F_TUNIC_D = (62, 50, 42)
F_SKIN    = (214, 170, 136)
F_SKIN_D  = (168, 126, 96)


def limb(d, pts, w, color, outline=OUTL):
    """Конечность — полоса из точек (жёсткие полилинии со скруглением)."""
    d.line(pts, fill=outline, width=w + 4, joint='curve')
    d.line(pts, fill=color, width=w, joint='curve')


def poly(d, pts, color, outline=OUTL, ow=3):
    d.polygon(pts, fill=color, outline=outline, width=ow)


def ell(d, box, color, outline=OUTL, ow=3):
    d.ellipse(box, fill=color, outline=outline, width=ow)


def draw_thief(d, pose, female=False, rnd_jitter=0.0):
    """Нарисовать вора в профиль ВЛЕВО на холсте 192×192 (ноги у y≈186).

    pose: dict(bob, lean, armAng, armExt, dagger, frontLeg, backLeg,
               cloakSway)
    """
    bob = pose.get('bob', 0)          # дыхание, px (вверх)
    lean = pose.get('lean', 0)        # наклон корпуса вперёд (влево), px
    armAng = pose.get('armAng', 35)   # угол плеча→кисть (°, 0 = вперёд-влево)
    armExt = pose.get('armExt', 26)   # длина выноса руки
    dagAng = pose.get('dagger', 28)   # угол кинжала
    fleg = pose.get('frontLeg', 0)    # передняя нога вперёд, px
    bleg = pose.get('backLeg', 0)     # задняя нога назад, px
    sway = pose.get('cloakSway', 0)   # плащ: сдвиг подола

    cloak = F_CLOAK if female else CLOAK
    cloak_d = F_CLOAK_D if female else CLOAK_D
    cloak_l = F_CLOAK_L if female else CLOAK_L
    hood = F_HOOD if female else HOOD
    hood_l = F_HOOD_L if female else HOOD_L
    tunic = F_TUNIC if female else TUNIC
    tunic_l = F_TUNIC_L if female else TUNIC_L
    tunic_d = F_TUNIC_D if female else TUNIC_D
    skin = F_SKIN if female else SKIN
    skin_d = F_SKIN_D if female else SKIN_D

    # --- опорные точки (профиль влево) ---
    ground = 186
    hipY = 118 - bob
    shX, shY = 98 - lean, 76 - bob          # плечо
    hipX = 100 - lean // 2

    # === ЗАДНЯЯ НОГА (дальняя, темнее) ===
    bkx = 116 + bleg
    limb(d, [(hipX + 6, hipY + 6), (bkx, hipY + 40), (bkx + 2, ground - 14)],
         13, tuple(max(0, c - 14) for c in PANTS))
    ell(d, (bkx - 9, ground - 18, bkx + 15, ground + 2),
        tuple(max(0, c - 12) for c in BOOT))

    # === ПЛАЩ (за корпусом, развевается) ===
    poly(d, [
        (shX + 8, shY - 6), (128 + sway, hipY - 6), (138 + sway, ground - 26),
        (118 + sway, ground - 10), (108, hipY + 26), (shX + 12, shY + 18),
    ], cloak_d)
    poly(d, [
        (shX + 6, shY - 2), (118 + sway, hipY), (124 + sway, ground - 34),
        (110 + sway, ground - 18), (102, hipY + 16), (shX + 10, shY + 14),
    ], cloak)

    # === ПЕРЕДНЯЯ НОГА (ближняя) ===
    ftx = 82 - fleg
    limb(d, [(hipX - 4, hipY + 4), (ftx, hipY + 42), (ftx - 2, ground - 12)],
         14, PANTS)
    # сапог с манжетой
    ell(d, (ftx - 20, ground - 16, ftx + 8, ground + 2), BOOT)
    d.rectangle((ftx - 16, ground - 20, ftx + 4, ground - 12), fill=BOOT_L)

    # === ТУНИКА (корпус) ===
    poly(d, [
        (shX - 12, shY - 4), (shX + 16, shY - 6),
        (hipX + 18, hipY + 10), (hipX + 20, hipY + 26),
        (hipX - 22, hipY + 28), (hipX - 20, hipY + 8),
    ], tunic)
    # складка света по груди
    poly(d, [
        (shX - 10, shY), (shX + 2, shY - 2), (hipX - 12, hipY + 24),
        (hipX - 20, hipY + 22),
    ], tunic_l)
    # подол в тень
    poly(d, [
        (hipX - 22, hipY + 18), (hipX + 20, hipY + 16),
        (hipX + 20, hipY + 26), (hipX - 22, hipY + 28),
    ], tunic_d)

    # === РЕМЕНЬ + ПРЯЖКА ===
    d.rectangle((shX - 12, hipY - 8, hipX + 18, hipY + 2), fill=BELT)
    d.rectangle((hipX - 8, hipY - 10, hipX + 2, hipY + 4), fill=BUCKLE)

    # === КРАДЕНАЯ ИКОНА У ГРУДИ ===
    icx, icy = shX - 8, shY + 26
    d.rectangle((icx - 8, icy - 12, icx + 8, icy + 12), fill=ICON_G)
    d.rectangle((icx - 5, icy - 9, icx + 5, icy + 9), fill=(120, 84, 36))
    ell(d, (icx - 4, icy - 6, icx + 4, icy + 4), ICON_L, outline=(120, 84, 36), ow=2)

    # === ГОЛОВА: капюшон + лицо ===
    hx, hy = shX - 12, shY - 26          # центр головы
    # капюшон: заострённый сзади-сверху, открыт спереди
    poly(d, [
        (hx + 20, hy + 14), (hx + 24, hy - 6), (hx + 8, hy - 24),
        (hx - 8, hy - 22), (hx - 20, hy - 8), (hx - 20, hy + 6),
        (hx - 12, hy + 16), (hx + 8, hy + 18),
    ], hood)
    poly(d, [
        (hx + 8, hy - 24), (hx - 8, hy - 22), (hx - 18, hy - 8),
        (hx - 12, hy - 18), (hx + 2, hy - 20),
    ], hood_l)
    # ЛИЦО в тени капюшона: кожа видна спереди
    poly(d, [
        (hx - 18, hy - 4), (hx - 4, hy - 8), (hx + 2, hy + 4),
        (hx - 2, hy + 14), (hx - 14, hy + 12),
    ], skin)
    # тень глазницы + глаз + бровь
    poly(d, [(hx - 14, hy - 4), (hx - 2, hy - 6), (hx + 0, hy + 0),
             (hx - 12, hy + 2)], skin_d)
    d.ellipse((hx - 12, hy - 3, hx - 6, hy + 3), fill=EYE)
    # нос (крючок вниз — «хищный» профиль)
    poly(d, [(hx - 18, hy - 2), (hx - 22, hy + 6), (hx - 15, hy + 7)], skin)
    # борода/подбородок (у воровки — прядь волос)
    if female:
        poly(d, [(hx - 6, hy + 10), (hx + 4, hy + 14), (hx - 2, hy + 30),
                 (hx - 12, hy + 18)], F_HAIR)
    else:
        poly(d, [(hx - 16, hy + 6), (hx + 0, hy + 8), (hx - 2, hy + 18),
                 (hx - 14, hy + 16)], BEARD)
    # у воровки — узел платка сзади
    if female:
        ell(d, (hx + 16, hy + 4, hx + 30, hy + 18), F_SCARF)
        poly(d, [(hx + 22, hy + 16), (hx + 30, hy + 30), (hx + 16, hy + 26)],
             F_SCARF)

    # === ПЕРЕДНЯЯ РУКА + КИНЖАЛ ===
    ang = math.radians(armAng)
    shoulder = (shX - 6, shY + 6)
    hx2 = shoulder[0] - armExt * math.cos(ang)
    hy2 = shoulder[1] + armExt * math.sin(ang) * 0.6
    limb(d, [shoulder, (shoulder[0] - armExt * 0.5 * math.cos(ang),
                        shoulder[1] + 10), (hx2, hy2)], 11, tunic)
    # кисть
    ell(d, (hx2 - 7, hy2 - 6, hx2 + 7, hy2 + 7), skin)
    # кинжал: рукоять → гарда → клинок (угол dagAng вниз-вперёд)
    da = math.radians(dagAng)
    tipx = hx2 - 40 * math.cos(da)
    tipy = hy2 + 40 * math.sin(da)
    d.line((hx2, hy2, hx2 - 14 * math.cos(da), hy2 + 14 * math.sin(da)),
           fill=GRIP, width=7)
    g1 = (hx2 - 16 * math.cos(da) + 8 * math.sin(da), hy2 + 16 * math.sin(da) + 8 * math.cos(da))
    g2 = (hx2 - 16 * math.cos(da) - 8 * math.sin(da), hy2 + 16 * math.sin(da) - 8 * math.cos(da))
    d.line((g1, g2), fill=GUARD, width=5)
    d.line((hx2 - 18 * math.cos(da), hy2 + 18 * math.sin(da), tipx, tipy),
           fill=BLADE_D, width=7)
    d.line((hx2 - 18 * math.cos(da), hy2 + 17 * math.sin(da), tipx, tipy - 2),
           fill=BLADE, width=4)

    # === ЗАДНЯЯ РУКА (не видна за иконой/корпусом — намёк плеча) ===
    ell(d, (shX + 8, shY + 2, shX + 22, shY + 18), tunic_d)


def make_sheet(prefix, female):
    """4 idle + 4 attack → два листа 384×128."""
    frames_idle = [
        dict(bob=0, lean=2, armAng=38, armExt=24, dagger=30, cloakSway=0),
        dict(bob=2, lean=2, armAng=40, armExt=24, dagger=31, cloakSway=2),
        dict(bob=1, lean=3, armAng=37, armExt=25, dagger=29, cloakSway=4),
        dict(bob=0, lean=2, armAng=39, armExt=24, dagger=30, cloakSway=3),
    ]
    frames_attack = [
        dict(bob=0, lean=0, armAng=58, armExt=20, dagger=52, cloakSway=0),   # замах
        dict(bob=1, lean=4, armAng=30, armExt=28, dagger=18, cloakSway=-2),  # выпад
        dict(bob=1, lean=6, armAng=12, armExt=32, dagger=4, frontLeg=6,
             backLeg=4, cloakSway=-4),                                       # удар
        dict(bob=0, lean=3, armAng=26, armExt=26, dagger=16, cloakSway=-1),  # возврат
    ]
    sheets = {}
    for name, frames in (('idle', frames_idle), ('attack1', frames_attack)):
        # Лист 384×128, кадры 96×96 в ВЕРХНЕЙ трети ячейки 96×128 —
        # та же геометрия, что у конвейера 66.43 (QA боевой линии ног пройден)
        sheet = Image.new('RGBA', (COLS * F1, 128), (0, 0, 0, 0))
        for i, pose in enumerate(frames):
            big = Image.new('RGBA', (F2, F2), (0, 0, 0, 0))
            d = ImageDraw.Draw(big)
            draw_thief(d, pose, female=female)
            small = big.resize((F1, F1), Image.LANCZOS)
            sheet.paste(small, (i * F1, 0), small)
        pal = sheet.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE)
        key = f'battle_{prefix}_{name}.png'
        pal.save(f'{OUT}/{key}')
        sheets[key] = pal
        print(f'{key} — готово')
    return sheets


def main():
    make_sheet('thiefm', female=False)
    make_sheet('thieff', female=True)

    # Контактный лист для отчёта
    sheet = Image.new('RGB', (4 * 200 + 20, 4 * 140 + 20), (44, 34, 24))
    y = 10
    for key in ('battle_thiefm_idle.png', 'battle_thiefm_attack1.png',
                'battle_thieff_idle.png', 'battle_thieff_attack1.png'):
        im = Image.open(f'{OUT}/{key}').convert('RGBA')
        big = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        sheet.paste(big, (10, y), big)
        y += 140
    sheet.save('/tmp/insp/new_thief_sheets.png')
    print('Контактный лист: /tmp/insp/new_thief_sheets.png')


if __name__ == '__main__':
    main()

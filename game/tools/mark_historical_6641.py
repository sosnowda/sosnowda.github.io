#!/usr/bin/env python3
# 66.41 (приказ 11, замечание аудита 66.40 §10.5): пометить ИСТОРИЧЕСКИЕ
# конвейеры комментарием-маркером, чтобы не путать с актуальными.
# Актуальные (АУДИТ 66.40 §5): drive_fetch_world_6638/pbkt_6640,
# make_world_6638/6640, mvsv_battle_6632/6633, make_battle_alts_6639/6640,
# make_busts_6633/6639/6640, make_houses_6636, make_houses_repair_6635,
# make_chimneys_6637 (идемпотентен), update_shots_6624, landing_shots.
import os, re

ROOT = '/home/z/my-project/sosnowda.github.io/game/tools'
HISTORICAL = {
    'make_assets_r66.py': 'заменён конвейерами 66.33/66.37+ (мировые листы) — запуск не нужен',
    'make_assets_r67.py': 'заменён конвейерами 66.33/66.37+ — запуск не нужен',
    'make_gate_r67.py': 'воротня r67 заменена village_gate_r65/66 — запуск не нужен',
    'make_houses_r64.py': 'заменён make_houses_6636 (цельные фасады fb_*)',
    'make_houses_r65.py': 'заменён make_houses_6636 (цельные фасады fb_*)',
    'make_thief_sprite.py': 'одноразовый генератор ранних раундов — вор рисуется из паков 66.32+',
    'make_trees.py': 'деревья с 66.34 берутся из пакa Medieval_Expansion_Trees (tree_*/pine_*)',
    'make_world_6637.py': 'заменён make_world_6638 (новая библиотека Drive, 66.38)',
    'repair_interiors_6629.py': 'разовый ремонт фонов 66.29 — фоны уже перекодированы в WebP',
    'make_og_demo_r68.py': 'одноразовый генератор og-demo.jpg (файл в репо, перегенерация не нужна)',
}
MARK = ('# ═══════════════ ИСТОРИЧЕСКИЙ КОНВЕЙЕР (помечено 66.41) ═══════════════\n'
        '# {note}.\n'
        '# НЕ запускать без необходимости: актуальные конвейеры — см. АУДИТ\n'
        '# (АУДИТ_sosnowda_github_io_66.40.pdf, §5) и АГЕНТ.md.\n')

for fn, note in HISTORICAL.items():
    fp = os.path.join(ROOT, fn)
    if not os.path.exists(fp):
        print('нет файла:', fn); continue
    src = open(fp, encoding='utf-8', errors='ignore').read()
    if 'ИСТОРИЧЕСКИЙ КОНВЕЙЕР' in src:
        print('уже помечен:', fn); continue
    if src.startswith('#!'):
        lines = src.split('\n')
        lines = [lines[0], ''] + MARK.format(note=note).split('\n') + lines[1:]
        out = '\n'.join(lines)
    else:
        out = MARK.format(note=note) + src
    open(fp, 'w', encoding='utf-8').write(out)
    print('помечен:', fn)
print('DONE')

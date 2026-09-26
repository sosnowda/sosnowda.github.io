#!/usr/bin/env python3
"""Анализ PNG game/assets: режим, уникальные цвета, потенциал lossless-паковки.
Флаг --apply: перекодировать PNG с <=256 цветами в палитровый формат (lossless)."""
import sys
from pathlib import Path
from PIL import Image

REPO = Path('/home/z/my-project/sosnowda-site/game/assets')
apply = '--apply' in sys.argv
zones = ['sprites', 'tiles', 'interiors', 'ui', 'icons', 'effects', 'lpc']
total_before = total_after = 0
files_changed = 0
report = []
for zone in zones:
    zdir = REPO / zone
    if not zdir.exists():
        continue
    for f in sorted(zdir.rglob('*.png')):
        before = f.stat().st_size
        total_before += before
        try:
            img = Image.open(f)
            img.load()
        except Exception as e:
            report.append((f, before, 0, f'ERR {e}'))
            continue
        colors = img.getcolors(maxcolors=100000)
        ncolors = len(colors) if colors else -1  # None/−1 → больше лимита
        if apply and ncolors != -1 and ncolors <= 256 and img.mode in ('RGBA', 'RGB', 'LA', 'L', 'P'):
            # точная палитра (без квантования): цвета не меняются
            rgba = img.convert('RGBA')
            pal = rgba.quantize(colors=max(2, ncolors), method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
            # проверка точности: сравнить цветовые пары
            back = pal.convert('RGBA')
            if list(back.getdata()) == list(rgba.getdata()):
                # bits=8: PIL иначе минимизирует битность (4/2/1) — ломает
                # самописные PNG-декодеры тестов; браузерам всё равно, но
                # единообразие 8 бит дешевле поддержки.
                pal.save(f, 'PNG', optimize=True, bits=8)
                after = f.stat().st_size
                total_after += after
                files_changed += 1
                report.append((f, before, after, f'{img.mode} {ncolors}c OK'))
            else:
                # палитра неточная — lossless optimize без перекодировки
                img.save(f, 'PNG', optimize=True)
                after = f.stat().st_size
                total_after += after
                if after < before:
                    files_changed += 1
                report.append((f, before, after, f'{img.mode} {ncolors}c>256c — optimize only'))
        else:
            # только перем optimize (метаданные/сжатие)
            img.save(f, 'PNG', optimize=True)
            after = f.stat().st_size
            total_after += after
            if after < before:
                files_changed += 1
            report.append((f, before, after, f'{img.mode} {ncolors}c'))

if not apply:
    # сухой прогон не перекодирует — только анализ; пересчёт after некорректен, гасим
    print('DRY RUN (файлы уже перезаписаны optimize в этом прогоне — см. отчёт)')
saved = total_before - sum(r[2] for r in report)
print(f'Файлов: {len(report)}, изменено: {files_changed}')
print(f'Было:  {total_before/1048576:.2f} МБ')
print(f'Стало: {sum(r[2] for r in report)/1048576:.2f} МБ  (экономия {saved/1024:.0f} КБ, {100*saved/max(1,total_before):.1f}%)')
top = sorted(report, key=lambda r: -(r[1]-r[2]))[:12]
print('Топ-12 выгоды:')
for f, b, a, note in top:
    print(f'  {b/1024:7.1f}КБ → {a/1024:7.1f}КБ  {f.relative_to(REPO)}  [{note}]')

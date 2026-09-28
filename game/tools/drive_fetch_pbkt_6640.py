#!/usr/bin/env python3
"""66.40: стейджинг человеческих ассетов паков PB/KT_Humans (приказ владельца:
«PB/KT_Humans — если там есть человеческие ассеты для НПЦ и героя, можно
использовать»). Разведка (scripts/pbkt_alignment_test.py, IoU 0.91–0.99)
показала: у библиотеки ОДИН бумажно-кукольный риг — одежда TC садится на
базы PB/KT попиксельно, сетки те же (walking/idle1 8×4@128, MVsv 9×6@128).

ЖЕНЩИНЫ PB/KT НЕ ЗАДЕЙСТВОВАНЫ (приказ 66.39 «строго исторично»): у пак
женская одежда — штаны (PB_Female_Bottom_1..2 — раздельные штанины) и
короткие табарды до колена (KT_Female_Tabard) — неисторично для Руси XV века.

ОТБРАКОВКА ПО БУСТАМ (см. tools/make_world_6640.py): базы Medieval_PB_Male_1/2
— ЗОМБИ (гниющая плоть), Medieval_PB_Premade_Male_1 — зомби, Premade_Male_3 —
чумной доктор. Живые люди: Medieval_KT_Male_1 (база жителей) и
Medieval_PB_Premade_Male_2 (дворянин — альт боевого облика paul «Яромир»).

Скачивает из библиотеки Google Drive владельца (перечень drive_full.tsv,
колонки: file_id <TAB> имя <TAB> путь):
  → /home/z/my-project/drive_parts (мировые листы):
    * база мужчин: Medieval_KT_Male_1 — walking+idle1 (ЖИВОЙ по бусту);
    * верхняя одежда: Medieval_PB_Male_Top_{1,2,3,5,8} — walking+idle1
      (длинные кафтаны/рясы — безликая одежда, носится TC-базами;
      Top_4 — доспех, Top_6/7 — кирасы — отбракованы визуально,
      scripts/inspect/pb_tops_contact.png);
  → /home/z/my-project/drive_parts_battle (боевые листы/бусты):
    * Medieval_PB_Premade_Male_2 — живой дворянин с мечом (альт боевого
      облика paul, ключ pbnoble): MVsv_alt_{stance2,attack1,attack2,
      martialartpunch,shooting,dead1,victory1} (полоса shooting ЕСТЬ —
      у альт-Сыщика честная стрельба) + Bust_1..8.

Повторный запуск докачивает только недостающее (размер > 1000 байт и
PNG-сигнатура). Механизм тот же, что в drive_fetch_busts_6639.py.
"""
import os
import re
import sys
import threading
import queue

try:
    import requests
except ImportError:
    requests = None
    import urllib.request

TSV = '/home/z/my-project/drive_full.tsv'
WORLD_OUT = os.environ.get('WORLD_STAGING', '/home/z/my-project/drive_parts')
BUST_OUT = os.environ.get('BUST_STAGING', '/home/z/my-project/drive_parts_battle')
os.makedirs(WORLD_OUT, exist_ok=True)
os.makedirs(BUST_OUT, exist_ok=True)

# (имя_файла_в_библиотеке, целевая_папка)
NEEDED = (
    [f'Medieval_KT_Male_1_{s}.png' for s in ('walking', 'idle1')]
    + [f'Medieval_PB_Male_Top_{n}_{s}.png' for n in (1, 2, 3, 5, 8) for s in ('walking', 'idle1')]
    + [f'Medieval_PB_Premade_Male_2_MVsv_alt_{p}.png'
       for p in ('stance2', 'attack1', 'attack2', 'martialartpunch', 'shooting', 'dead1', 'victory1')]
    + [f'Medieval_PB_Premade_Male_2_Bust_{i}.png' for i in range(1, 9)]
)


def fetch(fid, dst):
    url = f'https://drive.usercontent.google.com/download?id={fid}&confirm=t'
    if requests:
        r = requests.get(url, timeout=90)
        r.raise_for_status()
        data = r.content
    else:
        data = urllib.request.urlopen(url, timeout=90).read()
    with open(dst, 'wb') as f:
        f.write(data)


def main():
    index = {}
    with open(TSV, encoding='utf-8') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) < 3:
                continue
            fid, name = parts[0], parts[1]
            if name in NEEDED and name not in index:
                index[name] = fid
    missing = [n for n in NEEDED if n not in index]
    if missing:
        print('НЕТ В БИБЛИОТЕКЕ:', *missing, sep='\n  ')
        sys.exit(1)

    todo = []
    for name in NEEDED:
        dst = os.path.join(BUST_OUT if 'Premade' in name else WORLD_OUT, name)
        if os.path.exists(dst) and os.path.getsize(dst) > 1000:
            with open(dst, 'rb') as f:
                if f.read(8) == b'\x89PNG\r\n\x1a\n':
                    continue
        todo.append((name, index[name], dst))

    print(f'нужно скачать: {len(todo)} из {len(NEEDED)}')
    q = queue.Queue()
    for item in todo:
        q.put(item)
    errors = []

    def worker():
        while not q.empty():
            name, fid, dst = q.get()
            try:
                fetch(fid, dst)
                print(f'  ок: {name} ({os.path.getsize(dst)} байт)')
            except Exception as e:  # noqa: BLE001
                errors.append((name, str(e)))
                print(f'  ОШИБКА: {name}: {e}')
            finally:
                q.task_done()

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=600)
    if errors:
        print('ПРОВАЛ:', errors)
        sys.exit(2)
    print('стейджинг PB/KT готов:',
          f'{WORLD_OUT} (мировые), {BUST_OUT} (боевые/бусты)')


if __name__ == '__main__':
    main()

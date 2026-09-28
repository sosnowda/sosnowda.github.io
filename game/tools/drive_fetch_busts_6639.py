#!/usr/bin/env python3
"""66.39: стейджинг исходников для альтов бустов/боевых обликов.

Скачивает из библиотеки Google Drive владельца (перечень drive_full.tsv,
колонки: file_id <TAB> имя <TAB> путь) и раскладывает в
/home/z/my-project/drive_parts_battle/:
  * бусты героев: Baenor/Huntress/PaulHammerArm Bust_1..8, MasterGaerron_Bust,
    Naia_Bust — для альтов портретов (и буст Пауля, которого в 66.33 не было);
  * базовые MVsv-мастера Baenor/MasterGaerron/Huntress/Naia/PaulHammerArm —
    для второй (базовой) цветовой схемы боевых обликов.

Повторный запуск докачивает только недостающее (размер > 1000 байт и PNG-сигнатура).
Механизм тот же, что в drive_fetch_world_6638.py / scripts/drive_fetch_parts.py:
uc?id=<fid>, при confirm-странице — повтор с confirm=t и uuid.
"""
import os
import re
import sys
import threading
import queue
import requests

TSV = '/home/z/my-project/drive_full.tsv'
OUT = '/home/z/my-project/drive_parts_battle'
os.makedirs(OUT, exist_ok=True)

NEEDED = (
    [f'Baenor_Bust_{i}.png' for i in range(1, 9)]
    + [f'Huntress_Bust_{i}.png' for i in range(1, 9)]
    + [f'PaulHammerArm_Bust_{i}.png' for i in range(1, 9)]
    + [f'Leyanne_Bust_{i}.png' for i in range(1, 9)]
    + ['MasterGaerron_Bust.png', 'Naia_Bust.png', 'LordEsther_Bust.png']
    + ['Baenor_MVsv.png', 'MasterGaerron_MVsv.png', 'Huntress_MVsv.png',
       'Naia_MVsv.png', 'PaulHammerArm_MVsv.png']
)


def main():
    index = {}
    with open(TSV, encoding='utf-8') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) < 2:
                continue
            fid, name = parts[0], parts[1]
            if name in NEEDED and name not in index:
                index[name] = fid
    missing = [n for n in NEEDED if n not in index]
    if missing:
        print('нет в библиотеке:', missing)
        sys.exit(1)

    q = queue.Queue()
    for name in NEEDED:
        q.put((index[name], name))

    fails, lock = [], threading.Lock()

    def worker():
        sess = requests.Session()
        sess.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0'})
        while True:
            try:
                fid, name = q.get_nowait()
            except queue.Empty:
                return
            dest = os.path.join(OUT, name)
            if os.path.exists(dest) and os.path.getsize(dest) > 1000:
                with open(dest, 'rb') as f:
                    if f.read(8) == b'\x89PNG\r\n\x1a\n':
                        q.task_done()
                        continue
            ok, err = False, ''
            for attempt in range(3):
                try:
                    url = f'https://drive.google.com/uc?id={fid}'
                    r = sess.get(url, timeout=120, allow_redirects=True)
                    if r.status_code == 200 and r.content[:8] == b'\x89PNG\r\n\x1a\n':
                        with open(dest, 'wb') as f:
                            f.write(r.content)
                        ok = True
                        break
                    m = re.search(r'name="uuid" value="([^"]+)"', r.text)
                    if m:
                        url2 = (f'https://drive.usercontent.google.com/download'
                                f'?id={fid}&export=download&confirm=t&uuid={m.group(1)}')
                        r = sess.get(url2, timeout=120)
                        if r.content[:8] == b'\x89PNG\r\n\x1a\n':
                            with open(dest, 'wb') as f:
                                f.write(r.content)
                            ok = True
                            break
                    err = f'status={r.status_code} ct={r.headers.get("Content-Type", "")[:40]}'
                except Exception as e:
                    err = str(e)[:100]
            if not ok:
                with lock:
                    fails.append((name, err))
            q.task_done()

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    got = sorted(n for n in NEEDED if os.path.exists(os.path.join(OUT, n)))
    print(f'скачано/на месте: {len(got)}/{len(NEEDED)}; не удалось: {len(fails)}')
    for name, err in fails:
        print(f'  FAIL {name}: {err}')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()

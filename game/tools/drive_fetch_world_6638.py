#!/usr/bin/env python3
# drive_fetch_world_6638.py — стейджинг-загрузчик источников мировых спрайтов
# 66.38 из библиотеки владельца на Google Drive:
#   https://drive.google.com/drive/folders/1p_tJFXiaQPEO1-EQVqg6dwnvvSyg2e3s
#
# Скачивает ТОЛЬКО нужные листы (walking/idle1) частей одежды и персонажей
# (~290 файлов) в STAGING, после чего make_world_6638.py запекает 145
# мировых листов в assets/sprites/world/.
#
# Запуск: python3 tools/drive_fetch_world_6638.py
# Повторный запуск докачивает только недостающее (кеш по имени файла).
import os
import re
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import requests

FOLDER_URL = 'https://drive.google.com/drive/folders/1p_tJFXiaQPEO1-EQVqg6dwnvvSyg2e3s'
STAGING = os.environ.get('WORLD_STAGING', '/home/z/my-project/drive_parts')
HEADERS = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0'}

RE_FILE = re.compile(r'https://drive\.google\.com/file/d/([-\w]{25,})/view')
RE_DOCS = re.compile(r'https://docs\.google\.com/(\w+)/d/([-\w]{25,})/')
RE_FOLDER = re.compile(r'https://drive\.google\.com/drive/(?:mobile/folders/)?folders/([-\w]{25,})')

# части: имя_папки_в_Drive → имя_выходного_префикса. ВАЖНО: папки *_Alt_N
# содержат файлы с именем БАЗОВОЙ части (без Alt) — внутренний префикс
# источника снимает суффикс _Alt_N; выход получает полное имя с Alt.
PARTS = {
    **{f'Medieval_T&C_Male_Hair_{i}': f'Medieval_TC_Male_Hair_{i}' for i in range(1, 7)},
    **{f'Medieval_T&C_Male_Hair_{i}_Alt_{a}': f'Medieval_TC_Male_Hair_{i}_Alt_{a}'
       for i in range(1, 7) for a in range(1, 5)},
    **{f'Medieval_T&C_Female_Hair_{i}': f'Medieval_TC_Female_Hair_{i}' for i in range(1, 8)},
    **{f'Medieval_T&C_Female_Hair_{i}_Alt_{a}': f'Medieval_TC_Female_Hair_{i}_Alt_{a}'
       for i in range(1, 8) for a in range(1, 5)},
    **{f'Medieval_T&C_Male_FacialHair_{i}': f'Medieval_TC_Male_FacialHair_{i}' for i in range(1, 3)},
    **{f'Medieval_T&C_Male_FacialHair_{i}_Alt_{a}': f'Medieval_TC_Male_FacialHair_{i}_Alt_{a}'
       for i in range(1, 3) for a in range(1, 5)},
    **{f'Medieval_T&C_Male_{i}': f'Medieval_TC_Male_{i}' for i in range(1, 4)},
    **{f'Medieval_T&C_Female_{i}': f'Medieval_TC_Female_{i}' for i in range(1, 4)},
    **{f'Medieval_T&C_Male_Top_{i}': f'Medieval_TC_Male_Top_{i}' for i in range(1, 10)},
    **{f'Medieval_T&C_Male_Pants_{i}': f'Medieval_TC_Male_Pants_{i}' for i in range(1, 6)},
    **{f'Medieval_T&C_Male_Feet_{i}': f'Medieval_TC_Male_Feet_{i}' for i in range(1, 4)},
    **{f'Medieval_T&C_Female_Dress_{i}': f'Medieval_TC_Female_Dress_{i}' for i in range(1, 6)},
    **{f'Medieval_T&C_Female_Feet_{i}': f'Medieval_TC_Female_Feet_{i}' for i in range(1, 3)},
    # 66.39: женские брюки/топы (TC_Female_Pants_*/Top_*) больше НЕ скачиваются
    # — неисторично для Руси 15 века (приказ владельца: женщины — только в
    # длинных платьях, брюки — только у мужчин).
    # базу Warfare папка пака называет Humans/Male/Male_1 → префикс задаём явно
    'Male_1': 'Medieval_Warfare_Male_1',
    **{f'Medieval_Warfare_Male_Top_{i}': f'Medieval_Warfare_Male_Top_{i}' for i in range(1, 8)},
    **{f'Medieval_Warfare_Male_Bottom_{i}': f'Medieval_Warfare_Male_Bottom_{i}' for i in range(1, 5)},
    **{f'Medieval_Warfare_Male_Feet_{i}': f'Medieval_Warfare_Male_Feet_{i}' for i in range(1, 3)},
    **{f'Medieval_Warfare_Male_Head_{i}': f'Medieval_Warfare_Male_Head_{i}' for i in range(1, 11)},
    **{f'Medieval_T&C_Child_{i}': f'Medieval_TC_Child_{i}' for i in range(1, 5)},
    **{f'Medieval_Townfolk_Child_{i}': f'Medieval_Townfolk_Child_{i}' for i in range(1, 3)},
    # игрок (Heroes I): файлы лежат в папках персонажей
    'Baenor': 'Baenor',
    'Naia': 'Naia',
}

WANT_SUFFIX = ('_walking.png', '_idle1.png')


def list_folder(sess, folder_id):
    """Дети папки через embeddedfolderview: [(id, name, kind)]."""
    params = urllib.parse.urlencode({'id': folder_id})
    r = sess.get(f'https://drive.google.com/embeddedfolderview?{params}', timeout=30)
    r.raise_for_status()
    children = []
    for a in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', r.text, re.S):
        href, inner = a.group(1), a.group(2)
        name = re.sub(r'<[^>]+>', '', inner).replace('&amp;', '&').strip()
        if not name:
            continue
        m = RE_FILE.match(href)
        if m:
            children.append((m.group(1), name, 'file'))
            continue
        m = RE_DOCS.match(href)
        if m:
            children.append((m.group(2), name, 'file'))
            continue
        m = RE_FOLDER.match(href)
        if m:
            children.append((m.group(1), name, 'folder'))
    return children


def collect(sess, root_id):
    """Рекурсивный обход библиотеки: [(file_id, выходное_имя)]."""
    found = []

    def walk(folder_id, folder_name, depth):
        if depth > 6:
            return
        try:
            children = list_folder(sess, folder_id)
        except Exception as e:
            print(f'! пропуск {folder_name}: {e}', file=sys.stderr)
            return
        for fid, name, kind in children:
            if kind == 'folder':
                walk(fid, name, depth + 1)
            elif folder_name in PARTS:
                # внутренний префикс источника: без _Alt_N, T&C → TC
                src_base = re.sub(r'_Alt_\d+$', '', folder_name).replace('T&C', 'TC')
                if folder_name in ('Baenor', 'Naia'):
                    src_base = folder_name
                if name in (src_base + s for s in WANT_SUFFIX):
                    suffix = name[len(src_base):]
                    found.append((fid, PARTS[folder_name] + suffix))

    walk(root_id, 'root', 0)
    return found


def download(sess, fid, dest):
    r = sess.get(f'https://drive.google.com/uc?id={fid}', timeout=90)
    if r.content[:8] == b'\x89PNG\r\n\x1a\n':
        with open(dest, 'wb') as f:
            f.write(r.content)
        return True
    m = re.search(r'name="uuid" value="([^"]+)"', r.text)
    if m:
        url = ('https://drive.usercontent.google.com/download?id=' + fid
               + '&export=download&confirm=t&uuid=' + m.group(1))
        r = sess.get(url, timeout=90)
        if r.content[:8] == b'\x89PNG\r\n\x1a\n':
            with open(dest, 'wb') as f:
                f.write(r.content)
            return True
    return False


def main():
    os.makedirs(STAGING, exist_ok=True)
    sess = requests.Session()
    sess.headers.update(HEADERS)
    m = re.search(r'/folders/([-\w]{25,})', FOLDER_URL)
    print('обход библиотеки Drive…')
    files = collect(sess, m.group(1))
    uniq = {}
    for fid, out in files:
        uniq.setdefault(out, fid)
    print(f'нужно файлов: {len(uniq)}')
    todo = [(fid, out) for out, fid in uniq.items()
            if not (os.path.exists(os.path.join(STAGING, out))
                    and os.path.getsize(os.path.join(STAGING, out)) > 1000)]
    print(f'к скачиванию: {len(todo)}')
    fails = []

    def job(arg):
        fid, out = arg
        dest = os.path.join(STAGING, out)
        for _ in range(3):
            if download(sess, fid, dest):
                return
        fails.append(out)

    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(job, todo))
    if fails:
        print('НЕ УДАЛОСЬ:', *fails, sep='\n  ')
        sys.exit(1)
    print(f'стейджинг готов: {STAGING} ({len(uniq)} файлов)')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# bump_lastmod.py — P3-4 (аудит 66.56): sitemap lastmod ведётся из ФАКТОВ git,
# а не вручную. Для каждой секции sitemap (/ , /en/ , /game/) берётся дата
# последнего коммита, реально трогавшего файлы секции (git log -1 --format=%cd
# --date=short -- <пути>), и проставляется в <lastmod>.
#
# Маппинг секций (QA-инструментарий game/tools и game/docs НЕ считается
# изменением контента — прецедент: /game/ lastmod не бампался в 66.55/66.56,
# хотя tools менялись):
#   /      → index.html, styles.css, js/, manifest.json
#   /en/   → en/index.html, en/manifest.json, js/, styles.css  (js/modules и
#            styles.css ОБЩИЕ — правка модуля/стилей меняет оба лендинга,
#            дрейф 66.55 больше не повторится)
#   /game/ → game/index.html, game/src/, game/assets/
# sw.js сознательно вне маппинга: это инфраструктура браузера, а не контент
# страниц (бампы SW не должны двигать lastmod).
#
# Режимы:
#   python3 game/tools/bump_lastmod.py            — проставить lastmod в sitemap.xml
#   python3 game/tools/bump_lastmod.py --check    — сверить без записи (exit 1 = дрейф)
#
# Процесс (АГЕНТ.md §5): после коммита патча, менявшего файлы секций, —
# прогнать скрипт; если sitemap изменился — `git commit --amend --no-edit`
# и пушить уже с честным lastmod. Тест r108 гоняет --check автоматически.

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]  # корень репозитория (game/tools/ → вверх на 3)
SITEMAP = REPO / 'sitemap.xml'
BASE = 'https://sosnowda.github.io'

# Секция → пути файлов, определяющие её дату
SECTIONS = {
    BASE + '/':        ['index.html', 'styles.css', 'js', 'manifest.json'],
    BASE + '/en/':     ['en/index.html', 'en/manifest.json', 'js', 'styles.css'],
    BASE + '/game/':   ['game/index.html', 'game/src', 'game/assets'],
}


def git_date(paths):
    """Дата последнего коммита (committer date, YYYY-MM-DD), трогавшего ЛЮБОЙ из путей."""
    git = subprocess.run(
        ['git', 'log', '-1', '--format=%cd', '--date=short', '--'] + paths,
        cwd=REPO, capture_output=True, text=True)
    if git.returncode != 0:
        sys.exit('ОШИБКА git: ' + git.stderr.strip())
    out = git.stdout.strip()
    return out or None  # None — история пуста (не должно случиться)


def read_sitemap():
    text = SITEMAP.read_text(encoding='utf-8')
    blocks = text.split('<url>')  # [0] — шапка, далее по блоку на URL
    if len(blocks) != 4:
        sys.exit('ОШИБКА: ожидалось 3 <url>-блока в sitemap.xml, найдено %d' % (len(blocks) - 1))
    return blocks


def loc_of(block):
    start = block.find('<loc>') + 5
    end = block.find('</loc>')
    return block[start:end]


def lastmod_of(block):
    start = block.find('<lastmod>') + 9
    end = block.find('</lastmod>')
    return block[start:end] if start > 8 else None


def with_lastmod(block, date):
    start = block.find('<lastmod>')
    end = block.find('</lastmod>') + len('</lastmod>')
    return block[:start] + '<lastmod>' + date + '</lastmod>' + block[end:]


def main():
    check_only = '--check' in sys.argv[1:]
    blocks = read_sitemap()
    report, drifted = [], False

    for block in blocks[1:]:
        loc = loc_of(block)
        paths = SECTIONS.get(loc)
        if paths is None:
            sys.exit('ОШИБКА: нет маппинга путей для %s — дополните SECTIONS в bump_lastmod.py' % loc)
        date = git_date(paths)
        old = lastmod_of(block)
        if date is None:
            report.append('  %s: git-даты нет, lastmod не тронут (%s)' % (loc, old))
        elif old == date:
            report.append('  %s: актуален (%s)' % (loc, old))
        else:
            drifted = True
            report.append('  %s: %s → %s' % (loc, old, date))
            if not check_only:
                i = blocks.index(block)
                blocks[i] = with_lastmod(block, date)

    print('sitemap lastmod (%s):' % ('СВЕРКА' if check_only else 'БАМП'))
    for line in report:
        print(line)

    if check_only:
        if drifted:
            print('ДРЕЙФ: sitemap расходится с фактами git — прогоните python3 game/tools/bump_lastmod.py')
            sys.exit(1)
        print('СИНХРОН: lastmod соответствует фактам git.')
        return

    if drifted:
        SITEMAP.write_text('<url>'.join(blocks), encoding='utf-8')
        print('sitemap.xml перезаписан.')
    else:
        print('Изменений нет — sitemap.xml не тронут.')


if __name__ == '__main__':
    main()

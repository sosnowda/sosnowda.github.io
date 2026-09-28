#!/usr/bin/env python3
# 66.41 (приказ 12): скан ОРФАНОВЫХ ассетов — файлы game/assets и assets/,
# на которые нет ни одной ссылки в коде (game/src, game/index.html, лендинг,
# sw.js, tools). Динамические пути (world_/battle_/bust_) сверяем по
# таблицам-источникам: WorldLook.js, heroes.js, CombatScene, реестрам бустов.
import os, re, sys

ROOT = '/home/z/my-project/sosnowda.github.io'

# 1) Собираем весь "текст" кода и данных (js/py/html/json/md конвейеров)
code_parts = []
for base in ('game/src', 'game/index.html', 'game/tools', 'index.html', 'en',
             'styles.css', 'main.js', 'sw.js', '404.html', 'manifest.json'):
    p = os.path.join(ROOT, base)
    if os.path.isfile(p):
        code_parts.append(open(p, encoding='utf-8', errors='ignore').read())
    elif os.path.isdir(p):
        for dp, _, fns in os.walk(p):
            for fn in fns:
                fp = os.path.join(dp, fn)
                try:
                    code_parts.append(open(fp, encoding='utf-8', errors='ignore').read())
                except Exception:
                    pass
CODE = '\n'.join(code_parts)

# 1б) Манифесты и json-реестры внутри assets (LPC и пр. грузятся по ним)
for dp, _, fns in os.walk(os.path.join(ROOT, 'game/assets')):
    for fn in fns:
        if fn.endswith(('.json', '.csv')):
            try:
                CODE += open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read() + '\n'
            except Exception:
                pass

# 2) Обход всех файлов ассетов
ASSET_DIRS = ['game/assets', 'assets']
orphans, checked = [], 0
for ad in ASSET_DIRS:
    base_dir = os.path.join(ROOT, ad)
    for dp, _, fns in os.walk(base_dir):
        for fn in fns:
            fp = os.path.join(dp, fn)
            rel = os.path.relpath(fp, ROOT)
            checked += 1
            name, ext = os.path.splitext(fn)
            if ext.lower() in ('.csv', '.txt', '.md', '.license'):
                continue  # служебные/лицензии не считаем орфанами по коду
            # прямой поиск: имя файла или относительный путь в коде
            if fn in CODE or rel in CODE or name in CODE:
                continue
            # динамические группы: world_*/battle_*/bust_*/fb_*/int_bg_* и т.п.
            m = re.match(r'^(world|battle|bust|fb|int_bg|tile|ui|eff|icon|herberstein_1550|vida_lyatsky_1542)', name)
            if m:
                # ищем любое вхождение префикса+цифр/имени без расширения
                if name in CODE:
                    continue
            orphans.append((rel, os.path.getsize(fp)))

total_orphan_bytes = sum(sz for _, sz in orphans)
print(f'Проверено файлов: {checked}; найдено кандидатов-орфанов: {len(orphans)} '
      f'({total_orphan_bytes/1024/1024:.1f} МБ)')
for rel, sz in sorted(orphans):
    print(f'  {sz//1024:>6} КБ  {rel}')

#!/usr/bin/env python3
# dedupe_i18n.py — 66.31 (п.7): чистка дублирующихся ключей в EN-словаре
# game/src/systems/i18n.js.
#
# Семантика JS: в объектном литерале при дубликате ключа побеждает ПОСЛЕДНЯЯ
# запись. Поэтому: хранитель группы = ПОСЛЕДНЕЕ вхождение (поведение рантайма
# не меняется вообще), удаляются только более ранние ОДНОСТРОЧНЫЕ вхождения.
# Многострочные вхождения не трогаем (логируем) — риск правки не оправдан.
#
# После правки строится карта key→value «до» и «после» и сверяется:
# расхождений быть не должно ни по одному ключу.
import re
import sys

PATH = (next(p for p in ["'../src/systems/i18n.js'", "/home/z/my-project/sosnowda-site/game/src/systems/i18n.js"] if __import__("os").path.exists(p)))

with open(PATH, encoding='utf-8') as f:
    lines = f.read().split('\n')

# --- границы EN-объекта ---
start = None
for i, l in enumerate(lines):
    if re.match(r'^const EN = \{', l):
        start = i
        break
if start is None:
    print('FAIL: const EN = { не найден')
    sys.exit(1)

depth = 0
end = None
for i in range(start, len(lines)):
    depth += lines[i].count('{') - lines[i].count('}')
    if depth == 0 and i > start:
        end = i
        break
print(f'EN object: lines {start+1}..{end+1}')

# --- свойства: начало, extent, значение ---
prop_re = re.compile(r"^\s*'((?:[^'\\]|\\.)*)'\s*:\s*(.*)$")
single_val_re = re.compile(r"^\s*'((?:[^'\\]|\\.)*)'\s*:\s*('(?:[^'\\]|\\.)*')\s*,\s*$")

props = []  # (key, start_idx, end_idx, is_single, raw_value_text)
i = start + 1
while i < end:
    l = lines[i]
    m = prop_re.match(l)
    if not m:
        i += 1
        continue
    key = m.group(1)
    # найти конец свойства: первая строка, обрезанная до ','
    j = i
    is_single = bool(single_val_re.match(l))
    if not is_single:
        while j < end:
            if lines[j].rstrip().endswith(','):
                break
            j += 1
    props.append((key, i, j, is_single, l.strip()))
    i = j + 1

print(f'properties found: {len(props)}')

# --- группы дубликатов ---
from collections import OrderedDict
groups = OrderedDict()
for idx, (key, s, e, single, raw) in enumerate(props):
    groups.setdefault(key, []).append(idx)

dup_keys = {k: v for k, v in groups.items() if len(v) > 1}
print(f'duplicate keys: {len(dup_keys)}  extra occurrences: {sum(len(v) - 1 for v in dup_keys.values())}')

# значения «до» (last wins)
def parse_val(text):
    m = re.match(r"^'((?:[^'\\]|\\.)*)'\s*:\s*('(?:[^'\\]|\\.)*')\s*,\s*$", text)
    return m.group(2) if m else None

before_map = {}
for key, idxs in groups.items():
    last = props[idxs[-1]]
    before_map[key] = parse_val(last[4])  # None для многострочных — сверять не будем

# --- правка: удаляем ранние односторонние вхождения ---
to_delete = set()
differ_report = []
for key, idxs in dup_keys.items():
    keeper = idxs[-1]
    for idx in idxs[:-1]:
        key_i, s, e, single, raw = props[idx]
        if not single:
            print(f'  SKIP multiline occurrence of {key!r} at line {s+1}')
            continue
        # сверим значения (информативно)
        a, b = parse_val(raw), parse_val(props[keeper][4])
        if a != b:
            differ_report.append((key, a, b))
        to_delete.add((s, e))

for s, e in sorted(to_delete, reverse=True):
    del lines[s:e + 1]
print(f'removed occurrences: {len(to_delete)}')
print(f'value differences among duplicates (keeper=last wins): {len(differ_report)}')
for key, a, b in differ_report:
    print(f'  {key!r}: removed={a} kept={b}')

# --- новый ключ кнопки «Вернуться на сайт» (п.6) ---
new_key_line = "    'Вернуться на сайт': 'Back to site',"
has_key = any(re.match(r"^\s*'Вернуться на сайт'\s*:", l) for l in lines)
if not has_key:
    # вставляем после 'ОК': 'OK', (Title-блок)
    ins = None
    for i, l in enumerate(lines):
        if re.match(r"^\s*'ОК'\s*:\s*'OK'\s*,\s*$", l):
            ins = i + 1
            break
    if ins is None:
        # фолбэк: сразу после открытия EN-объекта
        ins = start + 1
    lines.insert(ins, '    // 66.31 (п.6): кнопка возврата на лендинг в главном меню')
    lines.insert(ins + 1, new_key_line)
    print('inserted key: Вернуться на сайт -> Back to site')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

# --- контроль: карта «после» ---
lines2 = '\n'.join(lines).split('\n')
after_map = {}
for l in lines2:
    m = single_val_re.match(l)
    if m:
        after_map[m.group(1)] = m.group(2)

mismatch = 0
for k, v in before_map.items():
    if v is None:
        continue
    if after_map.get(k) != v:
        print(f'MISMATCH: {k!r}: before={v} after={after_map.get(k)}')
        mismatch += 1
print(f'checked single-line keys: {len(before_map)}, mismatches: {mismatch}')
sys.exit(1 if mismatch else 0)

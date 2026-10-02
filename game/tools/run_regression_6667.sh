#!/usr/bin/env bash
# run_regression_6667.sh — полный юнит-регресс 64–115 для итерации 66.67.
# r86–89 — CWD-относительные пути → запускать из game/tools/ (AGENTS.md §5).
cd "$(dirname "$0")/../.." || exit 1   # корень репозитория
PASS=(); FAIL=()
for n in $(seq 64 115); do
    f="game/tools/test_round${n}.mjs"
    [ -f "$f" ] || continue
    if [ $n -ge 86 ] && [ $n -le 89 ]; then
        out=$(cd game/tools && node "test_round${n}.mjs" 2>&1)
    else
        out=$(node "$f" 2>&1)
    fi
    if [ $? -eq 0 ]; then
        PASS+=("$n")
        echo "r${n}: OK"
    else
        FAIL+=("$n")
        echo "r${n}: FAIL"
        echo "$out" | grep -E '✗|Error|error' | head -8
    fi
done
echo ""
echo "=== РЕГРЕСС: ${#PASS[@]} зелёных / ${#FAIL[@]} красных ==="
[ ${#FAIL[@]} -gt 0 ] && { echo "Красные: ${FAIL[*]}"; exit 1; }
exit 0

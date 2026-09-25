# game/tools — рабочие скрипты проекта

Здесь лежат: юнит-тесты раундов (`test_round*.mjs`), смоуки Playwright
(`*_smoke*.mjs`, `landing_shots.mjs`), конвертеры кадров (`convert_shots.js`,
`update_shots_6624.py`) и генераторы ассетов (`make_*.py`).

Инструкция по применению каждого скрипта, окружение, конвейер скриншотов,
правила бампа Service Worker и чек-лист прод-верификации — в корне репо:
**[АГЕНТ.md](../АГЕНТ.md)**.

Кратко:
```bash
# сервер
cd <корень репо> && python3 -m http.server 8765 --directory .
# юнит-регресс
cd game/tools && for f in test_round*.mjs; do node $f; done
# смоук (пример)
node game/tools/terrain_smoke_6624.mjs
# пересъёмка и обновление скриншотов лендинга
node game/tools/landing_shots.mjs && python3 game/tools/update_shots_6624.py
```

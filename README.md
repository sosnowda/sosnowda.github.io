# Летописи Руси XV века — The Chronicles of Ruthenia

> AI-narrative RPG про историческую Русь 1400–1505 годов.
> BRP d100 (математика) + LLM-Нарратор (повествование) + RAG-база (историческая правда).

Лендинг проекта и браузерное демо на Phaser 3. Основная игра разрабатывается на Godot Engine.

## Структура

```
index.html          # Лендинг (одностраничник)
styles.css          # Стили (тёмная средневековая тема: золото + киноварь)
main.js             # Интерактив лендинга (reveal, lightbox, d100, частицы)
game/               # Браузерное демо на Phaser 3
  index.html        #   Точка входа демо
  src/scenes/       #   Сцены: Boot → Title → Characters → Village → Combat → End
  src/systems/      #   BRP-движок, сохранения, время, диалоги, аудио
  src/data/         #   Данные: мир, диалоги, репутация, генератор квестов
  assets/           #   Спрайты, тайлы, LPC-генератор персонажей, аудио
assets/             # Ассеты лендинга (картинки, карты, видео)
docs/               # Документация проекта и аналитика
```

## Локальный запуск

Сайт полностью статический — достаточно любого статического сервера:

```bash
python3 -m http.server 8000
# Открыть http://localhost:8000
```

> Игра использует ES-модули, поэтому открывать файлы через `file://` нельзя — нужен сервер.

## Технологии

- **Лендинг**: чистый HTML/CSS/JS, без зависимостей, PWA (service worker + manifest)
- **Демо**: Phaser 3.88 (CDN), ES-модули
- **Ролевая система**: Chaosium BRP Universal Game Engine SRD (d100), ORC License
- **Ассеты персонажей**: LPC (Liberated Pixel Cup), см. `game/assets/lpc/LICENSE`

## Как помочь проекту

- 💰 [Boosty](https://boosty.to/deimosdi) — подписка
- 💰 [ЮMoney](https://yoomoney.ru/to/4100119624440650) — разовый перевод
- 👥 [ВКонтакте](https://vk.ru/club241165941) — сообщество

## Лицензия

Код сайта и демо — MIT (см. [LICENSE](LICENSE)).
Графика LPC и Quaternius, аудио и шрифты — под собственными лицензиями авторов (см. папки ассетов).
BRP — товарный знак Chaosium Inc., используется по ORC License.

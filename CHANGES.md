# Патч улучшений сайта «Летописи Руси XV века»

Составлено по результатам полного аудита сайта и репозитория (браузерный QA + разбор кода).
Все правки проверены на эталонной реализации; патч применяется поверх ветки `main`.

---

## Что входит

### A. Быстрые победы (критичные)

1. **Шрифты наконец подключены** — `index.html`
   - Раньше `Marcellus` и `PT Serif` использовались в 14 местах, но нигде не загружались → рендерился системный serif.
   - Важно: **у Marcellus нет кириллических глифов** — для русских заголовков добавлен **Prata** (полная кириллица, благородный display-serif), PT Serif — для основного текста, Marcellus оставлен для латинских надписей («The Chronicles of Ruthenia», BRP).
   - `display=swap` + preconnect → без FOIT и блокировки рендера.

2. **Двойная загрузка hero устранена** — `index.html`
   - Было: `preload title.jpg` (2 МБ) + `<picture>` выбирал webp (192 КБ) → 2 МБ лишнего трафика на каждом визите.
   - Стало: preload `title.webp`.

3. **`<h1>` на странице** — `index.html`
   - На сайте не было ни одного h1 (только h2/h3). Добавлен визуально скрытый h1 в hero (текст уже «запечён» в картинке, поэтому скрытый — без визуального дубля, но с полным SEO-эффектом).

4. **No-JS-безопасные reveal-анимации** — `main.js`
   - Было: все секции принудительно скрывались (`opacity:0`) до срабатывания IntersectionObserver → без JS/при ошибке/на печати страница пустая.
   - Стало: флаг `document.documentElement.classList.add('js')`; скрываются только элементы НИЖЕ первого экрана; при `prefers-reduced-motion: reduce` и отсутствии IO анимации отключаются полностью.

5. **`.nojekyll`** — деплой GitHub Pages идёт напрямую, без бессмысленного Jekyll-пайплайна.

6. **Чистый `sitemap.xml`** — убраны невалидные якорные URL (`#trailer` и пр.), добавлена страница `/game/`, актуальный `lastmod`.

7. **Twitter Card + лёгкий og-image** — `index.html`, `assets/images/og-image.jpg`
   - Добавлен отсутствовавший `<meta name="twitter:card" content="summary_large_image">`.
   - Новый `og-image.jpg` 1200×630 (~108 КБ вместо 2 МБ title.jpg) — корректное превью в соцсетях.

8. **`README.md` + `LICENSE` (MIT)** — описание проекта, структура, запуск; лицензия явно разделяет код (MIT) и ассеты (LPC/Quaternius/Chaosium — свои лицензии).

### B. UX и стиль игры

9. **Фикс наложений текста в карточках выбора персонажа** — `game/src/scenes/CharacterSelectionScene.js`
   - Причина: подсказка (y=640) и кнопка «Назад» (y=680) рисовались ПОВЕРХ нижнего ряда карточек (низ y=696); блок навыков шёл с фиксированной позиции и налезал на многострочные описания.
   - Исправлено: карточки стали компактнее (252px вместо 280), навыки начинаются динамически — после фактической высоты описания (`desc.height`), снаряжение прижато к нижней кромке, подсказка/кнопка вынесены за сетку.

10. **Кнопки титульного экрана — в средневековой палитре** — `game/src/scenes/TitleScene.js`
    - Синие/зелёные плоские кнопки («Помощь», «Настройки», «О игре») заменены на охристые/оливковые/кожаные тона, гармонирующие с золотом сайта.

### C. Производительность

11. **AVIF-версии исторических карт** — `assets/images/maps/*.avif` (экономия ~55% против webp).
    Подключение в `index.html` (карты уже размечены `<picture>`, добавьте `<source>` первой строкой):

    ```html
    <picture>
        <source srcset="assets/images/maps/vida_lyatsky_1542.avif" type="image/avif">
        <source srcset="assets/images/maps/vida_lyatsky_1542.webp" type="image/webp">
        <img src="assets/images/maps/vida_lyatsky_1542.jpg" ...>
    </picture>
    ```

12. **WebM-версия промо-видео** — выполните локально (в CI-песочнице не хватило памяти):

    ```bash
    ffmpeg -i assets/video/promo.mp4 -c:v libvpx-vp9 -crf 34 -b:v 0 -an \
      -vf "scale=1280:720" -pix_fmt yuv420p assets/video/promo.webm
    ```

    И добавьте `<source>` ПЕРЕД mp4 в секции `#trailer`:

    ```html
    <source src="assets/video/promo.webm" type="video/webm">
    ```

13. **CI-воркфлоу** — `.github/workflows/ci.yml`: Lighthouse CI + проверка внутренних ссылок (lychee) на каждый push.

---

## Как применить

```bash
cd sosnowda.github.io

# 1. Текстовые изменения одним патчем (index.html, main.js, sitemap, README,
#    LICENSE, .nojekyll, CI, обе игровые сцены):
git apply changes.patch

# 2. Бинарные файлы скопировать вручную:
#    og-image.jpg            -> assets/images/og-image.jpg
#    vida_lyatsky_1542.avif  -> assets/images/maps/
#    herberstein_1550.avif   -> assets/images/maps/

# 3. Проверить локально и закоммитить:
python3 -m http.server 8000   # http://localhost:8000
git add -A && git commit -m "feat: аудит сайта — шрифты, SEO, no-js-safe, og-image, фиксы игры"
git push
```

## Итог ожидаемого эффекта

| Метрика | Было | Станет |
|---|---|---|
| Критический путь hero | 2 МБ jpg (preload) | 192 КБ webp |
| og:image | 2 МБ | 108 КБ (1200×630) |
| Карты | webp | avif (−55%) |
| h1 на странице | 0 | 1 |
| Видимость без JS | пустая страница | полностью читаема |
| Соцпревью X/Twitter | не разворачивается | summary_large_image |

# WEBSITE_ENHANCEMENTS.md — Инструкции по дополнительным улучшениям сайта

> **Назначение:** руководство по улучшениям сайта, которые **требуют
> отдельных файлов** или внешних ресурсов (не вписываются в один
> `index.html`).
>
> **Что уже реализовано в `website/index.html`:**
> - ✅ Тёмная/светлая тема (переключатель 🌙/☀️)
> - ✅ Анимация броска d100 (интерактивный кубик)
> - ✅ Telegram-виджет (кнопка в подвале)
> - ✅ Yandex.Metrika (плейсхолдер)
> - ✅ Галерея скриншотов (плейсхолдер с lightbox)
> - ✅ SVG-иконки вместо эмодзи
> - ✅ CSS-анимация фона в hero (мерцание свечей)
> - ✅ Плавная прокрутка
> - ✅ Кнопка «Наверх»
>
> **Что описано в этом документе:**
> - Исторические иллюстрации (Wikimedia Commons)
> - Видео-фон в Hero
> - Интерактивная карта Руси (66 городов)
> - Мультиязычность RU/EN
> - PWA (manifest.json + service worker)
> - Реальный ID Yandex.Metrika
> - Реальный Telegram-канал

---

## 1. Исторические иллюстрации (Wikimedia Commons)

### Что нужно

Заменить SVG-иконки на реальные исторические изображения из Wikimedia
Commons (Public Domain).

### Источники

| Тема | URL на Wikimedia Commons |
|---|---|
| Лицевой летописный свод | https://commons.wikimedia.org/wiki/Category:Illustrated_Chronicle_of_Ivan_the_Terrible |
| Карты Руси XV века | https://commons.wikimedia.org/wiki/Category:Maps_of_Muscovite_Russia |
| Оружие и доспехи | https://commons.wikimedia.org/wiki/Category:Medieval_Russian_weapons |
| Иван III | https://commons.wikimedia.org/wiki/Category:Ivan_III_of_Russia |
| Судебник 1497 | https://commons.wikimedia.org/wiki/Category:Sudebnik_of_1497 |

### Как добавить

1. Скачай изображение с Wikimedia Commons (нажми «Original file» → правой кнопкой → Сохранить как).
2. Положи в папку `website/assets/images/`.
3. В `index.html` замени SVG-иконку на `<img>`:
   ```html
   <!-- Было: -->
   <svg class="icon" ...>...</svg>

   <!-- Стало: -->
   <img src="assets/images/chronicle_miniature.jpg" alt="Миниатюра из Лицевого летописного свода" class="feature-icon-img">
   ```
4. Добавь CSS:
   ```css
   .feature-icon-img {
       width: 48px;
       height: 48px;
       object-fit: cover;
       border-radius: 8px;
       border: 2px solid var(--gold);
   }
   ```

### ⚠️ Важно для РФ

Wikimedia Commons может быть медленным в РФ. Решение:
- Скачай изображения и положи локально в `assets/images/`.
- НЕ используй прямые ссылки на `upload.wikimedia.org`.

---

## 2. Видео-фон в Hero

### Что нужно

Лёгкая видео-петля (5-10 секунд) в фоне Hero-секции — свеча, пергамент,
перо, чернила.

### Источники бесплатных видео

| Сервис | URL |
|---|---|
| Pexels Videos | https://www.pexels.com/search/videos/candle/ |
| Pixabay | https://pixabay.com/videos/search/candle/ |
| Coverr | https://coverr.co/s/candle |

### Как добавить

1. Скачай видео (MP4, ~2-5 МБ, не больше).
2. Положи в `website/assets/video/hero.mp4`.
3. В `index.html` замени CSS-анимацию на `<video>`:
   ```html
   <section class="hero">
       <video autoplay muted loop playsinline class="hero-video">
           <source src="assets/video/hero.mp4" type="video/mp4">
       </video>
       <div class="hero-content">
           <!-- существующий контент -->
       </div>
   </section>
   ```
4. CSS:
   ```css
   .hero-video {
       position: absolute;
       top: 0; left: 0;
       width: 100%; height: 100%;
       object-fit: cover;
       opacity: 0.3;
       z-index: 0;
   }
   .hero-content {
       position: relative;
       z-index: 1;
   }
   ```

### Альтернатива

Если видео слишком тяжёлое — оставить CSS-анимацию (мерцание свечей),
которая уже реализована.

---

## 3. Интерактивная карта Руси (66 городов)

### Что нужно

SVG-карта Руси XV века с 66 городами. При клике на город — всплывающая
подсказка с названием и кратким описанием.

### Источники карты

| Источник | URL |
|---|---|
| Wikimedia: Maps of Muscovite Russia | https://commons.wikimedia.org/wiki/Category:Maps_of_Muscovite_Russia |
| Custom SVG map | нарисовать вручную или заказать у дизайнера |

### Как добавить

1. Создай файл `website/assets/rus_map.svg` — SVG-карта с `<circle>`
   для каждого города.
2. В `index.html` добавь секцию:
   ```html
   <section id="map">
       <h2>Карта Руси XV века</h2>
       <div id="map-container">
           <!-- SVG-карта загружается сюда через JS -->
       </div>
       <div id="city-tooltip"></div>
   </section>
   ```
3. JS: загружай SVG, добавь event listeners на `<circle>`:
   ```javascript
   document.querySelectorAll('#map-container circle').forEach(circle => {
       circle.addEventListener('click', () => {
           const name = circle.getAttribute('data-name');
           const desc = circle.getAttribute('data-desc');
           document.getElementById('city-tooltip').innerHTML =
               `<h3>${name}</h3><p>${desc}</p>`;
       });
   });
   ```

### Упрощённый вариант

Вместо интерактивной SVG — таблица с 66 городами:
```html
<table class="cities-table">
    <tr><th>Город</th><th>Держава</th><th>Расстояние от Москвы</th></tr>
    <tr><td>Москва</td><td>Московское княжество</td><td>—</td></tr>
    <tr><td>Тверь</td><td>Тверское княжество</td><td>170 вёрст</td></tr>
    <!-- ... 64 города ... -->
</table>
```

---

## 4. Мультиязычность RU/EN

### Что нужно

Переключатель 🇷🇺/🇬🇧 — при клике меняется язык интерфейса.

### Вариант A: два HTML-файла (проще)

1. Скопируй `index.html` → `index_en.html`.
2. Переведи все тексты на английский.
3. Добавь переключатель в шапку:
   ```html
   <a href="index.html">🇷🇺 RU</a>
   <a href="index_en.html">🇬🇧 EN</a>
   ```

### Вариант B: JS-переключатель (сложнее)

1. Все тексты в `data-ru` и `data-en` атрибутах:
   ```html
   <h1 data-ru="Летописи Руси XV века" data-en="Chronicles of Ruthenia XV century">
       Летописи Руси XV века
   </h1>
   ```
2. JS-функция:
   ```javascript
   function setLang(lang) {
       document.querySelectorAll('[data-ru]').forEach(el => {
           el.textContent = el.getAttribute('data-' + lang);
       });
       localStorage.setItem('cr-lang', lang);
   }
   ```
3. Переключатель:
   ```html
   <button onclick="setLang('ru')">🇷🇺</button>
   <button onclick="setLang('en')">🇬🇧</button>
   ```

---

## 5. PWA (manifest.json + service worker)

### Что уже есть

- ✅ `website/manifest.json` — создан (favicon, theme color, name).

### Что нужно добавить

#### Шаг 1. Подключить manifest в HTML

В `<head>` добавь:
```html
<link rel="manifest" href="manifest.json">
```

#### Шаг 2. Создать service worker

Файл `website/sw.js`:
```javascript
const CACHE_NAME = 'chronicles-ruthenia-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(response => response || fetch(e.request))
    );
});
```

#### Шаг 3. Регистрировать service worker в HTML

В `<script>` в конце `<body>`:
```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.log('SW failed:', err));
}
```

#### Шаг 4. Загрузить на GitHub

```bash
git add website/manifest.json website/sw.js
git commit -m "feat(website): PWA support"
git push
```

После этого сайт можно «установить» как приложение (Add to Home Screen).

---

## 6. Реальный ID Yandex.Metrika

### Что нужно

Заменить плейсхолдер `00000000` на реальный ID счётчика.

### Шаг 1. Зарегистрировать счётчик

1. Открой https://metrika.yandex.ru/
2. Войди через Yandex ID.
3. Нажми «Добавить счётчик».
4. URL: `https://sosnowda.github.io`
5. Название: «Летописи Руси XV века»
6. Создать → получишь номер счётчика (например, `98765432`).

### Шаг 2. Заменить ID в HTML

В `index.html` найди:
```javascript
ym(00000000, "init", {
```

Замени `00000000` на свой номер (например, `98765432`):
```javascript
ym(98765432, "init", {
```

Также в `<noscript>`:
```html
<img src="https://mc.yandex.ru/watch/98765432" .../>
```

### Шаг 3. Проверить

Через 10-15 минут открой https://metrika.yandex.ru/ — должны появиться
посетители.

---

## 7. Реальный Telegram-канал

### Что нужно

Заменить `href="#"` в Telegram-виджете на реальную ссылку.

### Шаг 1. Создать канал

1. Открой Telegram → Новая группа/канал.
2. Название: «Летописи Руси XV века».
3. Тип: публичный канал.
4. Получишь ссылку вида `https://t.me/chronicles_ruthenia`.

### Шаг 2. Заменить в HTML

В `index.html` найди:
```html
<a href="#" class="telegram-btn">
```

Замени на:
```html
<a href="https://t.me/chronicles_ruthenia" class="telegram-btn" target="_blank" rel="noopener">
```

---

## 8. Чек-лист всех улучшений

### Уже реализовано в index.html:

- [x] Тёмная/светлая тема (🌙/☀️)
- [x] Анимация броска d100 (интерактивный кубик)
- [x] Telegram-виджет (кнопка)
- [x] Yandex.Metrika (плейсхолдер)
- [x] Галерея скриншотов (плейсхолдер + lightbox)
- [x] SVG-иконки вместо эмодзи
- [x] CSS-анимация фона (мерцание свечей)
- [x] Плавная прокрутка
- [x] Кнопка «Наверх»

### Требует ручной работы:

- [ ] Исторические иллюстрации (скачать с Wikimedia Commons → `assets/images/`)
- [ ] Видео-фон в Hero (скачать видео → `assets/video/`)
- [ ] Интерактивная карта Руси (SVG-карта → `assets/rus_map.svg`)
- [ ] Мультиязычность RU/EN (второй HTML или JS-переключатель)
- [ ] PWA: подключить `manifest.json` + создать `sw.js`
- [ ] Реальный ID Yandex.Metrika (зарегистрировать на metrika.yandex.ru)
- [ ] Реальная ссылка Telegram-канала (создать канал)

---

**Версия документа:** 1.0
**Дата:** 9 сентября 2026
**Автор:** Super Z (main agent), по заказу владельца проекта `sosnowda`.

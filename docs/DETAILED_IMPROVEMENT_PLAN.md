# Подробный план доработки сайта и браузерной игры «Летописи Руси XV века»

**Дата анализа:** 14 сентября 2026  
**URL:** https://sosnowda.github.io/  
**Репозиторий:** sosnowda/sosnowda.github.io  
**Основано на:** файле `docs/SITE_ANALYSIS.md` + глубокий аудит кода и контента

---

## 1. КРАТКАЯ СВОДКА ТЕКУЩЕГО СОСТОЯНИЯ

### 1.1. Что есть на сайте (`index.html`, 597 строк / 40 КБ)
- Средневековый стиль (пергамент, золото, киноварь)
- 10 секций: Hero, Об игре, История, Карты, BRP d100, Технологии, Системы, CTA, Демо, Поддержка
- Интерактивный кубик d100
- 2 исторические карты Руси (с lightbox + zoom)
- Yandex.Metrika
- PWA (manifest + service worker)
- SEO (sitemap, robots, JSON-LD VideoGame)
- Кнопки поддержки (Boosty, ЮMoney, VK)

### 1.2. Что есть в игре (`/game/`, 43 модуля, 15 679 строк кода)
- **Движок:** Phaser 3.88.2 (загружается с CDN)
- **14 сцен:** Boot, Title, CharacterSelection, CharacterAppearance, Village, Interior, Fork, Location, Combat, End, Character, CharacterGenerator, TestPage, Loading
- **11 систем:** AudioManager, BRPEngine, Character, CharacterAppearance, DialogueRunner, SaveManager, ScoreManager, SettingsManager, TimeSystem, Tutorial, VirtualControls
- **10 data-модулей:** actionLog, characters, dialogue, interiors, mapLocations, npcNames, npcSchedules, questGenerator, reputation, thief, world
- **Ролевая система:** BRP d100 (полная реализация: skillCheck, rollDamage, applyDamage)
- **Ассеты:** 17 МБ (LPC-генератор 15 МБ, спрайты 856 КБ, тайлы 472 КБ, аудио 520 КБ)
- **Готовые функции:** генератор внешности (6 цветов кожи, 12 волос, 16 курток, 10 штанов, 8 пресетов), 8 локаций, 6 интерьеров, система репутации, брак, торговля, инвентарь

### 1.3. КРИТИЧЕСКИЕ ПРОБЛЕМЫ (найдены при аудите)

| № | Проблема | Где | Влияние |
|---|----------|-----|---------|
| **K1** | **Сайт утверждает, что игра на Godot, но на самом деле Phaser 3.88.2** | index.html: 7 упоминаний "Godot" | Вводит пользователя в заблуждение, SEO-несоответствие |
| **K2** | **Промо-видео (7 МБ) и intro.mp4 (4 МБ) существуют, но не используются на сайте** | assets/video/ | 11 МБ видео простаивают, нет видео-презентации |
| **K3** | **Нет favicon** | корень | Нет иконки во вкладке браузера |
| **K4** | **Нет скриншотов игры на сайте** | — | Пользователь не видит игру до запуска |
| **K5** | **Нет WebP-изображений** | assets/images/ | Карты в JPG (3.3 МБ), можно сжать до 1 МБ через WebP |
| **K6** | **Нет preload критических ресурсов** | index.html | Медленный First Contentful Paint |
| **K7** | **0 aria-меток** | index.html | Плохая доступность (a11y) |
| **K8** | **LPC-ассеты (15 МБ) загружаются только в CharacterGeneratorScene** | game/assets/lpc/ | Если игрок не заходит в генератор — 15 МБ грузятся зря? Нет, они грузятся по требованию. OK. |
| **K9** | **Service Worker НЕ кеширует /game/** | sw.js:38 | Игра не работает офлайн |
| **K10** | **Нет кнопки «Играть в демо» встроенной (iframe)** | index.html:512 | Только ссылка «открыть в новом окне» |

---

## 2. ПОДРОБНЫЙ ПЛАН ДОРАБОТКИ

### Спринт 1: КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (1-2 дня, высокий приоритет)

#### 1.1. Исправить несоответствие Godot → Phaser (K1)
**Файлы:** `index.html` (7 мест)

Заменить все упоминания "Godot" на "Phaser 3" в:
- Строка 105: «игровой движок Godot» → «игровой движок Phaser 3»
- Строка 221: «движок Godot» → «движок Phaser 3»
- Строка 294: «Игровой движок Godot» → «Игровой движок Phaser 3»
- Строка 348: «Godot считает» → «Phaser 3 считает»
- Строка 497: «Godot Engine» → «Phaser 3 Engine»
- Строка 568: «Игровой движок: Godot» → «Игровой движок: Phaser 3»
- Строка 589: убрать SVG-логотип Godot + «Сделано на Godot Engine 4.7.2»

**Также обновить JSON-LD** (строка 26): `"operatingSystem":"Windows"` → `"operatingSystem":"Web Browser"`, добавить `"softwareVersion": "0.1.0-alpha"`

**Трудозатраты:** 30 минут

#### 1.2. Добавить favicon (K3)
**Новые файлы:** `favicon.ico`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`

Использовать иконку ⚔ (уже есть в manifest.json как SVG). Сгенерировать PNG-версии:
```bash
# Из существующего icons.svg или через генерацию
python3 -c "
from PIL import Image, ImageDraw
for size in [16, 32, 192, 512]:
    img = Image.new('RGBA', (size, size), (26, 20, 16, 255))
    # ... рисуем меч
    img.save(f'favicon-{size}.png')
"
```

Добавить в `<head>`:
```html
<link rel="icon" href="favicon-32.png" type="image/png">
<link rel="apple-touch-icon" href="favicon-192.png">
```

**Трудозатраты:** 1 час

#### 1.3. Встроить промо-видео на сайт (K2)
**Файл:** `index.html` (новая секция перед "Об игре")

Добавить секцию с видео-презентацией:
```html
<section class="section" id="trailer">
    <div class="container">
        <div class="section-label">Видеопрезентация</div>
        <h2>Взгляните на мир игры</h2>
        <video controls poster="assets/images/title.jpg" style="max-width:100%;border-radius:12px;box-shadow:var(--shadow-soft);">
            <source src="assets/video/promo.mp4" type="video/mp4">
            Ваш браузер не поддерживает видео.
        </video>
    </div>
</section>
```

**Трудозатраты:** 30 минут

#### 1.4. Добавить preload критических ресурсов (K6)
**Файл:** `index.html` (в `<head>`)

```html
<link rel="preload" href="assets/images/title.jpg" as="image" fetchpriority="high">
<link rel="preload" href="styles.css" as="style">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
```

**Трудозатраты:** 15 минут

---

### Спринт 2: СКРИНШОТЫ И ВИЗУАЛ (2-3 дня, высокий приоритет)

#### 2.1. Создать галерею скриншотов игры (K4)
**Новый каталог:** `assets/screenshots/`

Сгенерировать 6-8 скриншотов из игры:
1. `01-title.png` — главный экран
2. `02-village.png` — деревня с тайлами
3. `03-interior.png` — интерьер дома
4. `04-dialogue.png` — диалог с NPC
5. `05-combat.png` — боевая сцена
6. `06-character.png` — генератор внешности
7. `07-location-river.png` — локация «Река»
8. `08-location-mill.png` — локация «Мельница»

**Как получить:** запустить игру через agent-browser, сделать скриншоты, обрезать до 1280×720.

Добавить секцию на сайт:
```html
<section class="section section-alt" id="screenshots">
    <div class="container">
        <div class="section-label">Галерея</div>
        <h2>Скриншоты игры</h2>
        <div class="screenshots-grid">
            <!-- 8 скриншотов с lightbox -->
        </div>
    </div>
</section>
```

CSS:
```css
.screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
}
.screenshot-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-soft);
    cursor: zoom-in;
    transition: transform 0.3s;
}
.screenshot-card:hover { transform: translateY(-4px); }
.screenshot-card img { width: 100%; display: block; }
```

**Трудозатраты:** 3 часа (генерация + HTML/CSS)

#### 2.2. Конвертировать карты в WebP (K5)
**Файлы:** `assets/images/maps/*.jpg` (3.3 МБ) → `*.webp` (~1 МБ)

```bash
# Конвертация с качеством 85
for f in assets/images/maps/*.jpg; do
    cwebp -q 85 "$f" -o "${f%.jpg}.webp"
done
```

Обновить `index.html`:
```html
<picture>
    <source srcset="assets/images/maps/vida_lyatsky_1542.webp" type="image/webp">
    <img src="assets/images/maps/vida_lyatsky_1542.jpg" alt="..." loading="lazy">
</picture>
```

**Экономия:** ~2.3 МБ (70% уменьшение)

**Трудозатраты:** 1 час

#### 2.3. Параллакс-эффект на hero-секции
**Файл:** `main.js` + `styles.css`

Добавить плавное движение фона при скролле:
```javascript
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    document.querySelector('.hero-image').style.transform = `translateY(${scrolled * 0.3}px)`;
});
```

CSS:
```css
.hero-image-wrap { overflow: hidden; }
.hero-image { transition: transform 0.1s linear; will-change: transform; }
```

**Трудозатраты:** 30 минут

#### 2.4. Анимированные частицы на фоне
**Файл:** `main.js`

Добавить золотые искры, медленно опускающиеся вниз (как в TitleScene игры):
```javascript
function createParticles() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    document.body.appendChild(canvas);
    // ... анимация частиц
}
```

**Трудозатраты:** 2 часа

---

### Спринт 3: ВСТРОЕННОЕ ДЕМО И UX (2-3 дня, средний приоритет)

#### 3.1. Встроить игру через iframe (K10)
**Файл:** `index.html` (секция "Демо")

Заменить кнопку "Открыть в новом окне" на встроенный iframe:
```html
<section class="section section-alt" id="demo">
    <div class="container">
        <div class="section-label">Играй прямо сейчас</div>
        <h2>Браузерное демо</h2>
        <div class="demo-frame-wrap">
            <iframe src="game/index.html" 
                    style="width:100%;aspect-ratio:16/9;border:2px solid var(--gold);border-radius:12px;"
                    allow="fullscreen"
                    loading="lazy">
            </iframe>
            <a href="game/index.html" target="_blank" class="btn-fullscreen">
                ⛶ Открыть на весь экран
            </a>
        </div>
    </div>
</section>
```

**Трудозатраты:** 1 час

#### 3.2. Гамбургер-меню на мобильных
**Файлы:** `index.html`, `styles.css`, `main.js`

Сейчас на мобильных nav-links просто переносятся. Добавить настоящее сворачивающееся меню:
```html
<button class="menu-toggle" aria-label="Меню">☰</button>
<nav class="nav-mobile">
    <!-- ссылки -->
</nav>
```

```javascript
document.querySelector('.menu-toggle').addEventListener('click', () => {
    document.querySelector('.nav-mobile').classList.toggle('open');
});
```

**Трудозатраты:** 2 часа

#### 3.3. Музыка на сайте (опционально)
**Файл:** `index.html` + кнопка включения

Использовать `game/assets/audio/music/music_menu.ogg`:
```html
<audio id="bgMusic" loop>
    <source src="game/assets/audio/music/music_menu.ogg" type="audio/ogg">
</audio>
<button id="musicToggle" aria-label="Музыка">🔊</button>
```

**Трудозатраты:** 1 час

---

### Спринт 4: ДОСТУПНОСТЬ И SEO (1-2 дня, средний приоритет)

#### 4.1. Добавить aria-метки (K7)
**Файл:** `index.html`

```html
<button aria-label="Бросить кубик d100" onclick="rollD100()">
<img alt="..." role="img" aria-describedby="caption-1">
<nav aria-label="Основная навигация">
<main role="main">
<section aria-labelledby="about-heading">
```

**Трудозатраты:** 2 часа

#### 4.2. Улучшить meta-теги
**Файл:** `index.html`

Добавить:
```html
<meta name="keywords" content="RPG, Русь, средневековье, BRP, d100, браузерная игра, Phaser, AI">
<meta name="author" content="sosnowda">
<meta name="theme-color" content="#1A1410">
<meta property="og:title" content="Летописи Руси XV века — AI-narrative RPG">
<meta property="og:description" content="...">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sosnowda.github.io/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
```

**Трудозатраты:** 1 час

#### 4.3. Обновить sitemap.xml
**Файл:** `sitemap.xml`

Добавить новые секции:
```xml
<url><loc>https://sosnowda.github.io/#screenshots</loc></url>
<url><loc>https://sosnowda.github.io/#trailer</loc></url>
<url><loc>https://sosnowda.github.io/#demo</loc></url>
<url><loc>https://sosnowda.github.io/game/</loc></url>
```

**Трудозатраты:** 15 минут

---

### Спринт 5: ИГРОВЫЕ УЛУЧШЕНИЯ (3-5 дней, средний приоритет)

#### 5.1. Кеширование игры в Service Worker (K9)
**Файл:** `sw.js`

Сейчас `/game/` полностью исключён из кеширования. Добавить selective caching:
```javascript
// Кешировать статику игры, но НЕ сцены (для горячей перезагрузки)
if (url.pathname.startsWith('/game/assets/')) {
    // Cache-first для ассетов (они не меняются)
    event.respondWith(
        caches.match(event.request).then(cached => 
            cached || fetch(event.request).then(response => {
                caches.open('game-assets-v1').put(event.request, response.clone());
                return response;
            })
        )
    );
    return;
}
```

**Трудозатраты:** 1 час

#### 5.2. Экран загрузки игры
**Файл:** `game/src/scenes/BootScene.js`

Сейчас прогресс-бар примитивный. Улучшить:
- Анимированный фон (средневековый свиток)
- Логотип игры
- Прогресс-бар в виде меча
- Текст «Загрузка ассетов… X%»

**Трудозатраты:** 3 часа

#### 5.3. Управление звуком в игре
**Файл:** `game/src/systems/AudioManager.js`

Добавить:
- Регулятор громкости (0-100%)
- Кнопка mute/unmute
- Сохранение настроек в localStorage

**Трудозатраты:** 2 часа

#### 5.4. Tutorial для новых игроков
**Файл:** `game/src/systems/Tutorial.js`

Расширить tutorial с 3 до 7 шагов:
1. Движение (WASD/стрелки)
2. Взаимодействие (E/Space)
3. Открытие журнала (J)
4. Карта (M)
5. Диалоги (ЛКМ на NPC)
6. Бой (выбор действия)
7. Выход из локации (ESC)

**Трудозатраты:** 3 часа

---

### Спринт 6: КОНТЕНТНЫЕ УЛУЧШЕНИЯ (2-3 дня, низкий приоритет)

#### 6.1. Раздел «Историческая справка»
**Новая секция в index.html**

Короткие статьи (по 1 абзацу):
- Быт крестьян Руси XV века
- Военное дело
- Религия и церковь
- Торговля и деньги
- Города и крепости

**Трудозатраты:** 4 часа (с поиском фактов)

#### 6.2. Раздел «Команда»
**Новая секция**

```html
<section id="team">
    <h2>Команда проекта</h2>
    <div class="team-card">
        <h3>sosnowda</h3>
        <p>Автор, геймдизайнер, разработчик</p>
        <p>AI-ассистент: Super Z (GLM-4.6)</p>
    </div>
</section>
```

**Трудозатраты:** 1 час

#### 6.3. FAQ
**Новая секция**

5-7 вопросов:
- Что такое BRP d100?
- Какая нейросеть используется?
- Нужно ли скачивать игру?
- Когда релиз?
- Какие системные требования?
- Можно ли играть на мобильном?

**Трудозатраты:** 2 часа

---

### Спринт 7: ПРОИЗВОДИТЕЛЬНОСТЬ (1-2 дня, низкий приоритет)

#### 7.1. Минификация CSS/JS
**Новый build-скрипт**

```bash
# Минификация
npx terser main.js -o main.min.js
npx csso styles.css --output styles.min.css
```

Обновить `index.html`:
```html
<link rel="stylesheet" href="styles.min.css">
<script src="main.min.js" defer></script>
```

**Экономия:** ~30% размера (styles.css 26→18 КБ, main.js 6→4 КБ)

**Трудозатраты:** 1 час

#### 7.2. Lazy loading всех изображений
**Файл:** `index.html`

Добавить `loading="lazy"` ко всем `<img>`, кроме hero:
```html
<img src="..." loading="lazy" decoding="async">
```

**Трудозатраты:** 30 минут

#### 7.3. Critical CSS inline
**Файл:** `index.html`

Встроить критический CSS (above-the-fold) прямо в `<head>`:
```html
<style>
    /* Только то, что нужно для First Paint */
    :root { --bg-dark: #0c0906; ... }
    body { background: var(--bg-dark); ... }
    .hero { ... }
</style>
<link rel="stylesheet" href="styles.css" media="print" onload="this.media='all'">
```

**Трудозатраты:** 2 часа

---

## 3. ПРИОРИТЕТЫ И СРОКИ

### 🔴 Критический приоритет (1-2 дня)
1. **K1:** Исправить Godot → Phaser (30 мин)
2. **K2:** Встроить промо-видео (30 мин)
3. **K3:** Добавить favicon (1 час)
4. **K6:** Preload ресурсов (15 мин)
5. **2.1:** Скриншоты игры (3 часа)

**Итого:** ~5 часов → значительное улучшение доверия и UX

### 🟡 Высокий приоритет (2-3 дня)
6. **K5:** WebP-конвертация карт (1 час)
7. **2.3:** Параллакс hero (30 мин)
8. **3.1:** Встроенный iframe демо (1 час)
9. **3.2:** Гамбургер-меню (2 часа)
10. **4.1:** aria-метки (2 часа)
11. **4.2:** Мета-теги (1 час)

**Итого:** ~8 часов

### 🟢 Средний приоритет (3-5 дней)
12. **2.2:** Анимированные частицы (2 часа)
13. **5.1:** SW-кеширование игры (1 час)
14. **5.2:** Экран загрузки (3 часа)
15. **5.3:** Управление звуком (2 часа)
16. **5.4:** Расширенный tutorial (3 часа)
17. **6.1:** Историческая справка (4 часа)
18. **6.3:** FAQ (2 часа)

**Итого:** ~17 часов

### ⚪ Низкий приоритет (долгосрочно)
19. **3.3:** Музыка на сайте (1 час)
20. **6.2:** Раздел «Команда» (1 час)
21. **7.1:** Минификация (1 час)
22. **7.2:** Lazy loading (30 мин)
23. **7.3:** Critical CSS (2 часа)
24. **4.3:** Sitemap обновление (15 мин)

**Итого:** ~6 часов

---

## 4. КОНТРОЛЬНЫЕ МЕТРИКИ

### До доработки
- Lighthouse Performance: ~60-70 (предполагается)
- Lighthouse Accessibility: ~50 (0 aria-меток)
- Размер index.html: 40 КБ
- Размер styles.css: 26 КБ
- Изображения: 5.3 МБ (JPG)
- Видео: 11 МБ (не используется)
- Офлайн-работа игры: ❌

### После доработки (цель)
- Lighthouse Performance: **85+**
- Lighthouse Accessibility: **90+**
- Размер index.html: **30 КБ** (минифицированный)
- Размер styles.css: **18 КБ** (минифицированный)
- Изображения: **2 МБ** (WebP)
- Видео: 11 МБ (используется, lazy)
- Офлайн-работа игры: ✅ (SW кеширует ассеты)

---

## 5. ЧТО МОЖНО СДЕЛАТЬ СЕЙЧАС (рекомендация)

**Первый шаг (сегодня, 2 часа):**
1. Исправить Godot → Phaser (K1) — 30 мин
2. Добавить favicon (K3) — 1 час
3. Встроить промо-видео (K2) — 30 мин

**Второй шаг (завтра, 4 часа):**
4. Сгенерировать скриншоты игры (2.1) — 3 часа
5. Конвертировать карты в WebP (K5) — 1 час

**Третий шаг (на неделе, 5 часов):**
6. Встроить iframe демо (3.1) — 1 час
7. Гамбургер-меню (3.2) — 2 часа
8. aria-метки (4.1) — 2 часа

После этих 3 шагов сайт станет значительно профессиональнее, и пользователи смогут реально увидеть игру (а не только читать о ней).

---

## 6. ЧЕГО НЕ ДЕЛАТЬ (контр-рекомендации)

- **Не переписывать игру на Godot** — Phaser 3 уже работает, 15 679 строк кода функциональны. Переписывание займёт 2-3 месяца без видимой пользы для пользователя.
- **Не добавлять LLM-нарратор в браузерную демо** — это требует API-ключей и серверной части. Демо должно оставаться клиентским.
- **Не убирать раздел о Godot полностью** — в будущем планируется десктопная версия на Godot. Уточнить формулировку: «Браузерное демо на Phaser 3, десктопная версия планируется на Godot Engine».
- **Не добавлять мультиплеер** — это отдельный большой проект, не относится к текущему демо.

---

## 7. СВЯЗАННЫЕ ДОКУМЕНТЫ

- `docs/SITE_ANALYSIS.md` — исходный файл аудита (143 строки)
- `docs/DEMO_IMPROVEMENT_ROADMAP.md` — дорожная карта доработки демо (664 строки)
- `docs/ASSETS_RESEARCH.md` — исследование ассетов (554 строки)
- `docs/LPC_GENERATOR_INTEGRATION.md` — интеграция LPC-генератора (591 строка)
- `docs/IMPROVEMENT_SUGGESTIONS.md` — предложения по улучшению (170 строк)
- `docs/REPUTATION_SYSTEM.md` — система репутации (159 строк)
- `docs/WEBSITE_ENHANCEMENTS.md` — улучшения сайта (377 строк)
- `game/docs/GAME_DOCUMENTATION.md` — техническая документация игры (600 строк)

---

**Итог:** План охватывает 24 задачи, сгруппированные в 7 спринтов. Критические исправления (5 часов) можно сделать за 1 день. Полная реализация — 5-7 рабочих дней. Главная ценность — устранить несоответствие Godot/Phaser, добавить визуальные материалы (скриншоты, видео), и встроить демо прямо на главную страницу.

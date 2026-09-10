# GITHUB_PAGES_GUIDE.md — Подробная инструкция: создание и размещение рекламного сайта на GitHub Pages

> **Назначение:** пошаговое руководство, как **создать и разместить
> рекламный сайт игры «Летописи Руси XV века»** на платформе **GitHub
> Pages** — бесплатно, с HTTPS, доступный из РФ.
>
> **Основано на:**
> - Официальной документации: https://docs.github.com/ru/pages/quickstart
> - Промпте для сайта: `docs/PROMPT_WEBSITE.md`
> - Анализе готового HTML-кода сайта (от владельца, сентябрь 2026)
>
> **Версия:** 1.0 (9 сентября 2026)

---

## 0. Краткая сводка (TL;DR)

**GitHub Pages** — бесплатный хостинг статических сайтов прямо из
GitHub-репозитория. Идеален для рекламного сайта игры.

**3 способа разместить сайт:**

| Способ | URL | Сложность | Рекомендация |
|---|---|---|---|
| **A. В репозитории проекта** | `sosnowda.github.io/ChroniclesRuthenia/` | ⭐ | ✅ РЕКОМЕНДУЕТСЯ |
| **B. Отдельный репозиторий `username.github.io`** | `sosnowda.github.io/` | ⭐⭐ | для главного сайта |
| **C. Свой домен** | `chronicles-ruthenia.ru` | ⭐⭐⭐ | для серьезного проекта |

**Время:** 10-15 минут (простой способ A).

---

## 1. Анализ GitHub Pages — как правильно создавать и размещать

### 1.1. Что такое GitHub Pages

**GitHub Pages** — сервис GitHub для хостинга статических веб-сайтов
(HTML/CSS/JS) прямо из репозитория. Подходит для:
- Лендингов и рекламных страниц.
- Блогов (через Jekyll).
- Документации проектов.
- Портфолио.

### 1.2. Ограничения (важно!)

| Параметр | Лимит |
|---|---|
| **Размер репозитория** | 1 ГБ |
| **Трафик** | 100 ГБ/месяц |
| **Билды** | 10 в час (soft limit) |
| **Тип контента** | только статика (HTML/CSS/JS) — никакого серверного кода |
| **Коммерческое использование** | разрешено, но не для pure-коммерции (магазин, SaaS) |
| **HTTPS** | автоматически (сертификат Let's Encrypt) |
| **Свой домен** | поддерживается (CNAME) |

### 1.3. Типы сайтов GitHub Pages

1. **User/Organization site** — `username.github.io`
   - Репозиторий: `username.github.io`
   - URL: `https://username.github.io/`
   - Один на аккаунт.

2. **Project site** — `username.github.io/repository-name/`
   - Репозиторий: любой
   - URL: `https://username.github.io/repository-name/`
   - Сколько угодно на аккаунт.

3. **Custom domain** — `yourdomain.com`
   - Нужен домен (платный, ~200₽/год для .ru).
   - CNAME-запись на `username.github.io`.

### 1.4. Источники для GitHub Pages

В настройках репозитория → Settings → Pages → Source:

| Источник | Что значит |
|---|---|
| **Deploy from a branch** | Раз в коммит — пересборка. Ветка + папка. |
| **GitHub Actions** | Кастомный CI/CD пайплайн. |

**Branch + folder варианты:**
- `main` / root — сайт в корне репозитория.
- `main` / `/docs` — сайт в папке `docs/`.
- `gh-pages` / root — отдельная ветка для сайта.

### 1.5. Доступность из РФ

- ✅ `github.io` — **доступен из РФ** без VPN (проверено).
- ⚠️ Скорость может быть ниже (CDN Fastly, часть узлов в РФ загружена).
- ✅ HTTPS работает без проблем.

---

## 2. Подробная инструкция: размещение сайта по PROMPT_WEBSITE

### 2.1. Подготовка

**Что нужно:**
- Аккаунт GitHub (у тебя уже есть: `sosnowda`).
- Готовый HTML-файл сайта (например, `index.html`).
- Git установленный на ПК (или веб-интерфейс GitHub).

### 2.2. Вариант A: сайт в репозитории проекта (РЕКОМЕНДУЕТСЯ)

**Архитектура:**
```
ChroniclesRuthenia/           # главный репозиторий проекта
├── docs/                     # папка для документации
│   └── PROMPT_WEBSITE.md     # промпт для сайта
├── website/                  # ← НОВАЯ папка для сайта
│   ├── index.html            # готовый HTML сайта
│   ├── styles.css            # (если отдельно)
│   ├── script.js             # (если отдельно)
│   └── assets/               # картинки, шрифты, иконки
└── project.godot
```

**URL после размещения:** `https://sosnowda.github.io/ChroniclesRuthenia/website/`

#### Шаг 1. Создать папку `website/` в репозитории

В терминале на твоём ПК:
```powershell
cd C:\ChroniclesRuthenia
mkdir website
# Скопировать готовый index.html в website\
# (или создать новый по PROMPT_WEBSITE.md)
```

#### Шаг 2. Настроить GitHub Pages на папку `website/`

1. Открой https://github.com/sosnowda/ChroniclesRuthenia/settings/pages
2. **Source:** `Deploy from a branch`
3. **Branch:** `main` / папка `/website`
4. Нажми **Save**.

#### Шаг 3. Загрузить файлы сайта

```powershell
cd C:\ChroniclesRuthenia
git add website/
git commit -m "feat(website): рекламный сайт игры на GitHub Pages"
git push origin main
```

#### Шаг 4. Дождаться билда (1-2 минуты)

1. Открой https://github.com/sosnowda/ChroniclesRuthenia/actions
2. Найди последний workflow `pages-build-deployment`.
3. Дождись зелёной галочки.

#### Шаг 5. Открыть сайт

URL: `https://sosnowda.github.io/ChroniclesRuthenia/website/`

Готово! Сайт доступен по этому адресу.

### 2.3. Вариант B: отдельный репозиторий `username.github.io`

Если хочешь, чтобы сайт был на корневом URL `https://sosnowda.github.io/`:

#### Шаг 1. Создать репозиторий `sosnowda.github.io`

1. https://github.com/new
2. Repository name: `sosnowda.github.io` (строго так!)
3. Public
4. Create repository.

#### Шаг 2. Клонировать и добавить сайт

```powershell
cd C:\
git clone https://github.com/sosnowda/sosnowda.github.io.git
cd sosnowda.github.io
# Скопировать index.html и assets/ сюда
git add .
git commit -m "initial website"
git push origin main
```

#### Шаг 3. Настроить GitHub Pages

1. https://github.com/sosnowda/sosnowda.github.io/settings/pages
2. Source: `main` / root
3. Save.

#### Шаг 4. Открыть сайт

URL: `https://sosnowda.github.io/`

### 2.4. Вариант C: свой домен (опционально)

Если хочешь `chronicles-ruthenia.ru`:

#### Шаг 1. Купить домен

- Reg.ru: https://www.reg.ru/domain/search/?q=chronicles-ruthenia (199₽/год первый год)
- Timeweb: https://timeweb.com/services/domains
- Beget: https://beget.com/domains

#### Шаг 2. Настроить DNS

В панели регистратора:
- `@ CNAME sosnowda.github.io`
- `www CNAME sosnowda.github.io`

#### Шаг 3. Указать домен в GitHub

1. https://github.com/sosnowda/ChroniclesRuthenia/settings/pages
2. Custom domain: `chronicles-ruthenia.ru`
3. Save.
4. Поставить галочку **Enforce HTTPS**.

#### Шаг 4. Создать файл CNAME в репозитории

```powershell
cd C:\ChroniclesRuthenia\website
echo chronicles-ruthenia.ru > CNAME
git add CNAME
git commit -m "feat(website): custom domain"
git push origin main
```

DNS обновляется 1-24 часа. После — сайт доступен на `https://chronicles-ruthenia.ru/`.

---

## 3. Создание сайта по PROMPT_WEBSITE.md

### 3.1. Структура сайта

Согласно `docs/PROMPT_WEBSITE.md`, сайт должен содержать 11 разделов:

1. **Hero** (первый экран)
2. Что это за игра?
3. Как это работает (схема)
4. Историческая эпоха (таймлайн)
5. Ролевая система BRP
6. ИИ-стек (3 режима)
7. Галерея / арты
8. Roadmap
9. Разработчик
10. FAQ
11. Подвал + CTA + подписка

### 3.2. Готовый HTML (от владельца)

Владелец прислал готовый HTML-код сайта (915 строк). Он уже реализует
большую часть PROMPT_WEBSITE:
- ✅ Hero с заголовком «Летописи Руси XV века»
- ✅ Секция «Об игре» — Симбиоз математики и творчества
- ✅ Features-grid (6 карточек: RAG, BRP, LLM, бои, мир, память)
- ✅ Технологический блок
- ✅ Исторические периоды (Василий I, Василий II, Иван III)
- ✅ 20 ключевых особенностей
- ✅ Финальный CTA + footer

### 3.3. Что нужно добавить/исправить

По сравнению с PROMPT_WEBSITE, в готовом HTML не хватает:

1. **Секция «ИИ-стек»** (3 режима: локальный, облачный, офлайн-заглушка) —
   добавить секцию с таблицей.
2. **Секция «Roadmap»** — таймлайн готово/в работе/план.
3. **Секция «Разработчик»** — мини-био sosnowda.
4. **Секция «FAQ»** — аккордеон с частыми вопросами.
5. **Форма подписки** — email input в подвале.
6. **SEO meta-tags** — `<title>`, `<meta name="description">`, Open Graph.
7. **Аналитика** — Yandex.Metrika (для РФ).

### 3.4. Использование готового HTML

Если хочешь использовать готовый HTML «как есть» — просто:
1. Скопируй его в `website/index.html`.
2. Закоммить и настрой GitHub Pages (см. §2.2).
3. Сайт будет доступен на `https://sosnowda.github.io/ChroniclesRuthenia/website/`.

---

## 4. Анализ кода сайта (от владельца) — проблема с иллюстрациями

### 4.1. Что прислал владелец

Файл: `index.html` (915 строк, 41 КБ) — чистый HTML с встроенным CSS.

### 4.2. Структура сайта

```
<head>
  <style>
    /* CSS с переменными, анимациями, секциями */
    /* Палитра: --bg-dark, --gold, --red, --text-dim */
  </style>
</head>
<body>
  <div class="bg-pattern"></div>
  <header class="header">...</header>
  <section class="hero">...</section>
  <section class="section" id="about">...</section>
  <section class="section section-alt" id="tech">...</section>
  <section class="section" id="history">...</section>
  <section class="section section-alt" id="systems">...</section>
  <section class="cta-section">...</section>
  <footer class="footer">...</footer>
</body>
```

### 4.3. Иллюстрации — АНАЛИЗ

**ВЛАДЕЛЕЦ СООБЩИЛ:** «иллюстрации взяты из сюжета о Гарри Поттере и на
картинке видна магическая палочка!»

**АНАЛИЗ КОДА:**

В присланном `index.html` **НЕТ внешних изображений** (`.png`, `.jpg`,
`.svg` файлов). Все «иллюстрации» — это:

1. **Эмодзи** (Unicode-символы):
   - ⚔️ (меч) — в логотипе, кнопках CTA, секции «Реалистичные бои»
   - 📜 (свиток) — секция «RAG-База Исторических Данных»
   - 🧮 (счёты) — секция «BRP Universal Game Engine d100»
   - 🤖 (робот) — секция «LLM-Нарратор»
   - 🌍 (земной шар) — секция «Живой исторический мир»
   - 💾 (дискета) — секция «Умное управление памятью»
   - ◆ (ромб) — буллеты в тех-секции

2. **SVG-паттерн фона** (data URI):
   ```
   data:image/svg+xml,%3Csvg width='60' height='60'...
   ```
   Это абстрактный геометрический паттерн (знаки `+`), не иллюстрация.

3. **CSS-градиенты** — радиальные градиенты в hero-секции (красный +
   золотой), не изображения.

**ВЫВОД:** В присланном коде **нет иллюстраций из Гарри Поттера** и нет
магической палочки. Возможно, речь о другой версии сайта — или об
отдельной странице, не присланном `index.html`.

### 4.4. Что могло произойти

**Вариант 1:** Владелец видел **другую версию сайта** (например, с
AI-генерированными иллюстрациями), а прислал только HTML без картинок.

**Вариант 2:** Иллюстрации были в отдельных файлах (`.png`/`.jpg`),
которые не вошли в присланый HTML.

**Вариант 3:** Речь об эмодзи ⚔️ — если его отрендерить на некоторых
системах, он может выглядеть как палочка. Но это стандартный Unicode
«Crossed Swords» (U+2694), не имеет отношения к Гарри Поттеру.

### 4.5. Рекомендации по иллюстрациям

Если нужны **исторически достоверные иллюстрации** для сайта:

#### Источники (Public Domain / свободные):

1. **Wikimedia Commons** — https://commons.wikimedia.org/
   - Поиск: «Russia 15th century», «Russian chronicle», «Ivan III»
   - Все изображения Public Domain (старинные гравюры, миниатюры).

2. **Лицевой летописный свод** (XVI в.) — оцифрованные миниатюры:
   - https://commons.wikimedia.org/wiki/Category:Illustrated_Chronicle_of_Ivan_the_Terrible

3. **Библиотека Ленина** — оцифрованные летописи:
   - https://www.rsl.ru/

4. **AI-генерация** (Stable Diffusion / Midjourney):
   - Промпт: `15th century Russian chronicle illustration, ink on
     parchment, muted earth tones, no text, photorealistic`
   - ⚠️ Осторожно: AI может сгенерировать «Гарри Поттера» если в
     промпте есть слова «wand», «magic», «wizard». Избегать таких слов.

#### Запреты:

- ❌ **Не использовать** кадры из фильмов о Гарри Поттере.
- ❌ **Не использовать** современное фэнтези-арт (эльфы, магия, драконы).
- ❌ **Не использовать** изображения с водяными знаками без лицензии.
- ❌ **Не использовать** фотографии современных реконструкций (если
  нет разрешения автора).

#### Что подходит:

- ✅ Древнерусские миниатюры (Лицевой летописный свод).
- ✅ Гравюры XV-XVII веков.
- ✅ Иконы XV века (стилизация под Андрея Рублёва).
- ✅ Карты Руси XV века.
- ✅ Фотографии исторического оружия и доспехов (из музеев).
- ✅ Строго исторические сцены: битвы, пиры, крестьяне, купцы.

---

## 5. Чек-лист размещения сайта

- [ ] Готов `index.html` (из присланного кода или новый по PROMPT_WEBSITE)
- [ ] Папка `website/` создана в репозитории `ChroniclesRuthenia`
- [ ] Файлы сайта скопированы в `website/`
- [ ] `git add website/ && git commit && git push`
- [ ] В GitHub: Settings → Pages → Source: `main` / `/website`
- [ ] Дождаться билда (1-2 мин) — Actions → зелёная галочка
- [ ] Открыть `https://sosnowda.github.io/ChroniclesRuthenia/website/`
- [ ] (Опционально) Купить домен `.ru` и настроить CNAME
- [ ] (Опционально) Добавить Yandex.Metrika
- [ ] (Опционально) Добавить SEO meta-tags

---

## 6. Типовые проблемы

### Сайт не открывается (404)

1. Проверь что GitHub Pages включён: Settings → Pages → Source задан.
2. Проверь что `index.html` в правильной папке (`website/`).
3. Дождись билда (Actions → pages-build-deployment → зелёная галочка).
4. URL правильный: `https://sosnowda.github.io/ChroniclesRuthenia/website/`
   (с `/website/` в конце, если папка `website/`).

### Иллюстрации не отображаются

1. Проверь пути: `<img src="assets/hero.png">` — файл должен быть в
   `website/assets/hero.png`.
2. GitHub Pages чувствителен к регистру: `Hero.png` ≠ `hero.png`.
3. Файлы картинок должны быть закоммичены: `git add website/assets/`.

### Сайт медленно грузится из РФ

- GitHub Pages CDN (Fastly) иногда медленный в РФ.
- Решение: использовать Cloudflare перед GitHub Pages (но осторожно —
  Cloudflare нестабилен в РФ, см. `docs/HOSTING_OPTIONS.md`).
- Альтернатива: хостинг на Yandex Cloud Object Storage (см.
  `docs/HOSTING_OPTIONS.md` Связка №2).

### Свой домен не работает

1. DNS-запись CNAME: `@ CNAME sosnowda.github.io`
2. В GitHub: Settings → Pages → Custom domain → ввести домен.
3. Файл `CNAME` в папке `website/` с доменом.
4. Подожди 1-24 часа (DNS propagation).
5. Поставь Enforce HTTPS.

### HTTPS не работает

1. Подожди 15-30 минут после настройки (сертификат Let's Encrypt
   перевыпускается).
2. Settings → Pages → Enforce HTTPS — поставить галочку.

---

## 7. Альтернативы GitHub Pages

Если GitHub Pages не подходит (медленно из РФ, лимиты и т.п.):

| Хостинг | РФ | Бесплатно | Свой домен | См. документ |
|---|---|---|---|---|
| **GitHub Pages** | ✅ (медленно) | ✅ | ✅ | эта инструкция |
| **Yandex Cloud Object Storage** | ✅ | грант 4000₽ | ✅ | `docs/HOSTING_OPTIONS.md` §1.8 |
| **Beget** | ✅ | 30 дней проба | ✅ (платно) | `docs/HOSTING_OPTIONS.md` §1.5 |
| **Timeweb** | ✅ | 10 дней проба | ✅ (платно) | `docs/HOSTING_OPTIONS.md` §1.6 |
| **localtunnel** (временный) | ✅ | ✅ | ❌ | `docs/AGENT_REMOTE_CONTROL.md` §1.1 |

Подробности — в `docs/HOSTING_OPTIONS.md`.

---

## 8. Связанные документы

- `docs/PROMPT_WEBSITE.md` — промпт для рекламного сайта (11 разделов)
- `docs/HOSTING_OPTIONS.md` — все варианты хостинга (включая РФ)
- `docs/PROMPT_PROMO_VIDEO.md` — промпт для промо-ролика
- `docs/AGENT_REMOTE_CONTROL.md` — варианты туннелей

---

## 9. Ссылки

### 9.1. GitHub Pages
- **Quickstart (RU):** https://docs.github.com/ru/pages/quickstart
- **Документация:** https://docs.github.com/ru/pages
- **Ограничения:** https://docs.github.com/ru/pages/getting-started-with-github-pages/about-github-pages#limits-on-use-of-github-pages
- **Custom domains:** https://docs.github.com/ru/pages/configuring-a-custom-domain-for-your-github-pages-site

### 9.2. Источники иллюстраций (Public Domain)
- **Wikimedia Commons:** https://commons.wikimedia.org/
- **Лицевой летописный свод:** https://commons.wikimedia.org/wiki/Category:Illustrated_Chronicle_of_Ivan_the_Terrible
- **Библиотека Ленина:** https://www.rsl.ru/
- **The Metropolitan Museum of Art (Open Access):** https://www.metmuseum.org/about-the-met/policies-and-documents/image-resources
- **Rijksmuseum (Open Access):** https://www.rijksmuseum.nl/en/rijksstudio

### 9.3. AI-генерация иллюстраций
- **Stable Diffusion:** https://stability.ai/
- **Midjourney:** https://www.midjourney.com/
- **Промпты для исторических иллюстраций:**
  `15th century Russian chronicle illustration, ink on parchment,
  muted earth tones, no text, photorealistic, no magic, no fantasy,
  historical accuracy, medieval Russian style`

---

**Версия документа:** 1.0
**Дата:** 9 сентября 2026
**Автор:** Super Z (main agent), по заказу владельца проекта `sosnowda`.

**Итог:**
- GitHub Pages — лучший бесплатный вариант для рекламного сайта.
- Связка A (сайт в `website/` папке репозитория) — самая простая.
- Готовый HTML от владельца — рабочий, нужно добавить секции (FAQ,
  Roadmap, подписка) и исторические иллюстрации (НЕ из Гарри Поттера).
- Для иллюстраций — Wikimedia Commons (Public Domain) или AI-генерация
  с правильными промптами (без слов «wand», «magic», «wizard»).

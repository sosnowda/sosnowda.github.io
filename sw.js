/* Service Worker — Летописи Руси XV века
   Network-first для HTML/CSS/JS, cache-first для ассетов игры
   и вендор-библиотек (/game/vendor/ — с 66.64).
*/

// ----- Журнал версий кэша -----
// 66.47 (аудит лендинга, п.14): журнал перенесён в docs/SW_CHANGELOG.md —
// ~200 строк комментариев раздували Service Worker. Новые записи о версиях
// добавляются в docs/SW_CHANGELOG.md и CHANGES.md, но НЕ в этот файл.

// 66.74 (приказы владельца 1–18, новая волна навыков): бамп v114→v115 —
// исходники game/src/** (10 новых навыков, burglary.js/jobs.js, сундуки,
// борть, пасека-мёд) и game/index.html не трогали ассеты и vendor —
// game-assets-v43 без изменений.
// 66.77 (приказы владельца 1–6): краденое — скупка −80% (отдельная кучка
// узла), ткачество только для женского персонажа; бамп v117→v118 —
// исходники game/src/** (loot.js/InteriorScene.js/questGenerator.js/i18n.js),
// ассеты и vendor не тронуты — game-assets-v43 цел.
// 66.86 (приказы владельца 1–4): бамп v120→v121 — HTML/JS лендинга
// (галерея без 10-го кадра) и game/src (housesFX, BootScene-кочка,
// CraftAudio); бамп game-assets-v44→v45 — 11 фасадов fb_*.png (дымницы),
// 4 тайла травы + pasture, deco_spinning.png и 2 интерьера (копыл).
// 66.88 (приказы владельца 1–4): бамп v121→v122 — en/index.html
// (P3-1 аудита 66.87: h1 EN-лендинга переведён на монолингвальный
// английский «The Chronicles of Ruthenia — a 15th-century Rus' RPG»);
// game-assets-v45 цел (ассеты не тронуты), код sw.js не менялся.
// 66.90 (аудит: P1+P2): бамп v122→v123 — styles.css (P1: body
// overflow-x hidden→clip, sticky шапки/полосы сбора починен; P2: контраст
// --text-muted/--gold-dim по WCAG AA), index.html + en/index.html (P2
// PF-2 аудита 66.88: srcset героя 480/960/1280w + imagesrcset в preload)
// и 3 новых ассета assets/images/title-{480,960,1280}.webp (сайт —
// network-first, список прекеша не ведётся); game-assets-v45 цел,
// код sw.js не менялся.
// 66.91 (P3-хвост аудита): бамп v123→v124 — index.html + en/index.html
// (JPEG-фолбэк героя title-1280.jpg 137КБ вместо title.jpg 2МБ, JSON-LD
// inLanguage, aria-hidden декоративных emoji, css2 без курсивного PT Serif)
// и js/modules (ui.js + l10n.js — aria-label бургера в такт aria-expanded);
// удалены мёртвые ассеты (2 AVIF-карты без ссылок в разметке, title.jpg) —
// сайт network-first, список прекеша не ведётся; game-assets-v45 цел,
// код sw.js не менялся.
// 66.92 (PF-1+PF-4 аудита 66.88 + находка замера): бамп v124→v125 —
// game/index.html (+регистрация SW — прямые посетители игры теперь
// получают SW, повторный визит из кэша game-assets-v45), index.html +
// en/index.html (постер промо-видео title.webp 188 КиБ → title-1280.webp
// 82 КиБ — двойная загрузка героя устранена), js/modules/reveal.js
// (два прохода чтение→запись, длинная задача ~234 мс устранена);
// game-assets-v45 цел (ассеты не тронуты), код sw.js не менялся.
// 66.93 (эшелон 1 аудита игры): бамп v125→v126 — game/index.html
// (input: { activePointers: 2 } — P1-3: второй тач-поинтер, движение +
// взаимодействие/атака одновременно) и game/src (meal.js — импорт tf P1-1,
// VirtualControls — двойное срабатывание кнопки E P1-2, CombatScene —
// dodge врагов P2-1 / busy в playerAttack P2-2 / защёлка __victoryQueued
// P2-3, TimeSystem — кламп advanceTime P2-20); game-assets-v45 цел
// (ассеты не тронуты), код sw.js не менялся.
// 66.94 (эшелон 2 аудита игры): бамп v126→v127 — game/src (VillageScene +
// VirtualControls — снятие scale-подписок P2-6, InteriorScene — сброс
// флагов меню P2-7 и возврат источников света P2-8, LocationScene —
// живой HP в HUD P2-9, BootScene — loaderror + сторож прелоада P2-10,
// WorldLook/CharacterSelectionScene — сброс npc-кэша новой партии P2-15);
// game-assets-v45 цел (ассеты не тронуты), код sw.js не менялся.
// 66.95 (эшелон 3 аудита игры): бамп v127→v128 — game/src (боевой хвост
// P2-4/5, гигиена P2-11…14, обвязка P2-16…19 — полный список в CHANGES.md
// 66.95); game-assets-v45 цел, код sw.js не менялся.
// 66.96 (§12.3 аудита — стратегические рефакторинги): бамп v128→v129 —
// game/src (НОВЫЕ модули systems/gameCalendar.js, systems/OutdoorLocationBase.js,
// utils/MenuPanel.js; правки 20 модулей календаря + Forest/Apiary/InteriorScene/
// jobs/Weather/TimeSystem/AccessHours — полный список в CHANGES.md 66.96);
// /game/src/ идёт мимо SW (network direct) — прекеш-список не нужен;
// game-assets-v45 цел (ассеты не тронуты), код sw.js не менялся.
const CACHE_NAME = 'chronicles-ruthenia-v129';
const GAME_ASSETS_CACHE = 'game-assets-v45';

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.map(function (k) {
                    if (k !== CACHE_NAME && k !== GAME_ASSETS_CACHE) return caches.delete(k);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // ВНЕШНИЕ запросы (CDN, другие домены) — пропускаем напрямую
    if (url.origin !== self.location.origin) {
        return;
    }

    // /game/assets/ и /game/vendor/ — cache-first (ассеты и вендор-библиотеки
    // не меняются между релизами; vendor появился в 66.64 — самохостинг Phaser,
    // аудит 66.61 P3-4; game-assets-v42 — новый бакет под новую ветку маршрута)
    if (url.pathname.startsWith('/game/assets/') || url.pathname.startsWith('/game/vendor/')) {
        event.respondWith(
            caches.open(GAME_ASSETS_CACHE).then(function (cache) {
                return cache.match(event.request).then(function (cached) {
                    if (cached) {
                        // Фоновое обновление
                        fetch(event.request).then(function (response) {
                            if (response && response.status === 200) {
                                cache.put(event.request, response.clone());
                            }
                        }).catch(function () {});
                        return cached;
                    }
                    return fetch(event.request).then(function (response) {
                        if (response && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(function () {
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // /game/src/ — пропускаем напрямую (сцены обновляются часто)
    if (url.pathname.startsWith('/game/src/')) {
        return;
    }

    // Same-origin (сайт) — network-first
    event.respondWith(
        fetch(event.request).then(function (response) {
            if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, clone).catch(function () {});
                });
            }
            return response;
        }).catch(function () {
            return caches.match(event.request).then(function (cached) {
                // Офлайн-фолбэк по разделам (аудит P2-1, 66.53) — только НАВИГАЦИЯМ
                // (P3-3, аудит 66.56): субресурсы (js/css/картинки) при офлайн-промахе
                // кэша получают честный сетевой отказ вместо HTML-лендинга,
                // который вызвал бы MIME/Syntax-ошибку в консоли.
                if (event.request.mode !== 'navigate') return cached;
                // /game/ → игра, /en/ → EN-лендинг, остальное → RU; '/' — второй эшелон,
                // т.к. ключ '/index.html' появляется редко (посетители идут на '/')
                const fb = url.pathname.indexOf('/game/') === 0 ? '/game/'
                       : url.pathname.indexOf('/en/') === 0 ? '/en/' : '/index.html';
                return cached || caches.match(fb).then(function (m) {
                    return m || caches.match('/');
                });
            });
        })
    );
});

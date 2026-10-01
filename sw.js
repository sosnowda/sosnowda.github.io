/* Service Worker — Летописи Руси XV века
   Network-first для HTML/CSS/JS, cache-first для ассетов игры.
*/

// ----- Журнал версий кэша -----
// 66.47 (аудит лендинга, п.14): журнал перенесён в docs/SW_CHANGELOG.md —
// ~200 строк комментариев раздували Service Worker. Новые записи о версиях
// добавляются в docs/SW_CHANGELOG.md и CHANGES.md, но НЕ в этот файл.

var CACHE_NAME = 'chronicles-ruthenia-v102';
var GAME_ASSETS_CACHE = 'game-assets-v41';

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

    var url = new URL(event.request.url);

    // ВНЕШНИЕ запросы (CDN, другие домены) — пропускаем напрямую
    if (url.origin !== self.location.origin) {
        return;
    }

    // /game/assets/ — cache-first (ассеты не меняются между релизами)
    if (url.pathname.startsWith('/game/assets/')) {
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
                var clone = response.clone();
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
                var fb = url.pathname.indexOf('/game/') === 0 ? '/game/'
                       : url.pathname.indexOf('/en/') === 0 ? '/en/' : '/index.html';
                return cached || caches.match(fb).then(function (m) {
                    return m || caches.match('/');
                });
            });
        })
    );
});

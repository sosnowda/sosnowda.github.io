/* Service Worker — Летописи Руси XV века
   Network-first для HTML/CSS/JS, cache-first для ассетов игры.

   v6 — релиз: хроника, реальные скриншоты webp, фикс пола интерьеров (зелёная сетка), фикс сцены внешности. → шрифты Prata+PT Serif, og-image, reveal без no-JS-пустоты;

v4 — добавлено кеширование /game/assets/ (cache-first).
   Сцены игры (/game/src/) НЕ кешируются — для горячей перезагрузки. */

var CACHE_NAME = 'chronicles-ruthenia-v9';
var GAME_ASSETS_CACHE = 'game-assets-v1';

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
                return cached || caches.match('/index.html');
            });
        })
    );
});

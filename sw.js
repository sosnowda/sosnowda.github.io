/* Service Worker — Летописи Руси XV века
   Network-first, но ТОЛЬКО для same-origin (своих файлов).
   Внешние CDN (unpkg, jsdelivr) — пропускаем напрямую, не перехватываем. */

var CACHE_NAME = 'chronicles-ruthenia-v3';

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.map(function (k) {
                    if (k !== CACHE_NAME) return caches.delete(k);
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

    // ВНЕШНИЕ запросы (CDN, другие домены) — пропускаем напрямую, НЕ перехватываем
    if (url.origin !== self.location.origin) {
        return;
    }

    // Same-origin — network-first
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

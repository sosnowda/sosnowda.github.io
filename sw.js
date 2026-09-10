/* Service Worker — Летописи Руси XV века (Chronicles of Ruthenia)
   Network-first: сначала сеть, при ошибке — кеш. */

var CACHE_NAME = 'chronicles-ruthenia-v2';

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

    event.respondWith(
        fetch(event.request).then(function (response) {
            // Успешный ответ — кешируем и отдаём
            if (response && response.status === 200 && response.type === 'basic') {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, clone).catch(function () {});
                });
            }
            return response;
        }).catch(function () {
            // Оффлайн — отдаём из кеша
            return caches.match(event.request).then(function (cached) {
                return cached || caches.match('/index.html');
            });
        })
    );
});

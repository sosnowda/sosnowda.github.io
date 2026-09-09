/* Service Worker — Летописи Руси XV века (Chronicles of Ruthenia)
   Базовый offline-кеш: app-shell + статические ассеты. */

var CACHE_NAME = 'chronicles-ruthenia-v1';
var APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/images/title.jpg',
  '/assets/video/intro.mp4',
  '/assets/video/promo.mp4'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () {});
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone).catch(function () {});
          });
        }
        return response;
      }).catch(function () {
        return caches.match('/index.html');
      });
    })
  );
});

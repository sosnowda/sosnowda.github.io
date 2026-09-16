/* Service Worker — Летописи Руси XV века
   Network-first для HTML/CSS/JS, cache-first для ассетов игры.

   v6 — релиз: хроника, реальные скриншоты webp, фикс пола интерьеров (зелёная сетка), фикс сцены внешности. → шрифты Prata+PT Serif, og-image, reveal без no-JS-пустоты;

v18 — релиз: любые разрешения экрана (Scale.RESIZE), EN генератора/интерьеров, баня/овин, единая Пасека с охотой.

v19 — релиз: охота на вора — много-локационная ПОГОНЯ на тиках времени: вор бежит через две случайные локации, оставляя следы; каждое действие игрока (дорога/поиск/разговор/вход в дом) продвигает вора; наводки селян (Красноречие), встреча с вором в локации (спрайт + диалог: напасть / оглушить / убедить), возврат иконы старосте или священнику за награду, победа НЕ завершает игру — староста и жители дают процедурные поручения (выполнение + награда). Сетка кнопок диалогов 2×N (чинит обрез подписей при 4+ вариантах).
v20 — релиз: раунд 22 по 15 пунктам владельца: погоня расширена до ТРЁХ локаций; тики вора идут и при ходьбе по деревне (1 мин/шаг); расспрос — один раз на NPC (меню диалога скрывает использованный вариант); следы обследуются один раз (успех = где вор сейчас; провал = поиск вслепую — текст предупреждения); побег игрока из боя → вор перебегает в случайную локацию и получает +2 тика; смерть в ЛЮБОМ бою = проигрыш; отдых в таверне (1 час ~1/3 лечения за 4д., 8 часов полное восстановление за 12д., ваучер ночлега); благословение священника (+10 к ОДНОЙ проверке навыка); баланс врагов (явные навыки атаки 40-50% вместо автопопаданий ~160%), сыщик подравнен; сроки поручений живут по мировому времени (просрочка = провал), лимиты расширены до проходимых, награды крестьянина/вдовы подняты; воск-квест перенесён на пасеку, стража у ворот исправлена (была невыполнима).
v21 — релиз: раунд 23 по 5 пунктам владельца: ваучер ночлега УДАЛЕН (отдых только за деньги); бой лицом к лицу (фикс флипа героя, боковые враги и волк); полная озвучка боя из DarklandsReborn: удары оружием (4 вариации), промахи (2), удары по щиту/доспехам, падение поверженного, вой волка при встрече с волками; уникальная внешность NPC: при каждом новом старте у каждого жителя свой цвет одежды и рост (перекраска спрайта и портрета попиксельно, кожа не трогается).
v22 — релиз: раунд 24 (ассеты DarklandsReborn): живописные портреты для ВСЕХ NPC (староста, священник, тавернщик, кузнец, вдова, знахарка, охотник, стражник, рыбак, крестьянин, вор, рассказчик — 1024² webp, показ в 96px, перекрашиваются под уникальный облик каждого старта); эмбиент локаций — день/ночь в деревне и лесу (птицы, сверчки, гул толпы), гомон и звон посуды в таверне; музыка таверны и церкви (тяжёлые треки догружаются в фоне ПОСЛЕ загрузки меню — не задерживают старт и не попадают в precache); новые SFX: скрип двери при входе/выходе, колокол в церкви, молитва при благословении, звон монет при награде и покупках.


v17 — релиз: все скриншоты пересняты из актуальной игры (июньский полдень: деревня с ригой/амбаром, таверна с солнечными столбами, бой с волками, погост, внешность, мельница, пасека — 9 кадров); из раздела «Исторические карты Руси» удалена интерактивная карта игровой округи (остались только подлинные исторические карты).

v4 — добавлено кеширование /game/assets/ (cache-first).
   Сцены игры (/game/src/) НЕ кешируются — для горячей перезагрузки. */

var CACHE_NAME = 'chronicles-ruthenia-v22';
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

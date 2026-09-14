// Плавная прокрутка по якорям (раунд 10: content-visibility-safe)
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        var id = this.getAttribute('href').slice(1);
        var target = id && document.getElementById(id);
        if (target) {
            e.preventDefault();
            // Обновляем hash (глубокие ссылки и история браузера) без прыжка
            history.pushState(null, '', '#' + id);
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Секции с content-visibility дорендериваются после прыжка и
            // сдвигают цель — запускаем коррекцию позиционирования.
            if (typeof window.__anchorSettle === 'function') window.__anchorSettle();
        }
        // href="#" (логотип) — нативный переход вверх без исключений
    });
});

// Service Worker (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function(){});
}

// Интерактивный дайс d100
// Локализация результатов по языку документа (страница EN — /en/)
var D100_I18N = (document.documentElement.lang || 'ru').toLowerCase().indexOf('ru') === 0
    ? { rolling: 'Бросаем…', luck: 'Удача!', special: 'Особый!', success: 'Успех', fail: 'Провал!', tail: ' (выпало {r} из 100)' }
    : { rolling: 'Rolling…', luck: 'Luck!', special: 'Special!', success: 'Success', fail: 'Failure!', tail: ' (rolled {r} of 100)' };
var d100IsRolling = false;
function rollD100() {
    if (d100IsRolling) return;
    d100IsRolling = true;
    var sphere = document.getElementById('d100Sphere');
    var result = document.getElementById('d100Result');
    var degree = document.getElementById('d100Degree');
    if (!sphere || !result || !degree) { d100IsRolling = false; return; }
    sphere.classList.remove('rolling');
    void sphere.offsetWidth;
    sphere.classList.add('rolling');
    result.textContent = '?';
    degree.textContent = D100_I18N.rolling;
    degree.style.color = '';
    setTimeout(function() {
        var roll = Math.floor(Math.random() * 100) + 1;
        var deg, cls;
        if (roll <= 5) { deg = D100_I18N.luck; cls = 'crit'; }
        else if (roll <= 20) { deg = D100_I18N.special; cls = 'special'; }
        else if (roll <= 95) { deg = D100_I18N.success; cls = 'success'; }
        else { deg = D100_I18N.fail; cls = 'fail'; }
        result.textContent = roll;
        degree.textContent = deg + D100_I18N.tail.replace('{r}', roll);
        degree.style.color = (cls === 'crit' || cls === 'special') ? '#e0c078' : (cls === 'fail' ? '#c44' : '');
        sphere.classList.remove('rolling');
        d100IsRolling = false;
    }, 700);
}

// Флаг наличия JS: reveal-анимации применяются только если JS работает.
// Без JS страница полностью видима (прогрессивное улучшение).
document.documentElement.classList.add('js');

// Анимация появления секций при скролле (no-JS safe + prefers-reduced-motion)
document.addEventListener('DOMContentLoaded', function() {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) return; // контент просто виден

    var sections = document.querySelectorAll('section, .feature-card, .epoch-card, .detailed-item, .map-card');
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    sections.forEach(function(el) {
        // Прячем только то, что ещё НЕ во вьюпорте — первый экран всегда виден
        var rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) return;
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // ============================================================
    // SCROLLSPY: подсветка активного раздела в навигации (раунд 9)
    // ============================================================
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    var spyTargets = [];
    navLinks.forEach(function(a) {
        var sec = document.getElementById(a.getAttribute('href').slice(1));
        if (sec) spyTargets.push({ link: a, sec: sec });
    });
    if (spyTargets.length) {
        // Порядок ссылок в меню не совпадает с порядком секций в документе —
        // сортируем цели по позиции в DOM, иначе «последняя прошедшая» считается неверно.
        spyTargets.sort(function(x, y) {
            return x.sec.compareDocumentPosition(y.sec) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
        var spyTicking = false;
        var setActive = function(id) {
            spyTargets.forEach(function(t) {
                var on = t.sec.id === id;
                t.link.classList.toggle('active', on);
                if (on) t.link.setAttribute('aria-current', 'true');
                else t.link.removeAttribute('aria-current');
            });
        };
        // Детерминированный spy: активна последняя секция, чей верх прошёл
        // порог под шапкой. В отличие от intersectionRatio не зависит от
        // высоты секций (высокие секции раньше «проигрывали» коротким соседям).
        var spyUpdate = function() {
            spyTicking = false;
            var offset = 140; // высота шапки + запас
            var current = spyTargets[0].sec.id;
            for (var i = 0; i < spyTargets.length; i++) {
                if (spyTargets[i].sec.getBoundingClientRect().top <= offset) {
                    current = spyTargets[i].sec.id;
                }
            }
            setActive(current);
        };
        // «Хвостовые» пересчёты: при прыжке по якорю пропущенные секции с
        // content-visibility:auto дорендериваются ПОСЛЕ прыжка и сдвигают
        // контент под фиксированной позицией скролла — событие scroll уже
        // не придёт. Две отложенные коррекции ловят финальное состояние.
        var spyTrail1 = 0, spyTrail2 = 0;
        var spyQueue = function() {
            if (!spyTicking) {
                spyTicking = true;
                requestAnimationFrame(spyUpdate);
            }
            clearTimeout(spyTrail1);
            clearTimeout(spyTrail2);
            spyTrail1 = setTimeout(spyUpdate, 160);
            spyTrail2 = setTimeout(spyUpdate, 480);
        };
        window.addEventListener('scroll', spyQueue, { passive: true });
        window.addEventListener('resize', spyQueue, { passive: true });
        window.addEventListener('load', function() {
            spyUpdate();
            setTimeout(spyUpdate, 600);
        });
        spyUpdate();
    }

    // ============================================================
    // КОРРЕКЦИЯ ЯКОРНОЙ НАВИГАЦИИ (content-visibility, раунд 10)
    // Секции ниже первого экрана с content-visibility:auto при прыжке по
    // якорю рендерятся ПОСЛЕ прыжка и сдвигают цель вниз на сотни пикселей —
    // браузер остаётся на оценочной позиции. Повторно наводим на цель,
    // пока раскладка не устаканится. Ручной скролл пользователя отменяет.
    // ============================================================
    (function () {
        var anchorTimers = [];
        var anchorCancelled = false;
        function correctAnchor() {
            if (anchorCancelled) return;
            var hash = location.hash;
            if (!hash || hash.length < 2) return;
            var target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (!target) return;
            var margin = parseInt(getComputedStyle(target).scrollMarginTop, 10) || 0;
            var top = target.getBoundingClientRect().top;
            if (Math.abs(top - margin) > 4) {
                window.scrollTo({ top: window.scrollY + top - margin, behavior: 'instant' });
            }
        }
        function scheduleSettle() {
            anchorCancelled = false;
            anchorTimers.forEach(clearTimeout);
            // Ранние прыжки: раскладка догружается (картинки, шрифты,
            // content-visibility) и после короткого окна коррекций.
            // Растянутое расписание + перезапуск по load (ниже) добивают цель.
            anchorTimers = [80, 260, 550, 900, 1400, 2000, 2700, 3500].map(function (d) {
                return setTimeout(correctAnchor, d);
            });
        }
        window.addEventListener('hashchange', scheduleSettle);
        window.addEventListener('popstate', scheduleSettle); // назад/вперёд при pushState-навигации
        window.addEventListener('load', function () {
            if (location.hash && location.hash.length > 1) scheduleSettle();
        });
        // Экспорт для обработчика якорных кликов (выше) — он preventDefault-ит,
        // поэтому hashchange не срабатывает и коррекцию нужно звать напрямую
        window.__anchorSettle = scheduleSettle;
        // Клик по якорной ссылке той же страницы (hash может не измениться)
        document.addEventListener('click', function (e) {
            var node = e.target;
            while (node && node !== document) {
                if (node.tagName === 'A' && (node.getAttribute('href') || '').charAt(0) === '#') {
                    scheduleSettle();
                    return;
                }
                node = node.parentNode;
            }
        });
        // Ручной скролл пользователя отменяет коррекцию до следующего перехода
        ['wheel', 'touchstart'].forEach(function (evt) {
            window.addEventListener(evt, function () { anchorCancelled = true; }, { passive: true });
        });
        scheduleSettle(); // прямая загрузка с #hash в URL
    })();

    // ============================================================
    // УВЕЛИЧЕНИЕ КАРТ ПРИ КЛИКЕ (LIGHTBOX)
    // ============================================================
    var mapImages = document.querySelectorAll('.map-card img');
    var lightbox = document.createElement('div');
    lightbox.id = 'mapLightbox';
    lightbox.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;padding:2rem;';
    lightbox.innerHTML = '<img src="" alt="" style="max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);"><div style="position:absolute;top:1rem;right:2rem;color:#c9a961;font-size:2rem;cursor:pointer;">×</div>';
    document.body.appendChild(lightbox);

    var lbImg = lightbox.querySelector('img');
    var lbClose = lightbox.querySelector('div');
    var zoomLevel = 1;

    function openLightbox(src, alt) {
        lbImg.src = src;
        lbImg.alt = alt;
        zoomLevel = 1;
        lbImg.style.transform = 'scale(1)';
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }

    mapImages.forEach(function(img) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function() {
            openLightbox(this.src, this.alt);
        });
    });

    lbClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox();
    });

    // П.1: При повторном клике на увеличенную карту — возврат к прежнему размеру
    lbImg.addEventListener('click', function(e) {
        e.stopPropagation();
        if (zoomLevel > 1) {
            // Возврат к 1:1
            zoomLevel = 1;
            translateX = 0;
            translateY = 0;
            lbImg.style.transform = 'scale(1)';
        } else {
            // Увеличение
            zoomLevel = 2;
            lbImg.style.transform = 'scale(2)';
        }
    });

    // Зум колесом мыши
    lightbox.addEventListener('wheel', function(e) {
        e.preventDefault();
        if (e.deltaY < 0) zoomLevel = Math.min(zoomLevel + 0.2, 4);
        else zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
        lbImg.style.transform = 'scale(' + zoomLevel + ')';
    });

    // Перетаскивание при зуме
    var isDragging = false;
    var startX, startY, translateX = 0, translateY = 0;
    lbImg.addEventListener('mousedown', function(e) {
        if (zoomLevel > 1) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            lbImg.style.cursor = 'grabbing';
        }
    });
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            lbImg.style.transform = 'scale(' + zoomLevel + ') translate(' + translateX + 'px, ' + translateY + 'px)';
        }
    });
    document.addEventListener('mouseup', function() {
        isDragging = false;
        lbImg.style.cursor = '';
    });
});

// ============================================================
// НОВЫЕ ФУНКЦИИ (улучшения сайта)
// ============================================================

// Гамбургер-меню для мобильных
document.addEventListener('DOMContentLoaded', function() {
    var toggle = document.querySelector('.mobile-menu-toggle');
    var nav = document.querySelector('.nav-links');
    if (toggle && nav) {
        toggle.addEventListener('click', function() {
            var isOpen = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', !isOpen);
            nav.classList.toggle('open');
        });
        // Закрыть меню при клике на ссылку
        nav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                toggle.setAttribute('aria-expanded', 'false');
                nav.classList.remove('open');
            });
        });
    }

    // Lightbox для скриншотов
    var screenshots = document.querySelectorAll('.screenshot-card');
    if (screenshots.length > 0) {
        var slb = document.createElement('div');
        slb.className = 'screenshot-lightbox';
        slb.innerHTML = '<span class="screenshot-lightbox-close" aria-label="Закрыть">×</span><img src="" alt="">';
        document.body.appendChild(slb);
        var slbImg = slb.querySelector('img');
        var slbClose = slb.querySelector('.screenshot-lightbox-close');

        screenshots.forEach(function(card) {
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', 'Открыть скриншот: ' + (card.querySelector('.screenshot-caption')?.textContent || ''));
            card.addEventListener('click', function() {
                var src = card.getAttribute('data-src');
                slbImg.src = src;
                slb.classList.add('open');
                document.body.style.overflow = 'hidden';
            });
            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });

        function closeSlb() {
            slb.classList.remove('open');
            document.body.style.overflow = '';
        }
        slbClose.addEventListener('click', closeSlb);
        slb.addEventListener('click', function(e) {
            if (e.target === slb) closeSlb();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && slb.classList.contains('open')) closeSlb();
        });
    }

    // Параллакс для hero-изображения
    var heroImg = document.querySelector('.hero-image');
    if (heroImg) {
        var ticking = false;
        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    var scrolled = window.pageYOffset;
                    if (scrolled < 600) {
                        heroImg.style.transform = 'translateY(' + scrolled * 0.3 + 'px)';
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    // Золотые частицы на фоне (как в TitleScene игры)
    var particleCanvas = document.createElement('canvas');
    particleCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.4;';
    particleCanvas.id = 'particles-canvas';
    document.body.appendChild(particleCanvas);
    var pctx = particleCanvas.getContext('2d');
    function resizeCanvas() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    var particles = [];
    for (var i = 0; i < 30; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            r: 1 + Math.random() * 2,
            vy: 0.2 + Math.random() * 0.4,
            alpha: 0.3 + Math.random() * 0.4
        });
    }

    function animateParticles() {
        pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particles.forEach(function(p) {
            pctx.beginPath();
            pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            pctx.fillStyle = 'rgba(201, 169, 97, ' + p.alpha + ')';
            pctx.fill();
            p.y += p.vy;
            if (p.y > particleCanvas.height) {
                p.y = -10;
                p.x = Math.random() * particleCanvas.width;
            }
        });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();

    // Отслеживание событий для аналитики (Yandex.Metrika)
    if (typeof ym === 'function') {
        // Клик на запуск игры
        document.querySelectorAll('a[href*="game/index.html"]').forEach(function(link) {
            link.addEventListener('click', function() {
                ym(112435792, 'reachGoal', 'game_launch');
            });
        });
        // Бросок кубика d100
        var d100 = document.getElementById('d100Dice');
        if (d100) {
            d100.addEventListener('click', function() {
                ym(112435792, 'reachGoal', 'd100_roll');
            });
        }
        // Открытие видео
        var video = document.querySelector('#trailer video');
        if (video) {
            video.addEventListener('play', function() {
                ym(112435792, 'reachGoal', 'video_play');
            });
        }
        // Открытие скриншота
        document.querySelectorAll('.screenshot-card').forEach(function(card) {
            card.addEventListener('click', function() {
                ym(112435792, 'reachGoal', 'screenshot_view');
            });
        });
    }
});

// ===== Интерактивная SVG-карта Руси (секция «Исторические карты») =====
(function () {
    var svg = document.querySelector('.rus-map');
    if (!svg) return;
    var panelTitle = document.getElementById('rusMapTitle');
    var panelDesc = document.getElementById('rusMapDesc');
    var panelDanger = document.getElementById('rusMapDanger');
    var markers = Array.prototype.slice.call(svg.querySelectorAll('.rus-marker'));

    function select(marker) {
        markers.forEach(function (m) {
            m.classList.remove('active');
            m.setAttribute('aria-pressed', 'false');
        });
        marker.classList.add('active');
        marker.setAttribute('aria-pressed', 'true');
        if (panelTitle) panelTitle.textContent = (marker.getAttribute('data-icon') || '') + ' ' + (marker.getAttribute('data-name') || '');
        if (panelDesc) panelDesc.textContent = marker.getAttribute('data-desc') || '';
        if (panelDanger) {
            var isRu = (document.documentElement.lang || 'ru').toLowerCase().indexOf('ru') === 0;
            var d = marker.getAttribute('data-danger') || 'low';
            panelDanger.textContent = isRu
                ? (d === 'medium' ? '⚠ Опасность: средняя' : (d === 'high' ? '☠ Опасность: высокая' : '✓ Опасность: низкая'))
                : (d === 'medium' ? '⚠ Danger: medium' : (d === 'high' ? '☠ Danger: high' : '✓ Danger: low'));
            panelDanger.className = 'rus-map-danger rus-danger-' + d;
        }
        // Достижение для Метрики: интересуются картой мира
        if (typeof ym === 'function') {
            ym(112435792, 'reachGoal', 'rus_map_location');
        }
    }

    markers.forEach(function (m) {
        m.addEventListener('click', function () { select(m); });
        m.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(m);
            }
        });
    });

    var first = svg.querySelector('.rus-marker[data-default="1"]') || markers[0];
    if (first) select(first);
})();

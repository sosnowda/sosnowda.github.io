// main.js — лендинг «Летописи Руси XV века» (RU и EN страницы).
// 66.31 (приказ владельца): const/let вместо var (п.7), золотые частицы —
// reduced-motion и пауза в скрытой вкладке (п.2), фокус-трап попапа поддержки
// (п.4), интерактивный таймлайн князей (п.8), события кликов по донат-ссылкам
// с UTM-кампаниями в Метрику (п.5).
//
// Плавная прокрутка по якорям (раунд 10: content-visibility-safe)
document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
        const id = this.getAttribute('href').slice(1);
        const target = id && document.getElementById(id);
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
    navigator.serviceWorker.register('/sw.js').catch(function () { });
}

// «Уменьшить движение» — один раз на страницу (частицы, параллакс, скроллы)
const REDUCED_MOTION = (function () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
})();

// Язык страницы (для попапа поддержки, таймлайна князей и аналитики)
const IS_EN_PAGE = (document.documentElement.lang || 'ru').toLowerCase().indexOf('en') === 0;

// Интерактивный дайс d100
// Локализация результатов по языку документа (страница EN — /en/)
const D100_I18N = (document.documentElement.lang || 'ru').toLowerCase().indexOf('ru') === 0
    ? { rolling: 'Бросаем…', luck: 'Удача!', special: 'Особый!', success: 'Успех', fail: 'Провал!', tail: ' (выпало {r} из 100)' }
    : { rolling: 'Rolling…', luck: 'Luck!', special: 'Special!', success: 'Success', fail: 'Failure!', tail: ' (rolled {r} of 100)' };
let d100IsRolling = false;
function rollD100() {
    if (d100IsRolling) return;
    d100IsRolling = true;
    const sphere = document.getElementById('d100Sphere');
    const result = document.getElementById('d100Result');
    const degree = document.getElementById('d100Degree');
    if (!sphere || !result || !degree) { d100IsRolling = false; return; }
    sphere.classList.remove('rolling');
    void sphere.offsetWidth;
    sphere.classList.add('rolling');
    result.textContent = '?';
    degree.textContent = D100_I18N.rolling;
    degree.style.color = '';
    setTimeout(function () {
        const roll = Math.floor(Math.random() * 100) + 1;
        let deg, cls;
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
document.addEventListener('DOMContentLoaded', function () {
    const reduced = REDUCED_MOTION;
    if (reduced || !('IntersectionObserver' in window)) {
        // контент просто виден — но интерактив (ниже) инициализировать надо
        initInteractivePage(reduced);
        return;
    }

    const sections = document.querySelectorAll('section, .feature-card, .epoch-card, .detailed-item, .map-card');
    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    sections.forEach(function (el) {
        // Прячем только то, что ещё НЕ во вьюпорте — первый экран всегда виден
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) return;
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    initInteractivePage(reduced);

    // ============================================================
    // SCROLLSPY: подсветка активного раздела в навигации (раунд 9)
    // ============================================================
    const navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    const spyTargets = [];
    navLinks.forEach(function (a) {
        const sec = document.getElementById(a.getAttribute('href').slice(1));
        if (sec) spyTargets.push({ link: a, sec: sec });
    });
    if (spyTargets.length) {
        // Порядок ссылок в меню не совпадает с порядком секций в документе —
        // сортируем цели по позиции в DOM, иначе «последняя прошедшая» считается неверно.
        spyTargets.sort(function (x, y) {
            return x.sec.compareDocumentPosition(y.sec) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
        let spyTicking = false;
        const setActive = function (id) {
            spyTargets.forEach(function (t) {
                const on = t.sec.id === id;
                t.link.classList.toggle('active', on);
                if (on) t.link.setAttribute('aria-current', 'true');
                else t.link.removeAttribute('aria-current');
            });
        };
        // Детерминированный spy: активна последняя секция, чей верх прошёл
        // порог под шапкой. В отличие от intersectionRatio не зависит от
        // высоты секций (высокие секции раньше «проигрывали» коротким соседям).
        const spyUpdate = function () {
            spyTicking = false;
            const offset = 140; // высота шапки + запас
            let current = spyTargets[0].sec.id;
            for (let i = 0; i < spyTargets.length; i++) {
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
        let spyTrail1 = 0, spyTrail2 = 0;
        const spyQueue = function () {
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
        window.addEventListener('load', function () {
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
        let anchorTimers = [];
        let anchorCancelled = false;
        function correctAnchor() {
            if (anchorCancelled) return;
            const hash = location.hash;
            if (!hash || hash.length < 2) return;
            const target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (!target) return;
            const margin = parseInt(getComputedStyle(target).scrollMarginTop, 10) || 0;
            const top = target.getBoundingClientRect().top;
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
            let node = e.target;
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
    const mapImages = document.querySelectorAll('.map-card img');
    const lightbox = document.createElement('div');
    lightbox.id = 'mapLightbox';
    lightbox.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;padding:2rem;';
    lightbox.innerHTML = '<img src="" alt="" style="max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);"><div style="position:absolute;top:1rem;right:2rem;color:#c9a961;font-size:2rem;cursor:pointer;">×</div>';
    document.body.appendChild(lightbox);

    const lbImg = lightbox.querySelector('img');
    const lbClose = lightbox.querySelector('div');
    // Заявлены ДО обработчиков (66.31: const/let — у var была всплыть-магия)
    let zoomLevel = 1;
    let startX = 0, startY = 0, translateX = 0, translateY = 0;

    function openLightbox(src, alt) {
        lbImg.src = src;
        lbImg.alt = alt;
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        lbImg.style.transform = 'scale(1)';
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }

    mapImages.forEach(function (img) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function () {
            openLightbox(this.src, this.alt);
        });
    });

    lbClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox();
    });

    // П.1: При повторном клике на увеличенную карту — возврат к прежнему размеру
    lbImg.addEventListener('click', function (e) {
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
    lightbox.addEventListener('wheel', function (e) {
        e.preventDefault();
        if (e.deltaY < 0) zoomLevel = Math.min(zoomLevel + 0.2, 4);
        else zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
        lbImg.style.transform = 'scale(' + zoomLevel + ')';
    });

    // Перетаскивание при зуме
    let isDragging = false;
    lbImg.addEventListener('mousedown', function (e) {
        if (zoomLevel > 1) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            lbImg.style.cursor = 'grabbing';
        }
    });
    document.addEventListener('mousemove', function (e) {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            lbImg.style.transform = 'scale(' + zoomLevel + ') translate(' + translateX + 'px, ' + translateY + 'px)';
        }
    });
    document.addEventListener('mouseup', function () {
        isDragging = false;
        lbImg.style.cursor = '';
    });
});

// ============================================================
// ОБЩИЙ ИНТЕРАКТИВНЫЙ БЛОК СТРАНИЦЫ
// (выполняется и при reduced-motion, и при отсутствии IO)
// ============================================================
function initInteractivePage(reducedMotion) {

    // Гамбургер-меню для мобильных
    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav-links');
    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            const isOpen = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', !isOpen);
            nav.classList.toggle('open');
        });
        // Закрыть меню при клике на ссылку
        nav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                toggle.setAttribute('aria-expanded', 'false');
                nav.classList.remove('open');
            });
        });
    }

    // ============================================================
    // ЛАЙТБОКС ГАЛЕРЕИ СО СТРЕЛКАМИ (раунд 66.6, приказ владельца):
    // клик по скриншоту — полноэкранный просмотр; стрелки ‹ › и
    // клавиши ←/→ листают кадры, Esc закрывает, свайп работает
    // на тач-экранах; счётчик «3 / 9»; подпись берётся из карточки
    // (автоматически локализуется на EN-версии страницы).
    // ============================================================
    const screenshots = document.querySelectorAll('.screenshot-card');
    if (screenshots.length > 0) {
        const L10N = IS_EN_PAGE
            ? { prev: 'Previous screenshot (Left arrow)', next: 'Next screenshot (Right arrow)',
                close: 'Close (Esc)', counter: 'Screenshot {i} of {n}' }
            : { prev: 'Предыдущий скриншот (стрелка влево)', next: 'Следующий скриншот (стрелка вправо)',
                close: 'Закрыть (Esc)', counter: 'Скриншот {i} из {n}' };

        const slb = document.createElement('div');
        slb.className = 'screenshot-lightbox';
        slb.setAttribute('role', 'dialog');
        slb.setAttribute('aria-modal', 'true');
        slb.setAttribute('aria-label', L10N.counter.replace('{i}', '1').replace('{n}', String(screenshots.length)));
        slb.innerHTML = ''
            + '<button type="button" class="slb-btn slb-close" aria-label="' + L10N.close + '">×</button>'
            + '<button type="button" class="slb-btn slb-prev" aria-label="' + L10N.prev + '">‹</button>'
            + '<figure class="slb-figure">'
            +   '<img src="" alt="">'
            +   '<figcaption class="slb-caption"></figcaption>'
            + '</figure>'
            + '<button type="button" class="slb-btn slb-next" aria-label="' + L10N.next + '">›</button>'
            + '<div class="slb-counter" aria-live="polite"></div>';
        document.body.appendChild(slb);

        const slbImg = slb.querySelector('img');
        const slbCaption = slb.querySelector('.slb-caption');
        const slbCounter = slb.querySelector('.slb-counter');
        let slbIndex = 0;
        let slbLastFocus = null;

        function slbShow(i) {
            const n = screenshots.length;
            slbIndex = ((i % n) + n) % n;   // закольцевать: после 9-го — 1-й
            const card = screenshots[slbIndex];
            const caption = card.querySelector('.screenshot-caption');
            slbImg.src = card.getAttribute('data-src');
            slbImg.alt = (card.querySelector('img') && card.querySelector('img').alt) || '';
            slbCaption.textContent = caption ? caption.textContent : '';
            slbCounter.textContent = L10N.counter
                .replace('{i}', String(slbIndex + 1))
                .replace('{n}', String(n));
            slb.setAttribute('aria-label', slbCounter.textContent);
        }
        function openSlb(i) {
            slbLastFocus = document.activeElement;
            slbShow(i);
            slb.classList.add('open');
            document.body.style.overflow = 'hidden';
            slb.querySelector('.slb-close').focus();
        }
        function closeSlb() {
            slb.classList.remove('open');
            document.body.style.overflow = '';
            if (slbLastFocus && slbLastFocus.focus) slbLastFocus.focus();
        }
        function stepSlb(delta) {
            slbShow(slbIndex + delta);
        }

        screenshots.forEach(function (card, idx) {
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', 'Открыть скриншот: ' + (card.querySelector('.screenshot-caption')?.textContent || ''));
            card.addEventListener('click', function () { openSlb(idx); });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSlb(idx);
                }
            });
        });

        slb.querySelector('.slb-close').addEventListener('click', closeSlb);
        slb.querySelector('.slb-prev').addEventListener('click', function () { stepSlb(-1); });
        slb.querySelector('.slb-next').addEventListener('click', function () { stepSlb(1); });
        slb.addEventListener('click', function (e) {
            if (e.target === slb) closeSlb();
        });
        document.addEventListener('keydown', function (e) {
            if (!slb.classList.contains('open')) return;
            if (e.key === 'Escape') closeSlb();
            else if (e.key === 'ArrowLeft') stepSlb(-1);
            else if (e.key === 'ArrowRight') stepSlb(1);
        });

        // Свайп влево/вправо на тач-экранах
        let touchX = null, touchY = null;
        slb.addEventListener('touchstart', function (e) {
            touchX = e.changedTouches[0].clientX;
            touchY = e.changedTouches[0].clientY;
        }, { passive: true });
        slb.addEventListener('touchend', function (e) {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            const dy = e.changedTouches[0].clientY - touchY;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) stepSlb(dx < 0 ? 1 : -1);
            touchX = touchY = null;
        }, { passive: true });
    }

    // Параллакс для hero-изображения (66.31: выключен при reduced-motion —
    // батарея телефонов и уважение к настройке пользователя)
    const heroImg = document.querySelector('.hero-image');
    if (heroImg && !reducedMotion) {
        let ticking = false;
        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    const scrolled = window.pageYOffset;
                    if (scrolled < 600) {
                        heroImg.style.transform = 'translateY(' + scrolled * 0.3 + 'px)';
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    // ============================================================
    // Золотые частицы на фоне (как в TitleScene игры)
    // 66.31 (п.2): батарея телефонов — при prefers-reduced-motion частиц
    // нет вовсе; в скрытой вкладке RAF-цикл останавливается полностью и
    // запускается заново при возврате (проверка на видимость в каждом кадре).
    // ============================================================
    if (!reducedMotion) {
        const particleCanvas = document.createElement('canvas');
        particleCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.4;';
        particleCanvas.id = 'particles-canvas';
        document.body.appendChild(particleCanvas);
        const pctx = particleCanvas.getContext('2d');
        function resizeCanvas() {
            particleCanvas.width = window.innerWidth;
            particleCanvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const particles = [];
        for (let i = 0; i < 30; i++) {
            particles.push({
                x: Math.random() * particleCanvas.width,
                y: Math.random() * particleCanvas.height,
                r: 1 + Math.random() * 2,
                vy: 0.2 + Math.random() * 0.4,
                alpha: 0.3 + Math.random() * 0.4
            });
        }

        let particlesRafId = 0;
        let particlesRunning = false;
        function animateParticles() {
            // Скрытая вкладка: цикл замирает (батарея), возврат — оживляет
            if (document.visibilityState === 'hidden') {
                particlesRunning = false;
                return;
            }
            pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            particles.forEach(function (p) {
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
            particlesRafId = requestAnimationFrame(animateParticles);
        }
        function startParticles() {
            if (!particlesRunning) {
                particlesRunning = true;
                particlesRafId = requestAnimationFrame(animateParticles);
            }
        }
        startParticles();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                particlesRunning = false;
                cancelAnimationFrame(particlesRafId);
            } else {
                startParticles();
            }
        });
    }

    // ============================================================
    // ПОПАП ПОДДЕРЖКИ (п.4): закрытие с клавиатуры + ФОКУС-ТРАП.
    // Открытие оставлено в разметке (inline onclick) — работает и без
    // пересборки; здесь добавляется доступность: Esc закрывает, Tab ходит
    // только по элементам попапа, при открытии фокус уходит внутрь, при
    // закрытии возвращается на полоску сбора средств.
    // ============================================================
    (function () {
        const popup = document.getElementById('fundPopup');
        const bar = document.querySelector('.fund-bar');
        if (!popup) return;
        const closeBtn = popup.querySelector('.fund-popup-close');
        const focusablesSel = 'a[href], button:not([disabled])';

        function isOpen() { return popup.classList.contains('open'); }
        function openPopup() {
            if (!isOpen()) popup.classList.add('open');
            // фокус в попап — с клавиатуры сразу видно, где мы
            setTimeout(function () {
                const first = popup.querySelector(focusablesSel);
                if (first) first.focus();
            }, 0);
        }
        function closePopup() {
            if (isOpen()) popup.classList.remove('open');
            // вернуть фокус на полоску — продолжаем с того же места
            if (bar && typeof bar.focus === 'function') bar.focus();
        }
        const syncExpanded = function (val) {
            if (bar) bar.setAttribute('aria-expanded', val ? 'true' : 'false');
        };

        if (bar) {
            // Полоска — интерактивный элемент: роль + клавиатурное открытие
            bar.setAttribute('role', 'button');
            bar.setAttribute('tabindex', '0');
            bar.setAttribute('aria-haspopup', 'dialog');
            bar.setAttribute('aria-expanded', 'false');
            bar.addEventListener('click', function () { openPopup(); syncExpanded(true); });
            bar.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openPopup();
                    syncExpanded(true);
                }
            });
        }
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', IS_EN_PAGE ? 'Close support dialog' : 'Закрыть окно поддержки');
            closeBtn.addEventListener('click', function () { closePopup(); syncExpanded(false); });
        }
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');
        if (!popup.getAttribute('aria-labelledby')) {
            const h3 = popup.querySelector('h3');
            if (h3) {
                if (!h3.id) h3.id = 'fundPopupTitle';
                popup.setAttribute('aria-labelledby', h3.id);
            }
        }
        // Фон попапа (клик мимо окна) закрывает и снимает aria-expanded
        popup.addEventListener('click', function (e) {
            if (e.target === popup) {
                closePopup();
                if (bar) bar.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('keydown', function (e) {
            if (!isOpen()) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                closePopup();
                if (bar) bar.setAttribute('aria-expanded', 'false');
                return;
            }
            if (e.key !== 'Tab') return;
            // ФОКУС-ТРАП: Tab/Shift+Tab ходят только внутри попапа
            const items = Array.prototype.filter.call(
                popup.querySelectorAll(focusablesSel),
                function (el) { return el.offsetParent !== null; }
            );
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    })();

    // ============================================================
    // ИНТЕРАКТИВНЫЙ ТАЙМЛАЙН КНЯЗЕЙ (п.8).
    // Лента 1400–1505: три правления — клик по отрезку (или карточке
    // эпохи) подсвечивает княженье, показывает досье и подсвечивает
    // события хроники внутри этих лет, докручивая ленту к первому из них.
    // Полностью клавиатурный (кнопки) и локализованный (RU/EN).
    // ============================================================
    (function () {
        const timeline = document.getElementById('princesTimeline');
        if (!timeline) return;

        const T = IS_EN_PAGE ? {
            hint: 'Select a prince on the ribbon — 105 years of the era between them.',
            reignLabel: 'Reign',
            eventsHit: { one: '1 chronicle event highlighted', many: '{n} chronicle events highlighted' },
            none: 'No chronicle events in these years — they are recorded in the village legends.',
        } : {
            hint: 'Выберите князя на ленте — между ними 105 лет эпохи.',
            reignLabel: 'Правление',
            eventsHit: { one: 'Подсвечено 1 событие хроники', many: 'Подсвечено событий: {n}' },
            none: 'В эти годы хроника молчит — они записаны в деревенских преданиях.',
        };

        const DOSIER = {
            vasily1: IS_EN_PAGE ? {
                name: 'Vasily I Dmitriyevich',
                years: 'Grand Prince 1389–1425',
                text: 'Continued gathering the lands: Nizhny Novgorod joined Moscow (1392). Withstood Edigu\u2019s raid (1408) and fortified Moscow with a new kremlin. Rus\u2019 still paid tribute to the Horde, but already chose which khan to carry it to.'
            } : {
                name: 'Василий I Дмитриевич',
                years: 'Великий князь 1389–1425',
                text: 'Продолжил собирание земель: Нижний Новгород присоединён к Москве (1392). Отразил нашествие Едигея (1408), укрепил Москву новым кремлём. Дань Орде Русь платит, но уже сама выбирает, какому из ханов её везти.'
            },
            vasily2: IS_EN_PAGE ? {
                name: 'Vasily II the Dark',
                years: 'Grand Prince 1425–1462',
                text: 'The feudal war of 1425–1453: struggle against Yuri of Zvenigorod and Vasily the Cross-Eyed for the throne. Blinded in 1446, yet kept the grand princedom; in 1448 the Russian Church became autocephalous. Passed the throne to his son Ivan III.'
            } : {
                name: 'Василий II «Тёмный»',
                years: 'Великий князь 1425–1462',
                text: 'Феодальная война 1425–1453: борьба с Юрием Звенигородским и Василием Косым за престол. Ослеплён в 1446 году, но удержал великое княжение; в 1448 Русская церковь стала автокефальной. Престол передал сыну Ивану III.'
            },
            ivan3: IS_EN_PAGE ? {
                name: 'Ivan III the Great',
                years: 'Grand Prince 1462–1505',
                text: 'Cast off the Horde yoke (Stand on the Ugra, 1480), annexed Novgorod (1478), issued the Law Code of 1497 and raised the new Moscow Kremlin. First «Sovereign of All Rus\u2019».'
            } : {
                name: 'Иван III «Великий»',
                years: 'Великий князь 1462–1505',
                text: 'Сверг ордынское иго (Стояние на Угре, 1480), присоединил Новгород (1478), издал Судебник (1497) и поставил новый Московский Кремль. Первый «Государь всея Руси».'
            },
        };

        const reignBtns = Array.prototype.slice.call(timeline.querySelectorAll('.pt-reign'));
        const detail = timeline.querySelector('.pt-detail');
        const detailName = timeline.querySelector('.pt-detail-name');
        const detailYears = timeline.querySelector('.pt-detail-years');
        const detailText = timeline.querySelector('.pt-detail-text');
        const epochCards = Array.prototype.slice.call(document.querySelectorAll('.epoch-card[data-prince]'));
        const chronicleStrip = document.querySelector('.chronicle-strip');
        const chronicleCards = chronicleStrip
            ? Array.prototype.slice.call(chronicleStrip.querySelectorAll('.chronicle-card[data-year]'))
            : [];

        // Начальное состояние — подсказка
        if (detailText) detailText.textContent = T.hint;

        function selectPrince(id, scrollStrip) {
            const d = DOSIER[id];
            if (!d) return;
            let activeBtn = null;
            reignBtns.forEach(function (b) {
                const on = b.getAttribute('data-prince') === id;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                if (on) activeBtn = b;
            });
            epochCards.forEach(function (c) {
                const on = c.getAttribute('data-prince') === id;
                c.classList.toggle('active', on);
                c.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            if (detailName) detailName.textContent = d.name;
            if (detailYears) detailYears.textContent = d.years;
            if (detailText) detailText.textContent = d.text;

            // Подсветка событий хроники внутри княженья
            // (границы лет — data-from/data-to кнопки на ленте)
            const from = activeBtn ? parseInt(activeBtn.getAttribute('data-from'), 10) : NaN;
            const to = activeBtn ? parseInt(activeBtn.getAttribute('data-to'), 10) : NaN;
            if (!isNaN(from) && !isNaN(to) && chronicleStrip) {
                let hits = 0;
                let firstCard = null;
                chronicleCards.forEach(function (card) {
                    const y = parseInt(card.getAttribute('data-year'), 10);
                    const inReign = y >= from && y <= to;
                    card.classList.toggle('pt-hit', inReign);
                    if (inReign) {
                        hits++;
                        if (!firstCard) firstCard = card;
                    }
                });
                if (hits > 0 && firstCard && scrollStrip !== false) {
                    // Приводим первое событие княженья к началу ленты
                    try {
                        firstCard.scrollIntoView({
                            behavior: reducedMotion ? 'instant' : 'smooth',
                            inline: 'start', block: 'nearest',
                        });
                    } catch (e) {
                        firstCard.scrollIntoView();
                    }
                }
            }
        }

        reignBtns.forEach(function (b) {
            b.addEventListener('click', function () { selectPrince(b.getAttribute('data-prince')); });
        });
        epochCards.forEach(function (c) {
            c.setAttribute('role', 'button');
            c.setAttribute('tabindex', '0');
            c.setAttribute('aria-pressed', 'false');
            c.addEventListener('click', function () { selectPrince(c.getAttribute('data-prince')); });
            c.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectPrince(c.getAttribute('data-prince'));
                }
            });
        });
    })();

    // ============================================================
    // АНАЛИТИКА ДОНЕЙТА (п.5): клики по внешним донат-ссылкам уходят
    // в Метрику с кампанией из UTM-метки ссылки (fund_popup /
    // support_section / footer / beta_access).
    // ============================================================
    if (typeof ym === 'function') {
        // Клик на запуск игры
        document.querySelectorAll('a[href*="game/index.html"]').forEach(function (link) {
            link.addEventListener('click', function () {
                ym(112435792, 'reachGoal', 'game_launch');
            });
        });
        // Бросок кубика d100
        const d100 = document.getElementById('d100Dice');
        if (d100) {
            d100.addEventListener('click', function () {
                ym(112435792, 'reachGoal', 'd100_roll');
            });
        }
        // Открытие видео
        const video = document.querySelector('#trailer video');
        if (video) {
            video.addEventListener('play', function () {
                ym(112435792, 'reachGoal', 'video_play');
            });
        }
        // Открытие скриншота
        document.querySelectorAll('.screenshot-card').forEach(function (card) {
            card.addEventListener('click', function () {
                ym(112435792, 'reachGoal', 'screenshot_view');
            });
        });
        // Донат-ссылки: reachGoal donate_click + кампания из utm_campaign
        document.querySelectorAll('a[href*="boosty.to"], a[href*="yoomoney.ru"], a[href*="vk.ru/club"]').forEach(function (link) {
            link.addEventListener('click', function () {
                let campaign = 'footer';
                try {
                    const u = new URL(link.href);
                    const c = u.searchParams.get('utm_campaign');
                    if (c) campaign = c;
                } catch (e) { /* noop */ }
                ym(112435792, 'reachGoal', 'donate_click', { campaign: campaign });
            });
        });
    }
}

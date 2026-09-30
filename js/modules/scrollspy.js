// scrollspy.js — прокрутка и навигация лендинга (66.48, аудит №12).
// Вынесено из монолита main.js: плавные якоря, коррекция позиционирования
// после прыжка (content-visibility-safe, раунд 10), подсветка активного
// раздела в меню (scrollspy, раунд 9) и параллакс hero-изображения.
import { REDUCED_MOTION } from './state.js';

export function initScrollPage(reducedMotion) {
    bindSmoothAnchors();
    initAnchorCorrection();
    initScrollSpy();
    initParallax(reducedMotion);
}

// Плавная прокрутка по якорям (раунд 10: content-visibility-safe)
function bindSmoothAnchors() {
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
}

// ============================================================
// КОРРЕКЦИЯ ЯКОРНОЙ НАВИГАЦИИ (content-visibility, раунд 10)
// Секции ниже первого экрана с content-visibility:auto при прыжке по
// якорю рендерятся ПОСЛЕ прыжка и сдвигают цель вниз на сотни пикселей —
// браузер остаётся на оценочной позиции. Повторно наводим на цель,
// пока раскладка не устаканится. Ручной скролл пользователя отменяет.
// ============================================================
function initAnchorCorrection() {
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
}

// ============================================================
// SCROLLSPY: подсветка активного раздела в навигации (раунд 9)
// ============================================================
function initScrollSpy() {
    const navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    const spyTargets = [];
    navLinks.forEach(function (a) {
        const sec = document.getElementById(a.getAttribute('href').slice(1));
        if (sec) spyTargets.push({ link: a, sec: sec });
    });
    if (!spyTargets.length) return;

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

// Параллакс для hero-изображения (66.31: выключен при reduced-motion —
// батарея телефонов и уважение к настройке пользователя)
function initParallax(reducedMotion) {
    const heroImg = document.querySelector('.hero-image');
    if (heroImg && !reducedMotion) {
        let ticking = false;
        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    const scrolled = window.scrollY;
                    if (scrolled < 600) {
                        heroImg.style.transform = 'translateY(' + scrolled * 0.3 + 'px)';
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
}

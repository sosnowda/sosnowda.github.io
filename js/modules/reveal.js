// reveal.js — анимация появления секций при скролле (66.48, аудит №12).
// no-JS safe: флаг 'js' на <html> ставит js/main.js ДО запуска — без JS
// страница полностью видима (прогрессивное улучшение).
import { REDUCED_MOTION } from './state.js';

export function initReveal() {
    const reduced = REDUCED_MOTION;
    if (reduced || !('IntersectionObserver' in window)) {
        // Контент просто виден — интерактив инициализирует main.js отдельно.
        return false;
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
    return true;
}

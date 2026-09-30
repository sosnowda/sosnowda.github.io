// main.js — точка входа лендинга «Летописи Руси XV века» (RU и EN страницы).
// 66.48 (аудит №12): монолит (~890 строк) разбит на ES-модули в js/modules/:
//   state.js     — общие константы (reduced-motion, язык страницы);
//   reveal.js    — анимация появления секций при скролле;
//   scrollspy.js — плавные якоря, коррекция прыжков, подсветка разделов, параллакс;
//   lightbox.js  — лайтбокс исторических карт;
//   gallery.js   — лайтбокс галереи скриншотов со стрелками;
//   particles.js — золотые частицы (reduced-motion + скрытая вкладка);
//   ui.js        — гамбургер, попап поддержки, тост, d100, таймлайн князей;
//   analytics.js — цели Яндекс.Метрики.
// Подключается как <script type="module"> — defer-поведение встроено.
import { REDUCED_MOTION } from './modules/state.js';
import { initReveal } from './modules/reveal.js';
import { initScrollPage } from './modules/scrollspy.js';
import { initMapLightbox } from './modules/lightbox.js';
import { initGallery } from './modules/gallery.js';
import { initParticles } from './modules/particles.js';
import { initInteractivePage } from './modules/ui.js';
import { initAnalytics } from './modules/analytics.js';

// Флаг наличия JS: reveal-анимации применяются только если JS работает.
// Без JS страница полностью видима (прогрессивное улучшение).
document.documentElement.classList.add('js');

// Service Worker (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () { });
}

function bootPage() {
    // Reveal-анимации: при reduced-motion/no-IO контент просто виден,
    // но интерактив (ниже) инициализировать надо в любом случае.
    initReveal();
    initInteractivePage(REDUCED_MOTION); // гамбургер, попап, тост, d100, таймлайн
    initScrollPage(REDUCED_MOTION);      // якоря, scrollspy, параллакс
    initMapLightbox();                   // лайтбокс карт
    initGallery();                       // лайтбокс галереи скриншотов
    initParticles(REDUCED_MOTION);       // золотые частицы
    initAnalytics();                     // Метрика
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPage);
} else {
    bootPage(); // модуль загрузился после DOMContentLoaded (кеш, медленная сеть)
}

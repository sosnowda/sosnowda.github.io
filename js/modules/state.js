// state.js — общие константы страниц лендинга.
// 66.48 (аудит №12): монолит main.js разбит на ES-модули; вынесено то,
// что нужно почти всем модулям и не должно вычисляться дублированно.

// «Уменьшить движение» — один раз на страницу (частицы, параллакс, скроллы)
export const REDUCED_MOTION = (function () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
})();

// Язык страницы (для попапа поддержки, таймлайна князей и аналитики).
// Локализация d100 тоже держится на этом флаге (страница EN — /en/).
export const IS_EN_PAGE = (document.documentElement.lang || 'ru').toLowerCase().indexOf('en') === 0;

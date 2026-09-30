// analytics.js — события Яндекс.Метрики (66.48, аудит №12).
// Вынесено из монолита main.js. Все цели сайта: запуск игры, бросок d100,
// открытие видео и скриншотов, клики по донат-ссылкам с UTM-кампаниями
// (fund_popup / support_section / footer / beta_access).
export function initAnalytics() {
    if (typeof ym !== 'function') return;

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

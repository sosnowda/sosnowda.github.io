// webvitals.js — Web Vitals → Яндекс.Метрика (66.70, аудит владельца:
// «Web Vitals мониторинг через Яндекс.Метрику (LCP, FID, CLS)»).
// Нативные PerformanceObserver без внешних зависимостей (CSP 'self',
// новых origin нет); алгоритмы по канону web.dev:
//   LCP — largest-contentful-paint, финал на скрытии вкладки;
//   FID — first-input (processingStart − startTime), отправка сразу;
//   CLS — layout-shift с сессионными окнами (gap 1s / окно 5s).
// Отправка: ym(112435792, 'reachGoal', 'webvitals_<metric>', { value }).
// Цели webvitals_lcp / webvitals_fid / webvitals_cls заводятся в UI
// Метрики владельцем (reachGoal пишет визиты и без цели, но отчёты
// по целям нагляднее). Метрика недоступна (локальный стенд/офлайн) —
// тихо выходим: измерение не должно ломать страницу и тесты.

const COUNTER_ID = 112435792;

function sendMetric(name, value) {
    try {
        if (typeof ym !== 'function') return; // нет счётчика — нет отправки
        ym(COUNTER_ID, 'reachGoal', 'webvitals_' + name, { value: value });
    } catch (e) { /* аналитика не должна ломать страницу */ }
}

function observeType(type, onEntries) {
    try {
        const po = new PerformanceObserver(function (list) { onEntries(list.getEntries()); });
        po.observe({ type: type, buffered: true }); // buffered: события до регистрации тоже учитываются
        return po;
    } catch (e) {
        return null; // тип не поддерживается браузером — метрика недоступна
    }
}

export function initWebVitals() {
    if (typeof PerformanceObserver !== 'function') return;

    const sent = { lcp: false, fid: false, cls: false };

    // --- LCP: держим последний (наибольший) кандидат до скрытия вкладки ---
    let lcpValue = 0;
    const lcpPo = observeType('largest-contentful-paint', function (entries) {
        const last = entries[entries.length - 1];
        if (last) lcpValue = last.startTime;
    });

    // --- FID: первый ввод пользователя, отправляем немедленно ---
    observeType('first-input', function (entries) {
        const first = entries[0];
        if (first && !sent.fid && typeof first.processingStart === 'number') {
            sent.fid = true;
            sendMetric('fid', Math.round(first.processingStart - first.startTime));
        }
    });

    // --- CLS: сессионные окна по web.dev (gap 1s, окно 5s) ---
    let clsValue = 0, sessionValue = 0, sessionEntries = [];
    observeType('layout-shift', function (entries) {
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.hadRecentInput) continue; // сдвиги от ввода пользователя не считаются
            const lastEntry = sessionEntries[sessionEntries.length - 1];
            if (sessionValue && lastEntry &&
                entry.startTime - lastEntry.startTime < 1000 &&
                entry.startTime - sessionEntries[0].startTime < 5000) {
                sessionValue += entry.value;
            } else {
                sessionValue = entry.value;
            }
            sessionEntries.push(entry);
            clsValue = Math.max(clsValue, sessionValue);
        }
    });

    // --- Финализация LCP и CLS — на скрытии вкладки (стандарт web.dev);
    //     pagehide — второй эшелон (bfcache-возврат обновит показатели) ---
    function finalize() {
        if (!sent.lcp && lcpValue > 0) {
            sent.lcp = true;
            sendMetric('lcp', Math.round(lcpValue));
        }
        if (!sent.cls) {
            sent.cls = true;
            sendMetric('cls', Math.round(clsValue * 1000) / 1000);
        }
        if (lcpPo) {
            try { lcpPo.disconnect(); } catch (e) { /* уже отключён */ }
            // повторный finalize безопасен: disconnect идемпотентен
        }
    }
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') finalize();
    });
    window.addEventListener('pagehide', finalize);
}

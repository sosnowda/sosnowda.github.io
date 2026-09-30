// ui.js — общий интерактивный блок страницы (66.48, аудит №12).
// Вынесено из монолита main.js: гамбургер-меню, попап поддержки
// (Esc + фокус-трап), тост копирования ссылки, интерактивный d100,
// интерактивный таймлайн князей. Выполняется и при reduced-motion,
// и при отсутствии IntersectionObserver.
import { REDUCED_MOTION, IS_EN_PAGE } from './state.js';

export function initInteractivePage(reducedMotion) {
    initMobileMenu();
    initFundPopup();
    initCopyToast();
    initDice();
    initPrincesTimeline(reducedMotion);
}

// ============================================================
// Гамбургер-меню для мобильных
// ============================================================
function initMobileMenu() {
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
}

// ============================================================
// ПОПАП ПОДДЕРЖКИ (п.4): закрытие с клавиатуры + ФОКУС-ТРАП.
// Открытие оставлено в разметке (inline onclick) — работает и без
// пересборки; здесь добавляется доступность: Esc закрывает, Tab ходит
// только по элементам попапа, при открытии фокус уходит внутрь, при
// закрытии возвращается на полоску сбора средств.
// ============================================================
function initFundPopup() {
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
        // 66.47 (аудит №20): полоска — настоящий <button> в разметке
        // (role/tabindex больше не нужны); здесь только состояние
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
}

// ============================================================
// 66.47 (аудит №4): ТОСТ вместо alert() + копирование с .catch().
// Кнопка «📋 Копировать» (.btn-share--copy) несёт data-url/data-toast;
// clipboard API с фолбэком execCommand и честным сообщением об ошибке.
// ============================================================
function initCopyToast() {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    let toastTimer = 0;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
    }
    document.querySelectorAll('.btn-share--copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const url = btn.getAttribute('data-url') || location.origin + location.pathname;
            const okMsg = btn.getAttribute('data-toast') || (IS_EN_PAGE ? 'Link copied!' : 'Ссылка скопирована!');
            const errMsg = IS_EN_PAGE
                ? 'Could not copy — please copy the address from the browser bar'
                : 'Не удалось скопировать — скопируйте адрес из строки браузера';
            function fallbackCopy() {
                // Фолбэк: старые браузеры / контексты без clipboard API
                try {
                    const ta = document.createElement('textarea');
                    ta.value = url;
                    ta.setAttribute('readonly', '');
                    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
                    document.body.appendChild(ta);
                    ta.select();
                    const done = document.execCommand('copy');
                    document.body.removeChild(ta);
                    showToast(done ? okMsg : errMsg);
                } catch (e) {
                    showToast(errMsg);
                }
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(function () {
                    showToast(okMsg);
                }).catch(fallbackCopy);
            } else {
                fallbackCopy();
            }
        });
    });
}

// ============================================================
// ИНТЕРАКТИВНЫЙ ДАЙС d100 (66.48, аудит №12).
// 66.31: локализация результатов по языку документа. Inline-обработчики
// (onclick/onkeydown в разметке) сняты — ES-модули не экспортируют
// глобальные функции; здесь же клавиатура Enter/Space (a11y).
// ============================================================
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
    // Аудит 2.2 (66.49): перезапуск ролла БЕЗ reflow-хака void offsetWidth —
    // Web Animations API (те же кадры, что у CSS d100-3d-roll; длительность 700 мс
    // совпадает с таймером результата). При prefers-reduced-motion анимация
    // схлопывается в 1 мс. CSS-класс .rolling оставлен фолбэком для браузеров
    // без element.animate.
    sphere.classList.remove('rolling');
    if (typeof sphere.animate === 'function') {
        sphere.animate([
            { transform: 'rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)' },
            { transform: 'rotateX(360deg) rotateY(180deg) rotateZ(90deg) scale(1.15)', offset: 0.3 },
            { transform: 'rotateX(720deg) rotateY(360deg) rotateZ(180deg) scale(1.1)', offset: 0.6 },
            { transform: 'rotateX(1080deg) rotateY(540deg) rotateZ(270deg) scale(1)' }
        ], { duration: REDUCED_MOTION ? 1 : 700, easing: 'ease-out' });
    } else {
        void sphere.offsetWidth; // фолбэк: перезапуск CSS-анимации #d100Sphere.rolling
        sphere.classList.add('rolling');
    }
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

function initDice() {
    const dice = document.getElementById('d100Dice');
    if (!dice) return;
    dice.addEventListener('click', rollD100);
    dice.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            rollD100();
        }
    });
}

// ============================================================
// ИНТЕРАКТИВНЫЙ ТАЙМЛАЙН КНЯЗЕЙ (п.8).
// Лента 1400–1505: три правления — клик по отрезку (или карточке
// эпохи) подсвечивает княженье, показывает досье и подсвечивает
// события хроники внутри этих лет, докручивая ленту к первому из них.
// Полностью клавиатурный (кнопки) и локализованный (RU/EN).
// ============================================================
function initPrincesTimeline(reducedMotion) {
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
}

// gallery.js — лайтбокс галереи скриншотов со стрелками (66.48, аудит №12;
// раунд 66.6, приказ владельца): клик по скриншоту — полноэкранный просмотр;
// стрелки ‹ › и клавиши ←/→ листают кадры, Esc закрывает, свайп работает
// на тач-экранах; счётчик «3 / 9»; подпись берётся из карточки
// (автоматически локализуется на EN-версии страницы).
import { IS_EN_PAGE } from './state.js';

export function initGallery() {
    const screenshots = document.querySelectorAll('.screenshot-card');
    if (screenshots.length === 0) return;

    const L10N = IS_EN_PAGE
        ? { prev: 'Previous screenshot (Left arrow)', next: 'Next screenshot (Right arrow)',
            close: 'Close (Esc)', counter: 'Screenshot {i} of {n}', open: 'Open screenshot: ' }
        : { prev: 'Предыдущий скриншот (стрелка влево)', next: 'Следующий скриншот (стрелка вправо)',
            close: 'Закрыть (Esc)', counter: 'Скриншот {i} из {n}', open: 'Открыть скриншот: ' };

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
        card.setAttribute('aria-label', L10N.open + (card.querySelector('.screenshot-caption')?.textContent || ''));
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
        else if (e.key === 'Tab') {
            // 66.47 (аудит №16): фокус-трап — Tab ходит только по кнопкам лайтбокса
            const btns = Array.prototype.filter.call(
                slb.querySelectorAll('.slb-btn'),
                function (el) { return el.offsetParent !== null; }
            );
            if (!btns.length) return;
            const first = btns[0];
            const last = btns[btns.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !slb.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        }
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

// lightbox.js — увеличение исторических карт при клике (66.48, аудит №12).
// Вынесено из монолита main.js: полноэкранный просмотр, зум колесом,
// перетаскивание, повторный клик — возврат 1:1, Esc закрывает.
// 66.47 (аудит №16): фокус уходит в кнопку закрытия, при закрытии — назад.
// 66.55 (аудит 66.52 P3-4): img лайтбокса создаётся через createElement —
// пустой src в innerHTML-шаблоне оставлял мусорный атрибут в DOM.
import { IS_EN_PAGE } from './state.js';

export function initMapLightbox() {
    const mapImages = document.querySelectorAll('.map-card img');
    const lightbox = document.createElement('div');
    lightbox.id = 'mapLightbox';
    lightbox.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;padding:2rem;';
    lightbox.innerHTML = '<button type="button" class="mlb-close" aria-label="' + (IS_EN_PAGE ? 'Close map preview (Esc)' : 'Закрыть просмотр карты (Esc)') + '" style="position:absolute;top:1rem;right:2rem;background:none;border:none;color:#c9a961;font-size:2rem;cursor:pointer;padding:0 0.6rem;line-height:1;">×</button>';
    // P3-4 (аудит 66.52): реальный src выставляет openLightbox(); порядок DOM
    // прежний — img первым ребёнком контейнера, до кнопки закрытия.
    const lbImg = document.createElement('img');
    lbImg.alt = '';
    lbImg.style.cssText = 'max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);';
    lightbox.insertBefore(lbImg, lightbox.firstChild);
    document.body.appendChild(lightbox);

    const lbClose = lightbox.querySelector('.mlb-close');
    // Заявлены ДО обработчиков (66.31: const/let — у var была всплыть-магия)
    let zoomLevel = 1;
    let startX = 0, startY = 0, translateX = 0, translateY = 0;
    let mapLastFocus = null;

    function openLightbox(src, alt) {
        lbImg.src = src;
        lbImg.alt = alt;
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        lbImg.style.transform = 'scale(1)';
        // 66.47 (аудит №16): фокус уходит в кнопку закрытия, при закрытии — назад
        mapLastFocus = document.activeElement;
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (lbClose && typeof lbClose.focus === 'function') lbClose.focus();
    }
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
        if (mapLastFocus && typeof mapLastFocus.focus === 'function') mapLastFocus.focus();
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
}

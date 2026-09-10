// Плавная прокрутка по якорям
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Service Worker (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function(){});
}

// Интерактивный дайс d100
var d100IsRolling = false;
function rollD100() {
    if (d100IsRolling) return;
    d100IsRolling = true;
    var sphere = document.getElementById('d100Sphere');
    var result = document.getElementById('d100Result');
    var degree = document.getElementById('d100Degree');
    if (!sphere || !result || !degree) { d100IsRolling = false; return; }
    sphere.classList.remove('rolling');
    void sphere.offsetWidth;
    sphere.classList.add('rolling');
    result.textContent = '?';
    degree.textContent = 'Бросаем…';
    degree.style.color = '';
    setTimeout(function() {
        var roll = Math.floor(Math.random() * 100) + 1;
        var deg, cls;
        if (roll <= 5) { deg = 'Удача!'; cls = 'crit'; }
        else if (roll <= 20) { deg = 'Особый!'; cls = 'special'; }
        else if (roll <= 95) { deg = 'Успех'; cls = 'success'; }
        else { deg = 'Провал!'; cls = 'fail'; }
        result.textContent = roll;
        degree.textContent = deg + ' (выпало ' + roll + ' из 100)';
        degree.style.color = (cls === 'crit' || cls === 'special') ? '#e0c078' : (cls === 'fail' ? '#c44' : '');
        sphere.classList.remove('rolling');
        d100IsRolling = false;
    }, 700);
}

// Анимация появления секций при скролле
document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('section, .feature-card, .epoch-card, .detailed-item, .map-card');
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    sections.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // ============================================================
    // УВЕЛИЧЕНИЕ КАРТ ПРИ КЛИКЕ (LIGHTBOX)
    // ============================================================
    var mapImages = document.querySelectorAll('.map-card img');
    var lightbox = document.createElement('div');
    lightbox.id = 'mapLightbox';
    lightbox.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;padding:2rem;';
    lightbox.innerHTML = '<img src="" alt="" style="max-width:95%;max-height:95%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);"><div style="position:absolute;top:1rem;right:2rem;color:#c9a961;font-size:2rem;cursor:pointer;">×</div>';
    document.body.appendChild(lightbox);

    var lbImg = lightbox.querySelector('img');
    var lbClose = lightbox.querySelector('div');
    var zoomLevel = 1;

    function openLightbox(src, alt) {
        lbImg.src = src;
        lbImg.alt = alt;
        zoomLevel = 1;
        lbImg.style.transform = 'scale(1)';
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }

    mapImages.forEach(function(img) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function() {
            openLightbox(this.src, this.alt);
        });
    });

    lbClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox();
    });

    // Зум колесом мыши
    lightbox.addEventListener('wheel', function(e) {
        e.preventDefault();
        if (e.deltaY < 0) zoomLevel = Math.min(zoomLevel + 0.2, 4);
        else zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
        lbImg.style.transform = 'scale(' + zoomLevel + ')';
    });

    // Перетаскивание при зуме
    var isDragging = false;
    var startX, startY, translateX = 0, translateY = 0;
    lbImg.addEventListener('mousedown', function(e) {
        if (zoomLevel > 1) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            lbImg.style.cursor = 'grabbing';
        }
    });
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            lbImg.style.transform = 'scale(' + zoomLevel + ') translate(' + translateX + 'px, ' + translateY + 'px)';
        }
    });
    document.addEventListener('mouseup', function() {
        isDragging = false;
        lbImg.style.cursor = '';
    });
});

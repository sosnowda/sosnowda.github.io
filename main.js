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

// Интерактивный кубик d100 — крутится каждый раз
var d100IsRolling = false;
function rollD100() {
    if (d100IsRolling) return;
    d100IsRolling = true;
    var dice = document.getElementById('d100Dice');
    var result = document.getElementById('d100Result');
    var degree = document.getElementById('d100Degree');
    // Перезапуск анимации
    dice.classList.remove('rolling');
    void dice.offsetWidth;
    dice.classList.add('rolling');
    result.textContent = '?';
    degree.textContent = 'Бросаем…';
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
        dice.classList.remove('rolling');
        d100IsRolling = false;
    }, 700);
}

// Анимация появления секций при скролле (IntersectionObserver)
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
});

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

// Интерактивный кубик d100
function rollD100() {
    var dice = document.getElementById('d100Dice');
    var result = document.getElementById('d100Result');
    var degree = document.getElementById('d100Degree');
    if (dice.classList.contains('rolling')) return;
    dice.classList.remove('rolling');
    void dice.offsetWidth;
    dice.classList.add('rolling');
    result.textContent = '?';
    degree.textContent = 'Бросаем…';
    setTimeout(function() {
        var roll = Math.floor(Math.random() * 100) + 1;
        var deg, cls;
        if (roll <= 5) { deg = 'Критический!'; cls = 'crit'; }
        else if (roll <= 20) { deg = 'Особый!'; cls = 'special'; }
        else if (roll <= 95) { deg = 'Успех'; cls = 'success'; }
        else { deg = 'Провал!'; cls = 'fail'; }
        result.textContent = roll;
        degree.textContent = deg + ' (выпало ' + roll + ' из 100)';
        degree.style.color = (cls === 'crit' || cls === 'special') ? '#e0c078' : (cls === 'fail' ? '#c44' : 'var(--text-dim)');
    }, 700);
}

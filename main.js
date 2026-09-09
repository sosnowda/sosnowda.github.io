
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
   ym(112435792, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true });


  (function(){
    try {
      var saved = localStorage.getItem('cr-theme');
      if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    } catch(e){}
  })();


(function(){
  'use strict';

  /* ===================== 1. ПЕРЕКЛЮЧЕНИЕ ТЕМЫ ===================== */
  var themeToggle = document.getElementById('themeToggle');
  var root = document.documentElement;
  var THEME_KEY = 'cr-theme';

  function applyTheme(theme){
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  }

  themeToggle.addEventListener('click', function(){
    var current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch(e){}
    themeToggle.setAttribute('aria-label',
      next === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему');
  });

  /* ===================== 2. ИНТЕРАКТИВНЫЙ КУБИК d100 ===================== */
  var diceScene  = document.getElementById('diceScene');
  var diceCube   = document.getElementById('diceCube');
  var diceNumber = document.getElementById('diceNumber');
  var diceDegree = document.getElementById('diceDegree');
  var diceRollBtn= document.getElementById('diceRollBtn');
  var isRolling = false;

  function rollDice(){
    if (isRolling) return;
    isRolling = true;
    diceCube.classList.remove('rolling');
    void diceCube.offsetWidth; // форс-reflow, чтобы анимация перезапустилась
    diceCube.classList.add('rolling');
    diceNumber.textContent = '?';
    diceNumber.classList.remove('placeholder');
    diceDegree.textContent = 'Бросаем…';
    diceDegree.className = 'dice-degree';
    setTimeout(function(){
      var roll = Math.floor(Math.random() * 100) + 1;
      var degree, degreeClass;
      if (roll <= 5)        { degree = 'Крит!';   degreeClass = 'crit'; }
      else if (roll <= 20)  { degree = 'Особый!'; degreeClass = 'special'; }
      else if (roll <= 95)  { degree = 'Успех';   degreeClass = 'success'; }
      else                  { degree = 'Фамбл!';  degreeClass = 'fumble'; }
      diceNumber.textContent = roll;
      diceDegree.textContent = degree + ' (выпало ' + roll + ' из 100)';
      diceDegree.className = 'dice-degree ' + degreeClass;
      isRolling = false;
    }, 700);
  }
  diceScene.addEventListener('click', rollDice);
  diceScene.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); rollDice(); }
  });
  diceRollBtn.addEventListener('click', rollDice);

  /* ===================== 3. ГАЛЕРЕЯ + LIGHTBOX ===================== */
  var lightbox = document.getElementById('lightbox');
  var lightboxClose = lightbox.querySelector('.lightbox-close');
  var lastFocused = null;

  function openLightbox(){
    lastFocused = document.activeElement;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function(){ lightboxClose.focus(); }, 50);
  }
  function closeLightbox(){
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  document.querySelectorAll('.gallery-card').forEach(function(card){
    card.addEventListener('click', openLightbox);
  });
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e){
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });

  /* ===================== 4. КНОПКА «НАВЕРХ» ===================== */
  var backToTop = document.getElementById('backToTop');
  var SCROLL_THRESHOLD = 500;
  function onScroll(){
    if (window.scrollY > SCROLL_THRESHOLD) backToTop.classList.add('visible');
    else backToTop.classList.remove('visible');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  backToTop.addEventListener('click', function(){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ===================== 5. FAQ-АККОРДЕОН ===================== */
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function(item){
    var btn = item.querySelector('.faq-q');
    var ans = item.querySelector('.faq-a');
    btn.addEventListener('click', function(){
      var isOpen = item.classList.contains('open');
      faqItems.forEach(function(other){
        other.classList.remove('open');
        other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        other.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!isOpen){
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });

  /* ===================== 6. ФОРМА ПОДПИСКИ УБРАНА — ИСПОЛЬЗУЕМ Boosty/VK ===================== */
})();


if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
}

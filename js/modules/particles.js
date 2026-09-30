// particles.js — золотые частицы на фоне (как в TitleScene игры).
// 66.48 (аудит №12): вынесено из монолита main.js.
// 66.31 (п.2): батарея телефонов — при prefers-reduced-motion частиц
// нет вовсе; в скрытой вкладке RAF-цикл останавливается полностью и
// запускается заново при возврате (проверка на видимость в каждом кадре).
import { REDUCED_MOTION } from './state.js';

export function initParticles(reducedMotion) {
    if (reducedMotion || REDUCED_MOTION) return;

    const particleCanvas = document.createElement('canvas');
    particleCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.4;';
    particleCanvas.id = 'particles-canvas';
    document.body.appendChild(particleCanvas);
    const pctx = particleCanvas.getContext('2d');
    function resizeCanvas() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles = [];
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            r: 1 + Math.random() * 2,
            vy: 0.2 + Math.random() * 0.4,
            alpha: 0.3 + Math.random() * 0.4
        });
    }

    let particlesRafId = 0;
    let particlesRunning = false;
    function animateParticles() {
        // Скрытая вкладка: цикл замирает (батарея), возврат — оживляет
        if (document.visibilityState === 'hidden') {
            particlesRunning = false;
            return;
        }
        pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particles.forEach(function (p) {
            pctx.beginPath();
            pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            pctx.fillStyle = 'rgba(201, 169, 97, ' + p.alpha + ')';
            pctx.fill();
            p.y += p.vy;
            if (p.y > particleCanvas.height) {
                p.y = -10;
                p.x = Math.random() * particleCanvas.width;
            }
        });
        particlesRafId = requestAnimationFrame(animateParticles);
    }
    function startParticles() {
        if (!particlesRunning) {
            particlesRunning = true;
            particlesRafId = requestAnimationFrame(animateParticles);
        }
    }
    startParticles();
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            particlesRunning = false;
            cancelAnimationFrame(particlesRafId);
        } else {
            startParticles();
        }
    });
}

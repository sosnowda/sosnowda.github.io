// PreloadScene — 66.31 (приказ владельца, п.1): ПРЕЛОАД С ЗОЛОТЫМ
// ПРОГРЕСС-БАРОМ. Самый заметный UX-выигрыш для мобильных: вместо «голой»
// полоски BootScene игрок с первого кадра видит фирменный экран загрузки
// (пергаментный фон, заголовок, ЗОЛОТОЙ прогресс-бар со бликом, живые
// подсказки), и прогресс теперь честный — от реального счётчика загрузчика
// Phaser, а не «бегущая туда-сюда» полоска старой AI-сцены Loading.
//
// Как это работает:
//   1) PreloadScene — ПЕРВАЯ сцена в списке game/index.html (автостарт).
//   2) create() рисует экран и ЗАПУСКАЕТ BootScene (scene.launch).
//   3) BootScene, увидев живой Preload, НЕ рисует свою служебную полоску,
//      а пересылает прогресс в registry ('bootProgress' 0..1).
//   4) PreloadScene.update() читает 'bootProgress' и двигает золотой бар.
//   5) В финале BootScene.create() гасит PreloadScene и открывает Title —
//      переход без чёрной вспышки.
//
// Батарея телефонов (п.2 приказа): плавающих искр на прелоаде нет при
// prefers-reduced-motion (systems/MotionFX.js).
//
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { isEn } from '../systems/i18n.js';
import { reducedMotion } from '../systems/MotionFX.js';
import { bindRestartOnResize } from '../utils/ui.js';

const TIPS_RU = [
    'Летопись открывается…',
    'Свечи зажигаются в храме…',
    'Колокол звонаря готов к утреннему звону…',
    'Печь в избе растапливается…',
    'Стая гусей летит к озеру…',
    'Дозорные занимают места на частоколе…',
    'Купцы сбирают обозы к деревне…',
];
const TIPS_EN = [
    'The chronicle is opening…',
    'Candles are lit in the church…',
    'The bell ringer prepares the morning peal…',
    'The stove in the izba is warming up…',
    'A flock of geese flies to the lake…',
    'Guards take posts along the palisade…',
    'Merchants gather their carts to the village…',
];

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любая ориентация/размер окна
        const { width, height } = this.scale;
        const cx = width / 2;

        // ----- Фон: фирменный тёмно-коричневый + мягкая тёплая виньетка -----
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.drawVignette(width, height);

        // ----- Плавающие золотые искры (как в TitleScene; выкл. при reduced-motion) -----
        if (!reducedMotion()) {
            for (let i = 0; i < 26; i++) {
                const d = this.add.circle(
                    Phaser.Math.Between(0, width),
                    Phaser.Math.Between(0, height),
                    Phaser.Math.Between(1, 3),
                    0xc9a14a,
                    Phaser.Math.FloatBetween(0.15, 0.5)
                );
                this.tweens.add({
                    targets: d,
                    y: d.y - Phaser.Math.Between(24, 56),
                    alpha: 0,
                    duration: Phaser.Math.Between(2800, 6200),
                    repeat: -1,
                    delay: Phaser.Math.Between(0, 2200),
                });
            }
        }

        // ----- Заголовок (масштаб под ширину — как в TitleScene) -----
        const titleSize = Math.max(26, Math.min(58, Math.round(width / 13)));
        this.add.text(cx, Math.round(height * 0.26), 'ЛЕТОПИСИ РУСИ', {
            fontFamily: 'Georgia, serif', fontSize: titleSize + 'px', color: '#E8DCC4',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(2);

        const subSize = Math.max(12, Math.min(20, Math.round(width / 34)));
        this.add.text(cx, Math.round(height * 0.26) + titleSize * 0.75 + 14,
            isEn() ? 'The Chronicles of Ruthenia · 15th century' : 'XV век · Летопись возрождается', {
            fontSize: subSize + 'px', color: '#A89878', fontFamily: 'Georgia, serif',
        }).setOrigin(0.5).setDepth(2);

        // ----- ЗОЛОТОЙ ПРОГРЕСС-БАР -----
        const barW = Math.max(220, Math.min(420, Math.round(width * 0.76)));
        const barH = 18;
        const barY = Math.round(height * 0.52);
        const bx = cx - barW / 2;

        // Ложе бара (тёмная подложка чуть шире) + золотая окантовка
        this.add.rectangle(cx, barY, barW + 8, barH + 8, 0x000000, 0.45).setDepth(2);
        this.add.rectangle(cx, barY, barW + 4, barH + 4, 0x000000, 0)
            .setStrokeStyle(2, RUS.border, 0.9).setDepth(2);

        // Внутренняя ширина дорожки (минус 4px на отступ от окантовки)
        this.barInnerW = barW - 4;

        // Золотая заливка + блик (свет золота сверху)
        this.barFill = this.add.rectangle(bx + 2, barY, 2, barH - 4, RUS.border, 1)
            .setOrigin(0, 0.5).setDepth(3);
        this.barGloss = this.add.rectangle(bx + 2, barY - barH / 4 + 1, 2, Math.max(2, Math.round(barH / 5)), 0xf3e2b0, 0.55)
            .setOrigin(0, 0.5).setDepth(4);

        this.pctText = this.add.text(cx, barY + barH / 2 + 20, '0%', {
            fontFamily: 'Georgia, serif', fontSize: '18px', color: '#E8DCC4',
        }).setOrigin(0.5, 0).setDepth(2);

        // Живая подсказка (меняется каждые 2.6 с)
        this.tips = isEn() ? TIPS_EN : TIPS_RU;
        this.tipIndex = 0;
        this.tipText = this.add.text(cx, Math.round(height * 0.78), this.tips[0], {
            fontFamily: 'Georgia, serif', fontSize: Math.max(13, Math.min(16, Math.round(width / 42))) + 'px',
            color: '#b9a884', wordWrap: { width: Math.min(560, width - 40) }, align: 'center',
        }).setOrigin(0.5).setDepth(2);
        this.time.addEvent({
            delay: 2600, loop: true,
            callback: () => {
                this.tipIndex = (this.tipIndex + 1) % this.tips.length;
                this.tipText.setText(this.tips[this.tipIndex]);
            },
        });

        // Символы эпохи по бокам бара
        this.add.text(bx - 26, barY, '⚔', { fontSize: '20px' }).setOrigin(0.5).setDepth(2).setAlpha(0.85);
        this.add.text(bx + barW + 26, barY, '📜', { fontSize: '20px' }).setOrigin(0.5).setDepth(2).setAlpha(0.85);

        // ----- Стартуем тяжёлую загрузку (BootScene) -----
        // Preload — первая сцена конфига; Boot в списке дальше и сам не стартует.
        this.registry.set('bootProgress', 0);
        if (!this.scene.isActive('Boot')) {
            this.scene.launch('Boot');
        }
    }

    drawVignette(width, height) {
        const key = 'preload_vignette';
        if (!this.textures.exists(key)) {
            const VS = 512;
            const cv = this.textures.createCanvas(key, VS, VS);
            if (cv) {
                const ctx = cv.getContext();
                const grad = ctx.createRadialGradient(VS / 2, VS / 2, VS * 0.22, VS / 2, VS / 2, VS * 0.76);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.7, 'rgba(0,0,0,0.16)');
                grad.addColorStop(1, 'rgba(0,0,0,0.5)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, VS, VS);
                cv.refresh();
            }
        }
        if (this.textures.exists(key)) {
            const h = Math.max(width, height);
            this.add.image(width / 2, height / 2, key).setDisplaySize(h, h).setDepth(1).setAlpha(0.9);
        }
    }

    update() {
        // Честный прогресс от BootScene (registry 'bootProgress' 0..1).
        // Сглаживание Linear 0.35 — бар растёт плавно, но мгновенно показывает
        // и маленькие докачки (не «врёт», как старая анимация 8 секунд).
        const v = Phaser.Math.Clamp(this.registry.get('bootProgress') || 0, 0, 1);
        if (!this.barFill) return;
        const target = 2 + this.barInnerW * v;
        const smooth = Phaser.Math.Linear(this.barFill.width, target, 0.35);
        this.barFill.width = smooth;
        this.barGloss.width = smooth;
        const pct = Math.round(v * 100) + '%';
        if (this.pctText.text !== pct) this.pctText.setText(pct);
    }
}

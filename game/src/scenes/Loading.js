// Phaser загружен глобально через CDN

/**
 * Сцена загрузки — страница ожидания генерации ИИ
 * Loading Scene - AI generation waiting page
 * 
 * Отображает милую анимацию загрузки с поддержкой двуязычности (EN/RU)
 * Displays a cute loading animation with bilingual support (EN/RU)
 */
export class Loading extends Phaser.Scene {
    constructor() {
        super('Loading');
    }

    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Градиентный фон / Gradient background
        this.createGradientBackground(width, height);

        // Мерцающие звёзды / Twinkling stars
        this.createStars(width, height);

        // Анимация загрузки с самолётиком / Loading animation with airplane
        this.createLoadingAnimation(centerX, centerY);

        // Текст загрузки (двуязычный) / Loading text (bilingual)
        this.createLoadingText(centerX, centerY);

        // Подсказки внизу (двуязычные) / Bottom tips (bilingual)
        this.createTips(centerX, height);

        // Плавающие украшения / Floating decorations
        this.createFloatingDecorations(width, height);
    }

    createGradientBackground(width, height) {
        const graphics = this.add.graphics();
        
        // Градиент от тёмно-фиолетового к тёмно-синему / Deep purple to deep blue gradient
        const colors = [
            { y: 0, color: 0x1a0a2e },
            { y: 0.25, color: 0x16213e },
            { y: 0.5, color: 0x0f3460 },
            { y: 0.75, color: 0x1a1a4e },
            { y: 1, color: 0x0a0a20 }
        ];

        for (let i = 0; i < colors.length - 1; i++) {
            const startY = colors[i].y * height;
            const endY = colors[i + 1].y * height;
            const segmentHeight = endY - startY;
            
            graphics.fillStyle(colors[i].color, 1);
            graphics.fillRect(0, startY, width, segmentHeight);
        }
    }

    createStars(width, height) {
        this.stars = [];
        
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.Between(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.3, 1);
            
            const star = this.add.circle(x, y, size, 0xffffff, alpha);
            this.stars.push(star);
            
            // Анимация мерцания / Twinkling animation
            this.tweens.add({
                targets: star,
                alpha: { from: alpha, to: alpha * 0.3 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createLoadingAnimation(centerX, centerY) {
        // Внешнее вращающееся кольцо / Outer rotating ring
        this.outerRing = this.add.graphics();
        this.drawRing(this.outerRing, 0, 0, 80, 4, 0x6c5ce7, 0.8);
        this.outerRing.setPosition(centerX, centerY - 40);

        // Внутреннее вращающееся кольцо / Inner rotating ring
        this.innerRing = this.add.graphics();
        this.drawRing(this.innerRing, 0, 0, 55, 3, 0xa29bfe, 0.6);
        this.innerRing.setPosition(centerX, centerY - 40);

        // Контейнер центральной ракеты / Center rocket container
        this.centerIcon = this.add.container(centerX, centerY - 40);
        
        // Создаём ракету / Create rocket
        this.createRocket();

        // Анимации вращения колец / Ring rotation animations
        this.tweens.add({
            targets: this.outerRing,
            angle: 360,
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });

        this.tweens.add({
            targets: this.innerRing,
            angle: -360,
            duration: 2000,
            repeat: -1,
            ease: 'Linear'
        });

        // Энергетические частицы / Energy particles
        this.createEnergyParticles(centerX, centerY - 40);
    }

    drawRing(graphics, x, y, radius, lineWidth, color, alpha) {
        graphics.lineStyle(lineWidth, color, alpha);
        
        // Эффект пунктирного кольца / Dashed circle effect
        const segments = 8;
        const gap = 0.15;
        
        for (let i = 0; i < segments; i++) {
            const startAngle = (i / segments) * Math.PI * 2;
            const endAngle = startAngle + (1 / segments - gap) * Math.PI * 2;
            
            graphics.beginPath();
            graphics.arc(x, y, radius, startAngle, endAngle, false);
            graphics.strokePath();
        }
    }

    createRocket() {
        const graphics = this.add.graphics();
        
        // Корпус ракеты / Rocket body
        graphics.fillStyle(0xdfe6e9, 1);
        graphics.beginPath();
        graphics.moveTo(0, -35);     // Носик / Nose tip
        graphics.lineTo(12, -15);    // Правая дуга / Right curve
        graphics.lineTo(12, 25);     // Правая часть / Right body
        graphics.lineTo(-12, 25);    // Левая часть / Left body
        graphics.lineTo(-12, -15);   // Левая дуга / Left curve
        graphics.closePath();
        graphics.fillPath();
        
        // Блик на корпусе / Body highlight
        graphics.fillStyle(0xffffff, 0.6);
        graphics.beginPath();
        graphics.moveTo(-2, -30);
        graphics.lineTo(6, -15);
        graphics.lineTo(6, 20);
        graphics.lineTo(-2, 20);
        graphics.closePath();
        graphics.fillPath();
        
        // Носовой конус (красный) / Nose cone (red)
        graphics.fillStyle(0xe74c3c, 1);
        graphics.beginPath();
        graphics.moveTo(0, -35);
        graphics.lineTo(10, -18);
        graphics.lineTo(-10, -18);
        graphics.closePath();
        graphics.fillPath();
        
        // Блик носа / Nose highlight
        graphics.fillStyle(0xec7063, 0.7);
        graphics.beginPath();
        graphics.moveTo(-2, -32);
        graphics.lineTo(4, -20);
        graphics.lineTo(-6, -20);
        graphics.closePath();
        graphics.fillPath();
        
        // Иллюминатор / Window
        graphics.fillStyle(0x74b9ff, 1);
        graphics.fillCircle(0, -5, 8);
        
        // Внутреннее кольцо иллюминатора / Window inner ring
        graphics.fillStyle(0x0984e3, 1);
        graphics.fillCircle(0, -5, 6);
        
        // Блик иллюминатора / Window highlight
        graphics.fillStyle(0xffffff, 0.7);
        graphics.fillCircle(-2, -7, 2);
        
        // Левый стабилизатор / Left fin
        graphics.fillStyle(0xe74c3c, 1);
        graphics.beginPath();
        graphics.moveTo(-12, 15);
        graphics.lineTo(-25, 30);
        graphics.lineTo(-20, 30);
        graphics.lineTo(-12, 22);
        graphics.closePath();
        graphics.fillPath();
        
        // Правый стабилизатор / Right fin
        graphics.beginPath();
        graphics.moveTo(12, 15);
        graphics.lineTo(25, 30);
        graphics.lineTo(20, 30);
        graphics.lineTo(12, 22);
        graphics.closePath();
        graphics.fillPath();
        
        // Центральный стабилизатор (снизу) / Center fin (bottom)
        graphics.beginPath();
        graphics.moveTo(0, 25);
        graphics.lineTo(6, 35);
        graphics.lineTo(-6, 35);
        graphics.closePath();
        graphics.fillPath();
        
        // Декоративная полоса / Decorative stripe
        graphics.fillStyle(0x3498db, 1);
        graphics.fillRect(-10, 8, 20, 4);
        
        // Пламя двигателя / Engine flame
        this.engineFlame = this.add.graphics();
        this.updateEngineFlame();
        this.centerIcon.add(this.engineFlame);
        
        this.centerIcon.add(graphics);
        
        // Анимация покачивания / Floating animation
        this.tweens.add({
            targets: this.centerIcon,
            y: this.centerIcon.y - 12,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Лёгкое покачивание / Slight wobble
        this.tweens.add({
            targets: this.centerIcon,
            angle: { from: -3, to: 3 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Мерцание пламени двигателя / Engine flame flicker
        this.time.addEvent({
            delay: 80,
            callback: this.updateEngineFlame,
            callbackScope: this,
            loop: true
        });
    }

    updateEngineFlame() {
        if (!this.engineFlame) return;
        
        this.engineFlame.clear();
        
        // Случайные параметры пламени / Random flame parameters
        const flameHeight = Phaser.Math.Between(20, 35);
        const flameWidth = Phaser.Math.Between(14, 20);
        const innerFlameHeight = flameHeight * 0.6;
        const innerFlameWidth = flameWidth * 0.5;
        
        // Внешнее пламя (оранжево-красное) / Outer flame (orange-red)
        this.engineFlame.fillStyle(0xe67e22, 0.9);
        this.engineFlame.beginPath();
        this.engineFlame.moveTo(-flameWidth / 2, 25);
        this.engineFlame.lineTo(0, 25 + flameHeight);
        this.engineFlame.lineTo(flameWidth / 2, 25);
        this.engineFlame.closePath();
        this.engineFlame.fillPath();
        
        // Среднее пламя (оранжевое) / Middle flame (orange)
        this.engineFlame.fillStyle(0xf39c12, 0.9);
        this.engineFlame.beginPath();
        this.engineFlame.moveTo(-flameWidth / 3, 25);
        this.engineFlame.lineTo(0, 25 + flameHeight * 0.8);
        this.engineFlame.lineTo(flameWidth / 3, 25);
        this.engineFlame.closePath();
        this.engineFlame.fillPath();
        
        // Внутреннее пламя (жёлтое) / Inner flame (yellow)
        this.engineFlame.fillStyle(0xf1c40f, 1);
        this.engineFlame.beginPath();
        this.engineFlame.moveTo(-innerFlameWidth / 2, 25);
        this.engineFlame.lineTo(0, 25 + innerFlameHeight);
        this.engineFlame.lineTo(innerFlameWidth / 2, 25);
        this.engineFlame.closePath();
        this.engineFlame.fillPath();
        
        // Ядро пламени (бело-жёлтое) / Core flame (white-yellow)
        this.engineFlame.fillStyle(0xffeaa7, 1);
        this.engineFlame.beginPath();
        this.engineFlame.moveTo(-3, 25);
        this.engineFlame.lineTo(0, 25 + innerFlameHeight * 0.5);
        this.engineFlame.lineTo(3, 25);
        this.engineFlame.closePath();
        this.engineFlame.fillPath();
    }

    createEnergyParticles(centerX, centerY) {
        this.particles = [];
        const particleCount = 6;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const particle = this.add.circle(
                centerX + Math.cos(angle) * 100,
                centerY + Math.sin(angle) * 100,
                4,
                [0xfd79a8, 0x74b9ff, 0x55efc4, 0xffeaa7, 0xa29bfe, 0xff7675][i],
                0.8
            );
            
            this.particles.push({
                graphic: particle,
                angle: angle,
                radius: 100,
                speed: 0.02 + Math.random() * 0.01
            });

            // Эффект свечения / Glow effect
            this.tweens.add({
                targets: particle,
                scale: { from: 1, to: 1.5 },
                alpha: { from: 0.8, to: 0.4 },
                duration: 1000 + i * 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        this.particleCenter = { x: centerX, y: centerY };
    }

    createLoadingText(centerX, centerY) {
        // Главный заголовок (двуязычный) / Main title (bilingual)
        this.loadingTitle = this.add.text(centerX, centerY + 80, '✨ AI Creating... / ИИ создаёт... ✨', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#6c5ce7',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Анимация «дыхания» заголовка / Title breathing animation
        this.tweens.add({
            targets: this.loadingTitle,
            scale: { from: 1, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Подзаголовок с анимированными точками (двуязычный) / Subtitle with animated dots (bilingual)
        this.loadingDots = this.add.text(centerX, centerY + 120, 'Please wait / Пожалуйста, подождите', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#a29bfe'
        }).setOrigin(0.5);

        // Динамические точки / Dynamic dots animation
        this.dotsCount = 0;
        this.time.addEvent({
            delay: 500,
            callback: () => {
                this.dotsCount = (this.dotsCount + 1) % 4;
                const dots = '.'.repeat(this.dotsCount);
                this.loadingDots.setText(`Please wait / Пожалуйста, подождите${dots}`);
            },
            loop: true
        });

        // Фон полосы прогресса / Progress bar background
        const progressBg = this.add.graphics();
        progressBg.fillStyle(0x2d3436, 0.5);
        progressBg.fillRoundedRect(centerX - 150, centerY + 150, 300, 12, 6);

        // Передний слой полосы прогресса / Progress bar foreground
        this.progressBar = this.add.graphics();
        this.progressWidth = 0;
        this.progressTargetWidth = 296;

        // Анимация полосы прогресса / Progress bar animation
        this.tweens.add({
            targets: this,
            progressWidth: this.progressTargetWidth,
            duration: 8000,
            ease: 'Sine.easeInOut',
            repeat: -1,
            yoyo: true,
            onUpdate: () => {
                this.progressBar.clear();
                
                // Градиентная полоса прогресса / Gradient progress bar
                const gradient = this.progressBar;
                gradient.fillStyle(0x6c5ce7, 1);
                gradient.fillRoundedRect(centerX - 148, centerY + 152, this.progressWidth, 8, 4);
                
                // Эффект подсветки / Highlight effect
                gradient.fillStyle(0xa29bfe, 0.5);
                gradient.fillRoundedRect(centerX - 148, centerY + 152, this.progressWidth, 4, 2);
            }
        });
    }

    createTips(centerX, height) {
        // Двуязычные подсказки / Bilingual tips
        const tips = [
            '💡 ИИ анализирует ваши творческие идеи...\n    AI is analyzing your creative needs...',
            '🎨 Хорошая игра требует немного терпения...\n    Great games take a little patience...',
            '🚀 Каждый пиксель создаётся с заботой...\n    Every pixel is being carefully crafted...',
            '⭐ Вдохновение течёт из вселенной...\n    Inspiration is flowing from the universe...',
            '🎮 Ваш уникальный игровой мир строится...\n    Your unique game world is being built...',
            '✨ Магии нужно время, чтобы проявиться...\n    Magic takes time to cast...'
        ];

        this.currentTipIndex = 0;
        this.tipText = this.add.text(centerX, height - 70, tips[0], {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#b2bec3',
            align: 'center'
        }).setOrigin(0.5);

        // Анимация смены подсказок / Tip rotation animation
        this.time.addEvent({
            delay: 4000,
            callback: () => {
                this.currentTipIndex = (this.currentTipIndex + 1) % tips.length;
                
                // Плавное затухание и появление / Fade out then fade in
                this.tweens.add({
                    targets: this.tipText,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        this.tipText.setText(tips[this.currentTipIndex]);
                        this.tweens.add({
                            targets: this.tipText,
                            alpha: 1,
                            duration: 300
                        });
                    }
                });
            },
            loop: true
        });

        // Нижняя информация / Footer
        this.add.text(centerX, height - 20, 'Powered by Genie ✨', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#636e72'
        }).setOrigin(0.5);
    }

    createFloatingDecorations(width, height) {
        // Плавающие декоративные элементы / Floating decorative elements
        const decorations = ['⭐', '✨', '💫', '🌟', '🚀', '🎮', '✈️', '🛸'];
        
        for (let i = 0; i < 12; i++) {
            const x = Phaser.Math.Between(50, width - 50);
            const y = Phaser.Math.Between(50, height - 100);
            const emoji = decorations[Phaser.Math.Between(0, decorations.length - 1)];
            
            const decoration = this.add.text(x, y, emoji, {
                fontSize: Phaser.Math.Between(16, 28) + 'px'
            }).setAlpha(Phaser.Math.FloatBetween(0.3, 0.6));

            // Анимация покачивания / Floating animation
            this.tweens.add({
                targets: decoration,
                y: y + Phaser.Math.Between(-30, 30),
                x: x + Phaser.Math.Between(-20, 20),
                alpha: { from: decoration.alpha, to: decoration.alpha * 0.5 },
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Анимация вращения / Rotation animation
            this.tweens.add({
                targets: decoration,
                angle: { from: -15, to: 15 },
                duration: Phaser.Math.Between(2000, 4000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    update() {
        // Обновляем орбитальные частицы / Update orbiting particles
        if (this.particles && this.particleCenter) {
            this.particles.forEach(p => {
                p.angle += p.speed;
                p.graphic.x = this.particleCenter.x + Math.cos(p.angle) * p.radius;
                p.graphic.y = this.particleCenter.y + Math.sin(p.angle) * p.radius;
            });
        }
    }
}

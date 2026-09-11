// Сцена интерьера здания (таверна, кузница, дома жителей, дом старосты).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { INTERIORS } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { createButton } from '../utils/ui.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd } from '../data/thief.js';

export class InteriorScene extends Phaser.Scene {
    constructor() {
        super('Interior');
    }

    init(data) {
        this.interiorId = data?.interiorId || 'elder_house';
        this.from = data?.from || 'Village';
    }

    create() {
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);
        this.audioManager.playSceneMusic('village'); // ambient деревни

        const interior = INTERIORS[this.interiorId];
        if (!interior) {
            console.error('Interior not found:', this.interiorId);
            this.scene.start(this.from);
            return;
        }
        this.interior = interior;

        // ----- Фон интерьера — деревянные стены + пол -----
        // Стены (тёмное дерево)
        this.cameras.main.setBackgroundColor(RUS.panel);
        // Пол
        const floorGfx = this.add.graphics();
        floorGfx.fillStyle(0x5a3820, 1);
        floorGfx.fillRect(0, 100, width, height - 100);
        // Доски пола
        for (let y = 100; y < height; y += 32) {
            floorGfx.lineStyle(1, 0x3a2410, 1);
            floorGfx.lineBetween(0, y, width, y);
        }
        for (let x = 0; x < width; x += 96) {
            floorGfx.lineStyle(1, 0x3a2410, 1);
            floorGfx.lineBetween(x, 100, x, height);
        }

        // Стены (верхняя часть)
        const wallGfx = this.add.graphics();
        wallGfx.fillStyle(0x4a3018, 1);
        wallGfx.fillRect(0, 0, width, 100);
        // Брёвна стен
        for (let y = 0; y < 100; y += 16) {
            wallGfx.lineStyle(2, 0x2a1808, 1);
            wallGfx.lineBetween(0, y, width, y);
        }

        // Окно (декорация)
        const winGfx = this.add.graphics();
        winGfx.fillStyle(0x1a2a3a, 1);
        winGfx.fillRect(width - 200, 20, 120, 60);
        winGfx.lineStyle(3, 0x2a1808, 1);
        winGfx.strokeRect(width - 200, 20, 120, 60);
        winGfx.lineBetween(width - 140, 20, width - 140, 80);
        winGfx.lineBetween(width - 200, 50, width - 80, 50);

        // ----- Заголовок интерьера -----
        this.add.text(width / 2, 20, interior.name, {
            fontSize: '24px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(50);

        // ----- Описание интерьера -----
        this.add.text(20, 60, interior.description, {
            fontSize: '14px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0).setDepth(50);

        // ----- NPC в интерьере -----
        this.npcSprite = this.add.sprite(width * 0.65, height * 0.55, interior.npcSprite, 0).setScale(2.5);
        this.npcSprite.play(`${interior.npcSprite}_idle_down`);
        // Лёгкое дыхание
        this.tweens.add({
            targets: this.npcSprite,
            scaleX: { from: 2.5, to: 2.55 },
            scaleY: { from: 2.5, to: 2.45 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Имя NPC
        this.add.text(this.npcSprite.x, this.npcSprite.y + 80, interior.npcName, {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);

        // ----- Игрок (слева от NPC) -----
        this.player = this.registry.get('player');
        this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, 'player', 0).setScale(2.5);
        this.playerSprite.play('player_idle_right');
        this.tweens.add({
            targets: this.playerSprite,
            y: { from: height * 0.55, to: height * 0.55 - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ----- Декорации в зависимости от типа интерьера -----
        this.addDecorations(interior);

        // ----- HUD -----
        this.hud = this.add.text(16, height - 60, '', {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);
        this.updateHUD();

        // ----- Кнопка "Поговорить" -----
        createButton(this, width / 2 - 100, height - 50, 'Поговорить', () => {
            ActionLog.add(this.registry, `Поговорил с ${interior.npcName} в «${interior.name}».`);
            this.activeNpc = {
                id: interior.npcId,
                name: interior.npcName,
                portrait: interior.portrait,
            };
            this.busyDialog = true;
            this.dialogue.run(interior.dialogueId, () => {
                this.busyDialog = false;
                // После диалога проверяем конец игры
                const end = checkGameEnd(this.registry);
                if (end) this.scene.start('End');
            });
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 18, padding: { left: 20, right: 20, top: 12, bottom: 12 },
            cornerRadius: 8,
        });

        // ----- Кнопка "Выйти" -----
        createButton(this, width / 2 + 100, height - 50, 'Выйти', () => {
            this.scene.start(this.from);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 18, padding: { left: 20, right: 20, top: 12, bottom: 12 },
            cornerRadius: 8,
        });

        this.busyDialog = false;
    }

    /**
     * Добавить декорации в зависимости от типа интерьера.
     */
    addDecorations(interior) {
        const { width, height } = this.scale;
        const decor = interior.decor || [];

        if (interior.id === 'tavern') {
            // Барная стойка
            this.add.rectangle(width * 0.5, height * 0.4, 200, 30, 0x6a4020)
                .setStrokeStyle(2, 0x3a2010);
            // Бочки
            this.add.circle(width * 0.85, height * 0.35, 30, 0x8a5a20)
                .setStrokeStyle(2, 0x3a2010);
            this.add.circle(width * 0.9, height * 0.35, 30, 0x8a5a20)
                .setStrokeStyle(2, 0x3a2010);
            // Камин
            this.add.rectangle(60, height * 0.4, 80, 60, 0x2a1a10)
                .setStrokeStyle(3, 0x1a0a05);
            // Огонь в камине
            const fire = this.add.image(60, height * 0.42, 'deco_campfire').setScale(1.5);
            this.tweens.add({
                targets: fire,
                scaleX: { from: 1.4, to: 1.6 },
                scaleY: { from: 1.4, to: 1.6 },
                duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        } else if (interior.id === 'blacksmith') {
            // Наковальня
            this.add.rectangle(width * 0.5, height * 0.5, 60, 40, 0x2a2a2a)
                .setStrokeStyle(2, 0x1a1a1a);
            // Горн
            this.add.rectangle(width * 0.85, height * 0.4, 100, 80, 0x4a2a10)
                .setStrokeStyle(2, 0x2a1a05);
            // Огонь в горне
            const forge = this.add.image(width * 0.85, height * 0.42, 'deco_campfire').setScale(1.8);
            this.tweens.add({
                targets: forge,
                scaleX: { from: 1.7, to: 1.9 },
                scaleY: { from: 1.7, to: 1.9 },
                duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            // Оружие на стене
            this.add.text(width * 0.2, 80, '⚔ 🔨 🛡', {
                fontSize: '32px',
            }).setOrigin(0.5);
        } else if (interior.id === 'elder_house') {
            // Стол с бумагами
            this.add.rectangle(width * 0.5, height * 0.5, 150, 40, 0x6a4020)
                .setStrokeStyle(2, 0x3a2010);
            // Свеча
            this.add.circle(width * 0.5, height * 0.42, 6, 0xffcc40);
            this.add.circle(width * 0.5, height * 0.42, 3, 0xffff80);
            // Иконы в углу
            this.add.text(width - 80, height * 0.4, '✝', {
                fontSize: '48px', color: '#c9a14a',
            }).setOrigin(0.5);
        } else {
            // Обычный дом — кровать + стол
            this.add.rectangle(width * 0.5, height * 0.5, 100, 50, 0x6a4020)
                .setStrokeStyle(2, 0x3a2010);
            // Кровать
            this.add.rectangle(width * 0.85, height * 0.5, 80, 60, 0x4a3a30)
                .setStrokeStyle(2, 0x2a1a10);
            this.add.rectangle(width * 0.85, height * 0.5 - 10, 80, 20, 0xe8d7a8);
        }
    }

    updateHUD() {
        const p = this.player;
        const q = this.registry.get('quest') || {};
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}   ✦ Воля ${p.MP}/${p.MPmax}   ◈ ${q.gold || 0} з.`);
    }
}

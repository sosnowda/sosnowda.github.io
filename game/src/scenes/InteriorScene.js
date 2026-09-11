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

        // ----- Фон интерьера — запасной цвет (если текстуры не загрузились) -----
        this.cameras.main.setBackgroundColor(RUS.panel);

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
        const ts = 32;

        // Текстура деревянного пола по всей нижней части
        if (this.textures.exists('int_floor_0')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 100; y < height; y += ts) {
                    const v = ((x + y) / ts) % 2;
                    this.add.image(x + ts / 2, y + ts / 2, `int_floor_${v}`).setOrigin(0.5).setDepth(0);
                }
            }
        }
        // Стены (верхняя часть)
        if (this.textures.exists('int_wall')) {
            for (let x = 0; x < width; x += ts) {
                for (let y = 0; y < 100; y += ts) {
                    this.add.image(x + ts / 2, y + ts / 2, 'int_wall').setOrigin(0.5).setDepth(0);
                }
            }
        }
        // Окно
        if (this.textures.exists('int_window')) {
            this.add.image(width - 140, 50, 'int_window').setScale(2).setDepth(0);
        }

        if (interior.id === 'tavern') {
            // Барная стойка
            if (this.textures.exists('int_deco_bar')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_bar').setScale(1.5).setDepth(5);
            }
            // Бочки
            if (this.textures.exists('int_deco_barrel')) {
                this.add.image(width * 0.85, height * 0.4, 'int_deco_barrel').setScale(1.5).setDepth(5);
                this.add.image(width * 0.92, height * 0.4, 'int_deco_barrel').setScale(1.5).setDepth(5);
            }
            // Камин с анимированным огнём
            if (this.textures.exists('int_deco_fireplace')) {
                this.add.image(80, height * 0.45, 'int_deco_fireplace').setScale(1.2).setDepth(5);
            }
            if (this.textures.exists('int_fire_0')) {
                const fire = this.add.image(80, height * 0.5, 'int_fire_0').setScale(2).setDepth(6);
                let fireFrame = 0;
                this.time.addEvent({
                    delay: 100,
                    callback: () => {
                        fireFrame = (fireFrame + 1) % 4;
                        fire.setTexture(`int_fire_${fireFrame}`);
                    },
                    loop: true,
                });
            }
            // Столы и стулья
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.25, height * 0.65, 'int_deco_table').setScale(1).setDepth(5);
                this.add.image(width * 0.75, height * 0.7, 'int_deco_table').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_chair')) {
                this.add.image(width * 0.25 - 30, height * 0.65, 'int_deco_chair').setScale(1).setDepth(5);
                this.add.image(width * 0.75 + 30, height * 0.7, 'int_deco_chair').setScale(1).setDepth(5);
            }
        } else if (interior.id === 'blacksmith') {
            // Наковальня
            if (this.textures.exists('int_deco_anvil')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_anvil').setScale(1.5).setDepth(5);
            }
            // Горн с огнём
            this.add.rectangle(width * 0.85, height * 0.4, 100, 80, 0x4a2a10)
                .setStrokeStyle(2, 0x2a1a05).setDepth(4);
            if (this.textures.exists('int_fire_0')) {
                const forge = this.add.image(width * 0.85, height * 0.42, 'int_fire_0').setScale(2.5).setDepth(5);
                let fireFrame = 0;
                this.time.addEvent({
                    delay: 80,
                    callback: () => {
                        fireFrame = (fireFrame + 1) % 4;
                        forge.setTexture(`int_fire_${fireFrame}`);
                    },
                    loop: true,
                });
            }
            // Оружие на стене
            this.add.text(width * 0.2, 80, '⚔ 🔨 🛡', {
                fontSize: '32px',
            }).setOrigin(0.5).setDepth(10);
        } else if (interior.id === 'elder_house') {
            // Стол
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.5, height * 0.55, 'int_deco_table').setScale(1.2).setDepth(5);
            }
            // Свеча на столе
            if (this.textures.exists('int_deco_candle')) {
                this.add.image(width * 0.5, height * 0.45, 'int_deco_candle').setScale(1.5).setDepth(6);
            }
            // Икона в углу
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1.5).setDepth(5);
            }
        } else {
            // Обычный дом — кровать + стол + икона
            if (this.textures.exists('int_deco_table')) {
                this.add.image(width * 0.4, height * 0.55, 'int_deco_table').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_bed')) {
                this.add.image(width * 0.8, height * 0.55, 'int_deco_bed').setScale(1).setDepth(5);
            }
            if (this.textures.exists('int_deco_icon_wall')) {
                this.add.image(width - 80, height * 0.4, 'int_deco_icon_wall').setScale(1).setDepth(5);
            }
        }
    }

    updateHUD() {
        const p = this.player;
        const q = this.registry.get('quest') || {};
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}   ✦ Воля ${p.MP}/${p.MPmax}   ◈ ${q.gold || 0} з.`);
    }
}

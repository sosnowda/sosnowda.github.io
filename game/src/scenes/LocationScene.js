// Сцена локации (лес/тракт/река/поле) — поиск следов вора.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { FORK_LOCATIONS } from '../data/interiors.js';
import { THIEF_LOCATIONS } from '../data/thief.js';
import { searchLocation, getHuntState, checkGameEnd } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';

const LOCATION_BG = {
    forest: 0x1a2a1a,
    road: 0x4a3a2a,
    river: 0x1a3a4a,
    field: 0x4a5a2a,
};

export class LocationScene extends Phaser.Scene {
    constructor() {
        super('Location');
    }

    init(data) {
        this.locationId = data?.locationId || 'forest';
        this.from = data?.from || 'Fork';
    }

    create() {
        const { width, height } = this.scale;
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.audioManager.playSceneMusic('village');

        const loc = FORK_LOCATIONS.find(l => l.id === this.locationId);
        const state = getHuntState(this.registry);

        // ----- Фон локации -----
        this.cameras.main.setBackgroundColor(LOCATION_BG[this.locationId] || 0x1a2a1a);
        this.drawLocationBackground(this.locationId, width, height);

        // ----- Заголовок -----
        this.add.text(width / 2, 30, `${loc.icon} ${loc.name}`, {
            fontSize: '32px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 80, loc.description, {
            fontSize: '14px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5, 0);

        // ----- HUD -----
        const player = this.registry.get('player');
        const q = this.registry.get('quest') || {};
        this.add.text(16, 12, `❤ ${player.HP}/${player.HPmax}   ✦ Воля ${player.MP}/${player.MPmax}   ⚔ Меч ${player.skills.sword}%`, {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);
        this.turnsText = this.add.text(16, 40, `⏳ Ходов: ${state.turnsLeft}`, {
            fontSize: '14px', color: state.turnsLeft <= 3 ? '#ff4040' : '#ff8060',
            backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);

        // ----- Игрок -----
        this.playerSprite = this.add.sprite(width * 0.2, height * 0.6, 'player', 0).setScale(2.5);
        this.playerSprite.play('player_idle_right');
        this.tweens.add({
            targets: this.playerSprite,
            y: { from: height * 0.6, to: height * 0.6 - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ----- Состояние поиска -----
        const alreadySearched = state.locationsSearched.includes(this.locationId);
        if (alreadySearched) {
            this.add.text(width / 2, height * 0.4, 'Ты уже обыскивал эту местность.\nНовых следов здесь не найти.', {
                fontSize: '18px', color: RUS.textDim, align: 'center',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5);
        }

        // ----- Кнопка "Искать следы" -----
        if (!alreadySearched) {
            createButton(this, width / 2, height - 100, '🔍 Искать следы (проверка Внимательности)', () => {
                this.doSearch();
            }, {
                backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
                fontSize: 18, padding: { left: 24, right: 24, top: 14, bottom: 14 },
                cornerRadius: 8,
            });
        }

        // ----- Кнопка "Назад к развилке" -----
        createButton(this, width / 2, height - 50, '◀ Назад к развилке', () => {
            this.scene.start(this.from);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 12, bottom: 12 },
            cornerRadius: 8,
        });
    }

    /**
     * Нарисовать фон локации в зависимости от типа.
     */
    drawLocationBackground(locId, width, height) {
        const gfx = this.add.graphics();
        if (locId === 'forest') {
            // Лес — тёмный зелёный фон + деревья
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 150);
                const scale = 2 + Math.random() * 2;
                this.add.image(x, y, `tile_forest_${i % 2}`).setScale(scale).setOrigin(0.5, 0.7).setAlpha(0.8);
            }
        } else if (locId === 'road') {
            // Тракт — коричневая дорога
            gfx.fillStyle(0x6a4a2a, 1);
            gfx.fillRect(width / 2 - 100, 100, 200, height - 100);
            // Камни
            for (let i = 0; i < 15; i++) {
                const x = width / 2 - 80 + Math.random() * 160;
                const y = 120 + Math.random() * (height - 150);
                this.add.image(x, y, `tile_rock_${i % 2}`).setScale(1.5);
            }
            // Деревья по бокам
            for (let i = 0; i < 10; i++) {
                const x = (i % 2 === 0) ? Math.random() * 200 : width - Math.random() * 200;
                const y = 100 + Math.random() * (height - 150);
                this.add.image(x, y, `tile_forest_${i % 2}`).setScale(2.5).setOrigin(0.5, 0.7);
            }
        } else if (locId === 'river') {
            // Река — синяя вода
            gfx.fillStyle(0x3a6b8c, 1);
            gfx.fillRect(0, height * 0.5, width, height * 0.5);
            // Анимированные волны
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * width;
                const y = height * 0.5 + Math.random() * (height * 0.5);
                const water = this.add.image(x, y, `tile_water_${i % 3}`).setScale(1.5);
                this.tweens.add({
                    targets: water,
                    x: x + 20,
                    duration: 2000 + Math.random() * 2000,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
            // Берег
            gfx.fillStyle(0x6a4a2a, 1);
            gfx.fillRect(0, height * 0.5 - 20, width, 20);
            // Камыши
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * width;
                this.add.image(x, height * 0.5 - 10, 'tile_forest_0').setScale(1.5).setOrigin(0.5, 1);
            }
        } else if (locId === 'field') {
            // Поле — высокая трава
            gfx.fillStyle(0x6a8a3a, 1);
            gfx.fillRect(0, 100, width, height - 100);
            // Стебли
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 150);
                const stem = this.add.image(x, y, 'tile_grass_0').setScale(2);
                this.tweens.add({
                    targets: stem,
                    angle: { from: -5, to: 5 },
                    duration: 1500 + Math.random() * 1500,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        }
    }

    /**
     * Выполнить поиск следов вора.
     */
    doSearch() {
        const result = searchLocation(this.registry, this.locationId);
        this.turnsText.setText(`⏳ Ходов: ${result.turnsLeft}`);
        if (result.turnsLeft <= 3) this.turnsText.setColor('#ff4040');
        else if (result.turnsLeft <= 6) this.turnsText.setColor('#ffaa40');

        // Если вор сбежал — переход к концу
        if (result.thiefEscaped) {
            this.time.delayedCall(1500, () => this.scene.start('End'));
            return;
        }

        // Показать результат поиска через диалог
        const loc = FORK_LOCATIONS.find(l => l.id === this.locationId);
        const title = result.found ? '✨ Следы найдены!' : '🔍 Поиск следов';

        createDialog(this, title, result.message, [
            {
                text: result.found ? 'Погоня!' : 'Продолжить',
                callback: () => {
                    if (result.found) {
                        // Переход к бою с вором
                        this.scene.start('Combat', { enemyKeys: ['thief'], npcId: 'thief', fromLocation: this.locationId });
                    }
                    // Иначе — остаёмся в локации, но кнопка "искать" уже неактивна
                    this.scene.restart({ locationId: this.locationId, from: this.from });
                },
            },
        ], {
            singleton: false,
            portraitKey: result.found ? 'portrait_bandit' : 'portrait_narrator',
            typing: true,
            typingSpeed: 30,
        });
    }
}

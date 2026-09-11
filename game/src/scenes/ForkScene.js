// Развилка: после выхода из деревни игрок выбирает локацию для поиска вора.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { FORK_LOCATIONS } from '../data/interiors.js';
import { getHuntState } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';

export class ForkScene extends Phaser.Scene {
    constructor() {
        super('Fork');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x2a3a2a);
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.audioManager.playSceneMusic('village');

        const q = this.registry.get('quest') || {};
        const state = getHuntState(this.registry);

        // ----- Фон: дорога с указателем -----
        // Земля
        this.add.rectangle(0, 0, width, height, 0x3a2a1a).setOrigin(0);
        // Тропа в центр
        this.add.rectangle(width / 2, 0, 200, height, 0x6a4020).setOrigin(0.5, 0);
        // Деревья по бокам
        for (let i = 0; i < 6; i++) {
            const x = (i % 2 === 0) ? 40 + Math.random() * 200 : width - 40 - Math.random() * 200;
            const y = 50 + i * 100;
            this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7);
        }

        // ----- Заголовок -----
        this.add.text(width / 2, 30, 'Развилка', {
            fontSize: '32px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 80, 'Куда пойдёшь искать вора?', {
            fontSize: '18px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ----- HUD: счётчик ходов -----
        const turnsLeft = state.turnsLeft;
        this.add.text(width / 2, 110, `⏳ Ходов до побега вора: ${turnsLeft}`, {
            fontSize: '18px', color: turnsLeft <= 3 ? '#ff4040' : '#ff8060',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ----- Подсказки, собранные у жителей -----
        if (state.cluesGathered && state.cluesGathered.length > 0) {
            let cluesText = 'Улики от жителей:\n';
            state.cluesGathered.forEach((c) => {
                cluesText += `• ${c.npcName}: ${c.clue}\n`;
            });
            this.add.text(20, 150, cluesText, {
                fontSize: '13px', color: '#c9a14a',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 8, y: 6 },
                wordWrap: { width: 300 },
            }).setOrigin(0, 0).setDepth(50);
        }

        // ----- Кнопки локаций -----
        const btnW = 220, btnH = 80;
        const startY = 200;
        const gap = 12;

        FORK_LOCATIONS.forEach((loc, i) => {
            const x = width / 2;
            const y = startY + i * (btnH + gap);
            // Проверяем, не обыскивали ли уже
            const alreadySearched = state.locationsSearched.includes(loc.id);
            const label = alreadySearched ? `${loc.icon} ${loc.name} (обыскано)` : `${loc.icon} ${loc.name}`;

            createButton(this, x, y, label, () => {
                ActionLog.add(this.registry, `Игрок отправился в локацию «${loc.name}».`);
                this.scene.start('Location', { locationId: loc.id, from: 'Fork' });
            }, {
                backgroundColor: alreadySearched ? 0x3a3a3a : 0x4a6a4a,
                hoverColor: alreadySearched ? 0x4a4a4a : 0x5a7a5a,
                pressColor: 0x2a3a2a,
                textColor: alreadySearched ? '#888' : RUS.text,
                fontSize: 18, padding: { left: 20, right: 20, top: 16, bottom: 16 },
                cornerRadius: 8,
            });
        });

        // ----- Кнопка "Вернуться в деревню" -----
        createButton(this, width / 2, startY + FORK_LOCATIONS.length * (btnH + gap) + 20, '◀ Вернуться в деревню', () => {
            this.scene.start('Village');
        }, {
            backgroundColor: 0x5a4030, hoverColor: 0x6a5040, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 14, bottom: 14 },
            cornerRadius: 8,
        });

        // ----- Описание выбранной локации (под кнопками) -----
        this.locationDesc = this.add.text(width / 2, height - 80, 'Наведи на локацию, чтобы увидеть описание', {
            fontSize: '14px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            backgroundColor: '#00000088', padding: { x: 10, y: 6 },
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5, 0).setDepth(50);
    }
}

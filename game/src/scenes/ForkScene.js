// Развилка: после выхода из деревни игрок выбирает локацию.
// Теперь использует расширенную карту местности (п.2,3) и отображает время (п.13).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { getHuntState } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { getForkLocations } from '../data/mapLocations.js';
import { getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';

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
        this.add.rectangle(0, 0, width, height, 0x3a2a1a).setOrigin(0);
        this.add.rectangle(width / 2, 0, 200, height, 0x6a4020).setOrigin(0.5, 0);
        for (let i = 0; i < 6; i++) {
            const x = (i % 2 === 0) ? 40 + Math.random() * 200 : width - 40 - Math.random() * 200;
            const y = 50 + i * 100;
            this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7);
        }

        // ----- Заголовок -----
        this.add.text(width / 2, 20, 'Околица деревни', {
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 55, 'Куда пойдёшь?', {
            fontSize: '16px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ----- Дата и время (п.13) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            this.add.text(width / 2, 78, `📅 ${formatDateTime(timeState)}`, {
                fontSize: '12px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0);
        }

        // ----- HUD: счётчик ходов -----
        const turnsLeft = state.turnsLeft;
        this.add.text(width / 2, 105, `⏳ Ходов до побега вора: ${turnsLeft}`, {
            fontSize: '14px', color: turnsLeft <= 3 ? '#ff4040' : '#ff8060',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ----- Подсказки, собранные у жителей -----
        if (state.cluesGathered && state.cluesGathered.length > 0) {
            let cluesText = 'Улики от жителей:\n';
            state.cluesGathered.forEach((c) => {
                cluesText += `• ${c.npcName}: ${c.clue}\n`;
            });
            this.add.text(20, 135, cluesText, {
                fontSize: '12px', color: '#c9a14a',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 8, y: 6 },
                wordWrap: { width: 280 },
            }).setOrigin(0, 0).setDepth(50);
        }

        // ----- Overlay дня/ночи -----
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- Кнопки локаций (расширенная карта, п.2,3) -----
        const locations = getForkLocations();
        const btnH = 36;
        const startY = 140;
        const gap = 4;

        locations.forEach((loc, i) => {
            const x = width / 2;
            const y = startY + i * (btnH + gap);
            const alreadySearched = state.locationsSearched.includes(loc.id);
            const label = `${loc.icon} ${loc.name}${alreadySearched ? ' (обыскано)' : ''}`;

            createButton(this, x, y, label, () => {
                ActionLog.add(this.registry, `Игрок отправился в локацию «${loc.name}».`);
                this.scene.start('Location', { locationId: loc.id, from: 'Fork' });
            }, {
                backgroundColor: alreadySearched ? 0x3a3a3a : 0x4a6a4a,
                hoverColor: alreadySearched ? 0x4a4a4a : 0x5a7a5a,
                pressColor: 0x2a3a2a,
                textColor: alreadySearched ? '#888' : RUS.text,
                fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
                cornerRadius: 6,
            });
        });

        // ----- Кнопка "Вернуться в деревню" -----
        const backBtnY = startY + locations.length * (btnH + gap) + 20;
        createButton(this, width / 2, backBtnY, '◀ Вернуться в деревню', () => {
            this.scene.start('Village');
        }, {
            backgroundColor: 0x5a4030, hoverColor: 0x6a5040, textColor: RUS.text,
            fontSize: 16, padding: { left: 24, right: 24, top: 10, bottom: 10 },
            cornerRadius: 8,
        });
    }
}

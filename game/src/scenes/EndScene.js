// Финальная сцена: окно с логом всех действий игрока и оценкой.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { ActionLog } from '../data/actionLog.js';
import { getHuntState, checkGameEnd } from '../data/thief.js';
import { createButton } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';

export class EndScene extends Phaser.Scene {
    constructor() {
        super('End');
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x0a0604);
        this.audioManager = new AudioManager(this);
        this.audioManager.playSceneMusic('menu');

        const quest = this.registry.get('quest') || {};
        const state = getHuntState(this.registry);
        const finalOutcome = checkGameEnd(this.registry); // 'victory' | 'defeat_thief_escaped' | 'defeat_hero_dead' | null
        const log = ActionLog.get(this.registry);
        const rating = log ? log.getRating(finalOutcome) : { stars: 0, title: 'Неизвестно', comment: '', stats: {} };

        // Определяем тип финала
        let endType = 'defeat';
        let endTitle = '';
        let endColor = '';
        if (quest.thiefDefeated) {
            endType = 'victory';
            endTitle = '🏆 ПОБЕДА!';
            endColor = '#ffcc40';
            this.audioManager.playLevelUp();
        } else if (quest.thiefEscaped) {
            endType = 'defeat';
            endTitle = '🏃 ВОР СБЕЖАЛ';
            endColor = '#ff6040';
        } else if (quest.heroDead) {
            endType = 'defeat';
            endTitle = '☠ ГЕРОЙ ПАЛ';
            endColor = '#ff4040';
        }

        // ----- Затемнённый фон с золотой рамкой -----
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
        const panelW = width - 200;
        const panelH = height - 120;
        const panelX = (width - panelW) / 2;
        const panelY = 60;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x1a1008, 0.95)
            .setStrokeStyle(4, 0xc9a14a, 1);

        // ----- Заголовок финала -----
        this.add.text(width / 2, panelY + 30, endTitle, {
            fontSize: '48px', color: endColor, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5, 0);

        // ----- Оценка (звёзды) -----
        const starsText = '★'.repeat(rating.stars) + '☆'.repeat(5 - rating.stars);
        this.add.text(width / 2, panelY + 90, starsText, {
            fontSize: '40px', color: '#ffcc40',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        // ----- Подзаголовок оценки -----
        this.add.text(width / 2, panelY + 140, rating.title, {
            fontSize: '24px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ----- Комментарий -----
        this.add.text(width / 2, panelY + 175, rating.comment, {
            fontSize: '15px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: panelW - 80 },
            align: 'center',
        }).setOrigin(0.5, 0);

        // ----- Статистика -----
        const stats = rating.stats || {};
        const statsText = [
            `Всего действий: ${stats.total || 0}`,
            `Поисков следов: ${stats.searches || 0}`,
            `Бесед с жителями: ${stats.talks || 0}`,
            `Провалов проверок: ${stats.failed || 0}`,
        ].join('   |   ');
        this.add.text(width / 2, panelY + 220, statsText, {
            fontSize: '13px', color: '#c9a14a',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5, 0);

        // ----- Лог действий -----
        this.add.text(width / 2, panelY + 260, '📜 Хроника действий:', {
            fontSize: '18px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // Контейнер лога с прокруткой (через Text с wordWrap)
        const logText = log ? log.getFormattedText().join('\n') : 'Лог пуст';
        const logBox = this.add.text(width / 2, panelY + 295, logText, {
            fontSize: '12px', color: RUS.text,
            fontFamily: 'Courier New, monospace',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: panelW - 100 },
            align: 'left',
        }).setOrigin(0.5, 0);

        // Обрезаем лог, если он слишком длинный
        const maxLogHeight = panelH - 360;
        if (logBox.height > maxLogHeight) {
            const lines = log.getFormattedText();
            const visibleLines = lines.slice(-Math.floor(maxLogHeight / 14));
            logBox.setText('...\n' + visibleLines.join('\n'));
        }

        // ----- Кнопки -----
        const btnY = panelY + panelH - 50;
        createButton(this, width / 2 - 130, btnY, 'Новая игра', () => {
            // Очистка состояния
            this.registry.set('quest', null);
            this.registry.set('actionLog', null);
            this.scene.start('Title');
        }, {
            backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 12, bottom: 12 },
            cornerRadius: 8,
        });

        createButton(this, width / 2 + 130, btnY, 'В меню', () => {
            this.scene.start('Title');
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 18, padding: { left: 24, right: 24, top: 12, bottom: 12 },
            cornerRadius: 8,
        });

        // Затемнение для драматичности
        this.cameras.main.fadeIn(800, 0, 0, 0);
    }
}

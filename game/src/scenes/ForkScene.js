// Развилка: после выхода из деревни игрок выбирает локацию.
// Теперь использует расширенную карту местности (п.2,3) и отображает время (п.13).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { getHuntState, isChaseActive, chaseTicksLeft, checkGameEnd } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog, bindRestartOnResize } from '../utils/ui.js';
// Раунд 32 (пп.14,15): F1 — «Информация по игре» со соотношением времени 1:30
import { timeRatioInfoLine } from '../systems/WorldClock.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { getForkLocations } from '../data/mapLocations.js';
import { getTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
// Раунд 32 (п.5): ЛЮБОЕ перемещение между локациями по карте = ровно 1 час
export const MAP_TRAVEL_MINUTES = 60;
import { getWeather } from '../systems/Weather.js';
import { getVillageName } from '../data/world.js';
import { t, tf } from '../systems/i18n.js';
import { onLocationVisited } from '../data/questGenerator.js';
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock } from '../systems/WorldClock.js';

export class ForkScene extends Phaser.Scene {
    constructor() {
        super('Fork');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x2a3a2a);
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.audioManager.playSceneMusic('village');
        // Раунд 31 (пп.11,12): мировые часы идут реальным временем (в диалогах стоят)
        attachWorldClock(this);
        attachChurchBells(this, { volume: 0.4 });

        const q = this.registry.get('quest') || {};
        const state = getHuntState(this.registry);

        // Раунд 32 (пп.14,15): F1 — «Информация по игре» (окно помощи и на развилке)
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ Информация по игре',
                timeRatioInfoLine() + '\n\n' +
                t('🗺 Околица — карта местности: выбирай локацию и в путь.\nКаждый переход по карте занимает ровно 1 игровой час.\nСледы вора живут от 12 до 24 часов — а дождь и снег смывают их и раньше.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singletonKey: 'fork-help' });
        });

        // ----- Фон: дорога с указателем -----
        this.add.rectangle(0, 0, width, height, 0x3a2a1a).setOrigin(0);
        this.add.rectangle(width / 2, 0, 200, height, 0x6a4020).setOrigin(0.5, 0);
        for (let i = 0; i < 6; i++) {
            const x = (i % 2 === 0) ? 40 + Math.random() * 200 : width - 40 - Math.random() * 200;
            const y = 50 + i * 100;
            this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7);
        }

        // ----- Заголовок -----
        this.add.text(width / 2, 20, t('Околица деревни'), {
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 55, t('Куда пойдёшь?'), {
            fontSize: '16px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ----- Дата и время (п.13) + погода дня (раунд 14) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            const weather = getWeather(this.registry);
            this.add.text(width / 2, 78, `📅 ${formatDateTime(timeState)}   ${weather.icon} ${weather.name}`, {
                fontSize: '12px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0);
        }

        // ----- HUD: отсчёт времени до побега вора (раунд 32: часы вместо тиков) -----
        if (isChaseActive(this.registry)) {
            const hoursLeft = chaseTicksLeft(this.registry);
            this.add.text(width / 2, 105, tf(t('⏳ Вор скроется примерно через {0} ч.'), hoursLeft), {
                fontSize: '14px', color: hoursLeft <= 3 ? '#ff4040' : '#ff8060',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5, 0);
        }

        // ----- Подсказки, собранные у жителей -----
        if (state.cluesGathered && state.cluesGathered.length > 0) {
            let cluesText = t('Улики от жителей:') + '\n';
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
        // Раунд 20: на низких экранах (телефон в ландшафте, узкие окна) —
        // ДВЕ колонки, чтобы все кнопки + «Назад» гарантированно влезали.
        // Раунд 30: локаций стало 11 (лес — тремя частями) — всегда две колонки.
        const locations = getForkLocations();
        const startY = 140;
        const twoCols = height < 640 || locations.length > 9;
        const cols = twoCols ? 2 : 1;
        const rows = Math.ceil(locations.length / cols);
        const colW = Math.min(320, (width - 40) / cols);
        const availH = Math.max(120, height - startY - 170);
        const step = Math.max(28, Math.min(40, Math.floor(availH / rows)));
        const btnH = step - 4;
        const gridLeft = width / 2 - (colW * (cols - 1)) / 2;

        locations.forEach((loc, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = twoCols ? (gridLeft - colW / 2 + col * colW + colW / 2) : width / 2;
            const y = startY + row * step;
            const alreadySearched = state.locationsSearched.includes(loc.id);
            const label = alreadySearched
                ? tf('{0} (обыскано)', `${loc.icon} ${loc.name}`)
                : `${loc.icon} ${loc.name}`;

            createButton(this, x, y, label, () => {
                ActionLog.add(this.registry, `Игрок отправился в локацию «${loc.name}».`);
                // Раунд 32 (п.5): ЛЮБОЕ перемещение по карте — РОВНО 1 игровой час
                tickTime(this.registry, MAP_TRAVEL_MINUTES);
                // Раунд 21: посещение локации может закрыть процедурное поручение
                onLocationVisited(this.registry, loc.id);
                // Раунд 20 (слияние Пасек): охотничья пасека = ходячая ApiaryScene
                if (loc.id === 'apiary') {
                    this.scene.start('Apiary', { from: 'Fork', hunt: true });
                    return;
                }
                this.scene.start('Location', { locationId: loc.id, from: 'Fork' });
            }, {
                backgroundColor: alreadySearched ? 0x3a3a3a : 0x4a6a4a,
                hoverColor: alreadySearched ? 0x4a4a4a : 0x5a7a5a,
                pressColor: 0x2a3a2a,
                textColor: alreadySearched ? '#888' : RUS.text,
                fontSize: twoCols ? 13 : 14, padding: { left: 12, right: 12, top: 6, bottom: 6 },
                cornerRadius: 6,
            });
        });

        // ----- Кнопка "Тёмный лес — прогулка" (раунд 13) -----
        // Раунд 30: чаща — теперь через опушку и поляну; прогулка остаётся
        // отдельной сценой лесной чащи (ForestScene).
        const backBtnY = startY + rows * step + 14;
        createButton(this, width / 2, backBtnY, t('🌲 Тёмный лес — прогулка'), () => {
            ActionLog.add(this.registry, 'Игрок отправился гулять в Тёмный лес.');
            tickTime(this.registry, MAP_TRAVEL_MINUTES); // раунд 32 (п.5): ровно 1 час
            this.scene.start('Forest', { from: 'Fork' });
        }, {
            backgroundColor: 0x2e4a2e, hoverColor: 0x3c5c3c, pressColor: 0x1e321e,
            textColor: '#c9e0b0',
            fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            cornerRadius: 6,
        });

        // ----- Кнопка "Пасека — прогулка" (раунд 17: пчёлы — только антураж) -----
        createButton(this, width / 2, backBtnY + 40, t('🐝 Пасека — прогулка'), () => {
            ActionLog.add(this.registry, 'Игрок отправился на Пасеку.');
            tickTime(this.registry, MAP_TRAVEL_MINUTES); // раунд 32 (п.5): ровно 1 час
            this.scene.start('Apiary', { from: 'Fork' });
        }, {
            backgroundColor: 0x5a4a1e, hoverColor: 0x6e5a28, pressColor: 0x3a3012,
            textColor: '#f0d890',
            fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            cornerRadius: 6,
        });

        // ----- Кнопка "Вернуться в деревню" -----
        createButton(this, width / 2, backBtnY + 80, t('◀ Вернуться в деревню'), () => {
            tickTime(this.registry, MAP_TRAVEL_MINUTES); // раунд 32 (п.5): ровно 1 час
            this.scene.start('Village');
        }, {
            backgroundColor: 0x5a4030, hoverColor: 0x6a5040, textColor: RUS.text,
            fontSize: 16, padding: { left: 24, right: 24, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // П.17: Кнопка "Карта" — показать карту местности
        createButton(this, width / 2, backBtnY + 118, t('🗺 Карта местности'), () => {
            this.showMap();
        }, {
            backgroundColor: 0x2a4a6a, hoverColor: 0x3a5a7a, textColor: RUS.text,
            fontSize: 16, padding: { left: 24, right: 24, top: 10, bottom: 10 },
            cornerRadius: 8,
        });
    }

    update() {
        // Раунд 21: побег вора или иные концы закрывают поход
        if (this.busyDialog) return;
        const endState = checkGameEnd(this.registry);
        if (endState) this.scene.start('End');
    }

    // П.17: Карта местности с указанием положения игрока
    showMap() {
        const { width, height } = this.scale;
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 700, panelH = 550;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x1a2a1a, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 20, t('🗺 Карта местности'), {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        // Рисуем карту: деревня в центре, локации вокруг
        const cx = width / 2;
        const cy = height / 2;
        const mapGfx = this.add.graphics().setDepth(202);

        // Деревня в центре
        mapGfx.fillStyle(0x4a7c3a, 1);
        mapGfx.fillCircle(cx, cy, 30);
        mapGfx.lineStyle(2, 0xc9a14a, 1);
        mapGfx.strokeCircle(cx, cy, 30);
        this.add.text(cx, cy, '🏠', { fontSize: '20px' }).setOrigin(0.5).setDepth(203);
        this.add.text(cx, cy + 35, getVillageName(), {
            fontSize: '12px', color: '#c9a14a',
        }).setOrigin(0.5).setDepth(203);

        // Локации вокруг деревни (п.4: финальный список).
        // Раунд 32: лес — ТРЕМЯ узлами (Опушка → Поляна → Чаща, раунд 30);
        // цепочка леса рисуется дугой на северо-западе: опушка ближе к деревне,
        // чаща — дальше всех. Все 11 узлов умещаются в панель 700×550.
        const positions = [
            { id: 'forest_edge', name: t('Опушка'), icon: '🌳', angle: -150, dist: 140 },
            { id: 'forest_glade', name: t('Поляна'), icon: '🌿', angle: -125, dist: 205 },
            { id: 'forest', name: t('Тёмный лес'), icon: '🌲', angle: -103, dist: 222 },
            { id: 'apiary', name: t('Пасека'), icon: '🐝', angle: -50, dist: 215 },
            { id: 'lake', name: t('Озеро'), icon: '🏞', angle: -20, dist: 250 },
            { id: 'pasture', name: t('Выпас'), icon: '🐄', angle: 8, dist: 170 },
            { id: 'field', name: t('Поле'), icon: '🌾', angle: 28, dist: 255 },
            { id: 'pogost', name: t('Погост'), icon: '⚰️', angle: 120, dist: 235 },
            { id: 'mill', name: t('Мельница'), icon: '🏭', angle: 145, dist: 265 },
            { id: 'road_south', name: t('Тракт'), icon: '🛤', angle: 92, dist: 165 },
            { id: 'river', name: t('Река'), icon: '🌊', angle: 178, dist: 185 },
        ];

        positions.forEach(pos => {
            const rad = Phaser.Math.DegToRad(pos.angle);
            const x = cx + Math.cos(rad) * pos.dist;
            const y = cy + Math.sin(rad) * pos.dist;
            // Линия от деревни к локации
            mapGfx.lineStyle(1, 0x5a5a3a, 0.5);
            mapGfx.lineBetween(cx, cy, x, y);
            // Точка локации
            mapGfx.fillStyle(0x3a5a3a, 1);
            mapGfx.fillCircle(x, y, 15);
            this.add.text(x, y, pos.icon, { fontSize: '16px' }).setOrigin(0.5).setDepth(203);
            this.add.text(x, y + 18, pos.name, {
                fontSize: '10px', color: '#a0a080',
            }).setOrigin(0.5).setDepth(203);
        });

        // Игрок — в деревне (зелёная точка)
        mapGfx.fillStyle(0x60ff60, 1);
        mapGfx.fillCircle(cx, cy - 5, 5);
        this.add.text(cx, cy - 20, '🧑', { fontSize: '14px' }).setOrigin(0.5).setDepth(203);

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 25, 140, 30, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 25, t('Закрыть'), {
            fontSize: '14px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeMap = () => {
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeMap);
        overlay.on('pointerup', closeMap);
    }
}

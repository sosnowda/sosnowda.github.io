// Развилка: после выхода из деревни игрок выбирает локацию.
// Теперь использует расширенную карту местности (п.2,3) и отображает время (п.13).
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { getHuntState, checkGameEnd, hintFreshness } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog, bindRestartOnResize, addSceneMenuButtons } from '../utils/ui.js';
// Раунд 32 (пп.14,15): F1 — «Информация по игре» со соотношением времени 1:30
import { timeRatioInfoLine } from '../systems/WorldClock.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { getForkLocations } from '../data/mapLocations.js';
// Раунд 66.24 (приказ 3): полноценная карта местности (TerrainMap)
import { drawTerrainMap, TERRAIN_W, TERRAIN_H, TERRAIN, TERRAIN_LABELS } from '../systems/TerrainMap.js';
import { getTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
// Раунд 32 (п.5): ЛЮБОЕ перемещение между локациями по карте = ровно 1 час
export const MAP_TRAVEL_MINUTES = 60;
import { getWeather } from '../systems/Weather.js';
// (импорт getVillageName снят в 66.24: имя деревни на карте рисует TerrainMap)
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
        // Раунд 66 (п.10): деревья по краям развилки — НОВЫЕ спрайты из пака
        // владельца Medieval_Expansion_Trees (deco_tree_*/deco_pine_*),
        // вместо старых квадратных тайлов tile_forest_*.
        this.add.rectangle(0, 0, width, height, 0x3a2a1a).setOrigin(0);
        this.add.rectangle(width / 2, 0, 200, height, 0x6a4020).setOrigin(0.5, 0);
        for (let i = 0; i < 6; i++) {
            const x = (i % 2 === 0) ? 40 + Math.random() * 200 : width - 40 - Math.random() * 200;
            const y = 50 + i * 100;
            const forkTex = (i % 3 === 0)
                ? `deco_pine_${i % 2}`
                : `deco_tree_${i % 5}`;
            if (this.textures.exists(forkTex)) {
                this.add.image(x, y, forkTex).setScale(1.4).setOrigin(0.5, 0.9);
            } else {
                this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7);
            }
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

        // ----- Раунд 66.12 (приказ владельца №6): отсчёт часов до побега вора
        // СКРЫТ из HUD — игрок не видит, сколько осталось до побега.
        // Внутренний счётчик погони работает как прежде (chaseTicksLeft). -----

        // Раунд 40 (заявка п.1): [📜 Персонаж] / [🎒 Инвентарь] на околице
        addSceneMenuButtons(this, 'Fork');

        // ----- Подсказки, собранные у жителей + счётчик свежести НАВОДКИ
        // (раунд 66.13, приказ владельца: процент выцветания наводки; БЕЗ
        // живых часов — р.66.12 №6) -----
        const hintFr66 = hintFreshness(this.registry);
        const hintLine66 = hintFr66
            ? (hintFr66.expired
                ? t('🧭 Наводка: устарела')
                : tf(t('🧭 Наводка: {0} ({1}%)'), hintFr66.label, hintFr66.pct))
            : null;
        if (state.cluesGathered && state.cluesGathered.length > 0) {
            let cluesText = t('Улики от жителей:') + '\n';
            state.cluesGathered.forEach((c) => {
                cluesText += `• ${c.npcName}: ${c.clue}\n`;
            });
            if (hintLine66) cluesText += hintLine66 + '\n';
            this.add.text(20, 135, cluesText, {
                fontSize: '12px', color: '#c9a14a',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 8, y: 6 },
                wordWrap: { width: 280 },
            }).setOrigin(0, 0).setDepth(50);
        } else if (hintLine66) {
            this.add.text(20, 135, hintLine66, {
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
            // Раунд 39 (п.23): лес — ЕДИНАЯ локация; вход только через Опушку
            const isForestEntry = loc.id === 'forest_edge';
            const label = alreadySearched
                ? tf(t('{0} (обыскано)'), isForestEntry ? `${loc.icon} ${t('Лес')}` : `${loc.icon} ${t(loc.name)}`)
                : (isForestEntry ? `${loc.icon} ${t('Лес')}` : `${loc.icon} ${t(loc.name)}`);

            createButton(this, x, y, label, () => {
                ActionLog.add(this.registry, tf(t('Игрок отправился в локацию «{0}».'), t(loc.name)));
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
                backgroundColor: alreadySearched ? 0x3a3a3a : (isForestEntry ? 0x2e4a2e : 0x4a6a4a),
                hoverColor: alreadySearched ? 0x4a4a4a : (isForestEntry ? 0x3c5c3c : 0x5a7a5a),
                pressColor: 0x2a3a2a,
                textColor: alreadySearched ? '#888' : (isForestEntry ? '#c9e0b0' : RUS.text),
                fontSize: twoCols ? 13 : 14, padding: { left: 12, right: 12, top: 6, bottom: 6 },
                cornerRadius: 6,
            });
        });

        // Раунд 39 (п.23): подсказка-цепочка леса — карта местности показывает
        // лес ЕДИНЫМ узлом, внутри — последовательный проход из трёх локаций
        this.add.text(width / 2, startY + Math.ceil(locations.length / cols) * step + 6,
            t('🌲 Лес цепочкой: Опушка леса → Лесная поляна → Густой лес. Вход — только через Опушку, выход — последовательно.'), {
            fontSize: '11px', color: '#8fae7a',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            align: 'center',
            wordWrap: { width: width - 40 },
        }).setOrigin(0.5, 0).setDepth(50);

        // ----- Кнопка "Тёмный лес — прогулка" (раунд 13) -----
        // Раунд 30: чаща — теперь через опушку и поляну; прогулка остаётся
        // отдельной сценой лесной чащи (ForestScene).
        const backBtnY = startY + rows * step + 36;   // раунд 39: ниже — строка-подсказка цепочки леса
        createButton(this, width / 2, backBtnY, t('🌲 Тёмный лес — прогулка'), () => {
            ActionLog.add(this.registry, t('Игрок отправился гулять в Тёмный лес.'));
            tickTime(this.registry, MAP_TRAVEL_MINUTES); // раунд 32 (п.5): ровно 1 час
            this.scene.start('Forest', { from: 'Fork' });
        }, {
            backgroundColor: 0x2e4a2e, hoverColor: 0x3c5c3c, pressColor: 0x1e321e,
            textColor: '#c9e0b0',
            fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
            cornerRadius: 6,
        });

        // Раунд 57 (п.2 приказа): СЛИЯНИЕ ДВУХ ПАСЕК ЗАВЕРШЕНО.
        // Дубль-кнопка «🐝 Пасека — прогулка» (раунд 17) удалена: на околице
        // была ВТОРАЯ кнопка пасеки рядом с кнопкой локации «Пасека» — обе
        // открывали одну и ту же ходячую ApiaryScene (раунд 20 слил сцены,
        // но записи в меню остались двумя). Теперь Пасека ОДНА: кнопка
        // локации «Пасека» в списке выше. Поиск следов на ней работает как
        // прежде (buildHuntUI сам включается только при активной погоне,
        // а вне погоны это мирная прогулка) — ничего не потеряно.

        // ----- Кнопка "Вернуться в деревню" -----
        createButton(this, width / 2, backBtnY + 40, t('◀ Вернуться в деревню'), () => {
            tickTime(this.registry, MAP_TRAVEL_MINUTES); // раунд 32 (п.5): ровно 1 час
            this.scene.start('Village');
        }, {
            backgroundColor: 0x5a4030, hoverColor: 0x6a5040, textColor: RUS.text,
            fontSize: 16, padding: { left: 24, right: 24, top: 10, bottom: 10 },
            cornerRadius: 8,
        });

        // П.17: Кнопка "Карта" — показать карту местности
        createButton(this, width / 2, backBtnY + 78, t('🗺 Карта местности'), () => {
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
        // Раунд 66.16 (гард р.41): защёлка против per-frame шторма переходов
        const endState = checkGameEnd(this.registry);
        if (endState && !this.__endQueued) { this.__endQueued = true; this.scene.start('End'); }
    }

    // П.17: Карта местности. Раунд 66.24 (приказ 3 владельца): вместо кружков
    // и стрелочек — ПОЛНОЦЕННАЯ КАРТА МЕСТНОСТИ (systems/TerrainMap.js):
    // деревня в центре, тракт идёт с северного края через деревню и по мосту
    // к реке на южном крае; справа от деревни и вдоль Южного Тракта —
    // выпас, пасека и поле; на всём свободном пространстве — леса цепочкой
    // (Опушка → Лесная поляна → Густой лес); справа от Северного Тракта —
    // ответвление дороги к мельнице и большое озеро. Погост — слева.
    // Карта рисуется один раз в canvas-текстуру, подписи — t() поверх.
    showMap() {
        const { width, height } = this.scale;
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        // Панель вписывается в окно (с полями) — фикс аудита UI.
        const panelW = Math.min(720, width - 20);
        const panelH = Math.min(560, height - 20);
        this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x1a2a1a, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        const topY = height / 2 - panelH / 2;
        this.add.text(width / 2, topY + 18, t('🗺 Карта местности'), {
            fontSize: '22px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);
        this.add.text(width / 2, topY + 38, t('🗺 Карта местности — деревня в центре: тракт с севера через деревню и мост к реке на юге. Справа — выпас, пасека и поле, дальше леса цепочкой (Опушка → Поляна → Густой лес), у Северного Тракта — мельница и озеро.'), {
            fontSize: '10px', color: '#9dbb86',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            align: 'center',
            wordWrap: { width: panelW - 90 },
        }).setOrigin(0.5, 0).setDepth(202);

        // Карта-текстура (рисуется один раз) в масштабе панели
        const mapTop = topY + 66;
        const availW = panelW - 34;
        const availH = panelH - 66 - 46;
        const scale = Math.min(availW / TERRAIN_W, availH / TERRAIN_H);
        const mw = TERRAIN_W * scale, mh = TERRAIN_H * scale;
        const mapX = Math.round(width / 2 - mw / 2);
        const mapY = Math.round(mapTop + (availH - mh) / 2);

        if (!this.textures.exists('terrain_map')) {
            const tex = this.textures.createCanvas('terrain_map', TERRAIN_W, TERRAIN_H);
            drawTerrainMap(tex.getContext());
            tex.refresh();
        }
        this.add.image(mapX, mapY, 'terrain_map')
            .setOrigin(0).setDisplaySize(mw, mh).setDepth(202);
        this.add.rectangle(mapX - 2, mapY - 2, mw + 4, mh + 4, 0x000000, 0)
            .setOrigin(0).setStrokeStyle(2, 0xC9A961, 0.7).setDepth(203);

        // Компас: стрелка севера нарисована в текстуре, буква — t()
        this.add.text(mapX + 46 * scale, mapY + 34 * scale, t('С ↑'), {
            fontSize: '12px', color: '#6b4a2e', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#e6d7ac', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(204);

        // Подписи локаций поверх карты (i18n)
        TERRAIN_LABELS.forEach(l => {
            this.add.text(mapX + l.x * scale, mapY + l.y * scale, t(l.text), {
                fontSize: '11px', color: '#f0e6c8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1.5,
                backgroundColor: '#1a2a1acc',
                padding: { x: 3, y: 1 },
            }).setOrigin(0.5).setDepth(204);
        });

        // Метка игрока — у деревни (пульсирует)
        const px = mapX + TERRAIN.village.x * scale;
        const py = mapY + (TERRAIN.village.y - 10) * scale;
        const marker = this.add.circle(px, py, 5, 0xff5040)
            .setStrokeStyle(2, 0xffffff, 0.9).setDepth(205);
        this.tweens.add({
            targets: marker,
            scale: { from: 0.9, to: 1.3 },
            alpha: { from: 1, to: 0.7 },
            duration: 800, yoyo: true, repeat: -1,
        });
        this.add.text(px, py - 16, '🧑 ' + t('Ты здесь'), {
            fontSize: '10px', color: '#ffd7d0',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1.5,
            backgroundColor: '#1a2a1acc',
            padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(205);

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, topY + panelH - 22, 140, 30, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        this.add.text(width / 2, topY + panelH - 22, t('Закрыть'), {
            fontSize: '14px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeMap = () => {
            this.tweens.killTweensOf(marker);
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeMap);
        overlay.on('pointerup', closeMap);
    }
}

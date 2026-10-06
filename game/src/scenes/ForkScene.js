// 66.34 (приказ владельца п.1): экран «Околица деревни» УДАЛЁН — вместо него
// ИНТЕРАКТИВНАЯ КАРТА МЕСТНОСТИ (TerrainMap + клик-зоны TERRAIN_ZONES):
// клик по локации на карте — переход (ровно 1 игровой час, п.5 р.32),
// клик по деревне — возврат в деревню, поляна/чаща — подсказка о входе через
// Опушку (цепочка леса р.39). Пп.2–10 66.34 — новая разметка карты.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { getHuntState, checkGameEnd, hintFreshness } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButtonRow, createDialog, bindRestartOnResize, addSceneMenuButtons } from '../utils/ui.js';
// Раунд 32 (пп.14,15): F1 — «Информация по игре» со соотношением времени 1:30
import { timeRatioInfoLine } from '../systems/WorldClock.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { getLocationById } from '../data/mapLocations.js';
// 66.24: полноценная карта местности; 66.34: + клик-зоны (TERRAIN_ZONES)
import { drawTerrainMap, TERRAIN_W, TERRAIN_H, TERRAIN, TERRAIN_LABELS, TERRAIN_ZONES } from '../systems/TerrainMap.js';
import { getTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
// Патч 66.73 (приказ 14): усталость — переходы тратят ОУ (BRP SRD)
import { spendFatigue } from '../systems/fatigue.js';
// Патч 66.46 (приказ 2): тёплый свет зари/заката на карте местности
import { attachSunLight } from '../systems/SunLight.js';
// Раунд 32 (п.5): ЛЮБОЕ перемещение между локациями по карте = ровно 1 час
export const MAP_TRAVEL_MINUTES = 60;
import { getWeather } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';
import { onLocationVisited } from '../data/questGenerator.js';
// Раунд 31 (пп.11,12): мировые часы — реальный ход, пауза в разговорах
import { attachChurchBells } from '../systems/ChurchBells.js';
import { attachWorldClock } from '../systems/WorldClock.js';

// 66.34: подсказка при клике на глубину леса (вход только через Опушку, р.39)
const FOREST_CHAIN_HINT = '🌲 Лес цепочкой: Опушка леса → Лесная поляна → Густой лес. Вход — только через Опушку, выход — последовательно.';

export class ForkScene extends Phaser.Scene {
    constructor() {
        super('Fork');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        // 66.34 (QA): защёлки — свойства ЭКЗЕМПЛЯРА сцены, который в Phaser
        // живёт всю игру; без сброса первый же переход навсегда блокировал
        // все последующие (и победу в update гасил __endQueued прошлой партии).
        this.__travelLock = false;
        this.__endQueued = false;
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x2a3a2a);
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.audioManager.playSceneMusic('village');
        // Раунд 31 (пп.11,12): мировые часы идут реальным временем (в диалогах стоят)
        attachWorldClock(this);
        attachChurchBells(this, { volume: 0.4 });

        const state = getHuntState(this.registry);

        // Раунд 32 (пп.14,15): F1 — «Информация по игре» (и на карте местности)
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ Информация по игре',
                timeRatioInfoLine() + '\n\n' +
                t('🗺 Околица — теперь карта местности: кликай локацию на карте и в путь.\nКаждый переход по карте занимает ровно 1 игровой час.\nВход в лес — только через Опушку, дальше последовательно: Поляна → Густой лес.\nСледы вора живут от 12 до 24 часов — а дождь и снег смывают их и раньше.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singletonKey: 'fork-help' });
        });

        // ----- Раунд 40 (заявка п.1): [📜 Персонаж] / [🎒 Инвентарь] -----
        addSceneMenuButtons(this, 'Fork');

        // ===== КАРТА МЕСТНОСТИ: вписываем в экран под шапкой =====
        // 66.34: карта — сам экран. Шапка (заголовок/дата) сверху, панель
        // действий снизу; карта масштабируется в оставшееся пространство.
        const lowH = height < 520;
        const headerH = lowH ? 46 : 60;
        const bottomH = lowH ? 74 : 92;
        const availW = width - 20;
        const availH = Math.max(120, height - headerH - bottomH);
        const scale = Math.min(availW / TERRAIN_W, availH / TERRAIN_H);
        const mw = TERRAIN_W * scale, mh = TERRAIN_H * scale;
        const mapX = Math.round((width - mw) / 2);
        const mapY = Math.round(headerH + (availH - mh) / 2);
        this.__mapView = { mapX, mapY, scale }; // для QA-прогонщиков (клик по зоне)

        // Текстура карты (рисуется один раз)
        if (!this.textures.exists('terrain_map')) {
            const tex = this.textures.createCanvas('terrain_map', TERRAIN_W, TERRAIN_H);
            drawTerrainMap(tex.getContext());
            tex.refresh();
        }
        this.add.image(mapX, mapY, 'terrain_map')
            .setOrigin(0).setDisplaySize(mw, mh).setDepth(10);
        this.add.rectangle(mapX - 2, mapY - 2, mw + 4, mh + 4, 0x000000, 0)
            .setOrigin(0).setStrokeStyle(2, 0xC9A961, 0.7).setDepth(11);

        // Компас: стрелка севера нарисована в текстуре, буква — t()
        this.add.text(mapX + 34 * scale, mapY + 500 * scale, t('С ↑'), {
            fontSize: '12px', color: '#6b4a2e', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#e6d7ac', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(14);

        // Подписи локаций поверх карты (i18n)
        TERRAIN_LABELS.forEach(l => {
            this.add.text(mapX + l.x * scale, mapY + l.y * scale, t(l.text), {
                fontSize: '11px', color: '#f0e6c8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1.5,
                backgroundColor: '#1a2a1acc',
                padding: { x: 3, y: 1 },
            }).setOrigin(0.5).setDepth(14);
        });

        // ----- КЛИК-ЗОНЫ (66.34): подсветка + переходы -----
        // Графика подсветки перерисовывается при наведении.
        this.zoneHl = this.add.graphics().setDepth(12);
        const drawZoneHl = (z) => {
            this.zoneHl.clear();
            if (!z) return;
            this.zoneHl.fillStyle(0xC9A961, 0.16);
            this.zoneHl.lineStyle(1.5, 0xC9A961, 0.6);
            if (z.shape === 'rect') {
                this.zoneHl.fillRect(mapX + z.x * scale, mapY + z.y * scale, z.w * scale, z.h * scale);
                this.zoneHl.strokeRect(mapX + z.x * scale, mapY + z.y * scale, z.w * scale, z.h * scale);
            } else if (z.shape === 'ellipse') {
                const cx = mapX + z.x * scale, cy = mapY + z.y * scale;
                this.zoneHl.fillEllipse(cx, cy, z.rx * 2 * scale, z.ry * 2 * scale);
                this.zoneHl.strokeEllipse(cx, cy, z.rx * 2 * scale, z.ry * 2 * scale);
            } else if (z.shape === 'circle') {
                const cx = mapX + z.x * scale, cy = mapY + z.y * scale;
                this.zoneHl.fillCircle(cx, cy, z.r * scale);
                this.zoneHl.strokeCircle(cx, cy, z.r * scale);
            }
        };

        const travel = (zoneId) => this.travelTo(zoneId);

        TERRAIN_ZONES.forEach((z, zi) => {
            let cx, cy, hitArea, hitFn;
            if (z.shape === 'rect') {
                cx = mapX + (z.x + z.w / 2) * scale;
                cy = mapY + (z.y + z.h / 2) * scale;
                hitArea = new Phaser.Geom.Rectangle(-z.w * scale / 2, -z.h * scale / 2, z.w * scale, z.h * scale);
                hitFn = Phaser.Geom.Rectangle.Contains;
            } else if (z.shape === 'ellipse') {
                cx = mapX + z.x * scale;
                cy = mapY + z.y * scale;
                hitArea = new Phaser.Geom.Ellipse(0, 0, z.rx * 2 * scale, z.ry * 2 * scale);
                hitFn = Phaser.Geom.Ellipse.Contains;
            } else {
                cx = mapX + z.x * scale;
                cy = mapY + z.y * scale;
                hitArea = new Phaser.Geom.Circle(0, 0, z.r * scale);
                hitFn = Phaser.Geom.Circle.Contains;
            }
            const zoneGO = this.add.zone(cx, cy, 1, 1);
            zoneGO.setInteractive(hitArea, hitFn);
            // Приоритет попадания: топ-зоны массива (деревня/мельница/озеро)
            // должны получать клик поверх общих зон (выпас/лес) — при topOnly
            // вводе верхняя = с БОЛЬШИМ depth (Phaser 3.88: порядок массива
            // инвертирован в рендер-сортировке).
            zoneGO.setDepth(60 - zi);
            zoneGO.on('pointerover', () => drawZoneHl(z));
            zoneGO.on('pointerout', () => drawZoneHl(null));
            zoneGO.on('pointerdown', (pointer) => {
                if (pointer && pointer.leftButtonDown && !pointer.leftButtonDown()) return;
                travel(z.id);
            });
        });

        // ----- Метка игрока — у деревни (пульсирует) -----
        const px = mapX + TERRAIN.village.x * scale;
        const py = mapY + (TERRAIN.village.y - 10) * scale;
        const marker = this.add.circle(px, py, 5, 0xff5040)
            .setStrokeStyle(2, 0xffffff, 0.9).setDepth(15);
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
        }).setOrigin(0.5).setDepth(15);

        // ===== ШАПКА: заголовок, дата/погода =====
        this.add.text(width / 2, 12, t('🗺 Карта местности'), {
            fontSize: lowH ? '20px' : '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(50);

        const timeState = getTime(this.registry);
        if (timeState) {
            const weather = getWeather(this.registry);
            this.add.text(width / 2, lowH ? 32 : 40, `📅 ${formatDateTime(timeState)}   ${weather.icon} ${weather.name}`, {
                fontSize: '12px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0).setDepth(50);
        }

        // ----- Подсказки, собранные у жителей + счётчик свежести НАВОДКИ -----
        // (раунд 66.13: процент выцветания наводки) — блок слева сверху,
        // полупрозрачный; клики сквозь него проходят (текст не интерактивен).
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
            this.add.text(16, headerH + 6, cluesText, {
                fontSize: lowH ? '10px' : '12px', color: '#c9a14a',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 8, y: 6 },
                wordWrap: { width: lowH ? 200 : 280 },
            }).setOrigin(0, 0).setDepth(50);
        } else if (hintLine66) {
            this.add.text(16, headerH + 6, hintLine66, {
                fontSize: lowH ? '10px' : '12px', color: '#c9a14a',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 8, y: 6 },
                wordWrap: { width: lowH ? 200 : 280 },
            }).setOrigin(0, 0).setDepth(50);
        }

        // ===== НИЖНЯЯ ПАНЕЛЬ: прогулка + возврат в деревню + подсказка цепочки =====
        // Итерация 66.89 (приказ владельца 1): кнопки — ОДНОЙ строкой у нижнего края
        // (раньше — две кнопки по жёстким смещениям ±140 от центра).
        if (!lowH) {
            this.add.text(width / 2, height - bottomH + 4, t(FOREST_CHAIN_HINT), {
                fontSize: '11px', color: '#8fae7a',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                align: 'center',
                wordWrap: { width: width - 60 },
            }).setOrigin(0.5, 0).setDepth(50).setAlpha(0.9);

            createButtonRow(this, [
                {
                    text: t('🌲 Тёмный лес — прогулка'),
                    cb: () => {
                        ActionLog.add(this.registry, t('Игрок отправился гулять в Тёмный лес.'));
                        // Патч 66.73: дорога — перемещение (голод ×1.5, −1 ОУ форс-марша)
                        tickTime(this.registry, MAP_TRAVEL_MINUTES, 'walk'); // раунд 32 (п.5): ровно 1 час
                        spendFatigue(this.registry, 1);
                        this.scene.start('Forest', { from: 'Fork' });
                    },
                    bg: 0x2e4a2e, hover: 0x3c5c3c, textColor: '#c9e0b0',
                    fontSize: 14, padding: { left: 16, right: 16, top: 9, bottom: 9 },
                },
                {
                    text: t('◀ Вернуться в деревню'),
                    cb: () => {
                        // Патч 66.73: дорога — перемещение (голод ×1.5, −1 ОУ форс-марша)
                        tickTime(this.registry, MAP_TRAVEL_MINUTES, 'walk'); // раунд 32 (п.5): ровно 1 час
                        spendFatigue(this.registry, 1);
                        this.scene.start('Village');
                    },
                    bg: 0x5a4030, hover: 0x6a5040, textColor: RUS.text,
                    fontSize: 14, padding: { left: 16, right: 16, top: 9, bottom: 9 },
                },
            ], { depth: 50, marginBottom: 8, gap: 12 });
        } else {
            // Низкий экран: те же две кнопки одним рядом у края
            createButtonRow(this, [
                {
                    text: t('🌲 Тёмный лес'),
                    cb: () => {
                        ActionLog.add(this.registry, t('Игрок отправился гулять в Тёмный лес.'));
                        tickTime(this.registry, MAP_TRAVEL_MINUTES);
                        this.scene.start('Forest', { from: 'Fork' });
                    },
                    bg: 0x2e4a2e, hover: 0x3c5c3c, textColor: '#c9e0b0',
                    fontSize: 12, padding: { left: 10, right: 10, top: 6, bottom: 6 },
                },
                {
                    text: t('◀ В деревню'),
                    cb: () => {
                        tickTime(this.registry, MAP_TRAVEL_MINUTES);
                        this.scene.start('Village');
                    },
                    bg: 0x5a4030, hover: 0x6a5040, textColor: RUS.text,
                    fontSize: 12, padding: { left: 10, right: 10, top: 6, bottom: 6 },
                },
            ], { depth: 50, marginBottom: 5, gap: 10 });
        }

        // ----- Overlay дня/ночи -----
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- Патч 66.46 (приказ 2): тёплый слой солнца на карте (без
        // теней — карта абстрактна): заря/закат читаются и здесь.
        this.sunLight = attachSunLight(this, { shadowDepth: 9.5, overlayDepth: 93 });
    }

    // 66.34: переход по клику-зоне карты.
    //   village → деревня (1 час в пути); glade/deep → подсказка о цепочке леса;
    //   остальные — Location/Apiary с тиком 1 час (п.5 р.32, как прежние кнопки).
    travelTo(zoneId) {
        if (this.__travelLock) return; // защёлка от двойного клика
        if (zoneId === 'village') {
            tickTime(this.registry, MAP_TRAVEL_MINUTES);
            this.scene.start('Village');
            return;
        }
        if (zoneId === 'forest_glade' || zoneId === 'forest') {
            // Раунд 39 (п.23): вход в лес — только через Опушку, дальше последовательно
            this.showToast(t(FOREST_CHAIN_HINT));
            return;
        }
        const loc = getLocationById(zoneId);
        if (!loc) return;
        this.__travelLock = true;
        ActionLog.add(this.registry, tf(t('Игрок отправился в локацию «{0}».'), t(loc.name)));
        tickTime(this.registry, MAP_TRAVEL_MINUTES);
        onLocationVisited(this.registry, loc.id);
        if (loc.id === 'apiary') {
            // Раунд 20 (слияние Пасек): охотничья пасека = ходячая ApiaryScene
            this.scene.start('Apiary', { from: 'Fork', hunt: true });
            return;
        }
        this.scene.start('Location', { locationId: loc.id, from: 'Fork' });
    }

    // 66.34: ненавязчивый тост-подсказка внизу (растворяется)
    showToast(msg) {
        if (this.toastText) this.toastText.destroy();
        const { width, height } = this.scale;
        this.toastText = this.add.text(width / 2, height - (height < 520 ? 52 : 64), msg, {
            fontSize: '12px', color: '#f0e6c8',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1.5,
            backgroundColor: '#1a2a1ae6', padding: { x: 10, y: 5 },
            align: 'center',
            wordWrap: { width: width - 60 },
        }).setOrigin(0.5, 1).setDepth(120);
        this.tweens.killTweensOf(this.toastText);
        this.toastText.setAlpha(0);
        this.tweens.add({
            targets: this.toastText,
            alpha: { from: 0, to: 1 }, duration: 220, yoyo: true, hold: 2600,
            onComplete: () => { if (this.toastText) { this.toastText.destroy(); this.toastText = null; } },
        });
    }

    update() {
        // Раунд 21: побег вора или иные концы закрывают поход
        if (this.busyDialog) return;
        // Раунд 66.16 (гард р.41): защёлка против per-frame шторма переходов
        const endState = checkGameEnd(this.registry);
        if (endState && !this.__endQueued) { this.__endQueued = true; this.scene.start('End'); }
    }
}

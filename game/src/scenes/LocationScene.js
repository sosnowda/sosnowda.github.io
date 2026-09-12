// Сцена локации (лес/тракт/река/поле) — поиск следов вора.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { FORK_LOCATIONS } from '../data/interiors.js';
import { THIEF_LOCATIONS } from '../data/thief.js';
import { getLocationById } from '../data/mapLocations.js';
import { searchLocation, getHuntState, checkGameEnd } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';

const LOCATION_BG = {
    forest: 0x1a2a1a,
    road: 0x4a3a2a,
    river: 0x4a7c3a,    // П.10: трава (река рисуется поверх)
    field: 0x4a7c3a,    // П.14: трава (жёлтое поле рисуется поверх)
    lake: 0x4a7c3a,     // П.12: трава (озеро рисуется поверх)
    pogost: 0x3a3a2a,
    pasture: 0x5a8a3a,
    mill: 0x4a7c3a,     // П.5,13: трава (мельница рисуется поверх)
    apiary: 0x4a7c3a,   // П.8,9: трава (пасеки рисуются поверх)
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

        const loc = getLocationById(this.locationId) || FORK_LOCATIONS.find(l => l.id === this.locationId) || { name: this.locationId, icon: '❓', description: '' };
        const state = getHuntState(this.registry);

        // ----- Фон локации — устанавливаем базовый цвет -----
        this.cameras.main.setBackgroundColor(LOCATION_BG[this.locationId] || 0x1a2a1a);
        this.drawLocationBackground(this.locationId, width, height);

        // ----- Overlay дня/ночи (п.5) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- Заголовок -----
        this.add.text(width / 2, 20, `${loc.icon} ${loc.name}`, {
            fontSize: '28px', color: RUS.text, fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 55, loc.description, {
            fontSize: '13px', color: RUS.textDim,
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 1,
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5, 0);

        // Дата и время (п.13)
        if (timeState) {
            this.add.text(width / 2, 80, `📅 ${formatDateTime(timeState)}`, {
                fontSize: '11px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0).setDepth(100);
        }

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

        // П.11,16: Названия кнопок зависят от локации.
        // Для Реки: «Поиск» и «Выход». Для Тракта: «Осмотр» и «Выход».
        // Для остальных: «Искать следы» и «Назад к развилке».
        const isRiver = this.locationId === 'river';
        const isRoad = this.locationId === 'road' || this.locationId === 'road_south';
        const searchLabel = isRiver ? '🔍 Поиск' : (isRoad ? '🔍 Осмотр' : '🔍 Искать следы');
        const exitLabel = (isRiver || isRoad) ? '🚪 Выход' : '◀ Назад к развилке';

        // ----- Кнопка поиска/осмотра -----
        if (!alreadySearched) {
            createButton(this, width / 2, height - 100, `${searchLabel} (проверка Внимательности)`, () => {
                this.doSearch();
            }, {
                backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
                fontSize: 18, padding: { left: 24, right: 24, top: 14, bottom: 14 },
                cornerRadius: 8,
            });
        }

        // ----- Кнопка выхода -----
        createButton(this, width / 2, height - 50, exitLabel, () => {
            this.scene.start(this.from);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 12, bottom: 12 },
            cornerRadius: 8,
        });
    }

    /**
     * Нарисовать фон локации в зависимости от типа.
     * П.5-16: Полностью переработанные локации.
     */
    drawLocationBackground(locId, width, height) {
        const gfx = this.add.graphics();

        if (locId === 'forest') {
            // Лес — тёмный зелёный фон + много деревьев
            gfx.fillStyle(0x1a3a1a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Травянистый узор
            gfx.fillStyle(0x2a5a2a, 0.5);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 4, 4);
            }
            // Деревья (20 шт для густоты)
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 150);
                this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(2);
            }
        } else if (locId === 'road' || locId === 'road_south') {
            // П.15: Тракт — трава по бокам, гравийная дорога горизонтально
            // С коллизиями: дорога рисуется ПЕРВЫМ слоем, деревья и камни — поверх,
            // но их позиции проверяются, чтобы не пересекаться с дорогой.
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура травы
            gfx.fillStyle(0x5a8c4a, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 3);
            }
            // Гравийная дорога — горизонтальная полоса через весь экран
            const roadY = height * 0.5;
            const roadH = 100;
            const roadTop = roadY - roadH / 2;
            const roadBottom = roadY + roadH / 2;
            gfx.fillStyle(0x9a8060, 1);
            gfx.fillRect(0, roadTop, width, roadH);
            gfx.setDepth(1);
            // Текстура гравия
            gfx.fillStyle(0x7a6040, 0.6);
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * width;
                const y = roadTop + Math.random() * roadH;
                gfx.fillCircle(x, y, 2);
            }
            // П.15: Камни на дороге — только ВНЕ дороги (на траве), чтобы не перекрывать
            const placedPositions = [];
            const isOnRoad = (y) => y > roadTop - 20 && y < roadBottom + 20;
            const hasCollision = (x, y, minDist = 40) => {
                return placedPositions.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 15; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    // Не на дороге и нет коллизии
                    if (!isOnRoad(y) && !hasCollision(x, y, 50)) {
                        this.add.image(x, y, `tile_rock_${i % 2}`).setScale(1.5).setDepth(2);
                        placedPositions.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // П.15: Деревья по бокам дороги — с проверкой коллизий
            for (let i = 0; i < 12; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 6) ? Math.random() * 180 : width - Math.random() * 180;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnRoad(y) && !hasCollision(x, y, 60)) {
                        this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(3);
                        placedPositions.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Тропинки травы у дороги — только выше дороги
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * width;
                const y = roadTop - 10 - Math.random() * 20;
                this.add.image(x, y, 'tile_grass_0').setScale(2).setDepth(1);
            }
        } else if (locId === 'river') {
            // П.10: Река — голубая полоса посередине, мост, заросли, дорога к мосту
            // Фон — трава по обоим берегам
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Река — голубая горизонтальная полоса через весь экран (середина)
            const riverY = height * 0.45;
            const riverH = 120;
            gfx.fillStyle(0x3a6b8c, 1);
            gfx.fillRect(0, riverY, width, riverH);
            gfx.setDepth(1);
            // Волны на реке
            gfx.fillStyle(0x6a9bbc, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = riverY + Math.random() * riverH;
                gfx.fillRect(x, y, 10, 2);
            }
            // П.10.3: Густые заросли по берегам реки (камыши + кусты)
            // Верхний берег
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * width;
                const y = riverY - 10 - Math.random() * 30;
                this.add.image(x, y, 'tile_forest_0').setScale(2).setOrigin(0.5, 1).setDepth(2);
            }
            // Нижний берег
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * width;
                const y = riverY + riverH + 10 + Math.random() * 30;
                this.add.image(x, y, 'tile_forest_0').setScale(2).setOrigin(0.5, 0).setDepth(2);
            }
            // П.10.4: Деревянный мост посередине реки (вертикальный)
            const bridgeX = width / 2;
            const bridgeW = 80;
            // Настил моста
            gfx.fillStyle(0x6a4a2a, 1);
            gfx.fillRect(bridgeX - bridgeW / 2, riverY, bridgeW, riverH);
            gfx.setDepth(3);
            // Доски моста (горизонтальные линии)
            gfx.fillStyle(0x4a3a1a, 1);
            for (let y = riverY; y < riverY + riverH; y += 12) {
                gfx.fillRect(bridgeX - bridgeW / 2, y, bridgeW, 2);
            }
            // Перила моста
            gfx.fillStyle(0x5a3a1a, 1);
            gfx.fillRect(bridgeX - bridgeW / 2 - 4, riverY - 5, 4, riverH + 10);
            gfx.fillRect(bridgeX + bridgeW / 2, riverY - 5, 4, riverH + 10);
            // П.10.6: Широкая песчанная дорога от обоих краёв до моста
            const roadW = 100;
            gfx.fillStyle(0xc8a868, 1);
            // Дорога слева к мосту
            gfx.fillRect(0, riverY + riverH / 2 - roadW / 2, bridgeX - bridgeW / 2, roadW);
            // Дорога справа от моста
            gfx.fillRect(bridgeX + bridgeW / 2, riverY + riverH / 2 - roadW / 2, width - bridgeX - bridgeW / 2, roadW);
            gfx.setDepth(2);
            // П.10.5: Деревья разбросаны по всей локации, кроме тайлов воды
            const placedTrees = [];
            const isOnRiver = (y) => y > riverY - 10 && y < riverY + riverH + 10;
            const hasTreeCollision = (x, y, minDist = 50) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 18; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnRiver(y) && !hasTreeCollision(x, y, 50)) {
                        this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(4);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        } else if (locId === 'field') {
            // П.14: Поле — жёлтая высокая трава по центру на 2/3 площади
            // Фон — обычная зелёная трава
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // П.14: Жёлтая высокая трава в центре на 2/3 площади
            const fieldX = width / 6;
            const fieldY = 120;
            const fieldW = (width * 2) / 3;
            const fieldH = height - 200;
            gfx.fillStyle(0xc8a838, 1);  // жёлтый
            gfx.fillRect(fieldX, fieldY, fieldW, fieldH);
            gfx.setDepth(1);
            // Высокая трава — вертикальные стебли
            gfx.fillStyle(0xe8c858, 0.8);
            for (let i = 0; i < 200; i++) {
                const x = fieldX + Math.random() * fieldW;
                const y = fieldY + Math.random() * fieldH;
                gfx.fillRect(x, y, 2, 12);
            }
            // Колышущиеся стебли (анимация наклона)
            for (let i = 0; i < 25; i++) {
                const x = fieldX + Math.random() * fieldW;
                const y = fieldY + Math.random() * fieldH;
                const stem = this.add.image(x, y, 'tile_grass_0').setScale(3).setTint(0xc8a838).setDepth(3);
                this.tweens.add({
                    targets: stem,
                    angle: { from: -8, to: 8 },
                    duration: 1500 + Math.random() * 1500,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
            // Деревья по краям поля
            for (let i = 0; i < 6; i++) {
                const x = (i < 3) ? Math.random() * (fieldX - 30) : width - Math.random() * (fieldX - 30);
                const y = 120 + Math.random() * (height - 200);
                this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(4);
            }
        } else if (locId === 'lake') {
            // П.12: Озеро — круглое большое в центре, кусты по краям
            // Фон — трава
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // П.12: Круглое озеро в центре, занимает ~1/4 локации
            const lakeCX = width / 2;
            const lakeCY = height / 2 + 30;
            const lakeR = Math.min(width, height) / 3.5;  // радиус
            gfx.fillStyle(0x1a3050, 1);
            gfx.fillCircle(lakeCX, lakeCY, lakeR);
            gfx.setDepth(1);
            // Анимированные волны озера
            for (let i = 0; i < 25; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * lakeR * 0.8;
                const x = lakeCX + Math.cos(angle) * r;
                const y = lakeCY + Math.sin(angle) * r;
                const water = this.add.image(x, y, `tile_lake_${i % 3}`).setScale(1.5).setDepth(2);
                this.tweens.add({
                    targets: water,
                    x: x + 12,
                    duration: 2500 + Math.random() * 2000,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
            // П.12: Кусты по краям озера
            const placedBushes = [];
            const hasBushCollision = (x, y, minDist = 30) => {
                return placedBushes.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 30; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = lakeR + 15 + Math.random() * 40;
                    const x = lakeCX + Math.cos(angle) * r;
                    const y = lakeCY + Math.sin(angle) * r;
                    // Не на краю экрана
                    if (x > 20 && x < width - 20 && y > 100 && y < height - 20 && !hasBushCollision(x, y, 30)) {
                        this.add.image(x, y, 'tile_forest_0').setScale(1.5).setOrigin(0.5, 0.5).setDepth(3);
                        placedBushes.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Деревья по углам
            for (let i = 0; i < 6; i++) {
                const x = (i < 3) ? Math.random() * 150 : width - Math.random() * 150;
                const y = 100 + Math.random() * (height - 150);
                this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(4);
            }
        } else if (locId === 'pogost') {
            // П.6,7: Погост — структурированный: часовня по центру, ряды могил с крестами, дорожки
            // Фон — заросшая земля
            gfx.fillStyle(0x3a3a2a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура земли
            gfx.fillStyle(0x4a4a3a, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 4, 4);
            }
            // П.7: Дорожка от входа (низ экрана) к часовне (центр)
            const pathW = 60;
            const chapelY = height * 0.35;
            gfx.fillStyle(0x8a7a5a, 1);
            gfx.fillRect(width / 2 - pathW / 2, chapelY + 40, pathW, height - chapelY - 60);
            gfx.setDepth(1);
            // П.7: Часовня в центре
            if (this.textures.exists('deco_chapel')) {
                this.add.image(width / 2, chapelY, 'deco_chapel').setScale(2.5).setDepth(5);
            } else {
                // Запасной вариант — рисуем часовню графикой
                const chapelGfx = this.add.graphics();
                chapelGfx.fillStyle(0x6a5a3a, 1);
                chapelGfx.fillRect(width / 2 - 40, chapelY - 30, 80, 60);
                chapelGfx.fillStyle(0x4a3a2a, 1);
                chapelGfx.fillTriangle(width / 2 - 50, chapelY - 30, width / 2 + 50, chapelY - 30, width / 2, chapelY - 70);
                chapelGfx.fillStyle(0xc9a14a, 1);
                chapelGfx.fillRect(width / 2 - 2, chapelY - 90, 4, 25);
                chapelGfx.fillRect(width / 2 - 10, chapelY - 82, 20, 4);
                chapelGfx.setDepth(5);
            }
            // П.6,7: Ровные ряды могил с крестами по бокам от часовни
            // Левый ряд (3 могилы)
            const placedGraves = [];
            const hasGraveCollision = (x, y, minDist = 50) => {
                return placedGraves.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            // 2 ряда слева от дорожки
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    const x = 100 + col * 90;
                    const y = chapelY + 80 + row * 100;
                    if (hasGraveCollision(x, y, 50)) continue;
                    const v = (row + col) % 2;
                    if (this.textures.exists(`deco_grave_${v}`)) {
                        this.add.image(x, y, `deco_grave_${v}`).setScale(1.8).setDepth(3);
                    }
                    placedGraves.push({ x, y });
                }
            }
            // 2 ряда справа от дорожки
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    const x = width - 100 - col * 90;
                    const y = chapelY + 80 + row * 100;
                    if (hasGraveCollision(x, y, 50)) continue;
                    const v = (row + col) % 2;
                    if (this.textures.exists(`deco_grave_${v}`)) {
                        this.add.image(x, y, `deco_grave_${v}`).setScale(1.8).setDepth(3);
                    }
                    placedGraves.push({ x, y });
                }
            }
            // П.7: Узкие дорожки между рядами могил
            gfx.fillStyle(0x7a6a4a, 1);
            // Вертикальная дорожка между рядами слева
            gfx.fillRect(145, chapelY + 60, 20, 220);
            // Вертикальная дорожка между рядами справа
            gfx.fillRect(width - 165, chapelY + 60, 20, 220);
            gfx.setDepth(1);
            // Деревья по периметру (с коллизиями)
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 10; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    // Не на дорожке и нет коллизии с могилами
                    const onPath = Math.abs(x - width / 2) < 40;
                    if (!onPath && !hasTreeCollision(x, y, 60) && !hasGraveCollision(x, y, 60)) {
                        this.add.image(x, y, `tile_forest_${i % 2}`).setScale(2.5).setOrigin(0.5, 0.7).setDepth(2);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        } else if (locId === 'pasture') {
            // Выпас — луг с коровами, козами и лошадьми
            gfx.fillStyle(0x5a8a3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Сочная трава
            gfx.fillStyle(0x6a9a4a, 0.5);
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 5);
            }
            // Коровы (3 шт)
            for (let i = 0; i < 3; i++) {
                const x = 150 + i * 300 + Math.random() * 50;
                const y = 250 + Math.random() * 200;
                if (this.textures.exists('deco_cow')) {
                    const cow = this.add.image(x, y, 'deco_cow').setScale(2).setDepth(3);
                    this.tweens.add({
                        targets: cow,
                        y: y - 3,
                        duration: 2000 + Math.random() * 1000,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }
            // Козы (2 шт)
            for (let i = 0; i < 2; i++) {
                const x = 200 + i * 400 + Math.random() * 50;
                const y = 300 + Math.random() * 150;
                if (this.textures.exists('deco_goat')) {
                    this.add.image(x, y, 'deco_goat').setScale(2).setDepth(3);
                }
            }
            // Лошадь (1 шт)
            if (this.textures.exists('deco_horse')) {
                this.add.image(width * 0.7, height * 0.6, 'deco_horse').setScale(2).setDepth(3);
            }
            // Ограда выпаса (забор по периметру)
            for (let x = 0; x < width; x += 48) {
                if (this.textures.exists('tile_fence_h')) {
                    this.add.image(x + 24, 90, 'tile_fence_h').setScale(1.5).setDepth(2);
                    this.add.image(x + 24, height - 30, 'tile_fence_h').setScale(1.5).setDepth(2);
                }
            }
        } else if (locId === 'mill') {
            // П.5,13: Мельница — большая мельница в центре, дорога, много деревьев
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура травы
            gfx.fillStyle(0x5a8c4a, 0.5);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 3);
            }
            // П.13: Дорога от края экрана до мельницы
            const millX = width / 2;
            const millY = height / 2;
            const roadW = 80;
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(0, millY - roadW / 2, millX - 80, roadW);
            gfx.setDepth(1);
            // П.13: Большая мельница в центре
            const millGfx = this.add.graphics();
            // Основание мельницы (деревянная башня)
            millGfx.fillStyle(0x6a4a2a, 1);
            millGfx.fillRect(millX - 60, millY - 80, 120, 120);
            // Крыша мельницы (треугольная)
            millGfx.fillStyle(0x4a3a1a, 1);
            millGfx.fillTriangle(millX - 70, millY - 80, millX + 70, millY - 80, millX, millY - 140);
            // Окно
            millGfx.fillStyle(0x2a1a0a, 1);
            millGfx.fillRect(millX - 15, millY - 60, 30, 30);
            // Дверь
            millGfx.fillStyle(0x3a2a1a, 1);
            millGfx.fillRect(millX - 12, millY - 10, 24, 50);
            // Крылья мельницы (4 лопасти)
            millGfx.fillStyle(0x8a6a3a, 1);
            millGfx.fillRect(millX - 80, millY - 102, 160, 8);  // горизонтальная
            millGfx.fillRect(millX - 4, millY - 180, 8, 160);  // вертикальная
            // Концы крыльев (треугольники для жёсткости)
            millGfx.fillStyle(0x6a4a2a, 1);
            millGfx.fillTriangle(millX - 80, millY - 102, millX - 80, millY - 94, millX - 95, millY - 98);
            millGfx.fillTriangle(millX + 80, millY - 102, millX + 80, millY - 94, millX + 95, millY - 98);
            millGfx.fillTriangle(millX - 4, millY - 180, millX + 4, millY - 180, millX, millY - 195);
            millGfx.fillTriangle(millX - 4, millY - 20, millX + 4, millY - 20, millX, millY - 5);
            millGfx.setDepth(5);
            // Анимация вращения крыльев — создаём отдельный graphics для крыльев
            const blades = this.add.graphics();
            blades.fillStyle(0x8a6a3a, 1);
            blades.fillRect(millX - 80, millY - 102, 160, 8);
            blades.fillRect(millX - 4, millY - 180, 8, 160);
            blades.fillStyle(0x6a4a2a, 1);
            blades.fillTriangle(millX - 80, millY - 102, millX - 80, millY - 94, millX - 95, millY - 98);
            blades.fillTriangle(millX + 80, millY - 102, millX + 80, millY - 94, millX + 95, millY - 98);
            blades.fillTriangle(millX - 4, millY - 180, millX + 4, millY - 180, millX, millY - 195);
            blades.fillTriangle(millX - 4, millY - 20, millX + 4, millY - 20, millX, millY - 5);
            blades.setDepth(6);
            this.tweens.add({
                targets: blades,
                angle: 360,
                duration: 8000,
                repeat: -1,
                ease: 'Linear',
            });
            // Нужно вращать вокруг центра крыльев (millX, millY-98)
            blades.x = millX;
            blades.y = millY - 98;
            // Сдвигаем графику обратно, чтобы центр вращения был правильным
            // (Phaser вращает вокруг origin контейнера, у graphics origin = 0,0)
            // Поэтому нужно сместить содержимое
            // Проще: используем контейнер
            blades.destroy();
            // Создаём контейнер с крыльями для корректного вращения
            const bladesContainer = this.add.container(millX, millY - 98);
            const blade1 = this.add.graphics();
            blade1.fillStyle(0x8a6a3a, 1);
            blade1.fillRect(-80, -4, 160, 8);
            blade1.fillStyle(0x6a4a2a, 1);
            blade1.fillTriangle(-80, -4, -80, 4, -95, 0);
            blade1.fillTriangle(80, -4, 80, 4, 95, 0);
            const blade2 = this.add.graphics();
            blade2.fillStyle(0x8a6a3a, 1);
            blade2.fillRect(-4, -82, 8, 160);
            blade2.fillStyle(0x6a4a2a, 1);
            blade2.fillTriangle(-4, -82, 4, -82, 0, -97);
            blade2.fillTriangle(-4, 78, 4, 78, 0, 93);
            bladesContainer.add([blade1, blade2]);
            bladesContainer.setDepth(6);
            this.tweens.add({
                targets: bladesContainer,
                angle: 360,
                duration: 8000,
                repeat: -1,
                ease: 'Linear',
            });
            // П.13: Много деревьев вокруг мельницы (с коллизиями)
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const isOnMill = (x, y) => Math.abs(x - millX) < 100 && Math.abs(y - millY) < 120;
            const isOnRoad = (y) => Math.abs(y - millY) < 50;
            for (let i = 0; i < 18; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnMill(x, y) && !isOnRoad(y) && !hasTreeCollision(x, y, 60)) {
                        this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(3);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        } else if (locId === 'apiary') {
            // П.8,9: Пасека — ровные ряды домиков-пасек + разбросанные деревья
            gfx.fillStyle(0x4a7c3a, 1);
            gfx.fillRect(0, 80, width, height - 80);
            gfx.setDepth(0);
            // Текстура травы
            gfx.fillStyle(0x5a8c4a, 0.5);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                gfx.fillRect(x, y, 3, 3);
            }
            // П.9: Ровные ряды очень маленьких домиков-пасек (улей)
            // 3 ряда по 5 домиков
            const placedHives = [];
            const hasHiveCollision = (x, y, minDist = 30) => {
                return placedHives.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 5; col++) {
                    const x = 120 + col * 220;
                    const y = 180 + row * 160;
                    if (hasHiveCollision(x, y, 30)) continue;
                    // Рисуем маленький домик-пасеку графикой
                    const hive = this.add.graphics();
                    // Корпус улья (жёлтый деревянный)
                    hive.fillStyle(0xc8a838, 1);
                    hive.fillRect(x - 25, y - 20, 50, 40);
                    // Крыша (тёмно-коричневая)
                    hive.fillStyle(0x4a3a1a, 1);
                    hive.fillTriangle(x - 30, y - 20, x + 30, y - 20, x, y - 40);
                    // Вход в улей (маленькое отверстие)
                    hive.fillStyle(0x2a1a0a, 1);
                    hive.fillRect(x - 5, y + 5, 10, 8);
                    // Полоски на улье (декорация)
                    hive.fillStyle(0x8a6818, 1);
                    hive.fillRect(x - 25, y - 10, 50, 2);
                    hive.fillRect(x - 25, y, 50, 2);
                    hive.setDepth(4);
                    placedHives.push({ x, y });
                }
            }
            // П.9: Разбросанные деревья по всей локации (с коллизиями)
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const isOnHive = (x, y) => hasHiveCollision(x, y, 40);
            for (let i = 0; i < 15; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnHive(x, y) && !hasTreeCollision(x, y, 60)) {
                        this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(3);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Цветы (для пчёл)
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * width;
                const y = 100 + Math.random() * (height - 120);
                this.add.text(x, y, '🌸', { fontSize: '12px' }).setOrigin(0.5).setDepth(2);
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

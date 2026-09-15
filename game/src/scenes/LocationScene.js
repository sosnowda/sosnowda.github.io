// Сцена локации (лес/тракт/река/поле) — поиск следов вора.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { FORK_LOCATIONS } from '../data/interiors.js';
import { THIEF_LOCATIONS } from '../data/thief.js';
import { getLocationById } from '../data/mapLocations.js';
import { searchLocation, getHuntState, checkGameEnd } from '../data/thief.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog, bindRestartOnResize } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { getTime, formatDateTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { getWeather, applyWeatherVisuals } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';

const LOCATION_BG = {
    forest: 0x1a2a1a,
    road: 0x4a3a2a,
    river: 0x4a7c3a,    // П.10: трава (река рисуется поверх)
    field: 0x4a7c3a,    // П.14: трава (жёлтое поле рисуется поверх)
    lake: 0x4a7c3a,     // П.12: трава (озеро рисуется поверх)
    pogost: 0x3a3a2a,
    pasture: 0x5a8a3a,
    mill: 0x4a7c3a,     // П.5,13: трава (мельница рисуется поверх)
};

export class LocationScene extends Phaser.Scene {
    constructor() {
        super('Location');
    }

    init(data) {
        this.locationId = data?.locationId || 'forest';
        this.from = data?.from || 'Fork';
        // Раунд 20 (слияние Пасек): статичного вида пасеки больше нет —
        // охотничья пасека открывается через ходячую ApiaryScene с поиском следов.
        if (this.locationId === 'apiary') {
            this.scene.start('Apiary', { from: this.from, hunt: true });
            return;
        }
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
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

        // ----- Погода (раунд 14): дождь/снег над текстовой локацией -----
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 96 });

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

        // Дата и время (п.13) + погода дня (раунд 14)
        if (timeState) {
            const weather = getWeather(this.registry);
            this.add.text(width / 2, 80, `📅 ${formatDateTime(timeState)}   ${weather.icon} ${weather.name}`, {
                fontSize: '11px', color: '#8ab4f8',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 1,
                backgroundColor: '#00000088', padding: { x: 6, y: 3 },
            }).setOrigin(0.5, 0).setDepth(100);
        }

        // ----- HUD -----
        const player = this.registry.get('player');
        const q = this.registry.get('quest') || {};
        this.add.text(16, 12, `❤ ${player.HP}/${player.HPmax}   ${t('✦ Воля')} ${player.MP}/${player.MPmax}   ${t('⚔ Меч')} ${player.skills.sword}%`, {
            fontSize: '14px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setDepth(100);
        this.turnsText = this.add.text(16, 40, tf('⏳ Ходов: {0}', state.turnsLeft), {
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
            this.add.text(width / 2, height * 0.4, t('Ты уже обыскивал эту местность.\nНовых следов здесь не найти.'), {
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
        const searchLabel = isRiver ? t('🔍 Поиск') : (isRoad ? t('🔍 Осмотр') : t('🔍 Искать следы'));
        const exitLabel = (isRiver || isRoad) ? t('🚪 Выход') : t('◀ Назад к развилке');

        // ----- Кнопка поиска/осмотра -----
        if (!alreadySearched) {
            createButton(this, width / 2, height - 100, tf('{0} (проверка Внимательности)', searchLabel), () => {
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
            // П.6,7: Погост — часовня по центру, ряды могил с крестами, дорожки.
            // Раунд 17: живой погост — трава-текстура вместо плоской заливки,
            // ограда по периметру, мерцающая лампада часовни, голуби,
            // клочья тумана, падающие листья, светлячки ночью. БЕЗ монстров.
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
            const weatherNow = getWeather(this.registry);
            const isWinter = weatherNow && weatherNow.id === 'snow';

            // Раунд 17: травяные пласты + кочки поверх тёмной земли (глушь, но живая)
            for (let i = 0; i < 26; i++) {
                const gx = Math.random() * width;
                const gy = 100 + Math.random() * (height - 130);
                const patch = this.add.image(gx, gy, `tile_grass_${i % 4}`)
                    .setScale(1.6).setAlpha(0.35).setTint(0x6a7a5a).setDepth(0.5);
                patch.setFlipX(i % 2 === 0);
            }
            if (this.textures.exists('deco_grass_tuft')) {
                for (let i = 0; i < 14; i++) {
                    this.add.image(Math.random() * width, 110 + Math.random() * (height - 160),
                        'deco_grass_tuft').setScale(1.2).setAlpha(0.55).setTint(0x8a9a78).setDepth(1);
                }
            }

            // П.7: Дорожка от входа (низ экрана) к часовне (центр)
            const pathW = 60;
            const chapelY = height * 0.35;
            gfx.fillStyle(0x8a7a5a, 1);
            gfx.fillRect(width / 2 - pathW / 2, chapelY + 40, pathW, height - chapelY - 60);
            gfx.setDepth(1);
            // Камешки дорожки — старая тропинка читается
            gfx.fillStyle(0x7a6a4c, 0.8);
            for (let i = 0; i < 26; i++) {
                gfx.fillCircle(
                    width / 2 - pathW / 2 + 8 + Math.random() * (pathW - 16),
                    chapelY + 50 + Math.random() * (height - chapelY - 80), 2.5,
                );
            }
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

            // ----- Раунд 17: лампада часовни — тёплый мерцающий отсвет -----
            const lampY = chapelY + 34;
            const lampGlow = this.add.ellipse(width / 2, lampY, 46, 20, 0xffb050, 0.30)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
            this.tweens.add({
                targets: lampGlow,
                alpha: { from: 0.22, to: 0.42 },
                scale: { from: 0.92, to: 1.08 },
                duration: 900,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            // Огонёк свечи в окне часовни (тлеет и днём — тихий маяк прихода)
            if (this.textures.exists('campfire_flame_0')) {
                const candle = this.add.sprite(width / 2 + 26, lampY - 6, 'campfire_flame_0')
                    .setScale(0.8).setDepth(6).setAlpha(0.9);
                const candleFrames = [0, 1, 2, 3].filter(f => this.textures.exists(`campfire_flame_${f}`));
                if (candleFrames.length) {
                    if (!this.anims.exists('pogost_candle')) {
                        this.anims.create({
                            key: 'pogost_candle',
                            frames: candleFrames.map(f => ({ key: `campfire_flame_${f}`, frame: 0 })),
                            frameRate: 6, repeat: -1,
                        });
                    }
                    candle.play('pogost_candle');
                }
            }

            // П.6,7: Ровные ряды могил с крестами по бокам от часовни
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
                        const grave = this.add.image(x, y, `deco_grave_${v}`).setScale(1.8).setDepth(3);
                        // Старые могилы чуть темнее (мох и время)
                        if ((row * 3 + col) % 3 === 0) grave.setTint(0xb0b0a0);
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
                        const grave = this.add.image(x, y, `deco_grave_${v}`).setScale(1.8).setDepth(3);
                        if ((row * 3 + col) % 3 === 1) grave.setTint(0xb0b0a0);
                    }
                    placedGraves.push({ x, y });
                }
            }
            // ----- Раунд 17: живые цветы на свежих могилах + каменные кресты -----
            if (!isWinter) {
                if (this.textures.exists('deco_flower_0')) {
                    [0, 4, 7].forEach((gi) => {
                        const g = placedGraves[gi];
                        if (!g) return;
                        const fl = `deco_flower_${gi % 3}`;
                        if (this.textures.exists(fl)) {
                            this.add.image(g.x + 10, g.y + 14, fl).setScale(1.1).setDepth(3.5).setAlpha(0.95);
                        }
                    });
                }
            }

            // П.7: Узкие дорожки между рядами могил
            gfx.fillStyle(0x7a6a4a, 1);
            // Вертикальная дорожка между рядами слева
            gfx.fillRect(145, chapelY + 60, 20, 220);
            // Вертикальная дорожка между рядами справа
            gfx.fillRect(width - 165, chapelY + 60, 20, 220);
            gfx.setDepth(1);

            // ----- Раунд 17: ограда погоста по периметру (столбики + жерди) -----
            if (this.textures.exists('tile_fence_h')) {
                for (let fx = 14; fx < width - 10; fx += 44) {
                    this.add.image(fx, 96, 'tile_fence_h').setScale(1.5).setDepth(2).setTint(0x9a8a70);
                }
                // Боковые жерди — частокол по краям, где не дороги
                for (let fy = 120; fy < height - 60; fy += 52) {
                    this.add.image(12, fy, 'tile_fence_h').setScale(1.5).setAngle(90).setDepth(2).setTint(0x9a8a70);
                    this.add.image(width - 12, fy, 'tile_fence_h').setScale(1.5).setAngle(90).setDepth(2).setTint(0x9a8a70);
                }
            }

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

            // ----- Раунд 17: голуби на погосте (живность, НЕ монстры) -----
            // Клюют, перепархивают между могилами; в снег прячутся.
            if (!isWinter && this.textures.exists('deco_bird')) {
                this.pogostBirds = [];
                for (let i = 0; i < 3; i++) {
                    const bx = width * 0.28 + i * width * 0.22;
                    const by = chapelY + 150 + (i % 2) * 90;
                    const bird = this.add.image(bx, by, 'deco_bird')
                        .setScale(2.2).setDepth(4).setFlipX(i % 2 === 0);
                    const hopBird = () => {
                        if (!bird.active) return;
                        // Клёв: наклон вниз
                        this.tweens.add({
                            targets: bird, scaleY: 1.7, duration: 160,
                            yoyo: true, ease: 'Quad.easeOut',
                            onComplete: () => {
                                this.time.delayedCall(Phaser.Math.Between(500, 1400), () => {
                                    if (!bird.active) return;
                                    // Перепархивает на новое место неподалёку
                                    const nx = Phaser.Math.Clamp(bird.x + Phaser.Math.Between(-90, 90), 40, width - 40);
                                    const ny = Phaser.Math.Clamp(bird.y + Phaser.Math.Between(-60, 60), 130, height - 120);
                                    this.tweens.add({
                                        targets: bird, x: nx, y: ny - 16,
                                        duration: 380, ease: 'Sine.easeOut',
                                        onComplete: () => {
                                            this.tweens.add({
                                                targets: bird, y: ny,
                                                duration: 200, ease: 'Quad.easeIn',
                                            });
                                        },
                                    });
                                    this.time.delayedCall(Phaser.Math.Between(1600, 3400), hopBird);
                                });
                            },
                        });
                    };
                    this.time.delayedCall(400 + i * 900, hopBird);
                    this.pogostBirds.push(bird);
                }
            }

            // ----- Раунд 17: клочья тумана меж могил -----
            this.pogostFog = [];
            for (let i = 0; i < 4; i++) {
                const fog = this.add.image(Math.random() * width, 160 + Math.random() * (height - 220), 'fog_puff')
                    .setScale(1.3 + Math.random() * 1.2).setAlpha(0.05).setDepth(6.5);
                this.tweens.add({
                    targets: fog,
                    x: fog.x + (Math.random() - 0.5) * 90,
                    duration: 13000 + Math.random() * 7000,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
                this.pogostFog.push(fog);
            }

            // ----- Раунд 17: падающие листья (ветер по берёзам) -----
            if (this.textures.exists('forest_leaf') && !isWinter) {
                this.pogostLeaves = this.add.particles(0, 0, 'forest_leaf', {
                    x: { min: 0, max: width },
                    y: -10,
                    lifespan: 9000,
                    speedY: { min: 18, max: 40 },
                    speedX: { min: -14, max: 22 },
                    rotate: { start: 0, end: 240 },
                    scale: { min: 0.7, max: 1.3 },
                    alpha: { start: 0.5, end: 0.15 },
                    quantity: 1,
                    frequency: 1600,
                }).setDepth(7);
            }

            // ----- Раунд 17: светлячки над могилами ночью (не страшно — тихо) -----
            const pogostTime = getTime(this.registry);
            const pogostHour = pogostTime ? pogostTime.hour : 12;
            const pogostDark = (pogostHour >= 21 || pogostHour < 5) ? 1 : (pogostHour >= 18 ? (pogostHour - 18) / 3 : (pogostHour < 8 ? (8 - pogostHour) / 3 : 0));
            if (pogostDark > 0.4 && this.textures.exists('particle_spark')) {
                for (let i = 0; i < 6; i++) {
                    const fx = 40 + Math.random() * (width - 80);
                    const fy = 140 + Math.random() * (height - 220);
                    const f = this.add.image(fx, fy, 'particle_spark')
                        .setScale(0.4).setTint(0xd8ffa0).setDepth(7.5).setAlpha(0);
                    this.tweens.add({
                        targets: f,
                        alpha: pogostDark * Phaser.Math.FloatBetween(0.3, 0.85),
                        duration: 1300 + Math.random() * 900,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                        delay: Math.random() * 1800,
                    });
                    this.tweens.add({
                        targets: f,
                        x: fx + Phaser.Math.Between(-26, 26),
                        y: fy + Phaser.Math.Between(-18, 18),
                        duration: 4200 + Math.random() * 2400,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
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
            // П.5,13: Мельница — большая мельница в центре, дорога, много деревьев.
            // Раунд 17: живая мельница — РУЧЕЙ с анимированной водой и вращающимся
            // НАЛИВНЫМ КОЛЕСОМ, мешки с мукой, поленница, телега на тракте,
            // мучная пыль у дверей, птицы. БЕЗ монстров и врагов.
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
            const weatherNowM = getWeather(this.registry);
            const isWinterM = weatherNowM && weatherNowM.id === 'snow';

            // Раунд 17: сочные травяные пласты + кочки
            for (let i = 0; i < 22; i++) {
                this.add.image(Math.random() * width, 110 + Math.random() * (height - 150),
                    `tile_grass_${i % 4}`).setScale(1.6).setAlpha(0.45).setDepth(0.5);
            }
            if (this.textures.exists('deco_grass_tuft') && !isWinterM) {
                for (let i = 0; i < 12; i++) {
                    this.add.image(Math.random() * width, 110 + Math.random() * (height - 160),
                        'deco_grass_tuft').setScale(1.2).setAlpha(0.7).setDepth(1);
                }
                if (this.textures.exists('deco_flower_0')) {
                    for (let i = 0; i < 8; i++) {
                        this.add.image(Math.random() * width, 130 + Math.random() * (height - 200),
                            `deco_flower_${i % 3}`).setScale(1).setAlpha(0.9).setDepth(1.2);
                    }
                }
            }

            // П.13: Дорога от края экрана до мельницы
            const millX = width / 2;
            const millY = height / 2;
            const roadW = 80;
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(0, millY - roadW / 2, millX - 80, roadW);
            gfx.setDepth(1);
            // Канавка-ручей идёт ПОД дорогой (брод) — дорога правее ручья продолжается
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(millX + 160, millY - roadW / 2, width - millX - 160, roadW);

            // ----- Раунд 17: РУЧЕЙ-МЕЛЬНИЧНАЯ (вертикальный, справа от мельницы) -----
            const streamX = millX + 118;          // центр ручья
            const streamW = 62;
            const streamTop = millY - 150;
            const streamBottom = height - 40;
            gfx.fillStyle(0x2e5a46, 1);           // тёмное дно с травой по краям
            gfx.fillRect(streamX - streamW / 2 - 8, streamTop - 6, streamW + 16, streamBottom - streamTop + 12);
            gfx.fillStyle(0x3a6b8c, 1);           // вода
            gfx.fillRect(streamX - streamW / 2, streamTop, streamW, streamBottom - streamTop);
            gfx.setDepth(1.5);
            // Анимированные тайлы воды (цикл 0..2, как пруд в деревне)
            this.millWaterTiles = [];
            for (let wy = streamTop + 22; wy < streamBottom; wy += 44) {
                const wImg = this.add.image(streamX, wy, 'tile_water_0')
                    .setScale(streamW / 64).setDepth(1.6).setAlpha(0.85);
                this.millWaterTiles.push(wImg);
            }
            this.millWaterFrame = 0;
            this.time.addEvent({
                delay: 320,
                loop: true,
                callback: () => {
                    this.millWaterFrame = (this.millWaterFrame + 1) % 3;
                    this.millWaterTiles.forEach(w => w.setTexture(`tile_water_${this.millWaterFrame}`));
                },
            });
            // Белые штрихи течения — бегут вниз (ручей ТОЧНО течёт)
            this.millRipples = [];
            for (let i = 0; i < 4; i++) {
                const rip = this.add.rectangle(
                    streamX - streamW / 2 + 12 + Math.random() * (streamW - 24),
                    streamTop + Math.random() * (streamBottom - streamTop),
                    12, 2, 0xdff0f8, 0.5,
                ).setDepth(1.7);
                this.tweens.add({
                    targets: rip,
                    y: streamBottom + 20,
                    alpha: { from: 0.55, to: 0.1 },
                    duration: 1500 + i * 350,
                    repeat: -1,
                    onRepeat: () => { rip.y = streamTop - 10; },
                });
                this.millRipples.push(rip);
            }
            // Пенная шапка у колеса
            this.add.ellipse(streamX, millY - 60, streamW * 0.9, 16, 0xe8f4f8, 0.25)
                .setDepth(1.8);

            // П.13: Большая мельница в центре
            const millGfx = this.add.graphics();
            // Основание мельницы (деревянная башня)
            millGfx.fillStyle(0x6a4a2a, 1);
            millGfx.fillRect(millX - 60, millY - 80, 120, 120);
            // Горизонтальные брёвна на башне (раунд 17)
            for (let ly = millY - 68; ly < millY + 36; ly += 12) {
                millGfx.fillStyle(0x5c3f22, 1);
                millGfx.fillRect(millX - 58, ly, 116, 2);
            }
            // Крыша мельницы (треугольная)
            millGfx.fillStyle(0x4a3a1a, 1);
            millGfx.fillTriangle(millX - 70, millY - 80, millX + 70, millY - 80, millX, millY - 140);
            // Окно
            millGfx.fillStyle(0x2a1a0a, 1);
            millGfx.fillRect(millX - 15, millY - 60, 30, 30);
            // Тёплый отсвет в окне (мелют и вечером)
            const winGlow = this.add.ellipse(millX, millY - 45, 34, 26, 0xffc866, 0.35)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(5.5);
            this.tweens.add({
                targets: winGlow,
                alpha: { from: 0.26, to: 0.42 },
                duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            // Дверь
            millGfx.fillStyle(0x3a2a1a, 1);
            millGfx.fillRect(millX - 12, millY - 10, 24, 50);
            millGfx.setDepth(5);

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

            // Контейнер с крыльями для корректного вращения
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

            // ----- Раунд 17: НАЛИВНОЕ КОЛЕСО в ручье (медленно крутится) -----
            const wheel = this.add.container(streamX - 6, millY + 10);
            const wheelGfx = this.add.graphics();
            wheelGfx.fillStyle(0x2e2013, 1);          // обод
            wheelGfx.fillCircle(0, 0, 36);
            wheelGfx.fillStyle(0x6a4a2a, 1);
            wheelGfx.fillCircle(0, 0, 31);
            wheelGfx.lineStyle(3, 0x2e2013, 1);       // спицы
            for (let a = 0; a < 6; a++) {
                const rad = (Math.PI / 3) * a;
                wheelGfx.lineBetween(
                    Math.cos(rad) * 4, Math.sin(rad) * 4,
                    Math.cos(rad) * 30, Math.sin(rad) * 30,
                );
            }
            wheelGfx.fillStyle(0x584026, 1);          // лопасти-ковши
            for (let a = 0; a < 8; a++) {
                const rad = (Math.PI / 4) * a;
                wheelGfx.fillRect(Math.cos(rad) * 30 - 4, Math.sin(rad) * 30 - 5, 8, 10);
            }
            wheelGfx.fillStyle(0x2e2013, 1);          // втулка
            wheelGfx.fillCircle(0, 0, 5);
            wheel.add(wheelGfx);
            wheel.setDepth(6.5);
            this.tweens.add({
                targets: wheel,
                angle: 360,
                duration: 14000,
                repeat: -1,
                ease: 'Linear',
            });

            // ----- Раунд 17: мешки с мукой у двери + поленница + телега -----
            const sacksGfx = this.add.graphics();
            [[millX - 40, millY + 30], [millX - 56, millY + 22]].forEach(([sx, sy]) => {
                sacksGfx.fillStyle(0x000000, 0.2);
                sacksGfx.fillEllipse(sx, sy + 10, 26, 6);
                sacksGfx.fillStyle(0xb8a070, 1);       // мешок
                sacksGfx.fillRoundedRect(sx - 11, sy - 8, 22, 20, 6);
                sacksGfx.fillStyle(0xa08858, 1);       // тень сбоку
                sacksGfx.fillRoundedRect(sx + 3, sy - 8, 7, 20, 3);
                sacksGfx.fillStyle(0x8a744c, 1);       // перевязка
                sacksGfx.fillRect(sx - 11, sy + 1, 22, 3);
            });
            sacksGfx.setDepth(5.8);
            if (this.textures.exists('deco_firewood')) {
                this.add.image(millX + 42, millY + 52, 'deco_firewood').setScale(1.8).setDepth(5.8);
            }
            if (this.textures.exists('deco_cart')) {
                const cart = this.add.image(millX * 0.42, millY + 6, 'deco_cart')
                    .setScale(2).setDepth(5.5);
                // Телега чуть покачивается под ветром — живая деталь
                this.tweens.add({
                    targets: cart,
                    angle: { from: -1.2, to: 1.2 },
                    duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }

            // ----- Раунд 17: мучная пыль у двери (золотистая взвесь) -----
            if (this.textures.exists('particle_spark')) {
                this.millDust = this.add.particles(0, 0, 'particle_spark', {
                    x: { min: millX - 46, max: millX + 46 },
                    y: { min: millY - 10, max: millY + 50 },
                    lifespan: 4200,
                    speedY: { min: -8, max: 10 },
                    speedX: { min: -6, max: 6 },
                    scale: { min: 0.12, max: 0.3 },
                    alpha: { start: 0.4, end: 0 },
                    quantity: 1,
                    frequency: 900,
                    tint: 0xf0e2b0,
                }).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
            }

            // ----- Раунд 17: птицы у ручья (живность, не монстры) -----
            if (!isWinterM && this.textures.exists('deco_bird')) {
                for (let i = 0; i < 2; i++) {
                    const bx = millX * 0.3 + i * 90;
                    const by = millY + 46;
                    const bird = this.add.image(bx, by, 'deco_bird')
                        .setScale(2).setDepth(6).setFlipX(i % 2 === 0);
                    this.tweens.add({
                        targets: bird,
                        scaleY: { from: 2, to: 1.5 },
                        duration: 220 + i * 90,
                        yoyo: true, repeat: -1, ease: 'Quad.easeOut',
                    });
                    this.tweens.add({
                        targets: bird,
                        x: bx + (i === 0 ? 60 : -70),
                        duration: 5200 + i * 1300,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }
            }

            // ----- Раунд 17: пара клочьев влажного тумана над ручьём -----
            for (let i = 0; i < 3; i++) {
                const fog = this.add.image(
                    streamX + Phaser.Math.Between(-30, 30),
                    streamTop + 60 + Math.random() * (streamBottom - streamTop - 120),
                    'fog_puff',
                ).setScale(1.1).setAlpha(0.06).setDepth(2);
                this.tweens.add({
                    targets: fog,
                    y: fog.y - 60,
                    alpha: 0.02,
                    duration: 9000 + Math.random() * 4000,
                    repeat: -1,
                    onRepeat: () => { fog.y = streamBottom - 40; fog.alpha = 0.06; },
                });
            }

            // П.13: Много деревьев вокруг мельницы (с коллизиями)
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const isOnMill = (x, y) => Math.abs(x - millX) < 100 && Math.abs(y - millY) < 120;
            const isOnRoad = (y) => Math.abs(y - millY) < 50;
            const isOnStream = (x) => Math.abs(x - streamX) < streamW / 2 + 26;
            for (let i = 0; i < 16; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnMill(x, y) && !isOnRoad(y) && !isOnStream(x) && !hasTreeCollision(x, y, 60)) {
                        this.add.image(x, y, `tile_forest_${i % 2}`).setScale(3).setOrigin(0.5, 0.7).setDepth(3);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        }
    }

    /**
     * Выполнить поиск следов вора.
     */
    doSearch() {
        const result = searchLocation(this.registry, this.locationId);
        this.turnsText.setText(tf('⏳ Ходов: {0}', result.turnsLeft));
        if (result.turnsLeft <= 3) this.turnsText.setColor('#ff4040');
        else if (result.turnsLeft <= 6) this.turnsText.setColor('#ffaa40');

        // Если вор сбежал — переход к концу
        if (result.thiefEscaped) {
            this.time.delayedCall(1500, () => this.scene.start('End'));
            return;
        }

        // Показать результат поиска через диалог
        const loc = FORK_LOCATIONS.find(l => l.id === this.locationId);
        const title = result.found ? t('✨ Следы найдены!') : t('🔍 Поиск следов');

        createDialog(this, title, result.message, [
            {
                text: result.found ? t('Погоня!') : t('Продолжить'),
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

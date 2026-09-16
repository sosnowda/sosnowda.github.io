// Сцена локации (лес/тракт/река/поле) — поиск следов вора.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { FORK_LOCATIONS } from '../data/interiors.js';
import { getLocationById } from '../data/mapLocations.js';
import {
    searchLocation, getHuntState, checkGameEnd,
    isChaseActive, isThiefAt, presentThiefEncounter, chaseTicksLeft,
} from '../data/thief.js';
import { onLocationVisited } from '../data/questGenerator.js';
import { ActionLog } from '../data/actionLog.js';
import { createButton, createDialog, bindRestartOnResize } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import { getTime, formatDateTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
import { getWeather, applyWeatherVisuals } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';
import { findNpc, getNpcDisplayName } from '../data/npcNames.js';
import { getNpcsAtPlace, NPC_DIALOGUE, OUTDOOR_LINES } from '../data/npcPresence.js';

// Раунд 27 (п.1): прозрачные деревья без фона вместо квадратных тайлов
const TREE_KEYS = ['deco_tree_0', 'deco_tree_1', 'deco_tree_2', 'deco_pine_0', 'deco_pine_1'];

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
        this.dialogue = new DialogueRunner(this);
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
        this.turnsText = this.add.text(16, 40, tf(t('⏳ Действий: {0}'), state.turnsLeft), {
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

        // ----- Состояние поиска + погоня (раунд 21) -----
        const chaseActive = isChaseActive(this.registry);
        const alreadySearched = state.locationsSearched.includes(this.locationId);
        if (chaseActive && alreadySearched) {
            this.add.text(width / 2, height * 0.4, t('Ты уже прочитал следы в этой местности.\nНовых здесь не найти.'), {
                fontSize: '18px', color: RUS.textDim, align: 'center',
                fontFamily: 'Georgia, serif',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5);
        }

        // ----- ВСТРЕЧА С ВОРОМ (раунд 21): если вор в локации — игрок видит его сразу -----
        if (isThiefAt(this.registry, this.locationId)) {
            this.time.delayedCall(400, () => presentThiefEncounter(this, this.locationId));
        }

        // П.11,16: Названия кнопок зависят от локации.
        // Для Реки: «Поиск» и «Выход». Для Тракта: «Осмотр» и «Выход».
        // Для остальных: «Искать следы» и «Назад к развилке».
        const isRiver = this.locationId === 'river';
        const isRoad = this.locationId === 'road' || this.locationId === 'road_south';
        const searchLabel = isRiver ? t('🔍 Поиск') : (isRoad ? t('🔍 Осмотр') : t('🔍 Искать следы'));
        const exitLabel = (isRiver || isRoad) ? t('🚪 Выход') : t('◀ Назад к развилке');

        // ----- Кнопка поиска/осмотра (только пока активна погоня) -----
        if (chaseActive && !alreadySearched) {
            createButton(this, width / 2, height - 100, tf('{0} (проверка Внимательности)', searchLabel), () => {
                this.doSearch();
            }, {
                backgroundColor: RUS.accent, hoverColor: RUS.accentLight, textColor: RUS.text,
                fontSize: 18, padding: { left: 24, right: 24, top: 14, bottom: 14 },
                cornerRadius: 8,
            });
        }

        // ----- Кнопка выхода (дорога обратно к развилке занимает время) -----
        createButton(this, width / 2, height - 50, exitLabel, () => {
            tickTime(this.registry, 15); // 1 тик на дорогу
            ActionLog.add(this.registry, `Игрок покинул локацию «${loc.name}».`);
            this.scene.start(this.from);
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 16, padding: { left: 20, right: 20, top: 12, bottom: 12 },
            cornerRadius: 8,
        });

        // ----- Раунд 27 (пп.7,8): ЖИТЕЛИ НА ЛОКАЦИЯХ —
        // Авдей на мельнице, Марфа с травами на озере/реке/в лесу и т.д.
        this.drawLocationNpcs(width, height);
    }

    /**
     * Раунд 27: NPC по системе присутствия (npcPresence.js) — если по
     * расписанию житель сейчас на этой локации, рисуем его спрайт,
     * имя и даём поговорить (полное дерево диалога или короткая реплика).
     */
    drawLocationNpcs(width, height) {
        const SPOTS = {
            mill:   { x: width * 0.5 - 100, y: height * 0.5 + 55 },
            lake:   { x: width * 0.5 + 60, y: height * 0.5 + 30 },
            river:  { x: width * 0.5 + 120, y: height * 0.5 + 30 },
            forest: { x: width * 0.42, y: height * 0.62 },
            field:  { x: width / 6 + (width * 2 / 3) * 0.28, y: height * 0.58 },
        };
        const spot = SPOTS[this.locationId];
        if (!spot) return;
        const here = getNpcsAtPlace(this.registry, this.locationId);
        here.slice(0, 2).forEach((npcId, i) => {
            const npcData = findNpc(this.registry, npcId);
            const displayName = npcData ? getNpcDisplayName(this.registry, npcId) : npcId;
            const spriteKey = (npcData && npcData.sprite) || 'npc_merchant';
            const x = spot.x - i * 55;
            const y = spot.y + i * 12;
            const spr = this.add.sprite(x, y, this.textures.exists(spriteKey) ? spriteKey : 'npc_elder')
                .setScale(2.3).setDepth(50);
            const animKey = `${spr.texture.key}_idle_down`;
            if (this.anims.exists(animKey)) spr.play(animKey);
            this.tweens.add({
                targets: spr,
                y: { from: y, to: y - 3 },
                duration: 1600 + i * 240, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this.add.text(x, y + 42, displayName, {
                fontSize: '13px', color: RUS.text,
                backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(50);
            this.add.text(x, y - 46, t('💬 Нажми, чтобы поговорить'), {
                fontSize: '10px', color: '#c9a14a',
                backgroundColor: '#00000088', padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(50);
            spr.setInteractive({ useHandCursor: true });
            spr.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.busyDialog) this.talkToLocationNpc(npcId);
            });
        });
    }

    /** Разговор с жителем на локации (раунд 27) */
    talkToLocationNpc(npcId) {
        this.busyDialog = true;
        const npcData = findNpc(this.registry, npcId);
        const displayName = npcData ? getNpcDisplayName(this.registry, npcId) : npcId;
        const dialogueId = NPC_DIALOGUE[npcId];
        if (dialogueId) {
            this.dialogue.run(dialogueId, () => { this.busyDialog = false; });
        } else {
            const line = OUTDOOR_LINES[npcId] || t('Занят(а) своим делом. Заходи в другой раз.');
            createDialog(this, displayName, line, [
                { text: t('Продолжить'), callback: () => { this.busyDialog = false; } },
            ], { singleton: true, portraitKey: (npcData && npcData.portrait) || 'portrait_villager_f' });
        }
    }

    update() {
        // Раунд 21: побег вора закрывает поход (пока открыт диалог — ждём)
        if (this.busyDialog) return;
        const endState = checkGameEnd(this.registry);
        if (endState) this.scene.start('End');
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
            // Раунд 27: деревья — ПРОЗРАЧНЫЕ спрайты (без квадратного фона),
            // с взаимной коллизией (п.2) — не наслаиваются друг на друга
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 58) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 20; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 110 + Math.random() * (height - 170);
                    if (!hasTreeCollision(x, y, 58)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(2.6).setOrigin(0.5, 0.88).setDepth(2 + (y % 7) * 0.1);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
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
            // П.15: Деревья по бокам дороги — с проверкой коллизий.
            // Раунд 27: прозрачные спрайты вместо квадратных тайлов.
            for (let i = 0; i < 12; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 6) ? Math.random() * 180 : width - Math.random() * 180;
                    const y = 100 + Math.random() * (height - 150);
                    if (!isOnRoad(y) && !hasCollision(x, y, 60)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(2.8).setOrigin(0.5, 0.88).setDepth(3);
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
            // Берега (песчаные кромки) вдоль реки
            const riverY = height * 0.45;
            const riverH = 120;
            gfx.fillStyle(0x8a7a5a, 1);
            gfx.fillRect(0, riverY - 6, width, 6);
            gfx.fillRect(0, riverY + riverH, width, 6);
            // Река — голубая горизонтальная полоса через весь экран (середина)
            gfx.fillStyle(0x2e5a78, 1);
            gfx.fillRect(0, riverY, width, riverH);
            gfx.setDepth(1);

            // ----- Раунд 27 (п.3): НАСТОЯЩИЕ ТАЙЛЫ ВОДЫ на реке -----
            // Раньше вода была плоской заливкой — «река без воды». Теперь
            // анимированные тайлы tile_water_0..2 (как пруд в деревне).
            this.riverWaterTiles = [];
            for (let wy = riverY + 16; wy < riverY + riverH - 8; wy += 34) {
                for (let wx = 26; wx < width; wx += 62) {
                    const img = this.add.image(wx, wy, 'tile_water_0')
                        .setScale(1.25).setDepth(1.4).setAlpha(0.8);
                    this.riverWaterTiles.push(img);
                }
            }
            this.riverWaterFrame = 0;
            this.time.addEvent({
                delay: 320,
                loop: true,
                callback: () => {
                    this.riverWaterFrame = (this.riverWaterFrame + 1) % 3;
                    this.riverWaterTiles.forEach(w => w.setTexture(`tile_water_${this.riverWaterFrame}`));
                },
            });
            // Блики течения
            gfx.fillStyle(0x6a9bbc, 0.5);
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * width;
                const y = riverY + Math.random() * riverH;
                gfx.fillRect(x, y, 10, 2);
            }

            // П.10.3: Густые заросли по берегам реки (раунд 27: прозрачные камыши
            // deco_reed и кусты deco_berry_bush вместо квадратных тайлов с фоном)
            const reedOk = this.textures.exists('deco_reed');
            const bushOk = this.textures.exists('deco_berry_bush');
            // Верхний берег
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * width;
                const y = riverY - 10 - Math.random() * 30;
                const useBush = (i % 4 === 0) && bushOk;
                const key = useBush ? 'deco_berry_bush' : (reedOk ? 'deco_reed' : 'tile_forest_0');
                this.add.image(x, y, key).setScale(useBush ? 1.6 : 1.9)
                    .setOrigin(0.5, 1).setDepth(2);
            }
            // Нижний берег
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * width;
                const y = riverY + riverH + 10 + Math.random() * 30;
                const useBush = (i % 4 === 1) && bushOk;
                const key = useBush ? 'deco_berry_bush' : (reedOk ? 'deco_reed' : 'tile_forest_0');
                this.add.image(x, y, key).setScale(useBush ? 1.6 : 1.9)
                    .setOrigin(0.5, 0).setDepth(2);
            }
            // П.10.4: Деревянный мост посередине реки (вертикальный)
            const bridgeX = width / 2;
            const bridgeW = 80;
            // Настил моста
            gfx.fillStyle(0x6a4a2a, 1);
            gfx.fillRect(bridgeX - bridgeW / 2, riverY - 10, bridgeW, riverH + 20);
            gfx.setDepth(3);
            // Доски моста (горизонтальные линии)
            gfx.fillStyle(0x4a3a1a, 1);
            for (let y = riverY; y < riverY + riverH; y += 12) {
                gfx.fillRect(bridgeX - bridgeW / 2, y, bridgeW, 2);
            }
            // Перила моста
            gfx.fillStyle(0x5a3a1a, 1);
            gfx.fillRect(bridgeX - bridgeW / 2 - 4, riverY - 15, 4, riverH + 20);
            gfx.fillRect(bridgeX + bridgeW / 2, riverY - 15, 4, riverH + 20);
            // ----- Раунд 27 (п.2 ФИКС): дорога шла ВДОЛЬ реки прямо ПО ВОДЕ и
            // «съедала» всю воду. Теперь дорога идёт ВЕРТИКАЛЬНО: с севера к
            // мосту и от моста на юг — вода на всей ленте реки видна.
            const roadW = 64;
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(bridgeX - roadW / 2, 80, roadW, riverY - 80);            // север → мост
            gfx.fillRect(bridgeX - roadW / 2, riverY + riverH, roadW, height - riverY - riverH - 50); // мост → юг
            gfx.setDepth(2);
            // Камешки на дороге
            gfx.fillStyle(0x8a7a4a, 0.6);
            for (let i = 0; i < 30; i++) {
                gfx.fillCircle(bridgeX - roadW / 2 + 6 + Math.random() * (roadW - 12), 90 + Math.random() * (height - 140), 1.8);
            }
            // П.10.5: Деревья разбросаны по всей локации, кроме воды, дороги и моста
            const placedTrees = [];
            const isOnRiver = (y) => y > riverY - 26 && y < riverY + riverH + 26;
            const isOnBridgeRoad = (x, y) => Math.abs(x - bridgeX) < roadW / 2 + 26;
            const hasTreeCollision = (x, y, minDist = 52) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            for (let i = 0; i < 18; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 110 + Math.random() * (height - 170);
                    if (!isOnRiver(y) && !isOnBridgeRoad(x) && !hasTreeCollision(x, y, 52)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(2.8).setOrigin(0.5, 0.88).setDepth(4);
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
            // Деревья по краям поля (раунд 27: прозрачные + взаимные коллизии)
            const placedFieldTrees = [];
            for (let i = 0; i < 6; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 3) ? Math.random() * (fieldX - 30) : width - Math.random() * (fieldX - 30);
                    const y = 120 + Math.random() * (height - 200);
                    const clash = placedFieldTrees.some(p => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60);
                    if (!clash) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(2.8).setOrigin(0.5, 0.88).setDepth(4);
                        placedFieldTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
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
            // П.12: Кусты по краям озера (раунд 27: прозрачные кусты deco_berry_bush
            // вместо квадратных тайлов tile_forest с фоном)
            const placedBushes = [];
            const hasBushCollision = (x, y, minDist = 30) => {
                return placedBushes.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const bushTex = this.textures.exists('deco_berry_bush') ? 'deco_berry_bush' : 'tile_forest_0';
            for (let i = 0; i < 30; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = lakeR + 15 + Math.random() * 40;
                    const x = lakeCX + Math.cos(angle) * r;
                    const y = lakeCY + Math.sin(angle) * r;
                    // Не на краю экрана
                    if (x > 20 && x < width - 20 && y > 100 && y < height - 20 && !hasBushCollision(x, y, 30)) {
                        this.add.image(x, y, bushTex).setScale(1.6).setOrigin(0.5, 0.8).setDepth(3);
                        placedBushes.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
            // Деревья по углам (раунд 27: прозрачные + взаимные коллизии)
            const placedLakeTrees = [];
            for (let i = 0; i < 6; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = (i < 3) ? Math.random() * 150 : width - Math.random() * 150;
                    const y = 110 + Math.random() * (height - 170);
                    const clash = placedLakeTrees.some(p => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60);
                    if (!clash) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(2.8).setOrigin(0.5, 0.88).setDepth(4);
                        placedLakeTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
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
            // Раунд 27 (п.4): мельница — ВЕТРЯНАЯ! Ручей, анимированная вода,
            // наливное колесо и туман над водой УДАЛЕНЫ (по указанию владельца).
            // Остались: мешки с мукой, поленница, телега, мучная пыль, птицы.
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

            // П.13: Дорога от края экрана до мельницы (раунд 27: сплошная, без брода)
            const millX = width / 2;
            const millY = height / 2;
            const roadW = 80;
            gfx.fillStyle(0xc8a868, 1);
            gfx.fillRect(0, millY - roadW / 2, width, roadW);
            gfx.setDepth(1);
            // Колеи на дороге
            gfx.fillStyle(0xa88848, 0.5);
            for (let i = 0; i < 24; i++) {
                gfx.fillRect(Math.random() * width, millY - roadW / 2 + 8 + Math.random() * (roadW - 20), 26, 3);
            }

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

            // Раунд 27 (п.4): НАЛИВНОЕ КОЛЕСО И РУЧЕЙ УДАЛЕНЫ —
            // мельница ветряная, работает от ветра (крылья выше).

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

            // ----- Раунд 17: птицы на траве перед мельницей (живность, не монстры) -----
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

            // Раунд 27 (п.4): влажный туман над ручьём УДАЛЕН — ручья больше нет.

            // П.13: Много деревьев вокруг мельницы (с коллизиями).
            // Раунд 27: прозрачные спрайты, без проверки ручья (его больше нет).
            const placedTrees = [];
            const hasTreeCollision = (x, y, minDist = 60) => {
                return placedTrees.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
            };
            const isOnMill = (x, y) => Math.abs(x - millX) < 100 && Math.abs(y - millY) < 120;
            const isOnRoad = (y) => Math.abs(y - millY) < 50;
            for (let i = 0; i < 16; i++) {
                let attempts = 0;
                while (attempts < 10) {
                    const x = Math.random() * width;
                    const y = 110 + Math.random() * (height - 170);
                    if (!isOnMill(x, y) && !isOnRoad(y) && !hasTreeCollision(x, y, 60)) {
                        const tex = TREE_KEYS[i % TREE_KEYS.length];
                        this.add.image(x, y, this.textures.exists(tex) ? tex : 'tile_forest_0')
                            .setScale(2.8).setOrigin(0.5, 0.88).setDepth(3);
                        placedTrees.push({ x, y });
                        break;
                    }
                    attempts++;
                }
            }
        }
    }

    /**
     * Выполнить поиск следов вора (раунд 21: следы/направление; бой теперь
     * начинается только при встрече с вором лично).
     */
    doSearch() {
        const result = searchLocation(this.registry, this.locationId);
        const ticksLeft = chaseTicksLeft(this.registry);
        this.turnsText.setText(tf(t('⏳ Действий: {0}'), ticksLeft));
        if (ticksLeft <= 3) this.turnsText.setColor('#ff4040');
        else if (ticksLeft <= 6) this.turnsText.setColor('#ffaa40');

        // Если вор сбежал — переход к концу
        if (result.thiefEscaped) {
            this.time.delayedCall(1500, () => this.scene.start('End'));
            return;
        }

        // Показать результат поиска через диалог
        const title = result.found ? t('✨ Следы найдены!') : t('🔍 Поиск следов');
        createDialog(this, title, result.message, [
            {
                text: t('Продолжить'),
                callback: () => {
                    // Раунд 21: вор мог прийти в локацию, пока мы искали
                    if (isThiefAt(this.registry, this.locationId)) {
                        this.scene.restart({ locationId: this.locationId, from: this.from });
                        return;
                    }
                    this.scene.restart({ locationId: this.locationId, from: this.from });
                },
            },
        ], {
            singleton: false,
            portraitKey: result.found ? 'portrait_narrator' : 'portrait_narrator',
            typing: true,
            typingSpeed: 30,
        });
    }
}

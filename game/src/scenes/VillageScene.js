// Деревня-оверхорлд: хаб с зданиями, воротами, сменой дня/ночи.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import {
    buildMap, SOLID, tileTexture, doorInteriorId, isGate,
    PLAYER_START, MAP_W, MAP_H, getVillageName,
} from '../data/world.js';
import { BUILDINGS, VILLAGE_GATE } from '../data/interiors.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { Tutorial } from '../systems/Tutorial.js';
import { VirtualControls } from '../systems/VirtualControls.js';
import { ActionLog } from '../data/actionLog.js';
import { checkGameEnd } from '../data/thief.js';
import { formatMoney } from '../systems/Character.js';
import { createButton } from '../utils/ui.js';
import { tickTime, getTime, getDayNightOverlay, formatDateTime } from '../systems/TimeSystem.js';

export class VillageScene extends Phaser.Scene {
    constructor() {
        super('Village');
    }

    create() {
        const ts = 48;
        this.tileSize = ts;
        this.worldW = MAP_W * ts;
        this.worldH = MAP_H * ts;

        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);
        this.dialogue = new DialogueRunner(this);

        // Фоновая музыка деревни (ambient)
        this.audioManager.playSceneMusic('village');

        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        this.map = buildMap();
        this.solids = this.physics.add.staticGroup();

        // ----- Отрисовка тайлов карты -----
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const t = this.map[y][x];
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;
                const texKey = tileTexture(t, x, y);
                const img = this.add.image(px, py, texKey);
                img.setScale(ts / 32);
                if (SOLID.has(t)) {
                    this.solids.create(px, py, texKey).setScale(ts / 32).refreshBody();
                }
            }
        }

        // ----- Анимация воды -----
        this.waterTiles = [];
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                if (this.map[y][x] === '~') {
                    const px = x * ts + ts / 2;
                    const py = y * ts + ts / 2;
                    const oldImg = this.children.list.find(c => c.x === px && c.y === py && c.texture && c.texture.key.startsWith('tile_water'));
                    if (oldImg) oldImg.destroy();
                    const waterImg = this.add.image(px, py, 'tile_water_0').setScale(ts / 32);
                    this.waterTiles.push({ img: waterImg, x, y });
                }
            }
        }
        this.waterFrame = 0;
        this.waterTimer = this.time.addEvent({
            delay: 300,
            callback: () => {
                this.waterFrame = (this.waterFrame + 1) % 3;
                this.waterTiles.forEach(w => {
                    w.img.setTexture(`tile_water_${this.waterFrame}`);
                });
            },
            loop: true,
        });

        // ----- Подсветка дверей и ворот -----
        this.doors = [];
        BUILDINGS.forEach(b => {
            const doorX = b.col + Math.floor(b.w / 2);
            const doorY = b.row + b.h - 1;
            const px = doorX * ts + ts / 2;
            const py = doorY * ts + ts / 2;
            // Метка здания над дверью — сдвинута ВЫШЕ, чтобы не перекрываться HUD
            const label = this.add.text(b.col * ts + b.w * ts / 2, (b.row - 1) * ts - 10, b.label, {
                fontSize: '14px', color: RUS.text, backgroundColor: '#00000088',
                padding: { x: 6, y: 3 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(10);
            // Золотой кружок над дверью
            const doorMarker = this.add.image(px, py - ts, 'particle_spark')
                .setTint(0xc9a14a)
                .setDisplaySize(20, 20)
                .setDepth(10);
            this.tweens.add({
                targets: doorMarker,
                alpha: { from: 0.7, to: 1 },
                scale: { from: 0.9, to: 1.1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
            this.doors.push({ x: doorX, y: doorY, interiorId: b.interiorId, label, marker: doorMarker });
        });

        // ----- Метка ворот -----
        const gatePx = (MAP_W - 1) * ts + ts / 2;
        const gatePy = VILLAGE_GATE.row * ts + ts / 2;
        const gateLabel = this.add.text(gatePx, gatePy - ts, 'ВЫХОД ▶', {
            fontSize: '16px', color: '#ff8060', backgroundColor: '#00000088',
            padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(10);
        const gateMarker = this.add.image(gatePx, gatePy - ts * 1.8, 'particle_spark')
            .setTint(0xff6040)
            .setDisplaySize(24, 24)
            .setDepth(10);
        this.tweens.add({
            targets: gateMarker,
            alpha: { from: 0.7, to: 1 },
            scale: { from: 0.9, to: 1.2 },
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // ----- Игрок -----
        this.player = this.registry.get('player');
        const ps = PLAYER_START;
        this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, this.player.sprite || 'player');
        this.playerObj.setScale(ts / 32 * 1.5);
        this.playerObj.setCollideWorldBounds(true);
        this.playerObj.play(`${this.player.sprite || 'player'}_idle_down`);
        this.physics.add.collider(this.playerObj, this.solids);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // ----- Управление -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        // Также стрелки вверх/вниз — фикс п.7: используем Space как альтернативу
        this.input.keyboard.on('keydown-SPACE', () => this.tryInteract());
        this.busyDialog = false;
        this.lastDir = 'down';
        this.lastStepTime = 0;
        this.stepInterval = 350;

        // ----- HUD (сверху, тонкая полоска) -----
        // Левый блок: HP/MP/Меч/Деньги — компактнее, чтобы не перекрывать здания
        this.hud = this.add.text(8, 6, '', {
            fontSize: '13px', color: RUS.text, backgroundColor: '#000000cc', padding: { x: 6, y: 4 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Под HUD — дата и время (п.13,14)
        this.dateTimeText = this.add.text(8, 30, '', {
            fontSize: '12px', color: '#8ab4f8', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Текущая цель квеста
        this.objectiveText = this.add.text(8, 52, '', {
            fontSize: '12px', color: '#c9a14a', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Счётчик ходов (ещё ниже)
        this.turnsText = this.add.text(8, 74, '', {
            fontSize: '12px', color: '#ff8060', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Название деревни — справа сверху
        const villageName = getVillageName();
        this.add.text(this.scale.width - 8, 6, villageName, {
            fontSize: '16px', color: RUS.textDim, backgroundColor: '#000000cc', padding: { x: 8, y: 4 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        // ----- Overlay для смены дня/ночи (п.5,11) -----
        this.dayNightOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(90)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);

        // ----- Кнопки меню сверху (Пункт 9) -----
        this.createTopMenu();

        this.prompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', {
            fontSize: '16px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 10, y: 5 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

        // ----- Туториал -----
        this.tutorial = new Tutorial(this);
        this.tutorial.maybeStart();

        // ----- Мобильное управление -----
        this.virtualControls = new VirtualControls(this);

        this.events.once('shutdown', () => {
            if (this.tutorial) this.tutorial.destroyAll();
            if (this.virtualControls) this.virtualControls.destroy();
        });
    }

    /**
     * Создать кнопки меню сверху: [Персонаж] [Инвентарь]
     */
    createTopMenu() {
        const { width } = this.scale;
        // Кнопка "Персонаж" — справа сверху, под названием деревни
        const charBtnX = width - 80;
        const charBtnY = 36;
        const charBtn = this.add.rectangle(charBtnX, charBtnY, 140, 26, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(100);
        const charText = this.add.text(charBtnX, charBtnY, '📜 Персонаж', {
            fontSize: '13px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        charBtn.on('pointerup', () => {
            ActionLog.add(this.registry, 'Открыл меню персонажа.');
            this.scene.pause();
            this.scene.launch('Character', { from: 'Village' });
        });
        charBtn.on('pointerover', () => charBtn.setFillStyle(0x5a4530, 1));
        charBtn.on('pointerout', () => charBtn.setFillStyle(0x4a3520, 0.95));

        // Кнопка "Инвентарь" — рядом
        const invBtnX = width - 80;
        const invBtnY = 66;
        const invBtn = this.add.rectangle(invBtnX, invBtnY, 140, 26, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(100);
        const invText = this.add.text(invBtnX, invBtnY, '🎒 Инвентарь', {
            fontSize: '13px', color: '#E8DCC4',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        invBtn.on('pointerup', () => {
            ActionLog.add(this.registry, 'Открыл инвентарь.');
            this.scene.pause();
            this.scene.launch('Character', { from: 'Village', tab: 'inventory' });
        });
        invBtn.on('pointerover', () => invBtn.setFillStyle(0x5a4530, 1));
        invBtn.on('pointerout', () => invBtn.setFillStyle(0x4a3520, 0.95));
    }

    update() {
        // Проверка конца игры
        const endState = checkGameEnd(this.registry);
        if (endState) {
            this.scene.start('End');
            return;
        }

        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            if (this.virtualControls) this.virtualControls.setVisible(false);
            return;
        }
        if (this.virtualControls) this.virtualControls.setVisible(true);

        const speed = 160;
        let vx = 0, vy = 0;

        const joyMove = this.virtualControls ? this.virtualControls.getMovement() : null;
        if (joyMove) {
            vx = joyMove.x;
            vy = joyMove.y;
        } else {
            // Фикс п.7: каждая клавиша проверяется отдельно, без else if
            if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
            if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
            if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
            if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
        }

        const v = new Phaser.Math.Vector2(vx, vy);
        if (v.length() > 0) {
            v.normalize().scale(speed);
            let dir = this.lastDir;
            if (Math.abs(vy) >= Math.abs(vx)) {
                dir = vy < 0 ? 'up' : 'down';
            } else {
                dir = vx < 0 ? 'left' : 'right';
            }
            if (dir !== this.lastDir || !this.playerObj.anims.isPlaying) {
                this.playerObj.play(`${this.player.sprite || 'player'}_walk_${dir}`, true);
                this.lastDir = dir;
            }
            const now = this.time.now;
            if (now - this.lastStepTime > this.stepInterval) {
                this.audioManager.playStep();
                this.lastStepTime = now;
                // Продвигаем время (1 шаг = ~5 игровых минут, п.4)
                tickTime(this.registry, 5);
            }
        } else {
            this.playerObj.anims.pause();
            this.playerObj.play(`${this.player.sprite || 'player'}_idle_${this.lastDir}`, true);
        }
        this.playerObj.setVelocity(v.x, v.y);

        this.updateNearestInteractable();
        this.updateHUD();
    }

    /**
     * Проверить, находится ли игрок рядом с дверью/воротами.
     */
    updateNearestInteractable() {
        const ts = this.tileSize;
        const px = Math.floor(this.playerObj.x / ts);
        const py = Math.floor(this.playerObj.y / ts);

        let nearest = null;
        let bestDist = 1.5;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = px + dx;
                const cy = py + dy;
                const interiorId = doorInteriorId(cx, cy);
                if (interiorId) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        const b = BUILDINGS.find(b => b.interiorId === interiorId);
                        nearest = { type: 'door', interiorId, label: b ? b.label : 'Войти' };
                    }
                }
                if (isGate(cx, cy)) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        nearest = { type: 'gate', label: 'Выйти из деревни' };
                    }
                }
            }
        }

        this.nearestInteractable = nearest;
        if (nearest) {
            this.prompt.setText(`Нажмите E — ${nearest.label}`).setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }
    }

    updateHUD() {
        const p = this.player;
        if (!p) return;
        const q = this.registry.get('quest') || {};
        // Используем реальные деньги Руси
        const moneyStr = formatMoney(p.dengas || 0);
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}  ✦${p.MP}/${p.MPmax}  ⚔${p.skills.sword}%  💰${moneyStr}`);
        
        // Дата и время (п.13,14)
        const timeState = getTime(this.registry);
        if (timeState) {
            this.dateTimeText.setText(`📅 ${formatDateTime(timeState)}`);
            // Обновляем overlay дня/ночи
            const overlay = getDayNightOverlay(timeState);
            if (this.dayNightOverlay) {
                this.dayNightOverlay.setFillStyle(overlay.color, overlay.alpha);
            }
        }
        
        if (q.currentObjective) {
            this.objectiveText.setText(`◆ ${q.currentObjective}`);
        }
        const turnsLeft = (q.turnLimit || 12) - (q.turnsUsed || 0);
        if (turnsLeft > 0 && !q.thiefDefeated && !q.thiefEscaped) {
            this.turnsText.setText(`⏳ Ходов: ${turnsLeft}`);
            if (turnsLeft <= 3) this.turnsText.setColor('#ff4040');
            else if (turnsLeft <= 6) this.turnsText.setColor('#ffaa40');
            else this.turnsText.setColor('#ff8060');
        } else {
            this.turnsText.setVisible(false);
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearestInteractable) return;
        ActionLog.add(this.registry, `Игрок взаимодействует с: ${this.nearestInteractable.label}.`);
        if (this.nearestInteractable.type === 'door') {
            this.scene.start('Interior', { interiorId: this.nearestInteractable.interiorId, from: 'Village' });
        } else if (this.nearestInteractable.type === 'gate') {
            this.scene.start('Fork');
        }
    }

    autosave() {
        // Сохранение отключено (одноразовая игра)
    }
}

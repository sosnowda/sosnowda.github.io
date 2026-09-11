// Деревня-оверхорлд: перемещение, взаимодействие с NPC, переход в бой.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import {
    buildMap, SOLID, tileTexture,
    NPCS, PLAYER_START, LOCATION_NAME, MAP_W, MAP_H, DECORATIONS
} from '../data/world.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { Tutorial } from '../systems/Tutorial.js';
import { VirtualControls } from '../systems/VirtualControls.js';

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
        // Сначала проходимые тайлы (фон), потом непроходимые (дома, лес, камни)
        // Создаём два прохода для правильного z-order
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const t = this.map[y][x];
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;
                const texKey = tileTexture(t, x, y);
                const img = this.add.image(px, py, texKey);
                // Масштаб 32→48
                img.setScale(ts / 32);
                // Непроходимые тайлы — добавляем в solids
                if (SOLID.has(t)) {
                    this.solids.create(px, py, texKey).setScale(ts / 32).refreshBody();
                }
            }
        }

        // ----- Анимация воды -----
        // Для каждого тайла воды создаём объект, переключающий кадр
        this.waterTiles = [];
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                if (this.map[y][x] === '~') {
                    const px = x * ts + ts / 2;
                    const py = y * ts + ts / 2;
                    // Заменяем статичную картинку на анимированную
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

        // ----- Декорации -----
        this.decorations = [];
        DECORATIONS.forEach(d => {
            const px = d.col * ts + ts / 2;
            const py = d.row * ts + ts / 2;
            if (d.type === 'well') {
                // 2×2 — 4 тайла
                const wellContainer = this.add.container(px, py);
                for (let i = 0; i < 4; i++) {
                    const dx = (i % 2) * ts - ts / 2;
                    const dy = Math.floor(i / 2) * ts - ts / 2;
                    const tile = this.add.image(dx, dy, `deco_well_${i}`).setScale(ts / 32);
                    wellContainer.add(tile);
                }
                wellContainer.setDepth(10);
                if (d.solid) this.solids.create(px, py, 'deco_well_0').setVisible(false).refreshBody();
                this.decorations.push({ container: wellContainer, type: 'well', ...d });
            } else if (d.type === 'campfire') {
                const fire = this.add.image(px, py, 'deco_campfire').setScale(ts / 32);
                fire.setDepth(10);
                // Лёгкое мерцание
                this.tweens.add({
                    targets: fire,
                    scaleX: { from: ts / 32 * 0.95, to: ts / 32 * 1.05 },
                    scaleY: { from: ts / 32 * 0.95, to: ts / 32 * 1.05 },
                    duration: 200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
                if (d.solid) this.solids.create(px, py, 'deco_campfire').setVisible(false).refreshBody();
                this.decorations.push({ sprite: fire, type: 'campfire', ...d });
            } else if (d.type === 'fence') {
                const fence = this.add.image(px, py, 'deco_fence').setScale(ts / 32);
                fence.setDepth(10);
                if (d.solid) this.solids.create(px, py, 'deco_fence').setVisible(false).refreshBody();
                this.decorations.push({ sprite: fence, type: 'fence', ...d });
            }
        });

        // ----- Игрок -----
        this.player = this.registry.get('player');
        const ps = PLAYER_START;
        this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, 'player');
        this.playerObj.setScale(ts / 32 * 1.5); // игрок чуть больше тайла
        this.playerObj.setCollideWorldBounds(true);
        this.playerObj.play('player_idle_down');
        this.physics.add.collider(this.playerObj, this.solids);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // ----- NPC -----
        this.npcs = [];
        NPCS.forEach(n => {
            if (n.combat && this.registry.get('quest').banditDefeated) return; // разбойник побеждён — не показываем
            const s = this.physics.add.sprite(n.col * ts + ts / 2, n.row * ts + ts / 2, n.sprite);
            s.setScale(ts / 32 * 1.5);
            s.setImmovable(true);
            s.play(`${n.sprite}_idle_down`);
            // Лёгкое «дыхание» для NPC
            this.tweens.add({
                targets: s,
                scaleX: { from: ts / 32 * 1.5, to: ts / 32 * 1.52 },
                scaleY: { from: ts / 32 * 1.5, to: ts / 32 * 1.48 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
            const label = this.add.text(s.x, s.y - 50, n.name, {
                fontSize: '14px', color: RUS.text, backgroundColor: '#00000088',
                padding: { x: 6, y: 3 },
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5);
            // Иконка типа взаимодействия
            const iconChar = n.combat ? '⚔' : '...';
            const icon = this.add.text(s.x, s.y - 36, iconChar, {
                fontSize: '12px', color: n.combat ? '#ff8060' : '#c9a14a',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5);
            s.npcData = n;
            s.nameLabel = label;
            s.interactIcon = icon;
            this.npcs.push(s);
        });

        // ----- Управление -----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.busyDialog = false;
        this.lastDir = 'down';

        // ----- Звук шагов -----
        this.lastStepTime = 0;
        this.stepInterval = 350; // мс между шагами

        // ----- HUD -----
        // Левый верхний угол — HP/MP/Меч
        this.hud = this.add.text(16, 12, '', {
            fontSize: '16px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);
        // Под HUD — текущая цель квеста
        this.objectiveText = this.add.text(16, 56, '', {
            fontSize: '14px', color: '#c9a14a', backgroundColor: '#000000aa', padding: { x: 8, y: 4 },
            stroke: '#000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);
        // Правый верхний угол — название локации
        this.add.text(this.scale.width - 16, 12, LOCATION_NAME, {
            fontSize: '18px', color: RUS.textDim, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        // Мини-карта 200×140 в правом верхнем углу
        this.createMinimap();

        // Подсказка взаимодействия (нижний центр)
        this.prompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', {
            fontSize: '18px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 12, y: 6 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

        this.autosave();

        // ----- Туториал (3 подсказки при первом входе) -----
        this.tutorial = new Tutorial(this);
        this.tutorial.maybeStart();

        // ----- Мобильное управление (показывается только на touch-устройствах) -----
        this.virtualControls = new VirtualControls(this);

        // При выходе из сцены — очистить туториал и контролы
        this.events.once('shutdown', () => {
            if (this.tutorial) this.tutorial.destroyAll();
            if (this.virtualControls) this.virtualControls.destroy();
        });
    }

    createMinimap() {
        const mmW = 200, mmH = 140;
        const mmX = this.scale.width - mmW - 16;
        const mmY = 56;
        const scaleX = mmW / this.worldW;
        const scaleY = mmH / this.worldH;

        // Рамка
        const border = this.add.rectangle(mmX + mmW / 2, mmY + mmH / 2, mmW + 4, mmH + 4, 0xc9a14a, 0.8)
            .setStrokeStyle(2, 0x000000).setScrollFactor(0).setDepth(100);
        const bg = this.add.rectangle(mmX + mmW / 2, mmY + mmH / 2, mmW, mmH, 0x1b2a1f, 0.7)
            .setScrollFactor(0).setDepth(100);

        // Контур реки
        const rivX = mmX + 19 * 48 * scaleX;
        this.add.rectangle(rivX, mmY + mmH / 2, 4 * scaleX, mmH, 0x3a6b8c, 0.7)
            .setScrollFactor(0).setDepth(101);
        // Мост
        const bridgeY = mmY + 9 * 48 * scaleY;
        this.add.rectangle(rivX, bridgeY, 4 * scaleX, 6 * scaleY, 0xb8975a, 1)
            .setScrollFactor(0).setDepth(101);

        // Маркеры NPC (статичные)
        this.minimapNpcMarkers = [];
        NPCS.forEach(n => {
            const mx = mmX + (n.col * 48 + 24) * scaleX;
            const my = mmY + (n.row * 48 + 24) * scaleY;
            const col = n.combat ? 0xff6040 : 0xffcc40;
            const marker = this.add.circle(mx, my, 3, col, 1).setScrollFactor(0).setDepth(102);
            this.minimapNpcMarkers.push({ marker, npc: n });
        });

        // Маркер игрока (обновляется каждый кадр)
        this.minimapPlayer = this.add.circle(mmX + 24 * scaleX, mmY + 24 * scaleY, 4, 0x60ff60, 1)
            .setStrokeStyle(1, 0x000000).setScrollFactor(0).setDepth(103);
        this.minimapBounds = { mmX, mmY, mmW, mmH, scaleX, scaleY };
    }

    updateMinimap() {
        if (!this.minimapPlayer || !this.minimapBounds) return;
        const { mmX, mmY, scaleX, scaleY } = this.minimapBounds;
        this.minimapPlayer.setPosition(
            mmX + this.playerObj.x * scaleX,
            mmY + this.playerObj.y * scaleY
        );
    }

    update() {
        if (this.busyDialog) {
            this.playerObj.setVelocity(0, 0);
            // Скрываем мобильные контролы во время диалога
            if (this.virtualControls) this.virtualControls.setVisible(false);
            return;
        }
        // Показываем мобильные контролы
        if (this.virtualControls) this.virtualControls.setVisible(true);

        const speed = 160;
        let vx = 0, vy = 0;

        // Сначала проверяем мобильный джойстик
        const joyMove = this.virtualControls ? this.virtualControls.getMovement() : null;
        if (joyMove) {
            vx = joyMove.x;
            vy = joyMove.y;
        } else {
            // Клавиатура
            if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
            else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
            if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
            else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
        }

        const v = new Phaser.Math.Vector2(vx, vy);
        if (v.length() > 0) {
            v.normalize().scale(speed);
            // Определяем направление для анимации
            let dir = this.lastDir;
            if (Math.abs(vy) >= Math.abs(vx)) {
                dir = vy < 0 ? 'up' : 'down';
            } else {
                dir = vx < 0 ? 'left' : 'right';
            }
            if (dir !== this.lastDir || !this.playerObj.anims.isPlaying) {
                this.playerObj.play(`player_walk_${dir}`, true);
                this.lastDir = dir;
            }
            // Звук шага
            const now = this.time.now;
            if (now - this.lastStepTime > this.stepInterval) {
                this.audioManager.playStep();
                this.lastStepTime = now;
            }
        } else {
            this.playerObj.anims.pause();
            // Возвращаем в idle
            this.playerObj.play(`player_idle_${this.lastDir}`, true);
        }
        this.playerObj.setVelocity(v.x, v.y);

        this.updateNearestNPC();
        this.updateHUD();
        this.updateMinimap();
    }

    updateNearestNPC() {
        let near = null, best = 80;
        this.npcs.forEach(n => {
            const d = Phaser.Math.Distance.Between(this.playerObj.x, this.playerObj.y, n.x, n.y);
            if (d < best) { best = d; near = n; }
        });
        this.nearest = near;
        if (near) {
            const t = near.npcData.combat ? 'Нажмите E — сразиться' : 'Нажмите E — поговорить';
            this.prompt.setText(t).setVisible(true);
        } else {
            this.prompt.setVisible(false);
        }
    }

    updateHUD() {
        const p = this.player;
        if (!p) return;
        this.hud.setText(`❤ ${p.HP}/${p.HPmax}   ✦ Воля ${p.MP}/${p.MPmax}   ⚔ Меч ${p.skills.sword}%`);
        const q = this.registry.get('quest');
        if (q && q.currentObjective) {
            this.objectiveText.setText(`◆ ${q.currentObjective}`);
        }
    }

    tryInteract() {
        if (this.busyDialog || !this.nearest) return;
        const n = this.nearest.npcData;
        if (n.combat) {
            this.startCombat(n);
        } else {
            this.busyDialog = true;
            this.activeNpc = n;
            // Поворачиваем NPC к игроку
            const dx = this.playerObj.x - this.nearest.x;
            const dy = this.playerObj.y - this.nearest.y;
            let dir = 'down';
            if (Math.abs(dy) >= Math.abs(dx)) dir = dy < 0 ? 'up' : 'down';
            else dir = dx < 0 ? 'left' : 'right';
            this.nearest.play(`${n.sprite}_idle_${dir}`, true);

            this.dialogue.run(n.dialogue, () => { this.busyDialog = false; });
        }
    }

    startCombat(npc) {
        this.scene.start('Combat', { enemyKeys: ['bandit'], npcId: npc.id });
    }

    autosave() {
        const p = this.registry.get('player');
        const q = this.registry.get('quest');
        this.saveManager.saveGame(0, { player: p, quest: q }, 'Поход');
    }
}

// Деревня-оверхорлд: перемещение, взаимодействие с NPC, переход в бой.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { buildMap, SOLID, TILE_KEY, NPCS, PLAYER_START, LOCATION_NAME, MAP_W, MAP_H } from '../data/world.js';
import { DialogueRunner } from '../systems/DialogueRunner.js';
import { createButton } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';

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

        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        this.map = buildMap();
        this.solids = this.physics.add.staticGroup();

        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const t = this.map[y][x];
                const px = x * ts + ts / 2;
                const py = y * ts + ts / 2;
                this.add.image(px, py, TILE_KEY[t]);
                if (SOLID.has(t)) this.solids.create(px, py, TILE_KEY[t]);
            }
        }

        // Игрок
        this.player = this.registry.get('player');
        const ps = PLAYER_START;
        this.playerObj = this.physics.add.sprite(ps.col * ts + ts / 2, ps.row * ts + ts / 2, 'player');
        this.playerObj.setCollideWorldBounds(true);
        this.physics.add.collider(this.playerObj, this.solids);
        this.cameras.main.startFollow(this.playerObj, true, 0.1, 0.1);

        // NPC
        this.npcs = [];
        NPCS.forEach(n => {
            if (n.combat && this.registry.get('quest').banditDefeated) return; // разбойник побеждён — не показываем
            const s = this.physics.add.sprite(n.col * ts + ts / 2, n.row * ts + ts / 2, n.sprite);
            s.setImmovable(true);
            const label = this.add.text(s.x, s.y - 34, n.name, {
                fontSize: '13px', color: RUS.text, backgroundColor: '#00000088',
                padding: { x: 4, y: 2 },
            }).setOrigin(0.5);
            s.npcData = n;
            s.nameLabel = label;
            this.npcs.push(s);
        });

        // Управление
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.input.keyboard.on('keydown-E', () => this.tryInteract());
        this.busyDialog = false;

        // HUD
        this.hud = this.add.text(16, 12, '', {
            fontSize: '16px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
        }).setScrollFactor(0).setDepth(100);
        this.add.text(this.scale.width - 16, 12, LOCATION_NAME, {
            fontSize: '16px', color: RUS.textDim, backgroundColor: '#000000aa', padding: { x: 8, y: 6 },
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        this.prompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', {
            fontSize: '18px', color: RUS.text, backgroundColor: '#000000aa', padding: { x: 8, y: 4 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

        // Старт с середины деревни, если разбойник уже побеждён — небольшое сообщение
        this.autosave();
    }

    update() {
        const speed = 160;
        let vx = 0, vy = 0;
        if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
        else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
        if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
        else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

        const v = new Phaser.Math.Vector2(vx, vy);
        if (v.length() > 0) v.normalize().scale(speed);
        this.playerObj.setVelocity(v.x, v.y);
        if (vx < 0) this.playerObj.setFlipX(true);
        else if (vx > 0) this.playerObj.setFlipX(false);

        this.updateNearestNPC();
        this.updateHUD();
    }

    updateNearestNPC() {
        let near = null, best = 70;
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
    }

    tryInteract() {
        if (this.busyDialog || !this.nearest) return;
        const n = this.nearest.npcData;
        if (n.combat) {
            this.startCombat(n);
        } else {
            this.busyDialog = true;
            this.activeNpc = n;
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

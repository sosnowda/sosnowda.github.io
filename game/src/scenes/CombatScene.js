// Пошаговый бой по системе BRP. Игрок и враг по очереди совершают действия.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { WEAPONS } from '../config/GameConfig.js';
import { skillCheck, rollDamage, ROLL_RESULT } from '../systems/BRPEngine.js';
import { spawnEnemy } from '../data/characters.js';
import { createButton, createFloatingText } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';

export class CombatScene extends Phaser.Scene {
    constructor() {
        super('Combat');
    }

    init(data) {
        this.enemyKeys = (data && data.enemyKeys) || ['bandit'];
        this.npcId = (data && data.npcId) || null;
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x140d0a);
        this.audioManager = new AudioManager(this);
        this.saveManager = new SaveManager(this);

        // Боевая музыка
        this.audioManager.playSceneMusic('combat');

        this.player = this.registry.get('player');
        this.enemies = this.enemyKeys.map(k => spawnEnemy(k));
        this.busy = false;
        this.playerDodging = false;
        this.logLines = [];
        this.barGfx = this.add.graphics().setDepth(50);

        // ----- Фон боевой сцены — тёмный лес -----
        this.add.graphics()
            .fillGradientStyle(0x1a0e08, 1, 0x0a0604, 1, 0)
            .fillRect(0, 0, width, height);

        // Деревья на фоне (декоративные)
        for (let i = 0; i < 8; i++) {
            const x = (i + 0.5) * (width / 8) + (Math.random() - 0.5) * 40;
            const y = 60 + Math.random() * 30;
            const tree = this.add.image(x, y, `tile_forest_${i % 2}`).setScale(2.5).setAlpha(0.4);
            tree.setOrigin(0.5, 0.7);
            tree.setDepth(0);
        }

        // ----- Игрок -----
        this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, 'player', 0).setScale(2.5);
        this.playerSprite.play('player_idle_down');
        // Лёгкое покачивание
        this.tweens.add({
            targets: this.playerSprite,
            y: { from: height * 0.55, to: height * 0.55 - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Имя игрока
        this.add.text(this.playerSprite.x, this.playerSprite.y + 80, this.player.name, {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);

        // ----- Враги -----
        this.enemySprites = [];
        const n = this.enemies.length;
        this.enemies.forEach((e, i) => {
            const y = height * 0.35 + (n > 1 ? i * (height * 0.3) : height * 0.18);
            const x = width * 0.72 + (n > 1 ? (i % 2) * 60 - 30 : 0);
            const sp = this.add.sprite(x, y, e.spriteKey, 0).setScale(2.5);
            sp.play(`${e.spriteKey}_idle_down`);
            // Покачивание врага
            this.tweens.add({
                targets: sp,
                y: { from: y, to: y - 4 },
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: i * 200,
            });
            const nm = this.add.text(sp.x, sp.y + 70, e.name, {
                fontSize: '15px', color: '#ffb3a0',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.enemySprites.push({ sprite: sp, combatant: e, label: nm, baseY: y });
        });

        // ----- Журнал боя -----
        this.logText = this.add.text(width / 2, 20, '', {
            fontSize: '16px', color: RUS.text, backgroundColor: '#00000099',
            padding: { x: 10, y: 8 }, align: 'center', wordWrap: { width: width - 80 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(60);

        this.createActions();
        this.drawBars();
        this.pushLog('Бой начинается! Приготовься, путник.');
    }

    createActions() {
        const { width, height } = this.scale;
        const mk = (x, y, label, cb, bg, hover) => createButton(
            this, x, y, label, () => { if (this.busy) return; cb(); },
            {
                backgroundColor: bg, hoverColor: hover, textColor: RUS.text, fontSize: 18,
                padding: { left: 18, right: 18, top: 12, bottom: 12 },
                cornerRadius: 8,
            },
        );
        const y = height - 50;
        mk(width / 2 - 280, y, '⚔ Мечом', () => this.playerAttack('sword'), RUS.accent, RUS.accentLight);
        mk(width / 2 - 95, y, '➶ Луком', () => this.playerAttack('bow'), 0x3a6b8c, 0x4a7b9c);
        mk(width / 2 + 95, y, 'Уклон', () => this.dodge(), 0x4a6a4a, 0x5a7a5a);
        mk(width / 2 + 280, y, 'Трава', () => this.useHerb(), 0x6a5a2a, 0x7a6a3a);
    }

    pushLog(msg) {
        this.logLines.push(msg);
        if (this.logLines.length > 5) this.logLines.shift();
        this.logText.setText(this.logLines.join('\n'));
    }

    drawBars() {
        const g = this.barGfx;
        g.clear();
        const bar = (x, y, w, ratio, col, bgCol = 0x000000) => {
            g.fillStyle(bgCol, 0.7);
            g.fillRoundedRect(x - 1, y - 1, w + 2, 12, 3);
            g.fillStyle(col, 1);
            g.fillRoundedRect(x, y, w * Phaser.Math.Clamp(ratio, 0, 1), 10, 2);
        };
        // HP игрока (зелёный)
        bar(this.playerSprite.x - 50, this.playerSprite.y - 90, 100, this.player.HP / this.player.HPmax, 0x4caf50);
        // HP врагов (красный)
        this.enemySprites.forEach(e => {
            if (e.combatant.HP > 0) bar(e.sprite.x - 50, e.sprite.y - 90, 100, e.combatant.HP / e.combatant.HPmax, 0xc0492f);
        });
    }

    firstAlive() {
        const e = this.enemySprites.find(x => x.combatant.HP > 0);
        return e ? e.combatant : null;
    }

    // ----- Эффекты удара -----

    /**
     * Проиграть анимацию подхода-удара-отскока для атакующего.
     */
    playLunge(attacker, target, onComplete) {
        const startX = attacker.x;
        const startY = attacker.y;
        const dx = target.x - startX;
        const dy = target.y - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const reachDist = dist - 60;
        const tx = startX + dx / dist * reachDist;
        const ty = startY + dy / dist * reachDist;

        this.tweens.chain({
            targets: attacker,
            tweens: [
                {
                    x: tx, y: ty,
                    duration: 180, ease: 'Quad.easeOut',
                },
                {
                    x: startX, y: startY,
                    duration: 220, ease: 'Quad.easeIn',
                    onComplete: () => { if (onComplete) onComplete(); }
                }
            ],
        });
    }

    /**
     * Проиграть эффект попадания по цели.
     */
    playHitEffect(x, y, type = 'blood') {
        const texKey = type === 'blood' ? 'particle_blood' : (type === 'spark' ? 'particle_spark' : 'particle_dust');
        const count = type === 'blood' ? 12 : 6;
        const speed = type === 'blood' ? 150 : 100;
        const lifespan = type === 'blood' ? 500 : 300;

        const emitter = this.add.particles(x, y, texKey, {
            speed: { min: -speed, max: speed },
            angle: { min: 0, max: 360 },
            scale: { start: 1.5, end: 0 },
            lifespan: lifespan,
            blendMode: 'ADD',
        });
        emitter.explode(count);

        // Flash-эффект на цели
        this.cameras.main.flash(80, 255, 50, 50);

        this.time.delayedCall(lifespan + 50, () => emitter.destroy());
    }

    /**
     * Вспышка критического удара — золотая.
     */
    playCritEffect(x, y) {
        // Большая золотая вспышка
        const flash = this.add.circle(x, y, 80, 0xffcc40, 0.6).setDepth(40);
        this.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy(),
        });
        // Частицы искр
        const emitter = this.add.particles(x, y, 'particle_spark', {
            speed: { min: -200, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            lifespan: 600,
            blendMode: 'ADD',
            tint: 0xffcc40,
        });
        emitter.explode(20);
        this.time.delayedCall(700, () => emitter.destroy());
        this.cameras.main.flash(150, 255, 200, 50);
    }

    playerAttack(weaponKey) {
        const w = WEAPONS[weaponKey];
        const skill = this.player.skills[w.skill];
        const res = skillCheck(skill);
        const target = this.firstAlive();
        if (!target) { this.endCombatVictory(); return; }

        const targetSprite = this.enemySprites.find(x => x.combatant === target).sprite;

        // Анимация подхода игрока
        this.playLunge(this.playerSprite, targetSprite, () => {
            // Обработка результата после подхода
            if (res.result === ROLL_RESULT.FAIL || res.result === ROLL_RESULT.FUMBLE) {
                this.pushLog(`${w.name}: ${res.roll} — промах!`);
                this.playHitEffect(targetSprite.x, targetSprite.y, 'dust');
                if (this.audioManager) this.audioManager.playSwordMiss();
            } else {
                const tw = this.enemySprites.find(x => x.combatant === target);
                const dodgeRes = skillCheck(target.dodge);
                if (dodgeRes.result === ROLL_RESULT.SUCCESS || dodgeRes.result === ROLL_RESULT.CRITICAL) {
                    this.pushLog(`${target.name} уклонился от удара (${dodgeRes.roll}).`);
                    this.playHitEffect(targetSprite.x, targetSprite.y, 'dust');
                    if (this.audioManager) this.audioManager.playSwordMiss();
                } else {
                    let dmg = rollDamage(w.dice, this.player.DB) + (w.bonus || 0);
                    const isCrit = res.result === ROLL_RESULT.CRITICAL;
                    if (isCrit) dmg = Math.ceil(dmg * 1.5);
                    target.HP = Math.max(0, target.HP - dmg);

                    // Flash цели
                    tw.sprite.setTintFill(0xff6060);
                    this.time.delayedCall(80, () => tw.sprite.clearTint());

                    createFloatingText(this, tw.sprite.x, tw.sprite.y - 60, `-${dmg}`, '#ff6b5a');
                    this.pushLog(`${w.name}: попадание! Урон ${dmg} (бросок ${res.roll})${isCrit ? ' [КРИТ!]' : ''}.`);

                    if (isCrit) {
                        this.playCritEffect(tw.sprite.x, tw.sprite.y);
                        if (this.audioManager) this.audioManager.playLevelUp();
                    } else {
                        this.playHitEffect(tw.sprite.x, tw.sprite.y, 'blood');
                        if (this.audioManager) this.audioManager.playSwordHit();
                    }
                    this.cameras.main.shake(120, isCrit ? 0.010 : 0.005);

                    if (target.HP <= 0) {
                        this.pushLog(`${target.name} повержен!`);
                        tw.sprite.setAlpha(0.4);
                        // Эффект "падения"
                        this.tweens.add({
                            targets: tw.sprite,
                            angle: 90,
                            y: tw.sprite.y + 20,
                            duration: 400,
                            ease: 'Quad.easeIn',
                        });
                    }
                }
            }
            this.drawBars();
            if (this.allDead()) {
                this.time.delayedCall(500, () => this.endCombatVictory());
                return;
            }
            this.busy = true;
            this.time.delayedCall(750, () => this.enemyTurn());
        });
    }

    dodge() {
        this.playerDodging = true;
        this.pushLog('Ты занимаешь оборонительную стойку, готовясь уклониться.');
        this.busy = true;
        this.time.delayedCall(500, () => this.enemyTurn());
    }

    useHerb() {
        const q = this.registry.get('quest');
        if (!q.hasHerb) { this.pushLog('У тебя нет целебной травы.'); return; }
        q.hasHerb = false;
        const heal = 3 + Math.floor(Math.random() * 4) + Math.floor(this.player.CON / 10);
        this.player.HP = Math.min(this.player.HPmax, this.player.HP + heal);
        createFloatingText(this, this.playerSprite.x, this.playerSprite.y - 60, `+${heal}`, '#7CFC00');
        this.pushLog(`Ты принял траву и восстановил ${heal} здоровья.`);
        if (this.audioManager) this.audioManager.playHeal();
        // Эффект исцеления — зелёные частицы
        const emitter = this.add.particles(this.playerSprite.x, this.playerSprite.y, 'particle_spark', {
            speed: { min: -80, max: 80 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.5, end: 0 },
            lifespan: 600,
            blendMode: 'ADD',
            tint: 0x60ff60,
        });
        emitter.explode(15);
        this.time.delayedCall(700, () => emitter.destroy());
        this.drawBars();
        this.autosave();
        this.busy = true;
        this.time.delayedCall(600, () => this.enemyTurn());
    }

    enemyTurn() {
        this.playerDodging = false;
        const alive = this.enemySprites.filter(e => e.combatant.HP > 0);
        if (alive.length === 0) { this.endCombatVictory(); return; }

        alive.forEach((e, idx) => {
            this.time.delayedCall(idx * 800 + 200, () => {
                if (this.player.HP <= 0) return;
                const en = e.combatant;
                const res = skillCheck(en.attackSkill);

                this.playLunge(e.sprite, this.playerSprite, () => {
                    if (res.result === ROLL_RESULT.FAIL || res.result === ROLL_RESULT.FUMBLE) {
                        this.pushLog(`${en.name}: ${res.roll} — промах.`);
                        this.playHitEffect(this.playerSprite.x, this.playerSprite.y, 'dust');
                        if (this.audioManager) this.audioManager.playSwordMiss();
                    } else {
                        if (this.playerDodging) {
                            const dr = skillCheck(this.player.skills.dodge);
                            if (dr.result === ROLL_RESULT.SUCCESS || dr.result === ROLL_RESULT.CRITICAL) {
                                this.pushLog(`Ты уклонился от ${en.name} (${dr.roll})!`);
                                this.playHitEffect(this.playerSprite.x, this.playerSprite.y, 'dust');
                                if (this.audioManager) this.audioManager.playSwordMiss();
                                this.drawBars();
                                if (idx === alive.length - 1) this.afterEnemy();
                                return;
                            }
                        }
                        const dmg = rollDamage(en.weapon.dice, en.DB);
                        this.player.HP = Math.max(0, this.player.HP - dmg);

                        // Flash игрока
                        this.playerSprite.setTintFill(0xff6060);
                        this.time.delayedCall(80, () => this.playerSprite.clearTint());

                        createFloatingText(this, this.playerSprite.x, this.playerSprite.y - 60, `-${dmg}`, '#ff6b5a');
                        this.pushLog(`${en.name} бьёт ${en.weapon.name}: урон ${dmg} (${res.roll}).`);
                        this.playHitEffect(this.playerSprite.x, this.playerSprite.y, 'blood');
                        if (this.audioManager) this.audioManager.playDamageTaken();
                        this.cameras.main.shake(120, 0.006);
                        this.drawBars();
                        if (this.player.HP <= 0) {
                            this.time.delayedCall(400, () => this.endCombatDefeat());
                            return;
                        }
                    }
                    if (idx === alive.length - 1) this.afterEnemy();
                });
            });
        });
    }

    afterEnemy() {
        this.busy = false;
        this.playerDodging = false;
        this.pushLog('Твой ход.');
    }

    allDead() {
        return this.enemySprites.every(e => e.combatant.HP <= 0);
    }

    autosave() {
        const q = this.registry.get('quest');
        this.saveManager.saveGame(0, { player: this.player, quest: q }, 'Поход');
    }

    endCombatVictory() {
        const q = this.registry.get('quest');
        if (this.npcId === 'bandit') q.banditDefeated = true;
        q.currentObjective = 'Вернись к старейшине с иконой';
        this.autosave();
        this.busy = true;
        this.pushLog('Враг повержен! Ты одержал победу.');
        if (this.audioManager) this.audioManager.playLevelUp();
        // Эффект победы — золотые частицы
        const emitter = this.add.particles(this.playerSprite.x, this.playerSprite.y, 'particle_spark', {
            speed: { min: -150, max: 150 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            lifespan: 1000,
            blendMode: 'ADD',
            tint: 0xffcc40,
        });
        emitter.explode(30);
        this.time.delayedCall(900, () => {
            emitter.destroy();
            this.scene.start('Village');
        });
    }

    endCombatDefeat() {
        this.busy = true;
        this.pushLog('Ты пал в бою...');
        // Затемнение
        this.cameras.main.fade(900, 0, 0, 0);
        this.time.delayedCall(900, () => this.scene.start('Title'));
    }
}

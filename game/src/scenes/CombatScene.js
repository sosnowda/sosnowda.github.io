// Пошаговый бой по системе BRP. Игрок и враг по очереди совершают действия.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { WEAPONS } from '../config/GameConfig.js';
import { skillCheck, rollDamage, ROLL_RESULT, applyDamage } from '../systems/BRPEngine.js';
import { spawnEnemy } from '../data/characters.js';
import { createButton, createFloatingText } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { ActionLog } from '../data/actionLog.js';
import { winGame, loseHeroDead } from '../data/thief.js';
import { getTime, getDayNightOverlay } from '../systems/TimeSystem.js';
import { applyWeatherVisuals } from '../systems/Weather.js';
import { t, tf } from '../systems/i18n.js';

export class CombatScene extends Phaser.Scene {
    constructor() {
        super('Combat');
    }

    init(data) {
        this.enemyKeys = (data && data.enemyKeys) || ['bandit'];
        this.npcId = (data && data.npcId) || null;
        this.fromLocation = (data && data.fromLocation) || null;
        // Раунд 13: возврат в Тёмный лес после боя с волком/засадой
        this.fromScene = (data && data.fromScene) || null;
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
        // Используем Fantasy Knight (aamatniekss) — side-view рыцарь.
        // Если у игрока есть sprite='player_custom' (создан через LPC),
        // в бою всё равно показываем рыцаря (боевая сцена — side-view).
        this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, 'knight_idle', 0);
        this.playerSprite.setScale(2.5);
        this.playerSprite.play('knight_idle');
        // Зеркалим по горизонтали — рыцарь смотрит вправо, а нам нужно влево (к врагам)
        this.playerSprite.setFlipX(true);
        // Лёгкое покачивание
        this.tweens.add({
            targets: this.playerSprite,
            y: { from: height * 0.55, to: height * 0.55 - 3 },
            duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Имя игрока
        this.add.text(this.playerSprite.x, this.playerSprite.y + 100, this.player.name, {
            fontSize: '16px', color: RUS.text,
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);

        // ----- Враги -----
        this.enemySprites = [];
        const n = this.enemies.length;
        this.enemies.forEach((e, i) => {
            const y = height * 0.35 + (n > 1 ? i * (height * 0.3) : height * 0.18);
            const x = width * 0.72 + (n > 1 ? (i % 2) * 60 - 30 : 0);
            let sp;
            if (e.spriteKey === 'enemy_wolf' && this.textures.exists('wolf_combat')) {
                // Используем LPC Wolf для врага-волка
                sp = this.add.sprite(x, y, 'wolf_combat', 0).setScale(2.5);
                sp.play('wolf_idle');
            } else if (this.textures.exists(`${e.spriteKey}_idle_down`)) {
                // Стандартный спрайт (bandit и т.п.) — top-down
                sp = this.add.sprite(x, y, e.spriteKey, 0).setScale(2.5);
                sp.play(`${e.spriteKey}_idle_down`);
            } else {
                // Fallback на рыцаря (для других врагов тоже используем knight_c2)
                sp = this.add.sprite(x, y, 'knight_idle_c2', 0).setScale(2.5);
                sp.play('knight_c2_idle');
            }
            // Покачивание врага
            this.tweens.add({
                targets: sp,
                y: { from: y, to: y - 4 },
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: i * 200,
            });
            const nm = this.add.text(sp.x, sp.y + 90, t(e.name), {
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
        this.pushLog(t('Бой начинается! Приготовься, путник.'));

        // ----- Overlay дня/ночи (п.5) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- Погода (раунд 14): дождь/снег видны и в бою -----
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 96 });
    }

    createActions() {
        const { width, height } = this.scale;
        const mk = (x, y, label, cb, bg, hover) => createButton(
            this, x, y, label, () => { if (this.busy) return; cb(); },
            {
                backgroundColor: bg, hoverColor: hover, textColor: RUS.text, fontSize: 16,
                padding: { left: 14, right: 14, top: 10, bottom: 10 },
                cornerRadius: 8,
            },
        );
        const y = height - 50;

        // Раунд 14: честные кнопки атаки. Раньше обе кнопки ("Мечом"/"Луком")
        // били экипированным оружием — надпись врала о выборе. Теперь:
        //  - основная кнопка = реально экипированное оружие (её имя на кнопке);
        //  - если экипировка не кулаки — доступен честный резерв "Кулаками".
        const equipped = this.player.weapon || WEAPONS.fists;
        const equippedKey = equipped.id || 'fists';
        const acts = [
            { label: `⚔ ${t(equipped.name)}`, cb: () => this.playerAttack(equippedKey),
              bg: RUS.accent, hover: RUS.accentLight },
        ];
        if (equipped.id !== 'fists') {
            acts.push({ label: t('🤜 Кулаками'), cb: () => this.playerAttack('fists'),
              bg: 0x6a5a40, hover: 0x7a6a50 });
        }
        acts.push(
            { label: t('Уклон'), cb: () => this.dodge(), bg: 0x4a6a4a, hover: 0x5a7a5a },
            { label: t('Трава'), cb: () => this.useHerb(), bg: 0x6a5a2a, hover: 0x7a6a3a },
            { label: t('🏃 Бежать'), cb: () => this.flee(), bg: 0x2a2a5a, hover: 0x3a3a6a },
        );
        // Равномерная раскладка по центру (4 или 5 кнопок)
        const gap = 160;
        const startX = width / 2 - (gap * (acts.length - 1)) / 2;
        acts.forEach((a, i) => mk(startX + i * gap, y, a.label, a.cb, a.bg, a.hover));
    }

    /**
     * Побег из боя (п.3).
     * Проверка навыка Dodge. При успехе — возврат в Village/Fork.
     * При провале — пропуск хода.
     * Счётчик ходов до побега вора продолжает тикать (вор ближе к побегу).
     */
    flee() {
        const dodgeSkill = this.player.skills.dodge || 25;
        const res = skillCheck(dodgeSkill);
        this.busy = true;

        if (res.result === 'critical' || res.result === 'success') {
            this.pushLog(tf('Ты успешно бежал с поля боя (бросок {0})!', res.roll));
            if (this.audioManager) this.audioManager.playSwordMiss();
            // Тратим 2 хода за побег (вор ближе к побегу)
            const q = this.registry.get('quest') || {};
            q.turnsUsed = (q.turnsUsed || 0) + 2;
            this.registry.set('quest', q);
            ActionLog.add(this.registry, `Побег из боя. Потеряно 2 хода (бросок ${res.roll}, успех).`);
            this.time.delayedCall(1000, () => {
                // Возврат в предыдущую сцену (раунд 13: лес возвращается в лес)
                if (this.fromScene === 'Forest') {
                    this.scene.start('Forest', { from: 'Combat' });
                } else if (this.fromLocation) {
                    this.scene.start('Fork');
                } else {
                    this.scene.start('Village');
                }
            });
        } else {
            this.pushLog(tf('Не удалось сбежать (бросок {0})! Враг атакует.', res.roll));
            if (this.audioManager) this.audioManager.playDamageTaken();
            // Тратим 1 ход за неудачный побег
            const q = this.registry.get('quest') || {};
            q.turnsUsed = (q.turnsUsed || 0) + 1;
            this.registry.set('quest', q);
            ActionLog.add(this.registry, `Неудачный побег из боя. Потерян 1 ход (бросок ${res.roll}, провал).`);
            this.time.delayedCall(800, () => this.enemyTurn());
        }
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
        // Раунд 14: используем оружие ВЫБРАННОЙ кнопки (а не всегда экипировку).
        // Кулаки — честный резерв с навыком brawl; экипировка передаётся своей кнопкой.
        const w = WEAPONS[weaponKey] || this.player.weapon || WEAPONS.fists;
        const skill = this.player.skills[w.skill] || 20;
        const res = skillCheck(skill);
        const target = this.firstAlive();
        if (!target) { this.endCombatVictory(); return; }

        const targetSprite = this.enemySprites.find(x => x.combatant === target).sprite;

        // Воспроизводим анимацию атаки рыцаря (выбираем случайно из 3 вариантов)
        const attackAnims = ['knight_attack1', 'knight_attack2', 'knight_attack_cmb'];
        const chosen = attackAnims[Math.floor(Math.random() * attackAnims.length)];
        if (this.anims.exists(chosen)) {
            this.playerSprite.play(chosen);
            // По завершении — возвращаемся в idle
            this.playerSprite.once('animationcomplete', () => {
                this.playerSprite.play('knight_idle');
            });
        }

        // Анимация подхода игрока
        this.playLunge(this.playerSprite, targetSprite, () => {
            // Обработка результата после подхода
            if (res.result === ROLL_RESULT.FAIL || res.result === ROLL_RESULT.FUMBLE) {
                this.pushLog(`${t(w.name)}: ${res.roll} — ${t('промах!')}`);
                this.playHitEffect(targetSprite.x, targetSprite.y, 'dust');
                if (this.audioManager) this.audioManager.playSwordMiss();
            } else {
                const tw = this.enemySprites.find(x => x.combatant === target);
                const dodgeRes = skillCheck(target.dodge);
                if (dodgeRes.result === ROLL_RESULT.SUCCESS || dodgeRes.result === ROLL_RESULT.CRITICAL) {
                    this.pushLog(tf('{0} уклонился от удара ({1}).', t(target.name), dodgeRes.roll));
                    this.playHitEffect(targetSprite.x, targetSprite.y, 'dust');
                    if (this.audioManager) this.audioManager.playSwordMiss();
                } else {
                    // BRP SRD: урон = weapon dice + DB, особый успех ×2
                    let dmg = rollDamage(w.dice, this.player.DB, res.special);
                    dmg += (w.bonus || 0);
                    const isCrit = res.result === ROLL_RESULT.CRITICAL;
                    if (isCrit) dmg = Math.ceil(dmg * 1.5);
                    // Броня врага поглощает урон
                    const targetArmorDef = target.armor ? target.armor.def : 0;
                    const { actualDmg, absorbed } = applyDamage(target, dmg, targetArmorDef);

                    // Flash цели
                    tw.sprite.setTintFill(0xff6060);
                    this.time.delayedCall(80, () => tw.sprite.clearTint());

                    createFloatingText(this, tw.sprite.x, tw.sprite.y - 60, `-${actualDmg}`, '#ff6b5a');
                    this.pushLog(tf('{0}: попадание! Урон {1}{2} (бросок {3}){4}{5}.', t(w.name), actualDmg, absorbed > 0 ? tf(' (бронь {0})', absorbed) : '', res.roll, isCrit ? t(' [КРИТ!]') : '', res.special ? t(' [ОСОБЫЙ!]') : ''));

                    if (isCrit) {
                        this.playCritEffect(tw.sprite.x, tw.sprite.y);
                        if (this.audioManager) this.audioManager.playLevelUp();
                    } else {
                        this.playHitEffect(tw.sprite.x, tw.sprite.y, 'blood');
                        if (this.audioManager) this.audioManager.playSwordHit();
                    }
                    this.cameras.main.shake(120, isCrit ? 0.010 : 0.005);

                    if (target.HP <= 0) {
                        this.pushLog(tf('{0} повержен!', t(target.name)));
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
        this.pushLog(t('Ты занимаешь оборонительную стойку, готовясь уклониться.'));
        this.busy = true;
        this.time.delayedCall(500, () => this.enemyTurn());
    }

    useHerb() {
        const q = this.registry.get('quest');
        if (!q.hasHerb) { this.pushLog(t('У тебя нет целебной травы.')); return; }
        q.hasHerb = false;
        const heal = 3 + Math.floor(Math.random() * 4) + Math.floor(this.player.CON / 10);
        this.player.HP = Math.min(this.player.HPmax, this.player.HP + heal);
        createFloatingText(this, this.playerSprite.x, this.playerSprite.y - 60, `+${heal}`, '#7CFC00');
        this.pushLog(tf('Ты принял траву и восстановил {0} здоровья.', heal));
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
                        this.pushLog(tf('{0}: {1} — промах.', t(en.name), res.roll));
                        this.playHitEffect(this.playerSprite.x, this.playerSprite.y, 'dust');
                        if (this.audioManager) this.audioManager.playSwordMiss();
                    } else {
                        if (this.playerDodging) {
                            const dr = skillCheck(this.player.skills.dodge);
                            if (dr.result === ROLL_RESULT.SUCCESS || dr.result === ROLL_RESULT.CRITICAL) {
                                this.pushLog(tf('Ты уклонился от {0} ({1})!', t(en.name), dr.roll));
                                this.playHitEffect(this.playerSprite.x, this.playerSprite.y, 'dust');
                                if (this.audioManager) this.audioManager.playSwordMiss();
                                this.drawBars();
                                if (idx === alive.length - 1) this.afterEnemy();
                                return;
                            }
                        }
                        // BRP SRD: урон = weapon dice + DB, особый успех ×2
                        const dmg = rollDamage(en.weapon.dice, en.DB, res.special);
                        // Броня игрока поглощает урон
                        const playerArmorDef = this.player.armor ? this.player.armor.def : 0;
                        const { actualDmg, absorbed } = applyDamage(this.player, dmg, playerArmorDef);

                        // Flash игрока
                        this.playerSprite.setTintFill(0xff6060);
                        this.time.delayedCall(80, () => this.playerSprite.clearTint());

                        createFloatingText(this, this.playerSprite.x, this.playerSprite.y - 60, `-${actualDmg}`, '#ff6b5a');
                        this.pushLog(tf('{0} бьёт {1}: урон {2}{3} ({4}){5}.', t(en.name), t(en.weapon.name), actualDmg, absorbed > 0 ? tf(' (бронь {0})', absorbed) : '', res.roll, res.special ? t(' [ОСОБЫЙ!]') : ''));
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
        this.pushLog(t('Твой ход.'));
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
        // Если это был вор — победа в игре
        const isThiefFight = this.enemies.some(e => e.isThief) || this.npcId === 'thief';
        if (isThiefFight) {
            winGame(this.registry);
            ActionLog.add(this.registry, `Бой с вором выигран. Вор повержен!`);
        } else if (this.npcId === 'bandit') {
            q.banditDefeated = true;
        }
        q.currentObjective = isThiefFight ? 'Победа! Икона возвращена!' : 'Враг повержен';
        this.autosave();
        this.busy = true;
        this.pushLog(isThiefFight ? t('Вор повержен! Икона твоя!') : t('Враг повержен! Ты одержал победу.'));
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
        this.time.delayedCall(1500, () => {
            emitter.destroy();
            // Переход в EndScene при победе над вором; в лес — после волка/засады (раунд 13)
            if (isThiefFight) {
                this.scene.start('End');
            } else if (this.fromScene === 'Forest') {
                // Стая напугана на 4 игровых часа
                const ts = this.registry.get('gameTime');
                if (ts) {
                    const q2 = this.registry.get('quest') || {};
                    q2.wolfScaredUntilMin = ts.day * 1440 + ts.hour * 60 + ts.minute + 240;
                    this.registry.set('quest', q2);
                }
                this.scene.start('Forest', { from: 'Combat' });
            } else {
                this.scene.start('Village');
            }
        });
    }

    endCombatDefeat() {
        this.busy = true;
        this.pushLog(t('Ты пал в бою...'));
        // Если бой с вором — поражение в игре
        const isThiefFight = this.enemies.some(e => e.isThief) || this.npcId === 'thief';
        if (isThiefFight) {
            loseHeroDead(this.registry);
            ActionLog.add(this.registry, `Бой с вором проигран. Герой пал.`);
        }
        // Затемнение
        this.cameras.main.fade(900, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            if (isThiefFight) {
                this.scene.start('End');
            } else {
                this.scene.start('Title');
            }
        });
    }
}

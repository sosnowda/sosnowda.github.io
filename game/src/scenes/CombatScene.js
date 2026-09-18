// Пошаговый бой по системе BRP. Игрок и враг по очереди совершают действия.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { WEAPONS } from '../config/GameConfig.js';
import { skillCheck, rollDamage, ROLL_RESULT, applyDamage } from '../systems/BRPEngine.js';
import { spawnEnemy, spawnVillagerEnemy } from '../data/characters.js';
import { createButton, createDialog, createFloatingText, registerAnchoredUI, onSceneResize } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { ActionLog } from '../data/actionLog.js';
import { loseHeroDead, recoverStolenItem, thiefFleesFromFight, saveThiefHp, restoreThiefHp } from '../data/thief.js';
// Раунд 45 (пп.3,4): последствия убийства НПЦ и перемирье после побега
import { applyNpcMurderConsequences, setNpcTruce } from '../data/reputation.js';
// Раунд 46 (п.1): жители дерутся своими характеристиками
import { findNpc } from '../data/npcNames.js';
import { getActiveQuests, checkQuestCompletion, consumeBlessing } from '../data/questGenerator.js';
import { getTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
import { applyWeatherVisuals } from '../systems/Weather.js';
// Раунд 32 (пп.14,15): F1 — «Информация по игре» и в бою
import { timeRatioInfoLine } from '../systems/WorldClock.js';
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
        // Раунд 46 (п.1 заявки): ЖИТЕЛЬ дерётся СВОИМИ характеристиками —
        // кузнец силён (молот, кожаный фартук), ученик моложе и слабее,
        // староста стар и слаб. Вор/волк/разбойник — как раньше, из шаблонов.
        const villagerId = (this.npcId && this.npcId.endsWith('_hostile'))
            ? this.npcId.slice(0, -'_hostile'.length)
            : null;
        const villagerNpc = villagerId ? findNpc(this.registry, villagerId) : null;
        this.enemies = villagerNpc
            ? [spawnVillagerEnemy(villagerNpc)]
            : this.enemyKeys.map(k => spawnEnemy(k));
        // Раунд 32 (п.11): вор НЕ лечится между боями — если прошлый бой был
        // прерван побегом игрока, у вора остаётся прежний запас HP
        const isThiefFightNow = this.enemyKeys.includes('thief') || this.npcId === 'thief';
        if (isThiefFightNow && this.enemies[0]) {
            const savedHp = restoreThiefHp(this.registry, this.enemies[0].HPmax);
            if (savedHp != null && savedHp < this.enemies[0].HP) {
                this.enemies[0].HP = savedHp;
                this.woundedThief = true;
            }
        }
        this.busy = false;
        this.playerDodging = false;
        this.logLines = [];
        this.barGfx = this.add.graphics().setDepth(50);

        // ----- Фон боевой сцены — тёмный лес (раунд 20: перерисовка при ресайзе) -----
        this.bgGfx = this.add.graphics();
        this.drawCombatBackground = (w, h) => {
            this.bgGfx.clear();
            this.bgGfx.fillGradientStyle(0x1a0e08, 1, 0x0a0604, 1, 0);
            this.bgGfx.fillRect(0, 0, w, h);
        };
        this.drawCombatBackground(width, height);
        onSceneResize(this, (w, h) => this.drawCombatBackground(w, h));

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
        // Раунд 23 (п.3): бойцы стоят ЛИЦОМ К ЛИЦУ. Рыцарь отрисов
        // мордой ВПРАВО, враги стоят справа — флип не нужен (раньше
        // setFlipX(true) разворачивал героя СПИНОЙ к врагам).
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

        // ----- Враги (раунд 23: лицом к лицу — враги смотрят ВЛЕВО, на игрока) -----
        this.enemySprites = [];
        const n = this.enemies.length;
        // Раунд 23 (п.5): вой волка в начале боя
        const hasWolf = this.enemies.some(e => e.spriteKey === 'enemy_wolf');
        if (hasWolf) {
            this.time.delayedCall(400, () => {
                if (this.audioManager) this.audioManager.playWolfHowl();
            });
        }
        this.enemies.forEach((e, i) => {
            const y = height * 0.35 + (n > 1 ? i * (height * 0.3) : height * 0.18);
            const x = width * 0.72 + (n > 1 ? (i % 2) * 60 - 30 : 0);
            let sp;
            let isWolf = false;
            if (e.spriteKey === 'enemy_wolf' && this.anims.exists('wolf_side_idle')) {
                // Раунд 23: боковой вид волка (мордой вправо) — флипаем,
                // чтобы морда была направлена ВЛЕВО, на игрока.
                // Фаза 1 ФИКС: одиночный кадр стойки (frame 5) вместо «двойного» 15;
                // волк нарисован в верхней половине ячейки — смещаем origin вниз по форме
                sp = this.add.sprite(x, y, 'wolf_full_1', 5).setScale(2.2).setOrigin(0.5, 0.25);
                sp.setFlipX(true);
                sp.play('wolf_side_idle');
                isWolf = true;
            } else if (this.anims.exists(`${e.spriteKey}_idle_left`)) {
                // Человекоподобные враги (разбойник/вор) — вид СБОКУ слева,
                // мордой к игроку (раньше стояли спиной/лицом к камере).
                sp = this.add.sprite(x, y, e.spriteKey, 0).setScale(2.5);
                sp.play(`${e.spriteKey}_idle_left`);
            } else if (this.textures.exists(`${e.spriteKey}_idle_down`)) {
                // Fallback — стандартный спрайт (top-down)
                sp = this.add.sprite(x, y, e.spriteKey, 0).setScale(2.5);
                sp.play(`${e.spriteKey}_idle_down`);
            } else if (this.textures.exists(e.spriteKey)) {
                // Раунд 33 (фикс): если анимации не успели создаться (гонка при
                // старте) — показываем СТАТИЧНЫЙ кадр собственного спрайта врага
                // (вид спереди), а НЕ запасного рыцаря, одинакового с игроком.
                sp = this.add.sprite(x, y, e.spriteKey, 0).setScale(2.5);
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
            this.enemySprites.push({ sprite: sp, combatant: e, label: nm, baseY: y, isWolf });
        });

        // ----- Журнал боя (раунд 20: анкор-центр при ресайзе) -----
        this.logText = this.add.text(width / 2, 20, '', {
            fontSize: '16px', color: RUS.text, backgroundColor: '#00000099',
            padding: { x: 10, y: 8 }, align: 'center', wordWrap: { width: Math.max(240, width - 80) },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(60);
        registerAnchoredUI(this, this.logText, width / 2, 20);

        this.createActions();
        this.drawBars();
        this.pushLog(t('Бой начинается! Приготовься, путник.'));
        // Раунд 32 (п.11): предупреждение о раненом воре (после прошлого побега игрока)
        if (this.woundedThief) {
            this.pushLog(t('Вор ещё не залечил раны с прошлой схватки — он ослаблен!'));
        }
        // Раунд 32 (пп.14,15): F1 — «Информация по игре» (бой пошаговый —
        // время мира на паузе, но правила часов игрок должен знать)
        this.input.keyboard.on('keydown-F1', () => {
            if (this.busyDialog) return;
            this.busyDialog = true;
            createDialog(this, '❓ Информация по игре',
                timeRatioInfoLine() + '\n\n' +
                t('⚔ Бой пошаговый (BRP d100): атака, уклон, трава, побег.\nПроверки навыков бросают d100: успех — в пределах навыка,\nкрит — 1/20 навыка (урон ×1.5), особый успех — 1/5 (урон ×2).\n🛡 Доспех поглощает урон каждого попадания.'),
                [{ text: t('Понятно'), callback: () => { this.busyDialog = false; } }],
                { singletonKey: 'combat-help' });
        });

        // ----- Overlay дня/ночи (п.5) -----
        const timeState = getTime(this.registry);
        if (timeState) {
            const overlay = getDayNightOverlay(timeState);
            this.add.rectangle(0, 0, width, height, overlay.color, overlay.alpha)
                .setOrigin(0).setDepth(95).setBlendMode(Phaser.BlendModes.MULTIPLY);
        }

        // ----- Погода (раунд 14): дождь/снег видны и в бою -----
        applyWeatherVisuals(this, { tintDepth: 94, precipDepth: 96 });

        // ----- Фаза 1: виньетка по краям — журнал боя и кнопки читаются лучше,
        // край экрана мягко уходит в темноту (поверх погоды, ниже ничего интерактивного) -----
        if (this.textures.exists('vignette_soft')) {
            this.add.image(0, 0, 'vignette_soft')
                .setOrigin(0, 0).setDisplaySize(width, height)
                .setScrollFactor(0).setDepth(97).setAlpha(0.8);
        }
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
        const dodgeSkill = consumeBlessing(this.registry, this.player.skills.dodge || 25);
        const res = skillCheck(dodgeSkill);
        this.busy = true;
        // Раунд 45 (п.4): бой с враждебным ЖИТЕЛЕМ (не вор, не разбойник с тракта)
        const hostileVictimId = (!this.enemies.some(e => e.isThief) && this.npcId && this.npcId.endsWith('_hostile'))
            ? this.npcId.slice(0, -'_hostile'.length)
            : null;

        if (res.result === 'critical' || res.result === 'success') {
            this.pushLog(tf('Ты успешно бежал с поля боя (бросок {0})!', res.roll));
            if (this.audioManager) this.audioManager.playSwordMiss();
            // Раунд 21: побег занимает время — 2 тика (вор тоже двигается)
            tickTime(this.registry, 30);
            // Раунд 32 (пп.11,12,13): после побега игрока из боя с вором:
            //  п.11 — вор НЕ лечится (сохраняем его текущий HP);
            //  п.13 — вор ещё 3 часа сидит на этой локации;
            //  п.12 — игрока автоматически переносит ко входу в Деревню.
            const isThiefFight = this.enemies.some(e => e.isThief) || this.npcId === 'thief';
            if (isThiefFight) {
                const thiefEnemy = this.enemies.find(e => e.isThief);
                if (thiefEnemy) saveThiefHp(this.registry, thiefEnemy.HP);
                thiefFleesFromFight(this.registry, this.fromLocation);
            } else if (hostileVictimId) {
                // Раунд 45 (п.4): сбежать от НПЦ можно НЕ убивая его.
                // После побега НПЦ НЕ нападает повторно сразу — перемирье 12 ч.
                setNpcTruce(this.registry, hostileVictimId, 12);
                ActionLog.add(this.registry, `Побег из боя с разгневанным жителем (бросок ${res.roll}, успех). Он не нападёт снова сразу — перемирье на 12 часов.`);
            } else {
                ActionLog.add(this.registry, `Побег из боя. Потеряно 2 действия (бросок ${res.roll}, успех).`);
            }
            this.time.delayedCall(1000, () => {
                // Раунд 32 (п.12): после побега от вора — всегда деревня (вход в локацию)
                if (isThiefFight) {
                    this.scene.start('Village');
                } else if (this.fromScene === 'Forest') {
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
            // Раунд 21: неудачный побег занимает 1 тик
            tickTime(this.registry, 15);
            ActionLog.add(this.registry, `Неудачный побег из боя. Потеряно 1 действие (бросок ${res.roll}, провал).`);
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
     * Фаза 1: при попадании кровью — крупный всплеск-декаль fx_blood_splat
     * (DarklandsReborn) со случайным поворотом и разлётом частиц.
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

        // Фаза 1: кровавый всплеск — растёт и растворяется
        if (type === 'blood' && this.textures.exists('fx_blood_splat')) {
            const splat = this.add.image(x, y, 'fx_blood_splat')
                .setDepth(38)
                .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
                .setScale(Phaser.Math.FloatBetween(0.45, 0.7))
                .setAlpha(0.95);
            this.tweens.add({
                targets: splat,
                scale: splat.scale * 1.7,
                alpha: 0,
                duration: 520,
                ease: 'Quad.easeOut',
                onComplete: () => splat.destroy(),
            });
        }

        // Flash-эффект только при реальном попадании — на промахе/уклонении
        // красная вспышка камеры была ложным сигналом
        if (type !== 'dust') {
            this.cameras.main.flash(80, 255, 50, 50);
        }

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

    /**
     * Раунд 23: анимация атаки врага во время выпада.
     * Волк — боковой «рык», человекоподобные — бег влево к игроку.
     */
    playEnemyAttackAnim(rec) {
        const sp = rec.sprite;
        if (rec.isWolf) {
            if (this.anims.exists('wolf_side_attack')) sp.play('wolf_side_attack');
        } else {
            const key = rec.combatant.spriteKey;
            if (this.anims.exists(`${key}_walk_left`)) sp.play(`${key}_walk_left`);
        }
    }

    /**
     * Раунд 23: вернуть врага в боковую idle-стойку лицом к игроку.
     */
    restoreEnemyIdle(rec) {
        if (!rec.sprite || !rec.sprite.active) return;
        if (rec.isWolf) {
            if (this.anims.exists('wolf_side_idle')) rec.sprite.play('wolf_side_idle');
        } else {
            const key = rec.combatant.spriteKey;
            if (this.anims.exists(`${key}_idle_left`)) rec.sprite.play(`${key}_idle_left`);
        }
    }

    playerAttack(weaponKey) {
        // Раунд 14: используем оружие ВЫБРАННОЙ кнопки (а не всегда экипировку).
        // Кулаки — честный резерв с навыком brawl; экипировка передаётся своей кнопкой.
        const w = WEAPONS[weaponKey] || this.player.weapon || WEAPONS.fists;
        // Раунд 22 (п.11): благословение батюшки усиливает ОДНУ проверку навыка
        const skill = consumeBlessing(this.registry, this.player.skills[w.skill] || 20);
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

        // Раунд 23 (п.5): свист оружия в начале выпада
        if (this.audioManager) this.audioManager.playWeaponSwing();
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
                    // BRP SRD: урон = weapon dice + DB, особый успех ×2.
                    // Раунд 35 (QA-фикс P1): критический успех одновременно
                    // считался «особым» (крит — подмножество особых), и урон
                    // получал ×2 (особый) и ×1.5 (крит) = ×3, хотя справка боя
                    // обещает «крит ×1.5». Теперь крит не удваивает урон как
                    // особый — применяется только обещанный множитель ×1.5.
                    const isCrit = res.result === ROLL_RESULT.CRITICAL;
                    let dmg = rollDamage(w.dice, this.player.DB, res.special && !isCrit);
                    dmg += (w.bonus || 0);
                    if (isCrit) dmg = Math.ceil(dmg * 1.5);
                    // Броня врага поглощает урон
                    const targetArmorDef = target.armor ? target.armor.def : 0;
                    const { actualDmg, absorbed } = applyDamage(target, dmg, targetArmorDef);

                    // Flash цели
                    tw.sprite.setTintFill(0xff6060);
                    this.time.delayedCall(80, () => tw.sprite.clearTint());

                    createFloatingText(this, tw.sprite.x, tw.sprite.y - 60, `-${actualDmg}`, '#ff6b5a');
                    this.pushLog(tf('{0}: попадание! Урон {1}{2} (бросок {3}){4}{5}.', t(w.name), actualDmg, absorbed > 0 ? tf(' (бронь {0})', absorbed) : '', res.roll, isCrit ? t(' [КРИТ!]') : '', res.special ? t(' [ОСОБЫЙ!]') : ''));

                    // Раунд 23 (п.5): звук по исходу удара — тело / доспех / щит
                    if (this.audioManager) {
                        if (absorbed > 0) {
                            if (actualDmg === 0) this.audioManager.playShieldHit();
                            else this.audioManager.playArmorHit();
                        } else {
                            this.audioManager.playSwordHit();
                        }
                    }
                    if (isCrit) {
                        this.playCritEffect(tw.sprite.x, tw.sprite.y);
                        if (this.audioManager) this.audioManager.playLevelUp();
                    } else {
                        this.playHitEffect(tw.sprite.x, tw.sprite.y, 'blood');
                    }
                    this.cameras.main.shake(140, isCrit ? 0.012 : 0.006);

                    if (target.HP <= 0) {
                        this.pushLog(tf('{0} повержен!', t(target.name)));
                        // Раунд 23: звук падения поверженного
                        if (this.audioManager) this.audioManager.playCombatDeath();
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
        const p = this.player;
        // Раунд 35 (QA-фикс HIGH): кнопка «Трава» смотрела только на флаг
        // q.hasHerb (выдаётся одному архетипу при создании), а целебная трава
        // лежит у КАЖДОГО героя в инвентаре (стартовый предмет «herb»).
        // Теперь трава расходуется из инвентаря; флаг остался запасным
        // источником для совместимости со старыми сохранениями.
        let invSlot = null;
        if (Array.isArray(p.inventory)) {
            invSlot = p.inventory.find(i => i && i.id === 'herb' && (i.count || 0) > 0);
        }
        if (invSlot) {
            invSlot.count -= 1;
            if (invSlot.count <= 0) {
                p.inventory = p.inventory.filter(i => i !== invSlot);
            }
            this.registry.set('player', p);
        } else if (q && q.hasHerb) {
            q.hasHerb = false;
            this.registry.set('quest', q);
        } else {
            this.pushLog(t('У тебя нет целебной травы.'));
            return;
        }
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

                // Раунд 23 (п.5/п.3): свист оружия + анимация атаки врага,
                // после выпада — возврат в стойку лицом к игроку
                if (this.audioManager) this.audioManager.playWeaponSwing();
                this.playEnemyAttackAnim(e);
                this.playLunge(e.sprite, this.playerSprite, () => {
                    this.restoreEnemyIdle(e);
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
                        // Раунд 23 (п.5): звук по исходу — тело / доспех / щит;
                        // при полном попадании герой вздрагивает (knight_hit)
                        if (this.audioManager) {
                            if (absorbed > 0) {
                                if (actualDmg === 0) this.audioManager.playShieldHit();
                                else this.audioManager.playArmorHit();
                            } else {
                                this.audioManager.playSwordHit();
                                if (this.anims.exists('knight_hit') && this.player.HP > 0) {
                                    this.playerSprite.play('knight_hit');
                                    this.time.delayedCall(300, () => {
                                        if (this.playerSprite.active && this.player.HP > 0) this.playerSprite.play('knight_idle');
                                    });
                                }
                            }
                        }
                        this.cameras.main.shake(160, actualDmg > 0 ? 0.009 : 0.005);
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
        // Если это был вор — победа в ПОГОНЕ, но игра продолжается (раунд 21)
        const isThiefFight = this.enemies.some(e => e.isThief) || this.npcId === 'thief';
        // Раунд 45 (п.3): убитый герой ЖИТЕЛЬ (бой из интерьера — npcId «xxx_hostile»)
        const murderVictimId = (!isThiefFight && this.npcId && this.npcId.endsWith('_hostile'))
            ? this.npcId.slice(0, -'_hostile'.length)
            : null;
        let murderInfo = null;
        if (murderVictimId) {
            // Убийство жителя — кровная вина: деревня и все НПЦ −50, родня −100
            murderInfo = applyNpcMurderConsequences(this.registry, murderVictimId);
        }
        // Раунд 46 (п.2 заявки): убийство СТАРОСТЫ — репутация до −100 и
        // немедленный Проигрыш (отдельный финал «⚖ Убийство старосты»)
        const elderMurdered = !!(murderInfo && murderInfo.elderMurdered);
        if (isThiefFight) {
            // Вор повержен в бою — икона в инвентарь, погоня завершена
            recoverStolenItem(this.registry, 'killed', null);
            ActionLog.add(this.registry, `Бой с вором выигран. Вор повержен!`);
        } else if (this.npcId === 'bandit') {
            q.banditDefeated = true;
        }
        if (!isThiefFight) {
            // Раунд 21: боевые процедурные поручения (волк/разбойники) завершаются
            this.completeCombatQuests();
            // Раунд 45 (п.3): после убийства жителя баннер ведёт к вире
            q.currentObjective = murderVictimId
                ? 'Кровная вина на тебе. Староста может помирить за виру.'
                : 'Враг повержен';
        } else {
            q.currentObjective = 'Икона у тебя! Верни её старосте или священнику.';
        }
        this.registry.set('quest', q);
        this.autosave();
        this.busy = true;
        this.pushLog(murderVictimId
            ? tf('{0} убит! Кровная вина пала на тебя...', t(this.enemies[0].name))
            : (isThiefFight ? t('Вор повержен! Икона у тебя!') : t('Враг повержен! Ты одержал победу.')));
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
            // Раунд 46 (п.2): убийство старосты — немедленный Проигрыш
            if (elderMurdered) {
                createDialog(this, t('☠ Кровь старосты!'),
                    tf(t('Ты убил {0} — старосту деревни! Старшина сходки указывает на тебя пальцем: «Убийца судьи — вне закона!» Деревня проклинает тебя: репутация упала до −100.\n\nЛетопись твоего похода окончена — ПРОИГРЫШ.'), murderInfo ? murderInfo.victimName : 'староста'),
                    [{ text: t('Смириться с судьбой'), callback: () => {
                        const q2 = this.registry.get('quest') || {};
                        q2.elderMurdered = true;
                        this.registry.set('quest', q2);
                        this.scene.start('End');
                    } }],
                    { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
                return;
            }
            // Раунд 21: после победы над вором — НЕ конец игры, а возврат в деревню
            // (икону нужно вернуть старосте или священнику; игра продолжается)
            if (isThiefFight) {
                createDialog(this, t('🏆 Вор повержен!'),
                    t('Ты обыскал тело поверженного вора и нашёл чудотворную икону Богородицы — целую и невредимую. Возвращайся в деревню: отдай святыню старосте или батюшке и получи заслуженную награду.'),
                    [{ text: t('В деревню!'), callback: () => this.scene.start('Village') }],
                    { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
            } else if (murderVictimId) {
                // Раунд 45 (п.3): убийство жителя — честное предупреждение о цене крови
                const kinText = murderInfo && murderInfo.kinNames.length > 0
                    ? t('Родня убитого проклинает тебя: их репутация упала до −100.')
                    : '';
                createDialog(this, t('☠ Кровная вина!'),
                    tf(t('Ты убил {0}. Вся деревня в ужасе: репутация в деревне и у всех жителей упала на 50!\n{1}\nТакие грехи смываются только вирой у старосты — если он согласится мирить.'), murderInfo ? murderInfo.victimName : '', kinText ? kinText + '\n' : ''),
                    [{ text: t('В деревню!'), callback: () => this.scene.start('Village') }],
                    { singleton: false, portraitKey: 'portrait_narrator', typing: true, typingSpeed: 25 });
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

    /**
     * Раунд 21: завершить боевые процедурные поручения (волк/разбойники),
     * подходящие по типу врага. Награда выдаётся при разговоре с заказчиком.
     */
    completeCombatQuests() {
        const enemyKeys = this.enemyKeys || [];
        getActiveQuests(this.registry).forEach(quest => {
            if (!quest.combat || quest.completed) return;
            const matched = !quest.enemyKeys || enemyKeys.some(k => quest.enemyKeys.includes(k));
            if (!matched) return;
            const done = checkQuestCompletion(this.registry, quest, { combatWon: true, enemyKey: enemyKeys[0] });
            if (done) {
                ActionLog.add(this.registry, tf(t('Поручение «{0}» выполнено! Загляни к {1} за наградой.'), quest.title, quest.npcName));
            }
        });
    }

    endCombatDefeat() {
        this.busy = true;
        this.pushLog(t('Ты пал в бою...'));
        // Раунд 23 (п.5): звук падения + анимация смерти рыцаря
        if (this.audioManager) this.audioManager.playCombatDeath();
        if (this.anims.exists('knight_death')) {
            this.playerSprite.play('knight_death');
        }
        // Раунд 22 (п.6): смерть в ЛЮБОМ бою — проигрыш игры.
        // Раньше бой с волками/разбойниками просто возвращал в титул.
        loseHeroDead(this.registry);
        ActionLog.add(this.registry, `Бой проигран. Герой пал — поход окончен.`);
        // Затемнение
        this.cameras.main.fade(900, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            this.scene.start('End');
        });
    }
}

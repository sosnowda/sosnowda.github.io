// Пошаговый бой по системе BRP. Игрок и враг по очереди совершают действия.
// Phaser загружен глобально через CDN
import { RUS } from '../config/RusTheme.js';
import { WEAPONS } from '../config/GameConfig.js';
// Раунд 66.28 (пп.1–12): честные надписи атаки (Удар оружием/Удар кулаком/
// Стрельба из лука), СМЕНА ОРУЖИЯ за ход, стрелы и колчан
import { WEAPONS as CR_WEAPONS, equipWeapon } from '../systems/Character.js';
import {
    getQuiver, spendArrow, loadQuiver, countInventoryArrows,
    quiverWord, QUIVER_CAP,
} from '../systems/ammo.js';
import { skillCheck, rollDamage, ROLL_RESULT, applyDamage } from '../systems/BRPEngine.js';
import { spawnEnemy, spawnVillagerEnemy, VILLAGER_COMBAT } from '../data/characters.js';
// 66.44 (приказ 12): кнопки «Трава» и «Исследование» с нижней панели боя
// УДАЛЕНЫ (методы useHerb/examineEnemy сняты вместе с ними); раскрытие
// мастерства оружия после первого удара противника сохранено в enemyTurn.
import { ruSkillName } from '../data/npcStats.js';
import { createButton, createDialog, createFloatingText, registerAnchoredUI, onSceneResize } from '../utils/ui.js';
import AudioManager from '../systems/AudioManager.js';
import SaveManager from '../systems/SaveManager.js';
import { ActionLog } from '../data/actionLog.js';
import { loseHeroDead, recoverStolenItem, thiefFleesFromFight, saveThiefHp, restoreThiefHp, getThiefSpriteKey, getThiefGender } from '../data/thief.js';
// Раунд 45 (пп.3,4): последствия убийства НПЦ и перемирье после побега
import { applyNpcMurderConsequences, setNpcTruce } from '../data/reputation.js';
// 66.32: боевой облик героя из пака «Medieval - Heroes I» (MVsv-листы)
import { battleLookFor } from '../data/heroes.js';
// Раунд 46 (п.1): жители дерутся своими характеристиками
import { findNpc } from '../data/npcNames.js';
import { getActiveQuests, checkQuestCompletion, consumeBlessing } from '../data/questGenerator.js';
import { getTime, getDayNightOverlay, tickTime } from '../systems/TimeSystem.js';
import { applyWeatherVisuals } from '../systems/Weather.js';
// Раунд 66.17 (п.11): с убитого волка — мясо (сырое; готовить на костре или продать)
import { addItem } from '../systems/loot.js';
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

    /**
     * 66.44 (приказ 2): ГРУППА ФОНА БОЯ ПО ЛОКАЦИИ.
     * Бой должен идти на фоне ТОЙ местности, где он случился:
     *   • драка с враждебным жителем — в избе (интерьер);
     *   • вор/волк/разбойник — по fromLocation (из thief.js/LocationScene)
     *   или fromScene (Forest — тёмный лес; Location — тракт-фолбэк).
     * Возвращает ключ группы ('forest'/'field'/'lake'/'river'/'pogost'/'mill'
     * /'apiary'/'road'/'interior') или null — рисовать прежний градиент.
     *
     * 66.46 (приказы 4–5): КОНТРАКТ СУХОСТИ. У водных фонов ('lake'/'river')
     * вода — только в средней дистанции; кромка берега поднимается выше ног
     * всех боевых стоек (герой 320,596 · враги 891..951, 332..588 · волк
     * 921,539). Проверено автотестом генератора (check_dry в
     * tools/make_battle_bg_6646.py) и живыми кадрами qa_6646 — персонажи
     * и NPC не стоят на воде. При риске НОВЫХ водных фонов точки суши
     * обязаны покрываться DRY_POINTS генератора.
     */
    combatBackgroundGroup() {
        if (this.npcId && this.npcId.endsWith('_hostile')) return 'interior';
        const loc = this.fromLocation;
        if (loc) {
            if (['forest', 'forest_edge', 'forest_glade'].includes(loc)) return 'forest';
            if (['field', 'pasture'].includes(loc)) return 'field';
            if (loc === 'lake') return 'lake';
            if (loc === 'river') return 'river';
            if (loc === 'pogost') return 'pogost';
            if (loc === 'mill') return 'mill';
            if (loc === 'apiary') return 'apiary';
            if (['road', 'road_south', 'road_north'].includes(loc)) return 'road';
        }
        if (this.fromScene === 'Forest') return 'forest';
        if (this.fromScene === 'Location') return 'road';
        return null;
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
        // Раунд 48 (п.5): после ПЕРВОГО удара противника герой узнаёт ТОЧНЫЙ
        // параметр навыка применённого в бою оружия (и только его).
        this.weaponSkillRevealed = false;
        // Шаблон боевых параметров жителя — для строки мастерства в enemyTurn
        this.villagerCombatTpl = villagerNpc ? (VILLAGER_COMBAT[villagerNpc.id] || VILLAGER_COMBAT.default) : null;
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
            // Раунд 50 (п.7): фигурка вора в бою — по СЛУЧАЙНОМУ полу (м/ж)
            if (this.enemies[0].spriteKey === 'enemy_thief' && this.textures.exists(getThiefSpriteKey(this.registry))) {
                this.enemies[0].spriteKey = getThiefSpriteKey(this.registry);
                if (this.enemies[0].name === t('Вор-иконокрад') && getThiefSpriteKey(this.registry) === 'enemy_thief_f') {
                    this.enemies[0].name = t('Воровка-иконокрадка');
                }
            }
        }
        this.busy = false;
        this.playerDodging = false;
        this.logLines = [];
        this.barGfx = this.add.graphics().setDepth(50);

        // ----- Фон боевой сцены — ПО ЛОКАЦИИ БОЯ (66.44, приказ 2) -----
        // Раньше — один градиент «поляна на вечернем свету» с восемью ёлками,
        // где бы ни случился бой. Теперь у каждой группы локаций своя живописная
        // сцена (battle_bg_*); градиент с ёлками остаётся фолбэком.
        const bgGroup = this.combatBackgroundGroup();
        const bgKey = bgGroup ? `battle_bg_${bgGroup}` : null;
        if (bgKey && this.textures.exists(bgKey)) {
            const bgImg = this.add.image(0, 0, bgKey).setOrigin(0, 0).setDepth(-2);
            const fitBg = (w, h) => {
                if (bgImg.active) bgImg.setDisplaySize(w, h);
            };
            fitBg(width, height);
            onSceneResize(this, fitBg);
        } else {
            this.bgGfx = this.add.graphics();
            this.drawCombatBackground = (w, h) => {
                this.bgGfx.clear();
                // 66.32/QA: фон заметно светлее прежнего. ПОПУТНО ИСПРАВЛЕН СТАРЫЙ
                // БАГ ВЫЗОВА: fillGradientStyle(c, 1, c2, 1, 0) передавал цвета и
                // альфы вперемешку — 5-й аргумент это alphaTopLeft (=0!), т.е.
                // верх был ПРОЗРАЧНО-ЧЁРНЫМ: сцена всегда была темнее замысла и
                // тёмные облики MVsv (Баэнор — чёрный латник) на ней не читались.
                // Теперь 4 цвета + 4 альфы явно: поляна на вечернем свету.
                this.bgGfx.fillGradientStyle(0x3a2a1a, 0x332416, 0x241811, 0x1c130b, 1, 1, 1, 1);
                this.bgGfx.fillRect(0, 0, w, h);
            };
            this.drawCombatBackground(width, height);
            onSceneResize(this, (w, h) => this.drawCombatBackground(w, h));

            // Деревья на фоне (декоративные) — раунд 66 (п.10): новые спрайты
            // (только на градиентном фолбэке — у живописных фонов деревья уже нарисованы)
            for (let i = 0; i < 8; i++) {
                const x = (i + 0.5) * (width / 8) + (Math.random() - 0.5) * 40;
                const y = 60 + Math.random() * 30;
                const cbTex = (i % 3 === 0)
                    ? `deco_pine_${i % 2}`
                    : `deco_tree_${i % 5}`;
                const tree = this.textures.exists(cbTex)
                    ? this.add.image(x, y, cbTex).setScale(1.4).setAlpha(0.55)
                    : this.add.image(x, y, `tile_forest_${i % 2}`).setScale(2.5).setAlpha(0.4);
                tree.setOrigin(0.5, 0.9);
                tree.setDepth(0);
            }
        }

        // ----- Игрок -----
        // 66.32: боевой облик из пака «Medieval - Heroes I» (MVsv-листы 96×96).
        // 66.43 (приказ 4): ПЕРЕСМОТР ВЕРДИКТА QA-6632 — живая сверка всех 8
        // idle-листов пака показала: фигуры отрисованы ПРОФИЛЕМ ВЛЕВО (копья/
        // клинки/взгляды направлены влево), герой слева стоял СПИНОЙ к врагу
        // справа. Включаем флипX — герой ЛИЦОМ к врагу (рыцарь-fallback и так
        // смотрит вправо — его не трогаем). Ноги на нижнем крае кадра:
        // origin.y = 1/6 при scale 2.5 даёт ту же линию ног, что у рыцаря
        // (низ кадра в y + 100); подпись имени (y + 100) остаётся у ног.
        // 66.39: альт боевого облика (выбор в превью персонажа, hero.battleLookKey)
        // — только если его листы на месте; иначе каноничный облик по архетипу+полу.
        const canonicalLook = battleLookFor(this.player.archetype, this.player.gender);
        this.battleLook = (this.player.battleLookKey
            && this.textures.exists(`battle_${this.player.battleLookKey}_idle`)
            && this.anims.exists(`battle_${this.player.battleLookKey}_idle`))
            ? this.player.battleLookKey : canonicalLook;
        const lookIdle = `battle_${this.battleLook}_idle`;
        this.usesBattleLook = this.textures.exists(lookIdle) && this.anims.exists(lookIdle);
        if (this.usesBattleLook) {
            this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, lookIdle, 0);
            this.playerSprite.setScale(2.5).setOrigin(0.5, 1 / 6);
            this.playerSprite.play(lookIdle);
            // 66.43 (приказ 4): фигуры пака смотрят влево — разворачиваем к врагу
            this.playerSprite.setFlipX(true);
        } else {
            this.battleLook = null;
            this.playerSprite = this.add.sprite(width * 0.25, height * 0.55, 'knight_idle', 0);
            this.playerSprite.setScale(2.5);
            this.playerSprite.play('knight_idle');
        }
        // Раунд 23 (п.3): бойцы стоят ЛИЦОМ К ЛИЦУ. Рыцарь смотрит вправо как
        // есть; MVsv-облики с 66.43 флипаются (см. выше), враги справа смотрят
        // влево. Лёгкое покачивание
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
            // 66.43 (приказ 7): НОВАЯ МОДЕЛЬ ВОРА В БОЮ — боковые боевые листы
            // battle_thiefm/thieff в формате листов героев (пак MVsv), фигура
            // ПРОФИЛЕМ ВЛЕВО — на игрока. Вор стоит на ОДНОЙ ЛИНИИ НОГ с героем
            // (origin 1/6, y = 0.55h), а не парит выше, как прежний топ-даун
            // спрайт погони 4×4@64. Листы нет — откат на прежние ветки ниже.
            const thiefLook = (e.spriteKey === 'enemy_thief_m') ? 'thiefm'
                : (e.spriteKey === 'enemy_thief_f') ? 'thieff' : null;
            if (thiefLook && this.textures.exists(`battle_${thiefLook}_idle`)
                && this.anims.exists(`battle_${thiefLook}_idle`)) {
                const groundY = height * 0.55;
                sp = this.add.sprite(x, groundY, `battle_${thiefLook}_idle`, 1)
                    .setScale(2.5).setOrigin(0.5, 1 / 6);
                sp.play(`battle_${thiefLook}_idle`);
                e.battleLookKey = thiefLook;   // атаки/стойка — см. playEnemyAttackAnim
            } else if (e.spriteKey === 'enemy_wolf' && this.anims.exists('wolf_side_idle')) {
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
            // Покачивание врага (66.43: от ФАКТИЧЕСКОЙ y спрайта — у вора на
            // боевых листах она иная, чем расчётная y веток выше)
            this.tweens.add({
                targets: sp,
                y: { from: sp.y, to: sp.y - 4 },
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: i * 200,
            });
            const nm = this.add.text(sp.x, sp.y + 90, t(e.name), {
                fontSize: '15px', color: '#ffb3a0',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
            this.enemySprites.push({ sprite: sp, combatant: e, label: nm, baseY: sp.y, isWolf });
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
        // Раунд 66.28 (п.7): строка снаряжения в бою — что в руках и сколько
        // стрел в колчане (обновляется после каждого выстрела/смены оружия)
        this.gearStatusText = this.add.text(width / 2, height - 10, '', {
            fontSize: '11px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5, 1).setDepth(60);
        this.updateGearStatus();
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
                t('⚔ Бой пошаговый (BRP d100): атака, уклон, побег.\nПроверки навыков бросают d100: успех — в пределах навыка,\nкрит — 1/20 навыка (урон ×1.5), особый успех — 1/5 (урон ×2).\n🛡 Доспех поглощает урон каждого попадания.\nПосле первого удара противника видно мастерство его оружия.\n🏹 Стрельба из лука тратит стрелу из колчана (вместимость 10);\nпустой колчан — выстрела не будет, стрелы носят пачками по 10.\n🎒 Смена оружия в руках — один ход; наложение стрел в колчан — тоже.'),
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

    /**
     * Раунд 66.28 (пп.1–4): ЧЕСТНЫЕ НАДПИСИ АТАКИ ПО ОРУЖИЮ В РУКАХ.
     *  • лук в руках     — кнопка «Стрельба из лука» (п.2, прежняя «Лук»);
     *  • иное оружие     — кнопка «Удар оружием» (п.1);
     *  • оружия нет      — кнопка «Удар кулаком» (п.3);
     *  • внизу всегда есть «Смена оружия» (п.4): открывает инвентарь,
     *    смена оружия в руках тратит ОДИН ХОД.
     */
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

        // Раунд 14: основная кнопка = реально экипированное оружие.
        // Раунд 66.28: надпись теперь зависит ОТ ВИДА ОРУЖИЯ В РУКАХ:
        // «Стрельба из лука» / «Удар оружием» / «Удар кулаком».
        const equipped = this.player.weapon || WEAPONS.fists;
        const equippedKey = equipped.id || 'fists';
        const isBow = equippedKey === 'bow';
        const isFists = equippedKey === 'fists';
        const mainLabel = isBow
            ? `🏹 ${t('Стрельба из лука')}`
            : (isFists ? `🤜 ${t('Удар кулаком')}` : `⚔ ${t('Удар оружием')}`);
        const acts = [
            { label: mainLabel, cb: () => this.playerAttack(equippedKey),
              bg: RUS.accent, hover: RUS.accentLight },
        ];
        if (!isFists) {
            acts.push({ label: `🤜 ${t('Удар кулаком')}`, cb: () => this.playerAttack('fists'),
              bg: 0x6a5a40, hover: 0x7a6a50 });
        }
        acts.push(
            { label: t('Уклон'), cb: () => this.dodge(), bg: 0x4a6a4a, hover: 0x5a7a5a },
            // 66.44 (приказ 12): кнопки «Трава» и «Исследование» сняты с панели —
            // осталось: атака, уклон, смена оружия, побег.
            // Раунд 66.28 (п.4): смена оружия за ход — инвентарь прямо в бою
            { label: t('🎒 Смена оружия'), cb: () => this.openWeaponSwapPanel(), bg: 0x5a4a2a, hover: 0x6a5a3a },
            { label: t('🏃 Бежать'), cb: () => this.flee(), bg: 0x2a2a5a, hover: 0x3a3a6a },
        );
        // Равномерная раскладка по центру; на узких экранах (телефон)
        // кнопки переносятся на ВТОРОЙ РЯД, чтобы не уходили за край.
        const gap = 160;
        const perRow = Math.max(2, Math.min(acts.length, Math.floor((width - 24) / gap)));
        const rows = Math.ceil(acts.length / perRow);
        acts.forEach((a, i) => {
            const row = Math.floor(i / perRow);            // 0 — НИЖНИЙ ряд
            const inRow = i % perRow;
            const rowCount = Math.min(perRow, acts.length - row * perRow);
            const x = width / 2 - (gap * (rowCount - 1)) / 2 + inRow * gap;
            const y = height - 50 - row * 52;
            mk(x, y, a.label, a.cb, a.bg, a.hover);
        });
    }

    /** Раунд 66.28 (п.7): строка «что в руках · сколько стрел в колчане». */
    updateGearStatus() {
        if (!this.gearStatusText || !this.gearStatusText.active) return;
        const w = this.player.weapon || WEAPONS.fists;
        const q = getQuiver(this.player);
        const parts = [`${t('В руках')}: ${t(w.name)} (${w.dice.min}-${w.dice.max}${w.bonus ? `+${w.bonus}` : ''})`];
        parts.push(`🪶 ${t('Колчан')}: ${q}/${QUIVER_CAP}`);
        this.gearStatusText.setText(parts.join('   ·   '));
    }

    /**
     * Раунд 66.28 (п.4): ПАНЕЛЬ «СМЕНА ОРУЖИЯ» — инвентарь персонажа
     * прямо в бою. Выбор оружия из узла (или кулаков) ЭКИПИРУЕТ его
     * и тратит ОДИН ХОД (противник отвечает). Наложение стрел в колчан —
     * тоже действие за ход. Закрытие панели — бесплатно.
     */
    openWeaponSwapPanel() {
        if (this.busyDialog) return;
        this.busyDialog = true;
        const p = this.player;
        const { width, height } = this.scale;
        const panelW = Math.min(540, width - 16);
        const panelH = Math.min(430, height - 40);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75)
            .setOrigin(0).setInteractive().setDepth(200);
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);
        const widgets = [overlay, panel];
        const closePanel = () => {
            widgets.forEach(w => { try { w.destroy(); } catch (e) { /* ок */ } });
            this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
            this.busyDialog = false;
        };

        this.add.text(width / 2, height / 2 - panelH / 2 + 26, t('🎒 Смена оружия'), {
            fontSize: '20px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);
        this.add.text(width / 2, height / 2 - panelH / 2 + 52,
            t('Смена оружия в руках — один ход. Противник ответит.'), {
            fontSize: '12px', color: RUS.textDim,
        }).setOrigin(0.5).setDepth(202);

        const startY = height / 2 - panelH / 2 + 84;
        const step = 40;
        // Оружие: кулаки + всё, что лежит в узле
        const list = [CR_WEAPONS.fists].concat(
            Object.values(CR_WEAPONS).filter(w => w.id !== 'fists'
                && (p.inventory || []).some(it => it && it.id === w.id)));
        list.forEach((w, i) => {
            const isEquipped = p.weaponId === w.id;
            const label = `${isEquipped ? '✓ ' : '   '}${t(w.name)} (${w.dice.min}-${w.dice.max}+${w.bonus || 0})`;
            createButton(this, width / 2, startY + i * step, label, () => {
                if (isEquipped) { closePanel(); return; } // то же оружие — ход не тратим
                equipWeapon(p, w.id);
                this.registry.set('player', p);
                this.pushLog(tf(t('Ты сменил оружие в руках: теперь {0}. Потрачен ход!'), t(w.name)));
                ActionLog.add(this.registry, tf(t('Сменил оружие в бою: {0} (потрачен ход).'), t(w.name)));
                this.updateGearStatus();
                closePanel();
                this.busy = true;
                this.time.delayedCall(600, () => this.enemyTurn());
            }, {
                backgroundColor: isEquipped ? 0x3a5a3a : 0x4a3520,
                hoverColor: isEquipped ? 0x4a6a4a : 0x5a4530,
                textColor: RUS.text, fontSize: 14,
                padding: { left: 12, right: 12, top: 6, bottom: 6 },
            }).setDepth(202);
        });

        // Колчан: наложить стрелы из узла (тоже ход)
        const q = getQuiver(p);
        const inv = countInventoryArrows(p);
        const ammoY = startY + list.length * step + 8;
        this.add.text(width / 2, ammoY, `🪶 ${t('Колчан')}: ${q}/${QUIVER_CAP} (${quiverWord(q)})   ·   ${t('В узле')}: ${inv}`, {
            fontSize: '13px', color: '#c9a14a', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(202);
        if (inv > 0 && q < QUIVER_CAP) {
            createButton(this, width / 2, ammoY + 34, t('🪶 Наложить стрелы в колчан (ход)'), () => {
                const moved = loadQuiver(p);
                this.registry.set('player', p);
                this.pushLog(tf(t('Ты наложил стрелы в колчан: {0}. Потрачен ход!'), moved));
                ActionLog.add(this.registry, tf(t('Наложил стрелы в колчан в бою: +{0} (потрачен ход).'), moved));
                this.updateGearStatus();
                closePanel();
                this.busy = true;
                this.time.delayedCall(600, () => this.enemyTurn());
            }, {
                backgroundColor: 0x4a5a3a, hoverColor: 0x5a6a4a,
                textColor: RUS.text, fontSize: 13,
                padding: { left: 12, right: 12, top: 6, bottom: 6 },
            }).setDepth(202);
        }

        createButton(this, width / 2, height / 2 + panelH / 2 - 28, t('Готово (без хода)'), closePanel, {
            backgroundColor: 0x8B2C1A, hoverColor: 0xB53925, textColor: RUS.text,
            fontSize: 14, padding: { left: 18, right: 18, top: 7, bottom: 7 },
        }).setDepth(202);
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
            // Раунд 32 (пп.11,12,13) + раунд 59 (п.5 владельца): после побега
            // игрока из боя с вором:
            //  п.11 — вор НЕ лечится (сохраняем его текущий HP);
            //  п.13+р59 — игрока переносит в деревню (выход из локации), и
            //         ровно ЧЕРЕЗ 1 ЧАС вор уходит в другую локацию со следами;
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
                ActionLog.add(this.registry, tf(t('Побег из боя с разгневанным жителем (бросок {0}, успех). Он не нападёт снова сразу — перемирье на 12 часов.'), res.roll));
            } else {
                ActionLog.add(this.registry, tf(t('Побег из боя. Потеряно 2 действия (бросок {0}, успех).'), res.roll));
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
            ActionLog.add(this.registry, tf(t('Неудачный побег из боя. Потеряно 1 действие (бросок {0}, провал).'), res.roll));
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
            // 66.43: у вора на боевых листах — честный ВЫПАД кинжалом
            if (rec.combatant.battleLookKey && this.anims.exists(`battle_${rec.combatant.battleLookKey}_attack1`)) {
                sp.play(`battle_${rec.combatant.battleLookKey}_attack1`);
            } else if (this.anims.exists(`${key}_walk_left`)) sp.play(`${key}_walk_left`);
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
            // 66.43: возврат вора в новую боковую стойку
            if (rec.combatant.battleLookKey && this.anims.exists(`battle_${rec.combatant.battleLookKey}_idle`)) {
                rec.sprite.play(`battle_${rec.combatant.battleLookKey}_idle`);
            } else if (this.anims.exists(`${key}_idle_left`)) rec.sprite.play(`${key}_idle_left`);
        }
    }

    playerAttack(weaponKey) {
        // Раунд 14: используем оружие ВЫБРАННОЙ кнопки (а не всегда экипировку).
        // Кулаки — честный резерв с навыком brawl; экипировка передаётся своей кнопкой.
        const w = WEAPONS[weaponKey] || this.player.weapon || WEAPONS.fists;
        const target = this.firstAlive();
        if (!target) { this.endCombatVictory(); return; }

        const targetSprite = this.enemySprites.find(x => x.combatant === target).sprite;

        // Раунд 66.28 (пп.7,8): СТРЕЛЬБА ИЗ ЛУКА требует стрелы В КОЛЧАНЕ.
        // Пустой колчан — поп-ап предупреждение, ход НЕ тратится (выстрела не было).
        if (weaponKey === 'bow') {
            if (!spendArrow(this.player)) {
                this.registry.set('player', this.player);
                this.pushLog(t('В колчане нет стрел — стрелять нечем!'));
                createDialog(this, '🪶 ' + t('Колчан пуст!'),
                    t('Стрел в колчане нет — стрелять нечем. Пачку стрел (10 шт.) продают кузнец Данила и ремесленник Аверьян. Стрелы из узла можно наложить в колчан через «Смена оружия».'),
                    [
                        { text: t('🎒 Смена оружия'), callback: () => this.openWeaponSwapPanel() },
                        { text: t('Понятно'), callback: () => {} },
                    ],
                    { singleton: false });
                return;
            }
            this.registry.set('player', this.player);
            this.updateGearStatus();
        }

        // Раунд 22 (п.11): благословение батюшки усиливает ОДНУ проверку навыка
        const skill = consumeBlessing(this.registry, this.player.skills[w.skill] || 20);
        const res = skillCheck(skill);

        if (weaponKey === 'bow') {
            // Раунд 66.28 (п.2): стрельба — стрела летит от героя к врагу,
            // без выпада (дистанционная атака). Стрела потрачена выше.
            if (this.audioManager) this.audioManager.playShoot();
            // 66.32: анимация стрельбы боевым обликом (у paul полосы нет —
            // выстрел без анимации тела, как у рыцаря раньше)
            this.playPlayerShoot();
            this.playBowShot(this.playerSprite, targetSprite,
                () => this.resolvePlayerAttack(w, res, target, targetSprite));
            return;
        }

        // 66.32: анимация атаки боевым обликом (кулаки — fists-полоса),
        // fallback — рыцарь (случайно из 3 вариантов)
        const chosen = this.pickAttackAnim(weaponKey);
        if (chosen && this.anims.exists(chosen)) {
            this.playerSprite.play(chosen);
            // По завершении — возвращаемся в idle. ВАЖНО: обработчик срабатывает
            // на ЛЮБУЮ завершившуюся анимацию спрайта — фильтруем по ключу,
            // иначе он гасит и победную анимацию (66.32, QA-прогон).
            this.playerSprite.once('animationcomplete', (an) => {
                if (an && an.key && an.key !== chosen) return;
                if (this.playerSprite.active && this.player.HP > 0) this.playPlayerIdle();
            });
        }

        // Раунд 23 (п.5): свист оружия в начале выпада
        if (this.audioManager) this.audioManager.playWeaponSwing();
        // Анимация подхода игрока
        this.playLunge(this.playerSprite, targetSprite, () => {
            this.resolvePlayerAttack(w, res, target, targetSprite);
        });
    }

    /**
     * 66.32: полёт стрелы от героя к врагу (тонкая палочка,
     * как в охоте ForestScene), затем разрешение атаки.
     */
    playBowShot(fromSprite, toSprite, onDone) {
        const dx = toSprite.x - fromSprite.x, dy = toSprite.y - fromSprite.y;
        const arrow = this.add.rectangle(fromSprite.x + 24, fromSprite.y - 10, 26, 2, 0xd8c8a0)
            .setRotation(Math.atan2(dy, dx)).setDepth(45);
        this.tweens.add({
            targets: arrow,
            x: toSprite.x, y: toSprite.y,
            duration: 220, ease: 'Quad.easeOut',
            onComplete: () => {
                arrow.destroy();
                if (onDone) onDone();
            },
        });
    }

    /**
     * 66.32: вернуть спрайт героя в idle (боевой облик или рыцарь).
     */
    playPlayerIdle() {
        const k = (this.usesBattleLook && this.anims.exists(`battle_${this.battleLook}_idle`))
            ? `battle_${this.battleLook}_idle`
            : 'knight_idle';
        if (this.playerSprite && this.playerSprite.active) this.playerSprite.play(k);
    }

    /**
     * 66.32: подобрать анимацию атаки: кулаки — fists-полоса облика,
     * оружие — attack1/attack2 облика; fallback — рыцарь.
     */
    pickAttackAnim(weaponKey) {
        if (this.usesBattleLook) {
            const a = (weaponKey === 'fists') ? 'fists'
                : (Math.random() < 0.5 ? 'attack1' : 'attack2');
            const k = `battle_${this.battleLook}_${a}`;
            if (this.anims.exists(k)) return k;
        }
        const pool = ['knight_attack1', 'knight_attack2', 'knight_attack_cmb'];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * 66.32: анимация стрельбы боевым обликом (если есть полоса shoot;
     * у paul её нет в паке — выстрел без анимации тела).
     */
    playPlayerShoot() {
        if (!this.usesBattleLook) return;
        const k = `battle_${this.battleLook}_shoot`;
        if (!this.anims.exists(k)) return;
        this.playerSprite.play(k);
        this.playerSprite.once('animationcomplete', (an) => {
            if (an && an.key && an.key !== k) return;
            if (this.playerSprite.active && this.player.HP > 0) this.playPlayerIdle();
        });
    }

    /**
     * Разрешение атаки игрока (выделено из playerAttack раундом 66.28:
     * общий код ближнего удара и выстрела из лука).
     */
    resolvePlayerAttack(w, res, target, targetSprite) {
        {
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
                        // Патч 66.18 (QA-66.17): род глагола — по имени врага
                        // («Воровка-иконокрадка повержена!», «Женщина повержена!»)
                        const _dn = t(target.name);
                        const _fem = /а$|я$/.test(_dn);
                        this.pushLog(tf(_fem ? '{0} повержена!' : '{0} повержен!', _dn));
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
        }
    }

    dodge() {
        this.playerDodging = true;
        this.pushLog(t('Ты занимаешь оборонительную стойку, готовясь уклониться.'));
        this.busy = true;
        this.time.delayedCall(500, () => this.enemyTurn());
    }

    /** Ход противника: атаки всех живых врагов, затем — ход игрока. */
    enemyTurn() {
        this.playerDodging = false;
        const alive = this.enemySprites.filter(e => e.combatant.HP > 0);
        if (alive.length === 0) { this.endCombatVictory(); return; }

        alive.forEach((e, idx) => {
            this.time.delayedCall(idx * 800 + 200, () => {
                if (this.player.HP <= 0) return;
                const en = e.combatant;
                const res = skillCheck(en.attackSkill);

                // Раунд 48 (п.5 заявки): после ПЕРВОГО удара противника герой
                // узнаёт ТОЧНЫЙ параметр навыка применённого в бою оружия —
                // и только его (остальные параметры — только через «Исследование»).
                if (!this.weaponSkillRevealed) {
                    this.weaponSkillRevealed = true;
                    const skillKey = this.villagerCombatTpl ? this.villagerCombatTpl.weaponSkill : null;
                    const skillLabel = skillKey ? ruSkillName(skillKey) : t(en.weapon.name);
                    this.pushLog(tf('⚔ Первый удар открыл мастерство противника: {0} — {1}.', skillLabel, en.attackSkill));
                }

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
                                if (!this.usesBattleLook && this.anims.exists('knight_hit') && this.player.HP > 0) {
                                    // 66.32: у боевого облика вздрагивание даёт красная
                                    // заливка выше; кадр «hit» — только рыцарю
                                    this.playerSprite.play('knight_hit');
                                    this.time.delayedCall(300, () => {
                                        if (this.playerSprite.active && this.player.HP > 0) this.playPlayerIdle();
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
        // 66.32: победная анимация боевого облика (последний кадр остаётся)
        if (this.usesBattleLook) {
            const vic = `battle_${this.battleLook}_victory`;
            if (this.anims.exists(vic)) this.playerSprite.play(vic);
        }
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
            // Патч 66.18 (QA-66.17): согласование рода (вор/воровка)
            const _thiefFem = getThiefGender(this.registry) === 'female';
            recoverStolenItem(this.registry, 'killed', null);
            ActionLog.add(this.registry, _thiefFem
                ? t('Бой с воровкой выигран. Воровка повержена!')
                : t('Бой с вором выигран. Вор повержен!'));
        } else if (this.npcId === 'bandit') {
            q.banditDefeated = true;
        }
        if (!isThiefFight) {
            // Раунд 21: боевые процедурные поручения (волк/разбойники) завершаются
            this.completeCombatQuests();
            // Раунд 45 (п.3): после убийства жителя баннер ведёт к вире
            q.currentObjective = murderVictimId
                ? t('Кровная вина на тебе. Староста может помирить за виру.')
                : t('Враг повержен');
            // РАУНД 66.17 (п.11): с убитого волка случайно снимают мясо —
            // объём ПО РАЗМЕРУ ЗВЕРЯ (раунд 66.28, п.13: чем крупнее дичь — тем
            // больше мяса; лестница: заяц 1–2 < глухарь 2–3 < косуля 4–6 <
            // < ВОЛК 5–9 — самый крупный зверь в боях); сырое: готовить или продавать
            if (this.enemyKeys && this.enemyKeys.includes('wolf')) {
                const meatN = Phaser.Math.Between(5, 9);
                addItem(this.player, 'meat_raw', meatN);
                ActionLog.add(this.registry, tf(t('Обобрал тушу убитого волка: +{0} сырое мясо (приготовить на костре или продать).'), meatN));
            }
        } else {
            q.currentObjective = t('Икона у тебя! Верни её старосте или священнику.');
        }
        this.registry.set('quest', q);
        this.autosave();
        this.busy = true;
        this.pushLog(murderVictimId
            ? tf('{0} убит! Кровная вина пала на тебя...', t(this.enemies[0].name))
            : (isThiefFight
                ? (getThiefGender(this.registry) === 'female'
                    ? t('Воровка повержена! Икона у тебя!')
                    : t('Вор повержен! Икона у тебя!'))
                : t('Враг повержен! Ты одержал победу.')));
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
                // Патч 66.18 (QA-66.17): заголовок и текст — по роду вора
                const _femWin = getThiefGender(this.registry) === 'female';
                createDialog(this,
                    _femWin ? t('🏆 Воровка повержена!') : t('🏆 Вор повержен!'),
                    _femWin
                        ? t('Ты обыскал тело поверженной воровки и нашёл чудотворную икону Богородицы — целую и невредимую. Возвращайся в деревню: отдай святыню старосте или батюшке и получи заслуженную награду.')
                        : t('Ты обыскал тело поверженного вора и нашёл чудотворную икону Богородицы — целую и невредимую. Возвращайся в деревню: отдай святыню старосте или батюшке и получи заслуженную награду.'),
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
                ActionLog.add(this.registry, tf(t('Поручение «{0}» выполнено! {1} ждёт тебя с наградой.'), quest.title, quest.npcName));
            }
        });
    }

    endCombatDefeat() {
        this.busy = true;
        this.pushLog(t('Ты пал в бою...'));
        // Раунд 23 (п.5): звук падения + анимация смерти рыцаря
        if (this.audioManager) this.audioManager.playCombatDeath();
        // 66.32: смерть боевым обликом (падение → лежит), fallback — рыцарь
        const lookDeath = this.usesBattleLook ? `battle_${this.battleLook}_death` : null;
        if (lookDeath && this.anims.exists(lookDeath)) {
            this.playerSprite.play(lookDeath);
        } else if (this.anims.exists('knight_death')) {
            this.playerSprite.play('knight_death');
        }
        // Раунд 22 (п.6): смерть в ЛЮБОМ бою — проигрыш игры.
        // Раньше бой с волками/разбойниками просто возвращал в титул.
        loseHeroDead(this.registry);
        ActionLog.add(this.registry, t('Бой проигран. Герой пал — поход окончен.'));
        // Затемнение
        this.cameras.main.fade(900, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            this.scene.start('End');
        });
    }
}

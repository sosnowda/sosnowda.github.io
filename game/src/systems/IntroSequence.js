// ПАТЧ 66.84 (приказы владельца 1–4, 10): НОВЫЙ СТАРТ ИГРЫ.
//
// После выбора персонажа, на экране локации «Деревня», идёт НАЧАЛЬНАЯ
// СЦЕНА ЗНАКОМСТВА:
//   1) БОЛЬШОЕ ПОП-АП ОКНО — приветствие старосты: игрок для деревни —
//      новый гость, пришедший издалека и думающий прижиться и остаться
//      жить (п.1 приказа);
//   2) игрок появляется В ДЕРЕВНЕ ОКОЛО ДОМА СТАРОСТЫ, а сам староста
//      СТОИТ РЯДОМ (не гуляет, пока идёт знакомство) (п.2);
//   3) после начального диалога игрока со старостой СТРАЖНИК... нет —
//      К ДЕРЕВЕНСКОМУ СВЯЩЕННИКУ: он ПРИБЕГАЕТ К СТАРОСТЕ (видимый
//      перебег от церковных дверей) и открывается ЕГО ДИАЛОГ — рассказ
//      о том, что НОЧЬЮ КТО-ТО УКРАЛ ИКОНУ ИЗ ДЕРЕВЕНСКОГО ХРАМА (п.3);
//   4) в диалоге священника со старостой игрок МОЖЕТ ВКЛИНИТЬСЯ
//      С ВОПРОСАМИ (узлы-вопросы возвращают к разговору), ПРОЛИСТАТЬ
//      его (задать все вопросы подряд) или ЗАКРЫТЬ. ПОСЛЕ ЗАКРЫТИЯ
//      игроку АВТОМАТИЧЕСКИ выдаётся СТАРТОВОЕ ЗАДАНИЕ «Найди и поймай
//      вора!» (initThiefHunt переносится сюда из сцены выбора героя) (п.4).
//
// Состояние интро живёт в quest.introStage:
//   undefined → 'welcome' → 'talk' → 'priest' → 'done'
// Стадии переживают рестарт сцены Village (игрок может успеть выйти
// за ворота между окнами) — при возврате в деревню сцена продолжает
// прерванную стадию. Сейвов в игре нет (SaveManager — заглушка), поэтому
// других состояний не требуется.
//
// Пока интро не закончено (introStage !== 'done'):
//   - игрок спавнится у дома старосты (INTRO_PLAYER_START, а не
//     PLAYER_START);
//   - староста СТОИТ у дороги перед своим домом (VillageScene.
//     rebuildStreetNpcs ставит его на место, без блуждания);
//   - туториал (подсказки управления) не запускается — его запустит
//     finishIntro() после выдачи стартового задания.
//
// Все строки — через t()/tf() (английская локализация в i18n.js,
// блок «Патч 66.84»); диалоги старосты и священника — деревья
// 'elder_intro' и 'priest_intro' в data/dialogue.js (EN — в node.en).

import { t, tf } from './i18n.js';
import { createDialog } from '../utils/ui.js';
import { getVillageName } from '../data/world.js';
import { initThiefHunt } from '../data/thief.js';
import { getNpcDisplayName, getNpcShortName, findNpc, meetNpc } from '../data/npcNames.js';
import { getNpcSpriteKey } from './NpcLpc.js';
import { pauseWorldClock, resumeWorldClock } from './WorldClock.js';
import { ActionLog } from '../data/actionLog.js';

// Точка появления игрока на время интро: средняя улица (ряд 9), прямо
// перед дверью дома старосты (дом: колонки 13–16, ряды 6–8, дверь (15,8)).
export const INTRO_PLAYER_START = { col: 15, row: 9 };
// Где СТОИТ староста во время знакомства (в тайлах, формат streetSpotFor):
// чуть западнее игрока, на той же средней улице.
export const INTRO_ELDER_SPOT = { x: 14.5, y: 9.4 };
// Откуда ПРИБЕГАЕТ священник (церковные двери: церковь 9–11, ряды 6–8,
// дверь (10,8), от неё на улицу (10,9)) и куда приходит.
export const INTRO_PRIEST_FROM = { x: 10.5, y: 9.4 };
export const INTRO_PRIEST_TO = { x: 12.6, y: 9.4 };

/** Интро ещё не проиграно в этой партии (в т.ч. прервано рестартом сцены)? */
export function isIntroActive(registry) {
    const q = registry && registry.get ? registry.get('quest') : null;
    return !!q && q.introStage !== 'done';
}

export class IntroSequence {
    constructor(scene) {
        this.scene = scene;
        this._priestSpr = null;
        this._priestLabel = null;
    }

    /** Запустить/продолжить сцену знакомства (вызов из VillageScene.create). */
    maybeStart() {
        const scene = this.scene;
        const q = scene.registry.get('quest');
        if (!q) return;
        if (q.introStage === 'done') return;
        if (!q.introStage) q.introStage = 'welcome';

        // Староста и священник — публичные фигуры деревни: игрок знакомится
        // с ними в интро (имена известны сразу, не «старик староста»).
        meetNpc(scene.registry, 'elder');
        meetNpc(scene.registry, 'priest');

        // Мировые часы на время знакомства стоят (вложенный счётчик
        // pauseWorldClock переживает паузу диалогов внутри).
        pauseWorldClock(scene.registry);
        scene.busyDialog = true;

        // Кадр сцены должен дорисоваться (спрайты/камера) — первый шаг на след. тике.
        scene.time.delayedCall(350, () => this._stage(q.introStage));
    }

    _stage(stage) {
        switch (stage) {
            case 'welcome': this._showWelcome(); break;
            case 'talk': this._showElderTalk(); break;
            case 'priest': this._showPriestScene(); break;
            default: this.finishIntro();
        }
    }

    _elderName() {
        // Короткое имя (Мирослав) через t() — в EN даёт транслитерацию Miroslav;
        // слово «староста» уже есть в шаблоне заголовка поп-апа.
        const n = getNpcShortName(this.scene.registry, 'elder');
        return t(n) || t('Староста Мирослав');
    }

    _village() {
        return t(getVillageName());
    }

    // --- 1) БОЛЬШОЕ ПОП-АП ОКНО: приветствие старосты (п.1 приказа) ---
    _showWelcome() {
        const scene = this.scene;
        const q = scene.registry.get('quest') || {};
        q.introStage = 'welcome';
        scene.registry.set('quest', q);

        // Короткий заголовок (длинный наезжал на текст реплики); имя деревни
        // и так названо в самой реплике и в HUD (правый верхний угол).
        const title = tf(t('👋 Староста {0}'), this._elderName());
        // createDialog не подставляет {address} (это умеет только DialogueRunner) —
        // половую форму обращения ставим сами.
        const player = this.scene.registry.get('player');
        const address = (player && player.gender === 'female') ? t('путница') : t('путник');
        const text =
            tf(t('Здравствуй, {0}! Я слышал, ты пришёл издалека, из земель, разорённых лихими людьми.'), address) + '\n\n' +
            t('Деревня наша мала, но жива: пашня, лес да река кормят. Чужаков мы не гоним — поди, зима всех ровняет. Говоришь, думаешь прижиться и остаться жить? Что ж, у нас всякий трудный работник нужен.\n\nТолько знай: у нас живут правдом по старине. Своих знаем, чужих примечаем. Делай добро — и тебя примут как своего. А сделаешь лихое — вся деревня узнает к вечеру.') + '\n\n' +
            tf(t('Деревня {0} рада тебе! Идём, поговорим.'), this._village());

        // БОЛЬШОЕ окно: с портретом (1120px против 880). Без печатной машинки —
        // приветствие-кат-сцена читается целиком сразу.
        createDialog(scene, title, text, [
            {
                text: t('🗣 Выслушать старосту'),
                callback: () => this._stage('talk'),
            },
        ], {
            singleton: false,
            portraitKey: 'portrait_elder',
            typing: false,
            pauseClock: false, // паузу ведёт интро целиком
        });
    }

    // --- 2) НАЧАЛЬНЫЙ ДИАЛОГ ИГРОКА СО СТАРОСТОЙ (староста стоит рядом) ---
    _showElderTalk() {
        const scene = this.scene;
        const q = scene.registry.get('quest') || {};
        q.introStage = 'talk';
        scene.registry.set('quest', q);
        ActionLog.add(scene.registry, tf(t('Староста {0} приветствовал пришлого гостя у своего дома.'), this._elderName()));

        scene.activeNpc = {
            id: 'elder',
            name: this._elderName(),
            portrait: 'portrait_elder',
        };
        scene.dialogue.run('elder_intro', () => {
            // Диалог закрыт — к деревне бежит священник (п.3)
            this._stage('priest');
        });
    }

    // --- 3) СВЯЩЕННИК ПРИБЕГАЕТ К СТАРОСТЕ И РАССКАЗЫВАЕТ ПРО КРАЖУ ИКОНЫ ---
    _showPriestScene() {
        const scene = this.scene;
        const q = scene.registry.get('quest') || {};
        q.introStage = 'priest';
        scene.registry.set('quest', q);

        const ts = scene.tileSize;
        const from = INTRO_PRIEST_FROM;
        const to = INTRO_PRIEST_TO;

        const priestName = getNpcDisplayName(scene.registry, 'priest') || t('Отец Савватий');
        const spriteKey = getNpcSpriteKey(scene, scene.registry, 'priest');
        const spr = scene.add.sprite(from.x * ts, from.y * ts, scene.textures.exists(spriteKey) ? spriteKey : 'npc_elder')
            .setScale(scene.npcScaleByAge(findNpc(scene.registry, 'priest')))
            .setDepth(from.y + 20.3);
        const runKey = `${spr.texture.key}_walk_right`;
        if (scene.anims.exists(runKey)) spr.play(runKey);
        const label = scene.add.text(from.x * ts, from.y * ts + 36, priestName, {
            fontSize: '12px', color: '#ffd700',
            backgroundColor: '#000000cc', padding: { x: 5, y: 2 },
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(from.y + 20.5);
        this._priestSpr = spr;
        this._priestLabel = label;

        // ПЕРЕБЕГ от церковных дверей к старосте: быстро (2.4 тайла за ~1.3 с),
        // вместе с подписью. По прибытии — диалог священника со старостой.
        const dur = 1300;
        scene.tweens.add({ targets: spr, x: to.x * ts, duration: dur, ease: 'Sine.easeIn' });
        scene.tweens.add({
            targets: label,
            x: to.x * ts,
            duration: dur,
            ease: 'Sine.easeIn',
            onComplete: () => {
                const idleKey = `${spr.texture.key}_idle_down`;
                if (scene.anims.exists(idleKey)) spr.play(idleKey);
                this._showPriestTalk();
            },
        });
    }

    _showPriestTalk() {
        const scene = this.scene;
        scene.activeNpc = {
            id: 'priest',
            name: getNpcDisplayName(scene.registry, 'priest') || t('Отец Савватий'),
            portrait: 'portrait_priest',
        };
        scene.dialogue.run('priest_intro', () => {
            this.finishIntro();
        });
    }

    // --- 4) КОНЕЦ ЗНАКОМСТВА: стартовое задание выдаётся АВТОМАТИЧЕСКИ ---
    finishIntro() {
        const scene = this.scene;
        const q = scene.registry.get('quest') || {};
        if (q.introStage === 'done') return;
        q.introStage = 'done';
        // Раунд 66.84: историю о краже священник уже рассказал у дома старосты —
        // в церкви он не повторяет её с начала (флаг первого рассказа).
        q.priestToldTheftStory = true;
        scene.registry.set('quest', q);

        // СТАРТОВОЕ ЗАДАНИЕ: погоня за вором стартует ТОЛЬКО теперь (п.4):
        // вор с иконой бежит, тики времени ведут отсчёт его ходу.
        initThiefHunt(scene.registry);

        // Часы снова идут, сцена отвечает на ввод.
        resumeWorldClock(scene.registry);
        scene.busyDialog = false;

        // Священник уходит обратно к церкви (уходит со сцены — он «при церкви»).
        this._dismissPriest();

        // Староста снова гуляет по деревне (пересборка уличных НПЦ).
        if (typeof scene.rebuildStreetNpcs === 'function') {
            scene._lastStreetHour = -1; // форс пересборку
            scene.rebuildStreetNpcs();
        }

        ActionLog.add(scene.registry, t('Стартовое задание получено: найди и поймай вора, верни икону старосте или священнику!'));

        // Подсказки управления — после знакомства (п.6: окна под новый старт).
        if (scene.tutorial) {
            try { scene.tutorial.maybeStart(); } catch (e) { /* некритично */ }
        }
        if (typeof scene.updateHUD === 'function') {
            try { scene.updateHUD(); } catch (e) { /* некритично */ }
        }
    }

    _dismissPriest() {
        const scene = this.scene;
        const spr = this._priestSpr;
        const label = this._priestLabel;
        this._priestSpr = null;
        this._priestLabel = null;
        if (!spr || !spr.scene) {
            if (label && label.scene) label.destroy();
            return;
        }
        const ts = scene.tileSize;
        const backX = INTRO_PRIEST_FROM.x * ts;
        const dur = 1600;
        const walkKey = `${spr.texture.key}_walk_left`;
        if (scene.anims.exists(walkKey)) spr.play(walkKey);
        if (label && label.scene) {
            scene.tweens.add({ targets: label, x: backX, alpha: 0, duration: dur, ease: 'Sine.easeIn' });
        }
        scene.tweens.add({
            targets: spr,
            x: backX,
            duration: dur,
            ease: 'Sine.easeIn',
            onComplete: () => {
                if (spr.scene) spr.destroy();
                if (label && label.scene) label.destroy();
            },
        });
    }

    /** Уборка при shutdown сцены (спрайт священника и т.п.). */
    destroy() {
        const spr = this._priestSpr;
        const label = this._priestLabel;
        this._priestSpr = null;
        this._priestLabel = null;
        if (spr && spr.scene) { try { spr.destroy(); } catch (e) { /* сцена гаснет */ } }
        if (label && label.scene) { try { label.destroy(); } catch (e) { /* сцена гаснет */ } }
    }
}

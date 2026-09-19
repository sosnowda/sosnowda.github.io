// Запуск диалоговых деревьев через готовый модальный диалог из ui.js.
// Поддерживает портреты NPC, эффект печатной машинки, учёт пола и знакомства.
// Раунд 31 (пп.11,12): пока идёт беседа — отсчёт реального времени стоит;
// при закрытии беседы списывается фиксированный срок (chargeTalkTime;
// раунд 58 п.1: 10 минут за беседу, было 1 час).
import { createDialog } from '../utils/ui.js';
import { DIALOGUES } from '../data/dialogue.js';
import { findNpc, getNpcDisplayName, meetNpc } from '../data/npcNames.js';
import { pauseWorldClock, resumeWorldClock, chargeTalkTime, TALK_MINUTES } from './WorldClock.js';
import { isEn, t } from './i18n.js';

export class DialogueRunner {
    constructor(scene) {
        this.scene = scene;
        this._currentDialog = null;
    }

    run(id, onDone) {
        const d = DIALOGUES[id];
        if (!d) {
            console.warn('Диалог не найден:', id);
            if (onDone) onDone();
            return;
        }
        this._talkKey = 'dlg:' + id;
        // Раунд 31 (п.12): беседа открыта — мировые часы стоят до её конца
        if (this.scene && this.scene.registry) pauseWorldClock(this.scene.registry);
        this._onDone = onDone;
        this._dialogId = id;
        this._dialogData = d;
        // Раунд 35 (QA-фикс P1): если действие узла упало (любое исключение в
        // askNPC/quest-логике), busyDialog сцены залипал в true, а мировой счётчик
        // clockPauseCount — в +1: клики по сцене игнорировались, время навсегда стояло.
        // Любой сбой теперь корректно закрывает беседу (_finish -> onDone).
        try {
            this._node(d, d.start);
        } catch (e) {
            console.error('Ошибка диалога', id, e);
            this._finish();
        }
    }

    _node(d, nodeId) {
        const node = d.nodes[nodeId];
        if (!node) {
            this._finish();
            return;
        }
        try {
            if (node.action && typeof node.action === 'function') {
                node.action(this.scene);
            }
        } catch (e) {
            console.error('Ошибка действия узла', nodeId, e);
        }

        const choices = (node.choices || []).map(c => ({
            text: c.text,
            callback: () => {
                try {
                    if (c.action && typeof c.action === 'function') c.action(this.scene);
                } catch (e) {
                    console.error('Ошибка действия выбора', e);
                }
                if (c.end) {
                    this._finish();
                } else if (c.next) {
                    this._node(d, c.next);
                } else {
                    this._finish();
                }
            },
        }));

        // Найти портрет по NPC, с которым идёт диалог
        const portraitKey = this._resolvePortraitKey();

        // Уничтожаем предыдущий диалог если был
        if (this._currentDialog && this._currentDialog.scene) {
            this._currentDialog.destroy();
        }

        // Звук открытия диалога
        if (this.scene.audioManager && typeof this.scene.audioManager.playDialogueOpen === 'function') {
            this.scene.audioManager.playDialogueOpen();
        }

        // Раунд 34: узел может нести EN-текст (node.en) — перевод глубоких
        // диалогов живёт прямо в дереве, без раздувания словаря
        // РАУНД 55 (заявка «без повторений при взаимодействии»): приветственный
        // узел может нести variants[] — при повторных беседах реплики РОТАЦИОННО
        // сменяют друг друга (первая встреча — исходный текст, далее — варианты).
        let displayText = (isEn() && node.en) ? node.en : node.text;
        if (nodeId === d.start && Array.isArray(node.variants) && node.variants.length) {
            const reg = this.scene && this.scene.registry;
            const key = 'dlgVar:' + this._dialogId;
            const count = reg ? (reg.get(key) || 0) : 0;
            if (reg) reg.set(key, count + 1);
            const idx = count % (node.variants.length + 1);
            if (idx > 0) {
                const v = node.variants[idx - 1];
                displayText = (isEn() && v.en) ? v.en : (v.text || v);
            }
        }
        if (displayText === '...' && this.scene._lastAskResult && this.scene._lastAskResult.message) {
            displayText = this.scene._lastAskResult.message;
        }
        // Заменяем {address} на половую форму обращения (п.16)
        const address = this._getPlayerAddress();
        displayText = displayText.replace(/\{address\}/g, address);

        // Динамическое имя спикера (п.2-5): до знакомства — «старик священник»,
        // после — «Отец Савватий (священник)»
        let speakerName = node.speaker || '...';
        if (this.scene.activeNpc && this.scene.activeNpc.id) {
            const npc = findNpc(this.scene.registry, this.scene.activeNpc.id);
            if (npc) {
                speakerName = getNpcDisplayName(this.scene.registry, this.scene.activeNpc.id);
            }
        }

        this._currentDialog = createDialog(
            this.scene,
            speakerName,
            displayText,
            choices.length ? choices : [{ text: t('Закрыть'), callback: () => this._finish() }],
            {
                singleton: false,
                portraitKey: portraitKey,
                typing: true,         // эффект печатной машинки
                typingSpeed: 30,      // мс/символ
                pauseClock: false,    // п.12: паузу ведёт сам DialogueRunner на всё дерево
            }
        );
    }

    _resolvePortraitKey() {
        // Извлекаем ключ портрета из активного NPC
        if (this.scene.activeNpc && this.scene.activeNpc.portrait) {
            return this.scene.activeNpc.portrait;
        }
        // Для диалогов без NPC (например, рассказчик) — используем narrator
        return 'portrait_narrator';
    }

    /**
     * Получить пол игрока для учёта в репликах (п.16).
     */
    _getPlayerGender() {
        const player = this.scene.registry.get('player');
        return player ? (player.gender || 'male') : 'male';
    }

    /**
     * Получить половую форму обращения к игроку.
     * Раунд 36: через t() — иначе русский «путник/путница» просачивается
     * в EN-текст узла (node.en содержит {address}).
     */
    _getPlayerAddress() {
        const gender = this._getPlayerGender();
        return gender === 'female' ? t('путница') : t('путник');
    }

    _finish() {
        if (this._currentDialog && this._currentDialog.scene) {
            this._currentDialog.destroy();
        }
        this._currentDialog = null;
        if (this.scene && this.scene.registry) {
            // Раунд 31 (п.11): разговор с НПЦ — ВСЕГДА 1 час, списывается
            // один раз при закрытии беседы (вор за час делает 4 шага).
            // Без ключа-дедупликации: каждая новая беседа стоит свой час.
            chargeTalkTime(this.scene.registry, TALK_MINUTES, null);
            resumeWorldClock(this.scene.registry);
        }
        // Раунд 60 (QA-фикс): награды, выданные ДЕЙСТВИЯМИ узлов диалога
        // (возврат иконы: +деньги/лечение), не обновляли HUD — «💰» висел
        // со старым значением до смены сцены. Дёргаем updateHUD сцены,
        // если он есть (Village/Interior/Location/Apiary).
        if (this.scene && typeof this.scene.updateHUD === 'function') {
            try { this.scene.updateHUD(); } catch (e) { /* некритично */ }
        }
        if (this._onDone) {
            const cb = this._onDone;
            this._onDone = null;
            cb();
        }
    }
}

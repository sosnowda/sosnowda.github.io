// Запуск диалоговых деревьев через готовый модальный диалог из ui.js.
// Поддерживает портреты NPC, эффект печатной машинки, учёт пола и знакомства.
import { createDialog } from '../utils/ui.js';
import { DIALOGUES } from '../data/dialogue.js';
import { findNpc, getNpcDisplayName, meetNpc } from '../data/npcNames.js';

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
        this._onDone = onDone;
        this._dialogId = id;
        this._dialogData = d;
        this._node(d, d.start);
    }

    _node(d, nodeId) {
        const node = d.nodes[nodeId];
        if (!node) {
            this._finish();
            return;
        }
        if (node.action && typeof node.action === 'function') {
            node.action(this.scene);
        }

        const choices = (node.choices || []).map(c => ({
            text: c.text,
            callback: () => {
                if (c.action && typeof c.action === 'function') c.action(this.scene);
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

        // Если в node.text стоит '...' и есть _lastAskResult — используем сообщение оттуда
        let displayText = node.text;
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
            choices.length ? choices : [{ text: 'Закрыть', callback: () => this._finish() }],
            {
                singleton: false,
                portraitKey: portraitKey,
                typing: true,         // эффект печатной машинки
                typingSpeed: 30,      // мс/символ
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
     */
    _getPlayerAddress() {
        const gender = this._getPlayerGender();
        return gender === 'female' ? 'путница' : 'путник';
    }

    _finish() {
        if (this._currentDialog && this._currentDialog.scene) {
            this._currentDialog.destroy();
        }
        this._currentDialog = null;
        if (this._onDone) {
            const cb = this._onDone;
            this._onDone = null;
            cb();
        }
    }
}

// Запуск диалоговых деревьев через готовый модальный диалог из ui.js.
// Поддерживает портреты NPC и эффект печатной машинки.
import { createDialog } from '../utils/ui.js';
import { DIALOGUES } from '../data/dialogue.js';

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

        this._currentDialog = createDialog(
            this.scene,
            node.speaker || '...',
            node.text,
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

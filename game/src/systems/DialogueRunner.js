// Запуск диалоговых деревьев через готовый модальный диалог из ui.js.
import { createDialog } from '../utils/ui.js';
import { DIALOGUES } from '../data/dialogue.js';

export class DialogueRunner {
    constructor(scene) {
        this.scene = scene;
    }

    run(id, onDone) {
        const d = DIALOGUES[id];
        if (!d) {
            console.warn('Диалог не найден:', id);
            if (onDone) onDone();
            return;
        }
        this._node(d, d.start, onDone);
    }

    _node(d, nodeId, onDone) {
        const node = d.nodes[nodeId];
        if (!node) {
            if (onDone) onDone();
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
                    if (onDone) onDone();
                } else if (c.next) {
                    this._node(d, c.next, onDone);
                } else {
                    if (onDone) onDone();
                }
            },
        }));

        createDialog(
            this.scene,
            node.speaker || '...',
            node.text,
            choices.length ? choices : [{ text: 'Закрыть', callback: () => { if (onDone) onDone(); } }],
            { singleton: false }
        );
    }
}

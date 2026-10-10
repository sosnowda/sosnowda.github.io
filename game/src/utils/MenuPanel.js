// ============================================================
// MENU PANEL (§12.3 аудита 66.92, эшелон 3, 66.96).
// ============================================================
// Аудит: «Панели меню — отдельный модуль с трекингом объектов массивом
// (вместо сноса по depth)». Раньше каждая панель InteriorScene закрывалась
// сканом ВСЕХ детей сцены:
//     this.children.list.filter(c => c.depth === 202).forEach(c => c.destroy());
// — 8 копий: O(n) по всей сцене на каждое закрытие и хрупко (чужой объект
// с depth 202 нёсся бы вместе с панелью).
//
// MenuPanel создаёт подложку (depth 200) + пергамент (depth 201), а все
// объекты панели добавляются через track()/text()/button() и запоминаются
// В МАССИВ — close() уничтожает ровно то, что панель создала, точечно.
//
// Использование:
//   const menu = this._menu = new MenuPanel(this, { panelW: 560, panelH: 440,
//       onClose: () => { resumeWorldClock(this.registry); } });
//   menu.text(width / 2, y, заголовокПанели, { ...стили }).setOrigin(0.5);
//   menu.button(x, y, надписьКнопки, cb, { backgroundColor: 0x3a5a3a });
//   ... closeMenu = () => menu.close();   // идемпотентно
import { createButton } from './ui.js';

export class MenuPanel {
    /**
     * @param {Phaser.Scene} scene сцена-владелец
     * @param {object} [opts] { panelW, panelH, veilAlpha, veilColor, panelColor,
     *                         panelStroke, onClose }
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.objects = [];
        this.closed = false;
        const { width, height } = scene.scale;
        this.panelW = opts.panelW || 560;
        this.panelH = opts.panelH || 440;
        this.onClose = opts.onClose || null;
        this.overlay = scene.add.rectangle(0, 0, width, height, opts.veilColor ?? 0x000000, opts.veilAlpha ?? 0.8)
            .setOrigin(0).setInteractive().setDepth(200);
        this.panel = scene.add.rectangle(width / 2, height / 2, this.panelW, this.panelH,
                opts.panelColor ?? 0x241B15, 1)
            .setStrokeStyle(3, opts.panelStroke ?? 0xC9A961).setDepth(201);
    }

    /**
     * Зарегистрировать объект панели в массиве трекинга (возвращает его же).
     * @param {Phaser.GameObjects.GameObject} go
     * @param {number|null} [depth=202] depth проставляется здесь; null — не трогать
     */
    track(go, depth = 202) {
        this.objects.push(go);
        if (depth !== null && go.setDepth) go.setDepth(depth);
        return go;
    }

    /** Текст на панели (depth 202 по умолчанию) — далее цепочку .setOrigin() и пр. */
    text(x, y, str, style, depth = 202) {
        return this.track(this.scene.add.text(x, y, str, style), depth);
    }

    /** Кнопка через ui.createButton с трекингом (стили — как прежде). */
    button(x, y, label, onClick, options) {
        return this.track(createButton(this.scene, x, y, label, onClick, options));
    }

    /**
     * Закрыть панель: точечно уничтожить отслеженные объекты, подложку и
     * пергамент. Идемпотентно; после закрытия зовёт opts.onClose (снятие
     * паузы мировых часов, сброс this._menu и пр.).
     */
    close() {
        if (this.closed) return;
        this.closed = true;
        this.objects.forEach(o => { if (o && o.scene) o.destroy(); });
        this.objects.length = 0;
        this.overlay.destroy();
        this.panel.destroy();
        this.onClose?.();
    }
}

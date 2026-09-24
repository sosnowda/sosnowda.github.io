// Раунд 66.8 (бэклог 66.6 «мини-карта»): ПЛАН ДЕРЕВНИ.
// Компактный виджет в правом верхнем углу (всегда виден, клик — разворот)
// + большая панель-план с легендой и меткой игрока. Клавиша P — тумблер.
// Сетка рисуется из world.buildMap() (та же геометрия, что и в VillageScene),
// здания — из interiors.BUILDINGS. Все цвета — в MINIMAP_COLORS (юнит-тест).
// Тексты — через t() (EN-линия); имена собственные транслитерацией.

import { MAP_W, MAP_H } from '../data/world.js';
import { BUILDINGS } from '../data/interiors.js';
import { t } from './i18n.js';

// Раунд 66.21 (приказ 2): доска поручений стала ВИРТУАЛЬНОЙ — физическая
// доска у ворот (23,4) удалена, метка с плана деревни снята. Поручения
// выдают взрослые НПЦ в диалогах (questGenerator.makeQuestOffer).

/** Цвет клеток плана по символу сетки buildMap(). */
export function cellColor(ch) {
    switch (ch) {
        case 'B': return 0xC2A878;  // широкая песчаная улица
        case 'S': case ',': return 0xB09868; // грунтовая дорожка
        case 'L': return 0x2E2013;  // частокол (тёмные брёвна)
        case 'G': return 0xD8B96A;  // ворота (золотая метка проезда)
        case 'T': return 0x2E4A24;  // дерево
        case '#': return 0x777777;  // камень
        case 'H': return 0x6B4A2E;  // стена дома
        case 'R': return 0x7A3B2A;  // крыша дома
        case 'D': return 0xE8DCC4;  // дверь
        case 'W': return 0x8A8A8A;  // колодец
        case '~': return 0x3A5A7A;  // вода (в деревне не используется)
        default: return 0x44582F;   // трава
    }
}

/** Цвет здания плана по interiorId (легенда панели использует те же цвета). */
export function buildingColor(interiorId) {
    switch (interiorId) {
        case 'church': return 0xC9A961;      // церковь — золото
        case 'elder_house': return 0x2A4A6A; // староста — синий
        case 'tavern': return 0xB5651D;      // постоялый двор — янтарь
        case 'blacksmith': return 0x8B2C1A;  // кузница — красный
        case 'healer_house': return 0x3A6A4A; // знахарка — травяной
        default: return 0x6B4A2E;            // жилой дом — коричневый
    }
}

/** Легенда панели: [цвет, подпись]. Подписи через t(). */
export function planLegend() {
    return [
        [buildingColor('church'), t('Церковь')],
        [buildingColor('elder_house'), t('Староста')],
        [buildingColor('tavern'), t('Постоялый двор')],
        [buildingColor('blacksmith'), t('Кузница')],
        [buildingColor('healer_house'), t('Дом знахарки')],
        [buildingColor('potter_house'), t('Жилой дом')],
        [0xD8B96A, t('Ворота')],
        [0xFF3B30, t('Ты')],
    ];
}

/**
 * Рисует план в переданный 2D-контекст canvas (используется и виджетом,
 * и большой панелью — разный масштаб клетки).
 * grid — результат world.buildMap() (массив строк символов).
 */
export function drawPlan(ctx, grid, cell) {
    // 1) клетки
    for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
            const ch = (grid[y] && grid[y][x]) || '.';
            ctx.fillStyle = '#' + cellColor(ch).toString(16).padStart(6, '0');
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }
    // 2) здания поверх (по footprint), двери — светлым
    for (const b of BUILDINGS) {
        ctx.fillStyle = '#' + buildingColor(b.interiorId).toString(16).padStart(6, '0');
        ctx.fillRect(b.col * cell, b.row * cell, b.w * cell, b.h * cell);
        ctx.fillStyle = '#E8DCC4';
        ctx.fillRect((b.col + Math.floor(b.w / 2)) * cell, (b.row + b.h - 1) * cell, cell, cell);
    }
    // 3) ворота — золотая полоса на восточной кромке
    //    (раунд 66.21: метка доски поручений снята — доска виртуальная)
    ctx.fillStyle = '#D8B96A';
    ctx.fillRect((MAP_W - 1) * cell, 5 * cell, cell, cell);
}

/** Структура панели/виджета: размеры в пикселях при данной клетке. */
export function planSize(cell) {
    return { w: MAP_W * cell, h: MAP_H * cell };
}

export class MiniMap {
    /**
     * @param {Phaser.Scene} scene — сцена Village (this.map — сетка buildMap()).
     * Виджет создаётся сразу; панель — по требованию.
     */
    constructor(scene) {
        this.scene = scene;
        this.open = false;
        this.widgetScale = 2;
        this._panel = null;

        this._buildWidgetTexture();
        this._createWidget();
    }

    // ----- Виджет (мини, всегда виден) -----
    _buildWidgetTexture() {
        const cell = 3;
        if (this.scene.textures.exists('minimap_widget')) return;
        const size = planSize(cell);
        const tex = this.scene.textures.createCanvas('minimap_widget', size.w, size.h);
        drawPlan(tex.getContext(), this.scene.map, cell);
        tex.refresh();
    }

    _createWidget() {
        const s = this.scene;
        const size = planSize(3);
        const w = size.w * this.widgetScale, h = size.h * this.widgetScale;
        // Рамка-фон (пергамент) — правый верхний угол, ПОД названием деревни
        const x = s.scale.width - 8 - w, y = 62;
        this._widget = [];
        const frame = s.add.rectangle(x - 3, y - 3, w + 6, h + 6, 0x241B15, 0.92)
            .setOrigin(0).setStrokeStyle(2, 0xC9A961, 0.9)
            .setScrollFactor(0).setDepth(101)
            .setInteractive({ useHandCursor: true });
        const img = s.add.image(x, y, 'minimap_widget')
            .setOrigin(0).setScale(this.widgetScale)
            .setScrollFactor(0).setDepth(102);
        img.setInteractive({ useHandCursor: true });
        const marker = s.add.circle(x + w / 2, y + h / 2, 3, 0xFF3B30)
            .setStrokeStyle(1, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(103);
        this._widget.push(frame, img, marker);
        this._widgetMarker = marker;
        this._widgetBox = { x, y, w, h };
        const open = () => this.showPanel();
        frame.on('pointerup', open);
        img.on('pointerup', open);
    }

    // ----- Большая панель -----
    showPanel() {
        if (this.open) return;
        const s = this.scene;
        this.open = true;
        const cell = 8;
        const size = planSize(cell);
        const { width, height } = s.scale;
        const legend = planLegend();

        if (!s.textures.exists('minimap_panel')) {
            const tex = s.textures.createCanvas('minimap_panel', size.w, size.h);
            drawPlan(tex.getContext(), s.map, cell);
            tex.refresh();
        }

        const panelW = size.w + 40;
        const panelH = size.h + 96 + legend.length * 17 + 12;
        const px = width / 2 - panelW / 2, py = height / 2 - panelH / 2;
        const P = [];
        const add = (o) => { P.push(o); return o; };

        add(s.add.rectangle(0, 0, width, height, 0x000000, 0.72)
            .setOrigin(0).setInteractive().setScrollFactor(0).setDepth(220));
        add(s.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setScrollFactor(0).setDepth(221));
        add(s.add.text(width / 2, py + 18, t('🗺 План деревни'), {
            fontSize: '20px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(223));

        const mapX = width / 2 - size.w / 2, mapY = py + 40;
        add(s.add.image(mapX, mapY, 'minimap_panel')
            .setOrigin(0).setScrollFactor(0).setDepth(222));
        // рамка карты
        add(s.add.rectangle(mapX - 2, mapY - 2, size.w + 4, size.h + 4, 0x000000, 0)
            .setOrigin(0).setStrokeStyle(2, 0xC9A961, 0.7).setScrollFactor(0).setDepth(223));
        // метка игрока (обновляется в update())
        this._panelMarker = add(s.add.circle(mapX + size.w / 2, mapY + size.h / 2, 5, 0xFF3B30)
            .setStrokeStyle(2, 0x000000, 0.9).setScrollFactor(0).setDepth(224));

        // Легенда в две колонки
        const half = Math.ceil(legend.length / 2);
        legend.forEach(([color, label], i) => {
            const colIdx = i < half ? 0 : 1;
            const rowIdx = i % half;
            const lx = width / 2 - panelW / 2 + 24 + colIdx * (panelW / 2 - 20);
            const ly = mapY + size.h + 12 + rowIdx * 17;
            add(s.add.rectangle(lx, ly + 5, 10, 10, color, 1)
                .setOrigin(0).setStrokeStyle(1, 0x000000, 0.6).setScrollFactor(0).setDepth(223));
            add(s.add.text(lx + 16, ly, label, {
                fontSize: '12px', color: '#E8DCC4', fontFamily: 'Georgia, serif',
            }).setOrigin(0, 0).setScrollFactor(0).setDepth(223));
        });

        // Кнопка закрытия
        const closeBg = add(s.add.rectangle(width / 2, py + panelH - 20, 150, 26, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961).setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(223));
        const closeText = add(s.add.text(width / 2, py + panelH - 20, t('Закрыть'), {
            fontSize: '13px', color: '#E8DCC4', fontFamily: 'Georgia, serif',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(224));
        closeBg.on('pointerup', () => this.hidePanel());

        this._panel = P;
        this._panelMapBox = { x: mapX, y: mapY, w: size.w, h: size.h };
        this._updateMarker();
        // Клик по затемнению — закрыть. Клики по самой панели НЕ закрывают:
        // невидимая стоп-плашка над панелью (ниже кнопок/легенды) перехватывает
        // pointerup (input.topOnly=true в Phaser — верхний интерактивный объект
        // съедает клик, до оверлея он не доходит).
        P[0].on('pointerup', () => this.hidePanel());
        add(s.add.rectangle(width / 2, height / 2, panelW, panelH, 0x000000, 0.001)
            .setInteractive().setScrollFactor(0).setDepth(222.5));
    }

    hidePanel() {
        if (!this.open) return;
        this.open = false;
        (this._panel || []).forEach(o => o && o.destroy());
        this._panel = null;
        this._panelMarker = null;
    }

    toggle() {
        if (this.open) this.hidePanel();
        else this.showPanel();
    }

    /** Обновление метки игрока (зывается из VillageScene.update()). */
    update() {
        this._updateMarker();
    }

    _updateMarker() {
        const s = this.scene;
        const p = s.playerObj;
        if (!p) return;
        // мировые пиксели → клетки плана (мировой тайл 32px)
        if (this._widgetMarker && this._widgetBox) {
            const b = this._widgetBox;
            const mx = b.x + (p.x / (MAP_W * 32)) * b.w;
            const my = b.y + (p.y / (MAP_H * 32)) * b.h;
            this._widgetMarker.setPosition(
                Phaser.Math.Clamp(mx, b.x + 2, b.x + b.w - 2),
                Phaser.Math.Clamp(my, b.y + 2, b.y + b.h - 2));
        }
        if (this._panelMarker && this._panelMapBox) {
            const b = this._panelMapBox;
            const mx = b.x + (p.x / (MAP_W * 32)) * b.w;
            const my = b.y + (p.y / (MAP_H * 32)) * b.h;
            this._panelMarker.setPosition(
                Phaser.Math.Clamp(mx, b.x + 3, b.x + b.w - 3),
                Phaser.Math.Clamp(my, b.y + 3, b.y + b.h - 3));
        }
    }

    destroy() {
        this.hidePanel();
        (this._widget || []).forEach(o => o && o.destroy());
        this._widget = null;
        this._widgetMarker = null;
    }
}

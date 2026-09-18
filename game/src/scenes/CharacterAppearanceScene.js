// CharacterAppearanceScene.js — выбор облика героя (раунд 50).
//
// ПРЕЖНЯЯ ВЕРСИЯ (раунды 37–49): живая LPC-кастомизация по слоям
// (тело/глаза/борода/волосы/штаны/обувь/одежда). РАУНД 50 (пп.8,9 заявки):
// облик игрока теперь — готовые фигурки Medieval - Heroes I; слоёв у них нет,
// кастомизация невозможна — меню кастомизации ОТКЛЮЧЕНО владельцем.
// Вместо неё — выбор одного из четырёх готовых обликов (по полу героя).
//
// Контракт со сценами прежний по духу: player.sprite = 'hero_<key>',
// player.useComposite = false, анимации — из BootScene.createWalkAnimations.

import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
import { t } from '../systems/i18n.js';
import { heroLooksForGender, HERO_LOOKS } from '../data/heroes.js';
import { ActionLog } from '../data/actionLog.js';

export class CharacterAppearanceScene extends Phaser.Scene {
    constructor() {
        super('CharacterAppearance');
    }

    create() {
        bindRestartOnResize(this);
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);

        const player = this.registry.get('player') || {};
        this.gender = player.gender || null;   // у прегенов пол известен
        this.selectedKey = null;
        this.cardNodes = [];

        this.add.text(width / 2, 34, t('🧝 Облик героя'), {
            fontFamily: 'Georgia, serif',
            fontSize: '30px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        this.add.text(width / 2, 74,
            t('Готовые фигурки Medieval-Heroes: тонкая настройка слоёв недоступна (раунд 50).\nВыбери, кем ты войдёшь в летопись.'),
            {
                fontSize: '14px', color: RUS.textDim,
                stroke: '#000', strokeThickness: 1, align: 'center',
            }).setOrigin(0.5, 0);

        this.cardsLayer = this.add.container(0, 0);
        this.buildCards();

        // Кнопки
        createButton(this, width / 2 - 130, height - 52, t('◀ Назад'), () => {
            this.scene.start('CharacterSelection');
        }, { fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 } });
        this.confirmBtn = createButton(this, width / 2 + 130, height - 52, t('Подтвердить ▶'), () => {
            if (!this.selectedKey) return;
            this.confirm();
        }, { fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 } });
    }

    buildCards() {
        const { width, height } = this.scale;
        this.cardsLayer.removeAll(true);
        this.cardNodes = [];
        const looks = heroLooksForGender(this.gender);
        // авто-выбор первого, если прошлый выбор не подходит по полу
        const player = this.registry.get('player') || {};
        if (!this.selectedKey || !looks.some(h => h.key === this.selectedKey)) {
            this.selectedKey = player.heroLook && looks.some(h => h.key === player.heroLook)
                ? player.heroLook
                : looks[0].key;
        }
        const cardW = width < 760 ? 150 : 200;
        const step = cardW + (width < 760 ? 14 : 24);
        const startX = width / 2 - step * (looks.length - 1) / 2;
        const cy = height / 2 + 6;

        looks.forEach((h, i) => {
            const cx = startX + i * step;
            const selected = h.key === this.selectedKey;
            const frame = this.add.rectangle(cx, cy, cardW, 240, selected ? 0x3a2c14 : 0x1a140e, 0.95)
                .setStrokeStyle(3, selected ? RUS.accent : 0x5a4530);
            const spr = this.add.sprite(cx, cy - 34, h.key, 0).setScale(2.4);
            if (this.anims.exists(`${h.key}_walk_down`)) spr.play(`${h.key}_walk_down`);
            const name = this.add.text(cx, cy + 62, t(h.name), {
                fontSize: '18px', color: selected ? '#c9a14a' : RUS.text, fontStyle: 'bold',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5);
            const desc = this.add.text(cx, cy + 86, t(h.desc), {
                fontSize: '11px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
                align: 'center', wordWrap: { width: cardW - 24 },
            }).setOrigin(0.5);
            const hit = this.add.rectangle(cx, cy, cardW + 8, 248, 0xffffff, 0.001)
                .setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => {
                this.selectedKey = h.key;
                this.buildCards();
            });
            this.cardsLayer.add([frame, spr, name, desc, hit]);
        });
    }

    confirm() {
        const player = this.registry.get('player') || {};
        if (!player) return;
        // Применяем выбранный облик (преген сохраняет имя/класс/статы)
        player.sprite = this.selectedKey;
        player.useComposite = false;
        player.heroLook = this.selectedKey;
        this.registry.set('player', player);
        const look = HERO_LOOKS.find(h => h.key === this.selectedKey);
        ActionLog.add(this.registry, `Облик героя: ${t((look || {}).name || this.selectedKey)}.`);
        this.scene.start('Village');
    }
}

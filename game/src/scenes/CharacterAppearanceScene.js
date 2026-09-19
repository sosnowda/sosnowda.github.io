// CharacterAppearanceScene.js — облик героя для прегенерированных персонажей.
//
// ПРЕЖНЯЯ ВЕРСИЯ (раунды 37–49): живая LPC-кастомизация по слоям.
// Раунд 50: кастомизация отключена, облик — готовые фигурки.
// РАУНД 59 (пп.7,8 приказа владельца): облик собирается единым LPC-шаблоном
// (как у жителей), цвета ОДЕЖДЫ/ВОЛОС/ГЛАЗ — СЛУЧАЙНЫЕ на каждый старт игры;
// кнопка «🎲 Другой облик» перебрасывает.
//
// Контракт со сценами (раунд 59): player.useComposite = true, спрайт —
// LPC-композит 'player_composite' (анимации player_composite_walk_*/idle_*).

import { RUS } from '../config/RusTheme.js';
import { createButton, bindRestartOnResize } from '../utils/ui.js';
import { t } from '../systems/i18n.js';
import { rollPlayerAppearance, composePlayerTexture } from '../systems/NpcLpc.js';
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
        this.gender = player.gender || 'male';
        this.age = player.age || 25;
        this.playerLook = null;

        this.add.text(width / 2, 34, t('🧝 Облик героя'), {
            fontFamily: 'Georgia, serif',
            fontSize: '30px', color: RUS.text, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        this.add.text(width / 2, 74,
            t('Цвета одежды, волос и глаз выбираются случайным образом\nпри каждом старте игры (раунд 59). Кнопка «Другой облик» — переброс.'),
            {
                fontSize: '14px', color: RUS.textDim,
                stroke: '#000', strokeThickness: 1, align: 'center',
            }).setOrigin(0.5, 0);

        this.lookLayer = this.add.container(0, 0);
        this.buildLookPreview();

        // Кнопки
        createButton(this, width / 2 - 130, height - 52, t('◀ Назад'), () => {
            this.scene.start('CharacterSelection');
        }, { fontSize: 16, padding: { left: 20, right: 20, top: 10, bottom: 10 } });
        this.confirmBtn = createButton(this, width / 2 + 130, height - 52, t('Подтвердить ▶'), () => {
            this.confirm();
        }, { fontSize: 18, padding: { left: 24, right: 24, top: 10, bottom: 10 } });
    }

    buildLookPreview() {
        const { width, height } = this.scale;
        this.lookLayer.removeAll(true);
        if (!this.playerLook) {
            this.playerLook = rollPlayerAppearance(this.gender, this.age);
        }
        composePlayerTexture(this, this.playerLook, 'player_preview');
        const cy = height / 2 + 6;
        const frame = this.add.rectangle(width / 2, cy, 200, 250, 0x1a140e, 0.95)
            .setStrokeStyle(3, RUS.accent);
        const spr = this.add.sprite(width / 2, cy - 30, 'player_preview', 0).setScale(2.6);
        if (this.anims.exists('player_preview_walk_down')) spr.play('player_preview_walk_down');
        const hint = this.add.text(width / 2, cy + 84, t('Единый шаблон жителя, случайная расцветка'), {
            fontSize: '12px', color: RUS.textDim, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        const reroll = createButton(this, width / 2, cy + 116, t('🎲 Другой облик'), () => {
            this.playerLook = rollPlayerAppearance(this.gender, this.age);
            this.buildLookPreview();
        }, {
            backgroundColor: 0x4a3520, hoverColor: 0x5a4530, textColor: RUS.text,
            fontSize: 14, padding: { left: 16, right: 16, top: 8, bottom: 8 },
        });
        this.lookLayer.add([frame, spr, hint, reroll]);
    }

    confirm() {
        const player = this.registry.get('player') || {};
        if (!player) return;
        // Собираем ИТОГОВУЮ текстуру героя (+ анимации walk/idle)
        if (!this.playerLook) this.playerLook = rollPlayerAppearance(this.gender, this.age);
        const composed = composePlayerTexture(this, this.playerLook, 'player_composite');
        player.useComposite = composed;
        player.lpcAppearance = this.playerLook;
        if (composed) player.sprite = 'player_composite';
        this.registry.set('player', player);
        ActionLog.add(this.registry, 'Облик героя: единый шаблон, случайные цвета одежды/волос/глаз (раунд 59).');
        this.scene.start('Village');
    }
}

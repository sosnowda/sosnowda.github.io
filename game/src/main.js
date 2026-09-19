// Phaser загружен глобально через CDN.
// RexUI полностью удалён — все UI-компоненты построены на нативном Phaser
// (см. src/utils/ui.js).
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterSelectionScene } from './scenes/CharacterSelectionScene.js';
// Раунды 60-61: CharacterAppearanceScene и CharacterGeneratorScene удалены —
// у героя старая готовая модель ('player'/'npc_merchant'), без кастомизации
import { VillageScene } from './scenes/VillageScene.js';
import { InteriorScene } from './scenes/InteriorScene.js';
import { ForkScene } from './scenes/ForkScene.js';
import { LocationScene } from './scenes/LocationScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { EndScene } from './scenes/EndScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';

const config = {
    type: Phaser.AUTO,
    title: 'Летописи Руси',
    description: 'Браузерная RPG в сеттинге Руси XV века',
    parent: 'game-container',
    // Раунд 20: Scale.RESIZE — любое разрешение/ориентация окна.
    // (Точка входа игры — game/index.html; этот конфиг держим синхронно.)
    width: (typeof window !== 'undefined') ? window.innerWidth : 1280,
    height: (typeof window !== 'undefined') ? window.innerHeight : 720,
    // П.5: Фон canvas — тёмно-коричневый (не зелёный!), чтобы избежать «зелёной сетки».
    backgroundColor: '#2e2118',
    pixelArt: false,
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [
        BootScene,
        TitleScene,
        CharacterSelectionScene,
        VillageScene,
        InteriorScene,
        ForkScene,
        LocationScene,
        CombatScene,
        EndScene,
        CharacterScene,
    ],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: true,
    },
};

// Экспорт в window — для отладки и QA (agent-browser / console)

// ============================================================
// Раунд 41 (QA-хардендинг): защита от «тихого замерзания» игры.
//
// Симптом (воспроизведён в QA дважды): игра продолжает рисовать и
// принимать клики, но сцены больше не обновляются (твины стоят,
// диалоги «мертвы», время не идёт). Причина: ЛЮБОЕ исключение внутри
// SceneManager.update() (например, из Clock.update — таймер эффекта
// печати, или из DisplayList.shutdown при stop-е сцены) оставляло
// SceneManager.isProcessing = true НАВСЕГДА — Phaser сам не страхует
// это поле, и каждый следующий кадр выходил из update() ранним return.
//
// Гард: даже если исключение случилось — сбрасываем isProcessing и
// логируем, чтобы игровой цикл жил, а ошибка была видна в консоли.
// ============================================================
(function () {
    const SM = Phaser.Scenes && Phaser.Scenes.SceneManager;
    if (SM && SM.prototype && typeof SM.prototype.update === 'function') {
        const origUpdate = SM.prototype.update;
        SM.prototype.update = function (time, delta) {
            try {
                return origUpdate.call(this, time, delta);
            } catch (e) {
                this.isProcessing = false; // критично: не оставить цикл замороженным
                console.error('[Летописи:гард] Исключение в SceneManager.update (цикл восстановлен):', e);
            }
        };
    }

    const DL = Phaser.GameObjects && Phaser.GameObjects.DisplayList;
    if (DL && DL.prototype && typeof DL.prototype.shutdown === 'function') {
        const origShutdown = DL.prototype.shutdown;
        DL.prototype.shutdown = function () {
            const list = this.list || [];
            for (let i = list.length - 1; i >= 0; i--) {
                const obj = list[i];
                // QA: в списке могли остаться «дырки»/двойные записи —
                // shutdown одной битой ссылки раньше обрывал stop сцены
                if (obj && typeof obj.destroy === 'function') {
                    try { obj.destroy(true); } catch (e) { /* объект уже убит */ }
                }
            }
            list.length = 0;
            if (this.events) {
                this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            }
        };
    }
})();

window.game = new Phaser.Game(config);

// ============================================================
// Раунд 56 (приказ владельца): F1 открывает СПРАВКУ ИГРЫ, а не браузера.
// Игровые обработчики keydown-F1 есть во всех сценах (Title, Village,
// Interior, Forest, Fork, Location, Combat, Apiary — раунд 32), но браузер
// перехватывал клавишу и поверх игры открывал СВОЮ справку. Глушаем
// браузерное поведение на уровне документа: preventDefault НЕ мешает
// обработчикам Phaser (событие продолжает всплывать по window).
// ============================================================
(function () {
    const swallowF1 = (e) => {
        if (e.code === 'F1' || e.key === 'F1' || e.keyCode === 112) {
            e.preventDefault();
        }
    };
    window.addEventListener('keydown', swallowF1, { passive: false });
    if (window.game && window.game.input && window.game.input.keyboard &&
        typeof window.game.input.keyboard.addKeyCapture === 'function') {
        // Идиоматичный дубль: Phaser тоже держит F1 в списке захвата
        try { window.game.input.keyboard.addKeyCapture('F1'); } catch (e) { /* не критично */ }
    }
})();

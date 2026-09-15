// Phaser загружен глобально через CDN.
// RexUI полностью удалён — все UI-компоненты построены на нативном Phaser
// (см. src/utils/ui.js).
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterSelectionScene } from './scenes/CharacterSelectionScene.js';
import { CharacterGeneratorScene } from './scenes/CharacterGeneratorScene.js';
import { CharacterAppearanceScene } from './scenes/CharacterAppearanceScene.js';
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
        CharacterGeneratorScene,
        CharacterAppearanceScene,
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
window.game = new Phaser.Game(config);

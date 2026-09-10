// Phaser загружен глобально через CDN
// UIPlugin загружен глобально
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { VillageScene } from './scenes/VillageScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';

const config = {
    type: Phaser.AUTO,
    title: 'Летописи Руси',
    description: 'Браузерная RPG в сеттинге Руси XV века',
    parent: 'game-container',
    width: 1280,
    height: 720,
    backgroundColor: '#1b2a1f',
    pixelArt: false,
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, TitleScene, VillageScene, CombatScene, CharacterScene],
    plugins: {
        scene: [{
            key: 'rexUI',
            plugin: UIPlugin,
            mapping: 'rexUI',
        }],
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

new Phaser.Game(config);

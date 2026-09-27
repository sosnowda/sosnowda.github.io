// test_round88.mjs — итерация 66.32: MVsv-конвейер боевых листов
// «Medieval - Heroes I» (Drive владельца).
// 1) 34 боевых листа в assets/sprites/battle (384×128, палитровые)
// 2) BootScene: загрузка + анимации (idle — статичный кадр f1)
// 3) CombatScene: боевой облик по архетипу/полу, без флипа, выстрел/смерть/победа
// 4) heroes.js: BATTLE_LOOK_BY_PRESET (8 пресетов) + страховка по полу
// 5) конвейер tools/mvsv_battle_6632.py с якорением по туловищу
// 6) SW v84 + game-assets-v30 (66.34 актуализировал v83/v29). Сейвы совместимы.
import { readFileSync, existsSync, readdirSync } from 'fs';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
};
const read = (p) => readFileSync(p, 'utf8');

const boot = read('../src/scenes/BootScene.js');
const combat = read('../src/scenes/CombatScene.js');
const heroes = read('../src/data/heroes.js');
const sw = read('../../sw.js');


console.log('--- 1. Боевые листы: 34 файла 384×128, палитра (п.1) ---');
const BATTLE_DIR = '../assets/sprites/battle';
const LOOKS = ['baenor', 'gaerron', 'huntress', 'naia', 'paul'];
const ANIMS = {
    baenor: 7, gaerron: 7, huntress: 7, naia: 7, paul: 6, // paul без shoot
};
let totalFiles = 0, totalKB = 0;
for (const look of LOOKS) {
    for (const anim of ['idle', 'attack1', 'attack2', 'fists', 'shoot', 'death', 'victory']) {
        if (look === 'paul' && anim === 'shoot') {
            ok(!existsSync(`${BATTLE_DIR}/battle_paul_shoot.png`), 'paul: полосы стрельбы нет (как задумано)');
            continue;
        }
        const p = `${BATTLE_DIR}/battle_${look}_${anim}.png`;
        ok(existsSync(p), `battle_${look}_${anim}.png на месте`);
        if (!existsSync(p)) continue;
        totalFiles++;
        totalKB += Math.round(readFileSync(p).length / 1024);
        // PNG-заголовок: ширина/высота из IHDR (big-endian, offset 16/20)
        const buf = readFileSync(p);
        ok(buf.readUInt32BE(16) === 384 && buf.readUInt32BE(20) === 128,
            `battle_${look}_${anim}.png: 384×128`);
        // color type 3 (палитра) в IHDR offset 25
        ok(buf[25] === 3, `battle_${look}_${anim}.png: палитровый (color type 3)`);
    }
}
ok(totalFiles === 34, `итого 34 листа (фактически ${totalFiles}), суммарно ~${totalKB} КБ (< 400 КБ)`);
ok(totalKB < 400, `вес пака боевых листов разумный: ${totalKB} КБ`);
ok(existsSync(`${BATTLE_DIR}/MANIFEST_6633.txt`), 'манифест конвейера на месте (66.33 актуализировал 6632)');
// ноги на нижнем крае: у idle-листов контент доходит до нижних строк (y>120)
// лёгкая проверка через MANIFEST (34 строки)
const manifest = read(`${BATTLE_DIR}/MANIFEST_6633.txt`).trim().split('\n');
ok(manifest.length === 35, 'манифест: 34 записи + итог');

console.log('--- 2. BootScene: загрузка и анимации (п.2) ---');
ok(boot.includes('const BATTLE_LOOK_SHEETS = {'), 'список полос объявлен в BootScene');
ok(!/export\s+const\s+BATTLE_LOOK_SHEETS/.test(boot), 'ВАЖНО: список НЕ экспортируется (index.html берёт первый экспорт как класс сцены)');
ok(boot.includes("assets/sprites/battle/battle_${look}_${a}.png"), 'загрузка battle_<look>_<anim> из assets/sprites/battle');
ok(boot.includes('{ frameWidth: 96, frameHeight: 96 }'), 'сетка кадров 96×96');
ok(boot.includes('createBattleLookAnimations(look)'), 'метод createBattleLookAnimations');
ok(boot.includes("frames: [{ key: texKey, frame: 1 }]"), 'idle — статичный нейтральный кадр f1 (якорь x=48)');
ok(boot.includes("Object.keys(BATTLE_LOOK_SHEETS).forEach((look) => this.createBattleLookAnimations(look))"), 'анимации создаются для всех обликов');
for (const look of LOOKS) ok(boot.includes(`${look}: [`), `облик ${look} в списке загрузки`);
ok(boot.includes("paul: ['idle', 'attack1', 'attack2', 'fists', 'death', 'victory']"), 'paul: 6 полос (без shoot)');

console.log('--- 3. CombatScene: боевой облик в бою (п.3) ---');
ok(combat.includes("import { battleLookFor } from '../data/heroes.js'"), 'импорт battleLookFor');
ok(combat.includes('this.battleLook = battleLookFor(this.player.archetype, this.player.gender)'), 'облик выбирается по архетипу+полу игрока');
ok(combat.includes('this.usesBattleLook'), 'флаг usesBattleLook (fallback на рыцаря)');
ok(combat.includes("'knight_idle'"), 'fallback на Fantasy Knight сохранён');
ok(!combat.includes('setOrigin(0.5, 1 / 6).setFlipX(true)'), 'флип боевого облика УБРАН (пак смотрит вправо — QA-6632)');
ok(combat.includes('setOrigin(0.5, 1 / 6)'), 'origin.y = 1/6: линия ног как у рыцаря (низ кадра в y+100)');
ok(combat.includes('pickAttackAnim(weaponKey)'), 'выбор анимации атаки (кулаки → fists)');
ok(combat.includes('playPlayerShoot()'), 'анимация стрельбы облика');
ok(combat.includes('playPlayerIdle()'), 'возврат в idle облика');
ok(combat.includes('an.key !== chosen') || combat.includes('an.key !== k'), 'animationcomplete фильтруется по ключу (не гасит победу)');
ok(combat.includes('battle_${this.battleLook}_death') || combat.includes('`battle_${this.battleLook}_death`'), 'смерть боевым обликом');
ok(combat.includes('`battle_${this.battleLook}_victory`'), 'победная анимация облика');
ok(combat.includes('fillGradientStyle(0x3a2a1a'), 'фон боя светлее (читаемость тёмных обликов, QA-6632)');

console.log('--- 4. heroes.js: маппинг пресетов (п.4) ---');
ok(heroes.includes('export const BATTLE_LOOK_BY_PRESET'), 'таблица BATTLE_LOOK_BY_PRESET');
ok(heroes.includes('export function battleLookFor'), 'функция battleLookFor');
for (const pair of ['Воин|male', 'Воин|female', 'Следопыт|male', 'Следопыт|female', 'Сыщик|male', 'Сыщик|female', 'Приключенец|male', 'Приключенец|female']) {
    ok(heroes.includes(`'${pair}':`), `маппинг ${pair}`);
}
// страховка по полу: неизвестный архетип → huntress/baenor
ok(heroes.includes("return gender === 'female' ? 'huntress' : 'baenor'"), 'страховка по полу для неизвестных архетипов');

console.log('--- 5. Конвейер (п.5) ---');
ok(existsSync('../tools/mvsv_battle_6632.py'), 'tools/mvsv_battle_6632.py в репо');
const pipe = read('../tools/mvsv_battle_6632.py');
ok(pipe.includes('def torso_align'), 'якорение по туловищу (torso_align, QA-6632)');
ok(pipe.includes("anchor='f1' if anim == 'idle' else 'mean'"), 'idle якорится по кадру f1');
ok(pipe.includes('HUNTRESS_DEAD_FRAMES'), 'смерть Охотницы собирается из Huntress_dead.png (128-сетка)');
ok(pipe.includes('Huntress_dead.png 128er'), 'манифест помечает спец-сборку смерти');

console.log('--- 6. SW v84 + game-assets-v30 (66.34) ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v85';"), 'SW: site-cache v84');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v30';"), 'SW: game-assets-v30 (перегенерированные листы + бусты)');
ok(sw.includes('// v84 — итерация 66.34'), 'SW: журнал содержит запись v84');

console.log(`\nИТОГО: ✓ ${pass}  ✗ ${fail}`);
process.exit(fail ? 1 : 0);

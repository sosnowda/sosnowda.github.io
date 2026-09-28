// test_round95.mjs — ПАТЧ 66.39 (7 приказов владельца):
//   1) женщины — только в длинных платьях (брючный костюм 66.38 удалён насовсем);
//   2) брюки — только у мужчин (игрок/жители/стража);
//   3) альты в бусты: полный комплект 35 портретов пака + листалка в превью;
//   4) альты в боевые облики: Лейанн (альт huntress) и ЛордЭстер (альт baenor);
//   5) только люди (PB/KT_Humans не задействованы);
//   6-7) скриншоты/прогон — QA-скрипт qa_6639.mjs (браузер), здесь не проверяется.
// Проверки: боевые альты 14 листов + манифест, бусты 35 + манифест, heroes.js
// (альты обликов, варианты бустов, Пауль с портретом), проводка BootScene/
// CharacterSelection/CharacterScene/CombatScene, WorldLook без женских брюк,
// конвейеры без женских брюк, i18n, только люди.
// Запуск: cd game/tools && node test_round95.mjs
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const game = join(__dirname, '..');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
    if (cond) { pass++; }
    else { fail++; fails.push(msg); console.log('  RED: ' + msg); }
}
function read(p) { return readFileSync(join(game, p), 'utf8'); }

console.log('— 1. Боевые альты: leyanne/esther (14 листов) —');
const battleDir = join(game, 'assets/sprites/battle');
ok(existsSync(join(game, 'tools/make_battle_alts_6639.py')), 'tools/make_battle_alts_6639.py в репо');
ok(existsSync(join(game, 'tools/drive_fetch_busts_6639.py')), 'tools/drive_fetch_busts_6639.py в репо (стейджинг)');
for (const look of ['leyanne', 'esther']) {
    for (const anim of ['idle', 'attack1', 'attack2', 'fists', 'shoot', 'death', 'victory']) {
        const p = join(battleDir, `battle_${look}_${anim}.png`);
        ok(existsSync(p), `battle_${look}_${anim}.png на месте`);
        if (!existsSync(p)) continue;
        const buf = readFileSync(p);
        ok(buf.readUInt32BE(16) === 384 && buf.readUInt32BE(20) === 128,
            `battle_${look}_${anim}.png: 384×128`);
        ok(buf[25] === 3, `battle_${look}_${anim}.png: палитровый (color type 3)`);
    }
}
const manifest39 = read('assets/sprites/battle/MANIFEST_6639.txt').trim().split('\n');
ok(manifest39.length === 15, 'манифест 6639: 14 записей + итог');
ok(manifest39.filter(l => l.includes('Leyanne_MVsv_alt_')).length === 7, 'манифест: 7 листов из Leyanne_MVsv_alt');
ok(manifest39.filter(l => l.includes('LordEsther_MVsv_alt_')).length === 7, 'манифест: 7 листов из LordEsther_MVsv_alt');
ok(manifest39.filter(l => l.includes('+rim0.75')).length === 7, 'Лейанн: rim 0.75 (светлая, как Охотница)');
ok(manifest39.filter(l => l.includes('+rim0.9')).length === 7, 'Эстер: rim 0.9 (тёмная сталь, как Гаэррон)');

console.log('— 2. Бусты: полный комплект 35 —');
const bustsDir = join(game, 'assets/sprites/busts');
const bustFiles = readdirSync(bustsDir).filter(f => f.startsWith('bust_') && f.endsWith('.png'));
ok(bustFiles.length === 35, `35 бустов на диске [${bustFiles.length}]`);
['baenor', 'huntress', 'paul', 'leyanne'].forEach((h) => {
    for (let i = 1; i <= 8; i++) ok(bustFiles.includes(`bust_${h}_${i}.png`), `bust_${h}_${i}.png на месте`);
});
['bust_gaerron.png', 'bust_naia.png', 'bust_esther.png'].forEach(f => ok(bustFiles.includes(f), `${f} на месте`));
ok(existsSync(join(bustsDir, 'MANIFEST_6639.txt')), 'манифест бустов 6639 в репо');
ok(existsSync(join(game, 'tools/make_busts_6639.py')), 'tools/make_busts_6639.py в репо');
// 256×256 и палитра (первый байт IHDR)
let badBusts = 0;
for (const f of bustFiles) {
    const buf = readFileSync(join(bustsDir, f));
    if (buf.readUInt32BE(16) !== 256 || buf.readUInt32BE(20) !== 256 || buf[25] !== 3) badBusts++;
}
ok(badBusts === 0, `все бусты 256×256 палитровые [плохих: ${badBusts}]`);

console.log('— 3. heroes.js: альты обликов и варианты бустов —');
const heroes = read('src/data/heroes.js');
ok(heroes.includes("export const BATTLE_LOOK_ALT_BY_LOOK = {\n    baenor: 'esther',\n    huntress: 'leyanne',\n};"), 'карта альтов: baenor→esther, huntress→leyanne');
ok(heroes.includes("export const ALT_LOOK_NAMES"), 'имена альт-героев (ALT_LOOK_NAMES)');
ok(heroes.includes("export const BUSTS_BY_LOOK"), 'полный комплект бустов (BUSTS_BY_LOOK)');
ok(heroes.includes('export function bustVariantsFor'), 'bustVariantsFor: канон + альт-бусты');
ok(heroes.includes("'Сыщик|male': 'bust_paul_1'"), 'Сыщик|male — с портретом Пауля (66.39)');
ok(!heroes.includes("null,"), 'в BUST_BY_PRESET нет null (у всех пресетов портреты)') || ok(heroes.includes("'Сыщик|male': 'bust_paul_1'"), 'BUST_BY_PRESET полон');

console.log('— 4. Проводка: BootScene/CharacterSelection/CharacterScene/CombatScene —');
const boot = read('src/scenes/BootScene.js');
ok(boot.includes("leyanne: ['idle', 'attack1', 'attack2', 'fists', 'shoot', 'death', 'victory']"), 'BootScene: leyanne в BATTLE_LOOK_SHEETS');
ok(boot.includes("esther: ['idle', 'attack1', 'attack2', 'fists', 'shoot', 'death', 'victory']"), 'BootScene: esther в BATTLE_LOOK_SHEETS');
ok(boot.includes("['baenor', 'huntress', 'paul', 'leyanne'].flatMap"), 'BootScene: 32 буста героев ×8 + 3 единственных');
ok(/BUST_KEYS_6633\s*=\s*\[[\s\S]*bust_esther/.test(boot), 'BootScene: bust_esther в списке загрузки');
const sel = read('src/scenes/CharacterSelectionScene.js');
ok(sel.includes('cycleVariant(dir)'), 'превью: листалка cycleVariant');
ok(sel.includes("t('Портрет')"), 'превью: подпись «Портрет N/M»');
ok(sel.includes('ALT_LOOK_NAMES[v.look]'), 'превью: имя альт-героя в подписи');
ok(sel.includes('hero.bustKey = variant.bust'), 'старт игры: выбор портрета пишется в героя');
ok(sel.includes('hero.battleLookKey = variant.look'), 'старт игры: боевой облик варианта пишется в героя');
const charScene = read('src/scenes/CharacterScene.js');
ok(charScene.includes('p.bustKey || getBustFor(p.archetype, p.gender)'), 'свиток: выбранный портрет приоритетен');
const combat = read('src/scenes/CombatScene.js');
ok(combat.includes('this.player.battleLookKey'), 'бой: альт-облик из героя honored');
const i18n = read('src/systems/i18n.js');
ok(i18n.includes("'Портрет': 'Portrait'"), 'i18n: Портрет → Portrait');
ok(i18n.includes("'Эстер': 'Esther'") && i18n.includes("'Лейанн': 'Leyanne'"), 'i18n: имена альт-героев EN');

console.log('— 5. WorldLook: женщины — только платья (историчность) —');
const worldLook = read('src/systems/WorldLook.js');
ok(!worldLook.includes('trousers'), 'флаг trousers удалён');
ok(!worldLook.includes('world_f_pants') && !worldLook.includes('world_f_top'), 'женских брюк/топов в таблицах нет');
ok(!/F\s*=\s*\{[\s\S]*pants/.test(worldLook.split('const W =')[0].split('const F =')[1] || ''), 'в F нет поля pants');
// женская ветка ролла: база+платье+обувь+причёска (4 слоя, без брюк)
ok(/if \(female\) \{[\s\S]*?pick\(o\.dresses \|\| F\.dresses[\s\S]*?pick\(F\.hair, rnd\('hair'\)\),\s*\];\s*\}/.test(worldLook),
    'женская ветка: платье+обувь+причёска, брюк нет');
// мужская ветка сохранена (брюки — только у мужчин)
ok(worldLook.includes("pick(o.pants || M.pants, rnd('pants'))"), 'мужская ветка: брюки у мужчин сохранены');
// конвейеры 66.38 без женских брюк
const mk = read('tools/make_world_6638.py');
ok(!mk.includes('Medieval_TC_Female_Pants') && !mk.includes('Medieval_TC_Female_Top'),
    'make_world_6638: женские брюки/топы из выпуска удалены');
const fetcher = read('tools/drive_fetch_world_6638.py');
ok(!fetcher.includes('Medieval_T&C_Female_Pants') && !fetcher.includes('Medieval_T&C_Female_Top'),
    'drive_fetch_world_6638: женские брюки/топы не скачиваются');

console.log('— 6. Только люди (историчность, приказ 4) —');
const srcDir = join(game, 'src');
const srcFiles = [];
(function walk(d) {
    readdirSync(d, { withFileTypes: true }).forEach(e => {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) srcFiles.push(p);
    });
})(srcDir);
let nonHuman = [];
for (const f of srcFiles) {
    const txt = readFileSync(f, 'utf8');
    if (/PB_|KT_Humans|KT_Female|KT_Male|Saurial|Wolf_|_Wolf|BlackWolf/.test(txt)) nonHuman.push(f.replace(game + '/', ''));
}
ok(nonHuman.length === 0, `в коде нет PB/KT/зверо-рас: [${nonHuman.join(', ')}]`);
// жители — только человеческие паки (TC/Townfolk/Warfare/Heroes)
ok(worldLook.includes('Medieval - Heroes I') || worldLook.includes('Heroes I'), 'жители: паки людей (WorldLook)');
ok(!read('tools/make_world_6638.py').match(/(PB_|KT_)/), 'конвейер мира: только TC/Townfolk/Warfare/Heroes');

console.log('— 7. Сейвы совместимы —');
ok(worldLook.includes('npc_lpc_${npc.id}') || worldLook.includes('`npc_lpc_${npc.id}`'), 'ключи npc_lpc_<id> сохранены');
ok(worldLook.includes("'player_composite'"), 'ключ player_composite сохранён');
ok(!sel.includes('hero.bustAlt') && !sel.includes('hero.lookVariant'), 'новые поля героя — только bustKey/battleLookKey (аддитивные)');

console.log('');
console.log(`=== ИТОГ: ${pass} OK, ${fail} FAIL ===`);
if (fail > 0) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exit(1); }

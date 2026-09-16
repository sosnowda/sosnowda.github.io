// СИМУЛЯЦИЯ БОЯ С ВОРОМ — раунд 32 (п.6 спецификации владельца).
// Прогоняет ВСЕ готовые персонажи (8 пресетов) против вора по правилам
// CombatScene (BRP d100) и выдаёт отчёт: шанс победы, длина боя, выживаемость.
//
// Запуск:  bun game/tools/battle-sim.mjs [N]
// N — число боёв на персонажа/стратегию (по умолчанию 5000).
//
// Правила боя — 1:1 из CombatScene.js:
//  - игрок ходит первым;
//  - атака: skillCheck(навык оружия) → промах, или уклонение вора
//    (skillCheck(35)) → урон не проходит, иначе
//    урон = rollDamage(кубики, DB игрока, особый успех) + бонус оружия;
//    крит (1/20 навыка) ×1.5; доспех вора поглощает урон;
//  - ответ вора: skillCheck(50) → урон = rollDamage(1d6+1, DB вора) − доспех игрока;
//  - трава (1 шт. у каждого героя): лечит 3+1d6+CON/10 (используется вместо атаки).

import { skillCheck, rollDamage, ROLL_RESULT } from '../src/systems/BRPEngine.js';
import { createPresetHero, PRESET_HEROES } from '../src/systems/Character.js';
import { spawnEnemy, ENEMY_TEMPLATES } from '../src/data/characters.js';

const N = parseInt(process.argv[2] || '5000', 10);

function simulateBattle(player, thief, useHerb) {
    let rounds = 0;
    let herbLeft = 1;
    while (player.HP > 0 && thief.HP > 0 && rounds < 200) {
        rounds++;
        // --- ход игрока ---
        if (useHerb && herbLeft > 0 && player.HP <= player.HPmax * 0.4) {
            herbLeft--;
            const heal = 3 + (1 + Math.floor(Math.random() * 6)) + Math.floor(player.CON / 10);
            player.HP = Math.min(player.HPmax, player.HP + heal);
        } else {
            const w = player.weapon;
            const skill = player.skills[w.skill] || 20;
            const res = skillCheck(skill);
            if (res.result !== ROLL_RESULT.FAIL && res.result !== ROLL_RESULT.FUMBLE) {
                const dodgeRes = skillCheck(thief.skills.dodge);
                if (dodgeRes.result !== ROLL_RESULT.SUCCESS && dodgeRes.result !== ROLL_RESULT.CRITICAL) {
                    let dmg = rollDamage(w.dice, player.DB, res.special);
                    dmg += (w.bonus || 0);
                    const isCrit = res.result === ROLL_RESULT.CRITICAL;
                    if (isCrit) dmg = Math.ceil(dmg * 1.5);
                    const def = thief.armor ? thief.armor.def : 0;
                    thief.HP = Math.max(0, thief.HP - Math.max(0, dmg - def));
                }
            }
        }
        if (thief.HP <= 0) break;
        // --- ответ вора ---
        const res = skillCheck(thief.attackSkill);
        if (res.result !== ROLL_RESULT.FAIL && res.result !== ROLL_RESULT.FUMBLE) {
            const dmg = rollDamage(thief.weapon.dice, thief.DB, res.special);
            const def = player.armor ? player.armor.def : 0;
            player.HP = Math.max(0, player.HP - Math.max(0, dmg - def));
        }
    }
    return { playerWon: thief.HP <= 0 && player.HP > 0, rounds, hpLeft: player.HP, hpLeftThief: thief.HP };
}

function run(heroId, useHerb) {
    let wins = 0, losses = 0, totalRounds = 0, totalHpLeft = 0, totalRoundsWon = 0;
    for (let i = 0; i < N; i++) {
        const player = createPresetHero(heroId, PRESET_HEROES.find(h => h.id === heroId).name);
        const thief = spawnEnemy('thief');
        const r = simulateBattle(player, thief, useHerb);
        if (r.playerWon) { wins++; totalRoundsWon += r.rounds; totalHpLeft += r.hpLeft; }
        else { losses++; totalRounds += r.rounds; }
    }
    return {
        winRate: (100 * wins / N).toFixed(1),
        lossRate: (100 * losses / N).toFixed(1),
        avgRoundsWon: wins ? (totalRoundsWon / wins).toFixed(1) : '—',
        avgHpLeft: wins ? (totalHpLeft / wins).toFixed(1) : '—',
    };
}

console.log(`\n=== ОТЧЁТ СИМУЛЯЦИИ БОЯ С ВОРОМ (раунд 32, п.6) ===`);
console.log(`Боёв на вариант: ${N}. Вор: HP ${spawnEnemy('thief').HP}, атака ${ENEMY_TEMPLATES.thief.attackSkill}%, ` +
    `уклонение ${ENEMY_TEMPLATES.thief.dodge}%, броня "${ENEMY_TEMPLATES.thief.armorId}", ${ENEMY_TEMPLATES.thief.weapon.name} 1d6+1\n`);

const rows = [];
for (const hero of PRESET_HEROES) {
    const plain = run(hero.id, false);
    const smart = run(hero.id, true);
    rows.push({ hero, plain, smart });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('Персонаж', 24) + pad('Архетип', 14) +
    pad('Побед% (чистая атака)', 22) + pad('Раундов', 9) + pad('HP ост.', 9) + ' | ' +
    pad('Побед% (атака+трава)', 21) + pad('Раундов', 9) + pad('HP ост.', 9));
for (const r of rows) {
    console.log(
        pad(`${r.hero.name}`, 24) + pad(`${r.hero.archetype}`, 14) +
        pad(r.plain.winRate, 22) + pad(r.plain.avgRoundsWon, 9) + pad(r.plain.avgHpLeft, 9) + ' | ' +
        pad(r.smart.winRate, 21) + pad(r.smart.avgRoundsWon, 9) + pad(r.smart.avgHpLeft, 9));
}

console.log('\nПримечания:');
console.log('- «Чистая атака» — герой только бьёт; «атака+трава» — пьёт целебную траву (1 шт.) при HP < 40%.');
console.log('- Благословение батюшки (+10 к одной проверке) и уклон в расчёт не берутся — они только улучшают шансы игрока.');
console.log('- По п.7: вор должен быть убиваем ЛЮБЫМ персонажем, но воину — НАМНОГО легче; по п.8 — у вора всегда есть шансы убить игрока (см. столбец поражений).');

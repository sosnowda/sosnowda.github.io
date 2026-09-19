// СИМУЛЯЦИЯ ПОЛНОЙ ПОГОНИ ЗА ВОРОМ — раунд 58 (п.3 приказа владельца).
//
// Прогоняет полные сеансы охоты на вора НАСТОЯЩЕЙ логикой игры
// (data/thief.js: маршруты, следы, наводки, заморозки, побег) + боем
// по правилам CombatScene (BRP d100, 1:1 с tools/battle-sim.mjs).
//
// Цели (п.3 приказа): измерить, насколько легко найти вора и пройти игру
// или проиграть; понять, какая нужна балансировка — сложность боя или
// время убегания/остановок вора.
//
// Запуск:  bun game/tools/chase-sim.mjs [N]
// N — сеансов на стратегию (по умолчанию 3000).

import { skillCheck, rollDamage, ROLL_RESULT, opposedSkillCheck } from '../src/systems/BRPEngine.js';
import { createPresetHero, PRESET_HEROES } from '../src/systems/Character.js';
import { spawnEnemy } from '../src/data/characters.js';
import { ARMORS } from '../src/systems/Character.js';
import {
    initThiefHunt, searchLocation, askNPC, isThiefAt, isChaseActive,
    chaseHoursLeft, thiefChaseTick,
} from '../src/data/thief.js';
import { initNpcNames, getNpcs } from '../src/data/npcNames.js';
import { tickTime } from '../src/systems/TimeSystem.js';
import { CHASE_LOCATIONS, TRAVEL_COST } from '../src/data/thief.js';

const N = parseInt(process.argv[2] || '3000', 10);

// ============================================================
// Мок-реестр (get/set, как Phaser registry)
// ============================================================
function makeRegistry() {
    const m = new Map();
    return { get: (k) => m.get(k), set: (k, v) => m.set(k, v) };
}

// ============================================================
// БОЙ С ВОРОМ — правила 1:1 из CombatScene (см. tools/battle-sim.mjs)
// ============================================================
function simulateBattle(player, thief, useHerb) {
    let rounds = 0;
    let herbLeft = useHerb ? 1 : 0;
    while (player.HP > 0 && thief.HP > 0 && rounds < 200) {
        rounds++;
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
        const res = skillCheck(thief.attackSkill);
        if (res.result !== ROLL_RESULT.FAIL && res.result !== ROLL_RESULT.FUMBLE) {
            const dmg = rollDamage(thief.weapon.dice, thief.DB, res.special);
            const def = player.armor ? player.armor.def : 0;
            player.HP = Math.max(0, player.HP - Math.max(0, dmg - def));
        }
    }
    return { playerWon: thief.HP <= 0 && player.HP > 0, rounds, hpLeft: player.HP };
}

// ============================================================
// СЕАНС ОХОТЫ
// ============================================================

/** Лучшее действие при встрече: убеждение / оглушение / бой. */
function chooseEncounterAction(hero) {
    const persuade = Math.max(hero.skills.persuade || 0, 35);  // MIN_PERSUADE
    const brawl = Math.max(hero.skills.brawl || 0, 35);        // MIN_BRAWL
    const weapon = hero.skills[hero.weapon.skill] || 20;
    // Приоритет по ожидаемой силе: навык против 50+сложность
    if (persuade >= brawl && persuade >= weapon) return 'persuade';
    if (brawl >= weapon) return 'stun';
    return 'fight';
}

/**
 * Один сеанс погони.
 * @param {string} presetId - пресет героя
 * @param {string} strategy - 'blind' | 'ask' | 'tracker'
 * @param {number} talkMinutes - цена разговора (60 = старая экономика, 10 = новая)
 */
function runSession(presetId, strategy, talkMinutes) {
    const registry = makeRegistry();
    initNpcNames(registry);
    const hero = createPresetHero(presetId);
    hero.armor = ARMORS[hero.armorId || 'none'] || ARMORS.none;
    registry.set('player', hero);
    registry.set('quest', { villageName: 'Симулятор' });
    initThiefHunt(registry);

    const stats = {
        outcome: '',           // 'win' | 'escaped' | 'died'
        minutes: 0,            // игрового времени потрачено
        talks: 0, searches: 0, travels: 0, encounters: 0,
        retreats: 0, fightRounds: 0, hpLeft: hero.HPmax,
        firstEncounterHour: 0,
    };
    let retreatPending = false;   // после побега игрок в Деревне (п.12)
    let thiefHpCarry = null;      // п.11: вор НЕ лечится между боями
    let lastEncounterLoc = null;  // где произошла встреча (для возврата)
    const spend = (min) => { tickTime(registry, min); stats.minutes += min; };
    const adults = getNpcs(registry).filter(n => (n.age || 30) >= 18).map(n => n.id);

    // Прочитанное направление следа / наводка селян
    let lead = null;          // locId, куда идти по информации

    const askedFrom = () => registry.get('quest').thiefAskedFrom || [];
    const unsearched = () => CHASE_LOCATIONS.filter(id =>
        !(registry.get('quest').locationsSearched || []).includes(id));

    // --- главный цикл действий игрока ---
    let guard = 0;
    while (guard++ < 400) {
        const q = registry.get('quest');
        if (q.thiefEscaped) { stats.outcome = 'escaped'; break; }
        if (q.thiefDefeated) { stats.outcome = 'win'; break; }
        if (hero.HP <= 0) { stats.outcome = 'died'; break; }
        if (!isChaseActive(registry)) { stats.outcome = q.thiefDefeated ? 'win' : 'escaped'; break; }

        // 1) Куда идти?
        let dest = null;
        if (retreatPending) {
            // Раунд 32 (п.12): после побега игрока переносит в Деревню —
            // возвращаемся к месту боя (дорога за TRAVEL_COST часов)
            dest = lastEncounterLoc;
            retreatPending = false;
        }
        if (!dest && strategy === 'ask') {
            if (!lead) {
                // Расспросить следующего непросрошенного взрослого
                const next = adults.find(id => !askedFrom().includes(id));
                if (next) {
                    spend(talkMinutes);          // беседа (раунд 58: 10 минут)
                    stats.talks++;
                    const r = askNPC(registry, next, 'Селянин');
                    if (r.gotClue && r.locId) lead = r.locId;
                    // askNPC возвращает locId внутри quest.npcHint
                    const hint = registry.get('quest').npcHint;
                    if (hint && hint.locId && !hint.broken) lead = hint.locId;
                    continue;
                }
                // Все опрошены — ищем вслепую, как «tracker»
            }
        }
        if (!dest && lead) dest = lead;
        if (!dest) {
            const pool = unsearched();
            if (strategy === 'blind') {
                dest = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
            } else {
                dest = pool.length ? pool[0] : null; // tracker/ask: по порядку
            }
        }
        if (!dest) {
            // Всё обыскано, живых свидетелей нет — блуждание по ближайшим
            dest = CHASE_LOCATIONS[Math.floor(Math.random() * CHASE_LOCATIONS.length)];
        }

        // 2) Дорога (TRAVEL_COST — в часах: ближние 1, дальние 2)
        const travelHours = TRAVEL_COST[dest] || 1;
        spend(travelHours * 60);
        stats.travels++;
        lead = null; // информацию израсходовали дорогой

        // 3) Встреча на arrival: вор виден сразу (LocationScene, раунд 21)
        if (isThiefAt(registry, dest)) {
            lastEncounterLoc = dest;
            const enc = runEncounter(registry, hero, stats, (r) => { retreatPending = r; thiefHpCarry = thiefHpCarry; });
            if (enc === 'retreat') {
                // Побег: 30 минут + вор сидит 3 часа (thiefFleesFromFight 1:1)
                spend(30);
                stats.retreats++;
                const q2 = registry.get('quest');
                const c2 = q2.chase;
                if (c2) { c2.phase = 'stay'; c2.ticksLeft = 3; registry.set('quest', q2); }
                thiefHpCarry = lastThiefHp;
                retreatPending = true;
                continue;
            }
            if (enc !== 'continue') break;          // win/escaped/died
            continue;
        }

        // 4) Обследование следов (60 минут внутри searchLocation)
        const r = searchLocation(registry, dest);
        stats.searches++;
        if (r.thiefEscaped) { stats.outcome = 'escaped'; break; }
        if (r.thiefNearby) {
            // Следы свежайшие — вор здесь, но searchLocation уже потратил час
            // и вор мог двинуться: проверяем ещё раз (как сцена после поиска)
            if (isThiefAt(registry, dest)) {
                lastEncounterLoc = dest;
                const enc = runEncounter(registry, hero, stats, () => {});
                if (enc === 'retreat') {
                    spend(30);
                    stats.retreats++;
                    const q2 = registry.get('quest');
                    const c2 = q2.chase;
                    if (c2) { c2.phase = 'stay'; c2.ticksLeft = 3; registry.set('quest', q2); }
                    thiefHpCarry = lastThiefHp;
                    retreatPending = true;
                    continue;
                }
                if (enc !== 'continue') break;
            }
            continue;
        }
        if (r.found && r.direction) lead = r.direction;
    }

    if (!stats.outcome) stats.outcome = registry.get('quest').thiefDefeated ? 'win' : 'escaped';
    stats.hpLeft = Math.max(0, hero.HP);
    stats.hours = +(stats.minutes / 60).toFixed(1);
    stats.firstEncounterHour = +(stats.firstEncounterHour / 60).toFixed(1);
    return stats;
}

/** HP вора после боя (п.11: вор не лечится между боями). */
let lastThiefHp = null;

/**
 * Встреча с вором: лучшее действие героя.
 * Возвращает 'win' | 'escaped' | 'died' | 'continue' | 'retreat'.
 */
function runEncounter(registry, hero, stats) {
    stats.encounters++;
    if (!stats.firstEncounterHour) stats.firstEncounterHour = stats.minutes;
    const q = registry.get('quest');
    const action = chooseEncounterAction(hero);

    if (action === 'persuade') {
        const r = persuade(registry);
        if (r.win) { stats.outcome = 'win'; return 'win'; }
        if (r.escaped) { stats.outcome = 'escaped'; return 'escaped'; }
        return 'continue';
    }
    if (action === 'stun') {
        const r = stun(registry, hero);
        if (r.win) { stats.outcome = 'win'; return 'win'; }
        if (r.escaped) { stats.outcome = 'escaped'; return 'escaped'; }
        return 'continue';
    }
    // Бой (вор входит с СОХРАНЁННЫМ HP, если уже дрался — п.11)
    const thief = spawnEnemy('thief');
    if (lastThiefHp != null) thief.HP = Math.max(1, lastThiefHp);
    const battle = simulateBattle(hero, thief, true); // трава есть у каждого героя
    stats.fightRounds += battle.rounds;
    hero.HP = battle.hpLeft;
    lastThiefHp = thief.HP; // вор лечится только если убит — а убит значит бой окончен
    if (hero.HP <= 0) { stats.outcome = 'died'; return 'died'; }
    if (battle.playerWon) {
        q.thiefDefeated = 'killed';
        registry.set('quest', q);
        stats.outcome = 'win';
        return 'win';
    }
    // Игрок выжил, вор жив — игрок пытается сбежать (dodge-проверка, 1:1 CombatScene)
    const dodge = skillCheck(hero.skills.dodge || 25);
    return dodge.result === ROLL_RESULT.FAIL || dodge.result === ROLL_RESULT.FUMBLE
        ? 'continue'   // не удалось убежать — враг атакует снова (следующий заход)
        : 'retreat';
}

// Обёртки над честными проверками из thief.js (persuadeThief/stunThief
// вызывают createDialog только при провале сцены? нет — они чистые;
// но для простоты повторяем их проверки локально, 1:1 с thief.js)
function persuade(registry) {
    const hero = registry.get('player');
    const persuadeSkill = Math.max((hero.skills && hero.skills.persuade) || 20, 35);
    const res = opposedSkillCheck(persuadeSkill, 50, 10);
    if (res.result === 'critical' || res.result === 'success') return { win: true };
    // вор бежит: с последней локации — прочь
    const q = registry.get('quest');
    const c = q.chase;
    if (!c) return { escaped: true };
    if (c.stop >= c.route.length - 1) return { escaped: true };
    return { escaped: false };
}

function stun(registry, hero) {
    const brawlSkill = Math.max((hero.skills && hero.skills.brawl) || 25, 35);
    const res = opposedSkillCheck(brawlSkill, 50, 0);
    if (res.result === 'critical' || res.result === 'success') return { win: true };
    const q = registry.get('quest');
    const c = q.chase;
    if (!c) return { escaped: true };
    if (c.stop >= c.route.length - 1) return { escaped: true };
    return { escaped: false };
}

// ============================================================
// БАЗА «вор уходит сам»: сколько часов у игрока без всяких действий
// ============================================================
function runIdleSession() {
    const registry = makeRegistry();
    initNpcNames(registry);
    registry.set('player', createPresetHero('ranger_m'));
    registry.set('quest', { villageName: 'Симулятор' });
    initThiefHunt(registry);
    let minutes = 0;
    while (!registry.get('quest').thiefEscaped && minutes < 72 * 60) {
        thiefChaseTick(registry, 60);
        minutes += 60;
    }
    return minutes / 60;
}

// ============================================================
// ПРОГОН И ОТЧЁТ
// ============================================================
function summarize(rows) {
    const n = rows.length;
    const wins = rows.filter(r => r.outcome === 'win').length;
    const died = rows.filter(r => r.outcome === 'died').length;
    const esc = rows.filter(r => r.outcome === 'escaped').length;
    const avg = (f) => rows.reduce((a, r) => a + (r[f] || 0), 0) / n;
    return {
        winRate: (100 * wins / n).toFixed(1),
        diedRate: (100 * died / n).toFixed(1),
        escRate: (100 * esc / n).toFixed(1),
        hours: avg('hours').toFixed(1),
        talks: avg('talks').toFixed(1),
        searches: avg('searches').toFixed(1),
        travels: avg('travels').toFixed(1),
        encounters: avg('encounters').toFixed(2),
        fightRounds: avg('fightRounds').toFixed(1),
        retreats: avg('retreats').toFixed(2),
    };
}

console.log(`=== СИМУЛЯЦИЯ ПОГОНИ (N=${N} сеансов на строку) ===\n`);

const idleHours = runIdleSession();
const idleRows = [];
for (let i = 0; i < 300; i++) idleRows.push(runIdleSession());
const idleAvg = idleRows.reduce((a, b) => a + b, 0) / idleRows.length;
console.log(`БАЗА (игрок бездействует): вор уходит в среднем за ${idleAvg.toFixed(1)} ч (min ${(Math.min(...idleRows)).toFixed(0)}, max ${(Math.max(...idleRows)).toFixed(0)})\n`);

const strategies = [
    ['blind', 'Слепой поиск (случайные локации)'],
    ['tracker', 'Следопыт (по порядку + по следам)'],
    ['ask', 'Расспрос селян + наводки'],
];
const presets = PRESET_HEROES.map(h => h.id);
const talkCosts = [10, 60];

console.log('стратегия'.padEnd(36) + 'герой'.padEnd(12) + 'беседа'.padEnd(8)
    + 'победа%'.padStart(8) + 'бегств%'.padStart(8) + 'смерт%'.padStart(7)
    + 'часов'.padStart(7) + 'бесед'.padStart(6) + 'поиск'.padStart(6) + 'боёв'.padStart(6));

for (const [strat, label] of strategies) {
    for (const talk of talkCosts) {
        for (const pid of presets) {
            const rows = [];
            for (let i = 0; i < N; i++) rows.push(runSession(pid, strat, talk));
            const s = summarize(rows);
            const name = (strat === 'blind' && talk === 60) ? label : label.split(' ')[0];
            if (pid === presets[0]) {
                console.log(`${label + (talk === 10 ? ' [10мин]' : ' [старая 60мин]')}`.padEnd(36)
                    + `${pid}`.padEnd(12)
                    + `${talk}м`.padEnd(8)
                    + `${s.winRate}`.padStart(8) + `${s.escRate}`.padStart(8) + `${s.diedRate}`.padStart(7)
                    + `${s.hours}`.padStart(7) + `${s.talks}`.padStart(6) + `${s.searches}`.padStart(6) + `${s.encounters}`.padStart(6));
            } else {
                console.log(''.padEnd(36) + `${pid}`.padEnd(12) + `${talk}м`.padEnd(8)
                    + `${s.winRate}`.padStart(8) + `${s.escRate}`.padStart(8) + `${s.diedRate}`.padStart(7)
                    + `${s.hours}`.padStart(7) + `${s.talks}`.padStart(6) + `${s.searches}`.padStart(6) + `${s.encounters}`.padStart(6));
            }
        }
        console.log('');
    }
}
console.log('Готово.');

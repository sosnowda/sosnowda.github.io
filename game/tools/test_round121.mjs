// test_round121.mjs — 66.73: ПРИКАЗЫ ВЛАДЕЛЬЦА 1–16 (голод-часы, усталость,
// молитва 8 ч, торг, печь, харизма, трофеи, несъедобное, двойной клик):
//  1\ Голод — ЧАСЫ: весовые активности (сон ×0.4 < быт ×1 < ходьба ×1.5 <
//     работа ×1.75 < охота ×2 < бой ×2.5); еда сбрасывает часы;
//  2\ Голод > 24 ч: −1 HP за очередные сутки (накапливается), HP ≥ 1;
//  3\ Голод > 48 ч: −1% ВСЕМ навыкам за каждые полные 24 часа (накапливается);
//     применяется в getBlessedSkill И в проверках loot.js;
//  4\ Усталость (BRP SRD «Очки усталости»): максимум = СИЛ+ТЕЛ; −1 ОУ за
//     боевой раунд/переход/охоту/труд; < 0 — штраф −1%/пункт всем проверкам;
//     изнеможение блокирует охоту/сбор; отдых возвращает полный запас;
//  5\ Молитва: благословение +5 к одной проверке сгорает через 8 часов;
//  6\ Торг: встречная проверка Убеждения, множители 1.25/1.5/0.9/1,
//     одна попытка на торговца в сутки, сброс на следующий день;
//  7\ Печь постоялого двора: готовка сырого (механика cookAtFire) + кнопка;
//  8\ Харизма: встречная проверка ХАР игрока vs ХАР НПЦ при начале диалога,
//     модификатор ±5/±10 к разговорным проверкам, снимается в конце беседы;
//  9\ Трофеи: критическая удача при разделке волка/косули даёт ценный лут
//     (клыки 8 д., рога 10 д.) на продажу;
// 10\ Несъедобное: сырые грибы/мясо/рыба — поп-ап «Еда не пригодна в пищу!»;
// 11\ «Двойной клик»: НПЦ-обработчики на pointerup, grace-период в createDialog.
// Запуск из корня репозитория: node game/tools/test_round121.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

function makeRegistry(hour = 9, minute = 30, day = 14) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day, hour, minute });
    reg.set('player', {
        HP: 12, HPmax: 12, STR: 60, CON: 60, CHA: 55,
        skills: { survival: 50, cooking: 40, persuade: 50, fast_talk: 45, intimidate: 40 },
        inventory: [],
    });
    return reg;
}
function setTime(reg, hour, minute, day = 14) {
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day, hour, minute });
}
const realRandom = Math.random;
function rollOnce(v) { Math.random = () => v; }
// Для ВСТРЕЧНЫХ проверок (торг/харизма): бросают ОБЕ стороны —
// подаём последовательность: [бросок игрока, бросок НПЦ, …]
function rollSeq(list) { let i = 0; Math.random = () => list[Math.min(i++, list.length - 1)]; }
function restoreRandom() { Math.random = realRandom; }

// ---------- Импорты ----------
const {
    HUNGER_RATES, hungerRateOf, hungerHours, hungerStatus, noteHungerMeal,
    noteHungerTick, hungerSkillPenalty, hungerStatusLine, applyHungerHPPenalty,
    HUNGER_HP_AFTER_H, HUNGER_SKILL_AFTER_H,
} = await import(join(ROOT, 'game/src/systems/hunger.js'));
const {
    fatigueMaxOf, fatigueOf, spendFatigue, restFatigueFull, fatigueSkillMod,
    isExhausted, combatExhaustionPenalty, fatigueStatusLine,
} = await import(join(ROOT, 'game/src/systems/fatigue.js'));
const {
    registerPrayer, consumePrayerBless, PRAYER_BLESS_DURATION_MIN, isPrayerBlessActive,
} = await import(join(ROOT, 'game/src/systems/prayer.js'));
const {
    attemptHaggle, canHaggleToday, haggleMultFor, haggleHintLine,
    HAGGLE_SUCCESS_MULT, HAGGLE_CRITICAL_MULT, HAGGLE_FUMBLE_MULT,
} = await import(join(ROOT, 'game/src/systems/trade.js'));
const {
    rollCharismaEdge, clearChaEdge, getChaEdgeMod, getChaEdgeLine, chaAdjustedTalkSkill,
    CHA_EDGE_MAX, CHA_EDGE_SUCCESS, CHA_EDGE_FAIL, CHA_EDGE_FUMBLE,
} = await import(join(ROOT, 'game/src/systems/charisma.js'));
const { getBlessedSkill } = await import(join(ROOT, 'game/src/data/questGenerator.js'));
const { survivalButcher, getLootDef, countOf, tryEatFood } = await import(join(ROOT, 'game/src/systems/loot.js'));
const { tickTime } = await import(join(ROOT, 'game/src/systems/TimeSystem.js'));
const { worldAbsMinutes } = await import(join(ROOT, 'game/src/systems/meal.js'));

console.log('\n— 1. Голод: весовые активности (приказы 3,4) —');
ok(HUNGER_RATES.sleep < 1, 'во сне голод копится МЕДЛЕННЕЕ (×' + HUNGER_RATES.sleep + ')');
ok(HUNGER_RATES.combat > HUNGER_RATES.hunt && HUNGER_RATES.hunt > HUNGER_RATES.walk && HUNGER_RATES.walk > HUNGER_RATES.idle,
    'лестница нагрузки: бой > охота > ходьба > быт');
{
    const reg = makeRegistry();
    noteHungerTick(reg, 60, 'sleep');
    ok(Math.abs(hungerHours(reg) - 0.4) < 1e-9, '60 мин сна → 0.4 ч голода');
    noteHungerTick(reg, 60, 'combat');
    ok(Math.abs(hungerHours(reg) - 2.9) < 1e-9, '+60 мин боя → 2.9 ч (×2.5)');
    tickTime(reg, 60, 'walk');
    ok(Math.abs(hungerHours(reg) - 4.4) < 1e-9, 'tickTime(60, walk) → 4.4 ч (интеграция TimeSystem)');
}
{
    const reg = makeRegistry();
    tickTime(reg, 300, 'sleep');
    ok(Math.abs(hungerHours(reg) - 2) < 1e-9, '5 ч сна → 2 ч голода (медленнее быта: было бы 5)');
}

console.log('\n— 2. Голод > 24 ч: −1 HP (приказ 6) —');
{
    const reg = makeRegistry();
    noteHungerTick(reg, 1440, 'idle');
    ok(reg.get('player').HP === 11, '24 ч без еды: HP 12→11 (−1)');
    noteHungerTick(reg, 1440, 'idle');
    ok(reg.get('player').HP === 10, '48 ч: ещё −1 (накапливается)');
    ok(reg.get('player').HP >= 1, 'HP ≥ 1 — голод изнуряет, но не убивает');
    noteHungerMeal(reg);
    ok(hungerHours(reg) === 0, 'еда сбрасывает часы голода');
    noteHungerTick(reg, 1439, 'idle');
    ok(reg.get('player').HP === 10, '23 ч 59 мин — до границы HP не трогает');
}

console.log('\n— 3. Голод > 48 ч: навыки −1% за 24 ч (приказ 7) —');
{
    const reg = makeRegistry();
    noteHungerTick(reg, 1440 * 2, 'idle');
    ok(hungerSkillPenalty(reg) === 1, '48 ч: штраф 1%');
    noteHungerTick(reg, 1440, 'idle');
    ok(hungerSkillPenalty(reg) === 2, '72 ч: штраф 2%');
    const blessed = getBlessedSkill(reg, 50);
    ok(blessed === 48, `getBlessedSkill применяет голод: 50 − 2 = ${blessed}`);
    noteHungerMeal(reg);
    ok(getBlessedSkill(reg, 50) === 50, 'после еды навыки восстановились');
}

console.log('\n— 4. Усталость: BRP SRD ОУ (приказ 14) —');
ok(fatigueMaxOf({ STR: 60, CON: 60 }) === 120, 'максимум ОУ = СИЛ + ТЕЛ (60+60=120)');
{
    const reg = makeRegistry();
    spendFatigue(reg, 5);
    ok(fatigueOf(reg).value === 115, 'боевой раунд/переход: −1..N ОУ');
    ok(fatigueSkillMod(reg) === 0, 'при положительных ОУ штрафа нет');
    spendFatigue(reg, 130);
    const v = fatigueOf(reg).value;
    ok(v === -15, 'ОУ уходят в минус (115−130 = −15)');
    ok(fatigueSkillMod(reg) === -15, 'штраф −1% за отрицательный пункт (BRP SRD)');
    ok(getBlessedSkill(reg, 50) === 35, 'getBlessedSkill: 50 + (−15) = 35');
    ok(!isExhausted(reg), '−15 при максимуме 120 — ещё не изнеможение');
    spendFatigue(reg, 200);
    ok(isExhausted(reg), 'ОУ ≤ −максимум — изнеможение (BRP: недееспособен)');
    ok(combatExhaustionPenalty(reg) > 0, 'в бою — мягкая адаптация: штраф удару');
    restFatigueFull(reg);
    ok(fatigueOf(reg).value === 120, 'отдых восстанавливает полный запас (BRP: ~20 мин покоя)');
}
{
    // Интеграция трат в сценах (статика)
    const combat = read('game/src/scenes/CombatScene.js');
    ok(combat.includes('spendFatigue(this.registry, 1)'), 'боевой раунд стоит 1 ОУ (CombatScene)');
    const loc = read('game/src/scenes/LocationScene.js');
    ok(loc.includes("spendFatigue(this.registry, 1)"), 'переходы по карте/охота тратят ОУ (LocationScene)');
    ok(loc.includes('exhaustedGuardPopup'), 'гард изнеможения: охота/рыбалка недоступны');
    const inter = read('game/src/scenes/InteriorScene.js');
    ok(inter.includes('restFatigueFull(this.registry)'), 'сон на постоялом дворе восстанавливает ОУ');
}

console.log('\n— 5. Молитва: благословение живёт 8 часов (приказ 9) —');
ok(PRAYER_BLESS_DURATION_MIN === 480, 'срок жизни благословения = 480 мин (8 ч)');
{
    const reg = makeRegistry();
    registerPrayer(reg);
    ok(isPrayerBlessActive(reg), 'после молитвы благословение активно');
    ok(consumePrayerBless(reg) === 5, '+5 к первой проверке');
    ok(consumePrayerBless(reg) === 0, 'и списывается этой проверкой');
    registerPrayer(reg);
    setTime(reg, 17, 30, 14); // +8 часов ровно
    ok(isPrayerBlessActive(reg), 'ровно через 8 ч — ещё действует (граница включительно)');
    setTime(reg, 18, 30, 14); // +9 часов
    ok(!isPrayerBlessActive(reg), 'спустя 9 ч — просрочено');
    ok(consumePrayerBless(reg) === 0, 'просроченное благословение НЕ даёт бонус');
}

console.log('\n— 6. Торг (приказ 5) —');
ok(HAGGLE_SUCCESS_MULT === 1.25 && HAGGLE_CRITICAL_MULT === 1.5 && HAGGLE_FUMBLE_MULT === 0.9,
    'множители: успех +25%, крит +50%, fumble −10%');
{
    const reg = makeRegistry();
    ok(canHaggleToday(reg, 'tavernkeeper'), 'первая попытка за день доступна');
    ok(haggleMultFor(reg, 'tavernkeeper') === 1, 'без торга множитель 1');
    // Крит: игрок бросает 1 (0.0001), НПЦ бросает 61 (0.6)
    rollSeq([0.0001, 0.6]);
    const res = attemptHaggle(reg, 'tavernkeeper', 50);
    restoreRandom();
    ok(res.done && res.mult === HAGGLE_CRITICAL_MULT, `крит торга: множитель ${res.mult}`);
    ok(res.checkLine.length > 0, 'в отчёте видна встречная проверка');
    ok(!canHaggleToday(reg, 'tavernkeeper'), 'повторная попытка в тот же день закрыта');
    const again = attemptHaggle(reg, 'tavernkeeper', 50);
    ok(!again.done && again.mult === res.mult, 'повтор — отказ, множитель прежний');
    // Суточный сброс
    setTime(reg, 9, 30, 15);
    ok(canHaggleToday(reg, 'tavernkeeper'), 'новый день — торг снова доступен');
    ok(haggleMultFor(reg, 'tavernkeeper') === 1, 'множитель сброшен на новый день');
    // fumble
    // fumble: игрок 96+ при навыке < 50 (0.99 → d100=100 → fumble при навыке 20)
    rollSeq([0.99, 0.4]);
    const bad = attemptHaggle(reg, 'butcher', 20);
    restoreRandom();
    ok(bad.done && bad.mult === HAGGLE_FUMBLE_MULT, `fumble торга: множитель ${bad.mult}`);
    ok(haggleHintLine(reg, 'butcher').includes('−10%'), 'подсказка в меню говорит о −10%');
}

console.log('\n— 7. Печь постоялого двора (приказ 8) —');
{
    const inter = read('game/src/scenes/InteriorScene.js');
    ok(inter.includes('Печь (Готовка)'), 'кнопка «🔥 Печь (Готовка)» в панели постоялого двора');
    ok(inter.includes('showStoveCookMenu') && inter.includes('cookAtStove'), 'меню печи + готовка на печи');
    ok(inter.includes("cookAtFire(this.registry, player, rawId, { skill: player.skills.cooking })"),
        'печь использует ЕДИНУЮ механику cookAtFire (Готовка: провал — пропало, крит — +1)');
    // сквозная проверка: сырьё → блюдо на печи (крит)
    const reg = makeRegistry();
    const player = reg.get('player');
    player.inventory.push({ id: 'meat_raw', name: 'Мясо (сырое)', count: 1, type: 'loot' });
    rollOnce(0.0001);
    const cooked = await import(join(ROOT, 'game/src/systems/loot.js')).then(m => m.cookAtFire(reg, player, 'meat_raw', { skill: 50 }));
    restoreRandom();
    ok(cooked.ok && cooked.crit && countOf(player, 'meat_cooked_tasty') === 1, 'крит готовки в печи: жаркое «удалось на славу»');
}

console.log('\n— 8. Харизма при диалогах (приказ 16) —');
ok(CHA_EDGE_MAX === 10 && CHA_EDGE_SUCCESS === 5 && CHA_EDGE_FAIL === -5 && CHA_EDGE_FUMBLE === -10,
    'модификаторы: крит +10, успех +5, провал −5, fumble −10');
{
    const reg = makeRegistry();
    // игрок бросает 1 (крит), НПЦ (староста, ХАР 60) бросает 61 — не крит
    rollSeq([0.0001, 0.6]);
    const edge = rollCharismaEdge(reg, 'elder');
    restoreRandom();
    ok(edge && edge.mod === CHA_EDGE_MAX, `ХАР 55 против 60, бросок 1 → крит беседы (+10)`);
    ok(getChaEdgeLine(reg) !== null, 'строка проверки видна в первом узле беседы');
    ok(chaAdjustedTalkSkill(reg, 45) === 55, 'разговорный навык получает +10');
    // Диалог-раннер: интеграция
    const dr = read('game/src/systems/DialogueRunner.js');
    ok(dr.includes('rollCharismaEdge(this.scene.registry, this.scene.activeNpc.id)'), 'бросок при начале КАЖДОЙ беседы (DialogueRunner.run/_node)');
    ok(dr.includes('clearChaEdge(this.scene.registry)'), 'модификатор снимается в конце беседы (_finish)');
    clearChaEdge(reg);
    ok(getChaEdgeMod(reg) === 0, 'вне беседы модификатор 0');
}

console.log('\n— 9. Трофеи при критическом разделке (приказ 13) —');
{
    const fangs = getLootDef('wolf_fangs');
    const antlers = getLootDef('roe_antlers');
    ok(fangs && fangs.sell === 8 && fangs.trophy, 'волчьи клыки — товар 8 д.');
    ok(antlers && antlers.sell === 10 && antlers.trophy, 'рога косули — товар 10 д.');
    ok(read('game/src/data/forest.js').includes("trophy: 'roe_antlers'"), 'у косули в конфиге есть трофей');
    const reg = makeRegistry();
    const player = reg.get('player');
    rollOnce(0.0001);
    const critRes = survivalButcher(reg, player, [5, 9], true, { skill: 50, trophy: 'wolf_fangs' }, () => 0.5);
    restoreRandom();
    ok(critRes.crit && critRes.trophy === 1 && countOf(player, 'wolf_fangs') === 1, 'крит разделки волка: клыки в узле');
    const reg2 = makeRegistry();
    rollOnce(0.5);
    const plain = survivalButcher(reg2, reg2.get('player'), [5, 9], true, { skill: 60, trophy: 'wolf_fangs' }, () => 0.5);
    restoreRandom();
    ok(!plain.crit && plain.trophy === 0, 'обычный успех — без трофея');
}

console.log('\n— 10. Несъедобное (приказ 12) —');
{
    const loot = read('game/src/systems/loot.js');
    ok(loot.includes('⚠ Еда не пригодна в пищу!'), 'ДОСЛОВНЫЙ текст поп-апа владельца');
    ok(loot.includes("reason: 'not_edible'"), 'попытка съесть сырое — отказ not_edible');
    const i18n = read('game/src/systems/i18n.js');
    ok(i18n.includes('The food is not fit to eat!'), 'EN-перевод поп-апа на месте');
}

console.log('\n— 11. «Двойной клик» исправлен (приказ 1) —');
{
    const ui = read('game/src/utils/ui.js');
    ok(ui.includes('DIALOG_INPUT_GRACE_MS'), 'grace-период ввода в createDialog');
    ok(ui.includes('if (!inputGraceOk()) return;') && ui.split('inputGraceOk').length >= 4,
        'grace охраняет кнопки И блокиратор (3+ вызова)');
    const vil = read('game/src/scenes/VillageScene.js');
    const inter = read('game/src/scenes/InteriorScene.js');
    ok(vil.includes("spr.on('pointerup'"), 'деревня: разговор по pointerup');
    ok(!vil.includes("spr.on('pointerdown'"), 'деревня: НЕТ pointerdown на НПЦ');
    ok(inter.includes("this.npcSprite.on('pointerup'"), 'интерьер: разговор по pointerup');
    ok(!inter.includes("this.npcSprite.on('pointerdown'"), 'интерьер: НЕТ pointerdown на НПЦ');
}

console.log('\n— 12. HUD и целостность —');
{
    ok(hungerStatusLine((() => { const r = makeRegistry(); noteHungerTick(r, 1800, 'walk'); return r; })()).includes('❤↓'),
        'HUD показывает «❤↓» после суток голода');
    ok(fatigueStatusLine((() => { const r = makeRegistry(); spendFatigue(r, 130); return r; })()).includes('😫'),
        'HUD показывает 😫 при отрицательных ОУ');
    const vil = read('game/src/scenes/VillageScene.js');
    ok(vil.includes('fatigueStatusLine(this.registry)'), 'усталость в HUD деревни');
    const forest = read('game/src/scenes/ForestScene.js');
    ok(forest.includes('fatigueStatusLine(this.registry)'), 'усталость в HUD леса');
    // Веса голода в сценах
    ok(read('game/src/scenes/InteriorScene.js').includes("tickTime(this.registry, sleepMinutes, 'sleep')"), 'сон спит голод ×0.4 (InteriorScene)');
    ok(read('game/src/scenes/LocationScene.js').includes("tickTime(this.registry, MAP_TRAVEL_MINUTES, 'walk')"), 'переходы по карте ×1.5 (LocationScene)');
}

console.log(`\nИТОГ: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);

// ТЕСТ РАУНДА 66.13 — ПРИКАЗ ВЛАДЕЛЬЦА (п.1-доп):
//  «добавить счётчик "свежести" следов вора и наводки на следы вора!»
//  • freshnessPct/freshnessStage/freshnessStageLabel — чистое ядро в thief.js;
//  • traceFreshness(registry, locId) — свежесть следа на локации;
//  • hintFreshness(registry) — свежесть наводки НПЦ (q.npcHint);
//  • UI: подпись каждого следа (вторая строка «% · оценка»), поп-ап осмотра
//    следа («Свежесть следа: …»), поп-ап прибытия на наводку
//    («Наводка ещё свежа: N%.»), панель улик на околице («🧭 Наводка: …»);
//  • СОВМЕСТИМО с приказом №6 раунда 66.12: НИКАКИХ живых часов и обратных
//    отсчётов — только процент выцветания следа/наводки;
//  • EN: все новые ключи переведены в i18n.js.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const stripComments = (src) => src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };

// ---------- Мок-registry (как в test_round75) ----------
function makeRegistry(questObj) {
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('quest', questObj);
    reg.set('gameTime', { yearFromChrist: 1445, month: 6, day: 14, hour: 9, minute: 30 });
    return reg;
}
// worldMinutesOf для этого ts = ((1445*372 + 6*31 + 14)*24 + 9)*60 + 30
const TS_MIN = ((1445 * 372 + 6 * 31 + 14) * 24 + 9) * 60 + 30;

const {
    freshnessPct, freshnessStage, freshnessStageLabel,
    traceFreshness, hintFreshness,
} = await import(join(ROOT, 'game/src/data/thief.js'));

// ---------- 1. Ядро: freshnessPct ----------
console.log('— ядро: freshnessPct (процент неисстёкшей жизни) —');
{
    ok(freshnessPct(100, 100, 720) === 100, 'только оставлен → 100%');
    ok(freshnessPct(0, 360, 720) === 50, 'прошла половина жизни → 50%');
    ok(freshnessPct(0, 720, 720) === 0, 'жизнь истекла → 0%');
    ok(freshnessPct(0, 10000, 720) === 0, 'давно истёк → клэмп 0%');
    ok(freshnessPct(0, -100, 720) === 100, '«из будущего» → клэмп 100%');
    ok(freshnessPct(0, 0, 720) === 100, 'граничный now=leftAt → 100%');
    ok(freshnessPct(100, 100, 0) === null, 'life=0 → null (некорректный след)');
    ok(freshnessPct(undefined, 100, 720) === null, 'leftAt не число → null');
    ok(freshnessPct(0, 100, -5) === null, 'life отрицательный → null');
    // реальный кейс: след 12–24 ч жизни, прошло 11 ч из 12 → мало
    const p = freshnessPct(0, 660, 720); // 11 ч из 12
    ok(p >= 7 && p <= 9, '11 ч из 12 → ~8% (получено ' + p + '%)');
}

// ---------- 2. Стадии свежести ----------
console.log('— стадии: freshnessStage + freshnessStageLabel —');
{
    ok(freshnessStage(100) === 0 && freshnessStage(75) === 0, '≥75 → стадия 0');
    ok(freshnessStage(74) === 1 && freshnessStage(50) === 1, '50–74 → стадия 1');
    ok(freshnessStage(49) === 2 && freshnessStage(25) === 2, '25–49 → стадия 2');
    ok(freshnessStage(24) === 3 && freshnessStage(0) === 3, '<25 → стадия 3');
    ok(freshnessStage(NaN) === 3 && freshnessStage(undefined) === 3, 'нечисло → худшая стадия');
    ok(freshnessStageLabel(100) === 'совсем свежий', 'след 100% → «совсем свежий»');
    ok(freshnessStageLabel(60) === 'ещё свежий', 'след 60% → «ещё свежий»');
    ok(freshnessStageLabel(30) === 'заветривается', 'след 30% → «заветривается»');
    ok(freshnessStageLabel(10) === 'почти истёрся', 'след 10% → «почти истёрся»');
    ok(freshnessStageLabel(100, 'hint') === 'совсем свежая', 'наводка 100% → «совсем свежая» (ж.р.)');
    ok(freshnessStageLabel(60, 'hint') === 'ещё свежая', 'наводка 60% → «ещё свежая»');
    ok(freshnessStageLabel(30, 'hint') === 'заветривается', 'наводка 30% → «заветривается»');
    ok(freshnessStageLabel(10, 'hint') === 'почти истекла', 'наводка 10% → «почти истекла» (ж.р.)');
}

// ---------- 3. traceFreshness ----------
console.log('— traceFreshness: свежесть следа на локации —');
{
    // свежий след: оставлен прямо сейчас, живёт 12 ч
    const regFresh = makeRegistry({
        chase: { traces: { river: { wentTo: 'lake', side: 'before', leftAt: TS_MIN, life: 720 } } },
    });
    const fr = traceFreshness(regFresh, 'river');
    ok(!!fr && fr.pct === 100 && fr.stage === 0, 'свежий след → 100%, стадия 0');
    ok(fr.label === 'совсем свежий', 'подпись: «совсем свежий»');
    // стареющий след: 18 ч из 20 ч жизни → 10%
    const regOld = makeRegistry({
        chase: { traces: { lake: { wentTo: null, side: 'after', leftAt: TS_MIN - 18 * 60, life: 20 * 60 } } },
    });
    const frOld = traceFreshness(regOld, 'lake');
    ok(!!frOld && frOld.pct === 10 && frOld.stage === 3, '18 ч из 20 → 10%, стадия 3');
    ok(frOld.label === 'почти истёрся', 'подпись: «почти истёрся»');
    // нет следа на локации
    ok(traceFreshness(regFresh, 'forest') === null, 'нет следа → null');
    // погоня завершена (вор сбежал) → getChase = null → null
    const regDone = makeRegistry({ thiefEscaped: true, chase: { traces: { river: { leftAt: TS_MIN, life: 720 } } } });
    ok(traceFreshness(regDone, 'river') === null, 'погоня кончилась → null');
    // след без life (легаси) → null, без падений
    const regLegacy = makeRegistry({ chase: { traces: { river: { leftAt: TS_MIN } } } });
    ok(traceFreshness(regLegacy, 'river') === null, 'легаси-след без life → null (без краша)');
}

// ---------- 4. hintFreshness ----------
console.log('— hintFreshness: свежесть наводки НПЦ —');
{
    // свежая наводка: выдана сейчас, живёт 5 ч
    const regFresh = makeRegistry({ npcHint: { locId: 'lake', issuedAtMin: TS_MIN, expiresAtMin: TS_MIN + 300, popupShown: false, broken: false } });
    const hf = hintFreshness(regFresh);
    ok(!!hf && hf.pct === 100 && hf.expired === false, 'свежая наводка → 100%, не устарела');
    ok(hf.label === 'совсем свежая', 'подпись: «совсем свежая»');
    // выцветающая: прошло 4 ч 10 мин из 5 ч → 16–17%
    const regFade = makeRegistry({ npcHint: { locId: 'lake', issuedAtMin: TS_MIN - 250, expiresAtMin: TS_MIN + 50, popupShown: true, broken: false } });
    const hfFade = hintFreshness(regFade);
    ok(!!hfFade && hfFade.pct >= 16 && hfFade.pct <= 17, '4ч10м из 5ч → ~17% (получено ' + hfFade.pct + '%)');
    ok(hfFade.stage === 3 && hfFade.expired === false, 'стадия 3, но ещё НЕ устарела');
    // сломанная наводка (вор ушёл раньше срока)
    const regBroken = makeRegistry({ npcHint: { locId: 'lake', issuedAtMin: TS_MIN - 10, expiresAtMin: TS_MIN + 290, popupShown: true, broken: true } });
    const hfB = hintFreshness(regBroken);
    ok(!!hfB && hfB.expired === true && hfB.pct === 0, 'broken → устарела, 0%');
    // истёкшая по времени
    const regExpired = makeRegistry({ npcHint: { locId: 'lake', issuedAtMin: TS_MIN - 301, expiresAtMin: TS_MIN - 1, popupShown: true, broken: false } });
    ok(hintFreshness(regExpired).expired === true, 'now ≥ expiresAtMin → устарела');
    // наводки нет
    ok(hintFreshness(makeRegistry({})) === null, 'нет npcHint → null');
    ok(hintFreshness(makeRegistry({ npcHint: { locId: 'lake' } })) !== null, 'легаси-наводка без полей → объект (без краша)');
    ok(hintFreshness(makeRegistry({ npcHint: { locId: 'lake' } })).expired === true, 'легаси-наводка считается устаревшей');
}

// ---------- 5. UI: подпись следа и поп-ап осмотра (LocationScene) ----------
console.log('— UI: LocationScene — подпись следа, поп-ап осмотра, поп-ап наводки —');
{
    const loc = stripComments(read('game/src/scenes/LocationScene.js'));
    ok(loc.includes('traceFreshness, hintFreshness'), 'импорты traceFreshness/hintFreshness');
    ok(loc.includes("tf(t('{0}% · {1}'), fr66.pct, fr66.label)") === false
        && loc.includes("fr66.pct + '% · ' + fr66.label"), 'подпись следа: вторая строка «% · оценка» (нейтральный шаблон без t())');
    ok(loc.includes("t('Свежесть следа: {0} ({1}%).'"), 'поп-ап осмотра: строка «Свежесть следа: …»');
    ok(loc.includes("t('Наводка ещё свежа: {0}%.'"), 'поп-ап наводки: строка свежести');
    ok(loc.includes('frHint66 && !frHint66.expired'), 'поп-ап наводки: свежесть только у живой наводки');
    // приказ №6 (р.66.12) не нарушен: в НОВЫХ строках нет часов
    ok(!loc.includes('осталось {0} ч') && !loc.includes('ч до побега'), 'живых часов/отсчётов в новых строках нет');
}

// ---------- 6. UI: панель улик (ForkScene) ----------
console.log('— UI: ForkScene — счётчик свежести наводки в панели улик —');
{
    const fork = stripComments(read('game/src/scenes/ForkScene.js'));
    ok(fork.includes('hintFreshness'), 'импорт hintFreshness');
    ok(fork.includes("t('🧭 Наводка: {0} ({1}%)'"), 'строка «🧭 Наводка: оценка (%)»');
    ok(fork.includes("t('🧭 Наводка: устарела'"), 'истёкшая наводка: честное «устарела»');
    ok(fork.includes('else if (hintLine66)'), 'автономный бейдж, когда улик ещё нет');
    ok(fork.includes('если hintLine66') === false && fork.includes('if (hintLine66) cluesText += hintLine66'), 'дописывается в панель улик');
}

// ---------- 7. Экспорты ядра (thief.js) ----------
console.log('— thief.js: новые экспорты —');
{
    ok(typeof freshnessPct === 'function', 'freshnessPct экспортирован');
    ok(typeof freshnessStage === 'function', 'freshnessStage экспортирован');
    ok(typeof freshnessStageLabel === 'function', 'freshnessStageLabel экспортирован');
    ok(typeof traceFreshness === 'function', 'traceFreshness экспортирован');
    ok(typeof hintFreshness === 'function', 'hintFreshness экспортирован');
}

// ---------- 8. i18n: все новые ключи переведены ----------
console.log('— i18n: EN-ключи свежести —');
{
    const i18n = read('game/src/systems/i18n.js');
    for (const k of [
        "'совсем свежий'", "'ещё свежий'", "'заветривается'", "'почти истёрся'",
        "'совсем свежая'", "'ещё свежая'", "'почти истекла'",
        "'Свежесть следа: {0} ({1}%).'",
        "'🧭 Наводка: {0} ({1}%)'", "'🧭 Наводка: устарела'",
        "'Наводка ещё свежа: {0}%.'",
    ]) {
        ok(i18n.includes(k), 'ключ есть: ' + k);
    }
    ok(i18n.includes("'совсем свежий': 'very fresh'"), 'EN: very fresh');
    ok(i18n.includes("'заветривается': 'fading'"), 'EN: fading');
    ok(i18n.includes("'почти истёрся': 'nearly erased'"), 'EN: nearly erased');
    ok(i18n.includes("'почти истекла': 'nearly spent'"), 'EN: nearly spent (ж.р.)');
    ok(i18n.includes("'🧭 Наводка: {0} ({1}%)': '🧭 Hint: {0} ({1}%)'"), 'EN: строка наводки');
}

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail ? 1 : 0);

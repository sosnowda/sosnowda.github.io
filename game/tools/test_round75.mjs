// ТЕСТ РАУНДА 66.12 — 7 ПРИКАЗОВ ВЛАДЕЛЬЦА:
//  1) наводка очевидца = ДОБАВЛЕНИЕ к стандартному 2-часовому счётчику;
//  2) диалоги — историчность (анахронизмы вычищены);
//  3) имена/топонимы — закреплены канонические, орфография выровнена;
//  4) UI диалога — тач-скролл переполненного текста;
//  5) процедурные задания — ICON_RETURN изъят, засада разбойников на дороге,
//     отработка стражи/примирения, сезонность, меч старосты по-честному;
//  6) отсчёт часов до побега вора СКРЫТ из UI;
//  7) торговля — покупка оружия не губит надетое, дубликаты блокированы,
//     квест-предметы не дарятся, постоялый двор по единым правилам.
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const exists = (p) => existsSync(join(ROOT, p));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } };
// сканируем КОД без полнострочных комментариев (комментарии-история не тексты игры)
const stripComments = (src) => src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

// ---------- П.6: отсчёт скрыт ----------
console.log('— п.6: отсчёт «до побега вора» скрыт из UI —');
{
    const scenes = ['VillageScene', 'ForkScene', 'ApiaryScene', 'LocationScene'];
    for (const s of scenes) {
        const src = stripComments(read(`game/src/scenes/${s}.js`));
        ok(!src.includes('до побега вора') && !src.includes('ч до побега'),
            `${s}: отсчёта в HUD нет`);
    }
    const wc = read('game/src/systems/WorldClock.js');
    ok(!wc.includes('Счётчик «до побега вора»'), 'F1-справка не обещает счётчик');
    ok(wc.includes('Вор не станет ждать вечно'), 'F1: честная формулировка «сколько — не знает никто»');
    const i18nCode = stripComments(read('game/src/systems/i18n.js'));
    ok(!i18nCode.includes("'⏳{0} ч до побега'") && !i18nCode.includes("'⏳ Часов до побега вора: {0}'"),
        'i18n: ключи обратного отсчёта удалены');
    // внутренний счётчик жив (погоня работает как прежде)
    ok(exists('game/src/data/thief.js'), 'thief.js на месте');
    const thief = read('game/src/data/thief.js');
    ok(thief.includes('export function chaseTicksLeft') && thief.includes('export function chaseHoursLeft'),
        'внутренний счётчик погони сохранён');
    // поп-ап наводки без живых часов
    const loc = read('game/src/scenes/LocationScene.js');
    ok(!loc.includes('осталось около {1} ч'), 'поп-ап наводки: живых часов нет');
    ok(loc.includes('наводка живёт недолго'), 'поп-ап наводки: правило без цифр');
}

// ---------- П.1: наводка = добавление к 2-часовому счётчику ----------
console.log('— п.1: наводка очевидца — добавление к стандартному счётчику (2 ч) —');
{
    const { pinThiefAtCurrentStop, TRAIL_LOCK_HOURS, NPC_HINT_VALID_HOURS } = await import(join(ROOT, 'game/src/data/thief.js'));
    ok(TRAIL_LOCK_HOURS === 2, 'стандартный счётчик (след) = 2 часа — не тронут');
    ok(NPC_HINT_VALID_HOURS === 5, 'наводка «прибивает» вора на 5 ч');
    const reg = { data: new Map(), get(k) { return this.data.get(k); }, set(k, v) { this.data.set(k, v); } };
    reg.set('quest', {
        chase: { route: ['river', 'lake', 'field'], stop: 0, phase: 'stay', ticksLeft: 5, traces: { river: {} } },
    });
    // 1) прочитанный след — стандартный 2-часовой замок
    pinThiefAtCurrentStop(reg, TRAIL_LOCK_HOURS, false);
    let q = reg.get('quest');
    ok(q.chase.traceLockHours === 2, 'след: traceLockHours = 2');
    // 2) наводка очевидца ПОВЕРХ — свой замок 5 ч, стандартный НЕ отменяет
    pinThiefAtCurrentStop(reg, NPC_HINT_VALID_HOURS, true);
    q = reg.get('quest');
    ok(q.chase.npcLockHours === 5, 'наводка: npcLockHours = 5');
    ok(q.chase.traceLockHours === 2, 'стандартный 2-часовой счётчик СОХРАНЁН (не заменён)');
    ok(q.chase.hintLockHours === 5, 'эффективный замок = max(2, 5) = 5');
}

// ---------- П.5: процедурные задания ----------
console.log('— п.5: правила процедурной генерации (XV век) —');
{
    const qg = read('game/src/data/questGenerator.js');
    ok(!/quests:\s*\[[^\]]*QUEST_TYPES\.ICON_RETURN/.test(qg), 'ICON_RETURN изъят из всех пулов');
    ok(qg.includes("rewardTypes: ['blessing', 'herb', 'money']"), 'священник: награда-икона изъята');
    ok(qg.includes('isWinter6612'), 'сезонность: зимой грибы/травы не выдаются');
    ok(qg.includes("'forest_edge'") && qg.includes("'forest_glade'"), 'matchesLocation: Опушка/Поляна засчитываются');
    ok(qg.includes('minMinutesDone: 360') && qg.includes('minMinutesDone: 60'),
        'стража/примирение требуют отработки (6 ч / 1 ч)');
    ok(qg.includes('else if (quest.minMinutesDone'), 'tickQuestTime: автозачёт по отработке');
    ok(!qg.includes('Муж пошёл за дровами'), 'FIND_PERSON: мужской шаблон нейтрализован');
    ok(!qg.includes('на тракте') && !qg.includes('по тракту') && !qg.includes('с тракта'),
        '«тракт» (XVIII в.) вычищен из заданий');
    const genBody = qg.split('export function generateQuest')[1] || '';
    const genOnly = genBody.split('export function acceptQuest')[0];
    ok(!genOnly.includes('elderSwordPromised = true'),
        'меч старосты: в generateQuest обещания больше нет (сгорание при отказе устранено)');
    const accBody = (qg.split('export function acceptQuest')[1] || '').split('export function')[0];
    ok(accBody.includes('elderSwordPromised = true'),
        'меч старосты: обещание ставится при ПРИНЯТИИ');
    ok(qg.includes('rewardsToGrant'), 'двойная выдача меча блокирована');
    ok(qg.includes('Травный отвар'), 'вдова/знахарка дают отвар, а не «благословение батюшки»');
    // засада разбойников на дороге
    const loc = read('game/src/scenes/LocationScene.js');
    ok(loc.includes("enemyKeys: ['bandit']") && loc.includes("'road_south'"),
        'лихие люди: настоящая засада на Большой дороге');
    const isr = read('game/src/scenes/InteriorScene.js');
    ok(!isr.includes("enemyKeys: ['bandit'], npcId"), 'драка с жителем больше не «разбойники»');
    ok(isr.includes("enemyKeys: ['villager']"), 'враждебный житель — ключ villager');
}

// ---------- П.7: торговля ----------
console.log('— п.7: торговля (товары, оружие, продажа) —');
{
    const isr = read('game/src/scenes/InteriorScene.js');
    ok(isr.includes('oldWeaponId'), 'покупка оружия: надетое возвращается в узел');
    ok(isr.includes('Такая вещь у тебя уже есть'), 'повторная покупка блокируется');
    ok(isr.includes("item.id === 'icon' || item.uniqueFromElder"), 'икона и меч старосты не дарятся');
    ok(/showTavernShop\(\) \{[\s\S]*?willNpcRefuseTrade/.test(isr), 'постоялый двор: отказ при дурной славе');
    // Раунд 66.16: еда в таверне = час времени; раунд 66.17: полноценная еда 2–3 HP
    ok(isr.includes("const mkEffect = (heal) => `+\${heal} HP"), 'еда на постоялом дворе: метка «+N HP · 1 час» (66.16/66.17)');
    const interiors = read('game/src/data/interiors.js');
    ok(!interiors.includes("id: 'torch'") && !interiors.includes("id: 'flint'"),
        'мёртвые товары (факел/кремень) сняты с продажи');
    const chr = read('game/src/systems/Character.js');
    ok(chr.includes("SMITH_SALE_WEAPONS") === false, 'продажа кузнеца — в InteriorScene (реестр целен)');
    const dialogue = read('game/src/data/dialogue.js');
    ok(!dialogue.includes('Нужно оружие или броня'), 'кузнец не обещает броню (её не продают)');
}

// ---------- П.2: диалоги (историчность) ----------
console.log('— п.2: анахронизмы вычищены —');
{
    const files = ['data/dialogue.js', 'data/npcPresence.js', 'data/rumors.js', 'data/thief.js',
        'data/interiors.js', 'data/characters.js', 'scenes/InteriorScene.js'];
    const banned = ['трактор', 'Прикольные', 'вжух', 'валенки', 'клумбу', 'стеарин', 'борщ',
        'стрельцы', 'иконокража', 'чаю', 'чайку', 'чаем с брусникой', 'к чаю'];
    let hits = [];
    for (const f of files) {
        const src = stripComments(read(`game/src/${f}`));
        for (const b of banned) {
            const re = new RegExp('чаю' === b ? 'чаю\\b' : b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            if (re.test(src)) hits.push(`${f}:${b}`);
        }
    }
    ok(hits.length === 0, 'анахронизмов нет: ' + (hits.join(', ') || 'чисто'));
    const ts = read('game/src/scenes/TitleScene.js');
    ok(!ts.includes('О игре') && ts.includes('Об игре'), '«Об игре» (грамматика)');
    const cs = stripComments(read('game/src/scenes/CharacterSelectionScene.js'));
    ok(!cs.includes('прессет') && cs.includes('избран по обычаю'), 'метатекст «(раунд 62)» и жаргон вычищены');
}

// ---------- П.3: имена и топонимы ----------
console.log('— п.3: имена персонажей и топонимы —');
{
    const nn = read('game/src/data/npcNames.js');
    for (const [id, name] of [['elder', 'Мирослав'], ['priest', 'Савватий'], ['tavernkeeper', 'Фёдор'],
        ['blacksmith', 'Данила'], ['hunter', 'Гаврила'], ['guard', 'Илья']]) {
        const re = new RegExp(`id: '${id}'[^}]*name: '${name}'`);
        ok(re.test(nn), `${id} → ${name} закреплён`);
    }
    ok((nn.match(/'Кузьма'/g) || []).length === 1, 'пул имён: дубль «Кузьма» удалён');
    ok(!nn.includes('Творимир') && !nn.includes('Забава') && !nn.includes('Гостомысл'),
        'сомнительные имена заменены (Твердислав/Милуша/Путята)');
    const ml = stripComments(read('game/src/data/mapLocations.js'));
    ok(!ml.includes('Погостъ') && !ml.includes('Выпасъ') && !ml.includes('Рѣка') && !ml.includes('югъ'),
        'орфография локаций выровнена (без ѣ/ъ)');
    ok(!ml.includes('Тракт'), '«Тракт» заменён на «Большая дорога»');
    const w = read('game/src/data/world.js');
    ok(!w.includes('Пёрмышль') && !w.includes('Царёво Займище') && !w.includes('Торжок-Новый'),
        'названия деревень выправлены');
    const ns = read('game/src/data/npcSchedules.js');
    ok(ns.includes('Знахарка Февронья') && ns.includes('Рыбак Ерёма') && ns.includes('Мельник Авдей')
        && ns.includes('Пасечница Марфа'), 'legacy-реестр согласован с каноном');
    ok(!ns.includes('hunter_house') && !ns.includes('guard_house') && !ns.includes('fisherman_house'),
        'несуществующие интерьеры из реестра убраны');
}

// ---------- П.4: UI диалога ----------
console.log('— п.4: текст диалога внутри окна (тач-скролл) —');
{
    const ui = read('game/src/utils/ui.js');
    ok(ui.includes('pointerupoutside') && ui.includes('dragStartScroll'),
        'переполненный текст прокручивается пальцем/перетаскиванием');
    ok(ui.includes("scene.input.removeListener('pointerdown', dragHandlers.down)"),
        'тач-обработчики снимаются при закрытии диалога');
    ok(ui.includes('dialogWidth - pad.left - pad.right - (portraitImg ? 106 : 0)'),
        'перенос строк — от фактической ширины панели (без выхода за рамки)');
    ok(ui.includes('packButtonRows'), 'кнопки упаковываются рядами без наложений');
}

// ---------- i18n ----------
console.log('— i18n: новые ключи переведены —');
{
    const i18n = read('game/src/systems/i18n.js');
    for (const k of ["'Об игре'", "'Большая дорога'", "'Травный отвар (полное восстановление)'",
        "'У тебя уже есть поручение от {0}. Сперва закончи его!'",
        "'Такая вещь у тебя уже есть — не по-торговому дважды платить за одну.'",
        "'На большой дороге тебе преградили путь лихие люди!'",
        "'Постоялый двор «У дороги» — меню'", "'Дело сделано, {0}! Прими это в благодарность.'"]) {
        ok(i18n.includes(k), `ключ есть: ${k.slice(0, 46)}…`);
    }
}

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail ? 1 : 0);

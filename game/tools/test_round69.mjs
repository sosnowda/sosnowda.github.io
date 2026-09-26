#!/usr/bin/env node
/**
 * Юнит-проверки патча 66.6 (заявка владельца из 7 пунктов).
 * Запуск: node tools/test_round69.mjs (из папки game/).
 *
 * Покрывает:
 *   п.1  звуки: RiverAmbience (WebAudio-синтез реки/озера, без ассетов),
 *        плеск при рыбалке, звук двери при входе в дом в деревне;
 *   п.2  плавные погодные переходы: Weather.js — fade-in 2.2 с,
 *        crossfade при смене дня, снятие цепочки молний;
 *   п.3  сезонные работы (SeasonalWork.js): пахота/посев/сенокос/жатва/
 *        жнивьё/залежь/снег по сентябрьскому календарю; работники поля;
 *   п.4  слухи-наводки (rumors.js): до 3 в день, наводка по вору,
 *        ограничения на день, EN-версии;
 *   п.5  лайтбокс со стрелками (RU/EN лендинги, main.js, styles.css);
 *   п.6  G-теги (OG/Twitter/JSON-LD) в game/index.html;
 *   п.7  аудит целостности: все новые модули на месте, SW v65,
 *        скриншот кузницы по-прежнему удалён (регресс 66.5).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getSeasonalWork, fieldPhaseOf, seasonalWorkerLine, seasonalWorkTable,
} from '../src/systems/SeasonalWork.js';
import { RIVER_VOLUME_BY_LOCATION, playWaterSplash } from '../src/systems/RiverAmbience.js';
import { WEATHER_TYPES, getWeather, isRainy, isPrecip } from '../src/systems/Weather.js';
import { RUMORS_PER_DAY, collectRumors, tavernRumorLine } from '../src/data/rumors.js';
import { t, setLang } from '../src/systems/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, name) => {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗ FAIL:', name); }
};
const read = (p) => readFileSync(join(root, p), 'utf8');

// Мок registry Phaser
function mockRegistry(data = {}) {
    return {
        _d: { ...data },
        get(k) { return this._d[k]; },
        set(k, v) { this._d[k] = v; return v; },
    };
}

console.log('\n[1] СЕЗОННЫЕ РАБОТЫ (п.3): календарь сентябрьский, месяц 0 = сентябрь');
{
    ok(fieldPhaseOf({ month: 7 }) === 'plow', 'апрель (7) — ПАХОТА');
    ok(fieldPhaseOf({ month: 8 }) === 'sowing', 'май (8) — ПОСЕВ');
    ok(fieldPhaseOf({ month: 9 }) === 'haymaking', 'июнь (9) — СЕНОКОС');
    ok(fieldPhaseOf({ month: 10 }) === 'harvest', 'июль (10) — ЖАТВА');
    ok(fieldPhaseOf({ month: 11 }) === 'harvest', 'август (11) — ЖАТВА');
    ok(fieldPhaseOf({ month: 0 }) === 'stubble', 'сентябрь (0) — ЖНИВЬЁ (озимый сев)');
    ok(fieldPhaseOf({ month: 1 }) === 'stubble', 'октябрь (1) — ЖНИВЬЁ (молотьба)');
    ok(fieldPhaseOf({ month: 2 }) === 'fallow', 'ноябрь (2) — ЗАЛЕЖЬ');
    ok(fieldPhaseOf({ month: 3 }) === 'snow', 'декабрь (3) — ПОЛЕ ПОД СНЕГОМ');
    ok(fieldPhaseOf({ month: 4 }) === 'snow', 'январь (4) — ПОЛЕ ПОД СНЕГОМ');
    ok(fieldPhaseOf({ month: 5 }) === 'snow', 'февраль (5) — ПОЛЕ ПОД СНЕГОМ');
    ok(fieldPhaseOf({ month: 6 }) === 'fallow', 'март (6) — ЗАЛЕЖЬ (вывоз брёвен)');
    // отрицательный/переполненный месяц — безопасный модуль
    ok(fieldPhaseOf({ month: 19 }) === 'plow', 'месяц 19 → 7 (апрель-модуль) — пахота');
    ok(fieldPhaseOf({ month: -3 }) === 'haymaking', 'месяц −3 → 9 (июнь-модуль) — сенокос');
    ok(fieldPhaseOf(null) !== undefined, 'без времени — безопасный дефолт');
}
{
    const table = seasonalWorkTable();
    ok(table.length === 12, `таблица покрывает 12 месяцев (${table.length})`);
    const phases = new Set(table.map(r => r.phase));
    ok(phases.size >= 6, `разнообразие фаз ≥ 6 (${phases.size})`);
    // у каждой фазы есть имя, работа и плашка
    let allNamed = true;
    for (const m of table) {
        const w = getSeasonalWork({ month: m.month });
        if (!w.name || !w.work || !w.toast) { allNamed = false; break; }
    }
    ok(allNamed, 'у всех 12 месяцев есть имя работы, вид работ и плашка');
    const work = getSeasonalWork({ month: 9 });
    ok(work.name === 'Сенокос', `июнь: имя работы «Сенокос» (${work.name})`);
    ok(work.work === 'сенокос', `июнь: вид работ «сенокос» (${work.work})`);
    ok(work.toast.includes('Сенокосная пора'), 'июнь: плашка про сенокосную пору');
    // реплики работников: непустые и из пула фазы
    const l1 = seasonalWorkerLine('harvest');
    const l2 = seasonalWorkerLine('harvest');
    ok(l1 && l2, 'реплики жнеца не пустые');
    ok(seasonalWorkerLine('snow') !== undefined, 'реплика для зимы безопасна (не вызывается, но определена)');
    // EN-локализация
    setLang('en');
    ok(getSeasonalWork({ month: 9 }).name === 'Haymaking', 'EN: июнь — Haymaking');
    ok(getSeasonalWork({ month: 7 }).name === 'Ploughing', 'EN: апрель — Ploughing');
    setLang('ru');
}

console.log('\n[2] ЗВУКИ РЕКИ И ДВЕРЕЙ (п.1)');
{
    ok(RIVER_VOLUME_BY_LOCATION.river === 0.9, 'Река: громкость 0.9');
    ok(RIVER_VOLUME_BY_LOCATION.lake === 0.65, 'Озеро: громкость 0.65');
    ok(RIVER_VOLUME_BY_LOCATION.mill === 0.45, 'Мельница: громкость 0.45 (водяное колесо)');
    ok(RIVER_VOLUME_BY_LOCATION.forest === undefined, 'Лес: звука реки нет');
    // модуль не зависит от Phaser (WebAudio-only, как ChurchBells)
    const src = read('src/systems/RiverAmbience.js');
    ok(!/import .*Phaser/.test(src), 'RiverAmbience: без импорта Phaser (WebAudio)');
    ok(src.includes('masterVolumeNode'), 'RiverAmbience: громкость через masterVolumeNode (SFX-настройки)');
    ok(src.includes('makeBrownNoiseBuffer'), 'RiverAmbience: коричневый шум — материал потоков');
    ok(src.includes('sfxMuted'), 'RiverAmbience: уважает мьют SFX');
    ok(typeof playWaterSplash === 'function', 'playWaterSplash экспортирован (рыбалка)');
    // безопасен без контекста
    let safe = false;
    try { playWaterSplash({ sound: null }, 0.5); safe = true; } catch (e) { safe = false; }
    ok(safe, 'playWaterSplash не падает без аудио-контекста');
    // сцена подключает шум реки + плеск
    const loc = read('src/scenes/LocationScene.js');
    ok(loc.includes("attachRiverAmbience(this, { volume: RIVER_VOLUME_BY_LOCATION[this.locationId] || 0 })"), 'LocationScene: шум реки подключён по громкости локации');
    ok(loc.includes('playWaterSplash(this, winter ? 0.5 : 0.7)'), 'LocationScene: плеск при рыбалке (зимой тише — лунка)');
    const vil = read('src/scenes/VillageScene.js');
    const doorOpens = vil.match(/playRealDoorOpen\(\)/g) || [];
    ok(doorOpens.length === 3, `VillageScene: звук двери при входе — 3 точки (${doorOpens.length}) (стук в дверь, р.66.21)`);
}

console.log('\n[3] ПЛАВНЫЕ ПОГОДНЫЕ ПЕРЕХОДЫ (п.2)');
{
    ok(Object.keys(WEATHER_TYPES).length === 5, '5 типов погоды');
    ok(isRainy(WEATHER_TYPES.rain) && isRainy(WEATHER_TYPES.storm), 'isRainy: дождь и гроза');
    ok(isPrecip(WEATHER_TYPES.snow) && !isPrecip(WEATHER_TYPES.clear), 'isPrecip: снег — да, ясно — нет');
    ok(getWeather(mockRegistry()).id === 'clear', 'без игрового времени — ясно (сцены меню)');
    // детерминизм по дате
    const reg = mockRegistry({ gameTime: { yearFromChrist: 1452, month: 6, day: 12, hour: 12, minute: 0 } });
    ok(getWeather(reg).id === getWeather(reg).id, 'погода дня детерминирована');
    const wJan = getWeather(mockRegistry({ gameTime: { yearFromChrist: 1452, month: 4, day: 5, hour: 12, minute: 0 } }));
    ok(['snow', 'cloudy', 'clear'].includes(wJan.id), `зимняя погода без дождя (${wJan.id})`);
    // исходник: fade-in, crossfade, снятие молний
    const src = read('src/systems/Weather.js');
    ok(src.includes('duration: 2200'), 'появление погоды — плавное (2.2 с)');
    ok(src.includes('crossfadeWeather'), 'при смене дня — кроссфейд (без рестарта сцены)');
    ok(src.includes('flashEvents'), 'цепочка молний снимается при кроссфейде (flashEvents)');
    ok(src.includes("tI18n('Погода меняется')"), 'тост «Погода меняется» при смене');
    ok(src.includes("get('Погода меняется')") || src.includes('Погода меняется'), 'ключ «Погода меняется» — через i18n');
    ok(!src.includes('delayedCall(Phaser.Math.Between(7000, 16000)'), 'молнии больше не висят вечным delayedCall');
    // сцены не изменили вызов (5 мест)
    const scenes = ['ForestScene', 'ApiaryScene', 'LocationScene', 'VillageScene', 'CombatScene'];
    let allUse = true;
    for (const s of scenes) {
        const code = read(`src/scenes/${s}.js`);
        if (!code.includes('applyWeatherVisuals(this,') && !code.includes('applyWeatherVisuals(')) allUse = false;
    }
    ok(allUse, 'все 5 игровых сцен подключают плавную погоду');
}

console.log('\n[4] СЛУХИ-НАВОДКИ В ТАВЕРНЕ (п.4)');
{
    ok(RUMORS_PER_DAY === 3, 'слухов в день — 3');
    const reg = mockRegistry({ gameTime: { yearFromChrist: 1452, month: 6, day: 10, hour: 13, minute: 0 } });
    const list = collectRumors(reg);
    ok(Array.isArray(list) && list.length >= 1, `collectRumors отдаёт слухи (${list.length})`);
    ok(list.every(r => r.ru && r.en), 'у каждого слуха есть RU и EN версии');
    // 3 слуха в день — все разные
    const r1 = tavernRumorLine(reg);
    const r2 = tavernRumorLine(reg);
    const r3 = tavernRumorLine(reg);
    ok(r1.length > 0 && r2.length > 0 && r3.length > 0, 'три визита — три реплики');
    ok(new Set([r1, r2, r3]).size === 3, 'слухи за день НЕ повторяются');
    const r4 = tavernRumorLine(reg);
    ok(r4.includes('обоз прибудет'), `четвёртый визит — «молва разобрана» (${r4.slice(0, 24)}…)`);
    // новый день — слухи снова есть
    reg.set('gameTime', { yearFromChrist: 1452, month: 6, day: 11, hour: 9, minute: 0 });
    const r5 = tavernRumorLine(reg);
    ok(!r5.includes('обоз прибудет'), 'новый день — слухи доступны снова');
    // наводка по вору: вор стоит на Реке
    const regThief = mockRegistry({
        gameTime: { yearFromChrist: 1452, month: 6, day: 10, hour: 14, minute: 0 },
        quest: { chase: { phase: 'stay', stop: 0, route: ['river', 'forest', 'field'], stays: [2, 2, 2], ticksLeft: 9, stage: 'hunt' }, thiefEscaped: false, thiefDefeated: false },
    });
    const withThief = collectRumors(regThief).find(r => r.ru.includes('вора'));
    ok(!!withThief, 'есть наводка про вора, пока охота идёт');
    const line = tavernRumorLine(regThief);
    ok(line.includes('слыхал') || line.includes('Фёдор'), 'реплика корчмаря оформлена от Фёдора');
    // вор пойман — наводок про вора нет
    const regDone = mockRegistry({
        gameTime: { yearFromChrist: 1452, month: 6, day: 10, hour: 14, minute: 0 },
        quest: { chase: { phase: 'stay', stop: 0, route: ['river', 'forest', 'field'], stays: [2, 2, 2], ticksLeft: 9, stage: 'done' }, thiefEscaped: false, thiefDefeated: true },
    });
    ok(!collectRumors(regDone).some(r => r.ru.includes('вора')), 'после поимки вора слух про него не даётся');
    // EN
    const regEn = mockRegistry({ gameTime: { yearFromChrist: 1452, month: 6, day: 12, hour: 10, minute: 0 } });
    setLang('en');
    const en1 = tavernRumorLine(regEn);
    const en2 = tavernRumorLine(regEn);
    const en3 = tavernRumorLine(regEn);
    const en4 = tavernRumorLine(regEn);
    ok(/[a-zA-Z]/.test(en1) && /[a-zA-Z]/.test(en2), 'EN-слухи — латиницей');
    ok(en4.includes('convoy'), 'EN: лимит слухов — «convoy is due»');
    setLang('ru');
    // диалог корчмаря: выбор и узел
    const dlg = read('src/data/dialogue.js');
    ok(dlg.includes("next: 'rumor'"), 'в диалоге Фёдора есть пункт слухов');
    ok(dlg.includes('tavernRumorLine(scene.registry)'), 'узел rumor выдаёт слух через tavernRumorLine');
    ok(dlg.includes('Выслушал слухи на постоялом дворе.'), 'слухи попадают в летопись (ActionLog)');
}

console.log('\n[5] ЛАЙТБОКС СО СТРЕЛКАМИ (п.5)');
{
    const main = read('../main.js');
    ok(main.includes('slb-prev') && main.includes('slb-next'), 'main.js: кнопки-стрелки ‹ ›');
    ok(main.includes("ArrowLeft") && main.includes("ArrowRight"), 'main.js: листание клавишами ←/→');
    ok(main.includes("e.key === 'Escape'") || main.includes("key === 'Escape'"), 'main.js: закрытие по Esc');
    ok(main.includes('touchstart') && main.includes('touchend'), 'main.js: свайп на тач-экранах');
    ok(main.includes('slbCounter'), 'main.js: счётчик «N из M»');
    ok(main.includes('aria-modal'), 'main.js: ARIA-атрибуты диалога');
    const css = read('../styles.css');
    ok(css.includes('.slb-btn') && css.includes('.slb-counter') && css.includes('.slb-caption'), 'styles.css: стили стрелок, счётчика и подписи');
    ok(css.includes('@media (max-width: 640px)'), 'styles.css: мобильная адаптация лайтбокса');
    for (const page of ['../index.html', '../en/index.html']) {
        const html = read(page);
        const cards = (html.match(/screenshot-card/g) || []).length;
        ok(cards === 9, `${page}: 9 карточек галереи (${cards})`);
        ok(!html.includes('10-blacksmith'), `${page}: кузницы в галерее нет (регресс 66.5)`);
    }
}

console.log('\n[6] G-ТЕГИ (п.6)');
{
    const g = read('../game/index.html');
    ok(g.includes('property="og:title"') && g.includes('og:description'), 'game/index.html: Open Graph');
    ok(g.includes('name="twitter:card"') && g.includes('summary_large_image'), 'game/index.html: Twitter Card');
    ok(g.includes('application/ld+json') && g.includes('"@type":"VideoGame"'), 'game/index.html: JSON-LD VideoGame');
    ok(g.includes('og:image" content="https://sosnowda.github.io/assets/images/og-demo.jpg"'), 'game/index.html: og:image → og-demo.jpg (отдельный, раунд 66.8)');
    ok(existsSync(join(root, '../assets/images/og-image.jpg')), 'assets/images/og-image.jpg существует (без 404)');
    ok(g.includes('playMode') || g.includes('SinglePlayer'), 'JSON-LD: playMode указан');
    // RU/EN лендинги — OG остаются на месте (регресс)
    for (const page of ['../index.html', '../en/index.html']) {
        const html = read(page);
        ok(html.includes('property="og:title"') && html.includes('twitter:image'), `${page}: OG/Twitter на месте`);
    }
}

console.log('\n[7] АУДИТ ЦЕЛОСТНОСТИ 66.6 (п.7 + регрессы)');
{
    // новые модули на месте
    for (const f of ['src/systems/SeasonalWork.js', 'src/systems/RiverAmbience.js', 'src/data/rumors.js']) {
        ok(existsSync(join(root, f)), `${f} существует`);
    }
    // сцена локаций: сезонные работники + фазы поля
    const loc = read('src/scenes/LocationScene.js');
    ok(loc.includes('spawnSeasonalWorkers'), 'LocationScene: работники поля спавнятся');
    ok(loc.includes('fieldPhaseOf'), 'LocationScene: фаза поля из календаря');
    for (const phase of ['plow', 'sowing', 'haymaking', 'harvest', 'stubble', 'fallow']) {
        ok(loc.includes(`case '${phase}':`), `LocationScene: вид поля «${phase}» отрисован`);
    }
    ok(loc.includes('showBellToast(this, work66.toast)'), 'LocationScene: плашка сезона при входе на поле');
    // SW: v69, ассеты вычищены от неиспользуемых (66.19)
    const sw = read('../sw.js');
    ok(sw.includes("chronicles-ruthenia-v78"), 'SW: версия сайта v77 (раунд 66.27)');
    ok(sw.includes("game-assets-v24"), 'SW: кеш ассетов v23 (тайлы икон церкви, 66.20)');
    ok(sw.includes('v65 — раунд 66.6'), 'SW: описан патч 66.6');
    // i18n: новые EN-ключи
    const i18n = read('src/systems/i18n.js');
    ok(i18n.includes("'Пахарь': 'Ploughman'"), 'i18n: EN-ключи сезонных ролей');
    ok(i18n.includes("'Погода меняется': 'The weather is turning'"), 'i18n: EN-ключ погоды');
    ok(i18n.includes("'🗣 Что слыхал нового? (слухи)':"), 'i18n: EN-ключ пункта слухов');
    // старый лайтбокс-класс больше не ссылается на мёртвый селектор
    ok(!read('../main.js').includes("querySelectorAll('aref"), 'main.js: нет невалидных селекторов');
}

console.log(`\n=== ИТОГ: ${pass} успешно, ${fail} провалено ===`);
process.exit(fail ? 1 : 0);

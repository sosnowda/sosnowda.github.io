// rumors.js — СЛУХИ-НАВОДКИ НА ПОСТОЯЛОМ ДВОРЕ (раунд 66.6, приказ
// владельца: «слухи-наводки в таверне»).
//
// Постоялый двор — узел всей сельской молвы: обозы привозят вести из мира,
// заходящие крестьяне — сплетни про двор и поле, а хозяин Фёдор слышит
// больше всех. Игрок может спросить «Что слыхал нового?» — в день можно
// выслушать до 3 разных слухов (дальше — только пересуды на завтра).
//
// Слухи ДВУХ родов:
//   НАВОДКИ — по состоянию мира: где видели вора (isThiefAt), куда ушло
//             стадо, что нынче снедать по погоде, какая на дворе работа
//             (SeasonalWork), что рыба в дождь берёт жадно;
//   ВЕСТИ   — из хроники XV века (1408–1505): правдивые события эпохи,
//             дошедшие до деревни с обозами (соответствие разделу
//             «Хроника 1400–1505» на сайте).
//
// Реплики хранятся парами { ru, en }: выбор по языку игры (isEn()),
// шаблоны через tf('{0}') — подстановки честные в обоих языках.

import { t, tf, isEn } from '../systems/i18n.js';
import { getTime } from '../systems/TimeSystem.js';
// Раунд 66.7: приметы — слухи о погоде влияют на неё (пп.6,7)
import { omenTypeForDay, omenLine, recordWeatherRumor, OMEN_FULFILLED_NOTE } from '../systems/WeatherOmens.js';
import { getSeasonalWork } from '../systems/SeasonalWork.js';
import { getHerdState } from './herd.js';
import { isThiefAt } from './thief.js';
import { getHuntState } from './thief.js';

// Сколько слухов в день можно выслушать (1 визит = 1 слух).
export const RUMORS_PER_DAY = 3;

// Вести хроники XV века — «с обозом привезли» (историзм, раздел «Хроника»).
const CHRONICLE_RUMORS = [
    { ru: 'Говорят, в 1408-м Едигей с ордой пришёл — земли на север разорил, а Москву взять не смог: кремль отстроили крепкий.', en: 'They say back in 1408 Edigu came with the horde — laid waste to the northern lands, but failed to take Moscow: the kremlin walls were rebuilt strong.' },
    { ru: 'Слыхал? Под Грюнвальдом поляки с литвинами Тевтонский орден на голову разбили — вся Европа гудит.', en: 'Heard it? At Grunwald the Poles and Lithuanians smashed the Teutonic Order outright — all of Europe is abuzz.' },
    { ru: 'Великий князь Василий Дмитриевич помер, а брат его Юрий со Звенигорода на Москву поглядывает — междоусобица чуется.', en: 'Grand Prince Vasily Dmitrievich has died, and his brother Yuri glances at Moscow from Zvenigorod — strife is brewing.' },
    { ru: 'В Царьграде турки под стенами стоят. Говорят, последняя держава крестовая падёт — а Русь остаётся.', en: 'The Turks are standing under the walls of Constantinople. They say the last crusader realm will fall — while Rus remains.' },
    { ru: 'Иван Государь третьим землю собирает: Новгород пал на Шелони, а Орду на Угре станом встретили — и ушла ни с чем.', en: 'Sovereign Ivan is gathering the lands together: Novgorod fell on the Shelon, and the Horde was met with an armed camp on the Ugra — and turned away empty-handed.' },
    { ru: 'Судебник государев вышел: крестьянину выход Юрьевым днём указан, а вольному человеку за старое пожилое платить надобно.', en: 'The sovereign’s Law Code is out: a peasant may leave only on St. George’s Day, and a freeman may not wander without a hire.' },
    { ru: 'Говорят, грек митрополит больше не ставится от Царьграда — Русская церковь сама епископов собирает.', en: 'They say the metropolitan is no longer set from Constantinople — the Russian church gathers its own bishops now.' },
    { ru: 'Возят вести: Ивана третьего на велиское княжение народ и бояре звали, и он на престоле с 1462 года сидит крепко.', en: 'Word is brought: the people and the boyars called Ivan the Third to the grand princedom, and he has sat firm on the throne since 1462.' },
];

// Простой бытовой ряд (без привязки к состоянию мира).
const EVERYDAY_RUMORS = [
    { ru: 'У соседа свинья в огород забежала — полкапусты извела. Держи ограду крепче.', en: 'A neighbour’s pig got into the garden — ate half the cabbage. Keep your fence tight.' },
    { ru: 'У Глашки свадьба на Покров играют, а приданое уже на чердаке сушат.', en: 'Glashka’s wedding is held at the Intercession, and her trousseau is already drying in the loft.' },
    { ru: 'Обоз из Москвы приходил: ратники там государевы, а соль нынче дорога.', en: 'A convoy came from Moscow: the tsar’s musketeers are there, and salt is dear these days.' },
    { ru: 'Бражник Прохор опять до петухов доплясывался — с помоста-то чуть не свалился!', en: 'Brew-lover Prokhor danced till the roosters crowed again — nearly fell right off the stage!' },
];

/**
 * Динамические наводки — собираются ПО СОСТОЯНИЮ МИРА в момент разговора.
 * @returns {Array<{ru: string, en: string}>}
 */
export function collectRumors(registry) {
    const list = [];

    // --- вор: главный «жареный» слух, пока охота идёт ---
    const hunt = getHuntState(registry);
    const q = registry.get('quest') || {};
    if (hunt && !q.thiefEscaped && !q.thiefDefeated) {
        const spots = ['river', 'forest', 'field', 'lake', 'mill', 'pasture', 'pogost', 'road_south'];
        const where = spots.find((locId) => isThiefAt(registry, locId));
        if (where) {
            const place = {
                river:    { ru: 'на реке, у брода',       en: 'by the river, at the ford' },
                forest:   { ru: 'в лесу, за опушкой',      en: 'in the forest, past the tree line' },
                field:    { ru: 'в поле, у межи',          en: 'in the field, by the boundary' },
                lake:     { ru: 'у озера',                 en: 'by the lake' },
                mill:     { ru: 'у мельницы',              en: 'by the mill' },
                pasture:  { ru: 'на выпасе',               en: 'on the pasture' },
                pogost:   { ru: 'на погосте',              en: 'at the churchyard' },
                road_south:{ ru: 'на большой южной дороге',        en: 'on the south road' },
            }[where];
            list.push({
                ru: tf(t('Фёдор понижает голос: «Видели твоего вора {0}. Только ты это не от меня слыхал».'), place.ru),
                en: tf('Fyodor lowers his voice: “They saw your thief {0}. You didn’t hear it from me.”', place.en),
            });
        } else {
            list.push({
                ru: t('Про вора этого говорят разное: кто — умчался по большой дороге, кто — в лес запропастился. Следы-то на дорогах ещё показываются.'),
                en: 'People say all sorts about that thief: some say he took to the road, others — that he is hiding deep in the forest. The tracks still show up on the roads now and then.',
            });
        }
    }

    // --- стадо: куда ушло пастись ---
    try {
        const herd = getHerdState(registry);
        if (herd && herd.place) {
            const place = {
                pasture: { ru: 'на выпасе',              en: 'to the pasture' },
                river:   { ru: 'на реку, на водопой',    en: 'to the river for water' },
                lake:    { ru: 'к озеру, на водопой',    en: 'to the lake for water' },
                mill:    { ru: 'к мельнице',             en: 'over by the mill' },
                field:   { ru: 'в поле',                 en: 'into the fields' },
            }[herd.place] || { ru: 'со двора', en: 'out of the yard' };
            list.push({
                ru: tf(t('Стадо нынче {0} угнали — пастухи дознают, где трава сочнее.'), place.ru),
                en: tf('The herd was driven {0} today — the shepherds scout where the grass is juiciest.', place.en),
            });
        }
    } catch (e) { /* стадо не заведено — слух просто не даётся */ }

    // --- погода: ПРИМЕТА ДНЯ (раунд 66.7, пп.6,7) ---
    // Слухи о погоде ВЕДУТСЯ: каждый выслушанный слух звонит в
    // recordWeatherRumor (см. tavernRumorLine); наберут 3+ об одном типе —
    // эта погода придёт завтра ВМЕСТО случайной. Примета ЕДИНА для всей
    // деревни и соответствует сезону (зимой дождя не сулят, летом снега).
    try {
        const omen = omenTypeForDay(registry);
        if (omen) {
            const line = omenLine(omen, Math.floor(Math.random() * 997));
            list.push({
                ru: t('К погоде примечай: ') + line.ru,
                en: 'Mark the sky: ' + line.en,
                __weatherOmen: true,
            });
        }
    } catch (e) { /* без времени погода не определяется */ }

    // --- сезонная работа ---
    try {
        const work = getSeasonalWork(getTime(registry));
        if (work && work.work) {
            list.push({
                ru: tf(t('Вся деревня нынче в поле: {0}. Пропустить пору — весь год пропадёт.'), work.work),
                en: tf('The whole village is out in the fields today: {0}. Miss the season and the whole year is lost.', work.work),
            });
        }
    } catch (e) { /* ок */ }

    // --- бытовые + хроника (по 1-2 за раз) ---
    const pool = [...EVERYDAY_RUMORS, ...CHRONICLE_RUMORS];
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        list.push(pool.splice(idx, 1)[0]);
    }
    return list;
}

/**
 * Слух дня для диалога корчмаря. Один визит = один слух; в день — не более
 * RUMORS_PER_DAY (порядок не повторяется: съеденные слухи «растасканы»).
 * @returns {string} реплика Фёдора (RU/EN по языку игры)
 */
export function tavernRumorLine(registry) {
    const time = getTime(registry);
    const dayKey = time ? `${time.yearFromChrist}-${time.month}-${time.day}` : 'unknown';
    const state = registry.get('rumorsDay') || null;
    const used = state && state.day === dayKey ? state.used : [];

    // не отдавать уже слышанные сегодня (ключ — русский оригинал)
    const fresh = collectRumors(registry).filter((r) => !used.includes(r.ru));
    if (used.length >= RUMORS_PER_DAY || fresh.length === 0) {
        return isEn()
            ? 'Fyodor spreads his hands: “Nothing worth hearing today — all the news has been carried off. Come back tomorrow, a convoy is due.”'
            : t('Фёдор разводит руками: «На нынче и слыхом не слыхать — весь товар молвы разобран. Заходи завтра, обоз прибудет».');
    }
    const rumor = fresh[0];
    used.push(rumor.ru);
    registry.set('rumorsDay', { day: dayKey, used });

    // РАУНД 66.7 (п.6): слух о погоде учтён в приметах — счётчик растёт,
    // на третьем слухе примета сбылась (форкаст на завтра зафиксирован).
    let omenNote = '';
    if (rumor.__weatherOmen) {
        const res = recordWeatherRumor(registry);
        if (res && res.fulfilled) {
            omenNote = isEn()
                ? '\n\n' + OMEN_FULFILLED_NOTE.en
                : `\n\n${t(OMEN_FULFILLED_NOTE.ru)}`;
        }
    }

    const line = isEn() ? rumor.en : rumor.ru;
    const suffix = used.length >= RUMORS_PER_DAY
        ? (isEn()
            ? '\n\n(That is the last rumour for today — nothing but idle talk remains.)'
            : `\n\n${t('(Это последний слух на сегодня — дальше только пересуды.)')}`)
        : '';
    return `${line}${omenNote}${suffix}`;
}

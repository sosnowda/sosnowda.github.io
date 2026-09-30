// l10n.js — ЕДИНЫЙ СЛОВАРЬ строк клиента лендинга (RU/EN).
// 66.50, приказ 1 владельца («таймлайн в EN-словаре»): строки интерактивного
// таймлайна князей (подсказка, досье Василия I / Василия II / Ивана III)
// вынесены из inline-тернарников ui.js в словарь; туда же переведены строки
// d100, попапа поддержки и тоста копирования — весь пользовательский текст
// клиента лендинга теперь живёт здесь, в двух локалях.
// Структура: UI_DICT[lang]; активная локаль экспортируется как STR.
import { IS_EN_PAGE } from './state.js';

export const LANG = IS_EN_PAGE ? 'en' : 'ru';

export const UI_DICT = {
    ru: {
        // Таймлайн князей 1400–1505 (секция #history)
        timeline: {
            hint: 'Выберите князя на ленте — между ними 105 лет эпохи.',
            reignLabel: 'Правление',
            eventsHit: { one: 'Подсвечено 1 событие хроники', many: 'Подсвечено событий: {n}' },
            none: 'В эти годы хроника молчит — они записаны в деревенских преданиях.',
            dosier: {
                vasily1: {
                    name: 'Василий I Дмитриевич',
                    years: 'Великий князь 1389–1425',
                    text: 'Продолжил собирание земель: Нижний Новгород присоединён к Москве (1392). Отразил нашествие Едигея (1408), укрепил Москву новым кремлём. Дань Орде Русь платит, но уже сама выбирает, какому из ханов её везти.'
                },
                vasily2: {
                    name: 'Василий II «Тёмный»',
                    years: 'Великий князь 1425–1462',
                    text: 'Феодальная война 1425–1453: борьба с Юрием Звенигородским и Василием Косым за престол. Ослеплён в 1446 году, но удержал великое княжение; в 1448 Русская церковь стала автокефальной. Престол передал сыну Ивану III.'
                },
                ivan3: {
                    name: 'Иван III «Великий»',
                    years: 'Великий князь 1462–1505',
                    text: 'Сверг ордынское иго (Стояние на Угре, 1480), присоединил Новгород (1478), издал Судебник (1497) и поставил новый Московский Кремль. Первый «Государь всея Руси».'
                },
            },
        },
        // Интерактивный d100 (BRP-бросок)
        d100: {
            rolling: 'Бросаем…', luck: 'Удача!', special: 'Особый!',
            success: 'Успех', fail: 'Провал!', tail: ' (выпало {r} из 100)',
        },
        // Попап поддержки
        popup: { closeAria: 'Закрыть окно поддержки' },
        // Тост копирования ссылки
        toast: {
            copied: 'Ссылка скопирована!',
            failed: 'Не удалось скопировать — скопируйте адрес из строки браузера',
        },
    },
    en: {
        // Princes timeline 1400–1505 (#history section)
        timeline: {
            hint: 'Select a prince on the ribbon — 105 years of the era between them.',
            reignLabel: 'Reign',
            eventsHit: { one: '1 chronicle event highlighted', many: '{n} chronicle events highlighted' },
            none: 'No chronicle events in these years — they are recorded in the village legends.',
            dosier: {
                vasily1: {
                    name: 'Vasily I Dmitriyevich',
                    years: 'Grand Prince 1389–1425',
                    text: 'Continued gathering the lands: Nizhny Novgorod joined Moscow (1392). Withstood Edigu\u2019s raid (1408) and fortified Moscow with a new kremlin. Rus\u2019 still paid tribute to the Horde, but already chose which khan to carry it to.'
                },
                vasily2: {
                    name: 'Vasily II the Dark',
                    years: 'Grand Prince 1425–1462',
                    text: 'The feudal war of 1425–1453: struggle against Yuri of Zvenigorod and Vasily the Cross-Eyed for the throne. Blinded in 1446, yet kept the grand princedom; in 1448 the Russian Church became autocephalous. Passed the throne to his son Ivan III.'
                },
                ivan3: {
                    name: 'Ivan III the Great',
                    years: 'Grand Prince 1462–1505',
                    text: 'Cast off the Horde yoke (Stand on the Ugra, 1480), annexed Novgorod (1478), issued the Law Code of 1497 and raised the new Moscow Kremlin. First «Sovereign of All Rus\u2019».'
                },
            },
        },
        // Interactive d100 (BRP roll)
        d100: {
            rolling: 'Rolling…', luck: 'Luck!', special: 'Special!',
            success: 'Success', fail: 'Failure!', tail: ' (rolled {r} of 100)',
        },
        // Support popup
        popup: { closeAria: 'Close support dialog' },
        // Copy-link toast
        toast: {
            copied: 'Link copied!',
            failed: 'Could not copy — please copy the address from the browser bar',
        },
    },
};

// Активная локаль страницы (ru по умолчанию, en на /en/)
export const STR = UI_DICT[LANG];

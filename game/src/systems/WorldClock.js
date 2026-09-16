// ЕДИНЫЕ МИРОВЫЕ ЧАСЫ (раунды 31–32, по спецификации владельца):
//  раунд 31, п.10 — на исследование следов тратится 1 час реального времени;
//  раунд 31, п.11 — на разговор с НПЦ ВСЕГДА тратится 1 час реального времени;
//  раунд 31, п.12 — во время разговора отсчёт реального времени ПРИОСТАНАВЛИВАЕТСЯ.
//  раунд 32, п.14 — СООТНОШЕНИЕ РЕАЛЬНОГО И ИГРОВОГО ВРЕМЕНИ = 1:30:
//    за одну минуту реального времени проходит 30 минут игрового
//    (полные игровые сутки — за 48 реальных минут).
//
// Как это работает:
//  - Мировое время (timeState из TimeSystem) течёт само: каждая реальная
//    минута = 30 ИГРОВЫХ минут (attachWorldClock в главных сценах, п.14).
//  - Пока открыт ЛЮБОЙ диалог (createDialog/DialogueRunner) часы стоят:
//    счётчик clockPauseCount > 0 — тикер молчит (п.12).
//  - Когда разговор заканчивается, списывается ровно 1 час
//    (chargeTalkTime, п.11); обследование следа списывает свой час
//    прямо в examineFootprint (п.10). Вор двигается не чаще ОДНОГО шага
//    в игровой час (раунд 32, п.2 — TICK_MINUTES = 60 в data/thief.js).
//
// Модуль чистый: без Phaser-зависимостей, работает и в headless-тестах.

import { tickTime } from './TimeSystem.js';
import { tk } from './i18n.js';

// Раунд 32 (пп.14,15): ОБЯЗАТЕЛЬНАЯ строка «Информации по игре» (F1):
// соотношение реального и игрового времени 1:30 + час на перемещение/разговор.
export const TIME_RATIO_KEY = 'help.timeRatio';
export function timeRatioInfoLine() {
    return tk(TIME_RATIO_KEY,
        '⏱ ВРЕМЯ: 1 минута реального времени = 30 минут игрового (соотношение 1:30),\n' +
        '  полные игровые сутки проходят за 48 реальных минут.\n' +
        '  Любое перемещение между локациями по карте — РОВНО 1 игровой час.\n' +
        '  Разговор с НПЦ — 1 час; обследование следа — 1 час.\n' +
        '  Во время разговора отсчёт реального времени приостанавливается.\n' +
        '  Вор делает НЕ БОЛЕЕ ОДНОГО ШАГА в игровой час.');
}

// Сколько минут списывается за один разговор с НПЦ (п.11: всегда 1 час)
export const TALK_MINUTES = 60;
// Раунд 32 (п.14): сколько ИГРОВЫХ минут проходит за одну реальную минуту.
export const GAME_MINUTES_PER_REAL_MINUTE = 30;
// Окно «той же беседы» (мс): подсказка-поп-ап, открытая из разговора,
// не списывает второй час — беседа одна.
const SAME_TALK_WINDOW_MS = 90000;

export function isClockPaused(registry) {
    return (registry.get('clockPauseCount') || 0) > 0;
}

/** Открыт диалог — часы стоят (п.12). */
export function pauseWorldClock(registry) {
    registry.set('clockPauseCount', (registry.get('clockPauseCount') || 0) + 1);
}

/** Диалог закрыт — часы снова идут. */
export function resumeWorldClock(registry) {
    const n = Math.max(0, (registry.get('clockPauseCount') || 0) - 1);
    registry.set('clockPauseCount', n);
}

/**
 * Списать время разговора (п.11): ровно 1 час на беседу.
 * key — «кто с кем говорил»: повторное закрытие поп-апа той же беседы
 * в течение SAME_TALK_WINDOW_MS не списывает второй час.
 */
export function chargeTalkTime(registry, minutes = TALK_MINUTES, key = null) {
    if (!minutes || minutes <= 0) return false;
    const now = Date.now();
    const prev = registry.get('lastTalkCharge');
    if (key && prev && prev.key === key && (now - prev.at) < SAME_TALK_WINDOW_MS) {
        return false; // та же беседа — время уже списано
    }
    if (key) registry.set('lastTalkCharge', { key, at: now });
    tickTime(registry, minutes);
    return true;
}

/**
 * Подключить ход реального времени к сцене (п.12 без диалогов).
 * Раунд 32 (п.14): каждые intervalSec реальных секунд = intervalSec/60
 * реальных минут × 30 игровых минут = intervalSec/2 ИГРОВЫХ минут.
 * При интервале 60 с — ровно 30 игровых минут за реальную минуту (1:30).
 * Тикер срабатывает каждые 15 реальных секунд (+7.5 игровых минут),
 * чтобы время шло плавно, но сумма за минуту — всегда 30 игровых минут.
 * Только если часы не стоят на паузе (открыт диалог).
 * При перезапуске/смене сцены пауза сбрасывается — «висящие» диалоги
 * не могут остановить время навсегда.
 */
export function attachWorldClock(scene, { intervalSec = 60 } = {}) {
    const registry = scene.registry;
    scene.events.once('shutdown', () => {
        // Сцена ушла — все её диалоги уничтожены: пауз больше нет
        if (registry) registry.set('clockPauseCount', 0);
    });
    // Плавный ход: каждые 15 реальных секунд — четверть игровой минуты×30
    const stepSec = 15;
    const gameMinutesPerStep = (GAME_MINUTES_PER_REAL_MINUTE * stepSec) / 60; // 7.5
    let accum = 0;
    scene.time.addEvent({
        delay: stepSec * 1000,
        loop: true,
        callback: () => {
            if (!scene.scene || !scene.scene.isActive()) return;
            if (isClockPaused(registry)) return; // п.12: разговор — время стоит
            accum += gameMinutesPerStep;
            if (accum >= 1) {
                const whole = Math.floor(accum);
                accum -= whole;
                tickTime(registry, whole);
            }
        },
    });
    // Проверка: за 60 реальных секунд набирается ровно 30 игровых минут
    void intervalSec;
}

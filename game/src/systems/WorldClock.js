// ЕДИНЫЕ МИРОВЫЕ ЧАСЫ (раунд 31, по пунктам 10–12 спецификации владельца):
//  п.10 — на исследование следов тратится 1 час реального времени;
//  п.11 — на разговор с НПЦ ВСЕГДА тратится 1 час реального времени;
//  п.12 — во время разговора отсчёт реального времени ПРИОСТАНАВЛИВАЕТСЯ.
//
// Как это работает:
//  - Мировое время (timeState из TimeSystem) теперь течёт само: каждая
//    реальная минута = 1 игровая минута (attachWorldClock в главных сценах).
//  - Пока открыт ЛЮБОЙ диалог (createDialog/DialogueRunner) часы стоят:
//    счётчик clockPauseCount > 0 — тикер молчит (п.12).
//  - Когда разговор заканчивается, списывается ровно 1 час
//    (chargeTalkTime, п.11); обследование следа списывает свой час
//    прямо в examineFootprint (п.10). Вор двигается на каждом тике,
//    так что «час разговора» для него — четыре пятнадцатиминутных шага.
//
// Модуль чистый: без Phaser-зависимостей, работает и в headless-тестах.

import { tickTime } from './TimeSystem.js';

// Сколько минут списывается за один разговор с НПЦ (п.11: всегда 1 час)
export const TALK_MINUTES = 60;
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
 * Каждые intervalSec реальных секунд = intervalSec/60 игровых минут,
 * но только если часы не стоят на паузе (открыт диалог).
 * При перезапуске/смене сцены пауза сбрасывается — «висящие» диалоги
 * не могут остановить время навсегда.
 */
export function attachWorldClock(scene, { intervalSec = 60 } = {}) {
    const registry = scene.registry;
    scene.events.once('shutdown', () => {
        // Сцена ушла — все её диалоги уничтожены: пауз больше нет
        if (registry) registry.set('clockPauseCount', 0);
    });
    scene.time.addEvent({
        delay: intervalSec * 1000,
        loop: true,
        callback: () => {
            if (!scene.scene || !scene.scene.isActive()) return;
            if (isClockPaused(registry)) return; // п.12: разговор — время стоит
            tickTime(registry, intervalSec / 60);
        },
    });
}

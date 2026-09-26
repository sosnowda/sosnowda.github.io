// MotionFX.js — 66.31 (приказ владельца, п.2): ЧАСТИЦЫ ПОД КОНТРОЛЕМ
// БАТАРЕИ И ДОСТУПНОСТИ.
//
// Две независимые защиты:
//   1) prefers-reduced-motion — у пользователя включено «уменьшить движение»
//      (ОС/браузер). Эмиттеры частиц создаются, но СРАЗУ НЕ ИСПУСКАЮТ
//      частицы (config.emitting: false): весь код сцен (setDepth/stop/
//      explode) продолжает работать, но ни одна частица не рождается —
//      дождь/снег/листву/искры заменяет статичное затенение и код погоды.
//   2) document.visibilityState === 'hidden' (свернули вкладку/ушли в
//      другое приложение на телефоне) — все эмиттеры ПРИОСТАНАВЛИВАЮТСЯ;
//      по возврату во вкладку возобновляются. RAF-цикл Phaser и так замирает
//      в фоне, но на мобильных браузер может «докручивать» кадры — теперь
//      эмиттеры гарантированно спят, а возврат не «взрывает» накопившиеся
//      частицы.
//
// Механика: патч Phaser.GameObjects.GameObjectFactory.prototype.particles
// (scene.add.particles) ставится в BootScene — единственном модуле,
// гарантированно исполняемом до любых сцен (точка входа импортирует сцены
// напрямую, минуя src/main.js). Патч: (а) при reduced-motion принудительно
// emitting: false; (б) регистрирует эмиттер в реестре для паузы/возобновления.
// Реестр чистится при shutdown сцены — утечек нет.
//
// Публичное API:
//   reducedMotion()          — кэшированная проверка (с QA-оверрайдом ?motion=full)
//   installFxGovernor()      — поставить патч фабрики (однократно)
//   trackEmitter(scene, em)  — вручную зарегистрировать эмиттер (для редких
//                              случаев, созданных мимо фабрики)
//   suspendFx() / resumeFx() — программная пауза/возобновление всех эмиттеров

const FX_KEY = '__chroniclesFxGovernor';

let _reducedCache = null;

/** «Уменьшить движение» включено? (кэшируется; ?motion=full — QA-обход) */
export function reducedMotion() {
    if (_reducedCache === null) {
        try {
            const p = new URLSearchParams(window.location.search);
            if (p.get('motion') === 'full') { _reducedCache = false; return false; }
        } catch (e) { /* noop */ }
        try {
            _reducedCache = !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) {
            _reducedCache = false;
        }
    }
    return _reducedCache;
}

/** Реестр живых эмиттеров по сценам: Map<scene, Set<emitter>> */
function registryMap() {
    if (!window[FX_KEY]) {
        window[FX_KEY] = {
            emitters: new Map(),
            suspended: false,
            installed: false,
        };
    }
    return window[FX_KEY];
}

function trackEmitter(scene, emitter) {
    if (!scene || !emitter) return emitter;
    const gov = registryMap();
    let set = gov.emitters.get(scene);
    if (!set) {
        set = new Set();
        gov.emitters.set(scene, set);
        // При уходе сцены (restart/shutdown/stop) — снять с учёта, чтобы
        // Map не копила мёртвые ссылки.
        try {
            scene.events.once('shutdown', () => { set.clear(); gov.emitters.delete(scene); });
            scene.events.once('destroy', () => { set.clear(); gov.emitters.delete(scene); });
        } catch (e) { /* noop */ }
    }
    set.add(emitter);
    // Если вкладка уже скрыта (эмиттер создан в фоне) — сразу спать.
    if (gov.suspended) pauseEmitter(emitter);
    return emitter;
}

function pauseEmitter(em) {
    try { if (em && typeof em.pause === 'function' && !em.paused) em.pause(); } catch (e) { /* noop */ }
}

function resumeEmitter(em) {
    try { if (em && typeof em.resume === 'function' && em.paused) em.resume(); } catch (e) { /* noop */ }
}

/** Приостановить все зарегистрированные эмиттеры (вкладка скрыта). */
export function suspendFx() {
    const gov = registryMap();
    if (gov.suspended) return;
    gov.suspended = true;
    gov.emitters.forEach((set) => set.forEach(pauseEmitter));
}

/** Возобновить эмиттеры (вкладка снова видима). */
export function resumeFx() {
    const gov = registryMap();
    if (!gov.suspended) return;
    gov.suspended = false;
    gov.emitters.forEach((set) => set.forEach(resumeEmitter));
}

/**
 * Патч фабрики частиц + глобальный слушатель visibilitychange.
 * Вызывать ОДИН раз из BootScene (модуль верхнего уровня).
 */
export function installFxGovernor() {
    const gov = registryMap();
    if (gov.installed) return;
    gov.installed = true;

    // (а) reduced-motion: эмиттер создаётся «спящим» — ни одной частицы.
    if (typeof Phaser !== 'undefined' &&
        Phaser.GameObjects && Phaser.GameObjects.GameObjectFactory &&
        Phaser.GameObjects.GameObjectFactory.prototype) {
        const factory = Phaser.GameObjects.GameObjectFactory.prototype;
        if (typeof factory.particles === 'function' && !factory.__chroniclesGoverned) {
            const origParticles = factory.particles;
            factory.particles = function (x, y, texture, config) {
                let cfg = config;
                if (reducedMotion()) {
                    cfg = Object.assign({}, (config && typeof config === 'object') ? config : {}, {
                        emitting: false,
                    });
                }
                const emitter = origParticles.call(this, x, y, texture, cfg);
                return trackEmitter(this.scene, emitter);
            };
            factory.__chroniclesGoverned = true;
        }
    }

    // (б) батарея: вкладка скрыта — эмиттеры спят; вернулись — проснулись.
    try {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') suspendFx();
            else resumeFx();
        });
    } catch (e) { /* noop */ }
}

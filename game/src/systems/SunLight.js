// SunLight.js — патч 66.46 (приказы владельца 1–2): ХОД СОЛНЦА ТЕНЯМИ И СВЕТОМ.
//
// Виджет-«небесная полоска» с солнцем (66.23) снят по приказу «удалить
// ненужный виджет с солнцем в локации деревня». Вместо служебной плашки ход
// солнца, рассветы и закаты теперь видны САМИ — как в жизни:
//
//   1) ТЕНИ. У домов, деревьев, колодца, ворот и персонажей лежит мягкая
//      тень-эллипс, которая ЗАВИСИТ ОТ ПОЗИЦИИ СОЛНА по настоящему
//      сезонному расписанию (AccessHours.sunTimes по дате — канон 66.22):
//        • утром солнце на востоке — тени вытянуты ЗАПАД (влево);
//        • к полудню тени укорачиваются и ложатся «под ноги»;
//        • вечером солнце на западе — тени растут на восток (вправо);
//        • чем короче световой день (зима), тем длиннее утренние/вечерние
//          тени и тем ниже само солнце;
//        • ночью солнечных теней нет (остаются ночные свечения окон).
//   2) СМЕНА ОСВЕЩЕНИЯ. Поверх сцены — мягкий тёплый слой (ADD): заря
//      красит локацию золотисто-розовым, ясный день почти нейтрален,
//      закат наливается багрянцем, ночь гасит тёплый слой в ноль
//      (тёмный multiply-оверлей дня/ночи уже существует в сценах).
//
// Чистая функция sunShadowState() покрывается юнит-тестом (test_round101).
// Прикрепление к сцене — attachSunLight(scene, opts): сцена регистрирует
// «отбрасыватели» (дома/деревья) и «следующие за спрайтами» тени (герой,
// НПЦ), затем зовёт update(timeState) из updateHUD (раз в секунду достаточно:
// солнце проходит небо за 2–6 реальных минут).

import { sunTimes } from './AccessHours.js';

/**
 * Состояние солнечного света (чистая функция).
 * @param {{hour:number, minute:number, month?:number, day?:number}} timeState
 * @returns {{
 *   up: number,        // 0..1 — солнце над горизонтом (0 ночь, 1 зенит дня)
 *   dir: number,       // -1..+1 — куда падает тень по горизонтали
 *                      //   (утро: тень на запад = -1; вечер: на восток = +1)
 *   len: number,       // 0.55..1.9 — множитель длины тени
 *   alpha: number,     // 0..0.34 — плотность солнечных теней
 *   warm: number,      // 0..1 — сила тёплого слоя (заря/закат)
 *   warmColor: number, // цвет тёплого слоя
 *   phase: string      // 'night'|'dawn'|'morning'|'noon'|'evening'|'dusk'
 * }}
 */
export function sunShadowState(timeState) {
    const empty = { up: 0, dir: 0, len: 1, alpha: 0, warm: 0, warmColor: 0xffffff, phase: 'night' };
    if (!timeState || typeof timeState.hour !== 'number') return empty;
    const hasDate = Number.isFinite(timeState.month) && Number.isFinite(timeState.day);
    let sr = 6, ss = 18;
    if (hasDate) ({ sunrise: sr, sunset: ss } = sunTimes(timeState.month, timeState.day));
    const h = timeState.hour + (typeof timeState.minute === 'number' ? timeState.minute : 0) / 60;
    if (!(ss > sr)) return empty;

    const TW = 1; // полуширина сумеречной зоны, часов (канон TimeSystem)
    const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

    // Доля пройденного светового дня 0..1 (вне дня — за краями)
    const p = (h - sr) / (ss - sr);

    // Ночь (с запасом сумерек) — солнечных теней нет
    if (h < sr - TW || h >= ss + TW) return { ...empty, phase: 'night' };

    // Заря (до восхода): тени почти нет, тёплый слой растёт
    if (h < sr) {
        const k = smooth((h - (sr - TW)) / TW);
        return { up: 0.06 * k, dir: -1, len: 1.9 - 0.1 * k, alpha: 0.10 * k, warm: 0.85 * k,
            warmColor: 0xff9a50, phase: 'dawn' };
    }
    // Утро (восход + сумеречная зона): длинные тени на запад, заря догорает
    if (h < sr + TW) {
        const k = smooth((h - sr) / TW);
        return { up: 0.15 + 0.35 * k, dir: -1 + 0.4 * k, len: 1.9 - 0.9 * k, alpha: 0.12 + 0.14 * k,
            warm: 0.85 * (1 - k), warmColor: 0xffa860, phase: 'dawn' };
    }
    // День: тени от «утренних» к «вечерним», минимум в полдень
    if (h < ss - TW) {
        const dayP = Math.max(0, Math.min(1, (p - 0.08) / 0.84)); // 0 утро..1 вечер
        // dir: -1 (запад) → 0 (полдень) → +1 (восток); len: длинные → короткие → длинные
        const dir = -1 + 2 * dayP;
        const noonK = 1 - Math.abs(dayP - 0.5) * 2;               // 1 в полдень
        // Чем КОРОЧЕ световой день, тем ниже полдечное солнце и длиннее
        // тени в зените (зима против лета): 0.55 летом → до ~0.68 зимой
        const dayLen = ss - sr;
        const noonLen = 0.55 + 0.35 * Math.max(0, Math.min(1, (10 - dayLen) / 10));
        const len = noonLen + (1 - noonK) * (1.9 - noonLen) * 0.55;
        const up = 0.5 + 0.5 * noonK;
        // Ясный день — почти нейтрален; к краям дня лёгкое тепло
        const warm = 0.16 * (1 - noonK);
        return { up, dir, len, alpha: 0.24 + 0.08 * (1 - noonK),
            warm, warmColor: dayP < 0.5 ? 0xffd9a0 : 0xffb878, phase: noonK > 0.66 ? 'noon' : (dayP < 0.5 ? 'morning' : 'evening') };
    }
    // Предзакатные сумерки: тени на восток, багрянец
    if (h < ss) {
        const k = smooth((h - (ss - TW)) / TW);
        return { up: 0.5 - 0.35 * k, dir: 0.6 + 0.4 * k, len: 0.9 + 0.6 * k, alpha: 0.32 - 0.18 * k,
            warm: 0.55 + 0.35 * k, warmColor: 0xff7a30, phase: 'dusk' };
    }
    // Закат → ночь: тени гаснут, тёплый слой догорает
    const k = smooth((h - ss) / TW);
    return { up: 0.15 * (1 - k), dir: 1, len: 1.9 - 0.2 * k, alpha: 0.14 * (1 - k),
        warm: 0.55 * (1 - k), warmColor: 0xff6a40, phase: k < 0.5 ? 'dusk' : 'night' };
}

/**
 * Прикрепить солнечный свет к сцене.
 * @param {Phaser.Scene} scene
 * @param {Object} [opts]
 *   - shadowDepth: глубина Graphics теней (лежат НА ЗЕМЛЕ: выше ground-тайлов,
 *     ниже деревьев/домов/персонажей; деревня: 0.35 — тайлы 0, деревья y+0.4)
 *   - overlayDepth: глубина тёплого слоя (ниже multiply-оверлея дня/ночи 90)
 *   - worldShadows: true (по умолчанию) — тени в мировых координатах (камера
 *     скроллит), тёплый слой всегда экранный (scrollFactor 0)
 * @returns {{ update(timeState): void, addCaster(Function): void,
 *             follow(sprite, rx, ry, k?): void, updateFollowers(): void }}
 *   update(timeState) — перерисовать статичные тени/слой (звать из updateHUD,
 *     раз в секунду достаточно — солнце идёт медленно);
 *   addCaster(fn) — поставщик статичных теней: fn() → [{x,y,rx,ry,k?}]
 *     (функция, а не массив: сцена может перестраивать объекты);
 *   follow(sprite, rx, ry, k) — тень, следующая за спрайтом (герой/НПЦ):
 *     отдельный лёгкий эллипс, позиция обновляется в updateFollowers()
 *     (сцена зовёт его из update() каждый кадр — это просто setPosition).
 */
export function attachSunLight(scene, opts = {}) {
    const shadowDepth = Number.isFinite(opts.shadowDepth) ? opts.shadowDepth : 0.35;
    const overlayDepth = Number.isFinite(opts.overlayDepth) ? opts.overlayDepth : 89;
    const worldShadows = opts.worldShadows !== false; // тени в мировых координатах

    // Тёплый слой освещения (экранный, ADD) — под multiply-оверлеем дня/ночи
    const warmOverlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0xffffff, 0)
        .setOrigin(0).setScrollFactor(0).setDepth(overlayDepth)
        .setBlendMode(Phaser.BlendModes.ADD);

    // Graphics статичных теней (мир)
    const shadowGfx = scene.add.graphics().setDepth(shadowDepth);
    if (!worldShadows && shadowGfx.setScrollFactor) shadowGfx.setScrollFactor(0);

    const casterProviders = [];  // () => [{x,y,rx,ry,k}]
    const followers = [];        // { sprite, rx, ry, k, ell }

    const paint = (g, st, x, y, rx, ry, k) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || rx <= 0) return;
        const kk = k == null ? 1 : k;
        const stretch = 0.72 + 0.5 * st.len;           // тень длиннее на рассвете/закате
        const offX = st.dir * st.len * rx * 1.05;       // сдвиг по ходу тени
        const flat = 1 - Math.min(0.35, 0.18 * st.len); // чем длиннее, тем площе
        g.fillStyle(0x0a0806, Math.min(0.5, st.alpha * kk));
        g.fillEllipse(x + offX, y + ry * 0.12, rx * 2 * stretch, ry * 2 * flat);
        // Ядро тени под основанием — плотнее
        g.fillStyle(0x0a0806, Math.min(0.5, st.alpha * kk * 0.9));
        g.fillEllipse(x + offX * 0.35, y + ry * 0.1, rx * 1.5, ry * 1.7 * flat);
    };

    const drawStatic = (st) => {
        shadowGfx.clear();
        if (!st || st.alpha <= 0.01) return;
        casterProviders.forEach((prov) => {
            let pts = null;
            try { pts = prov(); } catch (e) { pts = null; }
            if (!Array.isArray(pts)) return;
            pts.forEach((c) => { if (c) paint(shadowGfx, st, c.x, c.y, c.rx, c.ry, c.k); });
        });
    };

    // Следящие тени — отдельные эллипсы (Shape): updateFollowers() только
    // двигает их (дёшево для вызова каждый кадр из scene.update()).
    const updateFollowers = () => {
        const st = lastState;
        followers.forEach((f) => {
            const s = f.sprite;
            if (!st || st.alpha <= 0.01 || !s || !s.scene || !s.active) {
                if (f.ell) f.ell.setVisible(false);
                return;
            }
            if (!f.ell || !f.ell.scene) {
                f.ell = scene.add.ellipse(0, 0, f.rx * 2, f.ry * 2, 0x0a0806, 1)
                    .setBlendMode(Phaser.BlendModes.NORMAL);
            }
            const stretch = 0.72 + 0.5 * st.len;
            const offX = st.dir * st.len * f.rx * 1.05;
            // Ступни спрайта: низ кадра минус нижний пустой край листа
            const feetY = s.y + (s.displayHeight || 64) * 0.46;
            f.ell.setVisible(true)
                .setPosition(s.x + offX, feetY + f.ry * 0.12)
                .setScale(stretch, 1 - Math.min(0.35, 0.18 * st.len))
                .setAlpha(Math.min(0.5, st.alpha * f.k))
                .setDepth(shadowDepth + 0.01);   // тень ЛЕЖИТ НА ЗЕМЛЕ: под домами/деревьями
        });
    };

    let lastState = null;
    const update = (timeState) => {
        const st = sunShadowState(timeState);
        lastState = st;
        // Тёплый слой
        if (st.warm > 0.01) {
            warmOverlay.setFillStyle(st.warmColor, Math.min(0.2, st.warm * 0.2));
            warmOverlay.setVisible(true);
        } else {
            warmOverlay.setVisible(false);
        }
        drawStatic(st);
        updateFollowers();
    };

    const api = {
        _gfx: shadowGfx,
        _overlay: warmOverlay,
        addCaster: (prov) => { if (typeof prov === 'function') casterProviders.push(prov); },
        follow: (sprite, rx, ry, k) => { followers.push({ sprite, rx, ry, k: k == null ? 1 : k, ell: null }); },
        updateFollowers,
        update,
    };
    // Первичная отрисовка текущим временем
    try { update(scene.registry && scene.registry.get('gameTime')); } catch (e) { /* сцена без времени */ }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        followers.forEach((f) => { if (f.ell && f.ell.scene) f.ell.destroy(); });
        if (shadowGfx && shadowGfx.scene) shadowGfx.destroy();
        if (warmOverlay && warmOverlay.scene) warmOverlay.destroy();
    });
    return api;
}

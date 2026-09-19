// CharacterAppearance.js — система композитинга слоёв LPC в один spritesheet.
// Используется CharacterGeneratorScene для генерации уникального внешнего вида
// персонажа во время игры.
//
// LPC spritesheet layout (832×2944 = 13 cols × 46 rows of 64×64):
//   rows 0-7:   spellcast (4 dirs × 2 rows: overhead + main)
//   rows 8-11:  walk (down, left, right, up)  ← используем это
//   row 12:     hurt
//   rows 13-16: slash (4 dirs)
//   rows 17-20: thrust (4 dirs)
//   rows 21-24: shoot (4 dirs)
//
// Для нашего top-down персонажа нужна только walk-анимация в 4 направлениях.
// Мы компонуем выбранные слои (body + eyes + beards + hair + legs + feet + torso)
// в один Canvas-текстурный spritesheet размером:
//   4 строки (down/left/right/up) × 9 кадров walk + 1 idle = 10 колонок
//   Размер: 640×256 px (10×4 of 64×64)

const FRAME_SIZE = 64;
const LPC_SHEET_COLS = 13;
const WALK_ROW_OFFSET = 8; // в LPC-листе walk начинается с 8-й строки (0-индекс)
const WALK_FRAMES = 8;     // 8 кадров walk в каждом ряду LPC (0-7, последний ~ пустой)
const IDLE_FRAME_IDX = 0;  // первый кадр ряда — idle

// РАУНД 39 (пп.3,8,9 заявки): КРИТИЧЕСКИЙ ФИКС ориентации.
// В универсальном LPC-листе walk-строки идут в порядке UP → LEFT → DOWN → RIGHT:
//   строка 8 = СПИНОЙ к камере (up), 9 = влево, 10 = ЛИЦОМ к камере (down), 11 = вправо.
// Это подтверждено попиксельной проверкой слоя глаз (глаза есть только на строках 9/10/11,
// на строке 10 — ровно вдвое больше пикселей глаз, чем в профиль).
// Раньше строки мапились как down/left/right/up — все персонажи «спиной к игроку»,
// с лицом, закрытым волосами (задача 9) и без лица у героя (задача 8).
export const LPC_WALK_ROW = { up: 8, left: 9, down: 10, right: 11 };

// РАУНД 61 (п.9 приказа владельца «одежда висит отдельно от тела»): ВСЕ
// смещения слоёв ОБНУЛЕНЫ. Диагноз: слои текущего пака (Universal-LPC-
// Spritesheet-Character-Generator, см. assets/lpc/manifest.json) нарисованы
// на ЕДИНОЙ сетке 64×64 и попиксельно совмещены: в кадре walk-down тело
// занимает y32..62, рубаха y32..47, глаза y29..32, волосы y12..27, ноги
// y44..56, обувь y49..62 — всё сходится БЕЗ сдвигов. Смещения раунда 39
// (torso +8, hair +7, eyes +8, beards +7) были выверены для СТАРОГО набора
// слоёв с другими базовыми линиями; на нынешнем паке они рвали композит:
// рубаха сползала на пояс (голая грудь), волосы — на лицо, борода — на шею.
// Механизм смещения оставлен (нужен, если когда-нибудь вернутся слои с
// чужими базовыми линиями), но все значения = 0.
const CATEGORY_Y_OFFSET = {
    body: 0,
    eyes: 0,
    beards: 0,
    hair: 0,
    legs: 0,
    feet: 0,
    torso: 0,
    chest: 0,   // оверлей груди генерируется уже привязанным
    extra: 0,
};

const DIRECTIONS = ['down', 'left', 'right', 'up']; // порядок строк в НАШЕМ выходном листе

/**
 * Compose — собирает единый spritesheet из выбранных LPC-слоёв.
 *
 * @param {Phaser.Scene} scene — текущая сцена (для доступа к this.textures)
 * @param {Object} appearance — { body, eyes, beards, hair, legs, feet, torso } —
 *                              каждый ключ — имя файла (без расширения) из lpc/<category>/
 * @param {string} textureKey — имя итоговой текстуры (например, 'player_custom')
 * @returns {boolean} true если успешно
 */
export function composeCharacterTexture(scene, appearance, textureKey = 'player_custom') {
    if (!scene.cache.json.has('lpc_manifest')) {
        console.warn('LPC manifest not loaded');
        return false;
    }
    const manifest = scene.cache.json.get('lpc_manifest');

    // 10 cols × 4 rows × 64px = 640×256
    const OUT_COLS = 9; // 8 walk + 1 idle (в каждой строке)
    const OUT_ROWS = 4;
    const OUT_W = OUT_COLS * FRAME_SIZE;
    const OUT_H = OUT_ROWS * FRAME_SIZE;

    // Раунд 41 (QA-фикс ФАТАЛЬНОЙ гонки с рендером): раньше текстура
    // УДАЛЯЛАСЬ (textures.remove) и добавлялась заново. Между этими шагами
    // спрайт, уже отрисовывающий этот ключ, попадал на удалённый frame →
    // «reading 'sourceSize' of null» ВНУТРИ Game.step → rAF-цепочка Phaser
    // умирала и игра молча замирала (кадры не идут, сцены не обновляются).
    // Теперь ключ обновляется НА МЕСТЕ: существующий canvas очищается и
    // перерисовывается, затем tex.refresh() — без remove/add.
    let canvas = null;
    let existingTex = null;
    if (scene.textures.exists(textureKey)) {
        const tex = scene.textures.get(textureKey);
        const src = tex.source && tex.source[0];
        if (src && src.image && src.image.tagName === 'CANVAS' &&
            src.image.width === OUT_W && src.image.height === OUT_H) {
            existingTex = tex;
            canvas = src.image;
        } else {
            scene.textures.remove(textureKey); // не canvas/другой размер — честная замена
        }
    }
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = OUT_W;
        canvas.height = OUT_H;
    }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, OUT_W, OUT_H);

    // Порядок слоёв (снизу вверх): body, HEAD, eyes, beards, hair, legs, feet,
    // torso, chest (раунд 39, п.4: грудь у женских персонажей — поверх одежды), extra (плащ)
    // РАУНД 61: между body и eyes вставлен слой HEAD (см. ensureHeadTextures):
    // в текущем паке файлы body/* ГОЛОВЫ НЕ СОДЕРЖАТ (только торс/руки/ноги
    // с шеей-культи на y32..38), а волосы/глаза/бороды нарисованы под
    // «высокого» персонажа с головой y12..40. Голова собирается отдельно
    // под цвет кожи тела и кладётся сразу после body.
    const baseOrder = manifest.layer_order
        ? [...manifest.layer_order, 'chest']
        : ['body', 'eyes', 'beards', 'hair', 'legs', 'feet', 'torso', 'chest'];
    const layerOrder = [];
    baseOrder.forEach(cat => {
        layerOrder.push(cat);
        if (cat === 'body') layerOrder.push('head');
    });

    // Для каждого направления (down, left, right, up)
    let allFound = true;
    for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx];
        // РАУНД 39: источник — ПРАВИЛЬНАЯ строка LPC-листа (up=8, left=9, down=10, right=11)
        const lpcRow = LPC_WALK_ROW[dir];
        const outRow = dirIdx;

        // Idle кадр (первый в ряду LPC)
        // 8 walk кадров (LPC cols 1-8)
        for (let frameIdx = 0; frameIdx < OUT_COLS; frameIdx++) {
            const lpcCol = (frameIdx === OUT_COLS - 1) ? IDLE_FRAME_IDX : frameIdx;
            const outCol = frameIdx;
            const outX = outCol * FRAME_SIZE;
            const outY = outRow * FRAME_SIZE;

            // Композим все слои в этот кадр
            for (const category of layerOrder) {
                const optionName = (category === 'head')
                    ? (appearance.head || appearance.body)      // голова — цветом тела
                    : appearance[category];
                if (!optionName) continue;
                const texKey = `lpc_${category}_${optionName}`;
                if (!scene.textures.exists(texKey)) {
                    if (category === 'head') continue;          // головы нет — рисуем как раньше (не фолбэк!)
                    // Пробуем загрузить — но в нашей архитектуре слои уже загружены
                    // CharacterGeneratorScene'ом. Если нет — пропускаем.
                    console.warn(`LPC layer not loaded: ${texKey}`);
                    allFound = false;
                    continue;
                }
                // Извлекаем нужный кадр из LPC-слоя
                const tex = scene.textures.get(texKey);
                const sourceImg = tex.source[0].image;
                // LPC: col=lpcCol, row=lpcRow
                const sx = lpcCol * FRAME_SIZE;
                const sy = lpcRow * FRAME_SIZE;
                if (sx + FRAME_SIZE > sourceImg.width || sy + FRAME_SIZE > sourceImg.height) {
                    continue;
                }
                // Раунд 39: слой рисуется со СВОИМ вертикальным смещением
                // (привязка всех слоёв к телу). Clip — чтобы смещённый кадр
                // не залезал в соседнюю строку выходного листа.
                const yOff = CATEGORY_Y_OFFSET[category] || 0;
                if (yOff === 0) {
                    ctx.drawImage(sourceImg, sx, sy, FRAME_SIZE, FRAME_SIZE, outX, outY, FRAME_SIZE, FRAME_SIZE);
                } else {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(outX, outY, FRAME_SIZE, FRAME_SIZE);
                    ctx.clip();
                    ctx.drawImage(sourceImg, sx, sy, FRAME_SIZE, FRAME_SIZE, outX, outY + yOff, FRAME_SIZE, FRAME_SIZE);
                    ctx.restore();
                }
            }
        }
    }

    // Конвертируем canvas в Phaser-текстуру
    // Раунд 41: если текстура уже была — refresh НА МЕСТЕ (без remove/add,
    // см. комментарий выше); иначе добавляем canvas как текстуру через addCanvas
    if (existingTex) {
        existingTex.refresh();
    } else {
        scene.textures.addCanvas(textureKey, canvas);
    }

    // Создаём спрайт-фреймы для walk-анимации (нужно для Phaser-анимаций)
    // Phaser автоматически создаст фреймы из canvas-текстуры
    const newTex = scene.textures.get(textureKey);
    if (newTex && newTex.source && newTex.source[0]) {
        // Размечаем фреймы: 9 cols × 4 rows × 64px
        // Phaser не делает это автоматически для canvas-текстур,
        // поэтому добавляем фреймы вручную
        for (let row = 0; row < OUT_ROWS; row++) {
            for (let col = 0; col < OUT_COLS; col++) {
                const frameName = `${row * OUT_COLS + col}`;
                try {
                    if (!newTex.has(frameName)) {
                        newTex.add(frameName, 0, col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE);
                    }
                } catch (e) {
                    // Frame already exists — ignore
                }
            }
        }
        const w = newTex.source[0].width;
        const h = newTex.source[0].height;
        if (w !== OUT_W || h !== OUT_H) {
            console.warn(`Canvas texture size mismatch: ${w}×${h}, expected ${OUT_W}×${OUT_H}`);
        }
    }

    return allFound;
}

/**
 * РАУНД 39 (п.4 заявки): ГРУДЬ У ЖЕНСКИХ ПЕРСОНАЖЕЙ.
 * Генерирует оверлей `lpc_chest_female` — тонкая тень/блик выреза груди,
 * который рисуется ПОВЕРХ одежды (torso) в композите. Женское тело LPC почти
 * не отличается от мужского, пока персонаж одет — оверлей даёт читаемое
 * различие силуэта, не ломая пиксельный стиль.
 *
 * Раскладка совпадает с универсальным LPC-листом (64px кадры, строки walk
 * up=8/left=9/down=10/right=11), поэтому composeCharacterTexture берёт кадры
 * из этого слоя тем же кодом, что и остальные слои.
 *
 * Координаты выверены попиксельно по body/torso-слоям пака:
 *   down  — торс x≈24..39, линия груди y≈38..41;
 *   left/right — грудь у переднего края силуэта (ставим симметрично).
 *
 * @param {Phaser.Scene} scene
 * @returns {boolean} true — текстура создана (или уже была)
 */
export function ensureFemaleChestTexture(scene) {
    const KEY = 'lpc_chest_female';
    if (scene.textures.exists(KEY)) return true;
    if (typeof document === 'undefined') return false;

    // Холст покрывает строки walk 8..11 (высота 12×64 = 768)
    const W = 13 * FRAME_SIZE;   // 832 — как у Universal-листа
    const H = 12 * FRAME_SIZE;   // 768 — достаточно для строк 8..11
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const DARK = 'rgba(30, 14, 8, 0.42)';    // тень ложбинки
    const LIGHT = 'rgba(255, 238, 210, 0.34)'; // блик под грудью

    // Точка внутри кадра: col*64 + x, row*64 + y
    const dot = (row, col, x, y, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(col * FRAME_SIZE + x, row * FRAME_SIZE + y, 1, 1);
    };

    // Строки 9 (left), 10 (down), 11 (right) — на спине (8) груди не видно.
    // РАУНД 61: торс больше НЕ смещается (смещения обнулены), рубаха занимает
    // y32..46, линия груди ≈ y37..39 (точки подняты на 8: было 45..47).
    [LPC_WALK_ROW.left, LPC_WALK_ROW.down, LPC_WALK_ROW.right].forEach((row) => {
        for (let col = 0; col < 9; col++) {           // 9 кадров walk/idle
            if (row === LPC_WALK_ROW.down) {
                // Вид спереди: две симметричные ложбинки + блики под ними
                dot(row, col, 29, 37, DARK); dot(row, col, 29, 38, DARK);
                dot(row, col, 34, 37, DARK); dot(row, col, 34, 38, DARK);
                dot(row, col, 27, 39, LIGHT); dot(row, col, 28, 39, LIGHT);
                dot(row, col, 35, 39, LIGHT); dot(row, col, 36, 39, LIGHT);
            } else {
                // Профиль: бугор груди у переднего края (ставим симметрично —
                // у LPC-паков перед профилем left/right зеркалится)
                dot(row, col, 27, 37, DARK); dot(row, col, 28, 37, DARK);
                dot(row, col, 35, 37, DARK); dot(row, col, 36, 37, DARK);
                dot(row, col, 27, 39, LIGHT); dot(row, col, 36, 39, LIGHT);
            }
        }
    });

    scene.textures.addCanvas(KEY, canvas);
    return scene.textures.exists(KEY);
}

/**
 * РАУНД 61 (п.9 «одежда висит отдельно от тела»): ГОЛОВЫ для жителей.
 *
 * Диагноз (попиксельная проверка ассетов): в текущем паке Universal-LPC
 * файлы body/* НЕ содержат головы — это безголовый торс (шея-культя на
 * y32..38 кадра), а волосы/глаза/бороды нарисованы под персонажа с ГОЛОВОЙ
 * y12..40 (48px «высокая» раскладка). Без головы композит собирался так:
 * волосы висят в воздухе, глаза-точки плывут под ними «слезами», лицо
 * отсутствует; старые смещения (r39) лишь маскировали это, спуская рубаху
 * на пояс. Решение: генерируем слой ГОЛОВЫ под цвет кожи каждого тела,
 * в «высокой» раскладке (голова y14..38) — тогда волосы (12..26), глаза
 * (29..31) и бороды (33..38) ложатся НА голову БЕЗ всяких смещений.
 *
 * Тон кожи берётся из самого файла тела (сэмпл пикселя щеки/груди кадра
 * walk-down idle), поэтому голова автоматически совпадает со всеми 12
 * оттенками палитры (male/female × light/tan/olive/taupe/amber/bronze).
 *
 * Текстура 'lpc_head_<body>' имеет раскладку Universal-листа (13 колонок ×
 * 12 рядов 64px) — composeCharacterTexture читает её тем же кодом, что и
 * остальные слои (строки walk 8..11).
 *
 * @param {Phaser.Scene} scene
 * @returns {number} сколько голов создано
 */
export function ensureHeadTextures(scene) {
    if (typeof document === 'undefined') return 0;
    const bodyKeys = scene.textures.getTextureKeys().filter(k => /^lpc_body_/.test(k));
    let made = 0;
    bodyKeys.forEach((bodyKey) => {
        const bodyName = bodyKey.replace(/^lpc_body_/, '');
        const KEY = `lpc_head_${bodyName}`;
        if (scene.textures.exists(KEY)) return;
        const bodyTex = scene.textures.get(bodyKey);
        const src = bodyTex && bodyTex.source && bodyTex.source[0];
        if (!src || !src.image) return;

        // --- сэмпл тона кожи из кадра walk-down idle (row 10, col 0) ---
        // РАУНД 61 (фикс тёмного лица): берём НЕСКОЛЬКО точек груди/рук,
        // отбрасываем тёмный контур (низкая яркость) и красную шею-культю,
        // усредняем оставшиеся — иначе голова могла выйти почти чёрной.
        const probe = document.createElement('canvas');
        probe.width = 64; probe.height = 64;
        const pctx = probe.getContext('2d');
        pctx.drawImage(src.image, 0, 640, 64, 64, 0, 0, 64, 64);
        const candidates = [];
        const points = [[28, 44], [32, 44], [36, 44], [28, 42], [32, 42], [30, 45]];
        for (const [px, py] of points) {
            const d = pctx.getImageData(px, py, 1, 1).data;
            if (d[3] < 200) continue;                                  // пусто
            const lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
            if (lum < 90) continue;                                    // тёмный контур/тень
            if (d[0] > d[1] + 45 && d[1] > d[2] + 25) continue;        // красная культя шеи
            candidates.push([d[0], d[1], d[2]]);
        }
        let skin;
        if (candidates.length > 0) {
            skin = candidates.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0])
                .map(v => Math.round(v / candidates.length));
        } else {
            skin = [214, 166, 120]; // нейтральный тон
        }

        const shade = (rgb, k) => [Math.round(rgb[0] * k), Math.round(rgb[1] * k), Math.round(rgb[2] * k)];
        const base = `rgb(${skin[0]},${skin[1]},${skin[2]})`;
        const dark = `rgb(${shade(skin, 0.82).join(',')})`;
        const darker = `rgb(${shade(skin, 0.66).join(',')})`;
        const light = `rgb(${shade(skin, 1.12).join(',')})`;

        const W = 13 * 64, H = 12 * 64;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Профиль ширины головы по строкам (голова y14..38, «высокая» раскладка)
        // [yStart, yEnd, halfWidthAtStart..]: рисуем рядами с центром x=32
        const headRows = [];
        const wProfile = [
            [14, 15, 5], [15, 16, 7], [16, 18, 9], [18, 34, 10],
            [34, 35, 9], [35, 36, 8], [36, 38, 5],
        ];
        wProfile.forEach(([y0, y1, hw]) => { for (let y = y0; y < y1; y++) headRows.push([y, hw]); });

        const paintHeadCol = (row, mode, col) => {
            const ox = col * 64;
            const oy = row * 64;   // смещение строки walk-листа (up=8..right=11)
            const xShift = mode === 'left' ? 1 : (mode === 'right' ? -1 : 0);
            headRows.forEach(([y, hw]) => {
                const x0 = ox + 32 - hw + xShift, x1 = ox + 32 + hw + xShift;
                ctx.fillStyle = base;
                ctx.fillRect(x0, oy + y, x1 - x0, 1);
                ctx.fillStyle = dark;
                ctx.fillRect(x0, oy + y, 2, 1);
                ctx.fillRect(x1 - 2, oy + y, 2, 1);
            });
            ctx.fillStyle = light;
            ctx.fillRect(ox + 30 + xShift, oy + 16, 4, 2);
            ctx.fillStyle = darker;
            ctx.fillRect(ox + 28 + xShift, oy + 36, 8, 2);
            if (mode === 'down' || mode === 'up') {
                ctx.fillStyle = dark;
                ctx.fillRect(ox + 20, oy + 26, 2, 5);
                ctx.fillRect(ox + 42, oy + 26, 2, 5);
            }
        };
        for (let col = 0; col < 13; col++) {
            paintHeadCol(8, 'up', col);
            paintHeadCol(9, 'left', col);
            paintHeadCol(10, 'down', col);
            paintHeadCol(11, 'right', col);
        }

        scene.textures.addCanvas(KEY, canvas);
        made++;
    });
    return made;
}

/**
 * Создать Phaser-анимации для кастомного персонажа.
 * Вызывать после composeCharacterTexture().
 *
 * @param {Phaser.Scene} scene — сцена
 * @param {string} textureKey — ключ текстуры (по умолчанию 'player_custom')
 * @param {string} animPrefix — префикс для анимаций (по умолчанию 'player_custom')
 */
export function createCustomCharacterAnimations(scene, textureKey = 'player_custom', animPrefix = 'player_custom') {
    // Удаляем старые анимации с этим префиксом
    const anims = scene.anims;
    // Phaser 3 не имеет прямого API для удаления одной анимации, но мы можем
    // перезаписать их, создавая с тем же ключом.
    // Если анимация существует — она перезапишется.

    const OUT_COLS = 9; // 8 walk + 1 idle
    const dirs = ['down', 'left', 'right', 'up'];

    dirs.forEach((dir, row) => {
        // Walk: cols 0-7 (8 кадров)
        const walkFrames = [];
        for (let c = 0; c < 8; c++) {
            walkFrames.push({ key: textureKey, frame: row * OUT_COLS + c });
        }
        // Дублируем кадры для плавности: 1,2,3,4,5,6,7,6,5,4,3,2,1,0
        // Но проще: зациклить 8 кадров
        anims.create({
            key: `${animPrefix}_walk_${dir}`,
            frames: walkFrames,
            frameRate: 10,
            repeat: -1,
        });
        // Idle: последний кадр (col 8)
        anims.create({
            key: `${animPrefix}_idle_${dir}`,
            frames: [{ key: textureKey, frame: row * OUT_COLS + 8 }],
            frameRate: 1,
        });
    });
}

/**
 * Загрузить все LPC-слои, указанные в манифесте, асинхронно.
 * Вызывается из CharacterGeneratorScene для гарантии, что все слои доступны.
 *
 * @param {Phaser.Scene} scene — сцена загрузки
 * @param {Function} onProgress — callback(fractionLoaded)
 * @returns {Promise<void>}
 */
export function loadAllLpcLayers(scene, onProgress = null) {
    return new Promise((resolve, reject) => {
        if (!scene.cache.json.has('lpc_manifest')) {
            // Манифест загружен в BootScene
            const manifest = scene.cache.json.get('lpc_manifest');
            if (!manifest) {
                reject(new Error('LPC manifest not in cache'));
                return;
            }
        }

        const manifest = scene.cache.json.get('lpc_manifest');
        const categories = manifest.categories || {};

        // Собираем список файлов для загрузки
        const toLoad = [];
        for (const [catKey, cat] of Object.entries(categories)) {
            for (const option of cat.options) {
                const key = `lpc_${catKey}_${option}`;
                if (!scene.textures.exists(key)) {
                    toLoad.push({
                        key,
                        path: `assets/lpc/${catKey}/${option}.png`,
                    });
                }
            }
        }

        if (toLoad.length === 0) {
            if (onProgress) onProgress(1);
            resolve();
            return;
        }

        let loaded = 0;
        const total = toLoad.length;

        // Используем Phaser loader
        const loader = scene.load;
        toLoad.forEach((item) => {
            loader.image(item.key, item.path);
        });

        loader.on('progress', (value) => {
            if (onProgress) onProgress(value);
        });

        loader.once('complete', () => {
            if (onProgress) onProgress(1);
            resolve();
        });

        loader.once('loaderror', (file) => {
            console.warn(`LPC load error: ${file.key}`, file);
            // Продолжаем, даже если часть не загрузилась
        });

        loader.start();
    });
}

/**
 * Случайный выбор внешности.
 * @param {Object} manifest — объект манифеста из cache
 * @param {string} sex — 'male' или 'female'
 * @returns {Object} — { body, eyes, beards, hair, legs, feet, torso }
 */
export function randomAppearance(manifest, sex = 'male') {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const opts = {};
    for (const [catKey, cat] of Object.entries(manifest.categories)) {
        // Фильтруем по полу для body
        let options = cat.options;
        if (catKey === 'body') {
            options = options.filter(o => o.startsWith(sex + '_') && !o.endsWith('_base'));
            if (options.length === 0) options = cat.options.filter(o => o.startsWith(sex + '_'));
        }
        if (options.length > 0) {
            opts[catKey] = pick(options);
        }
    }
    // Если пол женский — не добавляем бороду
    if (sex === 'female') {
        delete opts.beards;
    }
    return opts;
}

/**
 * Дефолтная внешность для быстрого старта.
 */
export function defaultAppearance(manifest, sex = 'male') {
    const findFirst = (arr, prefix) => arr.find(o => o.startsWith(prefix));
    const opts = {};
    for (const [catKey, cat] of Object.entries(manifest.categories)) {
        if (catKey === 'body') {
            opts[catKey] = findFirst(cat.options, sex + '_') || cat.options[0];
            if (opts[catKey].endsWith('_base')) {
                // Берём второй, если первый — base
                opts[catKey] = cat.options.find(o => o.startsWith(sex + '_') && !o.endsWith('_base')) || opts[catKey];
            }
        } else if (catKey === 'eyes') {
            opts[catKey] = cat.options[0];
        } else if (catKey === 'beards' && sex !== 'male') {
            // без бороды
        } else {
            opts[catKey] = cat.options[0];
        }
    }
    return opts;
}

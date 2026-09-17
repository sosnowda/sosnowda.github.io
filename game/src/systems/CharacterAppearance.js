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

// РАУНД 39: вертикальная привязка слоёв. Пак собран из LPC-наборов с РАЗНЫМИ
// базовыми линиями: тело нарисовано в нижней половине кадра (голова y33-42),
// а глаза/волосы/борода/одежда — под «высокого» персонажа (голова y25-38).
// Без смещений рубаха закрывает лицо, волосы висят над головой, глаза — в волосах
// («лица не видно / закрыты причёсками» — пп.3,8,9 заявки). Смещения выверены
// попиксельно: тело — эталон (0), остальное подтянуто к нему.
const CATEGORY_Y_OFFSET = {
    body: 0,
    eyes: 8,
    beards: 7,
    hair: 7,
    legs: 0,
    feet: 0,
    torso: 8,
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

    // Порядок слоёв (снизу вверх): body, eyes, beards, hair, legs, feet, torso,
    // chest (раунд 39, п.4: грудь у женских персонажей — поверх одежды), extra (плащ)
    const layerOrder = manifest.layer_order
        ? [...manifest.layer_order, 'chest']
        : ['body', 'eyes', 'beards', 'hair', 'legs', 'feet', 'torso', 'chest'];

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
                const optionName = appearance[category];
                if (!optionName) continue;
                const texKey = `lpc_${category}_${optionName}`;
                if (!scene.textures.exists(texKey)) {
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
    // Координаты — в ПРИВЯЗАННОЙ системе (после смещения торса на +8 кадр:
    // рубха занимает y40-54, линия груди y45-47).
    [LPC_WALK_ROW.left, LPC_WALK_ROW.down, LPC_WALK_ROW.right].forEach((row) => {
        for (let col = 0; col < 9; col++) {           // 9 кадров walk/idle
            if (row === LPC_WALK_ROW.down) {
                // Вид спереди: две симметричные ложбинки + блики под ними
                dot(row, col, 29, 45, DARK); dot(row, col, 29, 46, DARK);
                dot(row, col, 34, 45, DARK); dot(row, col, 34, 46, DARK);
                dot(row, col, 27, 47, LIGHT); dot(row, col, 28, 47, LIGHT);
                dot(row, col, 35, 47, LIGHT); dot(row, col, 36, 47, LIGHT);
            } else {
                // Профиль: бугор груди у переднего края (ставим симметрично —
                // у LPC-паков перед профилем left/right зеркалится)
                dot(row, col, 27, 45, DARK); dot(row, col, 28, 45, DARK);
                dot(row, col, 35, 45, DARK); dot(row, col, 36, 45, DARK);
                dot(row, col, 27, 47, LIGHT); dot(row, col, 36, 47, LIGHT);
            }
        }
    });

    scene.textures.addCanvas(KEY, canvas);
    return scene.textures.exists(KEY);
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

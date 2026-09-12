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

const DIRECTIONS = ['down', 'left', 'right', 'up'];

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

    // Создаём canvas напрямую через DOM (Phaser's make.canvas может не существовать)
    let canvas;
    if (scene.textures.exists(textureKey)) {
        // Пересоздаём
        scene.textures.remove(textureKey);
    }
    canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, OUT_W, OUT_H);

    // Порядок слоёв (снизу вверх): body, eyes, beards, hair, legs, feet, torso
    const layerOrder = manifest.layer_order || ['body', 'eyes', 'beards', 'hair', 'legs', 'feet', 'torso'];

    // Для каждого направления (down, left, right, up)
    let allFound = true;
    for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx];
        const lpcRow = WALK_ROW_OFFSET + dirIdx;
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
                ctx.drawImage(sourceImg, sx, sy, FRAME_SIZE, FRAME_SIZE, outX, outY, FRAME_SIZE, FRAME_SIZE);
            }
        }
    }

    // Конвертируем canvas в Phaser-текстуру
    // Phaser 3: добавляем canvas как текстуру через addCanvas
    scene.textures.addCanvas(textureKey, canvas);

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

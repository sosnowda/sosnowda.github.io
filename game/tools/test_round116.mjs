// test_round116.mjs — 66.68: P3 из реестра §9/66.66 одной итерацией (приказ
// владельца — «P3 из реестра §9 (рецепты готовы): дубли i18n ×18, покадровые
// Vector2 ×3 сцены, W3C-кодирование URL ×3»; P2 того же аудита закрыт 66.67/r115).
//
// P3-1 (§9.2): 18 дубликатов ключей EN-словаря i18n.js (no-dupe-keys, связность
//   с внешним аудитом 66.30 = 56). У 14 пар значения РАЗНЫЕ — тихо побеждал
//   ПОСЛЕДНИЙ (семантика объектного литерала), у 4 повторялись. Рецепт:
//   удалены РАННИЕ вхождения — живое поведение бит-в-бит (инвариант merged-
//   словаря 1906 ключей сверён до/после вне этого файла). Здесь закреплено:
//   статический парсер литералов (скобки/строки/комменты) требует НОЛЬ дублей
//   в EN и EN_KEYS + значения последних вхождений живым t().
// P3-2 (§9.3): покадровые аллокации игрового цикла: VillageScene.update()
//   (new Vector2 + 2 шаблонных аним-ключа на кадр), ApiaryScene/ForestScene
//   movePlayer() из update() (new Vector2) → переиспользуемый this._moveVec
//   (set(x,y)) из create() + кэш аним-ключей с пересборкой только при смене dir.
// P3-3 (§9.1): W3C Nu — 3 ошибки кодирования: t.me-ссылка RU+EN (пробел в
//   query) → текст параметра закодирован целиком (encodeURIComponent); data:-
//   URI фавиконки игры (пробелы) → %20; декод бит-в-бит даёт прежний SVG.
// SW: v112 (66.69 — sr-only/<main> game/index.html, aria-label лендингов, clip-path styles.css, var→const sw.js), v42 цел.
// Запуск из корня репозитория: node game/tools/test_round116.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import { runInNewContext } from 'vm';

const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

const i18n = read('game/src/systems/i18n.js');
const village = read('game/src/scenes/VillageScene.js');
const apiary = read('game/src/scenes/ApiaryScene.js');
const forest = read('game/src/scenes/ForestScene.js');
const indexRu = read('index.html');
const indexEn = read('en/index.html');
const gameHtml = read('game/index.html');
const sw = read('sw.js');
const swlog = read('docs/SW_CHANGELOG.md');
const changes = read('CHANGES.md');
const agents = read('AGENTS.md');

// ----- Статический парсер объектных литералов (строки/комменты/скобки) -----
function parseObject(src, name) {
    const m = new RegExp('const ' + name + ' = \\{').exec(src);
    if (!m) throw new Error('нет литерала ' + name);
    let i = m.index + m[0].length, depth = 0;
    const entries = [];
    while (i < src.length) {
        const ch = src[i];
        if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (ch === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        if (ch === '{' || ch === '(' || ch === '[') { depth++; i++; continue; }
        if (ch === '}' || ch === ')' || ch === ']') { if (depth === 0 && ch === '}') return entries; depth--; i++; continue; }
        if (depth === 0 && (ch === '"' || ch === "'")) {
            const keyStart = i; i++;
            let raw = ch;
            while (i < src.length) {
                if (src[i] === '\\') { raw += src[i] + src[i + 1]; i += 2; continue; }
                raw += src[i];
                if (src[i] === ch) { i++; break; }
                i++;
            }
            let j = i;
            while (j < src.length && /\s/.test(src[j])) j++;
            if (src[j] !== ':') continue;
            j++;
            while (j < src.length && /\s/.test(src[j])) j++;
            const valStart = j; let d = 0, k = j;
            while (k < src.length) {
                const c = src[k];
                if (c === '/' && src[k + 1] === '/') { while (k < src.length && src[k] !== '\n') k++; continue; }
                if (c === '/' && src[k + 1] === '*') { k += 2; while (k < src.length && !(src[k] === '*' && src[k + 1] === '/')) k++; k += 2; continue; }
                if (c === '"' || c === "'" || c === '`') { const q = c; k++; while (k < src.length) { if (src[k] === '\\') { k += 2; continue; } if (src[k] === q) { k++; break; } k++; } continue; }
                if (c === '{' || c === '(' || c === '[') { d++; k++; continue; }
                if (c === '}' || c === ')' || c === ']') { d--; k++; continue; }
                if (c === ',' && d === 0) break;
                k++;
            }
            entries.push([src.slice(keyStart, i), src.slice(valStart, k)]);
            i = k + 1; continue;
        }
        i++;
    }
    return entries;
}
function dupesOf(src, name) {
    const seen = new Map();
    for (const [raw, val] of parseObject(src, name)) {
        const key = runInNewContext('(' + raw + ')');
        seen.set(key, (seen.get(key) || 0) + 1);
    }
    return { total: seen.size, dupes: [...seen.values()].filter(n => n > 1).length };
}

console.log('--- 1. P3-1: ноль дубликатов ключей i18n (статический no-dupe-keys) ---');
const en = dupesOf(i18n, 'EN');
const enk = dupesOf(i18n, 'EN_KEYS');
ok(en.dupes === 0 && en.total === 2074, `EN: 0 дубликатов, 2074 уникальных ключа (факт: ${en.dupes} дублей, ${en.total}) — 66.71: +19 механик; 66.72: +голод/сбор/готовка/знахарство/молитва/слух; 66.73: +печь/торг/усталость/харизма/трофеи/голод-по-часам; 66.74: +новая волна навыков; 66.79: +72 правосудие; 66.83: +29 изгойство/закуп/серые кнопки/инструкция; 66.84: +26 новый старт/интро`);
ok(enk.dupes === 0 && enk.total === 521, `EN_KEYS: 0 дубликатов, 521 ключ (факт: ${enk.dupes} дублей, ${enk.total}) — 66.76: +49; 66.77: +6; 66.78: +40 (преступность); 66.80: +42 (баланс/епитимья/торг); 66.82: +59 (долги); 66.89: +51 (канон боёв BRP: прицел/перехват/мораль/медведь/стая/РАЗМЕР)`);
ok(i18n.includes('66.68 (§9.2 аудита 66.66, P3)'), 'i18n.js: док-комментарий 66.68 о дедупликации на месте');
for (const snippet of [
    "    'мальчик': 'boy',",
    "    'ткачиха': 'weaver', 'повитуха': 'midwife',",
    "    'на мельнице': 'at the mill',",
]) ok(i18n.includes(snippet), `соседи удалённых вхождений целы: ${snippet.trim().slice(0, 48)}…`);

console.log('--- 2. P3-1: live-значения = прежние ПОСЛЕДНИЕ вхождения (t(), EN) ---');
import('./../src/systems/i18n.js').then(({ t, setLang }) => {
    setLang('en');
    const live = [
        ['девочка', 'little girl'],
        ['на постоялом дворе', 'at the inn'],
        ['вдова', 'widow'],
        ['Ты посидел за столом у Фёдора... но пока время шло, вор успел скрыться из вида!',
            "You sat a while at Fyodor's table... but while the time passed, the thief slipped out of sight!"],
        ['Ты убил {0}. Вся деревня в ужасе: репутация в деревне и у всех жителей упала на 50!\n{1}\nТакие грехи смываются только вирой у старосты — если он согласится мирить.',
            "You killed {0}. The whole village is horrified: reputation in the village and with every villager fell by 50!\n{1}\nSuch sins are washed away only by wergild before the elder — if he consents to make peace."],
        ['Любовь деревни снискивается годами — и ты её снискал.',
            "A village's love is earned over years — and you have earned it."],
    ];
    for (const [ru, expected] of live) ok(t(ru) === expected, `t('${ru.slice(0, 42)}…') = прежнее last-wins значение`);
    finish();
}).catch(e => { ok(false, 'импорт i18n.js: ' + e.message); finish(); });

function finish() {
    console.log('--- 3. P3-1: из словаря ушли именно РАННИЕ значения 14 DIFF-пар ---');
    const gone = [
        'There is nothing new to find here.',
        'gets +10 to its chance — but only one!',
        "You sat at Fyodor's table for hours",
        'at the wayside inn',
        'a wayfarer in dress and manner',
        'Talking to a host takes 1 game hour',
        'a failure smears the print away',
        "'девочка': 'girl'",
        'warrior-grade gear is not sold to those of ill repute',
        'the things draped in linen',
        'horrified: village and every villager',
        'The elder drove you beyond the gates',
        'taken you in as kin: good deeds',
    ];
    const stays = [
        'No new ones to find here.',
        'gets +10 to the chance — but only one!',
        'sat a while at Fyodor',
        "'на постоялом дворе': 'at the inn'",
        'in dress and manner a wanderer',
        'Talking to the master of a house takes 1 game hour',
        'failure tramples the trail',
        "'девочка': 'little girl'",
        'ordinance, military gear is not sold to persons of ill repute',
        'the things covered with canvas',
        'reputation in the village and with every villager fell by 50',
        'The elder drove you to all four winds',
        'The village took you in as kin',
    ];
    gone.forEach(s => ok(!i18n.includes(s), `раннее значение удалено: «${s.slice(0, 46)}…»`));
    stays.forEach(s => ok(i18n.includes(s), `последнее значение живо: «${s.slice(0, 46)}…»`));
    for (const [key, val] of [
        ["'на пасеке':", "'at the apiary'"], ["'вдова':", "'widow'"],
        ["'Ни одной ошибки, и весь приход любит тебя. Редкий дар!':", 'одно вхождение SAME-пары'],
        ["'Любовь деревни снискивается годами — и ты её снискал.':", 'одно вхождение SAME-пары'],
    ]) {
        const n = i18n.split(key).length - 1;
        ok(n === 1, `${val}: «${key}» встречается ровно 1 раз (факт ${n})`);
    }
    ok((i18n.split("'🌲 Лес — единая локация цепочкой").length - 1) === 1, 'SAME-пара «🌲 Лес — единая локация» схлопнута в одно вхождение');

    console.log('--- 4. P3-2: игровой цикл трёх сцен без покадровых аллокаций ---');
    for (const [src, name] of [[village, 'VillageScene'], [apiary, 'ApiaryScene'], [forest, 'ForestScene']]) {
        ok(!src.includes('new Phaser.Math.Vector2(vx, vy)'), `${name}: в movePlayer/update больше нет new Vector2(vx, vy)`);
        ok(src.includes('this._moveVec = new Phaser.Math.Vector2(0, 0);') && src.includes('this._moveVec.set(vx, vy)'),
            `${name}: переиспользуемый this._moveVec (create + set в цикле)`);
        ok((src.match(/new Phaser\.Math\.Vector2\(/g) || []).length === 1, `${name}: new Vector2( ровно один — инициализация в create() (комментарии без скобки не в счёт)`);
    }
    ok(village.includes('if (dir !== this._walkKeyDir)') && village.includes('const walkKey = this._walkKey;'),
        'VillageScene: walk-ключ собирается только при смене dir (раньше — шаблонная строка каждый кадр)');
    ok(village.includes('if (this.lastDir !== this._idleKeyDir)') && village.includes('const idleKey = this._idleKey;'),
        'VillageScene: idle-ключ кэшируется по направлению');
    ok((village.match(/\$\{this\.playerTexKey\}_walk_\$\{dir\}/g) || []).length === 1,
        'VillageScene: шаблон walk-ключа ровно один — внутри кэша по dir (выполняется только при смене направления)');
    ok((village.match(/\$\{this\.playerTexKey\}_idle_\$\{this\.lastDir\}/g) || []).length === 1,
        'VillageScene: шаблон idle-ключа ровно один — внутри кэша по dir');
    for (const [src, name] of [[apiary, 'ApiaryScene'], [forest, 'ForestScene']]) {
        ok(src.includes('if (this.lastDir !== this._idleKeyDir)') && src.includes('this.playerObj.play(this._idleKey, true);'),
            `${name}: idle-ключ кэшируется по направлению (walk уже был под гардом dir)`);
        ok((src.match(/\$\{this\.player\.sprite \|\| 'player'\}_idle_\$\{this\.lastDir\}/g) || []).length === 1,
            `${name}: шаблон idle-ключа ровно один — внутри кэша (не каждый кадр)`);
    }

    console.log('--- 5. P3-3: W3C-кодирование URL (t.me ×2 + data:-URI фавиконки) ---');
    const hrefs = html => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
    let rawSpaceQueries = 0;
    for (const html of [indexRu, indexEn, gameHtml]) {
        for (const u of hrefs(html)) { const q = u.split('?')[1]; if (q && /\s/.test(q)) rawSpaceQueries++; }
    }
    ok(rawSpaceQueries === 0, `ни один href трёх страниц не несёт пробелов в query (факт: ${rawSpaceQueries})`);
    const ruHref = hrefs(indexRu).find(u => u.startsWith('https://t.me/share/url'));
    const enHref = hrefs(indexEn).find(u => u.startsWith('https://t.me/share/url'));
    ok(!!ruHref && !!enHref, 't.me-ссылки RU+EN на месте');
    const ruText = new URLSearchParams(ruHref.split('?')[1]).get('text');
    const enText = new URLSearchParams(enHref.split('?')[1]).get('text');
    ok(ruText === 'Летописи Руси XV века — AI-narrative RPG', 'RU: decodeURIComponent(text) = исходная подпись бит-в-бит');
    ok(enText === 'The Chronicles of Ruthenia — AI-narrative RPG', 'EN: decodeURIComponent(text) = исходная подпись бит-в-бит');
    const favHref = (gameHtml.match(/rel="icon"\s+href="([^"]*)"/) || [])[1] || (gameHtml.match(/href="(data:image\/svg\+xml,[^"]*)"/) || [])[1];
    ok(!!favHref && !/\s/.test(favHref), 'game/index.html: data:-URI фавиконки без неэкранированных пробелов');
    const favSvg = favHref ? decodeURIComponent(favHref.split('data:image/svg+xml,')[1]) : '';
    ok(favSvg === "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚔️</text></svg>",
        'game/index.html: декод %20-версии = прежний SVG бит-в-бит (рендер фавиконки не изменён)');

    console.log('--- 6. SW: бамп по §4 (HTML страниц изменён), механика не тронута ---');
    ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v125';"), 'sw.js: site-cache v125 (актуализация 66.92) (P4 66.69: sr-only/<main>/aria-label в HTML, clip-path в styles.css, var→const sw.js → бамп)');
    ok(sw.includes("const GAME_ASSETS_CACHE = 'game-assets-v45';"), 'sw.js: game-assets-v45 без изменений (ассеты/vendor не тронуты)');
    ok(sw.includes("if (event.request.mode !== 'navigate') return cached;"), 'sw.js: navigate-гейт 66.57 цел');
    ok(swlog.includes('- v112 — итерация 66.70'), 'SW_CHANGELOG: запись v112 добавлена');

    console.log('--- 7. Синтаксис правленых файлов + документация патча ---');
    for (const f of ['game/src/systems/i18n.js', 'game/src/scenes/VillageScene.js', 'game/src/scenes/ApiaryScene.js', 'game/src/scenes/ForestScene.js', 'sw.js']) {
        let good = true;
        try { execSync('node --check ' + f, { stdio: 'pipe' }); } catch { good = false; }
        ok(good, 'node --check: ' + f);
    }
    ok(changes.includes('## Патч 66.68') && changes.includes('18 дубликатов') && changes.includes('_moveVec') && changes.includes('%20'),
        'CHANGES.md: секция «Патч 66.68» с рецептом всех трёх P3');
    ok(changes.includes('P3 из реестра §9/66.66'), 'CHANGES.md: привязка к реестру §9/66.66');
    ok(agents.includes('no-dupe-keys') && agents.includes('test_round116'),
        'AGENTS.md §8: пункт no-dupe-keys добавлен (рецепт аудита)');
    ok((read('sitemap.xml').match(/<url>/g) || []).length === 3, 'sitemap: структура цела (3 URL)');

    let checkOk = true, checkOut = '';
    try {
        checkOut = execSync('python3 game/tools/bump_lastmod.py --check', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
        checkOk = false;
        checkOut = (e.stdout || '') + (e.stderr || '');
    }
    ok(checkOk, 'bump_lastmod.py --check: sitemap синхронен фактам git (дрейфа нет)' + (checkOk ? '' : '\n' + checkOut));

    console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
    if (fail > 0) process.exit(1);
}

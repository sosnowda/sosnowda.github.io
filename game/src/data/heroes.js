// Раунд 50 (пп.7–9 заявки): облики игрока из пакета Medieval - Heroes I.
// LPC-кастомизация к готовым спрайтам неприменима (это не слоевые фигурки),
// поэтому владелец утвердил схему: выбор готового облика вместо кастомизации.
// Спрайты — assets/sprites/hero_*.png (4×4 кадра 64px: вниз/влево/вправо/вверх).
export const HERO_LOOKS = [
    {
        key: 'hero_baenor',
        name: 'Баэнор',
        gender: 'male',
        desc: 'суровый витязь в тёмной броне',
    },
    {
        key: 'hero_paul',
        name: 'Пауль',
        gender: 'male',
        desc: 'молотобоец с тяжёлой походкой',
    },
    {
        key: 'hero_huntress',
        name: 'Охотница',
        gender: 'female',
        desc: 'лучница с луком за спиной',
    },
    {
        key: 'hero_naia',
        name: 'Найя',
        gender: 'female',
        desc: 'странница в дорожном плаще',
    },
];

export function heroLooksForGender(gender) {
    if (gender === 'male' || gender === 'female') {
        return HERO_LOOKS.filter(h => h.gender === gender);
    }
    return HERO_LOOKS;
}

// ============================================================
// 66.32: БОЕВЫЕ ОБЛИКИ (MVsv-листы пака «Medieval - Heroes I»).
// Мир и деревня остаются LPC-моделями (решение р.61/62), но в CombatScene
// герой теперь показывается боевым обликом пака: маппинг «архетип|пол» →
// облик. Ключи совпадают с BATTLE_LOOK_SHEETS в BootScene и файлами
// assets/sprites/battle/battle_<look>_<anim>.png (конвейер game/tools/mvsv_battle_6632.py).
// Следопыт-мужчина → Гаэррон (единственный полноценный лучник-мужчина в паке),
// сыщик-мужчина → Пауль, женщины → Охотница/Найя.
// ============================================================
export const BATTLE_LOOK_BY_PRESET = {
    'Воин|male': 'baenor',
    'Воин|female': 'huntress',
    'Следопыт|male': 'gaerron',
    'Следопыт|female': 'naia',
    'Сыщик|male': 'paul',
    'Сыщик|female': 'naia',
    'Приключенец|male': 'baenor',
    'Приключенец|female': 'huntress',
};

/**
 * Боевой облик для игрока. Неизвестный архетип (страховка на будущие
 * пресеты/переименования) → по полу.
 * @param {string} archetype — p.archetype ('Воин'|'Следопыт'|'Сыщик'|'Приключенец')
 * @param {string} gender — 'male' | 'female'
 * @returns {string} ключ облика ('baenor'|'gaerron'|'huntress'|'naia'|'paul')
 */
export function battleLookFor(archetype, gender) {
    const key = `${archetype}|${gender}`;
    if (BATTLE_LOOK_BY_PRESET[key]) return BATTLE_LOOK_BY_PRESET[key];
    return gender === 'female' ? 'huntress' : 'baenor';
}

// ============================================================
// 66.39 (приказ владельца: «добавить альты в бусты/боевые облики»).
// В паке «Medieval - Heroes I» есть два неиспользованных героя — АЛЬТЫ
// боевых обликов (листы battle_<alt>_<anim>.png, конвейер
// tools/make_battle_alts_6639.py):
//   baenor  → esther  (ЛордЭстер — рыцарь в большом шлеме);
//   huntress → leyanne (Лейанн — золочёная фехтовальщица).
// Вариант выбирается в превью персонажа (листалка портретов: у альтов —
// свои бусты). Выбор пишется в героя: hero.bustKey + hero.battleLookKey
// (аддитивные поля; старые сейвы без них → каноничный облик, как было).
// gaerron/naia/paul альтов в паке не имеют.
// ============================================================
export const BATTLE_LOOK_ALT_BY_LOOK = {
    baenor: 'esther',
    huntress: 'leyanne',
};

// Имена альт-героев (RU — ключ t(), EN — в i18n.js)
export const ALT_LOOK_NAMES = {
    esther: 'Эстер',
    leyanne: 'Лейанн',
};

// ============================================================
// 66.33: БУСТЫ ПАКА (портреты меню). 512×512 в паке → assets/sprites/busts/
// 256×256 (конвейер game/tools/make_busts_6639.py, палитра ≤255).
// Карта по пресетам — те же ключи «архетип|пол», что у BATTLE_LOOK_BY_PRESET.
// 66.39: у Пауля бусты ПОЯВИЛИСЬ в библиотеке Drive — «Сыщик|male» теперь
// с портретом (bust_paul_1); прежде было null (текстовая карточка).
// ============================================================
export const BUST_BY_PRESET = {
    'Воин|male': 'bust_baenor_1',
    'Воин|female': 'bust_huntress_1',
    'Следопыт|male': 'bust_gaerron',
    'Следопыт|female': 'bust_naia',
    'Сыщик|male': 'bust_paul_1',
    'Сыщик|female': 'bust_naia',
    'Приключенец|male': 'bust_baenor_5',
    'Приключенец|female': 'bust_huntress_5',
};

// 66.39: ПОЛНЫЙ комплект бустов каждого героя (альты портретов пака:
// Bust_1..8 — разные официальные рендеры; у Гаэррона/Найи/Эстер — единственный).
export const BUSTS_BY_LOOK = {
    baenor: Array.from({ length: 8 }, (_, i) => `bust_baenor_${i + 1}`),
    huntress: Array.from({ length: 8 }, (_, i) => `bust_huntress_${i + 1}`),
    paul: Array.from({ length: 8 }, (_, i) => `bust_paul_${i + 1}`),
    leyanne: Array.from({ length: 8 }, (_, i) => `bust_leyanne_${i + 1}`),
    gaerron: ['bust_gaerron'],
    naia: ['bust_naia'],
    esther: ['bust_esther'],
};

// Страховка по облику (внеплановые архетипы): первый буст облика.
const BUST_BY_LOOK = {
    baenor: 'bust_baenor_1',
    gaerron: 'bust_gaerron',
    huntress: 'bust_huntress_1',
    naia: 'bust_naia',
    paul: 'bust_paul_1',
    leyanne: 'bust_leyanne_1',
    esther: 'bust_esther',
};

/**
 * Буст для карточки пресета (архетип+пол). Неизвестный архетип → буст боевого
 * облика по полу (страховка на будущие пресеты, как у battleLookFor).
 * @returns {string|null} ключ текстуры ('bust_baenor_1'…) или null
 */
export function getBustFor(archetype, gender) {
    const key = `${archetype}|${gender}`;
    if (key in BUST_BY_PRESET) return BUST_BY_PRESET[key];
    return BUST_BY_LOOK[battleLookFor(archetype, gender)] || null;
}

/**
 * 66.39: варианты внешности пресета для листалки в превью персонажа.
 * Список = бусты каноничного боевого облика (look = канон) + если у облика
 * есть альт (BATTLE_LOOK_ALT_BY_LOOK) — бусты альт-героя (look = альт).
 * Каждый вариант несёт и портрет, и боевой облик — листалка меняет ОБА
 * (герой.bustKey + герой.battleLookKey).
 * @returns {{bust: string, look: string, alt: boolean}[]}
 */
export function bustVariantsFor(archetype, gender) {
    const base = battleLookFor(archetype, gender);
    const variants = (BUSTS_BY_LOOK[base] || []).map(bust => ({ bust, look: base, alt: false }));
    const alt = BATTLE_LOOK_ALT_BY_LOOK[base];
    if (alt) {
        (BUSTS_BY_LOOK[alt] || []).forEach(bust => variants.push({ bust, look: alt, alt: true }));
    }
    return variants;
}

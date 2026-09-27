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
// 66.33: БУСТЫ ПАКА (портреты меню). 512×512 в паке → assets/sprites/busts/
// 256×256 (конвейер game/tools/make_busts_6633.py, палитра ≤255, ~105 КБ).
// Карта по пресетам — те же ключи «архетип|пол», что у BATTLE_LOOK_BY_PRESET.
// У Пауля буста в паке НЕТ → null: карточка «Сыщик|male» рисуется по старой
// текстовой схеме, превью/свиток персонажа — без портрета.
// ============================================================
export const BUST_BY_PRESET = {
    'Воин|male': 'bust_baenor_1',
    'Воин|female': 'bust_huntress_1',
    'Следопыт|male': 'bust_gaerron',
    'Следопыт|female': 'bust_naia',
    'Сыщик|male': null,
    'Сыщик|female': 'bust_naia',
    'Приключенец|male': 'bust_baenor_5',
    'Приключенец|female': 'bust_huntress_5',
};

// Страховка по облику (внеплановые архетипы): у paul буста нет.
const BUST_BY_LOOK = {
    baenor: 'bust_baenor_1',
    gaerron: 'bust_gaerron',
    huntress: 'bust_huntress_1',
    naia: 'bust_naia',
    paul: null,
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

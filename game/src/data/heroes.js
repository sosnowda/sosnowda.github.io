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

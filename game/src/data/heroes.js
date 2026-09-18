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

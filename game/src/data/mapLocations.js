// Карта местности вокруг деревни — исторические локации Руси XV века.
// Финальный список (п.4): Деревня, Лес, Тракт, Поле, Озеро, Погост, Мельница, Пасека, Выпас.
// Раунд 15: имена/описания локализованы (i18n) — в EN-режиме выдаются переводы.
// Раунд 30 (п.1 спецификации владельца): ЛЕС разделён на ТРИ части —
// Опушка леса, Лесная поляна и сам Лес (лесная чаща).
import { t } from '../systems/i18n.js';

export const MAP_LOCATIONS = [
    {
        // Раунд 30: опушка — краешек леса, светло, много травы и кустов
        id: 'forest_edge',
        name: t('Опушка леса'),
        icon: '🌳',
        description: t('Краешек леса, где кончается трава и начинаются деревья. Светло, грибные места да ягодные кусты.'),
        type: 'forest_edge',
        danger: 'low',
        canFight: false,
    },
    {
        // Раунд 30: поляна — солнечный круг среди леса, цветы и ягоды
        id: 'forest_glade',
        name: t('Лесная поляна'),
        icon: '🌼',
        description: t('Солнечная поляна среди леса, в кольце деревьев. Много цветов, ягод и пчелиного звона.'),
        type: 'forest_glade',
        danger: 'low',
        canFight: false,
    },
    {
        // Раунд 30: глубокий лес — тёмная чаща (бывшая единственная локация «Лес»)
        // Раунд 39 (п.23): название по терминологии владельца — ГУСТОЙ ЛЕС,
        // глубина леса за поляной (вход в лес — только через Опушку).
        id: 'forest',
        name: t('Густой лес'),
        icon: '🌲',
        description: t('Глубина леса: тёмная чаща за опушкой и поляной. Много зверья и грибов, но и разбойники водятся.'),
        type: 'forest',
        danger: 'medium',
        canFight: true,
        enemies: ['wolf', 'bandit'],
    },
    {
        id: 'road_south',
        name: t('Большая дорога на юг'),
        icon: '🛤',
        description: t('Большая дорога, ведущая к южным городам. По ней ходят купеческие обозы.'),
        type: 'road',
        danger: 'medium',
        canFight: true,
        enemies: ['bandit'],
    },
    {
        id: 'field',
        name: t('Ржаное поле'),
        icon: '🌾',
        description: t('Поля общинной пашни. Здесь крестьяне сеют рожь, овёс и ячмень.'),
        type: 'field',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'lake',
        name: t('Святое озеро'),
        icon: '🏞',
        description: t('Тихое лесное озеро с чистой водой. Здесь ловят рыбу и собирают камыши.'),
        type: 'lake',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'pogost',
        name: t('Погост'),
        icon: '⚰️',
        description: t('Деревенское кладбище с деревянной часовней и рядами могил с крестами. Много деревьев и травы.'),
        type: 'cemetery',
        danger: 'low',
        canFight: false,
    },
    {
        // Раунд 27 (п.4): мельница — ВЕТРЯНАЯ (водяное колесо и ручей убраны)
        id: 'mill',
        name: t('Ветряная мельница'),
        icon: '🏭',
        description: t('Ветряная мельница на пригорке. Мельник мелет зерно для всей округи.'),
        type: 'building',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'apiary',
        name: t('Пасека'),
        icon: '🐝',
        description: t('Пасека с колодными ульями в лесной чаще. Здесь добывают мёд и воск.'),
        type: 'building',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'pasture',
        name: t('Выпас'),
        icon: '🐄',
        // Раунд 30 (п.2): выпас — густая сочная трава и множество цветов
        description: t('Заливной луг с густой сочной травой и множеством цветов. Здесь пасутся деревенские коровы, козы и лошади, тут же пастух присматривает за стадом.'),
        type: 'pasture',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'river',
        name: t('Река Кистерма'),
        icon: '🌊',
        description: t('Брод через реку. Здесь стирают бельё, ловят рыбу, поят скот.'),
        type: 'river',
        danger: 'low',
        canFight: false,
    },
];

// Получить локацию по ID
export function getLocationById(id) {
    return MAP_LOCATIONS.find(l => l.id === id);
}

// ===== РАУНД 39 (п.23 заявки): ЛЕС — ЕДИНАЯ ЛОКАЦИЯ ЦЕПОЧКОЙ =====
// Лес отображается на карте местности ОДНИМ узлом «Лес», но внутри — это
// цепочка из трёх локаций: вход только через ОПУШКУ, дальше ПОСЛЕДОВАТЕЛЬНО
// Лесная поляна → Густой лес. Выход из леса — тоже последовательно, обратно.
export const FOREST_CHAIN = ['forest_edge', 'forest_glade', 'forest'];

/** Это лесная локация цепочки? */
export function isForestLocation(id) {
    return FOREST_CHAIN.includes(id);
}

/** Следующая (более глубокая) лесная локация или null. */
export function forestDeeper(id) {
    const i = FOREST_CHAIN.indexOf(id);
    if (i < 0 || i >= FOREST_CHAIN.length - 1) return null;
    return FOREST_CHAIN[i + 1];
}

/** Предыдущая (более близкая) лесная локация или null (выход на околицу). */
export function forestShallower(id) {
    const i = FOREST_CHAIN.indexOf(id);
    if (i <= 0) return null;
    return FOREST_CHAIN[i - 1];
}

// Получить все доступные с развилки локации.
// Раунд 39 (п.23): лес на карте — ОДНА кнопка «Лес» (вход через Опушку);
// Поляна и Густой лес в списке развилки больше не показываются —
// в них можно попасть только последовательно, из глубины леса.
export function getForkLocations() {
    return MAP_LOCATIONS.filter(l =>
        ['forest_edge', 'road_south', 'field', 'lake', 'pogost', 'mill', 'apiary', 'pasture', 'river'].includes(l.id)
    );
}

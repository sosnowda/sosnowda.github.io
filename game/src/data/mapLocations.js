// Карта местности вокруг деревни — исторические локации Руси XV века.
// Финальный список (п.4): Деревня, Лес, Тракт, Поле, Озеро, Погост, Мельница, Пасека, Выпас.
// Раунд 15: имена/описания локализованы (i18n) — в EN-режиме выдаются переводы.
import { t } from '../systems/i18n.js';

export const MAP_LOCATIONS = [
    {
        id: 'forest',
        name: t('Тёмный лес'),
        icon: '🌲',
        description: t('Густой бор за рекой. Много зверья и грибов, но и разбойники водятся.'),
        type: 'forest',
        danger: 'medium',
        canFight: true,
        enemies: ['wolf', 'bandit'],
    },
    {
        id: 'road_south',
        name: t('Тракт на югъ'),
        icon: '🛤',
        description: t('Большой тракт, ведущий к южным городам. По нему ходят купеческие обозы.'),
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
        name: t('Погостъ'),
        icon: '⚰️',
        description: t('Деревенское кладбище с деревянной часовней и рядами могил с крестами. Много деревьев и травы.'),
        type: 'cemetery',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'mill',
        name: t('Водяная мельница'),
        icon: '🏭',
        description: t('Деревянная мельница на ручье. Мельник мелет зерно для всей округи.'),
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
        name: t('Выпасъ'),
        icon: '🐄',
        description: t('Луг, где пасутся деревенские коровы, козы и лошади. Тут же пастух присматривает за стадом.'),
        type: 'pasture',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'river',
        name: t('Рѣка Кистерма'),
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

// Получить все доступные с развилки локации (п.4: финальный список)
export function getForkLocations() {
    return MAP_LOCATIONS.filter(l => 
        ['forest', 'road_south', 'field', 'lake', 'pogost', 'mill', 'apiary', 'pasture', 'river'].includes(l.id)
    );
}

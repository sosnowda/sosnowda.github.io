// Карта местности вокруг деревни — исторические локации Руси XV века.
// Каждая локация имеет:
// - id, name, icon, description
// - тип (лес/поле/река/тракт/мельница/пасека/монастырь/городище/и т.д.)
// - доступность из деревни
// - возможные события (бой, находки, встречи)

export const MAP_LOCATIONS = [
    // Основные локации (доступны с развилки)
    {
        id: 'forest',
        name: 'Тёмный лес',
        icon: '🌲',
        description: 'Густой бор за рекой. Много зверья и грибов, но и разбойники водятся.',
        type: 'forest',
        danger: 'medium',
        canFight: true,
        enemies: ['wolf', 'bandit'],
    },
    {
        id: 'road_south',
        name: 'Тракт на югъ',
        icon: '🛤',
        description: 'Большой тракт, ведущий к южным городам. По нему ходят купеческие обозы.',
        type: 'road',
        danger: 'medium',
        canFight: true,
        enemies: ['bandit'],
    },
    {
        id: 'river',
        name: 'Рѣка Кистерма',
        icon: '🌊',
        description: 'Брод через реку. Здесь стирают бельё, ловят рыбу, поят скот.',
        type: 'river',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'field',
        name: 'Ржаное поле',
        icon: '🌾',
        description: 'Поля общинной пашни. Здесь крестьяне сеют рожь, овёс и ячмень.',
        type: 'field',
        danger: 'low',
        canFight: false,
    },
    // Дополнительные локации (исторически верные для Руси XV века)
    {
        id: 'mill',
        name: 'Водяная мельница',
        icon: '🏭',
        description: 'Деревянная мельница на ручье. Мельник мелет зерно для всей округи.',
        type: 'building',
        danger: 'low',
        canFight: false,
        npc: 'miller',
        hasInterior: true,
    },
    {
        id: 'apiary',
        name: 'Пасека',
        icon: '🐝',
        description: 'Пасека с колодными ульями в лесной чаще. Здесь добывают мёд и воск.',
        type: 'building',
        danger: 'low',
        canFight: false,
        npc: 'beekeeper',
    },
    {
        id: 'monastery',
        name: 'Мужской монастырь',
        icon: '⛪',
        description: 'Небольшой монастырь в часе ходьбы от деревни. Монахи молятся и переписывают книги.',
        type: 'building',
        danger: 'low',
        canFight: false,
        npc: 'monk',
        hasInterior: true,
    },
    {
        id: 'fortress',
        name: 'Городище',
        icon: '🏰',
        description: 'Старинное городище на холме. Когда-то здесь была крепость, теперь лишь валы и рвы.',
        type: 'ruins',
        danger: 'medium',
        canFight: true,
        enemies: ['bandit'],
    },
    {
        id: 'crossroads',
        name: 'Перекрёстокъ',
        icon: '✝',
        description: 'Перекрёсток трёх дорог с придорожным крестом. Путники здесь отдыхают.',
        type: 'road',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'bridge',
        name: 'Мостъ через рѣку',
        icon: '🌉',
        description: 'Деревянный мост через реку. За ним начинается большой лес.',
        type: 'road',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'cemetery',
        name: 'Погостъ',
        icon: '⚰️',
        description: 'Деревенское кладбище за оградой. Старые кресты покосились, заросли травой.',
        type: 'cemetery',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'bathhouse',
        name: 'Баня',
        icon: '♨️',
        description: 'Общественная баня на отшибе. Здесь моются по субботам.',
        type: 'building',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'well',
        name: 'Колодецъ',
        icon: '🪣',
        description: 'Общественный колодец в центре деревни. Здесь собираются новости.',
        type: 'building',
        danger: 'low',
        canFight: false,
    },
    {
        id: 'market',
        name: 'Торговая площадь',
        icon: '🏪',
        description: 'Небольшая площадь, где по праздникам устраивают торг.',
        type: 'building',
        danger: 'low',
        canFight: false,
    },
];

// Получить локацию по ID
export function getLocationById(id) {
    return MAP_LOCATIONS.find(l => l.id === id);
}

// Получить все доступные с развилки локации
export function getForkLocations() {
    return MAP_LOCATIONS.filter(l => 
        ['forest', 'road_south', 'river', 'field', 'mill', 'apiary', 'monastery', 
         'fortress', 'crossroads', 'bridge', 'cemetery', 'bathhouse'].includes(l.id)
    );
}

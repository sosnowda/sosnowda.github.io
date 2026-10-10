// Константы игры «Летописи Руси XV века».
//
// 66.97 (§12.3 аудита 66.92, п.5 «Баланс — в конфиг»): именованный баланс боя
// и сцен собран ЗДЕСЬ — тюнинг сводится к правке одной строки с историей.
// Таблица WEAPONS живёт ОДНОЙ копией в systems/Character.js (Character.WEAPONS):
// прежнее зеркальное «WEAPONS для обратной совместимости» уже разошлось с
// каноном (в зеркале не было crossbow) — источник будущих багов, удалено.
export const GAME = {
    width: 1280,
    height: 720,
    tileSize: 48,
};

// --- Тактические модификаторы боя (CombatScene.resolvePlayerAttack/checkMorale) ---
// Значения НЕ менялись (66.89 В-1/В-4, п.9, В-3) — перенесены как есть.
export const COMBAT_MODS = {
    counterWindowBonus: 10,     // В-1: окно контратаки после уклонения от медленного врага, %
    pointBlankPenalty: 10,      // В-4: стрельба из лука/самострела в упор (враг рядом), %
    aimBonus: 25,               // п.9: выстрел с прицела (ход прицеливания), %
    spearFirstStrikeBonus: 10,  // В-4: копьё, первый удар против бездоспешного, %
    moraleHpPct: 0.25,          // В-3: враг проверяет мораль при HP < 25% от HPmax
    moraleMinPow: 5,            // В-3: нижний порог МОЩи в проверке морали
};

// --- Цены панелей сцен (InteriorScene) ---
// Церковные суммы живут в данных: ChurchDonation.DONATION_AMOUNTS (5/10/25/50)
// и repBalance.ABSOLUTION_COST — панель «Замолить грехи» берёт цену оттуда же.
export const SCENE_PRICES = {
    giftSmall: { cost: 10, value: 5 },   // «Подарить 10 денег»: ценность подарка = номинал × 0.5
    giftLarge: { cost: 50, value: 25 },  // «Подарить 50 денег»
};

// --- Шансы событий сцен (значения НЕ менялись — перенесены как есть) ---
export const SCENE_CHANCES = {
    potterCoinFind: 0.15,   // InteriorScene: чужая монетка в мастерской гончара
    potterCoinMin: 2,       // сумма монетки, д. (Phaser.Math.Between)
    potterCoinMax: 4,
    driedAppleFind: 0.2,    // InteriorScene: сушёные яблоки дома (+1 HP)
    roadAmbush: 0.6,        // LocationScene: засада лихих людей на тракте (активное поручение)
};

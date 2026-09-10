// Ядро системы BRP (Basic Roleplaying) — чистая логика без зависимостей от движка.
// Все функции используют Math.random, поэтому пригодны и для тестов, и для игры.

// Бросок процентного куба: 1..100
export function d100() {
    return 1 + Math.floor(Math.random() * 100);
}

// Бросок d6: 1..6
export function d6() {
    return 1 + Math.floor(Math.random() * 6);
}

// Генерация характеристики по BRP: 3d6 * 5 (диапазон 15..90)
export function rollCharacteristic() {
    let sum = 0;
    for (let i = 0; i < 3; i++) sum += 1 + Math.floor(Math.random() * 6);
    return sum * 5;
}

// Результат проверки навыка
export const ROLL_RESULT = {
    CRITICAL: 'critical', // особый успех
    SUCCESS: 'success',
    FAIL: 'fail',
    FUMBLE: 'fumble', // тяжёлый провал
};

// Проверка навыка значением skillValue (проценты)
export function skillCheck(skillValue) {
    const roll = d100();
    const sv = Math.max(1, skillValue || 0);
    let result;
    if (roll <= Math.max(1, Math.floor(sv / 10))) {
        result = ROLL_RESULT.CRITICAL;
    } else if (roll <= sv) {
        result = ROLL_RESULT.SUCCESS;
    } else if (roll >= 96 && sv < 50) {
        result = ROLL_RESULT.FUMBLE;
    } else {
        result = ROLL_RESULT.FAIL;
    }
    return { roll, result };
}

// Бонус урона (Damage Bonus) по таблице BRP на основе STR + SIZ
export function damageBonus(str, siz) {
    const total = (str || 0) + (siz || 0);
    if (total < 28) return { text: '-2', min: -2, max: -2 };
    if (total < 40) return { text: '-1', min: -1, max: -1 };
    if (total < 57) return { text: '0', min: 0, max: 0 };
    if (total < 65) return { text: '+1d4', min: 1, max: 4 };
    if (total < 73) return { text: '+1d6', min: 1, max: 6 };
    if (total < 81) return { text: '+1d6+1', min: 2, max: 7 };
    if (total < 89) return { text: '+1d8+1', min: 2, max: 9 };
    if (total < 97) return { text: '+1d8+2', min: 3, max: 10 };
    return { text: '+2d6', min: 2, max: 12 };
}

// Расчёт урона: weaponDice {min,max} + bonus {min,max} (бонус силы)
export function rollDamage(weaponDice, bonus) {
    const wd = weaponDice || { min: 1, max: 1 };
    const base = wd.min + Math.floor(Math.random() * (wd.max - wd.min + 1));
    let b = 0;
    if (bonus && typeof bonus.min === 'number' && typeof bonus.max === 'number') {
        b = bonus.min + Math.floor(Math.random() * (bonus.max - bonus.min + 1));
    }
    return Math.max(0, base + b);
}

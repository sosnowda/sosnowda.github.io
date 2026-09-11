// Ядро системы BRP (Basic Roleplaying Universal Game Engine SRD).
// Чистая логика без зависимостей от движка.
// Все функции используют Math.random, поэтому пригодны и для тестов, и для игры.

// Бросок d100: 1..100
export function d100() {
    return 1 + Math.floor(Math.random() * 100);
}

// Бросок d6: 1..6
export function d6() {
    return 1 + Math.floor(Math.random() * 6);
}

// Бросок произвольного куба
export function rollDie(sides) {
    return 1 + Math.floor(Math.random() * sides);
}

// Генерация характеристики по BRP SRD: 3d6 * 5 (диапазон 15..90)
export function rollCharacteristic() {
    let sum = 0;
    for (let i = 0; i < 3; i++) sum += 1 + Math.floor(Math.random() * 6);
    return sum * 5;
}

// Результат проверки навыка (по BRP SRD)
export const ROLL_RESULT = {
    CRITICAL: 'critical', // особый успех (1/10 навыка)
    SUCCESS: 'success',   // обычный успех
    FAIL: 'fail',         // провал
    FUMBLE: 'fumble',     // критический провал (96+ при навыке < 50, иначе 00)
};

// Проверка навыка значением skillValue (проценты)
// Возвращает { roll, result, special: boolean }
export function skillCheck(skillValue) {
    const roll = d100();
    const sv = Math.max(1, skillValue || 0);
    const critThreshold = Math.max(1, Math.floor(sv / 20));  // BRP: крит = 1/20 навыка (5%)
    const specThreshold = Math.max(1, Math.floor(sv / 5));   // BRP: особый успех = 1/5 навыка (20%)
    const fumbleThreshold = sv < 50 ? 96 : 100;              // BRP: fumble 96+ при навыке < 50, иначе 100
    
    let result;
    if (roll <= critThreshold) {
        result = ROLL_RESULT.CRITICAL;
    } else if (roll <= sv) {
        result = ROLL_RESULT.SUCCESS;
    } else if (roll >= fumbleThreshold) {
        result = ROLL_RESULT.FUMBLE;
    } else {
        result = ROLL_RESULT.FAIL;
    }
    return {
        roll,
        result,
        special: roll <= specThreshold && roll <= sv,  // особый успех (для урона ×2)
        critical: roll <= critThreshold,
    };
}

// Бонус урона (Damage Bonus) по таблице BRP SRD на основе STR + SIZ
export function damageBonus(str, siz) {
    const total = (str || 0) + (siz || 0);
    if (total < 28) return { text: '-1d4', min: -4, max: -1 };
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
// При особом успехе (special) урон ×2 (BRP SRD)
export function rollDamage(weaponDice, bonus, special = false) {
    const wd = weaponDice || { min: 1, max: 1 };
    let base = wd.min + Math.floor(Math.random() * (wd.max - wd.min + 1));
    let b = 0;
    if (bonus && typeof bonus.min === 'number' && typeof bonus.max === 'number') {
        b = bonus.min + Math.floor(Math.random() * (bonus.max - bonus.min + 1));
    }
    let total = Math.max(0, base + b);
    if (special) total *= 2;  // Особый успех ×2 к урону
    return total;
}

// Применение урона с учётом доспеха (BRP SRD: доспех поглощает урон)
export function applyDamage(target, dmg, armorDef = 0) {
    const absorbed = Math.min(dmg, armorDef);
    const actualDmg = Math.max(0, dmg - absorbed);
    target.HP = Math.max(0, target.HP - actualDmg);
    return { actualDmg, absorbed };
}

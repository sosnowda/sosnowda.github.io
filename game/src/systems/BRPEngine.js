// Ядро системы BRP (Basic Roleplaying Universal Game Engine SRD).
// Чистая логика без зависимостей от движка.
// Все функции используют Math.random, поэтому пригодны и для тестов, и для игры.
// 66.97: единственный импорт — i18n (тоже Node-безопасный): подписи встречных
// проверок formatOpposedCheck локализованы (§12.3 аудита 66.92, п.4).
import { t, tf } from './i18n.js';

// ============================================================
// Раунд 48 (п.4 заявки): ВСТРЕЧНЫЕ проверки БЕЗ «СОПРОТИВЛЕНИЙ».
// Владелец: «Удалить сопротивления, заменив проверками: НАВЫК ПРОТИВ НАВЫКА
// и ХАРАКТЕРИСТИКИ ПРОТИВ ХАРАКТЕРИСТИК».
//
// Как работает (честная встречная проверка BRP — бросают ОБЕ стороны):
//  • игрок бросает d100 против СВОЕГО параметра (сложность уменьшает
//    параметр игрока — отображается ОДИН раз, без дублей);
//  • противник бросает d100 против СВОЕГО того же параметра
//    (если НПЦ не владеет навыком — сравниваются характеристики);
//  • победа: у игрока СТЕПЕНЬ успеха выше; при равных степенях —
//    точность решает (меньший бросок); обе стороны мажут — провал.
// Степени успеха: крит (1/20 навыка) > особый (1/5) > обычный успех > провал.
// ============================================================

// Внутренняя «степень успеха» броска: 3 крит / 2 особый / 1 успех / 0 провал
function successTier(res) {
    if (!res || res.result === 'fail' || res.result === 'fumble') return 0;
    if (res.result === 'critical') return 3;
    return res.special ? 2 : 1;
}

export function opposedSkillCheck(playerValue, npcValue, difficulty = 0) {
    const d = Math.round(difficulty || 0);
    const pBase = Math.max(1, Math.min(99, Math.round(playerValue || 1)));
    const nBase = Math.max(1, Math.min(99, Math.round(npcValue || 1)));
    // Сложность снижает параметр ИГРОКА (показывается один раз в подписи)
    const pEff = Math.max(1, Math.min(99, pBase - d));
    const pRes = skillCheck(pEff);
    const nRes = skillCheck(nBase);
    const pT = successTier(pRes);
    const nT = successTier(nRes);
    // Победа: степень успеха выше; при равных — точнее бросок (меньше d100).
    // Равные степени и равные броски — спор на стороне защитника (НПЦ).
    const won = pT !== nT ? pT > nT : (pT > 0 && pRes.roll < nRes.roll);
    const result = won
        ? (pRes.critical ? 'critical' : 'success')
        : (pRes.result === 'fumble' ? 'fumble' : 'fail');
    return {
        roll: pRes.roll,
        npcRoll: nRes.roll,
        result,
        won,
        special: won && pRes.special && !pRes.critical,
        critical: won && pRes.critical,
        playerSkill: pBase,
        effective: pEff,
        npcValue: nBase,
        difficulty: d,
    };
}

// Короткая подпись проверки для диалогов/летописи (без сопротивлений,
// сложность — один раз):
// «бросок 22 при сложности +10: Убеждение 45 против Убеждения жителя 40 (бросок НПЦ 55) — успех»
// 66.97 (§12.3 аудита 66.92, п.4 i18n-гигиена): строки обёрнуты в t()/tf() —
// раньше EN-игрок видел русскую строку в диалогах и летописи (промах словаря).
// Имена навыков приходят от вызывающей стороны — они тоже обязаны быть t()-обёрнуты
// (см. oppSkillLabel в data/npcStats.js для встречной стороны).
export function formatOpposedCheck(res, playerSkillName, npcSkillName) {
    if (!res || res.playerSkill == null) return '';
    const diffPart = res.difficulty
        ? tf(t(' при сложности {0}'), `${res.difficulty > 0 ? '+' : ''}${res.difficulty}`)
        : '';
    const verdict = res.result === 'critical' ? t('ОСОБЫЙ УСПЕХ')
        : res.result === 'success' ? t('успех')
        : res.result === 'fumble' ? t('провал (fumble)') : t('провал');
    return tf(t('бросок {0}{1}: {2} {3} против {4} {5} (бросок НПЦ {6}) — {7}'),
        res.roll, diffPart, playerSkillName, res.playerSkill,
        npcSkillName, res.npcValue != null ? res.npcValue : '?',
        res.npcRoll != null ? res.npcRoll : '?', verdict);
}

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

// ============================================================
// Итерация 66.89 (приказ владельца 3/8): БОНУС УРОНА — BRP-КАНОН (STR+SIZ).
// Раньше DB считался от (STR+CON): у всех прегенов сумма 95–155 попадала
// в верхнюю ступень +2d6 (среднее 7) — вклад DB был больше среднего урона
// любого оружия, и выбор «нож или меч» не ощущался.
//
// Канон — официальный онлайн-SRD BRP Universal Game Engine (Chaosium,
// brp.chaosium.com, §2.5 Derived Characteristics): DB = f(STR + SIZ),
// масштаб характеристик 3d6 / 2d6+6 (не ×5):
//     STR+SIZ:  2–12 → −1D6 | 13–16 → −1D4 | 17–24 → нет
//              25–32 → +1D4 | 33–40 → +1D6 | 41+  → +2D6
// Игра хранит характеристики в масштабе ×5 (3d6×5 = 15..90), поэтому
// сумма переводится в кубиковый масштаб делением на 5 (округление к
// ближайшему: дрейф случайных героев ±3..12 ломает кратность).
// SIZ возвращён в модель персонажа (канон: у человека 2d6+6, ×5 → 40–90).
// ============================================================
export function damageBonus(str, siz) {
    const total = Math.round((str || 0) / 5) + Math.round((siz || 0) / 5);
    if (total <= 12) return { text: '-1d6', min: -6, max: -1 };
    if (total <= 16) return { text: '-1d4', min: -4, max: -1 };
    if (total <= 24) return { text: '0', min: 0, max: 0 };
    if (total <= 32) return { text: '+1d4', min: 1, max: 4 };
    if (total <= 40) return { text: '+1d6', min: 1, max: 6 };
    return { text: '+2d6', min: 2, max: 12 };
}

// ============================================================
// Итерация 66.89 (приказ владельца 3): ОСОБЫЙ И КРИТИЧЕСКИЙ УСПЕХ —
// ПО BRP SRD (паритет игрока и врага; раньше у игрока был ×1.5,
// а у врага фактический ×2 через special-подмножество крита).
//
// Канон (онлайн-SRD, §5.13 Special Successes): «определи максимум урона
// оружия, добавь к нему результат обычного броска урона и бонус урона…
// броня вычитается как обычно». Крит (1/20) — высшая степень успеха по
// BRP: урон = максимум оружия + МАКСИМУМ бонуса урона, броня НЕ защищает
// (канон старшинства степеней d100-семейства).
//   tier 1 — обычный успех: бросок оружия (+плоский бонус оружия входит
//            в dice-диапазон игры через weapon.bonus в CombatScene) + бросок БУ;
//   tier 2 — особый (1/5):  МАКСИМУМ оружия + обычный бросок оружия + бросок БУ;
//   tier 3 — крит (1/20):   МАКСИМУМ оружия + МАКСИМУМ БУ; броня игнорируется
//            (CombatScene передаёт armorDef = 0).
// weapon.bonus (плоский «+1» оружия) в этой игре входит в запись урона
// («1d8+1») и учитывается на стороне вызова — как раньше.
// ============================================================
export const DAMAGE_TIER = { NORMAL: 1, SPECIAL: 2, CRITICAL: 3 };

// Степень успеха из результата skillCheck: 3 крит / 2 особый / 1 успех / 0 провал.
export function damageTierOf(res) {
    if (!res || res.result === 'fail' || res.result === 'fumble') return 0;
    if (res.result === 'critical') return DAMAGE_TIER.CRITICAL;
    return res.special ? DAMAGE_TIER.SPECIAL : DAMAGE_TIER.NORMAL;
}

export function rollDamage(weaponDice, bonus, tier = DAMAGE_TIER.NORMAL) {
    const wd = weaponDice || { min: 1, max: 1 };
    const t = (typeof tier === 'number') ? tier : DAMAGE_TIER.NORMAL;
    // Кость оружия: обычный успех — бросок; особый/крит — максимум кости
    // (SRD 5.13: «maximum damage the weapon can roll»).
    const base = (t >= DAMAGE_TIER.SPECIAL)
        ? wd.max
        : (wd.min + Math.floor(Math.random() * (wd.max - wd.min + 1)));
    // Особый успех: сверху ещё ОБЫЧНЫЙ бросок оружия (SRD 5.13: «add the
    // results of a normal damage roll to it» — пример: 7 + 4 + 2 = 13).
    let extra = 0;
    if (t >= DAMAGE_TIER.SPECIAL) {
        extra += wd.min + Math.floor(Math.random() * (wd.max - wd.min + 1));
    }
    // Бонус урона (БУ): обычный/особый — бросок; крит — максимум
    // (таблица БУ может быть ОТРИЦАТЕЛЬНОЙ — границы min..max честные).
    let b = 0;
    if (bonus && typeof bonus.min === 'number' && typeof bonus.max === 'number') {
        b = (t >= DAMAGE_TIER.CRITICAL)
            ? bonus.max
            : (bonus.min + Math.floor(Math.random() * (bonus.max - bonus.min + 1)));
    }
    return Math.max(0, base + extra + b);
}

// Применение урона с учётом доспеха (BRP SRD: доспех поглощает урон)
export function applyDamage(target, dmg, armorDef = 0) {
    const absorbed = Math.min(dmg, armorDef);
    const actualDmg = Math.max(0, dmg - absorbed);
    target.HP = Math.max(0, target.HP - actualDmg);
    return { actualDmg, absorbed };
}

// Раунд 66.21 (приказы владельца 13–14): ПОЖЕРТВОВАНИЕ ЦЕРКВИ.
// В диалоге со священником (и кнопкой в церкви) открывается меню сумм:
// 5 / 10 / 25 / 50 денег. Размер пожертвования определяет прибавку:
// 5→+1, 10→+2, 25→+5, 50→+10 (потолок +10, см. donationRepAmount).
// Прибавка идёт И личной репутации у священника, И деревенской.
// Одно пожертвование в день (реестр 'quest.churchDonationDay'),
// на выбор суммы уходит 10 минут игровых.

import { createDialog, closeAllSingletonDialogs } from '../utils/ui.js';
import { changeNpcRepExact, changeVillageRepExact, donationRepAmount } from '../data/reputation.js';
import { ActionLog } from '../data/actionLog.js';
import { tickTime } from './TimeSystem.js';
import { t, tf } from './i18n.js';

/** Суммы, которые принимает блюдо для пожертвований. */
export const DONATION_AMOUNTS = [5, 10, 25, 50];

/** Ключ дня последнего пожертвования в реестре 'quest'. */
function todayKey(registry) {
    const time = registry.get('gameTime');
    return time ? `${time.yearFromChrist}-${time.month}-${time.day}` : '0';
}

/**
 * Меню пожертвования (открывается из диалога священника и кнопки в церкви).
 * @param {Phaser.Scene} scene — InteriorScene церкви (или любая с registry)
 */
export function showDonationMenu(scene) {
    if (!scene || !scene.registry) return;
    const reg = scene.registry;
    const player = reg.get('player');
    if (!player) return;
    const q = reg.get('quest') || {};
    // Раунд 66.21 QA: меню не должно наслаиваться на предыдущий диалог
    closeAllSingletonDialogs(scene);
    if (q.churchDonationDay === todayKey(reg)) {
        createDialog(scene, t('Пожертвование'),
            t('Ты уже жертвовал нынче. Свечей куплено на всю неделю вперёд.'),
            [{ text: t('Ну ладно.'), callback: () => {} }],
            { portraitKey: 'portrait_priest' });
        return;
    }
    const buttons = DONATION_AMOUNTS.map(amount => ({
        text: tf(t('🕯 Положить {0} д. (+{1} к репутации)'), amount, donationRepAmount(amount)),
        callback: () => performDonation(scene, amount),
    }));
    buttons.push({ text: t('В другой раз'), callback: () => {} });
    createDialog(scene, t('Пожертвование церкви'),
        t('Отец Савватий кивает на блюдо у иконостаса: «Кто много имя́ет, от того много и требует. А кто мало — тому и малое вменится».')
        + '\n\n' + t('Сколько положишь на блюдо?'),
        buttons, { portraitKey: 'portrait_priest' });
}

/** Само пожертвование: списание денег, репутация, журнал, поп-ап. */
export function performDonation(scene, amount) {
    if (!scene || !scene.registry) return;
    const reg = scene.registry;
    // Закрыть меню сумм перед поп-апом результата (QA 66.21: без наслоений)
    closeAllSingletonDialogs(scene);
    const player = reg.get('player');
    if (!player) return;
    if ((player.dengas || 0) < amount) {
        createDialog(scene, t('Пожертвование'),
            t('В мошне пусто — не до пожертвований. Заработай в мастерской или помоги деревне.'),
            [{ text: t('Приду позже.'), callback: () => {} }],
            { portraitKey: 'portrait_priest' });
        return;
    }
    const day = todayKey(reg);
    player.dengas -= amount;
    reg.set('player', player);
    const q = reg.get('quest') || {};
    q.churchDonationDay = day;
    reg.set('quest', q);

    const rep = donationRepAmount(amount);
    changeNpcRepExact(reg, 'priest', rep, 'пожертвование церкви');
    changeVillageRepExact(reg, rep, 'пожертвование церкви');
    tickTime(reg, 10);
    ActionLog.add(reg, tf(t('Пожертвовал {0} д. в церкви (+{1} репутации священнику и деревне).'), amount, rep));
    createDialog(scene, t('Пожертвование'),
        tf(t('Ты кладёшь {0} денег на блюдо. «На свечи и ладан», — говоришь тихо. Отец Савватий благословляет тебя.\n\nЛичная репутация у священника: +{1}. Деревенская: +{1}.'), amount, rep),
        [{ text: t('Низко поклониться иконам.'), callback: () => {} }],
        { portraitKey: 'portrait_priest' });
    if (typeof scene.updateHUD === 'function') {
        try { scene.updateHUD(); } catch (e) { /* некритично */ }
    }
}

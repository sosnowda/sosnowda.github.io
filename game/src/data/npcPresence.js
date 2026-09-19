// Раунд 27: живая система присутствия жителей (пп.6-11).
// Каждый взрослый NPC в каждый час игры находится в ОДНОМ месте:
//   home — в своём интерьере, village — на улице деревни, tavern — на
//   постоялом дворе, mill/apiary/lake/river/forest/field/gate/church —
//   на рабочих локациях за околицей.
//
// Правила владельца:
//   п.7  — Авдей (peasant1) днём работает на МЕЛЬНИЦЕ;
//   п.8  — Марфа (widow) — пасечница: иногда ПАСЕКА, иногда сбор трав
//          на ОЗЕРЕ, РЕКЕ или в ЛЕСУ;
//   п.10 — староста днём гуляет по деревне, а не сидит дома;
//   п.11 — все взрослые случайно (по-разному каждый день) ходят в
//          таверну и сидят там по несколько часов в сутки.
//
// Раунд 28 (п.1): дом на месте часовни — ДОМ ПАХАРЯ, не пасечника!
//   Тарас (beekeeper1) — ПАХАРЬ: днём работает НА ПОЛЕ (пашет/боронит).
//   Ульев у дома больше нет. Семеро детей ДНЁМ:
//     пасут скот НА ПАСТБИЩЕ (выпас), ловят рыбу НА ОЗЕРЕ или РЕКЕ,
//     собирают грибы В ЛЕСУ или бегают по ДЕРЕВНЕ.
//
// Всё детерминировано: hash(seed, npcId, день, час) — один и тот же час
// даёт одно и то же место (не мигает), но каждый игровой день расписание
// новое. Работает и для старых сейвов (seed 0), и для новых NPC.

import { getTime, getTimeOfDay } from '../systems/TimeSystem.js';
import { getHerdState } from './herd.js';

// Профессия/роль по ID — не зависит от registry (старые сейвы тоже работают)
const NPC_ROLE = {
    elder: 'elder',
    priest: 'priest',
    tavernkeeper: 'tavernkeeper',
    blacksmith: 'blacksmith',
    peasant1: 'miller',          // п.7: Авдей — мельник
    widow: 'beekeeper_f',        // п.8: Марфа — пасечница/травница
    healer: 'healer',
    hunter: 'hunter',
    guard: 'guard',
    fisherman: 'fisherman',
    beekeeper1: 'ploughman',     // Раунд 28 (п.1): Тарас — ПАХАРЬ (не пасечник)
    beekeeper_wife: 'homemaker', // п.6: жена пахаря Фёкла
    elder_wife: 'homemaker',     // п.9: жена старосты
    shepherd1: 'shepherd',       // Раунд 31 (п.2): пастух — водит стадо на водопой
    shepherd2: 'shepherd',       // Раунд 31 (п.2): пастушка Настасья
    kid1: 'child', kid2: 'child', kid3: 'child', kid4: 'child',
    kid5: 'child', kid6: 'child', kid7: 'child',  // Раунд 28 (п.1): семеро детей
    // Раунд 37 (вариант Б): жители новой улицы
    carpenter1: 'carpenter',     // плотник Микула
    carpenter_wife: 'homemaker', // Матрёна
    potter1: 'potter',           // гончар Игнат (глина — на Реке!)
    potter_wife: 'homemaker',    // Анна
    weaver1: 'weaver',           // вдова-ткачиха Пелагея
    shepherd_boy: 'shepherd',    // Ивашка, сын Пелагеи — при овчарне
    fisher_wife: 'homemaker',    // Домна
    kid8: 'child',               // Дунька, дочка гончара
    kid9: 'child',               // Ульяна, внучка знахарки
    // Раунд 46 (п.1): ученик кузнеца живёт расписанием мастера (кузница)
    apprentice: 'blacksmith',
    // Раунд 51 (п.11 заявки): ВОСТОЧНАЯ СЛОБОДА — торговцы и новые жители.
    // У КАЖДОЙ лавки СВОЯ профессия — днём хозяин НА МЕСТЕ (place = id лавки),
    // иначе лавки пустовали бы (расписание 'merchant' гоняет по деревне).
    grocer: 'grocer',            // снедница Прасковья — в лавке снеди
    butcher: 'butcher',          // мясник Потап — в мясной лавке
    peddler: 'peddler',          // торгарь Аверьян — в лавке ремесленника
    shoemaker: 'shoemaker',      // сапожник Нефёд
    shoemaker_wife: 'homemaker', // Агафья
    woodcutter: 'woodcutter',    // дровосек Горазд
};

// Дети семьи пахаря (видимые НПЦ: гуляют по деревне, работают по-детски)
// Раунд 37: + Дунька (дочка гончара) и Ульяна (внучка знахарки)
export const KIDS = ['kid1', 'kid2', 'kid3', 'kid4', 'kid5', 'kid6', 'kid7', 'kid8', 'kid9'];

// Кто НЕ ходит в таверну (п.11): батюшка при службе, тавернщик всегда там,
// стражник на страже у ворот, пастухи при стаде, а ДЕТИ — им на постоялый двор нельзя.
// Раунд 51: лавочники (grocer/butcher/peddler) не отлучаются в таверну в
// рабочие часы — иначе рынок полдня простаивал бы; shoemaker/woodcutter — тоже.
const NO_TAVERN = new Set(['priest', 'tavernkeeper', 'guard', 'child', 'shepherd', 'grocer', 'butcher', 'peddler', 'shoemaker', 'woodcutter']);

// Базовое расписание по роли: сегмент дня → место.
// home = «свой интерьер» (у кузнеца это кузница, у тавернщика — двор).
const BASE_SCHEDULE = {
    elder:        { dawn: 'home',    morning: 'home',    noon: 'village', evening: 'village', dusk: 'home',    night: 'home' },
    priest:       { dawn: 'church',  morning: 'church',  noon: 'church',  evening: 'church',  dusk: 'church',  night: 'church' },
    tavernkeeper: { dawn: 'tavern',  morning: 'tavern',  noon: 'tavern',  evening: 'tavern',  dusk: 'tavern',  night: 'tavern' },
    // Раунд 37 (п.20 заявки): кузнец днём говорит «собираюсь на постоялый двор» —
    // теперь расписание с этим СОГЛАСОВАНО: в полдень он там и есть,
    // кузница в этот час честно закрыта (см. VillageScene.getInteriorClosure)
    blacksmith:   { dawn: 'home',    morning: 'home',    noon: 'tavern',  evening: 'home',    dusk: 'home',    night: 'home' },
    miller:       { dawn: 'mill',    morning: 'mill',    noon: 'mill',    evening: 'home',    dusk: 'home',    night: 'home' },
    ploughman:    { dawn: 'field',   morning: 'field',   noon: 'field',   evening: 'home',    dusk: 'home',    night: 'home' },   // Раунд 28: Тарас днём НА ПОЛЕ
    child:        { dawn: 'village', morning: 'work',    noon: 'work',    evening: 'village', dusk: 'home',    night: 'home' },   // Раунд 28: дети — день по делам (work = детерминированный выбор)
    beekeeper:    { dawn: 'apiary',  morning: 'apiary',  noon: 'apiary',  evening: 'home',    dusk: 'home',    night: 'home' },
    beekeeper_f:  { dawn: 'home',    morning: 'work',    noon: 'work',    evening: 'home',    dusk: 'home',    night: 'home' },
    homemaker:    { dawn: 'home',    morning: 'village', noon: 'home',    evening: 'home',    dusk: 'home',    night: 'home' },
    healer:       { dawn: 'field',   morning: 'home',    noon: 'home',    evening: 'home',    dusk: 'home',    night: 'home' },
    hunter:       { dawn: 'forest',  morning: 'forest',  noon: 'forest',  evening: 'home',    dusk: 'home',    night: 'home' },
    guard:        { dawn: 'gate',    morning: 'home',    noon: 'village', evening: 'gate',    dusk: 'gate',    night: 'gate' },
    fisherman:    { dawn: 'river',   morning: 'river',   noon: 'river',   evening: 'home',    dusk: 'home',    night: 'home' },
    shepherd:     { dawn: 'pasture', morning: 'pasture', noon: 'pasture', evening: 'pasture', dusk: 'home',    night: 'home' }, // Раунд 31: место пастуха = место стада
    // Раунд 37 (вариант Б): новые профессии второй улицы
    carpenter:    { dawn: 'home',    morning: 'home',    noon: 'village', evening: 'home',    dusk: 'home',    night: 'home' }, // Микула днём чинит дворы
    potter:       { dawn: 'home',    morning: 'river',   noon: 'river',   evening: 'home',    dusk: 'home',    night: 'home' }, // Игнат за глиной ходит на Реку
    weaver:       { dawn: 'home',    morning: 'village', noon: 'home',    evening: 'home',    dusk: 'home',    night: 'home' }, // Пелагея при стане, отлучается по делу
    // Раунд 51: восточная слобода. Место лавки = её interiorId — InteriorScene
    // считает хозяина «на месте», лавка работает весь день.
    // Раунд 53: лавки снеди/мясная удалены — Прасковья и Потап живут и
    // работают в своих домах (снедница при печи, мясник при столешне).
    grocer:      { dawn: 'home', morning: 'home', noon: 'home', evening: 'home', dusk: 'home', night: 'home' },
    butcher:     { dawn: 'home', morning: 'home', noon: 'home', evening: 'home', dusk: 'home', night: 'home' },
    peddler:     { dawn: 'home', morning: 'shop_tools', noon: 'shop_tools', evening: 'shop_tools', dusk: 'home', night: 'home' },
    shoemaker:   { dawn: 'home', morning: 'home', noon: 'village', evening: 'home', dusk: 'home', night: 'home' },
    woodcutter:  { dawn: 'home', morning: 'forest', noon: 'forest', evening: 'home', dusk: 'home', night: 'home' },
};

// Раунд 31 (п.3): НОЧЬЮ на локациях КРОМЕ ДЕРЕВНИ НИКОГО НЕТ.
// Если расписание вдруг отправило жителя за околицу на ночь — он дома.
// (вор не из этого списка — он может быть на локации и ночью)
const NIGHT_FORBIDDEN_PLACES = new Set([
    'mill', 'apiary', 'lake', 'river', 'forest', 'field', 'pasture',
    'pogost', 'road', 'road_south', 'forest_edge', 'forest_glade', 'work',
]);

// Активности по роли и месту (что видно в подсказках)
const ACTIVITY = {
    // Раунд 51: восточная слобода
    grocer: {
        home: 'печёт караваи да пироги',
        village: 'с поклоном торговалась с покупателями',
    },
    butcher: {
        home: 'колет тушу к утру',
        village: 'несёт окорок заказчику',
    },
    peddler: {
        shop_tools: 'разложил товар на прилавке', home: 'пересчитывает товар',
        village: 'приглашал в лавку прохожих',
    },
    shoemaker: {
        home: 'шьёт сапоги у окна', village: 'носит заказы по деревне',
    },
    woodcutter: {
        forest: 'рубит сухостой за околицей', home: 'колет дрова во дворе',
        village: 'тащит вязанку дров',
    },
    elder: {
        dawn: 'молится дома', morning: 'решает дела в горнице',
        noon: 'обходит деревню', evening: 'обходит деревню',
        dusk: 'возвращается домой', night: 'спит',
        tavern: 'заглянул на постоялом дворе', village: 'обходит деревню',
    },
    priest: { church: 'при службе в церкви' },
    tavernkeeper: { tavern: 'работает на постоялом дворе' },
    blacksmith: {
        home: 'куёт в кузнице', tavern: 'отдыхает на постоялом дворе',
        village: 'по делу во дворе',
    },
    miller: {
        mill: 'мелет зерно на мельнице', home: 'дома, после мельничной работы',
        village: 'по дороге с мешком муки', tavern: 'отдыхает на постоялом дворе',
    },
    beekeeper: {
        apiary: 'работает на пасеке', home: 'дома, после пасеки',
        village: 'несёт раму с сотами', tavern: 'отдыхает на постоялом дворе',
    },
    ploughman: {
        field: 'пашет и боронит на поле', home: 'дома, после полевых работ',
        village: 'несёт соху с поля', tavern: 'отдыхает на постоялом дворе',
    },
    child: {
        pasture: 'пасёт скот на выпасе', lake: 'ловит рыбу у озера',
        river: 'ловит рыбу на реке', forest: 'собирает грибы в лесу',
        village: 'бегает и играет с братьями и сёстрами', home: 'дома, греется у печи',
    },
    beekeeper_f: {
        apiary: 'работает на пасеке', lake: 'собирает травы у озера',
        river: 'собирает травы на реке', forest: 'собирает травы в лесу',
        home: 'хозяйствует по дому', village: 'по воду',
        tavern: 'отдыхает на постоялом дворе',
    },
    homemaker: {
        home: 'хозяйствует по дому', village: 'у колодца',
        tavern: 'болтает с соседками на постоялом дворе',
    },
    healer: {
        field: 'собирает травы на росе', home: 'лечит больных',
        village: 'променяет снадобья', tavern: 'отдыхает на постоялом дворе',
    },
    hunter: {
        forest: 'на охоте в лесу', home: 'делит добычу',
        village: 'проверяет силки', tavern: 'рассказывает байки на постоялом дворе',
    },
    guard: {
        gate: 'на страже у ворот', village: 'патрулирует деревню',
        home: 'отсыпается после стражи',
    },
    fisherman: {
        river: 'ловит рыбу', home: 'коптит рыбу',
        village: 'чини́т сети во дворе', tavern: 'хвастает улов на постоялом дворе',
    },
    shepherd: {
        pasture: 'пасёт стадо на выпасе', river: 'поит стадо на реке',
        lake: 'поит стадо у озера', home: 'отсыпается, скот в хлеву',
        village: 'прогоняет стадо по улице', tavern: 'отдыхает на постоялом дворе',
    },
    // Раунд 37 (вариант Б): новые профессии
    carpenter: {
        home: 'тешет ложки и чинит избу', village: 'носит брёвна для починки дворов',
        tavern: 'приходит с топором за мёдом', field: 'рубит лес на дрова',
    },
    potter: {
        river: 'роет глину у брода', home: 'мнёт глину и лепит горшки',
        village: 'сушит горшки на солнце', tavern: 'согревается у печи',
    },
    weaver: {
        home: 'ткёт холст на стане', village: 'несёт холст соседкам',
        tavern: 'болтает за прялкой', field: 'теребит лён на поле',
    },
};

// Где искать человека (для подсказок в пустых домах)
export const PLACE_NAMES = {
    home: 'дома', village: 'на улице деревни', tavern: 'на постоялом дворе',
    mill: 'на мельнице', apiary: 'на пасеке', lake: 'у озера',
    river: 'на реке', forest: 'в лесу', field: 'в поле',
    gate: 'у ворот', church: 'в церкви', pasture: 'на выпасе',
    // Раунд 53: дома слободы вместо удалённых лавок
    shop_tools: 'в лавке ремесленника',
};

// Короткие уличные реплики для NPC без полного дерева диалогов.
// РАУНД 55 (заявка «без повторений при взаимодействии»): реплика может быть
// СТРОКОЙ (как раньше) или МАССИВОМ вариантов — тогда pickOutdoorLine()
// РОТАЦИОННО выдаёт их по очереди, без повтора подряд.
export const OUTDOOR_LINES = {
    healer: [
        '«Травы нынче добрые, да только болеть люди всё равно умеют...»',
        '«Полынь да зверобой сушатся — зима болезнь любит, готовься заранее.»',
        '«Тепло держи, путник: все хвори от озябших ног начинаются.»',
    ],
    shepherd1: [
        '«Тпру-у! Стадо к воде ведем — коровы да лошади пьют, а я гляжу, чтоб никто не разбрелся.»',
        '«Зорька телиться собирается — вот жду, не отойду.»',
        '«Тихо на выпасе, только мухи да оводы — и те налегке.»',
    ],
    shepherd2: [
        '«Корова Мушка опять в камыши забралась... К лошадям пойду, проверю, как они.»',
        '«Гусь с пруда убрел — я его к стаду пригнала, не отбился бы.»',
        '«Козел Прохор — прохвост: жвачку у меня из кармана достал!»',
    ],
    hunter: [
        '«Тихо в лесу сегодня. Слишком тихо — зверь чует неладное.»',
        '«Заячьи следы у опушки — петли поставлю к вечеру.»',
        '«Лось давешний у речки проходил — крупный, заметь.»',
    ],
    guard: [
        '«Прохода нет, всё проверяю. Без порядка за околицей — беда. Сторожево дело — глаз да остр.»',
        '«Ночью волк у стога выл — не к добру, но помолчим.»',
        '«Иди с миром, путник. Ворота ночью запираю — не опаздывай.»',
    ],
    fisherman: [
        '«Клюет хорошо. Хочешь свежей рыбки — заходи к вечеру.»',
        '«Лещи нынче тяжёлые идут — держу уду крепче.»',
        '«На броду вода упала — рыба к ямам подалась, туда и сети.»',
    ],
    // Раунд 28 (п.1): пахарь Тарас и его семеро детей
    beekeeper1: [
        '«Соха сама не спашет! Поле ждет, а я тут стою...»',
        '«Земля мягкая нынче — пашня спорится, слава Богу.»',
        '«Домой приду — а там семеро встречают. Держись, путник!»',
    ],
    kid1: [
        '«А я раньше бати с поля прибежал! Честно-пречестно!»',
        '«Я воробья чуть поймал! Вон — улетел...»',
        '«Меня за пшеничной кашей дома не держат — я вольный!»',
    ],
    kid2: [
        '«Не верь Степаниде — это она съела всю бражку... мёду то есть!»',
        '«У меня пятка чешется — к дождю, батя сказал!»',
        '«А я знаю, где ежик живет! Только не скажу — он стеснительный!»',
    ],
    kid3: [
        '«Смотри, сколько грибов набрал! Батя хвалить будет!»',
        '«Это не моя палка, это мой МЕЧ! Врагов гонять!»',
        '«А меня мать за лужу ругала... А она глубокая!»',
    ],
    kid4: [
        '«На выпасе козел Прохор меня бодает. Злой очень!»',
        '«Я Прохора боюсь, но не скажу ему — он и так знает...»',
        '«Дай корке хлеба! Я за тебя Прохора прокляну!»',
    ],
    kid5: [
        '«Улов покажешь? А то у меня ни одной рыбки не клюнуло!»',
        '«Рыбу видел — ВОТ такую! Уплыла, глупая...»',
        '«Дядька Ерёма сказал: ночью клевать будет. А я усну к тому времени!»',
    ],
    kid6: [
        '«Батя говорит: кто поле любит, того и земля кормит.»',
        '«Я колоски считал — не досчитался, ног много!»',
        '«Когда вырасту — трактор... то есть пару коней заведу!»',
    ],
    kid7: [
        '«А мама сказала в избу без ужина не приходить! Так что я гуляю!»',
        '«Я не шалил! Это ветер меня качал!»',
        '«Тссс... я от сестры прячусь. Она за мной бегает — устала уже!»',
    ],
    // Раунд 37 (вариант Б): жители новой улицы
    carpenter1: [
        '«Топор — мой напарник: изба без него — что без углов. Слушай, а крыльцо у тебя не скрипит?»',
        '«Стой смирно — вот те скоба, вот тесло. Дело всякого любит.»',
        '«Стружки наелся по горло — а все равно дерево любит, не бросишь.»',
    ],
    potter1: [
        '«Глина нынче жирная, с речки привез. Горшок добрый — тот, что не треснул в печи, как и человек.»',
        '«Обжиг затеял — заходи, когда полыхает: красиво, аж дух захватит.»',
        '«Кувшин сузила рука — того гляди глаз спрячет! Хе-хе.»',
    ],
    weaver1: [
        '«Стан гудит с утра до ночи. Холст — он как судьба: нить за нитью, не спеши.»',
        '«Нитка порвалась — не беда: узелок завяжу, дальше пойду.»',
        '«Кросна мои — кормилицы. И то сказать: у кого руки, у того и холст.»',
    ],
    shepherd_boy: [
        '«Тс-с! Овцы дремлют. Как Рыжая заблеет — конец сну!»',
        '«Я считал овец — тридцать четыре. Или тридцать пять? Пойду пересчитаю!»',
        '«Рыжая — моя любимица. Только никому не говори!»',
    ],
    fisher_wife: [
        '«Ерёма на броду ушел. Рыба у нас есть — заходи к вечеру.»',
        '«Сети чиню да уху варю. Муж вернется — горячая будет.»',
        '«Вон, чешую высушила — на клумбу бросить: земля любит!»',
    ],
    carpenter_wife: [
        '«Микула весь в стружке, а я весь день пряду. Заходи, чаем с брусникой напою.»',
        '«Прялка поет, а муж стучит — эх, веселье в доме!»',
        '«Хлебы сажаю. Приходи через час — румяные будут!»',
    ],
    potter_wife: [
        '«Игнат на речку за глиной ушел. А я горшки обжигаю — загляните, какой узор вышел!»',
        '«Дунька посуда бьется, а дочка — целее горшка! Хе-хе.»',
        '«Глину мну, колени в ней — зато горшки добрые выходят.»',
    ],
    kid8: [
        '«Я горшочек слепила! Батя сказал — на обжиг! А он у нас самый лучший!»',
        '«У меня ладошки в глине — вот! Высохнут — красивые будут!»',
        '«Я маме помогаю! Горшочки ношу — почти не бью!»',
    ],
    kid9: [
        '«Бабушка лечит всю деревню, а меня учит травы разбирать. Эта — от живота, эта — от тоски!»',
        '«Я лапку воробью перевязывала! Он теперь ручной — почти!»',
        '«Не трогай пучки! Это — от простуда, я для деревни сушу!»',
    ],
    // Раунд 46 (п.1): ученик кузнеца — на улице (по расписанию мастера)
    apprentice: [
        '«Мастер мой к Богу отошел... Теперь я у горна. Снаряжение — в кузнице, как прежде.»',
        '«Кую, как учили. Мастер издал бы поглядел — не похвалил бы, но и не отругал.»',
        '«Уголь ношу, мехи качаю — рука крепчает. Скоро и меч скую.»',
    ],
    // Раунд 51: торговцы рыночного ряда и жители слободы
    grocer: [
        '«Караваи горячие! Сыр да молоко — всякому найдется угощение!»',
        '«Пироги с репой поспели — похрустей, пока горячие!»',
        '«Сметана нынче густая, ложка стоит! Подходи, не стесняйся!»',
    ],
    butcher: [
        '«Тесак остр, туши свежи — подходи, выбирай окорок потучее!»',
        '«Колбаса копченая — с дымком! К пиву постоялого двора — самое то!»',
        '«С утра возился у туш — а товар хоть куда! Бери, пока горячее!»',
    ],
    peddler: [
        '«Ножи, веревки, обереги — всякая вещь в лавке к делу пришита!»',
        '«Кремень — искра из-под дождя достанет! Проверено самим!»',
        '«Свечи восковые — чистый свет! Грех в темноте сидеть!»',
    ],
    shoemaker: [
        '«Сапог, что глина сухая — не боится ни грязи, ни беды. Примерь!»',
        '«Колодки скрипят, шило звенит — работа идет!»',
        '«Пояс кожаный — подарок добрый. Кому носить будете?»',
    ],
    shoemaker_wife: [
        '«Нефед до ночи колодки точит, а я ужин стережет. Заходи, гостек!»',
        '«Щи да каша — пища наша! А хочешь, чайку с мятой?»',
        '«В слободе нынче тихо. Только Нефед стучит да собаки тявкают.»',
    ],
    woodcutter: [
        '«Лес рубить — не поле пахать: спина помнит каждое дерево. Топор точный — напарник честный.»',
        '«Поленица нынче высокая — зима встречу во всеоружии!»',
        '«Волка видел в четверг. Он меня, я его — разошлись по-доброму.»',
    ],
};

/**
 * РАУНД 55: взять уличную реплику NPC без повтора подряд.
 * Строка — возвращается как есть; массив — ротация по счётчику сцены.
 */
export function pickOutdoorLine(registry, npcId, fallback) {
    const val = OUTDOOR_LINES[npcId];
    if (!val) return fallback;
    if (!Array.isArray(val)) return val;
    if (!val.length) return fallback;
    const key = 'outLine:' + npcId;
    const i = registry ? (registry.get(key) || 0) : 0;
    if (registry) registry.set(key, i + 1);
    return val[i % val.length];
}

// Диалоговое дерево по ID (полные диалоги; остальные — OUTDOOR_LINES)
// Раунд 34: у ВСЕХ семерых детей пахаря — полные детские диалоговые деревья
// Раунд 37 (вариант Б): + плотник, гончар, ткачиха, рыбак, знахарка,
// пастушок Ивашка, жёны и двое новых детей
export const NPC_DIALOGUE = {
    elder: 'elder_quest',
    priest: 'priest',
    tavernkeeper: 'tavernkeeper',
    blacksmith: 'blacksmith',
    peasant1: 'peasant1',
    widow: 'widow',
    beekeeper1: 'beekeeper1',
    beekeeper_wife: 'beekeeper_wife',
    elder_wife: 'elder_wife',
    kid1: 'kid1', kid2: 'kid2', kid3: 'kid3', kid4: 'kid4',
    kid5: 'kid5', kid6: 'kid6', kid7: 'kid7',
    carpenter1: 'carpenter1',
    carpenter_wife: 'carpenter_wife',
    potter1: 'potter1',
    potter_wife: 'potter_wife',
    weaver1: 'weaver1',
    shepherd_boy: 'shepherd_boy',
    fisherman: 'fisherman1',
    fisher_wife: 'fisher_wife',
    healer: 'healer1',
    kid8: 'kid8', kid9: 'kid9',
    // Раунд 46 (п.1): ученик кузнеца — полное дерево после гибели мастера
    apprentice: 'apprentice',
    // Раунд 51: восточная слобода
    grocer: 'grocer',
    butcher: 'butcher',
    peddler: 'peddler',
    shoemaker: 'shoemaker',
    shoemaker_wife: 'shoemaker_wife',
    woodcutter: 'woodcutter',
};

// ---- Детерминированный псевдорандом (FNV-1a → [0..1)) ----
function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

function dayKeyOf(time) {
    if (!time) return 0;
    return time.yearFromChrist * 372 + time.month * 31 + time.day;
}

// Окно посещения таверны на день (п.11): { start, len } | null.
// 55% взрослых ходят каждый день, окно 2-4 часа между 11 и 22.
export function tavernWindowFor(registry, npcId, time) {
    const role = NPC_ROLE[npcId];
    if (!role || NO_TAVERN.has(role)) return null;
    const seed = registry.get('npcSeed') || 0;
    const dk = dayKeyOf(time);
    if (hash01(`${seed}:${npcId}:${dk}:tav`) >= 0.55) return null;
    const start = 11 + Math.floor(hash01(`${seed}:${npcId}:${dk}:start`) * 9); // 11..19
    const len = 2 + Math.floor(hash01(`${seed}:${npcId}:${dk}:len`) * 3);      // 2..4
    return { start, len };
}

// Марфа (п.8): место сбора трав на день — детерминировано на день,
// в полдень может смениться (полдня пасека — полдня травы).
function marfaWorkPlace(registry, time, hour, segId) {
    const seed = registry.get('npcSeed') || 0;
    const dk = dayKeyOf(time);
    const morningPlace = ['apiary', 'lake', 'river', 'forest'][
        Math.floor(hash01(`${seed}:widow:${dk}:morn`) * 4)
    ];
    if (segId === 'morning') return morningPlace;
    // После полудня — 50% смена места
    const noonPlace = hash01(`${seed}:widow:${dk}:noon`) < 0.5
        ? morningPlace
        : ['apiary', 'lake', 'river', 'forest'][Math.floor(hash01(`${seed}:widow:${dk}:noon2`) * 4)];
    return noonPlace;
}

// Дети пахаря (раунд 28, п.1): днём каждый ребёнок — по СВОЕМУ детерминированному
// делу на день: выпас (пастбище), рыбалка (озеро/река), грибы (лес) или беготня
// по деревне. Утром и после полудня место может меняться (как у Марфы).
const CHILD_PLACES = ['pasture', 'lake', 'river', 'forest', 'village'];

function childDayPlace(registry, npcId, time, segId) {
    const seed = registry.get('npcSeed') || 0;
    const dk = dayKeyOf(time);
    return CHILD_PLACES[Math.floor(hash01(`${seed}:${npcId}:${dk}:${segId}`) * CHILD_PLACES.length)];
}

/**
 * Где NPC находится в текущий час.
 * @returns {{ place: string, activity: string }}
 */
export function getPresence(registry, npcId) {
    const time = getTime(registry);
    // ВНИМАНИЕ: в timeState час хранится в поле `hour` (не `hours`)
    const hour = time ? (time.hour ?? 12) : 12;
    const seg = getTimeOfDay(hour) || { id: 'morning' };
    const segId = seg.id;
    const role = NPC_ROLE[npcId] || 'homemaker';
    const acts = ACTIVITY[role] || {};

    // --- Ночь: все спят дома (кроме при службе); п.3: на локациях вне деревни НИКОГО
    if (segId === 'night') {
        let nightPlace = BASE_SCHEDULE[role] ? BASE_SCHEDULE[role].night : 'home';
        // Раунд 31 (п.3): если расписание вдруг отправило жителя за околицу — он дома.
        // (вор — не отсюда: он может быть на локации и ночью)
        if (NIGHT_FORBIDDEN_PLACES.has(nightPlace)) nightPlace = 'home';
        return { place: nightPlace, activity: acts[nightPlace] || acts.night || 'спит' };
    }

    // --- Пастухи (раунд 31, п.2): везде вместе со стадом; ночью — дома
    if (role === 'shepherd') {
        const herd = getHerdState(registry);
        const place = herd.place === 'barn' ? 'home' : herd.place;
        return { place, activity: acts[place] || 'при стаде' };
    }

    // --- Окно таверны (п.11) ---
    const win = tavernWindowFor(registry, npcId, time);
    if (win && hour >= win.start && hour < win.start + win.len && hour <= 21) {
        // В первый час — ещё на улице (идёт/собирается), дальше сидит внутри
        if (hour === win.start) {
            return { place: 'village', activity: 'собирается на постоялый двор' };
        }
        return { place: 'tavern', activity: acts.tavern || 'сидит на постоялом дворе' };
    }

    // --- Особая роль Марфы (п.8): пасека ИЛИ травы на воде/в лесу ---
    if (role === 'beekeeper_f' && (segId === 'morning' || segId === 'noon')) {
        const wp = marfaWorkPlace(registry, time, hour, segId);
        return { place: wp, activity: acts[wp] || 'занята работой' };
    }

    // --- Дети пахаря (раунд 28, п.1): днём пастбище/озеро/река/лес/деревня ---
    if (role === 'child' && (segId === 'morning' || segId === 'noon')) {
        const wp = childDayPlace(registry, npcId, time, segId);
        return { place: wp, activity: acts[wp] || 'занят детскими делами' };
    }

    // --- Базовое расписание роли ---
    const base = BASE_SCHEDULE[role] || {};
    let place = base[segId] || 'home';
    if (place === 'work') place = 'apiary'; // страховка
    return { place, activity: acts[place] || acts[segId] || 'занят делами' };
}

/**
 * Все NPC (по ID), находящиеся сейчас в данном месте.
 */
export function getNpcsAtPlace(registry, place, allIds) {
    const ids = allIds || ALL_NPC_IDS;
    return ids.filter(id => getPresence(registry, id).place === place);
}

/**
 * Хозяин сейчас в своём интерьере? (для «домов без хозяина»)
 */
export function isOwnerHome(registry, npcId) {
    return getPresence(registry, npcId).place === 'home';
}

// Полный список известных ID (для перебора)
export const ALL_NPC_IDS = Object.keys(NPC_ROLE);

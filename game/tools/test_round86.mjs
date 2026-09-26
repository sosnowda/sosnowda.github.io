// test_round86.mjs — итерация 66.29 (7 приказов владельца).
// Проверки: телеметрия (задокументирована), ремонт 17 фонов интерьеров,
// аналой-пюпитр, иконостас 0.165H, тавернщик у окошка, деревья погоста
// (minDist 95 + зона часовни), pixelArt: true, bob вместо желе, конвейер
// walk-листов героев, SW v79 / game-assets-v26.
import { readFileSync, existsSync, statSync } from 'fs';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
    if (cond) { pass++; console.log('  ✓ ' + msg); }
    else { fail++; console.log('  ✗ FAIL: ' + msg); }
};
const read = (p) => readFileSync(p, 'utf8');

const main = read('../src/main.js');
const is = read('../src/scenes/InteriorScene.js');
const loc = read('../src/scenes/LocationScene.js');
const sw = read('../../sw.js');

console.log('--- 1. Пиксель-арт и анимация (п.6) ---');
ok(main.includes('pixelArt: true'), 'main.js: pixelArt: true — спрайты без «мыла» при масштабах 1.5–2.5');
ok(!/pixelArt:\s*false/.test(main.replace(/^\s*\/\/.*$/gm, '')), 'main.js: в конфиге pixelArt: false больше нет');
ok(is.includes('y: { from: bobY, to: bobY - 2.5 }'), 'InteriorScene: главный НПЦ — bob вместо деформации масштаба');
ok(is.includes('y: { from: secBobY, to: secBobY - 2.5 }'), 'InteriorScene: второй НПЦ — bob вместо деформации');
ok(!is.includes('scaleX: { from: this.npcBaseScale'), 'InteriorScene: «желейное» дыхание scaleX/scaleY удалено');

console.log('--- 2. Церковь: аналой и иконостас (п.2) ---');
ok(is.includes('y0 = height * 0.165, y1 = height * 0.465'), 'иконостас: верх опущен до 0.165H (не заходит под текст)');
ok(is.includes('fillEllipse(ax, ay + 66, 92, 20)'), 'аналой: тень-эллипс на полу');
ok(is.includes('fillRect(ax - 5, ay + 4, 10, 62)'), 'аналой: передняя стойка — ножки до пола');
ok(is.includes("setDisplaySize(44, 50).setRotation(-0.04)"), 'аналой: икона ЛЕЖИТ на наклонной доске');
ok(!is.includes("height * 0.62, 'int_deco_analogion'"), 'аналой: старый невидимый спрайт 48×56 больше не используется');

console.log('--- 3. Таверна (п.2/п.3) ---');
ok(is.includes('width * 0.293, height * 0.435'), 'тавернщик: позиция у окошка выдачи (0.293W, 0.435H)');
ok(is.includes("{ x: 0.60, y: 0.42 }"), '3-й гость таверны выведен из зоны окошка');

console.log('--- 4. Деревья погоста (п.5) ---');
ok(loc.includes('minDist = 95'), 'погост: minDist деревьев 95px (крона ~83px — не слипаются)');
ok(loc.includes('inChapelZone'), 'погост: запретная зона часовни для случайных деревьев');

console.log('--- 5. Ремонт фонов интерьеров (п.2/п.3) ---');
ok(existsSync('../tools/repair_interiors_6629.py'), 'инструмент ремонта в репо: game/tools/repair_interiors_6629.py');
let fresh = 0;
for (const f of ['int_bg_beekeeper_house.jpg', 'int_bg_blacksmith.jpg', 'int_bg_butcher_house.jpg',
    'int_bg_carpenter_house.jpg', 'int_bg_elder_house.jpg', 'int_bg_fisher_house.jpg',
    'int_bg_grocer_house.jpg', 'int_bg_healer_house.jpg', 'int_bg_potter_house.jpg',
    'int_bg_shoemaker_house.jpg', 'int_bg_shop_tools.jpg', 'int_bg_tavern.jpg',
    'int_bg_villager_house_1.jpg', 'int_bg_villager_house_2.jpg', 'int_bg_villager_house_3.jpg',
    'int_bg_weaver_house.jpg', 'int_bg_woodcutter_house.jpg']) {
    const p = '../assets/interiors/' + f;
    if (existsSync(p)) fresh += 1;
}
ok(fresh === 17, `фонов int_bg на месте: ${fresh}/17`);
ok(read('../tools/update_shots_6624.py').includes('sosnowda-site'), 'конвейер кадров: путь к репо исправлен');

console.log('--- 6. Ассеты героев из пака (п.7) ---');
for (const h of ['hero_baenor', 'hero_huntress']) {
    const p = '../assets/sprites/' + h + '.png';
    const sz = existsSync(p) ? statSync(p).size : 0;
    ok(sz > 15000, `${h}.png — walk-лист из пака владельца (${Math.round(sz / 1024)} КБ)`);
}
ok(existsSync('../docs/PACK_ANALYSIS_6629.md'), 'анализ пака Medieval - Heroes I задокументирован (game/docs/PACK_ANALYSIS_6629.md)');

console.log('--- 7. SW и кеши ---');
ok(sw.includes("var CACHE_NAME = 'chronicles-ruthenia-v79';"), 'SW: site-cache v79');
ok(sw.includes("var GAME_ASSETS_CACHE = 'game-assets-v26';"), 'SW: game-assets-v26 (фоны int_bg)');
ok(sw.includes('// v79 — итерация 66.29'), 'SW: журнал содержит запись v79');

console.log('--- 8. Телеметрия Метрики (п.1) ---');
ok(sw.includes('Russian Trusted Sub CA'), 'SW-журнал: документирован вердикт по hdrc/mdd.yandex.net (статистика не страдает)');

console.log(`\n=== ИТОГ: ${pass} зелёных, ${fail} красных ===`);
process.exit(fail ? 1 : 0);

// test_round146.mjs — 66.106: волна В/С/Н frontier-аудита 66.104 + LCP-цель 2.5s.
// Статические проверки волны: Метрика defer, self-host шрифтов, CSP/referrer,
// дневник-комментарии, иконки-спрайт, контраст/тач-цели/золото, мёртвый код,
// термин-канон «Постоялый двор», плюрализация, свидетели, слухи-годы.
// Пины: EN 2189 ключей (r141 — кросс), SW v135, game-assets-v45 цел.
import fs from 'fs';
const read = p => fs.readFileSync(p, 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } };

const ru = read('index.html');
const en = read('en/index.html');
const gameHtml = read('game/index.html');
const f404 = read('404.html');
const en404 = read('en/404.html');
const css = read('styles.css');
const sw = read('sw.js');

console.log('--- 1. LCP: Метрика defer + self-host шрифтов ---');
for (const [page, name] of [[ru, 'RU'], [en, 'EN']]) {
    ok(page.includes("window.addEventListener('load', go, { once: true })"), `${name}: Метрика отложена за window.load`);
    ok(page.includes("requestIdleCallback(initMetrika, { timeout: 4000 })"), `${name}: инициализация в requestIdleCallback`);
    ok(page.includes('webvisor:false'), `${name}: webvisor:false (В19)`);
    ok(!page.includes('fonts.googleapis.com') && !page.includes('fonts.gstatic.com'), `${name}: хосты Google Fonts сняты`);
    ok(page.includes('class="svg-sprite"'), `${name}: SVG-спрайт иконок на месте (В6)`);
    ok(!/[💰🚀📋🔒📜🧮🤖🌍💾🔗🌐📚🏗]/.test(page.replace(/<svg[\s\S]*?<\/svg>/g, '')), `${name}: декоративные эмодзи заменены иконками`);
}
ok((css.match(/@font-face/g) || []).length === 19, 'styles.css: 19 @font-face (self-host)');
ok(css.includes('font-display: swap'), 'styles.css: font-display swap');
ok(fs.existsSync('assets/fonts/prata-400-cyrillic.woff2') && fs.existsSync('assets/fonts/pt-sans-700-latin.woff2'), 'assets/fonts: woff2 на месте');

console.log('--- 2. Security/ops: CSP, referrer, В22, Н1, Н15 ---');
const cspRe = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/;
const csps = [ru, en, gameHtml, f404, en404].map(p => (p.match(cspRe) || [])[1] || '');
ok(csps.every(c => c.includes("form-action 'none'")), 'CSP ×5: form-action none (В18)');
for (const [page, name] of [[ru, 'RU'], [en, 'EN'], [gameHtml, 'game'], [f404, '404'], [en404, 'en/404']]) {
    ok(page.includes('strict-origin-when-cross-origin'), `${name}: Referrer-Policy (В20)`);
}
for (const [page, name] of [[ru, 'RU'], [en, 'EN'], [gameHtml, 'game'], [f404, '404'], [en404, 'en/404']]) {
    ok(!/<!--[^>]*?(аудит|audit|приказ|Раунд|Round)\b/i.test(page), `${name}: процессной лексики в комментариях нет (В22)`);
    ok(!/<!--[^>]*66\.\d+/.test(page), `${name}: версионных меток в HTML-комментариях нет (В22)`);
}
ok(gameHtml.includes("h.textContent = 'Игра не загрузилась'") && !gameHtml.includes('errorEl.innerHTML'), 'game: Н1 textContent вместо innerHTML');
ok(gameHtml.includes('hreflang="en" href="https://sosnowda.github.io/game/?lang=en"'), 'game: hreflang-пара (Н15)');
ok(!gameHtml.includes('Холм Великий'), 'game: В17 — промо называет деревню «Великий Холм»');
ok(gameHtml.includes('Великий Холм'), 'game: «Великий Холм» = канон world.js');

console.log('--- 3. Лендинг: title, writing, CTA, футер ---');
const ruTitle = (ru.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
const enTitle = (en.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
ok(ruTitle.length <= 60, `RU: title ${ruTitle.length} ≤ 60 (В21)`);
ok(enTitle.length <= 60, `EN: title ${enTitle.length} ≤ 60 (В21)`);
for (const [page, name] of [[ru, 'RU'], [en, 'EN']]) {
    ok(!/уникальный проект|unique project/.test(page), `${name}: hype «уникальный» снят (В2)`);
    ok(!/бесконечно креативного|endlessly creative/.test(page), `${name}: hype «бесконечно креативного» снят (В2)`);
    ok(!/сотен|hundreds of historical/.test(page), `${name}: «сотен книг» без числа снято (В5)`);
    ok(!/Готовы войти в летопись|Ready to enter the chronicle/.test(page), `${name}: риторический хук CTA снят (В3)`);
    ok(!/Будете ли вы боярином|Whether you become a boyar/.test(page), `${name}: fake breadth снят (В24)`);
    ok(!/Типа «Рупедии»|A kind of &ldquo;Rupedia&rdquo;/.test(page), `${name}: разговорный регистр снят (С13)`);
    ok(!/(с 66\.39|66\.46\)|66\.85\)|66\.44:)/.test(page), `${name}: внутренних маркеров в альтах нет (С5)`);
    ok(page.indexOf('cta-section') > page.indexOf('id="demo"'), `${name}: финальный CTA после демо (В23)`);
    ok(page.includes('hreflang="en" lang="en">English version') || page.includes('hreflang="ru" lang="ru">Russian version'), `${name}: языковая ссылка в футере (С17)`);
}
ok(ru.includes('Летописи Руси XV века\n            </a>') && !ru.includes('> Летописи Руси XV\n'), 'RU: имя продукта синхронизировано (С14)');
ok(ru.includes('«Летописи Руси XV века»</h3>'), 'RU: заголовок попапа полный (С14)');
ok(ru.includes('description":"Историческая ролевая игра про Русь'), 'RU: JSON-LD без суржика (В5)');
ok(!/Симбиоз математики и творчества<\/h3>/.test(ru), 'RU: дубль заголовка H2=H3 снят (В1)');
ok(ru.includes('<h3>Движок и Нарратор в связке</h3>'), 'RU: #1 переименован (В1)');
ok(en.includes('<h3>Engine and Narrator in tandem</h3>'), 'EN: #1 переименован (В1)');
ok(!/The AI does not invent — it selects/.test(en), 'EN: симметричное отрицание снято (В4)');
ok(!/не выдумывает — она выбирает/.test(ru), 'RU: симметричное отрицание снято (В4)');

console.log('--- 4. CSS: контраст, тач, золото, С2 ---');
ok(css.includes('.btn-share--ok{background:#b35a00}') && css.includes('.btn-share--tg{background:#0071a4}'), 'В8: соц-кнопки затемнены до AA');
ok(css.includes('strong.crit{color:#e06666}'), 'В8: .crit #e06666');
ok(css.includes('.nav-links a.lang-link{font-size:0.72rem;padding:0 0.72rem;min-height:44px'), 'В9: lang-link 44px');
ok(css.includes('.btn-share{display:inline-flex;align-items:center;justify-content:center;min-height:44px'), 'В9: btn-share 44px');
ok(css.includes('min-width: 44px;\n    min-height: 44px;'), 'В9: mobile-toggle 44×44');
ok(!/#c9a961/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'В10: второе золото выведено (только токен)');
ok(!/rgba\(201,\s*169,\s*97/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'В10: rgba старого золота выведены');
ok(css.includes('.features-grid .feature-card:first-child{grid-column:1 / -1}'), 'В7: флагманская карточка во всю ширину');
ok(css.includes('.grid--brp-4col{display:grid;grid-template-columns:repeat(2,1fr)'), 'В7: BRP 2×2');
ok(!/\.hero-badge\s*\{/.test(css) && !/\.btn-primary\s*\{/.test(css) && !/\.d100-dice\s*\{/.test(css) && !/\.img-placeholder\s*\{/.test(css) && !/\.hero-stats\s*\{/.test(css) && !/\.hero-subtitle\s*\{/.test(css), 'С2: legacy-hero CSS удалён (ни одного определения)');
ok(!/backdrop-filter:\s*blur\(16px\)/.test(css), 'Н7: невидимый backdrop-filter снят');
ok(css.includes('.slb-btn:focus-visible{outline:2px solid var(--gold)'), 'Н6: фокус-ринг лайтбокса');
ok(css.includes('.btn-game-start:active{transform:translateY(-1px)'), 'Н8: :active кнопки игры');
ok(css.includes('.lead-block{max-width:75ch'), 'С1: мера текста 75ch');
ok(!css.includes('font-size: 2.1rem;') && !css.includes('.pt-reign-name{font-size:0.76rem}'), 'С1: одноразовые кегли сведены');
ok(css.split('{').length === css.split('}').length, 'styles.css: баланс скобок цел');

console.log('--- 5. Код игры: мёртвый кластер, тост, гварды ---');
const audio = read('game/src/utils/audio.js');
const am = read('game/src/systems/AudioManager.js');
ok(!audio.includes('testAudioEffects') && !audio.includes('playRandomEffect'), 'В11: testAudioEffects/playRandomEffect удалены');
for (const dead of ['playGameOver', 'playAchievement', 'playDoorOpen', 'playWarning', 'playMagic', 'addSound', 'pauseMusic', 'resumeMusic', 'toggleMusicMute', 'toggleSFXMute', 'setMusicVolume', 'getMusicVolume', 'addMusic', 'playMusic(', 'stopAmbient']) {
    ok(!am.includes(dead), `В11: AudioManager.${dead.replace('(', '')} удалён`);
}
ok(am.includes('_loadRealSounds') && am.includes('playSound') && am.includes('isMusicMuted'), 'В11: живые методы целы');
ok(audio.includes('_oscTone(') && audio.includes('_ensureNoiseBuffer(seconds = 2)'), 'С10: единое ядро тона/шума');
ok(audio.includes('процедурный фолбэк реальных SFX'), 'Н9: заголовок модуля информативный');
ok(am.includes('допустимая деградация'), 'Н2: пустой catch задокументирован');
const weather = read('game/src/systems/Weather.js');
ok(weather.includes('if (_weatherToast && _weatherToast[0] === bg) _weatherToast = null;'), 'С9: кэш тоста сбрасывается');
ok(weather.includes("scene.events.once('shutdown'"), 'С9: shutdown-чистка тоста');
ok(!read('game/src/data/world.js').includes('LOCATION_NAME'), 'В11: LOCATION_NAME удалён');
const dlg = read('game/src/data/dialogue.js');
ok(dlg.split('scene.audioManager.playGoldSpend').length === 7, 'Н5: гварды сняты (6 прямых вызовов + 1 в комментарии отсутствует)');
ok(dlg.includes('get text() {\n            return t('), 'Н4: installDonationTalk — ленивые геттеры');
ok(dlg.includes('get choices() {'), 'Н4: choices — ленивый геттер');

console.log('--- 6. Текст игры: термины, плюрализация, слухи, свидетели ---');
const i18n = read('game/src/systems/i18n.js');
ok(i18n.includes("export function plural("), 'С3: plural() введён');
ok(i18n.includes("'{0} ({1} обаяние)': '{0} ({1} Charisma)'"), 'Н12: единый шаблон обаяния');
ok(!i18n.includes('this wares'), 'В14: this wares исправлено');
ok(i18n.includes("'гр.': 'grivna'"), 'Н13: сокращение гривны');
ok(!i18n.includes('Savvatiy'), 'В13: Savvaty — одна транслитерация');
ok(!i18n.includes('Smith Danila'), 'В13: Blacksmith Danila — единый термин');
ok(!/Law Code|the Law's|by the Law\b/.test(i18n.replace(/'[А-ЯЁ][^']*':/g, "''")), 'В13: EN — Sudebnik вместо Law/Law Code');
const rumor = read('game/src/data/rumors.js');
ok(rumor.includes('{ year: 1408') && rumor.includes('{ year: 1497'), 'В16: у вести — год события');
ok(rumor.includes('CHRONICLE_RUMORS.filter((r) => !r.year || r.year <= yearNow)'), 'В16: пул фильтруется по году мира');
const thief = read('game/src/data/thief.js');
ok(thief.includes('const pick = (arr) => arr['), 'В15: пул реплик свидетелей');
ok((thief.match(/Он через нашу сторону пробегал/g) || []).length <= 3, 'В15: исходный шаблон — лишь один из вариантов (3 из 9)');
ok(thief.includes('Тёмного человека встречал'), 'В15: добавлены варианты');
ok(i18n.includes("'Тёмного человека встречал — торопится к {0}, не оглядывается.'"), 'В15: EN-ключи вариантов в словаре');
ok((dlg.match(/Опять ты/g) || []).length === 2, 'С11: «Опять ты» 13 → 2 (разнообразие зачинов)');
ok(!dlg.includes('(репутация станет +30)'), 'С12: механика из уст старосты убрана');
ok(dlg.includes('благодать с тобой: всякое дело спорится на десятую долю легче'), 'С12: благословение отыграно дигетически');
const rep = read('game/src/data/reputation.js');
ok(rep.includes('у тебя {1}') && !rep.includes('у вас {1}'), 'С16: свадебные шаблоны на «ты»');
ok(rep.includes('прячет серебро за пазуху и кивает'), 'С12: прощение — словом обиженного');
const trade = read('game/src/systems/trade.js');
ok(trade.includes("tf(t('{0} ({1} обаяние)'), t(label)"), 'Н12: склейка t+tf заменена шаблоном');
ok(read('game/src/data/world.js').includes('resetVillageName') && !/export const LOCATION_NAME/.test(read('game/src/data/world.js')), 'world.js чист');

console.log('--- 7. SW, доки, АГЕНТ.md ---');
ok(sw.includes("const CACHE_NAME = 'chronicles-ruthenia-v135';"), 'SW: v135 (§4)');
ok(read('docs/SW_CHANGELOG.md').includes('- v135 — итерация 66.106'), 'SW_CHANGELOG: запись v135');
ok(read('АГЕНТ.md').includes('## 5.1 Процедура роллбэка'), 'С8: роллбэк-процедура задокументирована');
ok(read('АГЕНТ.md').includes('git revert --no-edit'), 'С8: механика реверса описана');
ok((css.match(/@font-face/g) || []).length === 19, 'пин: @font-face ×19');

console.log(`\n=== test_round146 (волна 66.106): ${pass} ✓ / ${fail} ✗ ===`);
if (fail > 0) process.exit(1);

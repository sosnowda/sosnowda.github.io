// test_round144.mjs — 66.105: фикс К6 frontier-аудита 66.104 — БЮДЖЕТЫ РЕАЛЬНЫ.
//   До фикса: CI-шаг Lighthouse мерил ТОЛЬКО localhost (python http.server)
//   с continue-on-error:true — результаты ни на что не влияли («фиктивный
//   гейт»), а LCP mobile на проде был 3.0s против бумажного бюджета 2.5s
//   (8 из 12 прогонов аудита вне бюджета). Также на лендинге жил
//   противоречивый «preload + loading=lazy» первого скриншота галереи —
//   ранний преплоад конкурировал с LCP-героем за полосу на мобильном.
//   Фикс: Lighthouse по ПРОДУ (RU+EN) БЕЗ continue-on-error, бюджеты в
//   lighthouserc.json (честные, по архиву 12 прод-прогонов), на push —
//   ожидание пересборки GitHub Pages по ETag; преплоад ленивого скриншота
//   удалён на обеих страницах.
// Запуск из корня репозитория: node game/tools/test_round144.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf-8');
let pass = 0, fail = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); cond ? pass++ : fail++; };

// ============================================================
// 1. CI: гейт по прод-URL без continue-on-error
// ============================================================
console.log('--- 1. CI: прод-гейт ---');
{
    const ci = read('.github/workflows/ci.yml');
    // шаг Lighthouse: URLs = прод
    const lhStep = ci.match(/- name: Lighthouse CI[^\n]*\n[\s\S]*?(?=\n      - name:|\njobs:|$)/);
    ok(!!lhStep, 'шаг Lighthouse найден');
    const step = lhStep ? lhStep[0] : '';
    ok(step.includes('https://sosnowda.github.io/') && step.includes('https://sosnowda.github.io/en/'),
        'Lighthouse меряет ПРОД (RU + EN), а не localhost');
    ok(!/continue-on-error/.test(step), 'шаг Lighthouse БЕЗ continue-on-error (провал = падение CI)');
    ok(step.includes('configFilePath: ./lighthouserc.json'), 'бюджеты подключены из lighthouserc.json');
    // ожидание пересборки Pages на push (иначе меряется старый деплой)
    ok(ci.includes('ETag poll') && ci.includes('OLD_ETAG'), 'на push — ожидание пересборки GitHub Pages по ETag');
    ok(ci.includes('branches: [main]'), 'CI на push в main');
}

// ============================================================
// 2. lighthouserc.json: честные бюджеты по архиву 12 прод-прогонов
// ============================================================
console.log('--- 2. Бюджеты lighthouserc.json ---');
{
    const cfg = JSON.parse(read('lighthouserc.json'));
    const a = cfg.ci.assert.assertions;
    ok(cfg.ci.collect.numberOfRuns === 1, 'collect: numberOfRuns=1');
    // перф: медиана прод-мобильных прогонов 0.90 (66.103 контроль 0.89–0.92)
    ok(a['categories:performance'][0] === 'error' && a['categories:performance'][1].minScore === 0.85,
        'performance ≥ 0.85 (медиана прод 0.90 — гейт с запасом)');
    ok(a['categories:accessibility'][1].minScore === 0.95, 'accessibility ≥ 0.95 (прод 1.0)');
    ok(a['categories:best-practices'][1].minScore === 0.75, 'best-practices ≥ 0.75 (прод 0.77 — Яндекс.Метрика, решение 66.88)');
    ok(a['categories:seo'][1].minScore === 0.95, 'seo ≥ 0.95 (прод 1.0)');
    // LCP: медиана прод-мобильных 3.0s; 2.5s = цель после снятия preload-lazy,
    // гейт — 3.5s (осознанный бюджет вместо бумажных 2.5s, К6)
    ok(a['largest-contentful-paint'][1].maxNumericValue === 3500, 'LCP ≤ 3500 мс (медиана 3000; 2500 — цель, не гейт)');
    ok(a['cumulative-layout-shift'][1].maxNumericValue === 0.1, 'CLS ≤ 0.1 (прод 0)');
    // все error-уровня — кроме уведомительного resource-summary
    const errs = Object.entries(a).filter(([, v]) => v[0] === 'error');
    ok(errs.length >= 6, `${errs.length} бюджетов уровня error (реальные гейты)`);
}

// ============================================================
// 3. Лендинги: противоречие preload+lazy снято
// ============================================================
console.log('--- 3. Преплоады лендингов ---');
{
    const ru = read('index.html'), en = read('en/index.html');
    ok(!ru.includes('screenshots/01-title.webp" as="image'), 'RU: преплоад ленивого скриншота удалён');
    ok(!en.includes('screenshots/01-title.webp" as="image'), 'EN: преплоад ленивого скриншота удалён');
    ok(/rel="preload"[^>]*as="image"[^>]*imagesrcset=/.test(ru) && /rel="preload"[^>]*as="image"[^>]*imagesrcset=/.test(en),
        'RU+EN: отзывчивый преплоад героя (imagesrcset+imagesizes) цел');
    ok(/styles\.css" as="style"/.test(ru) && /styles\.css" as="style"/.test(en), 'преплоад styles.css цел на обеих страницах');
}

console.log(`\n=== test_round144 (К6 CI-гейт): ${pass} ✓ / ${fail} ✗ ===`);
process.exit(fail > 0 ? 1 : 0);

// 66.41: быстрый визуальный рендер карты местности (проверка КРУГЛОЙ поляны).
// Запуск: node game/tools/render_map_6641.mjs [out.png]
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(__dirname, '_map6641_render.png');

// IMPORT_MAP.JS ИНЛАЙНОМ: убираем export-ключевые слова (модуль чистый,
// без зависимостей) и исполняем в странице как обычный скрипт.
const src = readFileSync(join(__dirname, '../src/systems/TerrainMap.js'), 'utf8')
    .replace(/^export\s+/gm, '');

const html = `<!doctype html><html><body style="margin:0">
<canvas id="c" width="680" height="540"></canvas>
<script>${src}</script>
<script>
  const ctx = document.getElementById('c').getContext('2d');
  drawTerrainMap(ctx);
  window.__done = true;
</script></body></html>`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(join(__dirname, '_map6641_render.html'), html);

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 700, height: 560 } });
await page.goto('file://' + join(__dirname, '_map6641_render.html'));
await page.waitForFunction('window.__done === true');
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 680, height: 540 } });
// пиксельная проверка круглости: светлая точка в центре, лесная — в старой полосе
const probe = await page.evaluate(() => {
    const d = document.getElementById('c').getContext('2d').getImageData(0, 0, 680, 540).data;
    const px = (x, y) => { const i = (y * 680 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    return {
        center_513_225: px(513, 225),   // центр поляны — светлая трава
        edge_559_225: px(559, 225),     // кромка круга — светлая/ореол
        outside_513_120: px(513, 120),  // полоса над кругом — лес (тёмнее)
        outside_513_330: px(513, 330),  // полоса под кругом — лес
        trail_544_234: px(544, 234),    // тропа сквозь поляну на восток
    };
});
console.log('ПРОВЕРКА ПИКСЕЛЕЙ:', JSON.stringify(probe));
await browser.close();
console.log('OK →', OUT);

// Конвертация /tmp/shots/*.png → assets/screenshots/*.webp (1280×720)
const sharp = require('/home/z/.npm-global/lib/node_modules/sharp');
const fs = require('fs');

const SRC = '/tmp/shots';
const DST = '/home/z/my-project/site-repo/assets/screenshots';
const MAP = {
    '01-title': '01-title',
    '02-character-select': '02-character-select',
    '03-character-custom': '03-character-custom',
    '04-village': '04-village',
    '05-map': '05-map',
    '06-elder-interior': '06-elder-interior',
    '07-priest-dialogue': '07-priest-dialogue',
    '08-combat': '08-combat',
    '09-thief-encounter': '09-thief-encounter',
};

(async () => {
    for (const [src, dst] of Object.entries(MAP)) {
        const inF = `${SRC}/${src}.png`;
        const outF = `${DST}/${dst}.webp`;
        const meta = await sharp(inF).metadata();
        if (meta.width !== 1280 || meta.height !== 720) {
            throw new Error(`${src}: ${meta.width}x${meta.height} !== 1280x720`);
        }
        await sharp(inF).webp({ quality: 85 }).toFile(outF);
        const kb = Math.round(fs.statSync(outF).size / 1024);
        console.log(`${dst}.webp  ${meta.width}x${meta.height}  ${kb} KB`);
    }
    console.log('OK');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

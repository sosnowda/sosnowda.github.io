// NpcWander.js — раунд 37 (пп.13,15 заявки): осмысленное блуждание жителей.
//
// ПРОБЛЕМА (заявка владельца): NPC «просто дёргались из стороны в сторону» —
// стояли на месте с твином качания ±3px, дети бегали твином сквозь дома,
// а движение не имело ни анимации, ни коллизий.
//
// РЕШЕНИЕ: каждый уличный NPC получает «поводок» вокруг своего двора:
//   стоял (1–4 с) → выбрал проходимый тайл рядом → ПОШЁЛ по нему
//   с анимацией ходьбы по направлению движения → стоит дальше.
// Путь строится только по ПРОХОДИМЫМ тайлам ('.', 'S', ',', 'B') —
// честная коллизия: житель физически не может зайти в дом/забор/дерево,
// поэтому «пропадание моделей за тайлами домов» исключено (п.15).
//
// Использование (VillageScene.rebuildStreetNpcs):
//   const w = attachNpcWander(this, { spr, anchorX, anchorY, radius, label, hint });
//   ... при перестройке сцены: w.stop();

const PASSABLE = new Set(['.', 'S', ',', 'B']);

export function isPassableTile(map, x, y) {
    if (!map || !map[y]) return false;
    const t = map[y][x];
    return t !== undefined && PASSABLE.has(t);
}

/**
 * BFS-путь между тайлами (короткий, для радиусов ≤ 4 смысла не теряет).
 * @returns {Array<[number,number]>|null} список шагов (без стартового тайла) или null
 */
export function findTilePath(map, sx, sy, tx, ty, maxLen = 20) {
    if (sx === tx && sy === ty) return [];
    if (!isPassableTile(map, tx, ty)) return null;
    const key = (x, y) => `${x},${y}`;
    const prev = new Map([[key(sx, sy), null]]);
    const queue = [[sx, sy]];
    while (queue.length) {
        const [x, y] = queue.shift();
        if (Math.abs(x - sx) + Math.abs(y - sy) >= maxLen) continue;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = x + dx, ny = y + dy;
            const k = key(nx, ny);
            if (prev.has(k)) continue;
            if (!isPassableTile(map, nx, ny)) continue;
            prev.set(k, [x, y]);
            if (nx === tx && ny === ty) {
                // восстановить путь
                const path = [];
                let cur = [nx, ny];
                while (cur && !(cur[0] === sx && cur[1] === sy)) {
                    path.unshift(cur);
                    cur = prev.get(key(cur[0], cur[1]));
                }
                return path;
            }
            queue.push([nx, ny]);
        }
    }
    return null;
}

/**
 * Привязать к спрайту NPC блуждание вокруг точки (в МИРОВЫХ координатах).
 *
 * @param {Phaser.Scene} scene
 * @param {Object} cfg — { spr, anchorX, anchorY, radius (тайлы), label?, hint?,
 *                         map, ts, idleMin?, idleMax?, stepMs?, onStep? }
 * @returns {{ stop: Function }} контроллер
 */
export function attachNpcWander(scene, cfg) {
    const {
        spr, anchorX, anchorY, radius = 2, map, ts,
        label = null, hint = null,
        idleMin = 1400, idleMax = 4200, stepMs = 420,
    } = cfg;
    if (!spr || !map) return { stop() {} };

    let stopped = false;
    let idleTimer = null;
    let walkTween = null;
    const anchorTile = { x: Math.round(anchorX / ts), y: Math.round(anchorY / ts) };

    const syncFollowers = () => {
        if (label) {
            label.x = spr.x;
            label.y = spr.y + 36;
            if (label.depth !== undefined) label.setDepth(spr.y / ts + 0.5);
        }
        if (hint) {
            hint.x = spr.x;
            hint.y = spr.y - 40;
            if (hint.depth !== undefined) hint.setDepth(spr.y / ts + 0.5);
        }
    };

    const playDir = (dir) => {
        const texKey = spr.texture && spr.texture.key;
        const walkKey = `${texKey}_walk_${dir}`;
        if (scene.anims.exists(walkKey)) {
            if (spr.anims.currentAnim?.key !== walkKey || !spr.anims.isPlaying) spr.play(walkKey);
            spr.setFlipX(false); // LPC-лист имеет отдельные кадры left/right — флип не нужен
        }
    };

    const playIdle = () => {
        const texKey = spr.texture && spr.texture.key;
        // сохраняем последний кадр направления как «стоящее» лицо
        const cur = spr.anims && spr.anims.currentAnim ? spr.anims.currentAnim.key : '';
        let dir = 'down';
        for (const d of ['down', 'left', 'right', 'up']) {
            if (cur.endsWith(`_walk_${d}`)) { dir = d; break; }
        }
        const idleKey = `${texKey}_idle_${dir}`;
        if (scene.anims.exists(idleKey)) spr.play(idleKey);
    };

    const pickTarget = () => {
        const r = Math.max(1, Math.round(radius));
        for (let attempt = 0; attempt < 10; attempt++) {
            const dx = Phaser.Math.Between(-r, r);
            const dy = Phaser.Math.Between(-r, r);
            const tx = anchorTile.x + dx;
            const ty = anchorTile.y + dy;
            if (!isPassableTile(map, tx, ty)) continue;
            const path = findTilePath(map, anchorTile.x, anchorTile.y, tx, ty, 4 + r * 2);
            if (path && path.length) return { path, dir0: dirOf(path[0][0] - anchorTile.x, path[0][1] - anchorTile.y) };
        }
        return null;
    };

    const dirOf = (dx, dy) => {
        if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
        return dx < 0 ? 'left' : 'right';
    };

    const walkPath = (path) => {
        if (stopped) return;
        const [tx, ty] = path[0];
        const dir = dirOf(tx - Math.round(spr.x / ts), ty - Math.round(spr.y / ts));
        playDir(dir);
        const nx = tx * ts + ts / 2;
        const ny = ty * ts + ts / 2;
        walkTween = scene.tweens.add({
            targets: spr,
            x: nx, y: ny,
            duration: Math.max(240, stepMs),
            ease: 'Linear',
            onComplete: () => {
                walkTween = null;
                anchorTile.x = tx; // тянет «поводок» за собой — живая траектория
                anchorTile.y = ty;
                syncFollowers();
                if (cfg.onStep) cfg.onStep(spr);
                const rest = path.slice(1);
                if (rest.length) {
                    walkPath(rest);
                } else {
                    playIdle();
                    scheduleIdle();
                }
            },
        });
    };

    const scheduleIdle = () => {
        if (stopped) return;
        const wait = Phaser.Math.Between(idleMin, idleMax);
        idleTimer = scene.time.delayedCall(wait, () => {
            if (stopped) return;
            const target = pickTarget();
            if (target) walkPath(target.path);
            else scheduleIdle();
        });
    };

    // старт: короткая пауза, затем — гулять
    idleTimer = scene.time.delayedCall(Phaser.Math.Between(400, 1200), () => {
        const target = pickTarget();
        if (target) walkPath(target.path);
        else scheduleIdle();
    });

    return {
        stop() {
            stopped = true;
            if (idleTimer) { idleTimer.remove(false); idleTimer = null; }
            if (walkTween) { walkTween.stop(); walkTween = null; }
        },
    };
}

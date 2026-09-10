export const calculateGridMetrics = (scene, rows, cols, marginTop = 100) => {
    const safeWidth = scene.scale.width * 0.95; // отступ 5%
    const safeHeight = scene.scale.height - marginTop - 20;
    
    // Вычисляем максимально возможный размер ячейки
    const cellW = safeWidth / cols;
    const cellH = safeHeight / rows;
    const cellSize = Math.min(cellW, cellH);
    
    // Вычисляем смещения для центрирования
    const boardWidth = cols * cellSize;
    const boardHeight = rows * cellSize;
    const startX = (scene.scale.width - boardWidth) / 2 + (cellSize / 2);
    const startY = marginTop + (safeHeight - boardHeight) / 2 + (cellSize / 2);
    
    return { cellSize, startX, startY };
};

/**
 * Ограничивает игровой объект заданными шириной и высотой, сохраняя пропорции
 * @param {Phaser.GameObjects.Image} target - целевой объект изображения
 * @param {number} maxWidth - максимальная ширина
 * @param {number} maxHeight - максимальная высота (необязательно)
 */
export const fitImage = (target, maxWidth, maxHeight) => {
    // Сначала сбрасываем масштаб, чтобы получить исходный размер
    target.setScale(1);
    
    // Вычисляем коэффициент масштабирования по ширине
    let scale = maxWidth / target.width;
    
    // Если задана высота и масштаб по высоте меньше — используем его (объект полностью поместится в рамку)
    if (maxHeight) {
        const heightScale = maxHeight / target.height;
        scale = Math.min(scale, heightScale);
    }
    
    // Применяем масштаб
    target.setScale(scale);
    
    return target;
}
